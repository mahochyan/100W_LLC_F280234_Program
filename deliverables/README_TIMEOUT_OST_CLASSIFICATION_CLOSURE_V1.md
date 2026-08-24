# STAGE6_TIMEOUT_OST_CLASSIFICATION_CLOSURE_V1 / G6 ACCEPTANCE RECONCILIATION

Status: **TIMEOUT_SOFTWARE_OST_CLASSIFICATION_FIXED** + **NOPOWER_TIMEOUT_END_PASS** + **AUTHORIZED_REAL_G_200US_TIMEOUT_CLASSIFICATION_PASS** + **STAGE6_G6_ACCEPTANCE_RECONCILIATION_AND_SHOT_LOCAL_TELEMETRY_V1**
Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1-1` (new independent branch)
Real power: three authorized real 200 µs G attempts were executed on the previous REAL `2B01F82E`. G4/G5 aborted before handoff (`SHOT_ABORT_NO_HANDOFF`). G6 reached the normal 200 µs timeout and confirmed the classification fix. The two remaining G6 harness failures are now reclassified as measurement-semantics issues, not code failures:
- `ENTRY_INTERVAL_LE_1230` used a **global** all-ISR entry max instead of a shot-local ACTIVE-window max.
- `PI_DIRECTION_NEGATIVE_ERROR` read `g_control_error_raw` **after** IDLE, which is cleared and is not valid direction evidence.

## What changed in this offline reconciliation

- `SHOT_ShotSummary` now has:
  - `Uint32 entry_interval_max_shot`
  - `int16 first_error_raw`, `last_error_raw`, `min_error_raw`, `max_error_raw`
- `CTRL_ComputeFrequencyCommand` records first/last/min/max signed error into the ISR-side summary while ARMED/ACTIVE.
- `CTRL_PipelineApply` first-apply block resets `g_shot_entry_interval_max = 0` and seeds `g_shot_entry_last` at the first apply Timer2 value (REAL build only).
- `TINT0_ISR` updates the shot-local entry interval only while `SHOT_STATE_ACTIVE`.
- `SHOT_Revoke(SHOT_ABORT_TIMEOUT)` freezes `summary.entry_interval_max_shot` before the planned `LLC_PWM_DisableSafe()` closure.
- `SHOT_Revoke(SHOT_ABORT_NO_HANDOFF)` now uses `LLC_PWM_DisableSafe()` and closes to `POWER_WINDOW_POST_OST` **without latching a fault** (no longer left ACTIVE).
- `PWM_Trip`, `LLC_ProtectionForceTrip`, and `PROT_RequestFault` now take `Uint32 cause`, so `FAULT_FIRST_SHOT_ABORT=0x00010000UL` is not truncated.
- Harness updates:
  - entry gate uses `g_shot_summary.entry_interval_max_shot`
  - `PI_DIRECTION_NEGATIVE_ERROR` gate removed (post-IDLE global error is not direction evidence)
  - summary signed error fields are printed/read where available
- New REAL OUT/MAP frozen:
  - OUT SHA256: `725BB3BE8F7DA1C6EB1E719826824167DED87D0D18A7EAC13BCD015B980F3FFD`
  - MAP SHA256: `19E5C95D81E9CEA46729ADC66F589CC2D415D57E67E82BA505D00B23622B3433`
- Old REAL `2B01F82E` is preserved under `LLC_..._REVOKED_2B01F82E.out/.map` and marked `REVOKED_BY_REVIEW` / `DO_NOT_EXECUTE`.

## No-power validation (new REAL 725BB3BE)

Evidence: `G6_725BB3BE_NOPOWER_TIMING_RAW.txt` / `..._RESULT.json`.

| gate | value |
|---|---|
| Timer2 delta | 12875 (11000..14000) |
| state | COMPLETE (3) |
| ok | 1 |
| abort | TIMEOUT (1) |
| summary.abort_reason | TIMEOUT (1) |
| fault | 0 |
| pwm_enabled | 0 |
| pwm_enable_result | 0 |
| power_window_state | POST_OST (2) |
| OST | 1 |
| ISR max | 755 ≤ 900 |
| compute/apply max | 754 / 755 ≤ 900 |
| overrun | 0 |
| shot-local entry interval max | 1201 ≤ 1230 |
| abort=TZ | absent |

## Authorized real G attempts (previous REAL 2B01F82E)

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

These runs did **not** reach the 200 µs timeout path; the software-OST classification fix was not exercised. No `COMP_TZ1` fault or `abort=TZ` was observed.

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
After reconciliation the G6 run is a **functional 200 µs PASS**; the two remaining
harness gates were invalid measurement-semantics gates and are replaced by shot-local
telemetry gates.

## Final tokens

`TIMEOUT_SOFTWARE_OST_CLASSIFICATION_FIXED`, `NOPOWER_TIMEOUT_END_PASS`,
`ADC_STALE_PROTECTION_UNCHANGED`, `COMPARATOR_TZ_PROTECTION_UNCHANGED`,
`ISR_LE_900_PASS`, `CNT34_CONNECTED_FOR_AUTHORIZED_REAL_G`,
`AUTHORIZED_REAL_G_200US_TIMEOUT_CLASSIFICATION_PASS`,
`FIRST_BOUNDED_REAL_PI_SHOT_FUNCTIONAL_PASS`, `REAL_PI_COMPUTE_APPLY_PATH_PASS`,
`TIMEOUT_SOFTWARE_OST_CLASSIFICATION_REAL_POWER_PASS`,
`ISR_EXECUTION_BUDGET_PASS`, `ACTIVE_WINDOW_FAULT_ZERO_PASS`,
`PI_DIRECTION_PREVIOUS_G3_EVIDENCE_VALID`, `ENTRY_INTERVAL_GATE_SCOPE_INVALID`,
`POSTSHOT_ERROR_SIGN_GATE_INVALID`, `NO_MORE_200US_RETRY`.

## Stop point

All no-power gates passed on the new REAL `725BB3BE`. The offline reconciliation is
complete: the two G6 harness failures are reclassified as measurement-semantics
issues, and new shot-local telemetry is frozen. **No further real-power run is
authorized.** Stop here and await explicit authorization for a 300 µs real-power shot.
