# STAGE6 PI FIRMWARE NUMERIC PARITY (B/C/D) - offline, write-gate locked
LLC_HARDWARE_PI_VALIDATED=0 ; NO_REAL_POWER_EXECUTED
BALANCED Kp=6657.4333100 Ki_step=44.3828888 (float32+Uint32-commit replay)

  float32 replay 24.0V/75W : PASS
  float32 replay 30.0V/100W : PASS
C28X_FLOAT32_PI_PARITY_PASS = True
  int-commit 24.0V/75W: freq_pp=278 Hz TBPRDspan=1 pingpong=False -> PASS
  int-commit 30.0V/100W: freq_pp=348 Hz TBPRDspan=1 pingpong=False -> PASS
UINT32_FREQUENCY_COMMIT_PARITY_PASS = True

## D. double SIL vs firmware-parity SIL (mandatory interior ref steps)
  max |Vout diff| = 0.000323 V
  max |freq cmd diff| = 2.76 Hz
  max |integrator diff| = 0.834236 Hz
  no new multi-kHz limit cycle under f32+int commit: True
  PASS/FAIL conclusion unchanged: True
  (bit-identical NOT required)
