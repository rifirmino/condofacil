# Fase 2, parte 7: previsão orçamentária e simulador de taxa (design)

Base: documentação funcional V1.2, seção 7: "Síndico monta o orçamento anual por categoria e vê na hora o valor da taxa por unidade, inclusive com uma margem para inadimplência". Fica no plano Intermediário.

## Escopo

- **Aba "Orçamento"** em Cobrança (`#sindico.cobranca.orcamento`), entre "Taxa e reajustes" e "Parâmetros". Nela o síndico monta a previsão do ano (linhas por categoria e linhas livres) com a margem de inadimplência e vê o cálculo na hora.
- **"Usar no reajuste":** abre o formulário "Nova composição", já preenchido.
- **Previsões salvas:** abrir, salvar por cima, salvar como nova e excluir.
- **Comparação** de duas previsões.
- **"Gerar documento para a AGO":** cria ou atualiza um documento na pasta "Previsão orçamentária".
- **Fora do escopo:**
  - orçamento mês a mês;
  - acompanhamento orçado × realizado da previsão (o Avançado já tem orçado × realizado do mês);
  - aprovação digital do conselho;
  - votação.

## Planos

- `RECURSOS_PLANO.simuladorTaxa = 'intermediario'`.
- **Básico:** a aba mostra "Disponível no plano Intermediário".

## Cálculo (`src/cobranca/orcamento.js`)

- **`linhasDoOrcado(orcamento, pct)`**, em `cobranca/dados.js`: uma linha por `CATEGORIAS_DESPESA`, com valor `round(orcamento[c] × 12 × (1 + pct/100))`.
- **`despesaAnual(linhas)`:** a soma das linhas.
- **`ordinariaNecessaria(linhas, margemPct)`:** `round(despesaAnual / 12 / (1 − margem/100))`.
- **`ordinariaTotal(fin, versao)`:** a soma de `ordinariaDe` das 32 unidades.
- **`candidataDaPrevisao(fin, previsao)`:** uma versão com a vigência da primeira competência não emitida, no modo e com o fundo da versão vigente:
  - **fixo:** cada tipo é multiplicado por `necessaria / ordinariaTotal(vigente)`, com arredondamento;
  - **fração:** `orcamento = necessaria`.
- **`resultadoComTaxaAtual(fin, previsao)`:** `round(ordinariaTotal(vigente) × 12 × (1 − margem)) − despesaAnual`.
- **`compararPrevisoes(fin, a, b)`:** uma linha por nome que aparece nas duas previsões, com o total, a ordinária mensal e a taxa de cada tipo.
- **`margemAtual(estado, hoje)`:** `indicadoresFinanceiros(...).inadimplencia.pct`.
- **Números conferidos:**
  - com 8% e margem de 12,5%, a despesa anual é R$ 231.984,00 e a ordinária necessária é R$ 22.093,71;
  - no modo fixo, o apto tipo A fica com R$ 649,23;
  - com a taxa atual, sobram R$ 276,00 no ano.

## Ações (`src/cobranca/acoes-orcamento.js`)

- **`salvarPrevisao(estado, { id?, ano, nome, linhas, margemPct }, perfil, agora)`:**
  - **Validações:**
    - "Informe o nome da previsão";
    - "Cada linha precisa de nome e valor" (valor ≥ 0 e numérico);
    - "A margem de inadimplência deve ser de 0% a 50%".
  - **Efeito:** com `id`, atualiza a previsão e o `atualizadaEm`; sem `id`, cria a PO-00n.
- **`excluirPrevisao(estado, id, perfil)`.**
- **`gerarDocumentoPrevisao(estado, id, perfil, agora)`:**
  - sem documento ainda, cria `{ pasta: 'Previsão orçamentária', titulo: 'Previsão orçamentária {ano} · {nome}', versoes: [{ versao: 1, data }], visibilidade: 'todos' }`;
  - com documento, acrescenta uma versão.
- **Regra comum:** todas exigem o perfil síndico e o plano.

## Dados (versão 9)

- **`financeiro.previsoes` e `proximaPrevisao`.**
- **Previsão:** `{ id, ano, nome, linhas: [{ categoria | null, nome, valor }], margemPct, criadaEm, atualizadaEm, documento }`.
- **Semente:**
  - PO-001 "Proposta do síndico": 8%, margem de 12,5%;
  - PO-002 "Com obra do telhado": o mesmo, mais a linha "Obra do telhado · R$ 36.000,00";
  - o ano das duas é o seguinte ao da competência vigente.

## Telas (`src/ui/orcamento.js`)

- **Formulário:**
  - ano, nome e a tabela das linhas (com o orçado atual de 12 meses como referência e "Remover" nas linhas livres);
  - "Adicionar linha", "Percentual de reajuste (%)" com o botão "Aplicar reajuste" e "Margem de inadimplência (%)".
- **Resultado na hora:**
  - despesa anual, despesa mensal e ordinária necessária;
  - a `TabelaSimulacao` da aba Taxa e reajustes;
  - "Com a taxa atual, o ano fecha com sobra (ou falta) de R$ X".
- **Botões:** "Salvar previsão" (ou "Salvar alterações" e "Salvar como nova"), "Usar no reajuste" (abre o `FormReajuste`, agora com a prop `inicial`) e "Gerar documento para a AGO" (só com a previsão salva).
- **"Previsões salvas"** e **"Comparar"** (duas seleções e a tabela).

## Testes

- **Casos:**
  - os números conferidos acima;
  - o modo fração;
  - linha livre;
  - os erros;
  - salvar, salvar por cima e excluir;
  - o documento na versão 1 e depois na 2;
  - a comparação;
  - o plano.
- **verificar:** `#sindico.cobranca.orcamento` mostra "Ordinária necessária", "PO-001", "PO-002", "Comparar" e "Obra do telhado".
- **e2e `orcamentoPrevisao`:**
  1. reajuste de 10%;
  2. salvar como nova;
  3. comparar;
  4. gerar o documento e vê-lo em Documentos;
  5. "Usar no reajuste" e confirmar com a ata.
