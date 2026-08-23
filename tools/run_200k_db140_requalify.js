// =====================================================================
// run_200k_db140_requalify.js
// 200kHz / DB140 有界 MULTICYCLE 真实功率复验（1-cycle → 3-cycle → 15-cycle）
// 基于现有 MULTICYCLE 诊断接口（app/power_probe.c MULTICYCLE_*），不重写 PWM 控制逻辑。
//
// 顶部仅允许三个可变参数：
//   CYCLES    = 1 | 3 | 15
//   RUN_ID    = 0x20014001 | 0x20014003 | 0x2001400F
//   REAL_POWER= 1（真实功率，需操作员现场确认）；非 1 则只做 PRE 门巡检（干跑，不开枪）
//
// 固定参数（由固件 MULTICYCLE 路径落实，脚本不直写寄存器）：
//   frequency = 200000  (LLC_SetFrequencyHz -> TBPRD=299, CMPA=150)
//   deadtime  = 140     (PWM_PrepareStart -> DBRED=DBFED=140)
//   DAC       = 300     (固件常量 LLC_SINGLE_CYCLE_PROBE_DAC)
//   diag_override = 1 , accel_request = 0
// =====================================================================
var CYCLES = 3;              // 1 / 3 / 15
var RUN_ID = 0x20014003;     // 1-cycle=0x20014001 3-cycle=0x20014003 15-cycle=0x2001400F
var REAL_POWER = 1;          // 1 = 真实功率（须操作员确认现场条件）；0 = 干跑
// ---------------------------------------------------------------------
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
var env = ScriptingEnvironment.instance();
var server = env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session = server.openSession();

function addr(n){return session.expression.evaluate("&"+n);}
function rv(n){try{return ""+session.memory.readWord(1,addr(n));}catch(e){return "<f>";}}
function rv32(n){try{var a=addr(n);var lo=session.memory.readWord(1,a);var hi=session.memory.readWord(1,a+1);return ""+((lo|(hi<<16))>>>0);}catch(e){return "<f>";}}
function wv(n,v){session.memory.writeWord(1,addr(n),v);}
function wv32(n,v){var a=addr(n);session.memory.writeWord(1,a,v&0xFFFF);session.memory.writeWord(1,a+1,(v>>>16)&0xFFFF);}
function reg(e){try{return ""+session.expression.evaluate(e);}catch(err){return "<f>";}}
function u(n){var x=parseInt(n);return isNaN(x)?0:x;}

// ---- 板卡标定系数 ----
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

var expArm = RUN_ID;
var SYS_STATE_IDLE = 1;

// ---- 加载冻结 OUT，restart() 确保 _c_int00 完整初始化 ----
session.target.connect();
try{session.target.halt();}catch(e){}
session.memory.loadProgram("D:\\CCS21_workspace\\Codex_Project\\Debug\\LLC_100W_F28034_BRINGUP_DSH.out");
try{ session.target.restart(); }catch(e){}
session.target.runAsynch();
java.lang.Thread.sleep(1000);
session.target.halt();

function forceReadVout(){
  try{session.expression.evaluate("AdcRegs.ADCINTFLGCLR.bit.ADCINT1 = 1");}catch(e){}
  try{session.expression.evaluate("AdcRegs.ADCSOCFRC1.all = 1");}catch(e){}
  session.target.runAsynch();
  java.lang.Thread.sleep(1500);
  session.target.halt();
  return u(reg("AdcResult.ADCRESULT0"));
}

print("=== 200K_DB140 REQUALIFY : CYCLES="+CYCLES+" RUN_ID=0x"+RUN_ID.toString(16)+" REAL_POWER="+REAL_POWER+" ===");

// ---- 写诊断参数（不直写 TBPRD/CMPA/DBRED/DBFED/TZCLR.OST）。request 最后写（触发）。 ----
wv("g_bringup_stage",4);
wv("g_comp_tz_loopback_verified",1);
wv("g_diag_frequency_override",1);
wv32("g_single_cycle_probe_frequency_hz",200000);
wv("g_single_cycle_probe_deadtime",140);
wv32("g_multi_cycle_probe_cycles",CYCLES);
wv32("g_test_run_id",RUN_ID);
wv("g_accel_request",0);

// ---- PRE 安全门（在写参后校验；触发位 request 仍为 0）----
var pre_fault = u(rv("g_fault_flags"));
var pre_state = u(rv("g_system_state"));
var pre_pwm   = u(rv("g_pwm_enabled"));
var pre_req   = u(rv("g_pwm_enable_request"));
var pre_ost   = u(reg("EPwm1Regs.TZFLG.bit.OST"));
var pre_tzsel = u(reg("EPwm1Regs.TZSEL.bit.OSHT1"));
var pre_tza   = u(reg("EPwm1Regs.TZCTL.bit.TZA"));
var pre_tzb   = u(reg("EPwm1Regs.TZCTL.bit.TZB"));
var pre_compv = u(rv("g_comp_tz_loopback_verified"));
var pre_tbprd = u(reg("EPwm1Regs.TBPRD"));

var pre_vout = forceReadVout();
var discharge_ms = 0;
while (pre_vout > 50 && discharge_ms < 60000) {
    print("VOUT raw="+pre_vout+" (>50) : 等待放电 "+(discharge_ms/1000).toFixed(1)+"s");
    java.lang.Thread.sleep(2000); discharge_ms += 2000;
    pre_vout = forceReadVout();
}
print("PRE: fault="+pre_fault+" state="+pre_state+"(IDLE="+SYS_STATE_IDLE+") pwm="+pre_pwm
      +" req="+pre_req+" ost="+pre_ost+" TZ_OSHT1="+pre_tzsel+" TZA="+pre_tza+" TZB="+pre_tzb
      +" comp_loopback="+pre_compv+" TBPRD="+pre_tbprd);
print("VOUT_raw(force,true)="+pre_vout+"  VOUT_V="+vout(pre_vout)+"  TZFLG="+reg("EPwm1Regs.TZFLG.all")
      +" COMPSTS="+reg("Comp1Regs.COMPSTS.bit.COMPSTS")+" GPIO15="+reg("GpioDataRegs.GPADAT.bit.GPIO15"));
var topoOk = (pre_tbprd >= 200 && pre_tbprd <= 1000) ? 1 : 0;
var preOK = (pre_fault===0 && pre_state===SYS_STATE_IDLE && pre_pwm===0 && pre_req===0 &&
             pre_ost===1 && pre_tzsel===1 && pre_tza===2 && pre_tzb===2 &&
             pre_compv===1 && topoOk===1 && pre_vout<=50);
if (pre_vout > 50 && discharge_ms >= 60000) {
    print("*** VOUT_DISCHARGE_TIMEOUT (60s) -> stop, no shot ***");
    session.target.disconnect(); print("DONE"); quit();
}
if (!preOK) {
    print("*** PRE-STATE VIOLATION -> REAL_SHOT_REJECTED, DO NOT FIRE ***");
    session.target.disconnect(); print("DONE"); quit();
}
print("PRE-STATE OK -> 200k/DB140 MULTICYCLE shot armed");

if (REAL_POWER !== 1) {
    print("*** DRY-RUN: REAL_POWER="+REAL_POWER+"，PRE 门通过，未触发任何功率。 ***");
    session.target.disconnect(); print("DONE"); quit();
}

// ---- PRE 侧 TZ 计数 ----
var c_pre_sw   = u(rv32("g_tz_software_ost_count"));
var c_pre_hw   = u(rv32("g_tz_hardware_trip_count"));
var c_pre_act  = u(rv32("g_tz_active_window_trip_count"));
var c_pre_post = u(rv32("g_tz_post_ost_trip_count"));

print("--- TRIGGER MULTICYCLE BOUNDED WINDOW (REAL POWER, "+(CYCLES*300/60).toFixed(0)+"us theoretical) ---");
wv("g_multi_cycle_probe_request",1);
session.target.runAsynch();
java.lang.Thread.sleep(600);   // NO polling: let CPU run + probe complete + bookkeeping
session.target.halt();

print("done="+u(rv("g_multi_cycle_probe_result")));
print("result = " + rv("g_multi_cycle_probe_result"));
print("stop_reason = " + rv("g_multi_cycle_probe_stop_reason"));
print("active = " + rv("g_multi_cycle_probe_active"));
print("completed_cycles = " + rv32("g_multi_cycle_probe_completed_cycles"));
print("requested_cycles = " + rv32("g_multi_cycle_probe_cycles"));
print("TBPRD = " + reg("EPwm1Regs.TBPRD"));
print("CMPA = " + reg("EPwm1Regs.CMPA.half.CMPA"));
print("CMPB = " + reg("EPwm1Regs.CMPB"));
print("DBRED = " + reg("EPwm1Regs.DBRED"));
print("DBFED = " + reg("EPwm1Regs.DBFED"));
print("TBCTR = " + reg("EPwm1Regs.TBCTR"));
print("actual_freq_hz = " + rv32("g_actual_switching_frequency_hz"));
var tbprd = u(reg("EPwm1Regs.TBPRD"));
print("theoretical_window_us = " + (CYCLES*(tbprd+1)/60).toFixed(2));
var t2a = u(rv32("g_coldshot_timer2_start"));
var t2o = u(rv32("g_probe_ost_command_timer2"));
print("timer2_start = " + t2a + " timer2_ost_cmd = " + t2o + "  elapsed_ticks = " + (t2a-t2o) + "  elapsed_us = " + ((t2a-t2o)/60).toFixed(2));
print("vout_before = " + rv("g_multi_cycle_probe_adc_vout_before"));
print("vout_after = " + rv("g_multi_cycle_probe_adc_vout_after"));
print("vout_first = " + rv("g_probe_vout_first"));
print("vout_last = " + rv("g_probe_vout_last"));
print("vout_min = " + rv("g_probe_vout_min"));
print("vout_max = " + rv("g_probe_vout_max"));
print("vout_max_V = " + vout(u(rv("g_probe_vout_max"))));
print("probe_adc_samples = " + rv("g_probe_adc_sample_count"));
print("soca = " + rv32("g_adc_pwm_sync_soca_count"));
print("eoc = " + rv32("g_adc_pwm_sync_eoc_count"));
print("miss = " + rv32("g_adc_pwm_sync_miss_count"));
print("consecutive = " + rv("g_adc_pwm_sync_consecutive_miss"));
print("stale_abort = " + rv("g_adc_pwm_sync_stale_abort"));
print("ipri_peak = " + rv("g_multi_cycle_probe_adc_ipri_peak"));
print("ipri_raw_max = " + rv("g_ipri_raw_max"));
print("ipri_raw_at_stop = " + rv("g_ipri_raw_at_stop"));
print("comp1_dac_code = " + rv("g_comp1_dac_code"));
print("comp_prestart_reject = " + rv("g_comp_prestart_reject"));
print("comp_inject_armed = " + rv("g_comp_inject_test_armed"));
print("DACVAL(reg) = " + reg("Comp1Regs.DACVAL.bit.DACVAL"));
print("COMPSTS = " + reg("Comp1Regs.COMPSTS.bit.COMPSTS"));
print("GPIO15 = " + reg("GpioDataRegs.GPADAT.bit.GPIO15"));
print("TZFLG = " + reg("EPwm1Regs.TZFLG.all"));
print("pre_stop_ost = " + rv("g_pre_stop_ost"));
print("pre_stop_hardware_trip_seen = " + rv("g_pre_stop_hardware_trip_seen"));
print("pre_stop_tzflg = " + rv("g_pre_stop_tzflg"));
print("run_id_at_arm = 0x" + rv32("g_test_run_id_at_arm"));
print("run_id_at_stop = 0x" + rv32("g_test_run_id_at_stop"));
print("run_id_at_tz_isr = 0x" + rv32("g_test_run_id_at_tz_isr"));
print("completed_cycles_at_trip = " + rv32("g_completed_cycles_at_trip"));
print("tz_event_phase = " + rv("g_tz_event_phase"));
print("scheduled_ost_occurred = " + rv("g_probe_scheduled_ost_occurred"));
print("power_window_state = " + rv("g_power_window_state"));
print("accel_stop_reason = " + rv("g_accel_stop_reason"));
print("TZ_delta sw=" + (u(rv32("g_tz_software_ost_count"))-c_pre_sw)
      + " hw=" + (u(rv32("g_tz_hardware_trip_count"))-c_pre_hw)
      + " active=" + (u(rv32("g_tz_active_window_trip_count"))-c_pre_act)
      + " post=" + (u(rv32("g_tz_post_ost_trip_count"))-c_pre_post));
print("fault = " + rv("g_fault_flags"));
print("state = " + rv("g_system_state"));
print("final_pwm = " + rv("g_pwm_enabled"));
print("final_pwm_result = " + rv("g_pwm_enable_result"));
print("final_ost = " + reg("EPwm1Regs.TZFLG.bit.OST"));

// ---- PASS 硬门 ----
var res    = u(rv("g_multi_cycle_probe_result"));
var stp    = u(rv("g_multi_cycle_probe_stop_reason"));
var comp   = u(rv32("g_multi_cycle_probe_completed_cycles"));
var pf_ost = u(rv("g_pre_stop_ost"));
var pf_hw  = u(rv("g_pre_stop_hardware_trip_seen"));
var armID  = u(rv32("g_test_run_id_at_arm"));
var stopID = u(rv32("g_test_run_id_at_stop"));
var tzID   = u(rv32("g_test_run_id_at_tz_isr"));
var stale  = u(rv("g_adc_pwm_sync_stale_abort"));
var flt    = u(rv("g_fault_flags"));
var fpwm   = u(rv("g_pwm_enabled"));
var fost   = u(reg("EPwm1Regs.TZFLG.bit.OST"));
var vmax   = u(rv("g_probe_vout_max"));
var actDelta = u(rv32("g_tz_active_window_trip_count")) - c_pre_act;
var pass = (res===1 && stp===1 && comp===CYCLES && pf_ost===0 && pf_hw===0 &&
            actDelta===0 && flt===0 && armID===expArm && stopID===expArm &&
            (CYCLES===15 ? tzID===0 : true) && fpwm===0 && fost===1 && stale===0);
if (CYCLES===15 && vmax>=1491) pass=false;
print("PASS_GATE res="+res+" stop="+stp+" completed="+comp+"/"+CYCLES
      +" pre_ost="+pf_ost+" pre_hw_trip="+pf_hw+" actDelta="+actDelta+" fault="+flt
      +" armID=0x"+armID.toString(16)+" stopID=0x"+stopID.toString(16)+" tzID=0x"+tzID.toString(16)
      +" pwm="+fpwm+" ost="+fost+" stale="+stale+" vout_max="+vmax);
if (pass && CYCLES===1)  print("*** PASS_COMPLETED_1CYCLE -> 允许进入 3-cycle ***");
if (pass && CYCLES===3)  print("*** PASS_COMPLETED_3CYCLE -> 允许进入 15-cycle ***");
if (pass && CYCLES===15) print("*** REAL_POWER_200KHZ_DB140_15_CYCLE_REQUALIFIED ***");
if (!pass) print("*** HARD GATE FAILED -> REQUALIFY_STOPPED_AT_"+CYCLES+"_CYCLE (保留黑匣子, 不清 fault / 不 retry) ***");
session.target.disconnect();
print("DONE");
