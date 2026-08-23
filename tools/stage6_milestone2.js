// stage6_milestone2.js - robust FLASH startup milestone (one breakpoint at a time).
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
var OUT = "D:\\CCS21_workspace\\Codex_Project\\evidence\\stage6_on_target_shadow_noenergy\\LLC_100W_F28034_BRINGUP_DSH.out";
var env = ScriptingEnvironment.instance();
var server = env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session = server.openSession();
function out(s){ print(s); java.lang.System.out.flush(); }
function clearAllBps(){
  try{ session.breakpoint.removeAll(); }catch(e){}
  try{ java.lang.Thread.sleep(20); }catch(e){}
}
function rv32(n){ var a=session.expression.evaluate("&"+n); return (session.memory.readWord(1,a)|(session.memory.readWord(1,a+1)<<16))>>>0; }
var milestones = [
  [0x3F7FF6, "code_start"],
  [0x3E9BE9, "_c_int00"],
  [0x3EA41D, "_main"],
  [0x3E99B0, "_System_Init"],
  [0x00008000, "_InitFlash(ram0x8000)"],
  [0x3EA37B, "_APP_Init"]
];
session.target.connect();
try{ session.target.halt(); }catch(e){ out("halt1 ERR "+e); }
out("M2 connect/halt OK");
session.memory.loadProgram(OUT);
out("M2 load OK PC=0x"+session.memory.readRegister("PC").toString(16));
clearAllBps();
var seq=[];
var failed=false;
for(var i=0;i<milestones.length;i++){
  var addr=milestones[i][0], label=milestones[i][1];
  clearAllBps();
  var bpid=null;
  try{ bpid=session.breakpoint.add(addr); }catch(e){ out("  add bp "+label+" ERR "+e); failed=true; break; }
  session.target.runAsynch();
  java.lang.Thread.sleep(150);
  try{ session.target.halt(); }catch(e){}
  var pc=session.memory.readRegister("PC");
  var hit = (pc===addr);
  out("M2 milestone "+label+" @0x"+addr.toString(16)+" -> PC=0x"+pc.toString(16)+" "+(hit?"HIT":"MISS"));
  seq.push(label+":"+hit);
  if(!hit){
    out("M2  PC=0x"+pc.toString(16)+" ("+pc+")");
    if(pc===0x3FF8CD || pc>=0x3FF800){ out("M2  ** ITRAP_OR_ROM_TRAP_OBSERVED @0x"+pc.toString(16)); }
    // N: dump regs + stack
    try{ out("M2  SP="+session.memory.readRegister("SP")+" RPC="+session.memory.readRegister("RPC")+" ST0="+session.memory.readRegister("ST0")+" ST1="+session.memory.readRegister("ST1")+" IER="+session.memory.readRegister("IER")+" IFR="+session.memory.readRegister("IFR")); }catch(e){}
    try{
      var sp=session.memory.readRegister("SP");
      out("M2  stack top 8 @0x"+sp.toString(16)+":");
      for(var k=0;k<8;k++){ out("   0x"+(sp+k).toString(16)+"="+(session.memory.readWord(0,sp+k)&0xFFFF).toString(16)); }
    }catch(e){ out("M2  stack read ERR "+e); }
    failed=true; break;
  }
  try{ session.breakpoint.remove(bpid); }catch(e){}
}
out("M2 sequence: "+seq.join(" | "));
if(failed){ out("M2 FLASH_STARTUP_MILESTONE FAIL (stopped at failed milestone)"); }
else{
  // all milestones hit; run loop briefly and check g_fast_tick
  clearAllBps();
  session.target.runAsynch();
  java.lang.Thread.sleep(250);
  try{ session.target.halt(); }catch(e){}
  out("M2 PC-after-loop=0x"+session.memory.readRegister("PC").toString(16)+" g_fast_tick="+rv32("g_fast_tick")+" profile_id=0x"+rv32("g_control_pi_profile_id").toString(16));
  out("M2 FLASH_STARTUP_MILESTONE_PASS");
}
out("M2 DONE");
try{ session.terminate(); }catch(e){}
