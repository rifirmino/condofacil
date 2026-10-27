# Melhorias do teste de 26/10 (design)

As mudanças vêm das anotações do teste de implantação feito pelo Ricardo. Valem para o protótipo e para o modo conectado.

## 1. CEP com preenchimento automático

- **Busca:** com o CEP de 8 dígitos no passo Condomínio, o app consulta `https://viacep.com.br/ws/<cep>/json/`. Ele preenche endereço (logradouro), bairro (campo novo no passo), cidade e UF.
- **Falha:** se a busca não funcionar (sem internet, CEP inexistente, ou o claude.ai bloqueando), os campos continuam livres para digitar, sem mensagem de erro.
- **Conta Asaas:** o bairro preenchido vira o valor inicial do campo Bairro do passo Conta Asaas.
- **Função pura:** `enderecoDoViaCep(json)` → `{ endereco, bairro, cidade, uf }` ou `null`.

## 2. Unidades com o bloco depois do número

- **Gerador:**
  - campos: blocos, andares, apartamentos por andar;
  - um campo para cada apartamento do 1º andar (ou térreo), sugerindo `somar + 1, somar + 2…`;
  - "somar a cada andar" (padrão 100) e "o último andar é de coberturas";
  - a unidade é `<número><bloco>`: com 1º andar 11–14, somar 10 e blocos A e B, sai 11A–14A, 21A–24A… 41B–44B;
  - erros: número repetido, números que colidem entre andares, mais de 1.000 unidades.
- **Prévia:** a grade do gerador aparece por bloco e por andar.
- **Planilha (`unidade;bloco;tipo;andar`):**
  - com bloco preenchido, a unidade vira `<unidade><bloco>`, e não é acrescentado se já terminar com o bloco;
  - só há repetição quando unidade + bloco se repetem;
  - o andar vem da coluna opcional `andar` ou do número: com 2 dígitos é a dezena, com 3 ou mais é tudo menos os 2 últimos.
- **Assinatura nova:** `gerarUnidades({ blocos, andares, primeiroAndar, somar, coberturaUltimo })`. Sem `primeiroAndar`, usa `porAndar` com a sugestão.

## 3. Cadastro do morador

- **Pessoa atual:** `estado.pessoaAtual` guarda o id de quem está usando o app de morador.
  - O convite e "trocar morador" passam a gravá-lo.
  - `pessoaDaUnidade` prefere essa pessoa e, depois, a primeira ativa da unidade. É isso que corrige "Maria no síndico, Ricardo no app".
- **Meus dados (`#morador.dados`, em Mais e logo depois do convite):**
  - o morador edita nome, CPF, celular e e-mail;
  - mantém a lista "Quem mora no apartamento" (nome obrigatório, telefone opcional, no máximo 15 pessoas);
  - vê o responsável financeiro só para leitura ("definido pelo síndico") e não vê dados de outras unidades.
- **Moradores (`#sindico.moradores`, no menu do síndico):**
  - lista cada unidade com as pessoas (situação, celular, e-mail) e quem mora no apartamento;
  - mostra o responsável financeiro, com "Definir responsável" (nome, CPF válido, relação);
  - permite "Remover" uma pessoa, exceto o próprio síndico.
- **Aprovação do convite:**
  - quando a unidade já tem outras pessoas, a aprovação mostra quem são;
  - opções: "Aprovar como mais um morador", "Aprovar substituindo <nomes>" ou "Recusar";
  - ao substituir, as outras pessoas da unidade (menos o síndico) saem;
  - se uma delas era a responsável financeira, a responsabilidade passa para a pessoa aprovada, sem CPF, e o síndico completa depois.
- **Ações puras (`src/moradores/acoes.js`):**
  - `atualizarMeusDados(estado, idPessoa, dados)` e `salvarResidentes(estado, unidade, lista)`;
  - `definirResponsavel(estado, unidade, dados, perfil)` e `removerPessoa(estado, id, perfil)`;
  - `aprovarMorador(estado, id, perfil, agora, modo)`, com modo `adicional` ou `substituir`.
- **Quem mora no apartamento:** fica em `estado.residentes[unidade]`, valendo `{}` quando não existe (sem migração).

## Testes

- **Casos novos:** gerador por 1º andar e soma, planilha com bloco, andar inferido, `enderecoDoViaCep`, as cinco ações de moradores e a pessoa atual no convite.
- **e2e:** os roteiros de implantação e conectado passam a usar as unidades com sufixo (101A); o roteiro de implantação ganha Meus dados e a aprovação substituindo.
