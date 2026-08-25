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

## No-power target validation (CONNECTED_STAGE_NO_SWITCHING_TIMING)

Performed with permanent CNT34 connected, AQCSFRC force-low, no enable request, no switching.

### REAL corrected OUT (19C9ECFA)

```text
state=3 abort=1 ok=1 t2d=30931
fresh=1 stale=25 pi=1 apply=1 pw=1 pending=0
PWM=0 OST=1 POST_OST fault=0
ISR max=807 <=900
compute max=758
apply max=807
overrun=0
```

### NOENERGY corrected OUT (CAB88E4D)

Negative:
```text
trace exact 150500..156500
fresh=13 stale=0 pi=13 apply=13 pw=13
state=3 abort=1 ok=1 t2d=30891 pending=0
ISR max=1016 (test stimulus/trace overhead, not REAL WCET)
```

Positive:
```text
trace exact 149900..148700
fresh=13 stale=0 pi=13 apply=13 pw=13
state=3 abort=1 ok=1 t2d=30944 pending=0
ISR max=979 (test stimulus/trace overhead, not REAL WCET)
```

## Final output

```text
STAGE6_WIP_CORRECTION_ISR_PENDING_CLOSURE_PASS
CONTROL_500_100_BEHAVIOR_PRESERVED
DIRECT_DIVISION_REMOVED
PENDING_REVOKE_COMMON_ENTRY_PASS
REAL_WHOLE_ISR_LE_900_PASS
REAL_COMPUTE_ISR_LE_900_PASS
REAL_APPLY_ISR_LE_900_PASS
CNT34_PERMANENTLY_CONNECTED
NO_REAL_POWER_EXECUTED
READY_FOR_SINGLE_NEW_SHA_100OHM_CONFIRMATION
```

## Real new-SHA 100Ω confirmation attempt

Result: **FAIL — CAL_MISSING fault before PI**

- New REAL OUT: `19C9ECFA...`
- Load: CR 100Ω
- CNT34 permanently connected
- PRE gates passed
- After arm/enable, firmware latched `FAULT_CAL_MISSING (0x800)`
- state=0, power_writes=0, no PI window entered
- PWM=0, OST=1

Evidence:
- `evidence/stage6_first_real_pi_shot_real/NEWSHA_CR100_500US_19C9ECFA_RAW.txt`
- `evidence/stage6_first_real_pi_shot_real/NEWSHA_CR100_500US_19C9ECFA_RESULT.json`

No retry, no fault clear, no further power.
