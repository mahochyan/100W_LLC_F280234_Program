# STAGE6_TRANSFORMER_RECTIFIER_GAIN_DERIVATION

> Task: STAGE6_PHYSICAL_PLANT_MODEL_RECONCILIATION_V1 — directive D & E.
> Rigorous derivation of the LLC **Vout** DC-gain formula from topology.
> **No reverse-engineering to fit measured data.** Hardware Cr/Lr/Lm are NOT touched.

## 0. Topology under analysis

- Primary: full bridge, `Np = 5T`, switches drive the primary from `+Vin` to `-Vin`.
- Secondary: center-tap full-wave rectifier, `Ns1 = 4T`, `Ns2 = 4T`.
- `n = Np / Ns_half = 5/4 = 1.25`  (one half-winding carries each alternation).
- Output: `Cout` + resistive load `RL`.

## 1. Full-bridge primary square-wave fundamental

The primary port sees a square wave swinging `+Vin ↔ -Vin` (peak amplitude `Vin`,
peak-to-peak `2Vin`). Fourier fundamental:

```
A1 (peak)  = (4/pi) * Vin
V1 (RMS)   = A1 / sqrt(2) = (2*sqrt(2)/pi) * Vin = 0.9003 * Vin
```

A half bridge would produce `V1 = (sqrt(2)/pi)*Vin` (half the fundamental). So the
full bridge injects **2× the fundamental RMS** of a half bridge.

## 2. Turns ratio definition

Each center-tap half-winding carries exactly one alternation. The ratio between the
primary voltage and **one** conductive half-winding is

```
n = Np / Ns_half = 5/4 = 1.25
```

`Ns_total = 8T` is NOT the ratio of the conductive path (the two halves never conduct
simultaneously into a common series path). Using `n_total = 5/8` would overstate the
secondary voltage 4×. **Correct n = Np/Ns_half = 1.25.**

## 3. FHA M: where it lives

`M(f) = |Zm / (Zr + Zm)|`, `Zr = jωLr + 1/(jωCr)`, `Zm = jωLm ∥ Rac`,
`Rac = 8·n²·RL/π²`, is the **fundamental AC voltage gain** of the tank:
input = bridge fundamental `V1`, output = the fundamental voltage across the
primary-referred load branch `Zm`. It is **not** yet a DC gain; the rectifier and the
bridge fundamental add the conversion factor below.

## 4. Transformer ratio

The secondary half-winding fundamental voltage (per alternation):

```
Vs_half (RMS) = V1 * M / n
```

## 5. Full-wave rectification (center tap)

Full-wave rectification of a sinusoid of RMS `Vs` gives (ideal, resistive-average
convention, fundamental):

```
Vout = (2*sqrt(2)/pi) * Vs      k_rect = 2*sqrt(2)/pi = 0.9003
```

## 6. Combine — the full-bridge Vout formula

```
Vout = k_rect * Vs_half
     = (2*sqrt(2)/pi) * (V1 * M / n)
     = (2*sqrt(2)/pi) * ((2*sqrt(2)/pi)*Vin) * M / n
     = (8/pi^2) * Vin * M / n
     = 0.8106 * Vin * M / n
```

**Result (self-consistent full-bridge):** `Vout = (8/pi^2) * Vin * M / n`. There is
**no extra `/2`** beyond the `8/pi^2` factor.

## 7. Peak vs average — light-load peak-hold (directive E, F)

At light/no load the rectifier runs in **discontinuous / peak-hold** mode: the tank is
a quasi-current source and `Cout` rides the **peak** of the rectified secondary
instead of the resistive average. Then `Vout → sqrt(2)·Vs = (4/pi)·Vin·M/n`
(`0.8106→1.273` coefficient), i.e. the cap climbs **above** the resistive-average
steady value toward the open-load ceiling `Voc`. The 300us bench shots are exactly
this charging transient, **not** a steady resistive point. Both cases are physical;
they differ in the effective rectifier conduction factor.

## 8. Convention audit of the existing code (directive E)

| quantity | code | consistent | match? |
|---|---|---|---|
| primary fundamental `V1_rms` | `(2√2/π)·Vin` (full bridge) | `(2√2/π)·Vin` | OK |
| DC form coefficient on `Vin·M/n` | `1/(2n) = 0.5` | `8/π² = 0.8106` | **MISMATCH** |
| `n` | `Np/Ns_half = 1.25` | `1.25` | OK |

The code drives the tank with the **full-bridge** fundamental (`2√2/π`) but converts to
DC with the **half-bridge** `/(2n)` form. The consistent full-bridge DC form is
`/( (2√2/π)² ) = 0.8106`. The code is therefore **low by `0.5/0.8106 = 0.617`**
(≈1.62×) in the steady full-bridge FHA.

## 9. Conclusion (directive D, E)

- `n = Np/Ns_half = 1.25` is the correct turns ratio; using `Ns_total` is wrong.
- The consistent full-bridge DC gain is `Vout = (8/π²)·Vin·M/n - Vf`; **no extra /2**.
- The code's `Vout = Vin·M/(2n)` mixes a full-bridge `V1` with a half-bridge DC form →
  a **factor-2-of-the-full-bridge factor convention error** that LOW-predicts steady
  Vout (~1.63×).
- At light/no-load the benchmark must be `MODEL_H_CHARGE` (peak/charge), not the
  steady resistive FHA; that additional gap explains the ~20-30% real-vs-MODEL_A
  deviation together with the convention factor.

> Keep firmware untouched. `LLC_HARDWARE_PI_VALIDATED=0`, `NO_REAL_POWER_EXECUTED`.
> PI SIL frozen until `MODEL_HARDWARE_CONSISTENCY_PASS`.
