#!/usr/bin/env python3
# check_control_fixed_profile_sync.py
# STAGE6_PI_FIXED_POINT_REALTIME_MIGRATION_V1 (E)
# Derives KP_RAW_Q12 / KI_RAW_Q12 from the single source of truth
#   app/control_profile.h   (Kp, Ki_step)
#   app/board_calibration.h (GAIN_V_PER_RAW)
# and compares against the firmware macros (CTRL_PI_KP_RAW_Q12 / KI_RAW_Q12)
# so calibration/Kp changes can never silently leave stale fixed-point ints.
# Output: FIXED_POINT_PROFILE_SOURCE_SYNC_PASS
import re, os, sys

ROOT = os.path.normpath(os.path.dirname(os.path.abspath(__file__)) + "/..")
PROFILE = os.path.join(ROOT, "app", "control_profile.h")
CALIB   = os.path.join(ROOT, "app", "board_calibration.h")
CONTROL = os.path.join(ROOT, "app", "control.c")

def read(path):
    with open(path, "r", encoding="latin-1") as f:
        return f.read()

def float_def(text, name):
    m = re.search(r"^\s*#define\s+" + re.escape(name) + r"\s+([-+0-9.]+)f?\s*$",
                  text, re.MULTILINE)
    if not m:
        raise SystemExit("MISSING float macro %s" % name)
    return float(m.group(1))

def int_def(text, name):
    m = re.search(r"^\s*#define\s+" + re.escape(name) + r"\s+([0-9]+)[UL]*\s*",
                  text, re.MULTILINE)
    return int(m.group(1)) if m else None

Q_SHIFT = 12
Q_ONE   = 1 << Q_SHIFT

profile = read(PROFILE)
calib   = read(CALIB)
control = read(CONTROL)

Kp      = float_def(profile, "CTRL_PI_KP_HZ_PER_V")
Ki_step = float_def(profile, "CTRL_PI_KI_STEP_HZ_PER_V_STEP")
GAIN    = float_def(calib,   "BOARD_VOUT_GAIN_V_PER_RAW")

Kp_raw = Kp * GAIN
Ki_raw = Ki_step * GAIN
KP_EXP = int(round(Kp_raw * Q_ONE))
KI_EXP = int(round(Ki_raw * Q_ONE))

KP_MAC = int_def(profile, "CTRL_PI_KP_RAW_Q12")
KI_MAC = int_def(profile, "CTRL_PI_KI_RAW_Q12")
if KP_MAC is None: KP_MAC = int_def(control, "CTRL_PI_KP_RAW_Q12")
if KI_MAC is None: KI_MAC = int_def(control, "CTRL_PI_KI_RAW_Q12")

print("== STAGE6 fixed-point profile source sync ==")
print("  Kp(Hz/V)              = %.6f" % Kp)
print("  Ki_step(Hz/(V*20us))  = %.8f" % Ki_step)
print("  GAIN(V/raw)           = %.9f" % GAIN)
print("  Kp_raw = Kp*GAIN      = %.8f" % Kp_raw)
print("  Ki_raw = Ki*GAIN      = %.8f" % Ki_raw)
print("  Q_SHIFT               = %d (Q_ONE=%d)" % (Q_SHIFT, Q_ONE))
print("  KP_RAW_Q12 expected   = %d" % KP_EXP)
print("  KI_RAW_Q12 expected   = %d" % KI_EXP)
print("  firmware KP_RAW_Q12   = %s" % KP_MAC)
print("  firmware KI_RAW_Q12   = %s" % KI_MAC)

ok = (KP_MAC is not None and KP_MAC == KP_EXP and
      KI_MAC is not None and KI_MAC == KI_EXP)
print("  => %s" % ("FIXED_POINT_PROFILE_SOURCE_SYNC_PASS" if ok
                   else "FIXED_POINT_PROFILE_SOURCE_SYNC_FAIL"))
sys.exit(0 if ok else 1)
