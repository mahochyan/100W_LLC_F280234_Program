# STAGE6 G9 Root Cause Review

Status: **OFFLINE REVIEW / NO REAL POWER**
Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1-1`
Baseline: `6a42692`

## 1. G9 classification

| Item | Value |
|---|---|
| Real shot result | `STAGE6_1MS_LIGHTLOAD_REAL_SHOT_FAIL` |
| Abort | `VOUT_11V_ABORT_CONFIRMED` |
| Root cause | `ROOT_CAUSE_UNRESOLVED` |
| Control-range conclusion | `LIGHT_LOAD_CONTROL_RANGE_INSUFFICIENT_NOT_YET_PROVEN` |
| `shot_entry_max` | 0 = abort-path telemetry not frozen, not first-apply proof |
| `pi_compute_count` | Not a fresh-PI-update counter in the old firmware |

## 2. Observed G9 behavior

- `pi_compute_count=15`, `pwm_apply_count=14`, `power_writes=14`
- `max_vout_raw=1368 >= abort_vout_raw=1367`
- `first/last/min/max command = 150000 Hz`
- `shot_error first/last/min/max = 0`
- `global_control_error_raw=0` after IDLE (not valid direction evidence)

The old firmware counted repeated/stale ADC samples as successful compute and
could write the same-frequency pending, so the observed all-zero error and
150 kHz command do **not** prove the PI saw 15 fresh samples.

## 3. Control authority quantification (offline)

Current controller:

- PI update cadence: 40 µs (split pipeline)
- Slew limit: 100 Hz per 20 µs fast task = 100 Hz per compute? The split
  pipeline computes every 40 µs, so the maximum frequency change rate is:

  \[
  100 \text{ Hz} / 40 \mu s = 2.5 \text{ MHz/s}
  \]

- In the 300/500 µs no-load PASS runs the command moved by roughly:
  - 500 µs: ~ +1.2 kHz
  - 1 ms abort before: ~ +1.35–1.4 kHz

These values are consistent with operating near the slew saturation boundary.

## 4. Independent conclusions

1. `NOLOAD_CONTROL_AUTHORITY_LIMIT_CONFIRMED`
   - The no-load 1 ms failures and the 500 µs PASS show the controller is
     already near/at the 100 Hz per update slew limit while trying to raise
     frequency to keep VOUT below 11 V.

2. `G9_LIGHTLOAD_FRESHNESS_NOT_PROVEN`
   - G9 does not prove whether the light-load failure is caused by ADC
     freshness loss, a sudden VOUT step, or true control-authority shortage,
     because the old telemetry could not distinguish fresh vs stale compute.

## 5. Firmware changes in this closure

- Added shot-local fresh/stale compute counters.
- Added first/last/min/max PI-consumed VOUT raw and Vref raw.
- Added abort-instant telemetry (`abort_*` fields).
- Closed stale same-frequency fake write:
  - stale sample → no pending, no PWM apply, no `power_writes++`
  - stale_compute_count++
  - pending discarded on stale
  - fresh sample required to resume compute/apply
- VOUT abort now freezes abort telemetry and sets `POWER_WINDOW_POST_OST`.

## 6. No-power validation status

**Not executed on target in this review** because CNT3/CNT4 OPEN confirmation
is required and was not provided for this no-power session. The new REAL
candidate OUT has been built; no-power RAW/JSON are pending that confirmation.

## 7. Deliverables

- Updated `docs/STAGE6_1MS_LIGHT_LOAD_REAL_PI_REPORT.md`
- This review
- New firmware telemetry/stale-write changes
- New REAL candidate OUT/MAP SHA256
- Static regression / compile results

## 8. Stop

No real power, no retry, no 11 V threshold change, no Kp/Ki change.
