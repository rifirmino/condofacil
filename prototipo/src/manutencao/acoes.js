import { CATEGORIAS, PRIORIDADES } from '../dados.js';
import { liberado } from '../planos.js';
import { trocarItem, nomesDaUnidade } from '../acoes.js';
import { ZELADOR } from './dados.js';

// Ações do zelador e do síndico sobre OS, compras e caixa pequeno. Cada uma devolve { estado, notificacao?, erro?, id? }.
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
