// Attach-only read of halted W5 algorithm-0x1A real terminal; no target writes.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.io);importPackage(Packages.java.security);
var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_W5_LADDER\\LLC_100W_F28034_OPEN_LOOP_STEADY.out";
var EXPECTED="59E807E7360D68C99C5C90AA6193C187FAE25EBD3A8FE63281CD1D2CE3BB6A4E";
function sha(p){var m=MessageDigest.getInstance("SHA-256"),f=new FileInputStream(p),b=java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE,8192),n;while((n=f.read(b))>0)m.update(b,0,n);f.close();var d=m.digest(),s="";for(var i=0;i<d.length;i++){var h=(d[i]&255).toString(16);s+=(h.length<2?"0":"")+h;}return s.toUpperCase();}
if(!sha(OUT).equals(EXPECTED))throw "sha-mismatch";
var e=ScriptingEnvironment.instance(),d=e.getServer("DebugServer.1");d.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");var s=d.openSession(),c=false;
try{s.target.connect();c=true;print("HALTED="+s.target.isHalted());if(!s.target.isHalted())throw "not-halted";s.symbol.load(OUT);
function a(n){return s.expression.evaluate("&"+n);}function w(n){return s.memory.readWord(1,a(n));}function u(n){var x=a(n);return (s.memory.readWord(1,x)|(s.memory.readWord(1,x+1)<<16))>>>0;}
print("TERM state="+w("g_cal_hold_state")+" reason="+w("g_cal_hold_stop_reason")+" fault="+u("g_fault_flags")+" pwm="+w("g_cal_hold_final_pwm")+" ost="+w("g_cal_hold_final_ost")+" elapsed="+u("g_cal_hold_elapsed_ticks"));
print("STATS packets="+u("g_cal_hold_packet_count")+" cycles="+u("g_cal_hold_total_packet_cycles")+" mincy="+w("g_cal_hold_packet_min_cycles")+" maxcy="+w("g_cal_hold_packet_max_cycles")+" cycsum="+u("g_cal_hold_packet_cycles_sum"));
print("LAST start="+w("g_cal_hold_packet_start_raw")+" stop="+w("g_cal_hold_packet_stop_raw")+" postmax="+w("g_cal_hold_packet_post_max_raw")+" postlast="+w("g_cal_hold_packet_post_last_raw")+" actualcy="+u("g_cal_hold_packet_actual_cycles")+" low_samples="+w("g_cal_hold_undersupply_low_samples"));
print("RUNG min="+w("g_w5_ladder_rung_min_raw[0]")+" max="+w("g_w5_ladder_rung_max_raw[0]")+" phase="+w("g_w5_ladder_rung_phase")+" abort="+w("g_w5_ladder_abort_reason"));
print("TZ run=0x"+u("g_test_run_id_at_tz_isr").toString(16)+" phase="+w("g_tz_event_phase")+" gpio15="+w("g_tz_isr_gpio15")+" compsts="+w("g_tz_isr_compsts")+" tzflg=0x"+w("g_tz_isr_tzflg").toString(16)+" tbctr="+w("g_tz_isr_tbctr")+" hw="+u("g_tz_hardware_trip_count")+" active="+u("g_tz_active_window_trip_count"));
print("PWM period="+w("g_pwm_period")+" dbred="+s.expression.evaluate("EPwm1Regs.DBRED")+" packet_cycles_now="+w("g_cal_hold_packet_cycles"));
}finally{if(c)try{s.terminate();}catch(x){}}
