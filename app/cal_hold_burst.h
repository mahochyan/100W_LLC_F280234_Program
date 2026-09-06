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

#ifndef STAGE6_W4_SWEEP_TEST
#define STAGE6_W4_SWEEP_TEST 0
#endif
#ifndef STAGE6_W4_RETURN_V15_TEST
#define STAGE6_W4_RETURN_V15_TEST 0
#endif
#if STAGE6_W4_SWEEP_TEST && !STAGE6_OPEN_LOOP_STEADY_BUILD
#error "STAGE6_W4_SWEEP_TEST requires STAGE6_OPEN_LOOP_STEADY_BUILD"
#endif
#if STAGE6_W4_RETURN_V15_TEST && !STAGE6_OPEN_LOOP_STEADY_BUILD
#error "STAGE6_W4_RETURN_V15_TEST requires STAGE6_OPEN_LOOP_STEADY_BUILD"
#endif
#if STAGE6_W4_RETURN_V15_TEST && STAGE6_W4_SWEEP_TEST
#error "W4 return V15 and W4 sweep are mutually exclusive images"
#endif
#ifndef STAGE6_W5_LADDER_TEST
#define STAGE6_W5_LADDER_TEST 0
#endif
#if STAGE6_W5_LADDER_TEST && !STAGE6_OPEN_LOOP_STEADY_BUILD
#error "STAGE6_W5_LADDER_TEST requires STAGE6_OPEN_LOOP_STEADY_BUILD"
#endif
#if STAGE6_W5_LADDER_TEST && (STAGE6_W4_SWEEP_TEST || STAGE6_W4_RETURN_V15_TEST)
#error "STAGE6_W5_LADDER_TEST is mutually exclusive with the W4 sweep/return images"
#endif
#if STAGE6_W5_LADDER_TEST
#include "w5_reference_transition.h"
#endif

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
#define W4_TRACE_POST_MARKER_GUARD_TICKS    3000UL /* 12 new samples / 60 ms */
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
#if STAGE6_W4_RETURN_V15_TEST
#define W4_TRACE_ALGORITHM_ID          0x0017UL
#else
#define W4_TRACE_ALGORITHM_ID          0x0014UL
#endif

/* V15 is an isolated CR12 -> CR15 protected-Burst return image.  These
 * constants identify the controller that actually owns the power window;
 * they must not be presented as active PI/PFM evidence.  The burst profile
 * identifier packs TBPRD=0xEF, 250 kHz=0xFA, DB start=0x6E and DB min=0x24. */
#define W4_V15_CONTROL_MODE_PROTECTED_BURST 0x42525354UL /* "BRST" */
#define W4_V15_BURST_PROFILE_ID             0xEFFA6E24UL
#define W4_V15_BURST_CARRIER_HZ              250000UL
#define W4_V15_BURST_TBPRD                      239U
#define W4_V15_BURST_DB_START                   110U
#define W4_V15_BURST_DB_MIN                      36U
#define W4_V15_ISR_LIMIT_CYCLES                  900UL
#define W4_V15_ISR_OVERRUN_CYCLES               1200UL

/* W5 10 V -> 12 V reference ladder.  The engine mode walks the immutable
 * W5REF calibrated rung table inside one protected-Burst hold session:
 * each rung holds 100 ms then 2 s against its own target; per-rung recharge
 * and stage-abort thresholds derive from that rung, and the immutable 12 V
 * +10% absolute ceiling (1640 raw) replaces every fixed 11 V guard in this
 * image.  Packet cadence, DB ramp, comparator and TZ protection remain the
 * qualified W3 implementation. */
#define CAL_HOLD_MODE_W5_LADDER                  2U
#define W5_HOLD_INITIAL_CHARGE_RAW             1200U  /* same legal accelerated Profile C charge */
#define W5_HOLD_RECHARGE_HYSTERESIS_RAW          40U  /* ~0.32 V below the rung target */
#define W5_HOLD_DIAG_LOW_DROP_RAW               250U  /* ~2 V below the rung target */
#define W5_HOLD_UNDERSUPPLY_CONFIRM_SAMPLES       8U  /* <=5.5 ms for bounded multi-packet recovery */
#define W5_HOLD_MAX_PACKET_CYCLES                 45U  /* stop before observed active TZ at cycle53 */
#define W5_HOLD_PACKET_DB_MIN                     95U  /* never enter tripping DB90 region */
#define W5_LADDER_ABORT_ACCEPT_100MS              4U  /* local: 100 ms leg acceptance failed */
#define W5_LADDER_TOTAL_DURATION_MS           10500U  /* 5 rungs x (100 ms + 2 s) */
#define W5_LADDER_TICKS_PER_MS                    50UL /* 20 us fast task */
#define W5_LADDER_CYCLE_CAP                 1312500UL /* 50% aggregate ceiling over 525000 ticks */
#define W5_LADDER_ALGORITHM_ID               0x001FUL
#define W5_LADDER_LOAD_PROFILE_ID            0x0F0FUL /* CR15 held across all rungs */
#define W5_LADDER_TERMINAL_COOKIE_BASE   0x57350000UL

#define W4_TRACE_DIRECTION_HEAVIER          1U     /* CR15 -> CR12 */
#define W4_TRACE_DIRECTION_LIGHTER          2U     /* CR12 -> CR15 */
#define W4_TRACE_DIRECTION_SWEEP             3U     /* CR20 -> CR5, supplemental */

/* Compile-gated supplemental load-map recorder. It adds observation RAM only;
 * packet control and every protection threshold remain the qualified W3/W4
 * implementation. Starting at the 12 s yellow marker, forty 5 ms samples are
 * reduced into each 200 ms bin. Sixteen 5 s levels finish at target tick 92 s. */
#define W4_SWEEP_LOAD_PROFILE_ID         0x1405UL
#define W4_SWEEP_ALGORITHM_ID            0x0016UL
#define W4_SWEEP_BIN_SAMPLES                 40U
#define W4_SWEEP_BINS                       400U
#define W4_SWEEP_MARKER_TICKS            600000UL
#define W4_SWEEP_LEVELS                       16U
#define W4_SWEEP_BINS_PER_LEVEL               25U
#define W4_SWEEP_TRANSITION_BINS               15U
#define W4_SWEEP_PLATEAU_BINS                  10U
#define W4_SWEEP_CUE_OFF_BINS                   8U
#define W4_SWEEP_CHECKSUM_SEED          0x53575016UL

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
#define W4_TRACE_FAIL_SWEEP_OVERFLOW          5U

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
#if STAGE6_W4_RETURN_V15_TEST
extern volatile Uint32 g_w4_v15_control_mode_id;
extern volatile Uint32 g_w4_v15_burst_profile_id;
extern volatile Uint32 g_w4_v15_burst_carrier_hz;
extern volatile Uint16 g_w4_v15_burst_tbprd;
extern volatile Uint16 g_w4_v15_burst_db_start;
extern volatile Uint16 g_w4_v15_burst_db_min;
extern volatile Uint16 g_w4_v15_recharge_low_raw;
extern volatile Uint16 g_w4_v15_recharge_target_raw;
extern volatile Uint16 g_w4_v15_hard_limit_raw;
extern volatile Uint16 g_w4_v15_max_packet_cycles;
extern volatile Uint32 g_w4_v15_pi_update_count_start;
extern volatile Uint32 g_w4_v15_pi_update_count_end;
extern volatile int32 g_w4_v15_pi_integral_q12_start;
extern volatile int32 g_w4_v15_pi_integral_q12_end;
extern volatile Uint32 g_w4_v15_frequency_apply_count;
extern volatile Uint32 g_w4_v15_isr_cycles_max;
extern volatile Uint32 g_w4_v15_isr_sample_count;
extern volatile Uint32 g_w4_v15_isr_overrun_count;
#endif
#if STAGE6_W5_LADDER_TEST
extern volatile Uint32 g_w5_ladder_algorithm_id;
extern volatile Uint32 g_w5_ladder_load_profile_id;
extern volatile Uint16 g_w5_ladder_active_rung;                /* 0..4 */
extern volatile Uint16 g_w5_ladder_rung_phase;                 /* 0 = 100 ms leg, 1 = 2 s leg */
extern volatile Uint16 g_w5_ladder_rung_min_raw[W5REF_RUNG_COUNT];
extern volatile Uint16 g_w5_ladder_rung_max_raw[W5REF_RUNG_COUNT];
extern volatile Uint16 g_w5_ladder_rung_accept_pass[W5REF_RUNG_COUNT];
extern volatile Uint16 g_w5_ladder_abort_reason;               /* W5REF_ABORT_* or W5_LADDER_ABORT_ACCEPT_100MS */
extern volatile Uint16 g_w5_ladder_abort_rung;
extern volatile Uint32 g_w5_ladder_terminal_cookie;
#endif
#if STAGE6_W4_SWEEP_TEST
extern volatile Uint16 g_w4_sweep_count;
extern volatile Uint16 g_w4_sweep_overflow;
extern volatile Uint16 g_w4_sweep_raw_min[W4_SWEEP_BINS];
extern volatile Uint16 g_w4_sweep_raw_max[W4_SWEEP_BINS];
extern volatile Uint16 g_w4_sweep_raw_avg[W4_SWEEP_BINS];
extern volatile Uint16 g_w4_sweep_cycle_sum[W4_SWEEP_BINS];
extern volatile Uint16 g_w4_sweep_packet_sum[W4_SWEEP_BINS];
extern volatile Uint16 g_w4_sweep_tick_delta[W4_SWEEP_BINS];
extern volatile Uint32 g_w4_sweep_data_checksum;
#endif
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
