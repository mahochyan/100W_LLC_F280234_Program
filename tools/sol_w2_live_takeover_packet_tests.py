#!/usr/bin/env python3
"""Static gates for W2_BURST_LIVE_TAKEOVER_PACKET_V1."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OL_C = (ROOT / "app" / "open_loop_steady.c").read_text(encoding="utf-8")
OL_H = (ROOT / "app" / "open_loop_steady.h").read_text(encoding="utf-8")
PROBE_C = (ROOT / "app" / "power_probe.c").read_text(encoding="utf-8")


def body(source: str, signature: str, next_signature: str) -> str:
    start = source.index(signature)
    end = source.index(next_signature, start)
    return source[start:end]


def gate(name: str, condition: bool) -> None:
    print(f"{name}={'TRUE' if condition else 'FALSE'}")
    if not condition:
        raise AssertionError(name)


def main() -> None:
    takeover = body(OL_C, "static void OL_TakeoverPoll(void)",
                    "Uint16 OPENLOOP_LivePacketIsrOwned(void)")
    packet_isr = body(OL_C, "void OPENLOOP_LivePacketPwmIsr(void)",
                      "void OPENLOOP_FastTask(void)")
    ol_step = body(OL_C, "static void OPENLOOP_Step", "void OPENLOOP_Init(void)")
    probe_dispatch = body(PROBE_C, "__interrupt void EPWM1_INT_ISR(void)",
                          "void SINGLECYCLE_AbortByFault(void)")

    gate("STATIC_LIVE_PATH_NO_COLD_START",
         "PWM_StartDeterministic" not in OL_C and
         "MULTICYCLE_SlowTask" not in OL_C)
    gate("STATIC_FORMAL_TAKEOVER_REQUIRED",
         "SOFTSTART_PHASE_B" in takeover and
         "g_softstart_stage_index" in takeover and
         "OL_SessionInit(applied)" in takeover)
    gate("STATIC_AUTHORIZED_EXACT_SET",
         all(f"requested != {n}U" in takeover for n in (1, 2, 3, 5)) and
         "requested != 4U" not in takeover)
    gate("STATIC_FORCE_170K_AFTER_TAKEOVER",
         takeover.index("OL_SessionInit(applied)") <
         takeover.index("g_open_loop_frequency_command_hz = OPEN_LOOP_FREQ_MAX_HZ"))
    gate("STATIC_ARM_AFTER_ACTUATOR_COMMIT",
         ol_step.index("LLC_SetFrequencyHz(applied)") <
         ol_step.index("OL_LIVE_PACKET_STATE_WARMUP") and
         "applied == OPEN_LOOP_FREQ_MAX_HZ" in ol_step)
    gate("STATIC_WARMUP_BEFORE_COUNT",
         packet_isr.index("OL_LIVE_PACKET_STATE_WARMUP") <
         packet_isr.index("g_open_loop_live_packet_completed_cycles++"))
    gate("STATIC_EXACT_PLANNED_STOP",
         "g_open_loop_live_packet_completed_cycles >=" in packet_isr and
         "OL_LIVE_PACKET_RESULT_PASS" in packet_isr and
         "LLC_PWM_DisableSafe();" in packet_isr and
         "OL_STOP_LIVE_PACKET_COMPLETE" in packet_isr)
    gate("STATIC_UNCHANGED_VOUT_GATES",
         "OPEN_LOOP_VOUT_WARNING_RAW" in packet_isr and
         "OPEN_LOOP_VOUT_HARD_ABORT_RAW" in packet_isr and
         "FAULT_OPEN_LOOP_VOUT_CEILING" in packet_isr)
    gate("STATIC_TZ_FAULT_GATE",
         "EPwm1Regs.TZFLG.bit.OST" in packet_isr and
         "g_fault_flags != 0UL" in packet_isr)
    gate("STATIC_ISR_PRIORITY_BEFORE_SOFTSTART",
         probe_dispatch.index("OPENLOOP_LivePacketPwmIsr") <
         probe_dispatch.index("SoftStart_FastUpdate"))
    gate("STATIC_TELEMETRY_EXPORTED",
         all(symbol in OL_H for symbol in (
             "g_open_loop_live_packet_completed_cycles",
             "g_open_loop_live_packet_transition_tbprd",
             "g_open_loop_live_packet_transition_hz",
             "g_open_loop_live_packet_final_ost",
         )))
    print("SOL_W2_LIVE_TAKEOVER_PACKET_STATIC_PASS=TRUE")


if __name__ == "__main__":
    main()
