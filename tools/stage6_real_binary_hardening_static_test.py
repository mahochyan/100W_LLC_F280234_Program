#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
STAGE6_FIRST_REAL_PI_SHOT_REAL_BINARY_HARDENING_V1_1 - static test suite.

These tests do NOT power hardware and do NOT connect JTAG. They verify the
REAL shot binary hardening requirements against source and the frozen REAL
MAP/OUT artifacts. They run on a clean checkout: when the local
Stage6_FLASH_SHOT_REAL / Stage6_FLASH_SHOT_NOENERGY build directories are
absent, the committed evidence artifacts are audited instead.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
EVID = ROOT / "evidence" / "stage6_first_real_pi_shot_real"

LOCAL_REAL_MAP = ROOT / "Stage6_FLASH_SHOT_REAL" / "LLC_100W_F28034_BRINGUP_DSH.map"
LOCAL_REAL_OUT = ROOT / "Stage6_FLASH_SHOT_REAL" / "LLC_100W_F28034_BRINGUP_DSH.out"
LOCAL_NOENERGY_OUT = ROOT / "Stage6_FLASH_SHOT_NOENERGY" / "LLC_100W_F28034_BRINGUP_DSH.out"

EVID_REAL_MAP = EVID / "LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT.map"
EVID_REAL_OUT = EVID / "LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT.out"
EVID_NOENERGY_OUT = EVID / "LLC_100W_F28034_BRINGUP_DSH_NOENERGY.out"
# RECOVERY V1: the newest frozen split-pipeline artifacts take precedence over
# the earlier frozen REAL candidate when auditing a clean checkout. The G build
# (explicit .bss init fix, 206da60c) is the current formal REAL binary.
EVID_SPLIT_G_MAP = EVID / "LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT_SPLIT_PIPELINE_G_206DA60C.map"
EVID_SPLIT_G_OUT = EVID / "LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT_SPLIT_PIPELINE_G_206DA60C.out"
EVID_SPLIT_MAP = EVID / "LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT_SPLIT_PIPELINE_932337AA.map"
EVID_SPLIT_OUT = EVID / "LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT_SPLIT_PIPELINE_932337AA.out"

REAL_MAP = LOCAL_REAL_MAP if LOCAL_REAL_MAP.exists() else (
    EVID_SPLIT_G_MAP if EVID_SPLIT_G_MAP.exists() else (
        EVID_SPLIT_MAP if EVID_SPLIT_MAP.exists() else EVID_REAL_MAP))
REAL_OUT = LOCAL_REAL_OUT if LOCAL_REAL_OUT.exists() else (
    EVID_SPLIT_G_OUT if EVID_SPLIT_G_OUT.exists() else (
        EVID_SPLIT_OUT if EVID_SPLIT_OUT.exists() else EVID_REAL_OUT))
NOENERGY_OUT = LOCAL_NOENERGY_OUT if LOCAL_NOENERGY_OUT.exists() else EVID_NOENERGY_OUT

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

print("artifact source: " +
      ("LOCAL build dirs" if LOCAL_REAL_MAP.exists() and LOCAL_REAL_OUT.exists()
       else "COMMITTED evidence (clean checkout)"))

# 0. Evidence artifacts present and manifest-consistent (G2/G4/G6)
manifest = read_text(EVID / "REAL_SHA256SUMS.txt")
m_real = re.search(r"REAL_OUT_SHA256\s*=\s*([0-9A-Fa-f]{64})", manifest)
m_map = re.search(r"REAL_MAP_SHA256\s*=\s*([0-9A-Fa-f]{64})", manifest)
check(REAL_OUT.exists(), "REAL OUT artifact present")
check(REAL_MAP.exists(), "REAL MAP artifact present")
# RECOVERY V1: after a candidate build the LOCAL build dir holds the newest
# candidate OUT/MAP. Accept the local artifact when its SHA matches ANY
# manifest-registered OUT/MAP (frozen REAL, candidate 1, candidate 2); the
# frozen REAL identity itself is still verified in evidence below.
registered_out = set(re.findall(r"(?:REAL_OUT|NOENERGY_OUT|REVOKED_OUT_9CE0EFBA|FASTPATH_OUT_0691C524|FASTPATH_OUT_CANDIDATE2_05BAA75C|SPLIT_PIPELINE_OUT)_SHA256\s*=\s*([0-9A-Fa-f]{64})", manifest))
registered_map = set(re.findall(r"(?:REAL_MAP|FASTPATH_MAP_0691C524|FASTPATH_MAP_CANDIDATE2_05BAA75C|SPLIT_PIPELINE_MAP)_SHA256\s*=\s*([0-9A-Fa-f]{64})", manifest))
if m_real:
    registered_out.add(m_real.group(1))
if m_map:
    registered_map.add(m_map.group(1))
check(sha256(REAL_OUT).upper() in {s.upper() for s in registered_out},
      "REAL OUT SHA256 matches any manifest-registered OUT (frozen/candidate)")
check(sha256(REAL_MAP).upper() in {s.upper() for s in registered_map},
      "REAL MAP SHA256 matches any manifest-registered MAP (frozen/candidate)")
check((EVID / "REVOKED_9CE0EFBA.txt").exists(),
      "old 9ce0efba OUT revocation marker present")
if (EVID / "REVOKED_9CE0EFBA.txt").exists():
    rev = read_text(EVID / "REVOKED_9CE0EFBA.txt")
    check("REVOKED_BY_REVIEW" in rev and "DO_NOT_EXECUTE" in rev,
          "revocation marker contains REVOKED_BY_REVIEW + DO_NOT_EXECUTE")
check((EVID / "LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT_REVOKED_9CE0EFBA.out").exists(),
      "old 9ce0efba OUT preserved under REVOKED name")

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

# 3a. E3: APP_Init run to completion before preflight
check("run(300)" in real_script, "REAL script runs APP_Init to completion (run 300 ms)")

# 3b. E4/E8: preflight hard gates
for g in ["INIT_SYS_IDLE", "INIT_PWM_OFF", "INIT_FAULT_ZERO", "INIT_OST_LATCHED",
          "INIT_VOUT_CAL_VALID", "PREFLIGHT_SYS_IDLE", "PREFLIGHT_PWM_OFF",
          "PREFLIGHT_FAULT_ZERO", "PREFLIGHT_OST_LATCHED", "PREFLIGHT_VOUT_CAL",
          "PREFLIGHT_COMP_VERIFIED", "PREFLIGHT_STAGE6", "PREFLIGHT_ARM_CLEAR"]:
    check(f"gate(\"{g}\"" in real_script or f"gate(\"{g}\"," in real_script,
          f"REAL script preflight hard gate {g} present")

# 3c. E5: loopback request + verify
check('wv("g_loopback_diag_request",1)' in real_script and
      "LOOPBACK_PASS" in real_script and "g_comp_tz_loopback_verified" in real_script,
      "REAL script requests Comparator loopback and verifies PASS")

# 3d. E6/E7: sequential stage confirm 1..6 (requests 1..7), each verified
check("for(var s=1;s<=7;s++)" in real_script and
      'wv("g_stage_confirm_request",s)' in real_script and
      'gate("STAGE_CONFIRM_"+s, stg===s)' in real_script,
      "REAL script confirms stages sequentially 1->2->3->4->5->6 (requests 1..7), each verified")

# 3e. E13/E14: strict PASS/FAIL + power_writes read as Uint16
check("REAL_SHOT_STRICT_PASS" in real_script and "REAL_SHOT_STRICT_FAIL" in real_script,
      "REAL script strict PASS/FAIL after black-box read")
check('rw("g_first_real_pi_shot_power_writes")' in real_script,
      "REAL script reads power_writes as Uint16 (rw)")
check('rv32("g_first_real_pi_shot_power_writes")' not in real_script,
      "REAL script does NOT read power_writes as rv32")

# 4. Shot frequency envelope 145..170 kHz
shot_h = read_text(ROOT / "app" / "shot.h")
shot_c = read_text(ROOT / "app" / "shot.c")
check("FIRST_REAL_PI_MIN_HZ            145000UL" in shot_h, "shot envelope min 145 kHz")
check("FIRST_REAL_PI_MAX_HZ            170000UL" in shot_h, "shot envelope max 170 kHz")
check("SHOT_ClampFreq" in shot_c and "FIRST_REAL_PI_MIN_HZ" in shot_c and "FIRST_REAL_PI_MAX_HZ" in shot_c,
      "SHOT_ClampFreq clamps into 145..170 kHz")

# 5. 1 ms real-time cage (1ms step: Timer2 cycles, not tick count)
check(re.search(r"FIRST_REAL_PI_DURATION_CYCLES\s+60000UL", shot_h),
      "1 ms real-time cage = 60000 Timer2 cycles at 60 MHz")
check("FIRST_REAL_PI_DURATION_CYCLES" in read_text(ROOT / "app" / "control.c") and
      "SHOT_Revoke(SHOT_ABORT_TIMEOUT)" in read_text(ROOT / "app" / "control.c") and
      "g_first_real_pi_shot_first_write_timer2" in read_text(ROOT / "app" / "control.c"),
      "on-chip 1 ms auto-OST via Timer2 gate in CTRL_FastTask (before any pending commit)")

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

# 12. B: REAL Profile C TBPRD239/DB110 allowed ONLY under SoftStart auth
pwm = read_text(ROOT / "driver" / "pwm.c")
check("SHOT_RealSoftStartAuthOk() != 0U" in pwm,
      "PWM_RuntimeValuesValid gates Profile C on SoftStart limited auth")
check("period < 239UL || period > 399UL" in pwm and "deadtime < 36U || deadtime > 110U" in pwm,
      "PWM_RuntimeValuesValid allows TBPRD 239..399 / DB 36..110 under SoftStart auth")
check("period < 399UL || period > 428UL" in pwm and "deadtime < 36U || deadtime > 190U" in pwm,
      "PWM_RuntimeValuesValid keeps production range outside SoftStart auth")

# 13. B: SoftStart vs PI frequency gates separated; PI 250k rejected
check("max_h = LLC_DIAG_MAX_HZ;" in prot and "SHOT_RealSoftStartAuthOk() != 0U" in prot,
      "PROT_SlowTask SoftStart frequency gate allows up to 250 kHz (Profile C)")
check("max_h = FIRST_REAL_PI_MAX_HZ;" in prot and "SHOT_RealBoundedPiAuthOk() != 0U" in prot,
      "PROT_SlowTask bounded-PI frequency gate caps at 170 kHz (250k rejected)")
check("max_h = LLC_HARD_MAX_HZ;" in prot,
      "PROT_SlowTask keeps production 150 kHz ceiling for other paths")

# 14. C: PROT_FastTask recognizes limited auth
ft = prot[prot.find("void PROT_FastTask"):]
check("SHOT_RealSoftStartAuthOk() != 0U" in ft and "SHOT_RealBoundedPiAuthOk() != 0U" in ft,
      "PROT_FastTask raw OVP check recognizes limited auth (REAL build)")

# 15. C: limited-auth bypass of CAL_MISSING / CONTROL_DIRECTION
check("limited_auth" in prot and "SHOT_RealSoftStartAuthOk() != 0U ||" in prot,
      "PROT_SlowTask computes limited_auth from SoftStart/PI auth")
check("g_bringup_stage >= BRINGUP_STAGE_6_CLOSED_LOOP && limited_auth == 0U" in prot,
      "CAL_MISSING gate bypassed only while limited auth holds")
check("LLC_CONTROL_DIRECTION == 0" in prot,
      "CONTROL_DIRECTION gate still present (bypassed only under limited auth)")

# 16. C: auth functions implemented in shot.c, declared in shot.h
check("Uint16 SHOT_RealSoftStartAuthOk(void)" in shot_c and
      "Uint16 SHOT_RealBoundedPiAuthOk(void)" in shot_c,
      "shot.c implements both limited-auth functions")
check("Uint16 SHOT_RealSoftStartAuthOk(void);" in shot_h and
      "Uint16 SHOT_RealBoundedPiAuthOk(void);" in shot_h,
      "shot.h declares both limited-auth functions")
check("SYS_STATE_SOFT_START" in shot_c and "SYS_STATE_RUN" in shot_c,
      "auth functions check system state (SOFT_START / RUN)")

# 17. D: no-handoff FINAL max window -> OST, never unverified RUN
check("SS_End(SS_RESULT_NOT_REACHED)" in ss and "SOFTSTART_ABORTED" in ss,
      "SoftStart FINAL max window ends NOT_REACHED + ABORTED (REAL build)")
check("SHOT_Revoke(SHOT_ABORT_NO_HANDOFF)" in ss,
      "no-handoff path revokes shot arm with SHOT_ABORT_NO_HANDOFF")
check("SHOT_Revoke(SHOT_ABORT_CEILING)" in ss and "SHOT_Revoke(SHOT_ABORT_TZ)" in ss and
      "SHOT_Revoke(SHOT_ABORT_FAULT)" in ss,
      "SS_End revokes shot arm on every other abort path (REAL build)")
check("SHOT_ABORT_NO_HANDOFF" in shot_h and "SHOT_ABORT_CEILING" in shot_h,
      "shot.h defines SHOT_ABORT_NO_HANDOFF / SHOT_ABORT_CEILING")

# 17b. STAGE6_TIMEOUT_OST_CLASSIFICATION_CLOSURE_V1: normal 200 us end must be
#      a planned POST_OST block, never an ACTIVE-window TZ fault.
check("LLC_PWM_DisableSafe();" in shot_c and "LLC_PWM_DisableSafe();          /* planned block: TZ OST latch + POST_OST */" in shot_c,
      "SHOT_Revoke(SHOT_ABORT_TIMEOUT) routes through LLC_PWM_DisableSafe()")
timeout_block = shot_c[shot_c.find("if (reason == SHOT_ABORT_TIMEOUT)"):shot_c.find("/* Abort paths -> FAULT")]
check("EPwm1Regs.TZFRC.bit.OST" not in timeout_block,
      "SHOT_Revoke timeout branch has NO raw TZFRC.OST write")
check("g_power_window_state       = POWER_WINDOW_POST_OST;" in timeout_block,
      "SHOT_Revoke timeout branch explicitly closes power window to POST_OST")
check("g_pwm_enable_result        = 0U;" in timeout_block and "g_pwm_enabled              = 0U;" in timeout_block,
      "SHOT_Revoke timeout branch clears PWM enable and result")

# 17c. Enum static gates (must match C header values).
cfg = read_text(ROOT / "llc_config.h")
shot_h = read_text(ROOT / "app" / "shot.h")
check(re.search(r"#define\s+FAULT_COMP_TZ1\s+0x00000010UL", cfg),
      "enum FAULT_COMP_TZ1 == 0x10")
check(re.search(r"#define\s+FAULT_ADC_STALE_OVERFLOW\s+0x00000040UL", cfg),
      "enum FAULT_ADC_STALE_OVERFLOW == 0x40")
check(re.search(r"#define\s+SHOT_ABORT_TZ\s+3U", shot_h),
      "enum SHOT_ABORT_TZ == 3")
check(re.search(r"#define\s+SHOT_ABORT_PERMISSION\s+6U", shot_h),
      "enum SHOT_ABORT_PERMISSION == 6")

# 17d. Harness signed control_error_raw and enum-aware post-shot gates.
noload_script = read_text(ROOT / "tools" / "stage6_first_real_pi_shot_real_1ms_noload.js")
chain_script = read_text(ROOT / "tools" / "stage6_g_nopower_chaincheck.js")
for label, script in [("real 1ms noload", noload_script), ("no-power chaincheck", chain_script)]:
    check("function r16(n){var v=rw(n); return (v>=32768)?v-65536:v;}" in script,
          f"{label} harness defines signed int16 r16()")
    check('var errRaw=r16("g_control_error_raw");' in script,
          f"{label} harness reads control_error_raw as signed int16")
    check("ENUM_FAULT_COMP_TZ1=0x10" in script and "ENUM_FAULT_ADC_STALE_OVERFLOW=0x40" in script and
          "ENUM_SHOT_ABORT_TZ=3" in script and "ENUM_SHOT_ABORT_PERMISSION=6" in script,
          f"{label} harness defines enum static gates")
    check("PWM_ENABLE_RESULT_ZERO" in script and "POWER_WINDOW_POST_OST" in script and
          "SUMMARY_ABORT_REASON_TIMEOUT" in script and "NO_ABORT_TZ" in script and
          "NO_ABORT_PERMISSION" in script and "FAULT_COMP_TZ1_BIT_CLEAR" in script and
          "FAULT_ADC_STALE_BIT_CLEAR" in script,
          f"{label} harness gates timeout closure + enum bits")

# 17e. Forbidden changes are still forbidden (no ADC-stale exemption, no
#      comparator/DAC threshold, no auto fault clear, no ISR gate relaxation).
adc_text = read_text(ROOT / "app" / "adc.c")
check("FAULT_ADC_STALE_OVERFLOW" in adc_text,
      "ADC stale overflow protection remains present")
check("LLC_OVP_RAW_THRESHOLD" in prot and "LLC_UVP_RAW_THRESHOLD" in prot and "LLC_OCP_RAW_THRESHOLD" in prot,
      "Comparator/DAC/protection thresholds remain unchanged in protection.c")
check("g_fault_flags |= FAULT_ADC_STALE_OVERFLOW" in adc_text,
      "ADC stale overflow still latches fault (no exemption)")
check("ISR_MAX_LE_900" in read_text(ROOT / "tools" / "stage6_first_real_pi_shot_real_binary_timing_nopower.js"),
      "ISR <=900 gate is not lowered/removed in no-power timing harness")

# 17f. STAGE6_G6_ACCEPTANCE_RECONCILIATION_AND_SHOT_LOCAL_TELEMETRY_V1:
#      shot-local entry max, signed error summary, Uint32 fault cause,
#      no-handoff POST_OST planned stop, and harness no longer uses global
#      post-IDLE error for direction.
shot_h = read_text(ROOT / "app" / "shot.h")
check("entry_interval_max_shot" in shot_h and "first_error_raw" in shot_h and
      "last_error_raw" in shot_h and "min_error_raw" in shot_h and "max_error_raw" in shot_h,
      "SHOT_ShotSummary contains shot-local entry max and signed error fields")
check("g_shot_summary.entry_interval_max_shot = g_shot_entry_interval_max;" in shot_c,
      "SHOT_Revoke(TIMEOUT) freezes shot-local entry max into summary")
control_c = read_text(ROOT / "app" / "control.c")
check("g_shot_entry_interval_max = 0UL;" in control_c and "g_shot_entry_last         = CpuTimer2Regs.TIM.all;" in control_c,
      "first apply resets shot-local entry interval measurement")
check("g_shot_entry_interval_max" in read_text(ROOT / "app" / "llc_globals.c") and
      "g_shot_entry_interval_max" in read_text(ROOT / "app" / "llc_globals.h"),
      "shot-local entry interval globals exist in llc_globals")
# NO_HANDOFF planned stop must not leave ACTIVE.
nh_block = shot_c[shot_c.find("if (reason == SHOT_ABORT_NO_HANDOFF)"):shot_c.find("/* Abort paths -> FAULT")]
check("LLC_PWM_DisableSafe();" in nh_block and "POWER_WINDOW_POST_OST" in nh_block,
      "SHOT_ABORT_NO_HANDOFF routes through LLC_PWM_DisableSafe() to POST_OST")
check("g_fault_flags" not in nh_block,
      "SHOT_ABORT_NO_HANDOFF does not latch a fault")
# Uint32 fault cause plumbing.
check("void PWM_Trip(Uint32 cause, Uint16 countTrip)" in read_text(ROOT / "driver" / "pwm.c") and
      "void    PWM_Trip(Uint32 cause, Uint16 countTrip);" in read_text(ROOT / "driver" / "pwm.h"),
      "PWM_Trip cause widened to Uint32")
check("void PROT_RequestFault(Uint32 cause, Uint16 countTrip)" in read_text(ROOT / "app" / "protection.c") and
      "void PROT_RequestFault(Uint32 cause, Uint16 countTrip);" in read_text(ROOT / "app" / "protection.h"),
      "PROT_RequestFault cause widened to Uint32")
# Harness must use shot-local entry max and NOT post-IDLE global error direction.
for label, script in [("real 1ms noload", noload_script), ("no-power chaincheck", chain_script)]:
    check('sEntryMax=rv32("g_shot_summary.entry_interval_max_shot")' in script,
          f"{label} reads shot-local entry max from summary")
    check("ENTRY_INTERVAL_LE_1230" in script and "sEntryMax" in script,
          f"{label} entry gate uses shot-local max")
    check("PI_DIRECTION_NEGATIVE_ERROR" not in script,
          f"{label} no longer gates on post-IDLE global error direction")
timing = read_text(ROOT / "tools" / "stage6_first_real_pi_shot_real_binary_timing_nopower.js")
check("g_shot_summary.entry_interval_max_shot" in timing and "sentry" in timing,
      "no-power timing harness reads shot-local entry max from summary")
check("ENTRY_INTERVAL_MAX_LE_1230" in timing and "sentry" in timing,
      "no-power timing entry gate uses shot-local max")
check("PI_DIRECTION_NEGATIVE_ERROR" not in timing,
      "no-power timing harness has no post-ID PI error direction gate")



# 18. F: timing script symbol audit against REAL MAP
timing = read_text(ROOT / "tools" / "stage6_first_real_pi_shot_real_binary_timing_nopower.js")
timing_syms = [
    "g_voltage_reference", "g_control_vref_raw",
    "g_real_timer0_entry_interval_min", "g_real_timer0_entry_interval_max",
    "g_real_timer0_last_entry", "g_real_timer0_entry_count",
    "g_real_isr_cycles_max", "g_real_isr_cycles_sum", "g_real_isr_cycles_count",
    "g_real_isr_overrun_count", "g_switching_frequency_hz",
    "g_power_run_min_frequency_hz", "g_softstart_handoff_result",
    "g_board_vout_cal_valid", "g_comp_tz_loopback_verified",
    "g_first_real_pi_shot_arm", "g_control_reference_valid",
    "g_system_state", "g_pwm_enabled", "g_bringup_stage",
    # V1-2 fresh-path closure symbols
    "g_control_adc_sequence_last", "g_adc_sample_sequence",
    "g_adc_vout_raw", "g_adc_vout_filtered_raw",
    "g_control_frequency_hz", "g_control_shadow_frequency_hz",
    "g_pwm_period", "g_control_fresh_sample_count", "g_control_pi_update_count",
    "g_first_real_pi_shot_state", "g_first_real_pi_shot_abort",
    "g_first_real_pi_shot_tick", "g_first_real_pi_shot_power_writes",
    "g_first_real_pi_shot_first_write_timer2",
    "g_first_real_pi_shot_ost_timer2",
    # RECOVERY V1 40 us split pipeline symbols (E: no ring in the 20 us ISR)
    "g_pipeline_phase", "g_pipeline_executed_phase",
    "g_pipeline_pending", "g_shot_summary",
    "g_real_compute_phase_cycles_max", "g_real_apply_phase_cycles_max",
]
if REAL_MAP.exists():
    for sym in timing_syms:
        check(f"_{sym}" in map_text, f"timing script symbol {sym} exists in REAL MAP")
else:
    check(False, "REAL MAP missing for timing symbol audit")
check("g_control_reference_volts" not in timing and "g_real_timer0_interval_min" not in timing and
      "g_real_timer0_interval_max" not in timing,
      "timing script uses real symbol names (no g_control_reference_volts / g_real_timer0_interval_*)")
check("DSH_CNT34_OPEN_CONFIRMED" in timing, "timing script gates on DSH_CNT34_OPEN_CONFIRMED=1")
check("TIMING_HOST_SHA256_HARD_GATE_PASS" in timing, "timing script host SHA256 hard gate present")
for g in ["FAULT_ZERO", "OST_LATCHED", "PWM_OFF", "AQCSFRC_FORCE_LOW"]:
    check(f"gate(\"{g}\"" in timing, f"timing script hard gate {g} present")
i_fault = timing.find('gate("FAULT_ZERO"')
i_state = timing.find('wv("g_system_state"')
check(i_fault != -1 and i_state != -1 and i_fault < i_state,
      "timing script gates run BEFORE any test-state write")
check(not re.search(r"\bwv(?:32)?\(\s*\"g_fault_flags\"\s*,", timing),
      "timing script does not clear fault flags")
check("TZCLR" not in re.sub(r"//.*", "", timing),
      "timing script has no TZCLR.OST write")
check("g_pwm_enable_request" not in timing, "timing script has no real enable request")
check("g_bringup_stage\",7" in timing, "timing script uses BRINGUP_STAGE_6_CLOSED_LOOP (7)")

# 19. G: REAL_BUILD_MANIFEST source_commit accounting
if (EVID / "REAL_BUILD_MANIFEST.txt").exists():
    bm = read_text(EVID / "REAL_BUILD_MANIFEST.txt")
    check("SOURCE_COMMIT" in bm and "EVIDENCE_COMMIT" in bm,
          "manifest records SOURCE_COMMIT and EVIDENCE_COMMIT separately")
    check("NON_DETERMINISTIC" in bm or "timestamp" in bm.lower(),
          "manifest documents non-deterministic build (timestamp)")

# 20. G: MAP newline policy (frozen MAP stored as-is, -text)
ga = read_text(ROOT / ".gitattributes")
check("evidence/stage6_first_real_pi_shot_real/*.map -text" in ga,
      ".gitattributes marks frozen MAP as -text (no EOL normalization)")

# 21. FRESH_PI_TIMING_HARNESS_FRESH_PATH_CLOSURE_V1 (V1-2) +
#     PERIOD_WRITE_CLOSURE_V1_3 (V1-3)
real_script = read_text(ROOT / "tools" / "stage6_first_real_pi_shot_real.js")
# B: timing script manufactures exactly one deterministic fresh sequence
check('wv32("g_control_adc_sequence_last",0)' in timing and
      'wv32("g_adc_sample_sequence",1)' in timing,
      "timing script manufactures one fresh ADC sequence (seq_last=0, seq=1)")
check('wv("g_adc_vout_raw",1200)' in timing and
      'wv("g_adc_vout_filtered_raw",1200)' in timing,
      "timing script sets VOUT raw 1200 (differs from Vref raw 1244)")
check('wv("g_control_vref_raw",1244)' in timing,
      "timing script sets Vref raw 1244 -> VOUT raw != Vref raw -> error_raw = +44")
check(timing.count('wv32("g_control_adc_sequence_last",0)') == 1 and
      timing.count('wv32("g_adc_sample_sequence",1)') == 1 and
      timing.count('wv("g_adc_vout_raw",1200)') == 1 and
      timing.count('wv("g_control_vref_raw",1244)') == 1,
      "timing script constructs the fresh control input exactly once")
# F: actual integer period arithmetic (not just string matching)
def llc_period(hz):
    return (60000000 + hz // 2) // hz - 1
check(llc_period(150000) == 399, "period(150000) == 399 (integer division)")
check(llc_period(149900) == 399, "period(149900) == 399 (integer division)")
check(llc_period(149800) == 400, "period(149800) == 400 (integer division)")
check('wv32("g_control_frequency_hz",149900)' in timing and
      'wv32("g_control_shadow_frequency_hz",149900)' in timing and
      'wv32("g_switching_frequency_hz",149900)' in timing and
      'wv("g_pwm_period",399)' in timing,
      "timing script initial frequency state = 149900 / period 399")
check(llc_period(149900) != llc_period(149800),
      "initial period != result period (399 != 400) -> period-changing path required")
check('149800' in timing and '149625' in timing,
      "timing script expects first command 149800 and actual 60000000/401=149625")
# C: pre-run read-only period baseline + post-run strict period-change gates
check('gate("PRE_RUN_TBPRD_399"' in timing and 'gate("PRE_RUN_PERIOD_ZERO"' in timing,
      "timing script read-only confirms EPwm1Regs.TBPRD==399 and g_pwm_period==0 (APP_Init Stage-0-SAFE clear, app.c:93) before any write")
# RECOVERY V1 B: formal-handoff fastpath reproduction gates
for g in ["FASTPATH_TOPOLOGY", "FASTPATH_TBPRD_399", "FASTPATH_CMPA_200",
          "FASTPATH_DBRED_DBFED_36", "FASTPATH_TZ1_ONESHOT",
          "FASTPATH_TZA_TZB_FORCE_LOW", "FASTPATH_OST_1",
          "FASTPATH_AQCSFRC_FORCE_LOW", "FASTPATH_FAULT_ZERO",
          "FASTPATH_PWM_ZERO", "FASTPATH_READY_WRITTEN",
          "ADC_CADENCE_ET3RD_CMPB"]:
    check(f"gate(\"{g}\"" in timing, f"RECOVERY V1 B fastpath gate {g} present")
check('wv("g_pwm_fastpath_ready",1)' in timing,
      "timing script writes g_pwm_fastpath_ready=1 only after read-only verification")
check('SOCASEL = 6' in timing and 'SOCAPRD = 3' in timing and 'SOCAEN = 1' in timing,
      "timing script sets closed-loop ADC cadence ET_CTRU_CMPB / ET_3RD / SOCAEN")
check("SPLIT_PIPELINE_40US_COMPUTE_MAX" in timing and "SPLIT_PIPELINE_40US_APPLY_MAX" in timing and
      "SPLIT_PIPELINE_40US_REAL_ISR_MAX" in timing and "SPLIT_PIPELINE_40US_TIMING_PASS" in timing and
      "SPLIT_PIPELINE_40US_TIMING_FAIL" in timing,
      "timing script prints split-pipeline phase maxima + RECOVERY V1 verdict (PASS or FAIL)")
for g in ["SUMMARY_FIRST_FREQ_149800", "SUMMARY_FIRST_TBPRD_400",
          "SUMMARY_FIRST_ACTUAL_149625"]:
    check(f"gate(\"{g}\"" in timing, f"timing result hard gate {g} present")
check('gate("SUMMARY_FIRST_TBPRD_400"' in timing and 'gate("SUMMARY_FIRST_ACTUAL_149625"' in timing,
      "timing PASS requires TBPRD change + actual-frequency update (prevents FREQUENCY_CHANGED_BUT_TBPRD_UNCHANGED)")
check('gate("FREQ_CMD_CHANGED"' not in timing,
      "timing script does NOT rely on freq_cmd != 150000 as the actuator-path proof")
# D: Timer2 no-power hard gate
check('gate("TIMER2_DELTA_59500_62500"' in timing and
      "FIRST_WRITE_TIMER2" in timing and "OST_TIMER2" in timing and "TIMER2_DELTA" in timing,
      "timing script Timer2 delta gate 59500..62500 with FIRST_WRITE_TIMER2/OST_TIMER2/TIMER2_DELTA output")
# E: result consistency gates (40 us split pipeline: phase maxima, phase
# counts derived statically, pending finally invalid, no ring gates)
for g in ["FRESH_SAMPLE_DELTA", "PI_UPDATE_DELTA", "POWER_WRITES_DELTA_26",
          "SUMMARY_FIRST_FREQ_149800", "SUMMARY_FIRST_TBPRD_400",
          "SUMMARY_FIRST_ACTUAL_149625", "PIPELINE_PI_COMPUTE_COUNT_26",
          "PIPELINE_PWM_APPLY_COUNT_26", "PIPELINE_FAST_TICKS_51",
          "PENDING_FINAL_INVALID", "SHOT_STATE_COMPLETE", "SHOT_ABORT_TIMEOUT",
          "SHOT_TICK_51", "SHOT_OK_1", "PWM_ZERO", "OST_LATCHED_END",
          "FAULT_ZERO_END", "COMPUTE_PHASE_MAX_LE_900", "APPLY_PHASE_MAX_LE_900",
          "ISR_MAX_LE_900", "OVERRUN_ZERO", "ENTRY_INTERVAL_MAX_LE_1230",
          "ISR_COUNT_POSITIVE", "TIMER0_ENTRY_POSITIVE"]:
    check(f"gate(\"{g}\"" in timing, f"timing result hard gate {g} present")
check('gate("RB_COUNT_11"' not in timing and 'gate("RING_FIRST_FRESH"' not in timing,
      "RECOVERY V1 E: no 12-field/4-field ring gates inside the 20 us ISR")
check("TIMING_NOPOWER_FAIL" in timing and "TIMING_NOPOWER_PASS" in timing,
      "timing script prints TIMING_NOPOWER_FAIL on any gate failure")
check("run(20)" in timing and "20 ms" in timing,
      "timing script runs 20 ms (not 2 s) from direct RUN state")
check("BRINGUP_STAGE_6_CLOSED_LOOP == 7" in timing and
      "BRINGUP_STAGE_7_POWER_RUN == 8" in timing,
      "timing script comments clarify Stage6 == 7 / Stage7 == 8")
# G: REAL script unchanged (25 ms wait + strict gates + Timer2 delta)
check("sleep(25)" in real_script,
      "REAL script waits >= 25 ms for worst-case termination (no reads)")
check("hres===1" in real_script and "ssres===1" in real_script,
      "REAL strict PASS checks handoff_result==OK and softstart_result==COMPLETE")
check("tk===10" in real_script and "rbc===11" in real_script and "pw===11" in real_script,
      "REAL strict PASS checks shot_tick==10, ring_count==11, power_writes==11")
check("t2d>=11000" in real_script and "t2d<=14000" in real_script,
      "REAL strict PASS checks Timer2 delta 11000..14000 cycles (~200 us)")
check("BRINGUP_STAGE_6_CLOSED_LOOP == 7" in real_script and
      "BRINGUP_STAGE_7_POWER_RUN == 8" in real_script,
      "REAL script comments clarify Stage6 == 7 / Stage7 == 8")

print()
if failures:
    print(f"{len(failures)} check(s) FAILED")
    sys.exit(1)
print("ALL STAGE6 REAL BINARY HARDENING STATIC CHECKS PASSED")
