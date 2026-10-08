// Constantes e dados iniciais do módulo de vendas entre moradores.
export const MORADORES_DEMO = [['302', 'Ana'], ['104', 'Juliana']];
export const CATEGORIAS_VENDA = { doces: 'Doces', salgados: 'Salgados', artesanato: 'Artesanato', desapego: 'Desapego', servicos: 'Serviços' };
export const PAGAMENTOS = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão na entrega' };
export const ENTREGAS = { retirar: 'Retirar no apto', porta: 'Entrega na porta' };
export const NOMES_STATUS_PEDIDO = { novo: 'Novo', aceito: 'Aceito', entregue: 'Entregue', recusado: 'Recusado', cancelado: 'Cancelado' };

const VENDEDORES_INICIAIS = { 104: 'aprovado', 201: 'aprovado', 102: 'pendente' };
const ACEITAM_OFERTAS = ['101', '203', '301', '401', '404', '501', '601', '702', '703'];

// [número, dias atrás, comprador, [[anúncio, quantidade]], situação]
const HISTORICO_JULIANA = [
  [1, 44, '101', [['a1', 2]], 'entregue'],
  [2, 38, '203', [['a2', 1]], 'entregue'],
  [3, 31, '401', [['a1', 3]], 'entregue'],
  [4, 25, '501', [['a1', 1], ['a2', 2]], 'entregue'],
  [5, 19, '601', [['a1', 1]], 'recusado'],
  [6, 14, '702', [['a2', 2]], 'entregue'],
  [7, 9, '301', [['a1', 2]], 'entregue'],
  [8, 5, '404', [['a1', 1]], 'cancelado'],
  [9, 3, '703', [['a1', 1], ['a2', 1]], 'entregue'],
  [10, 1, '201', [['a2', 2]], 'entregue'],
];

export function vendasIniciais(em) {
  const anuncios = [
    { id: 'a1', vendedor: '104', titulo: 'Brigadeiro gourmet (caixa com 6)', descricao: 'Brigadeiros de chocolate belga, granulado e ninho. Feitos no dia.', categoria: 'doces', preco: 1800, quantidade: 10, pagamentos: ['pix', 'dinheiro'], entregas: ['retirar', 'porta'], ativo: true, oculto: false, motivoOculto: null, criadoEm: em(-20, 9) },
    { id: 'a2', vendedor: '104', titulo: 'Bolo de pote de ninho com morango', descricao: 'Pote de 250 ml com massa de baunilha, creme de ninho e morango fresco.', categoria: 'doces', preco: 1200, quantidade: 6, pagamentos: ['pix'], entregas: ['retirar'], ativo: true, oculto: false, motivoOculto: null, criadoEm: em(-6, 10) },
    { id: 'a3', vendedor: '201', titulo: 'Bicicleta infantil aro 16', descricao: 'Usada por um ano, com rodinhas laterais. Pneus novos.', categoria: 'desapego', preco: 15000, quantidade: 1, pagamentos: ['pix', 'dinheiro', 'cartao'], entregas: ['retirar'], ativo: true, oculto: false, motivoOculto: null, criadoEm: em(-2, 18) },
  ];
  const anuncioSemente = (id) => anuncios.find((a) => a.id === id);
  const pedidos = HISTORICO_JULIANA.map(([n, dias, comprador, itens, status]) => {
    const criadoEm = em(-dias, 10);
    const linha = [{ em: criadoEm, status: 'novo', texto: 'Pedido enviado' }];
    if (status === 'entregue') linha.push({ em: em(-dias, 12), status: 'aceito', texto: 'Pedido aceito pelo vendedor' }, { em: em(-dias, 19), status: 'entregue', texto: 'Pedido entregue' });
    if (status === 'recusado') linha.push({ em: em(-dias, 12), status: 'recusado', texto: 'Recusado: Sem ingredientes nesta semana' });
    if (status === 'cancelado') linha.push({ em: em(-dias, 11), status: 'cancelado', texto: 'Cancelado pelo comprador' });
    return {
      id: `PD-${String(n).padStart(3, '0')}`,
      comprador,
      vendedor: '104',
      itens: itens.map(([anuncioId, quantidade]) => ({ anuncioId, titulo: anuncioSemente(anuncioId).titulo, quantidade, preco: anuncioSemente(anuncioId).preco })),
      pagamento: 'pix',
      entrega: 'retirar',
      status,
      pago: status === 'entregue',
      motivo: status === 'recusado' ? 'Sem ingredientes nesta semana' : null,
      linha,
      mensagens: [],
      criadoEm,
      entregueEm: status === 'entregue' ? em(-dias, 19) : null,
    };
  });
  return { anuncios, pedidos, proximoPedido: 11 };
}

export function perfilVenda(unidade, em) {
  return {
    recebeOfertas: ACEITAM_OFERTAS.includes(unidade),
    vendedor: VENDEDORES_INICIAIS[unidade] || 'nao',
    pedidoVenda: unidade === '102' ? { texto: 'Salgados assados para festas', em: em(-1, 19) } : null,
    motivoVendedor: null,
  };
}
