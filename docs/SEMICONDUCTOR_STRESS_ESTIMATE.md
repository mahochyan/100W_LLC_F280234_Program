# SEMICONDUCTOR_STRESS_ESTIMATE — 半导体理论应力

> 任务：OFFBENCH_LLC_VIRTUAL_BOARD_CHARACTERIZATION_V1（J 节）
> 性质：电气应力估计（PREDICTED_BY_MODEL）；**不虚构 Rds(on)/Vf/温升**（无 datasheet 在手，仅型号已知）
> 器件：MOSFET BSC050N04LS（Q1-Q4）、整流 MBRD10100CT（D4-D6,D8）[BOM]

## 1. MOSFET（原边全桥，24~36V）

| 参数 | 值 | 依据 |
|---|---|---|
| 型号 | BSC050N04LSGATMA1-JSM | [BOM] |
| 额定电压（厂商） | 40V 级（型号 04 = 40V） | [BOM 型号] |
| Vds 工作应力 | = Vin = 24~36V（半桥中点对地）；全桥对角导通时关断管 Vds=Vin | [CALCULATED] |
| Vds 尖峰风险 | Vin + 寄生振铃（变压器漏感 + 结电容）——**36V 输入时裕量仅 ~4V**（40−36），**高风险，必须示波器验证** | [CALCULATED]/[REQUIRES_BENCH] |
| Ids RMS（30V, 150k, 开环） | 25W: 3.3A / 50W: 5.4A / 100W: 7.7A | [CALCULATED]（FHA，标称 fr=50k 情景） |
| Ids RMS（36V, 100W, f=66k 稳态） | 16.2A（模型高增益区） | [CALCULATED] |
| Ids 峰值估计 | ≈ π×RMS ≈ 1.5~2×RMS（正弦基波近似）→ 100W 时 12~24A | [CALCULATED] |

## 2. 副边整流二极管（MBRD10100CT, 100V 2×10A）

| 参数 | 值 | 依据 |
|---|---|---|
| 反压 | 2×Vout + 振铃 ≈ 2×12 + 尖峰 ≈ **30~40V**（<100V 额定 ✓） | [CALCULATED] |
| 平均电流/只 | Iout/2：100W/12V=8.3A → **4.17A**（<10A 额定 ✓） | [CALCULATED] |
| RMS 电流/只 | Iout×π/(2√2)/2 ≈ **4.6A** | [CALCULATED] |
| 峰值电流 | ≈ Iout×π/2 ≈ **13A**（接近 2×10A 并联封装能力，需注意） | [CALCULATED] |
| 温升 | **UNKNOWN**（无 Rth/损耗数据；回工位测） | [REQUIRES_BENCH] |

## 3. 电压/电流裕量汇总

| 项 | 应力 | 额定 | 裕量 | 状态 |
|---|---|---|---|---|
| MOS Vds（36V 输入） | 36V + 振铃 | 40V | **极小** | ⚠️ 高风险，回工位必测 Vds 尖峰 |
| MOS Ids（100W 区域） | ~16A RMS（模型重载点） | 未知（无 datasheet，约 40-60A 级） | 未知 | 回工位确认型号 datasheet |
| 整流反压 | ~40V | 100V | 2.5× | ✓ |
| 整流平均电流 | 4.2A/只 | 10A/只 | 2.4× | ✓ |
| 整流峰值 | ~13A | 20A（2×10A 并联） | 1.5× | 需注意 |

## 4. 结论

1. **MOS 电压裕量（36V 输入）是首要风险**——40V 器件在 36V 输入 + 振铃下裕量不足，回工位第一优先测量 Vds 尖峰。
2. 整流二极管电流/电压裕量充足（型号选择合理）。
3. Rds(on)/Vf/温升：**无 datasheet 在手，不虚构**；回工位确认型号后补。
4. 100W 区域原边 RMS 电流模型值 7.7~16A（情景依赖）——与 CT/OCP 理论阈值 9.67A 同量级，**100W 满载时 OCP 裕量需实板标定**。

状态：`SEMICONDUCTOR_STRESS_ESTIMATE_PREDICTED`（型号 [BOM]，应力 [CALCULATED]，温升/尖峰 [REQUIRES_BENCH]）
