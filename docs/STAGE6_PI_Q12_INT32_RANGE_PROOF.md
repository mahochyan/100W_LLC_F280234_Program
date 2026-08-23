# STAGE6 PI Fixed-Point INT32 Range Proof

Task: `STAGE6_PI_FIXED_POINT_REALTIME_MIGRATION_V1` · Gate: `FIXED_POINT_INT32_RANGE_PROOF_PASS`

## 0. Format
- `Q_SHIFT = 12`, `Q_ONE = 4096`, signed 32-bit fixed point.
- The fast controller (`CTRL_ComputeFrequencyCommand`) contains **no** `int64`, `double`, or `float`.
- All arithmetic stays within `INT32` = [-2147483648, 2147483647].

## 1. Raw signal bounds
- ADC VOUT raw is 12-bit: `vout_raw ∈ [0, 4095]`.
- Reference raw is converted in the slow task and clamped: `ref_raw ∈ [0, 4095]` (12 V ≈ 1491).
- `error_raw = ref_raw - vout_raw ∈ [-4095, +4095]`.

## 2. Coefficient magnitudes
| constant | value | |
|---|---|---|
| `KP_RAW_Q12` | 220587 | from Kp*GAIN*4096 |
| `KI_RAW_Q12` | 1471 | from Ki_step*GAIN*4096 |
| integral clamp | ±60000*4096 = ±245760000 | |
| bias | 150000*4096 = 614400000 | |
| clamp window | [120000*4096, 180000*4096] = [491520000, 737280000] | |
| slew limit | 100*4096 = 409600 | |

## 3. Per-term bounds (all in INT32)
- **P_Q12** = KP_RAW_Q12 * error_raw = 220587 × [-4095,4095]
  = **[-903303765, +903303765]**  (≈30 bits; fits signed 32-bit).
- **I_Q12**: accumulated `integral_q12 += KI_RAW_Q12*error_raw` (=1471×[-4095,4095]=±6023745 per step), clamped to **±245760000**.
- **bias_Q12** = 614400000.
- **unsat_Q12** = bias + SIGN×(P+I), SIGN=-1:
  - max = 614400000 + (903303765+245760000) = **1763463765**
  - min = 614400000 - (903303765+245760000) = **-534663765**
  - both strictly inside [-2147483648, 2147483647].
- After clamp to [491520000, 737280000] and slew (±409600), the command stays in the INT32 window; `new_hz = out_q12 >> 12` (arithmetic shift) lands in [120000, 180000].

## 4. Intermediate multiply safety
- `KP_RAW_Q12 * error_raw`: operand 220587 (22 bits) × 4095 (12 bits) → 34-bit product 903303765, which is < 2^31. The C28x 32×32→32 signed multiply yields the exact value (no truncation overflow).
- `KI_RAW_Q12 * error_raw` = 1471 × 4095 = 6023725, well within 32-bit.

## 5. Conclusion
Every quantity (error_raw, P_Q12, I_Q12, bias_Q12, unsat_Q12, clamped, slewed, out_q12) lies strictly inside the signed 32-bit range at every step. No `int64`/`double`/`float` is required anywhere in the fast controller.

`FIXED_POINT_INT32_RANGE_PROOF_PASS = true`
