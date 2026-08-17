/*
 * protection.h
 *
 * Fault flags, slow/fast protection and the TZ1 ISR.
 */
#ifndef APP_PROTECTION_H
#define APP_PROTECTION_H

#include "DSP2803x_Device.h"

void PROT_Init(void);
void PROT_SlowTask(void);
void PROT_FastTask(void);
void PROT_RequestFault(Uint16 cause, Uint16 countTrip);

__interrupt void EPWM1_TZINT_ISR(void);
__interrupt void TINT0_ISR(void);

#endif /* APP_PROTECTION_H */
