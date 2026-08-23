@echo off
setlocal
set PROJ=D:\CCS21_workspace\Codex_Project
set CGT=D:\CCS21\ccs\tools\compiler\ti-cgt-c2000_25.11.1.LTS
set BUILD=%PROJ%\Debug

if not exist "%BUILD%" mkdir "%BUILD%"

echo === CGT 16.9.3 clean compile ===
"%CGT%\bin\cl2000.exe" -v28 -ml -mt -g -O4 --abi=coffabi --opt_for_speed=0 -ms --diag_warning=225 --diag_wrap=off --display_error_number --gen_func_subsections ^
  -I"%PROJ%" -I"%PROJ%\app" -I"%PROJ%\driver" -I"%PROJ%\device" -I"%PROJ%\device\include" -I"%PROJ%\IQmath\c28\include" ^
  -c ^
  "%PROJ%\main.c" ^
  "%PROJ%\app\app.c" ^
  "%PROJ%\app\llc_globals.c" ^
  "%PROJ%\app\adc.c" ^
  "%PROJ%\app\control.c" ^
  "%PROJ%\app\protection.c" ^
  "%PROJ%\app\state_machine.c" ^
  "%PROJ%\app\default_isr.c" ^
  "%PROJ%\app\comparator.c" ^
  "%PROJ%\app\power_probe.c" ^
  "%PROJ%\app\cal_hold_burst.c" ^
  "%PROJ%\driver\gpio.c" ^
  "%PROJ%\driver\pwm.c" ^
  "%PROJ%\device\system.c" ^
  "%PROJ%\device\source\DSP2803x_Adc.c" ^
  "%PROJ%\device\source\DSP2803x_EPwm.c" ^
  "%PROJ%\device\source\DSP2803x_GlobalVariableDefs.c" ^
  "%PROJ%\device\source\DSP2803x_Gpio.c" ^
  "%PROJ%\device\source\DSP2803x_PieCtrl.c" ^
  "%PROJ%\device\source\DSP2803x_PieVect.c" ^
  "%PROJ%\device\source\DSP2803x_SysCtrl.c" ^
  --obj_directory="%BUILD%"
if errorlevel 1 exit /b 1

echo === assemble usDelay ===
"%CGT%\bin\cl2000.exe" -v28 --abi=coffabi -c "%PROJ%\device\source\DSP2803x_usDelay.asm" --obj_directory="%BUILD%"
if errorlevel 1 exit /b 1

echo === compile soft_start.c (-O2, size) ===
"%CGT%\bin\cl2000.exe" -v28 -ml -mt -g -O2 --abi=coffabi --opt_for_speed=0 -ms --diag_warning=225 --diag_wrap=off --display_error_number --gen_func_subsections ^
  -I"%PROJ%" -I"%PROJ%\app" -I"%PROJ%\driver" -I"%PROJ%\device" -I"%PROJ%\device\include" -I"%PROJ%\IQmath\c28\include" ^
  -c "%PROJ%\app\soft_start.c" --obj_directory="%BUILD%" || exit /b 1
echo === link ===
"%CGT%\bin\cl2000.exe" -v28 -ml -mt -g -O4 --abi=coffabi --opt_for_speed=0 -ms --diag_warning=225 --diag_wrap=off --display_error_number --gen_func_subsections ^
  -z -m"%BUILD%\LLC_100W_F28034_BRINGUP_DSH.map" --stack_size=0xBF --warn_sections ^
  -i"%CGT%\lib" -i"%CGT%\include" --reread_libs --diag_wrap=off --display_error_number ^
  --xml_link_info="%BUILD%\LLC_100W_F28034_BRINGUP_DSH_linkInfo.xml" --rom_model ^
  -o"%BUILD%\LLC_100W_F28034_BRINGUP_DSH.out" ^
  "%PROJ%\28034_RAM_lnk.cmd" "%PROJ%\DSP2803x_Headers_nonBIOS.cmd" ^
  "%PROJ%\IQmath\c28\lib\IQmath.lib" "%PROJ%\IQmath\c28\lib\IQmath_fpu32.lib" ^
  "%BUILD%\main.obj" ^
  "%BUILD%\app.obj" ^
  "%BUILD%\llc_globals.obj" ^
  "%BUILD%\adc.obj" ^
  "%BUILD%\control.obj" ^
  "%BUILD%\protection.obj" ^
  "%BUILD%\state_machine.obj" ^
  "%BUILD%\default_isr.obj" ^
  "%BUILD%\comparator.obj" ^
  "%BUILD%\power_probe.obj" ^
  "%BUILD%\cal_hold_burst.obj" ^
  "%BUILD%\soft_start.obj" ^
  "%BUILD%\gpio.obj" ^
  "%BUILD%\pwm.obj" ^
  "%BUILD%\system.obj" ^
  "%BUILD%\DSP2803x_Adc.obj" ^
  "%BUILD%\DSP2803x_EPwm.obj" ^
  "%BUILD%\DSP2803x_GlobalVariableDefs.obj" ^
  "%BUILD%\DSP2803x_Gpio.obj" ^
  "%BUILD%\DSP2803x_PieCtrl.obj" ^
  "%BUILD%\DSP2803x_PieVect.obj" ^
  "%BUILD%\DSP2803x_SysCtrl.obj" ^
  "%BUILD%\DSP2803x_usDelay.obj" ^
  -llibc.a
if errorlevel 1 exit /b 1

echo === BUILD OK ===
endlocal
