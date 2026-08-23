/*
 * shot.h
 *
 * Bounded FIRST real PI shot (STAGE6_FIRST_BOUNDED_REAL_PI_SHOT_PREPARATION_V1).
 * This module adds an independent, on-chip-gated, time-bounded real PI shot:
 *   - STAGE6_FIRST_BOUNDED_REAL_PI_SHOT compile-time mode only (test build).
 *   - Frequency envelope 145000 .. 170000 Hz (first-shot envelope).
 *   - Independent authorization g_first_real_pi_shot_arm (D).
 *   - On-chip 200 us auto-OST timer (E).
 *   - 11 V fast VOUT abort computed from board_calibration.h (F).
 *   - Small RAM ring buffer of the control ticks (H).
 * The production build does not define STAGE6_FIRST_BOUNDED_REAL_PI_SHOT, so
 * every shot function compiles out (ASCII-only content, both-encoding safe).
 */
#ifndef APP_SHOT_H
#define APP_SHOT_H

#include "DSP2803x_Device.h"

/* First-shot frequency envelope (Hz). NOT a change to the formal production
 * range (LLC_HARD_MAX_HZ stays 150 kHz); this is a test-only envelope. */
#define FIRST_REAL_PI_MIN_HZ            145000UL
#define FIRST_REAL_PI_MAX_HZ            170000UL

/* 200 us max shot = 10 control ticks (each 20 us). */
#define FIRST_REAL_PI_DURATION_TICKS    10U

/* RAM ring buffer of recorded control ticks during the shot (32 entries, > the
 * 200 us shot). Placed in its own "shot_ram" section on RAML3 (.esysmem) so it
 * does not exhaust the 1 KB RAML2 .ebss. */
#define SHOT_RB_SIZE                    32U

/* Shot state machine. */
#define SHOT_STATE_IDLE     0U
#define SHOT_STATE_ARMED    1U   /* authorized, waiting for first PI write */
#define SHOT_STATE_ACTIVE   2U   /* PI writing; shot timer running */
#define SHOT_STATE_COMPLETE 3U   /* 200 us reached, normal bounded end */
#define SHOT_STATE_ABORTED  4U

/* Abort / completion reason codes. */
#define SHOT_ABORT_NONE       0U
#define SHOT_ABORT_TIMEOUT    1U   /* 200 us elapsed (normal end) */
#define SHOT_ABORT_VOUT_11V   2U   /* Vout >= 11 V fast abort */
#define SHOT_ABORT_TZ         3U   /* real Comparator/TZ trip */
#define SHOT_ABORT_FAULT      4U   /* some other fault latched */
#define SHOT_ABORT_ACTUATOR   5U   /* LLC_SetFrequencyHz failed */
#define SHOT_ABORT_PERMISSION 6U   /* a permission condition disappeared */

/* One recorded control tick (H). Fields are plain (written once by the ISR,
 * read post-shot by CCS while halted), so the compiler can batch the stores. */
typedef struct
{
    Uint32 tick;
    Uint16 vout_raw;
    Uint16 vout_filtered_raw;
    int16  error_raw;
    Uint32 freq_cmd_hz;
    Uint32 actual_freq_hz;
    Uint16 tbprd;
    int32  pi_integral_q12;
    Uint16 fresh_sample;
    Uint16 tzflg;
    Uint16 compsts;
    Uint16 fault_flags;
} SHOT_RbEntry;

void   SHOT_Init(void);
Uint16 SHOT_PermissionOk(void);      /* D: all arm conditions */
Uint16 SHOT_WriteAllowed(void);      /* D per-tick gate: full on first write, dynamic-only after */
Uint16 SHOT_RealStage6AuthOk(void);  /* F2: bounded-shot Stage6 startup auth (REAL build only) */
Uint16 SHOT_ClampFreq(Uint32 *p_hz); /* B: clamp into 145..170k, returns 1 if clamped applied */
void   SHOT_Revoke(Uint16 reason);   /* on-chip termination (E/F/C/D) */
void   SHOT_FastTask(void);          /* called from TINT0_ISR: timer + 11V abort + ring record */
void   SHOT_OnTrip(void);            /* called from real TZ ISR (G): revoke on real trip */

/* Non-static shot globals (CCS-visible by name). */
extern volatile Uint16 g_first_real_pi_shot_build;
extern volatile Uint16 g_first_real_pi_shot_arm;
extern volatile Uint16 g_first_real_pi_shot_state;
extern volatile Uint16 g_first_real_pi_shot_tick;
extern volatile Uint16 g_first_real_pi_shot_abort;
extern volatile Uint16 g_first_real_pi_shot_power_writes;
extern volatile Uint16 g_first_real_pi_shot_ok;
extern volatile Uint16 g_first_real_pi_shot_abort_vout_raw;
extern volatile Uint16 g_first_real_pi_shot_rb_index;
extern volatile Uint16 g_first_real_pi_shot_rb_count;
extern SHOT_RbEntry g_first_real_pi_shot_rb[SHOT_RB_SIZE];
/* H: Timer2 captures for the first-write -> OST elapsed proof. */
extern volatile Uint32 g_first_real_pi_shot_first_write_timer2;
extern volatile Uint32 g_first_real_pi_shot_ost_timer2;
#if !STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD
/* Test-only debug overrides: compiled OUT of the REAL shot binary. */
extern volatile Uint32 g_first_shot_debug_freq_hz;
extern volatile Uint16 g_first_shot_debug_ticks;
#endif

#endif /* APP_SHOT_H */
