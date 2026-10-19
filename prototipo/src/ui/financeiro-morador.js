import { html, useState } from '../vendor.js';
import { NOMES_FORMA, NOMES_RELACAO } from '../cobranca/dados.js';
import { fmtReais, mesExtenso, situacaoCobranca, valorAtualizado } from '../cobranca/regras.js';
import { confirmarPagamentoAsaas } from '../cobranca/acoes.js';
import { pessoaDaUnidade } from '../vendas/regras.js';
import { isoDia, nomeMes, fmtDataCurta } from '../datas.js';
import { Sucesso, Vazio, QrFalso, PrevDoc } from './comum.js';
import { EtqCobranca } from './financeiro-sindico.js';

function responsavelDaPessoa(estado, eu) {
  const responsavel = estado.financeiro.unidades[eu].responsavel;
  const pessoa = pessoaDaUnidade(estado, eu);
  return { responsavel, souResponsavel: !!responsavel && !!pessoa && responsavel.nome === pessoa.nome };
}

function cobrancasDaUnidade(estado, eu) {
  const minhas = estado.financeiro.cobrancas.filter((c) => c.unidade === eu);
  return {
    abertas: minhas.filter((c) => c.status === 'aberta').sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
    pagas: minhas.filter((c) => c.status === 'paga').sort((a, b) => b.pagaEm.localeCompare(a.pagaEm)),
  };
}

function nomeAbreviado(nome) {
  const partes = nome.split(' ');
  return `${partes[0]} ${partes[partes.length - 1][0]}.`;
}

function linhaDigitavel(cobranca, total) {
  const n = cobranca.id.replace(/\D/g, '').padEnd(12, '0').slice(0, 12);
  return `34191.${n.slice(0, 5)} ${n.slice(5, 10)}.${n.slice(10)}0001 23456.789012 1 ${String(total).padStart(10, '0')}`;
}

export function CartaoCobrancaInicio({ estado, eu, agora }) {
  const hoje = isoDia(agora);
  if (!responsavelDaPessoa(estado, eu).souResponsavel) return null;
  const { abertas } = cobrancasDaUnidade(estado, eu);
  if (!abertas.length) return html`<a class="cartao link" href="#morador.financeiro"><strong>Financeiro em dia</strong><span class="sub">Nenhuma cobrança em aberto.</span></a>`;
  const c = abertas[0];
  const situacao = situacaoCobranca(c, hoje);
  const v = valorAtualizado(c, estado.financeiro.parametros, hoje);
  return html`<a class=${`cartao link cobranca-inicio${situacao === 'vencida' ? ' vencida' : ''}`} href="#morador.financeiro">
    <div class="linha-entre"><strong>Sua cobrança de ${mesExtenso(c.competencia)}</strong><${EtqCobranca} situacao=${situacao} /></div>
    <span class="preco grande">${fmtReais(v.total)}</span>
    <small class="sub">${situacao === 'vencida' ? `Venceu em ${fmtDataCurta(c.vencimento)} · valor com multa e juros` : `Vence em ${fmtDataCurta(c.vencimento)}`}</small>
    <span class="btn primario">Pagar</span>
  </a>`;
}

function CartaoCobranca({ estado, cobranca, executar, hoje }) {
  const fin = estado.financeiro;
  const [forma, setForma] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const situacao = situacaoCobranca(cobranca, hoje);
  const v = valorAtualizado(cobranca, fin.parametros, hoje);
  const copiaECola = `00020126580014BR.GOV.BCB.PIX0136${cobranca.id}5204000053039865406${(v.total / 100).toFixed(2)}5802BR`;
  const formas = [['pix', 'Pagar com Pix'], ['boleto', 'Boleto'], ['cartao', 'Cartão']].filter(([k]) => fin.parametros.formas.includes(k));

  function copiar() {
    const campo = document.getElementById(`pix-${cobranca.id}`);
    const selecionar = () => {
      campo.select();
      setMensagem('Selecione e copie o código acima.');
    };
    if (!navigator.clipboard) {
      selecionar();
      return;
    }
    navigator.clipboard.writeText(copiaECola).then(() => setMensagem('Código Pix copiado.')).catch(selecionar);
  }

  function confirmar() {
    const r = executar((e) => confirmarPagamentoAsaas(e, cobranca.id, `evt-${cobranca.id}-${forma}`, forma, new Date()));
    if (r.erro) setMensagem(r.erro);
  }

  return html`<article class=${`cartao cobranca${situacao === 'vencida' ? ' vencida' : ''}`}>
    <div class="linha-entre"><strong>${nomeMes(cobranca.competencia)}</strong><${EtqCobranca} situacao=${situacao} /></div>
    <span class="preco grande">${fmtReais(v.total)}</span>
    <small class="sub">${situacao === 'vencida'
      ? `Venceu em ${fmtDataCurta(cobranca.vencimento)} · ${fmtReais(cobranca.valor)} + multa ${fmtReais(v.multa)} + juros ${fmtReais(v.juros)} (${v.dias} dias)`
      : `Vence em ${fmtDataCurta(cobranca.vencimento)}`}</small>
    <details class="composicao"><summary>Composição</summary>
      <ul class="itens-sacola">${cobranca.itens.map((i, n) => html`<li key=${n}><span>${i.descricao}</span><span>${fmtReais(i.valor)}</span></li>`)}</ul>
    </details>
    <div class="acoes" role="group" aria-label="Forma de pagamento">
      ${formas.map(([k, nome]) => html`<button type="button" key=${k} class=${forma === k ? 'btn primario' : 'btn secundario'} aria-pressed=${forma === k} onClick=${() => { setForma(k); setMensagem(null); }}>${nome}</button>`)}
    </div>
    ${forma === 'pix' && html`<div class="pagamento">
      <${QrFalso} texto=${cobranca.id} tamanho=${120} />
      <label class="campo"><span>Pix copia e cola</span><input id=${`pix-${cobranca.id}`} readonly value=${copiaECola} /></label>
      <button type="button" class="btn secundario" onClick=${copiar}>Copiar código</button>
    </div>`}
    ${forma === 'boleto' && html`<div class="pagamento">
      <label class="campo"><span>Linha digitável</span><input id=${`boleto-${cobranca.id}`} readonly value=${linhaDigitavel(cobranca, v.total)} /></label>
      <small class="sub">O PDF do boleto chega por e-mail e WhatsApp.</small>
    </div>`}
    ${forma === 'cartao' && html`<div class="pagamento"><small class="sub">O cartão é pago na página segura do Asaas (simulada no protótipo).</small></div>`}
    ${forma && html`<button type="button" class="btn primario bloco" onClick=${confirmar}>Simular confirmação do Asaas</button>`}
    <${Sucesso} texto=${mensagem} />
    <button type="button" class="btn-link" onClick=${() => setMensagem(`2ª via gerada com valor atualizado: ${fmtReais(v.total)}.`)}>Gerar 2ª via</button>
  </article>`;
}

export function MFinanceiro({ estado, eu, executar, agora }) {
  const hoje = isoDia(agora);
  const [documento, setDocumento] = useState(null);
  const { responsavel, souResponsavel } = responsavelDaPessoa(estado, eu);
  if (documento) return html`<section class="m-pagina"><${PrevDoc} documento=${documento} aoFechar=${() => setDocumento(null)} /></section>`;
  if (!souResponsavel) {
    return html`<section class="m-pagina">
      <h1 class="m-titulo">Financeiro</h1>
      <div class="cartao">
        <strong>As cobranças do apto ${eu} vão para o responsável financeiro</strong>
        <span>${responsavel ? `${nomeAbreviado(responsavel.nome)} (${NOMES_RELACAO[responsavel.relacao]})` : 'Responsável ainda não cadastrado'}</span>
        <small class="sub">Se isso mudou, avise o síndico.</small>
      </div>
    </section>`;
  }
  const { abertas, pagas } = cobrancasDaUnidade(estado, eu);
  const ano = hoje.slice(0, 4);
  const recibo = (c) => ({ titulo: `Recibo · ${nomeMes(c.competencia)} · apto ${eu}`, pasta: 'Financeiro', versoes: [{ versao: 1, data: isoDia(new Date(c.pagaEm)) }] });
  const temVencida = abertas.some((c) => situacaoCobranca(c, hoje) === 'vencida');
  return html`<section class="m-pagina">
    <h1 class="m-titulo">Financeiro</h1>
    <p class="m-sub">Responsável financeiro: ${responsavel.nome} · apto ${eu}</p>
    <h2>Em aberto</h2>
    ${abertas.length
      ? abertas.map((c) => html`<${CartaoCobranca} key=${c.id} estado=${estado} cobranca=${c} executar=${executar} hoje=${hoje} />`)
      : html`<${Vazio} texto="Nenhuma cobrança em aberto. Tudo em dia!" />`}
    <h2>Histórico</h2>
    ${pagas.length
      ? html`<ul class="m-lista">${pagas.map((c) => html`<li key=${c.id} class="cartao">
          <div class="linha-entre"><strong>${nomeMes(c.competencia)}</strong><span>${fmtReais(c.valorPago)}</span></div>
          <small class="sub">Pago em ${fmtDataCurta(isoDia(new Date(c.pagaEm)))} · ${NOMES_FORMA[c.forma]}</small>
          <button type="button" class="btn-link" onClick=${() => setDocumento(recibo(c))}>Ver recibo</button>
        </li>`)}</ul>`
      : html`<${Vazio} texto="Nenhum pagamento registrado." />`}
    ${temVencida
      ? html`<small class="sub">A declaração de quitação fica disponível quando não houver débitos vencidos.</small>`
      : html`<button type="button" class="btn secundario" onClick=${() => setDocumento({ titulo: `Declaração anual de quitação de débitos ${ano} · apto ${eu}`, pasta: 'Financeiro', versoes: [{ versao: 1, data: hoje }] })}>Declaração de quitação ${ano}</button>`}
  </section>`;
}
