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

/* W3 protected 10 V profile on the already proven 250 kHz / DB110 restart
 * cycle. The 64-cycle packet ceiling is 256 us at 250 kHz and is still
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
#define W3_HOLD_MAX_PACKET_CYCLES        64U    /* <=256 us; per-cycle target/hard stop remains */
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

#endif /* APP_CAL_HOLD_BURST_H */
