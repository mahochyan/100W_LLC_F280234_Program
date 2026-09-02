#ifndef BURST_PACKET_H_
#define BURST_PACKET_H_

/* W2_BURST_PACKET_CHARACTERIZATION_V1 - packet request layer.
 *
 * This is a THIN request/validation layer on top of the existing, real-board
 * verified MULTICYCLE cycle-level engine (power_probe.c). The engine counts
 * complete PWM periods in the ePWM1 period ISR and forces OST from inside the
 * ISR -- it is cycle-accurate and does NOT use the 20 us timer for packet
 * timing.
 *
 * Responsibilities:
 *  - authorize only packet_cycles in {1, 2, 3, 5}
 *  - fix the packet at 170 kHz / dead-time 36 (production envelope, DB36,
 *    50% duty structure)
 *  - keep the packet path out of PI / dynamic dead-time / adaptive packet
 *  - copy the engine result into packet-specific record fields
 *
 * Real hardware is NOT touched until the user explicitly runs the next shoot
 * (READY_FOR_BURST_PACKET_1C .. 5C). The NE harness proves exact 1/2/3/5
 * cycle counts before any real firing.
 */

#include "DSP2803x_Device.h"

#define BURST_PACKET_FREQ_HZ        170000UL
#define BURST_PACKET_DEADTIME       36U
#define BURST_PACKET_CYCLES_MAX     5U
#define BURST_PACKET_RESULT_NONE    0U
#define BURST_PACKET_RESULT_PASS    1U
#define BURST_PACKET_RESULT_FAULT   2U
#define BURST_PACKET_RESULT_REJECT  3U

void BURSTPACKET_Init(void);
void BURSTPACKET_SlowTask(void);

#endif /* BURST_PACKET_H_ */