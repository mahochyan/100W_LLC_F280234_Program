// stage6_budget_permode.js - per-mode whole-ISR budget to isolate which mode overruns.
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
out("BPM connect OK");
session.memory.loadProgram(OUT);
wv32("g_control_frequency_hz",150000); wv32("g_control_shadow_frequency_hz",150000);
wv32("g_pi_integral",0); wv32("g_pi_integral_q12",0);
wv("g_control_reference_valid",1); wv("g_control_vref_raw",1491);
wv("g_control_adc_sequence_last",0); wv("g_stage6_synthetic_sequence",0);
wv32("g_voltage_reference",0x41400000);
wv("g_control_running",1); wv("g_adc_pwm_sync_consecutive_miss",0); wv("g_adc_pwm_sync_valid",1);
wv("g_stage6_noenergy_test_enable",1);
// modes: voltage=FRESH(mode1) worst-case, stale=HELD(mode3)
var modes=[["12V",1491,1],["11V",1368,1],["13V",1615,1],
           ["5V-lowSat",626,1],["14V-hiSat",1739,1],["stale",0,3]];
for(var i=0;i<modes.length;i++){
  wv("g_stage6_synthetic_vout_raw",modes[i][1]);
  wv("g_stage6_noenergy_test_mode",modes[i][2]);
  run(250);
  out("PM "+modes[i][0]+" isr_last="+rv32u("g_fast_isr_cycles_last")+" isr_max="+rv32u("g_fast_isr_cycles_max")+" ctrl_last="+rv32u("g_control_exec_cycles_last")+" ctrl_max="+rv32u("g_control_exec_cycles_max")+" overrun="+rv32u("g_fast_isr_overrun_count")+" ticks="+rv32u("g_stage6_noenergy_test_ticks"));
}
out("PM DONE");
try{ session.terminate(); }catch(e){}
