#!/usr/bin/env python3
"""
llc_empirical_plant.py — 实测局部经验 plant（任务 REMOTE_BENCH §13）

用实板 150k/170k 两枪斜率建立 10V 附近 / 24V 输入 / 空载-轻载的局部模型：
  dV/dt(f) 线性插值于实测两点的斜率
  dV/df    局部增益斜率（V per Hz）

当前状态：实板两枪未执行 → 使用 FHA 理论斜率占位（标注 EMPIRICAL_LOCAL_MODEL PENDING）
实板数据填入位置：SHOT_150 / SHOT_170 字典（start_raw/end_raw/window_us）。

不能外推成 100W plant 事实——局部模型仅覆盖 24V/10V/空载轻载区域。
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from llc_virtual_plant import vout_open, NOM

# ----------------------------------------------------------------------
# 实板两枪数据（REMOTE_BENCH 后填入；当前占位 = 理论斜率）
# ----------------------------------------------------------------------
SHOT_150 = {"start_raw": None, "end_raw": None, "window_us": 300.0}
SHOT_170 = {"start_raw": None, "end_raw": None, "window_us": 300.0}

GAIN = 0.008089325   # V/raw（board_calibration.h）
OFFSET = -0.063715


def raw_to_v(raw):
    return GAIN * raw + OFFSET


def slope_from_shots(s150, s170, use_placeholder=True):
    """返回 (slope150_V_per_s, slope170_V_per_s, dVdf_V_per_Hz, status)"""
    if (s150["start_raw"] is not None and s170["start_raw"] is not None
            and not use_placeholder):
        dv150 = raw_to_v(s150["end_raw"]) - raw_to_v(s150["start_raw"])
        dv170 = raw_to_v(s170["end_raw"]) - raw_to_v(s170["start_raw"])
        sl150 = dv150 / (s150["window_us"] * 1e-6)
        sl170 = dv170 / (s170["window_us"] * 1e-6)
        dVdf = (sl170 - sl150) / (170e3 - 150e3)   # 每 Hz 斜率变化
        return sl150, sl170, dVdf, "EMPIRICAL_LOCAL_MODEL"
    # 占位：FHA 理论斜率（24V 轻载，标称参数）
    RL = 1e9
    v150 = vout_open(150e3, 24.0, NOM["Lr"], NOM["Cr"], NOM["Lm"], NOM["n"], RL, NOM["Vf"])[0]
    v170 = vout_open(170e3, 24.0, NOM["Lr"], NOM["Cr"], NOM["Lm"], NOM["n"], RL, NOM["Vf"])[0]
    # 理论稳态差 → 斜率占位（V/s，按 300µs 窗口内线性逼近稳态差的 30% 经验系数）
    k = 0.30
    sl150 = (v150 - 10.0) * k / 300e-6 if v150 > 10.0 else 0.0
    sl170 = (v170 - 10.0) * k / 300e-6 if v170 > 10.0 else 0.0
    dVdf = (sl170 - sl150) / (170e3 - 150e3)
    return sl150, sl170, dVdf, "EMPIRICAL_LOCAL_MODEL_PENDING(THEORETICAL_PLACEHOLDER)"


def dvdt_at_f(f, sl150, sl170):
    """局部模型：150~170k 线性插值 dV/dt；超出范围钳位到端点值（不外推）。"""
    if f <= 150e3:
        return sl150
    if f >= 170e3:
        return sl170
    return sl150 + (sl170 - sl150) * (f - 150e3) / (170e3 - 150e3)


if __name__ == "__main__":
    sl150, sl170, dVdf, status = slope_from_shots(SHOT_150, SHOT_170)
    print("=== EMPIRICAL LOCAL PLANT (24V, ~10V, no/light load) ===")
    print("status:", status)
    print(f"slope_150 = {sl150*1e3:.2f} V/ms")
    print(f"slope_170 = {sl170*1e3:.2f} V/ms")
    print(f"dV/df     = {dVdf*1e6:.4f} mV/Hz  ({(sl170-sl150)/20e3*1e6:.3f} mV/kHz)")
    print("限制：局部模型，不可外推 100W plant 事实。")
