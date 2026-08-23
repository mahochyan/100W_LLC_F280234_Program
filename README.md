# FAILED DIAGNOSTIC EVIDENCE
DO NOT MERGE AS BASELINE

This branch preserves black-box evidence and the failure report for the
200 kHz / DB140 multi-edge power requalification, which TRIPPED at 3-cycle
(real ACTIVE-window Comparator/TZ1 trip -> FAULT_COMP_TZ1).

- NOT a merged baseline. main @ eade849 is unchanged and remains the valid baseline.
- DO NOT merge this branch into main.
- OUT SHA 4A993FFA... = FAILED_AT_3_CYCLE / NOT_BASELINE.
- 15-cycle was NOT run. No reset/retry was performed; FAULT_COMP_TZ1 + OST stay latched.

See docs/REAL_POWER_200KHZ_DB140_3CYCLE_TRIP_REPORT.md