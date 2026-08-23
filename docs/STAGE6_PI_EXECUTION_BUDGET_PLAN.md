# STAGE6 PI Execution Budget Plan (static preparation only)

> STAGE6_PI_FIRMWARE_SHADOW_INTEGRATION_V1 — task N.
> This document prepares the 20µs fast-task execution-budget measurement for a
> later **no-energy on-target** stage. It does NOT fabricate µs figures and does
> NOT run on the board.

## 1. Real call chain (audited from source)

```
TINT0_ISR()                        app/protection.c:185   (CPU Timer0, 20 µs fast task)
  ├─ CALHOLD_FastTask()
  ├─ PROT_FastTask()               app/protection.c:214
  ├─ CTRL_FastTask()               app/protection.c:201
  │    ├─ gates:
  │    │     g_system_state == SYS_STATE_RUN
  │    │     g_pwm_enabled == 1
  │    │     g_bringup_stage >= BRINGUP_STAGE_6_CLOSED_LOOP
  │    │     g_vout_volts >= 0
  │    ├─ CTRL_ComputeFrequencyCommand(valid, vout)   app/control.c  (shadow PI)
  │    └─ CTRL_ApplyFrequencyCommand()                 app/control.c  (shadow-only commit)
  └─ SoftStart_ApplyLimits()
```

The 20 µs budget must cover the ENTIRE `TINT0_ISR` body (every 50 kHz period),
so the PI shadow block is only one contributor, not the whole budget.

## 2. Start / end points to measure

| Region | Start | End |
|---|---|---|
| A. Whole ISR | T0_ISR entry (first instr) | before `PieCtrlRegs.PIEACK` / `TCR.TIF` clear |
| B. Control shadow block | first instr of `CTRL_ComputeFrequencyCommand` | last instr of `CTRL_ApplyFrequencyCommand` |

Both are deterministic targets for a cycle-accurate CPU-Timer measurement in the
next no-energy stage.

## 3. Measurement design (no-energy, formal path unchanged)

- `g_control_exec_cycles_last` : 32-bit, cycles spent in region B for the most
  recent 20 µs tick.
- `g_control_exec_cycles_max`  : running maximum over region B.
- Method (candidate): snapshot `CpuTimer0Regs.TIM` (or a dedicated free-running
  timer) immediately before `CTRL_ComputeFrequencyCommand()` and after
  `CTRL_ApplyFrequencyCommand()`; `last = before - after` (TIM counts down at
  60 MHz); `max = MAX(max, last)`.
- Instrumentation is added without changing the formal execution path (a read
  pair + a max update; no branch that alters control flow).
- Run under `STAGE6_OFFLINE_SELFTEST` / no-energy so PWM never switches.

## 4. Why not fabricate µs here

CPU-cycle cost depends on the exact instruction stream, pipeline, FPU usage and
the current region; an "estimate" not backed by a measurement would be a
guess. Region B's cost will be established from the actual on-target
no-energy measurement in `ON_TARGET_SHADOW_NOENERGY_TEST`, using the variables
above plus the flash-run vs RAM-run difference if needed.

## 5. Gate held

`LLC_HARDWARE_PI_VALIDATED = 0` ; `NO_REAL_POWER_EXECUTED` ; no on-target run
in this stage.
