# STAGE6 Handoff Reference Atomic Publication Closure Report

Status: **CLOSED (offline + connected no-switching only)**
Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1-1`
Baseline: `64fead0`
Date: 2026-08-25
Transformer: Ns1:Np:Ns2 = 4:5:4

## Root cause

`DETERMINISTIC_ONE_SLOW_TICK_AUTHORIZATION_GAP`

- `SoftStart_TransferToClosedLoop()` published `HANDOFF_RESULT_OK/RUN/pwm_enabled`
  before `g_control_vref_raw` and `g_control_reference_valid` were set.
- On the next slow tick, `SHOT_RealBoundedPiAuthOk()` returned 0 because
  `reference_valid=0`, so `limited_auth=0`, and uncalibrated engineering values
  triggered `FAULT_CAL_MISSING`.
- Reclassification:
  - `NEW_SHA_CR100_500US_POWER_BEHAVIOR_NOT_REACHED`
  - `HANDOFF_REFERENCE_PUBLICATION_GAP`

## Fix

- Added `CTRL_PrimeHandoffReferenceRaw(Uint16 reference_raw)`.
- `SoftStart_TransferToClosedLoop()` now calls it after `g_voltage_reference=10.0f`
  and before publishing COMPLETE/OK/RUN/pwm_enabled.
- If prime fails, handoff is rejected, PWM disabled, OST stays 1.
- `CTRL_SlowTask()` now writes `g_control_vref_raw` first, then
  `g_control_reference_valid=1` last.
- Added telemetry:
  - `g_stage6_ref_prime_count`
  - `g_stage6_ref_prime_raw`
  - `g_stage6_ref_valid_at_run_entry`
  - `g_stage6_ref_prime_result`

## Verification

- `RAW_CONVERSION_PARITY_PASS=True`
- `HANDOFF_PUBLICATION_ORDER_STATIC_PASS=True`
- NOENERGY two-slow-tick:
  - `ref_raw=1244`, `ref_valid=1`, `fault=0`
- Connected no-switching REAL timing:
  - ISR max=798, compute=752, apply=798, overrun=0, pending=0

## Builds

```text
REAL OUT    = BE752B16020DE9764361829943CD0178ABDC0BAA108E03D8FD3504B63115DF94
REAL MAP    = 13A4215B75207D4EE705A11E3C5B746AC2C43865A52240FF643734E261D30A98
NOENERGY OUT= A54C117A2C0EE14518ED6DCA6B8CE7BCAC2335C267B0BB41F92E4B9A9971BB73
NOENERGY MAP= 4D99A75A00C0BCB8296379FC53233EE86E6AC58F6753D82A5740B8CB9EFB0B09
```

## Final output

```text
HANDOFF_REFERENCE_PUBLICATION_GAP_CONFIRMED
HANDOFF_REFERENCE_ATOMIC_PUBLICATION_PASS
BOARD_VOUT_CALIBRATION_WAS_VALID
NOENERGY_HANDOFF_TWO_SLOW_TICKS_PASS
REAL_CONNECTED_NO_SWITCHING_TIMING_PASS
OLD_REAL_19C9ECFA_REVOKED
CNT34_PERMANENTLY_CONNECTED
NO_REAL_POWER_EXECUTED
READY_FOR_SINGLE_CR100_500US_RETRY_REVIEW
```
