#!/usr/bin/env python3
"""Static/model tests for the offline-prepared W5 immutable ladder module."""

from hashlib import sha256
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
HDR = (ROOT / "app" / "w5_reference_transition.h").read_text(encoding="utf-8")
SRC = (ROOT / "app" / "w5_reference_transition.c").read_text(encoding="utf-8")
REAL_BUILD = (ROOT / "tools" / "build_flash_open_loop_steady.bat").read_text(encoding="utf-8")
NE_BUILD = (ROOT / "tools" / "build_open_loop_steady_noenergy.bat").read_text(encoding="utf-8")
V14_REAL_HOST = (ROOT / "tools" / "sol_w4_10v_aba_real.js").read_text(encoding="utf-8")
V14_NE_HOST = (ROOT / "tools" / "sol_w4_trace_noenergy.js").read_text(encoding="utf-8")
MASTER_STATE = (ROOT / "docs" / "SOL_MASTER_EXECUTION_STATE.md").read_text(encoding="utf-8")

EXPECTED_ROWS = (
    (1244, 1207, 1281, 1306),
    (1306, 1267, 1345, 1371),
    (1368, 1327, 1408, 1436),
    (1430, 1387, 1472, 1501),
    (1491, 1447, 1536, 1565),
)
ABSOLUTE = 1640
W4_REAL_SHA = "B4371EC608FDD0759FD3DEE52C125079CF3DE9A6CFE480BEA1181BD5DD588F2B"
W4_NE_SHA = "A90BD9223F96D9D8168CD22EE30D7922A31C0088C9110653F578E222217EFCB8"


def gate(name: str, ok: bool) -> None:
    print(f"{name}={'TRUE' if ok else 'FALSE'}")
    if not ok:
        raise AssertionError(name)


def file_sha(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest().upper()


def abort_reason(index: int, raw: int) -> int:
    if index < 0 or index >= len(EXPECTED_ROWS):
        return 1
    if raw >= ABSOLUTE:
        return 3
    if raw >= EXPECTED_ROWS[index][3]:
        return 2
    return 0


def main() -> None:
    rows = tuple(tuple(map(int, match)) for match in re.findall(
        r"\{(\d+)U,\s*(\d+)U,\s*(\d+)U,\s*(\d+)U\}", SRC))
    gate("W5REF_IMMUTABLE_CONST_TABLE", "const W5REF_Rung g_w5ref_rungs" in SRC)
    gate("W5REF_EXACT_CALIBRATED_ROWS", rows == EXPECTED_ROWS)
    gate("W5REF_EXACT_DURATION_SET", all(token in HDR for token in (
        "W5REF_DURATION_100MS_TICKS    5000UL",
        "W5REF_DURATION_2S_TICKS     100000UL",
    )))
    gate("W5REF_FROZEN_145_TO_170KHZ", all(token in HDR for token in (
        "W5REF_FREQ_MIN_HZ             145000UL",
        "W5REF_FREQ_MAX_HZ             170000UL",
    )))
    gate("W5REF_ABSOLUTE_RAW1640", "W5REF_ABSOLUTE_CEILING_RAW       1640U" in HDR)
    gate("W5REF_NO_POWER_OR_TRIP_WRITES", all(token not in SRC for token in (
        "EPwm", "PWM_", "TZFRC", "TZCLR", "g_pwm", "g_control", "g_fault",
    )))
    gate("W5REF_ABSOLUTE_PRECEDES_STAGE_ABORT",
         SRC.index("vout_raw >= W5REF_ABSOLUTE_CEILING_RAW") <
         SRC.index("vout_raw >= g_w5ref_rungs[rung_index].stage_abort_raw"))
    gate("W5REF_INVALID_INDEX_FAILS_CLOSED", all(token in SRC for token in (
        "rung_index >= W5REF_RUNG_COUNT || result == 0",
        "return W5REF_ABORT_INVALID_RUNG;",
    )))
    def _module_only_in_w5_variant(text: str) -> bool:
        # The frozen W4 images must not link the module.  Every mention of
        # the module in a build script must therefore be either inside a
        # SOL_W5_LADDER_BUILD-gated line or a neutral %W5_SRC%/%W5_OBJ%
        # slot that expands empty for every non-W5 variant.
        for line in text.splitlines():
            if "w5_reference_transition" not in line:
                continue
            s = line.strip()
            if s.startswith('if "%SOL_W5_LADDER_BUILD%"=="1"'):
                continue
            if s in ("%W5_SRC% ^", "%W5_OBJ% ^"):
                continue
            return False
        return True

    gate("W5REF_NOT_LINKED_IN_FROZEN_W4",
         _module_only_in_w5_variant(REAL_BUILD) and
         _module_only_in_w5_variant(NE_BUILD))

    gate("W5REF_MODEL_BELOW_STAGE_CONTINUES",
         all(abort_reason(i, row[3] - 1) == 0 for i, row in enumerate(EXPECTED_ROWS)))
    gate("W5REF_MODEL_STAGE_EQUAL_ABORTS",
         all(abort_reason(i, row[3]) == 2 for i, row in enumerate(EXPECTED_ROWS)))
    gate("W5REF_MODEL_ABSOLUTE_DOMINATES",
         all(abort_reason(i, ABSOLUTE) == 3 for i in range(len(EXPECTED_ROWS))))
    gate("W5REF_MODEL_BAD_RUNG_REJECTED", abort_reason(5, 0) == 1)
    gate("W5REF_ACCEPTANCE_BELOW_ABORT",
         all(low < target < high < abort for target, low, high, abort in EXPECTED_ROWS))
    gate("W5REF_TARGETS_AND_GATES_MONOTONIC",
         all(EXPECTED_ROWS[i][0] < EXPECTED_ROWS[i + 1][0] and
             EXPECTED_ROWS[i][3] < EXPECTED_ROWS[i + 1][3]
             for i in range(len(EXPECTED_ROWS) - 1)))

    real_out = ROOT / "Stage6_OL_STEADY" / "LLC_100W_F28034_OPEN_LOOP_STEADY.out"
    ne_out = ROOT / "Stage6_OL_STEADY_NE" / "LLC_100W_F28034_OPEN_LOOP_STEADY_NE.out"
    # Ignored build artifacts may be deliberately absent after quarantine.
    # Absence is fail-closed; if a canonical artifact reappears it must be the
    # exact historical V14 SHA before any old host can use it.
    gate("W4_REAL_REPLAY_GUARDED",
         (not real_out.exists() or file_sha(real_out) == W4_REAL_SHA) and
         f'EXPECTED_SHA="{W4_REAL_SHA}"' in V14_REAL_HOST and
         f"W4_V14_REAL_OUT_SHA256={W4_REAL_SHA}" in MASTER_STATE)
    gate("W4_NE_REPLAY_GUARDED",
         (not ne_out.exists() or file_sha(ne_out) == W4_NE_SHA) and
         f'EXPECTED_SHA="{W4_NE_SHA}"' in V14_NE_HOST and
         f"W4_V14_NE_OUT_SHA256={W4_NE_SHA}" in MASTER_STATE)
    print("W5_MODULE_LINKED_TO_W4=FALSE")
    print("W5_REAL_POWER_PASS_CLAIMED=FALSE")
    print("SOL_W5_REFERENCE_MODULE_STATIC_MODEL_PASS=TRUE")


if __name__ == "__main__":
    main()
