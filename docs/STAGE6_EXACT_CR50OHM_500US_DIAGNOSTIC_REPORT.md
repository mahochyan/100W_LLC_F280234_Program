# STAGE6 Exact CR50Ω 500us Diagnostic Report

Status: **POWER BEHAVIOR PASS / FULL ACCEPTANCE BLOCKED**
Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1-1`
REAL OUT: `3ECDBA30685C636E3A28C7EAA695BD21B34CD91DE920D391AB65BE5F5AF74413`
Date: 2026-08-25

## Load

- Mode: CR
- Setpoint: 50.0 Ω
- Expected at 10V: 0.200 A / 2.00 W
- Transformer: Ns1:Np:Ns2 = 4:5:4

## Result

| Item | Value |
|---|---|
| state | 3 (COMPLETE) |
| abort | 1 (TIMEOUT) |
| ok | 1 |
| Timer2 delta | 30995 |
| softstart | COMPLETE |
| handoff | OK |
| max_vout_raw | 1366 (<1367) |
| fault | 0 |
| first/max cmd | 150108 / 155309 Hz |
| fresh_compute | 14 |
| pi_compute | 14 |
| pwm_apply | 13 |
| power_writes | 13 |
| pending_valid | 1 |
| ISR max | 947 |
| compute max | 947 |
| apply max | 800 |
| overrun | 0 |
| entry max | 1233 |
| entry over1230 | 1 |
| entry over1500 | 0 |
| entry over2400 | 0 |
| adjacent max | 2434 |
| final PWM/OST/PWS | 0 / 1 / POST_OST |

## Verdict

- Power behavior: **PASS**
  - `EXACT_CR50OHM_500US_POWER_BEHAVIOR_PASS`
- Full Stage6 acceptance: **BLOCKED**
  - `FULL_STAGE6_ACCEPTANCE_BLOCKED_BY_REALTIME_OR_PENDING`
  - ISR max 947 > 900
  - compute max 947 > 900
  - pending_valid = 1
  - entry max 1233 > 1230

## Final output

```text
EXACT_CR50OHM_500US_POWER_BEHAVIOR_PASS
FULL_STAGE6_ACCEPTANCE_BLOCKED_BY_REALTIME_OR_PENDING
BOARD_LEFT_SAFE_PWM0_OST1
NO_RETRY_EXECUTED
STOPPED_AWAITING_REVIEW
```

## Retry (confirmed CR 50Ω)

Result: **POWER BEHAVIOR FAIL — VOUT_11V_ABORT**

- Connected, entered PI.
- Frequency rose to 155422 Hz.
- VOUT hit 1367 >= abort_vout_raw 1367.
- Abort telemetry complete:
  - abort_adc_vout_raw=1453
  - abort_filtered_vout_raw=1367
  - abort_control_vout_raw=1367
  - abort_control_error_raw=-123
  - abort_frequency_hz=155422
  - abort_pipeline_phase=1
  - abort_adc_sequence=3027
  - abort_consumed_sequence=3027
  - abort_timer2=4244282890
- ISR max=1115 >900, pending_valid=1.

Final output:

```text
EXACT_CR50OHM_500US_POWER_BEHAVIOR_FAIL
FAILED_GATE=VOUT_MAX_BELOW_11V
BOARD_LEFT_SAFE_PWM0_OST1
NO_RETRY_EXECUTED
STOPPED_AWAITING_REVIEW
```
