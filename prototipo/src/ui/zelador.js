import { html, useState } from '../vendor.js';
import { PRIORIDADES, ORDEM_PRIORIDADE } from '../dados.js';
import { liberado } from '../planos.js';
import { fmtReais } from '../cobranca/regras.js';
import { ZELADOR, NOMES_STATUS_OS, CATEGORIAS_COMPRA } from '../manutencao/dados.js';
import { listaOS, osAtiva } from '../manutencao/regras.js';
import { abrirOS, iniciarOS, pausarOS, concluirOS, solicitarCompra, receberCompra, gastoCaixa } from '../manutencao/acoes.js';
import { lerPreco } from '../vendas/regras.js';
import { ir, Campo, Erro, Sucesso, Vazio, Icone, LinhaTempo } from './comum.js';
import { Bloqueado } from './financeiro-sindico.js';
import { EtqPrioridade, EtqOS, EtqCompra, FotosOS, ResumoCaixa, fmtPrazo } from './manutencao-sindico.js';

// O zelador vê só as OS, as compras dele e o caixa pequeno: nada de receitas, inadimplência ou saldo do condomínio.
const ABAS_ZELADOR = [['os', 'OS', 'prancheta'], ['compras', 'Compras', 'sacola'], ['caixa', 'Caixa', 'cifrao']];

function relogioZelador(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function TelaZelador(props) {
  const { estado, rota } = props;
  const tela = ABAS_ZELADOR.some(([id]) => id === rota.tela) ? rota.tela : 'os';
  const liberadoZelador = liberado(estado.plano, 'zelador');
  const Conteudo = { os: ZOS, compras: ZCompras, caixa: ZCaixa }[tela];
  return html`<div class="celular">
    <div class="cel-status" aria-hidden="true"><span>${relogioZelador(props.agora)}</span><span>CondoFácil</span></div>
    <div class="cel-pessoa"><strong>${ZELADOR} · Zelador</strong></div>
    <div class="cel-conteudo">${liberadoZelador
      ? html`<${Conteudo} ...${props} />`
      : html`<section class="m-pagina"><h1 class="m-titulo">Zelador</h1><div class="bloqueado"><strong>Ordens de serviço, compras e caixa pequeno</strong><span>Módulo do zelador disponível no plano Intermediário</span></div></section>`}</div>
    <nav class="cel-abas zelador" aria-label="Navegação do zelador">
      ${ABAS_ZELADOR.map(([id, nome, icone]) => html`<a key=${id} href=${`#zelador.${id}`} class=${id === tela ? 'ativa' : ''} aria-current=${id === tela ? 'page' : undefined}><${Icone} nome=${icone} />${nome}</a>`)}
    </nav>
  </div>`;
}

function ZOS(props) {
  const { estado, rota } = props;
  if (rota.id === 'nova') return html`<${ZNovaOS} ...${props} />`;
  const os = rota.id ? estado.manutencao.os.find((o) => o.id === rota.id) : null;
  if (os) return html`<${ZDetalheOS} key=${os.id} ...${props} os=${os} />`;
  const lista = listaOS(estado).filter((o) => o.status !== 'validada');
  return html`<section class="m-pagina">
    <h1 class="m-titulo">Ordens de serviço</h1>
    <a class="btn primario bloco" href="#zelador.os.nova">Nova OS</a>
    ${lista.length
      ? html`<ul class="m-lista">${lista.map((o) => html`<li key=${o.id}><a class="cartao link" href=${`#zelador.os.${o.id}`}>
          <div class="linha-entre"><strong>${o.id} · ${o.local}</strong><${EtqPrioridade} prioridade=${o.prioridade} /></div>
          <span>${o.descricao}</span>
          <div class="linha-entre"><small class="sub">Prazo ${fmtPrazo(o.prazo)}</small><${EtqOS} status=${o.status} /></div>
        </a></li>`)}</ul>`
      : html`<${Vazio} texto="Nenhuma OS em aberto." />`}
  </section>`;
}

function ZNovaOS({ executar }) {
  const [local, setLocal] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState('normal');
  const [erro, setErro] = useState(null);

  function registrar() {
    const r = executar((e) => abrirOS(e, { local, descricao, prioridade }, 'zelador', new Date()));
    if (r.erro) setErro(r.erro);
    else ir('zelador', 'os', r.id);
  }

  return html`<section class="m-pagina">
    <a class="voltar" href="#zelador.os">‹ OS</a>
    <h1 class="m-titulo">Nova OS (ronda)</h1>
    <${Campo} rotulo="Local"><input id="z-os-local" value=${local} onInput=${(ev) => setLocal(ev.target.value)} placeholder="Ex.: piscina, hall do 3º andar" /><//>
    <${Campo} rotulo="Descrição"><textarea id="z-os-descricao" rows="3" value=${descricao} onInput=${(ev) => setDescricao(ev.target.value)}></textarea><//>
    <${Campo} rotulo="Prioridade"><select id="z-os-prioridade" value=${prioridade} onChange=${(ev) => setPrioridade(ev.target.value)}>${ORDEM_PRIORIDADE.map((p) => html`<option key=${p} value=${p}>${PRIORIDADES[p].nome}</option>`)}</select><//>
    <${Erro} texto=${erro} />
    <button type="button" class="btn primario bloco" onClick=${registrar}>Registrar OS</button>
  </section>`;
}

function ZDetalheOS({ executar, os }) {
  const [concluindo, setConcluindo] = useState(false);
  const [fotoDepois, setFotoDepois] = useState(false);
  const [materiais, setMateriais] = useState('');
  const [horas, setHoras] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const executando = ['em_execucao', 'aguardando_material', 'aguardando_prestador'].includes(os.status);

  function rodar(acao, sucesso) {
    const r = executar(acao);
    setErro(r.erro || null);
    setMensagem(r.erro ? null : sucesso);
    return r;
  }

  function concluir() {
    const r = rodar((e) => concluirOS(e, os.id, { fotoDepois, materiais, horas: Number(String(horas).replace(',', '.')), observacoes }, 'zelador', new Date()), 'OS concluída. O síndico vai validar.');
    if (!r.erro) setConcluindo(false);
  }

  return html`<section class="m-pagina">
    <a class="voltar" href="#zelador.os">‹ OS</a>
    <p class="protocolo">${os.id}${os.notificacao ? ` · ${os.notificacao}` : ''}</p>
    <h1 class="m-titulo">${os.local}</h1>
    <div class="etq-linha"><${EtqPrioridade} prioridade=${os.prioridade} /><${EtqOS} status=${os.status} /></div>
    <p class="m-texto">${os.descricao}</p>
    <small class="sub">Prazo ${fmtPrazo(os.prazo)}</small>
    <${FotosOS} os=${os} />
    ${osAtiva(os) && html`<div class="acoes">
      ${os.status !== 'em_execucao' && html`<button type="button" class="btn primario" onClick=${() => rodar((e) => iniciarOS(e, os.id, 'zelador', new Date()), 'OS em execução.')}>${os.status === 'aberta' ? 'Iniciar' : 'Retomar'}</button>`}
      ${os.status === 'em_execucao' && html`<button type="button" class="btn secundario" onClick=${() => rodar((e) => pausarOS(e, os.id, 'aguardando_material', 'zelador', new Date()), 'Marcada como aguardando material.')}>Aguardando material</button>`}
      ${os.status === 'em_execucao' && html`<button type="button" class="btn secundario" onClick=${() => rodar((e) => pausarOS(e, os.id, 'aguardando_prestador', 'zelador', new Date()), 'Marcada como aguardando prestador.')}>Aguardando prestador</button>`}
      ${executando && !concluindo && html`<button type="button" class="btn primario" onClick=${() => setConcluindo(true)}>Concluir</button>`}
    </div>`}
    ${concluindo && html`<div class="cartao pilha">
      <button type="button" class="btn secundario" aria-pressed=${fotoDepois} onClick=${() => setFotoDepois(true)}>${fotoDepois ? 'Foto do depois anexada' : 'Anexar foto do depois'}</button>
      <${Campo} rotulo="Materiais usados"><input id="z-os-materiais" value=${materiais} onInput=${(ev) => setMateriais(ev.target.value)} /><//>
      <${Campo} rotulo="Horas gastas"><input id="z-os-horas" type="number" step="0.5" min="0" value=${horas} onInput=${(ev) => setHoras(ev.target.value)} /><//>
      <${Campo} rotulo="Observações"><textarea id="z-os-observacoes" rows="2" value=${observacoes} onInput=${(ev) => setObservacoes(ev.target.value)}></textarea><//>
      <button type="button" class="btn primario bloco" data-acao="concluir-os" onClick=${concluir}>Concluir OS</button>
    </div>`}
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
    <h2>Andamento</h2>
    <${LinhaTempo} linha=${os.linha} nomes=${NOMES_STATUS_OS} />
  </section>`;
}

function ZCompras(props) {
  const { estado, executar, rota } = props;
  const [recebendo, setRecebendo] = useState(null);
  const [valorFinal, setValorFinal] = useState('');
  const [nota, setNota] = useState('');
  const [erro, setErro] = useState(null);
  if (rota.id === 'nova') return html`<${ZNovaCompra} ...${props} />`;
  const lista = [...estado.manutencao.compras].reverse();

  function confirmar(id) {
    const r = executar((e) => receberCompra(e, id, { valorFinal: lerPreco(valorFinal), nota }, 'zelador', new Date()));
    setErro(r.erro || null);
    if (!r.erro) {
      setRecebendo(null);
      setValorFinal('');
      setNota('');
    }
  }

  return html`<section class="m-pagina">
    <h1 class="m-titulo">Compras</h1>
    <a class="btn primario bloco" href="#zelador.compras.nova">Nova compra</a>
    ${lista.length
      ? html`<ul class="m-lista">${lista.map((c) => html`<li key=${c.id} class="cartao">
          <div class="linha-entre"><strong>${c.id} · ${c.item}</strong><${EtqCompra} status=${c.status} /></div>
          <small class="sub">${fmtReais(c.valorFinal || c.valorEstimado)}${c.os ? ` · ${c.os}` : ''}${c.motivoRecusa ? ` · recusada: ${c.motivoRecusa}` : ''}</small>
          ${c.status === 'aprovada' && recebendo !== c.id && html`<button type="button" class="btn secundario" data-compra-receber=${c.id} onClick=${() => { setRecebendo(c.id); setErro(null); }}>Registrar recebimento</button>`}
          ${recebendo === c.id && html`<div class="pilha">
            <${Campo} rotulo="Valor final (R$)"><input id=${`z-valor-final-${c.id}`} inputmode="decimal" value=${valorFinal} onInput=${(ev) => setValorFinal(ev.target.value)} /><//>
            <button type="button" class="btn secundario" onClick=${() => setNota(`nota-${c.id}.pdf`)}>${nota ? `Anexada: ${nota}` : 'Anexar nota fiscal'}</button>
            <button type="button" class="btn primario" onClick=${() => confirmar(c.id)}>Confirmar recebimento</button>
            <${Erro} texto=${erro} />
          </div>`}
        </li>`)}</ul>`
      : html`<${Vazio} texto="Nenhuma compra pedida." />`}
  </section>`;
}

function ZNovaCompra({ estado, executar }) {
  const comCotacao = liberado(estado.plano, 'cotacoes');
  const [item, setItem] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState('manutencao');
  const [os, setOs] = useState('');
  const [motivo, setMotivo] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [valorCotacao, setValorCotacao] = useState('');
  const [erro, setErro] = useState(null);
  const ativas = estado.manutencao.os.filter(osAtiva);

  function pedir() {
    const cotacoes = comCotacao && fornecedor.trim() ? [{ fornecedor: fornecedor.trim(), valor: lerPreco(valorCotacao) }] : [];
    const r = executar((e) => solicitarCompra(e, { item, quantidade: Number(quantidade), valorEstimado: lerPreco(valor), categoria, os: os || null, motivo, cotacoes }, 'zelador', new Date()));
    if (r.erro) setErro(r.erro);
    else ir('zelador', 'compras');
  }

  return html`<section class="m-pagina">
    <a class="voltar" href="#zelador.compras">‹ Compras</a>
    <h1 class="m-titulo">Nova compra</h1>
    <${Campo} rotulo="Item"><input id="z-compra-item" value=${item} onInput=${(ev) => setItem(ev.target.value)} /><//>
    <div class="edicao-anuncio">
      <${Campo} rotulo="Quantidade"><input id="z-compra-quantidade" type="number" min="1" value=${quantidade} onInput=${(ev) => setQuantidade(ev.target.value)} /><//>
      <${Campo} rotulo="Valor estimado (R$)"><input id="z-compra-valor" inputmode="decimal" value=${valor} onInput=${(ev) => setValor(ev.target.value)} /><//>
    </div>
    <${Campo} rotulo="Categoria"><select id="z-compra-categoria" value=${categoria} onChange=${(ev) => setCategoria(ev.target.value)}>${Object.entries(CATEGORIAS_COMPRA).map(([id, nome]) => html`<option key=${id} value=${id}>${nome}</option>`)}</select><//>
    <${Campo} rotulo="OS vinculada"><select id="z-compra-os" value=${os} onChange=${(ev) => setOs(ev.target.value)}><option value="">Nenhuma</option>${ativas.map((o) => html`<option key=${o.id} value=${o.id}>${o.id} · ${o.local}</option>`)}</select><//>
    <${Campo} rotulo="Motivo"><input id="z-compra-motivo" value=${motivo} onInput=${(ev) => setMotivo(ev.target.value)} /><//>
    ${comCotacao && html`<div class="edicao-anuncio">
      <${Campo} rotulo="Fornecedor"><input id="z-compra-fornecedor" value=${fornecedor} onInput=${(ev) => setFornecedor(ev.target.value)} /><//>
      <${Campo} rotulo="Valor da cotação (R$)"><input id="z-compra-cotacao" inputmode="decimal" value=${valorCotacao} onInput=${(ev) => setValorCotacao(ev.target.value)} /><//>
    </div>
    <small class="m-ajuda">Cotações mínimas: 1 até R$ 500,00, 2 até R$ 2.000,00 e 3 acima disso.</small>`}
    <${Erro} texto=${erro} />
    <button type="button" class="btn primario bloco" onClick=${pedir}>Pedir compra</button>
  </section>`;
}

function ZCaixa({ estado, executar }) {
  const [novo, setNovo] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [cupom, setCupom] = useState(false);
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  if (!liberado(estado.plano, 'caixaPequeno')) return html`<section class="m-pagina"><h1 class="m-titulo">Caixa pequeno</h1><${Bloqueado} estado=${estado} recurso="caixaPequeno" titulo="Caixa pequeno com cupom e saldo" /></section>`;

  function registrar() {
    const r = executar((e) => gastoCaixa(e, { descricao, valor: lerPreco(valor), cupom }, 'zelador', new Date()));
    setErro(r.erro || null);
    if (!r.erro) {
      setMensagem('Gasto registrado.');
      setNovo(false);
      setDescricao('');
      setValor('');
      setCupom(false);
    }
  }

  return html`<section class="m-pagina">
    <h1 class="m-titulo">Caixa pequeno</h1>
    <${ResumoCaixa} caixa=${estado.manutencao.caixa} />
    ${novo
      ? html`<div class="cartao pilha">
          <${Campo} rotulo="Descrição"><input id="z-gasto-descricao" value=${descricao} onInput=${(ev) => setDescricao(ev.target.value)} /><//>
          <${Campo} rotulo="Valor (R$)"><input id="z-gasto-valor" inputmode="decimal" value=${valor} onInput=${(ev) => setValor(ev.target.value)} /><//>
          <button type="button" class="btn secundario" aria-pressed=${cupom} onClick=${() => setCupom(true)}>${cupom ? 'Cupom anexado' : 'Anexar foto do cupom'}</button>
          <button type="button" class="btn primario bloco" onClick=${registrar}>Registrar gasto</button>
        </div>`
      : html`<button type="button" class="btn primario bloco" onClick=${() => { setNovo(true); setMensagem(null); }}>Novo gasto</button>`}
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
  </section>`;
}
