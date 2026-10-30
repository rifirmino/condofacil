// Junta os módulos de src/ num único HTML, sem dependências.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = dirname(fileURLToPath(import.meta.url));

// Ordem de dependência: cada arquivo usa apenas nomes dos anteriores.
export const ORDEM = [
  'src/vendor.js',
  'src/datas.js',
  'src/planos.js',
  'src/financeiro/dados.js',
  'src/cobranca/dados.js',
  'src/cobranca/regras.js',
  'src/cobranca/composicao.js',
  'src/cobranca/acoes.js',
  'src/cobranca/acordos.js',
  'src/vendas/dados.js',
  'src/enquetes/dados.js',
  'src/implantacao/regras.js',
  'src/implantacao/novo.js',
  'src/dados.js',
  'src/regras.js',
  'src/configuracoes.js',
  'src/notificacoes/regras.js',
  'src/acoes.js',
  'src/notificacoes/acoes.js',
  'src/moradores/acoes.js',
  'src/implantacao/acoes.js',
  'src/conectado/acoes.js',
  'src/enquetes/regras.js',
  'src/enquetes/acoes.js',
  'src/cobranca/acoes-composicao.js',
  'src/cobranca/orcamento.js',
  'src/cobranca/acoes-orcamento.js',
  'src/financeiro/contas.js',
  'src/financeiro/balancete.js',
  'src/financeiro/fluxo.js',
  'src/financeiro/acoes.js',
  'src/infracoes/regras.js',
  'src/infracoes/acoes.js',
  'src/manutencao/dados.js',
  'src/manutencao/regras.js',
  'src/manutencao/acoes.js',
  'src/escala/dados.js',
  'src/escala/regras.js',
  'src/escala/acoes.js',
  'src/escala/colaboradores.js',
  'src/vendas/regras.js',
  'src/vendas/acoes.js',
  'src/assistente/manual.js',
  'src/assistente/avatar.js',
  'src/assistente/regras.js',
  'src/assistente/ia.js',
  'src/assistente/ferramentas.js',
  'src/casos/afirmar.js',
  'src/casos/dados.js',
  'src/casos/regras.js',
  'src/casos/acoes.js',
  'src/casos/vendas.js',
  'src/casos/cobranca-dados.js',
  'src/casos/cobranca-regras.js',
  'src/casos/cobranca-acoes.js',
  'src/casos/acordos.js',
  'src/casos/notificacoes.js',
  'src/casos/manutencao.js',
  'src/casos/escala.js',
  'src/casos/composicao.js',
  'src/casos/infracoes.js',
  'src/casos/orcamento.js',
  'src/casos/financeiro.js',
  'src/casos/enquetes.js',
  'src/casos/implantacao.js',
  'src/casos/conectado.js',
  'src/casos/assistente.js',
  'src/armazenamento.js',
  'src/conectado/cliente.js',
  'src/ui/comum.js',
  'src/ui/escala-semana.js',
  'src/ui/escala-portaria.js',
  'src/ui/portaria.js',
  'src/ui/financeiro-sindico.js',
  'src/ui/composicao.js',
  'src/ui/orcamento.js',
  'src/ui/financeiro.js',
  'src/ui/conselho.js',
  'src/ui/enquetes.js',
  'src/ui/enquetes-morador.js',
  'src/ui/infracoes.js',
  'src/ui/acordos.js',
  'src/ui/manutencao-sindico.js',
  'src/ui/escala-sindico.js',
  'src/ui/financeiro-morador.js',
  'src/ui/vendas.js',
  'src/ui/morador.js',
  'src/ui/sindico.js',
  'src/ui/zelador.js',
  'src/ui/assistente.js',
  'src/ui/implantacao.js',
  'src/ui/moradores.js',
  'src/ui/convite.js',
  'src/ui/configuracoes.js',
  'src/ui/colaboradores.js',
  'src/ui/app.js',
];

export function transformar(codigo) {
  return codigo
    .split(/\r?\n/)
    .filter((linha) => !/^import .* from '\.\.?\//.test(linha))
    .filter((linha) => !/^export \{.*\};?\s*$/.test(linha))
    .map((linha) => linha.replace(/^export (async function|function|const|let|class) /, '$1 '))
    .join('\n');
}

export function montar() {
  const js = ORDEM.map((arquivo) => `// ---- ${arquivo} ----\n${transformar(readFileSync(join(raiz, arquivo), 'utf8'))}`).join('\n');
  const css = readFileSync(join(raiz, 'src/estilos.css'), 'utf8');
  const base = readFileSync(join(raiz, 'src/base.html'), 'utf8');
  // Data da montagem, mostrada no topo do app: confere se o celular já abriu a versão nova.
  const versao = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
  return base.replace('/*CSS*/', () => css).replace('/*JS*/', () => js.replace("'__VERSAO__'", () => JSON.stringify(versao)));
}

export function extrairScript(pagina) {
  const inicio = pagina.indexOf('<script type="module">') + '<script type="module">'.length;
  return pagina.slice(inicio, pagina.indexOf('</script>', inicio));
}

// Mesmo invólucro que a publicação como Artifact acrescenta; usado só nos testes locais.
export function envolverLocal(pagina) {
  return `<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${pagina}\n</body>\n</html>\n`;
}
