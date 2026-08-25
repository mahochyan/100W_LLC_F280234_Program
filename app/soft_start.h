/*
 * soft_start.h
 *
 * Unified Tutorial SoftStart Engine ported from CSS024D tutorial.
 * This engine is the only soft-start mechanism for future power experiments.
 */
#ifndef APP_SOFT_START_H
#define APP_SOFT_START_H

#include "DSP2803x_Device.h"

/* Engine states */
#define SOFTSTART_INIT      0U
#define SOFTSTART_WAIT      1U
#define SOFTSTART_RAMP      2U   /* legacy only */
#define SOFTSTART_COMPLETE  3U
#define SOFTSTART_ABORTED   4U
#define SOFTSTART_FINALIZE   5U  /* legacy only */
#define SOFTSTART_START_HOLD 6U  /* 250kHz/DB110, 15 cycles */
#define SOFTSTART_PHASE_A    7U  /* DB110->36, 10 cycles/step */
#define SOFTSTART_PHASE_B    8U  /* period 239->399, 10 cycles/step */
#define SOFTSTART_FINAL      9U  /* 150kHz/DB36, acceptance window */
#define SOFTSTART_PFM_WINDOW 10U /* STAGE5A: fixed-frequency direction window */

/* Verified Profile C trajectory constants (board-PASSed) */
#define SS_START_PERIOD        239U
#define SS_START_CMPA          120U
#define SS_START_CMPB          60U
#define SS_START_DB            110U
#define SS_START_HOLD_CYCLES   15U
#define SS_PHASE_A_STAGES      15U   /* DB 110..40 step 5, then 36 */
#define SS_PHASE_A_DB_STEP     5U
#define SS_PHASE_A_CYCLES      10U
#define SS_PHASE_B_STAGES      16U   /* period 239..389 step 10, then 399 */
#define SS_PHASE_B_PERIOD_STEP 10U
#define SS_PHASE_B_CYCLES      10U
#define SS_FINAL_PERIOD        399U
#define SS_FINAL_CMPA          200U
#define SS_FINAL_CMPB          100U
#define SS_FINAL_DB            36U
#define SS_FINAL_MAX_CYCLES    300U  /* acceptance wait window after ramp */
#define SS_STALE_MISS_LIMIT    3U

/* W2 handoff-energy brake. Profile C still completes and is validated at
 * 150 kHz/TBPRD=399. Immediately before closed-loop ownership is published,
 * preload the already-running bridge at 160 kHz and seed the PI with the
 * equivalent -10 kHz integral term. This removes the first-sample energy
 * discontinuity while retaining the frozen 145..170 kHz control envelope. */
#define SS_HANDOFF_BRAKE_PERIOD       374U
#define SS_HANDOFF_BRAKE_CMPA         187U
#define SS_HANDOFF_BRAKE_HZ           160000UL
#define SS_HANDOFF_BRAKE_INTEGRAL_Q12 (-40960000L)
#define SS_HANDOFF_BRAKE_UNSAT_Q12    655360000L

/* STAGE5A PFM direction test (g_pfm_direction_test_mode) */
#define PFM_DIRECTION_MODE_OFF       0U
#define PFM_DIRECTION_MODE_TEST_150K 1U
#define PFM_DIRECTION_MODE_TEST_170K 2U
/* Same ~300us real-time windows: 150k = 45 cycles, 170k = 51 cycles. */
#define PFM_DIRECTION_WINDOW_CYCLES_150K 45U
#define PFM_DIRECTION_WINDOW_CYCLES_170K 51U
#define PFM_DIRECTION_FREQ_170K_HZ       170000UL

/* g_softstart_result values */
#define SS_RESULT_NONE          0U
#define SS_RESULT_COMPLETE      1U
#define SS_RESULT_ACCEPT_TARGET 2U
#define SS_RESULT_HARD_CEILING  3U
#define SS_RESULT_ACTIVE_TZ     4U
#define SS_RESULT_STALE_ADC     5U
#define SS_RESULT_NOT_REACHED   6U
#define SS_RESULT_REJECTED      7U
#define SS_RESULT_PFM_WINDOW_DONE 8U   /* STAGE5A window completed -> scheduled OST */
#define SS_RESULT_PFM_HARD_ABORT  9U   /* STAGE5A window hit ceiling -> immediate OST */

/* Profiles */
#define SOFTSTART_PROFILE_TUTORIAL_REFERENCE  0U
#define SOFTSTART_PROFILE_LEGACY_REFERENCE    1U   /* old 150k/DB190 scheme — reference only */
#define SOFTSTART_PROFILE_CURRENT_BOARD_VERIFIED 2U  /* DEFAULT: PASSed Profile C */
#define SOFTSTART_PROFILE_DEFAULT             SOFTSTART_PROFILE_CURRENT_BOARD_VERIFIED

/* OCP recovery modes */
#define OCP_RECOVERY_MODE_LOCKED          0U
#define OCP_RECOVERY_MODE_TUTORIAL_HICCUP 1U

/* Tutorial reference constants */
#define TUTORIAL_MIN_BURST  400U
#define TUTORIAL_MAX_DT     190U
#define TUTORIAL_MIN_DT     20U
#define TUTORIAL_MAX_PD     1714U
#define TUTORIAL_PERIOD_STEP 10U
#define TUTORIAL_WAIT_5MS_TICKS 20U   /* ~100 ms */

/* STAGE6_CLOSED_LOOP_HANDOFF: handoff results (g_softstart_handoff_result) */
#define HANDOFF_RESULT_NONE            0U
#define HANDOFF_RESULT_OK              1U
#define HANDOFF_PWM_STATE_INVALID      2U
#define HANDOFF_GATE_FAIL              3U
#define HANDOFF_CEILING                4U
#define HANDOFF_FAULT                  5U
#define HANDOFF_BRAKE_INVALID          6U

void SoftStart_Init(void);
void SoftStart_Begin(void);
void SoftStart_SelectProfile(Uint16 profile);
void SoftStart_Update5ms(void);
void SoftStart_ApplyLimits(void);
void SoftStart_FastUpdate(void);   /* ePWM-cycle driven (formal trajectory) */
Uint16 SoftStart_TransferToClosedLoop(void);  /* STAGE6 closed-loop handoff */
Uint32 SoftStart_GetPeriodLimit(void);
Uint16 SoftStart_GetDeadtime(void);
Uint16 SoftStart_IsComplete(void);

#endif /* APP_SOFT_START_H */
