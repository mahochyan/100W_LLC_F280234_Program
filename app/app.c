/*
 * app.c
 *
 * Top-level application bring-up.  main.c only calls APP_Init/APP_Run.
 */

#include "DSP2803x_Device.h"
#include "DSP2803x_Examples.h"
#include "llc_config.h"
#include "llc_globals.h"
#include "pwm.h"
#include "adc.h"
#include "control.h"
#include "protection.h"
#include "comparator.h"
#include "state_machine.h"
#include "power_probe.h"
#include "soft_start.h"
#include "cal_hold_burst.h"
#include "open_loop_steady.h"
#include "app.h"
#include "shot.h"

static void APP_InitInterrupts(void)
{
    EALLOW;
    InitPieCtrl();
    InitPieVectTable();

    PieVectTable.ADCINT1 = &ADCINT1_ISR;
    PieVectTable.TINT0 = &TINT0_ISR;
    PieVectTable.EPWM1_TZINT = &EPWM1_TZINT_ISR;
    PieVectTable.EPWM1_INT = &EPWM1_INT_ISR;
    EDIS;

    /* Group 1: ADCINT1 (INT1.1), TINT0 (INT1.7) */
    PieCtrlRegs.PIEIER1.bit.INTx1 = 1U;
    PieCtrlRegs.PIEIER1.bit.INTx7 = 1U;

    /* Group 2: EPWM1 TZ (INT2.1) */
    PieCtrlRegs.PIEIER2.bit.INTx1 = 1U;

    /* Group 3: EPWM1 INT (INT3.1) for single-cycle probe stop */
    PieCtrlRegs.PIEIER3.bit.INTx1 = 1U;

    /* Explicitly enable required CPU interrupt groups. */
    IER = 0x0007U;

    /* Enable CPU Timer1/2 clocks for probes and latency diagnostic */
    SysCtrlRegs.PCLKCR3.bit.CPUTIMER1ENCLK = 1U;
    SysCtrlRegs.PCLKCR3.bit.CPUTIMER2ENCLK = 1U;

    /* CPU Timer2 free-running for ISR latency measurements */
    CpuTimer2Regs.TCR.bit.TSS = 1U;
    CpuTimer2Regs.PRD.all = 0xFFFFFFFFUL;
    CpuTimer2Regs.TPR.all = 0U;
    CpuTimer2Regs.TPRH.all = 0U;
    CpuTimer2Regs.TCR.bit.TRB = 1U;
    CpuTimer2Regs.TCR.bit.TIE = 0U;
    CpuTimer2Regs.TCR.bit.TSS = 0U;

    /* CPU Timer0: 20 us fast task */
    CpuTimer0Regs.TCR.bit.TSS = 1U;
    CpuTimer0Regs.PRD.all = 1200UL;          /* 60 MHz * 20 us */
    CpuTimer0Regs.TPR.all = 0U;
    CpuTimer0Regs.TPRH.all = 0U;
    CpuTimer0Regs.TCR.bit.TRB = 1U;
    CpuTimer0Regs.TCR.bit.TIE = 1U;
    CpuTimer0Regs.TCR.bit.TSS = 0U;

    EnableInterrupts();
    IER = 0x0007U;
}

void APP_Init(void)
{
    /* System_Init and GPIO_Init have already been called by main. */
    PWM_Init();
    ADC_Init();
    COMP_Init();
    PROT_Init();
    CTRL_Init();
    SM_Init();
    SoftStart_Init();
    CALHOLD_Init();
#if STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
    SHOT_Init();   /* first bounded shot state (shot build only) */
#endif
#if STAGE6_OPEN_LOOP_STEADY_BUILD
    OPENLOOP_Init();   /* W2 open-loop steady module (this build only) */
#endif
    APP_InitInterrupts();

    /* Stay in Stage 0 SAFE.  First board power-up must start here. */
    g_active_bringup_stage = BRINGUP_STAGE_0_SAFE;
    g_switching_frequency_hz = 0UL;
    g_pwm_period = 0U;
}

void APP_Run(void)
{
    while (1)
    {
        SM_Run();
    }
}



