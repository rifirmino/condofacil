// Asserções mínimas que rodam tanto no Node quanto no navegador (?teste=1).
export const AGORA_TESTE = new Date(2026, 9, 8, 10, 0);

export function igual(obtido, esperado, contexto = '') {
  const a = JSON.stringify(obtido);
  const b = JSON.stringify(esperado);
  if (a !== b) throw new Error(`${contexto ? `${contexto}: ` : ''}esperado ${b}, obtido ${a}`);
}

export const AGORA_FASE2 = new Date(2026, 9, 19, 10, 0);
