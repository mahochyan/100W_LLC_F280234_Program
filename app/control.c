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
 * Controller coefficients are now the validated SIL shadow candidate
 * (STAGE6_PI_SIL_TUNING_V2_1 BALANCED) supplied by control_profile.h. They are
 * VIRTUAL_ONLY (CTRL_PI_PROFILE_VIRTUAL_ONLY=1); real PWM is still write-gated
 * by LLC_HARDWARE_PI_VALIDATED (kept 0).
 */

#include "DSP2803x_Device.h"
#include "llc_config.h"
#include "llc_globals.h"
#include "pwm.h"
#include "control.h"
#include "control_profile.h"
#include "board_calibration.h"

/* Cross-gate compile-time consistency (I): a profile that claims hardware
 * validation is incompatible with LLC_HARDWARE_PI_VALIDATED==0. A validated
 * candidate must NEVER auto-unlock hardware; the two gates are independent. */
#if CTRL_PI_PROFILE_HARDWARE_VALIDATED && !LLC_HARDWARE_PI_VALIDATED
#error "inconsistent PI validation gates: profile claims HW validation but LLC_HARDWARE_PI_VALIDATED=0"
#endif

/* --- Controller coefficients: from control_profile.h (BALANCED, VIRTUAL_ONLY) --- */
#define CTRL_KP                  CTRL_PI_KP_HZ_PER_V
#define CTRL_KI                  CTRL_PI_KI_STEP_HZ_PER_V_STEP
#define CTRL_INTEGRAL_MAX        60000.0f  /* hard backstop; primary AW = conditional integration */

/* Slew limit: max frequency change per 20 us fast task (offline-validated). */
#define CTRL_MAX_STEP_HZ         100.0f    /* 100 Hz per 20 us */

/* Offline-only window (NOT_PRODUCTION_LIMIT). */
#define OFFLINE_MIN_HZ           ((float)OFFLINE_CONTROL_MIN_HZ)
#define OFFLINE_MAX_HZ           ((float)OFFLINE_CONTROL_MAX_HZ)

/* ---- Q12 fixed-point fast controller (STAGE6_PI_FIXED_POINT_REALTIME_MIGRATION_V1)
 * Fast-ISR controller = 32-bit signed fixed-point Q12. No float/double/int64
 * in the fast path. KP/KI_RAW_Q12 derived in control_profile.h from the float
 * SIL profile times the board VOUT gain; enforced by
 * tools/check_control_fixed_profile_sync.py. */
#define CTRL_Q_SHIFT             12
#define CTRL_Q_ONE               ((int32)1 << CTRL_Q_SHIFT)               /* 4096      */
#define CTRL_KP_RAW_Q12          ((int32)CTRL_PI_KP_RAW_Q12)              /* 220587    */
#define CTRL_KI_RAW_Q12          ((int32)CTRL_PI_KI_RAW_Q12)              /* 1471      */
#define CTRL_BIAS_Q12            ((int32)150000 * CTRL_Q_ONE)             /* 614400000 */
#define CTRL_INTEGRAL_MAX_Q12    ((int32)60000  * CTRL_Q_ONE)             /* 245760000 */
#define CTRL_CLAMP_MIN_Q12       ((int32)OFFLINE_CONTROL_MIN_HZ * CTRL_Q_ONE)
#define CTRL_CLAMP_MAX_Q12       ((int32)OFFLINE_CONTROL_MAX_HZ * CTRL_Q_ONE)
#define CTRL_MAX_STEP_Q12        ((int32)100 * CTRL_Q_ONE)                /* 409600    */
#define CTRL_RAW_MIN             0U
#define CTRL_RAW_MAX             4095U

#define CTRL_OFFLINE_SELFTEST_ITERS  10000U  /* Case 8 register-isolation iterations */

/* Slow-path reference Volts->raw conversion (defined later; forward decl for Init). */
static Uint16 CTRL_VoltsToRaw(float v);

static void CTRL_ResetRunState(void)
{
    g_control_running = 1U;
    g_control_frequency_hz = LLC_DEFAULT_FREQUENCY_HZ;
    g_control_shadow_frequency_hz = LLC_DEFAULT_FREQUENCY_HZ;
    g_pi_integral = 0.0f;
    g_pi_integral_q12 = 0;
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
    g_pi_integral_q12 = 0;
    g_control_vref_raw = CTRL_VoltsToRaw(g_voltage_reference);
    g_control_vout_raw = 0U;
    g_control_error_raw = 0;
    g_control_p_term_q12 = 0;
    g_control_i_term_q12 = 0;
    g_control_unsat_q12 = CTRL_BIAS_Q12;
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
    /* STAGE6_REALTIME_CONTROL_INPUT_BINDING_CLOSURE_V1: input-binding state.
     * Reference is NOT valid until the slow task observes g_voltage_reference
     * > 0.5 V (so the init 0 V raw can never become a real RUN reference). */
    g_control_reference_valid = 0U;
    g_control_adc_sequence_last = 0U;
    g_control_adc_sequence_consumed = 0U;
    g_control_fresh_sample_count = 0UL;
    g_control_duplicate_sample_block_count = 0UL;
    g_control_stale_tick_count = 0UL;
    g_control_pi_update_count = 0UL;

    /* Teaching / observation: which PI profile is loaded (G). CCS Expressions
     * shows these directly. Values mirror control_profile.h. */
    g_control_pi_profile_id           = CTRL_PI_PROFILE_ID;            /* 0x060201 */
    g_control_kp_hz_per_v             = CTRL_PI_KP_HZ_PER_V;           /* 6657.43331 */
    g_control_ki_step_hz_per_v_step   = CTRL_PI_KI_STEP_HZ_PER_V_STEP; /* 44.3828888 */
    g_control_pi_virtual_only         = CTRL_PI_PROFILE_VIRTUAL_ONLY;  /* 1 */
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
Uint32 CTRL_ComputeFrequencyCommandFloat(Uint16 sample_valid, float vout_v)
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
 * Slow-path only: reference Volts -> raw ADC sample. Uses float (never in
 * the fast ISR). ref_raw = round((v - BOARD_VOUT_OFFSET_V)/BOARD_VOUT_GAIN).*/
static Uint16 CTRL_VoltsToRaw(float v)
{
    float r = (v - BOARD_VOUT_OFFSET_V) / BOARD_VOUT_GAIN_V_PER_RAW;
    if (r < (float)CTRL_RAW_MIN) r = (float)CTRL_RAW_MIN;
    if (r > (float)CTRL_RAW_MAX) r = (float)CTRL_RAW_MAX;
    return (Uint16)(r + 0.5f);
}

/*
 * Q12 fixed-point fast controller (STAGE6_PI_FIXED_POINT_REALTIME_MIGRATION_V1).
 * Same logic as the validated float BALANCED PI, but 32-bit signed int Q12
 * and NO float/double/int64 anywhere in this function. Controller-only:
 * writes shadow command + integer telemetry; never ePWM registers. Teaching
 * floats are updated by CTRL_UpdateTelemetrySlow() (5 ms), not here.
 */
Uint32 CTRL_ComputeFrequencyCommand(Uint16 sample_valid, Uint16 vout_raw)
{
    int32 error, p_q12, i_q12, unsat_q12, step_q12, out_q12, base_q12;
    Uint16 stale, sat_high, sat_low, freeze;
    Uint32 new_hz;

    stale = (Uint16)((sample_valid == 0U) ||
                     (g_adc_pwm_sync_consecutive_miss >= (Uint16)CTRL_ADC_STALE_LIMIT));
    g_control_sample_valid = sample_valid;
    g_control_adc_stale_inhibit = stale;
    g_control_vout_raw = vout_raw;

    if ((g_control_running == 0U) || (stale != 0U))
{
        g_control_error_raw = 0;
        g_control_p_term_q12 = 0;
        g_control_i_term_q12 = g_pi_integral_q12;
        g_control_unsat_q12 = CTRL_BIAS_Q12;
        g_control_shadow_frequency_hz = g_control_frequency_hz;
        g_control_integrator_frozen = 1U;
        g_control_saturated_high = (g_control_frequency_hz >= (Uint32)OFFLINE_CONTROL_MAX_HZ);
        g_control_saturated_low  = (g_control_frequency_hz <= (Uint32)OFFLINE_CONTROL_MIN_HZ);
        return g_control_frequency_hz;
}

    error = (int32)g_control_vref_raw - (int32)vout_raw;   /* [-4095,4095] */
    g_control_error_raw = (int16)error;

    p_q12 = CTRL_KP_RAW_Q12 * error;                       /* [-903303765,903303765] */
    g_control_p_term_q12 = p_q12;

    sat_high = (g_control_frequency_hz >= (Uint32)OFFLINE_CONTROL_MAX_HZ);
    sat_low  = (g_control_frequency_hz <= (Uint32)OFFLINE_CONTROL_MIN_HZ);
    g_control_saturated_high = sat_high;
    g_control_saturated_low  = sat_low;

    freeze = 0U;
    if (sat_high && (error < 0)) freeze = 1U;
    if (sat_low  && (error > 0)) freeze = 1U;
    g_control_integrator_frozen = freeze;

    if (freeze == 0U)
{
        g_pi_integral_q12 += CTRL_KI_RAW_Q12 * error;
        if (g_pi_integral_q12 >  CTRL_INTEGRAL_MAX_Q12) g_pi_integral_q12 =  CTRL_INTEGRAL_MAX_Q12;
        if (g_pi_integral_q12 < -CTRL_INTEGRAL_MAX_Q12) g_pi_integral_q12 = -CTRL_INTEGRAL_MAX_Q12;
    }
    i_q12 = g_pi_integral_q12;
    g_control_i_term_q12 = i_q12;

    unsat_q12 = CTRL_BIAS_Q12 + (int32)LLC_CONTROL_SIGN * (p_q12 + i_q12);
    g_control_unsat_q12 = unsat_q12;

    if (unsat_q12 < CTRL_CLAMP_MIN_Q12) unsat_q12 = CTRL_CLAMP_MIN_Q12;
    if (unsat_q12 > CTRL_CLAMP_MAX_Q12) unsat_q12 = CTRL_CLAMP_MAX_Q12;

    base_q12 = (int32)g_control_frequency_hz << CTRL_Q_SHIFT;
    step_q12 = unsat_q12 - base_q12;
    if (step_q12 >  CTRL_MAX_STEP_Q12) step_q12 =  CTRL_MAX_STEP_Q12;
    if (step_q12 < -CTRL_MAX_STEP_Q12) step_q12 = -CTRL_MAX_STEP_Q12;
    out_q12 = base_q12 + step_q12;
    if (out_q12 < CTRL_CLAMP_MIN_Q12) out_q12 = CTRL_CLAMP_MIN_Q12;
    if (out_q12 > CTRL_CLAMP_MAX_Q12) out_q12 = CTRL_CLAMP_MAX_Q12;

    new_hz = (Uint32)(out_q12 >> CTRL_Q_SHIFT);
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
#if STAGE6_REAL_ACTUATOR_OST_TEST
    /* Test override: the harness may command an exact frequency through the
     * real actuator path for the mapping / dynamic-cadence tests. 0 = use the
     * Q12 PI shadow command. */
    if (g_stage6_actuator_direct_cmd_hz != 0UL)
        target = g_stage6_actuator_direct_cmd_hz;
#endif
    g_control_frequency_hz = target;
#if LLC_HARDWARE_PI_VALIDATED
    if (LLC_SetFrequencyHz(target) != 1U)
    {
        g_fast_fault_count++;
    }
#elif STAGE6_REAL_ACTUATOR_OST_TEST
    /* STAGE6_REAL_ACTUATOR_OST_TEST: first real PWM actuator validation under
     * an OST lock. The PI/shadow command is written to the REAL ePWM time-base
     * (LLC_SetFrequencyHz -> TBPRD/CMPA/CMPB) ONLY while all of:
     *   - the one-shot trip (TZFLG.OST) is latched  -> outputs in safe TZ state
     *   - the harness has armed the reference after confirming OST=1 and
     *     AQCSFRC force-LOW (no effective PWM output)
     *   - a trip has NOT revoked actuator permission
     * LLC_HARDWARE_PI_VALIDATED stays 0 (independent gate). Any single
     * condition false -> NO PWM write. */
    if (g_stage6_actuator_test_arm != 0U &&
        g_stage6_actuator_revoked == 0U &&
        EPwm1Regs.TZFLG.bit.OST != 0U)
    {
        Uint32 t_ae = (Uint32)CpuTimer2Regs.TIM.all;
        if (LLC_SetFrequencyHz(target) == 1U)
        {
            Uint32 t_ax = (Uint32)CpuTimer2Regs.TIM.all;
            g_stage6_actuator_write_count++;
            g_stage6_actuator_cycles_last = t_ae - t_ax;
            if (g_stage6_actuator_cycles_last > g_stage6_actuator_cycles_max)
                g_stage6_actuator_cycles_max = g_stage6_actuator_cycles_last;
            g_stage6_actuator_cycles_sum += g_stage6_actuator_cycles_last;
            g_stage6_actuator_cycles_count++;
        }
    }
#else
    /* Stage6 offline: write-gate locked (LLC_HARDWARE_PI_VALIDATED = 0).
     * No LLC_SetFrequencyHz() call; PWM registers untouched. */
    (void)target;
#endif
}

/*
 * STAGE6_REALTIME_CONTROL_INPUT_BINDING_CLOSURE_V1 - production fast control
 * body (integer-only): NEW-sample freshness selection, single consumption of
 * the LATEST ADC sample, and PI entry. Called by CTRL_FastTask after the
 * stage/PWM/reference gates, and by the no-energy production-binding hook.
 * Reads g_adc_sample_sequence for NEW-SAMPLE freshness and consumes
 * g_adc_vout_filtered_raw (latest) exactly once per fresh sequence.
 */
void CTRL_RunFastControl(void)
{
    Uint32 fresh_seq;    Uint16 sample_valid, vout_raw;

    fresh_seq = g_adc_sample_sequence;
    if (fresh_seq == g_control_adc_sequence_last)
    {
        g_control_duplicate_sample_block_count++;
        g_control_stale_tick_count++;
        sample_valid = 0U;
        vout_raw = g_control_vout_raw;   /* hold last consumed */
    }
    else
    {
        g_control_adc_sequence_last = fresh_seq;
        g_control_adc_sequence_consumed = fresh_seq;
        g_control_fresh_sample_count++;
        g_control_pi_update_count++;
        sample_valid = 1U;
        vout_raw = g_adc_vout_filtered_raw;  /* latest, consumed once */
    }
    g_control_sample_valid = sample_valid;

    CTRL_ComputeFrequencyCommand(sample_valid, vout_raw);
    CTRL_ApplyFrequencyCommand();

#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    /* STAGE6 handoff: capture the FIRST post-handoff fresh closed-loop sample
     * and the resulting command for the bumpless gate (FIRST_CLOSED_LOOP_
     * SAMPLE_BUMPLESS_PASS). Only the first fresh sample is recorded. */
    if (g_stage6_first_pi_observed == 0U && sample_valid != 0U)
    {
        g_stage6_first_pi_observed = 1U;
        g_stage6_first_pi_sample_raw = vout_raw;
        g_stage6_first_pi_freq_hz = g_control_shadow_frequency_hz;
    }
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
    if (g_control_reference_valid == 0U)
    {
        return;   /* no valid Vref yet -> no PI */
    }

    g_control_running = 1U;
    CTRL_RunFastControl();
}

void CTRL_UpdateTelemetrySlow(void)
{
    /* Slow-task (5 ms) conversion of raw/Q12 state to float Volts/Hz for CCS.
     * Never called from the fast ISR. */
    g_control_vref_volts = BOARD_VOUT_GAIN_V_PER_RAW * (float)g_control_vref_raw + BOARD_VOUT_OFFSET_V;
    g_control_vout_volts = BOARD_VOUT_GAIN_V_PER_RAW * (float)g_control_vout_raw + BOARD_VOUT_OFFSET_V;
    g_control_error_volts = g_control_vref_volts - g_control_vout_volts;
    g_control_p_term_hz = (float)g_control_p_term_q12 / (float)CTRL_Q_ONE;
    g_control_i_term_hz = (float)g_control_i_term_q12 / (float)CTRL_Q_ONE;
    g_control_frequency_unsat_hz = (float)g_control_unsat_q12 / (float)CTRL_Q_ONE;
    g_control_frequency_clamped_hz = (float)g_control_shadow_frequency_hz;
    g_pi_integral = (float)g_pi_integral_q12 / (float)CTRL_Q_ONE;
    g_pi_bias_frequency_hz = (float)LLC_DEFAULT_FREQUENCY_HZ;
}

void CTRL_SlowTask(void)
{
    /* Reference engineering value -> raw (slow path, float allowed).
     * Only ever sourced from g_voltage_reference; the production conversion
     * path (CTRL_VoltsToRaw) is the one under test. Gate PI on validity. */
    g_control_reference_valid = (g_voltage_reference > 0.5f) ? 1U : 0U;
    if (g_control_reference_valid != 0U)
    {
        g_control_vref_raw = CTRL_VoltsToRaw(g_voltage_reference);
    }
    /* Telemetry AFTER reference/data sync. g_control_vout_raw holds the last
     * sample the fast PI consumed (owned by the fast path). */
    CTRL_UpdateTelemetrySlow();
#if STAGE6_OFFLINE_SELFTEST
    /* Offline self-test trigger (no-energy, no PWM writes). */
    if (g_offline_test_request != 0U)
    {
        g_offline_test_request = 0U;
        CTRL_OfflineSelfTest();
    }
#endif
#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    /* STAGE6 no-energy on-target: one-shot single PI step (first-step / stale).
     * Runs in the slow task so the ISR path is untouched by test orchestration.
     * mode 3 == stale-run (sample_valid=0); else sample_valid=1. */
    if (g_stage6_noenergy_step_req != 0U)
    {
        Uint16 valid;
        Uint32 hz;
        g_stage6_noenergy_step_req = 0U;
        valid = (g_stage6_noenergy_test_mode == 3U) ? 0U : 1U;
        g_control_running = 1U;
        g_control_vref_raw = CTRL_VoltsToRaw(g_voltage_reference);
        hz = CTRL_ComputeFrequencyCommand(valid, g_stage6_synthetic_vout_raw);
        CTRL_ApplyFrequencyCommand();
        g_stage6_noenergy_step_shadow_hz = hz;
        g_stage6_noenergy_step_integral_hz = (float)g_pi_integral_q12 / (float)CTRL_Q_ONE;
    }
#endif
}

#if STAGE6_OFFLINE_SELFTEST
static void CTRL_RunSteps(Uint16 vout_raw, Uint16 valid, Uint16 n)
{
    Uint16 k;
    for (k = 0U; k < n; k++)
    {
        CTRL_ComputeFrequencyCommand(valid, vout_raw);
        CTRL_ApplyFrequencyCommand();
    }
}

/*
 * 8-case no-energy offline control self-test, now driven by the fixed-point
 * Q12 controller core (CTRL_ComputeFrequencyCommand raw). Raw VOUT samples are
 * derived from the real-board calibration (CTRL_VoltsToRaw), never hard-coded.
 * Result bitmask in g_offline_test_status (0x01..0x80).
 */
void CTRL_OfflineSelfTest(void)
{
    Uint16 pass = 0U;
    Uint32 init_freq, freq_before, single_step;

    CTRL_SnapshotPwm(g_offline_pwm_pre);

    /* Case 1: Vout(11V) < Vref(12V) -> error>0 -> freq DOWN (SIGN=-1). */
    CTRL_ResetRunState();
    g_control_vref_raw = CTRL_VoltsToRaw(12.0f);
    init_freq = g_control_frequency_hz;
    CTRL_RunSteps(CTRL_VoltsToRaw(11.0f), 1U, 200);
    if ((g_control_error_raw > 0) && (g_control_frequency_hz < init_freq)) pass |= 0x01U;

    /* Case 2: Vout(13V) > Vref -> error<0 -> freq UP. */
    CTRL_ResetRunState();
    g_control_vref_raw = CTRL_VoltsToRaw(12.0f);
    init_freq = g_control_frequency_hz;
    CTRL_RunSteps(CTRL_VoltsToRaw(13.0f), 1U, 150);
    if ((g_control_error_raw < 0) && (g_control_frequency_hz > init_freq)) pass |= 0x02U;

    /* Case 3: equal -> freq holds. */
    CTRL_ResetRunState();
    g_control_vref_raw = CTRL_VoltsToRaw(12.0f);
    init_freq = g_control_frequency_hz;
    CTRL_RunSteps(CTRL_VoltsToRaw(12.0f), 1U, 150);
    single_step = (init_freq > g_control_frequency_hz)
                  ? (init_freq - g_control_frequency_hz)
                  : (g_control_frequency_hz - init_freq);
    if (single_step < 500U) pass |= 0x04U;

    /* Case 4: seeded integral -> below floor, hold min + anti-windup freeze. */
    CTRL_ResetRunState();
    g_control_vref_raw = CTRL_VoltsToRaw(12.0f);
    g_pi_integral_q12 = (int32)(50000 * CTRL_Q_ONE);
    CTRL_RunSteps(CTRL_VoltsToRaw(8.0f), 1U, 400);
    if ((g_control_frequency_hz == (Uint32)OFFLINE_CONTROL_MIN_HZ) &&
        (g_control_saturated_low == 1U) && (g_control_integrator_frozen == 1U)) pass |= 0x08U;

    /* Case 5: seeded integral -> above ceiling, clamp max + freeze. */
    CTRL_ResetRunState();
    g_control_vref_raw = CTRL_VoltsToRaw(12.0f);
    g_pi_integral_q12 = (int32)(-50000 * CTRL_Q_ONE);
    CTRL_RunSteps(CTRL_VoltsToRaw(16.0f), 1U, 400);
    if ((g_control_frequency_hz == (Uint32)OFFLINE_CONTROL_MAX_HZ) &&
        (g_control_saturated_high == 1U) && (g_control_integrator_frozen == 1U)) pass |= 0x10U;

    /* Case 6: ADC stale -> freeze command + integrator. */
    CTRL_ResetRunState();
    g_control_vref_raw = CTRL_VoltsToRaw(12.0f);
    CTRL_RunSteps(CTRL_VoltsToRaw(11.0f), 1U, 5);
    freq_before = g_control_frequency_hz;
    CTRL_RunSteps(CTRL_VoltsToRaw(11.0f), 0U, 5);
    if ((g_control_adc_stale_inhibit == 1U) && (g_control_integrator_frozen == 1U) &&
        (g_control_frequency_hz == freq_before)) pass |= 0x20U;

    /* Case 7: ADC recovers -> one step, slew-limited. */
    {
        Uint32 before = g_control_frequency_hz;
        CTRL_ComputeFrequencyCommand(1U, CTRL_VoltsToRaw(11.0f));
        CTRL_ApplyFrequencyCommand();
        single_step = (before > g_control_frequency_hz)
                      ? (before - g_control_frequency_hz)
                      : (g_control_frequency_hz - before);
        if ((g_control_adc_stale_inhibit == 0U) && (single_step <= (Uint32)CTRL_MAX_STEP_HZ))
            pass |= 0x40U;
    }

    /* Case 8: 10000 Compute+Apply; PWM registers unchanged. */
    g_control_vref_raw = CTRL_VoltsToRaw(12.0f);
    CTRL_RunSteps(CTRL_VoltsToRaw(11.0f), 1U, CTRL_OFFLINE_SELFTEST_ITERS);
    CTRL_SnapshotPwm(g_offline_pwm_post);
    g_offline_pwm_isolated = 1U;
    {
        Uint16 q;
        for (q = 0U; q < 5U; q++)
        {
            if (g_offline_pwm_post[q] != g_offline_pwm_pre[q])
            {
                g_offline_pwm_isolated = 0U;
    /* STAGE6_REALTIME_CONTROL_INPUT_BINDING_CLOSURE_V1: input-binding state.
     * Reference is NOT valid until the slow task observes g_voltage_reference
     * > 0.5 V (so the init 0 V raw can never become a real RUN reference). */
    g_control_reference_valid = 0U;
    g_control_adc_sequence_last = 0U;
    g_control_adc_sequence_consumed = 0U;
    g_control_fresh_sample_count = 0UL;
    g_control_duplicate_sample_block_count = 0UL;
    g_control_stale_tick_count = 0UL;
    g_control_pi_update_count = 0UL;
                break;
            }
        }
    }
    if (g_offline_pwm_isolated == 1U) pass |= 0x80U;

    g_offline_test_status = pass;
}
#endif /* STAGE6_OFFLINE_SELFTEST */










