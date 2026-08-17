# CCS_EXPRESSIONS.md

All variables are non-static `volatile` and can be added to CCS Expressions.

## Stage / PWM

| Variable | Type | R/W | Range / meaning |
|---|---|---|---|
| `g_bringup_stage` | Uint16 | R | Current confirmed stage 0..8 (0,1,2,3,4,5A=5,5B=6,6=7,7=8) |
| `g_active_bringup_stage` | Uint16 | R | Runtime active stage (normally same as `g_bringup_stage`) |
| `g_stage_confirm_request` | Uint16 | W one-shot | Write next stage number to confirm |
| `g_stage_confirmed_mask` | Uint16 | R | Bitmask of confirmed stages |
| `g_switching_frequency_hz` | Uint32 | R/W | Requested/last applied frequency (Hz); Stage 2/3 live PFM target |
| `g_actual_switching_frequency_hz` | Uint32 | R | Actual frequency derived from TBPRD (Hz) |
| `g_pwm_period` | Uint16 | R | TBPRD ticks |
| `g_pwm_enabled` | Uint16 | R | 1 = PWM released, 0 = inhibited/tripped |
| `g_pwm_enable_request` | Uint16 | W | Rising edge requests PWM on; write 0 to inhibit |
| `g_pwm_enable_result` | Uint16 | R | 1 = last request accepted |

## ADC

| Variable | Type | R/W | Meaning |
|---|---|---|---|
| `g_adc_vout_raw` | Uint16 | R | ADCINA1 raw |
| `g_adc_ipri_raw` | Uint16 | R | ADCINA2/COMP1A raw |
| `g_adc_iout_raw` | Uint16 | R | ADCINA3 raw |
| `g_adc_vout_filtered_raw` | Uint16 | R | Normalized 1/16 IIR filtered raw (acc >> 4) |
| `g_adc_ipri_filtered_raw` | Uint16 | R | Normalized 1/16 IIR filtered raw (acc >> 4) |
| `g_adc_iout_filtered_raw` | Uint16 | R | Normalized 1/16 IIR filtered raw (acc >> 4) |
| `g_adc_vout_filter_acc` | Uint32 | R | Internal 16x IIR accumulator |
| `g_adc_ipri_filter_acc` | Uint32 | R | Internal 16x IIR accumulator |
| `g_adc_iout_filter_acc` | Uint32 | R | Internal 16x IIR accumulator |
| `g_vout_volts` | float | R/W after cal | Engineering Vout; `-1.0f` = invalid |
| `g_iout_amps` | float | R/W after cal | Engineering Iout; `-1.0f` = invalid |
| `g_ipri_amps` | float | R/W after cal | Engineering Ipri; `-1.0f` = invalid |
| `g_adc_sample_counter` | Uint32 | R | Incremented each ADC EOC |

## State / protection

| Variable | Type | R/W | Meaning |
|---|---|---|---|
| `g_system_state` | Uint16 | R | 0 INIT, 1 IDLE, 2 SOFT_START, 3 RUN, 4 FAULT |
| `g_fault_flags` | Uint32 | R | Active fault bits (see below) |
| `g_fault_history` | Uint32 | R | Sticky fault history |
| `g_trip_count` | Uint16 | R | Counts software force trips + real TZ1 trips |
| `g_fast_fault_count` | Uint16 | R | Fast-task fault events |
| `g_fault_reset_request` | Uint16 | W one-shot | Set 1 to request explicit reset (PWM off + source removed) |
| `g_force_trip_request` | Uint16 | W one-shot | Set 1 for Stage 4 force-trip test |
| `g_tz_ost_flag` | Uint16 | R | EPwm1 TZFLG.OST |
| `g_tz_int_flag` | Uint16 | R | EPwm1 TZFLG.INT |

## Control

| Variable | Type | R/W | Meaning |
|---|---|---|---|
| `g_softstart_frequency_hz` | Uint32 | R | Current soft-start ramp frequency |
| `g_control_frequency_hz` | Uint32 | R | Current control output frequency |
| `g_voltage_reference` | float | W | Closed-loop Vref |
| `g_open_loop_target_frequency_hz` | Uint32 | W | 5A/5B target frequency |
| `g_open_loop_min_frequency_hz` | Uint32 | W | 5A/5B minimum allowed frequency (default 100 kHz) |
| `g_power_run_min_frequency_hz` | Uint32 | W | Stage 6/7 lower clamp (default 70 kHz candidate) |
| `g_softstart_autoramp_allowed` | Uint16 | W | 1 = enable 5B auto ramp |
| `g_pi_integral` | float | R | PI integrator |
| `g_pi_bias_frequency_hz` | float | R | PI bias at entry |
| `g_control_running` | Uint16 | R | 1 when closed-loop task active |

## Comparator / TZ

| Variable | Type | R/W | Meaning |
|---|---|---|---|
| `g_comp_dac_value` | Uint16 | W | 10-bit DAC threshold (0..1023) |
| `g_comp_polarity` | Uint16 | W | COMP CMPINV polarity |
| `g_comp_arm` | Uint16 | W | 1 = enable COMPDACEN and protection path |
| `g_loopback_diag_request` | Uint16 | W one-shot | 1 = run COMP1OUT->GPIO15/TZ1 loopback diagnostic |
| `g_comp_tz_loopback_verified` | Uint16 | R | 1 = loopback verified |
| `g_loopback_diag_result` | Uint16 | R | 0 idle, 1 pass, 2 fail |
| `g_comp_inject_test_request` | Uint16 | W one-shot | 1 = arm Stage4C comparator injection test |
| `g_comp_inject_test_armed` | Uint16 | R | 1 = comparator injection test armed |
| `g_comp_inject_test_disarm_request` | Uint16 | W one-shot | 1 = disarm comparator injection test |
| `g_comp1_status` | Uint16 | R | COMP1 comparator output status |
| `g_comp1_dac_code` | Uint16 | R/W | COMP1 DAC code (default ~31 for ~100 mV) |

## Fault bits

| Bit | Value | Meaning |
|---|---|---|
| `FAULT_INIT_CLOCK` | 0x00000001 | Clock init failure |
| `FAULT_ILLEGAL_STAGE` | 0x00000002 | Stage jump/confirm rejected |
| `FAULT_ILLEGAL_FREQUENCY` | 0x00000004 | Frequency outside stage limits |
| `FAULT_PWM_CONFIG_MISMATCH` | 0x00000008 | Frozen PWM config changed |
| `FAULT_COMP_TZ1` | 0x00000010 | TZ1 trip / comparator path |
| `FAULT_FORCE_TRIP` | 0x00000020 | Software force trip |
| `FAULT_ADC_STALE_OVERFLOW` | 0x00000040 | ADC stale/overflow |
| `FAULT_ADC_RAW_FAST` | 0x00000080 | Fast raw limit |
| `FAULT_VOUT_OVP` | 0x00000100 | Vout over-voltage |
| `FAULT_IOUT_OCP` | 0x00000200 | Iout over-current |
| `FAULT_VOUT_UVP` | 0x00000400 | Vout under-voltage |
| `FAULT_CAL_MISSING` | 0x00000800 | Calibration missing |
| `FAULT_CONTROL_DIRECTION` | 0x00001000 | LLC_CONTROL_DIRECTION still 0 |
| `FAULT_STAGE_GATE` | 0x00002000 | Stage 7 gate not allowed |
| `FAULT_COMP_TZ_LOOPBACK` | 0x00004000 | COMP1OUT->GPIO15/TZ1 loopback/mapping fault |

## One-shot usage

- `g_stage_confirm_request`: write next stage; firmware clears after processing.
- `g_force_trip_request`: write 1; firmware clears after tripping.
- `g_fault_reset_request`: write 1 after PWM off and source removed; firmware clears after reset.
- `g_pwm_enable_request`: keep at 1 to run; write 0 to inhibit. Only rising edge starts.


## PROFILE_C_VOUT_TARGET_LADDER_V1

| Variable | Type | R/W | Meaning |
|---|---|---|---|
| `g_accel_vout_target_raw` | Uint16 | W | Ladder target: **1200** (default, first shot) or 1400 only |
| `g_accel_vout_hard_limit_raw` | Uint16 | R | Derived at arm: 1200→1300, 1400→1450 (not writable) |
| `g_accel_target_rejected` | Uint16 | R | 1 = target rejected (not 1200/1400), no power started |
| `g_accel_stop_reason` | Uint16 | R | 0 none / 1 MAX_CYCLES / 2 VOUT_TARGET / 3 HARD_LIMIT / 4 TZ_TRIP / 5 STALE_ADC |
| `g_accel_stop_target_raw` | Uint16 | R | Frozen target at stop |
| `g_accel_stop_hard_limit_raw` | Uint16 | R | Frozen hard limit at stop |
| `g_accel_stop_raw` | Uint16 | R | Frozen VOUT raw at stop |
| `g_accel_stop_max_raw` | Uint16 | R | Frozen max VOUT raw seen |
| `g_accel_stop_completed_cycles` | Uint32 | R | Frozen completed cycles |
| `g_accel_stop_phase` | Uint16 | R | Frozen phase (1 A / 2 B / 3 C / 4 VOUT_STOP / 5 MAX) |
| `g_accel_stop_tbprd/cmpa/cmpb/dbred/dbfed` | Uint16 | R | Frozen PWM/dead-band state |
| `g_accel_stop_dacval` | Uint16 | R | Frozen COMP DACVAL |
| `g_accel_stop_run_id_at_arm/stop/tz_isr` | Uint32 | R | Frozen run-id chain |
| `g_accel_stop_tzflg` | Uint16 | R | Frozen TZFLG (ACTIVE trip evidence) |
| `g_accel_stop_fault_flags` | Uint32 | R | Frozen fault flags |
| `g_accel_stop_soca_count/eoc_count/miss_count` | Uint32 | R | Frozen ADC freshness counters |

First shot setup: `g_test_run_id = 0x250C1200`, `g_accel_vout_target_raw = 1200`,
`g_accel_request = 1`. Vin 24.0 V, bench limit 0.20 A, CNT3/CNT4 connected.
