// W4 V15 protected-Burst return: CR12 -> CR15, one immutable LIGHTER run.
// Firmware owns the 60..180 s power window, terminal OST and diagnostic ESTOP.
// After fire this host emits local text cues on a monotonic schedule and makes
// no DSS/JTAG call until the first bounded terminal probe at 70 s.  There is no
// stdin/nonce acknowledgement path; target yellow is the physical step marker.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_W4_RETURN_V15\\LLC_100W_F28034_OPEN_LOOP_STEADY.out";
var EXPECTED_SHA="A2148D520E8EEDE6C9F060D07B0533E8F0EB799B99C928DED5642EF2D876E5A1";
var INITIAL_LOAD=(java.lang.System.getenv("SOL_W4_INITIAL_LOAD_OHMS")||"");
var INPUT_LIMIT=(java.lang.System.getenv("SOL_W4_INPUT_LIMIT_A")||"");
var GATES_ACK=(java.lang.System.getenv("SOL_W4_GATES_ACK")||"").equals("1");
var DIRECTION=2;
var RUN_ID=0x25090602;
var EXPECTED_INITIAL="12";
var EXPECTED_TARGET="15";
var STEP_TEXT="CR12_TO_CR15";
var CONTROL_MODE_ID=0x42525354;
var BURST_PROFILE_ID=0xEFFA6E24;
var V14_CR12_DEMAND_ANCHOR=30369;
var V14_CR15_DEMAND_ANCHOR=26475;
if(!INITIAL_LOAD.equals(EXPECTED_INITIAL)){throw "v15-initial-load-must-be-CR12";}
if(!INPUT_LIMIT.equals("1.2")){throw "w4-v15-input-limit-must-match-carried-1.2A";}
if(!GATES_ACK){throw "w4-v15-prefire-gates-not-acknowledged";}

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

var env=ScriptingEnvironment.instance(),server=env.getServer("DebugServer.1");
env.setScriptTimeout(30000);
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();
session.setScriptTimeout(30000);
function addr(n){return session.expression.evaluate("&"+n);}
function rw(n){return session.memory.readWord(1,addr(n));}
function rv32u(n){
  var a=addr(n),lo=session.memory.readWord(1,a),hi=session.memory.readWord(1,a+1);
  return (lo|(hi<<16))>>>0;
}
function wv(n,v){session.memory.writeWord(1,addr(n),v);}
function wv32(n,v){
  var a=addr(n);session.memory.writeWord(1,a,v&0xffff);
  session.memory.writeWord(1,a+1,(v>>>16)&0xffff);
}
function reg(e){return parseInt(session.expression.evaluate(e));}
function run(ms){session.target.runAsynch();java.lang.Thread.sleep(ms);session.target.halt();}
function vout(raw){return raw*0.008089325-0.063715;}
function check(name,ok){print(name+"="+(ok?"PASS":"FAIL"));if(!ok)failures++;}
function monotonicNs(){return Number(java.lang.System.nanoTime());}
function silentWaitUntil(deadlineNs){
  var remainingMs=Math.ceil((deadlineNs-monotonicNs())/1000000.0);
  if(remainingMs>0)java.lang.Thread.sleep(remainingMs);
}
function withinPercent(value,anchor,percent){
  return value*100>=anchor*(100-percent) && value*100<=anchor*(100+percent);
}
function terminalCookie(runId,direction,state,reason){
  return (0x57440000 ^ 0x00000F0C ^ 0x00000017 ^ CONTROL_MODE_ID ^
          BURST_PROFILE_ID ^ runId ^ ((direction&0xffff)<<16) ^
          ((state&0xffff)<<8) ^ (reason&0xffff))>>>0;
}

var HOST_QUIET_MIN_NS=70000000000;
var HOST_QUIET_MAX_NS=205000000000;
var TARGET_OPERATOR_MARKER_TICKS=600000;
var POST_FIRE_STATUS_PROBES_MAX=2;
var terminalProbeCount=0;
var terminalProbeLinkFailed=false;
function probeTerminalHalt(tag){
  if(terminalProbeCount>=POST_FIRE_STATUS_PROBES_MAX)
    throw "post-fire-status-probe-budget-exhausted";
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
print("=== SOL W4 V15 REAL "+STEP_TEXT+" PROTECTED-BURST RETURN ===");
print("LOAD_PROFILE_OHMS=12->15 PROFILE_ID=0x0F0C ALGORITHM_ID=0x0017");
print("CONTROLLER_MODE=PROTECTED_BURST PI_PFM_ACTIVE=FALSE");
print("TARGET_REFERENCE_FREEZE_TICKS=500000 TARGET_YELLOW_MARKER_TICKS=600000");
print("VIN_V=24 INITIAL_LOAD_OHMS="+INITIAL_LOAD+" TARGET_LOAD_OHMS="+
      EXPECTED_TARGET+" INPUT_CURRENT_LIMIT_A="+INPUT_LIMIT);
var actual=sha256File(OUT);
print("REAL_OUT_SHA256="+actual);print("EXPECTED_SHA256="+EXPECTED_SHA);
if(!actual.equals(EXPECTED_SHA)){throw "sha-mismatch";}
print("REAL_SHA_HARD_GATE=PASS");

try{
  session.target.connect();
  connected=true;
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
  check("INIT_V15_METADATA_CLEAR",rv32u("g_w4_v15_control_mode_id")===0 &&
        rv32u("g_w4_v15_burst_profile_id")===0);
  if(failures){throw "boot-gates";}

  wv("g_loopback_diag_request",1);run(50);
  check("LOOPBACK_PASS",rw("g_loopback_diag_result")===1 &&
        rw("g_comp_tz_loopback_verified")===1);
  for(var s=1;s<=5;s++){
    wv("g_stage_confirm_request",s);run(50);
    check("STAGE_CONFIRM_"+s,rw("g_bringup_stage")===s);
    if(failures){throw "stage-gate-"+s;}
  }

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
  var piUpdatePrefire=rv32u("g_control_pi_update_count");
  var piIntegralPrefire=rv32u("g_pi_integral_q12");
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
  /* This entire schedule is host-local: no session/target/memory/register API
   * is used. Yellow-on at target tick 600000 remains the authoritative cue. */
  silentWaitUntil(fireNs+8000000000);
  print("WATCH_TARGET_YELLOW_LED__THEN_SET_CR15_AND_HOLD=TRUE");
  print("HOST_NO_STDIN_OR_NONCE_ACK_REQUIRED=TRUE");
  print("HOST_DSS_SILENT_UNTIL_70S_TERMINAL_FLOOR=TRUE");
  try{Packages.java.awt.Toolkit.getDefaultToolkit().beep();}catch(beepError){}
  java.lang.System.out.flush();
  var cueMs=[12200,22200,32200,42200,52200];
  for(var ci=0;ci<cueMs.length;ci++){
    silentWaitUntil(fireNs+cueMs[ci]*1000000);
    print("SET_CR15_NOW_AND_HOLD__LOCAL_CUE_"+(ci+1)+"=TRUE elapsed_ms="+cueMs[ci]);
    try{Packages.java.awt.Toolkit.getDefaultToolkit().beep();}catch(beepError){}
    java.lang.System.out.flush();
  }

  silentWaitUntil(fireNs+HOST_QUIET_MIN_NS);
  terminalHaltObserved=probeTerminalHalt("FIRST_TERMINAL_PROBE");
  if(!terminalHaltObserved && !terminalProbeLinkFailed){
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
  check("W4_V15_TERMINAL_CAPSULE_COMMITTED",capsuleOk);
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
  var modeId=rv32u("g_w4_v15_control_mode_id");
  var burstProfile=rv32u("g_w4_v15_burst_profile_id");
  var piStart=rv32u("g_w4_v15_pi_update_count_start");
  var piEnd=rv32u("g_w4_v15_pi_update_count_end");
  var integralStart=rv32u("g_w4_v15_pi_integral_q12_start");
  var integralEnd=rv32u("g_w4_v15_pi_integral_q12_end");
  var frequencyApplyCount=rv32u("g_w4_v15_frequency_apply_count");
  var isrMax=rv32u("g_w4_v15_isr_cycles_max");
  var isrSamples=rv32u("g_w4_v15_isr_sample_count");
  var isrOverruns=rv32u("g_w4_v15_isr_overrun_count");

  print("RESULT state="+state+" reason="+reason+" elapsed_ticks="+elapsed+
        " fault=0x"+fault.toString(16));
  print("CONTROL_MODE id=0x"+modeId.toString(16)+
        " burst_profile=0x"+burstProfile.toString(16)+
        " carrier_hz="+rv32u("g_w4_v15_burst_carrier_hz")+
        " tbprd="+rw("g_w4_v15_burst_tbprd")+
        " db_start="+rw("g_w4_v15_burst_db_start")+
        " db_min="+rw("g_w4_v15_burst_db_min")+
        " recharge_low="+rw("g_w4_v15_recharge_low_raw")+
        " target="+rw("g_w4_v15_recharge_target_raw")+
        " hard="+rw("g_w4_v15_hard_limit_raw")+
        " packet_max="+rw("g_w4_v15_max_packet_cycles"));
  print("PI_INACTIVE update_start="+piStart+" update_end="+piEnd+
        " integral_q12_start=0x"+integralStart.toString(16)+
        " integral_q12_end=0x"+integralEnd.toString(16)+
        " generic_frequency_apply_count="+frequencyApplyCount);
  print("W4_PI_KP=N/A W4_PI_KI=N/A W4_PI_INTEGRAL_SATURATION=N/A");
  print("W4_PI_FREQUENCY_TRAJECTORY=N/A PI_PFM_ACTIVE=FALSE");
  print("W4_10V_PI_PFM_BASELINE_ACCEPTED=NOT_ISSUED");
  print("ISR_BUDGET max_cycles="+isrMax+" samples="+isrSamples+
        " deadline_overruns="+isrOverruns);
  print("ISR_MEASUREMENT_SCOPE=TINT0_ENTRY_THROUGH_PIEACK__EXCLUDES_PROFILER_BOOKKEEPING_AND_RETI");
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
    var cycles=0,packetsLocal=0;
    for(var k=0;k<count;k++){
      cycles+=Number(cycRing[(start+k)&127]);
      packetsLocal+=Number(pktRing[(start+k)&127]);
    }
    var cpp=packetsLocal>0?Math.floor(cycles/packetsLocal):0;
    var per5=count>0?Math.floor(cycles/count):0;
    return {cycles:cycles,packets:packetsLocal,cpp:cpp,per5:per5,
            demand:(cycles>0&&packetsLocal>0)?Math.floor((per5*cpp)/2):0};
  }
  var b1=ringDemand(trigger,4),b2=ringDemand(trigger+4,4);
  var b3=ringDemand(trigger+8,4),post=ringDemand(trigger+12,40);
  var baselineCycles5=rw("g_w4_trace_baseline_cycles_per_5ms");
  var baselineCpp=rw("g_w4_trace_baseline_cycles_per_packet");
  var baselineTelemetryOk=baselineCycles5>0 && baselineCpp>0 &&
      baselineDemand===Math.floor((baselineCycles5*baselineCpp)/2);
  var triggerTelemetryOk=b3.cycles===rw("g_w4_trace_trigger_cycles_20ms") &&
      b3.packets===rw("g_w4_trace_trigger_packets_20ms") &&
      b3.cpp===rw("g_w4_trace_trigger_cycles_per_packet") &&
      b3.demand===triggerDemand;
  var threeBlocksDirection=b1.demand>0 && b2.demand>0 && b3.demand>0 &&
      b1.demand*8<=baselineDemand*7 &&
      b2.demand*8<=baselineDemand*7 &&
      b3.demand*8<=baselineDemand*7;
  var postDirection=post.demand>0 && post.demand*8<=baselineDemand*7;
  print("TRACE_BLOCKS b1_demand="+b1.demand+" b2_demand="+b2.demand+
        " b3_demand="+b3.demand+" post200ms_demand="+post.demand+
        " baseline_demand="+baselineDemand);
  for(var i=0;i<52;i++){
    var index=(trigger+i)&127;
    var vr=Number(rawRing[index]),vc=Number(cycRing[index]);
    var vp=Number(pktRing[index]);
    if(vr<hostMin)hostMin=vr;if(vr>hostMax)hostMax=vr;
    print("TRACE_ROW i="+i+" t_ms="+(i*5)+" raw="+vr+
          " volts="+vout(vr).toFixed(4)+" cycles="+vc+" packets="+vp);
  }

  check("W4_V15_HOLD_COMPLETE",state===4 && reason===1);
  check("FIRMWARE_DURATION_BOUNDED",elapsed>=3000000 && elapsed<=9000000);
  check("W4_V15_TRACE_COMPLETE",traceComplete);
  check("W4_V15_TARGET_COORDINATION_CHAIN",traceComplete &&
        operatorMarkerTick>=TARGET_OPERATOR_MARKER_TICKS &&
        triggerConfirmTick>=operatorMarkerTick+3000 &&
        triggerConfirmTick<=9000000 &&
        rw("g_w4_trace_direction_active")===DIRECTION);
  check("W4_V15_BASELINE_TELEMETRY_CONSISTENT",traceComplete && baselineTelemetryOk);
  check("W4_V15_TRIGGER_BLOCK_TELEMETRY_MATCH",traceComplete && triggerTelemetryOk);
  check("W4_V15_DEMAND_DIRECTION",traceComplete && threeBlocksDirection && postDirection);
  check("W4_V15_PLANT_ONLY_CR12_BASELINE_ANCHOR_10PCT",traceComplete &&
        withinPercent(baselineDemand,V14_CR12_DEMAND_ANCHOR,10));
  check("W4_V15_PLANT_ONLY_CR15_RETURN_ANCHOR_10PCT",traceComplete &&
        withinPercent(post.demand,V14_CR15_DEMAND_ANCHOR,10));
  check("W4_V15_TRACE_PEAK_LE_5PCT",traceComplete &&
        traceMin>=1182 && traceMax<=1306 && rw("g_w4_trace_peak_pass")===1);
  check("W4_V15_TRACE_SETTLE_LE_100MS",traceComplete &&
        rw("g_w4_trace_settle_ms")<=100 && rw("g_w4_trace_settle_pass")===1);
  check("W4_V15_TRACE_QUALITY_PASS",traceComplete &&
        rw("g_w4_trace_quality_pass")===1);
  check("W4_V15_TRACE_RING_MATCH",traceComplete &&
        traceMin===hostMin && traceMax===hostMax);
  check("W4_V15_TRACE_WRITE_INDEX_MATCH",traceComplete &&
        rw("g_w4_trace_write_index")===((trigger+52)&127));
  check("W4_V15_PROTECTED_BURST_METADATA",modeId===CONTROL_MODE_ID &&
        burstProfile===BURST_PROFILE_ID &&
        rv32u("g_w4_v15_burst_carrier_hz")===250000 &&
        rw("g_w4_v15_burst_tbprd")===239 &&
        rw("g_w4_v15_burst_db_start")===110 &&
        rw("g_w4_v15_burst_db_min")===36 &&
        rw("g_w4_v15_recharge_low_raw")===1220 &&
        rw("g_w4_v15_recharge_target_raw")===1260 &&
        rw("g_w4_v15_hard_limit_raw")===1300 &&
        rw("g_w4_v15_max_packet_cycles")===160);
  check("W4_V15_PI_UPDATE_INACTIVE",piStart===piUpdatePrefire &&
        piEnd===piStart && rv32u("g_control_pi_update_count")===piEnd);
  check("W4_V15_PI_INTEGRATOR_UNCHANGED",integralStart===piIntegralPrefire &&
        integralEnd===integralStart && rv32u("g_pi_integral_q12")===integralEnd);
  check("W4_V15_GENERIC_FREQUENCY_APPLY_ZERO",frequencyApplyCount===0);
  check("W4_V15_ISR_SAMPLES_PRESENT",isrSamples>0 && isrMax>0);
  check("W4_V15_ISR_MAX_LE_900",isrSamples>0 && isrMax>0 && isrMax<=900);
  check("W4_V15_ISR_DEADLINE_OVERRUN_ZERO",isrOverruns===0);
  check("W4_V15_HOLD_AVERAGE_10V",ssn>0 && ssavg>=1180 && ssavg<1300);
  var capTicks=elapsed;
  if(capTicks<3000000)capTicks=3000000;
  if(capTicks>9000000)capTicks=9000000;
  var proportionalCap=Math.floor((capTicks*5)/2);
  check("W4_V15_PACKETS_PRESENT_BOUNDED",packets>0 &&
        rw("g_cal_hold_packet_max_cycles")<=160 &&
        total<=proportionalCap+160 && total<=22500000+160);
  check("NO_HARD_LIMIT_EVENT",rw("g_cal_hold_hard_limit_events")===0);
  check("NO_FAULT",fault===0 && rw("g_system_state")===1);
  check("NO_HARDWARE_TZ_TRIP",hw1===hw0 && active1===active0);
  check("NO_PUBLIC_ENABLE_EDGE",rise1===rise0 && rw("g_pwm_enable_request")===0);
  check("RUN_ID_CHAIN",rv32u("g_cal_hold_run_id_at_arm")===RUN_ID &&
        rv32u("g_cal_hold_run_id_at_stop")===RUN_ID);
  check("W4_V15_TERMINAL_COOKIE_COMMITTED",cookie===expectedCookie);
  check("FINAL_PWM_OFF",rw("g_pwm_enabled")===0 && rw("g_cal_hold_final_pwm")===0);
  check("FINAL_OST_LATCHED",reg("EPwm1Regs.TZFLG.bit.OST")===1 &&
        rw("g_cal_hold_final_ost")===1);
  check("FINAL_TZINT_ZERO",reg("EPwm1Regs.TZFLG.bit.INT")===0);
}catch(e){
  print("W4_V15_REAL_EXCEPTION="+e);
  failures++;
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
      print("CLEANUP_DEFERRED_UNTIL_FIRMWARE_TERMINAL=TRUE");
      print("HOST_DID_NOT_HALT_UNCONFIRMED_ACTIVE_TARGET=TRUE");
    }
  }
}

print("SOL_W4_10V_CR12_TO_CR15_RETURN_V15_PASS="+(failures===0?"TRUE":"FALSE"));
print("POWER_REQUEST_FIRED="+(fired?"TRUE":"FALSE"));
print("NO_RETRY_SAME_SHA_AFTER_FIRE=TRUE");
if(failures){throw "w4-v15-real-CR12-to-CR15-failures="+failures;}
