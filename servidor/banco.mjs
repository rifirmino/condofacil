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
  'CREATE TABLE IF NOT EXISTS condominios (id VARCHAR(80) PRIMARY KEY, nome VARCHAR(160) NOT NULL, cnpj VARCHAR(14), wallet_id VARCHAR(80), api_key_cifrada TEXT, situacao VARCHAR(20), criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
  'CREATE TABLE IF NOT EXISTS clientes (condominio_id VARCHAR(80) NOT NULL, unidade VARCHAR(20) NOT NULL, cpf VARCHAR(14) NOT NULL, asaas_id VARCHAR(40) NOT NULL, PRIMARY KEY (condominio_id, unidade, cpf))',
  'CREATE TABLE IF NOT EXISTS cobrancas (referencia VARCHAR(140) PRIMARY KEY, condominio_id VARCHAR(80) NOT NULL, competencia CHAR(7) NOT NULL, unidade VARCHAR(20) NOT NULL, asaas_id VARCHAR(40), valor INT NOT NULL, vencimento DATE NOT NULL, situacao VARCHAR(20) NOT NULL, pago_em VARCHAR(30), forma VARCHAR(20), fatura_url TEXT, boleto_url TEXT, pix_copia_cola TEXT, pix_imagem MEDIUMTEXT, INDEX (condominio_id, competencia))',
  'CREATE TABLE IF NOT EXISTS eventos (id VARCHAR(80) PRIMARY KEY, tipo VARCHAR(60), asaas_pagamento VARCHAR(40), recebido_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
];
const COLUNAS_COBRANCA = { referencia: 'referencia', condominioId: 'condominio_id', competencia: 'competencia', unidade: 'unidade', asaasId: 'asaas_id', valor: 'valor', vencimento: 'vencimento', situacao: 'situacao', pagoEm: 'pago_em', forma: 'forma', faturaUrl: 'fatura_url', boletoUrl: 'boleto_url', pixCopiaCola: 'pix_copia_cola', pixImagem: 'pix_imagem' };

function cobrancaDaLinha(l) {
  return Object.fromEntries(Object.entries(COLUNAS_COBRANCA).map(([k, col]) => [k, l[col]]));
}

export async function bancoMysql(config) {
  const mysql = (await import('mysql2/promise')).default;
  const pool = mysql.createPool({ ...config, dateStrings: true, connectionLimit: 5 });
  const q = async (sql, p = []) => (await pool.execute(sql, p))[0];
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
