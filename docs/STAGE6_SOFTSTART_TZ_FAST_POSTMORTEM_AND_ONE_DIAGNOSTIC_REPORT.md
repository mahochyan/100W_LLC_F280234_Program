# STAGE6 SoftStart TZ Fast Postmortem and One Diagnostic Report

Status: **POSTMORTEM COMPLETE / REAL DIAGNOSTIC NOT EXECUTED**
Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1-1`
Baseline: `45276af`
Date: 2026-08-25

## 1. Current RAM postmortem

A new read-only debug session could not resolve symbols without reloading the
program. Per task rule (no reset/reload/clear fault), the current RAM TZ
snapshot was **not recoverable**.

Recorded: `POSTMORTEM_RAM_UNAVAILABLE`

## 2. Real script updated

`tools/stage6_cr100_single_burst_restart_real.js` now includes the full TZ fast
postmortem snapshot in the black-box read:

- `g_tz_isr_gpio15`
- `g_tz_isr_compsts`
- `g_tz_isr_tzflg`
- `g_tz_event_phase`
- `g_tz_isr_tbctr`
- `g_tz_isr_timer2`
- `g_comp_trip_dac_code`
- `g_comp_trip_tbctr`
- `g_comp_trip_vout_raw`
- `g_accel_trip_*`
- trip counters and software OST token fields

## 3. Diagnostic retry

Not executed because scope confirmation variables were not provided:

- `DSH_SCOPE_ARMED=1`
- `DSH_PRIMARY_CURRENT_MONITORED=1`

## Final output

```text
SOFTSTART_TZ_POSTMORTEM_COMPLETE
REAL_DIAGNOSTIC_NOT_EXECUTED
AWAITING_SCOPE_ARMED_CONFIRMATION
```
