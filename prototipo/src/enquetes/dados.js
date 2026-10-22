import { somarDias, momento } from '../datas.js';

// Enquetes iniciais: uma aberta (a Ana ainda não votou), uma encerrada com peso e quórum e um rascunho.
const VOTOS_ACADEMIA = [['101', 'o2'], ['103', 'o1'], ['104', 'o2', 'Domingo cedo é quando consigo treinar'], ['201', 'o2'], ['202', 'o3'], ['204', 'o1'], ['301', 'o2'], ['303', 'o3', 'Às 6h o barulho incomoda quem mora em cima'], ['401', 'o2'], ['403', 'o1'], ['501', 'o2'], ['601', 'o1'], ['603', 'o3'], ['702', 'o2']];
const VOTOS_FACHADA = [['101', 'c1'], ['102', 'c2'], ['104', 'c1'], ['201', 'c1'], ['203', 'c3'], ['204', 'c2'], ['301', 'c1'], ['302', 'c2'], ['303', 'c1'], ['401', 'c2'], ['402', 'c1'], ['404', 'c3'], ['501', 'c1'], ['502', 'c2'], ['504', 'c1'], ['601', 'c2'], ['603', 'c1'], ['702', 'c1'], ['703', 'c3'], ['801', 'c1'], ['802', 'c2'], ['804', 'c1']];

export const DOC_RESULTADO_FACHADA = 'd9';

function votosDe(lista, em, dias, nomes) {
  return Object.fromEntries(lista.map(([unidade, opcao, comentario], n) => [unidade, { opcoes: [opcao], comentario: comentario || '', autor: nomes[unidade] || `Apto ${unidade}`, em: em(-(dias - (n % dias)), 10 + (n % 10)) }]));
}

export function enquetesIniciais(hoje, em, nomes = {}) {
  const base = { contexto: '', anexo: null, comentarios: false, publico: { tipo: 'todos' }, secreto: true, parcialVisivel: false, peso: 'unidade', quorumPct: null, lembretesAuto: true, lembretes: [], prorrogada: false, encerradaEm: null, resultado: null, maxEscolhas: 1, tipo: 'unica' };
  return [
    {
      ...base, id: 'EN-001', pergunta: 'Qual horário a academia deve abrir aos domingos?', contexto: 'Hoje a academia abre às 6h todos os dias. Alguns moradores pediram para abrir mais tarde aos domingos por causa do barulho.',
      opcoes: [{ id: 'o1', texto: 'Às 6h, como hoje' }, { id: 'o2', texto: 'Às 7h' }, { id: 'o3', texto: 'Às 8h' }],
      comentarios: true, criadaEm: em(-4, 18), abertaEm: em(-3, 9), encerraEm: momento(somarDias(hoje, 4), 23, 59).toISOString(), situacao: 'aberta',
      votos: votosDe(VOTOS_ACADEMIA, em, 3, nomes),
    },
    {
      ...base, id: 'EN-002', pergunta: 'Qual cor para a pintura da fachada?', contexto: 'A pintura foi aprovada na AGE. Faltava escolher a cor entre as três propostas da construtora.',
      opcoes: [{ id: 'c1', texto: 'Cinza claro' }, { id: 'c2', texto: 'Areia' }, { id: 'c3', texto: 'Terracota' }],
      peso: 'fracao', quorumPct: 50, criadaEm: em(-21, 18), abertaEm: em(-20, 9), encerraEm: momento(somarDias(hoje, -6), 23, 59).toISOString(), situacao: 'encerrada', encerradaEm: momento(somarDias(hoje, -6), 23, 59).toISOString(),
      votos: Object.fromEntries(VOTOS_FACHADA.map(([unidade, opcao], n) => [unidade, { opcoes: [opcao], comentario: '', autor: nomes[unidade] || `Apto ${unidade}`, em: em(-(20 - (n % 14)), 10) }])),
      lembretes: [{ em: em(-9, 9), unidades: 14, automatico: true }, { em: em(-6, 9), unidades: 10, automatico: true }],
      resultado: { publicadoEm: em(-5, 10), comunicado: null, documento: DOC_RESULTADO_FACHADA },
    },
    {
      ...base, id: 'EN-003', pergunta: 'Instalar bicicletário na garagem?', contexto: 'Orçamento de R$ 4.800,00 para 12 vagas no subsolo.',
      opcoes: [{ id: 'b1', texto: 'Sim' }, { id: 'b2', texto: 'Não' }],
      criadaEm: em(-1, 20), abertaEm: null, encerraEm: momento(somarDias(hoje, 10), 23, 59).toISOString(), situacao: 'rascunho', votos: {},
    },
  ];
}
