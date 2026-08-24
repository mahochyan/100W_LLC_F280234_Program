/*
 * pwm.h
 *
 * F28034 LLC ePWM1 driver and public safety API.
 */
#ifndef DRIVER_PWM_H
#define DRIVER_PWM_H

#include "DSP2803x_Device.h"

void    PWM_Init(void);

/* Fixed public LLC interfaces */
Uint16  LLC_SetFrequencyHz(Uint32 hz);
void    LLC_PWM_Enable(void);
void    LLC_PWM_DisableSafe(void);
void    LLC_ProtectionForceTrip(Uint16 cause);
Uint16  LLC_ProtectionResetExplicit(void);

/* Unified PWM register API (only these functions write TBPRD/CMPA/DBRED/DBFED) */
Uint16  PWM_ApplyPeriodDeadtime(Uint32 period, Uint16 deadtime);
Uint16  PWM_SetDeadbandOnly(Uint16 deadtime);
Uint16  PWM_PrepareStart(Uint32 period, Uint16 deadtime, Uint16 start_phase);
void    PWM_StartDeterministic(void);

/* Internal helper used by protection/state machine */
void    PWM_Trip(Uint16 cause, Uint16 countTrip);
Uint16  PWM_ConfigMatchesFrozenBaseline(void);
Uint16  PWM_ConfigTopologyValid(void);
Uint16  PWM_RuntimeValuesValid(Uint32 period, Uint16 deadtime);

/* RECOVERY V1 D: read-only actual-frequency lookup table, TBPRD 352..413
 * (index period-352, 62 entries). Defined in pwm.c, read by the split
 * pipeline compute phase (control.c) and by LLC_SetFrequencyHz. */
extern const Uint32 g_real_pi_actual_hz_table[62];

#endif /* DRIVER_PWM_H */
