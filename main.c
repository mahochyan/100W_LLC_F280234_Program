/*
 * main.c
 *
 * F28034 LLC bring-up: safe startup, then delegate to APP_Init/APP_Run.
 */

#include "DSP2803x_Device.h"
#include "DSP2803x_GlobalPrototypes.h"
#include "system.h"
#include "gpio.h"
#include "app.h"

void main(void)
{
    Uint16 system_init_ok;

    system_init_ok = System_Init();
    GPIO_Init();

    if (system_init_ok == SYSTEM_INIT_FAILED)
    {
        LED_AllOff();
        LED_RedOn();
        while (1)
        {
        }
    }

    LED_AllOff();
    LED_GreenOn();

    APP_Init();
    APP_Run();
}
