#!/usr/bin/env python3
"""Static and executable model gates for the W4 5 ms A/B/A observer."""

import hashlib
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = (ROOT / "app" / "cal_hold_burst.c").read_text(encoding="utf-8")
HDR = (ROOT / "app" / "cal_hold_burst.h").read_text(encoding="utf-8")
REAL = (ROOT / "tools" / "sol_w4_10v_aba_real.js").read_text(encoding="utf-8")
LINK_NE = (ROOT / "tools" / "sol_w4_v12_link_idle_noenergy.js").read_text(encoding="utf-8")
REAL_OUT = (ROOT / "Stage6_OL_STEADY" /
            "LLC_100W_F28034_OPEN_LOOP_STEADY.out")

RING = 128
BASELINE = 40
BLOCK = 4
POST = 40
EVAL = 48


def gate(name: str, ok: bool) -> None:
    print(f"{name}={'TRUE' if ok else 'FALSE'}")
    if not ok:
        raise AssertionError(name)


def model(direction: int, baseline_cycles: int, baseline_packets: int,
          step_cycles: int, step_packets: int,
          step_raw: list[int]) -> dict[str, int]:
    raw_ring = [1240] * RING
    cycle_ring = [baseline_cycles] * RING
    packet_ring = [baseline_packets] * RING
    write = BASELINE
    baseline_cpp = baseline_cycles // baseline_packets
    baseline_demand = (baseline_cycles * baseline_cpp) >> 1
    block_sum = 0
    block_packets = 0
    block_count = 0
    streak = 0
    candidate = 0
    trigger = None
    post_left = POST
    raw_stream = ([1240] * 8) + step_raw + ([1240] * 80)

    for sample_index, raw in enumerate(raw_stream):
        idx = write
        cycles = baseline_cycles if sample_index < 8 else step_cycles
        packets = baseline_packets if sample_index < 8 else step_packets
        raw_ring[idx] = raw
        cycle_ring[idx] = cycles
        packet_ring[idx] = packets
        write = (write + 1) & (RING - 1)
        if trigger is None:
            block_sum += cycles
            block_packets += packets
            block_count += 1
            if block_count == BLOCK:
                block_c5 = block_sum // BLOCK
                block_cpp = block_sum // block_packets
                demand = (block_c5 * block_cpp) >> 1
                changed = ((demand * 8 >= baseline_demand * 9) if direction == 1
                           else (demand * 8 <= baseline_demand * 7))
                if changed:
                    if streak == 0:
                        candidate = (idx - (BLOCK - 1)) & (RING - 1)
                    streak += 1
                    if streak >= 2:
                        trigger = candidate
                else:
                    streak = 0
                block_sum = 0
                block_packets = 0
                block_count = 0
        else:
            post_left -= 1
            if post_left == 0:
                break

    if trigger is None:
        return {"complete": 0}

    values = [raw_ring[(trigger + i) & (RING - 1)] for i in range(EVAL)]
    last_out = None
    for i in range(BLOCK - 1, EVAL):
        avg = sum(values[i - (BLOCK - 1):i + 1]) // BLOCK
        if avg < 1215 or avg > 1265:
            last_out = i
    settle = 0 if last_out is None else (last_out + 1) * 5
    peak = min(values) >= 1182 and max(values) <= 1306
    return {
        "complete": 1,
        "min": min(values),
        "max": max(values),
        "settle": settle,
        "quality": int(peak and settle <= 100),
    }


def main() -> None:
    gate("W4_TRACE_RING_POWER_OF_TWO", RING & (RING - 1) == 0)
    gate("W4_TRACE_STATIC_CONSTANTS", all(token in HDR for token in (
        "W4_TRACE_SAMPLES                  128U",
        "W4_TRACE_BASELINE_SAMPLES         40U",
        "W4_TRACE_DETECT_BLOCK_SAMPLES     4U",
        "W4_TRACE_POST_SAMPLES             40U",
        "W4_TRACE_DETECT_START_TICKS        35000UL",
        "W4_TRACE_MIN_HOLD_TICKS           3000000UL",
        "W4_TRACE_MAX_HOLD_TICKS           9000000UL",
        "W4_TRACE_MAX_TOTAL_PACKET_CYCLES 22500000UL",
        "W4_TRACE_STATS_MAX_ACCUM_SAMPLES  3000000UL",
        "W4_TRACE_FAIL_BAD_SESSION            4U",
        "W4_TRACE_5PCT_LOW_RAW              1182U",
        "W4_TRACE_2PCT_LOW_RAW              1215U",
        "W4_TRACE_SETTLE_LIMIT_MS            100U",
        "W4_TRACE_TERMINAL_COOKIE_BASE 0x57440000UL",
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
    gate("W4_TRACE_DETECTS_IMMEDIATELY_AFTER_BASELINE",
         "W4_TRACE_BASELINE_START_TICKS      25000UL" in HDR and
         "W4_TRACE_DETECT_START_TICKS        35000UL" in HDR and
         "W4_TRACE_BASELINE_SAMPLES         40U" in HDR and
         "W4_TRACE_SAMPLE_MS                 5U" in HDR)
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
    gate("W4_TRACE_DIRECTIONAL_PERSISTENCE", all(token in SRC for token in (
        "g_w4_trace_baseline_demand_index * 9UL",
        "g_w4_trace_baseline_demand_index * 7UL",
        "block_cycles_per_packet",
        "s_w4_trace_detect_streak >= W4_TRACE_DETECT_STREAK_BLOCKS",
    )))
    helper = SRC[SRC.index("static void CALHOLD_W4TraceSample"):
                 SRC.index("static void CALHOLD_W4TraceEnd")]
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
        'PREFIRE_TARGET_CLOCK_200MS', 'W4_PHYSICAL_STEP_NOW=',
        'java.lang.System.nanoTime()', 'ACK_LINE_REQUIRED=',
        'java.lang.Long.toHexString', 'line.equals(ackNonce)',
        'var HOST_QUIET_MIN_NS=70000000000',
        'var HOST_QUIET_MAX_NS=205000000000',
        'FIRMWARE_TERMINAL_HALT_OBSERVED=TRUE',
        'if(!fired || terminalHaltObserved)',
        'forceSafe(!fired)',
        'HOST_DID_NOT_HALT_UNCONFIRMED_ACTIVE_TARGET=TRUE',
        'NO_RETRY_SAME_SHA_AFTER_FIRE=TRUE',
    )) and "readLine(" in REAL and "currentTimeMillis" not in REAL and
         "waitForHalt(" not in REAL and "setScriptTimeout(-1)" not in REAL)
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
    gate("W4_V12_LINK_IDLE_NOENERGY_PROTOCOL", all(token in LINK_NE for token in (
        "QUIET_FIRST_NS=70000000000",
        "QUIET_FINAL_NS=205000000000",
        "session.setScriptTimeout(5000);",
        "FIRST_BOUNDED_IS_HALTED_FALSE",
        "FINAL_BOUNDED_IS_HALTED_FALSE",
        "LINK_QUARANTINE__NO_MORE_DSS_CALLS=TRUE",
        "NOENERGY_ONLY_ACTIVE_HALT_AFTER_PROTOCOL=TRUE",
        "SOL_W4_V12_QUIET_LINK_IDLE_NOENERGY_PASS=",
    )) and LINK_NE.count("session.target.isHalted()") == 2 and
         "waitForHalt(" not in LINK_NE)
    gate("W4_REAL_DYNAMIC_CYCLE_CAP_CHECK", all(token in REAL for token in (
        "total<=proportionalCap+160", "total<=22500000+160",
    )))

    heavy = model(1, 100, 4, 100, 3, [1185] * 4)
    gate("W4_TRACE_MODEL_HEAVIER_DETECTS", heavy["complete"] == 1)
    gate("W4_TRACE_MODEL_HEAVIER_QUALITY", heavy["quality"] == 1 and
         heavy["min"] == 1185 and heavy["settle"] <= 100)
    light = model(2, 100, 3, 100, 4, [1300] * 4)
    gate("W4_TRACE_MODEL_LIGHTER_DETECTS", light["complete"] == 1)
    gate("W4_TRACE_MODEL_LIGHTER_QUALITY", light["quality"] == 1 and
         light["max"] == 1300 and light["settle"] <= 100)
    bad = model(1, 100, 4, 100, 3, [1170] * 4)
    gate("W4_TRACE_MODEL_REJECTS_PEAK", bad["complete"] == 1 and bad["quality"] == 0)
    print("SOL_W4_TRACE_STATIC_MODEL_PASS=TRUE")


if __name__ == "__main__":
    main()
