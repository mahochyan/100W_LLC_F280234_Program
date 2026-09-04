/*
 * cal_hold_burst.c
 *
 * PROFILE_C_CAL_HOLD_BURST_V1 — see cal_hold_burst.h.
 *
 * Size-optimized for the 10KB-RAM F28034 bring-up image: statistics live in
 * one struct (single reset), each recharge packet reuses the proven comparator
 * settle/pre-start gate, and the packet ISR skips IIR filtering (only the
 * fresh PWM-sync raw is needed for its target/hard-limit judgment).
 */

#include "DSP2803x_Device.h"
#include "DSP2803x_Examples.h"
#include "llc_config.h"
#include "llc_globals.h"
#include "pwm.h"
#include "adc.h"
#include "comparator.h"
#include "cal_hold_burst.h"

/* Hold statistics packed so one struct write resets everything. */
typedef struct
{
    Uint16 raw;
    Uint16 min;
    Uint16 max;
    Uint32 sum;
    Uint32 samples;
    Uint16 steady_min;
    Uint16 steady_max;
    Uint32 steady_sum;
    Uint32 steady_samples;
    Uint32 packets;
    Uint32 total_cycles;
    Uint16 packet_min_cycles;
    Uint16 packet_max_cycles;
    Uint32 packet_cycles_sum;
} cal_hold_stats_t;

static cal_hold_stats_t s_stats;
static void CALHOLD_StatsPublish(void);
#pragma DATA_SECTION(s_cal_hold_mode, "ol_ram");
static Uint16 s_cal_hold_mode = CAL_HOLD_MODE_LEGACY_11V;
#pragma DATA_SECTION(s_w3_packet_write_auth, "ol_ram");
static Uint16 s_w3_packet_write_auth = 0U;

Uint16 CALHOLD_W3PacketAuthOk(void)
{
    return (s_w3_packet_write_auth != 0U &&
            (s_cal_hold_mode == CAL_HOLD_MODE_LEGACY_11V ||
             s_cal_hold_mode == CAL_HOLD_MODE_W3_10V) &&
            g_cal_hold_state == CAL_HOLD_OFF &&
            g_cal_hold_packet_active == 0U &&
            g_bringup_stage == BRINGUP_STAGE_5A_OPEN_LOOP_MANUAL &&
            g_system_state == SYS_STATE_IDLE &&
            g_pwm_enable_request == 0U &&
            g_comp_tz_loopback_verified != 0U &&
            g_comp_inject_test_armed != 0U &&
            g_comp_prestart_reject == 0U &&
            g_comp_prestart_gpio15 != 0U &&
            GpioDataRegs.GPADAT.bit.GPIO15 != 0U &&
            g_fault_flags == 0UL &&
            g_pwm_enabled == 0U &&
            EPwm1Regs.TZFLG.bit.OST != 0U) ? 1U : 0U;
}

static Uint16 CALHOLD_RechargeLowRaw(void)
{
    return (s_cal_hold_mode == CAL_HOLD_MODE_W3_10V)
        ? W3_HOLD_RECHARGE_LOW_RAW : CAL_HOLD_RECHARGE_LOW_RAW;
}

static Uint16 CALHOLD_RechargeTargetRaw(void)
{
    return (s_cal_hold_mode == CAL_HOLD_MODE_W3_10V)
        ? W3_HOLD_RECHARGE_TARGET_RAW : CAL_HOLD_RECHARGE_TARGET_RAW;
}

static Uint16 CALHOLD_HardLimitRaw(void)
{
    return (s_cal_hold_mode == CAL_HOLD_MODE_W3_10V)
        ? W3_HOLD_HARD_LIMIT_RAW : CAL_HOLD_HARD_LIMIT_RAW;
}

static Uint16 CALHOLD_DiagLowRaw(void)
{
    return (s_cal_hold_mode == CAL_HOLD_MODE_W3_10V)
        ? W3_HOLD_DIAG_LOW_ABORT_RAW : CAL_HOLD_DIAG_LOW_ABORT_RAW;
}

static Uint16 CALHOLD_MaxPacketCycles(void)
{
    return (s_cal_hold_mode == CAL_HOLD_MODE_W3_10V)
        ? W3_HOLD_MAX_PACKET_CYCLES : CAL_HOLD_MAX_PACKET_CYCLES;
}

static Uint16 CALHOLD_RequestValid(Uint16 mode, Uint16 duration)
{
    if (mode == CAL_HOLD_MODE_LEGACY_11V)
        return (duration == 100U || duration == 1000U) ? 1U : 0U;
    if (mode == CAL_HOLD_MODE_W3_10V)
        return (duration == W3_HOLD_DURATION_500MS ||
                duration == W3_HOLD_DURATION_2S ||
                duration == W3_HOLD_DURATION_10S ||
                duration == W3_HOLD_DURATION_60S) ? 1U : 0U;
    return 0U;
}

static Uint32 CALHOLD_CycleCap(void)
{
    if (s_cal_hold_mode == CAL_HOLD_MODE_W3_10V)
    {
        if (g_cal_hold_duration_ms == W3_HOLD_DURATION_500MS)
            return W3_HOLD_CYCLE_CAP_500MS;
        if (g_cal_hold_duration_ms == W3_HOLD_DURATION_2S)
            return W3_HOLD_CYCLE_CAP_2S;
        if (g_cal_hold_duration_ms == W3_HOLD_DURATION_10S)
            return W3_HOLD_CYCLE_CAP_10S;
        return W3_HOLD_CYCLE_CAP_60S;
    }
    if (g_cal_measure_active != 0U)
        return CAL_HOLD_MAX_TOTAL_PACKET_CYCLES_MEASURE;
    return (g_cal_hold_duration_ms == 1000U)
        ? CAL_HOLD_MAX_TOTAL_PACKET_CYCLES_1S
        : CAL_HOLD_MAX_TOTAL_PACKET_CYCLES_100MS;
}

static Uint16 CALHOLD_ReadOffRaw(void)
{
#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    if (g_no_energy_test_mode != 0U) return g_cal_hold_ne_raw;
#endif
    return (Uint16)AdcResult.ADCRESULT0;
}

static void CALHOLD_StatsReset(void)
{
    cal_hold_stats_t zero;
    zero.raw = 0U; zero.min = 0xFFFFU; zero.max = 0U;
    zero.sum = 0UL; zero.samples = 0UL;
    zero.steady_min = 0xFFFFU; zero.steady_max = 0U;
    zero.steady_sum = 0UL; zero.steady_samples = 0UL;
    zero.packets = 0UL; zero.total_cycles = 0UL;
    zero.packet_min_cycles = 0xFFFFU; zero.packet_max_cycles = 0U;
    zero.packet_cycles_sum = 0UL;
    s_stats = zero;
    g_cal_hold_undersupply_low_samples = 0U;
    g_cal_hold_packet_start_raw = 0U;
    g_cal_hold_packet_stop_raw = 0U;
    g_cal_hold_packet_post_max_raw = 0U;
    g_cal_hold_packet_post_last_raw = 0U;
    g_cal_hold_packet_actual_cycles = 0UL;
}

/* One shared hard-stop sequence (OST force + EPWM1 INT off). */
static void CALHOLD_HardStop(void)
{
    EALLOW;
    EPwm1Regs.TZEINT.bit.OST = 0U;
    EPwm1Regs.TZFRC.bit.OST = 1U;
    EPwm1Regs.ETSEL.bit.INTEN = 0U;
    EDIS;
}

/* OFF-phase software ADC uses flag polling; the ADCINT1 ISR must not steal
 * the EOC flag between the fast-task ticks. */
static void CALHOLD_AdcPollMode(Uint16 enable)
{
    EALLOW;
    AdcRegs.INTSEL1N2.bit.INT1E = (enable != 0U) ? 0U : 1U;
    EDIS;
}

static void CALHOLD_BeginOff(Uint16 charge_stop_raw)
{
    g_cal_hold_charge_stop_raw = charge_stop_raw;
    CALHOLD_StatsReset();
    CALHOLD_StatsPublish();
    g_cal_hold_hard_limit_events = 0U;
    g_cal_hold_elapsed_ticks = 0UL;
    g_cal_hold_hold_active_ticks = 0UL;
    g_cal_hold_off_ticks = CAL_HOLD_OFF_MIN_TICKS;
    g_cal_hold_cal_raw_min = 0xFFFFU;
    g_cal_hold_cal_raw_max = 0U;
    g_cal_hold_cal_raw_sum = 0UL;
    g_cal_hold_cal_raw_samples = 0UL;
    g_cal_hold_cal_raw_avg = 0U;
    CALHOLD_AdcPollMode(1U);
    ADC_SetSoftwareTriggerMode();
    g_cal_hold_state = CAL_HOLD_OFF;
    g_cal_hold_packet_active = 0U;
    g_pwm_enabled = 0U;
    g_pwm_enable_result = 0U;
}

/* Freeze final status + run-id chain. */
static void CALHOLD_FreezeFinal(void)
{
    g_cal_hold_final_pwm = g_pwm_enabled;
    g_cal_hold_final_ost = EPwm1Regs.TZFLG.bit.OST;
    g_cal_hold_run_id_at_stop = g_test_run_id;
    g_cal_hold_run_id_at_tz_isr = g_test_run_id_at_tz_isr;
}

/* Single terminal transition (COMPLETE or ABORT). */
static void CALHOLD_End(Uint16 state, Uint16 reason)
{
    if (g_cal_hold_state == CAL_HOLD_ABORT ||
        g_cal_hold_state == CAL_HOLD_COMPLETE) return;
    CALHOLD_HardStop();
    CALHOLD_AdcPollMode(0U);
    g_cal_measure_active = 0U;
    g_cal_hold_state = state;
    g_cal_hold_stop_reason = reason;
    CALHOLD_FreezeFinal();
}

/* Record one software-trigger VOUT sample (OFF phase). */
static void CALHOLD_RecordRaw(Uint16 raw)
{
    Uint32 elapsed_ms = g_cal_hold_elapsed_ticks / 50UL;

    s_stats.raw = raw;
    if (raw < s_stats.min) s_stats.min = raw;
    if (raw > s_stats.max) s_stats.max = raw;
    s_stats.sum += raw;
    s_stats.samples++;

    if (elapsed_ms >= CAL_HOLD_SETTLING_MS)
    {
        if (raw < s_stats.steady_min) s_stats.steady_min = raw;
        if (raw > s_stats.steady_max) s_stats.steady_max = raw;
        s_stats.steady_sum += raw;
        s_stats.steady_samples++;
    }

    /* Calibration window: 200ms..duration — the true ADC_HOLD_RAW source. */
    if (elapsed_ms >= CAL_HOLD_CAL_SETTLING_MS)
    {
        if (raw < g_cal_hold_cal_raw_min) g_cal_hold_cal_raw_min = raw;
        if (raw > g_cal_hold_cal_raw_max) g_cal_hold_cal_raw_max = raw;
        g_cal_hold_cal_raw_sum += raw;
        g_cal_hold_cal_raw_samples++;
    }

    g_cal_hold_raw = raw;
}

/* Publish statistics to the CCS-visible globals. */
static void CALHOLD_StatsPublish(void)
{
    g_cal_hold_min = s_stats.min;
    g_cal_hold_max = s_stats.max;
    g_cal_hold_sum = s_stats.sum;
    g_cal_hold_samples = s_stats.samples;
    g_cal_hold_steady_min = s_stats.steady_min;
    g_cal_hold_steady_max = s_stats.steady_max;
    g_cal_hold_steady_sum = s_stats.steady_sum;
    g_cal_hold_steady_samples = s_stats.steady_samples;
    g_cal_hold_packet_count = s_stats.packets;
    g_cal_hold_total_packet_cycles = s_stats.total_cycles;
    g_cal_hold_packet_min_cycles = s_stats.packet_min_cycles;
    g_cal_hold_packet_max_cycles = s_stats.packet_max_cycles;
    g_cal_hold_packet_cycles_sum = s_stats.packet_cycles_sum;
}

/* Recharge packet termination. */
static void CALHOLD_StopPacket(Uint16 hard_limit_flag)
{
    Uint16 cycles = g_cal_hold_packet_cycles;

    CALHOLD_HardStop();
    ADC_SetSoftwareTriggerMode();
    CALHOLD_AdcPollMode(1U);

    s_stats.packets++;
    s_stats.total_cycles += cycles;
    s_stats.packet_cycles_sum += cycles;
    if (cycles < s_stats.packet_min_cycles) s_stats.packet_min_cycles = cycles;
    if (cycles > s_stats.packet_max_cycles) s_stats.packet_max_cycles = cycles;
    g_cal_hold_packet_stop_raw = g_cal_hold_packet_post_last_raw;
    g_cal_hold_packet_actual_cycles = (Uint32)cycles;

    g_cal_hold_state = CAL_HOLD_OFF;
    g_cal_hold_packet_active = 0U;
    g_cal_hold_off_ticks = 0UL;
    g_pwm_enabled = 0U;          /* PWM hardware is off (OST latched) */
    g_pwm_enable_result = 0U;

    if (hard_limit_flag != 0U)
    {
        g_cal_hold_hard_limit_events++;
        CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_HARD_LIMIT);
    }
}

/* Per-cycle packet logic (EPWM1_INT_ISR). */
void CALHOLD_PacketIsr(void)
{
    Uint16 fresh = 0U;
    Uint16 raw = 0U;

    if (g_fault_flags != 0UL || g_system_state == SYS_STATE_FAULT)
    {
        CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_ACTIVE_TZ);
        return;
    }

    g_cal_hold_packet_cycles++;
    g_cal_hold_total_packet_cycles++;

#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    if (g_no_energy_test_mode != 0U)
    {
        fresh = 1U;
        raw = g_cal_hold_ne_raw;
        g_adc_vout_pwm_sync_raw = raw;
        g_adc_vout_raw = raw;
    }
    else
#endif
    {
    EALLOW;
    if (EPwm1Regs.ETFLG.bit.SOCA != 0U)
    {
        fresh = 1U;
        g_adc_vout_pwm_sync_raw = AdcResult.ADCRESULT0;
        raw = g_adc_vout_pwm_sync_raw;
        g_adc_vout_raw = g_adc_vout_pwm_sync_raw;
        g_adc_pwm_sync_soca_count++;
        g_adc_pwm_sync_eoc_count++;
        g_adc_sample_counter++;
        EPwm1Regs.ETCLR.bit.SOCA = 1U;
        AdcRegs.ADCINTFLGCLR.bit.ADCINT1 = 1U;
        AdcRegs.ADCINTOVFCLR.all = 0xFFFFU;
        g_adc_pwm_sync_valid = 1U;
        g_adc_pwm_sync_consecutive_miss = 0U;
    }
    EDIS;
    }

    if (fresh != 0U)
    {
        g_cal_hold_packet_post_last_raw = raw;
        if (raw > g_cal_hold_packet_post_max_raw)
            g_cal_hold_packet_post_max_raw = raw;
        if (raw >= CALHOLD_HardLimitRaw())
        {
            CALHOLD_StopPacket(1U);
            return;
        }
        if (raw >= CALHOLD_RechargeTargetRaw())
        {
            CALHOLD_StopPacket(0U);
            return;
        }
    }

    if (g_cal_hold_packet_cycles >= CALHOLD_MaxPacketCycles())
    {
        CALHOLD_StopPacket(0U);
    }
}

/* 20 us fast task. */
void CALHOLD_FastTask(void)
{
    Uint16 raw;
    Uint16 prepare_ok;
    Uint32 limit = 0UL;
    if (g_cal_hold_state == CAL_HOLD_IDLE) return;

#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    /* The NE 20 us Group-1 harness can starve lower-priority Group-3. Drive
     * the identical packet handler once per synthetic boundary; REAL compiles
     * this out and remains exclusively EPWM1 ISR driven. */
    if (g_no_energy_test_mode != 0U &&
        g_cal_hold_state == CAL_HOLD_PACKET &&
        g_cal_hold_packet_active != 0U)
    {
        CALHOLD_PacketIsr();
        return;
    }
#endif

    switch (g_cal_hold_state)
    {
        case CAL_HOLD_OFF:
        {
        limit = (Uint32)g_cal_hold_duration_ms * 50UL;
            g_cal_hold_elapsed_ticks++;
            g_cal_hold_hold_active_ticks++;
            g_cal_hold_off_ticks++;

            if ((g_cal_hold_elapsed_ticks & 1U) != 0U)
            {
                AdcRegs.ADCINTOVFCLR.all = 0xFFFFU;  /* stale-flag hygiene */
                ADC_SoftwareTrigger();          /* tick N: force SOC0 */
            }
            else
            {
                /* tick N+1: the conversion started 20 us ago is complete by
                 * construction (F2803x conversion is ~300 ns). Best-effort
                 * EOC confirmation: the ADCINT1 flag is cleared when set;
                 * the sample is taken regardless so the hold statistics never
                 * stall on the flag. */
                if (AdcRegs.ADCINTFLG.bit.ADCINT1 != 0U)
                {
                    AdcRegs.ADCINTFLGCLR.bit.ADCINT1 = 1U;
                }
                raw = CALHOLD_ReadOffRaw();
                CALHOLD_RecordRaw(raw);

                if (raw >= CALHOLD_HardLimitRaw())
                {
                    g_cal_hold_hard_limit_events++;
                    CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_HARD_LIMIT);
                    return;
                }
                if (raw >= CALHOLD_DiagLowRaw())
                {
                    g_cal_hold_undersupply_low_samples = 0U;
                }
                else if (g_cal_hold_hold_active_ticks >
                         CAL_HOLD_UNDERSUPPLY_DELAY_TICKS)
                {
                    /* A PWM-sync -> software-trigger transition can expose a
                     * single low OFF sample. Legacy semantics remain immediate;
                     * W3 requires consecutive below-floor evidence across
                     * bounded recharge attempts before declaring undersupply. */
                    if (s_cal_hold_mode == CAL_HOLD_MODE_W3_10V)
                    {
                        if (g_cal_hold_undersupply_low_samples <
                            W3_HOLD_UNDERSUPPLY_CONFIRM_SAMPLES)
                            g_cal_hold_undersupply_low_samples++;
                        if (g_cal_hold_undersupply_low_samples >=
                            W3_HOLD_UNDERSUPPLY_CONFIRM_SAMPLES)
                        {
                            CALHOLD_End(CAL_HOLD_ABORT,
                                        CAL_HOLD_REASON_UNDERSUPPLIED);
                            return;
                        }
                    }
                    else
                    {
                        CALHOLD_End(CAL_HOLD_ABORT,
                                    CAL_HOLD_REASON_UNDERSUPPLIED);
                        return;
                    }
                }

                /* Recharge: PWM off >= 40 us and VOUT <= 1380. */
                if (g_cal_hold_off_ticks >= CAL_HOLD_OFF_MIN_TICKS &&
                    raw <= CALHOLD_RechargeLowRaw())
                {
                    /* Energy cap is compile-time and not CCS-writable. The
                     * selected profile owns both its per-packet and aggregate
                     * limits; target/hard VOUT checks remain per-cycle. */
                    if (g_cal_hold_total_packet_cycles >= CALHOLD_CycleCap())
                    {
                        CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_MAX_TOTAL_CYCLES);
                        return;
                    }

                    /* Freeze existing CCS-visible packet telemetry without
                     * adding RAM; the per-cycle ISR updates last/max/stop. */
                    g_cal_hold_packet_start_raw = raw;
                    g_cal_hold_packet_stop_raw = raw;
                    g_cal_hold_packet_post_max_raw = raw;
                    g_cal_hold_packet_post_last_raw = raw;
                    g_cal_hold_packet_actual_cycles = 0UL;

                    /* Fixed 250 kHz / DB110 packet start (never 150 kHz). */
                    ADC_SetPwmSyncTriggerMode();
                    ADC_UpdatePwmSyncPoint(239U);
                    /* The historical direct register path released OST before
                     * the newly-written comparator/DAC had a settle + safe
                     * GPIO15 observation. Reuse the proven 2 us pre-start arm
                     * sequence on every cold packet and fail closed. */
                    g_comp1_dac_code = LLC_SINGLE_CYCLE_PROBE_DAC;
                    g_comp_polarity = 1U;
                    COMP_ArmForSingleCycleStart(LLC_SINGLE_CYCLE_PROBE_DAC);
                    if (g_comp_prestart_reject != 0U ||
                        g_comp_inject_test_armed == 0U ||
                        g_comp_prestart_gpio15 == 0U ||
                        GpioDataRegs.GPADAT.bit.GPIO15 == 0U)
                    {
                        ADC_SetSoftwareTriggerMode();
                        CALHOLD_End(CAL_HOLD_ABORT,
                                    CAL_HOLD_REASON_PRESTART_REJECT);
                        return;
                    }

                    s_w3_packet_write_auth = 1U;
                    prepare_ok = PWM_PrepareStart(239UL, 110U, 1U);
                    s_w3_packet_write_auth = 0U;
                    if (prepare_ok == 0U)
                    {
                        ADC_SetSoftwareTriggerMode();
                        CALHOLD_End(CAL_HOLD_ABORT,
                                    CAL_HOLD_REASON_PRESTART_REJECT);
                        return;
                    }
#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
                    if (g_no_energy_test_mode != 0U)
                    {
                        /* Logic-only packet: retain the mandatory OST clamp.
                         * The NE tick above drives the same state handler. */
                        g_pwm_start_prepared = 0U;
                        g_pwm_enabled = 0U;
                        g_pwm_enable_result = 0U;
                    }
                    else
#endif
                    PWM_StartDeterministic();

                    EALLOW;
                    EPwm1Regs.ETSEL.bit.INTSEL = ET_CTR_ZERO;
                    EPwm1Regs.ETPS.bit.INTPRD  = ET_1ST;
                    EPwm1Regs.ETCLR.bit.INT    = 1U;
#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
                    if (g_no_energy_test_mode != 0U)
                        EPwm1Regs.ETSEL.bit.INTEN = 0U;
                    else
#endif
                    EPwm1Regs.ETSEL.bit.INTEN  = 1U;
                    EDIS;

                    g_cal_hold_state = CAL_HOLD_PACKET;
                    g_cal_hold_packet_active = 1U;
                    g_cal_hold_packet_cycles = 0U;
                    g_cal_hold_off_ticks = 0UL;
                }
            }

            if (g_cal_measure_active != 0U)
            {
                /* Interactive DMM hold: no 1s auto-end. Stop on the operator
                 * completion flag or the 30s wall-clock timeout. */
                if (g_cal_measure_done != 0U ||
                    g_cal_hold_elapsed_ticks >=
                        (Uint32)(CAL_HOLD_MAX_DMM_HOLD_SECONDS * 1000UL * 50UL))
                {
                    CALHOLD_End(CAL_HOLD_COMPLETE, CAL_HOLD_REASON_COMPLETE);
                }
            }
            else if (g_cal_hold_elapsed_ticks >= limit)
            {
                CALHOLD_End(CAL_HOLD_COMPLETE, CAL_HOLD_REASON_COMPLETE);
            }
            break;
        }

        case CAL_HOLD_PACKET:
        {
        limit = (Uint32)g_cal_hold_duration_ms * 50UL;
            g_cal_hold_elapsed_ticks++;
            g_cal_hold_hold_active_ticks++;
            if (g_cal_measure_active != 0U)
            {
                if (g_cal_measure_done != 0U ||
                    g_cal_hold_elapsed_ticks >=
                        (Uint32)(CAL_HOLD_MAX_DMM_HOLD_SECONDS * 1000UL * 50UL))
                {
                    CALHOLD_StopPacket(0U);
                    CALHOLD_End(CAL_HOLD_COMPLETE, CAL_HOLD_REASON_COMPLETE);
                }
            }
            else if (g_cal_hold_elapsed_ticks >= limit)
            {
                CALHOLD_StopPacket(0U);
                CALHOLD_End(CAL_HOLD_COMPLETE, CAL_HOLD_REASON_COMPLETE);
            }
            break;
        }

        default:
            break;
    }
}

/* 5 ms slow task. */
void CALHOLD_SlowTask(void)
{
    if (g_cal_measure_request != 0U)
    {
        g_cal_measure_request = 0U;
        if (g_cal_hold_state != CAL_HOLD_IDLE)
        {
            CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_REJECTED);
            return;
        }
        /* Same PASSed Profile C charge + recharge hold, no 1s auto-end. */
        s_cal_hold_mode = CAL_HOLD_MODE_LEGACY_11V;
        g_cal_hold_mode_active = s_cal_hold_mode;
        g_cal_measure_active = 1U;
        g_cal_measure_done = 0U;
        g_cal_measure_ready = 0U;
        g_cal_hold_state = CAL_HOLD_CHARGE;
        g_cal_hold_stop_reason = CAL_HOLD_REASON_NONE;
        g_cal_hold_run_id_at_arm = g_test_run_id;
        g_accel_vout_target_raw = CAL_HOLD_RECHARGE_TARGET_RAW;
        g_accel_request = 1U;
        g_multi_cycle_probe_request = 1U;
        return;
    }

    if (g_cal_hold_request != 0U)
    {
        Uint16 requested_mode = g_cal_hold_mode_request;
        g_cal_hold_request = 0U;

        if (g_cal_hold_state != CAL_HOLD_IDLE ||
            CALHOLD_RequestValid(requested_mode, g_cal_hold_duration_ms) == 0U)
        {
            CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_REJECTED);
            return;
        }

        s_cal_hold_mode = requested_mode;
        g_cal_hold_mode_active = s_cal_hold_mode;
        /* CHARGE: legacy uses 1400 raw; W3 uses the already authorized 1200
         * raw Profile C target before entering the 10 V packet band. */
        g_cal_hold_state = CAL_HOLD_CHARGE;
        g_cal_hold_stop_reason = CAL_HOLD_REASON_NONE;
        g_cal_hold_run_id_at_arm = g_test_run_id;
        g_accel_vout_target_raw = (s_cal_hold_mode == CAL_HOLD_MODE_W3_10V)
            ? W3_HOLD_INITIAL_CHARGE_RAW : CAL_HOLD_RECHARGE_TARGET_RAW;
#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
        if (g_no_energy_test_mode != 0U && g_cal_hold_ne_bypass_charge != 0U)
        {
            CALHOLD_BeginOff(g_accel_vout_target_raw);
            return;
        }
#endif
        g_accel_request = 1U;
        g_multi_cycle_probe_request = 1U;
        return;
    }

    if (g_cal_hold_state == CAL_HOLD_CHARGE)
    {
        if (g_multi_cycle_probe_active != 0U) return;

        switch (g_accel_stop_reason)
        {
            case ACCEL_STOP_VOUT_TARGET:
                CALHOLD_BeginOff(g_accel_stop_raw);
                break;

            case ACCEL_STOP_HARD_LIMIT:
                CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_HARD_LIMIT);
                break;

            case ACCEL_STOP_TZ_TRIP:
                CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_ACTIVE_TZ);
                break;

            default:
                CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_CHARGE_NOT_REACHED);
                break;
        }
        return;
    }

    if (g_cal_hold_state == CAL_HOLD_OFF ||
        g_cal_hold_state == CAL_HOLD_PACKET)
    {
        if (g_fault_flags != 0UL || g_system_state == SYS_STATE_FAULT)
        {
            CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_ACTIVE_TZ);
        }
        else
        {
            static Uint16 s_last_avg = 0U;
            static Uint16 s_stable_streak = 0U;
            CALHOLD_StatsPublish();
            if (g_cal_hold_cal_raw_samples > 0UL)
                g_cal_hold_cal_raw_avg =
                    (Uint16)(g_cal_hold_cal_raw_sum / g_cal_hold_cal_raw_samples);

            /* DMM stability: after 500ms settling, a rolling average that
             * moves <=10 raw across 200ms marks DMM_MEASUREMENT_READY. */
            if (g_cal_measure_active != 0U &&
                g_cal_hold_elapsed_ticks >=
                    (Uint32)(CAL_HOLD_MEASURE_SETTLING_MS * 50UL))
            {
                Uint16 delta = (Uint16)((g_cal_hold_cal_raw_avg >= s_last_avg)
                    ? (g_cal_hold_cal_raw_avg - s_last_avg)
                    : (s_last_avg - g_cal_hold_cal_raw_avg));
                if (delta <= 10U)
                {
                    if (++s_stable_streak >=
                        (Uint16)(CAL_HOLD_MEASURE_STABLE_MS / 5U))
                    {
                        g_cal_measure_ready = 1U;
                    }
                }
                else
                {
                    s_stable_streak = 0U;
                }
                s_last_avg = g_cal_hold_cal_raw_avg;
            }
        }
    }

    /* Post-test zero/offset capture: PWM off, OST latched, VOUT discharged.
     * 64 software-triggered samples in the 5ms task (DELAY_US is allowed here;
     * the fast task never waits). */
    if (g_cal_hold_zero_request != 0U)
    {
        Uint16 zi;
        Uint32 zsum = 0UL;

        g_cal_hold_zero_request = 0U;
        g_cal_hold_zero_raw_min = 0xFFFFU;
        g_cal_hold_zero_raw_max = 0U;
        for (zi = 0U; zi < CAL_HOLD_ZERO_SAMPLES; zi++)
        {
            ADC_SoftwareTrigger();
            DELAY_US(20L);
            {
                Uint16 zr = (Uint16)AdcResult.ADCRESULT0;
                if (zr < g_cal_hold_zero_raw_min) g_cal_hold_zero_raw_min = zr;
                if (zr > g_cal_hold_zero_raw_max) g_cal_hold_zero_raw_max = zr;
                zsum += zr;
            }
        }
        g_cal_hold_zero_raw_avg = (Uint16)(zsum / CAL_HOLD_ZERO_SAMPLES);
    }
}

void CALHOLD_Init(void)
{
    CALHOLD_StatsReset();
    CALHOLD_StatsPublish();
    s_cal_hold_mode = CAL_HOLD_MODE_LEGACY_11V;
    s_w3_packet_write_auth = 0U;
    g_cal_hold_request = 0U;
    g_cal_hold_duration_ms = 100U;
    g_cal_measure_request = 0U;
    g_cal_measure_done = 0U;
    g_cal_measure_active = 0U;
    g_cal_hold_packet_active = 0U;
    g_cal_hold_stop_reason = CAL_HOLD_REASON_NONE;
    g_cal_hold_mode_request = CAL_HOLD_MODE_LEGACY_11V;
    g_cal_hold_mode_active = CAL_HOLD_MODE_LEGACY_11V;
#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
    g_cal_hold_ne_bypass_charge = 0U;
    g_cal_hold_ne_raw = 0U;
#endif
    g_cal_hold_state = CAL_HOLD_IDLE;
}
