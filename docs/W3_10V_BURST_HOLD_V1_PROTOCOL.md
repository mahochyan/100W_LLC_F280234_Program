# W3 10 V Burst Hold V1 Protocol

## Scope

W3 closes the 10 V / 15 ohm protected hold gate at Vin 24 V. It extends the
existing `CALHOLD` controller with a firmware-selected W3 profile; the legacy
11 V calibration profile remains separate and unchanged.

The W3 duration ladder is strictly 500 ms, 2 s, 10 s, then 60 s. A failed
duration is not retried with the same binary. The next real fire requires a
diagnosed source change, a fresh source commit, a clean REAL build, and a new
hard-coded OUT SHA-256.

## Frozen control and safety values

```text
INITIAL_CHARGE_TARGET_RAW=1200 (~9.64 V)
RECHARGE_LOW_RAW=1220 (~9.81 V)
RECHARGE_TARGET_RAW=1260 (~10.13 V)
HARD_LIMIT_RAW=1300 (~10.45 V, below OL warning raw1304)
UNDERSUPPLY_ABORT_RAW=1000 (~8.03 V after 2 ms)
PACKET=250 kHz / TBPRD239 / DB110 / maximum 15 cycles
DURATION_MS=500,2000,10000,60000 only
TOTAL_CYCLE_CAP=20000,50000,250000,1500000 respectively
```

Comparator/TZ1 authority, GPIO15 loopback, the production 145..170 kHz
command envelope, OL warning raw1304, OL hard raw1367, and DB36 production
operation are unchanged.

## Initial charge authorization

The accelerated Profile C charge does not call the generic frequency command
path. It prepares exactly TBPRD239/DB110, then follows the existing bounded
trajectory: Phase A keeps TBPRD239 while reducing DB110 to DB36; Phase B keeps
DB36 while increasing TBPRD239 to TBPRD399. Every trajectory register write
requires a private, single-call latch owned by `power_probe.c`, an active and
valid Profile C state, IDLE system state, Stage 4 or 5A, verified Comparator/TZ
loopback, no public enable request, and no fault. Authorization is revoked
immediately after each write and on every exit/abort.

The on-target no-energy build exercises the exact initial 239/110 prepare while
OST remains latched and proves that `PWM_StartDeterministic` is not called.
REAL builds compile out that fixture.

## Recharge state machine

After Profile C reaches raw1200 and schedules OST, the controller enters OFF,
uses software-triggered VOUT sampling, and emits an exact low-energy restart
packet only at or below raw1220. Each packet stops at the first fresh sample at
or above raw1260, immediately at raw1300, or after 15 cycles. The controller
requires at least 40 us OFF between packets. Duration, aggregate packet-cycle,
undersupply, active fault/TZ, and invalid-request gates all end hardware-safe.

## Offline and on-target no-energy qualification

Source commit: `a29d60a578c6fb59bf7f1116d3a519cbe73cfe2b`
(`W3: add protected 10V burst hold`).

```text
STATIC=SOL_W3_10V_BURST_HOLD_STATIC_PASS=TRUE (17 gates)
ON_TARGET_NE=SOL_W3_10V_BURST_HOLD_NOENERGY_PASS=TRUE
NE_OUT_SHA256=E8A08E4440775D03F6A46DEBFC3CF16564CCBC346EB557257E91C4BBD8CA1370
NE_MAP_SHA256=905991CCF687CBEEB75650F10627722E44095D839344084D95601997E72A185E
ACCEL_NE=exact TBPRD239/DB110 prepare; zero PWM release; PWM0/OST1/TZINT0
W3_NE=mode latch, invalid duration, threshold/deadband behavior, bounded packet,
      hard-limit abort, duration completion, cycle-cap abort, fault abort all pass
REGRESSION_W2_OPEN_LOOP=PASS
REGRESSION_W2_LIVE_PACKET=PASS (exact 1/2/3/5, invalid/fault cases)
REGRESSION_W2_COLD_PACKET=PASS (exact 1/2/3/5, invalid/fault cases)
REGRESSION_W2_BURST_REGION=21 PASS / 0 FAIL
```

## REAL 500 ms acceptance gate

The real harness must hard-check the frozen OUT SHA before opening the debug
session. It performs boot-safe, VOUT calibration, Comparator/TZ loopback, and
Stage 1..5 gates, then makes one W3 mode/500 ms request. It does not generate a
public PWM-enable edge and does not issue a host-timed stop.

PASS requires firmware terminal COMPLETE/reason COMPLETE, active mode W3,
initial target/stop within the raw1200/raw1300 envelope, at least one recharge
packet, every packet within 1..15 cycles, aggregate cycles below 20000,
steady/maximum VOUT below raw1300, no fault, no hardware or active-window TZ
increment, and final PWM0/OST1/TZINT0. Any failed gate ends the ladder.

```text
REAL_OUT_SHA256=B81DCB715BA8350E66B3C3114B1E9B5AF2D38C2AB7E38AB8473117B07B0496D2
REAL_MAP_SHA256=61BC854853A320E6EDFC59FE10D3CBB86A88F4FBBC4B4FA24270EC1BA6F6E658
REAL_500MS_HARNESS=tools/sol_w3_10v_burst_hold_real_500ms.js (historical path at fire commit 8151cec)
REAL_FORWARD_HARNESS=tools/sol_w3_10v_burst_hold_real_ladder.js
```

The first harness invocation stopped at its combined CALHOLD boot check before
loopback, stage advance, or request write. It therefore was not a duration or
power attempt. Cleanup proved PWM0/OST1/TZINT0. Three subsequent cold-load,
read-only diagnostics all reported state0, requested/active mode0, request0,
IDLE/stage0, fault0, PWM0/OST1/TZINT0. The resume harness snapshots and prints
each boot value once and checks state and mode independently. Firmware and its
SHA remain unchanged; the no-same-SHA rule still applies after any actual
request is fired.

## REAL 500 ms result

PASS on the frozen SHA. Profile C reached raw1209 against target1200 and
hard-limit1300, then stopped at TBPRD399/DB36 without a hardware trip. The hold
completed at exactly 25000 fast ticks. It emitted 292 packets / 4674 aggregate
cycles; every packet was bounded at 15 cycles. Hold min/max were 1166/1235,
steady min/max/average 1200/1235/1224, and the 200 ms calibration-window average
was 1225 over 7103 samples. Hard-limit events, fault flags, hardware-TZ delta,
active-window-TZ delta, and public-enable-edge delta were all zero. Final state
was PWM0/OST1/TZINT0.

Evidence:
`evidence/sol_master_execution/w3_10v_burst_hold/real_500ms_resume_v2.txt`.

## REAL 2 s V1 failure and V2 correction

The 2 s request on the 500 ms SHA failed at the first cold recharge packet,
before its first completed cycle. The hardware snapshot captured DAC300,
TBCTR27, VOUT raw1175, an ACTIVE-window TZ event, and fault `0x50`; cleanup
proved PWM0/OST1/TZINT0. That SHA is retired and was not retried.

The old CALHOLD packet path directly reconfigured the comparator/DAC and then
released OST without the 2 us settle and GPIO15-safe observation used by the
already-proven Profile C initial charge. V2 makes every recharge packet call
that same comparator arm routine. The private PWM write gate now additionally
requires the comparator arm, zero pre-start rejection, and both the frozen and
live GPIO15-safe states. A failed arm or PWM prepare ends with explicit reason8
and OST retained. It also publishes reset statistics immediately so an early
abort cannot expose the preceding run's packet totals.

No threshold or protection authority changed. Static qualification passes 20
gates; target no-energy qualification includes the negative pre-start-authority
case and legacy 11 V packet authorization. All W2 regressions pass. V2 source
commit is `80af931829393e2a6d7aaf035efc2d764a423d4d`.
