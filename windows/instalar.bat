@echo off
rem Braco e Escalas: instala o que falta (Python, ffmpeg) e cria o atalho na area de trabalho. Pode rodar de novo sem problema.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar.ps1"
pause
