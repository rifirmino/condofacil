import { html, useState } from '../vendor.js';
import { fmtReais, situacaoCobranca, valorAtualizado, rotuloCobranca } from '../cobranca/regras.js';
import { debitosParaAcordo, simularAcordo, cronogramaDoAcordo, cobrancasDoAcordo, progressoAcordo, proporAcordo, cancelarProposta, marcarTermoLido, aceitarAcordo } from '../cobranca/acordos.js';
import { lerPreco, pessoaDaUnidade } from '../vendas/regras.js';
import { liberado } from '../planos.js';
import { isoDia, fmtDataCurta, fmtDataHora } from '../datas.js';
import { ir, Campo, Erro, Sucesso, Vazio, Etiqueta, PrevDoc } from './comum.js';
import { EtqCobranca, Bloqueado, DetalheCobranca } from './financeiro-sindico.js';

const ETQ_ACORDO = { aguardando: 'alerta', ativo: 'info', quitado: 'ok', cancelado: 'neutro' };
const NOMES_SITUACAO_ACORDO = { aguardando: 'Aguardando aceite', ativo: 'Ativo', quitado: 'Quitado', cancelado: 'Cancelado' };

export function EtqAcordo({ situacao }) {
  return html`<${Etiqueta} tipo=${ETQ_ACORDO[situacao]}>${NOMES_SITUACAO_ACORDO[situacao]}<//>`;
}

export function termoDoAcordo(acordo) {
  return { titulo: `Termo de confissão de dívida · ${acordo.id} · apto ${acordo.unidade}`, pasta: 'Financeiro', versoes: [{ versao: 1, data: isoDia(new Date(acordo.criadoEm)) }] };
}

function nomeLinha(numero, de) {
  return numero ? `Parcela ${numero}/${de}` : 'Entrada';
}

function ResumoAcordo({ estado, acordo }) {
  const originais = estado.financeiro.cobrancas.filter((c) => acordo.originais.includes(c.id));
  return html`<dl class="resumo">
    <dt>Débitos incluídos</dt><dd>${originais.map((c) => rotuloCobranca(c)).join(', ')}</dd>
    <dt>Valor original</dt><dd>${fmtReais(acordo.valorOriginal)}</dd>
    <dt>Multa e juros</dt><dd>${fmtReais(acordo.multa + acordo.juros)}</dd>
    <dt>Desconto</dt><dd>${fmtReais(-acordo.desconto)}</dd>
    <dt>Total do acordo</dt><dd><strong>${fmtReais(acordo.total)}</strong></dd>
  </dl>`;
}

function Cronograma({ estado, acordo, hoje, aoAbrir }) {
  if (['aguardando', 'cancelado'].includes(acordo.situacao)) {
    return html`<ul class="itens-sacola">${cronogramaDoAcordo(estado, acordo, hoje).map((l) => html`<li key=${l.numero}><span>${nomeLinha(l.numero, acordo.parcelas)} · ${fmtDataCurta(l.vencimento)}</span><span>${fmtReais(l.valor)}</span></li>`)}</ul>`;
  }
  return html`<ul class="itens-sacola cronograma">${cobrancasDoAcordo(estado, acordo.id).map((c) => html`<li key=${c.id}>
    <span>${nomeLinha(c.acordo.numero, c.acordo.de)} · ${fmtDataCurta(c.vencimento)}</span>
    <span class="cronograma-fim">${fmtReais(c.valor)} <${EtqCobranca} situacao=${situacaoCobranca(c, hoje)} />${aoAbrir && html` <button type="button" class="btn-link" data-cobranca=${c.id} onClick=${() => aoAbrir(c.id)}>Detalhes</button>`}</span>
  </li>`)}</ul>`;
}

export function CAcordos(props) {
  const { estado, rota } = props;
  if (!liberado(estado.plano, 'acordos')) return html`<${Bloqueado} estado=${estado} recurso="acordos" titulo="Acordos de inadimplência com parcelamento e desconto" />`;
  const id = rota.id || '';
  if (id.startsWith('novoacordo')) return html`<${NovoAcordo} key=${id} ...${props} unidadeInicial=${id.split('-')[1] || null} />`;
  const acordo = estado.financeiro.acordos.find((a) => a.id === id);
  if (acordo) return html`<${DetalheAcordo} key=${acordo.id} ...${props} acordo=${acordo} />`;
  return html`<${ListaAcordos} ...${props} />`;
}

function ListaAcordos({ estado, agora }) {
  const fin = estado.financeiro;
  const hoje = isoDia(agora);
  const lista = [...fin.acordos].reverse();
  return html`<div class="pilha">
    <div class="linha-entre"><h2>Acordos</h2><a class="btn primario" href="#sindico.cobranca.novoacordo">Novo acordo</a></div>
    ${lista.length
      ? html`<div class="tabela-rolagem"><table class="tabela">
          <thead><tr><th>Acordo</th><th>Unidade</th><th>Situação</th><th>Progresso</th><th>Próxima</th><th>Ação</th></tr></thead>
          <tbody>${lista.map((a) => {
            const p = progressoAcordo(estado, a);
            const r = fin.unidades[a.unidade].responsavel;
            return html`<tr key=${a.id}>
              <td>${a.id}</td>
              <td>${a.unidade} · ${r ? r.nome : '—'}</td>
              <td><${EtqAcordo} situacao=${a.situacao} /></td>
              <td>${p.pagas} de ${p.total} parcelas pagas</td>
              <td>${p.proxima ? html`${fmtDataCurta(p.proxima.vencimento)}${situacaoCobranca(p.proxima, hoje) === 'vencida' ? html` <${EtqCobranca} situacao="vencida" />` : ''}` : '—'}</td>
              <td><a class="btn-link" data-acordo=${a.id} href=${`#sindico.cobranca.${a.id}`}>Abrir</a></td>
            </tr>`;
          })}</tbody>
        </table></div>`
      : html`<${Vazio} texto="Nenhum acordo ainda." />`}
    <small class="sub">As parcelas viram cobranças comuns: pagamento pelo Asaas, baixa manual e régua funcionam igual.</small>
  </div>`;
}

function NovoAcordo({ estado, executar, agora, unidadeInicial }) {
  const hoje = isoDia(agora);
  const fin = estado.financeiro;
  const unidades = estado.condominio.unidades.filter((u) => debitosParaAcordo(estado, u, hoje).length);
  const inicial = unidades.includes(unidadeInicial) ? unidadeInicial : unidades[0] || '';
  const [unidade, setUnidade] = useState(inicial);
  const [marcados, setMarcados] = useState(inicial ? debitosParaAcordo(estado, inicial, hoje).map((c) => c.id) : []);
  const [perdoaMulta, setPerdoaMulta] = useState(false);
  const [jurosPct, setJurosPct] = useState('0');
  const [entrada, setEntrada] = useState('');
  const [parcelas, setParcelas] = useState('3');
  const [erro, setErro] = useState(null);
  const voltar = html`<a class="voltar" href="#sindico.cobranca.acordos">‹ Acordos</a>`;
  if (!unidades.length) return html`<div class="pilha">${voltar}<${Vazio} texto="Nenhuma unidade com débito vencido." /></div>`;
  const debitos = debitosParaAcordo(estado, unidade, hoje);
  const dados = { unidade, originais: marcados, perdoaMulta, jurosPerdoadosPct: Number(jurosPct), entrada: entrada.trim() ? lerPreco(entrada) : 0, parcelas: Number(parcelas) };
  const s = simularAcordo(estado, dados, hoje);

  function trocarUnidade(u) {
    setUnidade(u);
    setMarcados(debitosParaAcordo(estado, u, hoje).map((c) => c.id));
  }

  function enviar() {
    const r = executar((e) => proporAcordo(e, dados, 'sindico', new Date()));
    if (r.erro) setErro(r.erro);
    else ir('sindico', 'cobranca', r.id);
  }

  return html`<div class="pilha formulario">
    ${voltar}
    <h2>Novo acordo</h2>
    <${Campo} rotulo="Unidade"><select id="acordo-unidade" value=${unidade} onChange=${(ev) => trocarUnidade(ev.target.value)}>${unidades.map((u) => html`<option key=${u} value=${u}>${u} · ${fin.unidades[u].responsavel.nome}</option>`)}</select><//>
    <fieldset><legend>Débitos vencidos</legend>
      ${debitos.map((c) => html`<label key=${c.id} class="check"><input id=${`acordo-debito-${c.id}`} type="checkbox" checked=${marcados.includes(c.id)} onChange=${() => setMarcados(marcados.includes(c.id) ? marcados.filter((x) => x !== c.id) : [...marcados, c.id])} /><span>${rotuloCobranca(c)} · ${fmtReais(valorAtualizado(c, fin.parametros, hoje).total)}</span></label>`)}
    </fieldset>
    <label class="check"><input id="acordo-perdoa-multa" type="checkbox" checked=${perdoaMulta} onChange=${() => setPerdoaMulta(!perdoaMulta)} /><span>Perdoar a multa</span></label>
    <div class="edicao-anuncio">
      <${Campo} rotulo="Juros perdoados (%)"><input id="acordo-juros" type="number" min="0" max="100" value=${jurosPct} onInput=${(ev) => setJurosPct(ev.target.value)} /><//>
      <${Campo} rotulo="Entrada (R$)"><input id="acordo-entrada" inputmode="decimal" value=${entrada} onInput=${(ev) => setEntrada(ev.target.value)} placeholder="Ex.: 300,00" /><//>
      <${Campo} rotulo="Parcelas"><select id="acordo-parcelas" value=${parcelas} onChange=${(ev) => setParcelas(ev.target.value)}>${Array.from({ length: 12 }, (_, i) => html`<option key=${i + 1} value=${String(i + 1)}>${i + 1}</option>`)}</select><//>
    </div>
    ${s.ok
      ? html`<div class="cartao simulacao">
          <dl class="resumo">
            <dt>Valor original</dt><dd>${fmtReais(s.valorOriginal)}</dd>
            <dt>Multa e juros</dt><dd>${fmtReais(s.multa + s.juros)}</dd>
            <dt>Desconto</dt><dd>${fmtReais(-s.desconto)}</dd>
            <dt>Total do acordo</dt><dd><strong>${fmtReais(s.total)}</strong></dd>
          </dl>
          <strong>${dados.entrada ? `Entrada de ${fmtReais(dados.entrada)} + ` : ''}${dados.parcelas} × ${fmtReais(s.valorParcela)}${s.ultimaParcela !== s.valorParcela ? ` (a última de ${fmtReais(s.ultimaParcela)})` : ''}</strong>
          <ul class="itens-sacola">${s.cronograma.map((l) => html`<li key=${l.numero}><span>${nomeLinha(l.numero, dados.parcelas)} · ${fmtDataCurta(l.vencimento)}</span><span>${fmtReais(l.valor)}</span></li>`)}</ul>
        </div>`
      : html`<${Erro} texto=${s.motivo} />`}
    <${Erro} texto=${erro} />
    <button type="button" class="btn primario" data-acao="enviar-proposta" disabled=${!s.ok} onClick=${enviar}>Enviar proposta</button>
  </div>`;
}

function DetalheAcordo({ estado, executar, agora, acordo }) {
  const hoje = isoDia(agora);
  const fin = estado.financeiro;
  const [aberta, setAberta] = useState(null);
  const [documento, setDocumento] = useState(null);
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const r = fin.unidades[acordo.unidade].responsavel;
  const selecionada = aberta ? fin.cobrancas.find((c) => c.id === aberta) : null;
  const auditoria = fin.auditoria.filter((a) => a.detalhe.startsWith(acordo.id));
  if (documento) return html`<${PrevDoc} documento=${documento} aoFechar=${() => setDocumento(null)} />`;

  function cancelar() {
    const res = executar((e) => cancelarProposta(e, acordo.id, 'sindico', new Date()));
    setErro(res.erro || null);
    setMensagem(res.erro ? null : 'Proposta cancelada. Os débitos originais continuam valendo.');
  }

  return html`<div class="pilha">
    <a class="voltar" href="#sindico.cobranca.acordos">‹ Acordos</a>
    <div class="linha-entre"><h2>Acordo ${acordo.id} · apto ${acordo.unidade}</h2><${EtqAcordo} situacao=${acordo.situacao} /></div>
    <small class="sub">${r ? r.nome : '—'} · proposto em ${fmtDataCurta(acordo.criadoEm)}${acordo.aceitoEm ? ` · aceito em ${fmtDataCurta(acordo.aceitoEm)} por ${acordo.aceitoPor}` : ''}</small>
    <div class="cartao"><${ResumoAcordo} estado=${estado} acordo=${acordo} /></div>
    <h2>${acordo.situacao === 'aguardando' ? 'Cronograma proposto' : 'Cronograma'}</h2>
    ${selecionada && html`<${DetalheCobranca} key=${selecionada.id} estado=${estado} cobranca=${selecionada} executar=${executar} hoje=${hoje} aoFechar=${() => setAberta(null)} />`}
    <div class="cartao"><${Cronograma} estado=${estado} acordo=${acordo} hoje=${hoje} aoAbrir=${setAberta} /></div>
    <div class="acoes">
      ${liberado(estado.plano, 'termoConfissao') && html`<button type="button" class="btn secundario" onClick=${() => setDocumento(termoDoAcordo(acordo))}>Ver termo de confissão</button>`}
      ${acordo.situacao === 'aguardando' && html`<button type="button" class="btn secundario" onClick=${cancelar}>Cancelar proposta</button>`}
    </div>
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
    <h2>Auditoria</h2>
    <ul class="auditoria">${[...auditoria].reverse().map((a, n) => html`<li key=${n}><span class="lt-quando">${fmtDataHora(a.em)}</span> <strong>${a.acao}</strong> · ${a.detalhe} · ${a.quem}</li>`)}</ul>
  </div>`;
}

export function PropostaAcordo({ estado, executar, acordo, hoje, eu }) {
  const [ciente, setCiente] = useState(false);
  const [documento, setDocumento] = useState(null);
  const [erro, setErro] = useState(null);
  const comTermo = liberado(estado.plano, 'termoConfissao');
  if (documento) return html`<${PrevDoc} documento=${documento} aoFechar=${() => setDocumento(null)} />`;

  function lerTermo() {
    executar((e) => marcarTermoLido(e, acordo.id, new Date()));
    setDocumento(termoDoAcordo(acordo));
  }

  function aceitar() {
    const r = executar((e) => aceitarAcordo(e, acordo.id, { quem: pessoaDaUnidade(estado, eu).nome, ciente }, new Date()));
    setErro(r.erro || null);
  }

  return html`<article class="cartao proposta-acordo">
    <div class="linha-entre"><strong>Proposta de acordo ${acordo.id}</strong><${EtqAcordo} situacao=${acordo.situacao} /></div>
    <small class="sub">Enviada pelo síndico em ${fmtDataCurta(acordo.criadoEm)}. Ao aceitar, os débitos incluídos são substituídos pelas parcelas abaixo.</small>
    <${ResumoAcordo} estado=${estado} acordo=${acordo} />
    <${Cronograma} estado=${estado} acordo=${acordo} hoje=${hoje} />
    ${comTermo && html`<button type="button" class="btn secundario" onClick=${lerTermo}>${acordo.termoLidoEm ? 'Abrir de novo o termo' : 'Ler o termo de confissão de dívida'}</button>`}
    <label class="check"><input id="acordo-ciente" type="checkbox" checked=${ciente} onChange=${() => setCiente(!ciente)} /><span>Li e aceito as condições do acordo</span></label>
    <${Erro} texto=${erro} />
    <button type="button" class="btn primario bloco" onClick=${aceitar}>Aceitar acordo</button>
  </article>`;
}

export function MeuAcordo({ estado, acordo, hoje }) {
  const p = progressoAcordo(estado, acordo);
  const pct = Math.round((p.pagas / p.total) * 100);
  return html`<article class="cartao">
    <div class="linha-entre"><strong>Meu acordo ${acordo.id}</strong><${EtqAcordo} situacao=${acordo.situacao} /></div>
    <small class="sub">${p.pagas} de ${p.total} parcelas pagas · total ${fmtReais(acordo.total)}</small>
    <div class="barra" role="progressbar" aria-label="Parcelas pagas" aria-valuenow=${p.pagas} aria-valuemin="0" aria-valuemax=${p.total}><span style=${`width:${pct}%`}></span></div>
    <details class="composicao"><summary>Cronograma</summary><${Cronograma} estado=${estado} acordo=${acordo} hoje=${hoje} /></details>
  </article>`;
}
