#!/usr/bin/env python3
"""Static/model gates for the W5 private 250 kHz/DB110 packet-start authority."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
cal = (root / "app" / "cal_hold_burst.c").read_text(encoding="utf-8")
pwm = (root / "driver" / "pwm.c").read_text(encoding="utf-8")

start = cal.index("Uint16 CALHOLD_W3PacketAuthOk(void)")
end = cal.index("Uint16 CALHOLD_W3PacketRampAuthOk(void)", start)
auth = cal[start:end]
ramp_start = end
ramp_end = cal.index("#if STAGE6_W5_LADDER_TEST\n#include", ramp_start)
ramp_auth = cal[ramp_start:ramp_end]
isr_start = cal.index("void CALHOLD_PacketIsr(void)")
isr_end = cal.index("void CALHOLD_FastTask(void)", isr_start)
packet_isr = cal[isr_start:isr_end]

checks = {
    "W5_PACKET_AUTH_COMPILE_GATED": (
        "#if STAGE6_W5_LADDER_TEST" in auth
        and "s_cal_hold_mode == CAL_HOLD_MODE_W5_LADDER" in auth
    ),
    "W5_PACKET_AUTH_RETAINS_PRIVATE_LATCH": "s_w3_packet_write_auth != 0U" in auth,
    "W5_PACKET_AUTH_RETAINS_STAGE_AND_IDLE": (
        "g_bringup_stage == BRINGUP_STAGE_5A_OPEN_LOOP_MANUAL" in auth
        and "g_system_state == SYS_STATE_IDLE" in auth
    ),
    "W5_PACKET_AUTH_RETAINS_COMPARATOR_GATES": (
        "g_comp_tz_loopback_verified != 0U" in auth
        and "g_comp_inject_test_armed != 0U" in auth
        and "g_comp_prestart_reject == 0U" in auth
        and "g_comp_prestart_gpio15 != 0U" in auth
    ),
    "W5_PACKET_AUTH_RETAINS_FAULT_PWM_OST_GATES": (
        "g_fault_flags == 0UL" in auth
        and "g_pwm_enabled == 0U" in auth
        and "EPwm1Regs.TZFLG.bit.OST != 0U" in auth
    ),
    "W5_PACKET_START_EXACT_PROFILE_ONLY": (
        "period == 239UL && deadtime == 110U" in pwm
        and "CALHOLD_W3PacketAuthOk() != 0U" in pwm
    ),
    "W5_PACKET_RAMP_AUTH_COMPILE_GATED": (
        "s_cal_hold_mode == CAL_HOLD_MODE_W5_LADDER" in ramp_auth
        and "g_cal_hold_state == CAL_HOLD_PACKET" in ramp_auth
        and "output_state_ok != 0U" in ramp_auth
    ),
    "W5_PACKET_RAMP_REUSES_EXACT_W3_CADENCE": (
        "s_cal_hold_mode == CAL_HOLD_MODE_W5_LADDER" in packet_isr
        and "case 15U:  next_db = 105U" in packet_isr
        and "case 155U: next_db = 36U" in packet_isr
        and "PWM_SetDeadbandOnly(next_db)" in packet_isr
    ),
    "W5_BOUNDED_MULTI_PACKET_RECOVERY": (
        "W5_HOLD_UNDERSUPPLY_CONFIRM_SAMPLES       8U" in
        (root / "app" / "cal_hold_burst.h").read_text(encoding="utf-8")
        and "CALHOLD_UndersupplyConfirmSamples()" in cal
    ),
    "W5_OBSERVED_TZ_REGION_EXCLUDED": (
        "W5_HOLD_MAX_PACKET_CYCLES                 45U" in
        (root / "app" / "cal_hold_burst.h").read_text(encoding="utf-8")
        and "W5_HOLD_PACKET_DB_MIN                     95U" in
        (root / "app" / "cal_hold_burst.h").read_text(encoding="utf-8")
        and "next_db >= CALHOLD_PacketDbMin()" in packet_isr
        and "return W5_HOLD_PACKET_DB_MIN" in cal
        and "return W5_HOLD_MAX_PACKET_CYCLES" in cal
    ),
}

failed = False
for name, ok in checks.items():
    print(f"{name}={'TRUE' if ok else 'FALSE'}")
    failed |= not ok
if failed:
    raise SystemExit(1)
print("SOL_W5_PACKET_START_AUTH_STATIC_PASS=TRUE")
