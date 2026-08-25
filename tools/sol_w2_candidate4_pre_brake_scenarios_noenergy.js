// W2_CANDIDATE4_PRE_HANDOFF_ENERGY_STATE_SHAPING_V1 - on-target no-energy
// scenario tests for the pre-handoff brake state machine. This loads only the
// no-energy build, keeps AQCSFRC force-low and OST latched, and drives the
// synthetic pre-brake VOUT via the test override hook.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_FLASH_SHOT_NOENERGY\\LLC_100W_F28034_BRINGUP_DSH.out";
var env=ScriptingEnvironment.instance();
var server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();

function addr(n){ return session.expression.evaluate("&"+n); }
function rw(n){ try{ return session.memory.readWord(1,addr(n)); }catch(e){ return -1; } }
function rv32u(n){ try{ var a=addr(n),lo=session.memory.readWord(1,a),hi=session.memory.readWord(1,a+1); return (lo|(hi<<16))>>>0; }catch(e){ return -1; } }
function rv32s(n){ var v=rv32u(n); return v>0x7fffffff?v-0x100000000:v; }
function wv(n,v){ session.memory.writeWord(1,addr(n),v); }
function wv32(n,v){ var a=addr(n); session.memory.writeWord(1,a,v&0xffff); session.memory.writeWord(1,a+1,(v>>>16)&0xffff); }
function reg(e){ try{ return ""+session.expression.evaluate(e); }catch(err){ return "<f>"; } }
function regn(e){ var s=reg(e); return (s.indexOf("0x")===0||s.indexOf("0X")===0)?parseInt(s,16):parseInt(s,10); }
function run(ms){ session.target.runAsynch(); java.lang.Thread.sleep(ms); session.target.halt(); }
function check(name,ok){ print(name+"="+(ok?"TRUE":"FALSE")); if(!ok) failures++; }

var failures=0;
print("=== SOL W2 CANDIDATE4 PRE_BRAKE SCENARIOS NOENERGY ===");
session.target.connect();
try{session.target.halt();}catch(e){}
session.memory.loadProgram(OUT);
run(400);

// Common safe no-energy preconditions.
wv("g_no_energy_test_mode",1);
wv("g_fault_flags",0);
run(20);
check("PRE_OST_LOCKED",regn("EPwm1Regs.TZFLG.bit.OST")==1);
check("PRE_PWM_DISABLED",rw("g_pwm_enabled")==0);
check("PRE_FAULT_CLEAR",rv32u("g_fault_flags")==0);
session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFA = 1");
session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFB = 1");
if(failures){ print("SOL_W2_CANDIDATE4_PRE_BRAKE_SCENARIOS_PASS=FALSE"); try{session.terminate();}catch(e){} throw("PRE_GATE"); }

function resetPreBrake(targetRaw, voutRaw, freqHz, prevRaw, settle, cycles){
  // Common soft-start environment for direct pre-brake state execution.
  wv("g_bringup_stage",7);
  wv("g_comp_tz_loopback_verified",1);
  wv("g_diag_frequency_override",1);
  wv("g_softstart_no_energy",1);
  wv("g_pre_brake_test_override",1);
  wv("g_pre_brake_test_vout_raw",voutRaw);
  wv("g_pre_brake_test_ramp",0);
  wv("g_pre_brake_test_step",0);
  wv("g_softstart_acceptance_mode",0);
  wv("g_softstart_accept_target_raw",targetRaw);
  wv("g_softstart_hard_ceiling_raw",1491);
  wv("g_softstart_request",0);
  wv("g_softstart_result",0);
  wv("g_softstart_state",11); // SOFTSTART_PRE_HANDOFF_BRAKE
  wv("g_softstart_handoff_result",0xaaaa);
  wv("g_system_state",2); // SOFT_START (required by transfer gate)
  wv("g_pwm_enabled",1);  // software only, hardware still clamped/OST
  wv("g_pwm_enable_request",1);
  wv32("g_stage6_handoff_count",0);
  wv32("g_stage6_run_entry_count",0);
  wv("g_stage6_transfer_request",0);
  wv("g_stage6_closeloop_vout_inject",1);
  wv("g_stage6_synthetic_vout_raw",voutRaw);
  wv32("g_pi_integral_q12",0);
  wv32("g_control_frequency_hz",150000);
  wv32("g_control_shadow_frequency_hz",150000);
  wv("g_control_reference_valid",0);
  wv("g_fault_flags",0);
  wv("g_softstart_ramp_active",0);
  wv("g_softstart_stale_abort",0);
  wv("g_softstart_consecutive_miss",0);
  wv("g_pre_brake_cycles",cycles);
  wv("g_pre_brake_settle_count",settle);
  wv("g_pre_brake_prev_raw",prevRaw);
  wv("g_pre_brake_freq_hz",freqHz);
  wv("g_pre_brake_max_dvout",0);
  wv("g_pre_brake_handoff_ready",0);
  wv("g_pre_brake_abort_reason",0);
  wv("g_pre_brake_entry_raw_frozen",prevRaw);
  wv("g_pre_brake_exit_raw_frozen",0);
  wv32("g_pre_brake_exit_timer2",0);
  session.expression.evaluate("EPwm1Regs.ETSEL.bit.SOCAEN = 1");
  // Ensure the ePWM1 interrupt that drives SoftStart_FastUpdate is live.
  session.expression.evaluate("EPwm1Regs.ETSEL.bit.INTSEL = 1");
  session.expression.evaluate("EPwm1Regs.ETPS.bit.INTPRD = 1");
  session.expression.evaluate("EPwm1Regs.ETCLR.bit.INT = 1");
  session.expression.evaluate("EPwm1Regs.ETSEL.bit.INTEN = 1");
  session.expression.evaluate("PieCtrlRegs.PIEIER3.bit.INTx1 = 1");
  // Match the PWM to the requested pre-brake frequency so transfer validation
  // accepts the handoff (same state SS_ApplyPreBrakeFreq would produce).
  var pbPeriod = Math.floor((60000000 + freqHz/2) / freqHz) - 1;
  session.expression.evaluate("EPwm1Regs.TBPRD = "+pbPeriod);
  session.expression.evaluate("EPwm1Regs.CMPA.half.CMPA = "+Math.floor((pbPeriod+1)/2));
  session.expression.evaluate("EPwm1Regs.DBRED = 36");
  session.expression.evaluate("EPwm1Regs.DBFED = 36");
  session.expression.evaluate("EPwm1Regs.DBCTL.bit.OUT_MODE = 1");
}

function snap(){
  return {state:rw("g_softstart_state"), result:rw("g_softstart_result"),
    abort:rw("g_pre_brake_abort_reason"), ready:rw("g_pre_brake_handoff_ready"),
    cycles:rw("g_pre_brake_cycles"), settle:rw("g_pre_brake_settle_count"),
    freq:rv32u("g_pre_brake_freq_hz"), maxdv:rw("g_pre_brake_max_dvout"),
    exit:rw("g_pre_brake_exit_raw_frozen"), fault:rv32u("g_fault_flags"),
    firstfreq:rv32u("g_stage6_first_pi_freq_hz"),
    integral:rv32s("g_pi_integral_q12")};
}

// 1. High dv/dt (continuous positive ramp) -> no handoff, frequency steps up.
resetPreBrake(2000,1245,155000,1244,0,0);
wv("g_pre_brake_test_ramp",1); wv("g_pre_brake_test_step",5);
run(1);
var s=snap();
print("SCENARIO1 state="+s.state+" settle="+s.settle+" freq="+s.freq+" ready="+s.ready+" maxdv="+s.maxdv+" abort="+s.abort);
check("HIGH_DV_NO_HANDOFF", s.state==11 && s.ready==0 && s.settle==0 && s.freq==170000 && s.abort==0);

// 2. Fast ramp then slope falls -> settle and handoff at actual brake freq.
resetPreBrake(1244,1245,155000,1244,0,0);
wv("g_pre_brake_test_ramp",1); wv("g_pre_brake_test_step",1);
run(0.3);
wv("g_pre_brake_test_ramp",0); wv("g_pre_brake_test_step",0); wv("g_pre_brake_test_vout_raw",1244);
run(1);
s=snap();
print("SCENARIO2 state="+s.state+" settle="+s.settle+" freq="+s.freq+" ready="+s.ready+" firstfreq="+s.firstfreq+" integral="+s.integral+" exit="+s.exit);
check("DV_FALL_ALLOWS_HANDOFF", s.state==3 && s.ready==1 && s.exit>=1244 && s.exit<1304);
check("PI_FIRST_APPLY_BUMPLESS", Math.abs(s.firstfreq-s.freq)<=200);

// 3. Window low -> no handoff, settle reaches 4, no abort.
resetPreBrake(1244,1200,155000,1200,0,0);
run(0.5);
s=snap();
print("SCENARIO3 state="+s.state+" result="+s.result+" cycles="+s.cycles+" settle="+s.settle+" freq="+s.freq+" ready="+s.ready+" abort="+s.abort);
check("WINDOW_LOW_NO_HANDOFF", s.state==11 && s.settle>=4 && s.ready==0 && s.abort==0);

// 4. Window high -> pre-brake abort.
resetPreBrake(1244,1310,155000,1244,0,0);
run(1);
s=snap();
print("SCENARIO4 state="+s.state+" result="+s.result+" abort="+s.abort+" ready="+s.ready);
check("WINDOW_HIGH_ABORT", s.result==10 && s.abort==2 && s.ready==0);

// 5. Stale ADC in pre-brake -> stale abort.
resetPreBrake(1244,1244,155000,1244,0,0);
session.expression.evaluate("EPwm1Regs.ETSEL.bit.SOCAEN = 0");
run(2);
s=snap();
print("SCENARIO5 state="+s.state+" result="+s.result+" abort="+s.abort+" ready="+s.ready);
check("STALE_ABORT", s.result==5 && s.ready==0);
session.expression.evaluate("EPwm1Regs.ETSEL.bit.SOCAEN = 1");

// 6. Brake timeout -> pre-brake timeout abort.
resetPreBrake(2000,1200,155000,1200,0,0);
run(4);
s=snap();
print("SCENARIO6 state="+s.state+" result="+s.result+" abort="+s.abort+" cycles="+s.cycles+" settle="+s.settle);
check("BRAKE_TIMEOUT_ABORT", s.result==11 && s.abort==1 && s.cycles>=300);

// 7. Sustained fast ramp -> frequency saturates at 170k, never above.
resetPreBrake(2000,1245,155000,1244,0,0);
wv("g_pre_brake_test_ramp",1); wv("g_pre_brake_test_step",5);
run(1);
s=snap();
print("SCENARIO7 state="+s.state+" freq="+s.freq+" maxdv="+s.maxdv+" ready="+s.ready);
check("FMAX_SATURATION_NO_EXCEED", s.freq==170000 && s.freq<=170000);

// 8. Slow dv/dt normal -> handoff at initial 155k without stepping.
resetPreBrake(1244,1244,155000,1244,0,0);
run(1);
s=snap();
print("SCENARIO8 state="+s.state+" settle="+s.settle+" freq="+s.freq+" ready="+s.ready+" firstfreq="+s.firstfreq+" integral="+s.integral);
check("SLOW_DV_NORMAL_HANDOFF", s.state==3 && s.ready==1 && s.freq==155000 && Math.abs(s.firstfreq-155000)<=200);
check("SLOW_DV_BUMPLESS", s.integral==-20480000);

// 9. Fast ramp never early handoff.
resetPreBrake(2000,1245,155000,1244,0,0);
wv("g_pre_brake_test_ramp",1); wv("g_pre_brake_test_step",5);
run(1);
s=snap();
print("SCENARIO9 state="+s.state+" settle="+s.settle+" ready="+s.ready+" freq="+s.freq);
check("FAST_DV_NEVER_EARLY_HANDOFF", s.state==11 && s.ready==0 && s.settle==0);

// 10. Re-run slow normal to confirm deterministic repeatability.
resetPreBrake(1244,1244,155000,1244,0,0);
run(1);
s=snap();
print("SCENARIO10 state="+s.state+" settle="+s.settle+" freq="+s.freq+" ready="+s.ready);
check("SLOW_DV_REPEAT_HANDOFF", s.state==3 && s.ready==1 && s.freq==155000);

print("SOL_W2_CANDIDATE4_PRE_BRAKE_SCENARIOS_PASS="+(failures==0?"TRUE":"FALSE"));
try{ session.terminate(); }catch(e){}
