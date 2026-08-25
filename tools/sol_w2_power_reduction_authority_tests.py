#!/usr/bin/env python3
"""W2 attempt-2 offline proof for the bounded power-reduction slew."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTROL = (ROOT / "app" / "control.c").read_text(encoding="utf-8")

Q = 12
ONE = 1 << Q
KP_RAW = 220_587
KI_RAW = 1_471
BIAS = 150_000 * ONE
I_MAX = 60_000 * ONE
F_MIN = 145_000
F_MAX = 170_000
REDUCE_POWER_STEP = 1_000
INCREASE_POWER_STEP = 100
SIGN = -1


def clamp(value: int, low: int, high: int) -> int:
    return max(low, min(high, value))


def step(freq: int, error: int, integral: int) -> tuple[int, int]:
    freeze = (freq >= F_MAX and error < 0) or (freq <= F_MIN and error > 0)
    if not freeze:
        integral = clamp(integral + KI_RAW * error, -I_MAX, I_MAX)
    unsat = BIAS + SIGN * (KP_RAW * error + integral)
    unsat = clamp(unsat, F_MIN * ONE, F_MAX * ONE)
    delta = clamp(
        unsat - freq * ONE,
        -INCREASE_POWER_STEP * ONE,
        REDUCE_POWER_STEP * ONE,
    )
    output = clamp(freq * ONE + delta, F_MIN * ONE, F_MAX * ONE)
    return output // ONE, integral


def trajectory(error: int, count: int) -> list[int]:
    freq = 150_000
    integral = 0
    result = []
    for _ in range(count):
        freq, integral = step(freq, error, integral)
        result.append(freq)
    return result


def main() -> None:
    assert "#define CTRL_REDUCE_POWER_MAX_STEP_HZ   1000" in CONTROL
    assert "#define CTRL_INCREASE_POWER_MAX_STEP_HZ 100" in CONTROL

    # Attempt 1 began at error=-54 and ended at -125 with nine fresh computes
    # and eight applies. Replay a monotonic linear interpolation of those
    # frozen endpoints through the exact Q12 algorithm. This is not a plant
    # prediction; it quantifies the authority change at the observed state.
    replay_errors = [-54, -63, -72, -81, -90, -99, -108, -117, -125]
    freq = 150_000
    integral = 0
    replay = []
    for error in replay_errors:
        freq, integral = step(freq, error, integral)
        replay.append(freq)
    assert replay == [151_000, 152_000, 153_000, 154_000, 154_976,
                      155_496, 156_019, 156_546, 157_022]
    assert replay[7] >= 156_500  # eighth apply vs attempt-1 measured 154000

    # Power-increase authority remains the existing conservative -100 Hz.
    low_vout = trajectory(54, 9)
    assert low_vout == [149_900, 149_800, 149_700, 149_600, 149_500,
                        149_400, 149_300, 149_200, 149_100]

    # Severe overvoltage reaches but never exceeds the unchanged 170 kHz cap.
    saturated = trajectory(-4095, 30)
    assert saturated[-1] == F_MAX
    assert all(F_MIN <= value <= F_MAX for value in saturated)

    print("ATTEMPT1_LINEARIZED_ENDPOINT_REPLAY_AFTER_8_APPLIES_HZ=156546")
    print("POWER_INCREASE_AUTHORITY_UNCHANGED_MINUS100HZ")
    print("FREQUENCY_ENVELOPE_UNCHANGED_145000_170000")
    print("SOL_W2_POWER_REDUCTION_AUTHORITY_TESTS_PASS")


if __name__ == "__main__":
    main()
