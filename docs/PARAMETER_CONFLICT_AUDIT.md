# PARAMETER_CONFLICT_AUDIT — 参数冲突审计

> 任务：OFFBENCH_LLC_VIRTUAL_BOARD_CHARACTERIZATION_V1
> 排序原则：实板实测 > 当前最终硬件 > 当前正式代码 > 旧教程
> 不得静默选值——每个冲突列出候选与采纳/标记。

## 冲突 1：Cr 谐振电容组合

| 来源 | 值 | 依据 |
|---|---|---|
| 原理图文本（SCH PDF） | 330nF×2 (C6,C8) + 470nF×5 (C9,C10,C11,C13,C14) = **3.01µF** | SCH_CSS024D-V2.0_2026-07-15.pdf 文本层 |
| BOM xlsx | C6=330nF；C8,C9,C10,C11=330nF×4；C13,C14=470nF×2 = **2.59µF** | BOM_2026-07-07.xlsx |
| analysis 模型 | **3.004µF** [SCHEMATIC] | llc_first_cycle_model_v1.md（采纳原理图） |
| 实板反推（本次） | 24V/150k 达 10.02V、250k/DB110 空载 11.14V，与 fr=50kHz FHA 稳态预测（8.1~8.5V）不符；若有效 Cr≈0.33µF（fr≈150kHz）更接近 | [MEASURED] vs [CALCULATED] |

**裁决**：模型标称采纳原理图 **Cr = 3.004µF**（analysis 同源），但**标记有效 Cr 为高风险 UNKNOWN**：
- 若实机只装了 C6（单颗 330nF）→ fr≈150.6kHz，150k 工作点恰在谐振（M≈1）
- 实板 150k→10V 与 250k→11.14V 的数据更支持**高 fr（低有效 Cr）**假设
- 敏感性分析（F）同时覆盖 3.004µF 与 0.33µF 情景；最终由实板两枪校准

## 冲突 2：主变压器 / 谐振电感器件标注

| 来源 | 值 | 依据 |
|---|---|---|
| 原理图 T1 | **3µH**（"谐振电感"标签区域） | SCH PDF |
| BOM T1 | **90µH** APQ3230-4658（PQ3230 封装电感） | BOM xlsx |
| 日记 | Lr≈3.15~3.4µH 实测级；Lm≈17µH 实测级 | 开发日记 §2.1 |
| analysis | Lr=3.385µH / Lm=17.25µH [SCHEMATIC] | llc_first_cycle_model_v1.md |

**裁决**：Lr 以实测级 **3.15~3.42µH（标称 3.385µH）** 为准；BOM 的 T1=90µH 标注与原理图 3µH 冲突，**判定 BOM 标注错误或为不同器件**（90µH 与 Lm 实测 17µH 亦不符），标记 [CONFLICT-UNRESOLVED]。主变压器为 PQ3230 定制件（BOM 中可能对应 T1 条目但值标注不可信）。

## 冲突 3：实板 VOUT 与 FHA 稳态预测系统性偏差

| 来源 | 值 | 依据 |
|---|---|---|
| 实板 | 250k/DB110 空载保持 11.14V；150k FINAL 爬升至 10.02V | [MEASURED]（CAL_HOLD/STAGE5） |
| FHA（Cr=3µF, fr=50k） | 250k 空载 ≈8.1V；150k 轻载 ≈8.2V | [CALCULATED]（本任务初算） |
| FHA（Cr=0.33µF, fr=150.6k） | 250k 空载 ≈8.5V；150k ≈9.6V | [CALCULATED] |

**裁决**：系统性低估 20~30%。候选解释（按可能性）：
1. 有效 Cr 显著小于 3µF（fr 更高，工作点更接近谐振）—— 与冲突 1 同源
2. 匝比 n < 1.25（若副边每半绕组 >4T 或原边 <5T）
3. 空载下 FHA 基波近似失效（整流管截止、电容峰值保持、Lm 参与）
4. DB110 大死区的非线性（FHA 假设 50% 占空比）
5. Cr 预充（CAL_HOLD 维持包前 Cr 已有电荷）

**处置**：模型按标称参数建立（fr≈50kHz），输出理论曲线；实板 150/170k 两枪斜率将直接检验 150~170k 区间的方向与量级（任务 REMOTE_BENCH §15：方向不一致 → MODEL_DIRECTION_MISMATCH，检查匝比/Cr/Lr/Lm/负载/整流模型）。

## 冲突 4：输出电容

| 来源 | 值 | 依据 |
|---|---|---|
| analysis | UNKNOWN（扫描 470/940/1410µF） | llc_first_cycle_model_v1.md |
| BOM | 470µF/35V ×5（C15-17,C22,C23）= 2350µF | BOM xlsx |

**裁决**：采纳 BOM **2350µF** [SCHEMATIC]（analysis 当时未查 BOM）。模型扫描 940/2350/4700µF 覆盖。

## 冲突 5：教程参数 vs 当前硬件

| 来源 | 值 | 依据 |
|---|---|---|
| 教程 CSS024D | MIN_BURST=400/MAX_DT=190/MIN_DT=20/MAX_OPP_VAL=310 | tutorial_reference_truth_table.md |
| 当前固件 | 250k/DB110 起步、DB36 终点、DAC300 | [FIRMWARE] STAGE5 |

**裁决**：教程仅为参考（旧版 CSS024D 变压器/参数与当前 PQ3230 5:4 不同），**不参与当前模型参数选择**。所有模型输入以当前硬件资料为准。

## 冲突 6：CT 变比

| 来源 | 值 | 依据 |
|---|---|---|
| analysis | 1:100（0.1 V/A @ R32=10Ω） | [SCHEMATIC] |
| 日记 | "CT匝比"列为未来确认项 | 开发日记 §8 注 |
| BOM | T2=XRPAEE5.0-1-100TNL（EE5.0 磁芯，"100T" 次级暗示 1:100） | [BOM] |

**裁决**：采纳 **1:100** 理论值 [SCHEMATIC]，标记 HARDWARE_OCP_CALIBRATION_PENDING（需实板注入电流标定）。

## 冲突 7：VOUT 采样网络

| 来源 | 值 | 依据 |
|---|---|---|
| 原理图文本 | R16=10K, R20/R21=33K, R27-29=3.3K 等部分提取 | SCH PDF 文本层 |
| BOM | 3.3K×15 / 10K×6 / 33K×4 / 2.2K×5 / 100Ω×4 / 2Ω×9 等 | BOM xlsx |

**裁决**：VOUT 差分采样完整网络 [UNKNOWN]；固件已用实测标定（0.008089325 V/raw）绕开网络增益不确定性——标定后的 ADC 比例即"黑盒正确"。[MEASURED] 优先。

---

## 最终采纳参数表（模型输入）

| 参数 | 值 | 状态 |
|---|---|---|
| Lr | 3.385µH（扫描 3.35/3.385/3.42） | [SCHEMATIC]+[MEASURED]级 |
| Lm | 17.25µH（扫描 16.9/17.25/17.6） | [SCHEMATIC]+[MEASURED]级 |
| Cr | 3.004µF 标称；同时评估 0.33µF 情景 | [SCHEMATIC] / 高风险 |
| n | 1.25（Np 5T : Ns_half 4T） | [SCHEMATIC] |
| Cout | 2350µF（5×470µF） | [BOM] |
| Vf（整流） | 0.7V 工程值（理想 0 也扫） | [ASSUMED] |
| 死区 | 600ns（36 ticks） | [FIRMWARE] |
| CT/R32 | 1:100 / 10Ω → 0.1V/A | [SCHEMATIC] |
| DAC300 | 9.668A 理论 | [CALCULATED] |
