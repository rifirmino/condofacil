import { html, useState } from '../vendor.js';
import { PRIORIDADES, ORDEM_PRIORIDADE } from '../dados.js';
import { liberado } from '../planos.js';
import { fmtReais } from '../cobranca/regras.js';
import { NOMES_STATUS_OS, CATEGORIAS_COMPRA, ZELADOR } from '../manutencao/dados.js';
import { listaOS, cotacoesMinimas } from '../manutencao/regras.js';
import { abrirOS, validarOS, anexarCotacao, aprovarCompra, recusarCompra, reporCaixa } from '../manutencao/acoes.js';
import { lerPreco } from '../vendas/regras.js';
import { isoDia, fmtDataCurta, fmtDataHora } from '../datas.js';
import { ir, Campo, Erro, Sucesso, Vazio, Etiqueta, FotoFalsa, LinhaTempo } from './comum.js';
import { Bloqueado } from './financeiro-sindico.js';

const CORES_PRIORIDADE = { urgente: 'perigo', alta: 'alerta', normal: 'info', baixa: 'neutro' };
const CORES_STATUS_OS = { aberta: 'info', em_execucao: 'alerta', aguardando_material: 'neutro', aguardando_prestador: 'neutro', concluida: 'ok', validada: 'ok' };
const NOMES_STATUS_COMPRA = { solicitada: 'Aguardando aprovação', aprovada: 'Aprovada', recusada: 'Recusada', recebida: 'Recebida' };
const CORES_STATUS_COMPRA = { solicitada: 'alerta', aprovada: 'info', recusada: 'neutro', recebida: 'ok' };
const ABAS_MANUTENCAO = [['os', 'Ordens de serviço'], ['compras', 'Compras'], ['caixa', 'Caixa pequeno']];

export function EtqPrioridade({ prioridade }) {
  return html`<${Etiqueta} tipo=${CORES_PRIORIDADE[prioridade]}>${PRIORIDADES[prioridade].nome}<//>`;
}

export function EtqOS({ status }) {
  return html`<${Etiqueta} tipo=${CORES_STATUS_OS[status]}>${NOMES_STATUS_OS[status]}<//>`;
}

export function EtqCompra({ status }) {
  return html`<${Etiqueta} tipo=${CORES_STATUS_COMPRA[status]}>${NOMES_STATUS_COMPRA[status]}<//>`;
}

export function fmtPrazo(iso) {
  const d = new Date(iso);
  return `${fmtDataCurta(isoDia(d))} ${String(d.getHours()).padStart(2, '0')}h`;
}

export function FotosOS({ os }) {
  return html`<div class="fotos-reparo"><${FotoFalsa} rotulo="Foto do antes" />${os.fotoDepois && html`<${FotoFalsa} rotulo="Foto do depois" />`}</div>`;
}

export function SManutencao(props) {
  const { estado, rota } = props;
  if (!liberado(estado.plano, 'zelador')) {
    return html`<section><h1>Manutenção</h1><${Bloqueado} estado=${estado} recurso="zelador" titulo="Ordens de serviço, compras com aprovação e caixa pequeno do zelador" /></section>`;
  }
  const id = rota.id || '';
  const os = id.startsWith('OS-') ? estado.manutencao.os.find((o) => o.id === id) : null;
  const compra = id.startsWith('CP-') ? estado.manutencao.compras.find((c) => c.id === id) : null;
  const aba = compra ? 'compras' : os || id === 'novaos' ? 'os' : ABAS_MANUTENCAO.some(([a]) => a === id) ? id : 'os';
  let conteudo;
  if (os) conteudo = html`<${MDetalheOSSindico} key=${os.id} ...${props} os=${os} />`;
  else if (compra) conteudo = html`<${MDetalheCompraSindico} key=${compra.id} ...${props} compra=${compra} />`;
  else if (id === 'novaos') conteudo = html`<${MNovaOSSindico} ...${props} />`;
  else conteudo = { os: html`<${MListaOS} ...${props} />`, compras: html`<${MListaCompras} ...${props} />`, caixa: html`<${MCaixaSindico} ...${props} />` }[aba];
  return html`<section>
    <h1>Manutenção</h1>
    <p class="sub">Ordens de serviço e compras do zelador (${ZELADOR}). Cada compra recebida entra sozinha nas despesas do mês.</p>
    <nav class="chips" aria-label="Manutenção">${ABAS_MANUTENCAO.map(([a, nome]) => html`<a key=${a} class="chip" href=${`#sindico.manutencao.${a}`} aria-current=${aba === a ? 'page' : undefined}>${nome}</a>`)}</nav>
    ${conteudo}
  </section>`;
}

function MListaOS({ estado }) {
  const lista = listaOS(estado);
  return html`<div class="pilha">
    <div class="linha-entre"><h2>Ordens de serviço</h2><a class="btn primario" href="#sindico.manutencao.novaos">Nova OS</a></div>
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>OS</th><th>Local</th><th>Prioridade</th><th>Responsável</th><th>Prazo</th><th>Status</th><th>Ação</th></tr></thead>
      <tbody>${lista.map((o) => html`<tr key=${o.id}>
        <td>${o.id}${o.notificacao ? html`<br /><small class="sub">${o.notificacao}</small>` : ''}</td>
        <td>${o.local}</td>
        <td><${EtqPrioridade} prioridade=${o.prioridade} /></td>
        <td>${o.responsavel === 'prestador' ? o.prestador : ZELADOR}</td>
        <td>${fmtPrazo(o.prazo)}</td>
        <td><${EtqOS} status=${o.status} /></td>
        <td><a class="btn-link" data-os=${o.id} href=${`#sindico.manutencao.${o.id}`}>Abrir</a></td>
      </tr>`)}</tbody>
    </table></div>
  </div>`;
}

function MNovaOSSindico({ executar }) {
  const [local, setLocal] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState('normal');
  const [erro, setErro] = useState(null);

  function criar() {
    const r = executar((e) => abrirOS(e, { local, descricao, prioridade }, 'sindico', new Date()));
    if (r.erro) setErro(r.erro);
    else ir('sindico', 'manutencao', r.id);
  }

  return html`<div class="pilha formulario">
    <a class="voltar" href="#sindico.manutencao.os">‹ Ordens de serviço</a>
    <h2>Nova OS</h2>
    <${Campo} rotulo="Local"><input id="nova-os-local" value=${local} onInput=${(ev) => setLocal(ev.target.value)} placeholder="Ex.: casa de bombas, portão da garagem" /><//>
    <${Campo} rotulo="Descrição"><textarea id="nova-os-descricao" rows="3" value=${descricao} onInput=${(ev) => setDescricao(ev.target.value)}></textarea><//>
    <${Campo} rotulo="Prioridade"><select id="nova-os-prioridade" value=${prioridade} onChange=${(ev) => setPrioridade(ev.target.value)}>${ORDEM_PRIORIDADE.map((p) => html`<option key=${p} value=${p}>${PRIORIDADES[p].nome}</option>`)}</select><//>
    <${Erro} texto=${erro} />
    <button type="button" class="btn primario" onClick=${criar}>Criar OS</button>
  </div>`;
}

function MDetalheOSSindico({ executar, os }) {
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);

  function validar() {
    const r = executar((e) => validarOS(e, os.id, 'sindico', new Date()));
    setErro(r.erro || null);
    setMensagem(r.erro ? null : 'OS validada.');
  }

  return html`<div class="pilha">
    <a class="voltar" href="#sindico.manutencao.os">‹ Ordens de serviço</a>
    <div class="linha-entre"><h2>${os.id} · ${os.local}</h2><${EtqOS} status=${os.status} /></div>
    <p class="sub"><${EtqPrioridade} prioridade=${os.prioridade} /> · prazo ${fmtPrazo(os.prazo)} · ${os.responsavel === 'prestador' ? `prestador ${os.prestador}` : `zelador ${ZELADOR}`}${os.notificacao ? html` · notificação <a href=${`#sindico.ocorrencias.${os.notificacao}`}>${os.notificacao}</a>` : ''}</p>
    <p class="texto-longo">${os.descricao}</p>
    <${FotosOS} os=${os} />
    ${(os.materiais || os.horas > 0 || os.observacoes) && html`<dl class="resumo">
      <dt>Materiais</dt><dd>${os.materiais || '—'}</dd>
      <dt>Horas</dt><dd>${String(os.horas).replace('.', ',')} h</dd>
      <dt>Observações</dt><dd>${os.observacoes || '—'}</dd>
    </dl>`}
    <h2>Linha do tempo</h2>
    <${LinhaTempo} linha=${os.linha} nomes=${NOMES_STATUS_OS} />
    ${os.status === 'concluida' && html`<button type="button" class="btn primario" data-acao="validar-os" onClick=${validar}>Validar</button>`}
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
  </div>`;
}

function MListaCompras({ estado }) {
  const ordem = { solicitada: 0, aprovada: 1, recebida: 2, recusada: 3 };
  const lista = [...estado.manutencao.compras].sort((a, b) => ordem[a.status] - ordem[b.status] || b.criadaEm.localeCompare(a.criadaEm));
  return html`<div class="pilha">
    <h2>Compras</h2>
    ${lista.length
      ? html`<div class="tabela-rolagem"><table class="tabela">
          <thead><tr><th>Compra</th><th>Item</th><th>Valor</th><th>Cotações</th><th>Status</th><th>Ação</th></tr></thead>
          <tbody>${lista.map((c) => html`<tr key=${c.id}>
            <td>${c.id}${c.urgente ? html` <${Etiqueta} tipo="perigo">Urgente<//>` : ''}</td>
            <td>${c.item}</td>
            <td>${fmtReais(c.valorFinal || c.valorEstimado)}</td>
            <td>${c.cotacoes.length}</td>
            <td><${EtqCompra} status=${c.status} /></td>
            <td><a class="btn-link" data-compra=${c.id} href=${`#sindico.manutencao.${c.id}`}>Abrir</a></td>
          </tr>`)}</tbody>
        </table></div>`
      : html`<${Vazio} texto="Nenhuma compra pedida." />`}
  </div>`;
}

function MDetalheCompraSindico({ estado, executar, compra }) {
  const [fornecedor, setFornecedor] = useState('');
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const comCotacao = liberado(estado.plano, 'cotacoes');
  const minimo = cotacoesMinimas(compra.valorEstimado).minimo;

  function rodar(acao, sucesso, limpar) {
    const r = executar(acao);
    setErro(r.erro || null);
    setMensagem(r.erro ? null : sucesso);
    if (!r.erro && limpar) limpar();
  }

  return html`<div class="pilha">
    <a class="voltar" href="#sindico.manutencao.compras">‹ Compras</a>
    <div class="linha-entre"><h2>${compra.id} · ${compra.item}</h2><${EtqCompra} status=${compra.status} /></div>
    <dl class="resumo">
      <dt>Quantidade</dt><dd>${compra.quantidade}</dd>
      <dt>Valor estimado</dt><dd>${fmtReais(compra.valorEstimado)}</dd>
      <dt>Categoria</dt><dd>${CATEGORIAS_COMPRA[compra.categoria]}</dd>
      <dt>Motivo</dt><dd>${compra.motivo || '—'}</dd>
      <dt>OS</dt><dd>${compra.os ? html`<a href=${`#sindico.manutencao.${compra.os}`}>${compra.os}</a>` : '—'}</dd>
    </dl>
    <h2>Cotações${comCotacao ? ` · mínimo ${minimo}` : ''}</h2>
    ${compra.cotacoes.length
      ? html`<ul class="itens-sacola">${compra.cotacoes.map((q, n) => html`<li key=${n}><span>${q.fornecedor}</span><span>${fmtReais(q.valor)}</span></li>`)}</ul>`
      : html`<${Vazio} texto="Nenhuma cotação anexada." />`}
    ${comCotacao && compra.status === 'solicitada' && html`<div class="edicao-anuncio">
      <${Campo} rotulo="Fornecedor"><input id="cotacao-fornecedor" value=${fornecedor} onInput=${(ev) => setFornecedor(ev.target.value)} /><//>
      <${Campo} rotulo="Valor (R$)"><input id="cotacao-valor" inputmode="decimal" value=${valor} onInput=${(ev) => setValor(ev.target.value)} /><//>
    </div>
    <button type="button" class="btn secundario" onClick=${() => rodar((e) => anexarCotacao(e, compra.id, { fornecedor, valor: lerPreco(valor) }, 'sindico'), 'Cotação anexada.', () => { setFornecedor(''); setValor(''); })}>Anexar cotação</button>`}
    ${compra.status === 'solicitada' && html`<div class="cartao">
      <div class="acoes"><button type="button" class="btn primario" data-acao="aprovar-compra" onClick=${() => rodar((e) => aprovarCompra(e, compra.id, 'sindico', new Date()), 'Compra aprovada.')}>Aprovar</button></div>
      <${Campo} rotulo="Motivo da recusa"><input id="compra-motivo-recusa" value=${motivo} onInput=${(ev) => setMotivo(ev.target.value)} /><//>
      <div class="acoes"><button type="button" class="btn secundario" onClick=${() => rodar((e) => recusarCompra(e, compra.id, motivo, 'sindico'), 'Compra recusada.')}>Recusar</button></div>
    </div>`}
    ${compra.status === 'recusada' && html`<p class="sub">Recusada: ${compra.motivoRecusa}</p>`}
    ${compra.status === 'recebida' && html`<p class="sucesso">Recebida em ${fmtDataHora(compra.recebidaEm)} · ${fmtReais(compra.valorFinal)} · nota ${compra.nota || '—'} · lançada em despesas</p>`}
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
  </div>`;
}

export function ResumoCaixa({ caixa }) {
  return html`<div class="pilha">
    <div class="cartao"><span class="sub">Saldo do caixa pequeno</span><span class="preco grande">${fmtReais(caixa.saldo)}</span><small class="sub">Fundo de ${fmtReais(caixa.fundo)} por mês · gastos até R$ 200,00 com foto do cupom</small></div>
    ${caixa.gastos.length
      ? html`<ul class="itens-sacola">${[...caixa.gastos].reverse().map((g) => html`<li key=${g.id}><span>${g.descricao} · ${fmtDataHora(g.em)} · cupom anexado</span><span>${fmtReais(g.valor)}</span></li>`)}</ul>`
      : html`<${Vazio} texto="Nenhum gasto no mês." />`}
  </div>`;
}

function MCaixaSindico({ estado, executar }) {
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  if (!liberado(estado.plano, 'caixaPequeno')) return html`<${Bloqueado} estado=${estado} recurso="caixaPequeno" titulo="Caixa pequeno do zelador com cupom, saldo e reposição" />`;
  const caixa = estado.manutencao.caixa;

  function repor() {
    const r = executar((e) => reporCaixa(e, 'sindico', new Date()));
    setErro(r.erro || null);
    setMensagem(r.erro ? null : 'Fundo reposto e lançado em despesas.');
  }

  return html`<div class="pilha">
    <h2>Caixa pequeno</h2>
    <${ResumoCaixa} caixa=${caixa} />
    <button type="button" class="btn primario" onClick=${repor}>Repor fundo</button>
    ${caixa.reposicoes.length > 0 && html`<small class="sub">Última reposição: ${fmtReais(caixa.reposicoes.at(-1).valor)} em ${fmtDataHora(caixa.reposicoes.at(-1).em)}</small>`}
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
  </div>`;
}
