// stage6_first_real_pi_shot_realtime.js
// Gate J: whole TINT0_ISR budget re-test for the FIRST bounded real PI SHOT
// build. Runs the closed loop with the shot ACTIVE (SHOT_FastTask ring-record
// + timer + 11V abort on every 20us tick) and reads the whole-ISR max.
//   <=900 PASS | 901..1080 MARGIN_LOW | >1080 FAIL | >=1200 ABS FAIL; overrun=0.
// No real power; CNT3/CNT4 OPEN.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
var OUT="D:\\CCS21_workspace\\Codex_Project\\evidence\\stage6_first_real_pi_shot\\LLC_100W_F28034_BRINGUP_DSH_SHOT.out";
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
// no-energy closed-loop observe handoff
wv("g_bringup_stage",7);wv("g_comp_tz_loopback_verified",1);wv("g_board_vout_cal_valid",1);
wv("g_diag_frequency_override",1);
wv("g_softstart_no_energy",1);wv("g_softstart_acceptance_mode",0);wv("g_softstart_accept_target_raw",1244);
wv("g_softstart_request",0);wv("g_softstart_result",0);wv("g_softstart_state",0);wv("g_system_state",1);
wv32("g_power_run_min_frequency_hz",120000);
wv("g_stage6_synthetic_vout_raw",1244);wv("g_stage6_closeloop_vout_inject",1);
wv("g_stage6_noenergy_test_enable",1);wv("g_stage6_noenergy_test_mode",4);
wv("g_no_energy_test_mode",1);
wv("g_stage6_transfer_request",0);wv("g_pwm_enable_request",1);
var tr=0;for(var i=0;i<40;i++){run(40);try{tr=parseInt(rw("g_stage6_transfer_request"));}catch(e){}if(tr==1)break;}
print("transferred="+tr+" sys="+rw("g_system_state"));
if(tr!=1){ print("HANDOFF FAIL"); try{session.terminate();}catch(e){} throw "halt"; }

// reset measurement accumulators
wv32("g_fast_isr_cycles_max",0);wv32("g_fast_isr_cycles_sum",0);wv32("g_fast_isr_cycles_count",0);
wv32("g_fast_isr_overrun_count",0);
wv32("g_timer0_entry_interval_min",0);wv32("g_timer0_entry_interval_max",0);
wv("g_stage6_noenergy_test_ticks",0);
// arm the shot and keep it ACTIVE for the whole measurement
wv32("g_first_real_pi_shot_power_writes",0);
wv("g_first_real_pi_shot_arm",0);wv("g_first_real_pi_shot_state",0);wv("g_first_real_pi_shot_tick",0);
wv("g_first_real_pi_shot_rb_index",0);wv("g_first_real_pi_shot_rb_count",0);
wv("g_first_shot_debug_ticks",30000);   // stay active ~600ms for a solid max
wv("g_first_real_pi_shot_arm",1);

run(2000);   // ~100000 fast ticks with shot ACTIVE (ring-record every tick)

var max=rv32("g_fast_isr_cycles_max");
var ovf=rv32("g_fast_isr_overrun_count");
var tmax=rv32("g_timer0_entry_interval_max");
var tmin=rv32("g_timer0_entry_interval_min");
var count=rv32("g_fast_isr_cycles_count");
var st=rw("g_first_real_pi_shot_state");var tk=rw("g_first_real_pi_shot_tick");
print("fast_isr_max="+max+" overrun="+ovf+" entry_interval_max="+tmax+" min="+tmin+" count="+count);
print("shot_state="+st+" tick="+tk);
var grade = (max<=900)?"PASS":(max<=1080)?"MARGIN_LOW":"FAIL";
if(max>=1200) grade="ABS_FAIL";
if(ovf>0) grade+=" (overrun)";
print("GATE_J: max="+max+" -> "+grade);
try{session.terminate();}catch(e){}
print("DONE");
