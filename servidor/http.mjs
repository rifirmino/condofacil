import { createServer } from 'node:http';

// condofacil.cloud: página de vendas em /, o app em /app, o link do QR Code (/c/<condomínio>) abre o convite e /api vai para as rotas.
const LIMITE_CORPO = 1024 * 1024;
const SEGURANCA = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' };

function responderJson(res, status, corpo) {
  res.writeHead(status, { ...SEGURANCA, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(corpo));
}

function responderHtml(res, metodo, status, conteudo) {
  res.writeHead(status, { ...SEGURANCA, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(metodo === 'HEAD' ? undefined : conteudo);
}

async function lerCorpo(req) {
  let texto = '';
  for await (const parte of req) {
    texto += parte;
    if (texto.length > LIMITE_CORPO) throw new Error('grande');
  }
  return texto ? JSON.parse(texto) : null;
}

export function criarServidor({ rotas, paginas }) {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://local');
    if (!url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') { responderJson(res, 405, { erro: 'Método não permitido' }); return; }
      if (url.pathname.startsWith('/c/')) {
        res.writeHead(302, { ...SEGURANCA, Location: '/app#morador.convite' });
        res.end();
        return;
      }
      if (url.pathname === '/app' || url.pathname === '/app/') { responderHtml(res, req.method, 200, paginas.app()); return; }
      if (url.pathname === '/' || url.pathname === '/index.html') { responderHtml(res, req.method, 200, paginas.site()); return; }
      responderHtml(res, req.method, 404, '<!doctype html><meta charset="utf-8"><title>Página não encontrada</title><p>Página não encontrada. <a href="/">Ir para o CondoFácil</a></p>');
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
