# W2_BURST_PACKET_CHARACTERIZATION_V1 — Protocol & Pre-Fire Checklist

Authoritative resume point: `docs/SOL_MASTER_EXECUTION_STATE.md`
Work order scope: **characterize what an exact 170 kHz packet injects into the
output**. This is NOT Burst closed-loop implementation.

## 1. Goal (what this order answers)

For a real CR15 (≈6.67 W @ 10 V, lightest load) at Vin = 24 V:

- How much output-side energy does an exact **170 kHz / DB36 / 50%-duty** PWM
  packet of 1, 2, 3, and 5 cycles inject?
- What ΔVout does each packet cause?
- What is the effective output capacitance / coast decay after the packet?

Deliverables: `READY_FOR_BURST_PACKET_1C` (operator handoff), then after each
shot an audit, then final
`BURST_PACKET_CHARACTERIZATION_PASS_CR15` or
`BURST_PACKET_CHARACTERIZATION_BLOCKED`.

## 2. Frozen parameters (must not be modified in this order)

| Parameter | Value / rule |
|---|---|
| Packet frequency | **170 kHz fixed** (190 kHz forbidden as packet default) |
| Dead-time | DBRED = DBFED = **36** |
| Duty structure | 50% via MULTICYCLE `LLC_SetFrequencyHz` -> TBPRD=352, CMPA=176 |
| Packet cycles | exactly {1, 2, 3, 5}; no 10/20/50 automatic ladder |
| PI/Burst/SoftStart | NOT entered; packet layer does not call PI or adaptive logic |
| Dynamic dead-time / adaptive packet | forbidden |
| Comparator/TZ | COMP1A -> TZ armed throughout; no guard relaxation |
| VOUT WARNING | 1304 raw (≈10.49 V); HARD 1367 raw (≈11.0 V) — unchanged |
| ADC stale / OVF / protection | frozen; do not bypass |
| IPRI | deferred; report `PRIMARY_CURRENT_NOT_YET_QUANTIFIED` |

## 3. Proven chain already completed (NE)

- `BURST_PACKET_NE_VERIFICATION_PASS=TRUE` (`burst_packet_ne_r3.log`)
  - Exact 1/2/3/5 cycles: result PASS, completed cycles exactly N
  - 0C and 6C rejected before engine
  - fault-before-packet rejected
  - no-request no-fire
  - mid-packet fault -> abort, result FAULT, PWM=0/OST=1
  - TBPRD=352, CMPA=176, DB=36, actual freq ≈169,971 Hz
  - control Fmax authorization and SoftStart/COMP authority unchanged
- Regression:
  - `SOL_W2_OPEN_LOOP_STEADY_NOENERGY_PASS=TRUE`
  - `BURST_REGION_NE_VERIFICATION_PASS` (PASS=21 FALSE=0)

## 4. REAL instance identity (frozen once)

REAL v2.5 is the current authorized instance for 1C. It adds the
`g_open_loop_stop_on_takeover` flag: the firmware performs a planned stop at
the SoftStart/OL takeover instant (~176.47 kHz / ~5.83 V) before any in-band
slew, which is required so the 1C packet is not glued to the SoftStart tail.

- Whole-file SHA256 (physical instance):
  `ef607cce24b8399632538e40e9b93c44586f1c0d2140e496c1010c38a9db961d`
- Loadable-image HEX SHA256 (semantic fingerprint):
  `d1e25b217a1085afa9414c39535ef5b4e70c5f2147918835ae0017cfbf7ac914`
- CGT: `25.11.1.LTS`
- Build log: `evidence/sol_master_execution/w2_open_loop_steady/build_real_packet_v2.5_stop_on_takeover.log`
- Map: `evidence/sol_master_execution/w2_open_loop_steady/LLC_100W_F28034_OPEN_LOOP_STEADY_REAL_v2.5_stop_on_takeover.map`
- NE whole SHA: `39f79c14d464254323c2d1e1269425be140e5e752f8d38fbc7b03db7bc64a7fe`
- NE HEX SHA: `3bc6ba07637f5ccc53d961982a6b17f772473b8b1e2e6ee0feb063cd77433384`
- NE S10B proves stop-on-takeover: takeover_done=1, stop_reason=1, sys=IDLE,
  PWM=0/OST=1/TZINT=0, inactive.

No other REAL rebuild/impersonation is permitted for this order.

## 5. Pre-fire environment checklist (operator)

Check all before any shot:

- [ ] Branch `stage6/sol-one-shot-to-100w-v1`, REAL v2.5 frozen (SHA in section 4); operator has approved the v2.5 identity
- [ ] `DSH_*` environment set as required by session
- [ ] `DSH_LOAD_OHM` and `DSH_LOAD_OHM_CONFIRMED` set for **CR15**
- [ ] Vin = **24 V**, PSU input current limit = **0.5 A**
- [ ] CNT3 / CNT4 connected (operator present)
- [ ] COMP1A -> TZ1 loopback verified (real hardware path)
- [ ] Output pre-charge strategy: use proven SoftStart/OL takeover plateau
      around **~5.83 V (raw ~727)** as `READY_FOR_BURST_PACKET_1C` start;
      do NOT fire near 10.49 V WARNING in the first round
- [ ] Record `Vout_before` before each shot
- [ ] Do not relax VOUT guard; any WARNING/HARD = immediate stop ladder
- [ ] External USB scope / IPRI optional; if used, record channel/timebase

## 6. Firing order (strict cold-state sequence)

No auto-consecutive four shots. Each shot is an independent cold-state
experiment:

1. **1 cycle** -> audit -> `READY_FOR_BURST_PACKET_2C`
2. **2 cycles** -> audit -> `READY_FOR_BURST_PACKET_3C`
3. **3 cycles** -> audit -> `READY_FOR_BURST_PACKET_5C`
4. **5 cycles** -> audit -> final report

Hard stop = PWM OFF + OST=1, not host/JTAG-timed.

### Per-shot safety stops (immediately end this load's ladder)

Any of: COMP/TZ trip, VOUT WARNING/HARD, ADC stale/OVF, realtime overrun,
PWM config mismatch, unplanned OST, PSU limit intervention, manual stop.

No auto retry. Final state must be PWM=0 / OST=1 / TZINT=0 (unless the stop
itself was a TZ event, then record it).

## 7. Measurements to record per shot

- `Vout_before` (just before arm)
- immediate after packet end (`g_burst_packet_vout_immediate`)
- peak (`g_burst_packet_vout_peak`)
- 100 µs / 500 µs / 1 ms post-packet Vout
- `g_burst_packet_completed_cycles`, `g_burst_packet_result`,
  `g_burst_packet_stop_reason`, `g_burst_packet_pwm_end_ost`
- If repeatability poor, normalize ΔVout by actual `Vout_before`

Distinguish true injection ΔV from post-packet LC/ADC transient; do not define
final ΔV at the first ADC point after packet end.

## 8. Coast decay / Ceff

Use multi-point fit:

```
V(t) ≈ V0 * exp(-t / (R * Ceff))
Ceff = Δt / (R * ln(V1/V2))
```

Label as MEASURED or ESTIMATED.

## 9. Energy formulas (output-side only)

```
ΔE_cap = 0.5 * Ceff * (V_after^2 - V_before^2)
E_load = ∫ Vout^2 / R dt
E_packet_to_output ≈ ΔE_cap + E_load
cross-check: C * V * ΔV
```

Do NOT include MOS/transformer/input energy in this report.

## 10. Final status rules

- Only `BURST_PACKET_CHARACTERIZATION_PASS_CR15` or
  `BURST_PACKET_CHARACTERIZATION_BLOCKED` may be emitted.
- If PASS, recommend `W2_BURST_ENVELOPE_CONTROL_V1`.
- IPRI deferred -> also report `PRIMARY_CURRENT_NOT_YET_QUANTIFIED`.
- Stale-freq Burst→RUN path remains `OPEN_CONTROL_DESIGN_QUESTION`; not in REAL.
