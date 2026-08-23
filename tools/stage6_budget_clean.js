// stage6_budget_clean.js - whole-ISR budget with PI actually running (counter reset), clean state.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
var OUT = "D:\\CCS21_workspace\\Codex_Project\\evidence\\stage6_on_target_shadow_noenergy\\LLC_100W_F28034_BRINGUP_DSH.out";
var env = ScriptingEnvironment.instance();
var server = env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session = server.openSession();
function out(s){ print(s); java.lang.System.out.flush(); }
function addr(n){ return session.expression.evaluate("&"+n); }
function rw(n){ try{ return session.memory.readWord(1,addr(n)); }catch(e){ return -1; } }
function rv32u(n){ try{ var a=addr(n); var lo=session.memory.readWord(1,a); var hi=session.memory.readWord(1,a+1); return (lo|(hi<<16))>>>0; }catch(e){ return -1; } }
function wv(n,v){ session.memory.writeWord(1,addr(n),v); }
function wv32(n,v){ var a=addr(n); session.memory.writeWord(1,a,v&0xFFFF); session.memory.writeWord(1,a+1,(v>>>16)&0xFFFF); }
function run(ms){ session.target.runAsynch(); java.lang.Thread.sleep(ms); try{ session.target.halt(); }catch(e){} }
session.target.connect();
try{ session.target.halt(); }catch(e){}
out("BC connect OK");
session.memory.loadProgram(OUT);
// clean baseline: reset control + stale counter, enable PI hook
wv32("g_control_frequency_hz",150000);
wv32("g_control_shadow_frequency_hz",150000);
wv32("g_pi_integral",0x00000000);
wv32("g_voltage_reference",0x41400000);
wv("g_control_running",1);
wv("g_adc_pwm_sync_consecutive_miss",0);
wv("g_adc_pwm_sync_valid",1);
wv("g_stage6_noenergy_test_enable",1);
wv("g_stage6_noenergy_test_ticks",0);
wv("g_fast_isr_cycles_max",0);
wv("g_fast_isr_overrun_count",0);
// coverage: 12V,11V,13V, low sat, high sat, stale
wv("g_stage6_noenergy_test_mode",1); wv32("g_stage6_synthetic_vout",0x41400000); run(300);
wv32("g_stage6_synthetic_vout",0x41300000); run(300);
wv32("g_stage6_synthetic_vout",0x41500000); run(300);
wv32("g_stage6_synthetic_vout",0x40A00000); run(300);
wv32("g_stage6_synthetic_vout",0x41600000); run(300);
wv("g_stage6_noenergy_test_mode",3); run(300);
try{ session.target.halt(); }catch(e){}
out("BC ticks="+rv32u("g_stage6_noenergy_test_ticks"));
out("BC isr_cycles_last="+rv32u("g_fast_isr_cycles_last")+" isr_cycles_max="+rv32u("g_fast_isr_cycles_max"));
out("BC ctrl_cycles_last="+rv32u("g_control_exec_cycles_last")+" ctrl_cycles_max="+rv32u("g_control_exec_cycles_max"));
out("BC overrun="+rv32u("g_fast_isr_overrun_count"));
out("BC isr_max_us="+(rv32u("g_fast_isr_cycles_max")/60).toFixed(3));
out("BC DONE");
try{ session.terminate(); }catch(e){}
