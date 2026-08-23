// stage6_first_real_pi_shot_real.js  (V1-2)
// REQUEST-ONLY driver for the FIRST BOUNDED REAL PI SHOT (200 us).
//   E1 host SHA256 hard gate (before connect) -> E2 human auth env gate ->
//   connect -> load frozen REAL OUT -> E3 run APP_Init to completion, halt ->
//   E4 hard gate (sys=IDLE, PWM=0, fault=0, OST=1, VOUT cal=1) ->
//   E5 Comparator loopback request, run, halt, verify PASS ->
//   E6/E7 sequential stage confirm 1..6 (requests 1..7), each verified ->
//   E8 final preflight re-verify all -> E9 shot arm + pwm enable request ->
//   E10/E11 runAsynch, wait 25 ms > worst-case termination, halt (NO reads) ->
//   E13 black-box read once, strict PASS/FAIL. E14 power_writes read as Uint16.
// V1-2 (STAGE6_REAL_BINARY_TIMING_HARNESS_FRESH_PATH_CLOSURE_V1):
//   - host no-read wait raised 15 ms -> 25 ms: worst-case state-machine ticks
//     include first 5 ms enable-request processing, next 5 ms SoftStart PWM
//     start, ~3.5 ms Profile C trajectory, FINAL window, 200 us PI window.
//   - strict PASS additionally requires softstart_handoff_result==OK,
//     softstart_result==COMPLETE, shot_tick==10, ring_buffer_count==11,
//     power_writes==11, and Timer2 delta (first_write_timer2 - ost_timer2)
//     within 11000..14000 cycles (~200 us @ 60 MHz; final exact tolerance to
//     be set from the no-power timing results).
// NO runtime polling during the shot. NO writes to fault/system/stage/cal/comp/
// synthetic/diag/PWM-register state. Any gate failure ABORTS (throws).
// Requires DSH_CNT34_APPROVED=1 (human auth).
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT="D:\\CCS21_workspace\\Codex_Project\\evidence\\stage6_first_real_pi_shot_real\\LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT.out";
var MANIFEST="D:\\CCS21_workspace\\Codex_Project\\evidence\\stage6_first_real_pi_shot_real\\REAL_SHA256SUMS.txt";

// ---- E1: host SHA256 hard gate (BEFORE connect/download) ----
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
  print("REAL_SHOT_HOST_SHA256_HARD_GATE_FAIL");
  throw "sha256-mismatch";
}
print("REAL_SHOT_HOST_SHA256_HARD_GATE_PASS");

// ---- E2: human auth env gate ----
var approved=(java.lang.System.getenv("DSH_CNT34_APPROVED")||"").equals("1");
print("CNT3/CNT4 real-shot approval present: "+approved);
if(!approved){ print("ABORT: DSH_CNT34_APPROVED != 1. No real shot."); throw "no-approval"; }

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
  if(!cond){ print("ABORT: gate "+name+" failed"); throw "gate-"+name; }
}

try{session.target.connect();}catch(e){}
session.memory.loadProgram(OUT);

// ---- E3: run APP_Init to completion, then halt ----
run(300);

// ---- E4: hard gate after init (READ-ONLY) ----
var sys=rw("g_system_state"); var pwm=rw("g_pwm_enabled"); var fault=rv32("g_fault_flags");
var ost=reg("EPwm1Regs.TZFLG.bit.OST"); var voutcal=rw("g_board_vout_cal_valid");
var comp=rw("g_comp_tz_loopback_verified"); var stage=rw("g_bringup_stage");
print("post-init sys="+sys+" pwm="+pwm+" fault="+fault+" ost="+ost+
      " voutcal="+voutcal+" comp="+comp+" stage="+stage);
gate("INIT_SYS_IDLE", sys===1);
gate("INIT_PWM_OFF", pwm===0);
gate("INIT_FAULT_ZERO", fault===0);
gate("INIT_OST_LATCHED", ost==="1");
gate("INIT_VOUT_CAL_VALID", voutcal===1);
gate("INIT_STAGE_ZERO", stage===0);

// ---- E5: Comparator loopback request, run, halt, verify PASS ----
wv("g_loopback_diag_request",1);          // allowed request interface
run(50);
var diag=rw("g_loopback_diag_result"); var comp2=rw("g_comp_tz_loopback_verified");
print("loopback diag result="+diag+" comp_verified="+comp2);
gate("LOOPBACK_PASS", diag===1 && comp2===1);

// ---- E6/E7: sequential stage confirm 1..6 (requests 1..7), each verified ----
// BRINGUP_STAGE_6_CLOSED_LOOP == 7, BRINGUP_STAGE_7_POWER_RUN == 8
for(var s=1;s<=7;s++){
  wv("g_stage_confirm_request",s);       // allowed request interface
  run(50);
  var stg=rw("g_bringup_stage");
  print("stage confirm request="+s+" -> stage="+stg);
  gate("STAGE_CONFIRM_"+s, stg===s);
}

// ---- E8: final preflight re-verify all (READ-ONLY) ----
sys=rw("g_system_state"); pwm=rw("g_pwm_enabled"); fault=rv32("g_fault_flags");
ost=reg("EPwm1Regs.TZFLG.bit.OST"); voutcal=rw("g_board_vout_cal_valid");
comp=rw("g_comp_tz_loopback_verified"); stage=rw("g_bringup_stage");
var arm=rw("g_first_real_pi_shot_arm");
print("final preflight sys="+sys+" pwm="+pwm+" fault="+fault+" ost="+ost+
      " voutcal="+voutcal+" comp="+comp+" stage="+stage+" arm="+arm);
gate("PREFLIGHT_SYS_IDLE", sys===1);
gate("PREFLIGHT_PWM_OFF", pwm===0);
gate("PREFLIGHT_FAULT_ZERO", fault===0);
gate("PREFLIGHT_OST_LATCHED", ost==="1");
gate("PREFLIGHT_VOUT_CAL", voutcal===1);
gate("PREFLIGHT_COMP_VERIFIED", comp===1);
gate("PREFLIGHT_STAGE6", stage===7);   // BRINGUP_STAGE_6_CLOSED_LOOP == 7, BRINGUP_STAGE_7_POWER_RUN == 8
gate("PREFLIGHT_ARM_CLEAR", arm===0);

// ---- E9: shot pre-arm + formal enable request (request interface only) ----
wv32("g_test_run_id",0x5A11);            // allowed request interface
wv("g_first_real_pi_shot_arm",1);        // pre-arm BEFORE formal enable (G1)
wv("g_pwm_enable_request",1);            // formal enable request

// ---- E10/E11: runAsynch, wait > worst-case termination, halt. NO reads. ----
// Worst case: 5 ms enable-request processing + 5 ms SoftStart PWM start tick
// + ~3.5 ms formal Profile C ramp + FINAL window + 0.2 ms PI shot + on-chip
// termination = ~12.2 ms. 25 ms exceeds it with margin (no reads during wait).
session.target.runAsynch();
java.lang.Thread.sleep(25);
session.target.halt();

// ---- E13: black-box read once, strict PASS/FAIL ----
var st=rw("g_first_real_pi_shot_state"); var tk=rw("g_first_real_pi_shot_tick");
var ab=rw("g_first_real_pi_shot_abort"); var okf=rw("g_first_real_pi_shot_ok");
var rbc=rw("g_first_real_pi_shot_rb_count");
var pw=rw("g_first_real_pi_shot_power_writes");   // E14: Uint16, NOT rv32
var fw=rv32("g_first_real_pi_shot_first_write_timer2");
var ostt=rv32("g_first_real_pi_shot_ost_timer2");
var sys2=rw("g_system_state"); var pwm2=rw("g_pwm_enabled"); var fault2=rv32("g_fault_flags");
var ost2=reg("EPwm1Regs.TZFLG.bit.OST");
var ssres=rw("g_softstart_result"); var hres=rw("g_softstart_handoff_result");
var t2d=(fw-ostt)>>>0;   // Timer2 down-counter: first_write - ost = elapsed cycles
print("shot state="+st+" tick="+tk+" abort="+ab+" ok="+okf+" rb="+rbc+" power_writes="+pw);
print("first_write_timer2="+fw+" ost_timer2="+ostt+" timer2_delta="+t2d+
      " (expect 11000..14000 cycles, ~200 us @ 60 MHz)");
print("post-shot sys="+sys2+" pwm="+pwm2+" fault="+fault2+" ost="+ost2+
      " softstart_result="+ssres+" handoff_result="+hres);
var pass = (st===3 && okf===1 && ab===1 && pwm2===0 && ost2==="1" &&
            fault2===0 && sys2===1 && hres===1 && ssres===1 &&
            tk===10 && rbc===11 && pw===11 &&
            t2d>=11000 && t2d<=14000);
print(pass ? "REAL_SHOT_STRICT_PASS" : "REAL_SHOT_STRICT_FAIL");
if(!pass){
  print("REAL_SHOT_RESULT_FAIL");
  throw "shot-fail";
}

// ---- evidence: ring buffer dump (read-only, after strict evaluation) ----
for(var j=0;j<rbc && j<32;j++){
  var i=j;
  print("  rb["+i+"] tick="+rv32("g_first_real_pi_shot_rb["+i+"].tick")+
        " fresh="+rw("g_first_real_pi_shot_rb["+i+"].fresh_sample")+
        " freq_cmd="+rv32("g_first_real_pi_shot_rb["+i+"].freq_cmd_hz")+
        " actual="+rv32("g_first_real_pi_shot_rb["+i+"].actual_freq_hz")+
        " vout_raw="+rw("g_first_real_pi_shot_rb["+i+"].vout_raw")+
        " err="+rw("g_first_real_pi_shot_rb["+i+"].error_raw")+
        " tbprd="+rw("g_first_real_pi_shot_rb["+i+"].tbprd")+
        " pi="+rv32("g_first_real_pi_shot_rb["+i+"].pi_integral_q12"));
}
print("REAL_SHOT_DONE");
