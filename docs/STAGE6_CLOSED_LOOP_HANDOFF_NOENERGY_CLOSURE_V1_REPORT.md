# STAGE6 CLOSED-LOOP HANDOFF NOENERGY CLOSURE V1

## Objective
Connect the verified **Profile-C formal soft-start** to the **Q12 20 µs closed-loop PI**
through the production path **`IDLE → Formal SoftStart → Closed-loop handoff → RUN`**.
This is a **NO-ENERGY** closure: **no real power executed**, OST stays latched,
PWM effective output inhibited, `LLC_HARDWARE_PI_VALIDATED=0`,
`LLC_CONTROL_DIRECTION=0`. **Kp/Ki are not re-tuned** (Q12 220587 / 1471 kept).

## Power gates (unchanged)
| Gate | Value | Evidence |
|---|---|---|
| `LLC_HARDWARE_PI_VALIDATED` | `0` | llc_config.h |
| `LLC_CONTROL_DIRECTION` | `0` | llc_config.h |
| PWM effective output | inhibited (OST latched + AQCSFRC force-low in no-energy) | on-target |
| OST | `1` | TZFLG.OST reads 1 throughout handoff |
| No real power executed | true | no input on bench |

## Firmware changes
- **`SoftStart_TransferToClosedLoop()`** (soft_start.c): the Stage-6 handoff body.
  - **D** entry guards (Stage6 + formal Profile C + no fault + sys==SOFT_START).
  - **E** first handoff target = 10 V (`BOARD_VOUT_RAW_10V`); 12 V raw ceiling kept (abort).
  - **F** PWM state check `TBPRD=399 / CMPA=200 / DBRED=36 / DBFED=36` → else
    `HANDOFF_PWM_STATE_INVALID → STOP`.
  - **I + K** ADC ownership handoff order: disable ePWM INT → `SOCAPRD=ET_3RD`
    → clear ADCINT1 flag → clear ADCINTOVF → clear PIEIFR1.INTx1 → re-enable
    PIEIER1.INTx1 → initialize freshness baseline
    (`g_control_adc_sequence_last = consumed = g_adc_sample_sequence`).
  - **L** filter seed from `g_softstart_last_vout_raw` (`acc = raw<<4`,
    `filtered_raw = raw`) so the first closed-loop sample is not a stale jump.
  - **G** bumpless state: `freq=shadow=150000`, `integral_q12=0`,
    `unsat = 150000*4096`.
  - **H** `g_voltage_reference = 10.0f` (production slow path derives
    `vref_raw≈1244`, `reference_valid=1`).
  - Complete exactly once (`SOFTSTART_COMPLETE`), `RUN_ONCE`, `handoff_ONCE`.
- **FINAL** stage (soft_start.c) triggers the transfer on Stage6 when
  `Vout >= 10V`; hard ceiling aborts before it.
- **ADC closed-loop mode** (adc.c): `ADC_SetClosedLoopSyncTriggerMode()`
  (`SOCAPRD = ET_3RD`, CMPB fixed phase) → 40/50/60 kS/s at 120/150/180 kHz.
  SoftStart ramp keeps `ET_1ST`.
- **Stage-6 enable** (state_machine.c): routes to `SoftStart_Begin()` (no direct
  `LLC_PWM_Enable` / `SYS_STATE_RUN`). `SoftStart_Update5ms` sets SOFT_START itself.
- **Freshness sequence** upgraded to `Uint32` everywhere
  (`g_adc_sample_sequence`, `g_control_adc_sequence_last/consumed`,
  `CTRL_RunFastControl` local) so long runs do not wrap-false-fresh.
- **Realtime budget**: Timer0 entry-interval min/max + whole-ISR and ADC-ISR
  cycle sums/max captured under the no-energy test gate.
- **No-energy safety**: TZ1 hardware trip is counted but not faulted in the
  no-energy sim; real-power calibration/direction gates are bypassed when
  `g_softstart_no_energy != 0`.

## On-target verification (Frozen OUT `C3EA2475…B590038B5`)
All gates pass on the F28034 board with the no-energy bench:

| Gate | Result |
|---|---|
| B: Stage6 direct-run path audit | `STAGE6_DIRECT_RUN_PATH_CONFIRMED` (legacy direct LLC_PWM_Enable/RUN bypassed) |
| C: enable → SoftStart (not direct RUN) | `STAGE6_DIRECT_RUN_PATH_CLOSED_PASS=TRUE` |
| M/N/F/G/H: handoff once, RUN once, PWM state, bumpless, ref sync | all TRUE |
| First closed-loop sample | raw=1244 (~10 V) → first PI freq = 150000 Hz (no jump) |
| O: ADC cadence | 40.0k / 50.0k / 60.1k S/s (120/150/180 kHz) |
| P: CPU ISR utilization | 60.3% / 63.6% / 65.6% |
| Q: realtime | TINT0 whole-ISR max = 645 cycles (≤900 PASS), overrun=0, Timer0 interval max=1417 |
| R: freshness semantics | fresh×10/tick = 8.01 / 10.01 / 12.02 (~0.8 / 1.0 / 1.2) |
| S: PI PWM write gate | PWM regs unchanged by PI (shadow-only) |
| T: fault/ceiling | hard ceiling abort → safe, no RUN, no auto-retry |

## Static checks
- `FULL_FAST_CONTROL_PATH_SOFTFLOAT_FREE_PASS=TRUE`
- `FIXED_POINT_PI_SIL_PARITY_PASS=TRUE`
- `SIL_CADENCE_FULL_FRESH_MATCH_PASS=TRUE`, `SIL_CADENCE_MISSING_1_2_3_STALE_PASS=TRUE`

## Verdict
**`STAGE6_CLOSED_LOOP_HANDOFF_NOENERGY_PASS`**

**`READY_FOR_FIRST_BOUNDED_REAL_PI_SHOT_REVIEW`**
