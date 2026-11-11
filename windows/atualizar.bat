@echo off
rem Braco e Escalas: baixa a versao nova do GitHub e reinicia o servidor. As gravacoes nao sao tocadas.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0atualizar.ps1"
pause
