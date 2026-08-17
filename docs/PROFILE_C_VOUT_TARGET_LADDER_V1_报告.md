# PROFILE_C_VOUT_TARGET_LADDER_V1 — 完整交付报告

> 项目：100W 数控全桥 LLC（CSS024D-DCDC-V2.0 复刻版）
> 控制器：TI TMS320F28034
> 基线：GitHub `mahochyan/100W_LLC_F280234_Program` commit `3c4c11d`
> 任务：PROFILE_C_VOUT_TARGET_LADDER_V1
> 完成日期：2026-08-17
> git：`3c4c11d` → `ee644c0`（V1 功能）→ `5425740`（链接修复）

---

## 1. 基线状态（任务前已确认）

- Profile C（ACCELERATED BOUNDED SOFTSTART）已 PASS：
  - 250kHz / DB110 平台 15 cycles → DB 每 10 cycles 降 5 → DB36
  - DB36 下 250kHz → 150kHz（TBPRD 每 10 cycles +10）
  - 150kHz / DB36 Phase C，最多 150 cycles
- 已确认：`RUNTIME_ADC_PLAUSIBLE_POSTSTOP_DELAY_MISMATCH`
  - `runtime_before_ost = 776`
  - OST+5/10/20/50/100µs ≈ 778~788
  - **结论：PWM-sync runtime ADC 可信**（ADC 相位实验不再进行）

---

## 2. 任务目标

在已 PASS 的 Profile C 上，把输出受控建立到 **1200 raw**，之后立即 OST。

- 第一目标：1200 raw，之后立即 OST
- 本轮只执行 1200，**不得自动执行 1400**
- 但固件同时预留 1400 目标，使下一枪无需重新编译

---

## 3. 实施对照（任务 10 条 → 代码落点）

### 3.1 Profile C 完全不改 ✅

保持：启动频率、DB 轨迹、周期步长、DAC300（`LLC_SINGLE_CYCLE_PROBE_DAC`）、
qualification（GPIO15 6-sample QUALPRD）、Comparator/TZ 全部零改动。

代码落点：`app/power_probe.c` Phase A/B/C 轨迹代码未动，仅删除停止判断行。

### 3.2 删除旧 300/800 诊断阈值，新增目标阶梯 ✅

| 旧语义 | 新语义 |
|---|---|
| Phase C target = 300 raw（硬编码） | 删除 |
| 全局辅助 hard stop = 800 raw（硬编码） | 删除 |
| — | `g_accel_vout_target_raw`：仅允许 **1200 / 1400** |

非法值（非 1200/1400）→ `g_accel_target_rejected = 1` + REJECT（`result = 3`），
**不启动真实功率**。

代码落点：`app/llc_globals.h/.c`（新全局 + `ACCEL_VOUT_TARGET_1200/1400` 常量）、
`app/power_probe.c` `MULTICYCLE_SlowTask()` 校验段。

### 3.3 硬限值不能跟着用户任意设置 ✅

固件内部固定映射（`ACCEL_HardLimitForTarget()`，静态函数，无外部可写变量）：

```
target 1200 → hard limit 1300
target 1400 → hard limit 1450
```

CCS 无法改大 hard limit（不存在可写变量；即使改写 `g_accel_vout_target_raw`
为非法值也只导致 REJECT，不会放大安全门）。formal OVP 未校准前，这是本轮
必须保留的 Bring-up 安全门。

### 3.4 runtime VOUT 判断 ✅

- 只使用 **fresh** `g_adc_vout_pwm_sync_raw`：ISR 内新增 `vout_fresh_this_cycle`
  标志，仅当本周期 SOCA 置位（ePWM1 触发 → EOC 完成）时才允许 VOUT 判断
- SOCA/EOC freshness 检查保留（`g_adc_pwm_sync_valid` 门 + `consecutive_miss`）
- **连续 miss ≥ 3 → 立即 OST 停止**（`ACCEL_STOP_STALE_ADC`，同一 ISR 内执行
  scheduled OST，不等 5ms 任务）

代码落点：`app/power_probe.c` `EPWM1_INT_ISR()`。

### 3.5 Target 与 Hard Limit 优先级 ✅

每个 fresh sample，按顺序：

```
VOUT >= hard_limit (1300)  → 立即 scheduled OST, stop_reason = ACCEL_STOP_HARD_LIMIT (3)
否则 VOUT >= target (1200) → 立即 scheduled OST, stop_reason = ACCEL_STOP_VOUT_TARGET (2)
```

命中即在**同一 ISR 周期**停止（`g_multi_cycle_probe_cycles = cyc` →
后续 cycles 判断立即触发 OST 路径），绝不等到 5ms slow task。

### 3.6 周期上限 ✅

- `MAX_TOTAL_CYCLES = 485` 保持（Phase A+B 后进入 Phase C 时重申 485）
- Phase C 内 150 cycles cap 保持
- 485 cycles 结束仍未到 1200 → 正常 OST，`stop_reason = ACCEL_STOP_MAX_CYCLES (1)`
- **不得自动延长**

### 3.7 停止瞬间记录（冻结快照）✅

`ACCEL_FreezeStopSnapshot()` 在三条停止路径调用（scheduled OST / 硬件 trip /
AbortByFault），冻结：

| 字段 | 变量 |
|---|---|
| target_raw / hard_limit_raw | `g_accel_stop_target_raw` / `g_accel_stop_hard_limit_raw` |
| stop_raw / max_raw | `g_accel_stop_raw` / `g_accel_stop_max_raw` |
| completed_cycles | `g_accel_stop_completed_cycles` |
| phase_at_stop | `g_accel_stop_phase` |
| TBPRD / CMPA / CMPB | `g_accel_stop_tbprd/cmpa/cmpb` |
| DBRED / DBFED | `g_accel_stop_dbred/dbfed` |
| DACVAL | `g_accel_stop_dacval` |
| run_id 链 | `g_accel_stop_run_id_at_arm/stop/tz_isr` |
| ACTIVE trip / fault | `g_accel_stop_tzflg` / `g_accel_stop_fault_flags` |
| SOCA / EOC / miss 计数 | `g_accel_stop_soca_count/eoc_count/miss_count` |

### 3.8 保留 Immediate Truth ✅

scheduled OST 后继续记录（`TRUTH_CaptureImmediate()` 保持）：
`g_vout_runtime_before_ost` + OST+5/10/20/50/100µs（`g_truth_post_*`）。
5ms Slow POSTSTOP 保留留档，**不再作为 runtime 准确性 PASS 条件**。

### 3.9 第一枪 ✅

- RUN_ID：`0x250C1200`（写入 `g_test_run_id`；arm/stop/tz_isr 三点冻结验证）
- `g_accel_vout_target_raw = 1200`（**固件默认值**，CCS 无需设置）
- Vin = 24.0V，bench current limit = 0.20A，CNT3/CNT4 CONNECTED
- 完整 Cold Shot：24V OFF → VOUT 充分放电 → 上 24V → reload 最新 OUT →
  本次上电第一组 power pulse

### 3.10 预留 1400 但禁止自动执行 ✅

同一 OUT 支持 `target = 1400, hard = 1450`（映射已内置，CCS 改
`g_accel_vout_target_raw = 1400` 即下一枪，**无需重新编译**）。
本轮固件默认 1200，**不会自动执行 1400/1489/30V/闭环/长时间保持/提高 DAC/
修改 qualification**。

---

## 4. 代码改动清单

```
 app/llc_globals.h        +43   新常量/全局声明（target、hard limit、stop 快照 18 字段）
 app/llc_globals.c        +23   新全局定义（g_accel_vout_target_raw 默认 1200）
 app/power_probe.c        +149  硬限映射 + 快照冻结 + ISR 阶梯判断 + SlowTask 校验
 app/protection.c         +1    TZ ISR stop_reason 3 → ACCEL_STOP_TZ_TRIP (4)
 28034_RAM_lnk.cmd        +1    .cinit 移至 RAMLALL（链接修复）
 tools/test_static.py     +46   新增 V1 静态检查 15 项
 CHANGES.md / CCS_EXPRESSIONS.md / 开发日记   文档同步
```

stop_reason 枚举（`g_accel_stop_reason`）：

| 值 | 常量 | 含义 |
|---|---|---|
| 0 | `ACCEL_STOP_NONE` | 未停止 |
| 1 | `ACCEL_STOP_MAX_CYCLES` | MAX_CYCLES_REACHED |
| 2 | `ACCEL_STOP_VOUT_TARGET` | VOUT_TARGET_REACHED |
| 3 | `ACCEL_STOP_HARD_LIMIT` | HARD_VOUT_LIMIT |
| 4 | `ACCEL_STOP_TZ_TRIP` | ACTIVE TRIP |
| 5 | `ACCEL_STOP_STALE_ADC` | SOCA/EOC miss ≥ 3 |

---

## 5. 构建与验证

### 5.1 编译（WSL → Windows C2000 CGT 16.9.3.LTS）

```
tools/build_debug.sh → cmd.exe → cl2000.exe -v28 -ml -mt -O4
```

- **BUILD OK**：全部 .c 编译通过，链接成功
- `.out` 生成：`Debug/LLC_100W_F28034_BRINGUP_DSH.out`（257KB）
- 编译警告均为基线既有（volatile 指针初始化、未引用变量），无新增警告

### 5.2 链接修复记录

首次链接失败：`.stack`(0xBF=191B) 放不进 RAMM1——V1 新增 18 个快照全局
（+~48B .ebss、+~10B .cinit）使 RAMM1 剩余从 0x84 缩水。

修复：`.cinit`（232B）从 RAMM1 移至 RAMLALL（.text 后仍有 ~5.4K 空闲）。
RAMM1 现布局：.ebss 0x214+48 + .stack 0xBF = 0x303 < 0x380 ✅

### 5.3 静态测试

`python3 tools/test_static.py` → **ALL STATIC CHECKS PASSED**

- V1 专项 15 项全过：目标常量/映射/REJECT/快照/miss 停止/fresh 门/800/300 删除
- 构建产物检查：fresh .out/.map/_linkInfo.xml 全过

---

## 6. 第一枪操作流程（CCS）

```
1. 连接 XDS100v2，加载 Debug/LLC_100W_F28034_BRINGUP_DSH.out
2. Expressions 添加并设置：
     g_test_run_id         = 0x250C1200
     g_accel_vout_target_raw = 1200     （固件默认已是 1200，可跳过）
3. 断电流程：
     24V OFF → VOUT 充分放电（万用表确认 <1V）→ 上 24V → reload（Restart）
4. 触发：g_accel_request = 1
5. 观察（自动停止后）：
     g_accel_stop_reason / g_accel_stop_raw / g_accel_stop_max_raw
     g_accel_stop_completed_cycles / g_accel_stop_phase
     g_accel_stop_tzflg / g_accel_stop_fault_flags
     g_vout_runtime_before_ost / g_truth_post_5us..100us
```

---

## 7. PASS / FAIL 判据

| 结果 | 条件 | 输出 |
|---|---|---|
| **PASS A** | `stop_reason == 2`（VOUT_TARGET_REACHED）且 `stop_raw ∈ [1200, 1300)` 且 trip=0 且 fault=0 且 pre_stop_ost=0；最终 PWM=0、OST=1 | **PROFILE_C_VOUT1200_PASS** |
| **PASS B** | 485 cycles 完成、VOUT < 1200、trip=0、fault=0 | **PROFILE_C_VOUT1200_NOT_REACHED**（报告 `stop_max_raw`），不自动延长 |
| **FAIL** | VOUT ≥ 1300 触发 hard stop | **PROFILE_C_VOUT1200_OVERSHOOT_STOP** |
| **FAIL** | ACTIVE TZ | **PROFILE_C_VOUT1200_ACTIVE_TRIP** |

---

## 8. 风险与注意

1. **formal OVP 未校准**：hard limit（1300/1450）是唯一软件安全门，不得通过任何
   途径放大；如需调整必须改固件重新编译
2. **ADC 标定**：1200 raw ≈ 9.7V、1300 raw ≈ 10.5V 仍为理论换算（0.1 分压），
   实板标定前不要以电压值断言
3. **第一枪为冷启动**：确保 VOUT 放电干净、CNT3/CNT4 已连接、bench 限流 0.20A
4. **本轮禁止**：1400、1489、30V、闭环、长时间保持、提高 DAC、修改 qualification
5. 若出现 `ACCEL_STOP_STALE_ADC`：检查 PWM-sync ADC 触发链路（SOCA 相位/
   CMPB 边缘距离），不是功率问题
