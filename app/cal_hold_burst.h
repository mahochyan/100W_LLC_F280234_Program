/*
 * cal_hold_burst.h
 *
 * PROFILE_C_CAL_HOLD_BURST_V1 — low-energy hold platform near 1400 raw.
 *
 * New controller on top of the PASSed Profile C charge. The legacy
 * CALHOLD_SlowTask / VOUTPROBE packet logic is intentionally NOT reused:
 * packet scheduling lives in the 20 us fast task, not the 5 ms slow task.
 *
 * Flow:
 *   IDLE -> CHARGE (reuse Profile C: 250k/DB110 -> DB36 -> 150k -> 1400 raw
 *                   -> scheduled OST) -> OFF (PWM off, OST latched,
 *                   software-trigger two-step VOUT ADC in the fast task)
 *        -> PACKET (recharge burst: 250k/DB110 fixed, <=15 cycles, PWM-sync
 *                   ADC, >=1400 -> OST) -> OFF ... until duration_ms elapses
 *        -> COMPLETE. Any hard-limit / TZ / undersupply -> ABORT.
 *
 * Compile-time hard limits (no CCS-writable variable can enlarge them):
 *   RECHARGE_LOW 1380 / TARGET 1400 / HARD 1450 / DIAG_LOW_ABORT 1300
 *   MAX_PACKET_CYCLES 15 / MAX_TOTAL_PACKET_CYCLES_100MS 6000
 */
#ifndef APP_CAL_HOLD_BURST_H
#define APP_CAL_HOLD_BURST_H

#include "DSP2803x_Device.h"

#define CAL_HOLD_RECHARGE_LOW_RAW       1380U
#define CAL_HOLD_RECHARGE_TARGET_RAW    1400U
#define CAL_HOLD_HARD_LIMIT_RAW         1450U
#define CAL_HOLD_DIAG_LOW_ABORT_RAW     1300U

#define CAL_HOLD_MAX_PACKET_CYCLES      15U
#define CAL_HOLD_OFF_MIN_TICKS          2U        /* >= 40 us @ 20 us tick */
#define CAL_HOLD_UNDERSUPPLY_DELAY_TICKS 100U     /* 2 ms @ 20 us tick */
#define CAL_HOLD_SETTLING_MS            5U
#define CAL_HOLD_CAL_SETTLING_MS        200U   /* calibration window starts here */
#define CAL_HOLD_MAX_TOTAL_PACKET_CYCLES_100MS 6000UL
#define CAL_HOLD_MAX_TOTAL_PACKET_CYCLES_1S    40000UL
#define CAL_HOLD_MAX_TOTAL_PACKET_CYCLES_MEASURE 120000UL  /* 30s interactive hold, ~70k expected */
#define CAL_HOLD_ZERO_SAMPLES           64U    /* post-test zero/offset capture */

/* W3/W4 protected 10 V profile on the already proven 250 kHz / DB110 restart
 * cycle. The 160-cycle packet ceiling is 640 us at 250 kHz and is still
 * terminated early by every fresh target/hard-limit sample. V4 separates its
 * energy budget from the legacy 11 V profile, which remains at 15 cycles. */
#define CAL_HOLD_MODE_LEGACY_11V         0U
#define CAL_HOLD_MODE_W3_10V             1U
#define W3_HOLD_RECHARGE_LOW_RAW         1220U  /* 9.81 V */
#define W3_HOLD_RECHARGE_TARGET_RAW      1260U  /* 10.13 V */
#define W3_HOLD_HARD_LIMIT_RAW           1300U  /* 10.45 V, below OL warning 1304 */
#define W3_HOLD_DIAG_LOW_ABORT_RAW       1000U  /* 8.03 V after 2 ms => abort */
#define W3_HOLD_UNDERSUPPLY_CONFIRM_SAMPLES 3U /* consecutive OFF samples */
#define W3_HOLD_INITIAL_CHARGE_RAW       1200U  /* legal accelerated Profile C target */
#define W3_HOLD_MAX_PACKET_CYCLES        160U   /* <=640 us; per-cycle target/hard stop remains */
#define W3_HOLD_PACKET_DB_MIN            36U    /* exact Phase-A cadence reaches DB36 by cycle155 */
#define W3_HOLD_DURATION_500MS           500U
#define W3_HOLD_DURATION_2S              2000U
#define W3_HOLD_DURATION_10S             10000U
#define W3_HOLD_DURATION_60S             60000U
/* At 250 kHz these compile-time caps bound total PWM-active time to 50% of
 * each requested duration. Normal target crossings should terminate earlier. */
#define W3_HOLD_CYCLE_CAP_500MS          62500UL
#define W3_HOLD_CYCLE_CAP_2S             250000UL
#define W3_HOLD_CYCLE_CAP_10S            1250000UL
#define W3_HOLD_CYCLE_CAP_60S            7500000UL

/* W4 operator-selected CR15 <-> CR12 A/B/A observer. Trace fields never grant PWM authority
 * or change a packet/protection threshold. Only the firmware-consumed exact
 * tuple W3_10V + 60000 ms + arm==1 + valid direction creates a private W4
 * session. That private session alone selects the bounded 60..180 s diagnostic
 * window and proportional aggregate-cycle envelope; every per-cycle target,
 * hard-limit, comparator and TZ protection remains unchanged. */
#define W4_TRACE_ARM_REQUEST                1U
#define W4_TRACE_SAMPLES                  128U    /* 640 ms at 5 ms/sample */
#define W4_TRACE_BASELINE_SAMPLES         40U     /* 200 ms */
#define W4_TRACE_DETECT_BLOCK_SAMPLES     4U      /* 20 ms */
#define W4_TRACE_DETECT_STREAK_BLOCKS     3U      /* 60 ms; rejects one-block spikes */
#define W4_TRACE_POST_SAMPLES             40U     /* 200 ms after detection */
#define W4_TRACE_EVAL_SAMPLES             52U     /* three detect blocks + post */
#define W4_TRACE_SAMPLE_MS                 5U
#define W4_TRACE_BASELINE_START_TICKS      25000UL /* 500 ms */
/* V14: the first 200 ms window is only a seed.  Refresh the latest 200 ms
 * reference every 5 ms through a 10 s warm-up, then freeze it before the
 * operator is asked to move the load.  Detection opens at the nominal 12 s
 * target-side operator marker and compares three consecutive 20 ms candidate
 * blocks with the frozen reference.  The REAL image turns on the yellow LED
 * at that same target tick; the operator changes load only after seeing it.
 * A slow manual CR15/CR12 adjustment therefore cannot be absorbed by a
 * continuously following reference. */
#define W4_TRACE_REFERENCE_FREEZE_TICKS   500000UL /* 10 s */
#define W4_TRACE_DETECT_START_TICKS       600000UL /* 12 s */
#define W4_TRACE_MIN_HOLD_TICKS           3000000UL /* 60 s */
#define W4_TRACE_MAX_HOLD_TICKS           9000000UL /* 180 s operator backstop */
/* 180 s at 250 kHz with the unchanged 50% aggregate active-time ceiling. */
#define W4_TRACE_MAX_TOTAL_PACKET_CYCLES 22500000UL
/* W4 may wait longer than 60 s for the physical step. Freeze only the three
 * Uint32 sum/count pairs at this private sample count; instantaneous raw and
 * all extrema continue for the full run. With raw<1300 required to continue,
 * (N-1)*1299 + one terminal Uint16 sample remains below UINT32_MAX. */
#define W4_TRACE_STATS_MAX_ACCUM_SAMPLES  3000000UL
#define W4_TRACE_5PCT_LOW_RAW              1182U
#define W4_TRACE_5PCT_HIGH_RAW             1306U
#define W4_TRACE_2PCT_LOW_RAW              1215U
#define W4_TRACE_2PCT_HIGH_RAW             1265U
#define W4_TRACE_SETTLE_LIMIT_MS            100U
/* Written only after the W4 terminal safety/evidence snapshot is complete.
 * The host combines this base with the frozen run id, immutable private
 * direction, terminal state and reason to reject stale or partial RAM. */
#define W4_TRACE_TERMINAL_COOKIE_BASE 0x57440000UL
/* Compile-time profile binding: 0x0F0C is 15 ohm / 12 ohm. Including it in
 * the terminal cookie prevents an older CR15/CR12.5 image from being accepted
 * as evidence for the user-selected, easier-to-set CR15/CR12 boundary. */
#define W4_TRACE_LOAD_LIGHT_OHM_X10       150U
#define W4_TRACE_LOAD_HEAVY_OHM_X10       120U
#define W4_TRACE_LOAD_PROFILE_ID       0x0F0CUL
#define W4_TRACE_ALGORITHM_ID          0x0014UL

#define W4_TRACE_DIRECTION_HEAVIER          1U     /* CR15 -> CR12 */
#define W4_TRACE_DIRECTION_LIGHTER          2U     /* CR12 -> CR15 */

#define W4_TRACE_STATE_IDLE                 0U
#define W4_TRACE_STATE_WAIT_BASELINE        1U
#define W4_TRACE_STATE_BASELINE             2U
#define W4_TRACE_STATE_ARMED                3U
#define W4_TRACE_STATE_POST                 4U
#define W4_TRACE_STATE_COMPLETE             5U
#define W4_TRACE_STATE_FAIL                 6U

#define W4_TRACE_FAIL_NONE                  0U
#define W4_TRACE_FAIL_BAD_DIRECTION         1U
#define W4_TRACE_FAIL_ZERO_BASELINE         2U
#define W4_TRACE_FAIL_NO_COMPLETE_WINDOW    3U
#define W4_TRACE_FAIL_BAD_SESSION            4U

extern volatile Uint16 g_w4_trace_arm;
extern volatile Uint16 g_w4_trace_expected_direction;
extern volatile Uint16 g_w4_trace_direction_active;
extern volatile Uint16 g_w4_trace_state;
extern volatile Uint16 g_w4_trace_fail_reason;
extern volatile Uint16 g_w4_trace_count;
extern volatile Uint16 g_w4_trace_write_index;
extern volatile Uint16 g_w4_trace_trigger_index;
extern volatile Uint16 g_w4_trace_baseline_raw;
extern volatile Uint16 g_w4_trace_baseline_cycles_per_5ms;
extern volatile Uint16 g_w4_trace_baseline_cycles_per_packet;
extern volatile Uint32 g_w4_trace_baseline_demand_index;
extern volatile Uint16 g_w4_trace_trigger_raw;
extern volatile Uint16 g_w4_trace_trigger_cycles_20ms;
extern volatile Uint16 g_w4_trace_trigger_packets_20ms;
extern volatile Uint16 g_w4_trace_trigger_cycles_per_packet;
extern volatile Uint32 g_w4_trace_trigger_demand_index;
extern volatile Uint32 g_w4_trace_trigger_confirm_tick;
extern volatile Uint32 g_w4_trace_operator_marker_tick;
extern volatile Uint16 g_w4_trace_min_raw;
extern volatile Uint16 g_w4_trace_max_raw;
extern volatile Uint16 g_w4_trace_settle_ms;
extern volatile Uint16 g_w4_trace_peak_pass;
extern volatile Uint16 g_w4_trace_settle_pass;
extern volatile Uint16 g_w4_trace_quality_pass;
extern volatile Uint32 g_w4_trace_terminal_cookie;
extern volatile Uint16 g_w4_trace_ring_raw[W4_TRACE_SAMPLES];
extern volatile Uint16 g_w4_trace_ring_cycle_delta[W4_TRACE_SAMPLES];
extern volatile Uint16 g_w4_trace_ring_packet_delta[W4_TRACE_SAMPLES];
#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
extern volatile Uint16 g_w4_trace_ne_cycle_delta;
extern volatile Uint16 g_w4_trace_ne_packet_delta;
#endif

/* CALIBRATION_MEASURE_HOLD: interactive DMM hold (task
 * LLC_STAGE5_ACCEPTANCE_SPRINT_V2). The hold does NOT end at 1s; it runs
 * until the operator signals completion or the 30s wall-clock timeout. */
#define CAL_HOLD_MEASURE_SETTLING_MS    500U
#define CAL_HOLD_MEASURE_STABLE_MS      200U
#define CAL_HOLD_MAX_DMM_HOLD_SECONDS   30U

void CALHOLD_Init(void);
void CALHOLD_SlowTask(void);       /* request detect, CHARGE supervision, end/abort bookkeeping */
void CALHOLD_FastTask(void);       /* 20 us: OFF software ADC, packet scheduling, safety */
void CALHOLD_PacketIsr(void);      /* EPWM1 INT while a recharge packet is active */
Uint16 CALHOLD_W3PacketAuthOk(void); /* private-latch-backed exact 239/110 write gate */
Uint16 CALHOLD_W3PacketRampAuthOk(void); /* private active-packet 239/DB110..36 gate */

#endif /* APP_CAL_HOLD_BURST_H */
