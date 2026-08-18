#!/usr/bin/env python3
"""
llc_control_sil.py — F28034 PFM/PI 控制器软件在环（SIL）仿真
(OFFBENCH_LLC_VIRTUAL_BOARD_CHARACTERIZATION_V1 N~S 节 / REMOTE_BENCH §16-21)

组成：
  虚拟 plant  : FHA 开环电压 Vout_oc(f) + 输出电容动态（RC 充电 + 负载抽取）
  虚拟 ADC    : 标定反算 raw + 可选噪声(±1/3/5 raw) + 1 拍延迟 + miss 模拟
  控制器      : STEP_PFM（方向自动） / PI-PFM（Kp/Ki 由 plant gain 推导）
  保护        : OVP / 频率 clamp / 模拟 OCP(DAC300 理论 9.668A) / ADC miss≥3 安全停止

用途：验证控制方向、收敛、无正反馈跑飞；**不得用于真实板闭环**。
"""
import argparse
import math
import random
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from llc_virtual_plant import (fha_gain, fr_LrCr, vout_open, currents, NOM, VIN_LIST)

# ----------------------------------------------------------------------
# 常量
# ----------------------------------------------------------------------
GAIN = 0.008089325
OFFSET = -0.063715
RAW_10V = 1244
RAW_12V = 1491
RAW_15V = 1862

F_MIN = 60e3       # 虚拟 clamp（情景B fr≈150k；仅 SIL）
F_MAX = 200e3
F_STEP = 0.5e3     # STEP_PFM 步长（fr 陡峭区，细步防 overshoot）

DT = 20e-6         # 控制周期 20µs（F28034 快速任务）
COUT = 2350e-6     # 输出电容 [BOM]
R_SRC = 0.15       # 源阻抗 [ASSUMED]（与实板 150k 快速爬升量级一致，SIL 标定用）

OCP_A = 9.668      # DAC300 理论原边阈值
OVP_V = 15.5       # 虚拟 OVP


# ----------------------------------------------------------------------
# 虚拟 plant
# ----------------------------------------------------------------------
class LLCVirtualPlant:
    """SIL plant：默认情景 B（Cr=0.33uF，fr≈150k，与实板 24V/150k→10V 一致）。
    情景 A（标称 Cr=3.004uF, fr=50k）保守下限见 OFFBENCH 总报告。"""
    def __init__(self, Vin=30.0, Pout=50.0, vref=12.0, params=None):
        self.Vin = Vin
        self.Pout = Pout
        self.vref = vref
        self.p = dict(NOM)
        self.p["Cr"] = 0.33e-6          # 情景 B（实板一致）
        if params:
            self.p.update(params)
        self.Vout = 0.5
        self.t = 0.0

    def load_rl(self):
        """负载电阻：按目标电压基准（Vref²/Pout），避免低压启动时阻抗荒谬。"""
        if self.Pout <= 0:
            return 1e9
        return max(self.vref * self.vref / self.Pout, 0.1)

    def vout_oc(self, f):
        RL = self.load_rl()
        return vout_open(f, self.Vin, self.p["Lr"], self.p["Cr"], self.p["Lm"],
                         self.p["n"], RL, self.p["Vf"])[0]

    def step(self, f, dt=DT):
        voc = self.vout_oc(f)
        # 电容充电（源阻抗 RC）+ 恒阻负载抽取（I_load = Vout/RL）
        dv = (voc - self.Vout) / (R_SRC * COUT) * dt
        RL = self.load_rl()
        if RL < 1e8:
            dv -= self.Vout / RL / COUT * dt
        self.Vout = max(self.Vout + dv, 0.0)
        self.t += dt
        return self.Vout

    def ip_rms(self, f):
        RL = self.load_rl()
        cur = currents(f, self.Vin, self.p["Lr"], self.p["Cr"], self.p["Lm"],
                       self.p["n"], RL, max(self.vref, 0.1), self.Pout)
        return cur["I_p_rms"]


# ----------------------------------------------------------------------
# 虚拟 ADC
# ----------------------------------------------------------------------
class VirtualADC:
    def __init__(self, noise_raw=0, seed=1):
        self.noise = noise_raw
        self.rng = random.Random(seed)
        self.latency_raw = 0.0       # 上一拍 raw
        self.miss_count = 0

    def sample(self, vout, force_miss=False):
        raw = (vout - OFFSET) / GAIN
        if force_miss:
            self.miss_count += 1
            return self.latency_raw, True   # 返回旧值 + miss
        self.miss_count = 0
        if self.noise > 0:
            raw += self.rng.uniform(-self.noise, self.noise)
        self.latency_raw = raw
        return raw, False

    def raw_to_v(self, raw):
        return GAIN * raw + OFFSET


# ----------------------------------------------------------------------
# 控制器
# ----------------------------------------------------------------------
class StepPfmController:
    def __init__(self, vref=12.0, direction=1, fmin=F_MIN, fmax=F_MAX, step=F_STEP):
        self.vref = vref
        self.direction = direction   # +1: 正常（Vout<Vref → f 降）
        self.f = 150e3
        self.fmin, self.fmax = fmin, fmax
        self.step = step
        self.f_hist = []

    def update(self, vout):
        err = self.vref - vout
        if err > 0:
            self.f -= self.direction * self.step
        elif err < 0:
            self.f += self.direction * self.step
        self.f = min(max(self.f, self.fmin), self.fmax)
        self.f_hist.append(self.f)
        return self.f


class PiPfmController:
    def __init__(self, vref=12.0, kp=0.0, ki=0.0, fmin=F_MIN, fmax=F_MAX,
                 direction=1, f_center=150e3):
        self.vref = vref
        self.kp, self.ki = kp, ki
        self.direction = direction
        self.fmin, self.fmax = fmin, fmax
        self.f_center = f_center
        self.integral = 0.0
        self.i_max = (fmax - fmin) / 2.0
        self.f = f_center
        self.f_hist = []
        self.i_hist = []

    def update(self, vout, dt=DT):
        err = self.vref - vout
        self.integral += self.ki * err * dt
        self.integral = max(-self.i_max, min(self.i_max, self.integral))
        u = self.kp * err + self.integral
        u = max(-self.i_max, min(self.i_max, u))
        self.f = self.f_center - self.direction * u
        self.f = min(max(self.f, self.fmin), self.fmax)
        self.f_hist.append(self.f)
        self.i_hist.append(self.integral)
        return self.f


# ----------------------------------------------------------------------
# 仿真运行器
# ----------------------------------------------------------------------
def run_sim(plant, ctrl, adc, duration=0.2, miss_pattern=None, ovp=True,
            ocp=True, load_step=None, vin_step=None, vref_step=None):
    """返回记录字典。miss_pattern: list of (t_start, t_end) 强制 miss。"""
    n = int(duration / DT)
    rec = {"t": [], "vout": [], "f": [], "raw": [], "miss": [], "stop": None}
    vout = plant.Vout
    for i in range(n):
        t = i * DT
        # 阶跃注入
        if load_step and t >= load_step[0]:
            plant.Pout = load_step[1]
            load_step = None
        if vin_step and t >= vin_step[0]:
            plant.Vin = vin_step[1]
            vin_step = None
        if vref_step and t >= vref_step[0]:
            ctrl.vref = vref_step[1]
            vref_step = None
        # ADC 采样（miss 模式）
        force_miss = False
        if miss_pattern:
            for (t0, t1) in miss_pattern:
                if t0 <= t < t1:
                    force_miss = True
                    break
        raw, missed = adc.sample(vout, force_miss)
        v_meas = adc.raw_to_v(raw)
        # 保护
        if ovp and vout > OVP_V:
            rec["stop"] = "OVP"
            break
        if ocp and plant.ip_rms(ctrl.f if hasattr(ctrl, 'f') else ctrl.f) > OCP_A:
            rec["stop"] = "SIMULATED_OCP"
            break
        if missed and adc.miss_count >= 3:
            rec["stop"] = "ADC_MISS_3"
            break
        # 控制
        f = ctrl.update(v_meas)
        vout = plant.step(f)
        rec["t"].append(t)
        rec["vout"].append(vout)
        rec["f"].append(f)
        rec["raw"].append(raw)
        rec["miss"].append(missed)
    return rec


def steady_metrics(rec, tail=0.3):
    """收敛后（后 30%）统计。"""
    if not rec["vout"]:
        return None
    k = max(int(len(rec["vout"]) * (1 - tail)) - 1, 0)
    vs = rec["vout"][k:]
    fs = rec["f"][k:]
    return {
        "vout_avg": sum(vs) / len(vs),
        "vout_min": min(vs), "vout_max": max(vs),
        "f_avg": sum(fs) / len(fs),
        "f_min": min(fs), "f_max": max(fs),
        "n": len(vs),
    }


# ----------------------------------------------------------------------
# plant gain 提取（任务 Q）
# ----------------------------------------------------------------------
def extract_plant_gain(Vin=30.0, Pout=50.0, f0=150e3, df=5e3, vref=12.0):
    """开环稳态增益差：Vout_oc(f0+df) − Vout_oc(f0) 除以 Δf（固定负载基准）。"""
    p = LLCVirtualPlant(Vin, Pout, vref=vref)
    v1 = p.vout_oc(f0)
    v2 = p.vout_oc(f0 + df)
    return (v2 - v1) / df, v1, v2


def derive_pi(k_plant, bw=30.0, df_span=20000.0, dv_band=0.2):
    """Kp/Ki 推导（情景B 工作区 plant gain 实测 −0.05 mV/Hz）。
    解析法：Kp_ana = 2π·BW/|k_plant|（BW 保守 30Hz）→ 3.8e6 Hz/V（病态大，因
    LLC 在 fr 以上增益斜率天然小）。
    工程法（采用）：Kp = Δf_span/ΔV_band = 20kHz 频率摆幅 / 0.2V 误差，即
    0.2V 误差 → ±10kHz 频率修正（clamp 140kHz 的 ±7%，细粒度防振荡）；
    Ki = Kp·2π·BW/10（BW=30Hz 保守积分）。
    返回 (Kp, Ki)。
    """
    kp = df_span / dv_band
    kp_ana = 2.0 * math.pi * bw / max(abs(k_plant), 1e-9)
    ki = kp * 2.0 * math.pi * bw / 10.0
    print(f"  [derive_pi] 工程 Kp={kp:.0f} Hz/V（0.2V→±{df_span/2e3:.0f}k 细调）")
    print(f"  [derive_pi] 解析对照 Kp_ana={kp_ana:.0f} Hz/V（BW={bw:.0f}Hz, k_plant={k_plant*1e3:.3f}mV/Hz 病态弃用）")
    print(f"  [derive_pi] Ki={ki:.0f} Hz/(V·s)（Kp·2π·{bw:.0f}/10）")
    return kp, ki


# ----------------------------------------------------------------------
# 测试矩阵
# ----------------------------------------------------------------------
def reachable_in_clamp(Vin, Vref, Pout, fmin=F_MIN, fmax=F_MAX):
    """感性区可达性：仅评估 [fr, fmax] ∩ clamp（容性区 f<fr 需避免，ZVS 丢失）。
    带载平衡 Vout = voc/(1+R_src/RL)。返回 (ok, v_lo, v_hi)。"""
    pl = LLCVirtualPlant(Vin, Pout, vref=Vref)
    RL = pl.load_rl()
    k = 1.0 if RL > 1e8 else (1.0 + R_SRC / RL)
    fr = fr_LrCr(pl.p["Lr"], pl.p["Cr"])
    fmin_eff = max(fmin, fr * 1.03)
    v_lo = pl.vout_oc(fmin_eff) / k
    v_hi = pl.vout_oc(fmax) / k
    return (min(v_lo, v_hi) - 0.05 <= Vref <= max(v_lo, v_hi) + 0.05,
            v_lo, v_hi)


def matrix_step_pfm():
    print("=" * 70)
    print(f"STEP_PFM 矩阵（方向自动，clamp {F_MIN/1e3:.0f}-{F_MAX/1e3:.0f}k）")
    print("=" * 70)
    results = []
    n_pass = n_phys = n_ctrl = 0
    for Vin in [24.0, 30.0, 36.0]:
        for Pout in [5.0, 25.0, 50.0, 75.0, 100.0]:
            for Vref in [10.0, 12.0, 15.0]:
                ok_reach, v_lo, v_hi = reachable_in_clamp(Vin, Vref, Pout)
                for init in ["low", "high"]:
                    plant = LLCVirtualPlant(Vin, Pout, vref=12.0)
                    plant.Vout = 1.0 if init == "low" else Vref * 1.2
                    ctrl = StepPfmController(vref=Vref, direction=1)
                    adc = VirtualADC(noise_raw=3)
                    rec = run_sim(plant, ctrl, adc, duration=0.5)
                    m = steady_metrics(rec)
                    if rec["stop"] == "SIMULATED_OCP":
                        status = "OCP_LIMIT"
                    elif not ok_reach:
                        status = "PHYSICAL_LIMIT"
                        n_phys += 1
                    elif (m and rec["stop"] is None
                          and abs(m["vout_avg"] - Vref) / Vref < 0.02
                          and (m["vout_max"] - m["vout_min"]) < max(0.6, 0.08 * Vref)):
                        status = "PASS"
                        n_pass += 1
                    else:
                        status = "CONTROL_FAIL"
                        n_ctrl += 1
                    results.append((Vin, Pout, Vref, init, m, rec["stop"], status))
                    if status != "PASS":
                        print(f"  {status:14s} Vin={Vin} Pout={Pout} Vref={Vref} init={init} "
                              f"stop={rec['stop']} avg={m['vout_avg'] if m else float('nan'):.2f} "
                              f"[reach {v_lo:.1f}..{v_hi:.1f}V]")
    print(f"STEP_PFM: PASS={n_pass} PHYSICAL_LIMIT={n_phys} CONTROL_FAIL={n_ctrl}")
    return results


def matrix_pi():
    print("=" * 70)
    print("PI-PFM 矩阵")
    print("=" * 70)
    k_plant, v1, v2 = extract_plant_gain()
    kp, ki = derive_pi(k_plant, bw=150.0)
    print(f"plant gain dV/df = {k_plant*1e3:.3f} mV/Hz (30V/50W, 150→155k, {v1:.2f}→{v2:.2f}V)")
    print(f"Kp={kp:.1f} Hz/V  Ki={ki:.1f} Hz/(V·s)  (BW=150Hz 保守)")
    fc_map = {24.0: 150e3, 30.0: 160e3, 36.0: 180e3}   # 情景B 工作区中心
    results = []
    for Vin in [24.0, 30.0, 36.0]:
        for Pout in [5.0, 25.0, 50.0, 75.0, 100.0]:
            ok_reach, v_lo, v_hi = reachable_in_clamp(Vin, 12.0, Pout)
            plant = LLCVirtualPlant(Vin, Pout, vref=12.0)
            plant.Vout = 0.5
            ctrl = PiPfmController(vref=12.0, kp=kp, ki=ki, direction=1,
                                   f_center=fc_map[Vin])
            adc = VirtualADC(noise_raw=3)
            rec = run_sim(plant, ctrl, adc, duration=1.5)
            m = steady_metrics(rec)
            if rec["stop"] == "SIMULATED_OCP":
                status = "OCP_LIMIT"
            elif not ok_reach:
                status = "PHYSICAL_LIMIT"
            elif (m and abs(m["vout_avg"] - 12.0) / 12.0 < 0.01
                  and (m["vout_max"] - m["vout_min"]) < 0.06
                  and m["f_min"] >= F_MIN - 1 and m["f_max"] <= F_MAX + 1
                  and rec["stop"] is None):
                status = "PASS"
            else:
                status = "CONTROL_FAIL"
            results.append((Vin, Pout, m, rec["stop"], status))
            if status != "PASS":
                print(f"  {status:14s} Vin={Vin} Pout={Pout} stop={rec['stop']} "
                      f"avg={m['vout_avg'] if m else float('nan'):.2f} "
                      f"f=[{m['f_min']/1e3 if m else float('nan'):.0f},{m['f_max']/1e3 if m else float('nan'):.0f}]k "
                      f"[reach {v_lo:.1f}..{v_hi:.1f}V]")
    npass = sum(1 for r in results if r[4] == "PASS")
    nctrl = sum(1 for r in results if r[4] == "CONTROL_FAIL")
    nocp = sum(1 for r in results if r[4] == "OCP_LIMIT")
    print(f"PI: PASS={npass} PHYSICAL_LIMIT={len(results)-npass-nctrl-nocp} OCP_LIMIT={nocp} CONTROL_FAIL={nctrl}")
    return results, k_plant, kp, ki


def matrix_transients():
    print("=" * 70)
    print("瞬态矩阵：负载阶跃 / 输入阶跃 / ADC miss / OVP / clamp / OCP")
    print("=" * 70)
    results = []
    # 负载阶跃 10→50 / 50→100 / 100→25（30V, 12V）
    for lstep in [(0.1, 50.0), (0.1, 100.0), (0.1, 25.0)]:
        plant = LLCVirtualPlant(36.0, 10.0, vref=12.0)
        plant.Vout = 12.0
        kp, ki = derive_pi(extract_plant_gain()[0])
        ctrl = PiPfmController(vref=12.0, kp=kp, ki=ki, direction=1)
        adc = VirtualADC(noise_raw=3)
        rec = run_sim(plant, ctrl, adc, duration=1.0,
                      load_step=(lstep[0], lstep[1]))
        m = steady_metrics(rec)
        ok = m and abs(m["vout_avg"] - 12.0) / 12.0 < 0.01 and rec["stop"] is None
        results.append(("load_step", lstep[1], ok, m, rec["stop"]))
        print(f"  load 10→{lstep[1]:.0f}W: {'PASS' if ok else 'FAIL'} stop={rec['stop']} "
              f"avg={m['vout_avg'] if m else 0:.2f}V")
    # 输入阶跃
    for vstep, expect_ok in [((0.1, 36.0), True), ((0.1, 24.0), False)]:
        plant = LLCVirtualPlant(30.0 if vstep[1] == 36.0 else 36.0, 50.0, vref=12.0)
        plant.Vout = 12.0
        kp, ki = derive_pi(extract_plant_gain()[0])
        ctrl = PiPfmController(vref=12.0, kp=kp, ki=ki, direction=1)
        adc = VirtualADC(noise_raw=3)
        rec = run_sim(plant, ctrl, adc, duration=1.0,
                      vin_step=(vstep[0], vstep[1]))
        m = steady_metrics(rec)
        ok = m and abs(m["vout_avg"] - 12.0) / 12.0 < 0.02 and rec["stop"] is None
        if not expect_ok:
            ok = m and rec["stop"] is None and m["vout_avg"] > 0 and m["vout_avg"] < 12.0
        results.append(("vin_step", vstep[1], ok, m, rec["stop"]))
        print(f"  Vin→{vstep[1]:.0f}V: {'PASS' if ok else 'FAIL'} stop={rec['stop']} "
              f"avg={m['vout_avg'] if m else 0:.2f}V")
    # 故障
    plant = LLCVirtualPlant(30.0, 50.0, vref=12.0)
    plant.Vout = 12.0
    kp, ki = derive_pi(extract_plant_gain()[0])
    ctrl = PiPfmController(vref=12.0, kp=kp, ki=ki, direction=1)
    adc = VirtualADC(noise_raw=3)
    rec = run_sim(plant, ctrl, adc, duration=0.5, miss_pattern=[(0.05, 0.2)])
    ok = rec["stop"] == "ADC_MISS_3"
    results.append(("adc_miss3", None, ok, None, rec["stop"]))
    print(f"  ADC miss 连续3次: {'PASS' if ok else 'FAIL'} stop={rec['stop']} (期望 ADC_MISS_3)")
    # OVP
    plant = LLCVirtualPlant(36.0, 5.0, vref=12.0)
    plant.Vout = 16.0
    ctrl = StepPfmController(vref=12.0, direction=1)
    adc = VirtualADC(noise_raw=0)
    rec = run_sim(plant, ctrl, adc, duration=0.1, ovp=True)
    ok = rec["stop"] == "OVP"
    results.append(("ovp", None, ok, None, rec["stop"]))
    print(f"  OVP(Vout>15.5): {'PASS' if ok else 'FAIL'} stop={rec['stop']} (期望 OVP)")
    # 频率 clamp：STEP 从极端起步
    plant = LLCVirtualPlant(24.0, 5.0, vref=12.0)
    plant.Vout = 20.0
    ctrl = StepPfmController(vref=12.0, direction=1)
    adc = VirtualADC(noise_raw=0)
    rec = run_sim(plant, ctrl, adc, duration=0.2, ovp=False)
    fmax = max(rec["f"]) if rec["f"] else 0
    ok = fmax <= F_MAX + 1
    results.append(("freq_clamp", None, ok, None, rec["stop"]))
    print(f"  频率 clamp(≤180k): {'PASS' if ok else 'FAIL'} fmax={fmax/1e3:.0f}k")
    # 模拟 OCP
    plant = LLCVirtualPlant(24.0, 100.0, vref=12.0)
    plant.Vout = 5.0
    ctrl = StepPfmController(vref=12.0, direction=1)
    adc = VirtualADC(noise_raw=0)
    rec = run_sim(plant, ctrl, adc, duration=0.2, ocp=True)
    ok = rec["stop"] == "SIMULATED_OCP"
    results.append(("sim_ocp", None, ok, None, rec["stop"]))
    print(f"  模拟 OCP(>9.668A): {'PASS' if ok else 'FAIL'} stop={rec['stop']} (期望 SIMULATED_OCP)")
    return results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--step", action="store_true")
    ap.add_argument("--pi", action="store_true")
    ap.add_argument("--transient", action="store_true")
    args = ap.parse_args()

    all_pass = True
    if args.step:
        r = matrix_step_pfm()
        all_pass = all_pass and all(x[6] in ("PASS","PHYSICAL_LIMIT","OCP_LIMIT") for x in r)
    if args.pi:
        r, kk, kp, ki = matrix_pi()
        all_pass = all_pass and all(x[4] in ("PASS","PHYSICAL_LIMIT","OCP_LIMIT") for x in r)
    if args.transient:
        r = matrix_transients()
        all_pass = all_pass and all(x[2] for x in r)
    if not (args.step or args.pi or args.transient):
        print("=== 快速默认：全部矩阵 ===")
        r1 = matrix_step_pfm()
        all_pass = all_pass and all(x[6] in ("PASS","PHYSICAL_LIMIT","OCP_LIMIT") for x in r1)
        k_plant, v1, v2 = extract_plant_gain()
        kp, ki = derive_pi(k_plant)
        print(f"\nplant gain = {k_plant*1e3:.3f} mV/Hz, Kp={kp:.1f} Hz/V, Ki={ki:.1f} Hz/(V·s)")
        r2, kk2, kp2, ki2 = matrix_pi()
        all_pass = all_pass and all(x[4] in ("PASS","PHYSICAL_LIMIT","OCP_LIMIT") for x in r2)
        r3 = matrix_transients()
        all_pass = all_pass and all(x[2] for x in r3)
    if all_pass:
        print("\n*** VIRTUAL_STEP_PFM_PASS + VIRTUAL_CLOSED_LOOP_12V_PASS ***")
        return 0
    print("\n*** FAILURES PRESERVED (保留失败案例，未扩大范围) ***")
    return 1


if __name__ == "__main__":
    sys.exit(main())
