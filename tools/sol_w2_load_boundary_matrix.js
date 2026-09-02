// W2_OPEN_LOOP_LOAD_BOUNDARY_CHARACTERIZATION_V1
// One REAL load point per invocation (the user physically swaps the load
// between invocations; Codex only prints READY_FOR_CRxx + the pre-power
// checklist and waits for the user confirmation).
//
// Binary: the SAME v2.2 plant-map build (SHA-gated against the frozen
// manifest) - NO code change, NO protection change for this work order.
//
// Sweep rules (work order sections 4-8):
//   - start EVERY load at 190 kHz, descend only;
//   - 190 kHz WARNING stop => CONTINUOUS_PFM_RANGE_TOO_HIGH_GAIN, end load
//     (the r8-proven slew-5000 escape makes the crossing genuine, not a
//     climb-transient artifact);
//   - Vout < 10 V at 190 kHz => descend to find the 10 V crossing, then
//     bisect (1 kHz, then 500 Hz), acceptance window 9.9..10.1 V;
//   - EVERY coarse point holds up to 5 s (operator-authorized); a candidate
//     extends to the 10 s steady hold (stages A/B/C/D/E, all inside the
//     frozen 12 s module max-hold backstop);
//   - any fault family event => hard abort, NO retry.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_OL_STEADY\\LLC_100W_F28034_OPEN_LOOP_STEADY.out";
var MANIFEST="D:\\CCS21_workspace\\Codex_Project\\evidence\\sol_master_execution\\w2_open_loop_steady\\REAL_OPEN_LOOP_STEADY_SHA256SUMS.txt";
var CSV="D:\\CCS21_workspace\\Codex_Project\\evidence\\sol_master_execution\\w2_open_loop_steady\\open_loop_load_boundary_matrix.csv";
var VOUT_GAIN=0.008089325, VOUT_OFF=-0.063715;
var WIN_LO_V=9.9, WIN_HI_V=10.1;               // first-version acceptance window
var RAW_LO=Math.round((WIN_LO_V-VOUT_OFF)/VOUT_GAIN);   // ~1230
var RAW_HI=Math.round((WIN_HI_V-VOUT_OFF)/VOUT_GAIN);   // ~1257
var PLAN=[190000,185000,180000,175000,170000,165000,160000,155000,150000,145000];

// ---------- human gates ----------
var gAuth=(java.lang.System.getenv("DSH_OPEN_LOOP_MATRIX_AUTHORIZED")||"").equals("1");
var gCr15=(java.lang.System.getenv("DSH_CR15_OHM_CONFIRMED")||"").equals("1");
var gOp=(java.lang.System.getenv("DSH_OPERATOR_PRESENT_CONFIRMED")||"").equals("1");
var gVin=(java.lang.System.getenv("DSH_VIN_24V_CONFIRMED")||"").equals("1");
var gIlim=(java.lang.System.getenv("DSH_INPUT_LIMIT_0_5A_CONFIRMED")||"").equals("1");
var gCnt=(java.lang.System.getenv("DSH_CNT34_PERMANENT_CONNECTED_CONFIRMED")||"").equals("1");
var loadOhm=java.lang.System.getenv("DSH_LOAD_OHM")||"";
var loadConf=(java.lang.System.getenv("DSH_LOAD_OHM_CONFIRMED")||"").equals("1");
var loadR=parseFloat(loadOhm);
print("GATES authorized="+gAuth+" benchload_conf="+gCr15+" operator="+gOp+" vin24="+gVin+
      " ilim="+gIlim+" CNT34="+gCnt+" | LOAD_OHM="+loadOhm+" confirmed="+loadConf);
if(!gAuth||!gCr15||!gOp||!gVin||!gIlim||!gCnt||!(loadR>0)||!loadConf){
  print("ABORT: load-boundary gates not all set (no real fire).");
  throw "no-matrix-auth";
}
var pAt10=100.0/loadR;
print("LOAD P@10V="+pAt10.toFixed(2)+" W (checklist: resistor rated power and PSU headroom were confirmed by the operator)");

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
if(!actual.equals(expected.toUpperCase())){ print("ABORT: REAL binary SHA mismatch"); throw "sha-mismatch"; }
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
function gate(name,cond){ print("GATE "+name+": "+(cond?"PASS":"FAIL")); if(!cond){ throw "gate-"+name; } }
function voutV(raw){ return raw*VOUT_GAIN+VOUT_OFF; }

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
wv("g_loopback_diag_request",1); run(50);
gate("LOOPBACK_PASS", rw("g_loopback_diag_result")===1 && rw("g_comp_tz_loopback_verified")===1);
for(var s=1;s<=5;s++){
  wv("g_stage_confirm_request",s); run(50);
  gate("STAGE_CONFIRM_"+s, rw("g_bringup_stage")===s);
}
gate("PREFLIGHT_SYS_IDLE", rw("g_system_state")===1);
gate("PREFLIGHT_PWM_OFF", rw("g_pwm_enabled")===0);
gate("PREFLIGHT_FAULT_ZERO", rv32u("g_fault_flags")===0);
gate("PREFLIGHT_OST_LATCHED", reg("EPwm1Regs.TZFLG.bit.OST")===1);
gate("PREFLIGHT_STAGE_5A", rw("g_bringup_stage")===5);
gate("PREFLIGHT_OL_IDLE", rw("g_open_loop_steady_active")===0);

// ---------- 190 kHz characterization authorization (unchanged, flag-gated) ----------
wv("g_open_loop_char_ext_authorized",1);
print("CHAR_EXT_190K_AUTHORIZED=1 (production envelope untouched)");

// ---------- CSV (header once per file) ----------
var csvFile=new File(CSV);
var needHeader=!csvFile.exists() || csvFile.length()===0;
var fw=new BufferedWriter(new FileWriter(csvFile,true));
if(needHeader){
  fw.write("load_ohm,vin_V,command_frequency_hz,actual_frequency_hz,TBPRD,CMPA,CMPB,DBRED,DBFED,vout_mean_V,vout_min_V,vout_max_V,vout_raw_mean,vout_raw_max,dVout_dt_V_per_s,settling_time_ms,ipri_raw_mean,ipri_raw_max,ipri_raw_min,ipri_deferred,adc_fresh_delta,adc_stale_ticks,adc_ovf_delta,COMP_event,TZ_event,fault_flags,ss_abort_reason,stop_reason,upper_gain_boundary,pwm_enable,pwm_ost,pwm_tzint,reached_tier,classification");
  fw.newLine(); fw.flush();
}

// ---------- shared per-point machinery ----------
/* Cumulative stage targets (operator-authorized 2026-08-25: every coarse
 * point holds up to 5 s so bench anomalies are observable; a candidate then
 * extends to the 10 s steady hold). All targets stay inside the frozen 12 s
 * module max-hold backstop:
 *   A=60ms short confirm, B=150ms, C=5s coarse hold,
 *   D=7s candidate (+2 s), E=10s candidate steady hold (the work order's
 *   10 s freeze requirement; E/F merge into the 7..10 s segment). */
var STAGES=[{t:60,n:"A_60MS"},{t:150,n:"B_100MS"},{t:5000,n:"C_5S"},
            {t:7000,n:"D_7S"},{t:10000,n:"E_10S"}];
var lastRow="";

function sessionActive(){ return rw("g_open_loop_steady_active")===1; }

function runPoint(freqHz, maxStageIdx){
  var pf_ok = rw("g_system_state")===1 && rv32u("g_fault_flags")===0 && rw("g_pwm_enabled")===0 &&
              reg("EPwm1Regs.TZFLG.bit.OST")===1 && rw("g_open_loop_steady_active")===0;
  if(!pf_ok){ print("GATE POINT_"+freqHz+"_PREFLIGHT: FAIL"); return {preflightFail:true}; }
  print("GATE POINT_"+freqHz+"_PREFLIGHT: PASS");
  /* Slew 5000 Hz/sample for EVERY point (r8-proven on the real bench): the
   * takeover always lands at 176.47 kHz and at loads near the boundary the
   * natural Vout there is ABOVE the WARNING guard. With the default 500 Hz/
   * sample the in-session ramp takes ~0.5-1.3 ms while the output cap
   * (tau ~ 0.4 ms, measured from the CR15 charge crossing) follows with a
   * ~one-tau lag -> the cap rides the EARLY high-gain asymptote and can cross
   * the guard even when natural(f_command) is below it (a false
   * TOO_HIGH_GAIN). 5000 Hz/sample escapes the high-gain band in ~3-7 ticks
   * (~60-140 us, well under one tau), so the cap then charges toward
   * natural(f_command) ALONE. Per-tick step ~5 kHz equals the trajectory's
   * own per-stage step; direction of the initial climb is gain-reducing. */
  wv32("g_open_loop_frequency_command_hz",freqHz);
  wv32("g_open_loop_freq_slew_hz_per_sample",5000);
  wv("g_pwm_enable_request",1);
  run(60);
  var tk=rw("g_open_loop_takeover_done");
  var sr0=rw("g_open_loop_stop_reason");
  var en_ok = tk===1 && rw("g_system_state")===3 &&
              ( (rw("g_open_loop_steady_active")===1 && rw("g_pwm_enable_result")===1) ||
                (sr0!==0 && rv32u("g_fault_flags")===0) );
  print("GATE POINT_"+freqHz+"_ENABLE: "+(en_ok?"PASS":"FAIL")+
        " (tk="+tk+" active="+rw("g_open_loop_steady_active")+" stop="+sr0+
        " sys="+rw("g_system_state")+" enres="+rw("g_pwm_enable_result")+")");
  if(!en_ok){ return {enableFail:true}; }

  var voutHist=[]; var stopHit=0, faultHit=0, tierFailed="";
  var ovf0=rv32u("g_adc_ovf_count");
  var t0ms=java.lang.System.currentTimeMillis();
  var reachedIdx=-1, freshDelta=0;
  for(var ti=0; ti<=maxStageIdx; ti++){
    var st=STAGES[ti];
    var seqA=rv32u("g_adc_sample_sequence");
    while((java.lang.System.currentTimeMillis()-t0ms) < st.t){
      run(50);
      var flq=rv32u("g_fault_flags"), srq=rw("g_open_loop_stop_reason");
      if(srq!==0 || flq!==0){ stopHit=srq; faultHit=flq; break; }
      voutHist.push({t:(java.lang.System.currentTimeMillis()-t0ms), filt:rw("g_adc_vout_filtered_raw")});
    }
    var seqB=rv32u("g_adc_sample_sequence");
    var vf2=rw("g_adc_vout_filtered_raw"), fa2=rv32u("g_open_loop_applied_hz");
    var sr2=rw("g_open_loop_stop_reason"), fl2=rv32u("g_fault_flags");
    var tb2=reg("EPwm1Regs.TBPRD"), ca2=reg("EPwm1Regs.CMPA.half.CMPA");
    var cb2=reg("EPwm1Regs.CMPB"), dbr=reg("EPwm1Regs.DBRED"), dbf=reg("EPwm1Regs.DBFED");
    var tzi=reg("EPwm1Regs.TZFLG.bit.INT");
    var expTB=Math.round(60000000/fa2)-1;
    var regOk=(Math.abs(tb2-expTB)<=3) && (ca2===Math.floor((tb2+1)/2)) && dbr===36 && dbf===36;
    var freshOk=(seqB>seqA);
    if(freshOk){ freshDelta=seqB-seqA; }
    var warnOk=(vf2<1290);
    var okT=(flq===0)&&(tzi===0)&&warnOk&&freshOk&&regOk;
    print("PT"+freqHz+" "+st.n+" f_applied="+fa2+" tbprd="+tb2+" exp="+expTB+
          " vout_V="+voutV(vf2).toFixed(3)+" win_mean_V="+voutV(rw("g_open_loop_win_mean_raw")).toFixed(3)+
          " steady="+rw("g_open_loop_steady_reached")+" seq="+(seqB-seqA)+
          " stale="+rv32u("g_open_loop_win_stale_ticks")+" fault=0x"+(flq>>>0).toString(16)+
          " gates="+(okT?"PASS":"FAIL"));
    if(!okT){ tierFailed=st.n; break; }
    reachedIdx=ti;
    if(stopHit!==0 || faultHit!==0){ break; }
  }
  // planned OST / falling edge after a self-stop
  wv("g_pwm_enable_request",0);
  run(40);
  var pwm0=rw("g_pwm_enabled")===0;
  var ost1=reg("EPwm1Regs.TZFLG.bit.OST")===1;
  var tz0=reg("EPwm1Regs.TZFLG.bit.INT")===0;
  var inact=rw("g_open_loop_steady_active")===0;
  if(!(pwm0&&ost1&&tz0&&inact)){ print("PT"+freqHz+" END-STATE FAIL (unplanned OST / pwm state)"); return {endFail:true}; }
  var ssT=rv32u("g_open_loop_ss_ticks");
  var r={ freq:freqHz, cmd:rv32u("g_open_loop_stop_cmd"), fa:rv32u("g_open_loop_stop_freq_applied"),
    af:rv32u("g_actual_switching_frequency_hz"), tbprd:rw("g_open_loop_stop_tbprd"),
    cmpa:reg("EPwm1Regs.CMPA.half.CMPA"), cmpb:reg("EPwm1Regs.CMPB"), dbr:reg("EPwm1Regs.DBRED"), dbf:reg("EPwm1Regs.DBFED"),
    mean:(ssT>0?Math.round(rv32u("g_open_loop_ss_vout_sum")/ssT):rw("g_open_loop_stop_mean_raw")),
    min:(ssT>0?rw("g_open_loop_ss_min_raw"):rw("g_open_loop_stop_min_raw")),
    max:(ssT>0?rw("g_open_loop_ss_max_raw"):rw("g_open_loop_stop_max_raw")),
    ipm:(ssT>0?Math.round(rv32u("g_open_loop_ss_ipri_sum")/ssT):rw("g_open_loop_stop_ipri_mean_raw")),
    ipx:(ssT>0?rw("g_open_loop_ss_ipri_max_raw"):0), ipn:0,
    comp:rv32u("g_open_loop_stop_compsts_high"), tz:rv32u("g_open_loop_stop_tz_events"),
    settle:rw("g_open_loop_settle_ms"), steady:rw("g_open_loop_steady_reached"),
    reason:rw("g_open_loop_stop_reason"), ub:rw("g_open_loop_upper_gain_boundary"),
    abrt:rw("g_softstart_abort_reason"), fault:rv32u("g_fault_flags"),
    stale:rw("g_open_loop_stop_stale_ticks"),
    ovfD:(rv32u("g_adc_ovf_count")-ovf0)>>>0, stopHit:stopHit, faultHit:faultHit, tierFailed:tierFailed,
    fresh:freshDelta };
  // live mean at the top stage (what the steady window actually held)
  r.liveMean=(ssT>0?Math.round(rv32u("g_open_loop_ss_vout_sum")/ssT):rw("g_open_loop_win_mean_raw"));
  // dVout/dt over the last >=500ms spacing
  var dvs=0; var b=null;
  for(var i=voutHist.length-1;i>=0;i--){
    var s2=voutHist[i];
    if(b===null){ b=s2; continue; }
    if(b.t-s2.t>=500){ dvs=(voutV(b.filt)-voutV(s2.filt))*1000.0/(b.t-s2.t); break; }
    b=s2;
  }
  r.dvs=dvs;
  // reached tier name (guard against a stage-gate failure at the first stage)
  if(reachedIdx<0){ reachedIdx=0; }
  r.tier=STAGES[reachedIdx].n;
  return r;
}

function writeRow(r, cls){
  var row=loadOhm+",24,"+r.freq+","+r.af+","+r.tbprd+","+r.cmpa+","+r.cmpb+","+r.dbr+","+r.dbf+","+
    voutV(r.mean).toFixed(3)+","+voutV(r.min).toFixed(3)+","+voutV(r.max).toFixed(3)+","+
    r.mean+","+r.max+","+r.dvs.toFixed(2)+","+r.settle+","+r.ipm+","+r.ipx+","+r.ipn+",1,"+
    r.fresh+","+r.stale+","+r.ovfD+","+r.comp+","+r.tz+",0x"+(r.fault>>>0).toString(16)+
    ","+r.abrt+","+r.reason+","+r.ub+","+rw("g_pwm_enabled")+","+reg("EPwm1Regs.TZFLG.bit.OST")+","+reg("EPwm1Regs.TZFLG.bit.INT")+","+
    r.tier+","+cls;
  fw.write(row); fw.newLine(); fw.flush();
  lastRow=row;
  var pW=voutV(r.mean); var pP=pW*pW/loadR;
  print("ROW "+r.freq+"Hz Vout_mean="+voutV(r.mean).toFixed(3)+"V P_load="+pP.toFixed(2)+"W stop="+r.reason+
        " steady="+r.steady+" ub="+r.ub+" ovf="+r.ovfD+" cls="+cls);
}

// ---------- sweep state machine ----------
var classification="";
var foundPoint=null;
var measured={};          // freq -> {vout_mean_raw, kind}
var fHigh=-1, fLow=-1;    // bracket: f_high (Vout<10), f_low (Vout>10)
var idx=0, hardFail=false;

function candidateCheck(f){
  var r=runPoint(f,4);               // full candidate session: A..E (10 s hold)
  if(r.preflightFail||r.enableFail||r.endFail){ hardFail=true; return null; }
  writeRow(r,"CANDIDATE_D_E_F");
  if(r.reason===3 || r.fault!==0 || r.ovfD!==0 || r.faultHit!==0){ hardFail=true; return null; }
  if(r.ub===1){ return {warn:true, r:r}; }
  var v=voutV(r.liveMean);
  if(v>=WIN_LO_V && v<=WIN_HI_V && r.steady===1){
    foundPoint=r;
    print("CONTINUOUS_PFM_FIRST_VALID_LOAD_POINT candidate frozen:");
    print("  load="+loadOhm+"ohm P="+v.toFixed(3)+"^2/"+loadOhm+"="+(v*v/loadR).toFixed(2)+"W Vin=24V");
    print("  Fs_cmd="+f+" actual="+r.af+" TBPRD="+r.tbprd+" CMPA="+r.cmpa+" CMPB="+r.cmpb+" DB=36");
    print("  Vout mean="+v.toFixed(3)+"V min="+voutV(r.min).toFixed(3)+" max="+voutV(r.max).toFixed(3)+
          " ripple_pp="+(voutV(r.max)-voutV(r.min)).toFixed(3)+"V settle_ms="+r.settle+" dVdt="+r.dvs.toFixed(2));
    print("  IPRI=deferred(0) COMP="+r.comp+" TZ="+r.tz+" fault=0x"+(r.fault>>>0).toString(16));
    print("  REAL_SHA="+actual);
    return {found:true, r:r};
  }
  if(v<10.0){ measured[f]={v:v,kind:"steady"}; fHigh=f; return {below:r}; }
  return {above:r};
}

/* --- point 1: 190 kHz (mandatory first, 5 s hold) --- */
print("=== LOAD "+loadOhm+" OHM - POINT 1: 190000 Hz ===");
var r1=runPoint(190000,2);
if(r1.preflightFail||r1.enableFail||r1.endFail){ print("ABORT: 190k entry failure"); throw "point1-fail"; }
if(r1.tierFailed!==""){ print("ABORT: stage gate failed at 190k ("+r1.tierFailed+"). NO retry."); throw "point1-tier"; }
writeRow(r1,"COARSE_190K");
if(r1.ovfD!==0 || r1.fault!==0 || r1.reason===3){ print("ABORT: 190k fault family"); throw "point1-fault"; }
/* With the r8-proven slew-5000 escape (cap follows natural(f_command) ALONE,
 * ~0.15 tau exposure to the early asymptote) any WARNING at 190 kHz is a
 * GENUINE natural(190k) above the guard -> rule A, no disambiguation needed. */
if(r1.reason===2){
  classification="CONTINUOUS_PFM_RANGE_TOO_HIGH_GAIN";
}
if(classification===""){
  var v1=voutV(r1.liveMean);
  if(r1.steady===1 && v1>=WIN_LO_V && v1<=WIN_HI_V){
    var fc=candidateCheck(190000);
    if(fc&&fc.found){ print("FOUND at 190000 Hz"); classification="FOUND"; }
    else if(fc&&fc.warn){ classification="CONTINUOUS_PFM_RANGE_TOO_HIGH_GAIN"; }
    else if(fc===null){ throw "candidate-fail"; }
  } else if(v1<10.0){ measured[190000]={v:v1,kind:"steady"}; fHigh=190000; }
  else { fLow=190000; measured[190000]={v:v1,kind:"steady"}; }
}

/* --- descent --- */
if(classification===""){
  idx=1;
  while(idx<PLAN.length && classification===""){
    var f=PLAN[idx];
    if(measured[f]||f===fLow||f===fHigh){ idx++; continue; }
    print("=== DESCENT: "+f+" Hz ===");
    var r=runPoint(f,2);
    if(r.preflightFail||r.enableFail||r.endFail){ hardFail=true; break; }
    if(r.tierFailed!==""){ print("ABORT: stage gate failed at "+f+" ("+r.tierFailed+"). NO retry."); hardFail=true; break; }
    writeRow(r,"COARSE_DESCENT");
    if(r.ovfD!==0||r.fault!==0||r.reason===3){ hardFail=true; break; }
    if(r.reason===2){
      /* WARNING stop: natural value here exceeds the guard => this f is a
       * valid f_low bound (Vout > 10.49 V). Bracket if fHigh exists. */
      fLow=f;
      if(fHigh>0){ break; }   // bracket complete -> bisection
      classification="CONTINUOUS_PFM_RANGE_TOO_HIGH_GAIN";
      break;
    }
    var v=voutV(r.liveMean);
    if(r.steady===1 && v>=WIN_LO_V && v<=WIN_HI_V){
      var fc2=candidateCheck(f);
      if(fc2&&fc2.found){ classification="FOUND"; break; }
      else if(fc2&&fc2.warn){ fLow=f; if(fHigh>0){ break; } }
      else if(fc2===null){ hardFail=true; break; }
    } else if(v<10.0){ measured[f]={v:v,kind:"steady"}; fHigh=f; idx++; }
    else { measured[f]={v:v,kind:"steady"}; fLow=f; if(fHigh>0){ break; } idx++; }
  }
  if(idx>=PLAN.length && classification===""){
    /* descended to 145 kHz and still below 10 V (or never crossed) */
    classification="NO_CROSSING_FOUND_IN_BAND";
  }
}

/* --- bisection --- */
var bisectIter=0;
while(classification==="" && fHigh>0 && fLow>0 && bisectIter<8){
  var width=fHigh-fLow;
  var mid=Math.round((fHigh+fLow)/2/500)*500;
  if(measured[mid]||mid===fLow||mid===fHigh||mid<=145000){
    if(width<=500){ break; }
    mid=Math.round((fHigh+fLow)/2/1000)*1000;
    if(measured[mid]||mid===fLow||mid===fHigh){ break; }
  }
  bisectIter++;
  print("=== BISECT "+bisectIter+": "+mid+" Hz (bracket "+fLow+".."+fHigh+") ===");
  var rb=runPoint(mid,2);
  if(rb.preflightFail||rb.enableFail||rb.endFail){ hardFail=true; break; }
  if(rb.tierFailed!==""){ print("ABORT: stage gate failed at bisect "+mid+" ("+rb.tierFailed+"). NO retry."); hardFail=true; break; }
  writeRow(rb,"BISECT");
  if(rb.ovfD!==0||rb.fault!==0||rb.reason===3){ hardFail=true; break; }
  if(rb.reason===2){ fLow=mid; continue; }   // natural > guard here
  var vb=voutV(rb.liveMean);
  if(rb.steady===1 && vb>=WIN_LO_V && vb<=WIN_HI_V){
    var fc3=candidateCheck(mid);
    if(fc3&&fc3.found){ classification="FOUND"; break; }
    else if(fc3&&fc3.warn){ fLow=mid; }
    else if(fc3===null){ hardFail=true; break; }
  } else if(vb<10.0){ fHigh=mid; measured[mid]={v:vb,kind:"steady"}; }
  else { fLow=mid; measured[mid]={v:vb,kind:"steady"}; }
}
if(classification==="" && fHigh>0 && fLow>0){
  classification="CROSSING_BRACKETED_"+fLow+"_TO_"+fHigh+"_HZ";
}

// ---------- final state ----------
wv("g_open_loop_char_ext_authorized",0);
fw.flush(); fw.close();
print("=== LOAD "+loadOhm+" OHM RESULT ===");
print("fHigh(Vout<10V)="+fHigh+" fLow(Vout>10V)="+fLow+" bisect_iter="+bisectIter);
print("FOUND_POINT="+(foundPoint?("Fs="+foundPoint.freq+" Vout="+voutV(foundPoint.liveMean).toFixed(3)+"V"):"none"));
print("LOAD_BOUNDARY_CLASSIFICATION="+classification);
print("LOAD_BOUNDARY_CHARACTERIZATION_"+(hardFail?"BLOCKED":"PASS")+"_LOAD_"+loadOhm.replace(".","P"));
if(hardFail){ throw "load-boundary-hard-fail"; }