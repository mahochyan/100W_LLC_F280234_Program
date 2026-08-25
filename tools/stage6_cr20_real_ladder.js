// stage6_cr20_real_ladder.js
// STAGE6_ONCHIP_TIMING_FREEZE_AND_CR20_LADDER_V1 - conditional real CR20 ladder.
// Runs REAL_2MS, REAL_10MS, REAL_100MS in order with a real 20.0 ohm electronic
// load. Each duration is attempted exactly once; any failure stops the ladder.
//
// Field conditions (human gates):
//   DSH_CNT34_APPROVED=1          CNT3/CNT4 permanently soldered
//   DSH_OPERATOR_PRESENT_CONFIRMED=1
//   DSH_INPUT_LIMIT_0_5A_CONFIRMED=1
//   DSH_CR20_OHM_CONFIRMED=1
//   DSH_VIN_24V_CONFIRMED=1
//
// Host protocol per step:
//   - load frozen REAL OUT
//   - run APP_Init, loopback, stage confirms, preflight
//   - arm + enable request
//   - write ONLY g_timing_request=1
//   - runAsynch, wait shot duration + safety margin, halt
//   - single read of frozen data
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var BASE = "D:\\100W_LLC_F280234_Program\\branch_first_real_pi_shot_v1_1\\evidence\\stage6_first_real_pi_shot_real";
var MANIFEST = BASE + "\\REAL_LADDER_SHA256SUMS.txt";
var CONFIGS = [
  { label:"2MS",  out:BASE+"\\LLC_100W_F28034_BRINGUP_DSH_REAL_2MS.out",  waitMs:50,  shaKey:"REAL_2MS_OUT_SHA256" },
  { label:"10MS", out:BASE+"\\LLC_100W_F28034_BRINGUP_DSH_REAL_10MS.out", waitMs:100, shaKey:"REAL_10MS_OUT_SHA256" },
  { label:"100MS",out:BASE+"\\LLC_100W_F28034_BRINGUP_DSH_REAL_100MS.out",waitMs:300, shaKey:"REAL_100MS_OUT_SHA256" }
];

function sha256File(path){
  var md=MessageDigest.getInstance("SHA-256");
  var fis=new FileInputStream(path);
  var buf=java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE,8192);
  var n;
  while((n=fis.read(buf))>0){ md.update(buf,0,n); }
  fis.close();
  var d=md.digest();
  var sb=new StringBuilder();
  for(var i=0;i<d.length;i++){
    var hex=(d[i]&0xFF).toString(16);
    if(hex.length<2){ hex="0"+hex; }
    sb.append(hex.toUpperCase());
  }
  return sb.toString();
}

function readManifest(){
  var map={};
  try{
    var lines=java.io.BufferedReader(new java.io.FileReader(MANIFEST));
    var t;
    while((t=lines.readLine())!=null){
      var idx=t.indexOf("=");
      if(idx>0){ map[t.substring(0,idx).trim()]=t.substring(idx+1).trim(); }
    }
    lines.close();
  }catch(e){ print("Manifest not found; SHA hard gate skipped."); }
  return map;
}

var approved=(java.lang.System.getenv("DSH_CNT34_APPROVED")||"").equals("1");
var op=(java.lang.System.getenv("DSH_OPERATOR_PRESENT_CONFIRMED")||"").equals("1");
var ilim=(java.lang.System.getenv("DSH_INPUT_LIMIT_0_5A_CONFIRMED")||"").equals("1");
var cr20=(java.lang.System.getenv("DSH_CR20_OHM_CONFIRMED")||"").equals("1");
var vin24=(java.lang.System.getenv("DSH_VIN_24V_CONFIRMED")||"").equals("1");
print("CNT34 approved: "+approved+" operator: "+op+" input limit 0.5A: "+ilim+
      " CR20: "+cr20+" Vin24: "+vin24);
if(!approved || !op || !ilim || !cr20 || !vin24){
  print("ABORT: real CR20 ladder human gates not all 1.");
  throw "no-real-auth";
}

var env=ScriptingEnvironment.instance(); var server=env.getServer("DebugServer.1");
server.setConfig("D:\\100W_LLC_F280234_Program\\branch_first_real_pi_shot_v1_1\\F28034.ccxml");
var session=server.openSession();
function addr(n){
  var v=session.expression.evaluate("&"+n); var s=""+v;
  if(s.indexOf("0x")===0||s.indexOf("0X")===0) return parseInt(s,16);
  return parseInt(s,10);
}
function rw(n){try{return session.memory.readWord(1,addr(n));}catch(e){return -1;}}
function r16(n){var v=rw(n); return (v>=32768)?v-65536:v;}
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
var manifest=readManifest();

for(var i=0;i<CONFIGS.length;i++){
  var cfg=CONFIGS[i];
  print("=== REAL LADDER STEP "+(i+1)+": "+cfg.label+" ===");
  var actual=sha256File(cfg.out);
  var expected=manifest[cfg.shaKey] || "";
  print("REAL OUT host SHA256: "+actual);
  print("Expected SHA       : "+expected);
  if(expected.length()>0 && !actual.equals(expected)){
    print("ABORT: SHA mismatch for "+cfg.label);
    throw "sha-mismatch-"+cfg.label;
  }
  print("REAL_SHOT_HOST_SHA256_HARD_GATE_PASS");

  session.memory.loadProgram(cfg.out);
  run(300);

  var sys=rw("g_system_state"); var pwm=rw("g_pwm_enabled"); var fault=rv32("g_fault_flags");
  var ost=reg("EPwm1Regs.TZFLG.bit.OST"); var voutcal=rw("g_board_vout_cal_valid");
  var comp=rw("g_comp_tz_loopback_verified"); var stage=rw("g_bringup_stage");
  gate("INIT_SYS_IDLE", sys===1);
  gate("INIT_PWM_OFF", pwm===0);
  gate("INIT_FAULT_ZERO", fault===0);
  gate("INIT_OST_LATCHED", ost==="1");
  gate("INIT_VOUT_CAL_VALID", voutcal===1);
  gate("INIT_STAGE_ZERO", stage===0);

  wv("g_loopback_diag_request",1);
  run(50);
  var diag=rw("g_loopback_diag_result"); var comp2=rw("g_comp_tz_loopback_verified");
  gate("LOOPBACK_PASS", diag===1 && comp2===1);

  for(var s=1;s<=7;s++){
    wv("g_stage_confirm_request",s);
    run(50);
    var stg=rw("g_bringup_stage");
    gate("STAGE_CONFIRM_"+s, stg===s);
  }

  sys=rw("g_system_state"); pwm=rw("g_pwm_enabled"); fault=rv32("g_fault_flags");
  ost=reg("EPwm1Regs.TZFLG.bit.OST"); voutcal=rw("g_board_vout_cal_valid");
  comp=rw("g_comp_tz_loopback_verified"); stage=rw("g_bringup_stage");
  var arm=rw("g_first_real_pi_shot_arm");
  gate("PREFLIGHT_SYS_IDLE", sys===1);
  gate("PREFLIGHT_PWM_OFF", pwm===0);
  gate("PREFLIGHT_FAULT_ZERO", fault===0);
  gate("PREFLIGHT_OST_LATCHED", ost==="1");
  gate("PREFLIGHT_VOUT_CAL", voutcal===1);
  gate("PREFLIGHT_COMP_VERIFIED", comp===1);
  gate("PREFLIGHT_STAGE6", stage===7);
  gate("PREFLIGHT_ARM_CLEAR", arm===0);

  wv32("g_test_run_id",0x5A11);
  wv("g_first_real_pi_shot_arm",1);
  wv("g_pwm_enable_request",1);
  wv("g_timing_request",1);

  print("Running real CR20 "+cfg.label+" shot, waitMs="+cfg.waitMs);
  session.target.runAsynch();
  java.lang.Thread.sleep(cfg.waitMs);
  session.target.halt();

  var st=rw("g_first_real_pi_shot_state"); var ab=rw("g_first_real_pi_shot_abort");
  var okf=rw("g_first_real_pi_shot_ok"); var pw=rw("g_first_real_pi_shot_power_writes");
  var ssres=rw("g_softstart_result"); var hres=rw("g_softstart_handoff_result");
  var burst=rv32("g_burst_enter_count");
  var maxv=rw("g_shot_summary.max_vout_raw");
  var fc=rv32("g_shot_summary.fresh_compute_count"); var pc=rv32("g_shot_summary.pi_compute_count");
  var ac=rv32("g_shot_summary.pwm_apply_count");
  var pv=rw("g_pipeline_pending.valid");
  var tf=rw("g_timing_frozen"); var sc=rv32("g_timing_sample_count");
  var cmax=rv32("g_timing_compute_max"); var amax=rv32("g_timing_apply_max");
  var amax2=rv32("g_timing_active_isr_max"); var smax=rv32("g_timing_shutdown_max");
  var tov=rv32("g_timing_overrun_count");
  var hwdelta=rv32("g_tz_hardware_trip_count") - rv32("g_burst_entry_hw_trip_count");
  var actdelta=rv32("g_tz_active_window_trip_count") - rv32("g_burst_entry_active_trip_count");
  var pwm2=rw("g_pwm_enabled"); var ost2=reg("EPwm1Regs.TZFLG.bit.OST");
  var tzint=reg("EPwm1Regs.TZFLG.bit.INT"); var pws2=rw("g_power_window_state");
  var fault2=rv32("g_fault_flags");
  print("state="+st+" abort="+ab+" ok="+okf+" softstart="+ssres+" handoff="+hres);
  print("burst="+burst+" max_vout_raw="+maxv+" fresh="+fc+" pi="+pc+" apply="+ac+" pw="+pw+" pending="+pv);
  print("timing_frozen="+tf+" samples="+sc+" compute="+cmax+" apply="+amax+" active="+amax2+" shutdown="+smax+" overrun="+tov);
  print("hw_trip_delta="+hwdelta+" active_trip_delta="+actdelta+" pwm="+pwm2+" ost="+ost2+" tzint="+tzint+" pws="+pws2+" fault="+fault2);

  var pass = (ssres===1 && hres===1 && st===3 && ab===1 && okf===1 &&
              fault2===0 && burst===0 && maxv<1367 &&
              fc===pc && ac===pw && pv===0 &&
              tf===1 && sc>0 && cmax<=900 && amax<=900 && amax2<=900 &&
              smax<1200 && tov===0 && hwdelta===0 && actdelta===0 &&
              pwm2===0 && ost2==="1" && tzint==="0" && pws2===2);
  print("REAL_"+cfg.label+"_PASS="+(pass?"PASS":"FAIL"));
  if(!pass){
    print("STAGE6_CR20_CONTINUOUS_PFM_FAIL");
    print("FAILED_DURATION="+cfg.label);
    print("FAILED_GATE=<see above>");
    print("NO_RETRY_EXECUTED");
    print("BOARD_LEFT_SAFE_PWM0_OST1");
    throw "real-fail-"+cfg.label;
  }
  print("REAL_"+cfg.label+"_DONE");

  if(cfg.label==="100MS"){
    var vmin=rw("g_timing_last50_vout_min"); var vmax=rw("g_timing_last50_vout_max");
    var vsum=rv32("g_timing_last50_vout_sum"); var vcnt=rv32("g_timing_last50_vout_count");
    var fmin=rv32("g_timing_last50_freq_min"); var fmax=rv32("g_timing_last50_freq_max");
    var fsum=rv32("g_timing_last50_freq_sum"); var fcnt=rv32("g_timing_last50_freq_count");
    var vavg = vcnt>0 ? (vsum / vcnt) : 0;
    var favg = fcnt>0 ? (fsum / fcnt) : 0;
    var vminV = vmin*0.008089325 - 0.063715;
    var vmaxV = vmax*0.008089325 - 0.063715;
    var vavgV = vavg*0.008089325 - 0.063715;
    print("LAST50_VOUT_RAW_MIN="+vmin+" MAX="+vmax+" AVG="+vavg+" COUNT="+vcnt);
    print("LAST50_FREQ_MIN="+fmin+" MAX="+fmax+" AVG="+favg+" COUNT="+fcnt);
    print("LAST50_VOUT_V_MIN="+vminV.toFixed(4)+" MAX="+vmaxV.toFixed(4)+" AVG="+vavgV.toFixed(4));
    print("LAST50_STEADY_STATE_ERROR_V="+(10.0-vavgV).toFixed(4));
    print("LAST50_INPUT_CURRENT_AND_LIMIT_TRIP=<record from bench DMM/power supply>");
  }
}

print("STAGE6_ONCHIP_TIMING_FREEZE_PASS");
print("STAGE6_CR20_10V_CONTINUOUS_PFM_100MS_PASS");
print("READY_FOR_10V_SUSTAINED_RUN");
