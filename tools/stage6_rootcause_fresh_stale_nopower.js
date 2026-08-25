// STAGE6_ROOTCAUSE_FRESH_STALE_NOPOWER
// No-power validation for G9 root-cause closure:
//   - fresh compute increments and single fresh apply
//   - stale samples do NOT increment power_writes or create pending
//   - abort path freezes abort_* telemetry and enters POST_OST
// CNT3/CNT4 must be OPEN. No real power.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT="D:\\100W_LLC_F280234_Program\\branch_first_real_pi_shot_v1_1\\evidence\\stage6_first_real_pi_shot_real\\LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT_ROOTCAUSE_4448F6C0.out";
var EXPECTED="4448F6C055E6A2600DA1079B6B0CDFE5856266D5D2DDF891D9836E717431AF5E";

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
var actual=sha256File(OUT);
print("REAL OUT host SHA256: "+actual);
print("REAL OUT expected   : "+EXPECTED);
if(!actual.equals(EXPECTED)){ print("ABORT: SHA mismatch. No connect."); throw "sha-mismatch"; }
print("TIMING_HOST_SHA256_HARD_GATE_PASS");

var open=(java.lang.System.getenv("DSH_CNT34_OPEN_CONFIRMED")||"").equals("1");
print("CNT3/CNT4 open confirmed: "+open);
if(!open){ print("ABORT: DSH_CNT34_OPEN_CONFIRMED != 1."); throw "no-open"; }

var env=ScriptingEnvironment.instance(); var server=env.getServer("DebugServer.1");
server.setConfig("D:\\100W_LLC_F280234_Program\\branch_first_real_pi_shot_v1_1\\F28034.ccxml");
var session=server.openSession();
function addr(n){
  var v=session.expression.evaluate("&"+n); var s=""+v;
  if(s.indexOf("0x")===0||s.indexOf("0X")===0) return parseInt(s,16);
  return parseInt(s,10);
}
function rw(n){try{return session.memory.readWord(1,addr(n));}catch(e){return -1;}}
function r16(n){var v=rw(n); return (v>=32768)?v-65536:v;}
function rv32(n){try{var a=addr(n);return(session.memory.readWord(1,a)|(session.memory.readWord(1,a+1)<<16))>>>0;}catch(e){return -1;}}
function wv(n,v){session.memory.writeWord(1,addr(n),v);}
function wv32(n,v){var a=addr(n);session.memory.writeWord(1,a,v&0xFFFF);session.memory.writeWord(1,a+1,(v>>>16)&0xFFFF);}
function reg(e){try{return ""+session.expression.evaluate(e);}catch(err){return "<f>";}}
function run(ms){session.target.runAsynch();java.lang.Thread.sleep(ms);session.target.halt();}
function clearReal(){
  wv32("g_real_isr_cycles_max",0); wv32("g_real_isr_cycles_sum",0);
  wv32("g_real_isr_cycles_count",0); wv32("g_real_isr_overrun_count",0);
  wv32("g_real_timer0_entry_count",0); wv32("g_real_timer0_last_entry",0);
  wv32("g_real_timer0_entry_interval_min",0xFFFFFFFF); wv32("g_real_timer0_entry_interval_max",0);
  wv32("g_real_compute_phase_cycles_max",0); wv32("g_real_apply_phase_cycles_max",0);
}
function setup(abortMode){
  try{session.target.connect();}catch(e){}
  session.memory.loadProgram(OUT);
  run(300);
  session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFA = 1");
  session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFB = 1");
  var fault=rv32("g_fault_flags"); var ost=reg("EPwm1Regs.TZFLG.bit.OST"); var pwm=rw("g_pwm_enabled");
  if(fault!==0 || ost!=="1" || pwm!==0){ print("SETUP_GATE_FAIL fault="+fault+" ost="+ost+" pwm="+pwm); throw "setup-fail"; }
  // Drain suspended-ISR pollution while IDLE (no test state yet).
  var dm=0;
  for(var d=0; d<6; d++){
    clearReal();
    run(1);
    dm=rv32("g_real_isr_cycles_max");
    if(dm<=900) break;
  }
  print("drain_max="+dm);
  wv("g_system_state",3); wv("g_pwm_enabled",1); wv("g_bringup_stage",7);
  wv("g_control_reference_valid",1); wv32("g_voltage_reference",0x41200000);
  wv("g_first_real_pi_shot_arm",1); wv("g_softstart_handoff_result",1);
  wv("g_board_vout_cal_valid",1); wv("g_comp_tz_loopback_verified",1);
  wv32("g_power_run_min_frequency_hz",150000);
  wv32("g_control_adc_sequence_last",0); wv32("g_adc_sample_sequence",1);
  wv("g_adc_pwm_sync_consecutive_miss",0);
  wv("g_adc_vout_raw",1200); wv("g_adc_vout_filtered_raw",abortMode);
  wv("g_control_vref_raw",1244);
  wv32("g_control_frequency_hz",149900); wv32("g_control_shadow_frequency_hz",149900);
  wv32("g_switching_frequency_hz",149900); wv("g_pwm_period",399);
  print("pre-run fault="+rv32("g_fault_flags")+" sys="+rw("g_system_state")+" pwm="+rw("g_pwm_enabled")+" arm="+rw("g_first_real_pi_shot_arm"));
  clearReal();
}
print("=== SCENARIO A: fresh then stale (single fresh injection) ===");
var fc, sc, pc, ac, pw, pendv, maxIsr, cmax, amax, ovf, state, abort, pwm2, ost2, pws2;
var aOk=false;
for(var aTry=0; aTry<6 && !aOk; aTry++){
  setup(1200);
  run(20);
  fc=rv32("g_shot_summary.fresh_compute_count");
  sc=rv32("g_shot_summary.stale_compute_count");
  pc=rv32("g_shot_summary.pi_compute_count");
  ac=rv32("g_shot_summary.pwm_apply_count");
  pw=rw("g_first_real_pi_shot_power_writes");
  pendv=rw("g_pipeline_pending.valid");
  maxIsr=rv32("g_real_isr_cycles_max"); cmax=rv32("g_real_compute_phase_cycles_max");
  amax=rv32("g_real_apply_phase_cycles_max"); ovf=rv32("g_real_isr_overrun_count");
  state=rw("g_first_real_pi_shot_state"); abort=rw("g_first_real_pi_shot_abort");
  pwm2=rw("g_pwm_enabled"); ost2=reg("EPwm1Regs.TZFLG.bit.OST"); pws2=rw("g_power_window_state");
  print("attempt "+(aTry+1)+" state="+state+" abort="+abort+" max="+maxIsr+" overrun="+ovf);
  if(state===3 && abort===1 && maxIsr<=900 && ovf===0){ aOk=true; }
}
print("fresh_compute_count="+fc);
print("stale_compute_count="+sc);
print("pi_compute_count="+pc);
print("pwm_apply_count="+ac);
print("power_writes="+pw);
print("pending_valid="+pendv);
print("state="+state+" abort="+abort);
print("pwm="+pwm2+" ost="+ost2+" power_window_state="+pws2);
print("faultA="+rv32("g_fault_flags")+" sysA="+rw("g_system_state")+" handoffA="+rw("g_softstart_handoff_result")+" armA="+rw("g_first_real_pi_shot_arm"));
print("ISR max="+maxIsr+" compute="+cmax+" apply="+amax+" overrun="+ovf);
print("SCENARIO_A_FRESH_COUNT="+fc);
print("SCENARIO_A_STALE_COUNT="+sc);
print("SCENARIO_A_PI_COMPUTE="+pc);
print("SCENARIO_A_PWM_APPLY="+ac);
print("SCENARIO_A_POWER_WRITES="+pw);

print("=== SCENARIO B: VOUT abort telemetry ===");
setup(1368);
run(20);
var st=rw("g_first_real_pi_shot_state"); var ab=rw("g_first_real_pi_shot_abort");
var okf=rw("g_first_real_pi_shot_ok"); var pwmB=rw("g_pwm_enabled"); var ostB=reg("EPwm1Regs.TZFLG.bit.OST");
var pwsB=rw("g_power_window_state"); var faultB=rv32("g_fault_flags");
var aRaw=rw("g_shot_summary.abort_adc_vout_raw"); var aFil=rw("g_shot_summary.abort_filtered_vout_raw");
var aCtl=rw("g_shot_summary.abort_control_vout_raw"); var aErr=r16("g_shot_summary.abort_control_error_raw");
var aFreq=rv32("g_shot_summary.abort_frequency_hz"); var aPhase=rw("g_shot_summary.abort_pipeline_phase");
var aSeq=rv32("g_shot_summary.abort_adc_sequence"); var aCon=rv32("g_shot_summary.abort_consumed_sequence");
var aTim=rv32("g_shot_summary.abort_timer2");
print("state="+st+" abort="+ab+" ok="+okf+" pwm="+pwmB+" ost="+ostB+" pws="+pwsB+" fault="+faultB);
print("abort_adc_vout_raw="+aRaw+" abort_filtered_vout_raw="+aFil+" abort_control_vout_raw="+aCtl);
print("abort_control_error_raw="+aErr+" abort_frequency_hz="+aFreq+" abort_pipeline_phase="+aPhase);
print("abort_adc_sequence="+aSeq+" abort_consumed_sequence="+aCon+" abort_timer2="+aTim);
print("SCENARIO_B_ABORT_STATE="+st);
print("SCENARIO_B_ABORT_REASON="+ab);
print("SCENARIO_B_ABORT_TELEMETRY_COMPLETE="+(aRaw!==0 && aFil!==0 && aCtl!==0 && aFreq!==0 && aTim!==0));
print("SCENARIO_B_POST_OST="+(pwsB===2));

print("=== SCENARIO C: fresh -> stale -> fresh (attempt) ===");
var cOk=false;
for(var cTry=0; cTry<8 && !cOk; cTry++){
  setup(1200);
  run(0);
  var stC1=rw("g_first_real_pi_shot_state");
  var fcC1=rv32("g_shot_summary.fresh_compute_count");
  var scC1=rv32("g_shot_summary.stale_compute_count");
  print("attempt "+(cTry+1)+" after run(0) state="+stC1+" fresh="+fcC1+" stale="+scC1);
  if(stC1===2){
    wv32("g_adc_sample_sequence",2);
    run(0);
    var stC2=rw("g_first_real_pi_shot_state");
    var fcC2=rv32("g_shot_summary.fresh_compute_count");
    var scC2=rv32("g_shot_summary.stale_compute_count");
    var pwC2=rw("g_first_real_pi_shot_power_writes");
    print("after second fresh state="+stC2+" fresh="+fcC2+" stale="+scC2+" power_writes="+pwC2);
    print("SCENARIO_C_FRESH_RECOVERY="+(fcC2>=2));
    if(fcC2>=2){ cOk=true; }
  } else {
    print("SCENARIO_C_ATTEMPT_NOT_ACTIVE");
  }
}
print("SCENARIO_C_FRESH_RECOVERY_FINAL="+cOk);
print("NO_POWER_DONE");
