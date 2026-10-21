import { CATEGORIAS, PRIORIDADES } from '../dados.js';
import { liberado } from '../planos.js';
import { trocarItem } from '../acoes.js';

// Ações do síndico na caixa de notificações (Intermediário em diante). Cada uma entra na linha do tempo como "Síndico".
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

export function arquivarComJustificativa(estado, id, motivo, perfil, agora) {
  if (perfil !== 'sindico') return erroNotif(estado, SO_SINDICO_NOTIF);
  const texto = String(motivo || '').trim();
  if (!texto) return erroNotif(estado, 'Informe o motivo do arquivamento');
  if (!estado.ocorrencias.some((o) => o.id === id)) return erroNotif(estado, 'Ocorrência não encontrada');
  return { estado: comEntrada(estado, id, { arquivada: true, motivoArquivamento: texto }, { em: agora.toISOString(), status: null, texto: `Arquivada: ${texto}`, autor: 'Síndico' }) };
}
