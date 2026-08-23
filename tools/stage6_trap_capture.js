// stage6_trap_capture.js - HW breakpoint at 0x3FF8CD, halt, full register + contiguous stack dump.
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
out("TC connect OK");
session.memory.loadProgram(OUT);
out("TC load OK");
try{ session.breakpoint.removeAll(); }catch(e){}
try{ session.breakpoint.add(0x3FF8CD); out("TC hw bp @0x3FF8CD set"); }catch(e){ out("TC bp ERR "+e); }
session.target.runAsynch();
java.lang.Thread.sleep(400);
try{ session.target.halt(); }catch(e){}
var pc=session.memory.readRegister("PC");
out("TC PC=0x"+pc.toString(16)+" (0x3FF8CD = trap)");
function R(n){ try{ return session.memory.readRegister(n); }catch(e){ return -1; } }
out("TC RPC="+R("RPC")+" (0x"+R("RPC").toString(16)+")");
out("TC SP="+R("SP")+" (0x"+R("SP").toString(16)+")");
out("TC ST0="+R("ST0")+" ST1="+R("ST1")+" IER="+R("IER")+" IFR="+R("IFR")+" DP="+R("DP"));
for(var i=0;i<8;i++){ out("TC AR"+i+"="+R("AR"+i)+" XAR"+i+"=0x"+R("XAR"+i).toString(16)); }
// contiguous stack dump SP-24 .. SP+24
var sp=R("SP");
out("TC STACK (contiguous, SP-24..SP+24):");
for(var a=sp-24;a<=sp+24;a++){
  out("TC 0x"+a.toString(16)+" = 0x"+rdw(a).toString(16));
}
out("TC DONE");
try{ session.terminate(); }catch(e){}
