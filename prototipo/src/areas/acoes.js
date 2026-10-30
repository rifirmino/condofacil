// Cadastro das áreas comuns pelo síndico: regras de reserva, taxa e o que cada área tem de particular.
export const PERIODOS_PADRAO = [
  { id: 'manha', nome: 'Manhã', inicio: 8, fim: 13 },
  { id: 'tarde', nome: 'Tarde', inicio: 13, fim: 18 },
  { id: 'noite', nome: 'Noite', inicio: 18, fim: 23 },
  { id: 'dia', nome: 'Dia inteiro', inicio: 8, fim: 23 },
];
const SO_SINDICO_AREA = 'Somente o síndico pode fazer isso';

function erroArea(estado, mensagem) {
  return { estado, erro: mensagem };
}

export function areasAtivas(estado) {
  return estado.areas.filter((a) => a.ativa !== false);
}

function idDaArea(areas, nome) {
  const base = String(nome).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'area';
  let id = base;
  for (let n = 2; areas.some((a) => a.id === id); n++) id = `${base}-${n}`;
  return id;
}

function inteiro(valor, vazio = null) {
  const t = String(valor ?? '').trim();
  if (!t) return vazio;
  const n = Number(t.replace(',', '.'));
  return Number.isInteger(n) ? n : NaN;
}

// Os números chegam como texto do formulário; vazio em limite e capacidade quer dizer "sem limite".
export function salvarArea(estado, dados, perfil) {
  if (perfil !== 'sindico') return erroArea(estado, SO_SINDICO_AREA);
  const nome = String(dados.nome || '').trim();
  if (!nome) return erroArea(estado, 'Informe o nome da área');
  const existente = dados.id ? estado.areas.find((a) => a.id === dados.id) : null;
  if (dados.id && !existente) return erroArea(estado, 'Área não encontrada');
  if (estado.areas.some((a) => a.id !== dados.id && a.nome.toLowerCase() === nome.toLowerCase())) return erroArea(estado, 'Já existe uma área com esse nome');
  if (!['periodo', 'hora'].includes(dados.tipo)) return erroArea(estado, 'Escolha como a área é reservada');
  const periodos = PERIODOS_PADRAO.filter((p) => (dados.periodos || []).includes(p.id));
  if (dados.tipo === 'periodo' && !periodos.length) return erroArea(estado, 'Marque ao menos um período');
  const horaInicio = inteiro(dados.horaInicio);
  const horaFim = inteiro(dados.horaFim);
  if (dados.tipo === 'hora' && !(horaInicio >= 0 && horaFim <= 24 && horaInicio < horaFim)) return erroArea(estado, 'Horário de funcionamento inválido: a abertura vem antes do fechamento (0 a 24 h)');
  const taxa = inteiro(dados.taxa, 0);
  if (!(taxa >= 0)) return erroArea(estado, 'Taxa inválida: use reais inteiros, 0 para sem taxa');
  const antecedenciaMin = inteiro(dados.antecedenciaMin, 0);
  const antecedenciaMax = inteiro(dados.antecedenciaMax);
  if (!(antecedenciaMin >= 0) || !(antecedenciaMax >= antecedenciaMin && antecedenciaMax <= 365)) return erroArea(estado, 'Antecedência inválida: a máxima precisa ser maior ou igual à mínima (até 365 dias)');
  const limiteMes = inteiro(dados.limiteMes);
  if (limiteMes !== null && !(limiteMes >= 1)) return erroArea(estado, 'Limite por mês inválido: deixe vazio para sem limite');
  const capacidade = inteiro(dados.capacidade);
  if (capacidade !== null && !(capacidade >= 1)) return erroArea(estado, 'Capacidade inválida: deixe vazio se não houver');
  const id = existente ? existente.id : idDaArea(estado.areas, nome);
  const vinculadas = (dados.vinculadas || []).filter((v) => v !== id && estado.areas.some((a) => a.id === v));
  // Ao trocar de "por período" para "por hora" (ou o contrário), o horário antigo sai do cadastro.
  const anterior = Object.fromEntries(Object.entries(existente || { ativa: true }).filter(([k]) => !['periodos', 'horaInicio', 'horaFim'].includes(k)));
  const area = {
    ...anterior, id, nome, tipo: dados.tipo,
    ...(dados.tipo === 'periodo' ? { periodos } : { horaInicio, horaFim }),
    taxa, aprovacao: dados.aprovacao === 'manual' ? 'manual' : 'automatica', antecedenciaMin, antecedenciaMax, limiteMes, capacidade,
    itens: String(dados.itens || '').trim(), regulamento: String(dados.regulamento || '').trim(), vinculadas,
  };
  // Áreas que dividem o espaço bloqueiam uma à outra: o vínculo vale nos dois sentidos.
  const areas = [...estado.areas.filter((a) => a.id !== id), area].map((a) => {
    if (a.id === id) return a;
    const outras = (a.vinculadas || []).filter((v) => v !== id);
    return { ...a, vinculadas: vinculadas.includes(a.id) ? [...outras, id] : outras };
  });
  const ordem = existente ? estado.areas.map((a) => a.id) : [...estado.areas.map((a) => a.id), id];
  return { estado: { ...estado, areas: ordem.map((x) => areas.find((a) => a.id === x)) }, id };
}

// Desativar tira a área das novas reservas; as reservas já feitas continuam valendo.
export function alternarArea(estado, id, perfil) {
  if (perfil !== 'sindico') return erroArea(estado, SO_SINDICO_AREA);
  const area = estado.areas.find((a) => a.id === id);
  if (!area) return erroArea(estado, 'Área não encontrada');
  const ativa = area.ativa === false;
  return { estado: { ...estado, areas: estado.areas.map((a) => (a.id === id ? { ...a, ativa } : a)) }, ativa };
}
