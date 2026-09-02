// W2_CONTROL_REGION_REDESIGN_V1 - Burst region model no-energy verification.
// Binary: NE build (Stage6_OL_STEADY_NE) - OST clamped, PWM never enabled,
// the BR model is counters-only (no register actuation in v1).
// Scenarios (work order sections 1-4/7):
//  S-B0 boot/params, S-B1 entry (Fmax + Vout>Vref+hyst + persistence),
//  S-B2 debounce (transient does not enter), S-B3 min RUN dwell,
//  S-B4 hysteresis no-flap, S-B5 packet/coast cycling,
//  S-B6 Vref genericity (12 V), S-B7 handoff eval (both branches),
//  S-B8 fault passthrough + recovery.
// The 20 us TINT0 tick advances the model; 1 BR tick = 1 fresh sample (NE
// abstraction, documented; the REAL binding is the fresh ADC cadence).
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_OL_STEADY_NE\\LLC_100W_F28034_OPEN_LOOP_STEADY_NE.out";
var gPass=0, gFail=0;
function chk(name,cond,detail){ print("ASSERT "+name+": "+(cond?"PASS":"FALSE")+(detail?(" ("+detail+")"):"")); if(cond){gPass++;}else{gFail++;} }

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

session.target.connect();
try{session.target.halt();}catch(e){}
session.memory.loadProgram(OUT);
run(300);

/* ---------- boot gates (OL untouched: OL NE enable stays 0) ---------- */
gate("INIT_SYS_IDLE", rw("g_system_state")===1);
gate("INIT_PWM_OFF", rw("g_pwm_enabled")===0);
gate("INIT_FAULT_ZERO", rv32u("g_fault_flags")===0);
gate("INIT_OST_LATCHED", reg("EPwm1Regs.TZFLG.bit.OST")===1);
gate("BR_TICKS_ADVANCING", rv32u("g_br_tick_count")>0);
gate("BR_IDLE_AT_BOOT", rw("g_br_state")===0);
gate("OL_NE_DISABLEDCLEAN", rw("g_open_loop_ne_test_enable")===0 && rw("g_open_loop_steady_active")===0);

/* ---------- S-B0 params (10 V reference, production Fmax) ---------- */
wv("g_br_enable",0);
wv("g_br_vref_raw",1236);            /* ~10.00 V */
wv32("g_br_fmax_hz",170000);         /* frozen production Fmax */
wv32("g_br_freq_command_hz",150000);
wv("g_br_v_entry_hyst_raw",25);      /* ~0.20 V */
wv("g_br_v_exit_hyst_raw",25);
wv("g_br_entry_persist_n",25);       /* 0.5 ms */
wv("g_br_min_run_dwell_ticks",2500); /* 50 ms */
wv("g_br_run_pfm_return_n",500);     /* 10 ms */
wv("g_br_packet_cycles",2);
wv32("g_br_packet_freq_hz",150000);
wv("g_br_vout_rising",0);
print("S-B0 params written (vref 10V, Fmax 170k, packet 2 cycles)");

/* enable -> RUN_PFM (min dwell starts) */
wv("g_br_enable",1); run(5);
chk("S-B0 ENABLE_TO_RUN_PFM", rw("g_br_state")===1, "state="+rw("g_br_state"));

/* ---------- S-B3 min dwell + S-B1 entry ---------- */
/* entry conditions true immediately, but run_ticks < 2500 -> no entry */
wv32("g_br_freq_command_hz",170000);
wv("g_br_vout_raw",1300);
run(20);
chk("S-B3 DWELL_BLOCKS_ENTRY", rw("g_br_state")===1,
    "state="+rw("g_br_state")+" rejects="+rw("g_br_entry_debounce_rejects"));
chk("S-B3 DEBOUNCE_COUNTER", rw("g_br_entry_debounce_rejects")>0);
/* keep conditions until persistence elapses (25 ticks) after dwell */
run(50);
var st1=rw("g_br_state");
chk("S-B1 ENTRY_FIRED", st1>=2 && st1<=4, "state="+st1+
    " last_vout="+rv32u("g_br_last_entry_vout_raw")+" packets="+rw("g_br_packets_emitted"));
chk("S-B1 ENTRY_SNAPSHOT", rv32u("g_br_last_entry_vout_raw")===1300);
run(5);   /* packet (2 ticks) completes -> BURST_OFF */
chk("S-B1 PACKET_DONE_COAST", rw("g_br_state")===4 && rw("g_br_packets_emitted")===1,
    "state="+rw("g_br_state")+" packets="+rw("g_br_packets_emitted"));

/* ---------- S-B4 hysteresis no-flap: vout inside dead band ---------- */
wv("g_br_vout_raw",1236);   /* == vref: inside [1211,1261] */
run(8);
chk("S-B4 NO_FLAP_IN_BAND", rw("g_br_state")===4 && rw("g_br_packets_emitted")===1,
    "packets="+rw("g_br_packets_emitted")+" coast="+rw("g_br_coast_ticks"));

/* ---------- S-B5 packet/coast cycling (plant injection emulated) ---------- */
/* NE note: the synthetic vout does not respond to packets; the harness
 * emulates the plant (a packet injects energy -> vout rises above the band),
 * which is exactly the closed envelope loop of work order section 7. */
var pk0=rw("g_br_packets_emitted");
wv("g_br_vout_raw",1200);   /* below vref-exit (1211) -> a packet fires */
run(1);
chk("S-B5 PACKET_REFIRED", rw("g_br_packets_emitted")>pk0 && rw("g_br_state")>=3,
    "pk0="+pk0+" pk="+rw("g_br_packets_emitted")+" state="+rw("g_br_state"));
wv("g_br_vout_raw",1300);   /* plant response: vout back above the band */
run(4);
chk("S-B5 BACK_TO_COAST", rw("g_br_state")===4, "state="+rw("g_br_state"));
var pkH=rw("g_br_packets_emitted");
run(10);
chk("S-B5 COAST_HOLDS_HIGH", rw("g_br_state")===4 && rw("g_br_packets_emitted")===pkH,
    "packets="+rw("g_br_packets_emitted")+" expected="+pkH);

/* ---------- S-B2 debounce: transient overshoot does not enter ---------- */
/* return to RUN_PFM: vout INSIDE the band (no packet demand) and the demand
 * below Fmax sustained >= run_pfm_return_n ticks. Design note: the return
 * branch requires the vout NOT below the packet band (packets have priority
 * while the envelope demands energy). */
wv32("g_br_freq_command_hz",160000);
wv("g_br_vout_raw",1236);
run(15);
chk("S-B2 RETURN_TO_RUN_PFM", rw("g_br_state")===1, "state="+rw("g_br_state"));
/* ---------- S-B2 debounce/persistence gate ---------- */
/* The production persistence window (25 ticks = 0.5 ms) is BELOW the DSS
 * run() slice resolution, so the gate is proven by scaling the (host-writable
 * by design) parameter: with entry_persist_n = 2500 a 3 ms overshoot must NOT
 * enter; restoring 25 must let the same condition enter. S-B3 already proved
 * the complementary min-dwell gate. */
run(60);   /* let the re-entry dwell elapse at freq=160k, vout=1236 */
var rej0=rw("g_br_entry_debounce_rejects");
wv("g_br_entry_persist_n",2500);       /* scaled persistence: 50 ms */
wv32("g_br_freq_command_hz",170000);
wv("g_br_vout_raw",1300);
run(3);
chk("S-B2 PERSISTENCE_BLOCKS_TRANSIENT", rw("g_br_state")===1,
    "state="+rw("g_br_state")+" rejects0="+rej0+" rejects="+rw("g_br_entry_debounce_rejects"));
chk("S-B2 PERSIST_ACCUMULATED", (function(){var m=rw("g_br_persist_max");return m>0 && m<2500;})(),
    "persist_max="+rw("g_br_persist_max")+" (accumulated past 0, below the 2500 gate; DSS halt latency widens the window)");
wv("g_br_vout_raw",1200);              /* drop the condition: persist resets */
run(2);
wv("g_br_entry_persist_n",25);         /* restore production persistence */
wv("g_br_vout_raw",1300);
run(8);
chk("S-B2 ENTRY_AFTER_PERSIST_RESTORE", rw("g_br_state")>=2 && rw("g_br_state")<=4,
    "state="+rw("g_br_state"));
/* leave Burst cleanly for S-B6: vout in band + demand below Fmax */
wv32("g_br_freq_command_hz",160000);
wv("g_br_vout_raw",1236);
run(15);

/* ---------- S-B6 Vref genericity (12 V) ---------- */
wv("g_br_enable",0); run(2);           /* clean IDLE reset */
wv("g_br_vref_raw",1483);              /* ~12.00 V */
wv32("g_br_freq_command_hz",160000);
wv("g_br_vout_raw",1300);
wv("g_br_enable",1); run(2);           /* -> RUN_PFM */
run(60);                               /* dwell elapses at the 12 V reference */
chk("S-B6 RUN_PFM_12V", rw("g_br_state")===1, "state="+rw("g_br_state"));
run(5);
chk("S-B6 BELOW_12V_STAYS_RUN", rw("g_br_state")===1, "state="+rw("g_br_state")+
    " (RUN_PFM never emits packets)");
wv("g_br_vout_raw",1520);              /* above 12V+0.2V with Fmax -> entry */
wv32("g_br_freq_command_hz",170000);
run(20);
chk("S-B6 ENTRY_12V_FIRED", rw("g_br_state")>=2 && rw("g_br_state")<=4 &&
    rv32u("g_br_last_entry_vout_raw")===1520,
    "state="+rw("g_br_state")+" last="+rv32u("g_br_last_entry_vout_raw"));

/* ---------- S-B7 handoff evaluation (both branches) ---------- */
wv("g_br_enable",0); run(2);            /* IDLE reset */
wv("g_br_vref_raw",1236);               /* 10 V */
wv32("g_br_freq_command_hz",170000); wv("g_br_vout_raw",1300); wv("g_br_vout_rising",1);
wv("g_br_enable",1); run(2);            /* -> RUN_PFM */
var pkB=rw("g_br_packets_emitted");
wv("g_br_handoff_request",1); run(2);
chk("S-B7 HANDOFF_TO_BURST_PREP", rw("g_br_state")>=2 && rw("g_br_state")<=4 &&
    rw("g_br_packets_emitted")>=pkB+1,
    "state="+rw("g_br_state")+" pkB="+pkB+" pk="+rw("g_br_packets_emitted"));
wv("g_br_enable",0); run(2);            /* reset */
wv32("g_br_freq_command_hz",150000); wv("g_br_vout_raw",1180); wv("g_br_vout_rising",0);
wv("g_br_enable",1); run(2);
wv("g_br_handoff_request",1); run(2);
chk("S-B7 HANDOFF_TO_RUN_PFM", rw("g_br_state")===1, "state="+rw("g_br_state"));

/* ---------- S-B8 fault passthrough + recovery ---------- */
wv32("g_fault_flags",1); run(2);
chk("S-B8 FAULT_DOMINATES", rw("g_br_state")===5, "state="+rw("g_br_state"));
wv32("g_fault_flags",0); run(2);
chk("S-B8 RECOVER_RUN_PFM", rw("g_br_state")===1, "state="+rw("g_br_state"));

/* ---------- end state ---------- */
wv("g_br_enable",0); run(2);
gate("END_PWM_OFF", rw("g_pwm_enabled")===0);
gate("END_OST_LATCHED", reg("EPwm1Regs.TZFLG.bit.OST")===1);
gate("END_TZINT_ZERO", reg("EPwm1Regs.TZFLG.bit.INT")===0);
gate("END_FAULT_ZERO", rv32u("g_fault_flags")===0);
gate("END_SYS_NOT_FAULT", rw("g_system_state")!==4);

print("=== BURST REGION NE SUMMARY ===");
print("PASS="+gPass+" FALSE="+gFail);
if(gFail>0){ throw "burst-region-ne-verification-failed"; }
print("BURST_REGION_NE_VERIFICATION_PASS");