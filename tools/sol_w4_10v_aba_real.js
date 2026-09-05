// W4 V14 10 V CR15 <-> CR12 REAL load-step capture, one direction per run.
// Firmware owns the 60..180 s power window, terminal OST and diagnostic ESTOP.
// After an early instruction prompt the host blocks only on stdin and a silent
// monotonic-clock wait. The target's yellow LED is the exact physical marker;
// the host never continuously polls FTDI or actively halts an unconfirmed target.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_OL_STEADY\\LLC_100W_F28034_OPEN_LOOP_STEADY.out";
var EXPECTED_SHA="B4371EC608FDD0759FD3DEE52C125079CF3DE9A6CFE480BEA1181BD5DD588F2B";
var DIRECTION_NAME=(java.lang.System.getenv("SOL_W4_DIRECTION")||"");
var INITIAL_LOAD=(java.lang.System.getenv("SOL_W4_INITIAL_LOAD_OHMS")||"");
var INPUT_LIMIT=(java.lang.System.getenv("SOL_W4_INPUT_LIMIT_A")||"");
var ACK=(java.lang.System.getenv("SOL_W4_GATES_ACK")||"").equals("1");
var DIRECTION=0,RUN_ID=0,EXPECTED_INITIAL="",EXPECTED_TARGET="",STEP_TEXT="";
if(DIRECTION_NAME.equals("HEAVIER")){
  DIRECTION=1;RUN_ID=0x2509059A;EXPECTED_INITIAL="15";EXPECTED_TARGET="12";
  STEP_TEXT="CR15_TO_CR12";
}else if(DIRECTION_NAME.equals("LIGHTER")){
  DIRECTION=2;RUN_ID=0x2509059B;EXPECTED_INITIAL="12";EXPECTED_TARGET="15";
  STEP_TEXT="CR12_TO_CR15";
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
env.setScriptTimeout(30000);
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();
session.setScriptTimeout(30000);
function addr(n){return session.expression.evaluate("&"+n);}
function rw(n){return session.memory.readWord(1,addr(n));}
function rv32u(n){var a=addr(n),lo=session.memory.readWord(1,a),hi=session.memory.readWord(1,a+1);return (lo|(hi<<16))>>>0;}
function wv(n,v){session.memory.writeWord(1,addr(n),v);}
function wv32(n,v){var a=addr(n);session.memory.writeWord(1,a,v&0xffff);session.memory.writeWord(1,a+1,(v>>>16)&0xffff);}
function reg(e){return parseInt(session.expression.evaluate(e));}
function run(ms){session.target.runAsynch();java.lang.Thread.sleep(ms);session.target.halt();}
function vout(raw){return raw*0.008089325-0.063715;}
function check(name,ok){print(name+"="+(ok?"PASS":"FAIL"));if(!ok)failures++;}
function monotonicNs(){return Number(java.lang.System.nanoTime());}
var HOST_QUIET_MIN_NS=70000000000;
var HOST_QUIET_MAX_NS=205000000000;
var HOST_PROMPT_DELAY_NS=8000000000;
var TARGET_OPERATOR_MARKER_TICKS=600000;
var HOST_ACK_DEADLINE_NS=160000000000;
var POST_FIRE_STATUS_PROBES_MAX=2;
var terminalProbeCount=0;
function silentWaitUntil(deadlineNs){
  var remainingMs=Math.ceil((deadlineNs-monotonicNs())/1000000.0);
  if(remainingMs>0)java.lang.Thread.sleep(remainingMs);
}
function terminalCookie(runId,direction,state,reason){
  return (0x57440000 ^ 0x00000F0C ^ 0x00000014 ^ runId ^
          ((direction&0xffff)<<16) ^
          ((state&0xffff)<<8) ^ (reason&0xffff))>>>0;
}
var terminalProbeLinkFailed=false;
function probeTerminalHalt(tag){
  if(terminalProbeCount>=POST_FIRE_STATUS_PROBES_MAX){
    throw "post-fire-status-probe-budget-exhausted";
  }
  terminalProbeCount++;
  try{
    var halted=session.target.isHalted();
    print(tag+"_BOUNDED_IS_HALTED="+(halted?"TRUE":"FALSE"));
    return halted;
  }catch(e){
    terminalProbeLinkFailed=true;
    print(tag+"_BOUNDED_IS_HALTED_EXCEPTION="+e);
    return false;
  }
}
function forceSafe(needHalt){
  if(needHalt){try{session.target.halt();}catch(e){}}
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
var stepAcknowledged=false,promptNs=0,ackNs=0;
print("=== SOL W4 REAL "+STEP_TEXT+" ===");
print("LOAD_PROFILE_OHMS=15<->12 PROFILE_ID=0x0F0C ALGORITHM_ID=0x0014");
print("TARGET_REFERENCE_FREEZE_TICKS=500000 TARGET_YELLOW_MARKER_TICKS=600000");
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
  check("INIT_YELLOW_MARKER_OFF",reg("GpioDataRegs.GPADAT.bit.GPIO21")===0);
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
  session.setScriptTimeout(5000);
  fired=true;

  var fireNs=monotonicNs();
  session.target.runAsynch();
  /* No DSS access.  Prompt early, then let the target's own yellow LED at
   * elapsed tick 600000 define the physical marker without host/JTAG timing. */
  silentWaitUntil(fireNs+HOST_PROMPT_DELAY_NS);
  promptNs=monotonicNs();
  print("W4_WAIT_FOR_YELLOW_LED_THEN_STEP="+STEP_TEXT);
  print("WHEN_YELLOW_LED_TURNS_ON_SET_ELOAD_OHMS="+EXPECTED_TARGET);
  var ackNonce="W4_STEP_"+
      java.lang.Long.toHexString(java.lang.System.nanoTime()).toUpperCase();
  print("ACK_LINE_REQUIRED="+ackNonce);
  print("TRACE_CAPTURE_CONTINUES_AUTONOMOUSLY__DO_NOT_CHANGE_VIN");
  print("HOST_FTDI_SILENT_UNTIL_STEP_ACK_AND_TERMINAL_FLOOR=TRUE");
  print("FIRMWARE_TARGET_WINDOW_TICKS=3000000_TO_9000000");
  java.lang.System.out.flush();

  /* stdin is a host-only barrier: no DebugServer call occurs while the user
   * changes the load. Only this task sends the exact run-specific token after
   * observing the user's physical acknowledgement. */
  var reader=new BufferedReader(new InputStreamReader(java.lang.System["in"]));
  var ackInputClosed=false;
  while(!stepAcknowledged && !ackInputClosed){
    if(!reader.ready()){
      if(monotonicNs()>=fireNs+HOST_ACK_DEADLINE_NS){
        print("W4_STEP_ACK_HOST_DEADLINE_160S_EXPIRED=TRUE");
        break;
      }
      java.lang.Thread.sleep(50);
      continue;
    }
    var line=reader.readLine();
    if(line===null){
      print("W4_STEP_ACK_INPUT_CLOSED__TARGET_LEFT_AUTONOMOUS=TRUE");
      ackInputClosed=true;
      break;
    }
    line=line.trim();
    if(line.equals(ackNonce)){
      stepAcknowledged=true;
      ackNs=monotonicNs();
      print("W4_PHYSICAL_STEP_ACK_ACCEPTED=TRUE");
      print("W4_PHYSICAL_STEP_ACK_ELAPSED_MS="+
            Math.ceil((ackNs-fireNs)/1000000.0));
    }else{
      print("W4_PHYSICAL_STEP_ACK_IGNORED=TOKEN_MISMATCH");
    }
  }

  /* With a timely step the firmware ends at 60 target seconds. Wait until
   * both fire+70 s and ACK+2 s before one bounded read-only status query.
   * If it is cleanly still running, make no further JTAG access until the
   * autonomous 180 s backstop plus margin. A link exception forbids retries. */
  var firstProbeNs=stepAcknowledged ?
      Math.max(fireNs+HOST_QUIET_MIN_NS,ackNs+2000000000) :
      fireNs+HOST_QUIET_MAX_NS;
  print("HOST_SILENT_FIRST_PROBE_FLOOR_MS="+
        Math.ceil((firstProbeNs-fireNs)/1000000.0));
  java.lang.System.out.flush();
  silentWaitUntil(firstProbeNs);
  terminalHaltObserved=probeTerminalHalt("FIRST_TERMINAL_PROBE");
  if(stepAcknowledged && !terminalHaltObserved && !terminalProbeLinkFailed){
    print("TARGET_STILL_ACTIVE__SILENT_TO_205S_BACKSTOP=TRUE");
    java.lang.System.out.flush();
    silentWaitUntil(fireNs+HOST_QUIET_MAX_NS);
    terminalHaltObserved=probeTerminalHalt("FINAL_TERMINAL_PROBE");
  }
  if(terminalProbeLinkFailed){
    print("FTDI_STATUS_ERROR__NO_MORE_DSS_CALLS=TRUE");
    silentWaitUntil(fireNs+HOST_QUIET_MAX_NS);
  }
  if(!terminalHaltObserved){
    print("TERMINAL_UNCONFIRMED__HOST_WILL_NOT_HALT_OR_TOUCH_TARGET=TRUE");
    throw "firmware-terminal-unconfirmed";
  }
  print("FIRMWARE_TERMINAL_HALT_OBSERVED=TRUE");

  /* Minimal terminal capsule first. No full capture is attempted unless the
   * CPU is halted and the autonomous HardStop/freeze/cookie chain is intact. */
  var state=rw("g_cal_hold_state"),reason=rw("g_cal_hold_stop_reason");
  var elapsed=rv32u("g_cal_hold_elapsed_ticks");
  var packetActive=rw("g_cal_hold_packet_active");
  var finalPwm=rw("g_cal_hold_final_pwm"),finalOst=rw("g_cal_hold_final_ost");
  var pwmNow=rw("g_pwm_enabled");
  var runStop=rv32u("g_cal_hold_run_id_at_stop");
  var traceState=rw("g_w4_trace_state");
  var traceFail=rw("g_w4_trace_fail_reason");
  var cookie=rv32u("g_w4_trace_terminal_cookie");
  var expectedCookie=terminalCookie(RUN_ID,DIRECTION,state,reason);
  var hwOst=reg("EPwm1Regs.TZFLG.bit.OST");
  var capsuleOk=(state===4 || state===5) && packetActive===0 &&
      pwmNow===0 && finalPwm===0 && finalOst===1 && runStop===RUN_ID &&
      elapsed<=9000000 && (traceState===5 || traceState===6) &&
      hwOst===1 && cookie===expectedCookie;
  print("TERMINAL_CAPSULE state="+state+" reason="+reason+
        " elapsed_ticks="+elapsed+" packet_active="+packetActive+
        " pwm_now="+pwmNow+" final_pwm="+finalPwm+" final_ost="+finalOst+
        " run_stop=0x"+runStop.toString(16)+" trace_state="+traceState+
        " trace_fail="+traceFail+" hw_ost="+hwOst+
        " cookie=0x"+cookie.toString(16)+
        " expected_cookie=0x"+expectedCookie.toString(16));
  check("W4_TERMINAL_CAPSULE_COMMITTED",capsuleOk);
  if(!capsuleOk){throw "terminal-capsule-invalid";}

  var fault=rv32u("g_fault_flags");
  var hw1=rv32u("g_tz_hardware_trip_count");
  var active1=rv32u("g_tz_active_window_trip_count");
  var rise1=rv32u("g_enable_rising_count");
  var packets=rv32u("g_cal_hold_packet_count");
  var total=rv32u("g_cal_hold_total_packet_cycles");
  var ssn=rv32u("g_cal_hold_steady_samples");
  var sssum=rv32u("g_cal_hold_steady_sum");
  var ssavg=ssn?Math.floor(sssum/ssn):0;
  var traceMin=rw("g_w4_trace_min_raw"),traceMax=rw("g_w4_trace_max_raw");
  var baselineDemand=rv32u("g_w4_trace_baseline_demand_index");
  var triggerDemand=rv32u("g_w4_trace_trigger_demand_index");
  var triggerConfirmTick=rv32u("g_w4_trace_trigger_confirm_tick");
  var operatorMarkerTick=rv32u("g_w4_trace_operator_marker_tick");

  print("RESULT state="+state+" reason="+reason+" elapsed_ticks="+elapsed+
        " fault=0x"+fault.toString(16));
  print("TERMINAL_COOKIE=0x"+cookie.toString(16)+
        " expected=0x"+expectedCookie.toString(16));
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
        " operator_marker_tick="+operatorMarkerTick+
        " trigger_confirm_tick="+triggerConfirmTick+
        " min="+traceMin+" max="+traceMax+
        " settle_ms="+rw("g_w4_trace_settle_ms")+
        " peak_pass="+rw("g_w4_trace_peak_pass")+
        " settle_pass="+rw("g_w4_trace_settle_pass")+
        " quality_pass="+rw("g_w4_trace_quality_pass"));

  var rawRing=session.memory.readWord(1,addr("g_w4_trace_ring_raw"),128);
  var cycRing=session.memory.readWord(1,addr("g_w4_trace_ring_cycle_delta"),128);
  var pktRing=session.memory.readWord(1,addr("g_w4_trace_ring_packet_delta"),128);
  var trigger=rw("g_w4_trace_trigger_index"),hostMin=65535,hostMax=0;
  var traceComplete=(traceState===5 && traceFail===0 &&
                      triggerDemand>0 && triggerConfirmTick>0);
  function ringDemand(start,count){
    var cycles=0,packets=0;
    for(var k=0;k<count;k++){
      cycles+=Number(cycRing[(start+k)&127]);
      packets+=Number(pktRing[(start+k)&127]);
    }
    var cpp=packets>0?Math.floor(cycles/packets):0;
    var per5=count>0?Math.floor(cycles/count):0;
    return {cycles:cycles,packets:packets,cpp:cpp,per5:per5,
            demand:(cycles>0&&packets>0)?Math.floor((per5*cpp)/2):0};
  }
  var b1=ringDemand(trigger,4),b2=ringDemand(trigger+4,4),
      b3=ringDemand(trigger+8,4),post=ringDemand(trigger+12,40);
  var baselineCycles5=rw("g_w4_trace_baseline_cycles_per_5ms");
  var baselineCpp=rw("g_w4_trace_baseline_cycles_per_packet");
  var baselineTelemetryOk=baselineCycles5>0 && baselineCpp>0 &&
      baselineDemand===Math.floor((baselineCycles5*baselineCpp)/2);
  var triggerTelemetryOk=b3.cycles===rw("g_w4_trace_trigger_cycles_20ms") &&
      b3.packets===rw("g_w4_trace_trigger_packets_20ms") &&
      b3.cpp===rw("g_w4_trace_trigger_cycles_per_packet") &&
      b3.demand===triggerDemand;
  var threeBlocksValid=b1.demand>0 && b2.demand>0 && b3.demand>0;
  var threeBlocksDirection=threeBlocksValid && (DIRECTION===1 ?
      (b1.demand*8>=baselineDemand*9 &&
       b2.demand*8>=baselineDemand*9 &&
       b3.demand*8>=baselineDemand*9) :
      (b1.demand*8<=baselineDemand*7 &&
       b2.demand*8<=baselineDemand*7 &&
       b3.demand*8<=baselineDemand*7));
  var postDirection=post.demand>0 && (DIRECTION===1 ?
      post.demand*8>=baselineDemand*9 :
      post.demand*8<=baselineDemand*7);
  print("TRACE_BLOCKS b1_demand="+b1.demand+" b2_demand="+b2.demand+
        " b3_demand="+b3.demand+" post200ms_demand="+post.demand+
        " baseline_demand="+baselineDemand);
  var rowStart=traceComplete ? trigger :
      ((rw("g_w4_trace_write_index")+128-52)&127);
  if(!traceComplete)
    print("TRACE_NOT_COMPLETE__ROWS_ARE_LATEST_RING_NOT_TRIGGER_RELATIVE=TRUE");
  for(var i=0;i<52;i++){
    var index=(rowStart+i)&127;
    var vr=Number(rawRing[index]);
    var vc=Number(cycRing[index]);
    var vp=Number(pktRing[index]);
    if(vr<hostMin)hostMin=vr;if(vr>hostMax)hostMax=vr;
    print((traceComplete?"TRACE_ROW":"DIAGNOSTIC_RING_ROW")+" i="+i+
          (traceComplete?(" t_ms="+(i*5)):"")+" raw="+vr+
          " volts="+vout(vr).toFixed(4)+" cycles="+vc+" packets="+vp);
  }

  check("W4_HOLD_COMPLETE",state===4 && reason===1);
  check("FIRMWARE_DURATION_BOUNDED",elapsed>=3000000 && elapsed<=9000000);
  check("W4_PHYSICAL_STEP_ACK_CHAIN",stepAcknowledged &&
        promptNs>=fireNs+HOST_PROMPT_DELAY_NS &&
        ackNs>=promptNs && ackNs<=fireNs+HOST_ACK_DEADLINE_NS);
  check("W4_TRACE_COMPLETE",traceComplete);
  check("W4_TARGET_OPERATOR_MARKER_COMMITTED",traceComplete &&
        operatorMarkerTick>=TARGET_OPERATOR_MARKER_TICKS &&
        operatorMarkerTick<=9000000);
  check("W4_TRIGGER_AT_OR_AFTER_TARGET_MARKER",traceComplete &&
        triggerConfirmTick>=operatorMarkerTick+3000 &&
        triggerConfirmTick<=9000000);
  check("W4_TRACE_DIRECTION",rw("g_w4_trace_direction_active")===DIRECTION);
  check("W4_BASELINE_TELEMETRY_CONSISTENT",traceComplete && baselineTelemetryOk);
  check("W4_TRIGGER_BLOCK_TELEMETRY_MATCH",traceComplete && triggerTelemetryOk);
  check("W4_POST_STEP_DEMAND_PERSISTS",traceComplete && postDirection);
  check("W4_DEMAND_DIRECTION",traceComplete && baselineTelemetryOk &&
        triggerTelemetryOk && threeBlocksDirection && postDirection);
  check("W4_TRACE_PEAK_LE_5PCT",traceComplete &&
        traceMin>=1182 && traceMax<=1306 &&
        rw("g_w4_trace_peak_pass")===1);
  check("W4_TRACE_SETTLE_LE_100MS",traceComplete &&
        rw("g_w4_trace_settle_ms")<=100 &&
        rw("g_w4_trace_settle_pass")===1);
  check("W4_TRACE_QUALITY_PASS",traceComplete &&
        rw("g_w4_trace_quality_pass")===1);
  check("W4_TRACE_RING_MATCH",traceComplete &&
        traceMin===hostMin && traceMax===hostMax);
  check("W4_TRACE_WRITE_INDEX_MATCH",traceComplete &&
        rw("g_w4_trace_write_index")===((trigger+52)&127));
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
  check("W4_TERMINAL_COOKIE_COMMITTED",cookie===expectedCookie);
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
      forceSafe(!fired);
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
