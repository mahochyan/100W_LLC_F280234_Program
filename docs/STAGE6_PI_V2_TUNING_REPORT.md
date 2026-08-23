# STAGE6 PI SIL TUNING V2_1 HARNESS CLOSURE (offline, write-gate locked)
Base: MODEL_HARDWARE_CONSISTENCY_PASS_V1_2 ; PI_V2_CASE_SET_VALIDATED
NO_REAL_POWER_EXECUTED ; LLC_HARDWARE_PI_VALIDATED=0 ; LLC_CONTROL_DIRECTION=0

## C. settling metric unit test
  step-then-30ms-entry response -> reported settle = 27 ms (expect ~30)
  REFERENCE_STEP_SETTLING_METRIC_PASS = True

## D. delay model unit test
  20us -> command seen at step 1 (expect 1) ok=True
  40us -> command seen at step 2 (expect 2) ok=True
  60us -> command seen at step 3 (expect 3) ok=True
  CONTROL_DELAY_MODEL_PASS = True

## I. ePWM quantization: 150k->TBPRD=399(150000.0) 170k->TBPRD=352(169971.7)
  EPWM_FREQUENCY_QUANTIZATION_MODEL_PASS = True

## J. re-search candidates
  CANDIDATE_A_ULTRA_CONSERVATIVE seed_fc=10 x2.0 -> scaled=20 Hz  Kp=6657.43331 Ki_step=4.438289e+01
  CANDIDATE_B_BALANCED           seed_fc=20 x1.0 -> scaled=20 Hz  Kp=6657.43331 Ki_step=4.438289e+01
  CANDIDATE_C_FASTEST_SAFE_IN_SIL seed_fc=80 x2.0 -> scaled=160 Hz  Kp=53259.46650 Ki_step=3.550631e+02
  scaled_seed_fc_hz is analytic seed product, NOT measured closed-loop bandwidth; true bandwidth = NOT_HARDWARE_IDENTIFIED
  VIRTUAL_ONLY_PI_CANDIDATE (NOT HARDWARE_TUNED_PI)

## balanced metrics (worst mandatory): overshoot=0.109V settle=25.8ms steady=0.007% freq_pp=348 TBPRDspan=1
  E  24V/50W(NEAR_BOUNDARY) bounded=True grew_at_clamp=False runaway=False leaves=True imax=27858
  E  36V/100W(HARD_BOUNDARY) bounded=True grew_at_clamp=False runaway=False leaves=True imax=29903
  BOUNDARY_ANTI_WINDUP_STRICT_PASS = True
  F command-side rate-limit: steps=115 integral_growth=5268 Hz imax=20828
  RATE_LIMIT_AUDIT_SIGNAL_VALID_PASS = True
  G stress: integrator_peak=5673 clamp_hi=0 clamp_lo=0 hi2lo=0 lo2hi=0 bounded=True
  STRESS_INTEGRAL_AND_CLAMP_AUDIT_PASS = True
  SIL_DETERMINISTIC_REPLAY_PASS = True
  M large-signal 24V 50W<->75W: True

## Z. verdict
STAGE6_PI_SIL_TUNING_V2_1_PASS
PI_CANDIDATE_FOR_FIRMWARE_SHADOW_INTEGRATION
LLC_HARDWARE_PI_VALIDATED=0
NO_REAL_POWER_EXECUTED
