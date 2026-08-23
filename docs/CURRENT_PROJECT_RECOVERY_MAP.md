# CURRENT PROJECT RECOVERY MAP

## VALID BASELINE
- **main @ `eade849`**（未改动）

## VALID
- Stage5 SoftStart
- VOUT calibration
- Comparator / TZ
- ADC sync
- 250k Profile-C startup path

## FAILED DIAGNOSTIC
- 200k / DB140 multi-edge requalification
- OUT `4A993FFA...` → **FAILED_AT_3_CYCLE / NOT_BASELINE**

## BLOCKED UNTIL BENCH
- IPRI absolute calibration
- ZVS
- Vds / Vgs
- true trip waveform

## NEXT MAIN DEVELOPMENT
- return to verified formal SoftStart path
- then continue PFM / automatic regulation work
