// STAGE6_500US_LIGHTLOAD_NOPOWER_TIMING
// No-power timing for the 500us light-load freshness diagnostic REAL binary.
// CNT3/CNT4 must be OPEN. No real power.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT="D:\\100W_LLC_F280234_Program\\branch_first_real_pi_shot_v1_1\\evidence\\stage6_first_real_pi_shot_real\\LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT_ASYMMETRIC_3ECDBA30.out";
var EXPECTED="3ECDBA30685C636E3A28C7EAA695BD21B34CD91DE920D391AB65BE5F5AF74413";

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
var actual=sha256File(OUT);
print("REAL OUT host SHA256: "+actual);
print("Frozen 500us SHA   : "+EXPECTED);
if(!actual.equals(EXPECTED)){ print("ABORT: SHA mismatch."); throw "sha-mismatch"; }
print("TIMING_HOST_SHA256_HARD_GATE_PASS");

var open=(java.lang.System.getenv("DSH_CNT34_OPEN_CONFIRMED")||"").equals("1");
print("CNT3/CNT4 open confirmed: "+open);
if(!open){ print("ABORT: DSH_CNT34_OPEN_CONFIRMED != 1."); throw "no-open"; }

var env=ScriptingEnvironment.instance(); var server=env.getServer("DebugServer.1");
server.setConfig("D:\\100W_LLC_F280234_Program\\branch_first_real_pi_shot_v1_1\\F28034.ccxml");
var session=server.openSession();
function addr(n){
  var v=session.expression.evaluate("&"+n); var s=""+v;
  if(s.indexOf("0x")===0||s.indexOf("0X")===0) return parseInt(s,16);
  return parseInt(s,10);
}
function rw(n){try{return session.memory.readWord(1,addr(n));}catch(e){return -1;}}
function r16(n){var v=rw(n); return (v>=32768)?v-65536:v;}
function rv32(n){try{var a=addr(n);return(session.memory.readWord(1,a)|(session.memory.readWord(1,a+1)<<16))>>>0;}catch(e){return -1;}}
function wv(n,v){session.memory.writeWord(1,addr(n),v);}
function wv32(n,v){var a=addr(n);session.memory.writeWord(1,a,v&0xFFFF);session.memory.writeWord(1,a+1,(v>>>16)&0xFFFF);}
function reg(e){try{return ""+session.expression.evaluate(e);}catch(err){return "<f>";}}
function run(ms){session.target.runAsynch();java.lang.Thread.sleep(ms);session.target.halt();}
function clearReal(){
  wv32("g_real_isr_cycles_max",0); wv32("g_real_isr_cycles_sum",0);
  wv32("g_real_isr_cycles_count",0); wv32("g_real_isr_overrun_count",0);
  wv32("g_real_timer0_entry_count",0); wv32("g_real_timer0_last_entry",0);
  wv32("g_real_timer0_entry_interval_min",0xFFFFFFFF); wv32("g_real_timer0_entry_interval_max",0);
  wv32("g_real_compute_phase_cycles_max",0); wv32("g_real_apply_phase_cycles_max",0);
}
try{session.target.connect();}catch(e){}
session.memory.loadProgram(OUT);
run(300);
session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFA = 1");
session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFB = 1");
// drain
var dm=0;
for(var d=0; d<6; d++){
  clearReal();
  run(1);
  dm=rv32("g_real_isr_cycles_max");
  if(dm<=900) break;
}
print("drain_max="+dm);
// test state
wv("g_system_state",3); wv("g_pwm_enabled",1); wv("g_bringup_stage",7);
wv("g_control_reference_valid",1); wv32("g_voltage_reference",0x41200000);
wv("g_first_real_pi_shot_arm",1); wv("g_softstart_handoff_result",1);
wv("g_board_vout_cal_valid",1); wv("g_comp_tz_loopback_verified",1);
wv32("g_power_run_min_frequency_hz",150000);
wv32("g_control_adc_sequence_last",0); wv32("g_adc_sample_sequence",1);
wv("g_adc_pwm_sync_consecutive_miss",0);
wv("g_adc_vout_raw",1200); wv("g_adc_vout_filtered_raw",1200);
wv("g_control_vref_raw",1244);
wv32("g_control_frequency_hz",149900); wv32("g_control_shadow_frequency_hz",149900);
wv32("g_switching_frequency_hz",149900); wv("g_pwm_period",399);
clearReal();
run(20);
var st=rw("g_first_real_pi_shot_state"); var ab=rw("g_first_real_pi_shot_abort");
var okf=rw("g_first_real_pi_shot_ok"); var pw=rw("g_first_real_pi_shot_power_writes");
var fw=rv32("g_first_real_pi_shot_first_write_timer2"); var ostt=rv32("g_first_real_pi_shot_ost_timer2");
var t2d=(fw-ostt)>>>0;
var fc=rv32("g_shot_summary.fresh_compute_count"); var sc=rv32("g_shot_summary.stale_compute_count");
var pc=rv32("g_shot_summary.pi_compute_count"); var ac=rv32("g_shot_summary.pwm_apply_count");
var pv=rw("g_pipeline_pending.valid");
var maxIsr=rv32("g_real_isr_cycles_max"); var cmax=rv32("g_real_compute_phase_cycles_max");
var amax=rv32("g_real_apply_phase_cycles_max"); var ovf=rv32("g_real_isr_overrun_count");
var pwm2=rw("g_pwm_enabled"); var ost2=reg("EPwm1Regs.TZFLG.bit.OST"); var pws2=rw("g_power_window_state");
var fault2=rv32("g_fault_flags");
print("state="+st+" abort="+ab+" ok="+okf+" t2d="+t2d);
print("fresh="+fc+" stale="+sc+" pi="+pc+" apply="+ac+" pw="+pw+" pending="+pv);
print("pwm="+pwm2+" ost="+ost2+" pws="+pws2+" fault="+fault2);
print("ISR max="+maxIsr+" compute="+cmax+" apply="+amax+" overrun="+ovf);
print("TIMING_500US_STATE="+st);
print("TIMING_500US_ABORT="+ab);
print("TIMING_500US_OK="+okf);
print("TIMING_500US_TIMER2_DELTA="+t2d);
print("TIMING_500US_FRESH="+fc);
print("TIMING_500US_STALE="+sc);
print("TIMING_500US_PI="+pc);
print("TIMING_500US_APPLY="+ac);
print("TIMING_500US_POWER_WRITES="+pw);
print("TIMING_500US_PENDING="+pv);
print("TIMING_500US_ISR_MAX="+maxIsr);
print("TIMING_500US_OVERRUN="+ovf);
print("TIMING_500US_PASS="+((st===3&&ab===1&&okf===1&&t2d>=29500&&t2d<=32500&&pwm2===0&&ost2==="1"&&pws2===2&&fault2===0&&fc>0&&fc===pc&&ac<=fc&&pw===ac&&pv===0&&maxIsr<=900&&ovf===0)?"PASS":"FAIL"));
print("TIMING_500US_DONE");
