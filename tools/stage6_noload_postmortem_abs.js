// READ-ONLY post-mortem by absolute address (no symbols needed).
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
var env=ScriptingEnvironment.instance(); var server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();
function rw16(a){try{return session.memory.readWord(1,a);}catch(e){return -1;}}
function rw32(a){try{return (session.memory.readWord(1,a)|(session.memory.readWord(1,a+1)<<16))>>>0;}catch(e){return -1;}}
try{session.target.connect();}catch(e){}
print("g_system_state="+rw16(0x00008c0f));
print("g_pwm_enabled="+rw16(0x00008c05));
print("g_fault_flags="+rw32(0x00008d5a));
print("g_softstart_result="+rw16(0x00008cdd));
print("g_softstart_state="+rw16(0x00008c26));
print("g_softstart_request="+rw16(0x00008cd9));
print("g_softstart_ramp_active="+rw16(0x00008cea));
print("g_softstart_abort_reason="+rw16(0x00008c30));
print("g_softstart_stop_raw="+rw16(0x00008ce3));
print("g_softstart_final_pwm="+rw16(0x00008ce4));
print("g_softstart_final_ost="+rw16(0x00008ce5));
print("g_softstart_stage="+rw16(0x00008cde));
print("g_softstart_stage_index="+rw16(0x00008cdf));
print("g_softstart_cycle_count="+rw32(0x00008e2e));
print("g_softstart_final_cycles="+rw16(0x00008ce0));
print("g_pwm_start_prepared="+rw16(0x00008c32));
print("g_pwm_enable_result="+rw16(0x00008c07));
print("g_pwm_enable_request="+rw16(0x00008c06));
print("g_enable_rising_count="+rw32(0x00008dc8));
print("g_softstart_last_vout_raw="+rw16(0x00008ce1));
print("g_softstart_last_vout_max="+rw16(0x00008ce2));
print("g_adc_pwm_sync_consecutive_miss="+rw16(0x00008d09));
print("g_pfm_direction_test_mode="+rw16(0x00008ceb));
print("g_softstart_hard_ceiling_raw="+rw16(0x00008cdc));
print("g_softstart_accept_target_raw="+rw16(0x00008cdb));
print("POSTMORTEM_DONE");