// stage6_onchip_timing_freeze_nopower_ladder.js
// STAGE6_ONCHIP_TIMING_FREEZE_AND_CR20_LADDER_V1
// No-power timing for REAL_2MS / REAL_10MS / REAL_100MS ladder binaries.
// CNT3/CNT4 must be OPEN. No real power.
//
// Host protocol:
//   - load frozen REAL OUT
//   - set up no-power test state while halted
//   - write ONLY g_timing_request=1
//   - runAsynch, wait shot duration + safety margin, halt
//   - single read of frozen timing data
// No JTAG reads during the run. The firmware freezes the round before the
// final software OST, so the halt cannot pollute the measurement.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var label = java.lang.System.getenv("DSH_TIMING_LABEL") || "2MS";
var waitMs = parseInt(java.lang.System.getenv("DSH_TIMING_WAIT_MS") || "10", 10);
var outEnv = java.lang.System.getenv("DSH_TIMING_OUT");
var OUT = (outEnv != null && outEnv.length() > 0)
    ? outEnv
    : "D:\\100W_LLC_F280234_Program\\branch_first_real_pi_shot_v1_1\\evidence\\stage6_first_real_pi_shot_real\\LLC_100W_F28034_BRINGUP_DSH_REAL_" + label + ".out";
var expEnv = java.lang.System.getenv("DSH_TIMING_EXPECTED_SHA");
var EXPECTED = (expEnv != null && expEnv.length() > 0)
    ? expEnv
    : "";

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
print("Expected SHA       : "+EXPECTED);
if(EXPECTED.length()>0 && !actual.equals(EXPECTED)){
  print("ABORT: SHA mismatch.");
  throw "sha-mismatch";
}
print("TIMING_HOST_SHA256_HARD_GATE_PASS");

var perm=(java.lang.System.getenv("DSH_CNT34_PERMANENT_CONNECTED_CONFIRMED")||"").equals("1");
var op=(java.lang.System.getenv("DSH_OPERATOR_PRESENT_CONFIRMED")||"").equals("1");
var auth=(java.lang.System.getenv("DSH_NO_SWITCHING_TIMING_AUTHORIZED")||"").equals("1");
print("CNT34 permanent connected: "+perm+" operator present: "+op+" no-switching auth: "+auth);
if(!perm || !op || !auth){ print("ABORT: connected no-switching timing gates not all 1."); throw "no-timing-auth"; }

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
function gate(name,cond){
  print("GATE "+name+": "+(cond?"PASS":"FAIL"));
  if(!cond){ print("ABORT: gate "+name+" failed"); throw "gate-"+name; }
}

try{session.target.connect();}catch(e){}
session.memory.loadProgram(OUT);
run(300);

// ---- pre-test hard gates (READ-ONLY) ----
var fault=rv32("g_fault_flags");
var ost=reg("EPwm1Regs.TZFLG.bit.OST");
var pwm=rw("g_pwm_enabled");
print("pre-test fault="+fault+" ost="+ost+" pwm="+pwm);
gate("FAULT_ZERO", fault===0);
gate("OST_LATCHED", ost==="1");
gate("PWM_OFF", pwm===0);

// ---- force AQCSFRC low (secondary clamp) ----
session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFA = 1");
session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFB = 1");
var cfa=reg("EPwm1Regs.AQCSFRC.bit.CSFA");
var cfb=reg("EPwm1Regs.AQCSFRC.bit.CSFB");
gate("AQCSFRC_FORCE_LOW", cfa==="1" && cfb==="1");

// ---- no-power test state (same as previous REAL no-power timing) ----
wv("g_system_state",3); wv("g_pwm_enabled",1); wv("g_bringup_stage",7);
wv("g_control_reference_valid",1); wv32("g_voltage_reference",0x41200000);
wv("g_first_real_pi_shot_arm",1); wv("g_softstart_handoff_result",1);
wv("g_board_vout_cal_valid",1); wv("g_comp_tz_loopback_verified",1);
wv32("g_power_run_min_frequency_hz",145000);
wv32("g_control_adc_sequence_last",0); wv32("g_adc_sample_sequence",1);
wv("g_adc_pwm_sync_consecutive_miss",0);
wv("g_adc_vout_raw",1200); wv("g_adc_vout_filtered_raw",1200);
wv("g_control_vref_raw",1244);
wv32("g_control_frequency_hz",149900); wv32("g_control_shadow_frequency_hz",149900);
wv32("g_switching_frequency_hz",149900); wv("g_pwm_period",399);
wv("g_power_window_state",1); wv("g_no_energy_test_mode",1);   // POWER_WINDOW_ACTIVE

// ---- host writes ONLY g_timing_request=1 ----
wv("g_timing_request",1);

// ---- runAsynch, wait duration + safety margin, halt. NO reads during run. ----
print("Running no-power timing window for "+label+", waitMs="+waitMs);
session.target.runAsynch();
java.lang.Thread.sleep(waitMs);
session.target.halt();

// ---- single read of frozen data ----
var tf=rw("g_timing_frozen"); var ta=rw("g_timing_active"); var treq=rw("g_timing_request");
var epoch=rv32("g_timing_epoch"); var sc=rv32("g_timing_sample_count");
var cmax=rv32("g_timing_compute_max"); var amax=rv32("g_timing_apply_max");
var amax2=rv32("g_timing_active_isr_max"); var smax=rv32("g_timing_shutdown_max");
var tov=rv32("g_timing_overrun_count");
var oldov=rv32("g_real_isr_overrun_count");
var pv=rw("g_pipeline_pending.valid");
var st=rw("g_first_real_pi_shot_state"); var ab=rw("g_first_real_pi_shot_abort");
var okf=rw("g_first_real_pi_shot_ok");
var pwm2=rw("g_pwm_enabled"); var ost2=reg("EPwm1Regs.TZFLG.bit.OST"); var pws2=rw("g_power_window_state");
var fault2=rv32("g_fault_flags");
print("timing_frozen="+tf+" active="+ta+" request="+treq+" epoch="+epoch+" samples="+sc);
print("compute_max="+cmax+" apply_max="+amax+" active_isr_max="+amax2+" shutdown_max="+smax+" overrun="+tov);
print("old_overrun="+oldov+" pending="+pv+" state="+st+" abort="+ab+" ok="+okf);
print("pwm="+pwm2+" ost="+ost2+" pws="+pws2+" fault="+fault2);

var pass = (tf===1 && ta===0 && treq===0 && sc>0 &&
            cmax<=900 && amax<=900 && amax2<=900 && smax<1200 && tov===0 &&
            oldov===0 && pv===0 && st===3 && ab===1 && okf===1 &&
            pwm2===0 && ost2==="1" && pws2===2 && fault2===0);
print("TIMING_"+label+"_PASS="+(pass?"PASS":"FAIL"));
if(!pass){ print("TIMING_"+label+"_RESULT_FAIL"); throw "timing-fail"; }
print("TIMING_"+label+"_DONE");
