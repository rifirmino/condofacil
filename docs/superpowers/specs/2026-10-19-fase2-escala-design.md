# Fase 2, parte 4: escala de porteiros (design)

Base: seção 3 da documentação funcional V1.2 e a matriz de planos (8.1). Fecha a fase 2. Tudo é simulado no protótipo de arquivo único.

## Escopo

- **Núcleo do Intermediário:**
  - postos e porteiros já cadastrados;
  - modelos 12x36, 6x1 e noturno;
  - geração do mês, buracos de cobertura e feriados;
  - publicação com aviso;
  - "de plantão agora" e "próximo turno";
  - troca entre colegas;
  - falta ou atestado com sugestão de cobertura;
  - férias;
  - alerta de descanso de 11 h.
- **Do Avançado, só:** check-in e check-out com foto e relatório de horas.
- **"Em breve · Avançado":** rondas com QR e exportação Excel/PDF.
- **Fora do escopo:**
  - modelo personalizado;
  - feriados móveis (Carnaval, Corpus Christi);
  - passagem de turno digital;
  - aprovação automática de troca.
- **Onde o porteiro age:** na aba **Escala** da Portaria, com seletor de porteiro. Não há perfil novo.

## Planos

- `RECURSOS_PLANO.escala = 'intermediario'`, `RECURSOS_PLANO.checkin = 'avancado'` e `RECURSOS_PLANO.relatorioHoras = 'avancado'`.
- **Básico:** o menu Escala do síndico e a aba Escala da portaria mostram "Disponível no plano Intermediário".

## Dados (`src/escala/dados.js`)

As datas e horas dos turnos são strings locais `'AAAA-MM-DDTHH:00'`, comparáveis como texto.

**Postos e porteiros:**

```
POSTOS = { portaria: { nome: 'Portaria principal', abre: 0, fecha: 24 }, guarita: { nome: 'Guarita da garagem', abre: 7, fecha: 22 } }
PORTEIROS = [
  { id: 'jose', nome: 'Seu José', vinculo: 'clt', empresa: null, telefone: '(11) 98811-2040', postos: ['portaria'] },
  { id: 'marcos', nome: 'Marcos', vinculo: 'clt', ..., postos: ['portaria', 'guarita'] },
  { id: 'edson', nome: 'Edson', vinculo: 'terceirizado', empresa: 'Vigilância Prisma', postos: ['portaria'] },
  { id: 'rita', nome: 'Rita', vinculo: 'terceirizado', empresa: 'Vigilância Prisma', postos: ['portaria'] },
  { id: 'claudia', nome: 'Cláudia', vinculo: 'clt', postos: ['guarita'] },
  { id: 'bruno', nome: 'Bruno', vinculo: 'clt', postos: ['guarita', 'portaria'] },
  { id: 'paulo', nome: 'Paulo', vinculo: 'folguista', postos: ['portaria', 'guarita'] },
]
EMPRESAS = { 'Vigilância Prisma': { contato: 'Central Prisma', telefone: '(11) 4433-9000' } }
NOMES_VINCULO = { clt: 'CLT do condomínio', terceirizado: 'Terceirizado', folguista: 'Folguista' }
```

**Modelos de turno:**

```
MODELOS = { '12x36': { nome: '12x36', horas: 12, ciclo: 2 }, '6x1': { nome: '6x1 (8 h)', horas: 8, ciclo: 7 }, noturno: { nome: 'Noturno 12x36', horas: 12, ciclo: 2 } }
```

**Atribuições:**

Valem até o fim do mês seguinte. `ancora` é o dia 1 do mês atual: um 12x36 trabalha nos dias em que `diferencaDias(dia, ancora) % 2 === paridade`.

| Porteiro | Posto | Modelo | Início | Regra |
|---|---|---|---|---|
| jose | portaria | 12x36 | 7h | paridade 0 |
| marcos | portaria | 12x36 | 7h | paridade 1 |
| edson | portaria | noturno | 19h | paridade 0 |
| rita | portaria | noturno | 19h | paridade 1 |
| claudia | guarita | 6x1 | 7h | folga no domingo (0) |
| bruno | guarita | 6x1 | 15h | folga na segunda (1) |

- O 6x1 dura 8 h; o 12x36 e o noturno duram 12 h. O noturno termina às 7h do dia seguinte.
- **Férias:** `{ porteiro: 'rita', de: dia 12, ate: dia 21 }` do mês atual.

**Feriados (`FERIADOS`, MM-DD):**
- 01-01 Confraternização, 04-08 Aniversário de Santo André, 04-21 Tiradentes, 05-01 Dia do Trabalho, 09-07 Independência;
- 10-12 Nossa Senhora Aparecida, 11-02 Finados, 11-15 Proclamação da República, 11-20 Consciência Negra, 12-25 Natal.

**Estado:**

```
estado.escala = {
  atribuicoes, ferias, trocas: [],
  meses: { 'AAAA-MM': { situacao: 'rascunho'|'publicada', publicadaEm, turnos: [turno] } },
  proximaTroca
}
turno = { id: 'T-2026-10-22-portaria-07', posto, porteiro: id|null, inicio, fim,
          motivoDescoberto: null|'ferias'|'falta'|'atestado', porteiroOriginal: id|null, anexo: null|texto,
          trocado: bool, checkin: null|{ em, atrasoMin }, checkout: null|{ em } }
```

**Seed (hoje = D, mês atual M):**
- **Mês M:** gerado e **publicado** (`publicadaEm` = dia 25 do mês anterior, 18h). Os turnos da Rita nas férias ficam descobertos, com motivo `ferias`.
- **Check-in e check-out nos turnos que já terminaram:**
  - no horário exato;
  - com estas exceções: Marcos no dia 2 com 15 min de atraso e Edson no dia 3 com 22 min.
  - O turno em andamento agora fica sem check-in.
- **Atestado da Cláudia:** no turno da guarita de D+1. Vira descoberto com motivo `atestado`, anexo `atestado-claudia.pdf` e `porteiroOriginal: 'claudia'`.
- **Troca TR-001:** Marcos → Paulo no turno do Marcos no primeiro dia par depois de D+2, situação `aceita` (aguardando o síndico). Com D = 19/10, o turno é 22/10 às 7h.
- **Mês M+1:** não é gerado.
- `versao` passa a ser 6.

## Regras (`src/escala/regras.js`)

- **`gerarTurnos(estado, mes)`:**
  - gera os turnos das atribuições para os dias do mês **e para o último dia do mês anterior** (só para calcular a cobertura da madrugada do dia 1). Devolve só os turnos com `inicio` dentro do mês;
  - turnos nas férias do porteiro saem com `porteiro: null`, `motivoDescoberto: 'ferias'` e `porteiroOriginal`.
- **`buracos(estado, mes, posto)`:**
  - percorre as horas do mês dentro do horário do posto;
  - uma hora é coberta se algum turno com porteiro, do mês ou do noturno do dia anterior, cobre aquela hora;
  - agrupa as horas consecutivas sem cobertura em `{ inicio, fim }`.
  - **Seed de outubro/2026:**
    - portaria: 5 buracos, as noites de 12, 14, 16, 18 e 20/10, cada um das 19h às 7h;
    - guarita: os domingos 4, 11, 18 e 25 das 7h às 15h; as segundas 5, 12, 19 e 26 das 15h às 22h; e o atestado de 20/10 das 7h às 15h, num total de 9.
- **`feriadosDoMes(mes)`** devolve `[{ dia, nome }]`.
- **`descansoInsuficiente(estado, mes)`:**
  - lista `{ porteiro, anterior, proximo, horas }` em que o intervalo entre o fim de um turno e o início do próximo do mesmo porteiro é menor que 11 h;
  - considera os meses gerados.
- **`sugestoesCobertura(estado, turnoId)`:**
  - **candidatos:** porteiros que podem trabalhar no posto, não estão de férias, não têm turno sobreposto e não são o `porteiroOriginal`;
  - **ordem:** folguista primeiro, depois o maior descanso mínimo;
  - cada candidato vem com `{ porteiro, descanso, alerta11 }`, em que `descanso` é o menor intervalo, em horas, até o turno anterior ou o seguinte.
- **`plantaoAgora(estado, agora)`** devolve `{ [posto]: { atual: turno|null, proximo: turno|null } }`.
- **`turnosDoPorteiro(estado, porteiro, agora)`:** os turnos futuros e o atual do mês atual e do seguinte.
- **`relatorioHoras(estado, mes)`** devolve, por porteiro, `{ escaladas, comCheckin, atrasos, faltas, trocas }`:
  - `escaladas` soma as horas dos turnos atribuídos a ele;
  - `comCheckin` soma as horas dos turnos com check-in e check-out;
  - `faltas` conta os turnos em que ele é `porteiroOriginal` com motivo falta ou atestado;
  - `trocas` conta as trocas aprovadas em que ele é `de` ou `para`.
- **`alertasEscala(estado, agora)`** gera textos como:
  - "Gerar a escala de novembro" quando M+1 não existe;
  - "Escala de novembro em rascunho: publicar";
  - "Troca aguardando aprovação: Marcos → Paulo, 22/10 7h";
  - "Turno descoberto: Guarita da garagem 20/10 7h–15h · atestado de Cláudia", para cada descoberto com `fim > agora` nos próximos 7 dias.

## Ações (`src/escala/acoes.js`)

- **Plano:** todas exigem o recurso `escala`. Check-in e check-out exigem `checkin`.
- **Perfil:** `'sindico'`, ou `'portaria'` com o id do porteiro.
- **Ações:**
  - `gerarEscala(estado, mes, perfil, agora)`:
    - só o síndico;
    - erro "A escala de novembro já foi gerada";
    - cria o mês em rascunho e aplica as férias.
  - `publicarEscala(estado, mes, perfil, agora)`:
    - só o síndico;
    - erros "Gere a escala antes de publicar" e "Escala já publicada";
    - notificação "Escala de novembro publicada: N porteiros avisados", com N = porteiros com turno no mês.
  - `ajustarTurno(estado, turnoId, porteiro, perfil, agora)`:
    - só o síndico;
    - troca o porteiro do turno; com `porteiro` nulo, o turno fica descoberto;
    - devolve `alerta` se o descanso ficar menor que 11 h;
    - em mês publicado, a notificação vai só para os afetados ("Marcos e Paulo avisados").
  - `proporTroca(estado, { turnoId, de, para }, perfil, agora)`:
    - erro "Escolha o turno e o colega" se faltar algum;
    - erro "Só o porteiro do turno pode propor a troca" se `turno.porteiro !== de`;
    - erro "Este colega já tem turno nesse horário" se houver sobreposição para `para`;
    - cria a troca TR-00N com situação `proposta`.
  - `aceitarTroca(estado, id, quem, agora)`: erro "Só o colega convidado pode aceitar" se `quem !== para`; a troca passa a `aceita`.
  - `recusarTroca(estado, id, quem, perfil)`: o convidado ou o síndico; a troca passa a `recusada`.
  - `aprovarTroca(estado, id, perfil, agora)`:
    - só o síndico, com a troca `aceita`;
    - o turno passa para `para` com `trocado: true`;
    - devolve `alerta` das 11 h se houver;
    - a notificação vai aos dois porteiros.
  - `registrarFalta(estado, turnoId, { quem, motivo, anexo }, perfil, agora)`:
    - erro "Escolha o turno e o motivo";
    - pode ser o porteiro do turno ou o síndico;
    - o turno fica descoberto com `porteiroOriginal`;
    - a notificação vai para a empresa quando o vínculo é terceirizado ("Vigilância Prisma: turno descoberto na Portaria principal 21/10 19h") e, senão, para o síndico.
  - `atribuirCobertura(estado, turnoId, porteiro, perfil, agora)`: só o síndico; atribui e mantém `porteiroOriginal`; devolve `alerta` das 11 h.
  - `fazerCheckin(estado, porteiro, agora)`:
    - usa o turno do porteiro que cobre o instante atual;
    - erro "Não há turno seu agora para fazer check-in";
    - `atrasoMin` = minutos depois do início quando passa de 10 min, senão 0;
    - foto simulada.
  - `fazerCheckout(estado, porteiro, agora)`: erro "Faça o check-in antes do check-out".

## Telas

### Síndico, menu "Escala" (`#sindico.escala`, abas `calendario`, `pendencias`, `equipe` e `horas`)

- **Calendário:**
  - **Seletores:**
    - **Mês:** atual e seguinte. Se o seguinte não existir, aparece o botão **Gerar escala de novembro**.
    - **Posto.**
  - **Resumo:** "N buracos de cobertura · M alertas de descanso · publicada em dd/mm" ou "rascunho". No rascunho, aparece o botão **Publicar escala**.
  - **Grade:**
    - uma linha por dia (dia da semana e data, com etiqueta de feriado e de hoje), com os turnos do posto: nome, horário e etiqueta "troca" ou "descoberto";
    - os buracos aparecem como faixa vermelha "19h–7h sem ninguém";
    - cada turno tem o botão "Trocar porteiro", que abre um select com os porteiros do posto e a opção "Ninguém (descoberto)".
- **Pendências:**
  - trocas aceitas, com Aprovar e Recusar;
  - turnos descobertos futuros, com as sugestões (nome, vínculo, descanso e ⚠ quando menor que 11 h) e o botão **Atribuir**.
- **Equipe:** postos com horário; porteiros com vínculo, empresa, telefone, postos e férias.
- **Horas:** a tabela do relatório. Fora do Avançado, mostra o `Bloqueado` com `relatorioHoras`.
- **Início e menu:**
  - `alertasEscala` entra em "Precisa da sua atenção";
  - o menu ganha **Escala**;
  - o "Em breve" fica só com "Estoque, checklist e rondas · Avançado".

### Portaria, aba "Escala" (`#portaria.escala`)

- **De plantão agora:**
  - um cartão por posto: nome, horário e "Próximo: Marcos às 19h";
  - no Avançado, com o botão **Fazer check-in** ou **Fazer check-out** e o registro "Check-in às 7h18 · 18 min de atraso".
- **Seletor do porteiro:** botões com os 7 porteiros, `aria-pressed`.
- **Meus plantões:**
  - lista com data, horário, posto e etiqueta de feriado;
  - em cada um, "Propor troca" (select do colega e botão **Enviar proposta de troca**) e "Registrar falta" (motivo falta ou atestado, botão **Anexar atestado** e **Registrar**).
- **Trocas recebidas:** com **Aceitar** e **Recusar**.
- O porteiro vê só a própria escala e o plantão do posto. Nada financeiro.

## Erros (textos exatos)

- **Troca:**
  - "Escolha o turno e o colega"
  - "Só o porteiro do turno pode propor a troca"
  - "Este colega já tem turno nesse horário"
  - "Só o colega convidado pode aceitar"
- **Falta:** "Escolha o turno e o motivo" e "Só o porteiro do turno pode registrar a falta"
- **Escala:**
  - "A escala de novembro já foi gerada" (com o nome do mês)
  - "Gere a escala antes de publicar"
  - "Escala já publicada"
- **Check-in e check-out:**
  - "Não há turno seu agora para fazer check-in"
  - "Faça o check-in antes do check-out"
- **Gerais:**
  - SO_SINDICO
  - "Disponível no plano Intermediário" / "Disponível no plano Avançado"

## Testes

- **Unitários (`src/casos/escala.js`, com AGORA_FASE2 = 19/10/2026 10h):**
  - **Geração:**
    - turnos de outubro: Seu José nos dias ímpares e Marcos nos pares, das 7h às 19h;
    - o noturno do Edson atravessa a meia-noite;
    - a Cláudia folga nos domingos e o Bruno nas segundas;
    - a Rita fica descoberta nas férias.
  - **Cobertura e alertas:**
    - buracos: 5 na portaria e 9 na guarita;
    - feriado 12/10;
    - plantão agora: Seu José na portaria e Cláudia na guarita, com o Edson como próximo da portaria às 19h;
    - alertas do Início.
  - **Trocas e faltas:**
    - troca em três passos, com permissões e sobreposição;
    - aprovação que passa o turno;
    - falta do Edson que avisa a Vigilância Prisma;
    - sugestões com o Paulo primeiro;
    - atribuição com alerta de 11 h.
  - **Escala do mês:** gerar novembro (repete o erro na segunda vez) e publicar (6 porteiros avisados).
  - **Avançado:**
    - check-in no horário, atrasado e sem turno;
    - check-out;
    - relatório de horas com as horas escaladas e os atrasos do seed.
  - **Planos:** a regra de cada plano.
- **verificar:**
  - `#sindico.escala` ("Portaria principal", "sem ninguém", "Gerar escala de novembro");
  - `#sindico.escala.pendencias` ("Marcos → Paulo", "Atribuir", "Paulo");
  - `#portaria.escala` ("De plantão agora", "Seu José", "Meus plantões");
  - alertas no Início;
  - `#sindico.escala.horas` com o bloqueio no Intermediário.
- **e2e:**
  - `escalaTroca`: Marcos propõe o próximo turno dele para o Paulo, que aceita; o síndico aprova, e o turno aparece com o Paulo.
  - `escalaFalta`: o Edson registra falta com atestado no próximo turno e o selo avisa a Vigilância Prisma; nas Pendências, o síndico atribui ao Paulo.
  - `escalaPublicar`: o síndico gera novembro, vê os buracos, publica, e aparece o selo "porteiros avisados".
  - `escalaAvancado`: no Avançado, o check-in do plantão atual funciona e a aba Horas mostra a tabela; no Básico, a escala fica bloqueada.
- **Largura de celular:** `#sindico.escala`, `#sindico.escala.pendencias` e `#portaria.escala` entram no teste de 390 px.
