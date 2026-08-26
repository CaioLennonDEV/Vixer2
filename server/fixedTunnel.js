import localtunnel from 'localtunnel';

const SUBDOMAIN = 'vixer-pc-caio';
const PORT = 3001;
const KEEPALIVE_INTERVAL = 30_000;
const MAX_RETRIES = 15; // Após 15 tentativas (~90s), aceita URL temporária

let activeTunnel = null;
let keepaliveTimer = null;
let retryCount = 0;

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

  // Auto-aceitar a reminder page do Localtunnel
  await autoAcceptReminder(tunnel.url);

  startKeepAlive(tunnel);

  tunnel.on('close', () => {
    console.log('[VixerTunnel] Conexão encerrada. Reconectando em 5s...');
    activeTunnel = null;
    if (keepaliveTimer) { clearInterval(keepaliveTimer); keepaliveTimer = null; }
    retryCount = 0;
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

  console.log(`[VixerTunnel] Tentativa ${retryCount}/${MAX_RETRIES} — Solicitando: https://${SUBDOMAIN}.loca.lt ...`);

  try {
    const tunnel = await localtunnel({ 
      port: PORT, 
      subdomain: SUBDOMAIN,
      local_host: '127.0.0.1',
      allow_invalid_cert: true
    });

    if (tunnel.url.includes(SUBDOMAIN)) {
      // URL fixa oficial obtida!
      setupTunnel(tunnel);
    } else if (retryCount >= MAX_RETRIES) {
      // Esgotou tentativas — aceita URL temporária
      console.log(`\n[VixerTunnel] Não foi possível obter a URL fixa após ${MAX_RETRIES} tentativas.`);
      console.log(`[VixerTunnel] Usando URL temporária por enquanto...\n`);
      setupTunnel(tunnel);
    } else {
      // Tenta de novo
      console.log(`[VixerTunnel] Subdomínio ocupado. URL temp: ${tunnel.url}. Retentando em 6s...`);
      tunnel.close();
      setTimeout(startFixedTunnel, 6000);
    }
  } catch (err) {
    console.error('[VixerTunnel Error]:', err.message);
    setTimeout(startFixedTunnel, 6000);
  }
}

startFixedTunnel();
