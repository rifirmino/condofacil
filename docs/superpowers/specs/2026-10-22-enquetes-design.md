# Enquetes (design)

Base: na especificação funcional, "Enquetes rápidas · decisões simples ('cor da fachada', 'horário da academia') sem assembleia", na fase 2 do roteiro. Somam-se o pedido do Ricardo (pergunta, respostas configuráveis, data limite, aviso, cartão que some depois do voto, painel de evolução e lembretes com os dias restantes) e os quatro extras aprovados:
- voto secreto ou aberto;
- tipos de resposta;
- resultado publicado;
- peso e quórum.

## Planos

- **`enquetes: 'basico'`:**
  - escolha única, data limite, aviso e painel de participação;
  - lembrete manual;
  - o voto é sempre secreto e o resultado só aparece ao morador no encerramento.
- **`enqueteCompleta: 'intermediario'`:**
  - múltipla escolha (até N) e comentário;
  - voto secreto ou aberto e parcial visível;
  - lembretes automáticos (3 dias antes e no último dia);
  - publicação do resultado (comunicado e documento).
- **`enquetePeso: 'avancado'`:** peso por fração ideal e quórum mínimo.

## Dados (versão 11)

- **Novos campos:** `estado.enquetes` e `proximaEnquete`.
- **Enquete:** `{ id, pergunta, contexto, anexo, opcoes: [{ id, texto }], tipo: 'unica' | 'multipla', maxEscolhas, comentarios, publico, criadaEm, abertaEm, encerraEm, situacao: 'rascunho' | 'aberta' | 'encerrada', encerradaEm, secreto, parcialVisivel, peso: 'unidade' | 'fracao', quorumPct, lembretesAuto, lembretes: [{ em, unidades, automatico }], prorrogada, votos: { [unidade]: { opcoes, comentario, autor, em } }, resultado: { publicadoEm, comunicado, documento } | null }`.
- **Situação efetiva:** uma enquete aberta cujo `encerraEm` já passou conta como encerrada.
- **Semente:**
  - **EN-001, aberta:** "Qual horário a academia deve abrir aos domingos?" (6h, 7h ou 8h), secreta e com comentário. Publicada há 3 dias, encerra em 4 dias às 23h59, com 14 unidades votando (a 104 entre elas, a 302 não).
  - **EN-002, encerrada:** "Qual cor para a pintura da fachada?", com peso por fração e quórum de 50%. Teve 22 votos e o resultado publicado em documento na pasta Enquetes.
  - **EN-003, rascunho:** "Instalar bicicletário na garagem?".

## Regras (`src/enquetes/regras.js`)

- **`situacaoEnquete(e, agora)`, `diasRestantes(e, agora)` e `unidadesDoPublico(estado, e)`.**
- **`faltantes(estado, e)`:** as unidades do público que ainda não votaram, com a marca "sem app" (sem pessoa cadastrada).
- **`apuracao(estado, e)`:**
  - para cada opção, `{ id, texto, votos, pct, pesoPct }`;
  - também `participantes`, `total` e `participacaoPct`;
  - `quorumAtingido`;
  - `vencedoras` (uma opção ou empate) e `semQuorum`.
- **`evolucao(e, agora)`:** as respostas acumuladas por dia, da abertura até hoje ou até o encerramento.
- **`proximoLembreteAuto(e, agora)`:** os marcos são o encerramento menos 3 dias às 9h e o último dia às 9h, contando só os que ainda não foram enviados.
- **`alertasEnquetes(estado, agora)`:**
  - "Enquete {pergunta}: termina hoje/amanhã, N unidades sem resposta";
  - "Enquete encerrada: publique o resultado", só no Intermediário.
- **`enquetesPendentes(estado, unidade, agora)`:** as abertas no público da unidade que ela ainda não votou.

## Ações (`src/enquetes/acoes.js`)

- **`salvarEnquete(estado, dados, perfil, agora)`:** cria ou atualiza um rascunho.
  - **Validações:**
    - "Escreva a pergunta";
    - "Informe pelo menos 2 opções";
    - "No máximo 8 opções";
    - "Opções repetidas";
    - "Escolha uma data limite de 1 a 60 dias";
    - "Escolha o público".
  - **Rebaixamento pelo plano:** o que o plano não libera volta ao padrão do Básico.
- **`publicarEnquete(estado, id, perfil, agora)`:** passa o rascunho a aberta e avisa o público (App, e-mail e WhatsApp, com o número de unidades).
- **`votar(estado, id, { unidade, autor, opcoes, comentario }, agora)`:**
  - "A enquete está encerrada";
  - "Sua unidade não faz parte do público desta enquete";
  - "Escolha uma opção";
  - "Escolha até N opções";
  - o voto pode ser trocado enquanto a enquete estiver aberta.
- **`enviarLembrete(estado, id, perfil, agora, automatico)`:**
  - vai só para as faltantes;
  - texto: "Faltam N dias para a enquete {pergunta}. Sua unidade ainda não votou";
  - "Todas as unidades já responderam" quando não há faltantes.
- **`encerrarEnquete(estado, id, perfil, agora)`.**
- **`prorrogarEnquete(estado, id, dias, perfil, agora)`:** só uma vez ("Só é possível prorrogar uma vez") e avisa o público.
- **`publicarResultado(estado, id, perfil, agora)`:** no Intermediário, gera o comunicado e o documento (pasta Enquetes, visível a todos), sem votos individuais.

## Telas

- **Síndico, Enquetes** (`#sindico.enquetes`, `.nova`, `.EN-00n`):
  - a lista;
  - o formulário com prévia;
  - o painel com participação, prazo, quórum, evolução, votos por opção, faltantes, comentários, votos por unidade (no voto aberto), lembretes, encerrar, prorrogar e publicar o resultado.
- **Morador:**
  - o cartão no Início ("Enquete: … · faltam N dias");
  - Mais › Enquetes (`#morador.enquetes`, `.EN-00n`), com pendentes, respondidas e encerradas, e a tela de voto.

## Testes

- **Casos:**
  - criação e validações;
  - publicação para o público certo;
  - voto: troca, limite da múltipla escolha, uma unidade com um voto só, fora do prazo e fora do público;
  - apuração: simples, ponderada, empate e sem quórum;
  - lembrete só para as faltantes, com os dias restantes;
  - encerramento automático e antecipado;
  - prorrogação;
  - publicação do resultado;
  - planos.
- **verificar:** a lista do síndico, o painel da EN-001, o cartão da Ana e o resultado da EN-002.
- **e2e:**
  - criar e publicar uma enquete de múltipla escolha;
  - a Ana vota e o cartão some;
  - o lembrete;
  - encerrar e publicar o resultado;
  - no Avançado, a EN-002 com peso e quórum.
