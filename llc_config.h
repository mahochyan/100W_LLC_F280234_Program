/*
 * llc_config.h
 *
 * Central compile-time configuration for the F28034 LLC bring-up firmware.
 * Only RAM/debug configuration is targeted in this round.
 */

#ifndef LLC_CONFIG_H
#define LLC_CONFIG_H

#include "DSP2803x_Device.h"

/* ------------------------------------------------------------------ */
/* Clock / PWM baseline (user-confirmed)                               */
/* ------------------------------------------------------------------ */
#define LLC_TBCLK_HZ                    60000000UL
#define LLC_DEFAULT_FREQUENCY_HZ        150000UL
#define LLC_STAGE2_MIN_HZ               70000UL
#define LLC_STAGE2_MAX_HZ               150000UL
#define LLC_HARD_MIN_HZ                 35000UL
#define LLC_HARD_MAX_HZ                 150000UL
#define LLC_DIAG_MAX_HZ                 250000UL   /* diagnostic override ceiling only */
#define LLC_DIAG_ALLOW_200K_DB140       1U          /* BRINGUP_DIAGNOSTIC_LEGACY only */
#define LLC_DIAG_ALLOW_250K_DB110       1U          /* BRINGUP_DIAGNOSTIC only */
#define LLC_DEADBAND_TICKS              36U
#define LLC_MIN_PULSE_TICKS             4U
#define LLC_BASELINE_PERIOD_150K        399U
#define LLC_BASELINE_CMPA_150K          200U

/* ------------------------------------------------------------------ */
/* Bring-up stage / system state enumerations                          */
/* ------------------------------------------------------------------ */
typedef enum
{
    BRINGUP_STAGE_0_SAFE = 0,
    BRINGUP_STAGE_1_PWM_FIXED,
    BRINGUP_STAGE_2_PFM_MANUAL,
    BRINGUP_STAGE_3_ADC_MONITOR,
    BRINGUP_STAGE_4_PROTECTION_TEST,
    BRINGUP_STAGE_5A_OPEN_LOOP_MANUAL,
    BRINGUP_STAGE_5B_SOFT_START_TEST,
    BRINGUP_STAGE_6_CLOSED_LOOP,
    BRINGUP_STAGE_7_POWER_RUN
} LLC_BringupStage;

typedef enum
{
    SYS_STATE_INIT = 0,
    SYS_STATE_IDLE,
    SYS_STATE_SOFT_START,
    SYS_STATE_RUN,
    SYS_STATE_FAULT
} LLC_SystemState;

/* Power-window state for distinguishing ACTIVE vs POST_OST TZ events. */
#define POWER_WINDOW_IDLE      0U
#define POWER_WINDOW_ACTIVE    1U
#define POWER_WINDOW_POST_OST  2U

/* ------------------------------------------------------------------ */
/* Fault flag bits                                                    */
/* ------------------------------------------------------------------ */
#define FAULT_INIT_CLOCK                0x00000001UL
#define FAULT_ILLEGAL_STAGE             0x00000002UL
#define FAULT_ILLEGAL_FREQUENCY         0x00000004UL
#define FAULT_PWM_CONFIG_MISMATCH       0x00000008UL
#define FAULT_COMP_TZ1                  0x00000010UL
#define FAULT_FORCE_TRIP                0x00000020UL
#define FAULT_ADC_STALE_OVERFLOW        0x00000040UL
#define FAULT_ADC_RAW_FAST              0x00000080UL
#define FAULT_VOUT_OVP                  0x00000100UL
#define FAULT_IOUT_OCP                  0x00000200UL
#define FAULT_VOUT_UVP                  0x00000400UL
#define FAULT_CAL_MISSING               0x00000800UL
#define FAULT_CONTROL_DIRECTION         0x00001000UL
#define FAULT_STAGE_GATE                0x00002000UL
#define FAULT_COMP_TZ_LOOPBACK          0x00004000UL
#define FAULT_COMP_PRESTART_REJECT     0x00008000UL

/* ------------------------------------------------------------------ */
/* ADC / control timing and thresholds (placeholders pending cal)     */
/* ------------------------------------------------------------------ */
#define LLC_FAST_TASK_US                20U
#define LLC_SLOW_TASK_MS                5U
#define LLC_FAST_TICKS_PER_SLOW         ((LLC_SLOW_TASK_MS * 1000U) / LLC_FAST_TASK_US)

#define LLC_SOFTSTART_START_HZ          150000UL
#define LLC_POWER_PROBE_MAX_US          2000UL
#define LLC_SINGLE_CYCLE_PROBE_DAC       300U
#define LLC_VOUT_PROBE_DAC_DEFAULT       300U   /* keep existing bring-up DAC; not final OCP */
#define LLC_MULTI_CYCLE_PROBE_MAX_CYCLES  150UL
#define LLC_VOUT_PROBE_MAX_CYCLES        300UL
#define LLC_VOUT_PROBE_HARD_LIMIT_RAW    1470U
#define LLC_SOFTSTART_RAMP_HZ_PER_5MS   500UL
#define LLC_OPEN_LOOP_INITIAL_MIN_HZ    100000UL   /* first-power candidate; unlock by test */
#define LLC_POWER_RUN_INITIAL_MIN_HZ    70000UL    /* candidate only, not yet verified */

/* Thresholds are intentionally disabled until ADC/comparator are calibrated. */
#define LLC_OVP_RAW_THRESHOLD           0xFFFFU
#define LLC_OCP_RAW_THRESHOLD           0xFFFFU
#define LLC_UVP_RAW_THRESHOLD           0xFFFFU

/* ------------------------------------------------------------------ */
/* Feature gates that must be confirmed manually in CCS before use     */
/* ------------------------------------------------------------------ */
#define LLC_POWER_RUN_ALLOWED           0U
#define LLC_CONTROL_DIRECTION           0   /* 0 = unconfirmed; set to +1 or -1 for Stage 6 */
#define BOARD_MAPPING_PENDING_PHYSICAL_VERIFY 1U

/* OFFBENCH_LLC_VIRTUAL_BOARD_CHARACTERIZATION_V1: PI/PFM 仅虚拟环境验证。
 * LLC_VIRTUAL_PI_VALIDATED=1 不代表真实板可闭环；LLC_HARDWARE_PI_VALIDATED
 * 必须保持 0 直到真实板验证。禁止因虚拟 PASS 自动开启真实闭环。 */
#define LLC_VIRTUAL_PI_VALIDATED        1U
#define LLC_HARDWARE_PI_VALIDATED       0U

#endif /* LLC_CONFIG_H */

/* Calibration Hold Probe */
#define LLC_CAL_HOLD_CHARGE_TARGET_RAW   1400U
#define LLC_CAL_HOLD_HARD_LIMIT_RAW      1450U
#define LLC_CAL_HOLD_HIGH_RAW            1400U
#define LLC_CAL_HOLD_LOW_RAW             1380U
#define LLC_CAL_HOLD_MAX_PACKET_CYCLES   1UL   /* first true 1-cycle packet per bring-up decision */
#define LLC_CAL_HOLD_MAX_TOTAL_EXTRA_CYCLES 600UL
#define LLC_CAL_HOLD_DEFAULT_DURATION_MS 500UL
