// Attach-only read of the last W3 real failure. Never loads or writes target memory.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
var env=ScriptingEnvironment.instance(),server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();
var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_OL_STEADY\\LLC_100W_F28034_OPEN_LOOP_STEADY.out";
function addr(n){return session.expression.evaluate("&"+n);}
function rw(n){return session.memory.readWord(1,addr(n));}
function rv32u(n){var a=addr(n),lo=session.memory.readWord(1,a),hi=session.memory.readWord(1,a+1);return (lo|(hi<<16))>>>0;}
function reg(e){return parseInt(session.expression.evaluate(e));}
try{session.target.connect();}catch(e){}
try{session.target.halt();}catch(e){}
session.symbol.load(OUT);
function p16(names){for(var i=0;i<names.length;i++)print(names[i]+"="+rw(names[i]));}
function p32(names){for(var i=0;i<names.length;i++)print(names[i]+"="+rv32u(names[i]));}
print("=== W3 REAL ATTACH-ONLY RESIDUE ===");
p16(["g_cal_hold_state","g_cal_hold_stop_reason","g_cal_hold_packet_active",
 "g_cal_hold_packet_cycles","g_cal_hold_charge_stop_raw","g_cal_hold_raw",
 "g_cal_hold_mode_active","g_cal_hold_hard_limit_events","g_pwm_enabled",
 "g_system_state","g_power_window_state","g_adc_trigger_mode",
 "g_adc_pwm_sync_valid","g_adc_pwm_sync_consecutive_miss","g_adc_pwm_sync_stale_abort",
 "g_adc_vout_pwm_sync_raw","g_comp_trip_dac_code","g_comp_trip_tbctr",
 "g_comp_trip_vout_raw","g_tz_isr_tbctr","g_tz_isr_gpio15","g_tz_isr_compsts",
 "g_tz_isr_tzflg","g_tz_event_phase","g_tz_isr_software_ost_flag",
 "g_tz_isr_after_scheduled_ost","g_pre_stop_hardware_trip_seen",
 "g_accel_stop_reason","g_accel_trip_phase","g_accel_trip_period",
 "g_accel_trip_cmpa","g_accel_trip_db","g_adc_fault_snapshot_frozen",
 "g_adc_fault_snapshot_phase","g_adc_fault_snapshot_intflg","g_adc_fault_snapshot_intovf",
 "g_adc_fault_snapshot_socflg","g_adc_fault_snapshot_socovf"]);
p32(["g_fault_flags","g_fault_history","g_cal_hold_elapsed_ticks",
 "g_cal_hold_packet_count","g_cal_hold_total_packet_cycles","g_adc_sample_counter",
 "g_adc_sample_sequence","g_adc_pwm_sync_soca_count","g_adc_pwm_sync_eoc_count",
 "g_adc_pwm_sync_miss_count","g_tz_hardware_trip_count","g_tz_active_window_trip_count",
 "g_tz_post_ost_trip_count","g_tz_software_ost_count","g_completed_cycles_at_trip",
 "g_accel_trip_completed_cycles","g_adc_fault_snapshot_flags",
 "g_adc_fault_snapshot_publish_sequence","g_adc_fault_snapshot_consume_sequence",
 "g_adc_ovf_active_count","g_adc_ovf_count"]);
print("REG_TBCTR="+reg("EPwm1Regs.TBCTR")+" REG_TBPRD="+reg("EPwm1Regs.TBPRD")+
 " REG_DBRED="+reg("EPwm1Regs.DBRED")+" REG_TZFLG="+reg("EPwm1Regs.TZFLG.all")+
 " REG_TZEINT="+reg("EPwm1Regs.TZEINT.all")+" REG_COMPSTS="+reg("Comp1Regs.COMPSTS.bit.COMPSTS")+
 " REG_GPIO15="+reg("GpioDataRegs.GPADAT.bit.GPIO15")+
 " REG_ADCINTFLG="+reg("AdcRegs.ADCINTFLG.all")+" REG_ADCINTOVF="+reg("AdcRegs.ADCINTOVF.all"));
try{session.terminate();}catch(e){}
