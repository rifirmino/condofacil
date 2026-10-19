import { SINDICO } from '../dados.js';
import { liberado, planoMinimo } from '../planos.js';
import { isoDia, somarDias, somarMes, fmtDataCurta } from '../datas.js';
import { situacaoCobranca, valorAtualizado, fmtReais, podeOperar, rotuloCobranca } from './regras.js';
import { SO_SINDICO, comFinanceiro, comAuditoria, nomeResponsavel } from './acoes.js';

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

export function acordoDaUnidade(estado, unidade) {
  if (acordoAtivo(estado, unidade)) return 'ativo';
  if (propostaPendente(estado, unidade)) return 'aguardando';
  return null;
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
