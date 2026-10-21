import { isoDia, somarDias, momento, fmtDia } from './datas.js';
import { vendasIniciais, perfilVenda } from './vendas/dados.js';
import { financeiroInicial } from './cobranca/dados.js';
import { manutencaoInicial } from './manutencao/dados.js';
import { comAcordoInicial } from './cobranca/acordos.js';
import { comEscalaInicial } from './escala/acoes.js';
import { comInfracaoInicial } from './infracoes/acoes.js';

export const UNIDADES = Array.from({ length: 32 }, (_, i) => `${Math.floor(i / 4) + 1}0${(i % 4) + 1}`);
export const UNIDADE_ANA = '302';
export const SINDICO = 'Síndico Roberto Lima';
export const PORTEIRO_DIA = 'Seu José';

export const CATEGORIAS = {
  vazamento: { nome: 'Vazamento', tipo: 'manutencao', prioridade: 'urgente' },
  eletrica: { nome: 'Elétrica/iluminação', tipo: 'manutencao', prioridade: 'alta' },
  elevador: { nome: 'Elevador', tipo: 'manutencao', prioridade: 'alta' },
  portao: { nome: 'Portão/garagem', tipo: 'manutencao', prioridade: 'alta' },
  interfone: { nome: 'Interfone', tipo: 'manutencao', prioridade: 'normal' },
  limpeza: { nome: 'Limpeza', tipo: 'manutencao', prioridade: 'normal' },
  piscina: { nome: 'Piscina', tipo: 'manutencao', prioridade: 'normal' },
  outros: { nome: 'Outros', tipo: 'manutencao', prioridade: 'normal' },
  jardim: { nome: 'Jardim', tipo: 'manutencao', prioridade: 'baixa' },
  seguranca: { nome: 'Segurança', tipo: 'irregularidade', prioridade: 'alta' },
  barulho: { nome: 'Barulho', tipo: 'irregularidade', prioridade: 'normal' },
  vaga: { nome: 'Vaga ocupada', tipo: 'irregularidade', prioridade: 'normal' },
  lixo: { nome: 'Lixo fora do lugar', tipo: 'irregularidade', prioridade: 'normal' },
  pet: { nome: 'Pet', tipo: 'irregularidade', prioridade: 'normal' },
  obra: { nome: 'Obra fora do horário', tipo: 'irregularidade', prioridade: 'normal' },
  area_comum: { nome: 'Uso indevido de área comum', tipo: 'irregularidade', prioridade: 'normal' },
  sugestao: { nome: 'Sugestão', tipo: 'outro', prioridade: 'baixa' },
  elogio: { nome: 'Elogio', tipo: 'outro', prioridade: 'baixa' },
};

export const TIPOS_NOTIFICACAO = { manutencao: 'Manutenção', irregularidade: 'Irregularidade', outro: 'Sugestão ou elogio' };
export const PRIORIDADES = { urgente: { nome: 'Urgente', resposta: 1, solucao: 24 }, alta: { nome: 'Alta', resposta: 4, solucao: 72 }, normal: { nome: 'Normal', resposta: 24, solucao: 168 }, baixa: { nome: 'Baixa', resposta: 72, solucao: null } };
export const ORDEM_PRIORIDADE = ['urgente', 'alta', 'normal', 'baixa'];

export const FLUXO_OCORRENCIA = ['aberta', 'em_analise', 'em_andamento', 'resolvida', 'fechada'];
export const NOMES_STATUS = { aberta: 'Recebida', em_analise: 'Em análise', em_andamento: 'Em atendimento', resolvida: 'Resolvida', fechada: 'Fechada' };
export const NOMES_STATUS_RESERVA = { pendente: 'Pendente', confirmada: 'Confirmada', recusada: 'Recusada', cancelada: 'Cancelada' };

export const TIPOS_COMUNICADO = {
  geral: 'Aviso geral',
  manutencao: 'Manutenção',
  evento: 'Festa/evento',
  urgente: 'Urgente',
  assembleia: 'Assembleia',
  obra: 'Obra em unidade',
  falta: 'Falta de água/energia',
};

export const NOMES_CANAL = { push: 'Push', email: 'E-mail', whatsapp: 'WhatsApp', sms: 'SMS' };

export const MODELOS_COMUNICADO = {
  geral: { titulo: 'Aviso aos moradores', texto: 'Prezados moradores,\n\nInformamos que [descreva o aviso].\n\nAtenciosamente,\nRoberto Lima, síndico' },
  manutencao: { titulo: 'Manutenção programada', texto: 'Prezados moradores,\n\nNo dia [data], das [hora] às [hora], haverá manutenção em [equipamento ou área]. Durante o serviço, [impacto].\n\nAgradecemos a compreensão.\nRoberto Lima, síndico' },
  evento: { titulo: 'Convite: [nome do evento]', texto: 'Convidamos todos para [evento], no dia [data], às [hora], no [local].\n\nConfirme sua presença pelo app.\nRoberto Lima, síndico' },
  urgente: { titulo: 'URGENTE: [assunto]', texto: '[Descreva a situação e o que os moradores devem fazer agora.]\n\nRoberto Lima, síndico' },
  assembleia: { titulo: 'Convocação: assembleia [ordinária ou extraordinária]', texto: 'Ficam convocados os condôminos para assembleia no dia [data], às [hora] em primeira chamada e às [hora] em segunda, no salão de festas.\n\nPauta: [itens].\nRoberto Lima, síndico' },
  obra: { titulo: 'Obra na unidade [número]', texto: 'A unidade [número] fará reforma de [data] a [data], de segunda a sexta das 8h às 17h e aos sábados das 8h às 12h, com ART/RRT entregue à administração.' },
  falta: { titulo: 'Falta de [água ou energia]', texto: 'No dia [data], das [hora] às [hora], haverá interrupção no fornecimento de [água ou energia] por [motivo].\n\nRecomendamos [orientação].' },
};

export const TRANSPORTADORAS = ['Correios', 'Mercado Livre', 'Amazon', 'Shopee', 'Outra'];

const MORADORES = [
  ['101', 'Carla Mendes'], ['102', 'Paulo Ribeiro'], ['104', 'Juliana Costa'], ['201', 'Fernando Alves'],
  ['203', 'Beatriz Rocha'], ['204', 'Lucas Martins'], ['301', 'Mariana Teixeira'], ['302', 'Ana Souza'],
  ['303', 'Rafael Gomes'], ['401', 'Patrícia Nunes'], ['402', 'Eduardo Pires'], ['404', 'Camila Duarte'],
  ['501', 'Gustavo Freitas'], ['502', 'Larissa Moura'], ['504', 'Thiago Barros'], ['601', 'Renata Cardoso'],
  ['603', 'Diego Monteiro'], ['702', 'Sônia Araújo'], ['703', 'Marcelo Vieira'], ['801', 'Roberto Lima'],
];

export function dadosIniciais(agora = new Date()) {
  const hoje = isoDia(agora);
  const d = (n) => somarDias(hoje, n);
  const em = (n, hora, minuto = 0) => momento(d(n), hora, minuto).toISOString();
  const leram = (n) => UNIDADES.slice(0, n);
  const leramSemAna = (n) => UNIDADES.filter((u) => u !== UNIDADE_ANA).slice(0, n);
  const periodos = [{ id: 'tarde', nome: 'Tarde', inicio: 13, fim: 18 }, { id: 'noite', nome: 'Noite', inicio: 18, fim: 23 }];
  const canaisPadrao = ['push', 'email', 'whatsapp'];

  const pessoas = [
    ...MORADORES.map(([unidade, nome]) => ({ id: `p${unidade}`, nome, unidade, ...perfilVenda(unidade, em) })),
    { id: 'p704', nome: 'Vicente Moraes', unidade: '704', naoResidente: true, ...perfilVenda('704', em) },
  ];

  return comInfracaoInicial(comEscalaInicial(comAcordoInicial({
    versao: 8,
    geradoEm: hoje,
    proximoProtocolo: 44,
    infracoes: [],
    proximaInfracao: 1,
    condominio: { nome: 'Residencial Ipê Amarelo', unidades: UNIDADES },
    pessoas,
    areas: [
      { id: 'salao', nome: 'Salão de festas', tipo: 'periodo', periodos, taxa: 150, aprovacao: 'manual', antecedenciaMin: 2, antecedenciaMax: 60, limiteMes: 2, vinculadas: ['churrasqueira'], capacidade: 80, itens: '10 mesas, 60 cadeiras, geladeira e fogão', regulamento: 'Som até as 22h. Limpeza por conta do morador. Vistoria na entrada e na saída.' },
      { id: 'churrasqueira', nome: 'Churrasqueira', tipo: 'periodo', periodos, taxa: 50, aprovacao: 'automatica', antecedenciaMin: 1, antecedenciaMax: 60, limiteMes: 2, vinculadas: ['salao'], capacidade: 25, itens: 'Grelha, 4 mesas, 24 cadeiras e pia', regulamento: 'Traga o carvão e deixe a grelha limpa.' },
      { id: 'quadra', nome: 'Quadra', tipo: 'hora', horaInicio: 8, horaFim: 22, taxa: 0, aprovacao: 'automatica', antecedenciaMin: 0, antecedenciaMax: 15, limiteMes: 4, vinculadas: [], capacidade: 12, itens: 'Rede de vôlei e traves', regulamento: 'Calçado adequado. Uma hora por reserva.' },
      { id: 'academia', nome: 'Academia', tipo: 'hora', horaInicio: 6, horaFim: 23, taxa: 0, aprovacao: 'automatica', antecedenciaMin: 0, antecedenciaMax: 7, limiteMes: null, vinculadas: [], capacidade: 6, itens: 'Esteiras, bicicleta e pesos livres', regulamento: 'Uso a partir de 14 anos. Higienize os aparelhos.' },
    ],
    reservas: [
      { id: 'r1', areaId: 'salao', unidade: '104', data: d(3), inicio: 18, fim: 23, status: 'confirmada', convidados: [{ nome: 'Marta Lopes', documento: 'RG 22.418.903-1' }], criadaEm: em(-5, 10) },
      { id: 'r2', areaId: 'quadra', unidade: UNIDADE_ANA, data: d(1), inicio: 9, fim: 10, status: 'confirmada', convidados: [], criadaEm: em(-1, 20) },
      { id: 'r3', areaId: 'churrasqueira', unidade: '603', data: d(0), inicio: 13, fim: 18, status: 'confirmada', convidados: [{ nome: 'João Pereira', documento: 'RG 12.345.678-9' }, { nome: 'Lia Prado', documento: 'RG 98.765.432-1' }], criadaEm: em(-8, 15) },
      { id: 'r4', areaId: 'salao', unidade: '504', data: d(10), inicio: 18, fim: 23, status: 'pendente', convidados: [], criadaEm: em(-1, 8) },
    ],
    bloqueios: [{ id: 'b1', areaId: 'quadra', data: d(5), inicio: 8, fim: 22, motivo: 'Manutenção da pintura' }],
    comunicados: [
      { id: 'c1', tipo: 'manutencao', titulo: 'Falta de água para limpeza da caixa d’água', texto: `Prezados moradores,\n\nNa ${fmtDia(d(4))}, das 9h às 12h, o fornecimento de água será interrompido para a limpeza semestral da caixa d’água.\n\nArmazene água para o período.\nRoberto Lima, síndico`, publico: { tipo: 'todos' }, canais: canaisPadrao, fixado: true, anexo: null, publicadoEm: em(-1, 9), leituras: leramSemAna(19), reacoes: { util: ['101', '204', '603'], duvida: ['702'] } },
      { id: 'c2', tipo: 'assembleia', titulo: 'Convocação: assembleia ordinária', texto: 'Ficam convocados os condôminos para a assembleia ordinária no dia 30, às 19h30, no salão de festas.\n\nPauta: prestação de contas, previsão orçamentária e troca do portão da garagem.\nRoberto Lima, síndico', publico: { tipo: 'todos' }, canais: canaisPadrao, fixado: false, anexo: 'edital-assembleia.pdf', publicadoEm: em(-6, 18), leituras: leram(24), reacoes: { util: ['101'], duvida: [] } },
      { id: 'c3', tipo: 'evento', titulo: 'Festa das crianças no salão', texto: 'Domingo, a partir das 15h, festa das crianças no salão de festas com pipoca, algodão-doce e brincadeiras.\n\nConfirme a presença dos pequenos pelo app.', publico: { tipo: 'todos' }, canais: canaisPadrao, fixado: false, anexo: null, publicadoEm: em(-3, 12), leituras: leram(15), reacoes: { util: ['204', '302'], duvida: [] } },
      { id: 'c4', tipo: 'geral', titulo: 'Troca do interfone', texto: 'A troca dos interfones será feita andar por andar ao longo da próxima semana. A equipe técnica vai bater em cada unidade entre 9h e 16h.', publico: { tipo: 'todos' }, canais: canaisPadrao, fixado: false, anexo: null, publicadoEm: em(-10, 10), leituras: leram(28), reacoes: { util: [], duvida: ['501'] } },
      { id: 'c5', tipo: 'urgente', titulo: 'Elevador 2 parado', texto: 'O elevador 2 está parado aguardando o técnico. Use o elevador 1 ou a escada. Avisaremos assim que voltar a funcionar.', publico: { tipo: 'todos' }, canais: [...canaisPadrao, 'sms'], fixado: false, anexo: null, publicadoEm: em(-1, 21), leituras: leramSemAna(22), reacoes: { util: ['702', '703'], duvida: [] } },
    ],
    ocorrencias: [
      { id: 'OC-0037', os: 'OS-002', categoria: 'eletrica', descricao: 'Lâmpada do hall do 5º andar queimada.', local: '5º andar', unidade: '502', anonima: false, publica: false, foto: false, status: 'resolvida', eutambem: [], linha: [
        { em: em(-9, 19), status: 'aberta', texto: 'Ocorrência aberta', autor: 'Larissa Moura' },
        { em: em(-8, 9), status: 'em_analise', texto: 'Status alterado para Em análise', autor: 'Síndico' },
        { em: em(-8, 10), status: 'em_andamento', texto: 'Zelador vai trocar hoje à tarde', autor: 'Síndico' },
        { em: em(-7, 15), status: 'resolvida', texto: 'Lâmpada trocada pelo zelador', autor: 'Síndico' },
      ], avaliacao: 5, arquivada: false, criadaEm: em(-9, 19) },
      { id: 'OC-0038', categoria: 'elogio', descricao: 'O Seu José ajudou minha mãe com as compras. Muito atencioso!', local: 'Portaria', unidade: '204', anonima: false, publica: false, foto: false, status: 'fechada', eutambem: [], linha: [
        { em: em(-6, 11), status: 'aberta', texto: 'Ocorrência aberta', autor: 'Lucas Martins' },
        { em: em(-6, 14), status: 'fechada', texto: 'Agradecemos o elogio! Repassado ao Seu José.', autor: 'Síndico' },
      ], avaliacao: null, arquivada: false, criadaEm: em(-6, 11) },
      { id: 'OC-0039', os: 'OS-003', categoria: 'vazamento', descricao: 'Água pingando do teto da garagem, perto da vaga 12.', local: 'Garagem, vaga 12', unidade: '101', anonima: false, publica: false, foto: true, status: 'em_andamento', eutambem: [], linha: [
        { em: em(-3, 8), status: 'aberta', texto: 'Ocorrência aberta', autor: 'Carla Mendes' },
        { em: em(-3, 10), status: 'em_analise', texto: 'Status alterado para Em análise', autor: 'Síndico' },
        { em: em(-2, 9), status: 'em_andamento', texto: 'Encanador agendado para avaliar a prumada', autor: 'Síndico' },
      ], avaliacao: null, arquivada: false, criadaEm: em(-3, 8) },
      { id: 'OC-0040', categoria: 'elevador', descricao: 'Elevador 2 parado entre o 3º e o 4º andar.', local: 'Elevador 2', unidade: '702', anonima: false, publica: true, foto: false, status: 'em_andamento', eutambem: ['101', '104', '201', '404', '501', '603', '703'], linha: [
        { em: em(-1, 20), status: 'aberta', texto: 'Ocorrência aberta', autor: 'Sônia Araújo' },
        { em: em(-1, 20, 30), status: 'em_analise', texto: 'Status alterado para Em análise', autor: 'Síndico' },
        { em: em(-1, 21), status: 'em_andamento', texto: 'Técnico da empresa de elevadores acionado', autor: 'Síndico' },
      ], avaliacao: null, arquivada: false, criadaEm: em(-1, 20) },
      { id: 'OC-0041', categoria: 'barulho', descricao: 'Música alta depois das 22h, aparentemente no 1º andar.', local: '1º andar', unidade: '303', anonima: true, publica: false, foto: false, status: 'em_analise', eutambem: [], linha: [
        { em: em(-1, 23), status: 'aberta', texto: 'Ocorrência aberta', autor: 'Anônimo' },
        { em: em(0, 0, 5), status: 'em_analise', texto: 'Status alterado para Em análise', autor: 'Síndico' },
      ], avaliacao: null, arquivada: false, criadaEm: em(-1, 23) },
      { id: 'OC-0042', categoria: 'vaga', descricao: 'Carro desconhecido parado na minha vaga (G1-18) desde ontem.', local: 'Garagem G1, vaga 18', unidade: UNIDADE_ANA, anonima: false, publica: false, foto: true, status: 'aberta', eutambem: [], linha: [
        { em: em(-2, 7), status: 'aberta', texto: 'Ocorrência aberta', autor: 'Ana Souza' },
      ], avaliacao: null, arquivada: false, criadaEm: em(-2, 7) },
      { id: 'OC-0043', categoria: 'obra', descricao: 'Furadeira no domingo às 8h no 5º andar, parece ser no 503.', local: '5º andar', unidade: '702', anonima: false, publica: false, foto: false, status: 'aberta', eutambem: [], linha: [
        { em: em(0, 5), status: 'aberta', texto: 'Ocorrência aberta', autor: 'Sônia Araújo' },
      ], avaliacao: null, arquivada: false, criadaEm: em(0, 5) },
    ].map((o) => ({ prioridade: CATEGORIAS[o.categoria].prioridade, os: null, processos: [], motivoArquivamento: null, ...o })),
    documentos: [
      { id: 'd1', pasta: 'Convenção', titulo: 'Convenção do condomínio', versoes: [{ versao: 1, data: '2019-03-10' }], visibilidade: 'todos' },
      { id: 'd2', pasta: 'Regimento interno', titulo: 'Regimento interno', versoes: [{ versao: 1, data: '2019-03-10' }, { versao: 2, data: '2024-05-20' }], visibilidade: 'todos' },
      { id: 'd3', pasta: 'Atas', titulo: 'Ata da assembleia ordinária de março/2026', versoes: [{ versao: 1, data: '2026-03-28' }], visibilidade: 'todos' },
      { id: 'd4', pasta: 'Atas', titulo: 'Ata da assembleia extraordinária de setembro/2026', versoes: [{ versao: 1, data: '2026-09-15' }], visibilidade: 'todos' },
      { id: 'd5', pasta: 'Balancetes', titulo: 'Balancete de setembro/2026', versoes: [{ versao: 1, data: '2026-10-05' }], visibilidade: 'conselho' },
      { id: 'd6', pasta: 'AVCB', titulo: 'AVCB (auto de vistoria do Corpo de Bombeiros)', versoes: [{ versao: 1, data: '2021-11-02' }], vencimento: d(25), visibilidade: 'todos' },
      { id: 'd7', pasta: 'Apólice de seguro', titulo: 'Apólice do seguro predial', versoes: [{ versao: 1, data: '2025-12-05' }], vencimento: d(58), visibilidade: 'todos' },
      { id: 'd8', pasta: 'Laudos', titulo: 'Certificado de limpeza da caixa d’água', versoes: [{ versao: 1, data: '2026-04-05' }], vencimento: d(-3), visibilidade: 'todos' },
    ],
    encomendas: [
      { id: 'e1', unidade: UNIDADE_ANA, transportadora: 'Mercado Livre', codigo: '481203', chegadaEm: em(-1, 15), status: 'aguardando', foto: true, retiradaPor: null, retiradaEm: null, lembretes: 0, registradaPor: 'Seu José' },
      { id: 'e2', unidade: UNIDADE_ANA, transportadora: 'Amazon', codigo: '730915', chegadaEm: em(-4, 8), status: 'aguardando', foto: true, retiradaPor: null, retiradaEm: null, lembretes: 0, registradaPor: 'Marcos' },
      { id: 'e3', unidade: '504', transportadora: 'Correios', codigo: '219884', chegadaEm: em(-1, 9), status: 'aguardando', foto: true, retiradaPor: null, retiradaEm: null, lembretes: 0, registradaPor: 'Seu José' },
      { id: 'e4', unidade: '101', transportadora: 'Shopee', codigo: '650372', chegadaEm: em(-2, 16), status: 'aguardando', foto: true, retiradaPor: null, retiradaEm: null, lembretes: 0, registradaPor: 'Seu José' },
      { id: 'e5', unidade: UNIDADE_ANA, transportadora: 'Correios', codigo: '304417', chegadaEm: em(-6, 10), status: 'retirada', foto: true, retiradaPor: 'Ana Souza', retiradaEm: em(-5, 19), lembretes: 0, registradaPor: 'Seu José' },
      { id: 'e6', unidade: '203', transportadora: 'Amazon', codigo: '918266', chegadaEm: em(-3, 11), status: 'retirada', foto: true, retiradaPor: 'Beatriz Rocha', retiradaEm: em(-3, 18), lembretes: 0, registradaPor: 'Seu José' },
      { id: 'e7', unidade: '702', transportadora: 'Mercado Livre', codigo: '557029', chegadaEm: em(-2, 10), status: 'retirada', foto: true, retiradaPor: 'Sônia Araújo', retiradaEm: em(-2, 12), lembretes: 0, registradaPor: 'Seu José' },
    ],
    moradorAtual: UNIDADE_ANA,
    sacola: [],
    ...vendasIniciais(em),
    manutencao: manutencaoInicial(em),
    plano: 'intermediario',
    financeiro: financeiroInicial(hoje, em, pessoas, UNIDADES),
  }), agora), agora);
}
