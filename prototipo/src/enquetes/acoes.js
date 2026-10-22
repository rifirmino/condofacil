import { liberado } from '../planos.js';
import { trocarItem, publicarComunicado } from '../acoes.js';
import { somarDias, momento, isoDia, fmtDataCurta } from '../datas.js';
import { enquetePorId, situacaoEnquete, unidadesDoPublico, faltantes, apuracao, textoResultado, textoDiasRestantes } from './regras.js';

// Ações das enquetes: o síndico cria, publica, lembra, encerra, prorroga e publica o resultado; o morador vota.
const SO_SINDICO_ENQUETE = 'Somente o síndico pode fazer isso';
const CANAIS_ENQUETE = 'App + e-mail + WhatsApp';

function erroEnquete(estado, mensagem) {
  return { estado, erro: mensagem };
}

function comEnquete(estado, id, mudanca) {
  return { ...estado, enquetes: trocarItem(estado.enquetes, id, mudanca) };
}

// O que o plano não libera volta ao padrão do Básico: escolha única, sem comentário, voto secreto, sem peso nem quórum.
function noPlano(estado, dados) {
  const completa = liberado(estado.plano, 'enqueteCompleta');
  const peso = liberado(estado.plano, 'enquetePeso');
  return {
    tipo: completa && dados.tipo === 'multipla' ? 'multipla' : 'unica',
    maxEscolhas: completa && dados.tipo === 'multipla' ? Math.max(2, Math.min(Number(dados.maxEscolhas) || 2, dados.opcoes.length)) : 1,
    comentarios: completa && !!dados.comentarios,
    secreto: completa ? dados.secreto !== false : true,
    parcialVisivel: completa && !!dados.parcialVisivel,
    lembretesAuto: completa && dados.lembretesAuto !== false,
    peso: peso && dados.peso === 'fracao' ? 'fracao' : 'unidade',
    quorumPct: peso && Number(dados.quorumPct) > 0 ? Math.min(100, Math.round(Number(dados.quorumPct))) : null,
  };
}

export function salvarEnquete(estado, dados, perfil, agora) {
  if (perfil !== 'sindico') return erroEnquete(estado, SO_SINDICO_ENQUETE);
  if (!liberado(estado.plano, 'enquetes')) return erroEnquete(estado, 'Disponível no plano Básico');
  const pergunta = String(dados.pergunta || '').trim();
  if (!pergunta) return erroEnquete(estado, 'Escreva a pergunta');
  const textos = (dados.opcoes || []).map((o) => String(o || '').trim()).filter(Boolean);
  if (textos.length < 2) return erroEnquete(estado, 'Informe pelo menos 2 opções');
  if (textos.length > 8) return erroEnquete(estado, 'No máximo 8 opções');
  if (new Set(textos.map((t) => t.toLowerCase())).size !== textos.length) return erroEnquete(estado, 'Opções repetidas');
  const dias = Number(dados.dias);
  if (!Number.isInteger(dias) || dias < 1 || dias > 60) return erroEnquete(estado, 'Escolha uma data limite de 1 a 60 dias');
  const publico = dados.publico || { tipo: 'todos' };
  if (!destinatariosValidos(estado, publico)) return erroEnquete(estado, 'Escolha o público');
  const existente = dados.id && enquetePorId(estado, dados.id);
  if (existente && existente.situacao !== 'rascunho') return erroEnquete(estado, 'Só rascunhos podem ser editados');
  const id = existente ? existente.id : `EN-${String(estado.proximaEnquete).padStart(3, '0')}`;
  const enquete = {
    id, pergunta, contexto: String(dados.contexto || '').trim(), anexo: dados.anexo || null,
    opcoes: textos.map((texto, n) => ({ id: `${id}-o${n + 1}`, texto })),
    publico, criadaEm: existente ? existente.criadaEm : agora.toISOString(), abertaEm: null,
    encerraEm: momento(somarDias(isoDia(agora), dias), 23, 59).toISOString(), dias, situacao: 'rascunho', encerradaEm: null,
    lembretes: [], prorrogada: false, votos: {}, resultado: null,
    ...noPlano(estado, { ...dados, opcoes: textos }),
  };
  if (existente) return { estado: comEnquete(estado, id, enquete), id };
  return { estado: { ...estado, enquetes: [...estado.enquetes, enquete], proximaEnquete: estado.proximaEnquete + 1 }, id };
}

function destinatariosValidos(estado, publico) {
  if (publico.tipo === 'unidades') return (publico.valor || []).some((u) => estado.condominio.unidades.includes(u));
  return ['todos', 'andar'].includes(publico.tipo);
}

export function publicarEnquete(estado, id, perfil, agora) {
  if (perfil !== 'sindico') return erroEnquete(estado, SO_SINDICO_ENQUETE);
  const e = enquetePorId(estado, id);
  if (!e || e.situacao !== 'rascunho') return erroEnquete(estado, 'Só rascunhos podem ser publicados');
  const encerraEm = e.dias ? momento(somarDias(isoDia(agora), e.dias), 23, 59).toISOString() : e.encerraEm;
  if (new Date(encerraEm) <= agora) return erroEnquete(estado, 'Escolha uma data limite de 1 a 60 dias');
  const n = unidadesDoPublico(estado, e).length;
  return {
    estado: comEnquete(estado, id, { situacao: 'aberta', abertaEm: agora.toISOString(), encerraEm }),
    notificacao: { canal: CANAIS_ENQUETE, para: `${n} unidades`, texto: `Nova enquete: ${e.pergunta} · responda até ${fmtDataCurta(isoDia(new Date(encerraEm)))}` },
  };
}

export function votar(estado, id, { unidade, autor, opcoes, comentario }, agora) {
  const e = enquetePorId(estado, id);
  if (!e || e.situacao === 'rascunho') return erroEnquete(estado, 'Enquete não encontrada');
  if (situacaoEnquete(e, agora) !== 'aberta') return erroEnquete(estado, 'A enquete está encerrada');
  if (!unidadesDoPublico(estado, e).includes(unidade)) return erroEnquete(estado, 'Sua unidade não faz parte do público desta enquete');
  const escolhidas = [...new Set(opcoes || [])].filter((o) => e.opcoes.some((x) => x.id === o));
  if (!escolhidas.length) return erroEnquete(estado, 'Escolha uma opção');
  if (escolhidas.length > e.maxEscolhas) return erroEnquete(estado, e.maxEscolhas === 1 ? 'Escolha só uma opção' : `Escolha até ${e.maxEscolhas} opções`);
  const trocou = !!e.votos[unidade];
  const voto = { opcoes: escolhidas, comentario: e.comentarios ? String(comentario || '').trim() : '', autor, em: agora.toISOString() };
  return { estado: comEnquete(estado, id, { votos: { ...e.votos, [unidade]: voto } }), trocou };
}

export function enviarLembrete(estado, id, perfil, agora, automatico = false) {
  if (perfil !== 'sindico') return erroEnquete(estado, SO_SINDICO_ENQUETE);
  const e = enquetePorId(estado, id);
  if (!e || situacaoEnquete(e, agora) !== 'aberta') return erroEnquete(estado, 'Só enquetes abertas recebem lembrete');
  if (automatico && !liberado(estado.plano, 'enqueteCompleta')) return erroEnquete(estado, 'Disponível no plano Intermediário');
  const lista = faltantes(estado, e);
  if (!lista.length) return erroEnquete(estado, 'Todas as unidades já responderam');
  const prazo = textoDiasRestantes(e, agora);
  const texto = `${prazo === 'termina hoje' ? 'Hoje é o último dia' : `${prazo[0].toUpperCase()}${prazo.slice(1)}`} para a enquete "${e.pergunta}". Sua unidade ainda não votou`;
  return {
    estado: comEnquete(estado, id, { lembretes: [...e.lembretes, { em: agora.toISOString(), unidades: lista.length, automatico }] }),
    notificacao: { canal: CANAIS_ENQUETE, para: `${lista.length} unidades`, texto },
  };
}

export function encerrarEnquete(estado, id, perfil, agora) {
  if (perfil !== 'sindico') return erroEnquete(estado, SO_SINDICO_ENQUETE);
  const e = enquetePorId(estado, id);
  if (!e || situacaoEnquete(e, agora) !== 'aberta') return erroEnquete(estado, 'Só enquetes abertas podem ser encerradas');
  const fim = agora.toISOString();
  const novo = comEnquete(estado, id, { situacao: 'encerrada', encerradaEm: fim, encerraEm: fim });
  return { estado: novo, notificacao: { canal: 'App', para: 'Síndico', texto: `Enquete encerrada · ${textoResultado(novo, enquetePorId(novo, id))}` } };
}

export function prorrogarEnquete(estado, id, dias, perfil, agora) {
  if (perfil !== 'sindico') return erroEnquete(estado, SO_SINDICO_ENQUETE);
  const e = enquetePorId(estado, id);
  if (!e || situacaoEnquete(e, agora) !== 'aberta') return erroEnquete(estado, 'Só enquetes abertas podem ser prorrogadas');
  if (e.prorrogada) return erroEnquete(estado, 'Só é possível prorrogar uma vez');
  const n = Number(dias);
  if (!Number.isInteger(n) || n < 1 || n > 30) return erroEnquete(estado, 'Prorrogue de 1 a 30 dias');
  const encerraEm = momento(somarDias(isoDia(new Date(e.encerraEm)), n), 23, 59).toISOString();
  return {
    estado: comEnquete(estado, id, { encerraEm, prorrogada: true }),
    notificacao: { canal: CANAIS_ENQUETE, para: `${unidadesDoPublico(estado, e).length} unidades`, texto: `Enquete "${e.pergunta}" prorrogada até ${fmtDataCurta(isoDia(new Date(encerraEm)))}` },
  };
}

export function publicarResultado(estado, id, perfil, agora) {
  if (perfil !== 'sindico') return erroEnquete(estado, SO_SINDICO_ENQUETE);
  if (!liberado(estado.plano, 'enqueteCompleta')) return erroEnquete(estado, 'Disponível no plano Intermediário');
  const e = enquetePorId(estado, id);
  if (!e || situacaoEnquete(e, agora) !== 'encerrada') return erroEnquete(estado, 'Encerre a enquete antes de publicar');
  if (e.resultado) return erroEnquete(estado, 'O resultado já foi publicado');
  const a = apuracao(estado, e);
  const linhas = a.opcoes.map((o) => `${o.texto}: ${Math.round(e.peso === 'fracao' ? o.pesoPct : o.pct)}%`).join('\n');
  const texto = `${textoResultado(estado, e)}.\n\n${linhas}\n\nParticipação: ${a.participantes} de ${a.total} unidades (${Math.round(a.participacaoPct)}%).${e.peso === 'fracao' ? ' Votos ponderados pela fração ideal.' : ''}`;
  const pub = publicarComunicado(estado, { tipo: 'geral', titulo: `Resultado da enquete: ${e.pergunta}`, texto, publico: e.publico, canais: ['push', 'email'] }, agora);
  if (pub.erro) return erroEnquete(estado, pub.erro);
  const docId = `d${pub.estado.documentos.reduce((m, d) => Math.max(m, Number(d.id.slice(1)) || 0), 0) + 1}`;
  const documento = { id: docId, pasta: 'Enquetes', titulo: `Resultado da enquete: ${e.pergunta}`, versoes: [{ versao: 1, data: isoDia(agora) }], visibilidade: 'todos' };
  const novo = comEnquete({ ...pub.estado, documentos: [...pub.estado.documentos, documento] }, id, { resultado: { publicadoEm: agora.toISOString(), comunicado: pub.id, documento: docId } });
  return { estado: novo, notificacao: { canal: pub.notificacao.canal, para: pub.notificacao.para, texto: `Resultado publicado: ${textoResultado(estado, e)}` } };
}
