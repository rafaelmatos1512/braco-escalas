@echo off
rem Braco e Escalas: copia os audios de uma pasta (ex.: o pen drive E:\) para o app, mantendo as subpastas.
rem Uso: importar.bat "E:\"            -> tudo do pen drive
rem      importar.bat "E:\" "Pen drive" -> tudo dentro da pasta "Pen drive" do app
if "%~1"=="" (
  echo Uso: importar.bat "E:\"   ^(troque E: pela letra do pen drive^)
  pause
  exit /b 1
)
rem "E:" no fim quebraria as aspas: vira "E:\."
set "ORIGEM=%~1"
if "%ORIGEM:~-1%"=="\" set "ORIGEM=%ORIGEM%."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0importar.ps1" "%ORIGEM%" "%~2"
pause
