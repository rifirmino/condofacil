import { html, useState } from '../vendor.js';
import { POSTOS } from '../escala/dados.js';
import { NOMES_CELULA, inicioDaSemana, semanaDaEscala, semanasComEscala, feriadosDoMes, porteiroPorId, porteirosDe, acharTurno } from '../escala/regras.js';
import { ajustarTurno } from '../escala/acoes.js';
import { isoDia, fmtDataCurta } from '../datas.js';
import { Erro, Sucesso } from './comum.js';

// Grade porteiro × dia da semana: o síndico ajusta o turno clicando na etiqueta; a portaria só consulta.
const DIAS_SEMANA_CURTOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const LEGENDA_TURNOS = [['dia', '7h–19h'], ['noite', '19h–7h'], ['manha', '7h–15h'], ['tarde', '15h–23h'], ['folga', ''], ['ferias', ''], ['falta', ''], ['atestado', '']];
const NOMES_POSTO_CURTO = { portaria: 'Portaria', guarita: 'Guarita' };

function horaDoLocal(local) {
  return `${Number(local.slice(11, 13))}h`;
}

function EtqTurno({ item, mostrarPosto, editavel, aoClicar }) {
  const rotulo = html`${NOMES_CELULA[item.tipo]}${item.trocado ? ' ↔' : ''}`;
  const posto = mostrarPosto && item.posto && html`<small class="etq-posto">${NOMES_POSTO_CURTO[item.posto]}</small>`;
  const titulo = item.trocado ? 'Turno assumido por troca' : undefined;
  return html`<span class="celula-turno">
    ${editavel && item.turno
      ? html`<button type="button" class=${`etq-turno t-${item.tipo}`} data-semana-turno=${item.turno} title=${titulo} onClick=${aoClicar}>${rotulo}</button>`
      : html`<span class=${`etq-turno t-${item.tipo}`} title=${titulo}>${rotulo}</span>`}
    ${posto}
  </span>`;
}

export function SemanaEscala({ estado, agora, executar, editavel = false }) {
  const hoje = isoDia(agora);
  const semanas = semanasComEscala(estado);
  const [segunda, setSegunda] = useState(inicioDaSemana(hoje));
  const [editando, setEditando] = useState(null);
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const s = semanaDaEscala(estado, segunda);
  const pos = semanas.indexOf(segunda);
  const feriados = Object.fromEntries([...new Set(s.dias.map((d) => d.slice(0, 7)))].flatMap((m) => feriadosDoMes(m)).map((f) => [f.dia, f.nome]));
  const turnoEditado = editando && acharTurno(estado, editando);

  function irSemana(passo) {
    const alvo = semanas[pos + passo];
    if (alvo) { setSegunda(alvo); setEditando(null); }
  }

  function trocar(porteiro) {
    const r = executar((e) => ajustarTurno(e, editando, porteiro || null, 'sindico'));
    setErro(r.erro || r.alerta || null);
    setMensagem(r.erro ? null : 'Turno ajustado.');
    setEditando(null);
  }

  return html`<div class="pilha">
    <div class="linha-entre">
      <strong>Semana de ${fmtDataCurta(s.dias[0])} a ${fmtDataCurta(s.dias[6])}</strong>
      <span class="acoes">
        <button type="button" class="btn secundario" aria-label="Semana anterior" data-acao="semana-anterior" disabled=${pos <= 0} onClick=${() => irSemana(-1)}>‹</button>
        <button type="button" class="btn secundario" data-acao="semana-hoje" onClick=${() => { setSegunda(inicioDaSemana(hoje)); setEditando(null); }}>Hoje</button>
        <button type="button" class="btn secundario" aria-label="Próxima semana" data-acao="semana-proxima" disabled=${pos < 0 || pos >= semanas.length - 1} onClick=${() => irSemana(1)}>›</button>
      </span>
    </div>
    <ul class="legenda-turnos" aria-label="Legenda">${LEGENDA_TURNOS.map(([tipo, horas]) => html`<li key=${tipo}><span class=${`etq-turno t-${tipo}`}>${NOMES_CELULA[tipo]}</span>${horas && html`<small>${horas}</small>`}</li>`)}</ul>
    <${Erro} texto=${erro} />
    <${Sucesso} texto=${mensagem} />
    ${turnoEditado && html`<div class="cartao pilha">
      <strong>${POSTOS[turnoEditado.posto].nome} · ${fmtDataCurta(turnoEditado.inicio.slice(0, 10))} · ${horaDoLocal(turnoEditado.inicio)}–${horaDoLocal(turnoEditado.fim)}</strong>
      <label class="campo"><span>Porteiro do turno</span><select id="semana-porteiro" value=${turnoEditado.porteiro || ''} onChange=${(ev) => trocar(ev.target.value)}>
        <option value="">Ninguém (descoberto)</option>
        ${porteirosDe(estado).filter((p) => p.postos.includes(turnoEditado.posto)).map((p) => html`<option key=${p.id} value=${p.id}>${p.nome}</option>`)}
      </select></label>
      <div class="acoes"><button type="button" class="btn secundario" onClick=${() => setEditando(null)}>Fechar</button></div>
    </div>`}
    <div class="semana-rolagem"><table class="semana-escala">
      <thead><tr><th scope="col">Porteiro</th>${s.dias.map((d, i) => html`<th key=${d} scope="col" class=${d === hoje ? 'hoje' : ''}>${DIAS_SEMANA_CURTOS[i]}<small>${d.slice(8, 10)}/${d.slice(5, 7)}${feriados[d] ? ' · feriado' : ''}</small></th>`)}</tr></thead>
      <tbody>
        ${s.linhas.map((l) => {
          const p = porteiroPorId(estado, l.porteiro);
          return html`<tr key=${l.porteiro}>
            <th scope="row">${p.nome}</th>
            ${l.celulas.map((c, i) => html`<td key=${s.dias[i]} class=${s.dias[i] === hoje ? 'hoje' : ''}>${c.map((item, n) => html`<${EtqTurno} key=${n} item=${item} mostrarPosto=${p.postos.length > 1} editavel=${editavel} aoClicar=${() => { setEditando(item.turno); setErro(null); setMensagem(null); }} />`)}</td>`)}
          </tr>`;
        })}
        <tr class="linha-descoberta">
          <th scope="row">Sem ninguém</th>
          ${s.descobertos.map((lista, i) => html`<td key=${s.dias[i]} class=${s.dias[i] === hoje ? 'hoje' : ''}>${lista.map((b) => html`<span key=${b.posto + b.inicio} class="etq-turno t-buraco">${NOMES_POSTO_CURTO[b.posto]} ${horaDoLocal(b.inicio)}–${horaDoLocal(b.fim)}</span>`)}</td>`)}
        </tr>
      </tbody>
    </table></div>
    ${Object.keys(feriados).filter((d) => s.dias.includes(d)).map((d) => html`<small key=${d} class="sub">Feriado em ${fmtDataCurta(d)}: ${feriados[d]}.</small>`)}
  </div>`;
}
