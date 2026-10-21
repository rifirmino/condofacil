# Escala: visão da semana por porteiro (design)

Base: imagem de referência enviada pelo Ricardo (grade porteiro × dia com Dia, Noite e Folga). É uma camada de visualização sobre os turnos que já existem; não muda dados nem a versão do armazenamento.

## Onde

- **Síndico, Escala:** nova aba **"Semana"** (`#sindico.escala.semana`), que passa a ser a primeira e a padrão. Clicar numa etiqueta de turno abre o mesmo ajuste de porteiro do calendário (`ajustarTurno`).
- **Portaria, Escala:** seção **"Escala da semana"**, só leitura, depois de "De plantão agora".

## Grade

- **Linhas e colunas:** uma linha por porteiro, na ordem de `PORTEIROS`, e colunas de segunda a domingo com a data curta. A coluna de hoje fica destacada e os feriados aparecem no cabeçalho.
- **Linha final "Sem ninguém":** os buracos de cobertura de cada dia (`buracos` dos dois postos), como "Portaria 19h–7h", em vermelho.
- **Navegação:** setas ‹ › entre as semanas que têm ao menos um dia num mês com escala gerada. A semana inicial é a de hoje.
- **Mês sem escala:** os dias de um mês sem escala gerada mostram "—".

## Etiquetas (`celulaEscala`)

- **Por turno do porteiro no dia:**
  - início às 18h ou depois: **Noite**;
  - 12 h ou mais: **Dia**;
  - antes das 12h: **Manhã**;
  - nos outros casos: **Tarde**.
- **Turno perdido:** um turno com `porteiroOriginal` igual ao porteiro e outro (ou ninguém) no lugar vira **Férias**, **Falta** ou **Atestado**, conforme o `motivoDescoberto`.
- **Sem turno no dia:** **Férias** se estiver de férias; senão, **Folga**.
- **Marcas extras:** quem trabalha em mais de um posto ganha o nome do posto embaixo da etiqueta, e um turno que veio de troca ganha "↔".
- **Cores** (tokens no `:root`, com versão escura):

  | Etiqueta | Cor |
  |---|---|
  | Dia | amarelo |
  | Noite | azul-petróleo com texto branco |
  | Manhã | amarelo-claro |
  | Tarde | laranja-claro |
  | Folga | cinza |
  | Férias | contorno |
  | Falta / Atestado | vermelho |

- **Legenda:** fica acima da grade.

## Celular

A tabela rola na horizontal dentro do próprio contêiner, com a coluna de nomes fixa (`position: sticky`). A página não rola para o lado.

## Testes

- **Casos:**
  - `inicioDaSemana` (segunda-feira);
  - na semana de 19/10/2026: José com Dia, Edson com Noite, Cláudia com Manhã, Bruno com Tarde e Rita com Férias;
  - folga;
  - atestado;
  - troca com "↔";
  - buraco na linha "Sem ninguém";
  - "—" em mês sem escala.
- **verificar:** `#sindico.escala` mostra "Semana", "Sem ninguém", "Folga" e "Noite"; `#portaria.escala` mostra "Escala da semana".
- **e2e:** avançar e voltar uma semana e ajustar um turno pela grade; incluir `#sindico.escala.semana` na largura de celular.
