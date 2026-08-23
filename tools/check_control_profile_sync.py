#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
check_control_profile_sync.py
=============================
STAGE6_PI_FIRMWARE_SHADOW_INTEGRATION_V1 - P gate.

Verifies the BALANCED Kp / Ki_step declared in app/control_profile.h match the
validated values in docs/STAGE6_PI_V2_CANDIDATES.csv (allowing float rounding).
If the SIL parameters ever change, this check prevents the firmware silently
running stale numbers.

  PI_PROFILE_SOURCE_SYNC_PASS

OFFLINE ONLY. No real power. LLC_HARDWARE_PI_VALIDATED=0.
"""
import csv
import io
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PROFILE = os.path.join(ROOT, "app", "control_profile.h")
CSV = os.path.join(ROOT, "docs", "STAGE6_PI_V2_CANDIDATES.csv")


def parse_profile():
    kp = ki = pid = vo = hw = None
    with io.open(PROFILE, encoding="utf-8") as f:
        for line in f:
            m = re.search(r"CTRL_PI_KP_HZ_PER_V\s+([\d.eEf]+)", line)
            if m: kp = float(m.group(1).rstrip("f"))
            m = re.search(r"CTRL_PI_KI_STEP_HZ_PER_V_STEP\s+([\d.eEf]+)", line)
            if m: ki = float(m.group(1).rstrip("f"))
            m = re.search(r"CTRL_PI_PROFILE_VIRTUAL_ONLY\s+([01]U?)", line)
            if m: vo = 1 if m.group(1).startswith("1") else 0
            m = re.search(r"CTRL_PI_PROFILE_HARDWARE_VALIDATED\s+([01]U?)", line)
            if m: hw = 1 if m.group(1).startswith("1") else 0
    return kp, ki, vo, hw


def parse_csv():
    with io.open(CSV, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if "BALANCED" in row.get("label", ""):
                return float(row["Kp_hz_per_v"]), float(row["Ki_step_hz_per_v_20us"])
    return None, None


def main():
    out = io.StringIO()
    def w(*a): out.write(" ".join(str(x) for x in a) + "\n")
    hkp, hki, vo, hw = parse_profile()
    ckp, cki = parse_csv()
    w("# PI PROFILE SOURCE SYNC (P)")
    w("control_profile.h : Kp=%.7f Ki_step=%.7f virtual_only=%d hw_validated=%d"
      % (hkp if hkp else -1, hki if hki else -1, vo if vo else 0, hw if hw else 0))
    w("STAGE6_PI_V2_CANDIDATES.csv : Kp=%.7f Ki_step=%.7f" % (ckp if ckp else -1, cki if cki else -1))
    ok = (hkp is not None and hki is not None and ckp is not None and cki is not None
          and abs(hkp - ckp) <= 0.01 and abs(hki - cki) <= 0.01
          and vo == 1 and hw == 0)
    w("PI_PROFILE_SOURCE_SYNC_PASS = %s" % ok)
    w("(float rounding allowed; BALANCED profile is the only runtime profile)")
    text = out.getvalue()
    print(text)
    return ok


if __name__ == "__main__":
    ok = main()
    raise SystemExit(0 if ok else 1)
