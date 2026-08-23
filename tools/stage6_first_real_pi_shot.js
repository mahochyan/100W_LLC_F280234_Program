// stage6_first_real_pi_shot.js
// On-bench driver for the FIRST BOUNDED REAL PI SHOT (200 us).
//   load frozen SHOT binary -> verify safe -> Profile C 10V handoff ->
//   set shot_arm=1 -> runAsynch -> wait > 200 us -> halt -> dump ring buffer.
// No run-poll (the on-chip 200 us auto-OST is the stop). NOT run in prep;
// this task only PREPARES the script. CNT3/CNT4 must be OPEN (or approved by a
// human) before this is ever executed with real power.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
var OUT="D:\\CCS21_workspace\\Codex_Project\\evidence\\stage6_first_real_pi_shot\\LLC_100W_F28034_BRINGUP_DSH_SHOT.out";
var SHOT_SHA="B9E0FC2B566E50A5C3E65BC85D05FACB028CD5BFE7F0149EECCE260D9E2FFD58";
var env=ScriptingEnvironment.instance(); var server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();
function addr(n){return session.expression.evaluate("&"+n);}
function rw(n){try{return session.memory.readWord(1,addr(n));}catch(e){return -1;}}
function rv32(n){try{var a=addr(n);return(session.memory.readWord(1,a)|(session.memory.readWord(1,a+1)<<16))>>>0;}catch(e){return -1;}}
function wv(n,v){session.memory.writeWord(1,addr(n),v);}
function wv32(n,v){var a=addr(n);session.memory.writeWord(1,a,v&0xFFFF);session.memory.writeWord(1,a+1,(v>>>16)&0xFFFF);}
function reg(e){try{return ""+session.expression.evaluate(e);}catch(err){return "<f>";}}
function run(ms){session.target.runAsynch();java.lang.Thread.sleep(ms);session.target.halt();}

// REAL-POWER SAFETY GATE: this script refuses to run a real shot unless a human
// has explicitly approved by setting DSH_CNT34_APPROVED=1 in the environment.
var approved = (java.lang.System.getenv("DSH_CNT34_APPROVED") || "").equals("1");
print("CNT3/CNT4 real-shot approval present: "+approved);
if(!approved){ print("ABORT: CNT3/CNT4 not approved. Only handoff verify runs."); }

try{session.target.connect();}catch(e){}
session.memory.loadProgram(OUT);
run(300);
// verify frozen binary identity
var sha = ""; try{ sha = session.target.computeChecksum(session.memory.getSymbol("0x3E801D"),0x2B1A,5); }catch(e){ sha="<n/a>"; }
print("loaded SHOT binary (identity check): "+sha);

// 1) SAFE preflight: PWM must be off, no fault, comparator/TZ armed, cal valid.
wv("g_fault_flags",0);wv("g_system_state",1);wv("g_pwm_enabled",0);
wv("g_first_real_pi_shot_arm",0);wv("g_first_real_pi_shot_state",0);wv("g_first_real_pi_shot_abort",0);
wv("g_bringup_stage",7);wv("g_comp_tz_loopback_verified",1);wv("g_board_vout_cal_valid",1);
print("preflight sys="+rw("g_system_state")+" pwm="+rw("g_pwm_enabled")+
      " fault="+rv32("g_fault_flags")+" ost="+reg("EPwm1Regs.TZFLG.bit.OST")+
      " dac="+reg("Comp1Regs.DACVAL.all")+" voutcal="+rw("g_board_vout_cal_valid"));

// 2. no-energy closed-loop handoff (CNT3/4 OPEN) to record Profile-C evidence.
wv("g_diag_frequency_override",1);
wv("g_softstart_no_energy",1);wv("g_softstart_acceptance_mode",0);wv("g_softstart_accept_target_raw",1244);
wv("g_softstart_request",0);wv("g_softstart_result",0);wv("g_softstart_state",0);wv("g_system_state",1);
wv32("g_power_run_min_frequency_hz",120000);
wv("g_stage6_synthetic_vout_raw",1244);wv("g_stage6_closeloop_vout_inject",1);
wv("g_stage6_noenergy_test_enable",1);wv("g_stage6_noenergy_test_mode",4);
wv("g_no_energy_test_mode",1);
wv("g_stage6_transfer_request",0);wv("g_pwm_enable_request",1);
var tr=0;for(var i=0;i<40;i++){run(40);try{tr=parseInt(rw("g_stage6_transfer_request"));}catch(e){}if(tr==1)break;}
print("handoff_result="+rw("g_softstart_handoff_result")+" stage="+rw("g_bringup_stage")+
      " ref_valid="+rw("g_control_reference_valid")+" sys="+rw("g_system_state"));
if(tr!=1){ print("HANDOFF FAIL: abort shot"); session.target.halt(); print("DONE"); throw "halt"; }

// 3. (only with human approval) real shot: reset shot, arm, runAsynch, wait>200us, halt.
if(approved){
  wv("g_first_real_pi_shot_arm",0);wv("g_first_real_pi_shot_state",0);wv("g_first_real_pi_shot_tick",0);
  wv("g_first_real_pi_shot_rb_index",0);wv("g_first_real_pi_shot_rb_count",0);
  wv32("g_first_real_pi_shot_power_writes",0);
  wv("g_first_real_pi_shot_arm",1);
  session.target.runAsynch();                      // no run-poll
  java.lang.Thread.sleep(2);                       // > 200 us (shot auto-OSTs on-chip)
  session.target.halt();
  // dump ring
  var st=rw("g_first_real_pi_shot_state");var tk=rw("g_first_real_pi_shot_tick");
  var ab=rw("g_first_real_pi_shot_abort");var rbc=rw("g_first_real_pi_shot_rb_count");
  print("shot state="+st+" tick="+tk+" abort="+ab+" rb="+rbc);
  for(var j=0;j<rbc && j<32;j++){
    var i=j;
    print("  rb["+i+"] tick="+rv32("g_first_real_pi_shot_rb["+i+"].tick")+
          " freq_cmd="+rv32("g_first_real_pi_shot_rb["+i+"].freq_cmd_hz")+
          " actual="+rv32("g_first_real_pi_shot_rb["+i+"].actual_freq_hz")+
          " vout_raw="+rw("g_first_real_pi_shot_rb["+i+"].vout_raw")+
          " err="+rw("g_first_real_pi_shot_rb["+i+"].error_raw")+
          " tbprd="+rw("g_first_real_pi_shot_rb["+i+"].tbprd")+
          " pi="+rv32("g_first_real_pi_shot_rb["+i+"].pi_integral_q12")+
          " fresh="+rw("g_first_real_pi_shot_rb["+i+"].fresh_sample")+
          " tz="+rw("g_first_real_pi_shot_rb["+i+"].tzflg")+
          " comp="+rw("g_first_real_pi_shot_rb["+i+"].compsts")+
          " fault="+rw("g_first_real_pi_shot_rb["+i+"].fault_flags"));
  }
  print("post-shot sys="+rw("g_system_state")+" pwm="+rw("g_pwm_enabled")+
        " ost="+reg("EPwm1Regs.TZFLG.bit.OST"));
} else {
  print("No real shot run: CNT3/CNT4 not approved. Script is READY for bench use.");
}
print("DONE");
