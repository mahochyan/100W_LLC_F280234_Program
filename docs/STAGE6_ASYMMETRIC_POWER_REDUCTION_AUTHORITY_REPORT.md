# STAGE6 Asymmetric Power Reduction Authority Report

Status: **NO REAL POWER EXECUTED — no-power multi-fresh gate not completed**
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

## 5. Multi-fresh negative-error no-power

**NOT COMPLETED**

Attempted to force multiple fresh negative-error samples on the target by
injecting ADC sequence numbers between short run pulses. With the 500 us
Timer2 cage, the host `runAsynch`/`halt` cycle always allowed the full 500 us
to elapse before a second fresh sample could be injected, so every attempt
timed out after the first fresh compute:

```text
attempt 1..8: state=3 abort=1 ok=1 fresh=1 freq=150500
```

This is a host/harness granularity limitation, not a firmware failure.
Because task E requires continuous fresh negative-error trajectory with
multiple period changes before real power, and that gate could not be
demonstrated on target, **real power was not executed**.

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
STAGE6_500US_ASYMMETRIC_AUTHORITY_REAL_FAIL  (not attempted)
FAILED_GATE=MULTIFRESH_NOPOWER_NOT_COMPLETED
BOARD_LEFT_SAFE_PWM0_OST1
NO_RETRY_EXECUTED
STOPPED_AWAITING_REVIEW
```

No real power was executed. No 500us real shot was fired.
