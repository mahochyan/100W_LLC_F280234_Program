/*
 * shot.h
 *
 * Bounded FIRST real PI shot (STAGE6_FIRST_BOUNDED_REAL_PI_SHOT_PREPARATION_V1)
 * + STAGE6_40US_SPLIT_PIPELINE_ACCELERATED_CLOSED_LOOP_V1.
 * This module adds an independent, on-chip-gated, time-bounded real PI shot:
 *   - STAGE6_FIRST_BOUNDED_REAL_PI_SHOT compile-time mode only (test build).
 *   - Frequency envelope 145000 .. 170000 Hz (first-shot envelope).
 *   - Independent authorization g_first_real_pi_shot_arm (D).
 *   - 40 us split pipeline: PHASE_COMPUTE (PI + pending) and PHASE_APPLY
 *     (re-verify + commit) alternate on the 20 us TINT0 ticks (A/B).
 *   - Real-time 1 ms cage from Timer2, not from control-update counts (D).
 *   - 11 V fast VOUT abort computed from board_calibration.h (F).
 *   - ISR-side summary record only; no full ring inside the 20 us ISR (E).
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

/* Real-time 500 us cage: 500e-6 s * 60 MHz = 30000 Timer2 cycles. The cage is
 * checked from the first successful PHASE_APPLY (first_apply_timer2), so a
 * pending is never committed after the window has elapsed (500us step). */
#define FIRST_REAL_PI_DURATION_CYCLES   30000UL

/* Pipeline phase ids. PHASE_COMPUTE runs PI + writes the pending structure
 * only; PHASE_APPLY re-verifies and commits (PWM registers) - never both in
 * the same 20 us ISR (RECOVERY V1 A). */
#define PIPELINE_PHASE_COMPUTE          0U
#define PIPELINE_PHASE_APPLY            1U

/* Shot state machine. */
#define SHOT_STATE_IDLE     0U
#define SHOT_STATE_ARMED    1U   /* authorized, waiting for first PI write */
#define SHOT_STATE_ACTIVE   2U   /* PI writing; shot timer running */
#define SHOT_STATE_COMPLETE 3U   /* 1 ms reached, normal bounded end */
#define SHOT_STATE_ABORTED  4U

/* Abort / completion reason codes. */
#define SHOT_ABORT_NONE       0U
#define SHOT_ABORT_TIMEOUT    1U   /* 1 ms elapsed (normal end) */
#define SHOT_ABORT_VOUT_11V   2U   /* Vout >= 11 V fast abort */
#define SHOT_ABORT_TZ         3U   /* real Comparator/TZ trip */
#define SHOT_ABORT_FAULT      4U   /* some other fault latched */
#define SHOT_ABORT_ACTUATOR   5U   /* pending commit validation failed */
#define SHOT_ABORT_PERMISSION 6U   /* a permission condition disappeared */
#define SHOT_ABORT_NO_HANDOFF 7U   /* SoftStart FINAL window expired without 10V handoff */
#define SHOT_ABORT_CEILING    8U   /* SoftStart hard ceiling (12V) reached during ramp */
#define SHOT_ABORT_TUTORIAL_BURST_ENTRY 9U  /* normal stop: tutorial light-load Burst entry */
#define SHOT_ABORT_TUTORIAL_BURST_RESTART_DONE 10U  /* normal stop: one Burst restart completed */

/* Tutorial CSS024DV2.1_PI Burst entry: period_request < 400 (i.e. frequency
 * request above ~150 kHz) -> PWM off / Burst active. This round only enters. */
#define TUTORIAL_MIN_BURST       400U

/* Minimal tutorial Burst state machine (STAGE6_TUTORIAL_BURST_RESTART_NOENERGY_CLOSURE_V1_1). */
#define BURST_STATE_NONE              0U
#define BURST_STATE_ON                1U
#define BURST_STATE_OFF_WAIT          2U
#define BURST_STATE_RESTART_ARMED     3U
#define BURST_STATE_RESTARTED         4U
#define BURST_STATE_FINAL_SAFE_STOP   5U
#define BURST_STATE_RESTART_PREPARED  6U

/* Software OST owner tracking. */
#define OST_OWNER_UNKNOWN         0U
#define OST_OWNER_BURST_SOFTWARE  1U
#define OST_OWNER_HARDWARE_TZ     2U
#define OST_OWNER_SAFETY_ABORT    3U

/* ------------------------------------------------------------------ */
/* B: pending structure - produced by PHASE_COMPUTE, consumed (once) by
 * PHASE_APPLY. Never written by the apply phase; apply only validates and
 * commits, then clears valid (no double commit). */
typedef struct
{
    Uint16 valid;            /* 1 = produced, not yet committed */
    Uint32 sequence;         /* ADC sample sequence the command was computed from */
    Uint32 command_hz;       /* clamped command, 145000..170000 */
    Uint16 period;           /* TBPRD (352..413) */
    Uint16 cmpa;             /* (period+1)/2 */
    Uint16 cmpb;             /* sample point = cmpa/2 */
    Uint32 actual_hz;        /* 60000000/(period+1) */
} SHOT_PipelinePending;

/* ------------------------------------------------------------------ */
/* E: ISR-side summary record (single instance, no ring). Updated only from
 * the 20 us ISR; read post-shot by CCS while halted. Keeps the per-tick ISR
 * record cost minimal while still proving first/last command, first TBPRD /
 * actual frequency, min/max command, max VOUT raw, phase counts, the abort
 * reason and the Timer2 first-apply/OST captures. */
typedef struct {
    Uint32 first_command_hz;
    Uint16 first_tbprd;
    Uint32 first_actual_hz;
    Uint32 last_command_hz;
    Uint32 max_command_hz;
    Uint32 min_command_hz;
    Uint16 max_vout_raw;
    Uint32 fast_ticks;         /* 20 us ticks from first apply to cage (D) */
    Uint32 pi_compute_count;   /* PHASE_COMPUTE successes on FRESH samples only */
    Uint32 pwm_apply_count;    /* PHASE_APPLY commits (expected 5) */
    Uint16 abort_reason;
    Uint32 first_apply_timer2;
    Uint32 ost_timer2;
    Uint32 entry_interval_max_shot;   /* shot-local Timer0/TINT0 entry max, reset at first apply, frozen at TIMEOUT */
    Uint32 entry_interval_min_shot;   /* shot-local entry min */
    Uint32 entry_over_1230_count;
    Uint32 entry_over_1500_count;
    Uint32 entry_over_2400_count;
    Uint32 entry_adjacent_max_shot;
    int16  first_error_raw;           /* signed PI error, first compute of the shot */
    int16  last_error_raw;           /* signed PI error, last compute before termination */
    int16  min_error_raw;            /* signed PI error, minimum (most negative) observed */
    int16  max_error_raw;            /* signed PI error, maximum (most positive) observed */
    /* --- STAGE6_1MS_LIGHTLOAD_ADC_FRESHNESS_AND_CONTROL_AUTHORITY_CLOSURE_V1 --- */
    Uint32 fresh_compute_count;      /* fresh ADC PI computations */
    Uint32 stale_compute_count;      /* repeated/stale ADC samples that did NOT produce a pending */
    Uint16 consecutive_stale_count;  /* shot-local consecutive stale counter, reset on fresh */
    Uint32 first_adc_sample_sequence;
    Uint32 last_adc_sample_sequence;
    Uint32 first_consumed_sequence;
    Uint32 last_consumed_sequence;
    Uint16 first_control_vout_raw;
    Uint16 last_control_vout_raw;
    Uint16 min_control_vout_raw;
    Uint16 max_control_vout_raw;
    Uint16 first_vref_raw;
    Uint16 last_vref_raw;
    /* Abort instant telemetry (frozen in SHOT_Revoke for non-timeout aborts). */
    Uint16 abort_adc_vout_raw;
    Uint16 abort_filtered_vout_raw;
    Uint16 abort_control_vout_raw;
    int16  abort_control_error_raw;
    Uint32 abort_frequency_hz;
    Uint16 abort_pipeline_phase;
    Uint32 abort_adc_sequence;
    Uint32 abort_consumed_sequence;
    Uint32 abort_timer2;
} SHOT_ShotSummary;

void   SHOT_Init(void);
Uint16 SHOT_PermissionOk(void);      /* D: all arm conditions */
Uint16 SHOT_WriteAllowed(void);      /* D per-tick gate: full on first write, dynamic-only after */
Uint16 SHOT_RealStage6AuthOk(void);  /* F2: bounded-shot Stage6 startup auth (REAL build only) */
Uint16 SHOT_RealSoftStartAuthOk(void);  /* C: runtime formal-SoftStart auth (REAL build only) */
Uint16 SHOT_RealBoundedPiAuthOk(void);  /* C: bounded-PI auth (REAL build only) */
Uint16 SHOT_ClampFreq(Uint32 *p_hz); /* B: clamp into 145..170k, returns 1 if clamped applied */
Uint16 SHOT_PendingValid(void);                 /* B: pending.valid == 1 and range-consistent */
Uint16 SHOT_PipelineApplyAuthorized(void);      /* B: full apply re-authorization (incl. RUN) */
void   SHOT_PendingCommit(void);                /* B: commit pending to PWM (apply phase only) */
void   SHOT_Revoke(Uint16 reason);   /* on-chip termination (E/F/C/D) */
void   SHOT_FastTask(void);          /* called from TINT0_ISR: cage + 11V abort + summary (E/D/F) */
void   SHOT_OnTrip(void);            /* called from real TZ ISR (G): revoke on real trip */
void   SHOT_EnterTutorialBurst(void);  /* normal stop: tutorial light-load Burst entry */
void   SHOT_BurstEnter(void);         /* enter Burst OFF, keep control running */
void   SHOT_BurstRestart(void);       /* one deterministic restart, then final safe stop */
Uint16 SHOT_BurstShadowControlAllowed(void);  /* Burst OFF shadow-control gate */

/* Non-static shot globals (CCS-visible by name). */
extern volatile Uint16 g_first_real_pi_shot_build;
extern volatile Uint16 g_first_real_pi_shot_arm;
extern volatile Uint16 g_first_real_pi_shot_state;
extern volatile Uint16 g_first_real_pi_shot_tick;
extern volatile Uint16 g_first_real_pi_shot_abort;
extern volatile Uint16 g_first_real_pi_shot_power_writes;
extern volatile Uint16 g_first_real_pi_shot_ok;
extern volatile Uint16 g_first_real_pi_shot_abort_vout_raw;
extern volatile Uint16 g_pipeline_phase;        /* 0 = compute, 1 = apply */
extern volatile Uint16 g_pipeline_executed_phase; /* this tick's phase (0/1/0xFF none) */
extern SHOT_PipelinePending g_pipeline_pending;
extern SHOT_ShotSummary g_shot_summary;
/* H: Timer2 captures for the first-apply -> OST elapsed proof. */
extern volatile Uint32 g_first_real_pi_shot_first_write_timer2;
extern volatile Uint32 g_first_real_pi_shot_ost_timer2;
#if !STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD
/* Test-only debug overrides: compiled OUT of the REAL shot binary. */
extern volatile Uint32 g_first_shot_debug_freq_hz;
extern volatile Uint16 g_first_shot_debug_ticks;
#endif

#endif /* APP_SHOT_H */
