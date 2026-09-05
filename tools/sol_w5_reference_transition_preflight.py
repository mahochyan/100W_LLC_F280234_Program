#!/usr/bin/env python3
"""Offline design gates for the W5 10 V -> 12 V reference ladder.

This preflight deliberately does not claim the W5 real-power PASS token.  It
checks the measured ADC conversion, the proposed immutable ladder/ceilings,
the known protection migration points, and that the frozen W4 image remains
byte-for-byte unchanged while W5 is being designed.
"""

from hashlib import sha256
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
CAL = (ROOT / "app" / "board_calibration.h").read_text(encoding="utf-8")
SHOT = (ROOT / "app" / "shot.c").read_text(encoding="utf-8")
CFG = (ROOT / "llc_config.h").read_text(encoding="utf-8")
COMP = (ROOT / "app" / "comparator.c").read_text(encoding="utf-8")

RUNG_VOLTS = (10.0, 10.5, 11.0, 11.5, 12.0)
EXPECTED_TARGET_RAW = (1244, 1306, 1368, 1430, 1491)
EXPECTED_STAGE_GATE_RAW = (1306, 1371, 1436, 1501, 1565)  # Vref +5%
EXPECTED_ABSOLUTE_GATE_RAW = 1640  # 12 V +10%

W4_ARTIFACTS = {
    "Stage6_OL_STEADY/LLC_100W_F28034_OPEN_LOOP_STEADY.out":
        "B4371EC608FDD0759FD3DEE52C125079CF3DE9A6CFE480BEA1181BD5DD588F2B",
    "Stage6_OL_STEADY/LLC_100W_F28034_OPEN_LOOP_STEADY.map":
        "7EC1D057E128D450C5FBFCF3B8F48F14B33DDF9B970FAE137881A22B00A636A9",
    "Stage6_OL_STEADY_NE/LLC_100W_F28034_OPEN_LOOP_STEADY_NE.out":
        "A90BD9223F96D9D8168CD22EE30D7922A31C0088C9110653F578E222217EFCB8",
    "Stage6_OL_STEADY_NE/LLC_100W_F28034_OPEN_LOOP_STEADY_NE.map":
        "1FEE5E10F885C113A841A9D06425B93AE70A1A2F65EF48D678DE7F379D615F10",
}


def gate(name: str, ok: bool) -> None:
    print(f"{name}={'TRUE' if ok else 'FALSE'}")
    if not ok:
        raise AssertionError(name)


def macro_float(name: str) -> float:
    match = re.search(rf"^#define\s+{name}\s+\(?(-?[0-9.]+)f?\)?", CAL, re.M)
    if match is None:
        raise AssertionError(f"missing {name}")
    return float(match.group(1))


def c_round_raw(volts: float, gain: float, offset: float) -> int:
    """Match CTRL_VoltsToRaw(): positive value plus 0.5 then Uint16 cast."""
    return int(((volts - offset) / gain) + 0.5)


def file_sha(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest().upper()


def main() -> None:
    gain = macro_float("BOARD_VOUT_GAIN_V_PER_RAW")
    offset = macro_float("BOARD_VOUT_OFFSET_V")
    targets = tuple(c_round_raw(v, gain, offset) for v in RUNG_VOLTS)
    error_high = tuple(c_round_raw(v * 1.03, gain, offset) for v in RUNG_VOLTS)
    stage_gates = tuple(c_round_raw(v * 1.05, gain, offset) for v in RUNG_VOLTS)
    max_gates = tuple(c_round_raw(v * 1.10, gain, offset) for v in RUNG_VOLTS)

    gate("W5_CAL_GAIN_MATCH", abs(gain - 0.008089325) < 1e-12)
    gate("W5_CAL_OFFSET_MATCH", abs(offset - (-0.063715)) < 1e-12)
    gate("W5_TARGET_RAW_MATCH", targets == EXPECTED_TARGET_RAW)
    gate("W5_STAGE_GATE_RAW_MATCH", stage_gates == EXPECTED_STAGE_GATE_RAW)
    gate("W5_ABSOLUTE_GATE_RAW_MATCH", max_gates[-1] == EXPECTED_ABSOLUTE_GATE_RAW)
    gate("W5_TARGETS_MONOTONIC", all(a < b for a, b in zip(targets, targets[1:])))
    gate("W5_STAGE_GATES_ABOVE_3PCT", all(e < s for e, s in zip(error_high, stage_gates)))
    gate("W5_STAGE_GATES_WITHIN_10PCT", all(s <= m for s, m in zip(stage_gates, max_gates)))
    gate("W5_ABSOLUTE_GATE_ABOVE_ALL_STAGE_GATES",
         all(s < EXPECTED_ABSOLUTE_GATE_RAW for s in stage_gates))

    # These are intentional migration findings in the frozen W4 source, not
    # desired W5 behavior.  They must disappear/be superseded in the W5 build.
    gate("W5_PREFLIGHT_FINDS_FIXED_11V_SHOT_GUARD", all(token in SHOT for token in (
        "(11.0f - BOARD_VOUT_OFFSET_V) / BOARD_VOUT_GAIN_V_PER_RAW",
        "g_first_real_pi_shot_abort_vout_raw",
    )))
    gate("W5_PREFLIGHT_FINDS_GENERIC_RAW_LIMITS_DISABLED", all(token in CFG for token in (
        "#define LLC_OVP_RAW_THRESHOLD           0xFFFFU",
        "#define LLC_OCP_RAW_THRESHOLD           0xFFFFU",
        "#define LLC_UVP_RAW_THRESHOLD           0xFFFFU",
    )))
    gate("W5_PREFLIGHT_COMP_IS_PRIMARY_CURRENT_NOT_VOUT",
         "primary-current protection" in COMP and "COMP1OUT(GPIO42)" in COMP)

    for rel, expected in W4_ARTIFACTS.items():
        gate("W4_FROZEN_SHA_" + Path(rel).suffix[1:].upper() + "_" +
             ("NE" if "_NE/" in rel else "REAL"),
             file_sha(ROOT / rel) == expected)

    print("VREF_V,TARGET_RAW,ERROR_HIGH_3PCT_RAW,STAGE_ABORT_5PCT_RAW,MAX_10PCT_RAW")
    for row in zip(RUNG_VOLTS, targets, error_high, stage_gates, max_gates):
        print(f"{row[0]:.1f},{row[1]},{row[2]},{row[3]},{row[4]}")
    print("W5_KNOWN_MIGRATION_REQUIRED=FIXED_11V_GUARD__GENERIC_RAW_LIMITS_DISABLED")
    print("W5_REAL_POWER_PASS_CLAIMED=FALSE")
    print("SOL_W5_REFERENCE_TRANSITION_PREFLIGHT_PASS=TRUE")


if __name__ == "__main__":
    main()
