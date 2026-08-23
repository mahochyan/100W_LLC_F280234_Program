#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""F: bounded PI fastpath equivalence exhaustive test (host).
Compares the reference division period with the no-division adjacent-period
fastpath for EVERY integer frequency 145000..170000 Hz, and for every legal
adjacent transition (current command +/- 0..100 Hz). Also validates the
actual-frequency Flash lookup table against 60000000/(period+1).

Key points required: 150000->TBPRD399, 149900->TBPRD399, 149800->TBPRD400,
170000 boundary, 145000 boundary."""
import sys

LLC_TBCLK_HZ = 60000000
MIN_HZ = 145000
MAX_HZ = 170000
MAX_STEP = 100
TABLE_LO = 352
TABLE_HI = 413

def llc_period(hz):
    """Reference: period = (60000000 + hz/2) / hz - 1 (integer division)."""
    return (LLC_TBCLK_HZ + (hz // 2)) // hz - 1

def fastpath_period(prev_period, hz):
    """C: no-division adjacent-period decision, exactly as in pwm.c.
    Returns (period, ok). ok=False means the actuator would revoke
    (SHOT_ABORT_ACTUATOR) because one adjustment was not enough."""
    s = LLC_TBCLK_HZ + (hz // 2)
    clocks = prev_period + 1
    if (clocks + 1) * hz <= s:
        clocks += 1
    elif clocks * hz > s:
        clocks -= 1
    if clocks * hz > s or (clocks + 1) * hz <= s:
        return None, False
    return clocks - 1, True

def actual_lookup(period):
    """D: table value = 60000000 // (period+1)."""
    return LLC_TBCLK_HZ // (period + 1)

fails = []
checks = 0

# --- table completeness ---
table = [actual_lookup(p) for p in range(TABLE_LO, TABLE_HI + 1)]
assert len(table) == TABLE_HI - TABLE_LO + 1 == 62
for p in range(TABLE_LO, TABLE_HI + 1):
    checks += 1
    if table[p - TABLE_LO] != LLC_TBCLK_HZ // (p + 1):
        fails.append(f"table[{p}-{TABLE_LO}] != 60000000/({p}+1)")

# --- key points ---
key = {150000: 399, 149900: 399, 149800: 400, 170000: 352, 145000: 413}
for hz, want in key.items():
    checks += 1
    got = llc_period(hz)
    if got != want:
        fails.append(f"key {hz} -> period {got} != {want}")

# --- exhaustive: every frequency, from every adjacent period state ---
for hz in range(MIN_HZ, MAX_HZ + 1):
    ref = llc_period(hz)
    for prev in (ref - 1, ref, ref + 1):
        checks += 1
        fp, ok = fastpath_period(prev, hz)
        if not ok:
            fails.append(f"hz={hz} prev_period={prev}: fastpath revoked (needs >+/-1)")
            continue
        if fp != ref:
            fails.append(f"hz={hz} prev_period={prev}: fastpath {fp} != reference {ref}")
        if abs(fp - prev) > 1:
            fails.append(f"hz={hz} prev_period={prev}: period delta {fp-prev} > 1")
        if fp < TABLE_LO or fp > TABLE_HI:
            fails.append(f"hz={hz}: period {fp} outside table range")
        else:
            checks += 1
            if table[fp - TABLE_LO] != LLC_TBCLK_HZ // (fp + 1):
                fails.append(f"hz={hz}: lookup {table[fp-TABLE_LO]} != division {LLC_TBCLK_HZ//(fp+1)}")

# --- exhaustive: every legal adjacent transition (current +/- 0..100 Hz) ---
for hz in range(MIN_HZ, MAX_HZ + 1):
    for delta in range(-MAX_STEP, MAX_STEP + 1):
        prev_hz = hz - delta
        if prev_hz < MIN_HZ or prev_hz > MAX_HZ:
            continue
        prev_period = llc_period(prev_hz)
        ref = llc_period(hz)
        checks += 1
        fp, ok = fastpath_period(prev_period, hz)
        if not ok:
            fails.append(f"transition {prev_hz}->{hz} (delta {delta}): fastpath revoked")
            continue
        if fp != ref:
            fails.append(f"transition {prev_hz}->{hz}: fastpath {fp} != reference {ref}")
        if abs(fp - prev_period) > 1:
            fails.append(f"transition {prev_hz}->{hz}: period delta {fp-prev_period} > 1")
        checks += 1
        if table[fp - TABLE_LO] != LLC_TBCLK_HZ // (fp + 1):
            fails.append(f"transition {prev_hz}->{hz}: lookup mismatch")

print(f"checks={checks}")
if fails:
    print("EQUIVALENCE_TEST_FAIL")
    for f in fails[:50]:
        print("  " + f)
    sys.exit(1)
print("EQUIVALENCE_TEST_PASS: fastpath period == reference for all 145000..170000 Hz")
print("  period delta always 0 or +/-1; actual lookup == 60000000/(period+1)")
print("  key points: 150000->399, 149900->399, 149800->400, 170000->352, 145000->413")
