// W2_BURST_LIVE_TAKEOVER_PACKET_V1 on-target no-energy proof.
//
// The host fakes the already-proven formal SoftStart PHASE_B/stage-10 state
// while hardware outputs remain clamped by OST. Firmware must take ownership
// without a cold restart, commit 170 kHz, discard the transition boundary,
// count exactly 1/2/3/5 full periods, and terminate with planned OST.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_OL_STEADY_NE\\LLC_100W_F28034_OPEN_LOOP_STEADY_NE.out";
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
function check(name,ok){ print(name+"="+(ok?"TRUE":"FALSE")); if(!ok) failures++; }

var failures=0;
print("=== SOL W2 LIVE TAKEOVER PACKET NOENERGY ===");
session.target.connect();
try{session.target.halt();}catch(e){}
session.memory.loadProgram(OUT);
run(400);

check("PRE_OST_LOCKED",reg("EPwm1Regs.TZFLG.bit.OST")==1);
check("PRE_PWM_DISABLED",rw("g_pwm_enabled")==0);
check("PRE_FAULT_CLEAR",rv32u("g_fault_flags")==0);
check("PRE_PACKET_IDLE",rw("g_open_loop_live_packet_state")==0);
if(failures){
  print("SOL_W2_LIVE_TAKEOVER_PACKET_NOENERGY_PASS=FALSE");
  try{session.terminate();}catch(e){}
  throw("PRE_GATE");
}

wv("g_no_energy_test_mode",1);
wv("g_open_loop_ne_test_enable",1);
wv("g_open_loop_ne_actuator_arm",1);
wv32("g_open_loop_freq_slew_hz_per_sample",500);

function prepare(n,injectFault){
  wv32("g_fault_flags",0);
  wv("g_open_loop_stop_reason",0);
  wv("g_open_loop_steady_active",0);
  wv("g_open_loop_phase",0);
  wv("g_open_loop_takeover_done",0);
  wv("g_open_loop_takeover_armed",1);
  wv("g_open_loop_stop_on_takeover",0);
  wv("g_open_loop_live_packet_arm",1);
  wv("g_open_loop_live_packet_cycles",n);
  wv("g_open_loop_live_packet_state",0);
  wv("g_open_loop_live_packet_result",0);
  wv32("g_open_loop_live_packet_completed_cycles",0);
  wv32("g_open_loop_frequency_command_hz",170000);
  wv("g_open_loop_live_packet_ne_fault_first",injectFault?1:0);
  wv("g_open_loop_ne_raw",718);
  wv("g_adc_vout_raw",718);
  wv("g_adc_vout_filtered_raw",718);
  wv("g_system_state",2);             // SYS_STATE_SOFT_START
  wv("g_pwm_enabled",1);              // fake live trajectory; OST stays latched
  wv("g_pwm_enable_result",1);
  wv("g_softstart_state",8);          // SOFTSTART_PHASE_B
  wv("g_softstart_ramp_active",1);
  wv("g_softstart_stage_index",10);   // TBPRD 339, about 176.47 kHz
  wv("g_pwm_period",339);
  wv32("g_switching_frequency_hz",176470);
  wv32("g_actual_switching_frequency_hz",176470);
}

function endState(tag){
  check(tag+"_PWM0",rw("g_pwm_enabled")==0);
  check(tag+"_OST1",reg("EPwm1Regs.TZFLG.bit.OST")==1);
  check(tag+"_TZINT0",reg("EPwm1Regs.TZFLG.bit.INT")==0);
  check(tag+"_INACTIVE",rw("g_open_loop_steady_active")==0);
}

var authorized=[1,2,3,5];
for(var i=0;i<authorized.length;i++){
  var n=authorized[i];
  prepare(n,false);
  run(2);
  var tag=n+"C";
  if(i==0){
    print("DBG state="+rw("g_open_loop_live_packet_state")+
          " completed="+rv32u("g_open_loop_live_packet_completed_cycles")+
          " inten="+reg("EPwm1Regs.ETSEL.bit.INTEN")+
          " intflg="+reg("EPwm1Regs.ETFLG.bit.INT")+
          " intcnt="+reg("EPwm1Regs.ETPS.bit.INTCNT")+
          " pieier3="+reg("PieCtrlRegs.PIEIER3.bit.INTx1")+
          " pieifr3="+reg("PieCtrlRegs.PIEIFR3.bit.INTx1")+
          " ier="+reg("IER")+" ifr="+reg("IFR")+
          " tbctr="+reg("EPwm1Regs.TBCTR"));
  }
  check(tag+"_TAKEOVER",rw("g_open_loop_takeover_done")==1);
  check(tag+"_SS_PARKED",rw("g_softstart_state")==4 && rw("g_softstart_ramp_active")==0);
  check(tag+"_RESULT_PASS",rw("g_open_loop_live_packet_result")==1);
  check(tag+"_STATE_DONE",rw("g_open_loop_live_packet_state")==4);
  check(tag+"_EXACT_COMPLETED",rv32u("g_open_loop_live_packet_completed_cycles")==n);
  check(tag+"_STOP_REASON",rw("g_open_loop_stop_reason")==7);
  check(tag+"_TRANSITION_TBPRD_352",rw("g_open_loop_live_packet_transition_tbprd")==352);
  check(tag+"_TRANSITION_ACTUAL_169971",Math.abs(rv32u("g_open_loop_live_packet_transition_hz")-169971)<=1);
  check(tag+"_TAKEOVER_FREQ_176470",Math.abs(rv32u("g_open_loop_takeover_freq_hz")-176470)<=1);
  check(tag+"_VOUT_BOUNDED",rw("g_open_loop_live_packet_vout_peak")<1304);
  check(tag+"_TIMER_ORDER",rv32u("g_open_loop_live_packet_start_timer2")!=rv32u("g_open_loop_live_packet_stop_timer2"));
  check(tag+"_FAULT0",rv32u("g_open_loop_live_packet_fault")==0 && rv32u("g_fault_flags")==0);
  check(tag+"_FINAL_OST1",rw("g_open_loop_live_packet_final_ost")==1);
  check(tag+"_DB36",reg("EPwm1Regs.DBRED")==36 && reg("EPwm1Regs.DBFED")==36);
  endState(tag);
}

// Invalid cycle count is consumed and rejected before any packet boundary.
prepare(4,false);
run(2);
check("4C_REJECT_RESULT",rw("g_open_loop_live_packet_result")==3);
check("4C_REJECT_STATE",rw("g_open_loop_live_packet_state")==5);
check("4C_REJECT_NO_COUNT",rv32u("g_open_loop_live_packet_completed_cycles")==0);
check("4C_REJECT_REASON",rw("g_open_loop_stop_reason")==8);
check("4C_REJECT_FAULT0",rv32u("g_fault_flags")==0);
endState("4C_REJECT");

// A fault at the first countable boundary aborts before cycle 1 completes.
prepare(5,true);
run(2);
check("FAULT1_RESULT",rw("g_open_loop_live_packet_result")==2);
check("FAULT1_STATE",rw("g_open_loop_live_packet_state")==5);
check("FAULT1_ZERO_COMPLETED",rv32u("g_open_loop_live_packet_completed_cycles")==0);
check("FAULT1_BIT",(rv32u("g_open_loop_live_packet_fault")&0x40000000)!=0);
check("FAULT1_STOP_EXTERNAL",rw("g_open_loop_stop_reason")==5);
endState("FAULT1");

wv32("g_fault_flags",0);
wv("g_open_loop_live_packet_ne_fault_first",0);
print("SOL_W2_LIVE_TAKEOVER_PACKET_NOENERGY_PASS="+(failures==0?"TRUE":"FALSE"));
try{session.terminate();}catch(e){}
if(failures){ throw("LIVE_TAKEOVER_PACKET_NE_FAILURES="+failures); }
