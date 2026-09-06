// W5 reference ladder REAL fire host (Stage6_W5_LADDER).
// Requires a fresh single-message bench confirmation BEFORE arming:
//   CR15 connected, Vin 24 V, INPUT LIMIT 0.7 A, operator replied 0P7A_READY=1.
// No synthetic injection here: the real plant runs the ladder.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_W5_LADDER\\LLC_100W_F28034_OPEN_LOOP_STEADY.out";
var EXPECTED_SHA="78C60382C86B6A15F0A870E046CDBB3089BB2495320CF002CF45A5BC44CFD43B";
var env=ScriptingEnvironment.instance(),server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();
function addr(n){return session.expression.evaluate("&"+n);}
function rw(n){return session.memory.readWord(1,addr(n));}
function rv32u(n){var a=addr(n),lo=session.memory.readWord(1,a),hi=session.memory.readWord(1,a+1);return (lo|(hi<<16))>>>0;}
function wv(n,v){session.memory.writeWord(1,addr(n),v);}
function wv32(n,v){var a=addr(n);session.memory.writeWord(1,a,v&0xffff);session.memory.writeWord(1,a+1,(v>>>16)&0xffff);}
function run(ms){session.target.runAsynch();java.lang.Thread.sleep(ms);session.target.halt();}
function check(name,ok,detail){print(name+"="+(ok?"TRUE":"FALSE")+(detail?(" "+detail):""));if(!ok)failures++;}
function sha256File(path){
  var md=MessageDigest.getInstance("SHA-256"),fis=new FileInputStream(path);
  var buf=java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE,8192),n;
  while((n=fis.read(buf))>0){md.update(buf,0,n);}fis.close();
  var d=md.digest(),sb=new StringBuilder();
  for(var i=0;i<d.length;i++){var h=(d[i]&0xff).toString(16);if(h.length<2)h="0"+h;sb.append(h.toUpperCase());}
  return sb.toString();
}
var failures=0;
print("=== SOL W5 REFERENCE LADDER REAL FIRE ===");
var actualSha=sha256File(OUT);
check("W5REAL_SHA_HARD_GATE",actualSha.equals(EXPECTED_SHA),"actual="+actualSha);
if(failures)throw "w5-real-sha-gate";
session.target.connect();try{session.target.halt();}catch(e){}
session.memory.loadProgram(OUT);run(400);
// FULL pre-arm authorization (root-cause fix for attempt 1 stall):
wv("g_loopback_diag_request",1);run(50);
check("W5REAL_LOOPBACK_PASS",rw("g_loopback_diag_result")===1&&
      rw("g_comp_tz_loopback_verified")===1,
      "diag="+rw("g_loopback_diag_result")+" verified="+rw("g_comp_tz_loopback_verified"));
wv("g_stage_confirm_request",5);run(50);
check("W5REAL_STAGE_CONFIRM",rw("g_bringup_stage")===5,"stage="+rw("g_bringup_stage"));
run(200);
check("W5REAL_FAULTS_ZERO",rv32u("g_fault_flags")===0,"flags="+rv32u("g_fault_flags"));
wv32("g_test_run_id",1);
wv("g_cal_hold_mode_request",2);
wv("g_cal_hold_duration_ms",10500);
wv("g_cal_hold_request",1);
run(80);
print("armed state="+rw("g_cal_hold_state")+" reason="+rw("g_cal_hold_stop_reason"));
// Ladder: 5 rungs x (100 ms + 2 s) = 10.5 s; poll to capture progress.
var trace="";
for(var b=0;b<24;b++){
  run(500);
  var st=rw("g_cal_hold_state");
  trace+="["+rw("g_w5_ladder_active_rung")+"/"+rw("g_w5_ladder_rung_phase")+"]";
  if(st==4||st==5)break;
}
var st=rw("g_cal_hold_state"),rs=rw("g_cal_hold_stop_reason");
print("fire_end state="+st+" reason="+rs+" trace="+trace);
check("W5REAL_WALK_COMPLETE",st==4&&rs==1);
check("W5REAL_ABORT_ZERO",rw("g_w5_ladder_abort_reason")==0);
var allPass=true;
for(var i=0;i<5;i++){if(rw("g_w5_ladder_rung_accept_pass["+i+"]")!=1)allPass=false;
  print("rung"+i+" min="+rw("g_w5_ladder_rung_min_raw["+i+"]")+" max="+rw("g_w5_ladder_rung_max_raw["+i+"]")+" accept="+rw("g_w5_ladder_rung_accept_pass["+i+"]"));}
check("W5REAL_ALL_RUNGS_ACCEPTED",allPass);
var sum=0;
for(var i=0;i<5;i++)sum=(sum+rw("g_w5_ladder_rung_min_raw["+i+"]")+
    rw("g_w5_ladder_rung_max_raw["+i+"]")+rw("g_w5_ladder_rung_accept_pass["+i+"]"))>>>0;
sum=(sum+rw("g_w5_ladder_abort_reason")+rw("g_w5_ladder_abort_rung"))>>>0;
var expCookie=(0x57350000^sum)>>>0;
check("W5REAL_TERMINAL_COOKIE",rv32u("g_w5_ladder_terminal_cookie")===expCookie,
      "cookie=0x"+rv32u("g_w5_ladder_terminal_cookie").toString(16));
check("W5REAL_ALGORITHM_ID",rv32u("g_w5_ladder_algorithm_id")===0x0018);
check("W5REAL_LOAD_PROFILE_ID",rv32u("g_w5_ladder_load_profile_id")===0x0F0F);
check("W5REAL_FINAL_PWM_SAFE",rw("g_cal_hold_final_pwm")==0);
print("FAILURES="+failures);
if(failures)throw "w5-real-fire-failed";
print("SOL_W5_REAL_LADDER_PASS=TRUE");