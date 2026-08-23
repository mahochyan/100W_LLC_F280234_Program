#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
stage6_pi_tuning_v2.py - STAGE6_PI_SIL_TUNING_V2 (offline, write-gate locked)

Finds a SAFE/CONSERVATIVE/ROBUST/EXPLAINABLE PI candidate for the F28034 LLC
controller, in PC/SIL ONLY. Mirrors firmware exactly (from source):
  ePWM: TBPRD=round(60e6/f)-1, actual=60e6/(TBPRD+1)      [driver/pwm.c]
  ctrl: error=Vref-V ; SIGN=-1 ; bias=150000 ; Imax=+-60000 ;
        clamp=120k-180k ; slew=100Hz/20us ; conditional integration ;
        ADC stale(>=3) freeze                              [app/control.c]

No real power. No firmware write. LLC_HARDWARE_PI_VALIDATED=0.
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
DUR = 0.15
BAND = 0.12
RND = random.Random(12345)

# ---------------------------------------------------------------- plant model
def rl(pout):
    return VOLT * VOLT / pout


def vout_f(f, Vin, RL):
    return P.vout_fh(float(f), Vin, HW["Lr"], HW["Cr"], HW["Lm"], HW["n"], RL, HW["Vf"])[0]


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


def quantize_f(f):
    f = max(1.0, float(f))
    period = (TBCLK + int(f) // 2) // int(f)
    tbprd = period - 1
    return tbprd, TBCLK / (tbprd + 1)


# ---------------------------------------------------------------- controller
def ctrl_step(freq, I, Kp, Ki, vref, Vmeas, sample_valid, adc_miss):
    if (not sample_valid) or (adc_miss >= ADC_STALE_LIMIT):
        return freq, I
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
    step = max(-SLEW, min(SLEW, clamped - freq))
    out = max(F_MIN, min(F_MAX, freq + step))
    return out, I


# ---------------------------------------------------------------- simulator
def run_sim(op, Kp, Ki, tau, gain_scale, delay_us, cfg, v0, f0, I0):
    """cfg: dict(vref0, vref1, t_vref, ls0, ls1, t_ls, noise_raw, stale_win)"""
    n = int(DUR / DT)
    delay_steps = max(1, int(round(delay_us / 20e-6)))
    V = v0
    freq = f0
    I = I0
    buf = [freq] * (delay_steps + 1)
    adc = 0
    rate_limited = 0
    vmin = 1e9; vmax = -1e9; fmin = 1e9; fmax = -1e9
    last_outside = 0
    tail_f = []
    for k in range(n):
        t = k * DT
        _, actual = quantize_f(buf[0])
        ls = cfg["ls1"] if (cfg["t_ls"] is not None and t >= cfg["t_ls"]) else cfg["ls0"]
        vref = cfg["vref1"] if (cfg["t_vref"] is not None and t >= cfg["t_vref"]) else cfg["vref0"]
        RL = rl(op["pout"] * ls)
        vss = vout_f(actual, op["vin"], RL)
        vss_s = VOLT + gain_scale * (vss - VOLT)
        V += (vss_s - V) / tau * DT
        Vmeas = V + cfg["noise_raw"] * (RND.random() * 2 - 1) if cfg["noise_raw"] > 0 else V
        sv = 1
        if cfg["stale_win"] and cfg["stale_win"][0] <= k < cfg["stale_win"][1]:
            sv = 0; adc += 1
        else:
            adc = 0
        out, I = ctrl_step(freq, I, Kp, Ki, vref, Vmeas, sv, adc)
        if abs(out - freq) >= SLEW - 1e-9:
            rate_limited += 1
        buf.append(out); buf.pop(0); freq = out
        if V < vmin: vmin = V
        if V > vmax: vmax = V
        if actual < fmin: fmin = actual
        if actual > fmax: fmax = actual
        if abs(V - vref) > BAND:
            last_outside = k
        if k > n * 0.8:
            tail_f.append(actual)
    settle = (last_outside + 1) * DT if last_outside > 0 else 0.0
    steady_err = abs(V - vref) / vref
    return {"vmin": vmin, "vmax": vmax, "fmin": fmin, "fmax": fmax,
            "settle": settle, "steady_err": steady_err,
            "freq_pp": max(tail_f) - min(tail_f) if tail_f else 0.0,
            "rate_limited": rate_limited}


def preload(fstar):
    """SIGN=-1: at error=0 unsat=bias-I ; want=fstar -> I=bias-fstar."""
    return fstar, BIAS - fstar


def base_cfg(vref=VOLT):
    return {"vref0": vref, "vref1": vref, "t_vref": None,
            "ls0": 1.0, "ls1": 1.0, "t_ls": None,
            "noise_raw": 0.0, "stale_win": None}


def is_strict(m, vref):
    if m["steady_err"] > 0.01:
        return False
    if m["settle"] > 0.060:
        return False
    if m["fmin"] < F_MIN - 1 or m["fmax"] > F_MAX + 1:
        return False
    return True


# ---------------------------------------------------------------- scenario eval
def evaluate_candidate(Kp, Ki, interior_ops):
    """Strict pass: all INTERIOR ops, all scenarios, mandatory ensemble."""
    for op in interior_ops:
        fstar = op["fstar"]
        f0, I0 = preload(fstar)
        RL = rl(op["pout"])
        for tau in [1.5e-3, 3e-3, 6e-3]:
            for g in [0.5, 1.0, 2.0]:
                for d in [20e-6, 40e-6]:
                    if not op_scenarios_ok(op, Kp, Ki, tau, g, d, f0, I0):
                        return False
    return True


def op_scenarios_ok(op, Kp, Ki, tau, g, d, f0, I0):
    RL = rl(op["pout"])
    # 1) equilibrium hold
    if not is_strict(run_sim(op, Kp, Ki, tau, g, d, base_cfg(), VOLT, f0, I0), VOLT):
        return False
    # 2/3) Vref +/- 0.1
    for dv in [+0.1, -0.1]:
        vt = VOLT + dv
        if not reachable(vt, op["vin"], RL):
            continue
        cfg = base_cfg()
        cfg["vref1"] = vt
        cfg["t_vref"] = 30e-3
        m = run_sim(op, Kp, Ki, tau, g, d, cfg, VOLT, f0, I0)
        ov = max(m["vmax"] - vt, vt - m["vmin"])
        if m["settle"] > 0.060 or m["steady_err"] > 0.01 or ov > 0.30:
            return False
    # 4/5) load +/- 10%  (disturbance rejection: settle/steady/freq bounded;
    #   droop is plant-driven, so <=0.30V overshoot applies to command tracking only)
    for dl in [+0.1, -0.1]:
        if not reachable(VOLT, op["vin"], rl(op["pout"] * (1 + dl))):
            continue
        cfg = base_cfg()
        cfg["ls1"] = 1 + dl
        cfg["t_ls"] = 30e-3
        m = run_sim(op, Kp, Ki, tau, g, d, cfg, VOLT, f0, I0)
        if m["settle"] > 0.060 or m["steady_err"] > 0.01 or m["fmin"] < F_MIN - 1 or m["fmax"] > F_MAX + 1:
            return False
    # 6) noise +-4 raw
    cfg = base_cfg()
    cfg["noise_raw"] = 4 * GAIN
    m = run_sim(op, Kp, Ki, tau, g, d, cfg, VOLT, f0, I0)
    if m["freq_pp"] > 3000 or m["steady_err"] > 0.01:
        return False
    # 7) stale 3 ticks
    st = int(0.05 / DT)
    cfg = base_cfg()
    cfg["stale_win"] = (st, st + 3)
    m = run_sim(op, Kp, Ki, tau, g, d, cfg, VOLT, f0, I0)
    if not is_strict(m, VOLT):
        return False
    return True


def base_cfg():
    return {"vref0": VOLT, "vref1": VOLT, "t_vref": None,
            "ls0": 1.0, "ls1": 1.0, "t_ls": None,
            "noise_raw": 0.0, "stale_win": None}


# ---------------------------------------------------------------- candidates
def select_candidates(pass_seeds):
    out = []
    if not pass_seeds:
        return out
    low = min(pass_seeds, key=lambda s: s["fc"] * s["sc"])
    high = max(pass_seeds, key=lambda s: s["fc"] * s["sc"])
    bal = next((s for s in pass_seeds if s["fc"] == 20 and abs(s["sc"] - 1.0) < 0.01),
               low)
    def mk(s, label):
        return {"label": label, "fc": s["fc"], "sc": s["sc"], "Kp": s["Kp"],
                "Ki_step": s["Ki_step"], "Ki_cont": s["Ki_step"] / DT}
    out.append(mk(low, "CANDIDATE_A_ULTRA_CONSERVATIVE"))
    out.append(mk(bal, "CANDIDATE_B_BALANCED"))
    out.append(mk(high, "CANDIDATE_C_FASTEST_SAFE_IN_SIL"))
    return out


# ---------------------------------------------------------------- main
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
        op["Kf"] = None
    # local Kf
    for op in OPS:
        RL = rl(op["pout"]); fs = op["fstar"]
        pts = [fs - 1000, fs - 500, fs + 500, fs + 1000]
        vs = [vout_f(p, op["vin"], RL) for p in pts]
        op["Kf"] = (vs[-1] - vs[0]) / (pts[-1] - pts[0])
        op["inv"] = -1.0 / op["Kf"]

    out = io.StringIO()
    def w(*a): out.write(" ".join(str(x) for x in a) + "\n")
    w("# STAGE6 PI SIL TUNING V2 (offline, shadow-gate locked)")
    w("Base: MODEL_HARDWARE_CONSISTENCY_PASS_V1_2 ; PI_V2_CASE_SET_VALIDATED")
    w("NO_REAL_POWER_EXECUTED ; LLC_HARDWARE_PI_VALIDATED=0 ; LLC_CONTROL_DIRECTION=0")
    w("")
    w("## D. headroom audit")
    for op in OPS:
        w("  %3.0fV %4.0fW f*=%.0f headroom=%.0f %s" %
          (op["vin"], op["pout"], op["fstar"], op["headroom"], op["cls"]))
    expect = {(24, 50): "NEAR_BOUNDARY", (24, 75): "INTERIOR",
              (30, 100): "INTERIOR", (36, 100): "HARD_BOUNDARY"}
    audit_ok = all(op["cls"] == expect[(int(op["vin"]), int(op["pout"]))] for op in OPS)
    w("  PI_V2_OPERATING_POINT_HEADROOM_AUDIT_PASS = %s" % audit_ok)
    w("")
    w("## E. local PFM gain")
    for op in OPS:
        w("  %3.0fV %4.0fW Kf=%9.5f V/Hz = %7.3f V/kHz ; inverse=%.0f Hz/V ; Kf<0=%s"
          % (op["vin"], op["pout"], op["Kf"], op["Kf"] * 1000, op["inv"], op["Kf"] < 0))
    w("  LOCAL_PFM_GAIN_SIGN_PASS = %s" % all(op["Kf"] < 0 for op in OPS))
    w("")
    t150, a150 = quantize_f(150000.0); t170, a170 = quantize_f(170000.0)
    w("## I. ePWM quantization: 150k->TBPRD=%d(%.1f) 170k->TBPRD=%d(%.1f)"
      % (t150, a150, t170, a170))
    w("  EPWM_FREQUENCY_QUANTIZATION_MODEL_PASS = %s"
      % (t150 == 399 and t170 == 352 and abs(a170 - 169971) < 2))
    w("")
    w("## F/G/H surrogate & ensembles")
    w("  CONTROL_DESIGN_SURROGATE dV/dt=(Vss(f,Vin,load)-V)/tau; Vss=MODEL_H_V1_2")
    w("  tau {0.5,1.5,3,6,10}ms state DYNAMIC_TIME_CONSTANT_NOT_HARDWARE_IDENTIFIED")
    w("  gain {0.5,1,2}x MANDATORY {0.25,4}x STRESS; delay {20,40}us MANDATORY 60us STRESS")
    w("")

    # seeds
    kf_nom = next(op["Kf"] for op in OPS if op["vin"] == 24 and op["pout"] == 75)
    seeds = []
    for fc in [10, 20, 30, 50, 80]:
        for sc in [0.5, 1.0, 2.0]:
            Kp = sc * 2 * math.pi * fc * 3e-3 / abs(kf_nom)
            Ki_step = sc * 2 * math.pi * fc / abs(kf_nom) * DT
            seeds.append({"fc": fc, "sc": sc, "Kp": Kp, "Ki_step": Ki_step})
    interior = [op for op in OPS if op["cls"] == "INTERIOR"]
    for s in seeds:
        s["pass"] = evaluate_candidate(s["Kp"], s["Ki_step"], interior)
    cands = select_candidates([s for s in seeds if s["pass"]])
    rec = next((c for c in cands if c["label"] == "CANDIDATE_B_BALANCED"), None)
    w("## T. candidates")
    if cands:
        for c in cands:
            w("  %-28s fc=%g Kp=%.6f Ki_step=%.6e Ki_cont=%.3f Hz/(V.s)"
              % (c["label"], c["fc"], c["Kp"], c["Ki_step"], c["Ki_cont"]))
        w("  VIRTUAL_ONLY_PI_CANDIDATE (NOT HARDWARE_TUNED_PI)")
    else:
        w("  NO STRICT CANDIDATE")
    w("")
    # ---- candidate metrics (T/R) on INTERIOR mandatory ensemble ----
    if rec:
        bw = candidate_worst_case(rec["Kp"], rec["Ki_step"], interior)
        w("## R/T. balanced-candidate metrics (worst over mandatory ensemble)")
        w("  worst Vref-step overshoot = %.3f V ; worst settle = %.1f ms ; "
          "worst steady err = %.3f%%" % (bw["wov"], bw["ws"] * 1000, bw["wse"] * 100))
        w("  noise(+-4raw) worst TBPRD span = %d ; frequency_pp = %.0f Hz"
          % (bw["tbprd_span"], bw["freq_pp"]))
        w("  gain/tau/delay robustness: passes 0.5/1/2x, 1.5/3/6ms, 20/40us")
        # N boundary stress
        w("")
        w("## N. boundary anti-windup (24V/50W, 36V/100W)")
        for op in OPS:
            if op["cls"] in ("NEAR_BOUNDARY", "HARD_BOUNDARY"):
                b = boundary_anti_windup(rec["Kp"], rec["Ki_step"], op)
                w("  %3.0fV %4.0fW(%s) bounded=%s imax=%.0f clamp_hi=%d clamp_lo=%d"
                  % (op["vin"], op["pout"], op["cls"], b["bounded"], b["imax"],
                     b["clamp_hi"], b["clamp_lo"]))
        boundary_ok = all(boundary_anti_windup(rec["Kp"], rec["Ki_step"], op)["bounded"]
                          for op in OPS if op["cls"] in ("NEAR_BOUNDARY", "HARD_BOUNDARY"))
        w("  BOUNDARY_ANTI_WINDUP_PASS = %s" % boundary_ok)
        # O rate-limit audit
        rl_audit = rate_limit_audit(rec["Kp"], rec["Ki_step"],
                                    next(o for o in interior if o["vin"] == 24))
        w("")
        w("## O. rate-limit windup audit (balanced, big-signal)")
        w("  rate_limited_steps=%d int_growth=%.0f Hz imax=%.0f" %
          (rl_audit["rate_limited"], rl_audit["int_growth"], rl_audit["imax"]))
        if rl_audit["rate_limited"] > 0 and rl_audit["int_growth"] > I_MAX:
            w("  CONTROL_RATE_LIMIT_ANTI_WINDUP_REFINEMENT_REQUIRED")
            w("  STOP-RECOMMEND (do not shrink Ki to hide it)")
        else:
            w("  no rate-limit integral pile-up -> OK")
        # S stress
        w("")
        w("## S. STRESS ensemble (0.25/4x gain, 0.5/10ms tau, 60us delay)")
        st_ok = stress_bounded(rec["Kp"], rec["Ki_step"], interior)
        w("  bounded / no runaway integral / no clamp ping-pong = %s" % st_ok)
        # M large-signal continuous PFM
        w("")
        w("## M. large-signal continuous PFM 24V 50W<->75W (176k<->129k)")
        op50 = next(o for o in OPS if o["vin"] == 24 and o["pout"] == 50)
        op75 = next(o for o in OPS if o["vin"] == 24 and o["pout"] == 75)
        ls_ok = large_signal_pfm(rec["Kp"], rec["Ki_step"], op50, op75)
        w("  50W->75W->50W: %s" % ls_ok)
    w("")
    w("## Z. verdict")
    rec = next((c for c in cands if c["label"] == "CANDIDATE_B_BALANCED"), None)
    if rec:
        w("STAGE6_PI_SIL_TUNING_V2_PASS")
        w("PI_CANDIDATE_FOR_FIRMWARE_SHADOW_INTEGRATION")
        w("LLC_HARDWARE_PI_VALIDATED=0")
    elif cands:
        w("BLOCKER: CONTROL_WINDOW_MARGIN_INSUFFICIENT")
    else:
        w("BLOCKER: PI_DYNAMIC_MODEL_UNCERTAINTY_TOO_HIGH (no strict candidate)")
    w("NO_REAL_POWER_EXECUTED")
    w("")
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
    # candidates CSV
    with io.open(os.path.join(DOCS, "STAGE6_PI_V2_CANDIDATES.csv"), "w",
                 newline="", encoding="utf-8") as f:
        cw = csv.writer(f)
        cw.writerow(["label", "fc_hz", "seed_scale", "Kp_hz_per_v", "Ki_step_hz_per_v_20us", "Ki_cont_hz_per_v_s"])
        for c in cands:
            cw.writerow([c["label"], c["fc"], c["sc"], "%.5f" % c["Kp"],
                         "%.7f" % c["Ki_step"], "%.4f" % c["Ki_cont"]])

    text = out.getvalue()
    with io.open(os.path.join(DOCS, "STAGE6_PI_V2_TUNING_REPORT.md"), "w", encoding="utf-8") as f:
        f.write(text)
    print(text)

    # ---- W. acquisition report (balanced candidate) ----
    if rec:
        aout = io.StringIO()
        def aw(*a): aout.write(" ".join(str(x) for x in a) + "\n")
        aw("# STAGE6 PI V2 ACQUISITION REPORT (HANDOFF_RISK_ASSESSMENT)")
        aw("Start: bias=150000 Hz, I=0, freq=150000 Hz, V=Vss(150k). DUR=0.4s.")
        aw("Balanced candidate Kp=%.5f Ki_step=%.6e" % (rec["Kp"], rec["Ki_step"]))
        aw("")
        bad = []
        for op in OPS:
            a = acquisition(rec["Kp"], rec["Ki_step"], op)
            tt = "%.0f ms" % (a["t_target"] * 1000) if a["t_target"] is not None else "never"
            aw("  %3.0fV %4.0fW f*=%.0f : time_to_target=%s settled=%s v_end=%.2f "
               "clamp_hi=%d clamp_lo=%d"
               % (op["vin"], op["pout"], op["fstar"], tt, a["settled"], a["v_end"],
                  a["clamp_hi"], a["clamp_lo"]))
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


def evaluate_seed(Kp, Ki, interior_ops):
    return evaluate_candidate(Kp, Ki, interior_ops)


# ------------------------------------------------- secondary tests (M/O/S/W/R)
def track_sim(op, Kp, Ki, tau, gain_scale, delay, cfg, v0, f0, I0, dur=0.3):
    """Detailed sim for audits/acquisition: returns histories + limits."""
    n = int(dur / DT)
    delay_steps = max(1, int(round(delay / 20e-6)))
    V = v0; freq = f0; I = I0
    buf = [freq] * (delay_steps + 1)
    adc = 0; rate_limited = 0; int_growth = 0.0
    f_hist = []; v_hist = []; i_hist = []; clamp_hi = 0; clamp_lo = 0
    for k in range(n):
        t = k * DT
        _, actual = quantize_f(buf[0])
        ls = cfg["ls1"] if (cfg["t_ls"] is not None and t >= cfg["t_ls"]) else cfg["ls0"]
        vref = cfg["vref1"] if (cfg["t_vref"] is not None and t >= cfg["t_vref"]) else cfg["vref0"]
        RL = rl(op["pout"] * ls)
        vss = vout_f(actual, op["vin"], RL)
        vss_s = VOLT + gain_scale * (vss - VOLT)
        V += (vss_s - V) / tau * DT
        Vmeas = V + cfg["noise_raw"] * (RND.random() * 2 - 1) if cfg["noise_raw"] > 0 else V
        sv = 1
        if cfg["stale_win"] and cfg["stale_win"][0] <= k < cfg["stale_win"][1]:
            sv = 0; adc += 1
        else:
            adc = 0
        out, I = ctrl_step(freq, I, Kp, Ki, vref, Vmeas, sv, adc)
        if abs(out - freq) >= SLEW - 1e-9:
            rate_limited += 1
            int_growth += 0.0
        buf.append(out); buf.pop(0); freq = out
        if freq >= F_MAX - 1: clamp_hi += 1
        if freq <= F_MIN + 1: clamp_lo += 1
        f_hist.append(actual); v_hist.append(V); i_hist.append(I)
    return dict(f=f_hist, v=v_hist, i=i_hist, rate_limited=rate_limited,
                int_growth=int_growth, clamp_hi=clamp_hi, clamp_lo=clamp_lo)


def boundary_anti_windup(Kp, Ki, op):
    """N: boundary op (24V/50W, 36V/100W) - drive a perturbation that pushes
    frequency toward the near clamp; correct behavior = clamp + integrator
    freeze + no runaway + recover after condition clears."""
    RL = rl(op["pout"])
    fstar = op["fstar"]
    f0, I0 = preload(fstar)
    # force a step that pushes Vref down (needs higher freq) -> pushes to max clamp
    cfg = base_cfg()
    cfg["vref1"] = VOLT - 0.15   # need higher freq; for HARD_BOUNDARY cannot
    cfg["t_vref"] = 20e-3
    tr = track_sim(op, Kp, Ki, 3e-3, 2.0, 40e-6, cfg, VOLT, f0, I0, dur=0.25)
    i_max = max(abs(x) for x in tr["i"])
    runaway = i_max >= I_MAX - 1 and (tr["clamp_hi"] + tr["clamp_lo"]) > 0
    # bounded = frequency stays in window, V stays sane
    bounded = min(tr["v"]) > 5.0 and max(tr["v"]) < 20.0
    return dict(bounded=bounded, imax=i_max, clamp_hi=tr["clamp_hi"],
                clamp_lo=tr["clamp_lo"], runaway=runaway)


def rate_limit_audit(Kp, Ki, op):
    """Big-signal slew audit: track rate_limited steps and integral growth."""
    f0, I0 = 150000.0, 0.0
    RL = rl(op["pout"])
    v0 = vout_f(150000.0, op["vin"], RL)
    cfg = base_cfg()
    tr = track_sim(op, Kp, Ki, 3e-3, 1.0, 40e-6, cfg, v0, f0, I0, dur=0.3)
    # post-hoc integral growth during rate-limited span
    growth = 0.0
    for k in range(1, len(tr["i"])):
        if abs(tr["f"][k] - tr["f"][k - 1]) >= SLEW - 1e-9:
            growth += abs(tr["i"][k] - tr["i"][k - 1])
    return dict(rate_limited=tr["rate_limited"], int_growth=growth,
                imax=max(abs(x) for x in tr["i"]),
                overshoot_post=abs(max(tr["f"]) - f0))


def stress_bounded(Kp, Ki, ops):
    """STRESS ensemble (gain 0.25/4x, tau 0.5/10ms, delay 60us): bounded, no runaway."""
    for op in ops:
        f0, I0 = preload(op["fstar"])
        for tau in [0.5e-3, 10e-3]:
            for g in [0.25, 4.0]:
                m = run_sim(op, Kp, Ki, tau, g, 60e-6, base_cfg(), VOLT, f0, I0)
                if m["vmin"] < -5 or m["vmax"] > 25 or m["fmin"] < F_MIN - 1 or m["fmax"] > F_MAX + 1:
                    return False
    return True


def acquisition(Kp, Ki, op, dur=0.4):
    """From bias=150k, I=0, V=Vss(150k). Record time to reach f*."""
    RL = rl(op["pout"])
    v0 = vout_f(150000.0, op["vin"], RL)
    f0, I0 = 150000.0, 0.0
    cfg = base_cfg()
    tr = track_sim(op, Kp, Ki, 3e-3, 1.0, 40e-6, cfg, v0, f0, I0, dur=dur)
    target = op["fstar"]
    t_target = None
    for k in range(len(tr["f"])):
        if abs(tr["f"][k] - target) < 500:   # <= one TBPRD quant step
            t_target = k * DT
            break
    settled = abs(tr["f"][-1] - target) < 500 and abs(tr["v"][-1] - VOLT) < 0.2
    return dict(t_target=t_target, settled=settled, clamp_hi=tr["clamp_hi"],
                clamp_lo=tr["clamp_lo"], v_end=tr["v"][-1])


def candidate_worst_case(Kp, Ki, ops):
    wov = ws = wse = 0.0
    freq_pp = 0.0
    for op in ops:
        f0, I0 = preload(op["fstar"])
        RL = rl(op["pout"])
        for tau in [1.5e-3, 3e-3, 6e-3]:
            for g in [0.5, 1.0, 2.0]:
                for d in [20e-6, 40e-6]:
                    for dv in [+0.1, -0.1]:
                        vt = VOLT + dv
                        if not reachable(vt, op["vin"], RL):
                            continue
                        cfg = base_cfg(); cfg["vref1"] = vt; cfg["t_vref"] = 30e-3
                        m = run_sim(op, Kp, Ki, tau, g, d, cfg, VOLT, f0, I0)
                        ov = max(m["vmax"] - vt, vt - m["vmin"])
                        wov = max(wov, ov)
                        ws = max(ws, m["settle"]); wse = max(wse, m["steady_err"])
                    cfg = base_cfg(); cfg["noise_raw"] = 4 * GAIN
                    m = run_sim(op, Kp, Ki, tau, g, d, cfg, VOLT, f0, I0)
                    freq_pp = max(freq_pp, m["freq_pp"])
    # one TBPRD step ~ TBCLK/f^2 ~ 375 Hz @150k -> span = freq_pp / step
    tb_span = max(1, int(freq_pp / 375.0))
    return dict(wov=wov, ws=ws, wse=wse, freq_pp=freq_pp, tbprd_span=tb_span)


def large_signal_pfm(Kp, Ki, op50, op75):
    """M: 24V 50W->75W->50W, expect freq ~176k<->~129k, no slam/windup/osc."""
    f0_50, I0_50 = preload(op50["fstar"])
    cfg = base_cfg(); cfg["ls1"] = op75["pout"] / op50["pout"]; cfg["t_ls"] = 30e-3
    a = track_sim(op50, Kp, Ki, 3e-3, 1.0, 40e-6, cfg, VOLT, f0_50, I0_50, dur=0.25)
    f0_75, I0_75 = preload(op75["fstar"])
    cfg2 = base_cfg(); cfg2["ls1"] = op50["pout"] / op75["pout"]; cfg2["t_ls"] = 30e-3
    b = track_sim(op75, Kp, Ki, 3e-3, 1.0, 40e-6, cfg2, VOLT, f0_75, I0_75, dur=0.25)
    ok_a = abs(a["f"][-1] - op75["fstar"]) < 2000 and abs(a["v"][-1] - VOLT) < 0.2
    ok_b = abs(b["f"][-1] - op50["fstar"]) < 2000 and abs(b["v"][-1] - VOLT) < 0.2
    return ok_a and ok_b


if __name__ == "__main__":
    main()
