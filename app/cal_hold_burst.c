/*
 * cal_hold_burst.c
 *
 * PROFILE_C_CAL_HOLD_BURST_V1 — see cal_hold_burst.h.
 *
 * Size-optimized for the 10KB-RAM F28034 bring-up image: statistics live in
 * one struct (single reset), the recharge packet writes the comparator DAC
 * directly (no arm-path calls), and the packet ISR skips IIR filtering (only
 * the fresh PWM-sync raw is needed for the 1400/1450 judgment).
 */

#include "DSP2803x_Device.h"
#include "DSP2803x_Examples.h"
#include "llc_config.h"
#include "llc_globals.h"
#include "pwm.h"
#include "adc.h"
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

    if (g_fault_flags != 0UL || g_system_state == SYS_STATE_FAULT)
    {
        CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_ACTIVE_TZ);
        return;
    }

    g_cal_hold_packet_cycles++;
    g_cal_hold_total_packet_cycles++;

    EALLOW;
    if (EPwm1Regs.ETFLG.bit.SOCA != 0U)
    {
        fresh = 1U;
        g_adc_vout_pwm_sync_raw = AdcResult.ADCRESULT0;
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

    if (fresh != 0U)
    {
        if (g_adc_vout_pwm_sync_raw >= CAL_HOLD_HARD_LIMIT_RAW)
        {
            CALHOLD_StopPacket(1U);
            return;
        }
        if (g_adc_vout_pwm_sync_raw >= CAL_HOLD_RECHARGE_TARGET_RAW)
        {
            CALHOLD_StopPacket(0U);
            return;
        }
    }

    if (g_cal_hold_packet_cycles >= CAL_HOLD_MAX_PACKET_CYCLES)
    {
        CALHOLD_StopPacket(0U);
    }
}

/* 20 us fast task. */
void CALHOLD_FastTask(void)
{
    Uint16 raw;
    Uint32 limit = (Uint32)g_cal_hold_duration_ms * 50UL;

    switch (g_cal_hold_state)
    {
        case CAL_HOLD_OFF:
        {
            g_cal_hold_elapsed_ticks++;
            g_cal_hold_hold_active_ticks++;
            g_cal_hold_off_ticks++;

            if ((g_cal_hold_elapsed_ticks & 1U) != 0U)
            {
                AdcRegs.ADCINTOVFCLR.all = 0xFFFFU;  /* stale-flag hygiene */
                ADC_SoftwareTrigger();          /* tick N: force SOC0 */
                g_cal_hold_dbg_force++;
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
                    g_cal_hold_dbg_eoc++;
                    AdcRegs.ADCINTFLGCLR.bit.ADCINT1 = 1U;
                }
                raw = (Uint16)AdcResult.ADCRESULT0;
                CALHOLD_RecordRaw(raw);

                if (raw >= CAL_HOLD_HARD_LIMIT_RAW)
                {
                    g_cal_hold_hard_limit_events++;
                    CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_HARD_LIMIT);
                    return;
                }
                if (g_cal_hold_hold_active_ticks > CAL_HOLD_UNDERSUPPLY_DELAY_TICKS &&
                    raw < CAL_HOLD_DIAG_LOW_ABORT_RAW)
                {
                    CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_UNDERSUPPLIED);
                    return;
                }

                /* Recharge: PWM off >= 40 us and VOUT <= 1380. */
                if (g_cal_hold_off_ticks >= CAL_HOLD_OFF_MIN_TICKS &&
                    raw <= CAL_HOLD_RECHARGE_LOW_RAW)
                {
                    if (g_cal_hold_total_packet_cycles >=
                        CAL_HOLD_MAX_TOTAL_PACKET_CYCLES_100MS)
                    {
                        CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_MAX_TOTAL_CYCLES);
                        return;
                    }

                    /* Fixed 250 kHz / DB110 packet start (never 150 kHz). */
                    ADC_SetPwmSyncTriggerMode();
                    ADC_UpdatePwmSyncPoint(239U);
                    EALLOW;
                    Comp1Regs.COMPCTL.all = 0U;
                    Comp1Regs.COMPCTL.bit.COMPSOURCE = 0U;
                    Comp1Regs.COMPCTL.bit.QUALSEL = 5U;
                    Comp1Regs.COMPCTL.bit.SYNCSEL = 0U;
                    Comp1Regs.COMPCTL.bit.CMPINV = 1U;
                    Comp1Regs.DACCTL.all = 0U;
                    Comp1Regs.DACVAL.bit.DACVAL = LLC_SINGLE_CYCLE_PROBE_DAC;
                    Comp1Regs.COMPCTL.bit.COMPDACEN = 1U;
                    GpioCtrlRegs.GPBMUX1.bit.GPIO42 = 3U;
                    EDIS;

                    if (PWM_PrepareStart(239UL, 110U, 1U) == 0U)
                    {
                        ADC_SetSoftwareTriggerMode();
                        g_cal_hold_off_ticks = 0UL;
                        return;
                    }
                    PWM_StartDeterministic();

                    EALLOW;
                    EPwm1Regs.ETSEL.bit.INTSEL = ET_CTR_ZERO;
                    EPwm1Regs.ETPS.bit.INTPRD  = ET_1ST;
                    EPwm1Regs.ETCLR.bit.INT    = 1U;
                    EPwm1Regs.ETSEL.bit.INTEN  = 1U;
                    EDIS;

                    g_cal_hold_state = CAL_HOLD_PACKET;
                    g_cal_hold_packet_active = 1U;
                    g_cal_hold_packet_cycles = 0U;
                    g_cal_hold_off_ticks = 0UL;
                }
            }

            if (g_cal_hold_elapsed_ticks >= limit)
            {
                CALHOLD_End(CAL_HOLD_COMPLETE, CAL_HOLD_REASON_COMPLETE);
            }
            break;
        }

        case CAL_HOLD_PACKET:
        {
            g_cal_hold_elapsed_ticks++;
            g_cal_hold_hold_active_ticks++;
            if (g_cal_hold_elapsed_ticks >= limit)
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
    if (g_cal_hold_request != 0U)
    {
        g_cal_hold_request = 0U;

        if (g_cal_hold_state != CAL_HOLD_IDLE ||
            (g_cal_hold_duration_ms != 100U && g_cal_hold_duration_ms != 1000U))
        {
            CALHOLD_End(CAL_HOLD_ABORT, CAL_HOLD_REASON_REJECTED);
            return;
        }

        /* CHARGE: reuse the PASSed Profile C up to 1400 raw. */
        g_cal_hold_state = CAL_HOLD_CHARGE;
        g_cal_hold_stop_reason = CAL_HOLD_REASON_NONE;
        g_cal_hold_run_id_at_arm = g_test_run_id;
        g_accel_vout_target_raw = CAL_HOLD_RECHARGE_TARGET_RAW;
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
                g_cal_hold_charge_stop_raw = g_accel_stop_raw;
                CALHOLD_StatsReset();
                g_cal_hold_hard_limit_events = 0U;
                g_cal_hold_elapsed_ticks = 0UL;
                g_cal_hold_hold_active_ticks = 0UL;
                g_cal_hold_off_ticks = CAL_HOLD_OFF_MIN_TICKS;
                CALHOLD_AdcPollMode(1U);
                ADC_SetSoftwareTriggerMode();   /* SOC0 TRIGSEL back to SW */
                g_cal_hold_state = CAL_HOLD_OFF;
                g_cal_hold_packet_active = 0U;
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
            CALHOLD_StatsPublish();
        }
    }
}

void CALHOLD_Init(void)
{
    g_cal_hold_state = CAL_HOLD_IDLE;
}
