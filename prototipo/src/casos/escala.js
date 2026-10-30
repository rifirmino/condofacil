import { atribuicoesIniciais } from '../escala/dados.js';
import { gerarTurnos, buracos, feriadosDoMes, sugestoesCobertura, plantaoAgora, descansoInsuficiente, horaLocal, fmtTurno, alertasEscala, relatorioHoras, inicioDaSemana, semanaDaEscala, semanasComEscala } from '../escala/regras.js';
import { gerarEscala, publicarEscala, proporTroca, aceitarTroca, recusarTroca, aprovarTroca, registrarFalta, atribuirCobertura, fazerCheckin, fazerCheckout } from '../escala/acoes.js';
import { colaboradores, porteirosDe, porteiroPorId } from '../escala/regras.js';
import { salvarColaborador, alternarAtivo, escalaDoColaborador, textoEscala } from '../escala/colaboradores.js';
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

function tiposDe(semana, porteiro) {
  return semana.linhas.find((l) => l.porteiro === porteiro).celulas.map((c) => c.map((x) => x.tipo + (x.trocado ? '↔' : '')).join('+'));
}

export const CASOS_ESCALA = [
  {
    nome: 'escala: semana por porteiro',
    rodar() {
      igual([inicioDaSemana('2026-10-19'), inicioDaSemana('2026-10-25'), inicioDaSemana('2026-11-01')], ['2026-10-19', '2026-10-19', '2026-10-26']);
      const e = dadosIniciais(AGORA_FASE2);
      const s = semanaDaEscala(e, '2026-10-19');
      igual(s.dias[0], '2026-10-19');
      igual(tiposDe(s, 'jose').slice(0, 2), ['dia', 'folga']);
      igual(tiposDe(s, 'edson')[0], 'noite');
      igual(tiposDe(s, 'rita').slice(0, 4), ['ferias', 'ferias', 'ferias', 'noite']);
      igual(tiposDe(s, 'claudia').slice(0, 2), ['manha', 'atestado']);
      igual(tiposDe(s, 'bruno').slice(0, 2), ['folga', 'tarde']);
      igual(s.descobertos[1].map((b) => [b.posto, b.inicio.slice(11), b.fim.slice(11)]).some(([p, i]) => p === 'portaria' && i === '19:00'), true);
      igual(s.descobertos[1].some((b) => b.posto === 'guarita' && b.inicio.endsWith('07:00')), true);
      const r = aprovarTroca(e, 'TR-001', 'sindico').estado;
      const turno = e.escala.trocas[0].turno;
      const dia = turno.slice(2, 12);
      const sr = semanaDaEscala(r, inicioDaSemana(dia));
      const i = sr.dias.indexOf(dia);
      igual([tiposDe(sr, 'paulo')[i].endsWith('↔'), tiposDe(sr, 'marcos')[i]], [true, 'folga']);
      const nov = semanaDaEscala(e, '2026-10-26');
      igual(tiposDe(nov, 'jose').slice(-1), ['semEscala']);
      igual(semanasComEscala(e)[0], '2026-09-28');
    },
  },
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
      igual([m.situacao, e.versao, e.escala.meses['2026-11']], ['publicada', 11, undefined]);
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
  {
    nome: 'colaboradores: cadastro com vínculo, escala fixa e desligamento',
    rodar() {
      const novo = { origem: 'novo', plano: 'intermediario', condominio: { nome: 'Edifício Teste' }, escala: { atribuicoes: [], ferias: [], trocas: [], meses: {}, proximaTroca: 1 } };
      igual([colaboradores(novo), porteirosDe(estadoEscala()).length, colaboradores(estadoEscala()).length, porteiroPorId(estadoEscala(), 'paulo').cargo], [[], 7, 8, 'folguista']);
      const base = { nome: 'João Lima', cargo: 'porteiro', vinculo: 'clt', telefone: '(11) 91234-5678', postos: ['portaria'], escala: { posto: 'portaria', modelo: '12x36', inicio: '7', primeiroDia: '2026-11-01' } };
      igual([
        salvarColaborador(novo, base, 'morador').erro,
        salvarColaborador(novo, { ...base, nome: ' ' }, 'sindico').erro,
        salvarColaborador(novo, { ...base, vinculo: 'terceirizado' }, 'sindico').erro,
        salvarColaborador(novo, { ...base, postos: [] }, 'sindico').erro,
        salvarColaborador(novo, { ...base, escala: { ...base.escala, posto: 'guarita' } }, 'sindico').erro,
        salvarColaborador(novo, { ...base, escala: { ...base.escala, primeiroDia: '' } }, 'sindico').erro,
        salvarColaborador(novo, { ...base, telefone: '1199' }, 'sindico').erro,
      ], ['Somente o síndico pode fazer isso', 'Informe o nome', 'Informe a empresa do terceirizado', 'Marque ao menos um posto em que ele trabalha', 'O posto da escala precisa estar entre os postos do colaborador', 'Informe o dia do primeiro plantão', 'Telefone inválido: use DDD + número']);
      const r = salvarColaborador(novo, base, 'sindico');
      igual([r.id, escalaDoColaborador(r.estado, r.id), textoEscala(escalaDoColaborador(r.estado, r.id))], ['col-joao-lima', { porteiro: 'col-joao-lima', posto: 'portaria', modelo: '12x36', inicio: 7, ancora: '2026-11-01', paridade: 0 }, 'Portaria principal · 12x36 · 7h–19h · dia sim, dia não']);
      const nov = gerarEscala(r.estado, '2026-11', 'sindico').estado.escala.meses['2026-11'].turnos;
      igual([nov.length, nov[0].porteiro, nov[0].inicio, nov[1].inicio], [15, 'col-joao-lima', '2026-11-01T07:00', '2026-11-03T07:00']);
      // Terceirizado no 6x1 e zelador sem posto; editar troca a escala sem duplicar.
      const rita = salvarColaborador(r.estado, { nome: 'Rita Alves', cargo: 'porteiro', vinculo: 'terceirizado', empresa: 'Prisma', postos: ['guarita'], escala: { posto: 'guarita', modelo: '6x1', inicio: '15', folga: '0' } }, 'sindico');
      const ze = salvarColaborador(rita.estado, { nome: 'Zé', cargo: 'zelador', vinculo: 'clt', postos: ['portaria'], escala: base.escala }, 'sindico');
      igual([textoEscala(escalaDoColaborador(ze.estado, rita.id)), ze.estado.colaboradores.find((p) => p.id === ze.id).postos, escalaDoColaborador(ze.estado, ze.id), porteirosDe(ze.estado).length], ['Guarita da garagem · 6x1 (8 h) · 15h–23h · folga domingo', [], null, 2]);
      const editado = salvarColaborador(ze.estado, { ...base, id: r.id, escala: { ...base.escala, inicio: '19', modelo: 'noturno' } }, 'sindico').estado;
      igual([editado.escala.atribuicoes.filter((a) => a.porteiro === r.id).length, escalaDoColaborador(editado, r.id).inicio, editado.colaboradores.length], [1, 19, 3]);
      const fora = alternarAtivo(editado, r.id, 'sindico');
      igual([fora.ativo, escalaDoColaborador(fora.estado, r.id), porteirosDe(fora.estado).length, porteiroPorId(fora.estado, r.id).nome, alternarAtivo(fora.estado, r.id, 'sindico').ativo], [false, null, 1, 'João Lima', true]);
    },
  },
];
