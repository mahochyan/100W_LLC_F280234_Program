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
    g_diag_frequency_override = 0U;
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

void PROT_RequestFault(Uint16 cause, Uint16 countTrip)
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
    /* Consolidated g_comp_trip_* entry snapshot (DIAGNOSTIC-ONLY, no behavior change). */
    g_comp_trip_timer2 = CpuTimer2Regs.TIM.all;
    g_comp_trip_tbctr = EPwm1Regs.TBCTR;
    g_comp_trip_cmpsts = Comp1Regs.COMPSTS.bit.COMPSTS;
    g_comp_trip_gpio15 = GpioDataRegs.GPADAT.bit.GPIO15;
    g_comp_trip_tzflg = EPwm1Regs.TZFLG.all;
    g_comp_trip_dac = Comp1Regs.DACVAL.bit.DACVAL;

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

    /* Single/multi-cycle probe abort hooks */
    SINGLECYCLE_AbortByFault();
    MULTICYCLE_AbortByFault();

    EPwm1Regs.TZCLR.bit.INT = 1U;
    PieCtrlRegs.PIEACK.all = PIEACK_GROUP2;
}

__interrupt void TINT0_ISR(void)
{
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
    SoftStart_ApplyLimits();

    /* 5 ms slow-task tick */
    if ((g_fast_tick % LLC_FAST_TICKS_PER_SLOW) == 0U)
    {
        g_5ms_flag = 1U;
    }

    CpuTimer0Regs.TCR.bit.TIF = 1U;
    PieCtrlRegs.PIEACK.all = PIEACK_GROUP1;
}

void PROT_FastTask(void)
{
    /* Static comparator calibration transition monitor (no PWM release). */
    COMP_StaticCalibrationFastTask();

    /* Calibrated raw-limit checks only; uncalibrated engineering values are
     * guarded in PROT_SlowTask. */
    if (g_vout_volts >= 0.0f)
    {
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
        if (g_switching_frequency_hz < g_power_run_min_frequency_hz ||
            g_switching_frequency_hz > LLC_HARD_MAX_HZ)
        {
            PROT_RequestFault(FAULT_ILLEGAL_FREQUENCY, 0U);
            return;
        }
    }

    }

    /* Calibration / control-direction gates */
    if (g_pwm_enabled != 0U)
    {
    if (g_bringup_stage >= BRINGUP_STAGE_5A_OPEN_LOOP_MANUAL &&
        g_comp_tz_loopback_verified == 0U)
    {
        PROT_RequestFault(FAULT_COMP_TZ_LOOPBACK, 0U);
        return;
    }
    if (g_bringup_stage >= BRINGUP_STAGE_6_CLOSED_LOOP)
    {
        if (g_vout_volts < 0.0f || g_iout_amps < 0.0f)
        {
            PROT_RequestFault(FAULT_CAL_MISSING, 0U);
            return;
        }
    }
    if (g_bringup_stage >= BRINGUP_STAGE_6_CLOSED_LOOP)
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
