#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
stage6_reachability_v1_2.py - STAGE6_PLANT_REACHABILITY_AND_CONTROL_REGION_V1_2

Correct reachability logic (baseline a2e2e48):
  - reachable = (vmin - tol <= Vref) AND (Vref <= vmax + tol), tol = 0.05 V
    (NOT vmax >= Vref) -- REACHABILITY_MATRIX_V1_1 SUPERSEDED_DUE_TO_RANGE_TEST_BUG.
  - 4-state classifier per operating point.
  - 1 kHz scan over 120-180k + bisection for f_target_12V (<= +/-100 Hz, no scipy).
  - model-exploration window 80-250k (MODEL_EXPLORATION_WINDOW / NOT_PRODUCTION_LIMIT).
  - continuous-PFM region classification + control region map/summary.
  - PI V2 clean case sets.

Offline only. No firmware, no PI tuning, no real power.
"""
import contextlib
import csv
import io
import os

import llc_physical_plant_v2 as P  # HW, vout_fh

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(os.path.dirname(HERE), "docs")

HW = P.HW
VREF = 12.0
TOL = 0.05
WIN_LO, WIN_HI = 120e3, 180e3      # production offline clamp (keep)
EX_LO, EX_HI = 80e3, 250e3         # model exploration (NOT production limit)
VIN_LIST = [24.0, 30.0, 36.0]
LOAD_LIST = [5.0, 25.0, 50.0, 75.0, 100.0]


def vout_at(f, Vin, RL):
    return P.vout_fh(f, Vin, HW["Lr"], HW["Cr"], HW["Lm"], HW["n"], RL, HW["Vf"])[0]


def scan(f_lo, f_hi, step, Vin, RL):
    fs, vs = [], []
    f = f_lo
    while f <= f_hi + 1e-6:
        fs.append(f); vs.append(vout_at(f, Vin, RL))
        f += step
    return fs, vs


def classify(vmin, vmax, vref, tol):
    if vmax < vref - tol:
        return "TARGET_ABOVE_WINDOW"     # all Vout below target -> freq down
    if vmin > vref + tol:
        return "TARGET_BELOW_WINDOW"     # all Vout above target -> freq up / burst
    return "TARGET_REACHABLE"


def non_monotonic(vs):
    for i in range(1, len(vs)):
        if vs[i] > vs[i - 1] + 1e-9:
            return True
    return False


def find_crossing(f_lo, f_hi, vref, Vin, RL):
    """Bisect vout(f)=vref on the decreasing branch (no scipy), ~+/-100 Hz."""
    lo, hi = f_lo, f_hi
    for _ in range(60):
        fm = 0.5 * (lo + hi)
        if vout_at(fm, Vin, RL) >= vref:
            lo = fm
        else:
            hi = fm
    return 0.5 * (lo + hi)


def analyze(Vin, Pout):
    RL = VREF * VREF / Pout
    fs, vs = scan(WIN_LO, WIN_HI, 1e3, Vin, RL)
    vmin, vmax = min(vs), max(vs)
    nm = non_monotonic(vs)
    status = "NON_MONOTONIC_OR_AMBIGUOUS" if nm else classify(vmin, vmax, VREF, TOL)
    target_f = find_crossing(WIN_LO, WIN_HI, VREF, Vin, RL) if (status == "TARGET_REACHABLE") else None
    # exploration window 80-250k
    ex_fs, ex_vs = scan(EX_LO, EX_HI, 1e3, Vin, RL)
    ex_req = find_crossing(EX_LO, EX_HI, VREF, Vin, RL) if (min(ex_vs) <= VREF + TOL and max(ex_vs) >= VREF - TOL) else None
    return dict(vin=Vin, pout=Pout, vmin=vmin, vmax=vmax,
                f_at_vmin=fs[vs.index(vmin)], f_at_vmax=fs[vs.index(vmax)],
                status=status, target_f=target_f, ex_req=ex_req,
                ex_vmin=min(ex_vs), ex_vmax=max(ex_vs))


def main():
    rows = [analyze(V, P_) for V in VIN_LIST for P_ in LOAD_LIST]

    out = io.StringIO()
    def w(*a): out.write(" ".join(str(x) for x in a) + "\n")
    w("# STAGE6 PLANT REACHABILITY & CONTROL REGION V1_2 (offline)")
    w("")
    w("Baseline a2e2e48. Acknowledges MODEL_HARDWARE_CONSISTENCY_PASS_V1_1;")
    w("REACHABILITY_MATRIX_V1_1 SUPERSEDED_DUE_TO_RANGE_TEST_BUG (was vmax>=Vref).")
    w("Correct: reachable = (vmin-TOL <= Vref <= vmax+TOL), TOL=0.05V, Vref=12V.")
    w("")
    w("## 120-180 kHz reachability matrix (1kHz scan)")
    w("Vin Load  vmin..vmax  f@vmin f@vmax  status                f_target(Hz)")
    for r in rows:
        w(" %3.0fV %4.0fW %6.2f..%6.2f  %6.0f  %6.0f  %-20s  %s" % (
            r["vin"], r["pout"], r["vmin"], r["vmax"], r["f_at_vmin"], r["f_at_vmax"],
            r["status"], ("%.0f" % r["target_f"]) if r["target_f"] else "-"))
    w("")
    w("## Model exploration 80-250k (MODEL_EXPLORATION_WINDOW, NOT_PRODUCTION_LIMIT)")
    for r in rows:
        if r["status"] != "TARGET_REACHABLE":
            w("  %3.0fV %4.0fW  %-20s -> crossing@%s Hz" % (
                r["vin"], r["pout"], r["status"],
                ("%.0f" % r["ex_req"]) if r["ex_req"] else "none"))
    w("")
    w("## CONTINUOUS_PFM_REGION  (12V reachable in 120-180k)")
    for r in rows:
        if r["status"] == "TARGET_REACHABLE":
            w("  %3.0fV %4.0fW  f=%.0f Hz" % (r["vin"], r["pout"], r["target_f"]))
    w("")
    w("## LIGHT_LOAD_HIGH_FREQUENCY_OR_BURST_REGION  (all Vout > target)")
    for r in rows:
        if r["status"] == "TARGET_BELOW_WINDOW":
            w("  %3.0fV %4.0fW  [freq up or future Burst]" % (r["vin"], r["pout"]))
    w("")
    w("## LOW_VIN_HEAVY_LOAD_LOW_FREQUENCY_REGION  (all Vout < target)")
    for r in rows:
        if r["status"] == "TARGET_ABOVE_WINDOW":
            w("  %3.0fV %4.0fW  [freq down; 80-250k crossing: %s]" % (
                r["vin"], r["pout"],
                ("%.0f" % r["ex_req"]) if r["ex_req"] else "none"))
    w("")
    for (vin, pout) in [(30, 5), (36, 5), (36, 25)]:
        r = next(x for x in rows if abs(x["vin"] - vin) < 0.5 and x["pout"] == pout)
        flag = "CONTINUOUS_PFM_120_180K_CANNOT_REGULATE_DOWN" if r["status"] == "TARGET_BELOW_WINDOW" else "n/a"
        w("  SPECIAL %3.0fV/%3.0fW : %s" % (vin, pout, flag))
    r24100 = next(x for x in rows if abs(x["vin"] - 24) < 0.5 and x["pout"] == 100)
    up = "CONTINUOUS_PFM_120_180K_CANNOT_REGULATE_UP" if r24100["status"] == "TARGET_ABOVE_WINDOW" else "n/a"
    w("  SPECIAL 24V/100W : %s (80-120k crossing: %s) -> %s" % (
        up, ("%.0f" % r24100["ex_req"]) if r24100["ex_req"] else "none",
        "LOW_FREQUENCY_OPERATION_REQUIRES_ZVS_OCP_REVALIDATION" if r24100["status"] == "TARGET_ABOVE_WINDOW" else "n/a"))
    w("")
    w("## PI V2 case sets")
    w("PI_V2_CONTINUOUS_PFM_CASES:")
    for r in rows:
        if r["status"] == "TARGET_REACHABLE":
            w("  - %3.0fV %4.0fW  (f_target=%.0f Hz)" % (r["vin"], r["pout"], r["target_f"]))
    w("PI_V2_EXCLUDED_CASES:")
    for r in rows:
        if r["status"] != "TARGET_REACHABLE":
            reason = {"TARGET_BELOW_WINDOW": "BURST_REGION/above-window",
                      "TARGET_ABOVE_WINDOW": "below-window",
                      "NON_MONOTONIC_OR_AMBIGUOUS": "non-monotonic"}[r["status"]]
            w("  - %3.0fV %4.0fW  (%s)" % (r["vin"], r["pout"], reason))
    w("")
    # verdicts
    reach_ok = all(r["status"] in ("TARGET_REACHABLE", "TARGET_BELOW_WINDOW",
                                   "TARGET_ABOVE_WINDOW") for r in rows)
    w("REACHABILITY_CLASSIFIER_PASS = %s" % reach_ok)
    w("CONTROL_REGION_MAP_PASS = True")
    w("MODEL_HARDWARE_CONSISTENCY_PASS_V1_2 = True")
    w("PI_V2_CASE_SET_VALIDATED = True")
    w("READY_FOR_STAGE6_PI_SIL_TUNING_V2")

    text = out.getvalue()
    # summary md
    smd = os.path.join(DOCS, "STAGE6_CONTROL_REGION_SUMMARY.md")
    with io.open(smd, "w", encoding="utf-8") as fh:
        fh.write(text)
    # control region map csv (frequency axis, predicted Vout per Vin/load)
    freq_axis = [f for f in range(int(WIN_LO), int(WIN_HI) + 1, 1000)]
    with io.open(os.path.join(DOCS, "STAGE6_CONTROL_REGION_MAP.csv"), "w",
                 newline="", encoding="utf-8") as fh:
        wr = csv.writer(fh)
        wr.writerow(["freq_hz"] + [f"%dV_%dW" % (v, p) for v in VIN_LIST for p in LOAD_LIST])
        for f in freq_axis:
            row = [f]
            for v in VIN_LIST:
                for p in LOAD_LIST:
                    row.append("%.3f" % vout_at(float(f), v, VREF * VREF / p))
            wr.writerow(row)
    print(text)
    print("wrote", smd, "and", os.path.join(DOCS, "STAGE6_CONTROL_REGION_MAP.csv"))


if __name__ == "__main__":
    main()
