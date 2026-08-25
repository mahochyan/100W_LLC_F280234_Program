# STAGE6_CR20_BURST_THRESHOLD_CONFLICT_CLOSURE_V1 - Audit & Root Cause Split

Baseline: `5c08a11`
Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1-1`
Status: **AUDIT COMPLETE / B1 CONFIRMED / C+D PASS / REAL CR20 2MS FAIL -> B2 TRUE_FMAX_LIGHT_LOAD**

## A. Audit of existing CR20 2ms evidence

Evidence:
- `evidence/stage6_first_real_pi_shot_real/REAL_2MS_CR20_9D2FB238_RAW.txt`
- `evidence/stage6_first_real_pi_shot_real/REAL_2MS_CR20_9D2FB238_RESULT.json`

Observed summary:
- `state=4` (ABORTED), `abort=2` (VOUT_11V), `ok=0`
- `softstart=1`, `handoff=1`
- `burst_enter_count=1`, `pwm_apply_count=0`, `power_writes=0`
- `max_vout_raw=1387`, `fault=65536` (0x10000)
- `timing_frozen=1`, `timing_sample_count=571`
- `timing_active_isr_max=854`, `timing_compute_max=854`, `timing_apply_max=0`, `timing_shutdown_max=1080`, `timing_overrun_count=0`
- `hardware_trip_delta=0`, `active_trip_delta=0`, `TZ INT=0`
- `power_window_state=2` (POST_OST), `pwm=0`, `ost=1`

### 1. fault=0x10000 exact macro and set location

- Macro: `FAULT_FIRST_SHOT_ABORT` (`llc_config.h:91`, value `0x00010000UL`)
- Set location in this run: `SHOT_Revoke(SHOT_ABORT_VOUT_11V)` -> `PWM_Trip(FAULT_FIRST_SHOT_ABORT, 0U)` (`app/shot.c` lines 475-481)
- Trigger: `SHOT_FastTask()` sees `g_adc_vout_filtered_raw >= g_first_real_pi_shot_abort_vout_raw` (line 822) after the shot is ACTIVE.

### 2. Burst entry exact condition

- In `CTRL_PipelineApply()` (`app/control.c` lines 672-680):
```c
if (g_burst_enabled != 0U)
{
    if (g_burst_active == 0U && p->period < TUTORIAL_MIN_BURST)
    {
        SHOT_BurstEnter();
        return;
    }
}
```
- `TUTORIAL_MIN_BURST` = `400U` (`app/shot.h:64`).
- Any `p->period` from `CTRL_PipelineMakePending()` is already range-validated to 352..413 (`app/control.c:528`), so the effective premature Burst window is **352..399**, i.e. inside the legal continuous PFM range.

### 3. Burst entry telemetry

The existing 2ms RAW did **not** dump `g_burst_entry_*`/PI-integrator fields, so exact historical values are not recoverable. The following is the deterministic code path for this run:

| item | value / derivation |
|---|---|
| phase | `PIPELINE_PHASE_APPLY` (Burst entered in apply before any PI PWM write) |
| VOUT raw | not captured; handoff is 10V (~raw 1236), first fresh PI compute had not yet applied; entry VOUT is expected below 1367 |
| Vref raw | calibrated 10V reference raw (handoff) |
| error | `g_control_error_raw`, expected negative (VOUT > Vref) for power-reduction step |
| PI integrator | not captured by this firmware; not in existing evidence |
| unclamped requested period | not stored in bounded build; first step from 150kHz is capped at +500Hz, so unclamped command is <=150500Hz, i.e. **not below 352** |
| clamped requested period | `p->period` from first fresh pending; because `pwm_apply=0` and `burst_enter_count=1`, it was in 352..399 (most likely 398/399 from 150000/150500Hz) |
| applied period | **none** (no `SHOT_PendingCommit`; `pwm_apply_count=0`, `power_writes=0`); hardware remained at the handoff period 399 (150kHz) until Burst disabled PWM |
| requested frequency | clamped 150000..150500Hz |
| applied frequency | 150000Hz handoff frequency |

### 4. Where max_vout_raw=1387 occurred

- `max_vout_raw` is only updated in `SHOT_FastTask()` while `g_first_real_pi_shot_state == SHOT_STATE_ACTIVE` (`app/shot.c` line 762-780).
- `SHOT_BurstEnter()` sets `g_first_real_pi_shot_state = SHOT_STATE_ACTIVE` even though no PI apply occurred (`app/shot.c:596`).
- Since `pwm_apply_count=0` and `burst_enter_count=1`, the 1387 peak was reached **after Burst entry + software OST**, not during SoftStart, handoff, or an active PI PWM period.

### 5. VOUT first reaches 1367 vs Burst entry / software OST
- Burst entry and its software OST happen before any PI PWM apply and before the VOUT abort check can run (the abort check is in `SHOT_FastTask` after state becomes ACTIVE).
- Therefore the first `>=1367` filtered sample occurs **after** Burst entry + software OST, during residual output-capacitor energy rise.
- The software 11V abort then fires (`abort=2`) and is the first faulting event.

### 6. Why final fault is only 0x10000; is 11V abort normal?
- The 11V abort executed normally: `SHOT_Revoke(SHOT_ABORT_VOUT_11V)` -> `PWM_Trip(FAULT_FIRST_SHOT_ABORT,0)` -> PWM=0, OST=1, `POWER_WINDOW_POST_OST`, state=ABORTED.
- `FAULT_FIRST_SHOT_ABORT` is the controlled software first-shot-abort flag. No hardware/Comparator/TZ trip occurred: `TZ INT=0`, `hardware_trip_delta=0`, `active_trip_delta=0`.
- The reason there is no `FAULT_COMP_TZ1` is that the 11V software abort, not TZ, closed the shot. This is the intended protection path; it is not an unexpected fault.

## B. Root-cause branch

### B1 selected: `PREMATURE_BURST_THRESHOLD_CONFIRMED`

- Burst is triggered solely by `p->period < 400`. Since pending periods are always 352..413, the trigger is within the legal continuous PFM range (150..170kHz).
- VOUT reaches 1367 only after Burst entry + software OST (residual rise).
- `0x10000` is the controlled `FAULT_FIRST_SHOT_ABORT` from the subsequent 11V abort, not an unexpected hardware fault.
- Therefore the correct fix is to move the Burst boundary below the continuous fmax (352), not to change PI/Profile C/11V/TZ.

Proceed to C.


## C. Implemented Burst-boundary fix (B1 path)

Changed `app/control.c` `CTRL_PipelineApply()`:

- Before: Burst whenever `g_burst_active==0 && p->period < TUTORIAL_MIN_BURST` (i.e. 352..399).
- After: Burst only when `g_control_error_raw < 0` AND:
  - `g_control_unclamped_frequency_hz > FIRST_REAL_PI_MAX_HZ` (true >170kHz request), OR
  - `p->period == 352 && g_control_fmax_saturate_count >= 3` (3 consecutive fresh fmax-saturated overvoltage computes).
- Added `g_control_unclamped_frequency_hz` capture in `CTRL_ComputeFrequencyCommand`.
- Added `g_control_fmax_saturate_count` tracking in `CTRL_PipelineCompute`.
- Added Burst-entry black-box fields in `SHOT_BurstEnter()` (phase/VOUT/error/PI-I/unclamped/clamped/applied/timer2).

## D. Rebuild + no-power + boundary results

REAL binaries rebuilt and saved:

- `REAL_2MS`: OUT SHA `1F6B16E4...`, MAP SHA `985146A8...`
- `REAL_10MS`: OUT SHA `D5D94A28...`, MAP SHA `0655296E...`
- `REAL_100MS`: OUT SHA `F24A9800...`, MAP SHA `59E96645...`
- Manifest updated: `evidence/stage6_first_real_pi_shot_real/REAL_LADDER_SHA256SUMS.txt`

No-power ladder (pure REAL, no switching) all PASS:

- 2MS: compute_max=864, apply_max=872, active=872, shutdown=632, overrun=0, state=3/abort=1/ok=1, PWM0/OST1
- 10MS: compute_max=0, apply_max=877, active=877, shutdown=632, overrun=0
- 100MS: compute_max=0, apply_max=899, active=899, shutdown=637, overrun=0

Boundary NOENERGY tests (NOENERGY OUT SHA `0C501B0A...`) all PASS:

- PERIOD_400 -> continuous, burst=0, pw=1
- PERIOD_399 -> continuous, burst=0, pw=1
- UNDER_400_OVER_V -> continuous, burst=0, pw=1
- PERIOD_353 -> continuous, burst=0, pw=1
- PERIOD_352 -> continuous, burst=0, pw=1
- ONE_352_SAT -> continuous, burst=0, pw=1, fmax_sat=1
- THREE_352_SAT -> Burst, burst=1, pw=0, fmax_sat=3
- UNCLAMPED_352_BURST -> Burst, burst=1, pw=0, uncl=170500

## E. Real CR20 ladder result

Authorized real ladder ran `2MS` first (exactly once). It **FAILED**, so per task no retry and the ladder stopped before 10MS/100MS.

Real 2MS result (new binary `1F6B16E4...`):

- `state=4` (ABORTED), `abort=2` (VOUT_11V), `ok=0`
- `burst_enter_count=0`, `power_writes=2`, `apply=2`, `fresh=2`, `pi=2`
- `max_vout_raw=1369` (>=1367)
- `compute_max=952` (>=900 gate), `apply_max=887`, `active_isr_max=952`, `shutdown_max=1139` (<1200)
- `overrun=0`, `pending=0`, `fault=65536` (controlled `FAULT_FIRST_SHOT_ABORT` from 11V abort)
- `pwm=0`, `OST=1`, `TZ INT=0`, `power_window_state=2` (POST_OST)

Interpretation: after removing the premature Burst, the CR20 20.0Ω load still cannot be regulated to 10V within the allowed 145..170kHz continuous PFM envelope. The PI went to fmax (period 352) and VOUT still crossed 1367, causing the controlled 11V abort. This is consistent with **B2 / `TRUE_FMAX_LIGHT_LOAD`** for the final real result.

## F. Final tokens

```
STAGE6_CR20_CONTINUOUS_PFM_FAIL
ROOT_CAUSE=TRUE_FMAX_LIGHT_LOAD
NEXT_LOAD_CANDIDATE=CR15
NO_CONTROL_CHANGE_EXECUTED
BOARD_LEFT_SAFE_PWM0_OST1
```

Board left safe: PWM=0, OST=1, TZ INT=0, POST_OST.
