/*
 * llc_globals.c
 *
 * Definitions of all non-static volatile global variables.
 */
#include "llc_config.h"
#include "llc_globals.h"
#include "board_calibration.h"

/* Stage / PWM */
volatile Uint16 g_bringup_stage ;
volatile Uint16 g_active_bringup_stage ;
volatile Uint16 g_stage_confirm_request ;
volatile Uint16 g_stage_confirmed_mask = 0x0001U;
volatile Uint32 g_switching_frequency_hz ;
volatile Uint32 g_actual_switching_frequency_hz ;
volatile Uint16 g_pwm_period ;
volatile Uint16 g_pwm_enabled ;
volatile Uint16 g_pwm_enable_request ;
volatile Uint16 g_pwm_enable_result ;
#if !STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD
volatile Uint16 g_diag_frequency_override ;   /* diagnostic freq override: absent from REAL shot binary */
#endif

/* ADC */
volatile Uint16 g_adc_vout_raw ;
volatile Uint16 g_adc_iout_raw ;
volatile Uint16 g_adc_ipri_raw ;
volatile Uint16 g_adc_vout_filtered_raw ;
volatile Uint16 g_adc_iout_filtered_raw ;
volatile Uint16 g_adc_ipri_filtered_raw ;
volatile Uint32 g_adc_vout_filter_acc ;
volatile Uint32 g_adc_iout_filter_acc ;
volatile Uint32 g_adc_ipri_filter_acc ;
volatile float   g_vout_volts = -1.0f;
volatile float   g_iout_amps  = -1.0f;
volatile float   g_ipri_amps  = -1.0f;
volatile Uint32  g_adc_sample_counter ;
volatile Uint32  g_adc_sample_sequence ;
volatile Uint16  g_adc_trigger_mode ;

/* State / protection */
volatile Uint16 g_system_state = SYS_STATE_INIT;
volatile Uint32 g_fault_flags ;
volatile Uint32 g_fault_history ;
volatile Uint16 g_trip_count ;
volatile Uint16 g_fast_fault_count ;
volatile Uint16 g_fault_reset_request ;
volatile Uint16 g_force_trip_request ;
volatile Uint16 g_pwm_fastpath_ready = 0U;   /* closed-loop: skip per-tick PWM topology re-validation */

/* Control */
volatile Uint32 g_softstart_frequency_hz ;
volatile Uint32 g_control_frequency_hz ;
volatile float   g_voltage_reference ;
volatile Uint32 g_open_loop_target_frequency_hz = LLC_DEFAULT_FREQUENCY_HZ;
volatile Uint32 g_open_loop_min_frequency_hz = LLC_OPEN_LOOP_INITIAL_MIN_HZ;
volatile Uint32 g_power_run_min_frequency_hz = LLC_POWER_RUN_INITIAL_MIN_HZ;
volatile Uint16 g_softstart_autoramp_allowed ;
volatile float   g_pi_integral ;
volatile float   g_pi_bias_frequency_hz ;
volatile Uint16 g_control_running ;
/* STAGE6 offline control teaching/offline variables */
volatile Uint32  g_control_shadow_frequency_hz ;
volatile float   g_control_vref_volts ;
volatile float   g_control_vout_volts ;
volatile float   g_control_error_volts ;
volatile float   g_control_p_term_hz ;
volatile float   g_control_i_term_hz ;
volatile float   g_control_frequency_unsat_hz ;
volatile float   g_control_frequency_clamped_hz ;
volatile Uint16  g_control_saturated_high ;
volatile Uint16  g_control_saturated_low ;
volatile Uint16  g_control_integrator_frozen ;
volatile Uint16  g_control_adc_stale_inhibit ;
volatile Uint16  g_control_sample_valid ;
volatile Uint16  g_offline_test_request ;
volatile Uint16  g_offline_test_status ;
volatile Uint16  g_offline_pwm_pre[5] ;
volatile Uint16  g_offline_pwm_post[5] ;
volatile Uint16  g_offline_pwm_isolated ;
/* Stage1 PI firmware profile teaching variables */
volatile Uint32  g_control_pi_profile_id ;
volatile float   g_control_kp_hz_per_v ;
volatile float   g_control_ki_step_hz_per_v_step ;
volatile Uint16  g_control_pi_virtual_only ;
/* Fixed-point Q12 fast-controller runtime state (STAGE6_PI_FIXED_POINT_REALTIME_MIGRATION_V1). */
volatile int32   g_pi_integral_q12      ;
volatile Uint16  g_control_vref_raw     ;
volatile Uint16  g_control_vout_raw     ;
volatile int16   g_control_error_raw    ;
volatile int32   g_control_p_term_q12   ;
volatile int32   g_control_i_term_q12   ;
volatile int32   g_control_unsat_q12    ;
/* STAGE6_CLOSED_LOOP_HANDOFF - handoff state (production, always built). */
volatile Uint32 g_stage6_handoff_count        = 0UL;
volatile Uint16 g_softstart_handoff_result    = 0U;
volatile Uint32 g_stage6_run_entry_count      = 0UL;
volatile Uint16 g_stage6_transfer_request     = 0U;
/* STAGE6_HANDOFF_REFERENCE_ATOMIC_PUBLICATION_CLOSURE_V1 */
volatile Uint16 g_stage6_ref_prime_count      = 0U;
volatile Uint16 g_stage6_ref_prime_raw        = 0U;
volatile Uint16 g_stage6_ref_valid_at_run_entry = 0U;
volatile Uint16 g_stage6_ref_prime_result     = 0U;

/* STAGE6_REALTIME_CONTROL_INPUT_BINDING_CLOSURE_V1 - input-binding runtime state. */
volatile Uint16  g_control_reference_valid          = 0U;
volatile Uint32  g_control_adc_sequence_last        = 0UL;
volatile Uint32  g_control_adc_sequence_consumed    = 0UL;
volatile Uint32  g_control_fresh_sample_count       = 0UL;
volatile Uint32  g_control_duplicate_sample_block_count = 0UL;
volatile Uint32  g_control_stale_tick_count         = 0UL;
volatile Uint32  g_control_pi_update_count          = 0UL;

/* STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST instrumentation (test build only). */
#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
volatile Uint32 g_control_exec_cycles_last  = 0UL;
volatile Uint32 g_control_exec_cycles_max   = 0UL;
volatile Uint32 g_fast_isr_cycles_last      = 0UL;
volatile Uint32 g_fast_isr_cycles_max       = 0UL;
volatile Uint32 g_fast_isr_cycles_sum        = 0UL;
volatile Uint32 g_fast_isr_cycles_count       = 0UL;
volatile Uint32 g_adc_isr_cycles_sum          = 0UL;
volatile Uint32 g_adc_isr_cycles_count        = 0UL;
volatile Uint32 g_fast_isr_overrun_count    = 0UL;
volatile Uint32 g_stage6_noenergy_test_ticks= 0UL;
volatile Uint16 g_stage6_noenergy_test_enable = 0U;
volatile float  g_stage6_synthetic_vout     = 12.0f;
volatile Uint16  g_stage6_synthetic_vout_raw = 1491U;  /* raw mirror (12V); harness writes both */
volatile Uint16  g_stage6_synthetic_sequence   = 0U;    /* synthetic ADC sample-sequence (binding tests) */
volatile Uint16 g_stage6_noenergy_test_mode = 0U;
volatile Uint16 g_stage6_noenergy_step_req  = 0U;
volatile Uint32 g_stage6_noenergy_step_shadow_hz  = 0UL;
volatile float  g_stage6_noenergy_step_integral_hz= 0.0f;
/* STAGE6_CLOSED_LOOP_HANDOFF_NOENERGY_CLOSURE_V1 - handoff + cadence obs. */
volatile Uint16 g_stage6_closeloop_vout_inject= 0U;
volatile Uint32 g_stage6_adc_isr_count        = 0UL;
volatile Uint32 g_adc_isr_cycles_last         = 0UL;
volatile Uint32 g_adc_isr_cycles_max          = 0UL;
volatile Uint16 g_stage6_first_pi_sample_raw  = 0U;
volatile Uint32 g_stage6_first_pi_freq_hz     = 0UL;
volatile Uint16 g_stage6_first_pi_observed    = 0U;
/* STAGE6_ONCHIP_MULTIFRESH_NOENERGY: compact test-only trajectory trace (mode 5). */
volatile Uint16 g_stage6_multifresh_trace_count = 0U;
volatile Uint32 g_stage6_multifresh_trace_freq[13] = {0UL};
volatile Uint32 g_stage6_cadence_test_freq  = 0UL;   /* test time-base config (applied once) */
/* STAGE6_REAL_ACTUATOR_OST_TEST - real PWM actuator write gate (test build). */
volatile Uint16 g_stage6_actuator_test_arm   = 0U;   /* harness arms only after OST=1 + AQCSFRC LOW */
volatile Uint16 g_stage6_actuator_revoked    = 0U;   /* set on trip: actuator write permission lost */
volatile Uint32 g_stage6_actuator_write_count = 0UL;   /* wraps, count of real LLC_SetFrequencyHz calls */
volatile Uint32 g_stage6_actuator_direct_cmd_hz = 0UL; /* test override command (0 = PI shadow) */
volatile Uint32 g_stage6_actuator_cycles_last = 0UL;
volatile Uint32 g_stage6_actuator_cycles_max  = 0UL;
volatile Uint32 g_stage6_actuator_cycles_sum  = 0UL;
volatile Uint32 g_stage6_actuator_cycles_count = 0UL;
#endif

/* STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD - passive whole-ISR / entry-interval
 * observation. Read-only Timer2 cycle counting; does NOT modify ADC, PI input,
 * PWM command, or protection. Present in the final frozen REAL OUT (gate K1). */
#if STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD
volatile Uint32 g_real_isr_cycles_last      = 0UL;
volatile Uint32 g_real_isr_cycles_max       = 0UL;
volatile Uint32 g_real_isr_cycles_sum        = 0UL;
volatile Uint32 g_real_isr_cycles_count      = 0UL;
volatile Uint32 g_real_isr_overrun_count    = 0UL;   /* whole ISR >= 1200 cycles */
volatile Uint32 g_real_timer0_entry_count    = 0UL;
volatile Uint32 g_real_timer0_last_entry     = 0UL;
volatile Uint32 g_real_timer0_entry_interval_min = 0UL;
volatile Uint32 g_real_timer0_entry_interval_max = 0UL;
volatile Uint32 g_real_compute_phase_cycles_max = 0UL;
volatile Uint32 g_real_apply_phase_cycles_max   = 0UL;
volatile Uint32 g_shot_entry_interval_max       = 0UL;   /* shot-local entry max, reset at first apply */
volatile Uint32 g_shot_entry_interval_min       = 0UL;
volatile Uint32 g_shot_entry_over_1230_count    = 0UL;
volatile Uint32 g_shot_entry_over_1500_count    = 0UL;
volatile Uint32 g_shot_entry_over_2400_count    = 0UL;
volatile Uint32 g_shot_entry_adjacent_prev      = 0UL;
volatile Uint32 g_shot_entry_adjacent_max       = 0UL;
volatile Uint32 g_shot_entry_last               = 0UL;   /* last TINT0 entry Timer2 for shot-local delta */
#endif

/* Tutorial SoftStart Engine */
volatile Uint16 g_softstart_state;
volatile Uint32 g_softstart_period_limit;
volatile Uint16 g_softstart_deadtime;
volatile Uint32 g_softstart_step_count;
volatile Uint32 g_softstart_elapsed_ms;
volatile Uint32 g_softstart_period_limit_start;
volatile Uint32 g_softstart_period_limit_final;
volatile Uint32 g_softstart_period_step;
volatile Uint16 g_softstart_deadtime_start;
volatile Uint16 g_softstart_deadtime_final;
volatile Uint16 g_softstart_deadtime_step;
volatile Uint16 g_softstart_wait_5ms_ticks;
volatile Uint16 g_softstart_profile;
volatile Uint32 g_period_request;
volatile Uint32 g_period_limit;
volatile Uint32 g_period_applied;
volatile Uint16 g_burst_enabled;
volatile Uint16 g_burst_active;
volatile Uint16 g_burst_state;
volatile Uint16 g_ost_owner;
volatile Uint32 g_burst_enter_count;
volatile Uint32 g_burst_exit_count;
volatile Uint32 g_burst_restart_attempt_count;
volatile Uint32 g_burst_restart_success_count;
volatile Uint32 g_burst_restart_fail_count;
volatile Uint32 g_burst_stale_restart_count;
volatile Uint16 g_burst_entry_vout_raw;
volatile int16  g_burst_entry_error_raw;
volatile Uint16 g_burst_entry_period;
volatile Uint32 g_burst_entry_frequency_hz;
volatile Uint32 g_burst_entry_adc_sequence;
volatile Uint32 g_burst_entry_timer2;
volatile Uint16 g_burst_exit_vout_raw;
volatile int16  g_burst_exit_error_raw;
volatile Uint16 g_burst_exit_period;
volatile Uint32 g_burst_exit_frequency_hz;
volatile Uint32 g_burst_exit_adc_sequence;
volatile Uint32 g_burst_exit_timer2;
volatile Uint16 g_burst_restart_pre_ost;
volatile Uint16 g_burst_restart_post_ost;
volatile Uint16 g_burst_restart_tbctr;
volatile Uint16 g_burst_restart_tbprd;
volatile Uint32 g_burst_restart_actual_frequency_hz;
volatile Uint32 g_burst_test_fresh_count;
volatile Uint32 g_burst_test_high_count;
volatile Uint32 g_burst_test_low_count;
volatile Uint32 g_burst_shadow_base_frequency_hz;
volatile Uint32 g_burst_off_fresh_compute_count;
volatile Uint32 g_burst_off_apply_count;
volatile Uint32 g_burst_off_first_shadow_hz;
volatile Uint32 g_burst_off_last_shadow_hz;
volatile Uint32 g_burst_off_min_shadow_hz;
volatile Uint16 g_burst_off_first_period;
volatile Uint16 g_burst_off_last_period;
volatile Uint32 g_burst_timeout_shadow_hz;
volatile Uint16 g_burst_timeout_period;
volatile int16  g_burst_timeout_error_raw;
volatile Uint32 g_burst_off_apply_discard_count;
volatile Uint32 g_burst_restart_timer2;
volatile Uint32 g_burst_entry_to_restart_delta;
volatile Uint32 g_burst_entry_hw_trip_count;
volatile Uint32 g_burst_entry_active_trip_count;
volatile Uint16 g_ocp_recovery_mode;   /* 0 = LOCKED, 1 = TUTORIAL_HICCUP */
volatile Uint16 g_softstart_abort_reason;
volatile Uint16 g_softstart_ocp_dac_code;
volatile Uint16 g_pwm_start_prepared;
volatile Uint32 g_enable_rising_count;
volatile Uint32 g_softstart_final_apply_count;
volatile Uint16 g_softstart_final_applied;
volatile Uint16 g_softstart_final_apply_pending;
volatile Uint16 g_no_energy_test_mode;
volatile Uint16 g_first_start_seen;
volatile Uint16 g_first_start_tbprd;
volatile Uint16 g_first_start_cmpa;
volatile Uint16 g_first_start_dbred;
volatile Uint16 g_first_start_dbfed;
volatile Uint16 g_first_start_dacval;
volatile Uint16 g_first_start_ost;
volatile Uint16 g_first_start_pwm;
volatile Uint16 g_pre_stop_tzflg;
volatile Uint16 g_pre_stop_ost;
volatile Uint16 g_pre_stop_gpio15;
volatile Uint16 g_pre_stop_compsts;
volatile Uint16 g_pre_stop_tbctr;
volatile Uint32 g_pre_stop_timer2;
volatile Uint16 g_pre_stop_hardware_trip_seen;

/* Comparator / TZ debug */
volatile Uint16 g_comp_dac_value ;
volatile Uint16 g_comp_polarity ;
volatile Uint16 g_comp_arm ;
volatile Uint16 g_loopback_diag_request ;
volatile Uint16 g_comp_tz_loopback_verified ;
volatile Uint16 g_loopback_diag_result ;
volatile Uint16 g_loopback_read0 ;
volatile Uint16 g_loopback_read1 ;
volatile Uint16 g_loopback_read2 ;
volatile Uint16 g_comp_inject_test_request ;
volatile Uint16 g_comp_inject_test_armed ;
volatile Uint16 g_comp_inject_test_disarm_request ;
volatile Uint16 g_comp1_status ;
volatile Uint16 g_comp1_dac_code ;
volatile Uint16 g_comp_prestart_status ;
volatile Uint16 g_comp_prestart_gpio15 ;
volatile Uint16 g_comp_prestart_tzflg ;
volatile Uint16 g_comp_prestart_reject ;
volatile Uint16 g_static_cal_request;
volatile Uint16 g_static_cal_dac;
volatile Uint16 g_static_cal_armed;
volatile Uint16 g_static_cal_initial_compsts;
volatile Uint16 g_static_cal_initial_gpio15;
volatile Uint16 g_static_cal_transition_detected;
volatile Uint16 g_static_cal_compsts_before;
volatile Uint16 g_static_cal_compsts_after;
volatile Uint16 g_static_cal_gpio15_before;
volatile Uint16 g_static_cal_gpio15_after;
volatile Uint16 g_static_cal_tzflg_after;
volatile Uint16 g_static_cal_disarm_request;
volatile Uint16 g_tz_ost_flag ;
volatile Uint16 g_tz_int_flag ;
volatile Uint16 g_software_ost_in_progress ;
volatile Uint16 g_tz_isr_tbctr ;
volatile Uint32 g_tz_isr_timer2 ;
volatile Uint16 g_tz_isr_software_ost_flag ;
volatile Uint16 g_tz_isr_after_scheduled_ost ;
volatile Uint16 g_tz_isr_gpio15 ;
volatile Uint16 g_tz_isr_compsts ;
volatile Uint16 g_tz_isr_tzflg ;
volatile Uint16 g_tz_event_phase ;
volatile Uint32 g_tz_software_ost_count ;
volatile Uint32 g_tz_hardware_trip_count ;
volatile Uint32 g_tz_noenergy_trip_count ;
volatile Uint32 g_tz_active_window_trip_count ;
volatile Uint32 g_tz_post_ost_trip_count ;
volatile Uint32 g_post_ost_trip_delay_ticks ;
volatile Uint16 g_power_window_state ;
volatile Uint16 g_probe_scheduled_ost_occurred ;

/* Test-run-ID evidence chain */
volatile Uint32 g_test_run_id ;
volatile Uint32 g_test_run_id_at_arm ;
volatile Uint32 g_test_run_id_at_tz_isr ;
volatile Uint32 g_test_run_id_at_stop ;
volatile Uint16 g_test_dac_snapshot ;
volatile Uint16 g_test_tbprd_snapshot ;
volatile Uint16 g_test_cmpa_snapshot ;


/* Stage 4D one-shot power probe */
volatile Uint16 g_power_probe_request ;
volatile Uint16 g_power_probe_result ;
volatile Uint16 g_power_probe_active ;
volatile Uint32 g_power_probe_duration_us;   /* default applied in POWERPROBE_SlowTask */
volatile Uint32 g_power_probe_count ;
volatile Uint16 g_power_probe_adc_vout_before ;
volatile Uint16 g_power_probe_adc_vout_after ;
volatile Uint16 g_power_probe_adc_ipri_before ;
volatile Uint16 g_power_probe_adc_ipri_peak ;
volatile Uint16 g_power_probe_adc_iout_before ;
volatile Uint16 g_power_probe_adc_iout_after ;


/* Stage 4D single-cycle diagnostic power probe */
volatile Uint16 g_single_cycle_probe_request ;
volatile Uint16 g_single_cycle_probe_result ;
volatile Uint16 g_single_cycle_probe_active ;
volatile Uint32 g_single_cycle_probe_frequency_hz ;   /* default set in PROT_Init */
volatile Uint32 g_single_cycle_probe_count ;
volatile Uint16 g_single_cycle_probe_adc_ipri_before ;
volatile Uint16 g_single_cycle_probe_adc_ipri_peak ;
volatile Uint16 g_single_cycle_probe_adc_vout_before ;
volatile Uint16 g_single_cycle_probe_adc_vout_after ;
volatile Uint16 g_single_cycle_probe_stop_tbctr ;
volatile Uint16 g_single_cycle_probe_deadtime;

/* Cold-start single-cycle initial-condition capture */
volatile Uint16 g_coldshot_vout_raw_before ;
volatile Uint16 g_coldshot_ipri_raw_before ;
volatile Uint16 g_coldshot_compsts_before ;
volatile Uint16 g_coldshot_gpio15_before ;
volatile Uint16 g_coldshot_tzflg_before ;
volatile Uint32 g_coldshot_timer2_start ;
volatile Uint16 g_coldshot_vout_baseline_avg ;
volatile Uint16 g_coldshot_vout_baseline_samples ;
volatile Uint16 g_coldshot_vin_actual_x10 ;   /* set by DSS before cold shot */


/* TZ1 input qualification diagnostic */
volatile Uint16 g_tz1_qualification_mode = 2U;    /* 6-sample qualification */
volatile Uint16 g_tz1_qualification_period = 1U;  /* QUALPRD = 1 */
volatile Uint32 g_single_cycle_probe_tick_count ;
volatile Uint32 g_single_cycle_probe_safety_count ;
volatile Uint32 g_single_cycle_probe_start_fast_tick ;

/* Comparator trip entry diagnostics */
volatile Uint16 g_comp_trip_dac_code ;
volatile Uint16 g_comp_trip_tbctr ;
volatile Uint16 g_comp_trip_vout_raw ;
volatile Uint16 g_single_cycle_completed ;
volatile Uint16 g_single_cycle_result ;


/* Stage 4E multi-cycle power probe */
volatile Uint16 g_multi_cycle_probe_request ;
volatile Uint16 g_multi_cycle_probe_result ;
volatile Uint16 g_multi_cycle_probe_active ;
volatile Uint32 g_multi_cycle_probe_cycles;
volatile Uint32 g_multi_cycle_probe_completed_cycles ;
volatile Uint16 g_multi_cycle_probe_adc_vout_before ;
volatile Uint16 g_multi_cycle_probe_adc_vout_after ;
volatile Uint16 g_multi_cycle_probe_adc_ipri_before ;
volatile Uint16 g_multi_cycle_probe_adc_ipri_peak ;
volatile Uint16 g_multi_cycle_probe_stop_tbctr ;
volatile Uint16 g_multi_cycle_probe_stop_reason ;
volatile Uint32 g_completed_cycles_at_trip ;


/* PROFILE_C ACCELERATED BOUNDED SOFTSTART (diagnostic) */
#define ACCEL_LOG_MAX 33
volatile Uint16 g_accel_request;
volatile Uint16 g_accel_active;
volatile Uint16 g_accel_phase;
volatile Uint16 g_accel_stop_reason;
volatile Uint16 g_accel_trip_phase;
volatile Uint16 g_accel_trip_period;
volatile Uint16 g_accel_trip_cmpa;
volatile Uint16 g_accel_trip_db;
volatile Uint32 g_accel_trip_completed_cycles;
volatile Uint16 g_accel_current_db;
volatile Uint16 g_accel_current_period;
volatile Uint16 g_accel_current_cmpa;
volatile Uint16 g_accel_stage_index;
volatile Uint32 g_accel_stage_start_cycle;
volatile Uint16 g_accel_last_tzflg;
volatile Uint16 g_accel_last_vout_raw;
volatile Uint16 g_accel_last_vout_max;
volatile Uint32 g_accel_phase_c_start_cycle;
volatile Uint16 g_accel_phase_c_cycles;
volatile Uint16 g_accel_phase_c_vout_start;
volatile Uint16 g_accel_phase_c_vout_max;
volatile Uint16 g_accel_phase_c_vout_stop;
volatile Uint16 g_accel_vout_target_raw = ACCEL_VOUT_TARGET_1200;   /* first shot: 1200 */
volatile Uint16 g_accel_vout_hard_limit_raw;
volatile Uint16 g_accel_target_rejected;
volatile Uint16 g_accel_stop_target_raw;
volatile Uint16 g_accel_stop_hard_limit_raw;
volatile Uint16 g_accel_stop_raw;
volatile Uint16 g_accel_stop_max_raw;
volatile Uint32 g_accel_stop_completed_cycles;
volatile Uint16 g_accel_stop_phase;
volatile Uint16 g_accel_stop_tbprd;
volatile Uint16 g_accel_stop_cmpa;
volatile Uint16 g_accel_stop_cmpb;
volatile Uint16 g_accel_stop_dbred;
volatile Uint16 g_accel_stop_dbfed;
volatile Uint16 g_accel_stop_dacval;
volatile Uint32 g_accel_stop_run_id_at_arm;
volatile Uint32 g_accel_stop_run_id_at_stop;
volatile Uint32 g_accel_stop_run_id_at_tz_isr;
volatile Uint16 g_accel_stop_tzflg;
volatile Uint32 g_accel_stop_fault_flags;
volatile Uint32 g_accel_stop_soca_count;
volatile Uint32 g_accel_stop_eoc_count;
volatile Uint32 g_accel_stop_miss_count;
volatile Uint16 g_cal_hold_request;
volatile Uint16 g_cal_hold_duration_ms = 100U;   /* first shot: 100ms */
volatile Uint16 g_cal_hold_state = CAL_HOLD_IDLE;
volatile Uint16 g_cal_hold_stop_reason = CAL_HOLD_REASON_NONE;
volatile Uint16 g_cal_hold_charge_stop_raw;
volatile Uint16 g_cal_hold_raw;
volatile Uint16 g_cal_hold_min = 0xFFFFU;
volatile Uint16 g_cal_hold_max;
volatile Uint32 g_cal_hold_sum;
volatile Uint32 g_cal_hold_samples;
volatile Uint16 g_cal_hold_steady_min = 0xFFFFU;
volatile Uint16 g_cal_hold_steady_max;
volatile Uint32 g_cal_hold_steady_sum;
volatile Uint32 g_cal_hold_steady_samples;
volatile Uint32 g_cal_hold_packet_count;
volatile Uint32 g_cal_hold_total_packet_cycles;
volatile Uint16 g_cal_hold_packet_min_cycles = 0xFFFFU;
volatile Uint16 g_cal_hold_packet_max_cycles;
volatile Uint32 g_cal_hold_packet_cycles_sum;
volatile Uint16 g_cal_hold_packet_active;
volatile Uint16 g_cal_hold_packet_cycles;
volatile Uint32 g_cal_hold_off_ticks;
volatile Uint32 g_cal_hold_elapsed_ticks;
volatile Uint32 g_cal_hold_hold_active_ticks;
volatile Uint16 g_cal_hold_hard_limit_events;
volatile Uint32 g_cal_hold_run_id_at_arm;
volatile Uint32 g_cal_hold_run_id_at_stop;
volatile Uint32 g_cal_hold_run_id_at_tz_isr;
volatile Uint16 g_cal_hold_final_pwm;
volatile Uint16 g_cal_hold_final_ost;
volatile Uint16 g_cal_hold_cal_raw_min = 0xFFFFU;
volatile Uint16 g_cal_hold_cal_raw_max;
volatile Uint32 g_cal_hold_cal_raw_sum;
volatile Uint32 g_cal_hold_cal_raw_samples;
volatile Uint16 g_cal_hold_cal_raw_avg;
volatile Uint16 g_cal_hold_zero_request;
volatile Uint16 g_cal_hold_zero_raw_min = 0xFFFFU;
volatile Uint16 g_cal_hold_zero_raw_max;
volatile Uint16 g_cal_hold_zero_raw_avg;
volatile Uint16 g_cal_measure_request;
volatile Uint16 g_cal_measure_done;
volatile Uint16 g_cal_measure_ready;
volatile Uint16 g_cal_measure_active;
volatile Uint16 g_softstart_request = 0U;  /* explicit init (.bss not zeroed by DSS loadProgram) */
volatile Uint16 g_softstart_acceptance_mode;
volatile Uint16 g_softstart_accept_target_raw;
volatile Uint16 g_softstart_hard_ceiling_raw;
volatile Uint16 g_softstart_result;
volatile Uint16 g_softstart_stage;
volatile Uint16 g_softstart_stage_index;
volatile Uint32 g_softstart_cycle_count;
volatile Uint32 g_softstart_stage_cycles;
volatile Uint16 g_softstart_final_cycles;
volatile Uint16 g_softstart_last_vout_raw;
volatile Uint16 g_softstart_last_vout_max;
volatile Uint16 g_softstart_stop_raw;
volatile Uint32 g_softstart_run_id_at_arm;
volatile Uint32 g_softstart_run_id_at_stop;
volatile Uint32 g_softstart_run_id_at_tz_isr;
volatile Uint16 g_softstart_final_pwm;
volatile Uint16 g_softstart_final_ost;
volatile Uint32 g_softstart_soca_count;
volatile Uint32 g_softstart_eoc_count;
volatile Uint32 g_softstart_miss_count;
volatile Uint16 g_softstart_consecutive_miss;
volatile Uint16 g_softstart_stale_abort;
volatile Uint16 g_softstart_no_energy = 0U;
volatile Uint16 g_board_vout_cal_valid = BOARD_VOUT_CAL_VALID;
volatile Uint16 g_softstart_ramp_active = 0U;  /* explicit init */

/* STAGE5A PFM direction test window */
volatile Uint16 g_pfm_direction_test_mode = 0U;  /* 0=OFF; explicit init: DSS loadProgram does not zero .bss */
volatile Uint16 g_pfm_start_raw;
volatile Uint16 g_pfm_end_raw;
volatile Uint16 g_pfm_max_raw;
volatile Uint32 g_pfm_start_timer2;
volatile Uint32 g_pfm_end_timer2;
volatile Uint16 g_pfm_window_cycles;
volatile Uint16 g_pfm_window_total;
volatile Uint16 g_pfm_hard_vout_abort;
volatile Uint32 g_pfm_frequency_hz;
volatile Uint16 g_pfm_tbprd;
volatile Uint16 g_pfm_cmpa;
volatile Uint16 g_pfm_cmpb;
volatile Uint16 g_ipri_raw_before = 0U;   /* STAGE5A_500MA diagnostic */
volatile Uint16 g_ipri_raw_max = 0U;
volatile Uint16 g_ipri_raw_at_stop = 0U;
volatile Uint16 g_comp_arm_dacval = 0U;
volatile Uint16 g_comp_arm_compdacen = 0U;
volatile Uint16 g_comp_arm_tzsel_osht1 = 0U;

/* PWM-sync ADC runtime freshness (Profile C diagnostic) */
volatile Uint16 g_adc_pwm_sync_cmpb;
volatile Uint16 g_adc_pwm_sync_cmpa;
volatile Uint16 g_adc_pwm_sync_edge_distance;
volatile Uint16 g_vout_runtime_before_ost;
volatile Uint16 g_truth_runtime_raw;
volatile Uint16 g_truth_runtime_tbctr;
volatile Uint16 g_truth_runtime_cmpb;
volatile Uint32 g_truth_runtime_eoc_count;
volatile Uint16 g_truth_post_5us;
volatile Uint16 g_truth_post_10us;
volatile Uint16 g_truth_post_20us;
volatile Uint16 g_truth_post_50us;
volatile Uint16 g_truth_post_100us;
volatile Uint32 g_truth_ost_timer2;
volatile Uint32 g_truth_post_timer2_5us;
volatile Uint32 g_truth_post_timer2_10us;
volatile Uint32 g_truth_post_timer2_20us;
volatile Uint32 g_truth_post_timer2_50us;
volatile Uint32 g_truth_post_timer2_100us;
volatile Uint32 g_truth_ost_to_slow_timer2;
volatile Uint32 g_adc_pwm_sync_soca_count;
volatile Uint32 g_adc_pwm_sync_eoc_count;
volatile Uint32 g_adc_pwm_sync_miss_count;
volatile Uint16 g_adc_vout_pwm_sync_raw;
volatile Uint16 g_adc_pwm_sync_valid;
volatile Uint16 g_adc_pwm_sync_consecutive_miss;
volatile Uint16 g_adc_pwm_sync_stale_abort;

/* POST-STOP VOUT truth check (software-trigger ADC, PWM off) */
volatile Uint16 g_poststop_vout_request;
volatile Uint16 g_poststop_vout_done;
volatile Uint16 g_poststop_vout_phase;
volatile Uint16 g_poststop_vout_samples[32];
volatile Uint16 g_poststop_vout_min;
volatile Uint16 g_poststop_vout_max;
volatile Uint16 g_poststop_vout_avg;
volatile Uint16 g_poststop5ms_vout_avg;
volatile Uint16 g_poststop5ms_vout_samples[32];

/* Multi-cycle ISR latency diagnostic */
volatile Uint16 g_probe_isr_entry_tbctr ;
volatile Uint16 g_probe_ost_command_tbctr ;
volatile Uint16 g_probe_ost_after_tbctr ;
volatile Uint32 g_probe_isr_entry_timer2 ;
volatile Uint32 g_probe_ost_command_timer2 ;
volatile Uint32 g_probe_ost_after_timer2 ;
volatile Uint16 g_probe_irq_latency_ticks ;
volatile Uint16 g_probe_irq_to_ost_ticks ;


/* OST lock diagnostic */
volatile Uint16 g_probe_tzflg_immediate ;
volatile Uint16 g_probe_tzflg_read2 ;
volatile Uint16 g_probe_tzflg_read3 ;
volatile Uint16 g_probe_tzflg_after_state_update ;
volatile Uint32 g_probe_tzclr_write_count ;


/* Probe interrupt isolation */
volatile Uint16 g_probe_saved_ier ;
volatile Uint16 g_probe_saved_pieier1 ;
volatile Uint16 g_probe_saved_pieier3 ;
volatile Uint16 g_probe_interrupt_isolation_active ;


/* Stage4 Probe ADC capture */
volatile Uint16 g_probe_vout_samples[LLC_PROBE_VOUT_SAMPLE_MAX];
volatile Uint16 g_probe_vout_min = 0xFFFFU;
volatile Uint16 g_probe_vout_max ;
volatile Uint16 g_probe_vout_first ;
volatile Uint16 g_probe_vout_last ;
volatile Uint16 g_probe_adc_sample_count ;


/* VOUT limited power probe */
volatile Uint16 g_vout_probe_request ;
volatile Uint16 g_vout_probe_active ;
volatile Uint16 g_vout_probe_target_raw = 1200U;
volatile Uint16 g_vout_probe_stop_raw ;
volatile Uint16 g_vout_probe_max_raw ;
volatile Uint32 g_vout_probe_completed_cycles ;
volatile Uint16 g_vout_probe_stop_reason ;
volatile Uint16 g_vout_probe_dac_code = LLC_VOUT_PROBE_DAC_DEFAULT;
volatile Uint32 g_vout_probe_max_cycles ;   /* default applied in VOUTPROBE_SlowTask */
volatile Uint16 g_vout_probe_hard_limit_raw = LLC_VOUT_PROBE_HARD_LIMIT_RAW;


/* VOUT probe post-OST capture */
volatile Uint16 g_vout_probe_pre_stop_max_raw ;
volatile Uint16 g_vout_probe_post_first_raw ;
volatile Uint16 g_vout_probe_post_max_raw ;
volatile Uint16 g_vout_probe_post_last_raw ;
volatile Uint16 g_vout_probe_post_capture_active ;
volatile Uint16 g_vout_probe_post_capture_count ;
volatile Uint32 g_vout_probe_post_tick_count ;
volatile Uint32 g_vout_probe_post_trigger_count ;
volatile Uint32 g_vout_probe_post_start_count ;
volatile Uint16 g_vout_probe_post_seen_active ;


/* Calibration Hold Probe */
volatile Uint16 g_cal_hold_active ;
volatile Uint16 g_cal_hold_charge_done ;
volatile Uint32 g_cal_hold_total_on_cycles ;
volatile Uint16 g_cal_hold_raw_min = 0xFFFFU;
volatile Uint16 g_cal_hold_raw_max ;
volatile Uint16 g_cal_hold_raw_average ;
volatile Uint32 g_cal_hold_raw_sum ;
volatile Uint32 g_cal_hold_raw_samples ;
volatile Uint16 g_cal_hold_fault ;
volatile Uint32 g_cal_hold_start_fast_tick ;
volatile Uint32 g_cal_hold_slow_count ;
volatile Uint16 g_cal_hold_charge_seen ;
volatile Uint16 g_cal_hold_last_vout_stop_reason ;
volatile Uint16 g_cal_hold_last_vout_active ;
volatile Uint16 g_cal_hold_initial_stop_raw ;
volatile Uint16 g_cal_hold_packet_start_raw ;
volatile Uint16 g_cal_hold_packet_stop_raw ;
volatile Uint16 g_cal_hold_packet_post_max_raw ;
volatile Uint16 g_cal_hold_packet_post_last_raw ;
volatile Uint32 g_cal_hold_packet_actual_cycles ;
volatile Uint32 g_cal_hold_max_total_extra_cycles = LLC_CAL_HOLD_MAX_TOTAL_EXTRA_CYCLES;

/* Timing */
volatile Uint32 g_fast_tick ;
volatile Uint32 g_timer0_entry_count           = 0UL;
volatile Uint32 g_timer0_last_entry            = 0UL;
volatile Uint32 g_timer0_entry_interval_min    = 0UL;
volatile Uint32 g_timer0_entry_interval_max    = 0UL;
volatile Uint16 g_5ms_flag ;

/* OVF diagnostics (ISR instrumentation) */
volatile Uint32 g_adc_ovf_count ;
volatile Uint16 g_adc_ovf_first_tbctr ;
volatile Uint16 g_adc_ovf_first_flag_was_set ;
volatile Uint16 g_adc_isr_last_tbctr ;
















