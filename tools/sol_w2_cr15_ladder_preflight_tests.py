#!/usr/bin/env python3
"""Static contract checks for the W1->W2 real CR15 one-shot ladder."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LADDER = (ROOT / "tools" / "stage6_cr15_real_ladder.js").read_text(encoding="utf-8")
NOPOWER_LADDER = (ROOT / "tools" / "stage6_cr15_timing_nopower_ladder_all.js").read_text(encoding="utf-8")
SHOT = (ROOT / "app" / "shot.c").read_text(encoding="utf-8")
CADENCE = (ROOT / "tools" / "sol_w1_adc_cadence_nopower.js").read_text(encoding="utf-8")


def require(text: str, source: str) -> None:
    if text not in source:
        raise AssertionError(f"missing required contract: {text}")


def main() -> None:
    # Physical authorization is checked before DebugServer/session creation.
    human_gate = LADDER.index("if(!perm || !op || !ilim || !cr15 || !vin24)")
    debug_open = LADDER.index("ScriptingEnvironment.instance()")
    assert human_gate < debug_open

    # The exact one-way order and stop-on-first-failure behavior remain fixed.
    assert LADDER.index('label:"2MS"') < LADDER.index('label:"10MS"') < LADDER.index('label:"100MS"')
    require('throw "real-fail-"+cfg.label', LADDER)
    require("W1_ADC_FRESHNESS_FIXED", LADDER)
    require("W2_CR15_10V_CONTINUOUS_PFM_100MS_PASS", LADDER)

    # W2's explicit 100 ms evidence requirements are hard gates, not prints.
    for token in (
        "100MS_STATS_COUNTS_MATCH",
        "100MS_VOUT_AVG_RAW_1182_1306",
        "100MS_VOUT_NOT_SUSTAINED_ONE_WAY_RISE",
        "100MS_TBPRD_WITHIN_352_413",
        "100MS_PI_INTEGRAL_WITHIN_CLAMPS",
        "LAST50_FMAX_COUNT=",
        "active_envelope min_cmd_hz=",
        "adc_sequence first=",
    ):
        require(token, LADDER)
    require("var normalLimit = 900", LADDER)
    assert '(cfg.label==="100MS") ? 900 : 850' not in LADDER
    require('(cfg.label==="100MS") ? 900 : 850', NOPOWER_LADDER)
    require("lastSeq>firstSeq", LADDER)
    require("fc>0 && pc>0 && ac>0 && pw>0", LADDER)
    require("minCmd>=145000 && maxCmd<=170000", LADDER)
    require("firstTbprd>=352 && firstTbprd<=413", LADDER)
    require("finalTbprd>=352 && finalTbprd<=413", LADDER)

    # Telemetry is passive and restricted to the >=100 ms real-shot build.
    require("FIRST_REAL_PI_DURATION_CYCLES >= 6000000UL", SHOT)
    require("g_timing_last50_tbprd_sum += tbprd", SHOT)
    require("g_timing_last50_pi_hz_sum += (g_pi_integral_q12 >> 12)", SHOT)
    require("if (tbprd == 352U) g_timing_last50_fmax_count++", SHOT)
    require("g_timing_last50_sample_phase >= 8U", SHOT)

    # The real-cadence diagnostic starts ACTIVE counters at its own boundary
    # and makes its W1 acceptance conditions fatal on failure.
    require('wv32("g_adc_ovf_active_count", 0)', CADENCE)
    require("fresh !== piCompute", CADENCE)
    require("SOL_W1_CONTINUOUS_OVERLAP_TELEMETRY_ONLY", CADENCE)
    require("SOL_W1_ADC_CADENCE_NOPOWER_HARD_GATES_PASS", CADENCE)
    require('getenv("SOL_W1_RUN_MS")', CADENCE)
    require('getenv("SOL_W1_VREF_RAW")', CADENCE)
    require("SOL_W2_100MS_TELEMETRY_NOPOWER_HARD_GATES_PASS", CADENCE)

    print("SOL_W2_CR15_LADDER_PREFLIGHT_TESTS_PASS")


if __name__ == "__main__":
    main()
