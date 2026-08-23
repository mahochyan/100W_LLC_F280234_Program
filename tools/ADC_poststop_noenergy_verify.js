// STAGE5A ADC post-stop cleanup - NO-ENERGY offline verification (no real power)
// Loads the new OUT (SS_HardStop fix), runs SoftStart->PFM window->scheduled OST
// in no-energy mode, then checks PWM=0/OST=1/SOCAEN=0/ADC sw-safe/ADCINTOVF=0,
// then simulates debugger halt/delay and confirms no FAULT_ADC_STALE_OVERFLOW.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
var env = ScriptingEnvironment.instance();
var server = env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session = server.openSession();
function addr(n){return session.expression.evaluate("&"+n);}
function rv(n){try{return ""+session.memory.readWord(1,addr(n));}catch(e){return "<f>";}}
function rv32(n){try{var a=addr(n);var lo=session.memory.readWord(1,a);var hi=session.memory.readWord(1,a+1);return ""+(lo|(hi<<16));}catch(e){return "<f>";}}
function wv(n,v){session.memory.writeWord(1,addr(n),v);}
function wv32(n,v){var a=addr(n);session.memory.writeWord(1,a,v&0xFFFF);session.memory.writeWord(1,a+1,(v>>>16)&0xFFFF);}
function reg(e){try{return ""+session.expression.evaluate(e);}catch(err){return "<f>";}}
var CAL = {gain:0.008089325, offset:-0.063715};
session.target.connect();
try{session.target.halt();}catch(e){}
session.memory.loadProgram("D:\\CCS21_workspace\\Codex_Project\\Debug\\LLC_100W_F28034_BRINGUP_DSH.out");
session.target.runAsynch();
java.lang.Thread.sleep(200);
session.target.halt();
// no-energy SoftStart config (g_no_energy_test_mode=0 -> real fault path active)
wv("g_bringup_stage",4);
wv("g_comp_tz_loopback_verified",1);
wv("g_diag_frequency_override",1);
wv32("g_test_run_id",0x250000DE); // no-energy verify RUN_ID
wv("g_softstart_acceptance_mode",1);
wv("g_softstart_no_energy",1);     // NO-ENERGY: synthetic VOUT
wv("g_no_energy_test_mode",0);     // keep fault path active to validate fix
wv("g_softstart_accept_target_raw",1244);
wv("g_softstart_hard_ceiling_raw",1491);
wv("g_pfm_direction_test_mode",1); // 150k window (45cyc) for cleanup sanity
wv("g_softstart_request",0);
wv("g_softstart_result",0);
// PRE gate
var pf=parseInt(rv("g_fault_flags")), pp=parseInt(rv("g_pwm_enabled")), po=parseInt(reg("EPwm1Regs.TZFLG.bit.OST"));
print("PRE fault="+pf+" pwm="+pp+" ost="+po);
// TRIGGER (NO POLLING)
wv("g_softstart_request",1);
session.target.runAsynch();
java.lang.Thread.sleep(2000);   // single fixed sleep, no target access
session.target.halt();          // single halt
print("=== POST-STOP STATE ===");
print("result="+rv("g_softstart_result"));
print("pwm="+rv("g_pwm_enabled")+" ost="+reg("EPwm1Regs.TZFLG.bit.OST"));
print("ETSEL_SOCAEN="+reg("EPwm1Regs.ETSEL.bit.SOCAEN"));
print("adc_trigger_mode="+rv("g_adc_trigger_mode"));
print("ADCINTOVF="+reg("AdcRegs.ADCINTOVF.all"));
print("ADCINTFLG="+reg("AdcRegs.ADCINTFLG.bit.ADCINT1"));
print("fault_flags="+rv("g_fault_flags"));
var soca=parseInt(reg("EPwm1Regs.ETSEL.bit.SOCAEN"));
var ovf=parseInt(reg("AdcRegs.ADCINTOVF.all"));
var tm=parseInt(rv("g_adc_trigger_mode"));
var f1=parseInt(rv("g_fault_flags"));
// simulate debugger halt/delay repeats -> must NOT produce FAULT_ADC_STALE_OVERFLOW
var fMax=0;
for(var k=0;k<6;k++){ session.target.halt(); java.lang.Thread.sleep(100); session.target.runAsynch(); java.lang.Thread.sleep(60); var fv=parseInt(rv("g_fault_flags")); if(fv>fMax)fMax=fv; }
session.target.halt();
print("=== AFTER simulated debug halt repeats ===");
print("fault_flags_max="+fMax);
print("ADCINTOVF_after="+reg("AdcRegs.ADCINTOVF.all"));
print("pwm_after="+rv("g_pwm_enabled")+" ost_after="+reg("EPwm1Regs.TZFLG.bit.OST"));
var pass = (parseInt(rv("g_pwm_enabled"))==0 && parseInt(reg("EPwm1Regs.TZFLG.bit.OST"))==1 &&
            soca==0 && ovf==0 && tm==0 && f1==0 && fMax==0);
print(pass ? "*** ADC_POSTSTOP_CLEANUP_NOENERGY_PASS ***" : "*** NOENERGY_CHECK_FAILED ***");
session.target.disconnect();
print("DONE");
