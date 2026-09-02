// W2_OPEN_LOOP_STEADY: REAL open-loop steady-state plant characterization
// matrix on the real F28034+LLC board (Vin 24V bench, CR15 15-ohm load,
// CNT3/4 COMP/TZ loopback connected, input current limit 0.5 A).
//
// Binary: Stage6_OL_STEADY\LLC_100W_F28034_OPEN_LOOP_STEADY.out (REAL build,
// STAGE6_OPEN_LOOP_STEADY_BUILD=1, PI fully bypassed, synthetic-free).
//
// HARD GATES (all required, abort before loadProgram otherwise):
//   SHA256 of the REAL .out must equal the frozen manifest value
//   (REAL_OPEN_LOOP_STEADY_SHA256SUMS.txt).
//   DSH_OPEN_LOOP_MATRIX_AUTHORIZED=1
//   DSH_CR15_OHM_CONFIRMED=1
//   DSH_OPERATOR_PRESENT_CONFIRMED=1
//   DSH_VIN_24V_CONFIRMED=1
//   DSH_INPUT_LIMIT_0_5A_CONFIRMED=1
//   DSH_CNT34_PERMANENT_CONNECTED_CONFIRMED=1
//
// Protocol per frequency point (DESCENDING staircase 170k -> 150k):
//   preflight (IDLE/fault0/pwm0/OST1/active0) -> host command + slew 500 Hz ->
//   g_pwm_enable_request=1 -> ~100 ms polls (freq_applied, Vout raw/V, IPRI,
//   phase, steady, stop, fault) -> steady + 2 s dwell -> planned OST
//   (g_pwm_enable_request=0) -> verify PWM0/OST1/TZINT0 -> collect stop
//   snapshot -> CSV append.
//   WARNING auto-stop (upper gain boundary)  -> record boundary, skip lower
//   points (that is a valid experimental outcome, no fault).
//   HARD abort / any fault                   -> abort matrix, NO retry.
//   TIMEOUT backstop                          -> record steady_state_valid=0.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_OL_STEADY\\LLC_100W_F28034_OPEN_LOOP_STEADY.out";
var MANIFEST="D:\\CCS21_workspace\\Codex_Project\\evidence\\sol_master_execution\\w2_open_loop_steady\\REAL_OPEN_LOOP_STEADY_SHA256SUMS.txt";
var CSV="D:\\CCS21_workspace\\Codex_Project\\evidence\\sol_master_execution\\w2_open_loop_steady\\open_loop_matrix_real.csv";
var POINTS=[170000,165000,160000,157500,155000,152500,150000];
var VOUT_GAIN=0.008089325, VOUT_OFF=-0.063715;

// ---------- human gates ----------
var gAuth=(java.lang.System.getenv("DSH_OPEN_LOOP_MATRIX_AUTHORIZED")||"").equals("1");
var gCr15=(java.lang.System.getenv("DSH_CR15_OHM_CONFIRMED")||"").equals("1");
var gOp=(java.lang.System.getenv("DSH_OPERATOR_PRESENT_CONFIRMED")||"").equals("1");
var gVin=(java.lang.System.getenv("DSH_VIN_24V_CONFIRMED")||"").equals("1");
var gIlim=(java.lang.System.getenv("DSH_INPUT_LIMIT_0_5A_CONFIRMED")||"").equals("1");
var gCnt=(java.lang.System.getenv("DSH_CNT34_PERMANENT_CONNECTED_CONFIRMED")||"").equals("1");
print("GATES authorized="+gAuth+" CR15="+gCr15+" operator="+gOp+" vin24="+gVin+" ilim0.5A="+gIlim+" CNT34_connected="+gCnt);
if(!gAuth||!gCr15||!gOp||!gVin||!gIlim||!gCnt){
  print("ABORT: matrix human gates not all set (no real fire).");
  throw "no-matrix-auth";
}

// ---------- SHA hard gate ----------
function sha256File(path){
  var md=MessageDigest.getInstance("SHA-256");
  var fis=new FileInputStream(path);
  var buf=java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE,8192);
  var n; while((n=fis.read(buf))>0){ md.update(buf,0,n); }
  fis.close();
  var dg=md.digest(), sb=new StringBuilder();
  for(var i=0;i<dg.length;i++){ var hx=(dg[i]&0xFF).toString(16); if(hx.length<2){hx="0"+hx;} sb.append(hx.toUpperCase()); }
  return sb.toString();
}
var expected="";
try{
  var br=new BufferedReader(new FileReader(MANIFEST)); var ln;
  while((ln=br.readLine())!=null){ var ix=ln.indexOf("="); if(ix>0 && ln.substring(0,ix).trim().equals("REAL_OPEN_LOOP_STEADY_OUT_SHA256")){ expected=ln.substring(ix+1).trim(); } }
  br.close();
}catch(e){ print("ABORT: SHA manifest missing"); throw "sha-manifest-missing"; }
var actual=sha256File(OUT);
print("REAL OUT SHA256 host = "+actual);
print("SHA manifest expect  = "+expected);
if(!actual.equals(expected)){ print("ABORT: REAL binary SHA mismatch"); throw "sha-mismatch"; }
print("REAL_OPEN_LOOP_STEADY_SHA256_HARD_GATE_PASS");

// ---------- DSS session ----------
var env=ScriptingEnvironment.instance();
var server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();

function addr(n){ var v=session.expression.evaluate("&"+n); var s=""+v;
  if(s.indexOf("0x")===0||s.indexOf("0X")===0) return parseInt(s,16); return parseInt(s,10); }
function rw(n){ try{return session.memory.readWord(1,addr(n));}catch(e){return -1;} }
function rv32u(n){ try{var a=addr(n);return (session.memory.readWord(1,a)|(session.memory.readWord(1,a+1)<<16))>>>0;}catch(e){return -1;} }
function wv(n,v){ session.memory.writeWord(1,addr(n),v); }
function wv32(n,v){ var a=addr(n); session.memory.writeWord(1,a,v&0xFFFF); session.memory.writeWord(1,a+1,(v>>>16)&0xFFFF); }
function reg(e){ return parseInt(session.expression.evaluate(e)); }
function run(ms){ session.target.runAsynch(); java.lang.Thread.sleep(ms); session.target.halt(); }
function gate(name,cond){ print("GATE "+name+": "+(cond?"PASS":"FAIL")); if(!cond){ aborts++; throw "gate-"+name; } }
function voutV(raw){ return raw*VOUT_GAIN+VOUT_OFF; }

var aborts=0, rows=[], hardFail=false, boundaryFreq=-1;

session.target.connect();
try{session.target.halt();}catch(e){}
session.memory.loadProgram(OUT);
run(300);

// ---------- boot gates ----------
gate("INIT_SYS_IDLE", rw("g_system_state")===1);
gate("INIT_PWM_OFF", rw("g_pwm_enabled")===0);
gate("INIT_FAULT_ZERO", rv32u("g_fault_flags")===0);
gate("INIT_OST_LATCHED", reg("EPwm1Regs.TZFLG.bit.OST")===1);
gate("INIT_VOUT_CAL_VALID", rw("g_board_vout_cal_valid")===1);
gate("INIT_STAGE_ZERO", rw("g_bringup_stage")===0);

// ---------- COMP/TZ loopback ----------
wv("g_loopback_diag_request",1); run(50);
gate("LOOPBACK_PASS", rw("g_loopback_diag_result")===1 && rw("g_comp_tz_loopback_verified")===1);

// ---------- stage confirms 1..5 (5 = 5A open-loop manual) ----------
for(var s=1;s<=5;s++){
  wv("g_stage_confirm_request",s); run(50);
  gate("STAGE_CONFIRM_"+s, rw("g_bringup_stage")===s);
  if(s===5){ gate("STAGE5A_COMP_VERIFIED", rw("g_comp_tz_loopback_verified")===1); }
}
gate("PREFLIGHT_SYS_IDLE", rw("g_system_state")===1);
gate("PREFLIGHT_PWM_OFF", rw("g_pwm_enabled")===0);
gate("PREFLIGHT_FAULT_ZERO", rv32u("g_fault_flags")===0);
gate("PREFLIGHT_OST_LATCHED", reg("EPwm1Regs.TZFLG.bit.OST")===1);
gate("PREFLIGHT_STAGE_5A", rw("g_bringup_stage")===5);
gate("PREFLIGHT_OL_IDLE", rw("g_open_loop_steady_active")===0);

// ---------- CSV header ----------
var fw=new BufferedWriter(new FileWriter(CSV,true));
fw.write("Vin_V,Load,Frequency_Hz,TBPRD,Vout_mean_V,Vout_min_V,Vout_max_V,Vout_ripple_V,IPRI_mean_raw,IPRI_max_raw,COMP_event,TZ_event,settling_time_ms,steady_state_valid,stop_reason,upper_gain_boundary,fault_flags");
fw.newLine();

var matrixAborted=false, pointsDone=0, boundaryHit=0;

for(var p=0;p<POINTS.length;p++){
  var target=POINTS[p];
  print("=== MATRIX POINT "+(p+1)+": "+target+" Hz ===");

  // preflight
  var pf_ok = rw("g_system_state")===1 && rv32u("g_fault_flags")===0 && rw("g_pwm_enabled")===0 &&
              reg("EPwm1Regs.TZFLG.bit.OST")===1 && rw("g_open_loop_steady_active")===0;
  print("GATE POINT_"+target+"_PREFLIGHT: "+(pf_ok?"PASS":"FAIL"));
  if(!pf_ok){ matrixAborted=true; hardFail=true; break; }

  // command + enable
  wv32("g_open_loop_frequency_command_hz",target);
  wv32("g_open_loop_freq_slew_hz_per_sample",500);
  wv("g_pwm_enable_request",1);
  run(60);
  var en_ok = rw("g_pwm_enable_result")===1 && rw("g_system_state")===3 && rw("g_open_loop_steady_active")===1;
  print("GATE POINT_"+target+"_ENABLE: "+(en_ok?"PASS":"FAIL"));
  if(!en_ok){ matrixAborted=true; hardFail=true; break; }

  // poll loop (~100 ms prints; up to 8 s + 2 s dwell)
  var steady0=-1, polls=0, stopHit=0;
  var faultHit=0;
  while(polls<80){
    run(100);
    polls++;
    var fa=rv32u("g_open_loop_applied_hz");
    var vr=rw("g_adc_vout_raw"), vf=rw("g_adc_vout_filtered_raw"), ip=rw("g_adc_ipri_raw");
    var ph=rw("g_open_loop_phase"), st=rw("g_open_loop_steady_reached");
    var stk=rv32u("g_open_loop_steady_ticks"), sr=rw("g_open_loop_stop_reason");
    var fl=rv32u("g_fault_flags"), ub=rw("g_open_loop_upper_gain_boundary");
    print("PT"+target+" poll"+polls+" f_applied="+fa+" vout_raw="+vr+" vout_V="+voutV(vf).toFixed(3)+
          " ipri="+ip+" phase="+ph+" steady="+st+" stop="+sr+" fault=0x"+(fl>>>0).toString(16));
    if(sr!==0 || (fl!==0)){ stopHit=sr; faultHit=fl; break; }
    if(st===1 && steady0<0){ steady0=stk; }
    if(steady0>=0 && (stk-steady0)>=100000){ break; }  // 2 s dwell after steady
  }

  // planned OST (also the falling-edge path after an auto-stop)
  wv("g_pwm_enable_request",0);
  run(40);

  // end-state verification
  var pwm0=rw("g_pwm_enabled")===0;
  var ost1=reg("EPwm1Regs.TZFLG.bit.OST")===1;
  var tz0=reg("EPwm1Regs.TZFLG.bit.INT")===0;
  var inact=rw("g_open_loop_steady_active")===0;
  print("PT"+target+" END pwm0="+pwm0+" ost1="+ost1+" tzint0="+tz0+" inactive="+inact+
        " stop_reason="+rw("g_open_loop_stop_reason")+" fault=0x"+(rv32u("g_fault_flags")>>>0).toString(16));
  if(!(pwm0&&ost1&&tz0&&inact)){ matrixAborted=true; hardFail=true; break; }

  // stop snapshot
  var reason=rw("g_open_loop_stop_reason");
  var ub2=rw("g_open_loop_upper_gain_boundary");
  var snap={ freq:target, tbprd:rw("g_open_loop_stop_tbprd"),
    mean:rw("g_open_loop_stop_mean_raw"), min:rw("g_open_loop_stop_min_raw"), max:rw("g_open_loop_stop_max_raw"),
    ipm:rw("g_open_loop_stop_ipri_mean_raw"), ipx:rw("g_open_loop_stop_ipri_max_raw"),
    comp:rv32u("g_open_loop_stop_compsts_high"), tz:rv32u("g_open_loop_stop_tz_events"),
    settle:rw("g_open_loop_settle_ms"), stk:rv32u("g_open_loop_steady_ticks"),
    fa:rv32u("g_open_loop_stop_freq_applied"), cmd:rv32u("g_open_loop_stop_cmd"),
    reason:reason, ub:ub2, fault:rv32u("g_fault_flags"), steady:rw("g_open_loop_steady_reached") };
  var row="24,CR15,"+target+","+snap.tbprd+","+voutV(snap.mean).toFixed(3)+","+voutV(snap.min).toFixed(3)+","+
          voutV(snap.max).toFixed(3)+","+voutV(snap.max-snap.min).toFixed(3)+","+snap.ipm+","+snap.ipx+","+
          snap.comp+","+snap.tz+","+snap.settle+","+(snap.reason===1?(snap.steady===1?1:0):0)+","+snap.reason+","+snap.ub+",0x"+(snap.fault>>>0).toString(16);
  fw.write(row); fw.newLine(); fw.flush();
  pointsDone++;
  print("PT"+target+" SNAPSHOT reason="+snap.reason+" tbprd="+snap.tbprd+" applied="+snap.fa+
        " mean="+snap.mean+" min="+snap.min+" max="+snap.max+" ipri_mean="+snap.ipm+
        " settle_ms="+snap.settle+" steady="+snap.steady+" upper_boundary="+snap.ub);

  if(snap.ub===1){
    print("OPEN_LOOP_UPPER_GAIN_BOUNDARY at freq_applied="+snap.fa+" Hz (planned OST, no fault). Skipping lower frequencies.");
    break;
  }
  if(snap.reason===3 || (snap.fault&0x00020000)!==0 || snap.fault!==0){
    print("ABORT: fault latched at point "+target+" (reason="+snap.reason+", fault=0x"+(snap.fault>>>0).toString(16)+"). NO retry per work order.");
    matrixAborted=true; hardFail=true; break;
  }
  if(faultHit!==0){ matrixAborted=true; hardFail=true; break; }
}

fw.close();
print("POINTS_COMPLETED="+pointsDone);
print("MATRIX_ABORTED="+matrixAborted);
print("SOL_W2_OPEN_LOOP_MATRIX_PASS="+(!hardFail && !matrixAborted ? "TRUE":"FALSE"));
try{session.terminate();}catch(e){}
if(hardFail||matrixAborted) throw "matrix-fail";