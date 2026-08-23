# STAGE5A_PFM_DIRECTION_REPORT — PFM 方向实板两枪报告

> 状态：`STAGE5A_PARTIAL_HARDWARE_PASS`（150K = PASS，170K = PENDING）
> `STAGE5A_PFM_DIRECTION_ACCEPTED = 0`（不得提前宣称 PFM 方向实板最终确认）
> 修正：待实板频率为 **170k**（非 180k）
> 理论对照：docs/PFM_DIRECTION_THEORETICAL.md；本报告由实板数据回填，理论不得冒充实板结果。

## 1. 实测数据

### 第一枪 TEST_150K — RUN_ID 0x250C5A15 — **PFM_DIRECTION_150K_PASS**

| 字段 | 值 | 说明 |
|---|---|---|
| shot binary SHA256 | `5a07cf3927fb7c4438295cfa8bdefc349492208bda5cb114b4f46c1e6b37902e` | 150k 实际 OUT |
| 频率 / TBPRD / CMPA / CMPB | 150kHz / 399 / 200 / 100 | |
| DBRED / DBFED | 36 / 36 | |
| window_cycles | 45 | |
| theoretical window | 300.0 µs | 45 × 400 / 60MHz |
| Timer2 actual | 305.8 µs | 接近 300，正常 |
| start_raw | 1253 | 窗口起点 |
| end_raw | 1389 | 45 周期结束 |
| max_raw | 1389 | 窗口内峰值 |
| delta_raw | +136 | end − start |
| start_voltage ≈ | 10.07 V | 0.008089325×1253−0.063715 |
| end_voltage ≈ | 11.17 V | |
| delta_voltage ≈ | +1.10 V | |
| slope_raw/ms | 444.8 | 136 / 0.3058ms |
| slope_V/ms ≈ | 3.60 | |
| fault / ACTIVE_TZ / hard_abort / stale_abort | 0 / 0 / 0 / 0 | |
| final_pwm / final_ost | 0 / 1 | |

**判定：`PFM_DIRECTION_150K_PASS`**

### 第二枪 TEST_170K — RUN_ID 0x250C5A17 — **PFM_DIRECTION_170K_PENDING**

| 字段 | 值（预期） | 实测 |
|---|---|---|
| frequency / TBPRD / CMPA / CMPB | 170k / 352 / 176 / 88 | `PENDING` |
| DB | 36 | `PENDING` |
| window_cycles | 51 | `PENDING` |
| theoretical window | ≈300.05 µs（51 × 353/60M） | `PENDING` |
| 计划 binary（future） | `6ad22db7...` | 未生成实板数据 |

**未执行 / 未伪造任何实板 170k 数据。**

## 2. 二进制证据标注

- 150k shot binary：`5a07cf39...`
- 未来 170k 计划 binary：`6ad22db7...`
- 二者 **NOT BIT IDENTICAL**。
- 代码审计确认功率行为相关差异**仅为 COMP arm RAM snapshots**；未修改：frequency trajectory、deadtime、DAC300、qualification、TZ policy、VOUT hard ceiling、PFM window。
- 当前状态：**`CROSS_BUILD_COMPARISON_ALLOWED_WITH_ADAPTIVE_GATE`**（非 `STRICT_SAME_BINARY_AB`）。

## 3. 方向判定

| 量 | 150k | 170k | 判定 |
|---|---|---|---|
| slope_raw/ms | 444.8 | `PENDING` | 待 170k |
| slope_V/ms | 3.60 | `PENDING` | 待 170k |

- 规则：slope_150 > slope_170 且差 ≥ 阈值 → `PFM_CONTROL_DIRECTION_CONFIRMED_NORMAL`；slope_170 > slope_150 → `REVERSED`；差 < 10% → `INCONCLUSIVE`。
- 当前 `STAGE5A_PFM_DIRECTION_ACCEPTED = 0`。

## 4. Unrelated failed diagnostic（隔离）

- 200k/DB140 multi-edge failure（`requalify/200k-db140-trip-evidence` @ ef2bb20）：
  - **不是** 150k PFM direction failure
  - **不是** formal SoftStart failure
  - **不是** 250k Profile-C startup failure
- **不改变 `STAGE5_ACCEPTED`。**

## 5. 当前物理板状态

- 因 200k 诊断：`FAULT_COMP_TZ1` latched、`OST` latched、`PWM=0` → `DIAGNOSTIC_SESSION_FAULT_STATE`。
- 下次真实主线测试前必须重建 main 固件干净状态；本任务**禁止 reset / reload / 上电动作 / 真实 power shot**。

## 6. 对 12V 调节的含义

- 若 NORMAL：VOUT < 12V → frequency 降低（方向由实测裁决）。
- PI/PFM 符号按正方向；真实闭环仍被 `LLC_HARDWARE_PI_VALIDATED=0` 禁止。

## 7. 结论

`STAGE5A_PARTIAL_HARDWARE_PASS`：150K = PASS，170K = PENDING。待 170k 实板后判定是否 `STAGE5A_PFM_DIRECTION_ACCEPTED`。
