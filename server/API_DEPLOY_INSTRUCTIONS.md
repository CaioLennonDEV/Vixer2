# 🌐 Como Publicar a Vixer AI e Conectar ao Ollama do seu PC

Quando você publica o site da **Vixer AI** na internet (Vercel, Netlify, Render, Hostinger, etc.), os usuários que acessarem de seus celulares ou computadores não conseguirão acessar `localhost` diretamente, pois no navegador deles `localhost` aponta para o dispositivo deles próprios.

Para resolver isso de forma **100% gratuita, segura e automática**, o backend da Vixer (`server/server.js`) funciona como um **Tunneling API Bridge** entre o site publicado e o Ollama rodando no seu PC!

---

## 🚀 Passo a Passo Completo

### 1. Iniciar o Ollama e o Servidor no seu PC
Certifique-se de que o **Ollama** está rodando no seu PC com o modelo `4skl/gemma4-e2b-mtp:latest` instalado.

No terminal do seu PC, inicie o servidor da Vixer executando um dos comandos:

**Na pasta raiz do projeto (`c:\Users\Caio Lennon\Desktop\Vixer2`):**
```bash
npm start
```
*ou `npm run server`*

**Ou dentro da pasta `server` (`c:\Users\Caio Lennon\Desktop\Vixer2\server`):**
```bash
npm start
```
*(O servidor iniciará na porta **3001** rodando a API do PostgreSQL e a Ponte de Streaming com o Ollama local).*

---

### 2. Expor o Servidor do seu PC para a Internet (Gratuito com Cloudflare Tunnel ou Ngrok)

Escolha **uma** das opções abaixo para criar um link seguro HTTPS para o seu PC:

#### Opção A: Cloudflare Tunnel (Recomendado - Gratuito e ilimitado)
Se você tem o `cloudflared` instalado ou deseja usá-lo:
```bash
cloudflared tunnel --url http://localhost:3001
```
Você receberá um link público HTTPS como: `https://seu-tunnel.trycloudflare.com`.

#### Opção B: Ngrok (Gratuito)
Se preferir usar o Ngrok:
```bash
ngrok http 3001
```
Você receberá um link público HTTPS como: `https://seu-subdominio.ngrok-free.app`.

---

### 3. Conectar a Vixer2 Publicada ao seu PC

Quando for publicar o frontend `Vixer2` na Vercel, Netlify ou Render, adicione a seguinte **Variável de Ambiente (Environment Variable)**:

- **Nome da Variável**: `VITE_OLLAMA_API_URL`
- **Valor**: `https://seu-tunnel.trycloudflare.com` *(ou a URL pública gerada pelo Cloudflare Tunnel/Ngrok)*

---

### 🧪 Testando a Conexão
1. Seu PC fica ligado com o **Ollama** e a `node server/server.js` rodando.
2. Qualquer pessoa no mundo que entrar pelo celular ou PC na URL do seu site publicado fará as requisições que serão processadas em tempo real pelo modelo do seu PC com respostas streaming!
