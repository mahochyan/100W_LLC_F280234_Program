# TZ-ISR-Entry Trip Snapshot — Diagnostic Design (NOT RUN)

- **Branch** : `diag/200k-3cycle-trip-snapshot`
- **状态** : DESIGN ONLY — **不得执行真实 shot**。BUILD + 无能量静态测试已通过。
- **不改** : DAC / qualification / TZ source / deadtime / PWM trajectory。改动为**纯记录**。

## 目标
在 TZ ISR 入口**尽可能第一时间**快照，用于判明 3-cycle trip 的真实触发（幅值 / 持续时间 / 精确 TBCTR / 实测电流）。

## 快照字段（全部在 TZ ISR 入口，分类判定之前）
| 字段 | 类型 | 来源 |
|---|---|---|
| `g_comp_trip_tbctr` | Uint16 | `EPwm1Regs.TBCTR` |
| `g_comp_trip_timer2` | Uint32 | `CpuTimer2Regs.TIM` |
| `g_comp_trip_cmpsts` | Uint16 | `Comp1Regs.COMPSTS.COMPSTS` |
| `g_comp_trip_gpio15` | Uint16 | `GPADAT.GPIO15` |
| `g_comp_trip_tzflg` | Uint16 | `EPwm1Regs.TZFLG` |
| `g_comp_trip_dac` | Uint16 | `Comp1Regs.DACVAL.DACVAL` |

## 实现（已并入本分支，BUILD OK）
- `app/llc_globals.c` / `.h`：新增 `g_comp_trip_timer2 / cmpsts / gpio15 / tzflg / dac`（`tbctr` 已有）。
- `app/protection.c` `EPWM1_TZINT_ISR` 入口：在既有 `g_tz_isr_*` 快照旁追加 `g_comp_trip_*` 汇总快照。

## 构建 / 验证（已做）
- `tools/build_debug.bat` → **BUILD OK**；MAP 含 5 个新符号。
- 诊断 OUT SHA256 = `5B347B63F976599D6BE1927A46E1F0A229679DAAAE0B3A5705031B44FAB0D749`
- `tools/test_static.py` 无能量静态：源码/映射/构件检查通过（仅无关的 IDE `.launches` 项除外）。
- **未执行任何真实 shot / 未上电功率。**

## 后续（需台架 + 评审授权）
- 由 DSS 在 trip 后读取这 6 项 + 示波器真实触发波形，判定 A/B/C 与实测安培值。
- 在此之前不得评估 blanking，不得改保护。
