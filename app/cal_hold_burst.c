/*
 * cal_hold_burst.c
 *
 * PROFILE_C_CAL_HOLD_BURST_V1 — see cal_hold_burst.h.
 *
 * Size-optimized for the 10KB-RAM F28034 bring-up image: statistics live in
 * one struct (single reset), each recharge packet reuses the proven comparator
 * settle/pre-start gate, and the packet ISR skips IIR filtering (only the
 * fresh PWM-sync raw is needed for its target/hard-limit judgment).
 */

#include "DSP2803x_Device.h"
#include "DSP2803x_Examples.h"
#include "llc_config.h"
#include "llc_globals.h"
#include "pwm.h"
#include "adc.h"
#include "comparator.h"
#include "cal_hold_burst.h"

/* Hold statistics packed so one struct write resets everything. */
typedef struct
{
    Uint16 raw;
    Uint16 min;
    Uint16 max;
    Uint32 sum;
    Uint32 samples;
    Uint16 steady_min;
    Uint16 steady_max;
    Uint32 steady_sum;
    Uint32 steady_samples;
    Uint32 packets;
    Uint32 total_cycles;
    Uint16 packet_min_cycles;
    Uint16 packet_max_cycles;
    Uint32 packet_cycles_sum;
} cal_hold_stats_t;

static cal_hold_stats_t s_stats;
static void CALHOLD_StatsPublish(void);
#pragma DATA_SECTION(s_cal_hold_mode, "ol_ram");
static Uint16 s_cal_hold_mode = CAL_HOLD_MODE_LEGACY_11V;
#pragma DATA_SECTION(s_w3_packet_write_auth, "ol_ram");
static Uint16 s_w3_packet_write_auth = 0U;
/* Private one-shot W4 authorization and immutable direction. Zero means no
 * W4 session; the CCS-visible observer telemetry is never an authorization
 * surface for the longer diagnostic envelope. */
#pragma DATA_SECTION(s_w4_trace_session_direction, "ol_ram");
static Uint16 s_w4_trace_session_direction = 0U;

/* W4 diagnostic observer. The three ring arrays live in roomy RAML3; all
 * control and protection variables remain separate. */
#pragma DATA_SECTION(g_w4_trace_ring_raw, "ol_ram");
volatile Uint16 g_w4_trace_ring_raw[W4_TRACE_SAMPLES];
#pragma DATA_SECTION(g_w4_trace_ring_cycle_delta, "ol_ram");
volatile Uint16 g_w4_trace_ring_cycle_delta[W4_TRACE_SAMPLES];
#pragma DATA_SECTION(g_w4_trace_ring_packet_delta, "ol_ram");
volatile Uint16 g_w4_trace_ring_packet_delta[W4_TRACE_SAMPLES];

#pragma DATA_SECTION(g_w4_trace_arm, "ol_ram");
volatile Uint16 g_w4_trace_arm = 0U;
#pragma DATA_SECTION(g_w4_trace_expected_direction, "ol_ram");
volatile Uint16 g_w4_trace_expected_direction = 0U;
#pragma DATA_SECTION(g_w4_trace_direction_active, "ol_ram");
volatile Uint16 g_w4_trace_direction_active = 0U;
#pragma DATA_SECTION(g_w4_trace_state, "ol_ram");
volatile Uint16 g_w4_trace_state = W4_TRACE_STATE_IDLE;
#pragma DATA_SECTION(g_w4_trace_fail_reason, "ol_ram");
volatile Uint16 g_w4_trace_fail_reason = W4_TRACE_FAIL_NONE;
#pragma DATA_SECTION(g_w4_trace_count, "ol_ram");
volatile Uint16 g_w4_trace_count = 0U;
#pragma DATA_SECTION(g_w4_trace_write_index, "ol_ram");
volatile Uint16 g_w4_trace_write_index = 0U;
#pragma DATA_SECTION(g_w4_trace_trigger_index, "ol_ram");
volatile Uint16 g_w4_trace_trigger_index = 0U;
#pragma DATA_SECTION(g_w4_trace_baseline_raw, "ol_ram");
volatile Uint16 g_w4_trace_baseline_raw = 0U;
#pragma DATA_SECTION(g_w4_trace_baseline_cycles_per_5ms, "ol_ram");
volatile Uint16 g_w4_trace_baseline_cycles_per_5ms = 0U;
#pragma DATA_SECTION(g_w4_trace_baseline_cycles_per_packet, "ol_ram");
volatile Uint16 g_w4_trace_baseline_cycles_per_packet = 0U;
#pragma DATA_SECTION(g_w4_trace_baseline_demand_index, "ol_ram");
volatile Uint32 g_w4_trace_baseline_demand_index = 0UL;
#pragma DATA_SECTION(g_w4_trace_trigger_raw, "ol_ram");
volatile Uint16 g_w4_trace_trigger_raw = 0U;
#pragma DATA_SECTION(g_w4_trace_trigger_cycles_20ms, "ol_ram");
volatile Uint16 g_w4_trace_trigger_cycles_20ms = 0U;
#pragma DATA_SECTION(g_w4_trace_trigger_packets_20ms, "ol_ram");
volatile Uint16 g_w4_trace_trigger_packets_20ms = 0U;
#pragma DATA_SECTION(g_w4_trace_trigger_cycles_per_packet, "ol_ram");
volatile Uint16 g_w4_trace_trigger_cycles_per_packet = 0U;
#pragma DATA_SECTION(g_w4_trace_trigger_demand_index, "ol_ram");
volatile Uint32 g_w4_trace_trigger_demand_index = 0UL;
#pragma DATA_SECTION(g_w4_trace_trigger_confirm_tick, "ol_ram");
volatile Uint32 g_w4_trace_trigger_confirm_tick = 0UL;
#pragma DATA_SECTION(g_w4_trace_operator_marker_tick, "ol_ram");
volatile Uint32 g_w4_trace_operator_marker_tick = 0UL;
#pragma DATA_SECTION(g_w4_trace_min_raw, "ol_ram");
volatile Uint16 g_w4_trace_min_raw = 0U;
#pragma DATA_SECTION(g_w4_trace_max_raw, "ol_ram");
volatile Uint16 g_w4_trace_max_raw = 0U;
#pragma DATA_SECTION(g_w4_trace_settle_ms, "ol_ram");
volatile Uint16 g_w4_trace_settle_ms = 0U;
#pragma DATA_SECTION(g_w4_trace_peak_pass, "ol_ram");
volatile Uint16 g_w4_trace_peak_pass = 0U;
#pragma DATA_SECTION(g_w4_trace_settle_pass, "ol_ram");
volatile Uint16 g_w4_trace_settle_pass = 0U;
#pragma DATA_SECTION(g_w4_trace_quality_pass, "ol_ram");
volatile Uint16 g_w4_trace_quality_pass = 0U;
#pragma DATA_SECTION(g_w4_trace_terminal_cookie, "ol_ram");
volatile Uint32 g_w4_trace_terminal_cookie = 0UL;
#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
#pragma DATA_SECTION(g_w4_trace_ne_cycle_delta, "ol_ram");
volatile Uint16 g_w4_trace_ne_cycle_delta = 0U;
#pragma DATA_SECTION(g_w4_trace_ne_packet_delta, "ol_ram");
volatile Uint16 g_w4_trace_ne_packet_delta = 0U;
#endif

#pragma DATA_SECTION(s_w4_trace_cycle_clock, "ol_ram");
static volatile Uint16 s_w4_trace_cycle_clock = 0U;
#pragma DATA_SECTION(s_w4_trace_packet_clock, "ol_ram");
static volatile Uint16 s_w4_trace_packet_clock = 0U;
#pragma DATA_SECTION(s_w4_trace_last_cycle_clock, "ol_ram");
static Uint16 s_w4_trace_last_cycle_clock = 0U;
#pragma DATA_SECTION(s_w4_trace_last_packet_clock, "ol_ram");
static Uint16 s_w4_trace_last_packet_clock = 0U;
#pragma DATA_SECTION(s_w4_trace_baseline_count, "ol_ram");
static Uint16 s_w4_trace_baseline_count = 0U;
#pragma DATA_SECTION(s_w4_trace_post_remaining, "ol_ram");
static Uint16 s_w4_trace_post_remaining = 0U;
#pragma DATA_SECTION(s_w4_trace_baseline_raw_sum, "ol_ram");
static Uint32 s_w4_trace_baseline_raw_sum = 0UL;
#pragma DATA_SECTION(s_w4_trace_baseline_cycle_sum, "ol_ram");
static Uint32 s_w4_trace_baseline_cycle_sum = 0UL;
#pragma DATA_SECTION(s_w4_trace_baseline_packet_sum, "ol_ram");
static Uint32 s_w4_trace_baseline_packet_sum = 0UL;

Uint16 CALHOLD_W3PacketAuthOk(void)
{
    return (s_w3_packet_write_auth != 0U &&
            (s_cal_hold_mode == CAL_HOLD_MODE_LEGACY_11V ||
             s_cal_hold_mode == CAL_HOLD_MODE_W3_10V) &&
            g_cal_hold_state == CAL_HOLD_OFF &&
            g_cal_hold_packet_active == 0U &&
            g_bringup_stage == BRINGUP_STAGE_5A_OPEN_LOOP_MANUAL &&
            g_system_state == SYS_STATE_IDLE &&
            g_pwm_enable_request == 0U &&
            g_comp_tz_loopback_verified != 0U &&
            g_comp_inject_test_armed != 0U &&
            g_comp_prestart_reject == 0U &&
            g_comp_prestart_gpio15 != 0U &&
            GpioDataRegs.GPADAT.bit.GPIO15 != 0U &&
            g_fault_flags == 0UL &&
            g_pwm_enabled == 0U &&
            EPwm1Regs.TZFLG.bit.OST != 0U) ? 1U : 0U;
}

Uint16 CALHOLD_W3PacketRampAuthOk(void)
{
    Uint16 output_state_ok;
#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    if (g_no_energy_test_mode != 0U)
        output_state_ok = (g_pwm_enabled == 0U &&
                           EPwm1Regs.TZFLG.bit.OST != 0U) ? 1U : 0U;
    else
#endif
        output_state_ok = (g_pwm_enabled != 0U &&
                           EPwm1Regs.TZFLG.bit.OST == 0U) ? 1U : 0U;

    return (s_w3_packet_write_auth != 0U &&
            s_cal_hold_mode == CAL_HOLD_MODE_W3_10V &&
            g_cal_hold_state == CAL_HOLD_PACKET &&
            g_cal_hold_packet_active != 0U &&
            g_bringup_stage == BRINGUP_STAGE_5A_OPEN_LOOP_MANUAL &&
            g_system_state == SYS_STATE_IDLE &&
            g_pwm_enable_request == 0U &&
            g_comp_tz_loopback_verified != 0U &&
            g_comp_inject_test_armed != 0U &&
            GpioDataRegs.GPADAT.bit.GPIO15 != 0U &&
            g_fault_flags == 0UL && output_state_ok != 0U) ? 1U : 0U;
}

static Uint16 CALHOLD_RechargeLowRaw(void)
{
    return (s_cal_hold_mode == CAL_HOLD_MODE_W3_10V)
        ? W3_HOLD_RECHARGE_LOW_RAW : CAL_HOLD_RECHARGE_LOW_RAW;
}

static Uint16 CALHOLD_RechargeTargetRaw(void)
{
    return (s_cal_hold_mode == CAL_HOLD_MODE_W3_10V)
        ? W3_HOLD_RECHARGE_TARGET_RAW : CAL_HOLD_RECHARGE_TARGET_RAW;
}

static Uint16 CALHOLD_HardLimitRaw(void)
{
    return (s_cal_hold_mode == CAL_HOLD_MODE_W3_10V)
        ? W3_HOLD_HARD_LIMIT_RAW : CAL_HOLD_HARD_LIMIT_RAW;
}

static Uint16 CALHOLD_DiagLowRaw(void)
{
    return (s_cal_hold_mode == CAL_HOLD_MODE_W3_10V)
        ? W3_HOLD_DIAG_LOW_ABORT_RAW : CAL_HOLD_DIAG_LOW_ABORT_RAW;
}

static Uint16 CALHOLD_MaxPacketCycles(void)
{
    return (s_cal_hold_mode == CAL_HOLD_MODE_W3_10V)
        ? W3_HOLD_MAX_PACKET_CYCLES : CAL_HOLD_MAX_PACKET_CYCLES;
}

static Uint16 CALHOLD_RequestValid(Uint16 mode, Uint16 duration)
{
    if (mode == CAL_HOLD_MODE_LEGACY_11V)
        return (duration == 100U || duration == 1000U) ? 1U : 0U;
    if (mode == CAL_HOLD_MODE_W3_10V)
        return (duration == W3_HOLD_DURATION_500MS ||
                duration == W3_HOLD_DURATION_2S ||
                duration == W3_HOLD_DURATION_10S ||
                duration == W3_HOLD_DURATION_60S) ? 1U : 0U;
    return 0U;
}

static Uint32 CALHOLD_CycleCap(void)
{
    if (s_w4_trace_session_direction != 0U)
    {
        Uint32 trace_ticks = g_cal_hold_elapsed_ticks;
        if (trace_ticks < W4_TRACE_MIN_HOLD_TICKS)
            trace_ticks = W4_TRACE_MIN_HOLD_TICKS;
        if (trace_ticks > W4_TRACE_MAX_HOLD_TICKS)
            trace_ticks = W4_TRACE_MAX_HOLD_TICKS;
        /* 250 kHz packet cycles / 50 kHz fast ticks = 5. Retain the
         * previously qualified 50% aggregate active-time ceiling. */
        return (trace_ticks * 5UL) / 2UL;
    }
    if (s_cal_hold_mode == CAL_HOLD_MODE_W3_10V)
    {
        if (g_cal_hold_duration_ms == W3_HOLD_DURATION_500MS)
            return W3_HOLD_CYCLE_CAP_500MS;
        if (g_cal_hold_duration_ms == W3_HOLD_DURATION_2S)
            return W3_HOLD_CYCLE_CAP_2S;
        if (g_cal_hold_duration_ms == W3_HOLD_DURATION_10S)
            return W3_HOLD_CYCLE_CAP_10S;
        return W3_HOLD_CYCLE_CAP_60S;
    }
    if (g_cal_measure_active != 0U)
        return CAL_HOLD_MAX_TOTAL_PACKET_CYCLES_MEASURE;
    return (g_cal_hold_duration_ms == 1000U)
        ? CAL_HOLD_MAX_TOTAL_PACKET_CYCLES_1S
        : CAL_HOLD_MAX_TOTAL_PACKET_CYCLES_100MS;
}

static Uint16 CALHOLD_ReadOffRaw(void)
{
#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    if (g_no_energy_test_mode != 0U) return g_cal_hold_ne_raw;
#endif
    return (Uint16)AdcResult.ADCRESULT0;
}

static void CALHOLD_StatsReset(void)
{
    cal_hold_stats_t zero;
    zero.raw = 0U; zero.min = 0xFFFFU; zero.max = 0U;
    zero.sum = 0UL; zero.samples = 0UL;
    zero.steady_min = 0xFFFFU; zero.steady_max = 0U;
    zero.steady_sum = 0UL; zero.steady_samples = 0UL;
    zero.packets = 0UL; zero.total_cycles = 0UL;
    zero.packet_min_cycles = 0xFFFFU; zero.packet_max_cycles = 0U;
    zero.packet_cycles_sum = 0UL;
    s_stats = zero;
    g_cal_hold_undersupply_low_samples = 0U;
    g_cal_hold_packet_start_raw = 0U;
    g_cal_hold_packet_stop_raw = 0U;
    g_cal_hold_packet_post_max_raw = 0U;
    g_cal_hold_packet_post_last_raw = 0U;
    g_cal_hold_packet_actual_cycles = 0UL;
}

/* Reset/consume the W4 observer arm. This function never changes PWM state or
 * a controller threshold. Invalid observer metadata only fails the observer. */
static void CALHOLD_W4TraceReset(Uint16 requested_mode,
                                 Uint16 requested_duration)
{
    Uint16 arm = g_w4_trace_arm;
    Uint16 requested = g_w4_trace_expected_direction;

    /* Clear the prior commit before touching this new armed attempt. */
    if (arm != 0U) g_w4_trace_terminal_cookie = 0UL;
    s_w4_trace_session_direction = 0U;
    g_w4_trace_direction_active = 0U;
    g_w4_trace_state = W4_TRACE_STATE_IDLE;
    g_w4_trace_fail_reason = W4_TRACE_FAIL_NONE;
    g_w4_trace_count = 0U;
    g_w4_trace_write_index = 0U;
    g_w4_trace_trigger_index = 0U;
    g_w4_trace_baseline_raw = 0U;
    g_w4_trace_baseline_cycles_per_5ms = 0U;
    g_w4_trace_baseline_cycles_per_packet = 0U;
    g_w4_trace_baseline_demand_index = 0UL;
    g_w4_trace_trigger_raw = 0U;
    g_w4_trace_trigger_cycles_20ms = 0U;
    g_w4_trace_trigger_packets_20ms = 0U;
    g_w4_trace_trigger_cycles_per_packet = 0U;
    g_w4_trace_trigger_demand_index = 0UL;
    g_w4_trace_trigger_confirm_tick = 0UL;
    g_w4_trace_operator_marker_tick = 0UL;
    g_w4_trace_min_raw = 0U;
    g_w4_trace_max_raw = 0U;
    g_w4_trace_settle_ms = 0U;
    g_w4_trace_peak_pass = 0U;
    g_w4_trace_settle_pass = 0U;
    g_w4_trace_quality_pass = 0U;
    s_w4_trace_last_cycle_clock = s_w4_trace_cycle_clock;
    s_w4_trace_last_packet_clock = s_w4_trace_packet_clock;
    s_w4_trace_baseline_count = 0U;
    s_w4_trace_post_remaining = 0U;
    s_w4_trace_baseline_raw_sum = 0UL;
    s_w4_trace_baseline_cycle_sum = 0UL;
    s_w4_trace_baseline_packet_sum = 0UL;
#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    g_w4_trace_ne_cycle_delta = 0U;
    g_w4_trace_ne_packet_delta = 0U;
#endif

    if (arm == 0U) return;
    g_w4_trace_arm = 0U;  /* one-shot consume; cannot retrigger during power */
    if (arm != W4_TRACE_ARM_REQUEST ||
        requested_mode != CAL_HOLD_MODE_W3_10V ||
        requested_duration != W3_HOLD_DURATION_60S)
    {
        g_w4_trace_state = W4_TRACE_STATE_FAIL;
        g_w4_trace_fail_reason = W4_TRACE_FAIL_BAD_SESSION;
        return;
    }
    if (requested != W4_TRACE_DIRECTION_HEAVIER &&
        requested != W4_TRACE_DIRECTION_LIGHTER)
    {
        g_w4_trace_state = W4_TRACE_STATE_FAIL;
        g_w4_trace_fail_reason = W4_TRACE_FAIL_BAD_DIRECTION;
        return;
    }
    s_w4_trace_session_direction = requested;
    g_w4_trace_direction_active = requested;
    g_w4_trace_state = W4_TRACE_STATE_WAIT_BASELINE;
}

/* Store one 5 ms sample and return its physical ring index. */
static Uint16 CALHOLD_W4TraceStore(Uint16 raw, Uint16 cycle_delta,
                                  Uint16 packet_delta)
{
    Uint16 index = g_w4_trace_write_index;
    g_w4_trace_ring_raw[index] = raw;
    g_w4_trace_ring_cycle_delta[index] = cycle_delta;
    g_w4_trace_ring_packet_delta[index] = packet_delta;
    g_w4_trace_write_index = (Uint16)((index + 1U) &
                                      (W4_TRACE_SAMPLES - 1U));
    if (g_w4_trace_count < W4_TRACE_SAMPLES) g_w4_trace_count++;
    return index;
}

/* Publish the current 200 ms reference sums. The same helper is used for the
 * initial seed and each sliding pre-candidate reference, keeping threshold
 * arithmetic identical. A zero-demand reference fails only the observer. */
static Uint16 CALHOLD_W4TracePublishBaseline(void)
{
    if (s_w4_trace_baseline_cycle_sum == 0UL ||
        s_w4_trace_baseline_packet_sum == 0UL)
    {
        g_w4_trace_state = W4_TRACE_STATE_FAIL;
        g_w4_trace_fail_reason = W4_TRACE_FAIL_ZERO_BASELINE;
        return 0U;
    }
    g_w4_trace_baseline_raw = (Uint16)
        (s_w4_trace_baseline_raw_sum / W4_TRACE_BASELINE_SAMPLES);
    g_w4_trace_baseline_cycles_per_5ms = (Uint16)
        (s_w4_trace_baseline_cycle_sum / W4_TRACE_BASELINE_SAMPLES);
    g_w4_trace_baseline_cycles_per_packet = (Uint16)
        (s_w4_trace_baseline_cycle_sum /
         s_w4_trace_baseline_packet_sum);
    g_w4_trace_baseline_demand_index =
        ((Uint32)g_w4_trace_baseline_cycles_per_5ms *
         g_w4_trace_baseline_cycles_per_packet) >> 1;
    return 1U;
}

/* Freeze extrema and 20 ms moving-average settling from the detected step.
 * Instantaneous samples own the +/-5% peak gate; the 4-sample average removes
 * normal protected-Burst ripple from the +/-2% settling judgment. */
static void CALHOLD_W4TraceFinalize(void)
{
    Uint16 i;
    Uint16 j;
    Uint16 index = g_w4_trace_trigger_index;
    Uint16 min_raw = 0xFFFFU;
    Uint16 max_raw = 0U;
    Uint16 last_out = 0U;
    Uint16 out_seen = 0U;

    for (i = 0U; i < W4_TRACE_EVAL_SAMPLES; i++)
    {
        Uint16 raw = g_w4_trace_ring_raw[index];
        if (raw < min_raw) min_raw = raw;
        if (raw > max_raw) max_raw = raw;
        if (i >= (W4_TRACE_DETECT_BLOCK_SAMPLES - 1U))
        {
            Uint32 sum = 0UL;
            Uint16 back = index;
            for (j = 0U; j < W4_TRACE_DETECT_BLOCK_SAMPLES; j++)
            {
                sum += g_w4_trace_ring_raw[back];
                back = (Uint16)((back - 1U) & (W4_TRACE_SAMPLES - 1U));
            }
            raw = (Uint16)(sum >> 2);
            if (raw < W4_TRACE_2PCT_LOW_RAW ||
                raw > W4_TRACE_2PCT_HIGH_RAW)
            {
                last_out = i;
                out_seen = 1U;
            }
        }
        index = (Uint16)((index + 1U) & (W4_TRACE_SAMPLES - 1U));
    }

    g_w4_trace_min_raw = min_raw;
    g_w4_trace_max_raw = max_raw;
    g_w4_trace_settle_ms = (out_seen != 0U)
        ? (Uint16)((last_out + 1U) * W4_TRACE_SAMPLE_MS) : 0U;
    g_w4_trace_peak_pass =
        (min_raw >= W4_TRACE_5PCT_LOW_RAW &&
         max_raw <= W4_TRACE_5PCT_HIGH_RAW) ? 1U : 0U;
    g_w4_trace_settle_pass =
        (g_w4_trace_settle_ms <= W4_TRACE_SETTLE_LIMIT_MS) ? 1U : 0U;
    g_w4_trace_quality_pass =
        (g_w4_trace_peak_pass != 0U &&
         g_w4_trace_settle_pass != 0U) ? 1U : 0U;
    g_w4_trace_state = W4_TRACE_STATE_COMPLETE;
}

/* Passive 5 ms observer. Three consecutive 20 ms demand blocks must differ by
 * >=12.5% in the requested direction before a step is accepted. */
static void CALHOLD_W4TraceSample(void)
{
    Uint16 cycle_clock;
    Uint16 packet_clock;
    Uint16 cycle_delta;
    Uint16 packet_delta;
    Uint16 raw;
    Uint16 index;
    Uint16 i;
    Uint16 ref_index;
    Uint16 b1_index;
    Uint16 b2_index;
    Uint16 b3_index;
    Uint16 changed = 0U;
    Uint16 b1_cycles_per_5ms;
    Uint16 b1_cycles_per_packet;
    Uint16 b2_cycles_per_5ms;
    Uint16 b2_cycles_per_packet;
    Uint16 b3_cycles_per_5ms;
    Uint16 b3_cycles_per_packet;
    Uint32 b1_cycle_sum = 0UL;
    Uint32 b1_packet_sum = 0UL;
    Uint32 b2_cycle_sum = 0UL;
    Uint32 b2_packet_sum = 0UL;
    Uint32 b3_cycle_sum = 0UL;
    Uint32 b3_packet_sum = 0UL;
    Uint32 b1_demand_index;
    Uint32 b2_demand_index;
    Uint32 b3_demand_index;

    if (g_w4_trace_state == W4_TRACE_STATE_IDLE ||
        g_w4_trace_state == W4_TRACE_STATE_COMPLETE ||
        g_w4_trace_state == W4_TRACE_STATE_FAIL) return;
    if (g_w4_trace_state == W4_TRACE_STATE_WAIT_BASELINE)
    {
        if (g_cal_hold_elapsed_ticks < W4_TRACE_BASELINE_START_TICKS) return;
        s_w4_trace_last_cycle_clock = s_w4_trace_cycle_clock;
        s_w4_trace_last_packet_clock = s_w4_trace_packet_clock;
        g_w4_trace_state = W4_TRACE_STATE_BASELINE;
        return;
    }

    cycle_clock = s_w4_trace_cycle_clock;
    packet_clock = s_w4_trace_packet_clock;
    cycle_delta = (Uint16)(cycle_clock - s_w4_trace_last_cycle_clock);
    packet_delta = (Uint16)(packet_clock - s_w4_trace_last_packet_clock);
    s_w4_trace_last_cycle_clock = cycle_clock;
    s_w4_trace_last_packet_clock = packet_clock;
#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    if (g_no_energy_test_mode != 0U && g_w4_trace_ne_cycle_delta != 0U)
    {
        cycle_delta = g_w4_trace_ne_cycle_delta;
        packet_delta = g_w4_trace_ne_packet_delta;
    }
#endif
    /* OFF-mode sampling owns the hold and trace measurement.  Use its fresh
     * software-trigger result; g_adc_vout_raw is only guaranteed fresh while
     * a recharge packet is active. */
    raw = g_cal_hold_raw;
    index = CALHOLD_W4TraceStore(raw, cycle_delta, packet_delta);

    if (g_w4_trace_state == W4_TRACE_STATE_BASELINE)
    {
        s_w4_trace_baseline_raw_sum += raw;
        s_w4_trace_baseline_cycle_sum += cycle_delta;
        s_w4_trace_baseline_packet_sum += packet_delta;
        s_w4_trace_baseline_count++;
        if (s_w4_trace_baseline_count >= W4_TRACE_BASELINE_SAMPLES)
        {
            if (CALHOLD_W4TracePublishBaseline() != 0U)
                g_w4_trace_state = W4_TRACE_STATE_ARMED;
        }
        return;
    }

    if (g_w4_trace_state == W4_TRACE_STATE_ARMED)
    {
        /* Replace the nonstationary 0.5..0.7 s seed with the latest complete
         * 200 ms reference throughout warm-up.  At 10 s this reference is
         * frozen; subsequent manual adjustment cannot be tracked away. */
        if (g_cal_hold_elapsed_ticks < W4_TRACE_REFERENCE_FREEZE_TICKS)
        {
            if (g_w4_trace_count < W4_TRACE_BASELINE_SAMPLES) return;
            s_w4_trace_baseline_raw_sum = 0UL;
            s_w4_trace_baseline_cycle_sum = 0UL;
            s_w4_trace_baseline_packet_sum = 0UL;
            for (i = 0U; i < W4_TRACE_BASELINE_SAMPLES; i++)
            {
                ref_index = (Uint16)
                    ((index + W4_TRACE_SAMPLES -
                      (W4_TRACE_BASELINE_SAMPLES - 1U) + i) &
                     (W4_TRACE_SAMPLES - 1U));
                s_w4_trace_baseline_raw_sum +=
                    g_w4_trace_ring_raw[ref_index];
                s_w4_trace_baseline_cycle_sum +=
                    g_w4_trace_ring_cycle_delta[ref_index];
                s_w4_trace_baseline_packet_sum +=
                    g_w4_trace_ring_packet_delta[ref_index];
            }
            (void)CALHOLD_W4TracePublishBaseline();
            return;
        }

        /* The detector stays closed until the nominal 12 s host marker.  At
         * every later 5 ms phase compare B1=[i-11..i-8], B2=[i-7..i-4] and
         * B3=[i-3..i] with the frozen 10 s reference.  A single 20 ms demand
         * spike cannot satisfy all three blocks. */
        if (g_cal_hold_elapsed_ticks < W4_TRACE_DETECT_START_TICKS) return;
        if (g_w4_trace_operator_marker_tick == 0UL)
        {
            /* This target-clock marker, not host wall time, is the physical
             * coordination point.  Yellow-on is diagnostic only; it grants
             * no PWM authority and changes no controller/protection state. */
            g_w4_trace_operator_marker_tick = g_cal_hold_elapsed_ticks;
#if STAGE6_OPEN_LOOP_STEADY_BUILD && !STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
            GpioDataRegs.GPASET.bit.GPIO21 = 1U;
#endif
        }
        if (g_w4_trace_count < (W4_TRACE_DETECT_STREAK_BLOCKS *
                                W4_TRACE_DETECT_BLOCK_SAMPLES)) return;

        for (i = 0U; i < W4_TRACE_DETECT_BLOCK_SAMPLES; i++)
        {
            b1_index = (Uint16)
                ((index + W4_TRACE_SAMPLES -
                   ((W4_TRACE_DETECT_STREAK_BLOCKS *
                     W4_TRACE_DETECT_BLOCK_SAMPLES) - 1U) + i) &
                  (W4_TRACE_SAMPLES - 1U));
            b2_index = (Uint16)
                ((index + W4_TRACE_SAMPLES -
                   (((W4_TRACE_DETECT_STREAK_BLOCKS - 1U) *
                     W4_TRACE_DETECT_BLOCK_SAMPLES) - 1U) + i) &
                  (W4_TRACE_SAMPLES - 1U));
            b3_index = (Uint16)
                ((index + W4_TRACE_SAMPLES -
                   (W4_TRACE_DETECT_BLOCK_SAMPLES - 1U) + i) &
                  (W4_TRACE_SAMPLES - 1U));
            b1_cycle_sum += g_w4_trace_ring_cycle_delta[b1_index];
            b1_packet_sum += g_w4_trace_ring_packet_delta[b1_index];
            b2_cycle_sum += g_w4_trace_ring_cycle_delta[b2_index];
            b2_packet_sum += g_w4_trace_ring_packet_delta[b2_index];
            b3_cycle_sum += g_w4_trace_ring_cycle_delta[b3_index];
            b3_packet_sum += g_w4_trace_ring_packet_delta[b3_index];
        }
        if (b1_cycle_sum == 0UL || b1_packet_sum == 0UL ||
            b2_cycle_sum == 0UL || b2_packet_sum == 0UL ||
            b3_cycle_sum == 0UL || b3_packet_sum == 0UL) return;

        b1_cycles_per_5ms = (Uint16)
            (b1_cycle_sum / W4_TRACE_DETECT_BLOCK_SAMPLES);
        b1_cycles_per_packet = (Uint16)(b1_cycle_sum / b1_packet_sum);
        b1_demand_index = ((Uint32)b1_cycles_per_5ms *
                           b1_cycles_per_packet) >> 1;
        b2_cycles_per_5ms = (Uint16)
            (b2_cycle_sum / W4_TRACE_DETECT_BLOCK_SAMPLES);
        b2_cycles_per_packet = (Uint16)(b2_cycle_sum / b2_packet_sum);
        b2_demand_index = ((Uint32)b2_cycles_per_5ms *
                           b2_cycles_per_packet) >> 1;
        b3_cycles_per_5ms = (Uint16)
            (b3_cycle_sum / W4_TRACE_DETECT_BLOCK_SAMPLES);
        b3_cycles_per_packet = (Uint16)(b3_cycle_sum / b3_packet_sum);
        b3_demand_index = ((Uint32)b3_cycles_per_5ms *
                           b3_cycles_per_packet) >> 1;

        if (s_w4_trace_session_direction == W4_TRACE_DIRECTION_HEAVIER)
        {
            if ((b1_demand_index * 8UL) >=
                (g_w4_trace_baseline_demand_index * 9UL) &&
                (b2_demand_index * 8UL) >=
                    (g_w4_trace_baseline_demand_index * 9UL) &&
                (b3_demand_index * 8UL) >=
                    (g_w4_trace_baseline_demand_index * 9UL)) changed = 1U;
        }
        else if ((b1_demand_index * 8UL) <=
                     (g_w4_trace_baseline_demand_index * 7UL) &&
                 (b2_demand_index * 8UL) <=
                     (g_w4_trace_baseline_demand_index * 7UL) &&
                 (b3_demand_index * 8UL) <=
                     (g_w4_trace_baseline_demand_index * 7UL)) changed = 1U;

        if (changed != 0U)
        {
            g_w4_trace_trigger_index = (Uint16)
                ((index + W4_TRACE_SAMPLES -
                  ((W4_TRACE_DETECT_STREAK_BLOCKS *
                    W4_TRACE_DETECT_BLOCK_SAMPLES) - 1U)) &
                 (W4_TRACE_SAMPLES - 1U));
            g_w4_trace_trigger_raw =
                g_w4_trace_ring_raw[g_w4_trace_trigger_index];
            g_w4_trace_trigger_cycles_20ms = (Uint16)b3_cycle_sum;
            g_w4_trace_trigger_packets_20ms = (Uint16)b3_packet_sum;
            g_w4_trace_trigger_cycles_per_packet = b3_cycles_per_packet;
            g_w4_trace_trigger_demand_index = b3_demand_index;
            g_w4_trace_trigger_confirm_tick = g_cal_hold_elapsed_ticks;
            s_w4_trace_post_remaining = W4_TRACE_POST_SAMPLES;
            g_w4_trace_state = W4_TRACE_STATE_POST;
        }
        return;
    }

    if (g_w4_trace_state == W4_TRACE_STATE_POST)
    {
        if (s_w4_trace_post_remaining > 0U) s_w4_trace_post_remaining--;
        if (s_w4_trace_post_remaining == 0U) CALHOLD_W4TraceFinalize();
    }
}

static void CALHOLD_W4TraceEnd(void)
{
    if (g_w4_trace_state != W4_TRACE_STATE_IDLE &&
        g_w4_trace_state != W4_TRACE_STATE_COMPLETE &&
        g_w4_trace_state != W4_TRACE_STATE_FAIL)
    {
        g_w4_trace_state = W4_TRACE_STATE_FAIL;
        g_w4_trace_fail_reason = W4_TRACE_FAIL_NO_COMPLETE_WINDOW;
    }
}

/* V11: a W4 load-step capture always proves at least the original 60 s hold,
 * but it may wait up to 180 s for the operator step. Once the passive trace is
 * complete (or has failed closed) after 60 s, the firmware owns the terminal
 * OST immediately. Non-W4 W3 runs retain their exact requested duration. */
static Uint16 CALHOLD_DurationReached(Uint32 normal_limit)
{
    if (s_w4_trace_session_direction != 0U)
    {
        if (g_cal_hold_elapsed_ticks >= W4_TRACE_MAX_HOLD_TICKS) return 1U;
        if (g_cal_hold_elapsed_ticks < W4_TRACE_MIN_HOLD_TICKS) return 0U;
        return (Uint16)(g_w4_trace_state == W4_TRACE_STATE_COMPLETE ||
                        g_w4_trace_state == W4_TRACE_STATE_FAIL);
    }
    return (g_cal_hold_elapsed_ticks >= normal_limit) ? 1U : 0U;
}

/* One shared hard-stop sequence (OST force + EPWM1 INT off). */
static void CALHOLD_HardStop(void)
{
    EALLOW;
    EPwm1Regs.TZEINT.bit.OST = 0U;
    EPwm1Regs.TZFRC.bit.OST = 1U;
    EPwm1Regs.ETSEL.bit.INTEN = 0U;
    EDIS;
}

/* OFF-phase software ADC uses flag polling; the ADCINT1 ISR must not steal
 * the EOC flag between the fast-task ticks. */
static void CALHOLD_AdcPollMode(Uint16 enable)
{
    EALLOW;
    AdcRegs.INTSEL1N2.bit.INT1E = (enable != 0U) ? 0U : 1U;
    EDIS;
}

static void CALHOLD_BeginOff(Uint16 charge_stop_raw)
{
    g_cal_hold_charge_stop_raw = charge_stop_raw;
    CALHOLD_StatsReset();
    CALHOLD_StatsPublish();
    g_cal_hold_hard_limit_events = 0U;
    g_cal_hold_elapsed_ticks = 0UL;
    g_cal_hold_hold_active_ticks = 0UL;
    g_cal_hold_off_ticks = CAL_HOLD_OFF_MIN_TICKS;
    g_cal_hold_cal_raw_min = 0xFFFFU;
    g_cal_hold_cal_raw_max = 0U;
    g_cal_hold_cal_raw_sum = 0UL;
    g_cal_hold_cal_raw_samples = 0UL;
    g_cal_hold_cal_raw_avg = 0U;
    CALHOLD_AdcPollMode(1U);
    ADC_SetSoftwareTriggerMode();
    g_cal_hold_state = CAL_HOLD_OFF;
    g_cal_hold_packet_active = 0U;
    g_pwm_enabled = 0U;
    g_pwm_enable_result = 0U;
}

/* Freeze final status + run-id chain. */
static void CALHOLD_FreezeFinal(void)
{
    g_cal_hold_final_pwm = g_pwm_enabled;
    g_cal_hold_final_ost = EPwm1Regs.TZFLG.bit.OST;
    g_cal_hold_run_id_at_stop = g_test_run_id;
    g_cal_hold_run_id_at_tz_isr = g_test_run_id_at_tz_isr;
}

/* Single terminal transition (COMPLETE or ABORT). */
static void CALHOLD_End(Uint16 state, Uint16 reason)
{
    Uint16 w4_direction = s_w4_trace_session_direction;
#if STAGE6_OPEN_LOOP_STEADY_BUILD && !STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    Uint16 w4_terminal;
#endif
    if (g_cal_hold_state == CAL_HOLD_ABORT ||
        g_cal_hold_state == CAL_HOLD_COMPLETE) return;
#if STAGE6_OPEN_LOOP_STEADY_BUILD && !STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    w4_terminal = (w4_direction != 0U) ? 1U : 0U;
#endif
    CALHOLD_HardStop();
    CALHOLD_AdcPollMode(0U);
    g_cal_hold_packet_active = 0U;
    g_pwm_enabled = 0U;
    g_pwm_enable_result = 0U;
    g_cal_measure_active = 0U;
    CALHOLD_W4TraceEnd();
    CALHOLD_StatsPublish();
    if (g_cal_hold_cal_raw_samples > 0UL)
        g_cal_hold_cal_raw_avg =
            (Uint16)(g_cal_hold_cal_raw_sum / g_cal_hold_cal_raw_samples);
    g_cal_hold_state = state;
    g_cal_hold_stop_reason = reason;
    CALHOLD_FreezeFinal();
    s_w4_trace_session_direction = 0U; /* consume private terminal latch */
#if STAGE6_OPEN_LOOP_STEADY_BUILD && !STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    if (w4_terminal != 0U)
    {
        /* Same active-high diagnostic LEDs as the verified tutorial:
         * red+yellow on and green off persistently mean autonomous safe
         * terminal reached. Pass/fail still comes only from frozen evidence. */
        GpioDataRegs.GPACLEAR.bit.GPIO24 = 1U;
        GpioDataRegs.GPASET.bit.GPIO20 = 1U;
        GpioDataRegs.GPASET.bit.GPIO21 = 1U;
    }
#endif
    if (w4_direction != 0U)
    {
        /* Commit marker is the final public W4 evidence write. A debugger
         * reconnect can distinguish this terminal snapshot from stale RAM or
         * a target stopped before CALHOLD_End completed. */
        g_w4_trace_terminal_cookie =
            W4_TRACE_TERMINAL_COOKIE_BASE ^
            W4_TRACE_LOAD_PROFILE_ID ^
            W4_TRACE_ALGORITHM_ID ^
            g_cal_hold_run_id_at_stop ^
            ((Uint32)w4_direction << 16) ^
            ((Uint32)state << 8) ^
            (Uint32)reason;
    }
#if STAGE6_OPEN_LOOP_STEADY_BUILD && !STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    /* W4 REAL only: wake DSS after hardware and all terminal evidence are
     * already frozen. If ESTOP0 cannot halt because the debug link vanished,
     * the terminal spin still prevents any return to control code. The NE
     * image compiles all three instructions out. */
    if (w4_terminal != 0U)
    {
        DINT;
        ESTOP0;
        for (;;) { }
    }
#endif
}

/* Record one software-trigger VOUT sample (OFF phase). */
static void CALHOLD_RecordRaw(Uint16 raw)
{
    Uint32 elapsed_ms = g_cal_hold_elapsed_ticks / 50UL;
    Uint16 accumulate =
        (s_w4_trace_session_direction == 0U ||
         s_stats.samples < W4_TRACE_STATS_MAX_ACCUM_SAMPLES) ? 1U : 0U;

    s_stats.raw = raw;
    if (raw < s_stats.min) s_stats.min = raw;
    if (raw > s_stats.max) s_stats.max = raw;
    if (accumulate != 0U)
    {
        s_stats.sum += raw;
        s_stats.samples++;
    }

    if (elapsed_ms >= CAL_HOLD_SETTLING_MS)
    {
        if (raw < s_stats.steady_min) s_stats.steady_min = raw;
        if (raw > s_stats.steady_max) s_stats.steady_max = raw;
        if (accumulate != 0U)
        {
            s_stats.steady_sum += raw;
            s_stats.steady_samples++;
        }
    }

    /* Calibration window: 200ms..duration — the true ADC_HOLD_RAW source. */
    if (elapsed_ms >= CAL_HOLD_CAL_SETTLING_MS)
    {
        if (raw < g_cal_hold_cal_raw_min) g_cal_hold_cal_raw_min = raw;
        if (raw > g_cal_hold_cal_raw_max) g_cal_hold_cal_raw_max = raw;
        if (accumulate != 0U)
        {
            g_cal_hold_cal_raw_sum += raw;
            g_cal_hold_cal_raw_samples++;
        }
    }

    g_cal_hold_raw = raw;
}

/* Publish statistics to the CCS-visible globals. */
static void CALHOLD_StatsPublish(void)
{
    g_cal_hold_min = s_stats.min;
    g_cal_hold_max = s_stats.max;
    g_cal_hold_sum = s_stats.sum;
    g_cal_hold_samples = s_stats.samples;
    g_cal_hold_steady_min = s_stats.steady_min;
    g_cal_hold_steady_max = s_stats.steady_max;
    g_cal_hold_steady_sum = s_stats.steady_sum;
    g_cal_hold_steady_samples = s_stats.steady_samples;
    g_cal_hold_packet_count = s_stats.packets;
    g_cal_hold_total_packet_cycles = s_stats.total_cycles;
    g_cal_hold_packet_min_cycles = s_stats.packet_min_cycles;
    g_cal_hold_packet_max_cycles = s_stats.packet_max_cycles;
    g_cal_hold_packet_cycles_sum = s_stats.packet_cycles_sum;
}

/* Recharge packet termination. */
static void CALHOLD_StopPacket(Uint16 hard_limit_flag)
{
    Uint16 cycles = g_cal_hold_packet_cycles;

    CALHOLD_HardStop();
    ADC_SetSoftwareTriggerMode();
    CALHOLD_AdcPollMode(1U);

    s_stats.packets++;
    s_w4_trace_packet_clock++;
    s_stats.total_cycles += cycles;
    s_stats.packet_cycles_sum += cycles;
    if (cycles < s_stats.packet_min_cycles) s_stats.packet_min_cycles = cycles;
    if (cycles > s_stats.packet_max_cycles) s_stats.packet_max_cycles = cycles;
    g_cal_hold_packet_stop_raw = g_cal_hold_packet_post_last_raw;
    g_cal_hold_packet_actual_cycles = (Uint32)cycles;

    g_cal_hold_state = CAL_HOLD_OFF;
    g_cal_hold_packet_active = 0U;
    g_cal_hold_off_ticks = 0UL;
    g_pwm_enabled = 0U;          /* PWM hardware is off (OST latched) */
    g_pwm_enable_result = 0U;

    if (hard_limit_flag != 0U)
    {
        g_cal_hold_hard_limit_events++;
        CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_HARD_LIMIT);
    }
}

/* Per-cycle packet logic (EPWM1_INT_ISR). */
void CALHOLD_PacketIsr(void)
{
    Uint16 fresh = 0U;
    Uint16 raw = 0U;
    Uint16 next_db;
    Uint16 write_ok;

    if (g_fault_flags != 0UL || g_system_state == SYS_STATE_FAULT)
    {
        CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_ACTIVE_TZ);
        return;
    }

    g_cal_hold_packet_cycles++;
    g_cal_hold_total_packet_cycles++;
    s_w4_trace_cycle_clock++;

#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    if (g_no_energy_test_mode != 0U)
    {
        fresh = 1U;
        raw = g_cal_hold_ne_raw;
        g_adc_vout_pwm_sync_raw = raw;
        g_adc_vout_raw = raw;
    }
    else
#endif
    {
    EALLOW;
    if (EPwm1Regs.ETFLG.bit.SOCA != 0U)
    {
        fresh = 1U;
        g_adc_vout_pwm_sync_raw = AdcResult.ADCRESULT0;
        raw = g_adc_vout_pwm_sync_raw;
        g_adc_vout_raw = g_adc_vout_pwm_sync_raw;
        g_adc_pwm_sync_soca_count++;
        g_adc_pwm_sync_eoc_count++;
        g_adc_sample_counter++;
        EPwm1Regs.ETCLR.bit.SOCA = 1U;
        AdcRegs.ADCINTFLGCLR.bit.ADCINT1 = 1U;
        AdcRegs.ADCINTOVFCLR.all = 0xFFFFU;
        g_adc_pwm_sync_valid = 1U;
        g_adc_pwm_sync_consecutive_miss = 0U;
    }
    EDIS;
    }

    if (fresh != 0U)
    {
        g_cal_hold_packet_post_last_raw = raw;
        if (raw > g_cal_hold_packet_post_max_raw)
            g_cal_hold_packet_post_max_raw = raw;
        if (raw >= CALHOLD_HardLimitRaw())
        {
            CALHOLD_StopPacket(1U);
            return;
        }
        if (raw >= CALHOLD_RechargeTargetRaw())
        {
            CALHOLD_StopPacket(0U);
            return;
        }
    }

    /* Reuse the exact initial-charge Phase-A cadence: DB110 for 15 complete
     * cycles, then DB falls by five after every ten completed cycles. The
     * 160-cycle packet is therefore bounded at DB36 (the write occurs after
     * cycle155); it never enters the later period-ramp stage. Every DB-only write
     * needs a one-call private active-packet authorization and a failed write
     * immediately returns to OST. */
    next_db = EPwm1Regs.DBRED;
    if (s_cal_hold_mode == CAL_HOLD_MODE_W3_10V)
    {
        switch (g_cal_hold_packet_cycles)
        {
            case 15U:  next_db = 105U; break;
            case 25U:  next_db = 100U; break;
            case 35U:  next_db = 95U;  break;
            case 45U:  next_db = 90U;  break;
            case 55U:  next_db = 85U;  break;
            case 65U:  next_db = 80U;  break;
            case 75U:  next_db = 75U;  break;
            case 85U:  next_db = 70U;  break;
            case 95U:  next_db = 65U;  break;
            case 105U: next_db = 60U;  break;
            case 115U: next_db = 55U;  break;
            case 125U: next_db = 50U;  break;
            case 135U: next_db = 45U;  break;
            case 145U: next_db = 40U;  break;
            case 155U: next_db = 36U;  break;
            default: break;
        }
    }
    if (next_db < EPwm1Regs.DBRED && next_db >= W3_HOLD_PACKET_DB_MIN)
    {
        s_w3_packet_write_auth = 1U;
        write_ok = PWM_SetDeadbandOnly(next_db);
        s_w3_packet_write_auth = 0U;
        if (write_ok == 0U)
        {
            CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_PRESTART_REJECT);
            return;
        }
    }

    if (g_cal_hold_packet_cycles >= CALHOLD_MaxPacketCycles())
    {
        CALHOLD_StopPacket(0U);
    }
}

/* 20 us fast task. */
void CALHOLD_FastTask(void)
{
    Uint16 raw;
    Uint16 prepare_ok;
    Uint32 limit = 0UL;
    if (g_cal_hold_state == CAL_HOLD_IDLE) return;

#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    /* The NE 20 us Group-1 harness can starve lower-priority Group-3. Drive
     * the identical packet handler once per synthetic boundary; REAL compiles
     * this out and remains exclusively EPWM1 ISR driven. */
    if (g_no_energy_test_mode != 0U &&
        g_cal_hold_state == CAL_HOLD_PACKET &&
        g_cal_hold_packet_active != 0U)
    {
        CALHOLD_PacketIsr();
        return;
    }
#endif

    switch (g_cal_hold_state)
    {
        case CAL_HOLD_OFF:
        {
        limit = (Uint32)g_cal_hold_duration_ms * 50UL;
            g_cal_hold_elapsed_ticks++;
            g_cal_hold_hold_active_ticks++;
            g_cal_hold_off_ticks++;

            /* A W4 trace terminal/max tick must reach OST before any same-tick
             * ADC-triggered recharge decision can start a new packet. */
            if (g_cal_measure_active == 0U &&
                s_w4_trace_session_direction != 0U &&
                CALHOLD_DurationReached(limit) != 0U)
            {
                CALHOLD_End(CAL_HOLD_COMPLETE, CAL_HOLD_REASON_COMPLETE);
                return;
            }

            if ((g_cal_hold_elapsed_ticks & 1U) != 0U)
            {
                AdcRegs.ADCINTOVFCLR.all = 0xFFFFU;  /* stale-flag hygiene */
                ADC_SoftwareTrigger();          /* tick N: force SOC0 */
            }
            else
            {
                /* tick N+1: the conversion started 20 us ago is complete by
                 * construction (F2803x conversion is ~300 ns). Best-effort
                 * EOC confirmation: the ADCINT1 flag is cleared when set;
                 * the sample is taken regardless so the hold statistics never
                 * stall on the flag. */
                if (AdcRegs.ADCINTFLG.bit.ADCINT1 != 0U)
                {
                    AdcRegs.ADCINTFLGCLR.bit.ADCINT1 = 1U;
                }
                raw = CALHOLD_ReadOffRaw();
                CALHOLD_RecordRaw(raw);

                if (raw >= CALHOLD_HardLimitRaw())
                {
                    g_cal_hold_hard_limit_events++;
                    CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_HARD_LIMIT);
                    return;
                }
                if (raw >= CALHOLD_DiagLowRaw())
                {
                    g_cal_hold_undersupply_low_samples = 0U;
                }
                else if (g_cal_hold_hold_active_ticks >
                         CAL_HOLD_UNDERSUPPLY_DELAY_TICKS)
                {
                    /* A PWM-sync -> software-trigger transition can expose a
                     * single low OFF sample. Legacy semantics remain immediate;
                     * W3 requires consecutive below-floor evidence across
                     * bounded recharge attempts before declaring undersupply. */
                    if (s_cal_hold_mode == CAL_HOLD_MODE_W3_10V)
                    {
                        if (g_cal_hold_undersupply_low_samples <
                            W3_HOLD_UNDERSUPPLY_CONFIRM_SAMPLES)
                            g_cal_hold_undersupply_low_samples++;
                        if (g_cal_hold_undersupply_low_samples >=
                            W3_HOLD_UNDERSUPPLY_CONFIRM_SAMPLES)
                        {
                            CALHOLD_End(CAL_HOLD_ABORT,
                                        CAL_HOLD_REASON_UNDERSUPPLIED);
                            return;
                        }
                    }
                    else
                    {
                        CALHOLD_End(CAL_HOLD_ABORT,
                                    CAL_HOLD_REASON_UNDERSUPPLIED);
                        return;
                    }
                }

                /* Recharge: PWM off >= 40 us and VOUT <= 1380. */
                if (g_cal_hold_off_ticks >= CAL_HOLD_OFF_MIN_TICKS &&
                    raw <= CALHOLD_RechargeLowRaw())
                {
                    /* Energy cap is compile-time and not CCS-writable. The
                     * selected profile owns both its per-packet and aggregate
                     * limits; target/hard VOUT checks remain per-cycle. */
                    if (g_cal_hold_total_packet_cycles >= CALHOLD_CycleCap())
                    {
                        CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_MAX_TOTAL_CYCLES);
                        return;
                    }

                    /* Freeze existing CCS-visible packet telemetry without
                     * adding RAM; the per-cycle ISR updates last/max/stop. */
                    g_cal_hold_packet_start_raw = raw;
                    g_cal_hold_packet_stop_raw = raw;
                    g_cal_hold_packet_post_max_raw = raw;
                    g_cal_hold_packet_post_last_raw = raw;
                    g_cal_hold_packet_actual_cycles = 0UL;

                    /* Fixed 250 kHz / DB110 packet start (never 150 kHz). */
                    ADC_SetPwmSyncTriggerMode();
                    ADC_UpdatePwmSyncPoint(239U);
                    /* The historical direct register path released OST before
                     * the newly-written comparator/DAC had a settle + safe
                     * GPIO15 observation. Reuse the proven 2 us pre-start arm
                     * sequence on every cold packet and fail closed. */
                    g_comp1_dac_code = LLC_SINGLE_CYCLE_PROBE_DAC;
                    g_comp_polarity = 1U;
                    COMP_ArmForSingleCycleStart(LLC_SINGLE_CYCLE_PROBE_DAC);
                    if (g_comp_prestart_reject != 0U ||
                        g_comp_inject_test_armed == 0U ||
                        g_comp_prestart_gpio15 == 0U ||
                        GpioDataRegs.GPADAT.bit.GPIO15 == 0U)
                    {
                        ADC_SetSoftwareTriggerMode();
                        CALHOLD_End(CAL_HOLD_ABORT,
                                    CAL_HOLD_REASON_PRESTART_REJECT);
                        return;
                    }

                    s_w3_packet_write_auth = 1U;
                    prepare_ok = PWM_PrepareStart(239UL, 110U, 1U);
                    s_w3_packet_write_auth = 0U;
                    if (prepare_ok == 0U)
                    {
                        ADC_SetSoftwareTriggerMode();
                        CALHOLD_End(CAL_HOLD_ABORT,
                                    CAL_HOLD_REASON_PRESTART_REJECT);
                        return;
                    }
#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
                    if (g_no_energy_test_mode != 0U)
                    {
                        /* Logic-only packet: retain the mandatory OST clamp.
                         * The NE tick above drives the same state handler. */
                        g_pwm_start_prepared = 0U;
                        g_pwm_enabled = 0U;
                        g_pwm_enable_result = 0U;
                    }
                    else
#endif
                    PWM_StartDeterministic();

                    EALLOW;
                    EPwm1Regs.ETSEL.bit.INTSEL = ET_CTR_ZERO;
                    EPwm1Regs.ETPS.bit.INTPRD  = ET_1ST;
                    EPwm1Regs.ETCLR.bit.INT    = 1U;
#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
                    if (g_no_energy_test_mode != 0U)
                        EPwm1Regs.ETSEL.bit.INTEN = 0U;
                    else
#endif
                    EPwm1Regs.ETSEL.bit.INTEN  = 1U;
                    EDIS;

                    g_cal_hold_state = CAL_HOLD_PACKET;
                    g_cal_hold_packet_active = 1U;
                    g_cal_hold_packet_cycles = 0U;
                    g_cal_hold_off_ticks = 0UL;
                }
            }

            if (g_cal_measure_active != 0U)
            {
                /* Interactive DMM hold: no 1s auto-end. Stop on the operator
                 * completion flag or the 30s wall-clock timeout. */
                if (g_cal_measure_done != 0U ||
                    g_cal_hold_elapsed_ticks >=
                        (Uint32)(CAL_HOLD_MAX_DMM_HOLD_SECONDS * 1000UL * 50UL))
                {
                    CALHOLD_End(CAL_HOLD_COMPLETE, CAL_HOLD_REASON_COMPLETE);
                }
            }
            else if (CALHOLD_DurationReached(limit) != 0U)
            {
                CALHOLD_End(CAL_HOLD_COMPLETE, CAL_HOLD_REASON_COMPLETE);
            }
            break;
        }

        case CAL_HOLD_PACKET:
        {
        limit = (Uint32)g_cal_hold_duration_ms * 50UL;
            g_cal_hold_elapsed_ticks++;
            g_cal_hold_hold_active_ticks++;
            if (g_cal_measure_active != 0U)
            {
                if (g_cal_measure_done != 0U ||
                    g_cal_hold_elapsed_ticks >=
                        (Uint32)(CAL_HOLD_MAX_DMM_HOLD_SECONDS * 1000UL * 50UL))
                {
                    CALHOLD_StopPacket(0U);
                    CALHOLD_End(CAL_HOLD_COMPLETE, CAL_HOLD_REASON_COMPLETE);
                }
            }
            else if (CALHOLD_DurationReached(limit) != 0U)
            {
                CALHOLD_StopPacket(0U);
                CALHOLD_End(CAL_HOLD_COMPLETE, CAL_HOLD_REASON_COMPLETE);
            }
            break;
        }

        default:
            break;
    }
}

/* 5 ms slow task. */
void CALHOLD_SlowTask(void)
{
    if (g_cal_measure_request != 0U)
    {
        g_cal_measure_request = 0U;
        if (g_cal_hold_state != CAL_HOLD_IDLE)
        {
            CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_REJECTED);
            return;
        }
        /* Same PASSed Profile C charge + recharge hold, no 1s auto-end. */
        s_cal_hold_mode = CAL_HOLD_MODE_LEGACY_11V;
        g_cal_hold_mode_active = s_cal_hold_mode;
        g_cal_measure_active = 1U;
        g_cal_measure_done = 0U;
        g_cal_measure_ready = 0U;
        g_cal_hold_state = CAL_HOLD_CHARGE;
        g_cal_hold_stop_reason = CAL_HOLD_REASON_NONE;
        g_cal_hold_run_id_at_arm = g_test_run_id;
        g_accel_vout_target_raw = CAL_HOLD_RECHARGE_TARGET_RAW;
        g_accel_request = 1U;
        g_multi_cycle_probe_request = 1U;
        return;
    }

    if (g_cal_hold_request != 0U)
    {
        Uint16 requested_mode = g_cal_hold_mode_request;
        Uint16 requested_duration = g_cal_hold_duration_ms;
        g_cal_hold_request = 0U;

        if (g_cal_hold_state != CAL_HOLD_IDLE ||
            CALHOLD_RequestValid(requested_mode, requested_duration) == 0U)
        {
            CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_REJECTED);
            return;
        }

        s_cal_hold_mode = requested_mode;
        g_cal_hold_mode_active = s_cal_hold_mode;
        CALHOLD_W4TraceReset(requested_mode, requested_duration);
        /* CHARGE: legacy uses 1400 raw; W3 uses the already authorized 1200
         * raw Profile C target before entering the 10 V packet band. */
        g_cal_hold_state = CAL_HOLD_CHARGE;
        g_cal_hold_stop_reason = CAL_HOLD_REASON_NONE;
        g_cal_hold_run_id_at_arm = g_test_run_id;
        g_accel_vout_target_raw = (s_cal_hold_mode == CAL_HOLD_MODE_W3_10V)
            ? W3_HOLD_INITIAL_CHARGE_RAW : CAL_HOLD_RECHARGE_TARGET_RAW;
#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
        if (g_no_energy_test_mode != 0U && g_cal_hold_ne_bypass_charge != 0U)
        {
            CALHOLD_BeginOff(g_accel_vout_target_raw);
            return;
        }
#endif
        g_accel_request = 1U;
        g_multi_cycle_probe_request = 1U;
        return;
    }

    if (g_cal_hold_state == CAL_HOLD_CHARGE)
    {
        if (g_multi_cycle_probe_active != 0U) return;

        switch (g_accel_stop_reason)
        {
            case ACCEL_STOP_VOUT_TARGET:
                CALHOLD_BeginOff(g_accel_stop_raw);
                break;

            case ACCEL_STOP_HARD_LIMIT:
                CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_HARD_LIMIT);
                break;

            case ACCEL_STOP_TZ_TRIP:
                CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_ACTIVE_TZ);
                break;

            default:
                CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_CHARGE_NOT_REACHED);
                break;
        }
        return;
    }

    if (g_cal_hold_state == CAL_HOLD_OFF ||
        g_cal_hold_state == CAL_HOLD_PACKET)
    {
        if (g_fault_flags != 0UL || g_system_state == SYS_STATE_FAULT)
        {
            CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_ACTIVE_TZ);
        }
        else
        {
            static Uint16 s_last_avg = 0U;
            static Uint16 s_stable_streak = 0U;
            CALHOLD_StatsPublish();
            if (g_cal_hold_cal_raw_samples > 0UL)
                g_cal_hold_cal_raw_avg =
                    (Uint16)(g_cal_hold_cal_raw_sum / g_cal_hold_cal_raw_samples);
            CALHOLD_W4TraceSample();

            /* DMM stability: after 500ms settling, a rolling average that
             * moves <=10 raw across 200ms marks DMM_MEASUREMENT_READY. */
            if (g_cal_measure_active != 0U &&
                g_cal_hold_elapsed_ticks >=
                    (Uint32)(CAL_HOLD_MEASURE_SETTLING_MS * 50UL))
            {
                Uint16 delta = (Uint16)((g_cal_hold_cal_raw_avg >= s_last_avg)
                    ? (g_cal_hold_cal_raw_avg - s_last_avg)
                    : (s_last_avg - g_cal_hold_cal_raw_avg));
                if (delta <= 10U)
                {
                    if (++s_stable_streak >=
                        (Uint16)(CAL_HOLD_MEASURE_STABLE_MS / 5U))
                    {
                        g_cal_measure_ready = 1U;
                    }
                }
                else
                {
                    s_stable_streak = 0U;
                }
                s_last_avg = g_cal_hold_cal_raw_avg;
            }
        }
    }

    /* Post-test zero/offset capture: PWM off, OST latched, VOUT discharged.
     * 64 software-triggered samples in the 5ms task (DELAY_US is allowed here;
     * the fast task never waits). */
    if (g_cal_hold_zero_request != 0U)
    {
        Uint16 zi;
        Uint32 zsum = 0UL;

        g_cal_hold_zero_request = 0U;
        g_cal_hold_zero_raw_min = 0xFFFFU;
        g_cal_hold_zero_raw_max = 0U;
        for (zi = 0U; zi < CAL_HOLD_ZERO_SAMPLES; zi++)
        {
            ADC_SoftwareTrigger();
            DELAY_US(20L);
            {
                Uint16 zr = (Uint16)AdcResult.ADCRESULT0;
                if (zr < g_cal_hold_zero_raw_min) g_cal_hold_zero_raw_min = zr;
                if (zr > g_cal_hold_zero_raw_max) g_cal_hold_zero_raw_max = zr;
                zsum += zr;
            }
        }
        g_cal_hold_zero_raw_avg = (Uint16)(zsum / CAL_HOLD_ZERO_SAMPLES);
    }
}

void CALHOLD_Init(void)
{
    CALHOLD_StatsReset();
    CALHOLD_StatsPublish();
    s_cal_hold_mode = CAL_HOLD_MODE_LEGACY_11V;
    s_w3_packet_write_auth = 0U;
    s_w4_trace_cycle_clock = 0U;
    s_w4_trace_packet_clock = 0U;
    g_w4_trace_arm = 0U;
    g_w4_trace_expected_direction = 0U;
    g_w4_trace_terminal_cookie = 0UL;
    CALHOLD_W4TraceReset(CAL_HOLD_MODE_LEGACY_11V, 100U);
    g_cal_hold_request = 0U;
    g_cal_hold_duration_ms = 100U;
    g_cal_measure_request = 0U;
    g_cal_measure_done = 0U;
    g_cal_measure_active = 0U;
    g_cal_hold_packet_active = 0U;
    g_cal_hold_stop_reason = CAL_HOLD_REASON_NONE;
    g_cal_hold_mode_request = CAL_HOLD_MODE_LEGACY_11V;
    g_cal_hold_mode_active = CAL_HOLD_MODE_LEGACY_11V;
#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    g_cal_hold_ne_bypass_charge = 0U;
    g_cal_hold_ne_raw = 0U;
#endif
    g_cal_hold_state = CAL_HOLD_IDLE;
}
