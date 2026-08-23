# STAGE6 PLANT REACHABILITY & CONTROL REGION V1_2 (offline)

Baseline a2e2e48. Acknowledges MODEL_HARDWARE_CONSISTENCY_PASS_V1_1;
REACHABILITY_MATRIX_V1_1 SUPERSEDED_DUE_TO_RANGE_TEST_BUG (was vmax>=Vref).
Correct: reachable = (vmin-TOL <= Vref <= vmax+TOL), TOL=0.05V, Vref=12V.

## 120-180 kHz reachability matrix (1kHz scan)
Vin Load  vmin..vmax  f@vmin f@vmax  status                f_target(Hz)
  24V    5W  15.50.. 15.80  180000  120000  TARGET_BELOW_WINDOW   -
  24V   25W  14.34.. 15.33  180000  120000  TARGET_BELOW_WINDOW   -
  24V   50W  11.87.. 14.09  180000  120000  TARGET_REACHABLE      176123
  24V   75W   9.55.. 12.54  180000  120000  TARGET_REACHABLE      129177
  24V  100W   7.76.. 11.01  180000  120000  TARGET_ABOVE_WINDOW   -
  30V    5W  19.55.. 19.92  180000  120000  TARGET_BELOW_WINDOW   -
  30V   25W  18.10.. 19.34  180000  120000  TARGET_BELOW_WINDOW   -
  30V   50W  15.01.. 17.78  180000  120000  TARGET_BELOW_WINDOW   -
  30V   75W  12.12.. 15.84  180000  120000  TARGET_BELOW_WINDOW   -
  30V  100W   9.88.. 13.93  180000  120000  TARGET_REACHABLE      144327
  36V    5W  23.60.. 24.05  180000  120000  TARGET_BELOW_WINDOW   -
  36V   25W  21.86.. 23.34  180000  120000  TARGET_BELOW_WINDOW   -
  36V   50W  18.15.. 21.48  180000  120000  TARGET_BELOW_WINDOW   -
  36V   75W  14.68.. 19.15  180000  120000  TARGET_BELOW_WINDOW   -
  36V  100W  11.99.. 16.86  180000  120000  TARGET_REACHABLE      179849

## Model exploration 80-250k (MODEL_EXPLORATION_WINDOW, NOT_PRODUCTION_LIMIT)
   24V    5W  TARGET_BELOW_WINDOW  -> crossing@none Hz
   24V   25W  TARGET_BELOW_WINDOW  -> crossing@none Hz
   24V  100W  TARGET_ABOVE_WINDOW  -> crossing@107059 Hz
   30V    5W  TARGET_BELOW_WINDOW  -> crossing@none Hz
   30V   25W  TARGET_BELOW_WINDOW  -> crossing@none Hz
   30V   50W  TARGET_BELOW_WINDOW  -> crossing@none Hz
   30V   75W  TARGET_BELOW_WINDOW  -> crossing@182291 Hz
   36V    5W  TARGET_BELOW_WINDOW  -> crossing@none Hz
   36V   25W  TARGET_BELOW_WINDOW  -> crossing@none Hz
   36V   50W  TARGET_BELOW_WINDOW  -> crossing@none Hz
   36V   75W  TARGET_BELOW_WINDOW  -> crossing@231664 Hz

## CONTINUOUS_PFM_REGION  (12V reachable in 120-180k)
   24V   50W  f=176123 Hz
   24V   75W  f=129177 Hz
   30V  100W  f=144327 Hz
   36V  100W  f=179849 Hz

## LIGHT_LOAD_HIGH_FREQUENCY_OR_BURST_REGION  (all Vout > target)
   24V    5W  [freq up or future Burst]
   24V   25W  [freq up or future Burst]
   30V    5W  [freq up or future Burst]
   30V   25W  [freq up or future Burst]
   30V   50W  [freq up or future Burst]
   30V   75W  [freq up or future Burst]
   36V    5W  [freq up or future Burst]
   36V   25W  [freq up or future Burst]
   36V   50W  [freq up or future Burst]
   36V   75W  [freq up or future Burst]

## LOW_VIN_HEAVY_LOAD_LOW_FREQUENCY_REGION  (all Vout < target)
   24V  100W  [freq down; 80-250k crossing: 107059]

  SPECIAL  30V/  5W : CONTINUOUS_PFM_120_180K_CANNOT_REGULATE_DOWN
  SPECIAL  36V/  5W : CONTINUOUS_PFM_120_180K_CANNOT_REGULATE_DOWN
  SPECIAL  36V/ 25W : CONTINUOUS_PFM_120_180K_CANNOT_REGULATE_DOWN
  SPECIAL 24V/100W : CONTINUOUS_PFM_120_180K_CANNOT_REGULATE_UP (80-120k crossing: 107059) -> LOW_FREQUENCY_OPERATION_REQUIRES_ZVS_OCP_REVALIDATION

## PI V2 case sets
PI_V2_CONTINUOUS_PFM_CASES:
  -  24V   50W  (f_target=176123 Hz)
  -  24V   75W  (f_target=129177 Hz)
  -  30V  100W  (f_target=144327 Hz)
  -  36V  100W  (f_target=179849 Hz)
PI_V2_EXCLUDED_CASES:
  -  24V    5W  (BURST_REGION/above-window)
  -  24V   25W  (BURST_REGION/above-window)
  -  24V  100W  (below-window)
  -  30V    5W  (BURST_REGION/above-window)
  -  30V   25W  (BURST_REGION/above-window)
  -  30V   50W  (BURST_REGION/above-window)
  -  30V   75W  (BURST_REGION/above-window)
  -  36V    5W  (BURST_REGION/above-window)
  -  36V   25W  (BURST_REGION/above-window)
  -  36V   50W  (BURST_REGION/above-window)
  -  36V   75W  (BURST_REGION/above-window)

REACHABILITY_CLASSIFIER_PASS = True
CONTROL_REGION_MAP_PASS = True
MODEL_HARDWARE_CONSISTENCY_PASS_V1_2 = True
PI_V2_CASE_SET_VALIDATED = True
READY_FOR_STAGE6_PI_SIL_TUNING_V2
