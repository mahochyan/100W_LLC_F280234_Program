// W2 v2.1 single-shot reproduction of POINT 1 enable + full post-state forensics.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_OL_STEADY\\LLC_100W_F28034_OPEN_LOOP_STEADY.out";
var env=ScriptingEnvironment.instance();
var server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();

function addr(n){ var v=session.expression.evaluate("&"+n); var s=""+v;
  if(s.indexOf("0x")===0||s.indexOf("0X")===0) return parseInt(s,16); return parseInt(s,10); }
function rw(n){ return session.memory.readWord(1,addr(n)); }
function rv32u(n){ var a=addr(n); return (session.memory.readWord(1,a)|(session.memory.readWord(1,a+1)<<16))>>>0; }
function rv32(n){ var a=addr(n); return (session.memory.readWord(1,a)|(session.memory.readWord(1,a+1)<<16))>>>0; }
function wv(n,v){ session.memory.writeWord(1,addr(n),v); }
function wv32(n,v){ var a=addr(n); session.memory.writeWord(1,a,v&0xFFFF); session.memory.writeWord(1,a+1,(v>>>16)&0xFFFF); }
function reg(e){ return parseInt(session.expression.evaluate(e)); }
function run(ms){ session.target.runAsynch(); java.lang.Thread.sleep(ms); session.target.halt(); }

session.target.connect();
try{session.target.halt();}catch(e){}
session.memory.loadProgram(OUT);
run(300);

print("BOOT sys="+rw("g_system_state")+" pwm="+rw("g_pwm_enabled")+" fault=0x"+(rv32u("g_fault_flags")>>>0).toString(16)+
      " OST="+reg("EPwm1Regs.TZFLG.bit.OST")+" TBPRD="+reg("EPwm1Regs.TBPRD")+
      " cal_valid="+rw("g_board_vout_cal_valid")+" first_start="+rw("g_first_start_seen"));

// Host enable protocol (stage 5A + OL command)
wv("g_bringup_stage",5);
wv32("g_open_loop_frequency_command_hz",170000);
wv32("g_open_loop_freq_slew_hz_per_sample",500);
run(20);   // let the boot idle settle

print("PRE sys="+rw("g_system_state")+" fault=0x"+(rv32u("g_fault_flags")>>>0).toString(16)+
      " OST="+reg("EPwm1Regs.TZFLG.bit.OST")+" pwm="+rw("g_pwm_enabled"));

// enable + short observation of the whole takeover + likely WARNING stop
wv("g_pwm_enable_request",1);
run(60);
print("=== POST ENABLE (60ms) ===");
print("sys="+rw("g_system_state")+" enres="+rw("g_pwm_enable_result")+" pwm="+rw("g_pwm_enabled")+
      " fault=0x"+(rv32u("g_fault_flags")>>>0).toString(16)+" fhist=0x"+(rv32u("g_fault_history")>>>0).toString(16));
print("ss_state="+rw("g_softstart_state")+" ss_stage_idx="+rw("g_softstart_stage_index")+
      " ss_result="+rw("g_softstart_result")+" ss_abort="+rw("g_softstart_abort_reason")+
      " cyc="+rv32u("g_softstart_cycle_count")+" soca="+rv32u("g_softstart_soca_count"));
print("tk_armed="+rw("g_open_loop_takeover_armed")+" tk_done="+rw("g_open_loop_takeover_done")+
      " tk_freq="+rv32u("g_open_loop_takeover_freq_hz")+" tk_raw="+rw("g_open_loop_takeover_raw"));
print("ol_active="+rw("g_open_loop_steady_active")+" phase="+rw("g_open_loop_phase")+
      " applied="+rv32u("g_open_loop_applied_hz")+" ticks="+rv32u("g_open_loop_ticks_active")+
      " stop_reason="+rw("g_open_loop_stop_reason")+" ub="+rw("g_open_loop_upper_gain_boundary"));
print("stop_snap mean="+rw("g_open_loop_stop_mean_raw")+" min="+rw("g_open_loop_stop_min_raw")+
      " max="+rw("g_open_loop_stop_max_raw")+" fa="+rv32u("g_open_loop_stop_freq_applied")+
      " tbprd="+rw("g_open_loop_stop_tbprd")+" cmd="+rv32u("g_open_loop_stop_cmd")+
      " steady="+rw("g_open_loop_steady_reached")+" fault=0x"+(rv32u("g_open_loop_stop_fault")>>>0).toString(16));
print("raw vout="+rw("g_adc_vout_raw")+" sync="+rw("g_adc_vout_pwm_sync_raw")+" filt="+rw("g_adc_vout_filtered_raw")+
      " seq="+rv32u("g_adc_sample_sequence")+" cnt="+rv32u("g_adc_sample_counter")+" ovf="+rv32u("g_adc_ovf_count"));
print("MMR TBPRD="+reg("EPwm1Regs.TBPRD")+" DBRED="+reg("EPwm1Regs.DBRED")+
      " CMPA="+reg("EPwm1Regs.CMPA.half.CMPA")+" OST="+reg("EPwm1Regs.TZFLG.bit.OST")+
      " TZINT="+reg("EPwm1Regs.TZFLG.bit.INT")+" INTEN="+reg("EPwm1Regs.ETSEL.bit.INTEN")+
      " SOCAEN="+reg("EPwm1Regs.ETSEL.bit.SOCAEN")+" AQCSFRC="+reg("EPwm1Regs.AQCSFRC.all")+
      " TZCTL="+reg("EPwm1Regs.TZCTL.all"));
print("first_start_seen="+rw("g_first_start_seen")+" first_tbprd="+rw("g_first_start_tbprd")+
      " first_cmpa="+rw("g_first_start_cmpa")+" first_ost="+rw("g_first_start_ost")+
      " tzclr_cnt="+rv32u("g_probe_tzclr_write_count"));
print("pwm_en_req="+rw("g_pwm_enable_request")+" pwm_en_res="+rw("g_pwm_enable_result")+
      " swfreq="+rv32u("g_switching_frequency_hz")+" actual="+rv32u("g_actual_switching_frequency_hz")+
      " g_pwm_period="+rw("g_pwm_period")+" winstate="+rw("g_power_window_state")+
      " trig_mode="+rw("g_adc_trigger_mode")+" PIEIER1=0x"+reg("PieCtrlRegs.PIEIER1.all").toString(16)+
      " PIEACK=0x"+reg("PieCtrlRegs.PIEACK.all").toString(16));

try{session.terminate();}catch(e){}