// V12 XDS100v2 quiet-link qualification with the no-energy image.
// The target is deliberately left running behind a latched OST for 205 s.
// Host traffic during that interval is exactly two bounded isHalted queries
// (at 70 s and 205 s). The only active halt is explicitly NE-only, after the
// protocol interval, so final target-clock and safety evidence can be read.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);

var OUT="D:\\CCS21_workspace\\Codex_Project\\Stage6_OL_STEADY_NE\\LLC_100W_F28034_OPEN_LOOP_STEADY_NE.out";
var EXPECTED_SHA="EBD0AAC8AEEF84AF672AA5BE0F4DC05045B55737D4C82855B24B8DF1C9E83B53";
var QUIET_FIRST_NS=70000000000;
var QUIET_FINAL_NS=205000000000;

function sha256File(path){
  var md=MessageDigest.getInstance("SHA-256"),fis=new FileInputStream(path);
  var buf=java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE,8192),n;
  while((n=fis.read(buf))>0){md.update(buf,0,n);}fis.close();
  var d=md.digest(),sb=new StringBuilder();
  for(var i=0;i<d.length;i++){
    var h=(d[i]&0xff).toString(16);if(h.length<2)h="0"+h;sb.append(h.toUpperCase());
  }
  return sb.toString();
}
function nowNs(){return Number(java.lang.System.nanoTime());}
function sleepUntil(deadlineNs){
  var ms=Math.ceil((deadlineNs-nowNs())/1000000.0);
  if(ms>0)java.lang.Thread.sleep(ms);
}

var env=ScriptingEnvironment.instance(),server=env.getServer("DebugServer.1");
env.setScriptTimeout(30000);
server.setConfig("D:\\CCS21_workspace\\Codex_Project\\F28034.ccxml");
var session=server.openSession();
session.setScriptTimeout(30000);
function addr(n){return session.expression.evaluate("&"+n);}
function rw(n){return session.memory.readWord(1,addr(n));}
function rv32u(n){
  var a=addr(n),lo=session.memory.readWord(1,a),hi=session.memory.readWord(1,a+1);
  return (lo|(hi<<16))>>>0;
}
function reg(e){return parseInt(session.expression.evaluate(e));}
function check(name,ok,detail){
  print(name+"="+(ok?"TRUE":"FALSE")+(detail?(" "+detail):""));
  if(!ok)failures++;
}

var failures=0,linkFailed=false;
print("=== SOL W4 V12 QUIET LINK IDLE NOENERGY ===");
var actual=sha256File(OUT);
print("NE_OUT_SHA256="+actual);
check("NE_SHA_HARD_GATE",actual.equals(EXPECTED_SHA));
if(failures)throw "ne-sha-gate";

session.target.connect();
try{session.target.halt();}catch(e){}
session.memory.loadProgram(OUT);
session.target.runAsynch();java.lang.Thread.sleep(400);session.target.halt();
check("PRE_PWM0",rw("g_pwm_enabled")==0);
check("PRE_OST1",reg("EPwm1Regs.TZFLG.bit.OST")==1);
check("PRE_TZINT0",reg("EPwm1Regs.TZFLG.bit.INT")==0);
check("PRE_FAULT0",rv32u("g_fault_flags")==0);
if(failures){session.terminate();throw "ne-pre-gate";}

var clock0=rv32u("g_fast_tick");
session.setScriptTimeout(5000);
var fireNs=nowNs();
session.target.runAsynch();
print("QUIET_LINK_TARGET_RUNNING_OST_LOCKED=TRUE");
print("FIRST_STATUS_PROBE_AT_MS=70000");
print("FINAL_STATUS_PROBE_AT_MS=205000");
java.lang.System.out.flush();

sleepUntil(fireNs+QUIET_FIRST_NS);
try{
  check("FIRST_BOUNDED_IS_HALTED_FALSE",!session.target.isHalted());
}catch(e){
  linkFailed=true;
  failures++;
  print("FIRST_BOUNDED_IS_HALTED_EXCEPTION="+e);
}

if(!linkFailed){
  sleepUntil(fireNs+QUIET_FINAL_NS);
  try{
    check("FINAL_BOUNDED_IS_HALTED_FALSE",!session.target.isHalted());
  }catch(e){
    linkFailed=true;
    failures++;
    print("FINAL_BOUNDED_IS_HALTED_EXCEPTION="+e);
  }
}

if(linkFailed){
  print("LINK_QUARANTINE__NO_MORE_DSS_CALLS=TRUE");
  throw "quiet-link-failed";
}

/* Explicitly permitted only because the loaded NE image has never released
 * PWM and the physical 24 V source is off. This is not part of the REAL path. */
print("NOENERGY_ONLY_ACTIVE_HALT_AFTER_PROTOCOL=TRUE");
session.target.halt();
var clock1=rv32u("g_fast_tick"),delta=(clock1-clock0)>>>0;
check("TARGET_CLOCK_205S_CONTINUOUS",delta>=9000000 && delta<=11500000,
      "delta="+delta);
check("POST_PWM0",rw("g_pwm_enabled")==0);
check("POST_OST1",reg("EPwm1Regs.TZFLG.bit.OST")==1);
check("POST_TZINT0",reg("EPwm1Regs.TZFLG.bit.INT")==0);
check("POST_FAULT0",rv32u("g_fault_flags")==0);
session.terminate();
print("SOL_W4_V12_QUIET_LINK_IDLE_NOENERGY_PASS="+
      (failures==0?"TRUE":"FALSE"));
if(failures)throw "quiet-link-failures="+failures;
