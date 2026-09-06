#!/usr/bin/env python3
"""Static/model gates for the W5 private 250 kHz/DB110 packet-start authority."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
cal = (root / "app" / "cal_hold_burst.c").read_text(encoding="utf-8")
pwm = (root / "driver" / "pwm.c").read_text(encoding="utf-8")

start = cal.index("Uint16 CALHOLD_W3PacketAuthOk(void)")
end = cal.index("Uint16 CALHOLD_W3PacketRampAuthOk(void)", start)
auth = cal[start:end]

checks = {
    "W5_PACKET_AUTH_COMPILE_GATED": (
        "#if STAGE6_W5_LADDER_TEST" in auth
        and "s_cal_hold_mode == CAL_HOLD_MODE_W5_LADDER" in auth
    ),
    "W5_PACKET_AUTH_RETAINS_PRIVATE_LATCH": "s_w3_packet_write_auth != 0U" in auth,
    "W5_PACKET_AUTH_RETAINS_STAGE_AND_IDLE": (
        "g_bringup_stage == BRINGUP_STAGE_5A_OPEN_LOOP_MANUAL" in auth
        and "g_system_state == SYS_STATE_IDLE" in auth
    ),
    "W5_PACKET_AUTH_RETAINS_COMPARATOR_GATES": (
        "g_comp_tz_loopback_verified != 0U" in auth
        and "g_comp_inject_test_armed != 0U" in auth
        and "g_comp_prestart_reject == 0U" in auth
        and "g_comp_prestart_gpio15 != 0U" in auth
    ),
    "W5_PACKET_AUTH_RETAINS_FAULT_PWM_OST_GATES": (
        "g_fault_flags == 0UL" in auth
        and "g_pwm_enabled == 0U" in auth
        and "EPwm1Regs.TZFLG.bit.OST != 0U" in auth
    ),
    "W5_PACKET_START_EXACT_PROFILE_ONLY": (
        "period == 239UL && deadtime == 110U" in pwm
        and "CALHOLD_W3PacketAuthOk() != 0U" in pwm
    ),
}

failed = False
for name, ok in checks.items():
    print(f"{name}={'TRUE' if ok else 'FALSE'}")
    failed |= not ok
if failed:
    raise SystemExit(1)
print("SOL_W5_PACKET_START_AUTH_STATIC_PASS=TRUE")
