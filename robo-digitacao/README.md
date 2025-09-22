# Robô Prestação de Contas

Sistema automatizado para preenchimento de prestação de contas que concilia dados da planilha Excel com arquivos PDF, automatizando o processo de envio de documentos.

## Requisitos de Sistema

- Python 3.7 ou superior
- Google Chrome
- ChromeDriver compatível com a versão do Chrome instalada
- 100MB de espaço em disco (mínimo)
- Acesso à internet para download das dependências

## Instalação no Windows

1. **Instale o Python**:
   - Faça download do Python em: https://www.python.org/downloads/
   - Durante a instalação, **IMPORTANTE**: marque a opção "Add Python to PATH"
   - Verifique a instalação abrindo o prompt de comando e digitando: `python --version`

2. **Execute o instalador**:
   - Extraia todos os arquivos do projeto em uma pasta
   - Execute o arquivo `instalar.bat` com duplo clique
   - O script irá:
     - Verificar a instalação do Python
     - Criar as pastas necessárias (arquivos e logs)
     - Instalar todas as dependências Python
     - Criar arquivo config.json padrão se não existir

3. **Configure as credenciais**:
   - Edite o arquivo `config.json` com um editor de texto (Notepad, etc.)
   - Preencha com suas informações:
     ```json
     {
         "url": "URL_DO_SISTEMA_ALVO",
         "usuario": "SEU_USUARIO",
         "senha": "SUA_SENHA"
     }
     ```

4. **Instale o ChromeDriver**:
   - Verifique a versão do Google Chrome: Menu → Ajuda → Sobre o Google Chrome
   - Baixe o ChromeDriver exatamente da mesma versão em: https://chromedriver.chromium.org/downloads
   - Extraia e coloque o arquivo `chromedriver.exe` na mesma pasta do projeto

## Instalação no Linux

1. **Instale o Python**:
   - Ubuntu/Debian: `sudo apt-get install python3 python3-pip`
   - Fedora/RHEL: `sudo dnf install python3 python3-pip`

2. **Execute o instalador**:
   - Extraia os arquivos do projeto
   - Dê permissão de execução: `chmod +x instalar_linux.sh`
   - Execute: `./instalar_linux.sh`

3. **Configure as credenciais**:
   - Edite o arquivo config.json: `nano config.json`
   - Preencha com suas informações conforme indicado acima

4. **Instale o ChromeDriver**:
   - Verifique a versão do Chrome: `google-chrome --version`
   - Baixe o ChromeDriver compatível
   - Extraia na pasta do projeto: `unzip chromedriver_linux64.zip`
   - Dê permissão: `chmod +x chromedriver`

## Como Usar o Sistema

1. **Iniciar o aplicativo**:
   - Windows: Execute `start.bat`
   - Linux: Execute `./start.sh`
   - O sistema estará disponível em: http://localhost:5000

2. **Gerenciamento de Arquivos**:
   - **Planilha Excel**: Faça upload da planilha de dados
     - Formato exigido: Colunas com cabeçalho, incluindo a coluna "Nome"
     - A planilha deve ter as informações que serão preenchidas no sistema
   
   - **Arquivos PDF**: Faça upload dos PDFs correspondentes
     - Formato dos nomes: "NUMERO - NOME DA PESSOA - CMDCA.pdf"
     - Os nomes dos PDFs devem corresponder aos nomes na planilha
     - É necessário fazer upload de todos os PDFs referentes à planilha

3. **Configuração e Execução**:
   - Preencha a **Data de Emissão** e **Data de Pagamento**
   - Selecione o **Órgão da Administração Pública**
   - Selecione a **Parceria** correspondente
   - **Modo Headless**:
     - Ativado: robô executa em segundo plano (sem abrir navegador)
     - Desativado: permite visualizar o navegador durante a execução
   - Clique em **Iniciar Robô**

4. **Monitoramento**:
   - A execução será acompanhada na área de logs
   - A tela rolará automaticamente para mostrar o progresso
   - Possíveis erros e avisos serão exibidos em tempo real

## Solução de Problemas Comuns

| Problema | Solução |
|----------|---------|
| **Erro no ChromeDriver** | Certifique-se que a versão do ChromeDriver é exatamente a mesma do Chrome |
| **Erro de login** | Verifique as credenciais no config.json |
| **PDFs não encontrados** | Verifique se os nomes dos PDFs seguem o padrão correto: "NUMERO - NOME DA PESSOA - CMDCA.pdf" |
| **Planilha com erro** | Confirme que a planilha tem as colunas necessárias, incluindo "Nome" |
| **Erro de permissão** | Execute o instalador como administrador (Windows) ou com sudo (Linux) |
| **Sistema lento** | Ative o modo Headless para melhor desempenho |

## Dependências do Sistema

O script de instalação configura automaticamente as seguintes dependências:

- flask==2.0.1
- flask-socketio==5.1.1
- selenium==4.1.0
- pandas==1.3.5
- openpyxl==3.0.9
- python-engineio==4.3.1
- python-socketio==5.5.1
- werkzeug==2.0.2
- gunicorn==20.1.0
- eventlet==0.33.0

## Suporte Técnico

Para obter suporte técnico, entre em contato com o desenvolvedor do sistema.

Se precisar reinstalar o sistema, recomendamos executar novamente o script de instalação para garantir que todas as dependências estejam atualizadas. 