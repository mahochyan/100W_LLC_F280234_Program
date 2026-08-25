// STAGE6_SINGLE_NEW_SHA_100OHM_CONFIRMATION_V1
// Single 500us real PI diagnostic with exact electronic-load CR 100.0 ohm.
// Operator-authorized single run:
//   CNT3/CNT4 = CONNECTED, Vin = 24V, current limit = 0.5A, load = CR 100.0 ohm,
//   DSH_LOAD_MODE_CR100_CONFIRMED=1, DSH_CNT34_CONNECTED_CONFIRMED=1,
//   DSH_SINGLE_CR100_500US_SHOT_AUTHORIZED=1.
// Flow: host SHA256 gate -> connect -> load frozen REAL OUT -> init ->
// comparator loopback request -> stage confirms 1..7 -> preflight (incl. natural
// discharge check, NO shorting) -> arm + formal enable request -> runAsynch with
// ZERO reads for 25 ms -> single black-box read -> strict PASS/FAIL.
// NO automatic advance to 1ms/5ms/continuous/12V.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT="D:\\100W_LLC_F280234_Program\\branch_first_real_pi_shot_v1_1\\evidence\\stage6_first_real_pi_shot_real\\LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT_V2_439E1BDF.out";
var EXPECTED="439E1BDF46C237AE4BCC1923289FBFB2F038AFE15EB5DF4FD9F82DECD1E07EF9";

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
// ---- host SHA256 hard gate (BEFORE connect) ----
var expected=EXPECTED;
var actual=sha256File(OUT);
print("REAL OUT host SHA256: "+actual);
print("Frozen 500us SHA   : "+expected);
if(!actual.equals(expected)){ print("ABORT: REAL OUT SHA256 mismatch. Refusing to connect."); print("REAL_SHOT_HOST_SHA256_HARD_GATE_FAIL"); throw "sha256-mismatch"; }
print("REAL_SHOT_HOST_SHA256_HARD_GATE_PASS");

// ---- operator auth env gate ----
var perm=(System.getenv("DSH_CNT34_PERMANENT_CONNECTED_CONFIRMED")||"").equals("1");
var cr100=(System.getenv("DSH_CR100_CONFIRMED")||"").equals("1");
var vin=(System.getenv("DSH_VIN24_LIMIT05A_CONFIRMED")||"").equals("1");
var op=(System.getenv("DSH_OPERATOR_PRESENT_CONFIRMED")||"").equals("1");
var auth=(System.getenv("DSH_SINGLE_BURST_RESTART_AUTHORIZED")||"").equals("1");
print("Permanent CNT34: "+perm+" CR100: "+cr100+" Vin24/0.5A: "+vin+" operator: "+op+" auth: "+auth);
if(!perm || !cr100 || !vin || !op || !auth){ print("ABORT: burst-restart real authorization gates not all 1."); throw "no-auth"; }

var env=ScriptingEnvironment.instance(); var server=env.getServer("DebugServer.1");
server.setConfig("D:\\100W_LLC_F280234_Program\\branch_first_real_pi_shot_v1_1\\F28034.ccxml");
var session=server.openSession();
function addr(n){return session.expression.evaluate("&"+n);}
function rw(n){try{return session.memory.readWord(1,addr(n));}catch(e){return -1;}}
function r16(n){var v=rw(n); return (v>=32768)?v-65536:v;}
function rv32(n){try{var a=addr(n);return(session.memory.readWord(1,a)|(session.memory.readWord(1,a+1)<<16))>>>0;}catch(e){return -1;}}
function reg(e){try{return ""+session.expression.evaluate(e);}catch(err){return "<f>";}}
function wv(n,v){session.memory.writeWord(1,addr(n),v);}
function run(ms){session.target.runAsynch();java.lang.Thread.sleep(ms);session.target.halt();}
function gate(name,cond){print("GATE "+name+": "+(cond?"PASS":"FAIL"));return cond;}
var fails=0; function chk(name,cond){if(!cond)fails++;return gate(name,cond);}

var ENUM_FAULT_COMP_TZ1=0x10;
var ENUM_FAULT_ADC_STALE_OVERFLOW=0x40;
var ENUM_SHOT_ABORT_TZ=3;
var ENUM_SHOT_ABORT_PERMISSION=6;

try{session.target.connect();}catch(e){}
session.memory.loadProgram(OUT);
run(300);

// ---- E4: post-init gates ----
var sys=rw("g_system_state"); var pwm=rw("g_pwm_enabled"); var fault=rv32("g_fault_flags");
var ost=reg("EPwm1Regs.TZFLG.bit.OST"); var voutcal=rw("g_board_vout_cal_valid");
var comp=rw("g_comp_tz_loopback_verified"); var stage=rw("g_bringup_stage");
print("post-init sys="+sys+" pwm="+pwm+" fault="+fault+" ost="+ost+" voutcal="+voutcal+" comp="+comp+" stage="+stage);
chk("INIT_SYS_IDLE", sys===1); chk("INIT_PWM_OFF", pwm===0);
chk("INIT_FAULT_ZERO", fault===0); chk("INIT_OST_LATCHED", ost==="1");
chk("INIT_VOUT_CAL_VALID", voutcal===1); chk("INIT_STAGE_ZERO", stage===0);
if(fails>0){ print("INIT_GATE_FAIL_NO_POWER"); throw "init-fail"; }

// ---- E5: comparator loopback request ----
wv("g_loopback_diag_request",1); run(60);
comp=rw("g_comp_tz_loopback_verified");
chk("PREFLIGHT_COMP_VERIFIED", comp===1);
if(fails>0){ throw "comp-fail"; }

// ---- E6/E7: sequential stage confirm 1..7 ----
// Enum: 5A=5, 5B=6, BRINGUP_STAGE_6_CLOSED_LOOP=7. Confirming only to 6 put
// the board in 5B, where SM_HandleEnable's 5B branch sets sys=SOFT_START and
// SoftStart_Update5ms() then REJECTS on its sys!=IDLE gate (result=7).
// Stage 7 (6_CLOSED_LOOP) is required for the formal Stage6 enable path.
for(var s=1;s<=7;s++){ wv("g_stage_confirm_request",s); run(60); }
stage=rw("g_bringup_stage");
print("stage after confirms="+stage);
chk("PREFLIGHT_STAGE6", stage===7); // BRINGUP_STAGE_6_CLOSED_LOOP == 7

if(fails>0){ throw "stage-fail"; }

// ---- E8: final preflight + NATURAL DISCHARGE check (no shorting) ----
var sys=rw("g_system_state"); var pwm=rw("g_pwm_enabled"); var fault=rv32("g_fault_flags");
var ost=reg("EPwm1Regs.TZFLG.bit.OST"); var arm=rw("g_first_real_pi_shot_arm");
var voutraw=rw("g_adc_vout_raw");
print("PREFLIGHT sys="+sys+" pwm="+pwm+" fault="+fault+" ost="+ost+" voutcal="+voutcal+" comp="+comp+" stage="+stage+" arm="+arm+" vout_raw="+voutraw);
chk("PREFL_SYS_IDLE", sys===1); chk("PREFL_PWM_OFF", pwm===0);
chk("PREFL_FAULT_ZERO", fault===0); chk("PREFL_OST_LATCHED", ost==="1");
chk("PREFL_VOUT_CAL", voutcal===1); chk("PREFL_ARM_CLEAR", arm===0);
chk("PRE_VOUT_DISCHARGED_NATURAL", voutraw>=0 && voutraw<300);
if(fails>0){ print("PREFLIGHT_GATE_FAIL_NO_POWER"); throw "preflight-fail"; }

// ---- E9: arm + formal enable request; then ZERO READS for 25 ms ----
wv("g_first_real_pi_shot_arm",1);
wv("g_pwm_enable_request",1);
print("REAL_SHOT_START arm=1 pwm_enable_request=1 (ZERO reads 25 ms)");
session.target.runAsynch();
java.lang.Thread.sleep(25);
session.target.halt();
print("REAL_SHOT_WAIT_DONE");

// ---- single black-box read-back ----
var st=rw("g_first_real_pi_shot_state"); var tk=rw("g_first_real_pi_shot_tick");
var ab=rw("g_first_real_pi_shot_abort"); var okf=rw("g_first_real_pi_shot_ok");
var pw=rw("g_first_real_pi_shot_power_writes");
var fw=rv32("g_first_real_pi_shot_first_write_timer2"); var ostt=rv32("g_first_real_pi_shot_ost_timer2");
var sys2=rw("g_system_state"); var pwm2=rw("g_pwm_enabled"); var fault2=rv32("g_fault_flags");
var pres2=rw("g_pwm_enable_result"); var pws2=rw("g_power_window_state");
var ost2=reg("EPwm1Regs.TZFLG.bit.OST"); var int2=reg("EPwm1Regs.TZFLG.bit.INT");
var ssres=rw("g_softstart_result"); var hres=rw("g_softstart_handoff_result");
var t2d=(fw-ostt)>>>0;
var sfirst=rv32("g_shot_summary.first_command_hz"); var stbprd=rw("g_shot_summary.first_tbprd");
var sact=rv32("g_shot_summary.first_actual_hz"); var slast=rv32("g_shot_summary.last_command_hz");
var smin=rv32("g_shot_summary.min_command_hz"); var smax=rv32("g_shot_summary.max_command_hz");
var smv=rw("g_shot_summary.max_vout_raw"); var sfk=rv32("g_shot_summary.fast_ticks");
var spc=rv32("g_shot_summary.pi_compute_count"); var sac=rv32("g_shot_summary.pwm_apply_count");
var sab=rw("g_shot_summary.abort_reason");
var isrMax=rv32("g_real_isr_cycles_max"); var cMax=rv32("g_real_compute_phase_cycles_max");
var aMax=rv32("g_real_apply_phase_cycles_max"); var ovf=rv32("g_real_isr_overrun_count");
var tMax=rv32("g_real_timer0_entry_interval_max"); var iCnt=rv32("g_real_isr_cycles_count");
var sEntryMax=rv32("g_shot_summary.entry_interval_max_shot");
var sErrFirst=r16("g_shot_summary.first_error_raw");
var sErrLast=r16("g_shot_summary.last_error_raw");
var sErrMin=r16("g_shot_summary.min_error_raw");
var sErrMax=r16("g_shot_summary.max_error_raw");
var abortRaw=rw("g_first_real_pi_shot_abort_vout_raw"); var errRaw=r16("g_control_error_raw");
print("shot state="+st+" tick="+tk+" abort="+ab+" ok="+okf+" power_writes="+pw);
print("first_write_timer2="+fw+" ost_timer2="+ostt+" timer2_delta="+t2d);
print("post sys="+sys2+" pwm="+pwm2+" pwm_enable_result="+pres2+" power_window_state="+pws2+" fault="+fault2+" ost="+ost2+" int="+int2+" softstart="+ssres+" handoff="+hres);
print("summary first_cmd="+sfirst+" tbprd="+stbprd+" actual="+sact+" last="+slast+" min="+smin+" max="+smax+" max_vout_raw="+smv+" fast_ticks="+sfk+" pi="+spc+" apply="+sac+" abort_reason="+sab);
print("ISR max="+isrMax+" compute="+cMax+" apply="+aMax+" overrun="+ovf+" global_entry_max="+tMax+" shot_entry_max="+sEntryMax+" count="+iCnt);
print("shot_error first="+sErrFirst+" last="+sErrLast+" min="+sErrMin+" max="+sErrMax+" (global control_error_raw="+errRaw+")");
print("abort_vout_raw="+abortRaw);

// ---- new freshness/abort telemetry ----
var fcc=rv32("g_shot_summary.fresh_compute_count");
var scc=rv32("g_shot_summary.stale_compute_count");
var firstSeq=rv32("g_shot_summary.first_adc_sample_sequence");
var lastSeq=rv32("g_shot_summary.last_adc_sample_sequence");
var firstCon=rv32("g_shot_summary.first_consumed_sequence");
var lastCon=rv32("g_shot_summary.last_consumed_sequence");
var pv=rw("g_pipeline_pending.valid");
var slMax=rv32("g_shot_summary.max_command_hz");
print("fresh_compute_count="+fcc+" stale_compute_count="+scc);
print("seq first="+firstSeq+" last="+lastSeq+" consumed first="+firstCon+" last="+lastCon);
print("pending_valid="+pv+" max_cmd="+slMax);

// ---- full abort telemetry + entry interval stats ----
var aRaw=rw("g_shot_summary.abort_adc_vout_raw");
var aFil=rw("g_shot_summary.abort_filtered_vout_raw");
var aCtl=rw("g_shot_summary.abort_control_vout_raw");
var aErr=r16("g_shot_summary.abort_control_error_raw");
var aFreq=rv32("g_shot_summary.abort_frequency_hz");
var aPhase=rw("g_shot_summary.abort_pipeline_phase");
var aSeq=rv32("g_shot_summary.abort_adc_sequence");
var aCon=rv32("g_shot_summary.abort_consumed_sequence");
var aTim=rv32("g_shot_summary.abort_timer2");
var eMin=rv32("g_shot_summary.entry_interval_min_shot");
var eMax=rv32("g_shot_summary.entry_interval_max_shot");
var e1230=rv32("g_shot_summary.entry_over_1230_count");
var e1500=rv32("g_shot_summary.entry_over_1500_count");
var e2400=rv32("g_shot_summary.entry_over_2400_count");
var eAdj=rv32("g_shot_summary.entry_adjacent_max_shot");
print("abort_adc_vout_raw="+aRaw+" abort_filtered_vout_raw="+aFil+" abort_control_vout_raw="+aCtl);
print("abort_control_error_raw="+aErr+" abort_frequency_hz="+aFreq+" abort_pipeline_phase="+aPhase);
print("abort_adc_sequence="+aSeq+" abort_consumed_sequence="+aCon+" abort_timer2="+aTim);
print("entry min="+eMin+" max="+eMax+" over1230="+e1230+" over1500="+e1500+" over2400="+e2400+" adjacent_max="+eAdj);

// ---- TZ fast postmortem snapshot ----
var tzGpio=rw("g_tz_isr_gpio15"); var tzComp=rw("g_tz_isr_compsts"); var tzFlg=rw("g_tz_isr_tzflg"); var tzPhase=rw("g_tz_event_phase"); var tzTbctr=rw("g_tz_isr_tbctr"); var tzTimer=rv32("g_tz_isr_timer2");
var compDac=rw("g_comp_trip_dac_code"); var compTbctr=rw("g_comp_trip_tbctr"); var compVout=rw("g_comp_trip_vout_raw");
var accPhase=rw("g_accel_trip_phase"); var accPeriod=rw("g_accel_trip_period"); var accCmpa=rw("g_accel_trip_cmpa"); var accDb=rw("g_accel_trip_db"); var accCycles=rv32("g_accel_trip_completed_cycles"); var accStop=rw("g_accel_stop_reason");
var hwTrip=rv32("g_tz_hardware_trip_count"); var actTrip=rv32("g_tz_active_window_trip_count"); var postTrip=rv32("g_tz_post_ost_trip_count"); var softOst=rv32("g_tz_software_ost_count"); var softPending=rw("g_software_ost_pending"); var softTimer=rv32("g_software_ost_timer2"); var softConsumed=rv32("g_software_ost_consumed_count"); var softLate=rv32("g_software_ost_late_isr_count");
print("TZ_GPIO15="+tzGpio+" TZ_COMPSTS="+tzComp+" TZ_TZFLG="+tzFlg+" TZ_PHASE="+tzPhase+" TZ_TBCTR="+tzTbctr+" TZ_TIMER2="+tzTimer);
print("COMP_DAC="+compDac+" COMP_TBCTR="+compTbctr+" COMP_VOUT="+compVout);
print("ACC_PHASE="+accPhase+" ACC_PERIOD="+accPeriod+" ACC_CMPA="+accCmpa+" ACC_DB="+accDb+" ACC_CYCLES="+accCycles+" ACC_STOP="+accStop);
print("HW_TRIP="+hwTrip+" ACT_TRIP="+actTrip+" POST_TRIP="+postTrip+" SOFT_OST="+softOst+" SOFT_PENDING="+softPending+" SOFT_TIMER="+softTimer+" SOFT_CONSUMED="+softConsumed+" SOFT_LATE="+softLate);

// ---- Burst restart counters ----
var bEnter=rv32("g_burst_enter_count"); var bExit=rv32("g_burst_exit_count"); var bAttempt=rv32("g_burst_restart_attempt_count"); var bSuccess=rv32("g_burst_restart_success_count"); var bFail=rv32("g_burst_restart_fail_count"); var bState=rw("g_burst_state"); var bPre=rw("g_burst_restart_pre_ost"); var bPost=rw("g_burst_restart_post_ost"); var bDelta=rv32("g_burst_entry_to_restart_delta"); var hwDelta=rv32("g_tz_hardware_trip_count")-rv32("g_burst_entry_hw_trip_count"); var actDelta=rv32("g_tz_active_window_trip_count")-rv32("g_burst_entry_active_trip_count");
print("BURST enter="+bEnter+" exit="+bExit+" attempt="+bAttempt+" success="+bSuccess+" fail="+bFail+" state="+bState+" pre="+bPre+" post="+bPost+" delta="+bDelta+" hwDelta="+hwDelta+" actDelta="+actDelta);

// ---- strict PASS gates (Burst restart) ----
chk("SHOT_STATE_COMPLETE", st===3);
chk("ABORT_BURST_RESTART_DONE", ab===10);
chk("SUMMARY_ABORT_REASON_10", sab===10);
chk("OK", okf===1);
chk("SOFTSTART_COMPLETE", ssres===1);
chk("HANDOFF_OK", hres===1);
chk("VOUT_MAX_BELOW_11V", smv < abortRaw);
chk("FAULT_ZERO_END", fault2===0);
chk("TZ_ACTIVE_ZERO", int2==="0" && ost2==="1");
chk("ISR_MAX_LE_900", isrMax<=900);
chk("COMPUTE_MAX_LE_900", cMax<=900);
chk("APPLY_MAX_LE_900", aMax<=900);
chk("OVERRUN_ZERO", ovf===0);
chk("FREQ_MIN_145K", smin>=145000);
chk("FREQ_MAX_170K", smax<=170000);
chk("BURST_ENTER_1", bEnter===1);
chk("BURST_EXIT_1", bExit===1);
chk("BURST_ATTEMPT_1", bAttempt===1);
chk("BURST_SUCCESS_1", bSuccess===1);
chk("BURST_FAIL_0", bFail===0);
chk("BURST_STATE_FINAL_SAFE_STOP", bState===5);
chk("RESTART_PRE_OST_1", bPre===1);
chk("RESTART_POST_OST_0", bPost===0);
chk("RESTART_DELTA_LT_30000", bDelta>0 && bDelta<30000);
chk("HW_TRIP_DELTA_ZERO", hwDelta===0);
chk("ACTIVE_TRIP_DELTA_ZERO", actDelta===0);
chk("PENDING_FINAL_INVALID", pv===0);
chk("FINAL_PWM_ZERO", pwm2===0);
chk("FINAL_OST_1", ost2==="1");
chk("POWER_WINDOW_POST_OST", pws2===2);
if (fails===0) { print("STAGE6_NO_SCOPE_DIAGNOSTIC_PASS"); }
else { print("STAGE6_NO_SCOPE_DIAGNOSTIC_FAIL"); }
print("NO_SCOPE_DIAGNOSTIC_DONE");
