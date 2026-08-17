/*
 * control.h
 *
 * Minimal LLC frequency control.  Formal PI runs in the 20 us fast task;
 * 5 ms slow task is used only for state machine / soft-start ramp / slow
 * protection.
 */
#ifndef APP_CONTROL_H
#define APP_CONTROL_H

#include "DSP2803x_Device.h"

void CTRL_Init(void);
void CTRL_FastTask(void);
void CTRL_SlowTask(void);
void CTRL_Reset(void);

#endif /* APP_CONTROL_H */
