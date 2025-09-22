// Script para limpar cache e referências antigas ao Tesseract
// Versão 2.2 - Sem dependência do Tesseract

(function() {
  'use strict';
  
  console.log('🧹 Limpando cache e referências antigas...');
  
  // Limpar referências globais ao Tesseract
  if (typeof window !== 'undefined') {
    if (window.Tesseract) {
      console.log('Removendo window.Tesseract...');
      delete window.Tesseract;
    }
    if (window.tesseract) {
      console.log('Removendo window.tesseract...');
      delete window.tesseract;
    }
  }
  
  // Limpar localStorage relacionado ao Tesseract
  if (typeof localStorage !== 'undefined') {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.toLowerCase().includes('tesseract')) {
        console.log(`Removendo localStorage: ${key}`);
        localStorage.removeItem(key);
      }
    });
  }
  
  // Limpar sessionStorage relacionado ao Tesseract
  if (typeof sessionStorage !== 'undefined') {
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.toLowerCase().includes('tesseract')) {
        console.log(`Removendo sessionStorage: ${key}`);
        sessionStorage.removeItem(key);
      }
    });
  }
  
  console.log('✅ Limpeza concluída - Sistema usando apenas PDF.js');
})();