# STAGE6 40µs Split-Pipeline Accelerated Closed Loop — V1 Report

Status: **F PASS (no-power timing)** — `SPLIT_PIPELINE_40US_TIMING_PASS`
Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1-1` @ `b5e7067`
Baseline: candidate-2 REAL binary (previous `REAL_PI_FASTPATH_TIMING_FAIL`, ISR max 1148)
OUT fingerprint: `932337AA549E891D2AED208676366CC38DD241A21BB6BA10A3AC2B43AC860AA6`

---

## 1. Goal

Replace the 20 µs merged closed-loop ISR (full PI + period-change register write,
1148 cycles worst case) with a **40 µs alternating two-phase pipeline**:

- **PHASE_COMPUTE** (tick N): read fresh ADC, run Q12 PI, clamp 145–170 kHz,
  compute TBPRD/CMPA/CMPB/actual, write the *pending* structure only.
  **No PWM register write.**
- **PHASE_APPLY** (tick N+1): re-verify every authorization gate (B), commit the
  pending TBPRD/CMPA/CMPB + frequency/actual, then clear pending.
  **No PI.**
- Alternation gives a real closed-loop update every 40 µs while every 20 µs tick
  stays under the 900-cycle phase budget (measurement-gate invariant).

Per-phase budgets (locked): compute ≤ 900, apply ≤ 900, whole ISR ≤ 900,
entry interval ≤ 1230 (TINT0 period 1200 + Timer2 read-in window), overrun = 0.

## 2. Design (A–E)

### A. Split pipeline

`g_pipeline_phase` (0=compute, 1=apply) is flipped by `SHOT_FastTask` on every
tick where a phase executed (`g_pipeline_executed_phase`, reset to 0xFF at the
head of `CTRL_FastTask`). The first tick is always COMPUTE; the first APPLY
tick enters ACTIVE and records `first_apply_timer2`.

Per-tick contents:

| | COMPUTE | APPLY |
|---|---|---|
| Fresh ADC read | yes (seq check) | no |
| Q12 PI + 145–170k clamp | yes | no |
| TBPRD/CMPA/CMPB/actual compute | yes (pending) | no |
| PWM register write | **no** | yes (TBPRD, CMPA, CMPB, ADC sync) |
| Full B re-authorization | cheap arm+fault only | **full** |
| power_writes / actual_freq commit | no | yes |

`CONSERVATIVE_40US_FIRST_REAL_PROFILE`: Kp/Ki/max_step unchanged
(100 Hz/update); the 40 µs cadence halves integral/slew per real second —
Ki and step are **not** doubled.

### B. Pending contract

`SHOT_PipelinePending`: valid, sequence, command_hz, period, cmpa, cmpb, actual_hz.
APPLY re-verifies, in order:

1. `SHOT_PipelineApplyAuthorized()` — arm, stage≥6, handoff OK, reference
   valid, VOUT cal valid, Comparator/TZ verified, fault==0, system==RUN.
2. `SHOT_PendingValid()` — valid, freq in [145k,170k], period in [352,413],
   period↔command consistency via **multiplication only**
   (`clocks*target <= sum < (clocks+1)*target`, clocks = period+1).
3. Commit writes (DINT/EINT) `EPwm1Regs.TBPRD/CMPA/CMPB` and calls
   `ADC_UpdatePwmSyncPointKeepCadence(period)` only when period changed;
   then `g_pwm_period`, `g_switching_frequency_hz`, `g_actual_switching_frequency_hz`
   (from `g_real_pi_actual_hz_table[period-352]`) and `pending.valid = 0`.
4. Failure anywhere: pending dropped, `SHOT_Revoke` (+ OST + PWM=0) and no
   further commits (no double-commit, no commit after 200 µs).

### C. Conservative profile

Kp/Ki/max_step identical to candidate-2; only the update cadence changed.
`CONSERVATIVE_40US_FIRST_REAL_PROFILE` is the documented convention.

### D. Real-time 200 µs cage

`FIRST_REAL_PI_DURATION_CYCLES = 12000UL` replaces the old tick-count cage.
`CTRL_FastTask` computes `elapsed = (first_apply_timer2 - TIM)`; when
`elapsed >= 12000` at the start of a 20 µs tick → immediate
`SHOT_Revoke(TIMEOUT)`, PWM=0, arm revoked, state COMPLETE, system stays IDLE.
Independent counters: `fast_ticks`, `pi_compute_count`, `pwm_apply_count`.

Static derivation (locked): the cage fires on the 11th ACTIVE tick;
**fast_ticks = 11, pi_compute_count = 6, pwm_apply_count = 6** (first pending
computed before ACTIVE + 5 inside, 6 applies, last apply consumes pending →
valid=0).

### E. ISR record minimization

No ring in the 20 µs ISR. Only `SHOT_ShotSummary` is recorded: first TBPRD,
first command, first actual, last/min/max command, max VOUT raw, fast tick
count, compute count, apply count, abort reason, Timer2 times. Per-phase
maxima (`g_real_compute_phase_cycles_max`, `g_real_apply_phase_cycles_max`)
classify each tick by `g_pipeline_executed_phase`.

## 3. F no-power timing evidence

CNT3/CNT4 physically open (no power). Worst-case injection: Vref raw=1240,
Vout raw=1200, initial command=149900 → first pending 149800 / TBPRD 400 /
CMPA 200 / CMPB 100 / actual 149625, applied on the next tick.

```
SPLIT_PIPELINE_40US_COMPUTE_MAX = 708
SPLIT_PIPELINE_40US_APPLY_MAX  = 746
SPLIT_PIPELINE_40US_ISR_MAX    = 746
SPLIT_PIPELINE_40US_ENTRY_INTERVAL_MAX = 1205
SPLIT_PIPELINE_40US_FAST_TICKS = 11
SPLIT_PIPELINE_40US_PI_COMPUTE_COUNT = 6
SPLIT_PIPELINE_40US_PWM_APPLY_COUNT  = 6
timer2_delta = 12852 (11000..14000 window OK)
overrun = 0, fault = 0, final PWM = 0, OST = 1, pending final invalid
```

All 43 gates PASS (see `SPLIT_PIPELINE_932337AA_RAW.txt` / `_RESULT.json`).

Optimizations that reduced the 1148-cycle merged tick to the 746-cycle worst
phase: per-phase maxima classification, entry-interval min maintenance
removed, software-float `g_vout_volts >= 0.0f` gate replaced by the 16-bit
`g_board_vout_cal_valid` flag (F28034 has no FPU), ISR cycle-sum accumulation
removed, phase flip moved out of the ACTIVE-only branch (fixes a stuck-
compute bug found during bring-up: apply never ran, compute ran every tick).

## 4. Real-power path (NOT yet authorized)

Per the task hard rule, no real power may be applied until the operator
confirms on-site:

- CNT3 + CNT4 **connected** (or the DUT wiring check),
- Vin = 24 V, current limit = 0.5 A, light load ≈ 1–2 W,
- no smell / heat / wiring issues.

Then stage G (real 250k→150k profile C, real ADC ≈10 V, 40 µs pipeline,
max 200 µs, auto OST) with the full stage gates. The 200 µs→10 V/10 s ladder
(H), 12 V lab mode (I), 60 s CSV (J) and next-day low-power tests (K) are all
downstream of that on-site confirmation.

## 5. Artifacts

- `evidence/stage6_first_real_pi_shot_real/SPLIT_PIPELINE_932337AA_RAW.txt`
- `evidence/stage6_first_real_pi_shot_real/SPLIT_PIPELINE_932337AA_RESULT.json`
- `evidence/stage6_first_real_pi_shot_real/LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT_SPLIT_PIPELINE_932337AA.out/.map`
- `tools/stage6_real_binary_hardening_static_test.py` (all static checks PASS)
- `tools/stage6_first_real_pi_shot_real_binary_timing_nopower.js`
