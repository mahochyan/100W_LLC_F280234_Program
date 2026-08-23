# REAL_POWER 200kHz/DB140 REQUALIFICATION — 3-CYCLE TRIP REPORT

- **Branch** : `requalify/200k-db140-trip-evidence` (NOT merged, NOT a PASS)
- **Base** : main @ `eade8497bde5c08e29d2f875f34a0f79a31b0379`
- **OUT (this PC rebuild)** : `LLC_100W_F28034_BRINGUP_DSH.out`
- **OUT SHA256** : `4A993FFAF6CA2397AE5057DDA36715567BA444429939C1A735122C6096AE7EDF`
- **MAP SHA256** : `ECC5AD8C0C6C13B90870FF947D6650A54DDB46D0A3C7D6A5CF4E2DBB2F6E0625`
- **OUT 标识** : **FAILED_AT_3_CYCLE / NOT_BASELINE**（本 PC 重建 OUT 未通过 3-cycle，不能成为正式基线）
- **工具链** : CCS21 (D:\CCS21\ccs), C2000 CGT 25.11.1.LTS（非原 16.9.3；以 COFF `--abi=coffabi` 构建）
- **方法修正**：DSS 由“轮询读取”改为 **no-polling 单读**（fire → 自由运行 → 单次 halt → 一次性读取）

---

## 1. 结论（一句话）

**1-cycle PASS 是“提前停机”而非“首周期安全”；3-cycle 在 ACTIVE 窗口第 2 个开关边沿被 Comparator→TZ1 硬件保护真实触发（`FAULT_COMP_TZ1`），序列在 3-cycle 中止。** 两枪首周期条件与参数完全相同，差异在于 3-cycle 运行到了 1-cycle 未触达的第 2 个边沿。

## 2. 复验结果汇总

| Shot | RUN_ID | 结果 | completed | stop_reason | ACTIVE delta | fault | 终态 PWM/OST | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1-cycle(首) | 0x20014001 | 0 | 0 | 0 | 0 | 0 | 0/1 | 测量方法反例（polling 破坏） |
| 1-cycle(重跑) | **0x20014071** | **1** | **1** | 1 | **0** | 0 | 0/1 | **PASS（有效证据）** |
| 3-cycle | **0x20014003** | 2 | 1 | 2 | **1** | **16=FAULT_COMP_TZ1** | 0/1 | **TRIP → STOPPED_AT_3_CYCLE** |

15-cycle：**禁止执行，未运行**。

## 3. 首周期条件对比（0x20014071 PASS vs 0x20014003 TRIP）

两枪 PRE 与运行参数**逐项相同**：

| 项 | 1-cycle PASS | 3-cycle trip |
|---|---|---|
| 运行 ID | 0x20014071 | 0x20014003 |
| PRE fault/state/pwm/ost | 0 / IDLE / 0 / 1 | 0 / IDLE / 0 / 1 |
| TZ_OSHT1 / TZA / TZB | 1 / 2 / 2 | 1 / 2 / 2 |
| comp_loopback | 1 | 1 |
| TBPRD(pre) | 399 | 399 |
| VOUT pre (raw) | 10 | 12 |
| 频率/TBPRD/CMPA | 200k / 299 / 150 | 200k / 299 / 150 |
| DBRED/DBFED | 140/140 | 140/140 |
| DAC (COMP) | 300 | 300 |
| 首周期探针 | samples=1, soca=1, eoc=1, max=13 | samples=1, soca=1, eoc=1, max=6 |
| completed_cycles | 1 | 1 |
| **第 2 周期** | **未运行（提前调度 OST）** | **运行到第 2 边沿触发** |
| tz_event_phase | 2 (POST_OST) | 1 (ACTIVE_TRIP) |
| power_window_state | 2 (POST_OST) | 1 (ACTIVE) |
| fault | 0 | 16 (FAULT_COMP_TZ1) |

**首周期时序判定**：两枪第 1 周期均完整完成（completed=1，探针 1 样本，PWM 同步 SOCA/EOC 各 1），PRE 与参数全同 → **首周期不可区分**。差异唯一来源是 3-cycle 越过了第 1 周期边界进入第 2 个开关边沿，Comparator 在此边沿断言。

## 4. 保护链审计（只分析，未改保护）

### 4.1 Comparator 极性 / 输入
- COMP1：`COMPSOURCE=0`（内部 DAC 作反相输入），`COMP1A=IPRI`（非反相，比较器“原边电流/过流”用途，见 `app/comparator.c`）。
- `g_comp_polarity=1` → `CMPINV=1`。
- 输出 `COMP1OUT→GPIO42→PCB→GPIO15→TZ1(OSHT1)`；TZ1 板级为**低有效**（`g_comp_prestart_gpio15==0` → prestart 拒起）。
- prestart 静止判定两枪均干净：`comp_prestart_reject=0`、`comp_inject_armed=1`，`GPIO15=1`。

### 4.2 DAC300 → 实际阈值
- 10-bit DAC，`LSB≈3.3V/1024≈3.223mV`（`COMP_ArmInjectionTest` 注释 31→~100mV）。
- **DAC300 → ≈0.967V**（在 IPRI 感测引脚上的阈值）。
- **实际电流阈值缺口**：仓库 `board_calibration.h` 仅含 VOUT 标定（GAIN 0.008089325 V/raw），**无 IPRI 电流感测增益**。因此 0.967V 换算成原边电流峰值（A）需 PCB 电流感测网络（采样电阻+增益），**仓库证据不足，待补 PCB 增益**。

### 4.3 消隐 / 资格 / 时序
- COMP1 `QUALSEL=5`、`SYNCSEL=0`（异步输出）——**仅是输入资格，不是边沿消隐**。
- TZ1 引脚 GPIO15 资格：`GPAQSEL1.GPIO15=g_tz1_qualification_mode=2`（6 样本）、`QUALPRD1=g_tz1_qualification_period=1`——**同样不是边沿消隐**。
- **两处均无真正的开关边沿 blanking**。200kHz（5µs）每边沿的高 dI/dt 暂态可穿越异步 Comparator。

### 4.4 TZ1 路由 / OST 释放顺序（`app/protection.c` TZ ISR）
- `g_software_ost_in_progress!=0` → 视为软件 OST，**不计 fault**。
- `power_window_state==POST_OST` → 诊断事件，**不计 fault**。
- 其余（ACTIVE 窗口）→ `fault|=FAULT_COMP_TZ1`、`SYS_STATE_FAULT`、`g_pwm_enabled=0`，调用 `MULTICYCLE_AbortByFault()`，保留 OST 锁存。
- 1-cycle：软件 OST（POST_OST 分类）→ 无 fault ✓。
- 3-cycle：ACTIVE 窗口硬跳 → fault ✓。**分类逻辑正确执行**。

## 5. 根因候选（按证据强度）

1. **[高，可重复] 无开关边沿消隐 + DAC300≈0.967V 贴近运行 IPRI 峰值 → 第 2 个开关边沿被 Comparator 捕获触发 TZ1。** 1-cycle 只是提前于该边沿调度 OST，故“PASS”不证明第 2 边沿安全。参数点(200k/DB140/DAC300)下第 2 周期会稳定越阈 → 可重复，非随机噪声。
2. **[中] 谐振启动暂态 / 谐振电容初值累积**：第 1 脉冲建立电流，第 2 周期原边峰值更高，越过阈值。
3. **[中] 电流感测偏置/噪声**：若 IPRI 感测存在 DC 偏置或开关噪声，贴近阈值的信号在边沿处反复上下穿越。
4. **[低] 母线/驱动电源/测量**：两枪均 24V、VOUT 未升，非主要分差。

**非分项（已审计，两枪相同）**：启动相位/确定性 TBCTR、OST 释放顺序、极性、TZ1 路由、资格/消隐配置、放电、Comparator 预启动、DAC 值。

## 6. 数据缺口 / 未完成

- **IPRI→电流换算**：缺 PCB IPRI 感测增益（仓库只有 VOUT 标定）。
- **触发边沿精确 TBCTR/Timer**：脚本未抓 `g_comp_trip_tbctr/g_tz_isr_*`（本轮 dump 未读）；为避免 reload 清掉 RAM fault 证据，**未再次连板**。已保留 `completed_cycles_at_trip=1` 作为“第 2 周期”证据。
- **示波器**：本机无示波器自动化导出。若现场示波器仍保留捕获，请单独导出并放入证据集，我据其 SHA256 收录（仅导出，不重新触发）。

## 7. 处置（已执行）

- 保持 `FAULT_COMP_TZ1` 与 OST **锁存**；未清故障、未复位、未重试、**未执行 15-cycle**。
- 证据已保存并哈希（见 `debug_capture/*.raw.log` / `*.json` / `SHA256SUMS`）。
- **本轮**：证据 + 报告 + DSS 修正提交到独立分支（本分支），**不得合并 main、不得以 PASS 提交**。

## 8. 下一步（未授权前禁止）

- 在分析证明触发可控制且可重复前，**不得二次 3-cycle**、不得 15-cycle。
- 建议（仅分析方向）：确认 IPRI 感测增益与真实阈值；评估加入开关边沿 blanking 或提高阈值余量/资格窗口；确认第 2 周期电流建模与实测一致。**修改保护需另行评审授权**。
