# W4 10 V quality protocol

W4 starts from the W3 V8 protected-Burst control baseline because W2 proved
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
