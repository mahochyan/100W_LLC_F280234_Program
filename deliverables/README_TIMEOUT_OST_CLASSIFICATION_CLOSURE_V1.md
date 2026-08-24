# STAGE6_TIMEOUT_OST_CLASSIFICATION_CLOSURE_V1

Status: **TIMEOUT_SOFTWARE_OST_CLASSIFICATION_FIXED** + **NOPOWER_TIMEOUT_END_PASS** + **AUTHORIZED_REAL_G_ATTEMPTED_FAIL_NO_HANDOFF**
Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1-1` (new independent branch)
Real power: one authorized real 200 µs G attempt was executed on `2B01F82E`; it failed before handoff (`SHOT_ABORT_NO_HANDOFF`). CNT3/CNT4 were connected for that authorized run.

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

## Authorized real G attempt (new REAL 2B01F82E)

Evidence: `G4_200US_NOLOAD_REAL_2B01F82E_RAW.txt` / `..._RESULT.json`.

| field | value |
|---|---|
| state | ABORTED (4) |
| abort | SHOT_ABORT_NO_HANDOFF (7) |
| tick | 0 |
| power_writes | 0 |
| fault | 0 |
| abort=TZ | absent |
| ISR max | 319 ≤ 900 |
| overrun | 0 |
| summary.abort_reason | 7 |

The run did **not** reach the 200 µs timeout path, so the software-OST classification
fix was not exercised in this real attempt. The previous `COMP_TZ1` misclassification
was not observed (`fault=0`, no `abort=TZ`), but the shot aborted before any PI write
with `SHOT_ABORT_NO_HANDOFF`.

## Final tokens

`TIMEOUT_SOFTWARE_OST_CLASSIFICATION_FIXED`, `NOPOWER_TIMEOUT_END_PASS`,
`ADC_STALE_PROTECTION_UNCHANGED`, `COMPARATOR_TZ_PROTECTION_UNCHANGED`,
`ISR_LE_900_PASS`, `CNT34_CONNECTED_FOR_AUTHORIZED_REAL_G`,
`AUTHORIZED_REAL_G_EXECUTED_FAIL_NO_HANDOFF`,
`READY_FOR_NO_HANDOFF_REVIEW`.

## Stop point

All no-power gates passed, and one authorized real 200 µs G attempt was executed.
The real attempt failed before handoff (`SHOT_ABORT_NO_HANDOFF`). **Stop and review the
no-handoff failure before any further real-power run.** Do NOT auto-run another real G.
