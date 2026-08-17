# STAGE5 正式 SoftStart 验收报告（实板单发 10V）

> 日期：2026-08-17
> 流程：FORMAL_SOFTSTART_STAGE5_ACCEPTANCE_V1
> 提交：6835b47（无能量验收）+ 101a381（射击脚本）；本次实板射击为最终验收
> OUT SHA256：`4736e987001cfc799e77b16c0b321efe88c994c2ec70aa759910ee35730da9d9`

## 1. 验收目标

把实板已验证的 Profile C 轨迹正式化为 SoftStart 引擎（`app/soft_start.c`），
经无能量验收后执行**单发实板 10V 验收射击**：

- 轨迹：250kHz/TBPRD239/CMPA120/CMPB60/DB110 ×15cyc → DB110→36（5/步×10cyc）
  → 周期 239→399（+10/步×10cyc）→ 150kHz/399/200/100/DB36
- 验收：`acceptance_mode=1`，VOUT raw ≥ 1244（标定 10V）→ 计划 OST
- 硬顶：raw ≥ 1491（标定 12V）→ 立即 OST
- 台架：Vin 24.0V / 限流 0.20A / CNT3-CNT4 连接 / VOUT 放电 / 冷启动

## 2. 无能量验收（前置，PASS）

| 指标 | 值 |
|---|---|
| result | 2（SS_RESULT_ACCEPT_TARGET） |
| fault | 0 |
| cycle_count | 346（轨迹全周期） |
| 终点配置 | TBPRD=399 / CMPA=200 / CMPB=100 / DB36 |
| soca=eoc | 332~346（新鲜采样） |
| 目标命中 | FINAL 阶段仿真 1260 ≥ 1244 |
| run_id | 0x250C5000 |

## 3. 无能量阶段修复的缺陷（3 个根因）

| # | 症状 | 根因 | 修复 |
|---|---|---|---|
| 1 | fault=0x8000 | 陈旧 soft_start.obj：-O2 单独编译行缺 `--obj_directory`，链接用了旧 obj（旧代码带 FAULT_COMP_PRESTART_REJECT） | build_debug.bat 补 `--obj_directory="%BUILD%"` |
| 2 | fault=0x08 拒启 | 250kHz/239 超生产包络 399-428，缺 `g_diag_frequency_override` | 脚本前置补写（与 shot_* 一致） |
| 3 | STALE_ADC 中止 | StartPwmFormal 缺 `ADC_SetPwmSyncTriggerMode()`，SOC0 无 SOCA 触发 | soft_start.c 补 ADC 同步（CAL_HOLD 同款） |

## 4. 实板射击缺陷（OVF 风暴，fault=0x40）与修复

首次实板射击失败：`result=4 / fault=64 / cycle_count=0`（第一周期内中止，无功率影响）。

**根因链**：
1. 250kHz（239 ticks）下 3×SOC 顺序转换（30MHz ADC 时钟）在 ~TBCTR 195 完成，
   EOC2 距周期边界仅 ~50 ticks → 与 EPWM1 ISR 竞争 → 偶发 ADCINTOVF
2. `ADCINT1_ISR`/`ADC_CheckOverflow` 清 ADC 标志**无 EALLOW**（F2803x 寄存器写保护）
   → flag 清不掉 → **ISR 风暴**（15 万次/500ms）+ OVF→fault=64
3. CAL_HOLD 包 ≤15 周期（60µs）暴露短未触发；formal 全轨迹 ~350 周期必现

**修复（4 层）**：
1. ISR/CheckOverflow 的 ADC 寄存器写全部 EALLOW 包裹
2. 斜坡全程禁用 `PIEIER1.INTx1`（FastUpdate 自持新鲜性：ETFLG.SOCA + ADCRESULT0，
   每周期 EALLOW 清双 flag）；SS_HardStop 干净恢复（先清 flag+PIEIFR 再使能）
3. ISR 的 OVF→fault 检查增加 `g_softstart_ramp_active` 守卫（双保险）
4. request 处理显式清零 probe/CAL_HOLD ISR 分支标志（.ebss 不被 loadProgram 清零，
   残留会劫持 EPWM1 ISR）——偶发无响应消除

**验证**：严格模式（no_energy_test_mode=0）**7/7 连续 PASS**；正式无能量脚本复核 PASS；
ALL STATIC CHECKS PASSED。

## 5. 实板单发 10V 验收射击（RUN_ID 0x250C5001）—— PASS

```
--- PRE-STATE VERIFY ---
fault=0  pwm=0  ost=1  sysstate=1(Idle)  TZ=4      ← 预状态校验通过
--- TRIGGER FORMAL SOFTSTART (REAL POWER) ---
result      = 2   SS_RESULT_ACCEPT_TARGET   ★ 验收命中
state       = 9   SOFTSTART_FINAL
stage       = 3   FINAL
stage_index = 16  Phase B 完成（16 步）
cycle_count = 428 全轨迹（含 82 个 FINAL 周期真实爬升）
final_cycles= 82  进入 FINAL 后 82 周期命中 10V
last_vout   = 1247  ≥ 1244（≈10.02V）
vout_max    = 1247  无超调（命中即停）
stop_raw    = 1247  停止时 VOUT
TBPRD=399  CMPA=200  CMPB=100  DB36        ← 150kHz 终点精确落位
soca=398  eoc=398  miss=30  consecutive=0  stale=0   ← 无连续采样丢失
fault       = 0   硬顶 1491 未触碰
TZ=4(OST)  pwm=0  ost=1                     ← 命中即计划 OST，PWM 已断
run_id_at_arm = run_id_at_stop = 0x250C5001  ← 全程一致
```

### 5.1 数据解读

- VOUT 从 0 爬升，在 FINAL 阶段（150kHz/399/DB36）第 82 周期达到
  raw 1247 → `0.008089325×1247 − 0.063715 ≈ 10.02V`，命中目标 1244 即计划 OST
- 单次采样命中即停（vout_max == stop_raw），无过冲
- miss=30 为偶发单次丢失（consecutive=0），未触发 stale abort（阈值 3）
- `sched_ost=0` / `truth_runtime_raw=10` 为 MULTICYCLE 遗留变量（formal 路径不写），
  正式停止证据为 `result=2` + OST 锁存 + `g_softstart_final_ost=1`

## 6. 结论

**FORMAL_SOFTSTART_10V_REAL_POWER_PASS / STAGE5_ACCEPTED**

- 正式 SoftStart 引擎（board-verified Profile C 轨迹）实板单发验收通过
- 安全不变量全程保持：fault=0、硬顶 1491 未触碰、ACTIVE TZ→FAULT 锁存无自动重启、
  DAC300 固定、验收模式与生产模式分离、无 PI/闭环改动
- 遗留：`git push` 由用户环境执行（main 已推送至 101a381→6835b47）

## 7. 下一步候选

- STAGE5A_OPEN_LOOP_PFM_DIRECTION：频率↑→VOUT 方向性测试（无 PI）
