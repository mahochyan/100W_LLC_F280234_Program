// W3_10V_BURST_HOLD_V1 on-target no-energy state-machine proof.
// Output hardware stays OST-clamped; g_cal_hold_ne_raw supplies the synthetic
// Vout and the NE fast tick drives the same packet boundary handler.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_OL_STEADY_NE\\LLC_100W_F28034_OPEN_LOOP_STEADY_NE.out";
var env=ScriptingEnvironment.instance(),server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();
function addr(n){return session.expression.evaluate("&"+n);}
function rw(n){return session.memory.readWord(1,addr(n));}
function rv32u(n){var a=addr(n),lo=session.memory.readWord(1,a),hi=session.memory.readWord(1,a+1);return (lo|(hi<<16))>>>0;}
function wv(n,v){session.memory.writeWord(1,addr(n),v);}
function wv32(n,v){var a=addr(n);session.memory.writeWord(1,a,v&0xffff);session.memory.writeWord(1,a+1,(v>>>16)&0xffff);}
function reg(e){return parseInt(session.expression.evaluate(e));}
function run(ms){session.target.runAsynch();java.lang.Thread.sleep(ms);session.target.halt();}
function check(name,ok){print(name+"="+(ok?"TRUE":"FALSE"));if(!ok)failures++;}

var failures=0;
print("=== SOL W3 10V BURST HOLD NOENERGY ===");
session.target.connect();try{session.target.halt();}catch(e){}
session.memory.loadProgram(OUT);run(400);
check("PRE_SAFE",rw("g_pwm_enabled")==0 && reg("EPwm1Regs.TZFLG.bit.OST")==1 &&
      reg("EPwm1Regs.TZFLG.bit.INT")==0 && rv32u("g_fault_flags")==0);
check("PRE_MODE_LEGACY",rw("g_cal_hold_mode_request")==0 && rw("g_cal_hold_mode_active")==0);
if(failures){try{session.terminate();}catch(e){}throw "pre-gate";}

wv("g_no_energy_test_mode",1);
wv("g_bringup_stage",5);
wv("g_active_bringup_stage",5);
wv("g_system_state",1);

function resetIdle(){
  wv32("g_fault_flags",0);wv("g_system_state",1);wv("g_pwm_enabled",0);
  wv("g_pwm_enable_result",0);wv("g_cal_hold_request",0);
  wv("g_cal_hold_state",0);wv("g_cal_hold_stop_reason",0);
  wv("g_cal_hold_packet_active",0);wv("g_cal_measure_active",0);
}
function request(mode,duration,raw){
  wv("g_cal_hold_mode_request",mode);wv("g_cal_hold_duration_ms",duration);
  wv("g_cal_hold_ne_raw",raw);wv("g_cal_hold_request",1);run(12);
}
function safe(tag){
  check(tag+"_PWM0",rw("g_pwm_enabled")==0);
  check(tag+"_OST1",reg("EPwm1Regs.TZFLG.bit.OST")==1);
  check(tag+"_TZINT0",reg("EPwm1Regs.TZFLG.bit.INT")==0);
}

// Exercise the repaired initial-charge PrepareStart authorization without ever
// clearing OST. The NE firmware synthesizes the terminal VOUT target only after
// the exact 239/110 write has passed the private gate.
var startSeen0=rw("g_first_start_seen"),tzclr0=rv32u("g_probe_tzclr_write_count");
wv("g_cal_hold_ne_bypass_charge",0);
resetIdle();request(1,500,1240);run(20);
print("ACCEL_PREPARE_DIAG state="+rw("g_cal_hold_state")+
      " reason="+rw("g_cal_hold_stop_reason")+
      " charge="+rw("g_cal_hold_charge_stop_raw")+
      " accel_reason="+rw("g_accel_stop_reason")+
      " multi_result="+rw("g_multi_cycle_probe_result")+
      " fault=0x"+rv32u("g_fault_flags").toString(16));
check("ACCEL_PREPARE_AUTH_PASS",rw("g_cal_hold_state")==2 &&
      rw("g_cal_hold_charge_stop_raw")==1200);
check("ACCEL_PREPARE_EXACT_239_110",reg("EPwm1Regs.TBPRD")==239 &&
      reg("EPwm1Regs.DBRED")==110 && reg("EPwm1Regs.DBFED")==110);
check("ACCEL_NE_NO_PWM_RELEASE",rw("g_first_start_seen")==startSeen0 &&
      rv32u("g_probe_tzclr_write_count")==tzclr0);
check("ACCEL_NE_START_SEED_MIRROR",rw("g_pwm_start_prepared")==0 &&
      reg("EPwm1Regs.AQSFRC.bit.ACTSFA")==2 &&
      reg("EPwm1Regs.AQSFRC.bit.RLDCSF")==3);
safe("ACCEL_PREPARE");
wv("g_cal_hold_ne_bypass_charge",1);

// Invalid cross-profile duration is rejected before any start.
resetIdle();request(1,100,1240);
check("INVALID_DURATION_ABORT",rw("g_cal_hold_state")==5 && rw("g_cal_hold_stop_reason")==7);
safe("INVALID_DURATION");

// Revoked Comparator/TZ loopback must make the private packet write fail closed.
resetIdle();wv("g_comp_tz_loopback_verified",0);request(1,500,1210);run(5);
check("PRESTART_AUTH_REJECT_ABORT",rw("g_cal_hold_state")==5 &&
      rw("g_cal_hold_stop_reason")==8 && rv32u("g_cal_hold_packet_count")==0);
safe("PRESTART_AUTH_REJECT");
wv("g_comp_tz_loopback_verified",1);

// The legacy 11 V profile keeps the same protected packet capability.
resetIdle();request(0,100,1390);
check("LEGACY_MODE_OFF",rw("g_cal_hold_mode_active")==0 && rw("g_cal_hold_state")==2);
wv("g_cal_hold_ne_raw",1370);run(3);wv("g_cal_hold_ne_raw",1410);run(8);
check("LEGACY_PACKET_AUTH_PASS",rv32u("g_cal_hold_packet_count")>0 &&
      rw("g_cal_hold_packet_max_cycles")<=15 && rv32u("g_fault_flags")==0);
safe("LEGACY_PACKET");

// Valid W3 entry bypasses only the energy-producing charge in NE.
resetIdle();request(1,500,1240);
check("W3_MODE_LATCHED",rw("g_cal_hold_mode_active")==1);
check("W3_INITIAL_TARGET_1200",rw("g_cal_hold_charge_stop_raw")==1200);
check("W3_OFF_DEADBAND",rw("g_cal_hold_state")==2 && rw("g_cal_hold_packet_active")==0);
check("W3_NO_PACKET_IN_DEADBAND",rv32u("g_cal_hold_packet_count")==0);
safe("W3_ENTRY");

// Low threshold emits bounded 250k/DB110 packets; returning to the dead band
// stops refiring and publishes exact packet/cycle statistics.
wv("g_cal_hold_ne_raw",1210);run(3);
wv("g_cal_hold_ne_raw",1240);run(12);
check("LOW_EMITS_PACKET",rv32u("g_cal_hold_packet_count")>0);
check("PACKET_CYCLES_BOUNDED",rw("g_cal_hold_packet_max_cycles")==160 &&
      rw("g_cal_hold_packet_min_cycles")>=1);
check("PACKET_EXISTING_TELEMETRY",rw("g_cal_hold_packet_start_raw")==1210 &&
      rw("g_cal_hold_packet_actual_cycles")==160 &&
      rw("g_cal_hold_packet_post_last_raw")==1240);
check("PACKET_CONFIG_250K_FULL_PHASE_A_TO_DB36",reg("EPwm1Regs.TBPRD")==239 &&
      reg("EPwm1Regs.DBRED")==36 && reg("EPwm1Regs.DBFED")==36);
check("DEADBAND_RETURNS_OFF",rw("g_cal_hold_state")==2 && rw("g_cal_hold_packet_active")==0);
check("NO_FAULT_AFTER_PACKETS",rv32u("g_fault_flags")==0);
safe("PACKETS");

// A fresh in-band sample clears an existing low-sample confirmation. The DSS
// halt latency cannot reliably stop after exactly one 20us classifier step, so
// inject the intermediate count and exercise its real clear path on target.
wv("g_cal_hold_undersupply_low_samples",1);
wv("g_cal_hold_ne_raw",1240);run(2);
check("LOW_RECOVERY_CLEARS_CONFIRM",rw("g_cal_hold_state")==2 &&
      rw("g_cal_hold_undersupply_low_samples")==0);
safe("LOW_RECOVERY");

// Persistent below-floor evidence still aborts after three confirmations.
resetIdle();request(1,500,1240);wv("g_cal_hold_ne_raw",999);run(10);
check("PERSISTENT_LOW_ABORT",rw("g_cal_hold_state")==5 &&
      rw("g_cal_hold_stop_reason")==4 &&
      rw("g_cal_hold_undersupply_low_samples")==3);
safe("PERSISTENT_LOW");

// Hard ceiling in OFF mode is immediate and cannot be enlarged by the host.
resetIdle();request(1,500,1240);
wv("g_cal_hold_ne_raw",1300);run(2);
check("HARD_1300_ABORT",rw("g_cal_hold_state")==5 && rw("g_cal_hold_stop_reason")==2);
check("HARD_EVENT_COUNT",rw("g_cal_hold_hard_limit_events")>0);
safe("HARD");

// The 500ms on-chip duration ends cleanly. Skip directly to its last ticks.
resetIdle();request(1,500,1240);
wv32("g_cal_hold_elapsed_ticks",24998);run(2);
check("DURATION_COMPLETE",rw("g_cal_hold_state")==4 && rw("g_cal_hold_stop_reason")==1);
check("DURATION_FINAL_OST",rw("g_cal_hold_final_ost")==1);
safe("DURATION");

// Frozen per-duration cycle cap aborts before a new packet is released.
resetIdle();request(1,500,1240);
wv32("g_cal_hold_total_packet_cycles",62500);wv("g_cal_hold_ne_raw",1210);run(2);
check("CYCLE_CAP_ABORT",rw("g_cal_hold_state")==5 && rw("g_cal_hold_stop_reason")==6);
safe("CYCLE_CAP");

// Fault dominates an active packet and completes zero further useful work.
resetIdle();request(1,500,1240);
wv("g_cal_hold_state",3);wv("g_cal_hold_packet_active",1);wv32("g_fault_flags",0x40000000);
run(2);
check("FAULT_PACKET_ABORT",rw("g_cal_hold_state")==5 && rw("g_cal_hold_stop_reason")==3);
safe("FAULT");

wv32("g_fault_flags",0);
print("SOL_W3_10V_BURST_HOLD_NOENERGY_PASS="+(failures==0?"TRUE":"FALSE"));
try{session.terminate();}catch(e){}
if(failures){throw "w3-ne-failures="+failures;}
