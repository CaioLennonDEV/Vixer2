/**
 * Groq API Engine - Vixer AI
 * Substitui o WebLLM local por chamadas à API Groq com streaming SSE e fallback automático de modelos.
 * Os modelos disponíveis são detectados dinamicamente via /openai/v1/models.
 */

let GROQ_API_KEY = localStorage.getItem('vixer_groq_api_key');
if (!GROQ_API_KEY) {
  GROQ_API_KEY = prompt("Segurança: Para usar a IA, insira sua chave da API Groq (gsk_...).\nEla ficará salva apenas no seu navegador local:");
  if (GROQ_API_KEY) {
    localStorage.setItem('vixer_groq_api_key', GROQ_API_KEY.trim());
  }
}
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

// Preferências de modelo: ordem de prioridade (os disponíveis serão usados, os ausentes ignorados)
const MODEL_PRIORITY = [
  'llama-3.3-70b-versatile',
  'llama3-70b-8192',
  'llama-3.1-70b-versatile',
  'llama-3.1-8b-instant',
  'llama3-8b-8192',
  'llama3-groq-70b-8192-tool-use-preview',
  'llama3-groq-8b-8192-tool-use-preview',
  'gemma2-9b-it',
  'gemma-7b-it',
  'mixtral-8x7b-32768',
  'deepseek-r1-distill-llama-70b',
  'qwen-qwq-32b',
];

// Labels amigáveis para o seletor
const MODEL_LABELS = {
  'llama-3.3-70b-versatile':                  'Llama 3.3 70B (Melhor)',
  'llama3-70b-8192':                           'Llama 3 70B',
  'llama-3.1-70b-versatile':                  'Llama 3.1 70B',
  'llama-3.1-8b-instant':                     'Llama 3.1 8B (Rápido)',
  'llama3-8b-8192':                           'Llama 3 8B',
  'llama3-groq-70b-8192-tool-use-preview':    'Llama 3 70B (Tool)',
  'llama3-groq-8b-8192-tool-use-preview':     'Llama 3 8B (Tool)',
  'gemma2-9b-it':                             'Gemma 2 9B',
  'gemma-7b-it':                              'Gemma 7B',
  'mixtral-8x7b-32768':                       'Mixtral 8x7B',
  'deepseek-r1-distill-llama-70b':            'DeepSeek R1 70B',
  'qwen-qwq-32b':                             'Qwen QwQ 32B',
};

// Cache de modelos disponíveis
export let GROQ_MODELS = [];

/**
 * Busca os modelos disponíveis na conta Groq e retorna em ordem de prioridade
 */
async function fetchAvailableModels() {
  try {
    const res = await fetch(`${GROQ_BASE_URL}/models`, {
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` },
    });

    if (!res.ok) {
      console.warn('[GroqEngine] Não foi possível listar modelos:', res.status);
      return [];
    }

    const data = await res.json();
    const availableIds = new Set((data.data || []).map(m => m.id));

    // Ordenar por prioridade e filtrar pelos que existem na conta
    const sorted = MODEL_PRIORITY
      .filter(id => availableIds.has(id))
      .map(id => ({
        id,
        label: MODEL_LABELS[id] || id,
      }));

    // Adicionar modelos não listados na prioridade mas disponíveis na conta (sem label específico)
    for (const m of (data.data || [])) {
      if (!MODEL_PRIORITY.includes(m.id) && !m.id.includes('whisper') && !m.id.includes('tts') && !m.id.includes('distil')) {
        sorted.push({ id: m.id, label: m.id });
      }
    }

    console.log(`[GroqEngine] Modelos disponíveis: ${sorted.map(m => m.id).join(', ')}`);
    return sorted;
  } catch (err) {
    console.error('[GroqEngine] Erro ao listar modelos:', err);
    return [];
  }
}

export class GroqEngine {
  constructor() {
    this.isGenerating = false;
    this.abortController = null;
    this.currentModelId = null;
    this._modelsLoaded = false;
  }

  /**
   * Inicializa o engine buscando os modelos disponíveis.
   * Deve ser chamado no startup da app.
   * @returns {Promise<Array>} Lista de modelos disponíveis
   */
  async init() {
    if (this._modelsLoaded) return GROQ_MODELS;
    GROQ_MODELS = await fetchAvailableModels();
    if (GROQ_MODELS.length > 0 && !this.currentModelId) {
      this.currentModelId = GROQ_MODELS[0].id;
    }
    this._modelsLoaded = true;
    return GROQ_MODELS;
  }

  /**
   * Retorna o modelo atual em uso
   */
  getModel() { return this.currentModelId; }

  /**
   * Define o modelo a ser usado
   */
  setModel(modelId) {
    this.currentModelId = modelId;
  }

  /**
   * Envia mensagens para o Groq e faz stream da resposta com fallback automático.
   */
  async generateStream(messages, onChunk, onFinish, onError) {
    if (this.isGenerating) return;

    if (!this._modelsLoaded || GROQ_MODELS.length === 0) {
      await this.init();
    }

    if (GROQ_MODELS.length === 0) {
      if (onError) onError(new Error('Não foi possível conectar ao Groq. Verifique sua conexão com a internet.'));
      return;
    }

    this.isGenerating = true;
    this.abortController = new AbortController();

    // Montar ordem de fallback: modelo preferido primeiro, depois os demais
    const preferredId = this.currentModelId || GROQ_MODELS[0].id;
    const modelsToTry = [
      preferredId,
      ...GROQ_MODELS.map(m => m.id).filter(id => id !== preferredId),
    ];

    for (const modelId of modelsToTry) {
      try {
        const result = await this._streamWithModel(modelId, messages, onChunk);
        this.isGenerating = false;
        this.currentModelId = modelId;
        if (onFinish) {
          onFinish(result.fullText, {
            totalElapsed: result.totalElapsed,
            tokenCount: result.tokenCount,
            finalTokensPerSec: result.finalTokensPerSec,
            modelUsed: modelId,
          });
        }
        return;
      } catch (err) {
        const isAborted   = err.name === 'AbortError';
        const isRateLimit = err.status === 429;
        const isOverload  = err.status === 503;
        const isBadModel  = err.status === 400 || err.status === 404;

        if (isAborted) {
          this.isGenerating = false;
          return;
        }

        console.warn(`[GroqEngine] Falha no modelo "${modelId}" (${err.status || err.message}). Tentando próximo...`);

        if (!isRateLimit && !isOverload && !isBadModel) {
          // Erro de rede / autenticação — não adianta tentar outros
          this.isGenerating = false;
          if (onError) onError(err);
          return;
        }

        continue;
      }
    }

    this.isGenerating = false;
    if (onError) onError(new Error('Todos os modelos Groq estão indisponíveis no momento. Tente novamente em instantes.'));
  }

  /**
   * Realiza a chamada streaming para um modelo específico
   * @private
   */
  async _streamWithModel(modelId, messages, onChunk) {
    const startTime = performance.now();
    let tokenCount = 0;
    let fullText = '';

    // Gemma não suporta role "system" — converter para mensagem user
    let adaptedMessages = messages;
    if (modelId.startsWith('gemma')) {
      adaptedMessages = messages.map((m, i) => {
        if (m.role === 'system') {
          return { role: 'user', content: `[Instruções do sistema]: ${m.content}` };
        }
        return m;
      });
      // Mesclar mensagens user consecutivas que possam ter surgido
      const merged = [];
      for (const m of adaptedMessages) {
        if (merged.length > 0 && merged[merged.length - 1].role === m.role && m.role === 'user') {
          merged[merged.length - 1] = { role: 'user', content: merged[merged.length - 1].content + '\n\n' + m.content };
        } else {
          merged.push(m);
        }
      }
      adaptedMessages = merged;
    }

    const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: this.abortController?.signal,
      body: JSON.stringify({
        model: modelId,
        messages: adaptedMessages,
        stream: true,
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const err = new Error(errBody?.error?.message || `HTTP ${response.status}`);
      err.status = response.status;
      throw err;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let rawAccum = '';       // acumula o texto bruto completo (incluindo <think>)
    let inThinkBlock = false; // estado: está dentro de <think>?

    // Função que remove blocos <think>...</think> do texto acumulado
    function stripThinking(text) {
      // Remove blocos completos <think>...</think>
      return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trimStart();
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta = json.choices?.[0]?.delta?.content || '';
          if (!delta) continue;

          rawAccum += delta;
          tokenCount++;

          // Detectar estado do bloco <think>
          if (rawAccum.includes('<think>') && !rawAccum.includes('</think>')) {
            inThinkBlock = true;
          } else if (inThinkBlock && rawAccum.includes('</think>')) {
            inThinkBlock = false;
          }

          // Só chamar onChunk com o texto visível (sem o bloco de raciocínio)
          if (!inThinkBlock) {
            fullText = stripThinking(rawAccum);
            const elapsedSec = (performance.now() - startTime) / 1000;
            const tokensPerSec = elapsedSec > 0 ? (tokenCount / elapsedSec).toFixed(1) : '0';
            if (onChunk) onChunk(fullText, delta, tokensPerSec);
          }
        } catch (_) {}
      }
    }

    const totalElapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    const finalTokensPerSec = totalElapsed > 0 ? (tokenCount / parseFloat(totalElapsed)).toFixed(1) : '0';
    // Garantir que o fullText final esteja sem blocos <think>
    fullText = stripThinking(rawAccum);
    return { fullText, totalElapsed, tokenCount, finalTokensPerSec };
  }

  /** Interrompe a geração atual */
  stopGeneration() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isGenerating = false;
  }

  /** Stubs de compatibilidade */
  async loadModel() { return true; }
  async unload() { this.isGenerating = false; }
}
