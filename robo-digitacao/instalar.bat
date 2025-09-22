@echo off
cls
echo ========================================================
echo    Instalador do Robo Prestacao de Contas
echo ========================================================
echo.

REM Verificar se Python está instalado
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Python nao esta instalado. Por favor, instale o Python 3.7 ou superior.
    echo Download: https://www.python.org/downloads/
    echo Certifique-se de marcar a opcao "Add Python to PATH" durante a instalacao.
    pause
    exit /b 1
)

echo [OK] Python encontrado.

REM Verificar se Microsoft C++ Build Tools está disponível
echo Verificando Microsoft C++ Build Tools...
python -c "import distutils.msvccompiler; print('Build Tools OK')" >nul 2>&1
if %errorlevel% neq 0 (
    echo [ATENCAO] Microsoft C++ Build Tools nao encontrado.
    echo.
    echo Para instalar pandas e outras bibliotecas, voce precisa do Microsoft C++ Build Tools.
    echo.
    echo OPCOES:
    echo 1. Instalar Microsoft C++ Build Tools:
    echo    https://visualstudio.microsoft.com/visual-cpp-build-tools/
    echo    - Baixe e instale o "Build Tools for Visual Studio"
    echo    - Selecione "C++ build tools" durante a instalacao
    echo.
    echo 2. OU usar versoes pre-compiladas (mais rapido):
    echo    Pressione qualquer tecla para tentar instalacao com wheels pre-compilados...
    pause
)

echo [OK] Python encontrado.

REM Criar pastas necessárias
if not exist "arquivos" mkdir arquivos
if not exist "logs" mkdir logs

REM Verificar se config.json existe
if not exist "config.json" (
    echo Criando arquivo config.json padrao...
    echo { > config.json
    echo     "url": "URL_DO_SISTEMA", >> config.json
    echo     "usuario": "SEU_USUARIO", >> config.json
    echo     "senha": "SUA_SENHA" >> config.json
    echo } >> config.json
    echo [ATENCAO] Configure o arquivo config.json com suas credenciais antes de usar o sistema.
)

REM Instalar dependências Python
echo Instalando dependencias Python...
python -m pip install --only-binary=all -r requirements.txt

if %errorlevel% neq 0 (
    echo.
    echo [AVISO] Instalacao com wheels falhou. Tentando instalacao individual...
    echo Atualizando pip, setuptools e wheel...
    python -m pip install --upgrade pip setuptools wheel
    
    echo Instalando dependencias individualmente...
    python -m pip install flask==2.0.1
    python -m pip install flask-socketio==5.1.1
    python -m pip install selenium==4.1.0
    python -m pip install --only-binary=pandas pandas==1.3.5
    python -m pip install openpyxl==3.0.9
    python -m pip install python-engineio==4.3.1
    python -m pip install python-socketio==5.5.1
    python -m pip install werkzeug==2.0.2
    python -m pip install gunicorn==20.1.0
    python -m pip install eventlet==0.33.0
    
    if %errorlevel% neq 0 (
        echo.
        echo [ERRO] Falha na instalacao das dependencias.
        echo.
        echo SOLUCOES:
        echo 1. Instale o Microsoft C++ Build Tools:
        echo    https://visualstudio.microsoft.com/visual-cpp-build-tools/
        echo.
        echo 2. OU use uma versao mais recente do Python (3.9+) que tem melhor suporte a wheels
        echo.
        pause
        exit /b 1
    )
)

REM Verificar se ChromeDriver está presente
if not exist "chromedriver.exe" (
    echo [ATENCAO] ChromeDriver nao encontrado.
    echo 1. Verifique a versao do seu Google Chrome em Menu -^> Ajuda -^> Sobre o Google Chrome
    echo 2. Baixe o ChromeDriver compativel em: https://chromedriver.chromium.org/downloads
    echo 3. Coloque o arquivo chromedriver.exe na mesma pasta deste script.
    pause
)

echo.
echo ========================================================
echo Instalacao concluida!
echo.
echo Para iniciar o sistema execute:
echo    start.bat
echo.
echo Certifique-se de que:
echo    1. Configurou corretamente o config.json
echo    2. Colocou o chromedriver.exe nesta pasta
echo    3. Fez upload da planilha e dos PDFs pela interface
echo ========================================================
echo.
pause