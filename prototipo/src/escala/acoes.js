import { liberado } from '../planos.js';
import { somarDias, somarMes, isoDia } from '../datas.js';
import { POSTOS, atribuicoesIniciais } from './dados.js';
import { gerarTurnos, acharTurno, todosTurnos, conflita, menorDescanso, porteiroPorId, instanteLocal, horaLocal, mesAtual, fmtTurno, nomeDoMesEscala } from './regras.js';

// Ações da escala: o síndico gera, publica, aprova e atribui; o porteiro propõe, aceita, registra falta e faz check-in.
const SO_SINDICO_ESC = 'Somente o síndico pode fazer isso';

function erroEsc(estado, mensagem) {
  return { estado, erro: mensagem };
}

function guardaEsc(estado, perfil, soSindico) {
  if (soSindico && perfil !== 'sindico') return SO_SINDICO_ESC;
  if (!liberado(estado.plano, 'escala')) return 'Disponível no plano Intermediário';
  return null;
}

function comEscala(estado, mudanca) {
  return { ...estado, escala: { ...estado.escala, ...mudanca } };
}

function mudarTurno(estado, id, mudanca) {
  const mes = id.slice(2, 9);
  const m = estado.escala.meses[mes];
  return comEscala(estado, { meses: { ...estado.escala.meses, [mes]: { ...m, turnos: m.turnos.map((t) => (t.id === id ? { ...t, ...mudanca } : t)) } } });
}

function alertaDescanso(estado, porteiro, turno) {
  return menorDescanso(estado, porteiro, turno) < 11 ? `Menos de 11 h de descanso para ${porteiroPorId(estado, porteiro).nome}` : undefined;
}

function inicioDoTurno(t) {
  return fmtTurno(t).split('–')[0];
}

export function gerarEscala(estado, mes, perfil) {
  const falha = guardaEsc(estado, perfil, true);
  if (falha) return erroEsc(estado, falha);
  if (estado.escala.meses[mes]) return erroEsc(estado, `A escala de ${nomeDoMesEscala(mes)} já foi gerada`);
  return { estado: comEscala(estado, { meses: { ...estado.escala.meses, [mes]: { situacao: 'rascunho', publicadaEm: null, turnos: gerarTurnos(estado.escala, mes) } } }) };
}

export function publicarEscala(estado, mes, perfil, agora) {
  const falha = guardaEsc(estado, perfil, true);
  if (falha) return erroEsc(estado, falha);
  const m = estado.escala.meses[mes];
  if (!m) return erroEsc(estado, 'Gere a escala antes de publicar');
  if (m.situacao === 'publicada') return erroEsc(estado, 'Escala já publicada');
  const avisados = new Set(m.turnos.filter((t) => t.porteiro).map((t) => t.porteiro)).size;
  return {
    estado: comEscala(estado, { meses: { ...estado.escala.meses, [mes]: { ...m, situacao: 'publicada', publicadaEm: instanteLocal(agora) } } }),
    notificacao: { canal: 'App', para: 'Porteiros', texto: `Escala de ${nomeDoMesEscala(mes)} publicada: ${avisados} porteiros avisados` },
  };
}

export function ajustarTurno(estado, turnoId, porteiro, perfil) {
  const falha = guardaEsc(estado, perfil, true);
  if (falha) return erroEsc(estado, falha);
  const t = acharTurno(estado, turnoId);
  if (!t) return erroEsc(estado, 'Turno não encontrado');
  if (porteiro && conflita(estado, porteiro, t)) return erroEsc(estado, 'Este colega já tem turno nesse horário');
  const novo = mudarTurno(estado, turnoId, porteiro ? { porteiro } : { porteiro: null, motivoDescoberto: t.motivoDescoberto || 'falta', porteiroOriginal: t.porteiroOriginal || t.porteiro });
  const nomes = [...new Set([t.porteiro, porteiro].filter(Boolean))].map((id) => porteiroPorId(estado, id).nome);
  const publicada = estado.escala.meses[turnoId.slice(2, 9)].situacao === 'publicada';
  return {
    estado: novo,
    alerta: porteiro ? alertaDescanso(estado, porteiro, t) : undefined,
    notificacao: publicada && nomes.length ? { canal: 'App', para: nomes.join(' e '), texto: `Escala alterada: ${POSTOS[t.posto].nome} ${fmtTurno(t)}` } : undefined,
  };
}

export function proporTroca(estado, { turnoId, de, para }, perfil, agora) {
  const falha = guardaEsc(estado, perfil, false);
  if (falha) return erroEsc(estado, falha);
  const t = turnoId ? acharTurno(estado, turnoId) : null;
  if (!t || !para) return erroEsc(estado, 'Escolha o turno e o colega');
  if (t.porteiro !== de) return erroEsc(estado, 'Só o porteiro do turno pode propor a troca');
  if (conflita(estado, para, t)) return erroEsc(estado, 'Este colega já tem turno nesse horário');
  const id = `TR-${String(estado.escala.proximaTroca).padStart(3, '0')}`;
  return {
    estado: comEscala(estado, { trocas: [...estado.escala.trocas, { id, turno: t.id, de, para, situacao: 'proposta', criadaEm: instanteLocal(agora) }], proximaTroca: estado.escala.proximaTroca + 1 }),
    id,
    notificacao: { canal: 'App', para: porteiroPorId(estado, para).nome, texto: `${porteiroPorId(estado, de).nome} propôs trocar o turno de ${fmtTurno(t)}` },
  };
}

function mudarTroca(estado, id, mudanca) {
  return comEscala(estado, { trocas: estado.escala.trocas.map((x) => (x.id === id ? { ...x, ...mudanca } : x)) });
}

export function aceitarTroca(estado, id, quem) {
  const x = estado.escala.trocas.find((t) => t.id === id);
  if (!x || x.situacao !== 'proposta') return erroEsc(estado, 'Esta troca não está aguardando o colega');
  if (x.para !== quem) return erroEsc(estado, 'Só o colega convidado pode aceitar');
  return { estado: mudarTroca(estado, id, { situacao: 'aceita' }), notificacao: { canal: 'App', para: 'Síndico', texto: `Troca ${id} aceita: aguardando sua aprovação` } };
}

export function recusarTroca(estado, id, quem, perfil) {
  const x = estado.escala.trocas.find((t) => t.id === id);
  if (!x || !['proposta', 'aceita'].includes(x.situacao)) return erroEsc(estado, 'Esta troca não pode mais ser recusada');
  if (perfil !== 'sindico' && x.para !== quem) return erroEsc(estado, 'Só o colega convidado pode aceitar');
  return { estado: mudarTroca(estado, id, { situacao: 'recusada' }), notificacao: { canal: 'App', para: porteiroPorId(estado, x.de).nome, texto: `Troca ${id} recusada` } };
}

export function aprovarTroca(estado, id, perfil) {
  const falha = guardaEsc(estado, perfil, true);
  if (falha) return erroEsc(estado, falha);
  const x = estado.escala.trocas.find((t) => t.id === id);
  if (!x || x.situacao !== 'aceita') return erroEsc(estado, 'Esta troca ainda não foi aceita pelo colega');
  const t = acharTurno(estado, x.turno);
  return {
    estado: mudarTurno(mudarTroca(estado, id, { situacao: 'aprovada' }), t.id, { porteiro: x.para, trocado: true }),
    alerta: alertaDescanso(estado, x.para, t),
    notificacao: { canal: 'App', para: `${porteiroPorId(estado, x.de).nome} e ${porteiroPorId(estado, x.para).nome}`, texto: `Troca aprovada: ${POSTOS[t.posto].nome} ${fmtTurno(t)} fica com ${porteiroPorId(estado, x.para).nome}` },
  };
}

export function registrarFalta(estado, turnoId, { quem, motivo, anexo = null }, perfil) {
  const falha = guardaEsc(estado, perfil, false);
  if (falha) return erroEsc(estado, falha);
  const t = turnoId ? acharTurno(estado, turnoId) : null;
  if (!t || !['falta', 'atestado'].includes(motivo)) return erroEsc(estado, 'Escolha o turno e o motivo');
  if (perfil !== 'sindico' && t.porteiro !== quem) return erroEsc(estado, 'Só o porteiro do turno pode registrar a falta');
  if (!t.porteiro) return erroEsc(estado, 'Este turno já está descoberto');
  const p = porteiroPorId(estado, t.porteiro);
  const novo = mudarTurno(estado, t.id, { porteiro: null, motivoDescoberto: motivo, porteiroOriginal: t.porteiro, anexo });
  const notificacao = p.vinculo === 'terceirizado'
    ? { canal: 'WhatsApp', para: p.empresa, texto: `${p.empresa}: turno descoberto na ${POSTOS[t.posto].nome} ${inicioDoTurno(t)}` }
    : { canal: 'App', para: 'Síndico', texto: `Turno descoberto: ${POSTOS[t.posto].nome} ${inicioDoTurno(t)} (${motivo} de ${p.nome})` };
  return { estado: novo, notificacao };
}

export function atribuirCobertura(estado, turnoId, porteiro, perfil) {
  const falha = guardaEsc(estado, perfil, true);
  if (falha) return erroEsc(estado, falha);
  const t = acharTurno(estado, turnoId);
  if (!t || t.porteiro) return erroEsc(estado, 'Este turno não está descoberto');
  if (conflita(estado, porteiro, t)) return erroEsc(estado, 'Este colega já tem turno nesse horário');
  return {
    estado: mudarTurno(estado, t.id, { porteiro }),
    alerta: alertaDescanso(estado, porteiro, t),
    notificacao: { canal: 'App', para: porteiroPorId(estado, porteiro).nome, texto: `Você cobre ${POSTOS[t.posto].nome} ${fmtTurno(t)}` },
  };
}

export function fazerCheckin(estado, porteiro, agora) {
  if (!liberado(estado.plano, 'checkin')) return erroEsc(estado, 'Disponível no plano Avançado');
  const atual = instanteLocal(agora);
  const t = todosTurnos(estado).find((x) => x.porteiro === porteiro && x.inicio <= atual && atual < x.fim);
  if (!t || t.checkin) return erroEsc(estado, 'Não há turno seu agora para fazer check-in');
  const minutos = Math.round((new Date(atual) - new Date(t.inicio)) / 60000);
  return { estado: mudarTurno(estado, t.id, { checkin: { em: atual, atrasoMin: minutos > 10 ? minutos : 0 } }) };
}

export function fazerCheckout(estado, porteiro, agora) {
  if (!liberado(estado.plano, 'checkin')) return erroEsc(estado, 'Disponível no plano Avançado');
  const atual = instanteLocal(agora);
  const t = todosTurnos(estado).find((x) => x.porteiro === porteiro && x.checkin && !x.checkout && x.inicio <= atual);
  if (!t) return erroEsc(estado, 'Faça o check-in antes do check-out');
  return { estado: mudarTurno(estado, t.id, { checkout: { em: atual } }) };
}

// Seed: mês atual publicado no dia 25 do mês anterior, check-in nos turnos encerrados, atestado de amanhã e uma troca aceita.
export function comEscalaInicial(estado, agora) {
  const mes = mesAtual(agora);
  const escala = { atribuicoes: atribuicoesIniciais(mes), ferias: [{ porteiro: 'rita', de: `${mes}-12`, ate: `${mes}-21` }], trocas: [], meses: {}, proximaTroca: 1 };
  const atual = instanteLocal(agora);
  const atrasos = { [`T-${mes}-02-portaria-07`]: 15, [`T-${mes}-03-portaria-19`]: 22 };
  const turnos = gerarTurnos(escala, mes).map((t) => {
    if (!t.porteiro || t.fim > atual) return t;
    const atraso = atrasos[t.id] || 0;
    return { ...t, checkin: { em: instanteLocal(new Date(new Date(t.inicio).getTime() + atraso * 60000)), atrasoMin: atraso }, checkout: { em: t.fim } };
  });
  let e = { ...estado, escala: { ...escala, meses: { [mes]: { situacao: 'publicada', publicadaEm: `${somarMes(mes, -1)}-25T18:00`, turnos } } } };
  const amanha = somarDias(isoDia(agora), 1);
  const atestado = turnos.find((t) => t.id === `T-${amanha}-guarita-07` && t.porteiro === 'claudia');
  if (atestado) e = mudarTurno(e, atestado.id, { porteiro: null, motivoDescoberto: 'atestado', porteiroOriginal: 'claudia', anexo: 'atestado-claudia.pdf' });
  const daTroca = turnos.find((t) => t.porteiro === 'marcos' && t.inicio > horaLocal(somarDias(isoDia(agora), 2), 23));
  if (daTroca) e = comEscala(e, { trocas: [{ id: 'TR-001', turno: daTroca.id, de: 'marcos', para: 'paulo', situacao: 'aceita', criadaEm: instanteLocal(new Date(agora.getTime() - 20 * 3600000)) }], proximaTroca: 2 });
  return e;
}
