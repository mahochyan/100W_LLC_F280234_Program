# STAGE6_ON_TARGET_SHADOW_NOENERGY — Report

> Status: **PC-side complete / ON-TARGET BLOCKED (hardware boot-to-flash)**
> Baseline: `c1abaf3`  ·  Profile: ID `0x060201`, Kp `6657.43331 Hz/V`, Ki_step `44.3828888 Hz/(V·20µs)`
> Gates locked: `LLC_HARDWARE_PI_VALIDATED=0`, `LLC_CONTROL_DIRECTION=0`,
> `CTRL_PI_PROFILE_VIRTUAL_ONLY=1`, `CTRL_PI_PROFILE_HARDWARE_VALIDATED=0`.

## 1. Objective
Run the integrated BALANCED PI **shadow** controller on a real TMS320F28034 and
measure: real C28x float behavior, the 8-case offline self-test, PWM-register
isolation, the 20 µs fast-ISR execution budget, and long-run shadow stability —
**with no real PWM control and no main-power test**.

## 2. What was built (PC side, all PASS)
- **D/M/L** — `STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST` macro (test build only);
  cycle globals `g_control_exec_cycles_last/max`, `g_fast_isr_cycles_last/max`,
  `g_fast_isr_overrun_count`, `g_stage6_noenergy_test_ticks` (+ step-req/feedback
  vars), all `#if`-gated; timer audit chose **CPU Timer2** (free-running 60 MHz
  32-bit down counter, TIE=0, read-only — consistent with existing code, no
  preemption).
- **O** — `TINT0_ISR` test hook (test-gated): whole-ISR + region-B cycle
  measurement, conservative (normal fast-task base + one real PI step + hook).
- **B/F** — `Stage6_FLASH_NOENERGY` clean build (CGT 25.11.1.LTS `--abi=coffabi`,
  `.text` in FLASH). Build OK, 0 unresolved, 0 overflow.
  OUT SHA256 `DDC6E8C75A7D70F5876FB015DB67977B9DE5F4CB99A075FE4B5E1FC434BE17A3`
  MAP SHA256 `BEB9DF9F59510CAA470E8E3BA3DDA2FB78A24E64D04789B7E90D253338EF7A4E`
  FLASH used 10132/65408 words (15.6%).
- **E** — static hard gates PASS: gates above all hold; disassembly shows
  `_CTRL_ApplyFrequencyCommand` is still a 7-word shadow commit with **no**
  `LLC_SetFrequencyHz` reference (map `SetFrequency` refs all in `pwm.obj`
  definition). → `ON_TARGET_PRELOAD_PWM_WRITE_GATE_PASS`.
- **F/T** — frozen binary + map committed under `evidence/stage6_on_target_shadow_noenergy/`.
- On-target harness `tools/stage6_on_target_shadow_noenergy.js` prepared
  (loads only the frozen binary; set-request → runAsynch → wait → halt-once →
  dump-once; no high-frequency poll).

## 3. On-target execution: BLOCKED
Real debugger connects and halts; `loadProgram` of the frozen FLASH image
reports OK and sets PC to `main` (`0x003EA3EA`). FLASH content verified valid
(`c_int00` `0x28AD`, `main` `0xB2BD`, `CTRL_Compute` `0xD004`).

However `runAsynch` **resets the CPU to the boot ROM** (PC ends at `0x3FF8CD`),
`main` is never executed, and all instrumented globals remain uninitialized
(`g_fast_tick`, `g_control_pi_profile_id`, etc.). A `main` breakpoint is never
hit. A prior `loadProgram`-to-FLASH attempt also reported **"Power Failure on
Target CPU"** / **"target is not connected"**, and a read of `0xC00` hit a
CSM/security-gated error.

**Conclusion:** this board only runs **RAM-resident** images in its current boot
configuration; it does **not execute the FLASH-resident image** (boot-ROM stall,
likely boot-mode/CSM). The required FLASH-resident (flash wait-state-inclusive)
measurement therefore could not be performed on-target.

## 4. Gate summary
| Gate | Status |
|---|---|
| `ON_TARGET_PRELOAD_PWM_WRITE_GATE_PASS` | **PASS** (static) |
| `ON_TARGET_BALANCED_8CASE_PASS` | BLOCKED (on-target) |
| `ON_TARGET_PWM_REGISTER_ISOLATION_PASS` | BLOCKED (on-target) |
| `ON_TARGET_BALANCED_FIRST_STEP_PASS` | BLOCKED (on-target) |
| `ON_TARGET_ADC_STALE_RECOVERY_PASS` | BLOCKED (on-target) |
| `20US_FAST_ISR_BUDGET_PASS` | BLOCKED (on-target) |
| `ON_TARGET_FINAL_SAFE_STATE_PASS` | BLOCKED (on-target) |
| `ON_TARGET_BINARY_IDENTITY_PASS` | BLOCKED (on-target, no run) |
| `STAGE6_ON_TARGET_SHADOW_NOENERGY_PASS` | **NOT MET** |
| `F28034_BALANCED_PI_EXECUTION_VALIDATED` | **NOT MET** |
| `READY_FOR_STAGE6_REAL_POWER_PI_ENTRY_REVIEW` | **NOT MET** |

`NO_REAL_POWER_EXECUTED` · `LLC_CONTROL_DIRECTION=0` · `LLC_HARDWARE_PI_VALIDATED=0`.
No on-target result was fabricated.
