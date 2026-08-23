// stage6_first_real_pi_shot_real_binary_timing_nopower.js  (V1-3)
// Gate K: whole TINT0_ISR budget re-test for the FIRST bounded real PI SHOT
// REAL binary. NO POWER: CNT3/CNT4 OPEN, OST=1, PWM hardware-clamped low.
//   <=900 PASS | 901..1080 MARGIN_LOW | >1080 FAIL; overrun=0.
// V1-3 (STAGE6_REAL_BINARY_TIMING_HARNESS_PERIOD_WRITE_CLOSURE_V1_3):
//   - keeps the deterministic fresh control input (manufactured EXACTLY ONCE
//     after all safety hard gates: fault=0, OST=1, PWM=0, AQCSFRC force-low
//     verified by read-back):
//       g_control_adc_sequence_last = 0
//       g_adc_sample_sequence       = 1
//       g_adc_vout_raw             = 1200
//       g_adc_vout_filtered_raw     = 1200
//       g_control_vref_raw         = 1244   (10 V board-calibrated raw)
//   - initial frequency state changed to:
//       g_control_frequency_hz     = 149900
//       g_control_shadow_frequency_hz = 149900
//       g_switching_frequency_hz   = 149900
//       g_pwm_period               = 399
//     First fresh PI tick (error_raw = 1244-1200 = +44, step clamped to
//     -100 Hz/tick): frequency command = 149800 Hz, period(149800) = 400 !=
//     g_pwm_period (399) -> LLC_SetFrequencyHz takes the FULL period-changing
//     path: period division, TBPRD write (400), CMPA write (200), ADC sync
//     (ADC_UpdatePwmSyncPointKeepCadence), g_pwm_period update (400),
//     g_actual_switching_frequency_hz update (60000000/401 = 149625 Hz).
//   - pre-run READ-ONLY gates: EPwm1Regs.TBPRD == 399, g_pwm_period == 399.
//   - post-run strict gates (ring first entry records the FIRST write's state
//     because CTRL_FastTask runs before SHOT_FastTask):
//       ring[0].fresh_sample == 1, ring[0].freq_cmd_hz == 149800,
//       ring[0].tbprd == 400 (the value written to EPwm1Regs.TBPRD and stored
//       in g_pwm_period at the first write), ring[0].actual_freq_hz == 149625
//       (period division + g_actual_switching_frequency_hz update).
//     NOT just "freq_cmd != 150000": the TBPRD change and the actual-frequency
//     update are required (prevents FREQUENCY_CHANGED_BUT_TBPRD_UNCHANGED).
//   - Timer2 no-power hard gate: timer2_delta = (first_write_timer2 -
//     ost_timer2) unsigned 32-bit, 11000 <= delta <= 14000 (~200 us @ 60 MHz);
//     prints FIRST_WRITE_TIMER2 / OST_TIMER2 / TIMER2_DELTA.
//   - result consistency gates: shot ok==1, rb_count==11, power_writes
//     delta==11, g_real_isr_cycles_count>0, g_real_timer0_entry_count>0,
//     state==COMPLETE, abort==TIMEOUT, tick==10, PWM==0, OST==1, fault==0,
//     isr_max<=900, overrun==0. Any failure -> TIMING_NOPOWER_FAIL.
//   - run(20) = 20 ms (NOT 2 s): the test state starts directly in RUN with
//     the shot armed; the 200 us cage ends after ~0.22 ms (11 x 20 us ticks)
//     with on-chip OST=1 / PWM=0 / sys=IDLE; the remaining time observes idle
//     ticks. The first fresh control tick (worst case) is captured in the
//     first 20 us. (The old run(2000) was 2 SECONDS, not 2 ms.)
// These RAM writes exist ONLY in this no-power timing script (CNT3/CNT4 OPEN,
// OST latched, AQCSFRC force-low). NO synthetic injection in REAL firmware.
// Forbidden: auto-clear fault, clear OST, any TZCLR.OST, any real enable
// request, any power shot. NOT to be executed while CNT3/CNT4 remain open
// (DSH_CNT34_OPEN_CONFIRMED=1 is the human gate).
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT="D:\\CCS21_workspace\\Codex_Project\\evidence\\stage6_first_real_pi_shot_real\\LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT.out";
var MANIFEST="D:\\CCS21_workspace\\Codex_Project\\evidence\\stage6_first_real_pi_shot_real\\REAL_SHA256SUMS.txt";

// ---- F: host SHA256 hard gate (BEFORE connect) ----
function sha256File(path){
  var md=MessageDigest.getInstance("SHA-256");
  var fis=new FileInputStream(path);
  var buf=java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE,8192);
  var n;
  while((n=fis.read(buf))>0){ md.update(buf,0,n); }
  fis.close();
  var d=md.digest();
  var sb=new StringBuilder();
  for(var i=0;i<d.length;i++){ sb.append(String.format("%02X",d[i]&0xFF)); }
  return sb.toString();
}
var expected="";
var lines=java.io.BufferedReader(new java.io.FileReader(MANIFEST));
var t;
while((t=lines.readLine())!=null){
  if(t.indexOf("REAL_OUT_SHA256")===0){ expected=t.split("=")[1].trim(); }
}
lines.close();
var actual=sha256File(OUT);
print("REAL OUT host SHA256: "+actual);
print("REAL OUT manifest   : "+expected);
if(actual!==expected){
  print("ABORT: REAL OUT SHA256 mismatch. Refusing to connect/download.");
  print("TIMING_HOST_SHA256_HARD_GATE_FAIL");
  throw "sha256-mismatch";
}
print("TIMING_HOST_SHA256_HARD_GATE_PASS");

// ---- F: CNT3/CNT4 OPEN confirmation gate ----
var open=(java.lang.System.getenv("DSH_CNT34_OPEN_CONFIRMED")||"").equals("1");
print("CNT3/CNT4 open confirmed: "+open);
if(!open){ print("ABORT: DSH_CNT34_OPEN_CONFIRMED != 1. No-power timing not permitted."); throw "no-open-confirm"; }

var env=ScriptingEnvironment.instance(); var server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();
function addr(n){return session.expression.evaluate("&"+n);}
function rw(n){try{return session.memory.readWord(1,addr(n));}catch(e){return -1;}}
function rv32(n){try{var a=addr(n);return(session.memory.readWord(1,a)|(session.memory.readWord(1,a+1)<<16))>>>0;}catch(e){return -1;}}
function wv(n,v){session.memory.writeWord(1,addr(n),v);}
function wv32(n,v){var a=addr(n);session.memory.writeWord(1,a,v&0xFFFF);session.memory.writeWord(1,a+1,(v>>>16)&0xFFFF);}
function reg(e){try{return ""+session.expression.evaluate(e);}catch(err){return "<f>";}}
function run(ms){session.target.runAsynch();java.lang.Thread.sleep(ms);session.target.halt();}
function gate(name,cond){
  print("GATE "+name+": "+(cond?"PASS":"FAIL"));
  if(!cond){ print("ABORT: gate "+name+" failed. Exiting WITHOUT writing run state."); throw "gate-"+name; }
}

try{session.target.connect();}catch(e){}
session.memory.loadProgram(OUT);
run(300);

// ---- F: hard gates BEFORE any test-state write (READ-ONLY) ----
var fault=rv32("g_fault_flags");
var ost=reg("EPwm1Regs.TZFLG.bit.OST");
var pwm=rw("g_pwm_enabled");
print("pre-test fault="+fault+" ost="+ost+" pwm="+pwm);
gate("FAULT_ZERO", fault===0);
gate("OST_LATCHED", ost==="1");
gate("PWM_OFF", pwm===0);

// ---- F: explicitly force AQCSFRC low (secondary clamp) and verify ----
session.expression.evaluate("EPwm1Regs.AQCSFRC.all = 0x11");   // CSFA=CSFB=AQ_CLEAR
var cfa=reg("EPwm1Regs.AQCSFRC.bit.CSFA");
var cfb=reg("EPwm1Regs.AQCSFRC.bit.CSFB");
print("AQCSFRC CSFA="+cfa+" CSFB="+cfb);
gate("AQCSFRC_FORCE_LOW", cfa==="1" && cfb==="1");

// ---- C: pre-run READ-ONLY period baseline (init state, before any write) ----
var tbprd0=reg("EPwm1Regs.TBPRD");
var pper0=rw("g_pwm_period");
print("pre-run EPwm1Regs.TBPRD="+tbprd0+" g_pwm_period="+pper0);
gate("PRE_RUN_TBPRD_399", tbprd0==="399");
gate("PRE_RUN_PERIOD_399", pper0===399);

// ---- safe no-power RAM test state (CNT3/CNT4 OPEN, OST=1, AQCSFRC low) ----
wv("g_system_state",3);            // SYS_STATE_RUN
wv("g_pwm_enabled",1);             // PWM logically enabled (hardware clamped low)
wv("g_bringup_stage",7);           // BRINGUP_STAGE_6_CLOSED_LOOP == 7, BRINGUP_STAGE_7_POWER_RUN == 8
wv("g_control_reference_valid",1);
wv32("g_voltage_reference",0x41200000);   // 10.0f IEEE-754 bits
wv("g_first_real_pi_shot_arm",1);
wv("g_softstart_handoff_result",1);       // HANDOFF_RESULT_OK
wv("g_board_vout_cal_valid",1);
wv("g_comp_tz_loopback_verified",1);
wv32("g_power_run_min_frequency_hz",150000);

// ---- B: manufacture the deterministic fresh control input EXACTLY ONCE ----
// (only here, after all safety hard gates: CNT3/CNT4 OPEN, OST latched,
//  AQCSFRC force-low; no synthetic injection in REAL firmware)
wv32("g_control_adc_sequence_last",0);        // force first control tick FRESH
wv32("g_adc_sample_sequence",1);              // new sample sequence (ADC ISR advances it)
wv("g_adc_vout_raw",1200);                    // VOUT raw != Vref raw -> error_raw = +44
wv("g_adc_vout_filtered_raw",1200);
wv("g_control_vref_raw",1244);                // 10 V board-calibrated raw
// V1-3: initial frequency state 149900 (period 399). First fresh PI tick:
// step clamped to -100 Hz -> command 149800 -> period(149800) = 400 != 399 ->
// FULL period-changing actuator path (division, TBPRD/CMPA write, ADC sync,
// g_pwm_period=400, g_actual_switching_frequency_hz=60000000/401=149625).
wv32("g_control_frequency_hz",149900);        // committed command == switching freq
wv32("g_control_shadow_frequency_hz",149900); // PI shadow base
wv32("g_switching_frequency_hz",149900);      // keep slow-task freq gate quiet
wv("g_pwm_period",399);                       // 150 kHz baseline period

// ---- pre-run counters (delta semantics) ----
var fresh0=rv32("g_control_fresh_sample_count");
var pi0=rv32("g_control_pi_update_count");
var pw0=rw("g_first_real_pi_shot_power_writes");
print("pre-run fresh_count="+fresh0+" pi_update_count="+pi0+" power_writes="+pw0);

// ---- clear all g_real_* accumulators together (measurement window) ----
wv32("g_real_isr_cycles_max",0);
wv32("g_real_isr_cycles_sum",0);
wv32("g_real_isr_cycles_count",0);
wv32("g_real_isr_overrun_count",0);
wv32("g_real_timer0_entry_count",0);
wv32("g_real_timer0_last_entry",0);
wv32("g_real_timer0_entry_interval_min",0xFFFFFFFF);
wv32("g_real_timer0_entry_interval_max",0);

// run(20) = 20 ms (NOT 2 s): state starts directly in RUN with the shot armed;
// the 200 us cage ends after ~0.22 ms (11 x 20 us ticks) with on-chip
// OST=1/PWM=0/IDLE; the remaining time observes idle ticks. The first fresh
// control tick (worst case: full period-changing LLC_SetFrequencyHz path) is
// captured in the first 20 us.
run(20);

// ---- C/D/E: result hard gates (any failure -> TIMING_NOPOWER_FAIL) ----
var max=rv32("g_real_isr_cycles_max");
var ovf=rv32("g_real_isr_overrun_count");
var tmax=rv32("g_real_timer0_entry_interval_max");
var tmin=rv32("g_real_timer0_entry_interval_min");
var count=rv32("g_real_isr_cycles_count");
var ecnt=rv32("g_real_timer0_entry_count");
var fresh1=rv32("g_control_fresh_sample_count");
var pi1=rv32("g_control_pi_update_count");
var pw1=rw("g_first_real_pi_shot_power_writes");
var fdelta=(fresh1-fresh0)>>>0;
var pdelta=(pi1-pi0)>>>0;
var pwdelta=(pw1-pw0)>>>0;
var st=rw("g_first_real_pi_shot_state");
var ab=rw("g_first_real_pi_shot_abort");
var tk=rw("g_first_real_pi_shot_tick");
var okf=rw("g_first_real_pi_shot_ok");
var pwm2=rw("g_pwm_enabled");
var ost2=reg("EPwm1Regs.TZFLG.bit.OST");
var fault2=rv32("g_fault_flags");
var rbi=rw("g_first_real_pi_shot_rb_index");
var rbc=rw("g_first_real_pi_shot_rb_count");
var rstart=((rbi-rbc)%32+32)%32;
var rbf=rw("g_first_real_pi_shot_rb["+rstart+"].fresh_sample");
var rbfq=rv32("g_first_real_pi_shot_rb["+rstart+"].freq_cmd_hz");
var rbt=rw("g_first_real_pi_shot_rb["+rstart+"].tbprd");
var rba=rv32("g_first_real_pi_shot_rb["+rstart+"].actual_freq_hz");
var fw=rv32("g_first_real_pi_shot_first_write_timer2");
var ostt=rv32("g_first_real_pi_shot_ost_timer2");
var t2d=(fw-ostt)>>>0;   // Timer2 down-counter: first_write - ost = elapsed cycles
var freq_cmd=rv32("g_control_frequency_hz");
var pper2=rw("g_pwm_period");
var tbprd2=reg("EPwm1Regs.TBPRD");
var actual2=rv32("g_actual_switching_frequency_hz");
print("real_isr_max="+max+" overrun="+ovf+" entry_interval_max="+tmax+" min="+tmin+" count="+count+" entry_count="+ecnt);
print("fresh_delta="+fdelta+" pi_delta="+pdelta+" power_writes="+pw1+" (delta "+pwdelta+")");
print("shot state="+st+" abort="+ab+" tick="+tk+" ok="+okf);
print("post-run pwm="+pwm2+" ost="+ost2+" fault="+fault2+" rb_index="+rbi+" rb_count="+rbc);
print("ring[0] fresh="+rbf+" freq_cmd_hz="+rbfq+" tbprd="+rbt+" actual_freq_hz="+rba);
print("FIRST_WRITE_TIMER2="+fw);
print("OST_TIMER2="+ostt);
print("TIMER2_DELTA="+t2d);
// post-run globals hold the LAST write's state (11 steps of -100 Hz from
// 149900: freq=148800, period=402, TBPRD=402, actual=60000000/403=148883);
// printed as evidence, the strict period-change proof is the ring[0] record.
print("post-run freq_cmd="+freq_cmd+" g_pwm_period="+pper2+" EPwm1Regs.TBPRD="+tbprd2+" actual="+actual2);

try{
  gate("FRESH_SAMPLE_DELTA", fdelta>=1);
  gate("PI_UPDATE_DELTA", pdelta>=1);
  gate("POWER_WRITES_DELTA_11", pwdelta===11);
  gate("RING_FIRST_FRESH", rbf===1);
  gate("RING_FIRST_FREQ_149800", rbfq===149800);
  gate("RING_FIRST_TBPRD_400", rbt===400);
  gate("RING_FIRST_ACTUAL_149625", rba===149625);
  gate("SHOT_STATE_COMPLETE", st===3);
  gate("SHOT_ABORT_TIMEOUT", ab===1);
  gate("SHOT_TICK_10", tk===10);
  gate("SHOT_OK_1", okf===1);
  gate("RB_COUNT_11", rbc===11);
  gate("PWM_ZERO", pwm2===0);
  gate("OST_LATCHED_END", ost2==="1");
  gate("FAULT_ZERO_END", fault2===0);
  gate("ISR_MAX_LE_900", max<=900);
  gate("OVERRUN_ZERO", ovf===0);
  gate("ISR_COUNT_POSITIVE", count>0);
  gate("TIMER0_ENTRY_POSITIVE", ecnt>0);
  gate("TIMER2_DELTA_11000_14000", t2d>=11000 && t2d<=14000);
}catch(e){
  print("TIMING_NOPOWER_FAIL");
  throw e;
}
print("TIMING_NOPOWER_PASS");

// ---- evidence: ring dump (read-only, after strict evaluation) ----
for(var j=0;j<rbc && j<32;j++){
  var i=(rstart+j)%32;
  print("  rb["+i+"] tick="+rv32("g_first_real_pi_shot_rb["+i+"].tick")+
        " fresh="+rw("g_first_real_pi_shot_rb["+i+"].fresh_sample")+
        " freq_cmd="+rv32("g_first_real_pi_shot_rb["+i+"].freq_cmd_hz")+
        " actual="+rv32("g_first_real_pi_shot_rb["+i+"].actual_freq_hz")+
        " vout_raw="+rw("g_first_real_pi_shot_rb["+i+"].vout_raw")+
        " err="+rw("g_first_real_pi_shot_rb["+i+"].error_raw")+
        " tbprd="+rw("g_first_real_pi_shot_rb["+i+"].tbprd")+
        " pi="+rv32("g_first_real_pi_shot_rb["+i+"].pi_integral_q12"));
}
print("REALTIME_REAL_BINARY_GRADE="+((max<=900)?"PASS":(max<=1080)?"MARGIN_LOW":"FAIL"));
print("REALTIME_REAL_BINARY_DONE");
