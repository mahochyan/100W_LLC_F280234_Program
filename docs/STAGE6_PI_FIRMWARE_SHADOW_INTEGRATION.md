# STAGE6 PI Firmware Shadow Integration (V1)

> STAGE6_PI_FIRMWARE_SHADOW_INTEGRATION_V1 — main document.
> Baseline: `51a4b94` (code) — working tree clean; SIL verdict
> `STAGE6_PI_SIL_TUNING_V2_1_PASS` (recommended `CANDIDATE_B_BALANCED`).

## 1. What was integrated

The single validated **BALANCED** PI candidate into the firmware **shadow**
control path:

| Parameter | Value | Unit |
|---|---|---|
| `CTRL_PI_KP_HZ_PER_V` | 6657.43331 | Hz/V |
| `CTRL_PI_KI_STEP_HZ_PER_V_STEP` | 44.3828888 | Hz/(V·20µs) |
| `CTRL_PI_KI_STEP` cont. equivalent | 2219144.438 | Hz/(V·s) |
| `CTRL_PI_PROFILE_ID` | 0x060201 | — |
| `CTRL_PI_PROFILE_VIRTUAL_ONLY` | 1 | — |
| `CTRL_PI_PROFILE_HARDWARE_VALIDATED` | 0 | — |

Source: `STAGE6_PI_SIL_TUNING_V2_1` (commit `51a4b94`). These parameters are
`VIRTUAL_ONLY_PI_CANDIDATE` — **not** `HARDWARE_TUNED_PI`.

## 2. Central message

> PI parameters being compiled into the firmware binary **does not mean the PI
> has gained any hardware control authority.**

The current architecture keeps real PWM write fully isolated:

```
ADC / synthetic Vout
        |
        v
BALANCED PI (shadow)        <- computes error / P / I / freq command / shadow freq
        |
        v
shadow frequency
        X
real ePWM

X  is isolated by the hard gate:  LLC_HARDWARE_PI_VALIDATED = 0
```

`CTRL_ComputeFrequencyCommand()` only computes; it **never** writes ePWM
registers. `CTRL_ApplyFrequencyCommand()` commits shadow → `g_control_frequency_hz`
and calls `LLC_SetFrequencyHz()` **only** under `#if LLC_HARDWARE_PI_VALIDATED`
(which is 0). In this Stage the preprocessor removes the call entirely.

## 3. Changes (all shadow, no real PWM)

| File | Change |
|---|---|
| `app/control_profile.h` | (new) single BALANCED profile + `VIRTUAL_ONLY` gate + internal consistency `#if`s |
| `app/control.c` | drop `CTRL_KP=0.0005f` / `CTRL_KI=0.0001f` placeholders; use `CTRL_PI_KP_HZ_PER_V` / `CTRL_PI_KI_STEP_HZ_PER_V_STEP`; cross-gate compile-time `#error`; teaching variables in `CTRL_Init()`. Algorithm otherwise unchanged (SIGN=-1, bias=150000, Imax=±60000, clamp 120–180k, slew 100Hz/20µs, conditional integration, ADC-stale freeze). |
| `app/llc_globals.h/.c` | teaching globals `g_control_pi_profile_id/kp/ki_step/virtual_only` |

## 4. Gates — all PASS (offline)

| Gate | Result |
|---|---|
| `C28X_FLOAT32_PI_PARITY_PASS` | True (float32 + integer commit replay of mandatory ensemble) |
| `UINT32_FREQUENCY_COMMIT_PARITY_PASS` | True (freq_pp 278/348 Hz, TBPRD span 1, no ping-pong) |
| `PI_PROFILE_SOURCE_SYNC_PASS` | True |
| `BALANCED_PROFILE_FIRST_STEP_SANITY_PASS` | True (149900 / 150100 first-step) |
| `STAGE6_BALANCED_PROFILE_OFFLINE_SELFTEST_PASS` | True (cases 1–7; case 8 structural) |
| `PI_PROFILE_PRESENT_PWM_WRITE_GATE_LOCKED_PASS` | True (`_CTRL_ApplyFrequencyCommand` = 7-word shadow commit, no `LLC_SetFrequencyHz`) |
| `STAGE6_FLASH_BUILD_PASS` | True (CGT 25.11.1.LTS, `--abi=coffabi`, 0 unresolved, 0 overflow) |

### FLASH / RAM margins (Stage6_FLASH)

| Region | capacity (words) | used | free | % used |
|---|---|---|---|---|
| FLASH | 0xFF80 (65408) | 0x26FC (9980) | 0xD884 (55428) | 15.3% |
| Data RAM (RAML1+L2+L3) | 0x1800 (6144) | 0x33C (828) | 0x14C4 (5316) | 13.5% |

OUT SHA256 `16DF761E3F139A76693B66F0B2C68BACEFAA199C5BC345FE8D804E0DD58272C6`
MAP SHA256 `E5FB0E6FBEF26414C669C0527C21260F91D27343C9D8B2C077025E1474BC54F0`

### Disassembly evidence

- `_CTRL_ComputeFrequencyCommand` contains the BALANCED float32 constants:
  `MOV AH,#0x45d0 / MOV AL,#0x0b77` → `0x45d00b77` = 6657.43331 (Kp), and
  `MOV AH,#0x4231 / MOV AL,#0x8814` → `0x42318814` = 44.3828888 (Ki_step).
- `_CTRL_ApplyFrequencyCommand` is exactly 7 words: `MOVW DP / MOVL ACC / MOVW DP /
  MOVL store / LRETR` — a bare shadow commit with **no** call/branch into
  `LLC_SetFrequencyHz` and no PWM register write. The `#else` write-gated branch
  was fully preprocessed away.

## 5. Anti-misoperation

- `control_profile.h` enforces `CTRL_PI_PROFILE_VIRTUAL_ONLY == 1` and
  `CTRL_PI_PROFILE_HARDWARE_VALIDATED == 0` at compile time.
- `control.c` enforces the cross-gate:
  `#if CTRL_PI_PROFILE_HARDWARE_VALIDATED && !LLC_HARDWARE_PI_VALIDATED #error`.
- A validated candidate NEVER auto-unlocks hardware; the candidate and the
  hardware gate are fully independent.

## 6. Q note — CANDIDATE_A == CANDIDATE_B

In the V2_1 re-search, `CANDIDATE_A_ULTRA_CONSERVATIVE` and
`CANDIDATE_B_BALANCED` have numerically identical coefficients
(`Kp=6657.43331`, `Ki_step=44.3828888`). Only the **BALANCED** profile is
integrated into firmware; we do **not** emit two identical runtime profiles.

## 7. Forbidden this stage

No `loadProgram`, no flash programming, no clear-OST, no PWM enable, no real
ADC loop, no real PI actuation, no power shot, no continuous 12 V run, no load
test. `NO_REAL_POWER_EXECUTED`; `LLC_CONTROL_DIRECTION=0`;
`LLC_HARDWARE_PI_VALIDATED=0`.

## 8. Next stage (separately authorized)

`ON_TARGET_SHADOW_NOENERGY_TEST` — load to RAM/no-energy, run the 8-case
offline self-test on-target (expect `g_offline_test_status == 0xFF`), and run
the 20 µs budget measurement per `STAGE6_PI_EXECUTION_BUDGET_PLAN.md`.

---
`READY_FOR_ON_TARGET_SHADOW_NOENERGY_TEST` pending.
