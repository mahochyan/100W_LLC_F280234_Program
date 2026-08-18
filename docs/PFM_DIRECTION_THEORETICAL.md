# PFM_DIRECTION_THEORETICAL — 150k/170k 方向理论预测

> 任务：OFFBENCH_LLC_VIRTUAL_BOARD_CHARACTERIZATION_V1（E 节）
> 模型：tools/llc_virtual_plant.py（FHA）
> 状态：**PFM_DIRECTION_SIMULATED**（理论）；**PFM_DIRECTION_HARDWARE_PENDING**（实板 150/170k 两枪未执行/未裁决）

## 1. 理论预测

**THEORETICAL_PFM_DIRECTION = NORMAL（频率↑ → 增益/输出 ↓）**

两种情景一致：150kHz 的 FHA 增益 M 高于 170kHz → 频率升高输出减少。

| 情景 | Cr | fr | M150 vs M170（24V 轻载） | Δ |
|---|---|---|---|---|
| A（标称） | 3.004µF | 49.9kHz | 0.8514 vs 0.8479 | **+0.4%** |
| B（实板一致） | 0.33µF | 150.6kHz | 1.002 vs 0.959 | **+4.2%**（5W 轻载）→ +11.3%（100W） |

## 2. 与 STAGE5A 实板两枪的对照

| 项 | 理论（本次） | 实板待裁决（STAGE5A） |
|---|---|---|
| 方向 | 150k slope > 170k slope（NORMAL） | slope_150 vs slope_170（两枪实测） |
| 差异量级 | 情景 A：<1%（INCONCLUSIVE 边界）；情景 B：4~11% | ≥10% → CONFIRMED；<10% → INCONCLUSIVE |
| 判定规则 | — | 按任务 REMOTE_BENCH §10：≥10% 差异才 CONFIRMED |

**重要警示**：
1. 理论差异（尤其情景 A）**可能 <10%**——若实板两枪也 <10%，按任务规则输出 `PFM_DIRECTION_INCONCLUSIVE`，**不得强行套理论**。
2. 若实板方向与理论相反（slope_170 > slope_150 且 ≥10%）→ `PFM_CONTROL_DIRECTION_REVERSED_IN_TEST_REGION` + 模型检查（MODEL_DIRECTION_MISMATCH）。
3. 150~170k 区间是 fr 的 3 倍（情景 A）或恰在 fr 附近（情景 B）——**两种情况下该区间的增益斜率都较平缓**，斜率差异天然小；若任务目标是显著方向判定，理论建议扩大频率差（如 130k vs 190k），但**本任务禁止自动扩大**。

## 3. 物理机制

- 情景 A（fr=50k）：150/170k 都在感性区远段，M≈0.85 且随 f 缓降 → 差异 <1%
- 情景 B（fr=150k）：150k 恰在 fr（M≈1），170k 已进入感性区上段（M≈0.96）→ 差异 4-11%，随负载加重增大（Q 增大 → 曲线更陡）
- 实板 PFM 窗口测的是 **300µs 内 VOUT 爬升斜率**，∝ (M(f)−整流损耗)/Cout——方向与稳态增益一致，但量级还受 Cout/负载影响

## 4. 结论

```
理论预测：150k → VOUT 爬升快于 170k（正常方向）
置信度：情景 B（fr≈150k）下较有把握（Δ4-11%）；情景 A 下差异微弱（Δ<1%）
裁决：必须实板两枪；差异<10% 按规则 INCONCLUSIVE
```

状态：`PFM_DIRECTION_SIMULATED`（保留 `PFM_DIRECTION_HARDWARE_PENDING`）
