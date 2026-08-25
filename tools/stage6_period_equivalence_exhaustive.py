#!/usr/bin/env python3
# STAGE6_WIP_CORRECTION_ISR_PENDING_CLOSURE_V1_1
# Exhaustive equivalence over the REAL control range:
#   old_hz = 145000..170000
#   target_hz = clamp(old_hz-100 .. old_hz+500)
#   current_period = reference_period(old_hz)
TBCLK = 60000000

def ref_period(hz):
    return (TBCLK + hz // 2) // hz - 1

def walk(target, cur_period):
    sumv = TBCLK + target // 2
    clocks = cur_period + 1
    for _ in range(8):
        if (clocks + 1) * target <= sumv:
            clocks += 1
            continue
        if clocks * target > sumv:
            clocks -= 1
            continue
        break
    if clocks * target > sumv or (clocks + 1) * target <= sumv:
        return None
    return clocks - 1

bad = []
checked = 0
for old in range(145000, 170001):
    cur = ref_period(old)
    for delta in range(-100, 501):
        target = max(145000, min(170000, old + delta))
        r = ref_period(target)
        w = walk(target, cur)
        checked += 1
        if w is None or w != r or w < 352 or w > 413:
            bad.append((old, target, cur, r, w))
            if len(bad) >= 10:
                break
    if len(bad) >= 10:
        break
print("PERIOD_FASTPATH_EQUIVALENCE_PASS=" + str(len(bad)==0))
print("checked_real_combinations=" + str(checked))
if bad:
    print("bad_examples=" + str(bad[:10]))
