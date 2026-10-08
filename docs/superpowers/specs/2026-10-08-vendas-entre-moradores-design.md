# CondoFácil — Vendas entre moradores (design)

Data: 2026-10-08 · Autor: Ricardo Firmino · Base: protótipo navegável (`docs/superpowers/specs/2026-10-08-prototipo-navegavel-design.md`)

## Objetivo

Acrescentar ao protótipo navegável um módulo de vendas entre moradores, como uma feira interna do condomínio (doces, salgados, artesanato, desapego, serviços). Tudo é simulado, como no resto do protótipo. O módulo serve para testar nas entrevistas se essa funcionalidade é um diferencial que faz o síndico querer o app.

Critério de sucesso: mostrar de ponta a ponta, sem explicações extras, os roteiros da seção 6: compra, atendimento pelo vendedor, morador virando vendedor e moderação pelo síndico.

## Decisões

| Tema | Decisão |
|---|---|
| Onde | No protótipo, simulado (sem backend) |
| Dois lados da venda | Seletor "Ana · 302" ou "Juliana · 104" no topo do app do morador; "Ver como" continua com 3 perfis |
| Pagamento | Fora do app. O vendedor informa as formas aceitas, o comprador escolhe uma, e o app só registra o pedido e a marcação "pago" |
| "Aceita receber ofertas" | Controla só os avisos de anúncio novo. Desligado por padrão. A vitrine é aberta a todos |
| Posição no app | Nova aba "Vendas" na barra inferior (6 abas) e cartão "Novidades na vitrine" no Início |
| Síndico | Aprova ou recusa vendedores, suspende e reativa vendedores, oculta anúncios com motivo. Não lê conversas nem detalhes de pedidos |
| Painel do vendedor | Vendas por período: 7 dias, 30 dias ou mês atual |

## 1. Dados

Valores em dinheiro são guardados em centavos (inteiros) e formatados como `R$ 18,00`.

**Pessoa** ganha dois campos:
- `recebeOfertas: boolean`. Padrão `false`.
- `vendedor: 'nao' | 'pendente' | 'aprovado' | 'suspenso'`.
- Ao pedir para vender, a pessoa também registra `pedidoVenda: { texto, em }`, em que `texto` é o que pretende vender (obrigatório).
- `motivoVendedor` guarda o motivo de uma recusa ou suspensão.

**Anúncio** `{ id, vendedor (unidade), titulo, descricao, categoria, preco, quantidade, pagamentos[], entregas[], ativo, oculto, motivoOculto, criadoEm }`:
- `categoria` ∈ doces, salgados, artesanato, desapego, servicos.
- `pagamentos` ⊂ pix, dinheiro, cartao (cartão na entrega). `entregas` ⊂ retirar (no apartamento do vendedor), porta (entrega na porta).
- `ativo = false` significa pausado pelo vendedor. `oculto = true` significa ocultado pelo síndico.

**Pedido** `{ id: 'PD-0NN', comprador, vendedor, itens: [{ anuncioId, titulo, quantidade, preco }], pagamento, entrega, status, pago, motivo, linha: [{ em, status, texto }], mensagens: [{ autor (unidade), texto, em }], criadoEm, entregueEm }`:
- `status` ∈ novo, aceito, entregue, recusado, cancelado.

**Estado da demonstração** ganha:
- `moradorAtual: '302' | '104'`. Começa em `'302'`.
- `sacola: [{ anuncioId, quantidade }]`, que é da pessoa atual. Trocar de morador limpa a sacola.
- `proximoPedido`.

**Dados iniciais:**
- **Vendedores:**
  - Juliana Costa (104), aprovada.
  - Fernando Alves (201), aprovado.
  - Paulo Ribeiro (102), pendente, com o pedido "Salgados assados para festas" feito ontem.
  - Os demais moradores aparecem como `nao`.
- **Aceitam ofertas:** 101, 203, 301, 401, 404, 501, 601, 702 e 703 (9 unidades). Ana (302) e Juliana (104) começam sem aceitar.
- **Anúncios:**
  - Juliana: "Brigadeiro gourmet (caixa com 6)", doces, R$ 18,00, 10 unidades, Pix ou dinheiro, retirar ou porta.
  - Juliana: "Bolo de pote de ninho com morango", doces, R$ 12,00, 6 unidades, Pix, retirar.
  - Fernando: "Bicicleta infantil aro 16", desapego, R$ 150,00, 1 unidade, Pix, dinheiro ou cartão, retirar.
- **Histórico da Juliana:** 10 pedidos entre hoje−44 e hoje−1 (PD-001 a PD-010), de compradores variados.
  - 8 entregues e pagos, com dias e itens distribuídos para o painel ter barras variadas.
  - 1 recusado ("Sem ingredientes nesta semana").
  - 1 cancelado.
  - `proximoPedido = 11`.

## 2. Regras de negócio (funções puras, `src/vendas/regras.js`)

| Função | Regra |
|---|---|
| `podePublicar(estado, unidade)` | Só vendedor `aprovado` |
| `anunciosVisiveis(estado)` | Ativos, não ocultos e de vendedor `aprovado`, do mais recente ao mais antigo. Esgotados aparecem marcados |
| `podeAdicionar(estado, unidade, anuncioId, quantidade)` | Não pode ser o próprio anúncio ("Você não pode comprar o próprio anúncio"); a soma com o que já está na sacola não passa do disponível ("Só restam N unidades"); quantidade ≥ 1 |
| `sacolaPorVendedor(estado)` | Agrupa a sacola por vendedor, com o subtotal de cada um e as opções de pagamento e entrega comuns aos anúncios daquele vendedor |
| `validarAnuncio(dados)` | Título, preço e quantidade obrigatórios ("Preencha título, preço e quantidade"); preço > 0 ("Preço precisa ser maior que zero"); quantidade ≥ 0; ao menos uma forma de pagamento e uma de entrega |
| `acoesPedido(pedido, unidade)` | Vendedor: novo → aceitar ou recusar; aceito → marcar entregue; marcar pago enquanto não pago e não recusado/cancelado. Comprador: cancelar enquanto `novo`. Os dois podem conversar enquanto o pedido não estiver recusado ou cancelado |
| `painelVendas(estado, vendedor, periodo, agora)` | Ver seção 2.1 |
| `destinatariosOfertas(estado, vendedor)` | Unidades com `recebeOfertas`, exceto a do vendedor |

### 2.1 Painel de vendas

O `periodo` pode ser `'7d'` (últimos 7 dias, incluindo hoje), `'30d'` (últimos 30 dias, incluindo hoje) ou `'mes'` (do dia 1 do mês atual até hoje).

Cálculos:
- **Pedidos:** pedidos do vendedor com `criadoEm` no período, em qualquer situação.
- **Faturamento:** soma dos pedidos `entregue` com `entregueEm` no período.
- **Ticket médio:** faturamento ÷ número de pedidos entregues no período (zero se não houver).
- **Itens vendidos:** soma das quantidades dos pedidos entregues no período.
- **Barras:** faturamento por dia em `'7d'`; por semana em `'30d'` e `'mes'`, em blocos de 7 dias contados a partir do início do período. O rótulo de cada barra é a data inicial do dia ou bloco.
- **Mais vendidos:** até 3 produtos por quantidade, entre os pedidos entregues no período.
- **Por situação:** contagem de entregues, em andamento (novo ou aceito), recusados e cancelados no período (por `criadoEm`).

## 3. Ações (puras, `src/vendas/acoes.js`)

Cada ação devolve `{ estado, notificacao?, erro?, id? }`, como as ações existentes.

| Ação | Efeito e aviso |
|---|---|
| `trocarMorador(estado, unidade)` | Muda `moradorAtual` e limpa a sacola |
| `alternarOfertas(estado, unidade)` | Inverte `recebeOfertas` |
| `pedirParaVender(estado, unidade, texto, agora)` | `nao` → `pendente`. Texto obrigatório ("Conte o que você pretende vender"). Aviso Push → síndico |
| `aprovarVendedor(estado, unidade)` / `recusarVendedor(estado, unidade, motivo)` | `pendente` → `aprovado` ou `nao`. Recusar exige motivo. Aviso WhatsApp → morador |
| `suspenderVendedor(estado, unidade, motivo)` / `reativarVendedor(estado, unidade)` | `aprovado` ↔ `suspenso`. Suspender exige motivo. Aviso → morador |
| `publicarAnuncio(estado, unidade, dados, agora)` | `podePublicar` + `validarAnuncio`. Aviso "Push → N moradores que aceitam ofertas" (se N = 0, nenhum aviso) |
| `editarAnuncio(estado, unidade, id, { preco, quantidade, ativo })` | Só o dono; mesma validação |
| `ocultarAnuncio(estado, id, motivo)` / `mostrarAnuncio(estado, id)` | Pelo síndico. Ocultar exige motivo. Aviso → vendedor |
| `adicionarASacola(estado, anuncioId, quantidade)` / `removerDaSacola(estado, anuncioId)` | Usa `podeAdicionar` com a pessoa atual |
| `fecharPedido(estado, escolhas, agora)` | `escolhas = { [vendedor]: { pagamento, entrega } }`. Valida que cada vendedor da sacola tem pagamento e entrega escolhidos entre os aceitos ("Escolha a forma de pagamento" / "Escolha a forma de entrega") e revalida o estoque. Cria um pedido por vendedor, desconta o estoque, esvazia a sacola. Um aviso WhatsApp para o vendedor do primeiro pedido criado; se houver mais de um, o texto diz "e mais N pedidos" |
| `aceitarPedido`, `recusarPedido(…, motivo)`, `marcarEntregue`, `marcarPago`, `cancelarPedido` | Seguem `acoesPedido`. Recusar e cancelar devolvem o estoque. Recusar exige motivo ("Informe o motivo da recusa"). Cada mudança registra uma entrada na linha do tempo e avisa a outra parte |
| `enviarMensagem(estado, pedidoId, unidade, texto, agora)` | Só comprador ou vendedor do pedido; texto obrigatório. Aviso Push → outra parte |

## 4. Telas do morador (`src/ui/vendas.js`)

**Seletor de morador:** fica no topo do app, sobre o conteúdo, com as opções "Ana · 302" e "Juliana · 104". Ao trocar, o app mostra o nome, as encomendas, as reservas e as ocorrências da pessoa escolhida.

As telas existentes do morador passam a usar a unidade atual no lugar da constante `UNIDADE_ANA`. Juliana tem dados próprios suficientes: uma reserva futura e nenhuma encomenda.

**Aba "Vendas"** (rotas `#morador.vendas…`):
- **Vitrine:**
  - chips de categoria e uma busca;
  - cartões com foto simulada, título, preço, "Restam N" ou "Esgotado" e "Nome · apto";
  - botão da sacola com contador no topo.
- **Detalhe do anúncio:** descrição, formas de pagamento e entrega, seletor de quantidade e o botão "Adicionar à sacola".
- **Sacola:**
  - um grupo por vendedor, com itens, subtotal e a escolha de pagamento e entrega;
  - o total geral e o botão "Fechar pedido".
- **Meus pedidos:** lista com a situação de cada pedido. O detalhe tem a linha do tempo, a conversa e "Cancelar pedido" enquanto estiver `novo`.
- **Área do vendedor**, só para quem está `aprovado`, com três abas:
  - **Pedidos recebidos:** os novos em destaque. O detalhe tem os botões do `acoesPedido` e a conversa.
  - **Meus anúncios:** "Novo anúncio" e, em cada anúncio, preço, quantidade, pausar/retomar e o motivo, se oculto.
  - **Painel:** seletor de período, quatro números, gráfico de barras, mais vendidos e contagem por situação.
- **Quem não é vendedor** vê o convite "Quer vender para os vizinhos?":
  - com `nao`, ele traz o campo "O que você pretende vender?" e o botão "Pedir para vender";
  - com `pendente`, mostra "Aguardando aprovação do síndico";
  - com `suspenso`, mostra o motivo.

**Mais → Minhas preferências:**
- interruptor "Receber avisos de novos anúncios";
- situação de vendedor.

**Início:** cartão "Novidades na vitrine" com os 2 anúncios visíveis mais recentes e um link para a aba.

Barra inferior com 6 abas: Início, Reservas, Avisos, Ocorrências, Vendas e Mais.

## 5. Telas do síndico (`src/ui/sindico.js`)

- **Início:** "Precisa da sua atenção" ganha "Aprovar vendedor: Nome, apto N" para cada pendente.
- **Item novo "Vendas" no menu:**
  - Topo: números agregados do mês (pedidos e vendedores ativos).
  - **Solicitações:** nome, apartamento, data e o texto do morador, com Aprovar e Recusar (motivo).
  - **Vendedores:** situação, anúncios ativos e pedidos no mês. Ações: Suspender (motivo) e Reativar.
  - **Anúncios:** todos os anúncios, com Ocultar (motivo) e Mostrar.
- O síndico não vê conversas, itens nem valores de pedidos individuais.

## 6. Roteiros de demonstração

1. **Compra:**
   - Ana põe 2 brigadeiros e 1 bolo de pote na sacola, escolhe Pix e retirar no 104, e fecha o pedido.
   - Aparece o aviso para a Juliana, e o estoque do brigadeiro cai de 10 para 8.
2. **Atendimento:**
   - A demonstração troca para Juliana. Ela aceita o pedido e escreve "Pode passar às 18h".
   - De volta à Ana, ela vê a mensagem e a situação "Aceito".
   - Juliana marca o pedido como entregue e pago, e o faturamento de 7 dias do painel aumenta em R$ 48,00.
3. **Virar vendedora:**
   - Ana pede para vender ("Bolos caseiros por encomenda"), o síndico aprova e Ana vê a área do vendedor.
   - Ela publica "Bolo de cenoura com chocolate", e o aviso diz "9 moradores".
4. **Moderação:** o síndico oculta um anúncio do Fernando com motivo, e o anúncio some da vitrine. Na área do Fernando aparece o motivo; isso é conferido nos testes de ação, não no e2e.

## 7. Erros

As mensagens aparecem perto do campo ou do botão: "Só restam N unidades", "Você não pode comprar o próprio anúncio", "Escolha a forma de pagamento", "Escolha a forma de entrega", "Informe o motivo da recusa", "Preencha título, preço e quantidade", "Preço precisa ser maior que zero", "Conte o que você pretende vender".

## 8. Testes

- `src/casos/vendas.js` com casos para:
  - cada regra da seção 2;
  - o painel por período, com o histórico fixo em `AGORA_TESTE`;
  - as ações da seção 3, incluindo devolver o estoque ao recusar e ao cancelar, e a sacola com dois vendedores.
- Os casos entram no `node --test` e no autoteste `?teste=1`.
- `verificar.mjs` ganha checagens das telas novas:
  - vitrine, sacola e painel do vendedor;
  - Vendas do síndico;
  - "Aprovar vendedor" no Início.
- `e2e.mjs` ganha os roteiros 1 a 3. Os 6 roteiros atuais continuam passando, incluindo a largura de 390 px nas telas novas.

## Fora do escopo

Pagamento dentro do app, avaliação de vendedores, upload real de fotos, notificações reais, e anúncios de serviços com agenda.
