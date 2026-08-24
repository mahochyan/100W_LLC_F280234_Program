/*
 * protection.c
 *
 * Centralized fault handling.  Real TZ1 trips are counted in the ISR.
 * Normal inhibit and non-force software faults do not increment g_trip_count.
 */

#include "DSP2803x_Device.h"
#include "DSP2803x_Examples.h"
#include "llc_config.h"
#include "llc_globals.h"
#include "pwm.h"
#include "adc.h"
#include "control.h"
#include "comparator.h"
#include "power_probe.h"
#include "cal_hold_burst.h"
#include "soft_start.h"
#include "shot.h"
#include "protection.h"

static Uint32 s_last_adc_counter = 0UL;
static Uint16 s_adc_stale_count = 0U;

void PROT_Init(void)
{
    s_last_adc_counter = 0UL;
    s_adc_stale_count = 0U;
    g_fault_flags = 0UL;
    g_fault_history = 0UL;
    g_trip_count = 0U;
    g_tz_software_ost_count = 0UL;
    g_tz_hardware_trip_count = 0UL;
    g_tz_active_window_trip_count = 0UL;
    g_tz_post_ost_trip_count = 0UL;
    g_post_ost_trip_delay_ticks = 0UL;
    g_power_window_state = POWER_WINDOW_IDLE;
    g_software_ost_in_progress = 0U;
    g_fast_fault_count = 0U;
    g_fault_reset_request = 0U;
    g_force_trip_request = 0U;
    g_single_cycle_probe_frequency_hz = LLC_DEFAULT_FREQUENCY_HZ;
    g_test_run_id = 0UL;
    g_test_run_id_at_arm = 0UL;
    g_test_run_id_at_tz_isr = 0UL;
    g_test_run_id_at_stop = 0UL;
    g_test_dac_snapshot = 0U;
    g_test_tbprd_snapshot = 0U;
    g_test_cmpa_snapshot = 0U;
    g_static_cal_request = 0U;
    g_static_cal_dac = 0U;
    g_static_cal_armed = 0U;
    g_static_cal_initial_compsts = 0U;
    g_static_cal_initial_gpio15 = 0U;
    g_static_cal_transition_detected = 0U;
    g_static_cal_compsts_before = 0U;
    g_static_cal_compsts_after = 0U;
    g_static_cal_gpio15_before = 0U;
    g_static_cal_gpio15_after = 0U;
    g_static_cal_tzflg_after = 0U;
    g_static_cal_disarm_request = 0U;
    g_enable_rising_count = 0UL;
    g_softstart_final_apply_count = 0UL;
    g_softstart_final_applied = 0U;
    g_softstart_final_apply_pending = 0U;
    g_softstart_abort_reason = 0U;
    g_pwm_start_prepared = 0U;
    g_no_energy_test_mode = 0U;

    /* Critical zero-init for globals that were previously compile-time zero.
     * Keeping them as uninitialized .ebss saves .cinit space, so they must be
     * explicitly reset here before the application loop starts. */
#if !STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD
    g_diag_frequency_override = 0U;   /* diagnostic override: absent from REAL shot binary */
#endif
    g_adc_trigger_mode = 0U;
    g_adc_sample_counter = 0UL;
    g_adc_sample_sequence = 0UL;
    g_single_cycle_probe_request = 0U;
    g_single_cycle_probe_deadtime = 0U;
    g_power_probe_request = 0U;
    g_multi_cycle_probe_request = 0U;
    g_vout_probe_request = 0U;
    g_cal_hold_request = 0U;
    g_loopback_diag_request = 0U;
    g_comp_inject_test_request = 0U;
    g_comp_inject_test_disarm_request = 0U;
    g_accel_request = 0U;
    g_accel_active = 0U;
    g_poststop_vout_request = 0U;
    g_poststop_vout_done = 0U;
    g_poststop_vout_phase = 0U;
    g_first_start_seen = 0U;
    g_first_start_tbprd = 0U;
    g_first_start_cmpa = 0U;
    g_first_start_dbred = 0U;
    g_first_start_dbfed = 0U;
    g_first_start_dacval = 0U;
    g_first_start_ost = 0U;
    g_first_start_pwm = 0U;
}

void PROT_RequestFault(Uint32 cause, Uint16 countTrip)
{
    PWM_Trip(cause, countTrip);
}

__interrupt void EPWM1_TZINT_ISR(void)
{
    /* Record TZ ISR entry diagnostics as early as possible. */
    g_tz_isr_tbctr = EPwm1Regs.TBCTR;
    g_tz_isr_timer2 = CpuTimer2Regs.TIM.all;
    g_test_run_id_at_tz_isr = g_test_run_id;
    g_tz_isr_software_ost_flag = g_software_ost_in_progress;
    g_tz_isr_after_scheduled_ost = g_probe_scheduled_ost_occurred;
    g_tz_isr_gpio15 = GpioDataRegs.GPADAT.bit.GPIO15;
    g_tz_isr_compsts = Comp1Regs.COMPSTS.bit.COMPSTS;
    g_tz_isr_tzflg = EPwm1Regs.TZFLG.all;

    /* Freeze the completed-cycle counter at the first TZ ISR entry.
     * This records how far a multi-cycle probe got before a real trip. */
    g_completed_cycles_at_trip = g_multi_cycle_probe_completed_cycles;

    /* PROFILE_C ACCELERATED bounded softstart: freeze trip evidence. */
    g_accel_trip_phase = g_accel_phase;
    g_accel_trip_period = g_accel_current_period;
    g_accel_trip_cmpa = g_accel_current_cmpa;
    g_accel_trip_db = g_accel_current_db;
    g_accel_trip_completed_cycles = g_multi_cycle_probe_completed_cycles;
    g_accel_stop_reason = ACCEL_STOP_TZ_TRIP;

    g_comp_trip_dac_code = Comp1Regs.DACVAL.bit.DACVAL;
    g_comp_trip_tbctr = EPwm1Regs.TBCTR;
    g_comp_trip_vout_raw = AdcResult.ADCRESULT0;

    /*
     * Distinguish intentional software OST from a real Comparator/TZ1 trip.
     * If a software OST is in progress, this interrupt is expected/normal and
     * must NOT be recorded as FAULT_COMP_TZ1 or as a hardware trip.
     */
    if (g_software_ost_in_progress != 0U)
    {
        g_tz_event_phase = 0U;   /* TZ_EVENT_NONE / software-OST */
        g_tz_software_ost_count++;
        EPwm1Regs.TZCLR.bit.INT = 1U;
        PieCtrlRegs.PIEACK.all = PIEACK_GROUP2;
        return;
    }

    /* No-energy benchmark: there is no real power, so a real comparator/TZ1
     * trip is environmental noise (floating comparator on the open bench),
     * not a hardware fault. Count it and leave OST latched (outputs stay
     * clamped) but DO NOT fault the software sim. This path exists ONLY in the
     * no-energy test build and is inactive while the real actuator is armed.
     * The production build has NO such bypass: every real TZ1 event becomes
     * FAULT_COMP_TZ1 / SYS_STATE_FAULT / PWM inhibited. */
#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    if (g_softstart_no_energy != 0U && g_stage6_actuator_test_arm == 0U)
    {
        g_tz_noenergy_trip_count++;
        g_tz_hardware_trip_count++;
        EPwm1Regs.TZCLR.bit.INT = 1U;
        PieCtrlRegs.PIEACK.all = PIEACK_GROUP2;
        return;
    }
#endif

    /*
     * Real hardware TZ1 event. Classify by power-window state:
     *   ACTIVE            -> ACTIVE_WINDOW_TZ_TRIP -> FAULT
     *   POST_OST          -> POST_OST_TZ_EVENT     -> diagnostic only, no FAULT
     *   IDLE/unknown      -> treated as ACTIVE (safe)
     */
    if (g_power_window_state == POWER_WINDOW_POST_OST)
    {
        g_tz_event_phase = 2U;   /* POST_OST */
        g_tz_post_ost_trip_count++;
        g_tz_hardware_trip_count++;
        g_post_ost_trip_delay_ticks = (Uint32)(g_probe_ost_command_timer2 - g_tz_isr_timer2);

        /* Diagnostic only: do NOT set FAULT_COMP_TZ1, do NOT enter FAULT. */
        EPwm1Regs.TZCLR.bit.INT = 1U;
        PieCtrlRegs.PIEACK.all = PIEACK_GROUP2;
        return;
    }

    /* ACTIVE_WINDOW (or unexpected IDLE) hardware trip -> real FAULT. */
    g_tz_event_phase = 1U;   /* ACTIVE_WINDOW */
    g_tz_active_window_trip_count++;
    g_tz_hardware_trip_count++;
    g_trip_count++;
    g_fault_flags |= FAULT_COMP_TZ1;
    g_fault_history |= FAULT_COMP_TZ1;
    g_system_state = SYS_STATE_FAULT;
    g_pwm_enabled = 0U;
    g_pwm_enable_result = 0U;
#if STAGE6_REAL_ACTUATOR_OST_TEST
    /* Real actuator under OST: a real trip revokes actuator write permission
     * immediately and irreversibly until the harness resets it. The write gate
     * (CTRL_ApplyFrequencyCommand) then refuses to touch PWM. */
    g_stage6_actuator_test_arm = 0U;
    g_stage6_actuator_revoked = 1U;
#endif

    /* G: a real Comparator/TZ trip immediately revokes the first-shot permission. */
#if STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
    SHOT_OnTrip();   /* G: real TZ -> revoke shot (first-shot build only) */
#endif

    /* Single/multi-cycle probe abort hooks */
    SINGLECYCLE_AbortByFault();
    MULTICYCLE_AbortByFault();

    EPwm1Regs.TZCLR.bit.INT = 1U;
    PieCtrlRegs.PIEACK.all = PIEACK_GROUP2;
}

__interrupt void TINT0_ISR(void)
{
#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    Uint32 t_isr_entry = 0UL, t_isr_exit = 0UL;
    if (g_stage6_noenergy_test_enable != 0U)
    {
        t_isr_entry = CpuTimer2Regs.TIM.all;   /* free-running 60 MHz down counter */
        /* Timer0 entry interval: cycles between successive TINT0 ISR entries.
         * Nominal is ~1200 cycles (20 us). A longer interval means the previous
         * ISR (e.g. an ADCINT1 + PI) missed the deadline and the next tick was
         * deferred -> real-time violation detection (gate Q). */
        if (g_timer0_entry_count == 0UL)
        {
            g_timer0_entry_interval_min = 0UL;
            g_timer0_entry_interval_max = 0UL;
        }
        else
        {
            Uint32 delta = (Uint32)((Uint32)(g_timer0_last_entry - t_isr_entry) & 0xFFFFFFFFUL);
            if (g_timer0_entry_interval_min == 0UL || delta < g_timer0_entry_interval_min)
                g_timer0_entry_interval_min = delta;
            if (delta > g_timer0_entry_interval_max)
                g_timer0_entry_interval_max = delta;
        }
        g_timer0_entry_count++;
        g_timer0_last_entry = t_isr_entry;
    }
#endif
#if STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD
    /* Passive whole-ISR / entry-interval observation (gate K1). Read-only
     * Timer2 cycle counting; does not modify ADC, PI input, PWM command, or
     * protection. Present in the final frozen REAL OUT. */
    {
        Uint32 r_entry = CpuTimer2Regs.TIM.all;
        if (g_real_timer0_entry_count == 0UL)
        {
            g_real_timer0_entry_interval_min = 0UL;
            g_real_timer0_entry_interval_max = 0UL;
        }
        else
        {
            Uint32 r_delta = (Uint32)((Uint32)(g_real_timer0_last_entry - r_entry) & 0xFFFFFFFFUL);
            if (r_delta > g_real_timer0_entry_interval_max)
                g_real_timer0_entry_interval_max = r_delta;
            /* Shot-local entry interval: only while the bounded shot is ACTIVE.
             * Reset at first apply in CTRL_PipelineApply; frozen at TIMEOUT by
             * SHOT_Revoke. This excludes APP init / stage confirms / IDLE. */
            if (g_first_real_pi_shot_state == SHOT_STATE_ACTIVE)
            {
                Uint32 s_delta = (Uint32)((Uint32)(g_shot_entry_last - r_entry) & 0xFFFFFFFFUL);
                if (s_delta > g_shot_entry_interval_max)
                    g_shot_entry_interval_max = s_delta;
                g_shot_entry_last = r_entry;
            }
        }
        g_real_timer0_entry_count++;
        g_real_timer0_last_entry = r_entry;
    /* RECOVERY V1 candidate 2: g_real_isr_cycles_last is always filled at ISR
     * exit (below); the zero store at entry was redundant and is removed to
     * keep the 20 us budget. */
    }
#endif
    g_fast_tick++;

    /* Stage 3 static ADC monitor: software-trigger a sample set every 20 us. */
    if (g_bringup_stage == BRINGUP_STAGE_3_ADC_MONITOR &&
        g_adc_trigger_mode == 0U)
    {
        ADC_SoftwareTrigger();
    }

    /* Stage 4D one-shot power probe hardware-timer tick. */

    /* 20 us fast control: new ADC sample -> PI/PFM -> PWM update -> fast protection */
    CALHOLD_FastTask();
    PROT_FastTask();
    CTRL_FastTask();
#if STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
    SHOT_FastTask();   /* first-shot timer / 11V abort / ring record (shot build only) */
#endif
    SoftStart_ApplyLimits();

#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    /* STAGE6 no-energy budget measurement hook. Runs on top of the normal
     * fast-task base load (CTRL_FastTask already returned safely because
     * g_pwm_enabled==0), then executes one real PI shadow step with the
     * synthetic Vout. This is a CONSERVATIVE whole-ISR measurement: normal
     * base + real PI compute + the small hook overhead. It never toggles PWM,
     * never clears OST, never sets g_pwm_enabled, never enters real RUN. */
    if (g_stage6_noenergy_test_enable != 0U)
    {
        g_stage6_noenergy_test_ticks++;
        if (g_stage6_noenergy_test_mode == 4U)
        {
            /* CLOSED-LOOP OBSERVE (STAGE6_CLOSED_LOOP_HANDOFF): the real
             * ADCINT1_ISR + real CTRL_FastTask own the closed loop. This hook
             * only (a) applies a one-shot test time-base configuration for the
             * ADC cadence runs (120/150/180 kHz), and (b) lets the whole-ISR
             * budget snapshot below measure the REAL closed-loop TINT0 load. No
             * synthetic ADC injection, no second PI call. */
            if (g_stage6_cadence_test_freq != 0UL)
            {
                Uint32 per;
                per = (LLC_TBCLK_HZ + (g_stage6_cadence_test_freq / 2UL)) /
                      g_stage6_cadence_test_freq;
                if (per > 0UL) per -= 1UL;
                EALLOW;
                EPwm1Regs.TBPRD = (Uint16)per;
                EPwm1Regs.CMPA.half.CMPA = (Uint16)((per + 1UL) / 2UL);
                ADC_UpdatePwmSyncPoint((Uint16)(per + 1UL));
                EPwm1Regs.ETPS.bit.SOCAPRD = ET_3RD;   /* keep closed-loop cadence */
                EDIS;
                g_stage6_cadence_test_freq = 0UL;      /* applied once */
            }
        }
        else
        {
            /* Production-input-binding: emulate the real ADCINT path producing
             * the LATEST frame + NEW-sample sequence, then run the production
             * fast control body (freshness + binding + PI + shadow apply).
             *   mode 1 = FRESH (auto-advance sequence every tick; worst case)
             *   mode 3 = HELD  (sequence held; first tick consumes once, then freeze)
             * PWM stays 0 / OST stays 1; no real power. */
            Uint32 tb, tx;
            if (g_stage6_noenergy_test_mode == 1U)
            {
                g_stage6_synthetic_sequence++;   /* new sample every 20 us tick */
            }
            g_adc_sample_sequence    = g_stage6_synthetic_sequence;
            g_adc_vout_filtered_raw  = g_stage6_synthetic_vout_raw;
            tb = CpuTimer2Regs.TIM.all;
            g_control_running = 1U;
            g_control_frequency_hz = g_control_shadow_frequency_hz; /* keep committed base */
            CTRL_RunFastControl();   /* production freshness + binding + PI + apply */
            tx = CpuTimer2Regs.TIM.all;
            /* region B: one Compute+Apply (down counter -> entry-exit diff) */
            g_control_exec_cycles_last = (Uint32)((Uint32)(tb - tx) & 0xFFFFFFFFUL);
            if (g_control_exec_cycles_last > g_control_exec_cycles_max)
                g_control_exec_cycles_max = g_control_exec_cycles_last;
        }
    }
#endif

    /* 5 ms slow-task tick. RECOVERY V1 candidate 2: a counter replaces the
     * 32-bit modulo (SUBCUL 32-iteration division) so every 20 us tick only
     * increments; the flag still asserts exactly every LLC_FAST_TICKS_PER_SLOW
     * ticks with the same phase (first assertion on tick 0). */
    {
        static Uint32 s_slow_flag_counter = LLC_FAST_TICKS_PER_SLOW - 1U;
        if (++s_slow_flag_counter >= LLC_FAST_TICKS_PER_SLOW)
        {
            s_slow_flag_counter = 0U;
            g_5ms_flag = 1U;
        }
    }

    CpuTimer0Regs.TCR.bit.TIF = 1U;
    PieCtrlRegs.PIEACK.all = PIEACK_GROUP1;

#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    /* Whole-ISR budget snapshot: taken at the very end of the ISR body (after
     * the 5 ms flag, TIF clear and PIEACK) so g_fast_isr_cycles_* reflects the
     * complete fast ISR, not just the Stage6 PI hook. Timing value only. */
    if (g_stage6_noenergy_test_enable != 0U)
    {
        t_isr_exit = CpuTimer2Regs.TIM.all;
        g_fast_isr_cycles_last = (Uint32)((Uint32)(t_isr_entry - t_isr_exit) & 0xFFFFFFFFUL);
        if (g_fast_isr_cycles_last > g_fast_isr_cycles_max)
            g_fast_isr_cycles_max = g_fast_isr_cycles_last;
        g_fast_isr_cycles_sum += g_fast_isr_cycles_last;
        g_fast_isr_cycles_count++;
        if (g_fast_isr_cycles_last >= 1200UL)
            g_fast_isr_overrun_count++;
    }
#endif
#if STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD
    /* Whole-ISR budget snapshot (gate K1): taken at the very end of the ISR
     * body so g_real_isr_cycles_* reflects the complete fast ISR. Passive.
     * RECOVERY V1 A/F: per-phase maxima are filled on ticks whose pipeline
     * phase actually executed (g_pipeline_executed_phase set by the control
     * path; 0xFF = no phase this tick, e.g. idle/terminated ticks). */
    {
        Uint32 r_exit = CpuTimer2Regs.TIM.all;
        g_real_isr_cycles_last = (Uint32)((Uint32)(g_real_timer0_last_entry - r_exit) & 0xFFFFFFFFUL);
        if (g_real_isr_cycles_last > g_real_isr_cycles_max)
            g_real_isr_cycles_max = g_real_isr_cycles_last;
        g_real_isr_cycles_count++;
        if (g_real_isr_cycles_last >= 1200UL)
            g_real_isr_overrun_count++;
        if (g_pipeline_executed_phase == PIPELINE_PHASE_COMPUTE)
        {
            if (g_real_isr_cycles_last > g_real_compute_phase_cycles_max)
                g_real_compute_phase_cycles_max = g_real_isr_cycles_last;
        }
        else if (g_pipeline_executed_phase == PIPELINE_PHASE_APPLY)
        {
            if (g_real_isr_cycles_last > g_real_apply_phase_cycles_max)
                g_real_apply_phase_cycles_max = g_real_isr_cycles_last;
        }
    }
#endif
}

void PROT_FastTask(void)
{
    /* Static comparator calibration transition monitor (no PWM release). */
    COMP_StaticCalibrationFastTask();

    /* Calibrated raw-limit checks only; uncalibrated engineering values are
     * guarded in PROT_SlowTask. In the REAL bounded-shot build the raw OVP
     * ceiling is enforced whenever the limited authorization holds (the
     * volts-domain calibration is pending, so the g_vout_volts gate would
     * otherwise skip the check during the formal ramp / 1ms shot).
     * RECOVERY V1: g_vout_volts is never assigned (stays -1.0f), so the
     * original software-float comparison was a fixed cost on every tick;
     * the 16-bit g_board_vout_cal_valid flag is the same "volts domain is
     * valid" signal (no FPU on F28034 -> keeps the 20 us ISR budget). */
#if STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD
    if (g_board_vout_cal_valid != 0U ||
        SHOT_RealSoftStartAuthOk() != 0U ||
        SHOT_RealBoundedPiAuthOk() != 0U)
    {
#else
    if (g_board_vout_cal_valid != 0U)
    {
#endif
        if (g_adc_vout_raw > LLC_OVP_RAW_THRESHOLD)
        {
            PROT_RequestFault(FAULT_VOUT_OVP, 0U);
            return;
        }
#if LLC_UVP_RAW_THRESHOLD != 0xFFFFU
        if (g_adc_vout_raw < LLC_UVP_RAW_THRESHOLD)
        {
            PROT_RequestFault(FAULT_VOUT_UVP, 0U);
            return;
        }
#endif
    }
    if (g_iout_amps >= 0.0f)
    {
        if (g_adc_iout_raw > LLC_OCP_RAW_THRESHOLD)
        {
            PROT_RequestFault(FAULT_IOUT_OCP, 0U);
            return;
        }
    }
}

void PROT_SlowTask(void)
{
    Uint16 cfg_ok;

    /* Capture TZ hardware status for CCS debug */
    g_tz_ost_flag = EPwm1Regs.TZFLG.bit.OST;
    g_tz_int_flag = EPwm1Regs.TZFLG.bit.INT;

    /* Apply CCS comparator/DAC debug variables */
    COMP_ApplyGlobals();

    /* One-shot board loopback diagnostic for COMP1OUT -> GPIO15/TZ1 path */
    if (g_loopback_diag_request != 0U)
    {
        COMP_RunLoopbackDiagnostic();
    }

    /* Stage4C comparator injection test arm/disarm */
    if (g_comp_inject_test_request != 0U)
    {
        COMP_ArmInjectionTest();
    }
    if (g_comp_inject_test_disarm_request != 0U)
    {
        COMP_DisarmInjectionTest();
    }

    /* Static IPRI comparator calibration (PWM stays OFF, OST stays latched). */
    if (g_static_cal_request != 0U)
    {
        g_static_cal_request = 0U;
        COMP_StaticCalibrationArm();
    }
    if (g_static_cal_disarm_request != 0U)
    {
        COMP_StaticCalibrationDisarm();
    }
    COMP_UpdateStatus();

    /* Explicit software force-trip request (Stage 4 test) */
    if (g_force_trip_request != 0U)
    {
        g_force_trip_request = 0U;
        LLC_ProtectionForceTrip(FAULT_FORCE_TRIP);
        return;
    }

    /* Explicit fault reset is only honoured with PWM off and source removed */
    if (g_fault_reset_request != 0U)
    {
        if (LLC_ProtectionResetExplicit() == 0U)
        {
            /* keep request pending; CCS must first clear enable request */
        }
    }

    if (g_system_state == SYS_STATE_FAULT)
    {
        return;
    }

    /* Frozen PWM configuration must never silently change */
    cfg_ok = PWM_ConfigMatchesFrozenBaseline();
    if (cfg_ok == 0U)
    {
        PROT_RequestFault(FAULT_PWM_CONFIG_MISMATCH, 0U);
        return;
    }

    /* ADC stale / overflow check: only when ADC is actually expected to run.
     * Stage 3 uses the 20 us software trigger; Stage 5+ uses ePWM1 SOCA while
     * PWM is enabled. Stage 4 is a pure Trip-zone test and does not require
     * continuous ADC sampling. */
    if (g_no_energy_test_mode == 0U &&
        ((g_bringup_stage == BRINGUP_STAGE_3_ADC_MONITOR) ||
         (g_bringup_stage >= BRINGUP_STAGE_5A_OPEN_LOOP_MANUAL && g_pwm_enabled != 0U)))
    {
        if (g_adc_sample_counter == s_last_adc_counter)
        {
            s_adc_stale_count++;
            if (s_adc_stale_count > 2U)
            {
                PROT_RequestFault(FAULT_ADC_STALE_OVERFLOW, 0U);
                return;
            }
        }
        else
        {
            s_adc_stale_count = 0U;
        }
        s_last_adc_counter = g_adc_sample_counter;
        ADC_CheckOverflow();
    }

    /* Stage-dependent frequency legality (only while PWM is expected to run).
     * CAL_HOLD recharge packets intentionally run the diagnostic 250 kHz /
     * DB110 platform (task-fixed), so they are exempt from the Stage-4
     * 150 kHz requirement. */
    if (g_pwm_enabled != 0U && g_cal_hold_state != CAL_HOLD_PACKET)
    {
    if (g_bringup_stage == BRINGUP_STAGE_1_PWM_FIXED ||
        g_bringup_stage == BRINGUP_STAGE_4_PROTECTION_TEST)
    {
        if (g_switching_frequency_hz != LLC_DEFAULT_FREQUENCY_HZ)
        {
            PROT_RequestFault(FAULT_ILLEGAL_FREQUENCY, 0U);
            return;
        }
    }
    else if (g_bringup_stage == BRINGUP_STAGE_2_PFM_MANUAL ||
             g_bringup_stage == BRINGUP_STAGE_3_ADC_MONITOR)
    {
        if (g_switching_frequency_hz < LLC_STAGE2_MIN_HZ ||
            g_switching_frequency_hz > LLC_STAGE2_MAX_HZ)
        {
            PROT_RequestFault(FAULT_ILLEGAL_FREQUENCY, 0U);
            return;
        }
    }
    else if (g_bringup_stage == BRINGUP_STAGE_5A_OPEN_LOOP_MANUAL ||
             g_bringup_stage == BRINGUP_STAGE_5B_SOFT_START_TEST)
    {
        if (g_switching_frequency_hz < g_open_loop_min_frequency_hz ||
            g_switching_frequency_hz > LLC_HARD_MAX_HZ)
        {
            PROT_RequestFault(FAULT_ILLEGAL_FREQUENCY, 0U);
            return;
        }
    }
    else if (g_bringup_stage >= BRINGUP_STAGE_6_CLOSED_LOOP)
    {
        Uint32 max_h = LLC_HARD_MAX_HZ;
#if STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD
        /* B: REAL bounded-shot build — the frequency ceiling is context
         * dependent. Formal SoftStart (runtime limited auth) may run the
         * board-verified Profile C trajectory up to 250 kHz; the bounded PI
         * window (bounded-PI limited auth) is capped at FIRST_REAL_PI_MAX_HZ
         * (145..170 kHz); every other path keeps the production
         * LLC_HARD_MAX_HZ (150 kHz) ceiling. */
        if (SHOT_RealSoftStartAuthOk() != 0U)
        {
            max_h = LLC_DIAG_MAX_HZ;
        }
        else if (SHOT_RealBoundedPiAuthOk() != 0U)
        {
            max_h = FIRST_REAL_PI_MAX_HZ;
        }
#elif STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
        /* First bounded real PI shot build: the shot envelope is 145..170 kHz
         * and MUST NOT reach 200k/250k. The slow-task frequency gate therefore
         * allows exactly the shot max. Production keeps LLC_HARD_MAX_HZ (150k). */
        max_h = FIRST_REAL_PI_MAX_HZ;
#elif STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
        /* No-energy test build: the real-actuator cadence tests sweep the
         * 120-180 kHz diagnostic envelope. The diagnostic frequency override
         * already lets LLC_SetFrequencyHz reach LLC_DIAG_MAX_HZ, so the slow
         * task frequency gate mirrors that here. Production keeps the formal
         * LLC_HARD_MAX_HZ (150 kHz) ceiling. */
        if (g_diag_frequency_override != 0U) max_h = LLC_DIAG_MAX_HZ;
#endif
        if (g_switching_frequency_hz < g_power_run_min_frequency_hz ||
            g_switching_frequency_hz > max_h)
        {
            PROT_RequestFault(FAULT_ILLEGAL_FREQUENCY, 0U);
            return;
        }
    }

    }

    /* Calibration / control-direction gates. These are REAL-POWER physical
     * gates; the no-energy software simulation bypasses them because it has no
     * real power. That bypass exists ONLY in the no-energy test build. The
     * production build keeps every gate unconditionally (no runtime
     * g_softstart_no_energy protection path). */
#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    if (g_pwm_enabled != 0U && g_softstart_no_energy == 0U)
#else
    if (g_pwm_enabled != 0U)
#endif
    {
    /* C: REAL bounded-shot build — the limited authorization (runtime
     * SoftStart or bounded PI) substitutes for the global calibration and
     * control-direction gates ONLY for the formal SoftStart -> 1ms PI
     * window. IOUT absolute calibration is pending (never faked) and
     * LLC_CONTROL_DIRECTION stays 0 (Stage5A confirmed the direction via
     * LLC_CONTROL_SIGN=-1); fast OCP remains Comparator->TZ1->OST. */
#if STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD
    Uint16 limited_auth = (SHOT_RealSoftStartAuthOk() != 0U ||
                           SHOT_RealBoundedPiAuthOk() != 0U);
#else
    Uint16 limited_auth = 0U;
#endif
    if (g_bringup_stage >= BRINGUP_STAGE_5A_OPEN_LOOP_MANUAL &&
        g_comp_tz_loopback_verified == 0U)
    {
        PROT_RequestFault(FAULT_COMP_TZ_LOOPBACK, 0U);
        return;
    }
    if (g_bringup_stage >= BRINGUP_STAGE_6_CLOSED_LOOP && limited_auth == 0U)
    {
        if (g_vout_volts < 0.0f || g_iout_amps < 0.0f)
        {
            PROT_RequestFault(FAULT_CAL_MISSING, 0U);
            return;
        }
    }
    if (g_bringup_stage >= BRINGUP_STAGE_6_CLOSED_LOOP && limited_auth == 0U)
    {
        if (LLC_CONTROL_DIRECTION == 0)
        {
            PROT_RequestFault(FAULT_CONTROL_DIRECTION, 0U);
            return;
        }
    }
    if (g_bringup_stage == BRINGUP_STAGE_7_POWER_RUN)
    {
        if (LLC_POWER_RUN_ALLOWED == 0)
        {
            PROT_RequestFault(FAULT_STAGE_GATE, 0U);
            return;
        }
    }
    }
}






