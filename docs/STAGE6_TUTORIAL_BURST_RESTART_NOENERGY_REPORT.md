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
