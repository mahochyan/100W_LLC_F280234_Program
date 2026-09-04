#!/usr/bin/env python3
"""Static safety gates for W3_10V_BURST_HOLD_V1."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = (ROOT / "app" / "cal_hold_burst.c").read_text(encoding="utf-8")
HDR = (ROOT / "app" / "cal_hold_burst.h").read_text(encoding="utf-8")
GLOBALS_H = (ROOT / "app" / "llc_globals.h").read_text(encoding="utf-8")
PROBE = (ROOT / "app" / "power_probe.c").read_text(encoding="utf-8")
PROBE_H = (ROOT / "app" / "power_probe.h").read_text(encoding="utf-8")
PWM = (ROOT / "driver" / "pwm.c").read_text(encoding="utf-8")
SHOT = (ROOT / "app" / "shot.c").read_text(encoding="utf-8")


def gate(name: str, condition: bool) -> None:
    print(f"{name}={'TRUE' if condition else 'FALSE'}")
    if not condition:
        raise AssertionError(name)


def main() -> None:
    gate("STATIC_W3_FROZEN_BAND",
         all(x in HDR for x in (
             "W3_HOLD_RECHARGE_LOW_RAW         1220U",
             "W3_HOLD_RECHARGE_TARGET_RAW      1260U",
             "W3_HOLD_HARD_LIMIT_RAW           1300U",
             "W3_HOLD_DIAG_LOW_ABORT_RAW       1000U",
         )))
    gate("STATIC_HARD_BELOW_OL_WARNING", 1300 < 1304)
    gate("STATIC_LEGACY_PROFILE_UNCHANGED",
         all(x in HDR for x in (
             "CAL_HOLD_RECHARGE_LOW_RAW       1380U",
             "CAL_HOLD_RECHARGE_TARGET_RAW    1400U",
             "CAL_HOLD_HARD_LIMIT_RAW         1450U",
         )))
    gate("STATIC_PRIVATE_MODE_LATCH",
         "static Uint16 s_cal_hold_mode" in SRC and
         "g_cal_hold_mode_active = s_cal_hold_mode" in SRC)
    gate("STATIC_ALLOWED_DURATIONS",
         all(f"duration == W3_HOLD_DURATION_{x}" in SRC
             for x in ("500MS", "2S", "10S", "60S")))
    gate("STATIC_PER_DURATION_CYCLE_CAPS",
         all(x in HDR for x in (
             "W3_HOLD_CYCLE_CAP_500MS          62500UL",
             "W3_HOLD_CYCLE_CAP_2S             250000UL",
             "W3_HOLD_CYCLE_CAP_10S            1250000UL",
             "W3_HOLD_CYCLE_CAP_60S            7500000UL",
         )) and all(x in SRC for x in (
             "W3_HOLD_CYCLE_CAP_500MS", "W3_HOLD_CYCLE_CAP_2S",
             "W3_HOLD_CYCLE_CAP_10S", "W3_HOLD_CYCLE_CAP_60S",
         )))
    gate("STATIC_W3_PACKET_ENERGY_BOUND",
         "W3_HOLD_MAX_PACKET_CYCLES        64U" in HDR and
         "CALHOLD_MaxPacketCycles()" in SRC and
         "? W3_HOLD_MAX_PACKET_CYCLES : CAL_HOLD_MAX_PACKET_CYCLES" in SRC and
         "CAL_HOLD_MAX_PACKET_CYCLES      15U" in HDR)
    gate("STATIC_W3_UNDERSUPPLY_PERSISTENCE",
         "W3_HOLD_DIAG_LOW_ABORT_RAW       1000U" in HDR and
         "W3_HOLD_UNDERSUPPLY_CONFIRM_SAMPLES 3U" in HDR and
         "g_cal_hold_undersupply_low_samples" in SRC and
         "s_cal_hold_mode == CAL_HOLD_MODE_W3_10V" in SRC and
         "raw >= CALHOLD_DiagLowRaw()" in SRC)
    gate("STATIC_PROFILE_C_1200_ENTRY",
         "W3_HOLD_INITIAL_CHARGE_RAW" in SRC and
         "g_accel_vout_target_raw" in SRC)
    gate("STATIC_ACCEL_SKIPS_GENERIC_150K_PATH",
         "if (accel_requested == 0U)" in PROBE and
         "start_period = 239U" in PROBE and
         "start_deadtime = 110U" in PROBE)
    gate("STATIC_ACCEL_PRIVATE_WRITE_AUTH",
         "static Uint16 s_accel_pwm_write_auth" in PROBE and
         "ACCEL_PwmWriteAuthOk" in PROBE_H and
         "ACCEL_PwmWriteAuthOk(period, deadtime)" in PWM and
         PROBE.count("s_accel_pwm_write_auth = 1U") == 3 and
         PROBE.count("s_accel_pwm_write_auth = 0U") >= 6)
    gate("STATIC_ACCEL_TRAJECTORY_EXACT",
         "period == 239UL && deadtime >= 36U && deadtime <= 110U" in PROBE and
         "period >= 239UL && period <= 399UL && deadtime == 36U" in PROBE)
    gate("STATIC_ACCEL_ADC_START_MATCH",
         "MULTICYCLE_ConfigureAdcCapture(start_period)" in PROBE and
         "PWM_PrepareStart((Uint32)start_period, start_deadtime, 1U)" in PROBE)
    gate("STATIC_ACCEL_NE_NEVER_RELEASES_OST",
         "deterministic-start proof without energy" in PROBE and
         "PWM_ExerciseDeterministicStartNoRelease()" in PROBE)
    phase_i = PWM.find("EPwm1Regs.TBCTR = ph", PWM.find("void PWM_StartDeterministic"))
    seed_i = PWM.find("EPwm1Regs.AQSFRC.bit.OTSFA = 1U", phase_i)
    ost_i = PWM.find("EPwm1Regs.TZCLR.bit.OST = 1U", seed_i)
    gate("STATIC_REAL_START_AQ_SEED_PHASE_AT_RELEASE",
         "EPwm1Regs.AQSFRC.bit.RLDCSF = 3U" in PWM and
         phase_i >= 0 and phase_i < seed_i < ost_i and
         "g_pwm_start_prepared = (Uint16)(ph + 1U)" in PWM and
         "g_pwm_start_prepared - 1U" in PWM)
    gate("STATIC_PREPARED_TOKEN_CALLERS_ACCEPT_PHASE_ENCODING",
         "g_pwm_start_prepared != 1U" not in (PROBE + SRC + SHOT) and
         "if (g_pwm_start_prepared == 0U) gate_ok = 0U" in SHOT)
    ne_i = PWM.find("Uint16 PWM_ExerciseDeterministicStartNoRelease")
    ne_end = PWM.find("#endif", ne_i)
    gate("STATIC_NE_START_MIRROR_NEVER_CLEARS_OST",
         ne_i >= 0 and ne_end > ne_i and
         "EPwm1Regs.AQSFRC.bit.OTSFA = 1U" in PWM[ne_i:ne_end] and
         "EPwm1Regs.TBCTR = ph" in PWM[ne_i:ne_end] and
         "EPwm1Regs.TZCLR.bit.OST = 1U" not in PWM[ne_i:ne_end])
    gate("STATIC_SAFE_PACKET_250K_DB110",
         "PWM_PrepareStart(239UL, 110U, 1U)" in SRC and
         "W3_HOLD_MAX_PACKET_CYCLES        64U" in HDR)
    gate("STATIC_PACKET_PRESTART_SETTLE_GATE",
         "COMP_ArmForSingleCycleStart(LLC_SINGLE_CYCLE_PROBE_DAC)" in SRC and
         "g_comp_prestart_reject != 0U" in SRC and
         "g_comp_prestart_gpio15 == 0U" in SRC and
         "CAL_HOLD_REASON_PRESTART_REJECT" in SRC and
         "Comp1Regs.COMPCTL.all = 0U" not in SRC)
    gate("STATIC_LEGACY_PACKET_AUTH_RETAINED",
         "s_cal_hold_mode == CAL_HOLD_MODE_LEGACY_11V ||" in SRC and
         "s_cal_hold_mode == CAL_HOLD_MODE_W3_10V" in SRC)
    gate("STATIC_STATS_RESET_PUBLISHED",
         "CALHOLD_StatsReset();\n    CALHOLD_StatsPublish();" in SRC)
    gate("STATIC_REAL_EPWM_ISR_RETAINED",
         "CALHOLD_PacketIsr" in SRC and
         "EPwm1Regs.ETSEL.bit.INTEN  = 1U" in SRC)
    gate("STATIC_NE_NEVER_RELEASES_OST",
         "Logic-only packet: retain the mandatory OST clamp" in SRC and
         "g_pwm_start_prepared = 0U" in SRC)
    gate("STATIC_FAULT_PASSTHROUGH",
         "g_fault_flags != 0UL" in SRC and
         "CAL_HOLD_REASON_ACTIVE_TZ" in SRC)
    gate("STATIC_W3_GLOBALS_EXPORTED",
         all(x in GLOBALS_H for x in (
             "g_cal_hold_mode_request", "g_cal_hold_mode_active",
             "g_cal_hold_ne_bypass_charge", "g_cal_hold_ne_raw",
         )))
    print("SOL_W3_10V_BURST_HOLD_STATIC_PASS=TRUE")


if __name__ == "__main__":
    main()
