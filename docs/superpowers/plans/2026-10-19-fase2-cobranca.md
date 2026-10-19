# Fase 2, parte 1 — Cobrança, Financeiro do morador, dashboard e planos · Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Acrescentar ao protótipo CondoFácil, tudo simulado, a cobrança via Asaas, a aba Financeiro do morador, o dashboard financeiro no Início do síndico e o seletor de planos com preço, conforme `docs/superpowers/specs/2026-10-19-fase2-cobranca-design.md`.

**Architecture:** O padrão do protótipo continua o mesmo:
- dados iniciais em `src/cobranca/dados.js`;
- regras puras em `src/cobranca/regras.js` e ações puras em `src/cobranca/acoes.js`;
- tabela de planos em `src/planos.js`;
- casos de teste em `src/casos/cobranca-*.js`, que rodam no `node --test` e no `?teste=1`;
- telas em `src/ui/financeiro-sindico.js` e `src/ui/financeiro-morador.js`.

`sindico.js` e `morador.js` só ganham as ligações. O estado sobe para `versao: 3`.

**Tech Stack:** Preact + htm (unpkg), Node 24 (`node:test`), Chrome headless (`verificar.mjs`, `e2e.mjs`).

## Global Constraints

- Texto de interface em português do Brasil.
- `prototipo/condofacil.html` é sempre gerado por `npm run montar`.
- Regras do montador:
  - imports locais em uma linha;
  - `export` só em declarações de nível superior;
  - nomes de nível superior únicos entre todos os arquivos de `src/`;
  - código aninhado indentado.
- Rotas `#perfil.tela.id`.
- Dinheiro em centavos. `fmtReais(c)` formata com milhar e centavos (`R$ 48.350,00`) e `fmtReaisCurto(c)` sem centavos (`R$ 48.350`).
- Multa limitada a 2%. Juros: `Math.round(valor × jurosPct × dias ÷ 3000)`. Multa: `Math.round(valor × multaPct ÷ 100)`.
- Nenhuma pessoa ou empresa real. O Asaas aparece só como canal simulado.
- Tokens de cor do `estilos.css`. As séries do gráfico usam os tokens novos `--serie-receita` e `--serie-despesa`, validados com o script do skill `dataviz`.
- Alvos de toque com pelo menos 44 px. Sem rolagem horizontal em 390 px.
- Comandos rodam em `prototipo/`. Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Os 9 roteiros do `e2e.mjs`, as 83 checagens do `verificar.mjs` e os 75 testes atuais continuam passando.
- Casos da fase 2 usam `AGORA_FASE2 = new Date(2026, 9, 19, 10, 0)` (19/out/2026 10:00).

## Estrutura de arquivos

```
prototipo/src/
  planos.js                    NOVO  PLANOS, PRECO_BASE, liberado, planoMinimo, mensalidade
  cobranca/dados.js            NOVO  constantes, itensBase, mesmoDiaDoMes, financeiroInicial
  cobranca/regras.js           NOVO  formatação, valor atualizado, prévia, régua, devedores, indicadores
  cobranca/acoes.js            NOVO  parâmetros, prévia, emissão, pagamento, baixa, reemissão, régua, plano
  casos/afirmar.js             MOD   AGORA_FASE2
  casos/cobranca-dados.js      NOVO  CASOS_COBRANCA_DADOS
  casos/cobranca-regras.js     NOVO  CASOS_COBRANCA_REGRAS
  casos/cobranca-acoes.js      NOVO  CASOS_COBRANCA_ACOES
  ui/financeiro-sindico.js     NOVO  PainelFinanceiro, pendenciasCobranca, SCobranca, EtqCobranca, Bloqueado
  ui/financeiro-morador.js     NOVO  MFinanceiro, CartaoCobrancaInicio
  dados.js                     MOD   versao 3, plano, financeiro
  armazenamento.js             MOD   versao 3
  ui/comum.js                  MOD   ícone cifrao
  ui/app.js                    MOD   seletor de plano, painel de preços, casos novos no autoteste
  ui/sindico.js                MOD   dashboard no Início, menu Cobrança, itens "Em breve"
  ui/morador.js                MOD   aba Financeiro no lugar de Avisos, cartões no Início, Avisos em Mais
  estilos.css                  MOD   estilos novos
prototipo/montagem.mjs, testes/casos.test.mjs, verificar.mjs, e2e.mjs   MOD
```

---

### Task 1: Planos e dados financeiros

**Files:**
- Create: `prototipo/src/planos.js`, `prototipo/src/cobranca/dados.js`, `prototipo/src/casos/cobranca-dados.js`
- Modify: `prototipo/src/casos/afirmar.js`, `prototipo/src/dados.js`, `prototipo/src/armazenamento.js`, `prototipo/montagem.mjs`, `prototipo/testes/casos.test.mjs`, `prototipo/src/ui/app.js`

**Interfaces:**
- Produces:
  - `src/planos.js`:
    - `PLANOS: [{ id, nome, multiplicador }]`
    - `PRECO_BASE = { faixa, implantacao: 39900, porUnidade: 990 }`
    - `liberado(plano, recurso) → boolean`
    - `planoMinimo(recurso) → plano`
    - `mensalidade(planoId, unidades) → centavos`
  - `src/cobranca/dados.js`:
    - `ETAPAS_REGUA: [{ id, dias, nome, acao, canais }]`
    - `CATEGORIAS_DESPESA`, `NOMES_FORMA`, `NOMES_RELACAO`
    - `mesmoDiaDoMes(iso, meses) → iso`
    - `diferencaMeses('AAAA-MM', 'AAAA-MM') → n`
    - `itensBase(composicao, tipo, competencia) → itens`
    - `financeiroInicial(hoje, em, pessoas, unidades) → financeiro`
  - `estado.plano` (`'intermediario'`) e `estado.financeiro`:
    `{ parametros, composicao, unidades: {u: {tipo, responsavel}}, avulsos, ajustesPrevia, vigente, vencimentoVigente, emitidas, cobrancas, historico, despesasMes, orcamento, saldo, auditoria }`

- [ ] **Step 1: Escrever os casos que falham**

Em `prototipo/src/casos/afirmar.js`, acrescente ao final:
```js

export const AGORA_FASE2 = new Date(2026, 9, 19, 10, 0);
```

Crie `prototipo/src/casos/cobranca-dados.js`:
```js
import { dadosIniciais } from '../dados.js';
import { liberado, planoMinimo, mensalidade } from '../planos.js';
import { igual, AGORA_FASE2 } from './afirmar.js';

function financeiroTeste() {
  return dadosIniciais(AGORA_FASE2).financeiro;
}

function cobrancaDe(f, unidade, competencia) {
  return f.cobrancas.find((c) => c.unidade === unidade && c.competencia === competencia);
}

export const CASOS_COBRANCA_DADOS = [
  {
    nome: 'cobrança: competência vigente venceu há 9 dias',
    rodar() {
      const f = financeiroTeste();
      igual([f.vigente, f.vencimentoVigente, f.parametros.diaVencimento, f.saldo, f.emitidas], ['2026-10', '2026-10-10', 10, 4835000, ['2026-10']]);
    },
  },
  {
    nome: 'cobrança: outubro com 31 emitidas, 28 pagas e 3 em aberto',
    rodar() {
      const outubro = financeiroTeste().cobrancas.filter((c) => c.competencia === '2026-10');
      igual([outubro.length, outubro.filter((c) => c.status === 'paga').length], [31, 28]);
      igual(outubro.filter((c) => c.status === 'aberta').map((c) => c.unidade), ['202', '503', '704']);
    },
  },
  {
    nome: 'cobrança: valores e itens de outubro por tipo de unidade',
    rodar() {
      const f = financeiroTeste();
      igual([cobrancaDe(f, '302', '2026-10').valor, cobrancaDe(f, '801', '2026-10').valor], [86500, 122800]);
      igual(cobrancaDe(f, '302', '2026-10').itens.map((i) => i.descricao), ['Taxa ordinária', 'Fundo de reserva (10%)', 'Pintura da fachada (parcela 3/10)']);
      igual(cobrancaDe(f, '403', '2026-10'), undefined);
    },
  },
  {
    nome: 'cobrança: responsáveis financeiros',
    rodar() {
      const u = financeiroTeste().unidades;
      igual([u['403'].responsavel, u['104'].responsavel.nome, u['104'].responsavel.relacao, u['202'].responsavel.nome, u['302'].responsavel.relacao, u['801'].tipo], [null, 'Carlos Andrade', 'proprietario', 'Helena Prado', 'titular', 'cobertura']);
    },
  },
  {
    nome: 'cobrança: débitos antigos e histórico da Ana',
    rodar() {
      const f = financeiroTeste();
      igual(f.cobrancas.filter((c) => c.status === 'aberta' && c.competencia !== '2026-10').map((c) => `${c.unidade}/${c.competencia}`), ['704/2026-09', '202/2026-09', '202/2026-08']);
      igual(f.cobrancas.filter((c) => c.unidade === '302' && c.status === 'paga').map((c) => c.competencia), ['2026-10', '2026-09', '2026-08']);
    },
  },
  {
    nome: 'cobrança: histórico de 11 meses com julho acima da receita',
    rodar() {
      const h = financeiroTeste().historico;
      igual([h.length, h[0].mes, h[8].mes, h[8].despesas > h[8].receitas], [11, '2025-11', '2026-07', true]);
    },
  },
  {
    nome: 'planos: recursos e preços',
    rodar() {
      igual([liberado('basico', 'cobranca'), liberado('basico', 'dashboardCompleto'), liberado('intermediario', 'dashboardCompleto'), liberado('intermediario', 'orcadoRealizado'), liberado('avancado', 'orcadoRealizado')], [true, false, true, false, true]);
      igual([mensalidade('basico', 32), mensalidade('intermediario', 32), mensalidade('avancado', 32)], [31680, 47520, 69696]);
      igual([planoMinimo('notificacaoFormal').nome, dadosIniciais(AGORA_FASE2).plano], ['Avançado', 'intermediario']);
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
import { CASOS_COBRANCA_DADOS } from '../src/casos/cobranca-dados.js';

for (const caso of [...CASOS_DADOS, ...CASOS_REGRAS, ...CASOS_ACOES, ...CASOS_VENDAS, ...CASOS_COBRANCA_DADOS]) test(caso.nome, () => caso.rodar());
```

Run: `npm test`
Expected: FAIL. `../planos.js` não existe.

- [ ] **Step 2: Criar `src/planos.js`**

```js
// Planos da fase 2 e preço por plano (planilha de precificação, faixa de 31 a 70 unidades).
export const PLANOS = [
  { id: 'basico', nome: 'Básico', multiplicador: 1.0 },
  { id: 'intermediario', nome: 'Intermediário', multiplicador: 1.5 },
  { id: 'avancado', nome: 'Avançado', multiplicador: 2.2 },
];

export const PRECO_BASE = { faixa: '31 a 70 unidades', implantacao: 39900, porUnidade: 990 };

const RECURSOS_PLANO = {
  cobranca: 'basico',
  composicaoCompleta: 'intermediario',
  reguaCompleta: 'intermediario',
  notificacaoFormal: 'avancado',
  dashboardCompleto: 'intermediario',
  orcadoRealizado: 'avancado',
};

const ORDEM_PLANOS = ['basico', 'intermediario', 'avancado'];

export function liberado(plano, recurso) {
  return ORDEM_PLANOS.indexOf(plano) >= ORDEM_PLANOS.indexOf(RECURSOS_PLANO[recurso]);
}

export function planoMinimo(recurso) {
  return PLANOS.find((p) => p.id === RECURSOS_PLANO[recurso]);
}

export function mensalidade(planoId, unidades) {
  const plano = PLANOS.find((p) => p.id === planoId);
  return Math.round(PRECO_BASE.porUnidade * unidades * plano.multiplicador);
}
```

- [ ] **Step 3: Criar `src/cobranca/dados.js`**

```js
// Constantes e dados iniciais da cobrança (fase 2). Tudo relativo a "hoje": a competência vigente venceu há 9 dias.
import { somarDias, somarMes } from '../datas.js';

export const ETAPAS_REGUA = [
  { id: 'antes5', dias: -5, nome: '5 dias antes', acao: 'Lembrete com link e Pix', canais: ['App', 'WhatsApp'] },
  { id: 'vencimento', dias: 0, nome: 'No vencimento', acao: 'Lembrete "vence hoje"', canais: ['App', 'WhatsApp'] },
  { id: 'atraso1', dias: 1, nome: '1 dia após', acao: 'Aviso de atraso com valor atualizado', canais: ['App', 'E-mail', 'WhatsApp'] },
  { id: 'atraso15', dias: 15, nome: '15 dias após', acao: 'Segundo aviso e oferta de acordo', canais: ['E-mail', 'WhatsApp'] },
  { id: 'atraso30', dias: 30, nome: '30 dias após', acao: 'Notificação formal de débito em PDF', canais: ['E-mail'] },
  { id: 'atraso60', dias: 60, nome: '60 dias após', acao: 'Alerta ao síndico: cobrança jurídica ou negativação', canais: ['Painel do síndico'] },
];

export const CATEGORIAS_DESPESA = { pessoal: 'Pessoal', concessionarias: 'Concessionárias', manutencao: 'Manutenção', administracao: 'Administração', seguro: 'Seguro e outros' };
export const NOMES_FORMA = { pix: 'Pix', boleto: 'Boleto', cartao: 'Cartão', manual: 'Baixa manual' };
export const NOMES_RELACAO = { titular: 'titular', inquilino: 'inquilino', proprietario: 'proprietário' };

const RESPONSAVEIS_SEM_APP = { 103: 'Lúcia Ferraz', 202: 'Helena Prado', 304: 'Otávio Reis', 503: 'Márcio Lopes', 602: 'Sílvia Campos', 604: 'André Nogueira', 701: 'Teresa Barreto', 704: 'Vicente Moraes', 802: 'Paula Siqueira', 803: 'Rogério Antunes', 804: 'Denise Correia' };
const HISTORICO_RECEITAS = [2710000, 2685000, 2730000, 2760000, 2655000, 2700000, 2745000, 2690000, 2720000, 2735000, 2700000];
const HISTORICO_DESPESAS = [1780000, 1810000, 1750000, 1840000, 1795000, 1870000, 1820000, 1760000, 2940000, 1850000, 1790000];
const DEVEDORAS_VIGENTE = ['503', '704', '202'];
const FORMAS_SEMENTE = ['pix', 'boleto', 'pix', 'cartao'];

export function mesmoDiaDoMes(iso, meses) {
  const dia = Math.min(28, Number(iso.slice(8, 10)));
  return `${somarMes(iso.slice(0, 7), meses)}-${String(dia).padStart(2, '0')}`;
}

export function diferencaMeses(a, b) {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (ya - yb) * 12 + (ma - mb);
}

function documentoMascarado(unidade) {
  return `***.${unidade}.${String(((Number(unidade) * 7) % 900) + 100)}-**`;
}

export function itensBase(composicao, tipo, competencia) {
  const ordinaria = composicao.ordinaria[tipo];
  const itens = [
    { tipo: 'ordinaria', descricao: 'Taxa ordinária', valor: ordinaria },
    { tipo: 'fundo', descricao: `Fundo de reserva (${composicao.fundoPct}%)`, valor: Math.round((ordinaria * composicao.fundoPct) / 100) },
  ];
  const extra = composicao.extra;
  const parcela = diferencaMeses(competencia, extra.inicio) + 1;
  if (parcela >= 1 && parcela <= extra.parcelas) {
    itens.push({ tipo: 'extra', descricao: `${extra.descricao} (parcela ${parcela}/${extra.parcelas})`, valor: Math.round(extra.total / extra.parcelas / extra.unidades) });
  }
  return itens;
}

export function financeiroInicial(hoje, em, pessoas, unidades) {
  const vencimentoVigente = mesmoDiaDoMes(somarDias(hoje, -9), 0);
  const vigente = vencimentoVigente.slice(0, 7);
  const proxima = somarMes(vigente, 1);
  const composicao = {
    ordinaria: { A: 65000, cobertura: 98000 },
    fundoPct: 10,
    extra: { descricao: 'Pintura da fachada', total: 4800000, parcelas: 10, inicio: somarMes(vigente, -2), unidades: 32 },
  };
  const nomes = Object.fromEntries(pessoas.map((p) => [p.unidade, p.nome]));
  const unidadesFinanceiro = Object.fromEntries(unidades.map((u) => {
    let responsavel = null;
    if (u === '104') responsavel = { nome: 'Carlos Andrade', relacao: 'proprietario' };
    else if (nomes[u]) responsavel = { nome: nomes[u], relacao: 'titular' };
    else if (RESPONSAVEIS_SEM_APP[u]) responsavel = { nome: RESPONSAVEIS_SEM_APP[u], relacao: 'proprietario' };
    if (responsavel) responsavel = { ...responsavel, documento: documentoMascarado(u), canais: ['App', 'E-mail', 'WhatsApp'] };
    return [u, { tipo: u[0] === '8' ? 'cobertura' : 'A', responsavel }];
  }));
  const novaCobranca = (unidade, competencia, vencimento, status, extras = {}) => {
    const itens = itensBase(composicao, unidadesFinanceiro[unidade].tipo, competencia);
    const valor = itens.reduce((soma, i) => soma + i.valor, 0);
    return { id: `CB-${competencia}-${unidade}`, unidade, competencia, vencimento, itens, valor, status, pagaEm: null, valorPago: status === 'paga' ? valor : null, forma: null, baixaManual: null, eventosAsaas: [], regua: [], substituiu: null, ...extras };
  };
  const enviadas = (ids) => ids.map((etapa) => ({ etapa, em: em(-30, 9) }));
  const cobrancas = [];
  unidades.filter((u) => unidadesFinanceiro[u].responsavel).forEach((u, i) => {
    if (DEVEDORAS_VIGENTE.includes(u)) cobrancas.push(novaCobranca(u, vigente, vencimentoVigente, 'aberta', { regua: [{ etapa: 'antes5', em: em(-14, 9) }, { etapa: 'vencimento', em: em(-9, 9) }] }));
    else cobrancas.push(novaCobranca(u, vigente, vencimentoVigente, 'paga', { pagaEm: em(-14 + (i % 6), 11), forma: FORMAS_SEMENTE[i % 4] }));
  });
  const vencimentoSetembro = mesmoDiaDoMes(vencimentoVigente, -1);
  const vencimentoAgosto = mesmoDiaDoMes(vencimentoVigente, -2);
  cobrancas.push(novaCobranca('704', somarMes(vigente, -1), vencimentoSetembro, 'aberta', { regua: enviadas(['antes5', 'vencimento', 'atraso1']) }));
  cobrancas.push(novaCobranca('202', somarMes(vigente, -1), vencimentoSetembro, 'aberta', { regua: enviadas(['antes5', 'vencimento', 'atraso1']) }));
  cobrancas.push(novaCobranca('202', somarMes(vigente, -2), vencimentoAgosto, 'aberta', { regua: enviadas(['antes5', 'vencimento', 'atraso1', 'atraso15', 'atraso30']) }));
  cobrancas.push(novaCobranca('302', somarMes(vigente, -1), vencimentoSetembro, 'paga', { pagaEm: em(-38, 10), forma: 'pix' }));
  cobrancas.push(novaCobranca('302', somarMes(vigente, -2), vencimentoAgosto, 'paga', { pagaEm: em(-68, 10), forma: 'pix' }));
  return {
    parametros: { diaVencimento: Number(vencimentoVigente.slice(8, 10)), diaFechamento: 20, multaPct: 2, jurosPct: 1, descontoPct: 0, descontoAprovadoEm: '', formas: ['boleto', 'pix', 'cartao'], tarifa: 'condominio' },
    composicao,
    unidades: unidadesFinanceiro,
    avulsos: [
      { unidade: '104', competencia: proxima, tipo: 'avulso', descricao: 'Taxa do salão de festas (reserva)', valor: 15000 },
      { unidade: '301', competencia: proxima, tipo: 'credito', descricao: 'Crédito: pagamento em duplicidade', valor: -5000 },
    ],
    ajustesPrevia: {},
    vigente,
    vencimentoVigente,
    emitidas: [vigente],
    cobrancas,
    historico: HISTORICO_RECEITAS.map((receitas, i) => ({ mes: somarMes(vigente, i - 11), receitas, despesas: HISTORICO_DESPESAS[i] })),
    despesasMes: { pessoal: 980000, concessionarias: 390000, manutencao: 230000, administracao: 120000, seguro: 90000 },
    orcamento: { pessoal: 950000, concessionarias: 420000, manutencao: 200000, administracao: 120000, seguro: 100000 },
    saldo: 4835000,
    auditoria: [],
  };
}
```

- [ ] **Step 4: Integrar em `src/dados.js`, armazenamento, montador e autoteste**

Rode este script em `prototipo/`. Ele falha se algum trecho não for encontrado:
```bash
node - <<'EOF'
const fs = require('fs');
function trocar(arquivo, pares) {
  let s = fs.readFileSync(arquivo, 'utf8');
  for (const [de, para] of pares) {
    if (!s.includes(de)) throw new Error(`${arquivo}: não achei ${de.slice(0, 70)}`);
    s = s.replace(de, para);
  }
  fs.writeFileSync(arquivo, s);
}
trocar('src/dados.js', [
  ["import { vendasIniciais, perfilVenda } from './vendas/dados.js';", "import { vendasIniciais, perfilVenda } from './vendas/dados.js';\nimport { financeiroInicial } from './cobranca/dados.js';"],
  ['  return {\n    versao: 2,', "  const pessoas = MORADORES.map(([unidade, nome]) => ({ id: `p${unidade}`, nome, unidade, ...perfilVenda(unidade, em) }));\n\n  return {\n    versao: 3,"],
  ['    pessoas: MORADORES.map(([unidade, nome]) => ({ id: `p${unidade}`, nome, unidade, ...perfilVenda(unidade, em) })),', '    pessoas,'],
  ['    ...vendasIniciais(em),\n', "    ...vendasIniciais(em),\n    plano: 'intermediario',\n    financeiro: financeiroInicial(hoje, em, pessoas, UNIDADES),\n"],
]);
trocar('src/armazenamento.js', [['estado.versao === 2', 'estado.versao === 3']]);
trocar('montagem.mjs', [
  ["  'src/datas.js',", "  'src/datas.js',\n  'src/planos.js',\n  'src/cobranca/dados.js',"],
  ["  'src/casos/vendas.js',", "  'src/casos/vendas.js',\n  'src/casos/cobranca-dados.js',"],
]);
trocar('src/ui/app.js', [
  ["import { CASOS_VENDAS } from '../casos/vendas.js';", "import { CASOS_VENDAS } from '../casos/vendas.js';\nimport { CASOS_COBRANCA_DADOS } from '../casos/cobranca-dados.js';"],
  ['...CASOS_ACOES, ...CASOS_VENDAS]', '...CASOS_ACOES, ...CASOS_VENDAS, ...CASOS_COBRANCA_DADOS]'],
]);
console.log('ok');
EOF
```

- [ ] **Step 5: Rodar a bateria**

Run: `npm test && npm run montar && npm run verificar && npm run e2e`
Expected: 82 testes PASS (7 novos), todas as checagens `ok` e os 9 roteiros `ok`.

- [ ] **Step 6: Commit**

```bash
git add prototipo
git commit -m "feat(cobranca): planos e dados financeiros iniciais da fase 2

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Regras de cobrança

**Files:**
- Create: `prototipo/src/cobranca/regras.js`, `prototipo/src/casos/cobranca-regras.js`
- Modify: `prototipo/montagem.mjs`, `prototipo/testes/casos.test.mjs`, `prototipo/src/ui/app.js`

**Interfaces:**
- Consumes: Task 1; `datas.js` (`diferencaDias`, `somarMes`, `nomeMes`).
- Produces (puras):
  - Formatação:
    - `fmtReais(c)`, `fmtReaisCurto(c)`
    - `mesCurto('AAAA-MM') → 'out'`, `mesExtenso('AAAA-MM') → 'outubro'`
  - Cobrança e prévia:
    - `situacaoCobranca(c, hoje) → 'aberta'|'vencida'|'paga'|'cancelada'`
    - `valorAtualizado(c, parametros, hoje) → { total, multa, juros, dias }`
    - `validarParametros(p) → {ok}|{ok:false, motivo}`
    - `proximaCompetencia(financeiro)`, `vencimentoDa(financeiro, competencia)`
    - `previaCompetencia(estado, competencia) → { competencia, vencimento, linhas: [{ unidade, tipo, responsavel, itens, total, bloqueada, motivo }] }`
  - Régua:
    - `etapasNoPlano(plano) → ids`
    - `etapaRegua(c, hoje) → etapa|null` (objeto de `ETAPAS_REGUA`)
    - `pendentesDaRegua(estado, hoje, plano) → [{ cobranca, etapa }]`
  - Dashboard e permissões:
    - `devedores(estado, hoje) → [{ unidade, responsavel, cobrancas, valor, dias, etapa }]`
    - `indicadoresFinanceiros(estado, hoje) → { saldo, arrecadado, inadimplencia, despesas }`, com o formato dos casos abaixo
    - `serieReceitasDespesas(estado, hoje) → [{ mes, receitas, despesas }]` (12 meses)
    - `tituloSerie(serie) → texto`
    - `podeOperar(perfil) → boolean`

- [ ] **Step 1: Escrever os casos que falham**

Crie `prototipo/src/casos/cobranca-regras.js`:
```js
import { dadosIniciais } from '../dados.js';
import { fmtReais, fmtReaisCurto, mesExtenso, situacaoCobranca, valorAtualizado, validarParametros, proximaCompetencia, previaCompetencia, etapaRegua, pendentesDaRegua, devedores, indicadoresFinanceiros, serieReceitasDespesas, tituloSerie, podeOperar } from '../cobranca/regras.js';
import { igual, AGORA_FASE2 } from './afirmar.js';

const HOJE_FASE2 = '2026-10-19';
const PARAMETROS_OK = { diaVencimento: 10, diaFechamento: 20, multaPct: 2, jurosPct: 1, descontoPct: 0, descontoAprovadoEm: '', formas: ['pix'], tarifa: 'condominio' };

function estadoFase2() {
  return dadosIniciais(AGORA_FASE2);
}

function cobrancaFase2(estado, unidade, competencia) {
  return estado.financeiro.cobrancas.find((c) => c.unidade === unidade && c.competencia === competencia);
}

export const CASOS_COBRANCA_REGRAS = [
  {
    nome: 'cobrança: formatação de reais',
    rodar() {
      igual([fmtReais(4835000), fmtReaisCurto(4835000), fmtReais(86500), fmtReais(-5000), fmtReais(15840), mesExtenso('2026-07')], ['R$ 48.350,00', 'R$ 48.350', 'R$ 865,00', '−R$ 50,00', 'R$ 158,40', 'julho']);
    },
  },
  {
    nome: 'cobrança: valor atualizado com multa de 2% e juros de 1% ao mês',
    rodar() {
      const e = estadoFase2();
      const p = e.financeiro.parametros;
      igual(valorAtualizado(cobrancaFase2(e, '503', '2026-10'), p, HOJE_FASE2), { total: 88490, multa: 1730, juros: 260, dias: 9 });
      igual(valorAtualizado(cobrancaFase2(e, '704', '2026-09'), p, HOJE_FASE2).juros, 1125);
      igual(valorAtualizado(cobrancaFase2(e, '202', '2026-08'), p, HOJE_FASE2).total, 90248);
      igual(valorAtualizado(cobrancaFase2(e, '302', '2026-10'), p, HOJE_FASE2), { total: 86500, multa: 0, juros: 0, dias: 0 });
      igual([situacaoCobranca(cobrancaFase2(e, '503', '2026-10'), HOJE_FASE2), situacaoCobranca(cobrancaFase2(e, '302', '2026-10'), HOJE_FASE2)], ['vencida', 'paga']);
    },
  },
  {
    nome: 'cobrança: parâmetros respeitam o Código Civil e a assembleia',
    rodar() {
      igual(validarParametros(PARAMETROS_OK), { ok: true });
      igual(validarParametros({ ...PARAMETROS_OK, multaPct: 2.5 }).motivo, 'A multa por atraso é limitada a 2% (Código Civil, art. 1.336)');
      igual(validarParametros({ ...PARAMETROS_OK, descontoPct: 5 }).motivo, 'Informe a ata ou cláusula que aprova o desconto');
      igual(validarParametros({ ...PARAMETROS_OK, descontoPct: 5, descontoAprovadoEm: 'AGO 28/03/2026' }), { ok: true });
      igual(validarParametros({ ...PARAMETROS_OK, diaVencimento: 30 }).motivo, 'Use um dia entre 1 e 28');
      igual(validarParametros({ ...PARAMETROS_OK, formas: [] }).motivo, 'Escolha ao menos uma forma de pagamento');
    },
  },
  {
    nome: 'cobrança: prévia de novembro',
    rodar() {
      const e = estadoFase2();
      const previa = previaCompetencia(e, proximaCompetencia(e.financeiro));
      const linha = (u) => previa.linhas.find((l) => l.unidade === u);
      igual([previa.competencia, previa.vencimento, previa.linhas.length, previa.linhas.filter((l) => !l.bloqueada).length], ['2026-11', '2026-11-10', 32, 31]);
      igual([linha('403').bloqueada, linha('403').motivo], [true, 'Sem responsável financeiro']);
      igual([linha('302').total, linha('801').total, linha('104').total, linha('301').total], [86500, 122800, 101500, 81500]);
      igual(linha('302').itens[2].descricao, 'Pintura da fachada (parcela 4/10)');
    },
  },
  {
    nome: 'cobrança: etapas da régua por plano',
    rodar() {
      const e = estadoFase2();
      igual(etapaRegua(cobrancaFase2(e, '704', '2026-09'), HOJE_FASE2).id, 'atraso30');
      igual(etapaRegua(cobrancaFase2(e, '302', '2026-10'), HOJE_FASE2), null);
      const resumo = (plano) => pendentesDaRegua(e, HOJE_FASE2, plano).map((p) => [p.cobranca.unidade, p.cobranca.competencia, p.etapa.id]);
      igual(resumo('intermediario'), [['202', '2026-10', 'atraso1'], ['503', '2026-10', 'atraso1'], ['704', '2026-10', 'atraso1'], ['704', '2026-09', 'atraso15'], ['202', '2026-09', 'atraso15'], ['202', '2026-08', 'atraso60']]);
      igual(resumo('basico'), []);
      igual(resumo('avancado')[3], ['704', '2026-09', 'atraso30']);
    },
  },
  {
    nome: 'cobrança: devedores com valor atualizado e etapa',
    rodar() {
      igual(devedores(estadoFase2(), HOJE_FASE2).map((d) => [d.unidade, d.cobrancas, d.valor, d.dias, d.etapa.id, d.responsavel.nome]), [
        ['202', 3, 268093, 70, 'atraso60', 'Helena Prado'],
        ['704', 2, 177845, 39, 'atraso30', 'Vicente Moraes'],
        ['503', 1, 88490, 9, 'atraso1', 'Márcio Lopes'],
      ]);
    },
  },
  {
    nome: 'cobrança: indicadores do dashboard',
    rodar() {
      igual(indicadoresFinanceiros(estadoFase2(), HOJE_FASE2), {
        saldo: { valor: 4835000, despesaMedia: 1909545, alerta: false },
        arrecadado: { competencia: '2026-10', recebido: 2567200, previsto: 2826700, pct: 91, alerta: false, proxima: null },
        inadimplencia: { unidades: 3, total: 32, pct: 9.4, valor: 534428, alerta: false },
        despesas: { valor: 1810000, orcado: 1790000, desvio: 1.1, alerta: false },
      });
    },
  },
  {
    nome: 'cobrança: série de 12 meses e título do gráfico',
    rodar() {
      const serie = serieReceitasDespesas(estadoFase2(), HOJE_FASE2);
      igual([serie.length, serie[11]], [12, { mes: '2026-10', receitas: 2567200, despesas: 1810000 }]);
      igual(tituloSerie(serie), 'Despesa superou a receita só em julho');
      igual(tituloSerie([{ mes: '2026-01', receitas: 10, despesas: 5 }]), 'Receita cobriu a despesa em todos os meses');
    },
  },
  {
    nome: 'cobrança: só o síndico opera',
    rodar() {
      igual([podeOperar('sindico'), podeOperar('morador'), podeOperar('portaria')], [true, false, false]);
    },
  },
];
```

Em `prototipo/testes/casos.test.mjs`:
- acrescente `import { CASOS_COBRANCA_REGRAS } from '../src/casos/cobranca-regras.js';` abaixo do import de `cobranca-dados.js`;
- troque `...CASOS_COBRANCA_DADOS]` por `...CASOS_COBRANCA_DADOS, ...CASOS_COBRANCA_REGRAS]`.

Run: `npm test`
Expected: FAIL. `../cobranca/regras.js` não existe.

- [ ] **Step 2: Criar `src/cobranca/regras.js`**

```js
import { ETAPAS_REGUA, itensBase, mesmoDiaDoMes, diferencaMeses } from './dados.js';
import { diferencaDias, somarMes, nomeMes } from '../datas.js';

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ETAPAS_POR_PLANO = {
  basico: ['antes5', 'vencimento'],
  intermediario: ['antes5', 'vencimento', 'atraso1', 'atraso15', 'atraso60'],
  avancado: ETAPAS_REGUA.map((e) => e.id),
};

function milhar(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function fmtReais(centavos) {
  const abs = Math.abs(centavos);
  return `${centavos < 0 ? '−' : ''}R$ ${milhar(Math.floor(abs / 100))},${String(abs % 100).padStart(2, '0')}`;
}

export function fmtReaisCurto(centavos) {
  return `${centavos < 0 ? '−' : ''}R$ ${milhar(Math.round(Math.abs(centavos) / 100))}`;
}

export function mesCurto(anoMes) {
  return MESES_ABREV[Number(anoMes.slice(5, 7)) - 1];
}

export function mesExtenso(anoMes) {
  return nomeMes(anoMes).split(' de ')[0];
}

export function situacaoCobranca(cobranca, hoje) {
  if (cobranca.status !== 'aberta') return cobranca.status;
  return cobranca.vencimento < hoje ? 'vencida' : 'aberta';
}

export function valorAtualizado(cobranca, parametros, hoje) {
  const dias = situacaoCobranca(cobranca, hoje) === 'vencida' ? diferencaDias(hoje, cobranca.vencimento) : 0;
  if (!dias) return { total: cobranca.valor, multa: 0, juros: 0, dias: 0 };
  const multa = Math.round((cobranca.valor * parametros.multaPct) / 100);
  const juros = Math.round((cobranca.valor * parametros.jurosPct * dias) / 3000);
  return { total: cobranca.valor + multa + juros, multa, juros, dias };
}

export function validarParametros(p) {
  const falha = (motivo) => ({ ok: false, motivo });
  for (const dia of [p.diaVencimento, p.diaFechamento]) {
    if (!Number.isInteger(dia) || dia < 1 || dia > 28) return falha('Use um dia entre 1 e 28');
  }
  if (!(p.multaPct >= 0) || p.multaPct > 2) return falha('A multa por atraso é limitada a 2% (Código Civil, art. 1.336)');
  if (!(p.jurosPct >= 0)) return falha('Informe os juros ao mês');
  if (p.descontoPct > 0 && !String(p.descontoAprovadoEm || '').trim()) return falha('Informe a ata ou cláusula que aprova o desconto');
  if (!p.formas || !p.formas.length) return falha('Escolha ao menos uma forma de pagamento');
  return { ok: true };
}

export function proximaCompetencia(financeiro) {
  return somarMes(financeiro.vigente, 1);
}

export function vencimentoDa(financeiro, competencia) {
  return mesmoDiaDoMes(financeiro.vencimentoVigente, diferencaMeses(competencia, financeiro.vigente));
}

export function previaCompetencia(estado, competencia) {
  const fin = estado.financeiro;
  const ajustes = fin.ajustesPrevia[competencia] || {};
  const linhas = estado.condominio.unidades.map((unidade) => {
    const { tipo, responsavel } = fin.unidades[unidade];
    const avulsos = fin.avulsos.filter((a) => a.unidade === unidade && a.competencia === competencia).map(({ tipo: t, descricao, valor }) => ({ tipo: t, descricao, valor }));
    const itens = ajustes[unidade] || [...itensBase(fin.composicao, tipo, competencia), ...avulsos];
    const bloqueada = !responsavel || !responsavel.documento;
    return { unidade, tipo, responsavel, itens, total: itens.reduce((soma, i) => soma + i.valor, 0), bloqueada, motivo: bloqueada ? 'Sem responsável financeiro' : null };
  });
  return { competencia, vencimento: vencimentoDa(fin, competencia), linhas };
}

export function etapasNoPlano(plano) {
  return ETAPAS_POR_PLANO[plano];
}

export function etapaRegua(cobranca, hoje) {
  if (cobranca.status !== 'aberta') return null;
  const dias = diferencaDias(hoje, cobranca.vencimento);
  const alcancadas = ETAPAS_REGUA.filter((e) => e.dias <= dias);
  return alcancadas.length ? alcancadas[alcancadas.length - 1] : null;
}

export function pendentesDaRegua(estado, hoje, plano) {
  const permitidas = etapasNoPlano(plano);
  return estado.financeiro.cobrancas.flatMap((c) => {
    if (c.status !== 'aberta') return [];
    const dias = diferencaDias(hoje, c.vencimento);
    const candidatas = ETAPAS_REGUA.filter((e) => e.dias <= dias && permitidas.includes(e.id));
    const etapa = candidatas[candidatas.length - 1];
    return etapa && !c.regua.some((r) => r.etapa === etapa.id) ? [{ cobranca: c, etapa }] : [];
  });
}

export function devedores(estado, hoje) {
  const fin = estado.financeiro;
  const grupos = {};
  for (const c of fin.cobrancas) {
    if (situacaoCobranca(c, hoje) !== 'vencida') continue;
    const v = valorAtualizado(c, fin.parametros, hoje);
    if (!grupos[c.unidade]) grupos[c.unidade] = { unidade: c.unidade, responsavel: fin.unidades[c.unidade].responsavel, cobrancas: 0, valor: 0, dias: 0, etapa: null };
    const g = grupos[c.unidade];
    g.cobrancas += 1;
    g.valor += v.total;
    if (v.dias > g.dias) {
      g.dias = v.dias;
      g.etapa = etapaRegua(c, hoje);
    }
  }
  return Object.values(grupos).sort((a, b) => b.dias - a.dias);
}

export function indicadoresFinanceiros(estado, hoje) {
  const fin = estado.financeiro;
  const daCompetencia = (competencia) => fin.cobrancas.filter((c) => c.competencia === competencia && c.status !== 'cancelada');
  const vigentes = daCompetencia(fin.vigente);
  const previsto = vigentes.reduce((soma, c) => soma + c.valor, 0);
  const recebido = vigentes.filter((c) => c.status === 'paga').reduce((soma, c) => soma + c.valor, 0);
  const proxima = proximaCompetencia(fin);
  const daProxima = daCompetencia(proxima);
  const lista = devedores(estado, hoje);
  const totalUnidades = estado.condominio.unidades.length;
  const despesaMedia = Math.round(fin.historico.reduce((soma, m) => soma + m.despesas, 0) / fin.historico.length);
  const despesas = Object.values(fin.despesasMes).reduce((soma, v) => soma + v, 0);
  const orcado = Object.values(fin.orcamento).reduce((soma, v) => soma + v, 0);
  const desvio = Math.round(((despesas - orcado) / orcado) * 1000) / 10;
  const pct = previsto ? Math.round((recebido / previsto) * 100) : 0;
  const inadimplenciaPct = Math.round((lista.length / totalUnidades) * 1000) / 10;
  return {
    saldo: { valor: fin.saldo, despesaMedia, alerta: fin.saldo < despesaMedia },
    arrecadado: { competencia: fin.vigente, recebido, previsto, pct, alerta: pct < 85, proxima: fin.emitidas.includes(proxima) ? { competencia: proxima, pagas: daProxima.filter((c) => c.status === 'paga').length, total: daProxima.length } : null },
    inadimplencia: { unidades: lista.length, total: totalUnidades, pct: inadimplenciaPct, valor: lista.reduce((soma, d) => soma + d.valor, 0), alerta: inadimplenciaPct > 10 },
    despesas: { valor: despesas, orcado, desvio, alerta: desvio > 10 },
  };
}

export function serieReceitasDespesas(estado, hoje) {
  const ind = indicadoresFinanceiros(estado, hoje);
  return [...estado.financeiro.historico, { mes: estado.financeiro.vigente, receitas: ind.arrecadado.recebido, despesas: ind.despesas.valor }];
}

export function tituloSerie(serie) {
  const acima = serie.filter((m) => m.despesas > m.receitas);
  if (!acima.length) return 'Receita cobriu a despesa em todos os meses';
  if (acima.length === 1) return `Despesa superou a receita só em ${mesExtenso(acima[0].mes)}`;
  return `Despesa superou a receita em ${acima.length} meses`;
}

export function podeOperar(perfil) {
  return perfil === 'sindico';
}
```

- [ ] **Step 3: Incluir no montador e no autoteste**

Em `prototipo/montagem.mjs`, na `ORDEM`:
- logo depois de `'src/cobranca/dados.js',`, acrescente `'src/cobranca/regras.js',`;
- logo depois de `'src/casos/cobranca-dados.js',`, acrescente `'src/casos/cobranca-regras.js',`.

Em `prototipo/src/ui/app.js`:
- acrescente `import { CASOS_COBRANCA_REGRAS } from '../casos/cobranca-regras.js';` abaixo do import de `cobranca-dados.js`;
- troque `...CASOS_COBRANCA_DADOS]` por `...CASOS_COBRANCA_DADOS, ...CASOS_COBRANCA_REGRAS]`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test && npm run montar && npm run verificar`
Expected: 91 testes PASS e `falhas: 0` no autoteste.

- [ ] **Step 5: Commit**

```bash
git add prototipo
git commit -m "feat(cobranca): regras puras (valor atualizado, prévia, régua, devedores, indicadores)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Ações de cobrança

**Files:**
- Create: `prototipo/src/cobranca/acoes.js`, `prototipo/src/casos/cobranca-acoes.js`
- Modify: `prototipo/montagem.mjs`, `prototipo/testes/casos.test.mjs`, `prototipo/src/ui/app.js`

**Interfaces:**
- Consumes: Tasks 1 e 2; `SINDICO` de `dados.js`; `isoDia` de `datas.js`.
- Produces: todas devolvem `{ estado, notificacao?, erro? }`, e algumas devolvem extras indicados abaixo.
  - Configuração:
    - `salvarParametros(estado, parametros, perfil, agora)`
    - `editarItemPrevia(estado, competencia, unidade, itens)`
    - `trocarPlano(estado, plano)`
  - Emissão e pagamento:
    - `emitirCompetencia(estado, competencia, perfil, agora)`, que devolve também `emitidas`
    - `confirmarPagamentoAsaas(estado, idCobranca, idEvento, forma, agora)`
    - `baixaManual(estado, idCobranca, { data, comprovante }, perfil, agora)`
  - Correção, avisos e régua:
    - `cancelarEReemitir(estado, idCobranca, perfil, agora)`, que devolve também `id` (o da nova cobrança)
    - `enviarSegundaVia(estado, idCobranca, agora)`
    - `executarRegua(estado, agora)`, que devolve também `resumo: [{ unidade, competencia, etapa }]`

- [ ] **Step 1: Escrever os casos que falham**

Crie `prototipo/src/casos/cobranca-acoes.js`:
```js
import { dadosIniciais } from '../dados.js';
import { previaCompetencia, devedores, indicadoresFinanceiros } from '../cobranca/regras.js';
import { salvarParametros, editarItemPrevia, emitirCompetencia, confirmarPagamentoAsaas, baixaManual, cancelarEReemitir, enviarSegundaVia, executarRegua, trocarPlano } from '../cobranca/acoes.js';
import { igual, AGORA_FASE2 } from './afirmar.js';

const HOJE_ACOES = '2026-10-19';

function cobrancaPorId(estado, id) {
  return estado.financeiro.cobrancas.find((c) => c.id === id);
}

function comNovembroEmitido() {
  return emitirCompetencia(dadosIniciais(AGORA_FASE2), '2026-11', 'sindico', AGORA_FASE2).estado;
}

export const CASOS_COBRANCA_ACOES = [
  {
    nome: 'cobrança: emissão em lote de novembro',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      igual(emitirCompetencia(e, '2026-11', 'morador', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      igual(emitirCompetencia(e, '2026-10', 'sindico', AGORA_FASE2).erro, 'Competência já emitida');
      const r = emitirCompetencia(e, '2026-11', 'sindico', AGORA_FASE2);
      igual([r.emitidas, r.notificacao.para, r.estado.financeiro.cobrancas.filter((c) => c.competencia === '2026-11').length], [31, '31 responsáveis', 31]);
      igual(cobrancaPorId(r.estado, 'CB-2026-11-302').valor, 86500);
      igual(cobrancaPorId(r.estado, 'CB-2026-11-403'), undefined);
      igual(indicadoresFinanceiros(r.estado, HOJE_ACOES).arrecadado.proxima, { competencia: '2026-11', pagas: 0, total: 31 });
      igual(r.estado.financeiro.auditoria[0].acao, 'Emissão em lote');
    },
  },
  {
    nome: 'cobrança: confirmação do Asaas é idempotente',
    rodar() {
      const e = comNovembroEmitido();
      const um = confirmarPagamentoAsaas(e, 'CB-2026-11-302', 'evt-1', 'pix', AGORA_FASE2);
      const c = cobrancaPorId(um.estado, 'CB-2026-11-302');
      igual([c.status, c.valorPago, c.forma, um.estado.financeiro.saldo, um.notificacao.para], ['paga', 86500, 'pix', 4921500, 'Ana Souza']);
      const repetido = confirmarPagamentoAsaas(um.estado, 'CB-2026-11-302', 'evt-1', 'pix', AGORA_FASE2);
      igual(repetido.estado, um.estado);
      igual(repetido.notificacao, undefined);
      igual(confirmarPagamentoAsaas(um.estado, 'CB-2026-11-302', 'evt-2', 'pix', AGORA_FASE2).erro, 'Cobrança não está em aberto');
    },
  },
  {
    nome: 'cobrança: pagamento em atraso recebe o valor atualizado',
    rodar() {
      const r = confirmarPagamentoAsaas(dadosIniciais(AGORA_FASE2), 'CB-2026-10-503', 'evt-9', 'boleto', AGORA_FASE2);
      igual(cobrancaPorId(r.estado, 'CB-2026-10-503').valorPago, 88490);
    },
  },
  {
    nome: 'cobrança: baixa manual exige comprovante e fica na auditoria',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      igual(baixaManual(e, 'CB-2026-10-503', { data: HOJE_ACOES, comprovante: '' }, 'sindico', AGORA_FASE2).erro, 'Anexe o comprovante');
      igual(baixaManual(e, 'CB-2026-10-503', { data: HOJE_ACOES, comprovante: 'x.pdf' }, 'morador', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      const r = baixaManual(e, 'CB-2026-10-503', { data: HOJE_ACOES, comprovante: 'comprovante-503.pdf' }, 'sindico', AGORA_FASE2);
      const c = cobrancaPorId(r.estado, 'CB-2026-10-503');
      igual([c.status, c.forma, c.baixaManual.comprovante, devedores(r.estado, HOJE_ACOES).length], ['paga', 'manual', 'comprovante-503.pdf', 2]);
      igual(r.estado.financeiro.auditoria.at(-1).acao, 'Baixa manual');
    },
  },
  {
    nome: 'cobrança: régua de hoje envia uma vez por etapa',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const r = executarRegua(e, AGORA_FASE2);
      igual([r.resumo.length, r.notificacao.para], [6, '3 responsáveis']);
      igual(cobrancaPorId(r.estado, 'CB-2026-10-503').regua.map((x) => x.etapa), ['antes5', 'vencimento', 'atraso1']);
      const de_novo = executarRegua(r.estado, AGORA_FASE2);
      igual([de_novo.resumo, de_novo.notificacao], [[], undefined]);
      igual(executarRegua({ ...e, plano: 'basico' }, AGORA_FASE2).resumo, []);
    },
  },
  {
    nome: 'cobrança: cancelar e reemitir guarda o histórico',
    rodar() {
      const r = cancelarEReemitir(dadosIniciais(AGORA_FASE2), 'CB-2026-10-503', 'sindico', AGORA_FASE2);
      igual([cobrancaPorId(r.estado, 'CB-2026-10-503').status, r.id, cobrancaPorId(r.estado, r.id).substituiu, cobrancaPorId(r.estado, r.id).status], ['cancelada', 'CB-2026-10-503-R1', 'CB-2026-10-503', 'aberta']);
      igual(devedores(r.estado, HOJE_ACOES).length, 3);
    },
  },
  {
    nome: 'cobrança: ajuste da prévia antes de emitir',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const itens = previaCompetencia(e, '2026-11').linhas.find((l) => l.unidade === '302').itens.filter((i) => i.tipo !== 'fundo');
      const r = editarItemPrevia(e, '2026-11', '302', itens);
      igual(previaCompetencia(r.estado, '2026-11').linhas.find((l) => l.unidade === '302').total, 80000);
      igual(editarItemPrevia(e, '2026-11', '302', [{ tipo: 'avulso', descricao: ' ', valor: 100 }]).erro, 'Preencha descrição e valor de cada item');
      igual(editarItemPrevia(comNovembroEmitido(), '2026-11', '302', itens).erro, 'Competência já emitida');
    },
  },
  {
    nome: 'cobrança: parâmetros, 2ª via e plano',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      igual(salvarParametros(e, { ...e.financeiro.parametros, multaPct: 3 }, 'sindico', AGORA_FASE2).erro, 'A multa por atraso é limitada a 2% (Código Civil, art. 1.336)');
      igual(salvarParametros(e, { ...e.financeiro.parametros, jurosPct: 0.5 }, 'sindico', AGORA_FASE2).estado.financeiro.parametros.jurosPct, 0.5);
      igual(enviarSegundaVia(e, 'CB-2026-10-503', AGORA_FASE2).notificacao.texto.includes('R$ 884,90'), true);
      igual(trocarPlano(e, 'premium').erro, 'Plano inexistente');
      igual(trocarPlano(e, 'basico').estado.plano, 'basico');
    },
  },
];
```

Em `prototipo/testes/casos.test.mjs`:
- acrescente `import { CASOS_COBRANCA_ACOES } from '../src/casos/cobranca-acoes.js';`;
- troque `...CASOS_COBRANCA_REGRAS]` por `...CASOS_COBRANCA_REGRAS, ...CASOS_COBRANCA_ACOES]`.

Run: `npm test`
Expected: FAIL. `../cobranca/acoes.js` não existe.

- [ ] **Step 2: Criar `src/cobranca/acoes.js`**

```js
import { SINDICO } from '../dados.js';
import { PLANOS } from '../planos.js';
import { isoDia } from '../datas.js';
import { validarParametros, previaCompetencia, valorAtualizado, pendentesDaRegua, podeOperar, fmtReais, mesExtenso } from './regras.js';

// Cada ação devolve { estado, notificacao?, erro? } sem mutar nada; ações financeiras entram na auditoria.
const SO_SINDICO = 'Somente o síndico pode fazer isso';

function erroCobranca(estado, mensagem) {
  return { estado, erro: mensagem };
}

function comFinanceiro(estado, mudanca) {
  return { ...estado, financeiro: { ...estado.financeiro, ...mudanca } };
}

function comAuditoria(estado, agora, acao, detalhe) {
  return [...estado.financeiro.auditoria, { em: agora.toISOString(), quem: SINDICO, acao, detalhe }];
}

function trocarCobranca(cobrancas, id, mudanca) {
  return cobrancas.map((c) => (c.id === id ? { ...c, ...mudanca } : c));
}

function nomeResponsavel(estado, unidade) {
  const r = estado.financeiro.unidades[unidade].responsavel;
  return r ? r.nome : `Apto ${unidade}`;
}

export function salvarParametros(estado, parametros, perfil, agora) {
  if (!podeOperar(perfil)) return erroCobranca(estado, SO_SINDICO);
  const v = validarParametros(parametros);
  if (!v.ok) return erroCobranca(estado, v.motivo);
  return {
    estado: comFinanceiro(estado, {
      parametros: { ...parametros, formas: [...parametros.formas] },
      auditoria: comAuditoria(estado, agora, 'Parâmetros alterados', `Multa ${parametros.multaPct}% · juros ${parametros.jurosPct}% a.m. · vencimento dia ${parametros.diaVencimento}`),
    }),
  };
}

export function editarItemPrevia(estado, competencia, unidade, itens) {
  if (estado.financeiro.emitidas.includes(competencia)) return erroCobranca(estado, 'Competência já emitida');
  if (itens.some((i) => !String(i.descricao || '').trim() || !Number.isFinite(i.valor))) return erroCobranca(estado, 'Preencha descrição e valor de cada item');
  const daCompetencia = { ...(estado.financeiro.ajustesPrevia[competencia] || {}), [unidade]: itens.map(({ tipo, descricao, valor }) => ({ tipo, descricao: descricao.trim(), valor })) };
  return { estado: comFinanceiro(estado, { ajustesPrevia: { ...estado.financeiro.ajustesPrevia, [competencia]: daCompetencia } }) };
}

export function emitirCompetencia(estado, competencia, perfil, agora) {
  if (!podeOperar(perfil)) return erroCobranca(estado, SO_SINDICO);
  const fin = estado.financeiro;
  if (fin.emitidas.includes(competencia)) return erroCobranca(estado, 'Competência já emitida');
  const previa = previaCompetencia(estado, competencia);
  const novas = previa.linhas.filter((l) => !l.bloqueada).map((l) => ({
    id: `CB-${competencia}-${l.unidade}`, unidade: l.unidade, competencia, vencimento: previa.vencimento, itens: l.itens, valor: l.total,
    status: 'aberta', pagaEm: null, valorPago: null, forma: null, baixaManual: null, eventosAsaas: [], regua: [], substituiu: null,
  }));
  const bloqueadas = previa.linhas.filter((l) => l.bloqueada).map((l) => l.unidade);
  return {
    estado: comFinanceiro(estado, {
      cobrancas: [...fin.cobrancas, ...novas],
      emitidas: [...fin.emitidas, competencia],
      auditoria: comAuditoria(estado, agora, 'Emissão em lote', `${mesExtenso(competencia)}: ${novas.length} cobranças${bloqueadas.length ? ` · não emitidas: ${bloqueadas.join(', ')}` : ''}`),
    }),
    emitidas: novas.length,
    notificacao: { canal: 'App + e-mail + WhatsApp', para: `${novas.length} responsáveis`, texto: `Cobranças de ${mesExtenso(competencia)} emitidas pelo Asaas: boleto, Pix e link de pagamento` },
  };
}

export function confirmarPagamentoAsaas(estado, idCobranca, idEvento, forma, agora) {
  const fin = estado.financeiro;
  const c = fin.cobrancas.find((x) => x.id === idCobranca);
  if (!c) return erroCobranca(estado, 'Cobrança não encontrada');
  if (c.eventosAsaas.includes(idEvento)) return { estado };
  if (c.status !== 'aberta') return erroCobranca(estado, 'Cobrança não está em aberto');
  const { total } = valorAtualizado(c, fin.parametros, isoDia(agora));
  return {
    estado: comFinanceiro(estado, {
      cobrancas: trocarCobranca(fin.cobrancas, idCobranca, { status: 'paga', pagaEm: agora.toISOString(), valorPago: total, forma, eventosAsaas: [...c.eventosAsaas, idEvento] }),
      saldo: fin.saldo + total,
    }),
    notificacao: { canal: 'Asaas', para: nomeResponsavel(estado, c.unidade), texto: `Pagamento recebido: ${fmtReais(total)} · recibo enviado` },
  };
}

export function baixaManual(estado, idCobranca, { data, comprovante }, perfil, agora) {
  if (!podeOperar(perfil)) return erroCobranca(estado, SO_SINDICO);
  if (!String(comprovante || '').trim()) return erroCobranca(estado, 'Anexe o comprovante');
  const fin = estado.financeiro;
  const c = fin.cobrancas.find((x) => x.id === idCobranca);
  if (!c || c.status !== 'aberta') return erroCobranca(estado, 'Cobrança não está em aberto');
  const dia = data || isoDia(agora);
  const { total } = valorAtualizado(c, fin.parametros, dia);
  return {
    estado: comFinanceiro(estado, {
      cobrancas: trocarCobranca(fin.cobrancas, idCobranca, { status: 'paga', pagaEm: agora.toISOString(), valorPago: total, forma: 'manual', baixaManual: { por: SINDICO, comprovante, em: dia } }),
      saldo: fin.saldo + total,
      auditoria: comAuditoria(estado, agora, 'Baixa manual', `Apto ${c.unidade} · ${mesExtenso(c.competencia)} · ${fmtReais(total)} · ${comprovante}`),
    }),
    notificacao: { canal: 'App', para: nomeResponsavel(estado, c.unidade), texto: `Pagamento de ${mesExtenso(c.competencia)} registrado pelo síndico` },
  };
}

export function cancelarEReemitir(estado, idCobranca, perfil, agora) {
  if (!podeOperar(perfil)) return erroCobranca(estado, SO_SINDICO);
  const fin = estado.financeiro;
  const c = fin.cobrancas.find((x) => x.id === idCobranca);
  if (!c || c.status !== 'aberta') return erroCobranca(estado, 'Cobrança não está em aberto');
  const nova = { ...c, id: `${c.id}-R${fin.cobrancas.filter((x) => x.id.startsWith(`${c.id}-R`)).length + 1}`, status: 'aberta', regua: [], eventosAsaas: [], substituiu: c.id };
  return {
    estado: comFinanceiro(estado, {
      cobrancas: [...trocarCobranca(fin.cobrancas, idCobranca, { status: 'cancelada' }), nova],
      auditoria: comAuditoria(estado, agora, 'Cancelamento e reemissão', `${c.id} substituída por ${nova.id}`),
    }),
    id: nova.id,
    notificacao: { canal: 'App + e-mail', para: nomeResponsavel(estado, c.unidade), texto: `Nova cobrança de ${mesExtenso(c.competencia)} enviada (a anterior foi cancelada)` },
  };
}

export function enviarSegundaVia(estado, idCobranca, agora) {
  const fin = estado.financeiro;
  const c = fin.cobrancas.find((x) => x.id === idCobranca);
  if (!c || c.status !== 'aberta') return erroCobranca(estado, 'Cobrança não está em aberto');
  const { total } = valorAtualizado(c, fin.parametros, isoDia(agora));
  return { estado, notificacao: { canal: 'App + WhatsApp', para: nomeResponsavel(estado, c.unidade), texto: `2ª via de ${mesExtenso(c.competencia)} com valor atualizado: ${fmtReais(total)}` } };
}

export function executarRegua(estado, agora) {
  const pendentes = pendentesDaRegua(estado, isoDia(agora), estado.plano);
  if (!pendentes.length) return { estado, resumo: [] };
  const em = agora.toISOString();
  const cobrancas = estado.financeiro.cobrancas.map((c) => {
    const p = pendentes.find((x) => x.cobranca.id === c.id);
    return p ? { ...c, regua: [...c.regua, { etapa: p.etapa.id, em }] } : c;
  });
  const unidades = new Set(pendentes.map((p) => p.cobranca.unidade)).size;
  const etapas = [...new Set(pendentes.map((p) => p.etapa.nome))].join(', ');
  return {
    estado: comFinanceiro(estado, { cobrancas, auditoria: comAuditoria(estado, agora, 'Régua executada', `${pendentes.length} avisos para ${unidades} unidades`) }),
    resumo: pendentes.map((p) => ({ unidade: p.cobranca.unidade, competencia: p.cobranca.competencia, etapa: p.etapa })),
    notificacao: { canal: 'Régua de cobrança', para: `${unidades} responsáveis`, texto: `${pendentes.length} avisos enviados: ${etapas}` },
  };
}

export function trocarPlano(estado, plano) {
  if (!PLANOS.some((p) => p.id === plano)) return erroCobranca(estado, 'Plano inexistente');
  return { estado: { ...estado, plano } };
}
```

- [ ] **Step 3: Incluir no montador e no autoteste**

Em `prototipo/montagem.mjs`, na `ORDEM`:
- logo depois de `'src/cobranca/regras.js',`, acrescente `'src/cobranca/acoes.js',`;
- logo depois de `'src/casos/cobranca-regras.js',`, acrescente `'src/casos/cobranca-acoes.js',`.

Em `src/ui/app.js`:
- acrescente `import { CASOS_COBRANCA_ACOES } from '../casos/cobranca-acoes.js';`;
- troque `...CASOS_COBRANCA_REGRAS]` por `...CASOS_COBRANCA_REGRAS, ...CASOS_COBRANCA_ACOES]`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test && npm run montar && npm run verificar`
Expected: 99 testes PASS e o autoteste com `falhas: 0`.

- [ ] **Step 5: Commit**

```bash
git add prototipo
git commit -m "feat(cobranca): ações puras (emissão, pagamento idempotente, baixa manual, reemissão, régua, plano)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Seletor de plano e painel de preços na barra

**Files:**
- Modify: `prototipo/src/ui/app.js`, `prototipo/src/ui/comum.js`, `prototipo/src/estilos.css`, `prototipo/verificar.mjs`

**Interfaces:**
- Consumes: `trocarPlano` (Task 3); `PLANOS`, `PRECO_BASE` e `mensalidade` (Task 1); `fmtReais` (Task 2).
- Produces:
  - na barra da demonstração, os botões "Básico", "Intermediário", "Avançado" e "Preços";
  - o ícone `cifrao` em `ICONES`.

- [ ] **Step 1: Checagem que falha**

Em `verificar.mjs`, acrescente ao final de `CHECAGENS`:
```js
  ['#sindico.reservas', ['Plano', 'Básico', 'Intermediário', 'Avançado', 'Preços']],
```

Run: `npm run montar && npm run verificar`
Expected: FAIL nessa linha.

- [ ] **Step 2: Implementar**

Em `src/ui/comum.js`, no objeto `ICONES`, acrescente depois de `pessoa: …,`:
```js
  cifrao: 'M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6',
```

Em `src/ui/app.js`:
1. Imports, abaixo do import de `../armazenamento.js`:
```js
import { trocarPlano } from '../cobranca/acoes.js';
import { fmtReais } from '../cobranca/regras.js';
import { PLANOS, PRECO_BASE, mensalidade } from '../planos.js';
```
2. Em `App`, logo abaixo de `const [geracao, setGeracao] = useState(0);`:
```js
  const [mostrarPrecos, setMostrarPrecos] = useState(false);
```
3. No `header`, logo depois do `</div>` que fecha o grupo "Ver como" e antes do botão "Reiniciar demonstração", acrescente:
```js
      <div class="ver-como plano" role="group" aria-label="Plano">
        <span>Plano</span>
        ${PLANOS.map((p) => html`<button type="button" key=${p.id} aria-pressed=${estado.plano === p.id} onClick=${() => executar((e) => trocarPlano(e, p.id))}>${p.nome}</button>`)}
        <button type="button" class="precos" aria-expanded=${mostrarPrecos} onClick=${() => setMostrarPrecos(!mostrarPrecos)}>Preços</button>
      </div>
```
4. Logo depois de `</header>`, acrescente:
```js
    ${mostrarPrecos && html`<${PainelPrecos} plano=${estado.plano} unidades=${estado.condominio.unidades.length} aoFechar=${() => setMostrarPrecos(false)} />`}
```
5. Acrescente, antes de `function PainelTestes()`:
```js
function PainelPrecos({ plano, unidades, aoFechar }) {
  return html`<div class="painel-precos" role="dialog" aria-label="Preços por plano">
    <div class="linha-entre"><strong>Preços para ${unidades} unidades · faixa de ${PRECO_BASE.faixa}</strong><button type="button" class="btn-link" onClick=${aoFechar}>Fechar</button></div>
    <ul class="itens-sacola">${PLANOS.map((p) => html`<li key=${p.id} class=${p.id === plano ? 'plano-atual' : ''}><span>${p.nome} · ${p.multiplicador.toFixed(1).replace('.', ',')}x</span><strong>${fmtReais(mensalidade(p.id, unidades))}/mês</strong></li>`)}</ul>
    <small class="sub">Implantação ${fmtReais(PRECO_BASE.implantacao)} · base de ${fmtReais(PRECO_BASE.porUnidade)} por unidade. As tarifas do Asaas por boleto ou Pix são do condomínio e aparecem à parte.</small>
  </div>`;
}
```

Em `src/estilos.css`, acrescente ao final:
```css
/* Fase 2: plano e preços */
.ver-como.plano button.precos { border: 1px solid var(--ardosia-suave); }
.painel-precos { position: relative; z-index: 15; display: flex; flex-direction: column; gap: 8px; max-width: 520px; margin: 12px auto 0; padding: 14px 16px; background: var(--sup); border: 1px solid var(--borda); border-radius: var(--raio); }
.painel-precos li.plano-atual { color: var(--laranja-forte); font-weight: 600; }
@media (max-width: 900px) { .barra-demo { position: static; } .painel-precos { margin: 12px 16px 0; } }
```

- [ ] **Step 3: Rodar a bateria**

Run: `npm test && npm run montar && npm run verificar && npm run e2e`
Expected: tudo verde.

- [ ] **Step 4: Commit**

```bash
git add prototipo
git commit -m "feat(planos): seletor de plano e painel de preços na barra da demonstração

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Dashboard financeiro no Início do síndico

> Antes do gráfico, carregue o skill `dataviz` e valide as duas cores das séries com `node <skill>/scripts/validate_palette.js "<receita>,<despesa>" --mode light` e `--mode dark`. Ajuste os tokens até passar e anote o resultado no commit.

**Files:**
- Create: `prototipo/src/ui/financeiro-sindico.js` (primeira parte: dashboard)
- Modify: `prototipo/src/ui/sindico.js`, `prototipo/src/estilos.css`, `prototipo/montagem.mjs`, `prototipo/verificar.mjs`

**Interfaces:**
- Consumes: regras da Task 2; `liberado`, `planoMinimo` e `mensalidade` da Task 1.
- Produces:
  - `EtqCobranca({ situacao })`, `Bloqueado({ estado, recurso, titulo })` e `PainelFinanceiro({ estado, agora })`;
  - `pendenciasCobranca(estado, hoje) → [{ chave, texto, href }]`.

- [ ] **Step 1: Checagens que falham**

Em `verificar.mjs`, acrescente ao final de `CHECAGENS`:
```js
  ['#sindico.inicio', ['Saldo em caixa', 'R$ 48.350', 'Arrecadado em', '91%', '3 de 32', 'Despesas do mês', 'Despesa superou a receita só em julho', 'Para onde foi o dinheiro', 'Devedores', 'Helena Prado', 'Emitir cobranças de', 'Operação', 'Reservas pendentes']],
```

Run: `npm run montar && npm run verificar`
Expected: FAIL nessa linha.

- [ ] **Step 2: Criar `src/ui/financeiro-sindico.js` com o dashboard**

```js
import { html, useState } from '../vendor.js';
import { ETAPAS_REGUA, CATEGORIAS_DESPESA, NOMES_FORMA, NOMES_RELACAO } from '../cobranca/dados.js';
import { fmtReais, fmtReaisCurto, mesCurto, mesExtenso, situacaoCobranca, valorAtualizado, previaCompetencia, proximaCompetencia, etapasNoPlano, devedores, indicadoresFinanceiros, serieReceitasDespesas, tituloSerie } from '../cobranca/regras.js';
import { emitirCompetencia, editarItemPrevia, baixaManual, cancelarEReemitir, enviarSegundaVia, executarRegua, salvarParametros } from '../cobranca/acoes.js';
import { lerPreco } from '../vendas/regras.js';
import { PLANOS, liberado, planoMinimo, mensalidade } from '../planos.js';
import { isoDia, nomeMes, fmtDataCurta, fmtDataHora } from '../datas.js';
import { Campo, Erro, Sucesso, Vazio, Etiqueta, QuadroIcone } from './comum.js';

const ETQ_COBRANCA = { aberta: 'info', vencida: 'perigo', paga: 'ok', cancelada: 'neutro' };
const NOMES_SITUACAO_COBRANCA = { aberta: 'Em aberto', vencida: 'Vencida', paga: 'Paga', cancelada: 'Cancelada' };

function decimal(n) {
  return String(n).replace('.', ',');
}

export function EtqCobranca({ situacao }) {
  return html`<${Etiqueta} tipo=${ETQ_COBRANCA[situacao]}>${NOMES_SITUACAO_COBRANCA[situacao]}<//>`;
}

export function Bloqueado({ estado, recurso, titulo }) {
  const minimo = planoMinimo(recurso);
  const unidades = estado.condominio.unidades.length;
  const diferenca = mensalidade(minimo.id, unidades) - mensalidade(estado.plano, unidades);
  return html`<div class="bloqueado"><strong>${titulo}</strong><span>Disponível no plano ${minimo.nome} (+${fmtReais(diferenca)}/mês)</span></div>`;
}

export function pendenciasCobranca(estado, hoje) {
  const fin = estado.financeiro;
  const proxima = proximaCompetencia(fin);
  const itens = [];
  if (!fin.emitidas.includes(proxima)) itens.push({ chave: 'emitir', texto: `Emitir cobranças de ${mesExtenso(proxima)} (fechamento dia ${fin.parametros.diaFechamento})`, href: '#sindico.cobranca.previa' });
  for (const d of devedores(estado, hoje).filter((x) => x.dias >= 60)) itens.push({ chave: `juridico-${d.unidade}`, texto: `${d.unidade}: débito há mais de 60 dias, avaliar cobrança jurídica`, href: '#sindico.cobranca.emitidas' });
  return itens;
}

// Duas séries (receitas e despesas): legenda sempre presente, rótulo direto só no mês em destaque, tabela para leitores de tela.
function GraficoReceitas({ estado, hoje }) {
  const serie = serieReceitasDespesas(estado, hoje);
  const maximo = Math.max(...serie.flatMap((m) => [m.receitas, m.despesas]));
  const altura = (valor) => `${Math.round((valor / maximo) * 140)}px`;
  return html`<section class="cartao">
    <p class="titulo-grafico">${tituloSerie(serie)}</p>
    <div class="legenda-serie" aria-hidden="true"><span class="leg-receita">Receitas</span><span class="leg-despesa">Despesas</span></div>
    <div class="barras-duplas" aria-hidden="true">
      ${serie.map((m) => {
        const destaque = m.despesas > m.receitas;
        return html`<div key=${m.mes} class=${`mes${destaque ? ' destaque' : ''}`} title=${`${mesExtenso(m.mes)}: receitas ${fmtReaisCurto(m.receitas)}, despesas ${fmtReaisCurto(m.despesas)}`}>
          <span class="valor-destaque">${destaque ? fmtReaisCurto(m.despesas) : ''}</span>
          <div class="par"><span class="b-receita" style=${`height:${altura(m.receitas)}`}></span><span class="b-despesa" style=${`height:${altura(m.despesas)}`}></span></div>
          <span class="rotulo-x">${mesCurto(m.mes)}</span>
        </div>`;
      })}
    </div>
    <table class="so-leitor">
      <caption>Receitas e despesas dos últimos 12 meses</caption>
      <thead><tr><th>Mês</th><th>Receitas</th><th>Despesas</th></tr></thead>
      <tbody>${serie.map((m) => html`<tr key=${m.mes}><td>${nomeMes(m.mes)}</td><td>${fmtReais(m.receitas)}</td><td>${fmtReais(m.despesas)}</td></tr>`)}</tbody>
    </table>
  </section>`;
}

function Categorias({ estado }) {
  const fin = estado.financeiro;
  const linhas = Object.entries(CATEGORIAS_DESPESA).map(([id, nome]) => [nome, fin.despesasMes[id]]).sort((a, b) => b[1] - a[1]);
  const maximo = linhas[0][1];
  return html`<section class="cartao">
    <p class="titulo-grafico">Para onde foi o dinheiro em ${mesExtenso(fin.vigente)}</p>
    <ul class="barras-h">${linhas.map(([nome, valor]) => html`<li key=${nome}><span>${nome}</span><span class="trilho"><span class="b-despesa" style=${`width:${Math.round((valor / maximo) * 100)}%`}></span></span><strong>${fmtReaisCurto(valor)}</strong></li>`)}</ul>
  </section>`;
}

function ListaDevedores({ estado, hoje }) {
  const lista = devedores(estado, hoje);
  return html`<section class="pilha">
    <h2>Devedores</h2>
    ${lista.length
      ? html`<div class="tabela-rolagem"><table class="tabela">
          <thead><tr><th>Unidade</th><th>Responsável</th><th>Cobranças</th><th>Valor atualizado</th><th>Atraso</th><th>Etapa da régua</th></tr></thead>
          <tbody>${lista.map((d) => html`<tr key=${d.unidade}><td>${d.unidade}</td><td>${d.responsavel ? d.responsavel.nome : '—'}</td><td>${d.cobrancas}</td><td>${fmtReais(d.valor)}</td><td>${d.dias} dias</td><td>${d.etapa ? d.etapa.nome : '—'}</td></tr>`)}</tbody>
        </table></div>`
      : html`<${Vazio} texto="Nenhuma unidade em atraso." />`}
    <small class="sub">Lista visível só para quem tem acesso financeiro. Nunca aparece para os moradores.</small>
  </section>`;
}

function OrcadoRealizado({ estado }) {
  const fin = estado.financeiro;
  return html`<section class="pilha">
    <h2>Orçado × realizado em ${mesExtenso(fin.vigente)}</h2>
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Categoria</th><th>Orçado</th><th>Realizado</th><th>Desvio</th><th>%</th></tr></thead>
      <tbody>${Object.entries(CATEGORIAS_DESPESA).map(([id, nome]) => {
        const orcado = fin.orcamento[id];
        const realizado = fin.despesasMes[id];
        const desvio = realizado - orcado;
        const pct = Math.round((desvio / orcado) * 1000) / 10;
        const sinal = desvio > 0 ? '+' : '';
        return html`<tr key=${id}><td>${nome}</td><td>${fmtReais(orcado)}</td><td>${fmtReais(realizado)}</td><td class=${desvio > 0 ? 'desvio-ruim' : ''}>${sinal}${fmtReais(desvio)}</td><td>${sinal}${decimal(pct)}%</td></tr>`;
      })}</tbody>
    </table></div>
  </section>`;
}

export function PainelFinanceiro({ estado, agora }) {
  const hoje = isoDia(agora);
  const ind = indicadoresFinanceiros(estado, hoje);
  const completo = liberado(estado.plano, 'dashboardCompleto');
  const a = ind.arrecadado;
  const numeros = [
    ['Saldo em caixa', fmtReaisCurto(ind.saldo.valor), 'Conta Asaas + banco', ind.saldo.alerta, 'cifrao'],
    [`Arrecadado em ${mesExtenso(a.competencia)}`, `${a.pct}%`, `${fmtReaisCurto(a.recebido)} de ${fmtReaisCurto(a.previsto)}${a.proxima ? ` · ${mesExtenso(a.proxima.competencia)}: ${a.proxima.pagas} de ${a.proxima.total} pagas` : ''}`, a.alerta, 'grafico'],
    ['Inadimplência', `${ind.inadimplencia.unidades} de ${ind.inadimplencia.total}`, `${decimal(ind.inadimplencia.pct)}% das unidades · ${fmtReaisCurto(ind.inadimplencia.valor)}`, ind.inadimplencia.alerta, 'pessoa'],
  ];
  if (completo) numeros.push(['Despesas do mês', fmtReaisCurto(ind.despesas.valor), `${ind.despesas.desvio > 0 ? '+' : ''}${decimal(ind.despesas.desvio)}% em relação ao orçado`, ind.despesas.alerta, 'documento']);
  return html`<div class="pilha">
    <div class="indicadores">
      ${numeros.map(([rotulo, valor, detalhe, alerta, icone]) => html`<div key=${rotulo} class=${`indicador ${alerta ? 'ind-perigo' : 'ind-ok'}`}><${QuadroIcone} nome=${icone} cheio=${alerta} /><span class="ind-rotulo">${rotulo}</span><strong>${valor}</strong><small>${detalhe}</small></div>`)}
    </div>
    ${completo
      ? html`<div class="graficos-fin"><${GraficoReceitas} estado=${estado} hoje=${hoje} /><${Categorias} estado=${estado} /></div><${ListaDevedores} estado=${estado} hoje=${hoje} />`
      : html`<${Bloqueado} estado=${estado} recurso="dashboardCompleto" titulo="Despesas do mês, receitas × despesas em 12 meses, para onde foi o dinheiro e lista de devedores" />`}
    ${liberado(estado.plano, 'orcadoRealizado')
      ? html`<${OrcadoRealizado} estado=${estado} />`
      : completo && html`<${Bloqueado} estado=${estado} recurso="orcadoRealizado" titulo="Orçado × realizado por categoria" />`}
  </div>`;
}
```

Os imports que este arquivo ainda não usa (ações, `NOMES_FORMA`, `useState` etc.) entram na Task 6. O montador remove os imports locais e o `node --check` não reclama de imports sem uso.

- [ ] **Step 3: Ligar no `sindico.js`**

Rode em `prototipo/`:
```bash
node - <<'EOF'
const fs = require('fs');
const arquivo = 'src/ui/sindico.js';
let s = fs.readFileSync(arquivo, 'utf8');
const pares = [
  ["import { nomeVizinho, fmtCentavos } from '../vendas/regras.js';", "import { nomeVizinho, fmtCentavos } from '../vendas/regras.js';\nimport { PainelFinanceiro, pendenciasCobranca } from './financeiro-sindico.js';"],
  ["  const vendedoresPendentes = estado.pessoas.filter((p) => p.vendedor === 'pendente');\n  const pct", "  const vendedoresPendentes = estado.pessoas.filter((p) => p.vendedor === 'pendente');\n  const pendCobranca = pendenciasCobranca(estado, isoDia(agora));\n  const pct"],
  ['!alertas.length && !vendedoresPendentes.length;', '!alertas.length && !vendedoresPendentes.length && !pendCobranca.length;'],
  [`    <h1>Olá, Roberto</h1>
    <div class="indicadores">`, `    <h1>Olá, Roberto</h1>
    <\${PainelFinanceiro} estado=\${estado} agora=\${agora} />
    <h2>Precisa da sua atenção</h2>
    \${semPendencias
      ? html\`<\${Vazio} texto="Nada pendente. Bom trabalho!" />\`
      : html\`<ul class="atencao">
          \${pendCobranca.map((p) => html\`<li key=\${p.chave}><a href=\${p.href}>\${p.texto}</a></li>\`)}
          \${pendentes.map((r) => html\`<li key=\${r.id}><a href="#sindico.reservas">Aprovar reserva: \${areaPorId(estado, r.areaId).nome}, apto \${r.unidade}, \${fmtDia(r.data)}</a></li>\`)}
          \${vencidas.map((o) => html\`<li key=\${o.id}><a href=\${\`#sindico.ocorrencias.\${o.id}\`}>Prazo vencido: \${o.id} · \${CATEGORIAS[o.categoria].nome}</a></li>\`)}
          \${paradas.map((e) => html\`<li key=\${e.id}><a href="#sindico.encomendas">Encomenda parada: apto \${e.unidade}, chegou \${haQuanto(e.chegadaEm, agora)}</a></li>\`)}
          \${alertas.map((a) => html\`<li key=\${a.documento.id}><a href="#sindico.documentos">\${textoAlerta(a)}: \${a.documento.titulo}</a></li>\`)}
          \${vendedoresPendentes.map((p) => html\`<li key=\${\`v\${p.unidade}\`}><a href="#sindico.vendas">Aprovar vendedor: \${p.nome}, apto \${p.unidade}</a></li>\`)}
        </ul>\`}
    <h2>Operação</h2>
    <div class="indicadores">`],
];
for (const [de, para] of pares) {
  if (!s.includes(de)) throw new Error('não achei ' + de.slice(0, 60));
  s = s.replace(de, para);
}
// Remove o bloco antigo de "Precisa da sua atenção" que vinha depois da adesão.
const inicio = s.indexOf('    <h2>Precisa da sua atenção</h2>', s.indexOf('<h2>Operação</h2>'));
const fim = s.indexOf('        </ul>`}\n', inicio) + '        </ul>`}\n'.length;
if (inicio < 0 || fim < inicio) throw new Error('bloco antigo não encontrado');
s = s.slice(0, inicio) + s.slice(fim);
fs.writeFileSync(arquivo, s);
console.log('ok');
EOF
```

Em `prototipo/montagem.mjs`, acrescente `'src/ui/financeiro-sindico.js',` na `ORDEM`, logo antes de `'src/ui/sindico.js',`.

- [ ] **Step 4: Estilos**

Em `src/estilos.css`, acrescente os tokens das séries no bloco `:root` (logo depois de `--horizonte: …;`):
```css
  --serie-receita: #7d8ca0;
  --serie-despesa: #d9692a;
```
Acrescente nos dois blocos escuros (o de `@media` e o de `[data-theme="dark"]`), logo depois de `--horizonte: #00000040;`:
```css
    --serie-receita: #8fa0b5; --serie-despesa: #f59a5a;
```
Acrescente ao final do arquivo:
```css
/* Fase 2: dashboard */
.bloqueado { display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; border: 1px dashed var(--borda); border-radius: var(--raio); background: var(--sup-2); }
.bloqueado span { color: var(--laranja-forte); font-weight: 600; }
.graficos-fin { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 12px; }
.titulo-grafico { margin: 0; font-weight: 600; color: var(--titulo); }
.legenda-serie { display: flex; gap: 14px; font-size: 12.5px; color: var(--texto); }
.legenda-serie span { display: inline-flex; align-items: center; gap: 6px; }
.legenda-serie span::before { content: ""; width: 10px; height: 10px; border-radius: 2px; }
.legenda-serie .leg-receita::before { background: var(--serie-receita); }
.legenda-serie .leg-despesa::before { background: var(--serie-despesa); }
.barras-duplas { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 4px; align-items: end; }
.barras-duplas .mes { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
.barras-duplas .par { display: flex; align-items: flex-end; gap: 2px; height: 140px; }
.barras-duplas .par span { width: 9px; border-radius: 3px 3px 0 0; }
.barras-duplas .valor-destaque { min-height: 14px; font-size: 10.5px; font-weight: 600; color: var(--titulo); white-space: nowrap; }
.barras-duplas .rotulo-x { width: 100%; padding-top: 4px; border-top: 1px solid var(--borda); font-size: 10.5px; text-align: center; color: var(--suave); }
.b-receita { background: var(--serie-receita); }
.b-despesa { background: var(--serie-despesa); }
.barras-duplas .mes.destaque .rotulo-x { color: var(--titulo); font-weight: 700; }
.barras-h { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.barras-h li { display: grid; grid-template-columns: 112px minmax(0, 1fr) auto; align-items: center; gap: 8px; font-size: 13px; font-variant-numeric: tabular-nums; }
.barras-h .trilho { height: 10px; background: var(--neutro-bg); border-radius: 2px; overflow: hidden; }
.barras-h .trilho span { display: block; height: 100%; border-radius: 2px; }
.desvio-ruim { color: var(--perigo); font-weight: 600; }
@media (max-width: 900px) { .graficos-fin { grid-template-columns: 1fr; } }
```

- [ ] **Step 5: Validar a paleta e rodar a bateria**

Run: `node "<pasta do skill dataviz>/scripts/validate_palette.js" "#7d8ca0,#d9692a" --mode light` e o mesmo com `"#8fa0b5,#f59a5a" --mode dark`.
Expected: sem FAIL. Se falhar, ajuste os tokens e rode de novo.

Run: `npm test && npm run montar && npm run verificar && npm run e2e`
Expected: tudo verde.

- [ ] **Step 6: Commit**

```bash
git add prototipo
git commit -m "feat(cobranca): dashboard financeiro no Início do síndico

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Menu Cobrança do síndico (prévia, emitidas, régua, parâmetros)

**Files:**
- Modify: `prototipo/src/ui/financeiro-sindico.js`, `prototipo/src/ui/sindico.js`, `prototipo/src/estilos.css`, `prototipo/verificar.mjs`

**Interfaces:**
- Consumes: ações da Task 3; componentes da Task 5.
- Produces:
  - `SCobranca(props)` nas rotas `#sindico.cobranca[.previa|.emitidas|.regua|.parametros]`;
  - atributos usados no e2e: `[data-acao="emitir"]`, `[data-acao="executar-regua"]`, `[data-cobranca="<id>"]`, rótulo "Competência", botões "Baixa manual", "Anexar comprovante" e "Confirmar baixa", texto "Baixa registrada.".

- [ ] **Step 1: Checagens que falham**

Em `verificar.mjs`, acrescente ao final de `CHECAGENS`:
```js
  ['#sindico.cobranca', ['Conta Asaas ativa', 'Prévia e emissão', 'Sem responsável financeiro: não será emitida', 'R$ 865,00', 'R$ 1.228,00', 'R$ 1.015,00', 'Emitir 31 cobranças']],
  ['#sindico.cobranca.emitidas', ['Competência', 'Vencida', 'Auditoria']],
  ['#sindico.cobranca.regua', ['30 dias após', 'Disponível no Avançado', 'Executar a régua de hoje']],
  ['#sindico.cobranca.parametros', ['Multa por atraso (%)', 'Composição da taxa', 'Pintura da fachada']],
```

Run: `npm run montar && npm run verificar`
Expected: FAIL nessas linhas.

- [ ] **Step 2: Acrescentar as telas a `financeiro-sindico.js`**

Acrescente ao final de `src/ui/financeiro-sindico.js`:
```js
const ABAS_COBRANCA = [['previa', 'Prévia e emissão'], ['emitidas', 'Cobranças emitidas'], ['regua', 'Régua'], ['parametros', 'Parâmetros']];
const FILTROS_COBRANCA = [['todas', 'Todas'], ['aberta', 'Em aberto'], ['vencida', 'Vencidas'], ['paga', 'Pagas'], ['cancelada', 'Canceladas']];

export function SCobranca(props) {
  const aba = ABAS_COBRANCA.some(([id]) => id === props.rota.id) ? props.rota.id : 'previa';
  const Conteudo = { previa: CPrevia, emitidas: CEmitidas, regua: CRegua, parametros: CParametros }[aba];
  return html`<section>
    <h1>Cobrança</h1>
    <p class="faixa-asaas">Conta Asaas ativa · subconta do condomínio. O dinheiro cai direto na conta do condomínio; o CondoFácil só organiza emissão, baixa e relatórios.</p>
    <nav class="chips" aria-label="Cobrança">${ABAS_COBRANCA.map(([id, nome]) => html`<a key=${id} class="chip" href=${`#sindico.cobranca.${id}`} aria-current=${aba === id ? 'page' : undefined}>${nome}</a>`)}</nav>
    <${Conteudo} ...${props} />
  </section>`;
}

function EditorComposicao({ linha, competencia, executar }) {
  const [itens, setItens] = useState(linha.itens.map((i) => ({ ...i, texto: (i.valor / 100).toFixed(2).replace('.', ',') })));
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [mensagem, setMensagem] = useState(null);
  const [erro, setErro] = useState(null);

  function salvar(lista) {
    const r = executar((e) => editarItemPrevia(e, competencia, linha.unidade, lista.map((i) => ({ tipo: i.tipo, descricao: i.descricao, valor: lerPreco(i.texto) }))));
    setErro(r.erro || null);
    setMensagem(r.erro ? null : 'Composição atualizada.');
    if (!r.erro) setItens(lista);
  }

  function incluir() {
    salvar([...itens, { tipo: 'avulso', descricao, texto: valor }]);
    setDescricao('');
    setValor('');
  }

  return html`<div class="pilha">
    <ul class="itens-sacola">${itens.map((i, n) => html`<li key=${`${n}-${i.descricao}`}>
      <span>${i.descricao}</span>
      <input id=${`valor-${linha.unidade}-${n}`} class="valor-item" aria-label=${`Valor de ${i.descricao}`} inputmode="decimal" value=${i.texto} onInput=${(ev) => setItens(itens.map((x, k) => (k === n ? { ...x, texto: ev.target.value } : x)))} />
      ${i.tipo !== 'ordinaria' && html`<button type="button" class="btn-link" onClick=${() => salvar(itens.filter((_, k) => k !== n))}>Remover</button>`}
    </li>`)}</ul>
    <div class="edicao-anuncio">
      <${Campo} rotulo="Novo item"><input id=${`novo-item-${linha.unidade}`} value=${descricao} onInput=${(ev) => setDescricao(ev.target.value)} placeholder="Ex.: Multa por infração" /><//>
      <${Campo} rotulo="Valor (R$)"><input id=${`novo-valor-${linha.unidade}`} inputmode="decimal" value=${valor} onInput=${(ev) => setValor(ev.target.value)} placeholder="Ex.: 120,00" /><//>
    </div>
    <div class="acoes">
      <button type="button" class="btn secundario" onClick=${incluir}>Incluir item</button>
      <button type="button" class="btn primario" onClick=${() => salvar(itens)}>Salvar composição</button>
    </div>
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
  </div>`;
}

function CPrevia({ estado, executar }) {
  const fin = estado.financeiro;
  const competencia = proximaCompetencia(fin);
  const previa = previaCompetencia(estado, competencia);
  const emitida = fin.emitidas.includes(competencia);
  const [aberta, setAberta] = useState(null);
  const [erro, setErro] = useState(null);
  const emitiveis = previa.linhas.filter((l) => !l.bloqueada);
  const total = emitiveis.reduce((soma, l) => soma + l.total, 0);

  function emitir() {
    const r = executar((e) => emitirCompetencia(e, competencia, 'sindico', new Date()));
    setErro(r.erro || null);
  }

  return html`<div class="pilha">
    <h2>Competência de ${mesExtenso(competencia)} · vencimento ${fmtDataCurta(previa.vencimento)}</h2>
    ${emitida
      ? html`<p class="sucesso">Cobranças de ${mesExtenso(competencia)} emitidas. Acompanhe em Cobranças emitidas.</p>`
      : html`<p class="sub">Revise a composição antes de emitir. Cobrança emitida não é editada: alterações viram cancelamento e reemissão.</p>`}
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Unidade</th><th>Responsável financeiro</th><th>Total</th><th>Composição</th></tr></thead>
      <tbody>${previa.linhas.map((l) => [
        html`<tr key=${l.unidade} class=${l.bloqueada ? 'linha-bloqueada' : ''}>
          <td>${l.unidade}</td>
          <td>${l.bloqueada ? html`<strong class="texto-perigo">Sem responsável financeiro: não será emitida</strong>` : `${l.responsavel.nome} (${NOMES_RELACAO[l.responsavel.relacao]})`}</td>
          <td>${fmtReais(l.total)}</td>
          <td><button type="button" class="btn-link" onClick=${() => setAberta(aberta === l.unidade ? null : l.unidade)}>${aberta === l.unidade ? 'Fechar' : 'Ver composição'}</button></td>
        </tr>`,
        aberta === l.unidade && html`<tr key=${`${l.unidade}-composicao`}><td colspan="4">${emitida
          ? html`<ul class="itens-sacola">${l.itens.map((i, n) => html`<li key=${n}><span>${i.descricao}</span><span>${fmtReais(i.valor)}</span></li>`)}</ul>`
          : html`<${EditorComposicao} key=${l.unidade} linha=${l} competencia=${competencia} executar=${executar} />`}</td></tr>`,
      ])}</tbody>
    </table></div>
    <div class="linha-entre total"><span>${emitiveis.length} cobranças · ${previa.linhas.length - emitiveis.length} não emitida(s)</span><strong>${fmtReais(total)}</strong></div>
    <${Erro} texto=${erro} />
    ${!emitida && html`<button type="button" class="btn primario" data-acao="emitir" onClick=${emitir}>Emitir ${emitiveis.length} cobranças</button>`}
  </div>`;
}

function DetalheCobranca({ estado, cobranca, executar, hoje, aoFechar }) {
  const fin = estado.financeiro;
  const [comprovante, setComprovante] = useState('');
  const [data, setData] = useState(hoje);
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const situacao = situacaoCobranca(cobranca, hoje);
  const v = valorAtualizado(cobranca, fin.parametros, hoje);
  const responsavel = fin.unidades[cobranca.unidade].responsavel;

  function rodar(acao, sucesso) {
    const r = executar(acao);
    setErro(r.erro || null);
    if (!r.erro) {
      setMensagem(sucesso);
      setBaixando(false);
    }
  }

  return html`<article class="cartao">
    <div class="linha-entre"><strong>Apto ${cobranca.unidade} · ${nomeMes(cobranca.competencia)}</strong><${EtqCobranca} situacao=${situacao} /></div>
    <small class="sub">${responsavel ? `${responsavel.nome} · ${responsavel.documento}` : 'Sem responsável'} · vencimento ${fmtDataCurta(cobranca.vencimento)}${cobranca.substituiu ? ` · substitui ${cobranca.substituiu}` : ''}</small>
    <ul class="itens-sacola">
      ${cobranca.itens.map((i, n) => html`<li key=${n}><span>${i.descricao}</span><span>${fmtReais(i.valor)}</span></li>`)}
      ${v.dias > 0 && html`<li><span>Multa (${decimal(fin.parametros.multaPct)}%) e juros (${v.dias} dias)</span><span>${fmtReais(v.multa + v.juros)}</span></li>`}
    </ul>
    <div class="linha-entre total"><span>${situacao === 'paga' ? `Pago em ${fmtDataHora(cobranca.pagaEm)} · ${NOMES_FORMA[cobranca.forma]}` : 'Valor atualizado'}</span><strong>${fmtReais(situacao === 'paga' ? cobranca.valorPago : v.total)}</strong></div>
    ${cobranca.baixaManual && html`<small class="sub">Baixa manual por ${cobranca.baixaManual.por} · ${cobranca.baixaManual.comprovante}</small>`}
    ${cobranca.regua.length > 0 && html`<small class="sub">Régua enviada: ${cobranca.regua.map((r) => ETAPAS_REGUA.find((e) => e.id === r.etapa).nome).join(' · ')}</small>`}
    ${['aberta', 'vencida'].includes(situacao) && html`<div class="acoes">
      <button type="button" class="btn secundario" onClick=${() => setBaixando(!baixando)}>Baixa manual</button>
      <button type="button" class="btn secundario" onClick=${() => rodar((e) => cancelarEReemitir(e, cobranca.id, 'sindico', new Date()), 'Cobrança cancelada e reemitida.')}>Cancelar e reemitir</button>
      <button type="button" class="btn secundario" onClick=${() => rodar((e) => enviarSegundaVia(e, cobranca.id, new Date()), '2ª via enviada com valor atualizado.')}>Enviar 2ª via</button>
    </div>`}
    ${baixando && html`<div class="recusa">
      <${Campo} rotulo="Data do pagamento"><input id="baixa-data" type="date" value=${data} onInput=${(ev) => setData(ev.target.value)} /><//>
      <button type="button" class="btn secundario" onClick=${() => setComprovante(`comprovante-${cobranca.unidade}.pdf`)}>${comprovante ? `Anexado: ${comprovante}` : 'Anexar comprovante'}</button>
      <button type="button" class="btn primario" onClick=${() => rodar((e) => baixaManual(e, cobranca.id, { data, comprovante }, 'sindico', new Date()), 'Baixa registrada.')}>Confirmar baixa</button>
    </div>`}
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
    <button type="button" class="btn-link" onClick=${aoFechar}>Fechar detalhes</button>
  </article>`;
}

function CEmitidas({ estado, executar, agora }) {
  const fin = estado.financeiro;
  const hoje = isoDia(agora);
  const competencias = [...new Set(fin.cobrancas.map((c) => c.competencia))].sort().reverse();
  const [competencia, setCompetencia] = useState(competencias[0]);
  const [filtro, setFiltro] = useState('todas');
  const [aberta, setAberta] = useState(null);
  const lista = fin.cobrancas
    .filter((c) => c.competencia === competencia && (filtro === 'todas' || situacaoCobranca(c, hoje) === filtro))
    .sort((a, b) => a.unidade.localeCompare(b.unidade) || a.id.localeCompare(b.id));
  const selecionada = aberta ? fin.cobrancas.find((c) => c.id === aberta) : null;
  return html`<div class="pilha">
    <div class="edicao-anuncio">
      <${Campo} rotulo="Competência"><select id="emitidas-competencia" value=${competencia} onChange=${(ev) => { setCompetencia(ev.target.value); setAberta(null); }}>${competencias.map((c) => html`<option key=${c} value=${c}>${nomeMes(c)}</option>`)}</select><//>
      <${Campo} rotulo="Situação"><select id="emitidas-situacao" value=${filtro} onChange=${(ev) => setFiltro(ev.target.value)}>${FILTROS_COBRANCA.map(([id, nome]) => html`<option key=${id} value=${id}>${nome}</option>`)}</select><//>
    </div>
    ${selecionada && html`<${DetalheCobranca} key=${selecionada.id} estado=${estado} cobranca=${selecionada} executar=${executar} hoje=${hoje} aoFechar=${() => setAberta(null)} />`}
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Unidade</th><th>Valor</th><th>Atualizado</th><th>Situação</th><th>Ação</th></tr></thead>
      <tbody>${lista.map((c) => html`<tr key=${c.id}>
        <td>${c.unidade}</td>
        <td>${fmtReais(c.valor)}</td>
        <td>${fmtReais(valorAtualizado(c, fin.parametros, hoje).total)}</td>
        <td><${EtqCobranca} situacao=${situacaoCobranca(c, hoje)} /></td>
        <td><button type="button" class="btn-link" data-cobranca=${c.id} onClick=${() => setAberta(c.id)}>Detalhes</button></td>
      </tr>`)}</tbody>
    </table></div>
    ${!lista.length && html`<${Vazio} texto="Nenhuma cobrança neste filtro." />`}
    <h2>Auditoria</h2>
    ${fin.auditoria.length
      ? html`<ul class="auditoria">${[...fin.auditoria].reverse().map((a, n) => html`<li key=${n}><span class="lt-quando">${fmtDataHora(a.em)}</span> <strong>${a.acao}</strong> · ${a.detalhe} · ${a.quem}</li>`)}</ul>`
      : html`<${Vazio} texto="Nenhuma ação registrada nesta demonstração." />`}
  </div>`;
}

function CRegua({ estado, executar }) {
  const permitidas = etapasNoPlano(estado.plano);
  const [resumo, setResumo] = useState(null);

  function executarHoje() {
    const r = executar((e) => executarRegua(e, new Date()));
    setResumo(r.resumo || []);
  }

  return html`<div class="pilha">
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Quando</th><th>Ação automática</th><th>Canais</th><th>No seu plano</th></tr></thead>
      <tbody>${ETAPAS_REGUA.map((e) => html`<tr key=${e.id}>
        <td>${e.nome}</td>
        <td>${e.acao}</td>
        <td>${e.canais.join(' + ')}</td>
        <td>${permitidas.includes(e.id) ? html`<${Etiqueta} tipo="ok">Ativa<//>` : html`<${Etiqueta}>Disponível no ${PLANOS.find((p) => etapasNoPlano(p.id).includes(e.id)).nome}<//>`}</td>
      </tr>`)}</tbody>
    </table></div>
    <small class="sub">A régua para sozinha quando a cobrança é paga.</small>
    <button type="button" class="btn primario" data-acao="executar-regua" onClick=${executarHoje}>Executar a régua de hoje</button>
    ${resumo && (resumo.length
      ? html`<div class="cartao"><strong>${resumo.length} avisos enviados</strong><ul class="itens-sacola">${resumo.map((r, n) => html`<li key=${n}><span>Apto ${r.unidade} · ${nomeMes(r.competencia)}</span><span>${r.etapa.nome}</span></li>`)}</ul></div>`
      : html`<p class="sucesso">Nenhum aviso pendente hoje.</p>`)}
  </div>`;
}

function CParametros({ estado, executar }) {
  const fin = estado.financeiro;
  const [form, setForm] = useState({ ...fin.parametros, formas: [...fin.parametros.formas] });
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const completa = liberado(estado.plano, 'composicaoCompleta');
  const c = fin.composicao;
  const campo = (chave) => (ev) => setForm({ ...form, [chave]: ev.target.type === 'number' ? Number(ev.target.value) : ev.target.value });
  const alternarForma = (k) => setForm({ ...form, formas: form.formas.includes(k) ? form.formas.filter((x) => x !== k) : [...form.formas, k] });

  function salvar() {
    const r = executar((e) => salvarParametros(e, form, 'sindico', new Date()));
    setErro(r.erro || null);
    setMensagem(r.erro ? null : 'Parâmetros salvos.');
  }

  return html`<div class="pilha formulario">
    <h2>Parâmetros de cobrança</h2>
    <div class="edicao-anuncio">
      <${Campo} rotulo="Dia do vencimento"><input id="par-vencimento" type="number" min="1" max="28" value=${form.diaVencimento} onInput=${campo('diaVencimento')} /><//>
      <${Campo} rotulo="Dia do fechamento"><input id="par-fechamento" type="number" min="1" max="28" value=${form.diaFechamento} onInput=${campo('diaFechamento')} /><//>
      <${Campo} rotulo="Multa por atraso (%)" dica="Máximo de 2%"><input id="par-multa" type="number" step="0.1" min="0" value=${form.multaPct} onInput=${campo('multaPct')} /><//>
      <${Campo} rotulo="Juros ao mês (%)"><input id="par-juros" type="number" step="0.1" min="0" value=${form.jurosPct} onInput=${campo('jurosPct')} /><//>
      <${Campo} rotulo="Desconto de pontualidade (%)"><input id="par-desconto" type="number" step="0.5" min="0" value=${form.descontoPct} onInput=${campo('descontoPct')} /><//>
      <${Campo} rotulo="Desconto aprovado em" dica="Ata ou cláusula da convenção"><input id="par-desconto-ata" value=${form.descontoAprovadoEm} onInput=${campo('descontoAprovadoEm')} placeholder="Ex.: AGO de 28/03/2026, item 4" /><//>
    </div>
    <fieldset><legend>Formas aceitas</legend>
      ${[['boleto', 'Boleto'], ['pix', 'Pix'], ['cartao', 'Cartão']].map(([k, nome]) => html`<label key=${k} class="check"><input id=${`par-forma-${k}`} type="checkbox" checked=${form.formas.includes(k)} onChange=${() => alternarForma(k)} /><span>${nome}</span></label>`)}
    </fieldset>
    <${Campo} rotulo="Tarifa do Asaas"><select id="par-tarifa" value=${form.tarifa} onChange=${campo('tarifa')}><option value="condominio">Absorvida pelo condomínio</option><option value="despesa">Registrada como despesa bancária</option></select><//>
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
    <button type="button" class="btn primario" onClick=${salvar}>Salvar parâmetros</button>
    <h2>Composição da taxa</h2>
    <dl class="resumo">
      <dt>${completa ? 'Ordinária · apto tipo A' : 'Valor fixo · apto tipo A'}</dt><dd>${fmtReais(c.ordinaria.A)}</dd>
      <dt>${completa ? 'Ordinária · cobertura' : 'Valor fixo · cobertura'}</dt><dd>${fmtReais(c.ordinaria.cobertura)}</dd>
      ${completa && html`<dt>Fundo de reserva</dt><dd>${c.fundoPct}% da ordinária</dd>`}
      ${completa && html`<dt>Taxa extra</dt><dd>${c.extra.descricao}: ${fmtReais(c.extra.total)} em ${c.extra.parcelas}x (${fmtReais(Math.round(c.extra.total / c.extra.parcelas / c.extra.unidades))} por unidade)</dd>`}
    </dl>
    ${!completa && html`<${Bloqueado} estado=${estado} recurso="composicaoCompleta" titulo="Fundo de reserva e taxa extra parcelada" />`}
  </div>`;
}
```

- [ ] **Step 3: Ligar o menu no `sindico.js`**

Rode em `prototipo/`:
```bash
node - <<'EOF'
const fs = require('fs');
const arquivo = 'src/ui/sindico.js';
let s = fs.readFileSync(arquivo, 'utf8');
const pares = [
  ["import { PainelFinanceiro, pendenciasCobranca } from './financeiro-sindico.js';", "import { PainelFinanceiro, pendenciasCobranca, SCobranca } from './financeiro-sindico.js';"],
  ["const MENU_SINDICO = [['inicio', 'Início', 'grafico'], ", "const MENU_SINDICO = [['inicio', 'Início', 'grafico'], ['cobranca', 'Cobrança', 'cifrao'], "],
  ['vendas: SVendas }[tela];', 'vendas: SVendas, cobranca: SCobranca }[tela];'],
  ["${MENU_SINDICO.map(([id, nome, icone]) => html`<a key=${id} href=${`#sindico.${id}`} class=${id === tela ? 'ativa' : ''} aria-current=${id === tela ? 'page' : undefined}><${Icone} nome=${icone} tamanho=${20} />${nome}</a>`)}", "${MENU_SINDICO.map(([id, nome, icone]) => html`<a key=${id} href=${`#sindico.${id}`} class=${id === tela ? 'ativa' : ''} aria-current=${id === tela ? 'page' : undefined}><${Icone} nome=${icone} tamanho=${20} />${nome}</a>`)}\n      ${EM_BREVE.map((nome) => html`<span key=${nome} class=\"em-breve\" aria-disabled=\"true\">${nome}<small>Em breve · Intermediário</small></span>`)}"],
];
for (const [de, para] of pares) {
  if (!s.includes(de)) throw new Error('não achei ' + de.slice(0, 60));
  s = s.replace(de, para);
}
s = s.replace("const MOTIVOS_RECUSA", "const EM_BREVE = ['Acordos', 'Notificações e OS', 'Zelador', 'Escala de porteiros'];\nconst MOTIVOS_RECUSA");
fs.writeFileSync(arquivo, s);
console.log('ok');
EOF
```

- [ ] **Step 4: Estilos**

Acrescente ao final de `src/estilos.css`:
```css
/* Fase 2: cobrança */
.faixa-asaas { margin: 0; padding: 10px 14px; border-left: 3px solid var(--ok); background: var(--ok-bg); color: var(--ok); font-weight: 600; border-radius: var(--raio); }
.chip { text-decoration: none; display: inline-flex; align-items: center; }
.chip[aria-current="page"] { background: var(--laranja-forte); color: var(--sobre-laranja); border-color: var(--laranja-forte); }
.linha-bloqueada td { background: var(--perigo-bg); }
.texto-perigo { color: var(--perigo); }
.valor-item { width: 96px; padding: 6px 8px; border: 1px solid var(--borda); border-radius: var(--raio); background: var(--sup); text-align: right; font-variant-numeric: tabular-nums; }
.auditoria { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; font-size: 13.5px; }
.em-breve { display: flex; flex-direction: column; padding: 8px 20px; color: var(--suave); font-size: 12.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; }
.em-breve small { font-size: 11px; font-weight: 400; text-transform: none; letter-spacing: 0; }
@media (max-width: 900px) { .em-breve { display: none; } }
```

- [ ] **Step 5: Rodar a bateria**

Run: `npm test && npm run montar && npm run verificar && npm run e2e`
Expected: tudo verde.

- [ ] **Step 6: Commit**

```bash
git add prototipo
git commit -m "feat(cobranca): menu Cobrança do síndico (prévia, emitidas, régua, parâmetros) e itens em breve

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Financeiro do morador

**Files:**
- Create: `prototipo/src/ui/financeiro-morador.js`
- Modify: `prototipo/src/ui/morador.js`, `prototipo/src/estilos.css`, `prototipo/montagem.mjs`, `prototipo/verificar.mjs`

**Interfaces:**
- Consumes:
  - `confirmarPagamentoAsaas` (Task 3);
  - regras da Task 2;
  - `EtqCobranca` (Task 5);
  - `pessoaDaUnidade` de `vendas/regras.js`.
- Produces:
  - `MFinanceiro({ estado, eu, executar, agora })` e `CartaoCobrancaInicio({ estado, eu, agora })`;
  - rota `#morador.financeiro`;
  - textos usados no e2e: botão "Pagar com Pix", rótulo "Pix copia e cola", botão "Simular confirmação do Asaas", "Nenhuma cobrança em aberto", "Sua cobrança de", "vão para o responsável financeiro" e "Carlos A. (proprietário)".

- [ ] **Step 1: Checagens que falham**

Em `verificar.mjs`, acrescente ao final de `CHECAGENS`:
```js
  ['#morador.inicio', ['Financeiro em dia', 'Avisos']],
  ['#morador.financeiro', ['Responsável financeiro: Ana Souza', 'Histórico', 'Ver recibo', 'Declaração de quitação']],
  ['#morador.mais', ['Avisos']],
```

Run: `npm run montar && npm run verificar`
Expected: FAIL nessas linhas.

- [ ] **Step 2: Criar `src/ui/financeiro-morador.js`**

```js
import { html, useState } from '../vendor.js';
import { NOMES_FORMA, NOMES_RELACAO } from '../cobranca/dados.js';
import { fmtReais, mesExtenso, situacaoCobranca, valorAtualizado } from '../cobranca/regras.js';
import { confirmarPagamentoAsaas } from '../cobranca/acoes.js';
import { pessoaDaUnidade } from '../vendas/regras.js';
import { isoDia, nomeMes, fmtDataCurta } from '../datas.js';
import { Sucesso, Vazio, QrFalso, PrevDoc } from './comum.js';
import { EtqCobranca } from './financeiro-sindico.js';

function responsavelDaPessoa(estado, eu) {
  const responsavel = estado.financeiro.unidades[eu].responsavel;
  const pessoa = pessoaDaUnidade(estado, eu);
  return { responsavel, souResponsavel: !!responsavel && !!pessoa && responsavel.nome === pessoa.nome };
}

function cobrancasDaUnidade(estado, eu) {
  const minhas = estado.financeiro.cobrancas.filter((c) => c.unidade === eu);
  return {
    abertas: minhas.filter((c) => c.status === 'aberta').sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
    pagas: minhas.filter((c) => c.status === 'paga').sort((a, b) => b.pagaEm.localeCompare(a.pagaEm)),
  };
}

function nomeAbreviado(nome) {
  const partes = nome.split(' ');
  return `${partes[0]} ${partes[partes.length - 1][0]}.`;
}

function linhaDigitavel(cobranca, total) {
  const n = cobranca.id.replace(/\D/g, '').padEnd(12, '0').slice(0, 12);
  return `34191.${n.slice(0, 5)} ${n.slice(5, 10)}.${n.slice(10)}0001 23456.789012 1 ${String(total).padStart(10, '0')}`;
}

export function CartaoCobrancaInicio({ estado, eu, agora }) {
  const hoje = isoDia(agora);
  if (!responsavelDaPessoa(estado, eu).souResponsavel) return null;
  const { abertas } = cobrancasDaUnidade(estado, eu);
  if (!abertas.length) return html`<a class="cartao link" href="#morador.financeiro"><strong>Financeiro em dia</strong><span class="sub">Nenhuma cobrança em aberto.</span></a>`;
  const c = abertas[0];
  const situacao = situacaoCobranca(c, hoje);
  const v = valorAtualizado(c, estado.financeiro.parametros, hoje);
  return html`<a class=${`cartao link cobranca-inicio${situacao === 'vencida' ? ' vencida' : ''}`} href="#morador.financeiro">
    <div class="linha-entre"><strong>Sua cobrança de ${mesExtenso(c.competencia)}</strong><${EtqCobranca} situacao=${situacao} /></div>
    <span class="preco grande">${fmtReais(v.total)}</span>
    <small class="sub">${situacao === 'vencida' ? `Venceu em ${fmtDataCurta(c.vencimento)} · valor com multa e juros` : `Vence em ${fmtDataCurta(c.vencimento)}`}</small>
    <span class="btn primario">Pagar</span>
  </a>`;
}

function CartaoCobranca({ estado, cobranca, executar, hoje }) {
  const fin = estado.financeiro;
  const [forma, setForma] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const situacao = situacaoCobranca(cobranca, hoje);
  const v = valorAtualizado(cobranca, fin.parametros, hoje);
  const copiaECola = `00020126580014BR.GOV.BCB.PIX0136${cobranca.id}5204000053039865406${(v.total / 100).toFixed(2)}5802BR`;
  const formas = [['pix', 'Pagar com Pix'], ['boleto', 'Boleto'], ['cartao', 'Cartão']].filter(([k]) => fin.parametros.formas.includes(k));

  function copiar() {
    const campo = document.getElementById(`pix-${cobranca.id}`);
    const selecionar = () => {
      campo.select();
      setMensagem('Selecione e copie o código acima.');
    };
    if (!navigator.clipboard) {
      selecionar();
      return;
    }
    navigator.clipboard.writeText(copiaECola).then(() => setMensagem('Código Pix copiado.')).catch(selecionar);
  }

  function confirmar() {
    const r = executar((e) => confirmarPagamentoAsaas(e, cobranca.id, `evt-${cobranca.id}-${forma}`, forma, new Date()));
    if (r.erro) setMensagem(r.erro);
  }

  return html`<article class=${`cartao cobranca${situacao === 'vencida' ? ' vencida' : ''}`}>
    <div class="linha-entre"><strong>${nomeMes(cobranca.competencia)}</strong><${EtqCobranca} situacao=${situacao} /></div>
    <span class="preco grande">${fmtReais(v.total)}</span>
    <small class="sub">${situacao === 'vencida'
      ? `Venceu em ${fmtDataCurta(cobranca.vencimento)} · ${fmtReais(cobranca.valor)} + multa ${fmtReais(v.multa)} + juros ${fmtReais(v.juros)} (${v.dias} dias)`
      : `Vence em ${fmtDataCurta(cobranca.vencimento)}`}</small>
    <details class="composicao"><summary>Composição</summary>
      <ul class="itens-sacola">${cobranca.itens.map((i, n) => html`<li key=${n}><span>${i.descricao}</span><span>${fmtReais(i.valor)}</span></li>`)}</ul>
    </details>
    <div class="acoes" role="group" aria-label="Forma de pagamento">
      ${formas.map(([k, nome]) => html`<button type="button" key=${k} class=${forma === k ? 'btn primario' : 'btn secundario'} aria-pressed=${forma === k} onClick=${() => { setForma(k); setMensagem(null); }}>${nome}</button>`)}
    </div>
    ${forma === 'pix' && html`<div class="pagamento">
      <${QrFalso} texto=${cobranca.id} tamanho=${120} />
      <label class="campo"><span>Pix copia e cola</span><input id=${`pix-${cobranca.id}`} readonly value=${copiaECola} /></label>
      <button type="button" class="btn secundario" onClick=${copiar}>Copiar código</button>
    </div>`}
    ${forma === 'boleto' && html`<div class="pagamento">
      <label class="campo"><span>Linha digitável</span><input id=${`boleto-${cobranca.id}`} readonly value=${linhaDigitavel(cobranca, v.total)} /></label>
      <small class="sub">O PDF do boleto chega por e-mail e WhatsApp.</small>
    </div>`}
    ${forma === 'cartao' && html`<div class="pagamento"><small class="sub">O cartão é pago na página segura do Asaas (simulada no protótipo).</small></div>`}
    ${forma && html`<button type="button" class="btn primario bloco" onClick=${confirmar}>Simular confirmação do Asaas</button>`}
    <${Sucesso} texto=${mensagem} />
    <button type="button" class="btn-link" onClick=${() => setMensagem(`2ª via gerada com valor atualizado: ${fmtReais(v.total)}.`)}>Gerar 2ª via</button>
  </article>`;
}

export function MFinanceiro({ estado, eu, executar, agora }) {
  const hoje = isoDia(agora);
  const [documento, setDocumento] = useState(null);
  const { responsavel, souResponsavel } = responsavelDaPessoa(estado, eu);
  if (documento) return html`<section class="m-pagina"><${PrevDoc} documento=${documento} aoFechar=${() => setDocumento(null)} /></section>`;
  if (!souResponsavel) {
    return html`<section class="m-pagina">
      <h1 class="m-titulo">Financeiro</h1>
      <div class="cartao">
        <strong>As cobranças do apto ${eu} vão para o responsável financeiro</strong>
        <span>${responsavel ? `${nomeAbreviado(responsavel.nome)} (${NOMES_RELACAO[responsavel.relacao]})` : 'Responsável ainda não cadastrado'}</span>
        <small class="sub">Se isso mudou, avise o síndico.</small>
      </div>
    </section>`;
  }
  const { abertas, pagas } = cobrancasDaUnidade(estado, eu);
  const ano = hoje.slice(0, 4);
  const recibo = (c) => ({ titulo: `Recibo · ${nomeMes(c.competencia)} · apto ${eu}`, pasta: 'Financeiro', versoes: [{ versao: 1, data: isoDia(new Date(c.pagaEm)) }] });
  const temVencida = abertas.some((c) => situacaoCobranca(c, hoje) === 'vencida');
  return html`<section class="m-pagina">
    <h1 class="m-titulo">Financeiro</h1>
    <p class="m-sub">Responsável financeiro: ${responsavel.nome} · apto ${eu}</p>
    <h2>Em aberto</h2>
    ${abertas.length
      ? abertas.map((c) => html`<${CartaoCobranca} key=${c.id} estado=${estado} cobranca=${c} executar=${executar} hoje=${hoje} />`)
      : html`<${Vazio} texto="Nenhuma cobrança em aberto. Tudo em dia!" />`}
    <h2>Histórico</h2>
    ${pagas.length
      ? html`<ul class="m-lista">${pagas.map((c) => html`<li key=${c.id} class="cartao">
          <div class="linha-entre"><strong>${nomeMes(c.competencia)}</strong><span>${fmtReais(c.valorPago)}</span></div>
          <small class="sub">Pago em ${fmtDataCurta(isoDia(new Date(c.pagaEm)))} · ${NOMES_FORMA[c.forma]}</small>
          <button type="button" class="btn-link" onClick=${() => setDocumento(recibo(c))}>Ver recibo</button>
        </li>`)}</ul>`
      : html`<${Vazio} texto="Nenhum pagamento registrado." />`}
    ${temVencida
      ? html`<small class="sub">A declaração de quitação fica disponível quando não houver débitos vencidos.</small>`
      : html`<button type="button" class="btn secundario" onClick=${() => setDocumento({ titulo: `Declaração anual de quitação de débitos ${ano} · apto ${eu}`, pasta: 'Financeiro', versoes: [{ versao: 1, data: hoje }] })}>Declaração de quitação ${ano}</button>`}
  </section>`;
}
```

- [ ] **Step 3: Ligar no `morador.js`**

Rode em `prototipo/`:
```bash
node - <<'EOF'
const fs = require('fs');
const arquivo = 'src/ui/morador.js';
let s = fs.readFileSync(arquivo, 'utf8');
const pares = [
  ["import { TelaVendas, CartaoAnuncio } from './vendas.js';", "import { TelaVendas, CartaoAnuncio } from './vendas.js';\nimport { MFinanceiro, CartaoCobrancaInicio } from './financeiro-morador.js';"],
  ["const ABAS_MORADOR = [['inicio', 'Início', 'casa'], ['reservas', 'Reservas', 'calendario'], ['avisos', 'Avisos', 'megafone'], ['ocorrencias', 'Ocorrências', 'prancheta'], ['vendas', 'Vendas', 'loja'], ['mais', 'Mais', 'menu']];", "const ABAS_MORADOR = [['inicio', 'Início', 'casa'], ['financeiro', 'Financeiro', 'cifrao'], ['reservas', 'Reservas', 'calendario'], ['ocorrencias', 'Ocorrências', 'prancheta'], ['vendas', 'Vendas', 'loja'], ['mais', 'Mais', 'menu']];"],
  ['preferencias: MPreferencias, vendas: TelaVendas };', 'preferencias: MPreferencias, vendas: TelaVendas, financeiro: MFinanceiro };'],
  ["['documentos', 'encomendas', 'preferencias'].includes(props.rota.tela)", "['documentos', 'encomendas', 'preferencias', 'avisos'].includes(props.rota.tela)"],
  ['  const novidades = anunciosVisiveis(estado).filter((a) => a.vendedor !== eu).slice(0, 2);', '  const novidades = anunciosVisiveis(estado).filter((a) => a.vendedor !== eu).slice(0, 2);\n  const naoLidos = comunicadosDaUnidade(estado, eu).filter((c) => !c.leituras.includes(eu)).length;'],
  ['    <p class="m-sub">Apto ${eu} · Residencial Ipê Amarelo</p>\n', '    <p class="m-sub">Apto ${eu} · Residencial Ipê Amarelo</p>\n    <${CartaoCobrancaInicio} estado=${estado} eu=${eu} agora=${agora} />\n    <a class="cartao link com-icone" href="#morador.avisos"><${QuadroIcone} nome="megafone" /><span><strong>Avisos</strong><span class="sub">${naoLidos ? `${naoLidos} não ${naoLidos === 1 ? \'lido\' : \'lidos\'}` : \'Tudo lido\'}</span></span></a>\n'],
  ['    <h1 class="m-titulo">Mais</h1>\n', '    <h1 class="m-titulo">Mais</h1>\n    <a class="cartao link com-icone" href="#morador.avisos"><${QuadroIcone} nome="megafone" /><span><strong>Avisos</strong><span class="sub">Comunicados do síndico e confirmação de leitura</span></span></a>\n'],
];
for (const [de, para] of pares) {
  if (!s.includes(de)) throw new Error('não achei ' + de.slice(0, 60));
  s = s.replace(de, para);
}
fs.writeFileSync(arquivo, s);
console.log('ok');
EOF
```

Em `prototipo/montagem.mjs`, acrescente `'src/ui/financeiro-morador.js',` na `ORDEM`, logo antes de `'src/ui/vendas.js',`. Ele precisa vir depois de `financeiro-sindico.js`, então mova `'src/ui/financeiro-sindico.js',` para logo antes dele também. A ordem final da UI fica: `comum`, `portaria`, `financeiro-sindico`, `financeiro-morador`, `vendas`, `morador`, `sindico`, `app`.

- [ ] **Step 4: Estilos**

Acrescente ao final de `src/estilos.css`:
```css
/* Fase 2: Financeiro do morador */
.cartao.cobranca.vencida, .cartao.cobranca-inicio.vencida { box-shadow: inset 3px 0 0 var(--perigo); }
.cobranca-inicio .btn { align-self: flex-start; }
.composicao summary { cursor: pointer; color: var(--laranja-forte); font-weight: 600; min-height: 32px; }
.pagamento { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.pagamento .campo { width: 100%; }
.pagamento input[readonly] { font-family: ui-monospace, Consolas, monospace; font-size: 12px; }
```

- [ ] **Step 5: Rodar a bateria**

Run: `npm test && npm run montar && npm run verificar && npm run e2e`
Expected: tudo verde. O roteiro `comunicado` abre `#morador.avisos` direto, que continua funcionando.

- [ ] **Step 6: Commit**

```bash
git add prototipo
git commit -m "feat(cobranca): aba Financeiro do morador, cobrança e avisos no Início

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Roteiros ponta a ponta, revisão visual e publicação

**Files:**
- Modify: `prototipo/e2e.mjs`

- [ ] **Step 1: Acrescentar os roteiros**

Em `prototipo/e2e.mjs`, no objeto `ROTEIROS`, acrescente logo antes de `async persistencia() {`:
```js
  async cobrancaEmissao() {
    await irPara('#sindico.cobranca.previa');
    await esperarTexto('Sem responsável financeiro: não será emitida');
    await clicarSeletor('[data-acao="emitir"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('31 responsáveis')`, 'o aviso de emissão');
    await irPara('#sindico.inicio');
    await esperarTexto('0 de 31 pagas');
  },

  async cobrancaPagamento() {
    await irPara('#morador.inicio');
    await esperarTexto('Sua cobrança de');
    await esperarTexto('R$ 865,00');
    await irPara('#morador.financeiro');
    await clicar('Pagar com Pix');
    await esperarTexto('Pix copia e cola');
    await clicar('Simular confirmação do Asaas');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Pagamento recebido')`, 'o aviso do Asaas');
    await esperarTexto('Nenhuma cobrança em aberto');
    await clicar('Juliana · 104');
    await irPara('#morador.financeiro');
    await esperarTexto('vão para o responsável financeiro');
    await esperarTexto('Carlos A. (proprietário)');
    await clicar('Ana · 302');
    await irPara('#sindico.inicio');
    await esperarTexto('1 de 31 pagas');
    await esperarTexto('R$ 49.215');
  },

  async cobrancaReguaBaixa() {
    await irPara('#sindico.cobranca.regua');
    await clicarSeletor('[data-acao="executar-regua"]');
    await esperarTexto('6 avisos enviados');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('3 responsáveis')`, 'o aviso da régua');
    await irPara('#sindico.cobranca.emitidas');
    const vigente = await js(`[...document.getElementById('emitidas-competencia').options].map((o) => o.value)[1]`);
    await preencher('Competência', vigente);
    await clicarSeletor(`[data-cobranca="CB-${vigente}-503"]`);
    await clicar('Baixa manual');
    await clicar('Anexar comprovante');
    await clicar('Confirmar baixa');
    await esperarTexto('Baixa registrada');
    await irPara('#sindico.inicio');
    await esperarTexto('2 de 32');
  },

  async cobrancaPlanos() {
    await clicar('Básico');
    await irPara('#sindico.inicio');
    await esperarTexto('Disponível no plano Intermediário (+R$ 158,40/mês)');
    await clicar('Avançado');
    await esperarTexto('Orçado × realizado');
    await clicar('Intermediário');
  },

```

No roteiro `larguraCelular`, acrescente `'#sindico.cobranca', '#morador.financeiro'` ao final da lista de rotas.

- [ ] **Step 2: Rodar**

Run: `npm run montar && npm run e2e`
Expected: 13 linhas `ok`. Se algum roteiro falhar, use superpowers:systematic-debugging. O defeito está na interface, a menos que o roteiro contradiga a especificação.

- [ ] **Step 3: Revisão visual**

Capture o Início e a Cobrança do síndico a 1366 px (`npm run verificar -- --capturas`, telas `sindico-*`). Capture o Financeiro do morador a 390 px por emulação via CDP, como nas revisões anteriores. Abra cada imagem e confira:
- números sem corte;
- gráfico com as duas cores, legenda e o mês de julho destacado;
- tabelas com rolagem própria no celular.

Se ajustar algo, rode a bateria completa de novo.

- [ ] **Step 4: Commit e publicação**

```bash
git add prototipo
git commit -m "test(cobranca): roteiros de emissão, pagamento, régua com baixa manual e planos no e2e

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Republique `prototipo/condofacil.html` na mesma URL pela ferramenta Artifact, com o mesmo caminho de arquivo e `label` "Fase 2: cobrança e planos".
