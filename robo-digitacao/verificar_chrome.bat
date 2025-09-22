@echo off
echo ========================================================
echo    VERIFICACAO DO GOOGLE CHROME
echo ========================================================
echo.

echo Verificando se o Google Chrome esta instalado...
echo.

set CHROME_FOUND=0

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    echo [OK] Chrome encontrado em: C:\Program Files\Google\Chrome\Application\chrome.exe
    set CHROME_FOUND=1
)

if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    echo [OK] Chrome encontrado em: C:\Program Files ^(x86^)\Google\Chrome\Application\chrome.exe
    set CHROME_FOUND=1
)

if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    echo [OK] Chrome encontrado em: %LOCALAPPDATA%\Google\Chrome\Application\chrome.exe
    set CHROME_FOUND=1
)

echo.

if %CHROME_FOUND%==1 (
    echo ========================================================
    echo SUCCESS: Google Chrome esta instalado!
    echo ========================================================
    echo.
    echo O robo agora vai usar o Chrome automaticamente.
    echo O Edge nao sera usado.
    echo.
) else (
    echo ========================================================
    echo AVISO: Google Chrome NAO encontrado!
    echo ========================================================
    echo.
    echo Para instalar o Google Chrome:
    echo 1. Acesse: https://www.google.com/chrome/
    echo 2. Baixe e instale o Chrome
    echo 3. Execute este script novamente
    echo.
)

echo Verificando versao do Chrome...
if %CHROME_FOUND%==1 (
    for /f "tokens=*" %%i in ('reg query "HKEY_CURRENT_USER\Software\Google\Chrome\BLBeacon" /v version 2^>nul') do (
        echo %%i | findstr "version" >nul
        if not errorlevel 1 (
            for /f "tokens=3" %%j in ("%%i") do echo Versao do Chrome: %%j
        )
    )
)

echo.
pause