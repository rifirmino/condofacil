// Dados iniciais do zelador: OS, compras e caixa pequeno (fase 2, parte 3).
export const ZELADOR = 'Seu Antônio';
export const NOMES_STATUS_OS = { aberta: 'Aberta', em_execucao: 'Em execução', aguardando_material: 'Aguardando material', aguardando_prestador: 'Aguardando prestador', concluida: 'Concluída', validada: 'Validada' };
export const CATEGORIAS_COMPRA = { manutencao: 'Manutenção', administracao: 'Administração', seguro: 'Seguro e outros' };

export function manutencaoInicial(em) {
  const os = [
    { id: 'OS-001', origem: 'sindico', notificacao: null, local: 'Casa de bombas', descricao: 'Manutenção preventiva da bomba d’água (troca do selo mecânico)', prioridade: 'normal', prazo: em(-8, 18), responsavel: 'zelador', prestador: null, status: 'validada', fotoAntes: true, fotoDepois: true, materiais: 'Selo mecânico', horas: 1.5, observacoes: 'Sem vazamento após a troca', linha: [
      { em: em(-12, 9), status: 'aberta', texto: 'OS aberta pelo síndico', autor: 'Síndico' },
      { em: em(-11, 8), status: 'em_execucao', texto: 'Iniciada', autor: ZELADOR },
      { em: em(-11, 10), status: 'concluida', texto: 'Concluída com fotos do depois', autor: ZELADOR },
      { em: em(-10, 16), status: 'validada', texto: 'Validada pelo síndico', autor: 'Síndico' },
    ], criadaEm: em(-12, 9), iniciadaEm: em(-11, 8), concluidaEm: em(-11, 10), validadaEm: em(-10, 16) },
    { id: 'OS-002', origem: 'notificacao', notificacao: 'OC-0037', local: '5º andar', descricao: 'Lâmpada do hall do 5º andar queimada.', prioridade: 'alta', prazo: em(-6, 19), responsavel: 'zelador', prestador: null, status: 'concluida', fotoAntes: true, fotoDepois: true, materiais: '2 lâmpadas LED 9 W', horas: 0.5, observacoes: '', linha: [
      { em: em(-8, 10), status: 'aberta', texto: 'OS aberta a partir da OC-0037', autor: 'Síndico' },
      { em: em(-7, 14), status: 'em_execucao', texto: 'Iniciada', autor: ZELADOR },
      { em: em(-7, 15), status: 'concluida', texto: 'Concluída com fotos do depois', autor: ZELADOR },
    ], criadaEm: em(-8, 10), iniciadaEm: em(-7, 14), concluidaEm: em(-7, 15), validadaEm: null },
    { id: 'OS-003', origem: 'notificacao', notificacao: 'OC-0039', local: 'Garagem, vaga 12', descricao: 'Água pingando do teto da garagem, perto da vaga 12.', prioridade: 'urgente', prazo: em(-2, 8), responsavel: 'zelador', prestador: null, status: 'em_execucao', fotoAntes: true, fotoDepois: false, materiais: '', horas: 0, observacoes: '', linha: [
      { em: em(-2, 9), status: 'aberta', texto: 'OS aberta a partir da OC-0039', autor: 'Síndico' },
      { em: em(-2, 10), status: 'em_execucao', texto: 'Iniciada', autor: ZELADOR },
      { em: em(-2, 15), status: 'aguardando_material', texto: 'Aguardando material: registro de 3/4"', autor: ZELADOR },
      { em: em(-1, 9), status: 'em_execucao', texto: 'Retomada', autor: ZELADOR },
    ], criadaEm: em(-2, 9), iniciadaEm: em(-2, 10), concluidaEm: null, validadaEm: null },
  ];
  const compras = [
    { id: 'CP-001', item: 'Registro de 3/4" e conexões', quantidade: 1, motivo: 'Trocar o registro que está vazando na garagem', valorEstimado: 38000, categoria: 'manutencao', os: 'OS-003', urgente: true, cotacoes: [{ fornecedor: 'Casa do Encanador', valor: 38000 }], status: 'solicitada', motivoRecusa: null, valorFinal: null, nota: null, viaCaixa: false, criadaEm: em(-1, 11), aprovadaEm: null, recebidaEm: null },
    { id: 'CP-002', item: 'Produtos de limpeza (kit do mês)', quantidade: 1, motivo: 'Reposição mensal', valorEstimado: 14500, categoria: 'manutencao', os: null, urgente: false, cotacoes: [{ fornecedor: 'Atacadão Limpeza', valor: 14500 }], status: 'recebida', motivoRecusa: null, valorFinal: 14500, nota: 'nota-CP-002.pdf', viaCaixa: false, criadaEm: em(-9, 10), aprovadaEm: em(-8, 18), recebidaEm: em(-6, 11) },
  ];
  const caixa = { fundo: 30000, saldo: 23950, gastos: [
    { id: 'G1', descricao: 'Fita veda-rosca e lâmpadas', valor: 4200, cupom: true, em: em(-5, 16) },
    { id: 'G2', descricao: 'Sacos de lixo extras', valor: 1850, cupom: true, em: em(-2, 11) },
  ], reposicoes: [] };
  return { os, compras, caixa, proximaOS: 4, proximaCompra: 3 };
}
