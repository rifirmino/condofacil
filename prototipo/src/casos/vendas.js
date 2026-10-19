import { dadosIniciais, SINDICO } from '../dados.js';
import { fmtCentavos, lerPreco, podePublicar, anunciosVisiveis, podeAdicionar, sacolaPorVendedor, validarAnuncio, acoesPedido, painelVendas, destinatariosOfertas } from '../vendas/regras.js';
import { trocarMorador, alternarOfertas, pedirParaVender, aprovarVendedor, recusarVendedor, suspenderVendedor, reativarVendedor, publicarAnuncio, editarAnuncio, ocultarAnuncio, mostrarAnuncio, adicionarASacola, fecharPedido, aceitarPedido, recusarPedido, marcarEntregue, marcarPago, cancelarPedido, enviarMensagem } from '../vendas/acoes.js';
import { igual, AGORA_TESTE } from './afirmar.js';

const ANUNCIO_BOLO = { titulo: 'Bolo de cenoura com chocolate', descricao: 'Inteiro, 20 cm', categoria: 'doces', preco: 3500, quantidade: 4, pagamentos: ['pix'], entregas: ['retirar'] };

function comSacola(itens) {
  return { ...dadosIniciais(AGORA_TESTE), sacola: itens.map(([anuncioId, quantidade]) => ({ anuncioId, quantidade })) };
}

const RETIRAR_PIX = { pagamento: 'pix', entrega: 'retirar' };

function compraDaAna() {
  let e = dadosIniciais(AGORA_TESTE);
  e = adicionarASacola(e, 'a1', 2).estado;
  e = adicionarASacola(e, 'a2', 1).estado;
  return fecharPedido(e, { 104: RETIRAR_PIX }, AGORA_TESTE);
}

function pedidoDe(estado, id) {
  return estado.pedidos.find((p) => p.id === id);
}

function anuncioDe(estado, id) {
  return estado.anuncios.find((a) => a.id === id);
}

function pessoaDe(estado, unidade) {
  return estado.pessoas.find((p) => p.unidade === unidade);
}

export const CASOS_VENDAS = [
  {
    nome: 'vendas: dados iniciais',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual([e.anuncios.length, e.pedidos.length, e.proximoPedido, e.moradorAtual, e.sacola], [3, 10, 11, '302', []]);
      const situacao = (u) => e.pessoas.find((p) => p.unidade === u).vendedor;
      igual([situacao('104'), situacao('201'), situacao('102'), situacao('302')], ['aprovado', 'aprovado', 'pendente', 'nao']);
      igual(e.pessoas.filter((p) => p.recebeOfertas).length, 9);
    },
  },
  {
    nome: 'vendas: preço em centavos',
    rodar() {
      igual([lerPreco('18,00'), lerPreco('18'), lerPreco('1.234,56'), lerPreco('R$ 35,5')], [1800, 1800, 123456, 3550]);
      igual([Number.isNaN(lerPreco('')), Number.isNaN(lerPreco('abc'))], [true, true]);
      igual([fmtCentavos(1800), fmtCentavos(15000)], ['R$ 18,00', 'R$ 150,00']);
    },
  },
  {
    nome: 'vendas: só vendedor aprovado publica',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual(podePublicar(e, '104'), { ok: true });
      igual(podePublicar(e, '302').motivo, 'Só vendedores aprovados pelo síndico podem anunciar');
      igual(podePublicar(e, '102').ok, false);
    },
  },
  {
    nome: 'vendas: vitrine mostra só anúncios ativos de vendedor aprovado',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual(anunciosVisiveis(e).map((a) => a.id), ['a3', 'a2', 'a1']);
      const suspenso = { ...e, pessoas: e.pessoas.map((p) => (p.unidade === '201' ? { ...p, vendedor: 'suspenso' } : p)) };
      igual(anunciosVisiveis(suspenso).map((a) => a.id), ['a2', 'a1']);
      const pausado = { ...e, anuncios: e.anuncios.map((a) => (a.id === 'a2' ? { ...a, ativo: false } : a)) };
      igual(anunciosVisiveis(pausado).map((a) => a.id), ['a3', 'a1']);
    },
  },
  {
    nome: 'vendas: limites ao pôr na sacola',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual(podeAdicionar(e, '302', 'a1', 2), { ok: true });
      igual(podeAdicionar(e, '104', 'a1', 1).motivo, 'Você não pode comprar o próprio anúncio');
      igual(podeAdicionar(e, '302', 'a3', 2).motivo, 'Só resta 1 unidade');
      igual(podeAdicionar(e, '302', 'a1', 0).motivo, 'Escolha ao menos 1 unidade');
      igual(podeAdicionar(comSacola([['a1', 9]]), '302', 'a1', 2).motivo, 'Só restam 10 unidades');
    },
  },
  {
    nome: 'vendas: sacola agrupada por vendedor com opções em comum',
    rodar() {
      const grupos = sacolaPorVendedor(comSacola([['a1', 2], ['a2', 1], ['a3', 1]]));
      igual(grupos.map((g) => [g.vendedor, g.subtotal, g.pagamentos, g.entregas]), [
        ['104', 4800, ['pix'], ['retirar']],
        ['201', 15000, ['pix', 'dinheiro', 'cartao'], ['retirar']],
      ]);
    },
  },
  {
    nome: 'vendas: validação do anúncio',
    rodar() {
      igual(validarAnuncio(ANUNCIO_BOLO), { ok: true });
      igual(validarAnuncio({ ...ANUNCIO_BOLO, titulo: ' ' }).motivo, 'Preencha título, preço e quantidade');
      igual(validarAnuncio({ ...ANUNCIO_BOLO, preco: NaN }).motivo, 'Preencha título, preço e quantidade');
      igual(validarAnuncio({ ...ANUNCIO_BOLO, preco: -5 }).motivo, 'Preço precisa ser maior que zero');
      igual(validarAnuncio({ ...ANUNCIO_BOLO, quantidade: 1.5 }).motivo, 'Quantidade precisa ser um número inteiro');
      igual(validarAnuncio({ ...ANUNCIO_BOLO, pagamentos: [] }).motivo, 'Escolha ao menos uma forma de pagamento');
      igual(validarAnuncio({ ...ANUNCIO_BOLO, entregas: [] }).motivo, 'Escolha ao menos uma forma de entrega');
    },
  },
  {
    nome: 'vendas: ações possíveis em cada situação do pedido',
    rodar() {
      const p = (status, pago = false) => ({ vendedor: '104', comprador: '302', status, pago });
      igual(acoesPedido(p('novo'), '104'), ['aceitar', 'recusar', 'pago', 'conversar']);
      igual(acoesPedido(p('novo'), '302'), ['cancelar', 'conversar']);
      igual(acoesPedido(p('aceito'), '104'), ['entregar', 'pago', 'conversar']);
      igual(acoesPedido(p('entregue', true), '104'), ['conversar']);
      igual(acoesPedido(p('recusado'), '104'), []);
      igual(acoesPedido(p('novo'), '501'), []);
    },
  },
  {
    nome: 'vendas: painel dos últimos 7 dias',
    rodar() {
      igual(painelVendas(dadosIniciais(AGORA_TESTE), '104', '7d', AGORA_TESTE), {
        pedidos: 3,
        faturamento: 5400,
        entregues: 2,
        ticket: 2700,
        itens: 4,
        barras: [
          { rotulo: '2026-10-02', valor: 0 }, { rotulo: '2026-10-03', valor: 0 }, { rotulo: '2026-10-04', valor: 0 },
          { rotulo: '2026-10-05', valor: 3000 }, { rotulo: '2026-10-06', valor: 0 }, { rotulo: '2026-10-07', valor: 2400 },
          { rotulo: '2026-10-08', valor: 0 },
        ],
        maisVendidos: [{ titulo: 'Bolo de pote de ninho com morango', quantidade: 3 }, { titulo: 'Brigadeiro gourmet (caixa com 6)', quantidade: 1 }],
        situacao: { entregues: 2, andamento: 0, recusados: 0, cancelados: 1 },
      });
    },
  },
  {
    nome: 'vendas: painel dos últimos 30 dias e do mês',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      const trinta = painelVendas(e, '104', '30d', AGORA_TESTE);
      igual([trinta.pedidos, trinta.faturamento, trinta.ticket, trinta.itens], [7, 15600, 3120, 11]);
      igual(trinta.barras.map((b) => b.valor), [4200, 0, 6000, 3000, 2400]);
      igual(trinta.barras[0].rotulo, '2026-09-09');
      igual(trinta.situacao, { entregues: 5, andamento: 0, recusados: 1, cancelados: 1 });
      const mes = painelVendas(e, '104', 'mes', AGORA_TESTE);
      igual([mes.pedidos, mes.barras.map((b) => b.valor)], [3, [5400, 0]]);
    },
  },
  {
    nome: 'vendas: aviso de anúncio só para quem aceita ofertas',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual([destinatariosOfertas(e, '104').length, destinatariosOfertas(e, '101').length], [9, 8]);
    },
  },
  {
    nome: 'vendas: roteiro compra cria pedido, desconta estoque e avisa o vendedor',
    rodar() {
      const r = compraDaAna();
      igual(r.erro, undefined);
      igual([r.id, anuncioDe(r.estado, 'a1').quantidade, anuncioDe(r.estado, 'a2').quantidade, r.estado.sacola, r.estado.proximoPedido], ['PD-011', 8, 5, [], 12]);
      const p = pedidoDe(r.estado, 'PD-011');
      igual([p.comprador, p.vendedor, p.status, p.pagamento, p.entrega], ['302', '104', 'novo', 'pix', 'retirar']);
      igual([r.notificacao.canal, r.notificacao.para], ['WhatsApp', 'Juliana Costa']);
    },
  },
  {
    nome: 'vendas: fechar pedido exige sacola, pagamento e entrega válidos',
    rodar() {
      igual(fecharPedido(dadosIniciais(AGORA_TESTE), {}, AGORA_TESTE).erro, 'Sua sacola está vazia');
      const e = comSacola([['a1', 1], ['a2', 1]]);
      igual(fecharPedido(e, {}, AGORA_TESTE).erro, 'Escolha a forma de pagamento');
      igual(fecharPedido(e, { 104: { pagamento: 'pix', entrega: 'porta' } }, AGORA_TESTE).erro, 'Escolha a forma de entrega');
    },
  },
  {
    nome: 'vendas: sacola com dois vendedores gera dois pedidos',
    rodar() {
      const r = fecharPedido(comSacola([['a1', 1], ['a3', 1]]), { 104: RETIRAR_PIX, 201: RETIRAR_PIX }, AGORA_TESTE);
      igual([r.ids, anuncioDe(r.estado, 'a3').quantidade], [['PD-011', 'PD-012'], 0]);
      igual(r.notificacao.texto.includes('e mais 1 pedido'), true);
    },
  },
  {
    nome: 'vendas: roteiro atendimento até entrar no painel',
    rodar() {
      let e = compraDaAna().estado;
      igual(aceitarPedido(e, 'PD-011', '302', AGORA_TESTE).erro, 'Ação não permitida para este pedido');
      const aceito = aceitarPedido(e, 'PD-011', '104', AGORA_TESTE);
      igual([pedidoDe(aceito.estado, 'PD-011').status, aceito.notificacao.para], ['aceito', 'Ana Souza']);
      e = aceito.estado;
      igual(enviarMensagem(e, 'PD-011', '104', '  ', AGORA_TESTE).erro, 'Escreva a mensagem');
      igual(enviarMensagem(e, 'PD-011', '501', 'Oi', AGORA_TESTE).erro, 'Ação não permitida para este pedido');
      const msg = enviarMensagem(e, 'PD-011', '104', 'Pode passar às 18h', AGORA_TESTE);
      igual([pedidoDe(msg.estado, 'PD-011').mensagens.map((m) => [m.autor, m.texto]), msg.notificacao.para], [[['104', 'Pode passar às 18h']], 'Ana Souza']);
      e = marcarEntregue(msg.estado, 'PD-011', '104', AGORA_TESTE).estado;
      e = marcarPago(e, 'PD-011', '104', AGORA_TESTE).estado;
      const p = pedidoDe(e, 'PD-011');
      igual([p.status, p.pago], ['entregue', true]);
      igual(painelVendas(e, '104', '7d', AGORA_TESTE).faturamento, 10200);
    },
  },
  {
    nome: 'vendas: recusar exige motivo e devolve o estoque',
    rodar() {
      const e = compraDaAna().estado;
      igual(recusarPedido(e, 'PD-011', '104', ' ', AGORA_TESTE).erro, 'Informe o motivo da recusa');
      const r = recusarPedido(e, 'PD-011', '104', 'Sem ingredientes hoje', AGORA_TESTE);
      igual([pedidoDe(r.estado, 'PD-011').status, anuncioDe(r.estado, 'a1').quantidade, anuncioDe(r.estado, 'a2').quantidade], ['recusado', 10, 6]);
    },
  },
  {
    nome: 'vendas: só o comprador cancela e o estoque volta',
    rodar() {
      const e = compraDaAna().estado;
      igual(cancelarPedido(e, 'PD-011', '104', AGORA_TESTE).erro, 'Ação não permitida para este pedido');
      const r = cancelarPedido(e, 'PD-011', '302', AGORA_TESTE);
      igual([pedidoDe(r.estado, 'PD-011').status, anuncioDe(r.estado, 'a1').quantidade, r.notificacao.para], ['cancelado', 10, 'Juliana Costa']);
    },
  },
  {
    nome: 'vendas: roteiro virar vendedora e publicar',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual(publicarAnuncio(e, '302', ANUNCIO_BOLO, AGORA_TESTE).erro, 'Só vendedores aprovados pelo síndico podem anunciar');
      igual(pedirParaVender(e, '302', ' ', AGORA_TESTE).erro, 'Conte o que você pretende vender');
      const pedido = pedirParaVender(e, '302', 'Bolos caseiros por encomenda', AGORA_TESTE);
      igual([pessoaDe(pedido.estado, '302').vendedor, pedido.notificacao.para], ['pendente', SINDICO]);
      igual(pedirParaVender(pedido.estado, '302', 'De novo', AGORA_TESTE).erro, 'Já existe um pedido para vender');
      const aprovado = aprovarVendedor(pedido.estado, '302');
      igual([pessoaDe(aprovado.estado, '302').vendedor, aprovado.notificacao.para], ['aprovado', 'Ana Souza']);
      igual(publicarAnuncio(aprovado.estado, '302', { ...ANUNCIO_BOLO, preco: 0 }, AGORA_TESTE).erro, 'Preço precisa ser maior que zero');
      const r = publicarAnuncio(aprovado.estado, '302', ANUNCIO_BOLO, AGORA_TESTE);
      igual([r.id, r.notificacao.para, anunciosVisiveis(r.estado)[0].id], ['a4', '9 moradores que aceitam ofertas', 'a4']);
    },
  },
  {
    nome: 'vendas: recusa, suspensão e reativação de vendedor',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual(recusarVendedor(e, '102', '').erro, 'Informe o motivo da recusa');
      const recusado = recusarVendedor(e, '102', 'Falta o alvará da vigilância sanitária');
      igual([pessoaDe(recusado.estado, '102').vendedor, pessoaDe(recusado.estado, '102').motivoVendedor], ['nao', 'Falta o alvará da vigilância sanitária']);
      igual(suspenderVendedor(e, '201', '').erro, 'Informe o motivo da suspensão');
      const suspenso = suspenderVendedor(e, '201', 'Reclamações de vizinhos');
      igual([pessoaDe(suspenso.estado, '201').vendedor, anunciosVisiveis(suspenso.estado).some((a) => a.id === 'a3')], ['suspenso', false]);
      igual(pessoaDe(reativarVendedor(suspenso.estado, '201').estado, '201').vendedor, 'aprovado');
    },
  },
  {
    nome: 'vendas: síndico oculta e mostra anúncio',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual(ocultarAnuncio(e, 'a3', ' ').erro, 'Informe o motivo');
      const r = ocultarAnuncio(e, 'a3', 'Venda de bebida alcoólica não é permitida');
      igual([anuncioDe(r.estado, 'a3').oculto, anuncioDe(r.estado, 'a3').motivoOculto, r.notificacao.para], [true, 'Venda de bebida alcoólica não é permitida', 'Fernando Alves']);
      igual(anunciosVisiveis(r.estado).some((a) => a.id === 'a3'), false);
      igual(anunciosVisiveis(mostrarAnuncio(r.estado, 'a3').estado).some((a) => a.id === 'a3'), true);
    },
  },
  {
    nome: 'vendas: só o dono edita o anúncio',
    rodar() {
      const e = dadosIniciais(AGORA_TESTE);
      igual(editarAnuncio(e, '201', 'a1', { preco: 2000 }).erro, 'Só o vendedor pode editar o anúncio');
      igual(editarAnuncio(e, '104', 'a1', { preco: 0 }).erro, 'Preço precisa ser maior que zero');
      igual(anuncioDe(editarAnuncio(e, '104', 'a1', { quantidade: 20 }).estado, 'a1').quantidade, 20);
    },
  },
  {
    nome: 'vendas: troca de morador e preferência de ofertas',
    rodar() {
      const e = comSacola([['a1', 1]]);
      const r = trocarMorador(e, '104');
      igual([r.estado.moradorAtual, r.estado.sacola], ['104', []]);
      igual(trocarMorador(e, '999').erro, 'Morador indisponível na demonstração');
      igual(trocarMorador(e, '704').estado.moradorAtual, '704');
      igual(pessoaDe(alternarOfertas(e, '302').estado, '302').recebeOfertas, true);
    },
  },
];
