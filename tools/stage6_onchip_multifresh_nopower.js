// STAGE6_ONCHIP_MULTIFRESH_NOENERGY
// Loads NOENERGY OUT, configures on-chip mode 5 stimulator once, runs 20ms,
// then reads the 13-point trajectory and shot summary.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);
var OUT="D:\\100W_LLC_F280234_Program\\branch_first_real_pi_shot_v1_1\\evidence\\stage6_first_real_pi_shot_real\\LLC_100W_F28034_BRINGUP_DSH_NOENERGY_CORRECTED_CAB88E4D.out";
var EXPECTED="CAB88E4D9B4FBEB7CE0683D299C253B4413BC88A87355BC437C5CA3F63DC3885";
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
print("HOST_SHA256_PASS");
var perm=(java.lang.System.getenv("DSH_CNT34_PERMANENT_CONNECTED_CONFIRMED")||"").equals("1");
var op=(java.lang.System.getenv("DSH_OPERATOR_PRESENT_CONFIRMED")||"").equals("1");
var auth=(java.lang.System.getenv("DSH_NO_SWITCHING_TIMING_AUTHORIZED")||"").equals("1");
if(!perm || !op || !auth){ print("ABORT: connected no-switching timing gates not all 1."); throw "no-timing-auth"; }
var voutRaw = parseInt(java.lang.System.getenv("DSH_MULTIFRESH_VOUT_RAW") || "1362", 10);
print("MULTIFRESH_VOUT_RAW="+voutRaw);
var env=ScriptingEnvironment.instance(); var server=env.getServer("DebugServer.1");
server.setConfig("D:\\100W_LLC_F280234_Program\\branch_first_real_pi_shot_v1_1\\F28034.ccxml");
var session=server.openSession();
function addr(n){var v=session.expression.evaluate("&"+n);var s=""+v;if(s.indexOf("0x")===0||s.indexOf("0X")===0)return parseInt(s,16);return parseInt(s,10);}
function rw(n){try{return session.memory.readWord(1,addr(n));}catch(e){return -1;}}
function r16(n){var v=rw(n);return (v>=32768)?v-65536:v;}
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
// Configure once
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
// Read results
var fc=rv32("g_shot_summary.fresh_compute_count");
var sc=rv32("g_shot_summary.stale_compute_count");
var pc=rv32("g_shot_summary.pi_compute_count");
var ac=rv32("g_shot_summary.pwm_apply_count");
var pw=rw("g_first_real_pi_shot_power_writes");
var st=rw("g_first_real_pi_shot_state"); var ab=rw("g_first_real_pi_shot_abort"); var okf=rw("g_first_real_pi_shot_ok");
var fw=rv32("g_first_real_pi_shot_first_write_timer2"); var ostt=rv32("g_first_real_pi_shot_ost_timer2");
var t2d=(fw-ostt)>>>0;
var pwm2=rw("g_pwm_enabled"); var ost2=reg("EPwm1Regs.TZFLG.bit.OST"); var pws2=rw("g_power_window_state");
var fault2=rv32("g_fault_flags");
var maxIsr=rv32("g_fast_isr_cycles_max"); var cmax=rv32("g_control_exec_cycles_max");
var amax=rv32("g_control_exec_cycles_max"); var ovf=rv32("g_fast_isr_overrun_count");
var tcount=rw("g_stage6_multifresh_trace_count");
print("state="+st+" abort="+ab+" ok="+okf+" t2d="+t2d);
print("fresh="+fc+" stale="+sc+" pi="+pc+" apply="+ac+" pw="+pw);
print("pwm="+pwm2+" ost="+ost2+" pws="+pws2+" fault="+fault2);
print("ISR max="+maxIsr+" compute="+cmax+" apply="+amax+" overrun="+ovf);
print("trace_count="+tcount);
for(var i=0;i<tcount && i<13;i++){
  var f=rv32("g_stage6_multifresh_trace_freq["+i+"]");
  print("TRACE["+i+"] freq="+f);
}
print("ONCHIP_MULTIFRESH_DONE");
