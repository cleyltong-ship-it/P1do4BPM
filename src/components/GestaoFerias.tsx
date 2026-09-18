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
  CalendarRange,
  ShieldAlert,
  BarChart3,
  TrendingUp,
  Layers,
  Sparkles,
  Shield,
  Building,
  Eye,
  Star,
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
import { PrevisaoFerias, MesAno, EfetivoMilitar, PostoGraduacao, CategoriaEscalaFerias } from '../types';
import { MESES_DO_ANO } from '../services/feriasFileParser';
import { ImportFeriasModal } from './ImportFeriasModal';

export type CategoriaDesconto = 'Administrativo' | 'P2' | 'Oficiais' | 'À Disposição';

export const CATEGORIAS_CONFIG: Record<CategoriaEscalaFerias, {
  id: CategoriaEscalaFerias;
  label: string;
  isDescontado: boolean;
  cor: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  shortLabel: string;
}> = {
  'Operacional': {
    id: 'Operacional',
    label: 'Operacional (Rua / VTR)',
    isDescontado: false,
    cor: '#059669',
    badgeBg: 'bg-emerald-50',
    badgeBorder: 'border-emerald-300',
    badgeText: 'text-emerald-950',
    shortLabel: 'Operacional'
  },
  'Administrativo': {
    id: 'Administrativo',
    label: 'Administrativo',
    isDescontado: true,
    cor: '#d97706',
    badgeBg: 'bg-amber-50',
    badgeBorder: 'border-amber-300',
    badgeText: 'text-amber-950',
    shortLabel: 'Administrativo'
  },
  'P2': {
    id: 'P2',
    label: 'P2 (Inteligência)',
    isDescontado: true,
    cor: '#7c3aed',
    badgeBg: 'bg-purple-50',
    badgeBorder: 'border-purple-300',
    badgeText: 'text-purple-950',
    shortLabel: 'P2'
  },
  'Oficiais': {
    id: 'Oficiais',
    label: 'Oficiais',
    isDescontado: true,
    cor: '#2563eb',
    badgeBg: 'bg-blue-50',
    badgeBorder: 'border-blue-300',
    badgeText: 'text-blue-950',
    shortLabel: 'Oficiais'
  },
  'À Disposição': {
    id: 'À Disposição',
    label: 'À Disposição',
    isDescontado: true,
    cor: '#64748b',
    badgeBg: 'bg-slate-100',
    badgeBorder: 'border-slate-300',
    badgeText: 'text-slate-900',
    shortLabel: 'À Disposição'
  }
};

/**
 * Obtém a categoria direta do militar.
 * Se o registro ainda não tiver a categoria explicitamente gravada,
 * aplica uma detecção inicial sugerida com base em posto ou observação.
 */
export function getMilitarCategoria(item: PrevisaoFerias): CategoriaEscalaFerias {
  if (item.categoria) {
    return item.categoria;
  }
  
  const posto = (item.posto || '').toLowerCase();
  const obs = (item.observacao || '').toLowerCase();

  if (obs.includes('p2') || obs.includes('p/2') || obs.includes('inteligência') || obs.includes('inteligencia')) {
    return 'P2';
  }
  if (obs.includes('disposição') || obs.includes('disposicao') || obs.includes('adido') || obs === 'ad') {
    return 'À Disposição';
  }
  if (obs.includes('admin') || obs.includes('expediente') || obs.includes('secretaria') || obs.includes('armeiro') || obs.includes('reserva')) {
    return 'Administrativo';
  }
  if (
    posto.includes('cel') || 
    posto.includes('maj') || 
    posto.includes('cap') || 
    posto.includes('1º ten') || 
    posto.includes('2º ten') || 
    posto.includes('tenente') ||
    posto === 'oficial' ||
    obs.includes('oficial') ||
    obs.includes('cmt') ||
    obs.includes('comandante')
  ) {
    return 'Oficiais';
  }

  return 'Operacional';
}

export function isDescontadoOperacional(cat: CategoriaEscalaFerias): boolean {
  return cat !== 'Operacional';
}

interface GestaoFeriasProps {
  ferias: PrevisaoFerias[];
  efetivo: EfetivoMilitar[];
  onAddFerias: (record: Omit<PrevisaoFerias, 'id'>) => void;
  onUpdateFerias: (id: string, updates: Partial<PrevisaoFerias>) => void;
  onDeleteFerias: (id: string) => void;
  onImportFerias: (records: PrevisaoFerias[], mode: 'replace' | 'merge') => void;
  onOpenImportEscalaPdf?: () => void;
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
  const [selectedCategoriaFilter, setSelectedCategoriaFilter] = useState<string>('TODOS');
  const [chartViewMode, setChartViewMode] = useState<'restantes' | 'todos'>('restantes');
  // Visualização da relação nominal: 'operacional' (apenas rua), 'todos' (geral), ou 'descontados' (admin/p2/oficiais/ad)
  const [tableRosterView, setTableRosterView] = useState<'operacional' | 'todos' | 'descontados'>('operacional');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
  const [formCategoria, setFormCategoria] = useState<CategoriaEscalaFerias>('Operacional');
  const [formObs, setFormObs] = useState('');

  const currentMonthIndex = new Date().getMonth();
  const currentMonthName = MESES_DO_ANO[currentMonthIndex];
  const currentYear = new Date().getFullYear();

  // Quick stats
  const totalAno = ferias.filter(f => f.ano === selectedYear).length;
  
  // Em Gozo Atualmente - Quantidade referente ao mês atual
  const emGozoCount = ferias.filter(f => {
    if (f.ano !== selectedYear) return false;
    const normMes = (f.mesPrevisto || '').toString().trim().toLowerCase();
    const isCurrentMonth = normMes === currentMonthName.toLowerCase() ||
                          normMes.startsWith(currentMonthName.slice(0, 3).toLowerCase());
    return f.situacao === 'Em Gozo' || isCurrentMonth;
  }).length;

  // "PREVISTAS PARA FRUIR": soma das férias previstas para os meses que faltam ser gozadas.
  const previstasCount = useMemo(() => {
    return ferias.filter(f => {
      if (f.ano !== selectedYear) return false;
      const monthIdx = MESES_DO_ANO.findIndex(m => 
        m.toLowerCase() === (f.mesPrevisto || '').toString().trim().toLowerCase()
      );
      if (monthIdx === -1) return false;

      if (selectedYear === currentYear) {
        return monthIdx > currentMonthIndex;
      } else if (selectedYear > currentYear) {
        return true;
      } else {
        return false;
      }
    }).length;
  }, [ferias, selectedYear, currentYear, currentMonthIndex]);

  // Férias Concluídas
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

  // Estatísticas de Férias por Mês: Levantamento total e dedução de Administrativo, P2, Oficiais e À Disposição
  const monthlyOperationalStats = useMemo(() => {
    const stats: Record<string, { 
      total: number; 
      operacional: number;
      descontados: number; 
      impactoOperacional: number; 
      porCategoria: Record<CategoriaDesconto, number>;
    }> = {};

    MESES_DO_ANO.forEach(m => {
      stats[m] = {
        total: 0,
        operacional: 0,
        descontados: 0,
        impactoOperacional: 0,
        porCategoria: {
          'Administrativo': 0,
          'P2': 0,
          'Oficiais': 0,
          'À Disposição': 0
        }
      };
    });

    ferias.forEach(f => {
      if (f.ano !== selectedYear) return;
      const m = f.mesPrevisto;
      if (!stats[m]) return;

      stats[m].total++;
      const cat = getMilitarCategoria(f);
      if (cat === 'Operacional') {
        stats[m].operacional++;
      } else {
        stats[m].descontados++;
        stats[m].porCategoria[cat] = (stats[m].porCategoria[cat] || 0) + 1;
      }
    });

    MESES_DO_ANO.forEach(m => {
      stats[m].impactoOperacional = stats[m].operacional;
    });

    return stats;
  }, [ferias, selectedYear]);

  // Estatísticas consolidadas do filtro de mês selecionado
  const currentSelectedStats = useMemo(() => {
    if (selectedMonth === 'TODOS') {
      let total = 0;
      let operacional = 0;
      let descontados = 0;
      const porCategoria: Record<CategoriaDesconto, number> = {
        'Administrativo': 0,
        'P2': 0,
        'Oficiais': 0,
        'À Disposição': 0
      };

      (Object.values(monthlyOperationalStats) as Array<{
        total: number;
        operacional: number;
        descontados: number;
        impactoOperacional: number;
        porCategoria: Record<CategoriaDesconto, number>;
      }>).forEach(s => {
        total += s.total;
        operacional += s.operacional;
        descontados += s.descontados;
        porCategoria['Administrativo'] += s.porCategoria['Administrativo'];
        porCategoria['P2'] += s.porCategoria['P2'];
        porCategoria['Oficiais'] += s.porCategoria['Oficiais'];
        porCategoria['À Disposição'] += s.porCategoria['À Disposição'];
      });

      return {
        monthLabel: 'Todos os Meses',
        isAll: true,
        total,
        operacional,
        descontados,
        impactoOperacional: operacional,
        porCategoria
      };
    }

    const s = monthlyOperationalStats[selectedMonth] || {
      total: 0,
      operacional: 0,
      descontados: 0,
      impactoOperacional: 0,
      porCategoria: {
        'Administrativo': 0,
        'P2': 0,
        'Oficiais': 0,
        'À Disposição': 0
      }
    };

    return {
      monthLabel: selectedMonth,
      isAll: false,
      total: s.total,
      operacional: s.operacional,
      descontados: s.descontados,
      impactoOperacional: s.operacional,
      porCategoria: s.porCategoria
    };
  }, [selectedMonth, monthlyOperationalStats]);

  // Meses restantes ou ano completo para o gráfico de barras
  const mesesParaGrafico = useMemo(() => {
    if (selectedYear > currentYear) {
      return MESES_DO_ANO;
    } else if (selectedYear === currentYear) {
      if (chartViewMode === 'restantes') {
        return MESES_DO_ANO.slice(currentMonthIndex);
      }
      return MESES_DO_ANO;
    } else {
      return MESES_DO_ANO;
    }
  }, [selectedYear, currentYear, currentMonthIndex, chartViewMode]);

  // Dados para o Gráfico de Impacto Operacional
  const dadosGraficoImpacto = useMemo(() => {
    return mesesParaGrafico.map(mes => {
      const s = monthlyOperationalStats[mes] || {
        total: 0,
        operacional: 0,
        descontados: 0,
        impactoOperacional: 0,
        porCategoria: { 'Administrativo': 0, 'P2': 0, 'Oficiais': 0, 'À Disposição': 0 }
      };

      const mesIdx = MESES_DO_ANO.indexOf(mes as MesAno);
      const isMesAtual = selectedYear === currentYear && mesIdx === currentMonthIndex;

      return {
        mes,
        mesCurto: mes.slice(0, 3),
        impactoOperacional: s.impactoOperacional,
        total: s.total,
        descontados: s.descontados,
        isMesAtual,
        porCategoria: s.porCategoria
      };
    });
  }, [mesesParaGrafico, monthlyOperationalStats, selectedYear, currentYear, currentMonthIndex]);

  // Indicadores consolidados dos meses exibidos no gráfico
  const kpisMesesRestantes = useMemo(() => {
    let totalImpacto = 0;
    let totalDescontados = 0;
    let totalGeral = 0;
    let maxImpacto = -1;
    let mesPico = '';

    dadosGraficoImpacto.forEach(d => {
      totalImpacto += d.impactoOperacional;
      totalDescontados += d.descontados;
      totalGeral += d.total;

      if (d.impactoOperacional > maxImpacto) {
        maxImpacto = d.impactoOperacional;
        mesPico = d.mes;
      }
    });

    const mediaPorMes = dadosGraficoImpacto.length > 0 
      ? Math.round((totalImpacto / dadosGraficoImpacto.length) * 10) / 10 
      : 0;

    return {
      totalImpacto,
      totalDescontados,
      totalGeral,
      mediaPorMes,
      mesPico: mesPico || 'Nenhum',
      maxImpacto: maxImpacto > 0 ? maxImpacto : 0
    };
  }, [dadosGraficoImpacto]);

  // Férias elegíveis pelo filtro de Ano, Mês e Status
  const baseMonthFerias = useMemo(() => {
    return ferias.filter(item => {
      if (item.ano !== selectedYear) return false;
      if (selectedMonth !== 'TODOS' && item.mesPrevisto !== selectedMonth) return false;
      if (selectedStatus !== 'TODOS' && item.situacao !== selectedStatus) return false;
      return true;
    });
  }, [ferias, selectedYear, selectedMonth, selectedStatus]);

  // Contagens para os botões de alternância da visualização
  const countOperacionaisFiltro = useMemo(() => {
    return baseMonthFerias.filter(item => getMilitarCategoria(item) === 'Operacional').length;
  }, [baseMonthFerias]);

  const countDescontadosFiltro = useMemo(() => {
    return baseMonthFerias.filter(item => getMilitarCategoria(item) !== 'Operacional').length;
  }, [baseMonthFerias]);

  // Lista filtrada para a tabela
  const filteredFerias = useMemo(() => {
    return baseMonthFerias.filter(item => {
      const cat = getMilitarCategoria(item);
      const isDescontado = cat !== 'Operacional';

      // Filtro da aba principal (Operacional vs Todos vs Descontados)
      if (tableRosterView === 'operacional' && isDescontado) {
        return false;
      }
      if (tableRosterView === 'descontados' && !isDescontado) {
        return false;
      }

      // Filtro de categoria específica no dropdown
      if (selectedCategoriaFilter !== 'TODOS' && cat !== selectedCategoriaFilter) {
        return false;
      }

      // Filtro de busca textual
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const mat = (item.matricula || '').toLowerCase();
        const nome = (item.nome || '').toLowerCase();
        const guerra = (item.nomeGuerra || '').toLowerCase();
        const posto = (item.posto || '').toLowerCase();
        const catStr = cat.toLowerCase();
        const obs = (item.observacao || '').toLowerCase();

        if (
          !mat.includes(term) && 
          !nome.includes(term) && 
          !guerra.includes(term) && 
          !posto.includes(term) &&
          !catStr.includes(term) &&
          !obs.includes(term)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [baseMonthFerias, tableRosterView, selectedCategoriaFilter, searchTerm]);

  // Handlers para adicionar/editar
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
    setFormCategoria('Operacional');
    setFormObs('');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (item: PrevisaoFerias) => {
    setEditingItem(item);
    setFormMatricula(item.matricula);
    setFormNome(item.nome);
    setFormPosto(item.posto);
    setFormMes(item.mesPrevisto as MesAno);
    setFormDias(item.periodoDias || 30);
    setFormDataInicio(item.dataInicio || '');
    setFormDataFim(item.dataFim || '');
    setFormSituacao(item.situacao);
    setFormCategoria(getMilitarCategoria(item));
    setFormObs(item.observacao || '');
    setIsAddModalOpen(true);
  };

  const handleSelectMilitarFromDb = (mat: string) => {
    setFormMatricula(mat);
    const m = efetivo.find(e => e.matricula === mat);
    if (m) {
      setFormNome(m.nomeCompleto);
      setFormPosto(m.postoGraduacao);
      const isOficial = ['Cel', 'Ten-Cel', 'Maj', 'Cap', '1º Ten', '2º Ten'].includes(m.postoGraduacao);
      const sitUpper = (m.situacao || '').toUpperCase();
      const funcUpper = (m.funcao || '').toUpperCase();

      if (isOficial) {
        setFormCategoria('Oficiais');
      } else if (sitUpper.includes('ADMIN') || funcUpper.includes('ADMIN') || m.escalaTipo === 'ADMIN') {
        setFormCategoria('Administrativo');
      } else if (sitUpper.includes('DISPOSIC') || funcUpper.includes('DISPOSIC')) {
        setFormCategoria('À Disposição');
      } else if (funcUpper.includes('P2') || sitUpper.includes('P2')) {
        setFormCategoria('P2');
      } else {
        setFormCategoria('Operacional');
      }
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
        categoria: formCategoria,
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
        categoria: formCategoria,
        observacao: formObs || undefined
      });
    }

    setIsAddModalOpen(false);
  };

  const handleBulkUpdateCategoria = (novaCat: CategoriaEscalaFerias) => {
    if (selectedIds.length === 0) return;
    selectedIds.forEach(id => {
      onUpdateFerias(id, { categoria: novaCat });
    });
    setSelectedIds([]);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    if (selectedIds.length === filteredFerias.length && filteredFerias.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredFerias.map(f => f.id));
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const data = filteredFerias.map((f, idx) => {
      const cat = getMilitarCategoria(f);
      return {
        'Nº': idx + 1,
        'Ano': f.ano,
        'Mês Previsto': f.mesPrevisto,
        'Posto/Grad': f.posto,
        'Nome Completo': f.nome,
        'Matrícula': f.matricula,
        'Classificação': cat,
        'Impacto Operacional': cat === 'Operacional' ? 'Sim (Rua / VTR)' : `Não (Descontado - ${cat})`,
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
      `Filtro: ${selectedMonth === 'TODOS' ? 'Todos os Meses' : selectedMonth} | Total de Militares: ${filteredFerias.length} | Impacto Operacional: ${currentSelectedStats.impactoOperacional} policiais (Descontados: ${currentSelectedStats.descontados})`, 
      14, 
      28
    );

    const tableRows = filteredFerias.map((f, i) => {
      const cat = getMilitarCategoria(f);
      return [
        String(i + 1),
        f.mesPrevisto,
        f.posto,
        f.nome,
        f.matricula,
        cat,
        cat === 'Operacional' ? 'Operacional (Rua)' : `Desc. (${cat})`,
        `${f.periodoDias || 30} dias`,
        f.situacao
      ];
    });

    autoTable(doc, {
      startY: 32,
      head: [['Nº', 'Mês', 'Posto', 'Nome Completo', 'Matrícula', 'Classificação', 'Impacto', 'Período', 'Situação']],
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
              Mapeamento do efetivo previsto para fruição de férias ao longo do ano. Classifique os militares em Administrativo, P2, Oficiais ou À Disposição para excluí-los automaticamente do desfalque das viaturas e obter o Impacto Operacional exato.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Upload size={16} />
              <span>Importar PDF ou Excel de Férias</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-2 border border-white/20 transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>Agendar Férias</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3 py-2.5 rounded-xl bg-emerald-900/80 hover:bg-emerald-900 text-emerald-200 hover:text-white font-bold text-xs flex items-center gap-1.5 border border-emerald-800 transition-all cursor-pointer"
              title="Exportar dados para Excel (.xlsx)"
            >
              <FileSpreadsheet size={16} />
              <span>Excel</span>
            </button>

            <button
              onClick={handleExportPdf}
              className="px-3 py-2.5 rounded-xl bg-emerald-900/80 hover:bg-emerald-900 text-emerald-200 hover:text-white font-bold text-xs flex items-center gap-1.5 border border-emerald-800 transition-all cursor-pointer"
              title="Exportar relatório para PDF (.pdf)"
            >
              <FileText size={16} />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {/* Quick KPI stats bar */}
        <div className="mt-6 pt-6 border-t border-emerald-800/60 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <span className="text-[10px] text-emerald-300/80 uppercase font-mono tracking-wider block">Total Geral Agendado</span>
            <span className="text-xl sm:text-2xl font-bold font-mono text-white mt-0.5 block">{totalAno}</span>
            <span className="text-[10px] text-emerald-300/60 font-mono">No ano {selectedYear}</span>
          </div>
          <div>
            <span className="text-[10px] text-emerald-300/80 uppercase font-mono tracking-wider block">Em Gozo Atualmente</span>
            <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 mt-0.5 block">{emGozoCount}</span>
            <span className="text-[10px] text-emerald-300/60 font-mono">{currentMonthName} / {currentYear}</span>
          </div>
          <div>
            <span className="text-[10px] text-emerald-300/80 uppercase font-mono tracking-wider block">Previstas para Fruir</span>
            <span className="text-xl sm:text-2xl font-bold font-mono text-amber-300 mt-0.5 block">{previstasCount}</span>
            <span className="text-[10px] text-emerald-300/60 font-mono">Meses restantes de {selectedYear}</span>
          </div>
          <div>
            <span className="text-[10px] text-emerald-300/80 uppercase font-mono tracking-wider block">Férias Concluídas</span>
            <span className="text-xl sm:text-2xl font-bold font-mono text-blue-300 mt-0.5 block">{concluidasCount}</span>
            <span className="text-[10px] text-emerald-300/60 font-mono">Períodos já finalizados</span>
          </div>
        </div>
      </div>

      {/* Seção Gráfica: Impacto Operacional nas Ruas */}
      <div className="bg-white rounded-2xl border border-line shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-amber-600" />
              <h3 className="text-sm font-bold text-ink uppercase tracking-wider">
                Impacto Operacional nas Viaturas e Escalas de Rua ({selectedYear})
              </h3>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-ink/60 font-medium">
                {chartViewMode === 'restantes' 
                  ? selectedYear === currentYear
                    ? `Meses restantes (${currentMonthName} a Dezembro)` 
                    : `Ano ${selectedYear}`
                  : `Distribuição completa do ano ${selectedYear}`}
              </span>
              <span className="text-ink/40">•</span>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300">
                Apenas Policiais de Rua
              </span>
              <span className="text-xs font-mono font-bold text-emerald-950 bg-white px-2.5 py-0.5 rounded-md border border-line shadow-xs">
                Total do Período: {kpisMesesRestantes.totalImpacto} policiais operacionais
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

        {/* Gráfico de Barras com Números de Impacto Operacional no Topo */}
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
                        <div className="bg-slate-900 text-white px-3 py-2.5 rounded-xl shadow-lg border border-slate-800 text-xs space-y-1.5 font-mono z-50 min-w-[200px]">
                          <div className="font-bold text-emerald-400 border-b border-slate-700 pb-1 flex items-center justify-between">
                            <span>{label} / {selectedYear}</span>
                            {data.isMesAtual && <span className="text-[9px] bg-emerald-800 text-white px-1.5 py-0.2 rounded">Mês Atual</span>}
                          </div>
                          <div className="text-white text-xs flex justify-between">
                            <span>Impacto Operacional (Rua):</span>
                            <strong className="text-emerald-300 text-sm font-bold">{data.impactoOperacional}</strong>
                          </div>
                          <div className="text-slate-300 text-[11px] flex justify-between">
                            <span>Total Geral Agendado:</span>
                            <span className="text-white font-bold">{data.total}</span>
                          </div>
                          <div className="text-amber-300 text-[11px] flex justify-between border-t border-slate-800 pt-1">
                            <span>Militares Descontados:</span>
                            <span className="font-bold">{data.descontados}</span>
                          </div>
                          {data.descontados > 0 && (
                            <div className="text-[10px] text-slate-400 pl-1 space-y-0.5">
                              {data.porCategoria.Administrativo > 0 && <div>• Admin: {data.porCategoria.Administrativo}</div>}
                              {data.porCategoria.P2 > 0 && <div>• P2: {data.porCategoria.P2}</div>}
                              {data.porCategoria.Oficiais > 0 && <div>• Oficiais: {data.porCategoria.Oficiais}</div>}
                              {data.porCategoria['À Disposição'] > 0 && <div>• À Disposição: {data.porCategoria['À Disposição']}</div>}
                            </div>
                          )}
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
            const stats = monthlyOperationalStats[m];
            const count = stats?.total || 0;
            const opImpact = stats?.impactoOperacional || 0;
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
                    title={`Total: ${count} | Impacto Operacional: ${opImpact} policiais nas ruas`}
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
                  Cálculo do desfalque real das viaturas de rua. Os militares classificados como <strong>Administrativo, P2, Oficiais ou À Disposição</strong> são descontados do total do mês, resultando no efetivo operacional real.
                </p>
              </div>

              {/* Painel de Cálculo Visual: Total do Mês − Descontados = Impacto Operacional */}
              <div className="flex items-stretch gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
                {/* 1. Total Previsto no Mês */}
                <div className="bg-white/10 backdrop-blur-xs px-4 py-3 rounded-xl border border-white/15 min-w-[125px] flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-mono font-bold text-emerald-300/80 block">
                    {currentSelectedStats.isAll ? 'Total Agendado Ano' : `Total Previsto (${selectedMonth.slice(0, 3)})`}
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

                {/* 2. Militares Descontados (Admin, P2, Oficiais, À Disposição) */}
                <div className="bg-white/10 backdrop-blur-xs px-4 py-3 rounded-xl border border-white/15 min-w-[145px] flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-mono font-bold text-red-300/80 block">
                    Militares Descontados
                  </span>
                  <div className="text-2xl font-black font-mono text-red-300 mt-1">
                    {currentSelectedStats.descontados}
                  </div>
                  <span className="text-[10px] text-white/50 block mt-0.5 font-mono">
                    Admin / P2 / Oficiais / AD
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
                    {currentSelectedStats.total} − {currentSelectedStats.descontados} = {currentSelectedStats.impactoOperacional} nas ruas
                  </span>
                </div>
              </div>

            </div>

            {/* Categorias Descontadas Detalhadas */}
            <div className="mt-4 pt-3.5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <span className="text-white/70 text-[11px] font-medium">
                Desdobramento dos militares fora do cálculo operacional ({currentSelectedStats.descontados} no total):
              </span>

              <div className="flex items-center gap-1.5 flex-wrap">
                {(Object.entries(currentSelectedStats.porCategoria) as [CategoriaDesconto, number][]).map(([cat, qty]) => (
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

      {/* Filter, Search Bar and View Mode Switcher */}
      <div className="bg-white p-4 rounded-2xl border border-line shadow-xs space-y-3">
        
        {/* Abas de Modo de Visualização da Relação Nominal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl flex-wrap">
            <button
              onClick={() => setTableRosterView('operacional')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                tableRosterView === 'operacional'
                  ? 'bg-emerald-800 text-white shadow-xs ring-1 ring-emerald-900'
                  : 'text-ink/70 hover:text-ink hover:bg-white/60'
              }`}
            >
              <ShieldAlert size={14} className={tableRosterView === 'operacional' ? 'text-amber-300' : 'text-emerald-700'} />
              <span>Impacto Operacional ({countOperacionaisFiltro})</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                tableRosterView === 'operacional' ? 'bg-emerald-950 text-emerald-200' : 'bg-slate-200 text-slate-700'
              }`}>
                Viaturas / Rua
              </span>
            </button>

            <button
              onClick={() => setTableRosterView('todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                tableRosterView === 'todos'
                  ? 'bg-emerald-800 text-white shadow-xs ring-1 ring-emerald-900'
                  : 'text-ink/70 hover:text-ink hover:bg-white/60'
              }`}
            >
              <Users size={14} />
              <span>Todos Agendados ({baseMonthFerias.length})</span>
            </button>

            <button
              onClick={() => setTableRosterView('descontados')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                tableRosterView === 'descontados'
                  ? 'bg-amber-800 text-white shadow-xs ring-1 ring-amber-900'
                  : 'text-ink/70 hover:text-ink hover:bg-white/60'
              }`}
            >
              <Layers size={14} className={tableRosterView === 'descontados' ? 'text-white' : 'text-amber-700'} />
              <span>Fora do Operacional ({countDescontadosFiltro})</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                tableRosterView === 'descontados' ? 'bg-amber-950 text-amber-200' : 'bg-slate-200 text-slate-700'
              }`}>
                Admin / P2 / Oficiais / AD
              </span>
            </button>
          </div>

          <div className="text-xs text-ink/60 flex items-center gap-1 font-mono">
            <span>Filtro ativo:</span>
            <span className="font-semibold text-emerald-900">
              {tableRosterView === 'operacional' 
                ? 'Excluindo Administrativo, P2, Oficiais e À Disposição' 
                : tableRosterView === 'descontados'
                ? 'Listando apenas Administrativo, P2, Oficiais e À Disposição'
                : 'Exibindo efetivo geral agendado'}
            </span>
          </div>
        </div>

        {/* Campo de Pesquisa e Filtros */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" />
            <input
              type="text"
              placeholder="Pesquisar por nome, matrícula, posto, classificação ou observação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 rounded-xl border border-line text-xs text-ink focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            {/* Categoria Filter */}
            <select
              value={selectedCategoriaFilter}
              onChange={(e) => setSelectedCategoriaFilter(e.target.value)}
              className="bg-slate-50 border border-line text-xs rounded-xl px-3 py-2 text-ink font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-800"
            >
              <option value="TODOS">Todas Categorias</option>
              <option value="Operacional">Operacional (Rua / VTR)</option>
              <option value="Administrativo">Administrativo [Fora]</option>
              <option value="P2">P2 (Inteligência) [Fora]</option>
              <option value="Oficiais">Oficiais [Fora]</option>
              <option value="À Disposição">À Disposição [Fora]</option>
            </select>

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
      </div>

      {/* Main Table: Relação Nominal de Férias */}
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
              {currentSelectedStats.descontados > 0 && (
                <span className="text-slate-600 text-[11px] font-mono">
                  ({currentSelectedStats.descontados} descontados da escala de rua)
                </span>
              )}
            </div>
          </div>
          
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 self-start sm:self-auto">
            {filteredFerias.length} militares listados
          </span>
        </div>

        {/* Barra de Classificação em Lote quando houver militares selecionados */}
        {selectedIds.length > 0 && (
          <div className="bg-slate-900 text-white p-3.5 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg border border-slate-700 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-mono font-bold flex items-center justify-center shadow-xs">
                {selectedIds.length}
              </span>
              <span className="text-xs font-bold text-white">
                {selectedIds.length === 1 ? '1 militar selecionado' : `${selectedIds.length} militares selecionados`}:
              </span>
              <span className="text-[11px] text-slate-300">
                Classificar selecionados em lote:
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleBulkUpdateCategoria('Operacional')}
                className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Manter como Operacional (entra no cálculo do desfalque das viaturas)"
              >
                🛡️ Operacional
              </button>
              <button
                type="button"
                onClick={() => handleBulkUpdateCategoria('Administrativo')}
                className="px-2.5 py-1.5 bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Descontar como Administrativo (fora do cálculo)"
              >
                🏢 Administrativo
              </button>
              <button
                type="button"
                onClick={() => handleBulkUpdateCategoria('P2')}
                className="px-2.5 py-1.5 bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Descontar como P2 / Inteligência (fora do cálculo)"
              >
                🕵️ P2
              </button>
              <button
                type="button"
                onClick={() => handleBulkUpdateCategoria('Oficiais')}
                className="px-2.5 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Descontar como Oficiais (fora do cálculo)"
              >
                ⭐ Oficiais
              </button>
              <button
                type="button"
                onClick={() => handleBulkUpdateCategoria('À Disposição')}
                className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Descontar como À Disposição (fora do cálculo)"
              >
                📋 À Disposição
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="px-2 py-1 text-slate-400 hover:text-white text-xs underline cursor-pointer ml-1"
              >
                Desmarcar
              </button>
            </div>
          </div>
        )}

        {filteredFerias.length === 0 ? (
          <div className="py-16 text-center text-ink/50 space-y-3">
            <Calendar size={40} className="mx-auto text-ink/20" />
            <p className="text-sm font-bold text-ink/70">Nenhum militar encontrado para os filtros selecionados</p>
            <p className="text-xs text-ink/40 max-w-sm mx-auto">
              Você pode carregar uma relação anual completa clicando em "Importar PDF ou Excel de Férias" acima ou agendar manualmente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-line bg-slate-100/80 text-[11px] font-bold text-ink/70 uppercase tracking-wider">
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === filteredFerias.length && filteredFerias.length > 0}
                      onChange={handleSelectAllFiltered}
                      title="Selecionar todos os militares visíveis para classificação em lote"
                      className="cursor-pointer rounded border-line text-blue-950 focus:ring-blue-800"
                    />
                  </th>
                  <th className="py-3 px-4">Posto / Nome Completo</th>
                  <th className="py-3 px-4">Classificação / Impacto</th>
                  <th className="py-3 px-4">Matrícula</th>
                  <th className="py-3 px-4">Mês Previsto</th>
                  <th className="py-3 px-4">Período</th>
                  <th className="py-3 px-4">Situação</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredFerias.map((item) => {
                  const cat = getMilitarCategoria(item);
                  const cfg = CATEGORIAS_CONFIG[cat];
                  const isDescontado = isDescontadoOperacional(cat);
                  const isSelected = selectedIds.includes(item.id);

                  return (
                  <tr key={item.id} className={`transition-colors ${isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50/80'}`}>
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(item.id)}
                        className="cursor-pointer rounded border-line text-blue-950 focus:ring-blue-800"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <span className="w-14 shrink-0 font-mono font-bold text-emerald-950 bg-emerald-50 px-2 py-0.5 rounded text-center border border-emerald-200">
                          {item.posto || 'Sd'}
                        </span>
                        <div>
                          <div className="font-bold text-ink">{item.nome}</div>
                          {item.observacao && (
                            <div className="text-[10px] text-ink/50 line-clamp-1">{item.observacao}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Classificação Manual e Imediata do Militar com 1 clique */}
                    <td className="py-3 px-4 min-w-[240px]">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={cat}
                            onChange={(e) => {
                              const novaCat = e.target.value as CategoriaEscalaFerias;
                              onUpdateFerias(item.id, { categoria: novaCat });
                            }}
                            className={`text-xs font-bold font-mono px-2.5 py-1 rounded-lg border cursor-pointer focus:outline-none focus:ring-2 transition-all ${
                              cat === 'Operacional'
                                ? 'bg-emerald-50 text-emerald-950 border-emerald-300 focus:ring-emerald-500/30'
                                : cat === 'Administrativo'
                                ? 'bg-amber-50 text-amber-950 border-amber-300 focus:ring-amber-500/30'
                                : cat === 'P2'
                                ? 'bg-purple-50 text-purple-950 border-purple-300 focus:ring-purple-500/30'
                                : cat === 'Oficiais'
                                ? 'bg-blue-50 text-blue-950 border-blue-300 focus:ring-blue-500/30'
                                : 'bg-slate-100 text-slate-900 border-slate-300 focus:ring-slate-500/30'
                            }`}
                            title="Selecione a classificação deste militar para o cálculo de impacto operacional"
                          >
                            <option value="Operacional">🛡️ Operacional (Rua / VTR)</option>
                            <option value="Administrativo">🏢 Administrativo [Fora]</option>
                            <option value="P2">🕵️ P2 (Inteligência) [Fora]</option>
                            <option value="Oficiais">⭐ Oficiais [Fora]</option>
                            <option value="À Disposição">📋 À Disposição [Fora]</option>
                          </select>
                        </div>

                        {/* Botões de Ação Rápida de 1 Clique */}
                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => onUpdateFerias(item.id, { categoria: 'Operacional' })}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-all cursor-pointer ${
                              cat === 'Operacional'
                                ? 'bg-emerald-600 text-white shadow-2xs ring-1 ring-emerald-700'
                                : 'bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-900'
                            }`}
                            title="Clique para definir como Operacional (Rua)"
                          >
                            🛡️ Rua
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateFerias(item.id, { categoria: 'Administrativo' })}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-all cursor-pointer ${
                              cat === 'Administrativo'
                                ? 'bg-amber-600 text-white shadow-2xs ring-1 ring-amber-700'
                                : 'bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-900'
                            }`}
                            title="Clique para descontar como Administrativo"
                          >
                            🏢 Admin
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateFerias(item.id, { categoria: 'P2' })}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-all cursor-pointer ${
                              cat === 'P2'
                                ? 'bg-purple-600 text-white shadow-2xs ring-1 ring-purple-700'
                                : 'bg-slate-100 text-slate-600 hover:bg-purple-100 hover:text-purple-900'
                            }`}
                            title="Clique para descontar como P2"
                          >
                            🕵️ P2
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateFerias(item.id, { categoria: 'Oficiais' })}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-all cursor-pointer ${
                              cat === 'Oficiais'
                                ? 'bg-blue-600 text-white shadow-2xs ring-1 ring-blue-700'
                                : 'bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-900'
                            }`}
                            title="Clique para descontar como Oficial"
                          >
                            ⭐ Oficial
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateFerias(item.id, { categoria: 'À Disposição' })}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-all cursor-pointer ${
                              cat === 'À Disposição'
                                ? 'bg-slate-700 text-white shadow-2xs ring-1 ring-slate-800'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                            }`}
                            title="Clique para descontar como À Disposição"
                          >
                            📋 AD
                          </button>
                        </div>

                        <div className="text-[10px] font-mono">
                          {!isDescontado ? (
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                              Entra no Impacto Operacional
                            </span>
                          ) : (
                            <span className="text-amber-800 font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>
                              Descontado (Fora do cálculo)
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
              {/* Select from existing military database (opcional) */}
              <div>
                <label className="text-xs font-bold text-ink block mb-1">
                  Vincular a Militar do Cadastro (Opcional):
                </label>
                <select
                  value={formMatricula}
                  onChange={(e) => handleSelectMilitarFromDb(e.target.value)}
                  className="w-full bg-slate-50 border border-line text-xs rounded-xl px-3 py-2 font-medium"
                >
                  <option value="">-- Selecionar Militar (Preenche automaticamente) --</option>
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

              {/* Classificação / Destinação do Militar */}
              <div className="p-3 bg-slate-50 rounded-xl border border-line space-y-1.5">
                <label className="text-xs font-bold text-ink block">
                  Classificação / Destinação (Impacto Operacional):
                </label>
                <select
                  value={formCategoria}
                  onChange={(e) => setFormCategoria(e.target.value as CategoriaEscalaFerias)}
                  className="w-full bg-white border border-line text-xs rounded-xl px-3 py-2 font-bold focus:ring-1 focus:ring-emerald-800"
                >
                  <option value="Operacional">🛡️ Operacional (Rua / Viaturas) - Entra no Impacto</option>
                  <option value="Administrativo">🏢 Administrativo - Fica de Fora do Cálculo</option>
                  <option value="P2">🕵️ P2 (Inteligência) - Fica de Fora do Cálculo</option>
                  <option value="Oficiais">⭐ Oficiais - Fica de Fora do Cálculo</option>
                  <option value="À Disposição">📋 À Disposição - Fica de Fora do Cálculo</option>
                </select>
                <p className="text-[11px] text-ink/60">
                  Militares definidos como <strong>Administrativo, P2, Oficiais ou À Disposição</strong> são excluídos do total do mês para apurar o impacto real nas viaturas de rua.
                </p>
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

                <div>
                  <label className="text-xs font-bold text-ink block mb-1">Ano:</label>
                  <input
                    type="number"
                    value={selectedYear}
                    disabled
                    className="w-full bg-slate-100 border border-line text-xs rounded-xl px-3 py-2 font-mono text-ink/70"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-ink block mb-1">Observações:</label>
                <input
                  type="text"
                  value={formObs}
                  onChange={(e) => setFormObs(e.target.value)}
                  className="w-full bg-slate-50 border border-line text-xs rounded-xl px-3 py-2"
                  placeholder="Ex: 1º período regular"
                />
              </div>

              <div className="pt-4 border-t border-line flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-line text-xs font-bold text-ink/70 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  {editingItem ? 'Salvar Alterações' : 'Cadastrar Previsão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
