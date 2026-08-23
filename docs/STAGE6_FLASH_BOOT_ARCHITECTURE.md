# STAGE6 FLASH BOOT ARCHITECTURE

Stage: STAGE6_DUAL_RAM_FLASH_BUILD_FOUNDATION_V1 (offline / build / static / SIL)
Task step D. Documents the FLASH build boot chain, wait-state init, ramfunc
copy, and the memory map / margins.

## 0. Origin of the memory map (no invented addresses)

The FLASH memory map is taken verbatim from the official TI F28034 linker
command file shipped with CCS:
- Source: `D:\CCS21\ccs\ccs_base\c2000\include\F28034.cmd`
- TI Release: 2803x Internal Release 2 (file rev /main/4)
- SHA256: DC27A81D64D9E275B6CE0443D2BEDD295C80A7E481F35725C81585A08574E47A

`28034_FLASH_lnk.cmd` is a minimal adaptation of that official file (combined
flash sectors for .text; ramfuncs LOAD/RUN; data in RAML). `28034_RAM_lnk.cmd`
(SARAM-only baseline) is UNTOUCHED.

## 1. F28034 FLASH map (official)

| Region | Origin | Length | Used | Purpose |
|---|---|---|---|---|
| FLASH | 0x3E8000 | 0xFF80 (65408) | 0x2717 | .text/.cinit/.econst/.switch/IQmath |
| BEGIN | 0x3F7FF6 | 0x2 | 0x2 | codestart (boot to flash) |
| RAML0 | 0x008000 | 0x800 | 0x21 | ramfuncs RUN |
| RAML1 | 0x008800 | 0x400 | 0xC0 | .stack |
| RAML2 | 0x008C00 | 0x400 | 0x276 | .ebss/.esysmem |
| RAML3 | 0x009000 | 0x1000 | 0x0 | spare |
| RAMM0/M1 | ... | ... | 0 | spare |

## 2. Boot chain (FLASH)

1. Boot-to-Flash boot mode jumps to `BEGIN` (0x3F7FF6).
2. `codestart` section (device/source/2803x_CodeStartBranch.asm) does `LB _c_int00`.
3. `_c_int00` (libc.a) runs C init, copies `.cinit`, then calls `main()`.
4. `main()` calls `System_Init()`.

## 3. Flash wait-state init (60 MHz)

`System_Init()` (device/system.c) configures the clock to 60 MHz
(internal OSC1 ~10 MHz -> PLL x6 -> /1) and, under `#if STAGE6_FLASH_BUILD`,
copies the `ramfuncs` section (InitFlash) from FLASH to RAM and calls
`InitFlash()`, which sets:
- FBANKWAIT.PAGEWAIT = 2
- FBANKWAIT.RANDWAIT = 2
- FOTPWAIT.OTPWAIT = 3
- (STDBY/ACTIVE WAIT = TI defaults)

These are the TI-recommended flash wait-states at 60 MHz SYSCLK. The RAM
build never calls InitFlash (runs entirely from RAM), so power behavior is
unchanged there.

## 4. ramfuncs / .TI.ramfunc LOAD-RUN copy

| Section | Content | LOAD (FLASH) | RUN (RAM) | copy symbols |
|---|---|---|---|---|
| ramfuncs | InitFlash (CODE_SECTION) | 0x3E8000 | 0x008000 | _RamfuncsLoadStart/End, _RamfuncsRunStart |
| .TI.ramfunc | DSP2803x_usDelay | 0x3EA52F | 0x00801D | _TIRamfuncsLoadStart/End, _TIRamfuncsRunStart |

System_Init performs the ramfuncs copy (manual word loop) before calling
InitFlash(), then continues from flash.

## 5. Stage6 controller in FLASH build

control.c compiles with the full controller: CTRL_ComputeFrequencyCommand /
CTRL_ApplyFrequencyCommand / shadow / conditional anti-windup / 120k-180k clamp /
100 Hz/20us slew / ADC stale inhibit, plus the 8-case offline self-test
(STAGE6_OFFLINE_SELFTEST=1). `.text` = 0x2512 words, placed in FLASH.

## 6. Memory margin

- FLASH: used 0x2717 / 0xFFF8 -> remaining ~84.7% (FLASH_MEMORY_MARGIN).
- RAM: free ~9305 words of ~10160 -> ~91.6% (RAM_DATA_MARGIN).
- 0 overflow, 0 unresolved symbols.

## 7. Safety (build only)

No board programming, no loadProgram, no real power, no PWM enable, no OST
clear. The FLASH OUT is produced as a static/link artifact only; running it is
a later stage.

## 8. RAM baseline capacity (task A)

SARAM-only link (28034_RAM_lnk.cmd) is exhausted by architectural growth:
- RAMLALL 0x2000 full; RAMM0 ~0xBF free + ~0x... 
- Stage6 controller core requires ~+0x270 words; unavailable in RAM.
- Conclusion: RAM_BUILD_CAPACITY_EXHAUSTED_BY_ARCHITECTURE_GROWTH (not a
  CONTROL_CODE_TOO_LARGE_BUG). This is why Stage6 + future firmware builds
  live in the FLASH configuration; the RAM configuration remains the
  early-bringup / JTAG / historical baseline and is preserved.