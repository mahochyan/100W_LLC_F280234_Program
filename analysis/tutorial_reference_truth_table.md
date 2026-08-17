# CSS024D Tutorial Soft-Start Reference Truth Table

Source: `100wllccode.zip/CSS024DV2.1_2Z2P` (also `CSS024DV2.1_PI`).

This file is a **source-code truth table**, not a recommendation to copy bugs.

---

## 1. Frozen tutorial parameters

| Parameter | Value | Source |
|---|---|---|
| MIN_BURST | 400 | `Function.h` |
| MAX_DT | 190 | `Function.h` |
| MIN_DT | 20 | `Function.h` |
| MAX_OPP_VAL | 310 | `Function.c` (comment says 30 A, **not trusted**) |
| MAX_SSCNT | 20 | `Function.c` |
| MAX_PD | 1714 | `Function.c` |

---

## 2. State machine

### `StateMInit()`
- Calls `ValInit()`
- Sets `DF.SMFlag = Wait`

### `ValInit()`
- `PWMDis()`
- Clears `F_BURST`
- `DF.ErrFlag = 0`
- `ID2DCtrValue.Voref = 0`
- `ID2DCtrValue.Ioref = 14750`

### `StateMWait()`
- Increments local `CntS`
- After `CntS > 300` (comment says 1.5 s) and `ErrFlag == F_NOERR`:
  - `CntS = 0`
  - `DF.SMFlag = Rise`
  - `STState = SSInit`

### `StateMRise()`
- `switch(STState)`

#### `SSInit`
- `RsingInitFlag = 0`
- Clear `F_BURST`
- `PWMDis()`
- `Comp1Regs.DACVAL = MAX_OPP_VAL` (310)
- `ID2DCtrValue.MaxPD = MIN_BURST + 1` (401)
- `ID2DCtrValue.DT = MAX_DT` (190)
- `ID2DCtrValue.Voref = 11421`
- `STState = SSWait`

#### `SSWait`
- Increment `Cnt`
- After `Cnt > MAX_SSCNT` (20, comment 100 ms):
  - `Cnt = 0`
  - `RegReflash()`
  - Set `F_BURST`
  - `PWMEn()`
  - `STState = SSRun`

#### `SSRun`
- `RsingInitFlag = 1`
- `MaxPD += 10`
- `DT -= 1`
- Clamp `MaxPD <= MAX_PD` (1714)
- Clamp `DT >= MIN_DT` (20)
- When both reach final values:
  - `DF.SMFlag = Run`
  - `STState = SSInit`

### `StateMRun()`
- Empty in reference source.

### `StateMErr()`
- Clear `F_BURST`
- `PWMDis()`
- If `ErrFlag == F_NOERR`:
  - `OppFlag = 0`
  - Clear `TZCLR.OST`
  - `DF.SMFlag = Wait`

---

## 3. Fast 20 us ISR chain

`ISR_20US()`:

```text
ADCSample()
ILoopCtl()
VILoopCtl2Z3P()
BurstCtl()
RegReflash()
FastProtection()
```

### `ADCSample()`
- Reads ADC results, averages, scales to Q15.
- Stores `SADC.Vout`, `SADC.Iout`, `SADC.Vadj`, averages.

### `ILoopCtl()`
- Current-limit inner loop.
- Produces `ID2DCtrValue.Ilimit`.

### `VILoopCtl()` (PI variant)
- Voltage loop with `VKP=1617`, `VKI=189`.
- Limits integral by `MaxPD`.
- Produces `ID2DCtrValue.PD`.

### `VILoopCtl2Z3P()` (2P2Z variant)
- 2-pole 2-zero voltage loop.
- Produces `ID2DCtrValue.PD`.
- During soft-start (`RsingInitFlag==0`) initializes error/history to a fixed state.

### `BurstCtl()`
- If `F_BURST` set and `PD < MIN_BURST`:
  - `PWMDis()`, local `Flag=1`
- Else if `Flag` was set:
  - `Flag=0`, `PWMEn()`

### `RegReflash()`
- If `PD > MaxPD`: `PD = MaxPD`
- If `PD < MIN_LOOPOUT`: `PD = MIN_LOOPOUT` (399)
- If `DT < MIN_DT`: `DT = MIN_DT`
- Writes:
  - `TBPRD = PD`
  - `CMPA = PD >> 1`
  - `CMPB = PD >> 2`
  - `DBFED = DT`
  - `DBRED = DT`

### `FastProtection()`
- `ShortOff()`
- `HwOpp()`

### `HwOpp()`
- On `TZFLG.OST == 1`:
  - Clear `F_BURST`, `PWMDis()`, `OppFlag=1`
- If not in `Err` and `OppFlag==1`:
  - Wait ~10 ISR cycles
  - If restart count > `MAX_OPP_NUM` (10): set `F_LLC_OCP`, `SMFlag=Err`
  - Else: clear `TZCLR.OST`, set `F_BURST`, `PWMEn()`, `RsNum++`
- Clears restart count after 500 ms without OPP.

---

## 4. Slow 200 Hz ISR chain

`ISR_200Hz()`:

```text
SlowP()
StateM()
VrefGet()
LEDShow()
```

### `SlowP()`
- `SwOCP()`, `SwOVP()`, `SwUVP()`

### `VrefGet()`
- Updates `Voref` from potentiometer/reference with slew limit `VREF_K=100`.

### `StateM()`
- Switch on `DF.SMFlag`, calls `StateMInit/Wait/Rise/Run/Err`.

### `LEDShow()`
- **Reference source bug**: inside `case Wait : StateMWait();`, `case Rise : StateMRise();`, etc. It calls state functions again.
- This means `LEDShow()` after `StateM()` in the same ISR executes the state machine a second time.
- In our port, `LEDShow()` must be display-only.

---

## 5. PWM enable/disable

### `PWMEn()`
- Only switches GPIO0/GPIO1 MUX to ePWM.
- **No OST synchronization, no TBCTR phase control.**

### `PWMDis()`
- Switches GPIO0/GPIO1 to GPIO outputs low.
- **No OST latch usage.**

---

## 6. `EPWMInit()`
- TBPRD=400, up-count, shadow period load.
- CMPA/CMPB shadow, `LOADAMODE=CC_CTR_PRD` (comment says CTR=0 but macro is `CC_CTR_PRD`).
- AQ: ZRO set, CAU clear.
- DB full enable, `DBRED=DBFED=150` initially.
- TZ1 one-shot, force low, interrupts disabled.
- ADC SOCA from CMPB.

## 7. `COMPInit()`
- COMP1, internal DAC, `CMPINV=1`, qualification `QUALSEL=5`.
- Initial DACVAL=500 (later soft-start sets 310).

---

## 8. Identified source bugs / unsafe patterns

| # | Item | Classification |
|---|---|---|
| A | `LEDShow()` calls `StateMWait()/StateMRise()/StateMRun()/StateMErr()` | `REFERENCE_SOURCE_BUG` |
| B | `PWMEn()` only toggles GPIO MUX, no deterministic TBCTR/OST start | `REFERENCE_SOURCE_BUG` / unsafe for our board |
| C | `MAX_OPP_VAL=310` comment “30A” is not calibrated | `UNVERIFIED` |
| D | ePWM shadow-load comment mismatch: code uses `CC_CTR_PRD`, comment says CTR=0 | `REFERENCE_SOURCE_BUG` (comment) |
| E | `HwOpp()` auto-clears OST and restarts PWM after 10 cycles | Tutorial design; must be LOCKED on our board |

---

## 9. Correct soft-start meaning

The tutorial is **not** a frequency sweeper from 150 kHz to 35 kHz.

It is:

```text
Control loop produces PD request
        ↓
SoftStart MaxPD is a moving period upper limit
        ↓
PD is clamped: PD = min(PD, MaxPD)
        ↓
PWM period = PD (and dead-time DT ramps down)
```

`MaxPD` starts at 401 (~150 kHz) and increments by 10 every 5 ms until 1714 (~35 kHz). `DT` starts at 190 and decrements by 1 every 5 ms until 20.

This gradually allows the control loop to use lower frequencies / larger periods.
