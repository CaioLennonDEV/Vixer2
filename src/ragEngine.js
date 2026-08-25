import pdfKnowledge from './pdfKnowledgeBase.json';

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

    const passages = this.searchRelevantPassages(userQuery, 2);
    if (passages.length === 0) return '';

    let contextStr = `\nDOCUMENTOS DE REFERÊNCIA OFICIAIS DA MULTIVIX:\n`;
    passages.forEach((p) => {
      const snippet = p.text.length > 350 ? p.text.substring(0, 350) + '...' : p.text;
      contextStr += `---
[DOCUMENTO OFICIAL CONSULTADO: "${p.documentTitle}"]
"${snippet}"
`;
    });

    contextStr += `---
INSTRUÇÕES DE RESPOSTA BASEADA NOS DOCUMENTOS:
1. Responda à dúvida do aluno de forma clara, elegante, estruturada e amigável em português.
2. Extraia os dados exatos (porcentagens como 75% de frequência, prazos, artigos e regras) dos trechos dos documentos oficiais fornecidos acima.
3. Comece sua resposta indicando o documento consultado em negrito, por exemplo: "📌 **Fonte Oficial:** [Nome do Documento]".
4. Utilize marcadores bem espaçados para tornar a leitura bonita e agradável.
`;
    return contextStr;
  }
}
