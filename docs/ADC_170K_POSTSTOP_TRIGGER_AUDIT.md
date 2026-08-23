# ADC post-stop trigger leak audit — 170k (FAULT_ADC_STALE_OVERFLOW = 0x40)

- **状态**：`ADC_POSTSTOP_TRIGGER_LEAK_CONFIRMED`（离线代码审计）
- **修复**：`ADC_POSTSTOP_CLEANUP_FIX_DESIGNED`（未应用；见下"阻塞"）
- **未应用 / 未构建 / 未发真实功率**。

## 1. 根因（已确认）

`SS_HardStop()`（`app/soft_start.c`）当前停止序列：

| 步骤 | 操作 | 现有 |
|---|---|---|
| 1 | force OST（`TZFRC.OST=1`） | ✅ |
| 2 | 禁 EPWM1 INT（`ETSEL.INTEN=0`） | ✅ |
| 3 | **禁 EPWM1 SOCA（`ETSEL.SOCAEN=0`）** | ❌ **缺失** |
| 4 | 清 ADCINT1 | ✅ |
| 5 | 清 ADCINTOVF | ✅ |
| 6 | 清 PIEIFR1.INTx1 | ✅ |
| 7 | ADC SOC 回软件/off 安全态 | ❌ **缺失** |
| 8 | 重开 ADCINT1 PIE | ✅ |

**缺失 3 与 7**：force OST（PWM 输出 0）后 `TBCTR` 仍计数 → `SOCA`（`SOCASEL=ET_CTRU_CMPB`）持续触发 ADC → `ADCINT1` 持续发生（且已被重开 PIE）。DSS/JTAG halt 时转换完成但 ISR 未及时服务 → `ADCINTOVF` → `ADCINT1_ISR` 在 `ramp_active==0` 下置 `FAULT_ADC_STALE_OVERFLOW`。

这解释了 170k 枪后 `fault=64`，且窗口数据本身干净（单调 1248→1369、无 COMP/TZ/中止）。

## 2. 最小修复设计（仅改 SS_HardStop 停止顺序，不动功率行为）

在 `EPwm1Regs.ETSEL.bit.INTEN = 0U;` 之后、清 ADC 标志之前，插入：

```c
    /* 3. disable EPWM1 SOCA: no PWM-sync ADC free-trigger after power-off */
    EPwm1Regs.ETSEL.bit.SOCAEN = 0U;
    /* 7. return ADC trigger to software/off safe mode (no new SOC generated) */
    ADC_ConfigureSocs(0U);        /* TRIGSEL write only; no conversion fired */
    g_adc_trigger_mode = 0U;
```

或直接调用既有 `ADC_SetSoftwareTriggerMode()`（封装 `ADC_ConfigureSocs(0)`+`SOCAEN=0`+`g_adc_trigger_mode=0`），置于 `INTEN=0` 后。`ADC_ConfigureSocs` 仅写 `TRIGSEL`，不产生新 SOC（转换只在 SOCA 事件或 `ADCSOCFRC` 软件写触发）。

**不影响功率行为**：SoftStart trajectory / frequency / deadtime / DAC300 / COMP / TZ / VOUT ceiling / PFM window 均不动；仅功率窗口结束（OST）后关闭 PWM 同步 ADC 自触发。

## 3. 禁止的“修 PASS”手段
不得：屏蔽 `FAULT_ADC_STALE_OVERFLOW`、永久关 `ADCINT1`、忽略 OVF、改 `g_no_energy_test_mode`。

## 4. 离线验证设计（Step D，待工具链）
模拟 SoftStart→PFM window→scheduled OST 后确认：`PWM=0, OST=1, SOCAEN=0, ADC 软件安全态, ADCINTOVF=0`；再模拟 debug halt/delay，不得产生 `FAULT_ADC_STALE_OVERFLOW`。输出 `ADC_POSTSTOP_CLEANUP_NOENERGY_PASS`。

## 5. 阻塞（Step E 硬门）
- 本机**不存在** `ti-cgt-c2000_16.9.3.LTS`（仅 `25.11.1.LTS` + ARM/C29）。
- 任务 E 明确：缺 16.16.9 则 **STOP，报告 `LEGACY_TOOLCHAIN_NOT_FOUND`，不得自动换编译器继续真实功率**。
- 故修复应用、构建（F）、170k nopoll 真枪（G/H/I）被阻塞。**修复未应用**，等工具链。
