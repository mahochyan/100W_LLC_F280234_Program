#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tools/stage6_fast_path_softfloat_free_check.py

Gate I: assert the FULL production fast control path is soft-float free:
    CTRL_FastTask + CTRL_RunFastControl + CTRL_ComputeFrequencyCommand + CTRL_ApplyFrequencyCommand
No FFC (external call) and no FS$$/UL$$ soft-float helper references anywhere in
their disassembly (the float teaching core CTRL_ComputeFrequencyCommandFloat is
out of scope; telemetry lives in the 5 ms slow task).

Output: FULL_FAST_CONTROL_PATH_SOFTFLOAT_FREE_PASS
"""
import re, subprocess, sys

OBJ = sys.argv[1] if len(sys.argv) > 1 else \
    r"D:\CCS21_workspace\Codex_Project\Stage6_FLASH_NOENERGY\control.obj"
DIS = sys.argv[2] if len(sys.argv) > 2 else \
    r"D:\CCS21\ccs\tools\compiler\ti-cgt-c2000_25.11.1.LTS\bin\dis2000.exe"

out = subprocess.run([DIS, OBJ], capture_output=True, text=True).stdout
lines = out.splitlines()

def section(name):
    idx = None
    for i, l in enumerate(lines):
        if ("_" + name + ":") in l:
            idx = i
            break
    if idx is None:
        return []
    seg = []
    for l in lines[idx + 1:]:
        if l.strip() == "":
            break
        seg.append(l)
    return seg

targets = ["CTRL_FastTask", "CTRL_RunFastControl",
           "CTRL_ComputeFrequencyCommand", "CTRL_ApplyFrequencyCommand"]
tot_ffc = 0
tot_sf = 0
all_ok = True
for name in targets:
    seg = section(name)
    ffc = sum(1 for l in seg if re.search(r"\bFFC\b", l))
    sf = [l.strip() for l in seg if re.search(r"FS\$\$|UL\$\$|FL\$\$|F\$\$|L\$\$", l)]
    tot_ffc += ffc
    tot_sf += len(sf)
    ok = (ffc == 0) and (len(sf) == 0)
    all_ok = all_ok and ok
    print("%-32s lines=%-4d FFC=%d softfloat=%d %s" %
          (name, len(seg), ffc, len(sf), "OK" if ok else "FAIL"))
    for s in sf:
        print("    softfloat: " + s)
print("TOTAL FFC=%d softfloat_refs=%d" % (tot_ffc, tot_sf))
print("FULL_FAST_CONTROL_PATH_SOFTFLOAT_FREE_PASS=" + ("TRUE" if all_ok else "FALSE"))
sys.exit(0 if all_ok else 1)
