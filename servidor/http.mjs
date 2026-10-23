import { createServer } from 'node:http';

// Entrega a página do protótipo e encaminha /api para as rotas.
const LIMITE_CORPO = 1024 * 1024;
const SEGURANCA = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' };

function responderJson(res, status, corpo) {
  res.writeHead(status, { ...SEGURANCA, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(corpo));
}

async function lerCorpo(req) {
  let texto = '';
  for await (const parte of req) {
    texto += parte;
    if (texto.length > LIMITE_CORPO) throw new Error('grande');
  }
  return texto ? JSON.parse(texto) : null;
}

export function criarServidor({ rotas, pagina }) {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://local');
    if (!url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') { responderJson(res, 405, { erro: 'Método não permitido' }); return; }
      res.writeHead(200, { ...SEGURANCA, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : pagina());
      return;
    }
    let corpo = null;
    try {
      corpo = await lerCorpo(req);
    } catch {
      responderJson(res, 400, { erro: 'Corpo da requisição inválido' });
      return;
    }
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
    try {
      const r = await rotas.tratar({ metodo: req.method, caminho: url.pathname, consulta: Object.fromEntries(url.searchParams), cabecalhos: req.headers, corpo, ip, agora: new Date() });
      responderJson(res, r.status, r.corpo);
    } catch (e) {
      console.error(`Erro em ${req.method} ${url.pathname}: ${e.message}`);
      responderJson(res, 500, { erro: 'Erro interno do servidor' });
    }
  });
}
