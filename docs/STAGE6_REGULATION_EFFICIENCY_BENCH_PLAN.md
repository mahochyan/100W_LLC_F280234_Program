# STAGE6 Regulation / Efficiency Bench Plan

Status: **OFFLINE PREPARATION ONLY — NO POWER EXECUTED**
Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1-1`
Task: `STAGE6_1MS_LIGHT_LOAD_REAL_PI_SHOT_AND_BENCH_PREPARATION_V1`

This document only prepares the future voltage-regulation, load-regulation and
efficiency test plan. It does **not** authorize continuous closed-loop, high
power, OCP, thermal, or efficiency execution.

---

## 1. Measurement formulas

- Input power:
  \[
  P_{in} = V_{in} \times I_{in}
  \]
- Output power:
  \[
  P_{out} = V_{out} \times I_{out}
  \]
- Efficiency:
  \[
  \eta = \frac{P_{out}}{P_{in}} \times 100\%
  \]
- Voltage regulation (over input voltage range):
  \[
  V_{reg} = \frac{\max(V_{out}) - \min(V_{out})}{V_{nominal}} \times 100\%
  \]
- Load regulation (over load range):
  \[
  L_{reg} = \frac{\max(V_{out}) - \min(V_{out})}{V_{nominal}} \times 100\%
  \]

## 2. Planned test matrix (FUTURE ONLY — NOT AUTHORIZED NOW)

| Parameter | Points |
|---|---|
| Vin | 24 V, 30 V, 36 V |
| Load current (CC) | 0.10 A, 0.50 A, 1 A, 2 A, 4 A, 6 A, 8.3 A |
| Approximate power points | 1 W, 10 W, 25 W, 50 W, 75 W, 100 W |

These points are **planning only**. They must not be executed until all of the
following gates pass:

- Continuous closed-loop validation
- OCP / Comparator / TZ calibration
- Thermal / temperature rise qualification
- Explicit authorization for high-power bench work

## 3. Required measurements per run

Record at least:

- Timestamp
- Firmware SHA256
- Vin set / measured
- Iin
- Pin
- Vout DMM / Vout raw
- Iout
- Pout
- Efficiency
- Load mode / setpoint
- Frequency min / max / avg
- Fault flags
- TZ count
- Temperatures: ambient, MOS, transformer, Lr, rectifier
- Notes

See `STAGE6_REGULATION_EFFICIENCY_DATA_TEMPLATE.csv`.

## 4. Instrument capability checklist (to verify on site)

| Instrument | Minimum required | Recommended |
|---|---|---|
| Electronic load | 12 V / 10 A / 150 W | 20 A / 300 W |
| Input supply | 24–36 V / 6 A | 10 A |
| Input V/I meters | yes | external DMM/shunt |
| Output 4-wire voltage | yes | DMM |
| Output current | yes | DMM/shunt |
| Oscilloscope | yes | 2-ch + differential probe |
| Differential probe | yes | high-side safe |
| Current probe | yes | DC/AC |
| Temperature measurement | yes | thermocouple |

> Current 24 V / 0.5 A bench supply setting is only for the single 1 W
> light-load shot. It is **not** sufficient for 100 W efficiency testing.

## 5. Safety / stop rules

- No test may start without explicit authorization.
- No test may exceed the approved power/duration envelope.
- Any fault, TZ, overrun, smell, heat, or wiring issue → stop immediately.
- Keep PWM=0, OST=1, do not clear fault, do not retry, preserve evidence.
