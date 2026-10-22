import { html, useState, useEffect } from '../vendor.js';
import { AVATAR_ABEL } from '../assistente/avatar.js';
import { PERFIS_ABEL, saudacaoAbel, responderAbel } from '../assistente/regras.js';
import { ir } from './comum.js';

// Texto do Sr. Abel com **negrito** e listas "- ". Escapa tudo antes de formatar.
function TextoAbel({ texto }) {
  const blocos = [];
  let lista = null;
  texto.split('\n').forEach((linha, i) => {
    const partes = linha.replace(/^- /, '').split(/\*\*(.+?)\*\*/g).map((p, j) => (j % 2 ? html`<strong key=${j}>${p}</strong>` : p));
    if (linha.startsWith('- ')) {
      if (!lista) { lista = []; blocos.push(html`<ul key=${`l${i}`}>${lista}</ul>`); }
      lista.push(html`<li key=${i}>${partes}</li>`);
    } else {
      lista = null;
      if (linha.trim()) blocos.push(html`<p key=${i}>${partes}</p>`);
    }
  });
  return blocos;
}

export function SrAbel({ estado, rota, agora }) {
  const perfil = rota.perfil;
  const chaveConversa = perfil === 'morador' ? `${perfil}-${estado.moradorAtual}` : perfil;
  const [aberto, setAberto] = useState(false);
  const [conversa, setConversa] = useState({ chave: null, mensagens: [] });
  const [texto, setTexto] = useState('');

  const mensagens = conversa.chave === chaveConversa ? conversa.mensagens : [{ de: 'abel', texto: saudacaoAbel(estado, perfil), links: [] }];

  useEffect(() => {
    const el = document.getElementById('abel-msgs');
    if (el) el.scrollTop = el.scrollHeight;
  }, [mensagens.length, aberto]);

  function perguntar(pergunta) {
    const p = pergunta.trim();
    if (!p) return;
    const resposta = responderAbel(estado, perfil, p, agora);
    setConversa({ chave: chaveConversa, mensagens: [...mensagens, { de: 'eu', texto: p, links: [] }, { de: 'abel', ...resposta }] });
    setTexto('');
  }

  const sugestoes = (PERFIS_ABEL[perfil] || PERFIS_ABEL.morador).sugestoes;

  return html`
    ${aberto && html`<section class="abel-painel" role="dialog" aria-label="Sr. Abel, assistente do CondoFácil">
      <header class="abel-topo">
        <img class="abel-avatar" src=${AVATAR_ABEL} alt="" />
        <div><strong>Sr. Abel</strong><small>Assistente do CondoFácil</small></div>
        <button type="button" class="abel-fechar" aria-label="Fechar o Sr. Abel" onClick=${() => setAberto(false)}>×</button>
      </header>
      <div class="abel-msgs" id="abel-msgs" aria-live="polite">
        ${mensagens.map((m, i) => html`<div key=${i} class=${`abel-msg abel-${m.de}`}>
          <div class="abel-bolha"><${TextoAbel} texto=${m.texto} /></div>
          ${m.links && m.links.length ? html`<div class="abel-links">${m.links.map((l) => html`<button type="button" key=${l.rotulo} class="btn-link" onClick=${() => ir(l.perfil, l.tela)}>${l.rotulo} →</button>`)}</div>` : null}
        </div>`)}
      </div>
      <div class="abel-sugestoes">${sugestoes.map((s) => html`<button type="button" key=${s} onClick=${() => perguntar(s)}>${s}</button>`)}</div>
      <form class="abel-entrada" onSubmit=${(ev) => { ev.preventDefault(); perguntar(texto); }}>
        <label class="so-leitor" for="abel-caixa">Pergunte ao Sr. Abel</label>
        <input id="abel-caixa" type="text" autocomplete="off" placeholder="Pergunte ao Sr. Abel…" value=${texto} onInput=${(ev) => setTexto(ev.target.value)} />
        <button type="submit" class="btn primario" disabled=${!texto.trim()}>Enviar</button>
      </form>
      <small class="abel-aviso">Versão do protótipo: respostas pelo manual, sem IA. Decisões são do síndico.</small>
    </section>`}
    <button type="button" class="abel-botao" aria-expanded=${aberto} aria-label=${aberto ? 'Fechar o Sr. Abel' : 'Falar com o Sr. Abel'} onClick=${() => setAberto(!aberto)}>
      <img src=${AVATAR_ABEL} alt="" /><span>${aberto ? 'Fechar' : 'Sr. Abel'}</span>
    </button>
  `;
}
