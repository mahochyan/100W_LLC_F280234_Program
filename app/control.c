/*
 * control.c
 *
 * STAGE6 offline control integration.
 *
 * Hardware-confirmed PFM control direction (Stage5A strict same-binary A/B):
 *   LLC_CONTROL_SIGN = -1   (HARDWARE_CONFIRMED_CONTROL_SIGN)
 *     error = Vref - Vout
 *       error > 0 (Vout < Vref) -> frequency command DECREASES
 *       error < 0 (Vout > Vref) -> frequency command INCREASES
 *
 * Controller / actuator split:
 *   - CTRL_ComputeFrequencyCommand() computes error / P / I / unsaturated /
 *     clamped / slew-limited command and stores it in shadow + teaching
 *     variables. It NEVER writes ePWM registers.
 *   - CTRL_ApplyFrequencyCommand() commits shadow -> g_control_frequency_hz
 *     and calls LLC_SetFrequencyHz() ONLY under #if LLC_HARDWARE_PI_VALIDATED.
 *     In Stage6 offline that macro is 0, so real PWM is never touched.
 *
 * Controller coefficients are PLACEHOLDER_NOT_HARDWARE_TUNED (Stage5A
 * confirmed only the direction; PFM_DIRECTION_GAIN_CHARACTERIZED = 0).
 */

#include "DSP2803x_Device.h"
#include "llc_config.h"
#include "llc_globals.h"
#include "pwm.h"
#include "control.h"

/* --- Controller coefficients: PLACEHOLDER_NOT_HARDWARE_TUNED --- */
#define CTRL_KP                  0.0005f   /* NOT hardware-tuned */
#define CTRL_KI                  0.0001f   /* NOT hardware-tuned */
#define CTRL_INTEGRAL_MAX        60000.0f  /* hard backstop; primary AW = conditional integration */

/* Slew limit: max frequency change per 20 us fast task (offline-validated). */
#define CTRL_MAX_STEP_HZ         100.0f    /* 100 Hz per 20 us */

/* Offline-only window (NOT_PRODUCTION_LIMIT). */
#define OFFLINE_MIN_HZ           ((float)OFFLINE_CONTROL_MIN_HZ)
#define OFFLINE_MAX_HZ           ((float)OFFLINE_CONTROL_MAX_HZ)

#define CTRL_OFFLINE_SELFTEST_ITERS  10000U  /* Case 8 register-isolation iterations */

static void CTRL_ResetRunState(void)
{
    g_control_running = 1U;
    g_control_frequency_hz = LLC_DEFAULT_FREQUENCY_HZ;
    g_control_shadow_frequency_hz = LLC_DEFAULT_FREQUENCY_HZ;
    g_pi_integral = 0.0f;
}

static Uint16 CTRL_SnapshotPwm(volatile Uint16 *buf)
{
    buf[0] = EPwm1Regs.TBPRD;
    buf[1] = EPwm1Regs.CMPA.half.CMPA;
    buf[2] = EPwm1Regs.CMPB;
    buf[3] = EPwm1Regs.DBRED;
    buf[4] = EPwm1Regs.DBFED;
    return 1U;
}

void CTRL_Init(void)
{
    g_pi_integral = 0.0f;
    g_pi_bias_frequency_hz = (float)LLC_DEFAULT_FREQUENCY_HZ;
    g_control_frequency_hz = LLC_DEFAULT_FREQUENCY_HZ;
    g_control_shadow_frequency_hz = LLC_DEFAULT_FREQUENCY_HZ;
    g_control_running = 0U;
    g_control_sample_valid = 0U;
    g_control_adc_stale_inhibit = 0U;
    g_control_integrator_frozen = 0U;
    g_control_saturated_high = 0U;
    g_control_saturated_low = 0U;
    g_offline_test_request = 0U;
    g_offline_test_status = 0U;
    g_offline_pwm_isolated = 0U;
}

void CTRL_Reset(void)
{
    g_pi_integral = 0.0f;
    g_control_running = 0U;
}

/*
 * Core controller step. Pure computation; does NOT write ePWM registers.
 *   sample_valid : ADC sample validity (1 = fresh). If 0, or the ADC stale
 *                  counter >= CTRL_ADC_STALE_LIMIT, both the integrator and
 *                  the command are frozen (CONTROL_ADC_STALE_INHIBIT).
 * Returns the new slewed command (also in g_control_shadow_frequency_hz).
 */
Uint32 CTRL_ComputeFrequencyCommand(Uint16 sample_valid, float vout_v)
{
    float error, p_term, i_term, unsat, clamped, step, out;
    Uint16 stale, sat_high, sat_low, freeze;
    Uint32 new_hz;

    stale = (Uint16)((sample_valid == 0U) ||
                     (g_adc_pwm_sync_consecutive_miss >= (Uint16)CTRL_ADC_STALE_LIMIT));
    g_control_sample_valid = sample_valid;
    g_control_adc_stale_inhibit = stale;

    g_control_vref_volts = g_voltage_reference;
    g_control_vout_volts = vout_v;

    if ((g_control_running == 0U) || (stale != 0U))
    {
        /* Not running, or stale ADC: full freeze (no integrator, no command
         * change). Satisfies CONTROL_ADC_STALE_INHIBIT. */
        g_control_error_volts = (g_control_running != 0U)
                                ? (g_voltage_reference - vout_v) : 0.0f;
        g_control_p_term_hz = 0.0f;
        g_control_i_term_hz = g_pi_integral;
        g_control_frequency_unsat_hz = (float)g_control_frequency_hz;
        g_control_frequency_clamped_hz = (float)g_control_frequency_hz;
        g_control_shadow_frequency_hz = g_control_frequency_hz;
        g_control_integrator_frozen = 1U;
        g_control_saturated_high = (g_control_frequency_hz >= (Uint32)OFFLINE_CONTROL_MAX_HZ);
        g_control_saturated_low  = (g_control_frequency_hz <= (Uint32)OFFLINE_CONTROL_MIN_HZ);
        return g_control_frequency_hz;
    }

    error = g_voltage_reference - vout_v;
    g_control_error_volts = error;

    p_term = CTRL_KP * error;
    g_control_p_term_hz = p_term;

    sat_high = (g_control_frequency_hz >= (Uint32)OFFLINE_CONTROL_MAX_HZ);
    sat_low  = (g_control_frequency_hz <= (Uint32)OFFLINE_CONTROL_MIN_HZ);
    g_control_saturated_high = sat_high;
    g_control_saturated_low  = sat_low;

    /* Conditional integration (anti-windup): stop integrating if the command
     * is already at a clamp and the error pushes further into saturation;
     * allow integration again when the error moves away from the bound. */
    freeze = 0U;
    if (sat_high && (error < 0.0f)) freeze = 1U;   /* at max, still wants up  */
    if (sat_low  && (error > 0.0f)) freeze = 1U;   /* at min, still wants down */
    g_control_integrator_frozen = freeze;

    if (freeze == 0U)
    {
        g_pi_integral += CTRL_KI * error;
        if (g_pi_integral >  CTRL_INTEGRAL_MAX) g_pi_integral =  CTRL_INTEGRAL_MAX;
        if (g_pi_integral < -CTRL_INTEGRAL_MAX) g_pi_integral = -CTRL_INTEGRAL_MAX;
    }
    i_term = g_pi_integral;
    g_control_i_term_hz = i_term;

    /* Unsaturated command (sign carries the hardware-confirmed direction). */
    unsat = g_pi_bias_frequency_hz + (float)LLC_CONTROL_SIGN * (p_term + i_term);
    g_control_frequency_unsat_hz = unsat;

    /* Clamp to offline window. */
    clamped = unsat;
    if (clamped < OFFLINE_MIN_HZ) clamped = OFFLINE_MIN_HZ;
    if (clamped > OFFLINE_MAX_HZ) clamped = OFFLINE_MAX_HZ;
    g_control_frequency_clamped_hz = clamped;

    /* Slew limit vs last committed command (no instantaneous jumps). */
    step = clamped - (float)g_control_frequency_hz;
    if (step >  CTRL_MAX_STEP_HZ) step =  CTRL_MAX_STEP_HZ;
    if (step < -CTRL_MAX_STEP_HZ) step = -CTRL_MAX_STEP_HZ;
    out = (float)g_control_frequency_hz + step;
    if (out < OFFLINE_MIN_HZ) out = OFFLINE_MIN_HZ;
    if (out > OFFLINE_MAX_HZ) out = OFFLINE_MAX_HZ;

    new_hz = (Uint32)out;
    g_control_shadow_frequency_hz = new_hz;
    return new_hz;
}

/*
 * Actuator. Commits the shadow command. Writes real PWM ONLY under
 * LLC_HARDWARE_PI_VALIDATED; otherwise shadow-only (Stage6 offline).
 */
void CTRL_ApplyFrequencyCommand(void)
{
    Uint32 target = g_control_shadow_frequency_hz;
    g_control_frequency_hz = target;
#if LLC_HARDWARE_PI_VALIDATED
    if (LLC_SetFrequencyHz(target) != 1U)
    {
        g_fast_fault_count++;
    }
#else
    /* Stage6 offline: write-gate locked (LLC_HARDWARE_PI_VALIDATED = 0).
     * No LLC_SetFrequencyHz() call; PWM registers untouched. */
    (void)target;
#endif
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
    if (g_bringup_stage < BRINGUP_STAGE_6_CLOSED_LOOP)
    {
        g_control_running = 0U;
        return;
    }
    if (g_vout_volts < 0.0f)
    {
        return;
    }

    g_control_running = 1U;
    CTRL_ComputeFrequencyCommand(g_adc_pwm_sync_valid, g_vout_volts);
    CTRL_ApplyFrequencyCommand();
}

void CTRL_SlowTask(void)
{
#if STAGE6_OFFLINE_SELFTEST
    /* Offline self-test trigger (no-energy, no PWM writes). */
    if (g_offline_test_request != 0U)
    {
        g_offline_test_request = 0U;
        CTRL_OfflineSelfTest();
    }
#endif
}

#if STAGE6_OFFLINE_SELFTEST
static void CTRL_RunSteps(float vout_v, Uint16 valid, Uint16 n)
{
    Uint16 k;
    for (k = 0U; k < n; k++)
    {
        CTRL_ComputeFrequencyCommand(valid, vout_v);
        CTRL_ApplyFrequencyCommand();
    }
}

/*
 * 8-case no-energy offline control self-test. Runs synchronously on the
 * controller core (Compute + Apply). Apply is shadow-only in Stage6 offline,
 * so ePWM registers must remain unchanged (Case 8 proves this). Result is a
 * bitmask in g_offline_test_status:
 *   0x01 Case1 PFM_SIGN_LOW_VOUT
 *   0x02 Case2 PFM_SIGN_HIGH_VOUT
 *   0x04 Case3 EQUAL_HOLDS
 *   0x08 Case4 LOWER_CLAMP + anti-windup
 *   0x10 Case5 UPPER_CLAMP + anti-windup
 *   0x20 Case6 ADC_STALE_FREEZE
 *   0x40 Case7 ADC_RECOVERY_NO_JUMP
 *   0x80 Case8 PWM_REGISTER_ISOLATION
 */
void CTRL_OfflineSelfTest(void)
{
    Uint16 pass = 0U;
    Uint32 init_freq, freq_before, single_step;

    /* Case 8 (register isolation) snapshot BEFORE. */
    CTRL_SnapshotPwm(g_offline_pwm_pre);

    /* Case 1: Vout < Vref -> error > 0 -> freq DOWN (SIGN=-1). */
    CTRL_ResetRunState();
    g_voltage_reference = 12.0f; g_vout_volts = 11.0f;
    init_freq = g_control_frequency_hz;
    CTRL_RunSteps(11.0f, 1U, 200);
    if ((g_control_error_volts > 0.0f) && (g_control_frequency_hz < init_freq)) pass |= 0x01U;

    /* Case 2: Vout > Vref -> error < 0 -> freq UP. */
    CTRL_ResetRunState();
    g_voltage_reference = 12.0f; g_vout_volts = 13.0f;
    init_freq = g_control_frequency_hz;
    CTRL_RunSteps(13.0f, 1U, 150);
    if ((g_control_error_volts < 0.0f) && (g_control_frequency_hz > init_freq)) pass |= 0x02U;

    /* Case 3: equal -> freq basically holds. */
    CTRL_ResetRunState();
    g_voltage_reference = 12.0f; g_vout_volts = 12.0f;
    init_freq = g_control_frequency_hz;
    CTRL_RunSteps(12.0f, 1U, 150);
    single_step = (init_freq > g_control_frequency_hz)
                  ? (init_freq - g_control_frequency_hz)
                  : (g_control_frequency_hz - init_freq);
    if (single_step < 500U) pass |= 0x04U;   /* EQUAL_HOLDS */

    /* Case 4: unsaturated command forced below floor via seeded integral ->
       command must hold at OFFLINE_CONTROL_MIN_HZ and the integrator must
       freeze (conditional-integration anti-windup). */
    CTRL_ResetRunState();
    g_voltage_reference = 12.0f; g_vout_volts = 8.0f;
    g_pi_integral = 50000.0f;   /* SIGN=-1: unsat = 150k - 50k = 100k < 120k */
    CTRL_RunSteps(8.0f, 1U, 400);
    if ((g_control_frequency_hz == (Uint32)OFFLINE_CONTROL_MIN_HZ) &&
        (g_control_saturated_low == 1U) && (g_control_integrator_frozen == 1U)) pass |= 0x08U;

    /* Case 5: unsaturated command forced above ceiling -> clamp at
       OFFLINE_CONTROL_MAX_HZ, integrator freezes. */
    CTRL_ResetRunState();
    g_voltage_reference = 12.0f; g_vout_volts = 16.0f;
    g_pi_integral = -50000.0f;  /* unsat = 150k + 50k = 200k > 180k */
    CTRL_RunSteps(16.0f, 1U, 400);
    if ((g_control_frequency_hz == (Uint32)OFFLINE_CONTROL_MAX_HZ) &&
        (g_control_saturated_high == 1U) && (g_control_integrator_frozen == 1U)) pass |= 0x10U;

    /* Case 6: ADC stale (sample invalid) -> freeze command + integrator. */
    CTRL_ResetRunState();
    g_voltage_reference = 12.0f; g_vout_volts = 11.0f;
    CTRL_RunSteps(11.0f, 1U, 5);
    freq_before = g_control_frequency_hz;
    CTRL_RunSteps(11.0f, 0U, 5);   /* sample invalid (stale) */
    if ((g_control_adc_stale_inhibit == 1U) && (g_control_integrator_frozen == 1U) &&
        (g_control_frequency_hz == freq_before)) pass |= 0x20U;

    /* Case 7: ADC recovers -> one step, no jump (slew-limited). */
    {
        Uint32 before = g_control_frequency_hz;
        CTRL_ComputeFrequencyCommand(1U, 11.0f);   /* sample valid again */
        CTRL_ApplyFrequencyCommand();
        single_step = (before > g_control_frequency_hz)
                      ? (before - g_control_frequency_hz)
                      : (g_control_frequency_hz - before);
        if ((g_control_adc_stale_inhibit == 0U) && (single_step <= (Uint32)CTRL_MAX_STEP_HZ))
            pass |= 0x40U;
    }

    /* Case 8: 10000 Compute+Apply; PWM registers must remain unchanged. */
    g_voltage_reference = 12.0f; g_vout_volts = 11.0f;
    CTRL_RunSteps(11.0f, 1U, CTRL_OFFLINE_SELFTEST_ITERS);
    CTRL_SnapshotPwm(g_offline_pwm_post);
    g_offline_pwm_isolated = 1U;
    {
        Uint16 q;
        for (q = 0U; q < 5U; q++)
        {
            if (g_offline_pwm_post[q] != g_offline_pwm_pre[q])
            {
                g_offline_pwm_isolated = 0U;
                break;
            }
        }
    }
    if (g_offline_pwm_isolated == 1U) pass |= 0x80U;

    g_offline_test_status = pass;
}
#endif /* STAGE6_OFFLINE_SELFTEST */
