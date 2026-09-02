/* W2_CONTROL_REGION_REDESIGN_V1 - Burst region state model (NE-only).
 *
 * Work order sections 1-4 / 7 implemented as a pure state machine over
 * host-writable signals. No protection, no PWM actuation in v1: the packet
 * actuator hook stays behind g_br_arm and is a COUNTER-ONLY model in the NE
 * build (the real packet hardware belongs to
 * W2_BURST_PACKET_CHARACTERIZATION_V1).
 *
 * v1 single-main-variable rule (section 3): inside Burst the ONLY scheduled
 * actuation variable is the packet ON/OFF cadence at a FIXED safe frequency.
 * No PI frequency modulation, no dynamic dead-time, no adaptive packet
 * length is opened here.
 */
#include "DSP2803x_Device.h"
#include "DSP2803x_Examples.h"
#include "llc_globals.h"
#include "burst_region.h"

#if STAGE6_OPEN_LOOP_STEADY_BUILD && STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST

/* All BR state lives in the dedicated UNINITIALIZED "ol_ram" section (NE
 * build only; RAML3 has ample headroom). .ebss in the NE link is nearly
 * full, and BR_Init() explicitly resets every variable, so placement here
 * is deterministic. BR_NeTick() lazily boots the model on its first tick. */
#pragma DATA_SECTION(g_br_enable,             "ol_ram");
#pragma DATA_SECTION(g_br_state,              "ol_ram");
#pragma DATA_SECTION(g_br_vref_raw,           "ol_ram");
#pragma DATA_SECTION(g_br_vout_raw,           "ol_ram");
#pragma DATA_SECTION(g_br_vout_rising,        "ol_ram");
#pragma DATA_SECTION(g_br_freq_command_hz,    "ol_ram");
#pragma DATA_SECTION(g_br_fmax_hz,            "ol_ram");
#pragma DATA_SECTION(g_br_v_entry_hyst_raw,   "ol_ram");
#pragma DATA_SECTION(g_br_v_exit_hyst_raw,    "ol_ram");
#pragma DATA_SECTION(g_br_entry_persist_n,    "ol_ram");
#pragma DATA_SECTION(g_br_min_run_dwell_ticks,"ol_ram");
#pragma DATA_SECTION(g_br_run_pfm_return_n,   "ol_ram");
#pragma DATA_SECTION(g_br_packet_cycles,      "ol_ram");
#pragma DATA_SECTION(g_br_packet_freq_hz,     "ol_ram");
#pragma DATA_SECTION(g_br_handoff_request,    "ol_ram");
#pragma DATA_SECTION(g_br_arm,                "ol_ram");
#pragma DATA_SECTION(g_br_packets_emitted,    "ol_ram");
#pragma DATA_SECTION(g_br_entry_debounce_rejects,"ol_ram");
#pragma DATA_SECTION(g_br_persist_max,        "ol_ram");
#pragma DATA_SECTION(g_br_packet_ticks_left,  "ol_ram");
#pragma DATA_SECTION(g_br_coast_ticks,        "ol_ram");
#pragma DATA_SECTION(g_br_run_ticks,          "ol_ram");
#pragma DATA_SECTION(g_br_last_entry_vout_raw,"ol_ram");
#pragma DATA_SECTION(g_br_tick_count,         "ol_ram");

volatile Uint16 g_br_enable             = 0U;
volatile Uint16 g_br_state              = BR_STATE_IDLE;
volatile Uint16 g_br_vref_raw           = 1236U;   /* ~10 V by the frozen cal */
volatile Uint16 g_br_vout_raw           = 0U;
volatile Uint16 g_br_vout_rising        = 0U;
volatile Uint32 g_br_freq_command_hz    = 0UL;
volatile Uint32 g_br_fmax_hz            = 170000UL; /* production Fmax (frozen) */
volatile Uint16 g_br_v_entry_hyst_raw   = 25U;     /* PROPOSED: ~0.20 V */
volatile Uint16 g_br_v_exit_hyst_raw    = 25U;     /* PROPOSED: ~0.20 V */
volatile Uint16 g_br_entry_persist_n    = 25U;     /* PROPOSED: 25 fresh samples */
volatile Uint16 g_br_min_run_dwell_ticks= 2500U;   /* PROPOSED: ~50 ms */
volatile Uint16 g_br_run_pfm_return_n   = 500U;    /* PROPOSED: ~10 ms */
volatile Uint16 g_br_packet_cycles      = 1U;      /* start from the minimal packet */
volatile Uint32 g_br_packet_freq_hz     = 150000UL;/* PROPOSED safe packet freq */
volatile Uint16 g_br_handoff_request    = 0U;
volatile Uint16 g_br_arm                = 0U;

volatile Uint16 g_br_packets_emitted    = 0U;
volatile Uint16 g_br_entry_debounce_rejects = 0U;
volatile Uint16 g_br_persist_max        = 0U;
volatile Uint16 g_br_packet_ticks_left  = 0U;
volatile Uint16 g_br_coast_ticks        = 0U;
volatile Uint16 g_br_run_ticks          = 0U;
volatile Uint32 g_br_last_entry_vout_raw= 0U;
volatile Uint32 g_br_tick_count         = 0U;

static Uint16 s_br_persist_cnt   = 0U;
static Uint16 s_br_return_cnt    = 0U;
static Uint16 s_br_booted        = 0U;

void BR_Init(void)
{
    g_br_enable = 0U;
    g_br_state  = BR_STATE_IDLE;
    s_br_persist_cnt = 0U;
    s_br_return_cnt  = 0U;
    g_br_packets_emitted = 0U;
    g_br_entry_debounce_rejects = 0U;
    g_br_persist_max = 0U;
    g_br_packet_ticks_left = 0U;
    g_br_coast_ticks = 0U;
    g_br_run_ticks   = 0U;
    g_br_last_entry_vout_raw = 0U;
    g_br_tick_count  = 0U;
    g_br_handoff_request = 0U;
}

/* One-shot SOFTSTART-end handoff evaluation (work order section 4):
 * judgement from real Vout / Vref / frequency authority / dVout/dt only. */
static void BR_HandoffEval(void)
{
    if (g_br_freq_command_hz >= g_br_fmax_hz &&
        g_br_vout_raw > (Uint16)(g_br_vref_raw + g_br_v_entry_hyst_raw) &&
        g_br_vout_rising != 0U)
    {
        g_br_state = BR_STATE_BURST_PREP;   /* -> BURST next tick */
    }
    else
    {
        g_br_state = BR_STATE_RUN_PFM;
        g_br_run_ticks = 0U;
        s_br_persist_cnt = 0U;
    }
}

void BR_NeTick(void)
{
    if (s_br_booted == 0U)   /* lazy boot: ol_ram is uninitialized at reset */
    {
        BR_Init();
        s_br_booted = 1U;
    }
    g_br_tick_count++;

    /* frozen safety semantics: any fault dominates (section 5, FAULT state) */
    if (g_fault_flags != 0U)
    {
        g_br_state = BR_STATE_FAULT;
        s_br_persist_cnt = 0U;
        s_br_return_cnt  = 0U;
        return;
    }

    if (g_br_enable == 0U)
    {
        g_br_state = BR_STATE_IDLE;
        return;
    }

    switch (g_br_state)
    {
    case BR_STATE_IDLE:
        g_br_state = BR_STATE_RUN_PFM;      /* host may pre-seed via handoff */
        g_br_run_ticks = 0U;
        s_br_persist_cnt = 0U;
        break;

    case BR_STATE_RUN_PFM:
        g_br_run_ticks++;
        if (g_br_handoff_request != 0U)
        {
            g_br_handoff_request = 0U;
            BR_HandoffEval();
            break;
        }
        if (g_br_freq_command_hz >= g_br_fmax_hz &&
            g_br_vout_raw > (Uint16)(g_br_vref_raw + g_br_v_entry_hyst_raw))
        {
            /* raw condition true: persistence / debounce shaping */
            if (g_br_run_ticks < g_br_min_run_dwell_ticks)
            {
                g_br_entry_debounce_rejects++;   /* min-dwell gate */
                s_br_persist_cnt = 0U;
            }
            else
            {
                s_br_persist_cnt++;
                if (s_br_persist_cnt > g_br_persist_max)
                {
                    g_br_persist_max = s_br_persist_cnt;
                }
                if (s_br_persist_cnt >= g_br_entry_persist_n)
                {
                    g_br_last_entry_vout_raw = g_br_vout_raw;
                    g_br_state = BR_STATE_BURST_PREP;
                    s_br_persist_cnt = 0U;
                    g_br_persist_max = 0U;
                }
            }
        }
        else
        {
            s_br_persist_cnt = 0U;
            g_br_persist_max = 0U;
            g_br_entry_debounce_rejects++;
        }
        break;

    case BR_STATE_BURST_PREP:
        /* one evaluation tick, then emit the first packet (v1: counters) */
        g_br_state = BR_STATE_BURST_ON;
        g_br_packet_ticks_left = g_br_packet_cycles;
        break;

    case BR_STATE_BURST_ON:
        if (g_br_packet_ticks_left > 0U) { g_br_packet_ticks_left--; }
        if (g_br_packet_ticks_left == 0U)
        {
            g_br_packets_emitted++;
            g_br_state = BR_STATE_BURST_OFF;
            g_br_coast_ticks = 0U;
        }
        break;

    case BR_STATE_BURST_OFF:
        g_br_coast_ticks++;
        if (g_br_vout_raw < (Uint16)(g_br_vref_raw - g_br_v_exit_hyst_raw))
        {
            /* envelope demands energy: emit the next packet */
            g_br_packet_ticks_left = g_br_packet_cycles;
            g_br_state = BR_STATE_BURST_ON;
        }
        else if (g_br_freq_command_hz < g_br_fmax_hz)
        {
            /* the demand fell below the authority ceiling: continuous PFM
             * regains (sustained, per section 7's natural boundary) */
            s_br_return_cnt++;
            if (s_br_return_cnt >= g_br_run_pfm_return_n)
            {
                g_br_state = BR_STATE_RUN_PFM;
                g_br_run_ticks = 0U;
                s_br_persist_cnt = 0U;
                s_br_return_cnt = 0U;
            }
        }
        else
        {
            s_br_return_cnt = 0U;
        }
        break;

    case BR_STATE_FAULT:
    default:
        /* faults cleared + host re-enable: return to RUN_PFM */
        if (g_br_enable != 0U)
        {
            g_br_state = BR_STATE_RUN_PFM;
            g_br_run_ticks = 0U;
            s_br_persist_cnt = 0U;
        }
        break;
    }
}

#endif /* STAGE6_OPEN_LOOP_STEADY_BUILD && STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST */