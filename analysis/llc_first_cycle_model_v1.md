# LLC First-Cycle Current Model V1

> Status: `FIRST_CYCLE_MODEL_COMPLETE` (PC simulation only; no firmware/hardware changed)
> Date: 2026-08-17

## 0. Conclusion tags

- `[MEASURED]` = from real-board experiments in this bring-up campaign
- `[SCHEMATIC]` = from the current board schematic / component values supplied by user
- `[SIMULATED]` = from this Python time-domain model
- `[INFERRED]` = engineering inference based on the above

---

## 1. Scope and safety

This task is **theory + PC numerical simulation + report only**.

No real power shot was run. No production firmware was modified.

---

## 2. Inputs and parameter provenance

| Parameter | Value | Source |
|---|---|---|
| Vin | 24.0 V nominal (23.8/24.2 swept) | `[SCHEMATIC]` / test plan |
| Lr | 3.35 / 3.385 / 3.42 uH | `[SCHEMATIC]` |
| Cr | 3.004 uF | `[SCHEMATIC]` |
| Lm | 16.9 / 17.25 / 17.6 uH | `[SCHEMATIC]` |
| Transformer turns | Np=5T, Ns_half=4T, n=1.25 | `[SCHEMATIC]` |
| Dead-time | DBRED=DBFED=36 ticks @60 MHz = 600 ns | `[SCHEMATIC]` / firmware |
| Output capacitor | **UNKNOWN on board**; swept 470 / 940 / 1410 uF | `[SCHEMATIC-UNKNOWN]` |
| Diode | ideal Vf=0 and engineering Vf=0.7 V both simulated | `[INFERRED]` |
| CT / OCP reference | CT 1:100, R32=10 Ω => 0.1 V/A theoretical | `[SCHEMATIC]` |
| Comparator DAC | 10-bit, VDDA=3.3 V theoretical | `[SCHEMATIC]` |

### Theoretical OCP lines (uncalibrated)

```text
DAC300 -> Vth = 3.3*300/1024 = 0.9668 V -> Ip_th = 9.668 A
DAC320 -> Vth = 3.3*320/1024 = 1.0313 V -> Ip_th = 10.3125 A
```

> **Important**: `[MEASURED]` static IPRI voltage calibration has **not** been completed.
> These values are engineering estimates only and **must not** be treated as final OCP calibration.

---

## 3. Sanity check: pure-inductor upper bound

For a pure inductor with full Vin applied:

```text
di/dt = Vin / Lr = 24 / 3.385e-6 = 7.09 A/us
```

Time to reach theoretical thresholds:

| Threshold | Current | Time |
|---|---|---|
| DAC300 | 9.67 A | 1.36 us |
| DAC320 | 10.31 A | 1.45 us |

Compare with first half-period:

| Frequency | Half period | Dead-time |
|---|---|---|
| 150 kHz | 3.333 us | 0.6 us |
| 200 kHz | 2.500 us | 0.6 us |

`[INFERRED]` A pure inductor alone would exceed both theoretical OCP lines in the first half-cycle at both 150 and 200 kHz. The real LLC tank (Cr, Lm, transformer, rectifier) modifies this, but the upper-bound check shows the first-cycle current is inherently large in a cold start.

---

## 4. Time-domain model

### MODEL A (no secondary)

- Full-bridge square wave with dead-time
- Series Lr-Cr-Lm
- No secondary energy transfer

### MODEL B (with center-tap rectifier)

- Full-bridge square wave with dead-time
- Lr, Cr, Lm
- Ideal transformer n=1.25
- Center-tap full-wave rectifier
- Output capacitor Cout
- Diode model: smooth tanh transition + small on-resistance Rd=0.01 Ω; Vf=0 and 0.7 V cases
- No load (Rload=1e9) for cold-start first cycles

State vector:

```text
x = [i_Lr, v_Cr, i_Lm, v_out]
```

Solver: `scipy.integrate.solve_ivp`, method `LSODA`, `max_step=5 ns`, `rtol=1e-6`, `atol=1e-9`.

### Convergence check (150 kHz nominal, zero IC, Vf=0.7)

| max_step | peak_half | peak_cycle |
|---|---|---|
| 20 ns | 24.796 A | 31.397 A |
| 10 ns | 24.815 A | 31.397 A |
| 5 ns | 24.835 A | 31.397 A |
| 2.5 ns | 24.826 A | 31.397 A |

`[SIMULATED]` The first-cycle peak is stable to ~0.04 A between 5 ns and 2.5 ns; the smooth diode model is numerically converged for this report.

---

## 5. Main simulation results

### Nominal cold-start, zero initial conditions, Vf=0.7, Cout=940 uF

| Frequency | First half-cycle peak | First-cycle peak |
|---|---|---|
| 150 kHz | 24.83 A | **31.40 A** |
| 200 kHz | 16.66 A | **17.28 A** |

Both nominal cases cross both theoretical OCP lines in the model.

### Parameter / IC sweep worst case

| Metric | Value |
|---|---|
| Max 150 kHz first-cycle peak | 39.32 A |
| Max 200 kHz first-cycle peak | 19.33 A |
| Overall worst case | 39.32 A (150 kHz, vCr=-2 V, iLm=+0.5 A, iLr=+0.1 A) |

`[SIMULATED]` In this ideal low-loss model, **all** swept combinations cross both DAC300 and DAC320 theoretical lines.

---

## 6. Initial-condition sensitivity

Swept:

- `v_Cr(0)`: -2, -1, 0, +1, +2 V
- `i_Lm(0)`: -0.5, 0, +0.5 A
- `i_Lr(0)`: -0.1, 0, +0.1 A

`[SIMULATED]` The initial conditions change the first-cycle peak by several amperes. For example, at 150 kHz the peak ranges roughly 28–39 A across the swept IC grid. This is large enough that small residual energy after a “discharged” cold start could change whether a marginal hardware OCP line is crossed.

However, because the model predicts all cases cross the theoretical 9.7–10.3 A lines, IC sweep alone **cannot** explain why some real 200 kHz shots passed.

---

## 7. Parameter tolerance

Scanned single-variable and full 3×3×3×2 corner (Lr × Lm × Vin × f), plus Cout and Vf cases.

`[SIMULATED]` All corners cross the theoretical OCP lines. The spread is significant:

- 150 kHz first-cycle peak range: ~28–39 A
- 200 kHz first-cycle peak range: ~15–19 A

---

## 8. Answers to core questions

### Q1. 24 V / 150 kHz cold-start first-cycle theoretical Ipri peak

`[SIMULATED]` Nominal zero-IC model: **~31.4 A first-cycle peak** (~24.8 A in first half-cycle). Ideal low-loss model; real losses/parasitics will reduce this.

### Q2. 24 V / 200 kHz first-cycle peak reduction

`[SIMULATED]` Nominal first-cycle peak drops from **31.4 A at 150 kHz to 17.3 A at 200 kHz**, about **45% reduction**.

### Q3. Could it reach DAC300/DAC320 theoretical lines?

`[SIMULATED]` Yes, in this model the first-cycle current is far above both theoretical lines for essentially all swept conditions. But `[MEASURED]` some real 200 kHz shots did NOT trip, so the actual comparator/CT threshold must be higher than the uncalibrated 9.7–10.3 A estimate, or the first pulse is not the full ideal half-cycle in those shots.

### Q4. Why 200 kHz PASS / PASS / TRIP?

`[SIMULATED]` The nominal model predicts the 200 kHz first-cycle peak (~17 A) is still above the theoretical 10.3 A line, so it would predict **always trip**. It **cannot** explain the observed PASS/PASS/TRIP pattern with the current uncalibrated threshold.

`[INFERRED]` The most likely missing explanation is **uncontrolled first-pulse phase**: the firmware does not synchronize TBCTR to the OST release. Therefore the first actual PWM pulse can be shorter or longer than the nominal half-period, which changes the first-cycle current shot-to-shot. Another contributor is that the true OCP threshold is not yet statically calibrated.

### Q5. Why does increasing frequency reduce startup peak?

`[SIMULATED]` In the time domain:

- The first half-cycle is an inductor-dominated ramp for much of its duration.
- At 200 kHz the available on-time before commutation is 2.5 us vs 3.33 us at 150 kHz.
- Less time means the state trajectory travels less far along the resonant current ramp before the bridge reverses.
- The simulated first-cycle peak drops from 31.4 A to 17.3 A.

This is not simply “higher impedance”; it is a time-domain statement about the current slope and the shorter integration time before the next switching event.

### Q6. Reasonable software startup strategies (candidates only)

| Candidate | Benefit | Risk | Hardware evidence needed before approval |
|---|---|---|---|
| A: Higher starting frequency (e.g., 250/300 kHz) | Further reduces first-cycle ramp time | May approach practical minimum pulse/dead-time limits; unproven on this board | No-power first-pulse timing test; 250 kHz cold single-cycle with RUN_ID |
| B: Fixed 200 kHz but controlled first-pulse width | Removes shot-to-shot phase randomness | Requires firmware change to sync TBCTR / force first edge; more complex | NO-ENERGY_FIRST_PULSE_TIMING_TEST; repeatability with synchronized first pulse |
| C: Packet/burst start (short low-energy packets) | Limits energy per event; already direction of CAL_HOLD | More state machine complexity; still needs OCP margin | Static IPRI calibration; packet current measurement |
| D: Re-evaluate OCP threshold after real static calibration | May turn out 200 kHz has enough margin | Cannot be approved until static IPRI voltage calibration is done | IPRI_COMPARATOR_STATIC_CALIBRATION with actual injection |

---

## 9. First-pulse timing source-code review

`[SCHEMATIC]` / `[MEASURED-FROM-CODE]`

Reviewed current firmware paths:

- `PWM_Init()`:
  - Does **not** force `TBCTR = 0` before starting TBCLK.
  - AQ action: `ZRO = set`, `CAU = clear`.
  - Dead-band full enable, DBRED=DBFED=36.

- `SINGLECYCLE_SlowTask()`:
  - Arms EPWM1 INT on `CTR_ZERO`.
  - Releases OST and AQCSFRC low-force at the same time.
  - Does **not** write TBCTR, does **not** wait for a known TBCTR phase.

- `LLC_PWM_Enable()`:
  - Same issue: clears OST without synchronizing to TBCTR.

`[INFERRED]` Therefore the first actual PWM pulse after OST release is **phase-dependent**:

- If TBCTR is between 0 and CMPA at release, output A is already high and the first pulse ends at CMPA (partial width).
- If TBCTR is past CMPA, output A is low until the next ZRO, then a full CMPA-width pulse starts.
- This means the “first cycle” seen by the EPWM1 INT at next ZERO may include a partial first pulse, not a clean nominal half-cycle.

This is a strong candidate for the PASS/PASS/TRIP variability.

---

## 10. Proposed NO-ENERGY_FIRST_PULSE_TIMING_TEST (design only, not implemented)

Goal: prove the real digital first-pulse width.

Proposed capture:

- `TBCTR` at OST release
- First AQ event TBCTR (CMPA match or ZRO)
- First ZERO event
- First PERIOD event
- Scheduled OST TBCTR

Implementation options:

1. Use existing EPWM1 ISR and add diagnostic-only capture (firmware change deferred).
2. Use an eCAP module to capture EPWM1A edges with no power.
3. Use a second ePWM in loopback to timestamp edges.

No firmware changes are made in this task.

---

## 11. Unknowns and error sources

- `[SCHEMATIC-UNKNOWN]` Output capacitor total value is not confirmed; swept 470/940/1410 uF.
- `[MEASURED-MISSING]` Static IPRI comparator calibration was attempted but no external injection source was available; threshold remains theoretical.
- `[SIMULATED]` Model uses ideal transformer, smooth diode with Rd=0.01 Ω, no parasitic inductance/resistance, no source impedance, no PCB coupling, no body-diode dead-time details.
- `[INFERRED]` Real hardware losses and non-ideal CT will reduce the ideal simulated peaks; the model is useful for trend and sensitivity, not for absolute calibrated OCP prediction.

---

## 12. Final summary

| Item | Value |
|---|---|
| 150 kHz nominal first-cycle peak | 31.40 A `[SIMULATED]` |
| 200 kHz nominal first-cycle peak | 17.28 A `[SIMULATED]` |
| Worst-case peak (all sweeps) | 39.32 A `[SIMULATED]` |
| Crosses DAC300 theoretical line? | Yes, in all simulated cases `[SIMULATED]` |
| Crosses DAC320 theoretical line? | Yes, in all simulated cases `[SIMULATED]` |
| Most likely explanation of PASS/PASS/TRIP | Uncontrolled first-pulse phase + uncalibrated OCP threshold `[INFERRED]` |
| Next recommended experiment | NO-ENERGY_FIRST_PULSE_TIMING_TEST, then IPRI static calibration with real injection source |

---

## 13. Deliverables

- `analysis/llc_first_cycle_model_v1.py`
- `analysis/llc_first_cycle_model_v1.md` (this file)
- `analysis/llc_first_cycle_summary.csv`
- `analysis/plots/01_24v_150k_first_cycle_current.png`
- `analysis/plots/02_24v_200k_first_cycle_current.png`
- `analysis/plots/03_150k_vs_200k_peak.png`
- `analysis/plots/04_initial_condition_sensitivity.png`

---

**Status: `FIRST_CYCLE_MODEL_COMPLETE`**
