#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Static/script tests for the F28034 LLC bring-up firmware.

These tests do not power hardware.  They verify:
  - project naming / baseline constants
  - required volatile globals exist
  - forbidden legacy/CSS024D content is absent
  - frequency calculation expected values (150k=400/200, 70k/35k, rejects)
  - built artifacts and map symbols
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEBUG = ROOT / "Debug"

failures = []

def check(cond, msg):
    if cond:
        print(f"PASS: {msg}")
    else:
        print(f"FAIL: {msg}")
        failures.append(msg)

def read_text(p):
    return p.read_text(errors="replace")

# ----------------------------------------------------------------------
# 1. Project identity
# ----------------------------------------------------------------------
project = read_text(ROOT / ".project")
check("LLC_100W_F28034_BRINGUP_DSH" in project, "project name is BRINGUP_DSH")
check((ROOT / ".launches" / "LLC_100W_F28034_BRINGUP_DSH.launch").exists(),
      "launch file renamed")

# ----------------------------------------------------------------------
# 2. Baseline constants
# ----------------------------------------------------------------------
cfg = read_text(ROOT / "llc_config.h")
for token in ["LLC_BASELINE_PERIOD_150K        399U",
              "LLC_BASELINE_CMPA_150K          200U",
              "LLC_DEADBAND_TICKS              36U",
              "LLC_TBCLK_HZ                    60000000UL"]:
    check(token in cfg, f"config contains {token.strip()}")

# ----------------------------------------------------------------------
# 3. Required global variables
# ----------------------------------------------------------------------
required_globals = [
    "g_bringup_stage", "g_switching_frequency_hz", "g_actual_switching_frequency_hz", "g_pwm_period", "g_pwm_enabled", "g_diag_frequency_override",
    "g_adc_vout_raw", "g_adc_iout_raw", "g_adc_ipri_raw", "g_adc_sample_sequence", "g_adc_trigger_mode", "g_vout_volts", "g_iout_amps",
    "g_system_state", "g_fault_flags", "g_trip_count", "g_fast_fault_count",
    "g_tz_software_ost_count", "g_tz_hardware_trip_count", "g_software_ost_in_progress",
    "g_tz_active_window_trip_count", "g_tz_post_ost_trip_count", "g_post_ost_trip_delay_ticks", "g_power_window_state",
    "g_tz_isr_tbctr", "g_tz_isr_timer2", "g_tz_isr_software_ost_flag", "g_tz_isr_after_scheduled_ost", "g_tz_isr_gpio15", "g_tz_isr_compsts", "g_tz_isr_tzflg", "g_tz_event_phase", "g_probe_scheduled_ost_occurred",
    "g_test_run_id", "g_test_run_id_at_arm", "g_test_run_id_at_tz_isr", "g_test_run_id_at_stop",
    "g_test_dac_snapshot", "g_test_tbprd_snapshot", "g_test_cmpa_snapshot",
    "g_softstart_frequency_hz", "g_control_frequency_hz", "g_voltage_reference",
    "g_softstart_state", "g_softstart_period_limit", "g_softstart_deadtime", "g_softstart_step_count", "g_softstart_elapsed_ms",
    "g_softstart_period_limit_start", "g_softstart_period_limit_final", "g_softstart_period_step",
    "g_softstart_deadtime_start", "g_softstart_deadtime_final", "g_softstart_deadtime_step",
    "g_softstart_wait_5ms_ticks", "g_softstart_profile",
    "g_period_request", "g_period_limit", "g_period_applied",
    "g_burst_enabled", "g_burst_active", "g_burst_enter_count", "g_burst_exit_count", "g_ocp_recovery_mode",
    "g_softstart_abort_reason", "g_softstart_ocp_dac_code", "g_pwm_start_prepared", "g_enable_rising_count", "g_no_energy_test_mode",
    "g_first_start_seen", "g_first_start_tbprd", "g_first_start_cmpa", "g_first_start_dbred", "g_first_start_dbfed", "g_first_start_dacval", "g_first_start_ost", "g_first_start_pwm",
    "g_pre_stop_tzflg", "g_pre_stop_ost", "g_pre_stop_gpio15", "g_pre_stop_compsts", "g_pre_stop_tbctr", "g_pre_stop_timer2", "g_pre_stop_hardware_trip_seen",
    "g_active_bringup_stage", "g_stage_confirm_request", "g_stage_confirmed_mask",
    "g_fault_reset_request", "g_force_trip_request", "g_open_loop_target_frequency_hz",
    "g_power_run_min_frequency_hz", "g_adc_vout_filtered_raw", "g_adc_ipri_filtered_raw", "g_adc_vout_filter_acc", "g_adc_ipri_filter_acc", "g_adc_iout_filter_acc",
    "g_adc_iout_filtered_raw", "g_comp_dac_value", "g_comp_polarity", "g_comp_arm", "g_loopback_diag_request", "g_comp_tz_loopback_verified", "g_loopback_diag_result", "g_comp_inject_test_request", "g_comp_inject_test_armed", "g_comp_inject_test_disarm_request", "g_comp1_status", "g_comp1_dac_code", "g_comp_prestart_status", "g_comp_prestart_gpio15", "g_comp_prestart_tzflg", "g_comp_prestart_reject",
    "g_static_cal_request", "g_static_cal_dac", "g_static_cal_armed", "g_static_cal_initial_compsts", "g_static_cal_initial_gpio15", "g_static_cal_transition_detected", "g_static_cal_compsts_before", "g_static_cal_compsts_after", "g_static_cal_gpio15_before", "g_static_cal_gpio15_after", "g_static_cal_tzflg_after", "g_static_cal_disarm_request",
    "g_fault_history",
    "g_power_probe_request", "g_power_probe_result", "g_power_probe_active",
    "g_power_probe_duration_us", "g_power_probe_count",
    "g_power_probe_adc_vout_before", "g_power_probe_adc_vout_after",
    "g_power_probe_adc_ipri_before", "g_power_probe_adc_ipri_peak",
    "g_power_probe_adc_iout_before", "g_power_probe_adc_iout_after",
    "g_single_cycle_probe_request", "g_single_cycle_probe_result", "g_single_cycle_probe_active",
    "g_single_cycle_probe_frequency_hz", "g_single_cycle_probe_count", "g_single_cycle_probe_adc_ipri_before", "g_single_cycle_probe_adc_ipri_peak",
    "g_single_cycle_probe_adc_vout_before", "g_single_cycle_probe_adc_vout_after",
    "g_single_cycle_probe_stop_tbctr",
    "g_coldshot_vout_raw_before", "g_coldshot_ipri_raw_before",
    "g_coldshot_compsts_before", "g_coldshot_gpio15_before", "g_coldshot_tzflg_before",
    "g_coldshot_timer2_start", "g_coldshot_vout_baseline_avg", "g_coldshot_vout_baseline_samples",
    "g_coldshot_vin_actual_x10",
    "g_tz1_qualification_mode", "g_tz1_qualification_period",
    "g_comp_trip_dac_code", "g_comp_trip_tbctr", "g_comp_trip_vout_raw",
    "g_single_cycle_completed", "g_single_cycle_result",
    "g_multi_cycle_probe_request", "g_multi_cycle_probe_result", "g_multi_cycle_probe_active",
    "g_multi_cycle_probe_cycles", "g_multi_cycle_probe_completed_cycles",
    "g_multi_cycle_probe_adc_vout_before", "g_multi_cycle_probe_adc_vout_after",
    "g_multi_cycle_probe_adc_ipri_before", "g_multi_cycle_probe_adc_ipri_peak",
    "g_multi_cycle_probe_stop_tbctr", "g_multi_cycle_probe_stop_reason",
    "g_probe_isr_entry_tbctr", "g_probe_ost_command_tbctr", "g_probe_ost_after_tbctr",
    "g_probe_isr_entry_timer2", "g_probe_ost_command_timer2", "g_probe_ost_after_timer2",
    "g_probe_irq_latency_ticks", "g_probe_irq_to_ost_ticks",
    "g_probe_tzflg_immediate", "g_probe_tzflg_read2", "g_probe_tzflg_read3",
    "g_probe_tzflg_after_state_update", "g_probe_tzclr_write_count",
    "g_probe_saved_ier", "g_probe_saved_pieier1", "g_probe_saved_pieier3",
    "g_probe_interrupt_isolation_active",
    "g_probe_vout_min", "g_probe_vout_max",
    "g_probe_vout_first", "g_probe_vout_last", "g_probe_adc_sample_count",
    "g_vout_probe_request", "g_vout_probe_active", "g_vout_probe_target_raw",
    "g_vout_probe_stop_raw", "g_vout_probe_max_raw", "g_vout_probe_completed_cycles",
    "g_vout_probe_stop_reason", "g_vout_probe_dac_code",
    "g_vout_probe_max_cycles", "g_vout_probe_hard_limit_raw",
    "g_vout_probe_pre_stop_max_raw", "g_vout_probe_post_first_raw",
    "g_vout_probe_post_max_raw", "g_vout_probe_post_last_raw",
    "g_vout_probe_post_capture_active", "g_vout_probe_post_capture_count",
    "g_cal_hold_request", "g_cal_hold_active", "g_cal_hold_charge_done",
    "g_cal_hold_packet_active", "g_cal_hold_packet_count", "g_cal_hold_total_on_cycles",
    "g_cal_hold_raw_min", "g_cal_hold_raw_max", "g_cal_hold_raw_average",
    "g_cal_hold_raw_sum", "g_cal_hold_raw_samples", "g_cal_hold_fault",
    "g_cal_hold_stop_reason", "g_cal_hold_start_fast_tick", "g_cal_hold_duration_ms",
    "g_cal_hold_packet_start_raw", "g_cal_hold_packet_stop_raw", "g_cal_hold_packet_post_max_raw", "g_cal_hold_packet_post_last_raw", "g_cal_hold_packet_actual_cycles", "g_cal_hold_max_total_extra_cycles", "g_cal_hold_initial_stop_raw",
]
globals_h = read_text(ROOT / "app" / "llc_globals.h")
globals_c = read_text(ROOT / "app" / "llc_globals.c")
for name in required_globals:
    check(f"extern volatile" in globals_h and f" {name};" in globals_h,
          f"extern volatile declaration for {name}")
    check(re.search(rf"volatile\s+[^;]*\b{name}\b\s*(=\s*[^;]*)?;", globals_c),
          f"non-static volatile definition for {name}")

# ----------------------------------------------------------------------
# 4. Forbidden legacy / unrelated content
# ----------------------------------------------------------------------
all_src = "\n".join(
    read_text(p)
    for p in list(ROOT.glob("*.c")) + list(ROOT.glob("*.h")) +
        list((ROOT / "app").glob("*.c")) + list((ROOT / "app").glob("*.h")) +
        list((ROOT / "driver").glob("*.c")) + list((ROOT / "driver").glob("*.h")) +
        list((ROOT / "tools").glob("*.md"))
)
for forbidden in [
    "24V", "OLED", "CAN", "SCI", "2P2Z", "2P3Z",
    "InitSysCtrl()",
]:
    # "InitSysCtrl()" should not be called from our code (device support may define it).
    if forbidden == "InitSysCtrl()":
        check("InitSysCtrl()" not in all_src, "no InitSysCtrl() call in project sources")
    else:
        check(forbidden not in all_src, f"forbidden string absent: {forbidden}")

# ----------------------------------------------------------------------
# 5. Frequency calculation model
# ----------------------------------------------------------------------
TBCLK = 60_000_000

def calc(hz):
    period_clocks = (TBCLK + hz // 2) // hz
    period = period_clocks - 1
    cmp = period // 2
    return period, cmp

for hz, exp_period, exp_cmp in [(150_000, 399, 199),
                                 (70_000, 856, 428),
                                 (35_000, 1713, 856)]:
    p, c = calc(hz)
    check((p, c) == (exp_period, exp_cmp),
          f"model {hz/1000:.0f} kHz -> TBPRD={p}, CMPA={c}")

# Ensure source uses the same divide-by-frequency, not hard-coded only
pwm_src = read_text(ROOT / "driver" / "pwm.c")
check("(LLC_TBCLK_HZ + (hz / 2UL)) / hz" in pwm_src, "frequency calculation uses rounded TBCLK/hz")
check("(period + 1UL) / 2UL" in pwm_src, "50% compare uses (period+1)/2")
check("LLC_DEADBAND_TICKS + LLC_MIN_PULSE_TICKS" in pwm_src,
      "dead-band / minimum pulse check present")

# ----------------------------------------------------------------------
# 6. Stage / state enums
# ----------------------------------------------------------------------
check("BRINGUP_STAGE_5A_OPEN_LOOP_MANUAL" in cfg, "Stage 5A enum present")
check("BRINGUP_STAGE_5B_SOFT_START_TEST" in cfg, "Stage 5B enum present")
check("BRINGUP_STAGE_6_CLOSED_LOOP" in cfg, "Stage 6 enum present")
check("BRINGUP_STAGE_7_POWER_RUN" in cfg, "Stage 7 enum present")
check("SYS_STATE_FAULT" in cfg, "FAULT state enum present")

# ----------------------------------------------------------------------
# 7. Build artifacts and map symbols
# ----------------------------------------------------------------------
out = DEBUG / "LLC_100W_F28034_BRINGUP_DSH.out"
mapf = DEBUG / "LLC_100W_F28034_BRINGUP_DSH.map"
linkinfo = DEBUG / "LLC_100W_F28034_BRINGUP_DSH_linkInfo.xml"
check(out.exists(), "fresh .out exists")
check(mapf.exists(), "fresh .map exists")
check(linkinfo.exists(), "fresh _linkInfo.xml exists")

if mapf.exists():
    map_text = read_text(mapf)
    for name in required_globals:
        check(f"_{name}" in map_text or f" {name} " in map_text,
              f"map contains symbol {name}")

# ----------------------------------------------------------------------
# 8. TUTORIAL_SOFTSTART_INTEGRATION_FIX_V1 static checks
# ----------------------------------------------------------------------
soft_start_src = read_text(ROOT / "app" / "soft_start.c")
state_machine_src = read_text(ROOT / "app" / "state_machine.c")
control_src = read_text(ROOT / "app" / "control.c")
comparator_src = read_text(ROOT / "app" / "comparator.c")
pwm_src2 = read_text(ROOT / "driver" / "pwm.c")

check("if (g_system_state != SYS_STATE_SOFT_START) return;" in soft_start_src,
      "SoftStart_Update5ms only advances in SYS_STATE_SOFT_START")
check("void SoftStart_Begin(void)" in soft_start_src,
      "SoftStart_Begin exists")
check("g_period_request         = g_softstart_period_limit_final;" in soft_start_src,
      "SoftStart_Begin sets period_request to final limit")
check("PWM_PrepareStart(g_period_applied, g_softstart_deadtime, 0U);" in soft_start_src,
      "SoftStart deterministic start uses PWM_PrepareStart")
check("PWM_StartDeterministic();" in soft_start_src,
      "SoftStart deterministic start uses PWM_StartDeterministic")
check("COMP_ArmForPowerStart(g_softstart_ocp_dac_code);" in soft_start_src,
      "SoftStart arms comparator before PWM release")
check("void COMP_ArmForPowerStart(Uint16 requested_dac)" in comparator_src,
      "COMP_ArmForPowerStart implemented")
check("Uint16 PWM_ConfigTopologyValid(void)" in pwm_src2,
      "PWM_ConfigTopologyValid implemented")
check("Uint16 PWM_RuntimeValuesValid(Uint32 period, Uint16 deadtime)" in pwm_src2,
      "PWM_RuntimeValuesValid implemented")
check("(period + 1UL) / 2UL" in pwm_src2,
      "CMPA unified formula (period+1)/2")
ctrl_slow_part = control_src.split("void CTRL_SlowTask", 1)[1] if "void CTRL_SlowTask" in control_src else ""
check("LLC_SetFrequencyHz" not in ctrl_slow_part,
      "CTRL_SlowTask no longer contains LLC_SetFrequencyHz")
check("SoftStart_Begin();" in state_machine_src,
      "Stage5B enable path calls SoftStart_Begin")
check("g_system_state != SYS_STATE_SOFT_START" in comparator_src,
      "COMP_ArmForPowerStart requires SOFT_START")
check("SOFTSTART_ABORTED" in soft_start_src,
      "SoftStart abort state exists")
check("g_pwm_start_prepared" in pwm_src2,
      "PWM prepared flag exists")
check("rising_edge" in state_machine_src and "falling_edge" in state_machine_src,
      "SM_HandleEnable uses rising/falling edge tracking")
check("g_enable_rising_count++" in state_machine_src,
      "Enable rising count increments once per edge")

# ----------------------------------------------------------------------
# PROFILE_C_VOUT_TARGET_LADDER_V1 (2026-08-17)
# ----------------------------------------------------------------------
probe_src = read_text(ROOT / "app" / "power_probe.c")
prot_src = read_text(ROOT / "app" / "protection.c")

check("ACCEL_VOUT_TARGET_1200" in globals_h and "ACCEL_VOUT_TARGET_1400" in globals_h,
      "V1 target ladder constants present")
check("ACCEL_STOP_HARD_LIMIT" in globals_h and "ACCEL_STOP_VOUT_TARGET" in globals_h
      and "ACCEL_STOP_MAX_CYCLES" in globals_h and "ACCEL_STOP_TZ_TRIP" in globals_h
      and "ACCEL_STOP_STALE_ADC" in globals_h,
      "V1 stop-reason constants present")
check("g_accel_vout_target_raw" in globals_h and "g_accel_vout_hard_limit_raw" in globals_h
      and "g_accel_target_rejected" in globals_h,
      "V1 target/hard-limit globals declared")
check("g_accel_stop_target_raw" in globals_h and "g_accel_stop_raw" in globals_h
      and "g_accel_stop_max_raw" in globals_h and "g_accel_stop_completed_cycles" in globals_h
      and "g_accel_stop_phase" in globals_h and "g_accel_stop_dacval" in globals_h
      and "g_accel_stop_soca_count" in globals_h,
      "V1 stop-snapshot globals declared")
check("= ACCEL_VOUT_TARGET_1200" in globals_c,
      "firmware default target is 1200 (first shot)")
check("ACCEL_HardLimitForTarget" in probe_src,
      "firmware-fixed target->hard-limit mapping present")
check("if (target_raw == ACCEL_VOUT_TARGET_1200) return ACCEL_VOUT_HARD_LIMIT_1200" in probe_src
      and "if (target_raw == ACCEL_VOUT_TARGET_1400) return ACCEL_VOUT_HARD_LIMIT_1400" in probe_src,
      "hard limits fixed: 1200->1300, 1400->1450")
check("g_accel_vout_hard_limit_raw == 0U" in probe_src,
      "illegal target rejects before real power (REJECT path)")
check("ACCEL_STOP_HARD_LIMIT" in probe_src and "g_adc_vout_pwm_sync_raw >= g_accel_vout_hard_limit_raw" in probe_src,
      "hard-limit check on fresh PWM-sync sample")
check("ACCEL_STOP_VOUT_TARGET" in probe_src and "g_adc_vout_pwm_sync_raw >= g_accel_vout_target_raw" in probe_src,
      "target check on fresh PWM-sync sample")
check("ACCEL_STOP_STALE_ADC" in probe_src and "g_adc_pwm_sync_stale_abort" in probe_src,
      "miss>=3 immediate stop path present")
check("vout_fresh_this_cycle" in probe_src,
      "VOUT judgment gated on this-cycle fresh sample")
check("ACCEL_FreezeStopSnapshot" in probe_src,
      "stop-moment snapshot freeze present")
check("ACCEL_STOP_TZ_TRIP" in prot_src,
      "TZ ISR uses ACTIVE_TRIP stop reason")
check(">= 800U" not in probe_src and ">= 300U" not in probe_src,
      "old 800/300 diagnostic thresholds removed")

# ----------------------------------------------------------------------

# ----------------------------------------------------------------------
print()
if failures:
    print(f"{len(failures)} check(s) FAILED")
    sys.exit(1)
print("ALL STATIC CHECKS PASSED")
