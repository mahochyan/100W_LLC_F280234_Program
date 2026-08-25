#!/usr/bin/env python3
"""Static and exact-Q12 proof for the W2 candidate3 handoff brake."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTROL = (ROOT / "app" / "control.c").read_text(encoding="utf-8")
SOFT_H = (ROOT / "app" / "soft_start.h").read_text(encoding="utf-8")
SOFT_C = (ROOT / "app" / "soft_start.c").read_text(encoding="utf-8")

Q = 12
ONE = 1 << Q
KP_RAW = 220_587
KI_RAW = 1_471
BIAS = 150_000 * ONE
I_MAX = 60_000 * ONE
F_MIN = 145_000
F_MAX = 170_000
REDUCE_POWER_STEP = 500
INCREASE_POWER_STEP = 100
INTEGRAL = -10_000 * ONE


def clamp(value: int, low: int, high: int) -> int:
    return max(low, min(high, value))


def step(freq: int, error: int, integral: int) -> tuple[int, int, int]:
    freeze = (freq >= F_MAX and error < 0) or (freq <= F_MIN and error > 0)
    if not freeze:
        integral = clamp(integral + KI_RAW * error, -I_MAX, I_MAX)
    unsat = clamp(BIAS - (KP_RAW * error + integral), F_MIN * ONE, F_MAX * ONE)
    delta = clamp(unsat - freq * ONE,
                  -INCREASE_POWER_STEP * ONE,
                  REDUCE_POWER_STEP * ONE)
    output_q12 = clamp(freq * ONE + delta, F_MIN * ONE, F_MAX * ONE)
    return output_q12 // ONE, integral, unsat


def main() -> None:
    assert "#define CTRL_REDUCE_POWER_MAX_STEP_HZ   500" in CONTROL
    assert "#define CTRL_INCREASE_POWER_MAX_STEP_HZ 100" in CONTROL
    assert "#if STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD" in CONTROL
    assert "stale = (Uint16)(sample_valid == 0U);" in CONTROL
    assert "g_adc_pwm_sync_consecutive_miss >= (Uint16)CTRL_ADC_STALE_LIMIT" in CONTROL
    assert "This legacy mirror has no firmware reader" in CONTROL
    assert "#define SS_HANDOFF_BRAKE_PERIOD       374U" in SOFT_H
    assert "#define SS_HANDOFF_BRAKE_HZ           160000UL" in SOFT_H
    assert "#define SS_HANDOFF_BRAKE_INTEGRAL_Q12 (-40960000L)" in SOFT_H

    body = SOFT_C.split("Uint16 SoftStart_TransferToClosedLoop(void)", 1)[1]
    final_check = body.index("EPwm1Regs.TBPRD != SS_FINAL_PERIOD")
    brake_apply = body.index("PWM_ApplyPeriodDeadtime(SS_HANDOFF_BRAKE_PERIOD")
    brake_sync = body.index("ADC_UpdatePwmSyncPoint(SS_HANDOFF_BRAKE_PERIOD)")
    closed_sync = body.index("ADC_SetClosedLoopSyncTriggerMode();")
    publish = body.index("g_softstart_handoff_result = HANDOFF_RESULT_OK;")
    assert final_check < brake_apply < brake_sync < closed_sync < publish
    assert "g_softstart_handoff_result = HANDOFF_BRAKE_INVALID;" in body
    assert body.count("LLC_PWM_DisableSafe();") >= 3
    assert "g_control_frequency_hz        = SS_HANDOFF_BRAKE_HZ;" in body
    assert "g_control_shadow_frequency_hz = SS_HANDOFF_BRAKE_HZ;" in body
    assert "g_pi_integral_q12             = SS_HANDOFF_BRAKE_INTEGRAL_Q12;" in body

    # Exact first fresh frame at the observed attempt-1 handoff error (-54):
    # the unchanged +500 Hz power-reduction slew moves 160000 -> 160500.
    high, high_i, _ = step(160_000, -54, INTEGRAL)
    assert high == 160_500
    assert round(60_000_000 / high) - 1 == 373
    # Positive error retains the conservative 100 Hz power-increase step.
    low, low_i, _ = step(160_000, 54, INTEGRAL)
    assert low == 159_900
    assert high_i < INTEGRAL < low_i
    assert F_MIN <= low <= high <= F_MAX

    print("PROFILE_C_FINAL_VALIDATED_BEFORE_BRAKE=TRUE")
    print("BRAKE_BEFORE_ADC_ET3_AND_RUN_PUBLICATION=TRUE")
    print("HANDOFF_STATE_HZ=160000 INTEGRAL_Q12=-40960000")
    print("FIRST_ERROR_MINUS54_HZ=160500 TBPRD=373")
    print("FIRST_ERROR_PLUS54_HZ=159900")
    print("SOL_W2_HANDOFF_BRAKE_TESTS_PASS")


if __name__ == "__main__":
    main()
