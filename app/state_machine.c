/*
 * state_machine.c
 *
 * Implements Stage 0 -> 5A -> 5B -> 6 -> 7 gating.  Stage changes are
 * accepted only in IDLE, with PWM off, no fault, and only to the next stage.
 */

#include "DSP2803x_Device.h"
#include "llc_config.h"
#include "llc_globals.h"
#include "pwm.h"
#include "adc.h"
#include "control.h"
#include "protection.h"
#include "power_probe.h"
#include "soft_start.h"
#include "state_machine.h"

static Uint16 s_prev_enable_request = 0U;

void SM_Init(void)
{
    g_bringup_stage = BRINGUP_STAGE_0_SAFE;
    g_active_bringup_stage = BRINGUP_STAGE_0_SAFE;
    g_stage_confirmed_mask = (Uint16)(1U << BRINGUP_STAGE_0_SAFE);
    g_stage_confirm_request = 0U;

    g_pwm_enable_request = 0U;
    g_pwm_enable_result = 0U;
    g_pwm_enabled = 0U;
    g_switching_frequency_hz = 0UL;

    g_system_state = SYS_STATE_IDLE;

    s_prev_enable_request = 0U;
}

static Uint16 SM_StageAllowsFrequency(Uint32 hz)
{
    if (hz < LLC_HARD_MIN_HZ || hz > LLC_HARD_MAX_HZ)
    {
        return 0U;
    }
    if (g_bringup_stage == BRINGUP_STAGE_1_PWM_FIXED ||
        g_bringup_stage == BRINGUP_STAGE_4_PROTECTION_TEST)
    {
        return (hz == LLC_DEFAULT_FREQUENCY_HZ) ? 1U : 0U;
    }
    if (g_bringup_stage == BRINGUP_STAGE_2_PFM_MANUAL ||
        g_bringup_stage == BRINGUP_STAGE_3_ADC_MONITOR)
    {
        return (hz >= LLC_STAGE2_MIN_HZ && hz <= LLC_STAGE2_MAX_HZ) ? 1U : 0U;
    }
    if (g_bringup_stage == BRINGUP_STAGE_5A_OPEN_LOOP_MANUAL ||
        g_bringup_stage == BRINGUP_STAGE_5B_SOFT_START_TEST)
    {
        return (hz >= g_open_loop_min_frequency_hz && hz <= LLC_HARD_MAX_HZ) ? 1U : 0U;
    }
    if (g_bringup_stage >= BRINGUP_STAGE_6_CLOSED_LOOP)
    {
        return (hz >= g_power_run_min_frequency_hz && hz <= LLC_HARD_MAX_HZ) ? 1U : 0U;
    }
    return 0U;
}

static void SM_HandleStageConfirm(void)
{
    Uint16 req;

    if (g_stage_confirm_request == 0U) return;
    if (g_pwm_enable_request != 0U) return;
    if (g_pwm_enabled != 0U) return;
    if (g_system_state != SYS_STATE_IDLE) return;
    if (g_fault_flags != 0UL) return;

    req = g_stage_confirm_request;
    g_stage_confirm_request = 0U;

    if (req == (Uint16)(g_bringup_stage + 1U) &&
        req <= (Uint16)BRINGUP_STAGE_7_POWER_RUN)
    {
        /* Stage 5A is forbidden until the COMP1OUT->GPIO15/TZ1 loopback is
         * verified on the actual board. */
        if (req == (Uint16)BRINGUP_STAGE_5A_OPEN_LOOP_MANUAL &&
            g_comp_tz_loopback_verified == 0U)
        {
            PROT_RequestFault(FAULT_COMP_TZ_LOOPBACK, 0U);
            return;
        }

        g_bringup_stage = req;
        g_active_bringup_stage = req;
        g_stage_confirmed_mask |= (Uint16)(1U << req);
    }
    else
    {
        PROT_RequestFault(FAULT_ILLEGAL_STAGE, 0U);
    }
}

static void SM_HandleEnable(void)
{
    Uint32 freq;
    Uint16 current_request = g_pwm_enable_request;
    Uint16 rising_edge = (current_request != 0U && s_prev_enable_request == 0U);
    Uint16 falling_edge = (current_request == 0U && s_prev_enable_request != 0U);

    /* Update edge tracking before any return, so a rising edge is consumed
     * even if this call returns early. */
    s_prev_enable_request = current_request;

    if (rising_edge != 0U)
    {
        g_enable_rising_count++;

        if (g_system_state != SYS_STATE_IDLE || g_fault_flags != 0UL)
        {
            g_pwm_enable_result = 0U;
            return;
        }

        if (g_bringup_stage == BRINGUP_STAGE_0_SAFE)
        {
            g_pwm_enable_result = 0U;
            return;
        }

        if (g_bringup_stage == BRINGUP_STAGE_1_PWM_FIXED ||
            g_bringup_stage == BRINGUP_STAGE_4_PROTECTION_TEST)
        {
            freq = LLC_DEFAULT_FREQUENCY_HZ;
        }
        else if (g_bringup_stage == BRINGUP_STAGE_2_PFM_MANUAL ||
                 g_bringup_stage == BRINGUP_STAGE_3_ADC_MONITOR)
        {
            freq = g_switching_frequency_hz;
            if (freq == 0UL) freq = LLC_DEFAULT_FREQUENCY_HZ;
        }
        else if (g_bringup_stage == BRINGUP_STAGE_5A_OPEN_LOOP_MANUAL)
        {
            freq = g_open_loop_target_frequency_hz;
            if (freq == 0UL) freq = LLC_DEFAULT_FREQUENCY_HZ;
        }
        else if (g_bringup_stage == BRINGUP_STAGE_5B_SOFT_START_TEST)
        {
            if (g_softstart_autoramp_allowed != 0U)
            {
                freq = LLC_SOFTSTART_START_HZ;
            }
            else
            {
                freq = g_open_loop_target_frequency_hz;
                if (freq == 0UL) freq = LLC_DEFAULT_FREQUENCY_HZ;
            }
        }
        else /* Stage 6 / 7 */
        {
            freq = LLC_SOFTSTART_START_HZ;
        }

        if (SM_StageAllowsFrequency(freq) == 0U)
        {
            PROT_RequestFault(FAULT_ILLEGAL_FREQUENCY, 0U);
            g_pwm_enable_result = 0U;
            return;
        }

        /* Closed-loop / power-run pre-enable gates */
        if (g_bringup_stage >= BRINGUP_STAGE_6_CLOSED_LOOP)
        {
            if (g_vout_volts < 0.0f || g_iout_amps < 0.0f)
            {
                PROT_RequestFault(FAULT_CAL_MISSING, 0U);
                g_pwm_enable_result = 0U;
                return;
            }
            if (LLC_CONTROL_DIRECTION == 0)
            {
                PROT_RequestFault(FAULT_CONTROL_DIRECTION, 0U);
                g_pwm_enable_result = 0U;
                return;
            }
        }
        if (g_bringup_stage == BRINGUP_STAGE_7_POWER_RUN && LLC_POWER_RUN_ALLOWED == 0)
        {
            PROT_RequestFault(FAULT_STAGE_GATE, 0U);
            g_pwm_enable_result = 0U;
            return;
        }

        /* Stage 5B SoftStart uses the unified engine only. PWM stays OFF
         * during WAIT; SoftStart_Update5ms() performs deterministic start. */
        if (g_bringup_stage == BRINGUP_STAGE_5B_SOFT_START_TEST &&
            g_softstart_autoramp_allowed != 0U)
        {
            SoftStart_Begin();
            g_system_state = SYS_STATE_SOFT_START;
            g_pwm_enable_result = 1U;
            return;
        }

        if (LLC_SetFrequencyHz(freq) != 1U)
        {
            PROT_RequestFault(FAULT_ILLEGAL_FREQUENCY, 0U);
            g_pwm_enable_result = 0U;
            return;
        }

        /* Switch ADC to PWM-synchronous sampling from Stage 5 onward. */
        if (g_bringup_stage >= BRINGUP_STAGE_5A_OPEN_LOOP_MANUAL)
        {
            ADC_SetPwmSyncTriggerMode();
        }
        else
        {
            ADC_SetSoftwareTriggerMode();
        }

        g_switching_frequency_hz = freq;
        g_control_frequency_hz = freq;
        g_softstart_frequency_hz = freq;
        g_pi_bias_frequency_hz = (float)freq;
        CTRL_Reset();

        LLC_PWM_Enable();
        if (g_pwm_enabled != 0U)
        {
            g_pwm_enable_result = 1U;
            g_system_state = SYS_STATE_RUN;
        }
        else
        {
            g_pwm_enable_result = 0U;
        }
    }

    /* Falling edge of enable request -> normal inhibit */
    if (falling_edge != 0U)
    {
        LLC_PWM_DisableSafe();
        g_system_state = SYS_STATE_IDLE;
        g_pwm_enable_result = 0U;
        g_softstart_state = SOFTSTART_INIT;
    }
}


static void SM_HandleManualFrequency(void)
{
    if (g_pwm_enabled == 0U) return;

    /* Stage 2/3 are manual PFM stages: CCS may change g_switching_frequency_hz
     * while PWM is running. Apply it on the 5 ms slow task. */
    if (g_bringup_stage != BRINGUP_STAGE_2_PFM_MANUAL &&
        g_bringup_stage != BRINGUP_STAGE_3_ADC_MONITOR)
    {
        return;
    }

    if (g_switching_frequency_hz == g_control_frequency_hz)
    {
        return;
    }

    if (SM_StageAllowsFrequency(g_switching_frequency_hz) == 0U)
    {
        PROT_RequestFault(FAULT_ILLEGAL_FREQUENCY, 0U);
        return;
    }

    if (LLC_SetFrequencyHz(g_switching_frequency_hz) == 1U)
    {
        g_control_frequency_hz = g_switching_frequency_hz;
    }
    else
    {
        PROT_RequestFault(FAULT_ILLEGAL_FREQUENCY, 0U);
    }
}

void SM_Run(void)
{
    if (g_5ms_flag == 0U)
    {
        return;
    }
    g_5ms_flag = 0U;

    /* Absorb enable-request changes while in FAULT before the slow task may
     * clear the fault; otherwise a stale falling edge would re-inhibit right
     * after the explicit reset. */
    if (g_system_state == SYS_STATE_FAULT)
    {
        s_prev_enable_request = g_pwm_enable_request;
    }

    PROT_SlowTask();

    if (g_system_state == SYS_STATE_FAULT)
    {
        /* Only explicit reset can leave FAULT; handled inside PROT_SlowTask. */
        return;
    }

    SM_HandleStageConfirm();
    SM_HandleEnable();
    SM_HandleManualFrequency();

    /* Stage 4D one-shot power probe (only in Stage 4, IDLE, PWM OFF). */
    SINGLECYCLE_SlowTask();
    MULTICYCLE_SlowTask();
    POSTSTOP_SlowTask();

    /* Tutorial SoftStart Engine ramp (exactly one step per 5 ms). */
    SoftStart_Update5ms();

    /* Soft-start ramp is executed by CTRL_SlowTask (5 ms). */
    CTRL_SlowTask();
}
