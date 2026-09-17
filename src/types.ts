export type PostoGraduacao = 
  | 'Cel'
  | 'Ten-Cel'
  | 'Maj'
  | 'Cap'
  | '1º Ten'
  | '2º Ten'
  | 'Subten'
  | '1º Sgt'
  | '2º Sgt'
  | '3º Sgt'
  | 'Cb'
  | 'Sd';

export type SituacaoPadrao = 
  | 'À Disposição'
  | 'LTS'
  | 'Férias'
  | 'Pronto'
  | 'De Serviço'
  | 'Folga'
  | 'Dispensa Recompensa'
  | 'Curso / Missão';

export type SituacaoOperacional = string;

export type EscalaTipo = 'SOLO' | 'FT' | '24H' | 'ADMIN' | 'EXPEDIENTE';

export interface EfetivoMilitar {
  id: string;
  matricula: string;
  postoGraduacao: PostoGraduacao;
  nomeGuerra: string;
  nomeCompleto: string;
  situacao: string; // Local na escala (ex: 'RP 01', 'Guarda do Quartel') ou ('À Disposição', 'LTS', 'Férias')
  localEscala?: string;
  funcao: string;
  contato: string;
  dataAdmissao: string;
  escalaTipo: EscalaTipo;
  grupoEscala?: string;
  observacao?: string;
  dataRetorno?: string; // Para Férias, LTS ou Dispensa
}

export interface EscalaItemParsed {
  localEscala: string;
  postoGraduacao?: string;
  nomeGuerra?: string;
  matricula?: string;
  rawText?: string;
  matchedMilitarId?: string;
}

export interface EscalaPdfResult {
  titulo: string;
  dataEscala?: string;
  itensEscalados: EscalaItemParsed[];
  itensAfastados: { militarId?: string; nome: string; status: 'LTS' | 'Férias'; posto?: string; matricula?: string }[];
  totalEscalados: number;
  militaresEncontrados?: EfetivoMilitar[];
}

export interface SoldierService {
  name: string;
  lastService: Date | null;
  history: { day: number; month: number; original: string }[];
  allServices: Date[];
}

export interface MilitaryPerson {
  rank: string;
  id: string;
  name: string;
  group: string;
  type: 'SOLO' | 'FT' | '24H' | 'ADMIN';
}

export interface DayAssignment {
  day: number;
  dayShift: string;
  nightShift?: string;
  type: 'SOLO' | 'FT' | '24H' | 'ADMIN';
}

export interface ScaleData {
  monthYear: string;
  assignments: DayAssignment[];
  soldiers: MilitaryPerson[];
}

export interface DashboardMetrics {
  // Métricas Principais Operacionais Solicitadas:
  efetivoTotalPrevisto: number; // 400 fixado
  efetivoExistente: number; // Total no arquivo Excel adicionado / banco
  efetivoDisponivel: number; // Existente subtraído LTS, à disposição e férias
  atividadeFimGeral: number; // Militares em escala subtraído Administrativo
  atividadeMeio: number; // Militares no Administrativo

  // Detalhamento de Afastados / Indisponíveis:
  ltsCount: number;
  feriasCount: number;
  aDisposicaoCount: number;

  // Métricas de apoio / compatibilidade:
  totalEfetivo: number;
  prontos: number;
  deServicoHoje: number;
  emFolga: number;
  afastados: number; // Ferias + LTS + Dispensa + Curso
  aptosExtra: number;
  taxaProntidao: number; // porcentagem
  distribuicaoPostos: { posto: string; quantidade: number; percentual: number }[];
  militaresServicoHoje: EfetivoMilitar[];
  ultimosAvisos: { id: string; tipo: 'info' | 'alerta' | 'urgente'; titulo: string; data: string; descricao: string }[];
}

export type MesAno = 
  | 'Janeiro'
  | 'Fevereiro'
  | 'Março'
  | 'Abril'
  | 'Maio'
  | 'Junho'
  | 'Julho'
  | 'Agosto'
  | 'Setembro'
  | 'Outubro'
  | 'Novembro'
  | 'Dezembro';

export interface PrevisaoFerias {
  id: string;
  matricula: string;
  nome: string;
  nomeGuerra?: string;
  posto: PostoGraduacao;
  ano: number;
  anoReferencia?: number; // Ano a que a férias se refere (Coluna L)
  mesPrevisto: MesAno | string;
  periodoDias?: number; // 30, 15, etc. (Coluna M)
  dataInicio?: string;
  dataFim?: string;
  situacao: 'Prevista' | 'Em Gozo' | 'Concluída' | 'Interrompida';
  observacao?: string;
}
