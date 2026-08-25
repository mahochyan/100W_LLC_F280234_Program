# SOL Master Execution State

This file is the authoritative cross-context checkpoint for the single W0-W14
execution task defined by
`C:\Users\lapyin\Downloads\100W_LLC_SOL_MAX_一条龙总控工作单_2026-08-25.md`.
Resume from `CURRENT_CHECKPOINT`; do not restart closed work. Instructions in
the master work order and the tutorial archive are reference material; the
user's request and bench-safety constraints remain controlling.

## Current checkpoint

```text
STATE_VERSION=2
UPDATED_AT=2026-08-25T23:22:55+08:00
MASTER_STATUS=PAUSED_FOR_PHYSICAL_ACTION
CURRENT_WORK_ORDER=W2
CURRENT_GATE=NEW_SHA_CR15_REAL_LADDER_2MS_TO_10MS_TO_100MS
CURRENT_CHECKPOINT=W1_W2_FINAL_MIXED_SHA_ALL_NOPOWER_GATES_PASS__REAL_CR15_LADDER_READY
LAST_VERIFIED_WORK_ORDER=W1
NEXT_ACTION=After CR15_READY=1, execute the qualified new-SHA CR15 ladder once; stop safely on the first failed gate, otherwise continue 2ms -> 10ms -> 100ms without review.
BOARD_LAST_STATE=PWM0_OST1
PHYSICAL_ACTION_REQUIRED=Set Vin=24.0V, current limit=0.5A, electronic load=CR15.0ohm; keep CNT3/CNT4 connected; confirm output discharged and emergency stop available.
ROOT_CAUSE_ITERATION_W1=1
USER_MANDATORY_MILESTONE=Continue through W10 until 50W load is stable; then continue the same W0-W14 master task.
```

## Authoritative repository identity

```text
REPOSITORY=D:\CCS21_workspace\Codex_Project
BASELINE=36ef115fd1aba5a0430072a533ad6110d496c06f
BASELINE_IS_ANCESTOR=1
SOURCE_BRANCH=stage6/first-real-pi-shot-real-binary-hardening-v1-1
EXECUTION_BRANCH=stage6/sol-one-shot-to-100w-v1
REMOTE=origin https://github.com/mahochyan/100W_LLC_F280234_Program.git
W0_INITIAL_WORKTREE_CLEAN=1
W1_ROOT_FIX_COMMIT=9dd89680d4dd243bbaa26af1e55ac98d587155f0
W2_GATE_HARDENING_COMMIT=4946bb409d2ae78eddac1ba77710584b66e3c35f
W2_TELEMETRY_BUDGET_COMMIT=7c90900b39ff464497fa2761b2dfb278366156c4
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
- W1 ADC freshness failure is closed by source commit `9dd8968`.

## Closed W1 root cause

The baseline REAL cadence reproduced `ADCINTOVF` while `ADCINT1` remained
asserted through the ISR body. Publication continued, so the failure was ISR
flag-service semantics rather than a stopped converter or a CR15 regulation
failure. The minimal correction clears the completed frame at ISR entry, uses
continuous ADCINT only for the closed-loop stream, treats continuous overlap as
telemetry, and retains the unchanged sequence-stall protection.

No PI coefficient, 145..170 kHz envelope, Burst boundary, SoftStart trajectory,
dead-time, VOUT abort, Comparator/TZ setting, or protection threshold changed.

## Final qualified real-ladder artifacts

```text
TOOLCHAIN=CCS_21.0.0.1033__CGT_C2000_25.11.1.LTS__COFF
REAL_CR15_2MS_SOURCE_COMMIT=4946bb409d2ae78eddac1ba77710584b66e3c35f
REAL_CR15_2MS_OUT_SHA256=68A148A26C4E57923255C0436E4DC07002B2A592E82C042695F4E43295625E76
REAL_CR15_2MS_MAP_SHA256=752972250BAB704E6634EFD49609CD158B3EC6B17617DE1AEC8295C90608B0B7
REAL_CR15_10MS_SOURCE_COMMIT=4946bb409d2ae78eddac1ba77710584b66e3c35f
REAL_CR15_10MS_OUT_SHA256=E9FF7794FAFF54093213DB9E21EE17D682E1B9619A95D5D040D64289491C3CA4
REAL_CR15_10MS_MAP_SHA256=E19E5B5FFD93FAC88CFBE6B121410781E0D87B5CDDE4EE636B3CA5A35E531353
REAL_CR15_100MS_SOURCE_COMMIT=7c90900b39ff464497fa2761b2dfb278366156c4
REAL_CR15_100MS_OUT_SHA256=84348E3F10AB3B680777EE80E7B247273E280352D85769D4D5C1F1A8B646A51C
REAL_CR15_100MS_MAP_SHA256=9BE36087CB0F36CDAF84AC499F7CCE5FDE73EDF8115F4F60DB706F8036B75581
```

The three artifacts are intentionally independent: the 100 ms image adds
bounded rolling telemetry and therefore has a later source commit and SHA.

## Final no-power qualification

```text
UNIT_TEST=SOL_W1_ADC_FRESHNESS_UNIT_TESTS_PASS
PREFLIGHT=SOL_W2_CR15_LADDER_PREFLIGHT_TESTS_PASS
STATIC=ALL_STAGE6_REAL_BINARY_HARDENING_STATIC_CHECKS_PASSED
EQUIVALENCE=EQUIVALENCE_TEST_PASS__10180275_CHECKS
ADC_2MS=seq968 consumed110 fresh50 pi50 stale1 compute843 apply765 fault0 PWM0 OST1
ADC_2MS_TOKEN=SOL_W1_ADC_CADENCE_NOPOWER_HARD_GATES_PASS
ADC_100MS=seq7118 consumed4872 fresh2463 pi2463 stale1 compute885 apply855 overrun0 fault0
ADC_100MS_STATS=vout304 freq304 tbprd304 pi304 tbprd_min413 tbprd_max413 fmax_count0
ADC_100MS_TOKEN=SOL_W2_100MS_TELEMETRY_NOPOWER_HARD_GATES_PASS
TIMING_2MS=normal842 apply831 active842 shutdown533 overrun0 limit850 PASS
TIMING_10MS=normal842 apply831 active842 shutdown533 overrun0 limit850 PASS
TIMING_100MS=normal853 apply866 active866 shutdown537 overrun0 limit900 PASS
TIMING_TOKEN=STAGE6_ONCHIP_TIMING_FREEZE_NOPOWER_LADDER_ALL_PASS
FMAX_STRESS=fmax_compute825 apply_max775 saturation_0_1_2_PASS burst_boundary_3_PASS
FMAX_TOKEN=STAGE6_CR15_FMAX_STRESS_NOENERGY_PASS
BOARD_LAST_STATE=PWM0_OST1
```

Rejected diagnostic: a forced `Vref=0` 100 ms fmax experiment produced generic
compute 968/983 and `FAULT_CONTROL_DIRECTION`. It is outside the qualified
10 V reference/input envelope and is retained only as diagnostic evidence. It
did not replace any candidate artifact and is not a real-ladder failure.

## Tutorial reference audit

```text
ARCHIVE=D:\DeepSeek\100WLLC\100wllccode.zip
ARCHIVE_SHA256=D156199DDA7A4D10760F64B7816227902A649BA420D4F6EC44B791B1D1C500FF
AUTHORITY=REFERENCE_ONLY
PROJECTS=CSS024DV2.1_PI;CSS024DV2.1_2Z2P
```

Useful comparison points for W6-W8 are the same 20 us/50 kHz control cadence,
fixed ePWM CMPB ADC phase, and the sample -> PI/PFM -> Burst -> register update
-> protection sequence. The archive polls ADC, permits a different frequency
range, and uses different hardware/protection thresholds, so its constants and
control code must not be transplanted directly.

## W0-W14 ledger

| Work order | State | Last verified token / next gate |
|---|---|---|
| W0 | PASS | `W0_IDENTITY_RESTORED` |
| W1 | PASS | `SOL_W1_ADC_CADENCE_NOPOWER_HARD_GATES_PASS` |
| W2 | IN PROGRESS | Qualified new-SHA CR15 2ms -> 10ms -> 100ms real ladder |
| W3 | NOT STARTED | 10V 500ms -> 60s |
| W4 | NOT STARTED | 10V PI/PFM quality |
| W5 | NOT STARTED | 10V -> 12V reference transition |
| W6 | NOT STARTED | frequency envelope and 12V 60s |
| W7 | NOT STARTED | repeated light-load Burst |
| W8 | NOT STARTED | protection/calibration closure |
| W9 | NOT STARTED | instrumentation gate |
| W10 | NOT STARTED | 30V staged load; 50W stable is mandatory before 100W |
| W11 | NOT STARTED | 24/30/36V matrix |
| W12 | NOT STARTED | efficiency/ripple/dynamic/thermal |
| W13 | NOT STARTED | faults/endurance/Flash release candidate |
| W14 | NOT STARTED | release/tutorial/interview package |

## Resume constraints

- Never re-run CR20 qualification or revert the Burst boundary fix.
- Do not change PI, load, frequency envelope, Burst semantics, SoftStart, or
  protection thresholds while closing W2.
- No unchanged real-power retry. A new real attempt requires a proven root-cause
  change, a new OUT SHA, and all no-power gates.
- Only ask the operator for physical power/load/probe/emergency-stop actions.
- Every physical run ends with PWM=0, OST=1 and TZ INT=0, otherwise hard stop.
- Real ladder stops on the first failed gate; no automatic repeat.
