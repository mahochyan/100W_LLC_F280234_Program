// W3_10V_BURST_HOLD_V8 - REAL forward duration ladder, one request per run.
//
// Firmware owns the complete sequence: bounded Profile C charge to raw1200,
// protected 10 V recharge packets, the selected frozen duration, and final OST. The
// host never issues a PWM enable edge and never times the power stop.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_OL_STEADY\\LLC_100W_F28034_OPEN_LOOP_STEADY.out";
var EXPECTED_SHA="F972829DA35D4557A93ED2B4B11600672BDC5FB7DFF9B86D48E50CE883EF7BFA";
var DURATION_MS=parseInt(java.lang.System.getenv("SOL_W3_DURATION_MS")||"0");
var LOAD_OHMS=(java.lang.System.getenv("SOL_W3_LOAD_OHMS")||"15");
var RUN_ID=0,CYCLE_CAP=0,WAIT_MS=0;
var LOAD10=LOAD_OHMS.equals("10");
if(!LOAD10 && !LOAD_OHMS.equals("15")){throw "load-must-be-explicit-10-or-15-ohm";}
if(DURATION_MS===500){RUN_ID=LOAD10?0x25090577:0x25090573;CYCLE_CAP=62500;WAIT_MS=1000;}
else if(DURATION_MS===2000){RUN_ID=LOAD10?0x25090578:0x25090574;CYCLE_CAP=250000;WAIT_MS=2500;}
else if(DURATION_MS===10000){RUN_ID=LOAD10?0x25090579:0x25090575;CYCLE_CAP=1250000;WAIT_MS=10500;}
else if(DURATION_MS===60000){RUN_ID=LOAD10?0x2509057A:0x25090576;CYCLE_CAP=7500000;WAIT_MS=60600;}
else{throw "duration-must-be-forward-gate-500-2000-10000-60000";}

function sha256File(path){
  var md=MessageDigest.getInstance("SHA-256");
  var fis=new FileInputStream(path);
  var buf=java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE,8192),n;
  while((n=fis.read(buf))>0){md.update(buf,0,n);} fis.close();
  var d=md.digest(),sb=new StringBuilder();
  for(var i=0;i<d.length;i++){
    var h=(d[i]&0xff).toString(16);if(h.length<2)h="0"+h;sb.append(h.toUpperCase());
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

var failures=0,connected=false,fired=false;
print("=== SOL W3 10V BURST HOLD REAL "+DURATION_MS+"MS ===");
var ack=(java.lang.System.getenv("SOL_W3_GATES_ACK")||"").equals("1");
print("LOAD_OHMS="+LOAD_OHMS);
print("GATE_USER_ACK="+ack+" (standing Vin24/CR"+LOAD_OHMS+" confirmation)");
if(!ack){throw "real-gates";}
var actual=sha256File(OUT);
print("REAL_OUT_SHA256="+actual);print("EXPECTED_SHA256="+EXPECTED_SHA);
if(!actual.equals(EXPECTED_SHA)){throw "sha-mismatch";}
print("REAL_SHA_HARD_GATE=PASS");

try{
  try{session.target.connect();}catch(e){} connected=true;
  try{session.target.halt();}catch(e){}
  session.memory.loadProgram(OUT);run(400);
  var initSys=rw("g_system_state"),initPwm=rw("g_pwm_enabled");
  var initFault=rv32u("g_fault_flags"),initOst=reg("EPwm1Regs.TZFLG.bit.OST");
  var initTzint=reg("EPwm1Regs.TZFLG.bit.INT"),initStage=rw("g_bringup_stage");
  var initCal=rw("g_board_vout_cal_valid"),initHold=rw("g_cal_hold_state");
  var initMode=rw("g_cal_hold_mode_active"),initModeReq=rw("g_cal_hold_mode_request");
  print("INIT_SNAPSHOT sys="+initSys+" pwm="+initPwm+" fault=0x"+initFault.toString(16)+
        " ost="+initOst+" tzint="+initTzint+" stage="+initStage+" cal="+initCal+
        " hold_state="+initHold+" mode_active="+initMode+" mode_req="+initModeReq);
  check("INIT_SYS_IDLE",initSys===1);
  check("INIT_PWM_OFF",initPwm===0);
  check("INIT_FAULT_ZERO",initFault===0);
  check("INIT_OST_LATCHED",initOst===1);
  check("INIT_TZINT_ZERO",initTzint===0);
  check("INIT_STAGE_ZERO",initStage===0);
  check("INIT_VOUT_CAL_VALID",initCal===1);
  check("INIT_CALHOLD_STATE_IDLE",initHold===0);
  check("INIT_CALHOLD_MODE_LEGACY",initMode===0 && initModeReq===0);
  if(failures){throw "boot-gates";}

  wv("g_loopback_diag_request",1);run(50);
  check("LOOPBACK_PASS",rw("g_loopback_diag_result")===1 && rw("g_comp_tz_loopback_verified")===1);
  if(failures){throw "loopback-gate";}
  for(var s=1;s<=5;s++){
    wv("g_stage_confirm_request",s);run(50);
    check("STAGE_CONFIRM_"+s,rw("g_bringup_stage")===s);
    if(failures){throw "stage-gate-"+s;}
  }

  var hw0=rv32u("g_tz_hardware_trip_count");
  var active0=rv32u("g_tz_active_window_trip_count");
  var rise0=rv32u("g_enable_rising_count");
  print("PRE_FIRE raw="+rw("g_adc_vout_raw")+" vout="+vout(rw("g_adc_vout_raw"))+
        " hw_trip="+hw0+" active_trip="+active0+" enable_rise="+rise0);

  wv32("g_test_run_id",RUN_ID);
  wv("g_cal_hold_mode_request",1);
  wv("g_cal_hold_duration_ms",DURATION_MS);
  wv("g_cal_hold_request",1);
  fired=true;

  // One uninterrupted observation interval. Firmware terminates at DURATION_MS;
  // the extra margin only lets the host halt after the immutable safe result.
  run(WAIT_MS);

  var state=rw("g_cal_hold_state"),reason=rw("g_cal_hold_stop_reason");
  var charge=rw("g_cal_hold_charge_stop_raw"),raw=rw("g_cal_hold_raw");
  var min=rw("g_cal_hold_min"),max=rw("g_cal_hold_max");
  var ssmin=rw("g_cal_hold_steady_min"),ssmax=rw("g_cal_hold_steady_max");
  var sssum=rv32u("g_cal_hold_steady_sum"),ssn=rv32u("g_cal_hold_steady_samples");
  var ssavg=ssn?Math.floor(sssum/ssn):0;
  var calavg=rw("g_cal_hold_cal_raw_avg"),caln=rv32u("g_cal_hold_cal_raw_samples");
  var packets=rv32u("g_cal_hold_packet_count"),total=rv32u("g_cal_hold_total_packet_cycles");
  var pmin=rw("g_cal_hold_packet_min_cycles"),pmax=rw("g_cal_hold_packet_max_cycles");
  var elapsed=rv32u("g_cal_hold_elapsed_ticks");
  var fault=rv32u("g_fault_flags"),hw1=rv32u("g_tz_hardware_trip_count");
  var active1=rv32u("g_tz_active_window_trip_count"),rise1=rv32u("g_enable_rising_count");
  var pwm=rw("g_pwm_enabled"),ost=reg("EPwm1Regs.TZFLG.bit.OST"),tzint=reg("EPwm1Regs.TZFLG.bit.INT");

  print("RESULT state="+state+" reason="+reason+" mode="+rw("g_cal_hold_mode_active")+
        " elapsed_ticks="+elapsed+" fault=0x"+fault.toString(16));
  print("CHARGE target="+rw("g_accel_stop_target_raw")+" stop="+charge+
        " accel_reason="+rw("g_accel_stop_reason")+" accel_max="+rw("g_accel_stop_max_raw")+
        " phase="+rw("g_accel_stop_phase")+" tbprd="+rw("g_accel_stop_tbprd")+
        " db="+rw("g_accel_stop_dbred")+
        " completed_cycles="+rv32u("g_accel_stop_completed_cycles"));
  print("HOLD raw="+raw+" min="+min+" max="+max+" steady_min="+ssmin+
        " steady_max="+ssmax+" steady_avg="+ssavg+" cal_avg="+calavg+" cal_n="+caln);
  print("PACKETS count="+packets+" total_cycles="+total+" min_cycles="+pmin+
        " max_cycles="+pmax+" hard_events="+rw("g_cal_hold_hard_limit_events")+
        " undersupply_confirm="+rw("g_cal_hold_undersupply_low_samples"));
  print("LAST_PACKET start_raw="+rw("g_cal_hold_packet_start_raw")+
        " stop_raw="+rw("g_cal_hold_packet_stop_raw")+
        " post_max_raw="+rw("g_cal_hold_packet_post_max_raw")+
        " post_last_raw="+rw("g_cal_hold_packet_post_last_raw")+
        " cycles="+rv32u("g_cal_hold_packet_actual_cycles")+
        " final_db="+reg("EPwm1Regs.DBRED"));
  print("FINAL pwm="+pwm+" ost="+ost+" tzint="+tzint+
        " hw_trip_delta="+(hw1-hw0)+" active_trip_delta="+(active1-active0)+
        " enable_rise_delta="+(rise1-rise0));
  if(fault!==0 || hw1!==hw0 || active1!==active0){
    print("TRIP_DIAG event_phase="+rw("g_tz_event_phase")+
          " accel_trip_phase="+rw("g_accel_trip_phase")+
          " accel_trip_period="+rw("g_accel_trip_period")+
          " accel_trip_cmpa="+rw("g_accel_trip_cmpa")+
          " accel_trip_db="+rw("g_accel_trip_db")+
          " accel_trip_completed="+rv32u("g_accel_trip_completed_cycles")+
          " packet_active="+rw("g_cal_hold_packet_active")+
          " packet_cycles="+rw("g_cal_hold_packet_cycles")+
          " trip_tbctr="+rw("g_comp_trip_tbctr")+
          " trip_raw="+rw("g_comp_trip_vout_raw")+
          " trip_dac="+rw("g_comp_trip_dac_code")+
          " tz_gpio15="+rw("g_tz_isr_gpio15")+
          " tz_compsts="+rw("g_tz_isr_compsts")+
          " tzflg="+rw("g_tz_isr_tzflg")+
          " pre_reject="+rw("g_comp_prestart_reject")+
          " pre_gpio15="+rw("g_comp_prestart_gpio15")+
          " start_prepared="+rw("g_pwm_start_prepared")+
          " aq_rldcsf="+reg("EPwm1Regs.AQSFRC.bit.RLDCSF")+
          " aq_actsfa="+reg("EPwm1Regs.AQSFRC.bit.ACTSFA"));
  }

  check("W3_MODE_LATCHED",rw("g_cal_hold_mode_active")===1);
  check("W3_"+DURATION_MS+"MS_COMPLETE",state===4 && reason===1);
  check("FIRMWARE_DURATION_EXACT",elapsed>=DURATION_MS*50 && elapsed<=DURATION_MS*50+10);
  check("INITIAL_TARGET_1200",rw("g_accel_stop_target_raw")===1200 && rw("g_accel_stop_hard_limit_raw")===1300);
  check("INITIAL_CHARGE_TARGET_STOP",rw("g_accel_stop_reason")===2 && charge>=1200 && charge<1300);
  check("INITIAL_CHARGE_NO_HW_TRIP",rw("g_pre_stop_hardware_trip_seen")===0);
  check("PACKETS_EMITTED",packets>0);
  check("PACKETS_CYCLE_BOUNDED",pmin>=1 && pmin<=pmax && pmax<=160);
  check("TOTAL_CYCLE_CAP",total>0 && total<CYCLE_CAP);
  check("HOLD_SAMPLES_PRESENT",ssn>0 && caln>0);
  check("HOLD_RAW_BOUNDED",min>=1000 && max<1300 && ssmin>=1000 && ssmax<1300);
  check("HOLD_AVERAGE_10V_BAND",ssavg>=1180 && ssavg<1300 && calavg>=1180 && calavg<1300);
  check("NO_HARD_LIMIT_EVENT",rw("g_cal_hold_hard_limit_events")===0);
  check("NO_FAULT",fault===0 && rw("g_system_state")===1);
  check("NO_HARDWARE_TZ_TRIP",hw1===hw0 && active1===active0);
  check("NO_PUBLIC_ENABLE_EDGE",rise1===rise0 && rw("g_pwm_enable_request")===0);
  check("RUN_ID_CHAIN",rv32u("g_cal_hold_run_id_at_arm")===RUN_ID && rv32u("g_cal_hold_run_id_at_stop")===RUN_ID);
  check("FINAL_PWM_OFF",pwm===0 && rw("g_cal_hold_final_pwm")===0);
  check("FINAL_OST_LATCHED",ost===1 && rw("g_cal_hold_final_ost")===1);
  check("FINAL_TZINT_ZERO",tzint===0);
}catch(e){
  print("REAL_LADDER_EXCEPTION="+e);
  if(fired)failures++;
}finally{
  if(connected){
    forceSafe();
    try{
      check("CLEANUP_PWM_OFF",rw("g_pwm_enabled")===0);
      check("CLEANUP_OST_LATCHED",reg("EPwm1Regs.TZFLG.bit.OST")===1);
      check("CLEANUP_TZINT_ZERO",reg("EPwm1Regs.TZFLG.bit.INT")===0);
    }catch(e){print("CLEANUP_READ_EXCEPTION="+e);failures++;}
    try{session.terminate();}catch(e){}
  }
}

print("SOL_W3_10V_BURST_HOLD_REAL_"+DURATION_MS+"MS_PASS="+(failures===0?"TRUE":"FALSE"));
print("POWER_REQUEST_FIRED="+(fired?"TRUE":"FALSE"));
print("NO_RETRY_SAME_SHA_AFTER_FIRE=TRUE");
if(failures){throw "w3-real-"+DURATION_MS+"ms-failures="+failures;}
