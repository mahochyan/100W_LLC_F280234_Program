/*
 * soft_start.c
 *
 * Unified Tutorial SoftStart Engine.
 *
 * This is a port of the CSS024D tutorial soft-start mechanism, rebuilt on the
 * current bring-up safety infrastructure. It is NOT a frequency sweeper.
 *
 * Data flow:
 *   control period_request
 *        -> SoftStart period_limit
 *        -> BurstCtl
 *        -> PWM driver (only driver writes TBPRD/CMPA/DBRED/DBFED)
 */

#include "DSP2803x_Device.h"
#include "llc_config.h"
#include "llc_globals.h"
#include "pwm.h"
#include "comparator.h"
#include "adc.h"
#include "soft_start.h"

static Uint16 s_wait_ticks = 0U;

void SoftStart_SelectProfile(Uint16 profile)
{
    g_softstart_profile = profile;

    if (profile == SOFTSTART_PROFILE_TUTORIAL_REFERENCE)
    {
        g_softstart_period_limit_start = TUTORIAL_MIN_BURST + 1U;   /* 401 */
        g_softstart_period_limit_final = TUTORIAL_MAX_PD;           /* 1714 */
        g_softstart_period_step        = TUTORIAL_PERIOD_STEP;      /* 10 */
        g_softstart_deadtime_start     = TUTORIAL_MAX_DT;           /* 190 */
        g_softstart_deadtime_final     = TUTORIAL_MIN_DT;           /* 20 */
        g_softstart_deadtime_step      = 1U;
        g_softstart_wait_5ms_ticks     = TUTORIAL_WAIT_5MS_TICKS;   /* 20 */
    }
    else
    {
        /* CURRENT_BOARD_SAFE_PROFILE (default)
         * Start 150 kHz (TBPRD=399), final conservative 140 kHz (TBPRD=428).
         * Dead-time starts at 190 and stops at 36 (not 20).
         */
        g_softstart_period_limit_start = 399U;
        g_softstart_period_limit_final = 428U;
        g_softstart_period_step        = 1U;
        g_softstart_deadtime_start     = 190U;
        g_softstart_deadtime_final     = 36U;
        g_softstart_deadtime_step      = 1U;
        g_softstart_wait_5ms_ticks     = 20U;
    }
}

void SoftStart_Init(void)
{
    /* Initialization only; does NOT start a real soft-start. */
    SoftStart_SelectProfile(SOFTSTART_PROFILE_CURRENT_BOARD_SAFE);
    g_softstart_state        = SOFTSTART_INIT;
    g_softstart_step_count   = 0UL;
    g_softstart_elapsed_ms   = 0UL;
    s_wait_ticks             = 0U;
    g_softstart_period_limit = g_softstart_period_limit_start;
    g_softstart_deadtime     = g_softstart_deadtime_start;
    g_period_limit           = g_softstart_period_limit;
    g_period_request         = g_softstart_period_limit_start;
    g_period_applied         = g_softstart_period_limit_start;
    g_burst_enabled          = 0U;
    g_burst_active           = 0U;
    g_burst_enter_count      = 0UL;
    g_burst_exit_count       = 0UL;
    g_ocp_recovery_mode      = OCP_RECOVERY_MODE_LOCKED;
    g_softstart_abort_reason = 0U;
    g_softstart_ocp_dac_code = 300U;   /* DIAGNOSTIC ONLY, NOT FINAL OCP */
    g_comp1_dac_code         = g_softstart_ocp_dac_code;
    g_pwm_start_prepared     = 0U;
}

void SoftStart_Begin(void)
{
    /* Explicit start of a real soft-start. Reinitializes all ramp state. */
    SoftStart_SelectProfile(g_softstart_profile);
    g_softstart_state        = SOFTSTART_INIT;
    g_softstart_step_count   = 0UL;
    g_softstart_elapsed_ms   = 0UL;
    s_wait_ticks             = 0U;
    g_softstart_period_limit = g_softstart_period_limit_start;
    g_softstart_deadtime     = g_softstart_deadtime_start;
    g_period_limit           = g_softstart_period_limit;
    /* No real PI yet: request final period so MaxPD is the only limiter. */
    g_period_request         = g_softstart_period_limit_final;
    g_period_applied         = g_softstart_period_limit_start;
    g_burst_enabled          = 0U;
    g_burst_active           = 0U;
    g_burst_enter_count      = 0UL;
    g_burst_exit_count       = 0UL;
    g_ocp_recovery_mode      = OCP_RECOVERY_MODE_LOCKED;
    g_softstart_abort_reason = 0U;
    g_softstart_ocp_dac_code = 300U;   /* DIAGNOSTIC ONLY, NOT FINAL OCP */
    g_comp1_dac_code         = g_softstart_ocp_dac_code;
    g_pwm_start_prepared     = 0U;
    g_softstart_final_apply_count   = 0UL;
    g_softstart_final_applied       = 0U;
    g_softstart_final_apply_pending = 0U;
}

static void SoftStart_StartPwm(void)
{
    /* Comparator must be armed and prestart-checked while PWM is still OFF. */
    COMP_ArmForPowerStart(g_softstart_ocp_dac_code);
    if (g_comp_prestart_reject != 0U || g_comp_inject_test_armed == 0U)
    {
        g_softstart_abort_reason = 1U;   /* COMP_PRESTART_REJECT */
        g_softstart_state        = SOFTSTART_ABORTED;
        g_pwm_enabled            = 0U;
        g_pwm_enable_result      = 0U;
        g_fault_flags           |= FAULT_COMP_PRESTART_REJECT;
        g_fault_history         |= FAULT_COMP_PRESTART_REJECT;
        g_system_state           = SYS_STATE_FAULT;
        return;
    }

    if (PWM_PrepareStart(g_period_applied, g_softstart_deadtime, 0U) == 0U)
    {
        g_softstart_abort_reason = 2U;   /* PWM_RUNTIME_INVALID */
        g_softstart_state        = SOFTSTART_ABORTED;
        g_pwm_enabled            = 0U;
        g_pwm_enable_result      = 0U;
        g_fault_flags           |= FAULT_PWM_CONFIG_MISMATCH;
        g_fault_history         |= FAULT_PWM_CONFIG_MISMATCH;
        g_system_state           = SYS_STATE_FAULT;
        return;
    }

    PWM_StartDeterministic();
}

void SoftStart_Update5ms(void)
{
    /* Only advance during an explicit soft-start system state. */
    if (g_system_state != SYS_STATE_SOFT_START) return;

    g_softstart_elapsed_ms += 5UL;

    switch (g_softstart_state)
    {
    case SOFTSTART_INIT:
        g_softstart_state = SOFTSTART_WAIT;
        break;

    case SOFTSTART_WAIT:
        s_wait_ticks++;
        if (s_wait_ticks >= g_softstart_wait_5ms_ticks)
        {
            s_wait_ticks = 0U;
            SoftStart_StartPwm();
            if (g_softstart_state == SOFTSTART_WAIT)
                g_softstart_state = SOFTSTART_RAMP;
        }
        break;

    case SOFTSTART_RAMP:
        /* Exactly one step per 5 ms slow tick. */
        g_softstart_step_count++;

        if (g_softstart_period_limit < g_softstart_period_limit_final)
        {
            g_softstart_period_limit += g_softstart_period_step;
            if (g_softstart_period_limit > g_softstart_period_limit_final)
                g_softstart_period_limit = g_softstart_period_limit_final;
        }

        if (g_softstart_deadtime > g_softstart_deadtime_final)
        {
            if (g_softstart_deadtime >= g_softstart_deadtime_step)
                g_softstart_deadtime -= g_softstart_deadtime_step;
            else
                g_softstart_deadtime = g_softstart_deadtime_final;
            if (g_softstart_deadtime < g_softstart_deadtime_final)
                g_softstart_deadtime = g_softstart_deadtime_final;
        }

        if ((g_softstart_period_limit >= g_softstart_period_limit_final) &&
            (g_softstart_deadtime <= g_softstart_deadtime_final))
        {
            /* Enter FINALIZE: software ramp done, but hardware commit must be
             * confirmed by SoftStart_ApplyLimits() before RUN. */
            g_softstart_state = SOFTSTART_FINALIZE;
        }
        break;

    case SOFTSTART_FINALIZE:
        if (g_softstart_final_applied != 0U &&
            g_pwm_enabled != 0U && g_fault_flags == 0UL)
        {
            g_softstart_state = SOFTSTART_COMPLETE;
            g_system_state    = SYS_STATE_RUN;
        }
        break;

    case SOFTSTART_ABORTED:
    case SOFTSTART_COMPLETE:
    default:
        break;
    }

    g_period_limit = g_softstart_period_limit;
}

void SoftStart_ApplyLimits(void)
{
    Uint32 req = g_period_request;

    if (req == 0UL) req = g_softstart_period_limit_start;

    g_period_limit   = g_softstart_period_limit;
    g_period_applied = (req < g_period_limit) ? req : g_period_limit;

    if (g_period_applied < 2UL) g_period_applied = 2UL;

    /* Only write PWM in SOFT_START (or future authorized RUN control). */
    if (g_system_state != SYS_STATE_SOFT_START) return;

    /* Burst control (disabled by default on current board). */
    if (g_burst_enabled != 0U)
    {
        if ((g_period_request < TUTORIAL_MIN_BURST) && (g_pwm_enabled != 0U))
        {
            if (g_burst_active == 0U)
            {
                LLC_PWM_DisableSafe();
                g_burst_active = 1U;
                g_burst_enter_count++;
            }
        }
        else if (g_burst_active != 0U)
        {
            PWM_PrepareStart(g_period_applied, g_softstart_deadtime, 0U);
            PWM_StartDeterministic();
            g_burst_active = 0U;
            g_burst_exit_count++;
        }
    }

    if (g_pwm_enabled != 0U)
    {
        if (g_softstart_state == SOFTSTART_FINALIZE)
        {
            Uint16 ok = PWM_ApplyPeriodDeadtime(g_softstart_period_limit_final,
                                                g_softstart_deadtime_final);
            if (ok != 0U)
            {
                g_softstart_final_apply_count++;
                if (g_softstart_final_apply_pending == 0U)
                {
                    /* First successful write: mark pending, wait for another
                     * fast tick to guarantee a shadow-load opportunity. */
                    g_softstart_final_apply_pending = 1U;
                }
                else
                {
                    g_softstart_final_applied = 1U;
                }
            }
        }
        else
        {
            PWM_ApplyPeriodDeadtime(g_period_applied, g_softstart_deadtime);
        }
    }
}

Uint32 SoftStart_GetPeriodLimit(void)
{
    return g_softstart_period_limit;
}

Uint16 SoftStart_GetDeadtime(void)
{
    return g_softstart_deadtime;
}

Uint16 SoftStart_IsComplete(void)
{
    return (g_softstart_state == SOFTSTART_COMPLETE) ? 1U : 0U;
}
