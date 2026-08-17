/*
 * system.h
 *
 *  Created on: 2026年7月10日
 *      Author: ahyin
 */

#ifndef DEVICE_SYSTEM_H_
#define DEVICE_SYSTEM_H_

#include "DSP2803x_Device.h"

/* 内部 OSC1 约 10 MHz，经 PLL ×6 后的目标系统时钟。 */
#define SYSTEM_CLOCK_HZ            60000000UL
#define SYSTEM_CLOCK_MHZ            60UL

#define SYSTEM_INIT_OK              1U
#define SYSTEM_INIT_FAILED          0U

Uint16 System_Init(void);

/*
 * 简单阻塞延时。仅用于普通等待、LED和上电时序，
 * 不用于PWM、ADC或未来的实时控制中断。
 */
void Delay_us(Uint32 microseconds);
void Delay_ms(Uint32 milliseconds);


#endif /* DEVICE_SYSTEM_H_ */
