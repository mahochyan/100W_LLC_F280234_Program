// STAGE6_TUTORIAL_BURST_RESTART_PATH_ACTIVATION_FIX_V1_2 - Mode6 on-chip restart
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);
var OUT="D:\\100W_LLC_F280234_Program\\branch_first_real_pi_shot_v1_1\\evidence\\stage6_first_real_pi_shot_real\\LLC_100W_F28034_BRINGUP_DSH_NOENERGY_MODE6_3EB8A50B.out";
var EXPECTED="3EB8A50B1E2D5BB571CAED36E1E8E924781BED9B9CE38D19901110F49B140B6F";
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
// Setup
wv("g_system_state",3); wv("g_pwm_enabled",0); wv("g_bringup_stage",7);
wv("g_control_reference_valid",1); wv32("g_voltage_reference",0x41200000);
wv("g_first_real_pi_shot_arm",1); wv("g_softstart_handoff_result",1);
wv("g_board_vout_cal_valid",1); wv("g_comp_tz_loopback_verified",1);
wv32("g_power_run_min_frequency_hz",150000);
wv32("g_control_adc_sequence_last",0); wv32("g_adc_sample_sequence",0);
wv("g_adc_pwm_sync_consecutive_miss",0);
wv("g_adc_vout_raw",1362); wv("g_adc_vout_filtered_raw",1362);
wv("g_control_vref_raw",1244);
wv32("g_control_frequency_hz",150000); wv32("g_control_shadow_frequency_hz",150000);
wv32("g_switching_frequency_hz",150000); wv("g_pwm_period",399);
wv("g_stage6_noenergy_test_enable",1);
wv("g_stage6_noenergy_test_mode",6);
wv("g_stage6_synthetic_vout_raw",1362);
wv32("g_burst_test_fresh_count",0); wv32("g_burst_test_high_count",0); wv32("g_burst_test_low_count",0);
run(20);
var st=rw("g_first_real_pi_shot_state"); var ab=rw("g_first_real_pi_shot_abort"); var okf=rw("g_first_real_pi_shot_ok");
var be=rv32("g_burst_enter_count"); var bx=rv32("g_burst_exit_count");
var ra=rv32("g_burst_restart_attempt_count"); var rs=rv32("g_burst_restart_success_count"); var rf=rv32("g_burst_restart_fail_count");
var hc=rv32("g_burst_test_high_count"); var lc=rv32("g_burst_test_low_count"); var fc=rv32("g_burst_test_fresh_count");
var pv=rw("g_pipeline_pending.valid"); var pwm=rw("g_pwm_enabled"); var ost=reg("EPwm1Regs.TZFLG.bit.OST"); var pws=rw("g_power_window_state");
var fault=rv32("g_fault_flags"); var pre=rw("g_burst_restart_pre_ost"); var post=rw("g_burst_restart_post_ost");
print("state="+st+" abort="+ab+" ok="+okf);
print("enter="+be+" exit="+bx+" attempt="+ra+" success="+rs+" fail="+rf);
print("high="+hc+" low="+lc+" fresh="+fc);
print("pending="+pv+" pwm="+pwm+" ost="+ost+" pws="+pws+" fault="+fault);
print("pre_ost="+pre+" post_ost="+post);
var offFresh=rv32("g_burst_off_fresh_compute_count"); var offApply=rv32("g_burst_off_apply_count");
var firstShadow=rv32("g_burst_off_first_shadow_hz"); var lastShadow=rv32("g_burst_off_last_shadow_hz"); var minShadow=rv32("g_burst_off_min_shadow_hz");
var firstPeriod=rw("g_burst_off_first_period"); var lastPeriod=rw("g_burst_off_last_period");
print("offFresh="+offFresh+" offApply="+offApply);
print("firstShadow="+firstShadow+" lastShadow="+lastShadow+" minShadow="+minShadow);
print("firstPeriod="+firstPeriod+" lastPeriod="+lastPeriod);
var isrMax=rv32("g_fast_isr_cycles_max"); var cmax=rv32("g_control_exec_cycles_max"); var amax=rv32("g_control_exec_cycles_max"); var ovf=rv32("g_fast_isr_overrun_count");
var entryMax=rv32("g_shot_summary.entry_interval_max_shot");
var entryTimer=rv32("g_burst_entry_timer2"); var restartTimer=rv32("g_burst_restart_timer2"); var delta=rv32("g_burst_entry_to_restart_delta");
var hwDelta=rv32("g_tz_hardware_trip_count")-rv32("g_burst_entry_hw_trip_count");
var actDelta=rv32("g_tz_active_window_trip_count")-rv32("g_burst_entry_active_trip_count");
var bstate=rw("g_burst_state"); var owner=rw("g_ost_owner");
print("ISRmax="+isrMax+" cmax="+cmax+" amax="+amax+" ovf="+ovf+" entryMax="+entryMax);
print("entryTimer="+entryTimer+" restartTimer="+restartTimer+" delta="+delta);
print("hwDelta="+hwDelta+" actDelta="+actDelta+" burstState="+bstate+" ostOwner="+owner);
print("BURST_RESTART_NOENERGY_PASS="+((be===1)&&(bx===1)&&(ra===1)&&(rs===1)&&(rf===0)&&(hc>=1)&&(lc>=1)&&(pv===0)&&(pwm===0)&&(ost==="1")&&(pws===2)&&(fault===0)&&(isrMax<=900)&&(cmax<=900)&&(amax<=900)&&(ovf===0)&&(delta>0)&&(delta<30000)&&(hwDelta===0)&&(actDelta===0)));
