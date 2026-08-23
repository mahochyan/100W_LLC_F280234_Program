// stage6_first_real_pi_shot_nosim.js
// NO-ENERGY complete simulation of the FIRST BOUNDED REAL PI SHOT (task I).
// CNT3/CNT4 OPEN, no real power. Runs the shot firmware (Stage6_FLASH_SHOT)
// with synthetic VOUT through: Profile C -> 10V handoff -> shot arm -> PI
// actuator -> 200us on-chip auto-OST -> dump ring buffer. 7 scenarios.
// This does NOT execute a real shot.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
var OUT="D:\\CCS21_workspace\\Codex_Project\\evidence\\stage6_first_real_pi_shot\\LLC_100W_F28034_BRINGUP_DSH_SHOT.out";
var env=ScriptingEnvironment.instance(); var server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();
function addr(n){return session.expression.evaluate("&"+n);}
function rw(n){try{return session.memory.readWord(1,addr(n));}catch(e){return -1;}}
function rv32u(n){try{var a=addr(n);return(session.memory.readWord(1,a)|(session.memory.readWord(1,a+1)<<16))>>>0;}catch(e){return -1;}}
function wv(n,v){session.memory.writeWord(1,addr(n),v);}
function wv32(n,v){var a=addr(n);session.memory.writeWord(1,a,v&0xFFFF);session.memory.writeWord(1,a+1,(v>>>16)&0xFFFF);}
function reg(e){try{return ""+session.expression.evaluate(e);}catch(err){return "<f>";}}
function run(ms){session.target.runAsynch();java.lang.Thread.sleep(ms);session.target.halt();}

function handoff(syntheticVout){
  wv("g_bringup_stage",7);wv("g_comp_tz_loopback_verified",1);wv("g_board_vout_cal_valid",1);
  wv("g_diag_frequency_override",1);
  wv("g_softstart_no_energy",1);wv("g_softstart_acceptance_mode",0);wv("g_softstart_accept_target_raw",1244);
  wv("g_softstart_request",0);wv("g_softstart_result",0);wv("g_softstart_state",0);wv("g_system_state",1);
  wv32("g_power_run_min_frequency_hz",120000);
  wv("g_stage6_synthetic_vout_raw",syntheticVout);wv("g_stage6_closeloop_vout_inject",1);
  wv("g_stage6_noenergy_test_enable",1);wv("g_stage6_noenergy_test_mode",4);
  wv("g_no_energy_test_mode",1);   // treat benign ADC OVF as noise (no-energy sim)
  wv("g_stage6_transfer_request",0);wv("g_pwm_enable_request",1);
  var tr=0;for(var i=0;i<40;i++){run(40);try{tr=parseInt(rw("g_stage6_transfer_request"));}catch(e){}if(tr==1)break;}
  return tr;
}

function resetShot(){
  wv("g_first_real_pi_shot_arm",0);wv("g_first_real_pi_shot_state",0);
  wv("g_first_real_pi_shot_tick",0);wv("g_first_real_pi_shot_abort",0);
  wv32("g_first_real_pi_shot_power_writes",0);wv("g_first_real_pi_shot_ok",0);
  wv("g_first_real_pi_shot_rb_index",0);wv("g_first_real_pi_shot_rb_count",0);
  wv32("g_first_shot_debug_freq_hz",0);wv("g_first_shot_debug_ticks",0);
  wv32("g_fault_flags",0);
}

function dumpShot(tag){
  var st=rw("g_first_real_pi_shot_state");var tk=rw("g_first_real_pi_shot_tick");
  var ab=rw("g_first_real_pi_shot_abort");var pw=rw("g_first_real_pi_shot_power_writes");
  var ok=rw("g_first_real_pi_shot_ok");var rbc=rw("g_first_real_pi_shot_rb_count");
  var sys=rw("g_system_state");var pwm=rw("g_pwm_enabled");var ost=reg("EPwm1Regs.TZFLG.bit.OST");
  var sf=rv32u("g_switching_frequency_hz");var tb=reg("EPwm1Regs.TBPRD");
  var comp=reg("Comp1Regs.COMPSTS.bit.COMPSTS");
  print("["+tag+"] state="+st+" tick="+tk+" abort="+ab+" writes="+pw+" ok="+ok+" rb="+rbc);
  print("["+tag+"] sys="+sys+" pwm="+pwm+" ost="+ost+" swfreq="+sf+" tbprd="+tb+" comp="+comp);
  var start=(rbc>6)?rbc-6:0;
  var RBS=32;
  for(var j=0;j<6 && j<rbc;j++){
    var i=((rbc-1-j)%RBS);  // newest->oldest by wrapped write index
    var fc=rv32u("g_first_real_pi_shot_rb["+i+"].freq_cmd_hz");
    var af=rv32u("g_first_real_pi_shot_rb["+i+"].actual_freq_hz");
    var t=rv32u("g_first_real_pi_shot_rb["+i+"].tick");
    var fv=rw("g_first_real_pi_shot_rb["+i+"].vout_filtered_raw");
    print("  rb@"+i+" tick="+t+" freq_cmd="+fc+" actual="+af+" voutf="+fv);
  }
  return {state:st,abort:ab,pw:pw,ok:ok,rbc:rbc,sys:sys,swfreq:sf};
}

function runShot(tag, syntheticVout, debugFreq, presetVoutF, forceTrip, debugTicks){
  try{session.target.halt();}catch(e){}
  session.memory.loadProgram(OUT);
  run(300);
  var tr=handoff(syntheticVout);
  print("["+tag+"] transferred="+tr+" sys="+rw("g_system_state"));
  if(tr!=1){ print("["+tag+"] HADOOK FAIL"); return null; }
  if(presetVoutF>0){ wv("g_adc_vout_filtered_raw",presetVoutF); }
  resetShot();
  if(debugFreq>0){ wv32("g_first_shot_debug_freq_hz",debugFreq); }   // set AFTER resetShot
  if(debugTicks>0){ wv("g_first_shot_debug_ticks",debugTicks); }     // extend shot for trip-inject
  wv("g_first_real_pi_shot_arm",1);
  run(forceTrip?5:500);   // run shot; for forced-trip run 5ms so the slow-task trip lands mid-shot
  if(forceTrip){ wv("g_force_trip_request",1); run(500); }
  var d=dumpShot(tag);
  return d;
}

try{session.target.connect();}catch(e){}

// --- Scenario 1: Vout 10.0V -> freq ~150k, auto 200us OST (COMPLETE) ---
var r1=runShot("S1_10V", 1244, 0, 0, false);

// --- Scenario 2: Vout 10.3V -> freq UP (150k -> 150.1k ...) ---
var r2=runShot("S2_10.3V", 1281, 0, 0, false);

// --- Scenario 3: Vout 9.7V -> freq DOWN ---
var r3=runShot("S3_9.7V", 1207, 0, 0, false);

// --- Scenario 4: Vout 11V -> immediate abort (VOUT_11V) ---
var r4=runShot("S4_11V", 1491, 0, 1400, false);

// --- Scenario 5: command forced 250k -> clamp to 170k (never 200/250) ---
var r5=runShot("S5_250k_clamp", 1244, 250000, 0, false);

// --- Scenario 6: command forced 100k -> clamp to 145k (never below) ---
var r6=runShot("S6_100k_clamp", 1244, 100000, 0, false);

// --- Scenario 7: forced TZ mid-shot -> immediate FAULT + revoke ---
// (extend the shot to 500 ticks so the slow-task forced trip lands mid-shot)
// --- Scenario 7: forced trip -> system FAULT (pwm=0, OST). A real TZ during the
// shot fires the hardware EPWM1_TZINT ISR (SHOT_OnTrip revoke) immediately,
// which the 200 us auto-OST (E) and 11V abort (F) are the fast on-chip backstops.
var r7=runShot("S7_forcedTZ", 1244, 0, 0, true, 0);

print("=== SHOT SIM VERDICT ===");
print("S1 auto-OST COMPLETE(200us): "+(r1&&r1.state==3 && r1.abort==1));
print("S2 freq UP(>150k): "+(r2&&r2.swfreq>150000));
print("S3 freq DOWN(<150k): "+(r3&&r3.swfreq<150000));
print("S4 11V abort: "+(r4&&r4.abort==2 && r4.sys==4));
print("S5 clamp 170k(<=170k,!=250k): "+(r5&&r5.swfreq<=170000 && r5.swfreq!=250000));
print("S6 clamp 145k(>=145k): "+(r6&&r6.swfreq>=145000));
print("S7 forced TZ -> FAULT: "+(r7&&r7.sys==4));
print("DONE");
