# W2_CONTROL_REGION_REDESIGN_V1 — Control Region Redesign Report

Status baseline: `LOAD_BOUNDARY_CHARACTERIZATION_PASS`
(`CONTINUOUS_PFM_PLANT_RANGE_MISMATCH`), Vin=24V, Vref=10V,
CR15/CR12.5/CR10/CR7.5, production continuous-PFM envelope 145–170 kHz
(frozen), PI/Burst/SoftStart frozen, all safety mechanisms frozen.

Phase-1 scope honored: design + host/NE model + no-energy verification ONLY.
**No real Burst firing in this work order.** The REAL build semantic delta is
zero (all additions are inside
`#if STAGE6_OPEN_LOOP_STEADY_BUILD && STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST`;
`burst_region.c` is in the NE build list only).

Evidence: `burst_region_ne_r5.log` (21 PASS / 0 FALSE),
`ne_harness_console9.log` (OL regression PASS=TRUE, 0 FALSE),
`build_ne_burst_r4.log` (`=== BUILD OK`).
NE instance frozen:
`NE_OPEN_LOOP_STEADY_OUT_SHA256=4A2215CEDEE09F405FD51BCAD6DDC9AFC19E5655B9F74F37E1EFC77C300753BC`.

Label discipline: **MEASURED** = a bench observation with an evidence pointer;
**INFERRED** = a logical consequence of MEASURED items, labeled; **PROPOSED**
= a design value awaiting verification.

---

## 1. Corrected physics conclusions

All corrections are executed in
`W2_OPEN_LOOP_STEADY_PLANT_CHARACTERIZATION_REPORT.md` §15–§17 (the retraction
ledger). Key corrected statements:

- fr ≈ 49.9 kHz series resonance stands (from actual Lr/Cr) [MEASURED design
  parameter]. 150–190 kHz is the current real-board high-frequency regulation
  region. Any observed knee would be an "apparent gain knee /
  regulation-region feature" [PROPOSED terminology].
- The 190 kHz experiments prove only: natural Vout(190 kHz) > 10.49 V, hence
  **M_eff(190 kHz) > 1.093** at CR15/CR12.5/CR10/CR7.5 [MEASURED, lower
  bounds]. No point estimate is claimed.
- The 10 V continuous-PFM operating point, **if it exists, lies above the
  authorized 190 kHz characterization ceiling** [INFERRED from the lower
  bounds + the MEASURED direction frequency↑→output↓]. No location estimate.
- The 190 kHz crossings are escape-proven (slew 5000): the cap charges toward
  natural(190 kHz) alone [MEASURED method; the crossing genuineness follows].
- The earlier "150k→170k gain rising" claim is RETRACTED (mixed-anchor
  over-inference); the MEASURED direction (frequency↑→output↓) stands. The
  150 k/10.02 V anchor is a closed-loop-era equilibrium under different
  conditions — requires a same-condition re-measurement before reuse
  (currently blocked in-band by the frozen WARNING guard for these loads).
- The rectifier drop is NOT accepted as an explanation of any FHA-vs-bench
  gap [RETRACTED]; its magnitude on this board is OPEN.
- Burst-ownership scope: Vin=24 V, Vref=10 V, CR7.5..CR15, f∈[145k,190k] ONLY.
  Not a product-wide Burst region.

## 2. PFM / Burst region control diagram

```
                     Vref (10 V / 12 V / 15 V - generic, host-set)
                                |
   SOFT_START --handoff eval--> |   (Vout, Vref, freq authority, dVout/dt)
        |             +---------+-----------+
        |             v                       v
        |        RUN_PFM  <-----------  BURST_PREP
        |     (continuous PFM,             | entry armed when:
        |      fine regulation)            |  freq_command >= FMAX
        |                                  |  AND Vout > Vref+V_ENTRY_HYST
        |  return: freq_command < FMAX     |  AND N fresh samples
        |  sustained M samples             |  AND min RUN dwell elapsed
        |  AND Vout NOT below packet band  v
        +---------------------------->  BURST_ON   (P cycles @ safe fixed freq)
                                        |  packet done
                                        v
                                     BURST_OFF  (coast; PWM off)
                                        |  Vout < Vref-V_EXIT_HYST -> next packet
                                        |  Vout in dead band  -> hold coast
                                        |  (freq<Fmax sustained -> return RUN_PFM)
        (any fault -> FAULT; frozen safety semantics unchanged)
```

The region boundary is generated naturally by **Fmax saturation + voltage
error** — never by a load ID or an absolute Vout threshold [PROPOSED
mechanism, NE-verified]. This is what makes the same controller support
Vref = 10 V / 12 V / 15 V without three hard-coded regimes.

## 3. SoftStart handoff logic (redesigned)

SOFTSTART end no longer mechanically routes to continuous-PFM RUN. A one-shot
handoff evaluation reads real signals only:

- Inputs: Vout (fresh), Vref, frequency authority (command vs Fmax), dVout/dt.
- `freq_command >= FMAX AND Vout > Vref+V_ENTRY_HYST AND dVout/dt > 0`
  → `BURST_PREP` → Burst.
- otherwise → `RUN_PFM`.
- SoftStart needs to know NOTHING about CR15/CR10/CR7.5 [PROPOSED logic;
  NE-verified both branches, S-B7].

REAL binding (Vout from the fresh ADC, dVout/dt from the filtered delta,
frequency authority from the PI request) is the next work order's integration
step.

## 4. Burst entry / exit criteria

- **Entry candidate**: `freq_command >= FMAX AND Vout > Vref + V_ENTRY_HYST
  AND condition sustained N fresh samples AND min RUN dwell elapsed`
  [PROPOSED; NE-verified S-B1/S-B3/S-B2].
- **Burst packet loop**: ON for `packet_cycles` switching cycles at the fixed
  safe frequency → OFF coast → re-emit only when `Vout < Vref − V_EXIT_HYST`;
  hold OFF in the dead band [PROPOSED; NE-verified S-B4/S-B5].
- **Return to RUN_PFM**: `freq_command < FMAX` sustained `M` samples AND Vout
  not below the packet band (packets have priority while the envelope demands
  energy — a deliberate hysteresis on the mode boundary) [PROPOSED;
  NE-verified S-B2].
- **Fault passthrough**: any `g_fault_flags != 0` → `FAULT` immediately;
  recovery to RUN_PFM only after the faults clear and the host re-enables
  [PROPOSED; NE-verified S-B8]. The frozen safety semantics are untouched.

## 5. Hysteresis design

- `V_ENTRY_HYST = 25 raw (~0.20 V)`, `V_EXIT_HYST = 25 raw (~0.20 V)`
  [PROPOSED]. Dead band `[Vref−0.20 V, Vref+0.20 V]` holds the current mode
  (no flapping) [PROPOSED; NE-verified S-B4].
- Rationale for the size: the steady-state 10 V window used in the load
  ladder was ±0.1 V [MEASURED protocol]; 0.20 V sits above the observed
  ripple/statistics scale while remaining well below the WARNING guard
  margin at 10 V [INFERRED from the same data]. The real-plant tuning is
  explicitly deferred to the packet-characterization work order.

## 6. Persistence design

- `entry_persist_n = 25 fresh samples` (~0.5 ms at the 20 µs NE tick; ~0.4 ms
  at the real fresh-ADC cadence) — the raw entry condition must hold on
  CONSECUTIVE fresh samples; any drop resets the counter [PROPOSED;
  NE-verified S-B1 (positive) and S-B2 (negative, via a scaled parameter)].
- Telemetry: `g_br_persist_max` (the live accumulation peak, reset with the
  condition) gives the real-system tuner direct visibility of how close the
  plant rides the entry boundary [PROPOSED, implemented].

## 7. Minimum dwell design

- `min_run_dwell_ticks = 2500` (~50 ms) per RUN_PFM episode: Burst entry
  cannot arm before the RUN episode has dwelled [PROPOSED; NE-verified S-B3].
- Purpose: prevent the SoftStart tail / post-handoff transient from arming
  Burst. Re-armed on every RUN entry, including Burst→RUN returns.
- `run_pfm_return_n = 500` (~10 ms) symmetrically debounces the Burst→RUN
  return [PROPOSED; NE-verified S-B2].
- Note (NE-test-only): `entry_persist_n` is host-writable BY DESIGN; the NE
  suite scales it to prove the gate mechanism. Production values are the
  defaults above and are not changed by any test.

## 8. Packet characterization test plan (next work order, design only)

`W2_BURST_PACKET_CHARACTERIZATION_V1` — goal: measure the energy ONE safe PWM
packet injects into the output capacitor. NOT closed-loop; NOT a long Burst
first shot.

- **Binary discipline**: a fresh REAL instance (the Burst packet actuator
  compiled in) → new commit + new REAL SHA + the full proof chain (static
  audit → NE → no-energy → real hardware) BEFORE any firing. The current
  on-disk REAL .out is an UNAUDITED rebuild instance and must not be fired.
- **Per-firing protocol**: one packet per session; operator gates (the same
  six + the load confirmation); start from the takeover trajectory (the
  cap at ~5.83 V); fire packet_cycles cycles at the safe packet frequency;
  **every firing ends with PWM OFF + OST=1**; evidence snapshot identical to
  the load-boundary stop snapshots.
- **Ladder**: P = 1, 2, 3, 5 cycles [PROPOSED order — minimal first]. Any
  fault-family event → hard stop, no retry at that P.
- **Recorded per firing**: packet_cycles, packet_frequency, Vout_before,
  Vout_after, delta_Vout, IPRI (0 + deferred flag), COMP/TZ events, fault
  flags, coast_decay (Vout decay sampled post-packet over a fixed window),
  load R, Vin.
- **Energy model**: `delta_E ≈ C_out × V_before × delta_V` [PROPOSED first
  order]; refined by fitting the coast_decay exponential (yields the
  effective C_out×R_load product) [INFERRED once two loads are measured].
- **Operator checklist deltas**: the resistor rating and the PSU limit per
  the load used; the packet fires are millisecond-scale — thermal stress is
  minimal [INFERRED].

## 9. 10 V vs 12 V region difference + the 12 V sanity plan (design only)

- **Difference**: at Vref=10 V the CR7.5–CR15 map is EMPTY for continuous
  PFM in-band [MEASURED lower bounds]. At Vref=12 V NOTHING is known: the
  190 kHz lower bound (>10.49 V) does not bound the 12 V behavior; since the
  gain falls with frequency [MEASURED direction], a 12 V natural point may
  exist in-band — or may not. The region controller needs no change (Vref is
  generic, NE-verified at 12 V, S-B6); the PLANT question is open.
- **CRITICAL blocker (honest)**: the frozen guards WARNING=1304 (10.49 V) /
  HARD=1367 (11.0 V) are BELOW a 12 V target — any real 12 V attempt would
  trip them by construction. A 12 V characterization therefore REQUIRES a
  separately authorized guard requalification work order first. It is NOT
  proposed casually and is NOT executed in this work order.
- **12 V sanity plan (design only, per work order section 8)**: Vin=24 V,
  Vref=12 V, at least CR15 and CR10; the load-boundary protocol shape
  (190 kHz first, descent, bisection) reused with the requalified guards;
  prerequisites: guard requalification + the PSU/thermal checklist per load.
  **Not executed without explicit approval.**

## 10. Parameters still unknown

| item | state | how to close |
|---|---|---|
| Lr / Lm actual values | unknown [OPEN] | user-side LCR / ring-down bench measurement |
| output rectifier drop magnitude | unknown [OPEN] | packet characterization + a diode-drop bench check |
| same-condition open-loop gain curve in-band | unknown [OPEN, blocked by the frozen WARNING guard at CR7.5–CR15 for Vref=10V] | guard requalification work order (operator decision) |
| natural Vout(>190 kHz) behavior | unmeasured [OPEN] | out of every authorized envelope; not pursued |
| C_out effective value | unknown [OPEN] | coast_decay fit in the packet work order |
| per-cycle packet energy | unknown [OPEN] | the packet work order's primary deliverable |
| Burst thermal behavior at CR7.5–CR15 | unmeasured [OPEN] | the packet ladder + later closed Burst |
| PI behavior at Fmax saturation on the real bench at these loads | INFERRED from the architecture, unproven | the packet work order's pre-Burst observation |
| IPRI telemetry | DEFERRED [MEASURED limitation] | user-side analog-chain check; zero software change needed |

---

## Final status

## **CONTROL_REGION_REDESIGN_READY_FOR_BURST_CHARACTERIZATION**

Delivered: corrected physics (§17 ledger), the region diagram, the handoff
logic, entry/exit criteria, hysteresis/persistence/dwell designs, the packet
characterization plan, the 12 V sanity plan (design-only, with its frozen-guard
blocker stated), and the unknowns ledger. The Burst region model is
NE-verified (21/0) and the OL/protection regression is clean (0 FALSE).
No real Burst was fired; no production envelope/protection parameter changed;
the REAL semantic delta is zero. Recommended next step: freeze and prove a
fresh REAL instance, then execute `W2_BURST_PACKET_CHARACTERIZATION_V1`
starting from the 1-cycle packet.