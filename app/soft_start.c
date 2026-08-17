/*
 * soft_start.c
 *
 * FORMAL SoftStart Engine — board-verified Profile C trajectory.
 *
 * The PASSed bring-up trajectory (250kHz/DB110 -> DB36 -> 150kHz/DB36) is now
 * the DEFAULT production soft-start, driven by ePWM cycle events
 * (SoftStart_FastUpdate), NOT by the 5ms task. The old 150kHz/DB190 scheme is
 * retained only as SOFTSTART_PROFILE_LEGACY_REFERENCE (never the default).
 *
 * Acceptance mode (g_softstart_acceptance_mode): when 1, reaching
 * BOARD_VOUT_RAW_10V triggers an immediate scheduled OST and records
 * SS_RESULT_ACCEPT_TARGET; the core trajectory itself is still judged
 * COMPLETE so production mode (mode 0) can later continue into RUN.
 */

#include "DSP2803x_Device.h"
#include "DSP2803x_Examples.h"
#include "llc_config.h"
#include "llc_globals.h"
#include "pwm.h"
#include "comparator.h"
#include "adc.h"
#include "soft_start.h"
#include "board_calibration.h"

/* ------------------------------------------------------------------ */
/* Terminal helpers                                                   */
/* ------------------------------------------------------------------ */

static void SS_HardStop(void)
{
    EALLOW;
    EPwm1Regs.TZEINT.bit.OST = 0U;
    EPwm1Regs.TZFRC.bit.OST = 1U;
    EPwm1Regs.ETSEL.bit.INTEN = 0U;
    EDIS;
    g_pwm_enabled = 0U;
    g_pwm_enable_result = 0U;
}

static void SS_End(Uint16 result)
{
    SS_HardStop();
    g_softstart_result = result;
    g_softstart_stop_raw = g_softstart_last_vout_raw;
    g_softstart_final_pwm = g_pwm_enabled;
    g_softstart_final_ost = EPwm1Regs.TZFLG.bit.OST;
    g_softstart_run_id_at_stop = g_test_run_id;
    g_softstart_run_id_at_tz_isr = g_test_run_id_at_tz_isr;
}

/* ------------------------------------------------------------------ */
/* PWM release (shared with legacy path)                              */
/* ------------------------------------------------------------------ */

void SoftStart_StartPwmFormal(void)
{
    COMP_ArmForPowerStart(g_softstart_ocp_dac_code);
    if (g_comp_prestart_reject != 0U || g_comp_inject_test_armed == 0U)
    {
        g_softstart_abort_reason = 1U;   /* COMP_PRESTART_REJECT */
        g_softstart_state = SOFTSTART_ABORTED;
        SS_End(SS_RESULT_ACTIVE_TZ);
        g_fault_flags |= FAULT_COMP_PRESTART_REJECT;
        g_fault_history |= FAULT_COMP_PRESTART_REJECT;
        g_system_state = SYS_STATE_FAULT;
        return;
    }

    if (PWM_PrepareStart(SS_START_PERIOD, SS_START_DB, 1U) == 0U)
    {
        g_softstart_abort_reason = 2U;   /* PWM_RUNTIME_INVALID */
        g_softstart_state = SOFTSTART_ABORTED;
        SS_End(SS_RESULT_REJECTED);
        g_fault_flags |= FAULT_PWM_CONFIG_MISMATCH;
        g_fault_history |= FAULT_PWM_CONFIG_MISMATCH;
        g_system_state = SYS_STATE_FAULT;
        return;
    }
    PWM_StartDeterministic();

    EALLOW;
    EPwm1Regs.ETSEL.bit.INTSEL = ET_CTR_ZERO;
    EPwm1Regs.ETPS.bit.INTPRD  = ET_1ST;
    EPwm1Regs.ETCLR.bit.INT    = 1U;
    EPwm1Regs.ETSEL.bit.INTEN  = 1U;
    EDIS;

    g_softstart_state = SOFTSTART_START_HOLD;
}

/* ------------------------------------------------------------------ */
/* Formal trajectory step: write period/deadtime/CMPB for one stage    */
/* ------------------------------------------------------------------ */

static void SS_ApplyStage(Uint16 period, Uint16 db)
{
    PWM_ApplyPeriodDeadtime((Uint32)period, db);
    ADC_UpdatePwmSyncPoint(period);   /* CMPB = CMPA/2, SOCA midpoint */
}

/* ------------------------------------------------------------------ */
/* ePWM-cycle driven update (EPWM1_INT_ISR)                           */
/* ------------------------------------------------------------------ */

void SoftStart_FastUpdate(void)
{
    Uint16 fresh = 0U;
    Uint16 stage_end = 0U;
    Uint16 db;
    Uint16 period;

    if (g_fault_flags != 0UL || g_system_state == SYS_STATE_FAULT)
    {
        SS_End(SS_RESULT_ACTIVE_TZ);
        return;
    }

    g_softstart_cycle_count++;
    g_softstart_stage_cycles++;

    /* Fresh PWM-sync VOUT sample (SOCA/EOC discipline). */
    EALLOW;
    if (EPwm1Regs.ETFLG.bit.SOCA != 0U)
    {
        fresh = 1U;
        g_adc_vout_pwm_sync_raw = AdcResult.ADCRESULT0;
        g_adc_vout_raw = g_adc_vout_pwm_sync_raw;
        g_softstart_soca_count++;
        g_softstart_eoc_count++;
        g_adc_sample_counter++;
        EPwm1Regs.ETCLR.bit.SOCA = 1U;
        AdcRegs.ADCINTFLGCLR.bit.ADCINT1 = 1U;
        AdcRegs.ADCINTOVFCLR.all = 0xFFFFU;
        g_softstart_consecutive_miss = 0U;
    }
    EDIS;

    if (fresh == 0U)
    {
        g_softstart_miss_count++;
        if (++g_softstart_consecutive_miss >= SS_STALE_MISS_LIMIT)
        {
            g_softstart_stale_abort = 1U;
            SS_End(SS_RESULT_STALE_ADC);
            return;
        }
    }
    else
    {
        g_softstart_last_vout_raw = g_adc_vout_pwm_sync_raw;
        if (g_adc_vout_pwm_sync_raw > g_softstart_last_vout_max)
            g_softstart_last_vout_max = g_adc_vout_pwm_sync_raw;

        /* Hard ceiling first, then acceptance target (both fresh-only). */
        if (g_adc_vout_pwm_sync_raw >= g_softstart_hard_ceiling_raw)
        {
            SS_End(SS_RESULT_HARD_CEILING);
            return;
        }
        if (g_softstart_acceptance_mode != 0U &&
            g_adc_vout_pwm_sync_raw >= g_softstart_accept_target_raw)
        {
            SS_End(SS_RESULT_ACCEPT_TARGET);
            return;
        }
    }

    /* Trajectory advancement (cycle-count driven). */
    switch (g_softstart_state)
    {
        case SOFTSTART_START_HOLD:
            if (g_softstart_stage_cycles >= SS_START_HOLD_CYCLES)
            {
                g_softstart_state = SOFTSTART_PHASE_A;
                g_softstart_stage = 1U;
                g_softstart_stage_index = 0U;
                g_softstart_stage_cycles = 0UL;
            }
            break;

        case SOFTSTART_PHASE_A:
            if (g_softstart_stage_cycles >= SS_PHASE_A_CYCLES)
            {
                if (g_softstart_stage_index < SS_PHASE_A_STAGES)
                {
                    g_softstart_stage_index++;
                    db = (g_softstart_stage_index < SS_PHASE_A_STAGES)
                        ? (Uint16)(SS_START_DB - SS_PHASE_A_DB_STEP * g_softstart_stage_index)
                        : SS_FINAL_DB;
                    SS_ApplyStage(SS_START_PERIOD, db);
                    g_softstart_stage_cycles = 0UL;
                }
                else
                {
                    g_softstart_state = SOFTSTART_PHASE_B;
                    g_softstart_stage = 2U;
                    g_softstart_stage_index = 0U;
                    g_softstart_stage_cycles = 0UL;
                    SS_ApplyStage(SS_START_PERIOD, SS_FINAL_DB);
                }
            }
            break;

        case SOFTSTART_PHASE_B:
            if (g_softstart_stage_cycles >= SS_PHASE_B_CYCLES)
            {
                if (g_softstart_stage_index < SS_PHASE_B_STAGES)
                {
                    g_softstart_stage_index++;
                    period = (Uint16)(SS_START_PERIOD +
                                      SS_PHASE_B_PERIOD_STEP * g_softstart_stage_index);
                    if (period > SS_FINAL_PERIOD) period = SS_FINAL_PERIOD;
                    SS_ApplyStage(period, SS_FINAL_DB);
                    g_softstart_stage_cycles = 0UL;
                }
                else
                {
                    g_softstart_state = SOFTSTART_FINAL;
                    g_softstart_stage = 3U;
                    g_softstart_stage_cycles = 0UL;
                    g_softstart_final_cycles = 0U;
                    SS_ApplyStage(SS_FINAL_PERIOD, SS_FINAL_DB);
                }
            }
            break;

        case SOFTSTART_FINAL:
            g_softstart_final_cycles++;
            if (g_softstart_final_cycles >= SS_FINAL_MAX_CYCLES)
            {
                if (g_softstart_acceptance_mode == 0U)
                {
                    /* Production: ramp finished -> complete, continue to RUN. */
                    g_softstart_state = SOFTSTART_COMPLETE;
                    g_softstart_result = SS_RESULT_COMPLETE;
                    g_system_state = SYS_STATE_RUN;
                }
                else
                {
                    SS_End(SS_RESULT_NOT_REACHED);
                }
            }
            break;

        default:
            break;
    }

    /* FastUpdate consumes the ePWM INT; the ISR tail clears the flag. */
}

/* ------------------------------------------------------------------ */
/* 5 ms task: request detect, start release, slow supervision        */
/* ------------------------------------------------------------------ */

void SoftStart_Update5ms(void)
{
    if (g_softstart_request != 0U)
    {
        g_softstart_request = 0U;

        /* Calibration gate: real-power start requires valid board calibration. */
        if (BOARD_VOUT_CAL_VALID != 1 ||
            g_softstart_hard_ceiling_raw == 0U)
        {
            g_softstart_result = SS_RESULT_REJECTED;
            return;
        }

        if (g_system_state != SYS_STATE_IDLE || g_fault_flags != 0UL)
        {
            g_softstart_result = SS_RESULT_REJECTED;
            return;
        }

        /* Reinit formal ramp state. */
        g_softstart_state = SOFTSTART_WAIT;
        g_softstart_result = SS_RESULT_NONE;
        g_softstart_stage = 0U;
        g_softstart_stage_index = 0U;
        g_softstart_cycle_count = 0UL;
        g_softstart_stage_cycles = 0UL;
        g_softstart_final_cycles = 0U;
        g_softstart_last_vout_raw = 0U;
        g_softstart_last_vout_max = 0U;
        g_softstart_stop_raw = 0U;
        g_softstart_soca_count = 0UL;
        g_softstart_eoc_count = 0UL;
        g_softstart_miss_count = 0UL;
        g_softstart_consecutive_miss = 0U;
        g_softstart_stale_abort = 0U;
        g_softstart_run_id_at_arm = g_test_run_id;
        g_system_state = SYS_STATE_SOFT_START;
        return;
    }

    if (g_system_state != SYS_STATE_SOFT_START) return;

    switch (g_softstart_state)
    {
        case SOFTSTART_WAIT:
            SoftStart_StartPwmFormal();
            break;

        case SOFTSTART_FINAL:
            if (g_softstart_acceptance_mode == 0U)
            {
                /* Ramp complete; handled in FastUpdate. */
            }
            break;

        case SOFTSTART_ABORTED:
            break;

        default:
            break;
    }
}

/* ------------------------------------------------------------------ */
/* Legacy / compatibility surface                                     */
/* ------------------------------------------------------------------ */

void SoftStart_SelectProfile(Uint16 profile)
{
    g_softstart_profile = profile;
    /* Only the board-verified profile is a real-power default. */
    if (profile == SOFTSTART_PROFILE_LEGACY_REFERENCE)
    {
        g_softstart_period_limit_start = 399U;   /* reference only */
        g_softstart_period_limit_final = 428U;
        g_softstart_deadtime_start = 190U;
        g_softstart_deadtime_final = 36U;
    }
    else
    {
        g_softstart_period_limit_start = SS_START_PERIOD;
        g_softstart_period_limit_final = SS_FINAL_PERIOD;
        g_softstart_deadtime_start = SS_START_DB;
        g_softstart_deadtime_final = SS_FINAL_DB;
    }
}

void SoftStart_Init(void)
{
    SoftStart_SelectProfile(SOFTSTART_PROFILE_DEFAULT);
    g_softstart_state = SOFTSTART_INIT;
    g_softstart_result = SS_RESULT_NONE;
    g_softstart_acceptance_mode = 0U;
    g_softstart_accept_target_raw = BOARD_VOUT_RAW_10V;
    g_softstart_hard_ceiling_raw = BOARD_VOUT_RAW_12V;
    g_softstart_ocp_dac_code = 300U;
    g_comp1_dac_code = g_softstart_ocp_dac_code;
    g_pwm_start_prepared = 0U;
    g_softstart_abort_reason = 0U;
}

void SoftStart_Begin(void)
{
    /* Explicit start through the request path. */
    g_softstart_request = 1U;
}

void SoftStart_ApplyLimits(void)
{
    /* The formal trajectory writes PWM in FastUpdate; this 5ms limiter is a
     * no-op for the formal states (kept for the legacy reference path). */
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
