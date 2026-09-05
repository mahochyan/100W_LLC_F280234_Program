// W4 CR15 <-> CR12.5 passive trace observer on-target no-energy proof.
// The NE binary keeps EPWM OST latched for the whole run.  Synthetic VOUT
// and packet-cycle deltas exercise the exact 5 ms observer compiled into the
// REAL image; they do not grant PWM authority or alter controller thresholds.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_OL_STEADY_NE\\LLC_100W_F28034_OPEN_LOOP_STEADY_NE.out";
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

var failures=0;
print("=== SOL W4 PASSIVE TRACE NOENERGY ===");
session.target.connect();try{session.target.halt();}catch(e){}
session.memory.loadProgram(OUT);run(400);

var startSeen0=rw("g_first_start_seen");
var tzclr0=rv32u("g_probe_tzclr_write_count");
function safe(tag){
  check(tag+"_PWM0",rw("g_pwm_enabled")==0);
  check(tag+"_OST1",reg("EPwm1Regs.TZFLG.bit.OST")==1);
  check(tag+"_TZINT0",reg("EPwm1Regs.TZFLG.bit.INT")==0);
  check(tag+"_FAULT0",rv32u("g_fault_flags")==0);
}
safe("PRE");
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
function beginTrace(direction,baselineCycles,baselinePackets){
  requestHold(1,60000,1,direction);
  check("ARM_CONSUMED_D"+direction,rw("g_w4_trace_arm")==0);
  check("TRACE_WAIT_D"+direction,rw("g_w4_trace_state")==1);
  wv("g_w4_trace_ne_cycle_delta",baselineCycles);
  wv("g_w4_trace_ne_packet_delta",baselinePackets);
  wv32("g_cal_hold_elapsed_ticks",24998);
  run(260);
  check("BASELINE_ARMED_D"+direction,rw("g_w4_trace_state")==3,
        "cycles="+rw("g_w4_trace_baseline_cycles_per_5ms")+
        " cpp="+rw("g_w4_trace_baseline_cycles_per_packet")+
        " demand="+rv32u("g_w4_trace_baseline_demand_index"));
  check("BASELINE_EXACT_D"+direction,
        rw("g_w4_trace_baseline_cycles_per_5ms")==baselineCycles);
  /* V10 opens detection immediately after the completed 0.7 s baseline. */
  wv32("g_cal_hold_elapsed_ticks",35000);
}
function ringExtrema(){
  var i,idx=rw("g_w4_trace_trigger_index"),base=addr("g_w4_trace_ring_raw");
  var mn=65535,mx=0;
  for(i=0;i<48;i++){
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
wv("g_w4_trace_direction_active",1);
wv32("g_cal_hold_total_packet_cycles",7500000);
wv32("g_cal_hold_elapsed_ticks",40000);wv("g_cal_hold_ne_raw",1210);run(2);
check("INVALID_DIRECTION_RETAINS_60S_CAP",rw("g_cal_hold_state")==5 &&
      rw("g_cal_hold_stop_reason")==6);
safe("INVALID_DIRECTION_CAP");

beginTrace(1,100,4);
wv("g_w4_trace_direction_active",2); /* cannot change private direction */
finishStep("HEAVIER",100,3,1185,1);
check("PUBLIC_DIRECTION_TAMPER_CANNOT_REDIRECT",
      rw("g_w4_trace_state")==5 && rw("g_w4_trace_direction_active")==2);
check("HEAVIER_PEAK_GATE",rw("g_w4_trace_min_raw")==1185 &&
      rw("g_w4_trace_peak_pass")==1);
wv32("g_cal_hold_elapsed_ticks",2999998);
run(3);
check("EARLY_STEP_STILL_COMPLETES_AT_60S",rw("g_cal_hold_state")==4 &&
      rw("g_cal_hold_stop_reason")==1 &&
      rv32u("g_cal_hold_elapsed_ticks")>=3000000);
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
safe("PACKET_TERMINAL");

beginTrace(2,100,3);
finishStep("LIGHTER",100,4,1295,1);
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
safe("INCOMPLETE");

beginTrace(2,100,3);
wv32("g_cal_hold_elapsed_ticks",3500000);
finishStep("LATE_LIGHTER",100,4,1295,1);
check("LATE_STEP_ENDS_AFTER_TRACE",rw("g_cal_hold_state")==4 &&
      rw("g_cal_hold_stop_reason")==1 &&
      rv32u("g_cal_hold_elapsed_ticks")>=3500000);
safe("LATE_STEP");

beginTrace(1,100,4);
wv("g_cal_hold_ne_raw",1300);run(3);
check("EARLY_HARD_LIMIT_ABORT",rw("g_cal_hold_state")==5 &&
      rw("g_cal_hold_stop_reason")==2 && rw("g_cal_hold_hard_limit_events")>0);
check("EARLY_ABORT_TERMINAL_SOFTWARE_SAFE",rw("g_cal_hold_packet_active")==0 &&
      rw("g_pwm_enabled")==0 && rw("g_cal_hold_final_pwm")==0);
safe("EARLY_ABORT");

check("NE_NEVER_RELEASED_PWM",rw("g_first_start_seen")==startSeen0 &&
      rv32u("g_probe_tzclr_write_count")==tzclr0);
print("SOL_W4_TRACE_NOENERGY_PASS="+(failures==0?"TRUE":"FALSE"));
try{session.terminate();}catch(e){}
if(failures){throw "w4-ne-failures="+failures;}
