import { condominioNovo } from '../implantacao/novo.js';
import { proximaCompetencia } from '../cobranca/regras.js';
import { previaConectada, linhasParaAsaas, aplicarEmissao, aplicarSituacoes, MSG_SEM_CPF } from '../conectado/acoes.js';
import { hostPermitido } from '../conectado/cliente.js';
import { configTeste, AGORA_IMPLANTACAO } from './implantacao.js';
import { igual } from './afirmar.js';

function condominioConectado() {
  const cfg = configTeste();
  return condominioNovo({ ...cfg, id: 'cond-teste', moradores: [{ ...cfg.moradores[0], cpf: '52998224725' }, cfg.moradores[1]], asaas: { situacao: 'aprovada', ambiente: 'sandbox', real: true, walletId: 'wal_1' } }, AGORA_IMPLANTACAO);
}

const cobrancaServidor = (unidade, mais = {}) => ({ referencia: `cond-teste:2026-10:${unidade}`, condominioId: 'cond-teste', competencia: '2026-10', unidade, asaasId: `pay_${unidade}`, valor: 55000, vencimento: '2026-10-10', situacao: 'pendente', pagoEm: null, forma: null, faturaUrl: 'https://sandbox.asaas.com/i/x', boletoUrl: 'https://sandbox.asaas.com/b/x', pixCopiaCola: '000201', pixImagem: 'iVBOR', ...mais });

export const CASOS_CONECTADO = [
  {
    nome: 'conectado: prévia bloqueia quem não tem CPF e monta as linhas do Asaas',
    rodar() {
      const e = condominioConectado();
      const comp = proximaCompetencia(e.financeiro);
      const p = previaConectada(e, comp);
      const linha = (u) => p.linhas.find((l) => l.unidade === u);
      igual([linha('A101').bloqueada, linha('B201').motivo, linha('A102').motivo], [false, MSG_SEM_CPF, 'Sem responsável financeiro']);
      const linhas = linhasParaAsaas(e, comp);
      igual(linhas.map((l) => [l.unidade, l.valor, l.vencimento, l.responsavel.cpf, l.responsavel.email, l.multaPct]), [['A101', 55000, p.vencimento, '52998224725', 'maria@email.com', 2]]);
      igual(linhasParaAsaas(e, comp, ['B201']), []);
    },
  },
  {
    nome: 'conectado: emissão parcial, reenvio sem duplicar e baixa pelo servidor',
    rodar() {
      const e = condominioConectado();
      const r1 = aplicarEmissao(e, '2026-10', [{ unidade: 'A101', ok: true, cobranca: cobrancaServidor('A101') }, { unidade: 'B402', ok: false, erro: 'O CPF informado é inválido.' }], 'sindico', AGORA_IMPLANTACAO);
      const fin1 = r1.estado.financeiro;
      igual([r1.emitidas, fin1.emitidas, fin1.cobrancas.map((c) => c.asaas.referencia), fin1.falhasAsaas['2026-10']], [1, ['2026-10'], ['cond-teste:2026-10:A101'], [{ unidade: 'B402', erro: 'O CPF informado é inválido.' }]]);
      const r2 = aplicarEmissao(r1.estado, '2026-10', [{ unidade: 'B402', ok: true, cobranca: cobrancaServidor('B402') }, { unidade: 'A101', ok: true, cobranca: cobrancaServidor('A101') }], 'sindico', AGORA_IMPLANTACAO);
      igual([r2.estado.financeiro.cobrancas.length, r2.estado.financeiro.falhasAsaas['2026-10'], r2.estado.financeiro.emitidas], [2, [], ['2026-10']]);
      igual(aplicarEmissao(e, '2026-10', [], 'morador', AGORA_IMPLANTACAO).erro, 'Somente o síndico pode fazer isso');
      const pago = aplicarSituacoes(r2.estado, [cobrancaServidor('A101', { situacao: 'paga', pagoEm: '2026-10-23', forma: 'pix' }), cobrancaServidor('B402')], AGORA_IMPLANTACAO);
      const a101 = pago.estado.financeiro.cobrancas.find((c) => c.unidade === 'A101');
      igual([pago.baixas, a101.status, a101.forma, pago.estado.financeiro.saldo > 0, pago.notificacao.texto.startsWith('Pagamento recebido')], [1, 'paga', 'pix', true, true]);
      igual(aplicarSituacoes(pago.estado, [cobrancaServidor('A101', { situacao: 'paga', pagoEm: '2026-10-23', forma: 'pix' })], AGORA_IMPLANTACAO).baixas, 0);
    },
  },
  {
    nome: 'conectado: só fala com o servidor no domínio do app ou na máquina local',
    rodar() {
      igual(['condofacil.cloud', 'www.condofacil.cloud', 'localhost', '127.0.0.1', 'claude.ai', 'app.condofacil.cloud'].map(hostPermitido), [true, true, true, true, false, false]);
    },
  },
];
