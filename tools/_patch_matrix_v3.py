# -*- coding: utf-8 -*-
"""Matrix script v3: W2_OPEN_LOOP_EXTENDED_BAND_170_190K_V1 protocol."""
import io

p = r'tools\sol_w2_open_loop_matrix.js'
s = io.open(p, encoding='utf-8').read()

pairs = [
# 1. CSV v3
(
'''var CSV="D:\\\\CCS21_workspace\\\\Codex_Project\\\\evidence\\\\sol_master_execution\\\\w2_open_loop_steady\\\\open_loop_matrix_real_v2.csv";''',
'''var CSV="D:\\\\CCS21_workspace\\\\Codex_Project\\\\evidence\\\\sol_master_execution\\\\w2_open_loop_steady\\\\open_loop_matrix_real_v3_char190.csv";''',
),
# 2. POINTS descending 190k -> 170k
(
'''var POINTS=[170000,165000,160000,157500,155000,152500,150000];''',
'''var POINTS=[190000,185000,180000,175000,170000];''',
),
# 3. header + authorization arming
(
'''// ---------- CSV header ----------
var fw=new BufferedWriter(new FileWriter(CSV,true));
fw.write("Vin_V,Load,Frequency_Hz,TBPRD,Takeover_Hz,Vout_mean_V,Vout_min_V,Vout_max_V,Vout_ripple_V,IPRI_mean_raw,IPRI_max_raw,COMP_event,TZ_event,settling_time_ms,steady_state_valid,stop_reason,upper_gain_boundary,fault_flags");
fw.newLine();''',
'''// ---------- W2_OPEN_LOOP_EXTENDED_BAND_170_190K_V1 authorization ----------
/* Production envelope (PI/Burst 145..170 kHz) is frozen in every build. This
 * plant-map build accepts commands up to OPEN_LOOP_CHARACTERIZATION_MAX_HZ
 * (190 kHz) ONLY while this firmware bit is set. Arm it after all hard gates
 * passed, once, before the first point. */
wv("g_open_loop_char_ext_authorized",1);
print("CHAR_EXT_190K_AUTHORIZED=1 (W2_OPEN_LOOP_EXTENDED_BAND_170_190K_V1; production envelope untouched)");

// ---------- CSV header ----------
var fw=new BufferedWriter(new FileWriter(CSV,true));
fw.write("Vin_V,Load,Frequency_Hz,TBPRD,Takeover_Hz,Actual_Fs_Hz,Vout_mean_V,Vout_min_V,Vout_max_V,dVout_dt_V_per_s,IPRI_mean_raw,IPRI_max_raw,COMP_event,TZ_event,settling_time_ms,steady_state_valid,stop_reason,upper_gain_boundary,fault_flags,ADC_ovf_delta");
fw.newLine();''',
),
# 4. tiered poll loop replacing the flat poll loop
(
'''  // poll loop (~100 ms prints; up to 8 s + 2 s dwell)
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
  }''',
'''  // tiered confirmation (cumulative from enable): 100ms -> 600ms -> 2.6s ->
  // 7.6s -> 10s. All cumulative targets stay inside the frozen 12 s module
  // max-hold backstop. Per-tier gates: fault=0, COMP/TZ INT=0, Vout below
  // WARNING, ADC fresh (sequence advancing + OVF delta 0), PWM registers
  // correct (TBPRD tracks the applied frequency, CMPA=(TBPRD+1)/2, DB=36).
  var TIERS=[{t:100,n:"T1_100MS"},{t:600,n:"T2_600MS"},{t:2600,n:"T3_2P6S"},
             {t:7600,n:"T4_7P6S"},{t:10000,n:"T5_10S"}];
  var voutHist=[]; var stopHit=0, faultHit=0;
  var ovf0=rv32u("g_adc_ovf_count");
  var t0ms=java.lang.System.currentTimeMillis();
  var tierFailed="";
  for(var ti=0; ti<TIERS.length; ti++){
    var tier=TIERS[ti];
    var seqA=rv32u("g_adc_sample_sequence");
    while((java.lang.System.currentTimeMillis()-t0ms) < tier.t){
      run(50);
      var flq=rv32u("g_fault_flags"), srq=rw("g_open_loop_stop_reason");
      if(srq!==0 || flq!==0){ stopHit=srq; faultHit=flq; break; }
      voutHist.push({t:(java.lang.System.currentTimeMillis()-t0ms),
                     raw:rw("g_adc_vout_raw"), filt:rw("g_adc_vout_filtered_raw"),
                     ip:rw("g_adc_ipri_raw")});
    }
    var seqB=rv32u("g_adc_sample_sequence");
    var vr2=rw("g_adc_vout_raw"), vf2=rw("g_adc_vout_filtered_raw"), ip2=rw("g_adc_ipri_raw");
    var fa2=rv32u("g_open_loop_applied_hz");
    var ph2=rw("g_open_loop_phase"), st2=rw("g_open_loop_steady_reached");
    var sr2=rw("g_open_loop_stop_reason"), fl2=rv32u("g_fault_flags");
    var tb2=reg("EPwm1Regs.TBPRD"), ca2=reg("EPwm1Regs.CMPA.half.CMPA");
    var dbr=reg("EPwm1Regs.DBRED"), dbf=reg("EPwm1Regs.DBFED");
    var tzi=reg("EPwm1Regs.TZFLG.bit.INT");
    var expTB=Math.round(60000000/fa2)-1;
    var regOk=(Math.abs(tb2-expTB)<=3) && (ca2===Math.floor((tb2+1)/2)) && dbr===36 && dbf===36;
    var freshOk=(seqB>seqA);
    var warnOk=(vf2<1290);   // strict WARNING stop is the module's own 1304 raw
    var okT=(flq===0) && (tzi===0) && warnOk && freshOk && regOk;
    print("PT"+target+" "+tier.n+" f_applied="+fa2+" tbprd="+tb2+" exp="+expTB+
          " vout_raw="+vr2+" vout_V="+voutV(vf2).toFixed(3)+" ipri="+ip2+
          " phase="+ph2+" steady="+st2+" seq="+(seqB-seqA)+" fault=0x"+(flq>>>0).toString(16)+
          " gates="+(okT?"PASS":"FAIL"));
    if(!okT){ tierFailed=tier.n; break; }
    if(stopHit!==0 || faultHit!==0){ break; }   // module self-stopped (e.g. WARNING boundary)
  }
  if(tierFailed!==""){
    print("ABORT: tier gate failed at PT"+target+" ("+tierFailed+"). NO retry per work order.");
    matrixAborted=true; hardFail=true; break;
  }''',
),
# 5. snapshot: prefer steady accumulator + dVout/dt + ovf + actual fs; new row
(
'''  // stop snapshot
  var reason=rw("g_open_loop_stop_reason");
  var ub2=rw("g_open_loop_upper_gain_boundary");
  var snap={ freq:target, tk:rv32u("g_open_loop_takeover_freq_hz"), tbprd:rw("g_open_loop_stop_tbprd"),
    mean:rw("g_open_loop_stop_mean_raw"), min:rw("g_open_loop_stop_min_raw"), max:rw("g_open_loop_stop_max_raw"),
    ipm:rw("g_open_loop_stop_ipri_mean_raw"), ipx:rw("g_open_loop_stop_ipri_max_raw"),
    comp:rv32u("g_open_loop_stop_compsts_high"), tz:rv32u("g_open_loop_stop_tz_events"),
    settle:rw("g_open_loop_settle_ms"), stk:rv32u("g_open_loop_steady_ticks"),
    fa:rv32u("g_open_loop_stop_freq_applied"), cmd:rv32u("g_open_loop_stop_cmd"),
    reason:reason, ub:ub2, fault:rv32u("g_fault_flags"), steady:rw("g_open_loop_steady_reached") };
  var row="24,CR15,"+target+","+snap.tbprd+","+snap.tk+","+voutV(snap.mean).toFixed(3)+","+voutV(snap.min).toFixed(3)+","+
          voutV(snap.max).toFixed(3)+","+voutV(snap.max-snap.min).toFixed(3)+","+snap.ipm+","+snap.ipx+","+
          snap.comp+","+snap.tz+","+snap.settle+","+(snap.reason===1?(snap.steady===1?1:0):0)+","+snap.reason+","+snap.ub+",0x"+(snap.fault>>>0).toString(16);
  fw.write(row); fw.newLine(); fw.flush();
  pointsDone++;
  print("PT"+target+" SNAPSHOT reason="+snap.reason+" tbprd="+snap.tbprd+" applied="+snap.fa+
        " mean="+snap.mean+" min="+snap.min+" max="+snap.max+" ipri_mean="+snap.ipm+
        " settle_ms="+snap.settle+" steady="+snap.steady+" upper_boundary="+snap.ub);''',
'''  // stop snapshot (prefer the steady-state accumulator when it ran)
  var reason=rw("g_open_loop_stop_reason");
  var ub2=rw("g_open_loop_upper_gain_boundary");
  var ssT=rv32u("g_open_loop_ss_ticks");
  var snap={ freq:target, tk:rv32u("g_open_loop_takeover_freq_hz"), tbprd:rw("g_open_loop_stop_tbprd"),
    mean:(ssT>0?Math.round(rv32u("g_open_loop_ss_vout_sum")/ssT):rw("g_open_loop_stop_mean_raw")),
    min:(ssT>0?rw("g_open_loop_ss_min_raw"):rw("g_open_loop_stop_min_raw")),
    max:(ssT>0?rw("g_open_loop_ss_max_raw"):rw("g_open_loop_stop_max_raw")),
    ipm:(ssT>0?Math.round(rv32u("g_open_loop_ss_ipri_sum")/ssT):rw("g_open_loop_stop_ipri_mean_raw")),
    ipx:(ssT>0?rw("g_open_loop_ss_ipri_max_raw"):rw("g_open_loop_stop_ipri_max_raw")),
    comp:rv32u("g_open_loop_stop_compsts_high"), tz:rv32u("g_open_loop_stop_tz_events"),
    settle:rw("g_open_loop_settle_ms"), stk:rv32u("g_open_loop_steady_ticks"),
    fa:rv32u("g_open_loop_stop_freq_applied"), af:rv32u("g_actual_switching_frequency_hz"),
    cmd:rv32u("g_open_loop_stop_cmd"),
    reason:reason, ub:ub2, fault:rv32u("g_fault_flags"), steady:rw("g_open_loop_steady_reached") };
  // dVout/dt over the last >=500 ms spacing of the record (V/s, signed)
  var dvs=0, dvmax=0;
  var b=null;
  for(var i=voutHist.length-1;i>=0;i--){
    var s2=voutHist[i];
    if(b===null){ b=s2; continue; }
    if(b.t-s2.t>=500){ dvs=(voutV(b.filt)-voutV(s2.filt))*1000.0/(b.t-s2.t); break; }
    var sl=Math.abs((voutV(b.filt)-voutV(s2.filt))*1000.0/Math.max(1,(b.t-s2.t)));
    if(sl>dvmax) dvmax=sl;
    b=s2;
  }
  var ovfD=(rv32u("g_adc_ovf_count")-ovf0)>>>0;
  var row="24,CR15,"+target+","+snap.tbprd+","+snap.tk+","+snap.af+","+voutV(snap.mean).toFixed(3)+","+voutV(snap.min).toFixed(3)+","+
          voutV(snap.max).toFixed(3)+","+dvs.toFixed(2)+","+snap.ipm+","+snap.ipx+","+
          snap.comp+","+snap.tz+","+snap.settle+","+(snap.steady===1?1:0)+","+snap.reason+","+snap.ub+",0x"+(snap.fault>>>0).toString(16)+","+ovfD;
  fw.write(row); fw.newLine(); fw.flush();
  pointsDone++;
  print("PT"+target+" SNAPSHOT reason="+snap.reason+" tbprd="+snap.tbprd+" applied="+snap.fa+
        " actualFs="+snap.af+" mean="+snap.mean+" min="+snap.min+" max="+snap.max+
        " dVdt="+dvs.toFixed(2)+"V/s maxSlope="+dvmax.toFixed(2)+"V/s ipri_mean="+snap.ipm+
        " settle_ms="+snap.settle+" steady="+snap.steady+" upper_boundary="+snap.ub+
        " ovf_delta="+ovfD);
  if(ovfD!==0){
    print("ABORT: ADC OVF delta nonzero at PT"+target+" (realtime/freshness violation). NO retry.");
    matrixAborted=true; hardFail=true; break;
  }''',
),
]
for old, new in pairs:
    assert old in s and s.count(old) == 1, old[:60]
    s = s.replace(old, new)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('matrix v3 protocol written')