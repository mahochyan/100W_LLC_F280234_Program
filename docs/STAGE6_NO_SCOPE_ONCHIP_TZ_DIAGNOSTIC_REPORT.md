# STAGE6 No-Scope On-Chip TZ Diagnostic Report

Status: **FAIL**
Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1-1`
REAL OUT: `439E1BDF46C237AE4BCC1923289FBFB2F038AFE15EB5DF4FD9F82DECD1E07EF9`
Date: 2026-08-25

## Result

- SoftStart COMPLETE, handoff OK.
- Burst entry occurred (`enter=1`, `burst_state=OFF_WAIT`).
- Restart did **not** complete before 500us TIMEOUT:
  - `exit=0`, `attempt=0`, `success=0`
  - final abort=1 (TIMEOUT), not BURST_RESTART_DONE(10)
- ISR max=1116 >900, compute max=1116 >900.
- No hardware trip: `hardware_trip_delta=0`, `active_trip_delta=0`.
- TZ snapshot: GPIO15=1, COMPSTS=1, TZFLG=5, no comparator trip.

## Final output

```text
STAGE6_NO_SCOPE_DIAGNOSTIC_FAIL
FAILED_PHASE=BURST_RESTART_NOT_COMPLETED_BEFORE_TIMEOUT
NO_RETRY_EXECUTED
BOARD_LEFT_SAFE_PWM0_OST1
```
