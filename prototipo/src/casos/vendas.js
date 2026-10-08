import { dadosIniciais } from '../dados.js';
import { fmtCentavos, lerPreco, podePublicar, anunciosVisiveis, podeAdicionar, sacolaPorVendedor, validarAnuncio, acoesPedido, painelVendas, destinatariosOfertas } from '../vendas/regras.js';
import { igual, AGORA_TESTE } from './afirmar.js';

const ANUNCIO_BOLO = { titulo: 'Bolo de cenoura com chocolate', descricao: 'Inteiro, 20 cm', categoria: 'doces', preco: 3500, quantidade: 4, pagamentos: ['pix'], entregas: ['retirar'] };

function comSacola(itens) {
  return { ...dadosIniciais(AGORA_TESTE), sacola: itens.map(([anuncioId, quantidade]) => ({ anuncioId, quantidade })) };
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
];
