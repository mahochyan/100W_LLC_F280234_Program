# OFFBENCH_VIRTUAL_BOARD_CHARACTERIZATION_V1 — 总报告

> 日期：2026-08-17 / 基线：main @ b98748c（STAGE5_ACCEPTED, PFM_DIRECTION_NO_ENERGY_PASS）
> 状态：**OFFBENCH_VIRTUAL_CHARACTERIZATION_COMPLETE**（参数清单/模型/文档均完成；唯一无法远程的是实板两枪与 LCR 澄清——见 REQUIRES_BENCH）
> 禁止：真实上电/真实功率/DSS real shot/PI 上板/修改 DAC300/降低保护

## 结论分类（四类，绝对不混合）

### A. CONFIRMED_BY_HARDWARE（实板确认）
- VOUT 标定：V = 0.008089325×raw − 0.063715（RAW 10V=1244 / 12V=1491 / 15V=1862）
- 正式 SoftStart（250k/DB110→150k/DB36）实板 10V 验收 PASS（STAGE5）
- 250k/DB110 空载可维持 11.14V（CAL_HOLD）
- STAGE5A 无能量验证：150k 窗口 311µs / 170k 窗口 341µs（PFM 窗口机制）

### B. CONFIRMED_BY_FIRMWARE_NO_ENERGY（固件无能量确认）
- 150k/170k 窗口配置（TBPRD 399/352、CMPA 200/176、CMPB 100/88、DB36）
- 90 次无能量测试：轨迹完整、硬顶、计划 OST、miss 纪律
- 保护链路（ADCINT OVF 已架构性消除；DAC300 理论 9.67A）

### C. PREDICTED_BY_MODEL（模型预测，本次主要产出）
| 主题 | 预测 | 文件 |
|---|---|---|
| fr | 标称 49.9kHz（Lr 3.385µ / Cr 3.004µ）；情景 B 150.6kHz（Cr 0.33µ，实板一致性更高） | INVENTORY / CONFLICT_AUDIT |
| PFM 方向 | 150k > 170k（正常）；差异情景依赖 0.4%~11%——需实板裁决 | PFM_DIRECTION_THEORETICAL |
| 12V 可行性 | **36V 感性区可达（工作频率 66~88k 标称 / 170~190k 情景B）；24V/30V 需 M>1（容性区，ZVS 风险）** | TRANSFORMER_GAIN_AUDIT |
| 参数敏感性 | **Lr 最敏感**（M150 ±8%）、Cr 次之（±1%）、Lm 最不敏感（<1%） | LLC_PARAMETER_SENSITIVITY |
| 250k 起步优势 | tank 阻抗高（32Ω vs 19Ω）→ 电流小 40%、DB110 限流 → 冷启动更稳 | SOFTSTART_PHYSICS_EXPLANATION |
| ZVS 理论 | 150-250k 全区 LIKELY（Coss≤2nF 假设）；容性区禁用 | ZVS_THEORETICAL_MAP |
| 半导体应力 | MOS 36V Vds 裕量极小 ⚠️；整流裕量充足 | SEMICONDUCTOR_STRESS |
| OCP 理论 | DAC300 = 9.668A；DAC200-350 映射表 | protection_model.py |
| 实时预算 | 70-250kHz 全 PASS；250k 切换周期 MARGINAL 已消除 | F28034_REALTIME_BUDGET |
| SIL | STEP 可达区收敛（方向正确无跑飞）；PI 在 36V/5W、25W ±1% PASS；保护矩阵全 PASS | llc_control_sil.py |
| 100W 现状 | 满载原边 RMS ~7.7~16A（情景依赖）——**100W 时接近/超过理论 OCP 9.67A，属 OCP 受限区** | freq_scan.csv / SIL |

### D. REQUIRES_BENCH_MEASUREMENT（必须回工位，唯一清单）
1. **PFM 方向 150/170k 实板斜率**（裁决方向与量级）
2. **Cr 实际装机组合 + Lr/Cr/Lm 匝比 LCR 实测**（裁决 fr=50k vs 150k）
3. **MOS Vds 尖峰（36V 输入）**——40V 器件裕量风险，最高优先
4. **Vgs/Vds ZVS 波形**
5. **OCP 安培标定（DAC300 实际触发电流）**
6. 25/50/75/100W 带载 + 温升 + 纹波 + 24/30/36V 输入验证

（完整清单见 RETURN_TO_BENCH_MINIMUM_TEST_PLAN.md）

## 关键工程判定（供后续规划）

1. **24V 输入要 12V 输出需要 tank 增益 M≈1.32（>1）**——感性区（f>fr）给不出，需容性区（ZVS 丢失）。**实板 24V 只能到 ~10V（STAGE5 证实）是物理边界，不是软件缺陷。**
2. **30V/12V 临界**（M≈1.06，需近谐振或略低于）；36V/12V 容易（M≈0.88，高频压住）。
3. **Lr 是最敏感参数**且实测离散 ±4%——回工位优先 LCR。
4. **100W 满载原边电流接近理论 OCP**——若目标 100W，DAC300 需要实标定后评估（可能需调整或接受量产限制）。
5. **PI/PFM 已在虚拟环境验证方向与稳定性**，但 `LLC_HARDWARE_PI_VALIDATED=0` 强制保持——真实闭环必须等回工位。

## SIL 结果摘要（tools/llc_control_sil.py）

```
STEP_PFM:  PASS=8（可达区收敛、方向正确、无正反馈跑飞）
           PHYSICAL_LIMIT=55（clamp 或感性区不可达，24/30V 12V 等）
           CONTROL_FAIL=2（36V/50W/10V STEP 精度差 7.7%——保留）
PI-PFM:    PASS=2（36V/5W、25W 12V ±1% 稳态）
           PHYSICAL_LIMIT=8 / OCP_LIMIT=5 / CONTROL_FAIL=0
瞬态:      负载阶跃 10→25/50W PASS；10→100W OCP 保护；Vin→24 停靠物理上限
保护:      ADC miss3 / OVP / freq clamp / 模拟OCP 全部 PASS
```

Plant 默认情景 B（Cr=0.33µF，fr≈150k，与实板 24V/150k→10V 一致）；情景 A（标称 fr=50k）为保守下限。

## 编译保护（T 节）

```c
#define LLC_VIRTUAL_PI_VALIDATED        1U   /* 虚拟闭环已验证 */
#define LLC_HARDWARE_PI_VALIDATED       0U   /* 真实板未经验证——禁止闭环 */
#define LLC_POWER_RUN_ALLOWED           0U
```

BUILD OK；ALL STATIC CHECKS PASSED；OUT SHA256 = `545466b81e55db6c00027fa9e957f8f2a7b4575965c197feeb1034535b3ef7da`
