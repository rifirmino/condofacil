import { html, useState } from '../vendor.js';
import { CATEGORIAS_DESPESA } from '../cobranca/dados.js';
import { fmtReais } from '../cobranca/regras.js';
import { NOMES_SITUACAO_CONTA, FILTROS_CONTAS, situacaoConta, contasFiltradas, totalAPagar } from '../financeiro/contas.js';
import { novaConta, pagarConta, fecharMes, comentarLancamento, anexarNota, responderComentario, reenviarAoConselho, registrarAjuste, publicarResumo } from '../financeiro/acoes.js';
import { NOMES_SITUACAO_BALANCETE, SITUACOES_TRAVADAS, balanceteDe, mesesDaPrestacao, totalReceitas, totalDespesas, totalCategoria, saldoFinal } from '../financeiro/balancete.js';
import { CONSELHEIRO } from '../financeiro/dados.js';
import { lerPreco } from '../vendas/regras.js';
import { liberado } from '../planos.js';
import { isoDia, nomeMes, fmtDataCurta, fmtDataHora } from '../datas.js';
import { Campo, Erro, Sucesso, Vazio, Etiqueta } from './comum.js';
import { Bloqueado } from './financeiro-sindico.js';

// Menu Financeiro do síndico: contas a pagar, prestação de contas, fluxo de caixa e auditoria.
const ABAS_FINANCEIRO = [['contas', 'Contas a pagar'], ['prestacao', 'Prestação de contas'], ['fluxo', 'Fluxo de caixa'], ['auditoria', 'Auditoria']];
const ETQ_SITUACAO_CONTA = { paga: 'ok', vencida: 'perigo', hoje: 'alerta', aberta: 'info' };

export function SFinanceiro(props) {
  const idRota = props.rota.id || '';
  const aba = idRota.startsWith('prestacao') ? 'prestacao' : ABAS_FINANCEIRO.some(([id]) => id === idRota) ? idRota : 'contas';
  const Conteudo = { contas: FContas, prestacao: FPrestacao, fluxo: FFluxo, auditoria: FAuditoria }[aba];
  return html`<section>
    <h1>Financeiro</h1>
    <nav class="chips" aria-label="Financeiro">${ABAS_FINANCEIRO.map(([id, nome]) => html`<a key=${id} class="chip" href=${`#sindico.financeiro.${id}`} aria-current=${aba === id ? 'page' : undefined}>${nome}</a>`)}</nav>
    <${Conteudo} ...${props} />
  </section>`;
}

function FormConta({ executar, hoje, aoConcluir }) {
  const [form, setForm] = useState({ fornecedor: '', categoria: 'manutencao', descricao: '', valor: '', vencimento: hoje, recorrente: false });
  const [erro, setErro] = useState(null);
  const campo = (chave) => (ev) => setForm({ ...form, [chave]: ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value });

  function salvar() {
    const r = executar((e) => novaConta(e, { ...form, valor: lerPreco(form.valor) }, 'sindico'));
    setErro(r.erro || null);
    if (!r.erro) aoConcluir(`Conta ${r.id} cadastrada.`);
  }

  return html`<div class="cartao pilha formulario">
    <strong>Nova conta</strong>
    <div class="edicao-anuncio">
      <${Campo} rotulo="Fornecedor"><input id="conta-fornecedor" value=${form.fornecedor} onInput=${campo('fornecedor')} placeholder="Ex.: Pinturas Sol" /><//>
      <${Campo} rotulo="Categoria"><select id="conta-categoria" value=${form.categoria} onChange=${campo('categoria')}>${Object.entries(CATEGORIAS_DESPESA).map(([id, nome]) => html`<option key=${id} value=${id}>${nome}</option>`)}</select><//>
      <${Campo} rotulo="Descrição"><input id="conta-descricao" value=${form.descricao} onInput=${campo('descricao')} placeholder="Ex.: Pintura do hall" /><//>
      <${Campo} rotulo="Valor (R$)"><input id="conta-valor" inputmode="decimal" value=${form.valor} onInput=${campo('valor')} placeholder="Ex.: 2.500,00" /><//>
      <${Campo} rotulo="Vencimento"><input id="conta-vencimento" type="date" value=${form.vencimento} onInput=${campo('vencimento')} /><//>
    </div>
    <label class="check"><input id="conta-recorrente" type="checkbox" checked=${form.recorrente} onChange=${campo('recorrente')} /><span>Repete todo mês</span></label>
    <${Erro} texto=${erro} />
    <button type="button" class="btn primario" data-acao="salvar-conta" onClick=${salvar}>Cadastrar conta</button>
  </div>`;
}

function FContas({ estado, executar, agora }) {
  const [filtro, setFiltro] = useState('proximas');
  const [nova, setNova] = useState(false);
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  if (!liberado(estado.plano, 'contasPagar')) return html`<${Bloqueado} estado=${estado} recurso="contasPagar" titulo="Contas a pagar com vencimento, boleto e pagamento pelo Asaas" />`;
  const hoje = isoDia(agora);
  const lista = contasFiltradas(estado, filtro, hoje);

  function pagar(id) {
    const r = executar((e) => pagarConta(e, id, 'sindico', new Date()));
    setErro(r.erro || null);
    setMensagem(r.erro ? null : `Conta ${id} paga.${r.seguinte ? ` A do próximo mês (${r.seguinte}) já foi criada.` : ''}`);
  }

  return html`<div class="pilha">
    <div class="linha-entre">
      <p class="sub">${fmtReais(totalAPagar(estado, hoje))} a pagar nos próximos 30 dias · saldo ${fmtReais(estado.financeiro.saldo)}</p>
      <button type="button" class="btn primario" aria-expanded=${nova} onClick=${() => { setNova(!nova); setMensagem(null); }}>Nova conta</button>
    </div>
    ${nova && html`<${FormConta} executar=${executar} hoje=${hoje} aoConcluir=${(t) => { setNova(false); setMensagem(t); }} />`}
    <${Campo} rotulo="Mostrar"><select id="contas-filtro" value=${filtro} onChange=${(ev) => setFiltro(ev.target.value)}>${FILTROS_CONTAS.map(([id, nome]) => html`<option key=${id} value=${id}>${nome}</option>`)}</select><//>
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
    ${lista.length
      ? html`<div class="tabela-rolagem"><table class="tabela">
          <thead><tr><th>Vencimento</th><th>Fornecedor</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Situação</th><th>Ação</th></tr></thead>
          <tbody>${lista.map((c) => {
            const s = situacaoConta(c, hoje);
            return html`<tr key=${c.id}>
              <td>${fmtDataCurta(c.vencimento)}</td>
              <td>${c.fornecedor}</td>
              <td>${c.descricao}${c.recorrente ? html` <${Etiqueta}>mensal<//>` : ''}<br /><small class="sub">${c.id} · ${c.boleto}</small></td>
              <td>${CATEGORIAS_DESPESA[c.categoria]}</td>
              <td>${fmtReais(c.valor)}</td>
              <td><${Etiqueta} tipo=${ETQ_SITUACAO_CONTA[s]}>${NOMES_SITUACAO_CONTA[s]}<//>${c.pagaEm ? html`<br /><small class="sub">em ${fmtDataCurta(isoDia(new Date(c.pagaEm)))}</small>` : ''}</td>
              <td>${c.situacao === 'aberta' ? html`<button type="button" class="btn secundario" data-pagar=${c.id} onClick=${() => pagar(c.id)}>Pagar</button>` : html`<small class="sub">${c.comprovante}</small>`}</td>
            </tr>`;
          })}</tbody>
        </table></div>`
      : html`<${Vazio} texto="Nenhuma conta neste filtro." />`}
    <small class="sub">O pagamento sai pela conta Asaas do condomínio, entra na despesa da categoria e na auditoria. Conta paga não se edita.</small>
  </div>`;
}

function FAuditoria({ estado }) {
  const fin = estado.financeiro;
  return html`<div class="pilha">
    <p class="sub">Toda ação financeira do síndico fica registrada aqui e não pode ser apagada.</p>
    ${fin.auditoria.length
      ? html`<ul class="auditoria">${[...fin.auditoria].reverse().map((a, n) => html`<li key=${n}><span class="lt-quando">${fmtDataHora(a.em)}</span> <strong>${a.acao}</strong> · ${a.detalhe} · ${a.quem}</li>`)}</ul>`
      : html`<${Vazio} texto="Nenhuma ação registrada nesta demonstração." />`}
  </div>`;
}

const ETQ_SITUACAO_BALANCETE = { aberto: 'info', fechado: 'neutro', aguardando: 'alerta', correcao: 'perigo', aprovado: 'ok' };

export function EtqBalancete({ b }) {
  return html`<${Etiqueta} tipo=${ETQ_SITUACAO_BALANCETE[b.situacao]}>${NOMES_SITUACAO_BALANCETE[b.situacao]}${b.parcial ? ' · parcial' : ''}<//>`;
}

export function ListaMesesPrestacao({ estado, hoje, base }) {
  return html`<div class="tabela-rolagem"><table class="tabela">
    <thead><tr><th>Mês</th><th>Situação</th><th>Saldo inicial</th><th>Receitas</th><th>Despesas</th><th>Saldo final</th></tr></thead>
    <tbody>${mesesDaPrestacao(estado, hoje).map((mes) => {
      const b = balanceteDe(estado, mes, hoje);
      return html`<tr key=${mes}>
        <td><a href=${`${base}${mes}`} data-mes=${mes}>${nomeMes(mes)}</a></td>
        <td><${EtqBalancete} b=${b} /></td>
        <td>${fmtReais(b.saldoInicial)}</td><td>${fmtReais(totalReceitas(b))}</td><td>${fmtReais(totalDespesas(b))}</td><td><strong>${fmtReais(saldoFinal(b))}</strong></td>
      </tr>`;
    })}</tbody>
  </table></div>`;
}

export function VisaoBalancete({ estado, mes, b, perfil, executar, aoResultado }) {
  const [comentando, setComentando] = useState(null);
  const [texto, setTexto] = useState('');
  const [respostas, setRespostas] = useState({});
  const comConselho = liberado(estado.plano, 'aprovacaoConselho');
  const sindicoEdita = perfil === 'sindico' && ['aberto', 'correcao'].includes(b.situacao) && !b.parcial;
  const conselhoAnalisa = perfil === 'conselho' && comConselho && b.situacao === 'aguardando';

  function rodar(acao, sucesso) {
    const r = executar(acao);
    aoResultado(r.erro || null, r.erro ? null : sucesso);
    return r;
  }

  const comentariosDe = (itemId) => b.comentarios.filter((c) => c.item === itemId);
  return html`<div class="pilha">
    <dl class="resumo">
      <dt>Saldo inicial</dt><dd>${fmtReais(b.saldoInicial)}</dd>
      <dt>Receitas</dt><dd>${fmtReais(totalReceitas(b))}</dd>
      <dt>Despesas</dt><dd>${fmtReais(totalDespesas(b))}</dd>
      <dt>Saldo final</dt><dd>${fmtReais(saldoFinal(b))}</dd>
      <dt>Inadimplência</dt><dd>${b.inadimplencia.unidades} unidades · ${fmtReais(b.inadimplencia.valor)}</dd>
      ${b.aprovadoPor && html`<dt>Aprovado</dt><dd>por ${b.aprovadoPor} em ${fmtDataCurta(isoDia(new Date(b.aprovadoEm)))}</dd>`}
    </dl>
    ${b.correcao && b.situacao === 'correcao' && html`<p class="erro">Correção pedida por ${b.correcao.autor}: ${b.correcao.motivo}</p>`}
    <h2>Receitas</h2>
    <ul class="itens-sacola">${b.receitas.map((r) => html`<li key=${r.nome}><span>${r.nome}</span><span>${fmtReais(r.valor)}</span></li>`)}</ul>
    <h2>Despesas por categoria</h2>
    ${b.despesas.map((d) => html`<div key=${d.categoria} class="cartao pilha">
      <div class="linha-entre"><strong>${CATEGORIAS_DESPESA[d.categoria]}</strong><strong>${fmtReais(totalCategoria(d))}</strong></div>
      <ul class="lancamentos-balancete">${d.itens.map((i) => html`<li key=${i.id}>
        <div class="linha-entre">
          <span>${i.descricao}</span>
          <span class="acoes">
            <span>${fmtReais(i.valor)}</span>
            ${i.nota === true && html`<${Etiqueta} tipo="ok">📎 nota<//>`}
            ${i.nota === false && html`<${Etiqueta} tipo="perigo">sem nota<//>`}
            ${sindicoEdita && i.nota === false && html`<button type="button" class="btn secundario" data-anexar=${i.id} onClick=${() => rodar((e) => anexarNota(e, mes, i.id, 'sindico'), 'Nota anexada.')}>Anexar nota</button>`}
            ${conselhoAnalisa && html`<button type="button" class="btn-link" data-comentar=${i.id} onClick=${() => { setComentando(comentando === i.id ? null : i.id); setTexto(''); }}>Comentar</button>`}
          </span>
        </div>
        ${comentariosDe(i.id).map((c) => html`<div key=${c.id} class="comentario-balancete">
          <small><strong>${c.autor}:</strong> ${c.texto}</small>
          ${c.resposta && html`<small><strong>Síndico:</strong> ${c.resposta.texto}</small>`}
          ${!c.resposta && perfil === 'sindico' && b.situacao === 'correcao' && html`<span class="acoes"><input aria-label="Resposta ao conselho" value=${respostas[c.id] || ''} onInput=${(ev) => setRespostas({ ...respostas, [c.id]: ev.target.value })} /><button type="button" class="btn secundario" onClick=${() => rodar((e) => responderComentario(e, mes, c.id, respostas[c.id], 'sindico', new Date()), 'Resposta enviada.')}>Responder</button></span>`}
        </div>`)}
        ${comentando === i.id && html`<span class="acoes"><input aria-label="Comentário do conselho" value=${texto} onInput=${(ev) => setTexto(ev.target.value)} placeholder="Ex.: falta a nota" /><button type="button" class="btn secundario" data-acao="enviar-comentario" onClick=${() => { const r = rodar((e) => comentarLancamento(e, mes, i.id, texto, 'conselho', new Date()), 'Comentário registrado.'); if (!r.erro) setComentando(null); }}>Enviar</button></span>`}
      </li>`)}</ul>
    </div>`)}
  </div>`;
}

function FormAjuste({ executar, mes, aoResultado }) {
  const [form, setForm] = useState({ descricao: '', categoria: 'administracao', valor: '' });
  const campo = (chave) => (ev) => setForm({ ...form, [chave]: ev.target.value });
  return html`<div class="cartao pilha">
    <strong>Registrar ajuste no mês corrente</strong>
    <small class="sub">O mês está travado. A correção entra como despesa do mês corrente, com referência a ${nomeMes(mes)}.</small>
    <div class="edicao-anuncio">
      <${Campo} rotulo="Descrição do ajuste"><input id="ajuste-descricao" value=${form.descricao} onInput=${campo('descricao')} placeholder="Ex.: tarifa bancária não lançada" /><//>
      <${Campo} rotulo="Categoria do ajuste"><select id="ajuste-categoria" value=${form.categoria} onChange=${campo('categoria')}>${Object.entries(CATEGORIAS_DESPESA).map(([id, nome]) => html`<option key=${id} value=${id}>${nome}</option>`)}</select><//>
      <${Campo} rotulo="Valor do ajuste (R$)"><input id="ajuste-valor" inputmode="decimal" value=${form.valor} onInput=${campo('valor')} /><//>
    </div>
    <button type="button" class="btn secundario" data-acao="registrar-ajuste" onClick=${() => { const r = executar((e) => registrarAjuste(e, mes, { ...form, valor: lerPreco(form.valor) }, 'sindico', new Date())); aoResultado(r.erro || null, r.erro ? null : `Ajuste ${r.id} lançado no mês corrente.`); }}>Registrar ajuste</button>
  </div>`;
}

function FPrestacao({ estado, executar, agora, rota }) {
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  if (!liberado(estado.plano, 'prestacaoContas')) return html`<${Bloqueado} estado=${estado} recurso="prestacaoContas" titulo="Balancete mensal em PDF e resumo para os moradores" />`;
  const hoje = isoDia(agora);
  const mes = (rota.id || '').startsWith('prestacao-') ? rota.id.slice('prestacao-'.length) : null;
  const b = mes ? balanceteDe(estado, mes, hoje) : null;
  const aoResultado = (e, m) => { setErro(e); setMensagem(m); };
  if (!b) {
    return html`<div class="pilha">
      <p class="sub">${liberado(estado.plano, 'aprovacaoConselho') ? 'Ao fechar, o mês vai para o conselho fiscal aprovar. Depois de aprovado, fica travado.' : 'Ao fechar, o mês fica travado. A aprovação digital do conselho é do plano Avançado.'}</p>
      <${ListaMesesPrestacao} estado=${estado} hoje=${hoje} base="#sindico.financeiro.prestacao-" />
    </div>`;
  }
  const comConselho = liberado(estado.plano, 'aprovacaoConselho');
  const travado = SITUACOES_TRAVADAS.includes(b.situacao);
  const podePublicar = !b.resumo && (comConselho ? b.situacao === 'aprovado' : travado);
  const rodar = (acao, sucesso) => { const r = executar(acao); aoResultado(r.erro || null, r.erro ? null : sucesso); };
  return html`<div class="pilha">
    <a class="voltar" href="#sindico.financeiro.prestacao">‹ Prestação de contas</a>
    <div class="linha-entre"><h2>Balancete de ${nomeMes(mes)}</h2><${EtqBalancete} b=${b} /></div>
    ${b.parcial && html`<p class="sub">Mês em andamento: os números mudam a cada pagamento. O fechamento fica disponível depois que o mês terminar.</p>`}
    <div class="acoes">
      ${b.situacao === 'aberto' && !b.parcial && html`<button type="button" class="btn primario" data-acao="fechar-mes" onClick=${() => rodar((e) => fecharMes(e, mes, 'sindico', new Date()), comConselho ? 'Mês fechado e enviado ao conselho.' : 'Mês fechado e travado.')}>Fechar o mês</button>`}
      ${b.situacao === 'correcao' && html`<button type="button" class="btn primario" data-acao="reenviar-conselho" onClick=${() => rodar((e) => reenviarAoConselho(e, mes, 'sindico', new Date()), 'Balancete reenviado ao conselho.')}>Reenviar ao conselho</button>`}
      ${podePublicar && html`<button type="button" class="btn secundario" data-acao="publicar-resumo" onClick=${() => rodar((e) => publicarResumo(e, mes, 'sindico', new Date()), 'Resumo publicado para os moradores.')}>Publicar resumo para os moradores</button>`}
      ${b.resumo && html`<${Etiqueta} tipo="ok">Resumo publicado<//>`}
      ${b.situacao === 'aguardando' && html`<span class="sub">Aguardando a análise de ${CONSELHEIRO.nome}.</span>`}
    </div>
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
    <${VisaoBalancete} key=${mes} estado=${estado} mes=${mes} b=${b} perfil="sindico" executar=${executar} aoResultado=${aoResultado} />
    ${travado && html`<${FormAjuste} executar=${executar} mes=${mes} aoResultado=${aoResultado} />`}
  </div>`;
}


function FFluxo() {
  return html`<${Vazio} texto="Em construção." />`;
}
