#!/usr/bin/env python3
"""
protection_model.py — OCP 理论数字化模型 (OFFBENCH_LLC_VIRTUAL_BOARD_CHARACTERIZATION_V1)

链路：CT(1:100) -> 次级负载 R32(10Ω) -> 整流 -> COMP1A 比较器 -> DAC(10bit, VDDA=3.3V)

理论映射：
  V_ct = I_primary / N_ct * R32          （CT 次级电压）
  V_th = VDDA * DAC / 1024
  I_p_th = V_th * N_ct / R32

输出 THEORETICAL_OCP_A 表（DAC 200/250/300/320/350）。
状态：HARDWARE_OCP_CALIBRATION_PENDING（未实板标定，勿改 DAC300）。
"""
import argparse

VDDA = 3.3          # [SCHEMATIC] 理论值
N_CT = 100          # [SCHEMATIC]/analysis: 1:100
R32 = 10.0          # [BOM] 10Ω 1206
DAC_BITS = 1024

DAC_LIST = [200, 250, 300, 320, 350]


def ip_th(dac):
    vth = VDDA * dac / DAC_BITS
    return vth * N_CT / R32, vth


def main():
    print("=== THEORETICAL OCP (uncalibrated) ===")
    print(f"VDDA={VDDA}V  CT=1:{N_CT}  R32={R32}Ω  →  {R32/N_CT:.3f} V/A")
    print(f"{'DAC':>5} {'Vth(V)':>8} {'Ip_th(A)':>9}")
    for d in DAC_LIST:
        ip, vth = ip_th(d)
        print(f"{d:5d} {vth:8.4f} {ip:9.3f}")
    ip, vth = ip_th(300)
    print(f"\n当前固件 DAC300 → {vth:.4f}V → {ip:.3f}A (THEORETICAL_OCP_A)")
    print("HARDWARE_OCP_CALIBRATION_PENDING: 未实板注入电流标定；不得修改 DAC300。")


if __name__ == "__main__":
    main()
