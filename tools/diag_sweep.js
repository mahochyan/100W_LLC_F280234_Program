// diag_sweep.js - find where PI stops during frequency sweep
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
var OUT="D:\\CCS21_workspace\\Codex_Project\\evidence\\stage6_real_actuator_ost\\LLC_100W_F28034_BRINGUP_DSH.out";
var env=ScriptingEnvironment.instance(); var server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();
function addr(n){return session.expression.evaluate("&"+n);}
function rw(n){try{return session.memory.readWord(1,addr(n));}catch(e){return -1;}}
function rv32u(n){try{var a=addr(n);return(session.memory.readWord(1,a)|(session.memory.readWord(1,a+1)<<16))>>>0;}catch(e){return -1;}}
function wv(n,v){session.memory.writeWord(1,addr(n),v);}
function wv32(n,v){var a=addr(n);session.memory.writeWord(1,a,v&0xFFFF);session.memory.writeWord(1,a+1,(v>>>16)&0xFFFF);}
function reg(e){try{return ""+session.expression.evaluate(e);}catch(err){return "<f>";}}
function run(ms){session.target.runAsynch();java.lang.Thread.sleep(ms);session.target.halt();}
function snap(tag){
  print(tag+" sys="+rw("g_system_state")+" pwm="+rw("g_pwm_enabled")+" refv="+rw("g_control_reference_valid")+
   " arm="+rw("g_stage6_actuator_test_arm")+" rev="+rw("g_stage6_actuator_revoked")+
   " fault="+rv32u("g_fault_flags")+" seq="+rv32u("g_adc_sample_sequence")+
   " TBPRD="+reg("EPwm1Regs.TBPRD")+" ost="+reg("EPwm1Regs.TZFLG.bit.OST"));
}
session.target.connect();try{session.target.halt();}catch(e){}
session.memory.loadProgram(OUT);run(400);
wv("g_no_energy_test_mode",1);wv("g_fault_flags",0);run(20);
wv("g_bringup_stage",7);wv("g_comp_tz_loopback_verified",1);wv("g_diag_frequency_override",1);
wv("g_softstart_no_energy",1);wv("g_softstart_acceptance_mode",0);wv("g_softstart_accept_target_raw",1244);
wv("g_softstart_request",0);wv("g_softstart_result",0);wv("g_softstart_state",0);wv("g_system_state",1);
wv("g_stage6_synthetic_vout_raw",1244);wv("g_stage6_closeloop_vout_inject",1244);wv("g_stage6_transfer_request",0);
wv("g_pwm_enable_request",1);
var tr=0;for(var i=0;i<40;i++){run(40);try{tr=parseInt(rw("g_stage6_transfer_request"));}catch(e){}if(tr==1)break;}
print("transferred="+tr+" sys="+rw("g_system_state"));
wv("g_stage6_noenergy_test_mode",4);wv("g_stage6_noenergy_test_enable",1);
wv32("g_power_run_min_frequency_hz",80000);
wv("g_stage6_actuator_test_arm",1);wv("g_stage6_actuator_revoked",0);wv32("g_stage6_actuator_direct_cmd_hz",0);
snap("ARM ");
run(50);snap("STEADY ");
var seq=[150000,151000,152000,153000,154000,155000];
for(var i=0;i<seq.length;i++){
  wv32("g_stage6_actuator_direct_cmd_hz",seq[i]);
  run(200);
  snap("@"+seq[i]+" ");
}
print("DONE");
