@echo off
cd /d %~dp0
echo Iniciando o servidor Flask...
start cmd /k "python app.py"
timeout /t 5 >nul
echo Abrindo o navegador...
start http://127.0.0.1:5000/
exit
