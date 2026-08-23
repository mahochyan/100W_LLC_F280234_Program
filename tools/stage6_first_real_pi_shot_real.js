// stage6_first_real_pi_shot_real.js
// REQUEST-ONLY driver for the FIRST BOUNDED REAL PI SHOT (200 us).
//   host SHA256 hard gate -> connect -> load frozen REAL OUT -> safe preflight
//   (read-only) -> shot pre-arm -> formal enable request -> runAsynch ->
//   wait > 200 us (on-chip auto-OST) -> halt -> one-shot result dump.
// NO runtime polling during the shot. NO writes to fault/system/stage/cal/comp/
// synthetic/diag/PWM-register state. Requires DSH_CNT34_APPROVED=1.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT="D:\\CCS21_workspace\\Codex_Project\\evidence\\stage6_first_real_pi_shot_real\\LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT.out";
var MANIFEST="D:\\CCS21_workspace\\Codex_Project\\evidence\\stage6_first_real_pi_shot_real\\REAL_SHA256SUMS.txt";

// ---- host SHA256 hard gate (J) ----
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

// ---- CNT3/CNT4 approval gate ----
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

try{session.target.connect();}catch(e){}
session.memory.loadProgram(OUT);

// ---- safe preflight (READ-ONLY) ----
print("preflight sys="+rw("g_system_state")+" pwm="+rw("g_pwm_enabled")+
      " fault="+rv32("g_fault_flags")+" ost="+reg("EPwm1Regs.TZFLG.bit.OST")+
      " dac="+reg("Comp1Regs.DACVAL.all")+" voutcal="+rw("g_board_vout_cal_valid")+
      " comp="+rw("g_comp_tz_loopback_verified")+" stage="+rw("g_bringup_stage"));

// ---- request-only shot sequence ----
wv("g_loopback_diag_request",1);          // allowed request interface
wv("g_stage_confirm_request",6);          // allowed request interface
wv32("g_test_run_id",0x5A11);             // allowed request interface
wv("g_first_real_pi_shot_arm",1);         // pre-arm BEFORE formal enable (G1)
wv("g_pwm_enable_request",1);             // formal enable request
session.target.runAsynch();               // no reads during run
java.lang.Thread.sleep(2);                // > 200 us; firmware SoftStart + 200 us shot self-end
session.target.halt();

// ---- one-shot result dump ----
var st=rw("g_first_real_pi_shot_state");var tk=rw("g_first_real_pi_shot_tick");
var ab=rw("g_first_real_pi_shot_abort");var rbc=rw("g_first_real_pi_shot_rb_count");
var pw=rv32("g_first_real_pi_shot_power_writes");
var fw=rv32("g_first_real_pi_shot_first_write_timer2");
var ost=rv32("g_first_real_pi_shot_ost_timer2");
print("shot state="+st+" tick="+tk+" abort="+ab+" rb="+rbc+" power_writes="+pw);
print("first_write_timer2="+fw+" ost_timer2="+ost);
for(var j=0;j<rbc && j<32;j++){
  var i=j;
  print("  rb["+i+"] tick="+rv32("g_first_real_pi_shot_rb["+i+"].tick")+
        " freq_cmd="+rv32("g_first_real_pi_shot_rb["+i+"].freq_cmd_hz")+
        " actual="+rv32("g_first_real_pi_shot_rb["+i+"].actual_freq_hz")+
        " vout_raw="+rw("g_first_real_pi_shot_rb["+i+"].vout_raw")+
        " err="+rw("g_first_real_pi_shot_rb["+i+"].error_raw")+
        " tbprd="+rw("g_first_real_pi_shot_rb["+i+"].tbprd")+
        " pi="+rv32("g_first_real_pi_shot_rb["+i+"].pi_integral_q12"));
}
print("REAL_SHOT_DONE");
