import { html, useState } from '../vendor.js';
import { liberado } from '../planos.js';
import { CONSELHEIRO } from '../financeiro/dados.js';
import { balanceteDe, mesesParaOConselho } from '../financeiro/balancete.js';
import { pedirCorrecao, aprovarMes } from '../financeiro/acoes.js';
import { isoDia, nomeMes, fmtDataCurta } from '../datas.js';
import { Campo, Erro, Sucesso, Vazio, Etiqueta, Icone, PrevDoc } from './comum.js';
import { Bloqueado } from './financeiro-sindico.js';
import { EtqBalancete, ListaMesesPrestacao, VisaoBalancete } from './financeiro.js';

// Perfil do conselho fiscal: analisa os balancetes, comenta lançamentos, pede correção ou aprova (Avançado).
const MENU_CONSELHO = [['prestacao', 'Prestação de contas', 'grafico'], ['documentos', 'Documentos', 'documento']];

export function TelaConselho(props) {
  const tela = MENU_CONSELHO.some(([id]) => id === props.rota.tela) ? props.rota.tela : 'prestacao';
  const Conteudo = { prestacao: CPrestacao, documentos: CDocumentos }[tela];
  return html`<div class="painel">
    <nav class="painel-menu" aria-label="Menu do conselho">
      <p class="painel-usuario"><strong>${CONSELHEIRO.nome}</strong><small>${CONSELHEIRO.papel} · apto ${CONSELHEIRO.unidade}</small></p>
      ${MENU_CONSELHO.map(([id, nome, icone]) => html`<a key=${id} href=${`#conselho.${id}`} class=${id === tela ? 'ativa' : ''} aria-current=${id === tela ? 'page' : undefined}><${Icone} nome=${icone} tamanho=${20} />${nome}</a>`)}
    </nav>
    <div class="painel-conteudo"><${Conteudo} ...${props} /></div>
  </div>`;
}

function CPrestacao({ estado, executar, agora, rota }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const hoje = isoDia(agora);
  const comConselho = liberado(estado.plano, 'aprovacaoConselho');
  const mes = rota.id || null;
  const b = mes ? balanceteDe(estado, mes, hoje) : null;
  const aoResultado = (e, m) => { setErro(e); setMensagem(m); };
  const rodar = (acao, sucesso) => { const r = executar(acao); aoResultado(r.erro || null, r.erro ? null : sucesso); return r; };
  if (!b) {
    const pendentes = mesesParaOConselho(estado);
    return html`<section class="pilha">
      <h1>Prestação de contas</h1>
      ${!comConselho && html`<${Bloqueado} estado=${estado} recurso="aprovacaoConselho" titulo="Aprovação digital do conselho fiscal, com comentários por lançamento" />`}
      ${comConselho && (pendentes.length
        ? html`<div class="alertas">${pendentes.map((m) => html`<p key=${m} class="alerta-doc faixa-alerta"><a href=${`#conselho.prestacao.${m}`}><strong>Balancete de ${nomeMes(m)}</strong> aguarda a sua análise</a></p>`)}</div>`
        : html`<${Vazio} texto="Nenhum balancete aguardando a sua análise." />`)}
      <${ListaMesesPrestacao} estado=${estado} hoje=${hoje} base="#conselho.prestacao." />
    </section>`;
  }
  const analisa = comConselho && b.situacao === 'aguardando';
  return html`<section class="pilha">
    <a class="voltar" href="#conselho.prestacao">‹ Prestação de contas</a>
    <div class="linha-entre"><h1>Balancete de ${nomeMes(mes)}</h1><${EtqBalancete} b=${b} /></div>
    ${b.fechadoEm && html`<p class="sub">Fechado pelo síndico em ${fmtDataCurta(isoDia(new Date(b.fechadoEm)))}${b.correcao && b.correcao.respondidaEm ? ' · corrigido e reenviado' : ''}.</p>`}
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
    <${VisaoBalancete} key=${mes} estado=${estado} mes=${mes} b=${b} perfil="conselho" executar=${executar} aoResultado=${aoResultado} />
    ${analisa && html`<div class="cartao pilha">
      <strong>Parecer do conselho</strong>
      <button type="button" class="btn primario" data-acao="aprovar-mes" onClick=${() => rodar((e) => aprovarMes(e, mes, 'conselho', new Date()), 'Balancete aprovado. O mês está travado.')}>Aprovar o balancete</button>
      <${Campo} rotulo="Motivo da correção"><input id="correcao-motivo" value=${motivo} onInput=${(ev) => setMotivo(ev.target.value)} placeholder="Ex.: anexar a nota da dedetização" /><//>
      <button type="button" class="btn secundario" data-acao="pedir-correcao" onClick=${() => rodar((e) => pedirCorrecao(e, mes, motivo, 'conselho', new Date()), 'Correção pedida ao síndico.')}>Pedir correção</button>
    </div>`}
  </section>`;
}

function CDocumentos({ estado }) {
  const [aberto, setAberto] = useState(null);
  const documento = estado.documentos.find((d) => d.id === aberto);
  if (documento) return html`<section><${PrevDoc} documento=${documento} aoFechar=${() => setAberto(null)} /></section>`;
  const docs = [...estado.documentos].sort((a, b) => a.pasta.localeCompare(b.pasta));
  return html`<section class="pilha">
    <h1>Documentos</h1>
    <ul class="m-lista">${docs.map((d) => html`<li key=${d.id} class="cartao">
      <div class="linha-entre"><button type="button" class="btn-link" onClick=${() => setAberto(d.id)}>${d.titulo}</button>${d.visibilidade === 'conselho' && html`<${Etiqueta}>Só conselho<//>`}</div>
      <small class="sub">${d.pasta} · versão ${d.versoes.length} de ${fmtDataCurta(d.versoes.at(-1).data)}</small>
    </li>`)}</ul>
  </section>`;
}
