// stage6_ti_copy_verify.js - G: verify .TI.ramfunc copy to RAM; H: usDelay RAM execution.
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
function R(n){ try{ return session.memory.readRegister(n); }catch(e){ return -1; } }
session.target.connect();
try{ session.target.halt(); }catch(e){}
out("TCV connect OK");
session.memory.loadProgram(OUT);
out("TCV load OK");
try{ session.breakpoint.removeAll(); }catch(e){}

// ---- G: halt at System_Init InitFlash call (after both copy loops) ----
try{ session.breakpoint.add(0x3E977D); out("TCV bp @0x3E977D (System_Init InitFlash call)"); }catch(e){ out("TCV bp ERR "+e); }
session.target.runAsynch();
java.lang.Thread.sleep(300);
try{ session.target.halt(); }catch(e){}
var pc=R("PC");
out("TCV G pc=0x"+pc.toString(16)+" (expect 0x3e977d)");
var legacy_ram=rdw(0x8000), legacy_fl=rdw(0x3E8000);
var ti_ram=rdw(0x801D), ti_fl=rdw(0x3EA5C6);
var ti4=[rdw(0x801D),rdw(0x801E),rdw(0x801F),rdw(0x8020)];
var fl4=[rdw(0x3EA5C6),rdw(0x3EA5C7),rdw(0x3EA5C8),rdw(0x3EA5C9)];
out("TCV legacy: ram[0x8000]=0x"+legacy_ram.toString(16)+" flash[0x3E8000]=0x"+legacy_fl.toString(16)+" match="+(legacy_ram===legacy_fl));
out("TCV TI: ram[0x801D]=0x"+ti_ram.toString(16)+" flash[0x3EA5C6]=0x"+ti_fl.toString(16)+" match="+(ti_ram===ti_fl));
out("TCV TI ram4="+ti4.map(function(v){return "0x"+v.toString(16);}).join(","));
out("TCV TI fl4="+fl4.map(function(v){return "0x"+v.toString(16);}).join(","));
out("TCV ON_TARGET_TI_RAMFUNC_COPY_PASS="+(ti_ram===ti_fl));
try{ session.breakpoint.removeAll(); }catch(e){}

// ---- H: usDelay entry in RAM (0x801D) ----
try{ session.breakpoint.add(0x801D); out("TCV bp @0x801D (usDelay RUN)"); }catch(e){ out("TCV bp ERR2 "+e); }
session.target.runAsynch();
java.lang.Thread.sleep(400);
try{ session.target.halt(); }catch(e){}
var pc2=R("PC");
out("TCV H pc=0x"+pc2.toString(16)+" (expect 0x801d = usDelay in RAML0)");
try{ session.breakpoint.removeAll(); }catch(e){}

// ---- H: verify usDelay returns to InitAdc LRETR ----
try{ session.breakpoint.add(0x3EA378); out("TCV bp @0x3EA378 (InitAdc LRETR after usDelay)"); }catch(e){ out("TCV bp ERR3 "+e); }
java.lang.Thread.sleep(300);
try{ session.target.halt(); }catch(e){}
var pc3=R("PC");
out("TCV H pc=0x"+pc3.toString(16)+" (expect 0x3ea378 = usDelay returned to InitAdc)");
out("TCV USDELAY_RAM_EXECUTION_PASS="+(pc3===0x3EA378||pc3===0x3EA397||pc3===0x3EA398));
try{ session.breakpoint.removeAll(); }catch(e){}
out("TCV DONE");
try{ session.terminate(); }catch(e){}
