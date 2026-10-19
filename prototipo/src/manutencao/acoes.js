import { CATEGORIAS, PRIORIDADES } from '../dados.js';
import { liberado } from '../planos.js';
import { trocarItem, nomesDaUnidade } from '../acoes.js';
import { fmtReais } from '../cobranca/regras.js';
import { comAuditoria } from '../cobranca/acoes.js';
import { ZELADOR } from './dados.js';
import { cotacoesMinimas, textoCotacoes } from './regras.js';

// Ações do zelador e do síndico sobre OS, compras e caixa pequeno. Cada uma devolve { estado, notificacao?, erro?, id? }.
const SO_EQUIPE = 'Somente o zelador ou o síndico pode fazer isso';
const SO_SINDICO_MAN = 'Somente o síndico pode fazer isso';
const DIA_MS = 86400000;
const LIMITE_CAIXA = 20000;

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
  if (responsavel === 'prestador' && !String(prestador || '').trim()) return erroMan(estado, 'Informe o prestador');
  const limite = PRIORIDADES[oc.prioridade].solucao;
  const prazoFinal = prazo || new Date(new Date(oc.criadaEm).getTime() + (limite || 168) * 3600000).toISOString();
  const quem = responsavel === 'prestador' ? `o prestador ${prestador.trim()}` : 'o zelador';
  const os = novaOS(estado, { origem: 'notificacao', notificacao: oc.id, local: oc.local || CATEGORIAS[oc.categoria].nome, descricao: oc.descricao, prioridade: oc.prioridade, prazo: prazoFinal, responsavel, prestador: responsavel === 'prestador' ? prestador.trim() : null, linha: [{ em: agora.toISOString(), status: 'aberta', texto: `OS aberta a partir da ${oc.id}`, autor: 'Síndico' }] }, agora);
  const entrada = { em: agora.toISOString(), status: oc.status === 'em_andamento' ? null : 'em_andamento', texto: `${os.id} aberta para ${quem}`, autor: 'Síndico' };
  return {
    estado: {
      ...comManutencao(estado, { os: [...estado.manutencao.os, os], proximaOS: estado.manutencao.proximaOS + 1 }),
      ocorrencias: trocarItem(estado.ocorrencias, oc.id, { os: os.id, status: 'em_andamento', linha: [...oc.linha, entrada] }),
    },
    id: os.id,
    notificacao: { canal: 'Push', para: responsavel === 'prestador' ? prestador.trim() : ZELADOR, texto: `Nova ${os.id}: ${os.local}` },
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
  let novo = mudarOS(estado, id, { status: 'concluida', fotoDepois: true, materiais: String(materiais).trim(), horas, observacoes: String(observacoes).trim(), concluidaEm: em }, { em, status: 'concluida', texto: 'Concluída com fotos do depois', autor: autorDe(perfil) });
  const oc = os.notificacao ? novo.ocorrencias.find((o) => o.id === os.notificacao) : null;
  if (!oc || ['resolvida', 'fechada'].includes(oc.status)) return { estado: novo, notificacao: { canal: 'Push', para: 'Síndico', texto: `${id} concluída: validar` } };
  // Em nome do condomínio: a entrada não cria autor novo e a 1ª resposta já existe (a OS foi gerada pelo síndico).
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

function compraPorId(estado, id) {
  return estado.manutencao.compras.find((c) => c.id === id);
}

function lancarDespesa(estado, categoria, valor, agora, acao, detalhe) {
  const fin = estado.financeiro;
  return { ...estado, financeiro: { ...fin, despesasMes: { ...fin.despesasMes, [categoria]: fin.despesasMes[categoria] + valor }, saldo: fin.saldo - valor, auditoria: comAuditoria(estado, agora, acao, detalhe) } };
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
    estado: lancarDespesa(recebida, c.categoria, valorFinal, agora, 'Compra lançada', `${id} · ${c.item} · ${fmtReais(valorFinal)}`),
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
    estado: lancarDespesa(reposto, 'manutencao', valor, agora, 'Caixa pequeno reposto', `${fmtReais(valor)} · ${caixa.gastos.length} gastos com cupom`),
    notificacao: { canal: 'App', para: ZELADOR, texto: `Caixa pequeno reposto: saldo ${fmtReais(caixa.fundo)}` },
  };
}
