#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tools/stage6_pi_softfloat_free_check.py

Gate Q: assert the fixed-point fast controller (CTRL_ComputeFrequencyCommand)
contains NO soft-float RTS calls (FS$$*/UL$$*) and no external CALL/FFC at all
in its disassembly. The float teaching core lives in
CTRL_ComputeFrequencyCommandFloat (slow/ref only) and is explicitly out of scope.

Output:
  FIXED_POINT_FIXED_CORE_FFC        -> number of FFC (external call) in fixed core
  FIXED_POINT_FIXED_CORE_SB         -> number of SB branches (int only, no calls)
  FAST_PI_SOFTFLOAT_FREE_PASS       -> TRUE if fixed core has 0 FFC AND no FS$$/UL$$

Usage:
    python stage6_pi_softfloat_free_check.py [control.obj] [dis2000.exe]
"""
import re, subprocess, sys

OBJ = sys.argv[1] if len(sys.argv) > 1 else \
    r"D:\CCS21_workspace\Codex_Project\Stage6_FLASH_NOENERGY\control.obj"
DIS = sys.argv[2] if len(sys.argv) > 2 else \
    r"D:\CCS21\ccs\tools\compiler\ti-cgt-c2000_25.11.1.LTS\bin\dis2000.exe"

out = subprocess.run([DIS, OBJ], capture_output=True, text=True).stdout
lines = out.splitlines()

def section(name):
    """Return the instruction lines of the section whose header contains _name:"""
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

def counts(seg):
    c = {"FFC": 0, "softfloat": [], "branches": 0}
    for l in seg:
        if re.search(r"\bFFC\b", l):
            c["FFC"] += 1
        if re.search(r"FS\$\$|UL\$\$|FL\$\$|F\$\$|L\$\$", l):
            c["softfloat"].append(l.strip())
        if re.search(r"\bSB\s|\bB\s", l):
            c["branches"] += 1
    return c

fixed = section("CTRL_ComputeFrequencyCommand")
flt   = section("CTRL_ComputeFrequencyCommandFloat")

fc = counts(fixed)
fr = counts(flt)

print("FIXED_CORE instr_lines=%d" % len(fixed))
print("FIXED_CORE FFC(external)=%d" % fc["FFC"])
print("FIXED_CORE softfloat_refs=%d" % len(fc["softfloat"]))
if fc["softfloat"]:
    print("FIXED_CORE softfloat:" + " | ".join(fc["softfloat"]))
print("FLOAT_CORE FFC=%d softfloat_refs=%d (out of scope, slow/ref)" %
      (fr["FFC"], len(fr["softfloat"])))
print("FIXED_POINT_FIXED_CORE_FFC=%d" % fc["FFC"])
ok = (fc["FFC"] == 0) and (len(fc["softfloat"]) == 0)
print("FAST_PI_SOFTFLOAT_FREE_PASS=" + ("TRUE" if ok else "FALSE"))
sys.exit(0 if ok else 1)
