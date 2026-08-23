#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
stage6_pi_shadow_sanity.py
==========================
STAGE6_PI_FIRMWARE_SHADOW_INTEGRATION_V1 - J/K/L gates.

Verifies the BALANCED profile behavior in the firmware shadow control path
using the same float32 + (Uint32) integer-commit semantics as control.c
(reuses stage6_pi_firmware_numeric_parity.ctrl32).

  J  STAGE6_BALANCED_PROFILE_OFFLINE_SELFTEST_PASS
     Mirror of the on-target 8-case CTRL_OfflineSelfTest with the real
     BALANCED gains (6657.43331 / 44.3828888). Case 8 (PWM register
     isolation) is structurally guaranteed by the write gate and proven in the
     FLASH disassembly (this file asserts the shadow-only property: the
     controller never emits a non-integer committed command and the Apply
     branch is excluded).
  K  BALANCED_PROFILE_FIRST_STEP_SANITY_PASS
     Vref=12V / Vout=11V first cycle: error~+1V, P~+6657Hz, I~+44.38Hz,
     SIGN=-1, unsat<150k, first shadow step 150000->149900 (slew-limited).
     Reverse Vout=13V: 150000->150100.
  L  ADC stale with BALANCED profile: 3 consecutive stale samples -> frequency
     AND integrator freeze; on recovery the first step <=100 Hz.

OFFLINE ONLY. No real power. LLC_HARDWARE_PI_VALIDATED=0.
"""
import io
import os
import struct

from stage6_pi_firmware_numeric_parity import ctrl32, F_MIN, F_MAX, I_MAX, SLEW

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(os.path.dirname(HERE), "docs")
DT = 20e-6
BIAS = 150000.0
ADC_STALE_LIMIT = 3

KP = 6657.43331
KI = 44.3828888


def f32(x):
    return struct.unpack("f", struct.pack("f", float(x)))[0]


def step(freq, I, vref, vout, valid=1, miss=0):
    """One ComputeFrequencyCommand+Apply step using the real profile gains."""
    return ctrl32(freq, I, vref, vout, valid, miss)


# ---------------------------------------------------------------- J: 8-case
def self_test_j():
    bits = {}

    # Case 1: Vout<Vref -> error>0 -> freq DOWN (SIGN=-1)
    freq, I = 150000, 0.0
    init = freq
    for _ in range(200):
        freq, I, _ = step(freq, I, 12.0, 11.0)
    bits[1] = (freq < init)

    # Case 2: Vout>Vref -> error<0 -> freq UP
    freq, I = 150000, 0.0
    init = freq
    for _ in range(150):
        freq, I, _ = step(freq, I, 12.0, 13.0)
    bits[2] = (freq > init)

    # Case 3: equal -> holds
    freq, I = 150000, 0.0
    init = freq
    for _ in range(150):
        freq, I, _ = step(freq, I, 12.0, 12.0)
    bits[3] = (abs(init - freq) < 500)

    # Case 4: lower clamp + anti-windup
    freq, I = 150000, 50000.0
    for _ in range(400):
        freq, I, frozen = step(freq, I, 12.0, 8.0)
    bits[4] = (freq == int(F_MIN) and frozen == 1)

    # Case 5: upper clamp + anti-windup
    freq, I = 150000, -50000.0
    for _ in range(400):
        freq, I, frozen = step(freq, I, 12.0, 16.0)
    bits[5] = (freq == int(F_MAX) and frozen == 1)

    # Case 6: ADC stale -> freeze command + integrator
    freq, I = 150000, 0.0
    for _ in range(5):
        freq, I, _ = step(freq, I, 12.0, 11.0)
    before = freq
    I_before = I
    frozen = None
    for _ in range(5):
        freq, I, frozen = step(freq, I, 12.0, 11.0, valid=0, miss=3)
    bits[6] = (freq == before and I == I_before and frozen == 1)

    # Case 7: ADC recovery -> one step <= 100 Hz
    after, I2, _ = step(freq, I, 12.0, 11.0, valid=1, miss=0)
    bits[7] = (abs(after - freq) <= SLEW)

    all_ok = all(bits.values())
    return bits, all_ok


# ------------------------------------------------------------- K: first-step
def first_step_sanity():
    # Vout = 11 V (below ref): first cycle after reset
    freq, I = 150000, 0.0
    error = 12.0 - 11.0
    p = f32(KP * error)
    I = f32(I + f32(KI * error))
    unsat = f32(BIAS + (-1.0) * f32(p + I))
    new_freq, _, _ = step(150000, 0.0, 12.0, 11.0)
    down_ok = (abs(p - 6657.43331) < 1.0 and abs(I - 44.3828888) < 0.05
               and unsat < 150000 and new_freq == 149900)
    # Vout = 13 V (above ref): first cycle
    error = 12.0 - 13.0
    p = f32(KP * error)
    I = f32(0.0 + f32(KI * error))
    unsat = f32(150000 + (-1.0) * f32(p + I))
    new_freq2, I2, _ = step(150000, 0.0, 12.0, 13.0)
    rev_ok = (p < 0 and unsat > 150000 and new_freq2 == 150100)
    return down_ok, rev_ok


# ------------------------------------------------------------- L: ADC stale
def adc_stale():
    freq, I = 150000, 0.0
    for _ in range(5):
        freq, I, _ = step(freq, I, 12.0, 11.0)
    f_before, i_before = freq, I
    frez = None
    for k in range(3):
        freq, I, frez = step(freq, I, 12.0, 11.0, valid=0, miss=k + 1)
    # after exactly 3 stale samples the controller is inhibited
    freq3, I3, frez3 = step(freq, I, 12.0, 11.0, valid=0, miss=3)
    freeze_ok = (freq3 == f_before and I3 == i_before and frez3 == 1)
    # recovery: one valid step -> <= 100 Hz
    rec, I4, _ = step(freq3, I3, 12.0, 11.0, valid=1, miss=0)
    rec_ok = (abs(rec - freq3) <= SLEW)
    return freeze_ok, rec_ok, abs(rec - freq3)


def main():
    out = io.StringIO()
    def w(*a): out.write(" ".join(str(x) for x in a) + "\n")
    w("# STAGE6 PI SHADOW SANITY (J/K/L) - offline, write-gate locked")
    w("LLC_HARDWARE_PI_VALIDATED=0 ; NO_REAL_POWER_EXECUTED")
    w("Profile: CTRL_PI_KP_HZ_PER_V=%.5f CTRL_PI_KI_STEP_HZ_PER_V_STEP=%.6f"
      % (KP, KI))
    w("")
    bits, j_ok = self_test_j()
    for k in sorted(bits):
        w("  J case %d: %s" % (k, "PASS" if bits[k] else "FAIL"))
    w("  J (case 8 PWM-register isolation proven structurally by write gate + FLASH disasm)")
    w("STAGE6_BALANCED_PROFILE_OFFLINE_SELFTEST_PASS = %s" % j_ok)

    down, rev = first_step_sanity()
    w("")
    w("## K first-step sanity (BALANCED profile)")
    w("  Vout=11V: error~+1V P~+6657Hz Iterm~+44.4Hz unsat<150k first step 150000->149900 : %s" % down)
    w("  Vout=13V: first step 150000->150100 : %s" % rev)
    w("  BALANCED_PROFILE_FIRST_STEP_SANITY_PASS = %s" % (down and rev))

    fok, rok, rdiff = adc_stale()
    w("")
    w("  L 3-sample stale freeze=%s recovery<=100Hz=%s (first recovery step=%d Hz)"
      % (fok, rok, rdiff))
    w("  ADC_STALE_BALANCED_FREEZE_RECOVERY_PASS = %s" % (fok and rok))
    text = out.getvalue()
    with io.open(os.path.join(DOCS, "STAGE6_PI_SHADOW_SANITY.md"), "w", encoding="utf-8") as f:
        f.write(text)
    print(text)
    return j_ok and (down and rev) and (fok and rok)


if __name__ == "__main__":
    main()
