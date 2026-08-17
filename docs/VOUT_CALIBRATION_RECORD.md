# VOUT ADC 标定记录（实板 DMM 交互式）

> 日期：2026-08-17
> 流程：LLC_STAGE5_ACCEPTANCE_SPRINT_V2_INTERACTIVE_DMM
> 平台：CALIBRATION_MEASURE_HOLD（PASSed Profile C charge + 250kHz/DB110 recharge packet 保持）

## 测量输入

| 参数 | 值 | 说明 |
|---|---|---|
| RAW_HOLD | **1385** | cal_raw_avg（30s 全窗口，738341 样本；min 1354 / max 1408） |
| DMM_HOLD | **11.14V** | 万用表实测（稳定平台，先读 11.15V，确认 11.14V） |
| DMM 范围 | 11.14V（单值确认，平台波动 ±0.03V 内） | |
| RAW_ZERO | **8** | 64 次软件采样（min 7 / max 10），VOUT 充分放电后 |
| DMM_ZERO | **0.001V** | 万用表实测零点 |

## 标定系数

```
gain   = (DMM_HOLD − DMM_ZERO) / (RAW_HOLD − RAW_ZERO)
       = (11.14 − 0.001) / (1385 − 8)
       = 0.008089325 V/raw

offset = DMM_ZERO − gain × RAW_ZERO
       = 0.001 − 0.008089325 × 8
       = −0.063715 V

VOUT = 0.008089325 × raw − 0.063715
```

## 导出目标 raw

| 目标 | 计算 | raw |
|---|---|---|
| 10.00V | (10 + 0.063715) / 0.008089325 | **1244** |
| 12.00V | (12 + 0.063715) / 0.008089325 | **1491** |
| 15.00V | (15 + 0.063715) / 0.008089325 | **1862** |

## 一致性交叉检查

- hold 平台 raw 1354~1408 → 理论 VOUT = 0.008089325×1354−0.063715 = 10.89V ~ 11.32V——DMM 实测 11.14V 落在平台内 ✓
- 1200 raw（早期 Profile C 目标）→ 0.008089325×1200−0.063715 = 9.64V（理论）——与开发日记早期估算 9.7V 一致 ✓
- 1400 raw（hold 平台中心）→ 11.26V（理论）——DMM 11.14V，差 0.12V（平台在 1354~1408 波动，中心略低于 1400）✓ 合理

## 安全核对

- ACTIVE TZ = 0、fault = 0、hard_limit_events = 0
- 30s 保持后自动 OST 停止（超时兜底），PWM=0 / OST=1
- 零点采样在放电完成后执行（软件 raw ≈ 0 确认）

## 产物

- `app/board_calibration.h`：BOARD_VOUT_CAL_VALID=1，gain/offset/10V/12V/15V
- OUT SHA256：见构建记录（最后实板验证固件）
