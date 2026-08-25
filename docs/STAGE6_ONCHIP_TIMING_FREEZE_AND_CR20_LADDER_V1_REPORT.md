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

## Build scripts
- `tools/build_flash_shot_real_ladder.bat <LABEL> <CYCLES>`
- `tools/build_flash_shot_real_2ms.bat`  (120000 cycles)
- `tools/build_flash_shot_real_10ms.bat` (600000 cycles)
- `tools/build_flash_shot_real_100ms.bat`(6000000 cycles)

## No-power ladder script
- `tools/stage6_onchip_timing_freeze_nopower_ladder_all.js` runs the three
  no-power timing windows in order. It writes only `g_timing_request=1` before
  each run, waits the required safety margin, halts, and reads the frozen data
  once.

## Real CR20 ladder script
- `tools/stage6_cr20_real_ladder.js` implements the conditional real ladder
  after all no-power steps pass. It requires the human/field gates
  (`DSH_CNT34_APPROVED`, operator present, 0.5 A input limit, CR20, Vin=24 V).

## Status
Firmware and scripts are implemented. Actual OUT/MAP/SHA and bench execution
require the CCS toolchain and the physical board; they are not available in
this repository workspace.
