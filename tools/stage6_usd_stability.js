// stage6_usdelay_and_stability.js - H: deterministic usDelay-return verify; I: 5x2s continuous stability.
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
function rdw(a){ try{ return session.memory.readWord(1,a)&0xFFFF; }catch(e){ return -1; } }
function rv32(a){ var lo=rdw(a), hi=rdw(a+1); if(lo<0||hi<0)return -1; return (lo|(hi<<16))>>>0; }
session.target.connect();
try{ session.target.halt(); }catch(e){}
out("US connect OK");
session.memory.loadProgram(OUT);
try{ session.breakpoint.removeAll(); }catch(e){}

// H: deterministic usDelay-return -> InitAdc LRETR
try{ session.breakpoint.add(0x3EA378); out("US bp InitAdc LRETR @0x3EA378"); }catch(e){ out("US bpE "+e); }
session.target.runAsynch();
java.lang.Thread.sleep(700);
try{ session.target.halt(); }catch(e){}
var pc=R("PC");
out("H usDelay-return PC=0x"+pc.toString(16)+" (expect 0x3ea378 InitAdc LRETR after usDelay)");
out("H USDELAY_RAM_EXECUTION_PASS="+(pc===0x3EA378));
try{ session.breakpoint.removeAll(); }catch(e){}

// I: 5x2s continuous stability
var prev=-1, ok=true;
for(var i=1;i<=5;i++){
  session.target.runAsynch();
  java.lang.Thread.sleep(2000);
  try{ session.target.halt(); }catch(e){}
  var pc2=R("PC"), tick=rv32(0x8E58);
  var trapped=(pc2===0x3FF8CD);
  var grew=(tick>prev);
  out("I run#"+i+" PC=0x"+pc2.toString(16)+" g_fast_tick="+tick+" grew="+grew+" trap="+trapped);
  if(trapped) ok=false;
  if(prev>=0 && !grew) ok=false;
  prev=tick;
}
out("I CONTINUOUS_FLASH_RUNTIME_PASS="+ok);
out("US DONE");
try{ session.terminate(); }catch(e){}
