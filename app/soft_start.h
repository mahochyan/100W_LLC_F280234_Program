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
#define SOFTSTART_RAMP      2U
#define SOFTSTART_COMPLETE  3U
#define SOFTSTART_ABORTED   4U
#define SOFTSTART_FINALIZE   5U

/* Profiles */
#define SOFTSTART_PROFILE_TUTORIAL_REFERENCE  0U
#define SOFTSTART_PROFILE_CURRENT_BOARD_SAFE  1U

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

void SoftStart_Init(void);
void SoftStart_Begin(void);
void SoftStart_SelectProfile(Uint16 profile);
void SoftStart_Update5ms(void);
void SoftStart_ApplyLimits(void);
Uint32 SoftStart_GetPeriodLimit(void);
Uint16 SoftStart_GetDeadtime(void);
Uint16 SoftStart_IsComplete(void);

#endif /* APP_SOFT_START_H */
