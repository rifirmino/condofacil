// Preferências do condomínio que o síndico liga e desliga em Configurações.
export const CONFIGURACOES_PADRAO = { encomendaComQr: true };

export function configuracoes(estado) {
  return { ...CONFIGURACOES_PADRAO, ...(estado.configuracoes || {}) };
}

export function salvarConfiguracoes(estado, mudanca, perfil) {
  if (perfil !== 'sindico') return { estado, erro: 'Somente o síndico pode fazer isso' };
  const validas = Object.fromEntries(Object.entries(mudanca).filter(([k]) => k in CONFIGURACOES_PADRAO));
  return { estado: { ...estado, configuracoes: { ...configuracoes(estado), ...validas } } };
}
