# Fase 2, parte 3: notificações com prazo, OS do zelador e compras (design)

Base: seções 4 e 5 da documentação funcional V1.2 e a matriz de planos (8.1). Continua as partes 1 e 2 (cobrança e acordos). Tudo é simulado no protótipo de arquivo único.

## Escopo

- **Notificações:** são a evolução das Ocorrências, com a mesma aba e o mesmo protocolo. Ganham tipo, categorias novas, prioridade, prazos de 1ª resposta e de solução, caixa de entrada e ações do síndico.
- **OS (ordens de serviço) do zelador:** novo perfil **Zelador** no "Ver como".
- **Compras:** com aprovação do síndico, recebimento com nota e lançamento automático na despesa.
- **Extras do Avançado nesta parte:** só **cotações mínimas** e **caixa pequeno**.
- **"Em breve · Avançado":** estoque, checklist e rotina, rondas com QR, check-in, relatório de horas, aprovação do conselho e histórico por equipamento.
- **Fora do escopo:** recurso e multa da advertência (seção 7), prazos editáveis por condomínio, anexos de vídeo e áudio, e mapa de locais.

## Planos

Novos recursos em `RECURSOS_PLANO`:

| Recurso | Plano mínimo |
|---|---|
| `notificacoesPrazo` (tipo, prioridade, prazos, ações, OS) | intermediario |
| `zelador` (perfil, OS e compras) | intermediario |
| `indicadorAtendimento` | avancado |
| `cotacoes` | avancado |
| `caixaPequeno` | avancado |

- **Básico:** Ocorrências como hoje, sem prazos e sem ações novas. O perfil Zelador mostra "Módulo do zelador disponível no plano Intermediário".

## Notificações

### Tipos e categorias

Os IDs de categoria ficam em `CATEGORIAS`, que substitui a tabela atual. Cada categoria ganha os campos `tipo` e `prioridade`.

| Tipo | Categoria (id: nome · prioridade padrão) |
|---|---|
| `manutencao` | vazamento: Vazamento · urgente; eletrica: Elétrica/iluminação · alta; elevador: Elevador · alta; portao: Portão/garagem · alta; interfone: Interfone · normal; limpeza: Limpeza · normal; piscina: Piscina · normal; outros: Outros · normal; jardim: Jardim · baixa |
| `irregularidade` | seguranca: Segurança · alta; barulho: Barulho · normal; vaga: Vaga ocupada · normal; lixo: Lixo fora do lugar · normal; pet: Pet · normal; obra: Obra fora do horário · normal; area_comum: Uso indevido de área comum · normal |
| `outro` | sugestao: Sugestão · baixa; elogio: Elogio · baixa |

`TIPOS_NOTIFICACAO = { manutencao: 'Manutenção', irregularidade: 'Irregularidade', outro: 'Sugestão ou elogio' }`

### Prazos (`PRAZOS`, em horas; `null` = sem prazo)

| Prioridade | 1ª resposta | Solução |
|---|---|---|
| urgente | 1 | 24 |
| alta | 4 | 72 |
| normal | 24 | 168 |
| baixa | 72 | null |

- **1ª resposta:** é o instante da primeira entrada da linha do tempo com autor `'Síndico'`, seja mudança de status, comentário, pedido de informação ou geração de OS.
- **Solução:** é o instante da entrada com status `resolvida`.
- **Vencimentos:**
  - a 1ª resposta vence quando não existe e o prazo passou;
  - a solução vence quando a notificação não está resolvida nem fechada e o prazo passou.
- Arquivadas não vencem.

### Campos novos da ocorrência

- `prioridade`: vem da categoria e pode ser mudada pelo síndico.
- `os`: id da OS ligada ou `null`.
- `advertencia`: `{ unidade, em }` ou `null`.
- `motivoArquivamento`: texto ou `null`.
- O `tipo` é derivado da categoria.

### Nomes de status

Os IDs não mudam. Os nomes mostrados passam a ser: aberta "Recebida", em_analise "Em análise", em_andamento "Em atendimento", resolvida "Resolvida", fechada "Fechada".

### Regras (`src/notificacoes/regras.js`)

- `prazosDe(oc)` devolve `{ resposta: { limite, cumprida, vencida, horasAtraso }, solucao: {...} | null }`. A conta segue a tabela de prazos.
- `caixaDeEntrada(estado, agora, filtros)`:
  - lista as não arquivadas;
  - ordem por prioridade (urgente → baixa) e depois pelo prazo mais próximo;
  - filtros por tipo, prioridade e status.
- `parecidas(estado, categoria, unidade)`: notificações abertas da mesma categoria que não sejam da própria unidade. Elas recebem "Eu também" mesmo que não sejam públicas.
- `alertasNotificacoes(estado, agora)` gera textos como:
  - "OC-0042: 1ª resposta vencida há 27 h";
  - "OC-0039: solução vencida há 2 dias".
- `indicadorAtendimento(estado, agora)` devolve `{ abertas, noPrazo, comPrazo, pct, alerta }`:
  - o percentual considera as notificações resolvidas ou fechadas que tinham prazo de solução;
  - o alerta dispara abaixo de 80%.
- `urgentesAbertas(estado)`: prioridade urgente com status antes de resolvida. É usada pela faixa da portaria.

### Ações (`src/notificacoes/acoes.js`)

- **Só o síndico:** todas as ações abaixo dão o erro SO_SINDICO para outro perfil.
- **Exigem o plano:** todas, exceto arquivar, dão "Disponível no plano Intermediário" no Básico.
- **Ações:**
  - `definirPrioridade(estado, id, prioridade, perfil, agora)`.
  - `pedirInformacao(estado, id, texto, perfil, agora)`: entra na linha do tempo como comentário do síndico e muda o status para em_analise se estiver aberta.
  - `gerarAdvertencia(estado, id, unidade, perfil, agora)`:
    - só para irregularidade (senão "Advertência só vale para irregularidades");
    - exige unidade ("Informe a unidade advertida");
    - o aviso à unidade advertida nunca traz o nome nem a unidade de quem denunciou;
    - a linha do tempo registra "Advertência enviada ao apto X".
  - `arquivarComJustificativa(estado, id, motivo, perfil)`:
    - exige motivo ("Informe o motivo do arquivamento");
    - arquiva em qualquer status;
    - substitui `arquivarOcorrencia` na tela do síndico. A função antiga continua para o Básico.
- **Abertura:** `abrirOcorrencia` passa a exigir a categoria ("Escolha o tipo e a categoria") e grava `prioridade` com o padrão da categoria.

## Zelador

O zelador é o **Seu Antônio** (`ZELADOR = 'Seu Antônio'`), visto no celular. Ele não vê receitas, inadimplência nem saldo do condomínio.

### OS (`estado.manutencao.os[]`)

```
{ id: 'OS-001', origem: 'notificacao'|'sindico'|'ronda', notificacao: 'OC-0039'|null, local, descricao,
  prioridade, prazo (ISO), responsavel: 'zelador'|'prestador', prestador: texto|null,
  status: 'aberta'|'em_execucao'|'aguardando_material'|'aguardando_prestador'|'concluida'|'validada',
  fotoAntes: bool, fotoDepois: bool, materiais, horas, observacoes, linha: [{em, status, texto, autor}],
  criadaEm, iniciadaEm, concluidaEm, validadaEm }
```

**Ações (`src/manutencao/acoes.js`)**

- **Perfis permitidos:** `'zelador'` ou `'sindico'`. Um perfil diferente dá "Somente o zelador ou o síndico pode fazer isso".
- **Criar:**
  - `gerarOS(estado, idNotificacao, { responsavel, prestador, prazo }, perfil, agora)`:
    - só o síndico;
    - local, descrição e prioridade vêm da notificação; o prazo padrão é o prazo de solução, ou 7 dias;
    - liga a notificação (`os`), passa o status dela para em_andamento e registra "OS-xxx aberta para o zelador" na linha do tempo;
    - erro "Esta notificação já tem a OS-xxx".
  - `abrirOS(estado, { local, descricao, prioridade, prazo }, perfil, agora)`:
    - o síndico abre com origem 'sindico', o zelador com origem 'ronda';
    - exige local e descrição ("Informe o local e a descrição").
- **Execução:**
  - `iniciarOS`: aberta ou aguardando → em_execucao.
  - `pausarOS(estado, id, motivo)`: em_execucao → aguardando_material ou aguardando_prestador.
  - `concluirOS(estado, id, { fotoDepois, materiais, horas, observacoes }, perfil, agora)`:
    - exige foto do depois ("Anexe a foto do depois") e horas > 0 ("Informe as horas gastas");
    - vale a partir de em_execucao ou aguardando;
    - se houver notificação ligada, ela vira resolvida com a entrada "Reparo concluído pelo zelador (fotos do antes e depois)", e a notificação vai ao morador: "Seu chamado OC-xxx foi resolvido".
  - `validarOS`: só o síndico e só para OS concluída ("Só OS concluídas podem ser validadas").

**Alertas:**
- "OS-xxx urgente sem início há 2 h": prioridade urgente, status aberta e 2 h desde a criação.
- "OS-xxx concluída: validar".

### Compras (`estado.manutencao.compras[]`)

```
{ id: 'CP-001', item, quantidade, motivo, valorEstimado, categoria: 'manutencao'|'administracao'|'seguro',
  os: id|null, urgente: bool, cotacoes: [{ fornecedor, valor }],
  status: 'solicitada'|'aprovada'|'recusada'|'recebida', motivoRecusa, valorFinal, nota: texto|null,
  viaCaixa: bool, criadaEm, aprovadaEm, recebidaEm }
```

**Regras e ações**

- **`solicitarCompra`:**
  - zelador ou síndico;
  - exige item, quantidade ≥ 1 e valor > 0 ("Informe item, quantidade e valor").
- **`anexarCotacao(estado, id, { fornecedor, valor })`:** o zelador ou o síndico pode anexar.
- **`cotacoesMinimas(valor)`:** 1 até R$ 500,00; 2 até R$ 2.000,00; 3 acima.
- **`aprovarCompra`:**
  - só o síndico e só com status solicitada;
  - no Avançado, exige o mínimo de cotações: "Anexe 3 cotações para compras acima de R$ 2.000,00" (o texto acompanha a faixa: "Anexe 2 cotações para compras acima de R$ 500,00");
  - no Intermediário, a cotação é opcional.
- **`recusarCompra`:** exige motivo ("Informe o motivo da recusa").
- **`receberCompra(estado, id, { valorFinal, nota }, perfil, agora)`:**
  - só para compra aprovada;
  - com valor final acima de R$ 200,00, a nota é obrigatória ("Anexe a nota fiscal (obrigatória acima de R$ 200,00)");
  - **lança a despesa:** `financeiro.despesasMes[categoria] += valorFinal`, `financeiro.saldo -= valorFinal`, e a auditoria registra "Compra lançada".

**Alerta:** "CP-xxx aguardando aprovação: item, R$ x".

### Caixa pequeno (`estado.manutencao.caixa`)

```
{ fundo: 30000, saldo, gastos: [{ id, descricao, valor, cupom: bool, em }], reposicoes: [{ em, valor }] }
```

- **`gastoCaixa(estado, { descricao, valor, cupom }, perfil, agora)`:**
  - zelador ou síndico, e só no Avançado;
  - **erros:** sem cupom, "Anexe a foto do cupom"; valor acima de R$ 200,00, "Gasto acima de R$ 200,00: faça uma compra"; valor maior que o saldo, "Saldo do caixa pequeno insuficiente".
- **`reporCaixa(estado, perfil, agora)`:**
  - só o síndico;
  - repõe a diferença até o fundo;
  - lança a despesa em `manutencao` e tira do saldo do condomínio;
  - registra a reposição e a auditoria "Caixa pequeno reposto".

## Dados iniciais (versão 5)

- **Ocorrências:**
  - remapeamento: OC-0037 lâmpada vira eletrica, OC-0040 segurança vira elevador, e a categoria vizinho deixa de existir;
  - prioridades: OC-0039 urgente e OC-0042 normal;
  - nova **OC-0043:** obra fora do horário, apto 702, aberta há 5 h, sobre "Furadeira no domingo às 8h no 5º andar";
  - o próximo protocolo passa a ser 44.
- **OS:**
  - **OS-001:** preventiva da bomba d'água, origem 'sindico', validada há 10 dias, 1,5 h;
  - **OS-002:** lâmpadas do hall do 5º andar, da OC-0037, concluída há 7 dias, ainda sem validação;
  - **OS-003:** vazamento na garagem, vaga 12, da OC-0039, urgente, em_execucao, com a linha do tempo "Iniciada", "Aguardando material: registro de 3/4" e "Retomada".
- **Compras:**
  - **CP-001:** registro de 3/4" e conexões, quantidade 1, R$ 380,00, ligada à OS-003, solicitada, 1 cotação;
  - **CP-002:** produtos de limpeza, R$ 145,00, recebida há 6 dias com nota, já incluída nas despesas.
- **Caixa:** fundo R$ 300,00, gastos de R$ 42,00 (fita veda-rosca e lâmpadas) e R$ 18,50 (sacos de lixo extras), saldo R$ 239,50.

## Telas

### Síndico

- **Notificações** (antiga Ocorrências; rota `#sindico.ocorrencias`, rótulo do menu "Notificações"):
  - **Caixa de entrada:**
    - colunas: protocolo, categoria e tipo, prioridade, 1ª resposta, solução e status;
    - os prazos vencidos ganham a etiqueta "vencido há X";
    - filtros por tipo, prioridade e status.
  - **Prazos:** quadro recolhível "Prazos por prioridade".
  - **Detalhe:** o que já existe, mais o seletor de prioridade e as ações:
    - Gerar OS, com responsável e prazo;
    - Advertência, só em irregularidade, com campo da unidade;
    - Pedir mais informações;
    - Arquivar com justificativa.
  - **Básico:** tela atual, sem essas colunas e ações.
- **Manutenção** (item novo no menu `#sindico.manutencao`), com as abas:
  - **OS:** lista, Nova OS e detalhe com Validar;
  - **Compras:** aguardando aprovação no topo, cotações, Aprovar e Recusar;
  - **Caixa pequeno:** saldo, gastos e Repor fundo. Fora do Avançado, aparece o bloqueio.
  - No Básico, a aba inteira mostra o bloqueio do Intermediário.
- **Início:**
  - **Alertas novos** em "Precisa da sua atenção":
    - prazos vencidos;
    - OS urgente sem início;
    - compras aguardando aprovação;
    - OS concluídas para validar.
  - **Card "Atendimento" (Avançado):** fica em Operação.
- **Em breve:** "Escala de porteiros · Intermediário" e "Estoque, checklist e rondas · Avançado".

### Morador

- **Nova notificação:**
  - escolhe o tipo, depois a categoria e o local;
  - as parecidas aparecem com "Eu também";
  - em seguida vêm a descrição e a foto;
  - "Não me identificar para os outros" só aparece em irregularidade.
- **Detalhe:**
  - status com os nomes novos;
  - "Previsão de solução: até dd/mm, hh h", no Intermediário em diante;
  - a linha do tempo inclui OS e reparo;
  - a avaliação abre quando a notificação é resolvida.

### Zelador (`#zelador.os`, `#zelador.compras`, `#zelador.caixa`)

- **Perfil:** `PERFIS` ganha `{ id: 'zelador', nome: 'Zelador', inicial: 'os' }`, e o "Ver como" passa a ter 4 botões, que precisam caber em 390 px.

- **Moldura:** celular, com o cabeçalho "Seu Antônio · Zelador".
- **OS:**
  - lista com as urgentes primeiro;
  - detalhe com Iniciar, Aguardando material, Aguardando prestador e Concluir (foto do depois, materiais, horas, observações);
  - Nova OS (ronda).
- **Compras:** Nova compra, com cotações no Avançado; lista; Registrar recebimento com valor final e nota.
- **Caixa:** saldo, gastos e Novo gasto com cupom. Fora do Avançado, aparece o bloqueio.

### Portaria

- **Hoje:** faixa de perigo para cada urgente aberta, por exemplo "Notificação urgente: OC-0039 · Vazamento · Garagem, vaga 12".

## Erros (textos exatos)

- **Notificações:**
  - "Escolha o tipo e a categoria"
  - "Informe o motivo do arquivamento"
  - "Advertência só vale para irregularidades"
  - "Informe a unidade advertida"
- **OS:**
  - "Esta notificação já tem a OS-xxx"
  - "Informe o local e a descrição"
  - "Anexe a foto do depois"
  - "Informe as horas gastas"
  - "Só OS concluídas podem ser validadas"
  - "Somente o zelador ou o síndico pode fazer isso"
- **Compras:**
  - "Informe item, quantidade e valor"
  - "Anexe N cotações para compras acima de R$ X"
  - "Informe o motivo da recusa"
  - "Anexe a nota fiscal (obrigatória acima de R$ 200,00)"
- **Caixa pequeno:**
  - "Anexe a foto do cupom"
  - "Gasto acima de R$ 200,00: faça uma compra"
  - "Saldo do caixa pequeno insuficiente"
- **Gerais:**
  - SO_SINDICO
  - "Disponível no plano Intermediário" / "Disponível no plano Avançado"

## Testes

- **Unitários** (`src/casos/notificacoes.js` e `src/casos/manutencao.js`):
  - categorias, prioridades, prazos de resposta e solução, vencidos e caixa de entrada ordenada;
  - parecidas, advertência sem expor o denunciante e arquivamento com motivo;
  - fluxo e permissões da OS, e conclusão que resolve a notificação;
  - cotações por faixa, recusa, nota obrigatória e lançamento na despesa e no saldo;
  - caixa pequeno (cupom, limite, saldo e reposição);
  - alertas, indicador de atendimento, planos e seed.
- **Ajustes nos testes antigos:**
  - casos de Ocorrências: categoria obrigatória e categorias remapeadas;
  - roteiro `ocorrencia`;
  - checagens que dependem de categoria ou de nome de status.
- **verificar:**
  - caixa de entrada ("1ª resposta", "OC-0042", "vencido");
  - Manutenção ("OS-003", "CP-001", "Aguardando aprovação");
  - zelador ("Seu Antônio", "OS-003");
  - faixa da portaria ("Notificação urgente: OC-0039");
  - alertas do Início;
  - Básico sem prazos.
- **e2e:**
  - `notificacaoOS`:
    - Ana abre um vazamento, a faixa aparece na portaria e o síndico gera a OS;
    - o zelador inicia e tenta concluir sem foto (erro), depois conclui com foto;
    - Ana vê "Resolvida" e avalia, e o síndico valida.
  - `compraAprovacao`: o zelador pede a compra, o síndico aprova, o zelador recebe com nota e as despesas do mês sobem.
  - `zeladorAvancado`:
    - uma compra de R$ 2.500 com 1 cotação dá erro na aprovação;
    - no caixa, gasto sem cupom dá erro, e com cupom o saldo cai.
  - `advertencia`: o síndico adverte o apto 503 na OC-0043, e o aviso não mostra quem denunciou.
  - `planosManutencao`: no Básico, o zelador fica bloqueado e as notificações não têm prazos.
- **Largura de celular:** as telas novas entram no teste de 390 px.
