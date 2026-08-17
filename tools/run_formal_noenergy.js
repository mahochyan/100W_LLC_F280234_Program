// FORMAL_SOFTSTART_NO_ENERGY_V1 — 正式 SoftStart 无能量验收（软件模拟 VOUT）
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
var env = ScriptingEnvironment.instance();
var server = env.getServer("DebugServer.1");
server.setConfig("D:\\1POWERlearning\\program_LLC\\LLC_100W_F28034_BRINGUP_DSH\\F28034.ccxml");
var session = server.openSession();
function addr(n){return session.expression.evaluate("&"+n);}
function rv(n){try{return ""+session.memory.readWord(1,addr(n));}catch(e){return "<f>";}}
function rv32(n){try{var a=addr(n);var lo=session.memory.readWord(1,a);var hi=session.memory.readWord(1,a+1);return ""+(lo|(hi<<16));}catch(e){return "<f>";}}
function wv(n,v){session.memory.writeWord(1,addr(n),v);}
function wv32(n,v){var a=addr(n);session.memory.writeWord(1,a,v&0xFFFF);session.memory.writeWord(1,a+1,(v>>>16)&0xFFFF);}
function reg(e){try{return ""+session.expression.evaluate(e);}catch(err){return "<f>";}}
session.target.connect();
try{session.target.halt();}catch(e){}
session.memory.loadProgram("D:\\1POWERlearning\\program_LLC\\LLC_100W_F28034_BRINGUP_DSH\\Debug\\LLC_100W_F28034_BRINGUP_DSH.out");
session.target.runAsynch();
java.lang.Thread.sleep(200);
session.target.halt();
// 前置：Stage4 + loopback（本板 Stage 4A 实板 PASS 过）+ no-energy
wv("g_bringup_stage",4);
wv("g_comp_tz_loopback_verified",1);   // 已实板验证（Stage 4A PASS），复位后 BSS 需重设
wv32("g_test_run_id",0x250C5000);      // no-energy run id
wv("g_softstart_acceptance_mode",1);
wv("g_softstart_no_energy",1);
wv("g_softstart_accept_target_raw",1244);
wv("g_softstart_hard_ceiling_raw",1491);
wv("g_no_energy_test_mode",1);        // 无能量：真实 ADC 非被测对象，抑制溢出误报
wv("g_softstart_result",0);
wv("g_softstart_request",0);
wv("g_diag_frequency_override",1);        // 250kHz/239 超出正式包络，诊断许可（与 shot_* 脚本一致）
wv("g_probe_scheduled_ost_occurred",0);
print("--- PRE ---");
print("accept_mode="+rv("g_softstart_acceptance_mode")
      +" target="+rv("g_softstart_accept_target_raw")+" ceiling="+rv("g_softstart_hard_ceiling_raw")
      +" override="+rv("g_diag_frequency_override"));
print("fault_pre="+rv("g_fault_flags")+" sysstate_pre="+rv("g_system_state"));
print("--- TRIGGER FORMAL SOFTSTART ---");
wv("g_softstart_request",1);
session.target.runAsynch();
var done = 0;
for (var i = 0; i < 300; i++) {   // up to ~6s
    java.lang.Thread.sleep(20);
    try {
        var r = parseInt(rv("g_softstart_result"));
        if (r != 0) { done = 1; break; }
    } catch (e) {}
}
session.target.halt();
print("done="+done);
print("result = " + rv("g_softstart_result"));
print("state = " + rv("g_softstart_state"));
print("stage = " + rv("g_softstart_stage"));
print("stage_index = " + rv("g_softstart_stage_index"));
print("cycle_count = " + rv32("g_softstart_cycle_count"));
print("final_cycles = " + rv("g_softstart_final_cycles"));
print("last_vout = " + rv("g_softstart_last_vout_raw"));
print("vout_max = " + rv("g_softstart_last_vout_max"));
print("stop_raw = " + rv("g_softstart_stop_raw"));
print("TBPRD = " + reg("EPwm1Regs.TBPRD"));
print("CMPA = " + reg("EPwm1Regs.CMPA.half.CMPA"));
print("CMPB = " + reg("EPwm1Regs.CMPB"));
print("DBRED = " + reg("EPwm1Regs.DBRED"));
print("DBFED = " + reg("EPwm1Regs.DBFED"));
print("soca = " + rv32("g_softstart_soca_count"));
print("eoc = " + rv32("g_softstart_eoc_count"));
print("miss = " + rv32("g_softstart_miss_count"));
print("consecutive = " + rv("g_softstart_consecutive_miss"));
print("stale = " + rv("g_softstart_stale_abort"));
print("fault = " + rv("g_fault_flags"));
print("adc_sample_counter = " + rv32("g_adc_sample_counter"));
print("adc_seq = " + rv32("g_adc_sample_sequence"));
print("ADCINTOVF = " + reg("AdcRegs.ADCINTOVF.all"));
print("ADCINTFLG = " + reg("AdcRegs.ADCINTFLG.all"));
print("INTSEL1N2 = " + reg("AdcRegs.INTSEL1N2.all"));
print("ETFLG = " + reg("EPwm1Regs.ETFLG.all"));
print("SOC0CTL = " + reg("AdcRegs.ADCSOC0CTL.all"));
print("TZ = " + reg("EPwm1Regs.TZFLG.all"));
print("pwm = " + rv("g_pwm_enabled"));
print("ost = " + reg("EPwm1Regs.TZFLG.bit.OST"));
print("run_id_at_arm = " + rv32("g_softstart_run_id_at_arm"));
print("run_id_at_stop = " + rv32("g_softstart_run_id_at_stop"));
session.target.disconnect();
print("DONE");
