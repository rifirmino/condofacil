# Vendas entre moradores · Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Acrescentar ao protótipo CondoFácil o módulo de vendas entre moradores (vitrine, sacola, pedidos com conversa, loja e painel do vendedor, aprovação e moderação pelo síndico), descrito em `docs/superpowers/specs/2026-10-08-vendas-entre-moradores-design.md`.

**Architecture:** O protótipo já existente é estendido seguindo o mesmo padrão:
- dados iniciais em `src/vendas/dados.js`;
- regras puras em `src/vendas/regras.js` e ações puras em `src/vendas/acoes.js`, todas testadas por casos em `src/casos/vendas.js`, que rodam no `node --test` e no `?teste=1`;
- telas do morador em `src/ui/vendas.js` e da moderação em `src/ui/sindico.js`.

O app do morador passa a seguir `estado.moradorAtual` (Ana 302 ou Juliana 104) no lugar da constante `UNIDADE_ANA`.

**Tech Stack:** Preact + htm (unpkg, já em uso), Node 24 (`node:test`), Chrome headless (`verificar.mjs`, `e2e.mjs`).

## Global Constraints

- Todo texto de interface em português do Brasil.
- `prototipo/condofacil.html` é sempre gerado por `npm run montar`.
- Regras do montador:
  - imports locais em uma linha;
  - `export` só em declarações de nível superior;
  - nomes de nível superior únicos entre todos os arquivos de `src/`;
  - código aninhado indentado.
- Rotas no formato `#perfil.tela.id`.
- Dinheiro em centavos (inteiros), formatado por `fmtCentavos` como `R$ 18,00`.
- Nenhuma pessoa ou marca real. Fotos de produto são simuladas.
- Tokens de cor do `estilos.css` atual (visual Katror). Sem cores literais novas, exceto `#ffffff` sobre laranja, como já é feito.
- Alvos de toque com pelo menos 44 px. Sem rolagem horizontal em 390 px.
- Comandos rodam em `prototipo/`. Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Os 6 roteiros atuais do `e2e.mjs` e as checagens atuais do `verificar.mjs` continuam passando.

## Estrutura de arquivos

```
prototipo/src/
  vendas/dados.js      NOVO  constantes, vendasIniciais(em), perfilVenda(unidade, em)
  vendas/regras.js     NOVO  regras puras do módulo
  vendas/acoes.js      NOVO  ações puras do módulo
  casos/vendas.js      NOVO  CASOS_VENDAS
  ui/vendas.js         NOVO  TelaVendas e CartaoAnuncio
  dados.js             MOD   versao 2, campos novos em pessoas e no estado
  armazenamento.js     MOD   aceita versao 2
  ui/comum.js          MOD   ícones sacola, loja, etiqueta, pessoa
  ui/morador.js        MOD   seletor Ana/Juliana, aba Vendas, Minhas preferências, Novidades na vitrine, unidade atual
  ui/sindico.js        MOD   item Vendas (SVendas) e "Aprovar vendedor" no Início
  ui/app.js            MOD   inclui CASOS_VENDAS no autoteste
  estilos.css          MOD   estilos do módulo
prototipo/montagem.mjs MOD   ORDEM
prototipo/testes/casos.test.mjs  MOD
prototipo/verificar.mjs MOD  checagens
prototipo/e2e.mjs       MOD  3 roteiros novos + larguras
```

---

### Task 1: Dados do módulo

**Files:**
- Create: `prototipo/src/vendas/dados.js`
- Modify: `prototipo/src/dados.js`, `prototipo/src/armazenamento.js`, `prototipo/montagem.mjs`

**Interfaces:**
- Produces:
  - `MORADORES_DEMO = [['302','Ana'],['104','Juliana']]`
  - `CATEGORIAS_VENDA`, `PAGAMENTOS`, `ENTREGAS`, `NOMES_STATUS_PEDIDO` (objetos id → rótulo)
  - `vendasIniciais(em) → { anuncios, pedidos, proximoPedido: 11 }`
  - `perfilVenda(unidade, em) → { recebeOfertas, vendedor, pedidoVenda, motivoVendedor }`
  - O `Estado` ganha `versao: 2`, `moradorAtual: '302'`, `sacola: []`, `anuncios`, `pedidos` e `proximoPedido`, e cada pessoa ganha os campos de `perfilVenda`.

- [ ] **Step 1: Criar `src/vendas/dados.js`**

```js
// Constantes e dados iniciais do módulo de vendas entre moradores.
export const MORADORES_DEMO = [['302', 'Ana'], ['104', 'Juliana']];
export const CATEGORIAS_VENDA = { doces: 'Doces', salgados: 'Salgados', artesanato: 'Artesanato', desapego: 'Desapego', servicos: 'Serviços' };
export const PAGAMENTOS = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão na entrega' };
export const ENTREGAS = { retirar: 'Retirar no apto', porta: 'Entrega na porta' };
export const NOMES_STATUS_PEDIDO = { novo: 'Novo', aceito: 'Aceito', entregue: 'Entregue', recusado: 'Recusado', cancelado: 'Cancelado' };

const VENDEDORES_INICIAIS = { 104: 'aprovado', 201: 'aprovado', 102: 'pendente' };
const ACEITAM_OFERTAS = ['101', '203', '301', '401', '404', '501', '601', '702', '703'];

// [número, dias atrás, comprador, [[anúncio, quantidade]], situação]
const HISTORICO_JULIANA = [
  [1, 44, '101', [['a1', 2]], 'entregue'],
  [2, 38, '203', [['a2', 1]], 'entregue'],
  [3, 31, '401', [['a1', 3]], 'entregue'],
  [4, 25, '501', [['a1', 1], ['a2', 2]], 'entregue'],
  [5, 19, '601', [['a1', 1]], 'recusado'],
  [6, 14, '702', [['a2', 2]], 'entregue'],
  [7, 9, '301', [['a1', 2]], 'entregue'],
  [8, 5, '404', [['a1', 1]], 'cancelado'],
  [9, 3, '703', [['a1', 1], ['a2', 1]], 'entregue'],
  [10, 1, '201', [['a2', 2]], 'entregue'],
];

export function vendasIniciais(em) {
  const anuncios = [
    { id: 'a1', vendedor: '104', titulo: 'Brigadeiro gourmet (caixa com 6)', descricao: 'Brigadeiros de chocolate belga, granulado e ninho. Feitos no dia.', categoria: 'doces', preco: 1800, quantidade: 10, pagamentos: ['pix', 'dinheiro'], entregas: ['retirar', 'porta'], ativo: true, oculto: false, motivoOculto: null, criadoEm: em(-20, 9) },
    { id: 'a2', vendedor: '104', titulo: 'Bolo de pote de ninho com morango', descricao: 'Pote de 250 ml com massa de baunilha, creme de ninho e morango fresco.', categoria: 'doces', preco: 1200, quantidade: 6, pagamentos: ['pix'], entregas: ['retirar'], ativo: true, oculto: false, motivoOculto: null, criadoEm: em(-6, 10) },
    { id: 'a3', vendedor: '201', titulo: 'Bicicleta infantil aro 16', descricao: 'Usada por um ano, com rodinhas laterais. Pneus novos.', categoria: 'desapego', preco: 15000, quantidade: 1, pagamentos: ['pix', 'dinheiro', 'cartao'], entregas: ['retirar'], ativo: true, oculto: false, motivoOculto: null, criadoEm: em(-2, 18) },
  ];
  const anuncioSemente = (id) => anuncios.find((a) => a.id === id);
  const pedidos = HISTORICO_JULIANA.map(([n, dias, comprador, itens, status]) => {
    const criadoEm = em(-dias, 10);
    const linha = [{ em: criadoEm, status: 'novo', texto: 'Pedido enviado' }];
    if (status === 'entregue') linha.push({ em: em(-dias, 12), status: 'aceito', texto: 'Pedido aceito pelo vendedor' }, { em: em(-dias, 19), status: 'entregue', texto: 'Pedido entregue' });
    if (status === 'recusado') linha.push({ em: em(-dias, 12), status: 'recusado', texto: 'Recusado: Sem ingredientes nesta semana' });
    if (status === 'cancelado') linha.push({ em: em(-dias, 11), status: 'cancelado', texto: 'Cancelado pelo comprador' });
    return {
      id: `PD-${String(n).padStart(3, '0')}`,
      comprador,
      vendedor: '104',
      itens: itens.map(([anuncioId, quantidade]) => ({ anuncioId, titulo: anuncioSemente(anuncioId).titulo, quantidade, preco: anuncioSemente(anuncioId).preco })),
      pagamento: 'pix',
      entrega: 'retirar',
      status,
      pago: status === 'entregue',
      motivo: status === 'recusado' ? 'Sem ingredientes nesta semana' : null,
      linha,
      mensagens: [],
      criadoEm,
      entregueEm: status === 'entregue' ? em(-dias, 19) : null,
    };
  });
  return { anuncios, pedidos, proximoPedido: 11 };
}

export function perfilVenda(unidade, em) {
  return {
    recebeOfertas: ACEITAM_OFERTAS.includes(unidade),
    vendedor: VENDEDORES_INICIAIS[unidade] || 'nao',
    pedidoVenda: unidade === '102' ? { texto: 'Salgados assados para festas', em: em(-1, 19) } : null,
    motivoVendedor: null,
  };
}
```

- [ ] **Step 2: Integrar em `src/dados.js`**

1. Na primeira linha, logo abaixo do import de `./datas.js`, acrescente:
```js
import { vendasIniciais, perfilVenda } from './vendas/dados.js';
```
2. Troque `versao: 1,` por `versao: 2,`.
3. Troque a linha de `pessoas` por:
```js
    pessoas: MORADORES.map(([unidade, nome]) => ({ id: `p${unidade}`, nome, unidade, ...perfilVenda(unidade, em) })),
```
4. Imediatamente antes do `};` que fecha o objeto retornado por `dadosIniciais` (depois do array `encomendas`), acrescente:
```js
    moradorAtual: UNIDADE_ANA,
    sacola: [],
    ...vendasIniciais(em),
```

Em `src/armazenamento.js`, troque `estado.versao === 1` por `estado.versao === 2`. Dados salvos no formato antigo passam a ser descartados.

Em `prototipo/montagem.mjs`, acrescente `'src/vendas/dados.js',` na `ORDEM`, imediatamente antes de `'src/dados.js',`.

- [ ] **Step 3: Rodar a bateria**

Run: `npm test && npm run montar && npm run verificar && npm run e2e`
Expected: tudo verde. Os dados novos não mudam nada do que já existe.

- [ ] **Step 4: Commit**

```bash
git add prototipo
git commit -m "feat(vendas): dados iniciais do módulo de vendas entre moradores

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Regras do módulo

**Files:**
- Create: `prototipo/src/vendas/regras.js`, `prototipo/src/casos/vendas.js`
- Modify: `prototipo/testes/casos.test.mjs`, `prototipo/montagem.mjs`, `prototipo/src/ui/app.js`

**Interfaces:**
- Consumes: `datas.js` (`isoDia`, `somarDias`) e os dados da Task 1.
- Produces (puras):
  - Formatação e dados:
    - `fmtCentavos(c)` e `lerPreco(texto) → centavos | NaN`
    - `pessoaDaUnidade(estado, u)`, `nomeVizinho(estado, u)`, `anuncioPorId(estado, id)`
  - Anúncios e sacola:
    - `podePublicar(estado, u) → {ok}|{ok:false, motivo}`
    - `anunciosVisiveis(estado)`, do mais recente ao mais antigo
    - `quantidadeNaSacola(estado, anuncioId)`
    - `podeAdicionar(estado, u, anuncioId, quantidade)`
    - `sacolaPorVendedor(estado) → [{ vendedor, nome, itens:[{anuncio, quantidade, subtotal}], subtotal, pagamentos, entregas }]`
    - `validarAnuncio(dados)`
    - `destinatariosOfertas(estado, vendedor) → unidades`
  - Pedidos e painel:
    - `acoesPedido(pedido, u) → subconjunto de ['aceitar','recusar','entregar','pago','cancelar','conversar']`
    - `totalPedido(pedido)`
    - `inicioPeriodo(periodo, hoje)`
    - `painelVendas(estado, vendedor, periodo, agora) → { pedidos, faturamento, entregues, ticket, itens, barras:[{rotulo, valor}], maisVendidos:[{titulo, quantidade}], situacao:{entregues, andamento, recusados, cancelados} }`

- [ ] **Step 1: Escrever os casos que falham, só as regras por enquanto**

`prototipo/src/casos/vendas.js`:
```js
import { dadosIniciais } from '../dados.js';
import { fmtCentavos, lerPreco, podePublicar, anunciosVisiveis, podeAdicionar, sacolaPorVendedor, validarAnuncio, acoesPedido, painelVendas, destinatariosOfertas } from '../vendas/regras.js';
import { igual, AGORA_TESTE } from './afirmar.js';

const ANUNCIO_BOLO = { titulo: 'Bolo de cenoura com chocolate', descricao: 'Inteiro, 20 cm', categoria: 'doces', preco: 3500, quantidade: 4, pagamentos: ['pix'], entregas: ['retirar'] };

function comSacola(itens) {
  return { ...dadosIniciais(AGORA_TESTE), sacola: itens.map(([anuncioId, quantidade]) => ({ anuncioId, quantidade })) };
}

export const CASOS_VENDAS = [
  {
    nome: 'vendas: dados iniciais',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual([e.anuncios.length, e.pedidos.length, e.proximoPedido, e.moradorAtual, e.sacola], [3, 10, 11, '302', []]);
      const situacao = (u) => e.pessoas.find((p) => p.unidade === u).vendedor;
      igual([situacao('104'), situacao('201'), situacao('102'), situacao('302')], ['aprovado', 'aprovado', 'pendente', 'nao']);
      igual(e.pessoas.filter((p) => p.recebeOfertas).length, 9);
    },
  },
  {
    nome: 'vendas: preço em centavos',
    rodar() {
      igual([lerPreco('18,00'), lerPreco('18'), lerPreco('1.234,56'), lerPreco('R$ 35,5')], [1800, 1800, 123456, 3550]);
      igual([Number.isNaN(lerPreco('')), Number.isNaN(lerPreco('abc'))], [true, true]);
      igual([fmtCentavos(1800), fmtCentavos(15000)], ['R$ 18,00', 'R$ 150,00']);
    },
  },
  {
    nome: 'vendas: só vendedor aprovado publica',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual(podePublicar(e, '104'), { ok: true });
      igual(podePublicar(e, '302').motivo, 'Só vendedores aprovados pelo síndico podem anunciar');
      igual(podePublicar(e, '102').ok, false);
    },
  },
  {
    nome: 'vendas: vitrine mostra só anúncios ativos de vendedor aprovado',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual(anunciosVisiveis(e).map((a) => a.id), ['a3', 'a2', 'a1']);
      const suspenso = { ...e, pessoas: e.pessoas.map((p) => (p.unidade === '201' ? { ...p, vendedor: 'suspenso' } : p)) };
      igual(anunciosVisiveis(suspenso).map((a) => a.id), ['a2', 'a1']);
      const pausado = { ...e, anuncios: e.anuncios.map((a) => (a.id === 'a2' ? { ...a, ativo: false } : a)) };
      igual(anunciosVisiveis(pausado).map((a) => a.id), ['a3', 'a1']);
    },
  },
  {
    nome: 'vendas: limites ao pôr na sacola',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual(podeAdicionar(e, '302', 'a1', 2), { ok: true });
      igual(podeAdicionar(e, '104', 'a1', 1).motivo, 'Você não pode comprar o próprio anúncio');
      igual(podeAdicionar(e, '302', 'a3', 2).motivo, 'Só resta 1 unidade');
      igual(podeAdicionar(e, '302', 'a1', 0).motivo, 'Escolha ao menos 1 unidade');
      igual(podeAdicionar(comSacola([['a1', 9]]), '302', 'a1', 2).motivo, 'Só restam 10 unidades');
    },
  },
  {
    nome: 'vendas: sacola agrupada por vendedor com opções em comum',
    rodar() {
      const grupos = sacolaPorVendedor(comSacola([['a1', 2], ['a2', 1], ['a3', 1]]));
      igual(grupos.map((g) => [g.vendedor, g.subtotal, g.pagamentos, g.entregas]), [
        ['104', 4800, ['pix'], ['retirar']],
        ['201', 15000, ['pix', 'dinheiro', 'cartao'], ['retirar']],
      ]);
    },
  },
  {
    nome: 'vendas: validação do anúncio',
    rodar() {
      igual(validarAnuncio(ANUNCIO_BOLO), { ok: true });
      igual(validarAnuncio({ ...ANUNCIO_BOLO, titulo: ' ' }).motivo, 'Preencha título, preço e quantidade');
      igual(validarAnuncio({ ...ANUNCIO_BOLO, preco: NaN }).motivo, 'Preencha título, preço e quantidade');
      igual(validarAnuncio({ ...ANUNCIO_BOLO, preco: -5 }).motivo, 'Preço precisa ser maior que zero');
      igual(validarAnuncio({ ...ANUNCIO_BOLO, quantidade: 1.5 }).motivo, 'Quantidade precisa ser um número inteiro');
      igual(validarAnuncio({ ...ANUNCIO_BOLO, pagamentos: [] }).motivo, 'Escolha ao menos uma forma de pagamento');
      igual(validarAnuncio({ ...ANUNCIO_BOLO, entregas: [] }).motivo, 'Escolha ao menos uma forma de entrega');
    },
  },
  {
    nome: 'vendas: ações possíveis em cada situação do pedido',
    rodar() {
      const p = (status, pago = false) => ({ vendedor: '104', comprador: '302', status, pago });
      igual(acoesPedido(p('novo'), '104'), ['aceitar', 'recusar', 'pago', 'conversar']);
      igual(acoesPedido(p('novo'), '302'), ['cancelar', 'conversar']);
      igual(acoesPedido(p('aceito'), '104'), ['entregar', 'pago', 'conversar']);
      igual(acoesPedido(p('entregue', true), '104'), ['conversar']);
      igual(acoesPedido(p('recusado'), '104'), []);
      igual(acoesPedido(p('novo'), '501'), []);
    },
  },
  {
    nome: 'vendas: painel dos últimos 7 dias',
    rodar() {
      igual(painelVendas(dadosIniciais(AGORA_TESTE), '104', '7d', AGORA_TESTE), {
        pedidos: 3,
        faturamento: 5400,
        entregues: 2,
        ticket: 2700,
        itens: 4,
        barras: [
          { rotulo: '2026-10-02', valor: 0 }, { rotulo: '2026-10-03', valor: 0 }, { rotulo: '2026-10-04', valor: 0 },
          { rotulo: '2026-10-05', valor: 3000 }, { rotulo: '2026-10-06', valor: 0 }, { rotulo: '2026-10-07', valor: 2400 },
          { rotulo: '2026-10-08', valor: 0 },
        ],
        maisVendidos: [{ titulo: 'Bolo de pote de ninho com morango', quantidade: 3 }, { titulo: 'Brigadeiro gourmet (caixa com 6)', quantidade: 1 }],
        situacao: { entregues: 2, andamento: 0, recusados: 0, cancelados: 1 },
      });
    },
  },
  {
    nome: 'vendas: painel dos últimos 30 dias e do mês',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      const trinta = painelVendas(e, '104', '30d', AGORA_TESTE);
      igual([trinta.pedidos, trinta.faturamento, trinta.ticket, trinta.itens], [7, 15600, 3120, 11]);
      igual(trinta.barras.map((b) => b.valor), [4200, 0, 6000, 3000, 2400]);
      igual(trinta.barras[0].rotulo, '2026-09-09');
      igual(trinta.situacao, { entregues: 5, andamento: 0, recusados: 1, cancelados: 1 });
      const mes = painelVendas(e, '104', 'mes', AGORA_TESTE);
      igual([mes.pedidos, mes.barras.map((b) => b.valor)], [3, [5400, 0]]);
    },
  },
  {
    nome: 'vendas: aviso de anúncio só para quem aceita ofertas',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual([destinatariosOfertas(e, '104').length, destinatariosOfertas(e, '101').length], [9, 8]);
    },
  },
];
```

Atualize `prototipo/testes/casos.test.mjs`:
```js
import { test } from 'node:test';
import { CASOS_DADOS } from '../src/casos/dados.js';
import { CASOS_REGRAS } from '../src/casos/regras.js';
import { CASOS_ACOES } from '../src/casos/acoes.js';
import { CASOS_VENDAS } from '../src/casos/vendas.js';

for (const caso of [...CASOS_DADOS, ...CASOS_REGRAS, ...CASOS_ACOES, ...CASOS_VENDAS]) test(caso.nome, () => caso.rodar());
```

Run: `npm test`
Expected: FAIL. `../vendas/regras.js` não existe.

- [ ] **Step 2: Implementar `src/vendas/regras.js`**

```js
import { isoDia, somarDias } from '../datas.js';

const VENDA_OK = { ok: true };

function falhaVenda(motivo) {
  return { ok: false, motivo };
}

function restam(n) {
  return n === 1 ? 'Só resta 1 unidade' : `Só restam ${n} unidades`;
}

export function fmtCentavos(centavos) {
  return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;
}

export function lerPreco(texto) {
  const limpo = String(texto || '').replace(/R\$|\s/g, '').replace(/\./g, '').replace(',', '.');
  if (!limpo) return NaN;
  const valor = Number(limpo);
  return Number.isFinite(valor) ? Math.round(valor * 100) : NaN;
}

export function pessoaDaUnidade(estado, unidade) {
  return estado.pessoas.find((p) => p.unidade === unidade);
}

export function nomeVizinho(estado, unidade) {
  const p = pessoaDaUnidade(estado, unidade);
  return p ? p.nome : `Apto ${unidade}`;
}

export function anuncioPorId(estado, id) {
  return estado.anuncios.find((a) => a.id === id);
}

export function podePublicar(estado, unidade) {
  const p = pessoaDaUnidade(estado, unidade);
  return p && p.vendedor === 'aprovado' ? VENDA_OK : falhaVenda('Só vendedores aprovados pelo síndico podem anunciar');
}

function anuncioVisivel(estado, anuncio) {
  const p = pessoaDaUnidade(estado, anuncio.vendedor);
  return anuncio.ativo && !anuncio.oculto && !!p && p.vendedor === 'aprovado';
}

export function anunciosVisiveis(estado) {
  return estado.anuncios.filter((a) => anuncioVisivel(estado, a)).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export function quantidadeNaSacola(estado, anuncioId) {
  const item = estado.sacola.find((i) => i.anuncioId === anuncioId);
  return item ? item.quantidade : 0;
}

export function podeAdicionar(estado, unidade, anuncioId, quantidade) {
  const a = anuncioPorId(estado, anuncioId);
  if (!a || !anuncioVisivel(estado, a)) return falhaVenda('Anúncio indisponível');
  if (a.vendedor === unidade) return falhaVenda('Você não pode comprar o próprio anúncio');
  if (!Number.isInteger(quantidade) || quantidade < 1) return falhaVenda('Escolha ao menos 1 unidade');
  if (a.quantidade === 0) return falhaVenda('Produto esgotado');
  if (quantidadeNaSacola(estado, anuncioId) + quantidade > a.quantidade) return falhaVenda(restam(a.quantidade));
  return VENDA_OK;
}

function intersecao(listas) {
  return listas.reduce((acc, lista) => acc.filter((x) => lista.includes(x)));
}

export function sacolaPorVendedor(estado) {
  const grupos = [];
  for (const item of estado.sacola) {
    const anuncio = anuncioPorId(estado, item.anuncioId);
    if (!anuncio) continue;
    let grupo = grupos.find((g) => g.vendedor === anuncio.vendedor);
    if (!grupo) {
      grupo = { vendedor: anuncio.vendedor, nome: nomeVizinho(estado, anuncio.vendedor), itens: [], subtotal: 0 };
      grupos.push(grupo);
    }
    grupo.itens.push({ anuncio, quantidade: item.quantidade, subtotal: anuncio.preco * item.quantidade });
    grupo.subtotal += anuncio.preco * item.quantidade;
  }
  return grupos.map((g) => ({ ...g, pagamentos: intersecao(g.itens.map((i) => i.anuncio.pagamentos)), entregas: intersecao(g.itens.map((i) => i.anuncio.entregas)) }));
}

export function validarAnuncio(dados) {
  const titulo = String(dados.titulo || '').trim();
  if (!titulo || !Number.isFinite(dados.preco) || !Number.isFinite(dados.quantidade)) return falhaVenda('Preencha título, preço e quantidade');
  if (dados.preco <= 0) return falhaVenda('Preço precisa ser maior que zero');
  if (!Number.isInteger(dados.quantidade) || dados.quantidade < 0) return falhaVenda('Quantidade precisa ser um número inteiro');
  if (!dados.pagamentos || !dados.pagamentos.length) return falhaVenda('Escolha ao menos uma forma de pagamento');
  if (!dados.entregas || !dados.entregas.length) return falhaVenda('Escolha ao menos uma forma de entrega');
  return VENDA_OK;
}

export function acoesPedido(pedido, unidade) {
  const acoes = [];
  const encerrado = ['recusado', 'cancelado'].includes(pedido.status);
  if (unidade === pedido.vendedor) {
    if (pedido.status === 'novo') acoes.push('aceitar', 'recusar');
    if (pedido.status === 'aceito') acoes.push('entregar');
    if (!pedido.pago && !encerrado) acoes.push('pago');
  }
  if (unidade === pedido.comprador && pedido.status === 'novo') acoes.push('cancelar');
  if ((unidade === pedido.vendedor || unidade === pedido.comprador) && !encerrado) acoes.push('conversar');
  return acoes;
}

export function totalPedido(pedido) {
  return pedido.itens.reduce((soma, i) => soma + i.preco * i.quantidade, 0);
}

export function destinatariosOfertas(estado, vendedor) {
  return [...new Set(estado.pessoas.filter((p) => p.recebeOfertas && p.unidade !== vendedor).map((p) => p.unidade))];
}

export function inicioPeriodo(periodo, hoje) {
  if (periodo === '7d') return somarDias(hoje, -6);
  if (periodo === '30d') return somarDias(hoje, -29);
  return `${hoje.slice(0, 7)}-01`;
}

export function painelVendas(estado, vendedor, periodo, agora) {
  const hoje = isoDia(agora);
  const inicio = inicioPeriodo(periodo, hoje);
  const diaDe = (instante) => isoDia(new Date(instante));
  const doVendedor = estado.pedidos.filter((p) => p.vendedor === vendedor);
  const criados = doVendedor.filter((p) => diaDe(p.criadoEm) >= inicio && diaDe(p.criadoEm) <= hoje);
  const entregues = doVendedor.filter((p) => p.status === 'entregue' && p.entregueEm && diaDe(p.entregueEm) >= inicio && diaDe(p.entregueEm) <= hoje);
  const faturamento = entregues.reduce((soma, p) => soma + totalPedido(p), 0);
  const itens = entregues.reduce((soma, p) => soma + p.itens.reduce((t, i) => t + i.quantidade, 0), 0);
  const passo = periodo === '7d' ? 1 : 7;
  const barras = [];
  for (let dia = inicio; dia <= hoje; dia = somarDias(dia, passo)) {
    const fim = somarDias(dia, passo - 1);
    const valor = entregues.filter((p) => diaDe(p.entregueEm) >= dia && diaDe(p.entregueEm) <= fim).reduce((soma, p) => soma + totalPedido(p), 0);
    barras.push({ rotulo: dia, valor });
  }
  const porProduto = {};
  for (const p of entregues) for (const i of p.itens) porProduto[i.titulo] = (porProduto[i.titulo] || 0) + i.quantidade;
  const maisVendidos = Object.entries(porProduto).map(([titulo, quantidade]) => ({ titulo, quantidade })).sort((a, b) => b.quantidade - a.quantidade).slice(0, 3);
  return {
    pedidos: criados.length,
    faturamento,
    entregues: entregues.length,
    ticket: entregues.length ? Math.round(faturamento / entregues.length) : 0,
    itens,
    barras,
    maisVendidos,
    situacao: {
      entregues: criados.filter((p) => p.status === 'entregue').length,
      andamento: criados.filter((p) => ['novo', 'aceito'].includes(p.status)).length,
      recusados: criados.filter((p) => p.status === 'recusado').length,
      cancelados: criados.filter((p) => p.status === 'cancelado').length,
    },
  };
}
```

- [ ] **Step 3: Incluir no montador e no autoteste**

Em `prototipo/montagem.mjs`, na `ORDEM`:
- logo depois de `'src/acoes.js',`, acrescente `'src/vendas/regras.js',`;
- logo depois de `'src/casos/acoes.js',`, acrescente `'src/casos/vendas.js',`.

Em `prototipo/src/ui/app.js`:
- logo abaixo de `import { CASOS_ACOES } from '../casos/acoes.js';`, acrescente `import { CASOS_VENDAS } from '../casos/vendas.js';`;
- no `PainelTestes`, troque `[...CASOS_DADOS, ...CASOS_REGRAS, ...CASOS_ACOES]` por `[...CASOS_DADOS, ...CASOS_REGRAS, ...CASOS_ACOES, ...CASOS_VENDAS]`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test && npm run montar && npm run verificar`
Expected: todos os testes PASS (11 casos novos) e as checagens `ok`, inclusive `falhas: 0` no autoteste.

- [ ] **Step 5: Commit**

```bash
git add prototipo
git commit -m "feat(vendas): regras puras (vitrine, sacola, pedidos, painel por período)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Ações do módulo

**Files:**
- Create: `prototipo/src/vendas/acoes.js`
- Modify: `prototipo/src/casos/vendas.js`, `prototipo/montagem.mjs`

**Interfaces:**
- Consumes: regras da Task 2; `SINDICO` de `dados.js`; `MORADORES_DEMO` de `vendas/dados.js`.
- Produces: todas devolvem `{ estado, notificacao?, erro?, id? }`.
  - Morador e vendedor:
    - `trocarMorador(estado, u)` e `alternarOfertas(estado, u)`
    - `pedirParaVender(estado, u, texto, agora)`
    - `aprovarVendedor(estado, u)` e `recusarVendedor(estado, u, motivo)`
    - `suspenderVendedor(estado, u, motivo)` e `reativarVendedor(estado, u)`
  - Anúncios e sacola:
    - `publicarAnuncio(estado, u, dados, agora)`, que devolve `id`
    - `editarAnuncio(estado, u, id, mudanca)`
    - `ocultarAnuncio(estado, id, motivo)` e `mostrarAnuncio(estado, id)`
    - `adicionarASacola(estado, anuncioId, quantidade)` e `removerDaSacola(estado, anuncioId)`
  - Pedidos:
    - `fecharPedido(estado, escolhas, agora)`, que devolve `id` (primeiro pedido) e `ids`
    - `aceitarPedido`, `marcarEntregue`, `marcarPago` e `cancelarPedido`, todas com `(estado, id, u, agora)`
    - `recusarPedido(estado, id, u, motivo, agora)`
    - `enviarMensagem(estado, id, u, texto, agora)`

- [ ] **Step 1: Acrescentar os casos que falham**

Em `prototipo/src/casos/vendas.js`:

1. Troque a primeira linha por `import { dadosIniciais, SINDICO } from '../dados.js';`.
2. Logo abaixo do import de `../vendas/regras.js`, acrescente:
```js
import { trocarMorador, alternarOfertas, pedirParaVender, aprovarVendedor, recusarVendedor, suspenderVendedor, reativarVendedor, publicarAnuncio, editarAnuncio, ocultarAnuncio, mostrarAnuncio, adicionarASacola, fecharPedido, aceitarPedido, recusarPedido, marcarEntregue, marcarPago, cancelarPedido, enviarMensagem } from '../vendas/acoes.js';
```
3. Logo abaixo de `function comSacola…`, acrescente:
```js
const RETIRAR_PIX = { pagamento: 'pix', entrega: 'retirar' };

function compraDaAna() {
  let e = dadosIniciais(AGORA_TESTE);
  e = adicionarASacola(e, 'a1', 2).estado;
  e = adicionarASacola(e, 'a2', 1).estado;
  return fecharPedido(e, { 104: RETIRAR_PIX }, AGORA_TESTE);
}

function pedidoDe(estado, id) {
  return estado.pedidos.find((p) => p.id === id);
}

function anuncioDe(estado, id) {
  return estado.anuncios.find((a) => a.id === id);
}

function pessoaDe(estado, unidade) {
  return estado.pessoas.find((p) => p.unidade === unidade);
}
```
4. Acrescente ao final do array `CASOS_VENDAS`, antes do `];`:
```js
  {
    nome: 'vendas: roteiro compra cria pedido, desconta estoque e avisa o vendedor',
    rodar() {
      const r = compraDaAna();
      igual(r.erro, undefined);
      igual([r.id, anuncioDe(r.estado, 'a1').quantidade, anuncioDe(r.estado, 'a2').quantidade, r.estado.sacola, r.estado.proximoPedido], ['PD-011', 8, 5, [], 12]);
      const p = pedidoDe(r.estado, 'PD-011');
      igual([p.comprador, p.vendedor, p.status, p.pagamento, p.entrega], ['302', '104', 'novo', 'pix', 'retirar']);
      igual([r.notificacao.canal, r.notificacao.para], ['WhatsApp', 'Juliana Costa']);
    },
  },
  {
    nome: 'vendas: fechar pedido exige sacola, pagamento e entrega válidos',
    rodar() {
      igual(fecharPedido(dadosIniciais(AGORA_TESTE), {}, AGORA_TESTE).erro, 'Sua sacola está vazia');
      const e = comSacola([['a1', 1], ['a2', 1]]);
      igual(fecharPedido(e, {}, AGORA_TESTE).erro, 'Escolha a forma de pagamento');
      igual(fecharPedido(e, { 104: { pagamento: 'pix', entrega: 'porta' } }, AGORA_TESTE).erro, 'Escolha a forma de entrega');
    },
  },
  {
    nome: 'vendas: sacola com dois vendedores gera dois pedidos',
    rodar() {
      const r = fecharPedido(comSacola([['a1', 1], ['a3', 1]]), { 104: RETIRAR_PIX, 201: RETIRAR_PIX }, AGORA_TESTE);
      igual([r.ids, anuncioDe(r.estado, 'a3').quantidade], [['PD-011', 'PD-012'], 0]);
      igual(r.notificacao.texto.includes('e mais 1 pedido'), true);
    },
  },
  {
    nome: 'vendas: roteiro atendimento até entrar no painel',
    rodar() {
      let e = compraDaAna().estado;
      igual(aceitarPedido(e, 'PD-011', '302', AGORA_TESTE).erro, 'Ação não permitida para este pedido');
      const aceito = aceitarPedido(e, 'PD-011', '104', AGORA_TESTE);
      igual([pedidoDe(aceito.estado, 'PD-011').status, aceito.notificacao.para], ['aceito', 'Ana Souza']);
      e = aceito.estado;
      igual(enviarMensagem(e, 'PD-011', '104', '  ', AGORA_TESTE).erro, 'Escreva a mensagem');
      igual(enviarMensagem(e, 'PD-011', '501', 'Oi', AGORA_TESTE).erro, 'Ação não permitida para este pedido');
      const msg = enviarMensagem(e, 'PD-011', '104', 'Pode passar às 18h', AGORA_TESTE);
      igual([pedidoDe(msg.estado, 'PD-011').mensagens.map((m) => [m.autor, m.texto]), msg.notificacao.para], [[['104', 'Pode passar às 18h']], 'Ana Souza']);
      e = marcarEntregue(msg.estado, 'PD-011', '104', AGORA_TESTE).estado;
      e = marcarPago(e, 'PD-011', '104', AGORA_TESTE).estado;
      const p = pedidoDe(e, 'PD-011');
      igual([p.status, p.pago], ['entregue', true]);
      igual(painelVendas(e, '104', '7d', AGORA_TESTE).faturamento, 10200);
    },
  },
  {
    nome: 'vendas: recusar exige motivo e devolve o estoque',
    rodar() {
      const e = compraDaAna().estado;
      igual(recusarPedido(e, 'PD-011', '104', ' ', AGORA_TESTE).erro, 'Informe o motivo da recusa');
      const r = recusarPedido(e, 'PD-011', '104', 'Sem ingredientes hoje', AGORA_TESTE);
      igual([pedidoDe(r.estado, 'PD-011').status, anuncioDe(r.estado, 'a1').quantidade, anuncioDe(r.estado, 'a2').quantidade], ['recusado', 10, 6]);
    },
  },
  {
    nome: 'vendas: só o comprador cancela e o estoque volta',
    rodar() {
      const e = compraDaAna().estado;
      igual(cancelarPedido(e, 'PD-011', '104', AGORA_TESTE).erro, 'Ação não permitida para este pedido');
      const r = cancelarPedido(e, 'PD-011', '302', AGORA_TESTE);
      igual([pedidoDe(r.estado, 'PD-011').status, anuncioDe(r.estado, 'a1').quantidade, r.notificacao.para], ['cancelado', 10, 'Juliana Costa']);
    },
  },
  {
    nome: 'vendas: roteiro virar vendedora e publicar',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual(publicarAnuncio(e, '302', ANUNCIO_BOLO, AGORA_TESTE).erro, 'Só vendedores aprovados pelo síndico podem anunciar');
      igual(pedirParaVender(e, '302', ' ', AGORA_TESTE).erro, 'Conte o que você pretende vender');
      const pedido = pedirParaVender(e, '302', 'Bolos caseiros por encomenda', AGORA_TESTE);
      igual([pessoaDe(pedido.estado, '302').vendedor, pedido.notificacao.para], ['pendente', SINDICO]);
      igual(pedirParaVender(pedido.estado, '302', 'De novo', AGORA_TESTE).erro, 'Já existe um pedido para vender');
      const aprovado = aprovarVendedor(pedido.estado, '302');
      igual([pessoaDe(aprovado.estado, '302').vendedor, aprovado.notificacao.para], ['aprovado', 'Ana Souza']);
      igual(publicarAnuncio(aprovado.estado, '302', { ...ANUNCIO_BOLO, preco: 0 }, AGORA_TESTE).erro, 'Preço precisa ser maior que zero');
      const r = publicarAnuncio(aprovado.estado, '302', ANUNCIO_BOLO, AGORA_TESTE);
      igual([r.id, r.notificacao.para, anunciosVisiveis(r.estado)[0].id], ['a4', '9 moradores que aceitam ofertas', 'a4']);
    },
  },
  {
    nome: 'vendas: recusa, suspensão e reativação de vendedor',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual(recusarVendedor(e, '102', '').erro, 'Informe o motivo da recusa');
      const recusado = recusarVendedor(e, '102', 'Falta o alvará da vigilância sanitária');
      igual([pessoaDe(recusado.estado, '102').vendedor, pessoaDe(recusado.estado, '102').motivoVendedor], ['nao', 'Falta o alvará da vigilância sanitária']);
      igual(suspenderVendedor(e, '201', '').erro, 'Informe o motivo da suspensão');
      const suspenso = suspenderVendedor(e, '201', 'Reclamações de vizinhos');
      igual([pessoaDe(suspenso.estado, '201').vendedor, anunciosVisiveis(suspenso.estado).some((a) => a.id === 'a3')], ['suspenso', false]);
      igual(pessoaDe(reativarVendedor(suspenso.estado, '201').estado, '201').vendedor, 'aprovado');
    },
  },
  {
    nome: 'vendas: síndico oculta e mostra anúncio',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual(ocultarAnuncio(e, 'a3', ' ').erro, 'Informe o motivo');
      const r = ocultarAnuncio(e, 'a3', 'Venda de bebida alcoólica não é permitida');
      igual([anuncioDe(r.estado, 'a3').oculto, anuncioDe(r.estado, 'a3').motivoOculto, r.notificacao.para], [true, 'Venda de bebida alcoólica não é permitida', 'Fernando Alves']);
      igual(anunciosVisiveis(r.estado).some((a) => a.id === 'a3'), false);
      igual(anunciosVisiveis(mostrarAnuncio(r.estado, 'a3').estado).some((a) => a.id === 'a3'), true);
    },
  },
  {
    nome: 'vendas: só o dono edita o anúncio',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual(editarAnuncio(e, '201', 'a1', { preco: 2000 }).erro, 'Só o vendedor pode editar o anúncio');
      igual(editarAnuncio(e, '104', 'a1', { preco: 0 }).erro, 'Preço precisa ser maior que zero');
      igual(anuncioDe(editarAnuncio(e, '104', 'a1', { quantidade: 20 }).estado, 'a1').quantidade, 20);
    },
  },
  {
    nome: 'vendas: troca de morador e preferência de ofertas',
    rodar() {
      const e = comSacola([['a1', 1]]);
      const r = trocarMorador(e, '104');
      igual([r.estado.moradorAtual, r.estado.sacola], ['104', []]);
      igual(trocarMorador(e, '999').erro, 'Morador indisponível na demonstração');
      igual(pessoaDe(alternarOfertas(e, '302').estado, '302').recebeOfertas, true);
    },
  },
```

Run: `npm test`
Expected: FAIL. `../vendas/acoes.js` não existe.

- [ ] **Step 2: Implementar `src/vendas/acoes.js`**

```js
import { SINDICO } from '../dados.js';
import { MORADORES_DEMO } from './dados.js';
import { pessoaDaUnidade, nomeVizinho, anuncioPorId, podePublicar, validarAnuncio, podeAdicionar, sacolaPorVendedor, acoesPedido, destinatariosOfertas } from './regras.js';

// Cada ação devolve { estado, notificacao?, erro?, id? } sem mutar nada.
function erroVenda(estado, mensagem) {
  return { estado, erro: mensagem };
}

function mudarPessoa(estado, unidade, mudanca) {
  return { ...estado, pessoas: estado.pessoas.map((p) => (p.unidade === unidade ? { ...p, ...mudanca } : p)) };
}

function mudarAnuncio(estado, id, mudanca) {
  return { ...estado, anuncios: estado.anuncios.map((a) => (a.id === id ? { ...a, ...mudanca } : a)) };
}

function mudarPedido(estado, id, mudanca) {
  return { ...estado, pedidos: estado.pedidos.map((p) => (p.id === id ? { ...p, ...mudanca } : p)) };
}

function moverEstoque(anuncios, itens, sinal) {
  return anuncios.map((a) => {
    const quantidade = itens.filter((i) => i.anuncioId === a.id).reduce((soma, i) => soma + i.quantidade, 0);
    return quantidade ? { ...a, quantidade: a.quantidade + sinal * quantidade } : a;
  });
}

function textoLimpo(texto) {
  return String(texto || '').trim();
}

export function trocarMorador(estado, unidade) {
  if (!MORADORES_DEMO.some(([u]) => u === unidade)) return erroVenda(estado, 'Morador indisponível na demonstração');
  return { estado: { ...estado, moradorAtual: unidade, sacola: [] } };
}

export function alternarOfertas(estado, unidade) {
  const p = pessoaDaUnidade(estado, unidade);
  if (!p) return erroVenda(estado, 'Morador não encontrado');
  return { estado: mudarPessoa(estado, unidade, { recebeOfertas: !p.recebeOfertas }) };
}

export function pedirParaVender(estado, unidade, texto, agora) {
  const p = pessoaDaUnidade(estado, unidade);
  if (!p || p.vendedor !== 'nao') return erroVenda(estado, 'Já existe um pedido para vender');
  const descricao = textoLimpo(texto);
  if (!descricao) return erroVenda(estado, 'Conte o que você pretende vender');
  return {
    estado: mudarPessoa(estado, unidade, { vendedor: 'pendente', pedidoVenda: { texto: descricao, em: agora.toISOString() }, motivoVendedor: null }),
    notificacao: { canal: 'Push', para: SINDICO, texto: `${p.nome} (apto ${unidade}) pediu para vender: ${descricao}` },
  };
}

export function aprovarVendedor(estado, unidade) {
  const p = pessoaDaUnidade(estado, unidade);
  if (!p || p.vendedor !== 'pendente') return erroVenda(estado, 'Solicitação não está pendente');
  return {
    estado: mudarPessoa(estado, unidade, { vendedor: 'aprovado', motivoVendedor: null }),
    notificacao: { canal: 'WhatsApp', para: p.nome, texto: 'Seu pedido para vender foi aprovado pelo síndico. Você já pode anunciar.' },
  };
}

export function recusarVendedor(estado, unidade, motivo) {
  const p = pessoaDaUnidade(estado, unidade);
  if (!p || p.vendedor !== 'pendente') return erroVenda(estado, 'Solicitação não está pendente');
  const texto = textoLimpo(motivo);
  if (!texto) return erroVenda(estado, 'Informe o motivo da recusa');
  return {
    estado: mudarPessoa(estado, unidade, { vendedor: 'nao', motivoVendedor: texto }),
    notificacao: { canal: 'WhatsApp', para: p.nome, texto: `Seu pedido para vender foi recusado: ${texto}` },
  };
}

export function suspenderVendedor(estado, unidade, motivo) {
  const p = pessoaDaUnidade(estado, unidade);
  if (!p || p.vendedor !== 'aprovado') return erroVenda(estado, 'Vendedor não está ativo');
  const texto = textoLimpo(motivo);
  if (!texto) return erroVenda(estado, 'Informe o motivo da suspensão');
  return {
    estado: mudarPessoa(estado, unidade, { vendedor: 'suspenso', motivoVendedor: texto }),
    notificacao: { canal: 'WhatsApp', para: p.nome, texto: `Suas vendas foram suspensas pelo síndico: ${texto}` },
  };
}

export function reativarVendedor(estado, unidade) {
  const p = pessoaDaUnidade(estado, unidade);
  if (!p || p.vendedor !== 'suspenso') return erroVenda(estado, 'Vendedor não está suspenso');
  return {
    estado: mudarPessoa(estado, unidade, { vendedor: 'aprovado', motivoVendedor: null }),
    notificacao: { canal: 'WhatsApp', para: p.nome, texto: 'Suas vendas foram reativadas pelo síndico.' },
  };
}

export function publicarAnuncio(estado, unidade, dados, agora) {
  const pode = podePublicar(estado, unidade);
  if (!pode.ok) return erroVenda(estado, pode.motivo);
  const v = validarAnuncio(dados);
  if (!v.ok) return erroVenda(estado, v.motivo);
  const anuncio = { id: `a${estado.anuncios.length + 1}`, vendedor: unidade, titulo: textoLimpo(dados.titulo), descricao: textoLimpo(dados.descricao), categoria: dados.categoria || 'desapego', preco: dados.preco, quantidade: dados.quantidade, pagamentos: [...dados.pagamentos], entregas: [...dados.entregas], ativo: true, oculto: false, motivoOculto: null, criadoEm: agora.toISOString() };
  const destinatarios = destinatariosOfertas(estado, unidade);
  return {
    estado: { ...estado, anuncios: [...estado.anuncios, anuncio] },
    id: anuncio.id,
    notificacao: destinatarios.length ? { canal: 'Push', para: `${destinatarios.length} moradores que aceitam ofertas`, texto: `Novo na vitrine: ${anuncio.titulo}` } : undefined,
  };
}

export function editarAnuncio(estado, unidade, id, mudanca) {
  const a = anuncioPorId(estado, id);
  if (!a) return erroVenda(estado, 'Anúncio não encontrado');
  if (a.vendedor !== unidade) return erroVenda(estado, 'Só o vendedor pode editar o anúncio');
  const v = validarAnuncio({ ...a, ...mudanca });
  if (!v.ok) return erroVenda(estado, v.motivo);
  return { estado: mudarAnuncio(estado, id, mudanca) };
}

export function ocultarAnuncio(estado, id, motivo) {
  const a = anuncioPorId(estado, id);
  if (!a) return erroVenda(estado, 'Anúncio não encontrado');
  const texto = textoLimpo(motivo);
  if (!texto) return erroVenda(estado, 'Informe o motivo');
  return {
    estado: mudarAnuncio(estado, id, { oculto: true, motivoOculto: texto }),
    notificacao: { canal: 'WhatsApp', para: nomeVizinho(estado, a.vendedor), texto: `Seu anúncio "${a.titulo}" foi ocultado pelo síndico: ${texto}` },
  };
}

export function mostrarAnuncio(estado, id) {
  if (!anuncioPorId(estado, id)) return erroVenda(estado, 'Anúncio não encontrado');
  return { estado: mudarAnuncio(estado, id, { oculto: false, motivoOculto: null }) };
}

export function adicionarASacola(estado, anuncioId, quantidade) {
  const v = podeAdicionar(estado, estado.moradorAtual, anuncioId, quantidade);
  if (!v.ok) return erroVenda(estado, v.motivo);
  const existe = estado.sacola.some((i) => i.anuncioId === anuncioId);
  const sacola = existe
    ? estado.sacola.map((i) => (i.anuncioId === anuncioId ? { ...i, quantidade: i.quantidade + quantidade } : i))
    : [...estado.sacola, { anuncioId, quantidade }];
  return { estado: { ...estado, sacola } };
}

export function removerDaSacola(estado, anuncioId) {
  return { estado: { ...estado, sacola: estado.sacola.filter((i) => i.anuncioId !== anuncioId) } };
}

export function fecharPedido(estado, escolhas, agora) {
  const grupos = sacolaPorVendedor(estado);
  if (!grupos.length) return erroVenda(estado, 'Sua sacola está vazia');
  const comprador = estado.moradorAtual;
  for (const g of grupos) {
    const escolha = escolhas[g.vendedor] || {};
    if (!g.pagamentos.includes(escolha.pagamento)) return erroVenda(estado, 'Escolha a forma de pagamento');
    if (!g.entregas.includes(escolha.entrega)) return erroVenda(estado, 'Escolha a forma de entrega');
    for (const item of g.itens) {
      const v = podeAdicionar({ ...estado, sacola: [] }, comprador, item.anuncio.id, item.quantidade);
      if (!v.ok) return erroVenda(estado, `${item.anuncio.titulo}: ${v.motivo}`);
    }
  }
  const em = agora.toISOString();
  const novos = grupos.map((g, n) => ({
    id: `PD-${String(estado.proximoPedido + n).padStart(3, '0')}`,
    comprador,
    vendedor: g.vendedor,
    itens: g.itens.map((i) => ({ anuncioId: i.anuncio.id, titulo: i.anuncio.titulo, quantidade: i.quantidade, preco: i.anuncio.preco })),
    pagamento: escolhas[g.vendedor].pagamento,
    entrega: escolhas[g.vendedor].entrega,
    status: 'novo',
    pago: false,
    motivo: null,
    linha: [{ em, status: 'novo', texto: 'Pedido enviado' }],
    mensagens: [],
    criadoEm: em,
    entregueEm: null,
  }));
  const extras = novos.length - 1;
  const complemento = extras ? ` (e mais ${extras} pedido${extras > 1 ? 's' : ''} para outros vendedores)` : '';
  return {
    estado: { ...estado, anuncios: moverEstoque(estado.anuncios, novos.flatMap((p) => p.itens), -1), pedidos: [...estado.pedidos, ...novos], sacola: [], proximoPedido: estado.proximoPedido + novos.length },
    id: novos[0].id,
    ids: novos.map((p) => p.id),
    notificacao: { canal: 'WhatsApp', para: nomeVizinho(estado, novos[0].vendedor), texto: `Novo pedido ${novos[0].id} de ${nomeVizinho(estado, comprador)} (apto ${comprador})${complemento}` },
  };
}

function pedidoPermitido(estado, id, unidade, acao) {
  const pedido = estado.pedidos.find((p) => p.id === id);
  if (!pedido) return { erro: 'Pedido não encontrado' };
  if (!acoesPedido(pedido, unidade).includes(acao)) return { erro: 'Ação não permitida para este pedido' };
  return { pedido };
}

function comLinha(pedido, agora, status, texto) {
  return [...pedido.linha, { em: agora.toISOString(), status, texto }];
}

export function aceitarPedido(estado, id, unidade, agora) {
  const { pedido, erro } = pedidoPermitido(estado, id, unidade, 'aceitar');
  if (erro) return erroVenda(estado, erro);
  return {
    estado: mudarPedido(estado, id, { status: 'aceito', linha: comLinha(pedido, agora, 'aceito', 'Pedido aceito pelo vendedor') }),
    notificacao: { canal: 'Push', para: nomeVizinho(estado, pedido.comprador), texto: `Pedido ${id} aceito por ${nomeVizinho(estado, pedido.vendedor)}` },
  };
}

export function recusarPedido(estado, id, unidade, motivo, agora) {
  const { pedido, erro } = pedidoPermitido(estado, id, unidade, 'recusar');
  if (erro) return erroVenda(estado, erro);
  const texto = textoLimpo(motivo);
  if (!texto) return erroVenda(estado, 'Informe o motivo da recusa');
  const atualizado = mudarPedido(estado, id, { status: 'recusado', motivo: texto, linha: comLinha(pedido, agora, 'recusado', `Recusado: ${texto}`) });
  return {
    estado: { ...atualizado, anuncios: moverEstoque(estado.anuncios, pedido.itens, 1) },
    notificacao: { canal: 'Push', para: nomeVizinho(estado, pedido.comprador), texto: `Pedido ${id} recusado: ${texto}` },
  };
}

export function marcarEntregue(estado, id, unidade, agora) {
  const { pedido, erro } = pedidoPermitido(estado, id, unidade, 'entregar');
  if (erro) return erroVenda(estado, erro);
  return {
    estado: mudarPedido(estado, id, { status: 'entregue', entregueEm: agora.toISOString(), linha: comLinha(pedido, agora, 'entregue', 'Pedido entregue') }),
    notificacao: { canal: 'Push', para: nomeVizinho(estado, pedido.comprador), texto: `Pedido ${id} marcado como entregue` },
  };
}

export function marcarPago(estado, id, unidade, agora) {
  const { pedido, erro } = pedidoPermitido(estado, id, unidade, 'pago');
  if (erro) return erroVenda(estado, erro);
  return {
    estado: mudarPedido(estado, id, { pago: true, linha: comLinha(pedido, agora, null, 'Pagamento confirmado pelo vendedor') }),
    notificacao: { canal: 'Push', para: nomeVizinho(estado, pedido.comprador), texto: `Pagamento do pedido ${id} confirmado` },
  };
}

export function cancelarPedido(estado, id, unidade, agora) {
  const { pedido, erro } = pedidoPermitido(estado, id, unidade, 'cancelar');
  if (erro) return erroVenda(estado, erro);
  const atualizado = mudarPedido(estado, id, { status: 'cancelado', linha: comLinha(pedido, agora, 'cancelado', 'Cancelado pelo comprador') });
  return {
    estado: { ...atualizado, anuncios: moverEstoque(estado.anuncios, pedido.itens, 1) },
    notificacao: { canal: 'Push', para: nomeVizinho(estado, pedido.vendedor), texto: `Pedido ${id} cancelado pelo comprador` },
  };
}

export function enviarMensagem(estado, id, unidade, texto, agora) {
  const { pedido, erro } = pedidoPermitido(estado, id, unidade, 'conversar');
  if (erro) return erroVenda(estado, erro);
  const mensagem = textoLimpo(texto);
  if (!mensagem) return erroVenda(estado, 'Escreva a mensagem');
  const outro = unidade === pedido.vendedor ? pedido.comprador : pedido.vendedor;
  return {
    estado: mudarPedido(estado, id, { mensagens: [...pedido.mensagens, { autor: unidade, texto: mensagem, em: agora.toISOString() }] }),
    notificacao: { canal: 'Push', para: nomeVizinho(estado, outro), texto: `${nomeVizinho(estado, unidade)}: ${mensagem}` },
  };
}
```

Em `prototipo/montagem.mjs`, acrescente `'src/vendas/acoes.js',` na `ORDEM`, logo depois de `'src/vendas/regras.js',`.

- [ ] **Step 3: Rodar e ver passar**

Run: `npm test && npm run montar && npm run verificar`
Expected: todos PASS (22 casos de vendas) e o autoteste com `falhas: 0`.

- [ ] **Step 4: Commit**

```bash
git add prototipo
git commit -m "feat(vendas): ações puras (sacola, pedidos, conversa, aprovação e moderação)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: App do morador segue a unidade atual

**Files:**
- Modify: `prototipo/src/ui/morador.js`, `prototipo/src/ui/comum.js`, `prototipo/src/estilos.css`, `prototipo/verificar.mjs`

**Interfaces:**
- Consumes:
  - `trocarMorador` e `alternarOfertas` (Task 3);
  - `pessoaDaUnidade` e `anunciosVisiveis` (Task 2);
  - `MORADORES_DEMO` (Task 1).
- Produces:
  - Toda tela do morador recebe a prop `eu`, a unidade atual.
  - Nova rota `#morador.preferencias`.
  - Seletor com botões "Ana · 302" e "Juliana · 104".
  - O `ICONES` de `comum.js` ganha `sacola`, `loja`, `etiqueta` e `pessoa`.
  - A aba "Vendas" entra na Task 5 e o cartão "Novidades na vitrine" na Task 6, porque as duas dependem de `ui/vendas.js`.

- [ ] **Step 1: Acrescentar as checagens que falham**

Em `prototipo/verificar.mjs`, acrescente ao final de `CHECAGENS`:
```js
  ['#morador.preferencias', ['Receber avisos de novos anúncios', 'Você ainda não vende', 'Ana · 302', 'Juliana · 104']],
```

Run: `npm run montar && npm run verificar`
Expected: FAIL nessa linha.

- [ ] **Step 2: Ícones novos**

Em `prototipo/src/ui/comum.js`, acrescente ao objeto `ICONES`, depois de `entrega: …,`:
```js
  sacola: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2',
  loja: 'M4 9l1-5h14l1 5M4 9v11h16V9M4 9h16M9 20v-6h6v6',
  etiqueta: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01',
  pessoa: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
```

- [ ] **Step 3: Trocar a constante pela unidade atual em `src/ui/morador.js`**

Rode este script a partir de `prototipo/`. Ele faz as trocas literais e falha se algum trecho não for encontrado:
```bash
node - <<'EOF'
const fs = require('fs');
const arquivo = 'src/ui/morador.js';
let s = fs.readFileSync(arquivo, 'utf8');
const pares = [
  ["import { UNIDADE_ANA, CATEGORIAS, TIPOS_COMUNICADO } from '../dados.js';", "import { CATEGORIAS, TIPOS_COMUNICADO } from '../dados.js';\nimport { MORADORES_DEMO } from '../vendas/dados.js';\nimport { pessoaDaUnidade } from '../vendas/regras.js';\nimport { trocarMorador, alternarOfertas } from '../vendas/acoes.js';"],
  ['function MInicio({ estado, agora }) {', 'function MInicio({ estado, agora, eu }) {'],
  ['function MReservas({ estado, executar, agora }) {', 'function MReservas({ estado, executar, agora, eu }) {'],
  ['<${MMinhasReservas} estado=${estado} executar=${executar} agora=${agora} />', '<${MMinhasReservas} estado=${estado} executar=${executar} agora=${agora} eu=${eu} />'],
  ['function MMinhasReservas({ estado, executar, agora }) {', 'function MMinhasReservas({ estado, executar, agora, eu }) {'],
  ['function MAvisos({ estado, rota, executar }) {', 'function MAvisos({ estado, rota, executar, eu }) {'],
  ['  const { estado, rota } = props;\n  if (rota.id === \'nova\')', '  const { estado, rota, eu } = props;\n  if (rota.id === \'nova\')'],
  ['<${MDetalheOcorrencia} executar=${props.executar} oc=${oc} />', '<${MDetalheOcorrencia} executar=${props.executar} oc=${oc} eu=${eu} />'],
  ['function MNovaOcorrencia({ executar }) {', 'function MNovaOcorrencia({ executar, eu }) {'],
  ['function MDetalheOcorrencia({ executar, oc }) {', 'function MDetalheOcorrencia({ executar, oc, eu }) {'],
  ['function MEncomendas({ estado, agora }) {', 'function MEncomendas({ estado, agora, eu }) {'],
  ['<h1 class="m-titulo">Olá, Ana</h1>\n    <p class="m-sub">Apto 302 · Residencial Ipê Amarelo</p>', '<h1 class="m-titulo">Olá, ${pessoaDaUnidade(estado, eu).nome.split(\' \')[0]}</h1>\n    <p class="m-sub">Apto ${eu} · Residencial Ipê Amarelo</p>'],
];
for (const [de, para] of pares) {
  if (!s.includes(de)) throw new Error('Trecho não encontrado: ' + de.slice(0, 60));
  s = s.split(de).join(para);
}
s = s.split('UNIDADE_ANA').join('eu');
fs.writeFileSync(arquivo, s);
console.log('morador.js atualizado');
EOF
grep -c "UNIDADE_ANA" src/ui/morador.js
```
Expected: `morador.js atualizado` e `0`.

- [ ] **Step 4: Seletor de morador e Minhas preferências**

Em `src/ui/morador.js`, troque a função `TelaMorador` inteira por:
```js
export function TelaMorador(props) {
  const eu = props.estado.moradorAtual;
  const telas = { inicio: MInicio, reservas: MReservas, avisos: MAvisos, ocorrencias: MOcorrencias, mais: MMais, documentos: MDocumentos, encomendas: MEncomendas, preferencias: MPreferencias };
  const Conteudo = telas[props.rota.tela] || MInicio;
  const aba = ['documentos', 'encomendas', 'preferencias'].includes(props.rota.tela) ? 'mais' : props.rota.tela;
  return html`<div class="celular">
    <div class="cel-status" aria-hidden="true"><span>${relogio(props.agora)}</span><span>CondoFácil</span></div>
    <div class="cel-pessoa" role="group" aria-label="Morador da demonstração">
      ${MORADORES_DEMO.map(([unidade, nome]) => html`<button type="button" key=${unidade} aria-pressed=${unidade === eu} onClick=${() => props.executar((e) => trocarMorador(e, unidade))}>${nome} · ${unidade}</button>`)}
    </div>
    <div class="cel-conteudo"><${Conteudo} ...${props} eu=${eu} /></div>
    <nav class="cel-abas" aria-label="Navegação do morador">
      ${ABAS_MORADOR.map(([id, nome, icone]) => html`<a key=${id} href=${`#morador.${id}`} class=${id === aba ? 'ativa' : ''} aria-current=${id === aba ? 'page' : undefined}><${Icone} nome=${icone} />${nome}</a>`)}
    </nav>
  </div>`;
}
```

Na função `MMais`, acrescente depois do cartão de Documentos (antes de `</section>`):
```js
    <a class="cartao link com-icone" href="#morador.preferencias"><${QuadroIcone} nome="pessoa" /><span><strong>Minhas preferências</strong><span class="sub">Avisos de anúncios e situação de vendedor</span></span></a>
```

Acrescente ao final do arquivo:
```js
const SITUACAO_VENDEDOR = { nao: 'Você ainda não vende', pendente: 'Pedido para vender aguardando o síndico', aprovado: 'Vendedor aprovado', suspenso: 'Vendas suspensas pelo síndico' };

function MPreferencias({ estado, executar, eu }) {
  const pessoa = pessoaDaUnidade(estado, eu);
  return html`<section class="m-pagina">
    <a class="voltar" href="#morador.mais">‹ Mais</a>
    <h1 class="m-titulo">Minhas preferências</h1>
    <label class="check"><input id="pref-ofertas" type="checkbox" role="switch" checked=${pessoa.recebeOfertas} onChange=${() => executar((e) => alternarOfertas(e, eu))} /><span>Receber avisos de novos anúncios</span></label>
    <small class="m-ajuda">Aviso por push quando um vizinho anunciar algo na vitrine. Você pode desligar quando quiser.</small>
    <h2>Vendas</h2>
    <div class="cartao">
      <strong>${SITUACAO_VENDEDOR[pessoa.vendedor]}</strong>
      ${pessoa.motivoVendedor && html`<small class="sub">Motivo: ${pessoa.motivoVendedor}</small>`}
      <a href="#morador.vendas.loja">${pessoa.vendedor === 'aprovado' ? 'Ir para minha loja' : 'Saiba como vender'}</a>
    </div>
  </section>`;
}
```

- [ ] **Step 5: Estilo do seletor**

Acrescente ao final de `src/estilos.css`:
```css
/* Vendas entre moradores */
.cel-pessoa { display: flex; gap: 6px; padding: 8px 16px; background: var(--sup); border-bottom: 1px solid var(--borda); }
.cel-pessoa button { flex: 1; min-height: 36px; border: 1px solid var(--borda); border-radius: 2px; background: var(--sup); color: var(--titulo); font-size: 12.5px; font-weight: 600; cursor: pointer; }
.cel-pessoa button[aria-pressed="true"] { border-color: var(--laranja); background: var(--laranja-tinta); color: var(--laranja-forte); }
```

- [ ] **Step 6: Rodar a bateria**

Run: `npm test && npm run montar && npm run verificar && npm run e2e`
Expected: tudo verde. Os roteiros antigos usam a Ana, que é a moradora inicial.

- [ ] **Step 7: Commit**

```bash
git add prototipo
git commit -m "feat(vendas): app do morador segue a unidade atual, seletor Ana/Juliana e preferências

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Telas de vendas do morador

> Antes de escrever o `VPainel` (gráfico de barras), carregue o skill `dataviz` e ajuste o gráfico às orientações dele, mantendo os textos e atributos usados nos testes.

**Files:**
- Create: `prototipo/src/ui/vendas.js`
- Modify: `prototipo/src/ui/morador.js`, `prototipo/src/estilos.css`, `prototipo/montagem.mjs`, `prototipo/verificar.mjs`

**Interfaces:**
- Consumes: regras, ações e dados das Tasks 1 a 3; `ir`, `Campo`, `Erro`, `Sucesso`, `Vazio`, `Etiqueta`, `Icone` e `QuadroIcone` de `comum.js`.
- Produces:
  - `TelaVendas(props)`, que recebe `{ estado, rota, executar, agora, eu }`, com as rotas `#morador.vendas[.sacola|.pedidos|.loja|.novo-anuncio|.<anuncioId>|.PD-nnn]`.
  - `CartaoAnuncio({ estado, anuncio, eu })`.
  - Textos usados no e2e:
    - anúncio: "Restam N", rótulo "Quantidade", botão "Adicionar à sacola", mensagem "Adicionado à sacola";
    - sacola e pedido: botão "Fechar pedido", "Pedido PD-nnn", botões "Aceitar pedido", "Marcar como entregue" e "Marcar como pago", rótulo "Mensagem", botão "Enviar";
    - loja: botão "Painel", rótulo "O que você pretende vender?", botão "Pedir para vender", texto "Aguardando aprovação do síndico";
    - novo anúncio: rótulos "Título", "Preço (R$)" e "Quantidade", checkboxes "Pix" e "Retirar no apto", botão "Publicar anúncio".

- [ ] **Step 1: Acrescentar as checagens que falham**

Em `prototipo/verificar.mjs`, acrescente ao final de `CHECAGENS`:
```js
  ['#morador.vendas', ['Brigadeiro gourmet (caixa com 6)', 'Juliana Costa · apto 104', 'Restam 10', 'Quero vender']],
  ['#morador.vendas.a1', ['Adicionar à sacola', 'Pix, Dinheiro', 'Retirar no apto, Entrega na porta']],
  ['#morador.vendas.sacola', ['Sua sacola está vazia.']],
  ['#morador.vendas.pedidos', ['Você ainda não fez pedidos.']],
  ['#morador.vendas.loja', ['Quer vender para os vizinhos?', 'Pedir para vender']],
```

Run: `npm run montar && npm run verificar`
Expected: FAIL nas linhas novas.

- [ ] **Step 2: Criar `src/ui/vendas.js`**

```js
import { html, useState } from '../vendor.js';
import { CATEGORIAS_VENDA, PAGAMENTOS, ENTREGAS, NOMES_STATUS_PEDIDO } from '../vendas/dados.js';
import { anunciosVisiveis, anuncioPorId, pessoaDaUnidade, nomeVizinho, sacolaPorVendedor, acoesPedido, totalPedido, painelVendas, fmtCentavos, lerPreco } from '../vendas/regras.js';
import { adicionarASacola, removerDaSacola, fecharPedido, aceitarPedido, recusarPedido, marcarEntregue, marcarPago, cancelarPedido, enviarMensagem, pedirParaVender, publicarAnuncio, editarAnuncio } from '../vendas/acoes.js';
import { fmtDataHora, fmtDataCurta } from '../datas.js';
import { ir, Campo, Erro, Sucesso, Vazio, Etiqueta, Icone, QuadroIcone } from './comum.js';

const ETQ_PEDIDO = { novo: 'alerta', aceito: 'info', entregue: 'ok', recusado: 'perigo', cancelado: 'neutro' };
const ROTULOS_ACAO_PEDIDO = { aceitar: 'Aceitar pedido', recusar: 'Recusar', entregar: 'Marcar como entregue', pago: 'Marcar como pago', cancelar: 'Cancelar pedido' };
const PERIODOS_PAINEL = [['7d', 'Últimos 7 dias'], ['30d', 'Últimos 30 dias'], ['mes', 'Este mês']];

function EtqPedido({ status }) {
  return html`<${Etiqueta} tipo=${ETQ_PEDIDO[status]}>${NOMES_STATUS_PEDIDO[status]}<//>`;
}

function FotoProduto({ categoria }) {
  return html`<div class="foto-produto" role="img" aria-label=${`Foto simulada: ${CATEGORIAS_VENDA[categoria]}`}><${Icone} nome="etiqueta" tamanho=${26} /><span>${CATEGORIAS_VENDA[categoria]}</span></div>`;
}

export function CartaoAnuncio({ estado, anuncio, eu }) {
  return html`<a class="cartao link anuncio" href=${`#morador.vendas.${anuncio.id}`}>
    <${FotoProduto} categoria=${anuncio.categoria} />
    <strong>${anuncio.titulo}</strong>
    <span class="preco">${fmtCentavos(anuncio.preco)}</span>
    ${anuncio.quantidade ? html`<small class="sub">Restam ${anuncio.quantidade}</small>` : html`<${Etiqueta} tipo="perigo">Esgotado<//>`}
    <small class="sub">${anuncio.vendedor === eu ? 'Seu anúncio' : `${nomeVizinho(estado, anuncio.vendedor)} · apto ${anuncio.vendedor}`}</small>
  </a>`;
}

export function TelaVendas(props) {
  const { estado, rota, eu } = props;
  const id = rota.id;
  const pessoa = pessoaDaUnidade(estado, eu);
  const naSacola = estado.sacola.reduce((soma, i) => soma + i.quantidade, 0);
  let conteudo;
  let aba = 'vitrine';
  if (id === 'sacola') {
    conteudo = html`<${VSacola} ...${props} />`;
    aba = 'sacola';
  } else if (id === 'pedidos') {
    conteudo = html`<${VMeusPedidos} ...${props} />`;
    aba = 'pedidos';
  } else if (id === 'loja' || id === 'novo-anuncio') {
    conteudo = id === 'loja' ? html`<${VLoja} ...${props} />` : html`<${VNovoAnuncio} ...${props} />`;
    aba = 'loja';
  } else if (id && id.startsWith('PD-')) {
    const pedido = estado.pedidos.find((p) => p.id === id && (p.comprador === eu || p.vendedor === eu));
    conteudo = pedido ? html`<${VPedido} key=${pedido.id} ...${props} pedido=${pedido} />` : html`<${Vazio} texto="Pedido não encontrado." />`;
    aba = pedido && pedido.vendedor === eu ? 'loja' : 'pedidos';
  } else if (id && anuncioPorId(estado, id)) {
    conteudo = html`<${VAnuncio} key=${id} ...${props} anuncio=${anuncioPorId(estado, id)} />`;
  } else {
    conteudo = html`<${VVitrine} ...${props} />`;
  }
  const links = [['vitrine', 'Vitrine', '#morador.vendas'], ['pedidos', 'Meus pedidos', '#morador.vendas.pedidos'], ['loja', pessoa.vendedor === 'aprovado' ? 'Minha loja' : 'Quero vender', '#morador.vendas.loja']];
  return html`<section class="m-pagina">
    <h1 class="m-titulo">Vendas</h1>
    <nav class="vendas-nav" aria-label="Vendas">
      ${links.map(([chave, nome, href]) => html`<a key=${chave} href=${href} class=${aba === chave ? 'ativa' : ''} aria-current=${aba === chave ? 'page' : undefined}>${nome}</a>`)}
      <a class=${`sacola${aba === 'sacola' ? ' ativa' : ''}`} href="#morador.vendas.sacola" aria-label=${`Sacola com ${naSacola} ${naSacola === 1 ? 'item' : 'itens'}`}><${Icone} nome="sacola" tamanho=${20} />${naSacola}</a>
    </nav>
    ${conteudo}
  </section>`;
}

function VVitrine({ estado, eu }) {
  const [categoria, setCategoria] = useState('todas');
  const [busca, setBusca] = useState('');
  const termo = busca.trim().toLowerCase();
  const lista = anunciosVisiveis(estado).filter((a) => (categoria === 'todas' || a.categoria === categoria) && (!termo || `${a.titulo} ${a.descricao}`.toLowerCase().includes(termo)));
  return html`<div class="pilha">
    <${Campo} rotulo="Buscar na vitrine"><input id="vitrine-busca" type="search" value=${busca} onInput=${(ev) => setBusca(ev.target.value)} placeholder="Ex.: brigadeiro, bicicleta" /><//>
    <div class="chips" role="group" aria-label="Categoria">
      ${[['todas', 'Todas'], ...Object.entries(CATEGORIAS_VENDA)].map(([chave, nome]) => html`<button type="button" key=${chave} class="chip" aria-pressed=${categoria === chave} onClick=${() => setCategoria(chave)}>${nome}</button>`)}
    </div>
    ${lista.length
      ? html`<ul class="anuncios">${lista.map((a) => html`<li key=${a.id}><${CartaoAnuncio} estado=${estado} anuncio=${a} eu=${eu} /></li>`)}</ul>`
      : html`<${Vazio} texto="Nenhum anúncio encontrado." />`}
  </div>`;
}

function VAnuncio({ estado, eu, executar, anuncio }) {
  const [quantidade, setQuantidade] = useState('1');
  const [erro, setErro] = useState(null);
  const [adicionado, setAdicionado] = useState(false);
  const proprio = anuncio.vendedor === eu;

  function adicionar() {
    const r = executar((e) => adicionarASacola(e, anuncio.id, Number(quantidade)));
    setErro(r.erro || null);
    setAdicionado(!r.erro);
  }

  return html`<div class="pilha">
    <a class="voltar" href="#morador.vendas">‹ Vitrine</a>
    <${FotoProduto} categoria=${anuncio.categoria} />
    <p class="anuncio-titulo">${anuncio.titulo}</p>
    <p class="preco grande">${fmtCentavos(anuncio.preco)}</p>
    <p class="m-texto">${anuncio.descricao}</p>
    <dl class="resumo">
      <dt>Vendedor</dt><dd>${nomeVizinho(estado, anuncio.vendedor)} · apto ${anuncio.vendedor}</dd>
      <dt>Pagamento</dt><dd>${anuncio.pagamentos.map((k) => PAGAMENTOS[k]).join(', ')}</dd>
      <dt>Entrega</dt><dd>${anuncio.entregas.map((k) => ENTREGAS[k]).join(', ')}</dd>
      <dt>Disponível</dt><dd>${anuncio.quantidade ? `Restam ${anuncio.quantidade}` : 'Esgotado'}</dd>
    </dl>
    ${proprio
      ? html`<p class="sub">Este anúncio é seu. Altere preço e quantidade em Minha loja.</p>`
      : html`<${Campo} rotulo="Quantidade"><input id="anuncio-quantidade" type="number" min="1" max=${anuncio.quantidade} inputmode="numeric" value=${quantidade} onInput=${(ev) => setQuantidade(ev.target.value)} /><//>
        <${Erro} texto=${erro} />
        ${adicionado && html`<p class="sucesso" role="status">Adicionado à sacola. <a href="#morador.vendas.sacola">Ver sacola</a></p>`}
        <button type="button" class="btn primario bloco" disabled=${!anuncio.quantidade} onClick=${adicionar}>Adicionar à sacola</button>`}
  </div>`;
}

function VSacola({ estado, executar }) {
  const grupos = sacolaPorVendedor(estado);
  const [escolhas, setEscolhas] = useState({});
  const [erro, setErro] = useState(null);
  const escolhaDe = (g) => {
    const feita = escolhas[g.vendedor] || {};
    return {
      pagamento: feita.pagamento || (g.pagamentos.length === 1 ? g.pagamentos[0] : ''),
      entrega: feita.entrega || (g.entregas.length === 1 ? g.entregas[0] : ''),
    };
  };

  function escolher(vendedor, campo, valor) {
    setEscolhas({ ...escolhas, [vendedor]: { ...(escolhas[vendedor] || {}), [campo]: valor } });
  }

  function fechar() {
    const finais = Object.fromEntries(grupos.map((g) => [g.vendedor, escolhaDe(g)]));
    const r = executar((e) => fecharPedido(e, finais, new Date()));
    if (r.erro) {
      setErro(r.erro);
      return;
    }
    ir('morador', 'vendas', r.id);
  }

  if (!grupos.length) {
    return html`<div class="pilha"><${Vazio} texto="Sua sacola está vazia." /><a class="btn secundario" href="#morador.vendas">Ver a vitrine</a></div>`;
  }
  const total = grupos.reduce((soma, g) => soma + g.subtotal, 0);
  const opcoes = (g, campo, nomes, lista, vazio) => (lista.length
    ? lista.map((k) => html`<label key=${k} class="check"><input id=${`${campo}-${g.vendedor}-${k}`} type="radio" name=${`${campo}-${g.vendedor}`} checked=${escolhaDe(g)[campo] === k} onChange=${() => escolher(g.vendedor, campo, k)} /><span>${nomes[k]}</span></label>`)
    : html`<small class="sub">${vazio}</small>`);
  return html`<div class="pilha">
    <h2>Sacola</h2>
    ${grupos.map((g) => html`<article key=${g.vendedor} class="cartao">
      <strong>${g.nome} · apto ${g.vendedor}</strong>
      <ul class="itens-sacola">${g.itens.map((i) => html`<li key=${i.anuncio.id}>
        <span>${i.quantidade} × ${i.anuncio.titulo}</span>
        <span>${fmtCentavos(i.subtotal)}</span>
        <button type="button" class="btn-link" onClick=${() => executar((e) => removerDaSacola(e, i.anuncio.id))}>Remover</button>
      </li>`)}</ul>
      <fieldset><legend>Pagamento</legend>${opcoes(g, 'pagamento', PAGAMENTOS, g.pagamentos, 'Estes itens não têm forma de pagamento em comum. Faça pedidos separados.')}</fieldset>
      <fieldset><legend>Entrega</legend>${opcoes(g, 'entrega', ENTREGAS, g.entregas, 'Estes itens não têm forma de entrega em comum. Faça pedidos separados.')}</fieldset>
      <div class="linha-entre"><span class="sub">Subtotal</span><strong>${fmtCentavos(g.subtotal)}</strong></div>
    </article>`)}
    <div class="linha-entre total"><span>Total</span><strong>${fmtCentavos(total)}</strong></div>
    <p class="sub">O pagamento é combinado direto com o vendedor. O app registra o pedido e a conversa.</p>
    <${Erro} texto=${erro} />
    <button type="button" class="btn primario bloco" onClick=${fechar}>Fechar pedido</button>
  </div>`;
}

function LinhaPedido({ estado, pedido, outro }) {
  return html`<a class=${`cartao link${pedido.status === 'novo' ? ' destaque' : ''}`} href=${`#morador.vendas.${pedido.id}`}>
    <div class="linha-entre"><strong>${pedido.id}</strong><${EtqPedido} status=${pedido.status} /></div>
    <span>${nomeVizinho(estado, outro)} · apto ${outro}</span>
    <small class="sub">${pedido.itens.map((i) => `${i.quantidade} × ${i.titulo}`).join(', ')} · ${fmtCentavos(totalPedido(pedido))} · ${fmtDataHora(pedido.criadoEm)}</small>
  </a>`;
}

function VMeusPedidos({ estado, eu }) {
  const lista = estado.pedidos.filter((p) => p.comprador === eu).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  return html`<div class="pilha">
    <h2>Meus pedidos</h2>
    ${lista.length
      ? html`<ul class="m-lista">${lista.map((p) => html`<li key=${p.id}><${LinhaPedido} estado=${estado} pedido=${p} outro=${p.vendedor} /></li>`)}</ul>`
      : html`<${Vazio} texto="Você ainda não fez pedidos." />`}
  </div>`;
}

function VPedido({ estado, eu, executar, pedido }) {
  const [mensagem, setMensagem] = useState('');
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState(null);
  const souVendedor = pedido.vendedor === eu;
  const outro = souVendedor ? pedido.comprador : pedido.vendedor;
  const acoes = acoesPedido(pedido, eu);
  const botoes = acoes.filter((a) => a !== 'conversar');

  function rodar(acao) {
    const r = executar(acao);
    setErro(r.erro || null);
    return r;
  }

  function agir(acao) {
    if (acao === 'recusar') {
      setRecusando(true);
      return;
    }
    const funcoes = { aceitar: aceitarPedido, entregar: marcarEntregue, pago: marcarPago, cancelar: cancelarPedido };
    rodar((e) => funcoes[acao](e, pedido.id, eu, new Date()));
  }

  function recusar() {
    if (!rodar((e) => recusarPedido(e, pedido.id, eu, motivo, new Date())).erro) setRecusando(false);
  }

  function enviar() {
    if (!rodar((e) => enviarMensagem(e, pedido.id, eu, mensagem, new Date())).erro) setMensagem('');
  }

  return html`<div class="pilha">
    <a class="voltar" href=${souVendedor ? '#morador.vendas.loja' : '#morador.vendas.pedidos'}>‹ ${souVendedor ? 'Minha loja' : 'Meus pedidos'}</a>
    <p class="protocolo">Pedido ${pedido.id}</p>
    <div class="linha-entre">
      <strong>${souVendedor ? 'Comprador' : 'Vendedor'}: ${nomeVizinho(estado, outro)} · apto ${outro}</strong>
      <span class="etq-linha"><${EtqPedido} status=${pedido.status} />${pedido.pago && html`<${Etiqueta} tipo="ok">Pago<//>`}</span>
    </div>
    <ul class="itens-sacola">${pedido.itens.map((i, n) => html`<li key=${n}><span>${i.quantidade} × ${i.titulo}</span><span>${fmtCentavos(i.preco * i.quantidade)}</span></li>`)}</ul>
    <div class="linha-entre total"><span>Total</span><strong>${fmtCentavos(totalPedido(pedido))}</strong></div>
    <p class="sub">${PAGAMENTOS[pedido.pagamento]} · ${ENTREGAS[pedido.entrega]}${pedido.motivo ? ` · Motivo: ${pedido.motivo}` : ''}</p>
    ${botoes.length > 0 && html`<div class="acoes">${botoes.map((a) => html`<button type="button" key=${a} class=${['aceitar', 'entregar'].includes(a) ? 'btn primario' : 'btn secundario'} onClick=${() => agir(a)}>${ROTULOS_ACAO_PEDIDO[a]}</button>`)}</div>`}
    ${recusando && html`<div class="cartao">
      <${Campo} rotulo="Motivo da recusa"><input id="pedido-motivo" value=${motivo} onInput=${(ev) => setMotivo(ev.target.value)} placeholder="Ex.: sem ingredientes hoje" /><//>
      <div class="acoes">
        <button type="button" class="btn perigo" onClick=${recusar}>Confirmar recusa</button>
        <button type="button" class="btn secundario" onClick=${() => setRecusando(false)}>Voltar</button>
      </div>
    </div>`}
    <${Erro} texto=${erro} />
    <h2>Andamento</h2>
    <ol class="linha-tempo">${pedido.linha.map((l, n) => html`<li key=${n} class=${l.status ? 'marco' : 'comentario'}>
      <span class="lt-quando">${fmtDataHora(l.em)}</span>
      <strong>${l.status ? NOMES_STATUS_PEDIDO[l.status] : 'Pagamento'}</strong>
      <span>${l.texto}</span>
    </li>`)}</ol>
    <h2>Conversa</h2>
    <ul class="conversa">
      ${pedido.mensagens.length
        ? pedido.mensagens.map((m, n) => html`<li key=${n} class=${m.autor === eu ? 'minha' : 'outra'}><span>${m.texto}</span><small>${m.autor === eu ? 'Você' : nomeVizinho(estado, m.autor)} · ${fmtDataHora(m.em)}</small></li>`)
        : html`<li class="sem-mensagem">Nenhuma mensagem ainda.</li>`}
    </ul>
    ${acoes.includes('conversar') && html`<div class="enviar-mensagem">
      <${Campo} rotulo="Mensagem"><input id="pedido-mensagem" value=${mensagem} onInput=${(ev) => setMensagem(ev.target.value)} placeholder=${`Escreva para ${nomeVizinho(estado, outro).split(' ')[0]}`} /><//>
      <button type="button" class="btn primario" onClick=${enviar}>Enviar</button>
    </div>`}
  </div>`;
}

function VLoja(props) {
  const { estado, eu } = props;
  const [aba, setAba] = useState('pedidos');
  const pessoa = pessoaDaUnidade(estado, eu);
  if (pessoa.vendedor !== 'aprovado') return html`<${VConvite} ...${props} />`;
  const recebidos = estado.pedidos
    .filter((p) => p.vendedor === eu)
    .sort((a, b) => Number(b.status === 'novo') - Number(a.status === 'novo') || b.criadoEm.localeCompare(a.criadoEm));
  const novos = recebidos.filter((p) => p.status === 'novo').length;
  const abas = [['pedidos', novos ? `Pedidos (${novos} ${novos === 1 ? 'novo' : 'novos'})` : 'Pedidos'], ['anuncios', 'Meus anúncios'], ['painel', 'Painel']];
  return html`<div class="pilha">
    <div class="chips" role="group" aria-label="Minha loja">
      ${abas.map(([chave, nome]) => html`<button type="button" key=${chave} class="chip" aria-pressed=${aba === chave} onClick=${() => setAba(chave)}>${nome}</button>`)}
    </div>
    ${aba === 'pedidos' && (recebidos.length
      ? html`<ul class="m-lista">${recebidos.map((p) => html`<li key=${p.id}><${LinhaPedido} estado=${estado} pedido=${p} outro=${p.comprador} /></li>`)}</ul>`
      : html`<${Vazio} texto="Nenhum pedido recebido ainda." />`)}
    ${aba === 'anuncios' && html`<${VMeusAnuncios} ...${props} />`}
    ${aba === 'painel' && html`<${VPainel} ...${props} />`}
  </div>`;
}

function VMeusAnuncios({ estado, eu, executar }) {
  const meus = estado.anuncios.filter((a) => a.vendedor === eu).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  return html`<a class="btn primario bloco" href="#morador.vendas.novo-anuncio">Novo anúncio</a>
    ${meus.length
      ? html`<ul class="m-lista">${meus.map((a) => html`<li key=${a.id}><${EditorAnuncio} anuncio=${a} eu=${eu} executar=${executar} /></li>`)}</ul>`
      : html`<${Vazio} texto="Você ainda não tem anúncios." />`}`;
}

function EditorAnuncio({ anuncio, eu, executar }) {
  const [preco, setPreco] = useState((anuncio.preco / 100).toFixed(2).replace('.', ','));
  const [quantidade, setQuantidade] = useState(String(anuncio.quantidade));
  const [mensagem, setMensagem] = useState(null);
  const [erro, setErro] = useState(null);

  function salvar(mudanca) {
    const r = executar((e) => editarAnuncio(e, eu, anuncio.id, mudanca));
    setErro(r.erro || null);
    setMensagem(r.erro ? null : 'Anúncio atualizado.');
  }

  let situacao = html`<${Etiqueta} tipo="ok">Na vitrine<//>`;
  if (anuncio.oculto) situacao = html`<${Etiqueta} tipo="perigo">Oculto pelo síndico<//>`;
  else if (!anuncio.ativo) situacao = html`<${Etiqueta}>Pausado<//>`;
  return html`<article class="cartao">
    <div class="linha-entre"><strong>${anuncio.titulo}</strong>${situacao}</div>
    ${anuncio.oculto && html`<small class="sub">Motivo: ${anuncio.motivoOculto}</small>`}
    <div class="edicao-anuncio">
      <${Campo} rotulo="Preço (R$)"><input id=${`preco-${anuncio.id}`} inputmode="decimal" value=${preco} onInput=${(ev) => setPreco(ev.target.value)} /><//>
      <${Campo} rotulo="Disponível"><input id=${`quantidade-${anuncio.id}`} type="number" min="0" value=${quantidade} onInput=${(ev) => setQuantidade(ev.target.value)} /><//>
    </div>
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
    <div class="acoes">
      <button type="button" class="btn secundario" onClick=${() => salvar({ preco: lerPreco(preco), quantidade: quantidade === '' ? NaN : Number(quantidade) })}>Salvar</button>
      <button type="button" class="btn secundario" onClick=${() => salvar({ ativo: !anuncio.ativo })}>${anuncio.ativo ? 'Pausar' : 'Retomar'}</button>
    </div>
  </article>`;
}

function VNovoAnuncio({ estado, eu, executar }) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('doces');
  const [preco, setPreco] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [pagamentos, setPagamentos] = useState([]);
  const [entregas, setEntregas] = useState([]);
  const [erro, setErro] = useState(null);
  if (pessoaDaUnidade(estado, eu).vendedor !== 'aprovado') return html`<${VConvite} estado=${estado} eu=${eu} executar=${executar} />`;
  const alternar = (lista, definir, chave) => definir(lista.includes(chave) ? lista.filter((x) => x !== chave) : [...lista, chave]);

  function publicar() {
    const dados = { titulo, descricao, categoria, preco: lerPreco(preco), quantidade: quantidade === '' ? NaN : Number(quantidade), pagamentos, entregas };
    const r = executar((e) => publicarAnuncio(e, eu, dados, new Date()));
    if (r.erro) {
      setErro(r.erro);
      return;
    }
    ir('morador', 'vendas', 'loja');
  }

  return html`<div class="pilha">
    <a class="voltar" href="#morador.vendas.loja">‹ Minha loja</a>
    <h2>Novo anúncio</h2>
    <${Campo} rotulo="Título"><input id="novo-titulo" value=${titulo} onInput=${(ev) => setTitulo(ev.target.value)} placeholder="Ex.: Bolo de cenoura com chocolate" /><//>
    <${Campo} rotulo="Descrição"><textarea id="novo-descricao" rows="3" value=${descricao} onInput=${(ev) => setDescricao(ev.target.value)}></textarea><//>
    <${Campo} rotulo="Categoria"><select id="novo-categoria" value=${categoria} onChange=${(ev) => setCategoria(ev.target.value)}>${Object.entries(CATEGORIAS_VENDA).map(([chave, nome]) => html`<option key=${chave} value=${chave}>${nome}</option>`)}</select><//>
    <div class="edicao-anuncio">
      <${Campo} rotulo="Preço (R$)"><input id="novo-preco" inputmode="decimal" value=${preco} onInput=${(ev) => setPreco(ev.target.value)} placeholder="Ex.: 18,00" /><//>
      <${Campo} rotulo="Quantidade"><input id="novo-quantidade" type="number" min="0" value=${quantidade} onInput=${(ev) => setQuantidade(ev.target.value)} /><//>
    </div>
    <fieldset><legend>Pagamento aceito</legend>
      ${Object.entries(PAGAMENTOS).map(([chave, nome]) => html`<label key=${chave} class="check"><input id=${`novo-pagamento-${chave}`} type="checkbox" checked=${pagamentos.includes(chave)} onChange=${() => alternar(pagamentos, setPagamentos, chave)} /><span>${nome}</span></label>`)}
    </fieldset>
    <fieldset><legend>Entrega</legend>
      ${Object.entries(ENTREGAS).map(([chave, nome]) => html`<label key=${chave} class="check"><input id=${`novo-entrega-${chave}`} type="checkbox" checked=${entregas.includes(chave)} onChange=${() => alternar(entregas, setEntregas, chave)} /><span>${nome}</span></label>`)}
    </fieldset>
    <p class="sub">No protótipo, a foto do produto é simulada.</p>
    <${Erro} texto=${erro} />
    <button type="button" class="btn primario bloco" onClick=${publicar}>Publicar anúncio</button>
  </div>`;
}

function VPainel({ estado, eu, agora }) {
  const [periodo, setPeriodo] = useState('7d');
  const d = painelVendas(estado, eu, periodo, agora);
  const maximo = Math.max(1, ...d.barras.map((b) => b.valor));
  const unidadeTempo = periodo === '7d' ? 'dia' : 'semana';
  const numeros = [['Faturamento', fmtCentavos(d.faturamento)], ['Pedidos', d.pedidos], ['Ticket médio', fmtCentavos(d.ticket)], ['Itens vendidos', d.itens]];
  return html`<div class="pilha">
    <div class="chips" role="group" aria-label="Período">
      ${PERIODOS_PAINEL.map(([chave, nome]) => html`<button type="button" key=${chave} class="chip" aria-pressed=${periodo === chave} onClick=${() => setPeriodo(chave)}>${nome}</button>`)}
    </div>
    <div class="numeros">${numeros.map(([rotulo, valor]) => html`<div key=${rotulo} class="numero"><span>${rotulo}</span><strong>${valor}</strong></div>`)}</div>
    <h2>Faturamento por ${unidadeTempo}</h2>
    <div class="grafico-barras" role="img" aria-label=${`Faturamento por ${unidadeTempo}: ${d.barras.map((b) => `${fmtDataCurta(b.rotulo).slice(0, 5)}, ${fmtCentavos(b.valor)}`).join('; ')}`}>
      ${d.barras.map((b) => html`<div key=${b.rotulo} class="coluna">
        <span class="valor">${b.valor ? fmtCentavos(b.valor).replace(',00', '') : ''}</span>
        <span class="barra-v" style=${`height:${Math.round((b.valor / maximo) * 110)}px`}></span>
        <span class="rotulo-x">${fmtDataCurta(b.rotulo).slice(0, 5)}</span>
      </div>`)}
    </div>
    <h2>Mais vendidos</h2>
    ${d.maisVendidos.length
      ? html`<ol class="mais-vendidos">${d.maisVendidos.map((m) => html`<li key=${m.titulo}><span>${m.titulo}</span><strong>${m.quantidade}</strong></li>`)}</ol>`
      : html`<${Vazio} texto="Nenhuma venda entregue no período." />`}
    <h2>Pedidos por situação</h2>
    <dl class="situacao-pedidos">
      <dt>Entregues</dt><dd>${d.situacao.entregues}</dd>
      <dt>Em andamento</dt><dd>${d.situacao.andamento}</dd>
      <dt>Recusados</dt><dd>${d.situacao.recusados}</dd>
      <dt>Cancelados</dt><dd>${d.situacao.cancelados}</dd>
    </dl>
  </div>`;
}

function VConvite({ estado, eu, executar }) {
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState(null);
  const pessoa = pessoaDaUnidade(estado, eu);

  function pedir() {
    const r = executar((e) => pedirParaVender(e, eu, texto, new Date()));
    setErro(r.erro || null);
  }

  if (pessoa.vendedor === 'pendente') {
    return html`<div class="cartao"><strong>Aguardando aprovação do síndico</strong><span class="sub">Você pediu para vender: ${pessoa.pedidoVenda.texto}</span></div>`;
  }
  if (pessoa.vendedor === 'suspenso') {
    return html`<p class="erro">Suas vendas estão suspensas pelo síndico. Motivo: ${pessoa.motivoVendedor}</p>`;
  }
  return html`<div class="pilha">
    <div class="convite">
      <${QuadroIcone} nome="loja" />
      <div><strong>Quer vender para os vizinhos?</strong><span class="sub">Doces, salgados, artesanato, desapego ou serviços. O síndico aprova e você começa a anunciar.</span></div>
    </div>
    ${pessoa.motivoVendedor && html`<p class="erro">Pedido anterior recusado: ${pessoa.motivoVendedor}</p>`}
    <${Campo} rotulo="O que você pretende vender?"><textarea id="convite-texto" rows="3" value=${texto} onInput=${(ev) => setTexto(ev.target.value)} placeholder="Ex.: bolos caseiros por encomenda"></textarea><//>
    <${Erro} texto=${erro} />
    <button type="button" class="btn primario bloco" onClick=${pedir}>Pedir para vender</button>
  </div>`;
}
```

- [ ] **Step 3: Ligar a aba no app do morador**

Em `src/ui/morador.js`:
1. Acrescente o import, abaixo do import de `../vendas/acoes.js`:
```js
import { TelaVendas } from './vendas.js';
```
2. Troque a constante `ABAS_MORADOR` por:
```js
const ABAS_MORADOR = [['inicio', 'Início', 'casa'], ['reservas', 'Reservas', 'calendario'], ['avisos', 'Avisos', 'megafone'], ['ocorrencias', 'Ocorrências', 'prancheta'], ['vendas', 'Vendas', 'loja'], ['mais', 'Mais', 'menu']];
```
3. Na `TelaMorador`, troque `preferencias: MPreferencias };` por `preferencias: MPreferencias, vendas: TelaVendas };`.

Em `prototipo/montagem.mjs`, acrescente `'src/ui/vendas.js',` na `ORDEM`, logo antes de `'src/ui/morador.js',`.

- [ ] **Step 4: Estilos**

Em `src/estilos.css`, troque `grid-template-columns: repeat(5, 1fr);` (regra `.cel-abas`) por `grid-template-columns: repeat(6, 1fr);` e, na regra `.cel-abas a`, troque `font-size: 10.5px;` por `font-size: 10px;`. Depois acrescente ao final:
```css
.pilha { display: flex; flex-direction: column; gap: 10px; }
.pilha > h2 { margin: 14px 0 0; }
.vendas-nav { display: flex; align-items: stretch; border-bottom: 1px solid var(--borda); overflow-x: auto; }
.vendas-nav a { display: flex; align-items: center; gap: 6px; padding: 0 10px; min-height: 44px; color: var(--texto); text-decoration: none; font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; white-space: nowrap; border-bottom: 3px solid transparent; }
.vendas-nav a.ativa { color: var(--laranja-forte); border-bottom-color: var(--laranja); }
.vendas-nav a.sacola { margin-left: auto; }
.anuncios { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.cartao.anuncio { padding: 10px; gap: 4px; height: 100%; }
.foto-produto { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; aspect-ratio: 4 / 3; max-width: 100%; border-radius: 2px; background: var(--laranja-tinta); color: var(--laranja-forte); font-size: 12px; font-weight: 600; }
.preco { margin: 0; font-weight: 700; color: var(--titulo); font-variant-numeric: tabular-nums; }
.preco.grande { font-size: 1.5rem; font-weight: 300; }
.anuncio-titulo { margin: 0; font-size: 1.1rem; font-weight: 600; color: var(--titulo); }
.itens-sacola { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.itens-sacola li { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 4px 10px; font-variant-numeric: tabular-nums; }
.itens-sacola li > span:first-child { flex: 1; min-width: 0; }
.total { padding-top: 8px; border-top: 1px solid var(--borda); }
.total strong { font-size: 1.1rem; }
.cartao.destaque { box-shadow: inset 3px 0 0 var(--laranja); }
.conversa { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.conversa li { display: flex; flex-direction: column; gap: 2px; max-width: 85%; padding: 8px 12px; border-radius: var(--raio); }
.conversa li small { color: var(--suave); font-size: 11.5px; }
.conversa li.minha { align-self: flex-end; background: var(--laranja-tinta); }
.conversa li.outra { align-self: flex-start; background: var(--sup); border: 1px solid var(--borda); }
.conversa li.sem-mensagem { max-width: none; padding: 0; color: var(--suave); font-style: italic; }
.enviar-mensagem { display: flex; align-items: flex-end; gap: 8px; }
.enviar-mensagem .campo { flex: 1; min-width: 0; }
.edicao-anuncio { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.convite { display: flex; align-items: flex-start; gap: 14px; padding: 16px; background: var(--sup); border: 1px solid var(--borda); border-radius: var(--raio); }
.convite > div { display: flex; flex-direction: column; gap: 4px; }
.numeros { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.numero { display: flex; flex-direction: column; padding: 12px 14px; background: var(--sup); border: 1px solid var(--borda); border-radius: var(--raio); }
.numero span { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: var(--suave); }
.numero strong { font-size: 1.35rem; font-weight: 300; font-variant-numeric: tabular-nums; }
.grafico-barras { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 6px; align-items: end; padding: 8px 4px 0; }
.grafico-barras .coluna { display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 4px; min-width: 0; height: 160px; }
.grafico-barras .valor { font-size: 10.5px; font-weight: 600; color: var(--titulo); white-space: nowrap; font-variant-numeric: tabular-nums; }
.grafico-barras .barra-v { width: 100%; max-width: 34px; min-height: 2px; background: var(--laranja); border-radius: 2px 2px 0 0; }
.grafico-barras .rotulo-x { font-size: 10.5px; color: var(--suave); font-variant-numeric: tabular-nums; padding-top: 4px; border-top: 1px solid var(--borda); width: 100%; text-align: center; }
.mais-vendidos { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; }
.mais-vendidos li strong { margin-left: 8px; }
.situacao-pedidos { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; margin: 0; }
.situacao-pedidos dd { margin: 0; font-weight: 600; color: var(--titulo); text-align: right; font-variant-numeric: tabular-nums; }
```

- [ ] **Step 5: Rodar a bateria**

Run: `npm test && npm run montar && npm run verificar && npm run e2e`
Expected: tudo verde, inclusive as checagens novas.

- [ ] **Step 6: Commit**

```bash
git add prototipo
git commit -m "feat(vendas): vitrine, sacola, pedidos com conversa, loja e painel do vendedor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Novidades no Início e moderação pelo síndico

**Files:**
- Modify: `prototipo/src/ui/morador.js`, `prototipo/src/ui/sindico.js`, `prototipo/verificar.mjs`

**Interfaces:**
- Consumes:
  - `aprovarVendedor`, `recusarVendedor`, `suspenderVendedor`, `reativarVendedor`, `ocultarAnuncio` e `mostrarAnuncio` (Task 3);
  - `CartaoAnuncio` (Task 5);
  - `anunciosVisiveis`, `nomeVizinho` e `fmtCentavos` (Task 2).
- Produces:
  - rota `#sindico.vendas`;
  - botão `[data-acao="aprovar-vendedor-<unidade>"]`;
  - texto "Aprovar vendedor: Nome, apto N" no Início do síndico.

- [ ] **Step 1: Acrescentar as checagens que falham**

Em `prototipo/verificar.mjs`, acrescente ao final de `CHECAGENS`:
```js
  ['#morador.inicio', ['Novidades na vitrine', 'Bicicleta infantil aro 16']],
  ['#sindico.inicio', ['Aprovar vendedor: Paulo Ribeiro, apto 102']],
  ['#sindico.vendas', ['Salgados assados para festas', 'aprovar-vendedor-102', 'Juliana Costa · apto 104', 'Bicicleta infantil aro 16', 'Pedidos no mês']],
```

Run: `npm run montar && npm run verificar`
Expected: FAIL nas linhas novas.

- [ ] **Step 2: Novidades na vitrine no Início do morador**

Em `src/ui/morador.js`:

1. Troque `import { pessoaDaUnidade } from '../vendas/regras.js';` por `import { pessoaDaUnidade, anunciosVisiveis } from '../vendas/regras.js';`.
2. Troque `import { TelaVendas } from './vendas.js';` por `import { TelaVendas, CartaoAnuncio } from './vendas.js';`.
3. Na `MInicio`, logo abaixo da linha `const fixado = …`, acrescente:
```js
  const novidades = anunciosVisiveis(estado).filter((a) => a.vendedor !== eu).slice(0, 2);
```
4. Ainda na `MInicio`, logo antes de `<a class="btn primario bloco" href="#morador.ocorrencias.nova">Abrir ocorrência</a>`, acrescente:
```js
    <h2>Novidades na vitrine</h2>
    ${novidades.length
      ? html`<ul class="anuncios">${novidades.map((a) => html`<li key=${a.id}><${CartaoAnuncio} estado=${estado} anuncio=${a} eu=${eu} /></li>`)}</ul>`
      : html`<${Vazio} texto="Nenhum anúncio na vitrine." />`}
    <a class="voltar" href="#morador.vendas">Ver a vitrine</a>
```

- [ ] **Step 3: Vendas no painel do síndico**

Em `src/ui/sindico.js`:

1. Acrescente os imports, abaixo do import de `'../acoes.js'`:
```js
import { aprovarVendedor, recusarVendedor, suspenderVendedor, reativarVendedor, ocultarAnuncio, mostrarAnuncio } from '../vendas/acoes.js';
import { nomeVizinho, fmtCentavos } from '../vendas/regras.js';
```
2. Na constante `MENU_SINDICO`, troque `['encomendas', 'Encomendas', 'pacote']]` por `['encomendas', 'Encomendas', 'pacote'], ['vendas', 'Vendas', 'loja']]`.
3. Na `TelaSindico`, troque `encomendas: SEncomendas }[tela];` por `encomendas: SEncomendas, vendas: SVendas }[tela];`.
4. Na `SInicio`:
   - logo abaixo de `const alertas = …`, acrescente:
```js
  const vendedoresPendentes = estado.pessoas.filter((p) => p.vendedor === 'pendente');
```
   - troque a linha `const semPendencias = …` por:
```js
  const semPendencias = !pendentes.length && !vencidas.length && !paradas.length && !alertas.length && !vendedoresPendentes.length;
```
   - logo depois da linha que mapeia `alertas.map((a) => …)` dentro de `<ul class="atencao">`, acrescente:
```js
          ${vendedoresPendentes.map((p) => html`<li key=${`v${p.unidade}`}><a href="#sindico.vendas">Aprovar vendedor: ${p.nome}, apto ${p.unidade}</a></li>`)}
```
5. Acrescente ao final do arquivo:
```js
function SVendas({ estado, executar, agora }) {
  const [editando, setEditando] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState(null);
  const mes = isoDia(agora).slice(0, 7);
  const pendentes = estado.pessoas.filter((p) => p.vendedor === 'pendente');
  const vendedores = estado.pessoas.filter((p) => ['aprovado', 'suspenso'].includes(p.vendedor));
  const pedidosNoMes = (unidade) => estado.pedidos.filter((p) => (!unidade || p.vendedor === unidade) && isoDia(new Date(p.criadoEm)).slice(0, 7) === mes).length;

  function rodar(acao) {
    const r = executar(acao);
    if (r.erro) {
      setErro(r.erro);
      return;
    }
    setErro(null);
    setEditando(null);
    setMotivo('');
  }

  function abrir(tipo, id) {
    setEditando({ tipo, id });
    setMotivo('');
    setErro(null);
  }

  function confirmar() {
    const { tipo, id } = editando;
    if (tipo === 'recusar') rodar((e) => recusarVendedor(e, id, motivo));
    if (tipo === 'suspender') rodar((e) => suspenderVendedor(e, id, motivo));
    if (tipo === 'ocultar') rodar((e) => ocultarAnuncio(e, id, motivo));
  }

  const caixaMotivo = (tipo, id) => editando && editando.tipo === tipo && editando.id === id && html`<div class="recusa">
    <${Campo} rotulo="Motivo"><input id=${`motivo-${tipo}-${id}`} value=${motivo} onInput=${(ev) => setMotivo(ev.target.value)} /><//>
    <button type="button" class="btn perigo" onClick=${confirmar}>Confirmar</button>
    <button type="button" class="btn secundario" onClick=${() => setEditando(null)}>Voltar</button>
  </div>`;

  return html`<section>
    <h1>Vendas entre moradores</h1>
    <div class="indicadores">
      <div class="indicador"><${QuadroIcone} nome="sacola" /><span class="ind-rotulo">Pedidos no mês</span><strong>${pedidosNoMes()}</strong><small>Entre todos os vendedores</small></div>
      <div class="indicador"><${QuadroIcone} nome="loja" /><span class="ind-rotulo">Vendedores ativos</span><strong>${vendedores.filter((p) => p.vendedor === 'aprovado').length}</strong><small>${pendentes.length} aguardando aprovação</small></div>
    </div>
    <p class="sub">Por privacidade, conversas e detalhes dos pedidos ficam só entre comprador e vendedor.</p>
    <${Erro} texto=${erro} />
    <h2>Solicitações para vender</h2>
    ${pendentes.length
      ? html`<ul class="lista-cartoes">${pendentes.map((p) => html`<li key=${p.unidade} class="cartao">
          <div class="linha-entre"><strong>${p.nome} · apto ${p.unidade}</strong><small class="sub">${fmtDataHora(p.pedidoVenda.em)}</small></div>
          <span>${p.pedidoVenda.texto}</span>
          ${caixaMotivo('recusar', p.unidade) || html`<div class="acoes">
            <button type="button" class="btn primario" data-acao=${`aprovar-vendedor-${p.unidade}`} onClick=${() => rodar((e) => aprovarVendedor(e, p.unidade))}>Aprovar</button>
            <button type="button" class="btn secundario" onClick=${() => abrir('recusar', p.unidade)}>Recusar</button>
          </div>`}
        </li>`)}</ul>`
      : html`<${Vazio} texto="Nenhuma solicitação aguardando." />`}
    <h2>Vendedores</h2>
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Vendedor</th><th>Situação</th><th>Anúncios ativos</th><th>Pedidos no mês</th><th><span class="sub">Ação</span></th></tr></thead>
      <tbody>${vendedores.map((p) => html`<tr key=${p.unidade}>
        <td>${p.nome} · apto ${p.unidade}</td>
        <td>${p.vendedor === 'aprovado' ? html`<${Etiqueta} tipo="ok">Ativo<//>` : html`<${Etiqueta} tipo="perigo">Suspenso<//>`}</td>
        <td>${estado.anuncios.filter((a) => a.vendedor === p.unidade && a.ativo && !a.oculto).length}</td>
        <td>${pedidosNoMes(p.unidade)}</td>
        <td>${p.vendedor === 'aprovado'
          ? caixaMotivo('suspender', p.unidade) || html`<button type="button" class="btn secundario" onClick=${() => abrir('suspender', p.unidade)}>Suspender</button>`
          : html`<button type="button" class="btn secundario" onClick=${() => rodar((e) => reativarVendedor(e, p.unidade))}>Reativar</button>`}</td>
      </tr>`)}</tbody>
    </table></div>
    <h2>Anúncios</h2>
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Anúncio</th><th>Vendedor</th><th>Preço</th><th>Disponível</th><th>Situação</th><th><span class="sub">Ação</span></th></tr></thead>
      <tbody>${[...estado.anuncios].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).map((a) => {
        let situacao = html`<${Etiqueta} tipo="ok">Na vitrine<//>`;
        if (a.oculto) situacao = html`<${Etiqueta} tipo="perigo">Oculto<//>`;
        else if (!a.ativo) situacao = html`<${Etiqueta}>Pausado<//>`;
        return html`<tr key=${a.id}>
          <td>${a.titulo}${a.oculto ? html`<br /><small class="sub">Motivo: ${a.motivoOculto}</small>` : ''}</td>
          <td>${nomeVizinho(estado, a.vendedor)} · apto ${a.vendedor}</td>
          <td>${fmtCentavos(a.preco)}</td>
          <td>${a.quantidade}</td>
          <td>${situacao}</td>
          <td>${a.oculto
            ? html`<button type="button" class="btn secundario" onClick=${() => rodar((e) => mostrarAnuncio(e, a.id))}>Mostrar</button>`
            : caixaMotivo('ocultar', a.id) || html`<button type="button" class="btn secundario" onClick=${() => abrir('ocultar', a.id)}>Ocultar</button>`}</td>
        </tr>`;
      })}</tbody>
    </table></div>
  </section>`;
}
```

- [ ] **Step 4: Rodar a bateria**

Run: `npm test && npm run montar && npm run verificar && npm run e2e`
Expected: tudo verde.

- [ ] **Step 5: Commit**

```bash
git add prototipo
git commit -m "feat(vendas): novidades no Início do morador e moderação de vendas pelo síndico

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Roteiros ponta a ponta, revisão visual e publicação

**Files:**
- Modify: `prototipo/e2e.mjs`

**Interfaces:**
- Consumes: os textos e atributos das Tasks 4 a 6.

- [ ] **Step 1: Acrescentar os roteiros**

Em `prototipo/e2e.mjs`, no objeto `ROTEIROS`, acrescente logo antes de `async persistencia() {`:
```js
  async vendaCompra() {
    await irPara('#morador.vendas.a1');
    await esperarTexto('Restam 10');
    await preencher('Quantidade', '2');
    await clicar('Adicionar à sacola');
    await esperarTexto('Adicionado à sacola');
    await irPara('#morador.vendas.a2');
    await clicar('Adicionar à sacola');
    await esperarTexto('Adicionado à sacola');
    await irPara('#morador.vendas.sacola');
    await esperarTexto('R$ 48,00');
    await clicar('Fechar pedido');
    await esperarTexto('Pedido PD-011');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Juliana Costa')`, 'o aviso de pedido para a Juliana');
    await irPara('#morador.vendas.a1');
    await esperarTexto('Restam 8');
  },

  async vendaAtendimento() {
    await clicar('Juliana · 104');
    await irPara('#morador.vendas.PD-011');
    await clicar('Aceitar pedido');
    await esperarTexto('Pedido aceito pelo vendedor');
    await preencher('Mensagem', 'Pode passar às 18h');
    await clicar('Enviar');
    await esperarTexto('Pode passar às 18h');
    await clicar('Ana · 302');
    await irPara('#morador.vendas.PD-011');
    await esperarTexto('Pode passar às 18h');
    await clicar('Juliana · 104');
    await irPara('#morador.vendas.PD-011');
    await clicar('Marcar como entregue');
    await clicar('Marcar como pago');
    await esperarTexto('Pagamento confirmado pelo vendedor');
    await irPara('#morador.vendas.loja');
    await clicar('Painel');
    await esperarTexto('R$ 102,00');
    await clicar('Ana · 302');
  },

  async vendaVirarVendedora() {
    await irPara('#morador.vendas.loja');
    await preencher('O que você pretende vender?', 'Bolos caseiros por encomenda');
    await clicar('Pedir para vender');
    await esperarTexto('Aguardando aprovação do síndico');
    await irPara('#sindico.vendas');
    await clicarSeletor('[data-acao="aprovar-vendedor-302"]');
    await esperar(`!document.querySelector('[data-acao="aprovar-vendedor-302"]')`, 'a solicitação sair da lista');
    await irPara('#morador.vendas.novo-anuncio');
    await preencher('Título', 'Bolo de cenoura com chocolate');
    await preencher('Preço (R$)', '35,00');
    await preencher('Quantidade', '4');
    await marcar('Pix');
    await marcar('Retirar no apto');
    await clicar('Publicar anúncio');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('9 moradores')`, 'o aviso para quem aceita ofertas');
    await irPara('#morador.vendas');
    await esperarTexto('Bolo de cenoura com chocolate');
  },

```

No roteiro `larguraCelular`, troque a lista de rotas por:
```js
    for (const hash of ['#sindico.inicio', '#sindico.reservas', '#sindico.comunicados.novo', '#sindico.ocorrencias', '#sindico.encomendas', '#sindico.vendas', '#morador.inicio', '#morador.reservas', '#morador.vendas', '#morador.vendas.a1', '#morador.vendas.loja', '#portaria.registrar', '#portaria.entregar']) {
```

- [ ] **Step 2: Rodar**

Run: `npm run montar && npm run e2e`
Expected: 9 linhas `ok`. Se alguma falhar, use superpowers:systematic-debugging. O defeito está na interface, a menos que o roteiro contradiga a especificação.

- [ ] **Step 3: Revisão visual**

Gere capturas a 1366×900 da vitrine, do pedido e do painel. Para isso, rode o Chrome headless sobre `condofacil-local.html` com as rotas `#morador.vendas`, `#morador.vendas.a1` e `#sindico.vendas`. O painel da Juliana só é alcançável trocando de morador; confira-o pela emulação de 390 px usada no e2e ou por uma captura feita via CDP. Abra cada PNG e confira:
- textos não cortados;
- gráfico com barras proporcionais e rótulos legíveis;
- seis abas cabendo no celular.

Corrija o CSS se precisar e rode de novo a bateria completa (`npm test && npm run montar && npm run verificar && npm run e2e`).

- [ ] **Step 4: Commit e publicação**

```bash
git add prototipo
git commit -m "test(vendas): roteiros de compra, atendimento e novo vendedor no e2e

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Republique `prototipo/condofacil.html` na mesma URL (`https://claude.ai/artifact/U7U8aKxcxM9A1Hbnb9bv9r`) pela ferramenta Artifact, com o mesmo caminho de arquivo e `label` "Vendas entre moradores".
