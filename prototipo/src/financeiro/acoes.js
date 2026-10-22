import { CATEGORIAS_DESPESA, mesmoDiaDoMes } from '../cobranca/dados.js';
import { podeOperar, fmtReais } from '../cobranca/regras.js';
import { SO_SINDICO, comFinanceiro, comAuditoria } from '../cobranca/acoes.js';
import { liberado } from '../planos.js';
import { isoDia, nomeMes } from '../datas.js';
import { CONSELHEIRO } from './dados.js';
import { SITUACOES_TRAVADAS, itemDoBalancete } from './balancete.js';

// Ações do financeiro operacional: contas a pagar (Intermediário). Toda saída de caixa entra na auditoria.
function erroFinanceiro(estado, mensagem) {
  return { estado, erro: mensagem };
}

function guardaFinanceiro(estado, perfil, recurso) {
  if (!podeOperar(perfil)) return SO_SINDICO;
  if (!liberado(estado.plano, recurso)) return `Disponível no plano ${recurso === 'aprovacaoConselho' || recurso === 'fluxoCaixa' ? 'Avançado' : 'Intermediário'}`;
  return null;
}

function idConta(n) {
  return `CT-${String(n).padStart(3, '0')}`;
}

export function novaConta(estado, dados, perfil) {
  const falha = guardaFinanceiro(estado, perfil, 'contasPagar');
  if (falha) return erroFinanceiro(estado, falha);
  const fornecedor = String(dados.fornecedor || '').trim();
  if (!fornecedor) return erroFinanceiro(estado, 'Informe o fornecedor');
  if (!CATEGORIAS_DESPESA[dados.categoria]) return erroFinanceiro(estado, 'Escolha a categoria');
  if (!(dados.valor > 0)) return erroFinanceiro(estado, 'Informe o valor');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dados.vencimento || ''))) return erroFinanceiro(estado, 'Informe o vencimento');
  const fin = estado.financeiro;
  const id = idConta(fin.proximaConta);
  const conta = { id, fornecedor, categoria: dados.categoria, descricao: String(dados.descricao || '').trim() || fornecedor, valor: Math.round(dados.valor), vencimento: dados.vencimento, recorrente: !!dados.recorrente, situacao: 'aberta', pagaEm: null, comprovante: null, boleto: `boleto-${id}.pdf` };
  return { estado: comFinanceiro(estado, { contas: [...fin.contas, conta], proximaConta: fin.proximaConta + 1 }), id };
}

export function pagarConta(estado, id, perfil, agora) {
  const falha = guardaFinanceiro(estado, perfil, 'contasPagar');
  if (falha) return erroFinanceiro(estado, falha);
  const fin = estado.financeiro;
  const conta = fin.contas.find((c) => c.id === id);
  if (!conta) return erroFinanceiro(estado, 'Conta não encontrada');
  if (conta.situacao === 'paga') return erroFinanceiro(estado, 'Esta conta já foi paga');
  const paga = { ...conta, situacao: 'paga', pagaEm: agora.toISOString(), comprovante: `comprovante-${id}.pdf` };
  let contas = fin.contas.map((c) => (c.id === id ? paga : c));
  let proximaConta = fin.proximaConta;
  let seguinte = null;
  if (conta.recorrente) {
    seguinte = { ...conta, id: idConta(proximaConta), vencimento: mesmoDiaDoMes(conta.vencimento, 1), situacao: 'aberta', pagaEm: null, comprovante: null, boleto: `boleto-${idConta(proximaConta)}.pdf` };
    contas = [...contas, seguinte];
    proximaConta += 1;
  }
  const novo = comFinanceiro(estado, {
    contas, proximaConta,
    despesasMes: { ...fin.despesasMes, [conta.categoria]: fin.despesasMes[conta.categoria] + conta.valor },
    saldo: fin.saldo - conta.valor,
    auditoria: comAuditoria(estado, agora, 'Conta paga', `${id} · ${conta.descricao} · ${fmtReais(conta.valor)} · ${CATEGORIAS_DESPESA[conta.categoria]}`),
  });
  return {
    estado: novo,
    seguinte: seguinte && seguinte.id,
    notificacao: { canal: 'Asaas · pagamento de contas', para: conta.fornecedor, texto: `Pagamento de ${fmtReais(conta.valor)} enviado em ${isoDia(agora).split('-').reverse().join('/')} · comprovante anexado${seguinte ? ` · próxima conta em ${seguinte.vencimento.split('-').reverse().join('/')}` : ''}` },
  };
}

// Prestação de contas: fechar o mês (Intermediário trava; Avançado manda ao conselho), análise do conselho, ajuste e resumo.
const SO_CONSELHO = 'Somente o conselho fiscal pode fazer isso';

function idNovoDocumento(estado) {
  return `d${estado.documentos.reduce((m, d) => Math.max(m, Number(d.id.slice(1)) || 0), 0) + 1}`;
}

function comBalancete(estado, mes, mudanca) {
  const fin = estado.financeiro;
  return comFinanceiro(estado, { balancetes: { ...fin.balancetes, [mes]: { ...fin.balancetes[mes], ...mudanca } } });
}

function comDocumentoVersionado(estado, docId, dados, agora) {
  const data = isoDia(agora);
  const atual = docId && estado.documentos.find((d) => d.id === docId);
  if (atual) return { estado: { ...estado, documentos: estado.documentos.map((d) => (d.id === docId ? { ...d, versoes: [...d.versoes, { versao: d.versoes.length + 1, data }] } : d)) }, id: docId };
  const id = idNovoDocumento(estado);
  return { estado: { ...estado, documentos: [...estado.documentos, { id, ...dados, versoes: [{ versao: 1, data }] }] }, id };
}

function guardaConselho(estado, perfil) {
  if (perfil !== 'conselho') return SO_CONSELHO;
  if (!liberado(estado.plano, 'aprovacaoConselho')) return 'Disponível no plano Avançado';
  return null;
}

function balanceteGuardadoDe(estado, mes) {
  return estado.financeiro.balancetes[mes] || null;
}

export function fecharMes(estado, mes, perfil, agora) {
  const falha = guardaFinanceiro(estado, perfil, 'prestacaoContas');
  if (falha) return erroFinanceiro(estado, falha);
  if (mes >= isoDia(agora).slice(0, 7)) return erroFinanceiro(estado, 'O mês ainda não terminou');
  const b = balanceteGuardadoDe(estado, mes);
  if (!b) return erroFinanceiro(estado, 'Balancete não encontrado');
  if (b.situacao !== 'aberto') return erroFinanceiro(estado, 'Este mês já foi fechado');
  const comConselho = liberado(estado.plano, 'aprovacaoConselho');
  const doc = comDocumentoVersionado(estado, b.documento, { pasta: 'Balancetes', titulo: `Balancete de ${nomeMes(mes)}`, visibilidade: 'conselho' }, agora);
  const novo = comBalancete(doc.estado, mes, { situacao: comConselho ? 'aguardando' : 'fechado', fechadoEm: agora.toISOString(), documento: doc.id });
  return {
    estado: comFinanceiro(novo, { auditoria: comAuditoria(novo, agora, 'Balancete fechado', `${nomeMes(mes)}${comConselho ? ' · enviado ao conselho fiscal' : ' · travado'}`) }),
    notificacao: comConselho
      ? { canal: 'App + e-mail', para: `${CONSELHEIRO.nome} (conselho fiscal)`, texto: `Balancete de ${nomeMes(mes)} pronto para análise` }
      : { canal: 'Documentos', para: 'Conselho fiscal', texto: `Balancete de ${nomeMes(mes)} fechado e travado` },
  };
}

export function comentarLancamento(estado, mes, itemId, texto, perfil, agora) {
  const falha = guardaConselho(estado, perfil);
  if (falha) return erroFinanceiro(estado, falha);
  const b = balanceteGuardadoDe(estado, mes);
  if (!b || b.situacao !== 'aguardando') return erroFinanceiro(estado, 'Só balancetes aguardando o conselho recebem comentários');
  if (!itemDoBalancete(b, itemId)) return erroFinanceiro(estado, 'Lançamento não encontrado');
  const escrito = String(texto || '').trim();
  if (!escrito) return erroFinanceiro(estado, 'Escreva o comentário');
  const fin = estado.financeiro;
  const comentario = { id: `CM-${fin.proximoComentario}`, item: itemId, texto: escrito, autor: CONSELHEIRO.nome, em: agora.toISOString(), resposta: null };
  const novo = comBalancete(estado, mes, { comentarios: [...b.comentarios, comentario] });
  return { estado: comFinanceiro(novo, { proximoComentario: fin.proximoComentario + 1 }), id: comentario.id };
}

export function pedirCorrecao(estado, mes, motivo, perfil, agora) {
  const falha = guardaConselho(estado, perfil);
  if (falha) return erroFinanceiro(estado, falha);
  const b = balanceteGuardadoDe(estado, mes);
  if (!b || b.situacao !== 'aguardando') return erroFinanceiro(estado, 'Só balancetes aguardando o conselho');
  const texto = String(motivo || '').trim();
  if (!texto) return erroFinanceiro(estado, 'Informe o motivo');
  return {
    estado: comBalancete(estado, mes, { situacao: 'correcao', correcao: { motivo: texto, autor: CONSELHEIRO.nome, em: agora.toISOString() } }),
    notificacao: { canal: 'App + e-mail', para: 'Síndico', texto: `Conselho pediu correção no balancete de ${nomeMes(mes)}: ${texto}` },
  };
}

export function aprovarMes(estado, mes, perfil, agora) {
  const falha = guardaConselho(estado, perfil);
  if (falha) return erroFinanceiro(estado, falha);
  const b = balanceteGuardadoDe(estado, mes);
  if (!b || b.situacao !== 'aguardando') return erroFinanceiro(estado, 'Só balancetes aguardando o conselho');
  const novo = comBalancete(estado, mes, { situacao: 'aprovado', aprovadoEm: agora.toISOString(), aprovadoPor: CONSELHEIRO.nome });
  return {
    estado: comFinanceiro(novo, { auditoria: comAuditoria(novo, agora, 'Balancete aprovado', `${nomeMes(mes)} · ${CONSELHEIRO.nome} · mês travado`) }),
    notificacao: { canal: 'App + e-mail', para: 'Síndico', texto: `Balancete de ${nomeMes(mes)} aprovado pelo conselho fiscal` },
  };
}

export function anexarNota(estado, mes, itemId, perfil) {
  const falha = guardaFinanceiro(estado, perfil, 'prestacaoContas');
  if (falha) return erroFinanceiro(estado, falha);
  const b = balanceteGuardadoDe(estado, mes);
  if (!b) return erroFinanceiro(estado, 'Balancete não encontrado');
  if (SITUACOES_TRAVADAS.includes(b.situacao)) return erroFinanceiro(estado, 'Mês travado: registre um ajuste no mês corrente');
  if (b.situacao === 'aguardando') return erroFinanceiro(estado, 'Aguarde a análise do conselho');
  if (!itemDoBalancete(b, itemId)) return erroFinanceiro(estado, 'Lançamento não encontrado');
  const despesas = b.despesas.map((d) => ({ ...d, itens: d.itens.map((i) => (i.id === itemId ? { ...i, nota: true, anexo: `nota-${itemId}.pdf` } : i)) }));
  return { estado: comBalancete(estado, mes, { despesas }) };
}

export function responderComentario(estado, mes, comentarioId, texto, perfil, agora) {
  const falha = guardaFinanceiro(estado, perfil, 'prestacaoContas');
  if (falha) return erroFinanceiro(estado, falha);
  const b = balanceteGuardadoDe(estado, mes);
  if (!b || !b.comentarios.some((c) => c.id === comentarioId)) return erroFinanceiro(estado, 'Comentário não encontrado');
  const escrito = String(texto || '').trim();
  if (!escrito) return erroFinanceiro(estado, 'Escreva a resposta');
  return { estado: comBalancete(estado, mes, { comentarios: b.comentarios.map((c) => (c.id === comentarioId ? { ...c, resposta: { texto: escrito, em: agora.toISOString() } } : c)) }) };
}

export function reenviarAoConselho(estado, mes, perfil, agora) {
  const falha = guardaFinanceiro(estado, perfil, 'prestacaoContas');
  if (falha) return erroFinanceiro(estado, falha);
  const b = balanceteGuardadoDe(estado, mes);
  if (!b || b.situacao !== 'correcao') return erroFinanceiro(estado, 'Só balancetes com correção pedida');
  const doc = comDocumentoVersionado(estado, b.documento, {}, agora);
  return {
    estado: comBalancete(doc.estado, mes, { situacao: 'aguardando', correcao: { ...b.correcao, respondidaEm: agora.toISOString() } }),
    notificacao: { canal: 'App + e-mail', para: `${CONSELHEIRO.nome} (conselho fiscal)`, texto: `Balancete de ${nomeMes(mes)} corrigido e reenviado` },
  };
}

export function registrarAjuste(estado, mesOrigem, { descricao, categoria, valor }, perfil, agora) {
  const falha = guardaFinanceiro(estado, perfil, 'prestacaoContas');
  if (falha) return erroFinanceiro(estado, falha);
  const b = balanceteGuardadoDe(estado, mesOrigem);
  if (!b || !SITUACOES_TRAVADAS.includes(b.situacao)) return erroFinanceiro(estado, 'Ajustes só valem para meses travados');
  const texto = String(descricao || '').trim();
  if (!texto) return erroFinanceiro(estado, 'Descreva o ajuste');
  if (!CATEGORIAS_DESPESA[categoria]) return erroFinanceiro(estado, 'Escolha a categoria');
  if (!(valor > 0)) return erroFinanceiro(estado, 'Informe o valor');
  const fin = estado.financeiro;
  const ajuste = { id: `AJ-${fin.ajustesMes.length + 1}`, referente: mesOrigem, descricao: texto, categoria, valor: Math.round(valor), em: agora.toISOString() };
  return {
    estado: comFinanceiro(estado, {
      ajustesMes: [...fin.ajustesMes, ajuste],
      despesasMes: { ...fin.despesasMes, [categoria]: fin.despesasMes[categoria] + ajuste.valor },
      saldo: fin.saldo - ajuste.valor,
      auditoria: comAuditoria(estado, agora, 'Ajuste de mês travado', `Referente a ${nomeMes(mesOrigem)} · ${texto} · ${fmtReais(ajuste.valor)}`),
    }),
    id: ajuste.id,
  };
}

export function publicarResumo(estado, mes, perfil, agora) {
  const falha = guardaFinanceiro(estado, perfil, 'prestacaoContas');
  if (falha) return erroFinanceiro(estado, falha);
  const b = balanceteGuardadoDe(estado, mes);
  if (!b) return erroFinanceiro(estado, 'Balancete não encontrado');
  if (b.resumo) return erroFinanceiro(estado, 'O resumo já foi publicado');
  const comConselho = liberado(estado.plano, 'aprovacaoConselho');
  if (comConselho ? b.situacao !== 'aprovado' : !SITUACOES_TRAVADAS.includes(b.situacao)) return erroFinanceiro(estado, comConselho ? 'Aguarde a aprovação do conselho' : 'Feche o mês antes de publicar');
  const doc = comDocumentoVersionado(estado, null, { pasta: 'Prestação de contas', titulo: `Prestação de contas de ${nomeMes(mes)} (resumo)`, visibilidade: 'todos' }, agora);
  return {
    estado: comBalancete(doc.estado, mes, { resumo: { publicadoEm: agora.toISOString(), documento: doc.id } }),
    notificacao: { canal: 'App', para: 'Todos os moradores', texto: `Prestação de contas de ${nomeMes(mes)} publicada` },
  };
}

// Semente: o balancete aprovado usa o documento d5 e já tem o resumo publicado.
export function comPrestacaoInicial(estado) {
  const fin = estado.financeiro;
  const [mes] = Object.entries(fin.balancetes).find(([, b]) => b.situacao === 'aprovado') || [];
  if (!mes) return estado;
  const b = fin.balancetes[mes];
  const documentos = estado.documentos.map((d) => (d.id === 'd5' ? { ...d, titulo: `Balancete de ${nomeMes(mes)}`, versoes: [{ versao: 1, data: isoDia(new Date(b.fechadoEm)) }] } : d));
  const id = idNovoDocumento(estado);
  const comResumo = { ...estado, documentos: [...documentos, { id, pasta: 'Prestação de contas', titulo: `Prestação de contas de ${nomeMes(mes)} (resumo)`, versoes: [{ versao: 1, data: isoDia(new Date(b.resumo.publicadoEm)) }], visibilidade: 'todos' }] };
  return comBalancete(comResumo, mes, { resumo: { ...b.resumo, documento: id } });
}
