# STAGE6_FLASH_RAMFUNC_COPY_REPAIR_AND_NOENERGY_RESUME

> Task: `STAGE6_FLASH_RAMFUNC_COPY_REPAIR_AND_NOENERGY_RESUME_V1` · Baseline `d282173`
> Status: **FLASH fix COMPLETE + validated · no-energy resumed, functional gates PASS, 20µs budget FAIL**

## 1. Result summary
- **Flash ITRAP root cause FIXED and VALIDATED on target.** `.TI.ramfunc` (DSP2803x_usDelay) is now copied to RAM `0x801D` before use. Continuous FLASH runtime is stable (5×2 s, no trap, main loop alive, `g_fast_tick` grows at the correct 50 kHz).
- The no-energy test was resumed and runs from FLASH continuously. Functional gates pass. The whole-ISR **20 µs budget fails at the saturation extremes** → full no-energy PASS not granted.

## 2. Fix (device/system.c, minimal)
In `System_Init()` FLASH-build block, after the legacy `ramfuncs` copy and before `InitFlash()`, added a second copy of `.TI.ramfunc`:
```c
extern Uint16 TIRamfuncsLoadStart, TIRamfuncsLoadEnd, TIRamfuncsRunStart;  /* COFF, no leading '_' */
m = (Uint32)&TIRamfuncsLoadEnd - (Uint32)&TIRamfuncsLoadStart;
while (m--) { ((volatile Uint16 *)&TIRamfuncsRunStart)[m] = ((volatile Uint16 *)&TIRamfuncsLoadStart)[m]; }
```
Order: copy legacy `ramfuncs` → copy `.TI.ramfunc` → `InitFlash()`. No app/PI/power changes.

## 3. Static proof + layout
- MAP: `ramfuncs` LOAD `0x3E8000`→RUN `0x8000` size `0x1D` (InitFlash); `.TI.ramfunc` LOAD `0x3EA5C6`→RUN `0x801D` size `0x4` (usDelay). Adjacent, no overlap → `FLASH_RAMFUNC_RUN_REGION_LAYOUT_PASS`.
- dis2000 of System_Init: **two copy loops** (`0x3E8000→0x8000`, `0x3EA5C6→0x801D`) then `LCR 0x008000` (InitFlash) → `LEGACY_RAMFUNCS_COPY_PRESENT` + `TI_RAMFUNCS_COPY_PRESENT`.

## 4. On-target flash-runtime gates (all PASS)
| Gate | Result |
|---|---|
| ON_TARGET_TI_RAMFUNC_COPY_PASS | RAM[0x801D]=0x1901 == FLASH[0x3EA5C6]; full 4-word match (was 0x0000 before fix) |
| USDELAY_RAM_EXECUTION_PASS | usDelay entry PC=0x801D (RAML0); returns to InitAdc LRETR 0x3EA378 |
| CONTINUOUS_FLASH_RUNTIME_PASS | 5×20ms, no 0x3FF8CD, no ITRAP, g_fast_tick monotonic (~100k/20ms = 50 kHz) |

## 5. No-energy on-target (resumed)
Functional gates (with no-power ADC-stale counter cleared):
- ON_TARGET_PRELOAD_SAFE_PASS (profile 0x060201, pwm=0, ost=1)
- ON_TARGET_8CASE_PASS (g_offline_test_status=0xFF, all 8)
- ON_TARGET_BALANCED_FIRST_STEP_PASS (11V→149900 Hz, 13V→150100 Hz)
- ON_TARGET_ADC_STALE_RECOVERY_PASS (shadow+integrator frozen, recover delta=0)
- ON_TARGET_PWM_REGISTER_ISOLATION_PASS (PRE==POST, ost=1, pwm=0)
- ON_TARGET_FINAL_SAFE_STATE_PASS (test off, running=0, pwm=0, ost=1)
- ON_TARGET_BINARY_IDENTITY_PASS (SHA 9F875131...DDF0)
- FAST_ISR_BUDGET_MEASUREMENT_BOUNDARY_PASS (exit snapshot moved to end of ISR)

## 6. 20 µs whole-ISR budget — FAIL
- Typical active-PI ISR: 834-858 cycles (~14 µs, PASS).
- Worst case under required coverage (lower/upper saturation): ISR max **2772 cycles = 46 µs**, PI step max **2426 cycles**, **overrun_count > 0**.
- Threshold: <=900 PASS / 901-1080 MARGIN_LOW / >1080 FAIL / >=1200 absolute FAIL, overrun must be 0. → **absolute FAIL.**
- Finding: the soft-float C28x PI step (up to ~2426 cycles) against a 20 µs (1200-cycle) ISR does not fit at the saturation extremes. Independent of the flash fix. Typical 12V steady-state is fine; the clamp/slew extremes over-run.

## 7. Verdicts
- **Flash fix COMPLETE** and validated: `ON_TARGET_TI_RAMFUNC_COPY_PASS`, `USDELAY_RAM_EXECUTION_PASS`, `CONTINUOUS_FLASH_RUNTIME_PASS`, `FLASH_RAMFUNC_RUN_REGION_LAYOUT_PASS`, `LEGACY_RAMFUNCS_COPY_PRESENT`, `TI_RAMFUNCS_COPY_PRESENT`.
- **STAGE6_ON_TARGET_SHADOW_NOENERGY_PASS = NOT met** (20US_FAST_ISR_BUDGET_PASS false; overrun>0).
- **F28034_BALANCED_PI_EXECUTION_VALIDATED / READY_FOR_STAGE6_REAL_POWER_PI_ENTRY_REVIEW = NOT granted.**
- Power gates held: `LLC_HARDWARE_PI_VALIDATED=0`, `LLC_CONTROL_DIRECTION=0`, `PWM=0`, `OST=1`, `NO_REAL_POWER_EXECUTED`.

## 8. History (preserved)
1. First FLASH failure: codestart not linked + STAGE6_FLASH_BUILD not defined → fixed (previous task).
2. Second FLASH failure: `.TI.ramfunc` (usDelay) never copied → ITRAP → fixed (this task).
3. Final: FLASH startup + runtime now fully closed; continuous FLASH execution validated. Remaining blocker is the 20 µs fast-ISR budget at saturation extremes (real-time performance, not boot).
