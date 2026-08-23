# FIRST REAL PI SHOT — Bench Checklist (CNT3/CNT4 STILL OPEN)

Task: STAGE6_FIRST_BOUNDED_REAL_PI_SHOT. **This is prep only. No real power,
no CNT3/CNT4 connection, no Kp/Ki re-tune in this step.** The first real PI
shot runs ONLY after a human approves connecting the resonant path.

> 只有获得人工批准后，才允许连接CNT3/CNT4。

## Binary under test
- Build: `Stage6_FLASH_SHOT` (CGT 25.11.1.LTS, COFF, `STAGE6_FIRST_BOUNDED_REAL_PI_SHOT=1`).
- Frozen: `evidence/stage6_first_real_pi_shot/LLC_100W_F28034_BRINGUP_DSH_SHOT.out`
- SHA256: `B9E0FC2B566E50A5C3E65BC85D05FACB028CD5BFE7F0149EECCE260D9E2FFD58`
- Only this exact binary is approved for the bench. Re-flash re-validates from zero.

## Hardware gate state (verify before every shot attempt)
- [ ] **CNT3 / CNT4 OPEN** (resonant + power path disconnected). No real power conduction.
- [ ] 24 V bench supply (LLC DC bus), current-limited to **0.5 A**.
- [ ] Comparator / TZ **real chain** intact: DAC300 on the comparator, comparator
      output trips TZ1 (no blanking, no mask, no auto retry).
- [ ] Comparator configured at **DAC300** (no higher DAC value used).
- [ ] No latched fault (`g_fault_flags == 0`), `g_system_state == SYS_STATE_INIT/IDLE`.
- [ ] `g_board_vout_cal_valid == 1` (board VOUT calibration valid).
- [ ] Stage6 Profile C closed-loop handoff evidence captured (`g_softstart_handoff_result == 1`).

## First-shot envelope (absolute, never overridden)
- [ ] Command clamped to **145000 <= freq <= 170000** Hz. No 200k / 250k diagnostic
      override is used for the real shot (the shot build rejects >170000 anyway).
- [ ] LLC_HARDWARE_PI_VALIDATED = 0, LLC_CONTROL_DIRECTION = 0 (gate locks remain).

## On-chip safety (no CCS / PC / human dependency)
- [ ] On-chip **200 us** auto-OST: shot timer starts at PI handoff; on expiry
      unconditional OST + PWM disable + shot revoke + exit RUN.
- [ ] Fast **11 V** VOUT abort (raw computed from `board_calibration.h`, no magic).
- [ ] Comparator/TZ event -> immediate OST + FAULT + shot permission revoke.

## Shot sequence to run on the bench (approved CNT3/CNT4 only)
1. Flash the frozen SHOT binary (SHA above).
2. Power 24 V (0.5 A limit). Confirm no fault, comparator/TZ armed.
3. Profile C handoff to 10 V closed loop (synthetic VOUT evidence recorded).
4. Set shot_arm = 1, runAsynch, let the on-chip 200 us auto-OST fire.
5. Halt. Confirm COMPLETE (state=3, abort=TIMEOUT), OST latched, PWM off, no fault.
6. Dump the ring buffer (tick/Vout_raw/Vout_filtered/error/freq_cmd/actual/TBPRD/
   PI_integral/fresh/TZFLG/COMP/fault). All recorded commands within 145..170 kHz.
7. No auto retry: a failed/aborted shot stays revoked until a human re-arms.

## Pass criteria
- Envelope never exceeded (no command >170k / <145k).
- Auto-OST observed within ~200 us without CCS/PC.
- Any 11 V condition or real TZ aborts to FAULT + revoke, PWM disabled.
- All of the above with CNT3/CNT4 STILL OPEN unless a human approves otherwise.
