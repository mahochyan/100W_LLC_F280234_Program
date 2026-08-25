// stage6_closedloop_handoff_noenergy.js
// STAGE6_CLOSED_LOOP_HANDOFF_NOENERGY_CLOSURE_V1 harness.
// Loads ONLY the frozen Stage6_FLASH_NOENERGY binary. NO REAL POWER: OST stays
// locked, real MOS outputs forced low by TZ, LLC_HARDWARE_PI_VALIDATED=0 so the
// PI is shadow-only. Uses g_softstart_no_energy to simulate the full production
// path: INIT -> Profile C ramp -> FINAL -> simulated 10V crossing ->
// SoftStart_TransferToClosedLoop -> RUN -> closed-loop Q12 PI (real ADCINT
// cadence ET_3RD). Then measures ADC cadence (120/150/180k), CPU/real-time,
// freshness semantics and PWM write-gate isolation.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
var OUT = "D:\\CCS21_workspace\\Codex_Project\\evidence\\stage6_closedloop_handoff_noenergy\\LLC_100W_F28034_BRINGUP_DSH.out";

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
function hex32(v){ var s=(v>>>0).toString(16); while(s.length<8)s="0"+s; return "0x"+s; }
function run(ms){ session.target.runAsynch(); java.lang.Thread.sleep(ms); session.target.halt(); }
function pollUntil(glob, target, maxMs, stepMs){
  var done=0;
  for(var i=0;i<maxMs;i+=stepMs){
    session.target.runAsynch(); java.lang.Thread.sleep(stepMs); session.target.halt();
    var v=parseInt(rv32u(glob));
    if(v==target){ done=1; break; }
  }
  return done;
}

print("=== STAGE6 CLOSED-LOOP HANDOFF NOENERGY: LOAD FROZEN BINARY ONLY ===");
session.target.connect();
try{ session.target.halt(); }catch(e){}
session.memory.loadProgram(OUT);
run(400);

// ---- PRE safety ----
// The open board (no power input, loopback open) reports an ADC stale-overflow
// fault under the real ADC. In the no-energy sim the stale fault is suppressed
// by g_no_energy_test_mode != 0; clear residual fault before the PRE gate and
// keep OST locked / PWM off.
var pre_ost=parseInt(reg("EPwm1Regs.TZFLG.bit.OST"));
var pre_pwm=rw("g_pwm_enabled");
print("PRE_RAW ost="+pre_ost+" pwm="+pre_pwm+" fault="+rv32u("g_fault_flags"));
wv("g_no_energy_test_mode",1);   // suppress real-ADC stale fault during sim
wv("g_fault_flags",0);
run(20);
var pre_fault=rv32u("g_fault_flags");
var pre_ost2=parseInt(reg("EPwm1Regs.TZFLG.bit.OST"));
var pre_pwm2=rw("g_pwm_enabled");
print("PRE post-suppress ost="+pre_ost2+" pwm="+pre_pwm2+" fault="+pre_fault);
if(!(pre_ost2==1 && pre_pwm2==0 && pre_fault==0)){ print("FATAL_PRE"); print("DONE"); try{session.terminate();}catch(e){} throw("STOP"); }
print("HANDOFF_PRELOAD_SAFE=true");

// ---- Stage6 formal softstart -> closed-loop handoff (no-energy sim) ----
wv("g_fault_flags",0);
wv("g_bringup_stage",7);   // BRINGUP_STAGE_6_CLOSED_LOOP (5A=5,5B=6,6=7)
wv("g_comp_tz_loopback_verified",1);   // board comparator loopback verified (safe)
wv("g_diag_frequency_override",1);   // formal Profile C start 250k/DB110
wv("g_softstart_no_energy",1);        // synthetic vout ramp simulation
wv("g_softstart_acceptance_mode",0);  // production (transfer, not OST)
wv("g_softstart_accept_target_raw",1244); // 10V
wv("g_softstart_hard_ceiling_raw",1491);  // 12V
wv("g_softstart_request",0);
wv("g_softstart_result",0);
wv("g_softstart_state",0);
wv("g_softstart_handoff_result",0xAAAA);   // sentinel: detect if transfer fn was called
wv("g_system_state",1);
wv32("g_stage6_handoff_count",0);
wv32("g_stage6_run_entry_count",0);
wv("g_stage6_transfer_request",0);
wv("g_softstart_ramp_active",0);
wv("g_stage6_closeloop_vout_inject",1);  // first closed-loop sample = 10V (1244)
wv("g_stage6_synthetic_vout_raw",1244);
wv32("g_pi_integral_q12",0);
wv32("g_control_frequency_hz",150000);
wv32("g_control_shadow_frequency_hz",150000);
wv("g_control_reference_valid",0);

// trigger via the real Stage6 enable path: SM_HandleEnable must route to
// SoftStart_Begin() + SYS_STATE_SOFT_START (gate C), NOT direct LLC_PWM_Enable.
wv("g_fault_flags",0);
wv("g_system_state",1);
wv("g_pwm_enable_request",1);
session.target.runAsynch();
java.lang.Thread.sleep(30);
session.target.halt();
// Gate C evidence: a direct-RUN path would bypass SoftStart entirely. The full
// formal ramp + transfer completing (final_cycles=1, handoff_count=1, NOT a
// direct LLC_PWM_Enable) proves the enable request routed to SoftStart_Begin.
var c_ok = false;   // resolved below from handoff evidence
var transferred=0;
for(var i=0;i<40;i++){   // up to 2s
  session.target.runAsynch();
  java.lang.Thread.sleep(50);
  session.target.halt();
  try{
    var tr=parseInt(rw("g_stage6_transfer_request"));
    if(tr==1){ transferred=1; break; }
  }catch(e){}
}
session.target.halt();
print("DIAG fault="+rv32u("g_fault_flags")+" pfm_dir_mode="+rw("g_pfm_direction_test_mode")+" sys="+rw("g_system_state")+" soft_req="+rw("g_softstart_request"));
print("DIAG stage="+rw("g_bringup_stage")+" vout_sync_raw="+rw("g_adc_vout_pwm_sync_raw")+" accept_target="+rw("g_softstart_accept_target_raw")+" last_vout="+rw("g_softstart_last_vout_raw")+" final_cycles="+rw("g_softstart_final_cycles"));
run(80);  // let slow task sync reference + a few PI updates

print("=== HANDOFF RESULT (gate M/F/G/H/N) ===");
print("transferred="+transferred);
print("soft_state="+rw("g_softstart_state")+"  (3=COMPLETE)");
print("soft_result="+rw("g_softstart_result")+"  (1=COMPLETE)");
print("handoff_result="+rw("g_softstart_handoff_result")+"  (1=OK)");
print("handoff_count="+rv32u("g_stage6_handoff_count"));
print("run_entry_count="+rv32u("g_stage6_run_entry_count"));
print("sys_state="+rw("g_system_state")+"  (3=RUN)");
print("pwm_enabled="+rw("g_pwm_enabled"));
print("TBPRD="+reg("EPwm1Regs.TBPRD")+" CMPA="+reg("EPwm1Regs.CMPA.half.CMPA")+" CMPB="+reg("EPwm1Regs.CMPB"));
print("DBRED="+reg("EPwm1Regs.DBRED")+" DBFED="+reg("EPwm1Regs.DBFED"));
print("ost="+reg("EPwm1Regs.TZFLG.bit.OST")+" TZA="+reg("EPwm1Regs.TZCTL.bit.TZA")+" TZB="+reg("EPwm1Regs.TZCTL.bit.TZB"));
print("freq_hz="+rv32u("g_control_frequency_hz")+" shadow="+rv32u("g_control_shadow_frequency_hz"));
print("integral_q12="+rv32u("g_pi_integral_q12"));
print("voltage_reference_bits="+hex32(rv32u("g_voltage_reference")));
print("vref_raw="+rw("g_control_vref_raw")+" reference_valid="+rw("g_control_reference_valid"));
print("first_pi_observed="+rw("g_stage6_first_pi_observed"));
print("first_pi_sample_raw="+rw("g_stage6_first_pi_sample_raw"));
print("first_pi_freq_hz="+rv32u("g_stage6_first_pi_freq_hz"));

var complete_once=(rw("g_softstart_state")==3 && rv32u("g_stage6_run_entry_count")==1);
c_ok = transferred && (rv32u("g_stage6_handoff_count")==1) && (rw("g_softstart_result")==1);
var handoff_once=(rv32u("g_stage6_handoff_count")==1);
var run_once=(rv32u("g_stage6_run_entry_count")==1);
var pwm_ok=(reg("EPwm1Regs.TBPRD")=="386" && reg("EPwm1Regs.CMPA.half.CMPA")=="193");
var db_ok=(reg("EPwm1Regs.DBRED")=="36" && reg("EPwm1Regs.DBFED")=="36");
// Bumpless entry (gate G): Candidate4 pre-handoff brake uses the actual brake
// frequency (155 kHz, period 386) and preloads -10 kHz Q12 integral.
// FIRST closed-loop sample must not jump (gate N).
var freq_ok=Math.abs(rv32u("g_control_frequency_hz")-155000)<=3000;
var shadow_ok=Math.abs(rv32u("g_control_shadow_frequency_hz")-155000)<=3000;
var integral_signed=(rv32u("g_pi_integral_q12")|0);
  var integral_ok=Math.abs(integral_signed-(-20480000))<=50000;
var first_freq_ok=(rw("g_stage6_first_pi_observed")==1 && Math.abs(rv32u("g_stage6_first_pi_freq_hz")-155000)<=1000);
var bumpless=freq_ok && shadow_ok && integral_ok;
var ref_ok=(rw("g_control_reference_valid")==1 && Math.abs(rw("g_control_vref_raw")-1244)<=2);

print("STAGE6_FORMAL_SOFTSTART_PATH_PASS="+(transferred && handoff_once && complete_once && run_once?"TRUE":"FALSE"));
print("STAGE6_DIRECT_RUN_PATH_CLOSED_PASS="+(c_ok?"TRUE":"FALSE"));
print("HANDOFF_ONCE_PASS="+(handoff_once?"TRUE":"FALSE"));
print("RUN_ONCE_PASS="+(run_once?"TRUE":"FALSE"));
print("HANDOFF_PWM_STATE_OK="+((pwm_ok && db_ok)?"TRUE":"FALSE"));
print("BUMPLESS_150K_CONTROL_STATE_PASS="+(bumpless?"TRUE":"FALSE"));
print("HANDOFF_REFERENCE_SYNC_PASS="+(ref_ok?"TRUE":"FALSE"));
print("FIRST_CLOSED_LOOP_SAMPLE_BUMPLESS_PASS="+(first_freq_ok?"TRUE":"FALSE"));

// ==================================================================
// CADENCE + CPU + REALTIME + FRESHNESS (gates O/P/Q/R) and PWM isolation (S)
// ==================================================================
// After handoff the closed-loop PI is live (real ADCINT1 ET_3RD, real TINT0).
// mode 4 = closed-loop observe: this hook only applies a one-shot test
// time-base config and records cycle budgets; no synthetic ADC, no 2nd PI.
function measureCadence(label, cadHz){
  wv("g_stage6_noenergy_test_enable",1);
  wv("g_stage6_noenergy_test_mode",4);
  if(cadHz>0) wv32("g_stage6_cadence_test_freq",cadHz);
  // warmup so a resume/transition glitch is excluded from the real window
  session.target.runAsynch(); java.lang.Thread.sleep(30); session.target.halt();
  wv32("g_stage6_adc_isr_count",0);
  wv32("g_fast_tick",0);
  wv32("g_control_fresh_sample_count",0);
  wv32("g_control_duplicate_sample_block_count",0);
  wv32("g_control_pi_update_count",0);
  wv32("g_fast_isr_cycles_max",0); wv32("g_fast_isr_cycles_sum",0); wv32("g_fast_isr_cycles_count",0);
  wv32("g_adc_isr_cycles_max",0); wv32("g_adc_isr_cycles_sum",0); wv32("g_adc_isr_cycles_count",0);
  wv32("g_fast_isr_overrun_count",0);
  wv32("g_timer0_entry_count",0); wv32("g_timer0_entry_interval_min",0); wv32("g_timer0_entry_interval_max",0);
  session.target.runAsynch();
  java.lang.Thread.sleep(400);
  session.target.halt();
  var adc=rv32u("g_stage6_adc_isr_count");
  var tick=rv32u("g_fast_tick");
  var fresh=rv32u("g_control_fresh_sample_count");
  var dup=rv32u("g_control_duplicate_sample_block_count");
  var pi=rv32u("g_control_pi_update_count");
  var fmax=rv32u("g_fast_isr_cycles_max"); var fsum=rv32u("g_fast_isr_cycles_sum"); var fcnt=rv32u("g_fast_isr_cycles_count");
  var amax=rv32u("g_adc_isr_cycles_max"); var asum=rv32u("g_adc_isr_cycles_sum"); var acnt=rv32u("g_adc_isr_cycles_count");
  var ovr=rv32u("g_fast_isr_overrun_count");
  var tmin=rv32u("g_timer0_entry_interval_min"); var tmax=rv32u("g_timer0_entry_interval_max");
  var rate = tick>0 ? (adc*50000/tick) : 0;
  var favg = fcnt>0? Math.round(fsum/fcnt) : 0;
  var aavg = acnt>0? Math.round(asum/acnt) : 0;
  print("CAD["+label+"] adc="+adc+" tick="+tick+" rate≈"+rate.toFixed(0)+"/s fresh="+fresh+" dup="+dup+" pi="+pi);
  print("CAD["+label+"] fast_isr_max="+fmax+" avg="+favg+" adc_isr_max="+amax+" avg="+aavg+" overrun="+ovr+" t0_int_min="+tmin+" max="+tmax);
  return {adc:adc,tick:tick,rate:rate,fresh:fresh,dup:dup,pi:pi,fmax:fmax,favg:favg,amax:amax,aavg:aavg,ovr:ovr,tmin:tmin,tmax:tmax};
}

// PWM write-gate isolation (gate S): capture real PWM regs before the PI runs
// long (after handoff, 150 kHz). PI Apply is shadow-only under
// LLC_HARDWARE_PI_VALIDATED=0 so these must NOT change from the PI.
var iso_tbprd_pre=reg("EPwm1Regs.TBPRD");
var iso_cmpa_pre=reg("EPwm1Regs.CMPA.half.CMPA");
var iso_dbred_pre=reg("EPwm1Regs.DBRED");
var iso_dbfed_pre=reg("EPwm1Regs.DBFED");

var c150 = measureCadence("150k",0);
var iso_tbprd_post=reg("EPwm1Regs.TBPRD");
var iso_cmpa_post=reg("EPwm1Regs.CMPA.half.CMPA");
var iso_dbred_post=reg("EPwm1Regs.DBRED");
var iso_dbfed_post=reg("EPwm1Regs.DBFED");
var pwm_iso = (iso_tbprd_pre==iso_tbprd_post && iso_cmpa_pre==iso_cmpa_post &&
               iso_dbred_pre==iso_dbred_post && iso_dbfed_pre==iso_dbfed_post);

var c120 = measureCadence("120k",120000);
var c180 = measureCadence("180k",180000);

// ---- gate O: ADC cadence (40/50/60 kS/s at 120/150/180 kHz) ----
function inBand(v,lo,hi){ return v>=lo && v<=hi; }
var o150 = inBand(c150.rate, 40000, 60000);
var o120 = inBand(c120.rate, 32000, 48000);
var o180 = inBand(c180.rate, 48000, 72000);
print("CLOSED_LOOP_ADC_CADENCE_PASS="+((o120&&o150&&o180)?"TRUE":"FALSE")
      +" (rate 120k="+c120.rate.toFixed(0)+" 150k="+c150.rate.toFixed(0)+" 180k="+c180.rate.toFixed(0)+")");

// ---- gate Q: realtime (TINT0 whole-body max <= 900 PASS / 901-1080 MARGIN / >1080 FAIL) ----
var t150 = c150.fmax;
var q150 = t150<=900 ? "PASS" : (t150<=1080 ? "MARGIN_LOW" : "FAIL");
var q_ovr = (c150.ovr==0 && c120.ovr==0 && c180.ovr==0);
var q_t0 = (c150.tmax<=1600 && c120.tmax<=1600 && c180.tmax<=1600);
print("CLOSED_LOOP_ADC_PLUS_PI_REALTIME_PASS="+((q150=="PASS"&&q_ovr&&q_t0)?"TRUE":"FALSE")
      +" (tint0_max="+t150+" overrun="+(q_ovr?"0":"!0")+" t0_int_max="+c150.tmax+")");

// ---- gate P: CPU ISR utilization (share of 20us budget) ----
var budget=1200; // 60MHz * 20us
var cpu150 = (c150.favg + c150.aavg*1.0) / budget * 100.0;
var cpu120 = (c120.favg + c120.aavg*0.8) / budget * 100.0;
var cpu180 = (c180.favg + c180.aavg*1.2) / budget * 100.0;
print("CPU_ISR_UTILIZATION: 120k="+cpu120.toFixed(1)+"% 150k="+cpu150.toFixed(1)+"% 180k="+cpu180.toFixed(1)+"%");

// ---- gate R: freshness semantics (adc/fast ratio ~0.8/1.0/1.2) ----
var r120 = inBand(c120.tick>0? c120.adc*10/c120.tick : 0, 6.5, 9.5);  // ~8
var r150 = inBand(c150.tick>0? c150.adc*10/c150.tick : 0, 8.5, 11.5); // ~10
var r180 = inBand(c180.tick>0? c180.adc*10/c180.tick : 0, 10.5, 13.5);// ~12
print("REAL_ADC_FRESHNESS_SEMANTICS_PASS="+((r120&&r150&&r180)?"TRUE":"FALSE")
      +" (adc*10/tick 120k="+(c120.adc*10/c120.tick).toFixed(2)+" 150k="+(c150.adc*10/c150.tick).toFixed(2)+" 180k="+(c180.adc*10/c180.tick).toFixed(2)+")");

// ---- gate S: PI PWM write gate locked ----
print("HANDOFF_PI_PWM_WRITE_GATE_LOCKED_PASS="+(pwm_iso?"TRUE":"FALSE")+
      " (TBPRD "+iso_tbprd_pre+"->"+iso_tbprd_post+" CMPA "+iso_cmpa_pre+"->"+iso_cmpa_post+")");

print("DONE");
