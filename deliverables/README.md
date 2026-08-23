# STAGE6 FIRST REAL PI SHOT — REAL BINARY HARDENING V1-1

Task: `STAGE6_FIRST_REAL_PI_SHOT_REAL_BINARY_HARDENING_V1_1_BLOCKER_FIX`
Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1-1`
Source baseline: `8201315428e14f288a9a427d29e63c15f8b97b2f` (V1)
Source commit (build commit): `d87e8e9` — `stage6: fix real-shot execution gates before no-power timing`

## Contents

- `STAGE6_FIRST_REAL_PI_SHOT_REAL_BINARY_HARDENING_REPORT.md` — full hardening report (V1-1)
- `REAL_SHA256SUMS.txt` — frozen REAL OUT/MAP + NOENERGY OUT + source SHA256 manifest
- `REAL_BUILD_MANIFEST.txt` — build macros, compiler, safety flags, commit accounting
- `REAL_FORBIDDEN_SYMBOL_AUDIT.txt` — synthetic-free audit
- `REAL_SCRIPT_WRITE_AUDIT.txt` — request-only script audit
- `STATIC_TEST_RESULTS.txt` — static test results
- `REALTIME_REAL_BINARY.txt` — realtime timing gate status (NOT EXECUTED)
- `REVOKED_9CE0EFBA.txt` — V1 OUT revocation marker (REVOKED_BY_REVIEW / DO_NOT_EXECUTE)
- `LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT.out` — frozen V1-1 REAL OUT
- `LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT.map` — frozen V1-1 REAL MAP
- `LLC_100W_F28034_BRINGUP_DSH_NOENERGY.out` — frozen NOENERGY OUT (bit-difference evidence)
- `LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT_REVOKED_9CE0EFBA.out` — revoked V1 OUT (DO NOT EXECUTE)
- `stage6_first_real_pi_shot_real.js` — REAL shot DSS script (request-only, sequential)
- `stage6_first_real_pi_shot_real_binary_timing_nopower.js` — no-power timing script
- `build_flash_shot_real.bat` — REAL build script
- `build_flash_shot_noenergy.bat` — NOENERGY build script

## Safety

- **NO real energy shot, NO 200 us real PI power test, NO continuous closed
  loop were executed.** `NO_REAL_POWER_EXECUTED`.
- CNT3/CNT4 OPEN could not be physically confirmed in this session, so all
  JTAG run tests (including the no-power timing script) were STOPPED. The
  realtime timing gate is NOT_VERIFIED and must be run on the bench after
  CNT3/CNT4 OPEN is confirmed. `TIMING_NOT_EXECUTED`.
- `LLC_HARDWARE_PI_VALIDATED = 0`, `LLC_POWER_RUN_ALLOWED = 0`,
  `LLC_CONTROL_DIRECTION = 0`, `LLC_CONTROL_SIGN = -1`.
- PI frequency envelope 145000–170000 Hz, slew 100 Hz/20 us, shot max 200 us,
  VOUT abort at calibrated 11 V raw, Comparator→TZ1→OST, DAC 300, no auto retry.
- The V1 REAL OUT (`9ce0efba…`) is REVOKED and must NOT be executed.

## Frozen REAL OUT

The V1-1 REAL OUT/MAP and the NOENERGY OUT are frozen in
`evidence/stage6_first_real_pi_shot_real/` (committed with `git add -f`) and
included in this ZIP. The host SHA256 hard gate in the REAL script compares the
local OUT to the frozen manifest before connect/download.

## SHA256

- REAL OUT: `CAD61C38213535A1A923ADB66A53FB93688EE8AB8A98691F55C0DCC0A3070B72`
- REAL MAP: `4B167EFCC854BC81684F6B248E2CB02F636373CD4DFC84543C1B244B9A4851B6`
- NOENERGY OUT: `496BCED52D3E1168D492228AEDA2B6B2CC2560D66A686A53EB0FE08CD1CDD30A`
- REVOKED V1 OUT: `9CE0EFBAC3133B444DCD3A5F81E22B5F1B54AB141FA80619BFA7D83920D9CF7A`
