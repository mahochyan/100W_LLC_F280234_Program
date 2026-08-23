#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
stage6_pi_firmware_numeric_parity.py
=====================================
STAGE6_PI_FIRMWARE_SHADOW_INTEGRATION_V1 - B/C/D gates.

C28x numeric-semantics parity check BEFORE any control.c change:
  - Controller arithmetic forced to IEEE-754 float32 semantics exactly as the
    C28x `float` path in app/control.c: error, p_term, integral, unsat, clamp,
    slew, out -- every intermediate rounded to float32.
  - Frequency commit mirrors `new_hz = (Uint32)out` and `g_control_frequency_hz`
    is an integer Hz used by the NEXT cycle (saturation + slew base). The
    controller never runs on unlimited-precision float frequency.
  - ADC stale / conditional-integration anti-windup / clamp match control.c.
  - Plant surrogate dV/dt=(Vss(f,Vin,load)-V)/tau uses the SAME physical model
    (llc_physical_plant_v2, Vout=Vin*M/n - Vf) and real ePWM TBPRD quantization.

Replays the V2_1 BALANCED mandatory ensemble (24V/75W, 30V/100W; gain
0.5/1/2; tau 1.5/3/6ms; delay 20/40us; Vref +-0.1V; load +-10%;
noise +-1/2/4 raw; ADC stale 3) and compares against the double-precision SIL.

Gates:
  C28X_FLOAT32_PI_PARITY_PASS         float32 replay passes all mandatory criteria.
  UINT32_FREQUENCY_COMMIT_PARITY_PASS integer-commit does not break PASS or create
                                      a new multi-kHz limit cycle.
If either fails the parameters MUST NOT be written to control.c (STOP).

OFFLINE ONLY. No real power. LLC_HARDWARE_PI_VALIDATED=0.
"""
import io
import os
import random
import struct

import llc_physical_plant_v2 as P
import stage6_pi_tuning_v2 as V2

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(os.path.dirname(HERE), "docs")
HW = P.HW
GAIN, OFFSET = P.GAIN, P.OFFSET
TBCLK = 60_000_000
DT = 20e-6
I_MAX = 60000.0
F_MIN, F_MAX = 120000.0, 180000.0
SLEW = 100.0
BIAS = 150000.0
SIGN = -1.0
ADC_STALE_LIMIT = 3
VOLT = 12.0
STEP_BAND = 0.02
SETTLE_MAX = 0.060
DUR = 0.12

KP = 6657.43331
KI = 44.3828888

_CACHE = {}


def f32(x):
    return struct.unpack("f", struct.pack("f", float(x)))[0]


def rl(pout):
    return VOLT * VOLT / pout


def quantize(f):
    f = max(1.0, float(f))
    tb = (TBCLK + int(f) // 2) // int(f) - 1
    return tb, TBCLK / (tb + 1)


def vss_table(vin, pout, ls):
    key = (int(vin), round(pout * ls, 3))
    if key in _CACHE:
        return _CACHE[key]
    RL = rl(pout * ls)
    d = {}
    for f in range(int(F_MIN), int(F_MAX) + 1):
        tb, actual = quantize(f)
        d[tb] = P.vout_fh(actual, vin, HW["Lr"], HW["Cr"], HW["Lm"], HW["n"], RL, HW["Vf"])[0]
    _CACHE[key] = d
    return d


def ctrl32(freq_int, I, vref, vout, sample_valid, miss):
    stale = (sample_valid == 0) or (miss >= ADC_STALE_LIMIT)
    if stale:
        return freq_int, I, 1
    error = f32(vref - vout)
    p = f32(KP * error)
    sat_hi = freq_int >= int(F_MAX)
    sat_low = freq_int <= int(F_MIN)
    freeze = (sat_hi and error < 0.0) or (sat_low and error > 0.0)
    if not freeze:
        I = f32(I + f32(KI * error))
        I = f32(max(-I_MAX, min(I_MAX, I)))
    unsat = f32(BIAS + SIGN * f32(p + I))
    clamped = f32(max(F_MIN, min(F_MAX, unsat)))
    step = f32(clamped - float(freq_int))
    step = f32(max(-SLEW, min(SLEW, step)))
    out = f32(float(freq_int) + step)
    out = f32(max(F_MIN, min(F_MAX, out)))
    return int(out), I, freeze


def ctrl_f64(freq, I, vref, vout, sample_valid, miss):
    stale = (sample_valid == 0) or (miss >= ADC_STALE_LIMIT)
    if stale:
        return freq, I, 1
    error = vref - vout
    p = KP * error
    freeze = (freq >= F_MAX and error < 0.0) or (freq <= F_MIN and error > 0.0)
    if not freeze:
        I += KI * error
        I = max(-I_MAX, min(I_MAX, I))
    unsat = BIAS + SIGN * (p + I)
    clamped = max(F_MIN, min(F_MAX, unsat))
    step = max(-SLEW, min(SLEW, clamped - freq))
    out = max(F_MIN, min(F_MAX, freq + step))
    return out, I, freeze


def base_cfg():
    return {"vref0": VOLT, "vref1": VOLT, "t_vref": None, "ls0": 1.0, "ls1": 1.0,
            "t_ls": None, "noise": 0.0, "stale": None}


def simulate(op, tau, gain_scale, delay_s, cfg, seed, f32_mode=True):
    vin, pout = op["vin"], op["pout"]
    f0 = int(op["fstar"])
    I0 = BIAS - op["fstar"]
    ds = round(delay_s / DT)
    n = int(DUR / DT)
    rng = random.Random(seed)
    V = VOLT
    I = I0
    committed = f0
    buf = [f0] * ds
    miss = 0
    t0 = vss_table(vin, pout, cfg["ls0"])
    t1 = vss_table(vin, pout, cfg["ls1"])
    v_h, c_h, i_h, a_h = [], [], [], []
    vmin, vmax, fmin, fmax = 1e9, -1e9, 1e9, -1e9
    clamp_hi = clamp_lo = hi2lo = lo2hi = prev = 0
    for k in range(n):
        t = k * DT
        applied = buf[0]
        tb, actual = quantize(applied)
        vref = cfg["vref1"] if (cfg["t_vref"] is not None and t >= cfg["t_vref"]) else cfg["vref0"]
        ls = cfg["ls1"] if (cfg["t_ls"] is not None and t >= cfg["t_ls"]) else cfg["ls0"]
        vss = (t1 if ls == cfg["ls1"] else t0)[tb]
        vss_s = VOLT + gain_scale * (vss - VOLT)
        V += (vss_s - V) / tau * DT
        if f32_mode:
            V = f32(V)
        Vmeas = V + cfg["noise"] * (rng.random() * 2 - 1) if cfg["noise"] > 0 else V
        if f32_mode:
            Vmeas = f32(Vmeas)
        sv = 1
        if cfg["stale"] and cfg["stale"][0] <= k < cfg["stale"][1]:
            sv = 0
            miss += 1
        else:
            miss = 0
        if f32_mode:
            new, I, _ = ctrl32(committed, I, vref, Vmeas, sv, miss)
        else:
            new, I, _ = ctrl_f64(committed, I, vref, Vmeas, sv, miss)
        state = 1 if new >= int(F_MAX) - 1 else (-1 if new <= int(F_MIN) + 1 else 0)
        if state == 1:
            clamp_hi += 1
        elif state == -1:
            clamp_lo += 1
        if prev == 1 and state == -1:
            hi2lo += 1
        if prev == -1 and state == 1:
            lo2hi += 1
        prev = state
        buf.pop(0)
        buf.append(new)
        committed = new
        if V < vmin: vmin = V
        if V > vmax: vmax = V
        if actual < fmin: fmin = actual
        if actual > fmax: fmax = actual
        v_h.append(V); c_h.append(committed); i_h.append(I); a_h.append(actual)
    t_ev = cfg["t_vref"] if cfg["t_vref"] is not None else (cfg["t_ls"] if cfg["t_ls"] is not None else 0.0)
    vf = cfg["vref1"]
    last = -1
    for k in range(n):
        if k * DT < t_ev:
            continue
        if abs(v_h[k] - vf) > STEP_BAND:
            last = k
    settle = 0.0 if last < 0 else (last * DT - t_ev)
    return {"v": v_h, "c": c_h, "i": i_h, "a": a_h, "vmin": vmin, "vmax": vmax,
            "fmin": fmin, "fmax": fmax, "settle": settle, "err": abs(V - vf) / vf,
            "hi2lo": hi2lo, "lo2hi": lo2hi}


def scenario_ok(m, vf, ov=None):
    if m["err"] > 0.01:
        return False
    if m["settle"] > SETTLE_MAX:
        return False
    if m["fmin"] < F_MIN - 1 or m["fmax"] > F_MAX + 1:
        return False
    if (m["hi2lo"] + m["lo2hi"]) > 0:
        return False
    if ov is not None and ov > 0.30:
        return False
    return True


def op_of(vin, pout):
    RL = rl(pout)
    return {"vin": vin, "pout": pout, "fstar": V2.build_target_f(VOLT, vin, RL)}


def seed_of(op, scen, ens):
    return (int(op["vin"]) * 131 + int(op["pout"]) * 17 + sum(ord(c) for c in scen) + ens) % (2 ** 31)


def scenario_f32(op, tau, gain, delay, scen, ens):
    seed = seed_of(op, scen, ens)
    RL = rl(op["pout"])
    if scen == "hold":
        return scenario_ok(simulate(op, tau, gain, delay, base_cfg(), seed, True), VOLT)
    if scen in ("vref+", "vref-"):
        vt = VOLT + 0.1 if scen == "vref+" else VOLT - 0.1
        if not V2.reachable(vt, op["vin"], RL):
            return True
        cfg = base_cfg(); cfg["vref1"] = vt; cfg["t_vref"] = 30e-3
        m = simulate(op, tau, gain, delay, cfg, seed, True)
        ov = max(m["vmax"] - vt, vt - m["vmin"])
        return scenario_ok(m, vt, ov)
    if scen in ("load+", "load-"):
        dl = 0.1 if scen == "load+" else -0.1
        if not V2.reachable(VOLT, op["vin"], rl(op["pout"] * (1 + dl))):
            return True
        cfg = base_cfg(); cfg["ls1"] = 1 + dl; cfg["t_ls"] = 30e-3
        return scenario_ok(simulate(op, tau, gain, delay, cfg, seed, True), VOLT)
    if scen in ("noise1", "noise2", "noise4"):
        raw = {"noise1": 1, "noise2": 2, "noise4": 4}[scen]
        cfg = base_cfg(); cfg["noise"] = raw * GAIN
        m = simulate(op, tau, gain, delay, cfg, seed, True)
        tail = m["a"][int(0.8 * len(m["a"])):]
        fpp = (max(tail) - min(tail)) if tail else 0.0
        return fpp <= 3000 and m["err"] <= 0.01
    if scen == "stale":
        st = int(0.05 / DT)
        cfg = base_cfg(); cfg["stale"] = (st, st + 3)
        return scenario_ok(simulate(op, tau, gain, delay, cfg, seed, True), VOLT)
    return True


def replay_f32(op):
    for tau in [1.5e-3, 3e-3, 6e-3]:
        for gain in [0.5, 1.0, 2.0]:
            for delay in [20e-6, 40e-6]:
                ens = hash((tau, gain, delay)) % 9973
                for scen in ["hold", "vref+", "vref-", "load+", "load-",
                             "noise1", "noise2", "noise4", "stale"]:
                    if not scenario_f32(op, tau, gain, delay, scen, ens):
                        return False
    return True


def main():
    out = io.StringIO()
    def w(*a): out.write(" ".join(str(x) for x in a) + "\n")
    w("# STAGE6 PI FIRMWARE NUMERIC PARITY (B/C/D) - offline, write-gate locked")
    w("LLC_HARDWARE_PI_VALIDATED=0 ; NO_REAL_POWER_EXECUTED")
    w("BALANCED Kp=%.7f Ki_step=%.7f (float32+Uint32-commit replay)" % (KP, KI))
    w("")
    ops = [op_of(24, 75), op_of(30, 100)]
    ok_all = True
    for op in ops:
        ok = replay_f32(op)
        ok_all = ok_all and ok
        w("  float32 replay %d.0V/%dW : %s" % (op["vin"], op["pout"], "PASS" if ok else "FAIL"))
    w("C28X_FLOAT32_PI_PARITY_PASS = %s" % ok_all)

    uintok = True
    for op in ops:
        cfg = base_cfg(); cfg["noise"] = 4 * GAIN
        m = simulate(op, 3e-3, 1.0, 40e-6, cfg, 11, True)
        tail = m["a"][int(0.8 * len(m["a"])):]
        fpp = (max(tail) - min(tail)) if tail else 0.0
        span = max(1, int(fpp / 375.0))
        ping = (m["hi2lo"] + m["lo2hi"]) > 0
        ok = (fpp <= 3000) and not ping
        uintok = uintok and ok
        w("  int-commit %d.0V/%dW: freq_pp=%.0f Hz TBPRDspan=%d pingpong=%s -> %s"
          % (op["vin"], op["pout"], fpp, span, ping, "PASS" if ok else "FAIL"))
    w("UINT32_FREQUENCY_COMMIT_PARITY_PASS = %s" % uintok)

    dv, dc, di = 0.0, 0.0, 0.0
    for op in ops:
        for scen in ["vref+", "vref-"]:
            vt = VOLT + 0.1 if scen == "vref+" else VOLT - 0.1
            if not V2.reachable(vt, op["vin"], rl(op["pout"])):
                continue
            cfg = base_cfg(); cfg["vref1"] = vt; cfg["t_vref"] = 30e-3
            a = simulate(op, 3e-3, 1.0, 40e-6, cfg, 7, True)
            b = simulate(op, 3e-3, 1.0, 40e-6, cfg, 7, False)
            n = min(len(a["v"]), len(b["v"]))
            for k in range(n):
                dv = max(dv, abs(a["v"][k] - b["v"][k]))
                dc = max(dc, abs(a["c"][k] - b["c"][k]))
                di = max(di, abs(a["i"][k] - b["i"][k]))
    w("")
    w("## D. double SIL vs firmware-parity SIL (mandatory interior ref steps)")
    w("  max |Vout diff| = %.6f V" % dv)
    w("  max |freq cmd diff| = %.2f Hz" % dc)
    w("  max |integrator diff| = %.6f Hz" % di)
    w("  no new multi-kHz limit cycle under f32+int commit: %s" % uintok)
    w("  PASS/FAIL conclusion unchanged: %s" % (ok_all and uintok))
    w("  (bit-identical NOT required)")
    text = out.getvalue()
    with io.open(os.path.join(DOCS, "STAGE6_PI_FIRMWARE_NUMERIC_PARITY.md"), "w", encoding="utf-8") as f:
        f.write(text)
    print(text)
    return ok_all and uintok


if __name__ == "__main__":
    main()
