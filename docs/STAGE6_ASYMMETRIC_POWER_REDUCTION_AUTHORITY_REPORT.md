# STAGE6 Asymmetric Power Reduction Authority Report

Status: **NO REAL POWER EXECUTED — compact on-chip multifresh trajectory/counts PASS, whole-ISR >900 in NOENERGY test build**
Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1-1`
Baseline: `c650201`
Date: 2026-08-25

## 1. Asymmetric slew implementation

Implemented in the bounded-shot candidate only:

```c
CTRL_REDUCE_POWER_MAX_STEP_HZ   = 500   /* +500 Hz/fresh compute, VOUT > Vref */
CTRL_INCREASE_POWER_MAX_STEP_HZ = 100   /* -100 Hz/fresh compute, VOUT < Vref */
```

- Frequency increase (reduce LLC power) allowed up to `+500 Hz / 40us`.
- Frequency decrease (increase LLC power) remains `-100 Hz / 40us`.
- Production/non-bounded path unchanged (still symmetric 100 Hz).

## 2. New 500us asymmetric binaries

```text
REAL OUT    = 0BE17D52D03F3740130B06FC70F287C09883D9F9879625C1B3E9E77C3C4F1EE6
REAL MAP    = D685FE8BCD7DC217A9E22C063732A0B6FD00E313216A48A79F5F0BFD24C0FA5F
NOENERGY OUT= B1E29BF06845C738F8EB6BD3A34376588A8C557519095A414A3BA0BA8412237A
NOENERGY MAP= 3B0B6425E767CE5B37A945AA4CDAE09EF474CA148A24FE4DFA6915597D479D27
```

Build: PASS (CGT 25.11.1.LTS, COFF).

## 3. Offline math verification

`tools/stage6_asymmetric_slew_math.py`:

- 13 x error=-118 from 150000 Hz:
  - trajectory: 150000 → 156500 Hz
  - max single +step: 500 Hz
- Positive error trajectory:
  - max single -step: -100 Hz
- Result: `ASYMMETRIC_SLEW_MATH_PASS`

## 4. Basic no-power timing (single fresh)

PASS with the asymmetric binary, CNT3/CNT4 OPEN:

```text
state=3 abort=1 ok=1 t2d=30940
fresh=1 stale=25 pi=1 apply=1 pw=1 pending=0
PWM=0 OST=1 POST_OST fault=0
ISR max=837 compute=837 apply=759 overrun=0
TIMING_500US_PASS=PASS
```

## 5. On-chip multifresh no-energy trajectory

Implemented `STAGE6_NOENERGY_MODE_ASYMMETRIC_MULTIFRESH = 5` in the NOENERGY
build only. The TINT0 hook auto-advances the ADC sequence and records a
13-point trajectory.

### Negative error (VOUT=1362, error=-118)

```text
150500 → 151000 → ... → 156500 Hz
每步 +500 Hz
trace_count=13
```

### Positive error (VOUT=1126, error=+118)

```text
149900 → 149800 → ... → 148700 Hz
每步 -100 Hz
trace_count=13
```

Both directions are correct. However, the NOENERGY test-build whole-ISR max is:

```text
negative: ISR max = 1057 (>900)
positive: ISR max = 1020 (>900)
```

Because task F requires `ISR max <=900` before real power, and the NOENERGY
test instrumentation/trace path exceeds this budget, **real power was not
executed**.

## 6. Entry interval re-quantification

Firmware fields added:

```c
entry_interval_min_shot
entry_over_1230_count
entry_over_1500_count
entry_over_2400_count
entry_adjacent_max_shot
```

No-power basic run did not show a >1230 interval, so the classification would
be `ADC_ISR_PREEMPTION_JITTER_ONLY` if a short compensated interval is seen in
the real run. The real run was not executed, so this remains pending.

## 7. Compact on-chip multifresh results (this task)

NOENERGY OUT: `DBB43BF3...`

Negative scenario:
- trace exact 150500..156500
- fresh=13, stale=0, pi=13, apply=13, pw=13
- state=COMPLETE, abort=TIMEOUT, t2d=30889
- whole ISR max = 1107 (>900)

Positive scenario:
- trace exact 149900..148700
- fresh=13, stale=0, pi=13, apply=13, pw=13
- state=COMPLETE, abort=TIMEOUT, t2d=30949
- whole ISR max = 1070 (>900)

REAL no-power timing with `3ECDBA30...`:
- PASS, ISR max=847 <=900, t2d=30935

Because the NOENERGY whole-ISR still exceeds 900, real power is not authorized.

## 7. Final output

```text
ONCHIP_MULTIFRESH_COMPACT_NOPOWER_FAIL
FAILED_GATE=NOENERGY_WHOLE_ISR_MAX_GT_900
REAL_POWER_NOT_EXECUTED
BOARD_LEFT_SAFE_PWM0_OST1
STOPPED_AWAITING_REVIEW
```

No real power was executed. No 500us real shot was fired.

## 8. Real 500us asymmetric shot (executed once)

Result: **FAIL — NO_HANDOFF**

- Real OUT: `3ECDBA30685C636E3A28C7EAA695BD21B34CD91DE920D391AB65BE5F5AF74413`
- Conditions: Vin=24V, 0.5A, ~1W load, CNT3/CNT4 connected
- `abort=7 (SHOT_ABORT_NO_HANDOFF)`
- `softstart_complete=6`, `handoff_ok=0`, `power_writes=0`
- No PI window was entered; no frequency trajectory was produced
- Abort telemetry read as zeros (no PI/apply occurred)
- Final state: PWM=0, OST=1, POST_OST, fault=0

Classification: `NO_HANDOFF`

No retry, no reload, no fault clear.

Evidence:
- `evidence/stage6_first_real_pi_shot_real/ASYMMETRIC_REAL_3ECDBA30_RAW.txt`
- `evidence/stage6_first_real_pi_shot_real/ASYMMETRIC_REAL_3ECDBA30_RESULT.json`

## 9. Final output

```text
STAGE6_500US_ASYMMETRIC_AUTHORITY_REAL_FAIL
FAILED_GATE=HANDOFF_OK
ROOT_CAUSE_CLASS=NO_HANDOFF
BOARD_LEFT_SAFE_PWM0_OST1
NO_RETRY_EXECUTED
STOPPED_AWAITING_REVIEW
```

## 10. Real 500us asymmetric shot retry (re-connected)

Result: **FAIL — real-time budget exceeded + pending_valid=1**

- The retry connected successfully and entered the PI window.
- State=COMPLETE, abort=TIMEOUT, ok=1, Timer2 delta=30995.
- VOUT max=1366 <1367, so the asymmetric +500Hz authority **prevented the 11V abort**.
- Frequency rose from 150108 to 155200 Hz (well above old 151300).
- However:
  - ISR max = 947 > 900
  - compute max = 947 > 900
  - pending_valid = 1 (an extra fresh pending was left when the 500us cage fired)
- Entry stats: max=1226 <=1230, adjacent_max=2429 <=2460, over1500=0, over2400=0.

Classification: `REALTIME_BUDGET_AND_PENDING_VALID`

Evidence:
- `evidence/stage6_first_real_pi_shot_real/ASYMMETRIC_REAL_3ECDBA30_RETRY_RAW.txt`
- `evidence/stage6_first_real_pi_shot_real/ASYMMETRIC_REAL_3ECDBA30_RETRY_RESULT.json`

## 11. Final output (retry)

```text
STAGE6_500US_ASYMMETRIC_AUTHORITY_REAL_FAIL
FAILED_GATE_1=ISR_MAX_LE_900
FAILED_GATE_2=COMPUTE_MAX_LE_900
FAILED_GATE_3=PENDING_FINAL_INVALID
ROOT_CAUSE_CLASS=REALTIME_BUDGET_AND_PENDING_VALID
BOARD_LEFT_SAFE_PWM0_OST1
NO_RETRY_EXECUTED
STOPPED_AWAITING_REVIEW
```
