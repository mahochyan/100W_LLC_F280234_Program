/*
 * open_loop_steady.c
 *
 * W2_OPEN_LOOP_STEADY_STATE_PLANT_CHARACTERIZATION_V1 — implementation.
 *
 * Core per-tick step (20 us, TINT0):
 *   1. external-fault observation (protection owns the trip)
 *   2. experiment VOUT guards: HARD 11V abort -> PWM_Trip;
 *      WARNING 10.5V -> planned OST + OPEN_LOOP_UPPER_GAIN_BOUNDARY
 *   3. max-hold timeout -> planned OST
 *   4. fresh-sample accumulation (100 ms rolling window + steady accumulator)
 *   5. slew: applied -> effective command, <= SLEW Hz per fresh ADC sample,
 *      envelope-clamped, actuator write via LLC_SetFrequencyHz
 *
 * The real build reads ONLY real ADC publications (no synthetic path). The
 * noenergy test build substitutes a host-written synthetic raw and gates the
 * actuator behind OST + arm.
 *
 * RAM placement: the module owns its variables in the dedicated "ol_ram"
 * section (RAML3). The default .ebss pool (RAML2, 0x400 words) was already
 * at its budget in the bounded noenergy harness builds; placing this
 * experimental module outside .ebss keeps every existing binary's memory
 * budget untouched. Every variable below carries an explicit initializer so
 * the COFF cinit copy zero-establishes them before main() runs, and
 * OPENLOOP_Init() re-establishes them at bring-up.
 */
#include "DSP2803x_Device.h"
#include "DSP2803x_Examples.h"
#include "llc_config.h"
#include "llc_globals.h"
#include "board_calibration.h"
#include "pwm.h"
#include "open_loop_steady.h"

#if STAGE6_OPEN_LOOP_STEADY_BUILD

/* ---- control (host-writable) ---- */
#pragma DATA_SECTION(g_open_loop_steady_active, "ol_ram");
volatile Uint16 g_open_loop_steady_active        = 0U;
#pragma DATA_SECTION(g_open_loop_frequency_command_hz, "ol_ram");
volatile Uint32 g_open_loop_frequency_command_hz = 0UL;
#pragma DATA_SECTION(g_open_loop_freq_slew_hz_per_sample, "ol_ram");
volatile Uint32 g_open_loop_freq_slew_hz_per_sample = OPEN_LOOP_FREQ_SLEW_DEFAULT_HZ;
/* ---- telemetry ---- */
#pragma DATA_SECTION(g_open_loop_entry_hz, "ol_ram");
volatile Uint32 g_open_loop_entry_hz             = 0UL;
#pragma DATA_SECTION(g_open_loop_applied_hz, "ol_ram");
volatile Uint32 g_open_loop_applied_hz           = 0UL;
#pragma DATA_SECTION(g_open_loop_cmd_effective_hz, "ol_ram");
volatile Uint32 g_open_loop_cmd_effective_hz     = 0UL;
#pragma DATA_SECTION(g_open_loop_cmd_clamp_count, "ol_ram");
volatile Uint32 g_open_loop_cmd_clamp_count      = 0UL;
#pragma DATA_SECTION(g_open_loop_slew_steps, "ol_ram");
volatile Uint32 g_open_loop_slew_steps           = 0UL;
#pragma DATA_SECTION(g_open_loop_phase, "ol_ram");
volatile Uint16 g_open_loop_phase                = OL_PHASE_IDLE;
#pragma DATA_SECTION(g_open_loop_steady_reached, "ol_ram");
volatile Uint16 g_open_loop_steady_reached       = 0U;
#pragma DATA_SECTION(g_open_loop_ticks_active, "ol_ram");
volatile Uint32 g_open_loop_ticks_active         = 0UL;
#pragma DATA_SECTION(g_open_loop_slew_done_tick, "ol_ram");
volatile Uint32 g_open_loop_slew_done_tick       = 0UL;
#pragma DATA_SECTION(g_open_loop_settle_ms, "ol_ram");
volatile Uint32 g_open_loop_settle_ms            = 0UL;
#pragma DATA_SECTION(g_open_loop_steady_ticks, "ol_ram");
volatile Uint32 g_open_loop_steady_ticks         = 0UL;
#pragma DATA_SECTION(g_open_loop_last_vout_raw, "ol_ram");
volatile Uint16 g_open_loop_last_vout_raw        = 0U;
#pragma DATA_SECTION(g_open_loop_last_vout_filtered_raw, "ol_ram");
volatile Uint16 g_open_loop_last_vout_filtered_raw = 0U;
#pragma DATA_SECTION(g_open_loop_last_ipri_raw, "ol_ram");
volatile Uint16 g_open_loop_last_ipri_raw        = 0U;
/* rolling window */
#pragma DATA_SECTION(g_open_loop_win_mean_raw, "ol_ram");
volatile Uint16 g_open_loop_win_mean_raw         = 0U;
#pragma DATA_SECTION(g_open_loop_win_prev_mean_raw, "ol_ram");
volatile Uint16 g_open_loop_win_prev_mean_raw    = 0U;
#pragma DATA_SECTION(g_open_loop_win_min_raw, "ol_ram");
volatile Uint16 g_open_loop_win_min_raw          = 0U;
#pragma DATA_SECTION(g_open_loop_win_max_raw, "ol_ram");
volatile Uint16 g_open_loop_win_max_raw          = 0U;
#pragma DATA_SECTION(g_open_loop_win_ipri_mean_raw, "ol_ram");
volatile Uint16 g_open_loop_win_ipri_mean_raw    = 0U;
#pragma DATA_SECTION(g_open_loop_win_ipri_max_raw, "ol_ram");
volatile Uint16 g_open_loop_win_ipri_max_raw     = 0U;
#pragma DATA_SECTION(g_open_loop_win_compsts_high, "ol_ram");
volatile Uint32 g_open_loop_win_compsts_high     = 0UL;
#pragma DATA_SECTION(g_open_loop_win_stale_ticks, "ol_ram");
volatile Uint32 g_open_loop_win_stale_ticks      = 0UL;
#pragma DATA_SECTION(g_open_loop_win_index, "ol_ram");
volatile Uint32 g_open_loop_win_index            = 0UL;
/* steady accumulator */
#pragma DATA_SECTION(g_open_loop_ss_ticks, "ol_ram");
volatile Uint32 g_open_loop_ss_ticks             = 0UL;
#pragma DATA_SECTION(g_open_loop_ss_vout_sum, "ol_ram");
volatile Uint32 g_open_loop_ss_vout_sum          = 0UL;
#pragma DATA_SECTION(g_open_loop_ss_min_raw, "ol_ram");
volatile Uint16 g_open_loop_ss_min_raw           = 0U;
#pragma DATA_SECTION(g_open_loop_ss_max_raw, "ol_ram");
volatile Uint16 g_open_loop_ss_max_raw           = 0U;
#pragma DATA_SECTION(g_open_loop_ss_ipri_sum, "ol_ram");
volatile Uint32 g_open_loop_ss_ipri_sum          = 0UL;
#pragma DATA_SECTION(g_open_loop_ss_ipri_max_raw, "ol_ram");
volatile Uint16 g_open_loop_ss_ipri_max_raw      = 0U;
/* stop snapshot */
#pragma DATA_SECTION(g_open_loop_stop_reason, "ol_ram");
volatile Uint16 g_open_loop_stop_reason          = OL_STOP_NONE;
#pragma DATA_SECTION(g_open_loop_upper_gain_boundary, "ol_ram");
volatile Uint16 g_open_loop_upper_gain_boundary  = 0U;
#pragma DATA_SECTION(g_open_loop_stop_tbprd, "ol_ram");
volatile Uint16 g_open_loop_stop_tbprd           = 0U;
#pragma DATA_SECTION(g_open_loop_stop_freq_actual, "ol_ram");
volatile Uint32 g_open_loop_stop_freq_actual     = 0UL;
#pragma DATA_SECTION(g_open_loop_stop_freq_applied, "ol_ram");
volatile Uint32 g_open_loop_stop_freq_applied    = 0UL;
#pragma DATA_SECTION(g_open_loop_stop_cmd, "ol_ram");
volatile Uint32 g_open_loop_stop_cmd             = 0UL;
#pragma DATA_SECTION(g_open_loop_stop_mean_raw, "ol_ram");
volatile Uint16 g_open_loop_stop_mean_raw        = 0U;
#pragma DATA_SECTION(g_open_loop_stop_min_raw, "ol_ram");
volatile Uint16 g_open_loop_stop_min_raw         = 0U;
#pragma DATA_SECTION(g_open_loop_stop_max_raw, "ol_ram");
volatile Uint16 g_open_loop_stop_max_raw         = 0U;
#pragma DATA_SECTION(g_open_loop_stop_ipri_mean_raw, "ol_ram");
volatile Uint16 g_open_loop_stop_ipri_mean_raw   = 0U;
#pragma DATA_SECTION(g_open_loop_stop_ipri_max_raw, "ol_ram");
volatile Uint16 g_open_loop_stop_ipri_max_raw    = 0U;
#pragma DATA_SECTION(g_open_loop_stop_compsts_high, "ol_ram");
volatile Uint32 g_open_loop_stop_compsts_high    = 0UL;
#pragma DATA_SECTION(g_open_loop_stop_tz_events, "ol_ram");
volatile Uint32 g_open_loop_stop_tz_events       = 0UL;
#pragma DATA_SECTION(g_open_loop_stop_stale_ticks, "ol_ram");
volatile Uint32 g_open_loop_stop_stale_ticks     = 0UL;
#pragma DATA_SECTION(g_open_loop_stop_pwm, "ol_ram");
volatile Uint16 g_open_loop_stop_pwm             = 0U;
#pragma DATA_SECTION(g_open_loop_stop_ost, "ol_ram");
volatile Uint16 g_open_loop_stop_ost             = 0U;
#pragma DATA_SECTION(g_open_loop_stop_tzint, "ol_ram");
volatile Uint16 g_open_loop_stop_tzint           = 0U;
#pragma DATA_SECTION(g_open_loop_stop_fault, "ol_ram");
volatile Uint32 g_open_loop_stop_fault           = 0UL;
#pragma DATA_SECTION(g_open_loop_stop_timer2, "ol_ram");
volatile Uint32 g_open_loop_stop_timer2          = 0UL;

/* ---- module-private state ---- */
#pragma DATA_SECTION(s_win_vout_sum, "ol_ram");
static Uint32 s_win_vout_sum = 0UL;
#pragma DATA_SECTION(s_win_ipri_sum, "ol_ram");
static Uint32 s_win_ipri_sum = 0UL;
#pragma DATA_SECTION(s_win_fresh_count, "ol_ram");
static Uint32 s_win_fresh_count = 0UL;
#pragma DATA_SECTION(s_win_tick_count, "ol_ram");
static Uint32 s_win_tick_count = 0UL;
#pragma DATA_SECTION(s_steady_window_count, "ol_ram");
static Uint32 s_steady_window_count = 0UL;
#pragma DATA_SECTION(s_last_adc_sequence, "ol_ram");
static Uint32 s_last_adc_sequence = 0UL;

#if STAGE6_OPEN_LOOP_STEADY_BUILD && STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
#pragma DATA_SECTION(g_open_loop_ne_test_enable, "ol_ram");
volatile Uint16 g_open_loop_ne_test_enable   = 0U;
#pragma DATA_SECTION(g_open_loop_ne_entry_request, "ol_ram");
volatile Uint16 g_open_loop_ne_entry_request = 0U;
#pragma DATA_SECTION(g_open_loop_ne_exit_request, "ol_ram");
volatile Uint16 g_open_loop_ne_exit_request  = 0U;
#pragma DATA_SECTION(g_open_loop_ne_raw, "ol_ram");
volatile Uint16 g_open_loop_ne_raw           = 0U;
#pragma DATA_SECTION(g_open_loop_ne_actuator_arm, "ol_ram");
volatile Uint16 g_open_loop_ne_actuator_arm  = 0U;
#pragma DATA_SECTION(g_open_loop_ne_max_hold_ticks, "ol_ram");
volatile Uint32 g_open_loop_ne_max_hold_ticks = 0UL;
#pragma DATA_SECTION(g_open_loop_ne_tick, "ol_ram");
volatile Uint32 g_open_loop_ne_tick          = 0UL;
#pragma DATA_SECTION(g_open_loop_ne_trace, "ol_ram");
volatile Uint32 g_open_loop_ne_trace[16]     = {0UL, 0UL, 0UL, 0UL, 0UL, 0UL, 0UL, 0UL,
                                                0UL, 0UL, 0UL, 0UL, 0UL, 0UL, 0UL, 0UL};
#endif

/* ------------------------------------------------------------------ */
/* Internal helpers                                                    */
/* ------------------------------------------------------------------ */

static Uint32 OL_ClampHz(Uint32 hz)
{
    if (hz < OPEN_LOOP_FREQ_MIN_HZ) return OPEN_LOOP_FREQ_MIN_HZ;
    if (hz > OPEN_LOOP_FREQ_MAX_HZ) return OPEN_LOOP_FREQ_MAX_HZ;
    return hz;
}

/* Finalize the partial/complete window numbers into the stop snapshot. */
static void OL_FreezeWindowStats(void)
{
    Uint32 mean;
    Uint32 imean;

    if (s_win_fresh_count != 0UL)
    {
        mean = s_win_vout_sum / s_win_fresh_count;
        imean = s_win_ipri_sum / s_win_fresh_count;
    }
    else
    {
        mean = (Uint32)g_open_loop_win_mean_raw;
        imean = (Uint32)g_open_loop_win_ipri_mean_raw;
    }
    g_open_loop_stop_mean_raw      = (Uint16)mean;
    g_open_loop_stop_min_raw       = g_open_loop_win_min_raw;
    g_open_loop_stop_max_raw       = g_open_loop_win_max_raw;
    g_open_loop_stop_ipri_mean_raw = (Uint16)imean;
    g_open_loop_stop_ipri_max_raw  = g_open_loop_win_ipri_max_raw;
    g_open_loop_stop_compsts_high  = g_open_loop_win_compsts_high;
    g_open_loop_stop_stale_ticks   = g_open_loop_win_stale_ticks;
    g_open_loop_stop_tz_events     = (Uint32)g_trip_count;
}

/* Freeze the end-of-run snapshot exactly once (first stop wins). */
static void OL_FreezeStop(Uint16 reason)
{
    if (g_open_loop_stop_reason != OL_STOP_NONE) return;

    OL_FreezeWindowStats();
    if (g_open_loop_ss_ticks != 0UL)
    {
        g_open_loop_stop_mean_raw =
            (Uint16)(g_open_loop_ss_vout_sum / g_open_loop_ss_ticks);
        g_open_loop_stop_ipri_mean_raw =
            (Uint16)(g_open_loop_ss_ipri_sum / g_open_loop_ss_ticks);
        g_open_loop_stop_min_raw = g_open_loop_ss_min_raw;
        g_open_loop_stop_max_raw = g_open_loop_ss_max_raw;
        g_open_loop_stop_ipri_max_raw = g_open_loop_ss_ipri_max_raw;
    }
    g_open_loop_stop_reason      = reason;
    g_open_loop_stop_tbprd       = EPwm1Regs.TBPRD;
    g_open_loop_stop_freq_actual = g_actual_switching_frequency_hz;
    g_open_loop_stop_freq_applied = g_open_loop_applied_hz;
    g_open_loop_stop_cmd         = g_open_loop_frequency_command_hz;
    g_open_loop_stop_timer2      = CpuTimer2Regs.TIM.all;
    g_open_loop_stop_pwm         = g_pwm_enabled;
    g_open_loop_stop_ost         = EPwm1Regs.TZFLG.bit.OST;
    g_open_loop_stop_tzint       = EPwm1Regs.TZFLG.bit.INT;
    g_open_loop_stop_fault       = g_fault_flags;
    g_open_loop_steady_active    = 0U;
    g_open_loop_phase            = OL_PHASE_STOPPED;
}

/* Planned (non-fault) stop: normal inhibit path, end state PWM=0/OST=1. */
static void OL_PlannedStop(Uint16 reason)
{
    LLC_PWM_DisableSafe();
    OL_FreezeStop(reason);
}

/* Rolling-window bookkeeping. Called every tick while active. */
static void OL_WindowTick(Uint16 raw_stat, Uint16 fresh, Uint16 ipri_raw)
{
    Uint16 compsts;
    Uint32 mean;
    Uint32 imean;

    /* fresh sample accumulation */
    if (fresh != 0U)
    {
        if (s_win_fresh_count == 0UL)
        {
            g_open_loop_win_min_raw = raw_stat;
            g_open_loop_win_max_raw = raw_stat;
        }
        else
        {
            if (raw_stat < g_open_loop_win_min_raw) g_open_loop_win_min_raw = raw_stat;
            if (raw_stat > g_open_loop_win_max_raw) g_open_loop_win_max_raw = raw_stat;
        }
        s_win_vout_sum += (Uint32)raw_stat;
        if (s_win_fresh_count == 0UL)
        {
            g_open_loop_win_ipri_max_raw = ipri_raw;
        }
        else if (ipri_raw > g_open_loop_win_ipri_max_raw)
        {
            g_open_loop_win_ipri_max_raw = ipri_raw;
        }
        s_win_ipri_sum += (Uint32)ipri_raw;
        s_win_fresh_count++;
        g_open_loop_last_vout_raw = raw_stat;
        g_open_loop_last_ipri_raw = ipri_raw;
    }
    else
    {
        g_open_loop_win_stale_ticks++;
    }

    /* comparator output state sampled every tick (near-trip indicator) */
    compsts = Comp1Regs.COMPSTS.bit.COMPSTS;
    if (compsts != 0U) g_open_loop_win_compsts_high++;

    s_win_tick_count++;
    if (s_win_tick_count < OPEN_LOOP_WINDOW_TICKS) return;

    /* ---- window roll (once per 100 ms; divide cost is amortized) ---- */
    if (s_win_fresh_count != 0UL)
    {
        mean  = s_win_vout_sum / s_win_fresh_count;
        imean = s_win_ipri_sum / s_win_fresh_count;
    }
    else
    {
        mean  = (Uint32)g_open_loop_win_prev_mean_raw;
        imean = (Uint32)g_open_loop_win_ipri_mean_raw;
    }
    g_open_loop_win_prev_mean_raw = g_open_loop_win_mean_raw;
    g_open_loop_win_mean_raw      = (Uint16)mean;
    g_open_loop_win_ipri_mean_raw = (Uint16)imean;
    g_open_loop_win_index++;

    /* steady-state decision: only after slew done + transient exclusion */
    if (g_open_loop_slew_done_tick != 0UL ||
        g_open_loop_applied_hz == g_open_loop_cmd_effective_hz)
    {
        if (g_open_loop_ticks_active >= OPEN_LOOP_SETTLE_MIN_TICKS)
        {
            Uint32 prev = (Uint32)g_open_loop_win_prev_mean_raw;
            Uint32 diff = (mean >= prev) ? (mean - prev) : (prev - mean);
            if (diff <= (Uint32)OPEN_LOOP_STEADY_DELTA_RAW)
            {
                s_steady_window_count++;
            }
            else
            {
                s_steady_window_count = 0UL;
            }
            if (g_open_loop_steady_reached == 0U &&
                s_steady_window_count >= (Uint32)OPEN_LOOP_STEADY_WINDOWS_REQ)
            {
                g_open_loop_steady_reached = 1U;
                g_open_loop_phase = OL_PHASE_STEADY;
                /* slew_done_tick semantics: 0 = arrival was at entry (no slew)
                 * or the slew-arrival tick set by the actuator path. Do not
                 * overwrite it here. */
                g_open_loop_settle_ms =
                    (g_open_loop_ticks_active - g_open_loop_slew_done_tick) / 50UL;
            }
        }
    }

    /* steady accumulator absorbs each completed window while STEADY */
    if (g_open_loop_steady_reached != 0U)
    {
        g_open_loop_ss_vout_sum += s_win_vout_sum;
        g_open_loop_ss_ipri_sum += s_win_ipri_sum;
        g_open_loop_ss_ticks    += s_win_fresh_count;
        g_open_loop_steady_ticks = g_open_loop_ticks_active - g_open_loop_slew_done_tick;
        if (g_open_loop_ss_ticks == s_win_fresh_count)
        {
            g_open_loop_ss_min_raw = g_open_loop_win_min_raw;
            g_open_loop_ss_max_raw = g_open_loop_win_max_raw;
            g_open_loop_ss_ipri_max_raw = g_open_loop_win_ipri_max_raw;
        }
        else
        {
            if (g_open_loop_win_min_raw < g_open_loop_ss_min_raw)
                g_open_loop_ss_min_raw = g_open_loop_win_min_raw;
            if (g_open_loop_win_max_raw > g_open_loop_ss_max_raw)
                g_open_loop_ss_max_raw = g_open_loop_win_max_raw;
            if (g_open_loop_win_ipri_max_raw > g_open_loop_ss_ipri_max_raw)
                g_open_loop_ss_ipri_max_raw = g_open_loop_win_ipri_max_raw;
        }
    }

    /* reset window accumulators */
    s_win_vout_sum = 0UL;
    s_win_ipri_sum = 0UL;
    s_win_fresh_count = 0UL;
    s_win_tick_count = 0UL;
}

/* ------------------------------------------------------------------ */
/* Core step                                                           */
/* ------------------------------------------------------------------ */

static void OPENLOOP_Step(Uint16 raw_protect, Uint16 raw_stat, Uint16 fresh)
{
    Uint32 cmd, eff, applied, slew, diff, step, max_hold;

    if (g_open_loop_steady_active == 0U) return;

    /* 1. external fault observation (protection already tripped PWM) */
    if (g_fault_flags != 0UL)
    {
        OL_FreezeStop(OL_STOP_FAULT_EXTERNAL);
        return;
    }

    /* 2. experiment VOUT guards on the unfiltered published raw */
    if (raw_protect >= OPEN_LOOP_VOUT_HARD_ABORT_RAW)
    {
        PWM_Trip(FAULT_OPEN_LOOP_VOUT_CEILING, 1U);
        OL_FreezeStop(OL_STOP_HARD_VOUT);
        return;
    }
    if (raw_protect >= OPEN_LOOP_VOUT_WARNING_RAW)
    {
        /* planned OST from the ISR: outputs clamp low, no fault latched */
        LLC_PWM_DisableSafe();
        OL_FreezeStop(OL_STOP_WARNING);
        g_open_loop_upper_gain_boundary = 1U;
        return;
    }

    g_open_loop_ticks_active++;

    /* 3. max-hold backstop -> planned OST */
#if STAGE6_OPEN_LOOP_STEADY_BUILD && STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    max_hold = (g_open_loop_ne_max_hold_ticks != 0UL)
        ? g_open_loop_ne_max_hold_ticks : OPEN_LOOP_MAX_HOLD_TICKS;
#else
    max_hold = OPEN_LOOP_MAX_HOLD_TICKS;
#endif
    if (g_open_loop_ticks_active >= max_hold)
    {
        OL_PlannedStop(OL_STOP_TIMEOUT);
        return;
    }

    /* 4. statistics (fresh gating done by the caller) */
    OL_WindowTick(raw_stat, fresh, g_adc_ipri_raw);

    /* 5. slew toward the host command: at most SLEW Hz per fresh sample */
    cmd = g_open_loop_frequency_command_hz;
    eff = OL_ClampHz(cmd);
    g_open_loop_cmd_effective_hz = eff;
    if (cmd != eff) g_open_loop_cmd_clamp_count++;

    if (fresh == 0U) return;
    applied = g_open_loop_applied_hz;
    if (applied == eff) return;

    slew = g_open_loop_freq_slew_hz_per_sample;
    if (slew < OPEN_LOOP_FREQ_SLEW_MIN_HZ) slew = OPEN_LOOP_FREQ_SLEW_MIN_HZ;
    if (slew > OPEN_LOOP_FREQ_SLEW_MAX_HZ) slew = OPEN_LOOP_FREQ_SLEW_MAX_HZ;

    if (applied < eff)
    {
        diff = eff - applied;
        step = (diff < slew) ? diff : slew;
        applied += step;
    }
    else
    {
        diff = applied - eff;
        step = (diff < slew) ? diff : slew;
        applied -= step;
    }
    g_open_loop_applied_hz = applied;
    g_open_loop_slew_steps++;
    /* Arrival marker is statistics, not actuator: set it before the NE
     * actuator gate so the no-energy harness (arm=0) still records the
     * slew-arrival tick and settle_ms. */
    if (applied == eff && g_open_loop_slew_done_tick == 0UL)
    {
        g_open_loop_slew_done_tick = g_open_loop_ticks_active;
        if (g_open_loop_phase == OL_PHASE_SLEWING) g_open_loop_phase = OL_PHASE_SETTLING;
    }
#if STAGE6_OPEN_LOOP_STEADY_BUILD && STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    if (g_open_loop_slew_steps <= 16UL)
    {
        g_open_loop_ne_trace[g_open_loop_slew_steps - 1UL] = applied;
    }
    if (g_open_loop_ne_actuator_arm == 0U || EPwm1Regs.TZFLG.bit.OST == 0U) return;
#endif
    if (LLC_SetFrequencyHz(applied) == 0U)
    {
        /* actuator refusal: envelope/topology violation -> safe hard stop */
        PWM_Trip(FAULT_ILLEGAL_FREQUENCY, 1U);
        OL_FreezeStop(OL_STOP_FAULT_EXTERNAL);
        return;
    }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

void OPENLOOP_Init(void)
{
    g_open_loop_steady_active        = 0U;
    g_open_loop_frequency_command_hz = 0UL;
    g_open_loop_freq_slew_hz_per_sample = OPEN_LOOP_FREQ_SLEW_DEFAULT_HZ;
    g_open_loop_entry_hz             = 0UL;
    g_open_loop_applied_hz           = 0UL;
    g_open_loop_cmd_effective_hz     = 0UL;
    g_open_loop_cmd_clamp_count      = 0UL;
    g_open_loop_slew_steps           = 0UL;
    g_open_loop_phase                = OL_PHASE_IDLE;
    g_open_loop_steady_reached       = 0U;
    g_open_loop_ticks_active         = 0UL;
    g_open_loop_slew_done_tick       = 0UL;
    g_open_loop_settle_ms            = 0UL;
    g_open_loop_steady_ticks         = 0UL;
    g_open_loop_last_vout_raw        = 0U;
    g_open_loop_last_vout_filtered_raw = 0U;
    g_open_loop_last_ipri_raw        = 0U;
    g_open_loop_win_mean_raw         = 0U;
    g_open_loop_win_prev_mean_raw    = 0U;
    g_open_loop_win_min_raw          = 0U;
    g_open_loop_win_max_raw          = 0U;
    g_open_loop_win_ipri_mean_raw    = 0U;
    g_open_loop_win_ipri_max_raw     = 0U;
    g_open_loop_win_compsts_high     = 0UL;
    g_open_loop_win_stale_ticks      = 0UL;
    g_open_loop_win_index            = 0UL;
    g_open_loop_ss_ticks             = 0UL;
    g_open_loop_ss_vout_sum          = 0UL;
    g_open_loop_ss_min_raw           = 0U;
    g_open_loop_ss_max_raw           = 0U;
    g_open_loop_ss_ipri_sum          = 0UL;
    g_open_loop_ss_ipri_max_raw      = 0U;
    g_open_loop_stop_reason          = OL_STOP_NONE;
    g_open_loop_upper_gain_boundary  = 0U;
    g_open_loop_stop_tbprd           = 0U;
    g_open_loop_stop_freq_actual     = 0UL;
    g_open_loop_stop_freq_applied    = 0UL;
    g_open_loop_stop_cmd             = 0UL;
    g_open_loop_stop_mean_raw        = 0U;
    g_open_loop_stop_min_raw         = 0U;
    g_open_loop_stop_max_raw         = 0U;
    g_open_loop_stop_ipri_mean_raw   = 0U;
    g_open_loop_stop_ipri_max_raw    = 0U;
    g_open_loop_stop_compsts_high    = 0UL;
    g_open_loop_stop_tz_events       = 0UL;
    g_open_loop_stop_stale_ticks     = 0UL;
    g_open_loop_stop_pwm             = 0U;
    g_open_loop_stop_ost             = 0U;
    g_open_loop_stop_tzint           = 0U;
    g_open_loop_stop_fault           = 0UL;
    g_open_loop_stop_timer2          = 0UL;
    s_win_vout_sum = 0UL; s_win_ipri_sum = 0UL;
    s_win_fresh_count = 0UL; s_win_tick_count = 0UL;
    s_steady_window_count = 0UL;
    s_last_adc_sequence = 0UL;
#if STAGE6_OPEN_LOOP_STEADY_BUILD && STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    g_open_loop_ne_test_enable  = 0U;
    g_open_loop_ne_entry_request = 0U;
    g_open_loop_ne_exit_request = 0U;
    g_open_loop_ne_actuator_arm = 0U;
    g_open_loop_ne_max_hold_ticks = 0UL;
    g_open_loop_ne_tick = 0UL;
#endif
}

void OPENLOOP_NotifyEntry(void)
{
    Uint32 eff;

    if (g_open_loop_steady_active != 0U) return;

    g_open_loop_win_mean_raw = 0U;
    g_open_loop_win_prev_mean_raw = 0U;
    g_open_loop_win_min_raw = 0U;
    g_open_loop_win_max_raw = 0U;
    g_open_loop_win_ipri_mean_raw = 0U;
    g_open_loop_win_ipri_max_raw = 0U;
    g_open_loop_win_compsts_high = 0UL;
    g_open_loop_win_stale_ticks = 0UL;
    g_open_loop_win_index = 0UL;
    g_open_loop_ss_ticks = 0UL;
    g_open_loop_ss_vout_sum = 0UL;
    g_open_loop_ss_min_raw = 0U;
    g_open_loop_ss_max_raw = 0U;
    g_open_loop_ss_ipri_sum = 0UL;
    g_open_loop_ss_ipri_max_raw = 0U;
    g_open_loop_ticks_active = 0UL;
    g_open_loop_slew_done_tick = 0UL;
    g_open_loop_settle_ms = 0UL;
    g_open_loop_steady_ticks = 0UL;
    g_open_loop_steady_reached = 0U;
    g_open_loop_stop_reason = OL_STOP_NONE;
    g_open_loop_upper_gain_boundary = 0U;
    s_win_vout_sum = 0UL; s_win_ipri_sum = 0UL;
    s_win_fresh_count = 0UL; s_win_tick_count = 0UL;
    s_steady_window_count = 0UL;
    s_last_adc_sequence = g_adc_sample_sequence;

    g_open_loop_entry_hz   = OPEN_LOOP_ENTRY_FREQ_HZ;
    g_open_loop_applied_hz = OPEN_LOOP_ENTRY_FREQ_HZ;
    eff = OL_ClampHz(g_open_loop_frequency_command_hz);
    g_open_loop_cmd_effective_hz = eff;
    g_open_loop_steady_active = 1U;
    if (OPEN_LOOP_ENTRY_FREQ_HZ == eff)
    {
        g_open_loop_phase = OL_PHASE_SETTLING;
    }
    else
    {
        g_open_loop_phase = OL_PHASE_SLEWING;
    }
}

void OPENLOOP_NotifyExit(void)
{
    if (g_open_loop_steady_active == 0U) return;
    OL_FreezeStop(OL_STOP_HOST);
}

void OPENLOOP_FastTask(void)
{
    Uint16 raw_protect, raw_stat, fresh;

    if (g_open_loop_steady_active == 0U) return;

    fresh = (g_adc_sample_sequence != s_last_adc_sequence) ? 1U : 0U;
    if (fresh != 0U) s_last_adc_sequence = g_adc_sample_sequence;

    raw_protect = g_adc_vout_raw;             /* unfiltered: fastest guard */
    raw_stat    = g_adc_vout_filtered_raw;    /* filtered: statistics */
    OPENLOOP_Step(raw_protect, raw_stat, fresh);
}

#if STAGE6_OPEN_LOOP_STEADY_BUILD && STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
void OPENLOOP_NoEnergyTick(void)
{
    if (g_open_loop_ne_test_enable == 0U) return;
    g_open_loop_ne_tick++;
    if (g_open_loop_ne_entry_request != 0U)
    {
        g_open_loop_ne_entry_request = 0U;
        OPENLOOP_NotifyEntry();
    }
    if (g_open_loop_ne_exit_request != 0U)
    {
        g_open_loop_ne_exit_request = 0U;
        OPENLOOP_NotifyExit();
    }
    OPENLOOP_Step(g_open_loop_ne_raw, g_open_loop_ne_raw, 1U);
}
#endif

#endif /* STAGE6_OPEN_LOOP_STEADY_BUILD */
