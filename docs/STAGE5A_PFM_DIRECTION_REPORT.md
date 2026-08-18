# STAGE5A_PFM_DIRECTION_REPORT — PFM 方向实板两枪报告

> 状态：`PENDING_SHOTS`（180k 待实板；数据来自 REMOTE_BENCH 两枪或回工位）
> 理论对照：docs/PFM_DIRECTION_THEORETICAL.md（THEORETICAL=NORMAL，差异 0.4~11% 情景依赖）
> 本报告由两枪数据自动填充；**理论不得冒充实板结果**。

## 1. 实测数据

### 第一枪 TEST_150K（RUN_ID 0x250C5A15）

| 字段 | 值 | 说明 |
|---|---|---|
| start_raw / start_V | `待填` | 窗口起点（1244≈10.02V 附近） |
| end_raw / end_V | `待填` | 45 周期结束 |
| max_raw | `待填` | 窗口内峰值 |
| delta_raw | `待填` | end − start |
| elapsed_us | `待填` | window_cycles × (TBPRD+1)/60MHz = 45×400/60M = **300µs 理论** |
| slope_raw/ms | `待填` | delta / 0.300ms |
| slope V/ms | `待填` | × 0.008089325 |
| TBPRD/CMPA/CMPB/DB | `待填` | 期望 399/200/100/36 |
| window_cycles | `待填` | 期望 45 |
| fault/OST/PWM | `待填` | 期望 0 / 1 / 0 |
| run_id_at_arm/at_stop | `待填` | 期望一致 0x250C5A15 |

### 第二枪 TEST_170K（RUN_ID 0x250C5A17）

| 字段 | 值 |
|---|---|
| start_raw / start_V | `待填` |
| end_raw / end_V | `待填` |
| max_raw | `待填` |
| delta_raw | `待填` |
| elapsed_us | `待填`（51×353/60M = **300.05µs 理论**） |
| slope_raw/ms / slope V/ms | `待填` |
| TBPRD/CMPA/CMPB/DB | `待填`（期望 352/176/88/36） |
| window_cycles | `待填`（期望 51） |
| fault/OST/PWM / run_id | `待填` |

### Timer2 时间对账

- 150k Timer2 elapsed：`待填`（接近 300µs 为正常；若明显多 → `PFM_TIMER2_ACCOUNTING_MISMATCH` 单列）
- 170k Timer2 elapsed：`待填`
- 功率窗口主依据 = window_cycles × (TBPRD+1)/60MHz；Timer2 仅供诊断

## 2. 方向判定

| 量 | 150k | 170k | 判定 |
|---|---|---|---|
| slope_raw/ms | `待填` | `待填` | 差 = `待填`% |
| slope V/ms | `待填` | `待填` | |

规则：
- slope_150 > slope_170 且差 ≥10% → **PFM_CONTROL_DIRECTION_CONFIRMED_NORMAL**（频率↓→增益↑；控制符号：V<目标→f↓）
- slope_170 > slope_150 且差 ≥10% → **PFM_CONTROL_DIRECTION_REVERSED_IN_TEST_REGION**（保留真实，禁止套理论）
- 差 <10% → **PFM_DIRECTION_INCONCLUSIVE**（停真实功率，不自动扩大频率差）

## 3. 模型对照与校准

- 理论（情景 B，fr≈150k）：150k Δ +4.2%（5W 轻载）~+11.3%（100W）
- 实板：`待填`
- 方向一致 → 校准 llc_empirical_plant.py（SHOT_150/SHOT_170 填入实际 start/end raw）
- 不一致 → 输出 `MODEL_DIRECTION_MISMATCH`，检查匝比/Cr/Lr/Lm/负载/整流模型

## 4. 对 12V 调节的含义

- 若 NORMAL：VOUT < 12V → frequency 降低（方向由实测裁决）
- PI/PFM 符号按此方向；**真实闭环仍被 LLC_HARDWARE_PI_VALIDATED=0 禁止**

## 5. 结论

`待两枪后填写`：PFM_DIRECTION_150K_PASS / 170K_PASS → 若差≥10% → **STAGE5A_PFM_DIRECTION_ACCEPTED**
