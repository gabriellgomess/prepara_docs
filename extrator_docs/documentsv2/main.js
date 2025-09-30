// Configuração do worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Limpar referências antigas do Tesseract
if (typeof window !== 'undefined') {
  delete window.Tesseract;
  delete window.tesseract;
}

let cutCount = 0;
let pdfHeight = 842; // Altura A4 em pixels (72 DPI)
let mmToPxRatio = 2.834645669; // 1mm = 2.834645669 pixels (72 DPI)

// Converter milímetros para pixels
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

// Extrair nome do favorecido do PDF usando PDF.js
async function extractEmployeeName(pdfBytes) {
  try {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js não carregado');
    }
    
    // Limpar referências antigas do Tesseract
    if (typeof window !== 'undefined' && (window.Tesseract || window.tesseract)) {
      delete window.Tesseract;
      delete window.tesseract;
    }
    
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
    const page = await pdfDoc.getPage(1);
    const textContent = await page.getTextContent();

    // Extrair textos com suas posições
    const textItems = textContent.items.map(item => ({
      text: item.str.trim(),
      x: item.transform[4],
      y: item.transform[5]
    }));

    // Ordenar por posição Y (cima para baixo), depois X (esquerda para direita)
    textItems.sort((a, b) => {
      if (Math.abs(a.y - b.y) < 5) { // Tolerância mesma linha: 5px
        return a.x - b.x;
      }
      return b.y - a.y; // Y decresce indo para baixo
    });

    // Juntar texto para busca de padrões
    const fullText = textItems.map(item => item.text).join(' ');
    
    // Estratégia 1: Buscar padrão "Favorecido / Banco / Ag / Conta :"
    const favorecidoPattern = /Favorecido\s*\/?\s*Banco\s*\/?\s*Ag\s*\/?\s*Conta\s*:\s*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]+?)(?:\s*-\s*\d|$)/i;
    const favorecidoMatch = fullText.match(favorecidoPattern);
    
    if (favorecidoMatch && favorecidoMatch[1]) {
      const name = favorecidoMatch[1].trim();
      return name.replace(/\s+/g, '_');
    }

    // Estratégia 2: Buscar por posição após "Favorecido"
    let favorecidoIndex = -1;
    for (let i = 0; i < textItems.length; i++) {
      if (textItems[i].text.toLowerCase().includes('favorecido')) {
        favorecidoIndex = i;
        break;
      }
    }

    if (favorecidoIndex !== -1) {
      for (let j = favorecidoIndex + 1; j < textItems.length && j < favorecidoIndex + 10; j++) {
        const candidateText = textItems[j].text;
        
        // Validar se é um nome válido
        if (/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]{5,}$/.test(candidateText) && !candidateText.includes('CASA') && !candidateText.includes('BANCO')) {
          return candidateText.trim().replace(/\s+/g, '_');
        }
      }
    }

    // Estratégia 3: Concatenar palavras próximas
    for (let i = 0; i < textItems.length; i++) {
      const currentText = textItems[i].text;
      
      if (/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]{3,}$/.test(currentText)) {
        let fullName = currentText;
        const excludedWords = ['CASA', 'BANCO', 'CONTA', 'SAÚDE', 'MENINO', 'JESUS', 'BANRISUL', 'RECIBO', 'PAGAMENTO'];
        
        if (!excludedWords.includes(currentText)) {
          for (let j = i + 1; j < textItems.length && j < i + 5; j++) {
            const nextText = textItems[j].text;
            const yDiff = Math.abs(textItems[i].y - textItems[j].y);
            
            // Verificar se está na mesma linha e é palavra válida
            if (yDiff < 10 && /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]{2,}$/.test(nextText) && !excludedWords.includes(nextText)) {
              fullName += ' ' + nextText;
            } else if (nextText.trim() === '' && yDiff < 10) {
              continue;
            } else {
              break;
            }
          }
          
          // Validar nome formado
          if (fullName.includes(' ') && fullName.length >= 8) {
            return fullName.replace(/\s+/g, '_');
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Erro na extração do nome do recibo:', error);
    
    // Limpar referências do Tesseract se erro relacionado
    if (error.message && error.message.toLowerCase().includes('tesseract')) {
      if (typeof window !== 'undefined') {
        delete window.Tesseract;
        delete window.tesseract;
      }
    }
    
    return null;
  }
}

// Gerar nome do arquivo baseado no nome extraído
async function generateFileName(pdfBytes, cut, pageIndex) {
  const employeeName = await extractEmployeeName(pdfBytes);
  if (employeeName) {
    return `${employeeName}.pdf`;
  }
  
  // Fallback para nome padrão
  return `recibo_${cut.position}_p${pageIndex + 1}_${cut.startTopMm}-${cut.endTopMm}mm.pdf`;
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
  
  // Valores padrão baseados na posição
  let defaultStart, defaultEnd;
  if (index === 1) { defaultStart = 20; defaultEnd = 106; }
  else if (index === 2) { defaultStart = 106; defaultEnd = 184; }
  else if (index === 3) { defaultStart = 184; defaultEnd = 261; }
  else { defaultStart = 0; defaultEnd = 50; }
  
  const cutDiv = document.createElement('div');
  cutDiv.className = 'form-group';
  cutDiv.style.opacity = '0';
  cutDiv.style.transform = 'translateX(20px)';
  cutDiv.id = `cutField${index}`;
  
  cutDiv.innerHTML = `
    <label class="block text-sm font-semibold text-gray-700 mb-2">
      <span class="${colors.bg} ${colors.text} px-2 py-1 rounded text-xs font-bold mr-2">${getOrdinal(index)}</span>
      ${getOrdinal(index)} Recibo (do topo do documento)
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
    ${index > 3 ? `<button onclick="removeCut(${index})" class="text-red-500 text-sm hover:text-red-700 transition-colors duration-200 mt-2">✕ Remover</button>` : ''}
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
  
  // Criar 3 campos padrão
  for (let i = 1; i <= 3; i++) {
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

// Verifica se o input file está vazio ou não para liberar o botão
document.getElementById('pdfInput').addEventListener("change", (e) => {
  const buttonDisabled1 = document.getElementById("processBtn");
  const buttonDisabled2 = document.getElementById("previewBtn");
  const fileInput = document.getElementById('pdfInput');

  if(fileInput.files.length > 0){
    buttonDisabled1.disabled = false;
    buttonDisabled2.disabled = false;
  }else {
    buttonDisabled1.disabled = true;
    buttonDisabled2.disabled = true;
  }
})

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
    const originalPdf = await PDFLib.PDFDocument.load(pdfBytes);
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
    const originalPdf = await PDFLib.PDFDocument.load(pdfBytes);
    const pageCount = originalPdf.getPageCount();

    let processedCount = 0;
    const totalCuts = cutPoints.length * pageCount;
    const zip = new JSZip();
    const originalFileName = fileInput.files[0].name.replace('.pdf', '');
    const language = 'por'; // Idioma fixo: português

    for (let i = 0; i < pageCount; i++) {
      const page = originalPdf.getPage(i);
      const { width, height } = page.getSize();

      for (let r = 0; r < cutPoints.length; r++) {
        const cut = cutPoints[r];

        if (cut.start >= cut.end) {
          outputDiv.innerHTML = `<p class="text-red-600">❌ Erro no recibo ${r + 1}: ponto inicial deve ser menor que o final</p>`;
          return;
        }

        const newPdf = await PDFLib.PDFDocument.create();
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
        
        // Adicionar ao ZIP (sempre)
        zip.file(fileName, newBytes);

        // Só criar chip se o nome foi extraído com sucesso
        if (!fileName.startsWith('recibo_')) {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = fileName;
          
          // Nome extraído via OCR - remover .pdf e converter _ para espaços
          // Agora mostra o nome completo
          const nameWithoutExt = fileName.replace('.pdf', '');
          const displayName = nameWithoutExt.replace(/_/g, ' ');
          link.innerHTML = `<i class="fa-solid fa-user"></i> ${displayName}`;
          link.className = 'inline-block bg-gradient-to-r from-green-800 to-green-700 text-white hover:from-green-700 hover:to-green-600 border border-green-800 rounded-full px-3 py-1.5 font-medium text-xs transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md cursor-pointer';

          // Limpar loading inicial se for o primeiro arquivo
          if (processedCount === 0) {
            outputDiv.innerHTML = '';
          }
          
          // Adicionar link de download
          outputDiv.appendChild(link);
        }
        
        processedCount++;
        
        // Atualizar progresso sem sobrescrever os links
        const progressDiv = document.getElementById('progressDiv');
        if (!progressDiv) {
          const progress = document.createElement('div');
          progress.id = 'progressDiv';
          progress.className = 'text-sm text-gray-600 mb-3';
          outputDiv.insertBefore(progress, outputDiv.firstChild);
        }
        document.getElementById('progressDiv').textContent = `Processando... ${processedCount}/${totalCuts}`;
      }
    }
    
    // Gerar arquivo ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipLink = document.createElement('a');
    zipLink.href = URL.createObjectURL(zipBlob);
    zipLink.download = `${originalFileName}_recibos.zip`;
    zipLink.textContent = `📦 Download Todos os Recibos (ZIP) - ${processedCount} arquivos`;
    zipLink.className = 'block bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 hover:border-purple-300 transition-all duration-200 p-4 rounded-lg mb-4 font-bold text-center text-lg';
    
    // Remover div de progresso
    const progressDiv = document.getElementById('progressDiv');
    if (progressDiv) {
      progressDiv.remove();
    }
    
    // Adicionar mensagem de sucesso
    const successDiv = document.createElement('div');
    successDiv.className = 'bg-green-50 border border-green-200 rounded-lg p-4 mb-4';
    successDiv.innerHTML = `
      <div class="flex items-center space-x-2 text-green-800">
        <span class="text-xl">✅</span>
        <span class="font-semibold">Processamento concluído!</span>
      </div>
      <p class="text-green-700 mt-1">${processedCount} arquivos processados. Todos incluídos no ZIP.</p>
    `;
    outputDiv.insertBefore(successDiv, outputDiv.firstChild);
    
    // Adicionar link do ZIP no topo
    outputDiv.insertBefore(zipLink, outputDiv.firstChild);
    
    // Adicionar título para os downloads individuais (apenas arquivos com nomes extraídos)
    const downloadsTitle = document.createElement('h4');
    downloadsTitle.className = 'text-lg font-semibold text-gray-800 mb-3 mt-4';
    downloadsTitle.textContent = '👤 Downloads por Nome:';
    outputDiv.appendChild(downloadsTitle);
    
    // Criar container para os chips
    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'flex flex-wrap gap-3';
    outputDiv.appendChild(chipsContainer);
    
    // Mover todos os links para o container de chips
    const links = outputDiv.querySelectorAll('a[download]');
    links.forEach(link => {
      if (link !== zipLink) { // Não mover o link do ZIP
        chipsContainer.appendChild(link);
      }
    });
  } catch (error) {
    outputDiv.innerHTML = `<p class="text-red-600">❌ Erro ao processar: ${error.message}</p>`;
  }
});

// Inicializar a aplicação
window.addEventListener('load', async () => {
  // Configurar PDF.js
  // pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; // Forçar atualização
  
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