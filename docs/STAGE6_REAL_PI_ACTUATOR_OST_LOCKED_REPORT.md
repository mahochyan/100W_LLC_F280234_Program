# STAGE6_REAL_PI_ACTUATOR_OST_LOCKED_VALIDATION_V1

**Verdict: `STAGE6_REAL_PI_ACTUATOR_OST_LOCKED_PASS`** · `READY_FOR_FIRST_BOUNDED_REAL_PI_SHOT = true` · **`NO_REAL_POWER_EXECUTED`**

Target: F28034 @60 MHz C28x, CGT 25.11.1.LTS COFF.
Baseline `main = ebfb3bd`.

This task validated the FULL real path **ADC → freshness → Q12 PI → REAL `LLC_SetFrequencyHz()` → TBPRD/CMPA/CMPB** on the live part with the PWM **OST latched** and **AQCSFRC forced LOW**, so the MOS never receives a valid drive and no real power is produced. It is the **first validation of a real PI actuator** (not the first real-power shot).

---

## Gate Results

| Gate | Verdict | Evidence |
|------|---------|----------|
| A — Keep accepted baseline | **PASS** | Profile-C SoftStart handoff, 10 V handoff, Q PI (Kp=220587, Ki=1471 unchanged), ADC ownership, closed-loop ET_3RD cadence all preserved. `transfer=1`, `sys=RUN`. |
| B — no-energy protection bypass compiled out | **PASS** | Production `.obj` disassembly (`protection/soft_start/state_machine/control/pwm/adc`) has **0 references** to `g_softstart_no_energy`, `g_stage6_actuator*`, `g_pwm_fastpath_ready`. Production defines no test macros. |
| C — `g_softstart_no_energy` explicit init 0 | **PASS** | Explicit `=0U` in `llc_globals.c`; harness sets 1 only after OST=1 + AQCSFRC CSFA/CSFB=AQ_CLEAR + CNT in-range. |
| D — actuator write gated on OST | **PASS** | `LLC_HARDWARE_PI_VALIDATED=0` (never set). Real write only when `STAGE6_REAL_ACTUATOR_OST_TEST==1 && test_arm==1 && !revoked && TZFLG.OST==1`. |
| E — real actuator under OST | **PASS** | Sweep 150→149.9→…→145k then reverse →150→…→155k. TBPRD/CMPA/CMPB track exactly, DB=36, OST=1, CSFA/CSFB=1. |
| F — frequency mapping | **PASS** | 120k→499(120000) 130k→461(129870) 140k→428(139860) 150k→399(150000) 160k→374(160000) 170k→352(169972) 180k→332(180180). |
| G — dynamic PWM/ADC phase tracking | **PASS** | 120k→40.0k SPS, 150k→50.0k SPS, 180k→56.8k SPS, SOCAPRD=ET_3RD (3), CMPB repositions. 180k ≈5% under 60k from ADC-outrunning-control under actuator load. |
| H — full realtime budget | **PASS** | TINT0 whole max: 120k=833, 150k=834, 180k=837, sweep=834 (all ≤900). actuator ≤122 cy. ADC ISR ≤148 cy. **overrun=0**. |
| I — Timer0 jitter, no tick loss | **PASS** | 150k ticks: entries=149961 ≈ expected=150086 (0.08% window noise), interval_max=1393 <2400 → `INTERRUPT_PHASE_JITTER_ONLY`. |
| J — permission revoked on trip | **PASS** | Forced trip → `test_arm=0`, `revoked=1`, `sys=FAULT`, `pwm=0`, `OST=1`; `write_count` frozen; no auto-recovery. |
| K — final safe state | **PASS** | `test_arm=0`, `revoked=1`, `LLC_HARDWARE_PI_VALIDATED=0`, `LLC_CONTROL_DIRECTION=0`, `OST=1`, PWM LOW, binaries frozen. |

**L — Verdict: PASS** → `READY_FOR_FIRST_BOUNDED_REAL_PI_SHOT = true`, `NO_REAL_POWER_EXECUTED`.

---

## Firmware changes (this task)

- **`driver/pwm.c`** — `LLC_SetFrequencyHz`:
  - `g_pwm_fastpath_ready` fast path: skip the per-20-us PWM-topology re-validation once RUN is entered (topology is fixed after the formal ramp).
  - Skip TBPRD/CMPA write + CMPB reposition when the period is unchanged.
  - `hz` cache: when the commanded frequency is unchanged from the last applied one, skip the period divide entirely.
  - Each of these was needed to fit the real actuator inside the 20 µs ISR budget (TINT0 whole 1157→837).
- **`protection.c`** — no-energy freq-limit gate mirrors `LLC_DIAG_MAX_HZ` only under the no-energy test macro (production keeps `LLC_HARD_MAX_HZ=150 kHz`).
- **`soft_start.c`** — set `g_pwm_fastpath_ready=1` at RUN entry.
- **`control.c` / `pwm.c`** — real actuator write gated on OST + test_arm; revocation on trip.

## Binaries (frozen in `evidence/stage6_real_actuator_ost/`)

| Build | `.out` | SHA-256 |
|-------|--------|---------|
| NOENERGY (test) | `LLC_100W_F28034_BRINGUP_DSH.out` | `3A0C7F2BB632E6A70E74C307E5376579EB438A1181DA141D764B2AAADF87F714` |
| PRODUCTION | `LLC_100W_F28034_BRINGUP_DSH_PROD.out` | `1A59885FDF3A77CC926D2AB0C4AC74D2FB41BB23FE343069E2585D59F60AC95C` |

## Safety

- OST latched, AQCSFRC CSFA/CSFB=AQ_CLEAR (forced LOW) throughout.
- `LLC_HARDWARE_PI_VALIDATED=0`, `LLC_CONTROL_DIRECTION=0`.
- **No real power produced**; no MOS drive during the entire validation.
