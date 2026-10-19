# Acordos de inadimplência: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Acordos de inadimplência no protótipo:
- o síndico propõe com desconto, entrada e parcelas;
- o responsável financeiro aceita, com termo de confissão no Avançado;
- as parcelas viram cobranças comuns.

**Architecture:**
- Regras e ações puras ficam no arquivo novo `src/cobranca/acordos.js`. As ações devolvem `{ estado, notificacao?, erro? }`.
- Cada entrada ou parcela é uma cobrança comum com o campo `acordo: { id, numero, de }`. Pagamento, baixa, régua e devedores são reaproveitados.
- A UI nova fica em `src/ui/acordos.js`. O seed do AC-001 (304) é gerado pelas próprias ações.

**Tech Stack:** Preact + htm (vendor.js), ES modules concatenados por `montagem.mjs`, `node --test`, Chrome headless (verificar.mjs, e2e.mjs).

**Spec:** `docs/superpowers/specs/2026-10-19-fase2-acordos-design.md`

## Global Constraints

- Todos os comandos rodam em `prototipo/`.
- **Imports:** os imports locais ocupam uma linha cada. Nomes de topo são únicos em todos os arquivos de `src/`. `export` só aparece em declarações de topo.
- **Valores e datas:** dinheiro em centavos. Multa: `Math.round(valor*multaPct/100)`. Juros: `Math.round(valor*jurosPct*dias/3000)`.
- **Datas dos testes:** `AGORA_FASE2 = new Date(2026, 9, 19, 10, 0)`, hoje '2026-10-19', vencimento vigente '2026-10-10'.
- **Textos de erro:** exatamente os da spec.
- **Versão dos dados:** `versao` 4, e `carregarEstado` aceita só a 4.
- **Verificação:** `npm test`, `npm run verificar` e `npm run e2e` precisam passar no fim de cada task que tocar no que eles cobrem.
- **Git:** trabalhar no branch `fase2-acordos`. Os commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Vicente como pessoa não residente

**Files:**
- Modify: `src/dados.js` (pessoas e versão), `src/armazenamento.js` (versão 4), `src/vendas/dados.js` (MORADORES_DEMO), `src/regras.js:149,159` (moradores e adesão), `src/cobranca/dados.js` (relação do responsável; tirar 704 de RESPONSAVEIS_SEM_APP)
- Test: `src/casos/dados.js`, `src/casos/cobranca-dados.js`, `src/casos/vendas.js`

**Interfaces:**
- Produces: a pessoa `{ id:'p704', nome:'Vicente Moraes', unidade:'704', naoResidente:true, ...perfilVenda('704', em) }`, `MORADORES_DEMO` com `['704','Vicente']` e o responsável da 704 com `relacao: 'proprietario'`.

- [ ] **Step 1: Testes primeiro**
  - Em `src/casos/dados.js`, no caso "20 unidades com morador cadastrado", troque o nome do caso para `'dados: 20 unidades com morador e 1 proprietário não residente'` e as asserções para:
```js
      igual(new Set(e.pessoas.filter((p) => !p.naoResidente).map((p) => p.unidade)).size, 20);
      igual(e.pessoas.filter((p) => p.naoResidente).map((p) => [p.unidade, p.nome, p.recebeOfertas, p.vendedor]), [['704', 'Vicente Moraes', false, 'nao']]);
      igual([e.versao, e.pessoas.find((p) => p.unidade === UNIDADE_ANA).nome], [4, 'Ana Souza']);
```
  - Em `src/casos/cobranca-dados.js`, no caso "responsáveis financeiros", acrescente:
```js
      igual([u['704'].responsavel.nome, u['704'].responsavel.relacao], ['Vicente Moraes', 'proprietario']);
```
  - Em `src/casos/vendas.js:274-276`, junto do teste de `trocarMorador`, acrescente:
```js
      igual(trocarMorador(e, '704').estado.moradorAtual, '704');
```

- [ ] **Step 2: Rodar e ver falhar**
  - Run: `npm test`
  - Expected: FAIL nos três casos acima.

- [ ] **Step 3: Implementar**
  - `src/dados.js`:
    - `versao: 4`;
    - troque a linha de `pessoas` por:
```js
  const pessoas = [
    ...MORADORES.map(([unidade, nome]) => ({ id: `p${unidade}`, nome, unidade, ...perfilVenda(unidade, em) })),
    { id: 'p704', nome: 'Vicente Moraes', unidade: '704', naoResidente: true, ...perfilVenda('704', em) },
  ];
```
  - `src/armazenamento.js`: `estado.versao === 4`.
  - `src/vendas/dados.js`: `export const MORADORES_DEMO = [['302', 'Ana'], ['104', 'Juliana'], ['704', 'Vicente']];`
  - `src/regras.js:149`: `return estado.pessoas.filter((p) => p.unidade === unidade && !p.naoResidente);`
  - `src/regras.js:159`: `adesao: { com: new Set(estado.pessoas.filter((p) => !p.naoResidente).map((p) => p.unidade)).size, total: ... }`
  - `src/cobranca/dados.js`:
    - remova `704: 'Vicente Moraes', ` de RESPONSAVEIS_SEM_APP;
    - em `financeiroInicial`, logo após `const nomes = ...`, acrescente `const naoResidentes = new Set(pessoas.filter((p) => p.naoResidente).map((p) => p.unidade));`;
    - troque `else if (nomes[u]) responsavel = { nome: nomes[u], relacao: 'titular' };` por `else if (nomes[u]) responsavel = { nome: nomes[u], relacao: naoResidentes.has(u) ? 'proprietario' : 'titular' };`.

- [ ] **Step 4: Rodar e ver passar**
  - Run: `npm test`
  - Expected: PASS em todos, 99 testes.

- [ ] **Step 5: Commit**
```bash
git add src && git commit -m "feat(acordos): Vicente (704) como proprietário não residente no seletor"
```

---

### Task 2: Regras do acordo (simulação, rótulo, plano)

**Files:**
- Create: `src/cobranca/acordos.js` (nesta task só as regras), `src/casos/acordos.js`
- Modify: `src/planos.js` (RECURSOS_PLANO), `src/cobranca/regras.js` (rotuloCobranca), `src/cobranca/dados.js` (`acordo: null` nas cobranças, `acordos: []`), `src/cobranca/acoes.js` (`acordo: null` na emissão e exports dos ajudantes), `montagem.mjs` (ORDEM), `testes/casos.test.mjs`, `src/ui/app.js` (PainelTestes)

**Interfaces:**
- Produces, em `src/cobranca/regras.js`: `rotuloCobranca(c)` devolve `'Acordo AC-001 · parcela 2/4'`, `'Acordo AC-001 · entrada'` ou `nomeMes(c.competencia)`.
- Produces, em `src/cobranca/acordos.js`:
  - `PARCELA_MINIMA = 5000`;
  - `acordoComDebito(estado, idCobranca)` devolve o acordo `aguardando`/`ativo` que contém a cobrança, ou `undefined`;
  - `debitosParaAcordo(estado, unidade, hoje)` devolve `cobranca[]`;
  - `simularAcordo(estado, { unidade, originais, perdoaMulta, jurosPerdoadosPct, entrada, parcelas }, hoje)` devolve `{ ok:true, valorOriginal, multa, juros, desconto, total, valorParcela, ultimaParcela, cronograma:[{numero, vencimento, valor}] }` ou `{ ok:false, motivo }`;
  - `cronogramaAcordo(financeiro, hoje, entrada, parcelas, valorParcela, ultimaParcela)`;
  - `cronogramaDoAcordo(estado, acordo, hoje)`;
  - `cobrancasDoAcordo(estado, id)`, com as canceladas fora e ordenada por número;
  - `progressoAcordo(estado, acordo)` devolve `{ pagas, total, proxima }`;
  - `propostaPendente(estado, unidade)` e `acordoAtivo(estado, unidade)`;
  - `alertasAcordos(estado, hoje)` devolve `[{ chave, texto, href }]`;
  - `planoInsuficiente(recurso)` devolve `'Disponível no plano X'`.
- Produces, em `src/cobranca/acoes.js`: passam a ser exportados `SO_SINDICO`, `comFinanceiro`, `comAuditoria` e `nomeResponsavel`.

- [ ] **Step 1: Testes (casos novos)**

Crie `src/casos/acordos.js`:
```js
import { dadosIniciais } from '../dados.js';
import { liberado, planoMinimo } from '../planos.js';
import { rotuloCobranca } from '../cobranca/regras.js';
import { debitosParaAcordo, simularAcordo } from '../cobranca/acordos.js';
import { igual, AGORA_FASE2 } from './afirmar.js';

const HOJE_ACORDO = '2026-10-19';
const SET_704 = 'CB-2026-09-704';
const OUT_704 = 'CB-2026-10-704';

function estadoAcordo() {
  return dadosIniciais(AGORA_FASE2);
}

function simular704(mudanca = {}) {
  return simularAcordo(estadoAcordo(), { unidade: '704', originais: [SET_704, OUT_704], perdoaMulta: false, jurosPerdoadosPct: 0, entrada: 0, parcelas: 3, ...mudanca }, HOJE_ACORDO);
}

export const CASOS_ACORDOS = [
  {
    nome: 'acordos: rótulo das cobranças',
    rodar() {
      igual(rotuloCobranca({ competencia: '2026-09', acordo: null }), 'setembro de 2026');
      igual(rotuloCobranca({ competencia: '2026-10', acordo: { id: 'AC-001', numero: 2, de: 4 } }), 'Acordo AC-001 · parcela 2/4');
      igual(rotuloCobranca({ competencia: '2026-08', acordo: { id: 'AC-001', numero: 0, de: 4 } }), 'Acordo AC-001 · entrada');
    },
  },
  {
    nome: 'acordos: recursos por plano',
    rodar() {
      igual([liberado('basico', 'acordos'), liberado('intermediario', 'acordos'), liberado('intermediario', 'termoConfissao'), liberado('avancado', 'termoConfissao')], [false, true, false, true]);
      igual(planoMinimo('acordos').nome, 'Intermediário');
    },
  },
  {
    nome: 'acordos: débitos vencidos disponíveis por unidade',
    rodar() {
      const e = estadoAcordo();
      igual(debitosParaAcordo(e, '704', HOJE_ACORDO).map((c) => c.id), [OUT_704, SET_704]);
      igual(debitosParaAcordo(e, '302', HOJE_ACORDO), []);
    },
  },
  {
    nome: 'acordos: simulação sem desconto, com resto na última parcela',
    rodar() {
      igual(simular704(), { ok: true, valorOriginal: 173000, multa: 3460, juros: 1385, desconto: 0, total: 177845, valorParcela: 59281, ultimaParcela: 59283, cronograma: [
        { numero: 1, vencimento: '2026-11-10', valor: 59281 },
        { numero: 2, vencimento: '2026-12-10', valor: 59281 },
        { numero: 3, vencimento: '2027-01-10', valor: 59283 },
      ] });
    },
  },
  {
    nome: 'acordos: simulação com perdão da multa, metade dos juros e entrada',
    rodar() {
      const s = simular704({ perdoaMulta: true, jurosPerdoadosPct: 50, entrada: 30000 });
      igual([s.desconto, s.total, s.valorParcela, s.ultimaParcela], [4153, 173692, 47897, 47898]);
      igual(s.cronograma, [
        { numero: 0, vencimento: '2026-10-22', valor: 30000 },
        { numero: 1, vencimento: '2026-11-10', valor: 47897 },
        { numero: 2, vencimento: '2026-12-10', valor: 47897 },
        { numero: 3, vencimento: '2027-01-10', valor: 47898 },
      ]);
    },
  },
  {
    nome: 'acordos: validações da simulação',
    rodar() {
      const e = estadoAcordo();
      igual(simularAcordo(e, { unidade: '302', originais: ['CB-2026-10-302'], parcelas: 3 }, HOJE_ACORDO).motivo, 'Esta unidade não tem débitos vencidos');
      igual(simular704({ originais: [] }).motivo, 'Escolha ao menos um débito');
      igual(simular704({ originais: ['CB-2026-10-503'] }).motivo, 'Escolha só débitos vencidos desta unidade');
      igual(simular704({ jurosPerdoadosPct: 120 }).motivo, 'Informe um perdão de juros entre 0% e 100%');
      igual([simular704({ parcelas: 0 }).motivo, simular704({ parcelas: 13 }).motivo], ['Escolha de 1 a 12 parcelas', 'Escolha de 1 a 12 parcelas']);
      igual([simular704({ entrada: 177845 }).motivo, simular704({ entrada: -1 }).motivo], ['A entrada precisa ser menor que o total do acordo', 'A entrada precisa ser menor que o total do acordo']);
      igual(simular704({ originais: [OUT_704], entrada: 85000, parcelas: 12 }).motivo, 'Cada parcela precisa ter no mínimo R$ 50,00');
    },
  },
];
```

Registre os casos:
- **ORDEM do `montagem.mjs`:** acrescente `'src/cobranca/acordos.js'` logo depois de `'src/cobranca/acoes.js'` e `'src/casos/acordos.js'` logo depois de `'src/casos/cobranca-acoes.js'`.
- **`testes/casos.test.mjs`:** import `import { CASOS_ACORDOS } from '../src/casos/acordos.js';` e `...CASOS_ACORDOS` no fim da lista.
- **`src/ui/app.js`:** o mesmo import com `'../casos/acordos.js'` e `...CASOS_ACORDOS` no fim da lista de `PainelTestes`.

- [ ] **Step 2: Rodar e ver falhar**
  - Run: `npm test`
  - Expected: FAIL (módulo `../cobranca/acordos.js` inexistente).

- [ ] **Step 3: Implementar**
  - **`src/planos.js`:** em RECURSOS_PLANO, acrescente `acordos: 'intermediario',` e `termoConfissao: 'avancado',`.
  - **`src/cobranca/regras.js`:** acrescente depois de `mesExtenso`:
```js
export function rotuloCobranca(cobranca) {
  const a = cobranca.acordo;
  if (!a) return nomeMes(cobranca.competencia);
  return `Acordo ${a.id} · ${a.numero ? `parcela ${a.numero}/${a.de}` : 'entrada'}`;
}
```
  - **`src/cobranca/dados.js`:** no objeto de `novaCobranca`, acrescente `acordo: null,` antes de `...extras`. No retorno de `financeiroInicial`, acrescente `acordos: [],` depois de `cobrancas,`.
  - **`src/cobranca/acoes.js`:**
    - em `emitirCompetencia`, acrescente `acordo: null` ao objeto da nova cobrança, depois de `substituiu: null`;
    - troque `const SO_SINDICO` por `export const SO_SINDICO`;
    - ponha `export ` antes de `function comFinanceiro`, `function comAuditoria` e `function nomeResponsavel`.
  - **`src/cobranca/acordos.js`**, nesta task só as regras; as ações vêm na Task 3:
```js
import { liberado, planoMinimo } from '../planos.js';
import { somarDias, somarMes } from '../datas.js';
import { situacaoCobranca, valorAtualizado } from './regras.js';

// Acordos de inadimplência: o acordo junta débitos vencidos; cada entrada ou parcela vira uma cobrança comum marcada com o acordo.
export const PARCELA_MINIMA = 5000;
const MAX_PARCELAS = 12;
const DIAS_ENTRADA = 3;

function falhaAcordo(motivo) {
  return { ok: false, motivo };
}

export function planoInsuficiente(recurso) {
  return `Disponível no plano ${planoMinimo(recurso).nome}`;
}

export function acordoComDebito(estado, idCobranca) {
  return estado.financeiro.acordos.find((a) => ['aguardando', 'ativo'].includes(a.situacao) && a.originais.includes(idCobranca));
}

function vencidasSemAcordo(estado, unidade, hoje) {
  return estado.financeiro.cobrancas.filter((c) => c.unidade === unidade && !c.acordo && situacaoCobranca(c, hoje) === 'vencida');
}

export function debitosParaAcordo(estado, unidade, hoje) {
  return vencidasSemAcordo(estado, unidade, hoje).filter((c) => !acordoComDebito(estado, c.id)).sort((a, b) => b.vencimento.localeCompare(a.vencimento));
}

export function cronogramaAcordo(financeiro, hoje, entrada, parcelas, valorParcela, ultimaParcela) {
  const vencimentoEntrada = somarDias(hoje, DIAS_ENTRADA);
  const dia = String(financeiro.parametros.diaVencimento).padStart(2, '0');
  const linhas = entrada ? [{ numero: 0, vencimento: vencimentoEntrada, valor: entrada }] : [];
  for (let k = 1; k <= parcelas; k++) linhas.push({ numero: k, vencimento: `${somarMes(vencimentoEntrada.slice(0, 7), k)}-${dia}`, valor: k === parcelas ? ultimaParcela : valorParcela });
  return linhas;
}

export function simularAcordo(estado, dados, hoje) {
  const fin = estado.financeiro;
  const { unidade, originais = [], perdoaMulta = false, jurosPerdoadosPct = 0, entrada = 0, parcelas } = dados;
  const vencidas = vencidasSemAcordo(estado, unidade, hoje);
  if (!vencidas.length) return falhaAcordo('Esta unidade não tem débitos vencidos');
  if (!originais.length) return falhaAcordo('Escolha ao menos um débito');
  for (const id of originais) {
    const outro = acordoComDebito(estado, id);
    if (outro) return falhaAcordo(`Este débito já está no acordo ${outro.id}`);
  }
  const escolhidas = vencidas.filter((c) => originais.includes(c.id));
  if (escolhidas.length !== originais.length) return falhaAcordo('Escolha só débitos vencidos desta unidade');
  if (!Number.isFinite(jurosPerdoadosPct) || jurosPerdoadosPct < 0 || jurosPerdoadosPct > 100) return falhaAcordo('Informe um perdão de juros entre 0% e 100%');
  if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > MAX_PARCELAS) return falhaAcordo('Escolha de 1 a 12 parcelas');
  const valores = escolhidas.map((c) => valorAtualizado(c, fin.parametros, hoje));
  const valorOriginal = escolhidas.reduce((soma, c) => soma + c.valor, 0);
  const multa = valores.reduce((soma, v) => soma + v.multa, 0);
  const juros = valores.reduce((soma, v) => soma + v.juros, 0);
  const desconto = (perdoaMulta ? multa : 0) + Math.round((juros * jurosPerdoadosPct) / 100);
  const total = valorOriginal + multa + juros - desconto;
  if (!Number.isInteger(entrada) || entrada < 0 || entrada >= total) return falhaAcordo('A entrada precisa ser menor que o total do acordo');
  const valorParcela = Math.floor((total - entrada) / parcelas);
  if (valorParcela < PARCELA_MINIMA) return falhaAcordo('Cada parcela precisa ter no mínimo R$ 50,00');
  const ultimaParcela = total - entrada - valorParcela * (parcelas - 1);
  return { ok: true, valorOriginal, multa, juros, desconto, total, valorParcela, ultimaParcela, cronograma: cronogramaAcordo(fin, hoje, entrada, parcelas, valorParcela, ultimaParcela) };
}

export function cronogramaDoAcordo(estado, acordo, hoje) {
  const ultima = acordo.total - acordo.entrada - acordo.valorParcela * (acordo.parcelas - 1);
  return cronogramaAcordo(estado.financeiro, hoje, acordo.entrada, acordo.parcelas, acordo.valorParcela, ultima);
}

export function cobrancasDoAcordo(estado, id) {
  return estado.financeiro.cobrancas.filter((c) => c.acordo && c.acordo.id === id && c.status !== 'cancelada').sort((a, b) => a.acordo.numero - b.acordo.numero);
}

export function progressoAcordo(estado, acordo) {
  const lista = cobrancasDoAcordo(estado, acordo.id);
  const parcelas = lista.filter((c) => c.acordo.numero > 0);
  return { pagas: parcelas.filter((c) => c.status === 'paga').length, total: acordo.parcelas, proxima: lista.find((c) => c.status === 'aberta') || null };
}

export function propostaPendente(estado, unidade) {
  return estado.financeiro.acordos.find((a) => a.unidade === unidade && a.situacao === 'aguardando');
}

export function acordoAtivo(estado, unidade) {
  return estado.financeiro.acordos.find((a) => a.unidade === unidade && a.situacao === 'ativo');
}

export function alertasAcordos(estado, hoje) {
  const fin = estado.financeiro;
  const itens = [];
  for (const a of fin.acordos) {
    if (a.situacao === 'ativo') {
      for (const c of cobrancasDoAcordo(estado, a.id).filter((x) => situacaoCobranca(x, hoje) === 'vencida')) {
        itens.push({ chave: `acordo-${c.id}`, texto: `Acordo ${a.id} (${a.unidade}): ${c.acordo.numero ? `parcela ${c.acordo.numero}` : 'entrada'} vencida`, href: `#sindico.cobranca.${a.id}` });
      }
    }
    if (a.situacao === 'aguardando') {
      const r = fin.unidades[a.unidade].responsavel;
      itens.push({ chave: `proposta-${a.id}`, texto: `Proposta ${a.id} aguarda aceite de ${r ? r.nome : `apto ${a.unidade}`}`, href: `#sindico.cobranca.${a.id}` });
    }
  }
  return itens;
}

export function acordoDaUnidade(estado, unidade) {
  if (acordoAtivo(estado, unidade)) return 'ativo';
  if (propostaPendente(estado, unidade)) return 'aguardando';
  return null;
}
```
  - **Nomes de topo:** antes de seguir, rode `grep -rn "function \(falhaAcordo\|cronogramaAcordo\|acordoAtivo\|acordoDaUnidade\|planoInsuficiente\)\|const \(PARCELA_MINIMA\|MAX_PARCELAS\|DIAS_ENTRADA\)" src` e confira que cada nome aparece uma única vez.

- [ ] **Step 4: Rodar e ver passar**
  - Run: `npm test`
  - Expected: PASS, 105 testes.

- [ ] **Step 5: Commit**
```bash
git add src montagem.mjs testes && git commit -m "feat(acordos): simulação, rótulo de parcela e recursos por plano"
```

---

### Task 3: Ações do acordo (propor, cancelar, termo, aceitar, quitar)

**Files:**
- Modify: `src/cobranca/acordos.js` (ações), `src/cobranca/acoes.js` (quitação no pagamento e na baixa, rótulos nos textos)
- Test: `src/casos/acordos.js`

**Interfaces:**
- Consumes: as regras da Task 2 e `SO_SINDICO`, `comFinanceiro`, `comAuditoria` e `nomeResponsavel` de `./acoes.js`.
- Produces:
  - `proporAcordo(estado, dados, perfil, agora)` devolve `{ estado, id, notificacao }`;
  - `cancelarProposta(estado, id, perfil, agora)`;
  - `marcarTermoLido(estado, id, agora)`;
  - `aceitarAcordo(estado, id, { quem, ciente }, agora)`;
  - `confirmarPagamentoAsaas` e `baixaManual` passam a quitar o acordo quando a última cobrança dele é paga.

- [ ] **Step 1: Testes**

Em `src/casos/acordos.js`:
- imports:
  - `import { proporAcordo, cancelarProposta, marcarTermoLido, aceitarAcordo, alertasAcordos, acordoDaUnidade, cobrancasDoAcordo } from '../cobranca/acordos.js';` (junte com o import existente numa linha só);
  - `import { confirmarPagamentoAsaas } from '../cobranca/acoes.js';`;
  - `import { devedores } from '../cobranca/regras.js';` (junte com `rotuloCobranca`).
- acrescente ao array:
```js
  {
    nome: 'acordos: proposta só pelo síndico, com auditoria do desconto',
    rodar() {
      const e = estadoAcordo();
      const dados = { unidade: '704', originais: [SET_704, OUT_704], perdoaMulta: true, jurosPerdoadosPct: 0, entrada: 30000, parcelas: 3 };
      igual(proporAcordo(e, dados, 'morador', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      igual(proporAcordo({ ...e, plano: 'basico' }, dados, 'sindico', AGORA_FASE2).erro, 'Disponível no plano Intermediário');
      const r = proporAcordo(e, dados, 'sindico', AGORA_FASE2);
      const a = r.estado.financeiro.acordos.find((x) => x.id === r.id);
      igual([r.id, a.situacao, a.total, a.desconto, r.notificacao.texto], ['AC-002', 'aguardando', 174385, 3460, 'Proposta AC-002 enviada a Vicente Moraes']);
      igual(r.estado.financeiro.cobrancas.filter((c) => [SET_704, OUT_704].includes(c.id)).map((c) => c.status), ['aberta', 'aberta']);
      igual(r.estado.financeiro.auditoria.slice(-2).map((x) => x.acao), ['Proposta de acordo', 'Desconto em acordo']);
      igual(acordoDaUnidade(r.estado, '704'), 'aguardando');
      igual(alertasAcordos(r.estado, HOJE_ACORDO).map((x) => x.texto).includes('Proposta AC-002 aguarda aceite de Vicente Moraes'), true);
      igual(simularAcordo(r.estado, { ...dados, originais: [SET_704] }, HOJE_ACORDO).motivo, 'Este débito já está no acordo AC-002');
    },
  },
  {
    nome: 'acordos: cancelar proposta libera os débitos',
    rodar() {
      const r = proporAcordo(estadoAcordo(), { unidade: '704', originais: [SET_704], entrada: 0, parcelas: 2 }, 'sindico', AGORA_FASE2);
      igual(cancelarProposta(r.estado, 'AC-002', 'morador', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      const c = cancelarProposta(r.estado, 'AC-002', 'sindico', AGORA_FASE2);
      igual([c.estado.financeiro.acordos.find((x) => x.id === 'AC-002').situacao, debitosParaAcordo(c.estado, '704', HOJE_ACORDO).length], ['cancelado', 2]);
      igual(cancelarProposta(c.estado, 'AC-002', 'sindico', AGORA_FASE2).erro, 'Só propostas aguardando aceite podem ser canceladas');
    },
  },
  {
    nome: 'acordos: aceite cancela as originais e cria entrada e parcelas',
    rodar() {
      const p = proporAcordo(estadoAcordo(), { unidade: '704', originais: [SET_704, OUT_704], perdoaMulta: true, entrada: 30000, parcelas: 3 }, 'sindico', AGORA_FASE2).estado;
      igual(aceitarAcordo(p, 'AC-002', { quem: 'Ana Souza', ciente: true }, AGORA_FASE2).erro, 'Só o responsável financeiro pode aceitar o acordo');
      igual(aceitarAcordo(p, 'AC-002', { quem: 'Vicente Moraes', ciente: false }, AGORA_FASE2).erro, 'Marque que leu e aceita as condições');
      igual(aceitarAcordo({ ...p, plano: 'basico' }, 'AC-002', { quem: 'Vicente Moraes', ciente: true }, AGORA_FASE2).erro, 'Disponível no plano Intermediário');
      const r = aceitarAcordo(p, 'AC-002', { quem: 'Vicente Moraes', ciente: true }, AGORA_FASE2);
      const fin = r.estado.financeiro;
      igual(fin.cobrancas.filter((c) => [SET_704, OUT_704].includes(c.id)).map((c) => [c.status, c.substituidaPor]), [['cancelada', 'AC-002'], ['cancelada', 'AC-002']]);
      igual(cobrancasDoAcordo(r.estado, 'AC-002').map((c) => [c.id, c.vencimento, c.valor, c.itens[0].descricao]), [
        ['AC-002-E', '2026-10-22', 30000, 'Acordo AC-002 · entrada'],
        ['AC-002-P1', '2026-11-10', 48128, 'Acordo AC-002 · parcela 1/3'],
        ['AC-002-P2', '2026-12-10', 48128, 'Acordo AC-002 · parcela 2/3'],
        ['AC-002-P3', '2027-01-10', 48129, 'Acordo AC-002 · parcela 3/3'],
      ]);
      igual([fin.acordos.find((a) => a.id === 'AC-002').situacao, fin.acordos.find((a) => a.id === 'AC-002').aceitoPor, r.notificacao.texto], ['ativo', 'Vicente Moraes', 'Acordo AC-002 aceito. A entrada vence em 22/10/2026.']);
      igual(devedores(r.estado, HOJE_ACORDO).some((d) => d.unidade === '704'), false);
      igual(aceitarAcordo(r.estado, 'AC-002', { quem: 'Vicente Moraes', ciente: true }, AGORA_FASE2).erro, 'Esta proposta não está aguardando aceite');
    },
  },
  {
    nome: 'acordos: termo de confissão obrigatório no Avançado',
    rodar() {
      const avancado = { ...estadoAcordo(), plano: 'avancado' };
      const p = proporAcordo(avancado, { unidade: '704', originais: [OUT_704], entrada: 0, parcelas: 2 }, 'sindico', AGORA_FASE2).estado;
      igual(aceitarAcordo(p, 'AC-002', { quem: 'Vicente Moraes', ciente: true }, AGORA_FASE2).erro, 'Leia o termo de confissão antes de aceitar');
      const lido = marcarTermoLido(p, 'AC-002', AGORA_FASE2).estado;
      igual(aceitarAcordo(lido, 'AC-002', { quem: 'Vicente Moraes', ciente: true }, AGORA_FASE2).estado.financeiro.acordos.find((a) => a.id === 'AC-002').situacao, 'ativo');
    },
  },
  {
    nome: 'acordos: pagar a última parcela quita o acordo',
    rodar() {
      const p = proporAcordo(estadoAcordo(), { unidade: '704', originais: [OUT_704], entrada: 0, parcelas: 1 }, 'sindico', AGORA_FASE2).estado;
      const a = aceitarAcordo(p, 'AC-002', { quem: 'Vicente Moraes', ciente: true }, AGORA_FASE2).estado;
      const r = confirmarPagamentoAsaas(a, 'AC-002-P1', 'evt-q', 'pix', AGORA_FASE2);
      igual([r.estado.financeiro.acordos.find((x) => x.id === 'AC-002').situacao, r.notificacao.texto.endsWith('· acordo AC-002 quitado')], ['quitado', true]);
    },
  },
```

- [ ] **Step 2: Rodar e ver falhar**
  - Run: `npm test`
  - Expected: FAIL (`proporAcordo` não exportado).

- [ ] **Step 3: Implementar as ações**
  - No topo de `src/cobranca/acordos.js`:
    - imports a acrescentar, cada um numa linha:
      - `import { SINDICO } from '../dados.js';`
      - `import { isoDia, fmtDataCurta } from '../datas.js';`, juntando com o import de datas existente: `import { isoDia, somarDias, somarMes, fmtDataCurta } from '../datas.js';`
      - `import { SO_SINDICO, comFinanceiro, comAuditoria, nomeResponsavel } from './acoes.js';`
    - troque o import de regras por `import { situacaoCobranca, valorAtualizado, fmtReais, podeOperar, rotuloCobranca } from './regras.js';`
  - No fim do arquivo:
```js
function erroAcordo(estado, mensagem) {
  return { estado, erro: mensagem };
}

function cobrancaDoAcordo(acordo, linha) {
  const marca = { id: acordo.id, numero: linha.numero, de: acordo.parcelas };
  return {
    id: `${acordo.id}-${linha.numero ? `P${linha.numero}` : 'E'}`, unidade: acordo.unidade, competencia: linha.vencimento.slice(0, 7), vencimento: linha.vencimento,
    itens: [{ tipo: 'acordo', descricao: rotuloCobranca({ acordo: marca }), valor: linha.valor }], valor: linha.valor,
    status: 'aberta', pagaEm: null, valorPago: null, forma: null, baixaManual: null, eventosAsaas: [], regua: [], substituiu: null, acordo: marca,
  };
}

export function proporAcordo(estado, dados, perfil, agora) {
  if (!podeOperar(perfil)) return erroAcordo(estado, SO_SINDICO);
  if (!liberado(estado.plano, 'acordos')) return erroAcordo(estado, planoInsuficiente('acordos'));
  const s = simularAcordo(estado, dados, isoDia(agora));
  if (!s.ok) return erroAcordo(estado, s.motivo);
  const fin = estado.financeiro;
  const id = `AC-${String(fin.acordos.length + 1).padStart(3, '0')}`;
  const entrada = dados.entrada || 0;
  const acordo = {
    id, unidade: dados.unidade, originais: [...dados.originais], valorOriginal: s.valorOriginal, multa: s.multa, juros: s.juros,
    perdoaMulta: !!dados.perdoaMulta, jurosPerdoadosPct: dados.jurosPerdoadosPct || 0, desconto: s.desconto, total: s.total,
    entrada, parcelas: dados.parcelas, valorParcela: s.valorParcela, situacao: 'aguardando',
    criadoEm: agora.toISOString(), criadoPor: SINDICO, aceitoEm: null, aceitoPor: null, termoLidoEm: null,
  };
  let auditoria = comAuditoria(estado, agora, 'Proposta de acordo', `${id} · apto ${dados.unidade} · ${fmtReais(s.total)} em ${entrada ? 'entrada + ' : ''}${dados.parcelas}x`);
  if (s.desconto) auditoria = [...auditoria, { em: agora.toISOString(), quem: SINDICO, acao: 'Desconto em acordo', detalhe: `${id} · ${fmtReais(s.desconto)} perdoados de multa e juros` }];
  const nome = nomeResponsavel(estado, dados.unidade);
  return {
    estado: comFinanceiro(estado, { acordos: [...fin.acordos, acordo], auditoria }),
    id,
    notificacao: { canal: 'App + e-mail + WhatsApp', para: nome, texto: `Proposta ${id} enviada a ${nome}` },
  };
}

export function cancelarProposta(estado, id, perfil, agora) {
  if (!podeOperar(perfil)) return erroAcordo(estado, SO_SINDICO);
  const fin = estado.financeiro;
  const acordo = fin.acordos.find((a) => a.id === id);
  if (!acordo || acordo.situacao !== 'aguardando') return erroAcordo(estado, 'Só propostas aguardando aceite podem ser canceladas');
  return {
    estado: comFinanceiro(estado, {
      acordos: fin.acordos.map((a) => (a.id === id ? { ...a, situacao: 'cancelado' } : a)),
      auditoria: comAuditoria(estado, agora, 'Proposta cancelada', `${id} · apto ${acordo.unidade}`),
    }),
  };
}

export function marcarTermoLido(estado, id, agora) {
  const fin = estado.financeiro;
  if (!fin.acordos.some((a) => a.id === id)) return erroAcordo(estado, 'Acordo não encontrado');
  return { estado: comFinanceiro(estado, { acordos: fin.acordos.map((a) => (a.id === id ? { ...a, termoLidoEm: a.termoLidoEm || agora.toISOString() } : a)) }) };
}

export function aceitarAcordo(estado, id, { quem, ciente }, agora) {
  const fin = estado.financeiro;
  const acordo = fin.acordos.find((a) => a.id === id);
  if (!acordo || acordo.situacao !== 'aguardando') return erroAcordo(estado, 'Esta proposta não está aguardando aceite');
  if (!liberado(estado.plano, 'acordos')) return erroAcordo(estado, planoInsuficiente('acordos'));
  const responsavel = fin.unidades[acordo.unidade].responsavel;
  if (!responsavel || responsavel.nome !== quem) return erroAcordo(estado, 'Só o responsável financeiro pode aceitar o acordo');
  if (!ciente) return erroAcordo(estado, 'Marque que leu e aceita as condições');
  if (liberado(estado.plano, 'termoConfissao') && !acordo.termoLidoEm) return erroAcordo(estado, 'Leia o termo de confissão antes de aceitar');
  const cronograma = cronogramaDoAcordo(estado, acordo, isoDia(agora));
  const novas = cronograma.map((linha) => cobrancaDoAcordo(acordo, linha));
  const primeira = cronograma[0];
  return {
    estado: comFinanceiro(estado, {
      cobrancas: [...fin.cobrancas.map((c) => (acordo.originais.includes(c.id) ? { ...c, status: 'cancelada', substituidaPor: id } : c)), ...novas],
      acordos: fin.acordos.map((a) => (a.id === id ? { ...a, situacao: 'ativo', aceitoEm: agora.toISOString(), aceitoPor: quem } : a)),
      auditoria: [...fin.auditoria, { em: agora.toISOString(), quem, acao: 'Acordo aceito', detalhe: `${id} · apto ${acordo.unidade} · ${acordo.originais.length} débitos substituídos` }],
    }),
    notificacao: { canal: 'App', para: SINDICO, texto: `Acordo ${id} aceito. ${primeira.numero ? 'A parcela 1' : 'A entrada'} vence em ${fmtDataCurta(primeira.vencimento)}.` },
  };
}
```
  - Em `src/cobranca/acoes.js`:
    - mude o import de regras para incluir `rotuloCobranca`;
    - acrescente depois de `nomeResponsavel`:
```js
function nomeCurtoCobranca(cobranca) {
  return cobranca.acordo ? rotuloCobranca(cobranca) : mesExtenso(cobranca.competencia);
}

function comQuitacao(estado, cobranca) {
  if (!cobranca.acordo) return { estado, quitado: null };
  const id = cobranca.acordo.id;
  const fin = estado.financeiro;
  if (fin.cobrancas.some((c) => c.acordo && c.acordo.id === id && c.status === 'aberta')) return { estado, quitado: null };
  return { estado: comFinanceiro(estado, { acordos: fin.acordos.map((a) => (a.id === id && a.situacao === 'ativo' ? { ...a, situacao: 'quitado' } : a)) }), quitado: id };
}
```
  - Em `confirmarPagamentoAsaas`, troque o `return` final por:
```js
  const pago = comFinanceiro(estado, {
    cobrancas: trocarCobranca(fin.cobrancas, idCobranca, { status: 'paga', pagaEm: agora.toISOString(), valorPago: total, forma, eventosAsaas: [...c.eventosAsaas, idEvento] }),
    saldo: fin.saldo + total,
  });
  const q = comQuitacao(pago, c);
  return {
    estado: q.estado,
    notificacao: { canal: 'Asaas', para: nomeResponsavel(estado, c.unidade), texto: `Pagamento recebido: ${fmtReais(total)} · recibo enviado${q.quitado ? ` · acordo ${q.quitado} quitado` : ''}` },
  };
```
  - Em `baixaManual`, faça o mesmo:
    - o `comFinanceiro(...)` atual passa a ser `const pago = comFinanceiro(estado, {...})`, com `mesExtenso(c.competencia)` trocado por `nomeCurtoCobranca(c)` na auditoria;
    - depois vem `const q = comQuitacao(pago, c);`;
    - e o retorno fica `return { estado: q.estado, notificacao: { canal: 'App', para: nomeResponsavel(estado, c.unidade), texto: `Pagamento de ${nomeCurtoCobranca(c)} registrado pelo síndico${q.quitado ? ` · acordo ${q.quitado} quitado` : ''}` } };`.
  - Em `cancelarEReemitir` e `enviarSegundaVia`, troque `mesExtenso(c.competencia)` por `nomeCurtoCobranca(c)`.
  - Em `executarRegua`, acrescente `rotulo: rotuloCobranca(p.cobranca)` em cada item de `resumo`.

- [ ] **Step 4: Rodar e ver passar**
  - Run: `npm test`
  - Expected: PASS, 110 testes.

- [ ] **Step 5: Commit**
```bash
git add src && git commit -m "feat(acordos): propor, cancelar, ler termo, aceitar e quitar acordos"
```

---

### Task 4: Seed do AC-001 (304) e integração com indicadores

**Files:**
- Modify: `src/cobranca/dados.js` (junho e julho da 304), `src/cobranca/acordos.js` (`comAcordoInicial`), `src/dados.js` (aplica o seed), `src/cobranca/regras.js` (indicadores sem parcelas, devedores com `acordo`)
- Test: `src/casos/acordos.js`, `src/casos/cobranca-dados.js`, `src/casos/cobranca-regras.js`, `src/casos/cobranca-acoes.js`

**Interfaces:**
- Produces:
  - `comAcordoInicial(estado)` devolve o estado com o AC-001;
  - cada linha de `devedores(...)` ganha o campo `acordo: 'ativo' | 'aguardando' | null`;
  - em `indicadoresFinanceiros`, as cobranças de acordo ficam fora de cada competência.

- [ ] **Step 1: Testes**
  - Em `src/casos/acordos.js`, acrescente `progressoAcordo` ao import de acordos e:
```js
  {
    nome: 'acordos: AC-001 da 304 com parcela 2 vencida',
    rodar() {
      const e = estadoAcordo();
      const a = e.financeiro.acordos[0];
      igual([a.id, a.unidade, a.situacao, a.valorOriginal, a.multa, a.juros, a.desconto, a.total, a.entrada, a.parcelas, a.valorParcela, a.aceitoPor], ['AC-001', '304', 'ativo', 143000, 2860, 1955, 2860, 144955, 30000, 4, 28738, 'Otávio Reis']);
      igual(e.financeiro.cobrancas.filter((c) => ['CB-2026-06-304', 'CB-2026-07-304'].includes(c.id)).map((c) => [c.status, c.substituidaPor]), [['cancelada', 'AC-001'], ['cancelada', 'AC-001']]);
      igual(cobrancasDoAcordo(e, 'AC-001').map((c) => [c.id, c.vencimento, c.valor, c.status]), [
        ['AC-001-E', '2026-08-08', 30000, 'paga'],
        ['AC-001-P1', '2026-09-10', 28738, 'paga'],
        ['AC-001-P2', '2026-10-10', 28738, 'aberta'],
        ['AC-001-P3', '2026-11-10', 28738, 'aberta'],
        ['AC-001-P4', '2026-12-10', 28741, 'aberta'],
      ]);
      igual(cobrancasDoAcordo(e, 'AC-001')[2].regua.map((r) => r.etapa), ['antes5', 'vencimento']);
      igual([e.financeiro.saldo, progressoAcordo(e, a).pagas, progressoAcordo(e, a).total, progressoAcordo(e, a).proxima.id], [4835000, 1, 4, 'AC-001-P2']);
      igual(alertasAcordos(e, HOJE_ACORDO).map((x) => x.texto), ['Acordo AC-001 (304): parcela 2 vencida']);
      igual(e.financeiro.auditoria.map((x) => x.acao), ['Proposta de acordo', 'Desconto em acordo', 'Acordo aceito']);
    },
  },
  {
    nome: 'acordos: baixa manual das últimas parcelas quita o AC-001',
    rodar() {
      let e = estadoAcordo();
      for (const id of ['AC-001-P2', 'AC-001-P3', 'AC-001-P4']) e = baixaManual(e, id, { data: HOJE_ACORDO, comprovante: 'c.pdf' }, 'sindico', AGORA_FASE2).estado;
      igual([e.financeiro.acordos[0].situacao, acordoDaUnidade(e, '304')], ['quitado', null]);
    },
  },
```
  e mude o import de acoes para `import { confirmarPagamentoAsaas, baixaManual } from '../cobranca/acoes.js';`.
  - **Atualizações em `src/casos/cobranca-dados.js`:**
    - no caso "outubro com 31 emitidas", troque o filtro por `.filter((c) => c.competencia === '2026-10' && !c.acordo)`;
    - no caso "débitos antigos", troque o filtro por `.filter((c) => c.status === 'aberta' && !c.acordo && c.competencia !== '2026-10')`.
  - **Atualizações em `src/casos/cobranca-regras.js`:**
    - no `resumo('intermediario')`, acrescente `['304', '2026-10', 'atraso1']` no fim da lista esperada;
    - em devedores, acrescente a linha `['304', 1, 29399, 9, 'atraso1', 'Otávio Reis']` no fim;
    - em indicadores, `inadimplencia: { unidades: 4, total: 32, pct: 12.5, valor: 563827, alerta: true }`;
    - novo caso:
```js
  {
    nome: 'cobrança: devedores marcam acordo ativo',
    rodar() {
      igual(devedores(estadoFase2(), HOJE_FASE2).map((d) => [d.unidade, d.acordo]), [['202', null], ['704', null], ['503', null], ['304', 'ativo']]);
    },
  },
```
  - **Atualizações em `src/casos/cobranca-acoes.js`:**
    - emissão: `r.estado.financeiro.auditoria.at(-1).acao`;
    - baixa: `devedores(...).length` passa de 2 para 3;
    - régua: `[7, '4 responsáveis']`;
    - cancelar e reemitir: `devedores(...).length` passa de 3 para 4.

- [ ] **Step 2: Rodar e ver falhar**
  - Run: `npm test`
  - Expected: FAIL nos casos novos e nos atualizados.

- [ ] **Step 3: Implementar**
  - **`src/cobranca/dados.js`:** depois das duas linhas `cobrancas.push(novaCobranca('302', ...))`, acrescente:
```js
  // Débitos de junho e julho da 304, substituídos pelo acordo AC-001 (ver comAcordoInicial).
  cobrancas.push(novaCobranca('304', somarMes(vigente, -4), mesmoDiaDoMes(vencimentoVigente, -4), 'aberta'));
  cobrancas.push(novaCobranca('304', somarMes(vigente, -3), mesmoDiaDoMes(vencimentoVigente, -3), 'aberta'));
```
  - **`src/cobranca/acordos.js`:**
    - import: `import { confirmarPagamentoAsaas } from './acoes.js';`, juntando com o import de acoes existente;
    - datas: `momento` no import de datas;
    - no fim:
```js
// Acordo antigo da 304, gerado pelas próprias ações: proposto e aceito no dia 5 de dois meses atrás, entrada e parcela 1 pagas.
export function comAcordoInicial(estado) {
  const fin = estado.financeiro;
  const dia = momento(`${somarMes(fin.vigente, -2)}-05`, 10);
  const originais = fin.cobrancas.filter((c) => c.unidade === '304' && c.status === 'aberta').map((c) => c.id);
  let e = proporAcordo(estado, { unidade: '304', originais, perdoaMulta: true, jurosPerdoadosPct: 0, entrada: 30000, parcelas: 4 }, 'sindico', dia).estado;
  e = aceitarAcordo(e, 'AC-001', { quem: 'Otávio Reis', ciente: true }, dia).estado;
  for (const id of ['AC-001-E', 'AC-001-P1']) {
    const c = e.financeiro.cobrancas.find((x) => x.id === id);
    e = confirmarPagamentoAsaas(e, id, `evt-${id}-pix`, 'pix', momento(somarDias(c.vencimento, -1), 11)).estado;
  }
  const p2 = e.financeiro.cobrancas.find((x) => x.id === 'AC-001-P2');
  const regua = [{ etapa: 'antes5', em: momento(somarDias(p2.vencimento, -5), 9).toISOString() }, { etapa: 'vencimento', em: momento(p2.vencimento, 9).toISOString() }];
  return comFinanceiro(e, { saldo: fin.saldo, cobrancas: e.financeiro.cobrancas.map((c) => (c.id === p2.id ? { ...c, regua } : c)) });
}
```
  - **`src/dados.js`:**
    - import: `import { comAcordoInicial } from './cobranca/acordos.js';`;
    - em `dadosIniciais`, troque `return {` por `return comAcordoInicial({` e o `};` final por `});`.
  - **`src/cobranca/regras.js`:**
    - em `indicadoresFinanceiros`, `daCompetencia` passa a filtrar `c.competencia === competencia && c.status !== 'cancelada' && !c.acordo`;
    - em `devedores`, o grupo inicial ganha `acordo: null`;
    - antes do `return`, acrescente `for (const g of Object.values(grupos)) g.acordo = acordoDaUnidade(estado, g.unidade);`;
    - e o import `import { acordoDaUnidade } from './acordos.js';`.

- [ ] **Step 4: Rodar e ver passar**
  - Run: `npm test`
  - Expected: PASS, 113 testes.

- [ ] **Step 5: Commit**
```bash
git add src && git commit -m "feat(acordos): acordo AC-001 da 304 nos dados iniciais e integração com devedores e indicadores"
```

---

### Task 5: UI do síndico (aba Acordos, Devedores, alertas)

**Files:**
- Create: `src/ui/acordos.js`
- Modify: `src/ui/financeiro-sindico.js` (aba, roteamento, Devedores, alertas, filtro de Emitidas, rótulos, `export` de DetalheCobranca), `src/ui/sindico.js` (EM_BREVE sem Acordos), `montagem.mjs` (ORDEM), `src/estilos.css`, `verificar.mjs`

**Interfaces:**
- Consumes: as regras e ações das Tasks 2 a 4, e `EtqCobranca`, `Bloqueado` e `DetalheCobranca` de `./financeiro-sindico.js`.
- Produces, em `src/ui/acordos.js`: os componentes `CAcordos` (aba do síndico), `PropostaAcordo`, `MeuAcordo` e `EtqAcordo`, e o ajudante `termoDoAcordo(acordo)`. Os componentes do morador são usados na Task 6.

- [ ] **Step 1: Checagens primeiro (verificar.mjs)**
  - Troque `'3 de 32'` por `'4 de 32'` na checagem de `#sindico.inicio`.
  - Acrescente ao fim de CHECAGENS:
```js
  ['#sindico.cobranca.acordos', ['AC-001', 'Otávio Reis', '1 de 4 parcelas pagas', 'Ativo', 'Novo acordo']],
  ['#sindico.cobranca.AC-001', ['Acordo AC-001 · apto 304', 'Parcela 2/4', 'Vencida', 'Proposta de acordo', 'Desconto em acordo', 'Acordo aceito']],
  ['#sindico.cobranca.novoacordo-704', ['Novo acordo', 'Perdoar a multa', 'Total do acordo', 'Enviar proposta']],
  ['#sindico.inicio', ['Acordo AC-001 (304): parcela 2 vencida', 'Propor acordo', 'acordo ativo', '!>Acordos<small>']],
```
  - A última condição garante que "Acordos" saiu do menu "Em breve". Ela é frágil; se a marcação do menu mudar, troque-a por `'!>Acordos<small>'`.

- [ ] **Step 2: Rodar e ver falhar**
  - Run: `npm run montar && npm run verificar`
  - Expected: FALHA nas checagens novas.

- [ ] **Step 3: Implementar**
  - **ORDEM:** acrescente `'src/ui/acordos.js'` logo depois de `'src/ui/financeiro-sindico.js'`.
  - **`src/ui/sindico.js`:** `const EM_BREVE = ['Notificações e OS', 'Zelador', 'Escala de porteiros'];`
  - **`src/ui/financeiro-sindico.js`:**
    - imports:
      - `import { CAcordos } from './acordos.js';`;
      - `rotuloCobranca` no import de regras;
      - `import { alertasAcordos } from '../cobranca/acordos.js';`.
    - `pendenciasCobranca`: antes do `return itens;`, acrescente `itens.push(...alertasAcordos(estado, hoje));`.
    - `ListaDevedores`:
      - no cabeçalho, acrescente `<th>Acordo</th>` depois de "Etapa da régua";
      - em cada linha, acrescente:
```js
<td>${d.acordo ? html`<${Etiqueta} tipo=${d.acordo === 'ativo' ? 'info' : 'alerta'}>${d.acordo === 'ativo' ? 'acordo ativo' : 'proposta enviada'}<//>` : liberado(estado.plano, 'acordos') ? html`<a class="btn-link" data-propor=${d.unidade} href=${`#sindico.cobranca.novoacordo-${d.unidade}`}>Propor acordo</a>` : '—'}</td>
```
    - `ABAS_COBRANCA`: `[['previa', 'Prévia e emissão'], ['emitidas', 'Cobranças emitidas'], ['acordos', 'Acordos'], ['regua', 'Régua'], ['parametros', 'Parâmetros']]`.
    - `SCobranca`, troque as duas primeiras linhas por:
```js
  const idRota = props.rota.id || '';
  const deAcordo = idRota.startsWith('novoacordo') || idRota.startsWith('AC-');
  const aba = deAcordo ? 'acordos' : ABAS_COBRANCA.some(([id]) => id === idRota) ? idRota : 'previa';
  const Conteudo = { previa: CPrevia, emitidas: CEmitidas, acordos: CAcordos, regua: CRegua, parametros: CParametros }[aba];
```
    - `DetalheCobranca`: troque `function DetalheCobranca` por `export function DetalheCobranca` e, no título, `nomeMes(cobranca.competencia)` por `rotuloCobranca(cobranca)`.
    - `CEmitidas`:
      - `competencias` vem de `fin.cobrancas.filter((c) => !c.acordo)`;
      - o filtro de `lista` ganha `!c.acordo &&` no início.
    - `CRegua`: no resumo, troque `nomeMes(r.competencia)` por `r.rotulo`.
  - **Crie `src/ui/acordos.js`:**
```js
import { html, useState } from '../vendor.js';
import { fmtReais, situacaoCobranca, valorAtualizado, rotuloCobranca } from '../cobranca/regras.js';
import { debitosParaAcordo, simularAcordo, cronogramaDoAcordo, cobrancasDoAcordo, progressoAcordo } from '../cobranca/acordos.js';
import { proporAcordo, cancelarProposta, marcarTermoLido, aceitarAcordo } from '../cobranca/acordos.js';
import { lerPreco, pessoaDaUnidade } from '../vendas/regras.js';
import { liberado } from '../planos.js';
import { isoDia, fmtDataCurta, fmtDataHora } from '../datas.js';
import { ir, Campo, Erro, Sucesso, Vazio, Etiqueta, PrevDoc } from './comum.js';
import { EtqCobranca, Bloqueado, DetalheCobranca } from './financeiro-sindico.js';

const ETQ_ACORDO = { aguardando: 'alerta', ativo: 'info', quitado: 'ok', cancelado: 'neutro' };
const NOMES_SITUACAO_ACORDO = { aguardando: 'Aguardando aceite', ativo: 'Ativo', quitado: 'Quitado', cancelado: 'Cancelado' };

export function EtqAcordo({ situacao }) {
  return html`<${Etiqueta} tipo=${ETQ_ACORDO[situacao]}>${NOMES_SITUACAO_ACORDO[situacao]}<//>`;
}

export function termoDoAcordo(acordo) {
  return { titulo: `Termo de confissão de dívida · ${acordo.id} · apto ${acordo.unidade}`, pasta: 'Financeiro', versoes: [{ versao: 1, data: isoDia(new Date(acordo.criadoEm)) }] };
}

function nomeLinha(numero, de) {
  return numero ? `Parcela ${numero}/${de}` : 'Entrada';
}

function ResumoAcordo({ estado, acordo }) {
  const originais = estado.financeiro.cobrancas.filter((c) => acordo.originais.includes(c.id));
  return html`<dl class="resumo">
    <dt>Débitos incluídos</dt><dd>${originais.map((c) => rotuloCobranca(c)).join(', ')}</dd>
    <dt>Valor original</dt><dd>${fmtReais(acordo.valorOriginal)}</dd>
    <dt>Multa e juros</dt><dd>${fmtReais(acordo.multa + acordo.juros)}</dd>
    <dt>Desconto</dt><dd>${fmtReais(-acordo.desconto)}</dd>
    <dt>Total do acordo</dt><dd><strong>${fmtReais(acordo.total)}</strong></dd>
  </dl>`;
}

function Cronograma({ estado, acordo, hoje, aoAbrir }) {
  if (['aguardando', 'cancelado'].includes(acordo.situacao)) {
    return html`<ul class="itens-sacola">${cronogramaDoAcordo(estado, acordo, hoje).map((l) => html`<li key=${l.numero}><span>${nomeLinha(l.numero, acordo.parcelas)} · ${fmtDataCurta(l.vencimento)}</span><span>${fmtReais(l.valor)}</span></li>`)}</ul>`;
  }
  return html`<ul class="itens-sacola cronograma">${cobrancasDoAcordo(estado, acordo.id).map((c) => html`<li key=${c.id}>
    <span>${nomeLinha(c.acordo.numero, c.acordo.de)} · ${fmtDataCurta(c.vencimento)}</span>
    <span class="cronograma-fim">${fmtReais(c.valor)} <${EtqCobranca} situacao=${situacaoCobranca(c, hoje)} />${aoAbrir && html` <button type="button" class="btn-link" data-cobranca=${c.id} onClick=${() => aoAbrir(c.id)}>Detalhes</button>`}</span>
  </li>`)}</ul>`;
}

export function CAcordos(props) {
  const { estado, rota } = props;
  if (!liberado(estado.plano, 'acordos')) return html`<${Bloqueado} estado=${estado} recurso="acordos" titulo="Acordos de inadimplência com parcelamento e desconto" />`;
  const id = rota.id || '';
  if (id.startsWith('novoacordo')) return html`<${NovoAcordo} key=${id} ...${props} unidadeInicial=${id.split('-')[1] || null} />`;
  const acordo = estado.financeiro.acordos.find((a) => a.id === id);
  if (acordo) return html`<${DetalheAcordo} key=${acordo.id} ...${props} acordo=${acordo} />`;
  return html`<${ListaAcordos} ...${props} />`;
}

function ListaAcordos({ estado, agora }) {
  const fin = estado.financeiro;
  const hoje = isoDia(agora);
  const lista = [...fin.acordos].reverse();
  return html`<div class="pilha">
    <div class="linha-entre"><h2>Acordos</h2><a class="btn primario" href="#sindico.cobranca.novoacordo">Novo acordo</a></div>
    ${lista.length
      ? html`<div class="tabela-rolagem"><table class="tabela">
          <thead><tr><th>Acordo</th><th>Unidade</th><th>Situação</th><th>Progresso</th><th>Próxima</th><th>Ação</th></tr></thead>
          <tbody>${lista.map((a) => {
            const p = progressoAcordo(estado, a);
            const r = fin.unidades[a.unidade].responsavel;
            return html`<tr key=${a.id}>
              <td>${a.id}</td>
              <td>${a.unidade} · ${r ? r.nome : '—'}</td>
              <td><${EtqAcordo} situacao=${a.situacao} /></td>
              <td>${p.pagas} de ${p.total} parcelas pagas</td>
              <td>${p.proxima ? html`${fmtDataCurta(p.proxima.vencimento)}${situacaoCobranca(p.proxima, hoje) === 'vencida' ? html` <${EtqCobranca} situacao="vencida" />` : ''}` : '—'}</td>
              <td><a class="btn-link" data-acordo=${a.id} href=${`#sindico.cobranca.${a.id}`}>Abrir</a></td>
            </tr>`;
          })}</tbody>
        </table></div>`
      : html`<${Vazio} texto="Nenhum acordo ainda." />`}
    <small class="sub">As parcelas viram cobranças comuns: pagamento pelo Asaas, baixa manual e régua funcionam igual.</small>
  </div>`;
}

function NovoAcordo({ estado, executar, agora, unidadeInicial }) {
  const hoje = isoDia(agora);
  const fin = estado.financeiro;
  const unidades = estado.condominio.unidades.filter((u) => debitosParaAcordo(estado, u, hoje).length);
  const inicial = unidades.includes(unidadeInicial) ? unidadeInicial : unidades[0] || '';
  const [unidade, setUnidade] = useState(inicial);
  const [marcados, setMarcados] = useState(inicial ? debitosParaAcordo(estado, inicial, hoje).map((c) => c.id) : []);
  const [perdoaMulta, setPerdoaMulta] = useState(false);
  const [jurosPct, setJurosPct] = useState('0');
  const [entrada, setEntrada] = useState('');
  const [parcelas, setParcelas] = useState('3');
  const [erro, setErro] = useState(null);
  const voltar = html`<a class="voltar" href="#sindico.cobranca.acordos">‹ Acordos</a>`;
  if (!unidades.length) return html`<div class="pilha">${voltar}<${Vazio} texto="Nenhuma unidade com débito vencido." /></div>`;
  const debitos = debitosParaAcordo(estado, unidade, hoje);
  const dados = { unidade, originais: marcados, perdoaMulta, jurosPerdoadosPct: Number(jurosPct), entrada: entrada.trim() ? lerPreco(entrada) : 0, parcelas: Number(parcelas) };
  const s = simularAcordo(estado, dados, hoje);

  function trocarUnidade(u) {
    setUnidade(u);
    setMarcados(debitosParaAcordo(estado, u, hoje).map((c) => c.id));
  }

  function enviar() {
    const r = executar((e) => proporAcordo(e, dados, 'sindico', new Date()));
    if (r.erro) setErro(r.erro);
    else ir('sindico', 'cobranca', r.id);
  }

  return html`<div class="pilha formulario">
    ${voltar}
    <h2>Novo acordo</h2>
    <${Campo} rotulo="Unidade"><select id="acordo-unidade" value=${unidade} onChange=${(ev) => trocarUnidade(ev.target.value)}>${unidades.map((u) => html`<option key=${u} value=${u}>${u} · ${fin.unidades[u].responsavel.nome}</option>`)}</select><//>
    <fieldset><legend>Débitos vencidos</legend>
      ${debitos.map((c) => html`<label key=${c.id} class="check"><input id=${`acordo-debito-${c.id}`} type="checkbox" checked=${marcados.includes(c.id)} onChange=${() => setMarcados(marcados.includes(c.id) ? marcados.filter((x) => x !== c.id) : [...marcados, c.id])} /><span>${rotuloCobranca(c)} · ${fmtReais(valorAtualizado(c, fin.parametros, hoje).total)}</span></label>`)}
    </fieldset>
    <label class="check"><input id="acordo-perdoa-multa" type="checkbox" checked=${perdoaMulta} onChange=${() => setPerdoaMulta(!perdoaMulta)} /><span>Perdoar a multa</span></label>
    <div class="edicao-anuncio">
      <${Campo} rotulo="Juros perdoados (%)"><input id="acordo-juros" type="number" min="0" max="100" value=${jurosPct} onInput=${(ev) => setJurosPct(ev.target.value)} /><//>
      <${Campo} rotulo="Entrada (R$)"><input id="acordo-entrada" inputmode="decimal" value=${entrada} onInput=${(ev) => setEntrada(ev.target.value)} placeholder="Ex.: 300,00" /><//>
      <${Campo} rotulo="Parcelas"><select id="acordo-parcelas" value=${parcelas} onChange=${(ev) => setParcelas(ev.target.value)}>${Array.from({ length: 12 }, (_, i) => html`<option key=${i + 1} value=${String(i + 1)}>${i + 1}</option>`)}</select><//>
    </div>
    ${s.ok
      ? html`<div class="cartao simulacao">
          <dl class="resumo">
            <dt>Valor original</dt><dd>${fmtReais(s.valorOriginal)}</dd>
            <dt>Multa e juros</dt><dd>${fmtReais(s.multa + s.juros)}</dd>
            <dt>Desconto</dt><dd>${fmtReais(-s.desconto)}</dd>
            <dt>Total do acordo</dt><dd><strong>${fmtReais(s.total)}</strong></dd>
          </dl>
          <strong>${dados.entrada ? `Entrada de ${fmtReais(dados.entrada)} + ` : ''}${dados.parcelas} × ${fmtReais(s.valorParcela)}${s.ultimaParcela !== s.valorParcela ? ` (a última de ${fmtReais(s.ultimaParcela)})` : ''}</strong>
          <ul class="itens-sacola">${s.cronograma.map((l) => html`<li key=${l.numero}><span>${nomeLinha(l.numero, dados.parcelas)} · ${fmtDataCurta(l.vencimento)}</span><span>${fmtReais(l.valor)}</span></li>`)}</ul>
        </div>`
      : html`<${Erro} texto=${s.motivo} />`}
    <${Erro} texto=${erro} />
    <button type="button" class="btn primario" data-acao="enviar-proposta" disabled=${!s.ok} onClick=${enviar}>Enviar proposta</button>
  </div>`;
}

function DetalheAcordo({ estado, executar, agora, acordo }) {
  const hoje = isoDia(agora);
  const fin = estado.financeiro;
  const [aberta, setAberta] = useState(null);
  const [documento, setDocumento] = useState(null);
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const r = fin.unidades[acordo.unidade].responsavel;
  const selecionada = aberta ? fin.cobrancas.find((c) => c.id === aberta) : null;
  const auditoria = fin.auditoria.filter((a) => a.detalhe.startsWith(acordo.id));
  if (documento) return html`<${PrevDoc} documento=${documento} aoFechar=${() => setDocumento(null)} />`;

  function cancelar() {
    const res = executar((e) => cancelarProposta(e, acordo.id, 'sindico', new Date()));
    setErro(res.erro || null);
    setMensagem(res.erro ? null : 'Proposta cancelada. Os débitos originais continuam valendo.');
  }

  return html`<div class="pilha">
    <a class="voltar" href="#sindico.cobranca.acordos">‹ Acordos</a>
    <div class="linha-entre"><h2>Acordo ${acordo.id} · apto ${acordo.unidade}</h2><${EtqAcordo} situacao=${acordo.situacao} /></div>
    <small class="sub">${r ? r.nome : '—'} · proposto em ${fmtDataCurta(acordo.criadoEm)}${acordo.aceitoEm ? ` · aceito em ${fmtDataCurta(acordo.aceitoEm)} por ${acordo.aceitoPor}` : ''}</small>
    <div class="cartao"><${ResumoAcordo} estado=${estado} acordo=${acordo} /></div>
    <h2>${acordo.situacao === 'aguardando' ? 'Cronograma proposto' : 'Cronograma'}</h2>
    ${selecionada && html`<${DetalheCobranca} key=${selecionada.id} estado=${estado} cobranca=${selecionada} executar=${executar} hoje=${hoje} aoFechar=${() => setAberta(null)} />`}
    <div class="cartao"><${Cronograma} estado=${estado} acordo=${acordo} hoje=${hoje} aoAbrir=${setAberta} /></div>
    <div class="acoes">
      ${liberado(estado.plano, 'termoConfissao') && html`<button type="button" class="btn secundario" onClick=${() => setDocumento(termoDoAcordo(acordo))}>Ver termo de confissão</button>`}
      ${acordo.situacao === 'aguardando' && html`<button type="button" class="btn secundario" onClick=${cancelar}>Cancelar proposta</button>`}
    </div>
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
    <h2>Auditoria</h2>
    <ul class="auditoria">${[...auditoria].reverse().map((a, n) => html`<li key=${n}><span class="lt-quando">${fmtDataHora(a.em)}</span> <strong>${a.acao}</strong> · ${a.detalhe} · ${a.quem}</li>`)}</ul>
  </div>`;
}

export function PropostaAcordo({ estado, executar, acordo, hoje, eu }) {
  const [ciente, setCiente] = useState(false);
  const [documento, setDocumento] = useState(null);
  const [erro, setErro] = useState(null);
  const comTermo = liberado(estado.plano, 'termoConfissao');
  if (documento) return html`<${PrevDoc} documento=${documento} aoFechar=${() => setDocumento(null)} />`;

  function lerTermo() {
    executar((e) => marcarTermoLido(e, acordo.id, new Date()));
    setDocumento(termoDoAcordo(acordo));
  }

  function aceitar() {
    const r = executar((e) => aceitarAcordo(e, acordo.id, { quem: pessoaDaUnidade(estado, eu).nome, ciente }, new Date()));
    setErro(r.erro || null);
  }

  return html`<article class="cartao proposta-acordo">
    <div class="linha-entre"><strong>Proposta de acordo ${acordo.id}</strong><${EtqAcordo} situacao=${acordo.situacao} /></div>
    <small class="sub">Enviada pelo síndico em ${fmtDataCurta(acordo.criadoEm)}. Ao aceitar, os débitos incluídos são substituídos pelas parcelas abaixo.</small>
    <${ResumoAcordo} estado=${estado} acordo=${acordo} />
    <${Cronograma} estado=${estado} acordo=${acordo} hoje=${hoje} />
    ${comTermo && html`<button type="button" class="btn secundario" onClick=${lerTermo}>${acordo.termoLidoEm ? 'Abrir de novo o termo' : 'Ler o termo de confissão de dívida'}</button>`}
    <label class="check"><input id="acordo-ciente" type="checkbox" checked=${ciente} onChange=${() => setCiente(!ciente)} /><span>Li e aceito as condições do acordo</span></label>
    <${Erro} texto=${erro} />
    <button type="button" class="btn primario bloco" onClick=${aceitar}>Aceitar acordo</button>
  </article>`;
}

export function MeuAcordo({ estado, acordo, hoje }) {
  const p = progressoAcordo(estado, acordo);
  const pct = Math.round((p.pagas / p.total) * 100);
  return html`<article class="cartao">
    <div class="linha-entre"><strong>Meu acordo ${acordo.id}</strong><${EtqAcordo} situacao=${acordo.situacao} /></div>
    <small class="sub">${p.pagas} de ${p.total} parcelas pagas · total ${fmtReais(acordo.total)}</small>
    <div class="barra" role="progressbar" aria-label="Parcelas pagas" aria-valuenow=${p.pagas} aria-valuemin="0" aria-valuemax=${p.total}><span style=${`width:${pct}%`}></span></div>
    <details class="composicao"><summary>Cronograma</summary><${Cronograma} estado=${estado} acordo=${acordo} hoje=${hoje} /></details>
  </article>`;
}
```
  - **Imports locais:** imports locais com o mesmo caminho em duas linhas são permitidos? `transformar` remove todas as linhas de import, então funciona. Mesmo assim, para manter o padrão, junte os dois imports de `'../cobranca/acordos.js'` numa linha só.
  - **`src/estilos.css`:** no fim, acrescente:
```css
/* Fase 2: acordos */
.cronograma li { flex-wrap: wrap; gap: 4px 8px; }
.cronograma-fim { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.simulacao strong { color: var(--titulo); }
.proposta-acordo { border-left: 4px solid var(--laranja); }
```

- [ ] **Step 4: Rodar e ver passar**
  - Run: `npm test && npm run montar && npm run verificar`
  - Expected: PASS em todos os testes e checagens.
  -

- [ ] **Step 5: Commit**
```bash
git add src verificar.mjs montagem.mjs && git commit -m "feat(acordos): aba Acordos do síndico, propor acordo nos devedores e alertas"
```

---

### Task 6: Financeiro do Vicente (proposta, aceite, meu acordo)

**Files:**
- Modify: `src/ui/financeiro-morador.js`

**Interfaces:**
- Consumes: `PropostaAcordo` e `MeuAcordo` de `./acordos.js`, e `propostaPendente`, `acordoAtivo` e `rotuloCobranca`.

- [ ] **Step 1: Implementar**
  - **Imports:**
    - `rotuloCobranca` no import de regras;
    - `import { propostaPendente, acordoAtivo } from '../cobranca/acordos.js';`;
    - `import { PropostaAcordo, MeuAcordo } from './acordos.js';`.
  - **`cobrancasDaUnidade(estado, eu, hoje)`:** substitua a função inteira:
```js
function cobrancasDaUnidade(estado, eu, hoje) {
  const minhas = estado.financeiro.cobrancas.filter((c) => c.unidade === eu);
  const todas = minhas.filter((c) => c.status === 'aberta').sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  // Do acordo, só as vencidas ou, se nenhuma venceu, a próxima: o cronograma completo fica em "Meu acordo".
  const comVencida = new Set(todas.filter((c) => c.acordo && c.vencimento < hoje).map((c) => c.acordo.id));
  const vistos = new Set();
  const abertas = todas.filter((c) => {
    if (!c.acordo || c.vencimento < hoje) return true;
    if (comVencida.has(c.acordo.id) || vistos.has(c.acordo.id)) return false;
    vistos.add(c.acordo.id);
    return true;
  });
  return {
    abertas,
    pagas: minhas.filter((c) => c.status === 'paga').sort((a, b) => b.pagaEm.localeCompare(a.pagaEm)),
    substituidas: minhas.filter((c) => c.status === 'cancelada' && c.substituidaPor),
  };
}
```
  - **`CartaoCobrancaInicio`:**
    - logo depois do teste de `souResponsavel`, acrescente:
```js
  const proposta = propostaPendente(estado, eu);
  if (proposta) return html`<a class="cartao link cobranca-inicio" href="#morador.financeiro"><strong>Proposta de acordo do síndico</strong><span class="preco grande">${fmtReais(proposta.total)}</span><small class="sub">${proposta.entrada ? `Entrada de ${fmtReais(proposta.entrada)} + ` : ''}${proposta.parcelas} parcelas · toque para ver e aceitar</small><span class="btn primario">Ver proposta</span></a>`;
```
    - troque `cobrancasDaUnidade(estado, eu)` por `cobrancasDaUnidade(estado, eu, hoje)`;
    - no título, use `Sua cobrança: ${rotuloCobranca(c)}` quando `c.acordo` e `Sua cobrança de ${mesExtenso(c.competencia)}` quando não. A verificação procura "Sua cobrança de", então a forma antiga se mantém.
  - **`CartaoCobranca`:** troque `nomeMes(cobranca.competencia)` por `rotuloCobranca(cobranca)`.
  - **`MFinanceiro`:**
    - `const pessoa = pessoaDaUnidade(estado, eu);` logo depois de `responsavelDaPessoa`;
    - `const { abertas, pagas, substituidas } = cobrancasDaUnidade(estado, eu, hoje);`;
    - `const proposta = propostaPendente(estado, eu);` e `const ativo = acordoAtivo(estado, eu);`;
    - `const vencidaSemAcordo = abertas.some((c) => !c.acordo && situacaoCobranca(c, hoje) === 'vencida');`;
    - no recibo, `nomeMes(c.competencia)` vira `rotuloCobranca(c)`;
    - o subtítulo passa a ser `Responsável financeiro: ${responsavel.nome} · ${pessoa && pessoa.naoResidente ? 'proprietário não residente' : `apto ${eu}`}`;
    - entre o subtítulo e `<h2>Em aberto</h2>`, acrescente:
```js
    ${proposta && html`<${PropostaAcordo} key=${proposta.id} estado=${estado} executar=${executar} acordo=${proposta} hoje=${hoje} eu=${eu} />`}
    ${ativo && html`<${MeuAcordo} estado=${estado} acordo=${ativo} hoje=${hoje} />`}
```
    - depois da lista de "Em aberto", acrescente:
```js
    ${!proposta && !ativo && vencidaSemAcordo && html`<small class="sub">Quer parcelar? Fale com o síndico para propor um acordo.</small>`}
```
    - no Histórico:
      - a lista mostra as `pagas`, com `rotuloCobranca(c)` no lugar de `nomeMes(c.competencia)`;
      - em seguida vêm as substituídas:
```js
          ${substituidas.map((c) => html`<li key=${c.id} class="cartao"><div class="linha-entre"><strong>${nomeMes(c.competencia)}</strong><${EtqCobranca} situacao="cancelada" /></div><small class="sub">Substituída pelo acordo ${c.substituidaPor}</small></li>`)}
```
      - a condição de vazio passa a ser `pagas.length || substituidas.length`.

- [ ] **Step 2: Rodar**
  - Run: `npm test && npm run montar && npm run verificar`
  - Expected: PASS. "Sua cobrança de" e "Responsável financeiro: Ana Souza" continuam aparecendo para a Ana.

- [ ] **Step 3: Commit**
```bash
git add src && git commit -m "feat(acordos): proposta, aceite e meu acordo no Financeiro do responsável"
```

---

### Task 7: Roteiros e2e, largura de celular e publicação

**Files:**
- Modify: `e2e.mjs`

- [ ] **Step 1: Ajustar os roteiros existentes**
  - Em `cobrancaReguaBaixa`:
    - `'6 avisos enviados'` passa a `'7 avisos enviados'`;
    - `'3 responsáveis'` passa a `'4 responsáveis'`;
    - `'2 de 32'` passa a `'3 de 32'`.

- [ ] **Step 2: Novos roteiros**
  - Coloque-os depois de `persistencia` e antes de `larguraCelular`. A `persistencia` termina reiniciando a demonstração, então os novos começam do estado limpo.
```js
  async acordoProposta() {
    await irPara('#sindico.inicio');
    await esperarTexto('Acordo AC-001 (304): parcela 2 vencida');
    await clicarSeletor('[data-propor="704"]');
    await esperarTexto('Enviar proposta');
    await marcar('Perdoar a multa');
    await preencher('Entrada (R$)', '300,00');
    await preencher('Parcelas', '3');
    await esperarTexto('Total do acordo');
    await clicarSeletor('[data-acao="enviar-proposta"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Proposta AC-002 enviada a Vicente Moraes')`, 'o aviso da proposta');
    await esperarTexto('Aguardando aceite');
    await irPara('#morador.inicio');
    await clicar('Vicente · 704');
    await esperarTexto('Proposta de acordo do síndico');
    await irPara('#morador.financeiro');
    await esperarTexto('proprietário não residente');
    await clicar('Aceitar acordo');
    await esperarTexto('Marque que leu e aceita as condições');
    await marcar('Li e aceito as condições do acordo');
    await clicar('Aceitar acordo');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Acordo AC-002 aceito')`, 'o aviso do aceite');
    await esperarTexto('Meu acordo AC-002');
    await esperarTexto('Substituída pelo acordo AC-002');
    await clicar('Pagar com Pix');
    await clicar('Simular confirmação do Asaas');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Pagamento recebido')`, 'o pagamento da entrada');
    await clicar('Ana · 302');
    await irPara('#sindico.cobranca.acordos');
    await esperar(`[...document.querySelectorAll('tr')].some((tr) => tr.innerText.includes('AC-002') && tr.innerText.toLowerCase().includes('ativo'))`, 'o AC-002 ativo na lista');
  },

  async acordoPlanos() {
    await clicar('Reiniciar demonstração');
    await clicar('Básico');
    await irPara('#sindico.cobranca.acordos');
    await esperarTexto('Disponível no plano Intermediário');
    await clicar('Avançado');
    await irPara('#sindico.cobranca.novoacordo-704');
    await esperarTexto('Total do acordo');
    await clicarSeletor('[data-acao="enviar-proposta"]');
    await esperarTexto('Aguardando aceite');
    await irPara('#morador.financeiro');
    await clicar('Vicente · 704');
    await marcar('Li e aceito as condições do acordo');
    await clicar('Aceitar acordo');
    await esperarTexto('Leia o termo de confissão antes de aceitar');
    await clicar('Ler o termo de confissão de dívida');
    await esperarTexto('Termo de confissão de dívida · AC-002');
    await clicar('Fechar');
    await marcar('Li e aceito as condições do acordo');
    await clicar('Aceitar acordo');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Acordo AC-002 aceito')`, 'o aceite com termo');
    await clicar('Ana · 302');
    await clicar('Intermediário');
  },
```
  - Em `larguraCelular`, acrescente à lista de hashes `'#sindico.cobranca.acordos'`, `'#sindico.cobranca.AC-001'` e `'#sindico.cobranca.novoacordo'`.

- [ ] **Step 3: Rodar tudo**
  - Run: `npm test && npm run montar && npm run verificar && npm run e2e`
  - Expected:
    - 113 testes passando;
    - todas as checagens ok;
    - 15 roteiros com `ok`.
  - **Se um roteiro falhar:** use superpowers:systematic-debugging. Se a falha for de largura, ajuste o CSS em "Fase 2: acordos".

- [ ] **Step 4: Commit**
```bash
git add e2e.mjs src && git commit -m "test(acordos): roteiros de proposta, aceite e termo por plano no e2e"
```

- [ ] **Step 5: Publicar e integrar**
  - Republique o Artifact com o mesmo `file_path` `prototipo/condofacil.html`, label "Fase 2: acordos". A URL é https://claude.ai/artifact/U7U8aKxcxM9A1Hbnb9bv9r.
  - Use superpowers:finishing-a-development-branch para o merge ff em `master`. Faça o push quando o usuário concordar.
