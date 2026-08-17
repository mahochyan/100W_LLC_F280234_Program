#include "DSP2803x_Device.h"
#include "gpio.h"

void GPIO_Init(void)
{
    EALLOW;

    /* GPIO20、21、24选择普通GPIO功能 */
    GpioCtrlRegs.GPAMUX2.bit.GPIO20 = 0;
    GpioCtrlRegs.GPAMUX2.bit.GPIO21 = 0;
    GpioCtrlRegs.GPAMUX2.bit.GPIO24 = 0;

    /*
     * 先把输出锁存值清零：
     * 红、黄、绿三灯默认全部熄灭
     */
    GpioDataRegs.GPACLEAR.bit.GPIO20 = 1;
    GpioDataRegs.GPACLEAR.bit.GPIO21 = 1;
    GpioDataRegs.GPACLEAR.bit.GPIO24 = 1;

    /* 1 = 输出 */
    GpioCtrlRegs.GPADIR.bit.GPIO20 = 1;
    GpioCtrlRegs.GPADIR.bit.GPIO21 = 1;
    GpioCtrlRegs.GPADIR.bit.GPIO24 = 1;

    /*
     * 输出模式下内部上拉不是重点。
     * 为了状态明确，这里禁用它。
     */
    GpioCtrlRegs.GPAPUD.bit.GPIO20 = 1;
    GpioCtrlRegs.GPAPUD.bit.GPIO21 = 1;
    GpioCtrlRegs.GPAPUD.bit.GPIO24 = 1;

    EDIS;
}

void LED_RedOn(void)
{
    GpioDataRegs.GPASET.bit.GPIO20 = 1;
}

void LED_RedOff(void)
{
    GpioDataRegs.GPACLEAR.bit.GPIO20 = 1;
}

void LED_YellowOn(void)
{
    GpioDataRegs.GPASET.bit.GPIO21 = 1;
}

void LED_YellowOff(void)
{
    GpioDataRegs.GPACLEAR.bit.GPIO21 = 1;
}

void LED_GreenOn(void)
{
    GpioDataRegs.GPASET.bit.GPIO24 = 1;
}

void LED_GreenOff(void)
{
    GpioDataRegs.GPACLEAR.bit.GPIO24 = 1;
}

void LED_AllOff(void)
{
    GpioDataRegs.GPACLEAR.bit.GPIO20 = 1;
    GpioDataRegs.GPACLEAR.bit.GPIO21 = 1;
    GpioDataRegs.GPACLEAR.bit.GPIO24 = 1;
}
