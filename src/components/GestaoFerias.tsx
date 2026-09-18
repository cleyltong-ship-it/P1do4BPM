import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Upload, 
  Plus, 
  Download, 
  Search, 
  Filter, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileSpreadsheet, 
  FileText, 
  Users, 
  Edit3, 
  Trash2, 
  X,
  Building2,
  CalendarRange,
  ShieldAlert,
  BarChart3,
  TrendingUp,
  Layers,
  Sparkles,
  Check
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Cell,
  LabelList
} from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PrevisaoFerias, MesAno, EfetivoMilitar, PostoGraduacao } from '../types';
import { MESES_DO_ANO } from '../services/feriasFileParser';
import { ImportFeriasModal } from './ImportFeriasModal';

// Categorias excluídas do cálculo do impacto no serviço operacional
export type CategoriaNaoOperacional = 
  | 'Administrativo' 
  | 'Supervisor' 
  | 'Comandante' 
  | 'Subcomandante' 
  | 'LTS' 
  | 'À Disposição';

export interface NaoOperacionalInfo {
  isNaoOperacional: boolean;
  categoria?: CategoriaNaoOperacional;
  detalhe?: string;
}

/**
 * Identifica se o militar pertence a uma das categorias não-operacionais:
 * "Administrativo", "Supervisor", "Comandante", "Subcomandante", "LTS" e "À Disposição".
 * Esses militares não compõem a escala básica de guarnições/viaturas de rua,
 * de modo que sua ausência não desfalca o serviço operacional de rua.
 */
export function checkMilitarNaoOperacional(
  item: PrevisaoFerias, 
  efetivo: EfetivoMilitar[]
): NaoOperacionalInfo {
  const norm = (str?: string) => 
    (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();

  const cleanDigits = (s?: string) => (s || '').replace(/[^0-9]/g, '');

  const itemMatDigits = cleanDigits(item.matricula);
  const m = efetivo.find(e => {
    if (itemMatDigits && cleanDigits(e.matricula) === itemMatDigits) return true;
    if (e.matricula && item.matricula && e.matricula.trim() === item.matricula.trim()) return true;
    if (e.nomeCompleto && item.nome && norm(e.nomeCompleto) === norm(item.nome)) return true;
    if (e.nomeGuerra && item.nomeGuerra && norm(e.nomeGuerra) === norm(item.nomeGuerra)) return true;
    return false;
  });

  const situacao = norm(m?.situacao);
  const funcao = norm(m?.funcao);
  const escalaTipo = norm(m?.escalaTipo);
  const posto = norm(item.posto || m?.postoGraduacao);
  const obs = norm(item.observacao || m?.observacao);

  // 1. LTS (Licença para Tratamento de Saúde / Atestados Médicos)
  if (
    situacao.includes('LTS') || 
    funcao.includes('LTS') || 
    obs.includes('LTS') || 
    situacao.includes('MEDIC') || 
    obs.includes('ATESTADO') ||
    situacao.includes('SAUDE')
  ) {
    return { isNaoOperacional: true, categoria: 'LTS', detalhe: m?.situacao || 'LTS' };
  }

  // 2. À Disposição (Adido, AD, outro órgão)
  if (
    situacao.includes('DISPOSIC') || 
    situacao === 'AD' || 
    funcao.includes('DISPOSIC') || 
    obs.includes('DISPOSIC') || 
    obs === 'AD'
  ) {
    return { isNaoOperacional: true, categoria: 'À Disposição', detalhe: m?.situacao || 'À Disposição' };
  }

  // 3. Subcomandante (verificado antes de Comandante para evitar falso-positivo)
  if (
    funcao.includes('SUBCOMANDANTE') || 
    funcao.includes('SUB COMANDANTE') || 
    funcao.includes('SUB-COMANDANTE') || 
    funcao.includes('SUBCMD') || 
    obs.includes('SUBCOMANDANTE')
  ) {
    return { isNaoOperacional: true, categoria: 'Subcomandante', detalhe: m?.funcao || 'Subcomandante' };
  }

  // 4. Comandante (Comandante de Batalhão, Cia, Oficiais de Comando, etc.)
  if (
    funcao.includes('COMANDANTE') || 
    funcao.includes('CMT') || 
    funcao.includes('OFICIAL / COMANDO') || 
    obs.includes('COMANDANTE') || 
    ['CEL', 'TEN-CEL', 'MAJ'].includes(posto)
  ) {
    return { isNaoOperacional: true, categoria: 'Comandante', detalhe: m?.funcao || `${posto} / Comando` };
  }

  // 5. Supervisor (Supervisores de Oficial, Supervisão de área, Auxiliar do Oficial de Operações)
  if (
    funcao.includes('SUPERVISOR') || 
    funcao.includes('SUPERVISAO') || 
    funcao.includes('AUX. DO OF') ||
    funcao.includes('AUXILIAR DO SUPERVISOR') ||
    situacao.includes('SUPERVISOR') ||
    situacao.includes('AUX. DO OF') ||
    situacao.includes('AUXILIAR DO SUPERVISOR') ||
    obs.includes('SUPERVISOR')
  ) {
    return { isNaoOperacional: true, categoria: 'Supervisor', detalhe: m?.funcao || m?.situacao || 'Supervisor' };
  }

  // 6. Administrativo (Expediente, P1, P2, P3, P4, P5, Reserva de Armamento, Armeiro, Secretaria)
  if (
    situacao.includes('ADMIN') || 
    situacao.includes('ARMEIRO') ||
    situacao.includes('RESERVA DE ARMAMENTO') ||
    funcao.includes('ADMIN') || 
    funcao.includes('ARMEIRO') ||
    funcao.includes('EXPEDIENTE') || 
    funcao.includes('P1') || 
    funcao.includes('P2') || 
    funcao.includes('P3') || 
    funcao.includes('P4') || 
    funcao.includes('P5') || 
    funcao.includes('ESTADO-MAIOR') || 
    funcao.includes('ESTADO MAIOR') || 
    funcao.includes('SEDE') || 
    funcao.includes('RESERVA DE ARMAMENTO') || 
    funcao.includes('SECRETARIA') || 
    funcao.includes('TESOURARIA') || 
    escalaTipo === 'ADMIN' || 
    escalaTipo === 'EXPEDIENTE' || 
    obs.includes('ADMIN')
  ) {
    return { isNaoOperacional: true, categoria: 'Administrativo', detalhe: m?.funcao || m?.situacao || 'Administrativo' };
  }

  return { isNaoOperacional: false };
}

export interface CruzamentoMilitarInfo {
  militar?: EfetivoMilitar;
  encontradoNoEfetivo: boolean;
  matricula: string;
  setorEscala: string;
  isNaoOperacional: boolean;
  categoriaNaoOperacional?: CategoriaNaoOperacional;
  detalheSetor: string;
  escalaTipo?: string;
  funcao?: string;
}

/**
 * Realiza o cruzamento de dados entre a relação de Férias e a Gestão de Efetivo
 * utilizando a MATRÍCULA como identificador primário, resgatando o setor na escala
 * (Solo, Força Tática, Base Comunitária, Administrativo, etc.) e classificando o impacto operacional real.
 */
export function getCruzamentoMilitar(
  item: PrevisaoFerias, 
  efetivo: EfetivoMilitar[]
): CruzamentoMilitarInfo {
  const norm = (str?: string) => 
    (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();

  const cleanDigits = (s?: string) => (s || '').replace(/\D/g, '');

  const itemMatDigits = cleanDigits(item.matricula);

  // 1. Cruzamento prioritário pela Matrícula (chave única do militar)
  let m = efetivo.find(e => {
    if (itemMatDigits && itemMatDigits.length >= 4 && cleanDigits(e.matricula) === itemMatDigits) return true;
    if (e.matricula && item.matricula && e.matricula.trim().toLowerCase() === item.matricula.trim().toLowerCase()) return true;
    return false;
  });

  // 2. Fallback de correspondência segura por nome (sem colisões de sobrenomes soltos)
  if (!m && item.nome) {
    const itemNome = norm(item.nome);
    // Correspondência exata de nome completo
    m = efetivo.find(e => norm(e.nomeCompleto) === itemNome);

    // Correspondência por primeiro e último nome (apenas quando ambos possuem 2 ou mais nomes)
    if (!m) {
      const itemParts = itemNome.split(/\s+/).filter(Boolean);
      if (itemParts.length >= 2) {
        const first = itemParts[0];
        const last = itemParts[itemParts.length - 1];
        if (first.length >= 3 && last.length >= 3) {
          m = efetivo.find(e => {
            const eParts = norm(e.nomeCompleto).split(/\s+/).filter(Boolean);
            return eParts.length >= 2 && eParts[0] === first && eParts[eParts.length - 1] === last;
          });
        }
      }
    }

    // Se o item contém apenas 1 palavra (ex: nome de guerra "ROCHA"), buscar no nome de guerra
    if (!m) {
      const itemParts = itemNome.split(/\s+/).filter(Boolean);
      if (itemParts.length === 1 && itemParts[0].length >= 3) {
        m = efetivo.find(e => norm(e.nomeGuerra) === itemParts[0]);
      }
    }
  }

  const check = checkMilitarNaoOperacional(item, efetivo);

  // Setor ou local da escala resgatado da Gestão de Efetivo
  let setor = 'Operacional de Rua';
  if (m) {
    setor = m.situacao || m.localEscala || m.funcao || 'Operacional de Rua';
  } else if (check.isNaoOperacional && check.categoria) {
    setor = check.categoria;
  }

  return {
    militar: m,
    encontradoNoEfetivo: !!m,
    matricula: item.matricula,
    setorEscala: setor,
    isNaoOperacional: check.isNaoOperacional,
    categoriaNaoOperacional: check.categoria,
    detalheSetor: check.detalhe || setor,
    escalaTipo: m?.escalaTipo,
    funcao: m?.funcao
  };
}

interface GestaoFeriasProps {
  ferias: PrevisaoFerias[];
  efetivo: EfetivoMilitar[];
  onAddFerias: (record: Omit<PrevisaoFerias, 'id'>) => void;
  onUpdateFerias: (id: string, updates: Partial<PrevisaoFerias>) => void;
  onDeleteFerias: (id: string) => void;
  onImportFerias: (records: PrevisaoFerias[], mode: 'replace' | 'merge') => void;
}

export const GestaoFerias: React.FC<GestaoFeriasProps> = ({
  ferias,
  efetivo,
  onAddFerias,
  onUpdateFerias,
  onDeleteFerias,
  onImportFerias
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('TODOS');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('TODOS');
  const [chartViewMode, setChartViewMode] = useState<'restantes' | 'todos'>('restantes');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PrevisaoFerias | null>(null);

  // Form states for manual add/edit
  const [formMatricula, setFormMatricula] = useState('');
  const [formNome, setFormNome] = useState('');
  const [formPosto, setFormPosto] = useState<PostoGraduacao>('Sd');
  const [formMes, setFormMes] = useState<MesAno>('Janeiro');
  const [formDias, setFormDias] = useState(30);
  const [formDataInicio, setFormDataInicio] = useState('');
  const [formDataFim, setFormDataFim] = useState('');
  const [formSituacao, setFormSituacao] = useState<PrevisaoFerias['situacao']>('Prevista');
  const [formObs, setFormObs] = useState('');

  const currentMonthIndex = new Date().getMonth();
  const currentMonthName = MESES_DO_ANO[currentMonthIndex];

  // Count by month for the selected year
  const countByMonth = useMemo(() => {
    const counts: Record<string, number> = {};
    MESES_DO_ANO.forEach(m => {
      counts[m] = 0;
    });

    ferias.forEach(f => {
      if (f.ano === selectedYear && counts[f.mesPrevisto] !== undefined) {
        counts[f.mesPrevisto]++;
      }
    });

    return counts;
  }, [ferias, selectedYear]);

  // Filtered list
  const filteredFerias = useMemo(() => {
    return ferias.filter(item => {
      if (item.ano !== selectedYear) return false;
      if (selectedMonth !== 'TODOS' && item.mesPrevisto !== selectedMonth) return false;
      if (selectedStatus !== 'TODOS' && item.situacao !== selectedStatus) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const mat = (item.matricula || '').toLowerCase();
        const nome = (item.nome || '').toLowerCase();
        const guerra = (item.nomeGuerra || '').toLowerCase();
        const posto = (item.posto || '').toLowerCase();
        // Buscar também pelo nome completo do militar cadastrado no efetivo
        const m = efetivo.find(e => e.matricula && item.matricula && e.matricula.trim() === item.matricula.trim());
        const nomeCompletoEfetivo = (m?.nomeCompleto || '').toLowerCase();
        if (!mat.includes(term) && !nome.includes(term) && !nomeCompletoEfetivo.includes(term) && !guerra.includes(term) && !posto.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [ferias, selectedYear, selectedMonth, selectedStatus, searchTerm, efetivo]);

  // Quick stats
  const totalAno = ferias.filter(f => f.ano === selectedYear).length;
  const currentYear = new Date().getFullYear();
  
  // Em Gozo Atualmente - Quantidade referente ao mês atual
  const emGozoCount = ferias.filter(f => {
    if (f.ano !== selectedYear) return false;
    const normMes = (f.mesPrevisto || '').toString().trim().toLowerCase();
    const isCurrentMonth = normMes === currentMonthName.toLowerCase() ||
                          normMes.startsWith(currentMonthName.slice(0, 3).toLowerCase());
    return f.situacao === 'Em Gozo' || isCurrentMonth;
  }).length;

  // "PREVISTAS PARA FRUIR": soma das férias previstas para os meses que faltam ser gozadas.
  // Exemplo: se atualmente estamos em setembro, soma as férias previstas para outubro, novembro e dezembro.
  const previstasCount = useMemo(() => {
    return ferias.filter(f => {
      if (f.ano !== selectedYear) return false;
      const monthIdx = MESES_DO_ANO.findIndex(m => 
        m.toLowerCase() === (f.mesPrevisto || '').toString().trim().toLowerCase()
      );
      if (monthIdx === -1) return false;

      if (selectedYear === currentYear) {
        // Apenas meses estritamente posteriores ao mês atual (que ainda faltam gozar)
        return monthIdx > currentMonthIndex;
      } else if (selectedYear > currentYear) {
        // Ano futuro: todas as férias agendadas ainda faltam ser gozadas
        return true;
      } else {
        // Ano passado
        return false;
      }
    }).length;
  }, [ferias, selectedYear, currentYear, currentMonthIndex]);

  // Férias Concluídas: meses anteriores ao atual no ano corrente, ou anos passados, ou com status 'Concluída'
  const concluidasCount = useMemo(() => {
    return ferias.filter(f => {
      if (f.ano !== selectedYear) return false;
      if (f.situacao === 'Concluída') return true;
      const monthIdx = MESES_DO_ANO.findIndex(m => 
        m.toLowerCase() === (f.mesPrevisto || '').toString().trim().toLowerCase()
      );
      if (monthIdx === -1) return false;

      if (selectedYear < currentYear) return true;
      if (selectedYear === currentYear) {
        return monthIdx < currentMonthIndex && f.situacao !== 'Em Gozo';
      }
      return false;
    }).length;
  }, [ferias, selectedYear, currentYear, currentMonthIndex]);

  // Estatísticas operacionais por mês
  const monthlyOperationalStats = useMemo(() => {
    const stats: Record<string, { 
      total: number; 
      naoOperacionais: number; 
      impactoOperacional: number; 
      porCategoria: Record<CategoriaNaoOperacional, number> 
    }> = {};

    MESES_DO_ANO.forEach(m => {
      stats[m] = {
        total: 0,
        naoOperacionais: 0,
        impactoOperacional: 0,
        porCategoria: {
          'Administrativo': 0,
          'Supervisor': 0,
          'Comandante': 0,
          'Subcomandante': 0,
          'LTS': 0,
          'À Disposição': 0
        }
      };
    });

    ferias.forEach(f => {
      if (f.ano !== selectedYear) return;
      const m = f.mesPrevisto;
      if (!stats[m]) return;

      stats[m].total++;
      const check = checkMilitarNaoOperacional(f, efetivo);
      if (check.isNaoOperacional && check.categoria) {
        stats[m].naoOperacionais++;
        stats[m].porCategoria[check.categoria] = (stats[m].porCategoria[check.categoria] || 0) + 1;
      }
    });

    MESES_DO_ANO.forEach(m => {
      stats[m].impactoOperacional = Math.max(0, stats[m].total - stats[m].naoOperacionais);
    });

    return stats;
  }, [ferias, efetivo, selectedYear]);

  // Estatísticas operacionais consolidadas do filtro de mês selecionado
  const currentSelectedStats = useMemo(() => {
    if (selectedMonth === 'TODOS') {
      let total = 0;
      let naoOperacionais = 0;
      const porCategoria: Record<CategoriaNaoOperacional, number> = {
        'Administrativo': 0,
        'Supervisor': 0,
        'Comandante': 0,
        'Subcomandante': 0,
        'LTS': 0,
        'À Disposição': 0
      };

      MESES_DO_ANO.forEach(m => {
        const s = monthlyOperationalStats[m];
        if (s) {
          total += s.total;
          naoOperacionais += s.naoOperacionais;
          (Object.keys(s.porCategoria) as CategoriaNaoOperacional[]).forEach(cat => {
            porCategoria[cat] = (porCategoria[cat] || 0) + s.porCategoria[cat];
          });
        }
      });

      return {
        monthLabel: 'Todos os Meses',
        isAll: true,
        total,
        naoOperacionais,
        impactoOperacional: Math.max(0, total - naoOperacionais),
        porCategoria
      };
    }

    const s = monthlyOperationalStats[selectedMonth] || {
      total: 0,
      naoOperacionais: 0,
      impactoOperacional: 0,
      porCategoria: {
        'Administrativo': 0,
        'Supervisor': 0,
        'Comandante': 0,
        'Subcomandante': 0,
        'LTS': 0,
        'À Disposição': 0
      }
    };

    return {
      monthLabel: selectedMonth,
      isAll: false,
      total: s.total,
      naoOperacionais: s.naoOperacionais,
      impactoOperacional: s.impactoOperacional,
      porCategoria: s.porCategoria
    };
  }, [selectedMonth, monthlyOperationalStats]);

  // Meses restantes ou ano completo para o gráfico de barras
  const mesesParaGrafico = useMemo(() => {
    if (selectedYear > currentYear) {
      // Ano futuro: todos os 12 meses são restantes
      return MESES_DO_ANO;
    } else if (selectedYear === currentYear) {
      if (chartViewMode === 'restantes') {
        // Do mês atual até dezembro (ex: Setembro a Dezembro)
        return MESES_DO_ANO.slice(currentMonthIndex);
      }
      return MESES_DO_ANO;
    } else {
      return MESES_DO_ANO;
    }
  }, [selectedYear, currentYear, currentMonthIndex, chartViewMode]);

  // Cruzamento detalhado de informações com a Gestão de Efetivo por Matrícula para o gráfico
  const dadosGraficoImpacto = useMemo(() => {
    return mesesParaGrafico.map(mes => {
      const feriasDoMes = ferias.filter(f => f.ano === selectedYear && f.mesPrevisto === mes);
      
      let impactoOperacional = 0;
      let descontados = 0;
      const setoresCounts: Record<string, number> = {};
      const categoriasDesconto: Record<string, number> = {};

      feriasDoMes.forEach(f => {
        const cruzamento = getCruzamentoMilitar(f, efetivo);
        if (cruzamento.isNaoOperacional) {
          descontados++;
          const cat = cruzamento.categoriaNaoOperacional || 'Administrativo';
          categoriasDesconto[cat] = (categoriasDesconto[cat] || 0) + 1;
        } else {
          impactoOperacional++;
          const setor = cruzamento.setorEscala || 'Operacional de Rua';
          setoresCounts[setor] = (setoresCounts[setor] || 0) + 1;
        }
      });

      const mesIdx = MESES_DO_ANO.indexOf(mes);
      const isMesAtual = selectedYear === currentYear && mesIdx === currentMonthIndex;

      const setoresTop = Object.entries(setoresCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);

      return {
        mes,
        mesCurto: mes.slice(0, 3),
        impactoOperacional,
        descontados,
        total: impactoOperacional + descontados,
        isMesAtual,
        setoresTop,
        setoresCounts,
        categoriasDesconto
      };
    });
  }, [mesesParaGrafico, ferias, efetivo, selectedYear, currentYear, currentMonthIndex]);

  // Indicadores consolidados dos meses restantes com cruzamento do efetivo
  const kpisMesesRestantes = useMemo(() => {
    let totalImpacto = 0;
    let totalDescontados = 0;
    let maxImpacto = -1;
    let mesPico = '';
    let vinculadosComEfetivo = 0;
    let totalFeriasRestantes = 0;

    const setoresRestantesTotais: Record<string, number> = {};

    dadosGraficoImpacto.forEach(d => {
      totalImpacto += d.impactoOperacional;
      totalDescontados += d.descontados;
      totalFeriasRestantes += d.total;

      if (d.impactoOperacional > maxImpacto) {
        maxImpacto = d.impactoOperacional;
        mesPico = d.mes;
      }

      Object.entries(d.setoresCounts).forEach(([setor, count]) => {
        setoresRestantesTotais[setor] = (setoresRestantesTotais[setor] || 0) + Number(count || 0);
      });
    });

    ferias.forEach(f => {
      if (f.ano === selectedYear && mesesParaGrafico.includes(f.mesPrevisto as MesAno)) {
        const c = getCruzamentoMilitar(f, efetivo);
        if (c.encontradoNoEfetivo) {
          vinculadosComEfetivo++;
        }
      }
    });

    const mediaPorMes = dadosGraficoImpacto.length > 0 
      ? Math.round((totalImpacto / dadosGraficoImpacto.length) * 10) / 10 
      : 0;

    const taxaVinculo = totalFeriasRestantes > 0 
      ? Math.round((vinculadosComEfetivo / totalFeriasRestantes) * 100) 
      : 100;

    const topSetores = Object.entries(setoresRestantesTotais)
      .sort((a, b) => b[1] - a[1]);

    return {
      totalImpacto,
      totalDescontados,
      totalGeral: totalFeriasRestantes,
      mediaPorMes,
      mesPico: mesPico || 'Nenhum',
      maxImpacto: maxImpacto > 0 ? maxImpacto : 0,
      taxaVinculo,
      vinculadosComEfetivo,
      topSetores
    };
  }, [dadosGraficoImpacto, ferias, efetivo, selectedYear, mesesParaGrafico]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormMatricula('');
    setFormNome('');
    setFormPosto('Sd');
    setFormMes(currentMonthName as MesAno || 'Janeiro');
    setFormDias(30);
    setFormDataInicio('');
    setFormDataFim('');
    setFormSituacao('Prevista');
    setFormObs('');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (item: PrevisaoFerias) => {
    const m = efetivo.find(e => e.matricula && item.matricula && e.matricula.trim() === item.matricula.trim());
    setEditingItem(item);
    setFormMatricula(item.matricula);
    setFormNome(m?.nomeCompleto || item.nome);
    setFormPosto(m?.postoGraduacao || item.posto);
    setFormMes(item.mesPrevisto as MesAno);
    setFormDias(item.periodoDias || 30);
    setFormDataInicio(item.dataInicio || '');
    setFormDataFim(item.dataFim || '');
    setFormSituacao(item.situacao);
    setFormObs(item.observacao || '');
    setIsAddModalOpen(true);
  };

  const handleSelectMilitarFromDb = (mat: string) => {
    setFormMatricula(mat);
    const m = efetivo.find(e => e.matricula === mat);
    if (m) {
      setFormNome(m.nomeCompleto);
      setFormPosto(m.postoGraduacao);
    }
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome.trim()) return;

    if (editingItem) {
      onUpdateFerias(editingItem.id, {
        matricula: formMatricula,
        nome: formNome,
        posto: formPosto,
        mesPrevisto: formMes,
        periodoDias: formDias,
        dataInicio: formDataInicio || undefined,
        dataFim: formDataFim || undefined,
        situacao: formSituacao,
        observacao: formObs || undefined,
        ano: selectedYear
      });
    } else {
      onAddFerias({
        matricula: formMatricula || `PM-${Math.floor(1000 + Math.random() * 9000)}`,
        nome: formNome,
        posto: formPosto,
        ano: selectedYear,
        mesPrevisto: formMes,
        periodoDias: formDias,
        dataInicio: formDataInicio || undefined,
        dataFim: formDataFim || undefined,
        situacao: formSituacao,
        observacao: formObs || undefined
      });
    }

    setIsAddModalOpen(false);
  };

  // Export to Excel
  const handleExportExcel = () => {
    const data = filteredFerias.map((f, idx) => {
      const cruzamento = getCruzamentoMilitar(f, efetivo);
      const nomeCompleto = cruzamento.militar?.nomeCompleto || f.nome;
      return {
        'Nº': idx + 1,
        'Ano': f.ano,
        'Mês Previsto': f.mesPrevisto,
        'Posto/Grad': cruzamento.militar?.postoGraduacao || f.posto,
        'Nome Completo': nomeCompleto,
        'Matrícula': f.matricula,
        'Setor na Escala': cruzamento.setorEscala,
        'Enquadramento': cruzamento.isNaoOperacional ? `Descontado (${cruzamento.categoriaNaoOperacional})` : 'Operacional de Rua',
        'Vínculo Efetivo': cruzamento.encontradoNoEfetivo ? 'Confirmado via Matrícula' : 'Não localizado no cadastro',
        'Período (Dias)': f.periodoDias || 30,
        'Exercício (Ano Ref)': f.anoReferencia || '',
        'Data Início': f.dataInicio || '',
        'Data Fim': f.dataFim || '',
        'Situação': f.situacao,
        'Observações': f.observacao || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Ferias_${selectedYear}`);
    XLSX.writeFile(wb, `Plano_Ferias_${selectedYear}_4BPM.xlsx`);
  };

  // Export to PDF
  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    
    // Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`POLÍCIA MILITAR - 4º BPM / CPMR`, 14, 15);
    doc.setFontSize(11);
    doc.text(`RELAÇÃO DO PLANO GERAL DE FÉRIAS - ANO ${selectedYear}`, 14, 22);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Filtro: ${selectedMonth === 'TODOS' ? 'Todos os Meses' : selectedMonth} | Total de Militares: ${filteredFerias.length} | Impacto Operacional: ${currentSelectedStats.impactoOperacional} militares (Descontados: ${currentSelectedStats.naoOperacionais})`, 
      14, 
      28
    );

    const tableRows = filteredFerias.map((f, i) => {
      const cruzamento = getCruzamentoMilitar(f, efetivo);
      const nomeCompleto = cruzamento.militar?.nomeCompleto || f.nome;
      return [
        String(i + 1),
        f.mesPrevisto,
        cruzamento.militar?.postoGraduacao || f.posto,
        nomeCompleto,
        f.matricula,
        cruzamento.setorEscala,
        cruzamento.isNaoOperacional ? `Desc. (${cruzamento.categoriaNaoOperacional})` : 'Operacional',
        `${f.periodoDias || 30} dias`,
        f.situacao
      ];
    });

    autoTable(doc, {
      startY: 32,
      head: [['Nº', 'Mês', 'Posto', 'Nome Completo', 'Matrícula', 'Setor Escala', 'Enquadramento', 'Período', 'Situação']],
      body: tableRows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`Plano_Ferias_${selectedYear}_4BPM.pdf`);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner with Action Buttons */}
      <div className="bg-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/80 text-emerald-300 text-xs font-mono font-bold mb-3 border border-emerald-800">
              <Calendar size={14} />
              Quadro Geral de Férias Regulamentares
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Previsão de Férias por Mês
            </h1>
            <p className="text-xs sm:text-sm text-emerald-200/80 max-w-2xl mt-1 leading-relaxed">
              Mapeamento do efetivo previsto para fruição de férias ao longo do ano. Importe facilmente a relação em PDF ou planilha Excel para sincronização automática.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Upload size={16} />
              <span>Importar PDF ou Excel</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-2 border border-white/20 transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>Novo Agendamento</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-1 border border-white/20 transition-all cursor-pointer"
              title="Exportar Planilha Excel"
            >
              <FileSpreadsheet size={16} />
            </button>

            <button
              onClick={handleExportPdf}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-1 border border-white/20 transition-all cursor-pointer"
              title="Exportar Relatório PDF"
            >
              <FileText size={16} />
            </button>
          </div>
        </div>

        {/* Quick KPI stats bar */}
        <div className="mt-6 pt-6 border-t border-emerald-800/60 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-300/70">Total Previsto ({selectedYear})</span>
            <div className="text-2xl font-black font-mono text-white mt-0.5">{totalAno}</div>
            <div className="text-[10px] text-emerald-300/60 font-mono mt-0.5">Ano {selectedYear}</div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-300/70">Em Gozo Atualmente ({currentMonthName})</span>
            <div className="text-2xl font-black font-mono text-emerald-300 mt-0.5 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {emGozoCount}
            </div>
            <div className="text-[10px] text-emerald-300/60 font-mono mt-0.5">Mês em andamento</div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-300/70">Previstas para Fruir</span>
            <div className="text-2xl font-black font-mono text-amber-300 mt-0.5">{previstasCount}</div>
            <div className="text-[10px] text-amber-300/80 font-mono mt-0.5 truncate">
              {selectedYear === currentYear && currentMonthIndex < 11 
                ? `${MESES_DO_ANO[currentMonthIndex + 1].slice(0, 3)} a Dezembro` 
                : selectedYear > currentYear ? 'Ano completo a fruir' : '0 restantes'}
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-300/70">Férias Concluídas</span>
            <div className="text-2xl font-black font-mono text-blue-300 mt-0.5">{concluidasCount}</div>
            <div className="text-[10px] text-blue-200/60 font-mono mt-0.5">Meses anteriores</div>
          </div>
        </div>
      </div>

      {/* PAINEL DO GRÁFICO ENXUTO: SOMENTE NÚMEROS DE IMPACTO OPERACIONAL REAL */}
      <div className="bg-white rounded-2xl border border-line shadow-xs overflow-hidden">
        {/* Header Compacto */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-line bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-800 text-white shadow-xs">
              <BarChart3 size={16} />
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-ink tracking-tight">
                Impacto Operacional Real
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                Viaturas / Rua
              </span>
              <span className="text-xs font-mono font-bold text-emerald-950 bg-white px-2.5 py-0.5 rounded-md border border-line shadow-xs">
                Total: {kpisMesesRestantes.totalImpacto} policiais
              </span>
            </div>
          </div>

          {/* Toggle Meses Restantes vs Ano Completo */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-200/80 rounded-lg self-start sm:self-auto shrink-0">
            <button
              onClick={() => setChartViewMode('restantes')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                chartViewMode === 'restantes'
                  ? 'bg-white text-emerald-900 shadow-xs'
                  : 'text-ink/60 hover:text-ink'
              }`}
            >
              <TrendingUp size={12} />
              {selectedYear === currentYear ? 'Meses Restantes' : 'A Fruir'}
            </button>
            <button
              onClick={() => setChartViewMode('todos')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                chartViewMode === 'todos'
                  ? 'bg-white text-emerald-900 shadow-xs'
                  : 'text-ink/60 hover:text-ink'
              }`}
            >
              <CalendarRange size={12} />
              Ano Completo
            </button>
          </div>
        </div>

        {/* Gráfico de Barras Compacto com Números Reais no Topo das Barras */}
        <div className="p-4 sm:p-5">
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dadosGraficoImpacto}
                margin={{ top: 22, right: 10, left: -25, bottom: 0 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload[0]) {
                    const mesClicado = e.activePayload[0].payload.mes;
                    setSelectedMonth(mesClicado);
                  }
                }}
                className="cursor-pointer"
              >
                <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="mes" 
                  stroke="#64748b" 
                  tick={{ fontSize: 11, fontWeight: 600 }}
                  tickFormatter={(val: string) => val.slice(0, 3)}
                />
                <YAxis 
                  allowDecimals={false} 
                  stroke="#94a3b8" 
                  tick={{ fontSize: 10, fontFamily: 'monospace' }} 
                />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white px-3 py-2 rounded-xl shadow-lg border border-slate-800 text-xs space-y-1 font-mono z-50">
                          <div className="font-bold text-emerald-400">{label} / {selectedYear}</div>
                          <div className="text-white text-xs">
                            Impacto Operacional Real: <strong className="text-emerald-300 text-sm">{data.impactoOperacional}</strong> PMs
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }} 
                />
                <Bar 
                  dataKey="impactoOperacional" 
                  name="Impacto Operacional Real" 
                  radius={[5, 5, 0, 0]}
                  maxBarSize={42}
                >
                  <LabelList 
                    dataKey="impactoOperacional" 
                    position="top" 
                    fill="#065f46" 
                    fontSize={11} 
                    fontWeight={800} 
                    offset={5}
                    formatter={(v: any) => Number(v) > 0 ? v : ''}
                  />
                  {dadosGraficoImpacto.map((entry) => (
                    <Cell 
                      key={`cell-op-${entry.mes}`} 
                      fill={
                        entry.impactoOperacional === kpisMesesRestantes.maxImpacto && entry.impactoOperacional > 0
                          ? '#d97706' // Âmbar de destaque para mês pico
                          : entry.isMesAtual
                          ? '#047857' // Verde escuro para mês atual
                          : '#059669' // Esmeralda operacional padrão
                      } 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Monthly Selector Grid - Click on month to filter */}
      <div className="bg-white p-5 rounded-2xl border border-line shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarRange size={18} className="text-emerald-800" />
            <h3 className="text-sm font-bold text-ink uppercase tracking-wider">
              Distribuição Mensal de Férias ({selectedYear})
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink/60 font-semibold">Ano:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-slate-100 border border-line text-ink text-xs font-bold rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-800"
            >
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
            </select>
          </div>
        </div>

        {/* Months tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-13 gap-2">
          <button
            onClick={() => setSelectedMonth('TODOS')}
            className={`p-2.5 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center justify-center ${
              selectedMonth === 'TODOS'
                ? 'bg-emerald-950 text-white border-emerald-950 shadow-xs'
                : 'bg-slate-50 border-line/70 text-ink/80 hover:bg-slate-100'
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">Todos</span>
            <span className="text-base font-black font-mono mt-0.5">{totalAno}</span>
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded mt-0.5 ${
              selectedMonth === 'TODOS' ? 'bg-amber-400 text-slate-950' : 'bg-slate-200 text-slate-700'
            }`}>
              geral
            </span>
          </button>

          {MESES_DO_ANO.map(m => {
            const count = countByMonth[m] || 0;
            const opImpact = monthlyOperationalStats[m]?.impactoOperacional ?? count;
            const isSelected = selectedMonth === m;
            return (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`p-2 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center justify-center ${
                  isSelected
                    ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs ring-2 ring-emerald-600/30'
                    : count > 0
                    ? 'bg-white border-emerald-200 text-ink hover:bg-emerald-50/50'
                    : 'bg-slate-50 border-line/50 text-ink/40 hover:bg-slate-100'
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-tight truncate w-full">
                  {m.slice(0, 3)}
                </span>
                <span className={`text-sm font-black font-mono mt-0.5 ${count > 0 ? 'text-emerald-900' : 'text-ink/30'} ${isSelected ? 'text-white' : ''}`}>
                  {count}
                </span>
                {count > 0 && (
                  <span 
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded mt-0.5 ${
                      isSelected ? 'bg-amber-400 text-slate-950' : 'bg-amber-100 text-amber-900'
                    }`}
                    title={`Impacto Operacional: ${opImpact} militares nas ruas`}
                  >
                    {opImpact} op.
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tópico: IMPACTO NO SERVIÇO OPERACIONAL */}
        <div className="pt-2">
          <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 text-white rounded-2xl p-4 sm:p-5 border border-emerald-800/40 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              
              {/* Descrição e Mês Selecionado */}
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold font-mono uppercase tracking-wider border border-emerald-500/30 flex items-center gap-1.5">
                    <Calendar size={12} className="text-emerald-400" />
                    {currentSelectedStats.isAll ? `Ano ${selectedYear} (Todos os Meses)` : `Mês de ${selectedMonth} de ${selectedYear}`}
                  </span>
                  {!currentSelectedStats.isAll && (
                    <span className="text-[11px] text-amber-300 font-mono font-bold">
                      Mês selecionado ativo
                    </span>
                  )}
                </div>
                
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldAlert size={20} className="text-amber-400 shrink-0" />
                  <span className="tracking-wide">IMPACTO NO SERVIÇO OPERACIONAL</span>
                </h4>
                
                <p className="text-xs text-white/70 leading-relaxed">
                  Quantidade real de policiais militares que desfalcam a escala das viaturas e guarnições de rua no período. Obtido subtraindo do total do mês os militares de funções de chefia/apoio ou afastados (Administrativo, Supervisor, Comandante, Subcomandante, LTS e À Disposição).
                </p>
              </div>

              {/* Painel de Cálculo Visual: Total do Mês − Descontados = Impacto Operacional */}
              <div className="flex items-stretch gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
                {/* 1. Total Previsto no Mês */}
                <div className="bg-white/10 backdrop-blur-xs px-4 py-3 rounded-xl border border-white/15 min-w-[125px] flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-mono font-bold text-emerald-300/80 block">
                    {currentSelectedStats.isAll ? 'Total Previsto Ano' : `Total Previsto (${selectedMonth.slice(0, 3)})`}
                  </span>
                  <div className="text-2xl font-black font-mono text-white mt-1">
                    {currentSelectedStats.total}
                  </div>
                  <span className="text-[10px] text-white/50 block mt-0.5 font-mono">
                    militares agendados
                  </span>
                </div>

                {/* Sinal de Subtração */}
                <div className="flex items-center justify-center text-white/40 font-mono text-2xl font-bold px-1 select-none">
                  −
                </div>

                {/* 2. Militares Não-Operacionais Descontados */}
                <div className="bg-white/10 backdrop-blur-xs px-4 py-3 rounded-xl border border-white/15 min-w-[145px] flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-mono font-bold text-red-300/80 block">
                    Militares Descontados
                  </span>
                  <div className="text-2xl font-black font-mono text-red-300 mt-1">
                    {currentSelectedStats.naoOperacionais}
                  </div>
                  <span className="text-[10px] text-white/50 block mt-0.5 font-mono">
                    Admin / Cmt / LTS / AD
                  </span>
                </div>

                {/* Sinal de Igual */}
                <div className="flex items-center justify-center text-emerald-400 font-mono text-2xl font-bold px-1 select-none">
                  =
                </div>

                {/* 3. IMPACTO NO SERVIÇO OPERACIONAL (Destaque Principal) */}
                <div className="bg-amber-500/20 backdrop-blur-xs px-5 py-3 rounded-xl border border-amber-400/40 min-w-[195px] ring-1 ring-amber-400/30 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-mono font-bold text-amber-300 block">
                    Impacto Operacional Real
                  </span>
                  <div className="text-3xl font-black font-mono text-amber-300 mt-1 flex items-baseline gap-1.5">
                    {currentSelectedStats.impactoOperacional}
                    <span className="text-xs font-normal text-amber-200/80">policiais</span>
                  </div>
                  <span className="text-[10px] text-amber-300/80 block mt-0.5 font-mono font-bold">
                    {currentSelectedStats.total} − {currentSelectedStats.naoOperacionais} = {currentSelectedStats.impactoOperacional} nas ruas
                  </span>
                </div>
              </div>

            </div>

            {/* Categorias Descontadas Detalhadas */}
            <div className="mt-4 pt-3.5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <span className="text-white/70 text-[11px] font-medium">
                Desdobramento dos militares não-operacionais descontados ({currentSelectedStats.naoOperacionais} no total):
              </span>

              <div className="flex items-center gap-1.5 flex-wrap">
                {(Object.entries(currentSelectedStats.porCategoria) as [CategoriaNaoOperacional, number][]).map(([cat, qty]) => (
                  <span 
                    key={cat}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold flex items-center gap-1.5 border transition-all ${
                      qty > 0 
                        ? 'bg-amber-400/20 text-amber-200 border-amber-400/40' 
                        : 'bg-white/5 text-white/30 border-white/10'
                    }`}
                  >
                    <span>{cat}:</span>
                    <strong className={qty > 0 ? 'text-amber-300 font-bold' : 'text-white/30'}>{qty}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-line shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" />
          <input
            type="text"
            placeholder="Pesquisar por nome, nome de guerra, posto ou matrícula..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 rounded-xl border border-line text-xs text-ink focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-50 border border-line text-xs rounded-xl px-3 py-2 text-ink font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-800"
          >
            <option value="TODOS">Todos Status</option>
            <option value="Prevista">Prevista</option>
            <option value="Em Gozo">Em Gozo</option>
            <option value="Concluída">Concluída</option>
            <option value="Interrompida">Interrompida</option>
          </select>
        </div>
      </div>

      {/* Roster of Personnel Scheduled for Vacation */}
      <div className="bg-white rounded-2xl border border-line shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <Users size={16} className="text-emerald-800" />
              Relação Nominal de Férias Previstas ({filteredFerias.length} militares)
            </h3>
            <div className="text-xs text-ink/50 mt-1 flex items-center gap-2 flex-wrap">
              <span>{selectedMonth === 'TODOS' ? 'Exibindo todos os meses do ano' : `Filtrado por: ${selectedMonth} de ${selectedYear}`}</span>
              <span>•</span>
              <span className="text-amber-900 font-bold bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded text-[11px] font-mono flex items-center gap-1">
                <ShieldAlert size={12} className="text-amber-700" />
                Impacto Operacional: {currentSelectedStats.impactoOperacional} policiais
              </span>
              {currentSelectedStats.naoOperacionais > 0 && (
                <span className="text-slate-600 text-[11px] font-mono">
                  ({currentSelectedStats.naoOperacionais} descontados da escala de rua)
                </span>
              )}
            </div>
          </div>
          
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 self-start sm:self-auto">
            {filteredFerias.length} selecionados
          </span>
        </div>

        {filteredFerias.length === 0 ? (
          <div className="py-16 text-center text-ink/50 space-y-3">
            <Calendar size={40} className="mx-auto text-ink/20" />
            <p className="text-sm font-bold text-ink/70">Nenhum militar encontrado para os filtros selecionados</p>
            <p className="text-xs text-ink/40 max-w-sm mx-auto">
              Você pode carregar uma relação anual completa clicando em "Importar PDF ou Excel" acima ou agendar manualmente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-line bg-slate-100/80 text-[11px] font-bold text-ink/70 uppercase tracking-wider">
                  <th className="py-3 px-4">Posto / Nome Completo</th>
                  <th className="py-3 px-4">Setor na Escala / Cruzamento</th>
                  <th className="py-3 px-4">Matrícula</th>
                  <th className="py-3 px-4">Mês Previsto</th>
                  <th className="py-3 px-4">Período</th>
                  <th className="py-3 px-4">Situação</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredFerias.map((item) => {
                  const cruzamento = getCruzamentoMilitar(item, efetivo);
                  const nomeCompleto = (item.nome && item.nome.trim().split(/\s+/).length >= 2)
                    ? item.nome
                    : (cruzamento.militar?.nomeCompleto || item.nome);
                  const postoExibicao = (item.posto && item.posto !== 'Sd')
                    ? item.posto
                    : (cruzamento.militar?.postoGraduacao || item.posto || 'Sd');
                  return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <span className="w-14 shrink-0 font-mono font-bold text-emerald-950 bg-emerald-50 px-2 py-0.5 rounded text-center border border-emerald-200">
                          {postoExibicao}
                        </span>
                        <div>
                          <div className="font-bold text-ink">{nomeCompleto}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {cruzamento.isNaoOperacional ? (
                            <span 
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300"
                              title={`Descontado do impacto operacional de rua: ${cruzamento.categoriaNaoOperacional}${cruzamento.detalheSetor ? ` (${cruzamento.detalheSetor})` : ''}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                              Descontado ({cruzamento.categoriaNaoOperacional})
                            </span>
                          ) : (
                            <span 
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300"
                              title="Militar do serviço operacional de viaturas / rádio-patrulha"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              Operacional de Rua
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] font-mono text-ink/80 flex items-center gap-1">
                          <Layers size={11} className="text-emerald-800 shrink-0" />
                          <span className="font-semibold text-ink">{cruzamento.setorEscala}</span>
                          {cruzamento.encontradoNoEfetivo && (
                            <span 
                              className="inline-flex items-center text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 rounded font-mono"
                              title="Cruzado com sucesso pela matrícula na Gestão de Efetivo"
                            >
                              <CheckCircle2 size={9} className="mr-0.5 text-emerald-600" /> Matrícula OK
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-ink/70">
                      {item.matricula}
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-900 border border-emerald-200">
                        <Calendar size={12} className="text-emerald-700" />
                        {item.mesPrevisto}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-ink font-mono font-semibold">
                        {item.periodoDias || 30} dias
                      </div>
                      {item.anoReferencia && (
                        <div className="text-[10px] font-mono text-amber-900 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded inline-block mt-0.5">
                          Exercício: {item.anoReferencia}
                        </div>
                      )}
                      {item.dataInicio && item.dataFim && (
                        <div className="text-[10px] text-ink/50">
                          {item.dataInicio} até {item.dataFim}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <button
                        onClick={() => {
                          const nextStatus: Record<string, PrevisaoFerias['situacao']> = {
                            'Prevista': 'Em Gozo',
                            'Em Gozo': 'Concluída',
                            'Concluída': 'Prevista',
                            'Interrompida': 'Prevista'
                          };
                          onUpdateFerias(item.id, { situacao: nextStatus[item.situacao] });
                        }}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                          item.situacao === 'Em Gozo'
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : item.situacao === 'Concluída'
                            ? 'bg-blue-100 text-blue-900 border-blue-200'
                            : item.situacao === 'Interrompida'
                            ? 'bg-red-100 text-red-900 border-red-200'
                            : 'bg-amber-100 text-amber-900 border-amber-200'
                        }`}
                        title="Clique para alternar o status da férias"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          item.situacao === 'Em Gozo' ? 'bg-emerald-600 animate-pulse' :
                          item.situacao === 'Concluída' ? 'bg-blue-600' : 'bg-amber-600'
                        }`}></span>
                        {item.situacao}
                      </button>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="w-7 h-7 rounded-lg hover:bg-slate-200 text-ink/60 hover:text-ink flex items-center justify-center transition-colors cursor-pointer"
                          title="Editar Registro"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => onDeleteFerias(item.id)}
                          className="w-7 h-7 rounded-lg hover:bg-red-100 text-ink/40 hover:text-red-700 flex items-center justify-center transition-colors cursor-pointer"
                          title="Remover Registro"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Import Excel/PDF */}
      <ImportFeriasModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        efetivo={efetivo}
        onImportComplete={(records, mode) => {
          onImportFerias(records, mode);
        }}
      />

      {/* Modal: Add or Edit Manual Record */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-line flex flex-col overflow-hidden">
            <div className="p-5 border-b border-line flex items-center justify-between bg-slate-50">
              <h3 className="text-base font-bold text-ink">
                {editingItem ? 'Editar Previsão de Férias' : 'Agendar Férias de Militar'}
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 text-ink/50 flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-6 space-y-4 overflow-y-auto max-h-[80vh]">
              {/* Select from existing military database */}
              <div>
                <label className="text-xs font-bold text-ink block mb-1">
                  Vincular a Militar do Efetivo:
                </label>
                <select
                  value={formMatricula}
                  onChange={(e) => handleSelectMilitarFromDb(e.target.value)}
                  className="w-full bg-slate-50 border border-line text-xs rounded-xl px-3 py-2 font-medium"
                >
                  <option value="">-- Selecionar Militar Cadastrado --</option>
                  {efetivo.map(m => (
                    <option key={m.id} value={m.matricula}>
                      {m.postoGraduacao} {m.nomeCompleto} ({m.matricula})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-ink block mb-1">Posto / Graduação:</label>
                  <select
                    value={formPosto}
                    onChange={(e) => setFormPosto(e.target.value as PostoGraduacao)}
                    className="w-full bg-slate-50 border border-line text-xs rounded-xl px-3 py-2"
                  >
                    <option value="Cel">Cel</option>
                    <option value="Ten-Cel">Ten-Cel</option>
                    <option value="Maj">Maj</option>
                    <option value="Cap">Cap</option>
                    <option value="1º Ten">1º Ten</option>
                    <option value="2º Ten">2º Ten</option>
                    <option value="Subten">Subten</option>
                    <option value="1º Sgt">1º Sgt</option>
                    <option value="2º Sgt">2º Sgt</option>
                    <option value="3º Sgt">3º Sgt</option>
                    <option value="Cb">Cb</option>
                    <option value="Sd">Sd</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-ink block mb-1">Matrícula:</label>
                  <input
                    type="text"
                    required
                    value={formMatricula}
                    onChange={(e) => setFormMatricula(e.target.value)}
                    className="w-full bg-slate-50 border border-line text-xs rounded-xl px-3 py-2 font-mono"
                    placeholder="12345-6"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-ink block mb-1">Nome Completo do Militar:</label>
                <input
                  type="text"
                  required
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  className="w-full bg-slate-50 border border-line text-xs rounded-xl px-3 py-2"
                  placeholder="Ex: SILVA SANTOS"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-ink block mb-1">Mês Previsto:</label>
                  <select
                    value={formMes}
                    onChange={(e) => setFormMes(e.target.value as MesAno)}
                    className="w-full bg-slate-50 border border-line text-xs rounded-xl px-3 py-2 font-bold"
                  >
                    {MESES_DO_ANO.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-ink block mb-1">Duração (Dias):</label>
                  <input
                    type="number"
                    value={formDias}
                    onChange={(e) => setFormDias(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-line text-xs rounded-xl px-3 py-2 font-mono"
                    min={5}
                    max={60}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-ink block mb-1">Situação:</label>
                  <select
                    value={formSituacao}
                    onChange={(e) => setFormSituacao(e.target.value as PrevisaoFerias['situacao'])}
                    className="w-full bg-slate-50 border border-line text-xs rounded-xl px-3 py-2 font-bold"
                  >
                    <option value="Prevista">Prevista</option>
                    <option value="Em Gozo">Em Gozo</option>
                    <option value="Concluída">Concluída</option>
                    <option value="Interrompida">Interrompida</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-ink block mb-1">Observações:</label>
                <input
                  type="text"
                  value={formObs}
                  onChange={(e) => setFormObs(e.target.value)}
                  className="w-full bg-slate-50 border border-line text-xs rounded-xl px-3 py-2"
                  placeholder="Ex: 1º período, portaria nº..."
                />
              </div>

              <div className="pt-4 border-t border-line flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-ink/60 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-950 text-white hover:bg-emerald-900 cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
