# STAGE6 FIRST REAL PI SHOT — REAL BINARY HARDENING V1

Task: `STAGE6_FIRST_REAL_PI_SHOT_REAL_BINARY_HARDENING_V1`
Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1`
Source baseline: `517a28112cce123975d4b8b54593b432bed519bf`

## Contents

- `STAGE6_FIRST_REAL_PI_SHOT_REAL_BINARY_HARDENING_REPORT.md` — full hardening report
- `REAL_SHA256SUMS.txt` — frozen REAL OUT/MAP + source SHA256 manifest
- `REAL_BUILD_MANIFEST.txt` — build macros, compiler, safety flags
- `REAL_FORBIDDEN_SYMBOL_AUDIT.txt` — synthetic-free audit
- `REAL_SCRIPT_WRITE_AUDIT.txt` — request-only script audit
- `STATIC_TEST_RESULTS.txt` — static test results
- `REALTIME_REAL_BINARY.txt` — realtime timing gate status
- `stage6_first_real_pi_shot_real.js` — REAL shot DSS script (request-only)
- `stage6_first_real_pi_shot_real_binary_timing_nopower.js` — no-power timing script
- `build_flash_shot_real.bat` — REAL build script
- `build_flash_shot_noenergy.bat` — NOENERGY build script

## Safety

- **NO real energy shot, NO 200 us real PI power test, NO continuous closed
  loop were executed.** `NO_REAL_POWER_EXECUTED`.
- CNT3/CNT4 OPEN could not be physically confirmed in this session, so all
  JTAG run tests (including the no-power timing script) were STOPPED. The
  realtime timing gate is NOT_VERIFIED and must be run on the bench after
  CNT3/CNT4 OPEN is confirmed.
- `LLC_HARDWARE_PI_VALIDATED = 0`, `LLC_POWER_RUN_ALLOWED = 0`,
  `LLC_CONTROL_DIRECTION = 0`, `LLC_CONTROL_SIGN = -1`.
- PI frequency envelope 145000–170000 Hz, slew 100 Hz/20 us, shot max 200 us,
  VOUT abort at calibrated 11 V raw, Comparator→TZ1→OST, DAC 300, no auto retry.

## Frozen REAL OUT

The REAL OUT/MAP are frozen in `evidence/stage6_first_real_pi_shot_real/`
(committed with `git add -f`). The host SHA256 hard gate in the REAL script
compares the local OUT to the frozen manifest before connect/download.
