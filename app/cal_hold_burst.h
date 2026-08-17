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

#endif /* APP_CAL_HOLD_BURST_H */
