# STAGE6 REALTIME CONTROL INPUT BINDING CLOSURE V1 一 REPORT

## Objective
Close and verify the production runtime data chain before any real-PI entry:
**real ADC → fresh sample → Q12 PI**, and **Vref engineering value → raw
reference**. Real power / PI unlock / PWM loop remain disabled.

## 1. Cadence bug confirmed (Gate B)
`CTRL_FastTask` (20 µs) previously read `g_control_vout_raw`, which was only
refreshed in `CTRL_SlowTask` (5 ms). That made the fast PI consume a sample up
to 5 ms stale — `CONTROL_INPUT_CADENCE_BUG_CONFIRMED`. Closed by making the
fast path consume the latest ADC sample directly.

## 2. Sample source audit (Gate C)
The production fast path consumes **`g_adc_vout_filtered_raw`** (IIR-smoothed,
same raw scale as the pre-migration `g_vout_volts` source / prior audit). This
is the physical sample the PI actually integrates. `g_control_vout_raw` now
only records the sample consumed at Compute entry. The slow-task refresh
`g_control_vout_raw = g_adc_vout_filtered_raw` was removed.

## 3. Freshness — single consume, else freeze (Gates D, E, L)
`CTRL_RunFastControl()` selects freshness via `g_adc_sample_sequence`:
- sequence advanced → consume the **LATEST** `g_adc_vout_filtered_raw` exactly
  once, record `g_control_adc_sequence_consumed`, increment
  `g_control_fresh_sample_count` and `g_control_pi_update_count`;
- sequence unchanged → `sample_valid = 0`, PI/integrator **freeze**, increment
  `g_control_duplicate_sample_block_count` and `g_control_stale_tick_count`;
- multiple samples between two ticks → only the latest is consumed once.

Observation counters (all new globals): `g_control_adc_sequence_last`,
`g_control_adc_sequence_consumed`, `g_control_fresh_sample_count`,
`g_control_duplicate_sample_block_count`, `g_control_stale_tick_count`,
`g_control_pi_update_count`.

On-target: held sequence `seq=100` (Vout fixed) for >10k ticks → fresh=1,
pi=1, duplicate-blocked=10167, integral stable; then `seq=101` → exactly one
more PI update. **`pi_update_count == fresh_sample_count`** throughout →
`DUPLICATE_ADC_SAMPLE_INTEGRATION_BLOCKED_PASS`.

## 4. Reference engineering value → raw (Gate F)
`CTRL_SlowTask` (5 ms) computes `g_control_vref_raw = CTRL_VoltsToRaw(
g_voltage_reference)` **only** from the engineering Vref (never hard-coded;
derived from `board_calibration.h`). Runtime sync (write only
`g_voltage_reference`):
| Vref | firmware raw | calibration-derived |
|------|-------------|---------------------|
| 12 V | 1491 | 1491 |
| 11 V | 1368 | 1368 |
| 10 V | 1244 | 1244 |
| 15 V | 1862 | 1862 |
| 13 V | 1615 | 1615 |
| 12 V (back) | 1491 | 1491 |

→ `VREF_RAW_RUNTIME_SYNC_PASS`.

## 5. Reference-valid gate (Gate G)
`g_control_reference_valid = (g_voltage_reference > 0.5 V)`, set only in the
slow task. `CTRL_FastTask` early-returns while invalid. A 0 V init reference
can therefore **never** become a real RUN reference. On-target:
0 V → valid=0 / vref_raw=0; 12 V → valid=1 / vref_raw=1491 →
`REFERENCE_VALID_GATE_PASS`.

## 6. Telemetry order (Gate H)
`CTRL_SlowTask` now syncs data/reference **before** `CTRL_UpdateTelemetrySlow()`
(telemetry no longer lags one 5 ms cycle). The 20 µs control path does not
depend on telemetry floats.

## 7. Full fast path soft-float free (Gate I)
Static check over `CTRL_FastTask + CTRL_RunFastControl +
CTRL_ComputeFrequencyCommand + CTRL_ApplyFrequencyCommand`:
**0 FFC, 0 soft-float refs** → `FULL_FAST_CONTROL_PATH_SOFTFLOAT_FREE_PASS`.
The remaining floats live in the slow/teaching path (out of scope).

## 8. Fast sample binding (Gate M)
Driven `seq100:1491 → 101:1480 → 102:1470 → 103:1460`; each fresh sample's
`g_control_vout_raw` follows immediately (1491/1480/1470/1460), not 5 ms later
→ `20US_CONTROL_SAMPLE_BINDING_PASS`.

## 9. Production no-energy test (Gates J,K)
The synthetic ADC raw + sequence are delivered through the same
freshness/sample-binding/PI-entry path used in production (mode 1 = FRESH
auto-advance, mode 3 = HELD). Real PWM stays 0, OST stays 1. Core 8-case and
first-step tests are retained.

## 10. SIL cadence, missing 1/2/3 tick (Gate N)
Host SIL replays both controllers on the same freshness cadence. Every-tick
fresh matches V2.1 within quantization; with 1/2/3 missing tick(s) both
controllers **freeze** (integral + output held) and resume identically on the
next fresh → `SIL_CADENCE_FULL_FRESH_MATCH_PASS` and
`SIL_CADENCE_MISSING_1_2_3_STALE_PASS`. (Transient Q12-vs-f32 divergence
~17 Hz ≈ 0.016 % of 150 kHz, within the 25 Hz transient tolerance; steady-state
ensemble max dev = 5.78 Hz < 10 Hz.)

## 11. 20 µs full-shadow budget (Gate O)
Whole TINT0 ISR including production freshness + `CTRL_RunFastControl` + Q12
Compute + shadow Apply:
| metric | value |
|--------|-------|
| whole-ISR max | **575 cycles = 9.58 µs (47.9 %)** |
| binding+PI (ctrl) max | 208 cycles |
| overrun | **0** |
| ticks (clean) | 91,213 |
| ticks/min mode | 12,336 |

≤ 900 → **PASS**, not MARGIN_LOW, not FAIL; overrun=0.

## 12. Final verdict
```
CONTROL_SAMPLE_SOURCE_AUDIT_PASS                 = TRUE
FRESH_ADC_SAMPLE_SINGLE_CONSUME_PASS            = TRUE
DUPLICATE_ADC_SAMPLE_INTEGRATION_BLOCKED_PASS   = TRUE
20US_CONTROL_SAMPLE_BINDING_PASS                = TRUE
VREF_RAW_RUNTIME_SYNC_PASS                      = TRUE
REFERENCE_VALID_GATE_PASS                       = TRUE
FULL_FAST_CONTROL_PATH_SOFTFLOAT_FREE_PASS      = TRUE
20US_FULL_SHADOW_CONTROL_BUDGET_PASS            = TRUE
overrun                                         = 0
PWM_REGISTER_ISOLATION_PASS                     = TRUE
---------------------------------------------------------
READY_FOR_STAGE6_REAL_POWER_PI_ENTRY_REVIEW      = TRUE
LLC_HARDWARE_PI_VALIDATED                        = 0
LLC_CONTROL_DIRECTION                            = 0
PWM                                              = 0
OST                                              = 1
```
No CLA used. Real PWM / power / soft-start / OST are all disabled —
**NO REAL POWER EXECUTED**.

## Commit
`fix: close Stage6 realtime ADC and reference binding before real PI entry`
