// STAGE6_TUTORIAL_LIGHTLOAD_BURST_ENTRY_RESTORE_V1 - NOENERGY burst entry test
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);
var OUT="D:\\100W_LLC_F280234_Program\\branch_first_real_pi_shot_v1_1\\evidence\\stage6_first_real_pi_shot_real\\LLC_100W_F28034_BRINGUP_DSH_NOENERGY_BURST_43AC31BA.out";
var EXPECTED="43AC31BA50422A0F3E15A0F517B029797D11D0A6A331B88298589585935BC141";
function sha256File(path){
  var md=MessageDigest.getInstance("SHA-256"); var fis=new FileInputStream(path);
  var buf=java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE,8192); var n;
  while((n=fis.read(buf))>0){ md.update(buf,0,n); } fis.close();
  var d=md.digest(); var sb=new StringBuilder();
  for(var i=0;i<d.length;i++){ var hex=(d[i]&0xFF).toString(16); if(hex.length<2)hex="0"+hex; sb.append(hex.toUpperCase()); }
  return sb.toString();
}
var actual=sha256File(OUT);
if(!actual.equals(EXPECTED)){ print("ABORT: SHA mismatch."); throw "sha"; }
var perm=(java.lang.System.getenv("DSH_CNT34_PERMANENT_CONNECTED_CONFIRMED")||"").equals("1");
var op=(java.lang.System.getenv("DSH_OPERATOR_PRESENT_CONFIRMED")||"").equals("1");
var auth=(java.lang.System.getenv("DSH_NO_SWITCHING_TIMING_AUTHORIZED")||"").equals("1");
if(!perm || !op || !auth){ print("ABORT: no-switching timing gates not all 1."); throw "noauth"; }
var voutRaw = parseInt(java.lang.System.getenv("DSH_BURST_VOUT_RAW") || "1362", 10);
var env=ScriptingEnvironment.instance(); var server=env.getServer("DebugServer.1");
server.setConfig("D:\\100W_LLC_F280234_Program\\branch_first_real_pi_shot_v1_1\\F28034.ccxml");
var session=server.openSession();
function addr(n){var v=session.expression.evaluate("&"+n);var s=""+v;if(s.indexOf("0x")===0||s.indexOf("0X")===0)return parseInt(s,16);return parseInt(s,10);}
function rw(n){try{return session.memory.readWord(1,addr(n));}catch(e){return -1;}}
function rv32(n){try{var a=addr(n);return(session.memory.readWord(1,a)|(session.memory.readWord(1,a+1)<<16))>>>0;}catch(e){return -1;}}
function wv(n,v){session.memory.writeWord(1,addr(n),v);}
function wv32(n,v){var a=addr(n);session.memory.writeWord(1,a,v&0xFFFF);session.memory.writeWord(1,a+1,(v>>>16)&0xFFFF);}
function reg(e){try{return ""+session.expression.evaluate(e);}catch(err){return "<f>";}}
function run(ms){session.target.runAsynch();java.lang.Thread.sleep(ms);session.target.halt();}
try{session.target.connect();}catch(e){}
session.memory.loadProgram(OUT);
run(300);
session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFA = 1");
session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFB = 1");
// Configure shot pipeline
wv("g_system_state",3); wv("g_pwm_enabled",0); wv("g_bringup_stage",7);
wv("g_control_reference_valid",1); wv32("g_voltage_reference",0x41200000);
wv("g_first_real_pi_shot_arm",1); wv("g_softstart_handoff_result",1);
wv("g_board_vout_cal_valid",1); wv("g_comp_tz_loopback_verified",1);
wv32("g_power_run_min_frequency_hz",150000);
wv32("g_control_adc_sequence_last",0); wv32("g_adc_sample_sequence",0);
wv("g_adc_pwm_sync_consecutive_miss",0);
wv("g_adc_vout_raw",voutRaw); wv("g_adc_vout_filtered_raw",voutRaw);
wv("g_control_vref_raw",1244);
wv32("g_control_frequency_hz",150000); wv32("g_control_shadow_frequency_hz",150000);
wv32("g_switching_frequency_hz",150000); wv("g_pwm_period",399);
wv("g_stage6_noenergy_test_enable",1);
wv("g_stage6_noenergy_test_mode",5);
wv("g_stage6_synthetic_vout_raw",voutRaw);
wv("g_stage6_multifresh_trace_count",0);
run(20);
var st=rw("g_first_real_pi_shot_state"); var ab=rw("g_first_real_pi_shot_abort"); var okf=rw("g_first_real_pi_shot_ok");
var ba=rw("g_burst_active"); var be=rv32("g_burst_enter_count");
var pw=rw("g_first_real_pi_shot_power_writes"); var pv=rw("g_pipeline_pending.valid");
var pwm=rw("g_pwm_enabled"); var ost=reg("EPwm1Regs.TZFLG.bit.OST"); var pws=rw("g_power_window_state");
var fault=rv32("g_fault_flags");
print("VOUT_RAW="+voutRaw);
print("state="+st+" abort="+ab+" ok="+okf);
print("burst_active="+ba+" burst_enter_count="+be);
print("power_writes="+pw+" pending_valid="+pv);
print("pwm="+pwm+" ost="+ost+" pws="+pws+" fault="+fault);
print("BURST_ENTRY_TEST_DONE");
