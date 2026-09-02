# W2_OPEN_LOOP_STEADY_PLANT_CHARACTERIZATION_REPORT (V1)

Work order: `C:\Users\lapyin\Downloads\100W_LLC_SOL_MAX_一条龙总控工作单_2026-08-25.txt`
Branch: `stage6/sol-one-shot-to-100w-v1`
Task (operator-approved, verbatim): `W2_OPEN_LOOP_STEADY_PLANT_CHARACTERIZATION_V1`

## 1. Decision and authority

Candidate4 (`W2_CANDIDATE_PRE_HANDOFF_ENERGY_STATE_SHAPING`) is CLOSED: 4 real
2MS runs at the same OUT SHA
(`E48DE5A9A7A2075C50C62F986BFB2F97DCB161648DAEEF2BCB93D902CF52FB92`) all failed
(3× COMP/TZ1 at pre-brake entry_raw≈1359-1362; 1× NO_HANDOFF with CNT3/4 open).
`W2_REAL_ATTEMPT_COUNT=7`. No further same-SHA retries (work-order rule).

The operator approved an independent experimental mode instead:
**OPEN_LOOP_STEADY** — a real steady-state Vout-vs-frequency plant map on the
real F28034+LLC board, with ALL SoftStart→PI handoff modifications PAUSED.
This is a NEW experiment mode, not a Candidate4 retry: new OUT SHA, new
protocol, new evidence directory.

Safety invariants (unchanged from the work order):
- PI/2P2Z/Kp-Ki untouched; DAC300, Comparator/TZ/blanking, qualification, and
  all existing thresholds untouched. The experiment only ADDS tighter guards:
  WARNING at raw 1304 (10.47 V) planned-OST boundary, HARD abort at raw 1367
  (frozen 11 V formula) = `FAULT_OPEN_LOOP_VOUT_CEILING` 0x00020000.
- Experimental frequency envelope 145..170 kHz is compile-time in this build
  only (`OPEN_LOOP_FREQ_MIN_HZ/MAX_HZ`); 12 V ceiling never approachable
  (hard abort fires first); every run ends PWM=0/OST=1/TZINT=0.
- First round never below 150 kHz (descending staircase starts at 170 kHz).
- Any fault → stop, NO auto retry.

## 2. Firmware design freeze (STAGE6_OPEN_LOOP_STEADY_BUILD)

| Item | Value |
|---|---|
| Entry frequency | `OPEN_LOOP_ENTRY_FREQ_HZ = 170000` (envelope max = lowest LLC gain) |
| Envelope | 145..170 kHz, enforced in `SM_StageAllowsFrequency`, `LLC_SetFrequencyHz`, `OPENLOOP_Step` clamp |
| Slew | ≤500 Hz per fresh ADC sample (10..5000 clamp), host command only |
| Steady detection | 2 consecutive 100 ms windows with |Δmean| ≤ 3 raw, after ≥10 000 ticks (200 ms) settle |
| Planned OST (WARNING) | raw ≥ 1304 → `LLC_PWM_DisableSafe()` in TINT0, no fault latched, `upper_gain_boundary=1` |
| HARD abort | raw ≥ 1367 → `PWM_Trip(FAULT_OPEN_LOOP_VOUT_CEILING=0x00020000)` |
| Max-hold backstop | 600 000 ticks (12 s) → planned OST |
| Stop protocol | first-stop-wins snapshot; every stop ends PWM=0/OST=1/TZINT=0 |
| ADC cadence | closed-loop mode (ET_3RD @ ET_CTR_CMPB, INT1CONT=1, ~50 kS/s) matching the 20 µs tick |
| RAM | module data in dedicated `ol_ram` section @ RAML3 (every variable explicitly initialized; COFF cinit copies; `OPENLOOP_Init()` re-establishes at boot) |
| Mutual exclusion | `#error` in `llc_config.h` vs `STAGE6_FIRST_BOUNDED_REAL_PI_SHOT` / `STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD`; NE combo `+STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST` allowed |
| Synthetic-free REAL | all NE-only symbols inside `#if ...&&STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST`; REAL map verified 0 `ne_*` symbols |

Protection integration (compile-gated, other builds unchanged):
- `protection.c` TINT0 dispatch swaps `CTRL_FastTask()` for
  `OPENLOOP_FastTask()` (REAL) / `OPENLOOP_NoEnergyTick()` (NE build).
- `protection.c` `PROT_SlowTask` Stage-5A frequency legality: under
  `STAGE6_OPEN_LOOP_STEADY_BUILD` the accepted window is 145..170 kHz
  (legacy window `g_open_loop_min_frequency_hz..LLC_HARD_MAX_HZ=150 kHz`
  would self-trip `FAULT_ILLEGAL_FREQUENCY` above 150 kHz). All other builds
  keep the legacy window.
- `pwm.c` `LLC_SetFrequencyHz`: OL envelope guard before the diagnostic
  override branch (`#elif !STAGE6_OPEN_LOOP_STEADY_BUILD`).
- `state_machine.c`: 5A frequency select → entry 170 kHz; ADC closed-loop
  cadence; `OPENLOOP_NotifyEntry()` after RUN; `OPENLOOP_NotifyExit()` after
  the falling-edge safe disable.
- `app.c`: `OPENLOOP_Init()` after `SHOT_Init()` block, before interrupts.
- `28034_FLASH_lnk.cmd`: `ol_ram > RAML3`.

Arrival-marker semantics fix (verified on target): `slew_done_tick` is set as
soon as the applied frequency lands on the effective command, BEFORE the NE
actuator gate, so slew/settle statistics are meaningful with the actuator
gated off.

## 3. Build freeze (binaries + SHA256)

| Artifact | SHA256 |
|---|---|
| `Stage6_OL_STEADY\LLC_100W_F28034_OPEN_LOOP_STEADY.out` (REAL) | `c524f10c7d65ee99f660b147c100f84fcdfc85442e4d48d411e8b1381c45aeab` |
| `Stage6_OL_STEADY_NE\LLC_100W_F28034_OPEN_LOOP_STEADY_NE.out` (NE harness) | `4d96f1da455386f4115205b961adb55f283229725e1e6d908179aa5170ac0f99` |

Map sanity: REAL `.ebss` 0x3a4 @RAML2, `ol_ram` 0x58 @RAML3 (0x9000),
`shot_ram` free; NE `.ebss` 0x3fc, `ol_ram` 0xa0. `NE_SYMBOLS_IN_REAL=0`
(verified after the final rebuild). Frozen manifest:
`evidence/sol_master_execution/w2_open_loop_steady/REAL_OPEN_LOOP_STEADY_SHA256SUMS.txt`
(the REAL matrix script hard-gates on it and aborts on mismatch).

Build logs: `build_ne_r2/r3.log`, `build_real_r2/r3.log` (BUILD OK, CGT
25.11.1.LTS, COFF, flash-linked, `--entry_point=code_start`).

## 4. On-target no-energy proof (SOL_W2_OPEN_LOOP_STEADY_NOENERGY_PASS=TRUE)

Harness `tools/sol_w2_open_loop_steady_noenergy.js` against the NE binary,
synthetic raw driven by the host (`g_open_loop_ne_raw`), actuator armed only
under OST+arm. 95 checks TRUE / 0 FALSE (r4 regression includes the slow-task
patch). Evidence: `ne_harness_console_r3.log` (frozen run), `_r4.log`.

| Scenario | Proof |
|---|---|
| S5a steady-flat | constant raw 1000 → `steady_reached=1`, settle_ms=300, win_index=4, steady_ticks=20000 |
| S5b drift | alternating raw (120 ms steps) → `steady_reached=0` through 700 ms |
| S1 slew trajectory | `ne_trace[0..15]` = 169500..162000 exact; 40 steps 170k→150k; slew_done_tick=40; settle_ms=299; actuator gated (TBPRD stays 399) |
| S2 command clamp | 200k→eff 170k, 100k→eff 145k, clamp_count>0 |
| S3 WARNING stop | raw 1310 → stop_reason=2, upper_boundary=1, fault=0 |
| S4 HARD abort | raw 1370 → fault 0x00020000, SYS_STATE_FAULT, stop_reason=3 |
| S7 actuator under OST+arm | TBPRD=386 @155 kHz, CMPA=193, DB 36/36, `g_switching_frequency_hz`=155000, actual ±100 Hz, PWM stays 0, OST stays 1 |
| S6 timeout backstop | ne_max_hold_ticks=600 → stop_reason=4 |
| S8 TINT0 budget | 200 ms → entry-count delta 10628 (~20.0 µs cadence), interval max 1233 cycles (20.6 µs), whole-ISR max 1062 cycles (17.7 µs) |
| S9 end-state | PWM=0/OST=1/TZINT=0 after EVERY scenario |

## 5. REAL matrix protocol (armed, awaiting physical authorization)

Script: `tools/sol_w2_open_loop_matrix.js` (dry-run verified: all human gates
checked before any target interaction; SHA hard gate before loadProgram).

Hard gates (all must be 1, else abort with no target contact):
`DSH_OPEN_LOOP_MATRIX_AUTHORIZED`, `DSH_CR15_OHM_CONFIRMED`,
`DSH_OPERATOR_PRESENT_CONFIRMED`, `DSH_VIN_24V_CONFIRMED`,
`DSH_INPUT_LIMIT_0_5A_CONFIRMED`, `DSH_CNT34_PERMANENT_CONNECTED_CONFIRMED`,
plus the frozen SHA256 equality.

Sequence: boot gates → COMP/TZ loopback (`g_comp_tz_loopback_verified=1`) →
stage confirms 1..5 (5 = 5A) → per point DESCENDING
170k→165k→160k→157.5k→155k→152.5k→150k: preflight → command+slew → enable →
~100 ms polls (freq_applied, Vout raw/V, IPRI, phase, steady, stop, fault) →
steady + 2 s dwell → planned OST (`g_pwm_enable_request=0`) → end-state
PWM0/OST1/TZINT0 → stop snapshot → CSV append
(`open_loop_matrix_real.csv`; Vin, Load, Frequency_Hz, TBPRD, Vout
mean/min/max/ripple, IPRI mean/max, COMP_event, TZ_event, settling_time_ms,
steady_state_valid, stop_reason, upper_gain_boundary, fault_flags).

Branch rules: WARNING auto-stop = valid experimental outcome — record
`OPEN_LOOP_UPPER_GAIN_BOUNDARY` at `freq_applied` and skip lower points; HARD
abort or any fault → abort matrix, NO retry; TIMEOUT → row with
steady_state_valid=0.

Input-power sanity: CR15 at ≤10.5 V → ≈0.33-0.4 A at 24 V input < 0.5 A limit.

## 6. Status

- OPEN_LOOP_STEADY firmware + builds: FROZEN (this document).
- NE proof: COMPLETE (PASS).
- REAL matrix: ARMED, NOT FIRED. Waiting on operator physical confirmation
  (CR15 15 Ω load connected, Vin 24 V verified, 0.5 A input limit set,
  CNT3/4 connected) — to be granted via the authorization question.
- W2 SoftStart→PI handoff modifications remain PAUSED.


## 7. REAL fire attempt #1 (170 kHz entry, CR15, Vin 24 V / 0.5 A limit) — COMP/TZ1 trip, NO retry



Operator-authorized. SHA hard gate PASS (`c524f10c…aeab`), all six human gates PASS, boot gates

PASS, COMP/TZ loopback PASS, stage confirms 1..5 PASS, preflight PASS.



First point = 170 000 Hz (lowest gain inside the experimental envelope). The actuator path

succeeded and then the hardware protection tripped:



| Observation | Value |

|---|---|

| `LLC_SetFrequencyHz(170000)` | succeeded, `TBPRD` 399 → 352 |

| `LLC_PWM_Enable()` | armed TZ (`TZEINT=0x4`), released OST |

| Trip | `TZFLG=0x5` (OST re-latched + TZ INT), `TZSEL=0x100` (OSHT1 = TZ1) |

| `g_fault_flags` | `0x00000010` = `FAULT_COMP_TZ1` |

| `g_system_state` | 4 (`SYS_STATE_FAULT`) |

| Vout / IPRI | raw 14..16 (≈0.05 V) / 0..3 — the trip preceded any meaningful energy transfer |

| Module behaviour | froze `stop_reason=5` (`OL_STOP_FAULT_EXTERNAL`), no slew, no auto retry |

| End state | PWM=0 / OST=1, board SAFE |



Interpretation: the COMP/TZ1 event is **not** produced by the SoftStart→PI handoff (that path is

bypassed and PAUSED in this build). It occurs with a static 170 kHz / 50 % duty command on the

first switching cycles, i.e. a start-up inrush seen by the primary-current comparator.



Per work-order rule: **any fault → STOP, NO automatic retry.** A further real fire requires either

a new proven change or a new physical condition, plus a fresh operator authorization.



Evidence: `matrix_real_console_r1.log`, `real_point1_trip_console.log`.


## 8. REAL attempts #2/#3 (15 ohm load ON): load-independent COMP/TZ1, zero ticks processed

Standing power-run authority granted by the operator; electronic load ON (CR 15 ohm) for #2/#3
(it had been OFF for attempt #1).

| Observation | r2 (matrix re-run) | r3 (forensic capture) |
|---|---|---|
| SHA hard gate | PASS (same binary) | PASS (same binary) |
| Enable gate | `POINT_170000_ENABLE: FAIL` | same, instrumented |
| `g_fault_flags` | (RAM state lost before forensics) | `0x00000010` = `FAULT_COMP_TZ1` |
| Stop snapshot | — | `reason=5`, `freq_applied=170000`, `freq_actual=169971`, `TBPRD=352`, `CMPA=176` |
| Control ticks processed | — | **0** (all window accumulators 0, `ipri_mean/max=0`, `compsts_high=0`) |
| TZ events | — | 1 (single `TZ1` one-shot) |
| End state | PWM=0/OST=1 | PWM=0/OST=1 |

**Load-independent**: the trip reproduces with the load OFF (#1) and ON (#2/#3). The module
freezes before processing a single control tick — the hardware `TZ1` one-shot fires within the
first switching cycles (< ~20 µs) of an abrupt 170 kHz / 50 % duty start into a discharged
output capacitor. `LLC_SetFrequencyHz` and the actuator path are fully valid; the defect is the
**entry strategy**, not the command path, and the protection is working correctly (candidate4's
real runs climbed to 10.9 V before any trip because the formal SoftStart ramp was active).

Conclusion for the experiment: an abrupt cold start cannot pass the frozen OCP. Open-loop plant
characterization requires a controlled charge-up (formal SoftStart charge → open-loop takeover at
the handoff point, or an open-loop-internal start-up ramp) — a NEW proven SHA plus a fresh
operator gate before the next real fire.

Evidence: `matrix_real_console_r2.log`, `real_trip_forensics_15ohm.log`.

## 9. Entry redesign v2 — W2_OL_SOFTSTART_TAKEOVER_ENTRY_V1 (NE-proven, armed)

### 9.1 Root cause carried in from sections 7–8

An abrupt 170 kHz / 50 % duty cold start into a discharged output cap exceeds the frozen OCP
within the first switching cycles, load-independently. The formal SoftStart engine avoids exactly
this with its board-verified Profile C trajectory: **250 kHz / DB110 hold (15 cycles) → DB
110→36 in 15×10-cycle stages → period 239→399 (250→150 kHz) in 16×10-cycle stages → FINAL**.
DB110 at start means ~22 % effective duty (near-zero energy); the plant is charged gradually
while the frequency is far above the resonance. Candidate4's real runs climbed to 10.9 V
through this ramp without an OCP trip — the ramp is the proven anti-inrush mechanism.

### 9.2 Design v2 (real build only; `soft_start.c` untouched)

- **SM 5A enable** (state_machine.c): `BRINGUP_STAGE_5A_OPEN_LOOP_MANUAL` now arms
  `g_open_loop_takeover_armed` and calls the FORMAL `SoftStart_Begin()` — sys stays IDLE;
  `SoftStart_Update5ms()` consumes the request and sets `SYS_STATE_SOFT_START` itself, exactly
  like the Stage 6/7 path. No frequency command, no direct PWM enable at enable time.
- **OL takeover** (open_loop_steady.c `OL_TakeoverPoll`, called from both the REAL FastTask and
  the NE tick): when the trajectory reaches **PHASE_B stage 10** (period 339 ≈ **176.47 kHz**,
  DB already converged to 36, Vout still far below the WARNING ceiling), the OL module:
  parks the engine at `SOFTSTART_ABORTED` (exits the EPwm1-cycle dispatch in power_probe.c
  **without** `SS_End`/`SS_HardStop` — PWM keeps running), restores the OL ADC cadence
  (`ADC_SetClosedLoopSyncTriggerMode` + `ADC_UpdatePwmSyncPointKeepCadence`) and re-enables the
  ADCINT1 vector (FastUpdate owned both during the ramp), computes the applied frequency from
  the live `g_pwm_period`, runs `OL_SessionInit(applied)` and publishes `SYS_STATE_RUN`.
- **Slew clamp** (Step): every slew output is clamped onto the frozen 145..170 kHz envelope, so
  the post-takeover first write lands exactly on 170 000 Hz — a ~6.5 kHz step, the same
  magnitude as the trajectory's own 10-period (≈5 kHz) stage steps. No out-of-envelope
  `LLC_SetFrequencyHz` call is ever issued. In-band sessions are unaffected (clamp is a no-op).
- **Fallback**: if the trajectory slips past PHASE_B stage 12 (~166.9 kHz) or reaches FINAL
  (150 kHz, where the natural Vout would approach ~11.5 V), the OL module forces a planned stop
  with the new reason `OL_STOP_TAKEOVER_MISSED (6)` BEFORE the frozen 11 V gate — the
  trajectory's own 12 V ceiling is too high for this experiment.
- **Protection window** (protection.c 5A/5B branch): while `sys == SYS_STATE_SOFT_START` the
  legality ceiling is `OPEN_LOOP_TRAJ_MAX_HZ` (250 kHz = `SS_START_PERIOD` 239) because
  `PWM_ApplyPeriodDeadtime` keeps `g_switching_frequency_hz` tracking the real period during the
  ramp; once the OL session owns the actuator (`sys == RUN`) the window is back to the frozen
  145..170 kHz. The command envelope and every other guard are unchanged.

### 9.3 No-energy regression r5 (NE v2 SHA `e11c3d72f92243d3…`)

All checks TRUE — `SOL_W2_OPEN_LOOP_STEADY_NOENERGY_PASS=TRUE`. New S10 takeover scenario:
host fakes `sys=SOFT_START` + trajectory parked at PHASE_B stage 10 (period 339) →
`S10_TAKEN`, `S10_SS_ABORTED`, `S10_RAMP_INACTIVE`, `S10_SYS_RUN`, `S10_SESSION_ACTIVE`,
`S10_TAKEOVER_FREQ_176K` (176 470), `S10_ENTRY_EQ_TAKEOVER`, `S10_SLEW_CLAMP_170K`
(applied = 170 000 after the first clamped step), `S10_STOP_HOST`, planned-stop end state.
S8 TINT0 budget unchanged (interval_max 1206, whole-ISR max 1099). Console:
`ne_harness_console5.log`.

### 9.4 Frozen v2 binaries

| Binary | SHA256 |
|---|---|
| REAL `LLC_100W_F28034_OPEN_LOOP_STEADY.out` | `32b9ecb761069ca8fe47b3d31bb301055eea9e5535a334a2caa3f991aa8c48d8` |
| NE `LLC_100W_F28034_OPEN_LOOP_STEADY_NE.out` | `e11c3d72f92243d3ecd5c6a79b11ae763a42f8c1cbeac192e55d0020c6ef91b5` |

Manifest: `REAL_OPEN_LOOP_STEADY_SHA256SUMS.txt` (v1 values retained in comments).

### 9.5 Expected real-fire outcome (physics, stated before firing)

- Each matrix point = one full charge-up session (~1.4 ms trajectory + takeover + slew + steady
  windows + planned OST). The charge-up itself is the candidate4-proven trajectory.
- Point 1 (170 kHz): OL takes over at ~176.5 kHz, clamps to 170 kHz; the plant then converges to
  the natural `Vout(170 kHz, CR15)`. If that value is ≥ 1304 raw (10.49 V) the session ends at
  the WARNING boundary immediately — that boundary row IS the top edge of the CR15 map.
- Descent: 165 kHz and below push natural Vout higher (candidate4 measured ~10.93 V at ~155 kHz),
  so the WARNING boundary is expected somewhere between 170 kHz and ~163 kHz. Rows above the
  boundary are valid plant points; the boundary row closes the map.
- All guards remain: WARNING 1304 (planned OST + `OPEN_LOOP_UPPER_GAIN_BOUNDARY`), HARD 1367
  (`PWM_Trip(FAULT_OPEN_LOOP_VOUT_CEILING)`), DAC300/TZ1 OCP, 12 s timeout, fallback stop.
