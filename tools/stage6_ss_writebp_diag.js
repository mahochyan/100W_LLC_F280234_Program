// Write-watch on g_softstart_result: catch the writer of result=7.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);
var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_FLASH_SHOT_REAL\\LLC_100W_F28034_BRINGUP_DSH.out";
var MANIFEST="D:\\CCS21_workspace\\Codex_Project\\evidence\\stage6_first_real_pi_shot_real\\REAL_SHA256SUMS.txt";
function sha256File(path){
  var md=MessageDigest.getInstance("SHA-256");
  var fis=new FileInputStream(path);
  var buf=java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE,8192);
  var n;
  while((n=fis.read(buf))>0){ md.update(buf,0,n); }
  fis.close();
  var d=md.digest();
  var sb=new StringBuilder();
  for(var i=0;i<d.length;i++){ var hex=(d[i]&0xFF).toString(16); if(hex.length<2){ hex="0"+hex; } sb.append(hex.toUpperCase()); }
  return sb.toString();
}
var hostSha=sha256File(OUT);
var manSha="";
var br=new java.io.BufferedReader(new java.io.FileReader(MANIFEST));
var t; while((t=br.readLine())!=null){ if(t.indexOf("SPLIT_PIPELINE_OUT_SHA256")===0){ manSha=t.split("=")[1].trim(); } }
br.close();
print("host="+hostSha);
if(!hostSha.equals(manSha)){ print("SHA_GATE_FAIL"); throw "sha"; }
print("SHA_GATE_PASS");
var env=ScriptingEnvironment.instance(); var server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();
function addr(n){return session.expression.evaluate("&"+n);}
function rw(n){try{return session.memory.readWord(1,addr(n));}catch(e){return -1;}}
function rv32(n){try{var a=addr(n);return(session.memory.readWord(1,a)|(session.memory.readWord(1,a+1)<<16))>>>0;}catch(e){return -1;}}
function wv(n,v){session.memory.writeWord(1,addr(n),v);}
function reg(e){try{return ""+session.expression.evaluate(e);}catch(err){return "<f>";}}
function run(ms){session.target.runAsynch();java.lang.Thread.sleep(ms);session.target.halt();}
try{session.target.connect();}catch(e){}
session.memory.loadProgram(OUT);
run(300);
for(var s=1;s<=7;s++){ wv("g_stage_confirm_request",s); run(60); }
session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFA = 1");
session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFB = 1");
wv("g_first_real_pi_shot_arm",1);
var rAddr=addr("g_softstart_result");
print("result addr=0x"+rAddr.toString(16));
wv("g_pwm_enable_request",1);
try{ session.target.runAsynch(); java.lang.Thread.sleep(2000); }catch(e){ print("run ERR "+e); }
session.target.halt();
print("post-enable: sys="+rw("g_system_state")+" res="+rw("g_softstart_result")+" st="+rw("g_softstart_state")+" ramp="+rw("g_softstart_ramp_active")+" prep="+rw("g_pwm_start_prepared")+" fault="+rv32("g_fault_flags")+" abort="+rw("g_softstart_abort_reason")+" handoff="+rw("g_softstart_handoff_result"));
function rreg(e){try{return "0x"+session.expression.evaluate(e).toString(16);}catch(err){return "<f>";}}
print("TBCTL="+rreg("EPwm1Regs.TBCTL")+" CMPCTL="+rreg("EPwm1Regs.CMPCTL")+" AQCTLA="+rreg("EPwm1Regs.AQCTLA")+" AQCTLB="+rreg("EPwm1Regs.AQCTLB"));
print("DBCTL="+rreg("EPwm1Regs.DBCTL")+" TZSEL="+rreg("EPwm1Regs.TZSEL")+" TZCTL="+rreg("EPwm1Regs.TZCTL")+" TBPRD="+rreg("EPwm1Regs.TBPRD")+" CMPA="+rreg("EPwm1Regs.CMPA")+" DB=("+rreg("EPwm1Regs.DBRED")+","+rreg("EPwm1Regs.DBFED")+")");
print("AQCSFRC="+rreg("EPwm1Regs.AQCSFRC")+" TZFLG="+rreg("EPwm1Regs.TZFLG")+" TZFRC="+rreg("EPwm1Regs.TZFRC")+" GPIO0="+rreg("GpioDataRegs.GPADAT.bit.GPIO0")+" GPIO1="+rreg("GpioDataRegs.GPADAT.bit.GPIO1"));
print("sys="+rw("g_system_state")+" res="+rw("g_softstart_result")+" st="+rw("g_softstart_state")+" req="+rw("g_softstart_request")+" ramp="+rw("g_softstart_ramp_active")+" prep="+rw("g_pwm_start_prepared")+" fault="+rv32("g_fault_flags")+" stage="+rw("g_bringup_stage"));
print("enreq="+rw("g_pwm_enable_request")+" enres="+rw("g_pwm_enable_result")+" pwmen="+rw("g_pwm_enabled")+" handoff="+rw("g_softstart_handoff_result")+" abort="+rw("g_softstart_abort_reason"));
print("stop="+rw("g_softstart_stop_raw")+" fpwm="+rw("g_softstart_final_pwm")+" fost="+rw("g_softstart_final_ost")+" runid="+rv32("g_softstart_run_id_at_arm")+" testrun="+rv32("g_test_run_id"));
print("soca="+rv32("g_softstart_soca_count")+" eoc="+rv32("g_softstart_eoc_count")+" miss="+rv32("g_softstart_miss_count")+" consec="+rw("g_softstart_consecutive_miss")+" stale="+rw("g_softstart_stale_abort"));
print("freq="+rv32("g_softstart_frequency_hz")+" plim="+rv32("g_softstart_period_limit")+" steps="+rv32("g_softstart_step_count")+" elap="+rv32("g_softstart_elapsed_ms"));
print("ceil="+rw("g_softstart_hard_ceiling_raw")+" accept="+rw("g_softstart_accept_target_raw")+" comp_dac="+rw("g_comp_arm_dacval")+" compden="+rw("g_comp_arm_compdacen"));
print("adcseq="+rv32("g_adc_sample_sequence")+" filt="+rw("g_adc_vout_filtered_raw")+" comp_lb="+rw("g_comp_tz_loopback_verified")+" cal="+rw("g_board_vout_cal_valid"));
print("BP_DIAG_DONE");
