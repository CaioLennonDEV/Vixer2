import localtunnel from 'localtunnel';

const SUBDOMAIN = 'vixer-pc-caio';
const PORT = 3001;

async function startFixedTunnel() {
  console.log(`[VixerTunnel] Solicitando URL fixa oficial: https://${SUBDOMAIN}.loca.lt ...`);
  try {
    const tunnel = await localtunnel({ port: PORT, subdomain: SUBDOMAIN });
    
    if (tunnel.url.includes(SUBDOMAIN)) {
      console.log(`\n======================================================`);
      console.log(`✨ SUCESSO! URL FIXA PADRONIZADA GARANTIDA:`);
      console.log(`👉  ${tunnel.url}  👈`);
      console.log(`======================================================\n`);
    } else {
      console.log(`\n[Aviso] O subdomínio '${SUBDOMAIN}' ainda estava liberando da sessão anterior.`);
      console.log(`[VixerTunnel] URL temporária: ${tunnel.url}`);
      console.log(`[VixerTunnel] Re-tentando pegar a URL oficial fixada em 4 segundos...\n`);
      tunnel.close();
      setTimeout(startFixedTunnel, 4000);
      return;
    }

    tunnel.on('close', () => {
      console.log('[VixerTunnel] Conexão encerrada. Reconectando...');
      setTimeout(startFixedTunnel, 3000);
    });

  } catch (err) {
    console.error('[VixerTunnel Error]:', err.message);
    setTimeout(startFixedTunnel, 4000);
  }
}

startFixedTunnel();
