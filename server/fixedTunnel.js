import localtunnel from 'localtunnel';

const SUBDOMAIN = 'vixer-pc-caio';
const PORT = 3001;
const KEEPALIVE_INTERVAL = 30_000; // Ping a cada 30s para manter vivo

let activeTunnel = null;
let keepaliveTimer = null;

// Impede que erros não tratados matem o processo
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
      try { tunnel.close(); } catch {}
      setTimeout(startFixedTunnel, 2000);
    }
  }, KEEPALIVE_INTERVAL);
}

async function startFixedTunnel() {
  if (activeTunnel) {
    try { activeTunnel.close(); } catch {}
    activeTunnel = null;
  }
  if (keepaliveTimer) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = null;
  }

  console.log(`[VixerTunnel] Solicitando URL fixa oficial: https://${SUBDOMAIN}.loca.lt ...`);
  try {
    const tunnel = await localtunnel({ port: PORT, subdomain: SUBDOMAIN });

    if (tunnel.url.includes(SUBDOMAIN)) {
      activeTunnel = tunnel;
      console.log(`\n======================================================`);
      console.log(`✨ SUCESSO! URL FIXA PADRONIZADA GARANTIDA:`);
      console.log(`👉  ${tunnel.url}  👈`);
      console.log(`======================================================\n`);

      // Keepalive para evitar desconexão por inatividade
      startKeepAlive(tunnel);
    } else {
      console.log(`\n[Aviso] O subdomínio '${SUBDOMAIN}' ainda estava liberando da sessão anterior.`);
      console.log(`[VixerTunnel] URL temporária: ${tunnel.url}`);
      console.log(`[VixerTunnel] Re-tentando pegar a URL oficial fixada em 4 segundos...\n`);
      tunnel.close();
      setTimeout(startFixedTunnel, 4000);
      return;
    }

    tunnel.on('close', () => {
      console.log('[VixerTunnel] Conexão encerrada. Reconectando em 3s...');
      activeTunnel = null;
      setTimeout(startFixedTunnel, 3000);
    });

    tunnel.on('error', (err) => {
      console.error('[VixerTunnel] Erro na conexão:', err.message);
      activeTunnel = null;
      setTimeout(startFixedTunnel, 3000);
    });

  } catch (err) {
    console.error('[VixerTunnel Error]:', err.message);
    setTimeout(startFixedTunnel, 4000);
  }
}

startFixedTunnel();
