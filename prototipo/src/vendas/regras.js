import { isoDia, somarDias } from '../datas.js';

const VENDA_OK = { ok: true };

function falhaVenda(motivo) {
  return { ok: false, motivo };
}

function restam(n) {
  return n === 1 ? 'Só resta 1 unidade' : `Só restam ${n} unidades`;
}

export function fmtCentavos(centavos) {
  return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;
}

export function lerPreco(texto) {
  const limpo = String(texto || '').replace(/R\$|\s/g, '').replace(/\./g, '').replace(',', '.');
  if (!limpo) return NaN;
  const valor = Number(limpo);
  return Number.isFinite(valor) ? Math.round(valor * 100) : NaN;
}

// Quem está usando o app naquela unidade: a pessoa atual (convite ou troca), depois a primeira ativa.
export function pessoaDaUnidade(estado, unidade) {
  const daUnidade = estado.pessoas.filter((p) => p.unidade === unidade);
  return daUnidade.find((p) => p.id === estado.pessoaAtual) || daUnidade.find((p) => !p.situacao || p.situacao === 'ativo') || daUnidade[0];
}

export function nomeVizinho(estado, unidade) {
  const p = pessoaDaUnidade(estado, unidade);
  return p ? p.nome : `Apto ${unidade}`;
}

export function anuncioPorId(estado, id) {
  return estado.anuncios.find((a) => a.id === id);
}

export function podePublicar(estado, unidade) {
  const p = pessoaDaUnidade(estado, unidade);
  return p && p.vendedor === 'aprovado' ? VENDA_OK : falhaVenda('Só vendedores aprovados pelo síndico podem anunciar');
}

function anuncioVisivel(estado, anuncio) {
  const p = pessoaDaUnidade(estado, anuncio.vendedor);
  return anuncio.ativo && !anuncio.oculto && !!p && p.vendedor === 'aprovado';
}

export function anunciosVisiveis(estado) {
  return estado.anuncios.filter((a) => anuncioVisivel(estado, a)).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export function quantidadeNaSacola(estado, anuncioId) {
  const item = estado.sacola.find((i) => i.anuncioId === anuncioId);
  return item ? item.quantidade : 0;
}

export function podeAdicionar(estado, unidade, anuncioId, quantidade) {
  const a = anuncioPorId(estado, anuncioId);
  if (!a || !anuncioVisivel(estado, a)) return falhaVenda('Anúncio indisponível');
  if (a.vendedor === unidade) return falhaVenda('Você não pode comprar o próprio anúncio');
  if (!Number.isInteger(quantidade) || quantidade < 1) return falhaVenda('Escolha ao menos 1 unidade');
  if (a.quantidade === 0) return falhaVenda('Produto esgotado');
  if (quantidadeNaSacola(estado, anuncioId) + quantidade > a.quantidade) return falhaVenda(restam(a.quantidade));
  return VENDA_OK;
}

function intersecao(listas) {
  return listas.reduce((acc, lista) => acc.filter((x) => lista.includes(x)));
}

export function sacolaPorVendedor(estado) {
  const grupos = [];
  for (const item of estado.sacola) {
    const anuncio = anuncioPorId(estado, item.anuncioId);
    if (!anuncio) continue;
    let grupo = grupos.find((g) => g.vendedor === anuncio.vendedor);
    if (!grupo) {
      grupo = { vendedor: anuncio.vendedor, nome: nomeVizinho(estado, anuncio.vendedor), itens: [], subtotal: 0 };
      grupos.push(grupo);
    }
    grupo.itens.push({ anuncio, quantidade: item.quantidade, subtotal: anuncio.preco * item.quantidade });
    grupo.subtotal += anuncio.preco * item.quantidade;
  }
  return grupos.map((g) => ({ ...g, pagamentos: intersecao(g.itens.map((i) => i.anuncio.pagamentos)), entregas: intersecao(g.itens.map((i) => i.anuncio.entregas)) }));
}

export function validarAnuncio(dados) {
  const titulo = String(dados.titulo || '').trim();
  if (!titulo || !Number.isFinite(dados.preco) || !Number.isFinite(dados.quantidade)) return falhaVenda('Preencha título, preço e quantidade');
  if (dados.preco <= 0) return falhaVenda('Preço precisa ser maior que zero');
  if (!Number.isInteger(dados.quantidade) || dados.quantidade < 0) return falhaVenda('Quantidade precisa ser um número inteiro');
  if (!dados.pagamentos || !dados.pagamentos.length) return falhaVenda('Escolha ao menos uma forma de pagamento');
  if (!dados.entregas || !dados.entregas.length) return falhaVenda('Escolha ao menos uma forma de entrega');
  return VENDA_OK;
}

export function acoesPedido(pedido, unidade) {
  const acoes = [];
  const encerrado = ['recusado', 'cancelado'].includes(pedido.status);
  if (unidade === pedido.vendedor) {
    if (pedido.status === 'novo') acoes.push('aceitar', 'recusar');
    if (pedido.status === 'aceito') acoes.push('entregar');
    if (!pedido.pago && !encerrado) acoes.push('pago');
  }
  if (unidade === pedido.comprador && pedido.status === 'novo') acoes.push('cancelar');
  if ((unidade === pedido.vendedor || unidade === pedido.comprador) && !encerrado) acoes.push('conversar');
  return acoes;
}

export function totalPedido(pedido) {
  return pedido.itens.reduce((soma, i) => soma + i.preco * i.quantidade, 0);
}

export function destinatariosOfertas(estado, vendedor) {
  return [...new Set(estado.pessoas.filter((p) => p.recebeOfertas && p.unidade !== vendedor).map((p) => p.unidade))];
}

export function inicioPeriodo(periodo, hoje) {
  if (periodo === '7d') return somarDias(hoje, -6);
  if (periodo === '30d') return somarDias(hoje, -29);
  return `${hoje.slice(0, 7)}-01`;
}

export function painelVendas(estado, vendedor, periodo, agora) {
  const hoje = isoDia(agora);
  const inicio = inicioPeriodo(periodo, hoje);
  const diaDe = (instante) => isoDia(new Date(instante));
  const doVendedor = estado.pedidos.filter((p) => p.vendedor === vendedor);
  const criados = doVendedor.filter((p) => diaDe(p.criadoEm) >= inicio && diaDe(p.criadoEm) <= hoje);
  const entregues = doVendedor.filter((p) => p.status === 'entregue' && p.entregueEm && diaDe(p.entregueEm) >= inicio && diaDe(p.entregueEm) <= hoje);
  const faturamento = entregues.reduce((soma, p) => soma + totalPedido(p), 0);
  const itens = entregues.reduce((soma, p) => soma + p.itens.reduce((t, i) => t + i.quantidade, 0), 0);
  const passo = periodo === '7d' ? 1 : 7;
  const barras = [];
  for (let dia = inicio; dia <= hoje; dia = somarDias(dia, passo)) {
    const fim = somarDias(dia, passo - 1);
    const valor = entregues.filter((p) => diaDe(p.entregueEm) >= dia && diaDe(p.entregueEm) <= fim).reduce((soma, p) => soma + totalPedido(p), 0);
    barras.push({ rotulo: dia, valor });
  }
  const porProduto = {};
  for (const p of entregues) for (const i of p.itens) porProduto[i.titulo] = (porProduto[i.titulo] || 0) + i.quantidade;
  const maisVendidos = Object.entries(porProduto).map(([titulo, quantidade]) => ({ titulo, quantidade })).sort((a, b) => b.quantidade - a.quantidade).slice(0, 3);
  return {
    pedidos: criados.length,
    faturamento,
    entregues: entregues.length,
    ticket: entregues.length ? Math.round(faturamento / entregues.length) : 0,
    itens,
    barras,
    maisVendidos,
    situacao: {
      entregues: criados.filter((p) => p.status === 'entregue').length,
      andamento: criados.filter((p) => ['novo', 'aceito'].includes(p.status)).length,
      recusados: criados.filter((p) => p.status === 'recusado').length,
      cancelados: criados.filter((p) => p.status === 'cancelado').length,
    },
  };
}
