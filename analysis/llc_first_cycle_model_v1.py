#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LLC_FIRST_CYCLE_CURRENT_MODEL_V1
================================
Time-domain startup model for the F28034 full-bridge LLC first cycles.

This is a PC-side numerical study only. It does NOT modify firmware and does
NOT run any power hardware.

Model:
  - Full-bridge square wave with deadtime (Vab = +Vin / 0 / -Vin / 0)
  - Lr, Cr, Lm
  - Ideal transformer n = Np/Ns_half = 1.25
  - Center-tap full-wave rectifier
  - Output capacitor (Cout swept because board value is treated as UNKNOWN)
  - Optional diode forward voltage Vf (ideal 0 or engineering 0.7 V)

States:
  x = [i_Lr, v_Cr, i_Lm, v_out]
"""

import csv
import json
import pathlib

import numpy as np
from scipy.integrate import solve_ivp
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

BASE = pathlib.Path(__file__).resolve().parent
PLOTS = BASE / "plots"
PLOTS.mkdir(exist_ok=True)

# ----------------------------------------------------------------------
# Hardware / schematic parameters
# ----------------------------------------------------------------------
LR_NOM = 3.385e-6
LR_LOW = 3.35e-6
LR_HIGH = 3.42e-6

LM_NOM = 17.25e-6
LM_LOW = 16.9e-6
LM_HIGH = 17.6e-6

CR = 3.004e-6
N = 1.25

VIN_NOM = 24.0
VIN_LOW = 23.8
VIN_HIGH = 24.2

COUT_CANDIDATES = (470e-6, 940e-6, 1410e-6)
COUT_NOM = 940e-6          # middle candidate; report treats Cout as UNKNOWN
RLOAD = 1e9                # no meaningful load during cold-start first cycles

DEADTIME = 36.0 / 60e6     # 36 TBCLK ticks @60 MHz = 600 ns

FREQS = (150e3, 200e3)

# Comparator theory (NOT calibrated)
VDDA = 3.3
DAC300 = 300
DAC320 = 320
CT_RATIO = 100.0
R32 = 10.0
K_IPRI = CT_RATIO / R32   # V/A = 100/10 = 10? Wait: V = Ip/100 * 10 = 0.1*Ip -> 0.1 V/A
# K_IPRI should be 0.1 V/A. Keep explicit:
K_IPRI_V_PER_A = 0.1

def dac_threshold_amp(dac):
    vth = VDDA * dac / 1024.0
    return vth / K_IPRI_V_PER_A

ITH_DAC300 = dac_threshold_amp(DAC300)
ITH_DAC320 = dac_threshold_amp(DAC320)

# ----------------------------------------------------------------------
# Model
# ----------------------------------------------------------------------
def make_deriv(Lr, Lm, Cr, n, Vin, Cout, Rload, Vf, f, deadtime, Rd=0.01):
    T = 1.0 / f
    dt = deadtime
    eps = 1e-3   # smoothing width for diode transition (A)

    def vab(t):
        cyc = t % T
        half = T / 2.0
        if cyc < half - dt / 2.0:
            return Vin
        if cyc < half + dt / 2.0:
            return 0.0
        if cyc < T - dt / 2.0:
            return -Vin
        return 0.0

    def deriv(t, x):
        ilr, vcr, ilm, vout = x
        va = vab(t)
        idiff = ilr - ilm
        vd = n * (vout + Vf)

        # Smooth center-tap rectifier model:
        #   vp ~= +/- vd with a small on-resistance, smoothly switched by tanh.
        # This avoids hard discontinuities and keeps the ODE solver stable.
        vp = vd * np.tanh(idiff / eps) + Rd * n * idiff

        dilr = (va - vcr - vp) / Lr
        dilm = vp / Lm
        isec = n * idiff                     # signed secondary current
        dvc = -ilr / Cr
        # Full-wave rectifier feeds |isec| into the output capacitor.
        dvout = (abs(isec) - vout / Rload) / Cout
        return [dilr, dvc, dilm, dvout]

    return deriv


def simulate(Lr=LR_NOM, Lm=LM_NOM, Cr=CR, n=N, Vin=VIN_NOM,
             Cout=COUT_NOM, Rload=RLOAD, Vf=0.7, f=150e3,
             deadtime=DEADTIME, Rd=0.01, ic=None, t_cycles=3.0,
             max_step=5e-9, rtol=1e-6, atol=1e-9, method="LSODA"):
    if ic is None:
        ic = [0.0, 0.0, 0.0, 0.0]
    T = 1.0 / f
    t_end = t_cycles * T
    deriv = make_deriv(Lr, Lm, Cr, n, Vin, Cout, Rload, Vf, f, deadtime, Rd)
    sol = solve_ivp(deriv, [0.0, t_end], ic, method=method,
                    max_step=max_step, rtol=rtol, atol=atol)
    if not sol.success:
        raise RuntimeError(f"solve_ivp failed: {sol.message}")
    return sol


def first_cycle_peaks(sol, f):
    T = 1.0 / f
    t = sol.t
    ilr = sol.y[0]
    half_mask = t <= T / 2.0
    cycle_mask = t <= T
    peak_half = float(np.max(np.abs(ilr[half_mask]))) if np.any(half_mask) else 0.0
    peak_cycle = float(np.max(np.abs(ilr[cycle_mask]))) if np.any(cycle_mask) else 0.0
    return peak_half, peak_cycle


# ----------------------------------------------------------------------
# Convergence check
# ----------------------------------------------------------------------
def convergence_check():
    print("Convergence check (150 kHz nominal, zero IC, Vf=0.7):")
    results = []
    for step in (20e-9, 10e-9, 5e-9, 2.5e-9):
        sol = simulate(f=150e3, max_step=step)
        ph, pc = first_cycle_peaks(sol, 150e3)
        results.append((step, ph, pc))
        print(f"  max_step={step*1e9:.1f}ns  peak_half={ph:.4f}  peak_cycle={pc:.4f}")
    return results


# ----------------------------------------------------------------------
# Run matrix
# ----------------------------------------------------------------------
def run_case(case_id, f, Lr=LR_NOM, Lm=LM_NOM, Vin=VIN_NOM, Cout=COUT_NOM,
             Vf=0.7, ic=None, t_cycles=3.0):
    sol = simulate(f=f, Lr=Lr, Lm=Lm, Vin=Vin, Cout=Cout, Vf=Vf, ic=ic,
                   t_cycles=t_cycles)
    ph, pc = first_cycle_peaks(sol, f)
    row = {
        "case": case_id,
        "f_khz": f / 1e3,
        "Lr_uH": Lr * 1e6,
        "Lm_uH": Lm * 1e6,
        "Vin": Vin,
        "Cout_uF": Cout * 1e6,
        "Vf": Vf,
        "ic_vcr": ic[1] if ic else 0.0,
        "ic_ilm": ic[2] if ic else 0.0,
        "ic_ilr": ic[0] if ic else 0.0,
        "peak_half_A": ph,
        "peak_cycle_A": pc,
        "cross_dac300": bool(pc >= ITH_DAC300),
        "cross_dac320": bool(pc >= ITH_DAC320),
    }
    return row, sol


# ----------------------------------------------------------------------
# Plots
# ----------------------------------------------------------------------
def plot_first_cycle(sol150, sol200, fname150, fname200, fname_compare):
    fig, ax = plt.subplots(2, 1, figsize=(8, 6), sharex=False)
    for ax_, sol, f, title, fn in [
        (ax[0], sol150, 150e3, "24V 150kHz first cycles", fname150),
        (ax[1], sol200, 200e3, "24V 200kHz first cycles", fname200),
    ]:
        t = sol.t * 1e6
        ax_.plot(t, sol.y[0], label="i_Lr")
        ax_.plot(t, sol.y[2], label="i_Lm", linestyle="--")
        ax_.axhline(ITH_DAC300, color="red", linestyle=":", label="DAC300 theoretical")
        ax_.axhline(ITH_DAC320, color="orange", linestyle=":", label="DAC320 theoretical")
        ax_.set_title(title)
        ax_.set_xlabel("time (us)")
        ax_.set_ylabel("A")
        ax_.legend(loc="best", fontsize=8)
        ax_.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(PLOTS / fname150)
    fig.savefig(PLOTS / fname200)
    plt.close(fig)

    # Compare first-cycle peaks
    ph150, pc150 = first_cycle_peaks(sol150, 150e3)
    ph200, pc200 = first_cycle_peaks(sol200, 200e3)
    fig, ax = plt.subplots(figsize=(6, 4))
    bars = ax.bar(["150kHz", "200kHz"], [pc150, pc200], color=["#4C72B0", "#DD8452"])
    ax.axhline(ITH_DAC300, color="red", linestyle=":", label=f"DAC300 {ITH_DAC300:.2f} A")
    ax.axhline(ITH_DAC320, color="orange", linestyle=":", label=f"DAC320 {ITH_DAC320:.2f} A")
    for b, v in zip(bars, [pc150, pc200]):
        ax.text(b.get_x() + b.get_width()/2, v + 0.1, f"{v:.2f} A", ha="center")
    ax.set_ylabel("First-cycle |i_Lr| peak (A)")
    ax.set_title("150kHz vs 200kHz nominal first-cycle peak")
    ax.legend()
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(PLOTS / fname_compare)
    plt.close(fig)


def plot_ic_sensitivity(ic_rows, fname):
    # Simple grouped bar / line for vCr sweep at iLm=0, iLr=0
    fig, ax = plt.subplots(figsize=(7, 5))
    for f in (150e3, 200e3):
        xs = []
        ys = []
        for r in ic_rows:
            if abs(r["ic_ilm"]) < 1e-9 and abs(r["ic_ilr"]) < 1e-9 and r["f_khz"] == f/1e3:
                xs.append(r["ic_vcr"])
                ys.append(r["peak_cycle_A"])
        order = np.argsort(xs)
        ax.plot(np.array(xs)[order], np.array(ys)[order], marker="o", label=f"{f/1e3:.0f} kHz")
    ax.axhline(ITH_DAC300, color="red", linestyle=":", label="DAC300")
    ax.axhline(ITH_DAC320, color="orange", linestyle=":", label="DAC320")
    ax.set_xlabel("Cr initial voltage (V)")
    ax.set_ylabel("First-cycle |i_Lr| peak (A)")
    ax.set_title("Initial-condition sensitivity (iLm=0, iLr=0)")
    ax.legend()
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(PLOTS / fname)
    plt.close(fig)


# ----------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------
def main():
    print("LLC_FIRST_CYCLE_CURRENT_MODEL_V1")
    print(f"DAC300 theoretical Ip threshold = {ITH_DAC300:.4f} A")
    print(f"DAC320 theoretical Ip threshold = {ITH_DAC320:.4f} A")

    conv = convergence_check()

    # Nominal runs for plots
    sol150 = simulate(f=150e3, Vf=0.7)
    sol200 = simulate(f=200e3, Vf=0.7)
    plot_first_cycle(sol150, sol200,
                     "01_24v_150k_first_cycle_current.png",
                     "02_24v_200k_first_cycle_current.png",
                     "03_150k_vs_200k_peak.png")

    all_rows = []
    all_rows.append(run_case("nom_150k", 150e3)[0])
    all_rows.append(run_case("nom_200k", 200e3)[0])

    # Initial-condition sweep (vCr x iLm x iLr small)
    ic_rows = []
    for f in FREQS:
        for vcr in (-2.0, -1.0, 0.0, 1.0, 2.0):
            for ilm in (-0.5, 0.0, 0.5):
                for ilr in (-0.1, 0.0, 0.1):
                    ic = [ilr, vcr, ilm, 0.0]
                    row, _ = run_case(f"ic_f{f/1e3:.0f}_vcr{vcr:+.0f}_ilm{ilm:+.1f}_ilr{ilr:+.1f}",
                                      f, ic=ic)
                    ic_rows.append(row)
    all_rows.extend(ic_rows)
    plot_ic_sensitivity(ic_rows, "04_initial_condition_sensitivity.png")

    # Parameter tolerance: single-variable + full factorial small
    param_rows = []
    # single variable
    for Lr in (LR_LOW, LR_NOM, LR_HIGH):
        row, _ = run_case(f"Lr_{Lr*1e6:.3f}u", 150e3, Lr=Lr)
        param_rows.append(row)
    for Lm in (LM_LOW, LM_NOM, LM_HIGH):
        row, _ = run_case(f"Lm_{Lm*1e6:.2f}u", 150e3, Lm=Lm)
        param_rows.append(row)
    for Vin in (VIN_LOW, VIN_NOM, VIN_HIGH):
        row, _ = run_case(f"Vin_{Vin:.1f}", 150e3, Vin=Vin)
        param_rows.append(row)
    # Cout scan (UNKNOWN board value)
    for Cout in COUT_CANDIDATES:
        for f in FREQS:
            row, _ = run_case(f"Cout_{Cout*1e6:.0f}u_f{f/1e3:.0f}k", f, Cout=Cout)
            param_rows.append(row)
    # Vf ideal vs engineering
    for Vf in (0.0, 0.7):
        for f in FREQS:
            row, _ = run_case(f"Vf_{Vf:.1f}_f{f/1e3:.0f}k", f, Vf=Vf)
            param_rows.append(row)
    # Full factorial over Lr x Lm x Vin x f (3*3*3*2=54)
    for Lr in (LR_LOW, LR_NOM, LR_HIGH):
        for Lm in (LM_LOW, LM_NOM, LM_HIGH):
            for Vin in (VIN_LOW, VIN_NOM, VIN_HIGH):
                for f in FREQS:
                    row, _ = run_case(
                        f"corner_Lr{Lr*1e6:.3f}_Lm{Lm*1e6:.2f}_Vin{Vin:.1f}_f{f/1e3:.0f}k",
                        f, Lr=Lr, Lm=Lm, Vin=Vin)
                    param_rows.append(row)
    all_rows.extend(param_rows)

    # Summary
    peaks150 = [r["peak_cycle_A"] for r in all_rows if r["f_khz"] == 150.0]
    peaks200 = [r["peak_cycle_A"] for r in all_rows if r["f_khz"] == 200.0]
    worst = max(all_rows, key=lambda r: r["peak_cycle_A"])
    nom150 = next(r for r in all_rows if r["case"] == "nom_150k")
    nom200 = next(r for r in all_rows if r["case"] == "nom_200k")

    summary = {
        "nominal_150k_peak_A": nom150["peak_cycle_A"],
        "nominal_200k_peak_A": nom200["peak_cycle_A"],
        "max_150k_peak_A": max(peaks150),
        "max_200k_peak_A": max(peaks200),
        "worst_case_peak_A": worst["peak_cycle_A"],
        "worst_case": worst["case"],
        "cross_dac300_any": any(r["cross_dac300"] for r in all_rows),
        "cross_dac320_any": any(r["cross_dac320"] for r in all_rows),
        "dac300_theory_A": ITH_DAC300,
        "dac320_theory_A": ITH_DAC320,
        "convergence": conv,
    }

    # CSV
    with open(BASE / "llc_first_cycle_summary.csv", "w", newline="") as f:
        fieldnames = list(all_rows[0].keys())
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_rows)

    with open(BASE / "llc_first_cycle_model_v1_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    print("\nSummary:")
    for k, v in summary.items():
        print(f"  {k}: {v}")

    print(f"\nWrote {len(all_rows)} rows to llc_first_cycle_summary.csv")


if __name__ == "__main__":
    main()
