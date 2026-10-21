import { html, useState } from '../vendor.js';
import { liberado } from '../planos.js';
import { POSTOS, PORTEIROS, EMPRESAS, NOMES_VINCULO, NOMES_MOTIVO } from '../escala/dados.js';
import { buracos, feriadosDoMes, descansoInsuficiente, sugestoesCobertura, relatorioHoras, porteiroPorId, todosTurnos, acharTurno, instanteLocal, mesAtual, fmtTurno, nomeDoMesEscala } from '../escala/regras.js';
import { gerarEscala, publicarEscala, ajustarTurno, aprovarTroca, recusarTroca, atribuirCobertura } from '../escala/acoes.js';
import { isoDia, somarMes, diasDoMes, fmtDia, fmtDataCurta, fmtDataHora } from '../datas.js';
import { Campo, Erro, Sucesso, Vazio, Etiqueta } from './comum.js';
import { Bloqueado } from './financeiro-sindico.js';
import { SemanaEscala } from './escala-semana.js';

const ABAS_ESCALA = [['semana', 'Semana'], ['calendario', 'Calendário'], ['pendencias', 'Pendências'], ['equipe', 'Equipe'], ['horas', 'Horas']];

function horaCurta(local) {
  return `${Number(local.slice(11, 13))}h`;
}

function nomeOuDescoberto(t) {
  return t.porteiro ? porteiroPorId(t.porteiro).nome : `Descoberto · ${NOMES_MOTIVO[t.motivoDescoberto] || 'sem porteiro'}`;
}

export function SEscala(props) {
  const { estado, rota } = props;
  if (!liberado(estado.plano, 'escala')) {
    return html`<section><h1>Escala</h1><${Bloqueado} estado=${estado} recurso="escala" titulo="Escala de porteiros com trocas, faltas e cobertura" /></section>`;
  }
  const aba = ABAS_ESCALA.some(([id]) => id === rota.id) ? rota.id : 'semana';
  const Conteudo = { semana: ESemana, calendario: ECalendario, pendencias: EPendencias, equipe: EEquipe, horas: EHoras }[aba];
  return html`<section>
    <h1>Escala</h1>
    <p class="sub">Escala dos porteiros por posto. Trocas e faltas chegam aqui para aprovação; o sistema avisa (não bloqueia) quando o descanso entre turnos fica abaixo de 11 h.</p>
    <nav class="chips" aria-label="Escala">${ABAS_ESCALA.map(([id, nome]) => html`<a key=${id} class="chip" href=${`#sindico.escala.${id}`} aria-current=${aba === id ? 'page' : undefined}>${nome}</a>`)}</nav>
    <${Conteudo} ...${props} />
  </section>`;
}

function ESemana({ estado, executar, agora }) {
  return html`<${SemanaEscala} estado=${estado} executar=${executar} agora=${agora} editavel=${true} />`;
}

function ECalendario({ estado, executar, agora }) {
  const atual = mesAtual(agora);
  const meses = [atual, somarMes(atual, 1)];
  const [mes, setMes] = useState(atual);
  const [posto, setPosto] = useState('portaria');
  const [editando, setEditando] = useState(null);
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const m = estado.escala.meses[mes];
  const hoje = isoDia(agora);

  function rodar(acao, sucesso) {
    const r = executar(acao);
    setErro(r.erro || r.alerta || null);
    setMensagem(r.erro ? null : sucesso);
    return r;
  }

  const seletores = html`<div class="edicao-anuncio">
    <${Campo} rotulo="Mês"><select id="escala-mes" value=${mes} onChange=${(ev) => { setMes(ev.target.value); setEditando(null); }}>${meses.map((x) => html`<option key=${x} value=${x}>${nomeDoMesEscala(x)}</option>`)}</select><//>
    <${Campo} rotulo="Posto"><select id="escala-posto" value=${posto} onChange=${(ev) => { setPosto(ev.target.value); setEditando(null); }}>${Object.entries(POSTOS).map(([id, p]) => html`<option key=${id} value=${id}>${p.nome}</option>`)}</select><//>
  </div>`;

  if (!m) {
    return html`<div class="pilha">
      ${seletores}
      <p class="sub">A escala de ${nomeDoMesEscala(mes)} ainda não foi gerada. Ela é montada a partir dos modelos de turno de cada porteiro e já considera as férias.</p>
      <button type="button" class="btn primario" data-acao="gerar-escala" onClick=${() => rodar((e) => gerarEscala(e, mes, 'sindico'), `Escala de ${nomeDoMesEscala(mes)} gerada em rascunho.`)}>Gerar escala de ${nomeDoMesEscala(mes)}</button>
      <${Erro} texto=${erro} />
    </div>`;
  }

  const lista = buracos(estado, mes, posto);
  const descanso = descansoInsuficiente(estado, mes);
  const feriados = Object.fromEntries(feriadosDoMes(mes).map((f) => [f.dia, f.nome]));
  const turnos = m.turnos.filter((t) => t.posto === posto);
  const podeCobrir = PORTEIROS.filter((p) => p.postos.includes(posto));

  return html`<div class="pilha">
    ${seletores}
    <div class="linha-entre">
      <p class="sub">${lista.length} buracos de cobertura · ${descanso.length} alertas de descanso · ${m.situacao === 'publicada' ? `publicada em ${fmtDataCurta(m.publicadaEm.slice(0, 10))}` : 'rascunho'}</p>
      ${m.situacao === 'rascunho' && html`<button type="button" class="btn primario" data-acao="publicar-escala" onClick=${() => rodar((e) => publicarEscala(e, mes, 'sindico', new Date()), 'Escala publicada.')}>Publicar escala</button>`}
    </div>
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
    <div class="grade-escala">${diasDoMes(mes).map((dia) => html`<div key=${dia} class=${`dia-escala${dia === hoje ? ' hoje' : ''}`}>
      <span class="dia-escala-data">${fmtDia(dia)}${feriados[dia] ? html` <${Etiqueta} tipo="info">${feriados[dia]}<//>` : ''}${dia === hoje ? html` <${Etiqueta} tipo="alerta">hoje<//>` : ''}</span>
      <span class="dia-escala-turnos">
        ${turnos.filter((t) => t.inicio.startsWith(dia)).map((t) => html`<span key=${t.id} class=${`turno-escala${t.porteiro ? '' : ' descoberto'}`}>
          <button type="button" class="btn-link" data-turno=${t.id} onClick=${() => setEditando(editando === t.id ? null : t.id)}>${nomeOuDescoberto(t)}</button>
          <small>${horaCurta(t.inicio)}–${horaCurta(t.fim)}</small>${t.trocado ? html` <${Etiqueta}>troca<//>` : ''}
          ${editando === t.id && html`<select aria-label="Trocar porteiro" value=${t.porteiro || ''} onChange=${(ev) => { rodar((e) => ajustarTurno(e, t.id, ev.target.value || null, 'sindico'), 'Turno ajustado.'); setEditando(null); }}>
            <option value="">Ninguém (descoberto)</option>
            ${podeCobrir.map((p) => html`<option key=${p.id} value=${p.id}>${p.nome}</option>`)}
          </select>`}
        </span>`)}
        ${lista.filter((b) => b.inicio.startsWith(dia)).map((b) => html`<span key=${b.inicio} class="buraco-escala">${horaCurta(b.inicio)}–${horaCurta(b.fim)} sem ninguém</span>`)}
      </span>
    </div>`)}</div>
  </div>`;
}

function EPendencias({ estado, executar, agora }) {
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const atual = instanteLocal(agora);
  const trocas = estado.escala.trocas.filter((x) => x.situacao === 'aceita');
  const descobertos = todosTurnos(estado).filter((t) => !t.porteiro && t.fim > atual).sort((a, b) => a.inicio.localeCompare(b.inicio)).slice(0, 8);

  function rodar(acao, sucesso) {
    const r = executar(acao);
    setErro(r.erro || r.alerta || null);
    setMensagem(r.erro ? null : sucesso);
  }

  return html`<div class="pilha">
    <h2>Trocas aguardando aprovação</h2>
    ${trocas.length
      ? html`<ul class="m-lista">${trocas.map((x) => {
          const t = acharTurno(estado, x.turno);
          return html`<li key=${x.id} class="cartao">
            <strong>${porteiroPorId(x.de).nome} → ${porteiroPorId(x.para).nome}</strong>
            <small class="sub">${x.id} · ${POSTOS[t.posto].nome} · ${fmtTurno(t)} · o colega já aceitou</small>
            <div class="acoes">
              <button type="button" class="btn primario" data-aprovar=${x.id} onClick=${() => rodar((e) => aprovarTroca(e, x.id, 'sindico'), 'Troca aprovada.')}>Aprovar</button>
              <button type="button" class="btn secundario" onClick=${() => rodar((e) => recusarTroca(e, x.id, null, 'sindico'), 'Troca recusada.')}>Recusar</button>
            </div>
          </li>`;
        })}</ul>`
      : html`<${Vazio} texto="Nenhuma troca aguardando." />`}
    <h2>Turnos descobertos</h2>
    ${descobertos.length
      ? html`<ul class="m-lista">${descobertos.map((t) => html`<li key=${t.id} class="cartao">
          <strong>${POSTOS[t.posto].nome} · ${fmtTurno(t)}</strong>
          <small class="sub">${NOMES_MOTIVO[t.motivoDescoberto] || 'sem porteiro'}${t.porteiroOriginal ? ` de ${porteiroPorId(t.porteiroOriginal).nome}` : ''}${t.anexo ? ` · ${t.anexo}` : ''}</small>
          <ul class="itens-sacola">${sugestoesCobertura(estado, t.id).map((s) => {
            const p = porteiroPorId(s.porteiro);
            return html`<li key=${s.porteiro}>
              <span>${p.nome} · ${NOMES_VINCULO[p.vinculo]} · ${s.descanso === Infinity ? 'livre' : `${s.descanso} h de descanso`}${s.alerta11 ? ' · ⚠ menos de 11 h' : ''}</span>
              <button type="button" class="btn secundario" data-atribuir=${`${t.id}-${s.porteiro}`} onClick=${() => rodar((e) => atribuirCobertura(e, t.id, s.porteiro, 'sindico'), `${p.nome} cobre o turno.`)}>Atribuir</button>
            </li>`;
          })}</ul>
        </li>`)}</ul>`
      : html`<${Vazio} texto="Nenhum turno descoberto." />`}
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
  </div>`;
}

function EEquipe({ estado }) {
  return html`<div class="pilha">
    <h2>Postos</h2>
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Posto</th><th>Funcionamento</th></tr></thead>
      <tbody>${Object.entries(POSTOS).map(([id, p]) => html`<tr key=${id}><td>${p.nome}</td><td>${p.fecha - p.abre === 24 ? '24 h' : `${p.abre}h–${p.fecha}h`}</td></tr>`)}</tbody>
    </table></div>
    <h2>Porteiros</h2>
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Nome</th><th>Vínculo</th><th>Empresa</th><th>Telefone</th><th>Postos</th><th>Férias</th></tr></thead>
      <tbody>${PORTEIROS.map((p) => {
        const f = estado.escala.ferias.find((x) => x.porteiro === p.id);
        return html`<tr key=${p.id}>
          <td>${p.nome}</td>
          <td>${NOMES_VINCULO[p.vinculo]}</td>
          <td>${p.empresa ? `${p.empresa} · ${EMPRESAS[p.empresa].telefone}` : '—'}</td>
          <td>${p.telefone}</td>
          <td>${p.postos.map((x) => POSTOS[x].nome).join(', ')}</td>
          <td>${f ? `${fmtDataCurta(f.de).slice(0, 5)} a ${fmtDataCurta(f.ate).slice(0, 5)}` : '—'}</td>
        </tr>`;
      })}</tbody>
    </table></div>
  </div>`;
}

function EHoras({ estado, agora }) {
  if (!liberado(estado.plano, 'relatorioHoras')) return html`<${Bloqueado} estado=${estado} recurso="relatorioHoras" titulo="Relatório de horas, atrasos, faltas e trocas por porteiro" />`;
  const mes = mesAtual(agora);
  const linhas = relatorioHoras(estado, mes);
  return html`<div class="pilha">
    <h2>Horas de ${nomeDoMesEscala(mes)}</h2>
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Porteiro</th><th>Escaladas</th><th>Com check-in</th><th>Atrasos</th><th>Faltas</th><th>Trocas</th></tr></thead>
      <tbody>${linhas.map((l) => html`<tr key=${l.porteiro}><td>${porteiroPorId(l.porteiro).nome}</td><td>${l.escaladas} h</td><td>${l.comCheckin} h</td><td>${l.atrasos}</td><td>${l.faltas}</td><td>${l.trocas}</td></tr>`)}</tbody>
    </table></div>
    <small class="sub">O check-in confirma presença no posto; não substitui o ponto eletrônico legal. Exportação para Excel e PDF: em breve.</small>
  </div>`;
}
