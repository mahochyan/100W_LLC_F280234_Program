// W5 fire-attempt recovery: resume target, let firmware self-abort
// (charge timeout / CMPSS hard limit -> HardStop), then read telemetry.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
var env=ScriptingEnvironment.instance(),server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();
function addr(n){return session.expression.evaluate("&"+n);}
function rw(n){return session.memory.readWord(1,addr(n));}
function rv32u(n){var a=addr(n),lo=session.memory.readWord(1,a),hi=session.memory.readWord(1,a+1);return (lo|(hi<<16))>>>0;}
var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_W5_LADDER\\LLC_100W_F28034_OPEN_LOOP_STEADY.out";
var session=(function(){var env=ScriptingEnvironment.instance(),server=env.getServer("DebugServer.1");server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");return server.openSession();})();
session.target.connect();
session.memory.loadProgram(OUT);   // same SHA image reload = reset to safe init
session.target.runAsynch();java.lang.Thread.sleep(600);session.target.halt();
print("recovered: faults="+rv32u("g_fault_flags")+" pwm="+rw("g_pwm_enabled")+
      " sysstate="+rw("g_system_state")+" bringup="+rw("g_bringup_stage")+
      " vout="+rw("g_adc_vout_raw")+" loopback="+rw("g_comp_tz_loopback_verified"));