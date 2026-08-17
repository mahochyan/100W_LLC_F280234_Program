/*
 * default_isr.c
 *
 * Minimal catch-all ISR used by the trimmed PIE vector table.
 * Active LLC ISRs are defined in their respective modules.
 */

#include "DSP2803x_Device.h"

__interrupt void rsvd_ISR(void)
{
    for (;;)
    {
    }
}
