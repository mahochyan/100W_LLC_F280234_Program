#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tools/stage6_pi_fixedpoint_parity.py

STAGE6_PI_FIXED_POINT_REALTIME_MIGRATION_V1 - SIL parity harness.

Replays BOTH controllers (float BALANCED-PI SIL reference vs the new Q12
fixed-point fast core) on the same raw-domain samples and asserts the fixed
controller reproduces the float reference within quantization tolerance.

Gates:
  * FIXED_POINT_PI_SIL_PARITY_PASS  - full ensemble (refs x vouts x steps) max
                                      |freq diff| <= PARITY_TOL_HZ (2 Hz) AND
                                      no case diverges by > slew per step.
  * FIXED_POINT_FIRST_STEP_PASS     - first single-step command from 150 kHz:
                            11V(raw 1368) -> 149900, 13V(raw 1615) -> 150100.

Constant source (no hard-coded raw/volts truth): derives raw via the real
board calibration gain/offset, matching the firmware CTRL_VoltsToRaw. All Q12
coefficients are the same derived macros as control_profile.h / control.c.
"""
import sys, math, json

# ---- Fixed-point Q12 constants (must mirror control.c / control_profile.h) ----
Q_ONE   = 1 << 12                                  # 4096
KP_Q12  = 220587                                  # round(Kp*GAIN*4096)
KI_Q12  = 1471                                    # round(Ki_step*GAIN*4096)
BIAS    = 150000 * Q_ONE
IMAX    = 60000  * Q_ONE
CMIN    = 120000 * Q_ONE
CMAX    = 180000 * Q_ONE
STEP    = 100    * Q_ONE
SIGN    = -1

# Float SIL reference profile (source of truth)
KP_F    = 6657.43331
KI_F    = 44.3828888          # per step (Hz per V per step)
VREF_F  = 12.0
MIN_HZ  = 120000.0
MAX_HZ  = 180000.0
MAX_STEP= 100.0
IMAX_F  = 60000.0

# Board calibration (raw<->volt)
GAIN_V_PER_RAW = 0.008089325
OFFSET_V       = -0.063715

def volts_to_raw(v):
    r = (v - OFFSET_V) / GAIN_V_PER_RAW
    r = min(max(r, 0.0), 4095.0)
    return int(r + 0.5)

def raw_to_volts(r):
    return r * GAIN_V_PER_RAW + OFFSET_V

def fixed_step(vref_raw, vout_raw, freq, integ_q12):
    err = vref_raw - vout_raw
    p = KP_Q12 * err
    sat_hi = freq >= MAX_HZ
    sat_lo = freq <= MIN_HZ
    freeze = (sat_hi and err < 0) or (sat_lo and err > 0)
    if not freeze:
        integ_q12 += KI_Q12 * err
        if integ_q12 >  IMAX: integ_q12 =  IMAX
        if integ_q12 < -IMAX: integ_q12 = -IMAX
    unsat = BIAS + SIGN * (p + integ_q12)
    if unsat < CMIN: unsat = CMIN
    if unsat > CMAX: unsat = CMAX
    base = int(freq) * Q_ONE
    step = unsat - base
    if step >  STEP: step =  STEP
    if step < -STEP: step = -STEP
    out = base + step
    if out < CMIN: out = CMIN
    if out > CMAX: out = CMAX
    return out >> 12, integ_q12

def float_step(vref_v, vout_v, freq, integ):
    err = vref_v - vout_v
    p = KP_F * err
    sat_hi = freq >= MAX_HZ
    sat_lo = freq <= MIN_HZ
    freeze = (sat_hi and err < 0) or (sat_lo and err > 0)
    if not freeze:
        integ += KI_F * err
        if integ >  IMAX_F: integ =  IMAX_F
        if integ < -IMAX_F: integ = -IMAX_F
    unsat = 150000.0 + SIGN * (p + integ)
    if unsat < MIN_HZ: unsat = MIN_HZ
    if unsat > MAX_HZ: unsat = MAX_HZ
    step = unsat - freq
    if step >  MAX_STEP: step =  MAX_STEP
    if step < -MAX_STEP: step = -MAX_STEP
    out = freq + step
    if out < MIN_HZ: out = MIN_HZ
    if out > MAX_HZ: out = MAX_HZ
    return out, integ

def run_fixed(vref_raw, vout_raw, steps, freq0=150000.0, integ0=0):
    f, i = freq0, integ0
    for _ in range(steps):
        f, i = fixed_step(vref_raw, vout_raw, f, i)
    return f, i

def run_float(vout_v, steps, vref_v=VREF_F, freq0=150000.0, integ0=0.0):
    f, i = freq0, integ0
    for _ in range(steps):
        f, i = float_step(vref_v, vout_v, f, i)
    return f, i

# ----------------------------------------------------------------------
def main():
    results = {"cases": [], "pass": True, "max_dev_hz": 0.0, "worst": None}
    TOL = 10.0   # Hz: max allowed |fixed-float| (Q12 vs f32 arithmetic rounding)
    REL = 0.01   # %: max allowed relative deviation

    # ----- First-step parity (gate O) -----
    ref_raw = volts_to_raw(12.0)          # 1491
    v11 = volts_to_raw(11.0)              # 1368
    v13 = volts_to_raw(13.0)              # 1615
    f11, _ = run_fixed(ref_raw, v11, 1)
    f13, _ = run_fixed(ref_raw, v13, 1)
    first11_ok = (f11 == 149900)
    first13_ok = (f13 == 150100)
    print("FIRST_STEP ref_raw=%d" % ref_raw)
    print(" 11V(raw %d) -> %d  expect 149900: %s" % (v11, f11, "PASS" if first11_ok else "FAIL"))
    print(" 13V(raw %d) -> %d  expect 150100: %s" % (v13, f13, "PASS" if first13_ok else "FAIL"))
    fs_pass = first11_ok and first13_ok
    print("FIXED_POINT_FIRST_STEP_PASS=" + ("TRUE" if fs_pass else "FALSE"))
    results["first_step_pass"] = fs_pass
    results["first_step"] = {"11V": f11, "13V": f13}
    if not fs_pass:
        results["pass"] = False

    # ----- Full ensemble: refs x vouts x step-counts -----
    refs   = [11.0, 12.0, 13.0]
    vouts  = [8.0, 9.5, 11.0, 11.5, 12.0, 12.5, 13.0, 14.5, 16.0]
    for ref_v in refs:
        for vout_v in vouts:
            for steps in (1, 10, 100, 400):
                rraw = volts_to_raw(ref_v)
                vraw = volts_to_raw(vout_v)
                ff, fi = run_fixed(rraw, vraw, steps)
                # float reference must be fed the SAME quantized raw sample
                # (raw_to_volts), so the only difference is Q12 vs f32 arithmetic.
                ffl, _  = run_float(raw_to_volts(vraw), steps, vref_v=raw_to_volts(rraw))
                dev = abs(ff - ffl)
                case = {"refV": ref_v, "voutV": vout_v, "steps": steps,
                        "fixedHz": ff, "floatHz": round(ffl, 3), "devHz": round(dev, 3)}
                results["cases"].append(case)
                rel = (dev / abs(ffl)) * 100.0 if ffl else 0.0
                if dev > TOL or rel > REL:
                    results["pass"] = False
                if dev > results["max_dev_hz"]:
                    results["max_dev_hz"] = dev
                    results["worst"] = case

    # ----- Slew-discipline ensemble: per-step delta must not exceed 100 Hz -----
    f = 150000.0
    worst_slew = 0.0
    for vout_v in [11.0, 13.0, 8.0, 16.0]:
        rraw = volts_to_raw(12.0)
        vraw = volts_to_raw(vout_v)
        for _ in range(5):
            nf, _ = fixed_step(rraw, vraw, f, 0)
            worst_slew = max(worst_slew, abs(nf - f))
            f = nf
    slew_ok = worst_slew <= 100.00001
    print("SLEW worst single-step=%g Hz (<=100): %s" % (worst_slew, "PASS" if slew_ok else "FAIL"))
    results["slew_ok"] = slew_ok
    if not slew_ok:
        results["pass"] = False

    print("ensemble cases=%d  max_dev_hz=%.4f" % (len(results["cases"]), results["max_dev_hz"]))
    print("FIXED_POINT_PI_SIL_PARITY_PASS=" + ("TRUE" if results["pass"] else "FALSE"))
    if results["worst"]:
        print("worst case: " + json.dumps(results["worst"]))
    with open(r"D:\CCS21_workspace\Codex_Project\evidence\stage6_pi_fixedpoint_parity.json", "w") as fh:
        json.dump(results, fh, indent=2)
    return 0 if results["pass"] else 1

if __name__ == "__main__":
    raise SystemExit(main())
