# Fase 2, parte 5: reajuste da taxa e taxas extras (design)

Base: seção de composição da taxa e matriz de planos da documentação funcional V1.2 ("Valor do orçamento rateado por fração ideal, ou valor fixo por tipo de unidade"; "Valor total aprovado, rateado e parcelado em N meses"). Tudo é simulado no protótipo de arquivo único.

## Escopo

- **Reajuste da ordinária:**
  - por percentual ou por novos valores;
  - com vigência futura, ata obrigatória e simulação antes de confirmar.
- **Troca de modo da ordinária:** valor fixo por tipo ou rateio do orçamento por fração ideal.
- **Fundo de reserva:** percentual editável.
- **Taxas extras:**
  - várias ao mesmo tempo;
  - rateio igual ou por fração ideal;
  - encerramento antes do prazo.
- **Comunicação:** comunicado no mural, aviso individual aos responsáveis financeiros e o cartão "Mudanças na sua taxa" no Financeiro do morador.
- **Histórico e auditoria:** o histórico de composições e taxas, cada uma com a sua ata, e o registro na auditoria do financeiro.
- **Fora do escopo:**
  - edição das frações ideais (vêm da convenção; a tabela é só de leitura);
  - reajuste por índice automático (IGP-M, IPCA);
  - orçamento anual por categoria;
  - antecipação de parcelas;
  - taxa extra só para algumas unidades.

## Planos

- `RECURSOS_PLANO.fracaoIdeal = 'intermediario'` e `RECURSOS_PLANO.taxaExtra = 'intermediario'`. `composicaoCompleta` continua controlando o fundo de reserva.
- **Básico:**
  - pode reajustar o valor fixo por tipo, com simulação, histórico e aviso;
  - o modo fração, o campo do fundo e a seção de taxas extras mostram "Disponível no plano Intermediário".
- O plano muda só as telas. As cobranças continuam com fundo e taxas extras, como hoje.

## Dados (versão 7 do armazenamento)

- **`financeiro.unidades[u].fracao`:** apto tipo A 0,029385 e cobertura 0,044304 (28 × A + 4 × cobertura ≈ 1). Na tela aparecem como 2,9385% e 4,4304%, com o total conferido.
- **`financeiro.composicao`:** `{ versoes: [...], extras: [...] }`. O antigo campo `extra` deixa de existir.
- **Versão da composição:**
  - formato: `{ id: 'CV-003', vigencia: 'AAAA-MM', modo: 'fixo' | 'fracao', ordinaria: { A, cobertura }, orcamento, fundoPct, aprovadoEm, criadaEm, criadaPor }`;
  - no modo fixo usa `ordinaria`, no modo fração usa `orcamento` (centavos por mês). O campo que não se aplica fica `null`.
- **Taxa extra:**
  - formato: `{ id: 'TX-002', descricao, total, parcelas, inicio: 'AAAA-MM', rateio: 'igual' | 'fracao', aprovadoEm, situacao: 'ativa' | 'encerrada', ultimaCompetencia, motivoEncerramento, criadaEm }`;
  - `ultimaCompetencia` só existe na encerrada: é o último mês cobrado, ou `null` se nenhuma parcela chegou a ser cobrada.
- **Dados iniciais** (relativos à competência vigente V):
  - CV-001, a partir de V−18: fixo, A R$ 610,00, cobertura R$ 920,00, fundo 10%, "AGO de 30/03/{ano de V−18}";
  - CV-002, a partir de V−6: fixo, A R$ 650,00, cobertura R$ 980,00, fundo 10%, "AGO de 28/03/2026, item 3", com o ano sempre igual ao de V−6;
  - TX-001 "Pintura da fachada": R$ 48.000,00 em 10x a partir de V−2, rateio igual, "AGE de {dia 15 de V−3}";
  - todas as cobranças semente ficam com os mesmos valores de hoje.

## Regras (`src/cobranca/composicao.js`)

- **`primeiraNaoEmitida(fin)`:** o mês seguinte à maior competência em `fin.emitidas`.
- **`versaoEm(fin, competencia)`:** a versão com a maior `vigencia ≤ competencia`.
- **`versaoAnterior(fin, vigencia)`:** a versão que valeria em `vigencia` ignorando uma versão com exatamente essa vigência. É a base do reajuste e o "antes" da simulação.
- **`ordinariaDe(fin, versao, unidade)`:**
  - fixo: `versao.ordinaria[tipo]`;
  - fração: `Math.round(versao.orcamento × fracao)`.
- **`parcelaDe(fin, extra, competencia)`:**
  - devolve o número da parcela (1 a N) ou `null`;
  - devolve `null` se o mês for anterior ao início, posterior à última parcela ou posterior a `ultimaCompetencia` numa taxa encerrada.
- **`valorExtraDe(fin, extra, unidade)`:**
  - igual: `Math.round(total / parcelas / nº de unidades)`;
  - fração: `Math.round(total / parcelas × fracao)`.
- **`itensBase(fin, unidade, competencia)`:**
  - devolve a ordinária e o "Fundo de reserva (N%)" da versão em vigor;
  - mais um item por taxa extra com parcela no mês: "Descrição (parcela k/N)";
  - substitui a antiga `itensBase(composicao, tipo, competencia)`. `previaCompetencia` passa a chamá-la com `fin`.
- **`mensalDe(fin, versao, unidade)`:** ordinária mais fundo.
- **`simularComposicao(fin, nova)`:**
  - devolve, por tipo de unidade, `{ tipo, antes, depois, diferenca, pct }` (ordinária mais fundo de uma unidade daquele tipo);
  - devolve também `{ arrecadacaoAntes, arrecadacaoDepois }`: a soma de ordinária mais fundo de todas as unidades.
- **`mudancasAgendadas(fin)`:** as versões com vigência a partir da primeira não emitida, mais as taxas ativas que começam a partir dela.
- **`mudancasDaUnidade(estado, unidade, hoje)`:** as linhas do cartão do morador:
  - **reajuste agendado:** "A partir de novembro/2026: de R$ 715,00 para R$ 760,50 (+6,4%) · aprovado na …";
  - **taxa ativa que ainda tem parcelas a partir da primeira não emitida:** "Troca dos elevadores: R$ 312,50 por mês em 12 parcelas, de dezembro/2026 a novembro/2027", com "(fração 2,9385%)" no rateio por fração;
  - **taxa encerrada nos últimos 60 dias:** "A taxa X foi encerrada; a última parcela foi a de outubro/2026", ou "… foi cancelada antes da primeira parcela".
- **`alertasComposicao(estado)`:** "Reajuste agendado para {mês} · confira a prévia antes de emitir", para cada versão agendada.

## Ações (`src/cobranca/acoes-composicao.js`)

Todas exigem o perfil síndico (`SO_SINDICO`) e devolvem `{ estado, notificacao?, erro?, id? }`.

- **`novaComposicao(estado, dados, perfil, agora)`:**
  - **Campos de `dados`:** `vigencia`, `modo`, `forma` (`'percentual' | 'valores'`), `pct`, `ordinaria`, `orcamento`, `fundoPct`, `aprovadoEm`, `publicar` (padrão `true`).
  - **Validações:**
    - "Informe a ata ou data da assembleia";
    - "A vigência deve ser a partir de {mês}" (antes da primeira não emitida);
    - "Informe um percentual ou valores válidos" (valores ≤ 0, percentual não numérico ou abaixo de −50);
    - "O fundo de reserva deve ser de 0% a 30%".
  - **Percentual:** aplica sobre a versão anterior, arredondando em centavos cada valor (cada tipo no fixo, o orçamento no fração). Se o modo mudar junto, o percentual não é aceito ("Ao trocar o modo, informe os valores").
  - **Mesma vigência:** uma versão com a mesma vigência é substituída.
  - **Ajustes manuais:** apaga `ajustesPrevia` de toda competência ≥ vigência e informa quantos ajustes manuais foram desfeitos.
  - **Comunicado:** com `publicar`, publica pelo `publicarComunicado` (tipo `assembleia`, público todos, canais app e e-mail) com o título "Reajuste da taxa condominial a partir de {mês}" e o texto com o valor de cada tipo, a vigência e a ata.
  - **Auditoria:** "Reajuste da taxa: {mês} · {resumo} · {ata}".
  - **Notificação:** canal "App + e-mail + WhatsApp"; para "{N} responsáveis"; texto "Reajuste a partir de {mês} avisado" (mais " e publicado no mural" com `publicar`).
- **`cancelarComposicao(estado, id, perfil, agora)`:**
  - só para uma versão agendada; senão, "Esta competência já foi emitida";
  - registra na auditoria e não avisa ninguém.
- **`criarTaxaExtra(estado, dados, perfil, agora)`:**
  - **Campos de `dados`:** `descricao`, `total`, `parcelas`, `inicio`, `rateio`, `aprovadoEm`, `publicar`.
  - **Validações:**
    - "Informe a descrição";
    - "Informe o valor total";
    - "As parcelas devem ser de 1 a 60";
    - "O início deve ser a partir de {mês}";
    - "Informe a ata ou data da assembleia".
  - **Efeitos:** os mesmos de `novaComposicao`, com o título "Taxa extra: {descrição}" e o texto com o valor por parcela de cada tipo e o período. Também apaga os ajustes manuais das competências afetadas.
- **`encerrarTaxaExtra(estado, id, motivo, perfil, agora)`:**
  - **Validações:** "Só taxas ativas podem ser encerradas" e "Informe a ata ou o motivo".
  - **Efeito:** `ultimaCompetencia` passa a ser o último mês já emitido que teve parcela, ou `null`.
  - **Avisos:** avisa os responsáveis e registra na auditoria.

## Telas

- **Síndico, Cobrança, nova aba "Taxa e reajustes"** (`#sindico.cobranca.taxas`, entre Régua e Parâmetros). A "Composição da taxa" sai de Parâmetros. A aba tem:
  - **Em vigor:** modo, valor por tipo (ou orçamento e valor por tipo), fundo e taxas ativas com a parcela do mês;
  - **Agendado:** cada versão agendada com "Cancelar";
  - **Nova composição:** formulário com vigência (12 meses a partir da primeira não emitida), modo, forma, valores, fundo, ata, "Publicar comunicado" e a simulação ao vivo, com a tabela por tipo e a arrecadação antes e depois. O botão é "Confirmar reajuste";
  - **Taxas extras:** a lista com situação, parcelas, valor por unidade e "Encerrar" (pede a ata ou o motivo). O formulário "Nova taxa extra" mostra o valor por parcela de cada tipo ao vivo;
  - **Histórico:** as versões e as taxas encerradas, em ordem decrescente, com a ata;
  - **Frações ideais:** um `<details>` com a tabela de unidade, tipo e fração, e o total.
- **Morador, Financeiro:** o cartão "Mudanças na sua taxa", acima da lista de cobranças, aparece quando há linhas.
- **Síndico, Início:** inclui `alertasComposicao`.

## Testes

- **Casos** (`src/casos/composicao.js`):
  - a semente mantém os valores das cobranças;
  - `versaoEm` escolhe a versão certa;
  - o reajuste de 6% em novembro arredonda por tipo e não altera as cobranças emitidas;
  - a vigência no passado dá erro;
  - a nova versão com a mesma vigência substitui a anterior;
  - o modo fração com R$ 22.120,00 dá A R$ 650,00 e cobertura R$ 979,99;
  - duas taxas ativas no mesmo mês;
  - o rateio por fração;
  - encerrar corta só as parcelas futuras;
  - os ajustes manuais são desfeitos e contados;
  - o comunicado é publicado só com `publicar`;
  - as linhas do cartão do morador;
  - o alerta;
  - `cancelarComposicao`.
- **`verificar`:**
  - a aba "Taxa e reajustes" mostra "Em vigor", "Pintura da fachada" e "Frações ideais";
  - no Básico aparece "Disponível no plano Intermediário".
- **e2e:**
  - `taxaReajuste`: reajuste de 6% com simulação; confirmar; o selo; a prévia do mês seguinte com o valor novo; o cartão do morador;
  - `taxaExtra`: nova taxa por fração; o selo; encerrar; o histórico.
