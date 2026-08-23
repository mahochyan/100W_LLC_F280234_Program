# STAGE6 FIRST REAL PI SHOT — REAL BINARY HARDENING (V1-1 + RECOVERY V1)

Task: `STAGE6_FIRST_REAL_PI_SHOT_REAL_BINARY_HARDENING_V1_1_BLOCKER_FIX`
then `STAGE6_REAL_PI_FASTPATH_TIMING_RECOVERY_V1`
Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1-1`
Source baseline: `8201315428e14f288a9a427d29e63c15f8b97b2f` (V1)
V1-1 build commit: `d87e8e9`; RECOVERY V1 commits: `501f1d2` (A),
`947b2fe` (C/D/F/G), and the candidate-2 commit (I/J).

## Contents

- `STAGE6_FIRST_REAL_PI_SHOT_REAL_BINARY_HARDENING_REPORT.md` — full hardening
  report (V1-1 + RECOVERY V1 sections 18.1–18.11)
- `REAL_SHA256SUMS.txt` — frozen REAL OUT/MAP + NOENERGY OUT + RECOVERY V1
  candidate OUT/MAP + source SHA256 manifest
- `REAL_BUILD_MANIFEST.txt` — build macros, compiler, safety flags, commit accounting
- `REAL_FORBIDDEN_SYMBOL_AUDIT.txt` — synthetic-free audit
- `REAL_SCRIPT_WRITE_AUDIT.txt` — request-only script audit
- `STATIC_TEST_RESULTS.txt` — static test results (ALL PASSED)
- `REALTIME_REAL_BINARY.txt` — realtime timing gate status (NOT EXECUTED)
- `REVOKED_9CE0EFBA.txt` — V1 OUT revocation marker (REVOKED_BY_REVIEW / DO_NOT_EXECUTE)
- `NOPOWER_TIMING_RAW_V1.txt` / `NOPOWER_TIMING_RESULT_V1.json` — pre-optimization
  no-power timing evidence (RAW authoritative; ISR max 1406 -> NOPOWER_TIMING_FAIL)
- `FASTPATH_READY_RAW.txt` / `FASTPATH_READY_RESULT.json` — formal-handoff
  fastpath reproduction on the frozen CAD61C38 OUT (ISR max 1256 -> RECOVERY_V1_NEEDS_FIRMWARE_OPTIMIZATION)
- `FASTPATH_CANDIDATE1_0691C524_RAW.txt` / `FASTPATH_CANDIDATE1_0691C524_RESULT.json`
  — bounded no-division period fastpath candidate (ISR max 1247, still > 900)
- `FASTPATH_CANDIDATE2_05BAA75C_RAW.txt` / `FASTPATH_CANDIDATE2_05BAA75C_RESULT.json`
  — last allowed candidate (ring/PI/5ms/ADC-sync trim; ISR max 1148, still > 900)
- `FASTPATH_DIVIDE_HELPER_AUDIT.txt` — no `__c28xabi_div*` helper audit (PASS)
- `LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT.out{.map}` — frozen V1-1 REAL OUT/MAP
- `LLC_100W_F28034_BRINGUP_DSH_NOENERGY.out` — frozen NOENERGY OUT (bit-difference evidence)
- `LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT_REVOKED_9CE0EFBA.out` — revoked V1 OUT (DO NOT EXECUTE)
- `LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT_FASTPATH_0691C524.out{.map}` — candidate 1 OUT/MAP
- `LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT_FASTPATH_CANDIDATE2_05BAA75C.out{.map}` — candidate 2 OUT/MAP
- `stage6_first_real_pi_shot_real.js` — REAL shot DSS script (request-only, sequential)
- `stage6_first_real_pi_shot_real_binary_timing_nopower.js` — no-power timing script
- `stage6_real_binary_hardening_static_test.py` — static hardening test (ALL PASSED)
- `stage6_real_pi_fastpath_equivalence_test.py` — exhaustive period fastpath
  equivalence test (10,180,275 checks PASS)
- `build_flash_shot_real.bat` / `build_flash_shot_noenergy.bat` — build scripts

## Safety

- **NO real energy shot, NO 200 us real PI power test, NO continuous closed
  loop were executed.** `NO_REAL_POWER_EXECUTED`.
- CNT3/CNT4 were physically confirmed OPEN on the bench before candidate 1 and
  remained OPEN for candidate 2; both candidate no-power timing runs were
  executed under `DSH_CNT34_OPEN_CONFIRMED=1` only, hardware PWM forced low
  (OST latched + AQCSFRC force-low), no fault/OST clearing, no auto retry of a
  real gate. `CNT34_REMAIN_OPEN`.
- Final no-power timing result (both different-SHA candidates exhausted, gates
  NOT lowered): **`REAL_PI_FASTPATH_TIMING_FAIL`** — ISR max 1148 > 900 gate,
  entry-interval max 1218 >= 1200. `REAL_POWER_NOT_AUTHORIZED`; the real shot
  remains blocked pending a firmware budget fix review.
- `LLC_HARDWARE_PI_VALIDATED = 0`, `LLC_POWER_RUN_ALLOWED = 0`,
  `LLC_CONTROL_DIRECTION = 0`, `LLC_CONTROL_SIGN = -1`.
- PI frequency envelope 145000–170000 Hz, slew 100 Hz/20 us, shot max 200 us,
  VOUT abort at calibrated 11 V raw, Comparator→TZ1→OST, DAC 300, no auto retry.
- The V1 REAL OUT (`9ce0efba…`) is REVOKED and must NOT be executed. The
  frozen V1-1 OUT (CAD61C38) is TIMING_FAILED_1406_CYCLES / do not execute with
  real power until re-authorized.

## Frozen REAL OUT

The V1-1 REAL OUT/MAP, NOENERGY OUT, and both RECOVERY V1 candidate OUT/MAP
files are frozen in `evidence/stage6_first_real_pi_shot_real/` (committed with
`git add -f`) and included in this ZIP. The host SHA256 hard gate in the timing
script compares the local OUT to the manifest-registered SHA before
connect/download.

## SHA256

- REAL OUT (frozen V1-1): `CAD61C38213535A1A923ADB66A53FB93688EE8AB8A98691F55C0DCC0A3070B72`
- REAL MAP (frozen V1-1): `4B167EFCC854BC81684F6B248E2CB02F636373CD4DFC84543C1B244B9A4851B6`
- NOENERGY OUT: `496BCED52D3E1168D492228AEDA2B6B2CC2560D66A686A53EB0FE08CD1CDD30A`
- REVOKED V1 OUT: `9CE0EFBAC3133B444DCD3A5F81E22B5F1B54AB141FA80619BFA7D83920D9CF7A`
- RECOVERY V1 candidate 1 OUT: `0691C52431E7EA1140264FFED55DB8C4F870EF0A0F3FDACCC2403EFCC3647076`
- RECOVERY V1 candidate 2 OUT: `05BAA75CCB03AEA71BCA469DE82194FBCD7C0F46AE5E91304EE784CD1E2773F5`

See `REAL_SHA256SUMS.txt` for the complete manifest (including MAP SHA256s).