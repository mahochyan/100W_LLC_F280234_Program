# SOL Master Final Report

Status: in progress. The authoritative resume point is
`docs/SOL_MASTER_EXECUTION_STATE.md`.

## Verified milestones

- W0 identity restored from baseline `36ef115`.
- W1 ADC freshness root cause closed at `9dd8968`: ADC publication remained
  alive; late ADCINT service had misclassified continuous EOC overlap as a
  stopped publication.
- Final independent 2/10/100 ms artifacts have frozen SHA-256 identities.
- Unit, static, equivalence, real-ADC no-power, timing, fmax-stress and 100 ms
  rolling-telemetry hard gates pass. Every target run ended PWM0/OST1.
- Tutorial archive `100wllccode.zip` was audited as a reference only; its
  architecture informs W6-W8 comparisons, not firmware constants.

## Open milestone

W2 attempt 1 stopped at the 2 ms VOUT safety abort (`1369 >= 1367`). SoftStart,
handoff, ADC freshness, control direction, 145..170 kHz envelope and W2 timing
limits passed; no 10/100 ms step or retry was executed. A later symbol-only
reconnect read OST0 after the real script had ended OST1, so the current hard
stop requires Vin off and output discharge before offline root-cause work can
advance to a newly qualified candidate. The user's required 50 W stable-load
milestone remains recorded under W10.

W2 candidate 2 increased the bounded power-reduction slew from 500 to
1000 Hz/fresh-compute and passed every no-power gate. Its unique real 2 ms run
reached 156423 Hz but still crossed the VOUT gate at raw 1370; the longer period
walk also reached 913 compute cycles. It ended PWM0/OST1/TZINT0 and did not run
10/100 ms. The parameter direction is rejected; the active root cause is now
the SoftStart-to-PI handoff energy/state discontinuity.

This report will be extended only with verified W0-W14 results and immutable
evidence references.
