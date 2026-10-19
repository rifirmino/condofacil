import { SINDICO } from '../dados.js';
import { PLANOS } from '../planos.js';
import { isoDia } from '../datas.js';
import { validarParametros, previaCompetencia, valorAtualizado, pendentesDaRegua, podeOperar, fmtReais, mesExtenso } from './regras.js';

// Cada ação devolve { estado, notificacao?, erro? } sem mutar nada; ações financeiras entram na auditoria.
export const SO_SINDICO = 'Somente o síndico pode fazer isso';

function erroCobranca(estado, mensagem) {
  return { estado, erro: mensagem };
}

export function comFinanceiro(estado, mudanca) {
  return { ...estado, financeiro: { ...estado.financeiro, ...mudanca } };
}

export function comAuditoria(estado, agora, acao, detalhe) {
  return [...estado.financeiro.auditoria, { em: agora.toISOString(), quem: SINDICO, acao, detalhe }];
}

function trocarCobranca(cobrancas, id, mudanca) {
  return cobrancas.map((c) => (c.id === id ? { ...c, ...mudanca } : c));
}

export function nomeResponsavel(estado, unidade) {
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
    status: 'aberta', pagaEm: null, valorPago: null, forma: null, baixaManual: null, eventosAsaas: [], regua: [], substituiu: null, acordo: null,
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
