# W2 Handoff-Brake Candidate 3 Qualification

Source commit: `d3a51402c1623458cc98dba0ccb062232321cddb`

## Change

Formal Profile C still completes and is validated at 150 kHz/TBPRD 399/DB36.
Before closed-loop ownership is published, the bridge receives one checked
160 kHz/TBPRD 374 brake preload and the PI is seeded with the equivalent
-10000 Hz Q12 integral state. Candidate 2's 1000 Hz fast-loop slew is rolled
back to the qualified 500 Hz value; the 145..170 kHz envelope is unchanged.

## Completed gates

```text
SOL_W2_HANDOFF_BRAKE_TESTS_PASS
SOL_W2_HANDOFF_BRAKE_NOENERGY_PASS
SOL_W1_ADC_FRESHNESS_UNIT_TESTS_PASS
SOL_W2_CR15_LADDER_PREFLIGHT_TESTS_PASS
ALL_STAGE6_REAL_BINARY_HARDENING_STATIC_CHECKS_PASSED
EQUIVALENCE_TEST_PASS__10180275_CHECKS
PERIOD_FASTPATH_EQUIVALENCE_PASS__15025601_CHECKS
HANDOFF_PUBLICATION_ORDER_STATIC_PASS
```

The on-target no-energy handoff observed TBPRD374/CMPA187/CMPB93/DB36,
SOCAPRD=ET_3RD, frequency/shadow=160000, integral=-40960000, first PI
frequency=160000, fault0 and OST1.

The first 2 ms timing gate safely rejected this binary: compute=861 and
apply=860 exceeded the 850-cycle no-power limit, while all PWM-off/OST/fault
gates passed. No real-power execution occurred. The binary is retained as
rejected evidence and will not be retried unchanged.
