// stage6_onchip_timing_freeze_nopower_ladder_all.js
// STAGE6_CR15_TIMING_RECOVERY_AND_CONTINUOUS_PFM_LADDER_V1 - CR15 one-shot no-power ladder.
// Runs REAL_CR15_2MS, REAL_CR15_10MS, REAL_CR15_100MS in order. Each must PASS before the
// next is attempted. No retry on a gate failure.
//
// Expected SHA values are read from evidence/stage6_first_real_pi_shot_real/
// REAL_CR15_LADDER_SHA256SUMS.txt (REAL_CR15_2MS_OUT_SHA256=..., etc.). If the file is
// absent the SHA hard gate is skipped (useful during bring-up), but the final
// delivery must include the manifest.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var BASE = "D:\\CCS21_workspace\\Codex_Project\\evidence\\stage6_first_real_pi_shot_real";
var MANIFEST = BASE + "\\REAL_CR15_LADDER_SHA256SUMS.txt";
var CONFIGS = [
  { label:"2MS",  out:BASE+"\\LLC_100W_F28034_BRINGUP_DSH_REAL_CR15_2MS.out",  waitMs:10,  shaKey:"REAL_CR15_2MS_OUT_SHA256" },
  { label:"10MS", out:BASE+"\\LLC_100W_F28034_BRINGUP_DSH_REAL_CR15_10MS.out", waitMs:25,  shaKey:"REAL_CR15_10MS_OUT_SHA256" },
  { label:"100MS",out:BASE+"\\LLC_100W_F28034_BRINGUP_DSH_REAL_CR15_100MS.out",waitMs:130, shaKey:"REAL_CR15_100MS_OUT_SHA256" }
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

var perm=(java.lang.System.getenv("DSH_CNT34_PERMANENT_CONNECTED_CONFIRMED")||"").equals("1");
var op=(java.lang.System.getenv("DSH_OPERATOR_PRESENT_CONFIRMED")||"").equals("1");
var auth=(java.lang.System.getenv("DSH_NO_SWITCHING_TIMING_AUTHORIZED")||"").equals("1");
print("CNT34 permanent connected: "+perm+" operator present: "+op+" no-switching auth: "+auth);
if(!perm || !op || !auth){ print("ABORT: connected no-switching timing gates not all 1."); throw "no-timing-auth"; }

var env=ScriptingEnvironment.instance(); var server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();
function addr(n){
  var v=session.expression.evaluate("&"+n); var s=""+v;
  if(s.indexOf("0x")===0||s.indexOf("0X")===0) return parseInt(s,16);
  return parseInt(s,10);
}
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
var manifest=readManifest();

for(var i=0;i<CONFIGS.length;i++){
  var cfg=CONFIGS[i];
  print("=== LADDER STEP "+(i+1)+": "+cfg.label+" ===");
  var actual=sha256File(cfg.out);
  var expected=manifest[cfg.shaKey] || "";
  print("REAL OUT host SHA256: "+actual);
  print("Expected SHA       : "+expected);
  if(expected.length()>0 && !actual.equals(expected)){
    print("ABORT: SHA mismatch for "+cfg.label);
    throw "sha-mismatch-"+cfg.label;
  }
  print("TIMING_HOST_SHA256_HARD_GATE_PASS");

  session.memory.loadProgram(cfg.out);
  run(300);

  var fault=rv32("g_fault_flags");
  var ost=reg("EPwm1Regs.TZFLG.bit.OST");
  var pwm=rw("g_pwm_enabled");
  gate("FAULT_ZERO", fault===0);
  gate("OST_LATCHED", ost==="1");
  gate("PWM_OFF", pwm===0);

  session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFA = 1");
  session.expression.evaluate("EPwm1Regs.AQCSFRC.bit.CSFB = 1");
  var cfa=reg("EPwm1Regs.AQCSFRC.bit.CSFA");
  var cfb=reg("EPwm1Regs.AQCSFRC.bit.CSFB");
  gate("AQCSFRC_FORCE_LOW", cfa==="1" && cfb==="1");

  wv("g_system_state",3); wv("g_pwm_enabled",1); wv("g_bringup_stage",7);
  wv("g_control_reference_valid",1); wv32("g_voltage_reference",0x41200000);
  wv("g_first_real_pi_shot_arm",1); wv("g_softstart_handoff_result",1);
  wv("g_board_vout_cal_valid",1); wv("g_comp_tz_loopback_verified",1);
  wv32("g_power_run_min_frequency_hz",145000);
  wv32("g_control_adc_sequence_last",0); wv32("g_adc_sample_sequence",1);
  wv("g_adc_pwm_sync_consecutive_miss",0);
  wv("g_adc_vout_raw",1200); wv("g_adc_vout_filtered_raw",1200);
  wv("g_control_vref_raw",1244);
  wv32("g_control_frequency_hz",149900); wv32("g_control_shadow_frequency_hz",149900);
  wv32("g_switching_frequency_hz",149900); wv("g_pwm_period",399);
  wv("g_power_window_state",1); wv("g_no_energy_test_mode",1);

  wv("g_timing_request",1);
  print("Running no-power timing window for "+cfg.label+", waitMs="+cfg.waitMs);
  session.target.runAsynch();
  java.lang.Thread.sleep(cfg.waitMs);
  session.target.halt();

  var tf=rw("g_timing_frozen"); var ta=rw("g_timing_active"); var treq=rw("g_timing_request");
  var epoch=rv32("g_timing_epoch"); var sc=rv32("g_timing_sample_count");
  var cmax=rv32("g_timing_compute_max"); var amax=rv32("g_timing_apply_max");
  var amax2=rv32("g_timing_active_isr_max"); var smax=rv32("g_timing_shutdown_max");
  var cnorm=rv32("g_timing_compute_normal_max"); var cfmax=rv32("g_timing_compute_fmax_max");
  var cabort=rv32("g_timing_compute_abort_max");
  var tov=rv32("g_timing_overrun_count");
  var oldov=rv32("g_real_isr_overrun_count");
  var pv=rw("g_pipeline_pending.valid");
  var st=rw("g_first_real_pi_shot_state"); var ab=rw("g_first_real_pi_shot_abort");
  var okf=rw("g_first_real_pi_shot_ok");
  var pwm2=rw("g_pwm_enabled"); var ost2=reg("EPwm1Regs.TZFLG.bit.OST"); var pws2=rw("g_power_window_state");
  var fault2=rv32("g_fault_flags");
  print("timing_frozen="+tf+" active="+ta+" request="+treq+" epoch="+epoch+" samples="+sc);
  print("compute_normal_max="+cnorm+" compute_fmax_max="+cfmax+" compute_abort_max="+cabort);
  print("compute_max="+cmax+" apply_max="+amax+" active_isr_max="+amax2+" shutdown_max="+smax+" overrun="+tov);
  print("old_overrun="+oldov+" pending="+pv+" state="+st+" abort="+ab+" ok="+okf);
  print("pwm="+pwm2+" ost="+ost2+" pws="+pws2+" fault="+fault2);

  var pass = (tf===1 && ta===0 && treq===0 && sc>0 &&
              cmax<=900 && amax<=900 && amax2<=900 && smax<1200 && tov===0 && cnorm<=850 && cfmax<=900 && cabort<1200 &&
              oldov===0 && pv===0 && st===3 && ab===1 && okf===1 &&
              pwm2===0 && ost2==="1" && pws2===2 && fault2===0);
  print("TIMING_"+cfg.label+"_PASS="+(pass?"PASS":"FAIL"));
  if(!pass){ print("TIMING_"+cfg.label+"_RESULT_FAIL"); throw "timing-fail-"+cfg.label; }
  print("TIMING_"+cfg.label+"_DONE");
}

print("STAGE6_ONCHIP_TIMING_FREEZE_PASS");
print("STAGE6_ONCHIP_TIMING_FREEZE_NOPOWER_LADDER_ALL_PASS");
