// STAGE5A PFM_DIRECTION_NO_ENERGY — 无能量 3-phase 验证
// Phase 1: TEST_150K 窗口（45 cyc ≈ 300us, TBPRD=399）
// Phase 2: TEST_170K 窗口（51 cyc ≈ 300us, TBPRD=352 计算值）
// Phase 3: 硬顶路径（ceiling 压到仿真值 → HARD_CEILING 立即停）
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

function phase(name, mode, runid, ceiling) {
  print("===== PHASE "+name+" (mode="+mode+" run_id=0x"+runid.toString(16)+" ceiling="+ceiling+") =====");
  // Full restart per phase: clean state (RAM-loaded .ebss is not zeroed by
  // loadProgram, so in-session repeats carry residue).
  session.memory.loadProgram("D:\\CCS21_workspace\\Codex_Project\\Debug\\LLC_100W_F28034_BRINGUP_DSH.out");
  session.target.runAsynch();
  java.lang.Thread.sleep(200);
  session.target.halt();
  wv("g_bringup_stage",4);
  wv("g_comp_tz_loopback_verified",1);
  wv("g_diag_frequency_override",1);
  wv("g_no_energy_test_mode",1);
  wv32("g_test_run_id",runid);
  wv("g_softstart_acceptance_mode",1);
  wv("g_softstart_no_energy",1);
  wv("g_softstart_accept_target_raw",1244);
  wv("g_softstart_hard_ceiling_raw",ceiling);
  wv("g_pfm_direction_test_mode",mode);
  wv("g_softstart_result",0);
  wv("g_softstart_request",0);
  wv("g_probe_scheduled_ost_occurred",0);
  wv("g_softstart_ramp_active",0);
  wv("g_system_state",1);   // IDLE
  print("fault_pre="+rv("g_fault_flags")+" sysstate_pre="+rv("g_system_state")+" pfm_mode_pre="+rv("g_pfm_direction_test_mode"));
  wv("g_softstart_request",1);
  session.target.runAsynch();
  var done=0;
  for (var i=0;i<300;i++){ java.lang.Thread.sleep(20);
    try{ if (parseInt(rv("g_softstart_result"))!=0){done=1;break;} }catch(e){} }
  session.target.halt();
  print("done="+done);
  print("result="+rv("g_softstart_result")+" state="+rv("g_softstart_state")+" stage="+rv("g_softstart_stage"));
  print("cycle_count="+rv32("g_softstart_cycle_count")+" final_cycles="+rv("g_softstart_final_cycles"));
  print("window_cycles="+rv("g_pfm_window_cycles")+" window_total="+rv("g_pfm_window_total"));
  print("freq_hz="+rv32("g_pfm_frequency_hz"));
  print("TBPRD="+reg("EPwm1Regs.TBPRD")+" CMPA="+reg("EPwm1Regs.CMPA.half.CMPA")+" CMPB="+reg("EPwm1Regs.CMPB")
        +" DBRED="+reg("EPwm1Regs.DBRED")+" DBFED="+reg("EPwm1Regs.DBFED"));
  print("pfm_tbprd="+rv("g_pfm_tbprd")+" pfm_cmpa="+rv("g_pfm_cmpa")+" pfm_cmpb="+rv("g_pfm_cmpb"));
  var sraw=parseInt(rv("g_pfm_start_raw")), eraw=parseInt(rv("g_pfm_end_raw")), mraw=parseInt(rv("g_pfm_max_raw"));
  print("start_raw="+sraw+" end_raw="+eraw+" max_raw="+mraw+" delta_raw="+(eraw-sraw));
  print("start_V="+vout(sraw)+" end_V="+vout(eraw)+" max_V="+vout(mraw)+"  (simulated VOUT)");
  var st=parseInt(rv32("g_pfm_start_timer2")), et=parseInt(rv32("g_pfm_end_timer2"));
  var el=st-et;   // CpuTimer2 TIM counts DOWN @60MHz
  var elus=(el/60);
  print("start_timer2="+st+" end_timer2="+et+" elapsed_ticks="+el+" elapsed_us="+elus.toFixed(1));
  print("slope_raw_per_ms="+((eraw-sraw)/(elus/1000)).toFixed(3));
  print("hard_vout_abort="+rv("g_pfm_hard_vout_abort"));
  print("fault="+rv("g_fault_flags")+" TZ="+reg("EPwm1Regs.TZFLG.all")+" pwm="+rv("g_pwm_enabled")+" ost="+reg("EPwm1Regs.TZFLG.bit.OST"));
  print("soca="+rv32("g_softstart_soca_count")+" eoc="+rv32("g_softstart_eoc_count")+" miss="+rv32("g_softstart_miss_count")
        +" consec="+rv("g_softstart_consecutive_miss")+" stale="+rv("g_softstart_stale_abort"));
  print("run_id_at_arm="+rv32("g_softstart_run_id_at_arm")+" run_id_at_stop="+rv32("g_softstart_run_id_at_stop"));
  print("final_pwm="+rv("g_softstart_final_pwm")+" final_ost="+rv("g_softstart_final_ost"));
  print("abort_reason="+rv("g_softstart_abort_reason"));
}

phase("1_TEST_150K", 1, 0x250C5A15, 1491);
phase("2_TEST_170K", 2, 0x250C5A17, 1491);
phase("3_HARD_CEILING", 1, 0x250C5A18, 1260);

session.target.disconnect();
print("DONE");
