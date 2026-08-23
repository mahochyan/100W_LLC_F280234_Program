// stage6_flashscan.js - scan flash around TINT0_ISR/main for 0xFFFF (unprogrammed) runs.
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
out("FS connect OK");
session.memory.loadProgram(OUT);
out("FS load OK");
function scan(label, start, n){
  var ff=0, first=-1, total=0;
  for(var i=0;i<n;i++){ var v=rdw(start+i); total++; if(v===0xFFFF){ ff++; if(first<0)first=i; } }
  out("FS "+label+" @0x"+start.toString(16)+" +"+n+" words: 0xFFFF count="+ff+" / "+total+(first>=0?(" first@+"+first):""));
}
scan("TINT0_ISR",0x3E8E9C,96);
scan("main",0x3EA41D,160);
scan("startup c_int00",0x3E9BE9,64);
scan("codestart",0x3F7FF6,4);
out("FS DONE");
try{ session.terminate(); }catch(e){}
