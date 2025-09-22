import { PDFDocument } from 'https://cdn.skypack.dev/pdf-lib';

let cutCount = 0;
let pdfHeight = 842; // Altura padrão do A4 em pixels (72 DPI)
let mmToPxRatio = 2.834645669; // Conversão: 1mm = 2.834645669 pixels (72 DPI)

// Função para converter milímetros para pixels
function mmToPx(mm) {
  return Math.round(mm * mmToPxRatio);
}

// Função para converter pixels para milímetros
function pxToMm(px) {
  return Math.round(px / mmToPxRatio);
}

// Função para converter coordenada "do topo" para "da base" (que a biblioteca precisa)
function topToBottomCoordinate(topMm, totalHeightMm = 297) {
  return totalHeightMm - topMm;
}

// Função para converter milímetros para posição na visualização A4 (0-297mm para 0-396px)
function mmToPreviewPos(mm) {
  return (mm / 297) * 396; // 396px é a altura da visualização A4
}

// Função para adicionar animação de loading
function showLoading(element, text = 'Processando...') {
  element.innerHTML = `
    <div class="flex items-center justify-center space-x-2 text-blue-600">
      <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
      <span>${text}</span>
    </div>
  `;
}

// Função para adicionar animação de sucesso
function showSuccess(element, text) {
  element.innerHTML = `
    <div class="flex items-center space-x-2 text-green-600 animate-pulse">
      <span>✅</span>
      <span>${text}</span>
    </div>
  `;
  setTimeout(() => {
    element.innerHTML = '';
  }, 3000);
}

// Função para criar a régua
function createRuler() {
  const ruler = document.querySelector('.ruler');
  ruler.innerHTML = '';
  
  // Criar marcações a cada 50mm
  for (let mm = 0; mm <= 297; mm += 50) {
    const mark = document.createElement('div');
    mark.className = 'ruler-mark';
    mark.style.top = `${mmToPreviewPos(mm)}px`;
    ruler.appendChild(mark);
    
    if (mm % 100 === 0 || mm === 297) {
      const label = document.createElement('div');
      label.className = 'ruler-label';
      label.style.top = `${mmToPreviewPos(mm)}px`;
      label.textContent = `${mm}`;
      ruler.appendChild(label);
    }
  }
}

// Função para determinar a posição no documento
function getDocumentPosition(startTopMm, endTopMm) {
  const centerMm = (startTopMm + endTopMm) / 2;
  const percentage = (centerMm / 297) * 100;
  
  if (percentage <= 33) return 'topo';
  if (percentage <= 66) return 'meio';
  return 'base';
}

// Função para obter ordinal em português
function getOrdinal(num) {
  if (num === 1) return '1º';
  if (num === 2) return '2º';
  if (num === 3) return '3º';
  return `${num}º`;
}

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Função para extrair nome do funcionário via PDF.js
async function extractEmployeeName(pdfBytes) {
  try {
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
    const page = await pdfDoc.getPage(1);
    const textContent = await page.getTextContent();

    // Extrair todos os textos e suas posições
    const textItems = textContent.items.map(item => ({
      text: item.str.trim(),
      x: item.transform[4],
      y: item.transform[5]
    }));

    // Ordenar por posição Y (de cima para baixo) e depois por X (esquerda para direita)
    textItems.sort((a, b) => {
      if (Math.abs(a.y - b.y) < 5) { // Se estão na mesma linha (tolerância de 5px)
        return a.x - b.x; // Ordenar por X
      }
      return b.y - a.y; // Ordenar por Y (decrescente, pois Y cresce para baixo)
    });

    console.log('Textos extraídos:', textItems.map(item => item.text));

    // Estratégia 1: Procurar por código de 3 dígitos seguido de nome
    for (let i = 0; i < textItems.length - 1; i++) {
      const currentText = textItems[i].text;
      
      // Se encontrar um código de 3 dígitos (como "381")
      if (/^\d{3}$/.test(currentText)) {
        console.log('🔍 Código encontrado:', currentText);
        
        // Concatenar os próximos textos que formam o nome
        let fullName = '';
        const excludedWords = ['CASA', 'SAÚDE', 'MENINO', 'JESUS', 'PRAGA', 'CNPJ', 'TÉCNICO', 'ENFERMAGEM'];
        let nameStarted = false;
        
        for (let j = i + 1; j < textItems.length; j++) {
          const candidateText = textItems[j].text;
          
          // Parar se encontrar um número longo (como CBO)
          if (/^\d{5,}$/.test(candidateText)) {
            break;
          }
          
          // Se é uma palavra válida para nome
          if (/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]+$/.test(candidateText) && candidateText.length >= 2) {
            if (!excludedWords.includes(candidateText)) {
              if (fullName) fullName += ' ';
              fullName += candidateText;
              nameStarted = true;
            }
          } else if (nameStarted && candidateText.trim() === '') {
            // Continuar concatenando espaços
            continue;
          } else if (nameStarted) {
            // Parar se encontrar algo que não seja parte do nome
            break;
          }
        }
        
        if (fullName && fullName.length >= 5) {
          console.log('✅ Nome completo encontrado após código:', fullName);
          return fullName.replace(/\s+/g, '_');
        }
      }
    }

    // Estratégia 2: Procurar linha que contenha "Nome do Funcionário" e pegar o próximo
    const nomeIndex = textItems.findIndex(item =>
      item.text.toLowerCase().includes('nome') && 
      item.text.toLowerCase().includes('funcionário')
    );

    if (nomeIndex !== -1 && nomeIndex < textItems.length - 1) {
      const possibleName = textItems[nomeIndex + 1].text;
      if (/^[A-ZÁÉÍÓÚÃÕÇ\s]{5,}$/.test(possibleName)) {
        console.log('Nome encontrado via "Nome do Funcionário":', possibleName);
        return possibleName.replace(/\s+/g, '_');
      }
    }

    // Estratégia 3: Tentar concatenar palavras consecutivas que formem um nome
    for (let i = 0; i < textItems.length; i++) {
      const currentText = textItems[i].text;
      
      // Se encontrar uma palavra que pode ser início de nome
      if (/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]{3,}$/.test(currentText)) {
        let fullName = currentText;
        const excludedWords = ['CASA', 'SAÚDE', 'MENINO', 'JESUS', 'PRAGA', 'CNPJ', 'TÉCNICO', 'ENFERMAGEM'];
        
        if (!excludedWords.includes(currentText)) {
          // Tentar concatenar as próximas palavras
          for (let j = i + 1; j < textItems.length && j < i + 10; j++) {
            const nextText = textItems[j].text;
            
            if (/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]{2,}$/.test(nextText) && !excludedWords.includes(nextText)) {
              fullName += ' ' + nextText;
            } else if (nextText.trim() === '') {
              continue;
            } else {
              break;
            }
          }
          
          // Se formou um nome com pelo menos 2 palavras e 10 caracteres
          if (fullName.includes(' ') && fullName.length >= 10) {
            console.log('✅ Nome concatenado encontrado:', fullName);
            return fullName.replace(/\s+/g, '_');
          }
        }
      }
    }
    
    // Estratégia 4: Procurar por linha isolada em letras maiúsculas (nome completo)
    const nameLine = textItems.find(item =>
      /^[A-ZÁÉÍÓÚÃÕÇ\s]{10,}$/.test(item.text) &&
      !item.text.includes('CASA') &&
      !item.text.includes('SAÚDE') &&
      !item.text.includes('MENINO') &&
      !item.text.includes('JESUS') &&
      !item.text.includes('PRAGA') &&
      !item.text.includes('CNPJ') &&
      !item.text.includes('TÉCNICO') &&
      !item.text.includes('ENFERMAGEM')
    );

    if (nameLine) {
      console.log('Nome encontrado por padrão alternativo:', nameLine.text);
      return nameLine.text.replace(/\s+/g, '_');
    }

    // Estratégia 5: Procurar especificamente por padrão "código + nome + número"
    const fullText = textItems.map(item => item.text).join(' ');
    const match = fullText.match(/(\d{3})\s+([A-ZÁÉÍÓÚÃÕÇ\s]+?)\s+(\d{5,})/);
    if (match && match[2]) {
      const name = match[2].trim();
      console.log('Nome encontrado via regex completa:', name);
      return name.replace(/\s+/g, '_');
    }

    console.log('Nenhum nome encontrado');
    return null;
  } catch (error) {
    console.error('Erro ao extrair nome com pdfjs-dist:', error);
    return null;
  }
}


async function generateFileName(pdfBytes, cut, pageIndex) {
  const employeeName = await extractEmployeeName(pdfBytes);
  if (employeeName) {
    return `${employeeName}.pdf`;
  }
  
  // Fallback para nome padrão se OCR falhar
  return `contracheque_${cut.position}_p${pageIndex + 1}_${cut.startTopMm}-${cut.endTopMm}mm.pdf`;
}

// Função para atualizar a visualização A4 com animações
function updateA4Preview() {
  const preview = document.getElementById('a4Preview');
  if (!preview) return;
  
  // Limpar visualização anterior
  const existingElements = preview.querySelectorAll('.cut-line, .cut-area, .cut-label, .cut-area-label, .visual-order-indicator');
  existingElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'scale(0.8)';
    setTimeout(() => el.remove(), 200);
  });
  
  // Aguardar um pouco antes de adicionar novos elementos
  setTimeout(() => {
    // Cores para cada recibo
    const reciboColors = [
      { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', text: '#1e40af', dot: '#3b82f6' }, // Azul
      { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#047857', dot: '#10b981' }, // Verde
      { bg: 'rgba(147, 51, 234, 0.15)', border: '#9333ea', text: '#7c3aed', dot: '#9333ea' }, // Roxo
      { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#d97706', dot: '#f59e0b' }, // Amarelo
      { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#dc2626', dot: '#ef4444' }, // Vermelho
    ];
    
    // Adicionar linhas de corte e áreas
    for (let i = 1; i <= cutCount; i++) {
      const startInput = document.getElementById(`cut${i}StartMm`);
      const endInput = document.getElementById(`cut${i}EndMm`);
      
      if (startInput && endInput) {
        const startTopMm = parseFloat(startInput.value) || 0;
        const endTopMm = parseFloat(endInput.value) || 0;
        const colorIndex = (i - 1) % reciboColors.length;
        const colors = reciboColors[colorIndex];
        
        // Linha de início (vermelha)
        const startLine = document.createElement('div');
        startLine.className = 'cut-line';
        startLine.style.top = `${mmToPreviewPos(startTopMm)}px`;
        startLine.style.opacity = '0';
        startLine.style.transform = 'scale(0.8)';
        
        const startLabel = document.createElement('div');
        startLabel.className = 'cut-label start';
        startLabel.textContent = `${startTopMm}mm`;
        startLine.appendChild(startLabel);
        
        preview.appendChild(startLine);
        
        // Animar entrada
        setTimeout(() => {
          startLine.style.opacity = '1';
          startLine.style.transform = 'scale(1)';
        }, i * 100);
        
        // Linha de fim (verde)
        const endLine = document.createElement('div');
        endLine.className = 'cut-line end';
        endLine.style.top = `${mmToPreviewPos(endTopMm)}px`;
        endLine.style.opacity = '0';
        endLine.style.transform = 'scale(0.8)';
        
        const endLabel = document.createElement('div');
        endLabel.className = 'cut-label end';
        endLabel.textContent = `${endTopMm}mm`;
        endLine.appendChild(endLabel);
        
        preview.appendChild(endLine);
        
        // Animar entrada
        setTimeout(() => {
          endLine.style.opacity = '1';
          endLine.style.transform = 'scale(1)';
        }, i * 100 + 50);
        
        // Área de corte (com cor específica do recibo)
        if (startTopMm < endTopMm) {
          const cutArea = document.createElement('div');
          cutArea.className = 'cut-area';
          cutArea.style.top = `${mmToPreviewPos(startTopMm)}px`;
          cutArea.style.height = `${mmToPreviewPos(endTopMm) - mmToPreviewPos(startTopMm)}px`;
          cutArea.style.opacity = '0';
          cutArea.style.transform = 'scale(0.9)';
          cutArea.style.background = colors.bg;
          cutArea.style.borderColor = colors.border;
          
          const position = getDocumentPosition(startTopMm, endTopMm);
          
          const areaLabel = document.createElement('div');
          areaLabel.className = 'cut-area-label';
          areaLabel.textContent = `${getOrdinal(i)} (${position})`;
          areaLabel.style.color = colors.text;
          areaLabel.style.borderColor = colors.border;
          cutArea.appendChild(areaLabel);
          
          // Indicador de ordem visual
          const orderIndicator = document.createElement('div');
          orderIndicator.className = 'visual-order-indicator';
          orderIndicator.style.backgroundColor = colors.dot;
          orderIndicator.textContent = i;
          cutArea.appendChild(orderIndicator);
          
          preview.appendChild(cutArea);
          
          // Animar entrada
          setTimeout(() => {
            cutArea.style.opacity = '1';
            cutArea.style.transform = 'scale(1)';
          }, i * 100 + 100);
        }
      }
    }
  }, 250);
}

// Função para sincronizar campos mm e px com animação
function syncFields(cutIndex, fieldType) {
  const mmInput = document.getElementById(`cut${cutIndex}${fieldType}Mm`);
  const pxSpan = document.getElementById(`cut${cutIndex}${fieldType}Px`);
  
  if (mmInput && pxSpan) {
    const mmValue = parseFloat(mmInput.value) || 0;
    const pxValue = mmToPx(mmValue);
    
    // Animar mudança de valor
    pxSpan.style.transform = 'scale(1.1)';
    pxSpan.style.color = '#3b82f6';
    pxSpan.textContent = pxValue;
    
    setTimeout(() => {
      pxSpan.style.transform = 'scale(1)';
      pxSpan.style.color = '#6b7280';
    }, 300);
    
    updateA4Preview();
  }
}

// Função para obter os pontos de corte convertidos para coordenadas da biblioteca
function getCutPoints() {
  const cuts = [];
  for (let i = 1; i <= cutCount; i++) {
    const startInput = document.getElementById(`cut${i}StartMm`);
    const endInput = document.getElementById(`cut${i}EndMm`);
    if (startInput && endInput) {
      const startTopMm = parseFloat(startInput.value) || 0;
      const endTopMm = parseFloat(endInput.value) || 0;
      
      // Converter coordenadas "do topo" para "da base" (que a biblioteca precisa)
      const startBottomMm = topToBottomCoordinate(endTopMm); // Invertido: fim do topo = início da base
      const endBottomMm = topToBottomCoordinate(startTopMm); // Invertido: início do topo = fim da base
      
      cuts.push({
        start: mmToPx(startBottomMm),
        end: mmToPx(endBottomMm),
        startTopMm: startTopMm,
        endTopMm: endTopMm,
        position: getDocumentPosition(startTopMm, endTopMm)
      });
    }
  }
  return cuts;
}

// Função para criar campo de corte
function createCutField(index) {
  const reciboColors = [
    { bg: 'bg-blue-100', text: 'text-blue-800' },
    { bg: 'bg-green-100', text: 'text-green-800' },
    { bg: 'bg-purple-100', text: 'text-purple-800' },
    { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    { bg: 'bg-red-100', text: 'text-red-800' },
  ];
  
  const colorIndex = (index - 1) % reciboColors.length;
  const colors = reciboColors[colorIndex];
  
  // Valores padrão para contracheques (dividir ao meio)
  let defaultStart, defaultEnd;
  if (index === 1) { 
    defaultStart = 0; 
    defaultEnd = 145; // Primeira metade (0 a meio da página)
  }
  else if (index === 2) { 
    defaultStart = 146; 
    defaultEnd = 297; // Segunda metade (meio até o final)
  }
  else { 
    defaultStart = 0; 
    defaultEnd = 50; 
  }
  
  const cutDiv = document.createElement('div');
  cutDiv.className = 'form-group';
  cutDiv.style.opacity = '0';
  cutDiv.style.transform = 'translateX(20px)';
  cutDiv.id = `cutField${index}`;
  
  cutDiv.innerHTML = `
    <label class="block text-sm font-semibold text-gray-700 mb-2">
      <span class="${colors.bg} ${colors.text} px-2 py-1 rounded text-xs font-bold mr-2">${getOrdinal(index)}</span>
      ${getOrdinal(index)} Contracheque (do topo do documento)
    </label>
    <div class="flex items-center space-x-3">
      <div class="input-group flex-1">
        <input type="number" id="cut${index}StartMm" value="${defaultStart}" 
               class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300" 
               placeholder="mm" min="0" max="297" />
        <span class="text-xs text-gray-500 mt-1 block">Início do topo (mm)</span>
      </div>
      <span class="text-gray-400 font-medium">até</span>
      <div class="input-group flex-1">
        <input type="number" id="cut${index}EndMm" value="${defaultEnd}" 
               class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300" 
               placeholder="mm" min="0" max="297" />
        <span class="text-xs text-gray-500 mt-1 block">Fim do topo (mm)</span>
      </div>
    </div>
    <div class="text-xs text-gray-500 mt-2">
      (<span id="cut${index}StartPx" class="font-mono">${mmToPx(defaultStart)}</span>px - <span id="cut${index}EndPx" class="font-mono">${mmToPx(defaultEnd)}</span>px)
    </div>
    ${index > 2 ? `<button onclick="removeCut(${index})" class="text-red-500 text-sm hover:text-red-700 transition-colors duration-200 mt-2">✕ Remover</button>` : ''}
  `;
  
  return cutDiv;
}

// Função para configurar event listeners para sincronização
function setupFieldSync() {
  for (let i = 1; i <= cutCount; i++) {
    const startInput = document.getElementById(`cut${i}StartMm`);
    const endInput = document.getElementById(`cut${i}EndMm`);
    
    if (startInput) {
      startInput.addEventListener('input', () => syncFields(i, 'Start'));
    }
    if (endInput) {
      endInput.addEventListener('input', () => syncFields(i, 'End'));
    }
  }
}

// Função para inicializar campos padrão
function initializeDefaultCuts() {
  const container = document.getElementById('cutsContainer');
  
  // Criar 2 campos padrão para contracheques (ao meio)
  for (let i = 1; i <= 2; i++) {
    cutCount = i;
    const cutField = createCutField(i);
    container.appendChild(cutField);
    
    // Animar entrada
    setTimeout(() => {
      cutField.style.opacity = '1';
      cutField.style.transform = 'translateX(0)';
    }, i * 100);
  }
  
  setTimeout(() => {
    setupFieldSync();
    updateA4Preview();
  }, 500);
}

// Adiciona novo campo de corte dinamicamente com animação
document.getElementById('addCutBtn').addEventListener('click', () => {
  cutCount++;
  const container = document.getElementById('cutsContainer');
  const newCutField = createCutField(cutCount);
  
  container.appendChild(newCutField);
  
  // Animar entrada
  setTimeout(() => {
    newCutField.style.opacity = '1';
    newCutField.style.transform = 'translateX(0)';
  }, 50);
  
  setupFieldSync();
});

// Função para remover corte com animação
window.removeCut = function(cutIndex) {
  const cutDiv = document.getElementById(`cutField${cutIndex}`);
  if (cutDiv) {
    cutDiv.style.opacity = '0';
    cutDiv.style.transform = 'translateX(-20px)';
    
    setTimeout(() => {
      cutDiv.remove();
      cutCount--;
      updateA4Preview();
    }, 300);
  }
}

// Visualiza altura e largura do PDF
document.getElementById('previewBtn').addEventListener('click', async () => {
  const fileInput = document.getElementById('pdfInput');
  if (!fileInput.files.length) {
    showSuccess(document.getElementById('output'), 'Selecione um PDF primeiro.');
    return;
  }

  const outputDiv = document.getElementById('output');
  showLoading(outputDiv, 'Analisando PDF...');

  try {
    const pdfBytes = await fileInput.files[0].arrayBuffer();
    const originalPdf = await PDFDocument.load(pdfBytes);
    const page = originalPdf.getPage(0);
    const { width, height } = page.getSize();
    
    // Atualizar variáveis globais
    pdfHeight = height;
    mmToPxRatio = height / 297; // 297mm é a altura do A4
    
    const infoDiv = document.getElementById('pdfInfo');
    infoDiv.innerHTML = `
      <div class="flex items-center space-x-2 mb-2">
        <span class="text-blue-600">📊</span>
        <strong class="text-blue-800">Dimensões do PDF:</strong>
      </div>
      <div class="space-y-1 text-sm">
        <div>📏 Largura: <span class="font-mono">${Math.round(width)}</span> pixels (<span class="font-mono">${Math.round(pxToMm(width))}</span>mm)</div>
        <div>📐 Altura: <span class="font-mono">${Math.round(height)}</span> pixels (<span class="font-mono">${Math.round(pxToMm(height))}</span>mm)</div>
        <div>📄 Total de páginas: <span class="font-mono">${originalPdf.getPageCount()}</span></div>
        <div>⚙️ Razão de conversão: <span class="font-mono">1mm = ${mmToPxRatio.toFixed(2)}</span> pixels</div>
      </div>
    `;
    infoDiv.classList.remove('hidden');
    infoDiv.style.animation = 'fadeIn 0.5s ease-out';
    
    // Atualizar a visualização A4
    updateA4Preview();
    
    // Sincronizar todos os campos
    for (let i = 1; i <= cutCount; i++) {
      syncFields(i, 'Start');
      syncFields(i, 'End');
    }
    
    showSuccess(outputDiv, 'PDF analisado com sucesso!');
  } catch (error) {
    outputDiv.innerHTML = `<p class="text-red-600">❌ Erro ao analisar PDF: ${error.message}</p>`;
  }
});

// Processa o PDF com cortes definidos
document.getElementById('processBtn').addEventListener('click', async () => {
  const fileInput = document.getElementById('pdfInput');
  if (!fileInput.files.length) {
    showSuccess(document.getElementById('output'), 'Selecione um PDF.');
    return;
  }

  const cutPoints = getCutPoints();
  if (cutPoints.length === 0) {
    showSuccess(document.getElementById('output'), 'Defina pelo menos um ponto de corte.');
    return;
  }

  const outputDiv = document.getElementById('output');
  const downloadsSection = document.getElementById('downloadsSection');
  
  // Mostrar seção de downloads
  downloadsSection.classList.remove('hidden');
  showLoading(outputDiv, 'Processando PDF...');

  try {
    const pdfBytes = await fileInput.files[0].arrayBuffer();
    const originalPdf = await PDFDocument.load(pdfBytes);
    const pageCount = originalPdf.getPageCount();

    let processedCount = 0;
    const totalCuts = cutPoints.length * pageCount;
    const zip = new JSZip();
    const originalFileName = fileInput.files[0].name.replace('.pdf', '');
    const language = 'por'; // Idioma fixo: português
    
    // Controle de duplicatas - armazenar apenas um arquivo por funcionário
    const uniqueEmployees = new Map(); // nome -> {bytes, fileName, blob}
    const processedFiles = []; // Para controle de progresso

    // Preparar interface para mostrar chips em tempo real
    outputDiv.innerHTML = `
      <div id="progressDiv" class="text-sm text-gray-600 mb-3">Iniciando processamento...</div>
      <div id="zipSection" class="hidden"></div>
      <div id="successSection" class="hidden"></div>
      <div id="chipsSection">
        <h4 class="text-lg font-semibold text-gray-800 mb-3 mt-4">👤 Funcionários Encontrados:</h4>
        <div id="chipsContainer" class="flex flex-wrap gap-3"></div>
      </div>
    `;

    const progressDiv = document.getElementById('progressDiv');
    const chipsContainer = document.getElementById('chipsContainer');

    for (let i = 0; i < pageCount; i++) {
      const page = originalPdf.getPage(i);
      const { width, height } = page.getSize();

      for (let r = 0; r < cutPoints.length; r++) {
        const cut = cutPoints[r];

        if (cut.start >= cut.end) {
          outputDiv.innerHTML = `<p class="text-red-600">❌ Erro no recibo ${r + 1}: ponto inicial deve ser menor que o final</p>`;
          return;
        }

        const newPdf = await PDFDocument.create();
        const cutHeight = cut.end - cut.start;
        const newPage = newPdf.addPage([width, cutHeight]);

        const [copiedPage] = await originalPdf.copyPages(originalPdf, [i]);
        const embeddedPage = await newPdf.embedPage(copiedPage, {
          left: 0,
          bottom: cut.start,
          right: width,
          top: cut.end
        });

        newPage.drawPage(embeddedPage);

        const newBytes = await newPdf.save();
        const blob = new Blob([newBytes], { type: 'application/pdf' });

        // Gerar nome do arquivo com OCR
        const fileName = await generateFileName(newBytes, cut, i);
        
        processedCount++;
        processedFiles.push({ fileName, bytes: newBytes, blob });
        
        // Controle de duplicatas - só manter um arquivo por funcionário
        if (!fileName.startsWith('contracheque_')) {
          const employeeName = fileName.replace('.pdf', '');
          
          // Se é a primeira vez que vemos este funcionário, ou se queremos substituir
          if (!uniqueEmployees.has(employeeName)) {
            uniqueEmployees.set(employeeName, {
              bytes: newBytes,
              fileName: fileName,
              blob: blob
            });
            
            console.log(`✅ Adicionado: ${employeeName}`);
            
            // Adicionar chip em tempo real
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            
            const displayName = employeeName.replace(/_/g, ' ');
            link.innerHTML = `<i class="fa-solid fa-user"></i> ${displayName}`;
            link.className = 'inline-block bg-gradient-to-r from-red-800 to-red-700 text-white hover:from-red-700 hover:to-red-600 border border-red-800 rounded-full px-3 py-1.5 font-medium text-xs transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md cursor-pointer animate-pulse';
            
            // Adicionar animação de entrada
            link.style.opacity = '0';
            link.style.transform = 'scale(0.8)';
            chipsContainer.appendChild(link);
            
            // Animar entrada
            setTimeout(() => {
              link.style.transition = 'all 0.3s ease-out';
              link.style.opacity = '1';
              link.style.transform = 'scale(1)';
              // Remover pulse após animação
              setTimeout(() => {
                link.classList.remove('animate-pulse');
              }, 1000);
            }, 50);
            
          } else {
            console.log(`⚠️ Duplicata ignorada: ${employeeName}`);
          }
        }
        
        // Atualizar progresso
        progressDiv.textContent = `Processando... ${processedCount}/${totalCuts} - ${uniqueEmployees.size} funcionários únicos encontrados`;
      }
    }
    
    // Finalizar processamento
    progressDiv.textContent = `✅ Processamento concluído! ${uniqueEmployees.size} funcionários únicos encontrados`;
    
    // Adicionar apenas os arquivos únicos ao ZIP
    uniqueEmployees.forEach((fileData, employeeName) => {
      zip.file(fileData.fileName, fileData.bytes);
    });
    
    // Gerar arquivo ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipLink = document.createElement('a');
    zipLink.href = URL.createObjectURL(zipBlob);
    zipLink.download = `${originalFileName}_contracheques.zip`;
    zipLink.textContent = `📦 Download Todos os Contracheques (ZIP) - ${uniqueEmployees.size} arquivos únicos`;
    zipLink.className = 'block bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 hover:border-purple-300 transition-all duration-200 p-4 rounded-lg mb-4 font-bold text-center text-lg';
    
    // Mostrar seção do ZIP
    const zipSection = document.getElementById('zipSection');
    zipSection.className = 'mb-4';
    zipSection.appendChild(zipLink);
    
    // Adicionar mensagem de sucesso
    const successDiv = document.createElement('div');
    successDiv.className = 'bg-green-50 border border-green-200 rounded-lg p-4 mb-4';
    successDiv.innerHTML = `
      <div class="flex items-center space-x-2 text-green-800">
        <span class="text-xl">✅</span>
        <span class="font-semibold">Processamento concluído!</span>
      </div>
      <p class="text-green-700 mt-1">${processedCount} arquivos processados, ${uniqueEmployees.size} funcionários únicos. Duplicatas removidas automaticamente.</p>
    `;
    
    const successSection = document.getElementById('successSection');
    successSection.className = 'mb-4';
    successSection.appendChild(successDiv);
  } catch (error) {
    outputDiv.innerHTML = `<p class="text-red-600">❌ Erro ao processar: ${error.message}</p>`;
  }
});

// Inicializar a aplicação
window.addEventListener('load', async () => {
  // Configurar PDF.js
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  
  initializeDefaultCuts();
  createRuler();
  
  // Adicionar efeito de hover nos botões
  const buttons = document.querySelectorAll('button');
  buttons.forEach(button => {
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-1px)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(0)';
    });
  });
});