// Restaura index.html para modo DEV (./src/main.js)
const fs = require('fs');
let h = fs.readFileSync('index.html', 'utf8');
h = h.replace(/<script[^>]*src="\.\/assets\/[^"]+\"[^>]*><\/script>/g, '<script type="module" src="./src/main.js"></script>');
h = h.replace(/<link[^>]*href="\.\/assets\/[^"]+\.css"[^>]*>/g, '<link rel="stylesheet" href="./src/style.css">');
fs.writeFileSync('index.html', h);
console.log('[Vixer] index.html → modo DEV');
