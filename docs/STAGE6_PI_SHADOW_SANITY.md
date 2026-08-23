# STAGE6 PI SHADOW SANITY (J/K/L) - offline, write-gate locked
LLC_HARDWARE_PI_VALIDATED=0 ; NO_REAL_POWER_EXECUTED
Profile: CTRL_PI_KP_HZ_PER_V=6657.43331 CTRL_PI_KI_STEP_HZ_PER_V_STEP=44.382889

  J case 1: PASS
  J case 2: PASS
  J case 3: PASS
  J case 4: PASS
  J case 5: PASS
  J case 6: PASS
  J case 7: PASS
  J (case 8 PWM-register isolation proven structurally by write gate + FLASH disasm)
STAGE6_BALANCED_PROFILE_OFFLINE_SELFTEST_PASS = True

## K first-step sanity (BALANCED profile)
  Vout=11V: error~+1V P~+6657Hz Iterm~+44.4Hz unsat<150k first step 150000->149900 : True
  Vout=13V: first step 150000->150100 : True
  BALANCED_PROFILE_FIRST_STEP_SANITY_PASS = True

  L 3-sample stale freeze=True recovery<=100Hz=True (first recovery step=100 Hz)
  ADC_STALE_BALANCED_FREEZE_RECOVERY_PASS = True
