//###########################################################################
//
// FILE:	DSP2803x_PieVect.c
//
// TITLE:	DSP2803x Devices PIE Vector Table Initialization Functions.
//
//###########################################################################
// $TI Release: F2803x Support Library v2.01.00.00 $
// $Release Date: Mon May 22 15:41:40 CDT 2017 $
// $Copyright:
// Copyright (C) 2009-2017 Texas Instruments Incorporated - http://www.ti.com/
//
// Redistribution and use in source and binary forms, with or without 
// modification, are permitted provided that the following conditions 
// are met:
// 
//   Redistributions of source code must retain the above copyright 
//   notice, this list of conditions and the following disclaimer.
// 
//   Redistributions in binary form must reproduce the above copyright
//   notice, this list of conditions and the following disclaimer in the 
//   documentation and/or other materials provided with the   
//   distribution.
// 
//   Neither the name of Texas Instruments Incorporated nor the names of
//   its contributors may be used to endorse or promote products derived
//   from this software without specific prior written permission.
// 
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT 
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT 
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, 
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT 
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT 
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE 
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
// $
//###########################################################################

//
// Included Files
//
#include "DSP2803x_Device.h"     // DSP2803x Headerfile Include File
#include "DSP2803x_Examples.h"   // DSP2803x Examples Include File

extern __interrupt void EPWM1_INT_ISR(void);

const struct PIE_VECT_TABLE PieVectTableInit = {
    rsvd_ISR,  // 0  Reserved space
    rsvd_ISR,  // 1  Reserved space
    rsvd_ISR,  // 2  Reserved space
    rsvd_ISR,  // 3  Reserved space
    rsvd_ISR,  // 4  Reserved space
    rsvd_ISR,  // 5  Reserved space
    rsvd_ISR,  // 6  Reserved space
    rsvd_ISR,  // 7  Reserved space
    rsvd_ISR,  // 8  Reserved space
    rsvd_ISR,  // 9  Reserved space
    rsvd_ISR,  // 10 Reserved space
    rsvd_ISR,  // 11 Reserved space
    rsvd_ISR,  // 12 Reserved space

    //
    // Non-Peripheral Interrupts
    //
    rsvd_ISR,     // CPU-Timer 1
    rsvd_ISR,     // CPU-Timer2
    rsvd_ISR,   // Datalogging interrupt
    rsvd_ISR,   // RTOS interrupt
    rsvd_ISR,    // Emulation interrupt
    rsvd_ISR,       // Non-maskable interrupt
    rsvd_ISR,   // Illegal operation TRAP
    rsvd_ISR,     // User Defined trap 1
    rsvd_ISR,     // User Defined trap 2
    rsvd_ISR,     // User Defined trap 3
    rsvd_ISR,     // User Defined trap 4
    rsvd_ISR,     // User Defined trap 5
    rsvd_ISR,     // User Defined trap 6
    rsvd_ISR,     // User Defined trap 7
    rsvd_ISR,     // User Defined trap 8
    rsvd_ISR,     // User Defined trap 9
    rsvd_ISR,    // User Defined trap 10
    rsvd_ISR,    // User Defined trap 11
    rsvd_ISR,    // User Defined trap 12

    //
    // Group 1 PIE Vectors
    //
    ADCINT1_ISR,    // 1.1 ADC (if rsvd_ISR, INT10.1 is defined as ADCINT1_ISR)
    rsvd_ISR,    // 1.2 ADC (if rsvd_ISR, INT10.2 is defined as rsvd_ISR)
    rsvd_ISR,       // 1.3
    rsvd_ISR,      // 1.4 External Interrupt
    rsvd_ISR,      // 1.5 External Interrupt
    rsvd_ISR,    // 1.6 ADC
    TINT0_ISR,      // 1.7 Timer 0
    rsvd_ISR,    // 1.8 WD, Low Power

    //
    // Group 2 PIE Vectors
    //
    EPWM1_TZINT_ISR, // 2.1 EPWM-1 Trip Zone
    rsvd_ISR, // 2.2 EPWM-2 Trip Zone
    rsvd_ISR, // 2.3 EPWM-3 Trip Zone
    rsvd_ISR, // 2.4 EPWM-4 Trip Zone
    rsvd_ISR, // 2.4 EPWM-4 Trip Zone
    rsvd_ISR, // 2.4 EPWM-4 Trip Zone
    rsvd_ISR, // 2.4 EPWM-4 Trip Zone
    rsvd_ISR,        // 2.8

    //
    // Group 3 PIE Vectors
    //
    EPWM1_INT_ISR,   // 3.1 EPWM-1 Interrupt
    rsvd_ISR,   // 3.2 EPWM-2 Interrupt
    rsvd_ISR,   // 3.3 EPWM-3 Interrupt
    rsvd_ISR,   // 3.4 EPWM-4 Interrupt
    rsvd_ISR,   // 3.5 EPWM-5 Interrupt
    rsvd_ISR,   // 3.6 EPWM-6 Interrupt
    rsvd_ISR,   // 3.7 EPWM-7 Interrupt
    rsvd_ISR,        // 3.8

    //
    // Group 4 PIE Vectors
    //
    rsvd_ISR,   // 4.1 ECAP-1
    rsvd_ISR,        // 4.2
    rsvd_ISR,        // 4.3
    rsvd_ISR,        // 4.4
    rsvd_ISR,        // 4.5
    rsvd_ISR,        // 4.6
    rsvd_ISR,  // 4.7 HRCAP-1
    rsvd_ISR,  // 4.8 HRCAP-2

    //
    // Group 5 PIE Vectors
    //
    rsvd_ISR,   // 5.1 EQEP-1
    rsvd_ISR,        // 5.2
    rsvd_ISR,        // 5.3
    rsvd_ISR,        // 5.4
    rsvd_ISR,        // 5.5
    rsvd_ISR,        // 5.6
    rsvd_ISR,        // 5.7
    rsvd_ISR,        // 5.8

    
    //
    // Group 6 PIE Vectors
    //
    rsvd_ISR,   // 6.1 SPI-A
    rsvd_ISR,   // 6.2 SPI-A
    rsvd_ISR,   // 6.3 SPI-B
    rsvd_ISR,   // 6.4 SPI-B
    rsvd_ISR,        // 6.5
    rsvd_ISR,        // 6.6
    rsvd_ISR,        // 6.7
    rsvd_ISR,        // 6.8

    //
    // Group 7 PIE Vectors
    //
    rsvd_ISR,        // 7.1
    rsvd_ISR,        // 7.2
    rsvd_ISR,        // 7.3
    rsvd_ISR,        // 7.4
    rsvd_ISR,        // 7.5
    rsvd_ISR,        // 7.6
    rsvd_ISR,        // 7.7
    rsvd_ISR,        // 7.8

    //
    // Group 8 PIE Vectors
    //
    rsvd_ISR,    // 8.1 I2C
    rsvd_ISR,    // 8.2 I2C
    rsvd_ISR,        // 8.3
    rsvd_ISR,        // 8.4
    rsvd_ISR,        // 8.5
    rsvd_ISR,        // 8.6
    rsvd_ISR,        // 8.7
    rsvd_ISR,        // 8.8

    //
    // Group 9 PIE Vectors
    //
    rsvd_ISR,   // 9.1 SCI-A
    rsvd_ISR,   // 9.2 SCI-A
    rsvd_ISR,    // 9.3 LIN-A
    rsvd_ISR,    // 9.4 LIN-A
    rsvd_ISR,   // 9.5 eCAN-A
    rsvd_ISR,   // 9.6 eCAN-A
    rsvd_ISR,        // 9.7
    rsvd_ISR,        // 9.8

    //
    // Group 10 PIE Vectors
    //
    rsvd_ISR,      // 10.1 (if ADCINT1_ISR, then INT1.1 is defined as rsvd_ISR)
    rsvd_ISR,      // 10.2 (if rsvd_ISR, then INT1.2 is defined as rsvd_ISR)
    rsvd_ISR,   // 10.3 ADC
    rsvd_ISR,   // 10.4 ADC
    rsvd_ISR,   // 10.5 ADC
    rsvd_ISR,   // 10.6 ADC
    rsvd_ISR,   // 10.7 ADC
    rsvd_ISR,   // 10.8 ADC

    //
    // Group 11 PIE Vectors
    //
    rsvd_ISR,   // 11.1 CLA1
    rsvd_ISR,   // 11.2 CLA1
    rsvd_ISR,   // 11.3 CLA1
    rsvd_ISR,   // 11.4 CLA1
    rsvd_ISR,   // 11.5 CLA1
    rsvd_ISR,   // 11.6 CLA1
    rsvd_ISR,   // 11.7 CLA1
    rsvd_ISR,   // 11.8 CLA1

    //
    // Group 12 PIE Vectors
    //
    rsvd_ISR,       // 12.1 External Interrupt
    rsvd_ISR,        // 12.2
    rsvd_ISR,        // 12.3
    rsvd_ISR,        // 12.4
    rsvd_ISR,        // 12.5
    rsvd_ISR,        // 12.6
    rsvd_ISR,         // 12.7 CLA1
    rsvd_ISR          // 12.8 CLA1
};

//
// InitPieVectTable - This function initializes the PIE vector table
// to a known state. This function must be executed after boot time.
//
void 
InitPieVectTable(void)
{
    int16	i;
    Uint32 *Source = (void *) &PieVectTableInit;
    volatile Uint32 *Dest = (void *) &PieVectTable;

    //
    // Do not write over first 3 32-bit locations (these locations are
    // initialized by Boot ROM with boot variables)
    //
    Source = Source + 3;
    Dest = Dest + 3;

    EALLOW;
    for(i=0; i < 125; i++)
    {
        *Dest++ = *Source++;
    }
    EDIS;

    //
    // Enable the PIE Vector Table
    //
    PieCtrlRegs.PIECTRL.bit.ENPIE = 1;
}

//
// End of file
//

