import * as webLLM from '@mlc-ai/web-llm';

/**
 * WebLLM Engine Wrapper Service
 */
export class LLMEngine {
  constructor() {
    this.engine = null;
    this.currentModelId = null;
    this.isGenerating = false;
  }

  /**
   * Check if WebGPU is available and active in the browser context
   */
  static async checkWebGPUSupport() {
    if (!('gpu' in navigator)) {
      return { ok: false, reason: 'O navegador não possui suporte ao recurso WebGPU.' };
    }
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        return { ok: false, reason: 'O processo da placa de vídeo (GPU) do navegador foi suspenso pelo Windows/Chrome após uma falha de memória.' };
      }
      return { ok: true, adapter };
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  }

  /**
   * Initialize or switch to a specific model ID
   */
  async loadModel(modelId, onProgress) {
    if (typeof caches === 'undefined' || !window.isSecureContext) {
      throw new Error('O navegador bloqueou o recurso de Cache/WebGPU por estar rodando em HTTP não seguro. No celular, o WebGPU exige HTTPS (ex: https://IP ou via GitHub Pages).');
    }

    const gpuCheck = await LLMEngine.checkWebGPUSupport();
    if (!gpuCheck.ok) {
      throw new Error(`WebGPU Suspenso no Navegador!\n\n${gpuCheck.reason}\n\n👉 COMO REATIVAR A GPU AHORA:\n1. Digite "chrome://restart" na barra de endereços do seu navegador e pressione Enter (ou feche TODAS as janelas do Chrome).\n2. Ao reabrir, a placa de vídeo estará 100% reativada.`);
    }

    if (this.engine && this.currentModelId === modelId) {
      try {
        return this.engine;
      } catch (e) {
        this.engine = null;
      }
    }

    if (this.engine) {
      console.log('Descarregando modelo anterior...');
      try {
        await this.engine.unload();
      } catch (e) {
        console.warn('Erro ao descarregar:', e);
      }
      this.engine = null;
    }

    this.currentModelId = modelId;

    const appConfig = webLLM.prebuiltAppConfig;
    
    try {
      this.engine = await webLLM.CreateMLCEngine(modelId, {
        appConfig,
        initProgressCallback: (report) => {
          if (onProgress) {
            onProgress(report);
          }
        },
      });
      return this.engine;
    } catch (err) {
      console.error(`Erro ao carregar modelo ${modelId}:`, err);

      if (err.message && (err.message.includes('Unable to find a compatible GPU') || err.message.includes('requestAdapter') || err.message.includes('Failed to request WebGPU'))) {
        throw new Error('A aceleração WebGPU foi suspensa pelo Chrome/Windows por instabilidade da GPU. Feche todas as janelas do navegador (ou digite chrome://restart) para reativar a GPU!');
      }

      if (modelId === 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC') {
        throw err;
      }

      const fallbackModelId = 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC';
      console.warn(`Tentando fallback automático para modelo leve ${fallbackModelId} (~350MB)...`);
      this.engine = null;
      this.currentModelId = fallbackModelId;
      try {
        this.engine = await webLLM.CreateMLCEngine(fallbackModelId, {
          appConfig,
          initProgressCallback: (report) => {
            if (onProgress) onProgress(report);
          },
        });
        return this.engine;
      } catch (fallbackErr) {
        throw fallbackErr;
      }
    }
  }

  /**
   * Send chat messages and stream response chunks
   */
  async generateStream(messages, onChunk, onFinish, onError) {
    if (!this.engine) {
      throw new Error('O modelo de IA ainda não foi carregado.');
    }

    this.isGenerating = true;
    const startTime = performance.now();
    let tokenCount = 0;

    try {
      const completion = await this.engine.chat.completions.create({
        messages,
        stream: true,
        temperature: 0.1,
        top_p: 0.85,
        max_tokens: 1024,
      });

      let fullText = '';

      for await (const chunk of completion) {
        const delta = chunk.choices[0]?.delta?.content || '';
        fullText += delta;
        tokenCount++;

        const elapsedSec = (performance.now() - startTime) / 1000;
        const tokensPerSec = elapsedSec > 0 ? (tokenCount / elapsedSec).toFixed(1) : '0';

        if (onChunk) {
          onChunk(fullText, delta, tokensPerSec);
        }
      }

      this.isGenerating = false;
      const totalElapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      const finalTokensPerSec = totalElapsed > 0 ? (tokenCount / totalElapsed).toFixed(1) : '0';

      if (onFinish) {
        onFinish(fullText, { totalElapsed, tokenCount, finalTokensPerSec });
      }
    } catch (err) {
      this.isGenerating = false;
      if (err.message && (err.message.includes('disposed') || err.message.includes('Device was lost'))) {
        console.warn('WebGPU reiniciado devido à memória. Resetando motor de IA...');
        this.engine = null;
        this.currentModelId = null;
      }
      if (onError) {
        onError(err);
      }
    }
  }

  /**
   * Interrupt current generation process
   */
  async stopGeneration() {
    if (this.engine && this.isGenerating) {
      await this.engine.interruptGenerate();
      this.isGenerating = false;
    }
  }

  /**
   * Unload model to release browser RAM / WebGPU memory
   */
  async unload() {
    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
      this.currentModelId = null;
      this.isGenerating = false;
    }
  }
}
