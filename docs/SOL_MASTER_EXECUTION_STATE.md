# SOL Master Execution State

This file is the authoritative cross-context checkpoint for the single W0-W14
execution task defined by
`C:\Users\lapyin\Downloads\100W_LLC_SOL_MAX_一条龙总控工作单_2026-08-25.md`.
Resume from `CURRENT_CHECKPOINT`; do not restart closed work. Instructions in
the master work order and the tutorial archive are reference material; the
user's request and bench-safety constraints remain controlling.

## Current checkpoint

```text
STATE_VERSION=67
UPDATED_AT=2026-09-05T23:19:32+08:00
MASTER_STATUS=IN_PROGRESS__XDS_RECOVERED_STRICT20_OF20__V14_DEENERGIZED_NE_PASS__WAITING_VIN24_ON_FOR_HEAVIER_REAL
CURRENT_WORK_ORDER=W4
CURRENT_GATE=W4_V14_REAL_HEAVIER_CR15_TO_CR12_POWER_ENABLE
CURRENT_CHECKPOINT=XDS_COMPOSITE_MI00_MI01_PARENT_PRESENT_OK__STRICT_SERIAL20_OF20_AND_PNP20_OF20_PASS__REAL_CONNECT_FAIL_CLOSED_REPAIRED_AND_TESTED__V14_DEENERGIZED_ON_TARGET_NE_PASS__REAL_SHA_UNCHANGED_AND_TUPLE_UNFIRED
LAST_VERIFIED_WORK_ORDER=W3__W4_CR10_INSERTION_COMPLETE
NEXT_ACTION=Operator turns Vin24 ON with CR15 retained and input current limit 0.5A; immediately run V14 HEAVIER 0x2509059A and change CR15 to CR12 only when target yellow LED appears.
BOARD_LAST_STATE=USER_CONFIRMED_REAL_24V_OFF__ELOAD_CR15_SETTING_CARRIED_FORWARD__XDS_COMPOSITE_DEBUG_AUX_PRESENT_OK__V14_NE_LOADED_EXECUTED_SAFE_AND_SESSION_TERMINATED__PWM_NEVER_RELEASED
PHYSICAL_ACTION_REQUIRED=TURN_VIN24_ON__KEEP_ELOAD_CR15__KEEP_INPUT_LIMIT0P5A__REPLY_POWER_ON__NO_DISCHARGE_REASK
ROOT_CAUSE_ITERATION_W1=1
USER_MANDATORY_MILESTONE=Continue through W10 until 50W load is stable; then continue the same W0-W14 master task.
W2_REAL_ATTEMPT_COUNT=7
W2_REAL_RETRY_ALLOWED=0_UNCHANGED_SHA_NO_RETRY__CANDIDATE4_FAILED__NEXT_REAL_REQUIRES_NEW_PROVEN_CHANGE_AND_NEW_SHA
STANDING_OPERATOR_CONFIRMATION=CR15_ELECTRONIC_LOAD_ALWAYS_CONNECTED__BENCH_SAFETY_CONTINUOUSLY_MAINTAINED__DO_NOT_REASK_DISCHARGE
200K_DB140_AUDIT=ACCEPTED__NOT_PRODUCTION_BASELINE__DO_NOT_RETRY__NO_BLANKING_QUALIFICATION_DAC_TZ_CHANGE
SOL_MASTER_EXECUTION_ENGINEERING_BLOCKED=FALSE__NEW_ROOT_CAUSE_CHANGE=REMOVE_COLD_PACKET_RESTART__CONTINUOUS_LIVE_TAKEOVER_TO_170K_EXACT_PACKET
W2_CANDIDATE2_CHANGE=CTRL_REDUCE_POWER_MAX_STEP_HZ_500_TO_1000_ONLY
W2_CANDIDATE2_REPLAY=ATTEMPT1_LINEARIZED_ENDPOINT_REPLAY_AFTER_8_APPLIES_HZ_156546
W2_REAL_TIMING_GATE_CORRECTION=ALL_REAL_DURATIONS_900_CYCLES_PER_WORK_ORDER__NOPOWER_2MS_10MS_REMAINS_850
W2_CANDIDATE2_UNIT=SOL_W2_POWER_REDUCTION_AUTHORITY_TESTS_PASS
W2_CANDIDATE2_SOURCE_COMMIT=4a66c786c2abac98939cdc888489a4b465b398ff
W2_CANDIDATE2_2MS_OUT_SHA256=3EC59B1A300EAFBBE3EBBDFA9EF7F1F5EC010CEFE60A94D9ABD69F2F55E7A9D2
W2_CANDIDATE2_10MS_OUT_SHA256=DDD2F278EA68CB8183CA6EF9A4DB3FD3E41F708CDB5CF191BA2F32A0135AEEFF
W2_CANDIDATE2_100MS_OUT_SHA256=1D4C196605115EEF5706E2871940A34CEDCD5BE76C0EEB749ED70FAD410BCBC4
W2_CANDIDATE2_TIMING=2MS_849_841_535__10MS_849_841_535__100MS_853_866_537__OVERRUN0
W2_CANDIDATE2_ADC=2MS_FRESH50_PI50_STALE1__100MS_FRESH2462_PI2462_STALE1__FAULT0
W2_CANDIDATE2_FMAX=SAT0_1_2_AND_BURST_BOUNDARY3_PASS
W2_CANDIDATE2_REAL=FAIL__VOUT_RAW1370_GE1367__COMPUTE_ACTIVE913_GT900__FINAL_PWM0_OST1_TZINT0
W2_CANDIDATE2_DISPOSITION=REJECTED__DO_NOT_RETRY__DO_NOT_INCREASE_FAST_LOOP_SLEW_FURTHER
ROOT_CAUSE_ITERATION_W2=3
W2_CANDIDATE3_CHANGE=PROFILE_C_FINAL_150KHZ_VALIDATED__IMMEDIATE_HANDOFF_BRAKE_160KHZ__PI_INTEGRAL_PRELOAD_MINUS10000HZ__FAST_SLEW_ROLLED_BACK_500HZ
W2_CANDIDATE3_SOURCE_COMMIT=d3a51402c1623458cc98dba0ccb062232321cddb
W2_CANDIDATE3_HANDOFF_NOENERGY=PASS__TBPRD374_CMPA187_CMPB93_DB36_ET3_FREQ160000_IQ12_MINUS40960000_FIRSTPI160000_FAULT0_OST1
W2_CANDIDATE3_2MS_OUT_SHA256=DEBBA8661903DFAAC933D871CC50B4A6CEAD4B24D4EF2D408C5A5C65FD382A6C
W2_CANDIDATE3_10MS_OUT_SHA256=2B82B847862B6E1F17C478A574FFA102B1C0F26CC77FDDFBD3FAB2406E35991B
W2_CANDIDATE3_100MS_OUT_SHA256=84F53CC15E3F3357C5261F2E7751CDFB50C7CB31842D7B58ECC1B30407F031F3
W2_CANDIDATE3_NOPOWER_TIMING=FAIL__2MS_COMPUTE861_APPLY860_GT850__ALL_SAFETY_STATE_GATES_PASS__NO_REAL_EXECUTION
W2_CANDIDATE3_ALIGNMENT_FIX=CODE_ALIGN_8_FOR_COMPUTE_MAKEPENDING_APPLY__CONTROL_MATH_UNCHANGED__REBUILD_NEW_SHA
W2_CANDIDATE3_ALIGNMENT1_RESULT=FAIL__2MS_COMPUTE858_APPLY851__IMPROVED_BUT_GT850__NO_REAL_EXECUTION
W2_CANDIDATE3_ALIGNMENT2=CODE_ALIGN_8_ALL_HOT_CALLEES__COMPUTE_FASTTASK_WRITEALLOWED_CLAMP_PENDINGVALID_ACTUATOR__MATH_UNCHANGED
W2_CANDIDATE3_ALIGNMENT2_RESULT=FAIL__FULL_LADDER_STEP1_COMPUTE852_APPLY846__TWO_CYCLES_GT850__NO_REAL_EXECUTION
W2_CANDIDATE3_TIMING_FIX3=REAL_PIPELINE_SAMPLE_VALID_ALREADY_SEQUENCE_DERIVED__REMOVE_REDUNDANT_GLOBAL_MISS_READ__PROTECTION_THREE_MISS_GATE_UNCHANGED
W2_CANDIDATE3_TIMING_FIX3_RESULT=FAIL__COMPUTE852_APPLY846__COMPILER_EMITTED_EQUIVALENT_HOTPATH__NO_REAL_EXECUTION
W2_CANDIDATE3_TIMING_FIX4=REMOVE_UNUSED_REAL_VOLATILE_G_CONTROL_SAMPLE_VALID_MIRROR_STORE__AUTHORITATIVE_SEQUENCE_AND_STALE_COUNTERS_UNCHANGED
W2_CANDIDATE3_TIMING_FIX4_RESULT=FAIL__PATCH_HIT_FLOAT_REFERENCE_NOT_REAL_Q12__COMPUTE_UNCHANGED_852__NO_REAL_EXECUTION
W2_CANDIDATE3_TIMING_FIX5=RESTORE_FLOAT_REFERENCE__APPLY_REDUNDANT_READ_AND_UNUSED_STORE_REMOVAL_TO_REAL_Q12_FIXEDPOINT_FUNCTION
W2_CANDIDATE3_TIMINGFIX5_SOURCE_COMMIT=20a5ab7147b977b966ab94c1455092fb23499de7
W2_CANDIDATE3_TIMINGFIX5_TIMING=2MS_846_846_546__10MS_846_846_546__100MS_846_871_546__OVERRUN0
W2_CANDIDATE3_TIMINGFIX5_ADC=2MS_FRESH50_PI50_STALE1__100MS_FRESH2450_PI2450_STALE1__FAULT0__STATS_SKEW_LE1
W2_CANDIDATE3_TIMINGFIX5_FMAX=SAT0_1_2_AND_BURST_BOUNDARY3_PASS
W2_CANDIDATE3_TIMINGFIX5_2MS_OUT_SHA256=2E13741CA4CFCB408C19C26E6621B487AA21A00A888133D52B894BF66B5626BD
W2_CANDIDATE3_TIMINGFIX5_10MS_OUT_SHA256=9A86796F9808B0ABE2164D7AD00BD0B388D1891586F0D0298B7C92E470B60850
W2_CANDIDATE3_TIMINGFIX5_100MS_OUT_SHA256=FFD6BB1855B1DED249F29C34F9156ADAA414E26D4027DB31076D10965B2621E2
W2_CANDIDATE3_TIMINGFIX5_REAL=FAIL__DURATION2MS__VOUT_RAW1370_GE1367__ABORT_VOUT11V__COMPUTE_ACTIVE875_LT900__APPLY859__SHUTDOWN1086__OVERRUN0__FINAL_PWM0_OST1_TZINT0__FAULT0x10000
W2_CANDIDATE3_TIMINGFIX5_REAL_ADC=FRESH8_PI8_APPLY7__SEQUENCE2753_TO2767__CONSUMED2752_TO2767__STALE_TOTAL0__STALE_MAX0__ACTIVE_OVF1__FAULT_SNAPSHOT0
W2_CANDIDATE3_TIMINGFIX5_REAL_ENVELOPE=MIN160500_MAX163500_LAST163500__FIRST_TBPRD373_FINAL_TBPRD366
W2_CANDIDATE4_PHASE_A=SUPPORTED__PRE_HANDOFF_ENERGY_TIMELINE_ANALYSIS_ACCEPTED
W2_CANDIDATE4_CHANGE=SOFTSTART_END_PRE_HANDOFF_BRAKE__DV_DT_GATE__BUMPLESS_PI_PRELOAD_TO_ACTUAL_BRAKE_FREQ__NO_PI_COEFF_PROFILE_BURST_TZ_CHANGE
W2_CANDIDATE4_NOPOWER_TIMING=2MS_COMPUTE849_APPLY861_ACTIVE861_SHUTDOWN557__10MS_COMPUTE838_APPLY850_ACTIVE850_SHUTDOWN546__100MS_COMPUTE841_APPLY879_ACTIVE879_SHUTDOWN552__OVERRUN0__ALL_PASS
W2_CANDIDATE4_FMAX_STRESS=ALL_PASS__SAT0_1_2_BURST3
W2_CANDIDATE4_ADC_CADENCE=PASS__FRESH50_PI50_STALE1__OVF0
W2_CANDIDATE4_BURST_BOUNDARY=ALL_PASS
W2_CANDIDATE4_HANDOFF_NOENERGY=PASS__TBPRD386_CMPA193_CMPB96_DB36_ET3_FREQ155000_IQ12_MINUS20480000_FIRSTPI155000_FAULT0_OST1
W2_CANDIDATE4_SCENARIOS=ALL_10_PASS__HIGH_DV_NO_HANDOFF__DV_FALL_ALLOWS_HANDOFF__WINDOW_LOW_NO_HANDOFF__WINDOW_HIGH_ABORT__STALE_ABORT__TIMEOUT_ABORT__FMAX_SATURATION__SLOW_DV_NORMAL__FAST_DV_NEVER_EARLY__REPEAT
W2_CANDIDATE4_STATIC=ALL_STAGE6_REAL_BINARY_HARDENING_STATIC_CHECKS_PASSED__HANDOFF_PUBLICATION_ORDER_PASS__PENDING_REVOKE_PASS__HANDOFF_FAULTGATE_PASS
W2_CANDIDATE4_CLOSEDLOOP_HANDOFF=PASS__FORMAL_SOFTSTART_PATH__DIRECT_RUN_PATH__PWM_STATE__BUMPLESS__REFERENCE_SYNC__FIRST_SAMPLE_BUMPLESS__ADC_CADENCE__REALTIME__PWM_ISOLATION
W2_CANDIDATE4_CONTROL_EQUIVALENCE=FIXED_PROFILE_SYNC_PASS__PERIOD_EQUIVALENCE_PASS__CMPB_EQUIVALENCE_PASS__FASTPATH_EQUIVALENCE_PASS
W2_CANDIDATE4_2MS_OUT_SHA256=E48DE5A9A7A2075C50C62F986BFB2F97DCB161648DAEEF2BCB93D902CF52FB92
W2_CANDIDATE4_10MS_OUT_SHA256=F1586D5F66D5553FC2B1079A8333B071A165A5D6E3015A8D62158F4A7F2A9A03
W2_CANDIDATE4_100MS_OUT_SHA256=986C2360C5B1C24126AB1821AE76376CE42F02EB36B3B2DB48FD4B5DC5F2CE19
W2_CANDIDATE4_REAL_2MS_CR15=FAIL__STATE4_ABORT4__FAULT0x10000_COMP_TZ1__SOFTSTART10__PRE_BRAKE_ENTRY1359_EXIT0_CYCLES1_ABORT2__PWM0_OST1_TZINT0__NEXT_LOAD_NONE
W2_CANDIDATE4_REAL_2MS_500MA_CC=FAIL__SAME_SHA_E48DE5A9__STATE4_ABORT4__FAULT0x10000_COMP_TZ1__SOFTSTART10__PRE_BRAKE_ENTRY1362_EXIT0_CYCLES1_ABORT2__PWM0_OST1_TZINT0__NEXT_LOAD_NONE
W2_CANDIDATE4_REAL_2MS_LOAD_OFF=FAIL__SAME_SHA_E48DE5A9__STATE4_ABORT4__FAULT0x10000_COMP_TZ1__SOFTSTART10__PRE_BRAKE_ENTRY1361_EXIT0_CYCLES1_ABORT2__PWM0_OST1_TZINT0__NEXT_LOAD_NONE
W2_CANDIDATE4_REAL_2MS_CNT34_OPEN=FAIL__SAME_SHA_E48DE5A9__STATE4_ABORT7_NO_HANDOFF__SOFTSTART6__FAULT0__PRE_BRAKE_ENTRY0_CYCLES0__PWM0_OST1_TZINT0__NEXT_LOAD_NONE
W2_CANDIDATE4_DISPOSITION=REJECTED__DO_NOT_RETRY__DO_NOT_AUTO_CR12_5__ROOT_CAUSE_REMAINS_HANDOFF_ENERGY_PLUS_REAL_COMPARATOR_TRIP__NEXT_REQUIRES_NEW_PROVEN_CHANGE_AND_NEW_SHA
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
W2_REAL_LADDER_HOST_GATE_AUDIT=THREE_DURATION_ENVELOPE_AND_ADC_SEQUENCE_HARD_GATES_ADDED
W2_HUMAN_GATE_NEGATIVE_TEST=PASS__ABORTED_BEFORE_DEBUGSERVER_CREATE_WITH_ALL_CONFIRMATIONS_FALSE
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
| W2 | PASS | Continuous-PFM mismatch characterized; live-takeover exact 1/2/3/5C REAL ladder PASS, no TZ/fault |
| W3 | PASS | `W3_10V_60S_SUSTAINED_PASS` on protected-Burst redesign, exact V8 SHA; PWM0/OST1 terminal |
| W4 | IN PROGRESS | V10 safe 60 s hold but no in-window operator step; CR15 now present; V11 acknowledgement window underway |
| W5 | NOT STARTED (PREFLIGHT READY) | calibrated immutable ladder/protection migration designed; no W5 firmware or real PASS claim |
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
- Every W2 duration must independently prove nonzero compute/apply, advancing
  ADC publication/consumption, 145..170 kHz commands and TBPRD 352..413.

## W2_OPEN_LOOP_STEADY checkpoint (2026-09-02)

Authoritative report: `docs/W2_OPEN_LOOP_STEADY_PLANT_CHARACTERIZATION_REPORT.md`.

```text
TASK=W2_OPEN_LOOP_STEADY_PLANT_CHARACTERIZATION_V1 (operator approved)
CANDIDATE4=CLOSED (4 same-SHA real failures, W2_REAL_ATTEMPT_COUNT=7)
FIRMWARE=STAGE6_OPEN_LOOP_STEADY_BUILD frozen (PI bypassed, envelope 145..170k compile-time)
REAL_OUT_SHA256=c524f10c7d65ee99f660b147c100f84fcdfc85442e4d48d411e8b1381c45aeab
NE_OUT_SHA256=4d96f1da455386f4115205b961adb55f283229725e1e6d908179aa5170ac0f99
NE_PROOF=SOL_W2_OPEN_LOOP_STEADY_NOENERGY_PASS=TRUE (95 checks TRUE / 0 FALSE)
TINT0_BUDGET=interval_max=1233c(20.6us) whole_ISR_max=1062c(17.7us) PASS
SLOWTASK_5A_WINDOW=145..170k under STAGE6_OPEN_LOOP_STEADY_BUILD (legacy window kept for all other builds)
REAL_MATRIX=ARMED_NOT_FIRED (SHA+env hard gates; descending 170k->150k; warning=upper-gain-boundary; fault=no-retry)
NEXT_GATE=operator physical authorization (CR15 15ohm, Vin 24V, 0.5A input limit, CNT3/4 connected)
HANDOFF_MODS=PAUSED (SoftStart->PI candidate work suspended during the experiment)
```

- Every OPEN_LOOP_STEADY run (NE or REAL) ends PWM=0/OST=1/TZINT=0; verified
  after every scenario/point; any fault stops the matrix with NO retry.
- The REAL matrix script refuses to touch the target unless all six human
  gates are 1 and the frozen REAL OUT SHA256 matches.

## W2 entry redesign checkpoint (2026-09-02 late, post 7fcdb71)

REAL attempts #1-#3 proved the abrupt 170 kHz cold start trips COMP/TZ1 load-independently
(sections 7-8 of the W2 report). Redesign chosen by the operator: ① SoftStart charge -> OL
takeover (borrowing the FORMAL engine, soft_start.c untouched).

```text
DESIGN=W2_OL_SOFTSTART_TAKEOVER_ENTRY_V1
SM_5A_ENABLE=arms takeover + SoftStart_Begin() (sys stays IDLE; Update5ms sets SOFT_START)
TAKEOVER=PHASE_B stage 10 (period 339 ~ 176.47 kHz, DB=36) -> park engine (ABORTED, no SS_End),
         restore OL ADC cadence + ADCINT1, OL_SessionInit(actual period freq), sys=RUN
SLEW_CLAMP=every slew output clamped onto 145..170k (first post-takeover write = 170000 exactly)
FALLBACK=stage >= 12 or FINAL reached without takeover -> planned stop OL_STOP_TAKEOVER_MISSED(6)
PROT_WINDOW=sys==SOFT_START allows trajectory band up to 250k; sys==RUN back to frozen 145..170k
REAL_OUT_SHA256_V2=32b9ecb761069ca8fe47b3d31bb301055eea9e5535a334a2caa3f991aa8c48d8
NE_OUT_SHA256_V2=e11c3d72f92243d3ecd5c6a79b11ae763a42f8c1cbeac192e55d0020c6ef91b5
NE_PROOF_R5=SOL_W2_OPEN_LOOP_STEADY_NOENERGY_PASS=TRUE (all TRUE incl. S10 takeover scenario)
MATRIX=point sessions (charge-up per point), CSV v2 open_loop_matrix_real_v2.csv (+Takeover_Hz)
AUTHORITY=standing real-fire power authority granted by operator (CR15 ON, Vin 24V bench state)
EXPECTED=WARNING boundary (upper gain) between 170k and ~163k; boundary row = CR15 map top edge
```

- soft_start.c remains byte-identical to 6a54807. The takeover only parks the engine state
  variable and restores the OL cadence; every guard (WARNING 1304 / HARD 1367 / OCP / fallback)
  is live from the takeover tick on.

## W2 CR15 result checkpoint (2026-09-02 night, post 273fc32)

```text
DESIGN=W2_OL_SOFTSTART_TAKEOVER_ENTRY_V1 (v2.1, pwm.c trajectory band, soft_start.c untouched)
REAL_OUT_SHA256=cefb5eac9c584fa9d0498dedf6c761b54a25239dc861bf7c93257c5cc9df8ec4
NE_OUT_SHA256=4da6ddf9e65253eb3f833528ee36a51efd97fd96eaf8c4d2b154dc761f5c6874
NE_PROOF_R6=SOL_W2_OPEN_LOOP_STEADY_NOENERGY_PASS=TRUE (0 FALSE, S10 takeover scenario)
REAL_MATRIX=SOL_W2_OPEN_LOOP_MATRIX_PASS=TRUE (matrix_real_console_r6_v21.log)
POINT1_170K=charge-up 275cyc/239/120 -> takeover 176470Hz@727raw(5.83V) -> clamp 170000
           (TBPRD352, actual 169971) -> WARNING stop reason=2 ub=1 fault=0x0 PWM0/OST1/TZINT0
CONCLUSION=natural Vout(170kHz,CR15)>=10.49V; whole 145..170k band above the WARNING line;
           CR15 in-band map unmeasurable under frozen guards (boundary row = top-edge deliverable)
NEXT_DECISION=operator: (a) envelope extension 170..190k at CR15, or (b) phase2 load variation
           (30/45 ohm). Both inside frozen guards; no guard changes.
```

## W2 extended-band checkpoint (W2_OPEN_LOOP_EXTENDED_BAND_170_190K_V1)

```text
DESIGN=190k characterization band, flag-gated (g_open_loop_char_ext_authorized)
        production envelope FROZEN (PI/Burst 145..170k untouched)
REAL_OUT_SHA256=61636d058972c40b20801bea7a4333e239386ef8429712370de090a509f7d857
NE_OUT_SHA256=354c7499ab41e4afc8a09e9a0e99ec72a812cde7c4e30aa5a23586f11851d14e
NE_PROOF_R8=SOL_W2_OPEN_LOOP_STEADY_NOENERGY_PASS=TRUE (0 FALSE; S11 a/b/c/d)
AUDIT=TBPRD315/CMPA158/CMPB79/DB36; RuntimeValuesValid off the OL cmd path;
      CMPB=(p+1)/4 period-generic; ET_3RD 63.5kS/s -> OVF gate; protection
      window = char max (plant backstop) while command path stays flag-gated;
      static asserts added; realtime = S8 budget + OVF delta gate
MATRIX_V3=points 190k..170k DESC; tiers 100ms/600ms/2.6s/7.6s/10s cumulative
        (inside the frozen 12s backstop); per-point short-window confirm;
        dVout/dt + ovf_delta telemetry; WARNING boundary closes the descent
CR15_PRIOR=natural Vout(170kHz)>=10.49V -> descending start at 190k is the
        lowest-gain point; WARNING risk rises as the staircase descends
NEXT=fire matrix v3 (standing authority); criterion OPEN_LOOP_10V_STEADY_POINT_FOUND
```

## W2 extended-band RESULT checkpoint (CR15 band closed at 190k)

```text
RESULT=natural Vout(f, CR15, Vin24) > 10.49V WARNING guard for ALL f in 145..190k
        (r7 slew500 + r8 slew5000 both crossed; r8 excludes the slew-transient
        hypothesis -> the gain curve itself is above the guard; flat curve)
REAL_V2_2_FIRES=r7 + r8 (both fault-free planned stops, TBPRD 315, actual 189873,
        OVF delta 0, COMP/TZ 0) - the extended-band plant-map build is PROVEN
        fault-free end-to-end; the map is closed by physics, not by defects
OPEN_LOOP_10V_STEADY_POINT_FOUND=NOT_FOUND (CR15/24V, authorized band)
NEXT_DECISION=user: (1) phase2 load variation 30/45 ohm (heavier load lowers gain),
        (2) lower Vin bench, (3) accept boundary-chain evidence and move on
KNOWN_LIMIT=g_adc_ipri_raw reads 0 in the OL sampling set (IPRI columns
        unpopulated; Vout map unaffected; fix belongs to the load-variation phase)
PRODUCTION=PI/Burst 145..170k envelope FROZEN and untouched (per work order)
```

## LOAD_BOUNDARY checkpoint (W2_OPEN_LOOP_LOAD_BOUNDARY_CHARACTERIZATION_V1)

```text
BASELINE=32368b7 (CR15 closed: natural Vout(f,CR15,24V) > 10.49V for f in 145..190k)
PHASE1_IPRI_AUDIT=software path COMPLETE + unconditional (SOC1 ADCINA2/SOCA ->
        RESULT1 -> ISR -> g_adc_ipri_raw, no build conditional, single writer);
        chain proven live on bench (trip-era ipri_raw=3); OL reads exactly 0 =>
        analog-node-level fact; IPRI_TELEMETRY_DEFERRED (no redundant software
        path; protects SOC/ISR timing); Comparator/TZ OCP untouched + armed
NEXT=matrix v4 (load-boundary protocol) then READY_FOR_CR12P5 (user swaps load)
```

## LOAD_BOUNDARY CR12.5 checkpoint

```text
CR12P5=NOT_FOUND (CONTINUOUS_PFM_RANGE_TOO_HIGH_GAIN at 190 kHz, escape-proven:
        r1 slew500 ambiguous, r2 slew5000 crossed => natural(190k,CR12.5)>10.49V)
PROTOCOL=v4.1 (c578ef8): slew 5000 all points; coarse hold 5s (operator OK);
        candidate 10s; tau~0.4ms measured from the CR15 charge crossing
CSV=open_loop_load_boundary_matrix.csv (2 rows, both fault-free)
NEXT=READY_FOR_CR10 (10 W @ 10 V; PSU input ~0.49 A vs the 0.5 A limit -
        operator decides: raise the limit or accept limit-clamp as a stop)
```

## LOAD_BOUNDARY CR10 checkpoint

```text
CR10=NOT_FOUND (CONTINUOUS_PFM_RANGE_TOO_HIGH_GAIN at 190 kHz, escape-proven, fault-free)
GAIN_SHAPE=fr_eff~160-175k (M rises 150k->170k, flat to 190k); M_eff(190k)~1.09-1.10
        for CR15/CR12.5/CR10; Vout=9.6*M_eff (Np5T:Ns4T, 24V); 10V needs M_eff=1.042
        -> above 190k on the falling side for these loads
PREDICTION=CR7.5 (Q~2x CR15) may open the in-band map at 190k per FHA
NEXT=READY_FOR_CR7P5 (13.3 W @ 10 V; PSU limit >=0.8 A required; resistor >=20 W)
```

## LOAD_BOUNDARY FINAL checkpoint (W2_OPEN_LOOP_LOAD_BOUNDARY_CHARACTERIZATION_V1)

```text
LADDER=CR15 NOT_FOUND / CR12.5 NOT_FOUND / CR10 NOT_FOUND / CR7.5 NOT_FOUND
        (all: natural Vout(190k)>10.49V, escape-proven, fault-free, 0 OVF, 0 COMP/TZ)
FINAL_CLASSIFICATION=CONTINUOUS_PFM_PLANT_RANGE_MISMATCH
STATUS=LOAD_BOUNDARY_CHARACTERIZATION_PASS (characterization complete; the
        mismatch is the finding)
TANK_AUDIT=fr_eff~160-175k; M_eff(190k)~1.09-1.10 LOAD-INSENSITIVE (FHA
        overestimates the Q effect); FHA +4-9% gap ~= rectifier drop;
        Lr/Lm need a user-side LCR/ring-down measurement; 5T:4T ratio and
        the actual Fs chain proven correct
DELIVERABLES=map empty in-band (CR7.5..CR15 x 145..190k x 24V); Burst owns the
        whole region; production Fmax KEEP 170k; Burst entry by Vout>=~9.5-9.8V;
        W2 handoff = plant-region mismatch (not tuning); takeover should route
        to Burst directly at these loads
NEXT=await operator confirmation -> W2_CONTROL_REGION_REDESIGN_V1
        (NO automatic PI/Burst/envelope changes in this work order)
```

## CONTROL_REGION_REDESIGN checkpoint (W2_CONTROL_REGION_REDESIGN_V1)

```text
STATUS=CONTROL_REGION_REDESIGN_READY_FOR_BURST_CHARACTERIZATION
PHASE1=design + host/NE model + NE verification ONLY (no real Burst fired)
NE_MODEL=app/burst_region.{c,h} (NE build list only; ol_ram placement;
        states IDLE/RUN_PFM/BURST_PREP/BURST_ON/BURST_OFF/FAULT; Vref generic;
        entry = Fmax saturation + Vout>Vref+hyst + N fresh + min dwell;
        packets-only v1 at a fixed safe frequency; fault passthrough)
NE_PROOF=burst_region_ne_r5.log 21 PASS / 0 FALSE
OL_REGRESSION=ne_harness_console9.log PASS=TRUE, 0 FALSE
NE_SHA=4A2215CEDEE09F405FD51BCAD6DDC9AFC19E5655B9F74F37E1EFC77C300753BC (frozen)
REAL=semantic delta zero (all additions #if NE-gated); incident recorded in
        the SHA manifest: the v2.2 .out instance was overwritten during a
        rebuild verification; TI COFF embeds a link timestamp so .out
        instances are not byte-reproducible; the on-disk REAL .out is an
        UNAUDITED rebuild instance -> NO real firing until the next real
        work order re-freezes + full proof chain
PHYSICS=corrections executed (report sections 15-17): fr~49.9kHz stands;
        M_eff(190k)>1.093 lower bounds only; 10V point above the 190k ceiling
        if it exists; Burst scope Vin24/Vref10/CR7.5-CR15 only; rectifier-gap
        explanation retracted; 12V plan DESIGN-ONLY (frozen guards are BELOW
        a 12V target -> needs an explicit guard requalification first)
NEXT=W2_BURST_PACKET_CHARACTERIZATION_V1 (operator approval required):
        fresh REAL freeze + full proof chain, then 1/2/3/5-cycle packet ladder
```

## BURST_PACKET_CHARACTERIZATION checkpoint (W2_BURST_PACKET_CHARACTERIZATION_V1)

```text
STATUS=BURST_PACKET_CHARACTERIZATION_BLOCKED
REAL_1C_RESULT=COMP_TZ1_ABORT_BEFORE_CYCLE
SCOPE=answer only how much energy an exact 170kHz/DB36/50% packet injects;
      NOT Burst closed-loop; no auto Burst->RUN; IPRI deferred
NE_PROOF=burst_packet_ne_r4.log BURST_PACKET_NE_VERIFICATION_PASS=TRUE;
         burst_packet_ol_regression_r4.log S10B stop-on-takeover PASS
NE_EXACT=1C/2C/3C/5C completed==N, result PASS; 0C/6C reject; fault-before reject;
        no-request no-fire; mid-packet fault abort; PWM0/OST1/TZINT0/FAULT0
NE_PARAMS=TBPRD=352 CMPA=176 CMPB=88(OL cadence) DBRED/FED=36 actual~169971Hz
FROZEN=production Fmax/DB36/SoftStart/COMP authority unchanged; 190k not used
STOP_ON_TAKEOVER=g_open_loop_stop_on_takeover=1 latches planned stop at the
        takeover instant (~176.47kHz/5.83V) BEFORE any in-band slew, so the
        1C packet is not glued to SoftStart tail
REGRESSION=SOL_W2_OPEN_LOOP_STEADY_NOENERGY_PASS=TRUE; BURST_REGION 21/0
REAL_SOURCE_COMMIT=6be22a2
REAL_FREEZE_COMMIT=6be22a2
REAL_SHA256=ef607cce24b8399632538e40e9b93c44586f1c0d2140e496c1010c38a9db961d
REAL_HEX_SHA256=d1e25b217a1085afa9414c39535ef5b4e70c5f2147918835ae0017cfbf7ac914
REAL_CGT=25.11.1.LTS
REAL_BUILD_LOG=evidence/sol_master_execution/w2_open_loop_steady/build_real_packet_v2.5_stop_on_takeover.log
REAL_MAP=evidence/sol_master_execution/w2_open_loop_steady/LLC_100W_F28034_OPEN_LOOP_STEADY_REAL_v2.5_stop_on_takeover.map
NE_SHA256=39f79c14d464254323c2d1e1269425be140e5e752f8d38fbc7b03db7bc64a7fe
NE_HEX_SHA256=3bc6ba07637f5ccc53d961982a6b17f772473b8b1e2e6ee0feb063cd77433384
PROTOCOL=docs/W2_BURST_PACKET_CHARACTERIZATION_V1_PROTOCOL.md
REAL_1C_LOG=evidence/sol_master_execution/w2_open_loop_steady/burst_packet_real_1c_v25.log
REAL_1C_OBS=precharge/takeover auto-stop PASS (takeover_raw=718, freq=176470,
        stop_reason=1); host Vout_before_raw read 557 (4.44V) after coast
        delay; packet request 1C -> multi_result=2 (abort), completed=0,
        fault=0x10 FAULT_COMP_TZ1, TZINT=1, final PWM=0/OST=1
REAL_1C_ACTION=IMMEDIATE_STOP_LADDER; no retry; no 2C/3C/5C (per work order)
REAL_1C_ROOT_CAUSE_HYPOTHESIS=abrupt 170kHz single-pulse packet after coast
        trips COMP/TZ1 before any completed cycle (consistent with earlier
        abrupt cold-start COMP/TZ1 evidence); no guard relaxed
FINAL_STATUS=BURST_PACKET_CHARACTERIZATION_BLOCKED
```

## BURST LIVE-TAKEOVER packet candidate (W2_BURST_LIVE_TAKEOVER_PACKET_V1)

```text
STATUS=REAL_1C_2C_3C_PASS__REAL_5C_PENDING
ROOT_CAUSE_CHANGE=remove the failed coast->cold 170kHz restart; retain the
        fault-free formal SoftStart trajectory continuously through takeover
LIVE_PATH=formal PHASE_B stage10 at TBPRD339 (~176470Hz), DB36 -> park
        SoftStart without OST -> OL actuator commits TBPRD352 (~169971Hz) ->
        discard first transition zero boundary -> count exactly N full 170kHz
        periods -> planned OST
AUTHORIZED_PACKET_CYCLES=1,2,3,5 only; all other values consumed+rejected
PROTECTION=unchanged Comparator/TZ1 authority; WARNING raw1304; HARD raw1367;
        production 145..170kHz envelope and DB36 unchanged; no PI path
COLD_START_PATH=not used by the new candidate; historical MULTICYCLE path retained
STATIC_PROOF=SOL_W2_LIVE_TAKEOVER_PACKET_STATIC_PASS=TRUE (11/11)
NE_PROOF=SOL_W2_LIVE_TAKEOVER_PACKET_NOENERGY_PASS=TRUE;
        exact 1C/2C/3C/5C; 4C reject; injected first-boundary fault completes 0C;
        every terminal state PWM0/OST1/TZINT0
NE_FIXTURE_NOTE=the NE Group-1 20us synthetic harness can starve lower-priority
        Group-3; NE therefore invokes the identical packet boundary handler once
        per synthetic tick with INTEN=0. REAL compiles this branch out and remains
        exclusively ePWM CTR_ZERO interrupt driven.
REGRESSIONS=OPEN_LOOP_STEADY PASS; BURST_REGION 21/0 PASS; historical cold
        BURST_PACKET exact-cycle harness PASS; handoff-brake host test PASS
LEGACY_SUITE=tools/test_static.py retains 5 pre-existing stale assumptions
        (launch name, CAN/SCI text, generic fresh OUT, PFM literal); historical
        candidate2/preflight scripts target retired source strings and are not
        acceptance gates for this candidate
REAL_POLICY=fresh source commit + clean REAL build + exact SHA hard gate;
        first fire is 1C only, no host second fire, no same-SHA retry after fault
SOURCE_COMMIT=9fbd6bb67cc5e2475c3cb8912ba94c14215ece39
REAL_BUILD=PASS__CGT25.11.1.LTS__COFF__STAGE6_OPEN_LOOP_STEADY_BUILD_ONLY
REAL_OUT_SHA256=E594FF48D49450A1DE4F8D76F653E396CD588F44D5226F2AA50C2A04A8063C30
REAL_MAP_SHA256=AD8008AA1B4F0C5D23B79409A6F48D14504D95B01D70F1DD471D2186DDEA141D
NE_OUT_SHA256=05DABD9E66A4DE51D178466B5F2EE5076A5847F9920B6ED0CED8DC39D6DEDCFC
REAL_HARNESS=tools/sol_w2_live_takeover_packet_real_1c.js (hardcoded exact SHA;
        one uninterrupted 10ms target run; one enable edge; no host second fire)
OPERATOR_STATE=2026-09-04 user confirms Vin=24V and electronic load=15ohm active
REAL_1C=PASS__one enable edge__takeover176470Hz/raw784(6.28V)__transition
        TBPRD352/actual169971Hz__completed1__resultPASS__stop_reason7__
        packet raw before/after/peak832(6.67V)__hw_trip_delta0__active_trip_delta0__
        final PWM0/OST1/TZINT0/fault0
REAL_1C_SHA_GATE=PASS__E594FF48D49450A1DE4F8D76F653E396CD588F44D5226F2AA50C2A04A8063C30
REAL_2C=PASS__takeover_raw785(6.29V)__completed2__peak843(6.76V)__hw_trip_delta0__final safe
REAL_3C=PASS__takeover_raw1181(9.49V)__completed3__peak1235(9.93V)__hw_trip_delta0__final safe
REAL_5C_FIRST_OBSERVATION=NOT_FIRED__enable rising consumed but takeover_done0;
        telemetry remained the immutable 3C snapshot (completed3/resultPASS);
        fault0/hw_trip_delta0; script stopped and cleanup proved PWM0/OST1/TZINT0
REAL_5C_NONFIRE_CAUSE=host observation window 10ms ended before the 5ms slow-task
        phase launched/completed formal trajectory; not a packet or protection failure
RESUME_POLICY=harness-only timing correction, firmware OUT/SHA/protection unchanged;
        fresh program load + CR15 PWM-off dwell; fire uncompleted 5C only; 50ms bounded wait
REAL_5C_RESUME=PASS__fresh load + 50ms bounded observation__takeover_raw796
        (6.38V)__completed5__peak870(6.97V)__fault0__hw_trip_delta0__
        active_trip_delta0__final PWM0/OST1/TZINT0
W2_FINAL=PASS__CONTINUOUS_PFM_PLANT_RANGE_MISMATCH_ACCEPTED__CONTROL_REGION_REDIRECT_TO_BURST__
        LIVE_TAKEOVER_PACKET_REAL_1C_2C_3C_5C_ALL_PASS
NEXT=W3_10V_BURST_HOLD_INTEGRATION
```

## W3 10 V Burst hold candidate (W3_10V_BURST_HOLD_V1)

```text
STATUS=PASS__W3_10V_60S_SUSTAINED_PASS__PROTECTED_BURST_REDESIGN
SOURCE_COMMIT=a29d60a578c6fb59bf7f1116d3a519cbe73cfe2b
CONTROL=firmware-selected W3 CALHOLD profile; legacy 11V calibration unchanged
INITIAL_CHARGE=accelerated Profile C target raw1200; exact TBPRD239/DB110 start;
        Phase A DB110->36 at 250kHz; Phase B TBPRD239->399 at DB36
INITIAL_CHARGE_FIX=accelerated request skips generic LLC_SetFrequencyHz path;
        ADC sample point and actual prepared start now both use TBPRD239
PRIVATE_AUTH=per-write private latch; active Profile C + Stage4/5A + IDLE +
        loopback verified + no public enable/fault; revoked after every write/exit
HOLD_BAND=low1220 target1260 hard1300 diagnostic-low1000
PACKET=250kHz/TBPRD239/DB110; 1..15 cycles; >=40us off dwell
DURATIONS_MS=500,2000,10000,60000 only
TOTAL_CYCLE_CAPS=20000,50000,250000,1500000
PROTECTION_UNCHANGED=Comparator/TZ1 authority; OL warning1304/hard1367;
        production145..170kHz command envelope; production DB36
STATIC=SOL_W3_10V_BURST_HOLD_STATIC_PASS=TRUE (17/17)
NE=SOL_W3_10V_BURST_HOLD_NOENERGY_PASS=TRUE
NE_ACCEL=exact239/110 prepare authorized while OST latched; zero PWM release
NE_W3=invalid duration reject; mode latch; deadband/no-packet; low recharge;
        bounded packet; hard1300 abort; duration complete; aggregate-cap abort;
        injected fault abort; every terminal state PWM0/OST1/TZINT0
NE_OUT_SHA256=E8A08E4440775D03F6A46DEBFC3CF16564CCBC346EB557257E91C4BBD8CA1370
NE_MAP_SHA256=905991CCF687CBEEB75650F10627722E44095D839344084D95601997E72A185E
REGRESSIONS=W2_OPEN_LOOP PASS; W2_LIVE_PACKET PASS; W2_COLD_PACKET PASS;
        W2_BURST_REGION 21/0 PASS
PROTOCOL=docs/W3_10V_BURST_HOLD_V1_PROTOCOL.md
EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/offline_qualification_v1.txt
REAL_POLICY=clean REAL build + hardcoded exact SHA; one 500ms request; no
        public enable edge; firmware-timed end; no same-SHA retry after failure
REAL_BUILD=PASS__CGT25.11.1.LTS__COFF__STAGE6_OPEN_LOOP_STEADY_BUILD_ONLY
REAL_OUT_SHA256=B81DCB715BA8350E66B3C3114B1E9B5AF2D38C2AB7E38AB8473117B07B0496D2
REAL_MAP_SHA256=61BC854853A320E6EDFC59FE10D3CBB86A88F4FBBC4B4FA24270EC1BA6F6E658
REAL_500MS_HARNESS=tools/sol_w3_10v_burst_hold_real_500ms.js (historical path at fire commit 8151cec)
REAL_FORWARD_HARNESS=tools/sol_w3_10v_burst_hold_real_ladder.js
REAL_500MS_V1=NOT_FIRED__combined CALHOLD boot check reported FAIL before
        loopback/stage/request; cleanup PWM0/OST1/TZINT0; no power request
BOOT_DIAG_AFTER_V1=3/3 cold loads state0/mode_req0/mode_active0/request0/
        measure_req0/sysIDLE/stage0/PWM0/OST1/TZINT0/fault0
RESUME_POLICY=harness-only boot observation correction; capture all boot values
        once, print snapshot, use separate state/mode gates; same OUT/SHA allowed
        because g_cal_hold_request was never written and PWM was never released
W3_REAL_POWER_ATTEMPT_COUNT=18
REAL_500MS_RESUME=PASS__stateCOMPLETE/reasonCOMPLETE__elapsed25000ticks__
        initial target1200 stop1209 max1209 phase4 TBPRD399 DB36__hold min1166
        max1235 steady1200..1235 avg1224 calavg1225/n7103__packets292__
        total4674__packetmin15/max15__hardevents0__fault0__hwtripdelta0__
        activetripdelta0__enableedgedelta0__final PWM0/OST1/TZINT0
REAL_500MS_EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/real_500ms_resume_v2.txt
REAL_2S_V1=FAIL__same SHA B81DCB71__stateABORT/reasonACTIVE_TZ__elapsed19ticks__
        fault0x50(COMP_TZ1+ADC_OVERFLOW_COMPANION)__initial target1200 stop1200__
        first cold packet tripped before packet cycle1__hwtripdelta1__activetripdelta1__
        final cleanup PWM0/OST1/TZINT0__NO_SAME_SHA_RETRY
REAL_2S_V1_TRIP_SNAPSHOT=COMP_DAC300__TBCTR27__trip_vout_raw1175__
        GPIO15/COMPSTS high when ISR serviced__TZFLG5__power-window ACTIVE
REAL_2S_V1_EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/real_2s_v1.txt
V2_ROOT_CAUSE=CALHOLD cold packet directly rewrote comparator/DAC then cleared OST
        without the already-proven 2us settle + prestart GPIO15 safe gate
V2_CHANGE=every cold packet reuses COMP_ArmForSingleCycleStart(DAC300); requires
        prestart_reject0/armed1/prestart+live GPIO15 high/private write auth;
        any rejection aborts safe with reason8; stats reset published immediately
V2_UNCHANGED=no comparator/TZ/DAC threshold, frequency, DB, VOUT threshold,
        packet max15, production envelope, or protection authority relaxed
V2_SOURCE_COMMIT=80af931829393e2a6d7aaf035efc2d764a423d4d
V2_STATIC=SOL_W3_10V_BURST_HOLD_STATIC_PASS=TRUE (20/20)
V2_NE=SOL_W3_10V_BURST_HOLD_NOENERGY_PASS=TRUE__prestart-auth reject reason8__
        legacy packet retained__all terminal PWM0/OST1/TZINT0
V2_NE_OUT_SHA256=5C657AD56354BF952D5AE1AA0C35DA8FD7C8597E5E993CAADAEF82B90AC27219
V2_NE_MAP_SHA256=E45141EFC7244D3429165C84A3C5627C85C73224696CD6B644FCA11927F93196
V2_REGRESSIONS=W2_OPEN_LOOP PASS__W2_LIVE_PACKET PASS__W2_COLD_PACKET PASS__BURST_REGION21/0
V2_REAL_BUILD=PASS__CGT25.11.1.LTS__COFF__STAGE6_OPEN_LOOP_STEADY_BUILD_ONLY
V2_REAL_OUT_SHA256=CE206609D9469EBCEDADE7A56B81FD093422FEE641337439FEA7F4BC839C9F6F
V2_REAL_MAP_SHA256=F80992C3DA4D5599EFF6244469F55A14B7B30DD73E50109E156510062DA4BA43
V2_REAL_2S=FAIL__POWER_REQUEST_FIRED__initial accelerated Profile-C charge tripped
        in Phase-A before hold__fault0x10 COMP_TZ1__trip TBCTR193/VOUTraw8/DAC300__
        prestart GPIO15 high/reject0__hardware+active trip delta1__public enable edge0__
        host cleanup PWM0/OST1/TZINT0__NO_SAME_SHA_RETRY
V2_REAL_2S_EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/real_v2_2s_v1.txt
V2_DISPOSITION=RETIRED__comparator-settle correction did not remove a real cold-start
        primary-current event; no protection threshold/qualification/blanking relaxation
ZERO_OUTPUT_ROOT_CAUSE=historical 200kHz/DB140 is FAILED/DO_NOT_RETRY; tutorial direct
        PWM start plus automatic OCP hiccup is reference-only and violates current no-auto-retry
        gate; next candidate must bound or reshape zero-output initial energy with new source/SHA
NEXT=offline root-cause + no-energy qualification of a new zero-output initial-charge candidate;
        only then one new real gate, followed by 2s->10s->60s on PASS
V3_ROOT_CAUSE=prepare-time TBCTR drift plus AQCSFRC shadow-at-ZRO and undefined
        AQ-A state made the actual first post-OST edge phase-dependent
V3_CHANGE=AQCSFRC immediate; prepared phase encoded in existing token; release
        override and readback while OST latched; actual critical section AQ-A SET ->
        TBCTR phase -> OTSFA -> TZCLR.OST; NE mirror never clears OST
V3_UNCHANGED=no comparator/TZ/DAC threshold, GPIO qualification, frequency,
        dead-time, W3 voltage thresholds, cycle caps, or protection authority changed
V3_SOURCE_COMMIT=fc4f9ae3fdc2fc58c846834d99d993f45eeee735
V3_STATIC=SOL_W3_10V_BURST_HOLD_STATIC_PASS=TRUE__23_OF_23
V3_NE=SOL_W3_10V_BURST_HOLD_NOENERGY_PASS=TRUE__exact239_110__seed_mirror__no_release
V3_NE_OUT_SHA256=92F9955DF3587A3264CE4857A108042801F93C051F64D385886AF6C84F5DD8B3
V3_NE_MAP_SHA256=97782AE375F0BB0196028D6A701291ABCEE009487F7086ABF6850096EA9E0291
V3_REAL_OUT_SHA256=998A0A63EA6DFF930AC2B94C15CEE7D75D59B7501F383FA4BC1FE81D9B9BF102
V3_REAL_MAP_SHA256=9A701B16734A472F48573CB6CE4F17947155CB9A975F24390427C1ABC8841F62
V3_MEMORY=NE_EBSS_0x3FF_OF_0x400__REAL_EBSS_0x3A4_OF_0x400
V3_REAL_ASSEMBLY=AQ_SET_3E9D8C__TBCTR_3E9D8D__OTSFA_3E9D8F__OST_CLEAR_3E9D94
V3_REGRESSIONS=W2_OPEN_LOOP_PASS__W2_LIVE_PACKET_EXACT1_2_3_5_PASS__BURST_REGION21_0_PASS
V3_COLD_PACKET_NE_EXCLUSION=NOT_RUN_WITH_VIN_CONNECTED__fixture_disconnects_OSHT1_AND_RELEASES_PWM__NOT_A_FAILURE
V3_EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/offline_qualification_v3_deterministic_start.txt
V3_QUALIFICATION=PASS__ONE_REAL_2S_FIRE_AUTHORIZED_ON_EXACT_NEW_SHA
V3_REAL_2S=FAIL_SAFE__stateABORT_reasonUNDERSUPPLIED__elapsed34438ticks_688.76ms__
        initial_charge_target1200_stop1205_cycles419_no_hwtrip__hold_final999_min1009_
        max1240_avg1211__packets2126_all15cycles_total32235__fault0__hwtripdelta0__
        activetripdelta0__publicenable0__final_cleanup_PWM0_OST1_TZINT0
V3_INTERPRETATION=DETERMINISTIC_FIRST_EDGE_FIX_PROVEN__V2_HARDWARE_TRIP_REMOVED__
        NEW_INDEPENDENT_BLOCKER_IS_INSUFFICIENT_BOUNDED_HOLD_ENERGY_AUTHORITY
V3_REAL_EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/real_v3_2s_v1.txt
V3_DISPOSITION=RETIRED__NO_SAME_SHA_RETRY
V4_ROOT_CAUSE=V3_OBSERVED_ACTIVE_FRACTION_18.72_PERCENT__OLD_DURATION_CAP_10_PERCENT__
        EVERY_PACKET_HIT_15_CYCLE_CEILING__BOUNDED_AUTHORITY_BELOW_LOAD_DEMAND
V4_CHANGE=W3_ONLY_PACKET_MAX64_256US__AGGREGATE_ACTIVE_TIME_CAP50_PERCENT__
        LEGACY_11V_MAX15_UNCHANGED__SAME_250KHZ_DB110_CYCLE
V4_SAFETY=PER_CYCLE_TARGET1260_HARD1300__40US_MIN_OFF__COMPARATOR_TZ_ALWAYS_ACTIVE__
        DETERMINISTIC_START_UNCHANGED__NO_AUTO_RETRY
V4_SOURCE_COMMIT=eeb9f756b92d26a925efbb2874444a5d0393940f
V4_STATIC=SOL_W3_10V_BURST_HOLD_STATIC_PASS=TRUE__24_OF_24
V4_NE=SOL_W3_10V_BURST_HOLD_NOENERGY_PASS=TRUE__W3_MAX64_EXERCISED__LEGACY_LE15__CAP62500_ABORT
V4_NE_OUT_SHA256=EFB4DDAC97B4500A73B073EC3263393194B0899F76F4D203F92BDBD18F532CDA
V4_NE_MAP_SHA256=E57DA26F5CBEBF7043BB3DB5D46E575183EEF213AE2680118465533A6A9847E4
V4_REAL_OUT_SHA256=073290E38DC2DFD4BC06891DF95DB2FBA3D721A16B06B882F28E4913D729F3F7
V4_REAL_MAP_SHA256=A7CD0E328FF4988F841AFA1A27A1366B7FB2159210DF44E3910DA4153F138C79
V4_MEMORY=NE_EBSS_0x3FF_OF_0x400__REAL_EBSS_0x3A4_OF_0x400
V4_REGRESSIONS=W2_OPEN_LOOP_PASS__W2_LIVE_EXACT1_2_3_5_PASS__BURST_REGION21_0_PASS
V4_EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/offline_qualification_v4_energy_authority.txt
V4_QUALIFICATION=PASS__NEW_SHA_REQUALIFY_REAL_500MS_THEN_FORWARD_ONLY
V4_REAL_500MS=PASS__elapsed25000__charge1205_cycles419__hold1166_to1243__
        steady1174_to1243_avg1225__packets525_all64cycles_total34240__
        active_fraction27.392pct__hardevents0__fault0__tripdeltas0__publicenable0__
        final_and_cleanup_PWM0_OST1_TZINT0
V4_REAL_500MS_EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/real_v4_500ms_v1.txt
V4_REAL_2S=FAIL_SAFE__reasonUNDERSUPPLIED__elapsed30550ticks_611ms__finalraw997__
        prior_min1004__steadyavg1221__packets479_all64__total30784__aggregate_cap_not_bound__
        fault0__tripdeltas0__publicenable0__final_and_cleanup_PWM0_OST1_TZINT0
V4_REAL_2S_EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/real_v4_2s_v1.txt
V4_INTERPRETATION=SAME_SHA_500MS_USED_MORE_CYCLES_AND_PASSED__ONE_RAW997_SAMPLE_AFTER_
        PRIOR_MIN1004_AND_AVG1221_TRIGGERED_IMMEDIATE_ABORT__ADC_TRANSITION_TRANSIENT_SUSPECT
V4_DISPOSITION=RETIRED__NO_SAME_SHA_RETRY
V5_CHANGE=W3_ONLY_REQUIRES_3_CONSECUTIVE_BELOW_RAW1000_OFF_SAMPLES__IN_BAND_CLEARS__
        LEGACY_IMMEDIATE_SEMANTICS_UNCHANGED__INITIAL_2MS_GRACE_UNCHANGED
V5_SOURCE_COMMIT=ca793abe0b1df201033478a47950cbb2c998a2aa
V5_STATIC=SOL_W3_10V_BURST_HOLD_STATIC_PASS=TRUE__25_OF_25
V5_NE=PASS__RECOVERY_CLEARS_COUNT__PERSISTENT_LOW_ABORTS_AT3__HARD1300_IMMEDIATE__
        ALL_TERMINAL_PWM0_OST1_TZINT0
V5_NE_OUT_SHA256=1F0AEAAD5D034522E8A48177524DFC9914FAF3071B4A2E5159BEED52D4FAAFEF
V5_NE_MAP_SHA256=12176121C3FFF07DAD144E461F46AAEAD39DF04F12A8796A4B5C05D8A38CF33E
V5_REAL_OUT_SHA256=7123C328ABC5750F0329720678078DE0038C7611B48A80631296F066F3D14D8A
V5_REAL_MAP_SHA256=FFF020965B8D9D555748D8A200FE8A4DF1B67E30D2BA886693BBB06AB9FAFD6D
V5_MEMORY=NE_EBSS0x3FF_OLRAM0xD6__REAL_EBSS0x3A4_OLRAM0x90
V5_REGRESSIONS=W2_OPEN_LOOP_PASS__W2_LIVE_EXACT1_2_3_5_PASS__BURST_REGION21_0_PASS
V5_EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/offline_qualification_v5_undersupply_persistence.txt
V5_QUALIFICATION=PASS__NEW_SHA_REQUALIFY_REAL_500MS_THEN_FORWARD_ONLY
V5_REAL_500MS=PASS__elapsed25000__charge1203_cycles419__hold1166_to1232__
        avg1222__packets354_all64_total22656_active18.1248pct__undersupplyconfirm0__
        hardevents0_fault0_tripdeltas0_publicenable0_final_cleanup_PWM0_OST1_TZINT0
V5_REAL_500MS_EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/real_v5_500ms_v1.txt
V5_REAL_2S=FAIL_SAFE__reasonUNDERSUPPLIED__elapsed39016ticks_780.32ms__
        finalraw993_prior_min1015_avg1221__packets893_all64_total57856__
        active29.6575pct_below50pctcap__confirm3__fault0_tripdeltas0_publicenable0__
        final_cleanup_PWM0_OST1_TZINT0
V5_REAL_2S_EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/real_v5_2s_v1.txt
V5_INTERPRETATION=PERSISTENT_LOW_PROVEN__DO_NOT_FILTER_FURTHER__ALL_PACKETS_HIT64__
        OFF_MAX1241_BELOW_TARGET1260__CONTIGUOUS_PACKET_AUTHORITY_NEXT
V5_DISPOSITION=RETIRED__NO_SAME_SHA_RETRY
V6_CHANGE=W3_ONLY_PACKET_MAX128_512US__SAME_250KHZ_DB110_CYCLE__
        AGGREGATE50PCT_UNCHANGED__LEGACY11V_MAX15_UNCHANGED
V6_TELEMETRY=REUSE_EXISTING_PACKET_START_STOP_POSTMAX_POSTLAST_ACTUALCYCLES__NO_RAM_ADD
V6_SOURCE_COMMIT=c04c1f98576d868bfd325797a0e640ab8c3d23e0
V6_STATIC=SOL_W3_10V_BURST_HOLD_STATIC_PASS=TRUE__26_OF_26
V6_NE=PASS__MAX128_EXERCISED__PACKET_TELEMETRY__RECOVERY_CLEAR__PERSISTENT_LOW_ABORT__
        HARD1300__LEGACY15__ALL_TERMINAL_PWM0_OST1_TZINT0
V6_NE_OUT_SHA256=28994B67EA0F16AAE464123F3F96FCE129A7A5E201573B54044DDF71A578A3F2
V6_NE_MAP_SHA256=6B9A53C730FD3F6DD96D1905FD7CE253DC45DE266BE09A5E6C3A5A1FE5B8E8BE
V6_REAL_OUT_SHA256=BD0CFFCB33FABE522B23AAC49D445A1C65BC7EA17C0C506837EC7E28ECC05CA9
V6_REAL_MAP_SHA256=E096440DBCEC09FFA3D4129668EBF008DF607314EA191EFB97BF544B2C5616CE
V6_MEMORY=UNCHANGED__NE_EBSS0x3FF__REAL_EBSS0x3A4
V6_REGRESSIONS=W2_OPEN_LOOP_PASS__W2_LIVE_EXACT1_2_3_5_PASS__BURST_REGION21_0_PASS
V6_EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/offline_qualification_v6_packet128.txt
V6_QUALIFICATION=PASS__NEW_SHA_REQUALIFY_REAL_500MS_THEN_FORWARD_ONLY
V6_REAL_500MS=PASS__elapsed25000__charge1202_cycles419__hold1164_to1245_avg1227__
        packets32_all128_total4096_active3.2768pct__lastpacket1220_to1230_max1231__
        undersupplyconfirm0_hardevents0_fault0_tripdeltas0_publicenable0__
        final_cleanup_PWM0_OST1_TZINT0
V6_REAL_500MS_EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/real_v6_500ms_v1.txt
V6_REAL_2S=FAIL_SAFE__reasonUNDERSUPPLIED__elapsed22030ticks_440.6ms__
        final995_prior_min1020_avg1228__packets181_all128_total23808__confirm3__
        lastpacket_start992_stop990_postmax997_cycles128__fault0_tripdeltas0_publicenable0__
        final_cleanup_PWM0_OST1_TZINT0
V6_REAL_2S_EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/real_v6_2s_v1.txt
V6_ROOT_CAUSE=FIXED_DB110_AT_TBPRD239_CMPA120_LEAVES_APPROX10_TBCLK_EFFECTIVE_PULSE__
        LAST_PACKET_PROVES_NO_NET_RECHARGE_AT_LOW_RAW__DO_NOT_LENGTHEN_DB110_AGAIN
V6_DISPOSITION=RETIRED__NO_SAME_SHA_RETRY
V7_CHANGE=EACH_PACKET_STARTS_DB110__AFTER_FIRST_CYCLE_RAMP_ONE_COUNT_PER_BOUNDARY_TO_DB90__
        TBPRD239_CMPA120_FIXED__PREFIX_OF_PROVEN_PROFILE_C_PHASE_A
V7_AUTH=PRIVATE_ONE_CALL_ACTIVE_PACKET_GATE__REAL_REQUIRES_PWM1_OST0__NE_PWM0_OST1__
        MODEW3_STATEPACKET_STAGE5A_IDLE_LOOPBACK_GPIO15_FAULT0
V7_SOURCE_COMMIT=1044cd71147f20ef33eccc33ba9aeba5db3e4dcb
V7_STATIC=SOL_W3_10V_BURST_HOLD_STATIC_PASS=TRUE__27_OF_27
V7_NE=PASS__EXACT239_DB110_TO90__MAX128__PERSISTENT_LOW_ABORT__HARD1300__
        LEGACY15__ALL_TERMINAL_PWM0_OST1_TZINT0
V7_NE_OUT_SHA256=335B835FF2D34FAA514CCF74F94FF2B4CC1E71BA0C3DE5FE2AE3C1305DEF1B67
V7_NE_MAP_SHA256=EE17E481F332BA817A6A588D0862B2659FE35D151BDBD1569E86EFEA99148040
V7_REAL_OUT_SHA256=0E9200615F1A6A22E22B1875E339EE5778D1379D1003C71099A561053DB68C28
V7_REAL_MAP_SHA256=E1CACCD870679E015D5A579C07B35043032D40407F5DA47438D178C33FFB52A5
V7_MEMORY=UNCHANGED__NE_EBSS0x3FF_OLRAM0xD6__REAL_EBSS0x3A4_OLRAM0x90
V7_REGRESSIONS=W2_OPEN_LOOP_PASS__W2_LIVE_EXACT1_2_3_5_PASS__BURST_REGION21_0_PASS
V7_EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/offline_qualification_v7_db_ramp.txt
V7_QUALIFICATION=PASS__NEW_SHA_REQUALIFY_REAL_500MS_THEN_FORWARD_ONLY
V7_REAL_500MS=PASS__stateCOMPLETE_reasonCOMPLETE_elapsed25000ticks__
        charge_target1200_stop1203_cycles419_no_hwtrip__hold1170_to1278__
        steady1218_to1278_avg1242_calavg1239_n6650__packets36_total4510__
        packetmin106_max128__last1220_to1248_postmax1249_cycles128_finalDB90__
        hardevents0_undersupplyconfirm0_fault0_tripdeltas0_publicenable0__
        final_cleanup_PWM0_OST1_TZINT0
V7_REAL_500MS_EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/real_v7_500ms_v1.txt
V7_REAL_2S=PASS__stateCOMPLETE_reasonCOMPLETE_elapsed100000ticks__
        charge_target1200_stop1207_cycles419_no_hwtrip__hold1052_to1265__
        steady1052_to1265_avg1230_calavg1228_n14997__packets1113_total142687__
        packetmin96_max128__duration_cut_last1057_to1054_cycles1_finalDB109__
        hardevents0_undersupplyconfirm0_fault0_tripdeltas0_publicenable0__
        final_cleanup_PWM0_OST1_TZINT0
V7_REAL_2S_EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/real_v7_2s_v1.txt
V7_REAL_10S=PASS__stateCOMPLETE_reasonCOMPLETE_elapsed500000ticks__
        charge_target1200_stop1200_cycles417_no_hwtrip__hold1166_to1276__
        steady1217_to1276_avg1240_calavg1240_n243461__packets70_total7611__
        packetmin77_max128__last1219_to1260_postmax1260_cycles107_finalDB90__
        hardevents0_undersupplyconfirm0_fault0_tripdeltas0_publicenable0__
        final_cleanup_PWM0_OST1_TZINT0
V7_REAL_10S_EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/real_v7_10s_v1.txt
V7_REAL_60S=FAIL_SAFE__stateABORT_reasonUNDERSUPPLIED_elapsed124862ticks_2497.24ms__
        charge_target1200_stop1200_cycles417_no_hwtrip__hold997_to1266__
        steady997_to1266_avg1228_calavg1225_n15998__packets1539_total196865__
        lastpacket_start997_stop1001_postmax1005_postlast1001_cycles128_finalDB90__
        hardevents0_undersupplyconfirm3_fault0_tripdeltas0_publicenable0__
        final_cleanup_PWM0_OST1_TZINT0
V7_REAL_60S_EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/real_v7_60s_v1.txt
V7_ROOT_CAUSE=DB90_RAMP_DIRECTION_IS_CORRECT_BUT_LOW_OUTPUT_RECOVERY_MARGIN_IS_ONLY_PLUS4_RAW__
        LAST_PACKET_PEAK1005_DID_NOT_RESTORE_CONTROL_BAND_BEFORE_THREE_LOW_CONFIRMATIONS
V7_DISPOSITION=RETIRED__NO_SAME_SHA_RETRY
V8_CHANGE=EXACT_INITIAL_CHARGE_PHASE_A_CADENCE__DB110_FOR15_CYCLES__THEN_MINUS5_EVERY10__
        MAX128_CYCLES_REACHES_DB50_AFTER_CYCLE125__TBPRD239_CMPA120_FIXED
V8_ENERGY=BOUNDED_PULSE_AUTHORITY_APPROX31_PERCENT_ABOVE_V7_FULL_PACKET__
        STILL_STRICT_PREFIX_OF_REPEATEDLY_PROVEN_PHASE_A_BEFORE_DB36_STAGE
V8_UNCHANGED=PER_CYCLE_TARGET1260_HARD1300__THREE_LOW_CONFIRM__40US_OFF__
        AGGREGATE50PCT__COMPARATOR_TZ_DAC_GPIO15__LEGACY15__NO_AUTO_RETRY
V8_SOURCE_COMMIT=af0f36d416ebaa3e0c55bd1493db328a084c5b01
V8_STATIC=SOL_W3_10V_BURST_HOLD_STATIC_PASS=TRUE__28_OF_28
V8_NE=PASS__EXACT239_DB110_PHASE_A_TO50__MAX128__PERSISTENT_LOW_ABORT__HARD1300__
        LEGACY15__ALL_TERMINAL_PWM0_OST1_TZINT0
V8_NE_OUT_SHA256=8DEE1A7A10F3D128FBE4B52A4891443AB5F87198C349E1F4EF0FDFDCE418E59B
V8_NE_MAP_SHA256=29000C4BEE1425D8A3BA9666C70C3798C9374BB4FA5BAD85283FA6B95E90F6ED
V8_REAL_OUT_SHA256=F972829DA35D4557A93ED2B4B11600672BDC5FB7DFF9B86D48E50CE883EF7BFA
V8_REAL_MAP_SHA256=E14D439E43634782712880B925B72F8E3AC022B9128D6068781F64C70B2B1D6F
V8_MEMORY=UNCHANGED__NE_EBSS0x3FF_OLRAM0xD6__REAL_EBSS0x3A4_OLRAM0x90
V8_REAL_ISR_TEXT_WORDS=0xD8__COMPILED_COMPARE_TREE_CONFIRMS_CYCLES15_25_TO125_AND_DB105_TO50
V8_REGRESSIONS=W2_OPEN_LOOP_PASS__W2_LIVE_EXACT1_2_3_5_PASS__BURST_REGION21_0_PASS
V8_EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/offline_qualification_v8_exact_phase_a.txt
V8_QUALIFICATION=PASS__NEW_SHA_REQUALIFY_REAL_500MS_THEN_FORWARD_ONLY
V8_REAL_500MS=PASS__stateCOMPLETE_reasonCOMPLETE_elapsed25000ticks__
        charge_target1200_stop1207_cycles419_no_hwtrip__hold1169_to1271__
        steady1218_to1271_avg1241_calavg1240_n6938__packets26_total2844__
        packetmin96_max128__last1220_to1261_postmax1261_cycles114_finalDB60__
        hardevents0_undersupplyconfirm0_fault0_tripdeltas0_publicenable0__
        final_cleanup_PWM0_OST1_TZINT0
V8_REAL_500MS_EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/real_v8_500ms_v1.txt
V8_REAL_2S=PASS__stateCOMPLETE_reasonCOMPLETE_elapsed100000ticks__
        charge_target1200_stop1200_cycles417_no_hwtrip__hold1162_to1270__
        steady1215_to1270_avg1238_calavg1239_n27152__packets636_total79805__
        packetmin90_max128__duration_cut_last1218_to1209_postmax1218_cycles95_finalDB65__
        hardevents0_undersupplyconfirm0_fault0_tripdeltas0_publicenable0__
        final_cleanup_PWM0_OST1_TZINT0
V8_REAL_2S_EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/real_v8_2s_v1.txt
V8_REAL_10S=PASS__stateCOMPLETE_reasonCOMPLETE_elapsed500000ticks__
        charge_target1200_stop1205_cycles419_no_hwtrip__hold1167_to1275__
        steady1210_to1275_avg1231_calavg1231_n58482__packets6459_total824371__
        active_fraction32.97484pct__packetmin90_max128__
        duration_cut_last1217_to1194_postmax1217_cycles50_finalDB90__
        hardevents0_undersupplyconfirm0_fault0_tripdeltas0_publicenable0__
        final_cleanup_PWM0_OST1_TZINT0
V8_REAL_10S_EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/real_v8_10s_v1.txt
V8_REAL_60S=PASS__stateCOMPLETE_reasonCOMPLETE_elapsed3000000ticks__
        charge_target1200_stop1204_cycles419_no_hwtrip__hold1167_to1278__
        steady1207_to1278_avg1226_calavg1226_n241340__packets43256_total5534319__
        active_fraction36.89546pct__packetmin96_max128__
        last1217_to1236_postmax1239_cycles128_finalDB50__
        hardevents0_undersupplyconfirm0_fault0_tripdeltas0_publicenable0__
        final_cleanup_PWM0_OST1_TZINT0
V8_REAL_60S_EVIDENCE=evidence/sol_master_execution/w3_10v_burst_hold/real_v8_60s_v1.txt
W3_PASS_TOKEN=W3_10V_60S_SUSTAINED_PASS
W3_PASS_SCOPE=PROTECTED_BURST_CONTROL_REGION_ACCEPTED_AFTER_W2_CONTINUOUS_PFM_PLANT_MISMATCH__
        ON_CHIP_60S_VOUT_AND_SAFETY_GATES_PASS__EXTERNAL_INPUT_POWER_AND_TEMPERATURE_DEFERRED_TO_W9_INSTRUMENT_GATE
NEXT=W4_FREEZE_V8_AS_A_BASELINE__ADD_ON_CHIP_CR15_TO_CR12P5_STEP_TRACE
```

## W4 10 V quality / user-requested CR10 stress insertion

```text
W4_STATUS=IN_PROGRESS__USER_REQUESTED_CR10_60S_BEFORE_PLANNED_CR15_CR12P5_ABA
W4_CONTROL_BASELINE_A=W3_V8_PROTECTED_BURST__REAL_SHA_F972829DA35D4557A93ED2B4B11600672BDC5FB7DFF9B86D48E50CE883EF7BFA
W4_REAL_POWER_ATTEMPT_COUNT=10
W4_CR10_REAL_500MS=PASS__elapsed25000__charge1205_cycles419__hold1168_to1279__
        steady1217_to1279_avg1242_calavg1241_n5442__packets82_total9523__
        active_fraction7.6184pct__packetmin92_max128__last1219_to1262_cycles125_finalDB55__
        hardevents0_undersupply0_fault0_tripdeltas0_publicenable0__final_cleanup_PWM0_OST1_TZINT0
W4_CR10_REAL_500MS_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/real_cr10_v8_500ms_v1.txt
W4_CR10_REAL_2S=PASS__elapsed100000__charge1205_cycles419__hold1169_to1279__
        steady1171_to1279_avg1237_calavg1236_n14576__packets1063_total134853__
        active_fraction26.9706pct__packetmin95_max128__
        duration_cut_last1174_to1145_postmax1174_cycles86_finalDB70__
        hardevents0_undersupply0_fault0_tripdeltas0_publicenable0__final_cleanup_PWM0_OST1_TZINT0
W4_CR10_NOTE=END_RAW1145_IS_DURATION_BOUNDARY_CUT_DURING_PACKET__PRESERVE_FOR_W4_TRANSIENT_QUALITY__
        DOES_NOT_FAIL_AVERAGE_OR_SAFETY_GATE
W4_CR10_REAL_2S_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/real_cr10_v8_2s_v1.txt
W4_CR10_V8_REAL_10S=HOST_W3_GATES_PASS__W4_QUALITY_FAIL_SAFE__elapsed500000__
        charge1200_cycles417__hold1073_to1279__steady1073_to1279_avg1204__
        calavg1197_n25332__packets7587_total970156_active_fraction38.80624pct__
        last1078_to1089_postmax1089_cycles127_finalDB50__hardevents0_undersupply0__
        fault0_tripdeltas0_publicenable0__final_cleanup_PWM0_OST1_TZINT0
W4_CR10_V8_FAIL_REASON=SUSTAINED_OUTPUT_DECLINE__STEADY_MIN1073_AND_FINAL1089_BELOW_
        W4_MINUS5PCT_RAW1182__OLD_W3_AVERAGE_GATE_WAS_NOT_SUFFICIENT_FOR_W4_QUALITY
W4_CR10_V8_REAL_10S_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/real_cr10_v8_10s_v1.txt
W4_CR10_V8_DISPOSITION=RETIRED_FOR_CR10__NO_60S__REMAINS_W3_CR15_ACCEPTED_BASELINE
W4_CR10_V9_CHANGE=EXACT_FULL_INITIAL_CHARGE_PHASE_A__DB110_FOR15__MINUS5_EVERY10__
        CYCLE155_WRITES_DB36__MAX160_640US__NEVER_ENTERS_PERIOD_RAMP
W4_CR10_V9_ENERGY=FULL_PACKET_EFFECTIVE_PULSE_AREA7220_VS_V8_4760__PLUS51P68_PERCENT
W4_CR10_V9_UNCHANGED=AGGREGATE50PCT__TARGET1260_HARD1300__THREE_LOW_CONFIRM__
        40US_OFF__COMPARATOR_TZ_DAC_GPIO15__LEGACY15__NO_AUTO_RETRY
W4_CR10_V9_SOURCE_COMMIT=2e92444330be72d22e55576a58695b008da7dfd4
W4_CR10_V9_STATIC=SOL_W3_10V_BURST_HOLD_STATIC_PASS=TRUE__28_OF_28
W4_CR10_V9_NE=PASS__EXACT239_FULL_PHASE_A_TO36__MAX160__PERSISTENT_LOW__HARD1300__
        LEGACY15__ALL_TERMINAL_PWM0_OST1_TZINT0
W4_CR10_V9_NE_OUT_SHA256=44F94E2B279F7F5A656A0655C4580D5D6AC5E990AD2F9F6967FBE9C98EA8E9A4
W4_CR10_V9_NE_MAP_SHA256=4D500398931B0BAA7555E6357FAE0275FE2BB1D06EBCF18F80DECD41A232A8CF
W4_CR10_V9_REAL_OUT_SHA256=04F5352643FBC82E614EA62C1032038D6CB01C4A18093534ABC2D431B0C9B046
W4_CR10_V9_REAL_MAP_SHA256=F557AA2AF91872DFAF75E7C1DB53FAEA83412670DD6E31A384D068D63715CB75
W4_CR10_V9_MEMORY=UNCHANGED__NE_EBSS0x3FF_OLRAM0xD6__REAL_EBSS0x3A4_OLRAM0x90
W4_CR10_V9_REAL_ISR_TEXT_WORDS=0xE4
W4_CR10_V9_REGRESSIONS=W2_OPEN_LOOP_PASS__W2_LIVE_EXACT1_2_3_5_PASS__BURST_REGION21_0_PASS
W4_CR10_V9_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/offline_v9_full_phase_a.txt
W4_CR10_V9_QUALIFICATION=PASS__NEW_SHA_READY_CR10_REAL_500MS
W4_CR10_V9_REAL_500MS=PASS__elapsed25000__charge1202_cycles417__hold1161_to1262__
        steady1218_to1261_avg1237_calavg1236_n7441__packets6_total573__
        active_fraction0.4584pct__packetmin86_max140__last1219_to1261_cycles86_finalDB70__
        hardevents0_undersupply0_fault0_tripdeltas0_publicenable0__final_cleanup_PWM0_OST1_TZINT0
W4_CR10_V9_REAL_500MS_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/real_cr10_v9_500ms_v1.txt
W4_CR10_V9_REAL_2S=PASS__elapsed100000__charge1201_cycles417__hold1165_to1276__
        steady1214_to1276_avg1239_calavg1239_n22200__packets726_total100837__
        active_fraction20.1674pct__packetmin89_max157__
        duration_cut_last1220_to1194_postmax1220_cycles41_finalDB95__
        hardevents0_undersupply0_fault0_tripdeltas0_publicenable0__final_cleanup_PWM0_OST1_TZINT0
W4_CR10_V9_REAL_2S_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/real_cr10_v9_2s_v1.txt
W4_CR10_V9_REAL_10S=FAIL_SAFE_UNDERSUPPLY__elapsed171208ticks_3P42416S__
        charge1206_cycles419__hold1001_to1277__steady1001_to1277_avg1237__
        calavg1237_n32363__packets1409_total213604_active_fraction24P95255pct__
        last994_to999_postmax999_cycles160_finalDB36__undersupplyconfirm3__
        hardevents0_fault0_tripdeltas0_publicenable0__final_cleanup_PWM0_OST1_TZINT0
W4_CR10_V9_FAIL_REASON=FULL_PHASE_A_PACKET_REACHED_DB36_AND_MAX160_BUT_COULD_NOT_RECOVER__
        THIRD_CONSECUTIVE_RAW_BELOW1000_TRIGGERED_FIRMWARE_UNDERSUPPLY_ABORT__W4_MINUS5PCT1182_FAIL
W4_CR10_V9_REAL_10S_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/real_cr10_v9_10s_v1.txt
W4_CR10_V9_DISPOSITION=RETIRED_FOR_CR10__NO_60S__NO_SAME_SHA_RETRY
W4_CR10_INPUT_LIMIT_HYPOTHESIS=CR10_AT10V_IS10W__VIN24_X_0P5A_IS12W_MAX__
        REQUIRES_GREATER_THAN83P3PCT_CONVERSION_EFFICIENCY_BEFORE_TRANSIENT_MARGIN__
        V9_PLUS51P68PCT_PACKET_ENERGY_STILL_ENDS994_TO999_WITH_NO_TRIP_OR_FAULT__
        WORK_ORDER_W5_SPECIFIES_0P7A_FOR_THE_COMPARABLE_9P6W_STAGE
W4_CR10_DIAGNOSTIC_RULE=SAME_SHA_ALLOWED_ONLY_AFTER_PHYSICAL_INPUT_LIMIT_CHANGES_TO0P7A__
        THIS_IS_NOT_SAME_CONDITION_RETRY__RESTART_LADDER_AT500MS__NO_DIRECT60S
W4_CR10_0P7A_HOST_GATE=READY__SOL_W3_INPUT_LIMIT_A_MUST_EQUAL0P7__
        UNIQUE_RUN_IDS_500MS_0x25090583__2S_84__10S_85__60S_86__
        EXACT_V9_REAL_SHA_REMAINS04F5352643FBC82E614EA62C1032038D6CB01C4A18093534ABC2D431B0C9B046
SOL_MASTER_EXECUTION_PAUSED=FALSE__RESUMED_AFTER_OPERATOR_CONFIRMATION
COMPLETED_THROUGH=W3
LAST_HARD_BLOCKER=CLEARED__VIN24_CURRENT_LIMIT0P7A_CONFIRMED
NEXT_OPERATOR_ACTION=NONE
BOARD_LEFT_SAFE_PWM0_OST1=TRUE__TZINT0
W4_CR10_0P7A_OPERATOR_CONFIRMATION=PASS__USER_REPLIED_THROUGH__ACCEPTED_AS_READY
SOL_MASTER_EXECUTION_RESUMED=TRUE
W4_CR10_V9_0P7A_REAL_500MS=PASS__elapsed25000__charge1200_cycles417__
        hold1164_to1272__steady1219_to1272_avg1239_calavg1239_n7063__
        packets20_total2242_active_fraction1P7936pct__packetmin86_max126__
        last1219_to1215_cycles19_finalDB105__hardevents0_undersupply0__
        fault0_tripdeltas0_publicenable0__final_cleanup_PWM0_OST1_TZINT0
W4_CR10_V9_0P7A_REAL_500MS_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/real_cr10_v9_0p7a_500ms_v1.txt
W4_CR10_INPUT_LIMIT_HYPOTHESIS_500MS=SUPPORTED__SAME_SHA_0P7A_RESTORES_W4_QUALITY
W4_CR10_V9_0P7A_REAL_2S=PASS__elapsed100000__charge1206_cycles419__
        hold1170_to1278__steady1212_to1278_avg1239_calavg1239_n20578__
        packets762_total107830_active_fraction21P566pct__packetmin82_max160__
        last1218_to1260_postmax1260_cycles159_finalDB36__hardevents0_undersupply0__
        fault0_tripdeltas0_publicenable0__final_cleanup_PWM0_OST1_TZINT0
W4_CR10_V9_0P7A_REAL_2S_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/real_cr10_v9_0p7a_2s_v1.txt
W4_CR10_INPUT_LIMIT_HYPOTHESIS_2S=SUPPORTED__W4_MINUS5PCT1182_PASS
W4_CR10_V9_0P7A_REAL_10S=PASS__elapsed500000__charge1200_cycles417__
        hold1163_to1279__steady1210_to1279_avg1234_calavg1234_n56531__
        packets5330_total836959_active_fraction33P47836pct__packetmin96_max160__
        last1218_to1174_cycles67_finalDB80__hardevents0_undersupply0__
        fault0_tripdeltas0_publicenable0__final_cleanup_PWM0_OST1_TZINT0
W4_CR10_V9_0P7A_REAL_10S_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/real_cr10_v9_0p7a_10s_v1.txt
W4_CR10_INPUT_LIMIT_ROOT_CAUSE=A_B_SUPPORTED__SAME_SHA_0P5A_ABORT3P424S__0P7A_PASS10S
W4_CR10_V9_0P7A_REAL_60S=PASS__elapsed3000000__charge1209_cycles419__
        hold1170_to1273__steady1209_to1273_avg1230_calavg1230_n252790__
        packets34598_total5519829_active_fraction36P79886pct__packetmin98_max160__
        last1217_to1210_cycles10_finalDB110__hardevents0_undersupply0__
        fault0_tripdeltas0_publicenable0__final_cleanup_PWM0_OST1_TZINT0
W4_CR10_V9_0P7A_REAL_60S_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/real_cr10_v9_0p7a_60s_v1.txt
W4_CR10_INPUT_LIMIT_ROOT_CAUSE=CONFIRMED__SAME_SHA_0P5A_ABORT3P424S__0P7A_PASS60S
W4_CR10_60S_TOKEN=W4_CR10_10V_60S_SUSTAINED_PASS
W4_CR10_INSERTION=COMPLETE__ORIGINAL_W4_CR15_CR12P5_ABA_REMAINS
W4_ABA_TRACE_SOURCE_COMMIT=525e9e2659f30b8a2b558e3906094c5f2fd25876
W4_ABA_TRACE_DESIGN=PASSIVE_5MS_128_RING__VOUT_CYCLES_PACKETS__BASELINE200MS_FROM500MS__
        DETECT_AFTER5S__TWO_20MS_BLOCKS__DEMAND_INDEX_CYCLE_RATE_X_PACKET_DEPTH__12P5PCT_DIRECTIONAL
W4_ABA_TRACE_QUALITY=INSTANT_RAW1182_TO1306_5PCT__20MS_MOVING_AVG_RAW1215_TO1265_2PCT__
        SETTLE_LE100MS_AND_REMAIN__INCOMPLETE_WINDOW_FAIL_CLOSED
W4_ABA_TRACE_STATIC_MODEL=PASS__HEAVIER__LIGHTER__BAD_PEAK_REJECT__UNINTERRUPTED_REAL_WINDOW
W4_ABA_TRACE_NE=PASS__HEAVIER_SETTLE45MS__LIGHTER_SETTLE45MS__BADPEAK1170_REJECT__
        INCOMPLETE_FAIL_REASON3__NEVER_RELEASED_PWM__ALL_TERMINAL_PWM0_OST1_TZINT0_FAULT0
W4_ABA_TRACE_REGRESSION=FINAL_SOURCE_W3_10V_BURST_HOLD_NE_PASS__
        W2_OPEN_LOOP_NE_PASS__W2_LIVE_PACKET1_2_3_5_PASS__BURST_REGION21_0_PASS
W4_ABA_TRACE_REAL_OUT_SHA256=2267A0C1DD8FF81373B71BFA35466B22882EE41A6EB99C771BB566B428ED1027
W4_ABA_TRACE_REAL_MAP_SHA256=6F0026338610D42D4F58A54AF67FF742F0453337D63F63833BD2B5018265E4AE
W4_ABA_TRACE_NE_OUT_SHA256=962A1A2AE30DE5F1FDF0E8870BD4F0DE62577470302446262F5639996C2A9129
W4_ABA_TRACE_NE_MAP_SHA256=1E1A88D921093B85D4B269EFF51E3102836E4436292E6743C001B60509BFEA5B
W4_ABA_TRACE_MEMORY=REAL_EBSS0x3A4_OLRAM0x250_RAML2FREE0x5C_RAML3FREE0xD82__
        NE_EBSS0x3FF_OLRAM0x295_RAML2FREE0x1_RAML3FREE0xD3D
W4_ABA_TRACE_REAL_PACKET_ISR_TEXT_WORDS=0xE7
W4_ABA_TRACE_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/offline_aba_trace_v1.txt
W4_ABA_TRACE_QUALIFICATION=PASS__EXACT_REAL_SHA_FROZEN__READY_FOR_SINGLE_CR15_TO_CR12P5_RUN
NEXT_OPERATOR_ACTION=SET_INPUT_LIMIT0P5A__SET_ELOAD_CR15__KEEP_VIN24__REPLY_W4_CR15_READY=1
NEXT=RUN_W4_HEAVIER_60S__AT_8S_MARKER_CHANGE_CR15_TO_CR12P5__THEN_RUN_LIGHTER_RETURN
```

## W5 offline preflight prepared while W4 image is frozen

```text
W5_EXECUTION_STATUS=NOT_STARTED__PREFLIGHT_ONLY__NO_REAL_POWER_PASS_CLAIM
W5_DESIGN=docs/W5_12V_REFERENCE_TRANSITION_OFFLINE_DESIGN.md
W5_PREFLIGHT_TOOL=tools/sol_w5_reference_transition_preflight.py
W5_PREFLIGHT_EVIDENCE=evidence/sol_master_execution/w5_12v_transition/offline_reference_preflight_v1.txt
W5_CALIBRATED_TARGET_RAW=10V_1244__10P5V_1306__11V_1368__11P5V_1430__12V_1491
W5_STAGE_ABORT_POLICY=VREF_PLUS5PCT__RAW1306_1371_1436_1501_1565__WITHIN_WORK_ORDER_PLUS10PCT_MAX
W5_ABSOLUTE_SOFTWARE_CEILING=12V_PLUS10PCT_RAW1640__IMMUTABLE_AND_INDEPENDENT_OF_STAGE_GATE
W5_PROTECTION_AUDIT=FIXED11V_SHOT_GUARD_MUST_MIGRATE__GENERIC_OVP_OCP_UVP_RAW_LIMITS_CURRENTLY0xFFFF_DISABLED
W5_HARDWARE_PROTECTION_TRUTH=COMP_TZ1_IS_ASYNC_PRIMARY_CURRENT_TRIP_NOT_VOUT_OVP__RETAIN_REAL_BENCH0P7A_LIMIT
W5_REGION_OWNERSHIP=10V_PROTECTED_BURST_BASELINE_PROVEN_BY_W2_W4__DISCOVER_FIRST_CONTINUOUS_RUNG_AT10P5V_OR_ABOVE
W5_ENVELOPE=KEEP145_TO170KHZ__REQUEST_BELOW145KHZ_FREEZES_EVIDENCE_AND_STOPS_FOR_W6_W9
W5_PREFLIGHT_TOKEN=SOL_W5_REFERENCE_TRANSITION_PREFLIGHT_PASS
W4_FROZEN_HASH_RECHECK=REAL_OUT2267A0C1__REAL_MAP6F002633__NE_OUT962A1A2A__NE_MAP1E1A88D9__ALL_MATCH
NEXT_W5_AFTER_W4=ADD_DISTINCT_COMPILE_GATED_IMMUTABLE_RUNG_BUILD__STATIC_MODEL_NE_TIMING_NEGATIVE_TESTS__THEN_CR15_LIMIT0P7A_100MS_TO2S_PER_RUNG
```

## W4 first real A/B/A attempt invalidated by target-time shortfall

```text
W4_ABA_REAL_ATTEMPT_COUNT=1
W4_V9_HEAVIER_REAL_SHA256=2267A0C1DD8FF81373B71BFA35466B22882EE41A6EB99C771BB566B428ED1027
W4_V9_HEAVIER_RESULT=INVALID__NOT_PASS__NO_CONTROL_OR_PROTECTION_FAULT
W4_V9_DEBUGSERVER=FTDI_ERROR_MINUS150_DURING_RUN
W4_V9_TARGET_TIME=ELAPSED170735_TICKS_3P4147S__HOST_WAIT_EXPECTED60P6S__FIRMWARE_NOT_TERMINAL
W4_V9_TRACE=ARMED_NOT_TRIGGERED__OLD_DETECT_START250000_TICKS_5S_NOT_REACHED
W4_V9_LOAD_CHANGE_EVIDENCE=BASELINE_DEMAND2226__RING_CYCLE_DELTAS294_TO447_VS_BASELINE42__RAW1216_TO1262
W4_V9_SAFETY=FAULT0__NO_HARD_LIMIT__NO_HW_TRIP__NO_PUBLIC_ENABLE__HOST_FORCE_SAFE_PWM0_OST1_TZINT0
W4_V9_PASS_TOKEN=FALSE
W4_V9_RETRY_POLICY=NO_SAME_SHA_RETRY
W4_V9_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/real_cr15_to_cr12p5_v9_invalid_target_time_v1.txt
W4_V10_ROOT_FIX=DETECT_IMMEDIATELY_AFTER_BASELINE_COMPLETE_AT35000_TICKS__PREFIRE_TARGET_CLOCK_CADENCE_GATE__EARLIER_OPERATOR_MARKER
W4_V10_REAL_ORDER=PHYSICAL_NOW_CR12P5__RUN_LIGHTER_CR12P5_TO_CR15_FIRST__THEN_HEAVIER_RETURN_CR15_TO_CR12P5
```

## W4 V10 early-detect qualification

```text
W4_V10_SOURCE_COMMIT=93521d99b9c1cb22f841f26be57b6e45d17aa2e0
W4_V10_CHANGE=DETECT_START35000_TICKS_AFTER_EXACT0P7S_BASELINE__NO_CONTROL_PROTECTION_PACKET_CHANGE
W4_V10_HOST_GATE=PREFIRE_TARGET_CLOCK_200MS_EXPECT9000_TO11000__MARKER_AT2S__HOST_WAIT70S
W4_V10_REAL_OUT_SHA256=B10587C6FF8BE3F438E18CB229DAB9733087FE62BC091129778F0D359A71C07B
W4_V10_REAL_MAP_SHA256=D0DD64CAE3342851EA1ADA033CE7E70C4CDBE5A34AC33866D675255E80D28A7D
W4_V10_NE_OUT_SHA256=3190C54E0EEAB2422D66A3E1FDFBCDA86ACB1CC7E3782FF535D640DAB92F49E2
W4_V10_NE_MAP_SHA256=49A36FEDE7E71298DBC7C15BCEF5CCF28D2376AD669D90C1486F4A8600266F1C
W4_V10_MEMORY=REAL_RAML2FREE0x5C_RAML3FREE0xD82__NE_RAML2FREE0x1_RAML3FREE0xD3D
W4_V10_STATIC=SOL_W4_TRACE_STATIC_MODEL_PASS
W4_V10_NE=PREFIRE_CLOCK10197_PASS__HEAVIER_SETTLE40MS__LIGHTER_SETTLE35MS__BADPEAK_REJECT__INCOMPLETE_FAIL_CLOSED
W4_V10_NE_TOKEN=SOL_W4_TRACE_NOENERGY_PASS
W4_V10_REGRESSIONS=W3_BURST_HOLD_PASS__W2_OPEN_LOOP_PASS__W2_LIVE1_2_3_5_PASS__BURST_REGION21_0_PASS
W4_V10_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/offline_aba_trace_v10_early_detect.txt
W4_V10_REAL_NEXT=RUN_ID0x25090592__CR12P5_TO_CR15__NO_SAME_SHA_RETRY_AFTER_FIRE
```

## W4 V10 lighter attempt had no in-window physical step

```text
W4_ABA_REAL_ATTEMPT_COUNT=2
W4_V10_LIGHTER_RESULT=FAIL_NO_STEP__HOLD_AND_ALL_SAFETY_GATES_PASS
W4_V10_PREFIRE_CLOCK=10801_TICKS_PER200MS__PASS
W4_V10_HOLD=STATE_COMPLETE_REASON_COMPLETE_ELAPSED3000000_EXACT__AVG1238__PACKETS29784__CYCLES4690699
W4_V10_TRACE=FAIL_REASON3_NO_COMPLETE_WINDOW__BASELINE_RAW1243_DEMAND10904__NO_TRIGGER
W4_V10_SAFETY=FAULT0__NO_HARD_LIMIT__NO_HW_TRIP__NO_PUBLIC_ENABLE__FINAL_PWM0_OST1_TZINT0
W4_V10_PASS_TOKEN=FALSE
W4_V10_RETRY_POLICY=NO_SAME_SHA_RETRY
W4_V10_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/real_cr12p5_to_cr15_v10_no_step_v1.txt
W4_V11_ROOT_FIX=FIRMWARE_MIN60S_MAX180S_WAIT_FOR_TRACE__END_AFTER_TRACE_OR_MAX__HOST_STDIN_ACK_BARRIER
W4_V11_PHYSICAL_NOW=VIN24__CR15__INPUT_LIMIT0P5A
W4_V11_REAL_ORDER=RUN_HEAVIER_CR15_TO_CR12P5__THEN_LIGHTER_RETURN_CR12P5_TOCR15
```

## W4 V11 autonomous operator-window qualification (paused before real fire)

```text
W4_V11_STATUS=OFFLINE_QUALIFIED__REAL_NOT_FIRED__PAUSED_BY_USER
W4_V11_PRIVATE_SESSION=EXACT_W3_10V_PLUS60000MS_PLUS_ARM1_PLUS_VALID_DIRECTION__PUBLIC_TRACE_TELEMETRY_CANNOT_AUTHORIZE_EXTENSION
W4_V11_DURATION=MIN3000000_TICKS_60S__MAX9000000_TICKS_180S__END_AFTER_TRACE_TERMINAL_AT_OR_AFTER_MIN
W4_V11_ENERGY_CAP=DYNAMIC_50PCT__7500000_AT60S_TO22500000_AT180S__PER_PACKET_MAX160_UNCHANGED
W4_V11_STATS_OVERFLOW_BOUND=MAX3000000_ACCUM_SAMPLES__(N_MINUS1)X1299_PLUS65535_EQUALS3897064236_LT_UINT32_MAX
W4_V11_TERMINAL=HARDSTOP__PACKET_ACTIVE0__PWM0__PUBLISH_STATS__FREEZE_FINAL__REAL_ONLY_ESTOP0__DSS_WAITFORHALT_NO_GUESSED_HOST_HALT
W4_V11_STATIC_MODEL=SOL_W4_TRACE_STATIC_MODEL_PASS
W4_V11_NE=SOL_W4_TRACE_NOENERGY_PASS__LEGACY_AND_W3_ISOLATION__PUBLIC_DIRECTION_TAMPER__OFF_AND_PACKET_TERMINALS__60_TO180_WINDOW__EARLY_ABORT
W4_V11_REGRESSIONS=W3_10V_BURST_HOLD_PASS__W2_OPEN_LOOP_PASS__W2_LIVE1_2_3_5_PASS__BURST_REGION21_0_PASS
W4_V11_REAL_DISASM=CALHOLD_END_CONTAINS_CONDITIONAL_ESTOP0_AFTER_FINAL_FREEZE
W4_V11_NE_DISASM=CALHOLD_END_HAS_NO_ESTOP0
W4_V11_REAL_OUT_SHA256=EA79E8714CDF39F634E7A332A9BDB94F345117D375EA1AD30A102E53D6478642
W4_V11_REAL_MAP_SHA256=676B2E122032EB8A5C9D2665E0FFE20060F83B81B7A1E8A2690A40861F61AA4B
W4_V11_NE_OUT_SHA256=C45A964227704D42F281A9A8E61284DA8CD135D4CA4ED33FD9F01BF45A060FEC
W4_V11_NE_MAP_SHA256=E9AFCAA4711A666A86F4BC29DC80EC5FA1B442855A2FD08A368E9AF212DA7020
W4_V11_MEMORY=REAL_RAML2_FREE0x5C_RAML3_FREE0xD82__NE_RAML2_FREE0x1_RAML3_FREE0xD3D
W4_V11_W5_HASH_RECHECK=REFERENCE_PREFLIGHT_PASS__REFERENCE_MODULE_STATIC_MODEL_PASS__NOT_LINKED_IN_W4
W4_V11_NEXT_ON_RESUME=COMMIT_CURRENT_V11_CHECKPOINT__RUN_HEAVIER_FROM_CR15__DO_NOT_REBUILD_OR_REDO_OFFLINE_GATES_UNLESS_SOURCE_CHANGED
```

## W4 V11 real attempt invalidated by no step and FTDI loss

```text
W4_ABA_REAL_ATTEMPT_COUNT=3
W4_V11_FIRMWARE_SOURCE_COMMIT=8366100
W4_V11_HOST_IMPORT_FIX_COMMIT=356857f
W4_V11_HEAVIER_REAL_SHA256=EA79E8714CDF39F634E7A332A9BDB94F345117D375EA1AD30A102E53D6478642
W4_V11_HEAVIER_PREFIRE=ALL_PASS__TARGET_CLOCK10477_TICKS_PER200MS
W4_V11_HEAVIER_POWER_REQUEST_FIRED=TRUE
W4_V11_HEAVIER_PHYSICAL_TRUTH=OPERATOR_CONFIRMED_ELOAD_REMAINED_CR15_THROUGHOUT__NO_CR12P5_STEP
W4_V11_HEAVIER_DEBUGSERVER=FTDI_ERROR_MINUS150__TARGET_STATUS_FAILED20_ATTEMPTS__TERMINAL_HALT_NOT_OBSERVED
W4_V11_HEAVIER_HOST_SAFETY=NO_ACTIVE_TARGET_HALT__NO_TARGET_CLEANUP_AFTER_FIRE__STUCK_PROCESS_ENDED_ONLY_AFTER_EXTERNAL_POWER_OFF
W4_V11_HEAVIER_RESULT=INVALID_UNVERIFIED__NOT_PASS__NOT_PLANT_OR_CONTROL_FAIL
W4_V11_HEAVIER_RETRY_POLICY=NO_SAME_SHA_RETRY
W4_V11_HEAVIER_EXTERNAL_END=OPERATOR_CONFIRMED_REAL_POWER_OFF__ELOAD_CR15_REMAINED_CONNECTED
W4_V11_HEAVIER_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/real_cr15_no_step_v11_ftdi150_unverified_v1.txt
NEXT=W4_V12_NEW_SHA__REMOVE_CONTINUOUS_WAITFORHALT_FTDI_TRAFFIC__PRESERVE_FIRMWARE_AUTONOMOUS_OST__NO_ACTIVE_HOST_HALT
```

## W4 V12 quiet-host and autonomous terminal qualification

```text
W4_V12_SOURCE_COMMIT=b7898326ffc6c90eb025b30f06c688f36fd9ef2b
W4_V12_TUTORIAL_REFERENCE=D:\CCS21_workspace\Codex_Project\100wllccode__PI_AND_2Z2P__TARGET_ISR_AUTONOMY_TZ1_AND_GPIO20_21_24_LED_PATTERN_REUSED
W4_V12_HOST=POST_MARKER_MONOTONIC_NONCE_ACK__NO_WAITFORHALT__NO_INFINITE_TIMEOUT__QUIET_TO_MAX_FIRE70S_ACK2S__BOUNDED_ISHALTED5S_MAX2__EXCEPTION_NO_RETRY
W4_V12_UNCONFIRMED_TARGET_POLICY=NO_MEMORY_READ__NO_ACTIVE_HALT__NO_TERMINATE__AUTONOMOUS_TO205S
W4_V12_TERMINAL=HARDSTOP__PACKET0__PWM0__TRACE_STATS_STATE_REASON_FREEZE__PRIVATE_LATCH0__RED_YELLOW_ON_GREEN_OFF__COOKIE_COMMIT__DINT__ESTOP0__SPIN
W4_V12_COOKIE=BASE0x57440000_XOR_RUNIDSTOP_XOR_DIRECTION16_XOR_STATE8_XOR_REASON__CLEARED_BEFORE_EACH_NONZERO_ARM
W4_V12_REAL_OUT_SHA256=968CD9669DE6C46E4323A457696A0E5DAAA7338D89C72717402237F529A4FAFC
W4_V12_REAL_MAP_SHA256=E17067F47C64CEB9F59EA9E306FD6EA1277CAF36B81E9DA8F58EECDB4E8CE9B5
W4_V12_NE_OUT_SHA256=EBD0AAC8AEEF84AF672AA5BE0F4DC05045B55737D4C82855B24B8DF1C9E83B53
W4_V12_NE_MAP_SHA256=196BB8F818AB1A4975E06803EA9605085C37C31E92D4F2A81DE0D7BE62576820
W4_V12_MEMORY=REAL_RAML2_FREE0x5C_RAML3_FREE0xD82__NE_RAML2_FREE0x1_RAML3_FREE0xD3D
W4_V12_DISASM=REAL_COOKIE_STORE_THEN_DINT_ESTOP0_SELF_BRANCH__NE_COOKIE_STORE_THEN_RETURN_NO_ESTOP
W4_V12_STATIC_MODEL=SOL_W4_TRACE_STATIC_MODEL_PASS
W4_V12_NE=SOL_W4_TRACE_NOENERGY_PASS__COOKIE_ALL_TERMINALS__NEVER_RELEASED_PWM__PWM0_OST1_TZINT0_FAULT0
W4_V12_REGRESSIONS=W3_10V_BURST_HOLD_PASS__W2_OPEN_LOOP_PASS__W2_LIVE1_2_3_5_PASS__BURST_REGION21_0_PASS
W4_V12_PROBE=XDS100SERIAL20_OF20_PASS__PNP_OK__NO_STALE_DSS_PROCESS
W4_V12_LONG_IDLE_LINK_TEST=SCRIPT_AND_STATIC_GATE_PASS__NOT_EXECUTED_BECAUSE_OPERATOR_REENABLED_REAL24V_AND_REQUESTED_DIRECT_TEST
W4_V12_REAL_DIRECTION=HEAVIER_CR15_TO_CR12P5__RUN_ID0x25090596__INPUT_LIMIT0P5A
W4_V12_REAL_PASS_TOKEN=FALSE__READY_NOT_YET_FIRED
W4_V12_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/offline_v12_quiet_host_cookie_v1.txt
```

## W4 V12 real attempt invalidated by late mismatched step and debug loss

```text
W4_ABA_REAL_ATTEMPT_COUNT=4
W4_V12_REAL_SHA256=968CD9669DE6C46E4323A457696A0E5DAAA7338D89C72717402237F529A4FAFC
W4_V12_PREFIRE=ALL_PASS__TARGET_CLOCK10236_TICKS_PER200MS
W4_V12_POWER_REQUEST_FIRED=TRUE
W4_V12_DEBUGSERVER=ERROR_MINUS1041__FTDI_MINUS150_AFTER_MARKER__FAILED_TARGET_STATUS_AND_DEBUG_STATE_REMOVAL
W4_V12_DECLARED_STEP=CR15_TO_CR12P5
W4_V12_ACTUAL_STEP=CR15_TO_CR12__ACK_AT_HOST_FIRE_PLUS_APPROX1038P645S__OUTSIDE_180S_TARGET_AND205S_HOST_WINDOWS
W4_V12_TERMINAL_PROBES=FALSE_THEN_FALSE__NO_CAPSULE_OR_COOKIE_READ
W4_V12_HOST_SAFETY=NO_ACTIVE_HALT__NO_POSTFIRE_MEMORY__NO_TARGET_CLEANUP_OR_TERMINATE
W4_V12_RESULT=INVALID_UNVERIFIED__NOT_PASS__NOT_CONTROL_OR_PLANT_FAIL
W4_V12_RETRY_POLICY=NO_SAME_SHA_RETRY
W4_V12_OPERATOR_PROFILE_CHANGE=USE_CR15_AND_CR12_FOR_FUTURE_ABA
W4_V12_CURRENT_PHYSICAL=REAL24V_ON__ELOAD_CR12__TARGET_UNCONFIRMED
W4_V12_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/real_cr15_to_cr12_v12_late_ack_ftdi_unverified_v1.txt
NEXT=W4_V13_NEW_PROFILE_BOUND_SHA__EXTERNAL_POWER_OFF__PROBE_RECOVERY__START_FROM_CR12_RETURN_TO_CR15_OR_REESTABLISH_CR15
```

## W4 V13 CR15/CR12 profile-bound offline qualification and probe gate

```text
W4_V13_SOURCE_COMMIT=98567911f30f6db75d3c5610ec36739f91b7f00a
W4_V13_PHYSICAL=REAL24V_OFF_OPERATOR_CONFIRMED__ELOAD_CR12_CONNECTED__INPUT_LIMIT0P5A_CARRIED_FORWARD
W4_V13_PROFILE=LIGHT150_X10__HEAVY120_X10__PROFILE_ID0x0F0C__OLD_CR12P5_COOKIE_INCOMPATIBLE
W4_V13_RUNS=HEAVIER0x25090598_CR15_TO_CR12__LIGHTER0x25090599_CR12_TO_CR15
W4_V13_FIRST_REAL=LIGHTER_CR12_TO_CR15__USES_CURRENT_PHYSICAL_LOAD_WITHOUT_PRERUN_CHANGE
W4_V13_COOKIE=BASE0x57440000_XOR_PROFILE0x0F0C_XOR_RUNIDSTOP_XOR_DIRECTION16_XOR_STATE8_XOR_REASON
W4_V13_REAL_OUT_SHA256=71EF1073DD520AB15BB5480CE0ECCA078AE509C64246F55A58C94D4D7125F7EC
W4_V13_REAL_MAP_SHA256=54A1361F3BA084E1171010B20102C6CF71EE12989EE56E750378E93B95473FE3
W4_V13_NE_OUT_SHA256=38C8C3E027B6C1D52E15F2A0264F756D771BF0C3E7BE32BA7BA525E3053AEBC2
W4_V13_NE_MAP_SHA256=E7EB3E83613B13352C835440E5D4B6D80E6BB8A1984FA00656B551665352EFE4
W4_V13_MEMORY=REAL_RAML2_FREE0x5C_RAML3_FREE0xD82__NE_RAML2_FREE0x1_RAML3_FREE0xD3D
W4_V13_BUILD=REAL_PASS__NE_PASS__CGT25P11P1_LTS_COFF
W4_V13_STATIC=SOL_W4_TRACE_STATIC_MODEL_PASS__EXACT_PROFILE_DIRECTIONS_PASS__REAL_NE_COOKIE_BINDING_PASS
W4_V13_W5_HASH_RECHECK=REFERENCE_PREFLIGHT_PASS__REFERENCE_MODULE_STATIC_MODEL_PASS__NOT_LINKED_IN_W4
W4_V13_DISASM=REAL_PROFILE_XOR_COOKIE_STORE_DINT_ESTOP0_SELF_BRANCH_ORDER_PASS__NE_PROFILE_XOR_COOKIE_STORE_RETURN_NO_ESTOP
W4_V13_XDS=COMPOSITE_PRESENT_FALSE_PHANTOM__UPSTREAM_VID05E3_HUB_PRESENT_FALSE_PHANTOM_USB_HUB_COULD_NOT_RESET__CONNECTED_ENUM_NO_DEVICE
W4_V13_PNPUTIL_SCAN=ACCESS_DENIED__NO_BROAD_OR_ROOT_HUB_RESET_ATTEMPTED
W4_V13_RECOVERY=PHYSICAL_REPLUG_OR_DIRECT_MOTHERBOARD_USB_REQUIRED_WHILE24V_OFF__THEN_TARGET_UNKNOWN_RELOAD_NE_VERIFY_PWM0_OST1_TZINT0
W4_V13_ON_TARGET_NE=SOL_W4_TRACE_NOENERGY_PASS__BOTH_DIRECTIONS_COOKIE_ALL_TERMINALS__PWM0_OST1_TZINT0_FAULT0
W4_V13_REGRESSIONS=W3_BURST_HOLD_PASS__W2_OPEN_LOOP_PASS__W2_LIVE1_2_3_5_PASS__BURST_REGION21_0_PASS
W4_V13_PROBE_RECOVERED=POST_REPLUG_COMPOSITE_AND_HUB_PRESENT_TRUE_STATUS_OK_CM_PROB_NONE__XDS100SERIAL_PRE20_OF20
W4_V13_QUIET_LINK_205S=PASS__70S_FALSE__205S_FALSE__TARGET_CLOCK_DELTA10235024__POST_PWM0_OST1_TZINT0_FAULT0
W4_V13_PROBE_POST_205S=XDS100SERIAL20_OF20__NO_STALE_DSS_PROCESS
W4_V13_REAL_PASS_TOKEN=FALSE__NOT_FIRED
W4_V13_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/offline_v13_cr15_cr12_profile_v1.txt
NEXT=POWER24V_ON__KEEP_CR12_INPUT_LIMIT0P5A__RUN_LIGHTER_CR12_TO_CR15
```

## W4 V13 lighter real result: safe hold, stale startup demand baseline

```text
W4_ABA_REAL_ATTEMPT_COUNT=5
W4_V13_REAL_SOURCE_COMMIT=98567911f30f6db75d3c5610ec36739f91b7f00a
W4_V13_LIGHTER_REAL_SHA256=71EF1073DD520AB15BB5480CE0ECCA078AE509C64246F55A58C94D4D7125F7EC
W4_V13_LIGHTER_PHYSICAL=VIN24__INPUT_LIMIT0P5A__OPERATOR_CONFIRMED_CR12_TO_CR15__FINAL_CR15
W4_V13_LIGHTER_PREFIRE=ALL_PASS__TARGET_CLOCK10547_TICKS_PER200MS
W4_V13_LIGHTER_COORDINATION=NONCE_ACK_PASS__FIRST_PROBE_FLOOR_FIRE_PLUS70944MS__FIRST_FALSE__FINAL205S_TRUE__NO_FTDI_EXCEPTION
W4_V13_LIGHTER_TERMINAL=STATE4_REASON1_ELAPSED9000000_EXACT__PACKET0_PWM0_FINALOST1_HWOST1_FAULT0
W4_V13_LIGHTER_COOKIE=0x724F0E94_MATCH__RUNSTOP0x25090599__CAPSULE_PASS
W4_V13_LIGHTER_HOLD=MIN1061_MAX1276_AVG1239__PACKETS84711__CYCLES12839791__AVERAGE_AND_CAP_PASS
W4_V13_LIGHTER_TRACE=STATE6_FAIL3_NO_COMPLETE_WINDOW__DIRECTION2__TRIGGER0__QUALITY_NOT_EVALUATED
W4_V13_LIGHTER_BASELINE=TARGET0P5_TO0P7S_STARTUP__RAW1245__CYCLES5MS76__CPP108__DEMAND4104__LIGHTER_THRESHOLD3591
W4_V13_LIGHTER_LATE_RING=RAW1216_TO1265__TYPICAL20MS_DEMAND25032_TO27863__FIXED_BASELINE_STRUCTURALLY_STALE
W4_V13_LIGHTER_SAFETY=NO_HARD_LIMIT__NO_FAULT__NO_HW_TRIP__NO_PUBLIC_ENABLE__FINAL_AND_CLEANUP_PWM0_OST1_TZINT0
W4_V13_LIGHTER_RESULT=FAIL_TRACE_NO_DETECTION__NOT_A_HOLD_OR_SAFETY_FAILURE__NOT_PASS
W4_V13_LIGHTER_RETRY_POLICY=NO_SAME_SHA_RETRY
W4_V14_ROOT_FIX=WARMED_ROLLING_PRESTEP_DEMAND_REFERENCE__DETECTION_ONLY_AFTER_WARMUP__HOST_MARKER_AFTER_WARMUP__NO_PWM_OR_PROTECTION_CHANGE
W4_V13_LIGHTER_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/real_cr12_to_cr15_v13_stale_baseline_v1.txt
NEXT=REAL24V_OFF__KEEP_CR15__BUILD_AND_NE_PROVE_V14__THEN_HEAVIER_CR15_TO_CR12_NEW_SHA
```

## W4 V14 warmed/frozen reference and target-marker offline qualification

```text
W4_V14_SOURCE_COMMITS=02e0d86c41c21549163af32df874ea405b412e4e__511010135fccd7cf7259812f886f92b419dfccb8
W4_V14_PHYSICAL=OPERATOR_FROZEN_VIN24__ELOAD_CR15__NO_TARGET_SESSION_OR_BOARD_WRITE_DURING_OFFLINE_BUILD
W4_V14_REFERENCE=LATEST200MS_RECOMPUTED_EVERY5MS_UNTIL10S__THEN_FROZEN
W4_V14_TARGET_MARKER=12S__STORE_TARGET_TICK__REAL_GPIO21_YELLOW_ON__IMMEDIATE_RETURN
W4_V14_POST_MARKER_GUARD=3000_TICKS_60MS__12_NEW_SAMPLES__B1_B2_B3_ALL_PHYSICALLY_POST_MARKER
W4_V14_HOST=WAIT_YELLOW_THEN_OPERATOR_CHANGE__NONCE_ACK_SEPARATE_GATE__CONFIRM_GE_MARKER_PLUS3000__THREE_RING_BULK_RECOMPUTE__POST200MS_DEMAND_PERSISTENCE
W4_V14_PROFILE=CR15_CR12__PROFILE0x0F0C__ALGORITHM0x0014__COOKIE_XOR0x0F18
W4_V14_RUNS=HEAVIER0x2509059A_CR15_TO_CR12__LIGHTER0x2509059B_CR12_TO_CR15
W4_V14_REAL_OUT_SHA256=B4371EC608FDD0759FD3DEE52C125079CF3DE9A6CFE480BEA1181BD5DD588F2B
W4_V14_REAL_MAP_SHA256=7EC1D057E128D450C5FBFCF3B8F48F14B33DDF9B970FAE137881A22B00A636A9
W4_V14_NE_OUT_SHA256=A90BD9223F96D9D8168CD22EE30D7922A31C0088C9110653F578E222217EFCB8
W4_V14_NE_MAP_SHA256=1FEE5E10F885C113A841A9D06425B93AE70A1A2F65EF48D678DE7F379D615F10
W4_V14_MEMORY=REAL_RAML2_FREE0x5C_RAML3_FREE0xD82__NE_RAML2_FREE0x1_RAML3_FREE0xD3D__NE_NO_RELAXATION
W4_V14_BUILD=REAL_PASS__NE_PASS__CGT25P11P1_LTS_COFF
W4_V14_STATIC_MODEL=SOL_W4_TRACE_STATIC_MODEL_PASS__POST_MARKER_CANDIDATES_PASS__40MS_PULSE_HOST_REJECT_PASS__ALL128_RING_PHASES_PASS
W4_V14_W5_HASH_RECHECK=REFERENCE_PREFLIGHT_PASS__REFERENCE_MODULE_STATIC_MODEL_PASS__NOT_LINKED_IN_W4
W4_V14_DISASM=REAL_MARKER_STORE_LED_RETURN__GUARD_MARKER_PLUS3000_DIRECTION_PASS__COOKIE_XOR0x0F18_STORE_DINT_ESTOP_SELF_BRANCH__NE_COOKIE_STORE_RETURN_NO_ESTOP
W4_V14_INDEPENDENT_AUDITS=TWO_GO__NO_REMAINING_BLOCKER
W4_V14_XDS_INCIDENT=UPSTREAM_GENESYS_HUB_AND_XDS_ALL_REMOVED_AT12H42__NOT_FIRMWARE_OR_PROCESS_CONTENTION
W4_V14_XDS_RECOVERY=REPLUG_AT12H45__COMPOSITE_DEBUG_AUX_HUB_ALL_PRESENT_TRUE_STATUS_OK__XDS100SERIAL20_OF20__NO_RESIDUAL_DSS_PROCESS
W4_V14_ON_TARGET_NE=PASS_DEENERGIZED__SOL_W4_TRACE_NOENERGY_PASS__PWM_NEVER_RELEASED__FINAL_SHA
W4_V14_REGRESSIONS=STATIC_AND_MODEL_ALL_PASS__W3_W2_UNCHANGED_ACCEPTED_RESULTS_CARRIED_FORWARD
W4_V14_REAL_PASS_TOKEN=FALSE__NOT_FIRED
W4_V14_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/offline_v14_warmed_frozen_target_marker_v1.txt
NEXT=TURN_REAL24V_OFF__KEEP_CR15__RUN_V14_NOENERGY_AND_W3_W2_REGRESSIONS__THEN_POWER24V_ON_AND_RUN_HEAVIER_CR15_TO_CR12
```

## W4 V14 powered OST-clamped no-energy exception result

```text
W4_V14_POWERED_NE_USER_CONSTRAINT=VIN24_CANNOT_BE_TURNED_OFF__FREEZE_VIN24_CR15
W4_V14_POWERED_NE_SCOPE=SOL_W4_TRACE_NOENERGY_ONLY__STRICT_NO_TZCLR_OST__NO_REAL_PWM_RELEASE
W4_V14_POWERED_NE_PRECEDENT=W3_V3_V4_AND_W4_V9_SAFE_SUBSET_PREVIOUSLY_RUN_WITH_VIN24_CONNECTED
W4_V14_POWERED_NE_EXCLUDED=BURST_PACKET_COLD_START__FORMAL_SOFTSTART_NE__GENERIC_MULTICYCLE_NE
W4_V14_POWERED_NE_REVIEW=ONE_GO_HISTORICAL_NARROW_EXCEPTION__TWO_NO_GO_UNOBSERVED_GEL_RESET_LOAD_WINDOW__ROOT_ACCEPTED_NARROW_EXISTING_PRECEDENT
W4_V14_POWERED_NE_SHA256=A90BD9223F96D9D8168CD22EE30D7922A31C0088C9110653F578E222217EFCB8
W4_V14_POWERED_NE_BOOT=PWM0_OST1_TZINT0_FAULT0__TARGET_CLOCK200MS_DELTA10521
W4_V14_POWERED_NE_HEAVIER=PASS__MIN1185_MAX1240_SETTLE25MS_TRIGGER_DEMAND22500
W4_V14_POWERED_NE_LIGHTER=PASS__MIN1240_MAX1295_SETTLE45MS_TRIGGER_DEMAND15000
W4_V14_POWERED_NE_NEGATIVES=BAD_PEAK_REJECT__NO_STEP_FAIL_AT180S__LATE_STEP_PASS__EARLY_HARD_LIMIT_SAFE_ABORT
W4_V14_POWERED_NE_MARKER=REFERENCE_FROZEN__PRE12S_DETECT_CLOSED__MARKER_PLUS3000_TRIGGER_GATE_PASS_BOTH_DIRECTIONS
W4_V14_POWERED_NE_COOKIE=PASS_ALL_TERMINALS
W4_V14_POWERED_NE_SAFETY=EVERY_SCENARIO_PWM0_OST1_TZINT0_FAULT0__FIRSTSTART_TZCLR_ENABLERISE_HWTRIP_ACTIVETRIP_ALL_ZERO_DELTA
W4_V14_POWERED_NE_TOKEN=SOL_W4_TRACE_NOENERGY_PASS
W4_V14_POWERED_NE_POST=SESSION_EXIT0__NO_RESIDUAL_DSS_PROCESS__OLD_AD_HOC_XDS20_OF20_RETRACTED_FALSE_POSITIVE
W4_V14_POWERED_NE_REGRESSION_POLICY=DO_NOT_REPEAT_FOUR_ADDITIONAL_GEL_RESET_LOADS__W3_W4_ISOLATION_PASS_THIS_RUN__W2_SOURCES_UNCHANGED_AND_PRIOR_ON_TARGET_PASS_CARRIED_FORWARD
W4_V14_POWERED_NE_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/powered_v14_noenergy_v1.txt
NEXT=RECOVER_XDS__CORRECTED20_OF20_GATE__RUN_REAL_HEAVIER0x2509059A_FROM_CR15
```

## W4 V14 real heavier prefire XDS -151, no power request

```text
W4_V14_REAL_PREFIRE_ATTEMPT=1__NOT_COUNTED_AS_FIRED_REAL_ATTEMPT
W4_V14_REAL_SHA256=B4371EC608FDD0759FD3DEE52C125079CF3DE9A6CFE480BEA1181BD5DD588F2B
W4_V14_REAL_DIRECTION=HEAVIER_CR15_TO_CR12__RUN_ID0x2509059A
W4_V14_REAL_CONNECT=FAIL_FTDI_MINUS151__TARGET_NOT_CONNECTED
W4_V14_REAL_PROGRAM_LOAD=NOT_STARTED
W4_V14_REAL_POWER_REQUEST_FIRED=FALSE
W4_V14_REAL_PHYSICAL=VIN24_CR15_UNCHANGED__NO_LOAD_STEP
W4_V14_REAL_RESULT=PREFIRE_INVALID__NOT_PASS__NOT_CONTROL_OR_PLANT_FAILURE
W4_V14_REAL_RETRY_POLICY=SAME_SHA_AND_TUPLE_ALLOWED_BECAUSE_FIRE_FALSE
W4_V14_XDS_NOW=COMPOSITE_DEBUG_AUX_PRESENT_FALSE_STATUS_UNKNOWN__PARENT_GENESYS_HUB_PRESENT_FALSE
W4_V14_XDS_REMOVAL=XDS13H22M42__HUB13H22M44
W4_V14_XDS_SERIAL_CORRECTED=0_OF20__NO_EMULATORS_FOUND
W4_V14_XDS_OLD_CHECK_BUG=MATCHED_WORD_XDS100_INSIDE_NO_XDS100_EMULATORS__PRIOR_POST_NE20_OF20_RETRACTED
W4_V14_XDS_NEW_GATE=tools/sol_xds100_stability_gate.ps1__MIN20__EVERY_SCAN_PRE_POST_PNP_CHILDREN_PARENT_TOPOLOGY_AND_ARRIVAL_FINGERPRINT__UNIQUE_EXPLICIT_XDS100V2_ROW__NO_AND_ERROR_TEXT_REJECTED__TWO_REVIEWER_GO
W4_V14_REAL_PREFIRE_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/real_v14_prefire_xds151_no_fire_v1.txt
W4_V14_LATEST_PHYSICAL_OVERRIDE=USER_CONFIRMED_VIN24_WAS_ALREADY_OFF__SUPERSEDES_PRIOR_FROZEN_VIN24_ON_ASSUMPTION
W4_V14_XDS_DRIVER_DIAG=TI_OEM120_AND_OEM122_INF_PRESENT__FTDIBUS_SYS_PRESENT__XDS_CHILDREN_AND_GENESYS_PARENT_CM_PROB_PHANTOM__ROOT_HUB30_PRESENT_OK__NO_DRIVER_UNINSTALL_EVIDENCE
NEXT=RESEAT_PC_TO_XDS_USB_PREFER_DIRECT_MOTHERBOARD__KEEP_VIN24_OFF__RUN_CORRECTED20_OF20__THEN_SAFE_DEENERGIZED_LOAD_VERIFY
```

## W4 XDS disconnect causal forensics

```text
XDS_FORENSICS_RESULT=NO_EVIDENCE_OF_DRIVER_DISABLE_UNINSTALL_OR_XDS_EEPROM_FIRMWARE_WRITE__HARDWARE_DAMAGE_NOT_REMOTELY_EXCLUDED
XDS_FORENSICS_TIMING=NOENERGY_DSS13H20M29_TO13H21M07__POST_ENUM_END13H21M54__LAST_READONLY_GETCONTENT_END13H22M11__XDS_AND_HUB_REMOVED13H22M42__REAL_DSS_START13H23M34
XDS_FORENSICS_IDLE_GAP=NO_HOST_TOOL_OR_TARGET_COMMAND13H22M11_TO13H23M16__DISCONNECT_OCCURRED_INSIDE_IDLE_GAP
XDS_FORENSICS_REAL=CONNECT_FTDI_MINUS151__TARGET_NOT_CONNECTED__LOAD_FAILED__FIRE_FALSE__STARTED51P7S_AFTER_REMOVAL
XDS_FORENSICS_CURRENT_USB=ROOT_HUB30_OK__SAME_HS09_NODE_VID0000_PID0002_PRESENT_CODE43_DEVICE_DESCRIPTOR_FAILURE__FAILURE_PRE_TI_DRIVER_BINDING
XDS_FORENSICS_DRIVER=OEM120_TI_FTDI_DEBUG_BEST_RANKED_INSTALLED__OEM122_STAGED__FTDIBUS_SYS_PRESENT__CONFIGFLAGS0
XDS_FORENSICS_PREEXISTING=BEFORE_CURRENT_WINDOW_XDS_REMOVAL18__GENESYS0610_REMOVAL46__SAME_HS09_DESCRIPTOR_FAILURE2__IDENTICAL_SEQUENCE_AT12H42
XDS_FORENSICS_XDS100SERIAL=NO_ARGUMENT_ENUMERATION_ONLY__NO_EEPROM_PROGRAM_ARGUMENT__OLD_TEXT_MATCH_PASS_COUNTER_RETRACTED
XDS_FORENSICS_HOST_DEFECT=REAL_SCRIPT_LINE111_SWALLOWS_CONNECT_EXCEPTION_AND_CONTINUES__NO_WRITE_OCCURRED_THIS_TIME__MUST_FIX_BEFORE_RETRY
XDS_FORENSICS_CAUSAL_BOUNDARY=TIMING_AND_HISTORY_STRONGLY_FAVOR_EXISTING_HUB_CABLE_POWER_OR_PORT_CHAIN__DIRECT_STANDALONE_BYPASS_NEEDED_TO_EXCLUDE_XDS_BODY
XDS_FORENSICS_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/xds_disconnect_forensics_v1.txt
NEXT=VIN24_OFF__ISOLATE_TARGET_JTAG__KNOWN_GOOD_USB_CABLE_DIRECT_DIFFERENT_MOTHERBOARD_PORT__PNP_ONLY_CHECK
```

## W4 V14 USB recovery, fail-closed host repair, and de-energized NE PASS

```text
W4_V14_USB_RECOVERY=COMPOSITE_XDS100V2__MI00_DEBUG__MI01_AUX__PARENT_GENESYS_ALL_PRESENT_OK
W4_V14_USB_STRICT_GATE=XDS100SERIAL_ENUMERATED20_OF20__PNP_STABLE_CHECKS20_OF20__FINAL_STABLE_TRUE__PASS
W4_V14_USB_POST_NE=UNIQUE0403_A6D0_XDS100V2_ROW__ALL_THREE_PNP_NODES_OK__RESIDUAL_DEBUG_PROCESS0
W4_V14_HOST_DEFECT_FIX=CONNECT_EXCEPTION_NO_LONGER_SWALLOWED__CONNECTED_TRUE_ONLY_AFTER_RETURN__OUTER_EXCEPTION_ALWAYS_INCREMENTS_FAILURES
W4_V14_HOST_DEFECT_TESTS=SOURCE_ORDER_PASS__TWO_NEGATIVE_MUTATIONS_REJECTED__CONNECT_THROW_ONLY_CONNECT_NO_LOAD_NO_CLEANUP_FAILURE1__INDEPENDENT_REVIEW_GO
W4_V14_NE_FIXTURE_ROOT_CAUSE=V14_POST_MARKER_GUARD60MS_EXCLUDED_OLD22MS_SYNTHETIC_TRANSIENT__NOT_TARGET_CONTROL_OR_POWER_FAILURE
W4_V14_NE_FIXTURE_FIX=FORWARD_ONLY_POSITION_TO_MARKER_PLUS2998__22MS_TRANSIENT_CROSSES_CAPTURE_BOUNDARY__LATE_STEP_NEVER_REWOUND
W4_V14_NE_DIAGNOSTIC_ATTEMPTS=EXPECTED_SYNTHETIC_PEAK_OR_LATE_STEP_ASSERTIONS_ONLY__EVERY_SAFETY_GATE_PWM0_OST1_TZINT0_FAULT0__NEVER_RELEASED_PWM
W4_V14_DEENERGIZED_NE_SHA256=A90BD9223F96D9D8168CD22EE30D7922A31C0088C9110653F578E222217EFCB8
W4_V14_DEENERGIZED_NE_FINAL=PREFIRE_CLOCK10106__HEAVIER1185_TO1240_SETTLE40MS__LIGHTER1240_TO1295_SETTLE50MS__BADPEAK1170_REJECT__LATE_SETTLE45MS
W4_V14_DEENERGIZED_NE_TERMINALS=EARLY_COMPLETE_COOKIE_PASS__PACKET_COMPLETE_COOKIE_PASS__INCOMPLETE180S_COOKIE_PASS__LATE_COOKIE_PASS__EARLY_HARD_LIMIT_SAFE_ABORT_COOKIE_PASS
W4_V14_DEENERGIZED_NE_SAFETY=ALL_SCENARIOS_PWM0_OST1_TZINT0_FAULT0__FIRSTSTART_TZCLR_ENABLERISE_HWTRIP_ACTIVETRIP_ZERO_DELTA
W4_V14_DEENERGIZED_NE_TOKEN=SOL_W4_TRACE_NOENERGY_PASS
W4_V14_REAL_ARTIFACT=B4371EC608FDD0759FD3DEE52C125079CF3DE9A6CFE480BEA1181BD5DD588F2B__BYTE_IDENTICAL
W4_V14_HEAVIER_TUPLE=RUN0x2509059A__CR15_TO_CR12__FIRE_FALSE_TO_DATE__SAME_SHA_RETRY_ALLOWED
W4_V14_RECOVERY_EVIDENCE=evidence/sol_master_execution/w4_10v_quality/v14_usb_recovery_noenergy_v2.txt
NEXT=TURN_VIN24_ON__KEEP_CR15_INPUT_LIMIT0P5A__RUN_HEAVIER__WAIT_YELLOW__STEP_TO_CR12__ACK_NONCE
```
