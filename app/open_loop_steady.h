/*
 * open_loop_steady.h
 *
 * W2_OPEN_LOOP_STEADY_STATE_PLANT_CHARACTERIZATION_V1
 *
 * Independent OPEN_LOOP_STEADY experimental mode (dedicated build macro
 * STAGE6_OPEN_LOOP_STEADY_BUILD, mutually exclusive with the bounded-shot
 * build macros). Purpose: characterize the REAL steady-state plant
 * (Frequency -> Vout) of the actual F28034 + LLC power board. This is NOT a
 * closed loop: the PI is completely bypassed (TINT0 dispatches this module
 * instead of CTRL_FastTask), the switching frequency is owned by
 * g_open_loop_frequency_command_hz, slew-limited per fresh ADC sample, and
 * every run ends in a PLANNED OST stop (PWM=0 / OST=1 / TZINT=0).
 *
 * Power path: safe start (Stage 5A deterministic enable at the fixed safe
 * entry frequency) -> OPEN_LOOP_STEADY (slew to target, settle, steady) ->
 * planned OST stop. Protection is UNCHANGED: Comparator/TZ1 + DAC300 OCP,
 * ADC freshness monitor, PWM topology validation, 12V hardware ceiling.
 * This module ADDS two tighter experiment-only VOUT guards:
 *   - WARNING raw (10.5V): stop descending, planned OST, mark
 *     OPEN_LOOP_UPPER_GAIN_BOUNDARY (never approach the 11V hard gate).
 *   - HARD ABORT raw (11V, same frozen formula as the bounded shot):
 *     immediate PWM_Trip(FAULT_OPEN_LOOP_VOUT_CEILING).
 */
#ifndef APP_OPEN_LOOP_STEADY_H
#define APP_OPEN_LOOP_STEADY_H

#include "DSP2803x_Device.h"
#include "llc_config.h"
#include "board_calibration.h"

/* ------------------------------------------------------------------ */
/* Build gating                                                        */
/* ------------------------------------------------------------------ */
#if !defined(STAGE6_OPEN_LOOP_STEADY_BUILD)
#define STAGE6_OPEN_LOOP_STEADY_BUILD 0
#endif

/* ------------------------------------------------------------------ */
/* Phase-1 experimental frequency envelope (task: 145..170 kHz)        */
/* Compile-time, enforced in LLC_SetFrequencyHz + protection + SM.     */
/* Production builds are untouched (this file is inert without the     */
/* STAGE6_OPEN_LOOP_STEADY_BUILD macro).                               */
/* ------------------------------------------------------------------ */
#define OPEN_LOOP_FREQ_MIN_HZ           145000UL
#define OPEN_LOOP_FREQ_MAX_HZ           170000UL
/* Fixed safe cold-start frequency = envelope max = lowest LLC gain. */
#define OPEN_LOOP_ENTRY_FREQ_HZ         OPEN_LOOP_FREQ_MAX_HZ

/* Slew limit per fresh ADC sample (task: OPEN_LOOP_FREQ_SLEW_HZ_PER_SAMPLE,
 * suggested initial 500 Hz/sample). Host-writable within a compile ceiling
 * so a scripting error can never command an instantaneous frequency jump. */
#define OPEN_LOOP_FREQ_SLEW_DEFAULT_HZ  500UL
#define OPEN_LOOP_FREQ_SLEW_MIN_HZ      10UL
#define OPEN_LOOP_FREQ_SLEW_MAX_HZ      5000UL

/* Experiment-only VOUT guards (protection system itself is unchanged):
 * WARNING = 10V handoff target + the frozen pre-brake high-edge offset (60
 * raw) -> 1304 (~10.49 V). HARD = the SAME frozen 11 V formula used by the
 * bounded shot (raw = (11.0 - offset) / gain = 1367). */
#define OPEN_LOOP_VOUT_WARNING_RAW      ((Uint16)(BOARD_VOUT_RAW_10V + 60U))
#define OPEN_LOOP_VOUT_HARD_ABORT_RAW   \
    ((Uint16)((11.0f - BOARD_VOUT_OFFSET_V) / BOARD_VOUT_GAIN_V_PER_RAW))

/* Steady-state windows (20 us TINT0 ticks): rolling 100 ms window, first
 * 200 ms after slew completion excluded from the steady decision, steady
 * reached after 2 consecutive windows whose means differ by <= 3 raw. */
#define OPEN_LOOP_WINDOW_TICKS          5000UL    /* 100 ms */
#define OPEN_LOOP_SETTLE_MIN_TICKS      10000UL   /* 200 ms transient exclusion */
#define OPEN_LOOP_STEADY_DELTA_RAW      3U
#define OPEN_LOOP_STEADY_WINDOWS_REQ    2U
#define OPEN_LOOP_MAX_HOLD_TICKS        600000UL  /* 12 s backstop timeout */

/* Phases (g_open_loop_phase) */
#define OL_PHASE_IDLE      0U
#define OL_PHASE_SLEWING   1U
#define OL_PHASE_SETTLING  2U
#define OL_PHASE_STEADY    3U
#define OL_PHASE_STOPPED   4U

/* Stop reasons (g_open_loop_stop_reason) */
#define OL_STOP_NONE            0U
#define OL_STOP_HOST            1U   /* host planned OST (falling edge) */
#define OL_STOP_WARNING         2U   /* Vout >= WARNING -> upper gain boundary */
#define OL_STOP_HARD_VOUT       3U   /* Vout >= 11V hard abort (PWM_Trip) */
#define OL_STOP_TIMEOUT         4U   /* max hold backstop */
#define OL_STOP_FAULT_EXTERNAL  5U   /* COMP/TZ/stale/other protection fault */

/* ------------------------------------------------------------------ */
/* Control / telemetry variables (CCS/DSS visible)                     */
/* ------------------------------------------------------------------ */
extern volatile Uint16 g_open_loop_steady_active;        /* 1 while powered session runs */
extern volatile Uint32 g_open_loop_frequency_command_hz; /* HOST target command */
extern volatile Uint32 g_open_loop_freq_slew_hz_per_sample;
extern volatile Uint32 g_open_loop_entry_hz;
extern volatile Uint32 g_open_loop_applied_hz;           /* slewed actuator command */
extern volatile Uint32 g_open_loop_cmd_effective_hz;     /* host command clamped to envelope */
extern volatile Uint32 g_open_loop_cmd_clamp_count;
extern volatile Uint32 g_open_loop_slew_steps;
extern volatile Uint16 g_open_loop_phase;
extern volatile Uint16 g_open_loop_steady_reached;
extern volatile Uint32 g_open_loop_ticks_active;
extern volatile Uint32 g_open_loop_slew_done_tick;
extern volatile Uint32 g_open_loop_settle_ms;
extern volatile Uint32 g_open_loop_steady_ticks;         /* time spent in STEADY */
/* live samples */
extern volatile Uint16 g_open_loop_last_vout_raw;
extern volatile Uint16 g_open_loop_last_vout_filtered_raw;
extern volatile Uint16 g_open_loop_last_ipri_raw;
/* rolling 100 ms window (published at each window roll) */
extern volatile Uint16 g_open_loop_win_mean_raw;
extern volatile Uint16 g_open_loop_win_prev_mean_raw;
extern volatile Uint16 g_open_loop_win_min_raw;
extern volatile Uint16 g_open_loop_win_max_raw;
extern volatile Uint16 g_open_loop_win_ipri_mean_raw;
extern volatile Uint16 g_open_loop_win_ipri_max_raw;
extern volatile Uint32 g_open_loop_win_compsts_high;
extern volatile Uint32 g_open_loop_win_stale_ticks;
extern volatile Uint32 g_open_loop_win_index;
/* steady-window accumulator (from steady_reached until stop) */
extern volatile Uint32 g_open_loop_ss_ticks;
extern volatile Uint32 g_open_loop_ss_vout_sum;
extern volatile Uint16 g_open_loop_ss_min_raw;
extern volatile Uint16 g_open_loop_ss_max_raw;
extern volatile Uint32 g_open_loop_ss_ipri_sum;
extern volatile Uint16 g_open_loop_ss_ipri_max_raw;
/* stop snapshot (frozen at the first stop) */
extern volatile Uint16 g_open_loop_stop_reason;
extern volatile Uint16 g_open_loop_upper_gain_boundary;
extern volatile Uint16 g_open_loop_stop_tbprd;
extern volatile Uint32 g_open_loop_stop_freq_actual;
extern volatile Uint32 g_open_loop_stop_freq_applied;
extern volatile Uint32 g_open_loop_stop_cmd;
extern volatile Uint16 g_open_loop_stop_mean_raw;
extern volatile Uint16 g_open_loop_stop_min_raw;
extern volatile Uint16 g_open_loop_stop_max_raw;
extern volatile Uint16 g_open_loop_stop_ipri_mean_raw;
extern volatile Uint16 g_open_loop_stop_ipri_max_raw;
extern volatile Uint32 g_open_loop_stop_compsts_high;
extern volatile Uint32 g_open_loop_stop_tz_events;
extern volatile Uint32 g_open_loop_stop_stale_ticks;
extern volatile Uint16 g_open_loop_stop_pwm;
extern volatile Uint16 g_open_loop_stop_ost;
extern volatile Uint16 g_open_loop_stop_tzint;
extern volatile Uint32 g_open_loop_stop_fault;
extern volatile Uint32 g_open_loop_stop_timer2;

#if STAGE6_OPEN_LOOP_STEADY_BUILD && STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
/* No-energy harness only: synthetic Vout source + entry/exit triggers. The
 * REAL build has none of these symbols (synthetic-free). */
extern volatile Uint16 g_open_loop_ne_test_enable;
extern volatile Uint16 g_open_loop_ne_entry_request;
extern volatile Uint16 g_open_loop_ne_exit_request;
extern volatile Uint16 g_open_loop_ne_raw;
extern volatile Uint16 g_open_loop_ne_actuator_arm;   /* actuator writes under OST */
extern volatile Uint32 g_open_loop_ne_max_hold_ticks; /* 0 = compile default */
extern volatile Uint32 g_open_loop_ne_tick;
extern volatile Uint32 g_open_loop_ne_trace[16];      /* first 16 slew steps */
#endif

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */
void OPENLOOP_Init(void);
void OPENLOOP_FastTask(void);        /* TINT0 20 us task (real build) */
void OPENLOOP_NotifyEntry(void);     /* SM: after deterministic PWM enable */
void OPENLOOP_NotifyExit(void);      /* SM: planned OST falling edge */

#if STAGE6_OPEN_LOOP_STEADY_BUILD && STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST
void OPENLOOP_NoEnergyTick(void);    /* NE harness tick (synthetic raw) */
#endif

#endif /* APP_OPEN_LOOP_STEADY_H */
