// Attach-only read of the already halted W5 attempt-5 terminal capsule.
// Never loads a program, halts/resumes the CPU, or writes target/register data.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_W5_LADDER\\LLC_100W_F28034_OPEN_LOOP_STEADY.out";
var EXPECTED_SHA="78C60382C86B6A15F0A870E046CDBB3089BB2495320CF002CF45A5BC44CFD43B";
function sha256File(path){
  var md=MessageDigest.getInstance("SHA-256"),fis=new FileInputStream(path);
  var buf=java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE,8192),n;
  while((n=fis.read(buf))>0)md.update(buf,0,n);fis.close();
  var d=md.digest(),sb=new java.lang.StringBuilder();
  for(var i=0;i<d.length;i++){
    var h=(d[i]&0xff).toString(16);if(h.length<2)h="0"+h;sb.append(h.toUpperCase());
  }
  return sb.toString();
}

var actual=sha256File(OUT);
if(!actual.equals(EXPECTED_SHA))throw "w5-attempt5-out-sha-mismatch";
var env=ScriptingEnvironment.instance(),server=env.getServer("DebugServer.1");
env.setScriptTimeout(30000);
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession(),connected=false;
session.setScriptTimeout(30000);
try {
  session.target.connect();connected=true;
  print("W5_A5_ATTACH_IS_HALTED="+(session.target.isHalted()?"TRUE":"FALSE"));
  if(!session.target.isHalted())throw "w5-attempt5-target-not-halted-no-read";
  session.symbol.load(OUT);
  function addr(n){return session.expression.evaluate("&"+n);}
  function rw(n){return session.memory.readWord(1,addr(n));}
  function rv32u(n){var a=addr(n),lo=rw(n),hi=session.memory.readWord(1,a+1);return (lo|(hi<<16))>>>0;}
  function reg(e){return parseInt(session.expression.evaluate(e));}
  print("W5_A5_OUT_SHA256="+actual);
  print("W5_A5_TERMINAL state="+rw("g_cal_hold_state")+
        " reason="+rw("g_cal_hold_stop_reason")+
        " system="+rw("g_system_state")+
        " fault=0x"+rv32u("g_fault_flags").toString(16)+
        " final_pwm="+rw("g_cal_hold_final_pwm")+
        " final_ost="+rw("g_cal_hold_final_ost"));
  print("W5_A5_PRESTART reject="+rw("g_comp_prestart_reject")+
        " armed="+rw("g_comp_inject_test_armed")+
        " status="+rw("g_comp_prestart_status")+
        " gpio15_snapshot="+rw("g_comp_prestart_gpio15")+
        " tzflg_snapshot=0x"+rw("g_comp_prestart_tzflg").toString(16)+
        " polarity="+rw("g_comp_polarity")+
        " dac="+rw("g_comp1_dac_code"));
  print("W5_A5_HW compsts="+reg("Comp1Regs.COMPSTS.bit.COMPSTS")+
        " gpio15="+reg("GpioDataRegs.GPADAT.bit.GPIO15")+
        " compdacen="+reg("Comp1Regs.COMPCTL.bit.COMPDACEN")+
        " dacval="+reg("Comp1Regs.DACVAL.bit.DACVAL")+
        " ost="+reg("EPwm1Regs.TZFLG.bit.OST")+
        " tzint="+reg("EPwm1Regs.TZFLG.bit.INT")+
        " tzeint="+reg("EPwm1Regs.TZEINT.bit.OST"));
  print("W5_A5_START prepared="+rw("g_pwm_start_prepared")+
        " pwm="+rw("g_pwm_enabled")+
        " result="+rw("g_pwm_enable_result")+
        " off_ticks="+rv32u("g_cal_hold_off_ticks")+
        " packet_cycles="+rv32u("g_cal_hold_packet_actual_cycles"));
  print("W5_A5_CHARGE stop_reason="+rw("g_accel_stop_reason")+
        " stop_raw="+rw("g_accel_stop_raw")+
        " max_raw="+rw("g_accel_stop_max_raw")+
        " completed_cycles="+rv32u("g_accel_stop_completed_cycles")+
        " target="+rw("g_accel_stop_target_raw")+
        " hard_limit="+rw("g_accel_stop_hard_limit_raw"));
  print("W5_A5_LADDER rung="+rw("g_w5_ladder_active_rung")+
        " phase="+rw("g_w5_ladder_rung_phase")+
        " abort="+rw("g_w5_ladder_abort_reason")+
        " abort_rung="+rw("g_w5_ladder_abort_rung")+
        " cookie=0x"+rv32u("g_w5_ladder_terminal_cookie").toString(16));
} finally {
  if(connected){try{session.terminate();}catch(e){}}
}
