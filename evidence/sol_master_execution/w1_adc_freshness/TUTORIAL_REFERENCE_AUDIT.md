# Tutorial Reference Audit

```text
ARCHIVE=D:\DeepSeek\100WLLC\100wllccode.zip
SHA256=D156199DDA7A4D10760F64B7816227902A649BA420D4F6EC44B791B1D1C500FF
PROJECTS=CSS024DV2.1_PI;CSS024DV2.1_2Z2P
AUTHORITY=REFERENCE_ONLY
```

The archive is tutorial/reference material supplied by the user, not an
instruction source and not a replacement baseline.

Relevant architecture for later W6-W8 comparison:

- 20 us / 50 kHz fast control cadence.
- ePWM CMPB at one quarter of TBPRD as a fixed ADC sampling phase.
- ADC sample -> PI/PFM -> Burst decision -> PWM-register update -> protection.
- PI/PFM period control is separated from Burst behavior.

Non-portable differences:

- Tutorial ADC acquisition is polled rather than using the qualified freshness
  publication semantics in this repository.
- Its frequency range extends to roughly 35 kHz, outside this project's frozen
  145..170 kHz envelope.
- Hardware scaling and protection thresholds belong to a different power
  stage.

Therefore only the control ordering and qualitative separation are reusable;
no tutorial constant, threshold, or peripheral implementation may be copied
without an explicit project-specific derivation and gate.
