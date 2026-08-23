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


## 15. V1-2 — Fresh PI timing harness closure

Task: `STAGE6_REAL_BINARY_TIMING_HARNESS_FRESH_PATH_CLOSURE_V1` (offline only).

### 15.1 Timing coverage (B) — `tools/stage6_first_real_pi_shot_real_binary_timing_nopower.js`

After all safety hard gates pass (fault=0, OST=1, PWM=0, AQCSFRC force-low
verified by read-back), the script manufactures **exactly once** a
deterministic fresh control input (RAM writes only; no synthetic injection in
REAL firmware):

| symbol | value | purpose |
|---|---|---|
| `g_control_adc_sequence_last` | 0 | force the first control tick FRESH |
| `g_adc_sample_sequence` | 1 | new sample sequence (ADC ISR advances it) |
| `g_adc_vout_raw` / `g_adc_vout_filtered_raw` | 1200 | VOUT raw != Vref raw |
| `g_control_vref_raw` | 1244 | 10 V board-calibrated raw |
| `g_control_frequency_hz` / `g_control_shadow_frequency_hz` | 150000 | PI base |
| `g_switching_frequency_hz` | 150000 | same-frequency fast path disabled |
| `g_pwm_period` | 399 | 150 kHz baseline period |

First control tick: `sample_valid=1`, `error_raw=44 != 0`, PI update happens,
frequency command moves away from 150000, so `LLC_SetFrequencyHz` takes the
**full non-same-frequency path** (period recompute + TBPRD/CMPA write + ADC
sync), `power_writes++`, and the ring buffer records `fresh_sample=1`. Later
samples may be stale; `g_real_isr_cycles_max` must capture this first worst
fresh tick. All symbols verified present in the frozen REAL MAP
(`4B167EFC...`); no firmware change required — REAL OUT stays `CAD61C38...`.

### 15.2 Timing result hard gates (C)

`fresh_sample_count` delta >= 1, `pi_update_count` delta >= 1,
`power_writes > 0`, ring first entry `fresh_sample == 1`, frequency command
!= 150000, shot `COMPLETE` / `TIMEOUT` / `tick == 10`, PWM == 0, OST == 1,
fault == 0, `g_real_isr_cycles_max <= 900`, `overrun == 0`. Any failure prints
`TIMING_NOPOWER_FAIL` (no real power). `run(2000)` corrected to `run(20)` =
**20 ms** (the old value was 2 SECONDS, not 2 ms): the test state starts
directly in RUN, the 200 us cage ends after ~0.22 ms with on-chip
OST=1/PWM=0/IDLE, and the first fresh tick is captured in the first 20 us.

### 15.3 REAL shot script (D) — `tools/stage6_first_real_pi_shot_real.js`

- Host no-read wait raised **15 ms -> 25 ms** (worst case: 5 ms enable-request
  processing + 5 ms SoftStart PWM start + ~3.5 ms Profile C ramp + FINAL
  window + 0.2 ms PI + termination ≈ 12.2 ms).
- Strict PASS additionally requires `softstart_handoff_result == OK`,
  `softstart_result == COMPLETE`, `shot_tick == 10`, `ring_buffer_count == 11`,
  `power_writes == 11` (Uint16), and
  `timer2_delta = first_write_timer2 - ost_timer2` within
  **11000..14000 cycles** (~200 us @ 60 MHz; conservative static gate — the
  final exact tolerance is set from the no-power timing results).

### 15.4 Static regressions (E)

`tools/stage6_real_binary_hardening_static_test.py` extended: fresh-sequence
manufacture (exactly once), VOUT raw != Vref raw, full actuator
frequency-change path required, timing PASS depends on
fresh/pi_update/power_writes and PWM0/OST1/fault0, REAL script waits >= 25 ms,
REAL strict PASS checks handoff/tick/ring/writes/Timer2 delta, and the
Stage6/Stage7 numeric comments (`BRINGUP_STAGE_6_CLOSED_LOOP == 7`,
`BRINGUP_STAGE_7_POWER_RUN == 8`). All checks PASS from the repo and from a
clean checkout.

### 15.5 Delivery

Only `tools/`, static tests, docs/evidence text and the delivery ZIP changed.
Firmware source unchanged -> REAL OUT **not rebuilt**, SHA stays
`CAD61C38213535A1A923ADB66A53FB93688EE8AB8A98691F55C0DCC0A3070B72`.
Commit: `tools: exercise fresh PI actuator path in Stage6 no-power timing gate`.


## 16. V1-3 — Period-write closure of the no-power timing harness

Task: `STAGE6_REAL_BINARY_TIMING_HARNESS_PERIOD_WRITE_CLOSURE_V1_3` (offline only).

### 16.1 Deterministic period-changing first write (B)

The fresh control input from V1-2 is kept
(`g_control_adc_sequence_last=0`, `g_adc_sample_sequence=1`,
`g_adc_vout_raw=g_adc_vout_filtered_raw=1200`, `g_control_vref_raw=1244`),
but the initial frequency state is changed to
`g_control_frequency_hz = g_control_shadow_frequency_hz =
g_switching_frequency_hz = 149900`, `g_pwm_period = 399`.

First fresh PI tick: `error_raw = 1244 - 1200 = +44`; the Q12 step is clamped
to `-100 Hz/tick` (`CTRL_MAX_STEP_Q12`), so the frequency command becomes
exactly **149800 Hz**. `period(149800) = round(60000000/149800) - 1 = 400`
differs from `g_pwm_period` (399), which forces the **full period-changing
actuator path** in `LLC_SetFrequencyHz`:

- period division (`period = (TBCLK + hz/2) / hz - 1`),
- `EPwm1Regs.TBPRD` write (400),
- `EPwm1Regs.CMPA` write (200),
- `ADC_UpdatePwmSyncPointKeepCadence` (SOCA phase re-position),
- `g_pwm_period` update (400),
- `g_actual_switching_frequency_hz` update (`60000000/401 = 149625 Hz`).

Integer arithmetic (verified in the static test, not just string matching):
`period(150000) = 399`, `period(149900) = 399`, `period(149800) = 400`,
`initial period != result period`.

### 16.2 Pre/post period hard gates (C)

Pre-run READ-ONLY: `EPwm1Regs.TBPRD == 399` and `g_pwm_period == 399`
(init baseline `LLC_BASELINE_PERIOD_150K == 399`). Post-run strict gates on
the ring first entry (records the FIRST write's state because `CTRL_FastTask`
runs before `SHOT_FastTask`): `fresh_sample == 1`, `freq_cmd_hz == 149800`,
`tbprd == 400` (the value written to `EPwm1Regs.TBPRD` and stored in
`g_pwm_period` at the first write), `actual_freq_hz == 149625`. The old
`freq_cmd != 150000` gate is removed — the TBPRD change and the
actual-frequency update are required, preventing
`FREQUENCY_CHANGED_BUT_TBPRD_UNCHANGED`. (Post-run globals hold the LAST
write's state — 11 steps of -100 Hz from 149900: `freq=148800`,
`period=402`, `TBPRD=402`, `actual=148883` — printed as evidence.)

### 16.3 Timer2 no-power hard gate (D)

`timer2_delta = (g_first_real_pi_shot_first_write_timer2 -
g_first_real_pi_shot_ost_timer2)` unsigned 32-bit, hard gate
`11000 <= delta <= 14000` (~200 us @ 60 MHz), with
`FIRST_WRITE_TIMER2` / `OST_TIMER2` / `TIMER2_DELTA` printed. Any failure ->
`TIMING_NOPOWER_FAIL`.

### 16.4 Result consistency (E)

Added: `g_first_real_pi_shot_ok == 1`, `rb_count == 11`,
`power_writes delta == 11`, `g_real_isr_cycles_count > 0`,
`g_real_timer0_entry_count > 0`. Kept: `state == COMPLETE`,
`abort == TIMEOUT`, `tick == 10`, `PWM == 0`, `OST == 1`, `fault == 0`,
`isr_max <= 900`, `overrun == 0`.

### 16.5 Static regressions (F)

`tools/stage6_real_binary_hardening_static_test.py` now performs actual
integer period arithmetic (`period(150000)==399`, `period(149900)==399`,
`period(149800)==400`), verifies the initial frequency state is 149900, the
expected first command is 149800, and `initial period != result period`, and
requires the `RING_FIRST_TBPRD_400` / `RING_FIRST_ACTUAL_149625` gates
(explicitly preventing `FREQUENCY_CHANGED_BUT_TBPRD_UNCHANGED`).

### 16.6 Delivery

Only `tools/`, static tests, docs/evidence text and the delivery ZIP changed.
Firmware source unchanged -> REAL OUT **not rebuilt**, SHA stays
`CAD61C38213535A1A923ADB66A53FB93688EE8AB8A98691F55C0DCC0A3070B72`.
Commit: `tools: force period-changing actuator path in Stage6 no-power timing gate`.


## 17. EXEC V1 — No-power timing execution (real target, CNT3/CNT4 OPEN)

Task: `STAGE6_REAL_BINARY_NOPOWER_TIMING_EXECUTION_V1`.

### 17.1 Execution

CNT3/CNT4 were physically confirmed OPEN by the field operator;
`DSH_CNT34_OPEN_CONFIRMED=1` was set. The frozen REAL OUT
(`CAD61C38213535A1A923ADB66A53FB93688EE8AB8A98691F55C0DCC0A3070B72`) was
SHA-256 verified on the host before connect. `tools/stage6_first_real_pi_shot_real_binary_timing_nopower.js`
was executed once (run(20), single stop, black-box read). RAW log:
`evidence/stage6_first_real_pi_shot_real/NOPOWER_TIMING_RAW_V1.txt`;
structured result: `NOPOWER_TIMING_RESULT_V1.json`.

### 17.2 Result: NOPOWER_TIMING_FAIL

Gate `ISR_MAX_LE_900` FAIL: `g_real_isr_cycles_max = 1406` cycles
(23.4 us @ 60 MHz) > 900-cycle gate; `g_real_isr_overrun_count = 1`
(firmware overrun threshold 1200, protection.c:386);
`timer0_entry_interval_max = 1472` cycles (24.5 us) confirms a real ISR
overrun during the 20 ms window — the period-changing write path of the
first bounded shot (LLC_SetFrequencyHz full path: period division,
TBPRD/CMPA write, ADC sync) exceeds the 20 us TINT0 budget.

All other gates PASS: host SHA256, CNT34 open, fault=0, OST=1, PWM=0,
AQCSFRC force-low (all=5, CSFA=CSFB=1), PRE TBPRD=399, PRE g_pwm_period=0
(APP_Init Stage-0-SAFE clear, app.c:93), fresh_delta=1, pi_delta=1,
power_writes delta=11, ring[0] fresh=1 freq_cmd_hz=149800 tbprd=400
actual_freq_hz=149625, state=COMPLETE abort=TIMEOUT tick=10 ok=1
rb_count=11, PWM=0 OST=1 fault=0, ISR count=1695>0, Timer0 entry=1696>0,
TIMER2_DELTA=11997 (11000..14000, ~200 us).

### 17.3 Measurement integrity

The suspended-ISR drain ran clean (drain[0] max=458); a suspended-ISR
pollution would read ~1e5-1e6 cycles (halt-time delta), not 1406. The
1406-cycle reading is a REAL firmware measurement.

### 17.4 Script fixes made during execution

- `String.format` (Rhino has no static JS String.format) -> pure JS hex.
- Java String `!==` compares by identity in Rhino -> `.equals()`.
- AQCSFRC `.all = 0x11` write did not take effect on the target ->
  bit-field writes `AQCSFRC.bit.CSFA/CSFB = 1` (firmware idiom), verified
  by read-back (all=5).
- PRE `g_pwm_period==399` assumption contradicted by the frozen firmware
  (APP_Init app.c:93 clears it to 0 for Stage 0 SAFE) -> gate
  `PRE_RUN_PERIOD_ZERO` (g_pwm_period==0) with TBPRD==399; the test-state
  write sets g_pwm_period=399 and ring[0].tbprd==400 proves the 399->400
  change.
- Suspended-ISR measurement pollution (a halt can suspend a TINT0 ISR; on
  the next run it completes with a halt-time Timer2 delta) -> 1 ms drain
  windows until max<=900, plus a whole-flow measurement-pollution retry
  (max>10000) that re-loads the program and re-checks every safety gate.
  This is a measurement-artifact retry, NOT a gate-failure retry.

### 17.5 Stop condition

Per the task rule "any gate failure -> NOPOWER_TIMING_FAIL, stop
immediately", no retry was performed. CNT3/CNT4 remain OPEN. No real
power was executed. The first REAL 200 us PI shot authorization is NOT
requested — the ISR budget failure must be resolved first.


## 18. RECOVERY V1 — REAL PI fastpath timing recovery

Task: `STAGE6_REAL_PI_FASTPATH_TIMING_RECOVERY_V1`.

### 18.1 A: V1 evidence JSON corrected

`NOPOWER_TIMING_RESULT_V1.json` was corrected from the authoritative RAW
(`NOPOWER_TIMING_RAW_V1.txt`, line-level parse): real_isr_cycles_count=1695,
timer0_entry_count=1696, power_writes_delta=11, post_run_g_pwm_period=400,
post_run_tbprd=400, post_run_actual=149625. An automatic consistency gate
(re-parse RAW vs JSON, every measurement must match exactly) is embedded in
the JSON (`consistency_gate.result=PASS`). The original RAW was not touched.

### 18.2 B: formal-handoff fastpath reproduction (same frozen CAD61C38 OUT)

The V1 timing constructed RUN without `g_pwm_fastpath_ready`, so every write
tick re-ran `PWM_ConfigMatchesFrozenBaseline()` (pwm.c:228) — the dominant
actuator cost. The harness now read-only verifies the full handoff state
(topology CTRMODE/HSPCLKDIV/CLKDIV/PRDLD, CMPCTL shadow/load, AQCTLA
ZRO=SET/CAU=CLEAR, AQCTLB=0, DBCTL FULL/HIC/DBA_ALL, TZSEL OSHT1, TZCTL
TZA/TZB=FORCE_LO, TBPRD=399, CMPA=200, DBRED=DBFED=36, OST=1, AQCSFRC
force-low, fault=0, PWM=0), then writes `g_pwm_fastpath_ready=1` and the
closed-loop ADC cadence (SOCASEL=ET_CTRU_CMPB, SOCAEN=1, SOCAPRD=ET_3RD).
All FASTPATH_* gates PASSED. Result (clean measurement, attempt 3 after two
suspended-ISR pollution retries):

  FASTPATH_READY_REAL_ISR_MAX = 1256 cycles (was 1406 without fastpath_ready)
  FASTPATH_READY_OVERRUN = 1 (firmware threshold 1200)
  FASTPATH_READY_ENTRY_INTERVAL_MAX = 1322 cycles
  TIMER2_DELTA = 11874 (11000..14000 PASS)
  ring[0] fresh=1 freq_cmd_hz=149800 tbprd=400 actual_freq_hz=149625
  power_writes delta=11, rb_count=11, state=COMPLETE, abort=TIMEOUT,
  tick=10, ok=1, PWM=0, OST=1, fault=0

Verdict: RECOVERY_V1_NEEDS_FIRMWARE_OPTIMIZATION (1256 > 900, overrun=1) —
proceeded to C/D per the task rule (no re-ask).

### 18.3 C: bounded PI period computation without division

`LLC_SetFrequencyHz` bounded fastpath (145000..170000 Hz, g_pwm_period!=0):
  sum = 60000000 + hz/2; clocks = g_pwm_period + 1;
  if ((clocks+1)*hz <= sum) clocks++; else if (clocks*hz > sum) clocks--;
  period = clocks - 1;
The result is verified by multiplication (clocks*hz <= sum < (clocks+1)*hz,
i.e. clocks == floor(sum/hz)). If one adjustment is not enough (period would
move by more than +/-1, or state/command mismatch), the actuator refuses to
write a wrong period: SHOT_Revoke(SHOT_ABORT_ACTUATOR) -> OST, PWM=0,
FAULT_FIRST_SHOT_ABORT, safe failure. cmp = (period+1)>>1 (shift).

### 18.4 D: actual-frequency Flash lookup

Read-only `.econst` table `g_real_pi_actual_hz_table[62]` (TBPRD 352..413,
248 bytes Flash): actual_hz[period-352] = 60000000/(period+1), integer
division, identical to the reference formula. The bounded PI fastpath never
runs a runtime division; it never writes actual = command (e.g. command
149800 -> TBPRD 400 -> actual 149625).

### 18.5 E: generic path preserved

hz < 145000 (init / open loop / diagnostics) and g_pwm_period==0 keep the
original division algorithm. Formal Profile C SoftStart behavior unchanged
(250k->150k, DB110->DB36, 10V handoff, 11V abort, 12V ceiling,
Comparator/TZ, 200us cage).

### 18.6 F: equivalence exhaustive test

`tools/stage6_real_pi_fastpath_equivalence_test.py`: 10,180,275 checks —
every integer frequency 145000..170000 from every adjacent period state, and
every legal adjacent transition (current +/- 0..100 Hz). fastpath period ==
reference division period 100%; period delta always 0 or +/-1; actual lookup
== 60000000/(period+1). Key points: 150000->399, 149900->399, 149800->400,
170000->352, 145000->413. EQUIVALENCE_TEST_PASS.

### 18.7 G: divide-helper audit

See `FASTPATH_DIVIDE_HELPER_AUDIT.txt`. DIVIDE_HELPER_AUDIT_PASS: the bounded
PI actuator path performs no 32-bit division and calls no runtime divide
helper (no __c28xabi_div* in the map; disassembly of the bounded body shows
only IMPYL/IMPYAL/ADDUL/SUBUL/CMPL/shift/table-lookup + SHOT_Revoke).
LLC_SetFrequencyHz grew 109 -> 208 words (+198 bytes); table 124 words
(248 bytes) Flash.

### 18.8 H: candidate OUT

New REAL candidate OUT SHA256 = `{new_sha}` (Stage6_FLASH_SHOT_REAL,
CGT 25.11.1.LTS, COFF). Old CAD61C38 OUT is preserved as
TIMING_FAILED_1406_CYCLES / DO_NOT_EXECUTE_REAL_POWER; old RAW evidence
untouched. NOENERGY and REAL builds remain isolated.
