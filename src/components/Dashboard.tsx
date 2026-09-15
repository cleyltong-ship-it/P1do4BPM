import React, { useMemo } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Clock, 
  AlertTriangle, 
  CalendarCheck, 
  CheckCircle2, 
  ArrowUpRight, 
  Building2, 
  Award, 
  FileText, 
  UserPlus, 
  Activity,
  Phone,
  Calendar,
  ChevronRight,
  Shield,
  Layers,
  Sparkles,
  Info,
  FileSpreadsheet,
  Target,
  Briefcase,
  Radio,
  Upload
} from 'lucide-react';
import { motion } from 'motion/react';
import { EfetivoMilitar, DashboardMetrics, PrevisaoFerias } from '../types';
import { MESES_DO_ANO } from '../services/feriasFileParser';

interface DashboardProps {
  metrics: DashboardMetrics;
  efetivo: EfetivoMilitar[];
  ferias?: PrevisaoFerias[];
  onNavigateToExtras: () => void;
  onNavigateToEfetivo: () => void;
  onNavigateToFerias: () => void;
  onOpenAddModal: () => void;
  onOpenImportModal: () => void;
  onOpenImportPdfModal?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  metrics,
  efetivo,
  ferias = [],
  onNavigateToExtras,
  onNavigateToEfetivo,
  onNavigateToFerias,
  onOpenAddModal,
  onOpenImportModal,
  onOpenImportPdfModal,
}) => {
  const militaresAfastados = efetivo.filter(m => 
    ['Férias', 'LTS', 'Dispensa Recompensa', 'Curso / Missão'].includes(m.situacao)
  );

  const currentMonthIndex = new Date().getMonth();
  const currentMonthName = MESES_DO_ANO[currentMonthIndex];

  // Count military personnel whose vacation is scheduled for the current month or currently in progress
  const emGozoMesAtualCount = useMemo(() => {
    const matchingFerias = ferias.filter(f => {
      const normMes = (f.mesPrevisto || '').toString().trim().toLowerCase();
      const isCurrentMonth = normMes === currentMonthName.toLowerCase() ||
                            normMes.startsWith(currentMonthName.slice(0, 3).toLowerCase());
      return isCurrentMonth || f.situacao === 'Em Gozo';
    }).length;

    if (matchingFerias > 0) return matchingFerias;
    const fromEfetivo = efetivo.filter(m => m.situacao === 'Férias').length;
    return fromEfetivo > 0 ? fromEfetivo : metrics.feriasCount;
  }, [ferias, efetivo, currentMonthName, metrics.feriasCount]);

  return (
    <div className="space-y-8">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 text-white p-6 md:p-8 shadow-xl border border-emerald-800/40">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 opacity-10 pointer-events-none">
          <Shield size={280} />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-mono font-semibold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              SISTEMA INTEGRADO DE GESTÃO DE EFETIVO
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase font-sans">
              4º Batalhão de Polícia Militar
            </h1>
            <p className="text-emerald-100/80 text-xs sm:text-sm leading-relaxed">
              Painel de controle central de prontidão operacional, controle de efetivo ativo e gestão inteligente da fila de serviços extras.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {onOpenImportPdfModal && (
              <button
                onClick={onOpenImportPdfModal}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white font-bold rounded-xl text-xs transition-all shadow-lg cursor-pointer"
              >
                <FileText size={16} />
                Importar Escala (PDF)
              </button>
            )}
            <button
              onClick={onOpenImportModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-100 text-emerald-950 font-bold rounded-xl text-xs transition-all shadow-lg cursor-pointer"
            >
              <FileSpreadsheet size={16} className="text-emerald-700" />
              Importar Planilha Efetivo
            </button>
            <button
              onClick={onOpenAddModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold rounded-xl text-xs transition-all shadow-lg cursor-pointer"
            >
              <UserPlus size={16} />
              Cadastrar Militar
            </button>
            <button
              onClick={onNavigateToExtras}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold rounded-xl text-xs transition-all shadow-lg cursor-pointer"
            >
              <CalendarCheck size={16} />
              Gestão de Serviços Extras
            </button>
          </div>
        </div>

        {/* Operational quick indicator bar - 5 Key battalion metrics */}
        <div className="mt-8 pt-6 border-t border-emerald-800/60 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-300/70">Efetivo Previsto</span>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-200 mt-0.5 flex items-center gap-1.5">
              <Target size={18} className="text-emerald-400" />
              {metrics.efetivoTotalPrevisto} <span className="text-xs font-normal opacity-60">fixado</span>
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-300/70">Efetivo Existente</span>
            <div className="text-xl sm:text-2xl font-black font-mono text-white mt-0.5 flex items-center gap-1.5">
              <FileSpreadsheet size={18} className="text-emerald-300" />
              {metrics.efetivoExistente} <span className="text-xs font-normal opacity-60">no Excel</span>
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-300/70">Efetivo Disponível</span>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-300 mt-0.5 flex items-center gap-1.5">
              <ShieldCheck size={18} className="text-emerald-400" />
              {metrics.efetivoDisponivel} <span className="text-xs font-normal opacity-60">militares</span>
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-300/70">Atividade Fim</span>
            <div className="text-xl sm:text-2xl font-black font-mono text-blue-300 mt-0.5 flex items-center gap-1.5">
              <Radio size={18} className="text-blue-400" />
              {metrics.atividadeFimGeral} <span className="text-xs font-normal opacity-60">em escala</span>
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-300/70">Atividade Meio</span>
            <div className="text-xl sm:text-2xl font-black font-mono text-amber-300 mt-0.5 flex items-center gap-1.5">
              <Briefcase size={18} className="text-amber-400" />
              {metrics.atividadeMeio} <span className="text-xs font-normal opacity-60">adm</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid - As 5 Métricas Principais Solicitadas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Efetivo Total Previsto */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                <Target size={22} />
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                Fixado: 400
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl sm:text-3xl font-black text-ink font-mono">{metrics.efetivoTotalPrevisto}</h3>
              <p className="text-xs font-bold text-ink/80 mt-1">
                Efetivo Total Previsto
              </p>
              <p className="text-[11px] text-ink/60 mt-1 leading-tight">
                Quadro Organizacional (QO) regulamentar fixado para o Batalhão.
              </p>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-ink/50 border-t border-line/50 pt-2 flex items-center justify-between">
            <span>Meta da Unidade</span>
            <span className="font-mono font-bold text-slate-700">400 vagas</span>
          </div>
        </div>

        {/* Card 2: Efetivo Existente */}
        <div 
          onClick={onNavigateToEfetivo}
          className="bg-white p-5 rounded-2xl border border-line shadow-xs hover:shadow-md hover:border-emerald-600 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-800 group-hover:bg-emerald-950 group-hover:text-white transition-colors">
                <FileSpreadsheet size={22} />
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
                Arquivo Excel
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl sm:text-3xl font-black text-ink font-mono">{metrics.efetivoExistente}</h3>
              <p className="text-xs font-bold text-ink/80 mt-1 flex items-center justify-between">
                <span>Efetivo Existente</span>
                <ArrowUpRight size={14} className="opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </p>
              <p className="text-[11px] text-ink/60 mt-1 leading-tight">
                Trata-se do número total de militares que constam no arquivo Excel adicionado.
              </p>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-ink/50 border-t border-line/50 pt-2 flex items-center justify-between">
            <span>Cobertura do QO</span>
            <span className="font-mono font-bold text-emerald-800">
              {Math.round((metrics.efetivoExistente / (metrics.efetivoTotalPrevisto || 400)) * 100)}% do previsto
            </span>
          </div>
        </div>

        {/* Card 3: Efetivo Disponível */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
                <ShieldCheck size={22} />
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Prontidão
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl sm:text-3xl font-black text-emerald-950 font-mono">{metrics.efetivoDisponivel}</h3>
              <p className="text-xs font-bold text-ink/80 mt-1">
                Efetivo Disponível
              </p>
              <p className="text-[11px] text-ink/60 mt-1 leading-tight">
                É o número do Efetivo Existente, subtraído o número de militares de LTS, à disposição e férias.
              </p>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-ink/50 border-t border-line/50 pt-2 flex items-center justify-between">
            <span>Subtraídos ({metrics.ltsCount + metrics.feriasCount + metrics.aDisposicaoCount})</span>
            <span className="font-mono font-bold text-emerald-700">
              {metrics.efetivoExistente > 0 ? Math.round((metrics.efetivoDisponivel / metrics.efetivoExistente) * 100) : 0}% da tropa
            </span>
          </div>
        </div>

        {/* Card 4: Atividade Fim - Geral */}
        <div className="bg-white p-5 rounded-2xl border border-blue-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700">
                <Radio size={22} />
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                Operacional
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl sm:text-3xl font-black text-blue-950 font-mono">{metrics.atividadeFimGeral}</h3>
              <p className="text-xs font-bold text-ink/80 mt-1">
                Atividade Fim - Geral
              </p>
              <p className="text-[11px] text-ink/60 mt-1 leading-tight">
                Todos os militares que estão em alguma escala, subtraído os que estão do Administrativo.
              </p>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-ink/50 border-t border-line/50 pt-2 flex items-center justify-between">
            <span>Escala Operacional</span>
            <span className="font-mono font-bold text-blue-700">
              {metrics.efetivoDisponivel > 0 ? Math.round((metrics.atividadeFimGeral / metrics.efetivoDisponivel) * 100) : 0}% do disponível
            </span>
          </div>
        </div>

        {/* Card 5: Atividade Meio */}
        <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
                <Briefcase size={22} />
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                Expediente
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl sm:text-3xl font-black text-amber-950 font-mono">{metrics.atividadeMeio}</h3>
              <p className="text-xs font-bold text-ink/80 mt-1">
                Atividade Meio
              </p>
              <p className="text-[11px] text-ink/60 mt-1 leading-tight">
                São aqueles que estão no Administrativo (expediente, seções e apoio).
              </p>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-ink/50 border-t border-line/50 pt-2 flex items-center justify-between">
            <span>Setor Administrativo</span>
            <span className="font-mono font-bold text-amber-800">
              {metrics.efetivoDisponivel > 0 ? Math.round((metrics.atividadeMeio / metrics.efetivoDisponivel) * 100) : 0}% do disponível
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Operational Status Bar - Visão Consolidada de Distribuição */}
      <div className="bg-white p-6 rounded-2xl border border-line shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <Activity size={18} className="text-emerald-800" />
              Distribuição Geral do Efetivo Existente ({metrics.efetivoExistente} militares)
            </h3>
            <p className="text-xs text-ink/60 mt-0.5">
              Alocação entre Atividade Fim, Atividade Meio e afastamentos (LTS, Férias e À Disposição)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200">
              Disponíveis: {metrics.efetivoDisponivel}
            </span>
            <span className="text-xs font-mono font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
              Previsto: {metrics.efetivoTotalPrevisto}
            </span>
          </div>
        </div>

        {/* Multi-color stacked progress bar */}
        <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex gap-0.5">
          <div 
            style={{ width: `${(metrics.atividadeFimGeral / (metrics.efetivoExistente || 1)) * 100}%` }}
            title={`Atividade Fim: ${metrics.atividadeFimGeral}`}
            className="h-full bg-emerald-600 transition-all"
          />
          <div 
            style={{ width: `${(metrics.atividadeMeio / (metrics.efetivoExistente || 1)) * 100}%` }}
            title={`Atividade Meio: ${metrics.atividadeMeio}`}
            className="h-full bg-amber-500 transition-all"
          />
          <div 
            style={{ width: `${(metrics.feriasCount / (metrics.efetivoExistente || 1)) * 100}%` }}
            title={`Férias: ${metrics.feriasCount}`}
            className="h-full bg-blue-500 transition-all"
          />
          <div 
            style={{ width: `${(metrics.ltsCount / (metrics.efetivoExistente || 1)) * 100}%` }}
            title={`LTS (Saúde): ${metrics.ltsCount}`}
            className="h-full bg-red-500 transition-all"
          />
          <div 
            style={{ width: `${(metrics.aDisposicaoCount / (metrics.efetivoExistente || 1)) * 100}%` }}
            title={`À Disposição: ${metrics.aDisposicaoCount}`}
            className="h-full bg-slate-400 transition-all"
          />
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-600 shrink-0"></span>
            <span className="text-ink/70">Atividade Fim: <strong className="text-ink font-mono">{metrics.atividadeFimGeral}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0"></span>
            <span className="text-ink/70">Atividade Meio: <strong className="text-ink font-mono">{metrics.atividadeMeio}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0"></span>
            <span className="text-ink/70">Em Férias: <strong className="text-ink font-mono">{metrics.feriasCount}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 shrink-0"></span>
            <span className="text-ink/70">LTS (Saúde): <strong className="text-ink font-mono">{metrics.ltsCount}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-slate-400 shrink-0"></span>
            <span className="text-ink/70">À Disposição: <strong className="text-ink font-mono">{metrics.aDisposicaoCount}</strong></span>
          </div>
        </div>
      </div>

      {/* Main Grid: Postos/Graduações & Tópico Férias */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Postos e Graduações */}
        <div className="bg-white p-6 rounded-2xl border border-line shadow-xs lg:col-span-1 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                <Award size={16} className="text-emerald-800" />
                Postos & Graduações
              </h3>
              <span className="text-xs text-ink/50 font-mono">Qtd / %</span>
            </div>

            <div className="space-y-3 mt-4">
              {metrics.distribuicaoPostos.map(item => (
                <div key={item.posto} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-ink">{item.posto}</span>
                    <span className="font-mono text-ink/70">{item.quantidade} ({item.percentual}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${item.percentual}%` }}
                      className="h-full bg-emerald-800 rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="pt-3 border-t border-line/60 text-[11px] text-ink/50 flex items-center justify-between">
            <span>Distribuição de Carreira</span>
            <span className="font-mono font-bold text-emerald-900">{metrics.totalEfetivo} mapeados</span>
          </div>
        </div>

        {/* Tópico: Férias do Efetivo */}
        <div 
          onClick={onNavigateToFerias}
          className="bg-white p-6 rounded-2xl border border-emerald-300/80 shadow-xs hover:shadow-md hover:border-emerald-800 transition-all cursor-pointer group lg:col-span-2 space-y-4 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-950 text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                  <Calendar size={20} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink flex items-center gap-2">
                    Tópico Férias
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold">
                      Previsão por Mês
                    </span>
                  </h3>
                  <p className="text-xs text-ink/60 mt-0.5">
                    Controle e escala anual de férias dos militares do 4º BPM
                  </p>
                </div>
              </div>

              <span className="text-xs text-emerald-800 font-bold group-hover:text-emerald-950 flex items-center gap-1">
                <span>Abrir Quadro de Férias</span>
                <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </div>

            {/* Quick vacation statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
              <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/60">
                <span className="text-[10px] uppercase font-mono font-bold text-emerald-900/70">Em Gozo Atualmente ({currentMonthName})</span>
                <div className="text-xl font-black font-mono text-emerald-950 mt-0.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                  {emGozoMesAtualCount} <span className="text-xs font-normal text-emerald-800">militares</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-line">
                <span className="text-[10px] uppercase font-mono font-bold text-ink/50">Total Previsto no Ano</span>
                <div className="text-xl font-black font-mono text-ink mt-0.5">
                  {ferias.length > 0 ? ferias.length : metrics.efetivoExistente} <span className="text-xs font-normal text-ink/50">previstos</span>
                </div>
              </div>

              <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/60 col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-mono font-bold text-blue-900/70">Importação de Arquivos</span>
                <div className="text-xs font-bold text-blue-950 mt-1 flex items-center gap-1">
                  <FileSpreadsheet size={13} className="text-emerald-700" /> Excel (.xlsx) / <FileText size={13} className="text-red-600" /> PDF
                </div>
              </div>
            </div>

            {/* Sample preview of scheduled soldiers */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-ink/70">
                <span>Militares com Previsão de Férias Agendada</span>
                <span className="text-[11px] text-emerald-800 font-normal">Clique para gerenciar meses e períodos &rarr;</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(ferias.length > 0 ? ferias.slice(0, 4) : efetivo.slice(0, 4)).map((item: any, idx: number) => {
                  const nome = item.nome || item.nomeCompleto;
                  const posto = item.posto || item.postoGraduacao;
                  const mes = item.mesPrevisto || (['Janeiro', 'Fevereiro', 'Março', 'Abril'][idx % 4]);
                  const mat = item.matricula;
                  return (
                    <div 
                      key={idx}
                      className="p-2.5 rounded-xl border border-line/60 bg-slate-50/70 flex items-center justify-between hover:bg-emerald-50/40 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white text-emerald-950 border border-line">
                          {posto}
                        </span>
                        <div className="truncate max-w-[140px] sm:max-w-[160px]">
                          <div className="text-xs font-bold text-ink truncate">{nome}</div>
                          <div className="text-[10px] text-ink/40 font-mono">{mat}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 shrink-0">
                        {mes}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="text-ink/60 text-[11px]">
              Possibilidade de anexar arquivo PDF ou Excel com a relação de militares por mês.
            </span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onNavigateToFerias();
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs self-start sm:self-auto cursor-pointer"
            >
              <Upload size={13} />
              <span>Adicionar Arquivo PDF / Excel de Férias</span>
            </button>
          </div>
        </div>
      </div>

      {/* Roster: Militares De Serviço Hoje */}
      <div className="bg-white rounded-2xl border border-line shadow-xs overflow-hidden">
        <div className="p-6 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <Clock size={18} className="text-blue-600" />
              Militares de Serviço Hoje (Turno Atual)
            </h3>
            <p className="text-xs text-ink/60 mt-0.5">Escalação ativa coletada a partir do banco de dados operacional</p>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1 bg-blue-50 text-blue-800 rounded-full border border-blue-200 self-start sm:self-auto">
            {metrics.militaresServicoHoje.length} em patrulhamento / serviço
          </span>
        </div>

        <div className="divide-y divide-line/60">
          {metrics.militaresServicoHoje.length > 0 ? (
            metrics.militaresServicoHoje.map((militar) => (
              <div key={militar.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-blue-100 text-blue-900 font-bold text-xs flex items-center justify-center font-mono shrink-0">
                    {militar.postoGraduacao}
                  </span>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-ink uppercase">
                      {militar.postoGraduacao} {militar.nomeGuerra}
                    </h4>
                    <p className="text-[10px] text-ink/50 font-mono">
                      Função: {militar.funcao}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 text-xs">
                  <span className="font-mono text-[11px] px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold shadow-2xs">
                    Posto: {militar.situacao}
                  </span>
                  <span className="font-mono text-[11px] px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                    {militar.escalaTipo}
                  </span>
                  <span className="text-[11px] text-ink/60 font-mono flex items-center gap-1">
                    <Phone size={11} /> {militar.contato}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-ink/40 text-xs italic">
              Nenhum militar registrado em serviço no momento.
            </div>
          )}
        </div>
      </div>

      {/* Two Column Section: Afastamentos & Quick Access to Extra Service */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Afastamentos / Férias e Licenças */}
        <div className="bg-white p-6 rounded-2xl border border-line shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
              <Calendar size={16} className="text-amber-600" />
              Controle de Férias & Licenças (Afastados)
            </h3>
            <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
              {militaresAfastados.length} no momento
            </span>
          </div>

          <div className="space-y-2.5">
            {militaresAfastados.length > 0 ? (
              militaresAfastados.map(m => (
                <div key={m.id} className="p-3 rounded-xl border border-amber-200/70 bg-amber-500/5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-ink">
                      {m.postoGraduacao} {m.nomeGuerra}
                    </p>
                    <p className="text-[10px] text-ink/60 font-mono">
                      Situação: <span className="font-semibold text-amber-900">{m.situacao}</span>
                    </p>
                    {m.observacao && (
                      <p className="text-[10px] text-ink/50 italic mt-0.5">{m.observacao}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                      Retorno: {m.dataRetorno ? new Date(m.dataRetorno).toLocaleDateString('pt-BR') : 'A definir'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-ink/40 italic py-4 text-center">Nenhum militar afastado no momento.</p>
            )}
          </div>
        </div>

        {/* Promo card to Gestão de Serviços Extras */}
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white p-6 rounded-2xl border border-amber-300/80 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-bold font-mono">
              <Sparkles size={11} />
              MÓDULO DE SERVIÇOS EXTRAS
            </div>
            <h3 className="text-base font-bold text-amber-950">
              Gestão e Fila de Serviços Extras
            </h3>
            <p className="text-xs text-amber-900/80 leading-relaxed">
              Importe a planilha do histórico de extras em Excel, analise a escala em PDF e organize os militares selecionados por ordem de tempo sem extra (maior tempo para o menor).
            </p>
          </div>

          <div className="p-3 bg-white/80 rounded-xl border border-amber-200/80 space-y-1 text-xs font-mono">
            <div className="flex items-center justify-between text-ink/70">
              <span>Aptos para extra hoje:</span>
              <strong className="text-emerald-800">{metrics.aptosExtra} militares</strong>
            </div>
            <div className="flex items-center justify-between text-ink/70">
              <span>Critério de Ordenação:</span>
              <strong className="text-amber-900">Maior tempo para menor</strong>
            </div>
          </div>

          <button
            onClick={onNavigateToExtras}
            className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            Acessar Gestão de Serviços Extras <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
