# STAGE5A_PFM_DIRECTION_REPORT - final hardware acceptance

> Status: `STAGE5A_PFM_DIRECTION_ACCEPTED = 1`
> `PFM_CONTROL_DIRECTION_CONFIRMED_NORMAL = 1`
> `PFM_DIRECTION_GAIN_CHARACTERIZED = 0`
> `PFM_DIRECTION_SMALL_EFFECT = 1`
> `LLC_HARDWARE_PI_VALIDATED = 0`
> `READY_FOR_STAGE6_CONTROL_INTEGRATION_OFFLINE`

This report is filled from on-board data only; theory must not replace hardware results.

## 0. Final engineering ruling (human review)

STRICT SAME-BINARY clean A/B on the frozen OUT:

    OUT SHA256 = 2D1F2BA0B463AEFE1FF41E8A208672E8B5F2A5EFE3B8259286B95FB8F2A775E7
    MAP  SHA256 = 01C46504F412F77EE6837F710A9BD82BD9DB43D1A8B23BF9A804FCB20F57D9CC
    compiler    = ti-cgt-c2000_25.11.1.LTS --abi=coffabi

Final official A/B (both NO-POLLING, single-read, same frozen binary):

| shot | RUN_ID | result | cycles | TBPRD/CMPA/CMPB/DB | start | end | delta | slope_cycle | fault |
|---|---|---|---|---|---|---|---|---|---|
| 150k same-bin nopoll | 0x250C5A15 | 8 PFM_WINDOW_DONE | 45/45 | 399/200/100/36 | 1244 | 1376 | **132** | **440.00** raw/ms | 0 |
| 170k same-bin nopoll | 0x250C5A17 | 8 PFM_WINDOW_DONE | 51/51 | 352/176/88/36 | 1246 | 1369 | **123** | **409.93** raw/ms | 0 |

Both shots: fault=0, ACTIVE_TZ=0, hard_abort=0, stale_abort=0, post-stop ADC clean
(SOCAEN_after_stop=0, ADCINTOVF_after_stop=0, adc_trigger_mode_after_stop=0), final PWM=0 / OST=1.

difference_ratio = (slope150 - slope170) / max(slope150, slope170)
                = (440.00 - 409.93) / 440.00 = 6.83%

`STRICT_SAME_BINARY_AB = 1`

### Human engineering ruling

The original 10% threshold was a conservative heuristic used as an automatic
in-test gate, not a physical acceptance law. Final acceptance is decided by
human engineering review on the basis of:

- **same-binary**: both shots used the identical frozen OUT (2D1F2BA0)
- **repeatability**: corroborating shots agree (150k old delta=136 cross-build;
  170k old delta=121, and the two clean 170k nopoll deltas 121..123 sit close);
  150k and 170k response ranges do not overlap
- **consistent sign**: every independent observation satisfies 150k > 170k
- **clean protection state**: fault=0, ACTIVE_TZ=0, post-stop ADC clean on both

=> `PFM_CONTROL_DIRECTION_CONFIRMED_NORMAL = 1`, `STAGE5A_PFM_DIRECTION_ACCEPTED = 1`.

Magnitude is small and deliberately NOT characterized:
`PFM_DIRECTION_GAIN_CHARACTERIZED = 0`, `PFM_DIRECTION_SMALL_EFFECT = 1`.

### No over-interpretation

- DO NOT write "the LLC gain differs by exactly 6.83%".
- DO NOT derive final hardware PI parameters directly from this 300 us no-load transient.
- State exactly: **direction/sign validated**; **magnitude / small-signal plant still requires later characterization**.

## 1. Confirmed control sign

In the measured operating region:

```
frequency increases  ->  output response decreases
VOUT < VREF          ->  frequency decreases
VOUT > VREF          ->  frequency increases
```

This is `HARDWARE_CONFIRMED_CONTROL_SIGN` - not to be re-labelled as theoretical.

## 2. Historical (in-test automatic criteria) - preserved for record

These were automatic gates used DURING testing. The final engineering ruling is
made by human review (see section 0), not by these heuristics.

- 150k first cross-build shot (original env OUT): delta=136, slope 444.8 raw/ms -> `PFM_DIRECTION_150K_PASS` (CORROBORATING only, cross-build).
- 170k polling shot (original env OUT): delta=121, fault=64 -> CORROBORATING only (not a formal PASS).
- 170k nopoll shot RUN_ID 0x250C5A17: `PFM_DIRECTION_170K_NOPOLL_PASS` (clean).
- 150k nopoll same-binary shot RUN_ID 0x250C5A15: `PFM_DIRECTION_150K_NOPOLL_SAME_BINARY_PASS` (clean).
- Automatic gates used during testing: `INCONCLUSIVE` (<10% diff), `PROVISIONAL_CLEAN` (10-25%),
  `PFM_DIRECTION_SAME_BINARY_NORMAL_BUT_SMALL_EFFECT` (0<diff<10%).
  These are recorded in debug_capture/ and were superseded by human review in section 0.

## 3. Unrelated failed diagnostic (isolated)

- 200k/DB140 multi-edge failure (branch `requalify/200k-db140-trip-evidence`) is:
  - NOT a 150k PFM direction failure
  - NOT a formal SoftStart failure
  - NOT a 250k Profile-C startup failure
- It does not change this Stage5A acceptance.

## 4. ADC post-stop cleanup (production-relevant safety fix)

- Root cause: `SS_HardStop()` did not disable `ETSEL.SOCAEN`, so the PWM-synced ADC
  free-triggered after power-off; a debugger halt/delay then raised `FAULT_ADC_STALE_OVERFLOW`.
- Fix committed to main `2ccc4a2`: disable SOCAEN + `ADC_SetSoftwareTriggerMode()` before
  re-enabling ADCINT1 PIE. No power behavior changed.
- Validated: `ADC_POSTSTOP_CLEANUP_NOENERGY_PASS` (offline), plus both real same-binary shots
  show SOCAEN=0 / ADCINTOVF=0 after stop. See `docs/ADC_170K_POSTSTOP_TRIGGER_AUDIT.md`.

## 5. Physical board state

- After the 150k same-binary shot: PWM=0, OST=1, fault=0. Safe.
- No reset / reload / power action executed in this acceptance task.

## 6. Safety state

- `LLC_HARDWARE_PI_VALIDATED = 0`.
- Stage5A acceptance does NOT authorize: entering real PI, continuous 12V, changing DAC,
  changing protection. No such action is implied.

## 7. Next stage (STAGE6_CONTROL_INTEGRATION_OFFLINE)

Integrate the already-SIL-validated controller into the real F28034 software
architecture, but with hardware output still disabled.

First step only establishes interfaces (offline, PC / no-energy acceptance):

- Vref, Vout, error
- frequency command, frequency clamp
- PFM sign
- anti-windup interface
- ADC stale shutdown

NO on-board closed loop.

## 8. Toolchain status

- `ti-cgt-c2000_25.11.1.LTS`, COFFABI
- `TOOLCHAIN_25_11_1_STAGE5A_VALIDATED = 1`
- `FINAL_PRODUCTION_TOOLCHAIN_DECISION_PENDING = 1`

## 9. Conclusion

`STAGE5A_PFM_DIRECTION_ACCEPTED = 1`
`PFM_CONTROL_DIRECTION_CONFIRMED_NORMAL = 1`
`PFM_DIRECTION_GAIN_CHARACTERIZED = 0`
`LLC_HARDWARE_PI_VALIDATED = 0`
`READY_FOR_STAGE6_CONTROL_INTEGRATION_OFFLINE`
`NO_REAL_POWER_EXECUTED`