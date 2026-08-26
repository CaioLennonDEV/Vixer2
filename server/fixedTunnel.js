import localtunnel from 'localtunnel';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUBDOMAINS = [
  'vixer-pc-caio',
  'vixer-pc-caio2',
  'vixer-pc-caio3'
];
const PORT = 3001;
const KEEPALIVE_INTERVAL = 30_000;
const MAX_RETRIES = 15; // Após 15 tentativas (~90s), aceita URL temporária

let activeTunnel = null;
let keepaliveTimer = null;
let retryCount = 0;
let currentSubdomainIndex = 0;

process.on('uncaughtException', (err) => {
  console.error('[VixerTunnel] Erro não tratado (ignorado):', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('[VixerTunnel] Promise rejeitada (ignorada):', err?.message || err);
});

function startKeepAlive(tunnel) {
  if (keepaliveTimer) clearInterval(keepaliveTimer);
  keepaliveTimer = setInterval(async () => {
    try {
      const res = await fetch(tunnel.url, {
        method: 'HEAD',
        headers: { 'Bypass-Tunnel-Reminder': 'true' }
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
    } catch {
      console.log('[VixerTunnel] Keepalive falhou. Reconectando...');
      clearInterval(keepaliveTimer);
      keepaliveTimer = null;
      try { tunnel.close(); } catch {}
      retryCount = 0;
      currentSubdomainIndex = 0;
      setTimeout(startFixedTunnel, 2000);
    }
  }, KEEPALIVE_INTERVAL);
}

async function autoAcceptReminder(tunnelUrl) {
  try {
    // Pegar a senha/IP do localtunnel
    const pwRes = await fetch('https://loca.lt/mytunnelpassword');
    const password = (await pwRes.text()).trim();
    console.log(`[VixerTunnel] Tunnel password obtido: ${password}`);

    // Submeter a senha para "aceitar" a reminder page
    const acceptRes = await fetch(tunnelUrl, {
      method: 'GET',
      headers: {
        'Bypass-Tunnel-Reminder': password
      }
    });
    console.log(`[VixerTunnel] Reminder auto-aceita! Status: ${acceptRes.status}`);
  } catch (e) {
    console.warn('[VixerTunnel] Não foi possível auto-aceitar reminder:', e.message);
  }
}

async function setupTunnel(tunnel) {
  activeTunnel = tunnel;
  retryCount = 0;

  console.log(`\n======================================================`);
  console.log(`✨ TÚNEL ATIVO:`);
  console.log(`👉  ${tunnel.url}  👈`);
  console.log(`======================================================\n`);

  try {
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      envContent = envContent.replace(/VITE_OLLAMA_API_URL=.*/g, `VITE_OLLAMA_API_URL=${tunnel.url}`);
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log(`[VixerTunnel] Arquivo .env atualizado automaticamente com a nova URL.`);
    }
  } catch (err) {
    console.error(`[VixerTunnel] Erro ao atualizar .env:`, err.message);
  }

  // Auto-aceitar a reminder page do Localtunnel
  await autoAcceptReminder(tunnel.url);

  startKeepAlive(tunnel);

  tunnel.on('close', () => {
    console.log('[VixerTunnel] Conexão encerrada. Reconectando em 5s...');
    activeTunnel = null;
    if (keepaliveTimer) { clearInterval(keepaliveTimer); keepaliveTimer = null; }
    retryCount = 0;
    currentSubdomainIndex = 0;
    setTimeout(startFixedTunnel, 5000);
  });

  tunnel.on('error', (err) => {
    console.error('[VixerTunnel] Erro:', err.message);
  });
}

async function startFixedTunnel() {
  if (activeTunnel) {
    try { activeTunnel.close(); } catch {}
    activeTunnel = null;
  }
  if (keepaliveTimer) { clearInterval(keepaliveTimer); keepaliveTimer = null; }

  retryCount++;

  const currentSubdomain = SUBDOMAINS[currentSubdomainIndex];
  console.log(`[VixerTunnel] Tentativa ${retryCount}/${MAX_RETRIES} — Solicitando: https://${currentSubdomain}.loca.lt ...`);

  try {
    const tunnelPromise = localtunnel({ 
      port: PORT, 
      subdomain: currentSubdomain,
      local_host: '127.0.0.1',
      allow_invalid_cert: true
    });
    
    // Timeout de 5 segundos para a requisição não travar o console
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT_LOCALTUNNEL')), 5000)
    );

    const tunnel = await Promise.race([tunnelPromise, timeoutPromise]);

    if (tunnel.url.includes(currentSubdomain)) {
      // URL fixa oficial obtida!
      setupTunnel(tunnel);
    } else if (retryCount >= MAX_RETRIES) {
      // Esgotou tentativas — aceita URL temporária
      console.log(`\n[VixerTunnel] Não foi possível obter uma URL fixa após ${MAX_RETRIES} tentativas.`);
      console.log(`[VixerTunnel] Usando URL temporária por enquanto...\n`);
      setupTunnel(tunnel);
    } else {
      // Tenta de novo
      tunnel.close();
      currentSubdomainIndex++;
      
      if (currentSubdomainIndex >= SUBDOMAINS.length) {
        currentSubdomainIndex = 0; // Volta para o primeiro
        console.log(`[VixerTunnel] Subdomínio ocupado. URL temp: ${tunnel.url}. Todas as opções ocupadas. Aguardando 6s para reiniciar o ciclo...`);
        setTimeout(startFixedTunnel, 6000);
      } else {
        console.log(`[VixerTunnel] Subdomínio ocupado. URL temp: ${tunnel.url}. Tentando próxima opção imediatamente...`);
        setTimeout(startFixedTunnel, 1000);
      }
    }
  } catch (err) {
    console.error(`[VixerTunnel Error]: Falha ao tentar ${currentSubdomain}. Motivo:`, err.message);
    
    // Se der erro ou timeout, passa para o próximo da lista também!
    currentSubdomainIndex++;
    if (currentSubdomainIndex >= SUBDOMAINS.length) {
      currentSubdomainIndex = 0;
      console.log(`[VixerTunnel] Todas as opções falharam/timeout. Aguardando 6s para reiniciar o ciclo...`);
      setTimeout(startFixedTunnel, 6000);
    } else {
      console.log(`[VixerTunnel] Tentando próxima opção imediatamente...`);
      setTimeout(startFixedTunnel, 1000);
    }
  }
}

startFixedTunnel();
