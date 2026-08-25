# STAGE6 Asymmetric Power Reduction Authority Report

Status: **NO REAL POWER EXECUTED — on-chip multifresh trajectory PASS, whole-ISR >900 in NOENERGY test build**
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

## 7. Final output

```text
STAGE6_500US_ASYMMETRIC_AUTHORITY_REAL_NOT_EXECUTED
BLOCKED_GATE=NOENERGY_ISR_MAX_GT_900
NO_REAL_POWER_EXECUTED
BOARD_LEFT_SAFE_PWM0_OST1
STOPPED_AWAITING_REVIEW
```

No real power was executed. No 500us real shot was fired.
