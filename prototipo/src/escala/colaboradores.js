import { CARGOS, CARGOS_PORTARIA, NOMES_VINCULO, MODELOS, POSTOS } from './dados.js';
import { colaboradores } from './regras.js';
import { apenasDigitos, cpfValido } from '../implantacao/regras.js';

// Cadastro da equipe: dados, vínculo e, para porteiros, a escala fixa que alimenta a geração dos meses seguintes.
export const DIAS_FOLGA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const SO_SINDICO_COLAB = 'Somente o síndico pode fazer isso';

function erroColab(estado, mensagem) {
  return { estado, erro: mensagem };
}

export function escalaDoColaborador(estado, id) {
  return estado.escala.atribuicoes.find((a) => a.porteiro === id) || null;
}

export function textoEscala(a) {
  if (!a) return null;
  const fim = (a.inicio + MODELOS[a.modelo].horas) % 24;
  const dias = MODELOS[a.modelo].ciclo === 2 ? 'dia sim, dia não' : `folga ${DIAS_FOLGA[a.folga].toLowerCase()}`;
  return `${POSTOS[a.posto].nome} · ${MODELOS[a.modelo].nome} · ${a.inicio}h–${fim}h · ${dias}`;
}

function novoId(lista, nome) {
  const base = `col-${String(nome).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 'pessoa'}`;
  let id = base;
  for (let n = 2; lista.some((p) => p.id === id); n++) id = `${base}-${n}`;
  return id;
}

function validarEscala(escala, postos) {
  if (!escala) return null;
  if (!postos.includes(escala.posto)) return 'O posto da escala precisa estar entre os postos do colaborador';
  if (!MODELOS[escala.modelo]) return 'Escolha o modelo da escala';
  const inicio = Number(escala.inicio);
  if (!Number.isInteger(inicio) || inicio < 0 || inicio > 23) return 'Informe a hora de início do turno (0 a 23)';
  if (MODELOS[escala.modelo].ciclo === 2 && !/^\d{4}-\d{2}-\d{2}$/.test(escala.primeiroDia || '')) return 'Informe o dia do primeiro plantão';
  if (MODELOS[escala.modelo].ciclo !== 2 && !(Number(escala.folga) >= 0 && Number(escala.folga) <= 6)) return 'Escolha o dia de folga';
  return null;
}

function atribuicaoDe(id, escala) {
  const base = { porteiro: id, posto: escala.posto, modelo: escala.modelo, inicio: Number(escala.inicio) };
  return MODELOS[escala.modelo].ciclo === 2 ? { ...base, ancora: escala.primeiroDia, paridade: 0 } : { ...base, folga: Number(escala.folga) };
}

export function salvarColaborador(estado, dados, perfil) {
  if (perfil !== 'sindico') return erroColab(estado, SO_SINDICO_COLAB);
  const lista = colaboradores(estado);
  const nome = String(dados.nome || '').trim();
  if (!nome) return erroColab(estado, 'Informe o nome');
  if (!CARGOS[dados.cargo]) return erroColab(estado, 'Escolha o cargo');
  if (!NOMES_VINCULO[dados.vinculo]) return erroColab(estado, 'Escolha o vínculo: CLT ou terceirizado');
  const empresa = dados.vinculo === 'terceirizado' ? String(dados.empresa || '').trim() : '';
  if (dados.vinculo === 'terceirizado' && !empresa) return erroColab(estado, 'Informe a empresa do terceirizado');
  const tel = apenasDigitos(dados.telefone);
  if (tel && (tel.length < 10 || tel.length > 11)) return erroColab(estado, 'Telefone inválido: use DDD + número');
  if (String(dados.cpf || '').trim() && !cpfValido(dados.cpf)) return erroColab(estado, 'CPF inválido');
  const daPortaria = CARGOS_PORTARIA.includes(dados.cargo);
  const postos = daPortaria ? (dados.postos || []).filter((p) => POSTOS[p]) : [];
  if (daPortaria && !postos.length) return erroColab(estado, 'Marque ao menos um posto em que ele trabalha');
  const escala = dados.cargo === 'porteiro' ? dados.escala || null : null;
  const falhaEscala = validarEscala(escala, postos);
  if (falhaEscala) return erroColab(estado, falhaEscala);
  const existente = dados.id ? lista.find((p) => p.id === dados.id) : null;
  if (dados.id && !existente) return erroColab(estado, 'Colaborador não encontrado');
  const id = existente ? existente.id : novoId(lista, nome);
  const registro = { ...(existente || { ativo: true }), id, nome, cargo: dados.cargo, vinculo: dados.vinculo, empresa: empresa || null, telefone: String(dados.telefone || '').trim(), cpf: apenasDigitos(dados.cpf), admissao: dados.admissao || null, postos };
  const novaLista = existente ? lista.map((p) => (p.id === id ? registro : p)) : [...lista, registro];
  const atribuicoes = [...estado.escala.atribuicoes.filter((a) => a.porteiro !== id), ...(escala ? [atribuicaoDe(id, escala)] : [])];
  return {
    estado: { ...estado, colaboradores: novaLista, escala: { ...estado.escala, atribuicoes } },
    id,
    notificacao: existente ? undefined : { canal: 'App', para: nome, texto: `Bem-vindo à equipe do ${estado.condominio.nome}` },
  };
}

// Desligar mantém o nome nos turnos e trocas antigos e tira o colaborador das próximas escalas geradas.
export function alternarAtivo(estado, id, perfil) {
  if (perfil !== 'sindico') return erroColab(estado, SO_SINDICO_COLAB);
  const lista = colaboradores(estado);
  const p = lista.find((x) => x.id === id);
  if (!p) return erroColab(estado, 'Colaborador não encontrado');
  const ativo = p.ativo === false;
  const atribuicoes = ativo ? estado.escala.atribuicoes : estado.escala.atribuicoes.filter((a) => a.porteiro !== id);
  return { estado: { ...estado, colaboradores: lista.map((x) => (x.id === id ? { ...x, ativo } : x)), escala: { ...estado.escala, atribuicoes } }, ativo };
}
