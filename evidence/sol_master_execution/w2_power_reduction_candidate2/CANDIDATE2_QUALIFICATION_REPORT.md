# W2 Power-Reduction Candidate 2 Qualification

Source commit: `4a66c786c2abac98939cdc888489a4b465b398ff`

## Change

The single control change raises bounded-shot power-reduction slew from
`+500` to `+1000 Hz` per fresh compute. Power-increase authority stays
`-100 Hz`; PI coefficients, 145..170 kHz envelope, Burst semantics, SoftStart,
11 V abort and every protection threshold are unchanged.

Attempt-1 endpoint replay through the exact Q12 algorithm gives 156546 Hz at
the eighth apply versus the measured 154000 Hz. This is a quantified authority
change, not a plant prediction.

## Frozen identities

See `REAL_CR15_LADDER_SHA256SUMS.txt`. Each duration has an independent OUT,
MAP and SHA-256.

## Qualification verdict

```text
SOL_W2_POWER_REDUCTION_AUTHORITY_TESTS_PASS
SOL_W1_ADC_FRESHNESS_UNIT_TESTS_PASS
SOL_W2_CR15_LADDER_PREFLIGHT_TESTS_PASS
ALL_STAGE6_REAL_BINARY_HARDENING_STATIC_CHECKS_PASSED
EQUIVALENCE_TEST_PASS__10180275_CHECKS
STAGE6_ONCHIP_TIMING_FREEZE_NOPOWER_LADDER_ALL_PASS
SOL_W1_ADC_CADENCE_NOPOWER_HARD_GATES_PASS
SOL_W2_100MS_TELEMETRY_NOPOWER_HARD_GATES_PASS
STAGE6_CR15_FMAX_STRESS_NOENERGY_PASS
```

- Timing ladder: 2/10 ms normal 849, apply 841, shutdown 535; 100 ms
  normal 853, apply/active 866, shutdown 537; no overrun.
- Real ADC cadence 2 ms: fresh=PI=50, stale=1, fault0.
- Real ADC cadence 100 ms: fresh=PI=2462, stale=1, compute 880, apply 860,
  fault0; rolling telemetry count skew <=1.
- fmax saturation 0/1/2 and Burst boundary 3 all pass.
- Every target qualification ended PWM0/OST1/TZINT0.

Candidate 2 is qualified for one new-SHA CR15 real ladder under the standing
operator confirmation. It must stop on the first failed duration and may not
be repeated unchanged.
