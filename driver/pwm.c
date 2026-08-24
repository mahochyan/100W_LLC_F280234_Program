/*
 * pwm.c
 *
 * ePWM1A/ePWM1B 150 kHz LLC gate drive with 36-tick software dead-band.
 *
 * Frozen configuration:
 *   TB_COUNT_UP, TBCLK = 60 MHz, TBPRD = 400, CMPA = 200,
 *   DBRED = DBFED = 36, TZ1 one-shot forces both outputs low.
 */

#include "DSP2803x_Device.h"
#include "DSP2803x_Examples.h"
#include "llc_config.h"
#include "llc_globals.h"
#include "pwm.h"
#include "adc.h"
#include "shot.h"

/*
 * D (RECOVERY V1): read-only Flash table of actual switching frequencies for
 * the bounded PI envelope. actual_hz[period - 352] = 60000000 / (period + 1),
 * integer division, identical to the reference formula used by the generic
 * path. The bounded PI fastpath must not run a runtime 32-bit division.
 * Covers TBPRD 352..413 (145000..170000 Hz envelope).
 */
const Uint32 g_real_pi_actual_hz_table[62] = {
    169971UL, 169491UL, 169014UL, 168539UL, 168067UL, 167597UL, 167130UL, 166666UL,
    166204UL, 165745UL, 165289UL, 164835UL, 164383UL, 163934UL, 163487UL, 163043UL,
    162601UL, 162162UL, 161725UL, 161290UL, 160857UL, 160427UL, 160000UL, 159574UL,
    159151UL, 158730UL, 158311UL, 157894UL, 157480UL, 157068UL, 156657UL, 156250UL,
    155844UL, 155440UL, 155038UL, 154639UL, 154241UL, 153846UL, 153452UL, 153061UL,
    152671UL, 152284UL, 151898UL, 151515UL, 151133UL, 150753UL, 150375UL, 150000UL,
    149625UL, 149253UL, 148883UL, 148514UL, 148148UL, 147783UL, 147420UL, 147058UL,
    146699UL, 146341UL, 145985UL, 145631UL, 145278UL, 144927UL,
};

/*
 * PWM_Init
 *
 * Safe bring-up order:
 *   1. GPIO0/1 are first kept as GPIO outputs low.
 *   2. TBCLKSYNC is cleared so the ePWM time base is not running yet.
 *   3. ePWM1/DB/TZ are configured.
 *   4. One-shot TZ is forced so A/B are clamped low.
 *   5. Only then GPIO0/1 are switched to EPWM1A/1B.
 *   6. TBCLKSYNC is set to start the time base with outputs still clamped.
 */
void PWM_Init(void)
{
    EALLOW;

    /* Peripheral clock for ePWM1 */
    SysCtrlRegs.PCLKCR1.bit.EPWM1ENCLK = 1;

    /* Stop TBCLK while configuring */
    SysCtrlRegs.PCLKCR0.bit.TBCLKSYNC = 0;

    /* GPIO0/1 as plain outputs, driven low before PWM mux is switched */
    GpioCtrlRegs.GPAMUX1.bit.GPIO0 = 0;
    GpioCtrlRegs.GPAMUX1.bit.GPIO1 = 0;
    GpioCtrlRegs.GPADIR.bit.GPIO0 = 1;
    GpioCtrlRegs.GPADIR.bit.GPIO1 = 1;
    GpioDataRegs.GPACLEAR.bit.GPIO0 = 1;
    GpioDataRegs.GPACLEAR.bit.GPIO1 = 1;

    /* TZ1 input and COMP1OUT (candidate physical path, pending verification) */
    GpioCtrlRegs.GPAMUX1.bit.GPIO15 = 1;   /* GPIO15 = TZ1 */
    GpioCtrlRegs.GPBMUX1.bit.GPIO42 = 3;   /* GPIO42 = COMP1OUT */

    /* Time-base: up-count, 60 MHz TBCLK, shadow period load */
    EPwm1Regs.TBCTL.all = 0U;
    EPwm1Regs.TBPRD = LLC_BASELINE_PERIOD_150K;
    EPwm1Regs.TBPHS.half.TBPHS = 0U;
    EPwm1Regs.TBCTL.bit.CTRMODE   = TB_COUNT_UP;
    EPwm1Regs.TBCTL.bit.PHSEN     = TB_DISABLE;
    EPwm1Regs.TBCTL.bit.PRDLD     = TB_SHADOW;
    EPwm1Regs.TBCTL.bit.SYNCOSEL  = TB_SYNC_DISABLE;
    EPwm1Regs.TBCTL.bit.HSPCLKDIV = TB_DIV1;
    EPwm1Regs.TBCTL.bit.CLKDIV    = TB_DIV1;

    /* Compare A shadow, load at CTR = zero */
    EPwm1Regs.CMPCTL.all = 0U;
    EPwm1Regs.CMPCTL.bit.SHDWAMODE = CC_SHADOW;
    EPwm1Regs.CMPCTL.bit.SHDWBMODE = CC_SHADOW;
    EPwm1Regs.CMPCTL.bit.LOADAMODE = CC_CTR_ZERO;
    EPwm1Regs.CMPCTL.bit.LOADBMODE = CC_CTR_ZERO;

    /* 50% compare on A; dead-band derives complementary B */
    EPwm1Regs.CMPA.half.CMPA = LLC_BASELINE_CMPA_150K;
    EPwm1Regs.CMPB = 0U;

    EPwm1Regs.AQCTLA.all = 0U;
    EPwm1Regs.AQCTLA.bit.ZRO = AQ_SET;
    EPwm1Regs.AQCTLA.bit.CAU = AQ_CLEAR;
    EPwm1Regs.AQCTLB.all = 0U;

    /* Full dead-band, active-high complementary, 36-tick delays */
    EPwm1Regs.DBCTL.all = 0U;
    EPwm1Regs.DBCTL.bit.OUT_MODE = DB_FULL_ENABLE;
    EPwm1Regs.DBCTL.bit.POLSEL   = DB_ACTV_HIC;
    EPwm1Regs.DBCTL.bit.IN_MODE  = DBA_ALL;
    EPwm1Regs.DBRED = LLC_DEADBAND_TICKS;
    EPwm1Regs.DBFED = LLC_DEADBAND_TICKS;

    /* Trip zone: one-shot TZ1, force A/B low, interrupts initially disabled */
    EPwm1Regs.TZSEL.all = 0U;
    EPwm1Regs.TZSEL.bit.OSHT1 = TZ_ENABLE;
    EPwm1Regs.TZCTL.all = 0U;
    EPwm1Regs.TZCTL.bit.TZA = TZ_FORCE_LO;
    EPwm1Regs.TZCTL.bit.TZB = TZ_FORCE_LO;
    EPwm1Regs.TZCLR.all = 0xFFFFU;
    g_probe_tzclr_write_count++;
    EPwm1Regs.TZEINT.all = 0U;
    EPwm1Regs.TZFRC.bit.OST = 1U;          /* latch outputs low */

    /* Switch GPIO0/1 to EPWM1A/1B */
    GpioCtrlRegs.GPAMUX1.bit.GPIO0 = 1;
    GpioCtrlRegs.GPAMUX1.bit.GPIO1 = 1;

    /* Start TBCLK; outputs remain low because OST is still latched */
    SysCtrlRegs.PCLKCR0.bit.TBCLKSYNC = 1;

    EDIS;

    g_pwm_period = LLC_BASELINE_PERIOD_150K;
    g_switching_frequency_hz = LLC_DEFAULT_FREQUENCY_HZ;
    g_actual_switching_frequency_hz = LLC_TBCLK_HZ / (LLC_BASELINE_PERIOD_150K + 1UL);
    g_pwm_enabled = 0U;
    g_pwm_enable_result = 0U;
}

Uint16 PWM_ConfigTopologyValid(void)
{
    if (EPwm1Regs.TBCTL.bit.CTRMODE   != TB_COUNT_UP) return 0U;
    if (EPwm1Regs.TBCTL.bit.HSPCLKDIV != TB_DIV1)    return 0U;
    if (EPwm1Regs.TBCTL.bit.CLKDIV    != TB_DIV1)    return 0U;
    if (EPwm1Regs.TBCTL.bit.PRDLD     != TB_SHADOW)  return 0U;
    if (EPwm1Regs.CMPCTL.bit.SHDWAMODE != CC_SHADOW) return 0U;
    if (EPwm1Regs.CMPCTL.bit.LOADAMODE != CC_CTR_ZERO) return 0U;
    if (EPwm1Regs.AQCTLA.bit.ZRO != AQ_SET)          return 0U;
    if (EPwm1Regs.AQCTLA.bit.CAU != AQ_CLEAR)        return 0U;
    if (EPwm1Regs.AQCTLB.all != 0U)                  return 0U;
    if (EPwm1Regs.DBCTL.bit.OUT_MODE != DB_FULL_ENABLE) return 0U;
    if (EPwm1Regs.DBCTL.bit.POLSEL   != DB_ACTV_HIC) return 0U;
    if (EPwm1Regs.DBCTL.bit.IN_MODE  != DBA_ALL)     return 0U;
    if (EPwm1Regs.TZSEL.bit.OSHT1 != TZ_ENABLE)      return 0U;
    if (EPwm1Regs.TZCTL.bit.TZA != TZ_FORCE_LO)      return 0U;
    if (EPwm1Regs.TZCTL.bit.TZB != TZ_FORCE_LO)      return 0U;
    return 1U;
}

Uint16 PWM_RuntimeValuesValid(Uint32 period, Uint16 deadtime)
{
    Uint32 cmp;

    if (period < 2UL || period > 0xFFFFUL) return 0U;
    if (deadtime > 0xFFFFU) return 0U;

    /* Current safe profile range (Profile B). */
#if !STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD
#if LLC_DIAG_ALLOW_200K_DB140 || LLC_DIAG_ALLOW_250K_DB110
    if (g_diag_frequency_override != 0U &&
        ((period == 299UL && deadtime >= 120U && deadtime <= 140U) ||
         (period >= 239UL && period <= 399UL &&
          deadtime >= 36U && deadtime <= 110U)))
    {
        /* BRINGUP_DIAGNOSTIC: explicit diagnostic profiles only.
         * 200 kHz / DB140..DB120,
         * 250 kHz accelerated bounded softstart DB110..DB36,
         * and Phase B period 239..399 at DB36.
         * Production SoftStart Profile is unchanged. */
    }
    else
#endif
#endif
    {
#if STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD
        /* B: REAL bounded-shot build. The formal Profile C trajectory
         * (250 kHz / TBPRD239 / DB110 .. 150 kHz / TBPRD399 / DB36) is allowed
         * ONLY while the runtime SoftStart limited authorization holds (formal
         * ramp actually running, shot pre-armed, VOUT cal + Comp/TZ loopback
         * verified, no fault). Outside that context the production range
         * applies, so a 200k/250k write can never slip through any other path. */
        if (SHOT_RealSoftStartAuthOk() != 0U)
        {
            if (period < 239UL || period > 399UL) return 0U;
            if (deadtime < 36U || deadtime > 110U) return 0U;
        }
        else
#endif
        {
            if (period < 399UL || period > 428UL) return 0U;
            if (deadtime < 36U || deadtime > 190U) return 0U;
        }
    }

    cmp = (period + 1UL) / 2UL;
    if (cmp <= (Uint32)deadtime + LLC_MIN_PULSE_TICKS) return 0U;
    if ((period - cmp) <= (Uint32)deadtime + LLC_MIN_PULSE_TICKS) return 0U;
    return 1U;
}

Uint16 PWM_ConfigMatchesFrozenBaseline(void)
{
    /* Historical name retained for legacy probes; now checks topology only.
     * Runtime dead-time is intentionally allowed to vary (36..190). */
    return PWM_ConfigTopologyValid();
}

/*
 * LLC_SetFrequencyHz
 *
 * Computes TBPRD/CMPA from TBCLK and requested frequency.  It refuses to
 * operate unless the PWM is still in the frozen configuration.  Shadow
 * registers are updated in a short critical section.
 */
Uint16 LLC_SetFrequencyHz(Uint32 hz)
{
    Uint32 period;
    Uint32 cmp;
    Uint16 ok;

    if (hz == 0UL) return 0U;
    if (hz < LLC_HARD_MIN_HZ) return 0U;
#if STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
    /* First bounded real PI shot build: the actuator accepts only the shot
     * envelope (145..170 kHz). Anything above FIRST_REAL_PI_MAX_HZ is rejected
     * (never 200k / 250k), even if a diagnostic override were present. */
    if (hz > FIRST_REAL_PI_MAX_HZ) return 0U;
#else
    if (hz > LLC_HARD_MAX_HZ)
    {
        /* Diagnostic override: allow only up to LLC_DIAG_MAX_HZ and only when
         * explicitly enabled by the bring-up script. This is not a change to
         * the formal working-frequency envelope. */
        if (g_diag_frequency_override == 0U || hz > LLC_DIAG_MAX_HZ) return 0U;
    }
#endif

    /* Correction #3: never auto-adapt to a changed PWM mode. The topology
     * (count mode, clock div, dead-band, AQ, TZ) is validated at enable /
     * handoff and is fixed during RUN. Once g_pwm_fastpath_ready is set the
     * per-tick re-validation is skipped (the closed-loop writes every 20 us and
     * the redundant register re-read dominates the actuator cost). The caller
     * set fastpath_ready only after a full validation succeeded. */
    if (g_pwm_fastpath_ready == 0U &&
        PWM_ConfigMatchesFrozenBaseline() == 0U)
    {
        PWM_Trip(FAULT_PWM_CONFIG_MISMATCH, 0U);
        return 0U;
    }

    /*
     * Closed-loop fast path: the Q12 PI steps the command by at most 100 Hz per
     * 20 us tick, so the frequency is very often unchanged between ticks. When
     * the commanded frequency is identical to the last applied one, the period
     * (and TBPRD/CMPA/CMPB) is already correct and the expensive period divide
     * + write is skipped. This is what lets the real actuator fit the 20 us
     * budget. The first call after any frequency change still recomputes.
     */
    if (hz == g_switching_frequency_hz && g_pwm_period != 0U)
    {
        g_switching_frequency_hz = hz;
        return 1U;
    }

#if STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
    /*
     * C (RECOVERY V1): bounded PI fastpath - no 32-bit division.
     * Valid only inside the bounded envelope (145..170 kHz) with the period
     * already matching the previous command (g_pwm_period != 0). The Q12 PI
     * steps by at most 100 Hz/tick, so the period can only change by 0 or
     * +/-1. Adjacent-period decision with the exact same rounding as the
     * reference division:
     *   sum    = 60000000 + hz/2
     *   clocks = g_pwm_period + 1
     *   if ((clocks+1)*hz <= sum) clocks++
     *   else if (clocks*hz > sum)  clocks--
     *   period = clocks - 1
     * The result is verified by multiplication (no division): clocks must
     * satisfy clocks*hz <= sum < (clocks+1)*hz, i.e. clocks == floor(sum/hz).
     * If one adjustment is not enough (the period would move by more than
     * +/-1, or the state does not match the command), the actuator refuses
     * to write a wrong period: SHOT_Revoke(SHOT_ABORT_ACTUATOR) -> OST,
     * PWM=0, FAULT_FIRST_SHOT_ABORT, safe failure.
     */
    if (hz >= FIRST_REAL_PI_MIN_HZ && hz <= FIRST_REAL_PI_MAX_HZ &&
        g_pwm_period != 0U)
    {
        Uint32 sum = LLC_TBCLK_HZ + (hz / 2UL);
        Uint32 clocks = (Uint32)g_pwm_period + 1UL;
        if ((clocks + 1UL) * hz <= sum) clocks++;
        else if (clocks * hz > sum) clocks--;
        if (clocks * hz > sum || (clocks + 1UL) * hz <= sum)
        {
            /* one adjustment was not enough -> period would move by more
             * than +/-1 (or state/command mismatch): refuse, safe failure */
            SHOT_Revoke(SHOT_ABORT_ACTUATOR);
            return 0U;
        }
        period = clocks - 1UL;
        if (period < 352UL || period > 413UL)
        {
            SHOT_Revoke(SHOT_ABORT_ACTUATOR);
            return 0U;
        }
        g_actual_switching_frequency_hz = g_real_pi_actual_hz_table[period - 352UL];
        cmp = (period + 1UL) >> 1;   /* 50% duty, shift not division */
        if (cmp <= LLC_DEADBAND_TICKS + LLC_MIN_PULSE_TICKS) return 0U;
        if ((period - cmp) <= LLC_DEADBAND_TICKS + LLC_MIN_PULSE_TICKS) return 0U;
        if (period != (Uint32)g_pwm_period)
        {
            DINT;

            EPwm1Regs.TBPRD = (Uint16)period;
            EPwm1Regs.CMPA.half.CMPA = (Uint16)cmp;

            EINT;

            /* Keep the ADC VOUT sampling phase correct as the switching
             * period moves (preserves the ET_3RD closed-loop cadence). */
            ADC_UpdatePwmSyncPointKeepCadence((Uint16)period);
        }
        g_pwm_period = (Uint16)period;
        g_switching_frequency_hz = hz;
        return 1U;
    }
#endif

    /*
     * Strict UP-count formula:
     *   period_clocks = round(TBCLK / f)
     *   TBPRD         = period_clocks - 1
     * The counter runs 0..TBPRD, so the switching period is TBPRD + 1 clocks.
     */
    period = (LLC_TBCLK_HZ + (hz / 2UL)) / hz;
    if (period == 0UL) return 0U;
    period = period - 1UL;
    if (period > 0xFFFFUL) return 0U;

    cmp = (period + 1UL) / 2UL;

    /* 50% duty plus dead-band and minimum pulse check */
    if (cmp <= LLC_DEADBAND_TICKS + LLC_MIN_PULSE_TICKS) return 0U;
    if ((period - cmp) <= LLC_DEADBAND_TICKS + LLC_MIN_PULSE_TICKS) return 0U;

    if (period != (Uint32)g_pwm_period)
    {
        DINT;

        EPwm1Regs.TBPRD = (Uint16)period;
        EPwm1Regs.CMPA.half.CMPA = (Uint16)cmp;

        EINT;

        /* Keep the ADC VOUT sampling phase correct as the switching period
         * moves: re-position CMPB to the new period midpoint while preserving
         * the current SOCAPRD cadence (ET_3RD in closed loop). Only when the
         * period actually changes (the closed-loop steps are small, so the
         * period is often unchanged and the write/CMPB cost is skipped). */
        ADC_UpdatePwmSyncPointKeepCadence((Uint16)period);
        g_actual_switching_frequency_hz = LLC_TBCLK_HZ / (period + 1UL);
    }

    g_pwm_period = (Uint16)period;
    g_switching_frequency_hz = hz;
    ok = 1U;
    return ok;
}

/*
 * LLC_PWM_Enable
 *
 * Assumes frequency has already been set.  Releases the one-shot trip latch
 * and enables the TZ interrupt.  Does NOT clear fault flags or PI state.
 */
void LLC_PWM_Enable(void)
{
    if (g_fault_flags != 0UL) return;

    /* From this point until a planned stop, hardware TZ events are real
     * ACTIVE_WINDOW trips and must be treated as FAULT. */
    g_power_window_state = POWER_WINDOW_ACTIVE;

    EALLOW;
    EPwm1Regs.TZCLR.bit.OST = 1U;
    g_probe_tzclr_write_count++;
    EPwm1Regs.TZCLR.bit.INT = 1U;
    EPwm1Regs.TZEINT.bit.OST = 1U;
    EDIS;

    g_pwm_enabled = 1U;
    g_pwm_enable_result = 1U;
}

/*
 * LLC_PWM_DisableSafe
 *
 * Normal inhibit: hardware-clamps both outputs low through one-shot TZ but
 * does NOT count as a fault/trip.  TZ interrupt is temporarily disabled so
 * this normal operation is not mistaken for a real TZ1 event.
 */
void LLC_PWM_DisableSafe(void)
{
    g_software_ost_in_progress = 1U;

    EALLOW;
    EPwm1Regs.TZEINT.bit.OST = 0U;
    EPwm1Regs.TZFRC.bit.OST = 1U;
    EPwm1Regs.TZCLR.bit.INT = 1U;
    EDIS;

    /* Intentional OST is now being forced; classify subsequent TZ events as
     * POST_OST diagnostics, not ACTIVE_WINDOW faults.  Set this immediately
     * after the write (not conditional on an immediate flag read, which can
     * still be settling) so a nested TZ ISR cannot see a stale ACTIVE state. */
    g_power_window_state = POWER_WINDOW_POST_OST;

    g_software_ost_in_progress = 0U;
    g_pwm_enabled = 0U;
    g_pwm_enable_result = 0U;
}

/*
 * PWM_ApplyPeriodDeadtime
 *
 * Unified register write for period, CMPA, and dead-band. This is the only
 * place (along with LLC_SetFrequencyHz) allowed to write TBPRD/CMPA/DBRED/FED.
 */
Uint16 PWM_ApplyPeriodDeadtime(Uint32 period, Uint16 deadtime)
{
    Uint16 cmp;

    if (PWM_ConfigTopologyValid() == 0U) return 0U;
    if (PWM_RuntimeValuesValid(period, deadtime) == 0U) return 0U;

    cmp = (Uint16)((period + 1UL) / 2UL);

    EALLOW;
    EPwm1Regs.TBPRD = (Uint16)period;
    EPwm1Regs.CMPA.half.CMPA = cmp;
    EPwm1Regs.DBRED = deadtime;
    EPwm1Regs.DBFED = deadtime;
    EDIS;


    g_pwm_period = (Uint16)period;
    g_switching_frequency_hz = LLC_TBCLK_HZ / (period + 1UL);
    g_actual_switching_frequency_hz = g_switching_frequency_hz;
    return 1U;
}

/*
 * PWM_PrepareStart
 *
 * Deterministic start preparation while OST is still latched:
 *   - validate topology + runtime values
 *   - apply final period/dead-time
 *   - force a known TBCTR phase
 *   - clear old TZ interrupt evidence
 *   - keep outputs clamped (AQCSFRC low + OST)
 */
Uint16 PWM_PrepareStart(Uint32 period, Uint16 deadtime, Uint16 start_phase)
{
    Uint16 ph = start_phase;

    if (PWM_ApplyPeriodDeadtime(period, deadtime) == 0U) return 0U;
    if (ph >= g_pwm_period) ph = 0U;

    EALLOW;
    EPwm1Regs.AQCSFRC.bit.CSFA = AQ_CLEAR;
    EPwm1Regs.AQCSFRC.bit.CSFB = AQ_CLEAR;
    EPwm1Regs.TBCTR = ph;
    EPwm1Regs.TZCLR.bit.INT = 1U;
    EPwm1Regs.TZEINT.bit.OST = 0U;
    EDIS;

    g_power_window_state = POWER_WINDOW_IDLE;
    g_pwm_start_prepared = 1U;
    return 1U;
}

/*
 * PWM_SetDeadbandOnly
 *
 * Diagnostic-only dead-band update used by the PROFILE_C DB micro-ramp.
 * It intentionally writes ONLY DBRED/DBFED and never TBPRD/CMPA, so the
 * fixed 200 kHz test frequency cannot be disturbed by a micro-ramp DB step.
 */
Uint16 PWM_SetDeadbandOnly(Uint16 deadtime)
{
    if (PWM_RuntimeValuesValid(g_pwm_period, deadtime) == 0U) return 0U;

    EALLOW;
    EPwm1Regs.DBRED = deadtime;
    EPwm1Regs.DBFED = deadtime;
    EDIS;

    return 1U;
}

/*
 * PWM_StartDeterministic
 *
 * Releases the prepared PWM in one step. OST is cleared only after the
 * registers and TBCTR phase have been set by PWM_PrepareStart().
 */
void PWM_StartDeterministic(void)
{
    if (g_pwm_start_prepared == 0U) return;

    EALLOW;
    EPwm1Regs.AQCSFRC.all = 0U;
    EPwm1Regs.TZCLR.bit.OST = 1U;
    g_probe_tzclr_write_count++;
    EPwm1Regs.TZCLR.bit.INT = 1U;
    EPwm1Regs.TZEINT.bit.OST = 1U;
    EDIS;

    g_power_window_state = POWER_WINDOW_ACTIVE;
    g_pwm_enabled = 1U;
    g_pwm_enable_result = 1U;
    g_pwm_start_prepared = 0U;

    /* Latch the first deterministic start snapshot exactly once. */
    if (g_first_start_seen == 0U)
    {
        g_first_start_seen   = 1U;
        g_first_start_tbprd  = EPwm1Regs.TBPRD;
        g_first_start_cmpa   = EPwm1Regs.CMPA.half.CMPA;
        g_first_start_dbred  = EPwm1Regs.DBRED;
        g_first_start_dbfed  = EPwm1Regs.DBFED;
        g_first_start_dacval = Comp1Regs.DACVAL.bit.DACVAL;
        g_first_start_ost    = EPwm1Regs.TZFLG.bit.OST;
        g_first_start_pwm    = 1U;
    }
}

/*
 * PWM_Trip
 *
 * Low-level trip helper.  If countTrip != 0 the trip is counted (software
 * force test); otherwise it is a protection-initiated fault that must not
 * increment g_trip_count per the bring-up rule.
 */
void PWM_Trip(Uint32 cause, Uint16 countTrip)
{
    EALLOW;
    EPwm1Regs.TZEINT.bit.OST = 0U;   /* avoid ISR double-count for software trips */
    EPwm1Regs.TZFRC.bit.OST = 1U;
    EPwm1Regs.TZCLR.bit.INT = 1U;
    EDIS;

    if (countTrip != 0U)
    {
        g_trip_count++;
    }
    g_fault_flags |= cause;
    g_fault_history |= cause;
    g_system_state = SYS_STATE_FAULT;
    g_pwm_enabled = 0U;
    g_pwm_enable_result = 0U;
#if STAGE6_FIRST_BOUNDED_REAL_PI_SHOT
    /* G2: any fault entering SYS_STATE_FAULT revokes the bounded shot arm
     * (PWM already 0, OST already latched above). No auto retry. */
    g_first_real_pi_shot_arm = 0U;
#endif
#if STAGE6_REAL_ACTUATOR_OST_TEST
    /* STAGE6_REAL_ACTUATOR_OST_TEST: any trip revokes the real actuator's PWM
     * write permission irreversibly (test_arm cleared + revoked latched). The
     * CTRL_ApplyFrequencyCommand write gate then refuses to touch PWM. */
    g_stage6_actuator_test_arm = 0U;
    g_stage6_actuator_revoked = 1U;
#endif
}

/*
 * LLC_ProtectionForceTrip
 *
 * Public software force-trip test used in Stage 4.  This is one of the two
 * paths that increments g_trip_count.
 */
void LLC_ProtectionForceTrip(Uint32 cause)
{
    PWM_Trip(cause, 1U);
    if (cause == 0U)
    {
        g_fault_flags |= FAULT_FORCE_TRIP;
        g_fault_history |= FAULT_FORCE_TRIP;
    }
}

/*
 * LLC_ProtectionResetExplicit
 *
 * Only explicit CCS sequence may clear a fault:
 *   enable request = 0, fault source removed, g_fault_reset_request = 1.
 * It clears fault flags but keeps the OST hardware clamp latched.  It never
 * auto-restarts PWM.
 */
Uint16 LLC_ProtectionResetExplicit(void)
{
    if (g_pwm_enable_request != 0U) return 0U;
    if (g_pwm_enabled != 0U) return 0U;
    if (g_force_trip_request != 0U) return 0U;
    if (g_fault_reset_request == 0U) return 0U;

    EALLOW;
    /* Keep the hardware clamp latched after reset: force OST and hold
     * AQCSFRC low. The next COMP re-arm will clear OST only after the
     * comparator/DAC settle check, never here. */
    EPwm1Regs.AQCSFRC.bit.CSFA = AQ_CLEAR;
    EPwm1Regs.AQCSFRC.bit.CSFB = AQ_CLEAR;
    EPwm1Regs.TZFRC.bit.OST = 1U;
    EPwm1Regs.TZCLR.bit.INT = 1U;
    EPwm1Regs.TZEINT.bit.OST = 0U;
    EDIS;

    g_fault_flags = 0UL;
    g_fault_reset_request = 0U;
    g_system_state = SYS_STATE_IDLE;
    g_power_window_state = POWER_WINDOW_IDLE;
    g_pwm_enable_result = 0U;
    return 1U;
}


