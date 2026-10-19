import { html } from '../vendor.js';
import { NOMES_STATUS, NOMES_STATUS_RESERVA } from '../dados.js';
import { diasDoMes, deIso, nomeMes, fmtDia, fmtDataHora, fmtDataCurta } from '../datas.js';

export const PERFIS = [
  { id: 'sindico', nome: 'Síndico', inicial: 'inicio' },
  { id: 'morador', nome: 'Morador', inicial: 'inicio' },
  { id: 'portaria', nome: 'Portaria', inicial: 'registrar' },
  { id: 'zelador', nome: 'Zelador', inicial: 'os' },
];

// Rotas no formato #perfil.tela.id: o link compartilhado de um Artifact só repassa âncoras com letras, dígitos, ".", "_", "~" e "-".
export function lerRota() {
  const [perfil, tela, id] = location.hash.replace(/^#/, '').split('.');
  const p = PERFIS.find((x) => x.id === perfil);
  if (!p) return { perfil: PERFIS[0].id, tela: PERFIS[0].inicial, id: null };
  return { perfil: p.id, tela: tela || p.inicial, id: id ? decodeURIComponent(id) : null };
}

export function ir(perfil, tela, id) {
  location.hash = `#${perfil}.${tela}${id ? `.${id}` : ''}`;
}

export function fmtMoeda(valor) {
  return `R$ ${valor.toFixed(2).replace('.', ',')}`;
}

const ETQ_RESERVA = { pendente: 'alerta', confirmada: 'ok', recusada: 'perigo', cancelada: 'neutro' };
const ETQ_OCORRENCIA = { aberta: 'info', em_analise: 'alerta', em_andamento: 'alerta', resolvida: 'ok', fechada: 'neutro' };
const ROTULO_DIA = { livre: 'Livre', pendente: 'Pendente', reservado: 'Reservado', bloqueado: 'Bloqueado', indisponivel: 'Fora do prazo' };

export function Etiqueta({ tipo = 'neutro', children }) {
  return html`<span class=${`etq etq-${tipo}`}>${children}</span>`;
}

export function EtqReserva({ status }) {
  return html`<${Etiqueta} tipo=${ETQ_RESERVA[status]}>${NOMES_STATUS_RESERVA[status]}<//>`;
}

export function EtqOcorrencia({ status, arquivada }) {
  if (arquivada) return html`<${Etiqueta}>Arquivada<//>`;
  return html`<${Etiqueta} tipo=${ETQ_OCORRENCIA[status]}>${NOMES_STATUS[status]}<//>`;
}

export function Erro({ texto }) {
  return texto ? html`<p class="erro" role="alert">${texto}</p>` : null;
}

export function Sucesso({ texto }) {
  return texto ? html`<p class="sucesso" role="status">${texto}</p>` : null;
}

export function Vazio({ texto }) {
  return html`<p class="vazio">${texto}</p>`;
}

// Ícones de linha (24×24, traço), no estilo dos ícones de serviço do modelo de referência.
const ICONES = {
  predio: 'M4 21V5l8-3 8 3v16M2 21h20M9 21v-4h6v4M8 8h2M14 8h2M8 12h2M14 12h2',
  casa: 'M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6',
  calendario: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  megafone: 'M3 10v4h4l7 4V6l-7 4zM17 9a4 4 0 0 1 0 6',
  prancheta: 'M9 3h6v3H9zM7 5H5v16h14V5h-2M8 11h8M8 15h5',
  menu: 'M4 7h16M4 12h16M4 17h16',
  pacote: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
  documento: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  clipe: 'M16 7l-7 7a2 2 0 0 0 3 3l7-7a4 4 0 0 0-6-6l-7 7a6 6 0 0 0 8 8l5-5',
  alfinete: 'M9 3h6l-1 6 3 3H7l3-3zM12 12v9',
  grafico: 'M4 20V10M10 20V4M16 20v-7M3 20h18',
  leitor: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M8 12h8',
  entrega: 'M4 12l5 5L20 6',
  sacola: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2',
  loja: 'M4 9l1-5h14l1 5M4 9v11h16V9M4 9h16M9 20v-6h6v6',
  etiqueta: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01',
  pessoa: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  ferramenta: 'M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.6 2.6-2.4-.6-.6-2.4z',
  cifrao: 'M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6',
};

export function Icone({ nome, tamanho = 22 }) {
  return html`<svg class="icone" width=${tamanho} height=${tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${ICONES[nome]} /></svg>`;
}

export function QuadroIcone({ nome, cheio = false }) {
  return html`<span class=${`quadro-icone${cheio ? ' cheio' : ''}`}><${Icone} nome=${nome} /></span>`;
}

export function FotoFalsa({ rotulo = 'Foto' }) {
  return html`<div class="foto-falsa" role="img" aria-label=${rotulo}><${Icone} nome="camera" tamanho=${28} />${rotulo}</div>`;
}

export function Campo({ rotulo, dica, children }) {
  return html`<label class="campo"><span>${rotulo}</span>${children}${dica && html`<small>${dica}</small>`}</label>`;
}

export function Calendario({ anoMes, statusDe, selecionado, aoEscolher, aoMudarMes }) {
  const dias = diasDoMes(anoMes);
  const vazios = deIso(dias[0]).getDay();
  return html`<div class="calendario">
    <div class="cal-topo">
      <button type="button" class="btn-icone" aria-label="Mês anterior" onClick=${() => aoMudarMes(-1)}>‹</button>
      <strong>${nomeMes(anoMes)}</strong>
      <button type="button" class="btn-icone" aria-label="Próximo mês" onClick=${() => aoMudarMes(1)}>›</button>
    </div>
    <div class="cal-grade">
      ${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => html`<span class="cal-sem" key=${`s${i}`} aria-hidden="true">${d}</span>`)}
      ${Array.from({ length: vazios }, (_, i) => html`<span key=${`v${i}`}></span>`)}
      ${dias.map((iso) => {
        const st = statusDe(iso);
        return html`<button type="button" key=${iso} data-dia=${iso} class=${`cal-dia st-${st}${iso === selecionado ? ' sel' : ''}`} disabled=${st === 'indisponivel'} aria-pressed=${iso === selecionado} aria-label=${`${fmtDia(iso)}: ${ROTULO_DIA[st]}`} onClick=${() => aoEscolher(iso)}>${Number(iso.slice(8))}</button>`;
      })}
    </div>
    <div class="cal-legenda">${['livre', 'pendente', 'reservado', 'bloqueado'].map((s) => html`<span key=${s} class=${`leg st-${s}`}>${ROTULO_DIA[s]}</span>`)}</div>
  </div>`;
}

export function QrFalso({ texto, tamanho = 132 }) {
  // Desenho determinístico com cara de QR Code; não é um QR legível.
  let semente = [...texto].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const sortear = () => {
    semente = (semente * 1103515245 + 12345) >>> 0;
    return semente / 4294967296;
  };
  const quadrados = [];
  for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 21; x++) {
      const zona = (x < 8 || x > 12) && (y < 8 || y > 12) && !(x > 12 && y > 12);
      let escuro;
      if (zona) {
        const lx = x < 8 ? x : 20 - x;
        const ly = y < 8 ? y : 20 - y;
        escuro = lx !== 7 && ly !== 7 && (lx === 0 || lx === 6 || ly === 0 || ly === 6 || (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4));
      } else {
        escuro = sortear() < 0.5;
      }
      if (escuro) quadrados.push(html`<rect key=${`${x}-${y}`} x=${x} y=${y} width="1" height="1" />`);
    }
  }
  return html`<svg class="qr" viewBox="-2 -2 25 25" width=${tamanho} height=${tamanho} role="img" aria-label=${`QR Code de retirada ${texto}`}>
    <rect x="-2" y="-2" width="25" height="25" fill="#fff" />
    <g fill="#111">${quadrados}</g>
  </svg>`;
}

export function LinhaTempo({ linha, nomes = NOMES_STATUS }) {
  return html`<ol class="linha-tempo">${linha.map((p, i) => html`<li key=${i} class=${p.status ? 'marco' : 'comentario'}>
    <span class="lt-quando">${fmtDataHora(p.em)}</span>
    <strong>${p.status ? nomes[p.status] : 'Comentário'}</strong>
    <span>${p.texto}${p.autor ? ` · ${p.autor}` : ''}</span>
  </li>`)}</ol>`;
}

export function Estrelas({ valor = 0, aoEscolher }) {
  if (!aoEscolher) {
    return html`<div class="estrelas" role="img" aria-label=${`${valor} de 5 estrelas`}>${[1, 2, 3, 4, 5].map((n) => html`<span key=${n} class=${n <= valor ? 'cheia' : ''} aria-hidden="true">★</span>`)}</div>`;
  }
  return html`<div class="estrelas" role="radiogroup" aria-label="Avaliação">${[1, 2, 3, 4, 5].map((n) => html`<button type="button" key=${n} data-estrela=${n} role="radio" aria-checked=${n === valor} aria-label=${n === 1 ? '1 estrela' : `${n} estrelas`} class=${n <= valor ? 'cheia' : ''} onClick=${() => aoEscolher(n)}>★</button>`)}</div>`;
}

export function Selo({ canal, para, texto }) {
  return html`<div class="selo" role="status" aria-live="polite">
    <span class="selo-canal">${canal}</span>
    <div><strong>→ ${para}</strong><p>${texto}</p></div>
  </div>`;
}

export function PrevDoc({ documento, aoFechar }) {
  const atual = documento.versoes[documento.versoes.length - 1];
  return html`<div class="prev-doc" role="dialog" aria-label=${documento.titulo}>
    <div class="prev-topo"><strong>${documento.titulo}</strong><button type="button" class="btn secundario" onClick=${aoFechar}>Fechar</button></div>
    <div class="prev-pagina">
      <p class="prev-cabecalho">Residencial Ipê Amarelo · ${documento.pasta} · versão ${atual.versao} de ${fmtDataCurta(atual.data)}</p>
      <h3>${documento.titulo}</h3>
      ${[1, 2, 3, 4, 5, 6, 7].map((i) => html`<span key=${i} class="prev-linha" style=${`width:${70 + ((i * 37) % 30)}%`}></span>`)}
      <p class="prev-aviso">Prévia simulada do PDF para o protótipo.</p>
    </div>
  </div>`;
}
