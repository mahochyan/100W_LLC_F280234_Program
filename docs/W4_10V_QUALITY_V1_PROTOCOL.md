# W4 10 V quality protocol

W4 starts from the protected-Burst control baseline because W2 proved
that continuous PFM cannot regulate 10 V inside the frozen plant envelope.
The original CR15/CR12.5 A/B/A load-step quality gate remains required. At the
user's explicit request, a CR10 60 s stress point is inserted first and is
advanced only through forward duration gates.

## CR10 V8 finding

V8 passed CR10 at 500 ms and 2 s, but the 10 s record failed the stricter W4
quality gate: steady minimum raw1073 and terminal raw1089 were below the
raw1182 minus-5% boundary and showed sustained output decline. The generic W3
average/safety harness passed, so the master W4 decision explicitly overrides
that narrower result. V8 was not run for 60 s at CR10.

## V9 full Phase-A packet

V9 retains the deterministic TBPRD239/DB110 start and mirrors the entire
initial-charge Phase-A dead-band cadence: DB110 for 15 cycles, then minus five
after every ten cycles, with DB36 written after cycle155 and a hard stop at
cycle160. It never enters the later period-ramp phase. A full packet has an
effective-pulse area of 7220 TBCLK-count-cycles versus V8's 4760, a 51.68%
increase, while every instantaneous operating point is already proven by the
successful initial charge.

The 50% duration-wide cycle cap, per-cycle raw1260 target and raw1300 hard
stop, three-sample raw1000 undersupply stop, 40 us OFF time, deterministic
first edge, Comparator/TZ/DAC/GPIO15 protection, legacy 11 V cap, and no-retry
policy are unchanged.

```text
V9_SOURCE_COMMIT=2e92444330be72d22e55576a58695b008da7dfd4
V9_STATIC=PASS_28_OF_28
V9_NE=PASS_FULL_PHASE_A_TO_DB36_MAX160
V9_NE_OUT_SHA256=44F94E2B279F7F5A656A0655C4580D5D6AC5E990AD2F9F6967FBE9C98EA8E9A4
V9_REAL_OUT_SHA256=04F5352643FBC82E614EA62C1032038D6CB01C4A18093534ABC2D431B0C9B046
V9_REGRESSIONS=W2_OPEN_LOOP_PASS_W2_LIVE_1_2_3_5_PASS_BURST_REGION_21_0_PASS
V9_NEXT=CR10_REAL_500MS
```

## CR10 input-limit closure

The V9 CR10 run at the presumed 0.5 A input limit stopped safely after
3.42416 s on the three-sample raw1000 undersupply gate. This was an input-power
boundary, not a control or protection trip: 10 V into 10 ohm is 10 W, while
24 V x 0.5 A provides only 12 W before conversion loss and transient margin.
The same V9 SHA was therefore repeated only after the physical condition was
changed to the W5-prescribed 0.7 A limit. The complete 500 ms, 2 s, 10 s, and
60 s forward ladder passed. The 60 s result held steady raw1209..1273,
average raw1230, with zero undersupply, hard-limit, fault, hardware-trip, or
public-enable events and terminal PWM0/OST1/TZINT0.

```text
W4_CR10_INPUT_LIMIT_ROOT_CAUSE=CONFIRMED
W4_CR10_V9_0P7A_60S=PASS
W4_CR10_60S_TOKEN=W4_CR10_10V_60S_SUSTAINED_PASS
```

## A/B/A on-chip trace

Source commit `525e9e2659f30b8a2b558e3906094c5f2fd25876` adds a passive,
one-shot 5 ms observer to the existing V9 protected-Burst hold. It never writes
PWM, control limits, protection state, or enable requests. Its 128-sample ring
records VOUT, packet cycles, and packet count. A 200 ms initial-load baseline
is followed by directional detection beginning at 5 s; two consecutive 20 ms
blocks must change the packet-demand index by at least 12.5%.

The demand index multiplies cycle rate by average packet depth. This matters
because earlier CR15/CR10 evidence showed that total cycle duty alone can stay
similar while deeper packets carry the extra load. Once detected, a 240 ms
window is frozen. Instantaneous raw1182..1306 enforces +/-5%, and a 20 ms moving
average must enter raw1215..1265 within 100 ms and remain there.

Both clean REAL/NE builds, executable models, on-target heavier/lighter
no-energy traces, deliberate peak rejection, incomplete-window rejection, and
the W3 safety regression passed. The REAL host harness checks the exact SHA,
Vin/load/current-limit declarations, boot/loopback/stage gates, performs no JTAG
read or halt during the 60 s firmware-owned power window, prints the physical
step marker at 8 s, and reads the trace only after terminal OST.

```text
W4_TRACE_SOURCE_COMMIT=525e9e2659f30b8a2b558e3906094c5f2fd25876
W4_TRACE_REAL_SHA256=2267A0C1DD8FF81373B71BFA35466B22882EE41A6EB99C771BB566B428ED1027
W4_TRACE_NE_SHA256=962A1A2AE30DE5F1FDF0E8870BD4F0DE62577470302446262F5639996C2A9129
W4_TRACE_STATIC_MODEL=PASS
W4_TRACE_ON_TARGET_NE=PASS__PWM_NEVER_RELEASED
W4_TRACE_NEXT=VIN24_LIMIT0P5A_CR15__THEN_CR15_TO_CR12P5
```

## V9 first A/B/A attempt and V10 correction

The first CR15-to-CR12.5 attempt was invalid rather than a plant failure. DSS
reported FTDI error -150. During the nominal 60.6 s host window the target's
hold counter advanced only 170735 fast ticks (3.4147 s), so the host halted in
an active packet before the firmware-owned terminal stop. Fault, hard-limit,
hardware-trip, and public-enable deltas were all zero, and host cleanup ended
at PWM0/OST1/TZINT0.

The load-demand change was nevertheless visible: baseline demand index was
2226 at 42 cycles/5 ms, while the ring contained 294..447 cycles/5 ms after
the operator step. It was not detected solely because V9 held detection until
250000 ticks (5 s) of target time.

V10 opens detection at 35000 ticks, exactly after the 500 ms start delay plus
the 40 x 5 ms baseline. It also adds a pre-fire host gate requiring 9000..11000
fast ticks during a 200 ms safe, PWM-off interval. The operator marker moves
to 2 s host time and the host waits 70 s total, leaving ten seconds beyond the
unchanged firmware-owned 60 s terminal OST. This is a new source and SHA; V9
will not be retried.

The V10 return attempt then completed an exact, fully safe 60 s hold but the
operator response arrived only after the process had terminated, so no step
was present in the power window. V11 makes the coordination deterministic.
Only an exact firmware-consumed tuple (W3 10 V mode, 60000 ms, one-shot arm=1,
valid direction) creates a private W4 session. CCS-visible direction/state
telemetry cannot grant the longer envelope. A valid session runs at least
60 s, terminates after trace COMPLETE/FAIL, and fails closed at a 180 s
target-time backstop. Its cycle cap grows proportionally from the original
7.5 M at 60 s to 22.5 M at 180 s, preserving the 50% ceiling. All normal W3
and legacy duration/energy caps are unchanged.

The extended window also hard-bounds the three Uint32 sum/count pairs at three
million accepted samples; instantaneous raw and extrema continue throughout.
The continuation raw ceiling proves a worst-case sum of 3,897,064,236, below
Uint32 maximum. At every terminal path firmware first forces OST, disables the
packet interrupt, clears software PWM-active state, publishes statistics, and
freezes final evidence. Only then does the REAL W4 image execute `ESTOP0`.
The no-energy image compiles that instruction out.

After printing the physical marker the DSS host calls `waitForHalt()` with an
infinite scripting timeout. It performs no memory access and never issues a
guessed wall-clock halt during the power window. The Codex command remains
alive while the operator changes the load; firmware's terminal `ESTOP0` wakes
the host for post-stop evidence collection. If DebugServer loses the terminal
event, automatic host cleanup is deliberately suppressed rather than halting
an unconfirmed active packet.
