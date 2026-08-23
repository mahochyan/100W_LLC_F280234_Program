/*
 * Read-only F28034 state capture for CCS 7.2 DSS / Scripting Console.
 *
 * Safety rules:
 * - Never calls target.run(), target.halt(), target.restart(), or target.reset().
 * - Never loads a program or creates/modifies breakpoints.
 * - Only evaluates expressions and resolves symbols while the CPU is halted.
 */

importPackage(Packages.com.ti.debug.engine.scripting);
importPackage(Packages.com.ti.ccstudio.scripting.environment);
importPackage(Packages.java.io);
importPackage(Packages.java.lang);
importPackage(Packages.java.util);

var PROJECT_ROOT = "D:/CCS21_workspace/Codex_Project";
var TARGET_CONFIG = PROJECT_ROOT + "/targetConfigs/TMS320F28034.ccxml";
var OUTPUT_DIR = PROJECT_ROOT + "/debug_capture";
var OUTPUT_FILE = OUTPUT_DIR + "/f28034_state.txt";

var ownServer = false;
var server = null;
var session = null;
var report = [];

function nowText()
{
    return new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS").format(new java.util.Date());
}

function hex16(value)
{
    return "0x" + (Number(value) & 0xFFFF).toString(16).toUpperCase();
}

function hex32(value)
{
    var number = Number(value);
    if (number < 0)
    {
        number += 4294967296;
    }
    return "0x" + number.toString(16).toUpperCase();
}

function add(line)
{
    report.push(line);
}

function addSection(title)
{
    add("");
    add("[" + title + "]");
}

function readExpression(label, expression, format)
{
    try
    {
        var value = session.expression.evaluate(expression);
        if (format == "hex16")
        {
            add(label + " = " + hex16(value) + " (" + value + ")");
        }
        else if (format == "hex32")
        {
            add(label + " = " + hex32(value) + " (" + value + ")");
        }
        else
        {
            add(label + " = " + value);
        }
        return value;
    }
    catch (error)
    {
        add(label + " = ERROR: cannot read expression '" + expression + "': " + error);
        return null;
    }
}

function readSymbolAddress(symbolName)
{
    try
    {
        var address = session.symbol.getAddress(symbolName);
        add("symbol " + symbolName + " = " + hex32(address));
        return address;
    }
    catch (error)
    {
        add("symbol " + symbolName + " = ERROR: " + error);
        return null;
    }
}

function addCurrentSymbol(pc)
{
    var found = "";
    try
    {
        found = session.symbol.lookupSymbol(1, pc);
    }
    catch (error1)
    {
        add("current_symbol_page_1 = ERROR: " + error1);
    }

    if (found == null || found == "")
    {
        try
        {
            found = session.symbol.lookupSymbol(0, pc);
        }
        catch (error0)
        {
            add("current_symbol_page_0 = ERROR: " + error0);
        }
    }

    if (found == null || found == "")
    {
        add("current_symbol = ERROR: no symbol resolved for current PC");
    }
    else
    {
        add("current_symbol = " + found);
    }
}

function getSession()
{
    /*
     * Prefer the existing CCS Scripting Console target session. Otherwise
     * open a DSS session without loading, running, resetting, or programming
     * the target.
     */
    if (typeof activeDS != "undefined" && activeDS != null)
    {
        add("session_mode = existing CCS activeDS");
        return activeDS;
    }

    if (typeof debugSession != "undefined" && debugSession != null)
    {
        add("session_mode = existing CCS Scripting Console debugSession");
        return debugSession;
    }

    var environment = ScriptingEnvironment.instance();
    server = environment.getServer("DebugServer.1");
    server.setConfig(TARGET_CONFIG);
    session = server.openSession(".*");
    ownServer = true;

    /* Connect only. No program load, no reset, no run, and no breakpoints. */
    session.target.connect();
    add("session_mode = standalone DSS session");
    return session;
}

function writeReport()
{
    var directory = new File(OUTPUT_DIR);
    if (!directory.exists())
    {
        directory.mkdirs();
    }

    var writer = new PrintWriter(new BufferedWriter(new FileWriter(OUTPUT_FILE)));
    for (var index = 0; index < report.length; index++)
    {
        writer.println(report[index]);
    }
    writer.close();
}

try
{
    add("F28034 READ-ONLY DEBUG CAPTURE");
    add("capture_time = " + nowText());
    add("output_file = " + OUTPUT_FILE);
    add("policy = no target reset, no program load, no run, no breakpoint change, no register write");

    session = getSession();

    addSection("TARGET STATE");
    add("target_connected = " + session.target.isConnected());
    add("target_halted = " + session.target.isHalted());

    if (!session.target.isHalted())
    {
        add("CAPTURE_ABORTED = CPU is running. Suspend it in CCS first; this script will not halt it.");
    }
    else
    {
        addSection("CPU AND CURRENT LOCATION");
        var pc = readExpression("PC", "PC", "hex32");
        readExpression("SP", "SP", "hex32");
        if (pc != null)
        {
            addCurrentSymbol(pc);
        }
        readSymbolAddress("main");
        readSymbolAddress("System_Init");
        readSymbolAddress("_c_int00");
        readSymbolAddress("_args_main");

        addSection("APPLICATION STATUS");
        readExpression("system_init_ok", "system_init_ok", "hex16");

        addSection("PLL AND CLOCK REGISTERS");
        readExpression("SysCtrlRegs.PLLCR.all", "SysCtrlRegs.PLLCR.all", "hex16");
        readExpression("SysCtrlRegs.PLLSTS.all", "SysCtrlRegs.PLLSTS.all", "hex16");
        readExpression("SysCtrlRegs.CLKCTL.all", "SysCtrlRegs.CLKCTL.all", "hex16");
        readExpression("SysCtrlRegs.PLLLOCKPRD", "SysCtrlRegs.PLLLOCKPRD", "hex16");
        readExpression("PLLCR.DIV", "SysCtrlRegs.PLLCR.bit.DIV", "hex16");
        readExpression("PLLSTS.PLLLOCKS", "SysCtrlRegs.PLLSTS.bit.PLLLOCKS", "decimal");
        readExpression("PLLSTS.MCLKSTS", "SysCtrlRegs.PLLSTS.bit.MCLKSTS", "decimal");
        readExpression("PLLSTS.DIVSEL", "SysCtrlRegs.PLLSTS.bit.DIVSEL", "decimal");
        readExpression("CLKCTL.OSCCLKSRCSEL", "SysCtrlRegs.CLKCTL.bit.OSCCLKSRCSEL", "decimal");
        readExpression("CLKCTL.INTOSC1OFF", "SysCtrlRegs.CLKCTL.bit.INTOSC1OFF", "decimal");

        addSection("WATCHDOG REGISTERS");
        readExpression("SysCtrlRegs.WDCR", "SysCtrlRegs.WDCR", "hex16");
        readExpression("SysCtrlRegs.WDCNTR", "SysCtrlRegs.WDCNTR", "hex16");
        readExpression("SysCtrlRegs.SCSR", "SysCtrlRegs.SCSR", "hex16");

        addSection("GPIO24 / GREEN LED");
        readExpression("GPAMUX2.GPIO24", "GpioCtrlRegs.GPAMUX2.bit.GPIO24", "decimal");
        readExpression("GPADIR.GPIO24", "GpioCtrlRegs.GPADIR.bit.GPIO24", "decimal");
        readExpression("GPADAT.GPIO24", "GpioDataRegs.GPADAT.bit.GPIO24", "decimal");
        readExpression("GPAPUD.GPIO24", "GpioCtrlRegs.GPAPUD.bit.GPIO24", "decimal");
        readExpression("GPAMUX2.all", "GpioCtrlRegs.GPAMUX2.all", "hex32");
        readExpression("GPADIR.all", "GpioCtrlRegs.GPADIR.all", "hex32");
        readExpression("GPADAT.all", "GpioDataRegs.GPADAT.all", "hex32");
    }
}
catch (fatalError)
{
    add("FATAL_ERROR = " + fatalError);
}

try
{
    writeReport();
}
catch (writeError)
{
    print("Failed to write " + OUTPUT_FILE + ": " + writeError);
}

if (ownServer)
{
    /* Closing the host session does not reset, run, or program the target. */
    session.terminate();
    server.stop();
}

print("Read-only capture complete: " + OUTPUT_FILE);
