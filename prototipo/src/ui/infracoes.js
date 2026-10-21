import { html, useState } from '../vendor.js';
import { liberado } from '../planos.js';
import { fmtReais } from '../cobranca/regras.js';
import { NOMES_TIPO_INFRACAO, NOMES_SITUACAO_INFRACAO, NOMES_RESULTADO_INFRACAO, PRAZO_DEFESA_PADRAO, infracaoPorId, situacaoInfracao, prazoVencido, podeDecidir, infracoesDaUnidade, infracoesAbertas, fatoPadrao } from '../infracoes/regras.js';
import { abrirProcesso, apresentarDefesa, encerrarPrazo, decidirProcesso } from '../infracoes/acoes.js';
import { lerPreco, pessoaDaUnidade } from '../vendas/regras.js';
import { isoDia, nomeMes, fmtDataCurta, fmtDataHora } from '../datas.js';
import { Campo, Erro, Sucesso, Vazio, Etiqueta } from './comum.js';
import { Bloqueado } from './financeiro-sindico.js';

// Processo de infração: cartão na notificação, lista e detalhe do síndico, e a defesa do morador.
const ETQ_SITUACAO_INFRACAO = { defesa: 'alerta', analise: 'info', decidido: 'neutro' };

function EtqInfracao({ p, hoje }) {
  const s = situacaoInfracao(p, hoje);
  return html`<${Etiqueta} tipo=${ETQ_SITUACAO_INFRACAO[s]}>${s === 'decidido' ? NOMES_RESULTADO_INFRACAO[p.decisao.resultado] : NOMES_SITUACAO_INFRACAO[s]}<//>`;
}

function LinhaProcesso({ linha }) {
  return html`<ol class="linha-tempo">${linha.map((l, i) => html`<li key=${i} class="marco">
    <span class="lt-quando">${fmtDataHora(l.em)}</span>
    <strong>${l.texto}</strong>
    <span>${l.autor}</span>
  </li>`)}</ol>`;
}

function ResumoProcesso({ p }) {
  return html`<dl class="resumo">
    <dt>Tipo</dt><dd>${NOMES_TIPO_INFRACAO[p.tipo]}${p.valor ? ` · ${fmtReais(p.valor)}` : ''}</dd>
    <dt>Fato</dt><dd>${p.fato}</dd>
    <dt>Base</dt><dd>${p.artigo}</dd>
    <dt>Prazo de defesa</dt><dd>até ${fmtDataCurta(p.prazoAte)} (${p.prazoDias} dias)</dd>
    ${p.decisao && html`<dt>Decisão</dt><dd>${NOMES_RESULTADO_INFRACAO[p.decisao.resultado]}: ${p.decisao.justificativa}</dd>`}
    ${p.lancamento && html`<dt>Lançamento</dt><dd>Multa no boleto de ${nomeMes(p.lancamento)}</dd>`}
  </dl>`;
}

export function CartaoProcessoOcorrencia({ estado, executar, oc }) {
  const [form, setForm] = useState({ unidade: '', tipo: 'multa', artigo: '', fato: fatoPadrao(oc), valor: '', prazoDias: String(PRAZO_DEFESA_PADRAO) });
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  if (!liberado(estado.plano, 'multasDefesa')) return html`<${Bloqueado} estado=${estado} recurso="multasDefesa" titulo="Advertência ou multa com direito de defesa" />`;
  const hoje = isoDia(new Date());
  const processos = (oc.processos || []).map((id) => infracaoPorId(estado, id)).filter(Boolean);
  const campo = (chave) => (ev) => setForm({ ...form, [chave]: ev.target.value });

  function abrir() {
    const r = executar((e) => abrirProcesso(e, oc.id, { ...form, valor: lerPreco(form.valor), prazoDias: Number(form.prazoDias) }, 'sindico', new Date()));
    setErro(r.erro || null);
    setMensagem(r.erro ? null : `Processo ${r.id} aberto. A unidade foi notificada.`);
  }

  return html`<div class="cartao pilha">
    <strong>Advertência ou multa</strong>
    ${processos.length > 0 && html`<ul class="itens-sacola">${processos.map((p) => html`<li key=${p.id}><a href=${`#sindico.ocorrencias.${p.id}`}>${p.id} · ${NOMES_TIPO_INFRACAO[p.tipo].toLowerCase()} ao apto ${p.unidade}</a><${EtqInfracao} p=${p} hoje=${hoje} /></li>`)}</ul>`}
    <div class="edicao-anuncio">
      <${Campo} rotulo="Unidade infratora"><input id="infracao-unidade" value=${form.unidade} onInput=${campo('unidade')} placeholder="Ex.: 503" /><//>
      <${Campo} rotulo="Tipo"><select id="infracao-tipo" value=${form.tipo} onChange=${campo('tipo')}><option value="multa">Multa</option><option value="advertencia">Advertência</option></select><//>
      <${Campo} rotulo="Artigo do regimento"><input id="infracao-artigo" value=${form.artigo} onInput=${campo('artigo')} placeholder="Ex.: Art. 18 (obras só em dias úteis)" /><//>
      ${form.tipo === 'multa' && html`<${Campo} rotulo="Valor da multa (R$)"><input id="infracao-valor" inputmode="decimal" value=${form.valor} onInput=${campo('valor')} placeholder="Ex.: 150,00" /><//>`}
      <${Campo} rotulo="Prazo de defesa (dias)" dica="De 5 a 30 dias"><input id="infracao-prazo" type="number" min="5" max="30" value=${form.prazoDias} onInput=${campo('prazoDias')} /><//>
    </div>
    <${Campo} rotulo="Descrição do fato" dica="É o que o morador vê. A notificação original e quem a enviou nunca são mostrados."><textarea id="infracao-fato" rows="2" value=${form.fato} onInput=${campo('fato')}></textarea><//>
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
    <button type="button" class="btn secundario" data-acao="abrir-processo" onClick=${abrir}>Abrir processo</button>
  </div>`;
}

export function BlocoProcessos({ estado, agora }) {
  if (!liberado(estado.plano, 'multasDefesa')) return null;
  const hoje = isoDia(agora);
  const abertos = infracoesAbertas(estado);
  return html`<div class="pilha">
    <h2>Processos de infração</h2>
    ${abertos.length
      ? html`<div class="tabela-rolagem"><table class="tabela">
          <thead><tr><th>Processo</th><th>Unidade</th><th>Tipo</th><th>Situação</th><th>Prazo de defesa</th></tr></thead>
          <tbody>${abertos.map((p) => html`<tr key=${p.id}>
            <td><a href=${`#sindico.ocorrencias.${p.id}`}>${p.id}</a></td>
            <td>${p.unidade}</td>
            <td>${NOMES_TIPO_INFRACAO[p.tipo]}${p.valor ? ` · ${fmtReais(p.valor)}` : ''}</td>
            <td><${EtqInfracao} p=${p} hoje=${hoje} />${podeDecidir(p, hoje) ? html` <small class="sub">decida</small>` : ''}</td>
            <td>${fmtDataCurta(p.prazoAte)}</td>
          </tr>`)}</tbody>
        </table></div>`
      : html`<${Vazio} texto="Nenhum processo em andamento." />`}
  </div>`;
}

export function SDetalheInfracao({ estado, executar, agora, p }) {
  const [resultado, setResultado] = useState('mantida');
  const [justificativa, setJustificativa] = useState('');
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const hoje = isoDia(agora);

  function rodar(acao, sucesso) {
    const r = executar(acao);
    setErro(r.erro || null);
    setMensagem(r.erro ? null : sucesso);
  }

  return html`<section class="pilha">
    <a class="voltar" href="#sindico.ocorrencias">‹ Notificações</a>
    <p class="protocolo">Processo ${p.id}</p>
    <div class="linha-entre"><h1>${NOMES_TIPO_INFRACAO[p.tipo]} · apto ${p.unidade}</h1><${EtqInfracao} p=${p} hoje=${hoje} /></div>
    <p class="sub">Aberto a partir da notificação <a href=${`#sindico.ocorrencias.${p.ocorrencia}`}>${p.ocorrencia}</a>. O morador vê só o fato descrito abaixo.</p>
    <${ResumoProcesso} p=${p} />
    <h2>Defesa</h2>
    ${p.defesa
      ? html`<div class="cartao"><strong>${p.defesa.autor} · ${fmtDataHora(p.defesa.em)}</strong><p class="texto-longo">${p.defesa.texto}</p>${p.defesa.anexo && html`<small class="sub">Anexo: ${p.defesa.anexo}</small>`}</div>`
      : html`<p class="sub">${prazoVencido(p, hoje) ? 'O prazo terminou sem defesa.' : `Aguardando a defesa até ${fmtDataCurta(p.prazoAte)}.`}</p>`}
    ${p.situacao === 'defesa' && !p.defesa && !prazoVencido(p, hoje) && html`<div class="acoes"><button type="button" class="btn secundario" data-acao="encerrar-prazo" onClick=${() => rodar((e) => encerrarPrazo(e, p.id, 'sindico', new Date()), 'Prazo encerrado. Agora você pode decidir.')}>Simular fim do prazo (demonstração)</button></div>`}
    ${podeDecidir(p, hoje) && html`<div class="cartao pilha">
      <strong>Decisão</strong>
      <div class="edicao-anuncio">
        <${Campo} rotulo="Decisão"><select id="infracao-decisao" value=${resultado} onChange=${(ev) => setResultado(ev.target.value)}>
          <option value="mantida">Manter ${p.tipo === 'multa' ? `a multa (lança ${fmtReais(p.valor)} no próximo boleto)` : 'a advertência'}</option>
          ${p.tipo === 'multa' && html`<option value="convertida">Converter em advertência</option>`}
          <option value="cancelada">Cancelar</option>
        </select><//>
      </div>
      <${Campo} rotulo="Justificativa" dica="O morador recebe a decisão com esta justificativa."><textarea id="infracao-justificativa" rows="2" value=${justificativa} onInput=${(ev) => setJustificativa(ev.target.value)}></textarea><//>
      <button type="button" class="btn primario" data-acao="decidir-processo" onClick=${() => rodar((e) => decidirProcesso(e, p.id, { resultado, justificativa }, 'sindico', new Date()), 'Decisão registrada e enviada à unidade.')}>Registrar decisão</button>
    </div>`}
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
    <h2>Linha do tempo</h2>
    <${LinhaProcesso} linha=${p.linha} />
  </section>`;
}

export function MBlocoInfracoes({ estado, eu, agora }) {
  const lista = infracoesDaUnidade(estado, eu);
  if (!lista.length) return null;
  const hoje = isoDia(agora);
  return html`<h2>Notificações para o seu apartamento</h2>
    <ul class="m-lista">${lista.map((p) => html`<li key=${p.id}><a class="cartao link" href=${`#morador.ocorrencias.${p.id}`}>
      <div class="linha-entre"><strong>${NOMES_TIPO_INFRACAO[p.tipo]}${p.valor ? ` · ${fmtReais(p.valor)}` : ''}</strong><${EtqInfracao} p=${p} hoje=${hoje} /></div>
      <span>${p.fato}</span>
      <small class="sub">${p.id} · ${situacaoInfracao(p, hoje) === 'defesa' ? `defesa até ${fmtDataCurta(p.prazoAte)}` : p.artigo}</small>
    </a></li>`)}</ul>`;
}

export function MDetalheInfracao({ estado, executar, agora, p, eu }) {
  const [texto, setTexto] = useState('');
  const [anexo, setAnexo] = useState(null);
  const [erro, setErro] = useState(null);
  const hoje = isoDia(agora);
  const aberta = situacaoInfracao(p, hoje) === 'defesa' && !p.defesa;
  const autor = pessoaDaUnidade(estado, eu) ? pessoaDaUnidade(estado, eu).nome : `Apto ${eu}`;

  function enviar() {
    const r = executar((e) => apresentarDefesa(e, p.id, { unidade: eu, autor, texto, anexo }, new Date()));
    setErro(r.erro || null);
  }

  return html`<section class="m-pagina">
    <a class="voltar" href="#morador.ocorrencias">‹ Notificações</a>
    <p class="protocolo">Processo ${p.id}</p>
    <h1 class="m-titulo">Notificação formal do condomínio</h1>
    <div class="etq-linha"><${EtqInfracao} p=${p} hoje=${hoje} /><span class="sub">${NOMES_TIPO_INFRACAO[p.tipo]} · apto ${p.unidade}</span></div>
    <${ResumoProcesso} p=${p} />
    ${aberta && html`<div class="cartao pilha">
      <strong>Você tem até ${fmtDataCurta(p.prazoAte)} para apresentar sua defesa</strong>
      <small class="sub">O síndico só decide depois da sua defesa ou do fim do prazo.</small>
      <${Campo} rotulo="Sua defesa"><textarea id="defesa-texto" rows="4" value=${texto} onInput=${(ev) => setTexto(ev.target.value)}></textarea><//>
      <button type="button" class="btn secundario" onClick=${() => setAnexo(`defesa-${p.id}.pdf`)}>${anexo ? `Anexado: ${anexo}` : 'Anexar documento'}</button>
      <${Erro} texto=${erro} />
      <button type="button" class="btn primario" data-acao="enviar-defesa" onClick=${enviar}>Enviar defesa</button>
    </div>`}
    ${p.defesa && html`<div class="cartao"><strong>Sua defesa · ${fmtDataHora(p.defesa.em)}</strong><p class="m-texto">${p.defesa.texto}</p>${p.defesa.anexo && html`<small class="sub">Anexo: ${p.defesa.anexo}</small>`}</div>`}
    ${!p.defesa && !aberta && p.situacao !== 'decidido' && html`<p class="m-sub">O prazo de defesa terminou. Aguarde a decisão do síndico.</p>`}
    <h2>Andamento</h2>
    <${LinhaProcesso} linha=${p.linha} />
  </section>`;
}

export function CartaoInfracaoInicio({ estado, eu, agora }) {
  const hoje = isoDia(agora);
  const p = infracoesDaUnidade(estado, eu).find((x) => situacaoInfracao(x, hoje) === 'defesa' && !x.defesa);
  if (!p) return null;
  return html`<a class="cartao link cobranca-inicio vencida" href=${`#morador.ocorrencias.${p.id}`}>
    <strong>Notificação formal do condomínio</strong>
    <span>${NOMES_TIPO_INFRACAO[p.tipo]}${p.valor ? ` de ${fmtReais(p.valor)}` : ''}: ${p.fato}</span>
    <small class="sub">Você pode apresentar defesa até ${fmtDataCurta(p.prazoAte)}</small>
    <span class="btn primario">Ver e responder</span>
  </a>`;
}
