// stage6_burst_boundary_noenergy.js
// STAGE6_CR20_BURST_THRESHOLD_CONFLICT_CLOSURE_V1 - NOENERGY boundary unit tests.
// Uses the freshly built Stage6_FLASH_SHOT_NOENERGY binary. No real power,
// PWM stays 0, OST stays latched. Verifies:
//   PERIOD_400/399/353/352 -> continuous (no Burst)
//   ONE_352_SAT -> continuous (1st fmax-saturated fresh compute)
//   THREE_352_SAT + voltage -> Burst
//   UNCLAMPED_352_BURST (true >170 kHz request) -> Burst immediately
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT = "D:\\CCS21_workspace\\Codex_Project\\Stage6_FLASH_SHOT_NOENERGY\\LLC_100W_F28034_BRINGUP_DSH.out";
var EXPECTED_SHA = "0C501B0A6C14DA08A1292A6A74D6470BA5ECA3F619FD3F861600DB1E8204E6D1";
function sha256File(path){
  var md=MessageDigest.getInstance("SHA-256"); var fis=new FileInputStream(path);
  var buf=java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE,8192); var n;
  while((n=fis.read(buf))>0){ md.update(buf,0,n); } fis.close();
  var d=md.digest(); var sb=new StringBuilder();
  for(var i=0;i<d.length;i++){ var hex=(d[i]&0xFF).toString(16); if(hex.length<2)hex="0"+hex; sb.append(hex.toUpperCase()); }
  return sb.toString();
}
var perm=(java.lang.System.getenv("DSH_CNT34_PERMANENT_CONNECTED_CONFIRMED")||"").equals("1");
var op=(java.lang.System.getenv("DSH_OPERATOR_PRESENT_CONFIRMED")||"").equals("1");
var auth=(java.lang.System.getenv("DSH_NO_SWITCHING_TIMING_AUTHORIZED")||"").equals("1");
if(!perm || !op || !auth){ print("ABORT: no-switching timing gates not all 1."); throw "noauth"; }
var actualSha=sha256File(OUT);
if(!actualSha.equals(EXPECTED_SHA)){ print("ABORT: SHA mismatch "+actualSha); throw "sha"; }
var env=ScriptingEnvironment.instance(); var server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();
function addr(n){var v=session.expression.evaluate("&"+n);var s=""+v;if(s.indexOf("0x")===0||s.indexOf("0X")===0)return parseInt(s,16);return parseInt(s,10);}
function rw(n){try{return session.memory.readWord(1,addr(n));}catch(e){return -1;}}
function r16(n){var v=rw(n); return (v>=32768)?v-65536:v;}
function rv32(n){try{var a=addr(n);return(session.memory.readWord(1,a)|(session.memory.readWord(1,a+1)<<16))>>>0;}catch(e){return -1;}}
function wv(n,v){session.memory.writeWord(1,addr(n),v);}
function wv32(n,v){var a=addr(n);session.memory.writeWord(1,a,v&0xFFFF);session.memory.writeWord(1,a+1,(v>>>16)&0xFFFF);}
function reg(e){try{return ""+session.expression.evaluate(e);}catch(err){return "<f>";}}
function rt(e){var v=session.expression.evaluate(e);var s=""+v;if(s.indexOf("0x")===0||s.indexOf("0X")===0)return parseInt(s,16);return parseInt(s,10);}
function run(ms){session.target.runAsynch();java.lang.Thread.sleep(ms);session.target.halt();}
try{session.target.connect();}catch(e){}

var cases = [
  {name:"PERIOD_400", period:400, cmd:149500, uncl:149500, fsat:0, err:-1, expectBurst:false, expectPw:1},
  {name:"PERIOD_399", period:399, cmd:150000, uncl:150000, fsat:0, err:-1, expectBurst:false, expectPw:1},
  {name:"UNDER_400_OVER_V", period:399, cmd:150000, uncl:150500, fsat:0, err:-1, expectBurst:false, expectPw:1},
  {name:"PERIOD_353", period:353, cmd:169500, uncl:169500, fsat:0, err:-1, expectBurst:false, expectPw:1},
  {name:"PERIOD_352", period:352, cmd:170000, uncl:170000, fsat:0, err:-1, expectBurst:false, expectPw:1},
  {name:"ONE_352_SAT", period:352, cmd:170000, uncl:170000, fsat:1, err:-1, expectBurst:false, expectPw:1},
  {name:"THREE_352_SAT", period:352, cmd:170000, uncl:170000, fsat:3, err:-1, expectBurst:true, expectPw:0},
  {name:"UNCLAMPED_352_BURST", period:352, cmd:170000, uncl:170500, fsat:1, err:-1, expectBurst:true, expectPw:0}
];

for(var ci=0; ci<cases.length; ci++){
  var c=cases[ci];
  print("=== BOUNDARY "+c.name+" ===");
  session.memory.loadProgram(OUT);
  run(100);
  session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFA = 1");
  session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFB = 1");
  wv("g_system_state",3); wv("g_pwm_enabled",0); wv("g_bringup_stage",7);
  wv("g_control_reference_valid",1); wv32("g_voltage_reference",0x41200000);
  wv("g_first_real_pi_shot_arm",1); wv("g_softstart_handoff_result",1);
  wv("g_board_vout_cal_valid",1); wv("g_comp_tz_loopback_verified",1);
  wv32("g_power_run_min_frequency_hz",150000);
  wv("g_first_real_pi_shot_state",2); wv("g_first_real_pi_shot_ok",0);
  wv32("g_first_real_pi_shot_first_write_timer2", rt("CpuTimer2Regs.TIM.all"));
  wv("g_burst_active",0); wv32("g_burst_enter_count",0);
  wv32("g_control_fmax_saturate_count",c.fsat); wv32("g_control_unclamped_frequency_hz",c.uncl);
  wv("g_control_error_raw",0xFFFF);
  wv32("g_control_frequency_hz",c.cmd); wv32("g_control_shadow_frequency_hz",c.cmd);
  wv32("g_switching_frequency_hz",c.cmd); wv("g_pwm_period",c.period);
  wv("g_pipeline_phase",1);
  wv("g_pipeline_pending.valid",1); wv("g_pipeline_pending.period",c.period);
  wv32("g_pipeline_pending.command_hz",c.cmd); wv32("g_pipeline_pending.actual_hz",c.cmd);
  wv("g_pipeline_pending.cmpa",(c.period+1)>>1); wv("g_pipeline_pending.cmpb",(c.period+1)>>2);
  wv("g_stage6_noenergy_test_enable",1); wv("g_stage6_noenergy_test_mode",3);
  wv("g_stage6_synthetic_vout_raw",1362); wv("g_stage6_synthetic_sequence",0);
  wv("g_stage6_multifresh_trace_count",0);
  wv32("g_pi_integral_q12",0); wv32("g_fault_flags",0);
  run(10);
  var st=rw("g_first_real_pi_shot_state"); var ab=rw("g_first_real_pi_shot_abort");
  var burst=rv32("g_burst_enter_count"); var pw=rw("g_first_real_pi_shot_power_writes");
  var fsat=rv32("g_control_fmax_saturate_count"); var uncl=rv32("g_control_unclamped_frequency_hz");
  var pv=rw("g_pipeline_pending.valid"); var pwm=rw("g_pwm_enabled");
  var ost=reg("EPwm1Regs.TZFLG.bit.OST"); var fault=rv32("g_fault_flags");
  var err=r16("g_control_error_raw"); var vout=rw("g_control_vout_raw"); var vref=rw("g_control_vref_raw");
  print(c.name+" state="+st+" abort="+ab+" burst="+burst+" pw="+pw+" fmax_sat="+fsat+" uncl="+uncl+" pending="+pv+" pwm="+pwm+" ost="+ost+" fault="+fault);
  print(c.name+"_DEBUG err="+err+" vout="+vout+" vref="+vref);
  var pass = (c.expectBurst ? burst===1 : burst===0) &&
             pw===c.expectPw &&
             (c.fmaxMin===undefined || fsat>=c.fmaxMin) &&
             pwm===0 && fault===0 && ost==="1";
  print("BOUNDARY_"+c.name+"_PASS="+(pass?"PASS":"FAIL"));
  if(!pass){ print("ABORT: boundary case "+c.name); throw "boundary-fail-"+c.name; }
}
print("STAGE6_CR20_BURST_BOUNDARY_NOENERGY_ALL_PASS");
try{ session.terminate(); }catch(e){}
