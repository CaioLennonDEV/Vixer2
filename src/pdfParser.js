import * as pdfjsLib from 'pdfjs-dist';

// Configure worker for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;

/**
 * Utilitário para leitura de PDFs enviados pelo usuário no Navegador
 */
export async function parsePDFFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  let fullText = '';
  const numPages = pdf.numPages;

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += `\n --- [Página ${i}] --- \n` + pageText;
  }

  // Divide em trechos/chunks
  const chunks = chunkText(fullText, 600, 100);

  return {
    title: file.name,
    numPages,
    chunks
  };
}

function chunkText(text, maxChunkSize = 500, overlap = 100) {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (!cleanText) return [];

  const chunks = [];
  let startIndex = 0;

  while (startIndex < cleanText.length) {
    let endIndex = startIndex + maxChunkSize;
    if (endIndex < cleanText.length) {
      const lastSpace = cleanText.lastIndexOf(' ', endIndex);
      if (lastSpace > startIndex + 100) {
        endIndex = lastSpace;
      }
    } else {
      endIndex = cleanText.length;
    }

    const chunkStr = cleanText.substring(startIndex, endIndex).trim();
    if (chunkStr.length > 30) {
      chunks.push(chunkStr);
    }

    startIndex = endIndex - overlap;
    if (startIndex >= cleanText.length || endIndex >= cleanText.length) {
      break;
    }
  }

  return chunks;
}
