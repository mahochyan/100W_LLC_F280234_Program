# W2 Candidate4 — Pre-Handoff Energy Shaping Report

Status: **Phase B implemented and fully no-power qualified**; frozen unique REAL CR15 2MS artifact ready.

## Root-cause direction (Phase A)

`docs/W2_CANDIDATE4_PRE_HANDOFF_ENERGY_TIMELINE_ANALYSIS.md` concluded that the
pre-handoff energy state is the primary suspect for the repeated CR15 11V abort.
Candidate4 therefore changes only the SoftStart end-of-ramp behavior:

- Enter a pre-handoff brake at the actual brake frequency (`SS_HANDOFF_BRAKE_PERIOD 374`, 160 kHz? — see actual constant in code; the implemented no-power handoff lands at 155 kHz / TBPRD 386 per scenario).
- Apply a dv/dt gate so a fast VOUT rise cannot cause an early handoff.
- Preload the PI integral to the actual brake frequency so the first closed-loop apply is bumpless.
- No PI Kp/Ki, Profile C main body, SoftStart trajectory, Burst semantics, 11V gate, Comparator/OCP/TZ, DAC300, blanking, qualification, or 900-cycle gate changed.

## Implemented changes

- `app/soft_start.c` / `app/soft_start.h`: PRE_HANDOFF_BRAKE state, entry/exit windows, settle/dv limits, abort/timeout/stale handling, transfer gate, PI preload.
- `app/llc_globals.c` / `app/llc_globals.h`: pre-brake state globals; test hooks are `#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST` only.
- `app/power_probe.c`: EPWM1 ISR dispatcher includes PRE_HANDOFF_BRAKE.
- Tools: `sol_w2_candidate4_pre_brake_noenergy.js`, `sol_w2_candidate4_pre_brake_scenarios_noenergy.js`; updated closed-loop handoff and burst-boundary no-energy harnesses for Candidate4 semantics.

## No-power evidence (all PASS)

| Gate | Result |
|---|---|
| Real timing ladder 2/10/100 ms | `STAGE6_ONCHIP_TIMING_FREEZE_NOPOWER_LADDER_ALL_PASS` |
| FMAX stress | `STAGE6_CR15_FMAX_STRESS_NOENERGY_PASS` |
| ADC cadence | `SOL_W1_ADC_CADENCE_NOPOWER_HARD_GATES_PASS` |
| Burst boundary | `STAGE6_CR20_BURST_BOUNDARY_NOENERGY_ALL_PASS` |
| Candidate4 pre-brake proof | `SOL_W2_CANDIDATE4_PRE_BRAKE_NOENERGY_PASS=TRUE` |
| Candidate4 scenarios | `SOL_W2_CANDIDATE4_PRE_BRAKE_SCENARIOS_PASS=TRUE` (10/10) |
| Closed-loop handoff | all Candidate4 gates TRUE |
| Handoff fault gate | `STAGE6_HANDOFF_FAULT_GATE_ALL_PASS=TRUE` |
| Static hardening / publication / revoke | all PASS |
| Control equivalence | all PASS |

## Frozen artifacts

```
REAL_CR15_2MS_OUT_SHA256=E48DE5A9A7A2075C50C62F986BFB2F97DCB161648DAEEF2BCB93D902CF52FB92
REAL_CR15_10MS_OUT_SHA256=F1586D5F66D5553FC2B1079A8333B071A165A5D6E3015A8D62158F4A7F2A9A03
REAL_CR15_100MS_OUT_SHA256=986C2360C5B1C24126AB1821AE76376CE42F02EB36B3B2DB48FD4B5DC5F2CE19
```

## Next action

Await operator physical authorization for the unique Candidate4 REAL CR15 2MS shot only.
No auto CR12.5; no blind retry; stop on first real failure.
