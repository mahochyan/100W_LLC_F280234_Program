// READ-ONLY diagnostic: after load+init, dump SoftStart/enable-related state.
// NO power: never writes pwm_enable_request / arm / softstart request.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_FLASH_SHOT_REAL\\LLC_100W_F28034_BRINGUP_DSH.out";
var env=ScriptingEnvironment.instance(); var server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();
function addr(n){return session.expression.evaluate("&"+n);}
function rw(n){try{return session.memory.readWord(1,addr(n));}catch(e){return -1;}}
function rv32(n){try{var a=addr(n);return(session.memory.readWord(1,a)|(session.memory.readWord(1,a+1)<<16))>>>0;}catch(e){return -1;}}
function reg(e){try{return ""+session.expression.evaluate(e);}catch(err){return "<f>";}}
function run(ms){session.target.runAsynch();java.lang.Thread.sleep(ms);session.target.halt();}
try{session.target.connect();}catch(e){}
session.memory.loadProgram(OUT);
run(300);
print("DIAG sys="+rw("g_system_state")+" pwm="+rw("g_pwm_enabled")+" fault="+rv32("g_fault_flags"));
print("DIAG softstart_result="+rw("g_softstart_result")+" state="+rw("g_softstart_state")+" request="+rw("g_softstart_request")+" ramp_active="+rw("g_softstart_ramp_active"));
print("DIAG ceiling="+rw("g_softstart_hard_ceiling_raw")+" accept="+rw("g_softstart_accept_target_raw")+" voutcal="+rw("g_board_vout_cal_valid"));
print("DIAG enable_result="+rw("g_pwm_enable_result")+" enable_req="+rw("g_pwm_enable_request")+" rising="+rv32("g_enable_rising_count"));
print("DIAG shot_arm="+rw("g_first_real_pi_shot_arm")+" shot_state="+rw("g_first_real_pi_shot_state")+" abort="+rw("g_first_real_pi_shot_abort"));
print("DIAG handoff="+rw("g_softstart_handoff_result")+" ref_valid="+rw("g_control_reference_valid")+" comp="+rw("g_comp_tz_loopback_verified"));
print("DIAG vout_raw="+rw("g_adc_vout_raw")+" vout_filt="+rw("g_adc_vout_filtered_raw")+" ost="+reg("EPwm1Regs.TZFLG.bit.OST"));
print("DIAG pfm_mode="+rw("g_pfm_direction_test_mode")+" run_id="+rv32("g_test_run_id")+" stage="+rw("g_bringup_stage"));
print("DIAG_DONE");
