"""SOL W1 ADC freshness semantic and source-order regression tests."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
adc = (ROOT / "app" / "adc.c").read_text(encoding="utf-8")
control = (ROOT / "app" / "control.c").read_text(encoding="utf-8")
protection = (ROOT / "app" / "protection.c").read_text(encoding="utf-8")
soft_start = (ROOT / "app" / "soft_start.c").read_text(encoding="utf-8")
globals_h = (ROOT / "app" / "llc_globals.h").read_text(encoding="utf-8")
shot_h = (ROOT / "app" / "shot.h").read_text(encoding="utf-8")


def check(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)
    print(f"PASS: {message}")


isr = adc.split("__interrupt void ADCINT1_ISR(void)", 1)[1]
early_clear = isr.index("AdcRegs.ADCINTFLGCLR.bit.ADCINT1 = 1U;")
publish = isr.index("g_adc_sample_sequence++;")
check(early_clear < publish, "ADCINT1 flag clears before sequence publication")
check(isr.count("AdcRegs.ADCINTFLGCLR.bit.ADCINT1 = 1U;") == 1,
      "ADC ISR has no late second clear that can erase a new EOC2 event")
check("adc_ovf_at_entry" in isr and "AdcRegs.ADCINTOVF.all" in isr,
      "ADC ISR snapshots entry overflow before early flag clear")
check("first_publish_pending_at_entry == 0U" in isr,
      "pre-arm first publication establishes baseline without false overflow fault")
check("AdcRegs.INTSEL1N2.bit.INT1CONT == 0U" in isr,
      "only non-continuous ADCINT overflow is classified as stopped publication")

closed_loop = adc.split("void ADC_SetClosedLoopSyncTriggerMode(void)", 1)[1].split("void ADC_SoftwareTrigger", 1)[0]
check("INT1CONT = 1U" in closed_loop, "closed-loop EOC2 stream uses continuous ADCINT1 mode")
check(adc.count("INT1CONT = 0U") >= 3,
      "init/software/SoftStart paths retain non-continuous ADCINT mode")
check("g_adc_freshness_wait_first_publish = 1U" in soft_start,
      "handoff waits for the first post-handoff complete publication")
check("g_adc_freshness_monitor_armed = 1U" in isr,
      "first complete ADC publication arms ACTIVE freshness monitoring")
check("g_adc_freshness_monitor_armed == 0U" in protection,
      "protection stale budget is inhibited before the first publication")
check("s_adc_stale_count > 2U" in protection,
      "original three-consecutive-miss stale threshold is unchanged")

check("fresh_seq == g_control_adc_sequence_last" in control,
      "freshness is based on publication sequence")
check("g_adc_vout_filtered_raw" not in control[control.index("fresh_seq ="):control.index("/* Fresh sample")],
      "unchanged ADC code value is not used to classify freshness")
check("g_control_last_consume_timer2" in control and "g_adc_last_publish_timer2" in adc,
      "publish and consume Timer2 stamps are recorded")
for symbol in (
    "g_adc_first_stale_phase",
    "g_adc_first_stale_fast_tick",
    "g_adc_first_stale_sample_age_cycles",
    "g_adc_first_stale_intflg",
    "g_adc_first_stale_intovf",
    "g_adc_first_stale_socflg",
    "g_adc_first_stale_soca_enable",
    "g_adc_fault_snapshot_flags",
    "g_adc_ovf_active_count",
):
    check(symbol in globals_h, f"black-box symbol exported: {symbol}")

keep_cadence = adc.split("void ADC_UpdatePwmSyncPointKeepCadence", 1)[1].split("void ADC_CheckOverflow", 1)[0]
check("SOCAPRD" not in keep_cadence,
      "TBPRD 352..413 updates preserve ET_3RD ADC cadence")
check("FIRST_REAL_PI_MIN_HZ            145000UL" in shot_h and
      "FIRST_REAL_PI_MAX_HZ            170000UL" in shot_h,
      "145..170 kHz control envelope is unchanged")


class FreshnessModel:
    """Small model of the unchanged >2 stale threshold plus new arm semantics."""

    def __init__(self, sequence: int) -> None:
        self.last = sequence
        self.armed = False
        self.stale = 0
        self.fault = False

    def timer_tick(self, sequence: int) -> bool:
        if not self.armed:
            self.last = sequence
            self.stale = 0
            return False
        if sequence == self.last:
            self.stale += 1
            self.fault = self.stale > 2
            return False
        self.last = sequence
        self.stale = 0
        return True

    def publish(self) -> None:
        self.armed = True


# Pre-arm ticks cannot consume the stale budget.
m = FreshnessModel(10)
for _ in range(10):
    check(not m.timer_tick(10) and not m.fault, "pre-arm held sequence does not fault")

# Same ADC value is intentionally absent from the model: a new sequence is fresh.
m.publish()
check(m.timer_tick(11) and not m.fault, "same-value/new-sequence publication is fresh")
for sequence in range(12, 80):
    check(m.timer_tick(sequence) and not m.fault, "continuous publication does not false-stale")

# Deliberately stopped publication trips at the original third duplicate.
check(not m.timer_tick(79) and not m.fault, "stopped publish duplicate 1 is tolerated")
check(not m.timer_tick(79) and not m.fault, "stopped publish duplicate 2 is tolerated")
check(not m.timer_tick(79) and m.fault, "stopped publish duplicate 3 triggers stale fault")

print("SOL_W1_ADC_FRESHNESS_UNIT_TESTS_PASS")
