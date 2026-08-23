/*
 * adc.h
 *
 * Minimal F28034 ADC monitor for Vout(A1), Ipri(A2), Iout(A3).
 */
#ifndef APP_ADC_H
#define APP_ADC_H

#include "DSP2803x_Device.h"

void ADC_Init(void);
void ADC_SetSoftwareTriggerMode(void);
void ADC_SetPwmSyncTriggerMode(void);
void ADC_SetClosedLoopSyncTriggerMode(void);
void ADC_UpdatePwmSyncPoint(Uint16 period);
void ADC_UpdatePwmSyncPointKeepCadence(Uint16 period);
void ADC_SoftwareTrigger(void);
void ADC_CheckOverflow(void);

/* ISR implemented here for PIE vector assignment */
__interrupt void ADCINT1_ISR(void);

#endif /* APP_ADC_H */
