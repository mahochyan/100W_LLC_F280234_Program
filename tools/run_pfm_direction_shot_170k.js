// STAGE5A PFM_DIRECTION 实板单发射击（150k / 170k 共用，顶部常量区分）
// 前置：Vin 24.0V / 限流 0.20A / CNT3-CNT4 连接 / VOUT 已放电 / 冷启动（本枪为上电后第一组 power pulse）
// 流程：正式 SoftStart → VOUT≥1244 → 固定频率窗口(~300us) → 记录 → scheduled OST
var TEST_MODE = 2;              // 1 = TEST_150K, 2 = TEST_170K
var RUN_ID    = 0x250C5A17;     // 150k; 170k = 0x250C5A17
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
// 从 board_calibration.h 解析标定系数
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
session.target.connect();
try{session.target.halt();}catch(e){}
session.memory.loadProgram("D:\\CCS21_workspace\\Codex_Project\\Debug\\LLC_100W_F28034_BRINGUP_DSH.out");
session.target.runAsynch();
java.lang.Thread.sleep(200);
session.target.halt();
wv("g_bringup_stage",4);
wv("g_comp_tz_loopback_verified",1);
wv("g_diag_frequency_override",1);
wv32("g_test_run_id",RUN_ID);
wv("g_softstart_acceptance_mode",1);
wv("g_softstart_no_energy",0);
wv("g_no_energy_test_mode",0);
wv("g_softstart_accept_target_raw",1244);
wv("g_softstart_hard_ceiling_raw",1491);
wv("g_pfm_direction_test_mode",TEST_MODE);
wv("g_softstart_result",0);
wv("g_softstart_request",0);
wv("g_probe_scheduled_ost_occurred",0);
print("--- PRE-STATE VERIFY (STAGE5A_500MA C: fault=0,pwm=0,ost=1,DAC300,COMP,TZ1,VOUT<=50) ---");
var pre_fault = parseInt(rv("g_fault_flags"));
var pre_pwm   = parseInt(rv("g_pwm_enabled"));
var pre_ost   = parseInt(reg("EPwm1Regs.TZFLG.bit.OST"));
var pre_dac   = parseInt(reg("Comp1Regs.DACVAL.bit.DACVAL"));
var pre_comp  = parseInt(reg("Comp1Regs.COMPCTL.bit.COMPDACEN"));
var pre_tz1   = parseInt(reg("EPwm1Regs.TZSEL.bit.OSHT1"));
var pre_tza   = parseInt(reg("EPwm1Regs.TZCTL.bit.TZA"));
var pre_tzb   = parseInt(reg("EPwm1Regs.TZCTL.bit.TZB"));
// 真实 VOUT 用软件 force 一次读 ADCRESULT0（g_adc_vout_raw 在无 SOCA 时是陈旧值）
session.expression.evaluate("AdcRegs.ADCINTFLGCLR.bit.ADCINT1 = 1");
session.expression.evaluate("AdcRegs.ADCSOCFRC1.all = 1");
session.target.runAsynch();
java.lang.Thread.sleep(2000);
session.target.halt();
var pre_vout  = parseInt(reg("AdcResult.ADCRESULT0"));
var pre_vout_sw = parseInt(rv("g_adc_vout_raw"));
print("test_mode="+TEST_MODE+" run_id=0x"+RUN_ID.toString(16));
print("fault="+pre_fault+" pwm="+pre_pwm+" ost="+pre_ost
      +" sysstate="+rv("g_system_state")+" TZ="+reg("EPwm1Regs.TZFLG.all"));
print("DACVAL="+pre_dac+" COMPDACEN="+pre_comp+" TZ1_OSHT1="+pre_tz1
      +" TZCTL_TZA="+pre_tza+" TZB="+pre_tzb+" VOUT_raw(force)="+pre_vout+" SW_raw="+pre_vout_sw);
print("COMPSTS="+reg("Comp1Regs.COMPSTS.bit.COMPSTS")+" GPIO15="+reg("GpioDataRegs.GPADAT.bit.GPIO15"));
// BOARD_VOUT_CAL_VALID=1 由固件 request 校准门保证（test_static 已静态确认宏=1）
// DACVAL=300 / COMPDACEN=1 由固件 request->StartPwmFormal 武装流程写入
// （静态检查已确认），触发前必然为 0——故 PRE 硬门不含它们，枪后 dump 验证。
if (pre_fault != 0 || pre_pwm != 0 || pre_ost != 1 ||
    pre_tz1 != 1 || pre_tza != 2 || pre_tzb != 2 || pre_vout > 50) {
    print("*** PRE-STATE VIOLATION — REAL_SHOT_REJECTED, DO NOT FIRE ***");
    session.target.disconnect();
    print("DONE");
    quit();
}
print("PRE-STATE OK — single PFM direction shot armed");
print("--- TRIGGER FORMAL SOFTSTART + PFM WINDOW (REAL POWER) ---");
wv("g_softstart_request",1);
session.target.runAsynch();
var done = 0;
for (var i = 0; i < 500; i++) {   // up to 10s
    java.lang.Thread.sleep(20);
    try {
        var r = parseInt(rv("g_softstart_result"));
        if (r != 0) { done = 1; break; }
    } catch (e) {}
}
session.target.halt();
print("done="+done);
print("result = " + rv("g_softstart_result"));
print("state = " + rv("g_softstart_state"));
print("stage = " + rv("g_softstart_stage"));
print("test_mode_rec = " + rv("g_pfm_direction_test_mode"));
print("freq_hz = " + rv32("g_pfm_frequency_hz"));
print("TBPRD = " + reg("EPwm1Regs.TBPRD"));
print("CMPA = " + reg("EPwm1Regs.CMPA.half.CMPA"));
print("CMPB = " + reg("EPwm1Regs.CMPB"));
print("DBRED = " + reg("EPwm1Regs.DBRED"));
print("DBFED = " + reg("EPwm1Regs.DBFED"));
print("pfm_tbprd = " + rv("g_pfm_tbprd"));
print("pfm_cmpa = " + rv("g_pfm_cmpa"));
print("pfm_cmpb = " + rv("g_pfm_cmpb"));
var sraw=parseInt(rv("g_pfm_start_raw")), eraw=parseInt(rv("g_pfm_end_raw")), mraw=parseInt(rv("g_pfm_max_raw"));
print("start_raw = " + sraw);
print("end_raw = " + eraw);
print("max_raw = " + mraw);
print("delta_raw = " + (eraw-sraw));
print("start_V = " + vout(sraw));
print("end_V = " + vout(eraw));
print("max_V = " + vout(mraw));
var st=parseInt(rv32("g_pfm_start_timer2")), et=parseInt(rv32("g_pfm_end_timer2"));
var el = st - et;   // CpuTimer2 TIM counts DOWN @60MHz
print("start_timer2 = " + st + " end_timer2 = " + et);
print("elapsed_ticks = " + el);
print("elapsed_us = " + (el/60).toFixed(1));
print("slope_raw_per_ms = " + ((eraw-sraw)/(el/60000)).toFixed(3));
print("window_cycles = " + rv("g_pfm_window_cycles"));
print("window_total = " + rv("g_pfm_window_total"));
print("hard_vout_abort = " + rv("g_pfm_hard_vout_abort"));
print("theoretical_window_us = " + (parseInt(rv("g_pfm_window_total"))*(parseInt(reg("EPwm1Regs.TBPRD"))+1)/60).toFixed(2));
print("cycle_count = " + rv32("g_softstart_cycle_count"));
print("final_cycles = " + rv("g_softstart_final_cycles"));
print("last_vout = " + rv("g_softstart_last_vout_raw"));
print("vout_max = " + rv("g_softstart_last_vout_max"));
print("soca = " + rv32("g_softstart_soca_count"));
print("eoc = " + rv32("g_softstart_eoc_count"));
print("miss = " + rv32("g_softstart_miss_count"));
print("consecutive = " + rv("g_softstart_consecutive_miss"));
print("stale = " + rv("g_softstart_stale_abort"));
print("ipri_raw_before = " + rv("g_ipri_raw_before"));
print("ipri_raw_max = " + rv("g_ipri_raw_max"));
print("ipri_raw_at_stop = " + rv("g_ipri_raw_at_stop"));
print("COMPSTS = " + reg("Comp1Regs.COMPSTS.bit.COMPSTS"));
print("GPIO15 = " + reg("GpioDataRegs.GPADAT.bit.GPIO15"));
print("TZFLG = " + reg("EPwm1Regs.TZFLG.all"));
print("comp_arm_dacval(ram) = " + rv("g_comp_arm_dacval"));
print("comp_arm_compdacen(ram) = " + rv("g_comp_arm_compdacen"));
print("comp_arm_tzsel(ram) = " + rv("g_comp_arm_tzsel_osht1"));
print("DACVAL(reg, EALLOW-limited) = " + reg("Comp1Regs.DACVAL.bit.DACVAL"));
print("fault = " + rv("g_fault_flags"));
print("TZ = " + reg("EPwm1Regs.TZFLG.all"));
print("pwm = " + rv("g_pwm_enabled"));
print("ost = " + reg("EPwm1Regs.TZFLG.bit.OST"));
print("run_id_at_arm = " + rv32("g_softstart_run_id_at_arm"));
print("run_id_at_stop = " + rv32("g_softstart_run_id_at_stop"));
print("run_id_at_tz_isr = " + rv32("g_softstart_run_id_at_tz_isr"));
print("final_pwm = " + rv("g_softstart_final_pwm"));
print("final_ost = " + rv("g_softstart_final_ost"));
print("abort_reason = " + rv("g_softstart_abort_reason"));
var res = parseInt(rv("g_softstart_result"));
if (res == 8 && pre_ost == 1) print("*** PFM_DIRECTION_170K_PASS ***");
else print("*** RESULT != PFM_WINDOW_DONE — REVIEW ***");
session.target.disconnect();
print("DONE");
