# VIRTUAL_BOARD_PARAMETER_INVENTORY — LLC 100W 板参数清单

> 任务：OFFBENCH_LLC_VIRTUAL_BOARD_CHARACTERIZATION_V1
> 日期：2026-08-17
> 基线：main @ b98748c（STAGE5_ACCEPTED, PFM_DIRECTION_NO_ENERGY_PASS）
> 原则：禁止把 ASSUMED 写成已知事实。每项标记来源。

来源标记：
- `[MEASURED]` = 本 bring-up 实板实验/万用表实测
- `[SCHEMATIC]` = 当前原理图/EDA 资料（100wllc_eda）
- `[BOM]` = BOM_CSS024D-V2.0_CSS024D-V2.0_2026-07-07.xlsx
- `[CALCULATED]` = 由上述推导
- `[FIRMWARE]` = 当前正式代码（main @ b98748c）
- `[ASSUMED]` = 工程假设（有依据但未直接证实）
- `[UNKNOWN]` = 未找到资料，需回工位确认
- `[CONFLICT]` = 资料间冲突，详见 PARAMETER_CONFLICT_AUDIT.md

## 1. 系统级

| 参数 | 值 | 来源 |
|---|---|---|
| 拓扑 | 全桥 LLC（Full-Bridge, 副边中心抽头全波整流） | [SCHEMATIC] |
| Vin 设计 | 24~36V，nominal 30V | [SCHEMATIC]/任务 |
| Vout | 12V | 任务 |
| Pout / Iout | 100W / 8.3A | 任务 |
| 控制器 | TMS320F28034PNT @60MHz | [BOM]/[FIRMWARE] |
| 辅助电源 | B2412S-2WR2（24V→12V）、B2405S-1WR2 ×2（24V→5V） | [BOM] |

## 2. 谐振腔（Lr / Lm / Cr）

| 参数 | 值 | 来源 |
|---|---|---|
| Lr（谐振电感） | 3.35 / 3.385 / 3.42 µH（标称 3.385µH） | [SCHEMATIC]（analysis/llc_first_cycle_model_v1.md 引用原理图） |
| Lm（变压器励磁） | 16.9 / 17.25 / 17.6 µH（标称 17.25µH） | [SCHEMATIC]（同上） |
| Cr（谐振电容网络） | **3.004µF**（330nF×2 + 470nF×5 并联，原理图标注） | [SCHEMATIC]（analysis 引用） |
| Cr（BOM 组合） | 330nF×5 + 470nF×2 = 2.59µF | [BOM] → **CONFLICT**（C9/C10/C11 值 330n vs 470n） |
| fr（标称） | 1/(2π√(3.385µ×3.004µ)) = **49.9 kHz** | [CALCULATED] |
| Ln = Lm/Lr | 17.25/3.385 = **5.10** | [CALCULATED] |
| Z0 = √(Lr/Cr) | √(3.385µ/3.004µ) = **1.061 Ω** | [CALCULATED] |
| 谐振电感器件 | 原理图 T1 标注 3µH（PQ3230 磁芯 APQ3230-4658） | [SCHEMATIC]；BOM T1=90µH → **CONFLICT** |
| 实板数据一致性 | 250k/DB110 空载实测 11.14V 与 fr=50kHz 的 FHA 稳态预测（~8V）不符 → 有效 Cr 或匝比存在不确定性 | [MEASURED] vs [CALCULATED] → **CONFLICT** |

## 3. 变压器

| 参数 | 值 | 来源 |
|---|---|---|
| 磁芯 | PQ3230 | [SCHEMATIC]/日记 |
| Np | 5T | [SCHEMATIC]/日记 |
| Ns | 4T 中间抽头（每半绕组 4T，全绕组 8T） | [SCHEMATIC]/日记 |
| n = Np/Ns_half | 5/4 = **1.25** | [CALCULATED] |
| 主变压器器件 | BOM T1 = APQ3230-4658（90µH 标注） | [BOM] → **CONFLICT**（90µH 与实测 Lm 17µH 不符） |

## 4. 半导体

| 参数 | 值 | 来源 |
|---|---|---|
| MOSFET（Q1-Q4） | BSC050N04LSGATMA1-JSM（杰盛微，40V 级，TDSON-8） | [BOM] |
| 整流（D4,D5,D6,D8） | MBRD10100CT-13（DIODES，100V 2×10A Schottky，TO-252） | [BOM] |
| 辅助二极管（D1,D7,D9） | SS210（2A 100V Schottky） | [BOM] |
| 输入整流桥（D10） | MB10S（1A 1000V） | [BOM] |
| 驱动（U1,U2） | SI8233BD-D-ISR（Skyworks 双通道隔离驱动） | [BOM] |
| 运放（U6） | GS8552-SR（Gainsil 双运放） | [BOM] |

## 5. 输出/滤波

| 参数 | 值 | 来源 |
|---|---|---|
| 输出电容 | 470µF/35V 电解 ×5（C15,C16,C17,C22,C23）= **2350µF** | [BOM] |
| 输出电流采样 | R12 = 0.001Ω ±1% 2512（1mΩ） | [BOM] |
| 输出差分采样 | VO_P/VO_N → ADI_Vout（运放网络） | [SCHEMATIC]；电阻值部分提取（R16=10K, R20/R21=33K, R27-29=3.3K）→ 完整网络 [UNKNOWN] |
| 输出电感 L2 | 4.7µH（XR0630-4R7M） | [BOM]（角色待确认，可能为输入/辅助滤波） |
| 输入滤波 L1 | 3.3µH（RS1770-4R7MS） | [BOM]（角色待确认） |
| 母线电容 | BOM 无明确高压母线电解条目 | [UNKNOWN] |

## 6. 采样/保护

| 参数 | 值 | 来源 |
|---|---|---|
| CT | XRPAEE5.0-1-100TNL（EE5.0 磁芯），理论变比 **1:100** | [SCHEMATIC]/analysis（CT 检测原边电流） |
| CT 次级负载 R32 | 10Ω 1206 | [BOM] |
| CT 增益 | 0.1 V/A（理论 = 10Ω/100） | [CALCULATED] |
| COMP 输入 | COMP1A（ADCINA2 复用）← Ipri | [SCHEMATIC]/[FIRMWARE] |
| DAC | 10-bit，VDDA=3.3V 理论 | [SCHEMATIC]/analysis |
| OCP DAC 现值 | **DAC300**（LLC_SINGLE_CYCLE_PROBE_DAC） | [FIRMWARE] |
| OCP 理论阈值 | 3.3×300/1024 = 0.9668V → **9.668A**（原边） | [CALCULATED]（未标定） |
| VOUT 采样 | ADCINA1（ADCSOC0），VOUT = 0.008089325×raw − 0.063715 | [MEASURED]（标定记录） |
| IPRI 采样 | ADCINA2（ADCSOC1） | [FIRMWARE] |
| IOUT 采样 | ADCINA3（ADCSOC2），R12 1mΩ + 运放 | [BOM]/[FIRMWARE] |

## 7. 控制/时序

| 参数 | 值 | 来源 |
|---|---|---|
| SYSCLK/TBCLK | 60MHz（PLLCR=6） | [FIRMWARE] |
| 死区 | DBRED=DBFED=36 ticks @60MHz = **600ns** | [FIRMWARE] |
| 生产频率包络 | TBPRD 399~428（150k~140k） | [FIRMWARE] |
| 诊断频率包络 | TBPRD 239~399（250k~150k），需 g_diag_frequency_override | [FIRMWARE] |
| 正式 SoftStart | 250k/DB110 ×15cyc → DB36 → 239→399 → 150k | [FIRMWARE]（STAGE5 验收） |
| PFM 方向窗口 | 150k=45cyc≈300µs / 170k=51cyc≈300µs | [FIRMWARE]（STAGE5A） |
| ADC | 3 SOC 顺序，30MHz ADC 时钟（CLKDIV2EN=0），SOCA PWM 同步 | [FIRMWARE] |
| 标定 | BOARD_VOUT_CAL_VALID=1；RAW_10V=1244, RAW_12V=1491, RAW_15V=1862 | [MEASURED] |

## 8. 保护阈值（固件）

| 参数 | 值 | 来源 |
|---|---|---|
| 软启动硬顶 | g_softstart_hard_ceiling_raw = 1491（12V） | [FIRMWARE] |
| 验收目标 | 1244（10V） | [FIRMWARE] |
| OVP 原始阈值 | LLC_OVP_RAW_THRESHOLD（需查值） | [FIRMWARE] |
| OCP 原始阈值 | LLC_OCP_RAW_THRESHOLD = 0xFFFF（禁用） | [FIRMWARE] |
| UVP 原始阈值 | LLC_UVP_RAW_THRESHOLD（需查值） | [FIRMWARE] |

## 9. 教程参考（旧版 CSS024D，非当前硬件）

| 参数 | 值 | 来源 |
|---|---|---|
| 教程 MIN_BURST/MAX_DT/MIN_DT | 400 / 190 / 20 | [TUTORIAL] analysis/tutorial_reference_truth_table.md |
| 教程 OCP | MAX_OPP_VAL=310（注释称 30A，不可信） | [TUTORIAL] |
| 教程变压器 | 与原版 CSS024D 配套（≠当前 PQ3230 5:4） | [TUTORIAL] |

## 10. 关键 UNKNOWN / 待回工位项

1. Cr 实际装机组合（330n/470n 数量）与有效谐振频率 —— [CONFLICT] + 实板数据矛盾
2. 主变压器实际匝比（5T:4T 半绕组假设）与 Lm —— 需实物/绕线记录确认
3. 母线电容容量 —— [UNKNOWN]
4. VOUT/IPRI 采样网络完整电阻值 —— 部分 [UNKNOWN]
5. OCP 安培级标定（CT 变比实测 + R32 实测）—— HARDWARE_OCP_CALIBRATION_PENDING
6. 输出电容实际 ESR/品牌 —— [UNKNOWN]
7. 实板 150k/170k PFM 方向斜率 —— 待 STAGE5A 实板两枪
