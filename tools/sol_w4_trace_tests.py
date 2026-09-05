#!/usr/bin/env python3
"""Static and executable model gates for the W4 5 ms A/B/A observer."""

import hashlib
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = (ROOT / "app" / "cal_hold_burst.c").read_text(encoding="utf-8")
HDR = (ROOT / "app" / "cal_hold_burst.h").read_text(encoding="utf-8")
REAL = (ROOT / "tools" / "sol_w4_10v_aba_real.js").read_text(encoding="utf-8")
NE = (ROOT / "tools" / "sol_w4_trace_noenergy.js").read_text(encoding="utf-8")
LINK_NE = (ROOT / "tools" / "sol_w4_v14_link_idle_noenergy.js").read_text(encoding="utf-8")
REAL_OUT = (ROOT / "Stage6_OL_STEADY" /
            "LLC_100W_F28034_OPEN_LOOP_STEADY.out")
REAL_MAP = (ROOT / "Stage6_OL_STEADY" /
            "LLC_100W_F28034_OPEN_LOOP_STEADY.map")
NE_OUT = (ROOT / "Stage6_OL_STEADY_NE" /
           "LLC_100W_F28034_OPEN_LOOP_STEADY_NE.out")
NE_MAP = (ROOT / "Stage6_OL_STEADY_NE" /
          "LLC_100W_F28034_OPEN_LOOP_STEADY_NE.map")

RING = 128
BASELINE = 40
BLOCK = 4
POST = 40
EVAL = 52
FREEZE_SAMPLE = 2_000   # 10 s at 5 ms/sample
DETECT_SAMPLE = 2_400   # nominal 12 s physical marker


def gate(name: str, ok: bool) -> None:
    print(f"{name}={'TRUE' if ok else 'FALSE'}")
    if not ok:
        raise AssertionError(name)


def window_demand(samples: list[tuple[int, int, int]]) -> int | None:
    cycles = sum(item[1] for item in samples)
    packets = sum(item[2] for item in samples)
    if cycles == 0 or packets == 0:
        return None
    return ((cycles // len(samples)) * (cycles // packets)) >> 1


def direction_changed(direction: int, reference: int,
                      first: int, second: int, third: int) -> bool:
    if direction == 1:
        return (first * 8 >= reference * 9 and
                second * 8 >= reference * 9 and
                third * 8 >= reference * 9)
    return (first * 8 <= reference * 7 and
            second * 8 <= reference * 7 and
            third * 8 <= reference * 7)


def quality_metrics(values: list[int]) -> dict[str, int]:
    """Exact firmware peak and 4-sample moving-average settling model."""
    if len(values) != EVAL:
        raise ValueError("quality window must contain exactly 52 samples")
    last_out = None
    for i in range(BLOCK - 1, EVAL):
        avg = sum(values[i - (BLOCK - 1):i + 1]) // BLOCK
        if avg < 1215 or avg > 1265:
            last_out = i
    settle = 0 if last_out is None else (last_out + 1) * 5
    peak = min(values) >= 1182 and max(values) <= 1306
    return {"min": min(values), "max": max(values), "settle": settle,
            "quality": int(peak and settle <= 100)}


def frozen_model(direction: int, samples: list[tuple[int, int, int]],
                 freeze_sample: int = FREEZE_SAMPLE,
                 detect_sample: int = DETECT_SAMPLE) -> dict[str, int]:
    """Model a warmed/frozen R40 plus sliding B1_4+B2_4+B3_4/post40."""
    if freeze_sample < BASELINE or freeze_sample > len(samples):
        return {"complete": 0}
    reference = samples[freeze_sample - BASELINE:freeze_sample]
    reference_demand = window_demand(reference)
    if reference_demand is None:
        return {"complete": 0}
    trigger = None
    confirm = None
    trigger_demand = 0
    # The marker sample is stored before the yellow LED is asserted.  Require
    # twelve entirely new 5 ms samples after that marker before evaluating.
    first_confirm_sample = detect_sample + 3 * BLOCK
    for i in range(max(3 * BLOCK - 1, first_confirm_sample), len(samples)):
        first = samples[i - 11:i - 7]
        second = samples[i - 7:i - 3]
        third = samples[i - 3:i + 1]
        d1 = window_demand(first)
        d2 = window_demand(second)
        d3 = window_demand(third)
        if d1 is None or d2 is None or d3 is None:
            continue
        if direction_changed(direction, reference_demand, d1, d2, d3):
            trigger = i - 11
            confirm = i
            trigger_demand = d3
            break

    if trigger is None or trigger + EVAL > len(samples):
        return {"complete": 0}

    values = [item[0] for item in samples[trigger:trigger + EVAL]]
    quality = quality_metrics(values)
    post_demand = window_demand(samples[trigger + 3 * BLOCK:
                                        trigger + EVAL])
    post_persists = (post_demand is not None and
                     ((post_demand * 8 >= reference_demand * 9)
                      if direction == 1 else
                      (post_demand * 8 <= reference_demand * 7)))
    return {
        "complete": 1,
        "min": quality["min"],
        "max": quality["max"],
        "settle": quality["settle"],
        "quality": quality["quality"],
        "trigger": trigger,
        "confirm": int(confirm),
        "baseline_demand": reference_demand,
        "trigger_demand": trigger_demand,
        "post_demand": int(post_demand or 0),
        "post_persists": int(post_persists),
    }


def make_step_stream(direction: int, transient_raw: int,
                     step_sample: int = 14_000) -> list[tuple[int, int, int]]:
    """V13-like startup seed, settled A until 70 s, then the real step."""
    result: list[tuple[int, int, int]] = []
    if direction == 1:  # CR15 -> CR12
        baseline = (300, 3)
        stepped = (300, 2)
    else:               # CR12 -> CR15
        baseline = (300, 2)
        stepped = (300, 3)
    for i in range(step_sample + EVAL + 8):
        if i < 40:
            cycles, packets = (80, 1)  # deliberately stale startup seed
        elif i < step_sample:
            cycles, packets = baseline
        else:
            cycles, packets = stepped
        raw = transient_raw if step_sample <= i < step_sample + 4 else 1240
        result.append((raw, cycles, packets))
    return result


def main() -> None:
    gate("W4_TRACE_RING_POWER_OF_TWO", RING & (RING - 1) == 0)
    gate("W4_TRACE_STATIC_CONSTANTS", all(token in HDR for token in (
        "W4_TRACE_SAMPLES                  128U",
        "W4_TRACE_BASELINE_SAMPLES         40U",
        "W4_TRACE_DETECT_BLOCK_SAMPLES     4U",
        "W4_TRACE_DETECT_STREAK_BLOCKS     3U",
        "W4_TRACE_POST_SAMPLES             40U",
        "W4_TRACE_EVAL_SAMPLES             52U",
        "W4_TRACE_REFERENCE_FREEZE_TICKS   500000UL",
        "W4_TRACE_DETECT_START_TICKS       600000UL",
        "W4_TRACE_POST_MARKER_GUARD_TICKS    3000UL",
        "W4_TRACE_MIN_HOLD_TICKS           3000000UL",
        "W4_TRACE_MAX_HOLD_TICKS           9000000UL",
        "W4_TRACE_MAX_TOTAL_PACKET_CYCLES 22500000UL",
        "W4_TRACE_STATS_MAX_ACCUM_SAMPLES  3000000UL",
        "W4_TRACE_FAIL_BAD_SESSION            4U",
        "W4_TRACE_5PCT_LOW_RAW              1182U",
        "W4_TRACE_2PCT_LOW_RAW              1215U",
        "W4_TRACE_SETTLE_LIMIT_MS            100U",
        "W4_TRACE_TERMINAL_COOKIE_BASE 0x57440000UL",
        "W4_TRACE_LOAD_LIGHT_OHM_X10       150U",
        "W4_TRACE_LOAD_HEAVY_OHM_X10       120U",
        "W4_TRACE_LOAD_PROFILE_ID       0x0F0CUL",
        "W4_TRACE_ALGORITHM_ID          0x0014UL",
    )))
    gate("W4_TRACE_THREE_FIELD_RING", all(token in SRC for token in (
        "g_w4_trace_ring_raw[W4_TRACE_SAMPLES]",
        "g_w4_trace_ring_cycle_delta[W4_TRACE_SAMPLES]",
        "g_w4_trace_ring_packet_delta[W4_TRACE_SAMPLES]",
    )))
    gate("W4_TRACE_ONE_SHOT_ARM", "g_w4_trace_arm = 0U;  /* one-shot consume" in SRC)
    reset = SRC[SRC.index("static void CALHOLD_W4TraceReset"):
                SRC.index("static Uint16 CALHOLD_W4TraceStore")]
    gate("W4_TRACE_PRIVATE_EXACT_SESSION_LATCH", all(token in reset for token in (
        "arm != W4_TRACE_ARM_REQUEST",
        "requested_mode != CAL_HOLD_MODE_W3_10V",
        "requested_duration != W3_HOLD_DURATION_60S",
        "W4_TRACE_FAIL_BAD_SESSION",
        "s_w4_trace_session_direction = requested;",
    )) and "static Uint16 s_w4_trace_session_direction" in SRC and
         "extern" not in SRC[SRC.index("s_w4_trace_session_direction") - 20:
                             SRC.index("s_w4_trace_session_direction")])
    gate("W4_TRACE_COOKIE_CLEARS_ONLY_ON_NEW_ARM", all(token in reset for token in (
        "if (arm != 0U) g_w4_trace_terminal_cookie = 0UL;",
        "s_w4_trace_session_direction = 0U;",
    )) and reset.index("g_w4_trace_terminal_cookie = 0UL;") <
         reset.index("s_w4_trace_session_direction = 0U;") and
         "g_w4_trace_terminal_cookie = 0UL;\n    CALHOLD_W4TraceReset" in SRC)
    gate("W4_TRACE_WARMED_FROZEN_REFERENCE_GATE",
         "W4_TRACE_BASELINE_START_TICKS      25000UL" in HDR and
         "W4_TRACE_REFERENCE_FREEZE_TICKS   500000UL" in HDR and
         "W4_TRACE_DETECT_START_TICKS       600000UL" in HDR and
         "W4_TRACE_BASELINE_SAMPLES         40U" in HDR and
         "W4_TRACE_SAMPLE_MS                 5U" in HDR and
         EVAL == 3 * BLOCK + POST)
    duration = SRC[SRC.index("static Uint16 CALHOLD_DurationReached"):
                   SRC.index("static void CALHOLD_HardStop")]
    cycle_cap = SRC[SRC.index("static Uint32 CALHOLD_CycleCap"):
                    SRC.index("static Uint16 CALHOLD_ReadOffRaw")]
    gate("W4_TRACE_OPERATOR_WINDOW_BOUNDED", all(token in duration for token in (
        "g_cal_hold_elapsed_ticks >= W4_TRACE_MAX_HOLD_TICKS",
        "g_cal_hold_elapsed_ticks < W4_TRACE_MIN_HOLD_TICKS",
    )) and "CALHOLD_DurationReached(limit)" in SRC and
         "g_w4_trace_direction_active" not in duration)
    gate("W4_TRACE_DYNAMIC_50PCT_CYCLE_CAP", all(token in cycle_cap for token in (
        "s_w4_trace_session_direction != 0U",
        "trace_ticks = W4_TRACE_MIN_HOLD_TICKS",
        "trace_ticks = W4_TRACE_MAX_HOLD_TICKS",
        "return (trace_ticks * 5UL) / 2UL;",
    )) and "g_w4_trace_direction_active" not in cycle_cap)
    gate("W4_TRACE_FROZEN_R40_B1_B2_B3_DIRECTIONAL_PERSISTENCE",
         all(token in SRC for token in (
             "g_cal_hold_elapsed_ticks < W4_TRACE_REFERENCE_FREEZE_TICKS",
             "g_cal_hold_elapsed_ticks < W4_TRACE_DETECT_START_TICKS",
             "B1=[i-11..i-8], B2=[i-7..i-4]",
             "B3=[i-3..i]",
             "b1_demand_index * 8UL",
             "b2_demand_index * 8UL",
             "b3_demand_index * 8UL",
             "g_w4_trace_baseline_demand_index * 9UL",
             "g_w4_trace_baseline_demand_index * 7UL",
             "g_w4_trace_trigger_confirm_tick = g_cal_hold_elapsed_ticks;",
         )) and all(token not in SRC for token in (
             "s_w4_trace_detect_streak", "s_w4_trace_candidate_index",
             "s_w4_trace_block_cycle_sum", "s_w4_trace_block_packet_sum",
         )))
    sample = SRC[SRC.index("static void CALHOLD_W4TraceSample"):
                 SRC.index("static void CALHOLD_W4TraceEnd")]
    gate("W4_TRACE_TARGET_YELLOW_MARKER_PRECEDES_TRIGGER", all(token in sample for token in (
        "if (g_cal_hold_elapsed_ticks < W4_TRACE_DETECT_START_TICKS) return;",
        "if (g_w4_trace_operator_marker_tick == 0UL)",
        "g_w4_trace_operator_marker_tick = g_cal_hold_elapsed_ticks;",
        "GpioDataRegs.GPASET.bit.GPIO21 = 1U;",
        "return; /* the marker sample itself is never a candidate sample */",
        "W4_TRACE_POST_MARKER_GUARD_TICKS",
        "g_w4_trace_trigger_confirm_tick = g_cal_hold_elapsed_ticks;",
    )) and sample.index("g_w4_trace_operator_marker_tick = g_cal_hold_elapsed_ticks;") <
         sample.index("W4_TRACE_POST_MARKER_GUARD_TICKS") <
         sample.index("g_w4_trace_trigger_confirm_tick = g_cal_hold_elapsed_ticks;"))
    helper = SRC[SRC.index("static void CALHOLD_W4TraceReset"):
                 SRC.index("static Uint16 CALHOLD_DurationReached")]
    gate("W4_TRACE_OBSERVER_HAS_NO_POWER_WRITE", all(token not in helper for token in (
        "PWM_", "EPwm1Regs", "TZCLR", "TZFRC", "g_pwm_enable_request",
    )))
    gate("W4_TRACE_SLOW_TASK_ONLY", SRC.count("CALHOLD_W4TraceSample();") == 1 and
         SRC.index("CALHOLD_W4TraceSample();") > SRC.index("void CALHOLD_SlowTask"))
    gate("W4_TRACE_USES_FRESH_OFF_SAMPLE", "raw = g_cal_hold_raw;" in helper)
    gate("W4_TRACE_TERMINAL_INCOMPLETE_FAILS", all(token in SRC for token in (
        "CALHOLD_W4TraceEnd();",
        "W4_TRACE_FAIL_NO_COMPLETE_WINDOW",
    )))
    record_start = SRC.index("static void CALHOLD_RecordRaw")
    record = SRC[record_start:
                 SRC.index("static void CALHOLD_StatsPublish", record_start)]
    max_sum = (3_000_000 - 1) * 1299 + 65535
    gate("W4_TRACE_UINT32_SUM_BOUND", max_sum == 3_897_064_236 and
         max_sum < 0xFFFFFFFF)
    gate("W4_TRACE_SUMS_SHARE_PRIVATE_SAMPLE_CAP", all(token in record for token in (
        "s_stats.samples < W4_TRACE_STATS_MAX_ACCUM_SAMPLES",
        "if (accumulate != 0U)",
        "s_stats.sum += raw;",
        "s_stats.steady_sum += raw;",
        "g_cal_hold_cal_raw_sum += raw;",
    )) and record.index("if (raw < s_stats.min)") <
         record.index("if (accumulate != 0U)"))
    end = SRC[SRC.index("static void CALHOLD_End"):
              SRC.index("static void CALHOLD_RecordRaw")]
    gate("W4_REAL_TERMINAL_COOKIE_AND_SPIN_AFTER_FROZEN_SAFE_STATE", all(token in end for token in (
        "CALHOLD_HardStop();",
        "g_cal_hold_packet_active = 0U;",
        "CALHOLD_StatsPublish();",
        "CALHOLD_FreezeFinal();",
        "s_w4_trace_session_direction = 0U",
        "g_w4_trace_terminal_cookie =",
        "W4_TRACE_TERMINAL_COOKIE_BASE",
        "W4_TRACE_LOAD_PROFILE_ID",
        "W4_TRACE_ALGORITHM_ID",
        "DINT;",
        "ESTOP0;",
        "for (;;) { }",
    )) and end.index("CALHOLD_HardStop();") < end.index("CALHOLD_FreezeFinal();") <
         end.index("s_w4_trace_session_direction = 0U") <
         end.index("g_w4_trace_terminal_cookie =") < end.index("DINT;") <
         end.index("ESTOP0;") < end.index("for (;;) { }") and
         "#if STAGE6_OPEN_LOOP_STEADY_BUILD && !STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST" in end)
    fast_task = SRC.index("void CALHOLD_FastTask")
    off_start = SRC.index("case CAL_HOLD_OFF:", fast_task)
    off = SRC[off_start:SRC.index("case CAL_HOLD_PACKET:", off_start)]
    gate("W4_OFF_TERMINAL_PRECEDES_RECHARGE", all(token in off for token in (
        "s_w4_trace_session_direction != 0U",
        "CALHOLD_DurationReached(limit)",
        "CALHOLD_End(CAL_HOLD_COMPLETE, CAL_HOLD_REASON_COMPLETE);",
        "ADC_SoftwareTrigger();",
    )) and off.index("g_cal_hold_elapsed_ticks++;") <
         off.index("CALHOLD_DurationReached(limit)") < off.index("ADC_SoftwareTrigger();"))

    fire_start = REAL.index("session.target.runAsynch();",
                            REAL.index('wv("g_cal_hold_request",1);'))
    fire_end = REAL.index('terminalHaltObserved=probeTerminalHalt(', fire_start)
    fire = REAL[fire_start:fire_end]
    gate("W4_REAL_FTDI_SILENT_TO_FIRST_BOUNDED_PROBE",
         all(token not in fire for token in (
             "rw(", "rv32u(", "reg(", "session.memory", ".halt()",
             ".isHalted()", ".terminate()", ".connect()",
         )) and fire.count("session.target.runAsynch();") == 1)
    probe = REAL[REAL.index("function probeTerminalHalt"):
                 REAL.index("function forceSafe")]
    gate("W4_REAL_BOUNDED_STATUS_ONLY", all(token in REAL for token in (
        "session.setScriptTimeout(5000);",
        "var POST_FIRE_STATUS_PROBES_MAX=2;",
        "terminalProbeCount>=POST_FIRE_STATUS_PROBES_MAX",
        "session.target.isHalted();",
        "FTDI_STATUS_ERROR__NO_MORE_DSS_CALLS=TRUE",
    )) and probe.count("session.target.isHalted();") == 1 and
         all(token not in probe for token in (
             "session.memory", ".halt()", ".run", ".terminate()",
         )))
    pre_read = REAL[fire_start:REAL.index("var state=rw(", fire_start)]
    gate("W4_REAL_NO_READ_OR_ACTIVE_HALT_BEFORE_CONFIRMED_HALT",
         all(token not in pre_read for token in (
             "session.memory", "rw(", "rv32u(", "reg(", ".halt()",
             ".terminate()", ".connect()",
         )) and "FIRMWARE_TERMINAL_HALT_OBSERVED=TRUE" in pre_read)
    sha_match = re.search(r'EXPECTED_SHA="([0-9A-F]{64})"', REAL)
    actual_sha = (hashlib.sha256(REAL_OUT.read_bytes()).hexdigest().upper()
                  if REAL_OUT.exists() else "")
    gate("W4_REAL_SHA_AND_PHYSICAL_GATES", sha_match is not None and
         sha_match.group(1) == actual_sha and all(token in REAL for token in (
        'SOL_W4_INPUT_LIMIT_A', 'SOL_W4_INITIAL_LOAD_OHMS',
        'PREFIRE_TARGET_CLOCK_200MS', 'W4_WAIT_FOR_YELLOW_LED_THEN_STEP=',
        'WHEN_YELLOW_LED_TURNS_ON_SET_ELOAD_OHMS=',
        'java.lang.System.nanoTime()', 'ACK_LINE_REQUIRED=',
        'LOAD_PROFILE_OHMS=15<->12 PROFILE_ID=0x0F0C ALGORITHM_ID=0x0014',
        'java.lang.Long.toHexString', 'line.equals(ackNonce)',
        'var HOST_QUIET_MIN_NS=70000000000',
        'var HOST_QUIET_MAX_NS=205000000000',
        'var HOST_PROMPT_DELAY_NS=8000000000',
        'var TARGET_OPERATOR_MARKER_TICKS=600000',
        'var HOST_ACK_DEADLINE_NS=160000000000',
        'reader.ready()',
        'W4_STEP_ACK_HOST_DEADLINE_160S_EXPIRED=TRUE',
        'FIRMWARE_TERMINAL_HALT_OBSERVED=TRUE',
        'if(!fired || terminalHaltObserved)',
        'forceSafe(!fired)',
        'HOST_DID_NOT_HALT_UNCONFIRMED_ACTIVE_TARGET=TRUE',
        'NO_RETRY_SAME_SHA_AFTER_FIRE=TRUE',
    )) and "readLine(" in REAL and "currentTimeMillis" not in REAL and
         "waitForHalt(" not in REAL and "setScriptTimeout(-1)" not in REAL)
    real_map = REAL_MAP.read_text(encoding="utf-8", errors="replace")
    ne_map = NE_MAP.read_text(encoding="utf-8", errors="replace")
    gate("W4_V14_MAP_MEMORY_AND_TARGET_MARKER_SYMBOL", all(token in real_map for token in (
        "RAML2                 00008c00   00000400  000003a4  0000005c",
        "RAML3                 00009000   00001000  0000027e  00000d82",
        "_g_w4_trace_operator_marker_tick",
    )) and all(token in ne_map for token in (
        "RAML2                 00008c00   00000400  000003ff  00000001",
        "RAML3                 00009000   00001000  000002c3  00000d3d",
        "_g_w4_trace_operator_marker_tick",
    )))
    gate("W4_V14_EXACT_15_12_HOST_DIRECTIONS", all(token in REAL for token in (
        'DIRECTION=1;RUN_ID=0x2509059A;EXPECTED_INITIAL="15";EXPECTED_TARGET="12";',
        'STEP_TEXT="CR15_TO_CR12";',
        'DIRECTION=2;RUN_ID=0x2509059B;EXPECTED_INITIAL="12";EXPECTED_TARGET="15";',
        'STEP_TEXT="CR12_TO_CR15";',
    )))
    gate("W4_V14_REAL_AND_NE_COOKIE_PROFILE_ALGORITHM_BOUND",
         all(token in REAL for token in (
             "0x57440000 ^ 0x00000F0C ^ 0x00000014 ^ runId",
             "cookie===expectedCookie",
         )) and all(token in NE for token in (
             "0x57440000 ^ 0x00000F0C ^ 0x00000014 ^ runId",
             "expectedTerminalCookie(currentW4RunId,direction,state,reason)",
         )))
    gate("W4_REAL_ACK_AND_TRIGGER_ARE_HARD_GATES", all(token in REAL for token in (
        'check("W4_PHYSICAL_STEP_ACK_CHAIN",stepAcknowledged',
        'promptNs>=fireNs+HOST_PROMPT_DELAY_NS',
        'check("W4_TARGET_OPERATOR_MARKER_COMMITTED",traceComplete',
        'operatorMarkerTick>=TARGET_OPERATOR_MARKER_TICKS',
        'check("W4_TRIGGER_AT_OR_AFTER_TARGET_MARKER",traceComplete',
        'triggerConfirmTick>=operatorMarkerTick+3000',
        'traceState===5 && traceFail===0',
        'triggerDemand>0 && triggerConfirmTick>0',
        'TRACE_NOT_COMPLETE__ROWS_ARE_LATEST_RING_NOT_TRIGGER_RELATIVE=TRUE',
        'check("W4_DEMAND_DIRECTION",traceComplete &&',
        'b1.demand*8>=baselineDemand*9',
        'b2.demand*8>=baselineDemand*9',
        'b3.demand*8>=baselineDemand*9',
        'W4_TRIGGER_BLOCK_TELEMETRY_MATCH',
        'W4_POST_STEP_DEMAND_PERSISTS',
        'post.demand*8>=baselineDemand*9',
        'W4_TRACE_WRITE_INDEX_MATCH',
        'rw("g_w4_trace_write_index")===((trigger+52)&127)',
    )))
    gate("W4_REAL_TERMINAL_CAPSULE_BEFORE_BULK_CAPTURE", all(token in REAL for token in (
        'W4_TERMINAL_CAPSULE_COMMITTED',
        'packetActive===0', 'pwmNow===0', 'finalPwm===0', 'finalOst===1',
        'runStop===RUN_ID', 'hwOst===1', 'cookie===expectedCookie',
        'if(!capsuleOk){throw "terminal-capsule-invalid";}',
    )) and REAL.index('if(!capsuleOk){throw "terminal-capsule-invalid";}') <
         REAL.index('session.memory.readWord(1,addr("g_w4_trace_ring_raw"),128)'))
    gate("W4_REAL_THREE_BULK_RING_READS", all(token in REAL for token in (
        'session.memory.readWord(1,addr("g_w4_trace_ring_raw"),128)',
        'session.memory.readWord(1,addr("g_w4_trace_ring_cycle_delta"),128)',
        'session.memory.readWord(1,addr("g_w4_trace_ring_packet_delta"),128)',
    )) and "rawBase+index" not in REAL and "cycBase+index" not in REAL and
         "pktBase+index" not in REAL)
    gate("W4_V14_LINK_IDLE_NOENERGY_PROTOCOL", all(token in LINK_NE for token in (
        "QUIET_FIRST_NS=70000000000",
        "QUIET_FINAL_NS=205000000000",
        "session.setScriptTimeout(5000);",
        "FIRST_BOUNDED_IS_HALTED_FALSE",
        "FINAL_BOUNDED_IS_HALTED_FALSE",
        "LINK_QUARANTINE__NO_MORE_DSS_CALLS=TRUE",
        "NOENERGY_ONLY_ACTIVE_HALT_AFTER_PROTOCOL=TRUE",
        "SOL_W4_V14_QUIET_LINK_IDLE_NOENERGY_PASS=",
    )) and LINK_NE.count("session.target.isHalted()") == 2 and
         "waitForHalt(" not in LINK_NE)
    gate("W4_REAL_DYNAMIC_CYCLE_CAP_CHECK", all(token in REAL for token in (
        "total<=proportionalCap+160", "total<=22500000+160",
    )))
    ne_sha_match = re.search(r'EXPECTED_SHA="([0-9A-F]{64})"', NE)
    actual_ne_sha = (hashlib.sha256(NE_OUT.read_bytes()).hexdigest().upper()
                     if NE_OUT.exists() else "")
    gate("W4_NE_SHA_HARD_GATE", ne_sha_match is not None and
         ne_sha_match.group(1) == actual_ne_sha and
         'check("NE_SHA_HARD_GATE",actualSha.equals(EXPECTED_SHA)' in NE and
         'g_w4_trace_operator_marker_tick' in NE and
         'g_enable_rising_count")==enableRise0' in NE and
         'g_tz_hardware_trip_count")==hardwareTrip0' in NE and
         'g_tz_active_window_trip_count")==activeTrip0' in NE)

    heavy = frozen_model(1, make_step_stream(1, 1185))
    gate("W4_TRACE_MODEL_HEAVIER_DETECTS", heavy["complete"] == 1)
    gate("W4_TRACE_MODEL_HEAVIER_QUALITY", heavy["quality"] == 1 and
         heavy["post_persists"] == 1 and
         heavy["min"] == 1185 and heavy["settle"] <= 100 and
         heavy["baseline_demand"] == 15000 and
         heavy["trigger_demand"] == 22500)
    light = frozen_model(2, make_step_stream(2, 1295))
    gate("W4_TRACE_MODEL_LIGHTER_DETECTS", light["complete"] == 1)
    gate("W4_TRACE_MODEL_LIGHTER_QUALITY", light["quality"] == 1 and
         light["post_persists"] == 1 and
         light["max"] == 1295 and light["settle"] <= 100 and
         light["baseline_demand"] == 22500 and
         light["trigger_demand"] == 15000)
    gate("W4_TRACE_MODEL_V13_STALE_STARTUP_REPLACED",
         light["baseline_demand"] != ((80 * 80) >> 1) and
         14_000 <= light["confirm"] <= 14_011 and
         13_989 <= light["trigger"] <= 14_000)
    marker_guard_stream = make_step_stream(1, 1185, step_sample=2_200)
    marker_guard_stream += [(1240, 300, 2)] * 300
    marker_guard = frozen_model(1, marker_guard_stream)
    gate("W4_TRACE_MODEL_ALL_CANDIDATE_SAMPLES_POST_TARGET_MARKER",
         marker_guard["complete"] == 1 and
         marker_guard["trigger"] >= DETECT_SAMPLE + 1 and
         marker_guard["confirm"] >= DETECT_SAMPLE + 3 * BLOCK and
         marker_guard["confirm"] - marker_guard["trigger"] == 11)
    bad = frozen_model(1, make_step_stream(1, 1170))
    gate("W4_TRACE_MODEL_REJECTS_PEAK", bad["complete"] == 1 and bad["quality"] == 0)

    one_block_glitch = [(1240, 300, 3)] * 14_000
    one_block_glitch += [(1240, 300, 2)] * 4
    one_block_glitch += [(1240, 300, 3)] * 100
    gate("W4_TRACE_MODEL_REJECTS_ONE_BLOCK_GLITCH",
         frozen_model(1, one_block_glitch)["complete"] == 0)
    forty_ms_pulse = [(1240, 300, 3)] * 14_000
    forty_ms_pulse += [(1240, 300, 2)] * 8
    forty_ms_pulse += [(1240, 300, 3)] * (EVAL + 100)
    pulse_result = frozen_model(1, forty_ms_pulse)
    gate("W4_TRACE_MODEL_REJECTS_40MS_PULSE_AT_PERSISTENCE_GATE",
         pulse_result["complete"] == 1 and
         pulse_result["post_persists"] == 0)
    reverse = [(1240, 300, 3)] * 14_000 + [(1240, 300, 4)] * 100
    gate("W4_TRACE_MODEL_REJECTS_REVERSE_DIRECTION",
         frozen_model(1, reverse)["complete"] == 0)
    zero_packet = [(1240, 300, 3)] * 14_000 + [(1240, 0, 0)] * 100
    gate("W4_TRACE_MODEL_ZERO_PACKET_NO_FALSE_TRIGGER",
         frozen_model(1, zero_packet)["complete"] == 0)

    drift = []
    for i in range(36_000):
        cycles = 300 + (12 * i // 35_999)
        drift.append((1240, cycles, 2))
    gate("W4_TRACE_MODEL_180S_SUBTHRESHOLD_DRIFT_NO_FALSE_TRIGGER",
         frozen_model(1, drift)["complete"] == 0)

    slow_manual = [(1240, 300, 3)] * 14_000
    slow_manual += [(1240, 300 + (60 * i // 299), 3) for i in range(300)]
    slow_manual += [(1240, 360, 3)] * (EVAL + 20)
    slow_result = frozen_model(1, slow_manual)
    gate("W4_TRACE_MODEL_FROZEN_REFERENCE_DETECTS_SLOW_MANUAL_CHANGE",
         slow_result["complete"] == 1 and
         slow_result["confirm"] >= 14_000)
    gate("W4_TRACE_MODEL_INCLUSIVE_12P5_BOUNDARIES",
         direction_changed(1, 800, 900, 900, 900) and
         not direction_changed(1, 800, 899, 900, 900) and
         direction_changed(2, 800, 700, 700, 700) and
         not direction_changed(2, 800, 701, 700, 700))

    peak_low_pass = quality_metrics([1182] * 4 + [1240] * 48)
    peak_low_fail = quality_metrics([1181] * 4 + [1240] * 48)
    peak_high_pass = quality_metrics([1306] * 4 + [1240] * 48)
    peak_high_fail = quality_metrics([1307] * 4 + [1240] * 48)
    gate("W4_TRACE_MODEL_EXACT_PEAK_BOUNDARIES",
         peak_low_pass["quality"] == 1 and
         peak_low_fail["quality"] == 0 and
         peak_high_pass["quality"] == 1 and
         peak_high_fail["quality"] == 0)
    settle_100 = quality_metrics([1300] * 18 + [1240] * 34)
    settle_105 = quality_metrics([1300] * 19 + [1240] * 33)
    gate("W4_TRACE_MODEL_EXACT_SETTLE_BOUNDARIES",
         settle_100["settle"] == 100 and settle_100["quality"] == 1 and
         settle_105["settle"] == 105 and settle_105["quality"] == 0)

    post_stream = make_step_stream(1, 1185)
    full_post = frozen_model(1, post_stream)
    trigger_start = full_post["trigger"]
    post_39 = frozen_model(1, post_stream[:trigger_start + EVAL - 1])
    post_40 = frozen_model(1, post_stream[:trigger_start + EVAL])
    gate("W4_TRACE_MODEL_POST39_INCOMPLETE_POST40_COMPLETE",
         post_39["complete"] == 0 and post_40["complete"] == 1 and
         post_40["confirm"] - post_40["trigger"] == 11)
    max_demand = (1250 * 319) >> 1
    gate("W4_TRACE_MODEL_DEMAND_MULTIPLY_UINT32_BOUND",
         max_demand == 199_375 and max_demand * 9 < 0xFFFFFFFF)

    ring_windows_ok = True
    for end in range(RING):
        reference = [(end + RING - 39 + i) & (RING - 1)
                     for i in range(BASELINE)]
        first = [(end + RING - 11 + i) & (RING - 1)
                 for i in range(BLOCK)]
        second = [(end + RING - 7 + i) & (RING - 1)
                  for i in range(BLOCK)]
        third = [(end + RING - 3 + i) & (RING - 1)
                 for i in range(BLOCK)]
        candidates = [(end - 11 + i) % RING for i in range(3 * BLOCK)]
        trigger = (end - 11) % RING
        evaluation = [(trigger + i) % RING for i in range(EVAL)]
        ring_windows_ok &= reference == [(end - 39 + i) % RING
                                         for i in range(BASELINE)]
        ring_windows_ok &= first + second + third == candidates
        ring_windows_ok &= len(set(reference)) == BASELINE
        ring_windows_ok &= len(set(candidates)) == 3 * BLOCK
        ring_windows_ok &= len(set(evaluation)) == EVAL
    gate("W4_TRACE_MODEL_ALL_128_FROZEN_AND_CANDIDATE_RING_PHASES", ring_windows_ok)
    gate("W4_TRACE_MODEL_179P5S_HAS_CAPTURE_MARGIN",
         8_975_000 + (12 + POST) * 250 < 9_000_000)
    print("SOL_W4_TRACE_STATIC_MODEL_PASS=TRUE")


if __name__ == "__main__":
    main()
