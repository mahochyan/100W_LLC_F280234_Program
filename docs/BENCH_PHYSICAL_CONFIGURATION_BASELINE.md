# Bench Physical Configuration Baseline

Status: **PERMANENT**
Date: 2026-08-25

## Physical configuration

- CNT3 = SOLDERED CLOSED
- CNT4 = SOLDERED CLOSED
- Resonant power path = permanently connected
- Removing CNT3/CNT4 is no longer an available test method
- Operator remains physically present during on-target execution
- Transformer: Ns1:Np:Ns2 = 4:5:4

## Token

`CNT34_PERMANENTLY_CONNECTED`

## Consequence

Do not require:

- Removing CNT3
- Removing CNT4
- Confirming CNT3/CNT4 OPEN
- Relying on an open resonant path for no-power

On-target timing validation is renamed:

`CONNECTED_STAGE_NO_SWITCHING_TIMING`

Environment gates:

- `DSH_CNT34_PERMANENT_CONNECTED_CONFIRMED=1`
- `DSH_OPERATOR_PRESENT_CONFIRMED=1`
- `DSH_NO_SWITCHING_TIMING_AUTHORIZED=1`
