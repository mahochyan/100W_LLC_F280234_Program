/*
 * llc_globals.h
 *
 * All non-static volatile debug/control variables for CCS Expressions.
 */
#ifndef APP_LLC_GLOBALS_H
#define APP_LLC_GLOBALS_H

#include "DSP2803x_Device.h"

/* Stage / PWM */
extern volatile Uint16 g_bringup_stage;
extern volatile Uint16 g_active_bringup_stage;
extern volatile Uint16 g_stage_confirm_request;
extern volatile Uint16 g_stage_confirmed_mask;
extern volatile Uint32 g_switching_frequency_hz;
extern volatile Uint32 g_actual_switching_frequency_hz;
extern volatile Uint16 g_pwm_period;
extern volatile Uint16 g_pwm_enabled;
extern volatile Uint16 g_pwm_enable_request;
extern volatile Uint16 g_pwm_enable_result;
extern volatile Uint16 g_diag_frequency_override;   /* 1 = allow up to LLC_DIAG_MAX_HZ */

/* ADC */
extern volatile Uint16 g_adc_vout_raw;
extern volatile Uint16 g_adc_iout_raw;
extern volatile Uint16 g_adc_ipri_raw;
extern volatile Uint16 g_adc_vout_filtered_raw;
extern volatile Uint16 g_adc_iout_filtered_raw;
extern volatile Uint16 g_adc_ipri_filtered_raw;
extern volatile Uint32 g_adc_vout_filter_acc;
extern volatile Uint32 g_adc_iout_filter_acc;
extern volatile Uint32 g_adc_ipri_filter_acc;
extern volatile float   g_vout_volts;
extern volatile float   g_iout_amps;
extern volatile float   g_ipri_amps;
extern volatile Uint32  g_adc_sample_counter;
extern volatile Uint32  g_adc_sample_sequence;
extern volatile Uint16  g_adc_trigger_mode;

/* State / protection */
extern volatile Uint16 g_system_state;
extern volatile Uint32 g_fault_flags;
extern volatile Uint32 g_fault_history;
extern volatile Uint16 g_trip_count;
extern volatile Uint16 g_fast_fault_count;
extern volatile Uint16 g_fault_reset_request;
extern volatile Uint16 g_force_trip_request;
extern volatile Uint16 g_pwm_fastpath_ready;

/* Control */
extern volatile Uint32 g_softstart_frequency_hz;
extern volatile Uint32 g_control_frequency_hz;
extern volatile float   g_voltage_reference;
extern volatile Uint32 g_open_loop_target_frequency_hz;
extern volatile Uint32 g_open_loop_min_frequency_hz;
extern volatile Uint32 g_power_run_min_frequency_hz;
extern volatile Uint16 g_softstart_autoramp_allowed;
extern volatile float   g_pi_integral;
extern volatile float   g_pi_bias_frequency_hz;
extern volatile Uint16 g_control_running;
/* STAGE6 offline control teaching/observation variables */
extern volatile Uint32  g_control_shadow_frequency_hz;
extern volatile float   g_control_vref_volts;
extern volatile float   g_control_vout_volts;
extern volatile float   g_control_error_volts;
extern volatile float   g_control_p_term_hz;
extern volatile float   g_control_i_term_hz;
extern volatile float   g_control_frequency_unsat_hz;
extern volatile float   g_control_frequency_clamped_hz;
extern volatile Uint16  g_control_saturated_high;
extern volatile Uint16  g_control_saturated_low;
extern volatile Uint16  g_control_integrator_frozen;
extern volatile Uint16  g_control_adc_stale_inhibit;
extern volatile Uint16  g_control_sample_valid;
extern volatile Uint16  g_offline_test_request;
extern volatile Uint16  g_offline_test_status;
extern volatile Uint16  g_offline_pwm_pre[5];
extern volatile Uint16  g_offline_pwm_post[5];
extern volatile Uint16  g_offline_pwm_isolated;
/* Stage1 PI firmware profile teaching variables (which profile is loaded) */
extern volatile Uint32  g_control_pi_profile_id;
extern volatile float   g_control_kp_hz_per_v;
extern volatile float   g_control_ki_step_hz_per_v_step;
extern volatile Uint16  g_control_pi_virtual_only;
/* Fixed-point Q12 fast-controller runtime state (STAGE6_PI_FIXED_POINT_REALTIME_MIGRATION_V1). */
extern volatile int32   g_pi_integral_q12;
extern volatile Uint16  g_control_vref_raw;
extern volatile Uint16  g_control_vout_raw;
extern volatile int16   g_control_error_raw;
extern volatile int32   g_control_p_term_q12;
extern volatile int32   g_control_i_term_q12;
extern volatile int32   g_control_unsat_q12;
/* STAGE6_REALTIME_CONTROL_INPUT_BINDING_CLOSURE_V1 - input-binding runtime state. */
extern volatile Uint16  g_control_reference_valid;
extern volatile Uint32  g_control_adc_sequence_last;
extern volatile Uint32  g_control_adc_sequence_consumed;
extern volatile Uint32  g_control_fresh_sample_count;
extern volatile Uint32  g_control_duplicate_sample_block_count;
extern volatile Uint32  g_control_stale_tick_count;
extern volatile Uint32  g_control_pi_update_count;

/* STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST instrumentation. Macro is set ONLY in
 * the Stage6_FLASH_NOENERGY test build; production Stage6_FLASH keeps it 0. */
#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
extern volatile Uint32 g_control_exec_cycles_last;   /* region B: one PI step */
extern volatile Uint32 g_control_exec_cycles_max;
extern volatile Uint32 g_fast_isr_cycles_last;       /* whole TINT0_ISR */
extern volatile Uint32 g_fast_isr_cycles_max;
extern volatile Uint32 g_fast_isr_cycles_sum;
extern volatile Uint32 g_fast_isr_cycles_count;
extern volatile Uint32 g_adc_isr_cycles_sum;
extern volatile Uint32 g_adc_isr_cycles_count;
extern volatile Uint32 g_fast_isr_overrun_count;     /* ISR >= 1200 cycles */
extern volatile Uint32 g_stage6_noenergy_test_ticks;
extern volatile Uint16 g_stage6_noenergy_test_enable;
extern volatile float  g_stage6_synthetic_vout;
extern volatile Uint16  g_stage6_synthetic_vout_raw;
extern volatile Uint16  g_stage6_synthetic_sequence;
extern volatile Uint16 g_stage6_noenergy_test_mode;  /* 0 idle,1 first-step(11V),2 first-step(13V),3 stale-run */
extern volatile Uint16 g_stage6_noenergy_step_req;   /* one-shot: run exactly one PI step */
extern volatile Uint32 g_stage6_noenergy_step_shadow_hz;
extern volatile float  g_stage6_noenergy_step_integral_hz;
extern volatile Uint16 g_stage6_closeloop_vout_inject;
extern volatile Uint32 g_stage6_adc_isr_count;
extern volatile Uint32 g_adc_isr_cycles_last;
extern volatile Uint32 g_adc_isr_cycles_max;
extern volatile Uint16 g_stage6_first_pi_sample_raw;
extern volatile Uint32 g_stage6_first_pi_freq_hz;
extern volatile Uint16 g_stage6_first_pi_observed;
/* STAGE6_ONCHIP_MULTIFRESH_NOENERGY: compact test-only trajectory trace (mode 5).
 * Only frequency is recorded in-ISR; error/sequence/period/actual are proven by
 * fixed test inputs and offline integer equivalence. */
extern volatile Uint16 g_stage6_multifresh_trace_count;
extern volatile Uint32 g_stage6_multifresh_trace_freq[13];
/* STAGE6_ONCHIP_MULTIFRESH_NOENERGY: compact test-only trajectory trace (mode 5).
 * Only frequency is recorded in-ISR; error/sequence/period/actual are proven by
 * fixed test inputs and offline integer equivalence. */
extern volatile Uint16 g_stage6_multifresh_trace_count;
extern volatile Uint32 g_stage6_multifresh_trace_freq[13];
extern volatile Uint32 g_stage6_cadence_test_freq;
extern volatile Uint16 g_stage6_actuator_test_arm;
extern volatile Uint16 g_stage6_actuator_revoked;
extern volatile Uint32 g_stage6_actuator_write_count;
extern volatile Uint32 g_stage6_actuator_direct_cmd_hz;
extern volatile Uint32 g_stage6_actuator_cycles_last;
extern volatile Uint32 g_stage6_actuator_cycles_max;
extern volatile Uint32 g_stage6_actuator_cycles_sum;
extern volatile Uint32 g_stage6_actuator_cycles_count;
#endif

/* STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD - passive whole-ISR / entry-interval observation. */
#if STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD
extern volatile Uint32 g_real_isr_cycles_last;
extern volatile Uint32 g_real_isr_cycles_max;
extern volatile Uint32 g_real_isr_cycles_sum;
extern volatile Uint32 g_real_isr_cycles_count;
extern volatile Uint32 g_real_isr_overrun_count;
extern volatile Uint32 g_real_timer0_entry_count;
extern volatile Uint32 g_real_timer0_last_entry;
extern volatile Uint32 g_real_timer0_entry_interval_min;
extern volatile Uint32 g_real_timer0_entry_interval_max;
/* 40 us split pipeline (RECOVERY V1 A/F): per-phase whole-ISR maxima, filled
 * only on ticks whose pipeline phase actually executed. */
extern volatile Uint32 g_real_compute_phase_cycles_max;
extern volatile Uint32 g_real_apply_phase_cycles_max;
extern volatile Uint32 g_shot_entry_interval_max;   /* shot-local entry max */
extern volatile Uint32 g_shot_entry_interval_min;   /* shot-local entry min */
extern volatile Uint32 g_shot_entry_over_1230_count;
extern volatile Uint32 g_shot_entry_over_1500_count;
extern volatile Uint32 g_shot_entry_over_2400_count;
extern volatile Uint32 g_shot_entry_adjacent_prev;
extern volatile Uint32 g_shot_entry_adjacent_max;
extern volatile Uint32 g_shot_entry_last;           /* shot-local last entry */
#endif
/* STAGE6_CLOSED_LOOP_HANDOFF - production handoff state (always built). */
extern volatile Uint32 g_stage6_handoff_count;
extern volatile Uint16 g_softstart_handoff_result;
extern volatile Uint32 g_stage6_run_entry_count;
extern volatile Uint16 g_stage6_transfer_request;
/* STAGE6_HANDOFF_REFERENCE_ATOMIC_PUBLICATION_CLOSURE_V1 */
extern volatile Uint16 g_stage6_ref_prime_count;
extern volatile Uint16 g_stage6_ref_prime_raw;
extern volatile Uint16 g_stage6_ref_valid_at_run_entry;
extern volatile Uint16 g_stage6_ref_prime_result;

/* Tutorial SoftStart Engine */
extern volatile Uint16 g_softstart_state;
extern volatile Uint32 g_softstart_period_limit;
extern volatile Uint16 g_softstart_deadtime;
extern volatile Uint32 g_softstart_step_count;
extern volatile Uint32 g_softstart_elapsed_ms;
extern volatile Uint32 g_softstart_period_limit_start;
extern volatile Uint32 g_softstart_period_limit_final;
extern volatile Uint32 g_softstart_period_step;
extern volatile Uint16 g_softstart_deadtime_start;
extern volatile Uint16 g_softstart_deadtime_final;
extern volatile Uint16 g_softstart_deadtime_step;
extern volatile Uint16 g_softstart_wait_5ms_ticks;
extern volatile Uint16 g_softstart_profile;
extern volatile Uint32 g_period_request;
extern volatile Uint32 g_period_limit;
extern volatile Uint32 g_period_applied;
extern volatile Uint16 g_burst_enabled;
extern volatile Uint16 g_burst_active;
extern volatile Uint16 g_burst_state;
extern volatile Uint16 g_ost_owner;
extern volatile Uint32 g_burst_enter_count;
extern volatile Uint32 g_burst_exit_count;
extern volatile Uint32 g_burst_restart_attempt_count;
extern volatile Uint32 g_burst_restart_success_count;
extern volatile Uint32 g_burst_restart_fail_count;
extern volatile Uint32 g_burst_stale_restart_count;
extern volatile Uint16 g_burst_entry_vout_raw;
extern volatile int16  g_burst_entry_error_raw;
extern volatile Uint16 g_burst_entry_period;
extern volatile Uint32 g_burst_entry_frequency_hz;
extern volatile Uint32 g_burst_entry_adc_sequence;
extern volatile Uint32 g_burst_entry_timer2;
extern volatile Uint16 g_burst_exit_vout_raw;
extern volatile int16  g_burst_exit_error_raw;
extern volatile Uint16 g_burst_exit_period;
extern volatile Uint32 g_burst_exit_frequency_hz;
extern volatile Uint32 g_burst_exit_adc_sequence;
extern volatile Uint32 g_burst_exit_timer2;
extern volatile Uint16 g_burst_restart_pre_ost;
extern volatile Uint16 g_burst_restart_post_ost;
extern volatile Uint16 g_burst_restart_tbctr;
extern volatile Uint16 g_burst_restart_tbprd;
extern volatile Uint32 g_burst_restart_actual_frequency_hz;
extern volatile Uint16 g_ocp_recovery_mode;
extern volatile Uint16 g_softstart_abort_reason;
extern volatile Uint16 g_softstart_ocp_dac_code;
extern volatile Uint16 g_pwm_start_prepared;
extern volatile Uint32 g_enable_rising_count;
extern volatile Uint32 g_softstart_final_apply_count;
extern volatile Uint16 g_softstart_final_applied;
extern volatile Uint16 g_softstart_final_apply_pending;
extern volatile Uint16 g_no_energy_test_mode;
extern volatile Uint16 g_first_start_seen;
extern volatile Uint16 g_first_start_tbprd;
extern volatile Uint16 g_first_start_cmpa;
extern volatile Uint16 g_first_start_dbred;
extern volatile Uint16 g_first_start_dbfed;
extern volatile Uint16 g_first_start_dacval;
extern volatile Uint16 g_first_start_ost;
extern volatile Uint16 g_first_start_pwm;
extern volatile Uint16 g_pre_stop_tzflg;
extern volatile Uint16 g_pre_stop_ost;
extern volatile Uint16 g_pre_stop_gpio15;
extern volatile Uint16 g_pre_stop_compsts;
extern volatile Uint16 g_pre_stop_tbctr;
extern volatile Uint32 g_pre_stop_timer2;
extern volatile Uint16 g_pre_stop_hardware_trip_seen;

/* Comparator / TZ debug */
extern volatile Uint16 g_comp_dac_value;
extern volatile Uint16 g_comp_polarity;
extern volatile Uint16 g_comp_arm;
extern volatile Uint16 g_loopback_diag_request;
extern volatile Uint16 g_comp_tz_loopback_verified;
extern volatile Uint16 g_loopback_diag_result;
extern volatile Uint16 g_loopback_read0;
extern volatile Uint16 g_loopback_read1;
extern volatile Uint16 g_loopback_read2;
extern volatile Uint16 g_comp_inject_test_request;
extern volatile Uint16 g_comp_inject_test_armed;
extern volatile Uint16 g_comp_inject_test_disarm_request;
extern volatile Uint16 g_comp1_status;
extern volatile Uint16 g_comp1_dac_code;
extern volatile Uint16 g_comp_prestart_status;
extern volatile Uint16 g_comp_prestart_gpio15;
extern volatile Uint16 g_comp_prestart_tzflg;
extern volatile Uint16 g_comp_prestart_reject;
extern volatile Uint16 g_static_cal_request;
extern volatile Uint16 g_static_cal_dac;
extern volatile Uint16 g_static_cal_armed;
extern volatile Uint16 g_static_cal_initial_compsts;
extern volatile Uint16 g_static_cal_initial_gpio15;
extern volatile Uint16 g_static_cal_transition_detected;
extern volatile Uint16 g_static_cal_compsts_before;
extern volatile Uint16 g_static_cal_compsts_after;
extern volatile Uint16 g_static_cal_gpio15_before;
extern volatile Uint16 g_static_cal_gpio15_after;
extern volatile Uint16 g_static_cal_tzflg_after;
extern volatile Uint16 g_static_cal_disarm_request;
extern volatile Uint16 g_tz_ost_flag;
extern volatile Uint16 g_tz_int_flag;
extern volatile Uint16 g_software_ost_in_progress;
extern volatile Uint16 g_tz_isr_tbctr;
extern volatile Uint32 g_tz_isr_timer2;
extern volatile Uint16 g_tz_isr_software_ost_flag;
extern volatile Uint16 g_tz_isr_after_scheduled_ost;
extern volatile Uint16 g_tz_isr_gpio15;
extern volatile Uint16 g_tz_isr_compsts;
extern volatile Uint16 g_tz_isr_tzflg;
extern volatile Uint16 g_tz_event_phase;
extern volatile Uint32 g_tz_software_ost_count;
extern volatile Uint32 g_tz_hardware_trip_count;
extern volatile Uint32 g_tz_noenergy_trip_count;
extern volatile Uint32 g_tz_active_window_trip_count;
extern volatile Uint32 g_tz_post_ost_trip_count;
extern volatile Uint32 g_post_ost_trip_delay_ticks;
extern volatile Uint16 g_power_window_state;
extern volatile Uint16 g_probe_scheduled_ost_occurred;

/* Test-run-ID evidence chain */
extern volatile Uint32 g_test_run_id;
extern volatile Uint32 g_test_run_id_at_arm;
extern volatile Uint32 g_test_run_id_at_tz_isr;
extern volatile Uint32 g_test_run_id_at_stop;
extern volatile Uint16 g_test_dac_snapshot;
extern volatile Uint16 g_test_tbprd_snapshot;
extern volatile Uint16 g_test_cmpa_snapshot;


/* Stage 4D one-shot power probe */
extern volatile Uint16 g_power_probe_request;
extern volatile Uint16 g_power_probe_result;
extern volatile Uint16 g_power_probe_active;
extern volatile Uint32 g_power_probe_duration_us;
extern volatile Uint32 g_power_probe_count;
extern volatile Uint16 g_power_probe_adc_vout_before;
extern volatile Uint16 g_power_probe_adc_vout_after;
extern volatile Uint16 g_power_probe_adc_ipri_before;
extern volatile Uint16 g_power_probe_adc_ipri_peak;
extern volatile Uint16 g_power_probe_adc_iout_before;
extern volatile Uint16 g_power_probe_adc_iout_after;


/* Stage 4D single-cycle diagnostic power probe */
extern volatile Uint16 g_single_cycle_probe_request;
extern volatile Uint16 g_single_cycle_probe_result;
extern volatile Uint16 g_single_cycle_probe_active;
extern volatile Uint32 g_single_cycle_probe_frequency_hz;   /* diagnostic frequency for next shot */
extern volatile Uint32 g_single_cycle_probe_count;
extern volatile Uint16 g_single_cycle_probe_adc_ipri_before;
extern volatile Uint16 g_single_cycle_probe_adc_ipri_peak;
extern volatile Uint16 g_single_cycle_probe_adc_vout_before;
extern volatile Uint16 g_single_cycle_probe_adc_vout_after;
extern volatile Uint16 g_single_cycle_probe_stop_tbctr;
extern volatile Uint16 g_single_cycle_probe_deadtime;

/* Cold-start single-cycle initial-condition capture */
extern volatile Uint16 g_coldshot_vout_raw_before;
extern volatile Uint16 g_coldshot_ipri_raw_before;
extern volatile Uint16 g_coldshot_compsts_before;
extern volatile Uint16 g_coldshot_gpio15_before;
extern volatile Uint16 g_coldshot_tzflg_before;
extern volatile Uint32 g_coldshot_timer2_start;
extern volatile Uint16 g_coldshot_vout_baseline_avg;
extern volatile Uint16 g_coldshot_vout_baseline_samples;
extern volatile Uint16 g_coldshot_vin_actual_x10;   /* e.g. 240 = 24.0 V */


/* TZ1 input qualification diagnostic */
extern volatile Uint16 g_tz1_qualification_mode;
extern volatile Uint16 g_tz1_qualification_period;
extern volatile Uint32 g_single_cycle_probe_tick_count;
extern volatile Uint32 g_single_cycle_probe_safety_count;
extern volatile Uint32 g_single_cycle_probe_start_fast_tick;

/* Comparator trip entry diagnostics */
extern volatile Uint16 g_comp_trip_dac_code;
extern volatile Uint16 g_comp_trip_tbctr;
extern volatile Uint16 g_comp_trip_vout_raw;
extern volatile Uint16 g_single_cycle_completed;
extern volatile Uint16 g_single_cycle_result;


/* Stage 4E multi-cycle power probe */
extern volatile Uint16 g_multi_cycle_probe_request;
extern volatile Uint16 g_multi_cycle_probe_result;
extern volatile Uint16 g_multi_cycle_probe_active;
extern volatile Uint32 g_multi_cycle_probe_cycles;
extern volatile Uint32 g_multi_cycle_probe_completed_cycles;
extern volatile Uint16 g_multi_cycle_probe_adc_vout_before;
extern volatile Uint16 g_multi_cycle_probe_adc_vout_after;
extern volatile Uint16 g_multi_cycle_probe_adc_ipri_before;
extern volatile Uint16 g_multi_cycle_probe_adc_ipri_peak;
extern volatile Uint16 g_multi_cycle_probe_stop_tbctr;
extern volatile Uint16 g_multi_cycle_probe_stop_reason;
extern volatile Uint32 g_completed_cycles_at_trip;


/* PROFILE_C ACCELERATED BOUNDED SOFTSTART (diagnostic) */
#define ACCEL_LOG_MAX 33
extern volatile Uint16 g_accel_request;
extern volatile Uint16 g_accel_active;
extern volatile Uint16 g_accel_phase;
extern volatile Uint16 g_accel_stop_reason;
extern volatile Uint16 g_accel_trip_phase;
extern volatile Uint16 g_accel_trip_period;
extern volatile Uint16 g_accel_trip_cmpa;
extern volatile Uint16 g_accel_trip_db;
extern volatile Uint32 g_accel_trip_completed_cycles;
extern volatile Uint16 g_accel_current_db;
extern volatile Uint16 g_accel_current_period;
extern volatile Uint16 g_accel_current_cmpa;
extern volatile Uint16 g_accel_stage_index;
extern volatile Uint32 g_accel_stage_start_cycle;
extern volatile Uint16 g_accel_last_tzflg;
extern volatile Uint16 g_accel_last_vout_raw;
extern volatile Uint16 g_accel_last_vout_max;
extern volatile Uint32 g_accel_phase_c_start_cycle;
extern volatile Uint16 g_accel_phase_c_cycles;
extern volatile Uint16 g_accel_phase_c_vout_start;
extern volatile Uint16 g_accel_phase_c_vout_max;
extern volatile Uint16 g_accel_phase_c_vout_stop;

/* PROFILE_C_VOUT_TARGET_LADDER_V1 (2026-08-17)
 * VOUT target ladder: g_accel_vout_target_raw is restricted to 1200 or 1400;
 * the hard limit is DERIVED inside the firmware (1200->1300, 1400->1450) and
 * cannot be enlarged from CCS. Snapshot fields are frozen at the stop moment. */
#define ACCEL_VOUT_TARGET_1200       1200U
#define ACCEL_VOUT_TARGET_1400       1400U
#define ACCEL_VOUT_HARD_LIMIT_1200   1300U
#define ACCEL_VOUT_HARD_LIMIT_1400   1450U

/* g_accel_stop_reason values */
#define ACCEL_STOP_NONE              0U   /* no stop reason set yet */
#define ACCEL_STOP_MAX_CYCLES        1U   /* MAX_CYCLES_REACHED (485 or Phase C 150) */
#define ACCEL_STOP_VOUT_TARGET       2U   /* VOUT_TARGET_REACHED */
#define ACCEL_STOP_HARD_LIMIT        3U   /* HARD_VOUT_LIMIT */
#define ACCEL_STOP_TZ_TRIP           4U   /* ACTIVE TZ trip */
#define ACCEL_STOP_STALE_ADC         5U   /* consecutive SOCA/EOC miss >= 3 */

extern volatile Uint16 g_accel_vout_target_raw;
extern volatile Uint16 g_accel_vout_hard_limit_raw;
extern volatile Uint16 g_accel_target_rejected;

/* Frozen at the stop instant (scheduled OST / abort) */
extern volatile Uint16 g_accel_stop_target_raw;
extern volatile Uint16 g_accel_stop_hard_limit_raw;
extern volatile Uint16 g_accel_stop_raw;
extern volatile Uint16 g_accel_stop_max_raw;
extern volatile Uint32 g_accel_stop_completed_cycles;
extern volatile Uint16 g_accel_stop_phase;
extern volatile Uint16 g_accel_stop_tbprd;
extern volatile Uint16 g_accel_stop_cmpa;
extern volatile Uint16 g_accel_stop_cmpb;
extern volatile Uint16 g_accel_stop_dbred;
extern volatile Uint16 g_accel_stop_dbfed;
extern volatile Uint16 g_accel_stop_dacval;
extern volatile Uint32 g_accel_stop_run_id_at_arm;
extern volatile Uint32 g_accel_stop_run_id_at_stop;
extern volatile Uint32 g_accel_stop_run_id_at_tz_isr;
extern volatile Uint16 g_accel_stop_tzflg;
extern volatile Uint32 g_accel_stop_fault_flags;
extern volatile Uint32 g_accel_stop_soca_count;
extern volatile Uint32 g_accel_stop_eoc_count;
extern volatile Uint32 g_accel_stop_miss_count;

/* PROFILE_C_CAL_HOLD_BURST_V1 (2026-08-17)
 * Low-energy hold platform near 1400 raw for ADC<->DMM calibration.
 * New controller ??the legacy CALHOLD_SlowTask / VOUTPROBE packet logic is
 * NOT reused (5ms granularity is too coarse for the output decay).
 * Hard limits are compile-time macros; no CCS-writable variable can enlarge
 * them. */
typedef enum
{
    CAL_HOLD_IDLE = 0,
    CAL_HOLD_CHARGE,
    CAL_HOLD_OFF,
    CAL_HOLD_PACKET,
    CAL_HOLD_COMPLETE,
    CAL_HOLD_ABORT
} cal_hold_state_t;

/* g_cal_hold_stop_reason */
#define CAL_HOLD_REASON_NONE            0U
#define CAL_HOLD_REASON_COMPLETE        1U   /* duration reached, clean end */
#define CAL_HOLD_REASON_HARD_LIMIT      2U   /* VOUT >= 1450 */
#define CAL_HOLD_REASON_ACTIVE_TZ       3U
#define CAL_HOLD_REASON_UNDERSUPPLIED   4U   /* hold > 2ms && VOUT < 1300 */
#define CAL_HOLD_REASON_CHARGE_NOT_REACHED 5U
#define CAL_HOLD_REASON_MAX_TOTAL_CYCLES 6U  /* 6000-cycle energy cap */
#define CAL_HOLD_REASON_REJECTED        7U   /* bad duration or entry state */

extern volatile Uint16 g_cal_hold_request;
extern volatile Uint16 g_cal_hold_duration_ms;   /* 100 or 1000 only */
extern volatile Uint16 g_cal_hold_state;
extern volatile Uint16 g_cal_hold_stop_reason;

extern volatile Uint16 g_cal_hold_charge_stop_raw;
extern volatile Uint16 g_cal_hold_raw;           /* latest software ADC VOUT */
extern volatile Uint16 g_cal_hold_min;
extern volatile Uint16 g_cal_hold_max;
extern volatile Uint32 g_cal_hold_sum;
extern volatile Uint32 g_cal_hold_samples;
extern volatile Uint16 g_cal_hold_steady_min;
extern volatile Uint16 g_cal_hold_steady_max;
extern volatile Uint32 g_cal_hold_steady_sum;
extern volatile Uint32 g_cal_hold_steady_samples;

extern volatile Uint32 g_cal_hold_packet_count;
extern volatile Uint32 g_cal_hold_total_packet_cycles;
extern volatile Uint16 g_cal_hold_packet_min_cycles;
extern volatile Uint16 g_cal_hold_packet_max_cycles;
extern volatile Uint32 g_cal_hold_packet_cycles_sum;

extern volatile Uint16 g_cal_hold_packet_active;
extern volatile Uint16 g_cal_hold_packet_cycles;    /* current packet cycles */
extern volatile Uint32 g_cal_hold_off_ticks;        /* PWM-off gap (20us ticks) */
extern volatile Uint32 g_cal_hold_elapsed_ticks;    /* 20us ticks since CHARGE end */
extern volatile Uint32 g_cal_hold_hold_active_ticks;
extern volatile Uint16 g_cal_hold_hard_limit_events;

extern volatile Uint32 g_cal_hold_run_id_at_arm;
extern volatile Uint32 g_cal_hold_run_id_at_stop;
extern volatile Uint32 g_cal_hold_run_id_at_tz_isr;
extern volatile Uint16 g_cal_hold_final_pwm;
extern volatile Uint16 g_cal_hold_final_ost;
/* PROFILE_C_CAL_HOLD_1S_DMM_V1 calibration-window and zero-capture fields */
extern volatile Uint16 g_cal_hold_cal_raw_min;
extern volatile Uint16 g_cal_hold_cal_raw_max;
extern volatile Uint32 g_cal_hold_cal_raw_sum;
extern volatile Uint32 g_cal_hold_cal_raw_samples;
extern volatile Uint16 g_cal_hold_cal_raw_avg;
extern volatile Uint16 g_cal_hold_zero_request;
extern volatile Uint16 g_cal_hold_zero_raw_min;
extern volatile Uint16 g_cal_hold_zero_raw_max;
extern volatile Uint16 g_cal_hold_zero_raw_avg;
/* CALIBRATION_MEASURE_HOLD interactive-DMM fields */
extern volatile Uint16 g_cal_measure_request;
extern volatile Uint16 g_cal_measure_done;    /* operator: measurement complete */
extern volatile Uint16 g_cal_measure_ready;   /* stable -> DMM_MEASUREMENT_READY */
extern volatile Uint16 g_cal_measure_active;

/* FORMAL SoftStart (Stage5 acceptance) fields */
extern volatile Uint16 g_softstart_request;
extern volatile Uint16 g_softstart_acceptance_mode;   /* 0=production, 1=acceptance */
extern volatile Uint16 g_softstart_accept_target_raw;
extern volatile Uint16 g_softstart_hard_ceiling_raw;
extern volatile Uint16 g_softstart_result;
extern volatile Uint16 g_softstart_stage;
extern volatile Uint16 g_softstart_stage_index;
extern volatile Uint32 g_softstart_cycle_count;
extern volatile Uint32 g_softstart_stage_cycles;
extern volatile Uint16 g_softstart_final_cycles;
extern volatile Uint16 g_softstart_last_vout_raw;
extern volatile Uint16 g_softstart_last_vout_max;
extern volatile Uint16 g_softstart_stop_raw;
extern volatile Uint32 g_softstart_run_id_at_arm;
extern volatile Uint32 g_softstart_run_id_at_stop;
extern volatile Uint32 g_softstart_run_id_at_tz_isr;
extern volatile Uint16 g_softstart_final_pwm;
extern volatile Uint16 g_softstart_final_ost;
extern volatile Uint32 g_softstart_soca_count;
extern volatile Uint32 g_softstart_eoc_count;
extern volatile Uint32 g_softstart_miss_count;
extern volatile Uint16 g_softstart_consecutive_miss;
extern volatile Uint16 g_softstart_stale_abort;
extern volatile Uint16 g_softstart_no_energy;
extern volatile Uint16 g_board_vout_cal_valid;   /* 1 = software VOUT simulation */
extern volatile Uint16 g_softstart_ramp_active; /* 1 = formal ramp window (ISR OVF guard) */

/* STAGE5A PFM direction test window (see soft_start.h) */
extern volatile Uint16 g_pfm_direction_test_mode;  /* 0=OFF 1=150K 2=170K; >2 rejects start */
extern volatile Uint16 g_pfm_start_raw;
extern volatile Uint16 g_pfm_end_raw;
extern volatile Uint16 g_pfm_max_raw;
extern volatile Uint32 g_pfm_start_timer2;         /* CpuTimer2 free-run ticks @60MHz */
extern volatile Uint32 g_pfm_end_timer2;
extern volatile Uint16 g_pfm_window_cycles;        /* actual completed window cycles */
extern volatile Uint16 g_pfm_window_total;         /* 45 (150k) / 51 (170k) */
extern volatile Uint16 g_pfm_hard_vout_abort;      /* 1 = ceiling hit inside window */
extern volatile Uint32 g_pfm_frequency_hz;         /* actual window frequency */
extern volatile Uint16 g_pfm_tbprd;                /* window PWM configuration */
extern volatile Uint16 g_pfm_cmpa;
extern volatile Uint16 g_pfm_cmpb;
/* STAGE5A_500MA: IPRI ADC diagnostic only (NOT a protection path; fast OCP
 * stays on COMP1->TZ1->OST). */
extern volatile Uint16 g_ipri_raw_before;
extern volatile Uint16 g_ipri_raw_max;
extern volatile Uint16 g_ipri_raw_at_stop;
/* COMP ??????RAM ?????DSS ???? EALLOW ???????????????????RAM ??????? */
extern volatile Uint16 g_comp_arm_dacval;
extern volatile Uint16 g_comp_arm_compdacen;
extern volatile Uint16 g_comp_arm_tzsel_osht1;


/* PWM-sync ADC runtime freshness (Profile C diagnostic) */
extern volatile Uint16 g_adc_pwm_sync_cmpb;
extern volatile Uint16 g_adc_pwm_sync_cmpa;
extern volatile Uint16 g_adc_pwm_sync_edge_distance;
extern volatile Uint16 g_vout_runtime_before_ost;
extern volatile Uint16 g_truth_runtime_raw;
extern volatile Uint16 g_truth_runtime_tbctr;
extern volatile Uint16 g_truth_runtime_cmpb;
extern volatile Uint32 g_truth_runtime_eoc_count;
extern volatile Uint16 g_truth_post_5us;
extern volatile Uint16 g_truth_post_10us;
extern volatile Uint16 g_truth_post_20us;
extern volatile Uint16 g_truth_post_50us;
extern volatile Uint16 g_truth_post_100us;
extern volatile Uint32 g_truth_ost_timer2;
extern volatile Uint32 g_truth_post_timer2_5us;
extern volatile Uint32 g_truth_post_timer2_10us;
extern volatile Uint32 g_truth_post_timer2_20us;
extern volatile Uint32 g_truth_post_timer2_50us;
extern volatile Uint32 g_truth_post_timer2_100us;
extern volatile Uint32 g_truth_ost_to_slow_timer2;
extern volatile Uint32 g_adc_pwm_sync_soca_count;
extern volatile Uint32 g_adc_pwm_sync_eoc_count;
extern volatile Uint32 g_adc_pwm_sync_miss_count;
extern volatile Uint16 g_adc_vout_pwm_sync_raw;
extern volatile Uint16 g_adc_pwm_sync_valid;
extern volatile Uint16 g_adc_pwm_sync_consecutive_miss;
extern volatile Uint16 g_adc_pwm_sync_stale_abort;

/* POST-STOP VOUT truth check (software-trigger ADC, PWM off) */
extern volatile Uint16 g_poststop_vout_request;
extern volatile Uint16 g_poststop_vout_done;
extern volatile Uint16 g_poststop_vout_phase;
extern volatile Uint16 g_poststop_vout_samples[32];
extern volatile Uint16 g_poststop_vout_min;
extern volatile Uint16 g_poststop_vout_max;
extern volatile Uint16 g_poststop_vout_avg;
extern volatile Uint16 g_poststop5ms_vout_avg;
extern volatile Uint16 g_poststop5ms_vout_samples[32];

/* Multi-cycle ISR latency diagnostic */
extern volatile Uint16 g_probe_isr_entry_tbctr;
extern volatile Uint16 g_probe_ost_command_tbctr;
extern volatile Uint16 g_probe_ost_after_tbctr;
extern volatile Uint32 g_probe_isr_entry_timer2;
extern volatile Uint32 g_probe_ost_command_timer2;
extern volatile Uint32 g_probe_ost_after_timer2;
extern volatile Uint16 g_probe_irq_latency_ticks;
extern volatile Uint16 g_probe_irq_to_ost_ticks;


/* OST lock diagnostic */
extern volatile Uint16 g_probe_tzflg_immediate;
extern volatile Uint16 g_probe_tzflg_read2;
extern volatile Uint16 g_probe_tzflg_read3;
extern volatile Uint16 g_probe_tzflg_after_state_update;
extern volatile Uint32 g_probe_tzclr_write_count;


/* Probe interrupt isolation */
extern volatile Uint16 g_probe_saved_ier;
extern volatile Uint16 g_probe_saved_pieier1;
extern volatile Uint16 g_probe_saved_pieier3;
extern volatile Uint16 g_probe_interrupt_isolation_active;


/* Stage4 Probe ADC capture */
#define LLC_PROBE_VOUT_SAMPLE_MAX 1U    /* legacy diagnostic capture buffer (memory-limited) */
extern volatile Uint16 g_probe_vout_samples[LLC_PROBE_VOUT_SAMPLE_MAX];
extern volatile Uint16 g_probe_vout_min;
extern volatile Uint16 g_probe_vout_max;
extern volatile Uint16 g_probe_vout_first;
extern volatile Uint16 g_probe_vout_last;
extern volatile Uint16 g_probe_adc_sample_count;


/* VOUT limited power probe */
extern volatile Uint16 g_vout_probe_request;
extern volatile Uint16 g_vout_probe_active;
extern volatile Uint16 g_vout_probe_target_raw;
extern volatile Uint16 g_vout_probe_stop_raw;
extern volatile Uint16 g_vout_probe_max_raw;
extern volatile Uint32 g_vout_probe_completed_cycles;
extern volatile Uint16 g_vout_probe_stop_reason;
extern volatile Uint16 g_vout_probe_dac_code;
extern volatile Uint32 g_vout_probe_max_cycles;
extern volatile Uint16 g_vout_probe_hard_limit_raw;


/* VOUT probe post-OST capture */
extern volatile Uint16 g_vout_probe_pre_stop_max_raw;
extern volatile Uint16 g_vout_probe_post_first_raw;
extern volatile Uint16 g_vout_probe_post_max_raw;
extern volatile Uint16 g_vout_probe_post_last_raw;
extern volatile Uint16 g_vout_probe_post_capture_active;
extern volatile Uint16 g_vout_probe_post_capture_count;
extern volatile Uint32 g_vout_probe_post_tick_count;
extern volatile Uint32 g_vout_probe_post_trigger_count;
extern volatile Uint32 g_vout_probe_post_start_count;
extern volatile Uint16 g_vout_probe_post_seen_active;


/* Calibration Hold Probe */
extern volatile Uint16 g_cal_hold_active;
extern volatile Uint16 g_cal_hold_charge_done;
extern volatile Uint32 g_cal_hold_total_on_cycles;
extern volatile Uint16 g_cal_hold_raw_min;
extern volatile Uint16 g_cal_hold_raw_max;
extern volatile Uint16 g_cal_hold_raw_average;
extern volatile Uint32 g_cal_hold_raw_sum;
extern volatile Uint32 g_cal_hold_raw_samples;
extern volatile Uint16 g_cal_hold_fault;
extern volatile Uint32 g_cal_hold_start_fast_tick;
extern volatile Uint32 g_cal_hold_slow_count;
extern volatile Uint16 g_cal_hold_charge_seen;
extern volatile Uint16 g_cal_hold_last_vout_stop_reason;
extern volatile Uint16 g_cal_hold_last_vout_active;
extern volatile Uint16 g_cal_hold_initial_stop_raw;
extern volatile Uint16 g_cal_hold_packet_start_raw;
extern volatile Uint16 g_cal_hold_packet_stop_raw;
extern volatile Uint16 g_cal_hold_packet_post_max_raw;
extern volatile Uint16 g_cal_hold_packet_post_last_raw;
extern volatile Uint32 g_cal_hold_packet_actual_cycles;
extern volatile Uint32 g_cal_hold_max_total_extra_cycles;

/* Timing */
extern volatile Uint32 g_fast_tick;
extern volatile Uint32 g_timer0_entry_count ;
extern volatile Uint32 g_timer0_last_entry ;
extern volatile Uint32 g_timer0_entry_interval_min ;
extern volatile Uint32 g_timer0_entry_interval_max ;
extern volatile Uint16 g_5ms_flag;

/* OVF diagnostics (ISR instrumentation) */
extern volatile Uint32 g_adc_ovf_count;
extern volatile Uint16 g_adc_ovf_first_tbctr;
extern volatile Uint16 g_adc_ovf_first_flag_was_set;
extern volatile Uint16 g_adc_isr_last_tbctr;

#endif /* APP_LLC_GLOBALS_H */















