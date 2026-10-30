// Percorre os roteiros da especificação num Chrome headless via DevTools Protocol (sem dependências).
import { AJUDANTES, urlPagina, pausa, cdp, js, esperar, esperarTexto, paginaPronta, clicar, clicarSeletor, preencher, porId, marcar, irPara, fecharChrome } from './cdp.mjs';

const ROTEIROS = {
  async encomenda() {
    await irPara('#portaria.registrar');
    await clicar('Ler etiqueta');
    await clicar('Registrar encomenda');
    await esperarTexto('Morador avisado por WhatsApp');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Ana Souza')`, 'o selo de WhatsApp para a Ana');
    const codigo = await js(`document.querySelector('.confirmacao').dataset.codigo`);
    await irPara('#morador.inicio');
    await esperarTexto(codigo);
    await irPara('#portaria.entregar');
    await preencher('Buscar por código ou unidade', codigo);
    await clicar('Apto 302');
    await preencher('Código de retirada', '000000');
    await preencher('Quem retirou', 'Ana Souza');
    await clicar('Confirmar entrega');
    await esperarTexto('Código inválido');
    await clicar('Escanear QR do morador');
    await clicar('Confirmar entrega');
    await esperarTexto('Entrega registrada');
    await irPara('#morador.encomendas');
    await esperar(`document.body.innerText.split('Retirada por Ana Souza').length > 2`, 'duas retiradas da Ana no histórico');
  },

  async reserva() {
    const alvo = await js(`(() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })()`);
    await irPara('#morador.reservas');
    await clicar('Salão de festas');
    if (!(await js(`!!document.querySelector('[data-dia="${alvo}"]')`))) await clicarSeletor('[aria-label="Próximo mês"]');
    await clicarSeletor(`[data-dia="${alvo}"]`);
    await clicar('Tarde (13h–18h)');
    await marcar('Li e aceito o termo de responsabilidade');
    await clicar('Solicitar reserva');
    await esperarTexto('Aguardando aprovação');
    await irPara('#sindico.reservas');
    await clicarSeletor('[data-acao="aprovar-r5"]');
    await esperar(`!document.querySelector('[data-acao="aprovar-r5"]')`, 'a reserva sair da fila de aprovação');
    await irPara('#morador.reservas');
    await esperar(`[...document.querySelectorAll('.m-lista li')].some((li) => li.innerText.includes('Salão de festas') && li.innerText.includes('Confirmada'))`, 'a reserva do salão confirmada para a Ana');
  },

  async ocorrencia() {
    await irPara('#morador.ocorrencias.nova');
    await clicar('Manutenção');
    await preencher('Categoria', 'vazamento');
    await preencher('Descrição', 'Infiltração no teto do banheiro');
    await clicar('Enviar notificação');
    await esperarTexto('Protocolo OC-0044');
    await irPara('#sindico.ocorrencias.OC-0044');
    for (const status of ['Em análise', 'Em atendimento', 'Resolvida']) {
      await clicar(`Mover para "${status}"`);
      await esperarTexto(`Status alterado para ${status}`);
    }
    await irPara('#morador.ocorrencias.OC-0044');
    await clicarSeletor('[data-estrela="5"]');
    await clicar('Enviar avaliação');
    await esperarTexto('Sua avaliação');
  },

  async comunicado() {
    await irPara('#sindico.comunicados.novo');
    await preencher('Tipo', 'evento');
    await preencher('Título', 'Bazar de Natal');
    await clicar('Publicar comunicado');
    await esperarTexto('0 de 32 unidades leram');
    const id = await js(`location.hash.split('.').pop()`);
    await irPara('#morador.avisos');
    await clicar('Bazar de Natal');
    await clicar('Li e estou ciente');
    await esperarTexto('Você confirmou a leitura');
    await irPara(`#sindico.comunicados.${id}`);
    await esperarTexto('1 de 32 unidades leram');
  },

  async vendaCompra() {
    await irPara('#morador.vendas.a1');
    await esperarTexto('Restam 10');
    await preencher('Quantidade', '2');
    await clicar('Adicionar à sacola');
    await esperarTexto('Adicionado à sacola');
    await irPara('#morador.vendas.a2');
    await clicar('Adicionar à sacola');
    await esperarTexto('Adicionado à sacola');
    await irPara('#morador.vendas.sacola');
    await esperarTexto('R$ 48,00');
    await clicar('Fechar pedido');
    await esperarTexto('Pedido PD-011');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Juliana Costa')`, 'o aviso de pedido para a Juliana');
    await irPara('#morador.vendas.a1');
    await esperarTexto('Restam 8');
  },

  async vendaAtendimento() {
    await clicar('Juliana · 104');
    await irPara('#morador.vendas.PD-011');
    await clicar('Aceitar pedido');
    await esperarTexto('Pedido aceito pelo vendedor');
    await preencher('Mensagem', 'Pode passar às 18h');
    await clicar('Enviar');
    await esperarTexto('Pode passar às 18h');
    await clicar('Ana · 302');
    await irPara('#morador.vendas.PD-011');
    await esperarTexto('Pode passar às 18h');
    await clicar('Juliana · 104');
    await irPara('#morador.vendas.PD-011');
    await clicar('Marcar como entregue');
    await clicar('Marcar como pago');
    await esperarTexto('Pagamento confirmado pelo vendedor');
    await irPara('#morador.vendas.loja');
    await clicar('Painel');
    await esperarTexto('R$ 102,00');
    await clicar('Ana · 302');
  },

  async vendaVirarVendedora() {
    await irPara('#morador.vendas.loja');
    await preencher('O que você pretende vender?', 'Bolos caseiros por encomenda');
    await clicar('Pedir para vender');
    await esperarTexto('Aguardando aprovação do síndico');
    await irPara('#sindico.vendas');
    await clicarSeletor('[data-acao="aprovar-vendedor-302"]');
    await esperar(`!document.querySelector('[data-acao="aprovar-vendedor-302"]')`, 'a solicitação sair da lista');
    await irPara('#morador.vendas.novo-anuncio');
    await preencher('Título', 'Bolo de cenoura com chocolate');
    await preencher('Preço (R$)', '35,00');
    await preencher('Quantidade', '4');
    await marcar('Pix');
    await marcar('Retirar no apto');
    await clicar('Publicar anúncio');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('9 moradores')`, 'o aviso para quem aceita ofertas');
    await irPara('#morador.vendas');
    await esperarTexto('Bolo de cenoura com chocolate');
  },

  async cobrancaEmissao() {
    await irPara('#sindico.cobranca.previa');
    await esperarTexto('Sem responsável financeiro: não será emitida');
    await js(`(() => { const i = document.getElementById('emissao-vencimento'); if (!i) return; const d = new Date(Date.now() + 5 * 864e5); __e2e.porId('emissao-vencimento', d.toISOString().slice(0, 10)); })()`);
    await clicarSeletor('[data-acao="emitir"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('31 responsáveis')`, 'o aviso de emissão');
    await irPara('#sindico.inicio');
    await esperarTexto('0 de 31 pagas');
  },

  async cobrancaPagamento() {
    await irPara('#morador.inicio');
    await esperarTexto('Sua cobrança de');
    await esperarTexto('R$ 865,00');
    await irPara('#morador.financeiro');
    await clicar('Pagar com Pix');
    await esperarTexto('Pix copia e cola');
    await clicar('Simular confirmação do Asaas');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Pagamento recebido')`, 'o aviso do Asaas');
    await esperarTexto('Nenhuma cobrança em aberto');
    await clicar('Juliana · 104');
    await irPara('#morador.financeiro');
    await esperarTexto('vão para o responsável financeiro');
    await esperarTexto('Carlos A. (proprietário)');
    await clicar('Ana · 302');
    await irPara('#sindico.inicio');
    await esperarTexto('1 de 31 pagas');
    await esperarTexto('R$ 49.215');
  },

  async cobrancaReguaBaixa() {
    await irPara('#sindico.cobranca.regua');
    await clicarSeletor('[data-acao="executar-regua"]');
    await esperarTexto('7 avisos enviados');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('4 responsáveis')`, 'o aviso da régua');
    await irPara('#sindico.cobranca.emitidas');
    const vigente = await js(`[...document.getElementById('emitidas-competencia').options].map((o) => o.value)[1]`);
    await preencher('Competência', vigente);
    await clicarSeletor(`[data-cobranca="CB-${vigente}-503"]`);
    await clicar('Baixa manual');
    await clicar('Anexar comprovante');
    await clicar('Confirmar baixa');
    await esperarTexto('Baixa registrada');
    await irPara('#sindico.inicio');
    await esperarTexto('3 de 32');
  },

  async cobrancaPlanos() {
    await clicar('Básico');
    await irPara('#sindico.inicio');
    await esperarTexto('Disponível no plano Intermediário (+R$ 158,40/mês)');
    await clicar('Avançado');
    await esperarTexto('Orçado × realizado');
    await clicar('Intermediário');
  },

  async persistencia() {
    await irPara('#sindico.comunicados');
    await esperarTexto('Bazar de Natal');
    await cdp('Page.reload');
    await pausa(300);
    await paginaPronta();
    await esperarTexto('Bazar de Natal');
    await clicar('Reiniciar demonstração');
    await esperar(`!document.body.innerText.includes('Bazar de Natal')`, 'o reinício apagar o comunicado novo');
  },

  async acordoProposta() {
    await irPara('#sindico.inicio');
    await esperarTexto('Acordo AC-001 (304): parcela 2 vencida');
    await clicarSeletor('[data-propor="704"]');
    await esperarTexto('Enviar proposta');
    await marcar('Perdoar a multa');
    await preencher('Entrada (R$)', '300,00');
    await preencher('Parcelas', '3');
    await esperarTexto('Total do acordo');
    await clicarSeletor('[data-acao="enviar-proposta"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Proposta AC-002 enviada a Vicente Moraes')`, 'o aviso da proposta');
    await esperarTexto('Aguardando aceite');
    await irPara('#morador.inicio');
    await clicar('Vicente · 704');
    await esperarTexto('Proposta de acordo do síndico');
    await irPara('#morador.financeiro');
    await esperarTexto('proprietário não residente');
    await clicar('Aceitar acordo');
    await esperarTexto('Marque que leu e aceita as condições');
    await marcar('Li e aceito as condições do acordo');
    await clicar('Aceitar acordo');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Acordo AC-002 aceito')`, 'o aviso do aceite');
    await esperarTexto('Meu acordo AC-002');
    await esperarTexto('Substituída pelo acordo AC-002');
    await clicar('Pagar com Pix');
    await clicar('Simular confirmação do Asaas');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Pagamento recebido')`, 'o pagamento da entrada');
    await clicar('Ana · 302');
    await irPara('#sindico.cobranca.acordos');
    await esperar(`[...document.querySelectorAll('tr')].some((tr) => tr.innerText.includes('AC-002') && tr.innerText.toLowerCase().includes('ativo'))`, 'o AC-002 ativo na lista');
  },

  async acordoPlanos() {
    await clicar('Reiniciar demonstração');
    await clicar('Básico');
    await irPara('#sindico.cobranca.acordos');
    await esperarTexto('Disponível no plano Intermediário');
    await clicar('Avançado');
    await irPara('#sindico.cobranca.novoacordo-704');
    await esperarTexto('Total do acordo');
    await clicarSeletor('[data-acao="enviar-proposta"]');
    await esperarTexto('Aguardando aceite');
    await irPara('#morador.financeiro');
    await clicar('Vicente · 704');
    await marcar('Li e aceito as condições do acordo');
    await clicar('Aceitar acordo');
    await esperarTexto('Leia o termo de confissão antes de aceitar');
    await clicar('Ler o termo de confissão de dívida');
    await esperarTexto('Termo de confissão de dívida · AC-002');
    await clicar('Fechar');
    await marcar('Li e aceito as condições do acordo');
    await clicar('Aceitar acordo');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Acordo AC-002 aceito')`, 'o aceite com termo');
    await clicar('Ana · 302');
    await clicar('Intermediário');
  },

  async notificacaoOS() {
    await clicar('Reiniciar demonstração');
    await irPara('#morador.ocorrencias.nova');
    await clicar('Manutenção');
    await preencher('Categoria', 'vazamento');
    await esperarTexto('Já avisaram sobre isso');
    await preencher('Local', 'Hall do 3º andar');
    await preencher('Descrição', 'Água descendo pela parede do hall');
    await clicar('Enviar notificação');
    await esperarTexto('Protocolo OC-0044');
    await irPara('#portaria.hoje');
    await esperarTexto('Notificação urgente: OC-0044');
    await irPara('#sindico.ocorrencias.OC-0044');
    await clicarSeletor('[data-acao="gerar-os"]');
    await esperarTexto('OS-004');
    await irPara('#zelador.os.OS-004');
    await clicar('Iniciar');
    await clicar('Concluir');
    await preencher('Horas gastas', '1');
    await clicarSeletor('[data-acao="concluir-os"]');
    await esperarTexto('Anexe a foto do depois');
    await clicar('Anexar foto do depois');
    await clicarSeletor('[data-acao="concluir-os"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Seu chamado OC-0044 foi resolvido')`, 'o aviso ao morador');
    await irPara('#morador.ocorrencias.OC-0044');
    await esperarTexto('Reparo concluído pelo zelador');
    await clicarSeletor('[data-estrela="5"]');
    await clicar('Enviar avaliação');
    await esperarTexto('Sua avaliação');
    await irPara('#sindico.manutencao.OS-004');
    await clicarSeletor('[data-acao="validar-os"]');
    await esperarTexto('Validada pelo síndico');
  },

  async compraAprovacao() {
    await irPara('#zelador.compras.nova');
    await preencher('Item', 'Lâmpadas LED 9 W (caixa com 10)');
    await preencher('Quantidade', '1');
    await preencher('Valor estimado (R$)', '250,00');
    await clicar('Pedir compra');
    await esperarTexto('CP-003');
    await irPara('#sindico.manutencao.CP-003');
    await clicarSeletor('[data-acao="aprovar-compra"]');
    await esperarTexto('Compra aprovada');
    await irPara('#zelador.compras');
    await clicarSeletor('[data-compra-receber="CP-003"]');
    await preencher('Valor final (R$)', '240,00');
    await clicar('Confirmar recebimento');
    await esperarTexto('Anexe a nota fiscal (obrigatória acima de R$ 200,00)');
    await clicar('Anexar nota fiscal');
    await clicar('Confirmar recebimento');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('lançado em despesas')`, 'o lançamento');
    await irPara('#sindico.inicio');
    await esperarTexto('R$ 18.340');
  },

  async zeladorAvancado() {
    await clicar('Avançado');
    await irPara('#zelador.compras.nova');
    await preencher('Item', 'Bomba reserva');
    await preencher('Quantidade', '1');
    await preencher('Valor estimado (R$)', '2.500,00');
    await preencher('Fornecedor', 'Hidro Bombas');
    await preencher('Valor da cotação (R$)', '2.500,00');
    await clicar('Pedir compra');
    await esperarTexto('CP-004');
    await irPara('#sindico.manutencao.CP-004');
    await clicarSeletor('[data-acao="aprovar-compra"]');
    await esperarTexto('Anexe 3 cotações para compras acima de R$ 2.000,00');
    await irPara('#zelador.caixa');
    await clicar('Novo gasto');
    await preencher('Descrição', 'Fusíveis');
    await preencher('Valor (R$)', '25,00');
    await clicar('Registrar gasto');
    await esperarTexto('Anexe a foto do cupom');
    await clicar('Anexar foto do cupom');
    await clicar('Registrar gasto');
    await esperarTexto('R$ 214,50');
    await clicar('Intermediário');
  },

  async advertencia() {
    await irPara('#sindico.ocorrencias.OC-0043');
    await preencher('Unidade infratora', '503');
    await clicarSeletor('[data-acao="abrir-processo"]');
    await esperarTexto('Informe o artigo do regimento');
    await preencher('Artigo do regimento', 'Art. 18 (obras só em dias úteis)');
    await preencher('Valor da multa (R$)', '150,00');
    await clicarSeletor('[data-acao="abrir-processo"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Notificação formal') && !document.querySelector('.selo').innerText.includes('Sônia') && !document.querySelector('.selo').innerText.includes('OC-0043')`, 'a notificação formal sem o denunciante');
    await esperarTexto('Processo PI-002 aberto');
  },

  async multaDefesa() {
    await irPara('#morador.inicio');
    await clicar('Juliana · 104');
    await esperarTexto('Notificação formal do condomínio');
    await irPara('#morador.ocorrencias');
    await esperarTexto('Notificações para o seu apartamento');
    await irPara('#morador.ocorrencias.PI-001');
    await preencher('Sua defesa', 'Era aniversário e encerramos a música às 22h30.');
    await clicar('Anexar documento');
    await clicarSeletor('[data-acao="enviar-defesa"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('defesa apresentada')`, 'o aviso da defesa');
    await esperarTexto('Sua defesa ·');
    await clicar('Ana · 302');
    await irPara('#morador.ocorrencias');
    await esperar(`!document.body.innerText.includes('PI-001')`, 'a Ana sem o processo da Juliana');
    await irPara('#sindico.inicio');
    await esperarTexto('PI-001: defesa recebida, decida');
    await irPara('#sindico.ocorrencias.PI-001');
    await esperarTexto('encerramos a música');
    await preencher('Justificativa', 'Barulho confirmado por três vizinhos.');
    await clicarSeletor('[data-acao="decidir-processo"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Decisão do processo PI-001: mantida')`, 'o aviso da decisão');
    await esperarTexto('Multa no boleto de');
  },

  async planosManutencao() {
    await clicar('Básico');
    await irPara('#zelador.os');
    await esperarTexto('Módulo do zelador disponível no plano Intermediário');
    await irPara('#sindico.ocorrencias');
    await esperarTexto('Notificações');
    await esperar(`!document.body.innerText.includes('1ª resposta')`, 'a caixa sem prazos no Básico');
    await clicar('Intermediário');
  },

  async escalaTroca() {
    await clicar('Reiniciar demonstração');
    await irPara('#portaria.escala');
    await esperarTexto('Meus plantões');
    // Quem ainda tem plantão pela frente depende do dia e da hora: usa o primeiro porteiro que tiver.
    const de = await js(`(async () => {
      for (const b of document.querySelectorAll('.escala-porteiros button')) {
        b.click();
        await new Promise((ok) => setTimeout(ok, 150));
        if ([...document.querySelectorAll('button')].some((x) => x.textContent.trim() === 'Propor troca')) return b.textContent.trim();
      }
      return null;
    })()`);
    if (!de) throw new Error('nenhum porteiro com plantão pela frente');
    await clicar('Propor troca');
    const para = await js(`document.getElementById('troca-colega').selectedOptions[0].textContent.trim()`);
    await clicar('Enviar proposta de troca');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes(${JSON.stringify(`${de} propôs`)})`, 'o aviso ao colega');
    await js(`[...document.querySelectorAll('.escala-porteiros button')].find((b) => b.textContent.trim() === ${JSON.stringify(para)}).click()`);
    await pausa(150);
    await clicar('Aceitar');
    await esperarTexto('Falta a aprovação do síndico');
    await irPara('#sindico.escala.pendencias');
    await esperar(`document.querySelectorAll('[data-aprovar]').length > 0`, 'a troca nas pendências');
    await js(`[...document.querySelectorAll('[data-aprovar]')].at(-1).click()`);
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Troca aprovada')`, 'a troca aprovada');
  },

  async escalaFalta() {
    await irPara('#portaria.escala');
    await clicar('Edson');
    await clicar('Registrar falta');
    await preencher('Motivo', 'atestado');
    await clicar('Anexar atestado');
    await clicar('Registrar');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Vigilância Prisma')`, 'o aviso à terceirizada');
    await irPara('#sindico.escala.pendencias');
    await esperarTexto('atestado de Edson');
    await clicarSeletor('[data-atribuir$="-paulo"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Você cobre')`, 'a cobertura atribuída');
  },

  async escalaPublicar() {
    await irPara('#sindico.escala.calendario');
    await preencher('Mês', await js(`[...document.getElementById('escala-mes').options].at(-1).value`));
    await clicarSeletor('[data-acao="gerar-escala"]');
    await esperarTexto('rascunho');
    await preencher('Posto', 'guarita');
    await esperarTexto('sem ninguém');
    await clicarSeletor('[data-acao="publicar-escala"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('porteiros avisados')`, 'a publicação');
  },

  async escalaAvancado() {
    await clicar('Avançado');
    await irPara('#portaria.escala');
    await esperarTexto('De plantão agora');
    const botao = await js(`document.querySelector('[data-acao^="checkin-"]') ? document.querySelector('[data-acao^="checkin-"]').dataset.acao : ''`);
    if (botao) {
      await clicarSeletor(`[data-acao="${botao}"]`);
      await esperarTexto('Check-in às');
    }
    await irPara('#sindico.escala.horas');
    await esperarTexto('Com check-in');
    await clicar('Básico');
    await irPara('#sindico.escala');
    await esperarTexto('Disponível no plano Intermediário');
    await clicar('Intermediário');
  },

  async escalaSemana() {
    await irPara('#sindico.escala.semana');
    await esperarTexto('Sem ninguém');
    const antes = await js(`document.querySelector('.pilha strong').innerText`);
    await clicarSeletor('[data-acao="semana-proxima"]');
    await esperar(`document.querySelector('.pilha strong').innerText !== ${JSON.stringify(antes)}`, 'a próxima semana');
    await clicarSeletor('[data-acao="semana-anterior"]');
    await esperar(`document.querySelector('.pilha strong').innerText === ${JSON.stringify(antes)}`, 'a volta para a semana');
    await clicarSeletor('[data-semana-turno]');
    // Outro porteiro que não o atual: roteiros anteriores podem já ter posto alguém neste turno.
    const outro = await js(`(() => { const s = __e2e.campo('Porteiro do turno'); return [...s.options].map((o) => o.value).find((v) => v && v !== s.value); })()`);
    await preencher('Porteiro do turno', outro);
    await esperarTexto('Turno ajustado');
    await irPara('#portaria.escala');
    await esperarTexto('Escala da semana');
    await esperar(`!document.querySelector('[data-semana-turno]')`, 'a grade só de leitura na portaria');
  },

  async srAbel() {
    await irPara('#morador.inicio');
    await clicarSeletor('.abel-botao');
    await esperarTexto('respostas pelo manual');
    await clicar('Tenho encomenda na portaria?');
    await esperarTexto('Você tem 2 encomenda');
    await clicar('Básico');
    await esperar(`document.querySelector('.abel-painel').innerText.includes('Disponível no plano Intermediário')`, 'o Sr. Abel travado no Básico');
    await clicar('Avançado');
    await esperar(`document.querySelector('.abel-painel').innerText.includes('IA do plano Avançado')`, 'o aviso da IA no Avançado sem Claude');
    await clicar('Tem enquete para eu votar?');
    await esperarTexto('esperando o seu voto');
    await clicar('Intermediário');
    await clicarSeletor('.abel-fechar');
  },

  async enquete() {
    const escrever = (rotulo, valor) => js(`(() => { const el = document.querySelector('input[aria-label=${JSON.stringify(rotulo)}]'); el.value = ${JSON.stringify(valor)}; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await irPara('#sindico.enquetes.nova');
    await preencher('Pergunta', 'Quais melhorias no salão de festas?');
    await escrever('Opção 1', 'Ar-condicionado');
    await escrever('Opção 2', 'Som ambiente');
    await clicarSeletor('[data-acao="adicionar-opcao"]');
    await escrever('Opção 3', 'Novas cadeiras');
    await preencher('Tipo de resposta', 'multipla');
    await preencher('Até quantas opções', '2');
    await marcar('Permitir comentário junto com o voto');
    await esperarTexto('Escolha até 2 opções');
    await clicarSeletor('[data-acao="publicar-enquete"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Nova enquete')`, 'o aviso da enquete');
    await esperarTexto('Enviar lembrete agora');
    const id = await js(`location.hash.split('.').at(-1)`);
    await irPara('#morador.inicio');
    await esperarTexto('Quais melhorias no salão de festas?');
    await irPara(`#morador.enquetes.${id}`);
    await clicarSeletor(`[data-opcao="${id}-o1"]`);
    await clicarSeletor(`[data-opcao="${id}-o3"]`);
    await clicarSeletor('[data-acao="enviar-voto"]');
    await esperarTexto('Seu voto foi registrado');
    await irPara('#morador.inicio');
    await esperar(`!document.body.innerText.includes('Quais melhorias no salão de festas?')`, 'o cartão sumir depois do voto');
    await irPara(`#sindico.enquetes.${id}`);
    await esperarTexto('1 de 32');
    await clicarSeletor('[data-acao="enviar-lembrete"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('31 unidades')`, 'o lembrete aos faltantes');
    await clicarSeletor('[data-acao="encerrar-enquete"]');
    await clicarSeletor('[data-acao="confirmar-encerrar"]');
    await esperarTexto('Resultado · Empate entre Ar-condicionado e Novas cadeiras');
    await clicarSeletor('[data-acao="publicar-resultado"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Resultado publicado')`, 'o resultado publicado');
    await irPara('#sindico.documentos');
    await esperarTexto('Resultado da enquete: Quais melhorias no salão de festas?');
    await clicar('Avançado');
    await irPara('#sindico.enquetes.EN-002');
    await esperarTexto('Quórum de 50%');
    await esperarTexto('por fração ideal');
    await clicar('Intermediário');
  },

  async contaPagar() {
    await irPara('#sindico.financeiro.contas');
    await preencher('Mostrar', 'vencidas');
    await clicarSeletor('[data-pagar="CT-011"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Imunizadora Verde')`, 'o pagamento da dedetização');
    await esperarTexto('Conta CT-011 paga');
    await irPara('#sindico.financeiro.auditoria');
    await esperarTexto('Conta paga');
  },

  async prestacaoConselho() {
    const escrever = (rotulo, valor) => js(`(() => { const el = document.querySelector('input[aria-label=${JSON.stringify(rotulo)}]'); el.value = ${JSON.stringify(valor)}; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await clicar('Avançado');
    await irPara('#sindico.financeiro.prestacao');
    const mes = await js(`document.querySelectorAll('[data-mes]')[1].dataset.mes`);
    const item = `${mes}-manutencao-dedetizacao`;
    await irPara(`#sindico.financeiro.prestacao-${mes}`);
    await clicarSeletor('[data-acao="fechar-mes"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('pronto para análise')`, 'o aviso ao conselho');
    await clicar('Conselho');
    await irPara(`#conselho.prestacao.${mes}`);
    await esperarTexto('Parecer do conselho');
    await clicarSeletor(`[data-comentar="${item}"]`);
    await escrever('Comentário do conselho', 'Falta a nota da dedetização');
    await clicarSeletor('[data-acao="enviar-comentario"]');
    await esperarTexto('Comentário registrado');
    await preencher('Motivo da correção', 'Anexar a nota da dedetização');
    await clicarSeletor('[data-acao="pedir-correcao"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('pediu correção')`, 'o pedido de correção');
    await clicar('Síndico');
    await irPara(`#sindico.financeiro.prestacao-${mes}`);
    await esperarTexto('Correção pedida por Gustavo Freitas');
    await clicarSeletor(`[data-anexar="${item}"]`);
    await esperarTexto('Nota anexada');
    await escrever('Resposta ao conselho', 'Nota anexada ao lançamento');
    await clicar('Responder');
    await esperarTexto('Resposta enviada');
    await clicarSeletor('[data-acao="reenviar-conselho"]');
    await esperarTexto('Balancete reenviado ao conselho');
    await clicar('Conselho');
    await irPara(`#conselho.prestacao.${mes}`);
    await clicarSeletor('[data-acao="aprovar-mes"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('aprovado pelo conselho')`, 'a aprovação');
    await clicar('Síndico');
    await irPara(`#sindico.financeiro.prestacao-${mes}`);
    await clicarSeletor('[data-acao="publicar-resumo"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('publicada')`, 'o resumo publicado');
    await esperarTexto('Registrar ajuste no mês corrente');
    await irPara('#morador.prestacao');
    await esperar(`document.querySelectorAll('.m-lista li').length >= 2`, 'dois resumos para o morador');
    await irPara('#sindico.financeiro.fluxo');
    await esperarTexto('Próximos lançamentos');
    await esperarTexto('o ponto mais baixo é');
    await esperar(`!!document.querySelector('.grafico-fluxo .linha-saldo')`, 'a linha do saldo');
    await clicar('Intermediário');
  },

  async orcamentoPrevisao() {
    await irPara('#sindico.cobranca.orcamento');
    await clicarSeletor('[data-abrir-previsao="PO-001"]');
    await esperarTexto('Previsão PO-001 aberta');
    await preencher('Percentual de reajuste (%)', '10');
    await clicarSeletor('[data-acao="aplicar-reajuste"]');
    await esperar(`[...document.querySelectorAll('input')].some((i) => i.value === 'R$ 125.400,00')`, 'o pessoal com 10%');
    await preencher('Nome da previsão', 'Reajuste de 10%');
    await clicarSeletor('[data-acao="salvar-como-nova"]');
    await esperarTexto('Previsão PO-003 salva');
    await preencher('Previsão B', 'PO-003');
    await esperarTexto('B − A');
    await clicarSeletor('[data-acao="gerar-documento"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('publicada para a AGO')`, 'o documento da AGO');
    await irPara('#sindico.documentos');
    await esperarTexto('Previsão orçamentária 2027 · Reajuste de 10%');
    await irPara('#sindico.cobranca.orcamento');
    await clicarSeletor('[data-acao="usar-no-reajuste"]');
    await preencher('Aprovado em', 'AGO de 28/03/2027, item 2');
    await clicarSeletor('[data-acao="confirmar-reajuste"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('responsáveis')`, 'o aviso do reajuste');
    await esperarTexto('Confira em Taxa e reajustes');
  },

  async taxaReajuste() {
    await clicar('Reiniciar demonstração');
    await irPara('#sindico.cobranca.taxas');
    await clicar('Nova composição');
    await preencher('Percentual (%)', '6');
    await esperarTexto('R$ 757,90');
    await clicarSeletor('[data-acao="confirmar-reajuste"]');
    await esperarTexto('Informe a ata ou data da assembleia');
    await preencher('Aprovado em', 'AGE de 15/10/2026, item 2');
    await clicarSeletor('[data-acao="confirmar-reajuste"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('31 responsáveis')`, 'o aviso do reajuste');
    await esperarTexto('Reajuste agendado para');
    await irPara('#sindico.cobranca.previa');
    await esperarTexto('R$ 907,90');
    await irPara('#sindico.inicio');
    await esperarTexto('Reajuste agendado para');
    await irPara('#morador.financeiro');
    await esperarTexto('para R$ 757,90 (+6,0%)');
  },

  async taxaExtra() {
    await irPara('#sindico.cobranca.taxas');
    await clicar('Nova taxa extra');
    await preencher('Descrição', 'Troca dos elevadores');
    await preencher('Valor total (R$)', '30.000,00');
    await preencher('Parcelas', '12');
    await preencher('Rateio', 'fracao');
    await preencher('Aprovado em', 'AGE de 15/10/2026, item 3');
    await esperarTexto('R$ 73,46 por mês');
    await clicarSeletor('[data-acao="criar-taxa-extra"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('Troca dos elevadores')`, 'o aviso da taxa extra');
    await esperarTexto('TX-002 · Troca dos elevadores');
    await clicarSeletor('[data-encerrar="TX-001"]');
    await preencher('Motivo ou ata', 'AGE de 15/10/2026, item 4');
    await clicar('Confirmar encerramento');
    await esperarTexto('última parcela em outubro de 2026');
    await clicar('Básico');
    await esperarTexto('Disponível no plano Intermediário');
    await clicar('Intermediário');
  },

  async larguraCelular() {
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await pausa(300);
    for (const hash of ['#sindico.inicio', '#sindico.reservas', '#sindico.comunicados.novo', '#sindico.ocorrencias', '#sindico.encomendas', '#sindico.vendas', '#morador.inicio', '#morador.reservas', '#morador.vendas', '#morador.vendas.a1', '#morador.vendas.loja', '#portaria.registrar', '#portaria.entregar', '#sindico.cobranca', '#morador.financeiro', '#sindico.cobranca.acordos', '#sindico.cobranca.AC-001', '#sindico.cobranca.novoacordo', '#sindico.ocorrencias', '#sindico.manutencao', '#sindico.manutencao.compras', '#zelador.os', '#zelador.os.OS-003', '#zelador.compras', '#zelador.compras.nova', '#morador.ocorrencias.nova', '#sindico.escala', '#sindico.escala.pendencias', '#sindico.escala.equipe', '#portaria.escala', '#sindico.cobranca.taxas', '#sindico.escala.semana', '#sindico.ocorrencias.PI-001', '#sindico.ocorrencias.OC-0043', '#sindico.cobranca.orcamento', '#sindico.financeiro.contas', '#sindico.financeiro.prestacao', '#conselho.prestacao', '#morador.prestacao', '#sindico.enquetes.EN-001', '#sindico.enquetes.nova', '#morador.enquetes.EN-001', '#sindico.moradores', '#morador.dados', '#sindico.colaboradores', '#sindico.configuracoes']) {
      await irPara(hash);
      const largura = await js('document.documentElement.scrollWidth');
      if (largura > 390) throw new Error(`${hash} rola na horizontal (${largura}px)`);
    }
    await cdp('Emulation.clearDeviceMetricsOverride');
  },

  // Do zero: assistente de implantação, condomínio novo vazio em todas as telas, convite pelo QR e volta à demonstração.
  async implantacao() {
    await js(`document.getElementById('seletor-condominio').value = 'novo'; document.getElementById('seletor-condominio').dispatchEvent(new Event('change', { bubbles: true })); true`);
    await esperarTexto('passo 1 de 7');
    await clicarSeletor('[data-acao="avancar-implantacao"]');
    await esperarTexto('Informe o nome do condomínio');
    await porId('impl-nome', 'Residencial Teste E2E');
    await porId('impl-cnpj', '12.345.678/0001-90');
    await porId('impl-sindico', 'Helena Prado');
    await porId('impl-sindico-apto', '402B');
    await porId('impl-sindico-celular', '11999998888');
    await clicarSeletor('[data-acao="avancar-implantacao"]');
    await esperarTexto('passo 2 de 7');
    await clicarSeletor('[data-acao="avancar-implantacao"]');
    await esperarTexto('Gere ou importe as unidades');
    await porId('impl-blocos', 'A, B');
    await porId('impl-andares', '4');
    await porId('impl-por-andar', '2');
    await clicarSeletor('#impl-cobertura');
    await clicarSeletor('[data-acao="gerar-unidades"]');
    await esperarTexto('16 unidades · 4 coberturas');
    await clicarSeletor('[data-acao="avancar-implantacao"]');
    await esperarTexto('passo 3 de 7');
    await porId('impl-csv-moradores', '101A;Maria Silva;maria@email.com;11987654321;titular;sim\nZ999;Ninguém;;;titular;sim');
    await esperarTexto('1 com erro');
    await clicarSeletor('[data-acao="avancar-implantacao"]');
    await esperarTexto('Corrija as linhas com erro');
    await porId('impl-csv-moradores', '101A;Maria Silva;maria@email.com;11987654321;titular;sim\n201B;Rui Costa;rui@email.com;11944443333;proprietario;sim');
    await esperarTexto('2 de 2 linhas prontas');
    await clicarSeletor('[data-acao="avancar-implantacao"]');
    await esperarTexto('passo 4 de 7');
    await porId('impl-taxa-a', '500,00');
    await porId('impl-taxa-cobertura', '750,00');
    await esperarTexto('Prévia da taxa');
    await clicarSeletor('[data-acao="avancar-implantacao"]');
    await esperarTexto('passo 5 de 7');
    await clicarSeletor('[data-acao="criar-subconta"]');
    await clicarSeletor('[data-acao="aprovar-subconta"]');
    await esperarTexto('Subconta aprovada');
    await clicarSeletor('[data-acao="avancar-implantacao"]');
    await esperarTexto('passo 6 de 7');
    await clicarSeletor('[data-acao="avancar-implantacao"]');
    await esperarTexto('passo 7 de 7');
    await esperarTexto('https://condofacil.cloud/c/residencial-teste-e2e');
    await esperar(`!!document.querySelector('#cartaz-implantacao svg')`, 'o QR Code do cartaz', 10000);
    await clicarSeletor('[data-acao="avancar-implantacao"]');
    await esperarTexto('Olá, Helena');
    await esperarTexto('Residencial Teste E2E · 16 unidades');

    // Todas as telas de todos os perfis abrem sem erro no condomínio vazio.
    for (const perfil of ['sindico', 'morador', 'portaria', 'zelador', 'conselho']) {
      const fila = [`#${perfil}.inicio`];
      const vistos = new Set();
      while (fila.length && vistos.size < 80) {
        const hash = fila.shift();
        if (vistos.has(hash)) continue;
        vistos.add(hash);
        await irPara(hash);
        const erros = await js('window.__erros.splice(0)');
        if (erros.length) throw new Error(`${hash}: ${erros.join(' | ')}`);
        if (!(await js(`!!document.querySelector('.barra-demo') && document.body.innerText.length > 150`))) throw new Error(`${hash} ficou em branco`);
        const links = await js(`[...document.querySelectorAll('a[href^="#${perfil}."]')].map((a) => a.getAttribute('href'))`);
        for (const l of links) if (!vistos.has(l) && l.split('.').length <= 3) fila.push(l);
      }
    }

    await irPara('#sindico.cobranca.previa');
    await js(`(() => { const i = document.getElementById('emissao-vencimento'); if (!i) return; const d = new Date(Date.now() + 5 * 864e5); __e2e.porId('emissao-vencimento', d.toISOString().slice(0, 10)); })()`);
    await clicarSeletor('[data-acao="emitir"]');
    await esperar(`!!document.querySelector('.selo') && document.querySelector('.selo').innerText.includes('3 responsáveis')`, 'o aviso da primeira emissão');

    // Convite: quem está na planilha entra direto; quem não está espera o síndico.
    await irPara('#morador.convite');
    await porId('convite-unidade', '101A');
    await porId('convite-nome', 'Maria Silva');
    await porId('convite-celular', '(11) 98765-4321');
    await clicarSeletor('[data-acao="pedir-codigo"]');
    await porId('convite-codigo', await js(`document.querySelector('[data-codigo]').dataset.codigo`));
    await clicarSeletor('[data-acao="confirmar-convite"]');
    await esperarTexto('Tudo certo!');
    await clicarSeletor('[data-acao="completar-cadastro"]');
    await esperarTexto('Meus dados');
    await porId('dados-cpf', '123');
    await clicarSeletor('[data-acao="salvar-meus-dados"]');
    await esperarTexto('CPF inválido');
    await porId('dados-cpf', '529.982.247-25');
    await clicarSeletor('[data-acao="salvar-meus-dados"]');
    await esperarTexto('Seus dados foram atualizados');
    await porId('residente-nome-0', 'João Silva');
    await clicarSeletor('[data-acao="salvar-residentes"]');
    await esperarTexto('Lista salva');
    await irPara('#morador.inicio');
    await irPara('#morador.convite');
    await porId('convite-unidade', '202A');
    await porId('convite-nome', 'Carlos Lima');
    await porId('convite-celular', '11955554444');
    await clicarSeletor('[data-acao="pedir-codigo"]');
    await porId('convite-codigo', '000000');
    await clicarSeletor('[data-acao="confirmar-convite"]');
    await esperarTexto('Código inválido');
    await porId('convite-codigo', await js(`document.querySelector('[data-codigo]').dataset.codigo`));
    await clicarSeletor('[data-acao="confirmar-convite"]');
    await esperarTexto('Cadastro enviado');
    await irPara('#sindico.inicio');
    await esperarTexto('Carlos Lima · apto 202A');
    await clicarSeletor('[data-aprovar-morador]');
    await esperarTexto('Carlos Lima aprovado.');

    // O caso do teste de 26/10: a planilha tinha a Maria no 101A e o Ricardo entra pelo convite com o nome dele.
    await irPara('#morador.convite');
    await porId('convite-unidade', '101A');
    await porId('convite-nome', 'Ricardo Firmino');
    await porId('convite-celular', '11925913118');
    await clicarSeletor('[data-acao="pedir-codigo"]');
    await porId('convite-codigo', await js(`document.querySelector('[data-codigo]').dataset.codigo`));
    await clicarSeletor('[data-acao="confirmar-convite"]');
    await esperarTexto('Cadastro enviado');
    await irPara('#sindico.inicio');
    await esperarTexto('Já cadastrado no apto 101A: Maria Silva');
    await clicarSeletor('[data-substituir-morador]');
    await esperarTexto('Ricardo Firmino aprovado no lugar de Maria Silva');
    await irPara('#sindico.moradores');
    await esperar(`document.querySelector('[data-unidade-moradores="101A"]').innerText.includes('Ricardo Firmino · sem CPF')`, 'o Ricardo como responsável sem CPF no 101A');
    await clicarSeletor('[data-definir-responsavel="101A"]');
    await porId('resp-cpf-101A', '529.982.247-25');
    await clicarSeletor('[data-acao="salvar-responsavel"]');
    await esperar(`document.querySelector('[data-unidade-moradores="101A"]').innerText.includes('CPF 529.982.247-25')`, 'o CPF do responsável salvo');

    // Equipe: o primeiro porteiro cadastrado já forma a escala do mês seguinte.
    await irPara('#sindico.escala');
    await esperarTexto('Nenhum porteiro cadastrado ainda');
    await irPara('#sindico.colaboradores');
    await clicarSeletor('[data-acao="novo-colaborador"]');
    await porId('colab-nome', 'João Lima');
    await porId('colab-telefone', '(11) 91234-5678');
    await porId('colab-primeiro-dia', new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10));
    await clicarSeletor('[data-acao="salvar-colaborador"]');
    await esperarTexto('João Lima cadastrado');
    await esperar(`document.querySelector('[data-colaborador="col-joao-lima"]').innerText.includes('Portaria principal · 12x36 · 7h–19h')`, 'a escala do João');
    await irPara('#sindico.escala.calendario');
    await esperar(`!!document.querySelector('[data-acao="gerar-escala"]')`, 'o botão de gerar a escala');

    // Área comum nova, que o morador já vê para reservar.
    await irPara('#sindico.reservas');
    await clicarSeletor('[data-acao="nova-area"]');
    await porId('area-nome', 'Espaço gourmet');
    await porId('area-taxa', '80');
    await clicarSeletor('[data-acao="salvar-area"]');
    await esperarTexto('Espaço gourmet cadastrada');
    await irPara('#morador.reservas');
    await esperarTexto('Espaço gourmet');

    // Configurações: sem QR Code, a portaria entrega sem pedir o código.
    await irPara('#sindico.configuracoes');
    await js(`document.getElementById('config-encomenda-qr').click()`);
    await esperarTexto('não pede mais o QR Code');
    await irPara('#portaria.registrar');
    await porId('portaria-unidade', '402b');
    await clicar('Mercado Livre');
    await clicar('Registrar encomenda');
    await esperarTexto('Morador avisado por WhatsApp');
    await irPara('#portaria.entregar');
    await clicar('Apto 402B');
    await esperar(`!!document.getElementById('portaria-quem') && !document.getElementById('portaria-codigo')`, 'a entrega sem o campo de código');
    await porId('portaria-quem', 'Helena Prado');
    await clicar('Confirmar entrega');
    await esperarTexto('Entrega registrada: apto 402B');

    // A demonstração continua intacta e o condomínio criado fica guardado no seletor.
    await js(`document.getElementById('seletor-condominio').value = 'demo'; document.getElementById('seletor-condominio').dispatchEvent(new Event('change', { bubbles: true })); true`);
    await esperarTexto('Residencial Ipê Amarelo · 32 unidades');
    await esperar(`[...document.getElementById('seletor-condominio').options].some((o) => o.textContent === 'Residencial Teste E2E')`, 'o condomínio criado no seletor');
  },
};

let falhou = false;
try {
  await cdp('Page.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: AJUDANTES });
  await cdp('Page.navigate', { url: `${urlPagina}#sindico.inicio` });
  await paginaPronta();
  await clicar('Reiniciar demonstração');
  for (const [nome, roteiro] of Object.entries(ROTEIROS)) {
    try {
      await roteiro();
      console.log(`ok    ${nome}`);
    } catch (e) {
      falhou = true;
      console.log(`FALHA ${nome}: ${e.message}`);
    }
  }
} finally {
  await fecharChrome();
}
process.exit(falhou ? 1 : 0);
