// Postos, porteiros, modelos de turno e feriados da escala (fase 2, parte 4).
export const POSTOS = { portaria: { nome: 'Portaria principal', abre: 0, fecha: 24 }, guarita: { nome: 'Guarita da garagem', abre: 7, fecha: 22 } };
export const PORTEIROS = [
  { id: 'jose', nome: 'Seu José', vinculo: 'clt', empresa: null, telefone: '(11) 98811-2040', postos: ['portaria'] },
  { id: 'marcos', nome: 'Marcos', vinculo: 'clt', empresa: null, telefone: '(11) 97720-3151', postos: ['portaria', 'guarita'] },
  { id: 'edson', nome: 'Edson', vinculo: 'terceirizado', empresa: 'Vigilância Prisma', telefone: '(11) 96630-4262', postos: ['portaria'] },
  { id: 'rita', nome: 'Rita', vinculo: 'terceirizado', empresa: 'Vigilância Prisma', telefone: '(11) 95540-5373', postos: ['portaria'] },
  { id: 'claudia', nome: 'Cláudia', vinculo: 'clt', empresa: null, telefone: '(11) 94450-6484', postos: ['guarita'] },
  { id: 'bruno', nome: 'Bruno', vinculo: 'clt', empresa: null, telefone: '(11) 93360-7595', postos: ['guarita', 'portaria'] },
  { id: 'paulo', nome: 'Paulo', vinculo: 'folguista', empresa: null, telefone: '(11) 92270-8606', postos: ['portaria', 'guarita'] },
];
export const EMPRESAS = { 'Vigilância Prisma': { contato: 'Central Prisma', telefone: '(11) 4433-9000' } };
export const NOMES_VINCULO = { clt: 'CLT do condomínio', terceirizado: 'Terceirizado', folguista: 'Folguista' };
export const MODELOS = { '12x36': { nome: '12x36', horas: 12, ciclo: 2 }, '6x1': { nome: '6x1 (8 h)', horas: 8, ciclo: 7 }, noturno: { nome: 'Noturno 12x36', horas: 12, ciclo: 2 } };
export const FERIADOS = { '01-01': 'Confraternização universal', '04-08': 'Aniversário de Santo André', '04-21': 'Tiradentes', '05-01': 'Dia do Trabalho', '09-07': 'Independência', '10-12': 'Nossa Senhora Aparecida', '11-02': 'Finados', '11-15': 'Proclamação da República', '11-20': 'Consciência Negra', '12-25': 'Natal' };
export const NOMES_MOTIVO = { ferias: 'férias', falta: 'falta', atestado: 'atestado' };

export function atribuicoesIniciais(mes) {
  const ancora = `${mes}-01`;
  return [
    { porteiro: 'jose', posto: 'portaria', modelo: '12x36', inicio: 7, ancora, paridade: 0 },
    { porteiro: 'marcos', posto: 'portaria', modelo: '12x36', inicio: 7, ancora, paridade: 1 },
    { porteiro: 'edson', posto: 'portaria', modelo: 'noturno', inicio: 19, ancora, paridade: 0 },
    { porteiro: 'rita', posto: 'portaria', modelo: 'noturno', inicio: 19, ancora, paridade: 1 },
    { porteiro: 'claudia', posto: 'guarita', modelo: '6x1', inicio: 7, folga: 0 },
    { porteiro: 'bruno', posto: 'guarita', modelo: '6x1', inicio: 15, folga: 1 },
  ];
}
