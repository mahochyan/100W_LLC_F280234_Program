# STAGE6_CR15_TIMING_RECOVERY_AND_CONTINUOUS_PFM_LADDER_V1

## Scope

Reduce the real fmax/active ISR worst-path from 952 cycles to <=900 cycles without
touching PI parameters, Profile C, soft-start trajectory, 145..170kHz range,
Burst control semantics, dead-time, 11V abort (1367), Comparator/OCP/TZ, or the
900-cycle gate. Keep the verified 170kHz Burst-boundary fix. Then run the CR15
2ms -> 10ms -> 100ms continuous PFM ladder.

## Timing root cause

The earlier real CR20 2ms failure had `compute_max=952`, `active_isr_max=952`
while the no-power CR15 rebuild still showed `compute_normal_max=889` after only
`--opt_for_speed=5` was changed. The 892/952-cycle path was traced to work that
is not part of the control decision:

1. `CALHOLD_FastTask` executed a 32-bit multiply/limit calculation every TINT0
   tick even while `CAL_HOLD_IDLE`.
2. The per-ISR real-observation block copied/updated active-shot entry-interval
   statistics on every tick, not only at shot-local events.
3. The old path kept a 32-bit Hz division and repeatedly copied Burst black-box
   fields on non-event cycles.
4. The fmax overvoltage path could additionally exercise the volatile
   `g_control_fmax_saturate_count` increment/reset in the compute phase.

## Minimal real-time optimization (no control-output change)

- `CALHOLD_FastTask`: added an early IDLE return and moved the 32-bit limit
  multiply into the OFF/PACKET cases only.
- `TINT0_ISR` observation block: kept only `g_real_timer0_entry_count++` and
  `g_real_timer0_last_entry = r_entry`; removed per-tick entry-interval/ACTIVE
  statistics.
- ISR 32-bit Hz division removed: the ISR stores/compares period/TBPRD only;
  host-side derives `frequency_hz = 60000000/(period+1)`.
- Burst black-box is captured only on event cycles, not on every non-event
  tick.
- `fmax_saturate_count` is minimally incremented/reset/saturated in the fresh
  compute path only.
- No PI parameter, Profile, soft-start trajectory, Burst condition, 145..170kHz
  range, dead-time, 1367 VOUT abort, Comparator/OCP/TZ, or 900-cycle gate was
  changed.

## Before/after optimization comparison

| metric | before (CR20 2ms real / 892 path) | after (CR15 no-power/fmax) |
|---|---|---|
| compute normal max | 889-892 | 837 (2ms no-power) |
| compute fmax max | 952 (old stress) | 820 (fmax stress SAT 0/1/2) |
| apply max | 887 | 836-859 |
| active ISR max | 952 | 837-859 |
| shutdown max | 1139 | 529-534 |
| overrun | 0 | 0 |

The final no-power ladder all PASS with the required gates: normal compute
<=850, fmax compute <=900, active <=900, apply <=900, shutdown <1200,
overrun=0, pending=0, PWM=0, OST=1, TZ INT=0, POST_OST.

## Evidence

- `evidence/stage6_first_real_pi_shot_real/REAL_CR15_LADDER_SHA256SUMS.txt`
  (3 OUT/MAP SHA256)
- `evidence/stage6_first_real_pi_shot_real/STAGE6_CR15_NOPOWER_LADDER_ALL_RAW.txt`
- `evidence/stage6_first_real_pi_shot_real/STAGE6_CR15_NOPOWER_LADDER_ALL_RAW.json`
- `evidence/stage6_first_real_pi_shot_real/STAGE6_CR15_FMAX_STRESS_NOENERGY_RAW.txt`
- `evidence/stage6_first_real_pi_shot_real/STAGE6_CR15_FMAX_STRESS_NOENERGY_RAW.json`
- `evidence/stage6_first_real_pi_shot_real/STAGE6_CR15_REAL_2MS_FAIL_RAW.txt`
- `evidence/stage6_first_real_pi_shot_real/STAGE6_CR15_REAL_2MS_FAIL_RAW.json`

## No-power CR15 ladder (2ms -> 10ms -> 100ms)

All three steps PASS on the pure REAL binaries (no switching, AQCSFRC forced
low, final PWM0/OST1/TZ INT0/POST_OST).

- 2MS:  compute_normal_max=837, compute_max=837, apply_max=836,
  active_isr_max=837, shutdown_max=534, overrun=0, samples=103
- 10MS: compute_normal_max=837, compute_max=837, apply_max=836,
  active_isr_max=837, shutdown_max=534, overrun=0, samples=502
- 100MS: compute_normal_max=837, compute_max=837, apply_max=849,
  active_isr_max=849, shutdown_max=529, overrun=0, samples=4999

`STAGE6_CR15_NOPOWER_LADDER_ALL_PASS`

## Fmax stress no-power

Using the same REAL CR15_2MS binary, period=352/error<0 at fmax_saturate_count
0,1,2 (Burst disabled) and 3 (Burst enabled), with software PWM enabled and
AQCSFRC force-low:

- FMAX_SAT_0: cfmax=820, no burst, safe final
- FMAX_SAT_1: cfmax=820, no burst, safe final
- FMAX_SAT_2: cfmax=820, no burst, safe final
- FMAX_SAT_3: burst=1, safe final, no overrun

`STAGE6_CR15_FMAX_STRESS_NOENERGY_PASS`

## CR15 real ladder summary

The valid CR15 2ms step (15Ω load confirmed) was attempted exactly once after
no-power and fmax-stress PASS. It FAILED on the first and only attempt:

- `FAILED_DURATION=2MS`
- `state=4` (ABORTED), `abort=6` (SHOT_ABORT_PERMISSION), `ok=0`
- `softstart=1`, `handoff=1`, `burst=0`
- `max_vout_raw=1357` (<1367, so not a VOUT_11V abort)
- `fault=65600` = `0x10040` (`FAULT_FIRST_SHOT_ABORT | FAULT_ADC_STALE_OVERFLOW`)
- `compute_max=868`, `active_isr_max=868`, `apply_max=849`, `overrun=0`
- final `PWM=0`, `OST=1`, `TZ INT=0`
- `NEXT_LOAD_CANDIDATE=NONE`
- `NO_RETRY_EXECUTED`

No CR15 10ms/100ms steps were attempted, and no CR12.5 was auto-run.

Note: an earlier 20Ω-load attempt is invalid and is not treated as the CR15
result.

## Tokens (current milestone)

```
STAGE6_CR15_CONTINUOUS_PFM_FAIL
FAILED_DURATION=2MS
FAILED_GATE=FAULT_ADC_STALE_OVERFLOW
NEXT_LOAD_CANDIDATE=NONE
NO_RETRY_EXECUTED
BOARD_LEFT_SAFE_PWM0_OST1
```
