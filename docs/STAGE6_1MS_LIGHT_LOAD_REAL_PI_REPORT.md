# STAGE6 1ms Light-Load Real PI Shot Report

Status: **FAIL** — `STAGE6_1MS_LIGHTLOAD_REAL_SHOT_FAIL`
Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1-1`
Git HEAD: `006772e5659ca9670beed5374524767d0658a69f`
Date: 2026-08-25

## Result summary

| Token | Value |
|---|---|
| Verdict | `STAGE6_1MS_LIGHTLOAD_REAL_SHOT_FAIL` |
| Failed gate | `VOUT_MAX_BELOW_11V` / `SHOT_STATE_COMPLETE` / `TIMER2_DELTA_59500_62500` / pipeline count gates |
| Board left safe | `FINAL_PWM0_OST1` |
| Retry | `NO_RETRY_EXECUTED` |
| Regulation/efficiency plan | `REGULATION_EFFICIENCY_BENCH_PLAN_READY` |
| Stop | `STOPPED_AWAITING_REVIEW` |

## Binaries

| Item | SHA256 |
|---|---|
| REAL OUT | `80E4647ACE6C0820F1B5460B361085C18A800FD4FB4857FB8C32ED9C0C4C5849` |
| REAL MAP | `93C2B5584387FFFCD9DC1929F92BE747EC62A0AD853710684D5E9CB6A37599F5` |
| NOENERGY | `E8566B058D20A966D382432A2245C9BA81E07DDF501908830CCD617F870FE5C0` |

## Bench conditions (operator-confirmed)

- Vin set: 24 V
- Bench current limit: 0.5 A
- Load: fixed ~1 W (operator confirmed)
- CNT3/CNT4: connected and authorized
- `DSH_CNT34_CONNECTED_CONFIRMED=1`
- `DSH_LIGHT_LOAD_CONFIRMED=1`

## Observed values

| Field | Value |
|---|---|
| state | 4 (ABORTED) |
| abort | 2 (VOUT_11V) |
| ok | 0 |
| power_writes | 14 |
| max_vout_raw | 1368 |
| abort_vout_raw | 1367 |
| fault | 0x10000 (FAULT_FIRST_SHOT_ABORT) |
| softstart | COMPLETE |
| handoff | OK |
| first/last/min/max cmd | 150000 / 150000 / 150000 / 150000 Hz |
| fast_ticks | 27 |
| pi_compute_count | 15 |
| pwm_apply_count | 14 |
| ISR max | 714 |
| compute max | 714 |
| apply max | 710 |
| overrun | 0 |
| shot-local entry max | 0 (abort before first apply? see RAW) |
| final PWM | 0 |
| final OST | 1 |
| power_window_state | 1 (not POST_OST) |
| system_state | 4 (FAULT) |

## Interpretation

Even with a fixed ~1 W light load, the 1 ms bounded PI shot again hit the 11 V
fast abort (`max_vout_raw=1368 >= abort_vout_raw=1367`). The frequency command
stayed at 150000 Hz and the shot did not reach the normal 1 ms timeout.

This is consistent with the previous no-load 1 ms failures and is classified as:

`LIGHT_LOAD_1MS_CONTROL_RANGE_INSUFFICIENT`

The existing PI/frequency slope still cannot keep VOUT below the 11 V abort
threshold during the 1 ms window under this light load.

## Safety state after run

- PWM = 0
- OST = 1
- Fault not cleared
- No reload, no reset, no retry
- Evidence preserved

## Evidence files

- `evidence/stage6_first_real_pi_shot_real/G9_1MS_LIGHTLOAD_REAL_80E4647A_RAW.txt`
- `evidence/stage6_first_real_pi_shot_real/G9_1MS_LIGHTLOAD_REAL_80E4647A_RESULT.json`
- `docs/STAGE6_1MS_LIGHT_LOAD_REAL_PI_REPORT.md`

## Next action

Stop and await human review. Do not raise the 11 V threshold, do not modify PI,
do not retry automatically, do not enter continuous closed-loop or high-power
testing.
