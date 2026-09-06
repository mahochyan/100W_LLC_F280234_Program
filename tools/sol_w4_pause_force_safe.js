// Pause-only safe latch.  Run only after an attach-only probe proves the CPU
// is already halted.  It never loads a program or resumes/halts execution.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);

var env=ScriptingEnvironment.instance(),server=env.getServer("DebugServer.1");
env.setScriptTimeout(30000);
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession(),connected=false;
var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_W4_RETURN_V15\\LLC_100W_F28034_OPEN_LOOP_STEADY.out";
try {
  session.target.connect();connected=true;
  if(!session.target.isHalted())throw "pause-force-safe-refuses-running-target";
  session.symbol.load(OUT);
  function a(e){return session.expression.evaluate("&"+e);}
  function r(e){return parseInt(session.expression.evaluate(e));}
  function w(e,v){session.memory.writeWord(1,a(e),v);}
  var tze=r("EPwm1Regs.TZEINT.all");
  w("EPwm1Regs.TZEINT.all",tze&0xfffb);
  w("EPwm1Regs.TZFRC.all",4);
  w("EPwm1Regs.TZCLR.all",1);
  var ost=r("EPwm1Regs.TZFLG.bit.OST"),tzint=r("EPwm1Regs.TZFLG.bit.INT");
  var epwmClock=r("SysCtrlRegs.PCLKCR1.bit.EPWM1ENCLK");
  var tbclk=r("SysCtrlRegs.PCLKCR0.bit.TBCLKSYNC");
  var mux0=r("GpioCtrlRegs.GPAMUX1.bit.GPIO0"),mux1=r("GpioCtrlRegs.GPAMUX1.bit.GPIO1");
  var dat0=r("GpioDataRegs.GPADAT.bit.GPIO0"),dat1=r("GpioDataRegs.GPADAT.bit.GPIO1");
  var ctrmode=r("EPwm1Regs.TBCTL.bit.CTRMODE"),tbprd=r("EPwm1Regs.TBPRD");
  var aqcsfrc=r("EPwm1Regs.AQCSFRC.all"),tzctl=r("EPwm1Regs.TZCTL.all");
  var resetSafe=(epwmClock===0 && tbclk===0 && mux0===0 && mux1===0 &&
                 dat0===0 && dat1===0 && tbprd===0 && tzint===0);
  var outputSafe=(ost===1 && tzint===0) || resetSafe;
  print("PAUSE_SAFE_CPU_ALREADY_HALTED=TRUE");
  print("PAUSE_SAFE_OST="+ost);
  print("PAUSE_SAFE_TZINT="+tzint);
  print("PAUSE_SAFE_CLOCK epwm1="+epwmClock+" tbclksync="+tbclk);
  print("PAUSE_SAFE_GPIO mux0="+mux0+" mux1="+mux1+" dat0="+dat0+" dat1="+dat1);
  print("PAUSE_SAFE_EPWM ctrmode="+ctrmode+" tbprd="+tbprd+
        " aqcsfrc="+aqcsfrc+" tzctl="+tzctl);
  print("PAUSE_SAFE_RESET_DEFAULT_PATH="+(resetSafe?"TRUE":"FALSE"));
  print("PAUSE_SAFE_OUTPUT_GATE="+(outputSafe?"PASS":"FAIL"));
  if(!outputSafe)throw "pause-output-safe-gate-failed";
} finally {
  if(connected){try{session.terminate();}catch(e){}}
}
