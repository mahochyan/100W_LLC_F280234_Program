/*
 * state_machine.h
 *
 * Stage gating and top-level bring-up state machine.
 */
#ifndef APP_STATE_MACHINE_H
#define APP_STATE_MACHINE_H

#include "DSP2803x_Device.h"

void SM_Init(void);
void SM_Run(void);

#endif /* APP_STATE_MACHINE_H */
