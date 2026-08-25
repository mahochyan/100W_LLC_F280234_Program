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
