import pdfKnowledge from './pdfKnowledgeBase.js';

/**
 * Engine RAG (Retrieval-Augmented Generation) para Busca em PDFs Multivix
 */
export class RAGEngine {
  static localKnowledge = pdfKnowledge || [];
  static activeUploadedPdfs = [];

  /**
   * Adiciona um PDF carregado dinamicamente pelo usuário no navegador
   */
  static addUploadedPDF(pdfData) {
    this.activeUploadedPdfs.push(pdfData);
  }

  /**
   * Remove um PDF enviado pelo usuário
   */
  static removeUploadedPDF(title) {
    this.activeUploadedPdfs = this.activeUploadedPdfs.filter(p => p.title !== title);
  }

  /**
   * Identifica se a pergunta é sobre o histórico do chat ou sobre o usuário (meta-pergunta)
   */
  static isMetaOrHistoryQuery(query) {
    if (!query) return false;
    const q = query.toLowerCase();
    const metaKeywords = [
      'primeira pergunta', 'primeira mensagem', 'que eu te fiz', 'que eu fiz',
      'que eu perguntei', 'o que eu disse', 'minha pergunta anterior', 'mensagem anterior',
      'quem sou eu', 'qual o meu nome', 'qual meu nome', 'quem é você', 'quem vc e',
      'como você se chama', 'quem criou você'
    ];
    return metaKeywords.some(k => q.includes(k));
  }

  /**
   * Realiza busca RAG inteligente nos PDFs Multivix + PDFs enviados
   */
  static searchRelevantPassages(userQuery, topK = 2) {
    if (!userQuery || userQuery.trim().length < 3 || this.isMetaOrHistoryQuery(userQuery)) {
      return [];
    }

    const lowerQuery = userQuery.toLowerCase();
    const queryTokens = lowerQuery
      .replace(/[^\w\sà-ú0-9]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);

    if (queryTokens.length === 0) return [];

    const allDocs = [...this.localKnowledge, ...this.activeUploadedPdfs];
    const scoredChunks = [];

    const keyTerms = ['falta', 'faltas', 'frequência', 'reprovação', '75%', 'prova', 'substitutiva', 'isenção', 'rematrícula', 'dependência', 'calendário', 'edital'];

    allDocs.forEach(doc => {
      if (!doc.chunks || !Array.isArray(doc.chunks)) return;
      const lowerTitle = doc.title.toLowerCase();

      let titleBonus = 0;
      queryTokens.forEach(t => {
        if (lowerTitle.includes(t)) titleBonus += 15;
      });

      doc.chunks.forEach((chunkText, idx) => {
        const lowerChunk = chunkText.toLowerCase();
        let score = titleBonus;

        queryTokens.forEach(token => {
          if (lowerChunk.includes(token)) {
            score += token.length > 4 ? 4 : 2;
          }
        });

        keyTerms.forEach(kt => {
          if (lowerQuery.includes(kt) && lowerChunk.includes(kt)) {
            score += 6;
          }
        });

        if (score > 5) {
          scoredChunks.push({
            documentTitle: doc.title,
            chunkIndex: idx,
            text: chunkText,
            score: score
          });
        }
      });
    });

    scoredChunks.sort((a, b) => b.score - a.score);
    return scoredChunks.slice(0, topK);
  }

  /**
   * Formata os trechos encontrados para injeção no prompt da IA
   */
  static buildRAGContextString(userQuery) {
    if (this.isMetaOrHistoryQuery(userQuery)) return '';

    const passages = this.searchRelevantPassages(userQuery, 3);
    if (passages.length === 0) return '';

    let contextStr = `\nDOCUMENTOS DE REFERÊNCIA OFICIAIS DA MULTIVIX:\n`;
    passages.forEach((p) => {
      const snippet = p.text.length > 1200 ? p.text.substring(0, 1200) + '...' : p.text;
      contextStr += `---
[DOCUMENTO OFICIAL CONSULTADO: "${p.documentTitle}"]
"${snippet}"
`;
    });

    contextStr += `---
INSTRUÇÕES DE RESPOSTA BASEADA NOS DOCUMENTOS OFICIAIS:
1. Responda à dúvida do aluno de forma clara, amigável e oficial em português brasileiro.
2. Baseie sua resposta EXCLUSIVAMENTE nas informações oficiais dos trechos citados acima (como Rematrícula Automática, mensalidades quitadas, ausência de débitos na biblioteca e aceite do contrato educacional no Portal/App Multivix).
3. NUNCA invente botões que não constam no documento (como "Procurar Inscrições"), nem provas fictícias (como "prova de desempenho", "prova de matrícula" ou "prova de aprovação"), nem sites falsos (como "cursodev.com").
4. Organize a resposta em tópicos numerados objetivos e diretos.
`;
    return contextStr;
  }
}
