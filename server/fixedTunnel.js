import ngrok from '@ngrok/ngrok';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3001;
const NGROK_AUTH_TOKEN = '3IREZu5K8eKwqhJ3sBiORrzYm1s_26ZJVQ4GhPWYSe98JXyYS';

process.on('uncaughtException', (err) => {
  console.error('[VixerTunnel] Erro não tratado:', err.message);
});

async function startNgrokTunnel() {
  console.log(`[VixerTunnel] Iniciando Ngrok na porta ${PORT}...`);
  try {
    const listener = await ngrok.forward({
      addr: PORT,
      authtoken: NGROK_AUTH_TOKEN,
      domain: 'demeanor-unlocked-kilobyte.ngrok-free.dev'
    });
    const url = listener.url();

    console.log(`\n======================================================`);
    console.log(`✨ TÚNEL NGROK ATIVO (100% ESTÁVEL):`);
    console.log(`👉  ${url}  👈`);
    console.log(`======================================================\n`);

    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      envContent = envContent.replace(/VITE_OLLAMA_API_URL=.*/g, `VITE_OLLAMA_API_URL=${url}`);
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log(`[VixerTunnel] Arquivo .env atualizado automaticamente com a nova URL do Ngrok.`);
    }

    // O Ngrok se mantém vivo automaticamente, não precisa de KeepAlive manual.

  } catch (err) {
    console.error(`[VixerTunnel] Falha ao iniciar Ngrok:`, err.message);
  }
}

startNgrokTunnel();
