import { clienteAsaas } from './asaas.mjs';

// Conferência manual contra o sandbox real do Asaas, antes de publicar. A chave fica só numa variável de ambiente
// deste computador: ASAAS_API_KEY=... ASAAS_URL=https://api-sandbox.asaas.com/v3 npm run sandbox
const url = process.env.ASAAS_URL || 'https://api-sandbox.asaas.com/v3';
if (!/sandbox/.test(url)) { console.error('Use só a URL do sandbox'); process.exit(1); }
if (!process.env.ASAAS_API_KEY) { console.error('Defina ASAAS_API_KEY com a chave do sandbox'); process.exit(1); }

const raiz = clienteAsaas({ url, chave: process.env.ASAAS_API_KEY });
const hoje = new Date();
const daqui = (dias) => new Date(hoje.getTime() + dias * 86400000).toISOString().slice(0, 10);
const passo = async (nome, fn) => {
  try {
    const r = await fn();
    console.log(`ok    ${nome}`);
    return r;
  } catch (e) {
    console.log(`FALHA ${nome}: ${e.mensagem || e.message}`);
    process.exit(1);
  }
};

const conta = await passo('criar subconta (companyType ASSOCIATION)', () => raiz.post('/accounts', {
  name: `CondoFácil Teste ${daqui(0)}`, email: `teste+${Date.now()}@condofacil.cloud`, cpfCnpj: '11222333000181', companyType: 'ASSOCIATION',
  mobilePhone: '11925913118', incomeValue: 10000, postalCode: '01310100', address: 'Av. Paulista', addressNumber: '1000', province: 'Bela Vista',
}));
console.log(`      subconta ${conta.id} · carteira ${conta.walletId}`);
const sub = clienteAsaas({ url, chave: conta.apiKey });
const cliente = await passo('criar cliente com notificações desligadas', () => sub.post('/customers', { name: 'Maria Silva (teste)', cpfCnpj: '52998224725', notificationDisabled: true, externalReference: 'A101' }));
const ref = `sandbox:${daqui(0)}:A101:${Date.now()}`;
const pagamento = await passo('criar cobrança de R$ 10,00', () => sub.post('/payments', { customer: cliente.id, billingType: 'UNDEFINED', value: 10, dueDate: daqui(5), description: 'Teste CondoFácil', externalReference: ref, fine: { value: 2 }, interest: { value: 1 } }));
console.log(`      fatura ${pagamento.invoiceUrl}`);
const pix = await passo('buscar QR Code Pix', () => sub.get(`/payments/${pagamento.id}/pixQrCode`).catch((e) => ({ semPix: e.mensagem })));
console.log(pix.semPix ? `      sem Pix nesta subconta: ${pix.semPix} (boleto e fatura continuam valendo)` : '      Pix copia e cola recebido');
await passo('simular pagamento (receiveInCash)', () => sub.post(`/payments/${pagamento.id}/receiveInCash`, { paymentDate: daqui(0), value: 10 }));
const final = await passo('conferir situação', () => sub.get(`/payments/${pagamento.id}`));
console.log(`      situação final: ${final.status}`);
