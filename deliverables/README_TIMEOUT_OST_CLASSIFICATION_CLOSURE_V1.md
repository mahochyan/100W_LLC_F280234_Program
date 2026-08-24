# STAGE6_TIMEOUT_OST_CLASSIFICATION_CLOSURE_V1

Status: **TIMEOUT_SOFTWARE_OST_CLASSIFICATION_FIXED** + **NOPOWER_TIMEOUT_END_PASS** + **AUTHORIZED_REAL_G_200US_TIMEOUT_CLASSIFICATION_PASS**
Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1-1` (new independent branch)
Real power: three authorized real 200 µs G attempts were executed on `2B01F82E`. The first two aborted before handoff (`SHOT_ABORT_NO_HANDOFF`). The third reached the normal 200 µs timeout and confirmed the classification fix: state=COMPLETE, abort=TIMEOUT, power_window_state=POST_OST, fault=0, no abort=TZ. The overall harness still reports FAIL only on `ENTRY_INTERVAL_LE_1230` and `PI_DIRECTION_NEGATIVE_ERROR`.

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

## Authorized real G attempts (new REAL 2B01F82E)

Evidence:
- `G4_200US_NOLOAD_REAL_2B01F82E_RAW.txt` / `..._RESULT.json` — attempt #1, no-handoff
- `G5_200US_NOLOAD_REAL_2B01F82E_RAW.txt` / `..._RESULT.json` — attempt #2, no-handoff
- `G6_200US_NOLOAD_REAL_2B01F82E_RAW.txt` / `..._RESULT.json` — attempt #3, reached 200 µs timeout

### G4 / G5 (no-handoff)

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

These runs did **not** reach the 200 µs timeout path; the software-OST classification
fix was not exercised. No `COMP_TZ1` fault or `abort=TZ` was observed.

### G6 (normal 200 µs timeout reached)

| field | value |
|---|---|
| state | COMPLETE (3) |
| abort | TIMEOUT (1) |
| summary.abort_reason | TIMEOUT (1) |
| tick | 11 |
| power_writes | 6 |
| fault | 0 |
| pwm_enabled / pwm_enable_result | 0 / 0 |
| power_window_state | POST_OST (2) |
| OST | 1 |
| Timer2 delta | 12916 (11000..14000) |
| ISR max / compute / apply | 688 / 569 / 688 ≤ 900 |
| overrun | 0 |
| abort=TZ | absent |

This run confirms the core `TIMEOUT_SOFTWARE_OST_CLASSIFICATION_FIXED` behavior.
The overall harness still prints `STAGE_G_200US_NOLOAD_REAL_SHOT_FAIL` because two
non-classification gates remain FAIL:
- `ENTRY_INTERVAL_LE_1230` (entry_max=1821)
- `PI_DIRECTION_NEGATIVE_ERROR` (control_error_raw=0 under this no-load condition)

## Final tokens

`TIMEOUT_SOFTWARE_OST_CLASSIFICATION_FIXED`, `NOPOWER_TIMEOUT_END_PASS`,
`ADC_STALE_PROTECTION_UNCHANGED`, `COMPARATOR_TZ_PROTECTION_UNCHANGED`,
`ISR_LE_900_PASS`, `CNT34_CONNECTED_FOR_AUTHORIZED_REAL_G`,
`AUTHORIZED_REAL_G_200US_TIMEOUT_CLASSIFICATION_PASS`,
`REAL_G_OVERALL_STILL_FAIL_ENTRY_INTERVAL_AND_PI_DIRECTION`.

## Stop point

All no-power gates passed. Three authorized real G attempts were executed; the third
reached the 200 µs timeout and confirmed the software-OST classification fix. The
overall G harness still has two failing gates (`ENTRY_INTERVAL_LE_1230`,
`PI_DIRECTION_NEGATIVE_ERROR`). **Stop and review those two gates before any further
real-power run.** Do NOT auto-run another real G.
