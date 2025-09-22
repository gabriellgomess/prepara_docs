// Extrator de Recibos - Versão 2.1 LIMPA - Usa PDF.js sem OCR

console.log('🔧 Carregando Extrator de Recibos v2.1 - PDF.js Edition');

// Configuração do PDF.js Worker - DEVE estar no início
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let cutCount = 0;
let pdfHeight = 842; // Altura padrão do A4 em pixels (72 DPI)
let mmToPxRatio = 2.834645669; // Conversão: 1mm = 2.834645669 pixels (72 DPI)

// Função para converter milímetros para pixels
function mmToPx(mm) {
  return Math.round(mm * mmToPxRatio);
}

// Função para extrair nome do favorecido via PDF.js - SEM OCR
async function extractEmployeeName(pdfBytes) {
  console.log('🚀 Iniciando extração de nome via PDF.js (SEM Tesseract)');
  
  try {
    // Verificar se PDF.js está disponível
    if (typeof pdfjsLib === 'undefined') {
      console.error('❌ PDF.js não está carregado!');
      throw new Error('PDF.js não está disponível');
    }
    
    console.log('📄 Carregando documento PDF...');
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

    console.log('📝 Textos extraídos do recibo:', textItems.map(item => item.text));

    // Juntar todos os textos em uma string para facilitar a busca do padrão
    const fullText = textItems.map(item => item.text).join(' ');
    console.log('🔍 Texto completo:', fullText);
    
    // Estratégia 1: Buscar padrão "Favorecido / Banco / Ag / Conta :" seguido do nome
    const favorecidoPattern = /Favorecido\s*\/?\s*Banco\s*\/?\s*Ag\s*\/?\s*Conta\s*:\s*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]+?)(?:\s*-\s*\d|$)/i;
    const favorecidoMatch = fullText.match(favorecidoPattern);
    
    if (favorecidoMatch && favorecidoMatch[1]) {
      const name = favorecidoMatch[1].trim();
      console.log('✅ Nome encontrado via padrão Favorecido:', name);
      return name.replace(/\s+/g, '_');
    }

    // Estratégia 2: Procurar por posição - o nome geralmente aparece após "Favorecido"
    let favorecidoIndex = -1;
    for (let i = 0; i < textItems.length; i++) {
      if (textItems[i].text.toLowerCase().includes('favorecido')) {
        favorecidoIndex = i;
        break;
      }
    }

    if (favorecidoIndex !== -1) {
      console.log('🎯 Encontrou "Favorecido" na posição:', favorecidoIndex);
      // Procurar o nome nas próximas posições
      for (let j = favorecidoIndex + 1; j < textItems.length && j < favorecidoIndex + 10; j++) {
        const candidateText = textItems[j].text;
        
        // Se encontrar um texto que parece ser um nome (só letras maiúsculas e espaços)
        if (/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]{5,}$/.test(candidateText) && !candidateText.includes('CASA') && !candidateText.includes('BANCO')) {
          console.log('✅ Nome encontrado por posição após Favorecido:', candidateText);
          return candidateText.trim().replace(/\s+/g, '_');
        }
      }
    }

    // Estratégia 3: Procurar nomes concatenando palavras próximas
    for (let i = 0; i < textItems.length; i++) {
      const currentText = textItems[i].text;
      
      // Se encontrar uma palavra que pode ser início de nome
      if (/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]{3,}$/.test(currentText)) {
        let fullName = currentText;
        const excludedWords = ['CASA', 'BANCO', 'CONTA', 'SAÚDE', 'MENINO', 'JESUS', 'BANRISUL', 'RECIBO', 'PAGAMENTO'];
        
        if (!excludedWords.includes(currentText)) {
          // Tentar concatenar as próximas palavras na mesma linha ou próximas
          for (let j = i + 1; j < textItems.length && j < i + 5; j++) {
            const nextText = textItems[j].text;
            const yDiff = Math.abs(textItems[i].y - textItems[j].y);
            
            // Se está na mesma linha (diferença Y pequena) e é uma palavra válida
            if (yDiff < 10 && /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]{2,}$/.test(nextText) && !excludedWords.includes(nextText)) {
              fullName += ' ' + nextText;
            } else if (nextText.trim() === '' && yDiff < 10) {
              continue; // Ignorar espaços vazios na mesma linha
            } else {
              break;
            }
          }
          
          // Se formou um nome com pelo menos 2 palavras e 8 caracteres
          if (fullName.includes(' ') && fullName.length >= 8) {
            console.log('✅ Nome concatenado encontrado:', fullName);
            return fullName.replace(/\s+/g, '_');
          }
        }
      }
    }

    console.log('❌ Nome não encontrado no recibo');
    return null;
  } catch (error) {
    console.error('💥 Erro na extração do nome do recibo:', error);
    return null;
  }
}

// Função para gerar nome do arquivo (sem OCR)
async function generateFileName(pdfBytes, cut, pageIndex) {
  const employeeName = await extractEmployeeName(pdfBytes);
  if (employeeName) {
    return `${employeeName}.pdf`;
  }
  
  // Fallback para nome padrão se extração falhar
  return `recibo_${cut.position}_p${pageIndex + 1}_${cut.startTopMm}-${cut.endTopMm}mm.pdf`;
}

// Restante do código permanece igual...
// [O resto das funções do arquivo original] 