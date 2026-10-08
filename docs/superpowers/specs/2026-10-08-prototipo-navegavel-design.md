# CondoFácil — Protótipo navegável do MVP (design)

Data: 2026-10-08 · Autor: Ricardo Firmino · Base: `CondoFácil — Especificação Funcional do SaaS para Condomínios.pdf`

## Objetivo

Protótipo clicável do MVP para as entrevistas de validação com 10 a 15 síndicos (dores e preço). Sem backend. Depois de pronto, o visual será refinado numa rodada separada com o skill `frontend-design`.

Critério de sucesso: em uma entrevista, mostrar de ponta a ponta os 4 roteiros da seção 5, alternando entre os perfis, sem travar e sem precisar explicar "isso aqui ainda não funciona".

## Decisões

| Tema | Decisão |
|---|---|
| Perfis | Síndico (desktop), Morador (moldura de celular) e Portaria (moldura de tablet), com um seletor "Ver como" |
| Entrega | Um único arquivo `prototipo/condofacil.html`, publicado como link privado do claude.ai |
| Módulos | Reservas, Comunicados, Ocorrências, Documentos, Encomendas e o Início do síndico com indicadores |
| Tecnologia | Preact + htm via CDN, com versão fixa, sem build |
| Fora do escopo | Login/OTP, onboarding por planilha ou QR, pagamentos, envio real de notificações, upload real, acessibilidade completa, visual refinado |

## 1. Estrutura e navegação

**Barra de demonstração** (fixa no topo, com visual neutro e separado do produto):
- Logo · "Residencial Ipê Amarelo · 32 unidades"
- Seletor "Ver como": Síndico · Morador · Portaria
- Botão "Reiniciar demonstração", que restaura os dados iniciais
- Selo de notificação: uma mensagem temporária (cerca de 4 s) que simula o push ou WhatsApp quando uma ação de um perfil notifica outro

**Molduras por perfil:**
- Síndico: painel desktop com menu lateral (Início, Reservas, Comunicados, Ocorrências, Documentos, Encomendas).
- Morador: moldura de celular (390×800) centralizada, com abas inferiores (Início, Reservas, Avisos, Ocorrências, Mais). "Mais" leva a Documentos e Encomendas.
- Portaria: moldura de tablet na horizontal, com botões grandes e três ações (Registrar encomenda, Entregar encomenda, Reservas de hoje).
- Com a janela abaixo de 900 px de largura, as molduras somem e o perfil ocupa a tela inteira.

**Rotas:** hash `#/<perfil>/<tela>[/<id>]`, por exemplo `#/morador/reservas` ou `#/sindico/ocorrencias/OC-0042`. Cada perfil lembra a última tela visitada.

**Estado:** um objeto `estado` em memória, criado por `dadosIniciais()`. As ações são funções que produzem o novo estado e disparam a re-renderização. O estado é copiado para `localStorage` (chave `condofacil-demo-v1`) a cada mudança e lido na carga, sempre dentro de try/catch; se falhar, a demonstração segue só em memória. "Reiniciar" apaga a chave e recria o estado. O usuário de cada perfil é fixo: Roberto Lima (síndico), Ana Souza (morador, apto 302) e Seu José (portaria).

## 2. Dados fictícios

Todos os nomes são inventados. "Hoje" é a data real do navegador, e os dados são gerados relativos a ela (+N dias), para que a demonstração não "envelheça".

- **Condomínio:** bloco único, 8 andares × 4 apartamentos (101–104 … 801–804) = 32 unidades. Cerca de 20 unidades têm morador cadastrado com app; as demais aparecem como "sem cadastro".
- **Pessoas:** Roberto Lima (síndico, 801), Ana Souza (302), porteiros Seu José (dia) e Marcos (noite), mais cerca de 20 moradores nomeados.
- **Áreas comuns:**

| Área | Tipo | Taxa | Aprovação | Antecedência | Limite | Observação |
|---|---|---|---|---|---|---|
| Salão de festas | Período (tarde 13–18h, noite 18–23h) | R$ 150 | Manual | 2 a 60 dias | 2/mês por unidade | Reservar bloqueia a churrasqueira no mesmo período |
| Churrasqueira | Período (tarde, noite) | R$ 50 | Automática | 1 a 60 dias | 2/mês | Vinculada ao salão |
| Quadra | Por hora (8h–22h) | — | Automática | 0 a 15 dias | 4/mês | — |
| Academia | Por hora (6h–23h) | — | Automática | 0 a 7 dias | sem limite | — |

  Situação inicial: 3 reservas confirmadas, 1 pendente (salão, apto 504, daqui a 10 dias) e 1 bloqueio de manutenção (quadra, daqui a 5 dias).
- **Comunicados (5):**
  - Falta de água (manutenção, fixado; hoje+4, 9h–12h)
  - Assembleia ordinária (assembleia)
  - Festa das crianças (evento)
  - Troca do interfone (aviso geral)
  - Elevador 2 parado (urgente)
  
  Cada um tem a lista de unidades que leram (por exemplo, 19 de 32).
- **Ocorrências (6):**
  - Barulho (anônima, em análise)
  - Vazamento na garagem (em andamento)
  - "Elevador 2 parado" (pública, 7 "eu também")
  - Lâmpada no 5º andar (resolvida, avaliada com 5★)
  - Vaga ocupada (aberta, SLA vencido)
  - Elogio ao porteiro (fechada)
  
  Protocolos `OC-0037` a `OC-0042`, cada um com linha do tempo.
- **Documentos (8):** convenção, regimento interno, ata de mar/2026, ata de set/2026 e balancete de set/2026 nas pastas da especificação, mais AVCB (vence em hoje+25), apólice de seguro (hoje+58) e limpeza da caixa d'água (vencida em hoje−3). Os documentos têm visibilidade por perfil, e o balancete fica restrito ao conselho e ao síndico. Abrir um documento mostra uma prévia simulada.
- **Encomendas (7):** 4 aguardando retirada (2 do 302, uma delas parada há 4 dias) e 3 retiradas. Transportadoras como texto: Correios, Mercado Livre, Amazon, Shopee.

## 3. Telas

### Síndico
- **Início:** cartões com reservas pendentes, ocorrências abertas (com destaque para SLA vencido), encomendas paradas há mais de 3 dias e documentos vencendo em até 60 dias; adesão "20 de 32 unidades com app"; lista "precisa da sua atenção" com links.
- **Reservas:** calendário mensal filtrado por área; fila de pendentes com Aprovar e Recusar (motivo obrigatório); regras de cada área em modo leitura.
- **Comunicados:** lista com barra de leitura. "Novo comunicado" abre um formulário com modelo pronto por tipo, título, texto, público (todos, um andar ou unidades), anexo simulado, canais (push, e-mail, WhatsApp; SMS fica marcado e travado quando o tipo é urgente) e opção de fixar. O detalhe mostra quem leu e quem não leu.
- **Ocorrências:** tabela com protocolo, categoria, unidade (ou "Anônima"), status e SLA, com filtro por status. O detalhe tem linha do tempo, mudança de status (aberta → em análise → em andamento → resolvida → fechada), comentário e o botão Arquivar quando fechada.
- **Documentos:** alertas de vencimento no topo, pastas, versão vigente com histórico e busca por título.
- **Encomendas:** lista com status, destaque para as paradas e o botão "Reenviar lembrete", que dispara o selo de notificação.

### Morador (Ana, 302)
- **Início:** saudação, encomendas aguardando (com o QR Code e o código de 6 dígitos), comunicado fixado, próxima reserva e atalho "Abrir ocorrência".
- **Reservas:**
  1. Escolher a área.
  2. Escolher o dia no calendário (livre, reservado, pendente ou bloqueado; a unidade que reservou não aparece).
  3. Escolher o período ou a hora.
  4. Confirmar: resumo com a taxa, aceite do termo de responsabilidade e lista de convidados opcional (nome e documento).
  5. Solicitar.
  
  "Minhas reservas" permite cancelar, com o aviso de multa quando faltar menos de 72 h.
- **Avisos:** lista e detalhe dos comunicados, com o botão "Li e estou ciente" e as reações "útil" e "dúvida".
- **Ocorrências:** abrir com categoria, descrição, foto simulada, local e as opções "anônima" e "pública", recebendo o protocolo. Mostra a lista das minhas ocorrências e das públicas (com "eu também"), a linha do tempo e a avaliação de 1 a 5★ quando resolvida.
- **Mais → Documentos:** apenas os visíveis ao morador. **Mais → Encomendas:** pendentes com QR e histórico.

### Portaria (tablet)
- **Registrar encomenda:** "Ler etiqueta" simula o OCR e sugere a unidade. O porteiro pode digitar a unidade (com validação contra as 32), escolher a transportadora e tirar a foto simulada antes de Registrar. Isso gera o código de retirada e notifica o morador.
- **Entregar encomenda:** busca por código ou por unidade e exige o nome de quem retirou. Ao confirmar, registra quem retirou, a data e a hora.
- **Reservas de hoje:** área, período, unidade e lista de convidados.

## 4. Regras de negócio (funções puras)

Ficam isoladas das telas e retornam `{ ok: true }` ou `{ ok: false, motivo }`:

| Função | Regra |
|---|---|
| `podeReservar(estado, pedido, agora)` | RN02: sem sobreposição com reserva confirmada ou pendente, nem com bloqueio, incluindo áreas vinculadas; antecedência mínima e máxima da área; RN05: limite mensal por unidade e área |
| `avisoCancelamento(reserva, agora)` | RN04: menos de 72 h para o início gera aviso de multa/retenção da taxa |
| `podeEntregar(encomenda, codigo, nomeRetirada)` | RN06: o código precisa bater; o nome de quem retirou é obrigatório |
| `acoesOcorrencia(ocorrencia)` | RN07: fechada só oferece "Arquivar"; nunca existe "apagar" |
| `alertasDocumentos(documentos, hoje)` | RN13: faixas de 60, 30 e 7 dias e vencido |
| `slaVencido(ocorrencia, agora)` | SLA por categoria (por exemplo, vazamento 24 h, barulho 48 h, lâmpada 72 h) |

Reserva em área de aprovação automática vira "confirmada" na hora; em área manual, fica "pendente" e já trava o horário.

## 5. Roteiros entre perfis

1. **Encomenda:**
   - A portaria registra para o 302 e aparece o selo "WhatsApp → Ana Souza: chegou sua encomenda (Mercado Livre)".
   - O Início da Ana mostra a encomenda com o QR.
   - A portaria entrega pelo código.
   - Os indicadores do síndico se atualizam.
2. **Reserva:**
   - Ana solicita o salão e o horário fica pendente e travado.
   - O síndico aprova ou recusa com motivo.
   - Ana recebe o selo com o resultado.
   - Se a data for hoje, a reserva aparece na portaria.
3. **Ocorrência:**
   - Ana abre e recebe o protocolo.
   - O síndico avança o status e Ana vê a linha do tempo atualizada.
   - Ana avalia quando a ocorrência é resolvida.
4. **Comunicado:**
   - O síndico publica e aparece o selo de envio multicanal.
   - Ana marca "li e estou ciente".
   - O relatório do síndico sobe um leitor.

## 6. Erros e validações

- As mensagens aparecem em português, junto ao campo ou ao botão: "Horário já reservado", "Limite de 2 reservas/mês atingido para esta área", "Reserve com pelo menos 2 dias de antecedência", "Unidade inexistente", "Código inválido", "Informe quem retirou", "Escolha o motivo da recusa".
- Os botões de confirmação ficam desabilitados até os campos obrigatórios serem preenchidos.
- Falha no `localStorage` é silenciosa; a demonstração continua em memória.

## 7. Visual (versão inicial)

Limpo e funcional, pronto para o refinamento do `frontend-design`:
- tokens de cor e espaçamento em `:root`, com modo escuro (`prefers-color-scheme` e `data-theme`);
- fonte do sistema;
- contraste mínimo AA;
- rótulos em todos os campos;
- alvos de toque com pelo menos 44 px (portaria com 64 px ou mais).

Nenhuma marca real é usada.

## 8. Teste

- `?teste=1` roda um autoteste das funções da seção 4, com casos de sucesso e falha para cada regra. O resultado aparece num painel e no console.
- Antes de publicar, os 4 roteiros da seção 5 são percorridos em largura desktop e em largura de celular (390 px), incluindo "Reiniciar demonstração".

## Publicação

Protótipo publicado (link privado): https://claude.ai/artifact/U7U8aKxcxM9A1Hbnb9bv9r

Rotas diretas usam o formato `#perfil.tela.id` (ex.: `#morador.reservas`, `#sindico.ocorrencias.OC-0042`), porque o link do Artifact só repassa âncoras simples.
