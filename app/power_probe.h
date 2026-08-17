/*
 * power_probe.h
 *
 * BRINGUP_DIAGNOSTIC_LEGACY
 * -------------------------
 * These single-cycle / VOUT / CAL_HOLD / DAC-repeatability probes are kept as
 * historical bring-up evidence only. They must NOT grow new independent PWM
 * algorithms. Any future probe must go through the unified PWM driver and
 * SoftStart Engine.
 *
 * Stage 4D ONE_SHOT_POWER_PROBE: 150 kHz for a hard-limited 2 ms, then
 * unconditional OST stop. One request = one probe only.
 */
#ifndef APP_POWER_PROBE_H
#define APP_POWER_PROBE_H

#include "DSP2803x_Device.h"

void POWERPROBE_SlowTask(void);
void POWERPROBE_Tick(void);
void SINGLECYCLE_SlowTask(void);
void SINGLECYCLE_AbortByFault(void);
void MULTICYCLE_SlowTask(void);
void MULTICYCLE_AbortByFault(void);
void VOUTPROBE_SlowTask(void);
void VOUTPROBE_AbortByFault(void);
void VOUTPROBE_PostCaptureTask(void);
void CALHOLD_SlowTask(void);
__interrupt void EPWM1_INT_ISR(void);

#endif /* APP_POWER_PROBE_H */
