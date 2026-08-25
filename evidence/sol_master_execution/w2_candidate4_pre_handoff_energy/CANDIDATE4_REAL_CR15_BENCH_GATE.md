# Candidate4 REAL CR15 Bench Gate

Status: **READY_FOR_CANDIDATE4_UNIQUE_CR15_REAL_2MS** — awaiting operator physical authorization.

## Frozen unique real 2MS artifact

- Binary: `nopower_real_binaries/LLC_100W_F28034_BRINGUP_DSH_REAL_CR15_2MS.out`
- Map: `nopower_real_binaries/LLC_100W_F28034_BRINGUP_DSH_REAL_CR15_2MS.map`
- SHA-256: `E48DE5A9A7A2075C50C62F986BFB2F97DCB161648DAEEF2BCB93D902CF52FB92`
- Duration: 2 ms bounded real PI shot (120000 cycles)
- Real ladder semantics: unique new-SHA 2MS only; no auto CR12.5; no blind retry; stop on first failure.

## No-power qualification summary (all PASS for Candidate4)

- Timing ladder 2/10/100 ms: `STAGE6_ONCHIP_TIMING_FREEZE_NOPOWER_LADDER_ALL_PASS`
  - 2MS compute 849 / apply 861 / active 861 / shutdown 557
  - 10MS compute 838 / apply 850 / active 850 / shutdown 546
  - 100MS compute 841 / apply 879 / active 879 / shutdown 552
  - overrun 0, PWM 0, OST 1, fault 0
- FMAX stress: `STAGE6_CR15_FMAX_STRESS_NOENERGY_PASS`
- ADC cadence: `SOL_W1_ADC_CADENCE_NOPOWER_HARD_GATES_PASS`
- Burst boundary: `STAGE6_CR20_BURST_BOUNDARY_NOENERGY_ALL_PASS`
- Candidate4 pre-brake proof: `SOL_W2_CANDIDATE4_PRE_BRAKE_NOENERGY_PASS=TRUE`
- Candidate4 pre-brake scenario suite: `SOL_W2_CANDIDATE4_PRE_BRAKE_SCENARIOS_PASS=TRUE` (10/10)
- Closed-loop handoff noenergy: `STAGE6_FORMAL_SOFTSTART_PATH_PASS=TRUE`, `HANDOFF_PWM_STATE_OK=TRUE`, `BUMPLESS_150K_CONTROL_STATE_PASS=TRUE`, `FIRST_CLOSED_LOOP_SAMPLE_BUMPLESS_PASS=TRUE`, `HANDOFF_PI_PWM_WRITE_GATE_LOCKED_PASS=TRUE`
- Handoff fault gate: `STAGE6_HANDOFF_FAULT_GATE_ALL_PASS=TRUE`
- Static hardening / publication order / pending revoke: all PASS
- Control equivalence: fixed-profile sync, period exhaustive, CMPB, fastpath all PASS

## Physical authorization requirements

- Only operator authorization for the unique real CR15 2MS shot is requested.
- CR15 load remains connected; bench safety maintained; do NOT re-ask discharge.
- If the real shot fails any gate: stop, do not retry, do not auto CR12.5.
