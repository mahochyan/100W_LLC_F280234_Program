// READ-ONLY post-mortem: attach to the halted target WITHOUT load/reset,
// dump SoftStart ramp state to locate the REJECTED writer path.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
var env=ScriptingEnvironment.instance(); var server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession("D:\CCS21_workspace\Codex_Project\Stage6_FLASH_SHOT_REAL\LLC_100W_F28034_BRINGUP_DSH.out");
function addr(n){return session.expression.evaluate("&"+n);}
function rw(n){try{return session.memory.readWord(1,addr(n));}catch(e){return -1;}}
function rv32(n){try{var a=addr(n);return(session.memory.readWord(1,a)|(session.memory.readWord(1,a+1)<<16))>>>0;}catch(e){return -1;}}
function reg(e){try{return ""+session.expression.evaluate(e);}catch(err){return "<f>";}}
try{session.target.connect();}catch(e){}
print("STATE sys="+rw("g_system_state")+" pwm="+rw("g_pwm_enabled")+" fault="+rv32("g_fault_flags")+" ost="+reg("EPwm1Regs.TZFLG.bit.OST"));
print("SS result="+rw("g_softstart_result")+" state="+rw("g_softstart_state")+" request="+rw("g_softstart_request")+" ramp="+rw("g_softstart_ramp_active"));
print("SS abort_reason="+rw("g_softstart_abort_reason")+" stop_raw="+rw("g_softstart_stop_raw")+" final_pwm="+rw("g_softstart_final_pwm")+" final_ost="+rw("g_softstart_final_ost"));
print("SS stage="+rw("g_softstart_stage")+" stage_index="+rw("g_softstart_stage_index")+" cycles="+rv32("g_softstart_cycle_count")+" final_cycles="+rw("g_softstart_final_cycles"));
print("SS pwm_start_prepared="+rw("g_pwm_start_prepared")+" enable_result="+rw("g_pwm_enable_result")+" enable_req="+rw("g_pwm_enable_request")+" rising="+rv32("g_enable_rising_count"));
print("SS last_vout="+rw("g_softstart_last_vout_raw")+" last_max="+rw("g_softstart_last_vout_max")+" miss="+rw("g_adc_pwm_sync_consecutive_miss"));
print("SS pfm_mode="+rw("g_pfm_direction_test_mode")+" ceiling="+rw("g_softstart_hard_ceiling_raw")+" accept="+rw("g_softstart_accept_target_raw"));
print("TZFLG="+reg("EPwm1Regs.TZFLG.all")+" TZCTL="+reg("EPwm1Regs.TZCTL.all")+" AQCSFRC="+reg("EPwm1Regs.AQCSFRC.all"));
print("POSTMORTEM_DONE");
