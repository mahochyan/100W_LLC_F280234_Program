#!/usr/bin/env python3
"""Static and executable-model gates for the W4 V15 CR12 -> CR15 return.

This test intentionally does not operate a debugger or touch hardware.  It
binds the isolated V15 build/host protocol to the protected-Burst controller,
proves that PI/PFM remains inactive, and models both a successful lighter-load
step and the autonomous 180 s missed-step terminal path.
"""

from __future__ import annotations

import hashlib
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HDR = (ROOT / "app" / "cal_hold_burst.h").read_text(encoding="utf-8")
SRC = (ROOT / "app" / "cal_hold_burst.c").read_text(encoding="utf-8")
PROTECTION = (ROOT / "app" / "protection.c").read_text(encoding="utf-8")
CONTROL = (ROOT / "app" / "control.c").read_text(encoding="utf-8")
BUILD_REAL = (ROOT / "tools" / "build_flash_open_loop_steady.bat").read_text(
    encoding="utf-8"
)
BUILD_NE = (ROOT / "tools" / "build_open_loop_steady_noenergy.bat").read_text(
    encoding="utf-8"
)
HOST_PATH = ROOT / "tools" / "sol_w4_10v_return_v15_real.js"

V15_OUT = (
    ROOT / "Stage6_W4_RETURN_V15" / "LLC_100W_F28034_OPEN_LOOP_STEADY.out"
)
V15_MAP = (
    ROOT / "Stage6_W4_RETURN_V15" / "LLC_100W_F28034_OPEN_LOOP_STEADY.map"
)
V15_NE_OUT = (
    ROOT / "Stage6_W4_RETURN_V15_NE" / "LLC_100W_F28034_OPEN_LOOP_STEADY_NE.out"
)
V15_NE_MAP = (
    ROOT / "Stage6_W4_RETURN_V15_NE" / "LLC_100W_F28034_OPEN_LOOP_STEADY_NE.map"
)
EXPECTED_V15_NE_SHA = "417B533553572D3652AA88AE2B4D3E6FCC78FFDB72B82A07EC5052DA5D56F226"

RUN_ID = 0x25090602
DIRECTION_LIGHTER = 2
COOKIE_BASE = 0x57440000
LOAD_PROFILE_ID = 0x00000F0C
ALGORITHM_ID = 0x00000017
CONTROL_MODE_ID = 0x42525354
BURST_PROFILE_ID = 0xEFFA6E24
REFERENCE_DEMAND = 22_500
LIGHTER_DEMAND = 15_000
MIN_HOLD_SAMPLES = 12_000  # 60 s / 5 ms
MAX_HOLD_SAMPLES = 36_000  # 180 s / 5 ms
MARKER_SAMPLE = 2_400      # 12 s / 5 ms
POST_MARKER_GUARD = 12     # 60 ms / 5 ms
DETECT_SAMPLES = 12        # three consecutive 20 ms blocks
POST_SAMPLES = 40          # 200 ms persistence window

V14_ARTIFACTS = (
    (
        ROOT / "Stage6_OL_STEADY" / "LLC_100W_F28034_OPEN_LOOP_STEADY.out",
        "B4371EC608FDD0759FD3DEE52C125079CF3DE9A6CFE480BEA1181BD5DD588F2B",
    ),
    (
        ROOT / "Stage6_OL_STEADY" / "LLC_100W_F28034_OPEN_LOOP_STEADY.map",
        "7EC1D057E128D450C5FBFCF3B8F48F14B33DDF9B970FAE137881A22B00A636A9",
    ),
    (
        ROOT / "Stage6_OL_STEADY_NE" / "LLC_100W_F28034_OPEN_LOOP_STEADY_NE.out",
        "A90BD9223F96D9D8168CD22EE30D7922A31C0088C9110653F578E222217EFCB8",
    ),
    (
        ROOT / "Stage6_OL_STEADY_NE" / "LLC_100W_F28034_OPEN_LOOP_STEADY_NE.map",
        "1FEE5E10F885C113A841A9D06425B93AE70A1A2F65EF48D678DE7F379D615F10",
    ),
)
V2_ARTIFACTS = (
    (
        ROOT / "Stage6_W4_SWEEP_V2" / "LLC_100W_F28034_OPEN_LOOP_STEADY.out",
        "D10284938BE15DEA5772DF8595F064E40321B2BF26898CED382DE0ABD2C3A8CD",
    ),
    (
        ROOT / "Stage6_W4_SWEEP_V2" / "LLC_100W_F28034_OPEN_LOOP_STEADY.map",
        "442B64AA26B0801A3D6CF9D24F474159BE56C6683A77DDE9FE6C18BEF4D40562",
    ),
    (
        ROOT / "Stage6_W4_SWEEP_V2_NE" / "LLC_100W_F28034_OPEN_LOOP_STEADY_NE.out",
        "54376784D0143087545CE458E2B8B80455396F2909DE548771E7A24F99375FB6",
    ),
    (
        ROOT / "Stage6_W4_SWEEP_V2_NE" / "LLC_100W_F28034_OPEN_LOOP_STEADY_NE.map",
        "FD284C93CC720174F432D30B960CB67E8E463A20D6D99FD243A18FB648A22140",
    ),
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def gate(name: str, ok: bool) -> None:
    print(f"{name}={'TRUE' if ok else 'FALSE'}")
    if not ok:
        raise AssertionError(name)


def all_absent_or_all_exact(items: tuple[tuple[Path, str], ...]) -> bool:
    exists = tuple(path.exists() for path, _ in items)
    return (not any(exists)) or (
        all(exists) and all(sha256(path) == expected for path, expected in items)
    )


def all_exact(items: tuple[tuple[Path, str], ...]) -> bool:
    return all(path.is_file() and sha256(path) == expected for path, expected in items)


def terminal_cookie(state: int, reason: int) -> int:
    return (
        COOKIE_BASE
        ^ LOAD_PROFILE_ID
        ^ ALGORITHM_ID
        ^ CONTROL_MODE_ID
        ^ BURST_PROFILE_ID
        ^ RUN_ID
        ^ (DIRECTION_LIGHTER << 16)
        ^ ((state & 0xFFFF) << 8)
        ^ (reason & 0xFFFF)
    ) & 0xFFFFFFFF


def lighter_direction(reference: int, candidate: int) -> bool:
    """Mirror the target's inclusive >=12.5% demand reduction gate."""
    return candidate > 0 and candidate * 8 <= reference * 7


def return_model(step_sample: int | None, candidate_demand: int) -> dict[str, int]:
    """Model the target-owned trace/end state at 5 ms granularity.

    A valid step must occur after the target marker, persist through all three
    detect blocks and the 200 ms post window.  Missing/reverse steps do not end
    at 60 s; the target remains autonomous until its 180 s backstop, marks the
    trace incomplete, hard-stops, and commits a terminal capsule.
    """
    valid_step = (
        step_sample is not None
        and step_sample >= MARKER_SAMPLE
        and lighter_direction(REFERENCE_DEMAND, candidate_demand)
    )
    if valid_step:
        detection_end = max(
            step_sample + DETECT_SAMPLES,
            MARKER_SAMPLE + POST_MARKER_GUARD + DETECT_SAMPLES,
        )
        trace_complete = detection_end + POST_SAMPLES
        terminal = max(MIN_HOLD_SAMPLES, trace_complete)
        return {
            "trace_complete": 1,
            "trace_fail": 0,
            "terminal_sample": terminal,
            "pwm": 0,
            "ost": 1,
        }
    return {
        "trace_complete": 0,
        "trace_fail": 3,  # W4_TRACE_FAIL_NO_COMPLETE_WINDOW
        "terminal_sample": MAX_HOLD_SAMPLES,
        "pwm": 0,
        "ost": 1,
    }


def host_has_no_stdin_dependency(text: str) -> bool:
    forbidden = (
        "BufferedReader",
        "InputStreamReader",
        "reader.ready",
        "readLine",
        'System["in"]',
        "ACK_LINE_REQUIRED",
        "ackNonce",
        "HOST_ACK_DEADLINE",
    )
    return all(token not in text for token in forbidden)


def host_isr_gate_is_strict(text: str) -> bool:
    required = (
        'rv32u("g_w4_v15_isr_cycles_max")',
        'rv32u("g_w4_v15_isr_sample_count")',
        'rv32u("g_w4_v15_isr_overrun_count")',
        "isrSamples>0",
        "isrMax>0",
        "isrMax<=900",
        "isrOverruns===0",
    )
    return all(token in text for token in required) and "isrMax<=901" not in text


def main() -> None:
    gate("W4_V15_HOST_EXISTS", HOST_PATH.is_file())
    host = HOST_PATH.read_text(encoding="utf-8")

    gate("W4_V15_COMPILE_GATE_AND_EXCLUSION", all(token in HDR for token in (
        "#define STAGE6_W4_RETURN_V15_TEST 0",
        "STAGE6_W4_RETURN_V15_TEST requires STAGE6_OPEN_LOOP_STEADY_BUILD",
        "W4 return V15 and W4 sweep are mutually exclusive images",
    )))
    gate("W4_V15_ALGORITHM_ISOLATED_FROM_V14", all(token in HDR for token in (
        "#if STAGE6_W4_RETURN_V15_TEST",
        "#define W4_TRACE_ALGORITHM_ID          0x0017UL",
        "#define W4_TRACE_ALGORITHM_ID          0x0014UL",
    )) and HDR.index("0x0017UL") < HDR.index("0x0014UL"))
    gate("W4_V15_EXACT_PROTECTED_BURST_PROFILE", all(token in HDR for token in (
        "W4_V15_CONTROL_MODE_PROTECTED_BURST 0x42525354UL",
        "W4_V15_BURST_PROFILE_ID             0xEFFA6E24UL",
        "W4_V15_BURST_CARRIER_HZ              250000UL",
        "W4_V15_BURST_TBPRD                      239U",
        "W4_V15_BURST_DB_START                   110U",
        "W4_V15_BURST_DB_MIN                      36U",
        "W4_V15_ISR_LIMIT_CYCLES                  900UL",
        "W4_V15_ISR_OVERRUN_CYCLES               1200UL",
        "W3_HOLD_RECHARGE_LOW_RAW         1220U",
        "W3_HOLD_RECHARGE_TARGET_RAW      1260U",
        "W3_HOLD_HARD_LIMIT_RAW           1300U",
        "W3_HOLD_MAX_PACKET_CYCLES        160U",
    )))

    build_real_ok = all(token in BUILD_REAL for token in (
        'if "%SOL_W4_RETURN_V15_BUILD%"=="1" set BUILD=%PROJ%\\Stage6_W4_RETURN_V15',
        'if "%SOL_W4_RETURN_V15_BUILD%"=="1" set EXTRA_DEFINE=-DSTAGE6_W4_RETURN_V15_TEST=1',
        "SOL_W4_RETURN_V15_BUILD and SOL_W4_SWEEP_V2_BUILD are mutually exclusive",
    ))
    build_ne_ok = all(token in BUILD_NE for token in (
        'if "%SOL_W4_RETURN_V15_BUILD%"=="1" set BUILD=%PROJ%\\Stage6_W4_RETURN_V15_NE',
        'if "%SOL_W4_RETURN_V15_BUILD%"=="1" set EXTRA_DEFINE=-DSTAGE6_W4_RETURN_V15_TEST=1',
        "SOL_W4_RETURN_V15_BUILD and SOL_W4_SWEEP_V2_BUILD are mutually exclusive",
    ))
    gate("W4_V15_BUILD_DIRECTORIES_ISOLATED_AND_V2_EXCLUSIVE", build_real_ok and build_ne_ok)
    gate("W4_V15_HISTORICAL_V14_SET_NOT_OVERWRITTEN", all_absent_or_all_exact(V14_ARTIFACTS))
    gate("W4_V15_HISTORICAL_V2_SET_NOT_OVERWRITTEN", all_exact(V2_ARTIFACTS))

    expected_sha_match = re.search(r'EXPECTED_SHA="([0-9A-F]{64})"', host)
    gate("W4_V15_REAL_ARTIFACT_SHA_BOUND", expected_sha_match is not None and
         V15_OUT.is_file() and V15_MAP.is_file() and
         sha256(V15_OUT) == expected_sha_match.group(1) and
         expected_sha_match.group(1) not in {item[1] for item in V14_ARTIFACTS + V2_ARTIFACTS})
    gate("W4_V15_NE_ARTIFACT_ISOLATED", V15_NE_OUT.is_file() and
         V15_NE_MAP.is_file() and sha256(V15_NE_OUT) == EXPECTED_V15_NE_SHA and
         EXPECTED_V15_NE_SHA not in {item[1] for item in V14_ARTIFACTS + V2_ARTIFACTS})
    map_text = V15_MAP.read_text(encoding="utf-8", errors="replace")
    gate("W4_V15_EVIDENCE_SYMBOLS_LINKED", all(
        f"_{name}" in map_text for name in (
            "g_w4_v15_control_mode_id", "g_w4_v15_burst_profile_id",
            "g_w4_v15_pi_update_count_start", "g_w4_v15_pi_update_count_end",
            "g_w4_v15_pi_integral_q12_start", "g_w4_v15_pi_integral_q12_end",
            "g_w4_v15_frequency_apply_count",
            "g_w4_v15_isr_cycles_max", "g_w4_v15_isr_sample_count",
            "g_w4_v15_isr_overrun_count",
        )
    ))

    reset = SRC[SRC.index("static void CALHOLD_W4TraceReset"):
                SRC.index("/* Store one 5 ms sample", SRC.index("static void CALHOLD_W4TraceReset"))]
    gate("W4_V15_TARGET_ACCEPTS_ONLY_LIGHTER", all(token in reset for token in (
        "#if STAGE6_W4_RETURN_V15_TEST",
        "if (requested != W4_TRACE_DIRECTION_LIGHTER)",
        "g_w4_trace_fail_reason = W4_TRACE_FAIL_BAD_DIRECTION;",
        "s_w4_trace_session_direction = requested;",
    )))
    gate("W4_V15_MODE_AND_PI_INACTIVITY_SNAPSHOTS", all(token in reset for token in (
        "g_w4_v15_control_mode_id = W4_V15_CONTROL_MODE_PROTECTED_BURST;",
        "g_w4_v15_burst_profile_id = W4_V15_BURST_PROFILE_ID;",
        "g_w4_v15_pi_update_count_start = g_control_pi_update_count;",
        "g_w4_v15_pi_integral_q12_start = g_pi_integral_q12;",
        "g_w4_v15_frequency_apply_count = 0UL;",
    )))
    gate("W4_V15_OPEN_LOOP_DISPATCH_BYPASSES_PI", all(token in PROTECTION for token in (
        "#elif STAGE6_OPEN_LOOP_STEADY_BUILD",
        "OPENLOOP_FastTask();       /* open-loop steady: PI fully bypassed */",
        "#else\n    CTRL_FastTask();",
    )) and "#if LLC_HARDWARE_PI_VALIDATED" in CONTROL)

    end = SRC[SRC.index("static void CALHOLD_End"):
              SRC.index("/* Record one software-trigger", SRC.index("static void CALHOLD_End"))]
    gate("W4_V15_END_SNAPSHOTS_PRECEDE_BOUND_COOKIE", all(token in end for token in (
        "CALHOLD_HardStop();",
        "g_w4_v15_pi_update_count_end = g_control_pi_update_count;",
        "g_w4_v15_pi_integral_q12_end = g_pi_integral_q12;",
        "W4_V15_CONTROL_MODE_PROTECTED_BURST ^",
        "W4_V15_BURST_PROFILE_ID ^",
        "g_w4_trace_terminal_cookie =",
        "ESTOP0;",
    )) and end.index("CALHOLD_HardStop();") <
        end.index("g_w4_v15_pi_update_count_end") <
        end.index("g_w4_trace_terminal_cookie =") < end.index("ESTOP0;"))

    gate("W4_V15_PASSIVE_WHOLE_ISR_MEASUREMENT", all(token in PROTECTION for token in (
        "Uint32 w4_v15_isr_entry = CpuTimer2Regs.TIM.all;",
        "g_w4_trace_direction_active == W4_TRACE_DIRECTION_LIGHTER",
        "g_cal_hold_state == CAL_HOLD_OFF",
        "g_cal_hold_state == CAL_HOLD_PACKET",
        "Uint32 w4_v15_isr_exit = CpuTimer2Regs.TIM.all;",
        "g_w4_v15_isr_cycles_max = w4_v15_isr_cycles;",
        "g_w4_v15_isr_sample_count++;",
        "w4_v15_isr_cycles >= W4_V15_ISR_OVERRUN_CYCLES",
        "g_w4_v15_isr_overrun_count++;",
    )))

    gate("W4_V15_HOST_FIXED_CR12_TO_CR15", all(token in host for token in (
        "0x25090602", "DIRECTION=2", 'EXPECTED_INITIAL="12"', 'EXPECTED_TARGET="15"',
        'INPUT_LIMIT.equals("0.5")', "CR12_TO_CR15",
    )) and "SOL_W4_DIRECTION" not in host)
    gate("W4_V15_HOST_NO_STDIN_NONCE_ACK_DEPENDENCY", host_has_no_stdin_dependency(host))
    injected_stdin = host + '\nvar reader=new BufferedReader(new InputStreamReader(System["in"]));\nreader.readLine();\n'
    gate("W4_V15_HOST_NO_STDIN_NEGATIVE_MUTATION", not host_has_no_stdin_dependency(injected_stdin))
    gate("W4_V15_HOST_PROTECTED_BURST_PI_INACTIVE_GATES", all(token in host for token in (
        'rv32u("g_w4_v15_control_mode_id")',
        'rv32u("g_w4_v15_burst_profile_id")',
        'rv32u("g_w4_v15_pi_update_count_start")',
        'rv32u("g_w4_v15_pi_update_count_end")',
        'rv32u("g_w4_v15_pi_integral_q12_start")',
        'rv32u("g_w4_v15_pi_integral_q12_end")',
        'rv32u("g_w4_v15_frequency_apply_count")',
        "piEnd===piStart", "integralEnd===integralStart", "frequencyApplyCount===0",
        "PI_PFM_ACTIVE=FALSE", "W4_PI_KP=N/A", "W4_PI_KI=N/A",
        "W4_PI_FREQUENCY_TRAJECTORY=N/A",
    )))
    gate("W4_V15_HOST_ISR_NONZERO_AND_LE_900_GATE", host_isr_gate_is_strict(host))
    relaxed_isr = host.replace("isrMax<=900", "isrMax<=901", 1)
    gate("W4_V15_HOST_ISR_LIMIT_NEGATIVE_MUTATION", relaxed_isr != host and
         not host_isr_gate_is_strict(relaxed_isr))

    post_fire = host[host.index("fired=true;"):host.index('var state=rw("g_cal_hold_state")')]
    gate("W4_V15_HOST_TARGET_OWNS_ACTIVE_WINDOW", all(token not in post_fire for token in (
        "session.memory", "rw(", "rv32u(", "rv32s(", "reg(", ".halt()", ".terminate()",
    )) and post_fire.count("session.target.isHalted()") <= 2 and
        "SET_CR15_NOW_AND_HOLD" in post_fire)
    gate("W4_V15_HOST_BOUNDED_TERMINAL_PROBES", all(token in host for token in (
        "POST_FIRE_STATUS_PROBES_MAX=2", "session.target.isHalted()",
        "70000000000", "205000000000", "HOST_DID_NOT_HALT_UNCONFIRMED_ACTIVE_TARGET=TRUE",
        "NO_RETRY_SAME_SHA_AFTER_FIRE=TRUE",
    )) and "waitForHalt(" not in host)

    duration = SRC[SRC.index("static Uint16 CALHOLD_DurationReached"):
                   SRC.index("/* One shared hard-stop sequence", SRC.index(
                       "static Uint16 CALHOLD_DurationReached"))]
    gate("W4_V15_TARGET_60_TO_180S_AUTONOMOUS_BACKSTOP", all(token in duration for token in (
        "g_cal_hold_elapsed_ticks >= W4_TRACE_MAX_HOLD_TICKS",
        "g_cal_hold_elapsed_ticks < W4_TRACE_MIN_HOLD_TICKS",
        "g_w4_trace_state == W4_TRACE_STATE_COMPLETE",
        "g_w4_trace_state == W4_TRACE_STATE_FAIL",
    )) and "CALHOLD_W4TraceEnd();" in end and
        "W4_TRACE_FAIL_NO_COMPLETE_WINDOW" in SRC)

    success = return_model(MARKER_SAMPLE + 100, LIGHTER_DEMAND)
    missed = return_model(None, REFERENCE_DEMAND)
    reverse = return_model(MARKER_SAMPLE + 100, 30_000)
    gate("W4_V15_MODEL_LIGHTER_STEP_COMPLETES_AT_60S_SAFE", success == {
        "trace_complete": 1, "trace_fail": 0,
        "terminal_sample": MIN_HOLD_SAMPLES, "pwm": 0, "ost": 1,
    })
    gate("W4_V15_MODEL_MISSED_STEP_FAILS_TRACE_AT_180S_SAFE", missed == {
        "trace_complete": 0, "trace_fail": 3,
        "terminal_sample": MAX_HOLD_SAMPLES, "pwm": 0, "ost": 1,
    })
    gate("W4_V15_MODEL_REVERSE_DIRECTION_CANNOT_FALSE_PASS", reverse == missed)
    gate("W4_V15_MODEL_INCLUSIVE_12P5_DIRECTION_BOUNDARY",
         lighter_direction(REFERENCE_DEMAND, 19_687) and
         not lighter_direction(REFERENCE_DEMAND, 19_688))

    cookie = terminal_cookie(4, 1)
    old_algorithm_cookie = cookie ^ ALGORITHM_ID ^ 0x14
    mode_omitted_cookie = cookie ^ CONTROL_MODE_ID
    burst_omitted_cookie = cookie ^ BURST_PROFILE_ID
    gate("W4_V15_MODEL_COOKIE_BINDS_ALGORITHM_MODE_AND_PROFILE",
         len({cookie, old_algorithm_cookie, mode_omitted_cookie,
              burst_omitted_cookie}) == 4)

    print("SOL_W4_RETURN_V15_STATIC_MODEL_PASS=TRUE")


if __name__ == "__main__":
    main()
