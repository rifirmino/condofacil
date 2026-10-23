# Implantação de um condomínio novo (design)

O objetivo é testar o processo do zero: cadastrar o condomínio, as unidades e os moradores, configurar a cobrança e a conta Asaas (simulada), escolher as áreas, divulgar com QR Code e ver o morador fazer o primeiro acesso. Depois da ativação, o app inteiro passa a funcionar com esse condomínio, que começa vazio.

## Seletor de condomínio

- **Onde:** na barra de cima, com "Residencial Ipê Amarelo (demonstração)", os condomínios criados e "+ Novo condomínio".
- **Armazenamento:**
  - a demonstração continua em `condofacil-demo-v1` e se refaz todo dia;
  - os condomínios criados ficam em `condofacil-condominios-v1` (`{ ativo, lista, rascunho }`) e não são refeitos;
  - "Reiniciar demonstração" só vale para a demonstração.

## Assistente (`#implantacao.<passo>`), 7 passos com progresso, voltar e rascunho salvo

1. **Condomínio:**
   - nome (obrigatório), CNPJ (opcional, 14 dígitos), CEP, endereço, cidade e UF;
   - síndico: nome, apto, e-mail e celular;
   - plano.
2. **Unidades:**
   - **gerador:** blocos (A, B… ou nenhum), andares (1 a 40), apartamentos por andar (1 a 20), numeração `<andar><nn>` com o prefixo do bloco, e a opção "o último andar é cobertura";
   - **ou CSV:** `unidade;bloco;tipo`;
   - **prévia** com o total, até 1.000 unidades.
3. **Moradores:**
   - **CSV** `unidade;nome;email;celular;vinculo;responsavel`, colado no campo, com modelo para copiar;
   - **separador:** `;`, `,` ou tabulação; aspas são aceitas e o cabeçalho é opcional;
   - **erros por linha:**
     - unidade inexistente;
     - nome vazio;
     - e-mail inválido;
     - celular com menos de 10 ou mais de 13 dígitos;
     - vínculo desconhecido;
     - segundo responsável financeiro na mesma unidade;
   - **o passo é opcional.**
4. **Cobrança:**
   - vencimento (dia 1 a 28), multa (até 2%), juros e fundo de reserva (0 a 30%);
   - taxa em valor fixo para o padrão e a cobertura, ou um orçamento por fração ideal;
   - as frações são calculadas proporcionais ao valor de cada tipo e somam 100%.
5. **Conta Asaas (simulada):**
   - ambiente sandbox ou produção, CNPJ do condomínio, banco, agência e conta;
   - "Criar subconta" deixa a conta "Em análise", e "Simular aprovação" passa para "Aprovada".
6. **Áreas comuns:** modelos de salão de festas, churrasqueira, quadra, academia e piscina, com taxa, aprovação e horários.
7. **Divulgação e ativação:**
   - QR Code real (biblioteca `qrcode-generator` 1.4.4) apontando para `https://condofacil.cloud/c/<identificador>`, cartaz A4 para imprimir, mensagem de WhatsApp e os contatos comercial@condofacil.cloud e +55 11 92591-3118;
   - **Ativar condomínio** gera o estado com `condominioNovo(config, agora)`.

## Condomínio novo vazio

- **O que vem preenchido:** condomínio, unidades (com bloco, andar e tipo), pessoas, áreas, plano e a primeira versão da composição (vigência no mês atual, ata "Implantação").
- **O que começa vazio:** emissões, cobranças, histórico, contas, balancetes e as demais listas.
- **Ajustes para funcionar vazio:**
  - `primeiraNaoEmitida`, `indicadoresFinanceiros`, os gráficos e os fluxos passam a aceitar a ausência de dados;
  - o filtro de andar dos comunicados passa a usar o andar da unidade;
  - a escala mostra um aviso de equipe não cadastrada.
- **Nomes que deixam de ser fixos:** o nome do condomínio e o síndico ("Olá, Roberto", painel, modelos de comunicado e avisos) passam a vir de `estado.condominio`. A troca de morador usa as pessoas do condomínio ativo.

## Primeiro acesso do morador ("Entrar pelo convite", em Morador)

- **Passos:** escolher a unidade, informar nome e celular, receber o código (simulado, mostrado na tela), confirmar e entrar.
- **Quem já está na planilha:** o cadastro é ligado à pessoa existente.
- **Quem não está:** vira uma pessoa "aguardando aprovação" e o síndico recebe o alerta.
- **Adesão:** o indicador de adesão conta as pessoas aprovadas.

## Testes

- **Casos:**
  - gerador de unidades;
  - CSV e seus erros;
  - frações;
  - `condominioNovo` válido;
  - funções principais rodando sobre o estado vazio;
  - primeiro acesso e aprovação;
  - nomes vindos do estado.
- **e2e `implantacao`:**
  1. assistente completo;
  2. ativação;
  3. visita a todas as rotas de todos os perfis sem erro;
  4. emissão da primeira cobrança;
  5. primeiro acesso e aprovação;
  6. volta para a demonstração, conferindo que ela está intacta.
