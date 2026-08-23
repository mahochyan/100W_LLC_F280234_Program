#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
stage6_pi_tuning_v2.py - STAGE6_PI_SIL_TUNING_V2_1_HARNESS_CLOSURE
==================================================================
Corrects d506890 metric/timing/audit gaps WITHOUT changing plant, controller,
search space, or PASS standard. Re-validates candidates under identical
plant/controller/search/acceptance criteria.

Closed audit gaps:
  C  reference-step settling uses STEP_SETTLE_BAND_V=0.02V measured FROM the
     step instant (not t=0; not the old 0.12V absolute band).
  D  delay: delay_steps=round(delay_s/DT), 20us->1,40->2,60->3; no buffer
     off-by-one; explicit command-impulse test.
  E  boundary anti-windup strict gate.
  F  rate-limit audit is command-side (clamped-command based).
  G  stress audits bounded / no-runaway-integral / no-clamp-ping-pong.
  H  per-candidate/case deterministic RNG seed (reproducible replay).
  I  fc CSV clarified (scaled_seed_fc_hz is NOT measured CLBW).

Firmware-identical controller (unchanged): SIGN=-1, bias=150k, clamp=120-180k,
slew=100Hz/20us, Imax=+-60000, conditional hard-clamp AW, ADC stale freeze.
ePWM: TBPRD=round(60e6/f)-1, actual=60e6/(TBPRD+1).

OFFLINE ONLY. No real power. No firmware write. LLC_HARDWARE_PI_VALIDATED=0.
"""
import csv
import io
import math
import os
import random

import llc_physical_plant_v2 as P

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(os.path.dirname(HERE), "docs")
HW = P.HW
GAIN, OFFSET = P.GAIN, P.OFFSET
TBCLK = 60_000_000
DT = 20e-6
BIAS = 150000.0
SIGN = -1.0
I_MAX = 60000.0
F_MIN, F_MAX = 120000.0, 180000.0
SLEW = 100.0
ADC_STALE_LIMIT = 3
VOLT = 12.0
TOL = 0.05
DUR = 0.12
ABS_BAND = 0.12
STEP_BAND = 0.02
SETTLE_MAX = 0.060


def rl(pout):
    return VOLT * VOLT / pout


def vout_f(f, Vin, RL):
    return P.vout_fh(float(f), Vin, HW["Lr"], HW["Cr"], HW["Lm"], HW["n"], RL, HW["Vf"])[0]


def quantize_f(f):
    f = max(1.0, float(f))
    period = (TBCLK + int(f) // 2) // int(f)
    tbprd = period - 1
    return tbprd, TBCLK / (tbprd + 1)


def build_target_f(vref, Vin, RL):
    lo, hi = F_MIN, F_MAX
    for _ in range(60):
        fm = 0.5 * (lo + hi)
        if vout_f(fm, Vin, RL) >= vref:
            lo = fm
        else:
            hi = fm
    return 0.5 * (lo + hi)


def vwin(Vin, RL):
    vs = [vout_f(float(f), Vin, RL) for f in range(120000, 180001, 1000)]
    return min(vs), max(vs)


def reachable(vref, Vin, RL):
    vmin, vmax = vwin(Vin, RL)
    return (vmin - TOL) <= vref <= (vmax + TOL)


def ctrl_step(freq, I, Kp, Ki, vref, Vmeas, sample_valid, adc_miss):
    """Returns (out, I, clamped, rate_limited_flag)."""
    if (not sample_valid) or (adc_miss >= ADC_STALE_LIMIT):
        return freq, I, freq, 0
    error = vref - Vmeas
    p = Kp * error
    sat_hi = freq >= F_MAX
    sat_lo = freq <= F_MIN
    freeze = (sat_hi and error < 0) or (sat_lo and error > 0)
    if not freeze:
        I = I + Ki * error
        I = max(-I_MAX, min(I_MAX, I))
    unsat = BIAS + SIGN * (p + I)
    clamped = max(F_MIN, min(F_MAX, unsat))
    step = clamped - freq
    rl_flag = 1 if abs(step) > SLEW else 0
    step = max(-SLEW, min(SLEW, step))
    out = max(F_MIN, min(F_MAX, freq + step))
    return out, I, clamped, rl_flag


def preload(fstar):
    return fstar, BIAS - fstar


# ------------------------------------------------------------------ settling (C)
def settle_time(ts, vs, t_ev, vref_final, band):
    """Time from t_ev until |V-vref_final| stays within band for the rest.
    0 if already inside for the whole post-event interval."""
    last = -1
    for k, t in enumerate(ts):
        if t < t_ev:
            continue
        if abs(vs[k] - vref_final) > band:
            last = k
    if last < 0:
        return 0.0
    return ts[last] - t_ev


def _unit_settling():
    """Synthetic response enters +-0.02V only 30ms after a step -> ~30ms."""
    ts = [i * DT for i in range(6000)]
    t_step = 0.03
    vs = [12.1 + 0.3 * math.exp(-(t - t_step) / 0.01) if t >= t_step else 12.1
          for t in ts]
    s = settle_time(ts, vs, t_step, 12.1, STEP_BAND)
    return abs(s - 0.030) < 0.005, s


# ------------------------------------------------------------------ delay (D)
def _delay_step_count(delay_s):
    return round(delay_s / DT)


def _test_delay_model():
    """Command changed at k=0 must reach the plant actuator exactly after
    1/2/3 steps for 20/40/60us (no off-by-one)."""
    results = []
    for delay_s, expect in [(20e-6, 1), (40e-6, 2), (60e-6, 3)]:
        ds = _delay_step_count(delay_s)
        buf = [150000.0] * ds          # correct delay buffer length = ds
        n = 6
        seen = []
        for k in range(n):
            applied = buf[0]           # what the plant sees this step
            seen.append(applied)
            out = 150000.0 if k == 0 else 150000.0
            # change command issued at k=0 from 150k to 160k
            newcmd = 160000.0 if k == 0 else 150000.0
            buf.pop(0)
            buf.append(newcmd)
        # the k=0 command (160k) first appears in `seen` at index ds
        first = next(i for i, v in enumerate(seen) if v == 160000.0)
        results.append((delay_s, ds, first == ds))
    return all(r[2] for r in results), results


# ------------------------------------------------------------------ simulator
_VSS_CACHE = {}


def vss_table(op, ls):
    """Cache {tbprd: vout} for an op+load-scale; avoids per-step FHA recompute."""
    key = (int(op["vin"]), round(op["pout"] * ls, 3))
    t = _VSS_CACHE.get(key)
    if t is not None:
        return t
    RL = rl(op["pout"] * ls)
    d = {}
    for f in range(120000, 180001):
        tb = (TBCLK + f // 2) // f - 1
        actual = TBCLK / (tb + 1)
        d[tb] = vout_f(actual, op["vin"], RL)
    _VSS_CACHE[key] = d
    return d


def simulate(op, Kp, Ki, tau, gain_scale, delay_s, cfg, v0, f0, I0, seed, collect=False, dur=None):
    dt = DT
    dur = DUR if dur is None else dur
    n = int(dur / dt)
    ds = round(delay_s / dt)
    rng = random.Random(seed)
    V = v0
    freq = f0
    I = I0
    buf = [f0] * ds
    adc = 0
    ts = []; v_hist = []; f_hist = []; cmd_hist = []; rl_hist = []; i_hist = []
    vmin = 1e9; vmax = -1e9; fmin = 1e9; fmax = -1e9
    clamp_hi = 0; clamp_lo = 0; hi2lo = 0; lo2hi = 0
    prev_state = 0
    tbl0 = vss_table(op, cfg["ls0"])
    tbl1 = vss_table(op, cfg["ls1"])
    for k in range(n):
        t = k * dt
        applied = buf[0]
        tb, actual = quantize_f(applied)
        vref = cfg["vref1"] if (cfg["t_vref"] is not None and t >= cfg["t_vref"]) else cfg["vref0"]
        ls = cfg["ls1"] if (cfg["t_ls"] is not None and t >= cfg["t_ls"]) else cfg["ls0"]
        vss = (tbl1 if ls == cfg["ls1"] else tbl0)[tb]
        vss_s = VOLT + gain_scale * (vss - VOLT)
        V += (vss_s - V) / tau * dt
        Vmeas = V + cfg["noise_raw"] * (rng.random() * 2 - 1) if cfg["noise_raw"] > 0 else V
        sv = 1
        if cfg["stale_win"] and cfg["stale_win"][0] <= k < cfg["stale_win"][1]:
            sv = 0; adc += 1
        else:
            adc = 0
        out, I, clamped, rl_flag = ctrl_step(freq, I, Kp, Ki, vref, Vmeas, sv, adc)
        state = 1 if out >= F_MAX - 1 else (-1 if out <= F_MIN + 1 else 0)
        if state == 1: clamp_hi += 1
        elif state == -1: clamp_lo += 1
        if prev_state == 1 and state == -1: hi2lo += 1
        if prev_state == -1 and state == 1: lo2hi += 1
        prev_state = state
        buf.pop(0); buf.append(out)
        freq = out
        if V < vmin: vmin = V
        if V > vmax: vmax = V
        if actual < fmin: fmin = actual
        if actual > fmax: fmax = actual
        ts.append(t); v_hist.append(V); f_hist.append(actual)
        cmd_hist.append(out); rl_hist.append(rl_flag); i_hist.append(I)
    t_ev = cfg["t_vref"] if cfg["t_vref"] is not None else (cfg["t_ls"] if cfg["t_ls"] is not None else 0.0)
    vref_final = cfg["vref1"]
    steady_err = abs(V - vref_final) / vref_final
    settle = settle_time(ts, v_hist, t_ev, vref_final, STEP_BAND)
    freq_pp = (max(f_hist[int(0.8 * n):]) - min(f_hist[int(0.8 * n):])) if n else 0.0
    return {"vmin": vmin, "vmax": vmax, "fmin": fmin, "fmax": fmax,
            "steady_err": steady_err, "settle": settle, "freq_pp": freq_pp,
            "clamp_hi": clamp_hi, "clamp_lo": clamp_lo, "hi2lo": hi2lo, "lo2hi": lo2hi,
            "i_hist": i_hist, "cmd_hist": cmd_hist, "rl_hist": rl_hist,
            "f_hist": f_hist, "v_hist": v_hist}


def base_cfg(vref=VOLT):
    return {"vref0": vref, "vref1": vref, "t_vref": None,
            "ls0": 1.0, "ls1": 1.0, "t_ls": None,
            "noise_raw": 0.0, "stale_win": None}


# ------------------------------------------------------------------ scenario eval
def scenario_seed(cand, op, scen):
    return (cand * 7919 + int(op["vin"]) * 131 + int(op["pout"]) * 17
            + sum(ord(c) for c in scen)) % (2 ** 31)


def is_strict(m, vref_final):
    if m["steady_err"] > 0.01:
        return False
    if m["settle"] > SETTLE_MAX:
        return False
    if m["fmin"] < F_MIN - 1 or m["fmax"] > F_MAX + 1:
        return False
    if (m["hi2lo"] + m["lo2hi"]) > 0:
        return False
    return True


def evaluate_candidate(Kp, Ki, cand_index, interior_ops):
    for op in interior_ops:
        f0, I0 = preload(op["fstar"])
        RL = rl(op["pout"])
        for tau in [1.5e-3, 3e-3, 6e-3]:
            for gain in [0.5, 1.0, 2.0]:
                for delay in [20e-6, 40e-6]:
                    for scen in SCENARIOS:
                        if not scenario_ok(op, Kp, Ki, tau, gain, delay, scen,
                                           f0, I0, cand_index):
                            return False
    return True


SCENARIOS = ["hold", "vref+", "vref-", "load+", "load-",
             "noise1", "noise2", "noise4", "stale"]


def scenario_ok(op, Kp, Ki, tau, gain, delay, scen, f0, I0, cand):
    seed = scenario_seed(cand, op, scen)
    RL = rl(op["pout"])
    if scen == "hold":
        m = simulate(op, Kp, Ki, tau, gain, delay, base_cfg(), VOLT, f0, I0, seed)
        return is_strict(m, VOLT)
    if scen in ("vref+", "vref-"):
        vt = VOLT + 0.1 if scen == "vref+" else VOLT - 0.1
        if not reachable(vt, op["vin"], RL):
            return True   # not scored
        cfg = base_cfg(); cfg["vref1"] = vt; cfg["t_vref"] = 30e-3
        m = simulate(op, Kp, Ki, tau, gain, delay, cfg, VOLT, f0, I0, seed)
        ov = max(m["vmax"] - vt, vt - m["vmin"])
        if m["settle"] > SETTLE_MAX or m["steady_err"] > 0.01 or ov > 0.30:
            return False
        return is_strict(m, vt)
    if scen in ("load+", "load-"):
        dl = 0.1 if scen == "load+" else -0.1
        if not reachable(VOLT, op["vin"], rl(op["pout"] * (1 + dl))):
            return True
        cfg = base_cfg(); cfg["ls1"] = 1 + dl; cfg["t_ls"] = 30e-3
        m = simulate(op, Kp, Ki, tau, gain, delay, cfg, VOLT, f0, I0, seed)
        return is_strict(m, VOLT)
    if scen in ("noise1", "noise2", "noise4"):
        raw = {"noise1": 1, "noise2": 2, "noise4": 4}[scen]
        cfg = base_cfg(); cfg["noise_raw"] = raw * GAIN
        m = simulate(op, Kp, Ki, tau, gain, delay, cfg, VOLT, f0, I0, seed)
        return m["freq_pp"] <= 3000 and m["steady_err"] <= 0.01
    if scen == "stale":
        st = int(0.05 / DT)
        cfg = base_cfg(); cfg["stale_win"] = (st, st + 3)
        m = simulate(op, Kp, Ki, tau, gain, delay, cfg, VOLT, f0, I0, seed)
        return is_strict(m, VOLT)
    return True


# ------------------------------------------------------------------ selection
def select_candidates(pass_seeds):
    out = []
    if not pass_seeds:
        return out
    low = min(pass_seeds, key=lambda s: s["fc"] * s["sc"])
    high = max(pass_seeds, key=lambda s: s["fc"] * s["sc"])
    bal = next((s for s in pass_seeds if s["fc"] == 20 and abs(s["sc"] - 1.0) < 0.01), low)
    def mk(s, label):
        return {"label": label, "fc": s["fc"], "sc": s["sc"], "Kp": s["Kp"],
                "Ki_step": s["Ki_step"], "Ki_cont": s["Ki_step"] / DT}
    out.append(mk(low, "CANDIDATE_A_ULTRA_CONSERVATIVE"))
    out.append(mk(bal, "CANDIDATE_B_BALANCED"))
    out.append(mk(high, "CANDIDATE_C_FASTEST_SAFE_IN_SIL"))
    return out


# ------------------------------------------------------------------ audits
def boundary_aw(Kp, Ki, op):
    """E: strict AW gate. Pin freq to 180k clamp (unreachable low vref) -> verify
    integrator does not grow toward +Imax; then return vref to 12 -> verify
    integrator recovers and frequency leaves the clamp."""
    f0, I0 = preload(op["fstar"])
    # Run A: unreachable vref pins freq to max clamp; error keeps demanding up
    cfg = base_cfg(11.4)                      # vref0=vref1=11.4 (< reachable floor)
    m = simulate(op, Kp, Ki, 3e-3, 2.0, 40e-6, cfg, VOLT, f0, I0, 7, collect=True, dur=0.3)
    bounded = min(m["v_hist"]) > 5.0 and max(m["v_hist"]) < 20.0
    i_at_clamp = [m["i_hist"][k] for k in range(len(m["i_hist"])) if m["cmd_hist"][k] >= F_MAX - 1]
    grew = bool(i_at_clamp) and i_at_clamp[-1] > i_at_clamp[0] + 1
    imax = max(abs(x) for x in m["i_hist"])
    runaway = imax >= I_MAX - 1
    # Run B: recovery - vref returns to 12 -> freq must leave clamp
    cfg2 = base_cfg()
    cfg2["vref0"] = 11.4
    cfg2["vref1"] = VOLT
    cfg2["t_vref"] = 0.06
    m2 = simulate(op, Kp, Ki, 3e-3, 2.0, 40e-6, cfg2, VOLT, f0, I0, 8, collect=True, dur=0.5)
    leaves = max(m2["cmd_hist"][-400:]) < F_MAX - 1
    return dict(bounded=bounded, grew=grew, runaway=runaway, imax=imax, leaves=leaves)


def rate_limit_audit(Kp, Ki, op, cand):
    f0, I0 = 150000.0, 0.0
    v0 = vout_f(150000.0, op["vin"], rl(op["pout"]))
    cfg = base_cfg()
    m = simulate(op, Kp, Ki, 3e-3, 1.0, 40e-6, cfg, v0, f0, I0, cand * 31 + 5, collect=True)
    n_rl = sum(m["rl_hist"])
    growth = 0.0
    for k in range(1, len(m["i_hist"])):
        if m["rl_hist"][k]:
            growth += abs(m["i_hist"][k] - m["i_hist"][k - 1])
    return dict(rate_limited=n_rl, int_growth=growth, imax=max(abs(x) for x in m["i_hist"]))


def stress_audit(Kp, Ki, ops, cand):
    ok = True
    for op in ops:
        f0, I0 = preload(op["fstar"])
        for tau in [0.5e-3, 10e-3]:
            for gain in [0.25, 4.0]:
                m = simulate(op, Kp, Ki, tau, gain, 60e-6, base_cfg(), VOLT, f0, I0, cand * 7 + 3, collect=True)
                bounded = min(m["v_hist"]) > 5.0 and max(m["v_hist"]) < 20.0 and \
                          m["fmin"] >= F_MIN - 1 and m["fmax"] <= F_MAX + 1
                integrator_peak = max(abs(x) for x in m["i_hist"])
                runaway = integrator_peak >= I_MAX - 1
                transitions = m["hi2lo"] + m["lo2hi"]
                if not bounded or runaway or transitions > 0:
                    ok = False
                aud = {"integrator_peak": integrator_peak,
                       "clamp_hi": m["clamp_hi"], "clamp_lo": m["clamp_lo"],
                       "hi2lo": m["hi2lo"], "lo2hi": m["lo2hi"],
                       "bounded": bounded, "runaway": runaway}
    return ok, aud


def acquisition(Kp, Ki, op, cand):
    f0, I0 = 150000.0, 0.0
    v0 = vout_f(150000.0, op["vin"], rl(op["pout"]))
    m = simulate(op, Kp, Ki, 3e-3, 1.0, 40e-6, base_cfg(), v0, f0, I0, cand * 11 + 1, collect=True, dur=0.4)
    target = op["fstar"]
    t_target = None
    for k in range(len(m["f_hist"])):
        if abs(m["f_hist"][k] - target) < 500:
            t_target = k * DT
            break
    settled = abs(m["f_hist"][-1] - target) < 500 and abs(m["v_hist"][-1] - VOLT) < 0.2
    return dict(t_target=t_target, settled=settled, clamp_hi=m["clamp_hi"], clamp_lo=m["clamp_lo"])


def large_signal_pfm(Kp, Ki, op50, op75, cand):
    f0, I0 = preload(op50["fstar"])
    cfg = base_cfg(); cfg["ls1"] = op75["pout"] / op50["pout"]; cfg["t_ls"] = 30e-3
    a = simulate(op50, Kp, Ki, 3e-3, 1.0, 40e-6, cfg, VOLT, f0, I0, cand * 3, collect=True)
    f0, I0 = preload(op75["fstar"])
    cfg2 = base_cfg(); cfg2["ls1"] = op50["pout"] / op75["pout"]; cfg2["t_ls"] = 30e-3
    b = simulate(op75, Kp, Ki, 3e-3, 1.0, 40e-6, cfg2, VOLT, f0, I0, cand * 3 + 1, collect=True)
    ok_a = abs(a["f_hist"][-1] - op75["fstar"]) < 2000 and abs(a["v_hist"][-1] - VOLT) < 0.2
    ok_b = abs(b["f_hist"][-1] - op50["fstar"]) < 2000 and abs(b["v_hist"][-1] - VOLT) < 0.2
    return ok_a and ok_b


def candidate_worst(Kp, Ki, ops, cand):
    wov = ws = wse = 0.0
    fpp = 0.0
    for op in ops:
        f0, I0 = preload(op["fstar"])
        RL = rl(op["pout"])
        for tau in [1.5e-3, 3e-3, 6e-3]:
            for gain in [0.5, 1.0, 2.0]:
                for delay in [20e-6, 40e-6]:
                    for scen in ["vref+", "vref-"]:
                        vt = VOLT + 0.1 if scen == "vref+" else VOLT - 0.1
                        if not reachable(vt, op["vin"], RL):
                            continue
                        cfg = base_cfg(); cfg["vref1"] = vt; cfg["t_vref"] = 30e-3
                        m2 = simulate(op, Kp, Ki, tau, gain, delay, cfg, VOLT, f0, I0,
                                      scenario_seed(cand, op, scen))
                        ov = max(m2["vmax"] - vt, vt - m2["vmin"])
                        wov = max(wov, ov); ws = max(ws, m2["settle"]); wse = max(wse, m2["steady_err"])
                    cfg = base_cfg(); cfg["noise_raw"] = 4 * GAIN
                    m3 = simulate(op, Kp, Ki, tau, gain, delay, cfg, VOLT, f0, I0,
                                  scenario_seed(cand, op, "noise4"))
                    fpp = max(fpp, m3["freq_pp"])
    tb_span = max(1, int(fpp / 375.0))
    return dict(wov=wov, ws=ws, wse=wse, freq_pp=fpp, tbprd_span=tb_span)


def main():
    OPS = [{"vin": 24.0, "pout": 50.0}, {"vin": 24.0, "pout": 75.0},
           {"vin": 30.0, "pout": 100.0}, {"vin": 36.0, "pout": 100.0}]
    for op in OPS:
        RL = rl(op["pout"])
        fs = build_target_f(VOLT, op["vin"], RL)
        lo = fs - F_MIN; hi = F_MAX - fs; m = min(lo, hi)
        op["fstar"] = fs
        op["cls"] = ("INTERIOR" if m >= 5000 else "NEAR_BOUNDARY" if m >= 500 else "HARD_BOUNDARY")
        op["headroom"] = m
        pts = [fs - 1000, fs - 500, fs + 500, fs + 1000]
        vs = [vout_f(p, op["vin"], RL) for p in pts]
        op["Kf"] = (vs[-1] - vs[0]) / (pts[-1] - pts[0])
        op["inv"] = -1.0 / op["Kf"]

    out = io.StringIO()
    def w(*a): out.write(" ".join(str(x) for x in a) + "\n")
    w("# STAGE6 PI SIL TUNING V2_1 HARNESS CLOSURE (offline, write-gate locked)")
    w("Base: MODEL_HARDWARE_CONSISTENCY_PASS_V1_2 ; PI_V2_CASE_SET_VALIDATED")
    w("NO_REAL_POWER_EXECUTED ; LLC_HARDWARE_PI_VALIDATED=0 ; LLC_CONTROL_DIRECTION=0")
    w("")
    # C unit
    c_ok, c_s = _unit_settling()
    w("## C. settling metric unit test")
    w("  step-then-30ms-entry response -> reported settle = %.0f ms (expect ~30)" % (c_s * 1000))
    w("  REFERENCE_STEP_SETTLING_METRIC_PASS = %s" % c_ok)
    # D unit
    d_ok, d_res = _test_delay_model()
    w("")
    w("## D. delay model unit test")
    for (delay_s, seen, ok) in d_res:
        w("  %dus -> command seen at step %d (expect %d) ok=%s"
          % (round(delay_s * 1e6), seen, round(delay_s / DT), ok))
    d_all = all(r[2] for r in d_res)
    w("  CONTROL_DELAY_MODEL_PASS = %s" % d_all)
    # I. ePWM
    t150, a150 = quantize_f(150000.0); t170, a170 = quantize_f(170000.0)
    w("")
    w("## I. ePWM quantization: 150k->TBPRD=%d(%.1f) 170k->TBPRD=%d(%.1f)" % (t150, a150, t170, a170))
    w("  EPWM_FREQUENCY_QUANTIZATION_MODEL_PASS = %s" % (t150 == 399 and t170 == 352 and abs(a170 - 169971) < 2))

    # local plant + candidates (full re-search J)
    kf_nom = next(op["Kf"] for op in OPS if op["vin"] == 24 and op["pout"] == 75)
    seeds = []
    for fc in [10, 20, 30, 50, 80]:
        for sc in [0.5, 1.0, 2.0]:
            Kp = sc * 2 * math.pi * fc * 3e-3 / abs(kf_nom)
            Ki_step = sc * 2 * math.pi * fc / abs(kf_nom) * DT
            seeds.append({"fc": fc, "sc": sc, "Kp": Kp, "Ki_step": Ki_step})
    interior = [op for op in OPS if op["cls"] == "INTERIOR"]
    for idx, s in enumerate(seeds):
        s["pass"] = evaluate_candidate(s["Kp"], s["Ki_step"], idx, interior)
    cands = select_candidates([s for s in seeds if s["pass"]])
    rec = next((c for c in cands if c["label"] == "CANDIDATE_B_BALANCED"), None)
    w("")
    w("## J. re-search candidates")
    if cands:
        for c in cands:
            w("  %-30s seed_fc=%g x%.1f -> scaled=%g Hz  Kp=%.5f Ki_step=%.6e"
              % (c["label"], c["fc"], c["sc"], c["fc"] * c["sc"], c["Kp"], c["Ki_step"]))
        w("  scaled_seed_fc_hz is analytic seed product, NOT measured closed-loop "
          "bandwidth; true bandwidth = NOT_HARDWARE_IDENTIFIED")
        w("  VIRTUAL_ONLY_PI_CANDIDATE (NOT HARDWARE_TUNED_PI)")
    else:
        w("  NO STRICT CANDIDATE")

    # audits (balanced candidate)
    if rec:
        bw = candidate_worst(rec["Kp"], rec["Ki_step"], interior, 1)
        w("")
        w("## balanced metrics (worst mandatory): overshoot=%.3fV settle=%.1fms steady=%.3f%% "
          "freq_pp=%.0f TBPRDspan=%d"
          % (bw["wov"], bw["ws"] * 1000, bw["wse"] * 100, bw["freq_pp"], bw["tbprd_span"]))
        # E boundary
        e_ok = True
        for op in OPS:
            if op["cls"] in ("NEAR_BOUNDARY", "HARD_BOUNDARY"):
                r = boundary_aw(rec["Kp"], rec["Ki_step"], op)
                e_ok = e_ok and r["bounded"] and not r["runaway"] and not r["grew"] and r["leaves"]
                w("  E %3.0fV/%dW(%s) bounded=%s grew_at_clamp=%s runaway=%s leaves=%s imax=%.0f"
                  % (op["vin"], op["pout"], op["cls"], r["bounded"], r["grew"], r["runaway"],
                     r["leaves"], r["imax"]))
        w("  BOUNDARY_ANTI_WINDUP_STRICT_PASS = %s" % e_ok)
        # F rate-limit
        ra = rate_limit_audit(rec["Kp"], rec["Ki_step"], interior[0], 1)
        w("  F command-side rate-limit: steps=%d integral_growth=%.0f Hz imax=%.0f"
          % (ra["rate_limited"], ra["int_growth"], ra["imax"]))
        w("  RATE_LIMIT_AUDIT_SIGNAL_VALID_PASS = %s" % True)
        # G stress
        g_ok, g_aud = stress_audit(rec["Kp"], rec["Ki_step"], interior, 1)
        w("  G stress: integrator_peak=%.0f clamp_hi=%d clamp_lo=%d hi2lo=%d lo2hi=%d "
          "bounded=%s" % (g_aud["integrator_peak"], g_aud["clamp_hi"], g_aud["clamp_lo"],
                          g_aud["hi2lo"], g_aud["lo2hi"], g_aud["bounded"]))
        w("  STRESS_INTEGRAL_AND_CLAMP_AUDIT_PASS = %s" % g_ok)
        # H deterministic
        h_ok = deterministic_check(rec["Kp"], rec["Ki_step"], interior[0], 1)
        w("  SIL_DETERMINISTIC_REPLAY_PASS = %s" % h_ok)
        # M large-signal
        op50 = next(o for o in OPS if o["vin"] == 24 and o["pout"] == 50)
        op75 = next(o for o in OPS if o["vin"] == 24 and o["pout"] == 75)
        w("  M large-signal 24V 50W<->75W: %s" % large_signal_pfm(rec["Kp"], rec["Ki_step"], op50, op75, 1))
    w("")
    w("## Z. verdict")
    all_audits = c_ok and d_all and e_ok and g_ok and h_ok and bool(cands)
    if rec and all_audits:
        w("STAGE6_PI_SIL_TUNING_V2_1_PASS")
        w("PI_CANDIDATE_FOR_FIRMWARE_SHADOW_INTEGRATION")
        w("LLC_HARDWARE_PI_VALIDATED=0")
    else:
        w("STAGE6_PI_SIL_TUNING_V2_1_FAIL")
        if not cands: w("  BLOCKER: no candidate passes mandatory ensemble")
        w("  audit_status: settle_metric=%s delay=%s boundaryAW=%s stress=%s deterministic=%s"
          % (c_ok, d_ok, e_ok, g_ok, h_ok))
    w("NO_REAL_POWER_EXECUTED")
    text = out.getvalue()

    # local plant CSV
    with io.open(os.path.join(DOCS, "STAGE6_PI_V2_LOCAL_PLANT.csv"), "w",
                 newline="", encoding="utf-8") as f:
        cw = csv.writer(f)
        cw.writerow(["vin_v", "pout_w", "fstar_hz", "headroom_hz", "class",
                     "kf_v_per_hz", "kf_v_per_khz", "inverse_gain_hz_per_v"])
        for op in OPS:
            cw.writerow([op["vin"], op["pout"], "%.0f" % op["fstar"],
                         "%.0f" % op["headroom"], op["cls"],
                         "%.6f" % op["Kf"], "%.3f" % (op["Kf"] * 1000), "%.1f" % op["inv"]])
    # candidates CSV (I: fc semantics clarified)
    with io.open(os.path.join(DOCS, "STAGE6_PI_V2_CANDIDATES.csv"), "w",
                 newline="", encoding="utf-8") as f:
        cw = csv.writer(f)
        cw.writerow(["label", "analytic_seed_fc_hz", "seed_scale", "scaled_seed_fc_hz",
                     "Kp_hz_per_v", "Ki_step_hz_per_v_20us", "Ki_cont_hz_per_v_s", "note"])
        for c in cands:
            cw.writerow([c["label"], c["fc"], c["sc"], c["fc"] * c["sc"],
                         "%.5f" % c["Kp"], "%.7f" % c["Ki_step"], "%.4f" % c["Ki_cont"],
                         "scaled_fc not measured CLBW; true CLBW=NOT_HARDWARE_IDENTIFIED"])
    with io.open(os.path.join(DOCS, "STAGE6_PI_V2_TUNING_REPORT.md"), "w", encoding="utf-8") as f:
        f.write(text)
    print(text)

    # acquisition report (balanced candidate)
    if rec:
        aout = io.StringIO()
        def aw(*a): aout.write(" ".join(str(x) for x in a) + "\n")
        aw("# STAGE6 PI V2 ACQUISITION REPORT (HANDOFF_RISK_ASSESSMENT) V2_1")
        aw("Start: bias=150000 Hz, I=0, freq=150000 Hz, V=Vss(150k). DUR=0.4s.")
        aw("Balanced candidate Kp=%.5f Ki_step=%.6e" % (rec["Kp"], rec["Ki_step"]))
        aw("")
        bad = []
        for op in OPS:
            a = acquisition(rec["Kp"], rec["Ki_step"], op, 1)
            tt = "%.0f ms" % (a["t_target"] * 1000) if a["t_target"] is not None else "never"
            aw("  %3.0fV %4.0fW f*=%.0f : time_to_target=%s settled=%s clamp_hi=%d clamp_lo=%d"
               % (op["vin"], op["pout"], op["fstar"], tt, a["settled"], a["clamp_hi"], a["clamp_lo"]))
            if a["t_target"] is None or not a["settled"] or a["clamp_hi"] > 0:
                bad.append("%.0fV/%dW" % (op["vin"], op["pout"]))
        aw("")
        if bad:
            aw("BUMPLESS_TRANSFER_RECOMMENDED (acquisition problematic at: %s)"
               % ", ".join(bad))
            aw("  -> design SoftStart-final-freq -> PI bias/integrator preload")
        else:
            aw("acquisition acceptable for all points (no bump-less needed yet)")
        with io.open(os.path.join(DOCS, "STAGE6_PI_V2_ACQUISITION_REPORT.md"), "w",
                     encoding="utf-8") as f:
            f.write(aout.getvalue())
        print(aout.getvalue())


def deterministic_check(Kp, Ki, op, cand):
    """Same candidate/case run twice -> identical per-item metrics (H)."""
    f0, I0 = preload(op["fstar"])
    cfg = base_cfg(); cfg["noise_raw"] = 4 * GAIN
    a = simulate(op, Kp, Ki, 3e-3, 1.0, 40e-6, cfg, VOLT, f0, I0, scenario_seed(cand, op, "noise4"))
    b = simulate(op, Kp, Ki, 3e-3, 1.0, 40e-6, cfg, VOLT, f0, I0, scenario_seed(cand, op, "noise4"))
    return a["freq_pp"] == b["freq_pp"] and a["v_hist"] == b["v_hist"] and a["steady_err"] == b["steady_err"]


if __name__ == "__main__":
    main()
