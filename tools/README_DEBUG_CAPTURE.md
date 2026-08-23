# F28034 只读 CCS/JTAG 状态采集

脚本：[dump_f28034_state.js](dump_f28034_state.js)

输出文件：`debug_capture/f28034_state.txt`

它只读取已暂停 F28034 的状态，不调用运行、暂停、复位、装载程序、断点或寄存器写入接口。

## 采集内容

- PC、SP、当前符号，以及 `main`、`System_Init`、`_c_int00`、`_args_main` 的地址；
- `system_init_ok`；
- `PLLCR`、`PLLSTS`、`CLKCTL`、`PLLLOCKPRD`；
- `WDCR`、`WDCNTR`、`SCSR`；
- GPIO24 的 MUX、DIR、DAT、PUD，以及相应完整寄存器值；
- CPU 是否连接、是否暂停。

任何无法由当前符号表或 CCS 7.2 读取的项目，报告会记录 `ERROR`，不会填入猜测值。

## 运行前条件

1. 不连接30 V主功率输入。
2. 在 CCS 中进入当前工程的 Debug 会话。
3. 点击 **Suspend**，确认 C28xx 显示为 `Suspended`。
4. 不要使用 Run、Reset、Restart 或 Load Program。

脚本会再次检查暂停状态。若CPU仍在运行，它只输出 `CAPTURE_ABORTED`，不会自行暂停CPU。

## CCS 7.2 Scripting Console

不同 CCS 7.2 安装中，Scripting Console 是否向脚本公开当前 `DebugSession` 的变量名并不完全一致。

CCS 7.2 的 Scripting Console 会提供当前调试会话对象 `activeDS`。直接加载：

```javascript
loadJSFile("D:/CCS21_workspace/Codex_Project/tools/dump_f28034_state.js");
```

脚本优先使用已有 `activeDS`，其次兼容 `debugSession`，不建立新的会话。

若控制台没有该对象，脚本会使用 DSS 打开一个**只连接**的会话。此时同一 XDS100v2 通常不能同时被图形 Debug 会话和 DSS 独占使用；请先在 CCS 中保持 CPU 暂停，然后仅断开目标连接，不要执行 Reset/Restart/Load Program，再运行 DSS。

## 独立 DSS 运行

在 Windows 命令行中，先进入工程目录，然后运行：

```bat
C:\ti\ccs720\ccsv7\ccs_base\scripting\bin\dss.bat tools\dump_f28034_state.js
```

脚本固定使用：

```text
D:/CCS21_workspace/Codex_Project/targetConfigs/TMS320F28034.ccxml
```

它不会调用 `loadProgram()`、`target.run()`、`target.halt()`、`target.restart()`、`target.reset()` 或断点API。

## 如何看结果

时钟配置成功时，预期至少看到：

```text
PLLCR.DIV = 0x6
PLLSTS.PLLLOCKS = 1
PLLSTS.DIVSEL = 3
CLKCTL.OSCCLKSRCSEL = 0
PLLSTS.MCLKSTS = 0
```

这对应：内部 OSC1 约10 MHz → PLL ×6 → SYSCLK 约60 MHz。

GPIO24 的绿灯基线预期为：

```text
GPAMUX2.GPIO24 = 0
GPADIR.GPIO24 = 1
```

`GPADAT.GPIO24` 的正确有效电平必须与 `LED_GreenOn()` 的实际实现一致。脚本只报告该数值，不自行判定高电平或低电平点亮；若LED仍不亮，应结合原理图检查GPIO24物理80脚、限流电阻、LED极性、SGND和焊接。
