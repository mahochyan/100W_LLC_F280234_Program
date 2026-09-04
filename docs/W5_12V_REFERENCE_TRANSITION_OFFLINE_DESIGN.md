# W5 10 V to 12 V reference-transition offline design

This is a preflight design, not the `W5_12V_REFERENCE_TRANSITION_PASS`
result. It is prepared while the exact W4 REAL image remains frozen for the
pending CR15/CR12.5 A/B/A bench runs. No build-included source is changed by
this document or its companion preflight test.

## Fixed inputs and measured conversion

The only accepted conversion is the measured board calibration in
`app/board_calibration.h`:

```text
VOUT = 0.008089325 V/raw * raw - 0.063715 V
raw = Uint16(((VOUT - offset) / gain) + 0.5)
```

W5 will use an immutable firmware table. A stage abort at reference +5% is
selected, which is tighter than the work-order maximum of +10%. The absolute
software ceiling is independently fixed at 12 V +10%; it cannot be moved by a
host write during a power window.

| Vref | target raw | +3% acceptance high | +5% stage abort | +10% maximum |
|---:|---:|---:|---:|---:|
| 10.0 V | 1244 | 1281 | 1306 | 1368 |
| 10.5 V | 1306 | 1345 | 1371 | 1436 |
| 11.0 V | 1368 | 1408 | 1436 | 1504 |
| 11.5 V | 1430 | 1472 | 1501 | 1572 |
| 12.0 V | 1491 | 1536 | 1565 | 1640 |

The target conversion deliberately matches `CTRL_VoltsToRaw` rounding. The
existing named 10 V/12 V board constants remain 1244/1491 and agree with it.

## Protection migration audit

The frozen W4 source initializes `g_first_real_pi_shot_abort_vout_raw` from
11.0 V (raw1367 when truncated) and checks that guard in the fast path and in
Burst restart gates. It cannot be deleted or merely replaced with one new
magic value. The W5 build must instead publish the selected immutable rung's
calibrated target and +5% stage abort together before PWM authorization.

The generic `LLC_OVP_RAW_THRESHOLD`, `LLC_OCP_RAW_THRESHOLD`, and
`LLC_UVP_RAW_THRESHOLD` are all `0xFFFFU`; they are not an independent safety
layer today. Comparator/TZ1 is a verified asynchronous primary-current trip,
not a VOUT comparator, and must not be described as hardware VOUT OVP. W5 will
retain that hardware energy/current limit and the bench supply's real 0.7 A
limit. For VOUT it will add two independent calibrated software decisions:

1. a fast per-stage abort at the table's +5% raw value; and
2. an immutable absolute fast abort at raw1640 (12 V +10%).

Both decisions must force OST, revoke every power permission and pending
write, freeze the first-cause snapshot, and end with PWM0/OST1/TZINT0. W8 still
owns final calibrated production protection closure; W5 evidence will not
mislabel the primary-current comparator as voltage protection.

## Region ownership and transition semantics

W2 proved from the real plant matrix that continuous PFM cannot regulate 10 V
inside the authorized 145..190 kHz envelope at the tested loads. W3/W4
therefore correctly assign 10 V to protected Burst. Repeating open-loop scans
cannot change that fact.

The W5 ladder must discover the first rung that has a continuous-PFM
equilibrium in 145..170 kHz. The allowed owner states are:

| Rung | Entry owner | W5 decision |
|---:|---|---|
| 10.0 V | qualified protected Burst | baseline only; never claim continuous PFM |
| 10.5 V | unknown | attempt bumpless transfer; accept only if continuous gates pass |
| 11.0 V | unknown | same |
| 11.5 V | unknown | same |
| 12.0 V | unknown | same; this is the required final W5 point |

If 10.5 V is still below the continuous region, it remains Burst-owned and the
first continuous attempt moves to 11.0 V. This is a measured ownership result,
not silent weakening. The literal W5 “no Burst” gate applies to every rung
reported as a W5 continuous rung; the 10.0 V protected-Burst baseline will be
recorded as an evidence-backed exception established by W2-W4. The final W5
token is forbidden unless 12.0 V completes its continuous 2 s run and the
ledger explicitly records the discovered boundary.

## Minimal post-W4 implementation

After both W4 real A/B/A directions pass, create a distinct compile-gated W5
build rather than modifying the frozen W4 observer:

- Add an immutable five-entry rung table containing Vref raw and +5% abort raw.
- Permit the host to choose only a rung index, duration (100 ms or 2 s), and
  unique run ID while PWM is safely off; reject arbitrary raw/frequency writes.
- Publish target raw, stage gate, and run metadata atomically before release.
- Start from the qualified 10 V protected-Burst baseline, then perform one
  bumpless Burst-to-PFM transfer at the first viable rung.
- Keep the current 145..170 kHz envelope. Do not lower it during W5.
- Stop on Burst activity after a rung is declared continuous, sustained fmax
  or fmin occupancy, ADC stale/overflow, comparator/TZ activity, timing
  overrun, stage/absolute overvoltage, or any other fault.
- Capture raw minimum/maximum/mean, first and terminal raw, command/TBPRD
  range, saturation occupancy, Burst transitions, ADC sequence and stale
  counts, timing maxima, fault/trip deltas, and the terminal safe state.
- Make the firmware own the complete timed window. Do not halt or read JTAG
  between release and terminal OST.

## Qualification order

Physical conditions are Vin24, CR15, and real input limit 0.7 A. Each rung is
run first for 100 ms and then for 2 s; any failure stops the ladder. A rung
passes only if its measured voltage is within +/-3%, its peak stays below its
+5% stage gate, references and measured steady means remain monotonic, ADC is
fresh, Burst is absent once continuous ownership is declared, and neither
frequency bound is sustained.

Before the first real run, the new source must pass static table/permission
tests, executable direction and abort models, on-target no-energy tests for
every rung/duration, ISR timing, deliberate stale/overvoltage/saturation
negative tests, exact OUT SHA gating, and a final W3/W4 regression. Any
controller request below 145 kHz freezes evidence and stops; it is a W6/W9
decision and cannot expand the W5 envelope.

The current offline preflight token is
`SOL_W5_REFERENCE_TRANSITION_PREFLIGHT_PASS`. It does not close W5.
