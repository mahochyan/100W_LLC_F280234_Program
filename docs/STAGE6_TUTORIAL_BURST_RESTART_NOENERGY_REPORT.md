# STAGE6 Tutorial Burst Restart NOENERGY Report

Status: **FAIL — restart not triggered in current minimal state machine**
Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1-1`
Baseline: `04ba8f0`
Date: 2026-08-25

## Summary

- Implemented minimal Burst state machine:
  - `SHOT_BurstEnter()`: enter Burst OFF, keep control running.
  - `SHOT_BurstRestart()`: one deterministic restart attempt then final safe stop.
- Burst entry works in NOENERGY.
- Full restart did **not** trigger in the host-driven VOUT switch test:
  - After Phase1 Burst entry, Phase2 low VOUT did not produce a restart.
  - `burst_exit_count=0`, `restart_attempt_count=0`.

## Result

```text
PHASE1 state=0 burst_active=1 enter=1
FINAL state=0 abort=0 ok=0
enter=1 exit=0 attempt=0 success=0 fail=0
pending=0 pwm=0 ost=1 pws=2 fault=0
BURST_RESTART_NOENERGY_PASS=false
```

## Next steps

- Debug why the shadow period does not reach >=400 after VOUT switch in the
  NOENERGY hook.
- Confirm shot state/arm remain valid during Burst OFF.
- Implement on-chip VOUT switching stimulus for true scenario 3.

## Final output

```text
TUTORIAL_BURST_RESTART_NOENERGY_FAIL
FAILED_GATE=RESTART_NOT_TRIGGERED
REAL_POWER_NOT_EXECUTED
STOPPED_AWAITING_REVIEW
```

## Mode6 activation attempt

- Added Mode 6 on-chip stimulus: high VOUT 1362 -> Burst OFF -> auto switch to 1126.
- Burst entry occurred (`enter=1`).
- Restart did **not** trigger before the 500us cage TIMEOUT:
  - `exit=0`, `attempt=0`, `success=0`
  - final abort=1 (TIMEOUT), not RESTART_DONE
- The shadow-control path still did not produce `period >= 400` before the cage ended.

Evidence:
- `evidence/stage6_first_real_pi_shot_real/BURST_RESTART_MODE6_NOENERGY_446EEC56_RAW.txt`
- `evidence/stage6_first_real_pi_shot_real/BURST_RESTART_MODE6_NOENERGY_446EEC56_RESULT.json`

Status: **FAIL**

## Shadow-base attempt (V1_3)

- Added `g_burst_shadow_base_frequency_hz` and used it as slew base during Burst OFF.
- Mode6 now advances VOUT switch on-chip and counts Burst-OFF compute/apply.
- Result: shadow base advanced from 150500 to 150400 (one step), then did not continue to 149800.
- `burst_off_fresh_compute_count=1`, `last_shadow=150400`, restart not triggered.

Status: **FAIL**

## V1_4 Closure - PASS

Root cause fixed: Burst OFF APPLY now marks `PIPELINE_PHASE_APPLY` and increments `g_burst_off_apply_discard_count`, so COMPUTE/APPLY alternation continues.

Mode6 NOENERGY result:

```text
state=3 abort=10 ok=1
enter=1 exit=1 attempt=1 success=1 fail=0
high=2 low=15 fresh=16
offFresh=7 offApply=6
firstShadow=150500 lastShadow=149800 minShadow=149800
firstPeriod=398
pending=0 pwm=0 ost=1 pws=2 fault=0
pre_ost=1 post_ost=0
BURST_RESTART_NOENERGY_PASS=true
```

Builds:
```text
REAL OUT    = 9794211DE6081F1EE2FD2EA7C83454BBFD76ADAEB2281308B00BF0510C886B77
REAL MAP    = BAD6CF0140FB652B4FBAC3565F2D317CDC73346BA6BED31C54B1B5C58AE2C25C
NOENERGY OUT= 04E3CA30D7DAA58C633359FD0E9512DF758E7F37959AD485E975485908738344
NOENERGY MAP= 3D76E37073265F0CD336DE996FEA5CEF3D63CA902ED5D36C21EB4048FE4675E9
```
