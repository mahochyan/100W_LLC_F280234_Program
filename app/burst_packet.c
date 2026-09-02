/* W2_BURST_PACKET_CHARACTERIZATION_V1 - packet request layer.
 *
 * The actual cycle-accurate PWM packet is executed by the existing MULTICYCLE
 * probe engine (ePWM1 period ISR counts completed periods and forces OST from
 * inside the ISR). This module only validates/arms/records. It is compiled in
 * both REAL and NE builds; the REAL path is inert until a request is set and
 * the user explicitly starts the shoot.
 */

#include "DSP2803x_Device.h"
#include "DSP2803x_Examples.h"
#include "llc_config.h"
#include "llc_globals.h"
#include "pwm.h"
#include "comparator.h"
#include "power_probe.h"
#include "burst_packet.h"

/* All packet record state is placed in the dedicated UNINITIALIZED "ol_ram"
 * section (same convention as open_loop_steady / burst_region). BURSTPACKET_
 * Init explicitly resets every variable; SlowTask lazily boots once. */
#pragma DATA_SECTION(g_burst_packet_request,        "ol_ram");
#pragma DATA_SECTION(g_burst_packet_cycles,         "ol_ram");
#pragma DATA_SECTION(g_burst_packet_result,         "ol_ram");
#pragma DATA_SECTION(g_burst_packet_stop_reason,    "ol_ram");
#pragma DATA_SECTION(g_burst_packet_completed_cycles,"ol_ram");
#pragma DATA_SECTION(g_burst_packet_vout_before,    "ol_ram");
#pragma DATA_SECTION(g_burst_packet_vout_after,     "ol_ram");
#pragma DATA_SECTION(g_burst_packet_vout_peak,      "ol_ram");
#pragma DATA_SECTION(g_burst_packet_vout_immediate, "ol_ram");
#pragma DATA_SECTION(g_burst_packet_last_cycles,    "ol_ram");
#pragma DATA_SECTION(g_burst_packet_pwm_end_ost,    "ol_ram");
#pragma DATA_SECTION(g_burst_packet_ne_fault_inject_cycle, "ol_ram");

volatile Uint16 g_burst_packet_ne_fault_inject_cycle = 0U;
volatile Uint16 g_burst_packet_request         = 0U;
volatile Uint16 g_burst_packet_cycles          = 0U;
volatile Uint16 g_burst_packet_result          = BURST_PACKET_RESULT_NONE;
volatile Uint16 g_burst_packet_stop_reason     = 0U;
volatile Uint32 g_burst_packet_completed_cycles= 0UL;
volatile Uint16 g_burst_packet_vout_before     = 0U;
volatile Uint16 g_burst_packet_vout_after      = 0U;
volatile Uint16 g_burst_packet_vout_peak       = 0U;
volatile Uint16 g_burst_packet_vout_immediate  = 0U;
volatile Uint16 g_burst_packet_last_cycles     = 0U;
volatile Uint16 g_burst_packet_pwm_end_ost     = 0U;

#pragma DATA_SECTION(s_burst_packet_booted, "ol_ram");
#pragma DATA_SECTION(s_burst_packet_last_multi_result, "ol_ram");
#pragma DATA_SECTION(s_burst_packet_pending, "ol_ram");
static Uint16 s_burst_packet_booted = 0U;
static Uint16 s_burst_packet_last_multi_result = 0U;
static Uint16 s_burst_packet_pending = 0U;

void BURSTPACKET_Init(void)
{
    g_burst_packet_request          = 0U;
    g_burst_packet_cycles           = 0U;
    g_burst_packet_result           = BURST_PACKET_RESULT_NONE;
    g_burst_packet_stop_reason      = 0U;
    g_burst_packet_completed_cycles = 0UL;
    g_burst_packet_vout_before      = 0U;
    g_burst_packet_vout_after       = 0U;
    g_burst_packet_vout_peak        = 0U;
    g_burst_packet_vout_immediate   = 0U;
    g_burst_packet_last_cycles      = 0U;
    g_burst_packet_pwm_end_ost      = 0U;
    g_burst_packet_ne_fault_inject_cycle = 0U;
    s_burst_packet_last_multi_result = 0U;
    s_burst_packet_pending = 0U;
    s_burst_packet_booted = 1U;
}

static Uint16 BURSTPACKET_EntryConditionsOk(void)
{
    /* Stage allowance: legacy probes required Stage 4; the packet path is a
     * formal Stage 5A (open-loop steady) capability. All safety gates stay. */
    if (g_bringup_stage != BRINGUP_STAGE_5A_OPEN_LOOP_MANUAL &&
        g_bringup_stage != BRINGUP_STAGE_4_PROTECTION_TEST) return 0U;
    if (g_system_state != SYS_STATE_IDLE) return 0U;
    if (g_pwm_enable_request != 0U) return 0U;
    if (g_pwm_enabled != 0U) return 0U;
    if (EPwm1Regs.TZFLG.bit.OST == 0U) return 0U;   /* hardware-latched safe */
    if (g_fault_flags != 0UL) return 0U;
    if (PWM_ConfigMatchesFrozenBaseline() == 0U) return 0U;
    if (GpioCtrlRegs.GPBMUX1.bit.GPIO42 != 3U) return 0U;
    if (GpioCtrlRegs.GPAMUX1.bit.GPIO15 != 1U) return 0U;
    if (g_comp_tz_loopback_verified == 0U) return 0U;
    return 1U;
}

static Uint16 BURSTPACKET_Authorized(Uint16 cycles)
{
    return (cycles == 1U) || (cycles == 2U) || (cycles == 3U) || (cycles == 5U);
}

void BURSTPACKET_SlowTask(void)
{
    if (s_burst_packet_booted == 0U)
    {
        BURSTPACKET_Init();
        s_burst_packet_booted = 1U;
    }

    /* New request: validate and forward to the MULTICYCLE engine. */
    if (g_burst_packet_request != 0U)
    {
        Uint16 cycles = g_burst_packet_cycles;
        g_burst_packet_request = 0U;

        if (BURSTPACKET_Authorized(cycles) == 0U)
        {
            g_burst_packet_result = BURST_PACKET_RESULT_REJECT;
            g_burst_packet_last_cycles = cycles;
            return;
        }
        if (BURSTPACKET_EntryConditionsOk() == 0U)
        {
            g_burst_packet_result = BURST_PACKET_RESULT_REJECT;
            g_burst_packet_last_cycles = cycles;
            return;
        }

        /* Fixed packet parameters: 170 kHz, DB36, 50% structure (MULTICYCLE
         * uses g_pwm_period = 50% from LLC_SetFrequencyHz). */
        g_single_cycle_probe_frequency_hz = BURST_PACKET_FREQ_HZ;
        g_single_cycle_probe_deadtime     = BURST_PACKET_DEADTIME;

        g_multi_cycle_probe_cycles        = (Uint32)cycles;
        g_burst_packet_result             = BURST_PACKET_RESULT_NONE;
        g_burst_packet_stop_reason        = 0U;
        g_burst_packet_completed_cycles   = 0UL;
        g_burst_packet_last_cycles        = cycles;
        s_burst_packet_last_multi_result  = 0U;
        s_burst_packet_pending            = 1U;
        g_multi_cycle_probe_request       = 1U;   /* engine arms in this pass */
        return;
    }

    /* Poll for engine completion and copy the packet record. */
    if (s_burst_packet_pending != 0U &&
        g_burst_packet_result == BURST_PACKET_RESULT_NONE &&
        g_multi_cycle_probe_result != 0U &&
        s_burst_packet_last_multi_result == 0U)
    {
        s_burst_packet_last_multi_result = (Uint16)g_multi_cycle_probe_result;
        s_burst_packet_pending            = 0U;

        if (g_multi_cycle_probe_result == 1U)
        {
            g_burst_packet_result = BURST_PACKET_RESULT_PASS;
        }
        else if (g_multi_cycle_probe_result == 2U)
        {
            g_burst_packet_result = BURST_PACKET_RESULT_FAULT;
        }
        else
        {
            g_burst_packet_result = BURST_PACKET_RESULT_REJECT;
        }

        g_burst_packet_stop_reason      = g_multi_cycle_probe_stop_reason;
        g_burst_packet_completed_cycles = g_multi_cycle_probe_completed_cycles;
        g_burst_packet_vout_before      = g_multi_cycle_probe_adc_vout_before;
        g_burst_packet_vout_after       = g_multi_cycle_probe_adc_vout_after;
        g_burst_packet_vout_peak        = g_probe_vout_max;
        g_burst_packet_vout_immediate   = g_truth_post_5us;
        g_burst_packet_pwm_end_ost      = EPwm1Regs.TZFLG.bit.OST;
    }
}