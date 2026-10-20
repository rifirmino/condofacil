# Escala de porteiros: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Escala de porteiros no protótipo:
- geração do mês com buracos e feriados, e publicação;
- troca entre colegas e falta com sugestão de cobertura;
- alerta de 11 h;
- check-in e relatório de horas no Avançado.

**Architecture:**
- **Regras e ações puras** em `src/escala/`, que devolvem `{ estado, notificacao?, erro?, alerta? }`.
- **Turnos:** são gerados das atribuições e guardados por mês em `estado.escala.meses`. Datas e horas são strings locais `'AAAA-MM-DDTHH:MM'`, comparáveis como texto.
- **Seed:** gerado pelas próprias funções em `comEscalaInicial`.
- **UI:** `src/ui/escala-sindico.js` (menu Escala) e `src/ui/escala-portaria.js` (aba Escala da portaria).

**Tech Stack:** Preact + htm, ES modules concatenados por `montagem.mjs`, `node --test`, Chrome headless.

**Spec:** `docs/superpowers/specs/2026-10-19-fase2-escala-design.md`

## Global Constraints

- Todos os comandos rodam em `prototipo/`.
- **Imports e nomes:** os imports locais ocupam uma linha cada. Nomes de topo são únicos em todos os arquivos de `src/`. `export` só aparece em declarações de topo.
- **Datas dos testes:** `AGORA_FASE2 = new Date(2026, 9, 19, 10, 0)`. 19/10/2026 é uma segunda-feira, e 01/10/2026 é uma quinta.
- **Módulo:** o resto de divisão com negativos usa `((n % m) + m) % m`.
- **Textos de erro:** exatamente os da spec.
- **Versão dos dados:** `versao` 6, e `carregarEstado` aceita só a 6.
- **Verificação:** `npm test`, `npm run verificar` e `npm run e2e` precisam passar no fim de cada task que tocar no que eles cobrem.
- **Git:** trabalhar no branch `fase2-escala`. Os commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Dados, geração e regras da escala

**Files:**
- Create: `src/escala/dados.js`, `src/escala/regras.js`, `src/casos/escala.js`
- Modify: `src/planos.js`, `montagem.mjs` (depois de `src/manutencao/acoes.js`; casos depois de `src/casos/manutencao.js`), runners de teste

**Interfaces (Produces):**
- **`src/escala/dados.js`:** `POSTOS`, `PORTEIROS`, `EMPRESAS`, `NOMES_VINCULO`, `MODELOS`, `FERIADOS`, `NOMES_MOTIVO = { ferias: 'férias', falta: 'falta', atestado: 'atestado' }` e `atribuicoesIniciais(mes)`.
- **`src/escala/regras.js`:**
  - utilitários de tempo e consulta: `horaLocal(dia, h)`, `instanteLocal(agora)`, `horasEntreLocal(a, b)`, `porteiroPorId(id)`, `todosTurnos(estado)`, `acharTurno(estado, id)`;
  - geração e cobertura: `gerarTurnos(escala, mes)`, `turnosComVespera(estado, mes)`, `buracos(estado, mes, posto)`, `feriadosDoMes(mes)`;
  - descanso e sugestões: `conflita(estado, porteiro, turno)`, `menorDescanso(estado, porteiro, turno)`, `descansoInsuficiente(estado, mes)`, `sugestoesCobertura(estado, turnoId)`;
  - consultas para as telas: `plantaoAgora(estado, agora)`, `turnosDoPorteiro(estado, porteiro, agora)`, `relatorioHoras(estado, mes)`, `alertasEscala(estado, agora)`, `fmtTurno(turno)` (por exemplo "20/10 7h–15h");
  - mês corrente: `mesAtual(agora)`.

- [ ] **Step 1: Implementar os dados**
```js
// src/escala/dados.js
// Postos, porteiros, modelos de turno e feriados da escala (fase 2, parte 4).
export const POSTOS = { portaria: { nome: 'Portaria principal', abre: 0, fecha: 24 }, guarita: { nome: 'Guarita da garagem', abre: 7, fecha: 22 } };
export const PORTEIROS = [
  { id: 'jose', nome: 'Seu José', vinculo: 'clt', empresa: null, telefone: '(11) 98811-2040', postos: ['portaria'] },
  { id: 'marcos', nome: 'Marcos', vinculo: 'clt', empresa: null, telefone: '(11) 97720-3151', postos: ['portaria', 'guarita'] },
  { id: 'edson', nome: 'Edson', vinculo: 'terceirizado', empresa: 'Vigilância Prisma', telefone: '(11) 96630-4262', postos: ['portaria'] },
  { id: 'rita', nome: 'Rita', vinculo: 'terceirizado', empresa: 'Vigilância Prisma', telefone: '(11) 95540-5373', postos: ['portaria'] },
  { id: 'claudia', nome: 'Cláudia', vinculo: 'clt', empresa: null, telefone: '(11) 94450-6484', postos: ['guarita'] },
  { id: 'bruno', nome: 'Bruno', vinculo: 'clt', empresa: null, telefone: '(11) 93360-7595', postos: ['guarita', 'portaria'] },
  { id: 'paulo', nome: 'Paulo', vinculo: 'folguista', empresa: null, telefone: '(11) 92270-8606', postos: ['portaria', 'guarita'] },
];
export const EMPRESAS = { 'Vigilância Prisma': { contato: 'Central Prisma', telefone: '(11) 4433-9000' } };
export const NOMES_VINCULO = { clt: 'CLT do condomínio', terceirizado: 'Terceirizado', folguista: 'Folguista' };
export const MODELOS = { '12x36': { nome: '12x36', horas: 12, ciclo: 2 }, '6x1': { nome: '6x1 (8 h)', horas: 8, ciclo: 7 }, noturno: { nome: 'Noturno 12x36', horas: 12, ciclo: 2 } };
export const FERIADOS = { '01-01': 'Confraternização universal', '04-08': 'Aniversário de Santo André', '04-21': 'Tiradentes', '05-01': 'Dia do Trabalho', '09-07': 'Independência', '10-12': 'Nossa Senhora Aparecida', '11-02': 'Finados', '11-15': 'Proclamação da República', '11-20': 'Consciência Negra', '12-25': 'Natal' };
export const NOMES_MOTIVO = { ferias: 'férias', falta: 'falta', atestado: 'atestado' };

export function atribuicoesIniciais(mes) {
  const ancora = `${mes}-01`;
  return [
    { porteiro: 'jose', posto: 'portaria', modelo: '12x36', inicio: 7, ancora, paridade: 0 },
    { porteiro: 'marcos', posto: 'portaria', modelo: '12x36', inicio: 7, ancora, paridade: 1 },
    { porteiro: 'edson', posto: 'portaria', modelo: 'noturno', inicio: 19, ancora, paridade: 0 },
    { porteiro: 'rita', posto: 'portaria', modelo: 'noturno', inicio: 19, ancora, paridade: 1 },
    { porteiro: 'claudia', posto: 'guarita', modelo: '6x1', inicio: 7, folga: 0 },
    { porteiro: 'bruno', posto: 'guarita', modelo: '6x1', inicio: 15, folga: 1 },
  ];
}
```

- [ ] **Step 2: Testes (`src/casos/escala.js`)**

Os testes montam um estado mínimo, sem o seed da Task 2.
```js
import { atribuicoesIniciais } from '../escala/dados.js';
import { gerarTurnos, buracos, feriadosDoMes, sugestoesCobertura, plantaoAgora, descansoInsuficiente, horaLocal, fmtTurno } from '../escala/regras.js';
import { liberado } from '../planos.js';
import { igual, AGORA_FASE2 } from './afirmar.js';

function escalaBase() {
  return { atribuicoes: atribuicoesIniciais('2026-10'), ferias: [{ porteiro: 'rita', de: '2026-10-12', ate: '2026-10-21' }], trocas: [], meses: {}, proximaTroca: 1 };
}

function estadoEscala() {
  const escala = escalaBase();
  escala.meses['2026-10'] = { situacao: 'publicada', publicadaEm: '2026-09-25T18:00', turnos: gerarTurnos(escala, '2026-10') };
  return { plano: 'intermediario', escala };
}

const doDia = (e, dia, posto) => e.escala.meses['2026-10'].turnos.filter((t) => t.inicio.startsWith(dia) && t.posto === posto).map((t) => [t.porteiro, t.inicio.slice(11), t.fim]);

export const CASOS_ESCALA = [
  {
    nome: 'escala: geração de 12x36, noturno e 6x1',
    rodar() {
      const e = estadoEscala();
      igual([horaLocal('2026-10-19', 7), horaLocal('2026-10-19', 31)], ['2026-10-19T07:00', '2026-10-20T07:00']);
      igual(doDia(e, '2026-10-19', 'portaria'), [['jose', '07:00', '2026-10-19T19:00'], ['edson', '19:00', '2026-10-20T07:00']]);
      igual(doDia(e, '2026-10-20', 'portaria'), [['marcos', '07:00', '2026-10-20T19:00'], [null, '19:00', '2026-10-21T07:00']]);
      igual(doDia(e, '2026-10-18', 'guarita'), [['bruno', '15:00', '2026-10-18T23:00']].map(() => ['bruno', '15:00', '2026-10-18T23:00']).slice(0, 0).concat([['bruno', '15:00', '2026-10-18T23:00']]).length ? doDia(e, '2026-10-18', 'guarita') : []);
      igual(doDia(e, '2026-10-19', 'guarita'), [['claudia', '07:00', '2026-10-19T15:00']]);
      igual(e.escala.meses['2026-10'].turnos.find((t) => t.inicio === '2026-10-20T19:00').motivoDescoberto, 'ferias');
    },
  },
  {
    nome: 'escala: buracos de cobertura e feriados',
    rodar() {
      const e = estadoEscala();
      igual(buracos(e, '2026-10', 'portaria').map((b) => b.inicio), ['2026-10-12T19:00', '2026-10-14T19:00', '2026-10-16T19:00', '2026-10-18T19:00', '2026-10-20T19:00']);
      igual(buracos(e, '2026-10', 'portaria')[0].fim, '2026-10-13T07:00');
      const g = buracos(e, '2026-10', 'guarita');
      igual([g.length, g[0], g[1]], [8, { inicio: '2026-10-04T07:00', fim: '2026-10-04T15:00' }, { inicio: '2026-10-05T15:00', fim: '2026-10-05T22:00' }]);
      igual(feriadosDoMes('2026-10'), [{ dia: '2026-10-12', nome: 'Nossa Senhora Aparecida' }]);
      igual(descansoInsuficiente(e, '2026-10'), []);
    },
  },
  {
    nome: 'escala: plantão agora, sugestões e formato do turno',
    rodar() {
      const e = estadoEscala();
      const p = plantaoAgora(e, AGORA_FASE2);
      igual([p.portaria.atual.porteiro, p.portaria.proximo.porteiro, p.portaria.proximo.inicio, p.guarita.atual.porteiro, p.guarita.proximo.inicio], ['jose', 'edson', '2026-10-19T19:00', 'claudia', '2026-10-20T07:00']);
      const s = sugestoesCobertura(e, 'T-2026-10-20-portaria-19');
      igual(s.map((x) => [x.porteiro, x.alerta11]), [['paulo', false], ['bruno', true], ['jose', false]]);
      igual(fmtTurno(e.escala.meses['2026-10'].turnos.find((t) => t.id === 'T-2026-10-20-portaria-19')), '20/10 19h–7h');
      igual([liberado('basico', 'escala'), liberado('intermediario', 'escala'), liberado('intermediario', 'checkin'), liberado('avancado', 'relatorioHoras')], [false, true, false, true]);
    },
  },
];
```
  - **Correção do primeiro caso:** a linha com `doDia(e, '2026-10-18', 'guarita')` ficou confusa. Troque-a por:
    - `igual(doDia(e, '2026-10-18', 'guarita'), [['bruno', '15:00', '2026-10-18T23:00']]);`
    - Num domingo, só o Bruno trabalha, das 15h às 23h (8 h). A guarita fecha às 22h, mas o turno de 8 h do modelo termina às 23h. Isso é aceito.
  - **Sugestões para a noite de 20/10 (Rita de férias):**
    - **candidatos da portaria:** José, Marcos, Bruno e Paulo, sem a Rita. Edson fica de fora porque não trabalha nos dias pares, mas tem turno às 19h do dia 19 até 7h do dia 20 e às 19h do dia 21;
      - **Edson:** sem sobreposição, com descanso de 12 h antes e 12 h depois. Por isso também é candidato com 12 h, e o teste precisa incluí-lo;
      - **Marcos:** trabalha das 7h às 19h do dia 20, com 0 h de descanso. É candidato, com alerta;
      - **José:** dia 21, das 7h às 19h, sobrepõe? A noite vai de 20 às 19h até 21 às 7h, e o José começa às 7h do dia 21: não sobrepõe, com descanso de 0 h e alerta. Antes disso, o José trabalhou de 19 às 7h até 19 às 19h, ou seja, 24 h antes;
      - **Bruno:** no dia 20, terça, trabalha das 15h às 23h, o que sobrepõe a noite das 19h às 23h. Fica fora.
    - **Ordem e asserção corretas:** folguista primeiro (Paulo, ∞), depois pelo maior descanso: Edson (12), Marcos (0, alerta) e José (0, alerta). Corrija a asserção para:
```js
      igual(s.map((x) => [x.porteiro, x.alerta11]), [['paulo', false], ['edson', false], ['marcos', true], ['jose', true]]);
```
  - Quando houver empate de descanso, a ordem é a de `PORTEIROS`.

- [ ] **Step 3: Rodar e ver falhar**

- [ ] **Step 4: Implementar as regras**
```js
// src/escala/regras.js
import { POSTOS, PORTEIROS, MODELOS, FERIADOS, NOMES_MOTIVO } from './dados.js';
import { isoDia, deIso, somarDias, somarMes, diferencaDias, diasDoMes, nomeMes, fmtDataCurta } from '../datas.js';

// Turnos com horas locais "AAAA-MM-DDTHH:MM": comparáveis como texto e sem fuso.
const DESCANSO_MINIMO = 11;
const HORA_MS_ESCALA = 3600000;

function dois(n) {
  return String(n).padStart(2, '0');
}

function modulo(n, m) {
  return ((n % m) + m) % m;
}

export function horaLocal(dia, h) {
  return `${somarDias(dia, Math.floor(h / 24))}T${dois(h % 24)}:00`;
}

export function instanteLocal(agora) {
  return `${isoDia(agora)}T${dois(agora.getHours())}:${dois(agora.getMinutes())}`;
}

export function horasEntreLocal(a, b) {
  return (new Date(b) - new Date(a)) / HORA_MS_ESCALA;
}

export function mesAtual(agora) {
  return isoDia(agora).slice(0, 7);
}

export function porteiroPorId(id) {
  return PORTEIROS.find((p) => p.id === id);
}

function trabalha(a, dia) {
  if (MODELOS[a.modelo].ciclo === 2) return modulo(diferencaDias(dia, a.ancora), 2) === a.paridade;
  return deIso(dia).getDay() !== a.folga;
}

export function deFerias(escala, porteiro, dia) {
  return escala.ferias.some((f) => f.porteiro === porteiro && dia >= f.de && dia <= f.ate);
}

export function gerarTurnos(escala, mes) {
  const turnos = [];
  for (const a of escala.atribuicoes) {
    for (const dia of diasDoMes(mes)) {
      if (!trabalha(a, dia)) continue;
      const ferias = deFerias(escala, a.porteiro, dia);
      turnos.push({ id: `T-${dia}-${a.posto}-${dois(a.inicio)}`, posto: a.posto, porteiro: ferias ? null : a.porteiro, inicio: horaLocal(dia, a.inicio), fim: horaLocal(dia, a.inicio + MODELOS[a.modelo].horas), motivoDescoberto: ferias ? 'ferias' : null, porteiroOriginal: ferias ? a.porteiro : null, anexo: null, trocado: false, checkin: null, checkout: null });
    }
  }
  return turnos.sort((x, y) => x.inicio.localeCompare(y.inicio) || x.posto.localeCompare(y.posto));
}

export function todosTurnos(estado) {
  return Object.values(estado.escala.meses).flatMap((m) => m.turnos);
}

export function acharTurno(estado, id) {
  return todosTurnos(estado).find((t) => t.id === id);
}

export function turnosComVespera(estado, mes) {
  const anterior = somarMes(mes, -1);
  const ultimo = somarDias(`${mes}-01`, -1);
  const guardado = estado.escala.meses[anterior];
  const vespera = (guardado ? guardado.turnos : gerarTurnos(estado.escala, anterior)).filter((t) => t.inicio.startsWith(ultimo));
  return [...vespera, ...(estado.escala.meses[mes] ? estado.escala.meses[mes].turnos : [])];
}

export function buracos(estado, mes, posto) {
  const turnos = turnosComVespera(estado, mes).filter((t) => t.posto === posto && t.porteiro);
  const p = POSTOS[posto];
  const lista = [];
  let aberto = null;
  for (const dia of diasDoMes(mes)) {
    for (let h = 0; h < 24; h++) {
      const hora = horaLocal(dia, h);
      const dentro = h >= p.abre && h < p.fecha;
      if (dentro && !turnos.some((t) => t.inicio <= hora && hora < t.fim)) {
        if (aberto) aberto.fim = horaLocal(dia, h + 1);
        else aberto = { inicio: hora, fim: horaLocal(dia, h + 1) };
      } else if (aberto) {
        lista.push(aberto);
        aberto = null;
      }
    }
  }
  if (aberto) lista.push(aberto);
  return lista;
}

export function feriadosDoMes(mes) {
  return diasDoMes(mes).filter((d) => FERIADOS[d.slice(5)]).map((d) => ({ dia: d, nome: FERIADOS[d.slice(5)] }));
}

function sobrepoe(a, b) {
  return a.inicio < b.fim && b.inicio < a.fim;
}

export function conflita(estado, porteiro, turno) {
  return todosTurnos(estado).some((t) => t.id !== turno.id && t.porteiro === porteiro && sobrepoe(t, turno));
}

export function menorDescanso(estado, porteiro, turno) {
  const outros = todosTurnos(estado).filter((t) => t.id !== turno.id && t.porteiro === porteiro && !sobrepoe(t, turno));
  return outros.reduce((menor, t) => Math.min(menor, t.fim <= turno.inicio ? horasEntreLocal(t.fim, turno.inicio) : horasEntreLocal(turno.fim, t.inicio)), Infinity);
}

export function descansoInsuficiente(estado, mes) {
  const lista = [];
  for (const p of PORTEIROS) {
    const meus = todosTurnos(estado).filter((t) => t.porteiro === p.id).sort((a, b) => a.inicio.localeCompare(b.inicio));
    for (let i = 1; i < meus.length; i++) {
      const horas = horasEntreLocal(meus[i - 1].fim, meus[i].inicio);
      if (horas < DESCANSO_MINIMO && meus[i].inicio.startsWith(mes)) lista.push({ porteiro: p.id, anterior: meus[i - 1].id, proximo: meus[i].id, horas });
    }
  }
  return lista;
}

export function sugestoesCobertura(estado, turnoId) {
  const t = acharTurno(estado, turnoId);
  const folguista = (id) => (porteiroPorId(id).vinculo === 'folguista' ? 1 : 0);
  return PORTEIROS
    .filter((p) => p.postos.includes(t.posto) && p.id !== t.porteiroOriginal && !deFerias(estado.escala, p.id, t.inicio.slice(0, 10)) && !conflita(estado, p.id, t))
    .map((p) => {
      const descanso = menorDescanso(estado, p.id, t);
      return { porteiro: p.id, descanso, alerta11: descanso < DESCANSO_MINIMO };
    })
    .sort((a, b) => folguista(b.porteiro) - folguista(a.porteiro) || b.descanso - a.descanso);
}

export function plantaoAgora(estado, agora) {
  const atual = instanteLocal(agora);
  const turnos = [...turnosComVespera(estado, mesAtual(agora)), ...(estado.escala.meses[somarMes(mesAtual(agora), 1)] ? estado.escala.meses[somarMes(mesAtual(agora), 1)].turnos : [])];
  return Object.fromEntries(Object.keys(POSTOS).map((posto) => {
    const doPosto = turnos.filter((t) => t.posto === posto).sort((a, b) => a.inicio.localeCompare(b.inicio));
    return [posto, { atual: doPosto.find((t) => t.inicio <= atual && atual < t.fim) || null, proximo: doPosto.find((t) => t.inicio > atual) || null }];
  }));
}

export function turnosDoPorteiro(estado, porteiro, agora) {
  const atual = instanteLocal(agora);
  return todosTurnos(estado).filter((t) => t.porteiro === porteiro && t.fim > atual).sort((a, b) => a.inicio.localeCompare(b.inicio));
}

export function fmtTurno(t) {
  return `${fmtDataCurta(t.inicio.slice(0, 10)).slice(0, 5)} ${Number(t.inicio.slice(11, 13))}h–${Number(t.fim.slice(11, 13))}h`;
}

export function relatorioHoras(estado, mes) {
  const doMes = estado.escala.meses[mes] ? estado.escala.meses[mes].turnos : [];
  const horas = (t) => horasEntreLocal(t.inicio, t.fim);
  return PORTEIROS.map((p) => {
    const meus = doMes.filter((t) => t.porteiro === p.id);
    return {
      porteiro: p.id,
      escaladas: meus.reduce((s, t) => s + horas(t), 0),
      comCheckin: meus.filter((t) => t.checkin && t.checkout).reduce((s, t) => s + horas(t), 0),
      atrasos: meus.filter((t) => t.checkin && t.checkin.atrasoMin > 0).length,
      faltas: doMes.filter((t) => t.porteiroOriginal === p.id && ['falta', 'atestado'].includes(t.motivoDescoberto)).length,
      trocas: estado.escala.trocas.filter((x) => x.situacao === 'aprovada' && x.turno.startsWith(`T-${mes}`) && (x.de === p.id || x.para === p.id)).length,
    };
  });
}

function nomeDoMes(mes) {
  return nomeMes(mes).split(' de ')[0];
}

export function alertasEscala(estado, agora) {
  const itens = [];
  const proximo = somarMes(mesAtual(agora), 1);
  const m = estado.escala.meses[proximo];
  if (!m) itens.push({ chave: 'esc-gerar', texto: `Gerar a escala de ${nomeDoMes(proximo)}`, href: '#sindico.escala' });
  else if (m.situacao === 'rascunho') itens.push({ chave: 'esc-publicar', texto: `Escala de ${nomeDoMes(proximo)} em rascunho: publicar`, href: '#sindico.escala' });
  for (const x of estado.escala.trocas.filter((t) => t.situacao === 'aceita')) {
    itens.push({ chave: `troca-${x.id}`, texto: `Troca aguardando aprovação: ${porteiroPorId(x.de).nome} → ${porteiroPorId(x.para).nome}, ${fmtTurno(acharTurno(estado, x.turno)).split('–')[0]}`, href: '#sindico.escala.pendencias' });
  }
  const atual = instanteLocal(agora);
  const limite = instanteLocal(new Date(agora.getTime() + 7 * 24 * HORA_MS_ESCALA));
  for (const t of todosTurnos(estado).filter((x) => !x.porteiro && x.fim > atual && x.inicio < limite).sort((a, b) => a.inicio.localeCompare(b.inicio))) {
    itens.push({ chave: `desc-${t.id}`, texto: `Turno descoberto: ${POSTOS[t.posto].nome} ${fmtTurno(t)} · ${NOMES_MOTIVO[t.motivoDescoberto] || 'sem porteiro'}${t.porteiroOriginal ? ` de ${porteiroPorId(t.porteiroOriginal).nome}` : ''}`, href: '#sindico.escala.pendencias' });
  }
  return itens;
}
```
  - **`src/planos.js`:** acrescente `escala: 'intermediario', checkin: 'avancado', relatorioHoras: 'avancado',`.

- [ ] **Step 5: Rodar e ver passar**, corrigindo só as asserções que a revisão do Step 2 já apontou.
- [ ] **Step 6: Commit** `feat(escala): dados, geração dos turnos, buracos, descanso e sugestões`

---

### Task 2: Ações da escala e seed

**Files:**
- Create: `src/escala/acoes.js`
- Modify: `src/dados.js` (aplica `comEscalaInicial`, versão 6), `src/armazenamento.js`, `src/casos/escala.js`, testes antigos que verificam a versão (`src/casos/dados.js` e `src/casos/notificacoes.js`)

**Interfaces (Produces):** `gerarEscala`, `publicarEscala`, `ajustarTurno`, `proporTroca`, `aceitarTroca`, `recusarTroca`, `aprovarTroca`, `registrarFalta`, `atribuirCobertura`, `fazerCheckin`, `fazerCheckout` e `comEscalaInicial(estado, agora)`.

- [ ] **Step 1: Testes** (acrescente ao `CASOS_ESCALA`; os imports de acoes vão numa linha, e mais `import { dadosIniciais } from '../dados.js';`)
```js
  {
    nome: 'escala: seed com publicação, check-ins, atestado e troca',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const m = e.escala.meses['2026-10'];
      igual([m.situacao, e.versao, e.escala.meses['2026-11']], ['publicada', 6, undefined]);
      const at = m.turnos.find((t) => t.id === 'T-2026-10-20-guarita-07');
      igual([at.porteiro, at.motivoDescoberto, at.porteiroOriginal, at.anexo], [null, 'atestado', 'claudia', 'atestado-claudia.pdf']);
      igual(e.escala.trocas, [{ id: 'TR-001', turno: 'T-2026-10-22-portaria-07', de: 'marcos', para: 'paulo', situacao: 'aceita', criadaEm: e.escala.trocas[0].criadaEm }]);
      igual(m.turnos.find((t) => t.id === 'T-2026-10-02-portaria-07').checkin.atrasoMin, 15);
      igual(m.turnos.find((t) => t.id === 'T-2026-10-19-portaria-07').checkin, null);
      igual(buracos(e, '2026-10', 'guarita').length, 9);
      igual(alertasEscala(e, AGORA_FASE2).map((a) => a.texto), [
        'Gerar a escala de novembro',
        'Troca aguardando aprovação: Marcos → Paulo, 22/10 7h',
        'Turno descoberto: Guarita da garagem 20/10 7h–15h · atestado de Cláudia',
        'Turno descoberto: Portaria principal 20/10 19h–7h · férias de Rita',
      ]);
      const h = relatorioHoras(e, '2026-10');
      igual(h.find((x) => x.porteiro === 'jose'), { porteiro: 'jose', escaladas: 192, comCheckin: 108, atrasos: 0, faltas: 0, trocas: 0 });
      igual([h.find((x) => x.porteiro === 'marcos').atrasos, h.find((x) => x.porteiro === 'claudia').faltas, h.find((x) => x.porteiro === 'claudia').escaladas], [1, 1, 208]);
    },
  },
  {
    nome: 'escala: troca em três passos',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      igual(proporTroca(e, { turnoId: '', de: 'marcos', para: 'paulo' }, 'portaria', AGORA_FASE2).erro, 'Escolha o turno e o colega');
      igual(proporTroca(e, { turnoId: 'T-2026-10-24-portaria-07', de: 'jose', para: 'paulo' }, 'portaria', AGORA_FASE2).erro, 'Só o porteiro do turno pode propor a troca');
      igual(proporTroca(e, { turnoId: 'T-2026-10-24-portaria-07', de: 'marcos', para: 'bruno' }, 'portaria', AGORA_FASE2).erro, 'Este colega já tem turno nesse horário');
      const p = proporTroca(e, { turnoId: 'T-2026-10-24-portaria-07', de: 'marcos', para: 'paulo' }, 'portaria', AGORA_FASE2);
      igual([p.id, p.notificacao.para], ['TR-002', 'Paulo']);
      igual(aceitarTroca(p.estado, 'TR-002', 'jose', AGORA_FASE2).erro, 'Só o colega convidado pode aceitar');
      const a = aceitarTroca(p.estado, 'TR-002', 'paulo', AGORA_FASE2);
      igual(aprovarTroca(a.estado, 'TR-002', 'portaria', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      const r = aprovarTroca(a.estado, 'TR-002', 'sindico', AGORA_FASE2);
      const t = r.estado.escala.meses['2026-10'].turnos.find((x) => x.id === 'T-2026-10-24-portaria-07');
      igual([t.porteiro, t.trocado, r.notificacao.para], ['paulo', true, 'Marcos e Paulo']);
      igual(recusarTroca(e, 'TR-001', 'paulo', 'portaria').estado.escala.trocas[0].situacao, 'recusada');
    },
  },
  {
    nome: 'escala: falta, aviso à terceirizada e cobertura com alerta',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      igual(registrarFalta(e, 'T-2026-10-21-portaria-19', { quem: 'edson', motivo: '' }, 'portaria', AGORA_FASE2).erro, 'Escolha o turno e o motivo');
      igual(registrarFalta(e, 'T-2026-10-21-portaria-19', { quem: 'jose', motivo: 'falta' }, 'portaria', AGORA_FASE2).erro, 'Só o porteiro do turno pode registrar a falta');
      const f = registrarFalta(e, 'T-2026-10-21-portaria-19', { quem: 'edson', motivo: 'atestado', anexo: 'atestado-edson.pdf' }, 'portaria', AGORA_FASE2);
      igual([f.notificacao.para, f.notificacao.texto], ['Vigilância Prisma', 'Vigilância Prisma: turno descoberto na Portaria principal 21/10 19h']);
      igual(sugestoesCobertura(f.estado, 'T-2026-10-21-portaria-19')[0].porteiro, 'paulo');
      igual(atribuirCobertura(f.estado, 'T-2026-10-21-portaria-19', 'paulo', 'portaria', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      const c = atribuirCobertura(f.estado, 'T-2026-10-21-portaria-19', 'paulo', 'sindico', AGORA_FASE2);
      const t = c.estado.escala.meses['2026-10'].turnos.find((x) => x.id === 'T-2026-10-21-portaria-19');
      igual([t.porteiro, t.porteiroOriginal, c.alerta], ['paulo', 'edson', undefined]);
      const j = atribuirCobertura(f.estado, 'T-2026-10-21-portaria-19', 'jose', 'sindico', AGORA_FASE2);
      igual(j.alerta, 'Menos de 11 h de descanso para Seu José');
    },
  },
  {
    nome: 'escala: gerar e publicar o mês seguinte',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      igual(publicarEscala(e, '2026-11', 'sindico', AGORA_FASE2).erro, 'Gere a escala antes de publicar');
      igual(gerarEscala(e, '2026-11', 'portaria', AGORA_FASE2).erro, 'Somente o síndico pode fazer isso');
      igual(gerarEscala({ ...e, plano: 'basico' }, '2026-11', 'sindico', AGORA_FASE2).erro, 'Disponível no plano Intermediário');
      const g = gerarEscala(e, '2026-11', 'sindico', AGORA_FASE2);
      igual([g.estado.escala.meses['2026-11'].situacao, gerarEscala(g.estado, '2026-11', 'sindico', AGORA_FASE2).erro], ['rascunho', 'A escala de novembro já foi gerada']);
      igual(alertasEscala(g.estado, AGORA_FASE2)[0].texto, 'Escala de novembro em rascunho: publicar');
      const p = publicarEscala(g.estado, '2026-11', 'sindico', AGORA_FASE2);
      igual([p.estado.escala.meses['2026-11'].situacao, p.notificacao.texto], ['publicada', 'Escala de novembro publicada: 6 porteiros avisados']);
      igual(publicarEscala(p.estado, '2026-11', 'sindico', AGORA_FASE2).erro, 'Escala já publicada');
      igual(feriadosDoMes('2026-11').map((f) => f.dia), ['2026-11-02', '2026-11-15', '2026-11-20']);
    },
  },
  {
    nome: 'escala: check-in e check-out no Avançado',
    rodar() {
      const e = { ...dadosIniciais(AGORA_FASE2), plano: 'avancado' };
      igual(fazerCheckin(dadosIniciais(AGORA_FASE2), 'jose', AGORA_FASE2).erro, 'Disponível no plano Avançado');
      igual(fazerCheckin(e, 'marcos', AGORA_FASE2).erro, 'Não há turno seu agora para fazer check-in');
      igual(fazerCheckout(e, 'jose', AGORA_FASE2).erro, 'Faça o check-in antes do check-out');
      const cedo = fazerCheckin(e, 'jose', new Date(2026, 9, 19, 7, 5));
      igual(cedo.estado.escala.meses['2026-10'].turnos.find((t) => t.id === 'T-2026-10-19-portaria-07').checkin, { em: '2026-10-19T07:05', atrasoMin: 0 });
      const tarde = fazerCheckin(e, 'jose', new Date(2026, 9, 19, 7, 18));
      igual(tarde.estado.escala.meses['2026-10'].turnos.find((t) => t.id === 'T-2026-10-19-portaria-07').checkin.atrasoMin, 18);
      const saida = fazerCheckout(tarde.estado, 'jose', new Date(2026, 9, 19, 19, 2));
      igual(saida.estado.escala.meses['2026-10'].turnos.find((t) => t.id === 'T-2026-10-19-portaria-07').checkout, { em: '2026-10-19T19:02' });
    },
  },
```
  - **Contas do seed em 19/10 às 10h:**
    - José: dias ímpares de 1 a 31, 16 turnos × 12 h = 192 h; com check-in, os dias 1 a 17, 9 turnos = 108 h;
    - Cláudia: 31 dias − 4 domingos = 27, menos o atestado do dia 20 = 26 turnos × 8 h = 208 h.
  - **Troca do teste:** o turno do Marcos em 24/10 (par); o Bruno trabalha na guarita das 15h às 23h no dia 24, um sábado, e isso sobrepõe o turno das 7h às 19h. Daí o erro de sobreposição.
  - **Cobertura do dia 21 às 19h:**
    - José trabalha das 7h às 19h do dia 21, com 0 h de descanso. Daí o alerta;
    - Paulo não tem outros turnos, então não há alerta.
  - **Novembro:** 6 porteiros com turno, porque o Paulo não tem atribuição.

- [ ] **Step 2: Rodar e ver falhar**

- [ ] **Step 3: Implementar `src/escala/acoes.js`**
```js
import { liberado } from '../planos.js';
import { somarDias, somarMes, isoDia, nomeMes } from '../datas.js';
import { POSTOS, EMPRESAS, atribuicoesIniciais } from './dados.js';
import { gerarTurnos, acharTurno, conflita, menorDescanso, porteiroPorId, instanteLocal, horaLocal, mesAtual, fmtTurno } from './regras.js';

// Ações da escala: o síndico gera, publica, aprova e atribui; o porteiro propõe, aceita, registra falta e faz check-in.
const SO_SINDICO_ESC = 'Somente o síndico pode fazer isso';

function erroEsc(estado, mensagem) {
  return { estado, erro: mensagem };
}

function guardaEsc(estado, perfil, soSindico) {
  if (soSindico && perfil !== 'sindico') return SO_SINDICO_ESC;
  if (!liberado(estado.plano, 'escala')) return 'Disponível no plano Intermediário';
  return null;
}

function nomeMesEsc(mes) {
  return nomeMes(mes).split(' de ')[0];
}

function comEscala(estado, mudanca) {
  return { ...estado, escala: { ...estado.escala, ...mudanca } };
}

function mudarTurno(estado, id, mudanca) {
  const mes = id.slice(2, 9);
  const m = estado.escala.meses[mes];
  return comEscala(estado, { meses: { ...estado.escala.meses, [mes]: { ...m, turnos: m.turnos.map((t) => (t.id === id ? { ...t, ...mudanca } : t)) } } });
}

function alertaDescanso(estado, porteiro, turno) {
  return menorDescanso(estado, porteiro, turno) < 11 ? `Menos de 11 h de descanso para ${porteiroPorId(porteiro).nome}` : undefined;
}

function avisoAfetados(estado, turno, nomes) {
  const m = estado.escala.meses[turno.id.slice(2, 9)];
  return m.situacao === 'publicada' ? { canal: 'App', para: nomes.join(' e '), texto: `Escala alterada: ${POSTOS[turno.posto].nome} ${fmtTurno(turno)}` } : undefined;
}

export function gerarEscala(estado, mes, perfil) {
  const falha = guardaEsc(estado, perfil, true);
  if (falha) return erroEsc(estado, falha);
  if (estado.escala.meses[mes]) return erroEsc(estado, `A escala de ${nomeMesEsc(mes)} já foi gerada`);
  return { estado: comEscala(estado, { meses: { ...estado.escala.meses, [mes]: { situacao: 'rascunho', publicadaEm: null, turnos: gerarTurnos(estado.escala, mes) } } }) };
}

export function publicarEscala(estado, mes, perfil, agora) {
  const falha = guardaEsc(estado, perfil, true);
  if (falha) return erroEsc(estado, falha);
  const m = estado.escala.meses[mes];
  if (!m) return erroEsc(estado, 'Gere a escala antes de publicar');
  if (m.situacao === 'publicada') return erroEsc(estado, 'Escala já publicada');
  const avisados = new Set(m.turnos.filter((t) => t.porteiro).map((t) => t.porteiro)).size;
  return {
    estado: comEscala(estado, { meses: { ...estado.escala.meses, [mes]: { ...m, situacao: 'publicada', publicadaEm: instanteLocal(agora) } } }),
    notificacao: { canal: 'App', para: 'Porteiros', texto: `Escala de ${nomeMesEsc(mes)} publicada: ${avisados} porteiros avisados` },
  };
}

export function ajustarTurno(estado, turnoId, porteiro, perfil) {
  const falha = guardaEsc(estado, perfil, true);
  if (falha) return erroEsc(estado, falha);
  const t = acharTurno(estado, turnoId);
  if (!t) return erroEsc(estado, 'Turno não encontrado');
  if (porteiro && conflita(estado, porteiro, t)) return erroEsc(estado, 'Este colega já tem turno nesse horário');
  const novo = mudarTurno(estado, turnoId, porteiro ? { porteiro } : { porteiro: null, motivoDescoberto: t.motivoDescoberto || 'falta', porteiroOriginal: t.porteiroOriginal || t.porteiro });
  const nomes = [t.porteiro, porteiro].filter(Boolean).map((id) => porteiroPorId(id).nome);
  return { estado: novo, alerta: porteiro ? alertaDescanso(estado, porteiro, t) : undefined, notificacao: avisoAfetados(estado, t, nomes) };
}

export function proporTroca(estado, { turnoId, de, para }, perfil, agora) {
  const falha = guardaEsc(estado, perfil, false);
  if (falha) return erroEsc(estado, falha);
  const t = turnoId ? acharTurno(estado, turnoId) : null;
  if (!t || !para) return erroEsc(estado, 'Escolha o turno e o colega');
  if (t.porteiro !== de) return erroEsc(estado, 'Só o porteiro do turno pode propor a troca');
  if (conflita(estado, para, t)) return erroEsc(estado, 'Este colega já tem turno nesse horário');
  const id = `TR-${String(estado.escala.proximaTroca).padStart(3, '0')}`;
  return {
    estado: comEscala(estado, { trocas: [...estado.escala.trocas, { id, turno: t.id, de, para, situacao: 'proposta', criadaEm: instanteLocal(agora) }], proximaTroca: estado.escala.proximaTroca + 1 }),
    id,
    notificacao: { canal: 'App', para: porteiroPorId(para).nome, texto: `${porteiroPorId(de).nome} propôs trocar o turno de ${fmtTurno(t)}` },
  };
}

function mudarTroca(estado, id, mudanca) {
  return comEscala(estado, { trocas: estado.escala.trocas.map((x) => (x.id === id ? { ...x, ...mudanca } : x)) });
}

export function aceitarTroca(estado, id, quem) {
  const x = estado.escala.trocas.find((t) => t.id === id);
  if (!x || x.situacao !== 'proposta') return erroEsc(estado, 'Esta troca não está aguardando o colega');
  if (x.para !== quem) return erroEsc(estado, 'Só o colega convidado pode aceitar');
  return { estado: mudarTroca(estado, id, { situacao: 'aceita' }), notificacao: { canal: 'App', para: 'Síndico', texto: `Troca ${id} aceita: aguardando sua aprovação` } };
}

export function recusarTroca(estado, id, quem, perfil) {
  const x = estado.escala.trocas.find((t) => t.id === id);
  if (!x || !['proposta', 'aceita'].includes(x.situacao)) return erroEsc(estado, 'Esta troca não pode mais ser recusada');
  if (perfil !== 'sindico' && x.para !== quem) return erroEsc(estado, 'Só o colega convidado pode aceitar');
  return { estado: mudarTroca(estado, id, { situacao: 'recusada' }), notificacao: { canal: 'App', para: porteiroPorId(x.de).nome, texto: `Troca ${id} recusada` } };
}

export function aprovarTroca(estado, id, perfil) {
  const falha = guardaEsc(estado, perfil, true);
  if (falha) return erroEsc(estado, falha);
  const x = estado.escala.trocas.find((t) => t.id === id);
  if (!x || x.situacao !== 'aceita') return erroEsc(estado, 'Esta troca ainda não foi aceita pelo colega');
  const t = acharTurno(estado, x.turno);
  const alerta = alertaDescanso(estado, x.para, t);
  return {
    estado: mudarTurno(mudarTroca(estado, id, { situacao: 'aprovada' }), t.id, { porteiro: x.para, trocado: true }),
    alerta,
    notificacao: { canal: 'App', para: `${porteiroPorId(x.de).nome} e ${porteiroPorId(x.para).nome}`, texto: `Troca aprovada: ${POSTOS[t.posto].nome} ${fmtTurno(t)} fica com ${porteiroPorId(x.para).nome}` },
  };
}

export function registrarFalta(estado, turnoId, { quem, motivo, anexo = null }, perfil) {
  const falha = guardaEsc(estado, perfil, false);
  if (falha) return erroEsc(estado, falha);
  const t = turnoId ? acharTurno(estado, turnoId) : null;
  if (!t || !['falta', 'atestado'].includes(motivo)) return erroEsc(estado, 'Escolha o turno e o motivo');
  if (perfil !== 'sindico' && t.porteiro !== quem) return erroEsc(estado, 'Só o porteiro do turno pode registrar a falta');
  const p = porteiroPorId(t.porteiro);
  const novo = mudarTurno(estado, t.id, { porteiro: null, motivoDescoberto: motivo, porteiroOriginal: t.porteiro, anexo });
  const quando = `${fmtTurno(t).split('–')[0]}`;
  const notificacao = p.vinculo === 'terceirizado'
    ? { canal: 'WhatsApp', para: p.empresa, texto: `${p.empresa}: turno descoberto na ${POSTOS[t.posto].nome} ${quando}` }
    : { canal: 'App', para: 'Síndico', texto: `Turno descoberto: ${POSTOS[t.posto].nome} ${quando} (${motivo} de ${p.nome})` };
  return { estado: novo, notificacao };
}

export function atribuirCobertura(estado, turnoId, porteiro, perfil) {
  const falha = guardaEsc(estado, perfil, true);
  if (falha) return erroEsc(estado, falha);
  const t = acharTurno(estado, turnoId);
  if (!t || t.porteiro) return erroEsc(estado, 'Este turno não está descoberto');
  if (conflita(estado, porteiro, t)) return erroEsc(estado, 'Este colega já tem turno nesse horário');
  return {
    estado: mudarTurno(estado, t.id, { porteiro }),
    alerta: alertaDescanso(estado, porteiro, t),
    notificacao: { canal: 'App', para: porteiroPorId(porteiro).nome, texto: `Você cobre ${POSTOS[t.posto].nome} ${fmtTurno(t)}` },
  };
}

function turnoAgora(estado, porteiro, agora) {
  const atual = instanteLocal(agora);
  return Object.values(estado.escala.meses).flatMap((m) => m.turnos).find((t) => t.porteiro === porteiro && t.inicio <= atual && atual < t.fim);
}

export function fazerCheckin(estado, porteiro, agora) {
  if (!liberado(estado.plano, 'checkin')) return erroEsc(estado, 'Disponível no plano Avançado');
  const t = turnoAgora(estado, porteiro, agora);
  if (!t || t.checkin) return erroEsc(estado, 'Não há turno seu agora para fazer check-in');
  const minutos = Math.round((new Date(instanteLocal(agora)) - new Date(t.inicio)) / 60000);
  return { estado: mudarTurno(estado, t.id, { checkin: { em: instanteLocal(agora), atrasoMin: minutos > 10 ? minutos : 0 } }) };
}

export function fazerCheckout(estado, porteiro, agora) {
  if (!liberado(estado.plano, 'checkin')) return erroEsc(estado, 'Disponível no plano Avançado');
  const atual = instanteLocal(agora);
  const t = Object.values(estado.escala.meses).flatMap((m) => m.turnos).find((x) => x.porteiro === porteiro && x.checkin && !x.checkout && x.inicio <= atual);
  if (!t) return erroEsc(estado, 'Faça o check-in antes do check-out');
  return { estado: mudarTurno(estado, t.id, { checkout: { em: atual } }) };
}

// Seed: mês atual publicado no dia 25 do mês anterior, check-in nos turnos encerrados, atestado de amanhã e uma troca aceita.
export function comEscalaInicial(estado, agora) {
  const mes = mesAtual(agora);
  const escala = { atribuicoes: atribuicoesIniciais(mes), ferias: [{ porteiro: 'rita', de: `${mes}-12`, ate: `${mes}-21` }], trocas: [], meses: {}, proximaTroca: 1 };
  const atual = instanteLocal(agora);
  const atrasos = { [`T-${mes}-02-portaria-07`]: 15, [`T-${mes}-03-portaria-19`]: 22 };
  const turnos = gerarTurnos(escala, mes).map((t) => {
    if (!t.porteiro || t.fim > atual) return t;
    const atraso = atrasos[t.id] || 0;
    const em = new Date(new Date(t.inicio).getTime() + atraso * 60000);
    return { ...t, checkin: { em: instanteLocal(em), atrasoMin: atraso }, checkout: { em: t.fim } };
  });
  let e = { ...estado, escala: { ...escala, meses: { [mes]: { situacao: 'publicada', publicadaEm: `${somarMes(mes, -1)}-25T18:00`, turnos } } } };
  const amanha = somarDias(isoDia(agora), 1);
  const atestado = turnos.find((t) => t.id === `T-${amanha}-guarita-07` && t.porteiro === 'claudia');
  if (atestado) e = mudarTurno(e, atestado.id, { porteiro: null, motivoDescoberto: 'atestado', porteiroOriginal: 'claudia', anexo: 'atestado-claudia.pdf' });
  const daTroca = turnos.find((t) => t.porteiro === 'marcos' && t.inicio > horaLocal(somarDias(isoDia(agora), 2), 23));
  if (daTroca) e = comEscala(e, { trocas: [{ id: 'TR-001', turno: daTroca.id, de: 'marcos', para: 'paulo', situacao: 'aceita', criadaEm: instanteLocal(new Date(agora.getTime() - 20 * 3600000)) }], proximaTroca: 2 });
  return e;
}
```
  - Observação: `EMPRESAS` fica importado só para a tela da equipe. Se não for usado aqui, tire-o deste import.
  - **`src/dados.js`:**
    - `import { comEscalaInicial } from './escala/acoes.js';`;
    - `return comEscalaInicial(comAcordoInicial({ ... }), agora);`;
    - `versao: 6`.
  - **`src/armazenamento.js`:** `estado.versao === 6`.
  - **Testes que verificam a versão:**
    - `src/casos/dados.js`: o `[5, 'Ana Souza']` passa a `[6, ...]`;
    - `src/casos/notificacoes.js`: o `[44, 5]` passa a `[44, 6]`.

- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** `feat(escala): ações de troca, falta, cobertura, publicação e check-in, com seed`

---

### Task 3: UI do síndico, menu Escala e Início

**Files:** Create `src/ui/escala-sindico.js`; Modify `src/ui/sindico.js` (MENU, EM_BREVE, TelaSindico, SInicio com `alertasEscala`), `montagem.mjs`, `verificar.mjs`, `src/estilos.css`

- [ ] **Step 1: Checagens**
```js
  ['#sindico.escala', ['Escala', 'Portaria principal', 'sem ninguém', 'Gerar escala de novembro', 'Nossa Senhora Aparecida', 'buracos de cobertura']],
  ['#sindico.escala.pendencias', ['Marcos → Paulo', 'Aprovar', 'Atribuir', 'Paulo', 'atestado']],
  ['#sindico.escala.equipe', ['Vigilância Prisma', 'Folguista', 'Guarita da garagem']],
  ['#sindico.escala.horas', ['Disponível no plano Avançado']],
  ['#sindico.inicio', ['Gerar a escala de novembro', 'Troca aguardando aprovação: Marcos → Paulo', 'Turno descoberto: Guarita da garagem']],
```

- [ ] **Step 2: Implementar `SEscala(props)`**
  - **Bloqueio:** sem `escala`, mostra o `Bloqueado` com o título "Escala de porteiros com trocas, faltas e cobertura".
  - **Abas** (chips, como na Cobrança): `[['calendario','Calendário'],['pendencias','Pendências'],['equipe','Equipe'],['horas','Horas']]`.
  - **Calendário:**
    - **Estado do componente:** `mes` (padrão: atual) e `posto` (padrão: 'portaria').
    - **Selects:**
      - "Mês": `id="escala-mes"`, com as opções atual e seguinte (via `nomeMes`);
      - "Posto": `id="escala-posto"`.
    - **Mês sem escala:** se `meses[mes]` não existe, aparece o botão "Gerar escala de ${nome}" (`data-acao="gerar-escala"`), que chama `gerarEscala`.
    - **Resumo:** `${buracos.length} buracos de cobertura · ${descansoInsuficiente.length} alertas de descanso · ${publicada ? 'publicada em dd/mm' : 'rascunho'}`. No rascunho, aparece o botão "Publicar escala" (`data-acao="publicar-escala"`).
    - **Grade:** uma linha por dia do mês (`div.dia-escala`):
      - cabeçalho com `fmtDia(dia)`, mais `Etiqueta info` com o nome do feriado e `Etiqueta` "hoje";
      - os turnos do posto daquele dia, em `span.turno-escala` (nome ou "Descoberto · motivo", horário e etiqueta "troca" se `trocado`);
      - para cada buraco que começa naquele dia, `span.buraco-escala` "${h}h–${h}h sem ninguém";
      - cada turno tem o botão "Trocar porteiro", que abre um select (`data-turno=id`) com os porteiros do posto e a opção "Ninguém (descoberto)", e chama `ajustarTurno`. O alerta aparece em `Sucesso`/`Erro`.
  - **Pendências:**
    - **Trocas `aceita`:** "De → Para · posto turno", com os botões Aprovar (`data-aprovar=id`) e Recusar.
    - **Turnos descobertos futuros:** com nome, motivo e anexo. As sugestões (`sugestoesCobertura`) aparecem em lista com nome, vínculo, descanso ("livre" se Infinity, "N h de descanso", "⚠ menos de 11 h") e o botão "Atribuir" (`data-atribuir=${turno.id}-${porteiro}`).
    - **Avisos:** o alerta devolvido pela ação aparece como `p.erro`.
  - **Equipe:** tabela de postos (horário) e tabela de porteiros (nome, vínculo, empresa, telefone, postos e férias).
  - **Horas:** sem `relatorioHoras`, `Bloqueado`. Com ele, tabela com Porteiro, Escaladas, Com check-in, Atrasos, Faltas e Trocas.
  - **sindico.js:**
    - `MENU_SINDICO`: depois de `manutencao`, `['escala', 'Escala', 'calendario']`;
    - `EM_BREVE`: `[['Estoque, checklist e rondas', 'Avançado']]`;
    - TelaSindico mapeia `escala: SEscala`;
    - em SInicio, `pendOperacao` inclui `alertasEscala(estado, agora)` quando `liberado(plano, 'escala')`.
  - **CSS:**
    - `.dia-escala` (flex-wrap, gap, borda inferior);
    - `.turno-escala` (pílula com fundo `--sup-2`);
    - `.buraco-escala` (fundo `--perigo-bg`, cor `--perigo`, peso 600).

- [ ] **Step 3: Rodar** os testes e o verificar.
- [ ] **Step 4: Commit** `feat(escala): menu Escala do síndico com calendário, pendências, equipe e horas`

---

### Task 4: Aba Escala da portaria

**Files:** Create `src/ui/escala-portaria.js`; Modify `src/ui/portaria.js` (ABAS e mapa), `montagem.mjs`, `verificar.mjs`

- [ ] **Step 1: Checagens**
```js
  ['#portaria.escala', ['De plantão agora', 'Portaria principal', 'Guarita da garagem', 'Próximo', 'Meus plantões', 'Seu José']],
```

- [ ] **Step 2: Implementar `PEscala(props)`**
  - **Bloqueio:** sem `escala`, mostra o `Bloqueado`.
  - **"De plantão agora":**
    - para cada posto, um `div.cartao` com o nome do posto, o porteiro atual (ou "Descoberto") com horário e `Próximo: ${nome} às ${h}h`;
    - com `checkin` liberado e porteiro atual: botão "Fazer check-in" (`data-acao="checkin-${posto}"`) se não houver check-in; senão, o texto "Check-in às 7h18 · 18 min de atraso" e o botão "Fazer check-out";
    - a foto é simulada: o clique já registra.
  - **Seletor:** `div.cel-pessoa` com os 7 porteiros, estado local e padrão 'jose'.
  - **Meus plantões:** `turnosDoPorteiro`, os 8 próximos.
    - Cada item mostra `fmtTurno`, o posto, `Etiqueta` de feriado e os botões "Propor troca" e "Registrar falta".
    - **Propor troca:** abre o select "Colega" (`id="troca-colega"`), com os porteiros do mesmo posto exceto o próprio, e o botão "Enviar proposta de troca" (`proporTroca`, perfil 'portaria').
    - **Registrar falta:** abre o select "Motivo" (`id="falta-motivo"`, com falta e atestado), o botão "Anexar atestado" (anexo `atestado-${id}.pdf`) e o botão "Registrar" (`registrarFalta`).
  - **Trocas recebidas:** as trocas `proposta` com `para === selecionado`, com Aceitar e Recusar.
  - **portaria.js:**
    - `ABAS_PORTARIA` ganha `['escala', 'Escala', 'pessoa']`;
    - o mapa ganha `escala: PEscala`.

- [ ] **Step 3: Rodar** os testes e o verificar.
- [ ] **Step 4: Commit** `feat(escala): aba Escala da portaria com plantão, trocas, faltas e check-in`

---

### Task 5: e2e, largura e publicação

- [ ] **Step 1: Roteiros** (depois de `planosManutencao` e antes de `larguraCelular`)
```js
  async escalaTroca() {
    await clicar('Reiniciar demonstração');
    await irPara('#portaria.escala');
    await clicar('Marcos');
    await esperarTexto('Meus plantões');
    await clicar('Propor troca');
    await preencher('Colega', 'paulo');
    await clicar('Enviar proposta de troca');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Paulo')`, 'o aviso ao Paulo');
    await clicar('Paulo');
    await clicar('Aceitar');
    await irPara('#sindico.escala.pendencias');
    await clicarSeletor('[data-aprovar="TR-002"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Troca aprovada')`, 'a troca aprovada');
  },

  async escalaFalta() {
    await irPara('#portaria.escala');
    await clicar('Edson');
    await clicar('Registrar falta');
    await preencher('Motivo', 'atestado');
    await clicar('Anexar atestado');
    await clicar('Registrar');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Vigilância Prisma')`, 'o aviso à terceirizada');
    await irPara('#sindico.escala.pendencias');
    await esperarTexto('atestado de Edson');
    await clicarSeletor('[data-atribuir$="-paulo"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Você cobre')`, 'a cobertura atribuída');
  },

  async escalaPublicar() {
    await irPara('#sindico.escala');
    await clicarSeletor('[data-acao="gerar-escala"]');
    await esperarTexto('rascunho');
    await esperarTexto('sem ninguém');
    await clicarSeletor('[data-acao="publicar-escala"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('porteiros avisados')`, 'a publicação');
  },

  async escalaAvancado() {
    await clicar('Avançado');
    await irPara('#portaria.escala');
    const posto = await js(`document.querySelector('[data-acao^="checkin-"]') ? document.querySelector('[data-acao^="checkin-"]').dataset.acao : ''`);
    if (posto) {
      await clicarSeletor(`[data-acao="${posto}"]`);
      await esperarTexto('Check-in às');
    }
    await irPara('#sindico.escala.horas');
    await esperarTexto('Com check-in');
    await clicar('Básico');
    await irPara('#sindico.escala');
    await esperarTexto('Disponível no plano Intermediário');
    await clicar('Intermediário');
  },
```
  - **Observações:**
    - `clicar('Marcos')` e `clicar('Paulo')` acertam os botões do seletor, porque a busca é por texto exato.
    - Na data real da execução, o próximo turno do Marcos pode cair no mês seguinte, que ainda não existe. A lista vem de `turnosDoPorteiro`, que só lê os meses guardados. Se a lista do Marcos estiver vazia, o roteiro falha. Num mês em que o Marcos ainda tem turnos, que é o caso comum, passa. Para ficar estável, o roteiro usa o primeiro "Propor troca" da lista, porque `clicar` pega o primeiro.
    - O check-in depende de haver alguém de plantão; o roteiro tolera a ausência.
  - **Larguras:** acrescente a `larguraCelular` os hashes `'#sindico.escala'`, `'#sindico.escala.pendencias'`, `'#sindico.escala.equipe'` e `'#portaria.escala'`.

- [ ] **Step 2: Rodar tudo** (testes, verificar e e2e) e fazer a conferência visual por capturas.
- [ ] **Step 3: Commit** do e2e e do `condofacil.html`.
- [ ] **Step 4: Publicar** com `url` https://claude.ai/artifact/U7U8aKxcxM9A1Hbnb9bv9r e label "Fase 2: escala". Depois, merge e push com o ok do usuário.
