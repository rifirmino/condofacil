import { html, useState } from '../vendor.js';
import { TRANSPORTADORAS, PORTEIRO_DIA } from '../dados.js';
import { areaPorId, moradoresDaUnidade, encomendaParada } from '../regras.js';
import { registrarEncomenda, entregarEncomenda } from '../acoes.js';
import { isoDia, fmtHora, haQuanto } from '../datas.js';
import { Campo, Erro, Vazio, FotoFalsa, Etiqueta } from './comum.js';

const ABAS_PORTARIA = [['registrar', 'Registrar'], ['entregar', 'Entregar'], ['hoje', 'Reservas de hoje']];

export function TelaPortaria(props) {
  const tela = ABAS_PORTARIA.some(([id]) => id === props.rota.tela) ? props.rota.tela : 'registrar';
  const Conteudo = { registrar: PRegistrar, entregar: PEntregar, hoje: PReservasHoje }[tela];
  return html`<div class="tablet">
    <header class="tab-topo">
      <strong>Portaria</strong>
      <nav class="tab-abas" aria-label="Portaria">
        ${ABAS_PORTARIA.map(([id, nome]) => html`<a key=${id} href=${`#portaria.${id}`} class=${id === tela ? 'ativa' : ''} aria-current=${id === tela ? 'page' : undefined}>${nome}</a>`)}
      </nav>
      <span class="tab-turno">${PORTEIRO_DIA} · turno do dia</span>
    </header>
    <div class="tab-conteudo"><${Conteudo} ...${props} /></div>
  </div>`;
}

function PRegistrar({ estado, executar }) {
  const [unidade, setUnidade] = useState('');
  const [transportadora, setTransportadora] = useState('');
  const [foto, setFoto] = useState(false);
  const [lida, setLida] = useState(null);
  const [erro, setErro] = useState(null);
  const [registrada, setRegistrada] = useState(null);
  const numero = unidade.trim();
  const moradores = moradoresDaUnidade(estado, numero);

  function lerEtiqueta() {
    setUnidade('302');
    setTransportadora('Mercado Livre');
    setFoto(true);
    setErro(null);
    setLida('Etiqueta lida: ANA SOUZA · APTO 302 · MERCADO LIVRE');
  }

  function registrar() {
    const r = executar((e) => registrarEncomenda(e, { unidade: numero, transportadora, foto, porteiro: PORTEIRO_DIA }, new Date()));
    if (r.erro) {
      setErro(r.erro);
      return;
    }
    setRegistrada(r.estado.encomendas.find((x) => x.id === r.id));
    setUnidade('');
    setTransportadora('');
    setFoto(false);
    setLida(null);
    setErro(null);
  }

  return html`<section class="p-grade">
    <div class="p-coluna">
      <button type="button" class="btn grande destaque" onClick=${lerEtiqueta}><span aria-hidden="true">📷</span> Ler etiqueta</button>
      ${lida && html`<p class="dica-ocr">${lida}</p>`}
      <${Campo} rotulo="Unidade"><input id="portaria-unidade" class="entrada-grande" inputmode="numeric" maxlength="3" value=${unidade} onInput=${(ev) => setUnidade(ev.target.value)} placeholder="Ex.: 302" /><//>
      ${numero.length === 3 && html`<p class="dica-unidade">${moradores.length ? moradores.map((m) => m.nome).join(', ') : 'Unidade sem morador cadastrado'}</p>`}
      <p class="rotulo">Transportadora</p>
      <div class="opcoes-grandes" role="group" aria-label="Transportadora">
        ${TRANSPORTADORAS.map((t) => html`<button type="button" key=${t} class=${`btn grande opcao${t === transportadora ? ' sel' : ''}`} aria-pressed=${t === transportadora} onClick=${() => setTransportadora(t)}>${t}</button>`)}
      </div>
    </div>
    <div class="p-coluna">
      ${foto ? html`<${FotoFalsa} rotulo="Foto do volume e da etiqueta" />` : html`<button type="button" class="btn grande secundario" onClick=${() => setFoto(true)}>Fotografar volume</button>`}
      <${Erro} texto=${erro} />
      <button type="button" class="btn grande primario" disabled=${!numero || !transportadora} onClick=${registrar}>Registrar encomenda</button>
      ${registrada && html`<div class="cartao confirmacao" role="status" data-codigo=${registrada.codigo}>
        <strong>Encomenda registrada para o apto ${registrada.unidade}</strong>
        <span>Código de retirada: <b>${registrada.codigo}</b></span>
        <span>Morador avisado por WhatsApp com a foto.</span>
      </div>`}
    </div>
  </section>`;
}

function PEntregar({ estado, executar, agora }) {
  const [busca, setBusca] = useState('');
  const [selecionada, setSelecionada] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState(null);
  const [entregue, setEntregue] = useState(null);
  const termo = busca.trim();
  const lista = estado.encomendas
    .filter((e) => e.status === 'aguardando' && (!termo || e.unidade.includes(termo) || e.codigo === termo))
    .sort((a, b) => a.chegadaEm.localeCompare(b.chegadaEm));
  const encomenda = selecionada && estado.encomendas.find((e) => e.id === selecionada && e.status === 'aguardando');

  function escolher(id) {
    setSelecionada(id);
    setCodigo('');
    setNome('');
    setErro(null);
    setEntregue(null);
  }

  function confirmar() {
    const r = executar((e) => entregarEncomenda(e, { id: encomenda.id, codigo, nome }, new Date()));
    if (r.erro) {
      setErro(r.erro);
      return;
    }
    setEntregue(`Entrega registrada: apto ${encomenda.unidade}, retirada por ${nome.trim()}.`);
    setSelecionada(null);
    setBusca('');
  }

  return html`<section class="p-grade">
    <div class="p-coluna">
      <${Campo} rotulo="Buscar por código ou unidade"><input id="portaria-busca" class="entrada-grande" inputmode="numeric" value=${busca} onInput=${(ev) => setBusca(ev.target.value)} placeholder="Ex.: 302 ou 481203" /><//>
      ${entregue && html`<p class="sucesso" role="status">${entregue}</p>`}
      <ul class="lista-encomendas">
        ${lista.length
          ? lista.map((e) => html`<li key=${e.id}><button type="button" class=${`item-encomenda${e.id === selecionada ? ' sel' : ''}`} onClick=${() => escolher(e.id)}>
              <strong>Apto ${e.unidade}</strong>
              <span>${e.transportadora} · chegou ${haQuanto(e.chegadaEm, agora)}</span>
              ${encomendaParada(e, agora) && html`<${Etiqueta} tipo="perigo">Parada<//>`}
            </button></li>`)
          : html`<li><${Vazio} texto="Nenhuma encomenda aguardando." /></li>`}
      </ul>
    </div>
    <div class="p-coluna">
      ${encomenda
        ? html`<div class="cartao">
            <h2>Entregar: apto ${encomenda.unidade} · ${encomenda.transportadora}</h2>
            <${Campo} rotulo="Código de retirada"><input id="portaria-codigo" class="entrada-grande" inputmode="numeric" maxlength="6" value=${codigo} onInput=${(ev) => setCodigo(ev.target.value)} /><//>
            <button type="button" class="btn secundario" onClick=${() => setCodigo(encomenda.codigo)}>Escanear QR do morador</button>
            <${Campo} rotulo="Quem retirou"><input id="portaria-quem" class="entrada-grande" value=${nome} onInput=${(ev) => setNome(ev.target.value)} /><//>
            <div class="sugestoes">${moradoresDaUnidade(estado, encomenda.unidade).map((m) => html`<button type="button" key=${m.id} class="btn secundario" onClick=${() => setNome(m.nome)}>${m.nome}</button>`)}</div>
            <${Erro} texto=${erro} />
            <button type="button" class="btn grande primario" onClick=${confirmar}>Confirmar entrega</button>
          </div>`
        : html`<${Vazio} texto="Escolha uma encomenda na lista." />`}
    </div>
  </section>`;
}

function PReservasHoje({ estado, agora }) {
  const hoje = isoDia(agora);
  const lista = estado.reservas.filter((r) => r.data === hoje && r.status === 'confirmada').sort((a, b) => a.inicio - b.inicio);
  return html`<section>
    <h1>Reservas de hoje</h1>
    ${lista.length
      ? html`<div class="grade-cartoes">${lista.map((r) => html`<article key=${r.id} class="cartao">
          <h3>${areaPorId(estado, r.areaId).nome}</h3>
          <p class="sub">${fmtHora(r.inicio)}–${fmtHora(r.fim)} · Apto ${r.unidade}</p>
          <p class="rotulo">Convidados (${r.convidados.length})</p>
          ${r.convidados.length
            ? html`<ul class="convidados">${r.convidados.map((c, i) => html`<li key=${i}>${c.nome} <small>${c.documento}</small></li>`)}</ul>`
            : html`<${Vazio} texto="Sem lista de convidados." />`}
        </article>`)}</div>`
      : html`<${Vazio} texto="Nenhuma reserva confirmada para hoje." />`}
  </section>`;
}
