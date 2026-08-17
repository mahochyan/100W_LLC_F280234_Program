# BOARD_BRINGUP.md

F28034 LLC 100 W bring-up — Stage-by-stage hardware procedure.

> **First power-on must start at Stage 0 SAFE.** Build success does **not** imply Stage 5–7 are approved.

## Safety rules

- Always use an input supply with current limit.
- First main-power test: low input voltage, light/fake load, start at 150 kHz.
- Monitor MOS Vgs/Vds, half-bridge waveform, resonant current, Vout.
- Any abnormal waveform or smell -> remove power immediately.
- The COMP1OUT → PCB → GPIO15/TZ1 path is `BOARD_MAPPING_PENDING_PHYSICAL_VERIFY` until Stage 4 injection test passes.

## CCS write sequence

All variables are non-static `volatile` and visible in CCS Expressions. One-shot requests are cleared by firmware after use.

### Stage 0 — SAFE (power-on default)

1. Connect debugger, load `.out`.
2. Verify `g_system_state == 1` (IDLE), `g_bringup_stage == 0`, `g_pwm_enabled == 0`, `g_pwm_enable_result == 0`.
3. Verify LEDs/clock/GPIO safe levels.
4. No PWM output expected; GPIO0/1 are clamped low by OST.

### Stage 1 — PWM_FIXED (no main power)

1. In CCS Expressions set `g_stage_confirm_request = 1`.
2. Verify `g_bringup_stage == 1`, `g_active_bringup_stage == 1`.
3. Set `g_pwm_enable_request = 1`.
4. Verify `g_pwm_enabled == 1`, `g_pwm_period == 400`, `g_switching_frequency_hz == 150000`.
5. Scope: EPWM1A/EPWM1B/SI8233 inputs/outputs, four MOS Vgs/Vds. Check dead time ≈ 36 ticks = 600 ns at 60 MHz TBCLK.
6. Set `g_pwm_enable_request = 0` before stage change.

### Stage 2 — PFM_MANUAL

1. Stage 1 confirmed and PWM off.
2. Set `g_stage_confirm_request = 2`.
3. Set `g_switching_frequency_hz` between 70–150 kHz (software range; 70 kHz is **not** yet a verified safe power limit).
4. `g_pwm_enable_request = 1`, verify period changes accordingly. Strict UP-count formula gives e.g. 150 kHz → TBPRD=399, 100 kHz → TBPRD=599.

### Stage 3 — ADC_MONITOR

1. Confirm Stage 3.
2. ADC is in software-trigger mode for static monitoring/calibration.
3. Observe `g_adc_vout_raw`, `g_adc_ipri_raw`, `g_adc_iout_raw`, filtered `*_filtered_raw`.
4. Engineering values remain `-1.0f` until calibrated; do **not** use them for protection/closed loop.

### Stage 4 — PROTECTION_TEST

1. Confirm Stage 4.
2. Enable 150 kHz with no main power.
3. Set `g_force_trip_request = 1`; verify PWM is latched low and `g_trip_count` increments.
4. Recovery: `g_pwm_enable_request = 0`, remove fault source, `g_fault_reset_request = 1`, then `g_pwm_enable_request = 1` rising edge.
5. Comparator external path: set `g_comp_dac_value`, `g_comp_polarity`, `g_comp_arm = 1` and inject a low-energy signal to COMP1A. Verify TZ1 latches and `g_trip_count` increments.
6. Only after both tests pass, confirm Stage 5A.

### Stage 5A — OPEN_LOOP_MANUAL (first main power)

- Confirm Stage 5A only after Stage 4 passed.
- Set `g_open_loop_min_frequency_hz = 100000` (or higher) until data proves lower is safe.
- First power: Vin 8–12 V current-limited, fake/light load, start 150 kHz.
- Manual single steps only: 150 → 120 → 100 kHz. **No automatic sweep to 70 kHz.**
- Record Vout, Ipri, Vgs, Vds, ZVS margin at each step.

### Stage 5B — SOFT_START_TEST

- Only after Stage 5A data confirms a safe region.
- Set `g_softstart_autoramp_allowed = 1`.
- Each enable starts at 150 kHz; firmware ramps down at ≤500 Hz per 5 ms toward `g_open_loop_target_frequency_hz`.
- The target must stay ≥ `g_open_loop_min_frequency_hz`.

### Stage 6 — CLOSED_LOOP

- Confirm only after Vout calibration is valid and frequency→Vout direction is measured.
- Change `LLC_CONTROL_DIRECTION` in `llc_config.h` from `0` to `+1` or `-1`, rebuild.
- Set `g_voltage_reference` to a legal value.
- ADC must be ePWM1 SOCA-triggered; asynchronous Timer ADC is prohibited in closed loop.
- PI runs in the 20 µs fast task; 5 ms is only state machine/soft-start/slow protection.

### Stage 7 — POWER_RUN

- Confirm only after all protections calibrated and `LLC_POWER_RUN_ALLOWED = 1` in `llc_config.h`, rebuild.
- `g_power_run_min_frequency_hz` default 70 kHz is a candidate, not verified.
- Lower frequency only in manual steps ≤5 kHz.
- Absolute software hard floor is 35 kHz candidate; actual safe minimum must be unlocked by measurements.

## Trip / fault recovery

1. Set `g_pwm_enable_request = 0`.
2. Remove the physical fault source / clear `g_force_trip_request`.
3. Set `g_fault_reset_request = 1`.
4. Firmware clears OST and fault flags only with PWM off and source removed.
5. Re-assert `g_pwm_enable_request = 1` for a new rising edge.

Firmware never auto-clears OST and never auto-restarts.
