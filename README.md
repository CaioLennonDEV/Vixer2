# ⚡ Vixer AI - LLM Local no Navegador (GitHub Pages)

Um aplicativo de Chat de Inteligência Artificial **100% Client-Side**, construído para ser hospedado no **GitHub Pages**. 

Ele executa modelos de linguagem abertos (como **Llama 3.2**, **Qwen 2.5** e **SmolLM2**) diretamente no navegador do usuário (Computador ou Celular) utilizando **WebGPU** e **WebLLM**.

---

## 🌟 Principais Recursos

- **Zero Custo de Servidor**: Roda inteiramente no lado do cliente. Não necessita de backend ou API Key paga.
- **Privacidade Total**: O texto e o contexto da conversa nunca saem do dispositivo do usuário.
- **Modelos Leves e Rápidos**:
  - **SmolLM2 360M (~200 MB)**: Ideal para celulares e dispositivos móveis.
  - **Qwen 2.5 0.5B / 1.5B (~350 MB - 1.0 GB)**: Raciocínio rápido e excelente em português.
  - **Llama 3.2 1B / 3B (~700 MB - 1.8 GB)**: Modelos avançados da Meta AI.
- **Cache Inteligente (IndexedDB)**: O modelo é baixado do Hugging Face apenas na 1ª vez e fica salvo no cache do navegador.
- **Interface Premium**: Dark mode futurista, suporte a markdown, destaque de sintaxe em códigos com botão de cópia rápida, histórico de conversas no `localStorage` e métricas de velocidade (*tokens/seg*).

---

## 💻 Como Rodar Localmente

1. **Instale as dependências**:
   ```bash
   npm install
   ```

2. **Inicie o servidor de desenvolvimento**:
   ```bash
   npm run dev
   ```

3. Abra o navegador em `http://localhost:5173`.

> **Nota**: Certifique-se de estar usando um navegador com suporte a **WebGPU** (Chrome, Edge, Brave ou Safari no iOS 18.2+).

---

## 🚀 Como Publicar no GitHub Pages

### Opção 1: Publicação Automática via GitHub Actions (Recomendado)

1. Crie um repositório no GitHub e envie o código:
   ```bash
   git init
   git add .
   git commit -m "feat: vixer ai webllm client side chat"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   git push -u origin main
   ```
2. No seu repositório no GitHub, vá em **Settings** -> **Pages**.
3. Na seção **Build and deployment** -> **Source**, selecione **GitHub Actions**.
4. O GitHub executará o workflow `.github/workflows/deploy.yml` automaticamente e disponibilizará o link do seu site!

---

## 🛠️ Tecnologias Utilizadas

- [WebLLM / MLC-AI](https://webllm.mlc.ai/) - Motor de inferência WebGPU para LLMs.
- [Vite](https://vitejs.dev/) - Bundler estático ultra-rápido.
- [Marked.js](https://marked.js.org/) & [Highlight.js](https://highlightjs.org/) - Renderização de Markdown e coloração de código.
- CSS Vanilla - Design System customizado responsivo e fluido.
