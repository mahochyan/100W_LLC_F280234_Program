#!/usr/bin/env python3
# STAGE6_ASYMMETRIC_POWER_REDUCTION_AUTHORITY_RECOVERY_V1 - offline math check.
import math

Q = 12
ONE = 1 << Q
KP_RAW = 220587
KI_RAW = 1471
BIAS = 150000 * ONE
I_MAX = 60000 * ONE
F_MIN = 145000
F_MAX = 170000
UP = 500   # +Hz allowed when reducing power
DN = 100   # -Hz allowed when increasing power
SIGN = -1  # LLC_CONTROL_SIGN = -1

def clamp_q(v):
    if v > F_MAX * ONE: return F_MAX * ONE
    if v < F_MIN * ONE: return F_MIN * ONE
    return v

def step(freq, err, integ):
    sat_hi = freq >= F_MAX
    sat_lo = freq <= F_MIN
    freeze = (sat_hi and err < 0) or (sat_lo and err > 0)
    if not freeze:
        integ += KI_RAW * err
        if integ > I_MAX: integ = I_MAX
        if integ < -I_MAX: integ = -I_MAX
    p = KP_RAW * err
    unsat = BIAS + SIGN * (p + integ)
    unsat = clamp(unsat)
    base = freq * ONE
    step_q = unsat - base
    if step_q > UP * ONE: step_q = UP * ONE
    if step_q < -DN * ONE: step_q = -DN * ONE
    out = clamp(base + step_q)
    return out // ONE, integ, step_q / ONE

def clamp(v):
    return max(F_MIN * ONE, min(F_MAX * ONE, v))

print("# ASYMMETRIC SLEW MATH")
# Negative error trajectory (VOUT > Vref): frequency should increase.
freq = 150000
integ = 0
max_up = 0
traj = []
for i in range(13):
    err = -118
    freq, integ, st = step(freq, err, integ)
    max_up = max(max_up, st)
    traj.append(freq)
print("13x error=-118 trajectory:", traj)
print("max single +step Hz:", max_up)
print("EXPECT_AFTER_13_150000_TO_155_156500:", traj[-1])
# Positive error (VOUT < Vref): frequency should decrease but only -100 max.
freq = 150000
integ = 0
min_dn = 0
for raw in [10, 20, 40, 80, 118]:
    freq, integ, st = step(freq, raw, integ)
    min_dn = min(min_dn, st)
print("positive error trajectory:", freq)
print("min single -step Hz:", min_dn)
assert max_up <= 500.0 + 1e-9
assert min_dn >= -100.0 - 1e-9
print("ASYMMETRIC_SLEW_MATH_PASS")
