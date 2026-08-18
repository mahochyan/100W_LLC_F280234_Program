# ZVS_THEORETICAL_MAP — ZVS 理论似然图

> 任务：OFFBENCH_LLC_VIRTUAL_BOARD_CHARACTERIZATION_V1（I 节）
> 性质：**理论似然估计，不宣称实板已 ZVS**
> 最终确认必须回工位示波器同时看 Vds/Vgs。

## 1. 方法

ZVS 判据（简化）：死区 td 内，励磁电流 I_lm 必须能把半桥中点电容（2×Coss）充/放电到 Vin：

```
I_zvs_need ≈ 2 × Coss_eff × Vin / td
I_lm_pk(空载) ≈ Vin / (4 × Lm × f)     （方波半周期三角波近似）
ratio = I_lm_pk / I_zvs_need
ratio > 1.2 → LIKELY_ZVS
0.8 < ratio ≤ 1.2 → MARGINAL
ratio ≤ 0.8 → UNKNOWN/HARDWARE_MEASUREMENT_REQUIRED
```

参数：Lm=17.25µH [SCHEMATIC]，td=600ns（36 ticks @60MHz）[FIRMWARE]，
Coss=500pF/MOSFET [ASSUMED]（BSC050N04LS 40V 级器件，无 datasheet 在手，量级假设；
若 Coss 实际 1000pF，I_zvs_need 翻倍，结论从 LIKELY 降为 MARGINAL——见 §4）。

## 2. 似然矩阵（空载/轻载；带载时 I_lm 峰略增，趋势不变）

| Vin | I_zvs_need (A) | 150k | 170k | 200k | 250k |
|---|---|---|---|---|---|
| 24V | 0.080 | I_lm=2.32A ratio=29 **LIKELY** | 2.05A/26 **LIKELY** | 1.74A/22 **LIKELY** | 1.39A/17 **LIKELY** |
| 30V | 0.100 | 2.90A/29 **LIKELY** | 2.56A/26 **LIKELY** | 2.17A/22 **LIKELY** | 1.74A/17 **LIKELY** |
| 36V | 0.120 | 3.48A/29 **LIKELY** | 3.07A/26 **LIKELY** | 2.61A/22 **LIKELY** | 2.09A/17 **LIKELY** |

（空载励磁电流足够大：Lm=17µH 较小 → I_lm 大。这是"小 Lm 设计"的 ZVS 优势面。）

## 3. 按负载与频率细分（30V，ratio）

| 负载 | 150k | 170k | 200k | 250k |
|---|---|---|---|---|
| 空载 | 29 LIKELY | 26 LIKELY | 22 LIKELY | 17 LIKELY |
| 轻载 5W | 略增 LIKELY | 同 | 同 | 同 |
| 重载 100W | LIKELY（Lm 电流+负载电流共同充放电，LLC 重载 ZVS 通常更容易） | 同 | 同 | 同 |

## 4. 灵敏度与警示

- **Coss 假设敏感**：Coss=500pF → 全区域 LIKELY；Coss=2000pF → ratio 降至 ~4-7，仍 LIKELY；Coss=5000pF（保守大电容）→ 150k ratio=2.9、250k ratio=1.7——仍 >1.2 但余量收窄。**真实 Coss 需 datasheet 或测量**。
- **容性区警示**：若工作点进入 f<fr（24V/30V 需 M>1 时，见 G 节）——LLC 进入容性区后 ZVS 丢失且伴随体二极管反向恢复——**必须避免**。
- **死区过大（DB110）**：td=1.83µs 时 ZVS 需求电流更小（分母大），更容易 ZVS——但 DB110 同时压缩传能。

## 5. 结论

| 区域 | 状态 |
|---|---|
| 150~250kHz、24~36V、空载~重载（理论） | **LIKELY_ZVS**（在 Coss≤2000pF 假设下） |
| 最终 | **UNKNOWN/HARDWARE_MEASUREMENT_REQUIRED** —— 必须示波器 Vds/Vgs 同测确认，且注意 f<fr 容性区风险 |

状态：`ZVS_THEORETICAL_MAP_PREDICTED`（非实板确认）
