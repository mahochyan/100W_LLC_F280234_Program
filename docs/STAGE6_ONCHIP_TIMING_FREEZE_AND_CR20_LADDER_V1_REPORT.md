# STAGE6_ONCHIP_TIMING_FREEZE_AND_CR20_LADDER_V1

## Scope
This change implements the on-chip timing measurement window and prepares the
REAL_2MS / REAL_10MS / REAL_100MS ladder. It does **not** modify PI parameters,
Profile C, PWM actuator behavior, Burst criteria, 11V/OCP/TZ, or the 900-cycle
gate.

## Firmware changes
- Added `g_timing_request`, `g_timing_active`, `g_timing_frozen`,
  `g_timing_epoch`, `g_timing_sample_count`, `g_timing_active_isr_max`,
  `g_timing_compute_max`, `g_timing_apply_max`, `g_timing_shutdown_max`,
  `g_timing_overrun_count`.
- Added 100 ms last-50 ms VOUT/frequency statistics:
  `g_timing_last50_vout_*`, `g_timing_last50_freq_*` (compiled only in the
  100 ms build).
- `TINT0_ISR` now starts a fresh timing round on `g_timing_request`, uses a
  local entry timestamp, and commits only at the complete ISR exit.
- `SHOT_TimingFreeze()` sets `g_timing_active=0` and `g_timing_frozen=1`
  before the final software OST on all terminal paths.
- `FIRST_REAL_PI_DURATION_CYCLES` is now overridable via `-D` so the same
  source builds 2 ms / 10 ms / 100 ms with only the duration constant changed.

## Build results
- REAL_2MS  OUT `9D2FB238E0F044677D5808897314A1F0F4A2FDC8BF09B34E4E7E22EAA98A9E32`
- REAL_10MS OUT `64E59D2F3046D92568D5AA6FA6E84B27599051285B4F6E574EE1D57BE29DC77F`
- REAL_100MS OUT `5391FD1D21B9283CBD0DCD7FED84C1DB4F048B4FD647DB7CFC7409B7305C0321`

## No-power ladder result
All three no-power timing windows PASS:
- 2MS:  compute_max=853, apply_max=870, active_isr_max=870, shutdown_max=613, overrun=0
- 10MS: compute_max=0,   apply_max=875, active_isr_max=875, shutdown_max=613, overrun=0
- 100MS:compute_max=0,   apply_max=893, active_isr_max=893, shutdown_max=610, overrun=0

`STAGE6_ONCHIP_TIMING_FREEZE_PASS`

## Real CR20 ladder result
The conditional real ladder was attempted after no-power PASS. The 2MS real
step failed on the first and only attempt:

- `FAILED_DURATION=2MS`
- `FAILED_GATE=CR20_ENTERED_BURST`
- `NO_RETRY_EXECUTED`
- `BOARD_LEFT_SAFE_PWM0_OST1`

Observed: `burst_enter_count=1`, `max_vout_raw=1387` (>=1367), `abort=2`
(VOUT 11V abort), `fault=0x10000` (FAULT_FIRST_SHOT_ABORT), final PWM=0,
OST=1, TZ INT=0, POST_OST. Per the task's failure分流, no further real
durations were attempted.

## Scripts
- `tools/build_flash_shot_real_ladder.bat <LABEL> <CYCLES>`
- `tools/build_flash_shot_real_2ms.bat`  (120000 cycles)
- `tools/build_flash_shot_real_10ms.bat` (600000 cycles)
- `tools/build_flash_shot_real_100ms.bat`(6000000 cycles)
- `tools/stage6_onchip_timing_freeze_nopower_ladder_all.js`
- `tools/stage6_cr20_real_ladder.js`
