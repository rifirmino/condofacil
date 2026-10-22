# Sr. Abel no protótipo (design)

Parte da base veio de outra conversa: o widget flutuante sem IA, o manual e as respostas por perfil, no commit `db47631` do branch `sr-abel`. Esta conversa acrescenta a IA, as ações e a divisão por plano.

## Planos

- **Básico:** o botão aparece, mas o painel mostra "Disponível no plano Intermediário".
- **Intermediário (`assistente`):** respostas sem IA, pela intenção e pelos dados do perfil, com o manual como reserva.
- **Avançado (`assistenteIA`):** conversa com o Claude pela capacidade `sample` (modelo `quick`, sem cache).
  - **Instruções:** são `instrucoesAbel`, que juntam o manual inteiro e o contexto do perfil montado do estado real (`contextoAbel`).
  - **Sem IA disponível:** quando o protótipo é aberto fora do Claude ou o uso não é autorizado, ele volta às respostas sem IA e avisa.
  - **Ações do morador:** só quando o ambiente aceita ferramentas (`limits().tools`), e só depois de confirmadas na conversa. São `consultar_agenda`, `solicitar_reserva`, `abrir_ocorrencia`, `votar_enquete` e `segunda_via`, e todas usam as mesmas ações do app.

## Privacidade

O contexto de cada perfil contém só o que o app já mostra a esse perfil. Os testes conferem que:
- a Ana não recebe dívidas de outras unidades, a encomenda do 504 nem o processo do 104;
- a portaria não recebe inadimplência;
- o zelador não recebe valores.

## Estado

O `executar` do App passa a ler o estado mais recente por uma referência, para que o Sr. Abel possa encadear várias ações numa mesma resposta.

## Publicação

O link do protótipo declara a capacidade `{ sample: {} }`. Na primeira pergunta no plano Avançado, o Claude pede autorização a quem está vendo.
