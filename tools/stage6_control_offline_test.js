// STAGE6 OFFLINE CONTROL — 8-case no-energy on-target self-test
// Loads the STAGE6 OUT, enters RUN (no energy), asserts g_offline_test_request,
// waits for CTRL_SlowTask to run CTRL_OfflineSelfTest(), reads g_offline_test_status.
// No real PWM is touched (write-gate LLC_HARDWARE_PI_VALIDATED=0).
// NOTE: targets the STAGE6 FLASH OUT. Board run is a LATER stage (J forbids loadProgram this task).
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
function reg(e){try{return ""+session.expression.evaluate(e);}catch(err){return "<f>";}}

session.target.connect();
try{session.target.halt();}catch(e){}
session.memory.loadProgram("D:\\CCS21_workspace\\Codex_Project\\Debug\\LLC_100W_F28034_BRINGUP_DSH.out");
session.target.runAsynch();
java.lang.Thread.sleep(200);
session.target.halt();

// Preconditions to reach CTRL_SlowTask (SM_Run, non-FAULT).
wv("g_fault_flags",0);
wv("g_system_state",2);          // RUN (non-FAULT) -> SM_Run -> CTRL_SlowTask
wv("g_pwm_enabled",0);           // no energy
wv("g_bringup_stage",6);         // BRINGUP_STAGE_6_CLOSED_LOOP (or higher)
wv("g_offline_test_request",1);  // arm the self-test

session.target.runAsynch();
var done=0, st=0;
for (var i=0;i<300;i++){ java.lang.Thread.sleep(20);
  try{ st=parseInt(rv("g_offline_test_request")); if(st==0){done=1;break;} }catch(e){}
  try{ if(parseInt(rv("g_offline_test_status"))!=0){done=1;break;} }catch(e){}
}
session.target.halt();
var mask=parseInt(rv("g_offline_test_status"));
print("=== STAGE6 8-CASE OFFLINE SELF-TEST ===");
print("g_offline_test_request="+rv("g_offline_test_request"));
print("g_offline_test_status=0x"+mask.toString(16));
print("pwm_isolated="+rv("g_offline_pwm_isolated"));
var bits=[["PFM_SIGN_LOW_VOUT","0x01"],["PFM_SIGN_HIGH_VOUT","0x02"],["EQUAL_HOLDS","0x04"],
          ["LOWER_CLAMP","0x08"],["UPPER_CLAMP","0x10"],["ADC_STALE_FREEZE","0x20"],
          ["ADC_RECOVERY_NO_JUMP","0x40"],["PWM_REGISTER_ISOLATION","0x80"]];
var all=1;
for (var i=0;i<bits.length;i++){ var b=parseInt(bits[i][1]); var ok=((mask&b)==b);
  if(!ok) all=0; print((ok?"PASS ":"FAIL ")+bits[i][0]); }
print("STAGE6_CONTROL_OFFLINE_PASS="+(all?"TRUE":"FALSE"));
print("TBPRD="+reg("EPwm1Regs.TBPRD")+" CMPA="+reg("EPwm1Regs.CMPA.half.CMPA")+" CMPB="+reg("EPwm1Regs.CMPB")
     +" DBRED="+reg("EPwm1Regs.DBRED")+" DBFED="+reg("EPwm1Regs.DBFED"));
print("shadow_hz="+rv32("g_control_shadow_frequency_hz")+" committed_hz="+rv32("g_control_frequency_hz"));
print("error="+rv("g_control_error_volts")+" unsat="+rv("g_control_frequency_unsat_hz")
   +" clamped="+rv("g_control_frequency_clamped_hz"));
session.target.disconnect();
print("DONE");