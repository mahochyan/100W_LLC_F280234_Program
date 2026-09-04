// W2_BURST_LIVE_TAKEOVER_PACKET_V1 - REAL 2C/3C/5C sequential ladder.
// Run only after the exact-SHA REAL 1C PASS. Each level has its own formal
// SoftStart -> live takeover -> exact packet -> planned OST sequence. Any
// failed gate terminates the ladder before the next level; there is no retry.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_OL_STEADY\\LLC_100W_F28034_OPEN_LOOP_STEADY.out";
var EXPECTED_SHA="E594FF48D49450A1DE4F8D76F653E396CD588F44D5226F2AA50C2A04A8063C30";

function sha256File(path){
  var md=MessageDigest.getInstance("SHA-256"),fis=new FileInputStream(path);
  var buf=java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE,8192),n;
  while((n=fis.read(buf))>0){ md.update(buf,0,n); }
  fis.close();
  var d=md.digest(),sb=new StringBuilder();
  for(var i=0;i<d.length;i++){
    var h=(d[i]&0xFF).toString(16); if(h.length<2){h="0"+h;} sb.append(h.toUpperCase());
  }
  return sb.toString();
}

var env=ScriptingEnvironment.instance(),server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();
function addr(n){return session.expression.evaluate("&"+n);}
function rw(n){return session.memory.readWord(1,addr(n));}
function rv32u(n){var a=addr(n),lo=session.memory.readWord(1,a),hi=session.memory.readWord(1,a+1);return (lo|(hi<<16))>>>0;}
function wv(n,v){session.memory.writeWord(1,addr(n),v);}
function wv32(n,v){var a=addr(n);session.memory.writeWord(1,a,v&0xffff);session.memory.writeWord(1,a+1,(v>>>16)&0xffff);}
function reg(e){return parseInt(session.expression.evaluate(e));}
function run(ms){session.target.runAsynch();java.lang.Thread.sleep(ms);session.target.halt();}
function vout(raw){return raw*0.008089325-0.063715;}
function check(name,ok){print(name+"="+(ok?"PASS":"FAIL"));if(!ok)failures++;}

var failures=0;
print("=== SOL W2 LIVE TAKEOVER PACKET REAL 2C/3C/5C ===");
var ack=(java.lang.System.getenv("SOL_W2_GATES_ACK")||"").equals("1");
var resume5=(java.lang.System.getenv("SOL_W2_RESUME_5C_AFTER_2C3C_PASS")||"").equals("1");
print("GATE_USER_ACK="+ack+" (Vin24/CR15 confirmed in current task)");
print("RESUME_5C_ONLY="+resume5);
if(!ack){throw "real-gates";}
var actual=sha256File(OUT);
print("REAL_OUT_SHA256="+actual+" EXPECTED_SHA256="+EXPECTED_SHA);
if(!actual.equals(EXPECTED_SHA)){throw "sha-mismatch";}
print("REAL_SHA_HARD_GATE=PASS");

try{session.target.connect();}catch(e){}
try{session.target.halt();}catch(e){}
session.memory.loadProgram(OUT);
run(400);
check("INIT_SAFE",rw("g_system_state")===1 && rw("g_pwm_enabled")===0 &&
      rv32u("g_fault_flags")===0 && reg("EPwm1Regs.TZFLG.bit.OST")===1 &&
      reg("EPwm1Regs.TZFLG.bit.INT")===0 && rw("g_bringup_stage")===0 &&
      rw("g_board_vout_cal_valid")===1);
if(failures){try{session.terminate();}catch(e){} throw "boot-gates";}

wv("g_loopback_diag_request",1);run(50);
check("LOOPBACK_PASS",rw("g_loopback_diag_result")===1 && rw("g_comp_tz_loopback_verified")===1);
if(failures){try{session.terminate();}catch(e){} throw "loopback";}
for(var s=1;s<=5;s++){
  wv("g_stage_confirm_request",s);run(50);
  check("STAGE_CONFIRM_"+s,rw("g_bringup_stage")===s);
  if(failures){try{session.terminate();}catch(e){} throw "stage-gate";}
}

function cleanup(){
  // CR15 remains connected; 500 ms PWM-off dwell drains residual output
  // charge before any later independent ladder level.
  wv("g_pwm_enable_request",0);run(500);
  check("CLEANUP_PWM0",rw("g_pwm_enabled")===0);
  check("CLEANUP_OST1",reg("EPwm1Regs.TZFLG.bit.OST")===1);
  check("CLEANUP_TZINT0",reg("EPwm1Regs.TZFLG.bit.INT")===0);
}

function fire(n){
  var tag=n+"C",f0=failures;
  var hw0=rv32u("g_tz_hardware_trip_count");
  var act0=rv32u("g_tz_active_window_trip_count");
  var rise0=rv32u("g_enable_rising_count");
  print("--- "+tag+" FIRE ---");
  wv32("g_open_loop_frequency_command_hz",170000);
  wv32("g_open_loop_freq_slew_hz_per_sample",500);
  wv("g_open_loop_stop_on_takeover",0);
  wv("g_open_loop_live_packet_cycles",n);
  wv("g_open_loop_live_packet_arm",1);
  wv("g_pwm_enable_request",1);
  // One uninterrupted bounded observation window. Firmware normally reaches
  // the terminal state in <10 ms; 50 ms avoids 5 ms slow-task phase aliasing.
  run(50);

  var result=rw("g_open_loop_live_packet_result");
  var state=rw("g_open_loop_live_packet_state");
  var done=rv32u("g_open_loop_live_packet_completed_cycles");
  var takeoverRaw=rw("g_open_loop_takeover_raw");
  var before=rw("g_open_loop_live_packet_vout_before");
  var after=rw("g_open_loop_live_packet_vout_after");
  var peak=rw("g_open_loop_live_packet_vout_peak");
  var fault=rv32u("g_fault_flags");
  var pfault=rv32u("g_open_loop_live_packet_fault");
  var hw1=rv32u("g_tz_hardware_trip_count");
  var act1=rv32u("g_tz_active_window_trip_count");
  var rise1=rv32u("g_enable_rising_count");
  print(tag+" state="+state+" result="+result+" completed="+done+
        " stop="+rw("g_open_loop_stop_reason")+" fault=0x"+fault.toString(16));
  print(tag+" takeover_hz="+rv32u("g_open_loop_takeover_freq_hz")+
        " takeover_raw="+takeoverRaw+" ("+vout(takeoverRaw)+"V) transition_tbprd="+
        rw("g_open_loop_live_packet_transition_tbprd")+" transition_hz="+
        rv32u("g_open_loop_live_packet_transition_hz"));
  print(tag+" vout_before="+before+" after="+after+" peak="+peak+
        " peak_v="+vout(peak)+" hw_delta="+(hw1-hw0)+
        " active_delta="+(act1-act0)+" rise_delta="+(rise1-rise0));

  check(tag+"_ONE_RISING",rise1-rise0===1);
  check(tag+"_TAKEOVER_DONE",rw("g_open_loop_takeover_done")===1);
  check(tag+"_TAKEOVER_SAFE",Math.abs(rv32u("g_open_loop_takeover_freq_hz")-176470)<=60 && takeoverRaw<1304);
  check(tag+"_TRANSITION",rw("g_open_loop_live_packet_transition_tbprd")===352 &&
        Math.abs(rv32u("g_open_loop_live_packet_transition_hz")-169971)<=1);
  check(tag+"_RESULT_PASS",result===1 && state===4);
  check(tag+"_EXACT",done===n);
  check(tag+"_STOP_REASON",rw("g_open_loop_stop_reason")===7);
  check(tag+"_VOUT_SAFE",before<1304 && after<1304 && peak<1304);
  check(tag+"_FAULT_ZERO",fault===0 && pfault===0);
  check(tag+"_NO_HW_TRIP",hw1===hw0 && act1===act0);
  check(tag+"_FINAL_SAFE",rw("g_pwm_enabled")===0 &&
        reg("EPwm1Regs.TZFLG.bit.OST")===1 && reg("EPwm1Regs.TZFLG.bit.INT")===0 &&
        rw("g_open_loop_live_packet_final_ost")===1 && rw("g_system_state")===1);
  cleanup();
  if(failures!==f0){
    print("LADDER_STOP_AT="+tag+" NO_RETRY=TRUE");
    try{session.terminate();}catch(e){}
    throw "live-packet-ladder-stop-"+tag;
  }
  print(tag+"_PASS=TRUE");
}

if(!resume5){
  fire(2);
  fire(3);
}
fire(5);
print("SOL_W2_LIVE_TAKEOVER_PACKET_REAL_2C3C5C_PASS=TRUE");
print("FINAL_PWM0_OST1_TZINT0_FAULT0="+(rw("g_pwm_enabled")===0 &&
      reg("EPwm1Regs.TZFLG.bit.OST")===1 && reg("EPwm1Regs.TZFLG.bit.INT")===0 &&
      rv32u("g_fault_flags")===0));
try{session.terminate();}catch(e){}
