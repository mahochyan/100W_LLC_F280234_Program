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
- Final mixed-SHA 2/10/100 ms timing ladder PASS. The 2/10 ms images reached
  normal `842`, apply `831` against limit `850`; the 100 ms telemetry image
  reached normal `853`, apply `866` against its W2 limit `900`; overrun `0`.
- Final 2 ms real ADC cadence: sequence `968`, fresh `50`, PI `50`, stale `1`,
  fault `0`.
- Final 100 ms real ADC cadence: sequence `7118`, fresh `2463`, PI `2463`,
  stale `1`, compute `885`, apply `855`, fault `0`; all four rolling telemetry
  channels recorded `304` samples.
- fmax saturation 0/1/2 and Burst boundary 3 stress cases PASS.

## Candidate identity

```text
ROOT_FIX_COMMIT=9dd89680d4dd243bbaa26af1e55ac98d587155f0
CR15_2MS_SOURCE_COMMIT=4946bb409d2ae78eddac1ba77710584b66e3c35f
CR15_2MS_OUT_SHA256=68A148A26C4E57923255C0436E4DC07002B2A592E82C042695F4E43295625E76
CR15_2MS_MAP_SHA256=752972250BAB704E6634EFD49609CD158B3EC6B17617DE1AEC8295C90608B0B7
CR15_10MS_SOURCE_COMMIT=4946bb409d2ae78eddac1ba77710584b66e3c35f
CR15_10MS_OUT_SHA256=E9FF7794FAFF54093213DB9E21EE17D682E1B9619A95D5D040D64289491C3CA4
CR15_10MS_MAP_SHA256=E19E5B5FFD93FAC88CFBE6B121410781E0D87B5CDDE4EE636B3CA5A35E531353
CR15_100MS_SOURCE_COMMIT=7c90900b39ff464497fa2761b2dfb278366156c4
CR15_100MS_OUT_SHA256=84348E3F10AB3B680777EE80E7B247273E280352D85769D4D5C1F1A8B646A51C
CR15_100MS_MAP_SHA256=9BE36087CB0F36CDAF84AC499F7CCE5FDE73EDF8115F4F60DB706F8036B75581
```

The next allowed operation is the guarded new-SHA real CR15 ladder after the
operator confirms Vin/current-limit/load/safety conditions. It runs 2 ms,
10 ms, then 100 ms without an intermediate review and stops safely on the first
failed gate. It is a new qualified experiment, not an unchanged retry.
