import { html, useState } from '../vendor.js';
import { enquetePorId, situacaoEnquete, textoDiasRestantes, textoResultado, enquetesPendentes, enquetesDaUnidade, unidadesDoPublico } from '../enquetes/regras.js';
import { votar } from '../enquetes/acoes.js';
import { pessoaDaUnidade } from '../vendas/regras.js';
import { isoDia, fmtDataCurta } from '../datas.js';
import { Campo, Erro, Sucesso, Vazio } from './comum.js';
import { BarrasOpcoes, EtqEnquete } from './enquetes.js';

// Enquetes do morador: cartão no Início (some depois do voto), lista em Mais e a tela de voto.
export function CartaoEnqueteInicio({ estado, eu, agora }) {
  const pendentes = enquetesPendentes(estado, eu, agora);
  return pendentes.map((e) => html`<a key=${e.id} class="cartao link enquete-inicio" href=${`#morador.enquetes.${e.id}`}>
    <span class="sub">Enquete · ${textoDiasRestantes(e, agora)}</span>
    <strong>${e.pergunta}</strong>
    <span class="btn primario">Responder</span>
  </a>`);
}

function TelaVoto({ estado, executar, agora, e, eu }) {
  const voto = e.votos[eu];
  const [escolhidas, setEscolhidas] = useState(voto ? voto.opcoes : []);
  const [comentario, setComentario] = useState(voto ? voto.comentario : '');
  const [trocando, setTrocando] = useState(false);
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const s = situacaoEnquete(e, agora);
  const pessoa = pessoaDaUnidade(estado, eu);
  const nome = pessoa ? pessoa.nome : `Apto ${eu}`;
  const multipla = e.tipo === 'multipla';
  const mostraResultado = s === 'encerrada' || (voto && e.parcialVisivel);
  const votando = s === 'aberta' && (!voto || trocando);

  function alternar(id) {
    if (!multipla) setEscolhidas([id]);
    else setEscolhidas(escolhidas.includes(id) ? escolhidas.filter((x) => x !== id) : [...escolhidas, id]);
  }

  function enviar() {
    const r = executar((x) => votar(x, e.id, { unidade: eu, autor: nome, opcoes: escolhidas, comentario }, new Date()));
    setErro(r.erro || null);
    if (!r.erro) {
      setTrocando(false);
      setMensagem(r.trocou ? 'Voto alterado.' : 'Seu voto foi registrado.');
    }
  }

  return html`<section class="m-pagina">
    <a class="voltar" href="#morador.enquetes">‹ Enquetes</a>
    <div class="etq-linha"><${EtqEnquete} e=${e} agora=${agora} /><span class="sub">${s === 'aberta' ? `Responda até ${fmtDataCurta(isoDia(new Date(e.encerraEm)))} · ${textoDiasRestantes(e, agora)}` : `Encerrada em ${fmtDataCurta(isoDia(new Date(e.encerradaEm || e.encerraEm)))}`}</span></div>
    <h1 class="m-titulo">${e.pergunta}</h1>
    ${e.contexto && html`<p class="m-texto">${e.contexto}</p>`}
    <${Sucesso} texto=${mensagem} />
    ${voto && !trocando && html`<div class="cartao">
      <strong>${voto.autor === nome ? 'Seu voto' : `Sua unidade já votou (${voto.autor})`}</strong>
      <span>${voto.opcoes.map((id) => e.opcoes.find((o) => o.id === id).texto).join(', ')}</span>
      ${voto.comentario && html`<small class="sub">“${voto.comentario}”</small>`}
      ${s === 'aberta' && html`<button type="button" class="btn-link" data-acao="trocar-voto" onClick=${() => setTrocando(true)}>Trocar o voto</button>`}
    </div>`}
    ${votando && html`<div class="pilha">
      <fieldset><legend>${multipla ? `Escolha até ${e.maxEscolhas} opções` : 'Escolha uma opção'}</legend>
        ${e.opcoes.map((o) => html`<label key=${o.id} class="check"><input type=${multipla ? 'checkbox' : 'radio'} name="voto-enquete" data-opcao=${o.id} checked=${escolhidas.includes(o.id)} onChange=${() => alternar(o.id)} /><span>${o.texto}</span></label>`)}
      </fieldset>
      ${e.comentarios && html`<${Campo} rotulo="Comentário (opcional)"><textarea id="enquete-comentario" rows="2" value=${comentario} onInput=${(ev) => setComentario(ev.target.value)}></textarea><//>`}
      <small class="sub">${e.secreto ? 'Voto secreto: o síndico vê só os totais.' : 'Voto aberto: o síndico vê o voto de cada unidade.'} Um voto por unidade${e.peso === 'fracao' ? ', com peso pela fração ideal' : ''}.</small>
      <${Erro} texto=${erro} />
      <button type="button" class="btn primario bloco" data-acao="enviar-voto" onClick=${enviar}>${voto ? 'Salvar novo voto' : 'Enviar voto'}</button>
    </div>`}
    ${mostraResultado && html`<h2>${s === 'encerrada' ? textoResultado(estado, e) : 'Parcial'}</h2><${BarrasOpcoes} estado=${estado} e=${e} />`}
    ${voto && !mostraResultado && s === 'aberta' && html`<p class="m-sub">O resultado aparece aqui quando a enquete encerrar.</p>`}
  </section>`;
}

export function MEnquetes({ estado, executar, agora, eu, rota }) {
  const e = rota.id ? enquetePorId(estado, rota.id) : null;
  if (e && e.situacao !== 'rascunho' && unidadesDoPublico(estado, e).includes(eu)) return html`<${TelaVoto} key=${e.id} estado=${estado} executar=${executar} agora=${agora} e=${e} eu=${eu} />`;
  const { pendentes, respondidas, encerradas } = enquetesDaUnidade(estado, eu, agora);
  const item = (x, detalhe) => html`<li key=${x.id}><a class="cartao link" href=${`#morador.enquetes.${x.id}`}><strong>${x.pergunta}</strong><span class="sub">${detalhe}</span></a></li>`;
  return html`<section class="m-pagina">
    <h1 class="m-titulo">Enquetes</h1>
    <h2>Para responder</h2>
    ${pendentes.length ? html`<ul class="m-lista">${pendentes.map((x) => item(x, textoDiasRestantes(x, agora)))}</ul>` : html`<${Vazio} texto="Nenhuma enquete esperando sua resposta." />`}
    ${respondidas.length > 0 && html`<h2>Respondidas</h2><ul class="m-lista">${respondidas.map((x) => item(x, `Você já votou · ${textoDiasRestantes(x, agora)}`))}</ul>`}
    <h2>Encerradas</h2>
    ${encerradas.length ? html`<ul class="m-lista">${encerradas.map((x) => item(x, textoResultado(estado, x)))}</ul>` : html`<${Vazio} texto="Nenhuma enquete encerrada." />`}
  </section>`;
}
