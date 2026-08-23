# STAGE6_FLASH_STARTUP_PATH_REPAIR + STAGE6_ON_TARGET_SHADOW_NOENERGY

> Status: **FLASH startup repair COMPLETE (milestone PASS) / no-energy full test BLOCKED (on-target ITRAP)**
> Repair baseline: `0343a23`. Profile: ID `0x060201`, Kp `6657.43331`, Ki_step `44.3828888`.
> Gates: `LLC_HARDWARE_PI_VALIDATED=0`, `LLC_CONTROL_DIRECTION=0`, `CTRL_PI_PROFILE_VIRTUAL_ONLY=1`,
> `CTRL_PI_PROFILE_HARDWARE_VALIDATED=0`. No real power, no PI unlock, no OTP/CSM password change, no boot-resistor change.

## 1. Objective
Repair two confirmed FLASH-startup build defects, then re-run the no-energy shadow test on a real F28034:
1. `codestart` not linked (BEGIN used=0).
2. `STAGE6_FLASH_BUILD` not defined (InitFlash path compiled out).

## 2. Root causes (confirmed)
| # | Defect | Evidence |
|---|---|---|
| 1 | codestart not linked | Old MAP: `BEGIN origin=0x3F7FF6 used=0`; `2803x_CodeStartBranch.asm` existed but was not assembled/linked by either FLASH build. |
| 2 | flash-init macro not defined | `System_Init()` gates ramfunc-copy + `InitFlash()` behind `#ifdef STAGE6_FLASH_BUILD`, but neither build passed `-DSTAGE6_FLASH_BUILD=1`. |

## 3. Fixes (only FLASH-startup infrastructure)
- **codestart**: assemble `device/source/2803x_CodeStartBranch.asm` → `2803x_CodeStartBranch.obj`; added to both FLASH links. ASM standardized to `.global code_start; .sect "codestart"; code_start: LB _c_int00`.
- **entry point**: `--entry_point=code_start` added to both FLASH links (MAP shows `ENTRY POINT SYMBOL: "code_start" address: 003f7ff6`).
- **flash-build macro**: `-DSTAGE6_FLASH_BUILD=1` added to every C compile command in both FLASH builds (normal sources + soft_start.c special compile). RAM build unchanged (macro not defined).
- Production `Stage6_FLASH` regression build: OK, 0 unresolved/0 overflow; only the 3 startup files changed (asm + 2 build scripts), 0 app-logic changes. Gates remain 0.

## 4. Static gates (all PASS)
- **FLASH_CODESTART_IMAGE_PASS** — new MAP: `BEGIN used=0x000002`, `codestart=0x3F7FF6`, `entry=code_start`; final OUT `code_start: LB 0x3e9b8a` at 0x3F7FF6 (0x007E/0x9B8A, not 0xFFFF).
- **FLASH_INIT_COMPILED_IN_PASS** — `system.obj` relocation: ramfunc copy refs `_RamfuncsLoadStart/End/RunStart` + `LCR`→`_InitFlash`.
- **FLASH_RAMFUNC_COPY_PATH_PASS** — MAP: `ramfuncs LOAD=0x3E8000(FLASH) RUN=0x00008000(RAML0) size=0x1D`, `_InitFlash` run @0x8000.
- **NO_CSM_PASSWORD_PROGRAMMED_BY_IMAGE** — MAP `CSM_PWL_P0 used=0`; `CsmPwlFile` is the standard uninitialized header placeholder; on-board flash read of the CSM password area (0x3F7FF8/0x3F7FF9) = 0xFFFF/0xFFFF → **CSM unlocked**. CSM/OTP/password untouched.
- **FLASH_STARTUP_MILESTONE_PASS** — on-target sequential breakpoint trace: `code_start` → `_c_int00` → `_main` → `_System_Init` → `_InitFlash` (ramfunc copied to RAM 0x8000, flash[0x3E8000]==ram[0x8000]) → `_APP_Init`, all HIT. This supersedes the previous `PREVIOUS_DIAGNOSIS_SUPERSEDED_BY_BUILD_AUDIT` finding — the repaired image **does** execute from FLASH.

## 5. No-energy full test: BLOCKED (ITRAP_OR_ROM_TRAP_OBSERVED)
The startup chain reaches `APP_Init`, but **continuous (no-breakpoint) main/APP_Init execution vectors to 0x3FF8CD** (illegal-instruction trap in boot ROM), non-deterministically. The PLL itself locks (`PLLLOCKS=1`, `PLLSTS.all=385`). Flash is programmed and CSM unlocked. The trap dump (PC=0x3FF8CD, SP=34845, RPC=4105052, ST0=128, ST1=35339, IER=0, IFR=0) was recorded. Per task N this is `ITRAP_OR_ROM_TRAP_OBSERVED` and the on-target full test is **STOPPED** (no further boot-pin guessing).

Consequently the no-energy runtime measurements — `ON_TARGET_BALANCED_8CASE_PASS`, `ON_TARGET_PWM_REGISTER_ISOLATION_PASS`, `ON_TARGET_BALANCED_FIRST_STEP_PASS`, `ON_TARGET_ADC_STALE_RECOVERY_PASS`, `20US_FAST_ISR_BUDGET_PASS`, `ON_TARGET_FINAL_SAFE_STATE_PASS`, `ON_TARGET_BINARY_IDENTITY_PASS` — are **NOT MET** (blocked by on-target stability). `STAGE6_ON_TARGET_SHADOW_NOENERGY_PASS`, `F28034_BALANCED_PI_EXECUTION_VALIDATED`, `20US_FAST_ISR_BUDGET_PASS`, `PWM_REGISTER_ISOLATION_PASS`, `READY_FOR_STAGE6_REAL_POWER_PI_ENTRY_REVIEW` are all **NOT MET**. No on-target result was fabricated.

## 6. New frozen binary (supersedes DDC6...)
- OUT SHA256 `34C6E84F6B7D88D1029895BB7763A672CB046B15E757F4B25214567CEBDBF391`
- MAP SHA256 `C39F4ED527937B461651AB66C87E0654184014E2CC4DFEB766DD1C4612C0BAB5`
- FLASH used 10187/65408 words (15.6%); RAML0 used 33 words (InitFlash/usDelay ramfuncs); BEGIN used 2 (codestart).
- Old image (`DDC6...`) kept as `SUPERSEDED_FLASH_STARTUP_IMAGE`.
- `STAGE6_FLASH` OUT `CB8AC36F...` / MAP `54F70FF0...`.

## 7. Remaining blocker
Board on-target stability under continuous FLASH execution (ITRAP to 0x3FF8CD). Resolution requires board-level investigation (power/clock stability, flash-programming reliability, or a clean emulator reset) before the no-energy runtime measurements can be re-run on the repaired frozen binary.
