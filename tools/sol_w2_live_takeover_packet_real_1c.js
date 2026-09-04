// W2_BURST_LIVE_TAKEOVER_PACKET_V1 - REAL exact 1C, single fire only.
//
// One host enable edge launches the formal SoftStart trajectory. Firmware then
// performs the live takeover, commits 170 kHz, discards the transition boundary,
// counts one full period, and forces planned OST. There is no coast/cold restart,
// no host second fire, no 2C advance, and no automatic retry.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_OL_STEADY\\LLC_100W_F28034_OPEN_LOOP_STEADY.out";
var EXPECTED_SHA="E594FF48D49450A1DE4F8D76F653E396CD588F44D5226F2AA50C2A04A8063C30";

function sha256File(path){
  var md=MessageDigest.getInstance("SHA-256");
  var fis=new FileInputStream(path);
  var buf=java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE,8192);
  var n;
  while((n=fis.read(buf))>0){ md.update(buf,0,n); }
  fis.close();
  var d=md.digest(),sb=new StringBuilder();
  for(var i=0;i<d.length;i++){
    var hex=(d[i]&0xFF).toString(16);
    if(hex.length<2){ hex="0"+hex; }
    sb.append(hex.toUpperCase());
  }
  return sb.toString();
}

var env=ScriptingEnvironment.instance();
var server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();

function addr(n){ return session.expression.evaluate("&"+n); }
function rw(n){ return session.memory.readWord(1,addr(n)); }
function rv32u(n){ var a=addr(n),lo=session.memory.readWord(1,a),hi=session.memory.readWord(1,a+1); return (lo|(hi<<16))>>>0; }
function wv(n,v){ session.memory.writeWord(1,addr(n),v); }
function wv32(n,v){ var a=addr(n); session.memory.writeWord(1,a,v&0xffff); session.memory.writeWord(1,a+1,(v>>>16)&0xffff); }
function reg(e){ return parseInt(session.expression.evaluate(e)); }
function run(ms){ session.target.runAsynch(); java.lang.Thread.sleep(ms); session.target.halt(); }
function vout(raw){ return raw*0.008089325-0.063715; }
function check(name,ok){ print(name+"="+(ok?"PASS":"FAIL")); if(!ok) failures++; }

var failures=0;
print("=== SOL W2 LIVE TAKEOVER PACKET REAL 1C ===");

// The operator's current message is the controlling physical confirmation:
// Vin=24 V and the electronic load remains connected at 15 ohm. The caller
// records acceptance with SOL_W2_GATES_ACK=1.
var ack=(java.lang.System.getenv("SOL_W2_GATES_ACK")||"").equals("1");
print("GATE_USER_ACK="+ack+" (Vin24/CR15 confirmed in current task)");
if(!ack){ throw "real-gates"; }

var actual=sha256File(OUT);
print("REAL_OUT_SHA256="+actual);
print("EXPECTED_SHA256="+EXPECTED_SHA);
if(!actual.equals(EXPECTED_SHA)){
  print("ABORT: REAL SHA mismatch");
  throw "sha-mismatch";
}
print("REAL_SHA_HARD_GATE=PASS");

try{session.target.connect();}catch(e){}
try{session.target.halt();}catch(e){}
session.memory.loadProgram(OUT);
run(400);

check("INIT_SYS_IDLE",rw("g_system_state")===1);
check("INIT_PWM_OFF",rw("g_pwm_enabled")===0);
check("INIT_FAULT_ZERO",rv32u("g_fault_flags")===0);
check("INIT_OST_LATCHED",reg("EPwm1Regs.TZFLG.bit.OST")===1);
check("INIT_TZINT_ZERO",reg("EPwm1Regs.TZFLG.bit.INT")===0);
check("INIT_STAGE_ZERO",rw("g_bringup_stage")===0);
check("INIT_VOUT_CAL_VALID",rw("g_board_vout_cal_valid")===1);
if(failures){
  print("ABORT: boot gates");
  try{session.terminate();}catch(e){}
  throw "boot-gates";
}

wv("g_loopback_diag_request",1);
run(50);
check("LOOPBACK_PASS",rw("g_loopback_diag_result")===1 &&
      rw("g_comp_tz_loopback_verified")===1);
if(failures){
  print("ABORT: loopback gate");
  try{session.terminate();}catch(e){}
  throw "loopback";
}

for(var s=1;s<=5;s++){
  wv("g_stage_confirm_request",s);
  run(50);
  check("STAGE_CONFIRM_"+s,rw("g_bringup_stage")===s);
  if(failures){
    print("ABORT: stage gate "+s);
    try{session.terminate();}catch(e){}
    throw "stage-gate";
  }
}

var hwTrip0=rv32u("g_tz_hardware_trip_count");
var activeTrip0=rv32u("g_tz_active_window_trip_count");
var enableRise0=rv32u("g_enable_rising_count");
print("PRE_FIRE hw_trip="+hwTrip0+" active_trip="+activeTrip0+
      " enable_rise="+enableRise0+" raw="+rw("g_adc_vout_raw")+
      " vout="+vout(rw("g_adc_vout_raw")));

// Arm all firmware-owned actions before the one and only enable rising edge.
wv32("g_open_loop_frequency_command_hz",170000);
wv32("g_open_loop_freq_slew_hz_per_sample",500);
wv("g_open_loop_stop_on_takeover",0);
wv("g_open_loop_live_packet_cycles",1);
wv("g_open_loop_live_packet_arm",1);
wv("g_pwm_enable_request",1);

// One uninterrupted target run: no host-timed stop and no second request.
run(10);

var result=rw("g_open_loop_live_packet_result");
var state=rw("g_open_loop_live_packet_state");
var completed=rv32u("g_open_loop_live_packet_completed_cycles");
var fault=rv32u("g_fault_flags");
var stopReason=rw("g_open_loop_stop_reason");
var pwm=rw("g_pwm_enabled");
var ost=reg("EPwm1Regs.TZFLG.bit.OST");
var tzint=reg("EPwm1Regs.TZFLG.bit.INT");
var transTbprd=rw("g_open_loop_live_packet_transition_tbprd");
var transHz=rv32u("g_open_loop_live_packet_transition_hz");
var takeoverHz=rv32u("g_open_loop_takeover_freq_hz");
var takeoverRaw=rw("g_open_loop_takeover_raw");
var beforeRaw=rw("g_open_loop_live_packet_vout_before");
var afterRaw=rw("g_open_loop_live_packet_vout_after");
var peakRaw=rw("g_open_loop_live_packet_vout_peak");
var packetFault=rv32u("g_open_loop_live_packet_fault");
var finalOst=rw("g_open_loop_live_packet_final_ost");
var startT=rv32u("g_open_loop_live_packet_start_timer2");
var stopT=rv32u("g_open_loop_live_packet_stop_timer2");
var hwTrip1=rv32u("g_tz_hardware_trip_count");
var activeTrip1=rv32u("g_tz_active_window_trip_count");
var enableRise1=rv32u("g_enable_rising_count");

print("RESULT state="+state+" result="+result+" completed="+completed+
      " stop_reason="+stopReason+" sys="+rw("g_system_state"));
print("PWM="+pwm+" OST="+ost+" TZINT="+tzint+" fault=0x"+
      fault.toString(16)+" packet_fault=0x"+packetFault.toString(16));
print("TAKEOVER hz="+takeoverHz+" raw="+takeoverRaw+" v="+vout(takeoverRaw));
print("TRANSITION tbprd="+transTbprd+" actual_hz="+transHz+
      " dbred="+reg("EPwm1Regs.DBRED")+" dbfed="+reg("EPwm1Regs.DBFED"));
print("VOUT before="+beforeRaw+" ("+vout(beforeRaw)+"V) after="+afterRaw+
      " ("+vout(afterRaw)+"V) peak="+peakRaw+" ("+vout(peakRaw)+"V)");
print("TIMER2 start="+startT+" stop="+stopT+
      " hw_trip_delta="+(hwTrip1-hwTrip0)+
      " active_trip_delta="+(activeTrip1-activeTrip0)+
      " enable_rise_delta="+(enableRise1-enableRise0));

check("ONE_ENABLE_RISING_EDGE",enableRise1-enableRise0===1);
check("TAKEOVER_DONE",rw("g_open_loop_takeover_done")===1);
check("TAKEOVER_ARM_CONSUMED",rw("g_open_loop_takeover_armed")===0 &&
      rw("g_open_loop_live_packet_arm")===0);
check("TAKEOVER_FREQ_176470",Math.abs(takeoverHz-176470)<=60);
check("TAKEOVER_VOUT_SAFE",takeoverRaw>500 && takeoverRaw<1304);
check("TRANSITION_TBPRD_352",transTbprd===352);
check("TRANSITION_ACTUAL_169971",Math.abs(transHz-169971)<=1);
check("PACKET_RESULT_PASS",result===1);
check("PACKET_STATE_DONE",state===4);
check("PACKET_EXACT_1C",completed===1);
check("PACKET_STOP_REASON",stopReason===7);
check("PACKET_TIMER_NONZERO",startT!==0 && stopT!==0 && startT!==stopT);
check("PACKET_VOUT_BELOW_WARNING",beforeRaw<1304 && afterRaw<1304 && peakRaw<1304);
check("PACKET_FAULT_ZERO",fault===0 && packetFault===0);
check("NO_HARDWARE_TZ_TRIP",hwTrip1===hwTrip0 && activeTrip1===activeTrip0);
check("FINAL_PWM_OFF",pwm===0);
check("FINAL_OST_LATCHED",ost===1 && finalOst===1);
check("FINAL_TZINT_ZERO",tzint===0);
check("FINAL_SYS_IDLE",rw("g_system_state")===1);
check("FINAL_DB36",reg("EPwm1Regs.DBRED")===36 && reg("EPwm1Regs.DBFED")===36);

// Consume the falling edge after the immutable result snapshot. This cannot
// re-arm because no new rising edge is generated.
wv("g_pwm_enable_request",0);
run(20);
check("CLEANUP_PWM_OFF",rw("g_pwm_enabled")===0);
check("CLEANUP_OST_LATCHED",reg("EPwm1Regs.TZFLG.bit.OST")===1);
check("CLEANUP_TZINT_ZERO",reg("EPwm1Regs.TZFLG.bit.INT")===0);

print("SOL_W2_LIVE_TAKEOVER_PACKET_REAL_1C_PASS="+(failures===0?"TRUE":"FALSE"));
print("NO_2C_NO_RETRY=TRUE");
try{session.terminate();}catch(e){}
if(failures){ throw "live-takeover-real-1c-failures="+failures; }
