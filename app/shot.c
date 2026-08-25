/*
 * shot.c
 *
 * Bounded FIRST real PI shot state machine (STAGE6_FIRST_BOUNDED_REAL_PI_SHOT).
 * See shot.h. All code is ASCII-only so it is safe under either GBK or UTF-8.
 * Everything is compiled out of the production build (macro undefined).
 */
#include "DSP2803x_Device.h"
#include "llc_config.h"
#include "board_calibration.h"
#include "llc_globals.h"
#include "soft_start.h"
#include "pwm.h"
#include "shot.h"

/* ------------------------------------------------------------------ */
/* Non-static shot globals (CCS-visible by name).                      */
/* ------------------------------------------------------------------ */
volatile Uint16 g_first_real_pi_shot_build       = 0U;
volatile Uint16 g_first_real_pi_shot_arm         = 0U;
volatile Uint16 g_first_real_pi_shot_state       = SHOT_STATE_IDLE;
volatile Uint16 g_first_real_pi_shot_tick        = 0U;
volatile Uint16 g_first_real_pi_shot_abort       = SHOT_ABORT_NONE;
volatile Uint16 g_first_real_pi_shot_power_writes= 0U;
volatile Uint16 g_first_real_pi_shot_ok          = 0U;
volatile Uint16 g_first_real_pi_shot_abort_vout_raw = 0U;
/* H: Timer2 captures for the first-write -> OST elapsed proof. */
volatile Uint32 g_first_real_pi_shot_first_write_timer2 = 0UL;
volatile Uint32 g_first_real_pi_shot_ost_timer2          = 0UL;
#if !STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD
/* Test-only debug overrides: compiled OUT of the REAL shot binary. */
volatile Uint32 g_first_shot_debug_freq_hz       = 0UL;
volatile Uint16 g_first_shot_debug_ticks         = 0U;
#endif
/* 40 us split pipeline (RECOVERY V1 A/B/E): phase state + pending + summary.
 * g_pipeline_executed_phase is set by the ISR control path this tick (0 =
 * compute, 1 = apply, 0xFF = none) and used by the exit measurement to
 * classify whole-ISR cost per phase. */
volatile Uint16 g_pipeline_phase = PIPELINE_PHASE_COMPUTE;
volatile Uint16 g_pipeline_executed_phase = 0xFFU;
SHOT_PipelinePending g_pipeline_pending;
SHOT_ShotSummary g_shot_summary;
/* ------------------------------------------------------------------ */
void SHOT_Init(void)
{
    g_first_real_pi_shot_arm    = 0U;
    g_first_real_pi_shot_state  = SHOT_STATE_IDLE;
    g_first_real_pi_shot_tick   = 0U;
    g_first_real_pi_shot_abort  = SHOT_ABORT_NONE;
    g_first_real_pi_shot_power_writes = 0U;
    g_first_real_pi_shot_ok     = 0U;
    g_pipeline_phase            = PIPELINE_PHASE_COMPUTE;
    g_pipeline_executed_phase   = 0xFFU;
    g_pipeline_pending.valid    = 0U;
    g_pipeline_pending.sequence = 0UL;
    g_pipeline_pending.command_hz = 0UL;
    g_pipeline_pending.period   = 0U;
    g_pipeline_pending.cmpa     = 0U;
    g_pipeline_pending.cmpb     = 0U;
    g_pipeline_pending.actual_hz = 0UL;
    g_shot_summary.first_command_hz  = 0UL;
    g_shot_summary.first_tbprd       = 0U;
    g_shot_summary.first_actual_hz   = 0UL;
    g_shot_summary.last_command_hz   = 0UL;
    g_shot_summary.max_command_hz    = 0UL;
    g_shot_summary.min_command_hz    = 0UL;
    g_shot_summary.max_vout_raw      = 0U;
    g_shot_summary.fast_ticks        = 0UL;
    g_shot_summary.pi_compute_count  = 0UL;
    g_shot_summary.pwm_apply_count   = 0UL;
    g_shot_summary.abort_reason      = SHOT_ABORT_NONE;
    g_shot_summary.first_apply_timer2 = 0UL;
    g_shot_summary.ost_timer2         = 0UL;
    g_shot_summary.entry_interval_max_shot = 0UL;
    g_shot_summary.entry_interval_min_shot = 0UL;
    g_shot_summary.entry_over_1230_count = 0UL;
    g_shot_summary.entry_over_1500_count = 0UL;
    g_shot_summary.entry_over_2400_count = 0UL;
    g_shot_summary.entry_adjacent_max_shot = 0UL;
    g_shot_summary.first_error_raw    = 0;
    g_shot_summary.last_error_raw     = 0;
    g_shot_summary.min_error_raw      = 0;
    g_shot_summary.max_error_raw      = 0;
    g_shot_summary.fresh_compute_count = 0UL;
    g_shot_summary.stale_compute_count = 0UL;
    g_shot_summary.consecutive_stale_count = 0U;
    g_shot_summary.first_adc_sample_sequence = 0UL;
    g_shot_summary.last_adc_sample_sequence = 0UL;
    g_shot_summary.first_consumed_sequence = 0UL;
    g_shot_summary.last_consumed_sequence = 0UL;
    g_shot_summary.first_control_vout_raw = 0U;
    g_shot_summary.last_control_vout_raw = 0U;
    g_shot_summary.min_control_vout_raw = 0U;
    g_shot_summary.max_control_vout_raw = 0U;
    g_shot_summary.first_vref_raw = 0U;
    g_shot_summary.last_vref_raw = 0U;
    g_shot_summary.abort_adc_vout_raw = 0U;
    g_shot_summary.abort_filtered_vout_raw = 0U;
    g_shot_summary.abort_control_vout_raw = 0U;
    g_shot_summary.abort_control_error_raw = 0;
    g_shot_summary.abort_frequency_hz = 0UL;
    g_shot_summary.abort_pipeline_phase = 0U;
    g_shot_summary.abort_adc_sequence = 0UL;
    g_shot_summary.abort_consumed_sequence = 0UL;
    g_shot_summary.abort_timer2 = 0UL;
#if STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD
    g_shot_entry_interval_max = 0UL;
    g_shot_entry_interval_min = 0UL;
    g_shot_entry_over_1230_count = 0UL;
    g_shot_entry_over_1500_count = 0UL;
    g_shot_entry_over_2400_count = 0UL;
    g_shot_entry_adjacent_prev = 0UL;
    g_shot_entry_adjacent_max = 0UL;
    g_shot_entry_last         = 0UL;
#endif
#if !STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD
    g_first_shot_debug_freq_hz    = 0UL;
    g_first_shot_debug_ticks      = 0U;
#endif
    /* 11 V fast-abort raw threshold computed from board_calibration.h, never a
     * hand-written magic number: raw = (11.0 - offset) / gain. */
    g_first_real_pi_shot_abort_vout_raw =
        (Uint16)((11.0f - BOARD_VOUT_OFFSET_V) / BOARD_VOUT_GAIN_V_PER_RAW);
#if STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
    g_first_real_pi_shot_build = 1U;
    g_burst_enabled = 1U;   /* tutorial Burst entry active in bounded-shot candidate */
#endif
    g_burst_active = 0U;
    g_burst_state = BURST_STATE_NONE;
    g_ost_owner = OST_OWNER_UNKNOWN;
    g_burst_enter_count = 0UL;
    g_burst_exit_count = 0UL;
    g_burst_restart_attempt_count = 0UL;
    g_burst_restart_success_count = 0UL;
    g_burst_restart_fail_count = 0UL;
    g_burst_stale_restart_count = 0UL;
    g_burst_test_fresh_count = 0UL;
    g_burst_test_high_count = 0UL;
    g_burst_test_low_count = 0UL;
    g_burst_shadow_base_frequency_hz = 0UL;
    g_burst_off_fresh_compute_count = 0UL;
    g_burst_off_apply_count = 0UL;
    g_burst_off_first_shadow_hz = 0UL;
    g_burst_off_last_shadow_hz = 0UL;
    g_burst_off_min_shadow_hz = 0UL;
    g_burst_off_first_period = 0U;
    g_burst_off_last_period = 0U;
    g_burst_timeout_shadow_hz = 0UL;
    g_burst_timeout_period = 0U;
    g_burst_timeout_error_raw = 0;
    g_burst_off_apply_discard_count = 0UL;
    g_burst_restart_timer2 = 0UL;
    g_burst_entry_to_restart_delta = 0UL;
    g_burst_entry_hw_trip_count = 0UL;
    g_burst_entry_active_trip_count = 0UL;
    g_burst_restart_snapshot_period = 0U;
    g_burst_restart_snapshot_cmpa = 0U;
    g_burst_restart_snapshot_actual_hz = 0UL;
    g_burst_restart_snapshot_frequency_hz = 0UL;
    g_burst_restart_snapshot_sequence = 0UL;
}

/* ------------------------------------------------------------------ */
/* D: independent first-shot authorization. All conditions must hold.  */
/* ------------------------------------------------------------------ */
Uint16 SHOT_PermissionOk(void)
{
#if STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
    if (g_first_real_pi_shot_arm == 0U)      return 0U;
    if (g_bringup_stage < BRINGUP_STAGE_6_CLOSED_LOOP) return 0U;
    if (g_softstart_handoff_result != HANDOFF_RESULT_OK) return 0U;
    if (g_control_reference_valid == 0U)     return 0U;
    if (g_board_vout_cal_valid == 0U)        return 0U;
    if (g_comp_tz_loopback_verified == 0U)   return 0U;
    if (g_fault_flags != 0U)                 return 0U;
    return 1U;
#else
    return 0U;
#endif
}

/* ------------------------------------------------------------------ */
/* F2: bounded-shot limited authorization for formal Stage6 Profile C. */
/* Only in the REAL build, and only when the shot is pre-armed and every */
/* bounded-shot condition holds, may formal Stage6 closed-loop startup  */
/* proceed WITHOUT globally unlocking LLC_CONTROL_DIRECTION or faking   */
/* g_iout_amps (IOUT absolute calibration is pending; fast OCP is       */
/* Comparator->TZ1->OST). Stage7 stays blocked (LLC_POWER_RUN_ALLOWED=0).*/
/* ------------------------------------------------------------------ */
Uint16 SHOT_RealStage6AuthOk(void)
{
#if STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD
    if (g_bringup_stage != BRINGUP_STAGE_6_CLOSED_LOOP) return 0U;
    if (g_first_real_pi_shot_arm == 0U)                 return 0U;
    if (g_board_vout_cal_valid == 0U)                   return 0U;
    if (g_comp_tz_loopback_verified == 0U)              return 0U;
    if (g_fault_flags != 0U)                            return 0U;
    if (g_pwm_enabled != 0U)                            return 0U;   /* PWM initial off */
    if (EPwm1Regs.TZFLG.bit.OST == 0U)                 return 0U;   /* OST initial latched */
    return 1U;
#else
    return 0U;
#endif
}

/* ------------------------------------------------------------------ */
/* C: runtime SoftStart limited authorization (REAL build only).       */
/* True while the formal Profile C ramp is actually running: Stage6,   */
/* shot pre-armed, board VOUT cal valid, Comp/TZ loopback verified,   */
/* no fault, system in SOFT_START, ramp not complete/aborted. This is */
/* the context that lets PWM_RuntimeValuesValid accept the verified    */
/* 250 kHz / TBPRD239 / DB110 .. 150 kHz / TBPRD399 / DB36 trajectory  */
/* and lets PROT_SlowTask raise the frequency ceiling to 250 kHz.      */
/* ------------------------------------------------------------------ */
Uint16 SHOT_RealSoftStartAuthOk(void)
{
#if STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD
    if (g_bringup_stage != BRINGUP_STAGE_6_CLOSED_LOOP) return 0U;
    if (g_first_real_pi_shot_arm == 0U)                 return 0U;
    if (g_board_vout_cal_valid == 0U)                   return 0U;
    if (g_comp_tz_loopback_verified == 0U)              return 0U;
    if (g_fault_flags != 0U)                            return 0U;
    if (g_system_state != SYS_STATE_SOFT_START)         return 0U;
    if (g_softstart_state == SOFTSTART_COMPLETE ||
        g_softstart_state == SOFTSTART_ABORTED)        return 0U;
    return 1U;
#else
    return 0U;
#endif
}

/* ------------------------------------------------------------------ */
/* C: bounded PI limited authorization (REAL build only).              */
/* True only during the bounded 1ms PI window after the 10V handoff: */
/* Stage6, shot pre-armed, handoff OK, reference valid, VOUT cal,      */
/* Comp/TZ loopback verified, no fault, system in RUN. This is the     */
/* context that lets PROT_SlowTask cap the frequency at                */
/* FIRST_REAL_PI_MAX_HZ (145..170 kHz) and bypass the global           */
/* calibration/direction gates for the bounded window only.            */
/* ------------------------------------------------------------------ */
Uint16 SHOT_RealBoundedPiAuthOk(void)
{
#if STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD
    if (g_bringup_stage != BRINGUP_STAGE_6_CLOSED_LOOP) return 0U;
    if (g_first_real_pi_shot_arm == 0U)                 return 0U;
    if (g_softstart_handoff_result != HANDOFF_RESULT_OK) return 0U;
    if (g_control_reference_valid == 0U)                return 0U;
    if (g_board_vout_cal_valid == 0U)                   return 0U;
    if (g_comp_tz_loopback_verified == 0U)              return 0U;
    if (g_fault_flags != 0U)                            return 0U;
    if (g_system_state != SYS_STATE_RUN)                return 0U;
    return 1U;
#else
    return 0U;
#endif
}


/* ------------------------------------------------------------------ */
/* D per-tick write gate. The full permission set is checked on the very
 * first shot write (IDLE/ARMED -> ACTIVE); once ACTIVE, only the dynamic
 * conditions that can change during the 1 ms window are re-checked per
 * tick (a fault appearing, or an explicit revoke) to keep the 20 us budget.
 * The static conditions (stage, handoff, reference valid, VOUT cal, Comp/TZ
 * armed) are fixed at handoff and cannot change during the bounded shot. */
Uint16 SHOT_WriteAllowed(void)
{
#if STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
    if (g_first_real_pi_shot_state != SHOT_STATE_ACTIVE)
    {
        return SHOT_PermissionOk();
    }
    if (g_fault_flags != 0U)       return 0U;
    if (g_first_real_pi_shot_arm == 0U) return 0U;
    return 1U;
#else
    return 0U;
#endif
}

/* ------------------------------------------------------------------ */
/* B: clamp the commanded frequency into the first-shot envelope.     */
/* ------------------------------------------------------------------ */
Uint16 SHOT_ClampFreq(Uint32 *p_hz)
{
#if STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
    if (*p_hz < FIRST_REAL_PI_MIN_HZ) { *p_hz = FIRST_REAL_PI_MIN_HZ; return 1U; }
    if (*p_hz > FIRST_REAL_PI_MAX_HZ) { *p_hz = FIRST_REAL_PI_MAX_HZ; return 1U; }
#endif
    return 0U;
}

/* ------------------------------------------------------------------ */
/* B: pending validation for PHASE_APPLY. All conditions are re-checked
 * in the apply tick, right before the PWM registers are touched:
 *   - pending.valid == 1 (a compute phase produced it, not yet committed)
 *   - command inside 145..170 kHz and period inside 352..413
 *   - period <-> command consistency verified by multiplication only
 *     (same rounding as the reference divide: clocks*hz <= sum < (clocks+1)*hz)
 * Any failure -> the apply phase discards the pending and stops the shot
 * (SHOT_Revoke(SHOT_ABORT_ACTUATOR): OST, PWM=0, abort, no further run).
 * The pending is never committed twice: commit clears valid. */
/* ------------------------------------------------------------------ */
Uint16 SHOT_PendingValid(void)
{
#if STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
    const SHOT_PipelinePending *p = &g_pipeline_pending;
    Uint32 sum, clocks;
    if (p->valid == 0U) return 0U;
    if (p->command_hz < FIRST_REAL_PI_MIN_HZ || p->command_hz > FIRST_REAL_PI_MAX_HZ) return 0U;
    if (p->period < 352U || p->period > 413U) return 0U;
    sum = LLC_TBCLK_HZ + (p->command_hz / 2UL);
    clocks = (Uint32)p->period + 1UL;
    if (clocks * p->command_hz > sum) return 0U;            /* period too large */
    if ((clocks + 1UL) * p->command_hz <= sum) return 0U;  /* period too small */
    return 1U;
#else
    return 0U;
#endif
}

/* ------------------------------------------------------------------ */
/* B: full apply-phase authorization (re-verified on every apply tick):
 * the complete PermissionOk set (arm / Stage6 / handoff OK / reference
 * valid / VOUT calibration valid / Comparator+TZ verified / no fault)
 * plus system == RUN. The pending content itself is checked by
 * SHOT_PendingValid. */
/* ------------------------------------------------------------------ */
Uint16 SHOT_PipelineApplyAuthorized(void)
{
#if STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
    if (SHOT_PermissionOk() == 0U)      return 0U;
    if (g_system_state != SYS_STATE_RUN) return 0U;
    return 1U;
#else
    return 0U;
#endif
}

/* ------------------------------------------------------------------ */
/* B/A: commit a validated pending. Writes the PWM registers ONLY here
 * (never in PHASE_COMPUTE): TBPRD/CMPA when the period actually moved,
 * plus the ADC sampling-phase sync (CMPB/SOCA cadence) exactly like the
 * single-phase actuator did. Software state (period, switching/actual
 * frequency) is committed together; pending.valid is cleared so the same
 * pending can never be committed twice. */
/* ------------------------------------------------------------------ */
void SHOT_PendingCommit(void)
{
    SHOT_PipelinePending *p = &g_pipeline_pending;
    Uint16 period = p->period;
    if (period != (Uint16)g_pwm_period)
    {
        DINT;
        EPwm1Regs.TBPRD = period;
        EPwm1Regs.CMPA.half.CMPA = p->cmpa;
        EINT;
        ADC_UpdatePwmSyncPointKeepCadence(period);
    }
    g_pwm_period = period;
    g_switching_frequency_hz = p->command_hz;
    g_actual_switching_frequency_hz = p->actual_hz;
    p->valid = 0U;   /* consumed: no double commit */
}

/* ------------------------------------------------------------------ */
/* On-chip termination. reason==SHOT_ABORT_TIMEOUT is the normal bounded
 * end (COMPLETE, exit RUN, no fault). Everything else aborts to FAULT. */
/* ------------------------------------------------------------------ */
void SHOT_Revoke(Uint16 reason)
{
    g_first_real_pi_shot_abort = reason;
    g_first_real_pi_shot_arm   = 0U;   /* revoke PI write permission */
    g_shot_summary.abort_reason = reason;   /* E: ISR-side summary */

    /* STAGE6_500US_COMPUTE_FASTPATH_PENDING_ATOMIC_CLOSURE_V1:
     * atomically discard any uncommitted pending and reset pipeline phase on
     * EVERY termination path so a later start can never reuse old pending and
     * a revoke can never be followed by a pending commit. */
    g_pipeline_pending.valid = 0U;
    g_pipeline_executed_phase = 0xFFU;
    g_pipeline_phase = PIPELINE_PHASE_COMPUTE;

    /* Freeze last-sample / final-command telemetry from live global state on
     * every termination path (TIMEOUT and aborts). */
    g_shot_summary.last_adc_sample_sequence = g_adc_sample_sequence;
    g_shot_summary.last_consumed_sequence   = g_control_adc_sequence_consumed;
    g_shot_summary.last_control_vout_raw    = g_control_vout_raw;
    g_shot_summary.last_vref_raw            = g_control_vref_raw;
    g_shot_summary.last_error_raw           = g_control_error_raw;
    g_shot_summary.last_command_hz          = g_control_frequency_hz;

    if (reason == SHOT_ABORT_TIMEOUT)
    {
        /* E: auto-OST at 1 ms. Capture Timer2 BEFORE the planned OST, then
         * use LLC_PWM_DisableSafe() to perform the planned block. That routine
         * disables the TZ OST interrupt before forcing OST and immediately
         * classifies the window as POST_OST, so a normal 1 ms timeout cannot
         * be mistaken for an ACTIVE-window TZ fault. */
        g_first_real_pi_shot_ost_timer2 = CpuTimer2Regs.TIM.all;   /* H */
        g_shot_summary.ost_timer2       = g_first_real_pi_shot_ost_timer2;
        LLC_PWM_DisableSafe();          /* planned block: TZ OST latch + POST_OST */
        g_first_real_pi_shot_state = SHOT_STATE_COMPLETE;
        g_first_real_pi_shot_ok    = 1U;
        g_pwm_enabled              = 0U;
        g_pwm_enable_result        = 0U;
        g_system_state             = SYS_STATE_IDLE;   /* exit RUN */
        g_power_window_state       = POWER_WINDOW_POST_OST; /* explicit closure */
#if STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD
        g_shot_summary.entry_interval_max_shot = g_shot_entry_interval_max; /* freeze shot-local entry max */
        g_shot_summary.entry_interval_min_shot = g_shot_entry_interval_min;
        g_shot_summary.entry_over_1230_count   = g_shot_entry_over_1230_count;
        g_shot_summary.entry_over_1500_count   = g_shot_entry_over_1500_count;
        g_shot_summary.entry_over_2400_count   = g_shot_entry_over_2400_count;
        g_shot_summary.entry_adjacent_max_shot = g_shot_entry_adjacent_max;
#endif
        return;
    }

#if STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD
    if (reason == SHOT_ABORT_NO_HANDOFF)
    {
        /* G6 acceptance: no-handoff is a planned stop, not a fault. Use
         * LLC_PWM_DisableSafe() to enter POST_OST cleanly and leave ACTIVE. */
        g_first_real_pi_shot_ost_timer2 = CpuTimer2Regs.TIM.all;
        g_shot_summary.ost_timer2       = g_first_real_pi_shot_ost_timer2;
        LLC_PWM_DisableSafe();
        g_first_real_pi_shot_state = SHOT_STATE_ABORTED;
        g_first_real_pi_shot_ok    = 0U;
        g_pwm_enabled              = 0U;
        g_pwm_enable_result        = 0U;
        g_system_state             = SYS_STATE_IDLE;
        g_power_window_state       = POWER_WINDOW_POST_OST;
        return;
    }
#endif

    /* Abort paths -> FAULT (OST + PWM disabled + fault flag). */
    g_first_real_pi_shot_state = SHOT_STATE_ABORTED;

    /* Freeze abort-instant telemetry BEFORE latching the fault. */
#if STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD
    g_shot_summary.entry_interval_max_shot = g_shot_entry_interval_max;
    g_shot_summary.entry_interval_min_shot = g_shot_entry_interval_min;
    g_shot_summary.entry_over_1230_count   = g_shot_entry_over_1230_count;
    g_shot_summary.entry_over_1500_count   = g_shot_entry_over_1500_count;
    g_shot_summary.entry_over_2400_count   = g_shot_entry_over_2400_count;
    g_shot_summary.entry_adjacent_max_shot = g_shot_entry_adjacent_max;
#endif
    g_shot_summary.abort_adc_vout_raw       = g_adc_vout_raw;
    g_shot_summary.abort_filtered_vout_raw  = g_adc_vout_filtered_raw;
    g_shot_summary.abort_control_vout_raw   = g_control_vout_raw;
    g_shot_summary.abort_control_error_raw  = g_control_error_raw;
    g_shot_summary.abort_frequency_hz       = g_control_frequency_hz;
    g_shot_summary.abort_pipeline_phase     = g_pipeline_phase;
    g_shot_summary.abort_adc_sequence       = g_adc_sample_sequence;
    g_shot_summary.abort_consumed_sequence  = g_control_adc_sequence_consumed;
    g_shot_summary.abort_timer2             = CpuTimer2Regs.TIM.all;

    if (reason == SHOT_ABORT_VOUT_11V)
    {
        /* F: 11 V fast VOUT abort. Record FIRST_SHOT_ABORT_VOUT and close the
         * power window as POST_OST so the abort is not misread as ACTIVE_TZ. */
        PWM_Trip(FAULT_FIRST_SHOT_ABORT, 0U);
        g_power_window_state = POWER_WINDOW_POST_OST;
    }
    else if (reason == SHOT_ABORT_TZ)
    {
        PWM_Trip(FAULT_COMP_TZ1, 0U);
    }
    else if (reason == SHOT_ABORT_ACTUATOR)
    {
        PWM_Trip(FAULT_FIRST_SHOT_ABORT, 0U);
    }
    else /* SHOT_ABORT_FAULT / SHOT_ABORT_PERMISSION */
    {
        PWM_Trip(FAULT_FIRST_SHOT_ABORT, 0U);
    }
}

/* ------------------------------------------------------------------ */
/* G: real Comparator/TZ trip -> immediate revoke (call from TZ ISR).  */
/* ------------------------------------------------------------------ */
void SHOT_OnTrip(void)
{
    g_first_real_pi_shot_abort = SHOT_ABORT_TZ;
    g_first_real_pi_shot_arm   = 0U;
    g_first_real_pi_shot_state = SHOT_STATE_ABORTED;
}

/* STAGE6_TUTORIAL_LIGHTLOAD_BURST_ENTRY_RESTORE_V1:
 * Tutorial-style normal Burst entry. PWM is shut down through the existing
 * safe OST path (LLC_PWM_DisableSafe), not GPIO MUX. No fault, no auto
 * restart. This round only enters Burst. */
void SHOT_EnterTutorialBurst(void)
{
    g_burst_active = 1U;
    g_burst_enter_count++;
    g_first_real_pi_shot_arm   = 0U;
    g_pipeline_pending.valid   = 0U;
    g_pipeline_executed_phase  = 0xFFU;
    g_pipeline_phase           = PIPELINE_PHASE_COMPUTE;
    LLC_PWM_DisableSafe();
    g_first_real_pi_shot_abort = SHOT_ABORT_TUTORIAL_BURST_ENTRY;
    g_shot_summary.abort_reason = SHOT_ABORT_TUTORIAL_BURST_ENTRY;
    g_first_real_pi_shot_state = SHOT_STATE_COMPLETE;
    g_first_real_pi_shot_ok    = 1U;
    g_pwm_enabled              = 0U;
    g_pwm_enable_result        = 0U;
    g_system_state             = SYS_STATE_IDLE;
    g_power_window_state       = POWER_WINDOW_POST_OST;
}

/* STAGE6_TUTORIAL_BURST_RESTART_PATH_ACTIVATION_FIX_V1_2:
 * Strict gate allowing shadow PI/control to keep running during Burst OFF
 * even though g_pwm_enabled==0. */
Uint16 SHOT_BurstShadowControlAllowed(void)
{
#if STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    if (g_stage6_noenergy_test_mode == 6U) return 0U;  /* Mode6 hook drives alone */
#endif
    if (g_burst_enabled == 0U) return 0U;
    if (g_burst_active == 0U) return 0U;
    if (g_burst_state != BURST_STATE_OFF_WAIT &&
        g_burst_state != BURST_STATE_RESTART_ARMED) return 0U;
    if (g_ost_owner != OST_OWNER_BURST_SOFTWARE) return 0U;
    if (g_first_real_pi_shot_arm == 0U) return 0U;
    if (g_system_state != SYS_STATE_RUN) return 0U;
    if (g_fault_flags != 0UL) return 0U;
    if (g_board_vout_cal_valid == 0U) return 0U;
    if (g_comp_tz_loopback_verified == 0U) return 0U;
    if (EPwm1Regs.TZFLG.bit.OST == 0U) return 0U;
    return 1U;
#else
    return 0U;
#endif
}

/* STAGE6_TUTORIAL_BURST_RESTART_NOENERGY_CLOSURE_V1_1:
 * Enter Burst OFF but keep the control task running (not COMPLETE). */
void SHOT_BurstEnter(void)
{
    g_burst_active = 1U;
    g_burst_state  = BURST_STATE_OFF_WAIT;
    g_burst_enter_count++;
    g_ost_owner = OST_OWNER_BURST_SOFTWARE;
    g_burst_entry_vout_raw      = g_control_vout_raw;
    g_burst_entry_error_raw     = g_control_error_raw;
    g_burst_entry_period        = g_pipeline_pending.period;
    g_burst_entry_frequency_hz  = g_pipeline_pending.command_hz;
    g_burst_entry_adc_sequence  = g_adc_sample_sequence;
    g_burst_entry_timer2        = CpuTimer2Regs.TIM.all;
    g_burst_entry_hw_trip_count = g_tz_hardware_trip_count;
    g_burst_entry_active_trip_count = g_tz_active_window_trip_count;
    g_burst_shadow_base_frequency_hz = g_pipeline_pending.command_hz;
    g_burst_off_first_shadow_hz = g_pipeline_pending.command_hz;
    g_burst_off_min_shadow_hz   = g_pipeline_pending.command_hz;
    g_burst_off_first_period    = g_pipeline_pending.period;
    g_pipeline_pending.valid    = 0U;
    g_pipeline_executed_phase   = 0xFFU;
    g_pipeline_phase            = PIPELINE_PHASE_COMPUTE;
    LLC_PWM_DisableSafe();
    /* Keep shot ACTIVE and keep the 500us safety cage alive. */
    g_first_real_pi_shot_state = SHOT_STATE_ACTIVE;
    g_first_real_pi_shot_first_write_timer2 = g_burst_entry_timer2;
}

/* STAGE6_TUTORIAL_BURST_RESTART_NOENERGY_CLOSURE_V1_1:
 * One deterministic restart, then final safe stop. */
void SHOT_BurstRestart(void)
{
    Uint16 period;
    Uint32 actual;

    if (g_burst_state == BURST_STATE_OFF_WAIT)
    {
        /* Tick A: snapshot the validated pending and enter RESTART_ARMED. */
        g_burst_state = BURST_STATE_RESTART_ARMED;
        g_burst_exit_count++;
        g_burst_restart_attempt_count++;
        g_burst_exit_vout_raw     = g_control_vout_raw;
        g_burst_exit_error_raw    = g_control_error_raw;
        g_burst_exit_period       = g_pipeline_pending.period;
        g_burst_exit_frequency_hz = g_pipeline_pending.command_hz;
        g_burst_exit_adc_sequence = g_adc_sample_sequence;
        g_burst_exit_timer2       = CpuTimer2Regs.TIM.all;
        g_burst_restart_snapshot_period    = g_pipeline_pending.period;
        g_burst_restart_snapshot_cmpa      = (Uint16)((g_pipeline_pending.period + 1UL) >> 1);
        g_burst_restart_snapshot_actual_hz = g_pipeline_pending.actual_hz;
        g_burst_restart_snapshot_frequency_hz = g_pipeline_pending.command_hz;
        g_burst_restart_snapshot_sequence  = g_pipeline_pending.sequence;
        g_pipeline_pending.valid = 0U;
        g_pipeline_executed_phase = PIPELINE_PHASE_APPLY;
        return;
    }

    if (g_burst_state == BURST_STATE_RESTART_ARMED)
    {
        /* Tick B: prepare deterministic start. */
        period = g_burst_restart_snapshot_period;
        actual = g_burst_restart_snapshot_actual_hz;
        g_burst_restart_pre_ost = EPwm1Regs.TZFLG.bit.OST;
        g_burst_restart_timer2 = CpuTimer2Regs.TIM.all;
        g_burst_entry_to_restart_delta =
            (Uint32)((Uint32)(g_burst_entry_timer2 - g_burst_restart_timer2) & 0xFFFFFFFFUL);
        if (PWM_PrepareStart(period, 36U, 0U) == 1U)
        {
            g_burst_state = BURST_STATE_RESTART_PREPARED;
            g_pipeline_executed_phase = PIPELINE_PHASE_APPLY;
        }
        else
        {
            g_burst_restart_fail_count++;
            LLC_PWM_DisableSafe();
            g_burst_state = BURST_STATE_FINAL_SAFE_STOP;
            g_first_real_pi_shot_abort = SHOT_ABORT_TUTORIAL_BURST_ENTRY;
            g_shot_summary.abort_reason = SHOT_ABORT_TUTORIAL_BURST_ENTRY;
            g_first_real_pi_shot_state = SHOT_STATE_COMPLETE;
            g_first_real_pi_shot_ok    = 0U;
            g_first_real_pi_shot_arm   = 0U;
            g_pipeline_pending.valid   = 0U;
            g_pipeline_executed_phase  = 0xFFU;
            g_pipeline_phase           = PIPELINE_PHASE_COMPUTE;
            g_pwm_enabled              = 0U;
            g_pwm_enable_result        = 0U;
            g_system_state             = SYS_STATE_IDLE;
            g_power_window_state       = POWER_WINDOW_POST_OST;
        }
        return;
    }

    if (g_burst_state == BURST_STATE_RESTART_PREPARED)
    {
        /* Tick C: start deterministic PWM. */
        period = g_burst_restart_snapshot_period;
        actual = g_burst_restart_snapshot_actual_hz;
        PWM_StartDeterministic();
        g_burst_restart_post_ost = EPwm1Regs.TZFLG.bit.OST;
        g_burst_restart_tbctr    = EPwm1Regs.TBCTR;
        g_burst_restart_tbprd    = EPwm1Regs.TBPRD;
        g_burst_restart_actual_frequency_hz = actual;
        g_burst_restart_success_count++;
        g_burst_state = BURST_STATE_RESTARTED;
        g_pipeline_executed_phase = PIPELINE_PHASE_APPLY;
        return;
    }
}


void SHOT_FastTask(void)
{
    /* A: advance the pipeline phase for the next tick (compute -> apply ->
     * compute ...) on EVERY tick where a phase executed, regardless of the
     * shot state (the first compute runs while still ARMED). Ticks where
     * neither phase executed leave the phase unchanged so the alternation
     * cannot drift. */
    if (g_pipeline_executed_phase != 0xFFU)
        g_pipeline_phase = (Uint16)(1U - g_pipeline_executed_phase);

#if STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
    if (g_first_real_pi_shot_state != SHOT_STATE_ACTIVE)
    {
        /* G2: while armed (pre-handoff / during formal SoftStart), any fault or
         * SYS_STATE_FAULT (e.g. formal SoftStart abort / stale ADC / ceiling)
         * revokes the arm so a later handoff cannot activate the shot. */
        if (g_first_real_pi_shot_arm != 0U &&
            (g_fault_flags != 0U || g_system_state == SYS_STATE_FAULT))
        {
            g_first_real_pi_shot_arm   = 0U;
            g_first_real_pi_shot_state = SHOT_STATE_ABORTED;
            g_first_real_pi_shot_abort = SHOT_ABORT_PERMISSION;
            g_shot_summary.abort_reason = SHOT_ABORT_PERMISSION;
        }
        return;
    }

    /* E: max VOUT raw (whole shot), cheap per-tick compare. */
    if (g_adc_vout_filtered_raw > (Uint16)g_shot_summary.max_vout_raw)
        g_shot_summary.max_vout_raw = g_adc_vout_filtered_raw;

    /* F: fast 11 V VOUT abort. */
    if (g_adc_vout_filtered_raw >= g_first_real_pi_shot_abort_vout_raw)
    {
        SHOT_Revoke(SHOT_ABORT_VOUT_11V);
        return;
    }

    /* D: a fault appearing mid-shot revokes immediately (the full permission
     * gate D is re-evaluated in the apply path every apply tick; here only the
     * cheap dynamic fault flag needs watching to keep the 20 us budget). */
    if (g_fault_flags != 0U)
    {
        SHOT_Revoke(SHOT_ABORT_PERMISSION);
        return;
    }

    /* D: elapsed-fine 20 us tick count from the first apply (ACTIVE entry) to
     * the cage. Expected 10 for the 1 ms cage. The cage itself is Timer2
     * based (see CTRL_FastTask); this counter is the independent tick proof. */
    g_shot_summary.fast_ticks++;
    g_first_real_pi_shot_tick++;
#endif
}
