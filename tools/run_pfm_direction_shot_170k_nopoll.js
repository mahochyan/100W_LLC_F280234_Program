// STAGE5A PFM_DIRECTION 170k REAL SHOT - NO-POLLING single-read
// Fix: SS_HardStop now disables ETSEL.SOCAEN + ADC_SetSoftwareTriggerMode() post-stop,
// so debugger halt after stop no longer causes FAULT_ADC_STALE_OVERFLOW.
// No polling, no mid-run target access. Trigger -> sleep(500ms) -> single halt -> one dump.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
var env = ScriptingEnvironment.instance();
var server = env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session = server.openSession();
function addr(n){return session.expression.evaluate("&"+n);}
function rv(n){try{return ""+session.memory.readWord(1,addr(n));}catch(e){return "<f>";}}
function rv32(n){try{var a=addr(n);var lo=session.memory.readWord(1,a);var hi=session.memory.readWord(1,a+1);return ""+(lo|(hi<<16));}catch(e){return "<f>";}}
function wv(n,v){session.memory.writeWord(1,addr(n),v);}
function wv32(n,v){var a=addr(n);session.memory.writeWord(1,a,v&0xFFFF);session.memory.writeWord(1,a+1,(v>>>16)&0xFFFF);}
function reg(e){try{return ""+session.expression.evaluate(e);}catch(err){return "<f>";}}
var CAL = {gain:0.008089325, offset:-0.063715};
try {
  var p = "D:\\CCS21_workspace\\Codex_Project\\app\\board_calibration.h";
  var txt = new java.lang.String(java.nio.file.Files.readAllBytes(java.nio.file.Paths.get(p)), "UTF-8");
  var mg = txt.match(/GAIN\s+([0-9.eE+-]+f?)/);
  var mo = txt.match(/OFFSET\s+([-0-9.eE+-]+f?)/);
  if (mg) CAL.gain = parseFloat(mg[1].replace(/f$/,""));
  if (mo) CAL.offset = parseFloat(mo[1].replace(/f$/,""));
} catch(e) { print("cal parse fallback: "+e); }
function vout(raw){ return (CAL.gain*raw + CAL.offset).toFixed(3); }
// PRE phase: full halt/read/write safety gates (allowed before trigger)
session.target.connect();
try{session.target.halt();}catch(e){}
session.memory.loadProgram("D:\\CCS21_workspace\\Codex_Project\\Debug\\LLC_100W_F28034_BRINGUP_DSH.out");
session.target.runAsynch();
java.lang.Thread.sleep(200);
session.target.halt();
wv("g_bringup_stage",4);
wv("g_comp_tz_loopback_verified",1);
wv("g_diag_frequency_override",1);
wv32("g_test_run_id",0x250C5A17);
wv("g_softstart_acceptance_mode",1);
wv("g_softstart_no_energy",0);
wv("g_no_energy_test_mode",0);
wv("g_softstart_accept_target_raw",1244);
wv("g_softstart_hard_ceiling_raw",1491);
wv("g_pfm_direction_test_mode",2);   // 170K
wv("g_softstart_result",0);
wv("g_softstart_request",0);
wv("g_probe_scheduled_ost_occurred",0);
print("--- PRE-STATE VERIFY (fault=0,pwm=0,ost=1,DAC300,COMP,TZ1,VOUT<=50) ---");
var pre_fault = parseInt(rv("g_fault_flags"));
var pre_pwm   = parseInt(rv("g_pwm_enabled"));
var pre_ost   = parseInt(reg("EPwm1Regs.TZFLG.bit.OST"));
var pre_dac   = parseInt(reg("Comp1Regs.DACVAL.bit.DACVAL"));
var pre_comp  = parseInt(reg("Comp1Regs.COMPCTL.bit.COMPDACEN"));
var pre_tz1   = parseInt(reg("EPwm1Regs.TZSEL.bit.OSHT1"));
var pre_tza   = parseInt(reg("EPwm1Regs.TZCTL.bit.TZA"));
var pre_tzb   = parseInt(reg("EPwm1Regs.TZCTL.bit.TZB"));
session.expression.evaluate("AdcRegs.ADCINTFLGCLR.bit.ADCINT1 = 1");
session.expression.evaluate("AdcRegs.ADCSOCFRC1.all = 1");
session.target.runAsynch();
java.lang.Thread.sleep(2000);
session.target.halt();
var pre_vout  = parseInt(reg("AdcResult.ADCRESULT0"));
print("test_mode=2 run_id=0x250C5A17");
print("fault="+pre_fault+" pwm="+pre_pwm+" ost="+pre_ost
      +" sysstate="+rv("g_system_state")+" TZ="+reg("EPwm1Regs.TZFLG.all"));
print("DACVAL="+pre_dac+" COMPDACEN="+pre_comp+" TZ1_OSHT1="+pre_tz1
      +" TZCTL_TZA="+pre_tza+" TZB="+pre_tzb+" VOUT_raw(force)="+pre_vout);
print("COMPSTS="+reg("Comp1Regs.COMPSTS.bit.COMPSTS")+" GPIO15="+reg("GpioDataRegs.GPADAT.bit.GPIO15"));
if (pre_fault != 0 || pre_pwm != 0 || pre_ost != 1 ||
    pre_tz1 != 1 || pre_tza != 2 || pre_tzb != 2 || pre_vout > 50) {
    print("*** PRE-STATE VIOLATION — REAL_SHOT_REJECTED, DO NOT FIRE ***");
    session.target.disconnect();
    print("DONE");
    quit();
}
print("PRE-STATE OK — single PFM direction shot armed (NO-POLLING)");
print("--- TRIGGER FORMAL SOFTSTART + PFM WINDOW (REAL POWER) ---");
wv("g_softstart_request",1);
session.target.runAsynch();
java.lang.Thread.sleep(500);   // NO target access during run; firmware self-schedules OST
session.target.halt();          // single halt
print("done = no-poll (500ms sleep, single halt)");
print("result = " + rv("g_softstart_result"));
print("state = " + rv("g_softstart_state"));
print("test_mode_rec = " + rv("g_pfm_direction_test_mode"));
print("freq_hz = " + rv32("g_pfm_frequency_hz"));
print("TBPRD = " + reg("EPwm1Regs.TBPRD"));
print("CMPA = " + reg("EPwm1Regs.CMPA.half.CMPA"));
print("CMPB = " + reg("EPwm1Regs.CMPB"));
print("DBRED = " + reg("EPwm1Regs.DBRED"));
print("DBFED = " + reg("EPwm1Regs.DBFED"));
var sraw=parseInt(rv("g_pfm_start_raw")), eraw=parseInt(rv("g_pfm_end_raw")), mraw=parseInt(rv("g_pfm_max_raw"));
print("start_raw = " + sraw);
print("end_raw = " + eraw);
print("max_raw = " + mraw);
print("delta_raw = " + (eraw-sraw));
print("start_V = " + vout(sraw));
print("end_V = " + vout(eraw));
print("max_V = " + vout(mraw));
var st=parseInt(rv32("g_pfm_start_timer2")), et=parseInt(rv32("g_pfm_end_timer2"));
var el = st - et;
print("elapsed_us = " + (el/60).toFixed(1));
print("slope_raw_per_ms_timer = " + ((eraw-sraw)/(el/60000)).toFixed(3));
print("slope_raw_per_ms_cycle = " + ((eraw-sraw)/0.30005).toFixed(3));
print("window_cycles = " + rv("g_pfm_window_cycles"));
print("window_total = " + rv("g_pfm_window_total"));
print("hard_vout_abort = " + rv("g_pfm_hard_vout_abort"));
print("theoretical_window_us = " + (parseInt(rv("g_pfm_window_total"))*(parseInt(rv("g_pfm_tbprd"))+1)/60).toFixed(2));
print("soca = " + rv32("g_softstart_soca_count"));
print("eoc = " + rv32("g_softstart_eoc_count"));
print("miss = " + rv32("g_softstart_miss_count"));
print("consecutive = " + rv("g_softstart_consecutive_miss"));
print("stale = " + rv("g_softstart_stale_abort"));
print("ipri_raw_before/max/at_stop = " + rv("g_ipri_raw_before")+"/"+rv("g_ipri_raw_max")+"/"+rv("g_ipri_raw_at_stop"));
print("COMPSTS = " + reg("Comp1Regs.COMPSTS.bit.COMPSTS"));
print("GPIO15 = " + reg("GpioDataRegs.GPADAT.bit.GPIO15"));
print("TZFLG = " + reg("EPwm1Regs.TZFLG.all"));
print("comp_arm_dacval/compdacen/tzsel = " + rv("g_comp_arm_dacval")+"/"+rv("g_comp_arm_compdacen")+"/"+rv("g_comp_arm_tzsel_osht1"));
print("fault = " + rv("g_fault_flags"));
print("pwm = " + rv("g_pwm_enabled"));
print("ost = " + reg("EPwm1Regs.TZFLG.bit.OST"));
print("run_id_at_arm/stop = " + rv32("g_softstart_run_id_at_arm")+"/"+rv32("g_softstart_run_id_at_stop"));
print("final_pwm = " + rv("g_softstart_final_pwm"));
print("final_ost = " + rv("g_softstart_final_ost"));
print("SOCAEN_after_stop = " + reg("EPwm1Regs.ETSEL.bit.SOCAEN"));
print("ADCINTOVF_after_stop = " + reg("AdcRegs.ADCINTOVF.all"));
print("adc_trigger_mode_after = " + rv("g_adc_trigger_mode"));
var res = parseInt(rv("g_softstart_result"));
var fault = parseInt(rv("g_fault_flags"));
var wc = parseInt(rv("g_pfm_window_cycles"));
var wt = parseInt(rv("g_pfm_window_total"));
var hard = parseInt(rv("g_pfm_hard_vout_abort"));
var stale = parseInt(rv("g_softstart_stale_abort"));
var tbprd = parseInt(reg("EPwm1Regs.TBPRD"));
var socaA = parseInt(reg("EPwm1Regs.ETSEL.bit.SOCAEN"));
var ovfA = parseInt(reg("AdcRegs.ADCINTOVF.all"));
var pwmF = parseInt(rv("g_pwm_enabled"));
var ostF = parseInt(reg("EPwm1Regs.TZFLG.bit.OST"));
var pass = (res==8 && wc==wt && wt==51 && tbprd==352 &&
            fault==0 && hard==0 && stale==0 && pwmF==0 && ostF==1 && socaA==0 && ovfA==0);
print(pass ? "*** PFM_DIRECTION_170K_NOPOLL_PASS ***" : "*** 170K_NOPOLL_GATE_NOT_MET — REVIEW ***");
session.target.disconnect();
print("DONE");
