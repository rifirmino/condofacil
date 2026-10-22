import { CATEGORIAS_DESPESA, mesmoDiaDoMes } from '../cobranca/dados.js';
import { podeOperar, fmtReais } from '../cobranca/regras.js';
import { SO_SINDICO, comFinanceiro, comAuditoria } from '../cobranca/acoes.js';
import { liberado } from '../planos.js';
import { isoDia } from '../datas.js';

// Ações do financeiro operacional: contas a pagar (Intermediário). Toda saída de caixa entra na auditoria.
function erroFinanceiro(estado, mensagem) {
  return { estado, erro: mensagem };
}

function guardaFinanceiro(estado, perfil, recurso) {
  if (!podeOperar(perfil)) return SO_SINDICO;
  if (!liberado(estado.plano, recurso)) return `Disponível no plano ${recurso === 'aprovacaoConselho' || recurso === 'fluxoCaixa' ? 'Avançado' : 'Intermediário'}`;
  return null;
}

function idConta(n) {
  return `CT-${String(n).padStart(3, '0')}`;
}

export function novaConta(estado, dados, perfil) {
  const falha = guardaFinanceiro(estado, perfil, 'contasPagar');
  if (falha) return erroFinanceiro(estado, falha);
  const fornecedor = String(dados.fornecedor || '').trim();
  if (!fornecedor) return erroFinanceiro(estado, 'Informe o fornecedor');
  if (!CATEGORIAS_DESPESA[dados.categoria]) return erroFinanceiro(estado, 'Escolha a categoria');
  if (!(dados.valor > 0)) return erroFinanceiro(estado, 'Informe o valor');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dados.vencimento || ''))) return erroFinanceiro(estado, 'Informe o vencimento');
  const fin = estado.financeiro;
  const id = idConta(fin.proximaConta);
  const conta = { id, fornecedor, categoria: dados.categoria, descricao: String(dados.descricao || '').trim() || fornecedor, valor: Math.round(dados.valor), vencimento: dados.vencimento, recorrente: !!dados.recorrente, situacao: 'aberta', pagaEm: null, comprovante: null, boleto: `boleto-${id}.pdf` };
  return { estado: comFinanceiro(estado, { contas: [...fin.contas, conta], proximaConta: fin.proximaConta + 1 }), id };
}

export function pagarConta(estado, id, perfil, agora) {
  const falha = guardaFinanceiro(estado, perfil, 'contasPagar');
  if (falha) return erroFinanceiro(estado, falha);
  const fin = estado.financeiro;
  const conta = fin.contas.find((c) => c.id === id);
  if (!conta) return erroFinanceiro(estado, 'Conta não encontrada');
  if (conta.situacao === 'paga') return erroFinanceiro(estado, 'Esta conta já foi paga');
  const paga = { ...conta, situacao: 'paga', pagaEm: agora.toISOString(), comprovante: `comprovante-${id}.pdf` };
  let contas = fin.contas.map((c) => (c.id === id ? paga : c));
  let proximaConta = fin.proximaConta;
  let seguinte = null;
  if (conta.recorrente) {
    seguinte = { ...conta, id: idConta(proximaConta), vencimento: mesmoDiaDoMes(conta.vencimento, 1), situacao: 'aberta', pagaEm: null, comprovante: null, boleto: `boleto-${idConta(proximaConta)}.pdf` };
    contas = [...contas, seguinte];
    proximaConta += 1;
  }
  const novo = comFinanceiro(estado, {
    contas, proximaConta,
    despesasMes: { ...fin.despesasMes, [conta.categoria]: fin.despesasMes[conta.categoria] + conta.valor },
    saldo: fin.saldo - conta.valor,
    auditoria: comAuditoria(estado, agora, 'Conta paga', `${id} · ${conta.descricao} · ${fmtReais(conta.valor)} · ${CATEGORIAS_DESPESA[conta.categoria]}`),
  });
  return {
    estado: novo,
    seguinte: seguinte && seguinte.id,
    notificacao: { canal: 'Asaas · pagamento de contas', para: conta.fornecedor, texto: `Pagamento de ${fmtReais(conta.valor)} enviado em ${isoDia(agora).split('-').reverse().join('/')} · comprovante anexado${seguinte ? ` · próxima conta em ${seguinte.vencimento.split('-').reverse().join('/')}` : ''}` },
  };
}
