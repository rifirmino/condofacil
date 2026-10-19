# Notificações, OS do zelador e compras: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer as Ocorrências evoluírem para Notificações com prazo e criar o perfil Zelador, com OS, compras com aprovação, cotações mínimas e caixa pequeno.

**Architecture:**
- **Regras e ações puras** em `src/notificacoes/` e `src/manutencao/`. As ações devolvem `{ estado, notificacao?, erro? }`.
- **Notificações:** a ocorrência ganha prioridade e ligações (`os`, `advertencia`, `motivoArquivamento`), e os prazos são derivados da linha do tempo.
- **Manutenção:** ganha o estado próprio `estado.manutencao`. O recebimento de compra e a reposição do caixa lançam a despesa em `financeiro`.
- **UI:** `src/ui/manutencao-sindico.js` e `src/ui/zelador.js`.

**Tech Stack:** Preact + htm, ES modules concatenados por `montagem.mjs`, `node --test`, Chrome headless (verificar.mjs, e2e.mjs).

**Spec:** `docs/superpowers/specs/2026-10-19-fase2-manutencao-design.md`

## Global Constraints

- Todos os comandos rodam em `prototipo/`.
- **Imports e nomes:** os imports locais ocupam uma linha cada. Nomes de topo são únicos em todos os arquivos de `src/`. `export` só aparece em declarações de topo.
- **Dinheiro:** em centavos. Limites: caixa R$ 200,00 = 20000; nota obrigatória acima de 20000; fundo 30000; faixas de cotação 50000 e 200000.
- **Datas dos testes:** `AGORA_FASE2 = new Date(2026, 9, 19, 10, 0)`. Os seeds são relativos a "agora" via `em(dias, hora)`.
- **Textos de erro:** exatamente os da spec.
- **Versão dos dados:** `versao` 5, e `carregarEstado` aceita só a 5.
- **Verificação:** `npm test`, `npm run verificar` e `npm run e2e` precisam passar no fim de cada task que tocar no que eles cobrem.
- **Git:** trabalhar no branch `fase2-manutencao`. Os commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Categorias, prioridades e prazos das notificações

**Files:**
- Create: `src/notificacoes/regras.js`, `src/casos/notificacoes.js`
- Modify:
  - `src/dados.js`: CATEGORIAS, TIPOS_NOTIFICACAO, PRIORIDADES, NOMES_STATUS, seed das ocorrências, versão 5;
  - `src/armazenamento.js`;
  - `src/regras.js`: `slaVencido` delega;
  - `src/planos.js`;
  - `montagem.mjs`, `testes/casos.test.mjs`, `src/ui/app.js` (PainelTestes);
  - testes antigos em `src/casos/{dados,regras,acoes}.js`.

**Interfaces (Produces):**
- **Em `src/dados.js`:**
  - `CATEGORIAS[id] = { nome, tipo, prioridade }`;
  - `TIPOS_NOTIFICACAO`;
  - `PRIORIDADES = { urgente: { nome: 'Urgente', resposta: 1, solucao: 24 }, alta: { nome: 'Alta', resposta: 4, solucao: 72 }, normal: { nome: 'Normal', resposta: 24, solucao: 168 }, baixa: { nome: 'Baixa', resposta: 72, solucao: null } }`;
  - `ORDEM_PRIORIDADE = ['urgente', 'alta', 'normal', 'baixa']`.
- **Em `src/notificacoes/regras.js`:**
  - `prazosDe(oc)` devolve `{ resposta: { limite, em, vencida, horasAtraso }, solucao: { limite, em, vencida, horasAtraso } | null }`, com `em` = instante de cumprimento ou `null`;
  - `prazosVencidos(oc, agora)` devolve `{ resposta: horas|null, solucao: horas|null }`;
  - `textoAtraso(horas)`;
  - `caixaDeEntrada(estado, agora, filtros)`;
  - `parecidas(estado, categoria, unidade)`;
  - `alertasNotificacoes(estado, agora)` devolve `[{ chave, texto, href }]`;
  - `indicadorAtendimento(estado, agora)`;
  - `urgentesAbertas(estado)`.
- **Em `src/regras.js`:** `slaVencido(oc, agora)` passa a significar "algum prazo vencido".
- **Em `src/planos.js`:** novos recursos `notificacoesPrazo`, `zelador`, `indicadorAtendimento`, `cotacoes` e `caixaPequeno`.

- [ ] **Step 1: Testes novos (`src/casos/notificacoes.js`)**
```js
import { dadosIniciais, CATEGORIAS } from '../dados.js';
import { liberado } from '../planos.js';
import { slaVencido } from '../regras.js';
import { prazosVencidos, textoAtraso, caixaDeEntrada, parecidas, alertasNotificacoes, indicadorAtendimento, urgentesAbertas } from '../notificacoes/regras.js';
import { igual, AGORA_FASE2 } from './afirmar.js';

function estadoNotif() {
  return dadosIniciais(AGORA_FASE2);
}

function ocDe(e, id) {
  return e.ocorrencias.find((o) => o.id === id);
}

export const CASOS_NOTIFICACOES = [
  {
    nome: 'notificações: categorias por tipo com prioridade padrão',
    rodar() {
      igual([CATEGORIAS.vazamento.tipo, CATEGORIAS.vazamento.prioridade, CATEGORIAS.obra.tipo, CATEGORIAS.elogio.tipo, CATEGORIAS.jardim.prioridade], ['manutencao', 'urgente', 'irregularidade', 'outro', 'baixa']);
      igual(Object.keys(CATEGORIAS).length, 18);
      igual([liberado('basico', 'notificacoesPrazo'), liberado('intermediario', 'notificacoesPrazo'), liberado('intermediario', 'indicadorAtendimento'), liberado('avancado', 'caixaPequeno')], [false, true, false, true]);
    },
  },
  {
    nome: 'notificações: seed remapeado e OC-0043',
    rodar() {
      const e = estadoNotif();
      igual(e.ocorrencias.map((o) => [o.id, o.categoria, o.prioridade]), [
        ['OC-0037', 'eletrica', 'alta'], ['OC-0038', 'elogio', 'baixa'], ['OC-0039', 'vazamento', 'urgente'], ['OC-0040', 'elevador', 'alta'],
        ['OC-0041', 'barulho', 'normal'], ['OC-0042', 'vaga', 'normal'], ['OC-0043', 'obra', 'normal'],
      ]);
      igual([e.proximoProtocolo, ocDe(e, 'OC-0039').os, ocDe(e, 'OC-0037').os, e.versao], [44, 'OS-003', 'OS-002', 5]);
    },
  },
  {
    nome: 'notificações: prazos de 1ª resposta e de solução',
    rodar() {
      const e = estadoNotif();
      igual(prazosVencidos(ocDe(e, 'OC-0042'), AGORA_FASE2), { resposta: 27, solucao: null });
      igual(prazosVencidos(ocDe(e, 'OC-0039'), AGORA_FASE2), { resposta: null, solucao: 50 });
      igual(prazosVencidos(ocDe(e, 'OC-0041'), AGORA_FASE2), { resposta: null, solucao: null });
      igual([textoAtraso(27), textoAtraso(50), textoAtraso(1)], ['27 h', '2 dias', '1 h']);
      igual([slaVencido(ocDe(e, 'OC-0042'), AGORA_FASE2), slaVencido(ocDe(e, 'OC-0039'), AGORA_FASE2), slaVencido(ocDe(e, 'OC-0038'), AGORA_FASE2)], [true, true, false]);
    },
  },
  {
    nome: 'notificações: caixa de entrada por prioridade e prazo',
    rodar() {
      const e = estadoNotif();
      igual(caixaDeEntrada(e, AGORA_FASE2, { status: 'ativas' }).map((o) => o.id), ['OC-0039', 'OC-0040', 'OC-0042', 'OC-0043', 'OC-0041']);
      igual(caixaDeEntrada(e, AGORA_FASE2, { status: 'ativas', tipo: 'irregularidade' }).map((o) => o.id), ['OC-0042', 'OC-0043', 'OC-0041']);
      igual(caixaDeEntrada(e, AGORA_FASE2, { status: 'todas', prioridade: 'alta' }).map((o) => o.id), ['OC-0040', 'OC-0037']);
    },
  },
  {
    nome: 'notificações: parecidas, alertas, urgentes e atendimento',
    rodar() {
      const e = estadoNotif();
      igual(parecidas(e, 'vazamento', '302').map((o) => o.id), ['OC-0039']);
      igual(parecidas(e, 'vazamento', '101'), []);
      igual(alertasNotificacoes(e, AGORA_FASE2).map((a) => a.texto), ['OC-0039: solução vencida há 2 dias', 'OC-0042: 1ª resposta vencida há 27 h']);
      igual(urgentesAbertas(e).map((o) => o.id), ['OC-0039']);
      igual(indicadorAtendimento(e, AGORA_FASE2), { abertas: 5, noPrazo: 1, comPrazo: 1, pct: 100, alerta: false });
    },
  },
];
```
  - **Registro:**
    - ORDEM do `montagem.mjs`: `'src/notificacoes/regras.js'` logo depois de `'src/regras.js'`, e `'src/casos/notificacoes.js'` depois de `'src/casos/acordos.js'`;
    - `testes/casos.test.mjs` e PainelTestes: `CASOS_NOTIFICACOES`.

- [ ] **Step 2: Rodar e ver falhar** (`npm test`)

- [ ] **Step 3: Implementar**
  - **`src/dados.js`:**
    - troque CATEGORIAS por:
```js
export const CATEGORIAS = {
  vazamento: { nome: 'Vazamento', tipo: 'manutencao', prioridade: 'urgente' },
  eletrica: { nome: 'Elétrica/iluminação', tipo: 'manutencao', prioridade: 'alta' },
  elevador: { nome: 'Elevador', tipo: 'manutencao', prioridade: 'alta' },
  portao: { nome: 'Portão/garagem', tipo: 'manutencao', prioridade: 'alta' },
  interfone: { nome: 'Interfone', tipo: 'manutencao', prioridade: 'normal' },
  limpeza: { nome: 'Limpeza', tipo: 'manutencao', prioridade: 'normal' },
  piscina: { nome: 'Piscina', tipo: 'manutencao', prioridade: 'normal' },
  outros: { nome: 'Outros', tipo: 'manutencao', prioridade: 'normal' },
  jardim: { nome: 'Jardim', tipo: 'manutencao', prioridade: 'baixa' },
  seguranca: { nome: 'Segurança', tipo: 'irregularidade', prioridade: 'alta' },
  barulho: { nome: 'Barulho', tipo: 'irregularidade', prioridade: 'normal' },
  vaga: { nome: 'Vaga ocupada', tipo: 'irregularidade', prioridade: 'normal' },
  lixo: { nome: 'Lixo fora do lugar', tipo: 'irregularidade', prioridade: 'normal' },
  pet: { nome: 'Pet', tipo: 'irregularidade', prioridade: 'normal' },
  obra: { nome: 'Obra fora do horário', tipo: 'irregularidade', prioridade: 'normal' },
  area_comum: { nome: 'Uso indevido de área comum', tipo: 'irregularidade', prioridade: 'normal' },
  sugestao: { nome: 'Sugestão', tipo: 'outro', prioridade: 'baixa' },
  elogio: { nome: 'Elogio', tipo: 'outro', prioridade: 'baixa' },
};
export const TIPOS_NOTIFICACAO = { manutencao: 'Manutenção', irregularidade: 'Irregularidade', outro: 'Sugestão ou elogio' };
export const PRIORIDADES = { urgente: { nome: 'Urgente', resposta: 1, solucao: 24 }, alta: { nome: 'Alta', resposta: 4, solucao: 72 }, normal: { nome: 'Normal', resposta: 24, solucao: 168 }, baixa: { nome: 'Baixa', resposta: 72, solucao: null } };
export const ORDEM_PRIORIDADE = ['urgente', 'alta', 'normal', 'baixa'];
```
    - `NOMES_STATUS = { aberta: 'Recebida', em_analise: 'Em análise', em_andamento: 'Em atendimento', resolvida: 'Resolvida', fechada: 'Fechada' }`.
    - **Seed das ocorrências:** OC-0037 categoria `'eletrica'`, OC-0040 `'elevador'`. Toda ocorrência ganha `prioridade: CATEGORIAS[categoria].prioridade, os: null, advertencia: null, motivoArquivamento: null`. Para isso, monte a lista e aplique `.map((o) => ({ prioridade: CATEGORIAS[o.categoria].prioridade, os: null, advertencia: null, motivoArquivamento: null, ...o }))`; os `os` da OC-0037 e da OC-0039 entram na Task 3.
    - **Nova OC-0043:**
```js
{ id: 'OC-0043', categoria: 'obra', descricao: 'Furadeira no domingo às 8h no 5º andar, parece ser no 503.', local: '5º andar', unidade: '702', anonima: false, publica: false, foto: false, status: 'aberta', eutambem: [], linha: [
  { em: em(0, 5), status: 'aberta', texto: 'Ocorrência aberta', autor: 'Sônia Araújo' },
], avaliacao: null, arquivada: false, criadaEm: em(0, 5) },
```
    - `proximoProtocolo: 44` e `versao: 5`.
  - **`src/armazenamento.js`:** `estado.versao === 5`.
  - **`src/planos.js`:** acrescente a RECURSOS_PLANO `notificacoesPrazo: 'intermediario', zelador: 'intermediario', indicadorAtendimento: 'avancado', cotacoes: 'avancado', caixaPequeno: 'avancado',`.
  - **`src/notificacoes/regras.js`:**
```js
import { PRIORIDADES, ORDEM_PRIORIDADE, CATEGORIAS } from '../dados.js';
import { horasEntre } from '../datas.js';

// Prazos derivados da linha do tempo: 1ª resposta = primeira entrada do síndico; solução = entrada com status "resolvida".
const HORA = 3600000;
const ENCERRADAS = ['resolvida', 'fechada'];

function instanteMais(iso, horas) {
  return new Date(new Date(iso).getTime() + horas * HORA).toISOString();
}

export function prazosDe(oc) {
  const p = PRIORIDADES[oc.prioridade];
  const respondida = oc.linha.find((l) => l.autor === 'Síndico');
  const resolvida = oc.linha.find((l) => l.status === 'resolvida');
  return {
    resposta: { limite: instanteMais(oc.criadaEm, p.resposta), em: respondida ? respondida.em : null },
    solucao: p.solucao === null ? null : { limite: instanteMais(oc.criadaEm, p.solucao), em: resolvida ? resolvida.em : null },
  };
}

export function prazosVencidos(oc, agora) {
  if (oc.arquivada) return { resposta: null, solucao: null };
  const p = prazosDe(oc);
  const atraso = (prazo, encerrou) => (prazo && !encerrou && agora > new Date(prazo.limite) ? Math.floor(horasEntre(new Date(prazo.limite), agora)) : null);
  return { resposta: atraso(p.resposta, !!p.resposta.em), solucao: atraso(p.solucao, !p.solucao || !!p.solucao.em || ENCERRADAS.includes(oc.status)) };
}

export function textoAtraso(horas) {
  return horas < 48 ? `${horas} h` : `${Math.floor(horas / 24)} dias`;
}

function proximoLimite(oc) {
  const p = prazosDe(oc);
  if (!p.resposta.em) return p.resposta.limite;
  return p.solucao && !p.solucao.em ? p.solucao.limite : '9999';
}

export function caixaDeEntrada(estado, agora, filtros = {}) {
  const { status = 'ativas', tipo = 'todos', prioridade = 'todas' } = filtros;
  return estado.ocorrencias
    .filter((o) => {
      if (status === 'arquivadas') return o.arquivada;
      if (o.arquivada) return false;
      if (status === 'ativas' && ENCERRADAS.includes(o.status)) return false;
      if (!['ativas', 'todas'].includes(status) && o.status !== status) return false;
      if (tipo !== 'todos' && CATEGORIAS[o.categoria].tipo !== tipo) return false;
      return prioridade === 'todas' || o.prioridade === prioridade;
    })
    .sort((a, b) => Number(ENCERRADAS.includes(a.status)) - Number(ENCERRADAS.includes(b.status))
      || ORDEM_PRIORIDADE.indexOf(a.prioridade) - ORDEM_PRIORIDADE.indexOf(b.prioridade)
      || proximoLimite(a).localeCompare(proximoLimite(b))
      || b.criadaEm.localeCompare(a.criadaEm));
}

export function parecidas(estado, categoria, unidade) {
  return estado.ocorrencias.filter((o) => o.categoria === categoria && o.unidade !== unidade && !o.arquivada && !ENCERRADAS.includes(o.status));
}

export function alertasNotificacoes(estado, agora) {
  const itens = [];
  for (const o of caixaDeEntrada(estado, agora, { status: 'ativas' })) {
    const v = prazosVencidos(o, agora);
    if (v.resposta !== null) itens.push({ chave: `resp-${o.id}`, texto: `${o.id}: 1ª resposta vencida há ${textoAtraso(v.resposta)}`, href: `#sindico.ocorrencias.${o.id}` });
    if (v.solucao !== null) itens.push({ chave: `sol-${o.id}`, texto: `${o.id}: solução vencida há ${textoAtraso(v.solucao)}`, href: `#sindico.ocorrencias.${o.id}` });
  }
  return itens;
}

export function indicadorAtendimento(estado) {
  const ativas = estado.ocorrencias.filter((o) => !o.arquivada && !ENCERRADAS.includes(o.status));
  const encerradas = estado.ocorrencias.filter((o) => ENCERRADAS.includes(o.status) && prazosDe(o).solucao);
  const noPrazo = encerradas.filter((o) => { const s = prazosDe(o).solucao; return s.em && s.em <= s.limite; }).length;
  const pct = encerradas.length ? Math.round((noPrazo / encerradas.length) * 100) : 100;
  return { abertas: ativas.length, noPrazo, comPrazo: encerradas.length, pct, alerta: pct < 80 };
}

export function urgentesAbertas(estado) {
  return estado.ocorrencias.filter((o) => o.prioridade === 'urgente' && !o.arquivada && !ENCERRADAS.includes(o.status));
}
```
    - Confira se `horasEntre` é exportada de `datas.js`; se não for, exporte.
    - O teste chama `indicadorAtendimento(e, AGORA_FASE2)`; o segundo argumento é ignorado.
  - **`src/regras.js`:**
    - `slaVencido` passa a ser:
```js
export function slaVencido(oc, agora) {
  const v = prazosVencidos(oc, agora);
  return v.resposta !== null || v.solucao !== null;
}
```
    - com o import `import { prazosVencidos } from './notificacoes/regras.js';`;
    - remova o uso de `CATEGORIAS[...].sla`.
  - **Testes antigos:**
    - `src/casos/dados.js`: 6 ocorrências passam a ser 7;
    - `src/casos/regras.js`:
      - "SLA vencido": OC-0042 true, OC-0041 false e OC-0038 false continuam válidos em AGORA_TESTE;
      - `indicadoresSindico`: `abertas: 5, slaVencidas: 2`, por causa da OC-0043 e da solução vencida da OC-0039;
      - `acoesOcorrencia` "Mover para "Em análise"" continua igual;
    - `src/casos/acoes.js`: a ocorrência nova do roteiro passa a ser OC-0044. Troque `'OC-0043'` por `'OC-0044'` nesse caso; os nomes de status nas asserções, se houver, seguem NOMES_STATUS.
  - **`src/ui/sindico.js`:** `textoPrazo(oc)` usa `CATEGORIAS[oc.categoria].sla`. Troque por `PRIORIDADES[oc.prioridade].solucao` (texto `${h} h para resolver` ou 'Sem prazo'), com import de `PRIORIDADES` de `../dados.js`.

- [ ] **Step 4: Rodar e ver passar** (`npm test`)
  - Esperado: todos passam (113 + 5).
  - Ajuste só asserções de testes antigos que mudaram por causa do seed novo, anotando cada uma no commit.

- [ ] **Step 5: Commit** `feat(notificacoes): categorias por tipo, prioridade e prazos de resposta e solução`

---

### Task 2: Ações do síndico nas notificações

**Files:**
- Create: `src/notificacoes/acoes.js`
- Modify: `src/acoes.js` (`abrirOcorrencia` grava a prioridade e a mensagem de erro nova; `euTambem` vale para as parecidas)
- Test: `src/casos/notificacoes.js`

**Interfaces (Produces):**
- `definirPrioridade(estado, id, prioridade, perfil, agora)`
- `pedirInformacao(estado, id, texto, perfil, agora)`
- `gerarAdvertencia(estado, id, unidade, perfil, agora)`
- `arquivarComJustificativa(estado, id, motivo, perfil, agora)`

- [ ] **Step 1: Testes** (acrescente ao array; os imports vão em linha única)
```js
  {
    nome: 'notificações: abertura grava prioridade e exige categoria',
    rodar() {
      const e = estadoNotif();
      igual(abrirOcorrencia(e, { categoria: '', descricao: 'x', unidade: '302' }, AGORA_FASE2).erro, 'Escolha o tipo e a categoria');
      const r = abrirOcorrencia(e, { categoria: 'vazamento', descricao: 'Água descendo pela parede', local: 'Hall do 3º', unidade: '302' }, AGORA_FASE2);
      igual([r.id, ocDe(r.estado, r.id).prioridade], ['OC-0044', 'urgente']);
      igual(euTambem(e, 'OC-0039', '302').estado.ocorrencias.find((o) => o.id === 'OC-0039').eutambem, ['302']);
    },
  },
  {
    nome: 'notificações: prioridade e pedido de informação contam como resposta',
    rodar() {
      const e = estadoNotif();
      igual(definirPrioridade(e, 'OC-0042', 'alta', 'morador', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      igual(definirPrioridade({ ...e, plano: 'basico' }, 'OC-0042', 'alta', 'sindico', AGORA_FASE2).erro, 'Disponível no plano Intermediário');
      igual(ocDe(definirPrioridade(e, 'OC-0042', 'alta', 'sindico', AGORA_FASE2).estado, 'OC-0042').prioridade, 'alta');
      const r = pedirInformacao(e, 'OC-0042', 'Qual a placa do carro?', 'sindico', AGORA_FASE2);
      igual([ocDe(r.estado, 'OC-0042').status, prazosVencidos(ocDe(r.estado, 'OC-0042'), AGORA_FASE2).resposta], ['em_analise', null]);
    },
  },
  {
    nome: 'notificações: advertência só para irregularidade e sem expor o denunciante',
    rodar() {
      const e = estadoNotif();
      igual(gerarAdvertencia(e, 'OC-0039', '503', 'sindico', AGORA_FASE2).erro, 'Advertência só vale para irregularidades');
      igual(gerarAdvertencia(e, 'OC-0043', '', 'sindico', AGORA_FASE2).erro, 'Informe a unidade advertida');
      const r = gerarAdvertencia(e, 'OC-0043', '503', 'sindico', AGORA_FASE2);
      igual([ocDe(r.estado, 'OC-0043').advertencia.unidade, r.notificacao.para], ['503', 'Apto 503']);
      igual([r.notificacao.texto.includes('702'), r.notificacao.texto.includes('Sônia')], [false, false]);
      igual(ocDe(r.estado, 'OC-0043').linha.at(-1).texto, 'Advertência enviada ao apto 503');
    },
  },
  {
    nome: 'notificações: arquivar exige motivo',
    rodar() {
      const e = estadoNotif();
      igual(arquivarComJustificativa(e, 'OC-0041', ' ', 'sindico', AGORA_FASE2).erro, 'Informe o motivo do arquivamento');
      const r = arquivarComJustificativa(e, 'OC-0041', 'Duplicada da OC-0043', 'sindico', AGORA_FASE2);
      igual([ocDe(r.estado, 'OC-0041').arquivada, ocDe(r.estado, 'OC-0041').motivoArquivamento], [true, 'Duplicada da OC-0043']);
    },
  },
```
  - Imports adicionais:
    - `import { abrirOcorrencia, euTambem } from '../acoes.js';`
    - `import { definirPrioridade, pedirInformacao, gerarAdvertencia, arquivarComJustificativa } from '../notificacoes/acoes.js';`

- [ ] **Step 2: Rodar e ver falhar**

- [ ] **Step 3: Implementar**
  - **`src/acoes.js`:**
    - `abrirOcorrencia`: a mensagem de erro passa a ser `'Escolha o tipo e a categoria'`; a ocorrência ganha `prioridade: CATEGORIAS[dados.categoria].prioridade, os: null, advertencia: null, motivoArquivamento: null`.
    - `euTambem`: troque `if (!oc.publica) return erroAcao(estado, 'Ocorrência não é pública');` por `if (!oc.publica && oc.unidade === unidade) return erroAcao(estado, 'Ocorrência não é pública');`. Ajuste o teste antigo, se houver, para usar a própria unidade.
    - Exporte `trocarItem` e `nomesDaUnidade` (acrescente `export`).
  - **`src/notificacoes/acoes.js`:**
```js
import { CATEGORIAS, PRIORIDADES, SINDICO } from '../dados.js';
import { liberado } from '../planos.js';
import { trocarItem } from '../acoes.js';

const SO_SINDICO_NOTIF = 'Somente o síndico pode fazer isso';

function erroNotif(estado, mensagem) {
  return { estado, erro: mensagem };
}

function guardaNotif(estado, id, perfil) {
  if (perfil !== 'sindico') return SO_SINDICO_NOTIF;
  if (!liberado(estado.plano, 'notificacoesPrazo')) return 'Disponível no plano Intermediário';
  if (!estado.ocorrencias.some((o) => o.id === id)) return 'Ocorrência não encontrada';
  return null;
}

function comEntrada(estado, id, mudanca, entrada) {
  const oc = estado.ocorrencias.find((o) => o.id === id);
  return { ...estado, ocorrencias: trocarItem(estado.ocorrencias, id, { ...mudanca, linha: [...oc.linha, entrada] }) };
}

export function definirPrioridade(estado, id, prioridade, perfil, agora) {
  const falha = guardaNotif(estado, id, perfil);
  if (falha) return erroNotif(estado, falha);
  if (!PRIORIDADES[prioridade]) return erroNotif(estado, 'Prioridade inválida');
  return { estado: comEntrada(estado, id, { prioridade }, { em: agora.toISOString(), status: null, texto: `Prioridade definida como ${PRIORIDADES[prioridade].nome}`, autor: 'Síndico' }) };
}

export function pedirInformacao(estado, id, texto, perfil, agora) {
  const falha = guardaNotif(estado, id, perfil);
  if (falha) return erroNotif(estado, falha);
  const mensagem = String(texto || '').trim();
  if (!mensagem) return erroNotif(estado, 'Escreva o que precisa saber');
  const oc = estado.ocorrencias.find((o) => o.id === id);
  const status = oc.status === 'aberta' ? 'em_analise' : oc.status;
  return {
    estado: comEntrada(estado, id, { status }, { em: agora.toISOString(), status: status !== oc.status ? status : null, texto: `Pedido de informação: ${mensagem}`, autor: 'Síndico' }),
    notificacao: { canal: 'Push', para: `Apto ${oc.unidade}`, texto: `${id}: o síndico pediu mais informações` },
  };
}

export function gerarAdvertencia(estado, id, unidade, perfil, agora) {
  const falha = guardaNotif(estado, id, perfil);
  if (falha) return erroNotif(estado, falha);
  const oc = estado.ocorrencias.find((o) => o.id === id);
  if (CATEGORIAS[oc.categoria].tipo !== 'irregularidade') return erroNotif(estado, 'Advertência só vale para irregularidades');
  const alvo = String(unidade || '').trim();
  if (!alvo) return erroNotif(estado, 'Informe a unidade advertida');
  return {
    estado: comEntrada(estado, id, { advertencia: { unidade: alvo, em: agora.toISOString() } }, { em: agora.toISOString(), status: null, texto: `Advertência enviada ao apto ${alvo}`, autor: 'Síndico' }),
    notificacao: { canal: 'App + e-mail', para: `Apto ${alvo}`, texto: `Advertência do condomínio: ${CATEGORIAS[oc.categoria].nome.toLowerCase()} (regimento interno). Responda ao síndico pelo app.` },
  };
}

export function arquivarComJustificativa(estado, id, motivo, perfil, agora) {
  if (perfil !== 'sindico') return erroNotif(estado, SO_SINDICO_NOTIF);
  const texto = String(motivo || '').trim();
  if (!texto) return erroNotif(estado, 'Informe o motivo do arquivamento');
  if (!estado.ocorrencias.some((o) => o.id === id)) return erroNotif(estado, 'Ocorrência não encontrada');
  return { estado: comEntrada(estado, id, { arquivada: true, motivoArquivamento: texto }, { em: agora.toISOString(), status: null, texto: `Arquivada: ${texto}`, autor: 'Síndico' }) };
}
```
  - **ORDEM:** `'src/notificacoes/acoes.js'` logo depois de `'src/acoes.js'`.
  - **Atenção:** `SINDICO` não é usado nesse arquivo; tire-o do import.

- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** `feat(notificacoes): prioridade, pedido de informação, advertência e arquivamento com motivo`

---

### Task 3: OS do zelador (dados, regras e ações)

**Files:**
- Create: `src/manutencao/dados.js`, `src/manutencao/regras.js`, `src/manutencao/acoes.js`, `src/casos/manutencao.js`
- Modify: `src/dados.js` (`manutencao: manutencaoInicial(em)` e `os` nas OC-0037 e OC-0039), `montagem.mjs`, runners de teste

**Interfaces (Produces):**
- **`src/manutencao/dados.js`:**
  - `ZELADOR = 'Seu Antônio'`;
  - `NOMES_STATUS_OS`;
  - `CATEGORIAS_COMPRA = { manutencao: 'Manutenção', administracao: 'Administração', seguro: 'Seguro e outros' }`;
  - `manutencaoInicial(em)`.
- **`src/manutencao/regras.js`:**
  - `osUrgentesParadas(estado, agora)`;
  - `alertasManutencao(estado, agora)` devolve `[{ chave, texto, href }]`;
  - `listaOS(estado)`, com as urgentes primeiro e depois pelo prazo;
  - `cotacoesMinimas(valor)`;
  - `textoCotacoes(n)`.
- **`src/manutencao/acoes.js`:**
  - `gerarOS`, `abrirOS`, `iniciarOS`, `pausarOS`, `concluirOS` e `validarOS`;
  - na Task 4: `solicitarCompra`, `anexarCotacao`, `aprovarCompra`, `recusarCompra`, `receberCompra`, `gastoCaixa` e `reporCaixa`.

- [ ] **Step 1: Testes (`src/casos/manutencao.js`)**
```js
import { dadosIniciais } from '../dados.js';
import { alertasManutencao, listaOS } from '../manutencao/regras.js';
import { gerarOS, abrirOS, iniciarOS, pausarOS, concluirOS, validarOS } from '../manutencao/acoes.js';
import { igual, AGORA_FASE2 } from './afirmar.js';

function estadoMan() {
  return dadosIniciais(AGORA_FASE2);
}

function osDe(e, id) {
  return e.manutencao.os.find((o) => o.id === id);
}

export const CASOS_MANUTENCAO = [
  {
    nome: 'manutenção: seed de OS, compras e caixa',
    rodar() {
      const m = estadoMan().manutencao;
      igual(m.os.map((o) => [o.id, o.status, o.notificacao]), [['OS-001', 'validada', null], ['OS-002', 'concluida', 'OC-0037'], ['OS-003', 'em_execucao', 'OC-0039']]);
      igual(m.compras.map((c) => [c.id, c.status, c.valorEstimado]), [['CP-001', 'solicitada', 38000], ['CP-002', 'recebida', 14500]]);
      igual([m.caixa.fundo, m.caixa.saldo, m.caixa.gastos.length], [30000, 23950, 2]);
      igual(listaOS(estadoMan()).map((o) => o.id), ['OS-003', 'OS-002', 'OS-001']);
    },
  },
  {
    nome: 'manutenção: gerar OS a partir da notificação',
    rodar() {
      const e = estadoMan();
      igual(gerarOS(e, 'OC-0039', { responsavel: 'zelador' }, 'sindico', AGORA_FASE2).erro, 'Esta notificação já tem a OS-003');
      igual(gerarOS(e, 'OC-0040', { responsavel: 'zelador' }, 'zelador', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      igual(gerarOS({ ...e, plano: 'basico' }, 'OC-0040', { responsavel: 'zelador' }, 'sindico', AGORA_FASE2).erro, 'Disponível no plano Intermediário');
      const r = gerarOS(e, 'OC-0040', { responsavel: 'prestador', prestador: 'Elevadores Atlas' }, 'sindico', AGORA_FASE2);
      const os = osDe(r.estado, 'OS-004');
      igual([os.origem, os.notificacao, os.local, os.prioridade, os.responsavel, os.prestador, os.status], ['notificacao', 'OC-0040', 'Elevador 2', 'alta', 'prestador', 'Elevadores Atlas', 'aberta']);
      const oc = r.estado.ocorrencias.find((o) => o.id === 'OC-0040');
      igual([oc.os, oc.status, oc.linha.at(-1).texto], ['OS-004', 'em_andamento', 'OS-004 aberta para o prestador Elevadores Atlas']);
    },
  },
  {
    nome: 'manutenção: ronda do zelador e fluxo da OS',
    rodar() {
      const e = estadoMan();
      igual(abrirOS(e, { local: '', descricao: 'x', prioridade: 'normal' }, 'zelador', AGORA_FASE2).erro, 'Informe o local e a descrição');
      igual(abrirOS(e, { local: 'x', descricao: 'x', prioridade: 'normal' }, 'morador', AGORA_FASE2).erro, 'Somente o zelador ou o síndico pode fazer isso');
      let r = abrirOS(e, { local: 'Piscina', descricao: 'Ralo solto', prioridade: 'normal' }, 'zelador', AGORA_FASE2);
      igual([osDe(r.estado, 'OS-004').origem, osDe(r.estado, 'OS-004').prazo.slice(0, 10)], ['ronda', '2026-10-26']);
      r = iniciarOS(r.estado, 'OS-004', 'zelador', AGORA_FASE2);
      r = pausarOS(r.estado, 'OS-004', 'aguardando_material', 'zelador', AGORA_FASE2);
      igual(osDe(r.estado, 'OS-004').status, 'aguardando_material');
      igual(concluirOS(r.estado, 'OS-004', { fotoDepois: false, horas: 1 }, 'zelador', AGORA_FASE2).erro, 'Anexe a foto do depois');
      igual(concluirOS(r.estado, 'OS-004', { fotoDepois: true, horas: 0 }, 'zelador', AGORA_FASE2).erro, 'Informe as horas gastas');
      igual(validarOS(r.estado, 'OS-004', 'sindico', AGORA_FASE2).erro, 'Só OS concluídas podem ser validadas');
      r = concluirOS(r.estado, 'OS-004', { fotoDepois: true, horas: 0.5, materiais: 'Parafusos', observacoes: '' }, 'zelador', AGORA_FASE2);
      igual(validarOS(r.estado, 'OS-004', 'zelador', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      igual(osDe(validarOS(r.estado, 'OS-004', 'sindico', AGORA_FASE2).estado, 'OS-004').status, 'validada');
    },
  },
  {
    nome: 'manutenção: concluir OS resolve a notificação e avisa o morador',
    rodar() {
      const r = concluirOS(estadoMan(), 'OS-003', { fotoDepois: true, horas: 2, materiais: 'Registro 3/4"', observacoes: 'Trocado' }, 'zelador', AGORA_FASE2);
      const oc = r.estado.ocorrencias.find((o) => o.id === 'OC-0039');
      igual([oc.status, oc.linha.at(-1).texto, r.notificacao.para, r.notificacao.texto], ['resolvida', 'Reparo concluído pelo zelador (fotos do antes e depois)', 'Carla Mendes', 'Seu chamado OC-0039 foi resolvido']);
    },
  },
  {
    nome: 'manutenção: alertas de OS',
    rodar() {
      let e = estadoMan();
      igual(alertasManutencao(e, AGORA_FASE2).map((a) => a.texto), ['OS-002 concluída: validar', 'CP-001 aguardando aprovação: Registro de 3/4" e conexões, R$ 380,00']);
      e = abrirOS(e, { local: 'Portão', descricao: 'Portão não fecha', prioridade: 'urgente' }, 'sindico', new Date(2026, 9, 19, 7, 0)).estado;
      igual(alertasManutencao(e, AGORA_FASE2)[0].texto, 'OS-004 urgente sem início há 3 h');
    },
  },
];
```
  - **Registro:** ORDEM `'src/manutencao/dados.js'`, `'src/manutencao/regras.js'` e `'src/manutencao/acoes.js'` depois de `'src/notificacoes/acoes.js'`, e `'src/casos/manutencao.js'` depois de `'src/casos/notificacoes.js'`. Os runners também.

- [ ] **Step 2: Rodar e ver falhar**

- [ ] **Step 3: Implementar**
  - **`src/manutencao/dados.js`:**
```js
// Dados iniciais do zelador: OS, compras e caixa pequeno (fase 2, parte 3).
export const ZELADOR = 'Seu Antônio';
export const NOMES_STATUS_OS = { aberta: 'Aberta', em_execucao: 'Em execução', aguardando_material: 'Aguardando material', aguardando_prestador: 'Aguardando prestador', concluida: 'Concluída', validada: 'Validada' };
export const CATEGORIAS_COMPRA = { manutencao: 'Manutenção', administracao: 'Administração', seguro: 'Seguro e outros' };

export function manutencaoInicial(em) {
  const os = [
    { id: 'OS-001', origem: 'sindico', notificacao: null, local: 'Casa de bombas', descricao: 'Manutenção preventiva da bomba d’água (troca do selo mecânico)', prioridade: 'normal', prazo: em(-8, 18), responsavel: 'zelador', prestador: null, status: 'validada', fotoAntes: true, fotoDepois: true, materiais: 'Selo mecânico', horas: 1.5, observacoes: 'Sem vazamento após a troca', linha: [
      { em: em(-12, 9), status: 'aberta', texto: 'OS aberta pelo síndico', autor: 'Síndico' },
      { em: em(-11, 8), status: 'em_execucao', texto: 'Iniciada', autor: ZELADOR },
      { em: em(-11, 10), status: 'concluida', texto: 'Concluída com fotos do depois', autor: ZELADOR },
      { em: em(-10, 16), status: 'validada', texto: 'Validada pelo síndico', autor: 'Síndico' },
    ], criadaEm: em(-12, 9), iniciadaEm: em(-11, 8), concluidaEm: em(-11, 10), validadaEm: em(-10, 16) },
    { id: 'OS-002', origem: 'notificacao', notificacao: 'OC-0037', local: '5º andar', descricao: 'Lâmpada do hall do 5º andar queimada.', prioridade: 'alta', prazo: em(-6, 19), responsavel: 'zelador', prestador: null, status: 'concluida', fotoAntes: true, fotoDepois: true, materiais: '2 lâmpadas LED 9 W', horas: 0.5, observacoes: '', linha: [
      { em: em(-8, 10), status: 'aberta', texto: 'OS aberta a partir da OC-0037', autor: 'Síndico' },
      { em: em(-7, 14), status: 'em_execucao', texto: 'Iniciada', autor: ZELADOR },
      { em: em(-7, 15), status: 'concluida', texto: 'Concluída com fotos do depois', autor: ZELADOR },
    ], criadaEm: em(-8, 10), iniciadaEm: em(-7, 14), concluidaEm: em(-7, 15), validadaEm: null },
    { id: 'OS-003', origem: 'notificacao', notificacao: 'OC-0039', local: 'Garagem, vaga 12', descricao: 'Água pingando do teto da garagem, perto da vaga 12.', prioridade: 'urgente', prazo: em(-2, 8), responsavel: 'zelador', prestador: null, status: 'em_execucao', fotoAntes: true, fotoDepois: false, materiais: '', horas: 0, observacoes: '', linha: [
      { em: em(-2, 9), status: 'aberta', texto: 'OS aberta a partir da OC-0039', autor: 'Síndico' },
      { em: em(-2, 10), status: 'em_execucao', texto: 'Iniciada', autor: ZELADOR },
      { em: em(-2, 15), status: 'aguardando_material', texto: 'Aguardando material: registro de 3/4"', autor: ZELADOR },
      { em: em(-1, 9), status: 'em_execucao', texto: 'Retomada', autor: ZELADOR },
    ], criadaEm: em(-2, 9), iniciadaEm: em(-2, 10), concluidaEm: null, validadaEm: null },
  ];
  const compras = [
    { id: 'CP-001', item: 'Registro de 3/4" e conexões', quantidade: 1, motivo: 'Trocar o registro que está vazando na garagem', valorEstimado: 38000, categoria: 'manutencao', os: 'OS-003', urgente: true, cotacoes: [{ fornecedor: 'Casa do Encanador', valor: 38000 }], status: 'solicitada', motivoRecusa: null, valorFinal: null, nota: null, viaCaixa: false, criadaEm: em(-1, 11), aprovadaEm: null, recebidaEm: null },
    { id: 'CP-002', item: 'Produtos de limpeza (kit do mês)', quantidade: 1, motivo: 'Reposição mensal', valorEstimado: 14500, categoria: 'manutencao', os: null, urgente: false, cotacoes: [{ fornecedor: 'Atacadão Limpeza', valor: 14500 }], status: 'recebida', motivoRecusa: null, valorFinal: 14500, nota: 'nota-CP-002.pdf', viaCaixa: false, criadaEm: em(-9, 10), aprovadaEm: em(-8, 18), recebidaEm: em(-6, 11) },
  ];
  const caixa = { fundo: 30000, saldo: 23950, gastos: [
    { id: 'G1', descricao: 'Fita veda-rosca e lâmpadas', valor: 4200, cupom: true, em: em(-5, 16) },
    { id: 'G2', descricao: 'Sacos de lixo extras', valor: 1850, cupom: true, em: em(-2, 11) },
  ], reposicoes: [] };
  return { os, compras, caixa, proximaOS: 4, proximaCompra: 3 };
}
```
  - **`src/dados.js`:**
    - import `manutencaoInicial`;
    - no estado: `manutencao: manutencaoInicial(em),`;
    - OC-0037 com `os: 'OS-002'` e OC-0039 com `os: 'OS-003'`, definidos nos objetos antes do `.map` da Task 1, que não sobrescreve porque o spread vem por último.
  - **`src/manutencao/regras.js`:**
```js
import { ORDEM_PRIORIDADE } from '../dados.js';
import { horasEntre } from '../datas.js';
import { fmtReais } from '../cobranca/regras.js';

const LIMITE_COTACAO_1 = 50000;
const LIMITE_COTACAO_2 = 200000;
const ATIVAS_OS = ['aberta', 'em_execucao', 'aguardando_material', 'aguardando_prestador'];

export function listaOS(estado) {
  const fase = (o) => (ATIVAS_OS.includes(o.status) ? 0 : o.status === 'concluida' ? 1 : 2);
  return [...estado.manutencao.os].sort((a, b) => fase(a) - fase(b) || ORDEM_PRIORIDADE.indexOf(a.prioridade) - ORDEM_PRIORIDADE.indexOf(b.prioridade) || a.prazo.localeCompare(b.prazo));
}

export function cotacoesMinimas(valor) {
  if (valor > LIMITE_COTACAO_2) return { minimo: 3, acimaDe: LIMITE_COTACAO_2 };
  if (valor > LIMITE_COTACAO_1) return { minimo: 2, acimaDe: LIMITE_COTACAO_1 };
  return { minimo: 1, acimaDe: 0 };
}

export function textoCotacoes(valor) {
  const r = cotacoesMinimas(valor);
  return r.acimaDe ? `Anexe ${r.minimo} cotações para compras acima de ${fmtReais(r.acimaDe)}` : 'Anexe 1 cotação';
}

export function alertasManutencao(estado, agora) {
  const m = estado.manutencao;
  const itens = [];
  for (const o of m.os.filter((x) => x.prioridade === 'urgente' && x.status === 'aberta')) {
    const h = Math.floor(horasEntre(new Date(o.criadaEm), agora));
    if (h >= 2) itens.push({ chave: `osu-${o.id}`, texto: `${o.id} urgente sem início há ${h} h`, href: `#sindico.manutencao.${o.id}` });
  }
  for (const o of m.os.filter((x) => x.status === 'concluida')) itens.push({ chave: `osv-${o.id}`, texto: `${o.id} concluída: validar`, href: `#sindico.manutencao.${o.id}` });
  for (const c of m.compras.filter((x) => x.status === 'solicitada')) itens.push({ chave: `cp-${c.id}`, texto: `${c.id} aguardando aprovação: ${c.item}, ${fmtReais(c.valorEstimado)}`, href: `#sindico.manutencao.${c.id}` });
  return itens;
}
```
  - **`src/manutencao/acoes.js`** (OS; compras e caixa na Task 4):
```js
import { CATEGORIAS, PRIORIDADES } from '../dados.js';
import { liberado } from '../planos.js';
import { trocarItem, nomesDaUnidade } from '../acoes.js';
import { ZELADOR } from './dados.js';

const SO_EQUIPE = 'Somente o zelador ou o síndico pode fazer isso';
const SO_SINDICO_MAN = 'Somente o síndico pode fazer isso';
const DIA_MS = 86400000;

function erroMan(estado, mensagem) {
  return { estado, erro: mensagem };
}

function guardaMan(estado, perfil, soSindico = false) {
  if (soSindico ? perfil !== 'sindico' : !['sindico', 'zelador'].includes(perfil)) return soSindico ? SO_SINDICO_MAN : SO_EQUIPE;
  if (!liberado(estado.plano, 'zelador')) return 'Disponível no plano Intermediário';
  return null;
}

function comManutencao(estado, mudanca) {
  return { ...estado, manutencao: { ...estado.manutencao, ...mudanca } };
}

function autorDe(perfil) {
  return perfil === 'sindico' ? 'Síndico' : ZELADOR;
}

function novaOS(estado, campos, agora) {
  const id = `OS-${String(estado.manutencao.proximaOS).padStart(3, '0')}`;
  return { id, fotoAntes: true, fotoDepois: false, materiais: '', horas: 0, observacoes: '', prestador: null, criadaEm: agora.toISOString(), iniciadaEm: null, concluidaEm: null, validadaEm: null, status: 'aberta', ...campos };
}

function mudarOS(estado, id, mudanca, entrada) {
  const os = estado.manutencao.os.find((o) => o.id === id);
  return comManutencao(estado, { os: trocarItem(estado.manutencao.os, id, { ...mudanca, linha: [...os.linha, entrada] }) });
}

export function gerarOS(estado, idNotificacao, { responsavel = 'zelador', prestador = null, prazo = null }, perfil, agora) {
  const falha = guardaMan(estado, perfil, true);
  if (falha) return erroMan(estado, falha);
  const oc = estado.ocorrencias.find((o) => o.id === idNotificacao);
  if (!oc) return erroMan(estado, 'Ocorrência não encontrada');
  if (oc.os) return erroMan(estado, `Esta notificação já tem a ${oc.os}`);
  const limite = PRIORIDADES[oc.prioridade].solucao;
  const prazoFinal = prazo || new Date(new Date(oc.criadaEm).getTime() + (limite || 168) * 3600000).toISOString();
  const quem = responsavel === 'prestador' ? `o prestador ${prestador}` : 'o zelador';
  const os = novaOS(estado, { origem: 'notificacao', notificacao: oc.id, local: oc.local || CATEGORIAS[oc.categoria].nome, descricao: oc.descricao, prioridade: oc.prioridade, prazo: prazoFinal, responsavel, prestador: responsavel === 'prestador' ? prestador : null, linha: [{ em: agora.toISOString(), status: 'aberta', texto: `OS aberta a partir da ${oc.id}`, autor: 'Síndico' }] }, agora);
  const entrada = { em: agora.toISOString(), status: oc.status === 'em_andamento' ? null : 'em_andamento', texto: `${os.id} aberta para ${quem}`, autor: 'Síndico' };
  return {
    estado: {
      ...comManutencao(estado, { os: [...estado.manutencao.os, os], proximaOS: estado.manutencao.proximaOS + 1 }),
      ocorrencias: trocarItem(estado.ocorrencias, oc.id, { os: os.id, status: 'em_andamento', linha: [...oc.linha, entrada] }),
    },
    id: os.id,
    notificacao: { canal: 'Push', para: responsavel === 'prestador' ? prestador : ZELADOR, texto: `Nova ${os.id}: ${os.local}` },
  };
}

export function abrirOS(estado, { local, descricao, prioridade = 'normal', prazo = null }, perfil, agora) {
  const falha = guardaMan(estado, perfil);
  if (falha) return erroMan(estado, falha);
  if (!String(local || '').trim() || !String(descricao || '').trim()) return erroMan(estado, 'Informe o local e a descrição');
  const os = novaOS(estado, { origem: perfil === 'sindico' ? 'sindico' : 'ronda', notificacao: null, local: local.trim(), descricao: descricao.trim(), prioridade, prazo: prazo || new Date(agora.getTime() + 7 * DIA_MS).toISOString(), responsavel: 'zelador', linha: [{ em: agora.toISOString(), status: 'aberta', texto: perfil === 'sindico' ? 'OS aberta pelo síndico' : 'OS aberta na ronda do zelador', autor: autorDe(perfil) }] }, agora);
  return { estado: comManutencao(estado, { os: [...estado.manutencao.os, os], proximaOS: estado.manutencao.proximaOS + 1 }), id: os.id };
}

export function iniciarOS(estado, id, perfil, agora) {
  const falha = guardaMan(estado, perfil);
  if (falha) return erroMan(estado, falha);
  const os = estado.manutencao.os.find((o) => o.id === id);
  if (!os || !['aberta', 'aguardando_material', 'aguardando_prestador'].includes(os.status)) return erroMan(estado, 'Esta OS não pode ser iniciada agora');
  return { estado: mudarOS(estado, id, { status: 'em_execucao', iniciadaEm: os.iniciadaEm || agora.toISOString() }, { em: agora.toISOString(), status: 'em_execucao', texto: os.status === 'aberta' ? 'Iniciada' : 'Retomada', autor: autorDe(perfil) }) };
}

export function pausarOS(estado, id, motivo, perfil, agora) {
  const falha = guardaMan(estado, perfil);
  if (falha) return erroMan(estado, falha);
  const os = estado.manutencao.os.find((o) => o.id === id);
  if (!os || os.status !== 'em_execucao' || !['aguardando_material', 'aguardando_prestador'].includes(motivo)) return erroMan(estado, 'Só OS em execução podem aguardar');
  const texto = motivo === 'aguardando_material' ? 'Aguardando material' : 'Aguardando prestador';
  return { estado: mudarOS(estado, id, { status: motivo }, { em: agora.toISOString(), status: motivo, texto, autor: autorDe(perfil) }) };
}

export function concluirOS(estado, id, { fotoDepois, materiais = '', horas, observacoes = '' }, perfil, agora) {
  const falha = guardaMan(estado, perfil);
  if (falha) return erroMan(estado, falha);
  const os = estado.manutencao.os.find((o) => o.id === id);
  if (!os || !['em_execucao', 'aguardando_material', 'aguardando_prestador'].includes(os.status)) return erroMan(estado, 'Inicie a OS antes de concluir');
  if (!fotoDepois) return erroMan(estado, 'Anexe a foto do depois');
  if (!(horas > 0)) return erroMan(estado, 'Informe as horas gastas');
  const em = agora.toISOString();
  let novo = mudarOS(estado, id, { status: 'concluida', fotoDepois: true, materiais: materiais.trim(), horas, observacoes: observacoes.trim(), concluidaEm: em }, { em, status: 'concluida', texto: 'Concluída com fotos do depois', autor: autorDe(perfil) });
  const oc = os.notificacao ? novo.ocorrencias.find((o) => o.id === os.notificacao) : null;
  if (!oc || ['resolvida', 'fechada'].includes(oc.status)) return { estado: novo, notificacao: { canal: 'Push', para: 'Síndico', texto: `${id} concluída: validar` } };
  novo = { ...novo, ocorrencias: trocarItem(novo.ocorrencias, oc.id, { status: 'resolvida', linha: [...oc.linha, { em, status: 'resolvida', texto: 'Reparo concluído pelo zelador (fotos do antes e depois)', autor: 'Síndico' }] }) };
  return { estado: novo, notificacao: { canal: 'Push', para: nomesDaUnidade(estado, oc.unidade), texto: `Seu chamado ${oc.id} foi resolvido` } };
}

export function validarOS(estado, id, perfil, agora) {
  const falha = guardaMan(estado, perfil, true);
  if (falha) return erroMan(estado, falha);
  const os = estado.manutencao.os.find((o) => o.id === id);
  if (!os || os.status !== 'concluida') return erroMan(estado, 'Só OS concluídas podem ser validadas');
  return { estado: mudarOS(estado, id, { status: 'validada', validadaEm: agora.toISOString() }, { em: agora.toISOString(), status: 'validada', texto: 'Validada pelo síndico', autor: 'Síndico' }) };
}
```
    - Observação: na resolução da notificação, o autor da entrada é 'Síndico' (o sistema em nome do condomínio), para não criar uma 1ª resposta falsa nem um autor novo.

- [ ] **Step 4: Rodar e ver passar**
  - O teste da ronda espera o prazo '2026-10-26', ou seja, agora + 7 dias.
  - O teste de alerta urgente usa agora = 07:00 para a criação e 10:00 na consulta, o que dá 3 h.

- [ ] **Step 5: Commit** `feat(manutencao): OS do zelador com fluxo, conclusão que resolve a notificação e alertas`

---

### Task 4: Compras, cotações e caixa pequeno

**Files:**
- Modify: `src/manutencao/acoes.js`
- Test: `src/casos/manutencao.js`

- [ ] **Step 1: Testes**
```js
  {
    nome: 'compras: solicitação, recusa e aprovação',
    rodar() {
      const e = estadoMan();
      igual(solicitarCompra(e, { item: '', quantidade: 1, valorEstimado: 100 }, 'zelador', AGORA_FASE2).erro, 'Informe item, quantidade e valor');
      const s = solicitarCompra(e, { item: 'Bomba reserva', quantidade: 1, valorEstimado: 250000, categoria: 'manutencao' }, 'zelador', AGORA_FASE2);
      igual(s.id, 'CP-003');
      igual(aprovarCompra(s.estado, 'CP-003', 'zelador', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      igual(recusarCompra(s.estado, 'CP-003', '', 'sindico', AGORA_FASE2).erro, 'Informe o motivo da recusa');
      igual(compraDe(recusarCompra(s.estado, 'CP-003', 'Fora do orçamento', 'sindico', AGORA_FASE2).estado, 'CP-003').status, 'recusada');
      igual(compraDe(aprovarCompra(s.estado, 'CP-003', 'sindico', AGORA_FASE2).estado, 'CP-003').status, 'aprovada');
    },
  },
  {
    nome: 'compras: cotações mínimas no Avançado',
    rodar() {
      const e = { ...estadoMan(), plano: 'avancado' };
      igual([cotacoesMinimas(50000).minimo, cotacoesMinimas(50001).minimo, cotacoesMinimas(200001).minimo], [1, 2, 3]);
      let s = solicitarCompra(e, { item: 'Bomba reserva', quantidade: 1, valorEstimado: 250000, categoria: 'manutencao', cotacoes: [{ fornecedor: 'A', valor: 250000 }] }, 'zelador', AGORA_FASE2);
      igual(aprovarCompra(s.estado, 'CP-003', 'sindico', AGORA_FASE2).erro, 'Anexe 3 cotações para compras acima de R$ 2.000,00');
      s = anexarCotacao(s.estado, 'CP-003', { fornecedor: 'B', valor: 240000 }, 'sindico', AGORA_FASE2);
      s = anexarCotacao(s.estado, 'CP-003', { fornecedor: 'C', valor: 260000 }, 'zelador', AGORA_FASE2);
      igual(compraDe(aprovarCompra(s.estado, 'CP-003', 'sindico', AGORA_FASE2).estado, 'CP-003').status, 'aprovada');
      igual(aprovarCompra(estadoMan(), 'CP-001', 'sindico', AGORA_FASE2).erro, undefined);
    },
  },
  {
    nome: 'compras: recebimento com nota lança a despesa',
    rodar() {
      const a = aprovarCompra(estadoMan(), 'CP-001', 'sindico', AGORA_FASE2).estado;
      igual(receberCompra(a, 'CP-001', { valorFinal: 39000, nota: '' }, 'zelador', AGORA_FASE2).erro, 'Anexe a nota fiscal (obrigatória acima de R$ 200,00)');
      igual(receberCompra(estadoMan(), 'CP-001', { valorFinal: 39000, nota: 'n.pdf' }, 'zelador', AGORA_FASE2).erro, 'Só compras aprovadas podem ser recebidas');
      const r = receberCompra(a, 'CP-001', { valorFinal: 39000, nota: 'nota-CP-001.pdf' }, 'zelador', AGORA_FASE2);
      igual([compraDe(r.estado, 'CP-001').status, r.estado.financeiro.despesasMes.manutencao, r.estado.financeiro.saldo, r.estado.financeiro.auditoria.at(-1).acao], ['recebida', 269000, 4796000, 'Compra lançada']);
    },
  },
  {
    nome: 'caixa pequeno: cupom, limite, saldo e reposição',
    rodar() {
      const e = { ...estadoMan(), plano: 'avancado' };
      igual(gastoCaixa(estadoMan(), { descricao: 'x', valor: 1000, cupom: true }, 'zelador', AGORA_FASE2).erro, 'Disponível no plano Avançado');
      igual(gastoCaixa(e, { descricao: 'Fusíveis', valor: 1000, cupom: false }, 'zelador', AGORA_FASE2).erro, 'Anexe a foto do cupom');
      igual(gastoCaixa(e, { descricao: 'Fusíveis', valor: 20001, cupom: true }, 'zelador', AGORA_FASE2).erro, 'Gasto acima de R$ 200,00: faça uma compra');
      const g = gastoCaixa(e, { descricao: 'Fusíveis', valor: 2500, cupom: true }, 'zelador', AGORA_FASE2);
      igual(g.estado.manutencao.caixa.saldo, 21450);
      igual(gastoCaixa(g.estado, { descricao: 'x', valor: 19000, cupom: true }, 'zelador', AGORA_FASE2).estado.manutencao.caixa.saldo, 2450);
      const sem = gastoCaixa(g.estado, { descricao: 'x', valor: 19000, cupom: true }, 'zelador', AGORA_FASE2).estado;
      igual(gastoCaixa(sem, { descricao: 'x', valor: 3000, cupom: true }, 'zelador', AGORA_FASE2).erro, 'Saldo do caixa pequeno insuficiente');
      igual(reporCaixa(sem, 'zelador', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      const r = reporCaixa(sem, 'sindico', AGORA_FASE2);
      igual([r.estado.manutencao.caixa.saldo, r.estado.financeiro.despesasMes.manutencao, r.estado.financeiro.saldo, r.estado.manutencao.caixa.reposicoes[0].valor], [30000, 257550, 4807550, 27550]);
    },
  },
```
  - **Imports:**
    - `solicitarCompra, anexarCotacao, aprovarCompra, recusarCompra, receberCompra, gastoCaixa, reporCaixa` no import de acoes;
    - `cotacoesMinimas` no de regras.
  - **Helper no arquivo de casos:**
```js
function compraDe(e, id) {
  return e.manutencao.compras.find((c) => c.id === id);
}
```

- [ ] **Step 2: Rodar e ver falhar**

- [ ] **Step 3: Implementar** (acrescente a `src/manutencao/acoes.js`)
  - **Imports:**
    - `import { fmtReais } from '../cobranca/regras.js';`
    - `import { comAuditoria } from '../cobranca/acoes.js';`
    - `import { cotacoesMinimas, textoCotacoes } from './regras.js';`
  - **Código:**
```js
const LIMITE_CAIXA = 20000;

function compraPorId(estado, id) {
  return estado.manutencao.compras.find((c) => c.id === id);
}

function lancarDespesa(estado, categoria, valor, agora, detalhe) {
  const fin = estado.financeiro;
  return { ...estado, financeiro: { ...fin, despesasMes: { ...fin.despesasMes, [categoria]: fin.despesasMes[categoria] + valor }, saldo: fin.saldo - valor, auditoria: comAuditoria(estado, agora, detalhe.acao, detalhe.texto) } };
}

export function solicitarCompra(estado, { item, quantidade, valorEstimado, motivo = '', categoria = 'manutencao', os = null, urgente = false, cotacoes = [] }, perfil, agora) {
  const falha = guardaMan(estado, perfil);
  if (falha) return erroMan(estado, falha);
  if (!String(item || '').trim() || !(quantidade >= 1) || !(valorEstimado > 0)) return erroMan(estado, 'Informe item, quantidade e valor');
  const id = `CP-${String(estado.manutencao.proximaCompra).padStart(3, '0')}`;
  const compra = { id, item: item.trim(), quantidade, motivo: String(motivo).trim(), valorEstimado, categoria, os, urgente, cotacoes: [...cotacoes], status: 'solicitada', motivoRecusa: null, valorFinal: null, nota: null, viaCaixa: false, criadaEm: agora.toISOString(), aprovadaEm: null, recebidaEm: null };
  return {
    estado: comManutencao(estado, { compras: [...estado.manutencao.compras, compra], proximaCompra: estado.manutencao.proximaCompra + 1 }),
    id,
    notificacao: { canal: 'Push', para: 'Síndico', texto: `${id} aguardando aprovação: ${compra.item}, ${fmtReais(valorEstimado)}` },
  };
}

export function anexarCotacao(estado, id, { fornecedor, valor }, perfil) {
  const falha = guardaMan(estado, perfil);
  if (falha) return erroMan(estado, falha);
  const c = compraPorId(estado, id);
  if (!c || c.status !== 'solicitada') return erroMan(estado, 'Só compras aguardando aprovação recebem cotação');
  if (!String(fornecedor || '').trim() || !(valor > 0)) return erroMan(estado, 'Informe fornecedor e valor da cotação');
  return { estado: comManutencao(estado, { compras: trocarItem(estado.manutencao.compras, id, { cotacoes: [...c.cotacoes, { fornecedor: fornecedor.trim(), valor }] }) }) };
}

export function aprovarCompra(estado, id, perfil, agora) {
  const falha = guardaMan(estado, perfil, true);
  if (falha) return erroMan(estado, falha);
  const c = compraPorId(estado, id);
  if (!c || c.status !== 'solicitada') return erroMan(estado, 'Esta compra não está aguardando aprovação');
  if (liberado(estado.plano, 'cotacoes') && c.cotacoes.length < cotacoesMinimas(c.valorEstimado).minimo) return erroMan(estado, textoCotacoes(c.valorEstimado));
  return {
    estado: comManutencao(estado, { compras: trocarItem(estado.manutencao.compras, id, { status: 'aprovada', aprovadaEm: agora.toISOString() }) }),
    notificacao: { canal: 'Push', para: ZELADOR, texto: `${id} aprovada: pode comprar` },
  };
}

export function recusarCompra(estado, id, motivo, perfil) {
  const falha = guardaMan(estado, perfil, true);
  if (falha) return erroMan(estado, falha);
  const c = compraPorId(estado, id);
  if (!c || c.status !== 'solicitada') return erroMan(estado, 'Esta compra não está aguardando aprovação');
  if (!String(motivo || '').trim()) return erroMan(estado, 'Informe o motivo da recusa');
  return {
    estado: comManutencao(estado, { compras: trocarItem(estado.manutencao.compras, id, { status: 'recusada', motivoRecusa: motivo.trim() }) }),
    notificacao: { canal: 'Push', para: ZELADOR, texto: `${id} recusada: ${motivo.trim()}` },
  };
}

export function receberCompra(estado, id, { valorFinal, nota }, perfil, agora) {
  const falha = guardaMan(estado, perfil);
  if (falha) return erroMan(estado, falha);
  const c = compraPorId(estado, id);
  if (!c || c.status !== 'aprovada') return erroMan(estado, 'Só compras aprovadas podem ser recebidas');
  if (!(valorFinal > 0)) return erroMan(estado, 'Informe o valor final');
  if (valorFinal > LIMITE_CAIXA && !String(nota || '').trim()) return erroMan(estado, 'Anexe a nota fiscal (obrigatória acima de R$ 200,00)');
  const recebida = comManutencao(estado, { compras: trocarItem(estado.manutencao.compras, id, { status: 'recebida', valorFinal, nota: String(nota || '').trim() || null, recebidaEm: agora.toISOString() }) });
  return {
    estado: lancarDespesa(recebida, c.categoria, valorFinal, agora, { acao: 'Compra lançada', texto: `${id} · ${c.item} · ${fmtReais(valorFinal)}` }),
    notificacao: { canal: 'App', para: 'Síndico', texto: `${id} recebida: ${fmtReais(valorFinal)} lançado em despesas` },
  };
}

export function gastoCaixa(estado, { descricao, valor, cupom }, perfil, agora) {
  const falha = guardaMan(estado, perfil);
  if (falha) return erroMan(estado, falha);
  if (!liberado(estado.plano, 'caixaPequeno')) return erroMan(estado, 'Disponível no plano Avançado');
  const caixa = estado.manutencao.caixa;
  if (!String(descricao || '').trim() || !(valor > 0)) return erroMan(estado, 'Informe descrição e valor');
  if (!cupom) return erroMan(estado, 'Anexe a foto do cupom');
  if (valor > LIMITE_CAIXA) return erroMan(estado, 'Gasto acima de R$ 200,00: faça uma compra');
  if (valor > caixa.saldo) return erroMan(estado, 'Saldo do caixa pequeno insuficiente');
  const gasto = { id: `G${caixa.gastos.length + 1}`, descricao: descricao.trim(), valor, cupom: true, em: agora.toISOString() };
  return { estado: comManutencao(estado, { caixa: { ...caixa, saldo: caixa.saldo - valor, gastos: [...caixa.gastos, gasto] } }) };
}

export function reporCaixa(estado, perfil, agora) {
  const falha = guardaMan(estado, perfil, true);
  if (falha) return erroMan(estado, falha);
  if (!liberado(estado.plano, 'caixaPequeno')) return erroMan(estado, 'Disponível no plano Avançado');
  const caixa = estado.manutencao.caixa;
  const valor = caixa.fundo - caixa.saldo;
  if (!valor) return erroMan(estado, 'O caixa pequeno já está completo');
  const reposto = comManutencao(estado, { caixa: { ...caixa, saldo: caixa.fundo, reposicoes: [...caixa.reposicoes, { em: agora.toISOString(), valor }] } });
  return {
    estado: lancarDespesa(reposto, 'manutencao', valor, agora, { acao: 'Caixa pequeno reposto', texto: `${fmtReais(valor)} · ${caixa.gastos.length} gastos com cupom` }),
    notificacao: { canal: 'App', para: ZELADOR, texto: `Caixa pequeno reposto: saldo ${fmtReais(caixa.fundo)}` },
  };
}
```
  - **Contas dos testes:**
    - recebimento: despesas de manutenção 230000 + 39000 = 269000; saldo 4835000 − 39000 = 4796000;
    - caixa: depois dos gastos, o saldo é 2450, então a reposição é 27550; despesas 230000 + 27550 = 257550; saldo 4835000 − 27550 = 4807550.

- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** `feat(manutencao): compras com aprovação, cotações mínimas, recebimento com nota e caixa pequeno`

---

### Task 5: UI do síndico, notificações e Início

**Files:** `src/ui/sindico.js`, `src/estilos.css`, `verificar.mjs`

- [ ] **Step 1: Checagens primeiro (verificar.mjs)**
  - `['#sindico.inicio', ...]`: troque `'Prazo vencido: OC-0042'` por `'OC-0042: 1ª resposta vencida'`.
  - `['#sindico.ocorrencias', ['OC-0042', 'Anônima', 'Vencido']]` passa a ser `['#sindico.ocorrencias', ['Notificações', 'OC-0042', 'Anônima', '1ª resposta', 'Solução', 'vencida há', 'Prazos por prioridade', 'Urgente']]`.
  - `['#sindico.ocorrencias.OC-0039', ['Mover para "Resolvida"', 'Encanador agendado']]` ganha `'OS-003'`.
  - Novas:
```js
  ['#sindico.ocorrencias.OC-0043', ['Obra fora do horário', 'Irregularidade', 'Gerar advertência', 'Gerar OS', 'Pedir mais informações', 'Arquivar com justificativa']],
  ['#sindico.inicio', ['OC-0039: solução vencida há', 'OS-002 concluída: validar', 'CP-001 aguardando aprovação']],
```

- [ ] **Step 2: Implementar**
  - **Menu:**
    - `MENU_SINDICO`: `['ocorrencias', 'Notificações', 'prancheta']` e, depois de `ocorrencias`, `['manutencao', 'Manutenção', 'ferramenta']`;
    - se não existir o ícone `ferramenta` em `ICONES` (comum.js), crie um traço de chave inglesa: `ferramenta: 'M14 6a4 4 0 0 0-5 5L4 16l4 4 5-5a4 4 0 0 0 5-5l-3 3-3-3z'`, no mesmo formato dos outros.
  - **EM_BREVE:** passa a ser uma lista de pares, renderizada com `<small>Em breve · ${plano}</small>`:
```js
const EM_BREVE = [['Escala de porteiros', 'Intermediário'], ['Estoque, checklist e rondas', 'Avançado']];
```
  - **SInicio:**
    - `pendCobranca` passa a concatenar `alertasNotificacoes(estado, agora)` e `alertasManutencao(estado, agora)` quando `liberado(estado.plano, 'notificacoesPrazo')`;
    - remova a lista antiga `vencidas` de "Prazo vencido:" e use `vencidas` só para `semPendencias`;
    - em Operação, quando `liberado(plano, 'indicadorAtendimento')`, acrescente o cartão `['Atendimento', `${a.pct}%`, '#sindico.ocorrencias', a.alerta ? 'perigo' : 'ok', `${a.abertas} abertas · ${a.noPrazo} de ${a.comPrazo} resolvidas no prazo`, 'prancheta']`;
    - o rótulo do cartão "Ocorrências abertas" passa a ser "Notificações abertas";
    - no Básico, o detalhe dele é "Sem prazos no Básico".
  - **SOcorrencias:**
    - título "Notificações";
    - com `liberado(plano, 'notificacoesPrazo')`:
      - três selects (Mostrar, Tipo, Prioridade) com ids `notificacoes-status`, `notificacoes-tipo` e `notificacoes-prioridade`;
      - a lista vem de `caixaDeEntrada`;
      - colunas: Protocolo, Categoria (com o nome do tipo em `<small>`), Unidade, Prioridade (`Etiqueta`: urgente perigo, alta alerta, normal info, baixa neutro), 1ª resposta, Solução e Status;
      - as células de prazo mostram `Etiqueta perigo` "vencida há X" quando vencido, "ok" quando cumprido no prazo, e senão "até dd/mm hh h";
      - `<details class="composicao"><summary>Prazos por prioridade</summary>` com a tabela PRIORIDADES.
    - Sem o plano, mantenha a tabela atual, sem a coluna Prazo.
  - **SDetalheOcorrencia:** recebe `estado`. Com o plano:
    - `Campo` "Prioridade" com o select `id="notificacao-prioridade"`, que chama `definirPrioridade`;
    - se `oc.os`, o link `#sindico.manutencao.${oc.os}` com texto `${oc.os}`;
    - se não tiver OS e não estiver encerrada, o bloco "Gerar OS":
      - select "Responsável", `id="os-responsavel"`, com zelador e prestador;
      - campo "Prestador", `id="os-prestador"`, que só aparece para prestador;
      - botão `data-acao="gerar-os"` com o texto "Gerar OS";
    - se a categoria for irregularidade, o bloco "Gerar advertência":
      - `Campo` "Unidade advertida", `id="advertencia-unidade"`;
      - botão "Gerar advertência";
      - se `oc.advertencia`, o texto "Advertência enviada ao apto X";
    - o botão "Pedir mais informações", que usa a mensagem do textarea e chama `pedirInformacao`;
    - em vez de "Arquivar" (só para fechadas), o bloco "Arquivar com justificativa" com o campo "Motivo do arquivamento", `id="arquivar-motivo"`, que chama `arquivarComJustificativa`;
    - todos com `Erro` e `Sucesso`.
  - **Nomes de status:** como `EtqOcorrencia` usa NOMES_STATUS, os nomes novos aparecem sozinhos.

- [ ] **Step 3: Rodar** `npm test && npm run montar && npm run verificar` e ver tudo ok.
- [ ] **Step 4: Commit** `feat(notificacoes): caixa de entrada do síndico com prazos e ações`

---

### Task 6: UI do síndico, Manutenção

**Files:** Create `src/ui/manutencao-sindico.js`; Modify `src/ui/sindico.js` (TelaSindico mapeia `manutencao: SManutencao`), `montagem.mjs` (depois de `ui/acordos.js`), `verificar.mjs`, `src/estilos.css`

- [ ] **Step 1: Checagens**
```js
  ['#sindico.manutencao', ['Manutenção', 'OS-003', 'Em execução', 'Garagem, vaga 12', 'OS-002', 'Concluída', 'Nova OS']],
  ['#sindico.manutencao.compras', ['CP-001', 'Aguardando aprovação', 'Registro de 3/4', 'Aprovar', 'Recusar', 'CP-002', 'Recebida']],
  ['#sindico.manutencao.caixa', ['Caixa pequeno', 'Disponível no plano Avançado']],
  ['#sindico.manutencao.OS-002', ['Validar', 'OC-0037', 'Concluída com fotos do depois']],
```

- [ ] **Step 2: Implementar `SManutencao(props)`**
  - **Bloqueio:** sem o plano `zelador`, mostra `<Bloqueado recurso="zelador" titulo="Ordens de serviço, compras com aprovação e caixa pequeno do zelador" />`.
  - **Abas** (chips, como na Cobrança): `[['os','Ordens de serviço'],['compras','Compras'],['caixa','Caixa pequeno']]`.
  - **Rotas:**
    - `rota.id` que começa com `OS-` abre o detalhe da OS;
    - que começa com `CP-` abre o detalhe da compra, na aba compras;
    - `'novaos'` abre o formulário.
  - **Aba OS:**
    - tabela vinda de `listaOS`, com OS, Local, Prioridade, Responsável, Prazo, Status (`NOMES_STATUS_OS`) e o link "Abrir" com `data-os`;
    - botão "Nova OS", que leva a `#sindico.manutencao.novaos` com local, descrição, prioridade e "Criar OS" (`abrirOS` com perfil 'sindico').
  - **Detalhe da OS:**
    - campos e notificação ligada (link `#sindico.ocorrencias.OC-xxx`);
    - `FotoFalsa` "Foto do antes" e, se houver, "Foto do depois";
    - materiais, horas e observações;
    - `LinhaTempo` com `os.linha`;
    - botão "Validar" (`data-acao="validar-os"`) se a OS estiver concluída.
  - **Aba Compras:**
    - **Lista:** solicitadas primeiro. Colunas: Compra, Item, Valor, Cotações (n), Status (Etiqueta: solicitada alerta "Aguardando aprovação", aprovada info "Aprovada", recusada neutro "Recusada", recebida ok "Recebida") e "Abrir" (`data-compra`).
    - **Detalhe da compra:**
      - item, quantidade, motivo, OS ligada e lista de cotações;
      - no Avançado: "Mínimo: N cotações", vindo de `cotacoesMinimas`, e o form "Anexar cotação" com Fornecedor e Valor (R$), que usa `lerPreco`;
      - se a compra está solicitada: botões "Aprovar" (`data-acao="aprovar-compra"`) e "Recusar", com o campo "Motivo da recusa";
      - se está recebida: valor final, nota e "Lançada em despesas".
  - **Aba Caixa:**
    - sem `caixaPequeno`, mostra `Bloqueado recurso="caixaPequeno"`;
    - com ele: saldo (`fmtReais`) de `fmtReais(fundo)`, lista de gastos com "cupom anexado" e o botão "Repor fundo", que chama `reporCaixa`.

- [ ] **Step 3: Rodar** os testes e o verificar.
- [ ] **Step 4: Commit** `feat(manutencao): menu Manutenção do síndico com OS, compras e caixa pequeno`

---

### Task 7: Perfil Zelador e faixa da portaria

**Files:** Create `src/ui/zelador.js`; Modify `src/ui/comum.js` (PERFIS), `src/ui/app.js` (TELAS_PERFIL), `src/ui/portaria.js`, `src/estilos.css`, `montagem.mjs`, `verificar.mjs`

- [ ] **Step 1: Checagens**
```js
  ['#zelador.os', ['Seu Antônio', 'OS-003', 'Garagem, vaga 12', 'Nova OS', 'Compras', 'Caixa']],
  ['#zelador.os.OS-003', ['Concluir', 'Aguardando material', 'Foto do antes']],
  ['#zelador.compras', ['CP-001', 'Aguardando aprovação', 'Nova compra']],
  ['#zelador.caixa', ['Disponível no plano Avançado']],
  ['#portaria.hoje', ['Notificação urgente: OC-0039']],
```

- [ ] **Step 2: Implementar**
  - **PERFIS:** acrescente `{ id: 'zelador', nome: 'Zelador', inicial: 'os' }`. O "Ver como" já itera PERFIS.
  - **`TelaZelador(props)`:** moldura `.celular`, igual à do morador.
    - **Cabeçalho:** `cel-status` e uma faixa `.cel-pessoa` com `<strong>Seu Antônio · Zelador</strong>`.
    - **Abas inferiores:** `[['os','OS','prancheta'],['compras','Compras','sacola'],['caixa','Caixa','cifrao']]`.
    - **Bloqueio:** sem o plano `zelador`, o conteúdo é o `Bloqueado` com "Módulo do zelador disponível no plano Intermediário".
  - **ZOS:**
    - lista vinda de `listaOS`, sem validadas, em cartões com local, descrição, `Etiqueta` de prioridade, status e prazo;
    - botão "Nova OS" (`#zelador.os.nova`): Local, Descrição, Prioridade e "Registrar OS", com `abrirOS` e perfil 'zelador'.
  - **ZDetalheOS:**
    - descrição e `FotoFalsa` "Foto do antes";
    - botões conforme o status:
      - "Iniciar" ou "Retomar" (`iniciarOS`);
      - "Aguardando material" e "Aguardando prestador" (`pausarOS`);
      - "Concluir", que abre o form com o botão "Anexar foto do depois" (marca `fotoDepois`), Materiais usados, Horas gastas (`type=number step=0.5`), Observações e "Concluir OS" (`data-acao="concluir-os"`);
    - `LinhaTempo`.
  - **ZCompras:**
    - lista das compras;
    - "Nova compra" (`#zelador.compras.nova`):
      - campos: Item, Quantidade, Valor estimado (R$), Categoria (`CATEGORIAS_COMPRA`), OS vinculada (select com as OS ativas) e Motivo;
      - no Avançado, Fornecedor e Valor da cotação;
      - botão "Pedir compra";
    - em compra aprovada, "Registrar recebimento" (`data-compra-receber=id`), que abre Valor final (R$), o botão "Anexar nota fiscal" (define `nota-${id}.pdf`) e "Confirmar recebimento".
  - **ZCaixa:**
    - sem `caixaPequeno`, `Bloqueado`;
    - com ele: saldo, gastos e "Novo gasto" com Descrição, Valor (R$), "Anexar foto do cupom" e "Registrar gasto".
  - **Portaria:** em `TelaPortaria`, logo acima do conteúdo, para cada `urgentesAbertas(estado)`:
```js
html`<p class="faixa-urgente" key=${o.id}>Notificação urgente: ${o.id} · ${CATEGORIAS[o.categoria].nome} · ${o.local}</p>`
```
  - **CSS:**
    - `.faixa-urgente { margin: 0 0 12px; padding: 10px 14px; background: var(--perigo-bg); color: var(--perigo); font-weight: 600; border-left: 3px solid var(--perigo); border-radius: var(--raio); }`;
    - `.palco-zelador` igual a `.palco-morador`, se houver regra específica.

- [ ] **Step 3: Rodar** os testes e o verificar. Também `npm run e2e`, para garantir que o "Ver como" com 4 botões cabe em 390 px (roteiro larguraCelular).
- [ ] **Step 4: Commit** `feat(manutencao): perfil Zelador com OS, compras e caixa, e faixa de urgente na portaria`

---

### Task 8: Morador, nova notificação e detalhe

**Files:** `src/ui/morador.js`, `verificar.mjs`, `e2e.mjs` (roteiro `ocorrencia`)

- [ ] **Step 1: Implementar**
  - **MOcorrencias:** título "Notificações" e botão "Abrir notificação". No item, mostre o nome do tipo em `small`.
  - **MNovaOcorrencia:**
    - estado `tipo`;
    - botões de tipo (`aria-pressed`): "Manutenção", "Irregularidade" e "Sugestão ou elogio";
    - o select `Categoria` (`id="ocorrencia-categoria"`) só lista as categorias do tipo escolhido, e só aparece depois de escolher o tipo;
    - com categoria escolhida, `parecidas(estado, categoria, eu)` mostra o cartão "Já avisaram sobre isso" com cada parecida e um botão "Eu também" (`data-eutambem=id`), que chama `euTambem`;
    - "Enviar como anônima" passa a se chamar "Não me identificar para os outros" e só aparece em irregularidade, com a ajuda "O síndico sempre vê quem enviou, para evitar abuso.";
    - o botão final passa a ser "Enviar notificação". O componente precisa de `estado` nas props.
  - **MDetalheOcorrencia:**
    - mostra `Prioridade: X` e, com o plano `notificacoesPrazo` e prazo de solução não encerrado, `Previsão de solução: até ${fmtDataCurta(limite)}, ${hora}h`;
    - se `oc.os`, mostra "Ordem de serviço ${oc.os} com o zelador";
    - o botão "Eu também" aparece se `oc.publica || oc.unidade !== eu`;
    - quando a linha tiver "Reparo concluído", mostra `FotoFalsa` "Antes" e "Depois", lado a lado em `.fotos-reparo`.
  - **verificar.mjs:**
    - `['#morador.ocorrencias', ['Vaga ocupada', 'Públicas do condomínio', 'eu também']]` ganha `'Notificações'`;
    - `['#morador.ocorrencias.OC-0042', ['Protocolo OC-0042', 'Ocorrência aberta']]` ganha `'Previsão de solução'`;
    - nova: `['#morador.ocorrencias.nova', ['Manutenção', 'Irregularidade', 'Sugestão ou elogio', 'Enviar notificação']]`.
  - **Roteiro e2e `ocorrencia`:**
    - antes de preencher a categoria: `await clicar('Manutenção');`;
    - "Enviar ocorrência" passa a ser "Enviar notificação";
    - os protocolos passam de OC-0043 para OC-0044;
    - o laço de status passa a ser `['Em análise', 'Em atendimento', 'Resolvida']`, com os textos "Mover para \"...\"" e "Status alterado para ...".

- [ ] **Step 2: Rodar** os testes, o verificar e o e2e.
- [ ] **Step 3: Commit** `feat(notificacoes): nova notificação do morador por tipo, parecidas e previsão de solução`

---

### Task 9: Roteiros e2e novos, largura de celular e publicação

**Files:** `e2e.mjs`

- [ ] **Step 1: Roteiros** (depois de `acordoPlanos` e antes de `larguraCelular`; o primeiro começa com "Reiniciar demonstração")
```js
  async notificacaoOS() {
    await clicar('Reiniciar demonstração');
    await irPara('#morador.ocorrencias.nova');
    await clicar('Manutenção');
    await preencher('Categoria', 'vazamento');
    await esperarTexto('Já avisaram sobre isso');
    await preencher('Local', 'Hall do 3º andar');
    await preencher('Descrição', 'Água descendo pela parede do hall');
    await clicar('Enviar notificação');
    await esperarTexto('Protocolo OC-0044');
    await irPara('#portaria.hoje');
    await esperarTexto('Notificação urgente: OC-0044');
    await irPara('#sindico.ocorrencias.OC-0044');
    await clicarSeletor('[data-acao="gerar-os"]');
    await esperarTexto('OS-004');
    await irPara('#zelador.os.OS-004');
    await clicar('Iniciar');
    await clicar('Concluir');
    await preencher('Horas gastas', '1');
    await clicarSeletor('[data-acao="concluir-os"]');
    await esperarTexto('Anexe a foto do depois');
    await clicar('Anexar foto do depois');
    await clicarSeletor('[data-acao="concluir-os"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Seu chamado OC-0044 foi resolvido')`, 'o aviso ao morador');
    await irPara('#morador.ocorrencias.OC-0044');
    await esperarTexto('Reparo concluído pelo zelador');
    await clicarSeletor('[data-estrela="5"]');
    await clicar('Enviar avaliação');
    await irPara('#sindico.manutencao.OS-004');
    await clicarSeletor('[data-acao="validar-os"]');
    await esperarTexto('Validada pelo síndico');
  },

  async compraAprovacao() {
    await irPara('#zelador.compras.nova');
    await preencher('Item', 'Lâmpadas LED 9 W (caixa com 10)');
    await preencher('Quantidade', '1');
    await preencher('Valor estimado (R$)', '250,00');
    await clicar('Pedir compra');
    await esperarTexto('CP-003');
    await irPara('#sindico.manutencao.CP-003');
    await clicarSeletor('[data-acao="aprovar-compra"]');
    await irPara('#zelador.compras');
    await clicarSeletor('[data-compra-receber="CP-003"]');
    await preencher('Valor final (R$)', '240,00');
    await clicar('Confirmar recebimento');
    await esperarTexto('Anexe a nota fiscal (obrigatória acima de R$ 200,00)');
    await clicar('Anexar nota fiscal');
    await clicar('Confirmar recebimento');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('lançado em despesas')`, 'o lançamento');
    await irPara('#sindico.inicio');
    await esperarTexto('R$ 18.340');
  },

  async zeladorAvancado() {
    await clicar('Avançado');
    await irPara('#zelador.compras.nova');
    await preencher('Item', 'Bomba reserva');
    await preencher('Quantidade', '1');
    await preencher('Valor estimado (R$)', '2.500,00');
    await preencher('Fornecedor', 'Hidro Bombas');
    await preencher('Valor da cotação (R$)', '2.500,00');
    await clicar('Pedir compra');
    await irPara('#sindico.manutencao.CP-004');
    await clicarSeletor('[data-acao="aprovar-compra"]');
    await esperarTexto('Anexe 3 cotações para compras acima de R$ 2.000,00');
    await irPara('#zelador.caixa');
    await clicar('Novo gasto');
    await preencher('Descrição', 'Fusíveis');
    await preencher('Valor (R$)', '25,00');
    await clicar('Registrar gasto');
    await esperarTexto('Anexe a foto do cupom');
    await clicar('Anexar foto do cupom');
    await clicar('Registrar gasto');
    await esperarTexto('R$ 214,50');
    await clicar('Intermediário');
  },

  async advertencia() {
    await irPara('#sindico.ocorrencias.OC-0043');
    await preencher('Unidade advertida', '503');
    await clicar('Gerar advertência');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Apto 503') && !document.querySelector('.selo').innerText.includes('Sônia')`, 'a advertência sem o denunciante');
    await esperarTexto('Advertência enviada ao apto 503');
  },

  async planosManutencao() {
    await clicar('Básico');
    await irPara('#zelador.os');
    await esperarTexto('Módulo do zelador disponível no plano Intermediário');
    await irPara('#sindico.ocorrencias');
    await esperar(`!document.body.innerText.includes('1ª resposta')`, 'a caixa sem prazos no Básico');
    await clicar('Intermediário');
  },
```
  - **Conta do `compraAprovacao`:** depois do `notificacaoOS` (que reinicia), as despesas do mês voltam a R$ 18.100. Somando a compra de R$ 240, ficam R$ 18.340.
  - **Larguras:** acrescente a `larguraCelular` os hashes `'#sindico.manutencao'`, `'#sindico.manutencao.compras'`, `'#zelador.os'`, `'#zelador.os.OS-003'`, `'#zelador.compras'` e `'#morador.ocorrencias.nova'`.

- [ ] **Step 2: Rodar tudo** (`npm test && npm run montar && npm run verificar && npm run e2e`). Esperado: tudo ok, com 20 roteiros.
- [ ] **Step 3: Conferência visual:** capturas do Início, da caixa de Notificações, da Manutenção e do Zelador.
- [ ] **Step 4: Commit** do e2e e do `condofacil.html`.
- [ ] **Step 5: Publicar** com `url` https://claude.ai/artifact/U7U8aKxcxM9A1Hbnb9bv9r e label "Fase 2: manutenção". Depois, merge ff em `master` e push com o ok do usuário.
