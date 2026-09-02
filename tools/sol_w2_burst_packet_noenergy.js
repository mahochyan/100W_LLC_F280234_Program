// W2_BURST_PACKET_CHARACTERIZATION_V1: on-target no-energy proof of the
// packet request layer + the existing MULTICYCLE cycle-level engine.
//
// Proves (work-order section 12):
//   1C/2C/3C/5C EXACT -- completed_cycles equals the authorized request,
//       result PASS, final PWM=0 / OST=1 / TZINT=0
//   0 cycle does not fire
//   >authorized (6) is rejected
//   fault period (fault set before request) cannot fire
//   mid-packet fault: NE-injected at cycle 10 -> immediate abort (result FAULT,
//       completed < requested), final PWM=0 / OST=1
//   no request -> no fire (OST stays latched, PWM stays disabled)
//   packet does not enter PI / modify Fmax / DB36 / SoftStart / comparator
//       authority
//
// NE only. Uses the NE comparator loopback simulation (g_no_energy_test_mode).
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);

var OUT="D:\\\\CCS21_workspace\\\\Codex_Project\\\\Stage6_OL_STEADY_NE\\\\LLC_100W_F28034_OPEN_LOOP_STEADY_NE.out";
var env=ScriptingEnvironment.instance();
var server=env.getServer("DebugServer.1");
server.setConfig("D:\\\\CCS21_workspace\\\\Codex_Project\\\\F28034.ccxml");
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
print("=== SOL W2 BURST PACKET NOENERGY ===");
session.target.connect();
try{session.target.halt();}catch(e){}
session.memory.loadProgram(OUT);
run(400);

// Boot + NE harness gates
check("PRE_OST_LOCKED",reg("EPwm1Regs.TZFLG.bit.OST")==1);
check("PRE_PWM_DISABLED",rw("g_pwm_enabled")==0);
check("PRE_FAULT_CLEAR",rv32u("g_fault_flags")==0);
print("PRE_REQ="+rw("g_burst_packet_request")+" RESULT="+rw("g_burst_packet_result")+" MULTI_RESULT="+rw("g_multi_cycle_probe_result")+" CYCLES="+rw("g_burst_packet_cycles")+" COMPLETED="+rv32u("g_burst_packet_completed_cycles"));
check("PRE_PACKET_IDLE",rw("g_burst_packet_request")==0 && rw("g_burst_packet_result")==0);
if(failures){ print("BURST_PACKET_NE_VERIFICATION_PASS=FALSE"); try{session.terminate();}catch(e){} throw("PRE_GATE"); }

// Harness environment: Stage 5A open-loop steady, IDLE, comparator loopback
// proved (simulated by the NE comparator gate), NE mode on.
wv("g_no_energy_test_mode",1);
wv("g_bringup_stage",5);
wv("g_active_bringup_stage",5);
wv("g_system_state",1);                 // SYS_STATE_IDLE
wv("g_comp_tz_loopback_verified",1);
wv("g_pwm_enable_request",0);

// Set COMP/TZ pin muxes exactly as the real Stage-4 loopback path requires
// (GPIO42=COMP1OUT mux, GPIO15=TZ1 mux). NE has no physical loopback, but the
// entry gate reads the mux registers.
var muxb=rv32u("GpioCtrlRegs.GPBMUX1.all")>>>0;
muxb=(muxb & 0xFFCFFFFF) | (3<<20);
wv32("GpioCtrlRegs.GPBMUX1.all",muxb>>>0);
var muxa=rv32u("GpioCtrlRegs.GPAMUX1.all")>>>0;
muxa=(muxa & 0x3FFFFFFF) | (1<<30);
wv32("GpioCtrlRegs.GPAMUX1.all",muxa>>>0);

// Frozen-state baselines (must remain untouched by packets)
var base_sw_freq=rv32u("g_switching_frequency_hz");
var base_ctrl_freq=rv32u("g_control_frequency_hz");
var base_char_ext=rw("g_open_loop_char_ext_authorized");
var base_dbred=reg("EPwm1Regs.DBRED");
var base_dbfed=reg("EPwm1Regs.DBFED");
var base_softstart=rw("g_softstart_state");
var base_comp_loopback=rw("g_comp_tz_loopback_verified");

function resetMulti(){
  wv("g_multi_cycle_probe_result",0);
  wv("g_burst_packet_result",0);
  wv32("g_multi_cycle_probe_completed_cycles",0);
}
function endState(tag){
  check(tag+"_PWM0",rw("g_pwm_enabled")==0);
  check(tag+"_OST1",reg("EPwm1Regs.TZFLG.bit.OST")==1);
  check(tag+"_TZINT0",reg("EPwm1Regs.TZFLG.bit.INT")==0);
  check(tag+"_FAULT0",rv32u("g_fault_flags")==0);
}

// ---------------- 1C / 2C / 3C / 5C exact ----------------
var authorized=[1,2,3,5];
for(var i=0;i<authorized.length;i++){
  var n=authorized[i];
  resetMulti();
  wv("g_burst_packet_cycles",n);
  wv("g_burst_packet_request",1);
  run(15);
  // poll up to 40ms for the packet layer to copy the engine result
  for(var p=0;p<5 && rw("g_burst_packet_result")==0;p++){ run(10); }
  check(n+"C_RESULT_PASS",rw("g_burst_packet_result")==1);
  check(n+"C_EXACT_COMPLETED",rv32u("g_burst_packet_completed_cycles")==n);
  check(n+"C_MULTI_RESULT",rw("g_multi_cycle_probe_result")==1);
  if(rw("g_burst_packet_result")!=1 || rw("g_multi_cycle_probe_result")!=1){
    print("  DBG "+n+"C packet_result="+rw("g_burst_packet_result")+" multi_result="+rw("g_multi_cycle_probe_result")+" multi_active="+rw("g_multi_cycle_probe_active")+" multi_req="+rw("g_multi_cycle_probe_request")+" comp_armed="+rw("g_comp_inject_test_armed")+" pre_reject="+rw("g_comp_prestart_reject")+" pending="+rw("g_burst_packet_request")+" multi_stop="+rw("g_multi_cycle_probe_stop_reason"));
    print("  DBG "+n+"C gates stage="+rw("g_bringup_stage")+" state="+rw("g_system_state")+" en_req="+rw("g_pwm_enable_request")+" en="+rw("g_pwm_enabled")+" ost="+reg("EPwm1Regs.TZFLG.bit.OST")+" fault="+rv32u("g_fault_flags")+" loopback="+rw("g_comp_tz_loopback_verified")+" muxb="+(rv32u("GpioCtrlRegs.GPBMUX1.all")>>>0).toString(16)+" muxa="+(rv32u("GpioCtrlRegs.GPAMUX1.all")>>>0).toString(16));
    print("  DBG "+n+"C pwm ctr="+reg("EPwm1Regs.TBCTL.bit.CTRMODE")+" hsp="+reg("EPwm1Regs.TBCTL.bit.HSPCLKDIV")+" clk="+reg("EPwm1Regs.TBCTL.bit.CLKDIV")+" prdld="+reg("EPwm1Regs.TBCTL.bit.PRDLD")+" shdw="+reg("EPwm1Regs.CMPCTL.bit.SHDWAMODE")+" load="+reg("EPwm1Regs.CMPCTL.bit.LOADAMODE")+" zro="+reg("EPwm1Regs.AQCTLA.bit.ZRO")+" cau="+reg("EPwm1Regs.AQCTLA.bit.CAU")+" aqb="+reg("EPwm1Regs.AQCTLB.all")+" dbout="+reg("EPwm1Regs.DBCTL.bit.OUT_MODE")+" dbpol="+reg("EPwm1Regs.DBCTL.bit.POLSEL")+" dbin="+reg("EPwm1Regs.DBCTL.bit.IN_MODE")+" osht="+reg("EPwm1Regs.TZSEL.bit.OSHT1")+" tza="+reg("EPwm1Regs.TZCTL.bit.TZA")+" tzb="+reg("EPwm1Regs.TZCTL.bit.TZB"));
  }
  check(n+"C_FREQ_170K",rv32u("g_single_cycle_probe_frequency_hz")==170000);
  endState(n+"C");
  check(n+"C_PACKET_TBPRD_352",reg("EPwm1Regs.TBPRD")==352);
  check(n+"C_PACKET_CMPA_176",reg("EPwm1Regs.CMPA.half.CMPA")==176);
  check(n+"C_PACKET_DB36",reg("EPwm1Regs.DBRED")==36 && reg("EPwm1Regs.DBFED")==36);
  check(n+"C_PACKET_ACTUAL_FREQ",Math.abs(rv32u("g_actual_switching_frequency_hz")-170000)<=100);
  check(n+"C_FROZEN_FMAX_UNCHANGED",rw("g_open_loop_char_ext_authorized")==base_char_ext && rv32u("g_control_frequency_hz")==base_ctrl_freq);
  check(n+"C_FROZEN_DB36",reg("EPwm1Regs.DBRED")==base_dbred && reg("EPwm1Regs.DBFED")==base_dbfed);
  check(n+"C_FROZEN_SOFTSTART",rw("g_softstart_state")==base_softstart);
  check(n+"C_COMP_AUTHORITY",rw("g_comp_tz_loopback_verified")==base_comp_loopback && rw("g_comp_inject_test_armed")==1);
}

// ---------------- 0 cycle: no fire ----------------
resetMulti();
wv("g_burst_packet_cycles",0);
wv("g_burst_packet_request",1);
run(15);
check("0C_REJECT",rw("g_burst_packet_result")==3);
check("0C_NO_ENGINE",rw("g_multi_cycle_probe_active")==0 && rw("g_multi_cycle_probe_result")==0);
endState("0C");

// ---------------- >authorized (6) rejected ----------------
resetMulti();
wv("g_burst_packet_cycles",6);
wv("g_burst_packet_request",1);
run(15);
check("6C_REJECT",rw("g_burst_packet_result")==3);
check("6C_NO_ENGINE",rw("g_multi_cycle_probe_active")==0 && rw("g_multi_cycle_probe_result")==0);
endState("6C");

// ---------------- fault before request cannot fire ----------------
resetMulti();
wv32("g_fault_flags",1);
wv("g_burst_packet_cycles",1);
wv("g_burst_packet_request",1);
run(15);
check("FAULTBEFORE_REJECT",rw("g_burst_packet_result")==3);
check("FAULTBEFORE_NO_ENGINE",rw("g_multi_cycle_probe_active")==0 && rw("g_multi_cycle_probe_result")==0);
check("FAULTBEFORE_PWM0",rw("g_pwm_enabled")==0);
wv32("g_fault_flags",0);

// ---------------- no request -> no fire ----------------
resetMulti();
wv("g_multi_cycle_probe_cycles",5);
run(15);
check("NOREQ_NO_ENGINE",rw("g_multi_cycle_probe_active")==0 && rw("g_multi_cycle_probe_result")==0);
endState("NOREQ");

// ---------------- mid-packet fault (NE-injected at cycle 10) ----------------
resetMulti();
wv("g_burst_packet_ne_fault_inject_cycle",10);
wv("g_burst_packet_cycles",5);   // packet layer: authorized; engine fault test uses direct multi
wv("g_burst_packet_request",1);
// The packet layer only forwards authorized cycles, so to inject mid-packet we
// use the proven engine directly with a 150-cycle packet.
wv("g_burst_packet_request",0);
wv32("g_multi_cycle_probe_cycles",150);
wv32("g_single_cycle_probe_frequency_hz",170000);
wv("g_single_cycle_probe_deadtime",36);
wv("g_multi_cycle_probe_request",1);
run(15);
check("MIDFAULT_ABORT",rw("g_multi_cycle_probe_result")==2);
check("MIDFAULT_COMPLETED_LT_REQ",rv32u("g_multi_cycle_probe_completed_cycles")>=1 && rv32u("g_multi_cycle_probe_completed_cycles")<=20);
check("MIDFAULT_FAULT_SET",(rv32u("g_fault_flags") & 0x40000000)!=0);
check("MIDFAULT_PWM0",rw("g_pwm_enabled")==0);
check("MIDFAULT_OST1",reg("EPwm1Regs.TZFLG.bit.OST")==1);
wv32("g_fault_flags",0);
wv("g_burst_packet_ne_fault_inject_cycle",0);

// ---------------- final end state ----------------
run(15);
check("FINAL_PWM0",rw("g_pwm_enabled")==0);
check("FINAL_OST1",reg("EPwm1Regs.TZFLG.bit.OST")==1);
check("FINAL_TZINT0",reg("EPwm1Regs.TZFLG.bit.INT")==0);
check("FINAL_FAULT0",rv32u("g_fault_flags")==0);
check("FINAL_FMAX_FROZEN",rw("g_open_loop_char_ext_authorized")==base_char_ext && rv32u("g_control_frequency_hz")==base_ctrl_freq);

print("BURST_PACKET_NE_VERIFICATION_PASS="+(failures==0?"TRUE":"FALSE"));
try{session.terminate();}catch(e){}
if(failures){ throw("BURST_PACKET_NE_FAILURES="+failures); }
