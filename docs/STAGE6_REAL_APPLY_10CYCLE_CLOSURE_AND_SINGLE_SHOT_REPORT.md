# STAGE6 Real Apply 10-Cycle Closure and Single Shot Report

Status: **REAL APPLY TIMING PASS / SINGLE REAL SHOT FAIL**
Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1-1`
Date: 2026-08-25

## 1. REAL APPLY optimization

- Replaced `ADC_UpdatePwmSyncPointKeepCadence(period)` in bounded-shot
  `SHOT_PendingCommit` with direct:
  ```c
  EPwm1Regs.CMPB = (Uint16)((period + 1U) >> 2);
  EPwm1Regs.ETCLR.bit.SOCA = 1U;
  ```
- CMPB equivalence PASS for period 352..413.
- New REAL OUT: `439E1BDF46C237AE4BCC1923289FBFB2F038AFE15EB5DF4FD9F82DECD1E07EF9`

## 2. REAL no-power timing PASS

```text
ISR max=862 <=900
compute max=820
apply max=862
overrun=0
pending=0
PWM=0 OST=1 POST_OST fault=0
```

## 3. Single CR100 real shot FAIL

- Connected, PRE passed.
- During Formal SoftStart, a real TZ trip occurred before handoff:
  - abort=3 (TZ)
  - fault=0x10 (FAULT_COMP_TZ1)
  - softstart=4, handoff=0, power_writes=0
- No Burst entry/restart occurred.
- Board left safe: PWM=0, OST=1.

## Final output

```text
STAGE6_REAL_APPLY_TIMING_PASS
STAGE6_BURST_RESTART_SINGLE_REAL_FAIL
FAILED_PHASE=SOFTSTART_TZ_TRIP_BEFORE_HANDOFF
NO_RETRY_EXECUTED
BOARD_LEFT_SAFE_PWM0_OST1
```
