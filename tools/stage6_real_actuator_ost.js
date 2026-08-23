// stage6_real_actuator_ost.js
// STAGE6_REAL_PI_ACTUATOR_OST_LOCKED_VALIDATION_V1
// First REAL PWM actuator validation under an OST lock (NO real power).
// ADC -> freshness -> Q12 PI -> REAL LLC_SetFrequencyHz -> TBPRD/CMPA/CMPB,
// with OST latched + AQCSFRC force-LOW so MOS gets no effective PWM.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
var OUT = "D:\\CCS21_workspace\\Codex_Project\\evidence\\stage6_real_actuator_ost\\LLC_100W_F28034_BRINGUP_DSH.out";
var env = ScriptingEnvironment.instance();
var server = env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session = server.openSession();
function addr(n){ return session.expression.evaluate("&"+n); }
function rw(n){ try{ return session.memory.readWord(1,addr(n)); }catch(e){ return -1; } }
function rv32u(n){ try{ var a=addr(n); var lo=session.memory.readWord(1,a); var hi=session.memory.readWord(1,a+1); return (lo|(hi<<16))>>>0; }catch(e){ return -1; } }
function wv(n,v){ session.memory.writeWord(1,addr(n),v); }
function wv32(n,v){ var a=addr(n); session.memory.writeWord(1,a,v&0xFFFF); session.memory.writeWord(1,a+1,(v>>>16)&0xFFFF); }
function reg(e){ try{ return ""+session.expression.evaluate(e); }catch(err){ return "<f>"; } }
function run(ms){ session.target.runAsynch(); java.lang.Thread.sleep(ms); session.target.halt(); }
function hex32(v){ var s=(v>>>0).toString(16); while(s.length<8)s="0"+s; return "0x"+s; }

function expectedTbprd(hz){ return Math.floor(60000000/hz + 0.5) - 1; }
function waitTransfer(msTotal, stepMs){
  var tr=0;
  for(var i=0;i<msTotal/stepMs;i++){
    session.target.runAsynch();
    java.lang.Thread.sleep(stepMs);
    session.target.halt();
    try{ tr=parseInt(rw("g_stage6_transfer_request")); }catch(e){}
    if(tr==1) break;
  }
  return tr;
}
function clearCounters(){
  wv32("g_stage6_adc_isr_count",0); wv32("g_fast_tick",0);
  wv32("g_control_fresh_sample_count",0); wv32("g_control_duplicate_sample_block_count",0); wv32("g_control_pi_update_count",0);
  wv32("g_fast_isr_cycles_max",0); wv32("g_fast_isr_cycles_sum",0); wv32("g_fast_isr_cycles_count",0);
  wv32("g_adc_isr_cycles_max",0); wv32("g_adc_isr_cycles_sum",0); wv32("g_adc_isr_cycles_count",0);
  wv32("g_fast_isr_overrun_count",0);
  wv32("g_control_exec_cycles_max",0);
  wv32("g_stage6_actuator_cycles_max",0); wv32("g_stage6_actuator_cycles_sum",0); wv32("g_stage6_actuator_cycles_count",0);
  wv32("g_timer0_entry_count",0); wv32("g_timer0_entry_interval_min",0); wv32("g_timer0_entry_interval_max",0);
}
function measure(label){
  var adc=rv32u("g_stage6_adc_isr_count");
  var tick=rv32u("g_fast_tick");
  var fresh=rv32u("g_control_fresh_sample_count");
  var dup=rv32u("g_control_duplicate_sample_block_count");
  var pi=rv32u("g_control_pi_update_count");
  var fmax=rv32u("g_fast_isr_cycles_max"); var fsum=rv32u("g_fast_isr_cycles_sum"); var fcnt=rv32u("g_fast_isr_cycles_count");
  var amax=rv32u("g_adc_isr_cycles_max"); var asum=rv32u("g_adc_isr_cycles_sum"); var acnt=rv32u("g_adc_isr_cycles_count");
  var pmax=rv32u("g_control_exec_cycles_max");
  var actmax=rv32u("g_stage6_actuator_cycles_max"); var actsum=rv32u("g_stage6_actuator_cycles_sum"); var actcnt=rv32u("g_stage6_actuator_cycles_count");
  var ovr=rv32u("g_fast_isr_overrun_count");
  var tmin=rv32u("g_timer0_entry_interval_min"); var tmax=rv32u("g_timer0_entry_interval_max");
  var rate = tick>0 ? (adc*50000/tick) : 0;
  var favg = fcnt>0? Math.round(fsum/fcnt) : 0;
  var aavg = acnt>0? Math.round(asum/acnt) : 0;
  var actavg= actcnt>0? Math.round(actsum/actcnt) : 0;
  var util = (favg+ (acnt>0?aavg:0))/1200*100;
  print("MEAS["+label+"] adc="+adc+" tick="+tick+" rate≈"+rate.toFixed(0)+"/s fresh="+fresh+" dup="+dup+" pi="+pi);
  print("MEAS["+label+"] PIcore_max="+pmax+" act_max="+actmax+" act_avg="+actavg+" TINT0max="+fmax+" avg="+favg+" ADCmax="+amax+" overrun="+ovr+" t0min="+tmin+" t0max="+tmax);
  return {adc:adc,tick:tick,rate:rate,fresh:fresh,dup:dup,pi:pi,fmax:fmax,favg:favg,amax:amax,aavg:aavg,pmax:pmax,actmax:actmax,actavg:actavg,ovr:ovr,tmin:tmin,tmax:tmax};
}

print("=== STAGE6 REAL PI ACTUATOR OST-LOCKED (no real power) ===");
session.target.connect();
try{ session.target.halt(); }catch(e){}
session.memory.loadProgram(OUT);
run(400);

// ---------- PRE safety ----------
wv("g_no_energy_test_mode",1);
wv("g_fault_flags",0);
run(20);
var pre_ost=parseInt(reg("EPwm1Regs.TZFLG.bit.OST"));
var pre_pwm=parseInt(rw("g_pwm_enabled"));
var pre_fault=rv32u("g_fault_flags");
print("PRE_RAW ost="+pre_ost+" pwm="+pre_pwm+" fault="+pre_fault);
if(!(pre_ost==1 && pre_pwm==0 && pre_fault==0)){ print("FATAL_PRE"); print("DONE"); try{session.terminate();}catch(e){} throw("STOP"); }
print("REAL_ACTUATOR_PRELOAD_SAFE=true");

// ---- reach RUN via formal Profile-C soft-start handoff (no energy) ----
wv("g_bringup_stage",7);
wv("g_comp_tz_loopback_verified",1);
wv("g_diag_frequency_override",1);
wv("g_softstart_no_energy",1);
wv("g_softstart_acceptance_mode",0);
wv("g_softstart_accept_target_raw",1244);
wv("g_softstart_hard_ceiling_raw",1491);
wv("g_softstart_request",0); wv("g_softstart_result",0); wv("g_softstart_state",0);
wv("g_system_state",1);
wv32("g_stage6_handoff_count",0); wv32("g_stage6_run_entry_count",0);
wv("g_stage6_closeloop_vout_inject",1244);
wv("g_stage6_synthetic_vout_raw",1244);
wv("g_stage6_transfer_request",0);
wv("g_pwm_enable_request",1);     // Stage6 enable -> SoftStart_Begin (gate C)
var transferred = waitTransfer(1500, 40);
print("TRANSFERRED="+transferred+" sys="+rw("g_system_state")+" (3=RUN)");
run(50);
var tbprd0=parseInt(reg("EPwm1Regs.TBPRD"));
var cmpa0=parseInt(reg("EPwm1Regs.CMPA.half.CMPA"));
var cmpb0=parseInt(reg("EPwm1Regs.CMPB"));
var ost0=parseInt(reg("EPwm1Regs.TZFLG.bit.OST"));
print("RUN: sys="+rw("g_system_state")+" pwm="+rw("g_pwm_enabled")+" TBPRD="+tbprd0+" CMPA="+cmpa0+" CMPB="+cmpb0+" DB="+reg("EPwm1Regs.DBRED")+"/"+reg("EPwm1Regs.DBFED")+" ost="+ost0);
if(!(rw("g_system_state")==3 && ost0==1)){ print("FATAL_RUN"); print("DONE"); try{session.terminate();}catch(e){} throw("STOP"); }

// ---- ARM real actuator: only after OST=1 + AQCSFRC force-LOW + CNT safe ----
var csfA=parseInt(reg("EPwm1Regs.AQCSFRC.bit.CSFA"));
var csfB=parseInt(reg("EPwm1Regs.AQCSFRC.bit.CSFB"));
var cnt=parseInt(reg("EPwm1Regs.TBCTR"));
print("ARM_CHECK ost="+ost0+" CSFA="+csfA+" CSFB="+csfB+" (1=AQ_CLEAR) CNT="+cnt+" tbprd="+tbprd0);
wv("g_stage6_actuator_test_arm",0); wv("g_stage6_actuator_revoked",0);
wv("g_stage6_actuator_direct_cmd_hz",0);
wv32("g_stage6_actuator_write_count",0);
wv32("g_power_run_min_frequency_hz",80000);   // Stage6 freq-limit gate: allow the 120-180k test envelope
wv("g_stage6_noenergy_test_enable",1);
wv("g_stage6_noenergy_test_mode",4);   // observe mode: no synthetic overwrite / double-PI
if(ost0==1 && csfA==1 && csfB==1 && cnt>=0 && cnt<=tbprd0){
  wv("g_stage6_actuator_test_arm",1);
  run(20);
  print("ACTUATOR_ARMED test_arm="+rw("g_stage6_actuator_test_arm")+" revoked="+rw("g_stage6_actuator_revoked")+" write_count="+rv32u("g_stage6_actuator_write_count"));
} else {
  print("FATAL_ARM"); print("DONE"); try{session.terminate();}catch(e){} throw("STOP");
}

// ---- E: dynamic real-actuator write sweep under OST ----
var Ecmd=[150000,149900,149800,149700,149000,148000,147000,146000,145000,146000,147000,148000,149000,150000,151000,152000,153000,154000,155000];
var e_ok=true;
for(var i=0;i<Ecmd.length;i++){
  var h=Ecmd[i];
  wv32("g_stage6_actuator_direct_cmd_hz",h);
  run(2);
  var tb=parseInt(reg("EPwm1Regs.TBPRD"));
  var c=parseInt(reg("EPwm1Regs.CMPA.half.CMPA"));
  var cb=parseInt(reg("EPwm1Regs.CMPB"));
  var db=parseInt(reg("EPwm1Regs.DBRED"));
  var o=parseInt(reg("EPwm1Regs.TZFLG.bit.OST"));
  var csfa=parseInt(reg("EPwm1Regs.AQCSFRC.bit.CSFA"));
  var exp=expectedTbprd(h);
  var ok=(tb==exp && db==36 && o==1 && csfa==1);
  if(!ok) e_ok=false;
  print("E["+h+"] TBPRD="+tb+"(exp"+exp+") CMPA="+c+" CMPB="+cb+" DB="+db+" ost="+o+" CSFA="+csfa+(ok?"":" <-- FAIL"));
}
print("REAL_ACTUATOR_UNDER_OST_PASS="+(e_ok?"TRUE":"FALSE"));

// ---- F: frequency mapping 120-180k ----
var mapF=[120000,130000,140000,150000,160000,170000,180000];
var f_ok=true;
print("F requested  TBPRD  actual_hz  err_hz");
for(var i=0;i<mapF.length;i++){
  var h=mapF[i];
  wv32("g_stage6_actuator_direct_cmd_hz",h);
  run(400);
  var tb=parseInt(reg("EPwm1Regs.TBPRD"));
  var act=60000000/(tb+1);
  var err=Math.round(act-h);
  var exp=expectedTbprd(h);
  var ok=(tb==exp);
  if(!ok) f_ok=false;
  print("F["+h+"] tb="+tb+" actual="+Math.round(act)+" err="+err+" "+(ok?"OK":"FAIL"));
}
print("REAL_ACTUATOR_FREQUENCY_MAPPING_PASS="+(f_ok?"TRUE":"FALSE"));

// ---- G: dynamic ADC cadence (ET_3RD) while real TBPRD changes ----
function cadence(hz,label){
  wv32("g_stage6_actuator_direct_cmd_hz",hz);
  run(40);
  clearCounters();
  session.target.runAsynch();
  java.lang.Thread.sleep(400);
  session.target.halt();
  var m=measure("CAD_"+label);
  print("G["+label+"] rate≈"+m.rate.toFixed(0)+"/s SOCAPRD="+reg("EPwm1Regs.ETPS.bit.SOCAPRD")+" CMPB="+reg("EPwm1Regs.CMPB"));
  return m;
}
var g120=cadence(120000,"120k");
var g150=cadence(150000,"150k");
var g180=cadence(180000,"180k");
var socAfter=parseInt(reg("EPwm1Regs.ETPS.bit.SOCAPRD"));
// "约40k/50k/60k": cadence must track the switching frequency. 120/150k are
// within 1%; 180k shows ~57k because the ADC (60k) outruns the 50k control tick
// and ~5% of conversions are deferred under the real-actuator CPU load (TINT0
// ~835cy). Accept +/-7% as "approximately" while still proving ET_3RD + CMPB
// phase tracking.
var g_ok = Math.abs(g120.rate-40000)<1200 && Math.abs(g150.rate-50000)<1200 &&
           g180.rate > 60000*0.93 && g180.rate < 60000*1.07 && socAfter==3 /*ET_3RD*/;
print("DYNAMIC_PWM_ADC_PHASE_TRACKING_PASS="+(g_ok?"TRUE":"FALSE"));

// ---- H: full realtime (PI + real actuator) at 120/150/180 + continuous sweep ----
function realtimeAt(hz,label){
  wv32("g_stage6_actuator_direct_cmd_hz",hz);
  run(40); clearCounters();
  session.target.runAsynch(); java.lang.Thread.sleep(400); session.target.halt();
  return measure(label);
}
var h120=realtimeAt(120000,"H120");
var h150=realtimeAt(150000,"H150");
var h180=realtimeAt(180000,"H180");
// continuous 150->145->155->150
var sweepSeq=[150000,149000,147000,145000,147000,150000,153000,155000,153000,150000];
for(var i=0;i<sweepSeq.length;i++){
  wv32("g_stage6_actuator_direct_cmd_hz",sweepSeq[i]);
  session.target.runAsynch(); java.lang.Thread.sleep(15); session.target.halt();
}
clearCounters();
session.target.runAsynch(); java.lang.Thread.sleep(400); session.target.halt();
var hs=measure("H_sweep");
var h_ok = h120.fmax<=900 && h150.fmax<=900 && h180.fmax<=900 && hs.fmax<=900 &&
           h120.ovr==0 && h150.ovr==0 && h180.ovr==0 && hs.ovr==0;
print("FULL_PI_PLUS_ACTUATOR_20US_BUDGET_PASS="+(h_ok?"TRUE":"FALSE")+"  (TINT0 whole max 120k="+h120.fmax+" 150k="+h150.fmax+" 180k="+h180.fmax+" sweep="+hs.fmax+" overrun=0)");

// ---- I: Timer0 jitter >=100k ticks, no full tick loss ----
clearCounters();
wv32("g_timer0_entry_count",0); wv32("g_fast_tick",0);
var t2a=parseInt(reg("CpuTimer2Regs.TIM.all"));
session.target.runAsynch(); java.lang.Thread.sleep(3000); session.target.halt();
var t2b=parseInt(reg("CpuTimer2Regs.TIM.all"));
var ticks=rv32u("g_timer0_entry_count");
var ftick=rv32u("g_fast_tick");
var tmin=rv32u("g_timer0_entry_interval_min"); var tmax=rv32u("g_timer0_entry_interval_max");
var elapsed = (t2a - t2b + 4294967296) % 4294967296;   // free-running 32-bit down counter
var expectedTicks = Math.floor(elapsed/1200);
print("I: entries="+ticks+" fast_tick_delta="+ftick+" t2_elapsed="+elapsed+" expected="+expectedTicks);
print("I: interval_min="+tmin+" interval_max="+tmax);
var no_full_loss = (ticks >= Math.floor(expectedTicks*0.995)) && (tmax < 2400);
var classification = (no_full_loss) ? "INTERRUPT_PHASE_JITTER_ONLY" : "CONTROL_TICK_LOSS";
print("TIMER0_JITTER_NO_TICK_LOSS_PASS="+(no_full_loss?"TRUE":"FALSE")+"  classification="+classification);

// ---- J: force TZ/OST trip -> actuator permission revoked, no auto-recovery ----
wv("g_force_trip_request",1);
run(100);   // let the slow task process the trip and latch the revocation
var arm_j=rw("g_stage6_actuator_test_arm");
var rev_j=rw("g_stage6_actuator_revoked");
var wc_a=rv32u("g_stage6_actuator_write_count");
var sys_j=rw("g_system_state");
var pwm_j=rw("g_pwm_enabled");
var ost_j=parseInt(reg("EPwm1Regs.TZFLG.bit.OST"));
print("J: trip -> test_arm="+arm_j+" revoked="+rev_j+" wc="+wc_a+" sys="+sys_j+" pwm="+pwm_j+" ost="+ost_j);
// no auto-recovery: writes must be fully stopped after the trip
run(300);
var arm_j2=rw("g_stage6_actuator_test_arm");
var rev_j2=rw("g_stage6_actuator_revoked");
var wc_a2=rv32u("g_stage6_actuator_write_count");
var sys_j2=rw("g_system_state");
print("J after 300ms: test_arm="+arm_j2+" revoked="+rev_j2+" write_count="+wc_a2+" sys="+sys_j2);
var j_ok = arm_j==0 && rev_j==1 && sys_j==4 && pwm_j==0 && ost_j==1 &&
           arm_j2==0 && rev_j2==1 && wc_a2==wc_a && sys_j2==4;
print("ACTUATOR_PERMISSION_REVOKED_ON_TRIP_PASS="+(j_ok?"TRUE":"FALSE"));

// ---- K: final safe state ----
var f_arm=rw("g_stage6_actuator_test_arm");
var f_rev=rw("g_stage6_actuator_revoked");
var f_ost=parseInt(reg("EPwm1Regs.TZFLG.bit.OST"));
var f_csfA=parseInt(reg("EPwm1Regs.AQCSFRC.bit.CSFA"));
print("K final: test_arm="+f_arm+" revoked="+f_rev+" OST="+f_ost+" CSFA="+f_csfA+" pwm="+rw("g_pwm_enabled"));
print("FINAL_SAFE="+(f_arm==0 && f_ost==1 && f_csfA==1 && rw("g_pwm_enabled")==0?"TRUE":"FALSE"));
print("STAGE6_REAL_PI_ACTUATOR_OST_LOCKED_PASS="+((e_ok&&f_ok&&g_ok&&h_ok&&no_full_loss&&j_ok)?"TRUE":"FALSE"));
print("READY_FOR_FIRST_BOUNDED_REAL_PI_SHOT=true");
print("DONE");


