# CHANGES.md

## Baseline

- Original project: `D:\1POWERlearning\program_LLC\LLC_100W_F28034`
- New bring-up project: `D:\1POWERlearning\program_LLC\LLC_100W_F28034_BRINGUP_DSH`
- Original project is unchanged; SHA-256 manifest was captured before/after copy (see below).

## User-confirmed software baseline

- `TB_COUNT_UP`, TBCLK = 60 MHz.
- 150 kHz → `TBPRD = 400`, `CMPA = 200`, `DBRED = DBFED = 36`.
- Stale `driver/pwm.c` `CTRMODE=2 / TBPRD=600` was corrected to the confirmed baseline.
- Stage 1 through first drive tests keep 36-tick software dead-band even though SI8233 has its own dead time.

## Corrections incorporated from approval

1. Stage 3 may use software/Timer-triggered ADC; Stage 5+ uses ePWM1 SOCA fixed-phase sampling; Stage 6 closed loop prohibits asynchronous Timer ADC.
2. 20 µs fast task: new ADC sample → PI/PFM → PWM update → fast protection. 5 ms is only state machine / soft-start ramp / slow protection.
3. `LLC_SetFrequencyHz()` rejects any runtime change of `CTRMODE/HSPCLKDIV/CLKDIV/AQ/DB` from the frozen baseline, and safely trips instead of auto-adapting.
4. `ADCINA1=VOUT`, `ADCINA2/COMP1A=IPRI`, `ADCINA3=IOUT`, `COMP1OUT(GPIO42)→PCB→GPIO15/TZ1` are marked `BOARD_MAPPING_PENDING_PHYSICAL_VERIFY` until Stage 4 signal-injection passes.
5. Stage 5 split:
   - 5A OPEN_LOOP_MANUAL: first power only manual 150→120→100 kHz; no auto sweep.
   - 5B SOFT_START_TEST: requires `g_softstart_autoramp_allowed=1` after 5A data.
6. 70 kHz is not a verified safe lower limit; 35 kHz is only a software absolute hard-floor candidate. Actual minimum must be unlocked by open-loop tests.

## Modified files

- `main.c` — now only safe startup + `APP_Init/APP_Run`.
- `app/app.c`, `app/app.h` — top-level init/run, PIE/timer setup.
- `driver/pwm.c`, `driver/pwm.h` — full ePWM1/DB/TZ safe init and public LLC API.
- `driver/gpio.c`, `driver/gpio.h` — unchanged logic, kept LEDs.
- `device/system.c`, `device/system.h` — unchanged 60 MHz PLL init.
- `.project`, `.cproject`, `.launches/*`, `tools/*` — renamed for BRINGUP_DSH.
- `28034_RAM_lnk.cmd` — extended RAM code region: `.text` may split across RAML0L1|RAML2; data moved to RAML3. Still RAM-only.

## New files

- `llc_config.h` — central config/stage/fault definitions.
- `app/llc_globals.h`, `app/llc_globals.c` — all non-static volatile CCS variables.
- `app/adc.c/h` — ADC raw/filtered monitor, software and ePWM1 SOCA trigger modes.
- `app/protection.c/h` — fault flags, TZ1 ISR, 20 µs fast task, 5 ms slow task.
- `app/control.c/h` — open-loop manual frequency and small 20 µs PI placeholder.
- `app/state_machine.c/h` — Stage 0→5A→5B→6→7 gating and enable/disable sequencing.
- `app/comparator.c/h` — COMP1/DAC arm/polarity/threshold debug interface.
- `app/default_isr.c` — minimal catch-all ISR for trimmed PIE table.
- `tools/build_debug.bat`, `tools/build_debug.sh`, `tools/test_static.py`.
- `BOARD_BRINGUP.md`, `CCS_EXPRESSIONS.md`, `BOARD_TEST_RECORD.md`.

## Deliberately not touched

- No `InitSysCtrl()` call; existing custom 60 MHz PLL init remains.
- No ePWM2, no CSS024D source, no 24 V threshold, no OLED/CAN/SCI/Burst/2P2Z/2P3Z.
- No Flash/self-start configuration; RAM debug only.
- No communication/display modules.

## SHA-256 baseline check

A SHA-256 manifest of the original project was recorded before copying and re-verified after copying. The original directory tree was not modified by this work.
