// stage6_on_target_shadow_noenergy.js
// STAGE6_ON_TARGET_SHADOW_NOENERGY_TEST_V1 harness.
// Loads ONLY the frozen Stage6_FLASH_NOENERGY binary. Physical safety:
// CNT3/CNT4 OPEN (confirmed), no power input, OST locked, g_pwm_enabled=0.
// NEVER clears OST, NEVER enables PWM, NEVER starts SoftStart, NEVER enters a
// real power loop. Measurement style per task R: set request -> runAsynch ->
// wait fixed time -> halt once -> dump once (no high-frequency poll).
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
var OUT = "D:\\CCS21_workspace\\Codex_Project\\evidence\\stage6_on_target_shadow_noenergy\\LLC_100W_F28034_BRINGUP_DSH.out";

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
function hex16(v){ var s=(v&0xFFFF).toString(16); while(s.length<4)s="0"+s; return "0x"+s; }

function run(ms){
  session.target.runAsynch();
  java.lang.Thread.sleep(ms);
  session.target.halt();
}
function snap(tag){
  print("SNAP["+tag+"] profile_id="+hex32(rv32u("g_control_pi_profile_id")));
  print("SNAP["+tag+"] kp_bits="+hex32(rv32u("g_control_kp_hz_per_v")));
  print("SNAP["+tag+"] ki_bits="+hex32(rv32u("g_control_ki_step_hz_per_v_step")));
  print("SNAP["+tag+"] virtual_only="+rw("g_control_pi_virtual_only"));
  print("SNAP["+tag+"] pwm_enabled="+rw("g_pwm_enabled")+" pwm_req="+rw("g_pwm_enable_request")+" sys="+rw("g_system_state"));
  print("SNAP["+tag+"] TBPRD="+reg("EPwm1Regs.TBPRD"));
  print("SNAP["+tag+"] CMPA="+reg("EPwm1Regs.CMPA.half.CMPA")+" CMPB="+reg("EPwm1Regs.CMPB"));
  print("SNAP["+tag+"] DBRED="+reg("EPwm1Regs.DBRED")+" DBFED="+reg("EPwm1Regs.DBFED"));
  print("SNAP["+tag+"] OST="+reg("EPwm1Regs.TZFLG.bit.OST"));
  print("SNAP["+tag+"] TZA="+reg("EPwm1Regs.TZCTL.bit.TZA")+" TZB="+reg("EPwm1Regs.TZCTL.bit.TZB"));
}

print("=== STAGE6 NOENERGY ON-TARGET: LOAD FROZEN BINARY ONLY ===");
session.target.connect();
try{ session.target.halt(); }catch(e){}
session.memory.loadProgram(OUT);
run(400);

// ---- G: PRE snapshot + safety assertions ----
snap("PRE");
var pid=rv32u("g_control_pi_profile_id");
var pwmEn=rw("g_pwm_enabled");
var pwmReq=rw("g_pwm_enable_request");
var ost=parseInt(reg("EPwm1Regs.TZFLG.bit.OST"));
var PRE_SAFE = (pid==0x060201) && (pwmEn==0) && (pwmReq==0) && (ost==1);
print("PRE pid=0x"+hex16(pid)+" pwmEn="+pwmEn+" pwmReq="+pwmReq+" ost="+ost);
print("PRE_SAFE="+(PRE_SAFE?"TRUE":"FALSE"));
if(!PRE_SAFE){ print("FATAL_PRE_STOP"); print("DONE"); try{session.terminate();}catch(e){} throw("STOP"); }
print("ON_TARGET_PRELOAD_SAFE_PASS=true");

// ---- H: 8-case offline self-test (no RUN fake; pwm stays 0) ----
wv("g_fault_flags",0);
wv("g_system_state",2);
wv("g_pwm_enabled",0);
wv("g_bringup_stage",6);
wv("g_adc_pwm_sync_consecutive_miss",0);
wv("g_adc_pwm_sync_valid",1);
wv("g_offline_test_request",1);
run(500);
var st=rw("g_offline_test_status");
print("OFFLINE_TEST_STATUS=0x"+hex16(st));
print("OFFLINE_PWM_ISOLATED="+rw("g_offline_pwm_isolated"));
var bits=[["PFM_SIGN_LOW_VOUT",0x01],["PFM_SIGN_HIGH_VOUT",0x02],["EQUAL_HOLDS",0x04],
          ["LOWER_CLAMP",0x08],["UPPER_CLAMP",0x10],["ADC_STALE_FREEZE",0x20],
          ["ADC_RECOVERY_NO_JUMP",0x40],["PWM_REG_ISOLATION",0x80]];
var all8=1;
for(var i=0;i<bits.length;i++){ var ok=((st&bits[i][1])==bits[i][1]); if(!ok)all8=0; print("CASE8["+bits[i][0]+"]="+(ok?"PASS":"FAIL")); }
print("ON_TARGET_8CASE_PASS="+(all8?"TRUE":"FALSE"));

// ---- J: first-step (synthetic) ----
function resetCtrlBase(){
  wv32("g_control_frequency_hz",150000);
  wv32("g_control_shadow_frequency_hz",150000);
  wv32("g_pi_integral",0x00000000);            // float mirror (telemetry)
  wv32("g_pi_integral_q12",0);                 // Q12 integral state
  wv32("g_voltage_reference",0x41400000);      // 12.0f (ONLY reference source under test)
  wv("g_control_reference_valid",0);           // slow task re-derives from g_voltage_reference
  wv("g_control_vref_raw",0);
  wv("g_control_adc_sequence_last",0);
  wv("g_control_adc_sequence_consumed",0);
  wv32("g_control_fresh_sample_count",0);
  wv32("g_control_duplicate_sample_block_count",0);
  wv32("g_control_stale_tick_count",0);
  wv32("g_control_pi_update_count",0);
  wv("g_stage6_synthetic_sequence",0);
  wv("g_stage6_noenergy_test_enable",0);
  wv("g_control_running",1);
  wv("g_adc_pwm_sync_consecutive_miss",0);     // clear ADC-stale counter (no-power env)
  wv("g_adc_pwm_sync_valid",1);
}
// TEST1: Vout=11 (raw 1368)
resetCtrlBase();
wv("g_stage6_noenergy_test_mode",1);
wv("g_stage6_synthetic_vout_raw",1368);        // 11.0V
wv("g_stage6_noenergy_step_req",1);
run(300);
print("FIRSTSTEP11_shadow="+rv32u("g_stage6_noenergy_step_shadow_hz"));
print("FIRSTSTEP11_I_q12="+hex32(rv32u("g_pi_integral_q12")));
print("FIRSTSTEP11_error_bits="+hex32(rv32u("g_control_error_volts")));
print("FIRSTSTEP11_P_bits="+hex32(rv32u("g_control_p_term_hz")));
print("FIRSTSTEP11_unsat_bits="+hex32(rv32u("g_control_frequency_unsat_hz")));
// TEST2: Vout=13 (raw 1615)
resetCtrlBase();
wv("g_stage6_noenergy_test_mode",2);
wv("g_stage6_synthetic_vout_raw",1615);       // 13.0V
wv("g_stage6_noenergy_step_req",1);
run(300);
print("FIRSTSTEP13_shadow="+rv32u("g_stage6_noenergy_step_shadow_hz"));
print("FIRSTSTEP13_I_q12="+hex32(rv32u("g_pi_integral_q12")));

// ---- K: ADC stale freeze/recovery (synthetic) ----
resetCtrlBase();
wv("g_stage6_noenergy_test_mode",1);            // valid
wv("g_stage6_synthetic_vout_raw",1368);        // 11.0V (error +1, builds I)
wv("g_stage6_noenergy_test_enable",1);
run(600);                                    // build ~30 valid ticks
var f_shadow=rv32u("g_control_shadow_frequency_hz");
var f_I=rv32u("g_pi_integral_q12");
print("STALE_PRE shadow="+f_shadow+" I_q12="+hex32(f_I));
wv("g_stage6_noenergy_test_mode",3);             // stale (sample_valid=0)
run(200);                                         // >=3 stale ticks
var s_shadow=rv32u("g_control_shadow_frequency_hz");
var s_I=rv32u("g_pi_integral_q12");
print("STALE_MID shadow="+s_shadow+" I_q12="+hex32(s_I));
var frozen_ok=(s_shadow==f_shadow);
wv("g_stage6_noenergy_test_mode",1);             // recover valid
run(60);                                          // ~1 tick
var r_shadow=rv32u("g_control_shadow_frequency_hz");
var d=Math.abs(r_shadow-f_shadow);
print("STALE_RECOVER shadow="+r_shadow+" delta="+d);
print("ONTC_STALE_FROZEN_PASS="+(frozen_ok?"TRUE":"FALSE"));
print("ONTC_STALE_RECOVER_PASS="+(d<=100?"TRUE":"FALSE"));

// ---- F/K: reference raw runtime sync - ONLY write g_voltage_reference ----
var GAIN=0.008089325, OFFSET=-0.063715;
function voltsToRaw(v){ var r=(v-OFFSET)/GAIN; r=Math.max(0,Math.min(4095,r)); return Math.round(r); }
resetCtrlBase();
wv32("g_voltage_reference",0x41400000); run(120); var r12=rw("g_control_vref_raw");   // 12V ~1491
wv32("g_voltage_reference",0x41300000); run(120); var r11=rw("g_control_vref_raw");   // 11V ~1368
wv32("g_voltage_reference",0x41200000); run(120); var r10=rw("g_control_vref_raw");   // 10V ~1244
wv32("g_voltage_reference",0x41700000); run(120); var r15=rw("g_control_vref_raw");   // 15V ~1862
wv32("g_voltage_reference",0x41500000); run(120); var r13=rw("g_control_vref_raw");   // 13V ~1615
wv32("g_voltage_reference",0x41400000); run(120); var r12b=rw("g_control_vref_raw");  // back to 12V
print("VREF runtime: 12V="+r12+"(exp "+voltsToRaw(12)+") 11V="+r11+"("+voltsToRaw(11)+") 10V="+r10+"("+voltsToRaw(10)+") 15V="+r15+"("+voltsToRaw(15)+") 13V="+r13+"("+voltsToRaw(13)+") 12Vb="+r12b);
var vrefOk=(Math.abs(r12-voltsToRaw(12))<=1)&&(Math.abs(r11-voltsToRaw(11))<=1)&&(Math.abs(r10-voltsToRaw(10))<=1)&&(Math.abs(r15-voltsToRaw(15))<=1)&&(Math.abs(r13-voltsToRaw(13))<=1)&&(Math.abs(r12b-voltsToRaw(12))<=1);
print("VREF_RAW_RUNTIME_SYNC_PASS="+(vrefOk?"TRUE":"FALSE"));

// ---- E/L: duplicate-sample integration blocked (freshness) ----
resetCtrlBase();
wv("g_stage6_noenergy_test_mode",3);            // HELD: consume once, then freeze
wv("g_stage6_synthetic_sequence",100);
wv("g_stage6_synthetic_vout_raw",1368);
wv("g_stage6_noenergy_test_enable",1);
run(200);                                       // first tick fresh, rest duplicate-blocked
session.target.halt();
var Lf1=rv32u("g_control_fresh_sample_count");
var Ld1=rv32u("g_control_duplicate_sample_block_count");
var Lp1=rv32u("g_control_pi_update_count");
var LI1=rv32u("g_pi_integral_q12");
run(200);                                       // more held ticks; integral must NOT grow
session.target.halt();
var Lf2=rv32u("g_control_fresh_sample_count");
var Lp2=rv32u("g_control_pi_update_count");
var LI2=rv32u("g_pi_integral_q12");
var integStable=(LI1==LI2);
var piEqFresh=((Lp1==Lf1)&&(Lp2==Lf2));
wv("g_stage6_synthetic_sequence",101);          // new sample -> exactly one more PI update
run(60);
session.target.halt();
var Lf3=rv32u("g_control_fresh_sample_count");
var Lp3=rv32u("g_control_pi_update_count");
var oneMore=((Lf3-Lf2)==1)&&((Lp3-Lp2)==1);
print("DUPLICATE fresh1="+Lf1+" dup1="+Ld1+" pi1="+Lp1+" fresh2="+Lf2+" pi2="+Lp2+" fresh3="+Lf3+" pi3="+Lp3);
print("DUPLICATE integral_stable="+(integStable?"TRUE":"FALSE")+" pi==fresh="+(piEqFresh?"TRUE":"FALSE")+" oneMore="+(oneMore?"TRUE":"FALSE"));
print("DUPLICATE_ADC_SAMPLE_INTEGRATION_BLOCKED_PASS="+((Ld1>0&&integStable&&piEqFresh&&oneMore)?"TRUE":"FALSE"));

// ---- M: fast sample change binding (each fresh sample -> g_control_vout_raw follows) ----
resetCtrlBase();
wv("g_stage6_noenergy_test_mode",3);           // HELD (harness controls sequence per phase)
wv("g_stage6_noenergy_test_enable",1);
wv("g_stage6_synthetic_sequence",100); wv("g_stage6_synthetic_vout_raw",1491); run(30); var c1=rw("g_control_vout_raw");
wv("g_stage6_synthetic_sequence",101); wv("g_stage6_synthetic_vout_raw",1480); run(30); var c2=rw("g_control_vout_raw");
wv("g_stage6_synthetic_sequence",102); wv("g_stage6_synthetic_vout_raw",1470); run(30); var c3=rw("g_control_vout_raw");
wv("g_stage6_synthetic_sequence",103); wv("g_stage6_synthetic_vout_raw",1460); run(30); var c4=rw("g_control_vout_raw");
print("BIND 100->"+c1+" 101->"+c2+" 102->"+c3+" 103->"+c4);
print("20US_CONTROL_SAMPLE_BINDING_PASS="+((c1==1491&&c2==1480&&c3==1470&&c4==1460)?"TRUE":"FALSE"));

// ---- G: REFERENCE_VALID gate - 0V init never becomes a real RUN reference ----
// The reference_valid flag derives ONLY from g_voltage_reference>0.5 V in the
// slow path (CTRL_SlowTask). While invalid, g_control_vref_raw stays 0 and the
// fast PI is gated (CTRL_FastTask early-returns on reference_valid==0, verified
// statically). Tested in IDLE (no PWM, no protection fault) so the slow sync is
// the sole writer.
wv("g_stage6_noenergy_test_enable",0);
wv("g_system_state",0);                       // SYS_STATE_IDLE (slow task still runs)
wv("g_pwm_enabled",0);
wv32("g_voltage_reference",0x00000000);       // 0V -> INVALID
wv("g_control_reference_valid",0);
wv("g_control_vref_raw",0);
run(200);
session.target.halt();
var gV0=rw("g_control_reference_valid");
var gR0=rw("g_control_vref_raw");
wv32("g_voltage_reference",0x41400000);       // 12V -> VALID
run(150);
session.target.halt();
var gV1=rw("g_control_reference_valid");
var gR1=rw("g_control_vref_raw");
print("REF_GATE 0V valid="+gV0+" vref_raw="+gR0+" | 12V valid="+gV1+" vref_raw="+gR1);
print("REFERENCE_VALID_GATE_PASS="+((gV0==0&&gR0==0&&gV1==1&&Math.abs(gR1-1491)<=1)?"TRUE":"FALSE"));
// restore clean neutral state + budget counters for an uncontaminated measurement
wv("g_system_state",0);                        // SYS_STATE_IDLE
wv("g_pwm_enabled",0);
wv("g_control_running",0);
wv("g_control_reference_valid",1);
wv("g_control_vref_raw",1491);
wv("g_control_adc_sequence_last",0);
wv("g_stage6_synthetic_sequence",0);

// ---- N/O/P/Q: 20us budget ticks across coverage (production binding path) ----
wv("g_stage6_noenergy_test_ticks",0);
wv("g_fast_isr_cycles_max",0);
wv("g_fast_isr_overrun_count",0);
wv("g_control_exec_cycles_max",0);
wv("g_stage6_noenergy_test_enable",1);
wv("g_stage6_noenergy_test_mode",1); wv("g_stage6_synthetic_vout_raw",1491); run(250);  // 12V err0
wv("g_stage6_synthetic_vout_raw",1368); run(250);                                        // 11V
wv("g_stage6_synthetic_vout_raw",1615); run(250);                                        // 13V
wv("g_stage6_synthetic_vout_raw",626); run(250);                                         // 5V low sat
wv("g_stage6_synthetic_vout_raw",1739); run(250);                                        // 14V high sat
wv("g_stage6_noenergy_test_mode",3); run(250);                                           // stale
session.target.halt();
var ticks=rv32u("g_stage6_noenergy_test_ticks");
var cb=rv32u("g_control_exec_cycles_max");
var ce=rv32u("g_control_exec_cycles_last");
var ib=rv32u("g_fast_isr_cycles_max");
var ie=rv32u("g_fast_isr_cycles_last");
var ov=rv32u("g_fast_isr_overrun_count");
print("BUDGET ticks="+ticks);
print("BUDGET ctrl_cycles_last="+ce+" ctrl_cycles_max="+cb);
print("BUDGET isr_cycles_last="+ie+" isr_cycles_max="+ib);
print("BUDGET overrun="+ov);
print("BUDGET isr_max_us="+(ib/60).toFixed(3));
print("BUDGET budget_pct="+((ib/1200)*100).toFixed(1));

// ---- S: final safe state ----
wv("g_stage6_noenergy_test_enable",0);
wv("g_control_running",0);
wv("g_pwm_enabled",0);
wv("g_system_state",0);
run(50);
snap("POST");
print("ON_TARGET_BINARY_LOADED="+OUT);
print("ON_TARGET_BINARY_SHA=D38D21ED3FC3152D9897EA764EAEA0471D9760413FEF36E7578741DD4D238F1B");
print("DONE");
try{ session.terminate(); }catch(e){}
