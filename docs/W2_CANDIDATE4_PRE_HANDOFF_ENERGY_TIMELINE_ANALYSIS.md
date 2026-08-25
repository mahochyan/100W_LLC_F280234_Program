# W2 Candidate4 Pre-Handoff Energy Timeline Analysis

Task: `W2_CANDIDATE4_PRE_HANDOFF_ENERGY_STATE_SHAPING_V1`

## 1. Purpose

Answer the engineering question:

> Is the repeated 11 V overshoot dominated by energy already committed before
> the SoftStart -> PI handoff, or by energy injected after PI takes over?

This document uses only existing real-run evidence. It does not modify power
code and does not authorize a real-power retry.

## 2. Evidence sources

| Attempt | Evidence path |
|---|---|
| W2 Attempt1 | `evidence/sol_master_execution/w1_adc_freshness/W2_CR15_ATTEMPT1_REPORT.md` |
|  | `evidence/sol_master_execution/w1_adc_freshness/W2_CR15_POSTMORTEM_RECONNECT_RAW.txt` |
| Candidate2 | `evidence/sol_master_execution/w2_power_reduction_candidate2/REAL_CR15_ATTEMPT_RAW.txt` |
| Candidate3 timingfix5 | `evidence/sol_master_execution/w2_handoff_brake_candidate3_timingfix5/REAL_CR15_LADDER_RAW.txt` |

## 3. Real-run summary

| Field | Attempt1 | Candidate2 | Candidate3 timingfix5 |
|---|---|---|---|
| 2ms OUT SHA | `68A148...` | `3EC59B...` | `2E1374...` |
| SoftStart | COMPLETE | COMPLETE | COMPLETE |
| Handoff | OK | OK | OK |
| abort | 2 (VOUT_11V) | 2 (VOUT_11V) | 2 (VOUT_11V) |
| max_vout_raw | 1369 | 1370 | 1370 |
| first_control_vout_raw | 1298 | N/A (not captured) | N/A (not captured) |
| first_error_raw | -54 | N/A (not captured) | N/A (not captured) |
| first_command_hz | 150500 | 151000 (min) | 160500 (min) |
| last_command_hz | 154000 | 156423 | 163500 |
| first_tbprd | 398 | 396 | 373 |
| final_tbprd | 389 | 383 | 366 |
| fresh / pi / apply | 9 / 9 / 8 | 9 / 9 / 8 | 8 / 8 / 7 |
| power_writes | 8 | 8 | 7 |
| compute / active | 872 / 872 | 913 / 913 | 875 / 875 |
| apply | 844 | 854 | 859 |
| shutdown | 1110 | 1121 | 1086 |
| overrun | 0 | 0 | 0 |
| final | PWM0 OST1 TZINT0 | PWM0 OST1 TZINT0 | PWM0 OST1 TZINT0 |

## 4. Unified timeline reconstruction

Only Attempt1 has frozen Timer2 and first-VOUT telemetry. Candidate2 and
Candidate3 did not capture those fields in the frozen real ladder, so their
per-sample timeline is marked `N/A (not captured)`.

### Attempt1 (known)

- `first_control_vout_raw = 1298` — already **54 raw above Vref 1244** at the
  first PI-visible sample.
- `first_error_raw = -54` — PI is already in the reduce-power direction at the
  first compute.
- `first_command_hz = 150500`, `first_tbprd = 398`.
- `first_apply_timer2 = 4250607565`, `abort_timer2 = 4250588624`
  (Timer2 counts down).
- `time_handoff_to_abort ≈ (4250607565 - 4250588624) / 60e6 ≈ 315.7 us`.
- During that window there were 8 PWM applies, i.e. ~39.5 us per apply, which
  matches the 2-tick split-pipeline cadence.
- `abort_filtered_vout_raw = 1369`, `abort_control_vout_raw = 1369`,
  `abort_frequency_hz = 154000`.

### Candidate2 (known only at summary level)

- Post-handoff authority increased to +1000 Hz/fresh compute.
- Command moved 151000 -> 156423 Hz; final TBPRD 383.
- Peak still 1370.
- Exact handoff VOUT, first-error and Timer2 not frozen.

### Candidate3 timingfix5 (known only at summary level)

- Pre-handoff brake applied 160 kHz at transfer, PI preloaded to 160 kHz.
- Command moved 160500 -> 163500 Hz; final TBPRD 366.
- Peak still 1370.
- Exact handoff VOUT, first-error and Timer2 not frozen.

## 5. Key variable table

| Variable | Attempt1 | Candidate2 | Candidate3 timingfix5 |
|---|---|---|---|
| handoff_vout_raw | ~1298 (first PI-visible) | N/A | N/A |
| handoff_filtered_vout_raw | ~1298 | N/A | N/A |
| handoff_frequency_hz | 150500 | ~151000 | ~160500 |
| handoff_dvout_raw_per_sample | N/A | N/A | N/A |
| first_pi_vout_raw | 1298 | N/A | N/A |
| first_pi_error_raw | -54 | N/A | N/A |
| first_pi_command_hz | 150500 | ~151000 | ~160500 |
| first_pi_applied_hz | 150375 (actual from TBPRD398) | ~150376? | ~160000? |
| time_handoff_to_first_pi_us | N/A | N/A | N/A |
| time_handoff_to_first_apply_us | N/A | N/A | N/A |
| time_handoff_to_10V_cross_us | before first PI (1298 >= 1244) | N/A | N/A |
| time_handoff_to_abort_us | ~315.7 | N/A | N/A |
| dvout_before_handoff | N/A | N/A | N/A |
| dvout_first_100us_after_handoff | N/A | N/A | N/A |
| dvout_first_200us_after_handoff | N/A | N/A | N/A |
| dvout_before_abort | N/A | N/A | N/A |

## 6. Hypothesis test

### Evidence FOR `PRE_HANDOFF_ENERGY_HYPOTHESIS`

1. **Peak invariance across large post-handoff authority changes**:
   - Attempt1: first command 150500, slew 500 Hz, peak 1369.
   - Candidate2: first command ~151000, slew 1000 Hz, peak 1370.
   - Candidate3: first command 160500, slew 500 Hz, peak 1370.
   If post-handoff actuator authority were the dominant cause, the peak should
   have moved materially when the first command jumped from 150.5 kHz to
   160.5 kHz and the slew doubled. It did not.

2. **Attempt1 first PI sample is already above reference**:
   `first_control_vout_raw=1298 > vref=1244`, with `first_error_raw=-54`.
   This means the output had already crossed 10 V and was still rising before
   PI produced its first command.

3. **Time scale is short**:
   Attempt1 first-apply to abort is only ~316 us with 8 applies. The output
   capacitor / resonant tank energy committed during SoftStart is consistent
   with this fast overshoot.

### Evidence AGAINST / uncertainty

- Candidate2 and Candidate3 did not freeze `first_control_vout_raw`,
  `first_error_raw`, or Timer2. A strict per-sample timeline for those two is
  not available.
- No per-sample VOUT slope (`dvout_raw`) was captured in any attempt, so
  `dvout_before_handoff` and `dvout_first_100us_after_handoff` are unknown.
- The exact handoff frequency and first PI applied frequency for Candidate3
  are inferred from the command envelope, not from a frozen first-apply field.

## 7. Verdict

```text
PRE_HANDOFF_ENERGY_HYPOTHESIS_SUPPORTED
```

The available evidence supports the conclusion that the repeated 11 V overshoot
is dominated by energy/state already committed before the PI handoff, not by
post-handoff PI authority. The strongest signal is the invariant 1369/1370 peak
across three materially different post-handoff authority configurations, plus
the Attempt1 first-PI sample already being 54 raw above reference.

This is not a proof of the exact physical energy path. Candidate4 will add pure
on-chip telemetry (pre-brake entry raw, pre-brake exit raw, first PI raw,
first PI error, first PI command/apply, dvout samples, Timer2 captures) so the
next real attempt can produce the full unified timeline without host polling.
