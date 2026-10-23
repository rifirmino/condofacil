# Integração real com o Asaas sandbox: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** rodar o ciclo real do Asaas no sandbox dentro do protótipo, publicado em app.condofacil.cloud:
1. subconta criada na implantação;
2. emissão com boleto e Pix reais;
3. pagamento;
4. baixa pelo webhook.

**Arquitetura:**
- **Servidor:** um app Node.js 22 em `servidor/`, que entrega o protótipo e a API `/api`. Os handlers são funções puras de `(pedido, dependências)`; o banco fica atrás de uma interface (MySQL em produção, memória nos testes); o cliente do Asaas tem URL configurável, o que permite um Asaas falso local nos testes.
- **App:** ganha `src/conectado/`. O app detecta o servidor e converte as respostas nas ações puras que já existem. No claude.ai e no `file://`, tudo continua simulado.

**Tecnologia:** Node 22 (`node:http`, `node:crypto`, `node:test`, `fetch`), `mysql2` (só em produção), Preact + htm (como hoje).

**Especificação:** `docs/superpowers/specs/2026-10-23-asaas-sandbox-design.md`

## Restrições globais

- **Ambiente:** só sandbox. O servidor não sobe se `ASAAS_URL` não contiver `sandbox` nem `127.0.0.1`/`localhost`.
- **Segredos:**
  - nunca no repositório, nos testes ou nos logs;
  - os testes usam valores fixos de mentira;
  - os logs não registram CPF, chaves nem o payload do Asaas.
- **Rotas `/api`:** exigem o cabeçalho `x-codigo-piloto`, exceto `GET /api/saude` e `POST /api/webhook/asaas`.
- **Webhook:** confere o cabeçalho `asaas-access-token` com `ASAAS_WEBHOOK_TOKEN`; sem ele, a resposta é 401.
- **Limite:** 60 chamadas por minuto por IP; acima disso, 429.
- **Tempo limite:** 10 s por chamada ao Asaas; depois disso, 502 com a mensagem exata `Não foi possível falar com o Asaas agora. Nada foi emitido; tente de novo`.
- **Valores:** centavos no app e no banco; reais com 2 casas só na chamada ao Asaas.
- **Referência da cobrança:** `<condominioId>:<competencia>:<unidade>`, usada como `externalReference`.
- **Clientes no Asaas:** sempre com `notificationDisabled: true`.
- **Modo conectado no app:** só quando `location.hostname` é `app.condofacil.cloud`, `localhost` ou `127.0.0.1`, `/api/saude` responde ok e o condomínio ativo tem `origem === 'novo'` e `condominio.asaas.real === true`. A demonstração continua simulada sempre.
- **Código do app:** ESM concatenado por `montagem.mjs`. Os nomes de nível superior são únicos entre arquivos, e qualquer arquivo novo de `src/` entra na lista ORDEM.
- **Textos:** pt-BR. Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Tarefa 1: base do servidor e cifra

**Arquivos:**
- Criar: `servidor/package.json`, `servidor/cifra.mjs`, `servidor/testes/cifra.test.mjs`
- Modificar: `.gitignore` (acrescentar `servidor/node_modules/`)

**Interfaces:**
- Produz: `cifrar(texto, chaveBase64) → string` (`iv.tag.dados`, em base64url) e `decifrar(cifrado, chaveBase64) → string`.

- [ ] **Passo 1: package.json**

```json
{
  "name": "condofacil-servidor",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": { "start": "node index.mjs", "test": "node --test testes/", "sandbox": "node sandbox.mjs" },
  "dependencies": { "mysql2": "^3.11.0" }
}
```

- [ ] **Passo 2: teste que falha (`servidor/testes/cifra.test.mjs`)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cifrar, decifrar } from '../cifra.mjs';

const CHAVE = Buffer.alloc(32, 7).toString('base64');

test('cifra e decifra a chave da subconta', () => {
  const c = cifrar('$aact_chave_da_subconta', CHAVE);
  assert.notEqual(c, '$aact_chave_da_subconta');
  assert.equal(decifrar(c, CHAVE), '$aact_chave_da_subconta');
  assert.notEqual(cifrar('x', CHAVE), cifrar('x', CHAVE));
});

test('recusa chave de tamanho errado e texto adulterado', () => {
  assert.throws(() => cifrar('x', Buffer.alloc(16).toString('base64')), /32 bytes/);
  const c = cifrar('segredo', CHAVE);
  assert.throws(() => decifrar(c.slice(0, -2) + 'AA', CHAVE));
});
```

Rodar: `cd servidor && npm test`. Esperado: FALHA (módulo inexistente).

- [ ] **Passo 3: implementação (`servidor/cifra.mjs`)**

```js
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM para guardar a apiKey de cada subconta no banco.
function chaveDe(base64) {
  const chave = Buffer.from(base64 || '', 'base64');
  if (chave.length !== 32) throw new Error('CHAVE_CRIPTO deve ter 32 bytes em base64');
  return chave;
}

export function cifrar(texto, chaveBase64) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', chaveDe(chaveBase64), iv);
  const dados = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), dados].map((b) => b.toString('base64url')).join('.');
}

export function decifrar(cifrado, chaveBase64) {
  const [iv, tag, dados] = String(cifrado).split('.').map((p) => Buffer.from(p, 'base64url'));
  const d = createDecipheriv('aes-256-gcm', chaveDe(chaveBase64), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(dados), d.final()]).toString('utf8');
}
```

- [ ] **Passo 4:** `cd servidor && npm test`. Esperado: 2 aprovados.
- [ ] **Passo 5:** commit `feat(servidor): base do servidor e cifra das chaves das subcontas`.

---

### Tarefa 2: banco (memória e MySQL com a mesma interface)

**Arquivos:**
- Criar: `servidor/banco.mjs`, `servidor/testes/banco.test.mjs`

**Interfaces:**
- Produz: `bancoEmMemoria()` e `bancoMysql(config)`, os dois assíncronos e com os mesmos métodos:
  - `obterCondominio(id)` → `{ id, nome, cnpj, walletId, apiKeyCifrada, situacao }` ou `null`; `salvarCondominio(c)`;
  - `obterCliente(condominioId, unidade, cpf)` → `{ asaasId }` ou `null`; `salvarCliente({ condominioId, unidade, cpf, asaasId })`;
  - `obterCobranca(referencia)`; `salvarCobranca(c)`; `listarCobrancas(condominioId, competencia?)`; `atualizarCobranca(referencia, mudanca)`;
  - `registrarEvento({ id, tipo, asaasPagamento })` → `true` se é novo, `false` se é repetido;
  - `preparar()`, que cria as tabelas no MySQL e não faz nada na memória.
- Formato da cobrança: `{ referencia, condominioId, competencia, unidade, asaasId, valor, vencimento, situacao, pagoEm, forma, faturaUrl, boletoUrl, pixCopiaCola, pixImagem }`.

- [ ] **Passo 1: teste que falha**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoEmMemoria } from '../banco.mjs';

test('banco em memória guarda condomínio, cliente, cobrança e eventos únicos', async () => {
  const b = bancoEmMemoria();
  await b.preparar();
  assert.equal(await b.obterCondominio('c1'), null);
  await b.salvarCondominio({ id: 'c1', nome: 'Teste', cnpj: '123', walletId: 'w1', apiKeyCifrada: 'x', situacao: 'ativa' });
  assert.equal((await b.obterCondominio('c1')).walletId, 'w1');
  await b.salvarCliente({ condominioId: 'c1', unidade: 'A101', cpf: '52998224725', asaasId: 'cus_1' });
  assert.equal((await b.obterCliente('c1', 'A101', '52998224725')).asaasId, 'cus_1');
  const cob = { referencia: 'c1:2026-11:A101', condominioId: 'c1', competencia: '2026-11', unidade: 'A101', asaasId: 'pay_1', valor: 55000, vencimento: '2026-11-10', situacao: 'pendente', pagoEm: null, forma: null, faturaUrl: 'f', boletoUrl: 'b', pixCopiaCola: 'p', pixImagem: 'i' };
  await b.salvarCobranca(cob);
  await b.atualizarCobranca(cob.referencia, { situacao: 'paga', pagoEm: '2026-10-23', forma: 'pix' });
  assert.equal((await b.obterCobranca(cob.referencia)).situacao, 'paga');
  assert.equal((await b.listarCobrancas('c1')).length, 1);
  assert.equal((await b.listarCobrancas('c1', '2026-12')).length, 0);
  assert.equal(await b.registrarEvento({ id: 'evt_1', tipo: 'PAYMENT_RECEIVED', asaasPagamento: 'pay_1' }), true);
  assert.equal(await b.registrarEvento({ id: 'evt_1', tipo: 'PAYMENT_RECEIVED', asaasPagamento: 'pay_1' }), false);
});
```

- [ ] **Passo 2: implementação**

```js
// Dados que o Asaas exige guardar no servidor. A memória serve aos testes; o MySQL, à Hostinger.
export function bancoEmMemoria() {
  const condominios = new Map();
  const clientes = new Map();
  const cobrancas = new Map();
  const eventos = new Set();
  const chaveCliente = (c, u, cpf) => `${c}|${u}|${cpf}`;
  return {
    async preparar() {},
    async obterCondominio(id) { return condominios.get(id) || null; },
    async salvarCondominio(c) { condominios.set(c.id, { ...c }); },
    async obterCliente(c, u, cpf) { return clientes.get(chaveCliente(c, u, cpf)) || null; },
    async salvarCliente(x) { clientes.set(chaveCliente(x.condominioId, x.unidade, x.cpf), { ...x }); },
    async obterCobranca(ref) { return cobrancas.get(ref) || null; },
    async salvarCobranca(c) { cobrancas.set(c.referencia, { ...c }); },
    async listarCobrancas(cond, comp) { return [...cobrancas.values()].filter((c) => c.condominioId === cond && (!comp || c.competencia === comp)); },
    async atualizarCobranca(ref, m) { const c = cobrancas.get(ref); if (c) cobrancas.set(ref, { ...c, ...m }); },
    async registrarEvento(e) { if (eventos.has(e.id)) return false; eventos.add(e.id); return true; },
  };
}

const TABELAS = [
  `CREATE TABLE IF NOT EXISTS condominios (id VARCHAR(80) PRIMARY KEY, nome VARCHAR(160) NOT NULL, cnpj VARCHAR(14), wallet_id VARCHAR(80), api_key_cifrada TEXT, situacao VARCHAR(20), criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS clientes (condominio_id VARCHAR(80) NOT NULL, unidade VARCHAR(20) NOT NULL, cpf VARCHAR(14) NOT NULL, asaas_id VARCHAR(40) NOT NULL, PRIMARY KEY (condominio_id, unidade, cpf))`,
  `CREATE TABLE IF NOT EXISTS cobrancas (referencia VARCHAR(140) PRIMARY KEY, condominio_id VARCHAR(80) NOT NULL, competencia CHAR(7) NOT NULL, unidade VARCHAR(20) NOT NULL, asaas_id VARCHAR(40), valor INT NOT NULL, vencimento DATE NOT NULL, situacao VARCHAR(20) NOT NULL, pago_em VARCHAR(30), forma VARCHAR(20), fatura_url TEXT, boleto_url TEXT, pix_copia_cola TEXT, pix_imagem MEDIUMTEXT, INDEX (condominio_id, competencia))`,
  `CREATE TABLE IF NOT EXISTS eventos (id VARCHAR(80) PRIMARY KEY, tipo VARCHAR(60), asaas_pagamento VARCHAR(40), recebido_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
];
const COLUNAS_COBRANCA = { referencia: 'referencia', condominioId: 'condominio_id', competencia: 'competencia', unidade: 'unidade', asaasId: 'asaas_id', valor: 'valor', vencimento: 'vencimento', situacao: 'situacao', pagoEm: 'pago_em', forma: 'forma', faturaUrl: 'fatura_url', boletoUrl: 'boleto_url', pixCopiaCola: 'pix_copia_cola', pixImagem: 'pix_imagem' };

function cobrancaDaLinha(l) {
  const c = Object.fromEntries(Object.entries(COLUNAS_COBRANCA).map(([k, col]) => [k, l[col]]));
  return { ...c, vencimento: l.vencimento instanceof Date ? l.vencimento.toISOString().slice(0, 10) : l.vencimento };
}

export async function bancoMysql(config) {
  const mysql = (await import('mysql2/promise')).default;
  const pool = mysql.createPool({ ...config, dateStrings: true, connectionLimit: 5 });
  const q = async (sql, p) => (await pool.execute(sql, p))[0];
  return {
    async preparar() { for (const t of TABELAS) await q(t); },
    async obterCondominio(id) {
      const [l] = await q('SELECT * FROM condominios WHERE id = ?', [id]);
      return l ? { id: l.id, nome: l.nome, cnpj: l.cnpj, walletId: l.wallet_id, apiKeyCifrada: l.api_key_cifrada, situacao: l.situacao } : null;
    },
    async salvarCondominio(c) {
      await q('REPLACE INTO condominios (id, nome, cnpj, wallet_id, api_key_cifrada, situacao) VALUES (?, ?, ?, ?, ?, ?)', [c.id, c.nome, c.cnpj, c.walletId, c.apiKeyCifrada, c.situacao]);
    },
    async obterCliente(c, u, cpf) {
      const [l] = await q('SELECT asaas_id FROM clientes WHERE condominio_id = ? AND unidade = ? AND cpf = ?', [c, u, cpf]);
      return l ? { asaasId: l.asaas_id } : null;
    },
    async salvarCliente(x) { await q('REPLACE INTO clientes (condominio_id, unidade, cpf, asaas_id) VALUES (?, ?, ?, ?)', [x.condominioId, x.unidade, x.cpf, x.asaasId]); },
    async obterCobranca(ref) { const [l] = await q('SELECT * FROM cobrancas WHERE referencia = ?', [ref]); return l ? cobrancaDaLinha(l) : null; },
    async salvarCobranca(c) {
      const cols = Object.values(COLUNAS_COBRANCA);
      await q(`REPLACE INTO cobrancas (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, Object.keys(COLUNAS_COBRANCA).map((k) => c[k] ?? null));
    },
    async listarCobrancas(cond, comp) {
      const linhas = comp ? await q('SELECT * FROM cobrancas WHERE condominio_id = ? AND competencia = ?', [cond, comp]) : await q('SELECT * FROM cobrancas WHERE condominio_id = ?', [cond]);
      return linhas.map(cobrancaDaLinha);
    },
    async atualizarCobranca(ref, m) {
      const pares = Object.entries(m).filter(([k]) => COLUNAS_COBRANCA[k]);
      if (pares.length) await q(`UPDATE cobrancas SET ${pares.map(([k]) => `${COLUNAS_COBRANCA[k]} = ?`).join(', ')} WHERE referencia = ?`, [...pares.map(([, v]) => v), ref]);
    },
    async registrarEvento(e) {
      const r = await q('INSERT IGNORE INTO eventos (id, tipo, asaas_pagamento) VALUES (?, ?, ?)', [e.id, e.tipo, e.asaasPagamento]);
      return r.affectedRows === 1;
    },
  };
}
```

- [ ] **Passo 3:** `npm test`. Esperado: tudo aprovado. O MySQL é conferido só na publicação (Tarefa 10).
- [ ] **Passo 4:** commit `feat(servidor): banco em memória e MySQL com a mesma interface`.

---

### Tarefa 3: cliente do Asaas e Asaas falso

**Arquivos:**
- Criar: `servidor/asaas.mjs`, `servidor/testes/asaas-falso.mjs`, `servidor/testes/asaas.test.mjs`

**Interfaces:**
- Produz `clienteAsaas({ url, chave, tempoMs = 10000 })` → `{ get(caminho), post(caminho, corpo) }`. Ele lança `ErroAsaas` com `{ status, mensagem }`: a `mensagem` vem de `errors[0].description`, ou do texto do tempo limite (status 504) ou de rede (status 502).
- Cabeçalhos: `access_token`, `Content-Type: application/json`, `User-Agent: CondoFacil/1.0`.
- Produz `asaasFalso({ urlWebhookPadrao? })` → `{ url, fechar(), contas, pagamentos, falharCpf: Set, tokensWebhook }`. Rotas atendidas:
  - `POST /accounts` → `{ id, apiKey: 'sub_<n>', walletId: 'wal_<n>' }`;
  - `POST /webhooks`, guardando `{ url, authToken }` por apiKey;
  - `GET /customers?cpfCnpj=` → `{ data: [...] }`;
  - `POST /customers` (CPF em `falharCpf` → 400 `{ errors: [{ description: 'O CPF informado é inválido.' }] }`);
  - `POST /payments` → `{ id: 'pay_<n>', status: 'PENDING', invoiceUrl, bankSlipUrl }`;
  - `GET /payments?externalReference=`;
  - `GET /payments/:id/pixQrCode` → `{ encodedImage: 'iVBORw0KGgo=', payload: '00020126...' }`;
  - `POST /payments/:id/receiveInCash`: marca o pagamento como `RECEIVED_IN_CASH` e faz `POST` no webhook da apiKey dona, com `asaas-access-token`, levando `{ id: 'evt_<n>', event: 'PAYMENT_RECEIVED', payment: { id, externalReference, status: 'RECEIVED_IN_CASH', billingType: 'UNDEFINED', paymentDate } }`.
  - Toda rota sem `access_token` válido (a raiz `raiz_teste` ou um `sub_<n>`) → 401.

- [ ] **Passo 1: teste que falha (`servidor/testes/asaas.test.mjs`)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clienteAsaas, ErroAsaas } from '../asaas.mjs';
import { asaasFalso } from './asaas-falso.mjs';

test('cliente fala com o Asaas falso e traduz erros', async () => {
  const f = await asaasFalso();
  try {
    const raiz = clienteAsaas({ url: f.url, chave: 'raiz_teste' });
    const conta = await raiz.post('/accounts', { name: 'Cond', cpfCnpj: '11222333000181' });
    assert.match(conta.apiKey, /^sub_/);
    f.falharCpf.add('00000000000');
    const sub = clienteAsaas({ url: f.url, chave: conta.apiKey });
    await assert.rejects(sub.post('/customers', { name: 'X', cpfCnpj: '00000000000' }), (e) => e instanceof ErroAsaas && e.status === 400 && /CPF/.test(e.mensagem));
    await assert.rejects(clienteAsaas({ url: f.url, chave: 'errada' }).get('/customers'), (e) => e.status === 401);
  } finally { await f.fechar(); }
});

test('tempo limite vira 504 com mensagem padrão', async () => {
  const lento = clienteAsaas({ url: 'http://10.255.255.1', chave: 'x', tempoMs: 50 });
  await assert.rejects(lento.get('/customers'), (e) => e.status === 504);
});
```

- [ ] **Passo 2: `servidor/asaas.mjs`**

```js
// Cliente mínimo da API v3 do Asaas. A URL vem do ambiente (sandbox na Hostinger, Asaas falso nos testes).
export const MSG_ASAAS_FORA = 'Não foi possível falar com o Asaas agora. Nada foi emitido; tente de novo';

export class ErroAsaas extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; this.mensagem = mensagem; }
}

export function clienteAsaas({ url, chave, tempoMs = 10000 }) {
  async function chamar(metodo, caminho, corpo) {
    let resp;
    try {
      resp = await fetch(url + caminho, {
        method: metodo,
        headers: { access_token: chave, 'Content-Type': 'application/json', 'User-Agent': 'CondoFacil/1.0' },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
        signal: AbortSignal.timeout(tempoMs),
      });
    } catch (e) {
      throw new ErroAsaas(e.name === 'TimeoutError' ? 504 : 502, MSG_ASAAS_FORA);
    }
    const texto = await resp.text();
    const dados = texto ? JSON.parse(texto) : {};
    if (!resp.ok) throw new ErroAsaas(resp.status, (dados.errors && dados.errors[0] && dados.errors[0].description) || `Asaas respondeu ${resp.status}`);
    return dados;
  }
  return { get: (c) => chamar('GET', c), post: (c, corpo) => chamar('POST', c, corpo ?? {}) };
}
```

- [ ] **Passo 3: `servidor/testes/asaas-falso.mjs`** com `node:http`, ouvindo em `127.0.0.1:0` e retornando `url = http://127.0.0.1:<porta>`, com as rotas listadas em **Interfaces**. Os ids saem de um contador. `pagamentos` é um `Map(id → pagamento)` que guarda o `apiKey` dono. O `receiveInCash` faz o `fetch` do webhook depois de responder (`setImmediate`).
- [ ] **Passo 4:** `npm test`. Esperado: tudo aprovado.
- [ ] **Passo 5:** commit `feat(servidor): cliente do Asaas e Asaas falso para testes`.

---

### Tarefa 4: rotas da API

**Arquivos:**
- Criar: `servidor/rotas.mjs`, `servidor/testes/rotas.test.mjs`

**Interfaces:**
- Consome: `cifrar`/`decifrar`, a interface do banco, `clienteAsaas`, `ErroAsaas` e `MSG_ASAAS_FORA`.
- Produz `criarRotas({ banco, asaas, config })`:
  - `asaas(chave)` devolve um cliente;
  - `config = { chaveRaiz, tokenWebhook, chaveCripto, codigoPiloto, urlPublica }`;
  - o resultado é `{ tratar(pedido) }`, com `pedido = { metodo, caminho, consulta, cabecalhos, corpo, ip, agora }`, e `tratar` devolve `{ status, corpo }`.
- Rotas:
  - `GET /api/saude` → `{ ok: true, ambiente: 'sandbox' }`.
  - `POST /api/condominios`:
    - corpo `{ id, nome, cnpj, email, celular, cep, endereco, numero, bairro, rendaMensal }`;
    - se o id já existe, devolve `{ walletId, situacao }` sem chamar o Asaas;
    - se não, faz `POST /accounts` com `{ name, email, cpfCnpj: cnpj, companyType: 'ASSOCIATION', mobilePhone, incomeValue: rendaMensal/100, postalCode, address, addressNumber, province }`;
    - depois, com a chave da subconta, faz `POST /webhooks` com `{ name: 'CondoFácil', url: urlPublica + '/api/webhook/asaas', email, enabled: true, interrupted: false, authToken: tokenWebhook, sendType: 'SEQUENTIALLY', events: ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE'] }`;
    - salva a subconta com a chave cifrada e `situacao: 'ativa'` e devolve `{ walletId, situacao: 'ativa' }`.
  - `POST /api/emissoes`:
    - corpo `{ condominio, competencia, linhas: [{ unidade, responsavel: { nome, cpf, email, celular }, valor, vencimento, descricao, multaPct, jurosPct }] }`;
    - condomínio desconhecido → 404 `Condomínio sem subconta no Asaas`;
    - para cada linha, em sequência:
      - monta a referência; se a cobrança já existe no banco, devolve `{ unidade, ok: true, cobranca }`;
      - se não, reaproveita o cliente (banco → `GET /customers?cpfCnpj=` → `POST /customers` com `notificationDisabled: true` e `externalReference: unidade`);
      - faz `GET /payments?externalReference=<ref>`; se não existir, `POST /payments` com `{ customer, billingType: 'UNDEFINED', value: valor/100, dueDate: vencimento, description: descricao, externalReference: ref, fine: { value: multaPct }, interest: { value: jurosPct } }`;
      - `GET /payments/:id/pixQrCode`; se falhar, o Pix fica `null` e a cobrança vale assim mesmo;
      - salva e devolve `{ unidade, ok: true, cobranca }`;
    - um erro do Asaas numa linha → `{ unidade, ok: false, erro: mensagem }`; se todas falharem por 502/504, a rota inteira devolve 502 com `MSG_ASAAS_FORA`.
  - `GET /api/cobrancas?condominio=&competencia=` → `{ cobrancas }`, sem `pixImagem` (vai só na emissão).
  - `POST /api/simular-pagamento` → corpo `{ referencia }`:
    - cobrança inexistente → 404;
    - com a chave da subconta, `POST /payments/:asaasId/receiveInCash` com `{ paymentDate: hoje, value: valor/100 }`;
    - devolve `{ ok: true }`.
  - `POST /api/webhook/asaas`:
    - token errado → 401;
    - `registrarEvento` repetido → 200 `{ ignorado: true }`;
    - com `payment.status` em `RECEIVED`, `CONFIRMED` ou `RECEIVED_IN_CASH`, atualiza a cobrança pela `externalReference` para `{ situacao: 'paga', pagoEm: payment.paymentDate || hoje, forma }` (`PIX` → `pix`, `CREDIT_CARD` → `cartao`, outros → `boleto`);
    - com `OVERDUE`, atualiza para `{ situacao: 'vencida' }`;
    - responde 200 `{ ok: true }`.
  - Erros de regra:
    - código do piloto ausente ou errado → 401 `Código do piloto inválido`;
    - mais de 60 chamadas por minuto por IP → 429 `Muitas chamadas; aguarde um minuto`;
    - rota desconhecida → 404;
    - corpo sem os campos obrigatórios → 400 com a mensagem do campo.

- [ ] **Passo 1: testes que falham.** Montar com `bancoEmMemoria()`, o Asaas falso, `config = { chaveRaiz: 'raiz_teste', tokenWebhook: 'tok', chaveCripto: <32 bytes>, codigoPiloto: 'piloto', urlPublica: <url do servidor de teste ou 'http://127.0.0.1:1'> }`. Casos:
  1. `saude` sem código → 200; `condominios` sem código → 401.
  2. A subconta é criada uma vez: a segunda chamada com o mesmo id não cria outra conta no falso (`f.contas.length === 1`). O banco guarda a chave cifrada, diferente de `sub_1`, e o webhook fica registrado no falso com `authToken: 'tok'`.
  3. Emissão de 3 linhas, uma com o CPF em `falharCpf` → 2 `ok` e 1 com erro `O CPF informado é inválido.`. Repetir a emissão não cria pagamentos novos (`f.pagamentos.size === 2`), e o reenvio da linha que falhou, já sem a falha, cria o terceiro.
  4. Webhook com token errado → 401. Webhook válido → cobrança `paga` com forma `boleto`. O mesmo evento de novo → `ignorado`.
  5. `simular-pagamento` → o falso dispara o webhook; para o teste, `tratar` é chamado diretamente com o corpo que o falso montaria, ou o falso aponta `urlWebhookPadrao` para um servidor HTTP de teste (Tarefa 5).
  6. A 61ª chamada do mesmo IP no mesmo minuto → 429. Com `agora` 61 s depois, volta a 200.
  7. O Asaas fora do ar (`url` inalcançável, `tempoMs` baixo) → `emissoes` devolve 502 com `MSG_ASAAS_FORA`.
- [ ] **Passo 2:** implementar `servidor/rotas.mjs` conforme a interface, com uma função por rota e um mapa `'<METODO> <caminho>' → função`. O limite fica num `Map(ip → { inicio, n })` usando `pedido.agora`.
- [ ] **Passo 3:** `npm test`. Esperado: tudo aprovado.
- [ ] **Passo 4:** commit `feat(servidor): rotas de subconta, emissão, cobranças, simulação e webhook`.

---

### Tarefa 5: servidor HTTP e página publicada

**Arquivos:**
- Criar: `servidor/index.mjs`, `servidor/http.mjs`, `servidor/testes/http.test.mjs`, `servidor/publico/index.html` (gerado)
- Modificar: `prototipo/montar.mjs` (passa a gravar também `../servidor/publico/index.html` com `envolverLocal(pagina)`)

**Interfaces:**
- Produz `criarServidor({ rotas, pagina })` → um `http.Server`:
  - `GET /` e qualquer `GET` que não seja `/api` devolvem a página, com `text/html` e `Cache-Control: no-store`;
  - `/api/*` lê o JSON (até 1 MB; corpo inválido → 400), monta o `pedido` com `ip` vindo de `x-forwarded-for` ou do socket e `agora = new Date()`, e responde JSON;
  - cabeçalhos em toda resposta: `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`.
- `index.mjs`:
  - lê o ambiente e valida (`ASAAS_URL` precisa conter `sandbox`, `127.0.0.1` ou `localhost`; `CHAVE_CRIPTO` com 32 bytes; as obrigatórias presentes). Se algo faltar, sai com a mensagem `Variável <NOME> ausente ou inválida`, sem mostrar valores;
  - usa `bancoMysql` se houver `MYSQL_HOST`, senão `bancoEmMemoria` com o aviso "dados só em memória";
  - chama `preparar()` e escuta em `PORT` (padrão da Hostinger) ou 3000.

- [ ] **Passo 1: teste que falha (`http.test.mjs`).**
  - Sobe o `criarServidor` com as rotas reais, o banco em memória e o Asaas falso, com `urlWebhookPadrao` apontando para o próprio servidor de teste.
  - Confere que `GET /` traz `<html`.
  - Confere que `GET /api/saude` traz `{ ok: true }` e que um JSON inválido dá 400.
  - Percorre o ciclo inteiro por HTTP: `condominios` → `emissoes` → `simular-pagamento` → espera até 2 s o webhook → `GET /api/cobrancas` mostra `paga`.
- [ ] **Passo 2:** implementar `http.mjs` e `index.mjs`.
- [ ] **Passo 3:** alterar `montar.mjs` com `mkdirSync(join(raiz, '../servidor/publico'), { recursive: true })` e gravar `envolverLocal(pagina)` em `../servidor/publico/index.html`.
- [ ] **Passo 4:** `cd prototipo && npm run montar && npm test` e `cd ../servidor && npm test`. Esperado: tudo aprovado.
- [ ] **Passo 5:** commit `feat(servidor): servidor HTTP que entrega o protótipo e a API`.

---

### Tarefa 6: CPF na planilha e no responsável financeiro

**Arquivos:**
- Modificar: `prototipo/src/implantacao/regras.js`, `prototipo/src/implantacao/novo.js`, `prototipo/src/ui/implantacao.js` (texto do modelo), `prototipo/src/casos/implantacao.js`

**Interfaces:**
- Produz:
  - `cpfValido(cpf) → boolean` (dígitos verificadores; rejeita 11 dígitos iguais);
  - `fmtCpf(cpf) → '529.982.247-25'`;
  - `lerCsvMoradores` lê uma 7ª coluna opcional, `cpf`; com CPF informado e inválido, a linha ganha o erro `CPF inválido`, e `dados.cpf` traz os dígitos ou `''`;
  - `MODELO_CSV_MORADORES` com cabeçalho `unidade;nome;email;celular;vinculo;responsavel;cpf` e CPFs de exemplo válidos (`52998224725` e vazio);
  - em `condominioNovo`, `responsavel.cpf = r.cpf || null`. O campo `documento` continua igual, para o modo simulado não mudar.

- [ ] **Passo 1: caso que falha** em `CASOS_IMPLANTACAO`:

```js
  {
    nome: 'implantação: CPF do responsável na planilha',
    rodar() {
      igual([cpfValido('529.982.247-25'), cpfValido('52998224724'), cpfValido('11111111111'), fmtCpf('52998224725')], [true, false, false, '529.982.247-25']);
      const ids = ['A101', 'A102'];
      const l = lerCsvMoradores('A101;Maria;;;titular;sim;529.982.247-25\nA102;João;;;titular;sim;123', ids);
      igual([l.linhas[0].dados.cpf, l.linhas[1].erros], ['52998224725', ['CPF inválido']]);
      const cfg = configTeste();
      const e = condominioNovo({ ...cfg, moradores: [{ ...cfg.moradores[0], cpf: '52998224725' }, cfg.moradores[1]] }, AGORA_IMPLANTACAO);
      igual([e.financeiro.unidades.A101.responsavel.cpf, e.financeiro.unidades.B201.responsavel.cpf], ['52998224725', null]);
    },
  },
```

- [ ] **Passo 2:** implementar, importar `cpfValido` e `fmtCpf` no topo do arquivo de casos e rodar `npm test`. Esperado: tudo aprovado; o e2e de implantação não muda.
- [ ] **Passo 3:** commit `feat(implantacao): CPF do responsável financeiro na planilha`.

---

### Tarefa 7: módulo `src/conectado/` (cliente e ações puras)

**Arquivos:**
- Criar: `prototipo/src/conectado/cliente.js`, `prototipo/src/conectado/acoes.js`, `prototipo/src/casos/conectado.js`
- Modificar: `prototipo/montagem.mjs` (ORDEM: `conectado/acoes.js` depois de `cobranca/acoes.js`, `conectado/cliente.js` antes de `ui/`, `casos/conectado.js` junto dos casos), `prototipo/testes/casos.test.mjs` (`...CASOS_CONECTADO`)

**Interfaces:**
- `cliente.js`:
  - `CONEXAO = { ativa: false, codigo: null }`;
  - `hostPermitido(hostname) → boolean`;
  - `async detectarServidor()` → `true` ou `false` (só tenta com host permitido; tempo limite de 3 s);
  - `lerCodigoPiloto()` e `guardarCodigoPiloto(c)` em `localStorage` (`condofacil-piloto-v1`), com try/catch;
  - `async chamarApi(metodo, caminho, corpo)` → o JSON. Se a resposta não for ok, lança `Error(corpo.erro || MSG)`, com tempo limite de 20 s;
  - `usaAsaasReal(estado) = CONEXAO.ativa && !!CONEXAO.codigo && estado.origem === 'novo' && !!(estado.condominio.asaas && estado.condominio.asaas.real)`.
- `acoes.js` (puro, sem `fetch`):
  - `previaConectada(estado, competencia)`: chama `previaCompetencia` e marca como bloqueada, com o motivo `Sem CPF: não será emitida`, a linha cujo responsável não tem `cpf`.
  - `linhasParaAsaas(estado, competencia)` → as linhas não bloqueadas de `previaConectada`, no formato do corpo de `/api/emissoes`:
    - `valor = total` e `vencimento = previa.vencimento`;
    - `descricao = 'Taxa condominial de <mês> · apto <u>'`;
    - `multaPct` e `jurosPct` vindos de `fin.parametros`;
    - o responsável com `nome`, `cpf`, e o `email` e o `celular` da pessoa responsável em `estado.pessoas`, quando houver.
  - `aplicarEmissao(estado, competencia, resultados, perfil, agora)`:
    - cria as cobranças só para os resultados `ok` que ainda não existem, no mesmo formato de `emitirCompetencia` e com `asaas: { id, referencia, faturaUrl, boletoUrl, pixCopiaCola, pixImagem }`;
    - inclui a competência em `emitidas` se ela ainda não estiver lá;
    - guarda `fin.falhasAsaas[competencia] = [{ unidade, erro }]`, sem as falhas que deram certo agora;
    - registra a auditoria `Emissão no Asaas sandbox`;
    - devolve `{ estado, emitidas, falhas, notificacao }`.
  - `aplicarSituacoes(estado, cobrancasServidor, agora)`: para cada uma com `situacao === 'paga'` cuja cobrança no app (`CB-<competencia>-<unidade>`) está `aberta`, aplica `confirmarPagamentoAsaas(e, id, 'evt-' + asaasId, forma, new Date(pagoEm))`; devolve `{ estado, baixas }`.

- [ ] **Passo 1: casos que falham (`src/casos/conectado.js`)**, usando `condominioNovo(configTeste())` com CPF no A101, `asaas: { real: true }`:
  - `previaConectada`: A101 emitível; B201 com `Sem CPF: não será emitida`; unidade sem responsável continua `Sem responsável financeiro`.
  - `linhasParaAsaas`: 1 linha (A101), com `valor` 55000 e `vencimento` igual ao da prévia.
  - `aplicarEmissao`:
    - com `[{ unidade: 'A101', ok: true, cobranca: {...} }, { unidade: 'B402', ok: false, erro: 'x' }]` → 1 cobrança com `asaas.referencia`, a competência emitida e `falhasAsaas` com B402;
    - aplicar de novo o B402 com `ok` → 2 cobranças e falhas vazias;
    - repetir o A101 não duplica.
  - `aplicarSituacoes` com a A101 paga → cobrança `paga` e saldo maior; aplicar de novo → `baixas: 0`.
  - `hostPermitido`: `'app.condofacil.cloud'` → true, `'localhost'` → true, `'claude.ai'` → false.
- [ ] **Passo 2:** implementar e rodar `npm run montar && npm test`. Esperado: tudo aprovado, inclusive o teste de nomes únicos.
- [ ] **Passo 3:** commit `feat(conectado): cliente da API e ações puras do modo conectado`.

---

### Tarefa 8: telas do modo conectado

**Arquivos:**
- Modificar: `prototipo/src/ui/app.js`, `prototipo/src/ui/implantacao.js` (PassoAsaas e `configDoRascunho`), `prototipo/src/ui/financeiro-sindico.js` (CPrevia), `prototipo/src/ui/financeiro-morador.js` (CartaoCobranca), `prototipo/src/estilos.css`

**Comportamento:**
- **App:**
  - ao montar, chama `detectarServidor()`. Se o servidor responder, `CONEXAO.ativa = true` e o código vem de `lerCodigoPiloto()`;
  - sem código, a barra mostra um campo "Código do piloto" com o botão "Conectar" (id `codigo-piloto`, `data-acao="conectar-piloto"`). Um código errado, detectado por um `GET /api/cobrancas?condominio=teste` com 401, mostra `Código do piloto inválido`;
  - conectado, a barra mostra o selo `Asaas sandbox conectado`.
  - Com `usaAsaasReal(estado)`, um efeito chama `GET /api/cobrancas?condominio=<id>` a cada 15 s e logo ao entrar em `#sindico.cobranca*` ou `#morador.financeiro`, aplicando `aplicarSituacoes` via `executar`. As falhas de rede são ignoradas em silêncio.
- **PassoAsaas, com `CONEXAO.ativa && CONEXAO.codigo`:**
  - campos extras: Número (`impl-numero`) e Bairro (`impl-bairro`);
  - o botão "Criar subconta no Asaas sandbox" (`data-acao="criar-subconta"`) gera `r.idCondominio` (se faltar), chama `POST /api/condominios` com a renda mensal igual à arrecadação prevista e grava `asaas: { ...a, situacao: 'aprovada', real: true, walletId }`;
  - mostra o erro do servidor no `<Erro>`;
  - sem o botão de simular aprovação.
- **`configDoRascunho`:** passa `id: r.idCondominio`, quando existir.
- **CPrevia, com `usaAsaasReal`:**
  - usa `previaConectada`;
  - "Emitir N cobranças" (`data-acao="emitir"`) desabilita durante o envio, chama a API com `linhasParaAsaas` e aplica `aplicarEmissao`;
  - mostra `N cobranças emitidas no Asaas sandbox` e, se houver falhas, a lista `apto X: motivo` com o botão "Reenviar as que falharam" (`data-acao="reenviar-falhas"`), que envia só essas linhas;
  - erro de rede → `<Erro>` com a mensagem do servidor.
- **CartaoCobranca, com `cobranca.asaas`:**
  - Pix: `<img class="pix-real" alt="QR Code Pix" src="data:image/png;base64,...">` quando houver imagem, e o `pixCopiaCola` real;
  - Boleto: o link "Abrir boleto" (`boletoUrl`, `target="_blank" rel="noopener"`);
  - link "Abrir fatura do Asaas" (`faturaUrl`);
  - o botão "Simular confirmação do Asaas" é trocado por "Simular pagamento no sandbox" (`data-acao="simular-sandbox"`), que chama `POST /api/simular-pagamento` e mostra `Pagamento enviado ao sandbox. A baixa chega pelo webhook em alguns segundos.`. A baixa vem pela sincronização.
- Sem conexão, tudo continua idêntico ao de hoje.

- [ ] **Passo 1:** implementar. `npm run montar && npm test && npm run verificar && npm run e2e`. Esperado: tudo aprovado, sem mudança no modo simulado.
- [ ] **Passo 2:** commit `feat(conectado): telas de subconta, emissão, Pix e boleto reais no modo conectado`.

---

### Tarefa 9: e2e do modo conectado e script do sandbox real

**Arquivos:**
- Criar: `prototipo/e2e-conectado.mjs`, `servidor/sandbox.mjs`
- Modificar: `prototipo/package.json` (`"e2e:conectado": "node e2e-conectado.mjs"`)

**Comportamento:**
- **`e2e-conectado.mjs`:**
  - sobe o Asaas falso e o `criarServidor` (rotas reais, banco em memória, página de `servidor/publico/index.html`, `urlPublica` = o próprio servidor), numa porta aleatória;
  - abre o Chrome headless em `http://127.0.0.1:<porta>/#sindico.inicio`, com os mesmos ajudantes do `e2e.mjs` (copiados para dentro);
  - percorre o fluxo:
    1. conecta com o código `piloto`;
    2. faz a implantação com o CPF do A101 na planilha, CNPJ `11.222.333/0001-81`, número e bairro;
    3. cria a subconta, confirmando `Subconta aprovada`;
    4. ativa o condomínio;
    5. na prévia, confere `Sem CPF: não será emitida` e emite;
    6. confere `cobranças emitidas no Asaas sandbox`;
    7. troca para o morador A101 e abre o Financeiro;
    8. clica em Pagar com Pix e confere `img.pix-real`;
    9. clica em Simular pagamento no sandbox e espera até 20 s por `Nenhuma cobrança em aberto`.
- **`servidor/sandbox.mjs`:** script manual que roda contra o sandbox real.
  - Precisa das variáveis `ASAAS_API_KEY` e `ASAAS_URL=https://api-sandbox.asaas.com/v3`, que só existem no computador do Ricardo.
  - Cria a subconta "CondoFácil Teste <data>" com um CNPJ de teste válido, cria o cliente com o CPF 52998224725 e uma cobrança de R$ 10,00 para daqui a 5 dias.
  - Busca o Pix, chama `receiveInCash` e consulta o pagamento até ele ficar `RECEIVED_IN_CASH`.
  - Imprime só os ids e as URLs da fatura, sem nenhuma chave.
  - Se o sandbox recusar `companyType: 'ASSOCIATION'` ou o Pix por falta de chave Pix, imprime o erro, para o ajuste ir à Tarefa 4.
- [ ] **Passo 1:** implementar e rodar `npm run e2e:conectado`. Esperado: `ok    asaasConectado`.
- [ ] **Passo 2:** commit `test(conectado): roteiro ponta a ponta com servidor e Asaas falso; script do sandbox real`.

---

### Tarefa 10: guia de publicação e publicação na Hostinger

**Arquivos:**
- Criar: `docs/asaas/publicacao.md`

**Conteúdo do guia:**
1. Criar a conta em sandbox.asaas.com e gerar a chave (Integrações → Chave da API).
2. Criar o banco MySQL no hPanel (nome, usuário e senha).
3. Adicionar o app Node.js no subdomínio `app.condofacil.cloud`, ligado ao GitHub `rifirmino/condofacil`, branch `master`, pasta `servidor`, Node 22, comando `npm start`.
4. Colar as variáveis da tabela da especificação: `ASAAS_WEBHOOK_TOKEN` e `CHAVE_CRIPTO` são gerados por Claude com `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`; `URL_PUBLICA=https://app.condofacil.cloud`.
5. Conferir `https://app.condofacil.cloud/api/saude` e depois fazer o ciclo completo pelo app.
6. Problemas comuns: 401 no webhook (token), 502 (chave ou URL do Asaas), página antiga (rodar `npm run montar` e enviar).

- [ ] **Passo 1:** escrever o guia; rodar `npm test` nos dois pacotes, `npm run e2e` e `npm run e2e:conectado`; fazer o commit `docs(asaas): guia de publicação na Hostinger`.
- [ ] **Passo 2:** publicar o protótipo no artifact (mesma URL, sem mudança visível no modo simulado). Pedir ao Ricardo a autorização para juntar no master e enviar ao GitHub.
- [ ] **Passo 3:** acompanhar o Ricardo nos passos do hPanel e do sandbox; rodar `npm run sandbox` com ele; ajustar o que o sandbox real recusar.
