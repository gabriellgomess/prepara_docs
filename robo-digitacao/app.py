import os
import json
import pandas as pd
import logging
import subprocess
import re
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select
import time
from werkzeug.utils import secure_filename

# ========= CONFIGURAÇÃO =========
# Alterar para `True` para rodar headless, `False` para rodar com navegador visível
HEADLESS_MODE = True

# Tempo máximo de espera para elementos (em segundos)
TIMEOUT = 15

# Configuração do Flask
app = Flask(__name__)
socketio = SocketIO(app)

# Configurar diretórios
diretorio = "arquivos"
log_dir = "logs"
if not os.path.exists(log_dir):
    os.makedirs(log_dir)
if not os.path.exists(diretorio):
    os.makedirs(diretorio)

# Configurar o arquivo de log
log_filename = datetime.now().strftime("%Y%m%d_%H%M%S") + ".log"
log_path = os.path.join(log_dir, log_filename)
logging.basicConfig(filename=log_path, level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

# Configurações de upload
ALLOWED_EXTENSIONS = {
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'pdf': 'application/pdf'
}

def allowed_file(filename, file_type):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Função para registrar logs e enviar ao frontend
def log_and_emit(message, level="info"):
    if level == "info":
        logging.info(message)
    elif level == "warning":
        logging.warning(message)
    elif level == "error":
        logging.error(message)

# Função para obter a versão do Chrome instalado
def obter_versao_chrome():
    try:
        # Tenta obter a versão do Chrome no Windows
        result = subprocess.run([
            'reg', 'query', 
            'HKEY_CURRENT_USER\\Software\\Google\\Chrome\\BLBeacon',
            '/v', 'version'
        ], capture_output=True, text=True, shell=True)
        
        if result.returncode == 0:
            match = re.search(r'version\s+REG_SZ\s+(\d+\.\d+\.\d+\.\d+)', result.stdout)
            if match:
                return match.group(1)
        
        # Alternativa: tentar via linha de comando
        chrome_paths = [
            r'C:\Program Files\Google\Chrome\Application\chrome.exe',
            r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
        ]
        
        for path in chrome_paths:
            if os.path.exists(path):
                result = subprocess.run([path, '--version'], capture_output=True, text=True)
                if result.returncode == 0:
                    match = re.search(r'(\d+\.\d+\.\d+\.\d+)', result.stdout)
                    if match:
                        return match.group(1)
        
        return None
    except Exception as e:
        log_and_emit(f"Erro ao obter versão do Chrome: {e}", level="error")
        return None

# Função para obter a versão do ChromeDriver
def obter_versao_chromedriver():
    try:
        # Verifica se existe chromedriver.exe
        chromedriver_path = "chromedriver.exe"
        if not os.path.exists(chromedriver_path):
            return None
        
        # Executa o chromedriver com --version
        result = subprocess.run([chromedriver_path, '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            match = re.search(r'(\d+\.\d+\.\d+\.\d+)', result.stdout)
            if match:
                return match.group(1)
        
        return None
    except Exception as e:
        log_and_emit(f"Erro ao obter versão do ChromeDriver: {e}", level="error")
        return None

# Função para verificar compatibilidade entre versões
def verificar_compatibilidade_chrome():
    chrome_version = obter_versao_chrome()
    chromedriver_version = obter_versao_chromedriver()
    
    if not chrome_version:
        return {
            'status': 'error',
            'chrome_version': 'Não detectado',
            'chromedriver_version': chromedriver_version or 'Não detectado',
            'compatible': False,
            'message': 'Chrome não foi detectado no sistema'
        }
    
    if not chromedriver_version:
        return {
            'status': 'error',
            'chrome_version': chrome_version,
            'chromedriver_version': 'Não encontrado',
            'compatible': False,
            'message': 'ChromeDriver não foi encontrado'
        }
    
    # Compara as versões principais (major version)
    chrome_major = chrome_version.split('.')[0]
    chromedriver_major = chromedriver_version.split('.')[0]
    
    compatible = chrome_major == chromedriver_major
    
    status = 'success' if compatible else 'warning'
    message = 'Versões compatíveis' if compatible else 'Versões incompatíveis - Atualize o ChromeDriver'
    
    return {
        'status': status,
        'chrome_version': chrome_version,
        'chromedriver_version': chromedriver_version,
        'compatible': compatible,
        'message': message
    }

# Rota para verificar compatibilidade do ChromeDriver
@app.route('/verificar_chromedriver')
def verificar_chromedriver():
    try:
        resultado = verificar_compatibilidade_chrome()
        return jsonify(resultado)
    except Exception as e:
        return jsonify({
            'status': 'error',
            'chrome_version': 'Erro',
            'chromedriver_version': 'Erro',
            'compatible': False,
            'message': f'Erro ao verificar compatibilidade: {str(e)}'
        })

    
# Página principal
@app.route("/")
def index():
    return render_template("index.html")

# Rota para servir o logo da pasta templates
@app.route("/logo_horizontal_color.png")
def serve_logo():
    return send_from_directory("templates", "logo_horizontal_color.png")

# Função para iniciar o Selenium (com opção de headless ou não)
def iniciar_selenium(headless_mode=True):
    service = Service("chromedriver.exe")
    options = webdriver.ChromeOptions()

    if headless_mode:
        options.add_argument("--headless=new")  # Rodar sem abrir o navegador
        log_and_emit("Rodando Selenium em modo headless.")
    else:
        options.add_argument("--start-maximized")  # Abre o navegador em tela cheia
        log_and_emit("Rodando Selenium com navegador visível.")

    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    driver = webdriver.Chrome(service=service, options=options)
    return driver


# Função genérica para aguardar e clicar em um elemento
def clicar_elemento(driver, by, identifier, action):
    try:
        # Primeiro, aguarda o elemento estar presente
        elemento = WebDriverWait(driver, TIMEOUT).until(EC.presence_of_element_located((by, identifier)))
        
        # Faz scroll para o elemento ficar visível
        driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", elemento)
        time.sleep(1)  # Aguarda o scroll completar
        
        # Tenta aguardar que o elemento seja clicável
        elemento = WebDriverWait(driver, 5).until(EC.element_to_be_clickable((by, identifier)))
        elemento.click()
        log_and_emit(action)
        
    except Exception as e:
        # Se o clique normal falhar, tenta clique via JavaScript
        try:
            log_and_emit(f"Clique normal falhou, tentando via JavaScript para {action}")
            elemento = driver.find_element(by, identifier)
            driver.execute_script("arguments[0].click();", elemento)
            log_and_emit(f"{action} (via JavaScript)")
        except Exception as e2:
            log_and_emit(f"Erro ao {action}: {e2}", level="error")
            socketio.emit("mensagem_personalizada", {"message": f"Erro ao {action}: {e2}", "level": "error"})

# Função genérica para aguardar e inserir texto
def inserir_texto(driver, by, identifier, texto, action):
    try:
        campo_elemento = WebDriverWait(driver, TIMEOUT).until(EC.presence_of_element_located((by, identifier)))
        campo_elemento.clear()
        campo_elemento.send_keys(texto)
        log_and_emit(f"{action} {texto}.")
    except Exception as e:
        log_and_emit(f"Erro {action}: {e}", level="error")
        socketio.emit("mensagem_personalizada", {"message": f"Erro ao {action}: {e}", "level": "error"})

# Função para encontrar o arquivo correspondente ao nome do funcionário
def encontrar_arquivo(nome, diretorio):
    from difflib import SequenceMatcher
    
    """
    Função melhorada para encontrar arquivos PDF correspondentes aos nomes da planilha
    com múltiplas estratégias de busca e maior tolerância a variações
    """
    nomes = nome.strip().upper().split()  # Divide o nome completo da planilha
    primeiro_nome, ultimo_nome = nomes[0], nomes[-1]  # Pega apenas primeiro e último nome
    
    log_and_emit(f"Procurando arquivo para {primeiro_nome} {ultimo_nome} (nome completo: {nome}).")
    
    arquivos_disponiveis = os.listdir(diretorio)
    candidatos = []  # Lista de candidatos com pontuação
    
    for arquivo in arquivos_disponiveis:
        if not arquivo.upper().endswith('.PDF'):
            continue
            
        nome_arquivo = arquivo.upper().replace(".PDF", "").strip()
        
        # Remover prefixo numérico e sufixo " - CMDCA"
        partes = nome_arquivo.split(" - ")
        if len(partes) < 2:
            continue
            
        # Extrair a parte do nome (segunda parte)
        nome_parte = partes[1].strip()
        nomes_arquivo = nome_parte.split()
        
        if len(nomes_arquivo) == 0:
            continue
            
        primeiro_nome_arquivo = nomes_arquivo[0]
        ultimo_nome_arquivo = nomes_arquivo[-1] if len(nomes_arquivo) > 1 else nomes_arquivo[0]
        
        log_and_emit(f"  Analisando: {nome_parte}")
        
        # Calcular pontuação de compatibilidade
        pontuacao = calcular_compatibilidade_avancada(
            nomes,  # Todos os nomes da planilha
            nomes_arquivo,  # Todos os nomes do arquivo
            nome_parte  # Nome completo do arquivo
        )
        
        if pontuacao > 0:
            candidatos.append((arquivo, pontuacao, primeiro_nome_arquivo, ultimo_nome_arquivo))
            log_and_emit(f"    Candidato encontrado com pontuação: {pontuacao:.2f}")
    
    if candidatos:
        # Ordenar por pontuação (maior primeiro)
        candidatos.sort(key=lambda x: x[1], reverse=True)
        melhor_arquivo, melhor_pontuacao, primeiro_arq, ultimo_arq = candidatos[0]
        
        # Aceitar se a pontuação for suficientemente alta
        if melhor_pontuacao >= 0.6:  # 60% de compatibilidade mínima
            log_and_emit(f"✅ Arquivo encontrado: {melhor_arquivo}")
            log_and_emit(f"   Planilha: {' '.join(nomes)}")
            log_and_emit(f"   Arquivo: {primeiro_arq} {ultimo_arq}")
            log_and_emit(f"   Pontuação: {melhor_pontuacao:.2f}")
            return os.path.join(diretorio, melhor_arquivo)
        else:
            log_and_emit(f"❌ Melhor candidato tem pontuação baixa: {melhor_pontuacao:.2f}", level="warning")
    
    log_and_emit(f"Arquivo **NÃO** encontrado para {primeiro_nome} {ultimo_nome}. Processo abortado!", level="error")
    socketio.emit("mensagem_personalizada", {"message": f"Arquivo não encontrado para {primeiro_nome} {ultimo_nome}. Processo abortado!", "level": "error"})
    return None

def calcular_compatibilidade_avancada(nomes_planilha, nomes_arquivo, nome_completo_arquivo):
    """
    Versão avançada que compara todos os nomes, não apenas primeiro e último
    """
    pontuacao = 0.0
    
    # Estratégia 1: Compatibilidade do primeiro nome (obrigatório)
    primeiro_planilha = nomes_planilha[0]
    primeiro_arquivo = nomes_arquivo[0]
    
    compat_primeiro = compatibilidade_nome(primeiro_planilha, primeiro_arquivo)
    if compat_primeiro < 0.5:  # Se o primeiro nome não bate nem um pouco, descartar
        return 0.0
    
    pontuacao += compat_primeiro * 0.5  # 50% do peso para o primeiro nome
    
    # Estratégia 2: Buscar qualquer nome da planilha no arquivo
    nomes_encontrados = 0
    for nome_planilha in nomes_planilha[1:]:  # Pular o primeiro nome
        for nome_arquivo in nomes_arquivo:
            if compatibilidade_nome(nome_planilha, nome_arquivo) > 0.7:
                nomes_encontrados += 1
                pontuacao += 0.2  # 20% por cada nome adicional encontrado
                break  # Não contar o mesmo nome duas vezes
    
    # Estratégia 3: Buscar substrings (para nomes truncados)
    for nome_planilha in nomes_planilha:
        if len(nome_planilha) > 3:  # Apenas para nomes com mais de 3 letras
            for nome_arquivo in nomes_arquivo:
                if nome_planilha.startswith(nome_arquivo) or nome_arquivo.startswith(nome_planilha):
                    pontuacao += 0.1  # 10% de bônus por substring
                    break
    
    # Estratégia 4: Bônus por primeiro nome perfeito
    if compat_primeiro >= 0.9:
        pontuacao += 0.15  # 15% de bônus extra
    
    return min(pontuacao, 1.0)

def compatibilidade_nome(nome1, nome2):
    """Verifica compatibilidade exata ou com truncamento"""
    if nome1 == nome2:
        return 1.0
    
    # Verifica se um é substring do outro (tolerância a truncamento)
    if nome1 in nome2 or nome2 in nome1:
        # Penaliza baseado na diferença de tamanho
        diff = abs(len(nome1) - len(nome2))
        if diff <= 5:  # Tolerância de até 5 caracteres
            return max(0.7, 1.0 - (diff * 0.1))
    
    return 0.0

# função para verificar se todos os PDFs existem antes da execução
def verificar_arquivos(df):
    socketio.emit("mensagem_personalizada", {"message": "Verificando se existem arquivos para todos os registros da planilha", "level": "info"})
    log_and_emit("Verificando se existem arquivos para todos os registros da planilha")

    arquivos_faltando = []
    for _, row in df.iterrows():
        nome = row["Nome"]
        if not encontrar_arquivo(nome, diretorio):  # Se não encontrar o arquivo correspondente, adiciona na lista
            arquivos_faltando.append(nome)

    if arquivos_faltando:
        mensagem_erro = "Processo abortado! Faltam os seguintes arquivos PDF:\n" + "\n".join(arquivos_faltando)
        log_and_emit(mensagem_erro, level="error")
        socketio.emit("mensagem_personalizada", {"message": mensagem_erro, "level": "error"})
        return False  # Retorna False para interromper o processo
    
    return True  # Retorna True se todos os arquivos forem encontrados


# Converter a data de "YYYY-MM-DD" para "DD/MM/YYYY"
def formatar_data(data_iso):
    if data_iso:
        return datetime.strptime(data_iso, "%Y-%m-%d").strftime("%d/%m/%Y")
    return ""

# Função para limpar CPF removendo caracteres especiais e espaços
def limpar_cpf(cpf):
    if cpf is None:
        return ""
    # Converter para string e remover todos os caracteres que não são dígitos
    cpf_limpo = ''.join(filter(str.isdigit, str(cpf)))
    return cpf_limpo

# Dicionário com as opções de parceria para cada órgão
OPCOES_PARCERIAS = {
    "1": [
        {"id": "1", "nome": "CASA DO MENINO JESUS DE PRAGA - 120/2017 - Acolhimento Institucional -  PCD"},
        {"id": "2", "nome": "CASA DO MENINO JESUS DE PRAGA - FNAS - 120/2017 - Acolhimento Institucional -  PCD"},
        {"id": "3", "nome": "CASA DO MENINO JESUS DE PRAGA - TF 040/2020  - Outra"},
        {"id": "4", "nome": "CASA DO MENINO JESUS DE PRAGA - TF 009/2021 - Outra"},
        {"id": "5", "nome": "CASA DO MENINO JESUS DE PRAGA - TF 027/2021 - Outra"},
        {"id": "6", "nome": "CASA DO MENINO JESUS DE PRAGA - TF 006/2022 - Outra"},
        {"id": "7", "nome": "CASA DO MENINO JESUS DE PRAGA - 84518/2023 - Outra"}
        
    ],
    "2": [
        {"id": "1", "nome": "CASA DO MENINO JESUS DE PRAGA - 000026/2019 - Outra"},
        {"id": "2", "nome": "CASA DO MENINO JESUS DE PRAGA - 000116/2019 - Acolhimento Institucional"},
        {"id": "3", "nome": "CASA DO MENINO JESUS DE PRAGA - 000017/2020 - Acolhimento Institucional"},
        {"id": "4", "nome": "CASA DO MENINO JESUS DE PRAGA - 023/2020 - Outra"}
    ],
    "3": [
        {"id": "1", "nome": "CASA DO MENINO JESUS DE PRAGA - FUNCRIANÇA - SMDS - 007/2022 - Outra"},
        {"id": "2", "nome": "CASA DO MENINO JESUS DE PRAGA - FUNCRIANÇA - SMDS - 046/2021 - Pessoas com Deficiências"},
        {"id": "3", "nome": "CASA DO MENINO JESUS DE PRAGA  - FUNCRIANÇA - SMDS - 005/2020 - Outra"},
        {"id": "4", "nome": "CASA DO MENINO JESUS DE PRAGA - 079/2022 - Outra"},
        {"id": "5", "nome": "CASA DO MENINO JESUS DE PRAGA - FUNCRIANÇA - 036/2023 - Outra"}
    ],
    "4": [
        {"id": "1", "nome": "CASA DO MENINO JESUS DE PRAGA - 80830 - Outra"},
        {"id": "2", "nome": "CASA DO MENINO JESUS DE PRAGA - 84541 - Outra"},
        {"id": "3", "nome": "CASA DO MENINO JESUS DE PRAGA - 86619 - Outra"},
        {"id": "4", "nome": "CASA DO MENINO JESUS DE PRAGA - 88678 - Outra"},
        {"id": "5", "nome": "CASA DO MENINO JESUS DE PRAGA - 88677 - Outra"},
        {"id": "6", "nome": "CASA DO MENINO JESUS DE PRAGA - 88871 - Outra"},
        {"id": "7", "nome": "CASA DO MENINO JESUS DE PRAGA - 88873 - Outra"},
        {"id": "8", "nome": "CASA DO MENINO JESUS DE PRAGA - 88872 - Outra"},
        {"id": "9", "nome": "CASA DO MENINO JESUS DE PRAGA - 89206 - Outra"},
        {"id": "10", "nome": "CASA DO MENINO JESUS DE PRAGA - 88676 - Outra"},
        {"id": "11", "nome": "CASA DE SAUDE MENINO JESUS DE PRAGA - 91878 - Outra"},
        {"id": "12", "nome": "CASA DE SAUDE MENINO JESUS DE PRAGA - 88843 - Outra"},
        {"id": "13", "nome": "CASA DE SAUDE MENINO JESUS DE PRAGA - 88675 - Outra"}
    ]
}

# Rota para retornar as parcerias com base no órgão selecionado
@app.route("/get_parcerias", methods=["POST"])
def get_parcerias():
    data = request.json
    orgao_publico = data.get("orgao_publico", "")

    # Obter as parcerias do órgão selecionado
    parcerias = OPCOES_PARCERIAS.get(orgao_publico, [])

    return jsonify({"parcerias": parcerias})


# Função principal que inicia o robô
@app.route("/start_robot", methods=["POST"])
def start_robot():
    try:
        # Ler dados do frontend
        data = request.json
        data_emissao = data.get("data_emissao")
        data_pagamento = data.get("data_pagamento")
        orgao_publico = data.get("orgao_publico")
        parceria = data.get("parceria")
        headless_mode = data.get("headless_mode", True)  # Por padrão é True
        modo_simulacao = data.get("modo_simulacao", False)  # Por padrão é False

        # Ler configurações do JSON
        with open("config.json", "r") as f:
            config = json.load(f)

        url, usuario, senha = config["url"], config["usuario"], config["senha"]

        # Criar variável ano_mes
        ano_mes = datetime.now().strftime("%Y%m")
        log_and_emit(f"Ano e mês: {ano_mes}")

        # Carregar a planilha
        df = pd.read_excel("planilha.xlsx")

        # 🚨 Verificar se TODOS os arquivos estão disponíveis ANTES de continuar
        if not verificar_arquivos(df):
            return jsonify({"status": "error", "message": "Faltam arquivos PDF. Processo abortado!"})

        # Iniciar Selenium (Só será executado se todos os arquivos existirem)
        driver = iniciar_selenium(headless_mode)
        driver.get(url)

        # Fazer login
        socketio.emit("mensagem_personalizada", {"message": "Iniciando Login...", "level": "info"})
        inserir_texto(driver, By.ID, "username", usuario, "Usuário inserido:")
        inserir_texto(driver, By.ID, "password", senha, "Senha inserida:")
        clicar_elemento(driver, By.XPATH, '//*[@id="kc-login"]', "Clicado em Entrar")
        socketio.emit("mensagem_personalizada", {"message": "Login realizado!", "level": "info"})

        # Selecionar Órgão da Administração Pública
        seletor_orgao = f"/html/body/app-root/app-exibe-parceria-usuario/div/div[1]/div/div/select/option[{orgao_publico}]"
                          
        clicar_elemento(driver, By.XPATH, seletor_orgao, f"Selecionado Órgão ID {orgao_publico}")

        # Selecionar Parceria
        seletor_parceria = f"/html/body/app-root/app-exibe-parceria-usuario/div/div[1]/div[2]/div/select/option[{parceria}]"
                             
                             
        clicar_elemento(driver, By.XPATH, seletor_parceria, f"Selecionado Parceria ID {parceria}")

        # Função para encontrar coluna independente de maiúscula/minúscula
        def encontrar_coluna(df, nome_coluna):
            for col in df.columns:
                if col.lower() == nome_coluna.lower():
                    return col
            raise KeyError(f"Coluna '{nome_coluna}' não encontrada. Colunas disponíveis: {list(df.columns)}")

        # Encontrar as colunas corretas independente de case
        col_nome = encontrar_coluna(df, "nome")
        col_cpf = encontrar_coluna(df, "cpf")
        col_valor = encontrar_coluna(df, "valor")

        # Clicar no botão de inclusão
        clicar_elemento(driver, By.XPATH, '//*[@id="desembolsos-header"]/button', "Clicado em Incluir Desembolsos")

        # Processar planilha
        for _, row in df.iterrows():
            nome, cpf, valor = row[col_nome], row[col_cpf], row[col_valor]
            
            # Limpar CPF removendo caracteres especiais e espaços
            cpf_limpo = limpar_cpf(cpf)
            
            arquivo_existe = encontrar_arquivo(nome, diretorio)

            socketio.emit("mensagem_personalizada", {"message": f"Inserindo dados de {nome}", "level": "info"})

            if not arquivo_existe:
                log_and_emit(f"Pulando {nome} pois o arquivo não existe.", level="warning")
                continue
            valor_formatado = f"{valor},00"
            # Converter datas do payload antes de inseri-las
            data_emissao_formatada = formatar_data(data_emissao)
            data_pagamento_formatada = formatar_data(data_pagamento)

            clicar_elemento(driver, By.XPATH, '//*[@id="button-insert"]', "Clicado em Adicionar Novo Registro")
            clicar_elemento(driver, By.XPATH, "/html/body/ngb-modal-window/div/div/form/div/div[1]/div[1]/div/select/option[2]", "Selecionado Natureza da Despesa: Pagamento de Pessoal")   
            clicar_elemento(driver, By.XPATH, "/html/body/ngb-modal-window/div/div/form/div/div[1]/div[2]/div/select/option[15]", "Selecionado Tipo de Documento: Outros")

            inserir_texto(driver, By.XPATH, '//*[@id="nroDoc"]', ano_mes, "Número do Documento inserido")
            inserir_texto(driver, By.XPATH, '//*[@id="cpfCnpj"]', cpf_limpo, "CPF inserido")
            clicar_elemento(driver, By.XPATH, '/html/body/ngb-modal-window/div/div/div[1]', "Clicado no modal")
            time.sleep(3)
            # inserir_texto(driver, By.XPATH, '//*[@id="nomeCredor"]', nome, "Nome inserido")
            inserir_texto(driver, By.XPATH, '/html/body/ngb-modal-window/div/div/form/div/div[4]/div[1]/input', data_emissao_formatada, "Data de Emissão inserida")
            inserir_texto(driver, By.XPATH, '/html/body/ngb-modal-window/div/div/form/div/div[4]/div[2]/input', str(valor_formatado), "Valor inserido")
            inserir_texto(driver, By.XPATH, '/html/body/ngb-modal-window/div/div/form/div/div[4]/div[3]/input', data_pagamento_formatada, "Data de Pagamento inserida")
            inserir_texto(driver, By.XPATH, '/html/body/ngb-modal-window/div/div/form/div/div[4]/div[4]/input', str(valor_formatado), "Valor Total do Documento inserido")
            time.sleep(3)

            # Upload de arquivo
            if arquivo_existe:
                driver.find_element(By.XPATH, '/html/body/ngb-modal-window/div/div/form/div/div[7]/div[2]/div/div/div/input').send_keys(os.path.abspath(arquivo_existe))
                log_and_emit(f"Arquivo {arquivo_existe} enviado.")
                time.sleep(3)

            if modo_simulacao:
                log_and_emit("MODO SIMULAÇÃO: Clicando em Cancelar ao invés de Salvar")
                socketio.emit("mensagem_personalizada", {"message": "MODO SIMULAÇÃO: Clicando em Cancelar ao invés de Salvar", "level": "warning"})
                
                clicar_elemento(driver, By.XPATH, '/html/body/ngb-modal-window/div/div/form/div/div[8]/button[1]', "Clicado no botão CANCELAR")
            else:
                # Código original para salvar
                clicar_elemento(driver, By.XPATH, '/html/body/ngb-modal-window/div/div/form/div/div[8]/button[2]', "Clicado no botão SALVAR")

            socketio.emit("mensagem_personalizada", {"message": f"Dados inseridos", "level": "info"})

        log_and_emit("Processo finalizado.")
        # driver.quit()
        return jsonify({"status": "success"})

    except Exception as e:
        log_and_emit(f"Erro: {str(e)}", level="error")
        return jsonify({"status": "error", "message": str(e)})

# Rota para verificar status dos arquivos
@app.route('/status_arquivos')
def status_arquivos():
    try:
        planilha = None
        if os.path.exists('planilha.xlsx'):
            planilha = 'planilha.xlsx'
        
        # Conta arquivos PDF independente da capitalização
        pdfs = len([f for f in os.listdir(diretorio) if f.lower().endswith('.pdf')])
        
        # Lista todos os arquivos PDF para log
        pdf_files = [f for f in os.listdir(diretorio) if f.lower().endswith('.pdf')]
        log_and_emit(f"Arquivos PDF encontrados: {len(pdf_files)}")
        for pdf in pdf_files[:5]:  # Lista os primeiros 5 arquivos como exemplo
            log_and_emit(f"PDF encontrado: {pdf}")
        if len(pdf_files) > 5:
            log_and_emit(f"... e mais {len(pdf_files) - 5} arquivo(s)")
        
        return jsonify({
            'status': 'success',
            'planilha': planilha,
            'pdfs': pdfs,
            'pdf_list': pdf_files  # Enviando a lista completa para o frontend
        })
    except Exception as e:
        log_and_emit(f"Erro ao verificar status dos arquivos: {str(e)}", level="error")
        return jsonify({
            'status': 'error',
            'message': str(e)
        })

# Rota para upload da planilha
@app.route('/upload_planilha', methods=['POST'])
def upload_planilha():
    try:
        if 'planilha' not in request.files:
            return jsonify({
                'status': 'error',
                'message': 'Nenhum arquivo enviado'
            })
        
        file = request.files['planilha']
        if file.filename == '':
            return jsonify({
                'status': 'error',
                'message': 'Nenhum arquivo selecionado'
            })
        
        if not allowed_file(file.filename, 'xlsx'):
            return jsonify({
                'status': 'error',
                'message': 'Tipo de arquivo não permitido. Use apenas arquivos .xlsx'
            })
        
        # Se já existir uma planilha, fazer backup
        if os.path.exists('planilha.xlsx'):
            backup_name = f'planilha_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
            os.rename('planilha.xlsx', backup_name)
        
        # Salvar nova planilha
        file.save('planilha.xlsx')
        
        return jsonify({
            'status': 'success',
            'message': 'Planilha enviada com sucesso'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        })

# Rota para upload de PDFs
@app.route('/upload_pdfs', methods=['POST'])
def upload_pdfs():
    try:
        if 'pdfs' not in request.files:
            return jsonify({
                'status': 'error',
                'message': 'Nenhum arquivo enviado'
            })
        
        files = request.files.getlist('pdfs')
        if not files or files[0].filename == '':
            return jsonify({
                'status': 'error',
                'message': 'Nenhum arquivo selecionado'
            })
        
        uploaded_count = 0
        for file in files:
            if file and allowed_file(file.filename, 'pdf'):
                # Usar o nome original do arquivo, apenas convertendo para maiúsculas
                filename = file.filename.upper()
                file.save(os.path.join(diretorio, filename))
                uploaded_count += 1
        
        return jsonify({
            'status': 'success',
            'message': f'{uploaded_count} arquivo(s) enviado(s) com sucesso'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        })

# Rota para excluir a planilha
@app.route('/excluir_planilha', methods=['POST'])
def excluir_planilha():
    try:
        if os.path.exists('planilha.xlsx'):
            # Criar backup antes de excluir
            backup_name = f'planilha_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
            os.rename('planilha.xlsx', os.path.join('logs', backup_name))
            log_and_emit(f"Backup da planilha criado: {backup_name}")
            
            return jsonify({
                'status': 'success',
                'message': 'Planilha excluída com sucesso'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Planilha não encontrada'
            })
    except Exception as e:
        log_and_emit(f"Erro ao excluir planilha: {str(e)}", level="error")
        return jsonify({
            'status': 'error',
            'message': str(e)
        })

# Rota para excluir todos os PDFs
@app.route('/excluir_pdfs', methods=['POST'])
def excluir_pdfs():
    try:
        deleted_count = 0
        # Lista todos os arquivos na pasta
        for filename in os.listdir(diretorio):
            file_path = os.path.join(diretorio, filename)
            try:
                # Remove o arquivo
                os.remove(file_path)
                deleted_count += 1
                log_and_emit(f"Arquivo excluído: {filename}")
            except Exception as e:
                log_and_emit(f"Erro ao excluir {filename}: {str(e)}", level="error")
        if(deleted_count == 0):
            return jsonify({
                'status': 'error',
                'message': 'Nenhum arquivo foi excluído'
            })
        return jsonify({
            'status': 'success',
            'message': f'{deleted_count} arquivo(s) excluído(s) com sucesso'
        })
    except Exception as e:
        log_and_emit(f"Erro ao excluir arquivos: {str(e)}", level="error")
        return jsonify({
            'status': 'error',
            'message': str(e)
        })

# Iniciar servidor Flask
if __name__ == "__main__":
    socketio.run(app, debug=True)
