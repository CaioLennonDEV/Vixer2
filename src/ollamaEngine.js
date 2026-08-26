/**
 * Ollama Local AI Engine - Vixer AI
 * Conecta ao Ollama via Proxy Vite (/ollama) ou diretamente (http://localhost:11434)
 * Evita erros de CORS ao usar o proxy do servidor Vite dev.
 */

export const DEFAULT_OLLAMA_MODEL = '4skl/gemma4-e2b-mtp:latest';

// Configuração de URL remota da API EXCLUSIVA
const CONFIGURED_REMOTE_URL = (import.meta.env.VITE_OLLAMA_API_URL || localStorage.getItem('vixer_remote_api_url') || 'https://demeanor-unlocked-kilobyte.ngrok-free.dev').replace(/\/$/, '');

function getOllamaEndpoints() {
  return [CONFIGURED_REMOTE_URL];
}

const TUNNEL_BYPASS_HEADERS = {
  'Bypass-Tunnel-Reminder': 'true',
  'ngrok-skip-browser-warning': 'true'
};

export class OllamaEngine {
  constructor() {
    this.isGenerating = false;
    this.abortController = null;
    this.currentModelId = localStorage.getItem('vixer_ollama_model') || DEFAULT_OLLAMA_MODEL;
    this.availableModels = [];
    this.activeBaseUrl = CONFIGURED_REMOTE_URL;
  }

  async init() {
    this.activeBaseUrl = await this.detectWorkingBaseUrl();
    this.availableModels = await this.fetchLocalModels();
    
    // Check if current or default model is available
    const exactMatch = this.availableModels.find(m => m.id === this.currentModelId);
    const gemmaMatch = this.availableModels.find(m => m.id.includes('gemma4') || m.id.includes('4skl'));

    if (exactMatch) {
      this.currentModelId = exactMatch.id;
    } else if (gemmaMatch) {
      this.currentModelId = gemmaMatch.id;
    } else if (this.availableModels.length > 0) {
      this.currentModelId = this.availableModels[0].id;
    } else {
      this.currentModelId = DEFAULT_OLLAMA_MODEL;
    }

    localStorage.setItem('vixer_ollama_model', this.currentModelId);
    return this.availableModels;
  }

  setRemoteApiUrl(url) {
    if (url) {
      localStorage.setItem('vixer_remote_api_url', url.replace(/\/$/, ''));
    } else {
      localStorage.removeItem('vixer_remote_api_url');
    }
  }

  async detectWorkingBaseUrl() {
    const endpoints = getOllamaEndpoints();
    for (const url of endpoints) {
      try {
        const res = await fetch(`${url}/api/tags`, { 
          method: 'GET',
          headers: TUNNEL_BYPASS_HEADERS
        });
        if (res.ok) {
          console.log(`[OllamaEngine] Conectado com sucesso via API: ${url}`);
          return url;
        }
      } catch (e) {
        // Tentar próximo endpoint
      }
    }
    return CONFIGURED_REMOTE_URL;
  }

  setModel(modelId) {
    this.currentModelId = modelId;
    localStorage.setItem('vixer_ollama_model', modelId);
  }

  async fetchLocalModels() {
    for (const baseUrl of [this.activeBaseUrl, ...getOllamaEndpoints()]) {
      try {
        const res = await fetch(`${baseUrl}/api/tags`, {
          headers: TUNNEL_BYPASS_HEADERS
        });
        if (!res.ok) continue;
        const data = await res.json();
        if (data.models && data.models.length > 0) {
          this.activeBaseUrl = baseUrl;
          return data.models.map(m => {
            const sizeGB = m.size ? (m.size / (1024 * 1024 * 1024)).toFixed(1) + ' GB' : '';
            return {
              id: m.name,
              label: `${m.name} ${sizeGB ? '(' + sizeGB + ')' : ''}`
            };
          });
        }
      } catch (err) {
        // Continue to next endpoint
      }
    }
    return [{ id: DEFAULT_OLLAMA_MODEL, label: DEFAULT_OLLAMA_MODEL }];
  }

  stopGeneration() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isGenerating = false;
  }

  async generateStream(messages, onChunk, onFinish, onError) {
    this.isGenerating = true;
    this.abortController = new AbortController();

    const startTime = Date.now();
    let fullText = '';

    const payload = {
      model: this.currentModelId,
      messages: messages,
      stream: true,
      options: {
        temperature: 0.7,
      }
    };

    const base = this.activeBaseUrl.replace(/\/$/, '');
    const endpointsToTry = [
      `${base}/v1/chat/completions`,
      `${base}/api/chat`
    ];

    let success = false;

    for (const endpoint of endpointsToTry) {
      if (this.abortController.signal.aborted) break;

      try {
        const isNativeApi = endpoint.includes('/api/chat');
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...TUNNEL_BYPASS_HEADERS 
          },
          body: JSON.stringify(payload),
          signal: this.abortController.signal,
        });

        if (!response.ok) continue;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;

            if (isNativeApi) {
              try {
                const parsed = JSON.parse(trimmed);
                const delta = parsed.message?.content || '';
                if (delta) {
                  fullText += delta;
                  const elapsedSec = (Date.now() - startTime) / 1000;
                  const tokSec = elapsedSec > 0 ? (fullText.length / elapsedSec).toFixed(0) : '0';
                  if (onChunk) onChunk(fullText, delta, tokSec);
                }
              } catch (e) {}
            } else if (trimmed.startsWith('data: ')) {
              try {
                const jsonStr = trimmed.replace(/^data:\s*/, '');
                const parsed = JSON.parse(jsonStr);
                const delta = parsed.choices?.[0]?.delta?.content || '';

                if (delta) {
                  fullText += delta;
                  const elapsedSec = (Date.now() - startTime) / 1000;
                  const tokSec = elapsedSec > 0 ? (fullText.length / elapsedSec).toFixed(0) : '0';
                  if (onChunk) onChunk(fullText, delta, tokSec);
                }
              } catch (e) {}
            }
          }
        }

        success = true;
        break;
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log('[OllamaEngine] Geração cancelada.');
          success = true;
          break;
        }
        // Try next endpoint
      }
    }

    this.isGenerating = false;
    const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    if (success) {
      if (onFinish) onFinish(fullText, { totalElapsed, modelUsed: this.currentModelId });
    } else {
      if (onError) {
        onError(new Error(
          `Não foi possível conectar ao Ollama local.\n\n` +
          `Dicas de solução:\n` +
          `1. Verifique se o Ollama está em execução no seu computador.\n` +
          `2. Abra o terminal e execute: setx OLLAMA_ORIGINS "*"\n` +
          `3. Reinicie o Ollama e recarregue a página.`
        ));
      }
    }
  }
}
