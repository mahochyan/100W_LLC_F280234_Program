#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LLC_FIRST_CYCLE_MODEL_V2
========================
Extends V1 to the CSS024D tutorial soft-start dead-time and period-limit ramp.

Keeps V1 regressions:
  - 150 kHz DB36  -> ~31.4 A first-cycle peak
  - 200 kHz DB36  -> ~17.3 A first-cycle peak

Adds:
  - 150 kHz DB190 tutorial first-cycle
  - peak vs dead-time
  - tutorial first 5 / 20 soft-start steps
"""

import pathlib
import sys
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

import llc_first_cycle_model_v1 as v1

BASE = pathlib.Path(__file__).resolve().parent
PLOTS = BASE / "plots"
PLOTS.mkdir(exist_ok=True)

# Tutorial profile A
TUT_START_PERIOD = 401
TUT_STEP = 10
TUT_MAX_PERIOD = 1714
TUT_DT_START = 190
TUT_DT_MIN = 20

def run_and_peak(f, deadtime_counts, period=None, vf=0.7):
    dt = deadtime_counts / 60e6
    if period is None:
        # use v1 nominal period for frequency
        period = int(round(60e6 / f)) - 1
    sol = v1.simulate(f=f, deadtime=dt, max_step=5e-9, Vf=vf)
    # For custom period, v1.simulate always uses its own TBPRD from frequency;
    # to honor tutorial period exactly we re-run with a custom wrapper is not
    # trivial. For dead-time comparison this is sufficient because period is
    # derived from f. For soft-start steps we approximate by frequency.
    ph, pc = v1.first_cycle_peaks(sol, f)
    return ph, pc

def main():
    print("LLC_FIRST_CYCLE_MODEL_V2")

    # V1 regression
    ph150_36, pc150_36 = run_and_peak(150e3, 36)
    ph200_36, pc200_36 = run_and_peak(200e3, 36)
    ph150_190, pc150_190 = run_and_peak(150e3, 190)

    print(f"150k DB36  : half={ph150_36:.3f} cycle={pc150_36:.3f}")
    print(f"200k DB36  : half={ph200_36:.3f} cycle={pc200_36:.3f}")
    print(f"150k DB190 : half={ph150_190:.3f} cycle={pc150_190:.3f}")

    # Plot DB36 vs DB190 first cycle
    sol36 = v1.simulate(f=150e3, deadtime=36/60e6, max_step=5e-9)
    sol190 = v1.simulate(f=150e3, deadtime=190/60e6, max_step=5e-9)
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.plot(sol36.t*1e6, sol36.y[0], label="DB36")
    ax.plot(sol190.t*1e6, sol190.y[0], label="DB190")
    ax.axhline(v1.ITH_DAC300, color="red", ls=":", label="DAC300")
    ax.axhline(v1.ITH_DAC320, color="orange", ls=":", label="DAC320")
    ax.set_xlabel("time (us)")
    ax.set_ylabel("i_Lr (A)")
    ax.set_title("24V 150kHz first cycle: DB36 vs DB190")
    ax.legend()
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(PLOTS / "05_tutorial_db190_first_cycle.png")
    plt.close(fig)

    # Peak vs deadtime at 150k
    dts = list(range(20, 191, 10))
    peaks = []
    for dt in dts:
        _, pc = run_and_peak(150e3, dt)
        peaks.append(pc)
    fig, ax = plt.subplots(figsize=(7, 5))
    ax.plot(dts, peaks, marker="o")
    ax.axhline(v1.ITH_DAC300, color="red", ls=":", label="DAC300")
    ax.axhline(v1.ITH_DAC320, color="orange", ls=":", label="DAC320")
    ax.set_xlabel("dead-time counts")
    ax.set_ylabel("first-cycle peak (A)")
    ax.set_title("24V 150kHz peak vs dead-time")
    ax.legend()
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(PLOTS / "06_peak_vs_deadtime.png")
    plt.close(fig)

    # Tutorial soft-start first 20 steps
    steps = []
    peaks_steps = []
    period = TUT_START_PERIOD
    dt = TUT_DT_START
    for i in range(20):
        # approximate frequency from period
        f_approx = 60e6 / period
        _, pc = run_and_peak(f_approx, dt, period=period)
        steps.append(i+1)
        peaks_steps.append(pc)
        period = min(period + TUT_STEP, TUT_MAX_PERIOD)
        dt = max(dt - 1, TUT_DT_MIN)
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.plot(steps, peaks_steps, marker="o")
    ax.axhline(v1.ITH_DAC300, color="red", ls=":", label="DAC300")
    ax.axhline(v1.ITH_DAC320, color="orange", ls=":", label="DAC320")
    ax.set_xlabel("soft-start step (5 ms each)")
    ax.set_ylabel("first-cycle peak (A)")
    ax.set_title("Tutorial soft-start first 20 steps (period ramp + DT ramp)")
    ax.legend()
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(PLOTS / "07_tutorial_softstart_first_steps.png")
    plt.close(fig)

    # Summary output
    summary = {
        "150k_DB36_first_cycle_peak_A": pc150_36,
        "200k_DB36_first_cycle_peak_A": pc200_36,
        "150k_DB190_first_cycle_peak_A": pc150_190,
        "DB190_vs_DB36_reduction_pct": (pc150_36 - pc150_190) / pc150_36 * 100.0,
        "cross_dac300_db190": pc150_190 >= v1.ITH_DAC300,
        "cross_dac320_db190": pc150_190 >= v1.ITH_DAC320,
        "tutorial_first_5_step_peaks": peaks_steps[:5],
        "tutorial_first_20_step_peaks": peaks_steps,
    }
    import json
    with open(BASE / "llc_first_cycle_model_v2_summary.json", "w") as f:
        json.dump(summary, f, indent=2)
    print(json.dumps(summary, indent=2))

if __name__ == "__main__":
    main()
