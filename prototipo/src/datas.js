// Datas como texto 'AAAA-MM-DD' no fuso local; instantes como Date ou ISO completo.
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function doisDigitos(n) {
  return String(n).padStart(2, '0');
}

export function isoDia(d) {
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
}

export function deIso(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function somarDias(iso, n) {
  const d = deIso(iso);
  d.setDate(d.getDate() + n);
  return isoDia(d);
}

export function somarMes(anoMes, n) {
  const [a, m] = anoMes.split('-').map(Number);
  return isoDia(new Date(a, m - 1 + n, 1)).slice(0, 7);
}

export function diferencaDias(isoA, isoB) {
  return Math.round((deIso(isoA) - deIso(isoB)) / 86400000);
}

export function momento(iso, hora, minuto = 0) {
  const d = deIso(iso);
  d.setHours(hora, minuto, 0, 0);
  return d;
}

export function horasEntre(a, b) {
  return (b - a) / 3600000;
}

export function diasDoMes(anoMes) {
  const [a, m] = anoMes.split('-').map(Number);
  const total = new Date(a, m, 0).getDate();
  return Array.from({ length: total }, (_, i) => `${anoMes}-${doisDigitos(i + 1)}`);
}

export function fmtDia(iso) {
  const d = deIso(iso);
  return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} ${MESES_CURTOS[d.getMonth()]}`;
}

export function fmtDataCurta(iso) {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export function fmtDataHora(instante) {
  const d = new Date(instante);
  return `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)} ${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
}

export function fmtHora(h) {
  return `${doisDigitos(h)}h`;
}

export function nomeMes(anoMes) {
  const [a, m] = anoMes.split('-').map(Number);
  return `${MESES_LONGOS[m - 1]} de ${a}`;
}

export function haQuanto(instante, agora) {
  const horas = horasEntre(new Date(instante), agora);
  if (horas < 1) return 'agora há pouco';
  if (horas < 24) return `há ${Math.floor(horas)} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}
