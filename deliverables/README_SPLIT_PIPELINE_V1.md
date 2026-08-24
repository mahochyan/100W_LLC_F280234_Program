# STAGE6 40µs Split-Pipeline Accelerated Closed Loop — Delivery V1

Task: `STAGE6_40US_SPLIT_PIPELINE_ACCELERATED_CLOSED_LOOP_V1` (parts A–L)
Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1-1`
Commit: `b5e7067` (split-pipeline no-power timing PASS)
Status: **F PASS — `SPLIT_PIPELINE_40US_TIMING_PASS`; real power NOT authorized**
(awaits on-site confirmation: CNT3+CNT4 connected, Vin=24V, 0.5A limit,
light load 1–2 W, no smell/heat/wiring issues).

## Contents

- `STAGE6_40US_SPLIT_PIPELINE_REPORT.md` — split-pipeline design (A–E),
  F no-power timing evidence, real-power path gates
- `STAGE6_FIRST_REAL_PI_SHOT_REAL_BINARY_HARDENING_REPORT.md` — prior
  hardening/recovery report (baseline candidate-2 evidence)
- `SPLIT_PIPELINE_932337AA_RAW.txt` — raw no-power timing run log
- `SPLIT_PIPELINE_932337AA_RESULT.json` — structured gates + measurements
- `LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT_SPLIT_PIPELINE_932337AA.out/.map` —
  frozen split-pipeline REAL binary
- `LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT.out/.map` etc. — prior frozen binaries
- `REAL_SHA256SUMS.txt` — SHA-256 manifest (split OUT/MAP registered)
- `REAL_BUILD_MANIFEST.txt` / audits / static-test results — hardening evidence
- `NOPOWER_TIMING_RAW_V1.txt` / `NOPOWER_TIMING_RESULT_V1.json` etc. — earlier
  recovery-V1 no-power evidence
- `STAGE6_NEXT_DAY_LOW_POWER_TEST_GUIDE.md` — next-day (K) test procedure
- `STAGE6_REGULATION_60S_CSV_TEMPLATE.csv` — stage-J 60 s CSV template
- `tools/…` — harness scripts (DSS no-power timing, static hardening test)

## Verification summary (F)

| gate | value |
|---|---|
| compute phase max | 708 ≤ 900 |
| apply phase max | 746 ≤ 900 |
| whole ISR max | 746 ≤ 900 |
| overrun | 0 |
| entry interval max | 1205 ≤ 1230 |
| fast_ticks | 11 |
| pi_compute_count | 6 |
| pwm_apply_count | 6 |
| pending final valid | 0 (consumed) |
| fault / PWM / OST end | 0 / 0 / 1 |
| Timer2 delta | 12852 (11000..14000) |

## Status of the remaining task parts

- G (real 200 µs shot): **blocked** — requires on-site confirmation.
- H (200µs→10V/10s ladder), I (12V lab), J (60 s CSV), K (next-day low
  power): **blocked** — downstream of G/H.
- L (this ZIP + push): **done for the no-power portion**; will be refreshed
  with real-power RAW/JSON/CSV after each authorized stage.

Final tokens as of this delivery:
`SPLIT_PIPELINE_40US_TIMING_PASS` + `REAL_POWER_NOT_AUTHORIZED`.
