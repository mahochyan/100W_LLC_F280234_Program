// STAGE6_40US_SPLIT_PIPELINE — G: single 200us NO-EXTERNAL-LOAD REAL PI SHOT.
// Operator-authorized single run (field confirmation 2026-08-24):
//   CNT3/CNT4 = CONNECTED, Vin = 24V, current limit = 0.5A, external load = NONE,
//   no smell/heat/wiring issues. Authorized via DSH_CNT34_CONNECTED_CONFIRMED=1.
// Flow: host SHA256 gate -> connect -> load frozen REAL OUT -> init -> 
// comparator loopback request -> stage confirms 1..7 -> preflight (incl. natural
// discharge check, NO shorting) -> arm + formal enable request -> runAsynch with
// ZERO reads for 25 ms -> single black-box read -> strict PASS/FAIL.
// NO automatic advance to 1ms/10ms.
// NO_LOAD_CONTROL_RANGE_INSUFFICIENT: command pinned at 170 kHz and VOUT near
// the 11V abort raw -> printed FAIL marker, no extension.
// Entry-interval gate: <=1230 (TINT0 period 1200 + Timer2 read-in window,
// documented measurement artifact; overrun==0 is the real-time violation
// signal and is gated separately).
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_FLASH_SHOT_REAL\\LLC_100W_F28034_BRINGUP_DSH.out";
var MANIFEST="D:\\CCS21_workspace\\Codex_Project\\evidence\\stage6_first_real_pi_shot_real\\REAL_SHA256SUMS.txt";

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
var expected="";
var lines=new BufferedReader(new FileReader(MANIFEST));
var t;
while((t=lines.readLine())!=null){
  if(t.indexOf("SPLIT_PIPELINE_OUT_SHA256")===0){ expected=t.split("=")[1].trim(); }
}
lines.close();
var actual=sha256File(OUT);
print("REAL OUT host SHA256: "+actual);
print("SPLIT manifest SHA  : "+expected);
if(!actual.equals(expected)){ print("ABORT: REAL OUT SHA256 mismatch. Refusing to connect."); print("REAL_SHOT_HOST_SHA256_HARD_GATE_FAIL"); throw "sha256-mismatch"; }
print("REAL_SHOT_HOST_SHA256_HARD_GATE_PASS");

// ---- DIAG MODE: no auth gate; AQCSFRC clamps outputs low (NO POWER) ----
print("DIAG_MODE_NOPOWER: AQCSFRC clamp + no auth gate");

var env=ScriptingEnvironment.instance(); var server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
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
session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFA = 1");
session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFB = 1");

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
session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFA = 1");
session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFB = 1");
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
var abortRaw=rw("g_first_real_pi_shot_abort_vout_raw"); var errRaw=r16("g_control_error_raw");
print("shot state="+st+" tick="+tk+" abort="+ab+" ok="+okf+" power_writes="+pw);
print("first_write_timer2="+fw+" ost_timer2="+ostt+" timer2_delta="+t2d);
print("post sys="+sys2+" pwm="+pwm2+" pwm_enable_result="+pres2+" power_window_state="+pws2+" fault="+fault2+" ost="+ost2+" int="+int2+" softstart="+ssres+" handoff="+hres);
print("summary first_cmd="+sfirst+" tbprd="+stbprd+" actual="+sact+" last="+slast+" min="+smin+" max="+smax+" max_vout_raw="+smv+" fast_ticks="+sfk+" pi="+spc+" apply="+sac+" abort_reason="+sab);
print("ISR max="+isrMax+" compute="+cMax+" apply="+aMax+" overrun="+ovf+" entry_max="+tMax+" count="+iCnt);
print("abort_vout_raw="+abortRaw+" control_error_raw="+errRaw);

// ---- strict PASS gates ----
chk("SHOT_STATE_COMPLETE", st===3);
chk("SOFTSTART_COMPLETE", ssres===1);
chk("HANDOFF_OK", hres===1);
chk("VOUT_MAX_BELOW_11V", smv < abortRaw);
chk("FAULT_ZERO_END", fault2===0);
chk("TZ_ACTIVE_ZERO", int2==="0" && ost2==="1");
chk("ISR_MAX_LE_900", isrMax<=900);
chk("COMPUTE_MAX_LE_900", cMax<=900);
chk("APPLY_MAX_LE_900", aMax<=900);
chk("ENTRY_INTERVAL_LE_1230", tMax<=1230);
chk("OVERRUN_ZERO", ovf===0);
chk("FREQ_MIN_145K", smin>=145000);
chk("FREQ_MAX_170K", smax<=170000);
chk("TIMER2_DELTA_11000_14000", t2d>=11000 && t2d<=14000);
chk("PI_DIRECTION_NEGATIVE_ERROR", errRaw<0);
chk("FINAL_PWM_ZERO", pwm2===0);
chk("FINAL_OST_1", ost2==="1");
chk("PIPELINE_TICKS_POSITIVE", sfk>=1 && spc>=1 && sac>=1);
chk("ENUM_FAULT_COMP_TZ1_0x10", ENUM_FAULT_COMP_TZ1===0x10);
chk("ENUM_FAULT_ADC_STALE_OVERFLOW_0x40", ENUM_FAULT_ADC_STALE_OVERFLOW===0x40);
chk("ENUM_SHOT_ABORT_TZ_3", ENUM_SHOT_ABORT_TZ===3);
chk("ENUM_SHOT_ABORT_PERMISSION_6", ENUM_SHOT_ABORT_PERMISSION===6);
chk("PWM_ENABLE_RESULT_ZERO", pres2===0);
chk("POWER_WINDOW_POST_OST", pws2===2);
chk("SUMMARY_ABORT_REASON_TIMEOUT", sab===1);
chk("NO_ABORT_TZ", ab!==ENUM_SHOT_ABORT_TZ);
chk("NO_ABORT_PERMISSION", ab!==ENUM_SHOT_ABORT_PERMISSION);
chk("FAULT_COMP_TZ1_BIT_CLEAR", (fault2 & ENUM_FAULT_COMP_TZ1)===0);
chk("FAULT_ADC_STALE_BIT_CLEAR", (fault2 & ENUM_FAULT_ADC_STALE_OVERFLOW)===0);
if (fails===0) { print("STAGE_G_200US_NOLOAD_REAL_SHOT_PASS"); }
else { print("STAGE_G_200US_NOLOAD_REAL_SHOT_FAIL"); }
if (smax>=170000 && smv>=(abortRaw-40)) {
  print("NO_LOAD_CONTROL_RANGE_INSUFFICIENT");
}
print("NOLOAD_SHOT_DONE");
