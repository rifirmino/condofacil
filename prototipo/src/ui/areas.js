import { html, useState } from '../vendor.js';
import { salvarArea, alternarArea, PERIODOS_PADRAO } from '../areas/acoes.js';
import { Campo, Erro, Sucesso, Vazio, Etiqueta, fmtMoeda } from './comum.js';

// Áreas comuns do condomínio: o síndico cadastra, ajusta as regras de reserva e desativa quando preciso.
function formDaArea(area) {
  return {
    id: area ? area.id : null, nome: area ? area.nome : '', tipo: area ? area.tipo : 'periodo',
    periodos: area && area.periodos ? area.periodos.map((p) => p.id) : ['tarde', 'noite'],
    horaInicio: area && area.horaInicio !== undefined ? String(area.horaInicio) : '8', horaFim: area && area.horaFim !== undefined ? String(area.horaFim) : '22',
    taxa: area ? String(area.taxa || 0) : '0', aprovacao: area ? area.aprovacao : 'automatica',
    antecedenciaMin: area ? String(area.antecedenciaMin) : '1', antecedenciaMax: area ? String(area.antecedenciaMax) : '60',
    limiteMes: area && area.limiteMes ? String(area.limiteMes) : '', capacidade: area && area.capacidade ? String(area.capacidade) : '',
    itens: (area && area.itens) || '', regulamento: (area && area.regulamento) || '', vinculadas: (area && area.vinculadas) || [],
  };
}

function FormArea({ estado, area, executar, aoFechar }) {
  const [form, setForm] = useState(() => formDaArea(area));
  const [erro, setErro] = useState(null);
  const campo = (chave) => (ev) => setForm({ ...form, [chave]: ev.target.value });
  const alternar = (chave, id) => setForm({ ...form, [chave]: form[chave].includes(id) ? form[chave].filter((x) => x !== id) : [...form[chave], id] });
  const outras = estado.areas.filter((a) => !area || a.id !== area.id);
  function salvar() {
    const r = executar((e) => salvarArea(e, form, 'sindico'));
    if (r.erro) setErro(r.erro);
    else aoFechar(`${form.nome.trim()} ${area ? 'atualizada' : 'cadastrada'}.`);
  }
  return html`<div class="cartao pilha formulario" id="form-area">
    <h3>${area ? `Editar ${area.nome}` : 'Nova área comum'}</h3>
    <div class="edicao-anuncio">
      <${Campo} rotulo="Nome"><input id="area-nome" value=${form.nome} onInput=${campo('nome')} placeholder="Ex.: Espaço gourmet" /><//>
      <${Campo} rotulo="Como reserva"><select id="area-tipo" value=${form.tipo} onChange=${campo('tipo')}><option value="periodo">Por período</option><option value="hora">Por hora</option></select><//>
      <${Campo} rotulo="Taxa (R$)" dica="0 para sem taxa"><input id="area-taxa" type="number" min="0" value=${form.taxa} onInput=${campo('taxa')} /><//>
      <${Campo} rotulo="Aprovação"><select id="area-aprovacao" value=${form.aprovacao} onChange=${campo('aprovacao')}><option value="automatica">Automática</option><option value="manual">Pelo síndico</option></select><//>
    </div>
    ${form.tipo === 'periodo'
      ? html`<fieldset class="pilha"><legend>Períodos que podem ser reservados</legend>
          ${PERIODOS_PADRAO.map((p) => html`<label key=${p.id} class="check"><input id=${`area-periodo-${p.id}`} type="checkbox" checked=${form.periodos.includes(p.id)} onChange=${() => alternar('periodos', p.id)} /><span>${p.nome} (${p.inicio}h–${p.fim}h)</span></label>`)}
        </fieldset>`
      : html`<div class="edicao-anuncio">
          <${Campo} rotulo="Abre às (h)"><input id="area-abre" type="number" min="0" max="23" value=${form.horaInicio} onInput=${campo('horaInicio')} /><//>
          <${Campo} rotulo="Fecha às (h)"><input id="area-fecha" type="number" min="1" max="24" value=${form.horaFim} onInput=${campo('horaFim')} /><//>
        </div>`}
    <div class="edicao-anuncio">
      <${Campo} rotulo="Antecedência mínima" dica="Dias; 0 permite reservar no dia"><input id="area-antecedencia-min" type="number" min="0" value=${form.antecedenciaMin} onInput=${campo('antecedenciaMin')} /><//>
      <${Campo} rotulo="Antecedência máxima" dica="Dias"><input id="area-antecedencia-max" type="number" min="0" max="365" value=${form.antecedenciaMax} onInput=${campo('antecedenciaMax')} /><//>
      <${Campo} rotulo="Limite por unidade no mês" dica="Vazio: sem limite"><input id="area-limite" type="number" min="1" value=${form.limiteMes} onInput=${campo('limiteMes')} /><//>
      <${Campo} rotulo="Capacidade (pessoas)" dica="Opcional"><input id="area-capacidade" type="number" min="1" value=${form.capacidade} onInput=${campo('capacidade')} /><//>
    </div>
    <${Campo} rotulo="O que a área oferece"><input id="area-itens" value=${form.itens} onInput=${campo('itens')} placeholder="Ex.: Mesas, cadeiras e geladeira" /><//>
    <${Campo} rotulo="Regulamento"><textarea id="area-regulamento" rows="3" value=${form.regulamento} onInput=${campo('regulamento')} placeholder="Ex.: Som até as 22h. Limpeza por conta do morador."></textarea><//>
    ${outras.length > 0 && html`<fieldset class="pilha"><legend>Divide o espaço com</legend>
      <small class="sub">Reservar uma bloqueia a outra no mesmo horário.</small>
      ${outras.map((a) => html`<label key=${a.id} class="check"><input id=${`area-vinculo-${a.id}`} type="checkbox" checked=${form.vinculadas.includes(a.id)} onChange=${() => alternar('vinculadas', a.id)} /><span>${a.nome}</span></label>`)}
    </fieldset>`}
    <div class="acoes">
      <button type="button" class="btn secundario" onClick=${() => aoFechar(null)}>Cancelar</button>
      <button type="button" class="btn primario" data-acao="salvar-area" onClick=${salvar}>${area ? 'Salvar alterações' : 'Cadastrar área'}</button>
    </div>
    <${Erro} texto=${erro} />
  </div>`;
}

export function AreasComuns({ estado, executar }) {
  const [editando, setEditando] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  function fechar(texto) {
    setEditando(null);
    if (texto) setMensagem(texto);
  }
  function alternar(a) {
    const r = executar((e) => alternarArea(e, a.id, 'sindico'));
    setMensagem(r.erro || (r.ativa ? `${a.nome} volta a aceitar reservas.` : `${a.nome} desativada: não aceita novas reservas. As já feitas continuam valendo.`));
  }
  const nomeDe = (id) => (estado.areas.find((a) => a.id === id) || { nome: id }).nome;
  return html`<div class="pilha">
    <div class="linha-entre"><h2>Áreas comuns</h2>${editando === null && html`<button type="button" class="btn secundario" data-acao="nova-area" onClick=${() => { setEditando('nova'); setMensagem(null); }}>Nova área</button>`}</div>
    ${editando === 'nova' && html`<${FormArea} estado=${estado} area=${null} executar=${executar} aoFechar=${fechar} />`}
    <${Sucesso} texto=${mensagem} />
    ${estado.areas.length === 0 && html`<${Vazio} texto="Nenhuma área comum cadastrada. Cadastre salão, churrasqueira, quadra e o que mais o condomínio tiver." />`}
    ${estado.areas.map((a) => (editando === a.id
      ? html`<${FormArea} key=${a.id} estado=${estado} area=${a} executar=${executar} aoFechar=${fechar} />`
      : html`<div key=${a.id} class="cartao pilha" data-area=${a.id}>
          <div class="linha-entre"><strong>${a.nome}</strong>${a.ativa === false ? html`<${Etiqueta}>Desativada<//>` : html`<${Etiqueta} tipo=${a.aprovacao === 'manual' ? 'alerta' : 'ok'}>${a.aprovacao === 'manual' ? 'Aprovação do síndico' : 'Aprovação automática'}<//>`}</div>
          <span class="sub">${a.tipo === 'periodo' ? `Por período: ${a.periodos.map((p) => p.nome.toLowerCase()).join(', ')}` : `Por hora: ${a.horaInicio}h–${a.horaFim}h`} · ${a.taxa ? fmtMoeda(a.taxa) : 'sem taxa'}</span>
          <span class="sub">Reserva de ${a.antecedenciaMin} a ${a.antecedenciaMax} dias antes · ${a.limiteMes ? `até ${a.limiteMes} por mês` : 'sem limite por mês'}${a.capacidade ? ` · ${a.capacidade} pessoas` : ''}</span>
          ${(a.vinculadas || []).length > 0 && html`<span class="sub">Divide o espaço com ${a.vinculadas.map(nomeDe).join(', ')}</span>`}
          <div class="acoes">
            <button type="button" class="btn-link" data-editar-area=${a.id} onClick=${() => { setEditando(a.id); setMensagem(null); }}>Editar</button>
            <button type="button" class="btn-link" onClick=${() => alternar(a)}>${a.ativa === false ? 'Reativar' : 'Desativar'}</button>
          </div>
        </div>`))}
  </div>`;
}
