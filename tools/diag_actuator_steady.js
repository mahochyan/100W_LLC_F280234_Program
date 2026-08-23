// diag_actuator_steady.js - isolate steady-state realtime cost (mode=4 observe)
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
function clr(){wv32("g_stage6_adc_isr_count",0);wv32("g_fast_tick",0);wv32("g_fast_isr_cycles_max",0);wv32("g_fast_isr_cycles_sum",0);wv32("g_fast_isr_cycles_count",0);wv32("g_adc_isr_cycles_max",0);wv32("g_control_exec_cycles_max",0);wv32("g_stage6_actuator_cycles_max",0);wv32("g_stage6_actuator_cycles_sum",0);wv32("g_stage6_actuator_cycles_count",0);wv32("g_fast_isr_overrun_count",0);wv32("g_timer0_entry_count",0);wv32("g_timer0_entry_interval_min",0);wv32("g_timer0_entry_interval_max",0);}
function measure(label){
 var adc=rv32u("g_stage6_adc_isr_count");var tick=rv32u("g_fast_tick");
 var fmax=rv32u("g_fast_isr_cycles_max");var fsum=rv32u("g_fast_isr_cycles_sum");var fcnt=rv32u("g_fast_isr_cycles_count");
 var amax=rv32u("g_adc_isr_cycles_max");var pmax=rv32u("g_control_exec_cycles_max");
 var actmax=rv32u("g_stage6_actuator_cycles_max");var actsum=rv32u("g_stage6_actuator_cycles_sum");var actcnt=rv32u("g_stage6_actuator_cycles_count");
 var ovr=rv32u("g_fast_isr_overrun_count");var tmin=rv32u("g_timer0_entry_interval_min");var tmax=rv32u("g_timer0_entry_interval_max");
 var rate=tick>0?Math.round(adc*50000/tick):0;
 print(label+" adc="+adc+" tick="+tick+" rate="+rate+" TINT0max="+fmax+" avg="+(fcnt?Math.round(fsum/fcnt):0)+" PIcore="+pmax+" act_max="+actmax+" act_avg="+(actcnt?Math.round(actsum/actcnt):0)+" ADCmax="+amax+" overrun="+ovr+" t0min="+tmin+" t0max="+tmax+" SOCPR="+reg("EPwm1Regs.ETPS.bit.SOCAPRD")+" TBPRD="+reg("EPwm1Regs.TBPRD"));
}
session.target.connect();try{session.target.halt();}catch(e){}
session.memory.loadProgram(OUT);run(400);
wv("g_no_energy_test_mode",1);wv("g_fault_flags",0);run(20);
wv("g_bringup_stage",7);wv("g_comp_tz_loopback_verified",1);wv("g_diag_frequency_override",1);
wv("g_softstart_no_energy",1);wv("g_softstart_acceptance_mode",0);wv("g_softstart_accept_target_raw",1244);
wv("g_softstart_request",0);wv("g_softstart_result",0);wv("g_softstart_state",0);wv("g_system_state",1);
wv("g_stage6_synthetic_vout_raw",1244);
wv("g_stage6_closeloop_vout_inject",1244);wv("g_stage6_transfer_request",0);
wv("g_pwm_enable_request",1);
var tr=0;for(var i=0;i<40;i++){run(40);try{tr=parseInt(rw("g_stage6_transfer_request"));}catch(e){}if(tr==1)break;}
print("transferred="+tr+" sys="+rw("g_system_state")+" TBPRD="+reg("EPwm1Regs.TBPRD")+" ost="+reg("EPwm1Regs.TZFLG.bit.OST")+" SOCPR(2=ET3)="+reg("EPwm1Regs.ETPS.bit.SOCAPRD"));
wv("g_stage6_noenergy_test_mode",4);   // observe mode: no synthetic overwrite / double PI
wv("g_stage6_noenergy_test_enable",1);
wv("g_stage6_actuator_test_arm",1);wv("g_stage6_actuator_revoked",0);wv32("g_stage6_actuator_direct_cmd_hz",0);
print("armed test_arm="+rw("g_stage6_actuator_test_arm"));
run(100);
clr();run(400);measure("STEADY_150k");
print("DONE");
