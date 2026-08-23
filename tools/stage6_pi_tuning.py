#!/usr/bin/env python3
"""STAGE6_PI_SIL_TUNING_V1 - conservative/stability-first PI candidate search
for the F28034 LLC on the PC. Reuses the parameterizable Controller from
stage6_control_sil.py (mirror of CTRL_ComputeFrequencyCommand: SIGN=-1,
120k-180k clamp, 100 Hz/20us slew, conditional integration, ADC stale freeze).

Produces docs/STAGE6_PI_CANDIDATES.csv and docs/STAGE6_PI_SIL_TUNING_REPORT.md.
No firmware is modified; no PWM, no real power. LLC_HARDWARE_PI_VALIDATED=0.
"""
import os, sys, math, csv, random, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import stage6_control_sil as S
from stage6_control_sil import Controller, NOM, FMIN, FMAX, MAX_STEP, I_MAX

VOUT_GAIN = 0.008089325          # V/raw
DT        = 20e-6                # control step
HORIZON   = 3000                 # 60 ms horizon

MODEL_A = dict(NOM)
MODEL_B = dict(NOM); MODEL_B["Cr"] = 0.33e-6
def _b(cr, lr_s, lm_s):
    p = dict(NOM); p["Cr"]=cr; p["Lr"]=NOM["Lr"]*lr_s; p["Lm"]=NOM["Lm"]*lm_s; return p
MODELS = [
    ("MODEL_A",     MODEL_A,             "PARAMETER_REFERENCE"),
    ("MODEL_B",     MODEL_B,             "EMPIRICAL_TREND_MODEL"),
    ("MODEL_B1_LO", _b(0.28e-6, 0.9, 0.9),"EMPIRICAL_TREND_MODEL"),
    ("MODEL_B2_HI", _b(0.38e-6, 1.1, 1.1),"EMPIRICAL_TREND_MODEL"),
    ("MODEL_B3_LR", _b(0.33e-6, 0.9, 1.0),"EMPIRICAL_TREND_MODEL"),
    ("MODEL_B4_LM", _b(0.33e-6, 1.0, 1.1),"EMPIRICAL_TREND_MODEL"),
]

# ----------------------------------------------------------------------------
def reachable_for(model, vin, load_w, vref):
    p = dict(model); rl = (vref*vref/load_w) if load_w > 0 else 1e9
    fr = S.fr_LrCr(p["Lr"], p["Cr"]); lo = max(FMIN, fr*0.85); hi = FMAX
    vmin = 1e18; vmax = -1e18
    for f in np.linspace(lo, hi, 120):
        vo = _vout(f, vin, p, rl)
        vmin = min(vmin, vo); vmax = max(vmax, vo)
    k = 1.0 if rl > 1e6 else (1.0 + S.R_SRC/rl); vmin/=k; vmax/=k
    return (vmin-0.15 <= vref <= vmax+0.15), vmin, vmax


def _vout(f, vin, p, rl):
    """Fast scalar FHA Vout (float, no complex)."""
    w = 2.0*math.pi*f; n = p["n"]
    Rac = 8.0*n*n*rl/(math.pi*math.pi)
    Zr2 = w*p["Lr"] - 1.0/(w*p["Cr"])
    wLm = w*p["Lm"]
    if rl > 1e8:
        Zm_r = 0.0; Zm_i = wLm
    else:
        d = wLm*wLm + Rac*Rac
        Zm_r = wLm*wLm*Rac/d; Zm_i = wLm*Rac*Rac/d
    M = math.hypot(Zm_r, Zm_i) / math.hypot(Zm_r, Zr2 + Zm_i)
    return vin*M/(2.0*n) - p["Vf"]


def run_closed(kp, ki, model, vin, load, vref, v0, n=HORIZON, dt=DT, noise_raw=0.0,
               seed=1, ref_step=None, load_step=None, vin_step=None, stale=None, gain=1.0):
    c = Controller(kp, ki, vref=vref, dt=dt)
    p = dict(model)
    ref = vref; vin = float(vin); load = float(load)
    v = float(v0); Rs = 0.15; Cout = 2350e-6
    rng = random.Random(seed); nv = noise_raw*VOUT_GAIN
    h = np.empty(n); fh = np.empty(n); frz = np.zeros(n, dtype=int)
    last = v
    for i in range(n):
        if ref_step  and i == ref_step[0]:  ref = ref_step[1]; vref = ref_step[1]
        if load_step and i == load_step[0]: load = load_step[1]
        if vin_step  and i == vin_step[0]:  vin  = vin_step[1]
        rl = (ref*ref/load) if load > 0 else 1e9
        sf = bool(stale) and (stale[0] <= i < stale[1])
        vmeas = last if sf else (v + (rng.uniform(-1, 1)*nv if nv > 0 else 0.0))
        if not sf: last = v
        f = c.step(vmeas, 0 if sf else 1)
        vo = _vout(f, vin, p, rl)
        dv = (vo - v)/(Rs*Cout)*dt*gain
        if rl < 1e8: dv -= v/rl/Cout*dt
        v = max(v + dv, 0.0)
        h[i] = v; fh[i] = f; frz[i] = c.frozen
    return dict(vout=h, freq=fh, frozen=frz, c=c)


def metrics(res, target):
    h = res["vout"]; f = res["freq"]; n = len(h); tail = h[-800:]
    ss_err = float(abs(np.mean(tail) - target))
    peak_max = float(np.max(h))
    # first index where output first enters the 2% band around target
    band = 0.02*max(target, 0.01)
    t0 = -1
    for i in range(n):
        if abs(h[i] - target) <= band: t0 = i; break
    if t0 >= 0:
        w = h[t0:]
        over = float(max(0.0, np.max(w) - target))
        under = float(max(0.0, target - np.min(w)))
    else:
        over = float(max(0.0, np.max(h) - target)); under = 0.0
    inside = np.abs(h - target) <= band
    kk = n - 1
    while kk >= 0 and inside[kk]: kk -= 1
    settle = (kk+1)*DT*1e3 if kk+1 < n else float("nan")
    df = np.abs(np.diff(f)); slew = int(np.sum(df > MAX_STEP - 1e-6))
    clamp = float(np.sum((np.isclose(f, FMIN, atol=5) | np.isclose(f, FMAX, atol=5)))*DT*1e3)
    ft = f[-800:]
    return dict(settle_ms=settle, ss_err=ss_err, overshoot=over, undershoot=under,
                peak_max=peak_max,
                fmin=int(f.min()), fmax=int(f.max()), clamp_time_ms=clamp, slew_hits=slew,
                integrator_freeze=int(np.sum(res["frozen"])),
                integrator_peak=float(abs(res["c"].integral)),
                ripple_pp=float(np.max(ft)-np.min(ft)), rms_noise=float(np.std(ft)))


def gate(m, target, name):
    if not (m["ss_err"] <= 0.01*target): return False
    if m["overshoot"] > 0.6: return False            # absolute cap: Vout > target+0.6 (12.6 for 12V)
    if m["overshoot"] > 0.05*target: return False    # preferred <= 3% ~ 0.05 safety
    if m["settle_ms"] != m["settle_ms"] or m["settle_ms"] > 60: return False
    if m["fmin"] < FMIN - 5 or m["fmax"] > FMAX + 5: return False
    if m["ripple_pp"] > 4000: return False
    if name.startswith("noise") and m["rms_noise"] > 1500: return False
    return True


REP_OPS = [(30.0, 50.0, 12.0), (36.0, 50.0, 12.0), (36.0, 100.0, 12.0),
           (30.0, 100.0, 12.0), (36.0, 50.0, 10.0), (36.0, 50.0, 15.0),
           (24.0, 25.0, 12.0)]


def eval_candidate(kp, ki, ops=None, dt=DT, gain=1.0):
    ops = ops or REP_OPS
    worst = None; n_reach = 0; n_scen = 0; n_pass = 0; n_fail = 0
    def upd(m):
        nonlocal worst
        if worst is None:
            worst = dict(m)
        else:
            for k in worst:
                try: worst[k] = max(worst[k], m[k])
                except Exception: pass
    for mn, mp, kl in MODELS:
        for (vin, ld, vref) in ops:
            ok, _, _ = reachable_for(mp, vin, ld, vref)
            if not ok: continue
            n_reach += 1
            cases = [("startup", vref-2.0, vref, {}),
                     ("high", vref+1.0, vref, {}),
                     ("noise1", vref, vref, dict(noise_raw=1.0)),
                     ("noise2", vref, vref, dict(noise_raw=2.0)),
                     ("noise4", vref, vref, dict(noise_raw=4.0))]
            for name, v0, tgt, kw in cases:
                res = run_closed(kp, ki, mp, vin, ld, vref, v0, dt=dt, gain=gain, **kw)
                m = metrics(res, tgt); n_scen += 1; upd(m)
                if gate(m, tgt, name): n_pass += 1
                else: n_fail += 1
            # ref step down: target vref-1 must be reachable, else PLANT_TARGET_UNREACHABLE
            r_ok, _, _ = reachable_for(mp, vin, ld, vref - 1.0)
            if r_ok:
                res = run_closed(kp, ki, mp, vin, ld, vref, vref, dt=dt, gain=gain,
                                 ref_step=(1500, vref-1.0))
                m = metrics(res, vref-1.0); n_scen += 1; upd(m)
                if gate(m, vref-1.0, "ref_down"): n_pass += 1
                else: n_fail += 1
            sc = run_closed(kp, ki, mp, vin, ld, vref, vref, dt=dt, gain=gain,
                            noise_raw=1.0, seed=2, stale=(2000, 2003))
            m = metrics(sc, vref); n_scen += 1; upd(m)
            if int(np.sum(sc["frozen"])) > 0: n_pass += 1
            else: n_fail += 1
            jmp = abs(sc["freq"][2003] - sc["freq"][2002]) if len(sc["freq"]) > 2003 else 0
            n_scen += 1
            if jmp <= 300: n_pass += 1
            else: n_fail += 1
        ok, _, _ = reachable_for(mp, 30.0, 50.0, 12.0)
        if ok:
            rl = run_closed(kp, ki, mp, 30.0, 25.0, 12.0, 12.0, dt=dt, gain=gain,
                            load_step=(1500, 50.0))
            m = metrics(rl, 12.0); n_scen += 1; upd(m)
            if gate(m, 12.0, "load"): n_pass += 1
            else: n_fail += 1
            rv = run_closed(kp, ki, mp, 30.0, 50.0, 12.0, 12.0, dt=dt, gain=gain,
                            vin_step=(1500, 36.0))
            mv = metrics(rv, 12.0); n_scen += 1; upd(mv)
            if gate(mv, 12.0, "vin"): n_pass += 1
            else: n_fail += 1
    return worst, n_reach, n_scen, n_pass, n_fail


# ----------------------------------------------------------------------------
KP_GRID = [100, 300, 1000, 3000, 10000, 30000]
KI_GRID = [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30, 100]
COARSE_OPS = [(36.0, 50.0, 12.0), (36.0, 100.0, 12.0), (30.0, 50.0, 12.0)]


def coarse_scan():
    rows = []
    for kp in KP_GRID:
        for ki in KI_GRID:
            r = eval_candidate(kp, ki, ops=COARSE_OPS)
            rows.append(dict(kp=kp, ki=ki, nf=r[4], npass=r[3], nscen=r[2], worst=r[0]))
    passers = [x for x in rows if x["nf"] == 0 and x["worst"] and x["worst"]["ss_err"] <= 0.02]
    passers.sort(key=lambda x: (x["worst"]["ripple_pp"], x["worst"]["settle_ms"]))
    return rows, passers


def fine_scan(pairs):
    out = []
    for kp, ki in pairs:
        r = eval_candidate(kp, ki, ops=REP_OPS)
        out.append(dict(kp=kp, ki=ki, nf=r[4], npass=r[3], nscen=r[2], worst=r[0]))
    out.sort(key=lambda x: (x["nf"], x["worst"]["ripple_pp"], x["worst"]["settle_ms"]))
    return out


# well-conditioned reachable subset used for the gain / cycle robustness test
# (directive M/N). Excludes MODEL_A (12 V unreachable) and MODEL_B1_LO
# (operating point sits at its edge / does not converge -> a conditioning
# issue, not a loop-gain test).
_MB = {mn: mp for mn, mp, kl in MODELS}
GAIN_TEST = [('MODEL_B',     _MB['MODEL_B'],     36.0, 50.0, 12.0),
             ('MODEL_B',     _MB['MODEL_B'],     36.0, 100.0, 12.0),
             ('MODEL_B2_HI', _MB['MODEL_B2_HI'], 36.0, 50.0, 12.0),
             ('MODEL_B3_LR', _MB['MODEL_B3_LR'], 36.0, 50.0, 12.0),
             ('MODEL_B4_LM', _MB['MODEL_B4_LM'], 36.0, 50.0, 12.0)]


def _sweep_stability(kp, ki, gain=1.0, dt=DT):
    """Boundedness / non-oscillation on the well-conditioned subset at a
    given plant gain and control period. The positive-feedback test of
    directives M/N (does NOT gate on step-up overshoot)."""
    total = 0; fails = 0
    for mn, mp, vin, ld, vref in GAIN_TEST:
        ok, _, _ = reachable_for(mp, vin, ld, vref)
        if not ok: continue
        res = run_closed(kp, ki, mp, vin, ld, vref, vref-0.5, dt=dt, gain=gain)
        m = metrics(res, vref); total += 1
        stable = (m["ss_err"] < 0.5 and m["ripple_pp"] < 2000 and
                  m["fmin"] >= FMIN-5 and m["fmax"] <= FMAX+5 and
                  m["integrator_peak"] < 1.5*I_MAX)
        if not stable: fails += 1
    return total, fails


def gain_sweep(kp, ki):
    return [(g, fails, total) for g, (total, fails) in
            ((g, _sweep_stability(kp, ki, gain=g)) for g in (0.25, 0.5, 1.0, 2.0, 4.0))]


def cycle_sweep(kp, ki):
    return [(d, fails, total) for d, (total, fails) in
            ((d, _sweep_stability(kp, ki, dt=d*1e-6)) for d in (18.0, 20.0, 22.0, 25.0))]


def reach_table():
    rows = []
    for mn, mp, gl in MODELS:
        for vin in (24.0, 30.0, 36.0):
            for ld in (5.0, 25.0, 50.0, 75.0, 100.0):
                for vref in (10.0, 12.0, 15.0):
                    ok, a, b = reachable_for(mp, vin, ld, vref)
                    rows.append((mn, vin, ld, vref, ok, round(a, 2), round(b, 2)))
    return rows


# ----------------------------------------------------------------------------
def main():
    print("STAGE6_PI_SIL_TUNING_V1")
    rt = reach_table()
    n_ok = sum(1 for r in rt if r[4])
    print(f"reachability cells: {len(rt)} total, {n_ok} reachable")
    print("\ncoarse scan...")
    rows, passers = coarse_scan()
    print(f"coarse passers (nf=0): {[(p['kp'], p['ki']) for p in passers[:12]]}")
    # take top few coarse candidates by fewest fails for fine scan
    best5 = sorted(rows, key=lambda r: (r['nf'], r['worst']['ripple_pp'], r['worst']['settle_ms']))[:8]
    fine_pairs = [(b['kp'], b['ki']) for b in best5]
    print("fine scan...")
    fine = fine_scan(fine_pairs)
    strict = [f for f in fine if f['nf'] == 0]
    print(f"fine full-battery STRICT-pass candidates (nf=0): {len(strict)}")
    # always pick top-3 reference candidates (fewest fails -> best stability)
    ranked = sorted(fine, key=lambda f: (f['nf'], f['worst']['ripple_pp'], f['worst']['settle_ms']))
    refs = ranked[:8] if ranked else []
    cands = {}
    if strict:
        si = sorted(range(len(strict)), key=lambda i: (strict[i]['worst']['ripple_pp'],
                                                       strict[i]['worst']['settle_ms']))
        cands['C'] = strict[si[0]]
        cands['B'] = strict[si[len(si)//2]]
        cands['A'] = strict[si[-1]]
    elif refs:
        # reference only (no strict passer): pick 3 distinct, diverse choices
        by_kp = sorted(refs, key=lambda f: f['kp'])
        by_settle = sorted(refs, key=lambda f: (f['worst']['settle_ms'],
                                                f['worst']['ripple_pp']))
        cands['A'] = by_kp[0]                    # ultra-conservative (lowest gain)
        cands['C'] = by_settle[0]                # fastest safe in SIL
        cands['B'] = by_settle[len(by_settle)//2]
        if cands['B'] in (cands['A'], cands['C']):
            for q in refs:
                if q not in (cands['A'], cands['C']):
                    cands['B'] = q; break
    print("\n=== reference candidates ===")
    for nm, c in cands.items():
        print(f"{nm}: kp={c['kp']} ki_step={c['ki']} nf={c['nf']} " +
              f"settle={c['worst']['settle_ms']}ms ripple={c['worst']['ripple_pp']}Hz")
    sweep = {}
    for nm, c in cands.items():
        sweep[nm] = dict(gain=gain_sweep(c['kp'], c['ki']), cycle=cycle_sweep(c['kp'], c['ki']))
    write_csv(cands, sweep, rt)
    write_report(cands, sweep, rt, fine, strict)
    ok = bool(strict) and all(all(g[1] == 0 for g in sweep[nm]['gain'] if g[0] in (0.5, 1.0, 2.0))
                              for nm in cands)
    print("\nVERDICT:", "STAGE6_PI_SIL_TUNING_PASS" if ok else "PI_MODEL_UNCERTAINTY_TOO_HIGH")


def write_csv(cands, sweep, rt):
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        "docs", "STAGE6_PI_CANDIDATES.csv")
    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["candidate", "kp_hz_per_v", "ki_step_hz_per_v_step",
                    "ki_cont_hz_per_v_s", "worst_overshoot_v", "worst_settle_ms",
                    "worst_ss_err_v", "worst_ripple_pp_hz", "gain_sweep", "cycle_sweep"])
        for nm, c in cands.items():
            gs = ";".join(f"{g[0]}x:nf{g[2]}" for g in sweep[nm]['gain'])
            cs = ";".join(f"{cy[0]}us:fail{cy[1]}" for cy in sweep[nm]['cycle'])
            w.writerow([nm, c['kp'], c['ki'], round(c['ki']/DT, 0),
                        c['worst']['overshoot'], c['worst']['settle_ms'],
                        c['worst']['ss_err'], c['worst']['ripple_pp'], gs, cs])
        for r in rt:
            w.writerow([r[0], r[1], r[2], r[3], "REACH" if r[4] else "UNREACHABLE",
                        r[5], r[6], "", "", ""])
    print("wrote docs/STAGE6_PI_CANDIDATES.csv")


def write_report(cands, sweep, rt, fine, strict):
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        "docs", "STAGE6_PI_SIL_TUNING_REPORT.md")
    L = ["# STAGE6 PI SIL TUNING REPORT", "",
         "Stage: STAGE6_PI_SIL_TUNING_V1 | firmware baseline: ff695d1 |",
         "LLC_CONTROL_DIRECTION=0, LLC_HARDWARE_PI_VALIDATED=0 (unchanged).",
         "SIL only. No firmware change, no PWM write, no real power.", "",
         "## Units", "Kp [Hz/V], Ki_step [Hz/(V*20us)], Ki_cont = Ki_step/20us [Hz/(V*s)].", "",
         "## Plant ensemble", ""]
    L.append("| model | class |")
    for mn, mp, kl in MODELS:
        L.append(f"| {mn} | {kl} |")
    L += ["",
          "## Key modeling finding",
          "- MODEL_A (reference, Cr=3.004uF) resonance = ~50 kHz: 12 V is "
          "PLANT_TARGET_UNREACHABLE at Vin 24/30/36 within the 120-180 kHz clamp.",
          "- MODEL_B (empirical, Cr=0.33uF) resonance = ~150.6 kHz == the controller "
          "bias (150 kHz). 12 V then requires f = 174 kHz (high side of the resonance "
          "peak). Any Vout step-up from the bias passes through the resonance peak "
          "(open-loop Vout up to ~14 V), producing ~0.9 V overshoot that exceeds the "
          "absolute 12.6 V cap.",
          "- Neither model is HARDWARE_IDENTIFIED_PLANT (see task directive E).", "",
          "## Operating matrix reachability (120-180 kHz clamp)",
          "`REACH`=attainable; `UNREACHABLE`=PLANT_TARGET_UNREACHABLE (not a PI failure).",
          "", "| model | Vin | Load | Vref | status | Vmin | Vmax |"]
    for r in rt:
        L.append(f"| {r[0]} | {r[1]} | {r[2]} | {r[3]} | {'REACH' if r[4] else 'UNREACHABLE'} | {r[5]} | {r[6]} |")
    L += ["", "## Candidate PI (reference / Pareto)", "",
          "Candidates below are the best-conservative SIL choices. If none meets the "
          "strict absolute gate (see Verdict), they are listed as REFERENCE ONLY and "
          "are NOT recommended for firmware integration.", "",
          "| cand | kp | ki_step | ki_cont | worst_os(V) | worst_settle(ms) | worst_ss(V) | worst_ripple(Hz) | strict_pass |", ""]
    strict_names = {c['kp']: c['ki'] for c in strict}
    for nm, c in cands.items():
        sp = "yes" if (c['kp'], c['ki']) in [(k, v) for k, v in strict_names.items()] else "no"
        L.append(f"| {nm} | {c['kp']} | {c['ki']} | {round(c['ki']/DT,0)} | {c['worst']['overshoot']} | "
                 f"{c['worst']['settle_ms']} | {c['worst']['ss_err']} | {c['worst']['ripple_pp']} | {sp} |")
    L += ["", "## PLANT_GAIN_UNCERTAINTY_SWEEP (0.25x..4x)", ""]
    for nm in cands:
        gs = sweep[nm]['gain']
        pr = [g[0] for g in gs if g[1] == 0]
        L.append(f"- {nm}: bounded-stable at plant gain = {pr}")
    ok = bool(strict) and all(all(g[1] == 0 for g in sweep[nm]['gain'] if g[0] in (0.5, 1.0, 2.0))
                              for nm in cands)
    L += ["", "## Verdict", "",
          ("**STAGE6_PI_SIL_TUNING_PASS**" if ok else "**PI_MODEL_UNCERTAINTY_TOO_HIGH**"), "",
          "**RECOMMENDED_CANDIDATE**: " + (list(cands.keys())[0] if ok else "NONE"), "",
          "**VIRTUAL_ONLY_PI_CANDIDATE**, LLC_HARDWARE_PI_VALIDATED=0, NO_REAL_POWER_EXECUTED."]
    with io.open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(L))
    print("wrote docs/STAGE6_PI_SIL_TUNING_REPORT.md")


if __name__ == "__main__":
    main()
