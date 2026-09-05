// Supplemental W4 CR20 -> CR5 continuous load-map capture, 1 ohm per step.
// Target owns all 100 ms reduction and the autonomous terminal; after fire the
// host is completely silent until one bounded 70 s status query. No stdin or
// per-point acknowledgement exists.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_W4_SWEEP\\LLC_100W_F28034_OPEN_LOOP_STEADY.out";
var CSV_PATH="D:\\CCS21_workspace\\Codex_Project\\evidence\\sol_master_execution\\w4_10v_quality\\cr20_to_cr5_sweep_run_0x2509059c.csv";
var EXPECTED_SHA="AEF6083F6E08BC65689F86F7F67FF6DCDB3D6409C8219F5C1FA7C1FAAF0A09AA";
var RUN_ID=0x2509059C,DIRECTION=3,BINS=480,BIN_MS=100;
var INITIAL_LOAD=(java.lang.System.getenv("SOL_W4_SWEEP_INITIAL_OHMS")||"");
var FINAL_LOAD=(java.lang.System.getenv("SOL_W4_SWEEP_FINAL_OHMS")||"");
var STEP_OHMS=(java.lang.System.getenv("SOL_W4_SWEEP_STEP_OHMS")||"");
var INPUT_LIMIT=(java.lang.System.getenv("SOL_W4_INPUT_LIMIT_A")||"");
var ACK=(java.lang.System.getenv("SOL_W4_GATES_ACK")||"").equals("1");
if(!INITIAL_LOAD.equals("20") || !FINAL_LOAD.equals("5") ||
   !STEP_OHMS.equals("1")) throw "sweep-profile-must-be-20-to-5-step-1";
if(!INPUT_LIMIT.equals("1.2")) throw "sweep-input-limit-must-be-explicit-1.2A";
if(!ACK) throw "sweep-real-gates-not-acknowledged";

function sha256File(path){
  var md=MessageDigest.getInstance("SHA-256"),fis=new FileInputStream(path);
  var buf=java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE,8192),n;
  while((n=fis.read(buf))>0)md.update(buf,0,n);fis.close();
  var d=md.digest(),sb=new StringBuilder();
  for(var i=0;i<d.length;i++){
    var h=(d[i]&0xff).toString(16);if(h.length<2)h="0"+h;sb.append(h.toUpperCase());
  }
  return sb.toString();
}

var env=ScriptingEnvironment.instance(),server=env.getServer("DebugServer.1");
env.setScriptTimeout(30000);
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();session.setScriptTimeout(30000);
function addr(n){return session.expression.evaluate("&"+n);}
function rw(n){return session.memory.readWord(1,addr(n));}
function rv32u(n){var a=addr(n),lo=rw(n),hi=session.memory.readWord(1,a+1);return (lo|(hi<<16))>>>0;}
function wv(n,v){session.memory.writeWord(1,addr(n),v);}
function wv32(n,v){var a=addr(n);session.memory.writeWord(1,a,v&0xffff);session.memory.writeWord(1,a+1,(v>>>16)&0xffff);}
function reg(e){return parseInt(session.expression.evaluate(e));}
function run(ms){session.target.runAsynch();java.lang.Thread.sleep(ms);session.target.halt();}
function check(name,ok){print(name+"="+(ok?"PASS":"FAIL"));if(!ok)failures++;}
function vout(raw){return raw*0.008089325-0.063715;}
function nowNs(){return Number(java.lang.System.nanoTime());}
function waitUntil(ns){var ms=Math.ceil((ns-nowNs())/1000000.0);if(ms>0)java.lang.Thread.sleep(ms);}
function mix(checksum,value){
  return ((((checksum<<5)|(checksum>>>27))^(value&0xffff))>>>0);
}
function cookie(runId,state,reason,dataChecksum,count,overflow){
  return (0x57440000 ^ 0x00001405 ^ 0x00000015 ^ runId ^
          (3<<16) ^ ((state&0xffff)<<8) ^ (reason&0xffff) ^
          dataChecksum ^ ((count&0xffff)<<16) ^ (overflow&0xffff))>>>0;
}
function demand(cycles,packets,fiveMsSamples){
  if(cycles<=0||packets<=0)return 0;
  return Math.floor((Math.floor(cycles/fiveMsSamples)*
                     Math.floor(cycles/packets))/2);
}
function forceSafe(needHalt){
  if(needHalt){try{session.target.halt();}catch(e){}}
  try{wv("g_pwm_enable_request",0);}catch(e){}
  try{
    var tze=reg("EPwm1Regs.TZEINT.all");
    session.memory.writeWord(1,addr("EPwm1Regs.TZEINT.all"),tze&0xfffb);
    session.memory.writeWord(1,addr("EPwm1Regs.TZFRC.all"),4);
    session.memory.writeWord(1,addr("EPwm1Regs.TZCLR.all"),1);
    wv("g_pwm_enabled",0);wv("g_pwm_enable_result",0);
  }catch(e){print("FORCE_SAFE_EXCEPTION="+e);}
}

var failures=0,connected=false,fired=false,terminalHaltObserved=false;
var statusLinkFailed=false,statusProbes=0;
print("=== SOL W4 SUPPLEMENTAL CR20_TO_CR5 STEP_1OHM ===");
print("PROFILE_ID=0x1405 ALGORITHM_ID=0x0015 RUN_ID=0x2509059C");
print("VIN_V=24 INITIAL_CR=20 FINAL_CR=5 STEP_OHM=1 INPUT_LIMIT_A="+INPUT_LIMIT);
var actual=sha256File(OUT);
print("SWEEP_OUT_SHA256="+actual);print("EXPECTED_SHA256="+EXPECTED_SHA);
if(!actual.equals(EXPECTED_SHA))throw "sha-mismatch";
print("SWEEP_SHA_HARD_GATE=PASS");

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
  check("INIT_YELLOW_OFF",reg("GpioDataRegs.GPADAT.bit.GPIO21")===0);
  check("INIT_SWEEP_COUNT_ZERO",rw("g_w4_sweep_count")===0);
  if(failures)throw "boot-gates";

  wv("g_loopback_diag_request",1);run(50);
  check("LOOPBACK_PASS",rw("g_loopback_diag_result")===1 &&
        rw("g_comp_tz_loopback_verified")===1);
  for(var s=1;s<=5;s++){
    wv("g_stage_confirm_request",s);run(50);
    check("STAGE_CONFIRM_"+s,rw("g_bringup_stage")===s);
  }
  if(failures)throw "stage-gates";

  var clock0=rv32u("g_fast_tick");run(200);var clock1=rv32u("g_fast_tick");
  var clockDelta=(clock1-clock0)>>>0;
  print("PREFIRE_TARGET_CLOCK_DELTA_200MS="+clockDelta);
  check("PREFIRE_TARGET_CLOCK_200MS",clockDelta>=9000&&clockDelta<=11000);
  check("PREFIRE_PWM_OFF",rw("g_pwm_enabled")===0);
  check("PREFIRE_OST_LATCHED",reg("EPwm1Regs.TZFLG.bit.OST")===1);
  check("PREFIRE_FAULT_ZERO",rv32u("g_fault_flags")===0);
  if(failures)throw "prefire-gates";

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
  var fireNs=nowNs();
  session.target.runAsynch();
  waitUntil(fireNs+8000000000);
  print("WAIT_FOR_TARGET_YELLOW_LED=TRUE");
  print("FIRST_YELLOW=KEEP_CR20__THEN_EACH_3S_YELLOW_BLINK_DECREASE_EXACTLY_1OHM");
  print("SEQUENCE=CR20_CR19_CR18_CR17_CR16_CR15_CR14_CR13_CR12_CR11_CR10_CR9_CR8_CR7_CR6_CR5");
  print("EACH_LEVEL=1S_TRANSITION_WINDOW_PLUS2S_STEADY_PLATEAU");
  print("NO_POINT_ACK_REQUIRED__TARGET_RECORDS_100MS_BINS=TRUE");
  print("RESULT_SCOPE=SUPPLEMENTAL_MONOTONIC_16_LEVEL_MAP__SCHEDULED_CR_NOT_INDEPENDENTLY_MEASURED");
  print("HOST_SILENT_UNTIL_70S=TRUE");
  java.lang.System.out.flush();
  waitUntil(fireNs+70000000000);
  try{
    statusProbes++;
    terminalHaltObserved=session.target.isHalted();
    print("TERMINAL_PROBE_70S_IS_HALTED="+(terminalHaltObserved?"TRUE":"FALSE"));
  }catch(e){statusLinkFailed=true;print("TERMINAL_PROBE_70S_EXCEPTION="+e);}
  if(!terminalHaltObserved&&!statusLinkFailed){
    print("TARGET_STILL_ACTIVE__SILENT_TO_205S=TRUE");
    waitUntil(fireNs+205000000000);
    try{
      statusProbes++;
      terminalHaltObserved=session.target.isHalted();
      print("TERMINAL_PROBE_205S_IS_HALTED="+(terminalHaltObserved?"TRUE":"FALSE"));
    }catch(e){statusLinkFailed=true;print("TERMINAL_PROBE_205S_EXCEPTION="+e);}
  }
  if(statusLinkFailed){
    print("FTDI_STATUS_ERROR__NO_MORE_DSS_CALLS=TRUE");
    waitUntil(fireNs+205000000000);
    throw "terminal-link-failed";
  }
  if(!terminalHaltObserved)throw "firmware-terminal-unconfirmed";

  var state=rw("g_cal_hold_state"),reason=rw("g_cal_hold_stop_reason");
  var elapsed=rv32u("g_cal_hold_elapsed_ticks");
  var traceState=rw("g_w4_trace_state"),traceFail=rw("g_w4_trace_fail_reason");
  var count=rw("g_w4_sweep_count"),overflow=rw("g_w4_sweep_overflow");
  var dataChecksum=rv32u("g_w4_sweep_data_checksum");
  var packetActive=rw("g_cal_hold_packet_active"),pwmNow=rw("g_pwm_enabled");
  var finalPwm=rw("g_cal_hold_final_pwm"),finalOst=rw("g_cal_hold_final_ost");
  var runStop=rv32u("g_cal_hold_run_id_at_stop");
  var terminalCookie=rv32u("g_w4_trace_terminal_cookie");
  var expectedCookie=cookie(RUN_ID,state,reason,dataChecksum,count,overflow);
  var hwOst=reg("EPwm1Regs.TZFLG.bit.OST");
  var capsuleOk=(state===4||state===5)&&packetActive===0&&pwmNow===0&&
      finalPwm===0&&finalOst===1&&hwOst===1&&runStop===RUN_ID&&
      terminalCookie===expectedCookie&&(traceState===5||traceState===6);
  print("TERMINAL_CAPSULE state="+state+" reason="+reason+" elapsed="+elapsed+
        " trace_state="+traceState+" trace_fail="+traceFail+" count="+count+
        " overflow="+overflow+" data_checksum=0x"+dataChecksum.toString(16)+
        " pwm="+pwmNow+" ost="+hwOst+
        " cookie=0x"+terminalCookie.toString(16)+
        " expected=0x"+expectedCookie.toString(16));
  check("SWEEP_TERMINAL_CAPSULE",capsuleOk);
  if(!capsuleOk)throw "terminal-capsule-invalid";

  var mins=session.memory.readWord(1,addr("g_w4_sweep_raw_min"),BINS);
  var maxs=session.memory.readWord(1,addr("g_w4_sweep_raw_max"),BINS);
  var avgs=session.memory.readWord(1,addr("g_w4_sweep_raw_avg"),BINS);
  var cycles=session.memory.readWord(1,addr("g_w4_sweep_cycle_sum"),BINS);
  var packets=session.memory.readWord(1,addr("g_w4_sweep_packet_sum"),BINS);
  var ticks=session.memory.readWord(1,addr("g_w4_sweep_tick_delta"),BINS);
  var demands=[],globalMin=65535,globalMax=0,recomputedChecksum=0x53575015;
  var cadenceOk=true,structureOk=true,csvRows=[],cumulativeTicks=0;
  for(var i=0;i<count;i++){
    var mn=Number(mins[i]),mx=Number(maxs[i]),av=Number(avgs[i]);
    var cy=Number(cycles[i]),pk=Number(packets[i]),td=Number(ticks[i]);
    cumulativeTicks+=td;
    var dm=demand(cy,pk,20);
    demands.push(dm);if(mn<globalMin)globalMin=mn;if(mx>globalMax)globalMax=mx;
    if(td<4500||td>5500)cadenceOk=false;
    if(mn>av||av>mx||cy<=0||pk<=0||pk>cy)structureOk=false;
    recomputedChecksum=mix(recomputedChecksum,i);
    recomputedChecksum=mix(recomputedChecksum,mn);
    recomputedChecksum=mix(recomputedChecksum,mx);
    recomputedChecksum=mix(recomputedChecksum,av);
    recomputedChecksum=mix(recomputedChecksum,cy);
    recomputedChecksum=mix(recomputedChecksum,pk);
    recomputedChecksum=mix(recomputedChecksum,td);
    print("SWEEP_ROW bin="+i+" t_end_ms="+((i+1)*BIN_MS)+
          " raw_min="+mn+" raw_max="+mx+" raw_avg="+av+
          " volts_avg="+vout(av).toFixed(4)+" cycles="+cy+
          " packets="+pk+" tick_delta="+td+" demand="+dm);
    csvRows.push(i+","+((i+1)*BIN_MS)+","+cumulativeTicks+","+
                 (20-Math.floor(i/30))+","+
                 mn+","+mx+","+av+","+vout(av).toFixed(6)+","+
                 cy+","+pk+","+td+","+dm);
  }
  var segmentDemand=[],segmentsOk=(count===BINS),monotonicSteps=0;
  for(var level=0;level<16&&count===BINS;level++){
    var levelStart=level*30,plateauStart=levelStart+10;
    var levelCycles=0,levelPackets=0,firstCycles=0,firstPackets=0;
    var secondCycles=0,secondPackets=0,levelMin=65535,levelMax=0;
    for(var j=0;j<20;j++){
      var p=plateauStart+j,pc=Number(cycles[p]),pp=Number(packets[p]);
      levelCycles+=pc;levelPackets+=pp;
      if(j<10){firstCycles+=pc;firstPackets+=pp;}
      else{secondCycles+=pc;secondPackets+=pp;}
      if(Number(mins[p])<levelMin)levelMin=Number(mins[p]);
      if(Number(maxs[p])>levelMax)levelMax=Number(maxs[p]);
    }
    var levelDemand=demand(levelCycles,levelPackets,400);
    var firstHalf=demand(firstCycles,firstPackets,200);
    var secondHalf=demand(secondCycles,secondPackets,200);
    var stable=firstHalf>0&&secondHalf>0&&
        firstHalf*100>=secondHalf*97&&secondHalf*100>=firstHalf*97;
    var voltageOk=levelMin>=1182&&levelMax<=1306;
    if(level>0&&levelDemand*100>=segmentDemand[level-1]*102)monotonicSteps++;
    segmentDemand.push(levelDemand);
    if(!stable||!voltageOk||levelDemand<=0)segmentsOk=false;
    print("SWEEP_LEVEL cr="+(20-level)+" plateau_raw_min="+levelMin+
          " plateau_raw_max="+levelMax+" demand="+levelDemand+
          " first_half_demand="+firstHalf+" second_half_demand="+secondHalf+
          " stable="+(stable?"TRUE":"FALSE")+
          " voltage_ok="+(voltageOk?"TRUE":"FALSE"));
  }
  var firstDemand=segmentDemand.length?segmentDemand[0]:0;
  var lastDemand=segmentDemand.length?segmentDemand[segmentDemand.length-1]:0;
  print("SWEEP_SUMMARY count="+count+" global_min="+globalMin+
        " global_max="+globalMax+" first_demand="+firstDemand+
        " last_demand="+lastDemand+" monotonic_steps="+monotonicSteps+
        " checksum=0x"+dataChecksum.toString(16)+
        " recomputed=0x"+recomputedChecksum.toString(16));

  var csv=new PrintWriter(new BufferedWriter(new FileWriter(CSV_PATH,false)));
  try{
    csv.println("# run_id=0x2509059C,profile_id=0x1405,algorithm_id=0x0015,out_sha256="+actual);
    csv.println("# data_checksum=0x"+dataChecksum.toString(16)+",count="+count+",overflow="+overflow);
    csv.println("# scope=supplemental_monotonic_16_level_map,scheduled_cr_not_independently_measured=true");
    csv.println("bin,t_end_ms_nominal,t_end_target_ticks,scheduled_cr_ohm,raw_min,raw_max,raw_avg,vout_avg_v,cycle_sum,packet_sum,tick_delta,demand_index");
    for(var row=0;row<csvRows.length;row++)csv.println(csvRows[row]);
  }finally{csv.close();}
  print("SWEEP_CSV_PATH="+CSV_PATH);

  var fault=rv32u("g_fault_flags"),hw1=rv32u("g_tz_hardware_trip_count");
  var active1=rv32u("g_tz_active_window_trip_count");
  var rise1=rv32u("g_enable_rising_count");
  check("SWEEP_CAPTURE_480_BINS",count===BINS&&overflow===0);
  check("SWEEP_DATA_CHECKSUM",recomputedChecksum===dataChecksum);
  check("SWEEP_CADENCE_ALL_BINS",cadenceOk);
  check("SWEEP_STRUCTURE_ALL_BINS",structureOk);
  check("SWEEP_16_PLATEAUS",segmentsOk&&segmentDemand.length===16);
  check("SWEEP_15_MONOTONIC_STEPS",monotonicSteps===15);
  check("SWEEP_HOLD_COMPLETE",state===4&&reason===1&&traceState===5&&traceFail===0);
  check("SWEEP_DURATION_60S",elapsed>=3000000&&elapsed<=3020000);
  check("SWEEP_VOUT_GLOBAL_5PCT",globalMin>=1182&&globalMax<=1306);
  check("SWEEP_ENDPOINT_DEMAND_INCREASE",firstDemand>0&&lastDemand*2>=firstDemand*5);
  check("NO_FAULT",fault===0&&rw("g_system_state")===1);
  check("NO_HARD_LIMIT_EVENT",rw("g_cal_hold_hard_limit_events")===0);
  check("NO_HARDWARE_TZ_TRIP",hw1===hw0&&active1===active0);
  check("NO_PUBLIC_ENABLE_EDGE",rise1===rise0&&rw("g_pwm_enable_request")===0);
  check("FINAL_PWM_OFF",rw("g_pwm_enabled")===0&&finalPwm===0);
  check("FINAL_OST_LATCHED",hwOst===1&&finalOst===1);
  check("FINAL_TZINT_ZERO",reg("EPwm1Regs.TZFLG.bit.INT")===0);
  var csvResult=new PrintWriter(new BufferedWriter(new FileWriter(CSV_PATH,true)));
  try{csvResult.println("# host_gate_result="+(failures===0?"PASS":"FAIL")+
                        ",failure_count="+failures);}
  finally{csvResult.close();}
}catch(e){
  print("W4_SWEEP_REAL_EXCEPTION="+e);
  failures++;
}finally{
  if(connected){
    if(!fired||terminalHaltObserved){
      forceSafe(!fired);
      try{session.terminate();}catch(e){}
    }else{
      print("HOST_DID_NOT_HALT_UNCONFIRMED_ACTIVE_TARGET=TRUE");
    }
  }
}

print("SOL_W4_CR20_TO_CR5_SWEEP_PASS="+(failures===0?"TRUE":"FALSE"));
print("POWER_REQUEST_FIRED="+(fired?"TRUE":"FALSE"));
print("NO_RETRY_SAME_SHA_AFTER_FIRE=TRUE");
if(failures)throw "w4-cr20-cr5-sweep-failures="+failures;
