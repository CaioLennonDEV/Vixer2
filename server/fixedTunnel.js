import ngrok from 'ngrok';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3001;
const NGROK_AUTH_TOKEN = '3IRTIJxHoabSL1HAqz6wY1EYbX1_4Emuuq12cYqS9oPQcnw7J';

process.on('uncaughtException', (err) => {
  console.error('[VixerTunnel] Erro não tratado:', err.message);
});

async function startNgrokTunnel() {
  console.log(`[VixerTunnel] Iniciando Ngrok na porta ${PORT}...`);
  try {
    const url = await ngrok.connect({
      port: PORT,
      authtoken: NGROK_AUTH_TOKEN
    });

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
