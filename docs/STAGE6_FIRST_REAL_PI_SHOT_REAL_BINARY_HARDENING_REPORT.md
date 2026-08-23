# STAGE6 FIRST REAL PI SHOT — REAL BINARY HARDENING REPORT (V1-1)

> Task: `STAGE6_FIRST_REAL_PI_SHOT_REAL_BINARY_HARDENING_V1_1_BLOCKER_FIX`
> Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1-1`
> Source baseline: `8201315428e14f288a9a427d29e63c15f8b97b2f` (V1)
> Source commit (build commit): `842c28e` — `stage6: fix real-shot execution gates before no-power timing`
> Evidence commit: `evidence: freeze corrected Stage6 real-shot binary after review fixes` (see git log)
> Compiler: TI CGT C2000 25.11.1.LTS, COFF ABI, `-v28 -ml -mt -g -O4 --opt_for_speed=0 -ms`

## 1. Objective

Harden an isolated REAL shot binary for the first bounded closed-loop PI shot on
the 100 W LLC F28034 board. The REAL binary is synthetic-free, request-only, and
carries a narrow Stage6 limited authorization plus passive realtime observation.
V1-1 fixes the review blockers: the REAL build now legally runs the formal
Profile C trajectory (B), the fast protection path recognizes the limited
authorization (C), the no-handoff path can never enter an unverified RUN (D),
the REAL script is fully sequential with hard preflight gates (E), the no-power
timing script uses real symbols and hard gates (F), and the evidence/static
tests are corrected (G). No real energy shot, no 200 us real PI power test, and
no continuous closed loop were executed.

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

Both builds were made from commit `842c28e` (commit A = source fixes; the
binary is built from that exact commit).

## 4. Frozen artifacts and SHA256 (V1-1)

| Artifact | SHA256 |
|----------|--------|
| REAL OUT (`LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT.out`) | `CAD61C38213535A1A923ADB66A53FB93688EE8AB8A98691F55C0DCC0A3070B72` |
| REAL MAP (`LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT.map`) | `4B167EFCC854BC81684F6B248E2CB02F636373CD4DFC84543C1B244B9A4851B6` |
| NOENERGY OUT (`LLC_100W_F28034_BRINGUP_DSH_NOENERGY.out`) | `496BCED52D3E1168D492228AEDA2B6B2CC2560D66A686A53EB0FE08CD1CDD30A` |
| REVOKED V1 OUT (`LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT_REVOKED_9CE0EFBA.out`) | `9CE0EFBAC3133B444DCD3A5F81E22B5F1B54AB141FA80619BFA7D83920D9CF7A` |

Frozen copies live in `evidence/stage6_first_real_pi_shot_real/`. The REAL OUT
is committed with `git add -f` (`.gitignore` ignores `*.out`/`*.map`).

**V1 OUT revoked.** The V1 REAL OUT (`9ce0efba…`) is preserved under the
`REVOKED_9CE0EFBA` name and marked `REVOKED_BY_REVIEW` + `DO_NOT_EXECUTE`
(`evidence/stage6_first_real_pi_shot_real/REVOKED_9CE0EFBA.txt`). It must NOT
be loaded or executed.

**Non-deterministic build.** TI CGT embeds a build timestamp in the COFF header
(bytes 4–7) and in the debug-info block; two consecutive builds of identical
source produce different SHA256. This is metadata only (no `__DATE__`/`__TIME__`
macros, no code difference). The manifest documents this.

**MAP newline policy.** The frozen MAP is stored as-is (CRLF). `.gitattributes`
marks `evidence/stage6_first_real_pi_shot_real/*.map -text` so git never
normalizes EOL; `REAL_MAP_SHA256` is computed on the raw committed bytes and
matches the manifest and the delivery ZIP.

## 5. B — Formal Profile C legal in the REAL build

`PWM_RuntimeValuesValid` (driver/pwm.c) now accepts the board-verified formal
trajectory **only** while `SHOT_RealSoftStartAuthOk()` holds (runtime limited
auth: Stage6, shot pre-armed, VOUT cal valid, Comp/TZ loopback verified, no
fault, system in SOFT_START, ramp not complete/aborted):

- allowed: TBPRD 239..399, DB 36..110 (250 kHz/DB110 → 150 kHz/DB36);
- outside that context the production range (TBPRD 399..428, DB 36..190)
  applies, so a 200k/250k write can never slip through any other path.

The REAL build does NOT depend on `g_diag_frequency_override`,
`LLC_DIAG_ALLOW_200K_DB140`, or any 200k/DB140 permission. The PI actuator path
uses `LLC_SetFrequencyHz` (which does not call `PWM_RuntimeValuesValid`) and is
clamped to 145..170 kHz by `SHOT_ClampFreq`; the `PROT_SlowTask` frequency gate
caps the bounded-PI context at `FIRST_REAL_PI_MAX_HZ` (170 kHz), so a 250 kHz
PI write is rejected.

## 6. C — Limited-authorization fast protection path

New runtime auth functions in app/shot.c (REAL build only, else 0):

- `SHOT_RealSoftStartAuthOk()` — formal SoftStart ramp actually running;
- `SHOT_RealBoundedPiAuthOk()` — bounded 200 us PI window after the 10 V
  handoff (handoff OK, reference valid, system in RUN).

`PROT_FastTask` raw OVP check now also runs while either limited auth holds
(defense-in-depth; `LLC_OVP_RAW_THRESHOLD` stays 0xFFFF so it is a runtime
no-op, but the code path exists). `PROT_SlowTask` computes
`limited_auth = SoftStartAuth || BoundedPiAuth` and bypasses the global
CAL_MISSING / CONTROL_DIRECTION gates **only** for that window; the
COMP_TZ_LOOPBACK gate stays unconditional, Stage7 stays blocked, IOUT is never
faked, `LLC_CONTROL_DIRECTION` stays 0, and fast OCP remains
Comparator → TZ1 → OST one-shot. The frequency gate is context-split:
SoftStart auth → 250 kHz ceiling (Profile C), bounded-PI auth → 170 kHz,
all other paths → production 150 kHz.

## 7. D — No-handoff infinite-power risk closed

In the REAL build, `SoftStart_FastUpdate` FINAL max-window expiry now calls
`SS_End(SS_RESULT_NOT_REACHED)` and sets `SOFTSTART_ABORTED` — it never enters
an unverified RUN. `SS_End` revokes the shot arm on every abort path
(NOT_REACHED → `SHOT_ABORT_NO_HANDOFF`, HARD_CEILING → `SHOT_ABORT_CEILING`,
ACTIVE_TZ → `SHOT_ABORT_TZ`, else → `SHOT_ABORT_FAULT`), forcing OST + PWM=0
and latching FAULT. Every path ends in one of: handoff success → bounded PI →
200 us auto-OST; 11 V abort → OST; Comparator/TZ → OST; SoftStart not reaching
10 V → OST; actuator/permission/fault failure → OST. No auto retry.

## 8. E — REAL script sequential request + hard gates

`tools/stage6_first_real_pi_shot_real.js` (V1-1):

1. host SHA256 hard gate **before** connect/download;
2. human auth env gate `DSH_CNT34_APPROVED=1`;
3. after `loadProgram`, runs APP_Init to completion (`run(300)`), then halts;
4. hard gates: sys=IDLE, PWM=0, fault=0, OST=1, VOUT cal=1, stage=0;
5. requests the Comparator loopback, runs, halts, verifies
   `g_loopback_diag_result==1 && g_comp_tz_loopback_verified==1`;
6. confirms stages sequentially via the request interface
   (requests 1..7 = Stage1..Stage6, no direct 0→6);
7. each stage confirm verifies `g_bringup_stage==n`, fail → ABORT;
8. final preflight re-verifies all gates (incl. comp verified, stage 6, arm 0);
9. only then: shot arm request + pwm enable request;
10. from formal enable to wait end: no memory reads, no polling, no
    halt/restart — `runAsynch` → `sleep(15 ms)` → `halt`;
11. host wait (15 ms) exceeds the firmware's proven worst-case termination
    (~5 ms request latency + ~3.5 ms ramp + 0.2 ms shot);
12. before halt the firmware has guaranteed PWM=0, OST=1 via the on-chip path
    (SS_HardStop / SHOT_Revoke / PWM_Trip);
13. after halt the black box is read once with strict PASS/FAIL
    (state==COMPLETE, ok==1, abort==TIMEOUT, pwm==0, ost==1, fault==0,
    sys==IDLE, power_writes>0);
14. `g_first_real_pi_shot_power_writes` is read as Uint16 (`rw`), not rv32;
15. preflight is not printing — any gate failure ABORTS (throws).

Forbidden writes remain: fault, system_state, bringup_stage,
active_bringup_stage, calibration_valid, comparator_verified, synthetic VOUT,
ADC result, PWM/TZ/Comparator registers.

## 9. F — No-power timing script symbol + gate fixes

`tools/stage6_first_real_pi_shot_real_binary_timing_nopower.js` (V1-1):

- non-existent `g_control_reference_volts` → `g_voltage_reference` (10.0f
  IEEE-754 bits) + `g_control_vref_raw` (1244);
- non-existent `g_real_timer0_interval_min/max` → real
  `g_real_timer0_entry_interval_min/max`;
- `g_bringup_stage` set to 7 (`BRINGUP_STAGE_6_CLOSED_LOOP`), not 6 (5B);
- hard gates before any test-state write: `DSH_CNT34_OPEN_CONFIRMED=1`, REAL
  OUT SHA256 match, fault=0, OST=1, PWM=0, AQCSFRC explicitly force-low
  (CSFA=CSFB=AQ_CLEAR, verified by read-back);
- forbidden: auto-clear fault, clear OST, any TZCLR.OST, any real enable
  request, any power shot; if OST/AQCSFRC are not satisfied the script exits
  immediately without writing run state.

**STATUS: NOT EXECUTED** (CNT3/CNT4 OPEN unconfirmed; see §11).

## 10. G — Evidence and static test corrections

- Static tests run on a clean checkout: when the local `Stage6_FLASH_SHOT_*`
  build dirs are absent, the committed evidence REAL MAP/OUT are audited
  instead (artifact source is printed).
- New regressions: REAL Profile C TBPRD239/DB110 allowed; REAL PI actuator
  250k rejected; SoftStart vs PI frequency gates separated; PROT_FastTask
  recognizes limited auth; no-handoff final OST; stage requests 1→2→3→4→5→6;
  timing-script symbols all exist in the REAL MAP; preflight hard gates; no
  fault clearing; `power_writes` read as Uint16.
- `REAL_BUILD_MANIFEST.txt` accounting fixed: commit A = source fixes (build
  from commit A, `842c28e`); commit B = freeze OUT/MAP/report; the manifest
  records `SOURCE_COMMIT` (commit A) and names the evidence commit.
- Frozen MAP newline policy: `.gitattributes` marks the frozen MAP `-text`;
  manifest/report/repo bytes are consistent (SHA on raw bytes).
- New REAL OUT/MAP frozen; old `9ce0efba` OUT marked `REVOKED_BY_REVIEW` +
  `DO_NOT_EXECUTE` and preserved under the REVOKED name.
- The REAL/NOENERGY bit-difference claim is now verifiable: the NOENERGY OUT is
  frozen in evidence with its SHA256.
- The delivery ZIP includes the frozen OUT/MAP (see `deliverables/README.md`).

## 11. Realtime timing gate (K)

Instrumentation present in the REAL binary: `g_real_isr_cycles_last/max/sum/count`,
`g_real_isr_overrun_count`, `g_real_timer0_entry_count/last_entry/entry_interval_min/max`,
`g_first_real_pi_shot_first_write_timer2`, `g_first_real_pi_shot_ost_timer2`.

**STATUS: NOT EXECUTED.** CNT3/CNT4 OPEN could not be physically confirmed in
this session, so all JTAG run tests (including the no-power timing script)
were STOPPED. `ISR_MAX_CYCLES_LE_900` and `OVERRUN_ZERO` are NOT_VERIFIED and
must be run on the bench after CNT3/CNT4 OPEN is confirmed.

## 12. 200 us Timer2 proof

The on-chip 200 us cage is `FIRST_REAL_PI_DURATION_TICKS == 10` (10 × 20 us).
The first PI write records `g_first_real_pi_shot_first_write_timer2` and the
auto-OST records `g_first_real_pi_shot_ost_timer2`. The delta proof requires the
target and is NOT_VERIFIED (CNT34 unconfirmed).

## 13. Final safety state

- `LLC_HARDWARE_PI_VALIDATED = 0`, `LLC_POWER_RUN_ALLOWED = 0`,
  `LLC_CONTROL_DIRECTION = 0`, `LLC_CONTROL_SIGN = -1`.
- PI frequency envelope 145000–170000 Hz, slew 100 Hz/20 us, shot max 200 us,
  VOUT abort at calibrated 11 V raw, Comparator→TZ1→OST, DAC 300, no auto retry.
- No RAM override of the 200 us or 145–170 kHz bounds.
- **NO_REAL_POWER_EXECUTED.**
- **CNT3/CNT4 REMAIN OPEN.**
- **TIMING_NOT_EXECUTED.**

## 14. Transformer winding relation (C1)

`Ns1:Np:Ns2 = 4:5:4`, `Np = 5T`, `Ns1 = 4T`, `Ns2 = 4T`, `Ns_half = 4T`,
`n = Np/Ns_half = 5/4 = 1.25` — recorded as `ACTUAL_WINDING_RELATION`.
