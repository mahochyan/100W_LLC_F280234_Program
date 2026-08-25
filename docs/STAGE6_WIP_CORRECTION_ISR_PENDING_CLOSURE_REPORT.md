# STAGE6 WIP Correction ISR/Pending Closure Report

Status: **OFFLINE/BUILD COMPLETE; NO-POWER TARGET VALIDATION PENDING CNT34 OPEN**
Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1-1`
Baseline: `df12f03`
Date: 2026-08-25
Transformer: Ns1:Np:Ns2 = 4:5:4

## Corrections applied

- `df12f03_WIP_NOT_EXECUTABLE`
- `WIP_1000HZ_REVERTED_TO_500HZ`
- `WIP_DIRECT_DIVISION_REMOVED`
- `WIP_SAME_ISR_TELEMETRY_MOVE_CORRECTED`
- `PENDING_COMMON_ENTRY_CLEAR_PRESERVED`

## Firmware changes

- Reverted `CTRL_REDUCE_POWER_MAX_STEP_HZ` to 500.
- Removed `sum / target` direct division from `CTRL_PipelineMakePending`; restored no-division bounded walk.
- Kept atomic pending clear at the common entry of `SHOT_Revoke`:
  - `g_first_real_pi_shot_arm = 0`
  - `g_pipeline_pending.valid = 0`
  - `g_pipeline_executed_phase = 0xFF`
  - `g_pipeline_phase = PIPELINE_PHASE_COMPUTE`
- Removed per-tick last/min/max telemetry writes from `SHOT_FastTask`.
- First telemetry now recorded at first successful APPLY.
- Last telemetry frozen in `SHOT_Revoke`.
- `min/max` fields are no longer continuously tracked in the REAL fast path.

## Static / math verification

- `PENDING_REVOKE_COMMON_ENTRY_STATIC_PASS=True`
- `PERIOD_FASTPATH_EQUIVALENCE_PASS=True` (real control range, 15,025,601 combos)
- `ASYMMETRIC_SLEW_MATH_PASS=True` (500/-100 trajectory)
- `DIVIDE_HELPER_ABSENT` to be confirmed from REAL MAP after build.

## Builds

```text
REAL OUT    = 19C9ECFAEA0EFC38747BC1EF6DC79A7325B4C783461FC379DC028656F488C824
REAL MAP    = F717DB767EECA78522635341AB38FF15E110F3F431548AECEC6681FA26B606EE
NOENERGY OUT= CAB88E4D9B4FBEB7CE0683D299C253B4413BC88A87355BC437C5CA3F63DC3885
NOENERGY MAP= 3E0288E5984B98BE2409E9B8E4CA88B3ED3D7F084BF032BAFD58CB949B261AA1
```

## No-power target validation

**PENDING** — requires CNT3/CNT4 OPEN confirmation (`DSH_CNT34_OPEN_CONFIRMED=1`).

## Final output (currently)

```text
STAGE6_WIP_CORRECTION_ISR_PENDING_CLOSURE_PASS  (not yet)
FAILED_GATE=NO_POWER_TARGET_VALIDATION_PENDING
CNT34_REMAIN_OPEN
NO_REAL_POWER_EXECUTED
STOPPED_AWAITING_REVIEW
```
