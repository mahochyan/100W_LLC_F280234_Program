# STAGE6 FIRST REAL PI SHOT — REAL BINARY HARDENING REPORT (V1)

> Task: `STAGE6_FIRST_REAL_PI_SHOT_REAL_BINARY_HARDENING_V1`
> Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1`
> Source baseline: `517a28112cce123975d4b8b54593b432bed519bf`
> Compiler: TI CGT C2000 25.11.1.LTS, COFF ABI, `-v28 -ml -mt -g -O4 --opt_for_speed=0 -ms`

## 1. Objective

Harden an isolated REAL shot binary for the first bounded closed-loop PI shot on
the 100 W LLC F280234 board. The REAL binary is synthetic-free, request-only,
and carries a narrow Stage6 limited authorization plus passive realtime
observation. No real energy shot, no 200 us real PI power test, and no
continuous closed loop were executed.

## 2. Build split (two independent paths)

| Path | Script | Output | Macros |
|------|--------|--------|--------|
| NOENERGY | `tools/build_flash_shot_noenergy.bat` | `Stage6_FLASH_SHOT_NOENERGY` | `STAGE6_FLASH_BUILD`, `STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST`, `STAGE6_FIRST_BOUNDED_REAL_PI_SHOT` |
| REAL | `tools/build_flash_shot_real.bat` | `Stage6_FLASH_SHOT_REAL` | `STAGE6_FLASH_BUILD`, `STAGE6_FIRST_BOUNDED_REAL_PI_SHOT`, `STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD` |

`llc_config.h` carries a mutual-exclusion `#error` that rejects
`STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD` combined with either
`STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST` or `STAGE6_REAL_ACTUATOR_OST_TEST`.

## 3. Build results (L1)

| Build | Result |
|-------|--------|
| NOENERGY SHOT (`Stage6_FLASH_SHOT_NOENERGY`) | PASS |
| REAL SHOT (`Stage6_FLASH_SHOT_REAL`) | PASS |
| Production/Stage6 (`Stage6_FLASH`) | PASS |

## 4. Frozen artifacts and SHA256

| Artifact | SHA256 |
|----------|--------|
| REAL OUT (`LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT.out`) | `9CE0EFBAC3133B444DCD3A5F81E22B5F1B54AB141FA80619BFA7D83920D9CF7A` |
| REAL MAP (`LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT.map`) | `C34B69320377409B8F7D74D359FD4D8B33337930BCA87CA0E8855B00E08EF798` |

Frozen copies live in `evidence/stage6_first_real_pi_shot_real/`. The REAL OUT
is committed with `git add -f` (`.gitignore` ignores `*.out`/`*.map`).

## 5. Forbidden-symbol audit (synthetic-free)

All forbidden symbols are ABSENT from the REAL MAP:
`g_stage6_synthetic_vout_raw`, `g_stage6_closeloop_vout_inject`,
`g_stage6_noenergy_test_enable`, `g_stage6_noenergy_test_mode`,
`g_stage6_synthetic_sequence`, `g_stage6_actuator_direct_cmd_hz`,
`g_first_shot_debug_freq_hz`, `g_first_shot_debug_ticks`,
`g_diag_frequency_override`.

`g_softstart_no_energy` exists only as a definition (3 symbol-table entries,
0 code references, 0 protection bypass, 0 OST relatch path, 0 simulated
freshness path). The REAL ADC ISR unconditionally uses
`vout = AdcResult.ADCRESULT0;` with no synthetic switch.

## 6. REAL script write audit (request-only)

`tools/stage6_first_real_pi_shot_real.js` writes ONLY the request interfaces:
`g_loopback_diag_request`, `g_stage_confirm_request`, `g_pwm_enable_request`,
`g_first_real_pi_shot_arm`, `g_test_run_id`. It writes NO fault/system/stage/
cal/comp/synthetic/diag/PWM-register state, and performs NO runtime polling
between `runAsynch` and `halt`. A host SHA256 hard gate computes the local REAL
OUT SHA256 and aborts before connect/download on any mismatch with the frozen
manifest. Requires `DSH_CNT34_APPROVED=1`.

## 7. Stage6 bounded authorization (F2)

`SHOT_RealStage6AuthOk()` authorizes the bounded shot ONLY when ALL hold:
`bringup_stage == BRINGUP_STAGE_6_CLOSED_LOOP`, `g_first_real_pi_shot_arm == 1`,
`g_board_vout_cal_valid == 1`, `g_comp_tz_loopback_verified == 1`,
`g_fault_flags == 0`, PWM off, OST latched, Stage7 not requested. It never
unlocks `LLC_CONTROL_DIRECTION` and never fakes `g_iout_amps`.

## 8. VOUT calibration / IOUT status

- VOUT cal: `BOARD_VOUT_CAL_VALID = 1`, `VOUT = 0.008089325*raw - 0.063715`
  (10 V ≈ 1244, 11 V ≈ 1368, 12 V ≈ 1491 raw).
- IOUT absolute calibration: PENDING (not faked).
- Fast OCP: Comparator → TZ1 → OST one-shot; DAC fixed 300.
- VOUT real ADC raw; 11 V raw fast-exit.

## 9. Realtime timing gate (K)

Instrumentation present in the REAL binary: `g_real_isr_cycles_last/max/sum/count`,
`g_real_isr_overrun_count`, `g_real_timer0_entry_count/last_entry/interval_min/max`,
`g_first_real_pi_shot_first_write_timer2`, `g_first_real_pi_shot_ost_timer2`.

**STATUS: NOT EXECUTED.** CNT3/CNT4 OPEN could not be physically confirmed in
this session, so all JTAG run tests (including the no-power timing script
`tools/stage6_first_real_pi_shot_real_binary_timing_nopower.js`) were STOPPED.
`ISR_MAX_CYCLES_LE_900` and `OVERRUN_ZERO` are NOT_VERIFIED and must be run on
the bench after CNT3/CNT4 OPEN is confirmed.

## 10. 200 us Timer2 proof

The on-chip 200 us cage is `FIRST_REAL_PI_DURATION_TICKS == 10` (10 × 20 us).
The first PI write records `g_first_real_pi_shot_first_write_timer2` and the
auto-OST records `g_first_real_pi_shot_ost_timer2`. The delta proof requires the
target and is NOT_VERIFIED (CNT34 unconfirmed).

## 11. Final safety state

- `LLC_HARDWARE_PI_VALIDATED = 0`, `LLC_POWER_RUN_ALLOWED = 0`,
  `LLC_CONTROL_DIRECTION = 0`, `LLC_CONTROL_SIGN = -1`.
- PI frequency envelope 145000–170000 Hz, slew 100 Hz/20 us, shot max 200 us,
  VOUT abort at calibrated 11 V raw, Comparator→TZ1→OST, DAC 300, no auto retry.
- No RAM override of the 200 us or 145–170 kHz bounds.
- **NO_REAL_POWER_EXECUTED.**

## 12. Transformer winding relation (C1)

`Ns1:Np:Ns2 = 4:5:4`, `Np = 5T`, `Ns1 = 4T`, `Ns2 = 4T`, `Ns_half = 4T`,
`n = Np/Ns_half = 5/4 = 1.25` — recorded as `ACTUAL_WINDING_RELATION`.
