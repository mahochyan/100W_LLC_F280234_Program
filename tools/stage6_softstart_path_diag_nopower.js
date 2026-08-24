// NO-POWER SoftStart path diagnostic: AQCSFRC force-low clamps PWM outputs
// (same secondary clamp as the F no-power timing harness), so the formal
// SoftStart request can run to completion without delivering power. Dumps the
// full SoftStart state to locate the REJECTED(7) writer.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_FLASH_SHOT_REAL\\LLC_100W_F28034_BRINGUP_DSH.out";
var MANIFEST="D:\\CCS21_workspace\\Codex_Project\\evidence\\stage6_first_real_pi_shot_real\\REAL_SHA256SUMS.txt";
var env=ScriptingEnvironment.instance(); var server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();
function addr(n){return session.expression.evaluate("&"+n);}
function rw(n){try{return session.memory.readWord(1,addr(n));}catch(e){return -1;}}
function rv32(n){try{var a=addr(n);return(session.memory.readWord(1,a)|(session.memory.readWord(1,a+1)<<16))>>>0;}catch(e){return -1;}}
function wv(n,v){session.memory.writeWord(1,addr(n),v);}
function reg(e){try{return ""+session.expression.evaluate(e);}catch(err){return "<f>";}}
function run(ms){session.target.runAsynch();java.lang.Thread.sleep(ms);session.target.halt();}

// host SHA gate (same as G harness)
function sha256File(path){
  var md=MessageDigest.getInstance("SHA-256");
  var fis=new FileInputStream(path);
  var buf=java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE,8192);
  var n;
  while((n=fis.read(buf))>0){ md.update(buf,0,n); }
  fis.close();
  var d=md.digest();
  var sb=new StringBuilder();
  for(var i=0;i<d.length;i++){
    var hex=(d[i]&0xFF).toString(16);
    if(hex.length<2){ hex="0"+hex; }
    sb.append(hex.toUpperCase());
  }
  return sb.toString();
}
var hostSha=sha256File(OUT);
var manSha="";
var br=new java.io.BufferedReader(new java.io.FileReader(MANIFEST));
var t; while((t=br.readLine())!=null){ if(t.indexOf("SPLIT_PIPELINE_OUT_SHA256")===0){ manSha=t.split("=")[1].trim(); } }
br.close();
print("host="+hostSha+" manifest="+manSha);
if(!hostSha.equals(manSha)){ print("SHA_GATE_FAIL"); throw "sha"; }
print("SHA_GATE_PASS");

try{session.target.connect();}catch(e){}
session.memory.loadProgram(OUT);
run(300);
print("init sys="+rw("g_system_state")+" pwm="+rw("g_pwm_enabled")+" fault="+rv32("g_fault_flags")+" ost="+reg("EPwm1Regs.TZFLG.bit.OST"));
print("init softstart_result="+rw("g_softstart_result")+" pfm="+rw("g_pfm_direction_test_mode")+" request="+rw("g_softstart_request")+" ramp="+rw("g_softstart_ramp_active"));

// confirm stages 1..6 (same as G)
for(var s=1;s<=6;s++){ wv("g_stage_confirm_request",s); run(60); }
print("stage="+rw("g_bringup_stage"));

// arm + clamp + enable
session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFA = 1");
session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFB = 1");
print("AQCSFRC="+reg("EPwm1Regs.AQCSFRC.all"));
wv("g_first_real_pi_shot_arm",1);
// ---- experiment A: direct request (bypass enable path) ----
wv("g_softstart_request",1);
print("A: sys before="+rw("g_system_state")+" req="+rw("g_softstart_request"));
for(var k=0;k<2;k++){
  run(5);
  print("A tick"+k+" sys="+rw("g_system_state")+" res="+rw("g_softstart_result")+" st="+rw("g_softstart_state")+" req="+rw("g_softstart_request")+" ramp="+rw("g_softstart_ramp_active")+" prep="+rw("g_pwm_start_prepared")+" fault="+rv32("g_fault_flags")+" tzint="+reg("EPwm1Regs.TZFLG.bit.INT"));
}
// ---- experiment B: formal enable path ----
wv("g_pwm_enable_request",1);
for(var k=0;k<8;k++){
  run(5);
  print("tick"+k+" sys="+rw("g_system_state")+" res="+rw("g_softstart_result")+" st="+rw("g_softstart_state")+" req="+rw("g_softstart_request")+" ramp="+rw("g_softstart_ramp_active")+" prep="+rw("g_pwm_start_prepared")+" fault="+rv32("g_fault_flags")+" tzint="+reg("EPwm1Regs.TZFLG.bit.INT"));
}
print("=== post-run full dump ===");
print("sys="+rw("g_system_state")+" pwm="+rw("g_pwm_enabled")+" fault="+rv32("g_fault_flags")+" ost="+reg("EPwm1Regs.TZFLG.bit.OST")+" int="+reg("EPwm1Regs.TZFLG.bit.INT"));
print("ss_result="+rw("g_softstart_result")+" ss_state="+rw("g_softstart_state")+" ss_request="+rw("g_softstart_request")+" ss_ramp="+rw("g_softstart_ramp_active"));
print("ss_abort_reason="+rw("g_softstart_abort_reason")+" stop_raw="+rw("g_softstart_stop_raw")+" final_pwm="+rw("g_softstart_final_pwm")+" final_ost="+rw("g_softstart_final_ost"));
print("ss_stage="+rw("g_softstart_stage")+" idx="+rw("g_softstart_stage_index")+" cycles="+rv32("g_softstart_cycle_count")+" final_cycles="+rw("g_softstart_final_cycles"));
print("pwm_prepared="+rw("g_pwm_start_prepared")+" enable_result="+rw("g_pwm_enable_result")+" enable_req="+rw("g_pwm_enable_request")+" rising="+rv32("g_enable_rising_count"));
print("last_vout="+rw("g_softstart_last_vout_raw")+" last_max="+rw("g_softstart_last_vout_max")+" miss="+rw("g_adc_pwm_sync_consecutive_miss"));
print("pfm="+rw("g_pfm_direction_test_mode")+" ceiling="+rw("g_softstart_hard_ceiling_raw")+" accept="+rw("g_softstart_accept_target_raw"));
print("shot_state="+rw("g_first_real_pi_shot_state")+" shot_abort="+rw("g_first_real_pi_shot_abort")+" arm="+rw("g_first_real_pi_shot_arm"));
print("run_id_at_arm="+rv32("g_softstart_run_id_at_arm")+" test_run_id="+rv32("g_test_run_id")+" soca="+rv32("g_softstart_soca_count")+" eoc="+rv32("g_softstart_eoc_count"));
print("miss_cnt="+rv32("g_softstart_miss_count")+" consec="+rw("g_softstart_consecutive_miss")+" stale_abort="+rw("g_softstart_stale_abort"));
print("ss_freq="+rv32("g_softstart_frequency_hz")+" period_limit="+rv32("g_softstart_period_limit")+" step_cnt="+rv32("g_softstart_step_count")+" elapsed="+rv32("g_softstart_elapsed_ms"));
print("comp_dac="+rw("g_comp_arm_dacval")+" compdacen="+rw("g_comp_arm_compdacen")+" adc_seq="+rv32("g_adc_sample_sequence")+" filt="+rw("g_adc_vout_filtered_raw"));
print("iout_volts="+reg("g_iout_volts")+" vout_volts="+reg("g_vout_volts"));
print("TBPRD="+reg("EPwm1Regs.TBPRD")+" CMPA="+reg("EPwm1Regs.CMPA.half.CMPA")+" AQCSFRC="+reg("EPwm1Regs.AQCSFRC.all"));
print("DIAG_DONE");
