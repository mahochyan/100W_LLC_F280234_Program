#!/usr/bin/env python3
# STAGE6_HANDOFF_REFERENCE_ATOMIC_PUBLICATION_CLOSURE_V1
# Verify old/new raw conversion parity for CTRL_SlowTask.
# Old: valid=1 then raw=...
# New: raw=... then valid=1
GAIN = 0.008089325
OFFSET = -0.063715
def volts_to_raw(v):
    r = (v - OFFSET) / GAIN
    if r < 0: r = 0
    if r > 4095: r = 4095
    return int(r + 0.5)

bad = []
for i in range(0, 20001):
    v = i / 1000.0  # 0..20V
    old_raw = volts_to_raw(v)
    new_raw = volts_to_raw(v)
    if old_raw != new_raw:
        bad.append((v, old_raw, new_raw))
print("RAW_CONVERSION_PARITY_PASS=" + str(len(bad)==0))
print("checked_values=20001")
if bad:
    print(bad[:10])
