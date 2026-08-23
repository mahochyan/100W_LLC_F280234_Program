#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
STAGE6_FIRST_REAL_PI_SHOT_REAL_BINARY_HARDENING_V1 - static test suite.

These tests do NOT power hardware and do NOT connect JTAG. They verify the
REAL shot binary hardening requirements against source and the frozen REAL
MAP/OUT artifacts.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
REAL_MAP = ROOT / "Stage6_FLASH_SHOT_REAL" / "LLC_100W_F28034_BRINGUP_DSH.map"
REAL_OUT = ROOT / "Stage6_FLASH_SHOT_REAL" / "LLC_100W_F28034_BRINGUP_DSH.out"
NOENERGY_OUT = ROOT / "Stage6_FLASH_SHOT_NOENERGY" / "LLC_100W_F28034_BRINGUP_DSH.out"

failures = []

def check(cond, msg):
    if cond:
        print(f"PASS: {msg}")
    else:
        print(f"FAIL: {msg}")
        failures.append(msg)

def read_text(p):
    return p.read_text(errors="replace")

def sha256(p):
    import hashlib
    return hashlib.sha256(p.read_bytes()).hexdigest().upper()

# 1. Build macro mutual-exclusion
cfg = read_text(ROOT / "llc_config.h")
check("STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD) && defined(STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST)" in cfg and "#error" in cfg,
      "REAL_BUILD && NOENERGY_TEST mutual-exclusion #error present")
check("STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD) && defined(STAGE6_REAL_ACTUATOR_OST_TEST)" in cfg and "#error" in cfg,
      "REAL_BUILD && OST_TEST mutual-exclusion #error present")

# 2. REAL forbidden-symbol absence (MAP)
forbidden_syms = [
    "g_stage6_synthetic_vout_raw", "g_stage6_closeloop_vout_inject",
    "g_stage6_noenergy_test_enable", "g_stage6_noenergy_test_mode",
    "g_stage6_synthetic_sequence", "g_stage6_actuator_direct_cmd_hz",
    "g_first_shot_debug_freq_hz", "g_first_shot_debug_ticks",
    "g_diag_frequency_override",
]
if REAL_MAP.exists():
    map_text = read_text(REAL_MAP)
    for sym in forbidden_syms:
        check(f"_{sym}" not in map_text and f" {sym} " not in map_text,
              f"REAL MAP absent forbidden symbol {sym}")
    sse_lines = [ln for ln in map_text.splitlines() if "g_softstart_no_energy" in ln]
    check(len(sse_lines) <= 4,
          f"g_softstart_no_energy has <=4 symbol-table entries (definition only), got {len(sse_lines)}")
else:
    check(False, "REAL MAP missing")

# 3. REAL script forbidden-write audit
real_script = read_text(ROOT / "tools" / "stage6_first_real_pi_shot_real.js")
forbidden_writes = [
    "g_fault_flags", "g_fault_history", "g_system_state", "g_bringup_stage",
    "g_active_bringup_stage", "g_comp_tz_loopback_verified", "g_board_vout_cal_valid",
    "g_softstart_result", "g_softstart_state", "g_softstart_handoff_result",
    "g_control_reference_valid", "g_pwm_enabled", "g_adc_vout_raw",
    "g_adc_vout_filtered_raw", "g_adc_sample_sequence", "g_diag_frequency_override",
    "g_softstart_no_energy",
]
for v in forbidden_writes:
    pat = re.compile(rf"\bwv(?:32)?\(\s*\"{re.escape(v)}\"\s*,")
    check(not pat.search(real_script), f"REAL script does not write {v}")
for req in ["g_loopback_diag_request", "g_stage_confirm_request",
            "g_pwm_enable_request", "g_first_real_pi_shot_arm", "g_test_run_id"]:
    check(re.search(rf"\bwv(?:32)?\(\s*\"{re.escape(req)}\"\s*,", real_script),
          f"REAL script uses request interface {req}")
for reg in ["TZSEL", "TZCLR", "TBPRD", "CMPA", "CMPB", "DBRED", "DBFED",
            "COMPCTL", "DACVAL", "COMPSTS"]:
    check(not re.search(rf"writeWord\([^)]*{reg}", real_script),
          f"REAL script does not write register {reg}")
check("REAL_SHOT_HOST_SHA256_HARD_GATE_PASS" in real_script,
      "REAL script host SHA256 hard gate present")
check("sha256File" in real_script and "REAL_OUT_SHA256" in real_script,
      "REAL script computes host SHA256 and compares to manifest")
m = re.search(r"runAsynch\(\).*?halt\(\)", real_script, re.S)
if m:
    block = m.group(0)
    check(not re.search(r"\brw\(|\brv32\(|\breg\(", block),
          "REAL script has no runtime polling between runAsynch and halt")
else:
    check(False, "REAL script runAsynch->halt block not found")

# 4. Shot frequency envelope 145..170 kHz
shot_h = read_text(ROOT / "app" / "shot.h")
shot_c = read_text(ROOT / "app" / "shot.c")
check("FIRST_REAL_PI_MIN_HZ            145000UL" in shot_h, "shot envelope min 145 kHz")
check("FIRST_REAL_PI_MAX_HZ            170000UL" in shot_h, "shot envelope max 170 kHz")
check("SHOT_ClampFreq" in shot_c and "FIRST_REAL_PI_MIN_HZ" in shot_c and "FIRST_REAL_PI_MAX_HZ" in shot_c,
      "SHOT_ClampFreq clamps into 145..170 kHz")

# 5. 200 us on-chip cage
check("FIRST_REAL_PI_DURATION_TICKS    10U" in shot_h,
      "200 us cage = 10 x 20 us ticks (FIRST_REAL_PI_DURATION_TICKS == 10)")
check("g_first_real_pi_shot_tick >= FIRST_REAL_PI_DURATION_TICKS" in shot_c,
      "on-chip 200 us auto-OST uses FIRST_REAL_PI_DURATION_TICKS")

# 6. Debug override absent from REAL build
check("#if !STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD" in shot_h,
      "debug override declarations guarded out of REAL build (shot.h)")
check("#if !STAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD" in shot_c,
      "debug override definitions guarded out of REAL build (shot.c)")

# 7. No-energy protection bypass absent from REAL build
prot = read_text(ROOT / "app" / "protection.c")
ss = read_text(ROOT / "app" / "soft_start.c")
check("#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST" in prot,
      "no-energy TZ bypass guarded by NOENERGY_TEST (protection.c)")
check("#if STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST" in ss,
      "no-energy synthetic VOUT guarded by NOENERGY_TEST (soft_start.c)")

# 8. Production build shot code compiled-out
check("#if STAGE6_FIRST_BOUNDED_REAL_PI_SHOT" in shot_c,
      "shot code guarded by STAGE6_FIRST_BOUNDED_REAL_PI_SHOT")
prod_bat = read_text(ROOT / "tools" / "build_flash.bat")
check("STAGE6_FIRST_BOUNDED_REAL_PI_SHOT" not in prod_bat,
      "production build does not define shot macro")

# 9. Stage7 remains blocked
check("LLC_POWER_RUN_ALLOWED           0U" in cfg, "LLC_POWER_RUN_ALLOWED remains 0 (Stage7 blocked)")

# 10. LLC_HARDWARE_PI_VALIDATED / LLC_CONTROL_DIRECTION remain 0
check("LLC_HARDWARE_PI_VALIDATED       0U" in cfg, "LLC_HARDWARE_PI_VALIDATED remains 0")
check("LLC_CONTROL_DIRECTION           0" in cfg, "LLC_CONTROL_DIRECTION remains 0")
check("LLC_CONTROL_SIGN            (-1)" in cfg, "LLC_CONTROL_SIGN = -1 (Stage5A confirmed direction)")

# 11. REAL OUT != NOENERGY OUT (NOT BIT IDENTICAL)
if REAL_OUT.exists() and NOENERGY_OUT.exists():
    check(sha256(REAL_OUT) != sha256(NOENERGY_OUT), "REAL OUT != NOENERGY OUT (NOT BIT IDENTICAL)")
else:
    check(False, "REAL/NOENERGY OUT missing for bit-identity check")

print()
if failures:
    print(f"{len(failures)} check(s) FAILED")
    sys.exit(1)
print("ALL STAGE6 REAL BINARY HARDENING STATIC CHECKS PASSED")
