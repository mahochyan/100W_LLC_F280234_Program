// Read-only W3 boot diagnostics. No request is written and PWM remains OST-clamped.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_OL_STEADY\\LLC_100W_F28034_OPEN_LOOP_STEADY.out";
var env=ScriptingEnvironment.instance(),server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();
function addr(n){return session.expression.evaluate("&"+n);}
function rw(n){return session.memory.readWord(1,addr(n));}
function rv32u(n){var a=addr(n),lo=session.memory.readWord(1,a),hi=session.memory.readWord(1,a+1);return (lo|(hi<<16))>>>0;}
function reg(e){return parseInt(session.expression.evaluate(e));}
function run(ms){session.target.runAsynch();java.lang.Thread.sleep(ms);session.target.halt();}
try{session.target.connect();}catch(e){}
try{session.target.halt();}catch(e){}
session.memory.loadProgram(OUT);run(400);
print("W3_BOOT_NO_POWER_DIAG state="+rw("g_cal_hold_state")+
      " mode_req="+rw("g_cal_hold_mode_request")+
      " mode_active="+rw("g_cal_hold_mode_active")+
      " request="+rw("g_cal_hold_request")+
      " measure_req="+rw("g_cal_measure_request")+
      " duration="+rw("g_cal_hold_duration_ms")+
      " sys="+rw("g_system_state")+" stage="+rw("g_bringup_stage")+
      " pwm="+rw("g_pwm_enabled")+" ost="+reg("EPwm1Regs.TZFLG.bit.OST")+
      " tzint="+reg("EPwm1Regs.TZFLG.bit.INT")+
      " fault=0x"+rv32u("g_fault_flags").toString(16));
try{session.terminate();}catch(e){}
