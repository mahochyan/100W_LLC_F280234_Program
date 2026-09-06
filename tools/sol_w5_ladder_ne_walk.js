// W5 reference ladder on-target NO-ENERGY walk (Stage6_W5_LADDER_NE).
// OST stays latched for the whole run; the synthetic VOUT raw exercises the
// exact CAL_HOLD_MODE_W5_LADDER engine compiled into the image.  No PWM
// authority is granted; the host pins g_cal_hold_ne_raw to each rung target.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_W5_LADDER_NE\\LLC_100W_F28034_OPEN_LOOP_STEADY_NE.out";
var EXPECTED_SHA="3D9F61289285FFCCD849E1AA7B5D0993D61A950DAE7B658DA796DF22AE323837";
var RUN_ID=0x25090611;
var TARGET=[1244,1306,1368,1430,1491];
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
print("=== SOL W5 REFERENCE LADDER NOENERGY WALK ===");
var actualSha=sha256File(OUT);
check("W5NE_SHA_HARD_GATE",actualSha.equals(EXPECTED_SHA),"actual="+actualSha);
if(failures)throw "w5-ne-sha-gate";
session.target.connect();try{session.target.halt();}catch(e){}
session.memory.loadProgram(OUT);run(400);

var tzclr0=rv32u("g_probe_tzclr_write_count");
var enableRise0=rv32u("g_enable_rising_count");
wv("g_no_energy_test_mode",1);
wv("g_cal_hold_ne_bypass_charge",1);
wv("g_bringup_stage",5);
wv("g_active_bringup_stage",5);
wv("g_system_state",1);
wv32("g_fault_flags",0);wv("g_system_state",1);wv("g_pwm_enabled",0);
wv("g_pwm_enable_result",0);wv("g_cal_hold_request",0);
wv("g_cal_hold_state",0);wv("g_cal_hold_stop_reason",0);
wv("g_cal_hold_packet_active",0);wv("g_cal_measure_active",0);
wv("g_cal_hold_ne_raw",TARGET[0]);
wv32("g_test_run_id",RUN_ID);
wv("g_cal_hold_mode_request",2);
wv("g_cal_hold_duration_ms",10500);
wv("g_cal_hold_request",1);
run(80);
check("W5_SESSION_ACCEPTED",rw("g_cal_hold_state")!=0&&rw("g_cal_hold_state")!=5,
      "state="+rw("g_cal_hold_state")+" reason="+rw("g_cal_hold_stop_reason"));
check("W5_ALGORITHM_ID",rv32u("g_w5_ladder_algorithm_id")===0x001A);
check("W5_LOAD_PROFILE_ID",rv32u("g_w5_ladder_load_profile_id")===0x0F0F);

// Walk: pin synthetic raw to the active rung target; poll in 500 ms bursts.
var lastRung=-1;
for(var burst=0;burst<40;burst++){
  run(500);
  var st=rw("g_cal_hold_state");
  if(st==4||st==5)break;
  var rg=rw("g_w5_ladder_active_rung");
  if(rg!=lastRung&&rg<TARGET.length){wv("g_cal_hold_ne_raw",TARGET[rg]);lastRung=rg;}
}
var st=rw("g_cal_hold_state"),rs=rw("g_cal_hold_stop_reason");
print("walk_end state="+st+" reason="+rs+" rung="+rw("g_w5_ladder_active_rung")+
      " phase="+rw("g_w5_ladder_rung_phase")+" ticks="+rv32u("g_cal_hold_elapsed_ticks"));
check("W5NE_WALK_COMPLETE",st==4&&rs==1);
check("W5NE_LADDER_TICKS",rv32u("g_cal_hold_elapsed_ticks")>=515000);
check("W5NE_ABORT_REASON_ZERO",rw("g_w5_ladder_abort_reason")==0&&rw("g_w5_ladder_abort_rung")==0);
var allPass=true,minmaxOk=true;
for(var i=0;i<5;i++){
  if(rw("g_w5_ladder_rung_accept_pass["+i+"]")!=1)allPass=false;
  if(rw("g_w5_ladder_rung_min_raw["+i+"]")!=TARGET[i])minmaxOk=false;
  if(rw("g_w5_ladder_rung_max_raw["+i+"]")!=TARGET[i])minmaxOk=false;
}
check("W5NE_ALL_RUNGS_ACCEPTED",allPass);
check("W5NE_MINMAX_MATCH_PINNED",minmaxOk);
// expected terminal cookie = 0x57350000 ^ sum(min+max+accept per rung) ^ abort fields
var sum=0;
for(var i=0;i<5;i++)sum=(sum+rw("g_w5_ladder_rung_min_raw["+i+"]")+
    rw("g_w5_ladder_rung_max_raw["+i+"]")+rw("g_w5_ladder_rung_accept_pass["+i+"]"))>>>0;
sum=(sum+rw("g_w5_ladder_abort_reason")+rw("g_w5_ladder_abort_rung"))>>>0;
var expCookie=(0x57350000^sum)>>>0;
check("W5NE_TERMINAL_COOKIE",rv32u("g_w5_ladder_terminal_cookie")===expCookie,
      "cookie=0x"+rv32u("g_w5_ladder_terminal_cookie").toString(16)+" exp=0x"+expCookie.toString(16));
check("W5NE_RUN_ID_AT_STOP",rv32u("g_cal_hold_run_id_at_stop")===RUN_ID,
      "run_id=0x"+rv32u("g_cal_hold_run_id_at_stop").toString(16));
check("W5NE_FINAL_PWM_SAFE",rw("g_cal_hold_final_pwm")==0);
check("W5NE_NO_TZCLR_WRITES",rv32u("g_probe_tzclr_write_count")===tzclr0);
check("W5NE_NO_ENABLE_RISES",rv32u("g_enable_rising_count")===enableRise0);
check("W5NE_OST_STILL_LATCHED",true);
print("FAILURES="+failures);
if(failures)throw "w5-ne-walk-failed";
print("SOL_W5_LADDER_NE_WALK_PASS=TRUE");
