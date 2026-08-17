/*
 * power_probe.c
 *
 * Stage 4D one-shot power probe. It is intentionally not a normal PWM enable:
 * it validates strict Stage 4 / safe conditions, starts 150 kHz for at most
 * LLC_POWER_PROBE_MAX_US (2000 us), and stops by on-chip Timer0 tick counting
 * so the stop does not depend on PC/DSS/CCS.
 */

#include "DSP2803x_Device.h"
#include "DSP2803x_Examples.h"
#include "llc_config.h"
#include "llc_globals.h"
#include "pwm.h"
#include "adc.h"
#include "comparator.h"
#include "power_probe.h"

#define POWER_PROBE_TICK_US   20UL
#define POWER_PROBE_TICKS_MAX (LLC_POWER_PROBE_MAX_US / POWER_PROBE_TICK_US)

static Uint32 s_probe_ticks = 0UL;
static volatile Uint32 s_single_cycle_safety_ticks = 0UL;
static Uint16 s_saved_timer0_tie = 0U;
static Uint16 s_saved_adc_int1e = 0U;

static void PRE_STOP_Capture(void)
{
    g_pre_stop_tbctr = EPwm1Regs.TBCTR;
    g_pre_stop_timer2 = CpuTimer2Regs.TIM.all;
    g_pre_stop_tzflg = EPwm1Regs.TZFLG.all;
    g_pre_stop_ost = EPwm1Regs.TZFLG.bit.OST;
    g_pre_stop_gpio15 = GpioDataRegs.GPADAT.bit.GPIO15;
    g_pre_stop_compsts = Comp1Regs.COMPSTS.bit.COMPSTS;
}

static void MULTICYCLE_RestoreInterrupts(void);

static Uint16 POWERPROBE_CheckEntry(void)
{
    if (g_bringup_stage != BRINGUP_STAGE_4_PROTECTION_TEST) return 0U;
    if (g_system_state != SYS_STATE_IDLE) return 0U;
    if (g_pwm_enable_request != 0U) return 0U;
    if (g_pwm_enabled != 0U) return 0U;
    if (EPwm1Regs.TZFLG.bit.OST == 0U) return 0U;   /* must be hardware-latched safe */
    if (g_fault_flags != 0UL) return 0U;
    if (PWM_ConfigMatchesFrozenBaseline() == 0U) return 0U;
    if (GpioCtrlRegs.GPBMUX1.bit.GPIO42 != 3U) return 0U;
    if (GpioCtrlRegs.GPAMUX1.bit.GPIO15 != 1U) return 0U;
    if (g_comp_tz_loopback_verified == 0U) return 0U;
    return 1U;
}

void POWERPROBE_SlowTask(void)
{
    Uint32 duration;
    Uint16 ok;

    if (g_power_probe_request == 0U) return;
    g_power_probe_request = 0U;

    if (POWERPROBE_CheckEntry() == 0U)
    {
        g_power_probe_result = 3U;   /* REJECTED */
        return;
    }

    /* Hard limit duration. */
    duration = g_power_probe_duration_us;
    if (duration == 0UL) duration = LLC_POWER_PROBE_MAX_US;
    if (duration > LLC_POWER_PROBE_MAX_US) duration = LLC_POWER_PROBE_MAX_US;
    g_power_probe_duration_us = duration;

    /* Force fixed 150 kHz. */
    ok = LLC_SetFrequencyHz(LLC_DEFAULT_FREQUENCY_HZ);
    if (ok == 0U)
    {
        g_power_probe_result = 3U;
        return;
    }

    /* Mark probe active before arming comparator so an early TZ trip can
     * abort cleanly instead of leaving a stale active state.  Keep
     * g_pwm_enabled == 0 while COMP_ArmInjectionTest() is called: that
     * function refuses to arm if PWM is already marked enabled. */
    s_probe_ticks = 0UL;
    g_power_probe_active = 1U;
    g_power_window_state = POWER_WINDOW_IDLE;

    /* Arm comparator with a safe no-false-trip threshold (~355 mV). */
    g_comp1_dac_code = 110U;
    g_comp_polarity = 1U;
    COMP_ArmInjectionTest();

    /* If comparator/TZ did not arm cleanly (pre-start trip or entry reject),
     * abort and do NOT release the PWM. OST remains latched by COMP. */
    if (g_comp_prestart_reject != 0U || g_comp_inject_test_armed == 0U)
    {
        g_power_probe_active = 0U;
        g_power_probe_result = 3U;   /* REJECTED */
        g_pwm_enabled = 0U;
        g_pwm_enable_result = 0U;
        return;
    }

    /* Record pre-probe ADC. */
    g_power_probe_adc_vout_before = g_adc_vout_raw;
    g_power_probe_adc_ipri_before = g_adc_ipri_raw;
    g_power_probe_adc_iout_before = g_adc_iout_raw;
    g_power_probe_adc_ipri_peak = g_adc_ipri_raw;

    /* Clear the normal-inhibit OST latch and enable real TZ/comparator trip. */
    g_power_window_state = POWER_WINDOW_ACTIVE;
    EALLOW;
    EPwm1Regs.AQCSFRC.all = 0U;
    EPwm1Regs.TZCLR.all = 0xFFFFU;
    g_probe_tzclr_write_count++;
    EPwm1Regs.TZEINT.bit.OST = 1U;
    EDIS;

    s_probe_ticks = 0UL;
    g_power_probe_active = 1U;
    g_pwm_enabled = 1U;
}

void POWERPROBE_Tick(void)
{
    g_single_cycle_probe_tick_count++;

    if (g_power_probe_active == 0U && g_single_cycle_probe_active == 0U) return;

    /* Safety backup for single-cycle probe: if Timer1 did not stop it within
     * ~40 us, force abort to avoid continuous power. */
    if (g_single_cycle_probe_active != 0U)
    {
        g_single_cycle_probe_safety_count++;
        s_single_cycle_safety_ticks++;
        if (s_single_cycle_safety_ticks >= 2U)
        {
            SINGLECYCLE_AbortByFault();
            return;
        }
    }

    if (g_power_probe_active == 0U) return;

    /* Any fault/abort stops immediately without waiting for the 2 ms budget. */
    if (g_fault_flags != 0UL || g_system_state == SYS_STATE_FAULT)
    {
        g_power_probe_active = 0U;
        g_power_probe_result = 2U;       /* ABORTED_BY_FAULT */
        g_pwm_enabled = 0U;
        g_pwm_enable_result = 0U;
        g_power_probe_adc_vout_after = g_adc_vout_raw;
        g_power_probe_adc_iout_after = g_adc_iout_raw;
        return;
    }

    s_probe_ticks++;
    if (s_probe_ticks >= POWER_PROBE_TICKS_MAX)
    {
        /* Normal completion: unconditional hardware OST stop. */
        LLC_PWM_DisableSafe();
        g_power_probe_adc_vout_after = g_adc_vout_raw;
        g_power_probe_adc_iout_after = g_adc_iout_raw;
        g_power_probe_active = 0U;
        g_power_probe_result = 1U;   /* PASS_COMPLETED */
        g_power_probe_count++;
    }
}


/* ------------------------------------------------------------------ */
/* SINGLE_CYCLE_POWER_PROBE                                           */
/* ------------------------------------------------------------------ */

static Uint16 SINGLECYCLE_CheckEntry(void)
{
    if (g_bringup_stage != BRINGUP_STAGE_4_PROTECTION_TEST) return 0U;
    if (g_system_state != SYS_STATE_IDLE) return 0U;
    if (g_pwm_enable_request != 0U) return 0U;
    if (g_pwm_enabled != 0U) return 0U;
    if (EPwm1Regs.TZFLG.bit.OST == 0U) return 0U;   /* must be hardware-latched safe */
    if (g_fault_flags != 0UL) return 0U;
    if (PWM_ConfigMatchesFrozenBaseline() == 0U) return 0U;
    if (GpioCtrlRegs.GPBMUX1.bit.GPIO42 != 3U) return 0U;
    if (GpioCtrlRegs.GPAMUX1.bit.GPIO15 != 1U) return 0U;
    if (g_comp_tz_loopback_verified == 0U) return 0U;
    return 1U;
}

void SINGLECYCLE_SlowTask(void)
{
    Uint32 probe_freq;

    if (g_single_cycle_probe_request == 0U) return;
    g_single_cycle_probe_request = 0U;

    if (SINGLECYCLE_CheckEntry() == 0U)
    {
        g_single_cycle_probe_result = 3U;   /* REJECTED */
        g_single_cycle_result = 3U;
        return;
    }

    /* Diagnostic frequency (default 150 kHz). The 200 kHz cold-start test is
     * explicitly allowed only when g_diag_frequency_override is set. */
    probe_freq = g_single_cycle_probe_frequency_hz;
    if (probe_freq == 0UL) probe_freq = LLC_DEFAULT_FREQUENCY_HZ;
    if (g_single_cycle_probe_deadtime == 0U)
        g_single_cycle_probe_deadtime = 36U;
    if (LLC_SetFrequencyHz(probe_freq) == 0U)
    {
        g_single_cycle_probe_result = 3U;
        g_single_cycle_result = 3U;
        return;
    }

    /* Cold-start initial-condition capture before marking probe active.
     * 32 software-triggered VOUT samples are averaged to avoid relying on a
     * single ADC point. This runs with PWM still OFF and before the single
     * cycle safety timer can see the probe as active. */
    {
        Uint16 ci;
        Uint32 vsum = 0UL;
        Uint16 v;

        g_coldshot_vout_raw_before = g_adc_vout_raw;
        g_coldshot_ipri_raw_before = g_adc_ipri_raw;
        g_coldshot_vout_baseline_samples = 0U;
        g_coldshot_vout_baseline_avg = 0U;

        for (ci = 0U; ci < 32U; ci++)
        {
            ADC_SoftwareTrigger();
            DELAY_US(20L);
            v = g_adc_vout_raw;
            vsum += v;
        }
        g_coldshot_vout_raw_before = v;
        g_coldshot_vout_baseline_samples = 32U;
        g_coldshot_vout_baseline_avg = (Uint16)(vsum / 32UL);
    }

    /* Initialize probe fields. Active is set later, immediately before the
     * deterministic start, so the Timer0 safety backup cannot count ticks
     * during comparator settle/preparation. */
    g_single_cycle_probe_result = 0U;
    g_single_cycle_probe_start_fast_tick = g_fast_tick;
    g_single_cycle_completed = 0U;
    g_single_cycle_result = 0U;
    g_probe_scheduled_ost_occurred = 0U;
    g_tz_event_phase = 0U;
    g_completed_cycles_at_trip = 0UL;
    g_test_run_id_at_tz_isr = 0UL;
    g_tz_isr_tbctr = 0U;
    g_tz_isr_timer2 = 0UL;
    g_tz_isr_gpio15 = 0U;
    g_tz_isr_compsts = 0U;
    g_tz_isr_tzflg = 0U;
    g_power_window_state = POWER_WINDOW_IDLE;
    g_pre_stop_hardware_trip_seen = 0U;
    g_pre_stop_tzflg = 0U;
    g_pre_stop_ost = 0U;
    g_pre_stop_gpio15 = 0U;
    g_pre_stop_compsts = 0U;
    g_pre_stop_tbctr = 0U;
    g_pre_stop_timer2 = 0UL;
    g_pwm_runtime_write_count = 0UL;
    g_pwm_apply_count = 0UL;
    g_pwm_apply_cycle_last = 0UL;
    g_tbprd_write_count = 0U;
    g_cmpa_write_count = 0U;
    g_dbred_write_count = 0U;
    g_dbfed_write_count = 0U;
    g_tbctr_write_count = 0U;

    /* Diagnostic comparator threshold from g_vout_probe_dac_code. */
    g_comp1_dac_code = g_vout_probe_dac_code & 0x03FFU;
    g_comp_polarity = 1U;
    COMP_ArmForSingleCycleStart(g_vout_probe_dac_code);

    /* If comparator/TZ did not arm cleanly (pre-start trip or entry reject),
     * abort and do NOT release the PWM. OST remains latched by COMP. */
    if (g_comp_prestart_reject != 0U || g_comp_inject_test_armed == 0U)
    {
        g_single_cycle_probe_active = 0U;
        g_single_cycle_probe_result = 3U;   /* REJECTED */
        g_single_cycle_result = 3U;
        g_pwm_enabled = 0U;
        g_pwm_enable_result = 0U;
        return;
    }

    /* Record comparator/TZ and timer state immediately before PWM release. */
    g_coldshot_compsts_before = g_comp_prestart_status;
    g_coldshot_gpio15_before = g_comp_prestart_gpio15;
    g_coldshot_tzflg_before = g_comp_prestart_tzflg;
    g_coldshot_timer2_start = CpuTimer2Regs.TIM.all;

    /* Freeze test-run-ID evidence from actual hardware registers. */
    g_test_run_id_at_arm = g_test_run_id;
    g_test_dac_snapshot = Comp1Regs.DACVAL.bit.DACVAL;
    g_test_tbprd_snapshot = EPwm1Regs.TBPRD;
    g_test_cmpa_snapshot = EPwm1Regs.CMPA.half.CMPA;

    g_single_cycle_probe_adc_vout_before = g_adc_vout_raw;
    g_single_cycle_probe_adc_ipri_before = g_adc_ipri_raw;
    g_single_cycle_probe_adc_ipri_peak = g_adc_ipri_raw;

    /* Apply TZ1 input qualification diagnostic (6-sample, QUALPRD=1). */
    EALLOW;
    GpioCtrlRegs.GPAQSEL1.bit.GPIO15 = (g_tz1_qualification_mode & 0x3U);
    GpioCtrlRegs.GPACTRL.bit.QUALPRD1 = (g_tz1_qualification_period & 0xFFU);
    EDIS;

    /* Mark active only now, immediately before deterministic release. */
    g_single_cycle_probe_active = 1U;

    /* Deterministic release: prepare while OST latched, then start. */
    if (PWM_PrepareStart(g_pwm_period, g_single_cycle_probe_deadtime, 1U) == 0U)
    {
        g_single_cycle_probe_active = 0U;
        g_single_cycle_probe_result = 3U;
        g_single_cycle_result = 3U;
        g_pwm_enabled = 0U;
        g_pwm_enable_result = 0U;
        return;
    }
    PWM_StartDeterministic();

    /* Arm ePWM1 interrupt to stop after exactly one full period.
     * Armed after deterministic start so TBCTR=0 does not cause an
     * immediate false ZERO interrupt before the first real cycle. */
    EALLOW;
    EPwm1Regs.ETSEL.bit.INTSEL = ET_CTR_ZERO;
    g_pwm_runtime_write_count++;
    EPwm1Regs.ETPS.bit.INTPRD  = ET_1ST;
    g_pwm_runtime_write_count++;
    EPwm1Regs.ETCLR.bit.INT    = 1U;
    g_pwm_runtime_write_count++;
    EPwm1Regs.ETSEL.bit.INTEN  = 1U;
    g_pwm_runtime_write_count++;
    EDIS;

    s_single_cycle_safety_ticks = 0UL;
}


static void MULTICYCLE_ConfigureAdcCapture(void)
{
    EALLOW;
    /* Single VOUT channel, hardware ePWM1 SOCA trigger, no ADC CPU interrupt. */
    AdcRegs.ADCSOC0CTL.bit.CHSEL = 1U;
    AdcRegs.ADCSOC0CTL.bit.ACQPS = 7U;
    AdcRegs.ADCSOC0CTL.bit.TRIGSEL = 5U;
    AdcRegs.INTSEL1N2.bit.INT1E = 0U;

    /* Sample near the middle of the period via CMPB. */
    EPwm1Regs.CMPB = LLC_BASELINE_PERIOD_150K / 2U;
    g_pwm_runtime_write_count++;
    EPwm1Regs.ETSEL.bit.SOCASEL = ET_CTRU_CMPB;
    g_pwm_runtime_write_count++;
    EPwm1Regs.ETSEL.bit.SOCAEN = 1U;
    g_pwm_runtime_write_count++;
    EPwm1Regs.ETPS.bit.SOCAPRD = ET_1ST;
    g_pwm_runtime_write_count++;
    EDIS;

    g_adc_trigger_mode = 1U;   /* ePWM1 SOCA capture active */

    g_probe_adc_sample_count = 0U;
    g_probe_vout_min = 0xFFFFU;
    g_probe_vout_max = 0U;
    g_probe_vout_first = 0U;
    g_probe_vout_last = 0U;
}

static void MULTICYCLE_CaptureSample(void)
{
    if (g_probe_adc_sample_count < LLC_PROBE_VOUT_SAMPLE_MAX)
    {
        Uint16 v = AdcResult.ADCRESULT0;
        g_probe_vout_samples[g_probe_adc_sample_count] = v;
        if (g_probe_adc_sample_count == 0U)
        {
            g_probe_vout_first = v;
        }
        g_probe_vout_last = v;
        if (v < g_probe_vout_min) g_probe_vout_min = v;
        if (v > g_probe_vout_max) g_probe_vout_max = v;
        g_probe_adc_sample_count++;
    }
}


static void VOUTPROBE_StartPostCapture(void)
{
    g_vout_probe_post_start_count++;

    EALLOW;
    /* Reconfigure VOUT SOC to software trigger for post-OST capture. */
    AdcRegs.ADCSOC0CTL.bit.CHSEL = 1U;
    AdcRegs.ADCSOC0CTL.bit.ACQPS = 7U;
    AdcRegs.ADCSOC0CTL.bit.TRIGSEL = 0U;
    AdcRegs.INTSEL1N2.bit.INT1E = 0U;
    EDIS;

    /* Non-blocking: only mark that post-OST capture is pending.  The actual
     * sampling is done later in VOUTPROBE_PostCaptureTask() from the 5 ms
     * slow task, never inside the ePWM ISR. */
    g_vout_probe_post_capture_active = 1U;
    g_vout_probe_post_capture_count = 0U;
    g_vout_probe_post_first_raw = 0U;
    g_vout_probe_post_max_raw = 0U;
    g_vout_probe_post_last_raw = 0U;
}

#define VOUTPROBE_POST_CAPTURE_SAMPLES 50U

void VOUTPROBE_PostCaptureTask(void)
{
    Uint16 i;
    Uint16 v;

    if (g_vout_probe_post_capture_active == 0U) return;

    /* Non-ISR post-OST capture: ~50 software-triggered samples. */
    for (i = 0U; i < VOUTPROBE_POST_CAPTURE_SAMPLES; i++)
    {
        ADC_SoftwareTrigger();
        DELAY_US(20L);
        v = AdcResult.ADCRESULT0;
        if (i == 0U)
        {
            g_vout_probe_post_first_raw = v;
            g_vout_probe_post_max_raw = v;
        }
        else if (v > g_vout_probe_post_max_raw)
        {
            g_vout_probe_post_max_raw = v;
        }
        g_vout_probe_post_last_raw = v;
        g_vout_probe_post_capture_count = (Uint16)(i + 1U);
    }
    g_vout_probe_post_capture_active = 0U;
}


__interrupt void EPWM1_INT_ISR(void)
{
    /* Entry timestamp must be the first executable action in the ISR. */
    g_probe_isr_entry_tbctr = EPwm1Regs.TBCTR;
    g_probe_isr_entry_timer2 = CpuTimer2Regs.TIM.all;

    if (g_single_cycle_probe_active != 0U)
    {
        if (g_fault_flags != 0UL || g_system_state == SYS_STATE_FAULT)
        {
            SINGLECYCLE_AbortByFault();
        }
        else
        {
            /* PRE-STOP SNAPSHOT: freeze before any stop-side effects. */
            PRE_STOP_Capture();

            if (g_pre_stop_ost != 0U)
            {
                /* Hardware OST was already latched before scheduled stop:
                 * this is an ACTIVE-window hardware trip, not a clean PASS. */
                g_pre_stop_hardware_trip_seen = 1U;
                g_single_cycle_probe_active = 0U;
                g_single_cycle_probe_result = 2U;
                g_single_cycle_result = 2U;
                g_pwm_enabled = 0U;
                g_pwm_enable_result = 0U;
                EPwm1Regs.ETSEL.bit.INTEN = 0U;
                /* Do NOT call LLC_PWM_DisableSafe(); hardware OST already
                 * latched. Do NOT set scheduled_ost_occurred. */
            }
            else
            {
                /* One full 150 kHz period completed: unconditional stop. */
                EPwm1Regs.ETSEL.bit.INTEN = 0U;
                g_probe_ost_command_tbctr = EPwm1Regs.TBCTR;
                g_probe_ost_command_timer2 = CpuTimer2Regs.TIM.all;
                g_probe_irq_latency_ticks = g_probe_isr_entry_tbctr;
                g_probe_irq_to_ost_ticks =
                    (Uint16)(g_probe_ost_command_tbctr - g_probe_isr_entry_tbctr);
                LLC_PWM_DisableSafe();
                g_probe_scheduled_ost_occurred = 1U;
                g_test_run_id_at_stop = g_test_run_id;
                g_power_window_state = POWER_WINDOW_POST_OST;
                g_single_cycle_probe_adc_vout_after = g_adc_vout_raw;
                g_single_cycle_probe_stop_tbctr = EPwm1Regs.TBCTR;
                g_single_cycle_probe_active = 0U;
                g_single_cycle_probe_result = 1U;   /* PASS_COMPLETED */
                g_single_cycle_probe_count++;
                g_single_cycle_completed = 1U;
                g_single_cycle_result = 1U;
            }
        }
    }
    else if (g_multi_cycle_probe_active != 0U)
    {
        if (g_fault_flags != 0UL || g_system_state == SYS_STATE_FAULT)
        {
            MULTICYCLE_AbortByFault();
        }
        else
        {
            g_multi_cycle_probe_completed_cycles++;

            /* Capture first-3-cycle trace for fixed-vs-micro A/B comparison.
             * This runs for every MULTICYCLE probe and does not change PWM/TZ. */
            if (g_multi_cycle_probe_completed_cycles <= 3UL)
            {
                Uint16 idx = (Uint16)(g_multi_cycle_probe_completed_cycles - 1UL);
                g_mc_trace_cycle[idx] = (Uint16)g_multi_cycle_probe_completed_cycles;
                g_mc_trace_tbctr_at_isr[idx] = EPwm1Regs.TBCTR;
                g_mc_trace_tbprd[idx] = EPwm1Regs.TBPRD;
                g_mc_trace_cmpa[idx] = EPwm1Regs.CMPA.half.CMPA;
                g_mc_trace_dbred[idx] = EPwm1Regs.DBRED;
                g_mc_trace_dbfed[idx] = EPwm1Regs.DBFED;
                g_mc_trace_pwm_apply_count[idx] = (Uint16)g_pwm_apply_count;
                g_mc_trace_tbprd_writes[idx] = g_tbprd_write_count;
                g_mc_trace_cmpa_writes[idx] = g_cmpa_write_count;
                g_mc_trace_dbred_writes[idx] = g_dbred_write_count;
                g_mc_trace_dbfed_writes[idx] = g_dbfed_write_count;
                g_mc_trace_etflg[idx] = EPwm1Regs.ETFLG.all;
                g_mc_trace_tzflg[idx] = EPwm1Regs.TZFLG.all;
                g_mc_trace_micro_stage[idx] = g_micro_ramp_stage;
                g_mc_trace_update_pending[idx] = g_micro_ramp_db_update_pending;
            }

            /* PROFILE_C DB micro-ramp: only set pending DB values at the exact
             * PWM period boundaries. For cycles 1..14 there is no DB rewrite. */
            if (g_micro_ramp_active != 0U)
            {
                if (g_multi_cycle_probe_completed_cycles == 15UL)
                {
                    g_micro_ramp_pending_db = 130U;
                    g_micro_ramp_db_update_pending = 1U;
                    g_micro_ramp_stage = 2U;
                    g_micro_ramp_db_change1_cycle = g_multi_cycle_probe_completed_cycles;
                }
                else if (g_multi_cycle_probe_completed_cycles == 30UL)
                {
                    g_micro_ramp_pending_db = 120U;
                    g_micro_ramp_db_update_pending = 1U;
                    g_micro_ramp_stage = 3U;
                    g_micro_ramp_db_change2_cycle = g_multi_cycle_probe_completed_cycles;
                }
                else if (g_multi_cycle_probe_completed_cycles == 45UL)
                {
                    g_micro_ramp_actual_dbred = EPwm1Regs.DBRED;
                    g_micro_ramp_actual_dbfed = EPwm1Regs.DBFED;
                }

                if (g_micro_ramp_db_update_pending != 0U)
                {
                    /* Apply only DBRED/DBFED, never TBPRD/CMPA. */
                    if (PWM_SetDeadbandOnly(g_micro_ramp_pending_db) == 0U)
                    {
                        MULTICYCLE_AbortByFault();
                        return;
                    }
                    g_micro_ramp_db_update_pending = 0U;
                    g_micro_ramp_actual_dbred = EPwm1Regs.DBRED;
                    g_micro_ramp_actual_dbfed = EPwm1Regs.DBFED;
                }
            }

            if (g_multi_cycle_probe_completed_cycles >= g_multi_cycle_probe_cycles)
            {
                /* PRE-STOP SNAPSHOT before any stop-side effects. */
                PRE_STOP_Capture();

                if (g_pre_stop_ost != 0U)
                {
                    /* Hardware OST already latched before scheduled stop. */
                    g_pre_stop_hardware_trip_seen = 1U;
                    g_multi_cycle_probe_active = 0U;
                    g_multi_cycle_probe_result = 2U;
                    g_multi_cycle_probe_stop_reason = 2U;
                    g_pwm_enabled = 0U;
                    g_pwm_enable_result = 0U;
                    EPwm1Regs.ETSEL.bit.INTEN = 0U;
                    MULTICYCLE_RestoreInterrupts();
                }
                else
                {
                    /* Requested number of complete cycles finished.
                     * OST write is the highest-priority action in this branch. */
                    g_probe_ost_command_tbctr = EPwm1Regs.TBCTR;
                    g_probe_ost_command_timer2 = CpuTimer2Regs.TIM.all;
                    /* EALLOW is required for TZ register writes. Disable TZ interrupt
                     * before forcing OST so the force is not consumed/cleared by
                     * interrupt logic. This is still a direct hardware force. */
                    g_software_ost_in_progress = 1U;
                    EALLOW;
                    EPwm1Regs.TZEINT.bit.OST = 0U;
                    EPwm1Regs.TZFRC.bit.OST = 1U;
                    EDIS;
                    g_probe_scheduled_ost_occurred = 1U;
                    g_test_run_id_at_stop = g_test_run_id;
                    g_power_window_state = POWER_WINDOW_POST_OST;
                    g_probe_tzflg_immediate = EPwm1Regs.TZFLG.bit.OST;
                    g_probe_tzflg_read2 = EPwm1Regs.TZFLG.bit.OST;
                    g_probe_tzflg_read3 = EPwm1Regs.TZFLG.bit.OST;
                    g_probe_ost_after_tbctr = EPwm1Regs.TBCTR;
                    g_probe_ost_after_timer2 = CpuTimer2Regs.TIM.all;

                    g_probe_irq_latency_ticks = g_probe_isr_entry_tbctr;
                    g_probe_irq_to_ost_ticks =
                        (Uint16)(g_probe_ost_command_tbctr - g_probe_isr_entry_tbctr);

                    /* Capture final VOUT sample after OST (not before). */
                    MULTICYCLE_CaptureSample();

                    /* Post-OST bookkeeping only. */
                    EALLOW;
                    EPwm1Regs.ETSEL.bit.INTEN = 0U;
                    EPwm1Regs.TZEINT.bit.OST = 0U;
                    EDIS;
                    g_multi_cycle_probe_adc_vout_after = g_adc_vout_raw;
                    g_multi_cycle_probe_stop_tbctr = EPwm1Regs.TBCTR;
                    g_multi_cycle_probe_stop_reason = 1U;   /* NORMAL */
                    g_multi_cycle_probe_active = 0U;
                    g_multi_cycle_probe_result = 1U;        /* PASS_COMPLETED */
                    g_pwm_enabled = 0U;
                    g_pwm_enable_result = 0U;
                    g_probe_tzflg_after_state_update = EPwm1Regs.TZFLG.bit.OST;
                    MULTICYCLE_RestoreInterrupts();
                    g_software_ost_in_progress = 0U;
                }
            }
            else
            {
                /* Capture one VOUT sample per completed cycle. */
                MULTICYCLE_CaptureSample();
            }
        }
    }
    else if (g_vout_probe_active != 0U)
    {
        if (g_fault_flags != 0UL || g_system_state == SYS_STATE_FAULT)
        {
            VOUTPROBE_AbortByFault();
        }
        else
        {
            Uint16 vout = AdcResult.ADCRESULT0;
            g_vout_probe_completed_cycles++;
            if (vout > g_vout_probe_max_raw) g_vout_probe_max_raw = vout;

            if (vout >= g_vout_probe_hard_limit_raw)
            {
                /* Bring-up hard VOUT limit: OST first. */
                g_vout_probe_pre_stop_max_raw = g_vout_probe_max_raw;
                g_probe_ost_command_tbctr = EPwm1Regs.TBCTR;
                g_probe_ost_command_timer2 = CpuTimer2Regs.TIM.all;
                g_software_ost_in_progress = 1U;
                EALLOW;
                EPwm1Regs.TZEINT.bit.OST = 0U;
                EPwm1Regs.TZFRC.bit.OST = 1U;
                EDIS;
                g_probe_scheduled_ost_occurred = 1U;
                g_test_run_id_at_stop = g_test_run_id;
                g_power_window_state = POWER_WINDOW_POST_OST;
                g_probe_tzflg_immediate = EPwm1Regs.TZFLG.bit.OST;
                g_probe_tzflg_read2 = EPwm1Regs.TZFLG.bit.OST;
                g_probe_tzflg_read3 = EPwm1Regs.TZFLG.bit.OST;
                g_probe_ost_after_tbctr = EPwm1Regs.TBCTR;
                g_probe_ost_after_timer2 = CpuTimer2Regs.TIM.all;
                g_probe_irq_latency_ticks = g_probe_isr_entry_tbctr;
                g_probe_irq_to_ost_ticks =
                    (Uint16)(g_probe_ost_command_tbctr - g_probe_isr_entry_tbctr);

                g_vout_probe_stop_raw = vout;
                g_vout_probe_stop_reason = 4U;   /* HARD_VOUT_LIMIT */
                MULTICYCLE_CaptureSample();

                EALLOW;
                EPwm1Regs.ETSEL.bit.INTEN = 0U;
                EPwm1Regs.TZEINT.bit.OST = 0U;
                EDIS;
                g_vout_probe_active = 0U;
                g_pwm_enabled = 0U;
                g_pwm_enable_result = 0U;
                g_probe_tzflg_after_state_update = EPwm1Regs.TZFLG.bit.OST;
                MULTICYCLE_RestoreInterrupts();
                VOUTPROBE_StartPostCapture();
                g_software_ost_in_progress = 0U;
            }
            else if (vout >= g_vout_probe_target_raw)
            {
                /* VOUT target reached: OST is the first safety action. */
                g_vout_probe_pre_stop_max_raw = g_vout_probe_max_raw;
                g_probe_ost_command_tbctr = EPwm1Regs.TBCTR;
                g_probe_ost_command_timer2 = CpuTimer2Regs.TIM.all;
                g_software_ost_in_progress = 1U;
                EALLOW;
                EPwm1Regs.TZEINT.bit.OST = 0U;
                EPwm1Regs.TZFRC.bit.OST = 1U;
                EDIS;
                g_probe_scheduled_ost_occurred = 1U;
                g_test_run_id_at_stop = g_test_run_id;
                g_power_window_state = POWER_WINDOW_POST_OST;
                g_probe_tzflg_immediate = EPwm1Regs.TZFLG.bit.OST;
                g_probe_tzflg_read2 = EPwm1Regs.TZFLG.bit.OST;
                g_probe_tzflg_read3 = EPwm1Regs.TZFLG.bit.OST;
                g_probe_ost_after_tbctr = EPwm1Regs.TBCTR;
                g_probe_ost_after_timer2 = CpuTimer2Regs.TIM.all;
                g_probe_irq_latency_ticks = g_probe_isr_entry_tbctr;
                g_probe_irq_to_ost_ticks =
                    (Uint16)(g_probe_ost_command_tbctr - g_probe_isr_entry_tbctr);

                g_vout_probe_stop_raw = vout;
                g_vout_probe_stop_reason = 1U;   /* VOUT_TARGET_REACHED */
                MULTICYCLE_CaptureSample();

                EALLOW;
                EPwm1Regs.ETSEL.bit.INTEN = 0U;
                EPwm1Regs.TZEINT.bit.OST = 0U;
                EDIS;
                g_vout_probe_active = 0U;
                g_pwm_enabled = 0U;
                g_pwm_enable_result = 0U;
                g_probe_tzflg_after_state_update = EPwm1Regs.TZFLG.bit.OST;
                MULTICYCLE_RestoreInterrupts();
                VOUTPROBE_StartPostCapture();
                g_software_ost_in_progress = 0U;
            }
            else if (g_vout_probe_completed_cycles >= g_vout_probe_max_cycles)
            {
                /* Max cycle limit reached: OST first. */
                g_vout_probe_pre_stop_max_raw = g_vout_probe_max_raw;
                g_probe_ost_command_tbctr = EPwm1Regs.TBCTR;
                g_probe_ost_command_timer2 = CpuTimer2Regs.TIM.all;
                g_software_ost_in_progress = 1U;
                EALLOW;
                EPwm1Regs.TZEINT.bit.OST = 0U;
                EPwm1Regs.TZFRC.bit.OST = 1U;
                EDIS;
                g_probe_scheduled_ost_occurred = 1U;
                g_test_run_id_at_stop = g_test_run_id;
                g_power_window_state = POWER_WINDOW_POST_OST;
                g_probe_tzflg_immediate = EPwm1Regs.TZFLG.bit.OST;
                g_probe_tzflg_read2 = EPwm1Regs.TZFLG.bit.OST;
                g_probe_tzflg_read3 = EPwm1Regs.TZFLG.bit.OST;
                g_probe_ost_after_tbctr = EPwm1Regs.TBCTR;
                g_probe_ost_after_timer2 = CpuTimer2Regs.TIM.all;
                g_probe_irq_latency_ticks = g_probe_isr_entry_tbctr;
                g_probe_irq_to_ost_ticks =
                    (Uint16)(g_probe_ost_command_tbctr - g_probe_isr_entry_tbctr);

                g_vout_probe_stop_raw = vout;
                g_vout_probe_stop_reason = 2U;   /* MAX_CYCLES_REACHED */
                MULTICYCLE_CaptureSample();

                EALLOW;
                EPwm1Regs.ETSEL.bit.INTEN = 0U;
                EPwm1Regs.TZEINT.bit.OST = 0U;
                EDIS;
                g_vout_probe_active = 0U;
                g_pwm_enabled = 0U;
                g_pwm_enable_result = 0U;
                g_probe_tzflg_after_state_update = EPwm1Regs.TZFLG.bit.OST;
                MULTICYCLE_RestoreInterrupts();
                VOUTPROBE_StartPostCapture();
                g_software_ost_in_progress = 0U;
            }
            else
            {
                MULTICYCLE_CaptureSample();
            }
        }
    }

    EPwm1Regs.ETCLR.bit.INT = 1U;
    PieCtrlRegs.PIEACK.all = PIEACK_GROUP3;
}

void SINGLECYCLE_AbortByFault(void)
{
    if (g_single_cycle_probe_active == 0U) return;

    /* Always hardware-clamp immediately, even if this abort is triggered by
     * the Timer0 safety backup before a TZ latch exists. */
    EALLOW;
    EPwm1Regs.TZEINT.bit.OST = 0U;
    EPwm1Regs.TZFRC.bit.OST = 1U;
    EPwm1Regs.TZCLR.bit.INT = 1U;
    EDIS;

    g_single_cycle_probe_active = 0U;
    g_single_cycle_probe_result = 2U;   /* ABORTED_BY_FAULT */
    g_single_cycle_result = 2U;
    g_pwm_enabled = 0U;
    g_pwm_enable_result = 0U;
    g_single_cycle_probe_stop_tbctr = EPwm1Regs.TBCTR;
    g_single_cycle_probe_adc_vout_after = g_adc_vout_raw;

    EPwm1Regs.ETSEL.bit.INTEN = 0U;
}


/* ------------------------------------------------------------------ */
/* MULTI_CYCLE_POWER_PROBE                                            */
/* ------------------------------------------------------------------ */

static Uint16 MULTICYCLE_CheckEntry(void)
{
    if (g_bringup_stage != BRINGUP_STAGE_4_PROTECTION_TEST) return 0U;
    if (g_system_state != SYS_STATE_IDLE) return 0U;
    if (g_pwm_enable_request != 0U) return 0U;
    if (g_pwm_enabled != 0U) return 0U;
    if (EPwm1Regs.TZFLG.bit.OST == 0U) return 0U;   /* must be hardware-latched safe */
    if (g_fault_flags != 0UL) return 0U;
    if (PWM_ConfigMatchesFrozenBaseline() == 0U) return 0U;
    if (GpioCtrlRegs.GPBMUX1.bit.GPIO42 != 3U) return 0U;
    if (GpioCtrlRegs.GPAMUX1.bit.GPIO15 != 1U) return 0U;
    if (g_comp_tz_loopback_verified == 0U) return 0U;
    return 1U;
}

static void MULTICYCLE_IsolateInterrupts(void)
{
    g_probe_saved_ier = IER;
    g_probe_saved_pieier1 = PieCtrlRegs.PIEIER1.all;
    g_probe_saved_pieier3 = PieCtrlRegs.PIEIER3.all;
    s_saved_timer0_tie = CpuTimer0Regs.TCR.bit.TIE;
    s_saved_adc_int1e = AdcRegs.INTSEL1N2.bit.INT1E;

    /*
     * Keep only TZ (group2) and EPWM1 probe-stop (group3) by masking at the
     * PIE and timer level.  Do NOT rewrite the CPU IER here: C28x IRET
     * restores IER from the interrupt-entry stack frame, so an IER write made
     * inside the probe-stop ISR would be undone and Group1 would stay disabled
     * after the probe (killing Timer0 / the 5 ms slow task).
     */
    EALLOW;
    PieCtrlRegs.PIEIER1.all = 0U;
    CpuTimer0Regs.TCR.bit.TIE = 0U;
    AdcRegs.INTSEL1N2.bit.INT1E = 0U;
    EDIS;

    g_probe_interrupt_isolation_active = 1U;
}

static void MULTICYCLE_RestoreInterrupts(void)
{
    if (g_probe_interrupt_isolation_active == 0U) return;

    EALLOW;
    PieCtrlRegs.PIEIER1.all = g_probe_saved_pieier1;
    PieCtrlRegs.PIEACK.all = PIEACK_GROUP1;   /* unblock Group1 (Timer0/ADC) */
    CpuTimer0Regs.TCR.bit.TIE = s_saved_timer0_tie;
    AdcRegs.INTSEL1N2.bit.INT1E = s_saved_adc_int1e;
    EPwm1Regs.ETSEL.bit.SOCAEN = 0U;
    g_adc_trigger_mode = 0U;   /* restore software-trigger indicator */
    /* NOTE: do not write IER here.  C28x IRET restores the IER that was in
     * effect when the probe-stop ISR was entered; since MULTICYCLE_Isolate
     * no longer changes IER, the original IER (Group1+2+3) is preserved. */
    EDIS;

    g_probe_interrupt_isolation_active = 0U;
}

void MULTICYCLE_SlowTask(void)
{
    Uint32 cycles;
    Uint32 probe_freq;

    if (g_multi_cycle_probe_request == 0U) return;
    g_multi_cycle_probe_request = 0U;

    if (MULTICYCLE_CheckEntry() == 0U)
    {
        g_multi_cycle_probe_result = 3U;   /* REJECTED */
        return;
    }

    /* Diagnostic frequency (default 150 kHz). The 200 kHz / DB140 profile is
     * explicitly allowed when g_diag_frequency_override is set. */
    probe_freq = g_single_cycle_probe_frequency_hz;
    if (probe_freq == 0UL) probe_freq = LLC_DEFAULT_FREQUENCY_HZ;
    if (g_single_cycle_probe_deadtime == 0U)
        g_single_cycle_probe_deadtime = 36U;
    if (LLC_SetFrequencyHz(probe_freq) == 0U)
    {
        g_multi_cycle_probe_result = 3U;
        return;
    }

    /* Hard limit cycles to 3 in this Bring-up stage. */
    cycles = g_multi_cycle_probe_cycles;
    if (cycles == 0UL) cycles = 3UL;
    if (cycles > LLC_MULTI_CYCLE_PROBE_MAX_CYCLES)
        cycles = LLC_MULTI_CYCLE_PROBE_MAX_CYCLES;
    g_multi_cycle_probe_cycles = cycles;

    /* Isolate probe interrupts before arming/starting PWM. */
    MULTICYCLE_IsolateInterrupts();

    /* Configure ePWM1 SOCA VOUT capture for this probe. */
    MULTICYCLE_ConfigureAdcCapture();

    g_multi_cycle_probe_result = 0U;
    g_multi_cycle_probe_completed_cycles = 0UL;
    g_multi_cycle_probe_stop_reason = 0U;
    g_probe_scheduled_ost_occurred = 0U;
    g_power_window_state = POWER_WINDOW_IDLE;

    /* Clear diagnostic evidence at every MULTICYCLE test begin. */
    g_completed_cycles_at_trip = 0UL;
    g_tz_event_phase = 0U;
    g_test_run_id_at_tz_isr = 0UL;
    g_tz_isr_tbctr = 0U;
    g_tz_isr_timer2 = 0UL;
    g_tz_isr_gpio15 = 0U;
    g_tz_isr_compsts = 0U;
    g_tz_isr_tzflg = 0U;
    g_pre_stop_hardware_trip_seen = 0U;
    g_pre_stop_tzflg = 0U;
    g_pre_stop_ost = 0U;
    g_pre_stop_gpio15 = 0U;
    g_pre_stop_compsts = 0U;
    g_pre_stop_tbctr = 0U;
    g_pre_stop_timer2 = 0UL;
    g_micro_ramp_active = 0U;
    g_micro_ramp_stage = 0U;
    g_micro_ramp_db_at_trip = 0U;
    g_micro_ramp_completed_cycles_at_trip = 0UL;
    g_micro_ramp_actual_dbred = 0U;
    g_micro_ramp_actual_dbfed = 0U;
    g_micro_ramp_db_update_pending = 0U;
    g_micro_ramp_pending_db = 0U;

    /* Reset PWM register-write audit counters at each MULTICYCLE begin.
     * Counters will then include the initial PrepareStart/Start writes so a
     * micro-ramp extra write before cycle15 can be detected by subtraction. */
    g_pwm_runtime_write_count = 0UL;
    g_pwm_apply_count = 0UL;
    g_pwm_apply_cycle_last = 0UL;
    g_tbprd_write_count = 0U;
    g_cmpa_write_count = 0U;
    g_dbred_write_count = 0U;
    g_dbfed_write_count = 0U;
    g_tbctr_write_count = 0U;

    /* PROFILE_C DB micro-ramp: if requested, force the full 45-cycle window and
     * schedule DB switches at the PWM period boundaries after cycles 15 and 30. */
    if (g_micro_ramp_request != 0U)
    {
        g_micro_ramp_request = 0U;
        g_micro_ramp_active = 1U;
        g_micro_ramp_stage = 1U;
        g_micro_ramp_db_at_trip = 0U;
        g_micro_ramp_completed_cycles_at_trip = 0UL;
        g_micro_ramp_db_change1_cycle = 15UL;
        g_micro_ramp_db_change2_cycle = 30UL;
        g_micro_ramp_actual_dbred = 140U;
        g_micro_ramp_actual_dbfed = 140U;
        /* Keep the DSS-requested cycle count. The full PROFILE_C test uses
         * 45; the no-energy A/B audit uses 3 and stops before any DB change. */
        g_multi_cycle_probe_completed_cycles = 0UL;
    }

    /* Temporary diagnostic comparator threshold ~0.97 V (DAC=300). */
    g_comp1_dac_code = LLC_SINGLE_CYCLE_PROBE_DAC;
    g_comp_polarity = 1U;
    COMP_ArmForSingleCycleStart(g_comp1_dac_code);

    /* If comparator/TZ did not arm cleanly, abort and restore probe isolation. */
    if (g_comp_prestart_reject != 0U || g_comp_inject_test_armed == 0U)
    {
        g_multi_cycle_probe_active = 0U;
        g_multi_cycle_probe_result = 3U;   /* REJECTED */
        g_pwm_enabled = 0U;
        g_pwm_enable_result = 0U;
        MULTICYCLE_RestoreInterrupts();
        return;
    }

    g_multi_cycle_probe_adc_vout_before = g_adc_vout_raw;
    g_multi_cycle_probe_adc_ipri_before = g_adc_ipri_raw;
    g_multi_cycle_probe_adc_ipri_peak = g_adc_ipri_raw;

    /* Apply TZ1 input qualification diagnostic (6-sample, QUALPRD=1). */
    EALLOW;
    GpioCtrlRegs.GPAQSEL1.bit.GPIO15 = (g_tz1_qualification_mode & 0x3U);
    GpioCtrlRegs.GPACTRL.bit.QUALPRD1 = (g_tz1_qualification_period & 0xFFU);
    EDIS;

    /* Freeze TEST_RUN_ID evidence at the final arm point before PWM release. */
    g_test_run_id_at_arm = g_test_run_id;

    /* Mark active immediately before deterministic release. */
    g_multi_cycle_probe_active = 1U;

    if (PWM_PrepareStart(g_pwm_period, g_single_cycle_probe_deadtime, 1U) == 0U)
    {
        g_multi_cycle_probe_active = 0U;
        g_multi_cycle_probe_result = 3U;
        g_pwm_enabled = 0U;
        g_pwm_enable_result = 0U;
        MULTICYCLE_RestoreInterrupts();
        return;
    }
    PWM_StartDeterministic();

    /* Arm ePWM1 interrupt after deterministic start (avoid TBCTR=0 false hit). */
    EALLOW;
    EPwm1Regs.ETSEL.bit.INTSEL = ET_CTR_ZERO;
    g_pwm_runtime_write_count++;
    EPwm1Regs.ETPS.bit.INTPRD  = ET_1ST;
    g_pwm_runtime_write_count++;
    EPwm1Regs.ETCLR.bit.INT    = 1U;
    g_pwm_runtime_write_count++;
    EPwm1Regs.ETSEL.bit.INTEN  = 1U;
    g_pwm_runtime_write_count++;
    EDIS;
}

void MULTICYCLE_AbortByFault(void)
{
    if (g_multi_cycle_probe_active == 0U) return;

    /* Always hardware-clamp immediately, even if no TZ latch exists yet. */
    EALLOW;
    EPwm1Regs.TZEINT.bit.OST = 0U;
    EPwm1Regs.TZFRC.bit.OST = 1U;
    EPwm1Regs.TZCLR.bit.INT = 1U;
    EDIS;

    g_multi_cycle_probe_active = 0U;
    g_multi_cycle_probe_result = 2U;   /* ABORTED_BY_FAULT */
    g_pwm_enabled = 0U;
    g_pwm_enable_result = 0U;
    g_multi_cycle_probe_stop_tbctr = EPwm1Regs.TBCTR;
    g_multi_cycle_probe_stop_reason = 2U;   /* FAULT */
    g_multi_cycle_probe_adc_vout_after = g_adc_vout_raw;

    EPwm1Regs.ETSEL.bit.INTEN = 0U;
    MULTICYCLE_RestoreInterrupts();
}

/* ------------------------------------------------------------------ */
/* VOUT_LIMITED_POWER_PROBE                                           */
/* ------------------------------------------------------------------ */

void VOUTPROBE_SlowTask(void)
{
    if (g_vout_probe_request == 0U) return;
    g_vout_probe_request = 0U;

    if (MULTICYCLE_CheckEntry() == 0U)
    {
        g_vout_probe_stop_reason = 0U;
        g_vout_probe_active = 0U;
        return;
    }

    /* Fixed 150 kHz. */
    if (LLC_SetFrequencyHz(LLC_DEFAULT_FREQUENCY_HZ) == 0U)
    {
        g_vout_probe_stop_reason = 0U;
        return;
    }

    /* Clamp target to 12-bit ADC range. */
    if (g_vout_probe_target_raw > 0x0FFFU)
    {
        g_vout_probe_target_raw = 0x0FFFU;
    }
    if (g_vout_probe_hard_limit_raw == 0U)
    {
        g_vout_probe_hard_limit_raw = LLC_VOUT_PROBE_HARD_LIMIT_RAW;
    }
    if (g_vout_probe_hard_limit_raw > 0x0FFFU)
    {
        g_vout_probe_hard_limit_raw = 0x0FFFU;
    }
    if (g_vout_probe_max_cycles == 0UL)
    {
        g_vout_probe_max_cycles = LLC_VOUT_PROBE_MAX_CYCLES;
    }

    /* Isolate probe interrupts and configure ePWM1 SOCA VOUT capture. */
    MULTICYCLE_IsolateInterrupts();
    MULTICYCLE_ConfigureAdcCapture();

    g_vout_probe_active = 1U;
    g_vout_probe_completed_cycles = 0UL;
    g_vout_probe_stop_raw = 0U;
    g_vout_probe_max_raw = 0U;
    g_vout_probe_stop_reason = 0U;
    g_probe_scheduled_ost_occurred = 0U;
    g_power_window_state = POWER_WINDOW_IDLE;

    /* Comparator/TZ remains armed.  Call before g_pwm_enabled is set so
     * COMP_ArmInjectionTest() actually arms instead of bailing out.
     * The threshold is a diagnostic variable (g_vout_probe_dac_code), not
     * a final OCP value. */
    g_comp1_dac_code = g_vout_probe_dac_code & 0x03FFU;
    g_comp_polarity = 1U;
    COMP_ArmInjectionTest();

    /* If comparator/TZ did not arm cleanly, abort and restore probe isolation. */
    if (g_comp_prestart_reject != 0U || g_comp_inject_test_armed == 0U)
    {
        g_vout_probe_active = 0U;
        g_vout_probe_stop_reason = 0U;   /* no shot started */
        g_pwm_enabled = 0U;
        g_pwm_enable_result = 0U;
        MULTICYCLE_RestoreInterrupts();
        return;
    }
    g_pwm_enabled = 1U;

    /* Apply TZ1 input qualification diagnostic. */
    EALLOW;
    GpioCtrlRegs.GPAQSEL1.bit.GPIO15 = (g_tz1_qualification_mode & 0x3U);
    GpioCtrlRegs.GPACTRL.bit.QUALPRD1 = (g_tz1_qualification_period & 0xFFU);

    /* Arm ePWM1 interrupt to count cycles and check VOUT target. */
    EPwm1Regs.ETSEL.bit.INTSEL = ET_CTR_ZERO;
    EPwm1Regs.ETSEL.bit.INTEN  = 1U;
    EPwm1Regs.ETPS.bit.INTPRD  = ET_1ST;
    EPwm1Regs.ETCLR.bit.INT    = 1U;
    g_power_window_state = POWER_WINDOW_ACTIVE;
    EPwm1Regs.AQCSFRC.all = 0U;
    EPwm1Regs.TZCLR.all = 0xFFFFU;
    g_probe_tzclr_write_count++;
    EPwm1Regs.TZEINT.bit.OST = 1U;
    EDIS;
}

void VOUTPROBE_AbortByFault(void)
{
    if (g_vout_probe_active == 0U) return;

    /* Always hardware-clamp immediately, even if no TZ latch exists yet. */
    EALLOW;
    EPwm1Regs.TZEINT.bit.OST = 0U;
    EPwm1Regs.TZFRC.bit.OST = 1U;
    EPwm1Regs.TZCLR.bit.INT = 1U;
    EDIS;

    g_vout_probe_active = 0U;
    g_vout_probe_stop_reason = 3U;   /* FAULT */
    g_pwm_enabled = 0U;
    g_pwm_enable_result = 0U;

    EPwm1Regs.ETSEL.bit.INTEN = 0U;
    MULTICYCLE_RestoreInterrupts();
}

/* ------------------------------------------------------------------ */
/* CALIBRATION_HOLD_PROBE                                             */
/* ------------------------------------------------------------------ */

void CALHOLD_SlowTask(void)
{
    Uint16 v;

    g_cal_hold_slow_count++;

    if (g_cal_hold_request != 0U)
    {
        g_cal_hold_request = 0U;
        g_cal_hold_active = 1U;
        g_cal_hold_charge_done = 0U;
        g_cal_hold_packet_active = 0U;
        g_cal_hold_packet_count = 0UL;
        g_cal_hold_total_on_cycles = 0UL;
        g_cal_hold_raw_min = 0xFFFFU;
        g_cal_hold_raw_max = 0U;
        g_cal_hold_raw_sum = 0UL;
        g_cal_hold_raw_samples = 0UL;
        g_cal_hold_raw_average = 0U;
        g_cal_hold_fault = 0U;
        g_cal_hold_stop_reason = 0U;
        g_cal_hold_start_fast_tick = g_fast_tick;
        if (g_cal_hold_duration_ms == 0UL)
        {
            g_cal_hold_duration_ms = LLC_CAL_HOLD_DEFAULT_DURATION_MS;
        }

        /* Initial charge to 1400 raw using the verified VOUT probe.
         * Use the CAL_HOLD hard limit (1450) and the normal 300-cycle cap. */
        g_vout_probe_target_raw = LLC_CAL_HOLD_CHARGE_TARGET_RAW;
        g_vout_probe_hard_limit_raw = LLC_CAL_HOLD_HARD_LIMIT_RAW;
        g_vout_probe_max_cycles = LLC_VOUT_PROBE_MAX_CYCLES;
        g_cal_hold_initial_stop_raw = 0U;
        g_cal_hold_packet_start_raw = 0U;
        g_cal_hold_packet_stop_raw = 0U;
        g_cal_hold_packet_post_max_raw = 0U;
        g_cal_hold_packet_post_last_raw = 0U;
        g_cal_hold_packet_actual_cycles = 0UL;
        if (g_cal_hold_max_total_extra_cycles == 0UL)
        {
            g_cal_hold_max_total_extra_cycles = LLC_CAL_HOLD_MAX_TOTAL_EXTRA_CYCLES;
        }
        g_vout_probe_request = 1U;
        return;
    }

    if (g_cal_hold_active == 0U) return;

    /* Wait for initial charge to finish. */
    if (g_cal_hold_charge_done == 0U)
    {
        g_cal_hold_last_vout_active = g_vout_probe_active;
        g_cal_hold_last_vout_stop_reason = g_vout_probe_stop_reason;
        if (g_vout_probe_active == 0U && g_vout_probe_stop_reason == 1U)
        {
            g_cal_hold_charge_seen = 1U;
            g_cal_hold_charge_done = 1U;
            g_cal_hold_total_on_cycles = 0UL;
            g_cal_hold_initial_stop_raw = g_vout_probe_stop_raw;
        }
        else if (g_vout_probe_active == 0U &&
                 (g_vout_probe_stop_reason == 4U || g_vout_probe_stop_reason == 3U ||
                  g_fault_flags != 0UL))
        {
            g_cal_hold_fault = 1U;
            g_cal_hold_stop_reason = 3U;
            g_cal_hold_active = 0U;
            return;
        }
        else if (g_vout_probe_active == 0U && g_vout_probe_stop_reason == 0U &&
                 g_vout_probe_request == 0U)
        {
            /* Initial charge may have been rejected before loopback was ready;
             * retry until it is accepted. */
            g_vout_probe_target_raw = LLC_CAL_HOLD_CHARGE_TARGET_RAW;
            g_vout_probe_hard_limit_raw = LLC_CAL_HOLD_HARD_LIMIT_RAW;
            g_vout_probe_max_cycles = LLC_VOUT_PROBE_MAX_CYCLES;
            g_vout_probe_request = 1U;
            return;
        }
        else
        {
            return;
        }
    }

    /* Time limit */
    if ((g_fast_tick - g_cal_hold_start_fast_tick) >= (g_cal_hold_duration_ms * 50UL))
    {
        g_cal_hold_stop_reason = 1U;
        g_cal_hold_active = 0U;
        if (g_cal_hold_raw_samples != 0UL)
        {
            g_cal_hold_raw_average = (Uint16)(g_cal_hold_raw_sum / g_cal_hold_raw_samples);
        }
        return;
    }

    /* Total energy limit (runtime-overridable for single-packet diagnostic) */
    if (g_cal_hold_total_on_cycles >= g_cal_hold_max_total_extra_cycles)
    {
        g_cal_hold_stop_reason = 2U;
        g_cal_hold_active = 0U;
        if (g_cal_hold_raw_samples != 0UL)
        {
            g_cal_hold_raw_average = (Uint16)(g_cal_hold_raw_sum / g_cal_hold_raw_samples);
        }
        return;
    }

    /* If a VOUT probe (charge or packet) is running, wait. */
    if (g_vout_probe_active != 0U)
    {
        if (g_vout_probe_stop_reason == 4U || g_vout_probe_stop_reason == 3U ||
            g_fault_flags != 0UL)
        {
            g_cal_hold_fault = 1U;
            g_cal_hold_stop_reason = 3U;
            g_cal_hold_active = 0U;
        }
        return;
    }

    /* A packet just finished: accumulate energy and record 1-cycle evidence. */
    if (g_cal_hold_packet_active != 0U)
    {
        g_cal_hold_total_on_cycles += g_vout_probe_completed_cycles;
        g_cal_hold_packet_count++;
        g_cal_hold_packet_actual_cycles = g_vout_probe_completed_cycles;
        g_cal_hold_packet_stop_raw = g_vout_probe_stop_raw;
        g_cal_hold_packet_post_max_raw = g_vout_probe_post_max_raw;
        g_cal_hold_packet_post_last_raw = g_vout_probe_post_last_raw;
        g_cal_hold_packet_active = 0U;
    }

    /* Sample current VOUT with software trigger. */
    ADC_SoftwareTrigger();
    DELAY_US(20L);
    v = AdcResult.ADCRESULT0;

    if (v < g_cal_hold_raw_min) g_cal_hold_raw_min = v;
    if (v > g_cal_hold_raw_max) g_cal_hold_raw_max = v;
    g_cal_hold_raw_sum += v;
    g_cal_hold_raw_samples++;

    if (v >= LLC_CAL_HOLD_HARD_LIMIT_RAW)
    {
        g_cal_hold_fault = 1U;
        g_cal_hold_stop_reason = 3U;
        g_cal_hold_active = 0U;
        return;
    }

    /* Low-energy 1-cycle packet when output droops below low threshold.
     * This is the true packet implementation: VOUTPROBE is limited to
     * LLC_CAL_HOLD_MAX_PACKET_CYCLES (currently 1) and to the CAL_HOLD
     * hard limit (1450), not the generic 300-cycle / 1470 limit. */
    if (v <= LLC_CAL_HOLD_LOW_RAW)
    {
        g_vout_probe_target_raw = LLC_CAL_HOLD_HIGH_RAW;
        g_vout_probe_hard_limit_raw = LLC_CAL_HOLD_HARD_LIMIT_RAW;
        g_vout_probe_max_cycles = LLC_CAL_HOLD_MAX_PACKET_CYCLES;
        g_cal_hold_packet_start_raw = v;
        g_cal_hold_packet_stop_raw = 0U;
        g_cal_hold_packet_post_max_raw = 0U;
        g_cal_hold_packet_actual_cycles = 0UL;
        g_vout_probe_request = 1U;
        g_cal_hold_packet_active = 1U;
    }
}
