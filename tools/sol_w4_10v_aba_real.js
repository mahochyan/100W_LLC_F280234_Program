// W4 10 V CR15 <-> CR12.5 REAL load-step capture, one direction per run.
// Firmware owns the 60..180 s power window, terminal OST and diagnostic ESTOP.
// The host performs no memory access or active halt between firing the request
// and waitForHalt returning on that immutable on-chip terminal instruction.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_OL_STEADY\\LLC_100W_F28034_OPEN_LOOP_STEADY.out";
var EXPECTED_SHA="EA79E8714CDF39F634E7A332A9BDB94F345117D375EA1AD30A102E53D6478642";
var DIRECTION_NAME=(java.lang.System.getenv("SOL_W4_DIRECTION")||"");
var INITIAL_LOAD=(java.lang.System.getenv("SOL_W4_INITIAL_LOAD_OHMS")||"");
var INPUT_LIMIT=(java.lang.System.getenv("SOL_W4_INPUT_LIMIT_A")||"");
var ACK=(java.lang.System.getenv("SOL_W4_GATES_ACK")||"").equals("1");
var DIRECTION=0,RUN_ID=0,EXPECTED_INITIAL="",EXPECTED_TARGET="",STEP_TEXT="";
if(DIRECTION_NAME.equals("HEAVIER")){
  DIRECTION=1;RUN_ID=0x25090594;EXPECTED_INITIAL="15";EXPECTED_TARGET="12.5";
  STEP_TEXT="CR15_TO_CR12P5";
}else if(DIRECTION_NAME.equals("LIGHTER")){
  DIRECTION=2;RUN_ID=0x25090595;EXPECTED_INITIAL="12.5";EXPECTED_TARGET="15";
  STEP_TEXT="CR12P5_TO_CR15";
}else{throw "direction-must-be-HEAVIER-or-LIGHTER";}
if(!INITIAL_LOAD.equals(EXPECTED_INITIAL)){throw "initial-load-does-not-match-direction";}
if(!INPUT_LIMIT.equals("0.5")){throw "w4-input-limit-must-be-explicit-0.5A";}
if(!ACK){throw "w4-real-gates-not-acknowledged";}

function sha256File(path){
  var md=MessageDigest.getInstance("SHA-256"),fis=new FileInputStream(path);
  var buf=java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE,8192),n;
  while((n=fis.read(buf))>0){md.update(buf,0,n);}fis.close();
  var d=md.digest(),sb=new StringBuilder();
  for(var i=0;i<d.length;i++){var h=(d[i]&0xff).toString(16);if(h.length<2)h="0"+h;sb.append(h.toUpperCase());}
  return sb.toString();
}

var env=ScriptingEnvironment.instance(),server=env.getServer("DebugServer.1");
env.setScriptTimeout(-1);
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
function forceSafe(){
  try{session.target.halt();}catch(e){}
  try{wv("g_pwm_enable_request",0);}catch(e){}
  try{
    var tze=reg("EPwm1Regs.TZEINT.all");
    session.memory.writeWord(1,session.expression.evaluate("&EPwm1Regs.TZEINT.all"),tze&0xfffb);
    session.memory.writeWord(1,session.expression.evaluate("&EPwm1Regs.TZFRC.all"),4);
    session.memory.writeWord(1,session.expression.evaluate("&EPwm1Regs.TZCLR.all"),1);
    wv("g_pwm_enabled",0);wv("g_pwm_enable_result",0);
  }catch(e){print("FORCE_SAFE_EXCEPTION="+e);}
}

var failures=0,connected=false,fired=false,terminalHaltObserved=false;
print("=== SOL W4 REAL "+STEP_TEXT+" ===");
print("VIN_V=24 INITIAL_LOAD_OHMS="+INITIAL_LOAD+" TARGET_LOAD_OHMS="+
      EXPECTED_TARGET+" INPUT_CURRENT_LIMIT_A="+INPUT_LIMIT);
var actual=sha256File(OUT);
print("REAL_OUT_SHA256="+actual);print("EXPECTED_SHA256="+EXPECTED_SHA);
if(!actual.equals(EXPECTED_SHA)){throw "sha-mismatch";}
print("REAL_SHA_HARD_GATE=PASS");

try{
  try{session.target.connect();}catch(e){}connected=true;
  try{session.target.halt();}catch(e){}
  session.memory.loadProgram(OUT);run(400);
  check("INIT_SYS_IDLE",rw("g_system_state")===1);
  check("INIT_PWM_OFF",rw("g_pwm_enabled")===0);
  check("INIT_FAULT_ZERO",rv32u("g_fault_flags")===0);
  check("INIT_OST_LATCHED",reg("EPwm1Regs.TZFLG.bit.OST")===1);
  check("INIT_TZINT_ZERO",reg("EPwm1Regs.TZFLG.bit.INT")===0);
  check("INIT_VOUT_CAL_VALID",rw("g_board_vout_cal_valid")===1);
  check("INIT_CALHOLD_IDLE",rw("g_cal_hold_state")===0);
  if(failures){throw "boot-gates";}

  wv("g_loopback_diag_request",1);run(50);
  check("LOOPBACK_PASS",rw("g_loopback_diag_result")===1 &&
        rw("g_comp_tz_loopback_verified")===1);
  for(var s=1;s<=5;s++){
    wv("g_stage_confirm_request",s);run(50);
    check("STAGE_CONFIRM_"+s,rw("g_bringup_stage")===s);
    if(failures){throw "stage-gate-"+s;}
  }

  /* V10 host-chain gate: prove that target fast time tracks 200 ms of host
   * time while PWM is still safely off. The first V9 attempt saw FTDI -150
   * and only 3.4147 s of target time during a nominal 60.6 s host window. */
  var clock0=rv32u("g_fast_tick");
  run(200);
  var clock1=rv32u("g_fast_tick");
  var clockDelta=(clock1-clock0)>>>0;
  print("PREFIRE_TARGET_CLOCK_DELTA_200MS="+clockDelta);
  check("PREFIRE_TARGET_CLOCK_200MS",clockDelta>=9000 && clockDelta<=11000);
  check("PREFIRE_STILL_PWM_OFF",rw("g_pwm_enabled")===0);
  check("PREFIRE_STILL_OST_LATCHED",reg("EPwm1Regs.TZFLG.bit.OST")===1);
  check("PREFIRE_STILL_FAULT_ZERO",rv32u("g_fault_flags")===0);
  if(failures){throw "prefire-target-clock-gate";}

  var hw0=rv32u("g_tz_hardware_trip_count");
  var active0=rv32u("g_tz_active_window_trip_count");
  var rise0=rv32u("g_enable_rising_count");
  wv32("g_test_run_id",RUN_ID);
  wv("g_w4_trace_expected_direction",DIRECTION);
  wv("g_w4_trace_arm",1);
  wv("g_cal_hold_mode_request",1);
  wv("g_cal_hold_duration_ms",60000);
  wv("g_cal_hold_request",1);
  fired=true;

  session.target.runAsynch();
  java.lang.Thread.sleep(2000);
  print("W4_PHYSICAL_STEP_NOW="+STEP_TEXT);
  print("SET_ELOAD_OHMS_NOW="+EXPECTED_TARGET);
  print("TRACE_CAPTURE_CONTINUES_AUTONOMOUSLY__DO_NOT_CHANGE_VIN");
  print("WAITING_FOR_FIRMWARE_TERMINAL_HALT=TRUE");
  print("FIRMWARE_TARGET_WINDOW_TICKS=3000000_TO_9000000");
  java.lang.System.out.flush();
  /* This is a passive debugger wait, not a guessed wall-clock halt. The W4
   * firmware executes ESTOP0 only after HardStop, terminal state and final
   * telemetry are complete. Default/injected DSS timeout is forced infinite. */
  session.target.waitForHalt();
  terminalHaltObserved=true;
  print("FIRMWARE_TERMINAL_HALT_OBSERVED=TRUE");

  var state=rw("g_cal_hold_state"),reason=rw("g_cal_hold_stop_reason");
  var elapsed=rv32u("g_cal_hold_elapsed_ticks"),fault=rv32u("g_fault_flags");
  var hw1=rv32u("g_tz_hardware_trip_count");
  var active1=rv32u("g_tz_active_window_trip_count");
  var rise1=rv32u("g_enable_rising_count");
  var packets=rv32u("g_cal_hold_packet_count");
  var total=rv32u("g_cal_hold_total_packet_cycles");
  var ssn=rv32u("g_cal_hold_steady_samples");
  var sssum=rv32u("g_cal_hold_steady_sum");
  var ssavg=ssn?Math.floor(sssum/ssn):0;
  var traceState=rw("g_w4_trace_state");
  var traceFail=rw("g_w4_trace_fail_reason");
  var traceMin=rw("g_w4_trace_min_raw"),traceMax=rw("g_w4_trace_max_raw");
  var baselineDemand=rv32u("g_w4_trace_baseline_demand_index");
  var triggerDemand=rv32u("g_w4_trace_trigger_demand_index");

  print("RESULT state="+state+" reason="+reason+" elapsed_ticks="+elapsed+
        " fault=0x"+fault.toString(16));
  print("HOLD steady_min="+rw("g_cal_hold_steady_min")+
        " steady_max="+rw("g_cal_hold_steady_max")+" steady_avg="+ssavg+
        " packets="+packets+" total_cycles="+total);
  print("TRACE state="+traceState+" fail="+traceFail+
        " direction="+rw("g_w4_trace_direction_active")+
        " baseline_raw="+rw("g_w4_trace_baseline_raw")+
        " baseline_cycles_5ms="+rw("g_w4_trace_baseline_cycles_per_5ms")+
        " baseline_cpp="+rw("g_w4_trace_baseline_cycles_per_packet")+
        " baseline_demand="+baselineDemand+
        " trigger_raw="+rw("g_w4_trace_trigger_raw")+
        " trigger_cycles_20ms="+rw("g_w4_trace_trigger_cycles_20ms")+
        " trigger_packets_20ms="+rw("g_w4_trace_trigger_packets_20ms")+
        " trigger_cpp="+rw("g_w4_trace_trigger_cycles_per_packet")+
        " trigger_demand="+triggerDemand+
        " min="+traceMin+" max="+traceMax+
        " settle_ms="+rw("g_w4_trace_settle_ms")+
        " peak_pass="+rw("g_w4_trace_peak_pass")+
        " settle_pass="+rw("g_w4_trace_settle_pass")+
        " quality_pass="+rw("g_w4_trace_quality_pass"));

  var rawBase=addr("g_w4_trace_ring_raw");
  var cycBase=addr("g_w4_trace_ring_cycle_delta");
  var pktBase=addr("g_w4_trace_ring_packet_delta");
  var trigger=rw("g_w4_trace_trigger_index"),hostMin=65535,hostMax=0;
  for(var i=0;i<48;i++){
    var index=(trigger+i)&127;
    var vr=session.memory.readWord(1,rawBase+index);
    var vc=session.memory.readWord(1,cycBase+index);
    var vp=session.memory.readWord(1,pktBase+index);
    if(vr<hostMin)hostMin=vr;if(vr>hostMax)hostMax=vr;
    print("TRACE_ROW i="+i+" t_ms="+(i*5)+" raw="+vr+
          " volts="+vout(vr).toFixed(4)+" cycles="+vc+" packets="+vp);
  }

  check("W4_HOLD_COMPLETE",state===4 && reason===1);
  check("FIRMWARE_DURATION_BOUNDED",elapsed>=3000000 && elapsed<=9000000);
  check("W4_TRACE_COMPLETE",traceState===5 && traceFail===0);
  check("W4_TRACE_DIRECTION",rw("g_w4_trace_direction_active")===DIRECTION);
  check("W4_DEMAND_DIRECTION",DIRECTION===1 ?
        (triggerDemand*8>=baselineDemand*9) :
        (triggerDemand*8<=baselineDemand*7));
  check("W4_TRACE_PEAK_LE_5PCT",traceMin>=1182 && traceMax<=1306 &&
        rw("g_w4_trace_peak_pass")===1);
  check("W4_TRACE_SETTLE_LE_100MS",rw("g_w4_trace_settle_ms")<=100 &&
        rw("g_w4_trace_settle_pass")===1);
  check("W4_TRACE_QUALITY_PASS",rw("g_w4_trace_quality_pass")===1);
  check("W4_TRACE_RING_MATCH",traceMin===hostMin && traceMax===hostMax);
  check("W4_HOLD_AVERAGE_10V",ssn>0 && ssavg>=1180 && ssavg<1300);
  var capTicks=elapsed;
  if(capTicks<3000000)capTicks=3000000;
  if(capTicks>9000000)capTicks=9000000;
  var proportionalCap=Math.floor((capTicks*5)/2);
  check("W4_PACKETS_PRESENT_BOUNDED",packets>0 &&
        rw("g_cal_hold_packet_max_cycles")<=160 &&
        total<=proportionalCap+160 && total<=22500000+160);
  check("NO_HARD_LIMIT_EVENT",rw("g_cal_hold_hard_limit_events")===0);
  check("NO_FAULT",fault===0 && rw("g_system_state")===1);
  check("NO_HARDWARE_TZ_TRIP",hw1===hw0 && active1===active0);
  check("NO_PUBLIC_ENABLE_EDGE",rise1===rise0 && rw("g_pwm_enable_request")===0);
  check("RUN_ID_CHAIN",rv32u("g_cal_hold_run_id_at_arm")===RUN_ID &&
        rv32u("g_cal_hold_run_id_at_stop")===RUN_ID);
  check("FINAL_PWM_OFF",rw("g_pwm_enabled")===0 && rw("g_cal_hold_final_pwm")===0);
  check("FINAL_OST_LATCHED",reg("EPwm1Regs.TZFLG.bit.OST")===1 &&
        rw("g_cal_hold_final_ost")===1);
  check("FINAL_TZINT_ZERO",reg("EPwm1Regs.TZFLG.bit.INT")===0);
}catch(e){
  print("W4_REAL_EXCEPTION="+e);
  if(fired)failures++;
}finally{
  if(connected){
    if(!fired || terminalHaltObserved){
      forceSafe();
      try{
        check("CLEANUP_PWM_OFF",rw("g_pwm_enabled")===0);
        check("CLEANUP_OST_LATCHED",reg("EPwm1Regs.TZFLG.bit.OST")===1);
        check("CLEANUP_TZINT_ZERO",reg("EPwm1Regs.TZFLG.bit.INT")===0);
      }catch(e){print("CLEANUP_READ_EXCEPTION="+e);failures++;}
      try{session.terminate();}catch(e){}
    }else{
      /* A DebugServer error after fire is not permission to recreate V9's
       * mid-packet halt. The autonomous firmware still owns max-180 s OST. */
      print("CLEANUP_DEFERRED_UNTIL_FIRMWARE_TERMINAL=TRUE");
      print("HOST_DID_NOT_HALT_UNCONFIRMED_ACTIVE_TARGET=TRUE");
    }
  }
}

print("SOL_W4_10V_"+STEP_TEXT+"_PASS="+(failures===0?"TRUE":"FALSE"));
print("POWER_REQUEST_FIRED="+(fired?"TRUE":"FALSE"));
print("NO_RETRY_SAME_SHA_AFTER_FIRE=TRUE");
if(failures){throw "w4-real-"+STEP_TEXT+"-failures="+failures;}
