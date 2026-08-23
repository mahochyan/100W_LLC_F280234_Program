# STAGE6 PI Soft-Float Cost Audit

Task: `STAGE6_PI_FIXED_POINT_REALTIME_MIGRATION_V1` · Baseline `2545e74`
Gate: `SOFTFLOAT_FAST_PATH_CONFIRMED` = **true** → proceed with Q12 fixed-point migration.

## 1. Method
Disassembled `Stage6_FLASH_NOENERGY/control.obj` (CGT 25.11.1.LTS, `--abi=coffabi -O4 -ms`) with `dis2000` and dumped the symbol table with `ofd2000`.

## 2. RTS software-float helpers referenced by the control module
| Symbol | Kind | Purpose |
|---|---|---|
| `FS$$ADD` | soft-float RTS | float32 add |
| `FS$$SUB` | soft-float RTS | float32 subtract |
| `FS$$MPY` | soft-float RTS | float32 multiply |
| `FS$$CMP` | soft-float RTS | float32 compare |
| `FS$$NEG` | soft-float RTS | float32 negate |
| `FS$$TOUL` | soft-float RTS | float32 -> unsigned long |
| `UL$$TOFS` | soft-float RTS | unsigned long -> float32 |

All are marked `undefined` in `control.obj` (linked from the RTS library), i.e. the fast control path calls into software float at runtime.

## 3. Location / call-path
`CTRL_ComputeFrequencyCommand` is the sole fast-ISR float consumer (it is called by `CTRL_FastTask` and by the Stage6 no-energy shadow hook). Its active branch performs the ~16 float ops of the balanced PI (error, P, I, unsat, clamp, slew) via the RTS helpers above (disassembly FFC call sites at offsets 0x01 and 0x17a of the 0x17d-word function, plus inlined float arithmetic). `CTRL_ApplyFrequencyCommand` commits the Hz command.

## 4. Empirical cost attribution (on-target, whole-ISR measurement)
| Path | PI step cycles | Evidence |
|---|---|---|
| frozen / stale path (integer-only, early return) | **397** | per-mode `stale` ctrl step |
| active float path (12V steady) | **1566** | per-mode `12V` ctrl step |
| active float path (worst, saturation) | **2426** | ctrl step max |

The active-vs-frozen delta (~1170-2030 cycles) is almost entirely the software-float arithmetic in `CTRL_ComputeFloatLinear`. This is the dominant cost that pushes the whole ISR over the 1200-cycle (20 us) budget.

## 5. Conclusion
- The 20 us overrun is dominated by **software-float RTS arithmetic** in the fast PI path (confirmed by both static helper references and empirical integer-vs-float cycle deltas).
- `SOFTFLOAT_FAST_PATH_CONFIRMED = true` → the migration to 32-bit fixed-point Q12 in the fast ISR is the correct remediation. No STOP.
