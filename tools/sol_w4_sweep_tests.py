#!/usr/bin/env python3
"""Static, artifact, and executable-model gates for W4 CR20..CR5 sweep V2."""

import hashlib
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HDR = (ROOT / "app" / "cal_hold_burst.h").read_text(encoding="utf-8")
SRC = (ROOT / "app" / "cal_hold_burst.c").read_text(encoding="utf-8")
HOST = (ROOT / "tools" / "sol_w4_cr20_to_cr5_sweep_real.js").read_text(encoding="utf-8")
BUILD_REAL = (ROOT / "tools" / "build_flash_open_loop_steady.bat").read_text(encoding="utf-8")
BUILD_NE = (ROOT / "tools" / "build_open_loop_steady_noenergy.bat").read_text(encoding="utf-8")
REAL_OUT = ROOT / "Stage6_W4_SWEEP_V2" / "LLC_100W_F28034_OPEN_LOOP_STEADY.out"
REAL_MAP = ROOT / "Stage6_W4_SWEEP_V2" / "LLC_100W_F28034_OPEN_LOOP_STEADY.map"
NE_OUT = ROOT / "Stage6_W4_SWEEP_V2_NE" / "LLC_100W_F28034_OPEN_LOOP_STEADY_NE.out"
NE_MAP = ROOT / "Stage6_W4_SWEEP_V2_NE" / "LLC_100W_F28034_OPEN_LOOP_STEADY_NE.map"
CANON_REAL = ROOT / "Stage6_OL_STEADY" / "LLC_100W_F28034_OPEN_LOOP_STEADY.out"
CANON_NE = ROOT / "Stage6_OL_STEADY_NE" / "LLC_100W_F28034_OPEN_LOOP_STEADY_NE.out"
V14_HOST = (ROOT / "tools" / "sol_w4_10v_aba_real.js").read_text(encoding="utf-8")
MASTER_STATE = (ROOT / "docs" / "SOL_MASTER_EXECUTION_STATE.md").read_text(encoding="utf-8")

EXPECTED_REAL_SHA = "D10284938BE15DEA5772DF8595F064E40321B2BF26898CED382DE0ABD2C3A8CD"
EXPECTED_REAL_MAP_SHA = "442B64AA26B0801A3D6CF9D24F474159BE56C6683A77DDE9FE6C18BEF4D40562"
EXPECTED_NE_SHA = "54376784D0143087545CE458E2B8B80455396F2909DE548771E7A24F99375FB6"
EXPECTED_NE_MAP_SHA = "FD284C93CC720174F432D30B960CB67E8E463A20D6D99FD243A18FB648A22140"
EXPECTED_CSV = (
    "D:\\CCS21_workspace\\Codex_Project\\evidence\\sol_master_execution\\"
    "w4_10v_quality\\cr20_to_cr5_sweep_v2_run_0x25090601.csv"
)
CHECKSUM_SEED = 0x53575016
RUN_ID = 0x25090601
BINS = 400
LEVELS = 16
BINS_PER_LEVEL = 25
TRANSITION_BINS = 15
PLATEAU_BINS = 10
CUE_OFF_BINS = 8
SAMPLES_PER_BIN = 40
BIN_MS = SAMPLES_PER_BIN * 5
TARGET_COMPLETE_TICK = 4_600_000

Sample = tuple[int, int, int, int]
Bin = tuple[int, int, int, int, int, int]


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def gate(name: str, ok: bool) -> None:
    print(f"{name}={'TRUE' if ok else 'FALSE'}")
    if not ok:
        raise AssertionError(name)


def map_free(text: str, region: str) -> int:
    match = re.search(
        rf"^\s*{region}\s+[0-9a-f]+\s+[0-9a-f]+\s+[0-9a-f]+\s+([0-9a-f]+)",
        text,
        re.MULTILINE | re.IGNORECASE,
    )
    if not match:
        raise AssertionError(f"missing map region {region}")
    return int(match.group(1), 16)


def legacy_sweep_env_fails_closed(text: str) -> bool:
    """The retired V1 selector must stop, never alias the V2 build."""
    match = re.search(
        r'if\s+"%SOL_W4_SWEEP_BUILD%"=="1"\s*\((.*?)\)',
        text,
        re.IGNORECASE | re.DOTALL,
    )
    return bool(
        match and "exit /b" in match.group(1).lower() and
        "retir" in match.group(1).lower()
    )


def mix32(checksum: int, value: int) -> int:
    checksum &= 0xFFFFFFFF
    return ((((checksum << 5) & 0xFFFFFFFF) | (checksum >> 27)) ^
            (value & 0xFFFF)) & 0xFFFFFFFF


def reduce_bins(samples: list[Sample]) -> list[Bin]:
    """Mirror the target's fixed 40-sample/200-ms reduction."""
    if len(samples) != BINS * SAMPLES_PER_BIN:
        raise ValueError("exact 80 s at 5 ms required")
    result: list[Bin] = []
    for offset in range(0, len(samples), SAMPLES_PER_BIN):
        part = samples[offset:offset + SAMPLES_PER_BIN]
        raw = [item[0] for item in part]
        cycles = sum(item[1] for item in part)
        packets = sum(item[2] for item in part)
        ticks = sum(item[3] for item in part)
        if cycles > 0xFFFF or packets > 0xFFFF or ticks > 0xFFFF:
            raise OverflowError
        result.append((
            min(raw),
            max(raw),
            sum(raw) // SAMPLES_PER_BIN,
            cycles,
            packets,
            ticks,
        ))
    return result


def rolling_checksum(bins: list[Bin]) -> int:
    checksum = CHECKSUM_SEED
    for index, row in enumerate(bins):
        for value in (index, *row):
            checksum = mix32(checksum, value)
    return checksum


def terminal_cookie(
    state: int,
    reason: int,
    checksum: int,
    count: int,
    overflow: int,
) -> int:
    return (
        0x57440000 ^ 0x00001405 ^ 0x00000016 ^ RUN_ID ^ (3 << 16) ^
        ((state & 0xFFFF) << 8) ^ (reason & 0xFFFF) ^ checksum ^
        ((count & 0xFFFF) << 16) ^ (overflow & 0xFFFF)
    ) & 0xFFFFFFFF


def demand(cycles: int, packets: int, five_ms_samples: int) -> int:
    """Mirror the host's fixed-duration demand estimator, including zero time."""
    if cycles <= 0 or packets <= 0:
        return 0
    return ((cycles // five_ms_samples) * (cycles // packets)) // 2


def structure_ok(bins: list[Bin]) -> bool:
    return all(
        raw_min <= raw_avg <= raw_max and cycles > 0 and packets > 0 and
        packets <= cycles
        for raw_min, raw_max, raw_avg, cycles, packets, _ in bins
    )


def assess_segments(bins: list[Bin]) -> tuple[bool, bool, list[int], int]:
    """Mirror all sixteen fixed 3-s-transition + 2-s-plateau host gates."""
    cadence_ok = len(bins) == BINS and all(9000 <= row[5] <= 11000 for row in bins)
    if len(bins) != BINS:
        return False, cadence_ok, [], 0

    segments_ok = True
    segment_demand: list[int] = []
    monotonic_steps = 0
    for level in range(LEVELS):
        plateau_start = level * BINS_PER_LEVEL + TRANSITION_BINS
        plateau = bins[plateau_start:plateau_start + PLATEAU_BINS]
        first = plateau[:PLATEAU_BINS // 2]
        second = plateau[PLATEAU_BINS // 2:]
        cycles = sum(row[3] for row in plateau)
        packets = sum(row[4] for row in plateau)
        first_cycles = sum(row[3] for row in first)
        first_packets = sum(row[4] for row in first)
        second_cycles = sum(row[3] for row in second)
        second_packets = sum(row[4] for row in second)
        level_demand = demand(cycles, packets, PLATEAU_BINS * SAMPLES_PER_BIN)
        first_demand = demand(
            first_cycles, first_packets, (PLATEAU_BINS // 2) * SAMPLES_PER_BIN
        )
        second_demand = demand(
            second_cycles, second_packets, (PLATEAU_BINS // 2) * SAMPLES_PER_BIN
        )
        stable = (
            first_demand > 0 and second_demand > 0 and
            first_demand * 100 >= second_demand * 97 and
            second_demand * 100 >= first_demand * 97
        )
        voltage_ok = min(row[0] for row in plateau) >= 1182 and max(
            row[1] for row in plateau
        ) <= 1306
        if segment_demand and level_demand * 100 >= segment_demand[-1] * 102:
            monotonic_steps += 1
        segment_demand.append(level_demand)
        if not stable or not voltage_ok or level_demand <= 0:
            segments_ok = False
    return segments_ok, cadence_ok, segment_demand, monotonic_steps


def replace_plateau(source: list[Bin], level: int, source_level: int) -> list[Bin]:
    result = list(source)
    dst = level * BINS_PER_LEVEL + TRANSITION_BINS
    src = source_level * BINS_PER_LEVEL + TRANSITION_BINS
    for offset in range(PLATEAU_BINS):
        result[dst + offset] = source[src + offset]
    return result


def main() -> None:
    real_map = REAL_MAP.read_text(encoding="utf-8", errors="replace")
    ne_map = NE_MAP.read_text(encoding="utf-8", errors="replace")

    gate("W4_SWEEP_COMPILE_GATE", all(token in HDR for token in (
        "#define STAGE6_W4_SWEEP_TEST 0",
        "STAGE6_W4_SWEEP_TEST requires STAGE6_OPEN_LOOP_STEADY_BUILD",
        "W4_TRACE_DIRECTION_SWEEP",
    )))
    gate("W4_SWEEP_EXACT_PROFILE", all(token in HDR for token in (
        "W4_SWEEP_LOAD_PROFILE_ID         0x1405UL",
        "W4_SWEEP_ALGORITHM_ID            0x0016UL",
        "W4_SWEEP_BIN_SAMPLES                 40U",
        "W4_SWEEP_BINS                       400U",
        "W4_SWEEP_MARKER_TICKS            600000UL",
        "W4_SWEEP_LEVELS                       16U",
        "W4_SWEEP_BINS_PER_LEVEL               25U",
        "W4_SWEEP_TRANSITION_BINS               15U",
        "W4_SWEEP_PLATEAU_BINS                  10U",
        "W4_SWEEP_CUE_OFF_BINS                   8U",
        "W4_SWEEP_CHECKSUM_SEED          0x53575016UL",
    )))
    gate(
        "W4_SWEEP_SEGMENT_ARITHMETIC",
        LEVELS * BINS_PER_LEVEL == BINS and
        TRANSITION_BINS + PLATEAU_BINS == BINS_PER_LEVEL and
        BIN_MS == 200 and BINS_PER_LEVEL * BIN_MS == 5000 and
        TRANSITION_BINS * BIN_MS == 3000 and
        PLATEAU_BINS * BIN_MS == 2000 and CUE_OFF_BINS * BIN_MS == 1600,
    )
    gate("W4_SWEEP_V2_BUILD_ISOLATED_DIRECTORIES", all(token in BUILD_REAL for token in (
        'if "%SOL_W4_SWEEP_V2_BUILD%"=="1" set BUILD=%PROJ%\\Stage6_W4_SWEEP_V2',
        'if "%SOL_W4_SWEEP_V2_BUILD%"=="1" set EXTRA_DEFINE=-DSTAGE6_W4_SWEEP_TEST=1',
    )) and all(token in BUILD_NE for token in (
        'if "%SOL_W4_SWEEP_V2_BUILD%"=="1" set BUILD=%PROJ%\\Stage6_W4_SWEEP_V2_NE',
        'if "%SOL_W4_SWEEP_V2_BUILD%"=="1" set EXTRA_DEFINE=-DSTAGE6_W4_SWEEP_TEST=1',
    )))
    gate(
        "W4_SWEEP_V1_BUILD_ENV_RETIRED_FAIL_CLOSED",
        legacy_sweep_env_fails_closed(BUILD_REAL) and
        legacy_sweep_env_fails_closed(BUILD_NE),
    )
    # The ignored canonical build directories may be absent.  That is the
    # fail-closed state: the already-fired V14 host remains pinned to its
    # historical SHA, while no differently hashed rebuild may occupy that path
    # and be mistaken for the frozen evidence artifact.
    v14_real_sha = "B4371EC608FDD0759FD3DEE52C125079CF3DE9A6CFE480BEA1181BD5DD588F2B"
    v14_ne_sha = "A90BD9223F96D9D8168CD22EE30D7922A31C0088C9110653F578E222217EFCB8"
    canon_real_guarded = not CANON_REAL.exists() or sha(CANON_REAL) == v14_real_sha
    canon_ne_guarded = not CANON_NE.exists() or sha(CANON_NE) == v14_ne_sha
    gate(
        "W4_SWEEP_CANONICAL_V14_REPLAY_GUARDED",
        canon_real_guarded and canon_ne_guarded and
        f'EXPECTED_SHA="{v14_real_sha}"' in V14_HOST and
        f"W4_V14_REAL_OUT_SHA256={v14_real_sha}" in MASTER_STATE and
        f"W4_V14_NE_OUT_SHA256={v14_ne_sha}" in MASTER_STATE,
    )
    gate(
        "W4_SWEEP_ARTIFACT_HASH_BOUND",
        re.fullmatch(r"[0-9A-F]{64}", EXPECTED_REAL_SHA) is not None and
        re.fullmatch(r"[0-9A-F]{64}", EXPECTED_REAL_MAP_SHA) is not None and
        re.fullmatch(r"[0-9A-F]{64}", EXPECTED_NE_SHA) is not None and
        re.fullmatch(r"[0-9A-F]{64}", EXPECTED_NE_MAP_SHA) is not None and
        sha(REAL_OUT) == EXPECTED_REAL_SHA and
        sha(REAL_MAP) == EXPECTED_REAL_MAP_SHA and
        sha(NE_OUT) == EXPECTED_NE_SHA and sha(NE_MAP) == EXPECTED_NE_MAP_SHA and
        f'EXPECTED_SHA="{EXPECTED_REAL_SHA}"' in HOST,
    )

    arrays = (
        "g_w4_sweep_raw_min", "g_w4_sweep_raw_max", "g_w4_sweep_raw_avg",
        "g_w4_sweep_cycle_sum", "g_w4_sweep_packet_sum", "g_w4_sweep_tick_delta",
    )
    symbols = tuple(f"_{name}" for name in arrays) + (
        "_g_w4_sweep_count", "_g_w4_sweep_overflow", "_g_w4_sweep_data_checksum",
    )
    gate(
        "W4_SWEEP_SIX_ARRAYS_LINKED_IN_RAML3",
        all(f"{name}[W4_SWEEP_BINS]" in HDR for name in arrays) and
        all(symbol in real_map and symbol in ne_map for symbol in symbols) and
        map_free(real_map, "RAML2") >= 0x1 and map_free(real_map, "RAML3") == 0x320 and
        map_free(ne_map, "RAML2") >= 0x1 and map_free(ne_map, "RAML3") == 0x2ED,
    )
    gate(
        "W4_SWEEP_MEMORY_ACCOUNTING_2400_WORDS",
        BINS * len(arrays) == 2400 and 2400 < 3458 and
        "400 x 200 ms bins use 2400 RAML3 words" in SRC,
    )

    recorder = SRC[
        SRC.index("static void CALHOLD_W4SweepSample"):
        SRC.index("/* Passive 5 ms observer", SRC.index("static void CALHOLD_W4SweepSample"))
    ]
    gate("W4_SWEEP_OBSERVER_ONLY", all(token not in recorder for token in (
        "PWM_", "TZCLR", "TZFRC", "g_pwm_enable_request", "g_cal_hold_request",
        "g_cal_hold_duration_ms",
    )))
    gate("W4_SWEEP_TARGET_OWNS_MARKER_REDUCTION_AND_FREEZE", all(
        token in recorder for token in (
            "g_w4_trace_operator_marker_tick = g_cal_hold_elapsed_ticks;",
            "s_w4_trace_last_cycle_clock = s_w4_trace_cycle_clock;",
            "s_w4_sweep_bin_count < W4_SWEEP_BIN_SAMPLES",
            "s_w4_sweep_cycle_sum > 0xFFFFUL",
            "g_w4_sweep_raw_min[index] = s_w4_sweep_raw_min;",
            "g_w4_sweep_raw_avg[index] = (Uint16)",
            "g_w4_sweep_tick_delta[index] = (Uint16)",
            "g_w4_sweep_count >= W4_SWEEP_BINS",
            "g_w4_trace_state = W4_TRACE_STATE_COMPLETE;",
        )
    ))
    gate("W4_SWEEP_TICK_DELTA_FAILS_CLOSED_AND_HOST_BOUNDS", all(
        token in recorder for token in (
            "(g_cal_hold_elapsed_ticks - s_w4_sweep_last_bin_tick) > 0xFFFFUL",
            "g_w4_sweep_overflow = 1U;",
            "g_w4_trace_fail_reason = W4_TRACE_FAIL_SWEEP_OVERFLOW;",
        )
    ) and "if(td<9000||td>11000)cadenceOk=false;" in HOST and
        'check("SWEEP_CADENCE_ALL_BINS",cadenceOk);' in HOST)
    gate("W4_SWEEP_ROLLING_CHECKSUM", all(token in SRC for token in (
        "g_w4_sweep_data_checksum = W4_SWEEP_CHECKSUM_SEED;",
        "return (((checksum << 5U) | (checksum >> 27U)) ^ (Uint32)value);",
    )) and recorder.count("g_w4_sweep_data_checksum = CALHOLD_W4SweepMix(") == 7 and
        "return ((((checksum<<5)|(checksum>>>27))^(value&0xffff))>>>0);" in HOST and
        HOST.count("recomputedChecksum=mix(recomputedChecksum,") == 7 and
        'check("SWEEP_DATA_CHECKSUM",recomputedChecksum===dataChecksum);' in HOST)
    gate("W4_SWEEP_PRIVATE_DIRECTION_AND_BOUND_COOKIE", all(token in SRC for token in (
        "requested != W4_TRACE_DIRECTION_SWEEP",
        "s_w4_trace_session_direction == W4_TRACE_DIRECTION_SWEEP",
        "w4_direction == W4_TRACE_DIRECTION_SWEEP",
        "W4_SWEEP_LOAD_PROFILE_ID ^",
        "W4_SWEEP_ALGORITHM_ID ^",
        "g_w4_sweep_data_checksum ^",
        "((Uint32)g_w4_sweep_count << 16) ^",
        "(Uint32)g_w4_sweep_overflow",
    )) and all(token in HOST for token in (
        "function cookie(runId,state,reason,dataChecksum,count,overflow)",
        "0x00000016 ^ runId",
        "dataChecksum ^ ((count&0xffff)<<16) ^ (overflow&0xffff)",
        "var expectedCookie=cookie(RUN_ID,state,reason,dataChecksum,count,overflow);",
    )))
    gate("W4_SWEEP_MULTI_LEVEL_QUALITY_FIELDS_NA", all(token in recorder for token in (
        "g_w4_trace_settle_pass = 0U;",
        "g_w4_trace_quality_pass = 0U;",
    )) and "g_w4_trace_count = g_w4_sweep_count" not in SRC)
    duration_guard = SRC[
        SRC.index("static Uint16 CALHOLD_DurationReached"):
        SRC.index("/* One shared hard-stop sequence", SRC.index(
            "static Uint16 CALHOLD_DurationReached"
        ))
    ]
    gate(
        "W4_SWEEP_EXACT_TARGET_COMPLETION_TICK_4600000",
        600_000 + BINS * SAMPLES_PER_BIN * 250 == TARGET_COMPLETE_TICK and
        TARGET_COMPLETE_TICK == 4_600_000 and all(token in duration_guard for token in (
            "if (s_w4_trace_session_direction != 0U)",
            "if (g_cal_hold_elapsed_ticks < W4_TRACE_MIN_HOLD_TICKS) return 0U;",
            "return (Uint16)(g_w4_trace_state == W4_TRACE_STATE_COMPLETE ||",
        )) and
        "elapsed>=4600000&&elapsed<=4620000" in HOST,
    )

    cue_bins = list(range(BINS_PER_LEVEL, BINS, BINS_PER_LEVEL))
    cue_offsets_ms = [17_200 + index * 5_000 for index in range(15)]
    gate("W4_SWEEP_TARGET_YELLOW_15_CUES_EVERY_5S", all(token in recorder for token in (
        "GpioDataRegs.GPASET.bit.GPIO21 = 1U;",
        "(g_w4_sweep_count % W4_SWEEP_BINS_PER_LEVEL) == 0U",
        "g_w4_sweep_count < W4_SWEEP_BINS",
        "GpioDataRegs.GPACLEAR.bit.GPIO21 = 1U;",
        "s_w4_sweep_cue_off_bins = W4_SWEEP_CUE_OFF_BINS;",
        "s_w4_sweep_cue_off_bins--;",
    )) and cue_bins == list(range(25, 376, 25)) and len(cue_bins) == 15 and
        [value * BIN_MS // 1000 for value in cue_bins] == list(range(5, 76, 5)) and
        CUE_OFF_BINS * BIN_MS == 1600 and cue_offsets_ms[0] == 17_200 and
        cue_offsets_ms[-1] == 87_200 and
        all(right - left == 5_000 for left, right in
            zip(cue_offsets_ms, cue_offsets_ms[1:])))

    cue_start = HOST.find("fireNs+17200000000")
    cue_end = HOST.find("fireNs+105000000000", max(cue_start, 0))
    host_cue_block = HOST[cue_start:cue_end] if cue_start >= 0 and cue_end > cue_start else ""
    gate("W4_SWEEP_HOST_LOCAL_TIMED_TEXT_CUES", all(token in HOST for token in (
        "var firstCue=fireNs+17200000000;",
        "for(var cueStep=1;cueStep<=15;cueStep++)",
        "firstCue+(cueStep-1)*5000000000",
        "waitUntil(",
        ".beep()",
        "SET_CR",
        "SEQUENCE=CR20_CR19_CR18_CR17_CR16_CR15_CR14_CR13_CR12_CR11_CR10_CR9_CR8_CR7_CR6_CR5",
        "EACH_LEVEL=3S_TRANSITION_WINDOW_PLUS2S_STEADY_PLATEAU",
    )) and bool(host_cue_block) and all(token not in host_cue_block for token in (
        "session.", "rw(", "rv32u(", "wv(", "wv32(", "addr(", "reg(",
        "memory.", "target.", "run(",
    )))

    post_fire = HOST[HOST.index("fired=true;"):HOST.index('var state=rw("g_cal_hold_state")')]
    gate("W4_SWEEP_HOST_NO_STDIN_OR_ACTIVE_POLL", all(token not in HOST for token in (
        "readLine", "BufferedReader", "reader.ready", "waitForHalt",
    )) and ".halt()" not in post_fire and post_fire.count("session.target.isHalted()") == 2 and
        all(token in post_fire for token in (
            "waitUntil(fireNs+105000000000);",
            "TERMINAL_PROBE_105S_IS_HALTED",
            "waitUntil(fireNs+205000000000);",
            "TERMINAL_PROBE_205S_IS_HALTED",
        )))
    gate("W4_SWEEP_HOST_CONNECT_FAILS_CLOSED", all(token in HOST for token in (
        "session.target.connect();\n  connected=true;",
        'print("W4_SWEEP_REAL_EXCEPTION="+e);\n  failures++;',
        "if(connected){\n    if(!fired||terminalHaltObserved){",
    )) and "try{session.target.connect();}catch" not in HOST)
    gate("W4_SWEEP_HOST_EXACT_PHYSICAL_CHAIN", all(token in HOST for token in (
        'INITIAL_LOAD.equals("20")', 'FINAL_LOAD.equals("5")',
        'STEP_OHMS.equals("1")', 'INPUT_LIMIT.equals("1.2")',
        "var RUN_ID=0x25090601,DIRECTION=3,BINS=400,BIN_MS=200;",
        # Uint16 duration stays 60000; nonzero W4 direction waits for trace
        # COMPLETE after the minimum-hold gate, allowing the 4.6 M tick finish.
        'wv("g_cal_hold_duration_ms",60000);',
        "NO_POINT_ACK_REQUIRED__TARGET_RECORDS_200MS_BINS=TRUE",
    )))
    gate("W4_SWEEP_HOST_SIX_BULK_READS", all(
        f'session.memory.readWord(1,addr("{name}"),BINS)' in HOST for name in arrays
    ))
    gate("W4_SWEEP_HOST_ALL_BIN_STRUCTURE", all(token in HOST for token in (
        "var cadenceOk=true,structureOk=true,csvRows=[],cumulativeTicks=0;",
        "if(mn>av||av>mx||cy<=0||pk<=0||pk>cy)structureOk=false;",
        'check("SWEEP_STRUCTURE_ALL_BINS",structureOk);',
    )))
    gate("W4_SWEEP_HOST_FIXED_16_PLATEAUS", all(token in HOST for token in (
        "for(var level=0;level<16&&count===BINS;level++)",
        "var levelStart=level*25,plateauStart=levelStart+15;",
        "for(var j=0;j<10;j++)",
        "if(j<5){firstCycles+=pc;firstPackets+=pp;}",
        "var levelDemand=demand(levelCycles,levelPackets,400);",
        "var firstHalf=demand(firstCycles,firstPackets,200);",
        "var secondHalf=demand(secondCycles,secondPackets,200);",
        "firstHalf*100>=secondHalf*97&&secondHalf*100>=firstHalf*97",
        "levelDemand*100>=segmentDemand[level-1]*102",
        'check("SWEEP_16_PLATEAUS",segmentsOk&&segmentDemand.length===16);',
        'check("SWEEP_15_MONOTONIC_STEPS",monotonicSteps===15);',
    )))
    csv_path_match = re.search(r'var CSV_PATH="([^"]+)";', HOST)
    gate("W4_SWEEP_HOST_FIXED_CSV_SCHEMA", csv_path_match is not None and
         csv_path_match.group(1).replace("\\\\", "\\") == EXPECTED_CSV and
         all(token in HOST for token in (
        "new FileWriter(CSV_PATH,false)",
        'csv.println("# run_id=0x25090601,profile_id=0x1405,algorithm_id=0x0016,out_sha256="+actual);',
        'csv.println("# data_checksum=0x"+dataChecksum.toString(16)+",count="+count+",overflow="+overflow);',
        'csv.println("# scope=supplemental_monotonic_16_level_map,scheduled_cr_not_independently_measured=true");',
        'csv.println("bin,t_end_ms_nominal,t_end_target_ticks,scheduled_cr_ohm,raw_min,raw_max,raw_avg,vout_avg_v,cycle_sum,packet_sum,tick_delta,demand_index");',
        "cumulativeTicks+=td;",
        'check("SWEEP_CUMULATIVE_CAPTURE_TICKS",cumulativeTicks>=3800000&&cumulativeTicks<=4200000);',
        'new FileWriter(CSV_PATH,true)',
        'csvResult.println("# host_gate_result="+(failures===0?"PASS":"FAIL")+',
        'print("SWEEP_CSV_PATH="+CSV_PATH);',
    )))
    gate("W4_SWEEP_SCOPE_IS_SUPPLEMENTAL_NOT_OHM_METER", all(token in HOST for token in (
        "RESULT_SCOPE=SUPPLEMENTAL_MONOTONIC_16_LEVEL_MAP__SCHEDULED_CR_NOT_INDEPENDENTLY_MEASURED",
        "scheduled_cr_ohm",
        "scheduled_cr_not_independently_measured=true",
    )))
    gate("W4_SWEEP_HOST_TERMINAL_AND_SAFETY_GATES", all(token in HOST for token in (
        "SWEEP_TERMINAL_CAPSULE", "SWEEP_CAPTURE_400_BINS", "SWEEP_HOLD_COMPLETE",
        "SWEEP_DURATION_92S", "SWEEP_CUMULATIVE_CAPTURE_TICKS",
        "SWEEP_VOUT_GLOBAL_5PCT", "SWEEP_DATA_CHECKSUM",
        "SWEEP_CADENCE_ALL_BINS", "SWEEP_STRUCTURE_ALL_BINS", "SWEEP_16_PLATEAUS",
        "SWEEP_15_MONOTONIC_STEPS", "SWEEP_ENDPOINT_DEMAND_INCREASE",
        "NO_HARD_LIMIT_EVENT", "NO_FAULT", "NO_HARDWARE_TZ_TRIP",
        "NO_PUBLIC_ENABLE_EDGE", "FINAL_PWM_OFF", "FINAL_OST_LATCHED",
        "FINAL_TZINT_ZERO", "NO_RETRY_SAME_SHA_AFTER_FIRE=TRUE",
    )))

    samples: list[Sample] = []
    for index in range(BINS * SAMPLES_PER_BIN):
        level = min(LEVELS - 1, index // (BINS_PER_LEVEL * SAMPLES_PER_BIN))
        samples.append((1239 + index % 3, 200 + level * 10, 2, 250))
    bins = reduce_bins(samples)
    gate(
        "W4_SWEEP_REDUCER_MODEL_SIX_FIELDS_400_EXACT",
        len(bins) == BINS and
        bins[0] == (1239, 1241, 1239, 8000, 80, 10000) and
        bins[-1][3:] == (14000, 80, 10000),
    )
    overflow_samples = [(1240, 4000, 1, 250)] * (BINS * SAMPLES_PER_BIN)
    try:
        reduce_bins(overflow_samples)
        overflow_rejected = False
    except OverflowError:
        overflow_rejected = True
    gate("W4_SWEEP_REDUCER_MODEL_OVERFLOW_FAILS_CLOSED", overflow_rejected)

    checksum = rolling_checksum(bins)
    checksum_detects_all_fields = True
    for field in range(6):
        tampered = list(bins)
        row = list(tampered[217])
        row[field] ^= 1
        tampered[217] = tuple(row)  # type: ignore[assignment]
        checksum_detects_all_fields &= checksum != rolling_checksum(tampered)
    gate("W4_SWEEP_CHECKSUM_MODEL_DETECTS_ALL_SIX_FIELDS", checksum_detects_all_fields)
    cookie = terminal_cookie(4, 1, checksum, BINS, 0)
    gate("W4_SWEEP_COOKIE_MODEL_BINDS_CHECKSUM_COUNT_OVERFLOW", all((
        cookie != terminal_cookie(4, 1, checksum ^ 1, BINS, 0),
        cookie != terminal_cookie(4, 1, checksum, BINS - 1, 0),
        cookie != terminal_cookie(4, 1, checksum, BINS, 1),
    )))

    segments_ok, cadence_ok, demands, monotonic_steps = assess_segments(bins)
    gate("W4_SWEEP_STRUCTURE_MODEL_ALL_BINS", structure_ok(bins))
    malformed_rows = (
        (1241, 1241, 1240, 8000, 80, 10000),
        (1239, 1241, 1242, 8000, 80, 10000),
        (1239, 1241, 1240, 0, 80, 10000),
        (1239, 1241, 1240, 8000, 0, 10000),
        (1239, 1241, 1240, 80, 81, 10000),
    )
    structure_rejects_all = True
    for malformed_row in malformed_rows:
        malformed = list(bins)
        malformed[111] = malformed_row
        structure_rejects_all &= not structure_ok(malformed)
    gate("W4_SWEEP_STRUCTURE_MODEL_REJECTS_ALL_MALFORMED_BINS", structure_rejects_all)
    gate("W4_SWEEP_SEGMENT_MODEL_ALL_16_MONOTONIC", segments_ok and cadence_ok and
         len(demands) == LEVELS and monotonic_steps == LEVELS - 1 and
         demands[-1] * 2 >= demands[0] * 5)
    skipped_level = replace_plateau(bins, 7, 6)
    _, _, _, skipped_steps = assess_segments(skipped_level)
    direct_jump = list(bins)
    for level in range(1, LEVELS):
        direct_jump = replace_plateau(direct_jump, level, LEVELS - 1)
    _, _, _, direct_steps = assess_segments(direct_jump)
    gate("W4_SWEEP_SEGMENT_MODEL_REJECTS_SKIPPED_OR_DIRECT_JUMP",
         skipped_steps != LEVELS - 1 and direct_steps != LEVELS - 1)
    zero_plateau = list(bins)
    zero_start = 5 * BINS_PER_LEVEL + TRANSITION_BINS
    for index in range(zero_start, zero_start + PLATEAU_BINS):
        row = zero_plateau[index]
        zero_plateau[index] = (row[0], row[1], row[2], 0, 0, row[5])
    zero_segments_ok, _, _, _ = assess_segments(zero_plateau)
    gate("W4_SWEEP_FIXED_DURATION_MODEL_REJECTS_ZERO_PLATEAU", not zero_segments_ok)
    unstable_plateau = list(bins)
    unstable_start = 8 * BINS_PER_LEVEL + TRANSITION_BINS
    for index in range(unstable_start + PLATEAU_BINS // 2,
                       unstable_start + PLATEAU_BINS):
        row = unstable_plateau[index]
        unstable_plateau[index] = (
            row[0], row[1], row[2], row[3] * 11 // 10, row[4], row[5]
        )
    unstable_segments_ok, _, _, _ = assess_segments(unstable_plateau)
    gate(
        "W4_SWEEP_STABILITY_MODEL_REJECTS_GT_3PCT_HALF_DRIFT",
        not unstable_segments_ok and structure_ok(unstable_plateau),
    )
    bad_tick = list(bins)
    bad_tick[301] = (*bad_tick[301][:5], 8999)
    _, bad_cadence_ok, _, _ = assess_segments(bad_tick)
    gate("W4_SWEEP_CADENCE_MODEL_REJECTS_OUT_OF_RANGE_BIN", not bad_cadence_ok)
    print("SOL_W4_SWEEP_STATIC_MODEL_PASS=TRUE")


if __name__ == "__main__":
    main()
