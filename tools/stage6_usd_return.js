// stage6_usdelay_return.js - verify usDelay returns to InitAdc LRETR.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
var OUT = "D:\\CCS21_workspace\\Codex_Project\\evidence\\stage6_on_target_shadow_noenergy\\LLC_100W_F28034_BRINGUP_DSH.out";
var env = ScriptingEnvironment.instance();
var server = env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session = server.openSession();
function out(s){ print(s); java.lang.System.out.flush(); }
function R(n){ try{ return session.memory.readRegister(n); }catch(e){ return -1; } }
session.target.connect();
try{ session.target.halt(); }catch(e){}
out("UDR connect OK");
session.memory.loadProgram(OUT);
try{ session.breakpoint.removeAll(); }catch(e){}
// bp at usDelay entry, run, hit, then bp at InitAdc LRETR and RUN again
try{ session.breakpoint.add(0x801D); out("UDR bp usDelay @0x801D"); }catch(e){ out("UDR bpE1 "+e); }
session.target.runAsynch(); java.lang.Thread.sleep(400);
try{ session.target.halt(); }catch(e){}
out("UDR usDelay entry PC=0x"+R("PC").toString(16));
try{ session.breakpoint.removeAll(); }catch(e){}
try{ session.breakpoint.add(0x3EA378); out("UDR bp InitAdc LRETR @0x3EA378"); }catch(e){ out("UDR bpE2 "+e); }
session.target.runAsynch(); java.lang.Thread.sleep(500);
try{ session.target.halt(); }catch(e){}
out("UDR after usDelay return PC=0x"+R("PC").toString(16)+" (expect 0x3ea378)");
out("UDR USDELAY_RETURN_OK="+(R("PC")===0x3EA378));
try{ session.breakpoint.removeAll(); }catch(e){}
out("UDR DONE");
try{ session.terminate(); }catch(e){}
