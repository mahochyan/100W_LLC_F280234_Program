#!/usr/bin/env python3
# Verify old CMPB == new CMPB for period 352..413
bad=[]
for period in range(352,414):
    old = ((period+1)//2)//2
    new = (period+1)>>2
    if old != new:
        bad.append((period, old, new))
print("CMPB_EQUIVALENCE_PASS="+str(len(bad)==0))
print("checked_periods="+str(len(range(352,414))))
if bad:
    print(bad[:10])
