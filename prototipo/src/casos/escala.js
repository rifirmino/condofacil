import { atribuicoesIniciais } from '../escala/dados.js';
import { gerarTurnos, buracos, feriadosDoMes, sugestoesCobertura, plantaoAgora, descansoInsuficiente, horaLocal, fmtTurno, alertasEscala, relatorioHoras } from '../escala/regras.js';
import { gerarEscala, publicarEscala, proporTroca, aceitarTroca, recusarTroca, aprovarTroca, registrarFalta, atribuirCobertura, fazerCheckin, fazerCheckout } from '../escala/acoes.js';
import { dadosIniciais } from '../dados.js';
import { liberado } from '../planos.js';
import { igual, AGORA_FASE2 } from './afirmar.js';

function escalaBase() {
  return { atribuicoes: atribuicoesIniciais('2026-10'), ferias: [{ porteiro: 'rita', de: '2026-10-12', ate: '2026-10-21' }], trocas: [], meses: {}, proximaTroca: 1 };
}

function estadoEscala() {
  const escala = escalaBase();
  escala.meses['2026-10'] = { situacao: 'publicada', publicadaEm: '2026-09-25T18:00', turnos: gerarTurnos(escala, '2026-10') };
  return { plano: 'intermediario', escala };
}

function doDia(e, dia, posto) {
  return e.escala.meses['2026-10'].turnos.filter((t) => t.inicio.startsWith(dia) && t.posto === posto).map((t) => [t.porteiro, t.inicio.slice(11), t.fim]);
}

export const CASOS_ESCALA = [
  {
    nome: 'escala: geração de 12x36, noturno e 6x1',
    rodar() {
      const e = estadoEscala();
      igual([horaLocal('2026-10-19', 7), horaLocal('2026-10-19', 31)], ['2026-10-19T07:00', '2026-10-20T07:00']);
      igual(doDia(e, '2026-10-19', 'portaria'), [['jose', '07:00', '2026-10-19T19:00'], ['edson', '19:00', '2026-10-20T07:00']]);
      igual(doDia(e, '2026-10-20', 'portaria'), [['marcos', '07:00', '2026-10-20T19:00'], [null, '19:00', '2026-10-21T07:00']]);
      igual(doDia(e, '2026-10-18', 'guarita'), [['bruno', '15:00', '2026-10-18T23:00']]);
      igual(doDia(e, '2026-10-19', 'guarita'), [['claudia', '07:00', '2026-10-19T15:00']]);
      igual(e.escala.meses['2026-10'].turnos.find((t) => t.inicio === '2026-10-20T19:00').motivoDescoberto, 'ferias');
    },
  },
  {
    nome: 'escala: buracos de cobertura e feriados',
    rodar() {
      const e = estadoEscala();
      igual(buracos(e, '2026-10', 'portaria').map((b) => b.inicio), ['2026-10-12T19:00', '2026-10-14T19:00', '2026-10-16T19:00', '2026-10-18T19:00', '2026-10-20T19:00']);
      igual(buracos(e, '2026-10', 'portaria')[0].fim, '2026-10-13T07:00');
      const g = buracos(e, '2026-10', 'guarita');
      igual([g.length, g[0], g[1]], [8, { inicio: '2026-10-04T07:00', fim: '2026-10-04T15:00' }, { inicio: '2026-10-05T15:00', fim: '2026-10-05T22:00' }]);
      igual(feriadosDoMes('2026-10'), [{ dia: '2026-10-12', nome: 'Nossa Senhora Aparecida' }]);
      igual(descansoInsuficiente(e, '2026-10'), []);
    },
  },
  {
    nome: 'escala: plantão agora, sugestões e formato do turno',
    rodar() {
      const e = estadoEscala();
      const p = plantaoAgora(e, AGORA_FASE2);
      igual([p.portaria.atual.porteiro, p.portaria.proximo.porteiro, p.portaria.proximo.inicio, p.guarita.atual.porteiro, p.guarita.proximo.inicio], ['jose', 'edson', '2026-10-19T19:00', 'claudia', '2026-10-20T07:00']);
      const s = sugestoesCobertura(e, 'T-2026-10-20-portaria-19');
      igual(s.map((x) => [x.porteiro, x.alerta11]), [['paulo', false], ['edson', false], ['jose', true], ['marcos', true]]);
      igual(fmtTurno(e.escala.meses['2026-10'].turnos.find((t) => t.id === 'T-2026-10-20-portaria-19')), '20/10 19h–7h');
      igual([liberado('basico', 'escala'), liberado('intermediario', 'escala'), liberado('intermediario', 'checkin'), liberado('avancado', 'relatorioHoras')], [false, true, false, true]);
    },
  },
  {
    nome: 'escala: seed com publicação, check-ins, atestado e troca',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      const m = e.escala.meses['2026-10'];
      igual([m.situacao, e.versao, e.escala.meses['2026-11']], ['publicada', 6, undefined]);
      const at = m.turnos.find((x) => x.id === 'T-2026-10-20-guarita-07');
      igual([at.porteiro, at.motivoDescoberto, at.porteiroOriginal, at.anexo], [null, 'atestado', 'claudia', 'atestado-claudia.pdf']);
      igual(e.escala.trocas.map((x) => [x.id, x.turno, x.de, x.para, x.situacao]), [['TR-001', 'T-2026-10-22-portaria-07', 'marcos', 'paulo', 'aceita']]);
      igual(m.turnos.find((x) => x.id === 'T-2026-10-02-portaria-07').checkin, { em: '2026-10-02T07:15', atrasoMin: 15 });
      igual(m.turnos.find((x) => x.id === 'T-2026-10-19-portaria-07').checkin, null);
      igual(buracos(e, '2026-10', 'guarita').length, 9);
      igual(alertasEscala(e, AGORA_FASE2).map((a) => a.texto), [
        'Gerar a escala de novembro',
        'Troca aguardando aprovação: Marcos → Paulo, 22/10 7h',
        'Turno descoberto: Guarita da garagem 20/10 7h–15h · atestado de Cláudia',
        'Turno descoberto: Portaria principal 20/10 19h–7h · férias de Rita',
      ]);
      const h = relatorioHoras(e, '2026-10');
      igual(h.find((x) => x.porteiro === 'jose'), { porteiro: 'jose', escaladas: 192, comCheckin: 108, atrasos: 0, faltas: 0, trocas: 0 });
      igual([h.find((x) => x.porteiro === 'marcos').atrasos, h.find((x) => x.porteiro === 'claudia').faltas, h.find((x) => x.porteiro === 'claudia').escaladas], [1, 1, 208]);
    },
  },
  {
    nome: 'escala: troca em três passos',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      igual(proporTroca(e, { turnoId: '', de: 'marcos', para: 'paulo' }, 'portaria', AGORA_FASE2).erro, 'Escolha o turno e o colega');
      igual(proporTroca(e, { turnoId: 'T-2026-10-24-portaria-07', de: 'jose', para: 'paulo' }, 'portaria', AGORA_FASE2).erro, 'Só o porteiro do turno pode propor a troca');
      igual(proporTroca(e, { turnoId: 'T-2026-10-24-portaria-07', de: 'marcos', para: 'bruno' }, 'portaria', AGORA_FASE2).erro, 'Este colega já tem turno nesse horário');
      const p = proporTroca(e, { turnoId: 'T-2026-10-24-portaria-07', de: 'marcos', para: 'paulo' }, 'portaria', AGORA_FASE2);
      igual([p.id, p.notificacao.para], ['TR-002', 'Paulo']);
      igual(aceitarTroca(p.estado, 'TR-002', 'jose').erro, 'Só o colega convidado pode aceitar');
      const a = aceitarTroca(p.estado, 'TR-002', 'paulo');
      igual(aprovarTroca(a.estado, 'TR-002', 'portaria').erro, 'Somente o síndico pode fazer isso');
      const r = aprovarTroca(a.estado, 'TR-002', 'sindico');
      const t = r.estado.escala.meses['2026-10'].turnos.find((x) => x.id === 'T-2026-10-24-portaria-07');
      igual([t.porteiro, t.trocado, r.notificacao.para], ['paulo', true, 'Marcos e Paulo']);
      igual(relatorioHoras(r.estado, '2026-10').find((x) => x.porteiro === 'paulo').trocas, 1);
      igual(recusarTroca(e, 'TR-001', 'paulo', 'portaria').estado.escala.trocas[0].situacao, 'recusada');
    },
  },
  {
    nome: 'escala: falta, aviso à terceirizada e cobertura com alerta',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      igual(registrarFalta(e, 'T-2026-10-21-portaria-19', { quem: 'edson', motivo: '' }, 'portaria').erro, 'Escolha o turno e o motivo');
      igual(registrarFalta(e, 'T-2026-10-21-portaria-19', { quem: 'jose', motivo: 'falta' }, 'portaria').erro, 'Só o porteiro do turno pode registrar a falta');
      const f = registrarFalta(e, 'T-2026-10-21-portaria-19', { quem: 'edson', motivo: 'atestado', anexo: 'atestado-edson.pdf' }, 'portaria');
      igual([f.notificacao.para, f.notificacao.texto], ['Vigilância Prisma', 'Vigilância Prisma: turno descoberto na Portaria principal 21/10 19h']);
      igual(sugestoesCobertura(f.estado, 'T-2026-10-21-portaria-19')[0].porteiro, 'paulo');
      igual(atribuirCobertura(f.estado, 'T-2026-10-21-portaria-19', 'paulo', 'portaria').erro, 'Somente o síndico pode fazer isso');
      const c = atribuirCobertura(f.estado, 'T-2026-10-21-portaria-19', 'paulo', 'sindico');
      const t = c.estado.escala.meses['2026-10'].turnos.find((x) => x.id === 'T-2026-10-21-portaria-19');
      igual([t.porteiro, t.porteiroOriginal, c.alerta], ['paulo', 'edson', undefined]);
      igual(atribuirCobertura(f.estado, 'T-2026-10-21-portaria-19', 'jose', 'sindico').alerta, 'Menos de 11 h de descanso para Seu José');
    },
  },
  {
    nome: 'escala: gerar e publicar o mês seguinte',
    rodar() {
      const e = dadosIniciais(AGORA_FASE2);
      igual(publicarEscala(e, '2026-11', 'sindico', AGORA_FASE2).erro, 'Gere a escala antes de publicar');
      igual(gerarEscala(e, '2026-11', 'portaria').erro, 'Somente o síndico pode fazer isso');
      igual(gerarEscala({ ...e, plano: 'basico' }, '2026-11', 'sindico').erro, 'Disponível no plano Intermediário');
      const g = gerarEscala(e, '2026-11', 'sindico');
      igual([g.estado.escala.meses['2026-11'].situacao, gerarEscala(g.estado, '2026-11', 'sindico').erro], ['rascunho', 'A escala de novembro já foi gerada']);
      igual(alertasEscala(g.estado, AGORA_FASE2)[0].texto, 'Escala de novembro em rascunho: publicar');
      const p = publicarEscala(g.estado, '2026-11', 'sindico', AGORA_FASE2);
      igual([p.estado.escala.meses['2026-11'].situacao, p.notificacao.texto], ['publicada', 'Escala de novembro publicada: 6 porteiros avisados']);
      igual(publicarEscala(p.estado, '2026-11', 'sindico', AGORA_FASE2).erro, 'Escala já publicada');
      igual(feriadosDoMes('2026-11').map((x) => x.dia), ['2026-11-02', '2026-11-15', '2026-11-20']);
      igual(buracos(p.estado, '2026-11', 'portaria'), []);
    },
  },
  {
    nome: 'escala: check-in e check-out no Avançado',
    rodar() {
      const e = { ...dadosIniciais(AGORA_FASE2), plano: 'avancado' };
      igual(fazerCheckin(dadosIniciais(AGORA_FASE2), 'jose', AGORA_FASE2).erro, 'Disponível no plano Avançado');
      igual(fazerCheckin(e, 'marcos', AGORA_FASE2).erro, 'Não há turno seu agora para fazer check-in');
      igual(fazerCheckout(e, 'jose', AGORA_FASE2).erro, 'Faça o check-in antes do check-out');
      const turno = (est) => est.escala.meses['2026-10'].turnos.find((x) => x.id === 'T-2026-10-19-portaria-07');
      igual(turno(fazerCheckin(e, 'jose', new Date(2026, 9, 19, 7, 5)).estado).checkin, { em: '2026-10-19T07:05', atrasoMin: 0 });
      const tarde = fazerCheckin(e, 'jose', new Date(2026, 9, 19, 7, 18));
      igual(turno(tarde.estado).checkin.atrasoMin, 18);
      igual(turno(fazerCheckout(tarde.estado, 'jose', new Date(2026, 9, 19, 19, 2)).estado).checkout, { em: '2026-10-19T19:02' });
    },
  },
];
