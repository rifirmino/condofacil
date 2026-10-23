import { html, useState } from '../vendor.js';
import { confirmarConvite, codigoDoConvite, aprovarMorador, recusarMorador, moradoresPendentes } from '../implantacao/acoes.js';
import { celularValido } from '../implantacao/regras.js';
import { Campo, Erro, Sucesso } from './comum.js';

// O que o morador vê ao ler o QR Code do convite, e a aprovação dos cadastros novos pelo síndico.
export function MConvite({ estado, executar }) {
  const [form, setForm] = useState({ unidade: '', nome: '', celular: '', codigo: '' });
  const [enviado, setEnviado] = useState(null);
  const [erro, setErro] = useState(null);
  const [resultado, setResultado] = useState(null);
  const campo = (chave) => (ev) => setForm({ ...form, [chave]: ev.target.value });

  function pedirCodigo() {
    if (!form.unidade) { setErro('Escolha a sua unidade'); return; }
    if (!form.nome.trim()) { setErro('Informe o seu nome'); return; }
    if (!celularValido(form.celular)) { setErro('Informe um celular com DDD'); return; }
    setErro(null);
    setEnviado(codigoDoConvite(form.celular));
  }

  function confirmar() {
    const r = executar((e) => confirmarConvite(e, form, new Date()));
    setErro(r.erro || null);
    if (!r.erro) setResultado(r.situacao);
  }

  if (resultado === 'ativo') return html`<section class="m-pagina"><h1 class="m-titulo">Tudo certo!</h1><p class="m-texto">Seu acesso ao apto ${form.unidade.toUpperCase()} está liberado. Bem-vindo ao ${estado.condominio.nome}.</p><a class="btn primario bloco" href="#morador.inicio">Ir para o início</a></section>`;
  if (resultado === 'pendente') return html`<section class="m-pagina"><h1 class="m-titulo">Cadastro enviado</h1><p class="m-texto">Você não estava na lista enviada pelo síndico, então ele vai confirmar o seu cadastro no apto ${form.unidade.toUpperCase()}. Você recebe um aviso assim que for aprovado.</p><a class="btn secundario bloco" href="#morador.inicio">Voltar</a></section>`;
  return html`<section class="m-pagina">
    <h1 class="m-titulo">Entrar pelo convite</h1>
    <p class="m-sub">${estado.condominio.nome} · confirme a sua unidade para começar a usar o app.</p>
    <div class="pilha formulario">
      <${Campo} rotulo="Sua unidade"><select id="convite-unidade" value=${form.unidade} onChange=${campo('unidade')}><option value="">Escolha</option>${estado.condominio.unidades.map((u) => html`<option key=${u} value=${u}>${u}</option>`)}</select><//>
      <${Campo} rotulo="Seu nome"><input id="convite-nome" value=${form.nome} onInput=${campo('nome')} autocomplete="name" /><//>
      <${Campo} rotulo="Seu celular" dica="Com DDD"><input id="convite-celular" inputmode="tel" value=${form.celular} onInput=${campo('celular')} autocomplete="tel" placeholder="(11) 90000-0000" /><//>
      ${!enviado && html`<button type="button" class="btn primario bloco" data-acao="pedir-codigo" onClick=${pedirCodigo}>Receber código por SMS</button>`}
      ${enviado && html`<div class="cartao pilha">
        <small class="sub">SMS simulado para ${form.celular}: <strong data-codigo=${enviado}>Seu código CondoFácil é ${enviado}</strong></small>
        <${Campo} rotulo="Código recebido"><input id="convite-codigo" inputmode="numeric" maxlength="6" value=${form.codigo} onInput=${campo('codigo')} /><//>
        <button type="button" class="btn primario bloco" data-acao="confirmar-convite" onClick=${confirmar}>Confirmar e entrar</button>
      </div>`}
      <${Erro} texto=${erro} />
    </div>
  </section>`;
}

export function AprovacaoMoradores({ estado, executar }) {
  const [mensagem, setMensagem] = useState(null);
  const pendentes = moradoresPendentes(estado);
  if (!pendentes.length && !mensagem) return null;
  const rodar = (acao, texto) => { const r = executar(acao); setMensagem(r.erro || texto); };
  return html`<div class="cartao pilha">
    <strong>Moradores aguardando aprovação</strong>
    <small class="sub">Entraram pelo convite, mas não estavam na planilha da implantação.</small>
    ${pendentes.map((p) => html`<div key=${p.id} class="linha-entre">
      <span>${p.nome} · apto ${p.unidade}${p.celular ? ` · ${p.celular}` : ''}</span>
      <span class="acoes">
        <button type="button" class="btn primario" data-aprovar-morador=${p.id} onClick=${() => rodar((e) => aprovarMorador(e, p.id, 'sindico', new Date()), `${p.nome} aprovado.`)}>Aprovar</button>
        <button type="button" class="btn secundario" onClick=${() => rodar((e) => recusarMorador(e, p.id, 'sindico'), `Cadastro de ${p.nome} recusado.`)}>Recusar</button>
      </span>
    </div>`)}
    <${Sucesso} texto=${mensagem} />
  </div>`;
}
