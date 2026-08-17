// FORMAL_SOFTSTART_STAGE5_ACCEPTANCE_V1 — 单发实板 10V 验收射击（RUN_ID 0x250C5001）
// 前置：Vin 24.0V / 限流 0.20A / CNT3-CNT4 连接 / VOUT 已完全放电 / 冷启动
// 预状态校验（用户规则）：fault=0, pwm=0, ost=1（TZFLG OST 锁存 = 输出安全低）
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
// 前置：Stage4 + loopback + 诊断许可 + 验收模式（真实 ADC，无能量仿真关闭）
wv("g_bringup_stage",4);
wv("g_comp_tz_loopback_verified",1);
wv("g_diag_frequency_override",1);
wv32("g_test_run_id",0x250C5001);
wv("g_softstart_acceptance_mode",1);
wv("g_softstart_no_energy",0);
wv("g_softstart_accept_target_raw",1244);      // 校准 10V
wv("g_softstart_hard_ceiling_raw",1491);       // 校准 12V 硬顶
wv("g_softstart_result",0);
wv("g_softstart_request",0);
wv("g_probe_scheduled_ost_occurred",0);
print("--- PRE-STATE VERIFY (user rule: fault=0, pwm=0, ost=1) ---");
var pre_fault = parseInt(rv("g_fault_flags"));
var pre_pwm   = parseInt(rv("g_pwm_enabled"));
var pre_ost   = parseInt(reg("EPwm1Regs.TZFLG.bit.OST"));
print("fault="+pre_fault+" pwm="+pre_pwm+" ost="+pre_ost
      +" sysstate="+rv("g_system_state")+" TZ="+reg("EPwm1Regs.TZFLG.all"));
if (pre_fault != 0 || pre_pwm != 0 || pre_ost != 1) {
    print("*** PRE-STATE VIOLATION — ABORT, DO NOT FIRE ***");
    session.target.disconnect();
    print("DONE");
    quit();
}
print("PRE-STATE OK — single real shot armed");
print("--- TRIGGER FORMAL SOFTSTART (REAL POWER) ---");
wv("g_softstart_request",1);
session.target.runAsynch();
var done = 0;
for (var i = 0; i < 500; i++) {   // up to 10s
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
print("TZ = " + reg("EPwm1Regs.TZFLG.all"));
print("pwm = " + rv("g_pwm_enabled"));
print("ost = " + reg("EPwm1Regs.TZFLG.bit.OST"));
print("run_id_at_arm = " + rv32("g_softstart_run_id_at_arm"));
print("run_id_at_stop = " + rv32("g_softstart_run_id_at_stop"));
print("sched_ost = " + rv("g_probe_scheduled_ost_occurred"));
print("truth_runtime_raw = " + rv("g_truth_runtime_raw"));
print("truth_runtime_tbctr = " + rv("g_truth_runtime_tbctr"));
print("abort_reason = " + rv("g_softstart_abort_reason"));
var res = parseInt(rv("g_softstart_result"));
if (res == 2) print("*** FORMAL_SOFTSTART_10V_REAL_POWER_PASS ***");
else print("*** RESULT != ACCEPT_TARGET — REVIEW ***");
session.target.disconnect();
print("DONE");
