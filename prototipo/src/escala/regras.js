import { POSTOS, PORTEIROS, MODELOS, FERIADOS, NOMES_MOTIVO } from './dados.js';
import { isoDia, deIso, somarDias, somarMes, diferencaDias, diasDoMes, nomeMes, fmtDataCurta } from '../datas.js';

// Turnos com horas locais "AAAA-MM-DDTHH:MM": comparáveis como texto e sem fuso.
const DESCANSO_MINIMO = 11;
const HORA_MS_ESCALA = 3600000;

function dois(n) {
  return String(n).padStart(2, '0');
}

function modulo(n, m) {
  return ((n % m) + m) % m;
}

export function horaLocal(dia, h) {
  return `${somarDias(dia, Math.floor(h / 24))}T${dois(h % 24)}:00`;
}

export function instanteLocal(agora) {
  return `${isoDia(agora)}T${dois(agora.getHours())}:${dois(agora.getMinutes())}`;
}

export function horasEntreLocal(a, b) {
  return (new Date(b) - new Date(a)) / HORA_MS_ESCALA;
}

export function mesAtual(agora) {
  return isoDia(agora).slice(0, 7);
}

export function porteiroPorId(id) {
  return PORTEIROS.find((p) => p.id === id);
}

function trabalha(a, dia) {
  if (MODELOS[a.modelo].ciclo === 2) return modulo(diferencaDias(dia, a.ancora), 2) === a.paridade;
  return deIso(dia).getDay() !== a.folga;
}

export function deFerias(escala, porteiro, dia) {
  return escala.ferias.some((f) => f.porteiro === porteiro && dia >= f.de && dia <= f.ate);
}

export function gerarTurnos(escala, mes) {
  const turnos = [];
  for (const a of escala.atribuicoes) {
    for (const dia of diasDoMes(mes)) {
      if (!trabalha(a, dia)) continue;
      const ferias = deFerias(escala, a.porteiro, dia);
      turnos.push({ id: `T-${dia}-${a.posto}-${dois(a.inicio)}`, posto: a.posto, porteiro: ferias ? null : a.porteiro, inicio: horaLocal(dia, a.inicio), fim: horaLocal(dia, a.inicio + MODELOS[a.modelo].horas), motivoDescoberto: ferias ? 'ferias' : null, porteiroOriginal: ferias ? a.porteiro : null, anexo: null, trocado: false, checkin: null, checkout: null });
    }
  }
  return turnos.sort((x, y) => x.inicio.localeCompare(y.inicio) || x.posto.localeCompare(y.posto));
}

export function todosTurnos(estado) {
  return Object.values(estado.escala.meses).flatMap((m) => m.turnos);
}

export function acharTurno(estado, id) {
  return todosTurnos(estado).find((t) => t.id === id);
}

export function turnosComVespera(estado, mes) {
  const anterior = somarMes(mes, -1);
  const ultimo = somarDias(`${mes}-01`, -1);
  const guardado = estado.escala.meses[anterior];
  const vespera = (guardado ? guardado.turnos : gerarTurnos(estado.escala, anterior)).filter((t) => t.inicio.startsWith(ultimo));
  return [...vespera, ...(estado.escala.meses[mes] ? estado.escala.meses[mes].turnos : [])];
}

export function buracos(estado, mes, posto) {
  const turnos = turnosComVespera(estado, mes).filter((t) => t.posto === posto && t.porteiro);
  const p = POSTOS[posto];
  const lista = [];
  let aberto = null;
  for (const dia of diasDoMes(mes)) {
    for (let h = 0; h < 24; h++) {
      const hora = horaLocal(dia, h);
      const dentro = h >= p.abre && h < p.fecha;
      if (dentro && !turnos.some((t) => t.inicio <= hora && hora < t.fim)) {
        if (aberto) aberto.fim = horaLocal(dia, h + 1);
        else aberto = { inicio: hora, fim: horaLocal(dia, h + 1) };
      } else if (aberto) {
        lista.push(aberto);
        aberto = null;
      }
    }
  }
  if (aberto) lista.push(aberto);
  return lista;
}

export function feriadosDoMes(mes) {
  return diasDoMes(mes).filter((d) => FERIADOS[d.slice(5)]).map((d) => ({ dia: d, nome: FERIADOS[d.slice(5)] }));
}

function sobrepoeTurno(a, b) {
  return a.inicio < b.fim && b.inicio < a.fim;
}

export function conflita(estado, porteiro, turno) {
  return todosTurnos(estado).some((t) => t.id !== turno.id && t.porteiro === porteiro && sobrepoeTurno(t, turno));
}

export function menorDescanso(estado, porteiro, turno) {
  const outros = todosTurnos(estado).filter((t) => t.id !== turno.id && t.porteiro === porteiro && !sobrepoeTurno(t, turno));
  return outros.reduce((menor, t) => Math.min(menor, t.fim <= turno.inicio ? horasEntreLocal(t.fim, turno.inicio) : horasEntreLocal(turno.fim, t.inicio)), Infinity);
}

export function descansoInsuficiente(estado, mes) {
  const lista = [];
  for (const p of PORTEIROS) {
    const meus = todosTurnos(estado).filter((t) => t.porteiro === p.id).sort((a, b) => a.inicio.localeCompare(b.inicio));
    for (let i = 1; i < meus.length; i++) {
      const horas = horasEntreLocal(meus[i - 1].fim, meus[i].inicio);
      if (horas < DESCANSO_MINIMO && meus[i].inicio.startsWith(mes)) lista.push({ porteiro: p.id, anterior: meus[i - 1].id, proximo: meus[i].id, horas });
    }
  }
  return lista;
}

export function sugestoesCobertura(estado, turnoId) {
  const t = acharTurno(estado, turnoId);
  const folguista = (id) => (porteiroPorId(id).vinculo === 'folguista' ? 1 : 0);
  return PORTEIROS
    .filter((p) => p.postos.includes(t.posto) && p.id !== t.porteiroOriginal && !deFerias(estado.escala, p.id, t.inicio.slice(0, 10)) && !conflita(estado, p.id, t))
    .map((p) => {
      const descanso = menorDescanso(estado, p.id, t);
      return { porteiro: p.id, descanso, alerta11: descanso < DESCANSO_MINIMO };
    })
    .sort((a, b) => folguista(b.porteiro) - folguista(a.porteiro) || (b.descanso - a.descanso) || 0);
}

export function plantaoAgora(estado, agora) {
  const atual = instanteLocal(agora);
  const seguinte = estado.escala.meses[somarMes(mesAtual(agora), 1)];
  const turnos = [...turnosComVespera(estado, mesAtual(agora)), ...(seguinte ? seguinte.turnos : [])];
  return Object.fromEntries(Object.keys(POSTOS).map((posto) => {
    const doPosto = turnos.filter((t) => t.posto === posto).sort((a, b) => a.inicio.localeCompare(b.inicio));
    return [posto, { atual: doPosto.find((t) => t.inicio <= atual && atual < t.fim) || null, proximo: doPosto.find((t) => t.inicio > atual) || null }];
  }));
}

export function turnosDoPorteiro(estado, porteiro, agora) {
  const atual = instanteLocal(agora);
  return todosTurnos(estado).filter((t) => t.porteiro === porteiro && t.fim > atual).sort((a, b) => a.inicio.localeCompare(b.inicio));
}

export function fmtTurno(t) {
  return `${fmtDataCurta(t.inicio.slice(0, 10)).slice(0, 5)} ${Number(t.inicio.slice(11, 13))}h–${Number(t.fim.slice(11, 13))}h`;
}

export function relatorioHoras(estado, mes) {
  const doMes = estado.escala.meses[mes] ? estado.escala.meses[mes].turnos : [];
  const horas = (t) => horasEntreLocal(t.inicio, t.fim);
  return PORTEIROS.map((p) => {
    const meus = doMes.filter((t) => t.porteiro === p.id);
    return {
      porteiro: p.id,
      escaladas: meus.reduce((s, t) => s + horas(t), 0),
      comCheckin: meus.filter((t) => t.checkin && t.checkout).reduce((s, t) => s + horas(t), 0),
      atrasos: meus.filter((t) => t.checkin && t.checkin.atrasoMin > 0).length,
      faltas: doMes.filter((t) => t.porteiroOriginal === p.id && ['falta', 'atestado'].includes(t.motivoDescoberto)).length,
      trocas: estado.escala.trocas.filter((x) => x.situacao === 'aprovada' && x.turno.startsWith(`T-${mes}`) && (x.de === p.id || x.para === p.id)).length,
    };
  });
}

export function nomeDoMesEscala(mes) {
  return nomeMes(mes).split(' de ')[0];
}

export function alertasEscala(estado, agora) {
  const itens = [];
  const proximo = somarMes(mesAtual(agora), 1);
  const m = estado.escala.meses[proximo];
  if (!m) itens.push({ chave: 'esc-gerar', texto: `Gerar a escala de ${nomeDoMesEscala(proximo)}`, href: '#sindico.escala' });
  else if (m.situacao === 'rascunho') itens.push({ chave: 'esc-publicar', texto: `Escala de ${nomeDoMesEscala(proximo)} em rascunho: publicar`, href: '#sindico.escala' });
  for (const x of estado.escala.trocas.filter((t) => t.situacao === 'aceita')) {
    itens.push({ chave: `troca-${x.id}`, texto: `Troca aguardando aprovação: ${porteiroPorId(x.de).nome} → ${porteiroPorId(x.para).nome}, ${fmtTurno(acharTurno(estado, x.turno)).split('–')[0]}`, href: '#sindico.escala.pendencias' });
  }
  const atual = instanteLocal(agora);
  const limite = instanteLocal(new Date(agora.getTime() + 7 * 24 * HORA_MS_ESCALA));
  for (const t of todosTurnos(estado).filter((x) => !x.porteiro && x.fim > atual && x.inicio < limite).sort((a, b) => a.inicio.localeCompare(b.inicio))) {
    itens.push({ chave: `desc-${t.id}`, texto: `Turno descoberto: ${POSTOS[t.posto].nome} ${fmtTurno(t)} · ${NOMES_MOTIVO[t.motivoDescoberto] || 'sem porteiro'}${t.porteiroOriginal ? ` de ${porteiroPorId(t.porteiroOriginal).nome}` : ''}`, href: '#sindico.escala.pendencias' });
  }
  return itens;
}
