import { atribuicoesIniciais } from '../escala/dados.js';
import { gerarTurnos, buracos, feriadosDoMes, sugestoesCobertura, plantaoAgora, descansoInsuficiente, horaLocal, fmtTurno } from '../escala/regras.js';
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
];
