# Fase 2, parte 6: multas por infração com direito de defesa (design)

Base:
- **Documentação funcional V1.2:**
  - seção 5.2: gerar advertência ou multa para a unidade infratora, com base no regimento;
  - seção 5.4: a advertência nunca revela o denunciante;
  - seção 7: "Advertência → prazo de recurso → decisão → multa lançada no próximo boleto, tudo documentado", no plano Intermediário.
- **Especificação funcional:** a regra "Advertência e multa exigem ocorrência vinculada, base no regimento e notificação ao morador com prazo de defesa".

## Escopo

- **Processo de infração** (PI-001…) aberto a partir de uma notificação de irregularidade, do tipo advertência ou multa.
- **Defesa:** apresentada pelo morador da unidade infratora, com texto e anexo simulado.
- **Fim do prazo:** o síndico pode simular o fim do prazo.
- **Decisão:** manter, converter em advertência ou cancelar, com justificativa. A multa mantida vira lançamento avulso no próximo boleto não emitido.
- **Fora do escopo:**
  - tabela de infrações do regimento;
  - reincidência automática;
  - recurso ao conselho;
  - notificação formal em PDF;
  - edição da multa depois da emissão do boleto.
- **O que sai:** a ação `gerarAdvertencia` e o campo `ocorrencia.advertencia`. A advertência passa a ser um processo do tipo advertência.

## Planos

- Novo `RECURSOS_PLANO.multasDefesa = 'intermediario'`.
- **Básico:** o cartão do detalhe da notificação de irregularidade mostra "Disponível no plano Intermediário".

## Dados (versão 8)

- **`estado.infracoes` e `proximaInfracao`.**
- **Processo:** `{ id, ocorrencia, unidade, tipo: 'advertencia' | 'multa', artigo, fato, valor | null, prazoDias, abertoEm, prazoAte: 'AAAA-MM-DD', situacao: 'defesa' | 'analise' | 'decidido', defesa: { texto, anexo, autor, em } | null, prazoEncerrado, decisao: { resultado: 'mantida' | 'convertida' | 'cancelada', justificativa, em } | null, lancamento: 'AAAA-MM' | null, linha: [{ em, texto, autor }] }`.
- **`ocorrencia.processos`:** a lista dos ids dos processos.
- **Semente:**
  - a OC-0041 passa a dizer "Música alta depois das 22h, aparentemente no 1º andar." (local: 1º andar);
  - o PI-001 é aberto pela ação, hoje às 0h10: multa de R$ 200,00 ao apto 104 pelo "Art. 12 do regimento interno (silêncio depois das 22h)", com prazo de 10 dias.

## Regras (`src/infracoes/regras.js`)

- **`prazoVencido(p, hoje)`:** `p.prazoEncerrado || hoje > p.prazoAte`.
- **`situacaoInfracao(p, hoje)`:** se o processo está em `'defesa'` e o prazo venceu, devolve `'analise'`; senão, a situação gravada.
- **`podeDecidir(p, hoje)`:** a situação não é `'decidido'` e há defesa ou o prazo venceu.
- **`infracoesDaUnidade(estado, u)`** e **`infracoesAbertas(estado)`:** as listas de processos.
- **`alertasInfracoes(estado, hoje)`:**
  - "PI-001: defesa recebida, decida";
  - "PI-001: prazo de defesa encerrado, decida".
- **`fatoPadrao(oc)`:** "{Categoria} registrada em {dd/mm/aaaa}".

## Ações (`src/infracoes/acoes.js`)

- **`abrirProcesso(estado, ocId, { unidade, tipo, artigo, fato, valor, prazoDias }, perfil, agora)`:**
  - **Validações**, nesta ordem:
    - perfil síndico e plano;
    - a notificação é de irregularidade ("Processo só vale para irregularidades");
    - "Informe a unidade infratora";
    - "Informe o artigo do regimento";
    - "Descreva o fato";
    - "Informe o valor da multa";
    - "O prazo de defesa deve ser de 5 a 30 dias";
    - "Já existe um processo aberto para esta unidade nesta notificação".
  - **Na notificação:** acrescenta a entrada "Processo PI-00n aberto: multa ao apto 104".
  - **Notificação:** vai para os moradores da unidade, com o texto "Notificação formal do condomínio (PI-00n): {fato}. {artigo}. Defesa até {dd/mm/aaaa}." Não cita a notificação original nem quem a abriu.
- **`apresentarDefesa(estado, id, { unidade, autor, texto, anexo }, agora)`:**
  - **Validações:**
    - "Só moradores do apto {u} podem apresentar defesa";
    - "O processo já foi decidido";
    - "A defesa já foi apresentada";
    - "O prazo de defesa terminou";
    - "Escreva a sua defesa".
  - **Efeito:** o processo vai para `'analise'` e o síndico é avisado.
- **`encerrarPrazo(estado, id, perfil, agora)`:**
  - só para um processo em `'defesa'` sem defesa; senão, "Só processos aguardando defesa";
  - marca `prazoEncerrado` e passa para `'analise'`.
- **`decidirProcesso(estado, id, { resultado, justificativa }, perfil, agora)`:**
  - **Validações:**
    - "O processo já foi decidido";
    - "Aguarde a defesa ou o fim do prazo";
    - "Só multas podem ser convertidas em advertência";
    - "Informe a justificativa da decisão".
  - **Multa mantida:** o avulso `{ unidade, competencia: primeiraNaoEmitida, tipo: 'multa', descricao: 'Multa por infração PI-00n ({artigo})', valor }` entra em `financeiro.avulsos`. Se a unidade tiver ajuste manual nessa competência, o item entra também no ajuste.
  - **Registro:** acrescenta uma entrada na notificação e avisa a unidade.

## Telas (`src/ui/infracoes.js`)

- **Síndico, Notificações:**
  - o bloco "Processos de infração" (os abertos) no topo da caixa de entrada;
  - o detalhe `#sindico.ocorrencias.PI-00n`, com o botão "Simular fim do prazo (demonstração)" e o cartão Decisão;
  - no detalhe da notificação de irregularidade, o cartão "Advertência ou multa", com os processos já abertos e o formulário.
- **Síndico, Início:** inclui os `alertasInfracoes`.
- **Morador:**
  - **Início:** o cartão "Notificação formal do condomínio" enquanto houver um processo da unidade aguardando defesa;
  - **Ocorrências:** a seção "Notificações para o seu apartamento" e o detalhe `#morador.ocorrencias.PI-00n`, só para a unidade infratora, com o formulário de defesa e a decisão.

## Testes

- **Casos:**
  - a semente;
  - os erros de abertura;
  - a notificação sem o denunciante;
  - a defesa (unidade errada, duas vezes, fora do prazo);
  - `encerrarPrazo`;
  - a decisão (antes da hora, conversão de advertência, multa mantida lançada em 2026-11 e visível na prévia, cancelada sem lançamento);
  - os alertas;
  - o plano.
- **verificar:**
  - `#sindico.ocorrencias` mostra "Processos de infração" e "PI-001";
  - `#sindico.ocorrencias.PI-001` mostra "Art. 12", "R$ 200,00" e "Simular fim do prazo";
  - `#morador.ocorrencias` (Ana) não mostra "PI-001".
- **e2e:**
  - `advertencia`: multa ao 503 pela OC-0043;
  - `multaDefesa`: a Juliana defende o PI-001, o síndico mantém e a prévia de novembro mostra "Multa por infração PI-001".
