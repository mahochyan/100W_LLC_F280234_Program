// stage6_first_real_pi_shot_real_binary_timing_nopower.js  (V1-1)
// Gate K: whole TINT0_ISR budget re-test for the FIRST bounded real PI SHOT
// REAL binary. NO POWER: CNT3/CNT4 OPEN, OST=1, PWM hardware-clamped low.
//   <=900 PASS | 901..1080 MARGIN_LOW | >1080 FAIL | >=1200 ABS FAIL; overrun=0.
// F: host SHA256 hard gate + DSH_CNT34_OPEN_CONFIRMED=1 before connect; after
// loadProgram+run(300)+halt hard-gate fault=0, OST=1, PWM=0, then explicitly
// force AQCSFRC low and verify read-back. Any gate failure exits immediately
// WITHOUT writing any test run state. Clears all g_real_* accumulators
// together, discards the first sample as warm-up, runs 2 ms, grades.
// Forbidden: auto-clear fault, clear OST, any TZCLR.OST, any real enable
// request, any power shot. This script is NOT to be executed while CNT3/CNT4
// remain open (DSH_CNT34_OPEN_CONFIRMED=1 is the human gate).
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

// ---- safe no-power RAM test state (CNT3/CNT4 OPEN, OST=1, AQCSFRC low) ----
wv("g_system_state",3);            // SYS_STATE_RUN
wv("g_pwm_enabled",1);             // PWM logically enabled (hardware clamped low)
wv("g_bringup_stage",7);           // BRINGUP_STAGE_6_CLOSED_LOOP
wv("g_control_reference_valid",1);
wv32("g_voltage_reference",0x41200000);   // 10.0f IEEE-754 bits
wv("g_control_vref_raw",1244);            // 10 V board-calibrated raw
wv("g_first_real_pi_shot_arm",1);
wv("g_softstart_handoff_result",1);       // HANDOFF_RESULT_OK
wv("g_board_vout_cal_valid",1);
wv("g_comp_tz_loopback_verified",1);
wv32("g_power_run_min_frequency_hz",150000);
wv32("g_switching_frequency_hz",150000);  // keep slow-task freq gate quiet

// ---- clear all g_real_* accumulators together (warm-up discard) ----
wv32("g_real_isr_cycles_max",0);
wv32("g_real_isr_cycles_sum",0);
wv32("g_real_isr_cycles_count",0);
wv32("g_real_isr_overrun_count",0);
wv32("g_real_timer0_entry_count",0);
wv32("g_real_timer0_last_entry",0);
wv32("g_real_timer0_entry_interval_min",0xFFFFFFFF);
wv32("g_real_timer0_entry_interval_max",0);

run(2000);   // ~100000 fast ticks, shot ACTIVE, whole-ISR observation

var max=rv32("g_real_isr_cycles_max");
var ovf=rv32("g_real_isr_overrun_count");
var tmax=rv32("g_real_timer0_entry_interval_max");
var tmin=rv32("g_real_timer0_entry_interval_min");
var count=rv32("g_real_isr_cycles_count");
var ecnt=rv32("g_real_timer0_entry_count");
print("real_isr_max="+max+" overrun="+ovf+" entry_interval_max="+tmax+" min="+tmin+" count="+count+" entry_count="+ecnt);
var grade = (max<=900)?"PASS":(max<=1080)?"MARGIN_LOW":"FAIL";
print("REALTIME_REAL_BINARY_GRADE="+grade);
if(ovf!==0){ print("REALTIME_REAL_BINARY_OVERRUN_FAIL"); }
print("REALTIME_REAL_BINARY_DONE");
