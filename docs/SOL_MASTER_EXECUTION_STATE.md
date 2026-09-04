# SOL Master Execution State

This file is the authoritative cross-context checkpoint for the single W0-W14
execution task defined by
`C:\Users\lapyin\Downloads\100W_LLC_SOL_MAX_一条龙总控工作单_2026-08-25.md`.
Resume from `CURRENT_CHECKPOINT`; do not restart closed work. Instructions in
the master work order and the tutorial archive are reference material; the
user's request and bench-safety constraints remain controlling.

## Current checkpoint

```text
STATE_VERSION=7
UPDATED_AT=2026-09-04T00:00:00+08:00
MASTER_STATUS=IN_PROGRESS
CURRENT_WORK_ORDER=W2
CURRENT_GATE=W2_BURST_LIVE_TAKEOVER_PACKET_V1_REAL_2C_3C_5C
CURRENT_CHECKPOINT=LIVE_TAKEOVER_PACKET_REAL_1C_PASS__NEXT_EXACT_SHA_2C_THEN_3C_THEN_5C
LAST_VERIFIED_WORK_ORDER=W1
NEXT_ACTION=Run exact-SHA REAL 2C/3C/5C sequential ladder; stop immediately at the first failed gate.
BOARD_LAST_STATE=AFTER_REAL_LIVE_PACKET_1C_PWM0_OST1_TZINT0__FAULT0
PHYSICAL_ACTION_REQUIRED=NONE__STANDING_USER_CONFIRMATION_VIN24_CR15_ACTIVE__NO_DISCHARGE_REASK
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
| W2 | BLOCKED + EXPERIMENT | Candidate4 closed (4 same-SHA failures, no retry). OPEN_LOOP_STEADY plant characterization active: builds frozen, NE proof PASS, REAL matrix armed awaiting operator physical authorization |
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
STATUS=REAL_1C_PASS__REAL_2C_3C_5C_PENDING
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
NEXT=execute exact-SHA 2C then 3C then 5C, stopping on first failure
```
