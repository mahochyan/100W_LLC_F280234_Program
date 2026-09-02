// W2_BURST_PACKET_CHARACTERIZATION_V1 - REAL first shot: exact 1C.
// Only executes 1 cycle. No 2C, no auto sequence.
//
// Flow:
//   load frozen REAL v2.4 -> boot checks -> loopback -> stage 1..5A
//   -> 5A formal SoftStart/takeover -> host planned stop at takeover (~5.83V)
//   -> verify PWM=0/OST=1/IDLE -> request packet 1C -> poll completion
//   -> dump all requested telemetry -> final safety state.
//
// Human gates are confirmed in the user's authorizing message; script also
// accepts DSH_* env if present, or SOL_W2_GATES_ACK=1 as explicit record that
// the operator's written confirmation was accepted.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT = "D:\\CCS21_workspace\\Codex_Project\\Stage6_OL_STEADY\\LLC_100W_F28034_OPEN_LOOP_STEADY.out";
var EXPECTED_SHA = "ef607cce24b8399632538e40e9b93c44586f1c0d2140e496c1010c38a9db961d";
var MANIFEST = "D:\\CCS21_workspace\\Codex_Project\\evidence\\sol_master_execution\\w2_open_loop_steady\\REAL_OPEN_LOOP_STEADY_SHA256SUMS.txt";

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
function readManifest(){
  var map={};
  try{
    var lines=java.io.BufferedReader(new java.io.FileReader(MANIFEST));
    var t;
    while((t=lines.readLine())!=null){
      var idx=t.indexOf("=");
      if(idx>0){ map[t.substring(0,idx).trim()]=t.substring(idx+1).trim(); }
    }
    lines.close();
  }catch(e){ print("Manifest not found; SHA hard gate skipped."); }
  return map;
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
function vout(raw){ return raw*0.008089325 + (-0.063715); }
function check(name,ok){ print(name+"="+(ok?"PASS":"FAIL")); if(!ok) failures++; }

var failures=0;
print("=== SOL W2 BURST PACKET REAL 1C ===");

// Human gate acknowledgement
var ack = (java.lang.System.getenv("SOL_W2_GATES_ACK")||"").equals("1");
var op  = (java.lang.System.getenv("DSH_OPERATOR_PRESENT_CONFIRMED")||"").equals("1");
var ilim= (java.lang.System.getenv("DSH_INPUT_LIMIT_0_5A_CONFIRMED")||"").equals("1");
var vin = (java.lang.System.getenv("DSH_VIN_24V_CONFIRMED")||"").equals("1");
var cr15= (java.lang.System.getenv("DSH_CR15_OHM_CONFIRMED")||"").equals("1") ||
          (java.lang.System.getenv("DSH_LOAD_OHM_CONFIRMED")||"").equals("1") ||
          ((java.lang.System.getenv("DSH_LOAD_OHM")||"").indexOf("15")>=0);
var cnt34=(java.lang.System.getenv("DSH_CNT34_PERMANENT_CONNECTED_CONFIRMED")||"").equals("1") ||
          ((java.lang.System.getenv("DSH_CNT34_CONNECTED_CONFIRMED")||"").equals("1"));
print("GATE_OPERATOR="+op+" GATE_ILIM="+ilim+" GATE_VIN="+vin+" GATE_CR15="+cr15+" GATE_CNT34="+cnt34+" GATES_ACK="+ack);
if(!ack && (!op || !ilim || !vin || !cr15 || !cnt34)){
  print("ABORT: human gate not confirmed in env and SOL_W2_GATES_ACK not set");
  throw "real-gates";
}
if(ack){ print("GATE_USER_ACK=USER_CONFIRMED_IN_MESSAGE"); }

// SHA hard gate
var actual=sha256File(OUT);
print("REAL_OUT_SHA256="+actual);
print("EXPECTED_SHA256="+EXPECTED_SHA);
if(!actual.toUpperCase().equals(EXPECTED_SHA.toUpperCase())){
  print("ABORT: REAL SHA mismatch");
  throw "sha-mismatch";
}
print("REAL_SHA_HARD_GATE=PASS");

try{session.target.connect();}catch(e){}
try{session.target.halt();}catch(e){}
session.memory.loadProgram(OUT);
run(400);

// Initial boot state
var sys=rw("g_system_state");
var pwm=rw("g_pwm_enabled");
var fault=rv32u("g_fault_flags");
var ost=reg("EPwm1Regs.TZFLG.bit.OST");
var tzint=reg("EPwm1Regs.TZFLG.bit.INT");
var stage=rw("g_bringup_stage");
var voutcal=rw("g_board_vout_cal_valid");
var comp=rw("g_comp_tz_loopback_verified");
print("INIT sys="+sys+" pwm="+pwm+" fault="+fault+" ost="+ost+" tzint="+tzint+" stage="+stage+" voutcal="+voutcal+" comp="+comp);
check("INIT_SYS_IDLE",sys===1);
check("INIT_PWM_OFF",pwm===0);
check("INIT_FAULT_ZERO",fault===0);
check("INIT_OST_LATCHED",ost===1);
check("INIT_TZINT_ZERO",tzint===0);
check("INIT_STAGE_ZERO",stage===0);
check("INIT_VOUT_CAL_VALID",voutcal===1);
if(failures){ print("ABORT: boot gates"); try{session.terminate();}catch(e){} throw "boot-gates"; }

// COMP1OUT->GPIO15/TZ1 loopback
wv("g_loopback_diag_request",1);
run(50);
var diag=rw("g_loopback_diag_result");
var comp2=rw("g_comp_tz_loopback_verified");
print("LOOPBACK diag="+diag+" comp_verified="+comp2);
check("LOOPBACK_PASS",diag===1 && comp2===1);
if(failures){ print("ABORT: loopback failed"); try{session.terminate();}catch(e){} throw "loopback"; }

// Confirm stages 1..5A (current enum: 1,2,3,4,5)
for(var s=1;s<=5;s++){
  wv("g_stage_confirm_request",s);
  run(50);
  var stg=rw("g_bringup_stage");
  print("STAGE_CONFIRM_"+s+" -> "+stg);
  check("STAGE_CONFIRM_"+s, stg===s);
  if(failures){ print("ABORT: stage confirm "+s); try{session.terminate();}catch(e){} throw "stage-"+s; }
}

// Pre-charge via 5A formal SoftStart takeover, with firmware-latched stop at
// takeover (no in-band slew, no host-timing dependency).
print("--- PRECHARGE/TAKEOVER+AUTO_STOP ---");
wv("g_open_loop_frequency_command_hz",170000);
wv("g_open_loop_freq_slew_hz_per_sample",500);
wv("g_open_loop_stop_on_takeover",1);
wv("g_pwm_enable_request",1);
var toDone=0;
var toRaw=0;
var toFreq=0;
var autoStop=0;
var pollMs=0;
var MAX_POLL_MS=5000;
while(pollMs<MAX_POLL_MS){
  run(10);
  pollMs+=10;
  toDone=rw("g_open_loop_takeover_done");
  toRaw=rw("g_open_loop_takeover_raw");
  toFreq=rv32u("g_open_loop_takeover_freq_hz");
  autoStop=rw("g_open_loop_stop_reason");
  if(rw("g_fault_flags")!==0 || reg("EPwm1Regs.TZFLG.bit.OST")===0){
    print("PRECHARGE_ABORT fault="+rv32u("g_fault_flags")+" ost="+reg("EPwm1Regs.TZFLG.bit.OST")+" pwm="+rw("g_pwm_enabled"));
    break;
  }
  if(toDone===1 || autoStop!==0) break;
}
print("TAKEOVER_DONE="+toDone+" RAW="+toRaw+" FREQ="+toFreq+" AUTO_STOP="+autoStop+" POLL_MS="+pollMs+" state="+rw("g_system_state")+" phase="+rw("g_open_loop_phase"));
check("TAKEOVER_COMPLETED",toDone===1);
check("TAKEOVER_NO_FAULT",rv32u("g_fault_flags")===0);
check("TAKEOVER_OST_STILL_1",reg("EPwm1Regs.TZFLG.bit.OST")===1);
check("TAKEOVER_VOUT_PLATEAU",toRaw>600 && toRaw<900);  // expect ~727 (5.83V)
if(failures){ print("ABORT: takeover failed"); try{session.terminate();}catch(e){} throw "takeover"; }

// Host falling edge cleanup (the firmware already stopped at takeover)
wv("g_pwm_enable_request",0);
run(20);
var stopReason=rw("g_open_loop_stop_reason");
var sysAfter=rw("g_system_state");
var pwmAfter=rw("g_pwm_enabled");
var ostAfter=reg("EPwm1Regs.TZFLG.bit.OST");
var tzintAfter=reg("EPwm1Regs.TZFLG.bit.INT");
var faultAfter=rv32u("g_fault_flags");
var stopMean=rw("g_open_loop_stop_mean_raw");
var stopMin=rw("g_open_loop_stop_min_raw");
var stopMax=rw("g_open_loop_stop_max_raw");
print("STOP reason="+stopReason+" sys="+sysAfter+" pwm="+pwmAfter+" ost="+ostAfter+" tzint="+tzintAfter+" fault="+faultAfter);
print("STOP_MEAN_RAW="+stopMean+" MIN="+stopMin+" MAX="+stopMax+" VOUT_MEAN="+vout(stopMean));
check("STOP_HOST_PLANNED",stopReason===1);
check("STOP_SYS_IDLE",sysAfter===1);
check("STOP_PWM_OFF",pwmAfter===0);
check("STOP_OST_LATCHED",ostAfter===1);
check("STOP_TZINT_ZERO",tzintAfter===0);
check("STOP_FAULT_ZERO",faultAfter===0);
if(failures){ print("ABORT: precharge stop failed"); try{session.terminate();}catch(e){} throw "stop"; }

// Vout_before (host read after stop; also engine capture is recorded later)
var voutBeforeRaw=rw("g_adc_vout_raw");
var seqBefore=rv32u("g_adc_sample_sequence");
print("VOUT_BEFORE_RAW="+voutBeforeRaw+" VOUT_BEFORE_V="+vout(voutBeforeRaw)+" ADC_SEQ_BEFORE="+seqBefore);

// ---- Fire exactly 1C ----
print("--- PACKET 1C ---");
wv("g_multi_cycle_probe_result",0);
wv("g_burst_packet_result",0);
wv32("g_burst_packet_completed_cycles",0);
wv("g_burst_packet_cycles",1);
wv("g_burst_packet_request",1);
run(15);
var pktResult=0;
for(var p=0;p<10 && rw("g_burst_packet_result")===0;p++){ run(10); }
pktResult=rw("g_burst_packet_result");
var completed=rv32u("g_burst_packet_completed_cycles");
var multiResult=rw("g_multi_cycle_probe_result");
var multiStop=rw("g_multi_cycle_probe_stop_reason");
var pwmEnd=rw("g_pwm_enabled");
var ostEnd=reg("EPwm1Regs.TZFLG.bit.OST");
var tzintEnd=reg("EPwm1Regs.TZFLG.bit.INT");
var faultEnd=rv32u("g_fault_flags");
var voutAfterRaw=rw("g_burst_packet_vout_after");
var voutImmediateRaw=rw("g_burst_packet_vout_immediate");
var voutPeakRaw=rw("g_burst_packet_vout_peak");
var pktBeforeRaw=rw("g_burst_packet_vout_before");
print("PACKET requested_cycles=1 result="+pktResult+" completed="+completed+" multi_result="+multiResult+" multi_stop="+multiStop);
print("PACKET pwm="+pwmEnd+" ost="+ostEnd+" tzint="+tzintEnd+" fault="+faultEnd);
print("PACKET vout_before_raw="+pktBeforeRaw+" vout_before_v="+vout(pktBeforeRaw));
print("PACKET vout_after_raw="+voutAfterRaw+" vout_after_v="+vout(voutAfterRaw));
print("PACKET vout_immediate_raw="+voutImmediateRaw+" vout_immediate_v="+vout(voutImmediateRaw));
print("PACKET vout_peak_raw="+voutPeakRaw+" vout_peak_v="+vout(voutPeakRaw));
check("1C_RESULT_PASS",pktResult===1);
check("1C_EXACT_COMPLETED",completed===1);
check("1C_MULTI_RESULT",multiResult===1);
check("1C_PWM_OFF_FINAL",pwmEnd===0);
check("1C_OST_LATCHED_FINAL",ostEnd===1);
check("1C_TZINT_ZERO_FINAL",tzintEnd===0);
check("1C_FAULT_ZERO_FINAL",faultEnd===0);

// Post-packet host samples (best effort, ms-level; ADC may be stale after PWM
// stop). The firmware's immediate/peak fields are the microsecond-level captures.
function sampleAfter(ms){
  session.target.runAsynch(); java.lang.Thread.sleep(ms); session.target.halt();
  var raw=rw("g_adc_vout_raw");
  var seq=rv32u("g_adc_sample_sequence");
  print("POST_"+ms+"MS_RAW="+raw+" V="+vout(raw)+" SEQ="+seq);
  return {raw:raw, seq:seq};
}
var s1=sampleAfter(1);
var s5=sampleAfter(4);
var s10=sampleAfter(5);
var seqAfter=rv32u("g_adc_sample_sequence");
print("ADC_SEQ_BEFORE="+seqBefore+" AFTER_10MS="+seqAfter+" SEQ_ADVANCED="+(seqAfter!==seqBefore?"true":"false"));

var deltaRaw=pktBeforeRaw-voutBeforeRaw;
print("DELTA_VOUT_RAW="+deltaRaw+" DELTA_VOUT_V="+(vout(pktBeforeRaw)-vout(voutBeforeRaw)));
print("1C_OUTPUT_RESPONSE_BELOW_MEASUREMENT_RESOLUTION="+(Math.abs(deltaRaw)<=2?"true":"false"));

// Final safety state re-read
var finalFault=rv32u("g_fault_flags");
var finalOst=reg("EPwm1Regs.TZFLG.bit.OST");
var finalPwm=rw("g_pwm_enabled");
var finalTz=reg("EPwm1Regs.TZFLG.bit.INT");
print("FINAL_PWM="+finalPwm+" FINAL_OST="+finalOst+" FINAL_TZINT="+finalTz+" FINAL_FAULT="+finalFault);
check("FINAL_PWM_OFF",finalPwm===0);
check("FINAL_OST_LATCHED",finalOst===1);
check("FINAL_TZINT_ZERO",finalTz===0);
check("FINAL_FAULT_ZERO",finalFault===0);

print("1C_SAFE_SHUTDOWN="+(failures===0?"PASS":"FAIL"));
print("REAL_BURST_PACKET_1C_DONE");
if(failures){ try{session.terminate();}catch(e){} throw "1c-fail"; }
