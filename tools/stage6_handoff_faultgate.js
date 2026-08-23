// stage6_handoff_faultgate.js
// STAGE6_CLOSED_LOOP_HANDOFF gate T: any FAULT / hard ceiling during the ramp
// must cancel the handoff, disable RUN, hold a safe state and never auto-retry.
// NO real power: frozen no-energy binary, OST clamped, inject=false.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
var OUT = "D:\\CCS21_workspace\\Codex_Project\\evidence\\stage6_closedloop_handoff_noenergy\\LLC_100W_F28034_BRINGUP_DSH.out";
var env = ScriptingEnvironment.instance();
var server = env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session = server.openSession();
function addr(n){ return session.expression.evaluate("&"+n); }
function rw(n){ try{ return session.memory.readWord(1,addr(n)); }catch(e){ return -1; } }
function rv32u(n){ try{ var a=addr(n); var lo=session.memory.readWord(1,a); var hi=session.memory.readWord(1,a+1); return (lo|(hi<<16))>>>0; }catch(e){ return -1; } }
function wv(n,v){ session.memory.writeWord(1,addr(n),v); }
function wv32(n,v){ var a=addr(n); session.memory.writeWord(1,a,v&0xFFFF); session.memory.writeWord(1,a+1,(v>>>16)&0xFFFF); }
function reg(e){ try{ return ""+session.expression.evaluate(e); }catch(err){ return "<f>"; } }
function run(ms){ session.target.runAsynch(); java.lang.Thread.sleep(ms); session.target.halt(); }

function loadFresh(){
  session.target.connect();
  try{ session.target.halt(); }catch(e){}
  session.memory.loadProgram(OUT);
  run(400);
  wv("g_no_energy_test_mode",1);
  wv("g_fault_flags",0);
  run(20);
}
function armStage6(ceiling){
  wv("g_bringup_stage",7);
  wv("g_comp_tz_loopback_verified",1);
  wv("g_diag_frequency_override",1);
  wv("g_softstart_no_energy",1);
  wv("g_softstart_acceptance_mode",0);
  wv("g_softstart_accept_target_raw",1244);
  wv("g_softstart_hard_ceiling_raw",ceiling);
  wv("g_softstart_request",0); wv("g_softstart_result",0); wv("g_softstart_state",0);
  wv("g_system_state",1);
  wv("g_softstart_handoff_result",0xAAAA);
  wv32("g_stage6_handoff_count",0); wv32("g_stage6_run_entry_count",0);
  wv("g_stage6_closeloop_vout_inject",0);   // no inject for fault-gate path
  wv("g_stage6_transfer_request",0);
}

print("=== STAGE6 HANDOFF FAULT-GATE (no real power, frozen no-energy binary) ===");
loadFresh();

// ---- T1: hard ceiling at 500 (sim FINAL vout 1244 >> ceiling) -> abort safe ----
armStage6(500);
wv("g_softstart_request",1);
run(400);
var r1 = rw("g_softstart_result");
print("T1 ceiling result="+r1+" (3=HARD_CEILING) state="+rw("g_softstart_state")+" handoff="+rv32u("g_stage6_handoff_count")+" run="+rv32u("g_stage6_run_entry_count")+" sys="+rw("g_system_state")+" pwm="+rw("g_pwm_enabled")+" ost="+reg("EPwm1Regs.TZFLG.bit.OST"));
// wait 200ms more: no auto-retry, RUN never entered
run(200);
var r1b = rw("g_softstart_result");
print("T1 after-wait result="+r1b+" run="+rv32u("g_stage6_run_entry_count")+" sys="+rw("g_system_state"));
var t1 = (r1==3) && (rv32u("g_stage6_run_entry_count")==0) && (rv32u("g_stage6_handoff_count")==0) &&
         (rw("g_pwm_enabled")==0) && (r1b==3) && (rv32u("g_stage6_run_entry_count")==0);
print("HANDOFF_HARD_CEILING_SAFE_ABORT_PASS="+(t1?"TRUE":"FALSE"));

// ---- T2: fault asserted before trigger -> REJECTED / safe, no RUN ----
// reload fresh
loadFresh();
armStage6(1491);
wv("g_fault_flags",0x100);   // FAULT_VOUT_OVP injected
wv("g_softstart_request",1);
run(400);
var r2 = rw("g_softstart_result");
print("T2 fault result="+r2+" (7=REJECTED) run="+rv32u("g_stage6_run_entry_count")+" handoff="+rv32u("g_stage6_handoff_count")+" sys="+rw("g_system_state")+" pwm="+rw("g_pwm_enabled"));
run(100);
var r2b = rw("g_softstart_result");
print("T2 after-wait result="+r2b+" run="+rv32u("g_stage6_run_entry_count"));
var t2 = (rv32u("g_stage6_run_entry_count")==0) && (rv32u("g_stage6_handoff_count")==0) &&
         (rw("g_pwm_enabled")==0) && (rv32u("g_stage6_run_entry_count")==0);
print("HANDOFF_FAULT_SAFE_NO_RETRY_PASS="+(t2?"TRUE":"FALSE"));
print("STAGE6_HANDOFF_FAULT_GATE_ALL_PASS="+((t1&&t2)?"TRUE":"FALSE"));
print("DONE");
