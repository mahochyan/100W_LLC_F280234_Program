#!/usr/bin/env python3
"""Static and executable model gates for the W4 5 ms A/B/A observer."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = (ROOT / "app" / "cal_hold_burst.c").read_text(encoding="utf-8")
HDR = (ROOT / "app" / "cal_hold_burst.h").read_text(encoding="utf-8")
REAL = (ROOT / "tools" / "sol_w4_10v_aba_real.js").read_text(encoding="utf-8")

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
        "W4_TRACE_5PCT_LOW_RAW              1182U",
        "W4_TRACE_2PCT_LOW_RAW              1215U",
        "W4_TRACE_SETTLE_LIMIT_MS            100U",
    )))
    gate("W4_TRACE_THREE_FIELD_RING", all(token in SRC for token in (
        "g_w4_trace_ring_raw[W4_TRACE_SAMPLES]",
        "g_w4_trace_ring_cycle_delta[W4_TRACE_SAMPLES]",
        "g_w4_trace_ring_packet_delta[W4_TRACE_SAMPLES]",
    )))
    gate("W4_TRACE_ONE_SHOT_ARM", "g_w4_trace_arm = 0U;  /* one-shot consume" in SRC)
    gate("W4_TRACE_DETECTS_IMMEDIATELY_AFTER_BASELINE",
         "W4_TRACE_BASELINE_START_TICKS      25000UL" in HDR and
         "W4_TRACE_DETECT_START_TICKS        35000UL" in HDR and
         "W4_TRACE_BASELINE_SAMPLES         40U" in HDR and
         "W4_TRACE_SAMPLE_MS                 5U" in HDR)
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
    fire = REAL[REAL.index('wv("g_cal_hold_request",1);'):
                REAL.index('session.target.halt();',
                           REAL.index('wv("g_cal_hold_request",1);'))]
    gate("W4_REAL_UNINTERRUPTED_POWER_WINDOW", all(token not in fire for token in (
        "rw(", "rv32u(", "reg(", "session.memory.readWord",
    )))
    gate("W4_REAL_SHA_AND_PHYSICAL_GATES", all(token in REAL for token in (
        'EXPECTED_SHA="B10587C6FF8BE3F438E18CB229DAB9733087FE62BC091129778F0D359A71C07B"',
        'SOL_W4_INPUT_LIMIT_A', 'SOL_W4_INITIAL_LOAD_OHMS',
        'PREFIRE_TARGET_CLOCK_200MS', 'W4_PHYSICAL_STEP_NOW=',
        'NO_RETRY_SAME_SHA_AFTER_FIRE=TRUE',
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
