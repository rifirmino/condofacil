// Abre cada rota no Chrome headless e confere textos do DOM. Com --capturas, salva PNGs em capturas/.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acharChrome, urlPagina, raiz } from './navegador.mjs';

// [sufixo da URL, textos esperados]; "!" no início = o texto não pode aparecer
const CHECAGENS = [
  ['?teste=1', ['falhas: 0']],
  ['#sindico.inicio', ['Ver como', 'Reiniciar demonstração', 'Residencial Ipê Amarelo']],
  ['#portaria.registrar', ['Ler etiqueta', 'Registrar encomenda', 'Mercado Livre', 'Seu José']],
  ['#portaria.entregar', ['Buscar por código ou unidade', 'Apto 302', 'Parada']],
  ['#portaria.hoje', ['Churrasqueira', 'João Pereira', 'Apto 603']],
  ['#zelador.os', ['Sr. Abel']],
  ['#morador.inicio', ['Olá, Ana', '481203', '730915', 'Retire em breve', 'Fixado pelo síndico', 'Quadra']],
  ['#morador.reservas', ['Salão de festas', 'Academia', 'Minhas reservas']],
  ['#morador.avisos', ['Falta de água', 'não lido']],
  ['#morador.avisos.c1', ['Li e estou ciente', 'Útil · 3']],
  ['#morador.ocorrencias', ['Notificações', 'Vaga ocupada', 'Públicas do condomínio', 'eu também']],
  ['#morador.ocorrencias.nova', ['Manutenção', 'Irregularidade', 'Sugestão ou elogio', 'Enviar notificação']],
  ['#morador.ocorrencias.OC-0042', ['Protocolo OC-0042', 'Ocorrência aberta', 'Previsão de solução']],
  ['#morador.documentos', ['Regimento interno', '!Balancete']],
  ['#morador.encomendas', ['Retirada por Ana Souza']],
  ['#sindico.inicio', ['Reservas pendentes', 'Notificações abertas', '20 de 32 unidades com app', 'Precisa da sua atenção', 'OC-0042: 1ª resposta vencida']],
  ['#sindico.reservas', ['Pendentes de aprovação', 'aprovar-r4', 'Regras das áreas', 'Sem limite']],
  ['#sindico.comunicados', ['Novo comunicado', '19 de 32 unidades leram']],
  ['#sindico.comunicados.c1', ['Confirmação de leitura', '19 de 32 unidades leram']],
  ['#sindico.comunicados.novo', ['Publicar comunicado', 'Trocar o tipo preenche um modelo pronto.']],
  ['#sindico.ocorrencias', ['Notificações', 'OC-0042', 'Anônima', '1ª resposta', 'Solução', 'vencida há', 'Prazos por prioridade', 'Urgente']],
  ['#sindico.ocorrencias.OC-0039', ['Mover para "Resolvida"', 'Encanador agendado', 'OS-003']],
  ['#sindico.ocorrencias.OC-0043', ['Obra fora do horário', 'Irregularidade', 'Advertência ou multa', 'Gerar OS', 'Pedir mais informações', 'Arquivar com justificativa']],
  ['#sindico.documentos', ['Vencido há 3 dias', 'Vence em 25 dias', 'Só conselho']],
  ['#sindico.encomendas', ['Reenviar lembrete', 'Retirada por Beatriz Rocha']],
  ['#morador.preferencias', ['Receber avisos de novos anúncios', 'Você ainda não vende', 'Ana · 302', 'Juliana · 104']],
  ['#morador.vendas', ['Brigadeiro gourmet (caixa com 6)', 'Juliana Costa · apto 104', 'Restam 10', 'Vender']],
  ['#morador.vendas.a1', ['Adicionar à sacola', 'Pix, Dinheiro', 'Retirar no apto, Entrega na porta']],
  ['#morador.vendas.sacola', ['Sua sacola está vazia.']],
  ['#morador.vendas.pedidos', ['Você ainda não fez pedidos.']],
  ['#morador.vendas.loja', ['Quer vender para os vizinhos?', 'Pedir para vender']],
  ['#morador.inicio', ['Novidades na vitrine', 'Bicicleta infantil aro 16']],
  ['#sindico.inicio', ['Aprovar vendedor: Paulo Ribeiro, apto 102']],
  ['#sindico.reservas', ['Plano', 'Básico', 'Intermediário', 'Avançado', 'Preços']],
  ['#morador.inicio', ['Financeiro em dia', 'Avisos']],
  ['#morador.financeiro', ['Responsável financeiro: Ana Souza', 'Histórico', 'Ver recibo', 'Declaração de quitação']],
  ['#morador.mais', ['Avisos']],
  ['#sindico.cobranca', ['Conta Asaas ativa', 'Prévia e emissão', 'Sem responsável financeiro: não será emitida', 'R$ 865,00', 'R$ 1.228,00', 'R$ 1.015,00', 'Emitir 31 cobranças']],
  ['#sindico.cobranca.emitidas', ['Competência', 'Vencida', 'Financeiro › Auditoria']],
  ['#sindico.cobranca.regua', ['30 dias após', 'Disponível no Avançado', 'Executar a régua de hoje']],
  ['#sindico.cobranca.parametros', ['Multa por atraso (%)', 'Taxa e reajustes']],
  ['#sindico.inicio', ['Saldo em caixa', 'R$ 48.350', 'Arrecadado em', '91%', '4 de 32', 'Despesas do mês', 'Despesa superou a receita só em julho', 'Para onde foi o dinheiro', 'Devedores', 'Helena Prado', 'Emitir cobranças de', 'Operação', 'Reservas pendentes']],
  ['#sindico.vendas', ['Salgados assados para festas', 'aprovar-vendedor-102', 'Juliana Costa · apto 104', 'Bicicleta infantil aro 16', 'Pedidos no mês']],
  ['#sindico.cobranca.acordos', ['AC-001', 'Otávio Reis', '1 de 4 parcelas pagas', 'Ativo', 'Novo acordo']],
  ['#sindico.cobranca.AC-001', ['Acordo AC-001 · apto 304', 'Parcela 2/4', 'Vencida', 'Proposta de acordo', 'Desconto em acordo', 'Acordo aceito']],
  ['#sindico.cobranca.novoacordo-704', ['Novo acordo', 'Perdoar a multa', 'Total do acordo', 'Enviar proposta']],
  ['#sindico.inicio', ['Acordo AC-001 (304): parcela 2 vencida', 'Propor acordo', 'acordo ativo', '!>Acordos<small>']],
  ['#sindico.inicio', ['OC-0039: solução vencida há', 'OS-002 concluída: validar', 'CP-001 aguardando aprovação', 'Notificações abertas', '!Em breve · Intermediário</small></span><span class="em-breve" aria-disabled="true">Zelador']],
  ['#sindico.manutencao', ['Manutenção', 'OS-003', 'Em execução', 'Garagem, vaga 12', 'OS-002', 'Concluída', 'Nova OS']],
  ['#sindico.manutencao.compras', ['CP-001', 'Aguardando aprovação', 'Registro de 3/4', 'CP-002', 'Recebida']],
  ['#sindico.manutencao.CP-001', ['Aprovar', 'Recusar', 'Casa do Encanador', 'OS-003']],
  ['#sindico.manutencao.caixa', ['Caixa pequeno', 'Disponível no plano Avançado']],
  ['#sindico.manutencao.OS-002', ['Validar', 'OC-0037', 'Concluída com fotos do depois', 'Foto do depois']],
  ['#zelador.os', ['Seu Antônio', 'OS-003', 'Garagem, vaga 12', 'Nova OS', 'Compras', 'Caixa', '!Saldo em caixa']],
  ['#zelador.os.OS-003', ['Concluir', 'Aguardando material', 'Foto do antes', 'Retomada']],
  ['#zelador.compras', ['CP-001', 'Aguardando aprovação', 'Nova compra']],
  ['#zelador.caixa', ['Disponível no plano Avançado']],
  ['#portaria.hoje', ['Notificação urgente: OC-0039']],
  ['#sindico.escala', ['Semana de', 'Sem ninguém', 'Folga', 'Noite', 'Manhã', 'Tarde', 'Seu José', 'Paulo']],
  ['#sindico.escala.calendario', ['Escala', 'Portaria principal', 'sem ninguém', 'Nossa Senhora Aparecida', 'buracos de cobertura', 'publicada em']],
  ['#sindico.escala.pendencias', ['Trocas aguardando aprovação', 'Turnos descobertos']],
  ['#sindico.escala.equipe', ['Vigilância Prisma', 'Folguista', 'Guarita da garagem']],
  ['#sindico.escala.horas', ['Disponível no plano Avançado']],
  ['#sindico.inicio', ['Gerar a escala de', '!Escala de porteiros']],
  ['#sindico.ocorrencias', ['Processos de infração', 'PI-001', 'Aguardando defesa']],
  ['#sindico.ocorrencias.PI-001', ['Processo PI-001', 'Art. 12', 'R$ 200,00', 'Simular fim do prazo', 'OC-0041']],
  ['#sindico.ocorrencias.OC-0041', ['Advertência ou multa', 'PI-001', 'Abrir processo']],
  ['#morador.ocorrencias', ['!PI-001', '!Notificações para o seu apartamento']],
  ['#sindico.enquetes', ['Enquetes', 'Nova enquete', 'Qual horário a academia deve abrir aos domingos?', 'Rascunho', 'Vencedora: Cinza claro']],
  ['#sindico.enquetes.EN-001', ['14 de 32', 'Enviar lembrete agora', 'Evolução das respostas', 'Quem ainda não respondeu', 'Comentário anônimo', 'sem app', 'faltam 4 dias']],
  ['#sindico.enquetes.EN-002', ['Vencedora: Cinza claro', 'peso por fração ideal', 'Resultado publicado']],
  ['#sindico.enquetes.nova', ['Pergunta', 'Adicionar opção', 'Prévia: como o morador vê', 'Disponível no plano Avançado']],
  ['#morador.inicio', ['Enquete · faltam 4 dias', 'Qual horário a academia deve abrir aos domingos?']],
  ['#morador.enquetes', ['Para responder', 'Encerradas', 'Vencedora: Cinza claro']],
  ['#morador.enquetes.EN-001', ['Enviar voto', 'Voto secreto', 'Às 7h']],
  ['#sindico.financeiro.contas', ['Contas a pagar', 'Dedetização trimestral', 'Vencida', 'Vence hoje', 'Nova conta', 'a pagar nos próximos 30 dias']],
  ['#sindico.financeiro.prestacao', ['Prestação de contas', 'Aberto · parcial', 'Aprovado', 'Saldo final', 'A aprovação digital do conselho é do plano Avançado']],
  ['#sindico.financeiro.fluxo', ['Disponível no plano Avançado']],
  ['#sindico.financeiro.auditoria', ['Toda ação financeira']],
  ['#sindico.inicio', ['Conta vencida: Dedetização trimestral', 'Feche o balancete de']],
  ['#conselho.prestacao', ['Gustavo Freitas', 'Conselheiro fiscal', 'Disponível no plano Avançado', 'Aprovado']],
  ['#conselho.documentos', ['Balancete de', 'Só conselho', 'Prestação de contas de']],
  ['#morador.prestacao', ['Prestação de contas', 'aprovada pelo conselho']],
  ['#sindico.cobranca.orcamento', ['Ordinária necessária', 'PO-001', 'PO-002', 'Comparar', 'Obra do telhado', 'Com a taxa atual, o ano fecha com', 'Orçado atual (12 meses)']],
  ['#sindico.cobranca.taxas', ['Em vigor', 'Pintura da fachada', 'Frações ideais', 'Nova composição', 'Histórico', 'AGO de 28/03', 'Valor fixo por tipo']],
  ['#sindico.cobranca.parametros', ['Parâmetros de cobrança', '!Composição da taxa']],
  ['#morador.financeiro', ['Mudanças na sua taxa', 'Pintura da fachada: R$ 150,00 por mês']],
  ['#portaria.escala', ['Escala da semana', 'Sem ninguém', 'De plantão agora', 'Portaria principal', 'Guarita da garagem', 'Próximo', 'Meus plantões', 'Seu José', 'Propor troca']],
];

// Só larguras de desktop: o Chrome headless impõe janela mínima maior que um celular; a largura de 390 px é medida no e2e.
const CAPTURAS = [
  ['sindico-inicio', '#sindico.inicio', '1366,900'],
  ['sindico-reservas', '#sindico.reservas', '1366,1100'],
  ['sindico-comunicado', '#sindico.comunicados.c1', '1366,900'],
  ['sindico-ocorrencias', '#sindico.ocorrencias', '1366,900'],
  ['morador-inicio', '#morador.inicio', '1366,900'],
  ['morador-reservas', '#morador.reservas', '1366,900'],
  ['portaria-registrar', '#portaria.registrar', '1366,900'],
  ['portaria-entregar', '#portaria.entregar', '1366,900'],
];

const chrome = acharChrome();

function abrir(sufixo, extras) {
  const perfil = mkdtempSync(join(tmpdir(), 'condofacil-chrome-'));
  try {
    const r = spawnSync(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${perfil}`, '--virtual-time-budget=5000', ...extras, urlPagina + sufixo], { encoding: 'utf8', timeout: 90000 });
    return r.stdout || '';
  } finally {
    try { rmSync(perfil, { recursive: true, force: true }); } catch { /* o Windows pode segurar o perfil por um instante */ }
  }
}

let falhas = 0;
for (const [sufixo, textos] of CHECAGENS) {
  // Só o DOM renderizado conta: o código-fonte embutido não pode satisfazer a checagem.
  const dom = abrir(sufixo, ['--dump-dom']).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
  for (const texto of textos) {
    const negar = texto.startsWith('!');
    const alvo = negar ? texto.slice(1) : texto;
    const passou = dom.includes(alvo) !== negar;
    if (!passou) falhas += 1;
    console.log(`${passou ? 'ok   ' : 'FALHA'} ${sufixo} ${negar ? 'sem' : 'com'} "${alvo}"`);
  }
}

if (process.argv.includes('--capturas')) {
  const pasta = join(raiz, 'capturas');
  mkdirSync(pasta, { recursive: true });
  for (const [nome, sufixo, tamanho] of CAPTURAS) {
    abrir(sufixo, [`--screenshot=${join(pasta, `${nome}.png`)}`, `--window-size=${tamanho}`, '--hide-scrollbars']);
    console.log(`captura capturas/${nome}.png`);
  }
}

process.exit(falhas ? 1 : 0);
