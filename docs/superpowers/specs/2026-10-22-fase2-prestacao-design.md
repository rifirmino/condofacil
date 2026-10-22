# Fase 2, parte 8: contas a pagar, prestação de contas e fluxo de caixa (design)

Base:
- **Especificação funcional, seção 6.5:** balancete mensal em PDF, pasta do conselho com aprovação digital e versão resumida para os moradores, sem nomes de devedores.
- **Especificação funcional, seção 6.6:** o mês aprovado fica travado e as correções entram como ajuste.
- **Matriz de planos da V1.2:**
  - Intermediário: contas a pagar e balancete em PDF;
  - Avançado: fluxo projetado de 90 dias e aprovação do conselho.

## Menu e planos

- **Menu novo Síndico › Financeiro** (`#sindico.financeiro.<aba>`), entre Cobrança e Reservas, com as abas:
  - `contas`: Contas a pagar;
  - `prestacao`: Prestação de contas;
  - `fluxo`: Fluxo de caixa;
  - `auditoria`: Auditoria, que sai de Cobranças emitidas.
- **Recursos por plano:**
  - `contasPagar: 'intermediario'`;
  - `prestacaoContas: 'intermediario'`;
  - `aprovacaoConselho: 'avancado'`;
  - `fluxoCaixa: 'avancado'`.
- **Perfil novo "Conselho"** em `PERFIS` (`#conselho.prestacao`, `#conselho.documentos`): Gustavo Freitas, apto 501, conselheiro fiscal.

## Contas a pagar (`src/financeiro/contas.js` e `acoes.js`)

- **Conta:** `{ id: 'CT-0nn', fornecedor, categoria, descricao, valor, vencimento, recorrente, situacao: 'aberta' | 'paga', pagaEm, comprovante, boleto }`.
- **Situação exibida:**
  - Paga;
  - Vencida (`vencimento < hoje`);
  - Vence hoje;
  - A pagar.
- **`novaConta`:**
  - "Informe o fornecedor";
  - "Escolha a categoria";
  - "Informe o valor";
  - "Informe o vencimento".
- **`pagarConta`:**
  - só para conta aberta ("Esta conta já foi paga");
  - lança a despesa na categoria (`despesasMes`), baixa o saldo e registra na auditoria;
  - se a conta for recorrente, cria a do mês seguinte com o mesmo dia de vencimento, até o dia 28.
- **Uma conta paga não se edita.**
- **Alertas no Início:** "Conta vencida: {descrição} ({valor})" e "Vence hoje: {descrição}".
- **Semente (mês corrente V):**
  - **pagas**, somando exatamente `despesasMes` junto com a CP-002 (R$ 145,00 em manutenção):

    | Categoria | Contas | Total |
    | --- | --- | --- |
    | Pessoal | folha R$ 7.200 + encargos R$ 2.600 | R$ 9.800 |
    | Concessionárias | energia R$ 2.100 + água R$ 1.800 | R$ 3.900 |
    | Manutenção | elevadores R$ 1.450 + jardinagem R$ 705 | R$ 2.155 |
    | Administração | administradora | R$ 1.200 |
    | Seguro e outros | seguro | R$ 900 |

  - **abertas:**
    - Vigilância Prisma, R$ 3.800, pessoal, vence em +2 dias;
    - gás, R$ 180, concessionárias, vence hoje;
    - dedetização (Imunizadora Verde), R$ 450, manutenção, venceu ontem e não é recorrente.
  - **nomes:** os fornecedores são fictícios ou genéricos, sem marcas reais.

## Prestação de contas (`src/financeiro/balancete.js` e `acoes.js`)

- **Meses guardados em `financeiro.balancetes[mes]`:**
  - **forma:** `{ situacao: 'aberto' | 'fechado' | 'aguardando' | 'correcao' | 'aprovado', saldoInicial, receitas: [{ nome, valor }], despesas: [{ categoria, itens: [{ id, descricao, valor, nota }] }], inadimplencia: { unidades, valor }, comentarios: [{ id, item, texto, autor, em, resposta }], correcao, fechadoEm, aprovadoEm, aprovadoPor, documento, resumo }`;
  - o saldo final é calculado: saldo inicial + receitas − despesas.
- **Mês corrente:** não fica guardado; `balanceteDoMes(estado, mes, hoje)` o calcula na hora.
  - **saldo inicial:** o saldo final do mês anterior guardado;
  - **receitas:** as cobranças pagas no mês, separando "Taxas condominiais" de "Acordos";
  - **despesas por categoria:**
    - contas pagas no mês (com nota);
    - compras recebidas no mês (com a nota da compra);
    - reposições do caixa pequeno (com os cupons);
    - ajustes do mês;
    - uma linha "Outros lançamentos" quando sobra diferença em relação a `despesasMes`;
  - **inadimplência:** a de `indicadoresFinanceiros`.
- **Semente:**
  - **V−2 (agosto):** aprovado por Gustavo Freitas, com documento (o d5, renomeado para o mês) e resumo publicado;
  - **V−1 (setembro):** aberto, pronto para fechar, com a dedetização de R$ 450 **sem nota**;
  - **valores:** as receitas e despesas vêm de `historico`, e as despesas são rateadas pelos mesmos fornecedores;
  - **saldos:** encadeiam de trás para a frente a partir de `saldo − receitas(V) + despesas(V)`.
- **Ações e erros:**
  - **`fecharMes`:**
    - "O mês ainda não terminou" no mês corrente;
    - só para mês aberto;
    - gera o documento "Balancete de {mês}" na pasta Balancetes, com visibilidade do conselho;
    - no Intermediário, o mês vira `fechado`, travado de vez;
    - no Avançado, vira `aguardando` e avisa o conselho.
  - **Pelo conselho, só no Avançado e com o mês em `aguardando`:**
    - `comentarLancamento`;
    - `pedirCorrecao`, com motivo obrigatório ("Informe o motivo"), que leva o mês para `correcao`;
    - `aprovarMes`, que leva o mês para `aprovado` (travado) e grava `aprovadoEm` e `aprovadoPor`.
  - **Pelo síndico:**
    - `anexarNota`, em mês aberto ou em correção ("Mês travado: registre um ajuste no mês corrente");
    - `responderComentario`;
    - `reenviarAoConselho`, de `correcao` para `aguardando`;
    - `registrarAjuste(mesDeOrigem, { descricao, categoria, valor })`:
      - só em mês fechado ou aprovado;
      - lança a despesa no mês corrente, como "Ajuste referente a {mês}: {descrição}";
      - entra na lista `financeiro.ajustesMes`.
  - **`publicarResumo`:**
    - no Intermediário, exige o mês fechado; no Avançado, aprovado;
    - cria o documento "Prestação de contas de {mês} (resumo)", visível a todos;
    - o resumo traz receitas, despesas por categoria, saldo e inadimplência em percentual, sem unidades nem nomes.

## Fluxo de caixa (`src/financeiro/fluxo.js`)

- **`fluxoProjetado(estado, hoje, dias = 90, margemPct)`:** devolve `{ dias: [{ dia, saldo, entradas, saidas }], minimo: { dia, saldo }, reserva, abaixo }`. O saldo começa em `fin.saldo`.
- **Entradas**, todas multiplicadas por (1 − margem):
  - as cobranças abertas que vencem de hoje em diante;
  - as competências não emitidas, pelo total da prévia na data de vencimento.
- **Saídas:**
  - as contas abertas (as vencidas entram hoje);
  - a projeção das recorrentes, com uma série por fornecedor e descrição, nos meses seguintes que ainda não têm conta.
- **Reserva:** a despesa média de um mês (`indicadoresFinanceiros.saldo.despesaMedia`).
- **Tela:**
  - gráfico de linha do saldo (2 px), com a reserva tracejada e o ponto mais baixo marcado com rótulo;
  - ao passar o mouse, a data, o saldo e os lançamentos do dia;
  - a tabela "Próximos lançamentos";
  - a frase de resumo.

## Morador

- **Mais › Prestação de contas** (`#morador.prestacao`, com o detalhe em `.AAAA-MM`): os meses com resumo publicado.

## Dados

- **Versão:** o armazenamento passa para a 10.
- **Campos novos em `financeiro`:** `contas`, `proximaConta`, `balancetes`, `ajustesMes` e `proximoComentario`.

## Testes

- **Casos:**
  - contas;
  - balancete: totais, encadeamento dos saldos e o mês corrente batendo com `saldo`;
  - fechamento por plano;
  - o ciclo do conselho;
  - ajuste;
  - resumo sem unidades;
  - fluxo: ponto mais baixo e projeção das recorrentes;
  - planos.
- **verificar:**
  - as quatro abas;
  - o perfil Conselho;
  - o resumo do morador.
- **e2e:**
  - `contaPagar`;
  - `prestacaoConselho` (Avançado: fechar setembro, o conselho pede correção, o síndico anexa a nota e reenvia, o conselho aprova e o resumo é publicado);
  - `fluxoCaixa`.
