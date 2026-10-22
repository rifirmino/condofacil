import { html, useState, useEffect, useRef } from '../vendor.js';
import { AVATAR_ABEL } from '../assistente/avatar.js';
import { PERFIS_ABEL, saudacaoAbel, responderAbel } from '../assistente/regras.js';
import { instrucoesAbel } from '../assistente/ia.js';
import { ferramentasAbel } from '../assistente/ferramentas.js';
import { liberado, planoMinimo, mensalidade } from '../planos.js';
import { fmtReais } from '../cobranca/regras.js';
import { ir } from './comum.js';

// Sr. Abel: Intermediário responde pelo manual e pelos dados do perfil; Avançado conversa com o Claude, vendo o estado real.
const COPIA_ERRO_ABEL = {
  rate_limited: 'Muitas perguntas seguidas. Espere um pouquinho e tente de novo.',
  session_expired: 'Sua sessão expirou. Entre de novo no Claude e tente outra vez.',
  refused: 'Não posso responder isso. Tente perguntar de outro jeito.',
  empty_completion: 'Fiquei sem palavras 🐝. Tente perguntar de outro jeito.',
  prompt_too_large: 'A conversa ficou longa demais. Toque em Nova conversa.',
};
const SEM_IA_ABEL = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'];

// Texto do Sr. Abel com **negrito** e listas "- " ou "1. ". Escapa tudo antes de formatar.
function TextoAbel({ texto }) {
  const blocos = [];
  let lista = null;
  texto.split('\n').forEach((linha, i) => {
    const item = linha.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)/);
    const partes = (item ? item[1] : linha).split(/\*\*(.+?)\*\*/g).map((p, j) => (j % 2 ? html`<strong key=${j}>${p}</strong>` : p));
    if (item) {
      if (!lista) { lista = []; blocos.push(html`<ul key=${`l${i}`}>${lista}</ul>`); }
      lista.push(html`<li key=${i}>${partes}</li>`);
    } else {
      lista = null;
      if (linha.trim()) blocos.push(html`<p key=${i}>${partes.map((p) => (typeof p === 'string' ? p.replace(/^#+\s*/, '') : p))}</p>`);
    }
  });
  return blocos;
}

function AvisoPlanoAbel({ estado }) {
  const minimo = planoMinimo('assistente');
  const unidades = estado.condominio.unidades.length;
  return html`<div class="abel-msgs"><div class="bloqueado">
    <strong>Sr. Abel, o assistente do CondoFácil</strong>
    <span>Disponível no plano ${minimo.nome} (+${fmtReais(mensalidade(minimo.id, unidades) - mensalidade(estado.plano, unidades))}/mês)</span>
    <small class="sub">Tira dúvidas do app e consulta os seus dados. No Avançado, conversa com IA e faz ações como reservar e votar.</small>
  </div></div>`;
}

export function SrAbel({ estado, rota, agora, executar, obterEstado }) {
  const perfil = rota.perfil;
  const chaveConversa = perfil === 'morador' ? `${perfil}-${estado.moradorAtual}` : perfil;
  const comAbel = liberado(estado.plano, 'assistente');
  const comIA = liberado(estado.plano, 'assistenteIA');
  const [aberto, setAberto] = useState(false);
  const [conversa, setConversa] = useState({ chave: null, mensagens: [] });
  const [texto, setTexto] = useState('');
  const [sample, setSample] = useState(null);
  const [comFerramentas, setComFerramentas] = useState(false);
  const [pensando, setPensando] = useState(false);
  const controle = useRef(null);

  useEffect(() => {
    let ativo = true;
    if (!comIA || !window.claude || !window.claude.use) { setSample(null); return undefined; }
    window.claude.use('sample').then(async (s) => {
      if (!ativo) return;
      setSample(() => s);
      const lim = s ? await s.limits().catch(() => null) : null;
      if (ativo) setComFerramentas(!!(lim && lim.tools));
    }).catch(() => ativo && setSample(null));
    return () => { ativo = false; };
  }, [comIA]);

  const mensagens = conversa.chave === chaveConversa ? conversa.mensagens : [{ de: 'abel', texto: saudacaoAbel(estado, perfil), links: [] }];
  const comIAAgora = comIA && !!sample;

  useEffect(() => {
    const el = document.getElementById('abel-msgs');
    if (el) el.scrollTop = el.scrollHeight;
  }, [mensagens.length, aberto, mensagens.at(-1) && mensagens.at(-1).texto]);

  function guardar(lista) {
    setConversa({ chave: chaveConversa, mensagens: lista });
  }

  async function perguntarIA(base, p) {
    const pendente = { de: 'abel', texto: 'O Sr. Abel está pensando…', links: [], pensando: true };
    let atual = [...base, pendente];
    guardar(atual);
    setPensando(true);
    const ctl = new AbortController();
    controle.current = ctl;
    const trocar = (msg) => { atual = [...atual.slice(0, -1), msg]; guardar(atual); };
    const acoes = [];
    const turnos = base.filter((m) => !m.pensando && !m.acao).slice(-14).map((m) => ({ role: m.de === 'eu' ? 'user' : 'assistant', content: m.texto }));
    while (turnos.length && turnos[0].role === 'assistant') turnos.shift();
    try {
      const opcoes = {
        modelTier: 'quick', cache: false, signal: ctl.signal,
        onText: ({ text }) => trocar({ de: 'abel', texto: text, links: [], acoes }),
      };
      if (comFerramentas && perfil === 'morador') {
        delete opcoes.cache;
        opcoes.tools = ferramentasAbel({ obterEstado, executar, agora: () => new Date(), aoAgir: (titulo, detalhe) => acoes.push({ titulo, detalhe }) });
      }
      const { text, truncated } = await sample([{ role: 'user', content: instrucoesAbel(obterEstado(), perfil, new Date()) }, ...turnos], opcoes);
      trocar({ de: 'abel', texto: text + (truncated ? '\n\n(Resposta cortada: peça em partes.)' : ''), links: [], acoes });
    } catch (e) {
      const code = e && e.code;
      if (code === 'cancelled') trocar({ de: 'abel', texto: (e.text || '') || 'Parado.', links: [], acoes });
      else if (SEM_IA_ABEL.includes(code) || code === 'tools_unavailable') {
        if (code === 'tools_unavailable') setComFerramentas(false); else setSample(null);
        const r = responderAbel(obterEstado(), perfil, p, new Date());
        trocar({ de: 'abel', ...r, texto: `${r.texto}\n\n(IA não liberada neste acesso: respondi pelo manual.)` });
      } else trocar({ de: 'abel', texto: `${e && e.text ? `${e.text}\n\n` : ''}${COPIA_ERRO_ABEL[code] || 'Deu um probleminha na conexão. Tente de novo.'}`, links: [], acoes });
    } finally {
      controle.current = null;
      setPensando(false);
    }
  }

  function perguntar(pergunta) {
    const p = pergunta.trim();
    if (!p || pensando) return;
    setTexto('');
    const base = [...mensagens, { de: 'eu', texto: p, links: [] }];
    if (comIAAgora) { perguntarIA(base, p); return; }
    guardar([...base, { de: 'abel', ...responderAbel(estado, perfil, p, agora) }]);
  }

  const sugestoes = (PERFIS_ABEL[perfil] || PERFIS_ABEL.morador).sugestoes;
  const modo = !comAbel ? null : comIAAgora ? 'IA ativa' : 'respostas pelo manual';

  return html`
    ${aberto && html`<section class="abel-painel" role="dialog" aria-label="Sr. Abel, assistente do CondoFácil">
      <header class="abel-topo">
        <img class="abel-avatar" src=${AVATAR_ABEL} alt="" />
        <div><strong>Sr. Abel</strong><small>${modo ? `Assistente do CondoFácil · ${modo}` : 'Assistente do CondoFácil'}</small></div>
        ${comAbel && html`<button type="button" class="abel-nova" disabled=${pensando} onClick=${() => guardar([])}>Nova conversa</button>`}
        <button type="button" class="abel-fechar" aria-label="Fechar o Sr. Abel" onClick=${() => setAberto(false)}>×</button>
      </header>
      ${comAbel
        ? html`<div class="abel-msgs" id="abel-msgs" aria-live="polite">
            ${mensagens.map((m, i) => html`<div key=${i} class=${`abel-msg abel-${m.de}${m.pensando ? ' abel-pensando' : ''}`}>
              <div class="abel-bolha"><${TextoAbel} texto=${m.texto} /></div>
              ${m.acoes && m.acoes.map((a, n) => html`<div key=${n} class="abel-acao"><strong>${a.titulo}</strong><span>${a.detalhe}</span></div>`)}
              ${m.links && m.links.length ? html`<div class="abel-links">${m.links.map((l) => html`<button type="button" key=${l.rotulo} class="btn-link" onClick=${() => ir(l.perfil, l.tela)}>${l.rotulo} →</button>`)}</div>` : null}
            </div>`)}
          </div>
          <div class="abel-sugestoes">${sugestoes.map((s) => html`<button type="button" key=${s} disabled=${pensando} onClick=${() => perguntar(s)}>${s}</button>`)}</div>
          <form class="abel-entrada" onSubmit=${(ev) => { ev.preventDefault(); perguntar(texto); }}>
            <label class="so-leitor" for="abel-caixa">Pergunte ao Sr. Abel</label>
            <input id="abel-caixa" type="text" autocomplete="off" placeholder="Pergunte ao Sr. Abel…" value=${texto} disabled=${pensando} onInput=${(ev) => setTexto(ev.target.value)} />
            ${pensando
              ? html`<button type="button" class="btn secundario" onClick=${() => controle.current && controle.current.abort()}>Parar</button>`
              : html`<button type="submit" class="btn primario" disabled=${!texto.trim()}>Enviar</button>`}
          </form>
          <small class="abel-aviso">${comIAAgora ? 'O Sr. Abel usa a IA do Claude e pode errar. Ações sempre pedem sua confirmação; decisões do condomínio são do síndico.' : comIA ? 'IA do plano Avançado: disponível quando o protótipo é aberto no Claude. Agora respondo pelo manual.' : 'Respostas pelo manual e pelos seus dados. A conversa com IA é do plano Avançado.'}</small>`
        : html`<${AvisoPlanoAbel} estado=${estado} />`}
    </section>`}
    <button type="button" class="abel-botao" aria-expanded=${aberto} aria-label=${aberto ? 'Fechar o Sr. Abel' : 'Falar com o Sr. Abel'} onClick=${() => setAberto(!aberto)}>
      <img src=${AVATAR_ABEL} alt="" /><span>${aberto ? 'Fechar' : 'Sr. Abel'}</span>
    </button>
  `;
}
