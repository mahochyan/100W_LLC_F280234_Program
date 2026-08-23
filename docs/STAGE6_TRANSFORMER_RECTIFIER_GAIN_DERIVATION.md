# STAGE6_TRANSFORMER_RECTIFIER_GAIN_DERIVATION

> Task: STAGE6_PHYSICAL_PLANT_MODEL_RECONCILIATION_V1_1 — directives D & E (and F, G).
> Rigorous derivation of the LLC **Vout** DC-gain formula from topology.
> **No reverse-engineering to fit measured data.** Hardware Cr/Lr/Lm are NOT touched.
> Supersedes the b484999 derivation (that doc's `8/pi^2` DC factor is now
> `SUPERSEDED_CONVENTION` — see below).

## 0. Topology under analysis

- Primary: full bridge, `Np = 5T`, drives the primary from `+Vin` to `-Vin`.
- Secondary: center-tap full-wave rectifier, `Ns1 = 4T`, `Ns2 = 4T`.
- `n = Np / Ns_half = 5/4 = 1.25`.
- Output: `Cout` + resistive load `RL`.

## 1. Full-bridge primary fundamental

The primary port sees a square wave `+Vin ↔ -Vin` (peak amplitude `Vin`).

```
V1 (RMS) = (2*sqrt(2)/pi) * Vin
```

A half bridge would be `(sqrt(2)/pi)*Vin` (half). The full bridge injects 2× the
half-bridge fundamental.

## 2. Turns ratio

`n = Np/Ns_half = 1.25` (each half-winding carries one alternation).
**`Np/Ns_total = 5/8 = 0.625` would be a 2× turns-ratio (voltage) error, not 4×**
(1.25 vs 0.625 → ratio 2). Correct `n = Np/Ns_half = 1.25`.

## 3. FHA M and the secondary rectified square wave (directive E)

Input fundamental to the tank: `Vi1_rms = (2*sqrt(2)/pi)*Vin`.

The output rectifier + `Cout` in FHA is represented as a secondary **square wave**
`±(Vout+Vf)`. Its fundamental RMS is

```
Vo1_sec_rms = (2*sqrt(2)/pi) * (Vout + Vf)
```

Reflected to the primary:

```
Vo1_pri = n * Vo1_sec_rms
```

The FHA tank gain `M = |Zm/(Zr+Zm)|` is exactly the ratio of these two fundamental
amplitudes:

```
M = Vo1_pri / V1 = n * (Vout+Vf) / Vin
```

Inverting:

```
Vout + Vf = Vin * M / n
Vout      = Vin * M / n - Vf
```

**This is the full-bridge DC gain.** There is **no extra factor** in the DC
conversion.

## 4. Full bridge vs half bridge

```
FULL BRIDGE : Vout = Vin * M / n - Vf
HALF BRIDGE : Vout = Vin * M / (2*n) - Vf
```

`8/pi^2` appears only inside the **AC-equivalent relations** (`Rac = 8 n^2 RL / pi^2`
and the fundamental/rms conversion of the waveforms). Once you use `Rac = 8n^2 RL/pi^2`
and the above `M` definition, multiplying the DC gain by `8/pi^2` again is a
**double conversion** and must NOT be done.

> The b's `Vout = (8/pi^2) * Vin * M / n` was exactly that double conversion →
> **SUPERSEDED_CONVENTION**, and it also broke the resonance unit check (below).

## 4. Resonance unit sanity check (directive D)

At `f = fr`: `Zr ≈ 0`, `M ≈ 1`, so a full bridge must give

```
Vout_ideal ≈ Vin/n - Vf
```

For `Vin = 24, n = 1.25, Vf = 0.7`:  `24/1.25 - 0.7 = 18.5 V`.

`8/pi^2` would give `0.8106*19.2 - 0.7 = 14.86 V` (in the forbidden 14-15 V band),
which is why it is rejected. **FULL_BRIDGE_RESONANCE_GAIN_SANITY_PASS** requires the
`1.0` factor.

## 5. Peak vs average / light-load peak-hold

At light/no-load the rectifier runs in peak-hold/DCM and the cap rides the **peak**
of the rectified secondary, climbing toward the open-load ceiling `Voc = Vin*M/n-Vf`.
The 300us bench shots are this charging transient, reproduced by
`MODEL_H_CHARGE` (directive H/I), not a steady resistive FHA point.

## 6. Convention audit (directive E, G)

| quantity | correct | code (b484999 OLD) | V1_1 |
|---|---|---|---|
| `n` | `Np/Ns_half = 1.25` | 1.25 (OK) | 1.25 (OK) |
| full-bridge DC factor on `Vin*M/n` | `1.0` | `0.5` (half-bridge form) | `1.0` |
| `V1_rms` | `(2sqrt2/pi)*Vin` | OK | OK |
| VOUT calibration | `0.008089325` / `-0.063715` (board_calibration.h) | typo `0.0084896` | parsed from board_calibration.h |

The `0.5` factor (half-bridge DC form on a full-bridge tank) and the `8/pi^2` factor
are both **superseded**; the correct full-bridge DC factor is `1.0`.

> Keep firmware untouched. `LLC_HARDWARE_PI_VALIDATED=0`, `NO_REAL_POWER_EXECUTED`.
> PI SIL frozen until `MODEL_HARDWARE_CONSISTENCY_PASS_V1_1`.
