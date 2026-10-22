import { html, useState } from '../vendor.js';
import { CATEGORIAS_DESPESA } from '../cobranca/dados.js';
import { fmtReais } from '../cobranca/regras.js';
import { NOMES_SITUACAO_CONTA, FILTROS_CONTAS, situacaoConta, contasFiltradas, totalAPagar } from '../financeiro/contas.js';
import { novaConta, pagarConta } from '../financeiro/acoes.js';
import { lerPreco } from '../vendas/regras.js';
import { liberado } from '../planos.js';
import { isoDia, fmtDataCurta, fmtDataHora } from '../datas.js';
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

function FPrestacao() {
  return html`<${Vazio} texto="Em construção." />`;
}

function FFluxo() {
  return html`<${Vazio} texto="Em construção." />`;
}
