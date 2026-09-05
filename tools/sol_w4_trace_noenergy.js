// W4 CR15 <-> CR12 passive trace observer on-target no-energy proof.
// The NE binary keeps EPWM OST latched for the whole run.  Synthetic VOUT
// and packet-cycle deltas exercise the exact 5 ms observer compiled into the
// REAL image; they do not grant PWM authority or alter controller thresholds.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_OL_STEADY_NE\\LLC_100W_F28034_OPEN_LOOP_STEADY_NE.out";
var EXPECTED_SHA="A90BD9223F96D9D8168CD22EE30D7922A31C0088C9110653F578E222217EFCB8";
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
function check(name,ok,detail){print(name+"="+(ok?"TRUE":"FALSE")+(detail?(" "+detail):""));if(!ok)failures++;}
function sha256File(path){
  var md=MessageDigest.getInstance("SHA-256"),fis=new FileInputStream(path);
  var buf=java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE,8192),n;
  while((n=fis.read(buf))>0){md.update(buf,0,n);}fis.close();
  var d=md.digest(),sb=new StringBuilder();
  for(var i=0;i<d.length;i++){
    var h=(d[i]&0xff).toString(16);if(h.length<2)h="0"+h;sb.append(h.toUpperCase());
  }
  return sb.toString();
}

var failures=0;
var currentW4RunId=0;
function expectedTerminalCookie(runId,direction,state,reason){
  return (0x57440000 ^ 0x00000F0C ^ 0x00000014 ^ runId ^
          ((direction&0xffff)<<16) ^
          ((state&0xffff)<<8) ^ (reason&0xffff))>>>0;
}
function checkTerminalCookie(tag,direction,state,reason){
  check(tag+"_TERMINAL_COOKIE",
        rv32u("g_w4_trace_terminal_cookie")===
        expectedTerminalCookie(currentW4RunId,direction,state,reason),
        "cookie=0x"+rv32u("g_w4_trace_terminal_cookie").toString(16));
}
print("=== SOL W4 PASSIVE TRACE NOENERGY ===");
var actualSha=sha256File(OUT);
check("NE_SHA_HARD_GATE",actualSha.equals(EXPECTED_SHA),"actual="+actualSha);
if(failures)throw "w4-ne-sha-gate";
session.target.connect();try{session.target.halt();}catch(e){}
session.memory.loadProgram(OUT);run(400);

var startSeen0=rw("g_first_start_seen");
var tzclr0=rv32u("g_probe_tzclr_write_count");
var enableRise0=rv32u("g_enable_rising_count");
var hardwareTrip0=rv32u("g_tz_hardware_trip_count");
var activeTrip0=rv32u("g_tz_active_window_trip_count");
function safe(tag){
  check(tag+"_PWM0",rw("g_pwm_enabled")==0);
  check(tag+"_OST1",reg("EPwm1Regs.TZFLG.bit.OST")==1);
  check(tag+"_TZINT0",reg("EPwm1Regs.TZFLG.bit.INT")==0);
  check(tag+"_FAULT0",rv32u("g_fault_flags")==0);
}
safe("PRE");
check("PRE_TERMINAL_COOKIE_CLEAR",rv32u("g_w4_trace_terminal_cookie")==0);
if(failures){try{session.terminate();}catch(e){}throw "w4-ne-pre-gate";}

/* Exercise the same V10 target-clock cadence gate while PWM remains off. */
var clock0=rv32u("g_fast_tick");
run(200);
var clock1=rv32u("g_fast_tick"),clockDelta=(clock1-clock0)>>>0;
check("PREFIRE_TARGET_CLOCK_200MS",clockDelta>=9000 && clockDelta<=11000,
      "delta="+clockDelta);
safe("PREFIRE_CLOCK");
if(failures){try{session.terminate();}catch(e){}throw "w4-ne-clock-gate";}

wv("g_no_energy_test_mode",1);
wv("g_cal_hold_ne_bypass_charge",1);
wv("g_bringup_stage",5);
wv("g_active_bringup_stage",5);
wv("g_system_state",1);

function resetIdle(){
  wv32("g_fault_flags",0);wv("g_system_state",1);wv("g_pwm_enabled",0);
  wv("g_pwm_enable_result",0);wv("g_cal_hold_request",0);
  wv("g_cal_hold_state",0);wv("g_cal_hold_stop_reason",0);
  wv("g_cal_hold_packet_active",0);wv("g_cal_measure_active",0);
  wv("g_cal_hold_ne_raw",1240);
}
function requestHold(mode,duration,arm,direction){
  resetIdle();
  if(mode==0)wv("g_cal_hold_ne_raw",1400);
  wv("g_w4_trace_expected_direction",direction);
  wv("g_w4_trace_arm",arm);
  wv("g_cal_hold_mode_request",mode);
  wv("g_cal_hold_duration_ms",duration);
  wv("g_cal_hold_request",1);
  /* One uninterrupted interval lets the main-loop 5 ms task consume the
   * request despite debugger scheduling jitter; it remains below the shortest
   * 100 ms legacy duration and below W4's 500 ms baseline start. */
  run(80);
}
function beginTrace(direction,baselineCycles,baselinePackets,
                    startupCycles,startupPackets){
  if(startupCycles===undefined)startupCycles=baselineCycles;
  if(startupPackets===undefined)startupPackets=baselinePackets;
  currentW4RunId=(0x250905A0+direction)>>>0;
  wv32("g_test_run_id",currentW4RunId);
  requestHold(1,60000,1,direction);
  check("ARM_CONSUMED_D"+direction,rw("g_w4_trace_arm")==0);
  check("TRACE_WAIT_D"+direction,rw("g_w4_trace_state")==1);
  check("NEW_ARM_MARKER_CLEAR_D"+direction,
        rv32u("g_w4_trace_operator_marker_tick")==0);
  check("NEW_ARM_COOKIE_CLEAR_D"+direction,
        rv32u("g_w4_trace_terminal_cookie")==0);
  wv("g_w4_trace_ne_cycle_delta",startupCycles);
  wv("g_w4_trace_ne_packet_delta",startupPackets);
  wv32("g_cal_hold_elapsed_ticks",24998);
  run(260);
  check("STARTUP_SEED_ARMED_D"+direction,rw("g_w4_trace_state")==3,
        "cycles="+rw("g_w4_trace_baseline_cycles_per_5ms")+
        " cpp="+rw("g_w4_trace_baseline_cycles_per_packet")+
        " demand="+rv32u("g_w4_trace_baseline_demand_index"));
  check("STARTUP_SEED_EXACT_D"+direction,
        rw("g_w4_trace_baseline_cycles_per_5ms")==startupCycles);
  /* Reproduce V13's stale-startup failure mode: replace the seed with a
   * settled A demand for more than the full 52-sample sliding window while
   * the 10 s gate is closed. A large startup rise must not false-trigger. */
  wv("g_w4_trace_ne_cycle_delta",baselineCycles);
  wv("g_w4_trace_ne_packet_delta",baselinePackets);
  wv32("g_cal_hold_elapsed_ticks",400000);
  run(1000);
  check("STARTUP_TRANSIENT_IGNORED_D"+direction,
        rw("g_w4_trace_state")==3 &&
        rv32u("g_w4_trace_trigger_confirm_tick")==0);
  wv32("g_cal_hold_elapsed_ticks",500000);
  run(12);
  check("ROLLING_BASELINE_EXACT_D"+direction,
        rw("g_w4_trace_baseline_cycles_per_5ms")==baselineCycles &&
        rw("g_w4_trace_baseline_cycles_per_packet")==
          Math.floor(baselineCycles/baselinePackets),
        "cycles="+rw("g_w4_trace_baseline_cycles_per_5ms")+
         " cpp="+rw("g_w4_trace_baseline_cycles_per_packet")+
         " demand="+rv32u("g_w4_trace_baseline_demand_index"));
  var frozenRaw=rw("g_w4_trace_baseline_raw");
  var frozenCycles=rw("g_w4_trace_baseline_cycles_per_5ms");
  var frozenCpp=rw("g_w4_trace_baseline_cycles_per_packet");
  var frozenDemand=rv32u("g_w4_trace_baseline_demand_index");
  /* The 10..12 s guard interval must neither track a slow knob movement nor
   * permit a pre-marker trigger.  Use a sub-threshold perturbation so the
   * candidate ring is still representative when detection opens. */
  wv("g_w4_trace_ne_cycle_delta",baselineCycles+4);
  wv32("g_cal_hold_elapsed_ticks",550000);
  run(200);
  check("REFERENCE_FROZEN_10_TO_12S_D"+direction,
        rw("g_w4_trace_baseline_raw")==frozenRaw &&
        rw("g_w4_trace_baseline_cycles_per_5ms")==frozenCycles &&
        rw("g_w4_trace_baseline_cycles_per_packet")==frozenCpp &&
        rv32u("g_w4_trace_baseline_demand_index")==frozenDemand);
  check("DETECT_CLOSED_BEFORE_12S_D"+direction,
        rw("g_w4_trace_state")==3 &&
        rv32u("g_w4_trace_trigger_confirm_tick")==0);
  wv("g_w4_trace_ne_cycle_delta",baselineCycles);
  wv32("g_cal_hold_elapsed_ticks",599998);
  run(8);
  check("DETECT_OPENS_AT_12S_D"+direction,
        rv32u("g_cal_hold_elapsed_ticks")>=600000 &&
        rw("g_w4_trace_state")==3 &&
        rv32u("g_w4_trace_trigger_confirm_tick")==0 &&
        rv32u("g_w4_trace_operator_marker_tick")>=600000);
}
function ringExtrema(){
  var i,idx=rw("g_w4_trace_trigger_index"),base=addr("g_w4_trace_ring_raw");
  var mn=65535,mx=0;
  for(i=0;i<52;i++){
    var v=session.memory.readWord(1,base+((idx+i)&127));
    if(v<mn)mn=v;if(v>mx)mx=v;
  }
  return {mn:mn,mx:mx};
}
function finishStep(tag,stepCycles,stepPackets,transientRaw,expectQuality){
  wv("g_w4_trace_ne_cycle_delta",stepCycles);
  wv("g_w4_trace_ne_packet_delta",stepPackets);
  wv("g_cal_hold_ne_raw",transientRaw);
  run(22);
  wv("g_cal_hold_ne_raw",1240);
  run(260);
  var ex=ringExtrema();
  print(tag+" state="+rw("g_w4_trace_state")+
        " fail="+rw("g_w4_trace_fail_reason")+
        " min="+rw("g_w4_trace_min_raw")+
        " max="+rw("g_w4_trace_max_raw")+
        " settle_ms="+rw("g_w4_trace_settle_ms")+
        " trigger_cpp="+rw("g_w4_trace_trigger_cycles_per_packet")+
        " trigger_demand="+rv32u("g_w4_trace_trigger_demand_index")+
        " ring_min="+ex.mn+" ring_max="+ex.mx);
  check(tag+"_COMPLETE",rw("g_w4_trace_state")==5 &&
        rw("g_w4_trace_fail_reason")==0);
  check(tag+"_TRIGGER_AFTER_WARMUP",
        rv32u("g_w4_trace_trigger_confirm_tick")>=
          rv32u("g_w4_trace_operator_marker_tick")+3000 &&
        rv32u("g_w4_trace_operator_marker_tick")>=600000);
  check(tag+"_RING_MATCH",rw("g_w4_trace_min_raw")==ex.mn &&
        rw("g_w4_trace_max_raw")==ex.mx);
  check(tag+"_QUALITY",rw("g_w4_trace_quality_pass")==expectQuality);
  check(tag+"_SETTLE_BOUNDED",rw("g_w4_trace_settle_ms")<=100);
  safe(tag);
}

/* Public observer metadata must not authorize a longer hold. */
requestHold(0,100,1,1);
check("LEGACY_ARM_CONSUMED",rw("g_w4_trace_arm")==0);
check("LEGACY_TRACE_BAD_SESSION",rw("g_w4_trace_state")==6 &&
      rw("g_w4_trace_fail_reason")==4 && rw("g_w4_trace_direction_active")==0);
check("LEGACY_BAD_SESSION_COOKIE_CLEAR",rv32u("g_w4_trace_terminal_cookie")==0);
wv("g_w4_trace_direction_active",1); /* deliberate public telemetry tamper */
wv32("g_cal_hold_elapsed_ticks",4998);run(3);
check("LEGACY_PUBLIC_DIRECTION_CANNOT_EXTEND",rw("g_cal_hold_state")==4 &&
      rw("g_cal_hold_stop_reason")==1 &&
      rv32u("g_cal_hold_elapsed_ticks")>=5000);
safe("LEGACY_ISOLATION");

requestHold(1,10000,1,1);
check("W3_10S_TRACE_BAD_SESSION",rw("g_w4_trace_state")==6 &&
      rw("g_w4_trace_fail_reason")==4 && rw("g_w4_trace_direction_active")==0);
wv("g_w4_trace_direction_active",1); /* old V11 draft would extend this */
wv32("g_cal_hold_elapsed_ticks",499998);run(3);
check("W3_10S_PUBLIC_DIRECTION_CANNOT_EXTEND",rw("g_cal_hold_state")==4 &&
      rw("g_cal_hold_stop_reason")==1 &&
      rv32u("g_cal_hold_elapsed_ticks")>=500000);
safe("W3_10S_ISOLATION");

/* A malformed 60 s trace request also retains the original 7.5 M cap. */
requestHold(1,60000,1,9);
check("INVALID_DIRECTION_FAILS_CLOSED",rw("g_w4_trace_state")==6 &&
      rw("g_w4_trace_fail_reason")==1 && rw("g_w4_trace_direction_active")==0);
check("INVALID_DIRECTION_COOKIE_CLEAR",rv32u("g_w4_trace_terminal_cookie")==0);
wv("g_w4_trace_direction_active",1);
wv32("g_cal_hold_total_packet_cycles",7500000);
wv32("g_cal_hold_elapsed_ticks",40000);wv("g_cal_hold_ne_raw",1210);run(2);
check("INVALID_DIRECTION_RETAINS_60S_CAP",rw("g_cal_hold_state")==5 &&
      rw("g_cal_hold_stop_reason")==6);
safe("INVALID_DIRECTION_CAP");

beginTrace(1,300,3,80,1);
wv("g_w4_trace_direction_active",2); /* cannot change private direction */
finishStep("HEAVIER",300,2,1185,1);
check("PUBLIC_DIRECTION_TAMPER_CANNOT_REDIRECT",
      rw("g_w4_trace_state")==5 && rw("g_w4_trace_direction_active")==2);
check("HEAVIER_PEAK_GATE",rw("g_w4_trace_min_raw")==1185 &&
      rw("g_w4_trace_peak_pass")==1);
wv32("g_cal_hold_elapsed_ticks",2999998);
run(3);
check("EARLY_STEP_STILL_COMPLETES_AT_60S",rw("g_cal_hold_state")==4 &&
      rw("g_cal_hold_stop_reason")==1 &&
      rv32u("g_cal_hold_elapsed_ticks")>=3000000);
checkTerminalCookie("EARLY_STEP",1,4,1);
safe("EARLY_STEP_MIN60S");

/* PACKET terminal uses StopPacket -> End and freezes truthful PWM0. */
beginTrace(1,100,4);
finishStep("PACKET_TERMINAL_PREP",100,3,1185,1);
wv32("g_cal_hold_elapsed_ticks",2999998);
wv("g_cal_hold_state",3);wv("g_cal_hold_packet_active",0);
wv("g_cal_hold_packet_cycles",37);wv("g_pwm_enabled",1);
run(3);
check("PACKET_TERMINAL_COMPLETE",rw("g_cal_hold_state")==4 &&
      rw("g_cal_hold_stop_reason")==1);
check("PACKET_TERMINAL_SOFTWARE_SAFE",rw("g_cal_hold_packet_active")==0 &&
      rw("g_pwm_enabled")==0 && rw("g_cal_hold_final_pwm")==0);
checkTerminalCookie("PACKET_TERMINAL",1,4,1);
safe("PACKET_TERMINAL");

beginTrace(2,300,2,80,1);
finishStep("LIGHTER",300,3,1295,1);
check("LIGHTER_PEAK_GATE",rw("g_w4_trace_max_raw")==1295 &&
      rw("g_w4_trace_peak_pass")==1);

beginTrace(1,100,4);
finishStep("BAD_PEAK",100,3,1170,0);
check("BAD_PEAK_REJECTED",rw("g_w4_trace_peak_pass")==0);

beginTrace(1,100,4);
wv32("g_cal_hold_elapsed_ticks",2999998);
run(3);
check("NO_STEP_EXTENDS_PAST_60S",rw("g_cal_hold_state")==2 &&
      rw("g_w4_trace_state")==3);
wv32("g_cal_hold_elapsed_ticks",8999998);
run(3);
check("INCOMPLETE_WINDOW_FAILS_AT_180S",rw("g_cal_hold_state")==4 &&
      rw("g_w4_trace_state")==6 && rw("g_w4_trace_fail_reason")==3);
checkTerminalCookie("INCOMPLETE_WINDOW",1,4,1);
safe("INCOMPLETE");

beginTrace(2,100,3);
wv32("g_cal_hold_elapsed_ticks",3500000);
finishStep("LATE_LIGHTER",100,4,1295,1);
check("LATE_STEP_ENDS_AFTER_TRACE",rw("g_cal_hold_state")==4 &&
      rw("g_cal_hold_stop_reason")==1 &&
      rv32u("g_cal_hold_elapsed_ticks")>=3500000);
checkTerminalCookie("LATE_STEP",2,4,1);
safe("LATE_STEP");

beginTrace(1,100,4);
wv("g_cal_hold_ne_raw",1300);run(3);
check("EARLY_HARD_LIMIT_ABORT",rw("g_cal_hold_state")==5 &&
      rw("g_cal_hold_stop_reason")==2 && rw("g_cal_hold_hard_limit_events")>0);
check("EARLY_ABORT_TERMINAL_SOFTWARE_SAFE",rw("g_cal_hold_packet_active")==0 &&
      rw("g_pwm_enabled")==0 && rw("g_cal_hold_final_pwm")==0);
checkTerminalCookie("EARLY_ABORT",1,5,2);
safe("EARLY_ABORT");

check("NE_NEVER_RELEASED_PWM",rw("g_first_start_seen")==startSeen0 &&
      rv32u("g_probe_tzclr_write_count")==tzclr0 &&
      rv32u("g_enable_rising_count")==enableRise0 &&
      rv32u("g_tz_hardware_trip_count")==hardwareTrip0 &&
      rv32u("g_tz_active_window_trip_count")==activeTrip0);
print("SOL_W4_TRACE_NOENERGY_PASS="+(failures==0?"TRUE":"FALSE"));
try{session.terminate();}catch(e){}
if(failures){throw "w4-ne-failures="+failures;}
