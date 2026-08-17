# BOARD_TEST_RECORD.md

Fill in during hardware bring-up. Build success is not a substitute for these tests.

| Item | Value / Result | Signature / Date |
|---|---|---|
| Board serial / revision | | |
| Instruments (scope, probes, DC supply) | | |
| Stage 1 PWM frequency | 150 kHz | |
| Stage 1 TBPRD/CMPA observed | 400 / 200 | |
| Stage 1 dead time (MCU PWM out) | 36 ticks = 600 ns | |
| Stage 1 SI8233 input/output dead time | | |
| Stage 1 four MOS Vgs/Vds | | |
| Stage 2 frequency sweep 70–150 kHz | 150/140/130/120/100 kHz observed; stable at 100 kHz | |
| Stage 2 dead time / shoot-through | 600 ns dead time, no abnormal overlap seen |
| Stage 2 30V supply current @100kHz | 81 mA, below 100 mA limit |
| Stage 3 ADC raw Vout/Ipri/Iout | | |
| Stage 3 ADC scale/offset calibration | | |
| Stage 4 software force trip response | PASS: trip_count=1, FAULT set, OST=1, no auto-restart | |
| Stage 4 comparator injection trip response | PASS via loopback diagnostic 0/1/0; COMP1OUT->GPIO15/TZ1 verified | |
| Stage 4 COMP1OUT→PCB→TZ1 verified? | PASS (BOARD_LOOPBACK_DIAGNOSTIC 0/1/0) | |
| Stage 5A 150 kHz Vout/Ipri/Vgs/Vds/ZVS | | |
| Stage 5A 120 kHz data | | |
| Stage 5A 100 kHz data | | |
| Stage 5B soft-start ramp 150→target | | |
| Frequency→Vout direction | +1 / -1 / unknown | |
| Closed-loop PI coefficients | | |
| OVP threshold | | |
| OCP threshold | | |
| UVP threshold | | |
| Final dead-band value | | |
| 35 kHz / ZVS safety boundary | | |
| Stage 7 power run allowed? | Yes / No | |

## First main-power checklist

- [ ] Input supply current-limited
- [ ] Low input voltage (8–12 V)
- [ ] Light/fake load
- [ ] Start at 150 kHz
- [ ] Scope probes on Vgs/Vds/half-bridge/Ipri/Vout
- [ ] Emergency stop within reach
