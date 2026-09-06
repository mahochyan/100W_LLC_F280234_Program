// Attach-only read of the already halted W4 V15 terminal capsule.
// Never loads a program, halts/resumes the CPU, or writes target/register data.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_W4_RETURN_V15\\LLC_100W_F28034_OPEN_LOOP_STEADY.out";
var EXPECTED_SHA="A2148D520E8EEDE6C9F060D07B0533E8F0EB799B99C928DED5642EF2D876E5A1";
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
function expectedCookie(runId,direction,state,reason){
  return (0x57440000 ^ 0x00000F0C ^ 0x00000017 ^ 0x42525354 ^
          0xEFFA6E24 ^ runId ^ ((direction&0xffff)<<16) ^
          ((state&0xffff)<<8) ^ (reason&0xffff))>>>0;
}

var actual=sha256File(OUT);
if(!actual.equals(EXPECTED_SHA))throw "v15-out-sha-mismatch";
var env=ScriptingEnvironment.instance(),server=env.getServer("DebugServer.1");
env.setScriptTimeout(30000);
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession(),connected=false;
session.setScriptTimeout(30000);
try {
  session.target.connect();connected=true;
  if(!session.target.isHalted())throw "v15-target-not-halted-no-read";
  session.symbol.load(OUT);
  function addr(n){return session.expression.evaluate("&"+n);}
  function rw(n){return session.memory.readWord(1,addr(n));}
  function rv32u(n){var a=addr(n),lo=rw(n),hi=session.memory.readWord(1,a+1);return (lo|(hi<<16))>>>0;}
  function reg(e){return parseInt(session.expression.evaluate(e));}
  var state=rw("g_cal_hold_state"),reason=rw("g_cal_hold_stop_reason");
  var direction=rw("g_w4_trace_direction_active"),run=rv32u("g_cal_hold_run_id_at_stop");
  var cookie=rv32u("g_w4_trace_terminal_cookie");
  var expected=expectedCookie(run,direction,state,reason);
  var n=rv32u("g_cal_hold_steady_samples"),sum=rv32u("g_cal_hold_steady_sum");
  var capsuleValid=(state===4 || state===5) && direction===2 &&
      run===0x25090602 && cookie===expected &&
      rw("g_pwm_enabled")===0 && rw("g_cal_hold_final_pwm")===0 &&
      rw("g_cal_hold_packet_active")===0 &&
      reg("EPwm1Regs.TZFLG.bit.OST")===1 &&
      rw("g_cal_hold_final_ost")===1;
  print("V15_READONLY_OUT_SHA256="+actual);
  print("V15_READONLY_TERMINAL state="+state+" reason="+reason+
        " elapsed="+rv32u("g_cal_hold_elapsed_ticks")+
        " trace_state="+rw("g_w4_trace_state")+
        " trace_fail="+rw("g_w4_trace_fail_reason")+
        " direction="+direction+" run=0x"+run.toString(16));
  print("V15_READONLY_SAFETY pwm="+rw("g_pwm_enabled")+
        " final_pwm="+rw("g_cal_hold_final_pwm")+
        " packet_active="+rw("g_cal_hold_packet_active")+
        " ost="+reg("EPwm1Regs.TZFLG.bit.OST")+
        " final_ost="+rw("g_cal_hold_final_ost")+
        " tzint="+reg("EPwm1Regs.TZFLG.bit.INT")+
        " fault="+rv32u("g_fault_flags")+
        " hard_limit="+rw("g_cal_hold_hard_limit_events")+
        " hw_trip="+rv32u("g_tz_hardware_trip_count")+
        " active_trip="+rv32u("g_tz_active_window_trip_count"));
  print("V15_READONLY_COOKIE actual=0x"+cookie.toString(16)+
        " expected=0x"+expected.toString(16)+" match="+(cookie===expected?"TRUE":"FALSE"));
  print("V15_READONLY_CAPSULE_VALID="+(capsuleValid?"TRUE":"FALSE"));
  print("V15_READONLY_TRACE marker="+rv32u("g_w4_trace_operator_marker_tick")+
        " trigger="+rv32u("g_w4_trace_trigger_confirm_tick")+
        " baseline_demand="+rv32u("g_w4_trace_baseline_demand_index")+
        " trigger_demand="+rv32u("g_w4_trace_trigger_demand_index")+
        " min="+rw("g_w4_trace_min_raw")+" max="+rw("g_w4_trace_max_raw")+
        " settle_ms="+rw("g_w4_trace_settle_ms")+
        " quality="+rw("g_w4_trace_quality_pass"));
  print("V15_READONLY_HOLD steady_min="+rw("g_cal_hold_steady_min")+
        " steady_max="+rw("g_cal_hold_steady_max")+
        " steady_avg="+(n?Math.floor(sum/n):0)+
        " packets="+rv32u("g_cal_hold_packet_count")+
        " total_cycles="+rv32u("g_cal_hold_total_packet_cycles"));
  print("V15_READONLY_PI mode=0x"+rv32u("g_w4_v15_control_mode_id").toString(16)+
        " profile=0x"+rv32u("g_w4_v15_burst_profile_id").toString(16)+
        " update_start="+rv32u("g_w4_v15_pi_update_count_start")+
        " update_end="+rv32u("g_w4_v15_pi_update_count_end")+
        " integral_start="+rv32u("g_w4_v15_pi_integral_q12_start")+
        " integral_end="+rv32u("g_w4_v15_pi_integral_q12_end")+
        " generic_period_writes="+rv32u("g_w4_v15_frequency_apply_count"));
  print("V15_READONLY_ISR max="+rv32u("g_w4_v15_isr_cycles_max")+
        " samples="+rv32u("g_w4_v15_isr_sample_count")+
        " overruns="+rv32u("g_w4_v15_isr_overrun_count"));
  if(!capsuleValid)throw "v15-terminal-capsule-invalid-or-lost";
} finally {
  if(connected){try{session.terminate();}catch(e){}}
}
