// stage6_usdelay_verify.js - verify usDelay(.TI.ramfunc) is NOT copied to RAM 0x801D.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
var OUT = "D:\\CCS21_workspace\\Codex_Project\\evidence\\stage6_on_target_shadow_noenergy\\LLC_100W_F28034_BRINGUP_DSH.out";
var env = ScriptingEnvironment.instance();
var server = env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session = server.openSession();
function out(s){ print(s); java.lang.System.out.flush(); }
function rdw(a){ try{ return session.memory.readWord(0,a)&0xFFFF; }catch(e){ return -1; } }
session.target.connect();
try{ session.target.halt(); }catch(e){}
out("UV connect OK");
session.memory.loadProgram(OUT);
out("UV load OK");
// InitFlash copy region: ramfuncs LOAD 0x3E8000 -> RUN 0x8000, size 0x1D
// usDelay: .TI.ramfunc LOAD 0x3EA5AA -> RUN 0x801D, size 4
out("UV InitFlash: ram[0x8000]="+rdw(0x8000).toString(16)+" flash[0x3E8000]="+rdw(0x3E8000).toString(16));
out("UV usDelay: ram[0x801D]="+rdw(0x801D).toString(16)+" flash[0x3EA5AA]="+rdw(0x3EA5AA).toString(16));
out("UV usDelay4: ram[0x801D..0x8020]="+rdw(0x801D).toString(16)+" "+rdw(0x801E).toString(16)+" "+rdw(0x801F).toString(16)+" "+rdw(0x8020).toString(16));
out("UV usDelayFLASH4: flash[0x3EA5AA..0x3EA5AD]="+rdw(0x3EA5AA).toString(16)+" "+rdw(0x3EA5AB).toString(16)+" "+rdw(0x3EA5AC).toString(16)+" "+rdw(0x3EA5AD).toString(16));
out("UV COPIED = "+(rdw(0x801D)===rdw(0x3EA5AA) ? "TRUE" : "FALSE"));
out("UV DONE");
try{ session.terminate(); }catch(e){}
