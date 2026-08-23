# STAGE6 CONTROL ARCHITECTURE AUDIT

Stage: STAGE6_CONTROL_INTEGRATION_OFFLINE_V1 (offline / no-energy / SIL)
Task step B. Scope: control architecture, controller/actuator split, offline window,
anti-windup, clamp, slew, ADC-stale inhibit, teaching variables, and the 8-case
no-energy self-test.

## 1. Hardware-confirmed control direction (Stage5A strict same-binary A/B)

On-board A/B measurement established the PFM control direction (accepted in
f609959; STAGE5A_PFM_DIRECTION_ACCEPTED=1):

```
LLC_CONTROL_SIGN = -1   (HARDWARE_CONFIRMED_CONTROL_SIGN)
error = Vref - Vout
  error > 0  (Vout < Vref)  -> frequency command DECREASES
  error < 0  (Vout > Vref)  -> frequency command INCREASES
```

This matches a normal LLC on the FHA response: moving frequency toward the
series-resonance band raises the open-loop gain and pulls Vout up; moving away
lowers gain and Vout. The sign is encoded once as LLC_CONTROL_SIGN and used by
the single saturated-frequency command expression, so it cannot drift.

Direction-only: PFM_DIRECTION_GAIN_CHARACTERIZED=0; the PI coefficients remain
PLACEHOLDER_NOT_HARDWARE_TUNED.

## 2. Controller / actuator split (no real PWM in offline stage)

```
CTRL_ComputeFrequencyCommand(sample_valid, vout_v)  -> Uint32
    pure computation: error, P, I, conditional anti-windup, unsaturated command,
    clamp to [OFFLINE_CONTROL_MIN_HZ, OFFLINE_CONTROL_MAX_HZ], slew limit,
    ADC-stale freeze. Writes shadow + teaching variables. NEVER writes ePWM.

CTRL_ApplyFrequencyCommand(void)
    commits shadow -> g_control_frequency_hz and calls LLC_SetFrequencyHz()
    ONLY under `#if LLC_HARDWARE_PI_VALIDATED` (currently 0U => shadow-only).
```

LLC_HARDWARE_PI_VALIDATED = 0U is the write-gate hard lock; with it 0 the
actuator is compiled shadow-only and cannot reach the PWM, ePWM, or TBPRD/CMPA/
CMPB/DB registers. See STAGE6_HARDWARE_WRITE_GATE_AUDIT.md (task P).

## 3. Config (llc_config.h)

| Macro | Value | Meaning |
|---|---|---|
| LLC_CONTROL_SIGN | -1 | HARDWARE_CONFIRMED_CONTROL_SIGN (A/B) |
| LLC_CONTROL_DIRECTION | 0 | REAL-POWER GATE (locked; keeps FAULT_CONTROL_DIRECTION). Offline controller uses LLC_CONTROL_SIGN. |
| OFFLINE_CONTROL_MIN_HZ | 120000UL | NOT_PRODUCTION_LIMIT |
| OFFLINE_CONTROL_MAX_HZ | 180000UL | NOT_PRODUCTION_LIMIT |
| CTRL_ADC_STALE_LIMIT | 3U | consecutive stale samples -> inhibit |
| LLC_HARDWARE_PI_VALIDATED | 0U | write-gate LOCKED |
| CTRL_KP / CTRL_KI | 0.0005 / 0.0001 | PLACEHOLDER_NOT_HARDWARE_TUNED |
| CTRL_MAX_STEP_HZ | 100.0 | Hz per 20us fast task (slew) |
| CTRL_INTEGRAL_MAX | 60000.0 | integral hard backstop |

## 4. Controller core (CTRL_ComputeFrequencyCommand)

```
stale = (sample_valid == 0) || (adc_miss >= CTRL_ADC_STALE_LIMIT)
if (stale): integrator + command frozen; return last command   (ADC_STALE_INHIBIT)
error = Vref - Vout
P = KP * error
sat_high = f >= FMAX ;  sat_low = f <= FMIN
freeze = (sat_high && error<0) || (sat_low && error>0)     (conditional AW)
if !freeze: I += KI*error, clamp I to +/- INTEGRAL_MAX
unsat = bias + SIGN * (P + I)
clamped = clamp(unsat, FMIN, FMAX)
step = clamp(clamped - f_last, -MAX_STEP, +MAX_STEP)
f_new = clamp(f_last + step, FMIN, FMAX)          (slew)
shadow = f_new
```

## 5. Teaching / observability variables

g_control_* (vref, vout, error, p_term, i_term, unsat, clamped, shadow,
saturated_high/low, integrator_frozen, sample_valid, stale_inhibit) plus
g_pi_integral. All volatile, visible in CCS/no-energy and to the SIL host.

## 6. Offline self-test (Step L)

CTRL_OfflineSelfTest() runs synchronously on the controller core (no real
PWM), 8 cases, bitmask g_offline_test_status:

| Bit | Case | Assertion |
|-----|------|-----------|
| 0x01 | PFM_SIGN_LOW_VOUT | Vout<Vref -> freq down |
| 0x02 | PFM_SIGN_HIGH_VOUT | Vout>Vref -> freq up |
| 0x04 | EQUAL_HOLDS | Vout==Vref -> command holds |
| 0x08 | LOWER_CLAMP | command holds at FMIN, integrator frozen |
| 0x10 | UPPER_CLAMP | command holds at FMAX, integrator frozen |
| 0x20 | ADC_STALE_FREEZE | stale -> command+integrator frozen |
| 0x40 | ADC_RECOVERY_NO_JUMP | recovery -> single slew-limited step |
| 0x80 | PWM_REGISTER_ISOLATION | 10000 steps, TBPRD/CMPA/CMPB/DB unchanged |

## 7. SIL (Step M)

tools/stage6_control_sil.py mirrors the firmware controller and validates the
8 cases plus a closed-loop virtual-plant matrix (Vref=12, Vout0 in {10,11,13},
Vin in {24,30,36}), reporting PLANT_TARGET_UNREACHABLE when the clamp window
cannot reach the target. Verdict: ALL_CONTROL_CASES_PASS.

## 8. Stage/route

Non-FAULT SYS_STATE_RUN, pwm disabled, bringup >= STAGE6 -> fast task runs the
controller with sample validity; output is shadow-only in offline. SlowTask
polls g_offline_test_request -> CTRL_OfflineSelfTest().

## ACCEPTANCE TOKENS

- STAGE6_CONTROL_ARCHITECTURE_AUDIT: PASS (this doc)
- PFM_SIGN_LOW_VOUT / HIGH / EQUAL / LOWER_CLAMP / UPPER_CLAMP / STALE /
  RECOVERY / PWM_REGISTER_ISOLATION: validated in SIL + self-test (see result)
- LLC_HARDWARE_PI_VALIDATED = 0, NO_REAL_POWER_EXECUTED