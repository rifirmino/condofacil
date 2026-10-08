import { html, useState } from '../vendor.js';
import { CATEGORIAS_VENDA, PAGAMENTOS, ENTREGAS, NOMES_STATUS_PEDIDO } from '../vendas/dados.js';
import { anunciosVisiveis, anuncioPorId, pessoaDaUnidade, nomeVizinho, sacolaPorVendedor, acoesPedido, totalPedido, painelVendas, fmtCentavos, lerPreco } from '../vendas/regras.js';
import { adicionarASacola, removerDaSacola, fecharPedido, aceitarPedido, recusarPedido, marcarEntregue, marcarPago, cancelarPedido, enviarMensagem, pedirParaVender, publicarAnuncio, editarAnuncio } from '../vendas/acoes.js';
import { fmtDataHora, fmtDataCurta } from '../datas.js';
import { ir, Campo, Erro, Sucesso, Vazio, Etiqueta, Icone, QuadroIcone } from './comum.js';

const ETQ_PEDIDO = { novo: 'alerta', aceito: 'info', entregue: 'ok', recusado: 'perigo', cancelado: 'neutro' };
const ROTULOS_ACAO_PEDIDO = { aceitar: 'Aceitar pedido', recusar: 'Recusar', entregar: 'Marcar como entregue', pago: 'Marcar como pago', cancelar: 'Cancelar pedido' };
const PERIODOS_PAINEL = [['7d', 'Últimos 7 dias'], ['30d', 'Últimos 30 dias'], ['mes', 'Este mês']];

function EtqPedido({ status }) {
  return html`<${Etiqueta} tipo=${ETQ_PEDIDO[status]}>${NOMES_STATUS_PEDIDO[status]}<//>`;
}

function FotoProduto({ categoria }) {
  return html`<div class="foto-produto" role="img" aria-label=${`Foto simulada: ${CATEGORIAS_VENDA[categoria]}`}><${Icone} nome="etiqueta" tamanho=${26} /><span>${CATEGORIAS_VENDA[categoria]}</span></div>`;
}

export function CartaoAnuncio({ estado, anuncio, eu }) {
  return html`<a class="cartao link anuncio" href=${`#morador.vendas.${anuncio.id}`}>
    <${FotoProduto} categoria=${anuncio.categoria} />
    <strong>${anuncio.titulo}</strong>
    <span class="preco">${fmtCentavos(anuncio.preco)}</span>
    ${anuncio.quantidade ? html`<small class="sub">Restam ${anuncio.quantidade}</small>` : html`<${Etiqueta} tipo="perigo">Esgotado<//>`}
    <small class="sub">${anuncio.vendedor === eu ? 'Seu anúncio' : `${nomeVizinho(estado, anuncio.vendedor)} · apto ${anuncio.vendedor}`}</small>
  </a>`;
}

export function TelaVendas(props) {
  const { estado, rota, eu } = props;
  const id = rota.id;
  const pessoa = pessoaDaUnidade(estado, eu);
  const naSacola = estado.sacola.reduce((soma, i) => soma + i.quantidade, 0);
  let conteudo;
  let aba = 'vitrine';
  if (id === 'sacola') {
    conteudo = html`<${VSacola} ...${props} />`;
    aba = 'sacola';
  } else if (id === 'pedidos') {
    conteudo = html`<${VMeusPedidos} ...${props} />`;
    aba = 'pedidos';
  } else if (id === 'loja' || id === 'novo-anuncio') {
    conteudo = id === 'loja' ? html`<${VLoja} ...${props} />` : html`<${VNovoAnuncio} ...${props} />`;
    aba = 'loja';
  } else if (id && id.startsWith('PD-')) {
    const pedido = estado.pedidos.find((p) => p.id === id && (p.comprador === eu || p.vendedor === eu));
    conteudo = pedido ? html`<${VPedido} key=${pedido.id} ...${props} pedido=${pedido} />` : html`<${Vazio} texto="Pedido não encontrado." />`;
    aba = pedido && pedido.vendedor === eu ? 'loja' : 'pedidos';
  } else if (id && anuncioPorId(estado, id)) {
    conteudo = html`<${VAnuncio} key=${id} ...${props} anuncio=${anuncioPorId(estado, id)} />`;
  } else {
    conteudo = html`<${VVitrine} ...${props} />`;
  }
  const links = [['vitrine', 'Vitrine', '#morador.vendas'], ['pedidos', 'Meus pedidos', '#morador.vendas.pedidos'], ['loja', pessoa.vendedor === 'aprovado' ? 'Minha loja' : 'Quero vender', '#morador.vendas.loja']];
  return html`<section class="m-pagina">
    <h1 class="m-titulo">Vendas</h1>
    <nav class="vendas-nav" aria-label="Vendas">
      ${links.map(([chave, nome, href]) => html`<a key=${chave} href=${href} class=${aba === chave ? 'ativa' : ''} aria-current=${aba === chave ? 'page' : undefined}>${nome}</a>`)}
      <a class=${`sacola${aba === 'sacola' ? ' ativa' : ''}`} href="#morador.vendas.sacola" aria-label=${`Sacola com ${naSacola} ${naSacola === 1 ? 'item' : 'itens'}`}><${Icone} nome="sacola" tamanho=${20} />${naSacola}</a>
    </nav>
    ${conteudo}
  </section>`;
}

function VVitrine({ estado, eu }) {
  const [categoria, setCategoria] = useState('todas');
  const [busca, setBusca] = useState('');
  const termo = busca.trim().toLowerCase();
  const lista = anunciosVisiveis(estado).filter((a) => (categoria === 'todas' || a.categoria === categoria) && (!termo || `${a.titulo} ${a.descricao}`.toLowerCase().includes(termo)));
  return html`<div class="pilha">
    <${Campo} rotulo="Buscar na vitrine"><input id="vitrine-busca" type="search" value=${busca} onInput=${(ev) => setBusca(ev.target.value)} placeholder="Ex.: brigadeiro, bicicleta" /><//>
    <div class="chips" role="group" aria-label="Categoria">
      ${[['todas', 'Todas'], ...Object.entries(CATEGORIAS_VENDA)].map(([chave, nome]) => html`<button type="button" key=${chave} class="chip" aria-pressed=${categoria === chave} onClick=${() => setCategoria(chave)}>${nome}</button>`)}
    </div>
    ${lista.length
      ? html`<ul class="anuncios">${lista.map((a) => html`<li key=${a.id}><${CartaoAnuncio} estado=${estado} anuncio=${a} eu=${eu} /></li>`)}</ul>`
      : html`<${Vazio} texto="Nenhum anúncio encontrado." />`}
  </div>`;
}

function VAnuncio({ estado, eu, executar, anuncio }) {
  const [quantidade, setQuantidade] = useState('1');
  const [erro, setErro] = useState(null);
  const [adicionado, setAdicionado] = useState(false);
  const proprio = anuncio.vendedor === eu;

  function adicionar() {
    const r = executar((e) => adicionarASacola(e, anuncio.id, Number(quantidade)));
    setErro(r.erro || null);
    setAdicionado(!r.erro);
  }

  return html`<div class="pilha">
    <a class="voltar" href="#morador.vendas">‹ Vitrine</a>
    <${FotoProduto} categoria=${anuncio.categoria} />
    <p class="anuncio-titulo">${anuncio.titulo}</p>
    <p class="preco grande">${fmtCentavos(anuncio.preco)}</p>
    <p class="m-texto">${anuncio.descricao}</p>
    <dl class="resumo">
      <dt>Vendedor</dt><dd>${nomeVizinho(estado, anuncio.vendedor)} · apto ${anuncio.vendedor}</dd>
      <dt>Pagamento</dt><dd>${anuncio.pagamentos.map((k) => PAGAMENTOS[k]).join(', ')}</dd>
      <dt>Entrega</dt><dd>${anuncio.entregas.map((k) => ENTREGAS[k]).join(', ')}</dd>
      <dt>Disponível</dt><dd>${anuncio.quantidade ? `Restam ${anuncio.quantidade}` : 'Esgotado'}</dd>
    </dl>
    ${proprio
      ? html`<p class="sub">Este anúncio é seu. Altere preço e quantidade em Minha loja.</p>`
      : html`<${Campo} rotulo="Quantidade"><input id="anuncio-quantidade" type="number" min="1" max=${anuncio.quantidade} inputmode="numeric" value=${quantidade} onInput=${(ev) => setQuantidade(ev.target.value)} /><//>
        <${Erro} texto=${erro} />
        ${adicionado && html`<p class="sucesso" role="status">Adicionado à sacola. <a href="#morador.vendas.sacola">Ver sacola</a></p>`}
        <button type="button" class="btn primario bloco" disabled=${!anuncio.quantidade} onClick=${adicionar}>Adicionar à sacola</button>`}
  </div>`;
}

function VSacola({ estado, executar }) {
  const grupos = sacolaPorVendedor(estado);
  const [escolhas, setEscolhas] = useState({});
  const [erro, setErro] = useState(null);
  const escolhaDe = (g) => {
    const feita = escolhas[g.vendedor] || {};
    return {
      pagamento: feita.pagamento || (g.pagamentos.length === 1 ? g.pagamentos[0] : ''),
      entrega: feita.entrega || (g.entregas.length === 1 ? g.entregas[0] : ''),
    };
  };

  function escolher(vendedor, campo, valor) {
    setEscolhas({ ...escolhas, [vendedor]: { ...(escolhas[vendedor] || {}), [campo]: valor } });
  }

  function fechar() {
    const finais = Object.fromEntries(grupos.map((g) => [g.vendedor, escolhaDe(g)]));
    const r = executar((e) => fecharPedido(e, finais, new Date()));
    if (r.erro) {
      setErro(r.erro);
      return;
    }
    ir('morador', 'vendas', r.id);
  }

  if (!grupos.length) {
    return html`<div class="pilha"><${Vazio} texto="Sua sacola está vazia." /><a class="btn secundario" href="#morador.vendas">Ver a vitrine</a></div>`;
  }
  const total = grupos.reduce((soma, g) => soma + g.subtotal, 0);
  const opcoes = (g, campo, nomes, lista, vazio) => (lista.length
    ? lista.map((k) => html`<label key=${k} class="check"><input id=${`${campo}-${g.vendedor}-${k}`} type="radio" name=${`${campo}-${g.vendedor}`} checked=${escolhaDe(g)[campo] === k} onChange=${() => escolher(g.vendedor, campo, k)} /><span>${nomes[k]}</span></label>`)
    : html`<small class="sub">${vazio}</small>`);
  return html`<div class="pilha">
    <h2>Sacola</h2>
    ${grupos.map((g) => html`<article key=${g.vendedor} class="cartao">
      <strong>${g.nome} · apto ${g.vendedor}</strong>
      <ul class="itens-sacola">${g.itens.map((i) => html`<li key=${i.anuncio.id}>
        <span>${i.quantidade} × ${i.anuncio.titulo}</span>
        <span>${fmtCentavos(i.subtotal)}</span>
        <button type="button" class="btn-link" onClick=${() => executar((e) => removerDaSacola(e, i.anuncio.id))}>Remover</button>
      </li>`)}</ul>
      <fieldset><legend>Pagamento</legend>${opcoes(g, 'pagamento', PAGAMENTOS, g.pagamentos, 'Estes itens não têm forma de pagamento em comum. Faça pedidos separados.')}</fieldset>
      <fieldset><legend>Entrega</legend>${opcoes(g, 'entrega', ENTREGAS, g.entregas, 'Estes itens não têm forma de entrega em comum. Faça pedidos separados.')}</fieldset>
      <div class="linha-entre"><span class="sub">Subtotal</span><strong>${fmtCentavos(g.subtotal)}</strong></div>
    </article>`)}
    <div class="linha-entre total"><span>Total</span><strong>${fmtCentavos(total)}</strong></div>
    <p class="sub">O pagamento é combinado direto com o vendedor. O app registra o pedido e a conversa.</p>
    <${Erro} texto=${erro} />
    <button type="button" class="btn primario bloco" onClick=${fechar}>Fechar pedido</button>
  </div>`;
}

function LinhaPedido({ estado, pedido, outro }) {
  return html`<a class=${`cartao link${pedido.status === 'novo' ? ' destaque' : ''}`} href=${`#morador.vendas.${pedido.id}`}>
    <div class="linha-entre"><strong>${pedido.id}</strong><${EtqPedido} status=${pedido.status} /></div>
    <span>${nomeVizinho(estado, outro)} · apto ${outro}</span>
    <small class="sub">${pedido.itens.map((i) => `${i.quantidade} × ${i.titulo}`).join(', ')} · ${fmtCentavos(totalPedido(pedido))} · ${fmtDataHora(pedido.criadoEm)}</small>
  </a>`;
}

function VMeusPedidos({ estado, eu }) {
  const lista = estado.pedidos.filter((p) => p.comprador === eu).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  return html`<div class="pilha">
    <h2>Meus pedidos</h2>
    ${lista.length
      ? html`<ul class="m-lista">${lista.map((p) => html`<li key=${p.id}><${LinhaPedido} estado=${estado} pedido=${p} outro=${p.vendedor} /></li>`)}</ul>`
      : html`<${Vazio} texto="Você ainda não fez pedidos." />`}
  </div>`;
}

function VPedido({ estado, eu, executar, pedido }) {
  const [mensagem, setMensagem] = useState('');
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState(null);
  const souVendedor = pedido.vendedor === eu;
  const outro = souVendedor ? pedido.comprador : pedido.vendedor;
  const acoes = acoesPedido(pedido, eu);
  const botoes = acoes.filter((a) => a !== 'conversar');

  function rodar(acao) {
    const r = executar(acao);
    setErro(r.erro || null);
    return r;
  }

  function agir(acao) {
    if (acao === 'recusar') {
      setRecusando(true);
      return;
    }
    const funcoes = { aceitar: aceitarPedido, entregar: marcarEntregue, pago: marcarPago, cancelar: cancelarPedido };
    rodar((e) => funcoes[acao](e, pedido.id, eu, new Date()));
  }

  function recusar() {
    if (!rodar((e) => recusarPedido(e, pedido.id, eu, motivo, new Date())).erro) setRecusando(false);
  }

  function enviar() {
    if (!rodar((e) => enviarMensagem(e, pedido.id, eu, mensagem, new Date())).erro) setMensagem('');
  }

  return html`<div class="pilha">
    <a class="voltar" href=${souVendedor ? '#morador.vendas.loja' : '#morador.vendas.pedidos'}>‹ ${souVendedor ? 'Minha loja' : 'Meus pedidos'}</a>
    <p class="protocolo">Pedido ${pedido.id}</p>
    <div class="linha-entre">
      <strong>${souVendedor ? 'Comprador' : 'Vendedor'}: ${nomeVizinho(estado, outro)} · apto ${outro}</strong>
      <span class="etq-linha"><${EtqPedido} status=${pedido.status} />${pedido.pago && html`<${Etiqueta} tipo="ok">Pago<//>`}</span>
    </div>
    <ul class="itens-sacola">${pedido.itens.map((i, n) => html`<li key=${n}><span>${i.quantidade} × ${i.titulo}</span><span>${fmtCentavos(i.preco * i.quantidade)}</span></li>`)}</ul>
    <div class="linha-entre total"><span>Total</span><strong>${fmtCentavos(totalPedido(pedido))}</strong></div>
    <p class="sub">${PAGAMENTOS[pedido.pagamento]} · ${ENTREGAS[pedido.entrega]}${pedido.motivo ? ` · Motivo: ${pedido.motivo}` : ''}</p>
    ${botoes.length > 0 && html`<div class="acoes">${botoes.map((a) => html`<button type="button" key=${a} class=${['aceitar', 'entregar'].includes(a) ? 'btn primario' : 'btn secundario'} onClick=${() => agir(a)}>${ROTULOS_ACAO_PEDIDO[a]}</button>`)}</div>`}
    ${recusando && html`<div class="cartao">
      <${Campo} rotulo="Motivo da recusa"><input id="pedido-motivo" value=${motivo} onInput=${(ev) => setMotivo(ev.target.value)} placeholder="Ex.: sem ingredientes hoje" /><//>
      <div class="acoes">
        <button type="button" class="btn perigo" onClick=${recusar}>Confirmar recusa</button>
        <button type="button" class="btn secundario" onClick=${() => setRecusando(false)}>Voltar</button>
      </div>
    </div>`}
    <${Erro} texto=${erro} />
    <h2>Andamento</h2>
    <ol class="linha-tempo">${pedido.linha.map((l, n) => html`<li key=${n} class=${l.status ? 'marco' : 'comentario'}>
      <span class="lt-quando">${fmtDataHora(l.em)}</span>
      <strong>${l.status ? NOMES_STATUS_PEDIDO[l.status] : 'Pagamento'}</strong>
      <span>${l.texto}</span>
    </li>`)}</ol>
    <h2>Conversa</h2>
    <ul class="conversa">
      ${pedido.mensagens.length
        ? pedido.mensagens.map((m, n) => html`<li key=${n} class=${m.autor === eu ? 'minha' : 'outra'}><span>${m.texto}</span><small>${m.autor === eu ? 'Você' : nomeVizinho(estado, m.autor)} · ${fmtDataHora(m.em)}</small></li>`)
        : html`<li class="sem-mensagem">Nenhuma mensagem ainda.</li>`}
    </ul>
    ${acoes.includes('conversar') && html`<div class="enviar-mensagem">
      <${Campo} rotulo="Mensagem"><input id="pedido-mensagem" value=${mensagem} onInput=${(ev) => setMensagem(ev.target.value)} placeholder=${`Escreva para ${nomeVizinho(estado, outro).split(' ')[0]}`} /><//>
      <button type="button" class="btn primario" onClick=${enviar}>Enviar</button>
    </div>`}
  </div>`;
}

function VLoja(props) {
  const { estado, eu } = props;
  const [aba, setAba] = useState('pedidos');
  const pessoa = pessoaDaUnidade(estado, eu);
  if (pessoa.vendedor !== 'aprovado') return html`<${VConvite} ...${props} />`;
  const recebidos = estado.pedidos
    .filter((p) => p.vendedor === eu)
    .sort((a, b) => Number(b.status === 'novo') - Number(a.status === 'novo') || b.criadoEm.localeCompare(a.criadoEm));
  const novos = recebidos.filter((p) => p.status === 'novo').length;
  const abas = [['pedidos', novos ? `Pedidos (${novos} ${novos === 1 ? 'novo' : 'novos'})` : 'Pedidos'], ['anuncios', 'Meus anúncios'], ['painel', 'Painel']];
  return html`<div class="pilha">
    <div class="chips" role="group" aria-label="Minha loja">
      ${abas.map(([chave, nome]) => html`<button type="button" key=${chave} class="chip" aria-pressed=${aba === chave} onClick=${() => setAba(chave)}>${nome}</button>`)}
    </div>
    ${aba === 'pedidos' && (recebidos.length
      ? html`<ul class="m-lista">${recebidos.map((p) => html`<li key=${p.id}><${LinhaPedido} estado=${estado} pedido=${p} outro=${p.comprador} /></li>`)}</ul>`
      : html`<${Vazio} texto="Nenhum pedido recebido ainda." />`)}
    ${aba === 'anuncios' && html`<${VMeusAnuncios} ...${props} />`}
    ${aba === 'painel' && html`<${VPainel} ...${props} />`}
  </div>`;
}

function VMeusAnuncios({ estado, eu, executar }) {
  const meus = estado.anuncios.filter((a) => a.vendedor === eu).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  return html`<a class="btn primario bloco" href="#morador.vendas.novo-anuncio">Novo anúncio</a>
    ${meus.length
      ? html`<ul class="m-lista">${meus.map((a) => html`<li key=${a.id}><${EditorAnuncio} anuncio=${a} eu=${eu} executar=${executar} /></li>`)}</ul>`
      : html`<${Vazio} texto="Você ainda não tem anúncios." />`}`;
}

function EditorAnuncio({ anuncio, eu, executar }) {
  const [preco, setPreco] = useState((anuncio.preco / 100).toFixed(2).replace('.', ','));
  const [quantidade, setQuantidade] = useState(String(anuncio.quantidade));
  const [mensagem, setMensagem] = useState(null);
  const [erro, setErro] = useState(null);

  function salvar(mudanca) {
    const r = executar((e) => editarAnuncio(e, eu, anuncio.id, mudanca));
    setErro(r.erro || null);
    setMensagem(r.erro ? null : 'Anúncio atualizado.');
  }

  let situacao = html`<${Etiqueta} tipo="ok">Na vitrine<//>`;
  if (anuncio.oculto) situacao = html`<${Etiqueta} tipo="perigo">Oculto pelo síndico<//>`;
  else if (!anuncio.ativo) situacao = html`<${Etiqueta}>Pausado<//>`;
  return html`<article class="cartao">
    <div class="linha-entre"><strong>${anuncio.titulo}</strong>${situacao}</div>
    ${anuncio.oculto && html`<small class="sub">Motivo: ${anuncio.motivoOculto}</small>`}
    <div class="edicao-anuncio">
      <${Campo} rotulo="Preço (R$)"><input id=${`preco-${anuncio.id}`} inputmode="decimal" value=${preco} onInput=${(ev) => setPreco(ev.target.value)} /><//>
      <${Campo} rotulo="Disponível"><input id=${`quantidade-${anuncio.id}`} type="number" min="0" value=${quantidade} onInput=${(ev) => setQuantidade(ev.target.value)} /><//>
    </div>
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
    <div class="acoes">
      <button type="button" class="btn secundario" onClick=${() => salvar({ preco: lerPreco(preco), quantidade: quantidade === '' ? NaN : Number(quantidade) })}>Salvar</button>
      <button type="button" class="btn secundario" onClick=${() => salvar({ ativo: !anuncio.ativo })}>${anuncio.ativo ? 'Pausar' : 'Retomar'}</button>
    </div>
  </article>`;
}

function VNovoAnuncio({ estado, eu, executar }) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('doces');
  const [preco, setPreco] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [pagamentos, setPagamentos] = useState([]);
  const [entregas, setEntregas] = useState([]);
  const [erro, setErro] = useState(null);
  if (pessoaDaUnidade(estado, eu).vendedor !== 'aprovado') return html`<${VConvite} estado=${estado} eu=${eu} executar=${executar} />`;
  const alternar = (lista, definir, chave) => definir(lista.includes(chave) ? lista.filter((x) => x !== chave) : [...lista, chave]);

  function publicar() {
    const dados = { titulo, descricao, categoria, preco: lerPreco(preco), quantidade: quantidade === '' ? NaN : Number(quantidade), pagamentos, entregas };
    const r = executar((e) => publicarAnuncio(e, eu, dados, new Date()));
    if (r.erro) {
      setErro(r.erro);
      return;
    }
    ir('morador', 'vendas', 'loja');
  }

  return html`<div class="pilha">
    <a class="voltar" href="#morador.vendas.loja">‹ Minha loja</a>
    <h2>Novo anúncio</h2>
    <${Campo} rotulo="Título"><input id="novo-titulo" value=${titulo} onInput=${(ev) => setTitulo(ev.target.value)} placeholder="Ex.: Bolo de cenoura com chocolate" /><//>
    <${Campo} rotulo="Descrição"><textarea id="novo-descricao" rows="3" value=${descricao} onInput=${(ev) => setDescricao(ev.target.value)}></textarea><//>
    <${Campo} rotulo="Categoria"><select id="novo-categoria" value=${categoria} onChange=${(ev) => setCategoria(ev.target.value)}>${Object.entries(CATEGORIAS_VENDA).map(([chave, nome]) => html`<option key=${chave} value=${chave}>${nome}</option>`)}</select><//>
    <div class="edicao-anuncio">
      <${Campo} rotulo="Preço (R$)"><input id="novo-preco" inputmode="decimal" value=${preco} onInput=${(ev) => setPreco(ev.target.value)} placeholder="Ex.: 18,00" /><//>
      <${Campo} rotulo="Quantidade"><input id="novo-quantidade" type="number" min="0" value=${quantidade} onInput=${(ev) => setQuantidade(ev.target.value)} /><//>
    </div>
    <fieldset><legend>Pagamento aceito</legend>
      ${Object.entries(PAGAMENTOS).map(([chave, nome]) => html`<label key=${chave} class="check"><input id=${`novo-pagamento-${chave}`} type="checkbox" checked=${pagamentos.includes(chave)} onChange=${() => alternar(pagamentos, setPagamentos, chave)} /><span>${nome}</span></label>`)}
    </fieldset>
    <fieldset><legend>Entrega</legend>
      ${Object.entries(ENTREGAS).map(([chave, nome]) => html`<label key=${chave} class="check"><input id=${`novo-entrega-${chave}`} type="checkbox" checked=${entregas.includes(chave)} onChange=${() => alternar(entregas, setEntregas, chave)} /><span>${nome}</span></label>`)}
    </fieldset>
    <p class="sub">No protótipo, a foto do produto é simulada.</p>
    <${Erro} texto=${erro} />
    <button type="button" class="btn primario bloco" onClick=${publicar}>Publicar anúncio</button>
  </div>`;
}

// Gráfico de uma série: sem legenda (o título nomeia), barras em laranja escuro (contraste ≥ 3:1),
// valor visível só na maior barra e nas demais ao passar o mouse ou focar; tabela para leitores de tela.
function VPainel({ estado, eu, agora }) {
  const [periodo, setPeriodo] = useState('7d');
  const d = painelVendas(estado, eu, periodo, agora);
  const maximo = Math.max(...d.barras.map((b) => b.valor));
  const unidadeTempo = periodo === '7d' ? 'dia' : 'semana';
  const rotuloBarra = (b) => (periodo === '7d' ? fmtDataCurta(b.rotulo).slice(0, 5) : `sem. ${fmtDataCurta(b.rotulo).slice(0, 5)}`);
  const numeros = [['Faturamento', fmtCentavos(d.faturamento)], ['Pedidos', d.pedidos], ['Ticket médio', fmtCentavos(d.ticket)], ['Itens vendidos', d.itens]];
  return html`<div class="pilha">
    <div class="chips" role="group" aria-label="Período">
      ${PERIODOS_PAINEL.map(([chave, nome]) => html`<button type="button" key=${chave} class="chip" aria-pressed=${periodo === chave} onClick=${() => setPeriodo(chave)}>${nome}</button>`)}
    </div>
    <div class="numeros">${numeros.map(([rotulo, valor]) => html`<div key=${rotulo} class="numero"><span>${rotulo}</span><strong>${valor}</strong></div>`)}</div>
    <h2>Faturamento por ${unidadeTempo}</h2>
    <div class="grafico-barras" aria-hidden="true">
      ${d.barras.map((b) => html`<div key=${b.rotulo} class=${`coluna${maximo && b.valor === maximo ? ' maior' : ''}`} title=${`${rotuloBarra(b)}: ${fmtCentavos(b.valor)}`}>
        <span class="valor">${fmtCentavos(b.valor).replace(',00', '')}</span>
        <span class="barra-v" style=${`height:${maximo ? Math.round((b.valor / maximo) * 110) : 0}px`}></span>
        <span class="rotulo-x">${rotuloBarra(b)}</span>
      </div>`)}
    </div>
    <table class="so-leitor">
      <caption>Faturamento por ${unidadeTempo}</caption>
      <thead><tr><th>${periodo === '7d' ? 'Dia' : 'Semana a partir de'}</th><th>Faturamento</th></tr></thead>
      <tbody>${d.barras.map((b) => html`<tr key=${b.rotulo}><td>${fmtDataCurta(b.rotulo)}</td><td>${fmtCentavos(b.valor)}</td></tr>`)}</tbody>
    </table>
    <h2>Mais vendidos</h2>
    ${d.maisVendidos.length
      ? html`<ol class="mais-vendidos">${d.maisVendidos.map((m) => html`<li key=${m.titulo}><span>${m.titulo}</span><strong>${m.quantidade}</strong></li>`)}</ol>`
      : html`<${Vazio} texto="Nenhuma venda entregue no período." />`}
    <h2>Pedidos por situação</h2>
    <dl class="situacao-pedidos">
      <dt>Entregues</dt><dd>${d.situacao.entregues}</dd>
      <dt>Em andamento</dt><dd>${d.situacao.andamento}</dd>
      <dt>Recusados</dt><dd>${d.situacao.recusados}</dd>
      <dt>Cancelados</dt><dd>${d.situacao.cancelados}</dd>
    </dl>
  </div>`;
}

function VConvite({ estado, eu, executar }) {
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState(null);
  const pessoa = pessoaDaUnidade(estado, eu);

  function pedir() {
    const r = executar((e) => pedirParaVender(e, eu, texto, new Date()));
    setErro(r.erro || null);
  }

  if (pessoa.vendedor === 'pendente') {
    return html`<div class="cartao"><strong>Aguardando aprovação do síndico</strong><span class="sub">Você pediu para vender: ${pessoa.pedidoVenda.texto}</span></div>`;
  }
  if (pessoa.vendedor === 'suspenso') {
    return html`<p class="erro">Suas vendas estão suspensas pelo síndico. Motivo: ${pessoa.motivoVendedor}</p>`;
  }
  return html`<div class="pilha">
    <div class="convite">
      <${QuadroIcone} nome="loja" />
      <div><strong>Quer vender para os vizinhos?</strong><span class="sub">Doces, salgados, artesanato, desapego ou serviços. O síndico aprova e você começa a anunciar.</span></div>
    </div>
    ${pessoa.motivoVendedor && html`<p class="erro">Pedido anterior recusado: ${pessoa.motivoVendedor}</p>`}
    <${Campo} rotulo="O que você pretende vender?"><textarea id="convite-texto" rows="3" value=${texto} onInput=${(ev) => setTexto(ev.target.value)} placeholder="Ex.: bolos caseiros por encomenda"></textarea><//>
    <${Erro} texto=${erro} />
    <button type="button" class="btn primario bloco" onClick=${pedir}>Pedir para vender</button>
  </div>`;
}
