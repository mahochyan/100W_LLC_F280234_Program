# SOL Master Final Report

Status: W2 Candidate4 unique real CR15 2MS failed (COMP_TZ1 + pre-brake high
abort). No retry. The authoritative resume point is `docs/SOL_MASTER_EXECUTION_STATE.md`.

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

W2 candidate 3 timingfix5 (handoff brake 160 kHz, PI integral preload -10000 Hz,
real Q12 hot path trim) passed all no-power gates with 2/10/100 ms compute
846/846/846 and fmax stress. Its unique real 2 ms run still failed on the VOUT
gate: `max_vout_raw=1370 >= 1367`, `abort=2`, compute/active=875 (<900),
apply=859, shutdown=1086, overrun=0, final PWM0/OST1/TZINT0. 10/100 ms were not
run and no CR12.5 was auto-run. This candidate is rejected; the next W2 attempt
requires a new proven root-cause change, new SHA, and all no-power gates.

W2 Candidate4 (pre-handoff energy shaping) was the authorized new root-cause
direction. It implements a pre-handoff brake, dv/dt gate, and bumpless PI preload
to the actual brake frequency. All no-power gates passed, the unique real ladder
SHA was frozen, and the authorized unique real CR15 2MS shot was executed. It
failed: `FAULT_COMP_TZ1`, pre-brake entered at raw 1359 and immediately aborted
(high-window, reason 2), final PWM0/OST1/TZINT0. No retry; no CR12.5.

W2 has now consumed the allowed three distinct real root-cause attempts:
1. W2 attempt 1 (original handoff)
2. Candidate 2 (fast slew 1000 Hz)
3. Candidate 3 timingfix5 (handoff brake 160 kHz + PI preload)

The first three attempts stopped at the same 2 ms VOUT gate
(`max_vout_raw >= 1367`). Candidate4 stopped at the same 2 ms window but with a
real comparator TZ1 trip and an immediate pre-brake high-window abort. Those four
attempts remain closed and will not be retried.

The `200K_DB140_NOT_PRODUCTION_PATH_AUDIT` is accepted as a closed prior: it is
not a production baseline, must not be retried, and no blanking / qualification /
DAC / TZ changes are allowed to make that diagnostic point pass.

This report will be extended only with verified W0-W14 results and immutable
evidence references.
