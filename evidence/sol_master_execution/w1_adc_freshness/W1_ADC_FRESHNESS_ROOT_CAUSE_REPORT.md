# W1 ADC Freshness Root-Cause Report

## Verdict

The CR15 failure was an ADC interrupt-service semantic failure, not a stopped
ADC converter and not a CR15 regulation failure. The exact baseline REAL OUT
reproduced four `ADCINTOVF` events during an output-inhibited 170 kHz/ET_3RD
cadence run while ADC publication continued. The ISR held `ADCINT1` asserted
until after filtering and telemetry; an EOC2 arriving during that window set
overflow, and the REAL build interpreted the overflow as
`FAULT_ADC_STALE_OVERFLOW`.

## Minimal correction

- Copy the completed ADC result frame, then clear `ADCINT1` at ISR entry.
- Never clear `ADCINT1` again at ISR exit, so a new EOC2 remains pending.
- Use `INT1CONT=1` only for the closed-loop streaming path; software-trigger and
  SoftStart modes retain `INT1CONT=0`.
- In continuous mode, retain flag overlap as telemetry; true stopped
  publication is still stopped by the unchanged three-consecutive-sequence-miss
  protection. Non-continuous overflow still latches the original fault.
- Establish the consumer baseline at handoff and arm ACTIVE freshness only on
  the first complete post-handoff publication.
- Add first-stale/fault freeze-once telemetry without a per-tick bulk copy.

No PI coefficient, 145..170 kHz envelope, Burst boundary, SoftStart trajectory,
dead-time, VOUT abort, Comparator/TZ setting, or protection threshold changed.

## No-power qualification

- Same ADC code with a new publication sequence is fresh.
- Continuous publication does not false-stale.
- Deliberately stopped publication faults on the original third duplicate.
- Real SOCA/ADC cadence at 170 kHz: active overflow `0`, sequence continues,
  final PWM0/OST1.
- 2/10/100 ms timing ladder PASS; normal compute max `848`, fmax compute max
  `841`, apply max `850`, overrun `0`.
- fmax saturation 0/1/2 and Burst boundary 3 stress cases PASS.

## Candidate identity

```text
SOURCE_COMMIT=9dd89680d4dd243bbaa26af1e55ac98d587155f0
CR15_2MS_OUT_SHA256=A1067015ADD4242BB6F48F70A223174DBFAC3F50997ED4F5DAFF4F3C75EACECA
CR15_2MS_MAP_SHA256=F96EC0C3E8A92C2AB0BE5DD0BF4FCB47C498F432B546D98CF39D1FE5101E30C3
```

The next allowed operation is one new-SHA real CR15 2 ms run after the operator
confirms Vin/current-limit/load/safety conditions. It is a new qualified
experiment, not an unchanged retry.

