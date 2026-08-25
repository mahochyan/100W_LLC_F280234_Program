# STAGE6 500us Light-Load Freshness Diagnostic Report

Status: **FAIL**
Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1-1`
Baseline: `44683d0`
Root-cause firmware commit: `2dae576`
500us REAL OUT SHA256: `9FBEA0533A3EE36E792ACBF8DF8CB3BC9C68AB69D122BE9CBAB69C4DBB196822`
Date: 2026-08-25

## 1. No-power timing (PASS)

Using the 500us REAL candidate with CNT3/CNT4 OPEN:

| Gate | Value |
|---|---|
| state | 3 (COMPLETE) |
| abort | 1 (TIMEOUT) |
| ok | 1 |
| Timer2 delta | 30888 (29500..32500) |
| fresh_compute_count | 1 |
| stale_compute_count | 25 |
| pi_compute_count | 1 |
| pwm_apply_count | 1 |
| power_writes | 1 |
| pending_valid | 0 |
| PWM / OST / POST_OST | 0 / 1 / 2 |
| fault | 0 |
| ISR max / compute / apply | 851 / 851 / 769 |
| overrun | 0 |

Verdict: `TIMING_500US_PASS=PASS`

## 2. Real 500us light-load shot (FAIL)

Conditions:

- Vin = 24 V, current limit 0.5 A
- Load ~1 W, connected and confirmed
- CNT3/CNT4 connected
- Single authorized shot only

Result:

| Field | Value |
|---|---|
| state | 4 (ABORTED) |
| abort | 2 (VOUT_11V) |
| ok | 0 |
| power_writes | 13 |
| max_vout_raw | 1369 |
| abort_vout_raw | 1367 |
| fault | 0x10000 |
| fresh_compute_count | 13 |
| stale_compute_count | 2 |
| pi_compute_count | 13 |
| pwm_apply_count | 13 |
| first/last ADC seq | 3501 / 3526 |
| first/last consumed seq | 3501 / 3526 |
| first/last/min/max cmd | 150100 / 151300 / 150100 / 151300 |
| shot_error first/last/min/max | 0 / -118 / -118 / 0 |
| ISR max / compute / apply | 885 / 880 / 885 |
| overrun | 0 |
| final PWM / OST / PWS | 0 / 1 / POST_OST |
| fault | `FAULT_FIRST_SHOT_ABORT` |

### Freshness conclusion

- `fresh_compute_count == pi_compute_count == 13`
- `pwm_apply_count == power_writes == 13`
- ADC sequences advanced normally
- stale samples were only 2 and did not increase `power_writes`
- Therefore **ADC freshness was NOT the failure cause**.

### Control authority conclusion

- The PI did see fresh negative error and did raise frequency from 150100 to 151300 Hz.
- Even so, VOUT still reached the 11 V abort (1369 raw >= 1367 raw) before the 500 us timeout.
- Classification: **`LIGHTLOAD_CONTROL_AUTHORITY_INSUFFICIENT`**

## 3. Safety state after real shot

- PWM = 0
- OST = 1
- Fault not cleared
- No retry, no reload, no further power
- `NO_RETRY_EXECUTED`

## 4. Evidence files

- `evidence/stage6_first_real_pi_shot_real/500US_LIGHTLOAD_FRESHNESS_SHA256SUMS.txt`
- `evidence/stage6_first_real_pi_shot_real/500US_LIGHTLOAD_NOPOWER_TIMING_RAW.txt`
- `evidence/stage6_first_real_pi_shot_real/500US_LIGHTLOAD_NOPOWER_TIMING_RESULT.json`
- `evidence/stage6_first_real_pi_shot_real/500US_LIGHTLOAD_REAL_9FBEA053_RAW.txt`
- `evidence/stage6_first_real_pi_shot_real/500US_LIGHTLOAD_REAL_9FBEA053_RESULT.json`

> Note: the real-script output did not print the `abort_*` telemetry fields; those are marked unavailable in the JSON. The primary freshness and control-authority data were captured.

## 5. Final output

```text
STAGE6_500US_LIGHTLOAD_FRESHNESS_DIAGNOSTIC_FAIL
FAILED_GATE=VOUT_MAX_BELOW_11V
ROOT_CAUSE_CLASS=LIGHTLOAD_CONTROL_AUTHORITY_INSUFFICIENT
BOARD_LEFT_SAFE_PWM0_OST1
NO_RETRY_EXECUTED
STOPPED_AWAITING_REVIEW
```
