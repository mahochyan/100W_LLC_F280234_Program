/*
 * control_profile.h
 *
 * Stage6 PI firmware shadow control profile.
 *
 * This is the ONLY production (non-diagnostic) PI profile currently linked.
 * It carries the single validated shadow candidate from the Stage6 SIL pass:
 *
 *     CANDIDATE_B_BALANCED
 *     Kp      = 6657.43331  Hz/V
 *     Ki_step = 44.3828888  Hz/(V * 20us)      (per 20us fast-task step)
 *     Ki_cont = 2219144.438 Hz/(V * s)         (= Ki_step / 20us, for reference)
 *
 * Source: STAGE6_PI_SIL_TUNING_V2_1 (commit 51a4b94)
 *         STAGE6_PI_SIL_TUNING_V2_1_PASS, RECOMMENDED_BALANCED.
 *
 * IMPORTANT GATE SEMANTICS
 * ------------------------
 * PI parameters being compiled into the firmware binary does NOT mean the PI
 * has gained any hardware control authority. The shadow control path never
 * writes real ePWM registers; the real PWM write is a SEPARATE, independent
 * gate controlled ONLY by LLC_HARDWARE_PI_VALIDATED (which must stay 0 for
 * this Stage 6 shadow integration). A validated PI candidate must never
 * auto-unlock hardware — the two are fully independent.
 *
 * The FASTEST candidate (CANDIDATE_C) from SIL is intentionally NOT placed in
 * runtime code. It remains only in docs/ (SIL). This profile is conservative
 * and virtual-only.
 */
#ifndef APP_CONTROL_PROFILE_H
#define APP_CONTROL_PROFILE_H

/* ---- Profile identification ----------------------------------------- */
#define CTRL_PI_PROFILE_STAGE6_BALANCED      1U          /* the one active profile */
#define CTRL_PI_PROFILE_ID                   0x060201UL  /* Stage6 V2_1 BALANCED */

/* ---- Coefficients (source: STAGE6_PI_SIL_TUNING_V2_1, commit 51a4b94) -- */
#define CTRL_PI_KP_HZ_PER_V                  6657.43331f
#define CTRL_PI_KI_STEP_HZ_PER_V_STEP        44.3828888f

/* ---- Gate flags ------------------------------------------------------ */
/* This candidate is a SIL / virtual-only candidate, NOT hardware-tuned. */
#define CTRL_PI_PROFILE_VIRTUAL_ONLY         1U
#define CTRL_PI_PROFILE_HARDWARE_VALIDATED   0U

/* ---- Profile-internal consistency (guards the profile file itself) ---
 * These compile-time checks are deliberately placed in this header so that
 * a bad profile value fails the build immediately, independent of any other
 * translation unit. The cross-check against LLC_HARDWARE_PI_VALIDATED lives
 * in control.c (after llc_config.h has been included). */
#if (CTRL_PI_PROFILE_VIRTUAL_ONLY != 1U)
#error "control_profile.h: profile must be VIRTUAL_ONLY in this Stage"
#endif
#if (CTRL_PI_PROFILE_HARDWARE_VALIDATED != 0U)
#error "control_profile.h: profile must NOT claim hardware validation"
#endif
#if ((CTRL_PI_PROFILE_ID) != 0x060201UL)
#error "control_profile.h: unexpected profile id (not STAGE6 V2.1 BALANCED)"
#endif

#endif /* APP_CONTROL_PROFILE_H */
