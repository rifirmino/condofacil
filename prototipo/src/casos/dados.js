import { dadosIniciais, UNIDADES, UNIDADE_ANA } from '../dados.js';
import { igual, AGORA_TESTE } from './afirmar.js';

export const CASOS_DADOS = [
  {
    nome: 'dados: 32 unidades de 101 a 804',
    rodar() {
      igual(UNIDADES.length, 32);
      igual([UNIDADES[0], UNIDADES[9], UNIDADES[31]], ['101', '302', '804']);
    },
  },
  {
    nome: 'dados: 20 unidades com morador e 1 proprietário não residente',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual(new Set(e.pessoas.filter((p) => !p.naoResidente).map((p) => p.unidade)).size, 20);
      igual(e.pessoas.filter((p) => p.naoResidente).map((p) => [p.unidade, p.nome, p.recebeOfertas, p.vendedor]), [['704', 'Vicente Moraes', false, 'nao']]);
      igual([e.versao, e.pessoas.find((p) => p.unidade === UNIDADE_ANA).nome], [6, 'Ana Souza']);
    },
  },
  {
    nome: 'dados: 3 reservas confirmadas, 1 pendente e 1 bloqueio',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual(e.reservas.filter((r) => r.status === 'confirmada').length, 3);
      igual(e.reservas.filter((r) => r.status === 'pendente').length, 1);
      igual(e.bloqueios.length, 1);
    },
  },
  {
    nome: 'dados: 4 encomendas aguardando, 2 da Ana',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      const aguardando = e.encomendas.filter((x) => x.status === 'aguardando');
      igual(aguardando.length, 4);
      igual(aguardando.filter((x) => x.unidade === UNIDADE_ANA).length, 2);
      igual(e.encomendas.length, 7);
    },
  },
  {
    nome: 'dados: 5 comunicados, 7 ocorrências e 8 documentos',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual([e.comunicados.length, e.ocorrencias.length, e.documentos.length], [5, 7, 8]);
      igual(e.proximoProtocolo, 44);
    },
  },
  {
    nome: 'dados: datas relativas ao dia de hoje',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual(e.geradoEm, '2026-10-08');
      igual(e.reservas.find((r) => r.id === 'r4').data, '2026-10-18');
      igual(e.documentos.find((d) => d.id === 'd6').vencimento, '2026-11-02');
    },
  },
  {
    nome: 'dados: aviso de falta de água lido por 19 unidades, mas não pela Ana',
    rodar() {
      const c1 = dadosIniciais(AGORA_TESTE).comunicados.find((c) => c.id === 'c1');
      igual(c1.leituras.length, 19);
      igual(c1.leituras.includes(UNIDADE_ANA), false);
      igual(c1.fixado, true);
    },
  },
];
