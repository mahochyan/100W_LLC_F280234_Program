# IPRI Comparator Trip Threshold — THEORETICAL ONLY

- **状态** : `THEORETICAL_ONLY` — 未实板标定
- **IPRI_HARDWARE_CALIBRATION_PENDING = 1**
- **不得**把 9.7A 写成真实已测 OCP。

## 依据
- 电流互感器：`T2 = CT050A-100`，变比 ≈ **1:100**
- 采样电阻：`R32 = 10Ω`

## 理论换算
```
V_IPRI ≈ I_PRIMARY / 100 × 10Ω
       ≈ 0.1 V/A

DAC300：
V_DAC ≈ 300/1023 × VDDA
VDDA 按 3.3V 理论 ≈ 0.968V

I_TRIP_THEORETICAL ≈ 0.968V / (0.1 V/A) ≈ 9.7A
```

## 必须标记的误差来源（尚未实板标定）
- CT 变比误差
- CT 高频响应
- 整流桥动态
- PCB 寄生
- Comparator 误差（偏置 / DAC 精度 / 阈值斜率）

## 待办
- 需在台架对 IPRI 通道做绝对标定，才能给出**实测** OCP 阈值（A）。
- 当前 `board_calibration.h` 仅含 VOUT 标定，缺 IPRI 感测增益。
