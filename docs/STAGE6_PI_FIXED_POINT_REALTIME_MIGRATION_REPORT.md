# STAGE6 PI FIXED-POINT REALTIME MIGRATION V1 — REPORT

## Objective
Migrate the BALANCED PI from the C28x software-float fast ISR to a **32-bit
signed Q12 fixed-point** fast ISR, eliminating the 20 µs whole-ISR overrun.
Control physics / 20 µs period / Kp, Ki / PFM direction / slew / anti-windup /
ADC-stale are **unchanged**. `LLC_CONTROL_SIGN` stays **-1**. **NO REAL POWER.**

## Gate-by-gate evidence

| Gate | Verdict | Evidence |
|------|---------|----------|
| A  baseline `2545e74` | **PASS** | head `8fad767` (docs-only on top of 2545e74; code identical) |
| B  soft-float RTS audit | **PASS** | `SOFTFLOAT_FAST_PATH_CONFIRMED` (`docs/STAGE6_PI_SOFTFLOAT_COST_AUDIT.md`): FS$$ADD/SUB/MPY/CMP/NEG/TOUL + UL$$TOFS in control.obj |
| C  Q_SHIFT=12 ONE=4096 signed i32 | **PASS** | `CTRL_Q_SHIFT 12`, `CTRL_Q_ONE 4096` in control.c |
| D  KP_RAW_Q12=220587 KI_RAW_Q12=1471 | **PASS** | derived macros in `control_profile.h` |
| E  profile-source sync | **PASS** | `tools/check_control_fixed_profile_sync.py` → `FIXED_POINT_PROFILE_SOURCE_SYNC_PASS` |
| F  int32 range proof | **PASS** | `docs/STAGE6_PI_Q12_INT32_RANGE_PROOF.md` → `FIXED_POINT_INT32_RANGE_PROOF_PASS`; max P=903,303,765, max unsat=1,763,463,765 < INT32_MAX |
| G  vref raw conversion | **PASS** | `CTRL_VoltsToRaw()`: `raw=round((Vref-OFFSET)/GAIN)` clamp 0..4095; 12 V→1491 |
| H  control sample source | **PASS** | controller consumes raw ADC sample `g_control_vout_raw = g_adc_vout_filtered_raw` |
| I  fixed-point state | **PASS** | `g_pi_integral_q12/g_control_vref_raw/g_control_vout_raw/g_control_error_raw/g_control_p_term_q12/g_control_i_term_q12/g_control_unsat_q12`; Hz stays Uint32 |
| J  fast PI formula | **PASS** | Q12 core `CTRL_ComputeFrequencyCommand()` — no float/double/int64 |
| K  telemetry | **PASS** | `CTRL_UpdateTelemetrySlow()` 5 ms; teaching floats not written in ISR |
| L  anti-windup | **PASS** | integer conditional-integration freeze (sat_hi && err<0 / sat_lo && err>0) |
| M  stale | **PASS** | freeze integral+shadow; recovery first step ≤ 100 Hz |
| N  SIL parity | **PASS** | `tools/stage6_pi_fixedpoint_parity.py` → `FIXED_POINT_PI_SIL_PARITY_PASS` (108 cases, max dev 5.78 Hz = 0.0046%) |
| O  first-step parity | **PASS** | `FIXED_POINT_FIRST_STEP_PASS`: 11 V→149900, 13 V→150100 |
| P  8-case on fixed core | **PASS** | OFFLINE_TEST_STATUS=0xFF, PWM isolation PASS |
| Q  no float RTS in fixed core | **PASS** | `tools/stage6_pi_softfloat_free_check.py` → `FAST_PI_SOFTFLOAT_FREE_PASS` (FFC=0, softfloat=0); float core only in `CTRL_ComputeFrequencyCommandFloat` |
| R  FLASH clean build both cfg | **PASS** | Stage6_FLASH & _NOENERGY: 0 unresolved, 0 overflow; codestart + 2 ramfunc copies + `.TI.ramfunc`(usDelay@0x801D) preserved |
| S  on-target no-energy re-run | **PASS** | PRE_SAFE, 8-case all PASS, first-step 149900/150100, stale frozen+recover PASS, PWM isolation, binary identity, final safe |
| T  whole-ISR budget | **PASS** | 6 modes each ≥12k ticks, whole-ISR **max 506 cyc = 8.43 µs (42%)**, overrun **0** |
| U  hard gate | **PASS** | whole-ISR max 506 ≤ 900 → not MARGIN_LOW, not FAIL; overrun=0 |

## On-target budget (Q12 vs previous float)
| metric | float | **Q12** |
|--------|-------|---------|
| active PI step | 1566–2426 cyc | **96–165 cyc** |
| frozen/stale | 397 cyc | **96 cyc** |
| whole-ISR typical | ~1900–2100 cyc | **495–506 cyc** |
| whole-ISR max | >2000 cyc | **506 cyc (8.43 µs)** |
| overrun (≥1200) | 1 | **0** |
| % of 20 µs | >100% | **42.2%** |

## Binary identity
Frozen `Stage6_FLASH_NOENERGY` OUT SHA256 = `20777C423FDDAFF6197F8D3DA5817B02B58B8176B01A6BC43ED73EDFE4A9F434`
(Fixed-point core: 183 words, down from 381; **0 external calls / 0 soft-float refs**.)

## Verdict
```
STAGE6_ON_TARGET_SHADOW_NOENERGY_PASS          = TRUE
F28034_BALANCED_PI_EXECUTION_VALIDATED         = TRUE
READY_FOR_STAGE6_REAL_POWER_PI_ENTRY_REVIEW    = TRUE
LLC_HARDWARE_PI_VALIDATED                      = 0   (unchanged)
LLC_CONTROL_DIRECTION                          = 0   (unchanged)
overrun                                         = 0
```
No CLA used. Real PWM / power / soft-start / OST are all disabled — **NO REAL POWER EXECUTED**.

## Commit (gate Y)
`perf: migrate Stage6 PI fast path from software float to Q12 fixed point`
