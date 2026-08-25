// STAGE6_BURST_RESTART_SOURCE_PROVENANCE_AND_REAL_PREFLIGHT_CLOSURE_V1_5
// Prepared real script for a single CR100 Burst entry+restart shot.
// This script must NOT be executed until explicitly authorized.
importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.lang);
importPackage(Packages.java.io);
importPackage(Packages.java.security);
var OUT="D:\\100W_LLC_F280234_Program\\branch_first_real_pi_shot_v1_1\\evidence\\stage6_first_real_pi_shot_real\\LLC_100W_F28034_BRINGUP_DSH_REAL_SHOT_BURST_RESTART_9794211D.out";
var EXPECTED="9794211DE6081F1EE2FD2EA7C83454BBFD76ADAEB2281308B00BF0510C886B77";
function sha256File(path){
  var md=MessageDigest.getInstance("SHA-256"); var fis=new FileInputStream(path);
  var buf=java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE,8192); var n;
  while((n=fis.read(buf))>0){ md.update(buf,0,n); } fis.close();
  var d=md.digest(); var sb=new StringBuilder();
  for(var i=0;i<d.length;i++){ var hex=(d[i]&0xFF).toString(16); if(hex.length<2)hex="0"+hex; sb.append(hex.toUpperCase()); }
  return sb.toString();
}
var actual=sha256File(OUT);
if(!actual.equals(EXPECTED)){ print("ABORT: SHA mismatch."); throw "sha"; }
var perm=(System.getenv("DSH_CNT34_PERMANENT_CONNECTED_CONFIRMED")||"").equals("1");
var cr100=(System.getenv("DSH_CR100_CONFIRMED")||"").equals("1");
var vin=(System.getenv("DSH_VIN24_LIMIT05A_CONFIRMED")||"").equals("1");
var op=(System.getenv("DSH_OPERATOR_PRESENT_CONFIRMED")||"").equals("1");
var auth=(System.getenv("DSH_SINGLE_BURST_RESTART_AUTHORIZED")||"").equals("1");
print("perm="+perm+" cr100="+cr100+" vin="+vin+" op="+op+" auth="+auth);
if(!perm || !cr100 || !vin || !op || !auth){ print("ABORT: real burst-restart authorization gates not all 1."); throw "noauth"; }
print("REAL_BURST_RESTART_SCRIPT_READY");
