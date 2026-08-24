# STAGE6_TIMEOUT_OST_CLASSIFICATION_CLOSURE_V1

Status: **TIMEOUT_SOFTWARE_OST_CLASSIFICATION_FIXED** + **NOPOWER_TIMEOUT_END_PASS**
Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1-1` (new independent branch)
Real power: **NOT executed this stage**. CNT3/CNT4 remain physically open.

## What changed

- `SHOT_Revoke(SHOT_ABORT_TIMEOUT)` no longer writes raw `EPwm1Regs.TZFRC.bit.OST`.
  It now calls `LLC_PWM_DisableSafe()`, which disables the TZ OST interrupt before
  forcing OST and immediately classifies the window as `POWER_WINDOW_POST_OST`.
- The normal 200 µs end now yields:
  - `arm=0`
  - `state=COMPLETE`
  - `ok=1`
  - `abort=TIMEOUT`
  - `summary.abort_reason=TIMEOUT`
  - `pwm_enabled=0`
  - `pwm_enable_result=0`
  - `system_state=IDLE`
  - `power_window_state=POST_OST`
- Harness fixes:
  - `control_error_raw` is read as signed int16 (`65506` parses as `-30`).
  - Static enum gates added: `0x10 == FAULT_COMP_TZ1`, `0x40 == FAULT_ADC_STALE_OVERFLOW`,
    `3 == SHOT_ABORT_TZ`, `6 == SHOT_ABORT_PERMISSION`.
- New REAL OUT/MAP frozen:
  - OUT SHA256: `2B01F82E8616A94CF939AC2C4D99702D2BFB6A3DECFCF67FA5DE1876EF30292C`
  - MAP SHA256: `30247E185F2A71EE1A4F73F35556E135E0E45ED7667F04082E44397BDE0933FB`
- Old REAL OUT (`CAD61C38…`) and the G3 split binary (`206DA60C…`) are preserved and
  marked `REVOKED_BY_REVIEW` / `DO_NOT_EXECUTE`; they are not deleted.

## No-power validation (new REAL 2B01F82E)

Evidence: `TIMEOUT_FIX_2B01F82E_NOPOWER_TIMING_RAW.txt` / `..._RESULT.json`.

| gate | value |
|---|---|
| Timer2 delta | 12855 (11000..14000) |
| state | COMPLETE (3) |
| ok | 1 |
| abort | TIMEOUT (1) |
| summary.abort_reason | TIMEOUT (1) |
| fault | 0 |
| pwm_enabled | 0 |
| pwm_enable_result | 0 |
| power_window_state | POST_OST (2) |
| OST | 1 |
| ISR max | 746 ≤ 900 |
| compute/apply max | 707 / 746 ≤ 900 |
| overrun | 0 |
| abort=TZ | absent |

## Final tokens

`TIMEOUT_SOFTWARE_OST_CLASSIFICATION_FIXED`, `NOPOWER_TIMEOUT_END_PASS`,
`ADC_STALE_PROTECTION_UNCHANGED`, `COMPARATOR_TZ_PROTECTION_UNCHANGED`,
`ISR_LE_900_PASS`, `CNT34_REMAIN_OPEN`, `NO_REAL_POWER_EXECUTED`,
`READY_FOR_SINGLE_G_RETRY_REVIEW`.

## Stop point

All no-power gates passed. **Stop and await one new real 200 µs G authorization.**
Do NOT auto-run real power.
