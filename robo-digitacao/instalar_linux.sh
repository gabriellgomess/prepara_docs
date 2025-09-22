#!/bin/bash

echo "========================================================"
echo "    Instalador do Robô Prestação de Contas (Linux)"
echo "========================================================"
echo

# Verificar se Python está instalado
if ! command -v python3 &> /dev/null; then
    echo "[ERRO] Python 3 não está instalado. Por favor, instale o Python 3.7 ou superior."
    echo "Execute: sudo apt-get install python3 python3-pip (Ubuntu/Debian)"
    echo "ou: sudo dnf install python3 python3-pip (Fedora/RHEL)"
    exit 1
fi

echo "[OK] Python encontrado."

# Criar pastas necessárias
mkdir -p arquivos
mkdir -p logs

# Verificar se config.json existe
if [ ! -f "config.json" ]; then
    echo "Criando arquivo config.json padrão..."
    cat > config.json << EOL
{
    "url": "URL_DO_SISTEMA",
    "usuario": "SEU_USUARIO",
    "senha": "SUA_SENHA"
}
EOL
    echo "[ATENÇÃO] Configure o arquivo config.json com suas credenciais antes de usar o sistema."
fi

# Instalar dependências Python
echo "Instalando dependências Python..."
pip3 install -r requirements.txt

# Verificar se ChromeDriver está presente
if [ ! -f "chromedriver" ]; then
    echo "[ATENÇÃO] ChromeDriver não encontrado."
    echo "1. Verifique a versão do seu Google Chrome"
    echo "2. Baixe o ChromeDriver compatível em: https://chromedriver.chromium.org/downloads"
    echo "3. Descompacte e coloque o arquivo chromedriver na mesma pasta deste script."
    echo "4. Execute: chmod +x chromedriver"
fi

echo
echo "========================================================"
echo "Instalação concluída!"
echo
echo "Para iniciar o sistema execute:"
echo "    ./start.sh"
echo
echo "Certifique-se de que:"
echo "    1. Configurou corretamente o config.json"
echo "    2. Colocou o chromedriver nesta pasta e deu permissão de execução"
echo "    3. Fez upload da planilha e dos PDFs pela interface"
echo "========================================================"
echo

# Tornar o script start.sh executável
cat > start.sh << EOL
#!/bin/bash
echo "========================================"
echo " Iniciando Robô Prestação de Contas..."
echo "========================================"
echo
echo "Acesse o sistema em: http://localhost:5000"
echo
echo "Para encerrar, pressione CTRL+C"

python3 app.py
EOL

chmod +x start.sh
echo "Arquivo start.sh criado e configurado com permissões de execução." 