# W2 Burst Live-Takeover Packet V1 Protocol

This is a verification protocol inside the single W0-W14 master task. It is
not a separate work order.

## Purpose

Test whether one exact 170 kHz / DB36 cycle can be appended to the proven
formal SoftStart trajectory without the coast-and-cold-restart transient that
tripped Comparator/TZ1 in the prior candidate.

## Frozen behavior

- Vin 24 V, electronic load 15 ohm, as continuously confirmed by the operator.
- Formal SoftStart remains the only bridge release path.
- Takeover remains PHASE_B stage 10, TBPRD 339 (about 176.47 kHz), DB36.
- The first OL actuator write is 170000 Hz (TBPRD 352, actual about 169971 Hz).
- The first zero boundary after that TBPRD transition is synchronization only.
- The following boundary completes cycle 1 and immediately forces planned OST.
- Comparator/TZ1, WARNING raw 1304, HARD raw 1367, and the 145..170 kHz
  production envelope are unchanged.
- No PI, Burst controller, automatic retry, or second packet is allowed.

## Required pre-fire gates

1. Source static test passes.
2. On-target NE exact 1/2/3/5 cycle, reject, and fault-injection tests pass.
3. Existing open-loop, Burst-region, and historical packet NE regressions pass.
4. REAL build is clean and its SHA-256 equals the value embedded in the real
   harness.
5. Boot is IDLE, PWM=0, OST=1, TZINT=0, fault=0; loopback and stage 1..5A pass.

## REAL 1C acceptance

- Takeover completes without a fault and records the 176.47 kHz entry.
- Transition records TBPRD 352 / actual about 169971 Hz.
- Result is PASS, state DONE, and completed cycles equals exactly 1.
- Stop reason is `OL_STOP_LIVE_PACKET_COMPLETE`.
- Final state is PWM=0, OST=1, TZINT=0, fault=0.
- Vout remains below the frozen WARNING/HARD thresholds.

Any failed gate terminates the attempt. There is no automatic retry or 2C
advance.
