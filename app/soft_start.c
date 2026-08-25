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
#include "control.h"
#include "shot.h"

/* STAGE5A PFM direction: 170 kHz window configuration, computed at compile
 * time from the 60 MHz TBCLK so no runtime division is needed:
 *   TBPRD = round(60000000 / 170000) - 1 = 353 - 1 = 352
 *   f_act = 60000000 / (352 + 1)       = 169971 Hz
 * 150 kHz uses the verified SS_FINAL_PERIOD (399, f = 150000 Hz). */
#define PFM_DIRECTION_TBPRD_170K \
    (((LLC_TBCLK_HZ + (PFM_DIRECTION_FREQ_170K_HZ / 2UL)) / PFM_DIRECTION_FREQ_170K_HZ) - 1UL)
#define PFM_DIRECTION_FREQ_170K_ACTUAL \
    (LLC_TBCLK_HZ / (PFM_DIRECTION_TBPRD_170K + 1UL))

/* ------------------------------------------------------------------ */
/* Terminal helpers                                                   */
/* ------------------------------------------------------------------ */

static void SS_HardStop(void)
{
    /*
     * 此时 formal ramp 中 ADCINT1 PIE 本来就是 disabled，
     * 保持它 disabled，先彻底关闭所有 PWM 同步 ADC 源。
     */

    EALLOW;

    /* 1. 先锁死功率输出 */
    EPwm1Regs.TZEINT.bit.OST = 0U;
    EPwm1Regs.TZFRC.bit.OST = 1U;

    /* 2. 停止 ePWM 控制中断 */
    EPwm1Regs.ETSEL.bit.INTEN = 0U;

    /* 3. 关键修复：停止 PWM 同步 ADC 触发 */
    EPwm1Regs.ETSEL.bit.SOCAEN = 0U;

    EDIS;

    /*
     * 不要在外层 EALLOW 内调用。
     * 该函数内部自己执行 EALLOW/EDIS，
     * 并把 SOC0/1/2 切回 TRIGSEL=0，
     * 不会主动产生新的 SOC。
     */
    ADC_SetSoftwareTriggerMode();

    EALLOW;

    /* 4. 清掉最后可能残留的 ADC 事件 */
    AdcRegs.ADCINTFLGCLR.bit.ADCINT1 = 1U;
    AdcRegs.ADCINTOVFCLR.all = 0xFFFFU;
    PieCtrlRegs.PIEIFR1.bit.INTx1 = 0U;

    /*
     * 5. 所有 trigger 都已经关闭/切回 software 后，
     * 最后再恢复 ADCINT1 PIE。
     */
    PieCtrlRegs.PIEIER1.bit.INTx1 = 1U;

    EDIS;

    /*
     * ramp_active 最后再清。
     * 这样 cleanup 期间即使有最后一个残留 ADC ISR，
     * 也仍处在 softstart guard 内，
     * 不会误置 FAULT_ADC_STALE_OVERFLOW。
     */
    g_softstart_ramp_active = 0U;

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
    /* STAGE5A_500MA: IPRI ADC diagnostic at stop (not a protection path). */
    g_ipri_raw_at_stop = g_adc_ipri_raw;
#if STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD
    /* D: REAL bounded-shot build — the ONLY acceptable SoftStart end is the
     * 10V handoff (SoftStart_TransferToClosedLoop, which never calls SS_End).
     * Every SS_End here therefore means the shot did NOT proceed: force OST +
     * PWM=0 (SS_HardStop above) and revoke the shot arm into FAULT so there is
     * no unverified RUN and no auto retry. */
    if (result == SS_RESULT_NOT_REACHED)
    {
        SHOT_Revoke(SHOT_ABORT_NO_HANDOFF);
    }
    else if (result == SS_RESULT_HARD_CEILING)
    {
        SHOT_Revoke(SHOT_ABORT_CEILING);
    }
    else if (result == SS_RESULT_ACTIVE_TZ)
    {
        SHOT_Revoke(SHOT_ABORT_TZ);
    }
    else
    {
        SHOT_Revoke(SHOT_ABORT_FAULT);
    }
#endif
}

/* ------------------------------------------------------------------ */
/* PWM release (shared with legacy path)                              */
/* ------------------------------------------------------------------ */

void SoftStart_StartPwmFormal(void)
{
    /* Comparator/TZ armed directly (DAC300) — same verified configuration as
     * the CAL_HOLD recharge packets; keeps the protect path fully active
     * without depending on the enable-request state machine. */
    EALLOW;
    Comp1Regs.COMPCTL.all = 0U;
    Comp1Regs.COMPCTL.bit.COMPSOURCE = 0U;
    Comp1Regs.COMPCTL.bit.QUALSEL = 5U;
    Comp1Regs.COMPCTL.bit.SYNCSEL = 0U;
    Comp1Regs.COMPCTL.bit.CMPINV = 1U;
    Comp1Regs.DACCTL.all = 0U;
    Comp1Regs.DACVAL.bit.DACVAL = g_softstart_ocp_dac_code & 0x03FFU;
    Comp1Regs.COMPCTL.bit.COMPDACEN = 1U;
    GpioCtrlRegs.GPBMUX1.bit.GPIO42 = 3U;
    /* RAM 快照供 DSS 验证（受保护寄存器直读受限） */
    g_comp_arm_dacval = Comp1Regs.DACVAL.bit.DACVAL;
    g_comp_arm_compdacen = Comp1Regs.COMPCTL.bit.COMPDACEN;
    g_comp_arm_tzsel_osht1 = EPwm1Regs.TZSEL.bit.OSHT1;
    EDIS;

    /* Fresh-sample discipline: SOC0 driven by ePWM1 SOCA (same verified
     * configuration as the CAL_HOLD packets); SS_ApplyStage repositions the
     * sample point each stage. */
    ADC_SetPwmSyncTriggerMode();
    ADC_UpdatePwmSyncPoint(SS_START_PERIOD);

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

#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    if (g_softstart_no_energy != 0U)
    {
        /* No-energy ramp: PWM_StartDeterministic clears OST and releases the
         * output clamps for real power. On the safe bench there is no input, so
         * re-latch the TZ one-shot trip and force the outputs low — the ePWM
         * time-base and EPWM1 INT keep running so the ramp and the closed-loop
         * handoff are fully exercised in software with NO effective PWM output.
         * This is test-build-only; production keeps the real-power OST release. */
        EALLOW;
        EPwm1Regs.TZFRC.bit.OST = 1U;   /* force OST trip -> OST stays latched */
        EPwm1Regs.AQCSFRC.bit.CSFA = AQ_CLEAR;
        EPwm1Regs.AQCSFRC.bit.CSFB = AQ_CLEAR;
        EDIS;
    }
#endif

    EALLOW;
    EPwm1Regs.ETSEL.bit.INTSEL = ET_CTR_ZERO;
    EPwm1Regs.ETPS.bit.INTPRD  = ET_1ST;
    EPwm1Regs.ETCLR.bit.INT    = 1U;
    EPwm1Regs.ETSEL.bit.INTEN  = 1U;
    /* During the ramp the ADCINT1 CPU vector stays disabled: FastUpdate owns
     * the fresh-sample discipline (ETFLG.SOCA + ADCRESULT0) and clears the
     * ADC flags each cycle with EALLOW. The legacy ADCINT1 ISR is redundant
     * here and its OVF check can race at 250 kHz (conversion batch ends
     * within ~50 ticks of the period boundary). SS_HardStop re-enables it. */
    PieCtrlRegs.PIEIFR1.bit.INTx1 = 0U;
    PieCtrlRegs.PIEIER1.bit.INTx1 = 0U;
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

#if STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
/* ------------------------------------------------------------------ */
/* W2_CANDIDATE4_PRE_HANDOFF_ENERGY_STATE_SHAPING_V1                  */
/* ------------------------------------------------------------------ */

static Uint16 SS_FreqToPeriod(Uint32 hz)
{
    Uint32 period = (LLC_TBCLK_HZ + (hz / 2UL)) / hz;
    if (period > 0UL) period--;
    return (Uint16)period;
}

static void SS_ApplyPreBrakeFreq(void)
{
    Uint16 period = SS_FreqToPeriod(g_pre_brake_freq_hz);
    PWM_ApplyPeriodDeadtime((Uint32)period, SS_FINAL_DB);
    ADC_UpdatePwmSyncPoint(period);
}

static void SS_EnterPreHandoffBrake(void)
{
    g_pre_brake_cycles = 0U;
    g_pre_brake_settle_count = 0U;
    g_pre_brake_prev_raw = g_adc_vout_pwm_sync_raw;
    g_pre_brake_freq_hz = SS_PRE_BRAKE_FREQ_INIT_HZ;
    g_pre_brake_entry_raw_frozen = g_adc_vout_pwm_sync_raw;
    g_pre_brake_exit_raw_frozen = 0U;
    g_pre_brake_exit_timer2 = 0UL;
    g_pre_brake_max_dvout = 0U;
    g_pre_brake_handoff_ready = 0U;
    g_pre_brake_abort_reason = 0U;
    SS_ApplyPreBrakeFreq();
    g_softstart_state = SOFTSTART_PRE_HANDOFF_BRAKE;
    g_softstart_stage = 4U;
}
#endif /* STAGE6_FIRST_BOUNDED_REAL_PI_SHOT */


/* ------------------------------------------------------------------ */
/* STAGE5A PFM direction window                                        */
/* ------------------------------------------------------------------ */

static void SS_EnterPfmWindow(void)
{
    Uint16 period;
    Uint16 cmpa;

    /* Freeze the window start (raw + free-running Timer2 @60MHz). */
    g_pfm_start_raw = g_adc_vout_pwm_sync_raw;
    g_pfm_start_timer2 = CpuTimer2Regs.TIM.all;
    g_pfm_window_cycles = 0U;
    g_pfm_hard_vout_abort = 0U;
    g_pfm_end_raw = 0U;
    g_pfm_max_raw = g_adc_vout_pwm_sync_raw;
    /* STAGE5A_500MA: IPRI ADC diagnostic snapshot (not a protection path). */
    g_ipri_raw_before = g_adc_ipri_raw;
    g_ipri_raw_max = g_adc_ipri_raw;

    if (g_pfm_direction_test_mode == PFM_DIRECTION_MODE_TEST_150K)
    {
        period = SS_FINAL_PERIOD;              /* 399 -> 150 kHz */
        g_pfm_window_total = PFM_DIRECTION_WINDOW_CYCLES_150K;
        g_pfm_frequency_hz = 150000UL;
    }
    else /* TEST_170K */
    {
        period = (Uint16)PFM_DIRECTION_TBPRD_170K;   /* 352 -> 169971 Hz */
        g_pfm_window_total = PFM_DIRECTION_WINDOW_CYCLES_170K;
        g_pfm_frequency_hz = (Uint32)PFM_DIRECTION_FREQ_170K_ACTUAL;
    }

    cmpa = (Uint16)((period + 1U) / 2U);       /* CMPA = (TBPRD+1)/2 */

    g_pfm_tbprd = period;
    g_pfm_cmpa = cmpa;
    g_pfm_cmpb = (Uint16)(cmpa / 2U);          /* CMPB = CMPA/2 (ADC sync point) */

    /* Fixed-frequency window config: period + deadtime + PWM-sync ADC. */
    SS_ApplyStage(period, SS_FINAL_DB);

    g_softstart_stage = 4U;                    /* PFM window */
    g_softstart_state = SOFTSTART_PFM_WINDOW;
}

/* ------------------------------------------------------------------ */
/* ePWM-cycle driven update (EPWM1_INT_ISR)                           */
/* ------------------------------------------------------------------ */

void SoftStart_FastUpdate(void)
{
    Uint16 fresh = 0U;
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
    }

#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    /* No-energy software simulation: synthetic VOUT that follows the ramp and
     * crosses the acceptance target only in the FINAL stage. Test-build only;
     * production reads the real ADC. */
    if (g_softstart_no_energy != 0U)
    {
        /* W2_CANDIDATE4 test hook: allow the no-power harness to drive the
         * pre-brake VOUT sample directly so the dv/dt and window scenarios can
         * be exercised on-target. Only active in the no-energy test build. */
        if (g_pre_brake_test_override != 0U &&
            g_softstart_state == SOFTSTART_PRE_HANDOFF_BRAKE)
        {
            Uint16 sim = g_pre_brake_test_vout_raw;
            g_adc_vout_pwm_sync_raw = sim;
            g_softstart_last_vout_raw = sim;
            if (sim > g_softstart_last_vout_max) g_softstart_last_vout_max = sim;
            if (g_pre_brake_test_ramp != 0U)
                g_pre_brake_test_vout_raw = (Uint16)(sim + g_pre_brake_test_step);
        }
        else
        {
            /* PFM window keeps the FINAL-stage simulated VOUT (no real energy).
             * The FINAL value is the exact 10V handoff target so the closed-loop
             * filter seed (gate L) and first injected sample match the reference,
             * giving a clean bumpless 150 kHz entry (gate G/N). */
            Uint16 sim = (g_softstart_state == SOFTSTART_FINAL ||
                          g_softstart_state == SOFTSTART_PFM_WINDOW ||
                          g_softstart_state == SOFTSTART_PRE_HANDOFF_BRAKE) ? 1244U
                         : (g_softstart_state >= SOFTSTART_PHASE_B) ? 900U : 400U;
            g_adc_vout_pwm_sync_raw = sim;
            g_softstart_last_vout_raw = sim;
            if (sim > g_softstart_last_vout_max) g_softstart_last_vout_max = sim;
        }
    }
#endif

#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    if (fresh != 0U || g_softstart_no_energy != 0U)
#else
    if (fresh != 0U)
#endif
    {

        /* In the PFM window the window case owns the ceiling check and the
         * completion stop; the generic checks below would otherwise re-enter
         * the window every cycle (raw >= target again) and reset its counter. */
        if (g_softstart_state != SOFTSTART_PFM_WINDOW)
        {

            /* Hard ceiling first, then acceptance target (fresh or simulated). */
            if (g_adc_vout_pwm_sync_raw >= g_softstart_hard_ceiling_raw)
            {
                SS_End(SS_RESULT_HARD_CEILING);
                return;
            }
            if (g_softstart_state != SOFTSTART_PRE_HANDOFF_BRAKE &&
                g_softstart_acceptance_mode != 0U &&
                g_adc_vout_pwm_sync_raw >= g_softstart_accept_target_raw)
            {
                if (g_pfm_direction_test_mode == PFM_DIRECTION_MODE_TEST_150K ||
                    g_pfm_direction_test_mode == PFM_DIRECTION_MODE_TEST_170K)
                {
                    /* STAGE5A PFM direction: instead of the Stage-5 immediate
                     * scheduled OST, enter a fixed-frequency window and record
                     * the VOUT change over ~300us, then OST. Never enters RUN. */
                    SS_EnterPfmWindow();
                    return;
                }
                SS_End(SS_RESULT_ACCEPT_TARGET);
                return;
            }
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
            /* STAGE6 closed-loop handoff: when formal Profile C reaches the
             * FINAL stage and Vout >= 10V handoff target, transfer to the Q12
             * closed-loop PI instead of a scheduled OST. The 12V raw ceiling
             * is enforced before this (SS_HardStop ceiling check). */
#if STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
            if (g_bringup_stage == BRINGUP_STAGE_6_CLOSED_LOOP &&
                g_adc_vout_pwm_sync_raw >= (g_softstart_accept_target_raw > SS_PRE_BRAKE_ENTRY_OFFSET_RAW
                                            ? (Uint16)(g_softstart_accept_target_raw - SS_PRE_BRAKE_ENTRY_OFFSET_RAW) : 0U))
            {
                SS_EnterPreHandoffBrake();
                return;
            }
#else
            if (g_bringup_stage == BRINGUP_STAGE_6_CLOSED_LOOP &&
                g_adc_vout_pwm_sync_raw >= g_softstart_accept_target_raw)
            {
                if (SoftStart_TransferToClosedLoop() != 0U)
                {
                    return;
                }
                /* transfer rejected (gate/ceiling/PWM invalid) -> stay FINAL
                 * until the 300-cycle window decides (COMPLETE or NOT_REACHED). */
            }
#endif
            if (g_softstart_final_cycles >= SS_FINAL_MAX_CYCLES)
            {
#if STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD
                /* D: REAL bounded-shot build — never enter unverified RUN. If
                 * the formal Profile C reached the FINAL max window without the
                 * 10V handoff, SS_End(NOT_REACHED) forces OST + PWM=0 and
                 * revokes the shot arm into FAULT (see SS_End). No auto retry. */
                g_softstart_abort_reason = 3U;   /* SS_ABORT_NO_HANDOFF */
                SS_End(SS_RESULT_NOT_REACHED);
                g_softstart_state = SOFTSTART_ABORTED;
#else
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
#endif
            }
            break;

#if STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
        case SOFTSTART_PRE_HANDOFF_BRAKE:
            g_pre_brake_cycles++;
            if (g_pre_brake_cycles >= SS_PRE_BRAKE_MAX_CYCLES)
            {
                g_pre_brake_abort_reason = 1U;
                SS_End(SS_RESULT_PRE_BRAKE_TIMEOUT);
                return;
            }
            /* Hard VOUT ceiling is enforced by the generic check before this
             * switch. Add a tighter pre-brake upper window: if VOUT has already
             * risen past the handoff window, do not hand off and do not gamble. */
            if (g_adc_vout_pwm_sync_raw >= (Uint16)(g_softstart_accept_target_raw + SS_PRE_BRAKE_EXIT_HIGH_OFFSET_RAW))
            {
                g_pre_brake_abort_reason = 2U;
                SS_End(SS_RESULT_PRE_BRAKE_ABORT);
                return;
            }
#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
            if (g_softstart_no_energy != 0U || fresh != 0U)
#else
            if (fresh != 0U)
#endif
            {
                Uint16 cur = g_adc_vout_pwm_sync_raw;
                Uint16 dv = (cur >= g_pre_brake_prev_raw) ? (Uint16)(cur - g_pre_brake_prev_raw) : 0U;
                if (dv > g_pre_brake_max_dvout) g_pre_brake_max_dvout = dv;
                g_pre_brake_prev_raw = cur;
                if (dv > SS_PRE_BRAKE_DVOUT_LIMIT)
                {
                    g_pre_brake_settle_count = 0U;
                    if (g_pre_brake_freq_hz < SS_PRE_BRAKE_FREQ_MAX_HZ)
                    {
                        g_pre_brake_freq_hz += SS_PRE_BRAKE_STEP_HZ;
                        if (g_pre_brake_freq_hz > SS_PRE_BRAKE_FREQ_MAX_HZ)
                            g_pre_brake_freq_hz = SS_PRE_BRAKE_FREQ_MAX_HZ;
                        SS_ApplyPreBrakeFreq();
                    }
                }
                else if (g_pre_brake_settle_count < SS_PRE_BRAKE_SETTLE_SAMPLES)
                {
                    g_pre_brake_settle_count++;
                }
            }
            /* Handoff is allowed only when VOUT is inside the window, slope has
             * settled, no fault is latched, and ADC freshness is intact. The
             * transfer function performs the full PWM/state re-validation. */
            if (g_adc_vout_pwm_sync_raw >= g_softstart_accept_target_raw &&
                g_adc_vout_pwm_sync_raw < (Uint16)(g_softstart_accept_target_raw + SS_PRE_BRAKE_EXIT_HIGH_OFFSET_RAW) &&
                g_pre_brake_settle_count >= SS_PRE_BRAKE_SETTLE_SAMPLES &&
                g_fault_flags == 0UL)
            {
                g_pre_brake_exit_raw_frozen = g_adc_vout_pwm_sync_raw;
                g_pre_brake_exit_timer2 = CpuTimer2Regs.TIM.all;
                g_pre_brake_handoff_ready = 1U;
                if (SoftStart_TransferToClosedLoop() != 0U)
                {
                    return;
                }
                g_pre_brake_handoff_ready = 0U;
            }
            break;
#endif


        case SOFTSTART_PFM_WINDOW:
            /* STAGE5A direction window: count complete cycles, abort on the
             * hard ceiling, otherwise scheduled OST when the window is done. */
            g_pfm_window_cycles++;
            /* STAGE5A_500MA: IPRI ADC diagnostic max (not a protection path). */
            if (g_adc_ipri_raw > g_ipri_raw_max)
            {
                g_ipri_raw_max = g_adc_ipri_raw;
            }
            if (g_adc_vout_pwm_sync_raw >= g_softstart_hard_ceiling_raw)
            {
                g_pfm_hard_vout_abort = 1U;
                SS_End(SS_RESULT_PFM_HARD_ABORT);
                return;
            }
            if (g_adc_vout_pwm_sync_raw > g_pfm_max_raw)
            {
                g_pfm_max_raw = g_adc_vout_pwm_sync_raw;
            }
            if (g_pfm_window_cycles >= g_pfm_window_total)
            {
                g_pfm_end_raw = g_adc_vout_pwm_sync_raw;
                g_pfm_end_timer2 = CpuTimer2Regs.TIM.all;
                SS_End(SS_RESULT_PFM_WINDOW_DONE);
                return;
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

        /* Disable the ADCINT1 CPU vector for the whole ramp window (FastUpdate
         * owns fresh-sample discipline; the legacy ISR's OVF check races at
         * 250 kHz). Cleared request first so the window starts here. */
        EALLOW;
        PieCtrlRegs.PIEIFR1.bit.INTx1 = 0U;
        PieCtrlRegs.PIEIER1.bit.INTx1 = 0U;
        EDIS;
        g_softstart_ramp_active = 1U;

        /* Calibration gate: real-power start requires valid board calibration. */
        if (BOARD_VOUT_CAL_VALID != 1 ||
            g_softstart_hard_ceiling_raw == 0U)
        {
            g_softstart_ramp_active = 0U;
            g_softstart_result = SS_RESULT_REJECTED;
            return;
        }

        /* STAGE5A gate: PFM direction mode only accepts 0 (OFF), 1, 2. */
        if (g_pfm_direction_test_mode > PFM_DIRECTION_MODE_TEST_170K)
        {
            g_softstart_ramp_active = 0U;
            g_softstart_result = SS_RESULT_REJECTED;
            return;
        }

        if (g_system_state != SYS_STATE_IDLE || g_fault_flags != 0UL)
        {
            g_softstart_ramp_active = 0U;
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
        /* Defensive: the formal ramp owns the EPWM1 INT exclusively. Clear
         * any residue that could divert the ISR into a probe/CAL_HOLD branch
         * (RAM-loaded .ebss is not zeroed by loadProgram). */
        g_single_cycle_probe_active = 0U;
        g_multi_cycle_probe_active = 0U;
        g_power_probe_active = 0U;
        g_cal_hold_state = CAL_HOLD_IDLE;
        g_cal_hold_packet_active = 0U;
        g_softstart_run_id_at_arm = g_test_run_id;
        /* STAGE5A PFM window reinit (residue-proof). */
        g_pfm_start_raw = 0U;
        g_pfm_end_raw = 0U;
        g_pfm_max_raw = 0U;
        g_pfm_start_timer2 = 0UL;
        g_pfm_end_timer2 = 0UL;
        g_pfm_window_cycles = 0U;
        g_pfm_window_total = 0U;
        g_pfm_hard_vout_abort = 0U;
        g_pfm_frequency_hz = 0UL;
        g_pfm_tbprd = 0U;
        g_pfm_cmpa = 0U;
        g_pfm_cmpb = 0U;
        g_ipri_raw_before = 0U;
        g_ipri_raw_max = 0U;
        g_ipri_raw_at_stop = 0U;
        g_pwm_enable_request = 1U;   /* formal enable; COMP arm requires it */
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
    g_softstart_request = 0U;   /* defensive: DSS loadProgram does not zero .bss */
    g_softstart_ramp_active = 0U;
    g_softstart_state = SOFTSTART_INIT;
    g_softstart_result = SS_RESULT_NONE;
    g_softstart_acceptance_mode = 0U;
    g_softstart_accept_target_raw = BOARD_VOUT_RAW_10V;
    g_softstart_hard_ceiling_raw = BOARD_VOUT_RAW_12V;
    g_softstart_ocp_dac_code = 300U;
    g_comp1_dac_code = g_softstart_ocp_dac_code;
    g_pwm_start_prepared = 0U;
    g_softstart_abort_reason = 0U;

#if STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
    g_pre_brake_cycles = 0U;
    g_pre_brake_settle_count = 0U;
    g_pre_brake_prev_raw = 0U;
    g_pre_brake_freq_hz = SS_PRE_BRAKE_FREQ_INIT_HZ;
    g_pre_brake_entry_raw_frozen = 0U;
    g_pre_brake_exit_raw_frozen = 0U;
    g_pre_brake_exit_timer2 = 0UL;
    g_pre_brake_max_dvout = 0U;
    g_pre_brake_handoff_ready = 0U;
    g_pre_brake_abort_reason = 0U;
#endif
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

/* ------------------------------------------------------------------ */
/* STAGE6 closed-loop handoff: Formal SoftStart -> Q12 closed-loop PI  */
/* ------------------------------------------------------------------ */

Uint16 SoftStart_TransferToClosedLoop(void)
{
    Uint16 raw;

    /* ---- D: entry guards (only Stage6 + formal Profile C + no fault) ---- */
    if (g_bringup_stage != BRINGUP_STAGE_6_CLOSED_LOOP)
    {
        g_softstart_handoff_result = HANDOFF_GATE_FAIL;
        return 0U;
    }
#if STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
    if (g_softstart_state != SOFTSTART_FINAL &&
        g_softstart_state != SOFTSTART_PRE_HANDOFF_BRAKE)
#else
    if (g_softstart_state != SOFTSTART_FINAL)
#endif
    {
        g_softstart_handoff_result = HANDOFF_GATE_FAIL;
        return 0U;
    }
    if (g_fault_flags != 0UL || g_system_state == SYS_STATE_FAULT)
    {
        g_softstart_handoff_result = HANDOFF_FAULT;
        return 0U;
    }
    if (g_system_state != SYS_STATE_SOFT_START)
    {
        g_softstart_handoff_result = HANDOFF_GATE_FAIL;
        return 0U;
    }

    /* E: first handoff target = 10V; the 12V ceiling is handled upstream
     * (SS_HardStop ceiling check aborts before transfer). Guard here too. */
    if (g_adc_vout_pwm_sync_raw < g_softstart_accept_target_raw)   /* < 10V */
    {
        g_softstart_handoff_result = HANDOFF_GATE_FAIL;
        return 0U;
    }
    if (g_adc_vout_pwm_sync_raw >= g_softstart_hard_ceiling_raw)   /* >= 12V */
    {
        g_softstart_handoff_result = HANDOFF_CEILING;
        g_softstart_state = SOFTSTART_ABORTED;
        g_system_state = SYS_STATE_FAULT;
        return 0U;
    }

#if STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
    /* F: Candidate4 - from PRE_HANDOFF_BRAKE the PWM is already at the actual
     * brake frequency (g_pre_brake_period). Validate that exact state. */
    if (g_softstart_state == SOFTSTART_PRE_HANDOFF_BRAKE)
    {
        Uint16 pb_period = SS_FreqToPeriod(g_pre_brake_freq_hz);
        if (EPwm1Regs.TBPRD != pb_period ||
            EPwm1Regs.CMPA.half.CMPA != (Uint16)((pb_period + 1U) / 2U) ||
            EPwm1Regs.DBCTL.bit.OUT_MODE == 0U ||
            EPwm1Regs.DBRED != SS_FINAL_DB ||
            EPwm1Regs.DBFED != SS_FINAL_DB)
        {
            g_softstart_handoff_result = HANDOFF_PWM_STATE_INVALID;
            g_softstart_state = SOFTSTART_ABORTED;
            g_system_state = SYS_STATE_FAULT;
            return 0U;
        }
    }
    else
#endif
    {
        if (EPwm1Regs.TBPRD != SS_FINAL_PERIOD ||
            EPwm1Regs.CMPA.half.CMPA != SS_FINAL_CMPA ||
            EPwm1Regs.DBCTL.bit.OUT_MODE == 0U ||
            EPwm1Regs.DBRED != SS_FINAL_DB ||
            EPwm1Regs.DBFED != SS_FINAL_DB)
        {
            g_softstart_handoff_result = HANDOFF_PWM_STATE_INVALID;
            g_softstart_state = SOFTSTART_ABORTED;
            g_system_state = SYS_STATE_FAULT;
            return 0U;
        }
    }

#if !STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
    /* Legacy fixed 160 kHz brake for non-bounded builds. Candidate4 performs
     * the brake in SOFTSTART_PRE_HANDOFF_BRAKE before this function. */
    if (PWM_ApplyPeriodDeadtime(SS_HANDOFF_BRAKE_PERIOD,
                                SS_FINAL_DB) == 0U)
    {
        g_softstart_handoff_result = HANDOFF_BRAKE_INVALID;
        g_softstart_state = SOFTSTART_ABORTED;
        g_fault_flags |= FAULT_PWM_CONFIG_MISMATCH;
        g_fault_history |= FAULT_PWM_CONFIG_MISMATCH;
        g_system_state = SYS_STATE_FAULT;
        LLC_PWM_DisableSafe();
        return 0U;
    }
    ADC_UpdatePwmSyncPoint(SS_HANDOFF_BRAKE_PERIOD);
    if (EPwm1Regs.TBPRD != SS_HANDOFF_BRAKE_PERIOD ||
        EPwm1Regs.CMPA.half.CMPA != SS_HANDOFF_BRAKE_CMPA ||
        EPwm1Regs.DBRED != SS_FINAL_DB ||
        EPwm1Regs.DBFED != SS_FINAL_DB)
    {
        g_softstart_handoff_result = HANDOFF_BRAKE_INVALID;
        g_softstart_state = SOFTSTART_ABORTED;
        g_fault_flags |= FAULT_PWM_CONFIG_MISMATCH;
        g_fault_history |= FAULT_PWM_CONFIG_MISMATCH;
        g_system_state = SYS_STATE_FAULT;
        LLC_PWM_DisableSafe();
        return 0U;
    }
#endif

    /* I + K: ADC ownership handoff. The SoftStart ePWM-cycle ISR stops
     * owning ADC freshness; ADCINT1 closed-loop vector takes over. */
    ADC_ResetFreshnessBlackbox();
    g_adc_freshness_wait_first_publish = 1U;
    EALLOW;
    EPwm1Regs.ETSEL.bit.INTEN = 0U;               /* release SoftStart ePWM INT */
    PieCtrlRegs.PIEIFR1.bit.INTx1 = 0U;           /* clear pending ADCINT1 */
    AdcRegs.ADCINTFLGCLR.bit.ADCINT1 = 1U;        /* clear ADCINT1 flag */
    AdcRegs.ADCINTOVFCLR.all = 0xFFFFU;           /* clear ADC overflow */
    EDIS;

    /* J) - closed-loop ADC mode: SOCAPRD = ET_3RD (40/50/60 kS/s). */
    ADC_SetClosedLoopSyncTriggerMode();

    EALLOW;
    PieCtrlRegs.PIEIFR1.bit.INTx1 = 0U;
    PieCtrlRegs.PIEIER1.bit.INTx1 = 1U;           /* re-enable ADCINT1 */
    EDIS;

    /* K) - freshness baseline: PI must NOT consume a stale sample. */
    g_control_adc_sequence_last    = g_adc_sample_sequence;
    g_control_adc_sequence_consumed = g_adc_sample_sequence;

    /* L) - filter seed: avoid an old/zero IIR state at the first closed-loop
     * sample. Seed from the last SoftStart sample (>=10V crossing). */
    raw = g_softstart_last_vout_raw;
    if (raw == 0U) raw = g_softstart_accept_target_raw;
    g_adc_vout_filter_acc     = ((Uint32)raw) << 4U;
    g_adc_vout_filtered_raw   = raw;

#if STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
    /* G) Candidate4: preload PI at the actual pre-brake frequency so the first
     * PI command is bumpless with respect to the current PWM. */
    g_control_frequency_hz        = g_pre_brake_freq_hz;
    g_control_shadow_frequency_hz = g_pre_brake_freq_hz;
    g_pi_integral_q12             = -((int32)(g_pre_brake_freq_hz - SS_PRE_BRAKE_FREQ_MIN_HZ) * SS_Q_ONE);
    g_control_unsat_q12           = (int32)g_pre_brake_freq_hz * SS_Q_ONE;
#else
    /* G) - bumpless state matching the 160 kHz handoff brake. The controller
     * bias remains 150 kHz; a -10 kHz integral term therefore commands
     * 160 kHz at zero error with CTRL_SIGN=-1. */
    g_control_frequency_hz        = SS_HANDOFF_BRAKE_HZ;
    g_control_shadow_frequency_hz = SS_HANDOFF_BRAKE_HZ;
    g_pi_integral_q12             = SS_HANDOFF_BRAKE_INTEGRAL_Q12;
    g_control_unsat_q12           = SS_HANDOFF_BRAKE_UNSAT_Q12;
#endif

    /* H) - first real-PI reference target = 10V. Production slow path derives
     * g_control_vref_raw (~1244) and reference_valid=1 from this only. */
    g_voltage_reference = 10.0f;

    /* STAGE6_HANDOFF_REFERENCE_ATOMIC_PUBLICATION_CLOSURE_V1:
     * Atomically publish the calibrated raw reference BEFORE any RUN/handoff
     * publication, eliminating the one-slow-tick CAL_MISSING authorization gap. */
    g_stage6_ref_prime_raw = g_softstart_accept_target_raw;
    if (CTRL_PrimeHandoffReferenceRaw(g_softstart_accept_target_raw) == 0U)
    {
        g_stage6_ref_prime_result = 0U;
        g_softstart_handoff_result = HANDOFF_GATE_FAIL;
        LLC_PWM_DisableSafe();
        g_softstart_state = SOFTSTART_ABORTED;
        return 0U;
    }
    g_stage6_ref_prime_count++;
    g_stage6_ref_prime_result = 1U;
    g_stage6_ref_valid_at_run_entry = g_control_reference_valid;

    /* Complete SoftStart exactly once, then enter RUN. */
    g_softstart_state    = SOFTSTART_COMPLETE;
    g_softstart_result   = SS_RESULT_COMPLETE;
    g_softstart_ramp_active = 0U;
    g_stage6_handoff_count++;
    g_softstart_handoff_result = HANDOFF_RESULT_OK;
    g_stage6_run_entry_count++;
    g_system_state = SYS_STATE_RUN;
    g_pwm_enabled = 1U;   /* PWM already running deterministic (gated by HW) */
    g_pwm_fastpath_ready = 1U;   /* topology validated by the formal ramp: skip per-tick re-validation */
    g_stage6_transfer_request = 1U;
    return 1U;
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
