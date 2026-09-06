importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
var env=ScriptingEnvironment.instance(),server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();
session.target.connect();try{session.target.halt();}catch(e){}
session.memory.loadProgram("D:\\CCS21_workspace\\Codex_Project\\Stage6_W5_LADDER\\LLC_100W_F28034_OPEN_LOOP_STEADY.out");
session.target.runAsynch();java.lang.Thread.sleep(800);session.target.halt();
function a(n){return session.expression.evaluate("&"+n);}
function rw(n){return session.memory.readWord(1,a(n));}
function rv32(n){var x=a(n),lo=session.memory.readWord(1,x),hi=session.memory.readWord(1,x+1);return (lo|(hi<<16))>>>0;}
print("POSTLOAD faults="+rv32("g_fault_flags")+" vout="+rw("g_adc_vout_raw")+
      " vin_sym_NA"+" pwm="+rw("g_pwm_enabled")+
      " stage="+rw("g_bringup_stage")+" sys="+rw("g_system_state")+
      " loopback="+rw("g_comp_tz_loopback_verified")+
      " tz1raw="+session.expression.evaluate("EPwm1Regs.TZFLG.all"));