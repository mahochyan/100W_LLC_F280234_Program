// W2 candidate3: on-target no-energy proof of the 160 kHz handoff brake.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_FLASH_SHOT_NOENERGY\\LLC_100W_F28034_BRINGUP_DSH.out";
var env=ScriptingEnvironment.instance();
var server=env.getServer("DebugServer.1");
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();

function addr(n){ return session.expression.evaluate("&"+n); }
function rw(n){ return session.memory.readWord(1,addr(n)); }
function rv32u(n){ var a=addr(n),lo=session.memory.readWord(1,a),hi=session.memory.readWord(1,a+1); return (lo|(hi<<16))>>>0; }
function rv32s(n){ var v=rv32u(n); return v>0x7fffffff?v-0x100000000:v; }
function wv(n,v){ session.memory.writeWord(1,addr(n),v); }
function wv32(n,v){ var a=addr(n); session.memory.writeWord(1,a,v&0xffff); session.memory.writeWord(1,a+1,(v>>>16)&0xffff); }
function reg(e){ return parseInt(session.expression.evaluate(e)); }
function run(ms){ session.target.runAsynch(); java.lang.Thread.sleep(ms); session.target.halt(); }
function check(name,ok){ print(name+"="+(ok?"TRUE":"FALSE")); if(!ok) failures++; }

var failures=0;
print("=== SOL W2 HANDOFF BRAKE NOENERGY ===");
session.target.connect();
try{session.target.halt();}catch(e){}
session.memory.loadProgram(OUT);
run(400);

// Establish the same safe no-energy conditions as the qualified Stage6 test.
wv("g_no_energy_test_mode",1);
wv("g_fault_flags",0);
run(20);
check("PRE_OST_LOCKED",reg("EPwm1Regs.TZFLG.bit.OST")==1);
check("PRE_PWM_DISABLED",rw("g_pwm_enabled")==0);
check("PRE_FAULT_CLEAR",rv32u("g_fault_flags")==0);
if(failures){ print("SOL_W2_HANDOFF_BRAKE_NOENERGY_PASS=FALSE"); try{session.terminate();}catch(e){} throw("PRE_GATE"); }

wv("g_bringup_stage",7);
wv("g_comp_tz_loopback_verified",1);
wv("g_diag_frequency_override",1);
wv("g_softstart_no_energy",1);
wv("g_softstart_acceptance_mode",0);
wv("g_softstart_accept_target_raw",1244);
wv("g_softstart_hard_ceiling_raw",1491);
wv("g_softstart_request",0);
wv("g_softstart_result",0);
wv("g_softstart_state",0);
wv("g_softstart_handoff_result",0xaaaa);
wv("g_system_state",1);
wv32("g_stage6_handoff_count",0);
wv32("g_stage6_run_entry_count",0);
wv("g_stage6_transfer_request",0);
wv("g_softstart_ramp_active",0);
wv("g_stage6_closeloop_vout_inject",1);
wv("g_stage6_synthetic_vout_raw",1244);
wv32("g_pi_integral_q12",0);
wv32("g_control_frequency_hz",150000);
wv32("g_control_shadow_frequency_hz",150000);
wv("g_control_reference_valid",0);
wv("g_fault_flags",0);
wv("g_pwm_enable_request",1);

var transferred=0;
for(var i=0;i<50;i++){
  run(50);
  if(rw("g_stage6_transfer_request")==1){ transferred=1; break; }
}
run(20);

var tbprd=reg("EPwm1Regs.TBPRD");
var cmpa=reg("EPwm1Regs.CMPA.half.CMPA");
var cmpb=reg("EPwm1Regs.CMPB");
var dbred=reg("EPwm1Regs.DBRED");
var dbfed=reg("EPwm1Regs.DBFED");
var socaprd=reg("EPwm1Regs.ETPS.bit.SOCAPRD");
var freq=rv32u("g_control_frequency_hz");
var shadow=rv32u("g_control_shadow_frequency_hz");
var integral=rv32s("g_pi_integral_q12");
var firstfreq=rv32u("g_stage6_first_pi_freq_hz");

print("OBS transferred="+transferred+" tbprd="+tbprd+" cmpa="+cmpa+" cmpb="+cmpb+
      " db="+dbred+"/"+dbfed+" socaprd="+socaprd);
print("OBS freq="+freq+" shadow="+shadow+" integral="+integral+" firstfreq="+firstfreq+
      " fault="+rv32u("g_fault_flags")+" ost="+reg("EPwm1Regs.TZFLG.bit.OST"));

check("FORMAL_TRANSFER_ONCE",transferred==1 && rv32u("g_stage6_handoff_count")==1 && rv32u("g_stage6_run_entry_count")==1);
check("HANDOFF_OK",rw("g_softstart_handoff_result")==1 && rw("g_softstart_state")==3 && rw("g_system_state")==3);
check("BRAKE_PWM_STATE",tbprd==374 && cmpa==187 && cmpb==93 && dbred==36 && dbfed==36);
check("CLOSED_LOOP_ET3_RESTORED",socaprd==3);
check("BRAKE_CONTROL_STATE",Math.abs(freq-160000)<=500 && Math.abs(shadow-160000)<=500);
check("BRAKE_INTEGRAL_STATE",Math.abs(integral+40960000)<=250000);
check("FIRST_PI_BUMPLESS",rw("g_stage6_first_pi_observed")==1 && Math.abs(firstfreq-160000)<=500);
check("REFERENCE_PRIMED",rw("g_control_reference_valid")==1 && Math.abs(rw("g_control_vref_raw")-1244)<=2);
check("NOENERGY_REMAINS_SAFE",reg("EPwm1Regs.TZFLG.bit.OST")==1 && rv32u("g_fault_flags")==0);

print("SOL_W2_HANDOFF_BRAKE_NOENERGY_PASS="+(failures==0?"TRUE":"FALSE"));
try{session.terminate();}catch(e){}
if(failures) throw("FAILURES="+failures);
