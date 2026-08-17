/*
 * comparator.c
 *
 * COMP1 is used as a candidate over-current / primary-current protection.
 * The comparator output is routed through GPIO42 to the PCB and back to
 * GPIO15/TZ1.  Until Stage 4 low-energy injection proves that path, the
 * mapping must remain marked as pending physical verification.
 */

#include "DSP2803x_Device.h"
#include "DSP2803x_Examples.h"
#include "llc_config.h"
#include "llc_globals.h"
#include "comparator.h"

void COMP_Init(void)
{
    EALLOW;
    SysCtrlRegs.PCLKCR3.bit.COMP1ENCLK = 1U;

    /* Comparator disabled until armed by CCS in Stage 4. */
    Comp1Regs.COMPCTL.all = 0U;
    Comp1Regs.COMPCTL.bit.COMPSOURCE = 0U;  /* internal DAC as inverting input (reference design confirmed) */
    Comp1Regs.COMPCTL.bit.QUALSEL = 5U;
    Comp1Regs.COMPCTL.bit.CMPINV = 1U;      /* placeholder polarity; verify on HW */
    Comp1Regs.DACCTL.all = 0U;
    Comp1Regs.DACVAL.bit.DACVAL = 0U;

    g_comp_dac_value = 0U;
    g_comp_polarity = 1U;
    g_comp_arm = 0U;
    EDIS;
}

void COMP_ApplyGlobals(void)
{
    Uint16 dac = g_comp_dac_value & 0x03FFU;
    Uint16 pol = (g_comp_polarity != 0U) ? 1U : 0U;
    Uint16 arm = (g_comp_arm != 0U) ? 1U : 0U;

    EALLOW;
    Comp1Regs.COMPCTL.bit.CMPINV = pol;

    /* Injection test owns both DAC value and arm state while it is active. */
    if (g_comp_inject_test_armed == 0U)
    {
        Comp1Regs.DACVAL.bit.DACVAL = dac;
        Comp1Regs.COMPCTL.bit.COMPDACEN = arm;
    }
    else
    {
        Comp1Regs.DACVAL.bit.DACVAL = g_comp1_dac_code & 0x03FFU;
        Comp1Regs.COMPCTL.bit.COMPDACEN = 1U;
    }
    EDIS;
}

/*
 * COMP_RunLoopbackDiagnostic
 *
 * One-shot board-loopback test for the COMP1OUT(GPIO42) -> PCB -> GPIO15/TZ1
 * path. It is allowed only when PWM is OFF, system is IDLE and no fault is
 * active. Temporarily switches GPIO42 to a GPIO output and GPIO15 to a GPIO
 * input, writes 0/1/0 and reads back. Always restores the normal COMP/TZ pin
 * mux and keeps ePWM OST latched low.
 */
void COMP_RunLoopbackDiagnostic(void)
{
    Uint16 read0;
    Uint16 read1;
    Uint16 read2;
    Uint16 ok;

    if (g_pwm_enable_request != 0U ||
        g_pwm_enabled != 0U ||
        g_system_state != SYS_STATE_IDLE ||
        g_fault_flags != 0UL)
    {
        /* Not permitted now; keep request pending. */
        return;
    }

    /* One-shot request is consumed. */
    g_loopback_diag_request = 0U;
    g_loopback_diag_result = 0U;

    EALLOW;
    /* Temporarily disable comparator and TZ input. */
    Comp1Regs.COMPCTL.bit.COMPDACEN = 0U;
    EPwm1Regs.TZSEL.bit.OSHT1 = TZ_DISABLE;
    EPwm1Regs.TZEINT.bit.OST = 0U;

    /* GPIO42 = plain output, GPIO15 = plain input. */
    GpioCtrlRegs.GPBMUX1.bit.GPIO42 = 0U;
    GpioCtrlRegs.GPBDIR.bit.GPIO42 = 1U;
    GpioCtrlRegs.GPAMUX1.bit.GPIO15 = 0U;
    GpioCtrlRegs.GPADIR.bit.GPIO15 = 0U;
    EDIS;

    /* Drive 0, read. */
    GpioDataRegs.GPBCLEAR.bit.GPIO42 = 1U;
    DELAY_US(100L);
    read0 = GpioDataRegs.GPADAT.bit.GPIO15;
    g_loopback_read0 = read0;

    /* Drive 1, read. */
    GpioDataRegs.GPBSET.bit.GPIO42 = 1U;
    DELAY_US(100L);
    read1 = GpioDataRegs.GPADAT.bit.GPIO15;
    g_loopback_read1 = read1;

    /* Drive 0, read. */
    GpioDataRegs.GPBCLEAR.bit.GPIO42 = 1U;
    DELAY_US(100L);
    read2 = GpioDataRegs.GPADAT.bit.GPIO15;
    g_loopback_read2 = read2;

    ok = (read0 == 0U) && (read1 == 1U) && (read2 == 0U);

    /* Always restore normal mux and safe PWM state. */
    EALLOW;
    GpioCtrlRegs.GPBMUX1.bit.GPIO42 = 3U;   /* COMP1OUT */
    GpioCtrlRegs.GPAMUX1.bit.GPIO15 = 1U;   /* TZ1 */
    EPwm1Regs.TZSEL.bit.OSHT1 = TZ_ENABLE;
    EPwm1Regs.TZEINT.bit.OST = 0U;
    EPwm1Regs.TZFRC.bit.OST = 1U;
    EPwm1Regs.TZCLR.bit.INT = 1U;
    Comp1Regs.COMPCTL.bit.COMPDACEN = 0U;
    EDIS;

    g_loopback_diag_result = ok ? 1U : 2U;
    if (ok)
    {
        g_comp_tz_loopback_verified = 1U;
    }
    else
    {
        g_fault_flags |= FAULT_COMP_TZ_LOOPBACK;
        g_fault_history |= FAULT_COMP_TZ_LOOPBACK;
        g_system_state = SYS_STATE_FAULT;
        g_pwm_enable_result = 0U;
    }
}

/*
 * COMP_ArmInjectionTest
 *
 * Stage4C low-energy comparator injection test setup.
 * Requires PWM OFF, IDLE, no fault. Configures COMP1 with internal DAC as the
 * inverting input, asynchronous output, restores COMP1OUT/TZ1 muxes and enables
 * the TZ1 one-shot path so a real comparator trip can latch ePWM and count.
 */
void COMP_ArmInjectionTest(void)
{
    Uint16 dac;

    /* Every call starts from a known not-armed / not-rejected state. */
    g_comp_inject_test_armed = 0U;
    g_comp_prestart_reject = 0U;

    if (g_pwm_enable_request != 0U ||
        g_pwm_enabled != 0U ||
        g_system_state != SYS_STATE_IDLE ||
        g_fault_flags != 0UL)
    {
        return;
    }

    g_comp_inject_test_request = 0U;
    dac = g_comp1_dac_code & 0x03FFU;
    if (dac == 0U)
    {
        dac = 31U;   /* ~100 mV with 3.3 V / 1024 LSB */
        g_comp1_dac_code = dac;
    }

    EALLOW;
    /* Comparator: A = COMP1A (IPRI), B = internal DAC, asynchronous. */
    Comp1Regs.COMPCTL.all = 0U;
    Comp1Regs.COMPCTL.bit.COMPSOURCE = 0U;   /* internal DAC as inverting input */
    Comp1Regs.COMPCTL.bit.QUALSEL = 5U;      /* reference-design qualification */
    Comp1Regs.COMPCTL.bit.SYNCSEL = 0U;      /* asynchronous output */
    Comp1Regs.COMPCTL.bit.CMPINV = (g_comp_polarity != 0U) ? 1U : 0U;
    Comp1Regs.DACCTL.all = 0U;
    Comp1Regs.DACVAL.bit.DACVAL = dac;
    Comp1Regs.COMPCTL.bit.COMPDACEN = 1U;

    /* Restore/ensure COMP1OUT and TZ1 path. */
    GpioCtrlRegs.GPBMUX1.bit.GPIO42 = 3U;
    GpioCtrlRegs.GPAMUX1.bit.GPIO15 = 1U;
    EPwm1Regs.TZSEL.bit.OSHT1 = TZ_ENABLE;
    EPwm1Regs.TZCTL.bit.TZA = TZ_FORCE_LO;
    EPwm1Regs.TZCTL.bit.TZB = TZ_FORCE_LO;

    /*
     * Keep AQCSFRC forcing A/B LOW while the comparator/DAC settles.
     * Do NOT clear OST / enable TZEINT before this settle completes.
     */
    EPwm1Regs.AQCSFRC.bit.CSFA = AQ_CLEAR;
    EPwm1Regs.AQCSFRC.bit.CSFB = AQ_CLEAR;
    EDIS;

    /* DAC / comparator settle with PWM still hardware-forced low. */
    DELAY_US(2L);

    /* Record pre-start state after settle. */
    g_comp_prestart_status = Comp1Regs.COMPSTS.bit.COMPSTS;
    g_comp_prestart_gpio15 = GpioDataRegs.GPADAT.bit.GPIO15;
    g_comp_prestart_tzflg = EPwm1Regs.TZFLG.all;
    g_comp_prestart_reject = 0U;

    /*
     * TZ1 is active-low on this board path. If GPIO15 is already low after
     * settle, the comparator is asserting a valid trip before PWM release:
     * reject this start and keep PWM safely latched.
     */
    if (g_comp_prestart_gpio15 == 0U)
    {
        g_comp_prestart_reject = 1U;
        EALLOW;
        EPwm1Regs.TZFRC.bit.OST = 1U;
        EPwm1Regs.TZCLR.bit.INT = 1U;
        EDIS;
        return;
    }

    /* Now clear the old safe-state OST/INT after settle. */
    EALLOW;
    EPwm1Regs.TZCLR.all = 0xFFFFU;
    g_probe_tzclr_write_count++;
    EDIS;

    /* Confirm no new trip appeared immediately after clearing. */
    if (EPwm1Regs.TZFLG.all != 0U)
    {
        g_comp_prestart_reject = 1U;
        EALLOW;
        EPwm1Regs.TZFRC.bit.OST = 1U;
        EPwm1Regs.TZCLR.bit.INT = 1U;
        EDIS;
        return;
    }

    /* Enable TZ interrupt. AQCSFRC still holds outputs low. */
    EALLOW;
    EPwm1Regs.TZEINT.bit.OST = 1U;
    EDIS;

    g_comp_inject_test_armed = 1U;
    g_comp1_dac_code = dac;
}

void COMP_DisarmInjectionTest(void)
{
    EALLOW;
    Comp1Regs.COMPCTL.bit.COMPDACEN = 0U;
    EPwm1Regs.TZEINT.bit.OST = 0U;
    /* Release AQCSFRC low-force, then re-latch OST for safe PWM-off state. */
    EPwm1Regs.AQCSFRC.all = 0U;
    EPwm1Regs.TZFRC.bit.OST = 1U;
    EPwm1Regs.TZCLR.bit.INT = 1U;
    EDIS;

    g_comp_inject_test_armed = 0U;
    g_comp_inject_test_disarm_request = 0U;
}

static Uint16 COMP_ArmCommon(Uint16 requested_dac, Uint16 require_softstart)
{
    Uint16 dac;

    g_comp_inject_test_armed = 0U;
    g_comp_prestart_reject = 0U;

    if (g_pwm_enabled != 0U || g_fault_flags != 0UL)
    {
        g_comp_prestart_reject = 1U;
        return 0U;
    }

    if (require_softstart != 0U)
    {
        if (g_pwm_enable_request == 0U || g_system_state != SYS_STATE_SOFT_START)
        {
            g_comp_prestart_reject = 1U;
            return 0U;
        }
    }
    else
    {
        if (g_system_state != SYS_STATE_IDLE)
        {
            g_comp_prestart_reject = 1U;
            return 0U;
        }
    }

    dac = requested_dac & 0x03FFU;
    if (dac == 0U)
    {
        g_comp_prestart_reject = 1U;
        return 0U;
    }

    EALLOW;
    Comp1Regs.COMPCTL.all = 0U;
    Comp1Regs.COMPCTL.bit.COMPSOURCE = 0U;
    Comp1Regs.COMPCTL.bit.QUALSEL = 5U;
    Comp1Regs.COMPCTL.bit.SYNCSEL = 0U;
    Comp1Regs.COMPCTL.bit.CMPINV = (g_comp_polarity != 0U) ? 1U : 0U;
    Comp1Regs.DACCTL.all = 0U;
    Comp1Regs.DACVAL.bit.DACVAL = dac;
    Comp1Regs.COMPCTL.bit.COMPDACEN = 1U;

    GpioCtrlRegs.GPBMUX1.bit.GPIO42 = 3U;
    GpioCtrlRegs.GPAMUX1.bit.GPIO15 = 1U;
    EPwm1Regs.TZSEL.bit.OSHT1 = TZ_ENABLE;
    EPwm1Regs.TZCTL.bit.TZA = TZ_FORCE_LO;
    EPwm1Regs.TZCTL.bit.TZB = TZ_FORCE_LO;
    EPwm1Regs.AQCSFRC.bit.CSFA = AQ_CLEAR;
    EPwm1Regs.AQCSFRC.bit.CSFB = AQ_CLEAR;
    EDIS;

    DELAY_US(2L);

    g_comp_prestart_status = Comp1Regs.COMPSTS.bit.COMPSTS;
    g_comp_prestart_gpio15 = GpioDataRegs.GPADAT.bit.GPIO15;
    g_comp_prestart_tzflg = EPwm1Regs.TZFLG.all;

    if (g_comp_prestart_gpio15 == 0U)
    {
        g_comp_prestart_reject = 1U;
        EALLOW;
        EPwm1Regs.TZFRC.bit.OST = 1U;
        EPwm1Regs.TZCLR.bit.INT = 1U;
        EDIS;
        return 0U;
    }

    g_comp1_dac_code = dac;
    g_comp_inject_test_armed = 1U;
    return 1U;
}

void COMP_ArmForPowerStart(Uint16 requested_dac)
{
    COMP_ArmCommon(requested_dac, 1U);
}

void COMP_ArmForSingleCycleStart(Uint16 requested_dac)
{
    COMP_ArmCommon(requested_dac, 0U);
}

void COMP_StaticCalibrationArm(void)
{
    if (g_pwm_enable_request != 0U || g_pwm_enabled != 0U ||
        g_system_state != SYS_STATE_IDLE || g_fault_flags != 0UL)
    {
        return;
    }

    /* Static calibration only: configure comparator/DAC and keep PWM
     * hardware-clamped. OST is NOT cleared and TZEINT stays disabled. */
    EALLOW;
    Comp1Regs.COMPCTL.all = 0U;
    Comp1Regs.COMPCTL.bit.COMPSOURCE = 0U;
    Comp1Regs.COMPCTL.bit.QUALSEL = 5U;
    Comp1Regs.COMPCTL.bit.SYNCSEL = 0U;
    Comp1Regs.COMPCTL.bit.CMPINV = 1U;
    Comp1Regs.DACCTL.all = 0U;
    Comp1Regs.DACVAL.bit.DACVAL = g_static_cal_dac & 0x03FFU;
    Comp1Regs.COMPCTL.bit.COMPDACEN = 1U;

    GpioCtrlRegs.GPBMUX1.bit.GPIO42 = 3U;
    GpioCtrlRegs.GPAMUX1.bit.GPIO15 = 1U;
    EPwm1Regs.TZSEL.bit.OSHT1 = TZ_ENABLE;
    EPwm1Regs.TZCTL.bit.TZA = TZ_FORCE_LO;
    EPwm1Regs.TZCTL.bit.TZB = TZ_FORCE_LO;
    EPwm1Regs.AQCSFRC.bit.CSFA = AQ_CLEAR;
    EPwm1Regs.AQCSFRC.bit.CSFB = AQ_CLEAR;
    EDIS;

    g_static_cal_initial_compsts = Comp1Regs.COMPSTS.bit.COMPSTS;
    g_static_cal_initial_gpio15 = GpioDataRegs.GPADAT.bit.GPIO15;
    g_static_cal_transition_detected = 0U;
    g_static_cal_compsts_before = g_static_cal_initial_compsts;
    g_static_cal_gpio15_before = g_static_cal_initial_gpio15;
    g_static_cal_compsts_after = g_static_cal_initial_compsts;
    g_static_cal_gpio15_after = g_static_cal_initial_gpio15;
    g_static_cal_tzflg_after = EPwm1Regs.TZFLG.all;

    g_comp1_dac_code = g_static_cal_dac & 0x03FFU;
    g_comp_inject_test_armed = 1U;
    g_static_cal_armed = 1U;
}

void COMP_StaticCalibrationDisarm(void)
{
    EALLOW;
    Comp1Regs.COMPCTL.bit.COMPDACEN = 0U;
    EPwm1Regs.TZEINT.bit.OST = 0U;
    /* Release AQCSFRC low-force, then re-latch OST for safe PWM-off state. */
    EPwm1Regs.AQCSFRC.all = 0U;
    EPwm1Regs.TZFRC.bit.OST = 1U;
    EPwm1Regs.TZCLR.bit.INT = 1U;
    EDIS;

    g_static_cal_armed = 0U;
    g_comp_inject_test_armed = 0U;
    g_static_cal_disarm_request = 0U;
}

void COMP_StaticCalibrationFastTask(void)
{
    Uint16 compsts;
    Uint16 gpio15;

    if (g_static_cal_armed == 0U || g_static_cal_transition_detected != 0U) return;

    compsts = Comp1Regs.COMPSTS.bit.COMPSTS;
    gpio15 = GpioDataRegs.GPADAT.bit.GPIO15;

    /* First change from the initial state is the transition of interest. */
    if (compsts != g_static_cal_initial_compsts ||
        gpio15 != g_static_cal_initial_gpio15)
    {
        g_static_cal_compsts_before = g_static_cal_initial_compsts;
        g_static_cal_gpio15_before = g_static_cal_initial_gpio15;
        g_static_cal_compsts_after = compsts;
        g_static_cal_gpio15_after = gpio15;
        g_static_cal_tzflg_after = EPwm1Regs.TZFLG.all;
        g_static_cal_transition_detected = 1U;
    }
}

void COMP_UpdateStatus(void)
{
    g_comp1_status = Comp1Regs.COMPSTS.bit.COMPSTS;
    g_comp1_dac_code = Comp1Regs.DACVAL.bit.DACVAL;
}
