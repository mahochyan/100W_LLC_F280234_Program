# STAGE6 PHYSICAL PLANT RECONCILIATION V1_1 (SIL) - auto run

> **STAGE6_PHYSICAL_PLANT_MODEL_RECONCILIATION_V1_1.** Model audit / repair / SIL only.
> No firmware, no PWM, no real power. `LLC_HARDWARE_PI_VALIDATED=0`. PI SIL frozen
> until `MODEL_HARDWARE_CONSISTENCY_PASS_V1_1`.
>
> **Supersedes b484999's `MODEL_HARDWARE_CONSISTENCY_PASS`**
> (`SUPERSEDED_PENDING_V1_1_REVIEW`): b484999 used a `8/pi^2` DC conversion and a
> hard-coded `0.0084896` calibration. V1_1 corrects both:
> full-bridge DC factor = **1.0** (`Vout = Vin*M/n - Vf`) and calibration parsed
> from `app/board_calibration.h` (`0.008089325` / `-0.063715`). Historical report kept.


## A. Hardware parameters (evidence-graded, KEPT)
- Cr = 3.004 uF  [HARDWARE_MEASURED] (330nFx2+470nFx5=3.01uF; LCR 2.989-3.014)
- Lr = 3.385 uH  [HARDWARE_MEASURED/DERIVED] (ext+leakage->3.35-3.42)
- Lm = 17.250 uH  [HARDWARE_MEASURED] (16.9-17.6)
- n  = Np/Ns_half = 1.25 ; Cout = 2350 uF ; Vf = 0.7 V (ASSUMED)
- fr = 1/(2*pi*sqrt(Lr*Cr)) = 49.9 kHz  [HARDWARE_CONSTRAINED_RESONANCE]

## G. VOUT calibration source of truth
   BOARD_VOUT_GAIN_V_PER_RAW = 0.008089325  (read from app/board_calibration.h)
   BOARD_VOUT_OFFSET_V       = -0.063715
   delta = gain*raw (offset cancels): 150k 132raw = 1.0678V ; 170k 123raw = 0.9950V
   BOARD_CALIBRATION_SOURCE_OF_TRUTH_PASS

## C/E. Full-bridge FHA DC convention
   Rac=8n^2 RL/pi^2 ; M=|Zm/(Zr+Zm)| ; n=Np/Ns_half=1.25
   FULL BRIDGE : Vout = Vin*M/n - Vf  (k_dc=1.0)
   HALF BRIDGE : Vout = Vin*M/(2n) - Vf
   NOT (8/pi^2)*Vin*M/n : 8/pi^2 belongs to Rac/AC-equivalent only;
   re-multiplying it on the DC gain = double conversion (SUPERSEDED_CONVENTION).

## D. Resonance unit sanity check (f=fr, Zr~0, M~1)
   f=fr=49.9k  M=1.0000
   FULL (k=1.0) Vout_ideal = 18.50V   (expect ~Vin/n-Vf = 18.50V)
   (8/pi^2)     Vout_ideal = 14.86V   (wrong, ~14.4V)
   FULL_BRIDGE_RESONANCE_GAIN_SANITY_PASS = True

## F. Ns_total statement (directive F)
   n = Np/Ns_half = 5/4 = 1.25 (correct, kept).
   Np/Ns_total = 5/8 = 0.625 is a 2x turns-ratio difference from 1.25
   (voltage ratio n/Ns_total = 1.25/0.625 = 2) => 2x voltage-ratio error, not 4x.

## J. Reachability (FHA_PREDICTED_STEADY_STATE), Vout=Vin*M/n-Vf
   Vin Load  range(120-180k)   12V_reachable  [light-load confidence lower]
     24V    5W  15.50.. 15.80V  REACHABLE
     24V   25W  14.34.. 15.33V  REACHABLE
     24V   50W  11.87.. 14.09V  REACHABLE
     24V   75W   9.55.. 12.54V  REACHABLE
     24V  100W   7.76.. 11.01V  NOT-Reachable
     30V    5W  19.55.. 19.92V  REACHABLE
     30V   25W  18.10.. 19.34V  REACHABLE
     30V   50W  15.01.. 17.78V  REACHABLE
     30V   75W  12.12.. 15.84V  REACHABLE
     30V  100W   9.88.. 13.93V  REACHABLE
     36V    5W  23.60.. 24.05V  REACHABLE
     36V   25W  21.86.. 23.34V  REACHABLE
     36V   50W  18.15.. 21.48V  REACHABLE
     36V   75W  14.68.. 19.15V  REACHABLE
     36V  100W  11.99.. 16.86V  REACHABLE

## H. MODEL_H_CHARGE (Voc = Vin*M/n - Vf); identify R_eff only
   R_eff = LOCALLY_IDENTIFIED_EFFECTIVE_PARAMETER (NOT HARDWARE_MEASURED).

## I. R_eff cross-validation
   TEST1 (fit 150k): R_eff=0.610ohm ; pred 170k dv=1.054V (real 0.995V, err=5.9%)
   TEST2 (fit 170k): R_eff=0.650ohm ; pred 150k dv=1.007V (real 1.068V, err=5.7%)
   TEST3 joint-fit summary: R_eff=0.630ohm worst err=3.0%
   R150~R170 close=True ; cross ok=True  ->  LOCAL_CHARGE_MODEL_CROSS_VALIDATED

## K. Regression comparison (24V, 300us charge transient)
   model            | 150k steady        | 170k steady
   OLD_A (0.5x)     |   7.47V |   7.44V
   V1_INTERMEDIATE(8/pi^2) | SUPERSEDED_CONVENTION
   NEW_H_V1_1 (1.0)  |  15.65V |  15.58V
   REAL charge      | 10.0->11.07V (delta 1.068) | 10.0->11.01 (delta 0.995)

## VERDICT
   (1) Cr/Lr/Lm not re-fit: yes ; (2) fr~50k kept: yes
   (3) resonance sanity: True ; (4) Rac/M/DC-gain self-consistent: yes
   (5) calibration source: correct (6) 150>170 direction: yes (7) charge cross-val: LOCAL_CHARGE_MODEL_CROSS_VALIDATED
MODEL_B_NONPHYSICAL_FIT_RETIRED=1
MODEL_HARDWARE_CONSISTENCY_PASS_V1_1
