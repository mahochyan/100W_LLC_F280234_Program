# W4 迭代账本审计与门分类提案（V1）

```text
STATUS=ACCEPTED__OPTION_B_BY_USER_2026_09_06
DATE=2026-09-06
SCOPE=PAPER_AUDIT_ONLY__NO_TARGET_ACCESS__STATE_FILE_UPDATED_TO_V83_WITH_USER_APPROVAL__NO_GIT_COMMIT_YET
AUTHORITY=USER_ACCEPTED_OPTION_B
SUPERSEDES=NOTHING（本文档不改动任何已冻结处置；裁决已记入状态文件 v83）
```

依据：总工作单 §0 规则 5/6、§20 三次闭合条款；`docs/SOL_MASTER_EXECUTION_STATE.md` v82；`docs/SOL_MASTER_PAUSE_REPORT_2026-09-06.md`；`evidence/sol_master_execution/w4_10v_quality/` 全部 35 份证据。

---

## 1. 审计问题

- **Q1** V9–V13 与 V14/V15 是否属于同一个"门"？三次迭代规则如何计数？
- **Q2** 原始令牌 `W4_10V_PI_PFM_BASELINE_ACCEPTED` 的最终处置？
- **Q3** V15 协调链失败与 capsule 丢失的最小根因分类？

## 2. 定义（引自总工作单）

- **实弹尝试** = 一次真实点火（POWER_REQUEST_FIRED=TRUE）。
- **根因修复迭代** = 完成可证明的根因修复并生成新 SHA 后的新合格试验（§0 规则 5）。
- **三次规则** = 每个门最多 3 个不同根因修复迭代；三次仍不能闭合，或缺少必需仪器/操作者动作时，才允许硬停止（§0 规则 6、§20）。
- 失败类别：**ENG**（控制/被控对象工程失败）、**INF**（测量与协调基础设施失败：FTDI/DSS/ACK 链）、**OPS**（操作者过程失败：物理步骤未发生/窗口内行为与授权模型冲突）。

## 3. 账本（W4 全部实弹）

| # | 版本/方向 | 结果 | 类别 | 关键事实 | 证据 |
|---|---|---|---|---|---|
| 0a | V8 CR10 稳态保持 0.5s/2s/10s | 10s FAIL_SAFE_UNDERSUPPLY→RETIRED | ENG | 限能不足，安全失败 | `real_cr10_v8_10s_v1.txt` |
| 0b | V9 CR10 稳态保持 0.5s/2s/10s/60s @0.7A | 全 PASS | — | 构成稳态基线，非 trace 门 | `real_cr10_v9_0p7a_60s_v1.txt` |
| 1 | V9 heavier CR15→CR12.5 | INVALID，NOT PASS | INF | FTDI −150 贯穿运行，target time 无效 | `real_cr15_to_cr12p5_v9_invalid_target_time_v1.txt` |
| 2 | V10 lighter CR12.5→CR15 | FAIL_NO_STEP | OPS | 窗口内无物理步骤；保持与安全门全过 | `real_cr12p5_to_cr15_v10_no_step_v1.txt` |
| 3 | V11 heavier CR15→CR12.5 | INVALID_UNVERIFIED | OPS+INF | 操作者确认全程 CR15 未步骤；FTDI −150；需外部断电结束 | `real_cr15_no_step_v11_ftdi150_unverified_v1.txt` |
| 4 | V12 heavier CR15→CR12（实际） | INVALID_UNVERIFIED | OPS+INF | 实际步骤 CR12 而非申报 CR12.5，ACK 在 fire+1038s（两窗口外）；FTDI −150/−1041 | `real_cr15_to_cr12_v12_late_ack_ftdi_unverified_v1.txt` |
| 5 | V13 lighter CR12→CR15 | FAIL_TRACE_NO_DETECTION | **ENG** | 协调链全过、capsule 有效（STATE4/REASON1/elapsed=180s/cookie 匹配）；固定启动基线结构性过期→trace 无检出 | `real_cr12_to_cr15_v13_stale_baseline_v1.txt` |
| 6 | V14 heavier CR15→CR12 | plant PASS，token FALSE | ENG(部分)+INF | demand 26475→31284/31284/31561，200ms post 30369，终态 PWM0/OST1/TZINT0/fault0；host ACK 链失败 | `real_v14_heavier_target_pass_host_ack_invalid_v1.txt` |
| 7 | V15 lighter CR12→CR15 | FIRED_ONCE__COORDINATION_INVALID__CAPSULE_LOST | OPS+INF | 盲窗内操作者要求重来；70s/205s isHalted=FALSE；attach capsule state0/cookie0/RUN_ID 错 | `real_v15_coordination_invalid_capsule_lost_pause_safe.txt` |

辅助（非 A/B/A 门）：sweep V1 CR20→CR5 无有效负载变化（OPS/INF）；sweep V2 CR20→CR8 协调无效且越过 10 W 片上 ADC 边界（历史仪器门流程偏差，不得补标、不得豁免 W9）。

**根因修复迭代链（每次均有新 SHA）：**
V9→V10（检测时序+prefire clock gate）→ V11（固件自主 60–180s 窗口+ACK barrier）→ V12（quiet host+cookie 终态）→ V13（profile 绑定 SHA）→ V14（warmed rolling 参考+target marker）= **5 次，超过 3 次**。V14→V15 仅 host 无屏协议修订（源/算法号更新，控制内容不变）。

**失败类别统计（7 次实弹）：ENG 1 次（V13，已被 V14 修复并验证）、ENG部分+INF 1 次（V14）、纯 INF 1 次（V9）、OPS 参与 4 次（V10/V11/V12/V15）。没有任何一次是被控对象或保护系统物理失败。**

## 4. Q1 裁决分析：是否同一门

**分类甲（严格单一门）**：V9–V15 全部计入"10 V 负载阶跃质量门"→ 7 次实弹、5 次根因迭代 ≫ 3 → 按 §0.6/§20 该门硬停止，不得再迭代。

**分类乙（两个门）**：
- G1 = 原始 active PI/PFM A/B/A 门：**从未真实点火过 0 次**——其前置（active PI 在真实中断路径）在当前二进制中不存在（控制模式审计：`OPENLOOP_FastTask` 在路径上，`CTRL_FastTask`/PI 不在；`w4_pi_pfm_control_mode_deviation_v1.txt`）。账本把它记为 5 次超限是**记账口径错误**，不是该门被尝试超限。
- G2 = protected-Burst plant-response/trace 偏差门：7 次实弹、5 次根因迭代 → 仍超 3 次规则。

**两种分类的共同结论：10 V trace/返回腿目标的迭代预算已耗尽，账本超限状态（PROCESS_DEVIATION）成立且永久保留。** 分歧仅在：分类乙额外确认"原门零尝试"，并把 V14/V15 的定位从"原门延续"改为"独立偏差门"。

## 5. Q2 裁决建议：原始 W4 令牌处置

证据链：
1. W2 终局特征化：CR15/CR12.5/CR10/CR7.5 全部 NOT_FOUND，10 V 连续 PFM 点在 145–190 kHz 不存在（`CONTINUOUS_PFM_PLANT_RANGE_MISMATCH`）。
2. 控制模式审计：active PI 不在真实中断路径，Kp/Ki/积分/频率轨迹从未施加。
3. V15 离线门显式声明 `PI_UPDATE_AND_INTEGRAL_UNCHANGED__PI_PFM_ACTIVE_FALSE`。
4. 状态文件 1448 行：`W4_ORIGINAL_TOKEN=NOT_ISSUED__CANNOT_BE_EARNED_BY_V14_V2_OR_V15_PROTECTED_BURST`。

**建议裁决：`W4_10V_PI_PFM_BASELINE_ACCEPTED` = 永久 DEFERRED + 接受工程偏差**（与 W2/W3 同型）。重新打开该令牌的唯一路径 = 未来的控制区重设计使 active PI/PFM 真实进入中断路径并证明 10 V 连续 PFM 工作点（属于新工作内容，不是 W4 retry）。**不得由 W5 的 10.5–12 V 点回填。**

## 6. Q3 裁决建议：V15 协调链/capsule 丢失最小根因

- **分类：OPS+INF，非固件缺陷。** prefire 全 PASS、点火执行、提示音按设计播放；失败发生在授权模型（"盲窗单发、窗内无人工动作"）与操作者实际行为（盲窗内要求重来）的界面处。
- host 行为正确：70s/205s 有界探测 `isHalted=FALSE` → 按 fail-closed 不 halt、不写 target。
- capsule 丢失与"点火后、11:09 attach 前发生过复位/断电事件"一致（RAM capsule 被清除：state0/cookie0/RUN_ID 0xFCF20389 错误/elapsed 4230290221 不连贯），但**无法证明**清除来源；此不确定性永久保留，不得补写。
- 暂停安全门（CPU halted/时钟关/GPIO 低）证明板级无输出，与固件自主 backstop 后干净复位兼容——**不构成固件失效信号，也不构成 V15 终态证据**。

**对一切未来实弹都生效的过程修正（建议采纳）：**
1. 点火前 ≤5 分钟按 §0.1 单条消息重新确认台架（负载档位+输入限流逐项显式确认；V15 实际带着 1.2 A 限流和 CR12 点火，而计划值是 0.5 A——确认链在无屏指令下被压缩，登记为促成因素）。
2. **窗内无动作规则**：点火后到 host 终态或 205 s 前，任何操作者动作（含"重来"）即判协调无效——已发生即此类。
3. capsule 只在与观测到 isHalted=TRUE 同会话读取；跨会话 attach 的 capsule 默认按 stale 处置。
4. 限流档位与负载档位必须与该次 run 的离线门声明一致，不一致禁止点火。

## 7. 裁决选项（待用户选定）

- **选项 A——接受分类乙 + 最后一次全新点火**：V14/V15 重记为独立 protected-Burst 偏差门的尝试 1/2（V15 失败归类 OPS+INF，非工程失败），预算还剩 1 次。条件：全新 run/algorithm/source/SHA；离线全门+新协调预检；§6 四项过程修正全部生效；单发。若再失败→该门永久硬停止。
- **选项 B——现在硬停止（推荐）**：行使 §0.6 允许的硬停止，10 V trace/返回腿门不再点火；W4 以偏差闭环（plant-response 证据以 V14 heavier 为最强单件）；直接进入 W5。轻载返回腿证据登记为永久 deferred。
- **选项 C——暂不裁决**：维持 PAUSED 现状，仅保留本文档。

任何选项下不变：不重放 SHA `A2148D52…`；不把无效 capsule 补成 PASS；V15 处置 `FIRED_ONCE__COORDINATION_INVALID__TERMINAL_CAPSULE_LOST__NO_RETRY` 不变；W0–W3 不重做；账本超限作为永久流程偏差保留。

**推荐理由（选项 B）**：7 次实弹中 0 次被控对象/保护失败，工程内容在 V14 已达 plant-response PASS；返回腿 A/B/A 对称性属于记录完整性收益，不解锁任何下游工作单；通往 50 W 的真硬门是 W5→W9 链，每多一次 10 V 点火都增加 OPS/INF 风险而无下游收益。W5 阶梯本身就是工作单认可的替代控制质量证据来源。

## 8. 若选择选项 A 的强制条件清单

1. 新 RUN_ID、新 ALGORITHM 号、新 source commit、新 OUT/MAP SHA（四元组全新，禁用 0x25090602/0x0017/0cf623d/A2148D52）。
2. 离线全门 + 新增"协调链预检"：§6 第 1/2/4 项以硬门写入 host 脚本（确认不到位即拒绝点火）。
3. 点火前单条消息台架确认，操作者回复确认码后方可点火。
4. 单发；无论结果（PASS/INF/OPS）该门随即终局：PASS→偏差令牌签发；否则→永久硬停止。

## 9. 本文档自身的影响面

- 新增未跟踪文件一份（本文档）；**未改动** `SOL_MASTER_EXECUTION_STATE.md`（避免产生 tracked dirty——等裁决接受后随状态更新一并提交）。
- 未接触 target；暂停安全门证据继续有效。
- git 提交待会话 shell 恢复后执行（当前提交/推送由用户终端代跑亦可）。

---

## 10. 裁决记录（2026-09-06，用户选定选项 B）

```text
RULING=OPTION_B_ACCEPTED
W4_TRACE_GATE=HARD_STOPPED（行使总工作单 §0.6 三次规则允许的硬停止）
W4_ORIGINAL_TOKEN=W4_10V_PI_PFM_BASELINE_ACCEPTED__DEFERRED_PERMANENT_WITH_ACCEPTED_DEVIATION
W4_DEVIATION_CLOSURE=W4_10V_CONTROL_QUALITY_CLOSED_WITH_PROTECTED_BURST_PLANT_RESPONSE_DEVIATION
V15=UNCHANGED__FIRED_ONCE__COORDINATION_INVALID__TERMINAL_CAPSULE_LOST__NO_RETRY
NEXT_WORK_ORDER=W5（实弹需用户明确恢复指令 + §6 过程修正全部生效）
STATE_FILE=SOL_MASTER_EXECUTION_STATE.md -> STATE_VERSION=83
```

选项 A（独立 protected-Burst 偏差门 + 最后一次全新点火）未获选择，其§8 强制条件清单随之作废存档。