# STAGE6_FLASH_CONTINUOUS_ITRAP_ROOT_CAUSE

> Task: STAGE6_FLASH_CONTINUOUS_ITRAP_ROOT_CAUSE_V1 · Baseline `d4e829d`
> **Final verdict: `ITRAP_ROOT_CAUSE_IDENTIFIED`**
> Root cause: `.TI.ramfunc` (DSP2803x_usDelay) is linked to RUN at RAM `0x801D` but is **never copied from Flash**; peripheral-init calls `usDelay` and executes uninitialized RAM → illegal instruction → ITRAP → `0x3FF8CD`.

## 1. Summary of finding
The repaired image boots from FLASH correctly (all startup gates PASS — not re-litigated). The `CONTINUOUS_FLASH_RUNTIME_ITRAP_UNRESOLVED` blocker is **resolved**: it is **not** a flash/clock/core instability, **not** a CSM issue, and **not** stack overflow. It is a **linker/copy bug**: the `usDelay` function lives in the `.TI.ramfunc` section whose RUN address is RAM `0x801D`, but nothing copies it there before use.

## 2. Trap analysis (offline, task B/D)
From the frozen NOENERGY OUT/MAP/disassembly + full trap capture:

| Item | Value | Meaning |
|---|---|---|
| Trap PC | `0x3FF8CD` | ITRAP (illegal-instruction) handler in boot ROM |
| **RPC (ITRAP return addr)** | `0x3EA35C` | `_InitAdc` LRETR — the return point set by the `LCR 0x00801d` at `0x3EA35A` |
| Offending execution address | **`0x801D`** (RAM) | `.TI.ramfunc` RUN location of `usDelay`; contains uninitialized `0x0000` |
| Call site | `_InitAdc` @ `0x3EA33F`, `LCR 0x00801d` @ `0x3EA35A` | peripheral-init path |
| Live register | XAR3=`0x801e` | CPU was executing in the usDelay RAM region |
| ST1 | `0x8A0B` | DBGM etc.; IER=0, IFR=0 |

**RPC_SYMBOLIZATION**: `RPC = 0x3EA35C` → `_InitAdc` end (LRETR), immediately after the `LCR 0x00801d` (usDelay call). RPC is **not** the offending instruction; the offending execution is at `0x801D` (garbage usDelay).

## 3. Decisive on-board verification (task C/M)
Read after `loadProgram` of the frozen OUT:

| Check | Value | Verdict |
|---|---|---|
| InitFlash copy: `ram[0x8000]` | `0x7622` | == `flash[0x3E8000]`=0x7622 → **copied OK** |
| usDelay copy: `ram[0x801D]` | **`0x0000`** | != `flash[0x3EA5AA]`=0x1901 → **NOT copied** |
| usDelay flash image (4 words) | `0x1901 0x56C3 0xFFFF 0x0006` | present in flash (LOAD 0x3EA5AA) |

`COPIED = FALSE` → the `usDelay` code exists in flash but is **absent from RAM 0x801D** (RAM holds `0x0000` garbage).

## 4. Why this happens (root cause)
- `28034_FLASH_lnk.cmd`: `.TI.ramfunc : LOAD = FLASH, RUN = RAML0` and `ramfuncs : LOAD = FLASH, RUN = RAML0`, both with copy symbols.
- MAP:
  - `ramfuncs` LOAD `0x3E8000` → RUN `0x8000`, size `0x1D` = `_InitFlash` (RUN 0x8000-0x801C).
  - `.TI.ramfunc` LOAD `0x3EA5AA` → RUN `0x801D`, size `0x4` = `_DSP28x_usDelay`.
  - Copy symbols: `_RamfuncsLoadStart=0x3E8000/_RamfuncsRunStart=0x8000`; `_TIRamfuncsLoadStart=0x3EA5AA/_TIRamfuncsRunStart=0x801D`.
- `device/system.c` `System_Init()` copies **only** the `ramfuncs` section (InitFlash) via `_RamfuncsLoadStart/End/RunStart`; it **does not** copy `.TI.ramfunc` (usDelay). `.cinit` does not contain code sections, so the C runtime does not copy it either.
- `DELAY_US()` is called widely (InitADC, comparator, power_probe, cal_hold_burst). The first hit in the boot path is `InitADC` (`DELAY_US(ADC_usDELAY)`), which issues `LCR 0x00801d` → jumps into uninitialized RAM → illegal instruction → ITRAP → `0x3FF8CD`.

## 5. Stack analysis (task I)
- `.stack` @ RAML1: origin `0x8800`, size `0xC0` (192 words), `__STACK_END=0x88C0`; C28x stack grows down.
- Trap `SP = 0x881D` → inside `0x8800..0x88C0`; used ≈ 163, **margin ≈ 29 words** (minimum, to lower bound).
- **`STACK_OVERFLOW_EXCLUDED`** — the ITRAP is not a stack overflow.

## 6. Clock/Flash state (already observed, consistent)
- `PLLLOCKS=1`, `PLLSTS.all=385` → PLL locks; no `CLOCK_PATH_FAULT`.
- `InitFlash` copied and run → `FLASH_INIT_COMPILED_IN_PASS` and `FLASH_RAMFUNC_COPY_PATH_PASS` already hold; flash wait-states are set by the (copied) InitFlash for 60 MHz.

## 7. Decision tree position
The failure is in the **peripheral-init path** (`APP_Init → InitADC → DELAY_US → usDelay@0x801D(garbage)`). Because the precise root cause is identified, the final output is `ITRAP_ROOT_CAUSE_IDENTIFIED` (the most specific verdict) rather than the generic `PERIPHERAL_INIT_PATH_UNSTABLE`.

## 8. Required fix (next step, not yet applied — task N: no production change before root cause)
Ensure `.TI.ramfunc` (usDelay) is copied to RAM before the first `DELAY_US` call. Cleanest minimal fix: extend `SystemInit`'s FLASH-build copy block to also copy `.TI.ramfunc` via `_TIRamfuncsLoadStart/End/RunStart` (alongside the existing `ramfuncs` copy), then a regression rebuild + re-run of `STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST`. (Diagnostic build toggled by `STAGE6_FLASH_RUNTIME_DIAG` is available for isolation.)

## 9. Evidence
- On-board reads: `evidence/stage6_flash_runtime_diag/` (`stage6_usdelay_verify.out`, `stage6_trap_capture.out`).
- Frozen binary: OUT `34C6E84F...F391`, MAP `C39F4ED5...BAB5`.
- Power gates: `LLC_HARDWARE_PI_VALIDATED=0`, `LLC_CONTROL_DIRECTION=0`, `PWM=0`, `OST=1`, `NO_REAL_POWER_EXECUTED`.
