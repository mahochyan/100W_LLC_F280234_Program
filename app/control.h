/*
 * control.h
 *
 * STAGE6 offline control integration (control/actuator split).
 *
 *  - CTRL_ComputeFrequencyCommand()  : Vref -> error -> P/I -> unsaturated ->
 *                                      clamped -> slew-limited -> shadow.
 *                                      NEVER writes ePWM registers.
 *  - CTRL_ApplyFrequencyCommand()    : commits shadow -> g_control_frequency_hz
 *                                      and ONLY if LLC_HARDWARE_PI_VALIDATED calls
 *                                      LLC_SetFrequencyHz() to write real PWM.
 *                                      Otherwise shadow-only (Stage6 offline).
 *  - CTRL_OfflineSelfTest()          : 8-case no-energy control-logic +
 *                                      PWM-register isolation check.
 */
#ifndef APP_CONTROL_H
#define APP_CONTROL_H

#include "DSP2803x_Device.h"

void   CTRL_Init(void);
void   CTRL_FastTask(void);
void   CTRL_SlowTask(void);
void   CTRL_Reset(void);

/* STAGE6_REALTIME_CONTROL_INPUT_BINDING_CLOSURE_V1: production fast control
 * body (freshness selection + sample binding + PI entry). Integer-only. */
void   CTRL_RunFastControl(void);

/* Fixed-point Q12 fast controller (raw-domain). No float in this path. */
Uint32 CTRL_ComputeFrequencyCommand(Uint16 sample_valid, Uint16 vout_raw);
/* Float reference core (STAGE6_PI_FIXED_POINT_REALTIME_MIGRATION_V1): parity /
 * SIL reference only, NOT called from the fast ISR. */
Uint32 CTRL_ComputeFrequencyCommandFloat(Uint16 sample_valid, float vout_v);
void   CTRL_ApplyFrequencyCommand(void);
void   CTRL_OfflineSelfTest(void);
void   CTRL_UpdateTelemetrySlow(void);

#endif /* APP_CONTROL_H */