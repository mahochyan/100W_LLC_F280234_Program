# W2 Candidate 3 Timingfix 5 Qualification

Source commit: `20a5ab7147b977b966ab94c1455092fb23499de7`

## Functional change

- Formal Profile C endpoint remains 150 kHz/TBPRD399/DB36 and is validated
  before the checked 160 kHz/TBPRD374 handoff brake.
- PI state is preloaded to frequency/shadow 160000 Hz and integral
  -40960000 Q12 (-10000 Hz relative to the unchanged 150 kHz bias).
- Fast power-reduction slew is the original 500 Hz; power-increase slew is
  100 Hz and the envelope remains 145..170 kHz.
- The REAL Q12 path removes only a redundant global miss read and a legacy
  volatile sample-valid mirror store. Publication sequence, shot freshness
  counters and the three-miss protection gate remain authoritative.

## On-target no-power gates

```text
HANDOFF: TBPRD374 CMPA187 CMPB93 DB36 ET_3RD FREQ160000
         INTEGRAL_Q12=-40960000 FIRST_PI=160000 FAULT0 OST1 PASS
TIMING_2MS:   COMPUTE846 APPLY846 ACTIVE846 SHUTDOWN546 OVERRUN0 PASS
TIMING_10MS:  COMPUTE846 APPLY846 ACTIVE846 SHUTDOWN546 OVERRUN0 PASS
TIMING_100MS: COMPUTE846 APPLY871 ACTIVE871 SHUTDOWN546 OVERRUN0 PASS
ADC_2MS:   FRESH50 PI50 STALE1 COMPUTE841 APPLY780 FAULT0 PASS
ADC_100MS: FRESH2450 PI2450 STALE1 COMPUTE874 APPLY865 FAULT0 PASS
ADC_100MS_STATS: VOUT301 FREQ301 TBPRD301 PI300 SKEW_LE1 PASS
FMAX_SAT_0: COMPUTE834 APPLY738 PASS
FMAX_SAT_1: COMPUTE834 APPLY738 PASS
FMAX_SAT_2: COMPUTE822 APPLY789 PASS
FMAX_SAT_3: BURST1 SAFE_STOP PASS
```

Static/Q12, ADC freshness, binary hardening, exhaustive fastpath equivalence
and period equivalence gates also pass. Every target test ended PWM0/OST1 or
remained OST1 throughout. These exact frozen SHA binaries were qualified for
one CR15 real 2/10/100 ms ladder under the standing operator confirmation.

## Unique CR15 real ladder result

The unique real 2 ms run was executed with the standing CR15 load confirmation.
It FAILED on the first duration; no 10/100 ms step was run and no CR12.5 was
auto-run.

```text
FAILED_DURATION=2MS
state=4 abort=2 (VOUT_11V) ok=0
softstart=1 handoff=1 burst=0
max_vout_raw=1370 (>=1367)
adc: fresh=8 pi=8 apply=7, seq 2753..2767, consumed 2752..2767,
     stale_total=0 stale_max=0 active_ovf=1 fault_snapshot=0
envelope: min_cmd=160500 max_cmd=163500 last_cmd=163500,
          first_tbprd=373 final_tbprd=366
timing: compute=875 active=875 apply=859 shutdown=1086 overrun=0
final: PWM=0 OST=1 TZ INT=0 pws=2 fault=0x10000
FAILED_GATE=MAX_VOUT_RAW_LT_1367
NEXT_LOAD_CANDIDATE=CR12.5
NO_RETRY_EXECUTED
BOARD_LEFT_SAFE_PWM0_OST1
```
