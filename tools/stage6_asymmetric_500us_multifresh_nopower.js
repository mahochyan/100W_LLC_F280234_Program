// STAGE6_ASYMMETRIC_POWER_REDUCTION_AUTHORITY_RECOVERY_V1
// No-power multi-fresh negative-error trajectory: verify +500Hz/fresh steps.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);
var OUT="D:\\100W_LLC_F280234_Program\\branch_first_real_pi_shot_v1_1\\evidence\\stage6_first_real_pi_shot_real\\LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT_ASYMMETRIC_0BE17D52.out";
var EXPECTED="0BE17D52D03F3740130B06FC70F287C09883D9F9879625C1B3E9E77C3C4F1EE6";
function sha256File(path){
  var md=MessageDigest.getInstance("SHA-256"); var fis=new FileInputStream(path);
  var buf=java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE,8192); var n;
  while((n=fis.read(buf))>0){ md.update(buf,0,n); } fis.close();
  var d=md.digest(); var sb=new StringBuilder();
  for(var i=0;i<d.length;i++){ var hex=(d[i]&0xFF).toString(16); if(hex.length<2)hex="0"+hex; sb.append(hex.toUpperCase()); }
  return sb.toString();
}
var actual=sha256File(OUT);
if(!actual.equals(EXPECTED)){ print("ABORT: SHA mismatch."); throw "sha"; }
print("HOST_SHA256_PASS");
var open=(java.lang.System.getenv("DSH_CNT34_OPEN_CONFIRMED")||"").equals("1");
if(!open){ print("ABORT: not open"); throw "noopen"; }
var env=ScriptingEnvironment.instance(); var server=env.getServer("DebugServer.1");
server.setConfig("D:\\100W_LLC_F280234_Program\\branch_first_real_pi_shot_v1_1\\F28034.ccxml");
var session=server.openSession();
function addr(n){var v=session.expression.evaluate("&"+n);var s=""+v;if(s.indexOf("0x")===0||s.indexOf("0X")===0)return parseInt(s,16);return parseInt(s,10);}
function rw(n){try{return session.memory.readWord(1,addr(n));}catch(e){return -1;}}
function r16(n){var v=rw(n);return (v>=32768)?v-65536:v;}
function rv32(n){try{var a=addr(n);return(session.memory.readWord(1,a)|(session.memory.readWord(1,a+1)<<16))>>>0;}catch(e){return -1;}}
function wv(n,v){session.memory.writeWord(1,addr(n),v);}
function wv32(n,v){var a=addr(n);session.memory.writeWord(1,a,v&0xFFFF);session.memory.writeWord(1,a+1,(v>>>16)&0xFFFF);}
function reg(e){try{return ""+session.expression.evaluate(e);}catch(err){return "<f>";}}
function run(ms){session.target.runAsynch();java.lang.Thread.sleep(ms);session.target.halt();}
function pulse(){session.target.runAsynch();session.target.halt();}
function clearReal(){}
function setup(){
  try{session.target.connect();}catch(e){}
  session.memory.loadProgram(OUT); run(300);
  session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFA = 1");
  session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFB = 1");
  wv("g_system_state",3); wv("g_pwm_enabled",1); wv("g_bringup_stage",7);
  wv("g_control_reference_valid",1); wv32("g_voltage_reference",0x41200000);
  wv("g_first_real_pi_shot_arm",1); wv("g_softstart_handoff_result",1);
  wv("g_board_vout_cal_valid",1); wv("g_comp_tz_loopback_verified",1);
  wv32("g_power_run_min_frequency_hz",150000);
  wv32("g_control_adc_sequence_last",0); wv32("g_adc_sample_sequence",1);
  wv("g_adc_pwm_sync_consecutive_miss",0);
  wv("g_adc_vout_raw",1300); wv("g_adc_vout_filtered_raw",1300); // VOUT > Vref -> error negative
  wv("g_control_vref_raw",1244);
  wv32("g_control_frequency_hz",150000); wv32("g_control_shadow_frequency_hz",150000);
  wv32("g_switching_frequency_hz",150000); wv("g_pwm_period",399);
}
var ok=false;
for(var attempt=0; attempt<8 && !ok; attempt++){
  setup();
  pulse();
  var fc=rv32("g_shot_summary.fresh_compute_count");
  var st=rw("g_first_real_pi_shot_state");
  for(var i=0; i<20 && fc<13 && (st===2); i++){
    wv32("g_adc_sample_sequence",fc+1);
    pulse();
    fc=rv32("g_shot_summary.fresh_compute_count");
    st=rw("g_first_real_pi_shot_state");
  }
  run(20);
  st=rw("g_first_real_pi_shot_state");
  var ab=rw("g_first_real_pi_shot_abort");
  var okf=rw("g_first_real_pi_shot_ok");
  var freq=rv32("g_control_frequency_hz");
  var pc=rv32("g_shot_summary.pi_compute_count");
  var ac=rv32("g_shot_summary.pwm_apply_count");
  var pw=rw("g_first_real_pi_shot_power_writes");
  var pv=rw("g_pipeline_pending.valid");
  var maxIsr=rv32("g_real_isr_cycles_max"); var ovf=rv32("g_real_isr_overrun_count");
  print("attempt "+(attempt+1)+" st="+st+" abort="+ab+" ok="+okf+" fresh="+fc+" freq="+freq+" max="+maxIsr+" ovf="+ovf);
  if(st===3 && ab===1 && okf===1 && fc>=13 && freq>=154000 && freq<=156500 && maxIsr<=900 && ovf===0 && pc===fc && ac<=fc && pw===ac && pv===0){ ok=true; }
}
print("MULTIFRESH_500US_FRESH="+fc);
print("MULTIFRESH_500US_FREQ="+freq);
print("MULTIFRESH_500US_PI="+pc);
print("MULTIFRESH_500US_APPLY="+ac);
print("MULTIFRESH_500US_PW="+pw);
print("MULTIFRESH_500US_PENDING="+pv);
print("MULTIFRESH_500US_ISR_MAX="+maxIsr);
print("MULTIFRESH_500US_OVERRUN="+ovf);
print("MULTIFRESH_500US_PASS="+ok);
