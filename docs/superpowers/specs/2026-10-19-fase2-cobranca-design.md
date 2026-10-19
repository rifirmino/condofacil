# CondoFácil fase 2, parte 1: cobrança, Financeiro do morador, dashboard e planos (design)

Data: 2026-10-19 · Autor: Ricardo Firmino · Bases:
- `CondoFácil V1.2 — Novas Funcionalidades Documentação Funcional Cobrança, Operação e Planos.pdf` (seções 1, 2, 6 e 8)
- `Precificação condomínios.xlsx`
- protótipo atual (`docs/superpowers/specs/2026-10-08-prototipo-navegavel-design.md` e `2026-10-08-vendas-entre-moradores-design.md`)

## Objetivo

Prototipar no protótipo navegável, tudo simulado, as telas da fase 2 que a documentação manda validar primeiro:
- cobrança da taxa condominial via Asaas;
- aba Financeiro do morador;
- dashboard financeiro do síndico;
- seletor de planos Básico, Intermediário e Avançado.

Com isso, 3 a 5 síndicos podem validar a divisão dos planos e o preço.

Critério de sucesso: mostrar sem explicações extras os 4 roteiros da seção 7 (emissão, pagamento, régua com baixa manual e troca de plano).

## Decomposição da fase 2

| Parte | Conteúdo | Situação |
|---|---|---|
| 1 | Cobrança, Financeiro do morador, dashboard e seletor de plano | **este documento** |
| 2 | Acordos de inadimplência | próxima |
| 3 | Notificações do morador com SLA + OS do zelador + compras | depois |
| 4 | Escala de porteiros | depois |

Fora desta parte:
- ativação da conta Asaas (o condomínio começa ativado);
- contas a pagar e balancete PDF;
- fluxo de caixa projetado;
- link de pagamento avulso;
- integração real com o Asaas.

## Decisões

| Tema | Decisão |
|---|---|
| Natureza | Simulado no protótipo. O Asaas aparece como avisos ("Asaas → pagamento recebido") |
| Início do síndico | Passa a ser o dashboard financeiro, com "Precisa da sua atenção" logo abaixo |
| Menu do síndico | Item novo "Cobrança", com 4 abas: Prévia e emissão, Cobranças emitidas, Régua, Parâmetros |
| Barra do morador | "Avisos" sai da barra e dá lugar a "Financeiro". Avisos vira um cartão no Início e um item em "Mais" |
| Plano | Seletor na barra da demonstração. Padrão: Intermediário. O que o plano não libera aparece como "Disponível no plano X", nunca some |
| Código | Telas financeiras em arquivos novos. `sindico.js` não cresce |

## 1. Dados

Dinheiro em centavos. Datas relativas a "hoje", como o resto do protótipo.

### 1.1 Unidades e responsável financeiro
- `tipo` de unidade: `'A'` (101 a 704, 28 unidades) ou `'cobertura'` (801 a 804).
- `responsavel` por unidade: `{ nome, documento (mascarado), relacao: 'titular' | 'inquilino' | 'proprietario', canais }` ou `null`.
  - Unidades com morador cadastrado: o próprio morador é o titular, exceto as duas abaixo.
  - 104 (Juliana, inquilina): o responsável é **Carlos Andrade, proprietário**.
  - 202: **Helena Prado, proprietária não residente**.
  - Demais unidades sem morador: responsável fictício com nome próprio, como "Proprietário apto 503: Márcio Lopes".
  - **403: `null`** (sem responsável).

### 1.2 Parâmetros
- Vencimento no dia 10, fechamento no dia 20.
- Multa de 2% e juros de 1% ao mês.
- Desconto de pontualidade de 0%, com `descontoAprovadoEm` vazio.
- Formas aceitas: boleto, Pix e cartão. Tarifa paga pelo condomínio.

### 1.3 Composição

| Componente | Regra | Valor |
|---|---|---|
| Ordinária | Por tipo | A: R$ 650,00 · cobertura: R$ 980,00 |
| Fundo de reserva | 10% da ordinária | A: R$ 65,00 · cobertura: R$ 98,00 |
| Taxa extra "Pintura da fachada" | R$ 48.000 em 10x, rateio igual | R$ 150,00 por unidade. Outubro foi a parcela 3/10 e novembro é a 4/10 |
| Avulso | Taxa do salão do apto 104 | R$ 150,00 na competência de novembro |
| Crédito | Pagamento em duplicidade do apto 301 | −R$ 50,00 em novembro |

Total típico de um apto A em novembro: **R$ 865,00**. Cobertura: **R$ 1.228,00**.

### 1.4 Cobranças

Formato da cobrança:
```
{ id, unidade, competencia: 'AAAA-MM', vencimento: 'AAAA-MM-DD',
  itens: [{ tipo: 'ordinaria'|'fundo'|'extra'|'avulso'|'credito', descricao, valor }],
  valor, status: 'aberta'|'paga'|'cancelada', pagaEm, forma: 'pix'|'boleto'|'cartao'|'manual'|null,
  baixaManual: null | { por, comprovante, em }, eventosAsaas: [idEvento], regua: [{ etapa, em }],
  substituiu: idCobrancaCancelada | null }
```

Uma cobrança é "vencida" quando está `aberta` e o vencimento já passou. Isso é calculado, não fica gravado.

**Cobranças iniciais.** A competência vigente é a de outubro; chamamos de V o vencimento dela, que é hoje − 9 dias.
- **Outubro (V):** 31 cobranças (todas as unidades menos a 403).
  - São 28 pagas, com datas variadas entre V − 5 e V + 2.
  - Ficam abertas as da **503, 704 e 202**.
  - A régua já registrou as etapas "5 dias antes" e "no vencimento" para as abertas. As etapas de atraso ainda não foram enviadas, para o roteiro 3 ter o que disparar.
- **Setembro (V − 1 mês):** só as cobranças em aberto da **704 e da 202**, mais as pagas da 302, para o histórico da Ana.
- **Agosto (V − 2 meses):** aberta da **202** e paga da 302.
- **Novembro:** ainda não emitida. Aparece só na prévia.

### 1.5 Histórico agregado e caixa
- `saldoInicial`: R$ 48.350,00. Os recebimentos feitos na demonstração somam a ele.
- Receitas e despesas dos 12 meses anteriores (agregados fixos):
  - receitas entre R$ 26.000 e R$ 28.500;
  - despesas entre R$ 17.000 e R$ 19.000, exceto **julho, com R$ 29.400** (troca da bomba de recalque).
- Despesas de outubro por categoria: pessoal R$ 9.800, concessionárias R$ 3.900, manutenção R$ 2.300, administração R$ 1.200, seguro e outros R$ 900. Total: R$ 18.100.
- Orçamento mensal por categoria: pessoal R$ 9.500, concessionárias R$ 4.200, manutenção R$ 2.000, administração R$ 1.200, seguro e outros R$ 1.000. Total: R$ 17.900.

### 1.6 Auditoria
`auditoria: [{ em, quem, acao, detalhe }]`, uma entrada por emissão, cancelamento, reemissão, baixa manual ou alteração de parâmetro.

### 1.7 Plano
`estado.plano`: `'basico' | 'intermediario' | 'avancado'`. Padrão: `'intermediario'`.

## 2. Regras (funções puras, `src/cobranca/regras.js`)

| Função | Regra |
|---|---|
| `valorAtualizado(cobranca, parametros, hoje)` | Paga ou não vencida: o valor. Vencida: valor + multa (multa% × valor) + juros (juros% ao mês ÷ 30 × dias de atraso × valor), arredondado ao centavo. Devolve `{ total, multa, juros, dias }` |
| `situacao(cobranca, hoje)` | `paga`, `cancelada`, `vencida` ou `aberta` |
| `validarParametros(p)` | Multa > 2%: "A multa por atraso é limitada a 2% (Código Civil, art. 1.336)". Desconto > 0 sem `descontoAprovadoEm`: "Informe a ata ou cláusula que aprova o desconto". Vencimento e fechamento entre 1 e 28 |
| `previaCompetencia(estado, competencia)` | Uma linha por unidade, com itens da seção 1.3 (ordinária, fundo, parcela da extra, avulsos e créditos daquela competência) e total. Unidade sem responsável ou sem documento sai com `bloqueada: true, motivo: 'Sem responsável financeiro'` |
| `etapaRegua(cobranca, hoje)` | Etapa alcançada: `antes5` (D−5), `vencimento` (D0), `atraso1` (D+1), `atraso15`, `atraso30`, `atraso60`; ou `null`. Cobrança paga ou cancelada devolve `null` |
| `etapasNoPlano(plano)` | Básico: `antes5` e `vencimento`. Intermediário: `antes5`, `vencimento`, `atraso1`, `atraso15` e `atraso60`. Avançado: todas, inclusive `atraso30` (notificação formal em PDF) |
| `pendentesDaRegua(estado, hoje, plano)` | Para cada cobrança vencida ou a vencer: a etapa **mais avançada já alcançada e permitida no plano**, se ainda não está em `cobranca.regua`. Exemplos no Intermediário: 503 (9 dias) → `atraso1`; 704 setembro (39 dias) → `atraso15`; 202 agosto (70 dias) → `atraso60` |
| `devedores(estado, hoje)` | Uma linha por unidade com cobranças vencidas: responsável, quantidade, valor atualizado, dias do débito mais antigo e etapa mais avançada |
| `indicadores(estado, hoje)` | Saldo (`saldoInicial` + recebido na sessão); arrecadado da competência vigente (pago ÷ emitido, em valor e %); inadimplência (unidades com vencida ÷ 32 e valor); despesas do mês e desvio do orçado; mais os alertas da seção 6.1 da documentação |
| `liberado(plano, recurso)` | Lê a tabela de `src/planos.js` |
| `podeOperar(perfil)` | Só `sindico` emite, cancela e dá baixa manual |

## 3. Ações (puras, `src/cobranca/acoes.js`)

Cada ação devolve `{ estado, notificacao?, erro? }` e registra a auditoria quando aplicável.

| Ação | Efeito |
|---|---|
| `salvarParametros(estado, p, agora)` | Valida e grava |
| `editarItemPrevia(estado, competencia, unidade, itens)` | Ajusta a prévia antes de emitir. A cobrança ainda não existe, então não há cancelamento |
| `emitirCompetencia(estado, competencia, agora)` | Cria uma cobrança por linha não bloqueada da prévia. Se a competência já foi emitida: "Competência já emitida". Aviso: "App + e-mail + WhatsApp → 31 responsáveis" |
| `confirmarPagamentoAsaas(estado, idCobranca, idEvento, forma, agora)` | Se `idEvento` já está em `eventosAsaas`, devolve o estado sem mudança (idempotência). Caso contrário, marca como paga, guarda forma e data, soma ao saldo e avisa "Asaas → pagamento recebido · recibo enviado a {responsável}" |
| `baixaManual(estado, idCobranca, { data, comprovante }, quem, agora)` | Exige comprovante ("Anexe o comprovante"). Marca paga, `forma: 'manual'` |
| `cancelarEReemitir(estado, idCobranca, itens, agora)` | Cancela a original e cria uma nova com `substituiu` |
| `executarRegua(estado, agora)` (usa `pendentesDaRegua` com o plano atual) | Registra em cada cobrança pendente a etapa alcançada. O aviso resume quantos responsáveis receberam e por quais canais |
| `trocarPlano(estado, plano)` | Muda `estado.plano` |

## 4. Telas do síndico (`src/ui/financeiro-sindico.js`)

### 4.1 Início (dashboard)
O dashboard substitui o conteúdo de `SInicio`. "Precisa da sua atenção" continua embaixo.

- **Números** (quadros como os atuais):
  - Saldo em caixa;
  - Arrecadado em outubro, com "R$ X de R$ Y", e a linha "Novembro: N de 31 pagas" depois da emissão;
  - Inadimplência, "3 de 32" com o valor;
  - Despesas do mês, com o desvio em relação ao orçado.
  - Cada número fica em destaque de alerta quando passa do limite da documentação.
- **Gráfico receitas × despesas, 12 meses** (barras agrupadas, duas séries), com o título "Despesa superou a receita só em julho". Segue o skill `dataviz`: legenda, cores validadas, rótulo direto só no destaque e tabela para leitores de tela.
- **Para onde foi o dinheiro em outubro:** barras horizontais por categoria.
- **Orçado × realizado** (só no Avançado): tabela por categoria com desvio em R$ e %.
- **Devedores:** tabela com unidade, responsável, valor atualizado, dias e etapa da régua.
- **Precisa da sua atenção** ganha:
  - "Emitir cobranças de novembro (fechamento dia 20)", se a competência não foi emitida;
  - "202: débito há mais de 60 dias, avaliar cobrança jurídica".

### 4.2 Cobrança (rota `#sindico.cobranca[.aba]`)
O item "Cobrança" entra no menu.

- **Faixa no topo:** "Conta Asaas ativa · subconta do condomínio. O dinheiro cai direto na conta do condomínio."
- **Prévia e emissão:**
  - tabela da competência de novembro, uma linha por unidade, com o total e a composição que se abre ao tocar;
  - em cada linha, editar valor de item, excluir item e incluir avulso;
  - linha da 403 em destaque, com "Sem responsável financeiro: não será emitida";
  - botão **"Emitir 31 cobranças"**. Depois de emitir, aparece "Novembro emitido em DD/MM".
- **Cobranças emitidas:**
  - filtros por competência e situação;
  - detalhe com itens, valor atualizado, régua já enviada e as ações **Baixa manual** (data e comprovante simulado), **Cancelar e reemitir** e **Enviar 2ª via** (aviso simulado);
  - no fim, a lista de auditoria.
- **Régua:**
  - as 6 etapas com prazo, canal e texto;
  - as etapas fora do plano aparecem como "Disponível no plano X";
  - botão **"Executar a régua de hoje"** com o resumo do que foi enviado.
- **Parâmetros:**
  - formulário da seção 1.2, com validação da seção 2;
  - composição da 1.3: valores por tipo, % do fundo, taxa extra com total e parcelas;
  - no Básico, só aparece "valor fixo por unidade", e fundo e taxa extra mostram "Disponível no Intermediário".

## 5. Telas do morador (`src/ui/financeiro-morador.js`)

- **Barra inferior:** Início, Financeiro, Reservas, Ocorrências, Vendas, Mais.
  - "Mais" ganha o item Avisos.
  - A rota `#morador.avisos` continua funcionando.
- **Início:**
  - cartão "Sua cobrança de {mês}: R$ X · vence em DD/MM", com o botão Pagar;
  - se houver vencida, o cartão mostra "Em atraso" e o valor atualizado;
  - cartão "Avisos: N não lidos".
- **Financeiro**, se a pessoa atual é a responsável financeira da unidade:
  - **Em aberto:** cada cobrança com valor, vencimento, situação e composição. Se vencida, mostra o valor atualizado e "R$ base + multa R$ X + juros R$ Y (N dias)".
  - **Pagar:**
    - **Pix:** QR simulado e copia e cola com o botão Copiar (`navigator.clipboard` com alternativa de seleção);
    - **Boleto:** linha digitável e "Abrir PDF" (prévia simulada);
    - **Cartão:** formulário simulado.
    - Em seguida, o botão **"Simular confirmação do Asaas"**.
  - **2ª via:** sempre com o valor atualizado.
  - **Histórico:** pagas com data, forma e recibo (prévia simulada). Mais a **declaração anual de quitação 2026** (prévia), disponível quando não há vencidas.
- **Financeiro**, se a pessoa não é a responsável (Juliana): o texto "As cobranças do apto 104 vão para o responsável financeiro, Carlos A. (proprietário)". Nenhum valor aparece.
- O morador nunca vê devedores nem a situação de outras unidades.

## 6. Seletor de plano e preço (`src/planos.js`)

- **Barra da demonstração:** "Plano: Básico | Intermediário | Avançado". Ao lado, um botão "Preços" que abre um painel com:
  - implantação de R$ 399 (faixa de 31 a 70 unidades);
  - mensalidade-base de R$ 9,90 × 32 unidades = R$ 316,80;
  - Básico 1,0x = **R$ 316,80/mês**; Intermediário 1,5x = **R$ 475,20/mês**; Avançado 2,2x = **R$ 696,96/mês**;
  - a nota "Tarifas do Asaas por boleto/Pix são do condomínio e aparecem à parte".
- **Recursos por plano:**

| Recurso | Básico | Intermediário | Avançado |
|---|---|---|---|
| `cobranca` (emissão, Pix, boleto, baixa) | ✓ | ✓ | ✓ |
| `composicaoCompleta` (fundo, extra) | — | ✓ | ✓ |
| `reguaCompleta` (etapas 1, 15 e 60 dias depois) | — | ✓ | ✓ |
| `notificacaoFormal` (etapa de 30 dias em PDF) | — | — | ✓ |
| `dashboardCompleto` (despesas, gráfico, categorias, devedores) | — | ✓ | ✓ |
| `orcadoRealizado` | — | — | ✓ |

- No Básico, a etapa `atraso1` fica fora: só lembrete antes e no vencimento, como diz a documentação.
- **Itens "Em breve" no menu do síndico:** Acordos, Notificações e OS, Zelador e Escala, marcados como "Em breve · Intermediário". Não são clicáveis.
- O plano é só da demonstração. Trocar de plano não apaga dados. O que fica bloqueado mostra "Disponível no plano X (+R$ Y/mês)".

## 7. Roteiros de demonstração

1. **Emissão:**
   - O síndico abre Cobrança → Prévia de novembro, vê a 403 em destaque e emite 31 cobranças.
   - Aparece o aviso de envio, e no Início a linha "Novembro: 0 de 31 pagas".
2. **Pagamento:**
   - A Ana vê no Início "Sua cobrança de novembro: R$ 865,00", abre Financeiro e confere a composição.
   - Escolhe Pix e toca em "Simular confirmação do Asaas".
   - A cobrança vira paga e aparece o recibo. No síndico, "Novembro: 1 de 31 pagas" e o saldo sobe R$ 865,00.
3. **Régua e baixa manual:**
   - O síndico executa a régua de hoje e o aviso resume os envios para 503, 704 e 202.
   - Ele dá baixa manual da 503 (outubro) com comprovante, e a inadimplência cai para "2 de 32".
4. **Planos:**
   - Trocar para Básico: o dashboard mostra só os três números e o resto aparece como "Disponível no Intermediário (+R$ 158,40/mês)".
   - Trocar para Avançado: aparece o orçado × realizado.

## 8. Erros

As mensagens aparecem perto do campo ou do botão:
- "A multa por atraso é limitada a 2% (Código Civil, art. 1.336)"
- "Informe a ata ou cláusula que aprova o desconto"
- "Competência já emitida"
- "Anexe o comprovante"
- "Sem responsável financeiro: não será emitida"

## 9. Testes

- `src/casos/cobranca.js` com casos para:
  - o cálculo de multa e juros (inclusive arredondamento);
  - o bloqueio de multa acima de 2% e do desconto sem aprovação;
  - a prévia (31 linhas emitíveis, 403 bloqueada, R$ 865,00 e R$ 1.228,00, avulso do 104 e crédito do 301);
  - a emissão e a "competência já emitida";
  - a confirmação repetida sem duplicar;
  - a baixa manual sem comprovante;
  - as etapas da régua e as pendências por plano;
  - os devedores e os indicadores;
  - a tabela de planos.
- `verificar.mjs` ganha checagens de:
  - dashboard, Cobrança (4 abas) e preço por plano;
  - Financeiro da Ana e da Juliana;
  - Avisos em "Mais".
- `e2e.mjs` ganha os 4 roteiros da seção 7. Os 9 atuais continuam passando. O roteiro `comunicado` passa a abrir os avisos pela nova rota de "Mais".
