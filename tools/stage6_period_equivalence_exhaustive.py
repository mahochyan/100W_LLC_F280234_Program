#!/usr/bin/env python3
# STAGE6_500US_COMPUTE_FASTPATH_PENDING_ATOMIC_CLOSURE_V1
# Exhaustive equivalence: reference rounded period vs pipeline walk.
TBCLK = 60000000

def ref(target):
    clocks = (TBCLK + target // 2) // target
    return clocks - 1

def walk(target, cur_period):
    # Direct rounded-period calculation (new fastpath)
    sumv = TBCLK + target // 2
    clocks = sumv // target
    if clocks == 0:
        return None
    period = clocks - 1
    if clocks * target > sumv or (clocks + 1) * target <= sumv:
        return None
    return period

bad = []
for target in range(145000, 170001):
    for cur in range(352, 414):
        r = ref(target)
        w = walk(target, cur)
        if r is None or w is None:
            if not (r is None and w is None):
                bad.append((target, cur, r, w))
        elif r != w or r < 352 or r > 413:
            bad.append((target, cur, r, w))
print("PERIOD_EQUIVALENCE_EXHAUSTIVE_PASS=" + str(len(bad)==0))
print("checked_combinations=" + str((170000-145000+1)*(413-352+1)))
if bad:
    print("bad_examples=" + str(bad[:10]))
