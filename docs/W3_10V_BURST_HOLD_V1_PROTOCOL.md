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

```text
V2_REAL_OUT_SHA256=CE206609D9469EBCEDADE7A56B81FD093422FEE641337439FEA7F4BC839C9F6F
V2_REAL_MAP_SHA256=F80992C3DA4D5599EFF6244469F55A14B7B30DD73E50109E156510062DA4BA43
```

## REAL 2 s V2 failure and V3 deterministic first edge

V2 passed the comparator-settle and GPIO15 pre-start gates, but its initial
accelerated Profile-C charge tripped in Phase A after approximately five
completed cycles (`fault=0x10`, TBCTR193, raw8, DAC300). The binary is retired.

The remaining release path was phase-dependent: `PWM_PrepareStart` wrote TBCTR
while TBCLK continued to run before the actual OST release, AQ continuous-force
loading still used its reset shadow-at-ZRO mode, and removing that force did not
first define AQ-A in front of the active-high-complementary dead-band. V3 makes
the actual first edge deterministic. It selects immediate AQ-force loading,
stores the prepared phase in the existing token, releases/readback-checks the
continuous override under OST, then performs AQ-A one-time SET, TBCTR rewrite,
OTSFA, and finally `TZCLR.OST` in that order.

The TI F2803x TRM (SPRUI10) was used as the primary hardware reference:
<https://www.ti.com/lit/ug/sprui10/sprui10.pdf>. No Comparator/TZ/DAC threshold,
frequency, dead-time, GPIO qualification, W3 voltage threshold, cycle cap, or
protection authority changed.

```text
V3_SOURCE_COMMIT=fc4f9ae3fdc2fc58c846834d99d993f45eeee735
V3_STATIC=PASS_23_OF_23
V3_NE=SOL_W3_10V_BURST_HOLD_NOENERGY_PASS=TRUE
V3_NE_OUT_SHA256=92F9955DF3587A3264CE4857A108042801F93C051F64D385886AF6C84F5DD8B3
V3_NE_MAP_SHA256=97782AE375F0BB0196028D6A701291ABCEE009487F7086ABF6850096EA9E0291
V3_REAL_OUT_SHA256=998A0A63EA6DFF930AC2B94C15CEE7D75D59B7501F383FA4BC1FE81D9B9BF102
V3_REAL_MAP_SHA256=9A701B16734A472F48573CB6CE4F17947155CB9A975F24390427C1ABC8841F62
V3_REAL_ASM=AQ_SET@3E9D8C__TBCTR@3E9D8D__OTSFA@3E9D8F__OST_CLEAR@3E9D94
V3_REGRESSIONS=W2_OPEN_LOOP_PASS__W2_LIVE_1_2_3_5C_PASS__BURST_REGION21_0_PASS
V3_NEXT=REAL_2000MS_ON_NEW_SHA
```

Detailed evidence:
`evidence/sol_master_execution/w3_10v_burst_hold/offline_qualification_v3_deterministic_start.txt`.

## REAL 2 s V3 result

V3 removed the hardware-trip failure. The deterministic initial charge reached
raw1205 in 419 cycles and the hold subsequently executed 2126 protected cold
starts with zero hardware/active-window TZ events and no fault. Every packet
reached the 15-cycle ceiling. At tick34438 (about 688.76 ms), raw VOUT crossed
below the raw1000 diagnostic floor and the firmware ended with the explicit
UNDERSUPPLIED reason. Final and host-cleanup state were PWM0/OST1/TZINT0.

This establishes a new, independent root cause: the bounded 250 kHz/DB110,
15-cycle packet policy does not supply enough average energy for the attached
15 ohm load. It is not a comparator false trip. V3 SHA `998A0A63...BF102` is
retired; the next candidate must add bounded hold-energy authority with a new
source commit/SHA while retaining Comparator/TZ and all voltage safety gates.

Evidence:
`evidence/sol_master_execution/w3_10v_burst_hold/real_v3_2s_v1.txt`.

## V4 bounded hold-energy authority

V3 quantified the new blocker. It executed 32235 cycles over 688.76 ms, an
observed PWM-active fraction of 18.72%, while the old duration-wide cap allowed
only 10%. Every packet also reached the 15-cycle ceiling. V4 therefore leaves
the proven 250 kHz/DB110 cycle unchanged and raises only the W3 profile's
bounded authority: maximum 64 cycles (256 us) per packet and aggregate active
time capped at 50% of each requested duration. Legacy 11 V stays at 15 cycles.

The firmware still checks target raw1260 and hard raw1300 on every fresh packet
sample, enforces at least 40 us OFF, retains deterministic first-edge startup,
and leaves Comparator/TZ/DAC and all voltage thresholds unchanged. Because the
candidate changes the energy envelope, it requalifies 500 ms before advancing
to 2 s, 10 s, and 60 s.

```text
V4_SOURCE_COMMIT=eeb9f756b92d26a925efbb2874444a5d0393940f
V4_STATIC=PASS_24_OF_24
V4_NE=SOL_W3_10V_BURST_HOLD_NOENERGY_PASS=TRUE
V4_NE_OUT_SHA256=EFB4DDAC97B4500A73B073EC3263393194B0899F76F4D203F92BDBD18F532CDA
V4_NE_MAP_SHA256=E57DA26F5CBEBF7043BB3DB5D46E575183EEF213AE2680118465533A6A9847E4
V4_REAL_OUT_SHA256=073290E38DC2DFD4BC06891DF95DB2FBA3D721A16B06B882F28E4913D729F3F7
V4_REAL_MAP_SHA256=A7CD0E328FF4988F841AFA1A27A1366B7FB2159210DF44E3910DA4153F138C79
V4_NEXT=REAL_500MS_REQUALIFICATION
```

Detailed evidence:
`evidence/sol_master_execution/w3_10v_burst_hold/offline_qualification_v4_energy_authority.txt`.

### V4 REAL 500 ms result

PASS on the new SHA. Initial charge reached raw1205 in 419 cycles. The hold
completed exactly 25000 fast ticks with raw1166..1243, steady average raw1225,
525 packets / 34240 cycles, and 27.392% PWM-active time. All packets reached
the 64-cycle ceiling without a fault, hardware/active TZ event, hard-limit
event, or public enable edge. Final and cleanup state were PWM0/OST1/TZINT0.

Evidence:
`evidence/sol_master_execution/w3_10v_burst_hold/real_v4_500ms_v1.txt`.

### V4 REAL 2 s result

The same SHA ended safely at tick30550 (611 ms) on a single raw997 reading.
Prior published minimum was raw1004 and steady average was raw1221. It had used
30784 cycles, fewer than the passing 500 ms run's 34240 cycles, so neither the
new aggregate cap nor total energy budget caused the immediate abort. There
was no fault, trip, hard-limit event, or public enable edge; final and cleanup
were PWM0/OST1/TZINT0.

The current undersupply logic aborts on one sample after its initial grace
period. The next candidate will retain raw1000 and require consecutive evidence
before declaring a sustained undersupply, so an OFF/PWM ADC-transition sample
cannot end an otherwise in-band run.

Evidence:
`evidence/sol_master_execution/w3_10v_burst_hold/real_v4_2s_v1.txt`.

## V5 persistent undersupply confirmation

V5 retains raw1000 and the existing initial 2 ms grace period, but W3 now
requires three consecutive below-floor OFF observations before declaring a
sustained undersupply. Any in-band observation clears the counter. Legacy 11 V
keeps its immediate behavior. This change filters only isolated ADC-transition
samples; it does not alter the normal 1220/1260 band, raw1300 hard stop,
250 kHz/DB110 energy settings, Comparator/TZ, or cycle/time caps.

```text
V5_SOURCE_COMMIT=ca793abe0b1df201033478a47950cbb2c998a2aa
V5_STATIC=PASS_25_OF_25
V5_NE=SOL_W3_10V_BURST_HOLD_NOENERGY_PASS=TRUE
V5_NE_OUT_SHA256=1F0AEAAD5D034522E8A48177524DFC9914FAF3071B4A2E5159BEED52D4FAAFEF
V5_NE_MAP_SHA256=12176121C3FFF07DAD144E461F46AAEAD39DF04F12A8796A4B5C05D8A38CF33E
V5_REAL_OUT_SHA256=7123C328ABC5750F0329720678078DE0038C7611B48A80631296F066F3D14D8A
V5_REAL_MAP_SHA256=FFF020965B8D9D555748D8A200FE8A4DF1B67E30D2BA886693BBB06AB9FAFD6D
V5_NEXT=REAL_500MS_REQUALIFICATION
```

Detailed evidence:
`evidence/sol_master_execution/w3_10v_burst_hold/offline_qualification_v5_undersupply_persistence.txt`.

### V5 REAL 500 ms result

PASS: exactly 25000 ticks, raw1166..1232, steady average raw1222, 354
packets / 22656 cycles (18.1248% active time), and final undersupply-confirm
count zero. There was no hard-limit event, fault, trip, or public enable edge.
Final and cleanup state were PWM0/OST1/TZINT0.

Evidence:
`evidence/sol_master_execution/w3_10v_burst_hold/real_v5_500ms_v1.txt`.

### V5 REAL 2 s result

V5 safely confirmed a sustained low condition instead of a one-sample event:
it ended at tick39016 (780.32 ms) with confirmation count3. All 893 packets
reached 64 cycles, the published maximum raw1241 stayed below target1260, and
active time was 29.6575%, below the 50% aggregate cap. There was no fault, trip,
hard-limit event, or public enable edge; final and cleanup were
PWM0/OST1/TZINT0.

The next candidate will not filter further. It will extend only the W3 packet
ceiling to 128 identical 250 kHz/DB110 cycles (512 us), so a recharge attempt
can reach target. The 50% aggregate cap and all per-cycle/software/hardware
stops remain unchanged.

Evidence:
`evidence/sol_master_execution/w3_10v_burst_hold/real_v5_2s_v1.txt`.

## V6 128-cycle bounded recharge

V6 extends only the W3 packet ceiling from 64 to 128 identical
250 kHz/DB110 cycles, or 512 us maximum. This gives a packet enough continuous
time to reach raw1260; the unchanged per-cycle target/hard checks can still end
it earlier. The 50% duration-wide cap, three-sample raw1000 confirmation,
minimum OFF time, deterministic start, and Comparator/TZ all remain unchanged.
Legacy 11 V remains capped at 15 cycles.

Existing allocated telemetry now records the last packet's start/stop/post-max/
post-last raw and cycle count, with no RAM increase.

```text
V6_SOURCE_COMMIT=c04c1f98576d868bfd325797a0e640ab8c3d23e0
V6_STATIC=PASS_26_OF_26
V6_NE=SOL_W3_10V_BURST_HOLD_NOENERGY_PASS=TRUE
V6_NE_OUT_SHA256=28994B67EA0F16AAE464123F3F96FCE129A7A5E201573B54044DDF71A578A3F2
V6_NE_MAP_SHA256=6B9A53C730FD3F6DD96D1905FD7CE253DC45DE266BE09A5E6C3A5A1FE5B8E8BE
V6_REAL_OUT_SHA256=BD0CFFCB33FABE522B23AAC49D445A1C65BC7EA17C0C506837EC7E28ECC05CA9
V6_REAL_MAP_SHA256=E096440DBCEC09FFA3D4129668EBF008DF607314EA191EFB97BF544B2C5616CE
V6_NEXT=REAL_500MS_REQUALIFICATION
```

Detailed evidence:
`evidence/sol_master_execution/w3_10v_burst_hold/offline_qualification_v6_packet128.txt`.

### V6 REAL 500 ms result

PASS: exactly 25000 ticks, raw1164..1245, steady average raw1227, only 32
packets / 4096 cycles (3.2768% active time), and undersupply-confirm count0.
The last packet started at raw1220 and ended at raw1230 (post-max1231) after
128 cycles. No hard-limit event, fault, trip, or public enable edge occurred;
final and cleanup were PWM0/OST1/TZINT0.

Evidence:
`evidence/sol_master_execution/w3_10v_burst_hold/real_v6_500ms_v1.txt`.

### V6 REAL 2 s result

V6 ended safely at tick22030 (440.6 ms). Its last packet began at raw992,
ran all 128 fixed-DB110 cycles, and ended raw990 with post-max997. This directly
shows no net recharge at low output. At TBPRD239/CMPA120, DB110 leaves only
about 10 TBCLK counts of effective pulse. Lengthening the same pulse again is
therefore rejected.

The accelerated Profile-C initial charge has repeatedly passed its Phase-A
DB110-to-DB36 ramp. The next candidate will reuse only a bounded DB110-to-DB90
prefix inside each packet, preserving the safe first edge while adding pulse
authority. All voltage, aggregate cycle, Comparator/TZ, and undersupply stops
remain unchanged.

Evidence:
`evidence/sol_master_execution/w3_10v_burst_hold/real_v6_2s_v1.txt`.

## V7 bounded per-packet DB ramp

Every V7 packet retains the deterministic TBPRD239/DB110 first cycle. At each
subsequent cycle boundary, DBRED/DBFED decrease by one to a fixed DB90 floor;
period and CMPA do not change. This is a conservative prefix of the initial
charge's repeatedly proven DB110-to-DB36 Phase-A trajectory.

Each DB-only write is authorized for one call by private W3 active-packet state
and requires Stage5A, IDLE, loopback, GPIO15 safe, no fault, plus the correct
REAL-active or NE-OST-clamped output state. A failed write ends safely. The
128-cycle and 50% aggregate caps, all voltage stops, and Comparator/TZ remain
unchanged.

```text
V7_SOURCE_COMMIT=1044cd71147f20ef33eccc33ba9aeba5db3e4dcb
V7_STATIC=PASS_27_OF_27
V7_NE=SOL_W3_10V_BURST_HOLD_NOENERGY_PASS=TRUE
V7_NE_OUT_SHA256=335B835FF2D34FAA514CCF74F94FF2B4CC1E71BA0C3DE5FE2AE3C1305DEF1B67
V7_NE_MAP_SHA256=EE17E481F332BA817A6A588D0862B2659FE35D151BDBD1569E86EFEA99148040
V7_REAL_OUT_SHA256=0E9200615F1A6A22E22B1875E339EE5778D1379D1003C71099A561053DB68C28
V7_REAL_MAP_SHA256=E1CACCD870679E015D5A579C07B35043032D40407F5DA47438D178C33FFB52A5
V7_NEXT=REAL_500MS_REQUALIFICATION
```

Detailed evidence:
`evidence/sol_master_execution/w3_10v_burst_hold/offline_qualification_v7_db_ramp.txt`.
