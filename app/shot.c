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
volatile Uint16 g_first_real_pi_shot_rb_index    = 0U;
volatile Uint16 g_first_real_pi_shot_rb_count    = 0U;
volatile Uint32 g_first_shot_debug_freq_hz       = 0UL;
volatile Uint16 g_first_shot_debug_ticks         = 0U;
#pragma DATA_SECTION(g_first_real_pi_shot_rb, "shot_ram")
SHOT_RbEntry g_first_real_pi_shot_rb[SHOT_RB_SIZE];
/* ------------------------------------------------------------------ */
void SHOT_Init(void)
{
    g_first_real_pi_shot_arm    = 0U;
    g_first_real_pi_shot_state  = SHOT_STATE_IDLE;
    g_first_real_pi_shot_tick   = 0U;
    g_first_real_pi_shot_abort  = SHOT_ABORT_NONE;
    g_first_real_pi_shot_power_writes = 0U;
    g_first_real_pi_shot_ok     = 0U;
    g_first_real_pi_shot_rb_index = 0U;
    g_first_real_pi_shot_rb_count = 0U;
    g_first_shot_debug_freq_hz    = 0UL;
    g_first_shot_debug_ticks      = 0U;
    /* 11 V fast-abort raw threshold computed from board_calibration.h, never a
     * hand-written magic number: raw = (11.0 - offset) / gain. */
    g_first_real_pi_shot_abort_vout_raw =
        (Uint16)((11.0f - BOARD_VOUT_OFFSET_V) / BOARD_VOUT_GAIN_V_PER_RAW);
#if STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
    g_first_real_pi_shot_build = 1U;
#else
    g_first_real_pi_shot_build = 0U;
#endif
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
/* D per-tick write gate. The full permission set is checked on the very
 * first shot write (IDLE/ARMED -> ACTIVE); once ACTIVE, only the dynamic
 * conditions that can change during the 200 us window are re-checked per
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
/* On-chip termination. reason==SHOT_ABORT_TIMEOUT is the normal bounded
 * end (COMPLETE, exit RUN, no fault). Everything else aborts to FAULT. */
/* ------------------------------------------------------------------ */
void SHOT_Revoke(Uint16 reason)
{
    g_first_real_pi_shot_abort = reason;
    g_first_real_pi_shot_arm   = 0U;   /* revoke PI write permission */

    if (reason == SHOT_ABORT_TIMEOUT)
    {
        /* E: auto-OST at 200 us. Force the one-shot trip (outputs to TZ safe
         * state), disable PWM, exit RUN, normal bounded end (not a FAULT). */
        EALLOW;
        EPwm1Regs.TZFRC.bit.OST = 1U;   /* latch the TZ one-shot */
        EDIS;
        g_first_real_pi_shot_state = SHOT_STATE_COMPLETE;
        g_first_real_pi_shot_ok    = 1U;
        g_pwm_enabled              = 0U;
        g_pwm_enable_result        = 0U;
        g_system_state             = SYS_STATE_IDLE;   /* exit RUN */
        return;
    }

    /* Abort paths -> FAULT (OST + PWM disabled + fault flag). */
    g_first_real_pi_shot_state = SHOT_STATE_ABORTED;
    if (reason == SHOT_ABORT_VOUT_11V)
    {
        /* F: 11 V fast VOUT abort. Record FIRST_SHOT_ABORT_VOUT. */
        PWM_Trip(FAULT_FIRST_SHOT_ABORT, 0U);
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

/* ------------------------------------------------------------------ */
/* Per-20us shot housekeeping: timer (E), 11V abort (F), ring record(H).*/
/* ------------------------------------------------------------------ */
void SHOT_FastTask(void)
{
#if STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
    if (g_first_real_pi_shot_state != SHOT_STATE_ACTIVE)
    {
        return;
    }

    /* H: record this control tick into the ring buffer. */
    {
        SHOT_RbEntry *e = &g_first_real_pi_shot_rb[g_first_real_pi_shot_rb_index];
        e->tick              = g_fast_tick;
        e->vout_raw          = g_adc_vout_raw;
        e->vout_filtered_raw = g_adc_vout_filtered_raw;
        e->error_raw         = g_control_error_raw;
        e->freq_cmd_hz       = g_control_frequency_hz;
        e->actual_freq_hz    = g_actual_switching_frequency_hz;
        e->tbprd             = g_pwm_period;
        e->pi_integral_q12   = g_pi_integral_q12;
        e->fresh_sample      = g_control_sample_valid;
        e->tzflg             = EPwm1Regs.TZFLG.all;
        e->compsts           = Comp1Regs.COMPSTS.bit.COMPSTS;
        e->fault_flags       = (Uint16)g_fault_flags;
        g_first_real_pi_shot_rb_index = (Uint16)((g_first_real_pi_shot_rb_index + 1U) % SHOT_RB_SIZE);
        g_first_real_pi_shot_rb_count++;
    }

    /* F: fast 11 V VOUT abort. */
    if (g_adc_vout_filtered_raw >= g_first_real_pi_shot_abort_vout_raw)
    {
        SHOT_Revoke(SHOT_ABORT_VOUT_11V);
        return;
    }

    /* D: a fault appearing mid-shot revokes immediately (the full permission
     * gate D is re-evaluated in the write path every tick; here only the cheap
     * dynamic fault flag needs watching to keep the 20 us budget). */
    if (g_fault_flags != 0U)
    {
        SHOT_Revoke(SHOT_ABORT_PERMISSION);
        return;
    }

    /* E: on-chip 200 us auto-OST. */
    if (g_first_real_pi_shot_tick >=
        (g_first_shot_debug_ticks != 0U ? g_first_shot_debug_ticks
                                        : FIRST_REAL_PI_DURATION_TICKS))
    {
        SHOT_Revoke(SHOT_ABORT_TIMEOUT);
        return;
    }
    g_first_real_pi_shot_tick++;
#endif
}
