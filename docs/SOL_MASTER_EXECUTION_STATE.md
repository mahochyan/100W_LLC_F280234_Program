# SOL Master Execution State

This file is the authoritative cross-context checkpoint for the single W0-W14
execution task defined by
`C:\Users\lapyin\Downloads\100W_LLC_SOL_MAX_一条龙总控工作单_2026-08-25.md`.
Resume from `CURRENT_CHECKPOINT`; do not restart closed work.

## Current checkpoint

```text
STATE_VERSION=1
UPDATED_AT=2026-08-25T23:08:00+08:00
MASTER_STATUS=PAUSED_FOR_PHYSICAL_ACTION
CURRENT_WORK_ORDER=W1
CURRENT_GATE=NEW_SHA_CR15_2MS_REAL
CURRENT_CHECKPOINT=W1_ROOT_CAUSE_FIXED__ALL_NOPOWER_GATES_PASS__REAL_2MS_READY
LAST_VERIFIED_WORK_ORDER=W0
NEXT_ACTION=After CR15_READY=1, execute the new-SHA CR15 2ms run exactly once; on PASS continue W2 10ms then 100ms without review.
BOARD_LAST_STATE=PWM0_OST1
PHYSICAL_ACTION_REQUIRED=Set Vin=24.0V, current limit=0.5A, electronic load=CR15.0ohm; keep CNT3/CNT4 connected; confirm output discharged and emergency stop available.
ROOT_CAUSE_ITERATION_W1=1
```

## Authoritative repository identity

```text
REPOSITORY=D:\CCS21_workspace\Codex_Project
BASELINE=36ef115fd1aba5a0430072a533ad6110d496c06f
ADOPTED_HEAD=91272124a1c3458c65b7af7091b9c2feb0e4fc4d
BASELINE_IS_ANCESTOR=1
BASELINE_TO_HEAD_DELTA=one evidence/work-log-only commit (9127212)
SOURCE_BRANCH=stage6/first-real-pi-shot-real-binary-hardening-v1-1
EXECUTION_BRANCH=stage6/sol-one-shot-to-100w-v1
REMOTE=origin https://github.com/mahochyan/100W_LLC_F280234_Program.git
W0_INITIAL_WORKTREE_CLEAN=1
```

## Toolchain and target

```text
CCS_EXE=D:\CCS21\ccs\theia\ccstudio.exe
CCS_VERSION=21.0.0.1033
COMPILER=D:\CCS21\ccs\tools\compiler\ti-cgt-c2000_25.11.1.LTS\bin\cl2000.exe
COMPILER_VERSION=25.11.1.LTS
PROJECT_METADATA_LEGACY_COMPILER=16.9.3.LTS
TARGET=TMS320F28034
DEBUG_PROBE=Texas Instruments XDS100v2 USB Debug Probe
CCXML=F28034.ccxml
CCXML_SHA256=3E34B4BF71B41A6FFBDA14A177CDFC7EA127DD22432F96054ACB2D269A0E9D6F
CPU_CLOCK_HZ=60000000
FAST_TASK=20us
SLOW_TASK=5ms
REAL_BUILD_ABI=COFF
```

The legacy compiler value is retained in `.cproject`, but the verified Stage6
build scripts and artifacts use CGT 25.11.1.LTS. Do not silently switch
toolchains.

## Accepted prior results (do not redo)

- Base bring-up, JTAG, safe PWM default, fixed PWM and software OST path.
- `REAL_POWER_200KHZ_DB140_3_CYCLE_PASS`.
- Formal Profile C SoftStart handoff and REAL apply optimization.
- On-chip timing request/active/freeze measurement architecture.
- Prior 2ms/10ms/100ms no-power timing gate.
- Correct Burst boundary across TBPRD 352..413.
- CR20 is a true fmax light-load region and is not a continuous-PFM target.
- Valid CR15 2ms result is a safe failure due to ADC stale overflow, not a
  load-regulation failure.

## Current W1 failure evidence

```text
VALID_LOAD=CR15.0_OHM
VIN=24.0V
INPUT_CURRENT_LIMIT=0.5A
STATE=ABORTED
ABORT=SHOT_ABORT_PERMISSION
SOFTSTART=COMPLETE
HANDOFF=OK
BURST_ENTER_COUNT=0
MAX_VOUT_RAW=1357 (<1367)
FAULT=0x10040
FAULT_PRIMARY=FAULT_ADC_STALE_OVERFLOW
COMPUTE_MAX=868
ACTIVE_ISR_MAX=868
APPLY_MAX=849
OVERRUN=0
FINAL_PWM=0
FINAL_OST=1
FINAL_TZINT=0
```

Artifact identity:

```text
CR15_2MS_OUT_SHA256=5E2B320B906F867725A9C843A94E78B8D50CB576CA92E2841871AF081DE3EDD7
CR15_2MS_MAP_SHA256=1B6844298664C2C89C78161379E630394E6BAA0C8A951B6FCCB8EDC0FF06C9CC
RAW_SHA256=0EFBC4A78D98F980785270FD82EA5EDD1B2C4527528B498AB2ADEF27DBF251E7
JSON_SHA256=02C6AD247D00684AAE86A0CE86598136F237B74C77400B4F400CE25D3ED400FA
```

## W0-W14 ledger

| Work order | State | Last verified token / next gate |
|---|---|---|
| W0 | PASS | `W0_IDENTITY_RESTORED` |
| W1 | IN PROGRESS | ADC freshness root cause and no-power qualification |
| W2 | NOT STARTED | New-SHA CR15 2ms -> 10ms -> 100ms |
| W3 | NOT STARTED | 10V 500ms -> 60s |
| W4 | NOT STARTED | 10V PI/PFM quality |
| W5 | NOT STARTED | 10V -> 12V reference transition |
| W6 | NOT STARTED | frequency envelope and 12V 60s |
| W7 | NOT STARTED | repeated light-load Burst |
| W8 | NOT STARTED | protection/calibration closure |
| W9 | NOT STARTED | instrumentation gate |
| W10 | NOT STARTED | 30V staged load to 100W |
| W11 | NOT STARTED | 24/30/36V matrix |
| W12 | NOT STARTED | efficiency/ripple/dynamic/thermal |
| W13 | NOT STARTED | faults/endurance/Flash release candidate |
| W14 | NOT STARTED | release/tutorial/interview package |

## Resume constraints

- Never re-run CR20 qualification or revert the Burst boundary fix.
- Do not change PI, load, frequency envelope, Burst semantics, SoftStart, or
  protection thresholds while closing W1.
- No unchanged real-power retry. A new real attempt requires a proven root-cause
  change, a new OUT SHA, and all no-power gates.
- Only ask the operator for physical power/load/probe/emergency-stop actions.
- Every physical run ends with PWM=0, OST=1 and TZ INT=0, otherwise hard stop.

## W1 qualified real candidate

```text
SOURCE_COMMIT=9dd89680d4dd243bbaa26af1e55ac98d587155f0
ROOT_CAUSE=ADCINT1_LATE_CLEAR__EOC2_OVERFLOW_MISCLASSIFIED_AS_STOPPED_PUBLICATION
UNIT_TEST=SOL_W1_ADC_FRESHNESS_UNIT_TESTS_PASS
REAL_CADENCE_NOPOWER=SOL_W1_ACTIVE_ADCINT_OVERFLOW_CLEAR
TIMING_LADDER_NOPOWER=STAGE6_ONCHIP_TIMING_FREEZE_NOPOWER_LADDER_ALL_PASS
FMAX_STRESS_NOPOWER=STAGE6_CR15_FMAX_STRESS_NOENERGY_PASS
CR15_2MS_OUT_SHA256=A1067015ADD4242BB6F48F70A223174DBFAC3F50997ED4F5DAFF4F3C75EACECA
CR15_2MS_MAP_SHA256=F96EC0C3E8A92C2AB0BE5DD0BF4FCB47C498F432B546D98CF39D1FE5101E30C3
BOARD_LAST_STATE=PWM0_OST1
```
