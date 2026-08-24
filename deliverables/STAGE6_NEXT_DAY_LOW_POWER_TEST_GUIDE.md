# STAGE6 Next-Day Low-Power Regulation & Efficiency Test Guide (K)

Status: TEMPLATE — execute only after stage J (12 V / 10 s) passes on-site.

## 0. Authorization gate (all must hold before powering anything)

- [ ] Stage J (12 V / 10 s) passed; `12V_REGULATION_LAB_60S` prepared (J).
- [ ] CNT3 + CNT4 connected; Vin = 24 V supply, current limit set to 0.5 A.
- [ ] DMMs/external meters wired: Iin (input shunt), Vin, Vout, Iout.
- [ ] Light load attached: target ≈ 1 W per the day's load plan.
- [ ] No smell / heat / wiring issues on visual inspection.
- [ ] Operator present; abort switch within reach; run duration capped (see §4).

If any gate fails → STOP, do not run.

## 1. Scope (hard limits — do not exceed)

| parameter | allowed | not allowed |
|---|---|---|
| load | 1 W / 3 W / 5 W / 10 W (resistive light load) | 25 W / 50 W / 75 W / 100 W / overload / short / continuous temp rise |
| input | Vin = 24 V, Iin limit 0.5 A | > 0.5 A input |
| duration | ≤ 60 s per run, then cooldown | repeated back-to-back without cooldown |
| output | target ~10 V or ~12 V regulation window per the active stage profile | > 11 V during 10 V stages; > 12 V target during 12 V stages; hard ceiling 13.0 V |

## 2. Per-run procedure

1. Confirm FASTPATH ready (PWM off, OST latched, fault=0, TZ verified).
2. Start the formal request (no DSS polling; the on-chip machine runs alone).
3. Observe: no smell/heat, no arc, no audible ringing, Vout stays in window,
   Iin stays under the limit.
4. Auto OST stops the run; record fault flags, TZ, ADC stale, ISR max, overrun,
   temperature (if a probe is fitted) from the summary block.
5. Wait ≥ 60 s cooldown between runs.

## 3. Measurements (external meters)

- Pin = Vin × Iin (external meters), Pout = Vout × Iout, eff = Pout / Pin.
- Frequency envelope: f_min / f_max / f_avg over the run (firmware summary).
- Load regulation: step the electronic load between the allowed points and
  record Vout (µs/ms settling, overshoot).
- Line regulation at fixed load: 22 V / 24 V / 26 V if the supply allows.

## 4. Duration limits

- 1 W / 3 W / 5 W / 10 W: ≤ 60 s per run, ≥ 3 runs, ≥ 3 min cooldown between.
- No continuous temperature-rise soak test (thermal limits not characterized).

## 5. Data to keep

Append one row per run to `STAGE6_REGULATION_60S_CSV_TEMPLATE.csv`:
Vin, Iin, Vout, Iout, Pin, Pout, efficiency, load, frequency_min, frequency_max,
frequency_avg, fault, TZ, ADC_stale, ISR_max, overrun, temperature, notes.

## 6. Stop criteria

Any of: fault ≠ 0, TZ active ≠ 0, ADC stale ≠ 0, ISR max > 900, overrun ≠ 0,
sustained clamp at 145 k or 170 k, Vout ≥ 11 V in 10 V stages, Vout ≥ 12.8 V in
12 V stages (fast abort) or ≥ 13.0 V (hard ceiling), smell/heat/wiring issue,
or operator judgement. On stop: keep fault state, do NOT auto-retry, do NOT
extend duration.
