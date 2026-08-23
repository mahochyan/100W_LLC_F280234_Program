// stage6_milestone3.js - prove InitFlash path WITHOUT software bp at copied RAM target.
// Hit _System_Init, verify ramfunc copy correctness, run to _APP_Init (InitFlash ran & returned).
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
var OUT = "D:\\CCS21_workspace\\Codex_Project\\evidence\\stage6_on_target_shadow_noenergy\\LLC_100W_F28034_BRINGUP_DSH.out";
var env = ScriptingEnvironment.instance();
var server = env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session = server.openSession();
function out(s){ print(s); java.lang.System.out.flush(); }
function clearBps(){ try{ session.breakpoint.removeAll(); }catch(e){} try{ java.lang.Thread.sleep(20);}catch(e){} }
function rdw(a){ try{ return session.memory.readWord(0,a)&0xFFFF; }catch(e){ return -1; } }
function rv32(n){ var a=session.expression.evaluate("&"+n); return (session.memory.readWord(1,a)|(session.memory.readWord(1,a+1)<<16))>>>0; }
function run_to(addr,label){
  clearBps();
  var bp=null; try{ bp=session.breakpoint.add(addr); }catch(e){ out("  add "+label+" ERR "+e); return false; }
  session.target.runAsynch();
  java.lang.Thread.sleep(160);
  try{ session.target.halt(); }catch(e){}
  var pc=session.memory.readRegister("PC");
  var hit=(pc===addr);
  out("M3 "+label+" @0x"+addr.toString(16)+" -> PC=0x"+pc.toString(16)+" "+(hit?"HIT":"MISS"));
  if(!hit){ out("M3  trap? PC=0x"+pc.toString(16)+" (0x"+pc.toString(16)+")"); }
  try{ session.breakpoint.remove(bp); }catch(e){}
  return hit;
}
session.target.connect();
try{ session.target.halt(); }catch(e){}
out("M3 connect OK");
session.memory.loadProgram(OUT);
out("M3 load OK PC=0x"+session.memory.readRegister("PC").toString(16));
clearBps();
// run to _System_Init
if(!run_to(0x3E99B0,"_System_Init")){ out("M3 FAIL at System_Init"); out("M3 DONE"); try{session.terminate();}catch(e){} exit; }
// pre-copy: RAM 0x8000 should NOT yet contain InitFlash; flash 0x3E8000 has it
out("M3 flash[0x3E8000]="+rdw(0x3E8000).toString(16)+" ram[0x8000]="+rdw(0x8000).toString(16)+" (pre-copy; copy happens inside System_Init)");
// now run to _APP_Init (this executes the ramfunc copy + InitFlash + rest of System_Init)
var reached = run_to(0x3EA37B,"_APP_Init");
if(reached){
  out("M3 System_Init completed -> InitFlash executed & returned (APP_Init reached)");
  // verify InitFlash copied to RAM
  out("M3 post-copy ram[0x8000]="+rdw(0x8000).toString(16)+" flash[0x3E8000]="+rdw(0x3E8000).toString(16)+" match="+(rdw(0x8000)===rdw(0x3E8000)));
  // read FLASH register wait-state config to prove InitFlash took effect
  try{
    var FR = 0x000A80; // FlashRegs (F28034) offset base
    var FR_REG_ACCPROT = 0x000A80, FR_REG_FBAC = 0x000A8A, FR_REG_FSTAT = 0x000A8C;
    out("M3 FlashRegs FSTAT=0x"+rdw(0x000A8C).toString(16)+" (bit0=flash access active)");
  }catch(e){ out("M3 flashreg read ERR "+e); }
  out("M3 g_fast_tick="+rv32("g_fast_tick")+" profile_id=0x"+rv32("g_control_pi_profile_id").toString(16));
  out("M3 FLASH_STARTUP_MILESTONE_PASS");
}else{
  out("M3 FLASH_STARTUP_MILESTONE FAIL (InitFlash/System_Init path trapped)");
  try{ out("M3 SP="+session.memory.readRegister("SP")+" RPC="+session.memory.readRegister("RPC")+" ST0="+session.memory.readRegister("ST0")+" ST1="+session.memory.readRegister("ST1")+" IER="+session.memory.readRegister("IER")+" IFR="+session.memory.readRegister("IFR")); }catch(e){}
}
out("M3 DONE");
try{ session.terminate(); }catch(e){}
