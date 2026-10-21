import { liberado } from '../planos.js';
import { isoDia } from '../datas.js';
import { SO_SINDICO, comFinanceiro } from './acoes.js';
import { podeOperar } from './regras.js';

// Previsões orçamentárias salvas e o documento levado à AGO.
function erroOrcamento(estado, mensagem) {
  return { estado, erro: mensagem };
}

function guardaOrcamento(estado, perfil) {
  if (!podeOperar(perfil)) return SO_SINDICO;
  if (!liberado(estado.plano, 'simuladorTaxa')) return 'Disponível no plano Intermediário';
  return null;
}

export function salvarPrevisao(estado, dados, perfil, agora) {
  const falha = guardaOrcamento(estado, perfil);
  if (falha) return erroOrcamento(estado, falha);
  const nome = String(dados.nome || '').trim();
  if (!nome) return erroOrcamento(estado, 'Informe o nome da previsão');
  const linhas = (dados.linhas || []).map((l) => ({ categoria: l.categoria || null, nome: String(l.nome || '').trim(), valor: l.valor }));
  if (!linhas.length || linhas.some((l) => (!l.categoria && !l.nome) || !Number.isFinite(l.valor) || l.valor < 0)) return erroOrcamento(estado, 'Cada linha precisa de nome e valor');
  const margemPct = Number(dados.margemPct);
  if (!Number.isFinite(margemPct) || margemPct < 0 || margemPct > 50) return erroOrcamento(estado, 'A margem de inadimplência deve ser de 0% a 50%');
  const fin = estado.financeiro;
  const em = agora.toISOString();
  const existente = dados.id && fin.previsoes.find((p) => p.id === dados.id);
  if (existente) {
    const atualizada = { ...existente, ano: dados.ano, nome, linhas, margemPct, atualizadaEm: em };
    return { estado: comFinanceiro(estado, { previsoes: fin.previsoes.map((p) => (p.id === existente.id ? atualizada : p)) }), id: existente.id };
  }
  const id = `PO-${String(fin.proximaPrevisao).padStart(3, '0')}`;
  const previsao = { id, ano: dados.ano, nome, linhas, margemPct, criadaEm: em, atualizadaEm: em, documento: null };
  return { estado: comFinanceiro(estado, { previsoes: [...fin.previsoes, previsao], proximaPrevisao: fin.proximaPrevisao + 1 }), id };
}

export function excluirPrevisao(estado, id, perfil) {
  const falha = guardaOrcamento(estado, perfil);
  if (falha) return erroOrcamento(estado, falha);
  if (!estado.financeiro.previsoes.some((p) => p.id === id)) return erroOrcamento(estado, 'Previsão não encontrada');
  return { estado: comFinanceiro(estado, { previsoes: estado.financeiro.previsoes.filter((p) => p.id !== id) }) };
}

export function gerarDocumentoPrevisao(estado, id, perfil, agora) {
  const falha = guardaOrcamento(estado, perfil);
  if (falha) return erroOrcamento(estado, falha);
  const previsao = estado.financeiro.previsoes.find((p) => p.id === id);
  if (!previsao) return erroOrcamento(estado, 'Salve a previsão antes de gerar o documento');
  const titulo = `Previsão orçamentária ${previsao.ano} · ${previsao.nome}`;
  const data = isoDia(agora);
  const atual = previsao.documento && estado.documentos.find((d) => d.id === previsao.documento);
  if (atual) {
    const versao = atual.versoes.length + 1;
    const documentos = estado.documentos.map((d) => (d.id === atual.id ? { ...d, titulo, versoes: [...d.versoes, { versao, data }] } : d));
    return { estado: { ...estado, documentos }, id: atual.id, versao, notificacao: { canal: 'Documentos', para: 'Todos os moradores', texto: `${titulo}: versão ${versao} publicada` } };
  }
  const docId = `d${estado.documentos.reduce((m, d) => Math.max(m, Number(d.id.slice(1)) || 0), 0) + 1}`;
  const documento = { id: docId, pasta: 'Previsão orçamentária', titulo, versoes: [{ versao: 1, data }], visibilidade: 'todos' };
  const novo = comFinanceiro({ ...estado, documentos: [...estado.documentos, documento] }, { previsoes: estado.financeiro.previsoes.map((p) => (p.id === id ? { ...p, documento: docId } : p)) });
  return { estado: novo, id: docId, versao: 1, notificacao: { canal: 'Documentos', para: 'Todos os moradores', texto: `${titulo} publicada para a AGO` } };
}
