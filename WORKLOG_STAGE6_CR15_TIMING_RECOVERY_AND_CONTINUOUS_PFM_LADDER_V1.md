# 工作日志：STAGE6_CR15_TIMING_RECOVERY_AND_CONTINUOUS_PFM_LADDER_V1

## 1. 任务范围
- 基线分支：`stage6/first-real-pi-shot-real-binary-hardening-v1-1`
- 目标：先完成实时时序恢复（真实 fmax/active ISR ≤900 cycles），再执行 CR15 实弹阶梯（2ms → 10ms → 100ms）。
- 禁止修改：PI 参数、Profile C、软启动轨迹、145~170kHz 范围、Burst 控制语义、死区、11V 门限 1367、Comparator/OCP/TZ、900-cycle 门限。

## 2. 时序优化结果
- 优化前：normal/fmax 最坏路径曾达 889~952 cycles。
- 优化后：
  - normal compute max = 837
  - fmax compute max = 820
  - apply max = 836~849
  - active ISR max = 837~849
  - shutdown max = 529~534
  - overrun = 0
- 优化手段：
  - CALHOLD IDLE 快速返回，去掉每 tick 32 位乘/限幅计算。
  - ISR 观测块精简，仅保留 `g_real_timer0_entry_count++` 和 `g_real_timer0_last_entry`。
  - 去掉 ISR 内 32 位 Hz 除法，只用 period/TBPRD 比较。
  - Burst black-box 仅在事件 tick 记录。
  - `fmax_saturate_count` 最小化递增/复位/饱和。

## 3. 无源（no-power）验证
- 2ms：compute=837，apply=836，active=837，shutdown=534，overrun=0
- 10ms：compute=837，apply=836，active=837，shutdown=534，overrun=0
- 100ms：compute=837，apply=849，active=849，shutdown=529，overrun=0
- 三档均 PASS：PWM=0，OST=1，TZ INT=0，POST_OST。

## 4. Fmax 压力（no-power）验证
- 使用 REAL_CR15_2MS 二进制，period=352、error<0。
- fmax_saturate_count=0/1/2：compute_fmax=820，无 Burst，安全。
- fmax_saturate_count=3：Burst 进入，安全收尾。
- 全部 PASS。

## 5. 实弹过程记录

### 5.1 第一次实弹尝试（无效，负载错误）
- 当时负载仍为 **20Ω 恒阻**，未先确认用户切换到 CR15Ω。
- 结果：`abort=2`（VOUT_11V），`max_vout_raw=1367`。
- 结论：**该次尝试无效**，不作为 CR15 正式结果。

### 5.2 第二次实弹尝试（有效，15Ω 已确认）
- 用户确认负载已切换为 **CR15Ω（15Ω 恒阻）**。
- 执行 2ms：
  - `state=4`（ABORTED）
  - `abort=6`（SHOT_ABORT_PERMISSION）
  - `max_vout_raw=1357`（未达到 1367）
  - `fault=65600` = `0x10040`
    - `0x10000`：FAULT_FIRST_SHOT_ABORT
    - `0x00040`：**FAULT_ADC_STALE_OVERFLOW**
  - `compute_max=868`，`active_isr_max=868`，`apply_max=849`，`overrun=0`
  - 最终：`PWM=0`，`OST=1`，`TZ INT=0`
- 根据规则：**2ms 失败即停止**，10ms/100ms 未执行，不重试，不自动 CR12.5。

## 6. 最终失败 token
```text
STAGE6_CR15_CONTINUOUS_PFM_FAIL
FAILED_DURATION=2MS
FAILED_GATE=FAULT_ADC_STALE_OVERFLOW
NEXT_LOAD_CANDIDATE=NONE
NO_RETRY_EXECUTED
BOARD_LEFT_SAFE_PWM0_OST1
```

## 7. 已提交记录
- `a00cf9b`：STAGE6_CR15_TIMING_RECOVERY: reduce fmax/active ISR <=900; CR15 2MS real fail -> NEXT_LOAD_CR12.5（初版，含无效 20Ω 尝试）
- `36ef115`：STAGE6_CR15: correct real ladder evidence to valid 15 ohm attempt (2MS ADC stale fail)
- 当前 HEAD：`36ef115fd1aba5a0430072a533ad6110d496c06f`
- 分支：`stage6/first-real-pi-shot-real-binary-hardening-v1-1`

## 8. 待办/建议
- 调查 `FAULT_ADC_STALE_OVERFLOW`：确认 15Ω 实机下 ADC 同步/采样是否出现失步。
- 若需要继续 CR15 100ms，必须先解决该问题并获得新的授权；按当前任务约束不得自行重跑或跳档。
