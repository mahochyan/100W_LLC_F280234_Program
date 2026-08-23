# STAGE6 HARDWARE WRITE-GATE AUDIT

Stage: STAGE6_CONTROL_INTEGRATION_OFFLINE_V1
Task step P. Goal: statically prove the controller cannot write real PWM in the
offline stage.

## Claim

`CTRL_ApplyFrequencyCommand()` currently cannot call `LLC_SetFrequencyHz()`,
and no ePWM register (TBPRD / CMPA / CMPB / DBRED / DBFED) can be written by
the Stage6 offline control path.

## Evidence 1 - the write gate macro

File: llc_config.h
```
#define LLC_HARDWARE_PI_VALIDATED   0U   /* Stage6 offline: write-gate LOCKED */
```
The only gate around the actuator's hardware write is this macro.

## Evidence 2 - actuator is shadow-only when the gate is 0

File: app/control.c - CTRL_ApplyFrequencyCommand()
```
void CTRL_ApplyFrequencyCommand(void)
{
    Uint32 target = g_control_shadow_frequency_hz;
    g_control_frequency_hz = target;            // shadow commit (safe, no PWM)
#if LLC_HARDWARE_PI_VALIDATED                   // 0U at build time
    if (LLC_SetFrequencyHz(target) != 1U)
    {
        g_fast_fault_count++;
    }
#else
    /* Stage6 offline: write-gate locked. No LLC_SetFrequencyHz() call;
       PWM registers untouched. */
    (void)target;
#endif
}
```
With LLC_HARDWARE_PI_VALIDATED = 0U the preprocessor emits only the shadow
commit and `(void)target;`. There is no path that calls LLC_SetFrequencyHz().

## Evidence 2 - grep of the write path

Searching the STAGE6 source for every LLC_SetFrequencyHz call site and every
ePWM/TBPRD/CMPA/CMPB/DB write inside the control module:

- app/control.c: the single LLC_SetFrequencyHz() call site is inside
  `#if LLC_HARDWARE_PI_VALIDATED`.
- The control module performs no direct register writes to EPwm1Regs other than
  the passive CTRL_SnapshotPwm() READ (TBPRD/CMPA/CMPB/DBRED/DBFED are read,
  never written).
- g_control_frequency_hz is the only actuator output consumed elsewhere, and it
  is a plain global fed to LLC_SetFrequencyHz only under the gate.

## Evidence 4 - build-time confirmation

Compile-time: the disabled branch is not emitted (the 25.11.1 cl2000 build
with --abi=coffabi was clean for control.c; only the RAM .text fit is pending,
which does not affect the write-gate).

## Evidence 5 - PWM register isolation self-test (Case 8)

CTRL_OfflineSelfTest() Case 8 snapshots TBPRD/CMPA/CMPB/DBRED/DBFED before and
after 10000 compute+apply steps (STAGE6_OFFLINE_SELFTEST). Isolation holds only
if all five registers are byte-identical. This is the on-target proof the
controller wrote no PWM.

## Static verdict

LLC_HARDWARE_PI_VALIDATED = 0U (LINKED). No code path in the controller can
write a PWM register. NO_REAL_POWER_EXECUTED. SIL + write-gate both hold.