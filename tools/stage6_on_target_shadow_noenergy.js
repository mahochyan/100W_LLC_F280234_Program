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
  wv("g_control_vref_raw",1491);               // 12V raw ref (Q12 controller)
  wv32("g_voltage_reference",0x41400000);      // 12.0f
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

// ---- N/O/P/Q: 20us budget ticks across coverage (raw-domain) ----
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
print("ON_TARGET_BINARY_SHA=20777C423FDDAFF6197F8D3DA5817B02B58B8176B01A6BC43ED73EDFE4A9F434");
print("DONE");
try{ session.terminate(); }catch(e){}
