# TUTORIAL_SOFTSTART_PORT_V1

Status: `TUTORIAL_SOFTSTART_PORT_V1_COMPLETE` (firmware source + docs + model; no real power test run)

---

## 1. Architecture

```text
                  period_request
                        |
                        v
                SoftStart MaxPD
                        |
                        v
                   period_limit
                        |
                        v
                    BurstCtl
                        |
                        v
                 PWM Register API
                  /             \
              TBPRD/CMP       DBRED/FED


Comparator/TZ
      |
      +--------> Immediate hardware OST
                     |
                     v
                 FAULT record

5ms task:
SoftStart state / ramp

20us task:
sample/control/burst/register/protection
```

- Only the PWM driver writes `TBPRD`, `CMPA`, `DBRED`, `DBFED`.
- SoftStart is a moving `period_limit`, not a separate frequency sweeper.
- `period_applied = min(period_request, softstart_period_limit)`.

---

## 2. Reference truth table

See `analysis/tutorial_reference_truth_table.md`.

Key tutorial parameters:

| Parameter | Value | Source |
|---|---|---|
| MIN_BURST | 400 | `[TUTORIAL_SOURCE]` |
| MAX_DT | 190 | `[TUTORIAL_SOURCE]` |
| MIN_DT | 20 | `[TUTORIAL_SOURCE]` |
| MAX_OPP_VAL | 310 | `[TUTORIAL_SOURCE]` / `[UNVERIFIED]` |
| MAX_SSCNT | 20 | `[TUTORIAL_SOURCE]` |
| MAX_PD | 1714 | `[TUTORIAL_SOURCE]` |
| StateMRise SSInit | MaxPD=401, DT=190, Voref=11421, DAC=310 | `[TUTORIAL_SOURCE]` |
| SSWait | ~100 ms, then RegReflash, Burst ON, PWM ON | `[TUTORIAL_SOURCE]` |
| SSRun | MaxPD+=10, DT-=1 per 5 ms | `[TUTORIAL_SOURCE]` |

---

## 3. Current board safe profile

Implemented as `SOFTSTART_PROFILE_CURRENT_BOARD_SAFE`.

| Parameter | Value | Source |
|---|---|---|
| start period | 399 (150 kHz) | `[CURRENT_SAFE_POLICY]` |
| final period | 428 (140 kHz) | `[CURRENT_SAFE_POLICY]` / `[UNVERIFIED]` |
| period step | 1 per 5 ms | `[CURRENT_SAFE_POLICY]` |
| start dead-time | 190 counts | `[CURRENT_SAFE_POLICY]` / tutorial |
| final dead-time | 36 counts (~600 ns) | `[CURRENT_MEASURED]` |
| dead-time step | 1 per 5 ms | `[CURRENT_SAFE_POLICY]` |
| wait | 100 ms | `[TUTORIAL_SOURCE]` |
| Burst | disabled by default | `[CURRENT_SAFE_POLICY]` |
| OCP recovery | LOCKED | `[CURRENT_SAFE_POLICY]` |

---

## 4. Source-code bugs found

| # | Bug | Classification |
|---|---|---|
| 1 | `LEDShow()` calls `StateMWait()/StateMRise()/StateMRun()/StateMErr()` | `REFERENCE_SOURCE_BUG` |
| 2 | `PWMEn()` only switches GPIO MUX, no OST/TBCTR synchronization | `REFERENCE_SOURCE_BUG` |
| 3 | `MAX_OPP_VAL=310` comment “30A” is unverified | `UNVERIFIED` |
| 4 | ePWM shadow-load comment says CTR=0 but code uses `CC_CTR_PRD` | `REFERENCE_SOURCE_BUG` |
| 5 | `HwOpp()` auto-clears OST and retries | Tutorial design; current board keeps LOCKED |

---

## 5. Firmware engine

New files:

- `app/soft_start.h`
- `app/soft_start.c`

API:

```c
void SoftStart_Init(void);
void SoftStart_SelectProfile(Uint16 profile);
void SoftStart_Update5ms(void);
void SoftStart_ApplyLimits(void);
Uint32 SoftStart_GetPeriodLimit(void);
Uint16 SoftStart_GetDeadtime(void);
Uint16 SoftStart_IsComplete(void);
```

States:

```text
SOFTSTART_INIT -> SOFTSTART_WAIT -> SOFTSTART_RAMP -> SOFTSTART_COMPLETE
```

Globals:

```text
g_softstart_state
g_softstart_period_limit
g_softstart_deadtime
g_softstart_step_count
g_softstart_elapsed_ms
g_period_request
g_period_limit
g_period_applied
g_burst_enabled / g_burst_active / enter/exit counts
g_ocp_recovery_mode
```

---

## 6. Unified PWM deterministic start

Added to `driver/pwm.c/h`:

```c
void PWM_ApplyPeriodDeadtime(Uint32 period, Uint16 deadtime);
void PWM_PrepareStart(Uint32 period, Uint16 deadtime, Uint16 start_phase);
void PWM_StartDeterministic(void);
```

- `PWM_PrepareStart()` writes final registers, forces TBCTR phase, keeps OST latched.
- `PWM_StartDeterministic()` releases OST only after preparation.
- This addresses the first-pulse phase uncertainty identified by FIRST_CYCLE_MODEL.

---

## 7. Burst

Implemented in `SoftStart_ApplyLimits()`:

- `g_burst_enabled` default 0.
- When enabled, if `period_request < TUTORIAL_MIN_BURST` and PWM is on, it calls `LLC_PWM_DisableSafe()`.
- On recovery it uses `PWM_PrepareStart()` + `PWM_StartDeterministic()`.
- Counters: `g_burst_enter_count`, `g_burst_exit_count`.

First real-power burst remains disabled.

---

## 8. OCP recovery

- Default `g_ocp_recovery_mode = OCP_RECOVERY_MODE_LOCKED`.
- Real ACTIVE trip -> OST remains, FAULT set, no auto clear/retry.
- Tutorial hiccup mode is implemented as a concept and is **not** enabled.

---

## 9. Legacy probes

`app/power_probe.h` now marks all old single-cycle / VOUT / CAL_HOLD / DAC repeatability as:

```text
BRINGUP_DIAGNOSTIC_LEGACY
```

They are kept for historical evidence but must not receive new independent PWM algorithms.

---

## 10. FIRST_CYCLE_MODEL V2

Files:

- `analysis/llc_first_cycle_model_v2.py`
- `analysis/llc_first_cycle_model_v2_summary.json`
- `analysis/plots/05_tutorial_db190_first_cycle.png`
- `analysis/plots/06_peak_vs_deadtime.png`
- `analysis/plots/07_tutorial_softstart_first_steps.png`

V2 preserves V1 regressions:

| Case | First-cycle peak |
|---|---|
| 24V 150kHz DB36 | ~31.40 A |
| 24V 200kHz DB36 | ~17.28 A |

New DB190 result (current model):

| Case | First-cycle peak |
|---|---|
| 24V 150kHz DB190 | ~34.27 A |

> Important: this V2 result is **not** a confirmed decrease. In the current simplified dead-time model, DB190 shows a higher first-cycle peak than DB36. This is likely because the model represents dead-time as `Vab=0` and allows resonant ringing during the dead-time interval. This must be treated as a model artifact / uncertainty, not as a final conclusion.

Both DB36 and DB190 still cross the theoretical DAC300/DAC320 lines in this ideal model.

---

## 11. NO-ENERGY soft-start trace

Generated simulated digital trace:

- `analysis/tutorial_softstart_no_energy_trace.csv`
- Profile B: 150 kHz start, DB190 -> DB36, period 399 -> 428.
- 200 rows at 5 ms resolution.
- Checks in simulation:
  - one step per 5 ms
  - dead-time stops at 36, not 20
  - period limit stops at 428, not 1714
  - no burst, OCP locked, OST=1, PWM=1 after wait

A real hardware no-energy trace with CNT3/CNT4 OPEN is prepared as the next step and requires user confirmation to run on target.

---

## 12. Parameter source table

| Parameter | Value | Source |
|---|---|---|
| MAX_DT=190 | 190 | `[TUTORIAL_SOURCE]` |
| MIN_DT=20 | 20 | `[TUTORIAL_SOURCE]` |
| DB36 | 36 counts ≈ 600 ns | `[CURRENT_MEASURED]` |
| START_FREQUENCY_HZ | 150000 | `[CURRENT_SAFE_POLICY]` |
| FINAL_PERIOD | 428 (140 kHz) | `[CURRENT_SAFE_POLICY]` / `[UNVERIFIED]` |
| DAC310 current | unknown | `[UNVERIFIED]` |
| Auto OCP recovery | disabled | `[CURRENT_SAFE_POLICY]` |

---

## 13. Not done / next step

- No real power test was run.
- No hardware no-energy trace has been executed yet (simulated CSV only).
- Next recommended real-power test is still **not automatic**; it must be manually approved after no-energy hardware regression.

## Stack configuration (V3)

- `build_debug.bat`: `--stack_size=0x100`
- `.cproject`: `0x100`
- Map `.stack` length: `0x100`
- Status: `TEMPORARY_RAM_BRINGUP_STACK`
- Warning: `STACK_MARGIN_NOT_YET_CHARACTERIZED`

Do not use 0x200 or 0x300 in this bring-up RAM build.
