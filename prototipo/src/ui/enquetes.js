import { html, useState } from '../vendor.js';
import { liberado } from '../planos.js';
import { NOMES_SITUACAO_ENQUETE, enquetePorId, situacaoEnquete, textoDiasRestantes, faltantes, apuracao, textoResultado, evolucao, proximoLembreteAuto, unidadesDoPublico } from '../enquetes/regras.js';
import { salvarEnquete, publicarEnquete, enviarLembrete, encerrarEnquete, prorrogarEnquete, publicarResultado } from '../enquetes/acoes.js';
import { isoDia, somarDias, fmtDataCurta, fmtDataHora } from '../datas.js';
import { ir, Campo, Erro, Sucesso, Vazio, Etiqueta } from './comum.js';
import { Bloqueado } from './financeiro-sindico.js';

// Enquetes do síndico: lista, formulário com prévia e painel de acompanhamento.
const ETQ_SITUACAO_ENQUETE = { rascunho: 'neutro', aberta: 'info', encerrada: 'ok' };

function pctTexto(v) {
  return `${Math.round(v)}%`;
}

export function EtqEnquete({ e, agora }) {
  const s = situacaoEnquete(e, agora);
  return html`<${Etiqueta} tipo=${ETQ_SITUACAO_ENQUETE[s]}>${NOMES_SITUACAO_ENQUETE[s]}<//>`;
}

export function BarrasOpcoes({ estado, e }) {
  const a = apuracao(estado, e);
  const ponderado = e.peso === 'fracao';
  const ordem = [...a.opcoes].sort((x, y) => (ponderado ? y.pesoPct - x.pesoPct : y.votos - x.votos));
  return html`<ul class="barras-enquete">${ordem.map((o) => html`<li key=${o.id}>
    <div class="linha-entre"><span>${o.texto}</span><strong>${ponderado ? pctTexto(o.pesoPct) : pctTexto(o.pct)}</strong></div>
    <span class="barra-enquete"><span style=${`width:${Math.max(1, ponderado ? o.pesoPct : o.pct)}%`}></span></span>
    <small class="sub">${o.votos} ${o.votos === 1 ? 'voto' : 'votos'}${ponderado ? ` · ${pctTexto(o.pct)} das unidades` : ''}</small>
  </li>`)}</ul>`;
}

export function SEnquetes(props) {
  const { estado, rota, agora } = props;
  if (rota.id === 'nova') return html`<${FormEnquete} ...${props} />`;
  const e = rota.id ? enquetePorId(estado, rota.id) : null;
  if (e && e.situacao === 'rascunho') return html`<${FormEnquete} key=${e.id} ...${props} rascunho=${e} />`;
  if (e) return html`<${PainelEnquete} key=${e.id} ...${props} e=${e} />`;
  const ordem = { aberta: 0, rascunho: 1, encerrada: 2 };
  const lista = [...estado.enquetes].sort((a, b) => ordem[situacaoEnquete(a, agora)] - ordem[situacaoEnquete(b, agora)] || (b.abertaEm || b.criadaEm).localeCompare(a.abertaEm || a.criadaEm));
  return html`<section class="pilha">
    <div class="linha-entre"><h1>Enquetes</h1><a class="btn primario" href="#sindico.enquetes.nova">Nova enquete</a></div>
    <p class="sub">Decisões simples sem assembleia: o morador responde pelo app e você acompanha a participação.</p>
    ${lista.length
      ? html`<div class="tabela-rolagem"><table class="tabela">
          <thead><tr><th>Pergunta</th><th>Situação</th><th>Participação</th><th>Prazo</th></tr></thead>
          <tbody>${lista.map((x) => {
            const s = situacaoEnquete(x, agora);
            const a = apuracao(estado, x);
            return html`<tr key=${x.id} class="clicavel" onClick=${() => ir('sindico', 'enquetes', x.id)}>
              <td><a href=${`#sindico.enquetes.${x.id}`}>${x.pergunta}</a><br /><small class="sub">${x.id}</small></td>
              <td><${EtqEnquete} e=${x} agora=${agora} /></td>
              <td>${s === 'rascunho' ? '—' : `${a.participantes} de ${a.total} (${pctTexto(a.participacaoPct)})`}</td>
              <td>${s === 'aberta' ? textoDiasRestantes(x, agora) : s === 'encerrada' ? textoResultado(estado, x) : 'Não publicada'}</td>
            </tr>`;
          })}</tbody>
        </table></div>`
      : html`<${Vazio} texto="Nenhuma enquete ainda." />`}
  </section>`;
}

function FormEnquete({ estado, executar, agora, rascunho }) {
  const completa = liberado(estado.plano, 'enqueteCompleta');
  const comPeso = liberado(estado.plano, 'enquetePeso');
  const inicial = rascunho
    ? { pergunta: rascunho.pergunta, contexto: rascunho.contexto, opcoes: rascunho.opcoes.map((o) => o.texto), dias: String(rascunho.dias || 7), publicoTipo: rascunho.publico.tipo, andar: rascunho.publico.tipo === 'andar' ? rascunho.publico.valor : '1', unidades: rascunho.publico.tipo === 'unidades' ? rascunho.publico.valor.join(', ') : '', tipo: rascunho.tipo, maxEscolhas: String(rascunho.maxEscolhas), comentarios: rascunho.comentarios, secreto: rascunho.secreto, parcialVisivel: rascunho.parcialVisivel, lembretesAuto: rascunho.lembretesAuto, peso: rascunho.peso, quorumPct: rascunho.quorumPct ? String(rascunho.quorumPct) : '' }
    : { pergunta: '', contexto: '', opcoes: ['', ''], dias: '7', publicoTipo: 'todos', andar: '1', unidades: '', tipo: 'unica', maxEscolhas: '2', comentarios: false, secreto: true, parcialVisivel: false, lembretesAuto: true, peso: 'unidade', quorumPct: '' };
  const [form, setForm] = useState(inicial);
  const [erro, setErro] = useState(null);
  const campo = (chave) => (ev) => setForm({ ...form, [chave]: ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value });
  const mudarOpcao = (n, valor) => setForm({ ...form, opcoes: form.opcoes.map((o, i) => (i === n ? valor : o)) });
  const mover = (n, passo) => {
    const lista = [...form.opcoes];
    [lista[n], lista[n + passo]] = [lista[n + passo], lista[n]];
    setForm({ ...form, opcoes: lista });
  };
  const publico = form.publicoTipo === 'andar' ? { tipo: 'andar', valor: form.andar } : form.publicoTipo === 'unidades' ? { tipo: 'unidades', valor: form.unidades.split(/[\s,;]+/).filter(Boolean) } : { tipo: 'todos' };
  const dados = { id: rascunho ? rascunho.id : null, pergunta: form.pergunta, contexto: form.contexto, opcoes: form.opcoes, dias: Number(form.dias), publico, tipo: form.tipo, maxEscolhas: Number(form.maxEscolhas), comentarios: form.comentarios, secreto: form.secreto, parcialVisivel: form.parcialVisivel, lembretesAuto: form.lembretesAuto, peso: form.peso, quorumPct: form.quorumPct };
  const dataLimite = Number(form.dias) >= 1 ? fmtDataCurta(somarDias(isoDia(agora), Number(form.dias))) : '—';
  const preenchidas = form.opcoes.filter((o) => o.trim());

  function salvar(publicar) {
    const r = executar((e) => {
      const s = salvarEnquete(e, dados, 'sindico', new Date());
      return s.erro || !publicar ? s : { ...publicarEnquete(s.estado, s.id, 'sindico', new Date()), id: s.id };
    });
    setErro(r.erro || null);
    if (!r.erro) ir('sindico', 'enquetes', publicar ? r.id : '');
  }

  return html`<section class="pilha">
    <a class="voltar" href="#sindico.enquetes">‹ Enquetes</a>
    <h1>${rascunho ? `Rascunho ${rascunho.id}` : 'Nova enquete'}</h1>
    <div class="grade-enquete">
      <div class="pilha formulario">
        <${Campo} rotulo="Pergunta"><input id="enquete-pergunta" value=${form.pergunta} onInput=${campo('pergunta')} placeholder="Ex.: Qual horário a academia deve abrir aos domingos?" /><//>
        <${Campo} rotulo="Contexto" dica="Opcional. Explique o motivo da enquete."><textarea id="enquete-contexto" rows="2" value=${form.contexto} onInput=${campo('contexto')}></textarea><//>
        <fieldset><legend>Respostas</legend>
          ${form.opcoes.map((o, n) => html`<div key=${n} class="opcao-enquete">
            <input aria-label=${`Opção ${n + 1}`} value=${o} onInput=${(ev) => mudarOpcao(n, ev.target.value)} placeholder=${`Opção ${n + 1}`} />
            <button type="button" class="btn-link" aria-label="Subir" disabled=${n === 0} onClick=${() => mover(n, -1)}>↑</button>
            <button type="button" class="btn-link" aria-label="Descer" disabled=${n === form.opcoes.length - 1} onClick=${() => mover(n, 1)}>↓</button>
            ${form.opcoes.length > 2 && html`<button type="button" class="btn-link" onClick=${() => setForm({ ...form, opcoes: form.opcoes.filter((_, i) => i !== n) })}>Remover</button>`}
          </div>`)}
          ${form.opcoes.length < 8 && html`<button type="button" class="btn secundario" data-acao="adicionar-opcao" onClick=${() => setForm({ ...form, opcoes: [...form.opcoes, ''] })}>Adicionar opção</button>`}
        </fieldset>
        <div class="edicao-anuncio">
          <${Campo} rotulo="Prazo (dias)" dica=${`Encerra em ${dataLimite}, às 23h59`}><input id="enquete-dias" type="number" min="1" max="60" value=${form.dias} onInput=${campo('dias')} /><//>
          <${Campo} rotulo="Público"><select id="enquete-publico" value=${form.publicoTipo} onChange=${campo('publicoTipo')}><option value="todos">Todos os moradores</option><option value="andar">Um andar</option><option value="unidades">Unidades escolhidas</option></select><//>
          ${form.publicoTipo === 'andar' && html`<${Campo} rotulo="Andar"><select id="enquete-andar" value=${form.andar} onChange=${campo('andar')}>${['1', '2', '3', '4', '5', '6', '7', '8'].map((a) => html`<option key=${a} value=${a}>${a}º andar</option>`)}</select><//>`}
          ${form.publicoTipo === 'unidades' && html`<${Campo} rotulo="Unidades" dica="Separe por vírgula"><input id="enquete-unidades" value=${form.unidades} onInput=${campo('unidades')} placeholder="Ex.: 301, 302" /><//>`}
        </div>
        ${completa
          ? html`<div class="edicao-anuncio">
              <${Campo} rotulo="Tipo de resposta"><select id="enquete-tipo" value=${form.tipo} onChange=${campo('tipo')}><option value="unica">Escolha única</option><option value="multipla">Múltipla escolha</option></select><//>
              ${form.tipo === 'multipla' && html`<${Campo} rotulo="Até quantas opções"><input id="enquete-max" type="number" min="2" max=${Math.max(2, preenchidas.length)} value=${form.maxEscolhas} onInput=${campo('maxEscolhas')} /><//>`}
            </div>
            <label class="check"><input id="enquete-comentarios" type="checkbox" checked=${form.comentarios} onChange=${campo('comentarios')} /><span>Permitir comentário junto com o voto</span></label>
            <label class="check"><input id="enquete-secreto" type="checkbox" checked=${form.secreto} onChange=${campo('secreto')} /><span>Voto secreto (você vê só os totais e quem já respondeu)</span></label>
            <label class="check"><input id="enquete-parcial" type="checkbox" checked=${form.parcialVisivel} onChange=${campo('parcialVisivel')} /><span>Mostrar a parcial aos moradores durante a votação</span></label>
            <label class="check"><input id="enquete-lembretes" type="checkbox" checked=${form.lembretesAuto} onChange=${campo('lembretesAuto')} /><span>Lembretes automáticos 3 dias antes e no último dia</span></label>`
          : html`<${Bloqueado} estado=${estado} recurso="enqueteCompleta" titulo="Múltipla escolha, comentário, voto aberto, lembretes automáticos e resultado publicado" />`}
        ${comPeso
          ? html`<div class="edicao-anuncio">
              <${Campo} rotulo="Peso do voto"><select id="enquete-peso" value=${form.peso} onChange=${campo('peso')}><option value="unidade">1 voto por unidade</option><option value="fracao">Peso por fração ideal</option></select><//>
              <${Campo} rotulo="Quórum mínimo (%)" dica="Opcional. Abaixo dele, o resultado sai como Sem quórum."><input id="enquete-quorum" inputmode="numeric" value=${form.quorumPct} onInput=${campo('quorumPct')} placeholder="Ex.: 50" /><//>
            </div>`
          : html`<${Bloqueado} estado=${estado} recurso="enquetePeso" titulo="Peso por fração ideal e quórum mínimo" />`}
        <${Erro} texto=${erro} />
        <div class="acoes">
          <button type="button" class="btn primario" data-acao="publicar-enquete" onClick=${() => salvar(true)}>Publicar enquete</button>
          <button type="button" class="btn secundario" data-acao="salvar-rascunho" onClick=${() => salvar(false)}>Salvar rascunho</button>
        </div>
      </div>
      <aside class="cartao pilha previa-enquete" aria-label="Prévia para o morador">
        <small class="sub">Prévia: como o morador vê</small>
        <strong>${form.pergunta || 'Sua pergunta aparece aqui'}</strong>
        ${form.contexto && html`<span class="sub">${form.contexto}</span>`}
        ${(preenchidas.length ? preenchidas : ['Opção 1', 'Opção 2']).map((o, n) => html`<label key=${n} class="check"><input type=${completa && form.tipo === 'multipla' ? 'checkbox' : 'radio'} disabled /><span>${o}</span></label>`)}
        ${completa && form.tipo === 'multipla' && html`<small class="sub">Escolha até ${form.maxEscolhas} opções</small>`}
        <small class="sub">Responda até ${dataLimite}, 23h59${completa && !form.secreto ? ' · voto aberto ao síndico' : ' · voto secreto'}</small>
      </aside>
    </div>
  </section>`;
}

// Uma série (respostas acumuladas): título com a conclusão, quórum tracejado, rótulo no último ponto e tabela equivalente.
function GraficoEvolucao({ estado, e, agora }) {
  const pontos = evolucao(e, agora);
  const total = unidadesDoPublico(estado, e).length;
  if (pontos.length < 1) return null;
  const L = 900;
  const A = 200;
  const m = { esq: 36, dir: 16, topo: 12, base: 24 };
  const x = (i) => m.esq + (pontos.length === 1 ? 0 : (i / (pontos.length - 1)) * (L - m.esq - m.dir));
  const y = (v) => m.topo + (1 - v / total) * (A - m.topo - m.base);
  const quorum = e.quorumPct ? Math.ceil((e.quorumPct / 100) * total) : null;
  const ultimo = pontos.at(-1);
  return html`<div class="grafico-evolucao">
    <svg viewBox=${`0 0 ${L} ${A}`} role="img" aria-label=${`Respostas acumuladas: ${ultimo.total} de ${total}`}>
      ${[0, 0.5, 1].map((f) => html`<g key=${f}><line class="grade" x1=${m.esq} x2=${L - m.dir} y1=${y(total * f)} y2=${y(total * f)} /><text class="eixo" x=${m.esq - 6} y=${y(total * f) + 4} text-anchor="end">${Math.round(total * f)}</text></g>`)}
      ${quorum && html`<g><line class="reserva" x1=${m.esq} x2=${L - m.dir} y1=${y(quorum)} y2=${y(quorum)} /><text class="rotulo-reserva" x=${m.esq + 4} y=${y(quorum) - 5}>Quórum ${quorum} unidades</text></g>`}
      <path class="linha-saldo" d=${pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(' ')} />
      ${pontos.map((p, i) => html`<circle key=${p.dia} class="ponto-foco" cx=${x(i)} cy=${y(p.total)} r="4"><title>${fmtDataCurta(p.dia)}: ${p.total} respostas</title></circle>`)}
      <text class="rotulo-minimo" x=${x(pontos.length - 1)} y=${y(ultimo.total) - 10} text-anchor="end">${ultimo.total} respostas</text>
      ${[pontos[0], ultimo].filter((p, i, l) => l.indexOf(p) === i).map((p) => html`<text key=${`x-${p.dia}`} class="eixo" x=${x(pontos.indexOf(p))} y=${A - 6} text-anchor=${p === pontos[0] ? 'start' : 'end'}>${fmtDataCurta(p.dia).slice(0, 5)}</text>`)}
    </svg>
    <table class="so-leitor"><caption>Respostas acumuladas por dia</caption><tbody>${pontos.map((p) => html`<tr key=${p.dia}><td>${fmtDataCurta(p.dia)}</td><td>${p.total}</td></tr>`)}</tbody></table>
  </div>`;
}

function PainelEnquete({ estado, executar, agora, e }) {
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [dias, setDias] = useState('3');
  const completa = liberado(estado.plano, 'enqueteCompleta');
  const s = situacaoEnquete(e, agora);
  const a = apuracao(estado, e);
  const lista = faltantes(estado, e);
  const proximo = proximoLembreteAuto(e, agora);
  const comentarios = Object.entries(e.votos).filter(([, v]) => v.comentario);
  const rodar = (acao, sucesso) => { const r = executar(acao); setErro(r.erro || null); setMensagem(r.erro ? null : sucesso); return r; };
  const nomeOpcao = (id) => (e.opcoes.find((o) => o.id === id) || { texto: id }).texto;
  return html`<section class="pilha">
    <a class="voltar" href="#sindico.enquetes">‹ Enquetes</a>
    <div class="linha-entre"><h1>${e.pergunta}</h1><${EtqEnquete} e=${e} agora=${agora} /></div>
    <p class="sub">${e.id} · ${e.tipo === 'multipla' ? `múltipla escolha (até ${e.maxEscolhas})` : 'escolha única'} · ${e.secreto ? 'voto secreto' : 'voto aberto'}${e.peso === 'fracao' ? ' · peso por fração ideal' : ''}${e.quorumPct ? ` · quórum de ${e.quorumPct}%` : ''}</p>
    ${e.contexto && html`<p class="texto-longo">${e.contexto}</p>`}
    <div class="indicadores">
      <div class="indicador ind-info"><span class="ind-rotulo">Participação</span><strong>${a.participantes} de ${a.total}</strong><small>${pctTexto(a.participacaoPct)} das unidades</small></div>
      <div class=${`indicador ${s === 'aberta' && textoDiasRestantes(e, agora) === 'termina hoje' ? 'ind-alerta' : 'ind-info'}`}><span class="ind-rotulo">Prazo</span><strong>${s === 'aberta' ? textoDiasRestantes(e, agora) : 'encerrada'}</strong><small>${fmtDataHora(e.encerraEm)}${e.prorrogada ? ' · prorrogada' : ''}</small></div>
      ${e.quorumPct && html`<div class=${`indicador ${a.quorumAtingido ? 'ind-ok' : 'ind-alerta'}`}><span class="ind-rotulo">Quórum de ${e.quorumPct}%</span><strong>${a.quorumAtingido ? 'Atingido' : `Faltam ${Math.ceil((e.quorumPct / 100) * a.total) - a.participantes}`}</strong><small>${a.quorumAtingido ? 'O resultado vale' : 'unidades para valer'}</small></div>`}
    </div>
    <div class="barra" role="progressbar" aria-label="Participação" aria-valuenow=${Math.round(a.participacaoPct)} aria-valuemin="0" aria-valuemax="100"><span style=${`width:${a.participacaoPct}%`}></span></div>
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
    ${s === 'aberta' && html`<div class="cartao pilha">
      <strong>Lembretes</strong>
      <div class="acoes">
        <button type="button" class="btn primario" data-acao="enviar-lembrete" onClick=${() => rodar((x) => enviarLembrete(x, e.id, 'sindico', new Date()), `Lembrete enviado a ${lista.length} unidades.`)}>Enviar lembrete agora</button>
        ${completa && proximo && html`<button type="button" class="btn secundario" data-acao="lembrete-automatico" onClick=${() => rodar((x) => enviarLembrete(x, e.id, 'sindico', new Date(), true), 'Lembrete automático enviado.')}>Simular lembrete automático</button>`}
      </div>
      <small class="sub">${completa ? (proximo ? `Próximo lembrete automático em ${fmtDataHora(proximo)}` : e.lembretesAuto ? 'Lembretes automáticos já enviados' : 'Lembretes automáticos desligados') : 'Lembretes automáticos: plano Intermediário'}</small>
      ${e.lembretes.length > 0 && html`<ul class="auditoria">${e.lembretes.map((l, n) => html`<li key=${n}><span class="lt-quando">${fmtDataHora(l.em)}</span> ${l.automatico ? 'Automático' : 'Manual'} · ${l.unidades} unidades</li>`)}</ul>`}
    </div>`}
    <h2>Evolução das respostas</h2>
    <${GraficoEvolucao} estado=${estado} e=${e} agora=${agora} />
    <h2>${s === 'encerrada' ? `Resultado · ${textoResultado(estado, e)}` : 'Votos por opção'}</h2>
    <${BarrasOpcoes} estado=${estado} e=${e} />
    ${!e.secreto && Object.keys(e.votos).length > 0 && html`<details class="composicao"><summary>Voto de cada unidade (voto aberto)</summary>
      <div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Unidade</th><th>Resposta</th><th>Quando</th></tr></thead>
        <tbody>${Object.entries(e.votos).sort(([x], [y]) => x.localeCompare(y)).map(([u, v]) => html`<tr key=${u}><td>${u}</td><td>${v.opcoes.map(nomeOpcao).join(', ')}</td><td>${fmtDataHora(v.em)}</td></tr>`)}</tbody></table></div>
    </details>`}
    ${comentarios.length > 0 && html`<h2>Comentários</h2><ul class="m-lista">${comentarios.map(([u, v]) => html`<li key=${u} class="cartao"><span>${v.comentario}</span><small class="sub">${e.secreto ? 'Comentário anônimo' : `Apto ${u}`}</small></li>`)}</ul>`}
    ${s === 'aberta' && html`<h2>Quem ainda não respondeu (${lista.length})</h2>
      <div class="faltantes-enquete">${lista.map((f) => html`<span key=${f.unidade} class="etq-turno t-folga">${f.unidade}${f.semApp ? ' · sem app' : ''}</span>`)}</div>
      <small class="sub">Unidades sem app recebem o lembrete por e-mail e WhatsApp.</small>`}
    <div class="acoes">
      ${s === 'aberta' && !e.prorrogada && html`<span class="acoes"><input aria-label="Dias de prorrogação" type="number" min="1" max="30" value=${dias} onInput=${(ev) => setDias(ev.target.value)} class="campo-curto" /><button type="button" class="btn secundario" data-acao="prorrogar" onClick=${() => rodar((x) => prorrogarEnquete(x, e.id, Number(dias), 'sindico', new Date()), 'Prazo prorrogado. Os moradores foram avisados.')}>Prorrogar</button></span>`}
      ${s === 'aberta' && (confirmando
        ? html`<button type="button" class="btn primario" data-acao="confirmar-encerrar" onClick=${() => { setConfirmando(false); rodar((x) => encerrarEnquete(x, e.id, 'sindico', new Date()), 'Enquete encerrada.'); }}>Confirmar encerramento</button><button type="button" class="btn-link" onClick=${() => setConfirmando(false)}>Voltar</button>`
        : html`<button type="button" class="btn secundario" data-acao="encerrar-enquete" onClick=${() => setConfirmando(true)}>Encerrar agora</button>`)}
      ${s === 'encerrada' && !e.resultado && (completa
        ? html`<button type="button" class="btn primario" data-acao="publicar-resultado" onClick=${() => rodar((x) => publicarResultado(x, e.id, 'sindico', new Date()), 'Resultado publicado no mural e em Documentos › Enquetes.')}>Publicar resultado</button>`
        : html`<${Bloqueado} estado=${estado} recurso="enqueteCompleta" titulo="Publicar o resultado no mural e em Documentos" />`)}
      ${e.resultado && html`<${Etiqueta} tipo="ok">Resultado publicado em ${fmtDataCurta(isoDia(new Date(e.resultado.publicadoEm)))}<//>`}
    </div>
  </section>`;
}
