// Servidor local para testar o protótipo no computador e em celulares da mesma rede (sem dependências).
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { raiz } from './navegador.mjs';

const porta = Number(process.env.PORTA) || 8080;

createServer((req, res) => {
  try {
    const pagina = readFileSync(join(raiz, 'condofacil-local.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(pagina);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Página não encontrada. Rode "npm run montar" antes de "npm run servir".');
  }
}).listen(porta, '0.0.0.0', () => {
  const ips = Object.values(networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log(`Protótipo no ar:\n  neste computador: http://localhost:${porta}`);
  for (const ip of ips) console.log(`  na rede (celular): http://${ip}:${porta}`);
  console.log('Ctrl+C para parar.');
});
