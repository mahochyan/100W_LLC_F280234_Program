# CURRENT MAINLINE STATUS

> Branch: `stage6/first-real-pi-shot-real-binary-hardening-v1`
> Source baseline: `517a28112cce123975d4b8b54593b432bed519bf`
> Updated: 2026-08-23

## Current state

- Stage6 first real PI shot REAL binary hardening (V1) is prepared and audited
  offline. The REAL binary is synthetic-free, request-only, and carries a
  narrow Stage6 limited authorization plus passive realtime observation.
- **NO real energy shot, NO 200 us real PI power test, NO continuous closed
  loop were executed.** `NO_REAL_POWER_EXECUTED`.
- CNT3/CNT4 OPEN could not be physically confirmed in this session, so all
  JTAG run tests (including the no-power timing script) were STOPPED. The
  realtime timing gate (`ISR_MAX_CYCLES_LE_900`, `OVERRUN_ZERO`) is
  NOT_VERIFIED and must be run on the bench after CNT3/CNT4 OPEN is confirmed.

## Safety gates (unchanged)

- `LLC_HARDWARE_PI_VALIDATED = 0`
- `LLC_POWER_RUN_ALLOWED = 0`
- `LLC_CONTROL_DIRECTION = 0`
- `LLC_CONTROL_SIGN = -1` (Stage5A confirmed direction)
- PI frequency envelope 145000–170000 Hz, slew 100 Hz/20 us, shot max 200 us,
  VOUT abort at calibrated 11 V raw, Comparator→TZ1→OST, DAC 300, no auto retry.

## VOUT / IOUT

- VOUT cal: `BOARD_VOUT_CAL_VALID = 1`, `VOUT = 0.008089325*raw - 0.063715`
  (10 V ≈ 1244, 11 V ≈ 1368, 12 V ≈ 1491 raw).
- IOUT absolute calibration: PENDING.

## Transformer winding relation (C1)

`Ns1:Np:Ns2 = 4:5:4`, `Np = 5T`, `Ns1 = 4T`, `Ns2 = 4T`, `Ns_half = 4T`,
`n = Np/Ns_half = 5/4 = 1.25` — `ACTUAL_WINDING_RELATION`.

## Next steps (bench, after CNT3/CNT4 OPEN confirmed)

1. Confirm CNT3/CNT4 OPEN, resonant power path disconnected.
2. Run the no-power timing script to verify `ISR_MAX_CYCLES_LE_900` and
   `OVERRUN_ZERO`.
3. Run the REAL shot script (request-only, host SHA256 hard gate) for the first
   bounded 200 us PI shot.
