// Copia dist/index.html e assets para root (produção)
const fs = require('fs');

// 1. Restaura para dev mode primeiro (para o Vite ler os sources)
let h = fs.readFileSync('index.html', 'utf8');
h = h.replace(/<script[^>]*src="\.\/assets\/[^"]+\"[^>]*><\/script>/g, '<script type="module" src="./src/main.js"></script>');
h = h.replace(/<link[^>]*href="\.\/assets\/[^"]+\.css"[^>]*>/g, '<link rel="stylesheet" href="./src/style.css">');
fs.writeFileSync('index.html', h);
console.log('[Vixer] Preparado para build...');
