# STAGE6 PI UNITS AND DISCRETE FORM

Stage: STAGE6_PI_SIL_TUNING_V1
Task step B. Fixes the units of every PI coefficient and states the discrete
control form. No unit-less Kp/Ki is accepted.

## 1. Control law (discrete, per 20 us step)

```
error      = Vref - Vout                         [V]
P_term     = Kp * error                          [Hz]
integral[k+1] = integral[k] + Ki_step * error    [Hz]
frequency  = bias + SIGN * (P_term + integral)   [Hz]
SIGN       = -1
```

## 2. Units

| Symbol | Unit | Meaning |
|---|---|---|
| error | V | Vref - Vout |
| Kp | Hz / V | proportional gain |
| Ki_step | Hz / (V * control_step) | integrator gain per discrete step |
| control_step | 20 us (20e-6 s) | fast task period |
| Ki_continuous | Hz / (V * s) | = Ki_step / 20us |

## 3. Equivalent continuous integral gain

```
Ki_continuous = Ki_step / 20e-6 s
```

Example mapping used in the candidate tables:
Ki_step = 0.01 Hz/(V*step)  -> Ki_continuous = 500 Hz/(V*s)
Ki_step = 1.0  Hz/(V*step)  -> Ki_continuous = 50000 Hz/(V*s)

## 4. Placeholder status

The current firmware coefficients (control.c):
```
CTRL_KP = 0.0005f     Hz/V
CTRL_KI = 0.0001f     Hz/(V*20us step)
```
are LOGIC_PLACEHOLDER_ONLY. They were used only to prove control LOGIC
(sign/clamp/anti-windup/stale) in SIL; they are far too small to regulate.
STAGE6_PI_SIL_TUNING does NOT treat them as a tuning starting point. The
hardware write-gate LLC_HARDWARE_PI_VALIDATED remains 0, so these coefficients
do not act on any real PWM.

## 5. Slew / clamp (unchanged, unit-aware)

- frequency clamp: 120 kHz .. 180 kHz (OFFLINE_CONTROL_MIN_HZ/MAX_HZ)
- slew limit: 100 Hz per 20 us control task (= 5 MHz/s)
- integral hard backstop: +/- 60000 Hz
- conditional integration: freeze if (sat_high && error<0) || (sat_low && error>0)
- ADC stale: >= 3 invalid samples -> command + integrator frozen