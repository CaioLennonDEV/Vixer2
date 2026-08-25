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
   * Check if WebGPU is available in the current browser context
   */
  static checkWebGPUSupport() {
    return 'gpu' in navigator;
  }

  /**
   * Initialize or switch to a specific model ID
   */
  async loadModel(modelId, onProgress) {
    if (typeof caches === 'undefined' || !window.isSecureContext) {
      throw new Error('O navegador bloqueou o recurso de Cache/WebGPU por estar rodando em HTTP não seguro. No celular, o WebGPU exige HTTPS (ex: https://IP ou via GitHub Pages).');
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
      if (err.message && (err.message.includes('Device was lost') || err.message.includes('disposed') || err.message.includes('memory') || err.message.includes('DXGI') || err.message.includes('HUNG'))) {
        const fallbackModelId = 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC';
        console.warn(`WebGPU DirectX TDR / VRAM excedida. Carregando modelo ultra leve universal ${fallbackModelId} (~350MB)...`);
        this.engine = null;
        this.currentModelId = fallbackModelId;
        this.engine = await webLLM.CreateMLCEngine(fallbackModelId, {
          appConfig,
          initProgressCallback: (report) => {
            if (onProgress) onProgress(report);
          },
        });
        return this.engine;
      }

      if (err.message && err.message.includes('shader-f16') && modelId.includes('q4f16_1')) {
        const fallbackModelId = modelId.replace('q4f16_1', 'q4f32_1');
        console.warn(`WebGPU shader-f16 não suportado. Tentando fallback para ${fallbackModelId}`);
        this.currentModelId = fallbackModelId;
        this.engine = await webLLM.CreateMLCEngine(fallbackModelId, {
          appConfig,
          initProgressCallback: (report) => {
            if (onProgress) onProgress(report);
          },
        });
        return this.engine;
      }
      throw err;
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
        temperature: 0.5,
        top_p: 0.9,
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
