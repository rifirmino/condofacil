import { html, useState } from '../vendor.js';
import { configuracoes, salvarConfiguracoes } from '../configuracoes.js';
import { Sucesso } from './comum.js';

// Preferências do condomínio: cada opção é um interruptor com a explicação do que muda para a portaria e os moradores.
export function SConfiguracoes({ estado, executar }) {
  const atual = configuracoes(estado);
  const [mensagem, setMensagem] = useState(null);
  function mudar(chave, valor, texto) {
    const r = executar((e) => salvarConfiguracoes(e, { [chave]: valor }, 'sindico'));
    setMensagem(r.erro || texto);
  }
  return html`<section class="pilha">
    <h1>Configurações</h1>
    <p class="sub">Regras do dia a dia do condomínio. As mudanças valem na hora para a portaria e os moradores.</p>
    <div class="cartao pilha">
      <h2>Encomendas</h2>
      <label class="check"><input id="config-encomenda-qr" type="checkbox" checked=${atual.encomendaComQr} onChange=${(ev) => mudar('encomendaComQr', ev.target.checked, ev.target.checked ? 'A retirada de encomendas volta a pedir o QR Code ou o código.' : 'A retirada de encomendas não pede mais o QR Code.')} />
        <span><strong>Pedir QR Code na retirada</strong><small class="sub">Ligado: o morador mostra o QR Code (ou diz o código) e a portaria confere antes de entregar. Desligado: a portaria entrega conferindo a unidade e registra quem retirou.</small></span></label>
    </div>
    <${Sucesso} texto=${mensagem} />
  </section>`;
}
