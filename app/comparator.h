/*
 * comparator.h
 *
 * Minimal COMP1/DAC configuration for the TZ1 protection path.
 * Physical COMP1OUT -> PCB -> GPIO15/TZ1 is BOARD_MAPPING_PENDING_PHYSICAL_VERIFY
 * until Stage 4 signal-injection tests pass.
 */
#ifndef APP_COMPARATOR_H
#define APP_COMPARATOR_H

#include "DSP2803x_Device.h"

void COMP_Init(void);
void COMP_ApplyGlobals(void);
void COMP_RunLoopbackDiagnostic(void);
void COMP_ArmInjectionTest(void);
void COMP_DisarmInjectionTest(void);
void COMP_UpdateStatus(void);
void COMP_StaticCalibrationArm(void);
void COMP_StaticCalibrationDisarm(void);
void COMP_ArmForPowerStart(Uint16 requested_dac);
void COMP_ArmForSingleCycleStart(Uint16 requested_dac);
void COMP_StaticCalibrationFastTask(void);

#endif /* APP_COMPARATOR_H */
