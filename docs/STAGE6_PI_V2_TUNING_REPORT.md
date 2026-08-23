# STAGE6 PI SIL TUNING V2 (offline, shadow-gate locked)
Base: MODEL_HARDWARE_CONSISTENCY_PASS_V1_2 ; PI_V2_CASE_SET_VALIDATED
NO_REAL_POWER_EXECUTED ; LLC_HARDWARE_PI_VALIDATED=0 ; LLC_CONTROL_DIRECTION=0

## D. headroom audit
   24V   50W f*=176123 headroom=3877 NEAR_BOUNDARY
   24V   75W f*=129177 headroom=9177 INTERIOR
   30V  100W f*=144327 headroom=24327 INTERIOR
   36V  100W f*=179849 headroom=151 HARD_BOUNDARY
  PI_V2_OPERATING_POINT_HEADROOM_AUDIT_PASS = True

## E. local PFM gain
   24V   50W Kf= -0.00003 V/Hz =  -0.034 V/kHz ; inverse=29212 Hz/V ; Kf<0=True
   24V   75W Kf= -0.00006 V/Hz =  -0.057 V/kHz ; inverse=17659 Hz/V ; Kf<0=True
   30V  100W Kf= -0.00007 V/Hz =  -0.070 V/kHz ; inverse=14253 Hz/V ; Kf<0=True
   36V  100W Kf= -0.00006 V/Hz =  -0.061 V/kHz ; inverse=16519 Hz/V ; Kf<0=True
  LOCAL_PFM_GAIN_SIGN_PASS = True

## I. ePWM quantization: 150k->TBPRD=399(150000.0) 170k->TBPRD=352(169971.7)
  EPWM_FREQUENCY_QUANTIZATION_MODEL_PASS = True

## F/G/H surrogate & ensembles
  CONTROL_DESIGN_SURROGATE dV/dt=(Vss(f,Vin,load)-V)/tau; Vss=MODEL_H_V1_2
  tau {0.5,1.5,3,6,10}ms state DYNAMIC_TIME_CONSTANT_NOT_HARDWARE_IDENTIFIED
  gain {0.5,1,2}x MANDATORY {0.25,4}x STRESS; delay {20,40}us MANDATORY 60us STRESS

## T. candidates
  CANDIDATE_A_ULTRA_CONSERVATIVE fc=30 Kp=4993.074985 Ki_step=3.328717e+01 Ki_cont=1664358.328 Hz/(V.s)
  CANDIDATE_B_BALANCED         fc=20 Kp=6657.433313 Ki_step=4.438289e+01 Ki_cont=2219144.438 Hz/(V.s)
  CANDIDATE_C_FASTEST_SAFE_IN_SIL fc=80 Kp=53259.466503 Ki_step=3.550631e+02 Ki_cont=17753155.501 Hz/(V.s)
  VIRTUAL_ONLY_PI_CANDIDATE (NOT HARDWARE_TUNED_PI)

## R/T. balanced-candidate metrics (worst over mandatory ensemble)
  worst Vref-step overshoot = 0.109 V ; worst settle = 0.0 ms ; worst steady err = 0.005%
  noise(+-4raw) worst TBPRD span = 1 ; frequency_pp = 348 Hz
  gain/tau/delay robustness: passes 0.5/1/2x, 1.5/3/6ms, 20/40us

## N. boundary anti-windup (24V/50W, 36V/100W)
   24V   50W(NEAR_BOUNDARY) bounded=True imax=28307 clamp_hi=0 clamp_lo=0
   36V  100W(HARD_BOUNDARY) bounded=True imax=29917 clamp_hi=11499 clamp_lo=0
  BOUNDARY_ANTI_WINDUP_PASS = True

## O. rate-limit windup audit (balanced, big-signal)
  rate_limited_steps=115 int_growth=2140 Hz imax=20828
  no rate-limit integral pile-up -> OK

## S. STRESS ensemble (0.25/4x gain, 0.5/10ms tau, 60us delay)
  bounded / no runaway integral / no clamp ping-pong = True

## M. large-signal continuous PFM 24V 50W<->75W (176k<->129k)
  50W->75W->50W: True

## Z. verdict
STAGE6_PI_SIL_TUNING_V2_PASS
PI_CANDIDATE_FOR_FIRMWARE_SHADOW_INTEGRATION
LLC_HARDWARE_PI_VALIDATED=0
NO_REAL_POWER_EXECUTED

