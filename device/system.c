/*
 * system.c
 *
 *  Created on: 2026年7月10日
 *      Author: ahyin
 */

#include "DSP2803x_Device.h"
#include "DSP2803x_Examples.h"
#include "DSP2803x_GlobalPrototypes.h"

#include "system.h"

/*
 * F28034 时钟路径：
 * 内部 OSC1（约 10 MHz） -> PLL ×6 -> SYSCLKOUT（约 60 MHz）
 *
 * 不调用 TI 示例中的 InitSysCtrl()：该函数使用该示例库默认的
 * PLL ×12、DIVSEL=/2 组合，并会在 MCLKSTS 已置位时执行 ESTOP0。
 */
Uint16 System_Init(void)
{
    Uint32 lock_wait;
#ifdef STAGE6_FLASH_BUILD
    /*
     * FLASH build only. Running from flash requires flash wait-states to be
     * configured, and the flash-init helper (InitFlash, in the "ramfuncs"
     * section) must first be copied from Flash to RAM. Copy it, then call
     * InitFlash() (60 MHz -> PAGEWAIT=2, RANDWAIT=2, OTPWAIT=3). This is
     * compiled out of the RAM build, so power behavior is unchanged.
     */
    {
        extern Uint16 RamfuncsLoadStart, RamfuncsLoadEnd, RamfuncsRunStart;
        Uint32 n;
        n = (Uint32)&RamfuncsLoadEnd - (Uint32)&RamfuncsLoadStart;
        while (n--)
        {
            ((volatile Uint16 *)&RamfuncsRunStart)[n] =
                ((volatile Uint16 *)&RamfuncsLoadStart)[n];
        }
        InitFlash();
    }
#endif

    /* 1. 先关闭看门狗，避免 PLL 锁定等待期间复位。 */
    DisableDog();

    /* 2. 仅使用内部 OSC1；不依赖外部晶振或外部时钟输入。 */
    IntOsc1Sel();

    /*
     * 3. 运行 TI OTP 校准程序。ADC 时钟必须暂时开启。
     * 该程序同时装载内部振荡器校准值。
     */
    EALLOW;
    SysCtrlRegs.PCLKCR0.bit.ADCENCLK = 1;
    (*Device_cal)();
    SysCtrlRegs.PCLKCR0.bit.ADCENCLK = 0;

    /*
     * MCLKSTS 是失钟状态位。先清除可能由复位前状态留下的标志；
     * 若它立刻再次置位，则不继续配置 PLL。
     */
    if (SysCtrlRegs.PLLSTS.bit.MCLKSTS != 0)
    {
        SysCtrlRegs.PLLSTS.bit.MCLKCLR = 1;
        __asm(" RPT #7 || NOP");

        if (SysCtrlRegs.PLLSTS.bit.MCLKSTS != 0)
        {
            EDIS;
            return SYSTEM_INIT_FAILED;
        }
    }

    /* 4. 修改 PLL 前，SYSCLKOUT 先进入安全的 /4 分频。 */
    SysCtrlRegs.PLLSTS.bit.DIVSEL = 0;
    SysCtrlRegs.PLLSTS.bit.MCLKOFF = 1;

    /* 内部 OSC1 约 10 MHz × 6 = SYSCLKOUT 约 60 MHz。 */
    SysCtrlRegs.PLLCR.bit.DIV = 6;
    EDIS;

    /* 5. 等待 PLL 锁定；有限等待避免异常时永久卡死。 */
    for (lock_wait = 0UL; lock_wait < 1000000UL; lock_wait++)
    {
        if (SysCtrlRegs.PLLSTS.bit.PLLLOCKS != 0)
        {
            break;
        }
    }

    if (SysCtrlRegs.PLLSTS.bit.PLLLOCKS == 0)
    {
        EALLOW;
        SysCtrlRegs.PLLSTS.bit.MCLKOFF = 0;
        EDIS;
        return SYSTEM_INIT_FAILED;
    }

    EALLOW;
    SysCtrlRegs.PLLSTS.bit.MCLKOFF = 0;

    /* 6. 按 TI 推荐顺序从 /4 经 /2 切换到 /1。 */
    SysCtrlRegs.PLLSTS.bit.DIVSEL = 2;
    __asm(" RPT #7 || NOP");
    SysCtrlRegs.PLLSTS.bit.DIVSEL = 3;

    /* PLL 重新开启失钟检测后，再确认 OSC1 没有持续失效。 */
    if (SysCtrlRegs.PLLSTS.bit.MCLKSTS != 0)
    {
        SysCtrlRegs.PLLSTS.bit.MCLKCLR = 1;
        EDIS;
        return SYSTEM_INIT_FAILED;
    }

    EDIS;
    return SYSTEM_INIT_OK;
}

void Delay_us(Uint32 microseconds)
{
    if (microseconds == 0UL)
    {
        return;
    }

    /* 教程的 DELAY_US() 使用 CPU_RATE=16.667 ns（60 MHz）换算循环次数。 */
    DELAY_US(microseconds);
}

void Delay_ms(Uint32 milliseconds)
{
    while (milliseconds != 0UL)
    {
        Delay_us(1000UL);
        milliseconds--;
    }
}
