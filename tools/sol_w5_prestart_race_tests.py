#!/usr/bin/env python3
"""Static/model gates for the W5 attempt-5 pre-start sampling race fix."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COMP = (ROOT / "app" / "comparator.c").read_text(encoding="utf-8")
HOLD = (ROOT / "app" / "cal_hold_burst.c").read_text(encoding="utf-8")
PWM = (ROOT / "driver" / "pwm.c").read_text(encoding="utf-8")


def gate(name: str, ok: bool) -> None:
    print(f"{name}={'TRUE' if ok else 'FALSE'}")
    if not ok:
        raise AssertionError(name)


def arm_model(first_gpio15: int, second_gpio15: int) -> bool:
    """The arm token exists only after two consecutive safe observations."""
    return first_gpio15 != 0 and second_gpio15 != 0


def main() -> None:
    arm = COMP[COMP.index("static Uint16 COMP_ArmCommon"):
               COMP.index("void COMP_ArmForPowerStart")]
    packet_call = HOLD.index("COMP_ArmForSingleCycleStart(LLC_SINGLE_CYCLE_PROBE_DAC)")
    packet = HOLD[packet_call:
                  HOLD.index("s_w3_packet_write_auth = 1U", packet_call)]
    start = PWM[PWM.index("void PWM_StartDeterministic"):
                PWM.index("#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST")]

    gate("W5_PRESTART_TWO_BOUNDED_SETTLE_INTERVALS",
         arm.count("DELAY_US(2L);") >= 2)
    gate("W5_PRESTART_FIRST_AND_SECOND_BOTH_REQUIRED",
         "first_gpio15 = g_comp_prestart_gpio15;" in arm and
         "first_gpio15 == 0U || g_comp_prestart_gpio15 == 0U" in arm)
    gate("W5_PRESTART_MODEL_ONLY_HIGH_HIGH_ARMS",
         arm_model(1, 1) and not arm_model(1, 0) and
         not arm_model(0, 1) and not arm_model(0, 0))
    gate("W5_PACKET_CONSUMES_HELPER_SNAPSHOT_ONLY",
         "g_comp_prestart_reject != 0U" in packet and
         "g_comp_inject_test_armed == 0U" in packet and
         "g_comp_prestart_gpio15 == 0U" in packet and
         "GpioDataRegs.GPADAT.bit.GPIO15" not in packet)
    gate("W5_HELPER_NEVER_CLEARS_OST",
         "EPwm1Regs.TZCLR.bit.OST" not in arm)
    gate("W5_HARDWARE_TZ_OWNS_RELEASE",
         "EPwm1Regs.TZCLR.bit.OST = 1U" in start and
         "EPwm1Regs.TZEINT.bit.OST = 1U" in start)
    print("SOL_W5_PRESTART_RACE_STATIC_MODEL_PASS=TRUE")


if __name__ == "__main__":
    main()
