// Forensic state read after POINT_170000_ENABLE FAIL (v2 takeover entry).
// Symbols only (NO reset) — the board holds the post-attempt state.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);

var env=ScriptingEnvironment.instance();
var server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();
session.target.connect();
session.symbol.load("D:/CCS21_workspace/Codex_Project/Stage6_OL_STEADY/LLC_100W_F28034_OPEN_LOOP_STEADY.out");
try { session.target.halt(); } catch (e) {}

function addr(n){ return session.expression.evaluate("&"+n); }
function rw(n){ return session.memory.readWord(1, addr(n)); }
function rv32(n){ var a=addr(n), lo=session.memory.readWord(1,a), hi=session.memory.readWord(1,a+1); return (lo|(hi<<16))>>>0; }
function reg(e){ return parseInt(session.expression.evaluate(e)); }

print("=== POST-ATTEMPT STATE (no reset) ===");
print("g_system_state           = " + rw("g_system_state"));
print("g_pwm_enable_request     = " + rw("g_pwm_enable_request"));
print("g_pwm_enable_result      = " + rw("g_pwm_enable_result"));
print("g_pwm_enabled            = " + rw("g_pwm_enabled"));
print("g_fault_flags            = 0x" + (rv32("g_fault_flags")>>>0).toString(16));
print("g_fault_history          = 0x" + (rv32("g_fault_history")>>>0).toString(16));
print("TZFLG.OST                = " + reg("EPwm1Regs.TZFLG.bit.OST"));
print("TZFLG.INT                = " + reg("EPwm1Regs.TZFLG.bit.INT"));
print("TBPRD                    = " + reg("EPwm1Regs.TBPRD"));
print("DBRED                    = " + reg("EPwm1Regs.DBRED"));
print("--- softstart engine ---");
print("g_softstart_state        = " + rw("g_softstart_state"));
print("g_softstart_stage        = " + rw("g_softstart_stage"));
print("g_softstart_stage_index  = " + rw("g_softstart_stage_index"));
print("g_softstart_result       = " + rw("g_softstart_result"));
print("g_softstart_abort_reason = " + rw("g_softstart_abort_reason"));
print("g_softstart_ramp_active  = " + rw("g_softstart_ramp_active"));
print("g_softstart_request      = " + rw("g_softstart_request"));
print("g_softstart_cycle_count  = " + rv32("g_softstart_cycle_count"));
print("g_softstart_soca_count   = " + rv32("g_softstart_soca_count"));
print("g_softstart_miss_count   = " + rv32("g_softstart_miss_count"));
print("g_softstart_consec_miss  = " + rw("g_softstart_consecutive_miss"));
print("g_softstart_stale_abort  = " + rw("g_softstart_stale_abort"));
print("g_softstart_stop_raw     = " + rw("g_softstart_stop_raw"));
print("g_softstart_last_vout    = " + rw("g_softstart_last_vout_raw"));
print("g_softstart_last_vout_max= " + rw("g_softstart_last_vout_max"));
print("g_softstart_hard_ceiling = " + rw("g_softstart_hard_ceiling_raw"));
print("g_softstart_accept_tgt   = " + rw("g_softstart_accept_target_raw"));
print("g_softstart_accept_mode  = " + rw("g_softstart_acceptance_mode"));
print("g_softstart_ocp_dac_code = " + rw("g_softstart_ocp_dac_code"));
print("--- OL module ---");
print("g_open_loop_takeover_armed = " + rw("g_open_loop_takeover_armed"));
print("g_open_loop_takeover_done  = " + rw("g_open_loop_takeover_done"));
print("g_open_loop_takeover_freq  = " + rv32("g_open_loop_takeover_freq_hz"));
print("g_open_loop_takeover_raw   = " + rw("g_open_loop_takeover_raw"));
print("g_open_loop_steady_active  = " + rw("g_open_loop_steady_active"));
print("g_open_loop_phase          = " + rw("g_open_loop_phase"));
print("g_open_loop_applied_hz     = " + rv32("g_open_loop_applied_hz"));
print("g_open_loop_stop_reason    = " + rw("g_open_loop_stop_reason"));
print("g_open_loop_stop_fault     = 0x" + (rv32("g_open_loop_stop_fault")>>>0).toString(16));
print("g_open_loop_ticks_active   = " + rv32("g_open_loop_ticks_active"));
print("--- frequency trackers ---");
print("g_switching_frequency_hz   = " + rv32("g_switching_frequency_hz"));
print("g_actual_switching_freq    = " + rv32("g_actual_switching_frequency_hz"));
print("g_pwm_period               = " + rw("g_pwm_period"));
print("--- adc ---");
print("g_adc_sample_sequence      = " + rv32("g_adc_sample_sequence"));
print("g_adc_sample_counter       = " + rv32("g_adc_sample_counter"));
print("g_adc_vout_raw             = " + rw("g_adc_vout_raw"));
print("g_adc_vout_pwm_sync_raw    = " + rw("g_adc_vout_pwm_sync_raw"));
print("g_adc_vout_filtered_raw    = " + rw("g_adc_vout_filtered_raw"));
print("g_adc_freshness_armed      = " + rw("g_adc_freshness_monitor_armed"));
print("g_adc_ovf_count            = " + rv32("g_adc_ovf_count"));
print("--- interrupts ---");
print("PIEIER1 (hex)              = 0x" + reg("PieCtrlRegs.PIEIER1.all").toString(16));
print("EPwm1 INTSEL/INTEN         = " + reg("EPwm1Regs.ETSEL.bit.INTEN") + " sel=" + reg("EPwm1Regs.ETSEL.bit.INTSEL"));
print("EPwm1 SOCAEN/SOCASEL       = " + reg("EPwm1Regs.ETSEL.bit.SOCAEN") + " sel=" + reg("EPwm1Regs.ETSEL.bit.SOCASEL"));
print("g_adc_trigger_mode         = " + rw("g_adc_trigger_mode"));
print("g_bringup_stage            = " + rw("g_bringup_stage"));
print("g_open_loop_ne_test_enable = " + rw("g_open_loop_ne_test_enable"));

try { session.terminate(); } catch (e) {}