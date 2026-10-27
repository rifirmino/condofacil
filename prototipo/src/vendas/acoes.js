import { SINDICO } from '../dados.js';
import { MORADORES_DEMO } from './dados.js';
import { pessoaDaUnidade, nomeVizinho, anuncioPorId, podePublicar, validarAnuncio, podeAdicionar, sacolaPorVendedor, acoesPedido, destinatariosOfertas } from './regras.js';

// Cada ação devolve { estado, notificacao?, erro?, id? } sem mutar nada.
function erroVenda(estado, mensagem) {
  return { estado, erro: mensagem };
}

function mudarPessoa(estado, unidade, mudanca) {
  return { ...estado, pessoas: estado.pessoas.map((p) => (p.unidade === unidade ? { ...p, ...mudanca } : p)) };
}

function mudarAnuncio(estado, id, mudanca) {
  return { ...estado, anuncios: estado.anuncios.map((a) => (a.id === id ? { ...a, ...mudanca } : a)) };
}

function mudarPedido(estado, id, mudanca) {
  return { ...estado, pedidos: estado.pedidos.map((p) => (p.id === id ? { ...p, ...mudanca } : p)) };
}

function moverEstoque(anuncios, itens, sinal) {
  return anuncios.map((a) => {
    const quantidade = itens.filter((i) => i.anuncioId === a.id).reduce((soma, i) => soma + i.quantidade, 0);
    return quantidade ? { ...a, quantidade: a.quantidade + sinal * quantidade } : a;
  });
}

function textoLimpo(texto) {
  return String(texto || '').trim();
}

export function trocarMorador(estado, unidade) {
  const disponivel = estado.origem === 'novo' ? estado.pessoas.some((p) => p.unidade === unidade && p.situacao === 'ativo') : MORADORES_DEMO.some(([u]) => u === unidade);
  if (!disponivel) return erroVenda(estado, 'Morador indisponível na demonstração');
  const pessoa = estado.pessoas.find((p) => p.unidade === unidade && (!p.situacao || p.situacao === 'ativo'));
  return { estado: { ...estado, moradorAtual: unidade, pessoaAtual: pessoa ? pessoa.id : null, sacola: [] } };
}

export function alternarOfertas(estado, unidade) {
  const p = pessoaDaUnidade(estado, unidade);
  if (!p) return erroVenda(estado, 'Morador não encontrado');
  return { estado: mudarPessoa(estado, unidade, { recebeOfertas: !p.recebeOfertas }) };
}

export function pedirParaVender(estado, unidade, texto, agora) {
  const p = pessoaDaUnidade(estado, unidade);
  if (!p || p.vendedor !== 'nao') return erroVenda(estado, 'Já existe um pedido para vender');
  const descricao = textoLimpo(texto);
  if (!descricao) return erroVenda(estado, 'Conte o que você pretende vender');
  return {
    estado: mudarPessoa(estado, unidade, { vendedor: 'pendente', pedidoVenda: { texto: descricao, em: agora.toISOString() }, motivoVendedor: null }),
    notificacao: { canal: 'Push', para: SINDICO, texto: `${p.nome} (apto ${unidade}) pediu para vender: ${descricao}` },
  };
}

export function aprovarVendedor(estado, unidade) {
  const p = pessoaDaUnidade(estado, unidade);
  if (!p || p.vendedor !== 'pendente') return erroVenda(estado, 'Solicitação não está pendente');
  return {
    estado: mudarPessoa(estado, unidade, { vendedor: 'aprovado', motivoVendedor: null }),
    notificacao: { canal: 'WhatsApp', para: p.nome, texto: 'Seu pedido para vender foi aprovado pelo síndico. Você já pode anunciar.' },
  };
}

export function recusarVendedor(estado, unidade, motivo) {
  const p = pessoaDaUnidade(estado, unidade);
  if (!p || p.vendedor !== 'pendente') return erroVenda(estado, 'Solicitação não está pendente');
  const texto = textoLimpo(motivo);
  if (!texto) return erroVenda(estado, 'Informe o motivo da recusa');
  return {
    estado: mudarPessoa(estado, unidade, { vendedor: 'nao', motivoVendedor: texto }),
    notificacao: { canal: 'WhatsApp', para: p.nome, texto: `Seu pedido para vender foi recusado: ${texto}` },
  };
}

export function suspenderVendedor(estado, unidade, motivo) {
  const p = pessoaDaUnidade(estado, unidade);
  if (!p || p.vendedor !== 'aprovado') return erroVenda(estado, 'Vendedor não está ativo');
  const texto = textoLimpo(motivo);
  if (!texto) return erroVenda(estado, 'Informe o motivo da suspensão');
  return {
    estado: mudarPessoa(estado, unidade, { vendedor: 'suspenso', motivoVendedor: texto }),
    notificacao: { canal: 'WhatsApp', para: p.nome, texto: `Suas vendas foram suspensas pelo síndico: ${texto}` },
  };
}

export function reativarVendedor(estado, unidade) {
  const p = pessoaDaUnidade(estado, unidade);
  if (!p || p.vendedor !== 'suspenso') return erroVenda(estado, 'Vendedor não está suspenso');
  return {
    estado: mudarPessoa(estado, unidade, { vendedor: 'aprovado', motivoVendedor: null }),
    notificacao: { canal: 'WhatsApp', para: p.nome, texto: 'Suas vendas foram reativadas pelo síndico.' },
  };
}

export function publicarAnuncio(estado, unidade, dados, agora) {
  const pode = podePublicar(estado, unidade);
  if (!pode.ok) return erroVenda(estado, pode.motivo);
  const v = validarAnuncio(dados);
  if (!v.ok) return erroVenda(estado, v.motivo);
  const anuncio = { id: `a${estado.anuncios.length + 1}`, vendedor: unidade, titulo: textoLimpo(dados.titulo), descricao: textoLimpo(dados.descricao), categoria: dados.categoria || 'desapego', preco: dados.preco, quantidade: dados.quantidade, pagamentos: [...dados.pagamentos], entregas: [...dados.entregas], ativo: true, oculto: false, motivoOculto: null, criadoEm: agora.toISOString() };
  const destinatarios = destinatariosOfertas(estado, unidade);
  return {
    estado: { ...estado, anuncios: [...estado.anuncios, anuncio] },
    id: anuncio.id,
    notificacao: destinatarios.length ? { canal: 'Push', para: `${destinatarios.length} moradores que aceitam ofertas`, texto: `Novo na vitrine: ${anuncio.titulo}` } : undefined,
  };
}

export function editarAnuncio(estado, unidade, id, mudanca) {
  const a = anuncioPorId(estado, id);
  if (!a) return erroVenda(estado, 'Anúncio não encontrado');
  if (a.vendedor !== unidade) return erroVenda(estado, 'Só o vendedor pode editar o anúncio');
  const v = validarAnuncio({ ...a, ...mudanca });
  if (!v.ok) return erroVenda(estado, v.motivo);
  return { estado: mudarAnuncio(estado, id, mudanca) };
}

export function ocultarAnuncio(estado, id, motivo) {
  const a = anuncioPorId(estado, id);
  if (!a) return erroVenda(estado, 'Anúncio não encontrado');
  const texto = textoLimpo(motivo);
  if (!texto) return erroVenda(estado, 'Informe o motivo');
  return {
    estado: mudarAnuncio(estado, id, { oculto: true, motivoOculto: texto }),
    notificacao: { canal: 'WhatsApp', para: nomeVizinho(estado, a.vendedor), texto: `Seu anúncio "${a.titulo}" foi ocultado pelo síndico: ${texto}` },
  };
}

export function mostrarAnuncio(estado, id) {
  if (!anuncioPorId(estado, id)) return erroVenda(estado, 'Anúncio não encontrado');
  return { estado: mudarAnuncio(estado, id, { oculto: false, motivoOculto: null }) };
}

export function adicionarASacola(estado, anuncioId, quantidade) {
  const v = podeAdicionar(estado, estado.moradorAtual, anuncioId, quantidade);
  if (!v.ok) return erroVenda(estado, v.motivo);
  const existe = estado.sacola.some((i) => i.anuncioId === anuncioId);
  const sacola = existe
    ? estado.sacola.map((i) => (i.anuncioId === anuncioId ? { ...i, quantidade: i.quantidade + quantidade } : i))
    : [...estado.sacola, { anuncioId, quantidade }];
  return { estado: { ...estado, sacola } };
}

export function removerDaSacola(estado, anuncioId) {
  return { estado: { ...estado, sacola: estado.sacola.filter((i) => i.anuncioId !== anuncioId) } };
}

export function fecharPedido(estado, escolhas, agora) {
  const grupos = sacolaPorVendedor(estado);
  if (!grupos.length) return erroVenda(estado, 'Sua sacola está vazia');
  const comprador = estado.moradorAtual;
  for (const g of grupos) {
    const escolha = escolhas[g.vendedor] || {};
    if (!g.pagamentos.includes(escolha.pagamento)) return erroVenda(estado, 'Escolha a forma de pagamento');
    if (!g.entregas.includes(escolha.entrega)) return erroVenda(estado, 'Escolha a forma de entrega');
    for (const item of g.itens) {
      const v = podeAdicionar({ ...estado, sacola: [] }, comprador, item.anuncio.id, item.quantidade);
      if (!v.ok) return erroVenda(estado, `${item.anuncio.titulo}: ${v.motivo}`);
    }
  }
  const em = agora.toISOString();
  const novos = grupos.map((g, n) => ({
    id: `PD-${String(estado.proximoPedido + n).padStart(3, '0')}`,
    comprador,
    vendedor: g.vendedor,
    itens: g.itens.map((i) => ({ anuncioId: i.anuncio.id, titulo: i.anuncio.titulo, quantidade: i.quantidade, preco: i.anuncio.preco })),
    pagamento: escolhas[g.vendedor].pagamento,
    entrega: escolhas[g.vendedor].entrega,
    status: 'novo',
    pago: false,
    motivo: null,
    linha: [{ em, status: 'novo', texto: 'Pedido enviado' }],
    mensagens: [],
    criadoEm: em,
    entregueEm: null,
  }));
  const extras = novos.length - 1;
  const complemento = extras ? ` (e mais ${extras} pedido${extras > 1 ? 's' : ''} para outros vendedores)` : '';
  return {
    estado: { ...estado, anuncios: moverEstoque(estado.anuncios, novos.flatMap((p) => p.itens), -1), pedidos: [...estado.pedidos, ...novos], sacola: [], proximoPedido: estado.proximoPedido + novos.length },
    id: novos[0].id,
    ids: novos.map((p) => p.id),
    notificacao: { canal: 'WhatsApp', para: nomeVizinho(estado, novos[0].vendedor), texto: `Novo pedido ${novos[0].id} de ${nomeVizinho(estado, comprador)} (apto ${comprador})${complemento}` },
  };
}

function pedidoPermitido(estado, id, unidade, acao) {
  const pedido = estado.pedidos.find((p) => p.id === id);
  if (!pedido) return { erro: 'Pedido não encontrado' };
  if (!acoesPedido(pedido, unidade).includes(acao)) return { erro: 'Ação não permitida para este pedido' };
  return { pedido };
}

function comLinha(pedido, agora, status, texto) {
  return [...pedido.linha, { em: agora.toISOString(), status, texto }];
}

export function aceitarPedido(estado, id, unidade, agora) {
  const { pedido, erro } = pedidoPermitido(estado, id, unidade, 'aceitar');
  if (erro) return erroVenda(estado, erro);
  return {
    estado: mudarPedido(estado, id, { status: 'aceito', linha: comLinha(pedido, agora, 'aceito', 'Pedido aceito pelo vendedor') }),
    notificacao: { canal: 'Push', para: nomeVizinho(estado, pedido.comprador), texto: `Pedido ${id} aceito por ${nomeVizinho(estado, pedido.vendedor)}` },
  };
}

export function recusarPedido(estado, id, unidade, motivo, agora) {
  const { pedido, erro } = pedidoPermitido(estado, id, unidade, 'recusar');
  if (erro) return erroVenda(estado, erro);
  const texto = textoLimpo(motivo);
  if (!texto) return erroVenda(estado, 'Informe o motivo da recusa');
  const atualizado = mudarPedido(estado, id, { status: 'recusado', motivo: texto, linha: comLinha(pedido, agora, 'recusado', `Recusado: ${texto}`) });
  return {
    estado: { ...atualizado, anuncios: moverEstoque(estado.anuncios, pedido.itens, 1) },
    notificacao: { canal: 'Push', para: nomeVizinho(estado, pedido.comprador), texto: `Pedido ${id} recusado: ${texto}` },
  };
}

export function marcarEntregue(estado, id, unidade, agora) {
  const { pedido, erro } = pedidoPermitido(estado, id, unidade, 'entregar');
  if (erro) return erroVenda(estado, erro);
  return {
    estado: mudarPedido(estado, id, { status: 'entregue', entregueEm: agora.toISOString(), linha: comLinha(pedido, agora, 'entregue', 'Pedido entregue') }),
    notificacao: { canal: 'Push', para: nomeVizinho(estado, pedido.comprador), texto: `Pedido ${id} marcado como entregue` },
  };
}

export function marcarPago(estado, id, unidade, agora) {
  const { pedido, erro } = pedidoPermitido(estado, id, unidade, 'pago');
  if (erro) return erroVenda(estado, erro);
  return {
    estado: mudarPedido(estado, id, { pago: true, linha: comLinha(pedido, agora, null, 'Pagamento confirmado pelo vendedor') }),
    notificacao: { canal: 'Push', para: nomeVizinho(estado, pedido.comprador), texto: `Pagamento do pedido ${id} confirmado` },
  };
}

export function cancelarPedido(estado, id, unidade, agora) {
  const { pedido, erro } = pedidoPermitido(estado, id, unidade, 'cancelar');
  if (erro) return erroVenda(estado, erro);
  const atualizado = mudarPedido(estado, id, { status: 'cancelado', linha: comLinha(pedido, agora, 'cancelado', 'Cancelado pelo comprador') });
  return {
    estado: { ...atualizado, anuncios: moverEstoque(estado.anuncios, pedido.itens, 1) },
    notificacao: { canal: 'Push', para: nomeVizinho(estado, pedido.vendedor), texto: `Pedido ${id} cancelado pelo comprador` },
  };
}

export function enviarMensagem(estado, id, unidade, texto, agora) {
  const { pedido, erro } = pedidoPermitido(estado, id, unidade, 'conversar');
  if (erro) return erroVenda(estado, erro);
  const mensagem = textoLimpo(texto);
  if (!mensagem) return erroVenda(estado, 'Escreva a mensagem');
  const outro = unidade === pedido.vendedor ? pedido.comprador : pedido.vendedor;
  return {
    estado: mudarPedido(estado, id, { mensagens: [...pedido.mensagens, { autor: unidade, texto: mensagem, em: agora.toISOString() }] }),
    notificacao: { canal: 'Push', para: nomeVizinho(estado, outro), texto: `${nomeVizinho(estado, unidade)}: ${mensagem}` },
  };
}
