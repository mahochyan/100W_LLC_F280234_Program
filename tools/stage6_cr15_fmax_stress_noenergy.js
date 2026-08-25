// stage6_cr15_fmax_stress_noenergy.js
// STAGE6_CR15_TIMING_RECOVERY_AND_CONTINUOUS_PFM_LADDER_V1 - fmax pressure no-power.
// Uses the REAL CR15_2MS binary with software PWM enabled but AQCSFRC forced low.
// Drives period=352/error<0 at fmax_saturate_count 0,1,2 (burst disabled) and 3
// (burst enabled), and measures the real-time timing window.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT = "D:\\CCS21_workspace\\Codex_Project\\Stage6_FLASH_SHOT_REAL_CR15_2MS\\LLC_100W_F28034_BRINGUP_DSH_REAL_CR15_2MS.out";
var EXPECTED_SHA = "5E2B320B906F867725A9C843A94E78B8D50CB576CA92E2841871AF081DE3EDD7";
function sha256File(path){
  var md=MessageDigest.getInstance("SHA-256"); var fis=new FileInputStream(path);
  var buf=java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE,8192); var n;
  while((n=fis.read(buf))>0){ md.update(buf,0,n); } fis.close();
  var d=md.digest(); var sb=new StringBuilder();
  for(var i=0;i<d.length;i++){ var hex=(d[i]&0xFF).toString(16); if(hex.length<2)hex="0"+hex; sb.append(hex.toUpperCase()); }
  return sb.toString();
}
var perm=(java.lang.System.getenv("DSH_CNT34_PERMANENT_CONNECTED_CONFIRMED")||"").equals("1");
var op=(java.lang.System.getenv("DSH_OPERATOR_PRESENT_CONFIRMED")||"").equals("1");
var auth=(java.lang.System.getenv("DSH_NO_SWITCHING_TIMING_AUTHORIZED")||"").equals("1");
if(!perm || !op || !auth){ print("ABORT: no-switching timing gates not all 1."); throw "noauth"; }
var actualSha=sha256File(OUT);
if(!actualSha.equals(EXPECTED_SHA)){ print("ABORT: SHA mismatch "+actualSha); throw "sha"; }
var env=ScriptingEnvironment.instance(); var server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();
function addr(n){var v=session.expression.evaluate("&"+n);var s=""+v;if(s.indexOf("0x")===0||s.indexOf("0X")===0)return parseInt(s,16);return parseInt(s,10);}
function rw(n){try{return session.memory.readWord(1,addr(n));}catch(e){return -1;}}
function rv32(n){try{var a=addr(n);return(session.memory.readWord(1,a)|(session.memory.readWord(1,a+1)<<16))>>>0;}catch(e){return -1;}}
function wv(n,v){session.memory.writeWord(1,addr(n),v);}
function wv32(n,v){var a=addr(n);session.memory.writeWord(1,a,v&0xFFFF);session.memory.writeWord(1,a+1,(v>>>16)&0xFFFF);}
function reg(e){try{return ""+session.expression.evaluate(e);}catch(err){return "<f>";}}
function rt(e){var v=session.expression.evaluate(e);var s=""+v;if(s.indexOf("0x")===0||s.indexOf("0X")===0)return parseInt(s,16);return parseInt(s,10);}
function run(ms){session.target.runAsynch();java.lang.Thread.sleep(ms);session.target.halt();}
try{session.target.connect();}catch(e){}

var cases = [
  {name:"FMAX_SAT_0", fsat:0, burstEn:0, expectBurst:false},
  {name:"FMAX_SAT_1", fsat:1, burstEn:0, expectBurst:false},
  {name:"FMAX_SAT_2", fsat:2, burstEn:0, expectBurst:false},
  {name:"FMAX_SAT_3", fsat:3, burstEn:1, expectBurst:true}
];

for(var ci=0; ci<cases.length; ci++){
  var c=cases[ci];
  print("=== FMAX_STRESS "+c.name+" ===");
  session.memory.loadProgram(OUT);
  run(100);
  session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFA = 1");
  session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFB = 1");
  wv("g_system_state",3); wv("g_pwm_enabled",1); wv("g_bringup_stage",7);
  wv("g_control_reference_valid",1); wv32("g_voltage_reference",0x41200000);
  wv("g_first_real_pi_shot_arm",1); wv("g_softstart_handoff_result",1);
  wv("g_board_vout_cal_valid",1); wv("g_comp_tz_loopback_verified",1);
  wv32("g_power_run_min_frequency_hz",150000);
  wv("g_first_real_pi_shot_state",2); wv("g_first_real_pi_shot_ok",0);
  wv32("g_first_real_pi_shot_first_write_timer2", rt("CpuTimer2Regs.TIM.all"));
  wv("g_burst_active",0); wv32("g_burst_enter_count",0);
  wv("g_burst_enabled",c.burstEn);
  wv32("g_control_fmax_saturate_count",c.fsat); wv("g_control_unclamped_period",0);
  wv("g_control_error_raw",0xFFFF);
  wv32("g_control_frequency_hz",170000); wv32("g_control_shadow_frequency_hz",170000);
  wv32("g_switching_frequency_hz",170000); wv("g_pwm_period",352);
  wv("g_pipeline_phase",1); wv("g_no_energy_test_mode",1);
  wv32("g_control_adc_sequence_last",0); wv32("g_adc_sample_sequence",1);
  wv("g_adc_pwm_sync_consecutive_miss",0);
  wv("g_adc_vout_raw",1362); wv("g_adc_vout_filtered_raw",1362);
  wv("g_control_vref_raw",1244);
  wv("g_pipeline_pending.valid",1); wv("g_pipeline_pending.period",352);
  wv32("g_pipeline_pending.command_hz",170000); wv32("g_pipeline_pending.actual_hz",170000);
  wv("g_pipeline_pending.cmpa",176); wv("g_pipeline_pending.cmpb",88);
  wv32("g_pi_integral_q12",0); wv32("g_fault_flags",0);
  wv("g_timing_request",1);
  run(10);
  var tf=rw("g_timing_frozen"); var sc=rv32("g_timing_sample_count");
  var cmax=rv32("g_timing_compute_max"); var cnorm=rv32("g_timing_compute_normal_max");
  var cfmax=rv32("g_timing_compute_fmax_max"); var cabort=rv32("g_timing_compute_abort_max");
  var amax=rv32("g_timing_apply_max"); var amax2=rv32("g_timing_active_isr_max");
  var smax=rv32("g_timing_shutdown_max"); var tov=rv32("g_timing_overrun_count");
  var fsat=rv32("g_control_fmax_saturate_count"); var burst=rv32("g_burst_enter_count");
  var st=rw("g_first_real_pi_shot_state"); var ab=rw("g_first_real_pi_shot_abort"); var okf=rw("g_first_real_pi_shot_ok");
  var pv=rw("g_pipeline_pending.valid"); var pwm=rw("g_pwm_enabled"); var ost=reg("EPwm1Regs.TZFLG.bit.OST");
  var tzint=reg("EPwm1Regs.TZFLG.bit.INT"); var pws=rw("g_power_window_state"); var fault=rv32("g_fault_flags");
  print(c.name+" timing_frozen="+tf+" samples="+sc+" compute="+cmax+" normal="+cnorm+" fmax="+cfmax+" abort="+cabort+" apply="+amax+" active="+amax2+" shutdown="+smax+" overrun="+tov);
  print(c.name+" fmax_sat="+fsat+" burst="+burst+" state="+st+" abort="+ab+" ok="+okf+" pending="+pv+" pwm="+pwm+" ost="+ost+" tzint="+tzint+" pws="+pws+" fault="+fault);
  var pass = (tf===1 && sc>0 && cmax<=900 && cnorm<=850 && cfmax<=900 && cabort<1200 &&
              amax<=900 && amax2<=900 && smax<1200 && tov===0 &&
              (c.expectBurst ? burst===1 : burst===0) &&
              pv===0 && pwm===0 && ost==="1" && tzint==="0" && pws===2 && fault===0);
  print("FMAX_STRESS_"+c.name+"_PASS="+(pass?"PASS":"FAIL"));
  if(!pass){ print("FMAX_STRESS_FAIL_"+c.name); throw "fmax-stress-fail-"+c.name; }
}
print("STAGE6_CR15_FMAX_STRESS_NOENERGY_PASS");
try{ session.terminate(); }catch(e){}
