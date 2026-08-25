// SOL W1 ADC cadence diagnostic: exercise the real ePWM1 SOCA -> ADCINT1
// publication path while hardware output remains doubly inhibited by OST and
// AQCSFRC force-low. This is a no-power diagnostic, not a real-power retry.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var ROOT = "D:\\CCS21_workspace\\Codex_Project";
var OUT = java.lang.System.getenv("SOL_W1_OUT") ||
  (ROOT + "\\Stage6_FLASH_SHOT_REAL_CR15_2MS\\LLC_100W_F28034_BRINGUP_DSH_REAL_CR15_2MS.out");
var EXPECTED = java.lang.System.getenv("SOL_W1_EXPECTED_SHA") ||
  "5E2B320B906F867725A9C843A94E78B8D50CB576CA92E2841871AF081DE3EDD7";
var INT1CONT = parseInt(java.lang.System.getenv("SOL_W1_INT1CONT") || "0", 10);
var FAULTS_ACTIVE = (java.lang.System.getenv("SOL_W1_FAULTS_ACTIVE") || "0") === "1";
var RUN_MS = parseInt(java.lang.System.getenv("SOL_W1_RUN_MS") || "10", 10);
var VREF_RAW = parseInt(java.lang.System.getenv("SOL_W1_VREF_RAW") || "1244", 10);
var INITIAL_VOUT_RAW = parseInt(java.lang.System.getenv("SOL_W1_INITIAL_VOUT_RAW") || "1244", 10);

function sha256File(path) {
  var md = MessageDigest.getInstance("SHA-256");
  var fis = new FileInputStream(path);
  var buf = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 8192);
  var n;
  while ((n = fis.read(buf)) > 0) md.update(buf, 0, n);
  fis.close();
  var d = md.digest(); var sb = new StringBuilder();
  for (var i = 0; i < d.length; i++) {
    var h = (d[i] & 0xFF).toString(16); if (h.length < 2) h = "0" + h;
    sb.append(h.toUpperCase());
  }
  return sb.toString();
}

var actual = sha256File(OUT);
print("OUT=" + OUT);
print("OUT_SHA256=" + actual);
if (!actual.equals(EXPECTED)) throw "OUT_SHA_MISMATCH";

var env = ScriptingEnvironment.instance();
var server = env.getServer("DebugServer.1");
server.setConfig(ROOT + "\\F28034.ccxml");
var session = server.openSession();

function addr(n) {
  var s = "" + session.expression.evaluate("&" + n);
  return (s.indexOf("0x") === 0 || s.indexOf("0X") === 0) ? parseInt(s, 16) : parseInt(s, 10);
}
function rw(n) { return session.memory.readWord(1, addr(n)); }
function rv32(n) {
  var a = addr(n);
  return (session.memory.readWord(1, a) | (session.memory.readWord(1, a + 1) << 16)) >>> 0;
}
function wv(n, v) { session.memory.writeWord(1, addr(n), v); }
function wv32(n, v) {
  var a = addr(n);
  session.memory.writeWord(1, a, v & 0xFFFF);
  session.memory.writeWord(1, a + 1, (v >>> 16) & 0xFFFF);
}
function reg(e) { return "" + session.expression.evaluate(e); }
function regn(e) {
  var s = reg(e); return (s.indexOf("0x") === 0 || s.indexOf("0X") === 0) ? parseInt(s, 16) : parseInt(s, 10);
}
function run(ms) { session.target.runAsynch(); java.lang.Thread.sleep(ms); session.target.halt(); }

try { session.target.connect(); } catch (e) {}
session.memory.loadProgram(OUT);
run(300);

var initPwm = rw("g_pwm_enabled");
var initOst = regn("EPwm1Regs.TZFLG.bit.OST");
var initFault = rv32("g_fault_flags");
print("INIT pwm=" + initPwm + " ost=" + initOst + " fault=" + initFault);
if (initPwm !== 0 || initOst !== 1 || initFault !== 0) throw "INIT_NOT_SAFE";

// Double hardware inhibition. Never clear OST in this diagnostic.
session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFA = 1");
session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFB = 1");
if (regn("EPwm1Regs.AQCSFRC.bit.CSFA") !== 1 ||
    regn("EPwm1Regs.AQCSFRC.bit.CSFB") !== 1 ||
    regn("EPwm1Regs.TZFLG.bit.OST") !== 1) throw "OUTPUT_INHIBIT_NOT_PROVEN";

// Configure the exact fmax closed-loop cadence: 170 kHz, SOCA at CMPB,
// every third PWM event, ADCINT1 from EOC2. Clear all pre-existing state.
// FREE_SOFT=0 stops ePWM while the target is halted, preventing the debugger's
// multi-millisecond register-write interval from manufacturing an overflow.
session.expression.evaluate("EPwm1Regs.TBCTL.bit.FREE_SOFT = 0");
session.expression.evaluate("EPwm1Regs.ETSEL.bit.SOCAEN = 0");
session.expression.evaluate("EPwm1Regs.TBPRD = 352");
session.expression.evaluate("EPwm1Regs.CMPA.half.CMPA = 176");
session.expression.evaluate("EPwm1Regs.CMPB = 88");
session.expression.evaluate("AdcRegs.ADCSOC0CTL.bit.TRIGSEL = 5");
session.expression.evaluate("AdcRegs.ADCSOC1CTL.bit.TRIGSEL = 5");
session.expression.evaluate("AdcRegs.ADCSOC2CTL.bit.TRIGSEL = 5");
session.expression.evaluate("AdcRegs.INTSEL1N2.bit.INT1SEL = 2");
session.expression.evaluate("AdcRegs.INTSEL1N2.bit.INT1E = 1");
session.expression.evaluate("AdcRegs.INTSEL1N2.bit.INT1CONT = " + INT1CONT);
session.expression.evaluate("AdcRegs.ADCINTFLGCLR.all = 0xFFFF");
session.expression.evaluate("AdcRegs.ADCINTOVFCLR.all = 0xFFFF");
session.expression.evaluate("PieCtrlRegs.PIEIFR1.bit.INTx1 = 0");
session.expression.evaluate("PieCtrlRegs.PIEIER1.bit.INTx1 = 1");
session.expression.evaluate("EPwm1Regs.ETSEL.bit.SOCASEL = 6");
session.expression.evaluate("EPwm1Regs.ETPS.bit.SOCAPRD = 3");

// Run the real split compute/apply load with no-power fault exemptions. The
// 2 ms on-chip cage ends it safely; ADC publications remain authentic.
wv("g_no_energy_test_mode", FAULTS_ACTIVE ? 0 : 1);
wv("g_system_state", 3);               // SYS_STATE_RUN
wv("g_pwm_enabled", 1);                // software state only; output inhibited
wv("g_bringup_stage", 7);              // BRINGUP_STAGE_6_CLOSED_LOOP
wv("g_control_reference_valid", 1);
wv("g_first_real_pi_shot_arm", 1);
wv("g_softstart_handoff_result", 1);
wv("g_board_vout_cal_valid", 1);
wv("g_comp_tz_loopback_verified", 1);
wv("g_first_real_pi_shot_state", 2);    // SHOT_STATE_ACTIVE
wv("g_pipeline_phase", 0);              // compute first
wv("g_pipeline_pending.valid", 0);
wv("g_pwm_fastpath_ready", 1);
wv("g_burst_enabled", 0);
wv32("g_power_run_min_frequency_hz", 145000);
wv32("g_control_frequency_hz", 170000);
wv32("g_control_shadow_frequency_hz", 170000);
wv32("g_switching_frequency_hz", 170000);
wv("g_pwm_period", 352);
wv("g_control_vref_raw", VREF_RAW);
wv("g_adc_vout_filtered_raw", INITIAL_VOUT_RAW);
wv32("g_adc_vout_filter_acc", INITIAL_VOUT_RAW * 16);
wv32("g_adc_sample_sequence", 0);
wv32("g_control_adc_sequence_last", 0);
wv32("g_control_adc_sequence_consumed", 0);
try {
  wv("g_adc_freshness_wait_first_publish", 1);
  wv("g_adc_freshness_monitor_armed", 0);
} catch (e) {
  // Baseline OUT predates the W1 arm-state symbols.
}
wv32("g_adc_ovf_count", 0);
/* APP_Init may have observed benign pre-handoff overlap before this harness
 * establishes its exact cadence. Reset both totals at the same boundary so
 * the ACTIVE verdict cannot include startup history. */
try { wv32("g_adc_ovf_active_count", 0); } catch (e) {}
wv("g_adc_ovf_first_tbctr", 0);
wv("g_adc_ovf_first_flag_was_set", 0);
wv32("g_fault_flags", 0);
wv32("g_fault_history", 0);
wv32("g_first_real_pi_shot_first_write_timer2", regn("CpuTimer2Regs.TIM.all"));
wv("g_timing_request", 1);

// Arm cadence last. With FREE_SOFT=0 no PWM/ADC event can occur until run().
session.expression.evaluate("AdcRegs.ADCINTFLGCLR.all = 0xFFFF");
session.expression.evaluate("AdcRegs.ADCINTOVFCLR.all = 0xFFFF");
session.expression.evaluate("PieCtrlRegs.PIEIFR1.bit.INTx1 = 0");
session.expression.evaluate("EPwm1Regs.ETCLR.bit.SOCA = 1");
session.expression.evaluate("EPwm1Regs.ETSEL.bit.SOCAEN = 1");

run(RUN_MS);

var seq = rv32("g_adc_sample_sequence");
var consumed = rv32("g_control_adc_sequence_consumed");
var fresh = rv32("g_shot_summary.fresh_compute_count");
var piCompute = rv32("g_shot_summary.pi_compute_count");
var stale = rv32("g_shot_summary.stale_compute_count");
var ovf = rv32("g_adc_ovf_count");
var ovfActive = -1;
try { ovfActive = rv32("g_adc_ovf_active_count"); } catch (e) {}
var ovfTbctr = rw("g_adc_ovf_first_tbctr");
var ovfFlag = rw("g_adc_ovf_first_flag_was_set");
var finalPwm = rw("g_pwm_enabled");
var finalOst = regn("EPwm1Regs.TZFLG.bit.OST");
var finalTzint = regn("EPwm1Regs.TZFLG.bit.INT");
var finalFault = rv32("g_fault_flags");
var computeMax = rv32("g_timing_compute_max");
var computeNormalMax = rv32("g_timing_compute_normal_max");
var computeFmaxMax = rv32("g_timing_compute_fmax_max");
var computeAbortMax = rv32("g_timing_compute_abort_max");
var applyMax = rv32("g_timing_apply_max");
var activeMax = rv32("g_timing_active_isr_max");
var overrun = rv32("g_timing_overrun_count");
print("RESULT seq=" + seq + " consumed=" + consumed + " fresh=" + fresh + " pi=" + piCompute + " stale=" + stale);
print("RESULT ovf_count=" + ovf + " ovf_first_tbctr=" + ovfTbctr + " ovf_first_flag=" + ovfFlag);
print("RESULT ovf_active_count=" + ovfActive);
print("RESULT int1cont=" + regn("AdcRegs.INTSEL1N2.bit.INT1CONT"));
print("RESULT compute_max=" + computeMax + " apply_max=" + applyMax + " active_max=" + activeMax + " overrun=" + overrun);
print("RESULT compute_normal_max=" + computeNormalMax + " compute_fmax_max=" + computeFmaxMax + " compute_abort_max=" + computeAbortMax);
print("FINAL pwm=" + finalPwm + " ost=" + finalOst + " tzint=" + finalTzint + " fault=" + finalFault);
print(ovf > 0 ? "SOL_W1_ADCINT_OVERFLOW_REPRODUCED" : "SOL_W1_ADCINT_OVERFLOW_NOT_REPRODUCED");
if (ovfActive === 0) print("SOL_W1_ACTIVE_ADCINT_OVERFLOW_CLEAR");
else print("SOL_W1_CONTINUOUS_OVERLAP_TELEMETRY_ONLY");

if (finalPwm !== 0 || finalOst !== 1 || finalTzint !== 0) throw "FINAL_NOT_SAFE";
if (seq === 0 || consumed === 0 || fresh === 0 || fresh !== piCompute || stale > 1)
  throw "ADC_PUBLICATION_FRESHNESS_GATE_FAIL";
/* INT1CONT=1 deliberately preserves publication if a same-group scheduling
 * overlap latches ADCINTOVF. W1 accepts this only when publication remains
 * fresh and fault-free; the overlap count stays visible as telemetry. */
if (finalFault !== 0 || computeMax > 900 || applyMax > 900 || overrun !== 0)
  throw "ADC_ACTIVE_CADENCE_GATE_FAIL";
print("SOL_W1_ADC_CADENCE_NOPOWER_HARD_GATES_PASS");
if (RUN_MS >= 120) {
  var vcnt = rv32("g_timing_last50_vout_count");
  var fcnt = rv32("g_timing_last50_freq_count");
  var pcnt = rv32("g_timing_last50_tbprd_count");
  var picnt = rv32("g_timing_last50_pi_count");
  var pmin = rw("g_timing_last50_tbprd_min");
  var pmax = rw("g_timing_last50_tbprd_max");
  var fmaxcnt = rv32("g_timing_last50_fmax_count");
  print("W2_100MS_STATS counts vout="+vcnt+" freq="+fcnt+" tbprd="+pcnt+" pi="+picnt+
        " tbprd_min="+pmin+" tbprd_max="+pmax+" fmax_count="+fmaxcnt);
  if (vcnt === 0 || fcnt === 0 || pcnt === 0 || picnt === 0 ||
      Math.abs(vcnt-fcnt)>1 || Math.abs(vcnt-pcnt)>1 || Math.abs(vcnt-picnt)>1 ||
      pmin < 352 || pmax > 413) throw "W2_100MS_TELEMETRY_GATE_FAIL";
  print("SOL_W2_100MS_TELEMETRY_NOPOWER_HARD_GATES_PASS");
}
try { session.terminate(); } catch (e) {}
