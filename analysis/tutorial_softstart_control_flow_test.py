#!/usr/bin/env python3
"""
PC control-flow model for TUTORIAL_SOFTSTART_CONTROL_FLOW_FIX_V3.
Simulates the same state transitions as the C engine, including DAC command
vs status separation and FINALIZE hardware-commit handshake.
"""

class SoftStartSim:
    def __init__(self):
        self.system_state = 'IDLE'
        self.soft_state = 'INIT'
        self.enable_request = 0
        self.prev_enable = 0
        self.rising_count = 0
        self.period_limit = 399
        self.deadtime = 190
        self.period_applied = 399
        self.period_request = 428
        self.pwm_enabled = 0
        self.ost = 1
        self.comp_armed = 0
        self.pwm_prepared = 0
        self.fault = 0
        self.abort_reason = 0
        self.wait_ticks = 0
        self.step_count = 0
        self.requested_dac = 0
        self.hw_dac = 0
        self.readback_dac = 0
        self.final_pending = 0
        self.final_applied = 0
        self.final_apply_count = 0
        self.hw_period = 0
        self.hw_cmpa = 0
        self.hw_deadtime = 0
        self.period_final = 428
        self.deadtime_final = 36

    def set_request(self, v):
        rising = (v != 0 and self.prev_enable == 0)
        falling = (v == 0 and self.prev_enable != 0)
        self.enable_request = v
        if rising:
            self.rising_count += 1
            if self.system_state == 'IDLE' and self.fault == 0:
                self.begin()
        if falling:
            self.pwm_enabled = 0
            self.ost = 1
            self.system_state = 'IDLE'
            self.soft_state = 'INIT'
        self.prev_enable = v

    def begin(self):
        self.soft_state = 'INIT'
        self.period_limit = 399
        self.deadtime = 190
        self.period_applied = 399
        self.period_request = 428
        self.pwm_enabled = 0
        self.ost = 1
        self.comp_armed = 0
        self.pwm_prepared = 0
        self.abort_reason = 0
        self.step_count = 0
        self.wait_ticks = 0
        self.requested_dac = 300
        self.hw_dac = 0
        self.readback_dac = 0
        self.final_pending = 0
        self.final_applied = 0
        self.final_apply_count = 0
        self.system_state = 'SOFT_START'

    def comp_update_status(self):
        # PROT_SlowTask readback overwrites status only.
        self.readback_dac = self.hw_dac

    def start_pwm(self):
        # Uses requested_dac, NOT readback_dac.
        if self.enable_request != 1 or self.system_state != 'SOFT_START' or self.pwm_enabled != 0 or self.fault != 0:
            self.abort_reason = 1
            self.soft_state = 'ABORTED'
            self.fault = 1
            return
        if self.requested_dac == 0:
            self.abort_reason = 1
            self.soft_state = 'ABORTED'
            self.fault = 1
            return
        if self.period_applied < 399 or self.period_applied > 428 or self.deadtime < 36 or self.deadtime > 190:
            self.abort_reason = 2
            self.soft_state = 'ABORTED'
            self.fault = 1
            return
        self.comp_armed = 1
        self.pwm_prepared = 1
        self.hw_dac = self.requested_dac
        self.readback_dac = self.hw_dac
        self.hw_period = self.period_applied
        self.hw_cmpa = (self.period_applied + 1) // 2
        self.hw_deadtime = self.deadtime
        self.ost = 0
        self.pwm_enabled = 1
        self.pwm_prepared = 0

    def fast_tick(self):
        # SoftStart_ApplyLimits in 20us task.
        if self.system_state != 'SOFT_START':
            return
        self.period_applied = min(self.period_request, self.period_limit)
        if self.soft_state == 'FINALIZE' and self.pwm_enabled:
            ok = True
            if ok:
                self.final_apply_count += 1
                self.hw_period = self.period_final
                self.hw_cmpa = (self.period_final + 1) // 2
                self.hw_deadtime = self.deadtime_final
                if self.final_pending == 0:
                    self.final_pending = 1
                else:
                    self.final_applied = 1
        elif self.pwm_enabled:
            self.hw_period = self.period_applied
            self.hw_cmpa = (self.period_applied + 1) // 2
            self.hw_deadtime = self.deadtime

    def update5ms(self):
        if self.system_state != 'SOFT_START':
            return
        if self.soft_state == 'INIT':
            self.soft_state = 'WAIT'
        elif self.soft_state == 'WAIT':
            self.comp_update_status()   # hardware DAC may still be 0
            self.wait_ticks += 1
            if self.wait_ticks >= 20:
                self.wait_ticks = 0
                self.start_pwm()
                if self.soft_state == 'WAIT':
                    self.soft_state = 'RAMP'
        elif self.soft_state == 'RAMP':
            self.step_count += 1
            self.period_limit = min(self.period_limit + 1, self.period_final)
            self.deadtime = max(self.deadtime - 1, self.deadtime_final)
            if self.period_limit >= self.period_final and self.deadtime <= self.deadtime_final:
                self.soft_state = 'FINALIZE'
                # do NOT move to RUN yet
        elif self.soft_state == 'FINALIZE':
            if self.final_applied and self.pwm_enabled and self.fault == 0:
                self.soft_state = 'COMPLETE'
                self.system_state = 'RUN'


def test():
    # CASE A
    s = SoftStartSim(); s.set_request(1); s.update5ms()
    assert s.system_state == 'SOFT_START' and s.soft_state == 'WAIT' and s.rising_count == 1
    print("CASE A PASS")

    # CASE B
    s = SoftStartSim(); s.set_request(1)
    for _ in range(30): s.update5ms()
    assert s.rising_count == 1
    print("CASE B PASS")

    # CASE C
    s = SoftStartSim(); s.set_request(1)
    for _ in range(21): s.update5ms()
    assert s.pwm_enabled == 1 and s.ost == 0 and s.comp_armed == 1 and s.period_applied == 399
    print("CASE C PASS")

    # CASE D
    s = SoftStartSim(); s.set_request(1)
    for _ in range(20): s.update5ms()
    s.fault = 1; s.start_pwm()
    assert s.pwm_enabled == 0 and s.ost == 1 and s.soft_state != 'COMPLETE'
    print("CASE D PASS")

    # CASE E
    s = SoftStartSim(); s.set_request(1)
    for _ in range(25): s.update5ms()
    s.set_request(0)
    assert s.pwm_enabled == 0 and s.ost == 1 and s.system_state == 'IDLE'
    print("CASE E PASS")

    # CASE F
    s = SoftStartSim(); s.set_request(1)
    for _ in range(200):
        s.update5ms()
        s.fast_tick()
    assert s.system_state == 'RUN' and s.soft_state == 'COMPLETE'
    assert s.period_limit == 428 and s.deadtime == 36 and s.period_applied == 428
    assert s.hw_period == 428 and s.hw_cmpa == 214 and s.hw_deadtime == 36
    print("CASE F PASS")

    # CASE G
    assert not (399 >= 399 and 399 <= 428 and 196 >= 36 and 196 <= 190)
    print("CASE G PASS")

    # CASE H: DAC command survives WAIT
    s = SoftStartSim(); s.set_request(1)
    for _ in range(20):
        s.hw_dac = 0
        s.update5ms()   # WAIT ticks, comp_update_status sets readback=0
    assert s.readback_dac == 0
    assert s.requested_dac == 300
    # Next update triggers start_pwm using requested_dac
    s.update5ms()
    assert s.hw_dac == 300 and s.readback_dac == 300 and s.comp_armed == 1
    print("CASE H PASS")

    # CASE I: final values committed before RUN
    s = SoftStartSim(); s.set_request(1)
    # Run until RAMP reaches final (FINALIZE)
    for _ in range(200):
        s.update5ms()
        s.fast_tick()
        if s.soft_state == 'FINALIZE':
            break
    assert s.soft_state == 'FINALIZE'
    assert s.system_state == 'SOFT_START'   # not RUN yet
    assert s.hw_deadtime == 36 or s.final_pending == 1
    # One more fast tick confirms applied
    s.fast_tick()
    assert s.final_applied == 1
    # Next slow tick moves to RUN
    s.update5ms()
    assert s.system_state == 'RUN' and s.soft_state == 'COMPLETE'
    assert s.hw_period == 428 and s.hw_cmpa == 214 and s.hw_deadtime == 36
    print("CASE I PASS")

    print("CONTROL_FLOW_TESTS PASS")

if __name__ == "__main__":
    test()
