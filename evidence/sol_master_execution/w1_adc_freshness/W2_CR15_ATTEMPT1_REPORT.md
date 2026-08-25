# W2 CR15 Real Ladder Attempt 1

## Verdict

The only authorized attempt stopped at the 2 ms step. The 10 ms and 100 ms
steps were not executed, and no retry or substitute load was run.

```text
OUT_SHA256=68A148A26C4E57923255C0436E4DC07002B2A592E82C042695F4E43295625E76
VIN=24.0V
INPUT_CURRENT_LIMIT=0.5A
LOAD=CR15.0ohm
STATE=ABORTED
ABORT=SHOT_ABORT_VOUT_11V
FAULT=0x00010000 (FAULT_FIRST_SHOT_ABORT)
MAX_VOUT_RAW=1369
ABORT_LIMIT_RAW=1367
FINAL_AFTER_RUN=PWM0_OST1_TZINT0_POST_OST
```

## Valid control evidence

- SoftStart completed and handoff passed.
- ADC publication advanced from sequence 2753 to 2769; fresh and PI compute
  counts were both 9, active overflow was 0 and the frozen fault snapshot was
  0.
- The controller saw VOUT above reference and moved in the correct
  power-reduction direction: 150500 to 154000 Hz, TBPRD 398 to 389.
- Compute/active/apply were 872/872/844 cycles, shutdown was 1110 cycles and
  overrun was 0. These pass the W2 work-order limits of 900/900/900 and <1200.
- No Burst, hardware trip or active-window trip occurred.

The host harness printed a legacy 850-cycle normal sub-limit for the 2 ms
image. W2's authoritative common gate is 900 cycles, so timing is not a failure
for this attempt. The VOUT abort and its fault flag are the failed gates.

## Root-cause evidence

Frozen abort telemetry shows:

```text
FIRST_CONTROL_VOUT_RAW=1298
VREF_RAW=1244
FIRST_ERROR_RAW=-54
ABORT_FILTERED_VOUT_RAW=1369
ABORT_CONTROL_VOUT_RAW=1369
ABORT_ERROR_RAW=-125
ABORT_FREQUENCY_HZ=154000
POWER_WRITES=8
```

The ADC chain is fresh and the controller direction is correct. The output was
already about 54 raw above reference at first apply and continued rising while
the bounded +500 Hz/fresh-compute power-reduction slew advanced only to
154 kHz. This classifies the primary cause as insufficient transient
power-reduction authority at handoff, not ADC freshness, sign reversal,
frequency-envelope violation, or a hardware trip.

No threshold was relaxed, no load was changed, and CR12.5 was not used.

## Reconnect safety event

The ladder itself ended with PWM0/OST1. A subsequent symbol-only post-mortem
reconnect read PWM0 but OST0 while the controlled fault and POST_OST state were
still present. Because the hard invariant requires OST1, further target access
was stopped and the operator was instructed to turn Vin off and discharge the
output. The reconnect helper was removed and must not be repeated with Vin
present.

## Next legal action

First obtain `VIN_OFF_DISCHARGED=1`. Then perform an offline root-cause change,
new binary/SHA build and all no-power gates. A second real attempt is forbidden
until that new candidate is qualified and the physical setup is confirmed
again.
