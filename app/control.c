/*
 * control.c
 *
 * Open-loop manual frequency and a small 20 us PI placeholder for Stage 6.
 * The PI is intentionally small and heavily clamped; final coefficients and
 * direction must be confirmed on hardware.
 */

#include "DSP2803x_Device.h"
#include "llc_config.h"
#include "llc_globals.h"
#include "pwm.h"
#include "control.h"

#define CTRL_KP                  0.0005f   /* placeholder, tune on hardware */
#define CTRL_KI                  0.0001f   /* placeholder, tune on hardware */
#define CTRL_MAX_STEP_HZ         100.0f    /* per 20 us fast task */
#define CTRL_INTEGRAL_MAX        5000.0f

void CTRL_Init(void)
{
    g_pi_integral = 0.0f;
    g_pi_bias_frequency_hz = (float)LLC_DEFAULT_FREQUENCY_HZ;
    g_control_frequency_hz = LLC_DEFAULT_FREQUENCY_HZ;
    g_control_running = 0U;
}

void CTRL_Reset(void)
{
    g_pi_integral = 0.0f;
    g_control_running = 0U;
}

void CTRL_FastTask(void)
{
    if (g_system_state != SYS_STATE_RUN)
    {
        return;
    }
    if (g_pwm_enabled == 0U)
    {
        return;
    }

    /* Closed loop only from Stage 6 onward and only after calibration. */
    if (g_bringup_stage < BRINGUP_STAGE_6_CLOSED_LOOP)
    {
        g_control_running = 0U;
        return;
    }

#if LLC_CONTROL_DIRECTION == 0
    /* Direction is still unconfirmed; closed loop is locked. */
    return;
#else
    float error;
    float output;
    float step;
    Uint32 new_hz;

    if (g_vout_volts < 0.0f)
    {
        return;
    }

    g_control_running = 1U;

    error = g_voltage_reference - g_vout_volts;
    g_pi_integral += CTRL_KI * error;
    if (g_pi_integral >  CTRL_INTEGRAL_MAX) g_pi_integral =  CTRL_INTEGRAL_MAX;
    if (g_pi_integral < -CTRL_INTEGRAL_MAX) g_pi_integral = -CTRL_INTEGRAL_MAX;

    output = g_pi_bias_frequency_hz
           + (float)LLC_CONTROL_DIRECTION * (CTRL_KP * error + g_pi_integral);

    if (output < (float)g_power_run_min_frequency_hz)
    {
        output = (float)g_power_run_min_frequency_hz;
    }
    if (output > (float)LLC_HARD_MAX_HZ)
    {
        output = (float)LLC_HARD_MAX_HZ;
    }

    step = output - (float)g_control_frequency_hz;
    if (step >  CTRL_MAX_STEP_HZ) step =  CTRL_MAX_STEP_HZ;
    if (step < -CTRL_MAX_STEP_HZ) step = -CTRL_MAX_STEP_HZ;
    output = (float)g_control_frequency_hz + step;

    new_hz = (Uint32)output;
    if (new_hz < LLC_HARD_MIN_HZ) new_hz = LLC_HARD_MIN_HZ;
    if (new_hz > LLC_HARD_MAX_HZ) new_hz = LLC_HARD_MAX_HZ;

    if (LLC_SetFrequencyHz(new_hz) == 1U)
    {
        g_control_frequency_hz = new_hz;
    }
    else
    {
        g_fast_fault_count++;
    }
#endif
}

void CTRL_SlowTask(void)
{
    /* The old frequency-ramp soft-start is removed.
     * Stage 5B soft-start is owned exclusively by SoftStart Engine. */
}
