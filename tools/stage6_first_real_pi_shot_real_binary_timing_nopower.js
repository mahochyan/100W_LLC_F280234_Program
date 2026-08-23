// stage6_first_real_pi_shot_real_binary_timing_nopower.js
// Gate K: whole TINT0_ISR budget re-test for the FIRST bounded real PI SHOT
// REAL binary. NO POWER: CNT3/CNT4 OPEN, OST=1, PWM hardware-clamped low.
//   <=900 PASS | 901..1080 MARGIN_LOW | >1080 FAIL | >=1200 ABS FAIL; overrun=0.
// Clears all g_real_* accumulators together, discards the first sample as
// warm-up, runs 2 ms, reads max/overrun/interval, grades.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
var OUT="D:\\CCS21_workspace\\Codex_Project\\evidence\\stage6_first_real_pi_shot_real\\LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT.out";
var env=ScriptingEnvironment.instance(); var server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();
function addr(n){return session.expression.evaluate("&"+n);}
function rw(n){try{return session.memory.readWord(1,addr(n));}catch(e){return -1;}}
function rv32(n){try{var a=addr(n);return(session.memory.readWord(1,a)|(session.memory.readWord(1,a+1)<<16))>>>0;}catch(e){return -1;}}
function wv(n,v){session.memory.writeWord(1,addr(n),v);}
function wv32(n,v){var a=addr(n);session.memory.writeWord(1,a,v&0xFFFF);session.memory.writeWord(1,a+1,(v>>>16)&0xFFFF);}
function run(ms){session.target.runAsynch();java.lang.Thread.sleep(ms);session.target.halt();}

try{session.target.connect();}catch(e){}
session.memory.loadProgram(OUT);
run(300);

// ---- safe no-power RAM test state (CNT3/CNT4 OPEN, OST=1, PWM clamped low) ----
wv("g_system_state",3);            // RUN
wv("g_pwm_enabled",1);             // PWM logically enabled (hardware clamped low)
wv("g_bringup_stage",6);           // BRINGUP_STAGE_6_CLOSED_LOOP
wv("g_control_reference_valid",1);
wv("g_control_reference_volts",10.0);
wv("g_first_real_pi_shot_arm",1);
wv("g_softstart_handoff_result",1);
wv("g_board_vout_cal_valid",1);
wv("g_comp_tz_loopback_verified",1);
wv32("g_fault_flags",0);
wv32("g_power_run_min_frequency_hz",150000);

// ---- clear all g_real_* accumulators together (warm-up discard) ----
wv32("g_real_isr_cycles_max",0);
wv32("g_real_isr_cycles_sum",0);
wv32("g_real_isr_cycles_count",0);
wv32("g_real_isr_overrun_count",0);
wv32("g_real_timer0_entry_count",0);
wv32("g_real_timer0_last_entry",0);
wv32("g_real_timer0_interval_min",0);
wv32("g_real_timer0_interval_max",0);

run(2000);   // ~100000 fast ticks, shot ACTIVE, whole-ISR observation

var max=rv32("g_real_isr_cycles_max");
var ovf=rv32("g_real_isr_overrun_count");
var tmax=rv32("g_real_timer0_interval_max");
var tmin=rv32("g_real_timer0_interval_min");
var count=rv32("g_real_isr_cycles_count");
var ecnt=rv32("g_real_timer0_entry_count");
print("real_isr_max="+max+" overrun="+ovf+" entry_interval_max="+tmax+" min="+tmin+" count="+count+" entry_count="+ecnt);
var grade = (max<=900)?"PASS":(max<=1080)?"MARGIN_LOW":"FAIL";
print("REALTIME_REAL_BINARY_GRADE="+grade);
if(ovf!==0){ print("REALTIME_REAL_BINARY_OVERRUN_FAIL"); }
print("REALTIME_REAL_BINARY_DONE");
