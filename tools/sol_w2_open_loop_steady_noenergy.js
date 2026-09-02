// W2_OPEN_LOOP_STEADY: on-target no-energy proof of the open-loop steady
// experimental module (NE binary: STAGE6_OPEN_LOOP_STEADY_BUILD +
// STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST).
//
// The synthetic raw is written by the host (g_open_loop_ne_raw); the module's
// actuator path only fires under OST + arm (S7). Entry/exit use the NE request
// variables — never the real Stage 5A enable path. End state of every scenario
// must be PWM=0 / OST=1 / TZINT=0.
//
// Scenarios:
//   S5a steady-flat (constant raw -> steady_reached), S5b drift (no steady)
//   S1  slew trajectory: trace[0..15] = 169500..162000, 40 steps 170k->150k,
//       actuator NOT touched (TBPRD stays 399)
//   S2  command clamp: 200k->170k, 100k->145k, clamp_count>0
//   S3  WARNING auto-stop (raw 1310 >= 1304): stop_reason=2, boundary=1,
//       no fault latch
//   S4  HARD abort (raw 1370 >= 1367): FAULT_OPEN_LOOP_VOUT_CEILING 0x00020000,
//       SYS_STATE_FAULT, stop_reason=3
//   S7  actuator under OST+arm: TBPRD 386 @155k, freq trackers follow
//   S6  max-hold timeout backstop (ne_max_hold_ticks=600 -> stop_reason=4)
//   S8  TINT0 interval budget: entry-count delta ~200ms/20us, interval max
//       bounded, whole-ISR cycles bounded (noenergy counters, mode 0)
//   S9  end-state PWM=0/OST=1/TZINT=0 after EVERY stop
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
print("=== SOL W2 OPEN_LOOP_STEADY NOENERGY ===");
session.target.connect();
try{session.target.halt();}catch(e){}
session.memory.loadProgram(OUT);
run(400);

// Boot gates
check("PRE_OST_LOCKED",reg("EPwm1Regs.TZFLG.bit.OST")==1);
check("PRE_PWM_DISABLED",rw("g_pwm_enabled")==0);
check("PRE_FAULT_CLEAR",rv32u("g_fault_flags")==0);
check("PRE_OL_IDLE",rw("g_open_loop_steady_active")==0 && rw("g_open_loop_stop_reason")==0);
if(failures){ print("SOL_W2_OPEN_LOOP_STEADY_NOENERGY_PASS=FALSE"); try{session.terminate();}catch(e){} throw("PRE_GATE"); }

// Harness enables: stale monitor off; OL NE tick on.
wv("g_no_energy_test_mode",1);
wv("g_open_loop_ne_test_enable",1);
wv32("g_open_loop_freq_slew_hz_per_sample",500);

function olEntry(cmd){ wv32("g_open_loop_frequency_command_hz",cmd); wv("g_open_loop_ne_entry_request",1); run(6); }
function olExit(){ wv("g_open_loop_ne_exit_request",1); run(6); }
function endState(tag){
  check(tag+"_PWM0",rw("g_pwm_enabled")==0);
  check(tag+"_OST1",reg("EPwm1Regs.TZFLG.bit.OST")==1);
  check(tag+"_TZINT0",reg("EPwm1Regs.TZFLG.bit.INT")==0);
  check(tag+"_INACTIVE",rw("g_open_loop_steady_active")==0);
}

// ---------------- S5a: steady detection (constant raw) ----------------
wv("g_open_loop_ne_raw",1000);
olEntry(170000);
check("S5A_ACTIVE",rw("g_open_loop_steady_active")==1);
check("S5A_PHASE_SLEW_OR_SETTLE",rw("g_open_loop_phase")==1||rw("g_open_loop_phase")==2);
check("S5A_ENTRY_170K",rv32u("g_open_loop_entry_hz")==170000 && rv32u("g_open_loop_applied_hz")==170000);
run(420);
check("S5A_STEADY",rw("g_open_loop_steady_reached")==1);
check("S5A_PHASE_STEADY",rw("g_open_loop_phase")==3);
check("S5A_SETTLE_MS",rw("g_open_loop_settle_ms")>=250);
check("S5A_WINDOWS",rv32u("g_open_loop_win_index")>=4);
check("S5A_MEAN",Math.abs(rw("g_open_loop_win_mean_raw")-1000)<=2);
check("S5A_LAST_RAW",rw("g_open_loop_last_vout_raw")==1000);
print("OBS S5A settle_ms="+rw("g_open_loop_settle_ms")+" win_index="+rv32u("g_open_loop_win_index")+" steady_ticks="+rv32u("g_open_loop_steady_ticks"));
olExit();
check("S5A_STOP_HOST",rw("g_open_loop_stop_reason")==1);
endState("S5A");

// ---------------- S5b: drifting raw -> NO steady ----------------
olEntry(170000);
wv("g_open_loop_ne_raw",1000); run(130);
wv("g_open_loop_ne_raw",1010); run(130);
wv("g_open_loop_ne_raw",1000); run(130);
wv("g_open_loop_ne_raw",1010); run(130);
wv("g_open_loop_ne_raw",1000); run(130);
wv("g_open_loop_ne_raw",1010); run(70);
check("S5B_NO_STEADY",rw("g_open_loop_steady_reached")==0);
check("S5B_WINDOWS",rv32u("g_open_loop_win_index")>=6);
olExit();
check("S5B_STOP_HOST",rw("g_open_loop_stop_reason")==1);
endState("S5B");

// ---------------- S1: slew trajectory + actuator still gated ----------------
wv("g_open_loop_ne_raw",1000);
olEntry(150000);
run(30);
var s1ok=true, expected=169500;
for(var i=0;i<16;i++){
  var a=addr("g_open_loop_ne_trace")+2*i;
  var lo=session.memory.readWord(1,a), hi=session.memory.readWord(1,a+1);
  var v=(lo|(hi<<16))>>>0;
  if(v!==expected){ print("S1_TRACE["+i+"]="+v+" expect="+expected); s1ok=false; }
  expected-=500;
}
check("S1_TRACE_16",s1ok);
check("S1_SLEW_STEPS_40",rv32u("g_open_loop_slew_steps")==40);
check("S1_APPLIED_150K",rv32u("g_open_loop_applied_hz")==150000);
check("S1_EFFECTIVE_150K",rv32u("g_open_loop_cmd_effective_hz")==150000);
check("S1_NO_CLAMP",rv32u("g_open_loop_cmd_clamp_count")==0);
check("S1_ACTUATOR_GATED_TBPRD",reg("EPwm1Regs.TBPRD")==399);
check("S1_SLEW_DONE",rv32u("g_open_loop_slew_done_tick")>0);
run(400);
check("S1_STEADY_AFTER_SLEW",rw("g_open_loop_steady_reached")==1);
check("S1_STEADY_TICKS",rv32u("g_open_loop_steady_ticks")>=10000);
print("OBS S1 slew_done_tick="+rv32u("g_open_loop_slew_done_tick")+" settle_ms="+rw("g_open_loop_settle_ms")+" steps="+rv32u("g_open_loop_slew_steps"));
olExit();
endState("S1");

// ---------------- S2: command clamping 200k / 100k ----------------
olEntry(200000);
run(12);
check("S2_CLAMP_HIGH_EFF",rv32u("g_open_loop_cmd_effective_hz")==170000);
check("S2_CLAMP_COUNT",rv32u("g_open_loop_cmd_clamp_count")>0);
check("S2_APPLIED_AT_MAX",rv32u("g_open_loop_applied_hz")==170000);
wv32("g_open_loop_frequency_command_hz",100000);
run(30);
check("S2_CLAMP_LOW_EFF",rv32u("g_open_loop_cmd_effective_hz")==145000);
check("S2_APPLIED_145K",rv32u("g_open_loop_applied_hz")==145000);
check("S2_CLAMP_COUNT_GREW",rv32u("g_open_loop_cmd_clamp_count")>0);
check("S2_NO_FAULT",rv32u("g_fault_flags")==0);
olExit();
endState("S2");

// ---------------- S3: WARNING auto-stop (raw 1310) ----------------
wv("g_open_loop_ne_raw",1000);
olEntry(170000);
run(20);
wv("g_open_loop_ne_raw",1310);
run(12);
check("S3_STOP_WARNING",rw("g_open_loop_stop_reason")==2);
check("S3_UPPER_BOUNDARY",rw("g_open_loop_upper_gain_boundary")==1);
check("S3_NO_FAULT",rv32u("g_fault_flags")==0);
check("S3_STOP_MEAN",rw("g_open_loop_stop_mean_raw")>0);
endState("S3");

// ---------------- S4: HARD abort (raw 1370 >= 1367) ----------------
wv("g_open_loop_ne_raw",1000);
olEntry(170000);
run(20);
wv("g_open_loop_ne_raw",1370);
run(12);
check("S4_FAULT_BIT",((rv32u("g_fault_flags")>>>0)&0x00020000)!==0);
check("S4_SYS_FAULT",rw("g_system_state")==4);
check("S4_STOP_HARD",rw("g_open_loop_stop_reason")==3);
check("S4_STOP_FAULT_BIT",((rv32u("g_open_loop_stop_fault")>>>0)&0x00020000)!==0);
endState("S4");

// ---------------- S7: actuator under OST + arm ----------------
wv32("g_fault_flags",0);
wv("g_system_state",1);
wv("g_open_loop_ne_actuator_arm",1);
wv("g_open_loop_ne_raw",1000);
olEntry(155000);
run(420);
check("S7_TBPRD_386",reg("EPwm1Regs.TBPRD")==386);
check("S7_CMPA_193",reg("EPwm1Regs.CMPA.half.CMPA")==193);
check("S7_SW_FREQ",rv32u("g_switching_frequency_hz")==155000);
check("S7_ACTUAL_FREQ",Math.abs(rv32u("g_actual_switching_frequency_hz")-155000)<=100);
check("S7_DB",reg("EPwm1Regs.DBRED")==36 && reg("EPwm1Regs.DBFED")==36);
check("S7_STILL_OST",reg("EPwm1Regs.TZFLG.bit.OST")==1);
check("S7_STILL_PWM0",rw("g_pwm_enabled")==0);
check("S7_STEADY",rw("g_open_loop_steady_reached")==1);
olExit();
check("S7_STOP_FREQ_APPLIED",rv32u("g_open_loop_stop_freq_applied")==155000);
endState("S7");

// ---------------- S6: max-hold timeout backstop ----------------
wv("g_open_loop_ne_actuator_arm",0);
wv32("g_open_loop_ne_max_hold_ticks",600);
olEntry(170000);
run(40);
check("S6_STOP_TIMEOUT",rw("g_open_loop_stop_reason")==4);
endState("S6");
wv32("g_open_loop_ne_max_hold_ticks",0);

// ---------------- S8: TINT0 interval budget (noenergy counters, mode 0) ----------------
wv("g_open_loop_ne_raw",1000);
olEntry(170000);
wv("g_stage6_noenergy_test_mode",0);
wv("g_stage6_noenergy_test_enable",1);
/* Pre-existing noenergy-instrumentation artifact: the host enable can land in
 * the middle of a TINT0 ISR, so its first sample reads t_isr_entry==0 and
 * records a bogus (0 - exit) delta. Absorb that tick, then zero the whole-ISR
 * statistics before measuring. */
run(10);
wv32("g_fast_isr_cycles_max",0);
wv32("g_fast_isr_cycles_sum",0);
wv32("g_fast_isr_cycles_count",0);
var c0=rv32u("g_timer0_entry_count"), t0=rv32u("g_stage6_noenergy_test_ticks");
var isr0=rv32u("g_fast_isr_cycles_count");
run(200);
var c1=rv32u("g_timer0_entry_count"), t1=rv32u("g_stage6_noenergy_test_ticks");
var isr1=rv32u("g_fast_isr_cycles_count");
var dcount=c1-c0, dticks=t1-t0, disr=isr1-isr0;
print("OBS S8 dcount="+dcount+" dticks="+dticks+" isr_samples="+disr+
      " interval_max="+rv32u("g_timer0_entry_interval_max")+
      " interval_min="+rv32u("g_timer0_entry_interval_min")+
      " isr_max="+rv32u("g_fast_isr_cycles_max"));
check("S8_ENTRY_COUNT_200MS",dcount>=9000 && dcount<=11000);
check("S8_TICKS_200MS",dticks>=9000 && dticks<=11000);
check("S8_INTERVAL_MAX",rv32u("g_timer0_entry_interval_max")<=2400);
check("S8_INTERVAL_MIN",rv32u("g_timer0_entry_interval_min")>=1100);
check("S8_WHOLE_ISR_MAX",rv32u("g_fast_isr_cycles_max")<=2400);
olExit();
wv("g_stage6_noenergy_test_enable",0);
endState("S8");

// ---------------- final sanity ----------------
check("FINAL_NO_FAULT",rv32u("g_fault_flags")==0);
check("FINAL_TBPRD_386",reg("EPwm1Regs.TBPRD")==386);

print("SOL_W2_OPEN_LOOP_STEADY_NOENERGY_PASS="+(failures==0?"TRUE":"FALSE"));
try{session.terminate();}catch(e){}
if(failures) throw("FAILURES="+failures);