@echo off
rem Build one Stage6 REAL ladder binary with a specific duration.
rem Usage: build_flash_shot_real_ladder.bat <LABEL> <DURATION_CYCLES>
rem   LABEL e.g. 2MS, 10MS, 100MS
rem   DURATION_CYCLES e.g. 120000, 600000, 6000000
setlocal
if "%~1"=="" (
  echo Usage: build_flash_shot_real_ladder.bat LABEL DURATION_CYCLES
  exit /b 1
)
if "%~2"=="" (
  echo Usage: build_flash_shot_real_ladder.bat LABEL DURATION_CYCLES
  exit /b 1
)
set LABEL=%~1
set DUR=%~2
set PROJ=D:\CCS21_workspace\Codex_Project
set CGT=D:\CCS21\ccs\tools\compiler\ti-cgt-c2000_25.11.1.LTS
set BUILD=%PROJ%\Stage6_FLASH_SHOT_REAL_%LABEL%

if exist "%BUILD%" rmdir /s /q "%BUILD%"
mkdir "%BUILD%"

echo === CGT 25.11.1.LTS clean Stage6_FLASH_SHOT_REAL_%LABEL% compile (COFF, REAL bounded shot, %DUR% cycles) ===
"%CGT%\bin\cl2000.exe" --abi=coffabi -v28 -ml -mt -g -O4 --opt_for_speed=0 -ms --diag_warning=225 --diag_wrap=off --display_error_number --gen_func_subsections ^
  -DSTAGE6_FLASH_BUILD=1 ^
  -DSTAGE6_FIRST_BOUNDED_REAL_PI_SHOT=1 ^
  -DSTAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD=1 ^
  -DFIRST_REAL_PI_DURATION_CYCLES=%DUR%UL ^
  -I"%PROJ%" -I"%PROJ%\app" -I"%PROJ%\driver" -I"%PROJ%\device" -I"%PROJ%\device\include" -I"%PROJ%\IQmath\c28\include" ^
  -c ^
  "%PROJ%\main.c" ^
  "%PROJ%\app\app.c" ^
  "%PROJ%\app\llc_globals.c" ^
  "%PROJ%\app\adc.c" ^
  "%PROJ%\app\control.c" ^
  "%PROJ%\app\protection.c" ^
  "%PROJ%\app\state_machine.c" ^
  "%PROJ%\app\shot.c" ^
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
"%CGT%\bin\cl2000.exe" --abi=coffabi -v28 -c "%PROJ%\device\source\DSP2803x_usDelay.asm" --obj_directory="%BUILD%"
if errorlevel 1 exit /b 1

echo === assemble codestart (boot-to-flash branch) ===
"%CGT%\bin\cl2000.exe" --abi=coffabi -v28 -c "%PROJ%\device\source\2803x_CodeStartBranch.asm" --obj_directory="%BUILD%"
if errorlevel 1 exit /b 1

echo === compile soft_start.c (-O2, size) ===
"%CGT%\bin\cl2000.exe" --abi=coffabi -v28 -ml -mt -g -O2 --opt_for_speed=0 -ms --diag_warning=225 --diag_wrap=off --display_error_number --gen_func_subsections ^
  -DSTAGE6_FLASH_BUILD=1 ^
  -DSTAGE6_FIRST_BOUNDED_REAL_PI_SHOT=1 ^
  -DSTAGE6_FIRST_REAL_PI_SHOT_REAL_BUILD=1 ^
  -DFIRST_REAL_PI_DURATION_CYCLES=%DUR%UL ^
  -I"%PROJ%" -I"%PROJ%\app" -I"%PROJ%\driver" -I"%PROJ%\device" -I"%PROJ%\device\include" -I"%PROJ%\IQmath\c28\include" ^
  -c "%PROJ%\app\soft_start.c" --obj_directory="%BUILD%" || exit /b 1

echo === link (FLASH) ===
"%CGT%\bin\cl2000.exe" --abi=coffabi -v28 -ml -mt -g -O4 --opt_for_speed=0 -ms --diag_warning=225 --diag_wrap=off --display_error_number --gen_func_subsections ^
  -z -m"%BUILD%\LLC_100W_F28034_BRINGUP_DSH_REAL_%LABEL%.map" --stack_size=0xBF --warn_sections --entry_point=code_start ^
  -i"%CGT%\lib" -i"%CGT%\include" --reread_libs --diag_wrap=off --display_error_number ^
  --xml_link_info="%BUILD%\LLC_100W_F28034_BRINGUP_DSH_REAL_%LABEL%_linkInfo.xml" --rom_model ^
  -o"%BUILD%\LLC_100W_F28034_BRINGUP_DSH_REAL_%LABEL%.out" ^
  "%PROJ%\28034_FLASH_lnk.cmd" "%PROJ%\DSP2803x_Headers_nonBIOS.cmd" ^
  "%PROJ%\IQmath\c28\lib\IQmath.lib" "%PROJ%\IQmath\c28\lib\IQmath_fpu32.lib" ^
  "%BUILD%\main.obj" ^
  "%BUILD%\app.obj" ^
  "%BUILD%\llc_globals.obj" ^
  "%BUILD%\adc.obj" ^
  "%BUILD%\control.obj" ^
  "%BUILD%\protection.obj" ^
  "%BUILD%\state_machine.obj" ^
  "%BUILD%\shot.obj" ^
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
  "%BUILD%\2803x_CodeStartBranch.obj" ^
  -llibc.a
if errorlevel 1 exit /b 1

echo === BUILD OK (Stage6_FLASH_SHOT_REAL_%LABEL%, CGT 25.11.1.LTS, COFF, SHOT REAL, %DUR% cycles) ===
endlocal
