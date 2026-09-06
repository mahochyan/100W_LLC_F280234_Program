// Attach-only W4 V15 post-host status probe.  Never loads, halts, resumes,
// reads/writes target memory, or touches a register.  It reports only the
// debugger's CPU halt state and disconnects immediately.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);

var env=ScriptingEnvironment.instance();
var server=env.getServer("DebugServer.1");
env.setScriptTimeout(30000);
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();
session.setScriptTimeout(30000);
var connected=false;
try {
  session.target.connect();
  connected=true;
  print("V15_ATTACH_ONLY_IS_HALTED="+
        (session.target.isHalted()?"TRUE":"FALSE"));
} finally {
  if(connected){try{session.terminate();}catch(e){}}
}
