# 200kHz / DB140 — NOT A PRODUCTION PATH AUDIT

- **Scope** : confirm `200kHz/DB140` is NOT a startup workpoint of the formal SoftStart path.
- **Base** : main @ `eade849`（未改动）
- **判定** : `REQUALIFICATION_POINT_FAILED` / `NOT_PRODUCTION_BASELINE` / `DO_NOT_RETRY`

## 1. 正式 SoftStart 起振轨迹（源码静态核验）

`app/soft_start.h`（`SOFTSTART_PROFILE_DEFAULT`）：

| 阶段 | 周期/频率 | CMPA | DB | 说明 |
|---|---|---|---|---|
| START_HOLD | `SS_START_PERIOD=239` → 250kHz | 120 | `SS_START_DB=110` | 250kHz / DB110，15 周期 |
| PHASE_A | 固定 239（250kHz） | 120 | DB110→36（step 5，15 段） | 定频死区斜坡 |
| 频率斜坡 | `239→399`（250kHz→150kHz） | 逐步 | `SS_FINAL_DB=36` | DB36 频率斜坡 |
| 完成 | `SS_FINAL_PERIOD=399` → 150kHz | 200 | `SS_FINAL_DB=36` | 150kHz / DB36 |

正式基线：**250kHz/DB110 → 定频 250k 死区斜坡 DB→36 → DB36 频率斜坡 → 150kHz/DB36**。

## 2. 200kHz/DB140 是否出现在正式轨迹

- **否**。任何 `SS_*` 常量均不含 `299/200k` 或 `DB140`。
- `200k/DB140` 仅能经 **诊断 MULTICYCLE** 路径达成：`g_diag_frequency_override=1` + `g_single_cycle_probe_frequency_hz=200000` + `g_single_cycle_probe_deadtime=140` + `LLC_SINGLE_CYCLE_PROBE_DAC=300`，受 `LLC_DIAG_ALLOW_200K_DB140=1`（注释：`BRINGUP_DIAGNOSTIC_LEGACY only`）门控。
- 默认频率 `LLC_DEFAULT_FREQUENCY_HZ=150000`。
- **结论**：`200kHz/DB140` 不是正式 SoftStart 中的启动工作点。

## 3. 根因重新分级（Section 5 / 6）

**CONFIRMED（已确认）**
- ACTIVE TZ 是真实硬件事件（`FAULT_COMP_TZ1`，非软件/诊断）。
- 事件只在允许继续进入**第二有效开关边沿**后出现（1-cycle 在首周期末调度 OST 未进入第二边沿）。
- 1-cycle 与 3-cycle 首段条件一致（PRE/参数/首周期探针全同）。
- 200k/DB140 当前**不可通过多边沿资格**。
- Protection classification 工作正确（POST_OST 不计 fault，ACTIVE 计 fault）。

**POSSIBLE（可能）**
- A. 真实 LLC 启动暂态峰值越过 DAC300。
- B. 开关边沿引起 IPRI CT / 整流 / PCB 瞬态毛刺越过 DAC300。
- C. 两者叠加。

**UNKNOWN（未知）**
- 真实触发幅值、真实触发持续时间、真实触发精确 TBCTR、实际安培值。

**EDGE_BLANKING_EVALUATION_PENDING（Section 6）**
- 不得把 "没有 edge blanking" 直接写成根因，也不得宣称 blanking 是修复方案。
- 未来仅在示波器确认"触发脉冲明显属开关毛刺 **且** 真实谐振电流低于安全阈值"后才允许评估 blanking。
- 本轮**不改 blanking / qualification / DAC / TZ**。

## 4. 禁用清单
为让该测试点 PASS 而禁止：提高 DAC300、增加 blanking、增大 qualification、关闭 Comparator、修改 TZ、自动重试、执行 15-cycle。
