// Copia dist/index.html e assets para root (produção)
const fs = require('fs');

fs.copyFileSync('dist/index.html', 'index.html');
if (!fs.existsSync('assets')) fs.mkdirSync('assets');
fs.cpSync('dist/assets', 'assets', { recursive: true });
console.log('[Vixer] index.html → modo PRODUÇÃO ✅');
