# STAGE6 Tutorial Light-Load Burst Entry Restore Report

Status: **NOENERGY PASS / NO REAL POWER**
Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1-1`
Baseline: `e96bffe`
Date: 2026-08-25
Transformer: Ns1:Np:Ns2 = 4:5:4

## Tutorial audit (CSS024DV2.1_PI)

- ISR_20US order:
  `ADCSample → ILoopCtl → VILoopCtl → BurstCtl → RegReflash → FastProtection`
- Tutorial parameters:
  - `MIN_BURST = 400`
  - `MIN_LOOPOUT = 399`
- Tutorial Burst entry:
  - `period_request < 400` → `PWMDis()` / Burst active
  - `period_request >= 400` → `PWMEn()` restart (not implemented this round)

## Reclassification

- `BE752B16 + CR100Ω`:
  - `HANDOFF_REFERENCE_FIX_PASS`
  - `CR100_CONTINUOUS_PFM_TEST_REGION_INVALID`
  - `TUTORIAL_BURST_PATH_MISSING`
- CR100Ω:
  - @10V ≈ 1.00W
  - @11V ≈ 1.21W
  - Region: `LIGHT_LOAD_BURST_REGION`

## Documentation drift

- `docs/TUTORIAL_SOFTSTART_PORT_V1.md` claims Burst is implemented in
  `SoftStart_ApplyLimits()`, but that function is empty.
- Recorded: `TUTORIAL_BURST_DOCUMENTATION_DRIFT_CONFIRMED`

## Implementation

- Added `SHOT_ABORT_TUTORIAL_BURST_ENTRY = 9`
- Added `TUTORIAL_MIN_BURST = 400`
- Added `SHOT_EnterTutorialBurst()`
- In `CTRL_PipelineApply`, if pending period < 399 (period+1 < 400), enter Burst:
  - `burst_active=1`
  - `burst_enter_count++`
  - `LLC_PWM_DisableSafe()`
  - PWM=0, OST=1, POST_OST, pending=0, no fault
  - state=COMPLETE, ok=1, stop=BURST_ENTRY
- No Burst restart implemented.

## NOENERGY verification

Negative (VOUT=1362):
```text
state=3 abort=9 ok=1
burst_active=1 burst_enter_count=1
power_writes=0 pending_valid=0
PWM=0 OST=1 POST_OST fault=0
```

Positive (VOUT=1126):
```text
state=3 abort=1 ok=1
burst_active=0 burst_enter_count=0
power_writes=13 pending_valid=0
PWM=0 OST=1 POST_OST fault=0
```

## Connected no-switching REAL timing

```text
state=3 abort=1 ok=1 t2d=30925
fresh=1 stale=25 pi=1 apply=1 pw=1 pending=0
PWM=0 OST=1 POST_OST fault=0
ISR max=815 <=900
compute max=751
apply max=815
overrun=0
```

## Builds

```text
REAL OUT    = 773252E4346316BD914971D22891494C7C918EC9CC6268BA3FAA69609CF1B6D0
REAL MAP    = 38ACDD07A1CA48F8907B1FA07A7647C164D730CE41ADDFEB8A0A68EF7B74F680
NOENERGY OUT= BE86CA424A8A69DBC0DE5595A8B6C11A01A60F5CEFF327EEA20DF42559FEBCEC
NOENERGY MAP= 3D76E37073265F0CD336DE996FEA5CEF3D63CA902ED5D36C21EB4048FE4675E9
```

## Final output

```text
TUTORIAL_CONTROL_PATH_REAUDITED
CR100_CLASSIFIED_AS_LIGHTLOAD_BURST_REGION
TUTORIAL_BURST_DOCUMENTATION_DRIFT_CONFIRMED
TUTORIAL_BURST_ENTRY_NOENERGY_PASS
BURST_RESTART_NOT_IMPLEMENTED
REAL_CONNECTED_NO_SWITCHING_TIMING_PASS
CNT34_PERMANENTLY_CONNECTED
NO_REAL_POWER_EXECUTED
READY_FOR_SINGLE_CR100_BURST_ENTRY_REAL_REVIEW
```

## Real CR100 Burst-entry shot (authorized)

Result: **PASS — TUTORIAL BURST ENTRY**

- Real OUT: `773252E4...`
- Load: CR 100Ω
- Handoff OK, entered PI
- First high-frequency request triggered Burst entry:
  - state=COMPLETE
  - abort=9 (BURST_ENTRY)
  - ok=1
  - burst_active=1, burst_enter_count=1
  - max_vout_raw=1249 (<1367)
  - fault=0
  - PWM=0, OST=1, POST_OST, pending=0
- ISR max=823 <=900, compute=823, apply=756, overrun=0
- Note: Burst entry is a normal stop before the 500us TIMEOUT, so TIMER2/TIMEOUT gates are not applicable.

Evidence:
- `evidence/stage6_first_real_pi_shot_real/BURST_ENTRY_REAL_CR100_773252E4_RAW.txt`
- `evidence/stage6_first_real_pi_shot_real/BURST_ENTRY_REAL_CR100_773252E4_RESULT.json`

No retry, no further power.

## Threshold correction per user decision

User selected: **TBPRD < 400 (task C literal)**.

- Burst condition is now `p->period < TUTORIAL_MIN_BURST` (i.e., TBPRD < 400).
- NOENERGY negative: Burst entry PASS.
- NOENERGY positive: also enters Burst at first 149900 Hz step because TBPRD=399 < 400. This is accepted under the selected representation, but conflicts with the original H positive no-Burst expectation.

## Restart status

**NOT IMPLEMENTED** in this session. The full Burst deterministic restart state machine
(BURST_ON → BURST_OFF_WAIT → BURST_RESTART_ARMED → BURST_RESTARTED → BURST_FINAL_SAFE_STOP)
is still pending. Therefore `TUTORIAL_BURST_RESTART_NOENERGY_PASS` is not yet achieved.
