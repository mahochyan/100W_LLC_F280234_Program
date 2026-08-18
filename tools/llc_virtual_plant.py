#!/usr/bin/env python3
"""
llc_virtual_plant.py — LLC 虚拟板 FHA 稳态模型 (OFFBENCH_LLC_VIRTUAL_BOARD_CHARACTERIZATION_V1)

Full-Bridge LLC + 副边中心抽头全波整流。
标称参数来自 docs/VIRTUAL_BOARD_PARAMETER_INVENTORY.md（冲突审计后采纳）：
  Lr = 3.385 uH (SCHEMATIC/MEASURED 级), Lm = 17.25 uH, Cr = 3.004 uF,
  n = Np/Ns_half = 1.25, Cout = 2350 uF, Vf = 0.7 V (ASSUMED).

输出: fr / fm / Ln / Z0 / Q / M(f) / Vout(f) / 原边 RMS / 副边 RMS / tank 电流
用法:
  python3 llc_virtual_plant.py            # 打印标称参数与关键频率点
  python3 llc_virtual_plant.py --scan     # 频率扫描 -> CSV + PNG
  python3 llc_virtual_plant.py --sweep    # Lr/Lm/Cr ±10% 敏感性表
"""
import argparse
import math
import os

import numpy as np

# ----------------------------------------------------------------------
# 标称参数（来源见 VIRTUAL_BOARD_PARAMETER_INVENTORY.md）
# ----------------------------------------------------------------------
NOM = {
    "Lr": 3.385e-6,
    "Lm": 17.25e-6,
    "Cr": 3.004e-6,
    "n": 1.25,          # Np 5T : Ns_half 4T
    "Cout": 2350e-6,
    "Vf": 0.7,          # 整流二极管正向压降（工程值 ASSUMED；0 也扫）
    "Vin_nom": 30.0,
    "Vout_target": 12.0,
}

FREQ_LIST = [35e3, 40e3, 45e3, 50e3, 60e3, 70e3, 80e3, 100e3,
             120e3, 140e3, 150e3, 170e3, 200e3, 250e3]
VIN_LIST = [24.0, 30.0, 36.0]
POWER_LIST = [0.0, 5.0, 10.0, 25.0, 50.0, 75.0, 100.0]   # 0 = 空载近似


# ----------------------------------------------------------------------
# FHA 核心
# ----------------------------------------------------------------------
def fr_LrCr(Lr, Cr):
    return 1.0 / (2.0 * math.pi * math.sqrt(Lr * Cr))


def fm_LrLmCr(Lr, Lm, Cr):
    return 1.0 / (2.0 * math.pi * math.sqrt((Lr + Lm) * Cr))


def rac(n, RL):
    """副边反射到原边的等效交流负载（全桥 + 全波整流）"""
    return 8.0 * n * n * RL / (math.pi * math.pi)


def fha_gain(f, Lr, Cr, Lm, n, RL):
    """FHA 电压增益 M(f)。RL 为副边直流负载电阻。"""
    w = 2.0 * math.pi * f
    Rac = rac(n, RL)
    Zr = 1j * w * Lr + 1.0 / (1j * w * Cr)
    if RL > 1e12:
        Zm = 1j * w * Lm
    else:
        Zm = (1j * w * Lm * Rac) / (1j * w * Lm + Rac)
    return abs(Zm / (Zr + Zm))


def zin_abs(f, Lr, Cr, Lm, n, RL):
    """输入阻抗模（原边，含副边反射负载）"""
    w = 2.0 * math.pi * f
    Rac = rac(n, RL)
    Zm = (1j * w * Lm * Rac) / (1j * w * Lm + Rac)
    return abs(1j * w * Lr + 1.0 / (1j * w * Cr) + Zm)


def vout_open(f, Vin, Lr, Cr, Lm, n, RL, Vf):
    """开环输出电压（全桥 FHA）：Vout = Vin*M/(2n) - Vf"""
    M = fha_gain(f, Lr, Cr, Lm, n, RL)
    return Vin * M / (2.0 * n) - Vf, M


def currents(f, Vin, Lr, Cr, Lm, n, RL, Vout, Pout):
    """电流估计。
    I_p_rms   = 原边基波 RMS（阻抗法）
    I_tank    = 谐振腔电流（≈原边电流）
    I_s_rms   = 副边半绕组 RMS（≈ I_p_rms * n，变压器关系）
    I_s_diode_avg = 每只整流管平均电流（Pout/Vout/2 对全波）
    """
    w = 2.0 * math.pi * f
    V1_rms = 2.0 * math.sqrt(2.0) * Vin / math.pi   # 全桥基波 RMS
    Zin = zin_abs(f, Lr, Cr, Lm, n, RL)
    I_p_rms = V1_rms / Zin if Zin > 0 else 0.0
    I_s_rms = I_p_rms * n
    I_dc = Pout / Vout if Vout > 0.1 else 0.0
    I_s_diode_avg = I_dc / 2.0
    I_s_diode_rms = I_dc * math.pi / (2.0 * math.sqrt(2.0)) if I_dc > 0 else 0.0
    return {
        "I_p_rms": I_p_rms, "I_tank": I_p_rms,
        "I_s_rms": I_s_rms,
        "I_s_diode_avg": I_s_diode_avg, "I_s_diode_rms": I_s_diode_rms,
    }


def required_gain(Vin, Vout_target, n, Vf=0.7):
    """达到目标 Vout 所需的 LLC 增益 M_req = (Vout+Vf)*2n/Vin"""
    return (Vout_target + Vf) * 2.0 * n / Vin


# ----------------------------------------------------------------------
# 扫描 / 输出
# ----------------------------------------------------------------------
def scan(vin_list=VIN_LIST, freq_list=FREQ_LIST, power_list=POWER_LIST,
         params=None, vout_target=NOM["Vout_target"]):
    """返回 rows: dict 列表"""
    p = dict(NOM)
    if params:
        p.update(params)
    rows = []
    for Vin in vin_list:
        for Pout in power_list:
            RL = 1e9 if Pout <= 0 else vout_target * vout_target / Pout
            for f in freq_list:
                Vout, M = vout_open(f, Vin, p["Lr"], p["Cr"], p["Lm"], p["n"], RL, p["Vf"])
                cur = currents(f, Vin, p["Lr"], p["Cr"], p["Lm"], p["n"], RL,
                               max(Vout, 0.1), Pout)
                rows.append({
                    "Vin": Vin, "Pout": Pout, "freq_hz": f,
                    "gain_M": M, "vout": Vout,
                    "I_p_rms": cur["I_p_rms"], "I_s_rms": cur["I_s_rms"],
                    "I_diode_avg": cur["I_s_diode_avg"],
                    "I_diode_rms": cur["I_s_diode_rms"],
                    "Q": math.sqrt(p["Lr"]/p["Cr"]) / rac(p["n"], RL) if RL < 1e9 else 0.0,
                })
    return rows


def summary(params=None):
    p = dict(NOM)
    if params:
        p.update(params)
    fr = fr_LrCr(p["Lr"], p["Cr"])
    fm = fm_LrLmCr(p["Lr"], p["Lm"], p["Cr"])
    Ln = p["Lm"] / p["Lr"]
    Z0 = math.sqrt(p["Lr"] / p["Cr"])
    print("=== LLC 虚拟板标称参数 ===")
    for k, v in p.items():
        print(f"  {k:12s} = {v}")
    print(f"  fr        = {fr/1e3:.1f} kHz")
    print(f"  fm        = {fm/1e3:.1f} kHz")
    print(f"  Ln        = {Ln:.2f}")
    print(f"  Z0        = {Z0:.3f} ohm")
    for Vin in VIN_LIST:
        M_req = required_gain(Vin, 12.0, p["n"], p["Vf"])
        print(f"  M_req(12V, Vin={Vin:5.1f}) = {M_req:.3f}")
    return {"fr": fr, "fm": fm, "Ln": Ln, "Z0": Z0}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--scan", action="store_true", help="频率扫描 -> CSV/PNG")
    ap.add_argument("--sweep", action="store_true", help="Lr/Lm/Cr ±10% 敏感性")
    args = ap.parse_args()

    outdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "virtual_board_out")
    os.makedirs(outdir, exist_ok=True)

    if args.sweep:
        print("=== 敏感性：Lr/Lm/Cr ±10% 对 fr / M@150k / 100W 频率 ===")
        base = summary()
        import json
        sweep_rows = []
        for key in ["Lr", "Lm", "Cr"]:
            for scale in [0.9, 1.0, 1.1]:
                prm = {key: NOM[key] * scale}
                fr = fr_LrCr(prm.get("Lr", NOM["Lr"]), prm.get("Cr", NOM["Cr"]))
                # M @150k, 100W(RL=1.44), 30V
                M150 = fha_gain(150e3, prm.get("Lr", NOM["Lr"]), prm.get("Cr", NOM["Cr"]),
                                prm.get("Lm", NOM["Lm"]), NOM["n"], 12*12/100)
                sweep_rows.append({"param": key, "scale": scale, "fr_hz": fr,
                                  "M150_100W": M150})
        with open(os.path.join(outdir, "sensitivity.csv"), "w") as fh:
            fh.write("param,scale,fr_hz,M150_100W\n")
            for r in sweep_rows:
                fh.write(f"{r['param']},{r['scale']},{r['fr_hz']:.1f},{r['M150_100W']:.4f}\n")
                print(f"  {r['param']} {r['scale']:+.0%}: fr={r['fr_hz']/1e3:.1f}kHz  M150={r['M150_100W']:.3f}")
        print("saved:", os.path.join(outdir, "sensitivity.csv"))
        raise SystemExit

    if args.scan:
        rows = scan()
        import csv
        csv_path = os.path.join(outdir, "freq_scan.csv")
        with open(csv_path, "w", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
        print("saved:", csv_path, "rows:", len(rows))

        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        for metric, ylab, title in [
            ("gain_M", "LLC gain M(f)", "gain_vs_frequency"),
            ("vout", "Vout (V)", "vout_vs_frequency"),
            ("I_p_rms", "Primary RMS current (A)", "primary_current_vs_frequency"),
        ]:
            fig, axes = plt.subplots(1, 3, figsize=(15, 4.5), sharex=True)
            for ax, Vin in zip(axes, VIN_LIST):
                for Pout in [5, 25, 50, 100]:
                    sel = [r for r in rows if r["Vin"] == Vin and abs(r["Pout"] - Pout) < 0.5]
                    if not sel:
                        continue
                    sel.sort(key=lambda r: r["freq_hz"])
                    ax.plot([r["freq_hz"]/1e3 for r in sel],
                            [r[metric] for r in sel],
                            label=f"{Pout:.0f}W")
                ax.set_title(f"Vin={Vin:.0f}V")
                ax.set_xlabel("f (kHz)")
                ax.grid(alpha=0.3)
                if ax is axes[0]:
                    ax.set_ylabel(ylab)
                ax.legend(fontsize=8)
            fig.suptitle(title)
            fig.tight_layout()
            png = os.path.join(outdir, title + ".png")
            fig.savefig(png, dpi=110)
            plt.close(fig)
            print("saved:", png)
        # 空载曲线（0W）
        for metric, ylab, title in [
            ("gain_M", "LLC gain M(f) no-load", "gain_vs_frequency_noload"),
            ("vout", "Vout (V) no-load", "vout_vs_frequency_noload"),
        ]:
            fig, axes = plt.subplots(1, 3, figsize=(15, 4.5), sharex=True)
            for ax, Vin in zip(axes, VIN_LIST):
                sel = [r for r in rows if r["Vin"] == Vin and r["Pout"] == 0.0]
                sel.sort(key=lambda r: r["freq_hz"])
                ax.plot([r["freq_hz"]/1e3 for r in sel], [r[metric] for r in sel],
                        marker="o", ms=3)
                ax.set_title(f"Vin={Vin:.0f}V no-load")
                ax.set_xlabel("f (kHz)")
                ax.grid(alpha=0.3)
                if ax is axes[0]:
                    ax.set_ylabel(ylab)
            fig.suptitle(title)
            fig.tight_layout()
            png = os.path.join(outdir, title + ".png")
            fig.savefig(png, dpi=110)
            plt.close(fig)
            print("saved:", png)
        raise SystemExit

    summary()
    # 关键点：150k/170k 方向
    print("\n=== 150k vs 170k 方向（24V, 轻载 RL=1000）===")
    for f in [150e3, 170e3]:
        Vout, M = vout_open(f, 24.0, NOM["Lr"], NOM["Cr"], NOM["Lm"], NOM["n"], 1000.0, NOM["Vf"])
        print(f"  f={f/1e3:.0f}k: M={M:.4f} Vout={Vout:.2f}V")
