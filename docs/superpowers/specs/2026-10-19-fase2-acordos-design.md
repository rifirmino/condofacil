# Fase 2, parte 2: acordos de inadimplência (design)

Base: seção 2.6 da documentação funcional V1.2. Continua a parte 1 (`2026-10-19-fase2-cobranca-design.md`): tudo simulado no protótipo de arquivo único, sem backend.

## Decisões

1. **Vicente Moraes (704)** entra no seletor do morador (Ana · 302, Juliana · 104, Vicente · 704). Proprietário não residente, responsável financeiro da 704, com as taxas de setembro e outubro vencidas.
2. **Acordo antigo semeado** na 304 (Otávio Reis) com a parcela 2 vencida, para mostrar o alerta e a régua sobre parcelas.
3. **Abordagem A:** cada entrada ou parcela do acordo é uma cobrança comum marcada com o acordo. Pagamento, baixa manual, 2ª via, régua e devedores são reaproveitados. O acordo é um registro próprio com os débitos originais, desconto, entrada, parcelas e aceite.

## Dados

### Pessoa
- Vicente entra em `pessoas` com `naoResidente: true` e unidade 704. Ele não entra em vendas: sem perfil de vendedor e sem anúncios.
- A adesão do Início continua "20 de 32 unidades com app": a contagem ignora pessoas com `naoResidente`.
- `MORADORES_DEMO` passa a ser `[['302','Ana'], ['104','Juliana'], ['704','Vicente']]`.

### Acordo (`financeiro.acordos[]`)
```
{ id: 'AC-001', unidade, originais: [idCobranca],
  valorOriginal, multa, juros,             // somados no dia da proposta
  perdoaMulta: bool, jurosPerdoadosPct: 0..100, desconto,
  total, entrada, parcelas, valorParcela,
  situacao: 'aguardando' | 'ativo' | 'quitado' | 'cancelado',
  criadoEm, criadoPor, aceitoEm, aceitoPor, termoLidoEm }
```
- `desconto` = multa (se perdoada) + `round(juros × jurosPerdoadosPct / 100)`.
- `total` = valorOriginal + multa + juros − desconto.
- `valorParcela` = `floor((total − entrada) / parcelas)`. A última parcela leva o resto.

### Cobranças do acordo
Seguem o formato atual de cobrança e acrescentam o campo `acordo: { id, numero, de }`. Para a entrada, `numero` é 0.
- id: `AC-001-E` para a entrada e `AC-001-P1`…`AC-001-Pn` para as parcelas.
- `competencia` é o mês do vencimento e `itens` tem uma única linha: "Acordo AC-001 · entrada" ou "Acordo AC-001 · parcela 2/4".
- As cobranças comuns ganham `acordo: null`.
- Quando o acordo é aceito, as cobranças originais ficam com `status: 'cancelada'` e `substituidaPor: 'AC-xxx'`.

### Rótulo
`rotuloCobranca(c)` devolve "Acordo AC-001 · parcela 2/4" (ou "· entrada") para cobranças de acordo. Para as demais, devolve `nomeMes(c.competencia)`. Ele substitui `nomeMes` nos cartões de cobrança do morador e do síndico.

## Regras (`src/cobranca/acordos.js`)

1. `debitosParaAcordo(estado, unidade, hoje)`: cobranças vencidas da unidade, sem `acordo` e fora de outra proposta aguardando ou acordo ativo.
2. `simularAcordo(estado, { unidade, originais, perdoaMulta, jurosPerdoadosPct, entrada, parcelas }, hoje)` devolve `{ ok, motivo?, valorOriginal, multa, juros, desconto, total, valorParcela, ultimaParcela, cronograma: [{ numero, vencimento, valor }] }`.
   - O valor de cada débito vem de `valorAtualizado`.
   - Validações, nesta ordem:
     - unidade sem débito vencido;
     - nenhum débito marcado;
     - débito que já está em outro acordo;
     - `jurosPerdoadosPct` fora de 0 a 100;
     - parcelas fora de 1 a 12;
     - entrada menor que 0 ou maior ou igual ao total;
     - parcela menor que R$ 50,00.
   - Datas: a entrada vence em hoje + 3 dias. A parcela k vence no dia `parametros.diaVencimento` do mês: o primeiro mês é o seguinte ao da entrada, e cada parcela seguinte vai um mês adiante.
   - Com entrada zero, não existe cobrança de entrada.
3. `propostaPendente(estado, unidade)` e `acordoAtivo(estado, unidade)` são consultas simples.
4. `alertasAcordos(estado, hoje)` devolve:
   - "Acordo AC-001 (304): parcela 2 vencida" para cada parcela vencida de acordo ativo;
   - "Proposta AC-002 aguarda aceite de Vicente Moraes" para cada proposta aguardando.
5. **Plano:**
   - `RECURSOS_PLANO.acordos = 'intermediario'` e `RECURSOS_PLANO.termoConfissao = 'avancado'`;
   - no Básico, criar e aceitar dá erro: "Disponível no plano Intermediário".

## Ações (`src/cobranca/acordos.js`)

Todas devolvem `{ estado, notificacao?, erro? }` e registram auditoria `{ em, quem, acao, detalhe }`.

- `proporAcordo(estado, dados, perfil, agora)`:
  - quem pode: só o síndico (senão SO_SINDICO);
  - simula e, se a simulação falhar, devolve o motivo;
  - cria o acordo `aguardando` com o próximo número (`AC-` + 3 dígitos);
  - auditoria "Proposta de acordo": unidade e total. Se houver desconto, uma segunda auditoria "Desconto em acordo" com o valor perdoado;
  - notificação "Proposta AC-002 enviada a Vicente Moraes".
- `cancelarProposta(estado, id, perfil, agora)`: só o síndico e só na situação `aguardando`. O acordo vira `cancelado`, e as originais não mudam.
- `marcarTermoLido(estado, id, agora)` grava `termoLidoEm`.
- `aceitarAcordo(estado, id, { quem, ciente }, agora)`, em que `quem` é o nome de quem aceita:
  - **Verificações:**
    - `quem` é o responsável financeiro da unidade (senão "Só o responsável financeiro pode aceitar o acordo");
    - `ciente` está marcado (senão "Marque que leu e aceita as condições");
    - no Avançado, o termo foi lido (senão "Leia o termo de confissão antes de aceitar").
  - **Efeitos:**
    - as originais viram `cancelada` com `substituidaPor`;
    - são criadas a entrada e as parcelas, com o cronograma recalculado no dia do aceite e os mesmos valores da proposta;
    - o acordo vira `ativo`;
    - notificação "Acordo AC-002 aceito. A entrada vence em dd/mm.".
- **Quitação:** `confirmarPagamentoAsaas` e `baixaManual` chamam `atualizarQuitacao(estado, idCobranca)`. Quando todas as cobranças de um acordo ativo estão pagas, o acordo vira `quitado` e a notificação ganha "Acordo AC-xxx quitado".

## Integração

- `indicadoresFinanceiros`: "Arrecadado" conta só cobranças com `!c.acordo`. Pagamentos de parcelas somam no saldo como qualquer pagamento, o que já acontece hoje.
- `devedores`:
  - continua contando todas as cobranças vencidas, inclusive as parcelas;
  - cada grupo ganha `acordo: 'ativo' | 'aguardando' | null`, que vira a etiqueta "acordo ativo" ou "proposta enviada".
- A régua não muda. As parcelas são cobranças abertas, e as canceladas já são ignoradas.
- Cobrança › Emitidas lista só cobranças sem `acordo`, que aparecem na aba Acordos.

## Dados iniciais

Hoje = D. O vencimento vigente é o dia 10 de outubro (`vencimentoVigente`).

- **304 (Otávio Reis):**
  - cobranças de junho e julho (competências vigente − 4 e − 3) com `status: 'cancelada'` e `substituidaPor: 'AC-001'`;
  - AC-001 proposto e aceito no dia 5 do mês vigente − 2, por exemplo 05/08 quando o vigente é outubro. A data é fixa no mês para a parcela 2 sempre cair no vencimento vigente;
  - perdão de 100% da multa e 0% dos juros;
  - entrada de R$ 300,00, que vence no dia 8 do mesmo mês e foi paga;
  - 4 parcelas nos dias 10 de setembro (paga), outubro (aberta, vencida há 9 dias), novembro e dezembro.
  - A régua da parcela 2 tem `antes5` e `vencimento` enviados. `atraso1` fica pendente, ou seja, a régua está reativada.
- **704 (Vicente):** setembro e outubro abertos e vencidos, que é o que já existe. Não há proposta: o roteiro cria a AC-002.
- `versao` sobe para 4, e os dados salvos em versão anterior são descartados.

## Telas

### Síndico, Cobrança › Acordos (nova aba depois de Emitidas)
- **Lista:**
  - colunas: número, unidade e responsável, etiqueta de situação, progresso ("1 de 4 parcelas pagas") e próxima parcela;
  - botão **Novo acordo**;
  - cada linha abre o detalhe.
- **Rotas:**
  - `#sindico.cobranca.acordos` mostra a lista;
  - `#sindico.cobranca.novoacordo` abre o Novo acordo;
  - `#sindico.cobranca.novoacordo-704` abre o Novo acordo com a unidade já escolhida, que é o destino do botão Propor acordo;
  - `#sindico.cobranca.AC-001` abre o detalhe.
- **Novo acordo:**
  - campos: select de unidade (só unidades com débitos), caixas dos débitos com o valor atualizado, caixa "Perdoar a multa", juros perdoados (%), entrada (R$) e parcelas (1 a 12);
  - **simulação ao vivo:** total, desconto, entrada, "n × R$ x" e cronograma com datas;
  - o erro aparece na hora, embaixo da simulação;
  - botão **Enviar proposta**.
- **Detalhe:**
  - débitos originais, desconto, cronograma com etiqueta de situação por parcela e auditoria do acordo;
  - cada parcela abre o `DetalheCobranca` que já existe (baixa manual);
  - no Avançado, botão "Ver termo de confissão" (PrevDoc);
  - **Cancelar proposta** enquanto estiver aguardando.
- No Básico, a aba mostra o `Bloqueado` com "Disponível no plano Intermediário".

### Síndico, Início
- Em Devedores, cada linha sem acordo ganha **Propor acordo**. As linhas com acordo mostram a etiqueta.
- "Precisa da sua atenção" inclui os `alertasAcordos`.

### Morador (Vicente)
- **Início:** se houver proposta pendente, aparece o cartão "Proposta de acordo do síndico" com link para o Financeiro. Sem proposta, aparece o cartão de cobrança atual.
- **Financeiro:**
  - O subtítulo é "Responsável financeiro: Vicente Moraes · proprietário não residente".
  - **Proposta pendente:** é o primeiro cartão.
    - Mostra os débitos incluídos, o desconto, o total, a entrada e as parcelas com as datas.
    - No Avançado, tem o botão "Ler o termo de confissão de dívida", que abre o PrevDoc e marca o termo como lido.
    - Tem a caixa "Li e aceito as condições do acordo" e o botão **Aceitar acordo**. O erro aparece no cartão.
  - **Acordo ativo:**
    - cartão **Meu acordo** com o progresso e o cronograma;
    - "Em aberto" mostra as cobranças sem acordo e, do acordo, só as vencidas ou a próxima a vencer;
    - o histórico mostra as originais como "Substituída pelo acordo AC-002".
  - **Sem acordo, mas com débito vencido:** aparece o texto "Quer parcelar? Fale com o síndico para propor um acordo."
- **Seletor:** o Vicente aparece no seletor de Preferências e no da barra.
- Todo cartão de cobrança usa `rotuloCobranca`.

## Erros (textos exatos)

- "Esta unidade não tem débitos vencidos"
- "Escolha ao menos um débito"
- "Este débito já está no acordo AC-xxx"
- "Informe um perdão de juros entre 0% e 100%"
- "Escolha de 1 a 12 parcelas"
- "A entrada precisa ser menor que o total do acordo"
- "Cada parcela precisa ter no mínimo R$ 50,00"
- "Marque que leu e aceita as condições"
- "Leia o termo de confissão antes de aceitar"
- "Só o responsável financeiro pode aceitar o acordo"
- "Disponível no plano Intermediário"
- SO_SINDICO, para criar ou cancelar sem ser síndico

## Testes

- **Casos unitários** em `src/casos/acordos.js`, rodando no `npm test` e em `?teste=1`:
  - **Simulação:** cálculo sem desconto e com perdão de multa e de 50% dos juros; última parcela com o resto; cada validação; datas da entrada e das parcelas; entrada zero sem cobrança de entrada.
  - **Ciclo do acordo:**
    - proposta: só o síndico propõe, a auditoria registra o desconto e as originais não mudam;
    - cancelamento e aceite: o cancelamento vale só na situação aguardando, e o aceite cancela as originais e cria as cobranças;
    - quitação: a última parcela paga quita o acordo.
  - **Regras de aceite e plano:** só o responsável aceita; o termo é obrigatório no Avançado e dispensado no Intermediário; o Básico bloqueia.
  - **Efeitos nas outras telas:**
    - `devedores` marca o acordo e "Arrecadado" ignora as parcelas;
    - a régua fica pendente na parcela 2 da 304;
    - `alertasAcordos` traz o seed e a proposta;
    - a adesão continua em 20.
- **verificar:**
  - `#sindico.cobranca.acordos` mostra "AC-001", "1 de 4 parcelas pagas" e "Otávio Reis";
  - `#sindico.inicio` mostra "Acordo AC-001 (304): parcela 2 vencida" e "Propor acordo";
  - o Financeiro do Vicente vem dos e2e, porque o morador padrão é a Ana.
- **e2e:**
  - **acordoProposta:**
    - o síndico abre o Início, clica em Propor acordo na 704, marca Perdoar a multa e escolhe entrada R$ 300 e 3 parcelas;
    - a simulação aparece e ele envia;
    - na troca para Morador › Vicente, o Início mostra a proposta;
    - no Financeiro, ele aceita sem marcar a caixa e vê o erro;
    - marca a caixa, aceita e paga a entrada com Pix;
    - no síndico, Acordos mostra AC-002 ativo.
  - **acordoPlanos:**
    - no Básico, Acordos mostra o bloqueio;
    - no Avançado, o síndico propõe um acordo para a 704 e o roteiro troca para o Vicente;
    - aceitar sem abrir o termo dá erro, e depois de abrir o termo o aceite funciona.
  - Os 13 roteiros atuais continuam passando, incluindo a largura de celular (390 px nas telas novas).

## Fora do escopo

- Pedido de acordo feito pelo morador.
- Renegociação de acordo ativo.
- Vencimento antecipado automático.
- Assinatura eletrônica real.
- Juros sobre as parcelas do acordo.

## Ajustes na escrita do plano

- **Progresso:** conta só as parcelas, sem a entrada. O AC-001 aparece como "1 de 4 parcelas pagas".
- **Erros de guarda:**
  - "Escolha só débitos vencidos desta unidade" (id de débito que não é da unidade);
  - "Só propostas aguardando aceite podem ser canceladas";
  - "Esta proposta não está aguardando aceite".
- **Efeito do seed nos números atuais:**
  - a 304 entra nos devedores, então a inadimplência passa a 4 de 32 (12,5%, com alerta);
  - a régua de hoje passa a 7 avisos para 4 responsáveis.
  - Os testes e checagens antigos são atualizados para esses números.
- **Seed:** é gerado pelas próprias ações (propor, aceitar e pagar) sobre as cobranças de junho e julho da 304. Depois, o saldo volta ao valor original.
