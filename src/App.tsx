import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  LayoutDashboard, 
  Users, 
  CalendarCheck, 
  UserPlus,
  Shield,
  Activity,
  Layers,
  ChevronRight,
  CheckCircle2,
  Calendar,
  Stethoscope
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { EfetivoMilitar, DashboardMetrics, DispensaMedicaLTS } from './types';
import { 
  getEfetivo, 
  saveEfetivo,
  addMilitar, 
  updateMilitar, 
  deleteMilitar, 
  resetEfetivoToDefault, 
  clearAllEfetivo,
  importEfetivoReplace,
  importEfetivoMerge,
  calculateDashboardMetrics 
} from './services/efetivoDatabase';
import { Dashboard } from './components/Dashboard';
import { GestaoEfetivo } from './components/GestaoEfetivo';
import { GestaoServicosExtras } from './components/GestaoServicosExtras';
import { GestaoFerias } from './components/GestaoFerias';
import { GestaoDispensas } from './components/GestaoDispensas';
import { ImportEfetivoModal } from './components/ImportEfetivoModal';
import { ImportEscalaPdfModal } from './components/ImportEscalaPdfModal';
import { 
  getPrevisaoFerias, 
  savePrevisaoFerias,
  addPrevisaoFerias, 
  updatePrevisaoFerias, 
  deletePrevisaoFerias, 
  clearAllFerias,
  importFeriasReplace, 
  importFeriasMerge 
} from './services/feriasDatabase';
import { 
  getDispensas, 
  addDispensa, 
  updateDispensa, 
  deleteDispensa 
} from './services/dispensasDatabase';
import { PrevisaoFerias } from './types';
import { MESES_DO_ANO } from './services/feriasFileParser';

export default function App() {
  const [mainTab, setMainTab] = useState<'dashboard' | 'efetivo' | 'extras' | 'ferias' | 'dispensas'>('dashboard');
  const [efetivo, setEfetivo] = useState<EfetivoMilitar[]>([]);
  const [ferias, setFerias] = useState<PrevisaoFerias[]>([]);
  const [dispensas, setDispensas] = useState<DispensaMedicaLTS[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportPdfModalOpen, setIsImportPdfModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const currentMonthIndex = new Date().getMonth();
  const currentMonthName = MESES_DO_ANO[currentMonthIndex];
  const currentYear = new Date().getFullYear();

  // Dispensas ativas no momento
  const dispensasAtivasCount = useMemo(() => {
    return dispensas.filter(d => d.situacao === 'Em Andamento').length;
  }, [dispensas]);

  // Férias no mês vigente
  const feriasMesVigenteCount = useMemo(() => {
    const listCount = ferias.filter(f => {
      if (f.ano && f.ano !== currentYear) return false;
      const normMes = (f.mesPrevisto || '').toString().trim().toLowerCase();
      const isCurrentMonth = 
        normMes === currentMonthName.toLowerCase() ||
        normMes.startsWith(currentMonthName.slice(0, 3).toLowerCase()) ||
        normMes === String(currentMonthIndex + 1) ||
        normMes === String(currentMonthIndex + 1).padStart(2, '0');
      return isCurrentMonth || f.situacao === 'Em Gozo';
    }).length;

    if (listCount > 0) return listCount;

    const fromEfetivo = efetivo.filter(m => {
      const s = (m.situacao || '').toLowerCase();
      return s.includes('férias') || s.includes('ferias');
    }).length;

    return fromEfetivo;
  }, [ferias, efetivo, currentMonthName, currentMonthIndex, currentYear]);

  // Load initial data from database
  useEffect(() => {
    const loaded = getEfetivo();
    setEfetivo(loaded);
    setMetrics(calculateDashboardMetrics(loaded));
    const loadedFerias = getPrevisaoFerias(loaded);
    setFerias(loadedFerias);
    const loadedDispensas = getDispensas(loaded);
    setDispensas(loadedDispensas);
  }, []);

  // Update metrics whenever efetivo changes and persist
  const handleEfetivoChange = (newEfetivo: EfetivoMilitar[]) => {
    saveEfetivo(newEfetivo);
    setEfetivo(newEfetivo);
    setMetrics(calculateDashboardMetrics(newEfetivo));
  };

  const handleFeriasChange = (newFerias: PrevisaoFerias[]) => {
    savePrevisaoFerias(newFerias);
    setFerias(newFerias);
  };

  const handleAddMilitar = (m: Omit<EfetivoMilitar, 'id'>) => {
    const created = addMilitar(m);
    const updated = [created, ...efetivo];
    handleEfetivoChange(updated);
  };

  const handleUpdateMilitar = (id: string, updates: Partial<EfetivoMilitar>) => {
    updateMilitar(id, updates);
    const updated = efetivo.map(m => m.id === id ? { ...m, ...updates } : m);
    handleEfetivoChange(updated);
  };

  const handleDeleteMilitar = (id: string) => {
    deleteMilitar(id);
    const updated = efetivo.filter(m => m.id !== id);
    handleEfetivoChange(updated);
  };

  const handleResetDefault = () => {
    const res = resetEfetivoToDefault();
    handleEfetivoChange(res);
  };

  const handleClearAllEfetivo = (clearFeriasAlso: boolean = true) => {
    const cleared = clearAllEfetivo();
    handleEfetivoChange(cleared);
    if (clearFeriasAlso) {
      const clearedFerias = clearAllFerias();
      handleFeriasChange(clearedFerias);
    }
    setToastMessage('Todo o banco de dados foi limpo com sucesso! (0 militares cadastrados)');
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleImportEfetivo = (importedList: EfetivoMilitar[], mode: 'replace' | 'merge') => {
    let updated: EfetivoMilitar[];
    if (mode === 'replace') {
      updated = importEfetivoReplace(importedList);
    } else {
      updated = importEfetivoMerge(importedList);
    }
    handleEfetivoChange(updated);
    setToastMessage(`Planilha importada com sucesso! ${importedList.length} militares processados e Dashboard atualizado.`);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleApplyEscalaPdf = (
    updatedEfetivo: EfetivoMilitar[],
    stats: { matched: number; notMatched: number; notInScale: number }
  ) => {
    handleEfetivoChange(updatedEfetivo);
    setToastMessage(`Escala em PDF aplicada com sucesso! ${stats.matched} militares alocados nos postos da escala.`);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Handlers for Férias
  const handleAddFerias = (record: Omit<PrevisaoFerias, 'id'>) => {
    const created = addPrevisaoFerias(record);
    const updated = [created, ...ferias];
    setFerias(updated);

    // If marked 'Em Gozo', sync soldier status in efetivo
    if (record.situacao === 'Em Gozo') {
      const match = efetivo.find(m => m.matricula === record.matricula);
      if (match && match.situacao !== 'Férias') {
        handleUpdateMilitar(match.id, { situacao: 'Férias' });
      }
    }

    setToastMessage(`Férias de ${record.nome} agendadas para ${record.mesPrevisto}.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleUpdateFerias = (id: string, updates: Partial<PrevisaoFerias>) => {
    const updated = updatePrevisaoFerias(id, updates);
    setFerias(updated);

    const item = updated.find(f => f.id === id);
    if (item) {
      const match = efetivo.find(m => m.matricula === item.matricula);
      if (match) {
        if (updates.situacao === 'Em Gozo' && match.situacao !== 'Férias') {
          handleUpdateMilitar(match.id, { situacao: 'Férias' });
        } else if (updates.situacao === 'Concluída' && match.situacao === 'Férias') {
          handleUpdateMilitar(match.id, { situacao: 'Pronto' });
        }
      }
    }

    setToastMessage('Registro de férias atualizado com sucesso.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDeleteFerias = (id: string) => {
    const updated = deletePrevisaoFerias(id);
    setFerias(updated);
    setToastMessage('Registro de férias removido.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleImportFerias = (records: PrevisaoFerias[], mode: 'replace' | 'merge') => {
    let updated: PrevisaoFerias[];
    if (mode === 'replace') {
      updated = importFeriasReplace(records);
    } else {
      updated = importFeriasMerge(records);
    }
    setFerias(updated);

    // Sync soldiers currently in 'Em Gozo' to status 'Férias' in database
    const inGozoMats = new Set(updated.filter(f => f.situacao === 'Em Gozo').map(f => f.matricula));
    let hasEfetivoUpdates = false;
    const newEfetivo = efetivo.map(m => {
      if (inGozoMats.has(m.matricula) && m.situacao !== 'Férias') {
        hasEfetivoUpdates = true;
        return { ...m, situacao: 'Férias' as const };
      }
      return m;
    });

    if (hasEfetivoUpdates) {
      handleEfetivoChange(newEfetivo);
    }

    setToastMessage(`Relação de férias importada com sucesso! ${records.length} militares processados.`);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Handlers for Dispensas Médicas & LTS
  const handleAddDispensa = (record: Omit<DispensaMedicaLTS, 'id' | 'criadoEm'>) => {
    const created = addDispensa(record);
    const updated = [created, ...dispensas];
    setDispensas(updated);

    // Se militar cadastrado no efetivo, sincroniza situação
    const match = efetivo.find(m => m.matricula === record.matricula);
    if (match) {
      const situacaoSaude = record.tipo === 'LTS' ? 'LTS' : 'Dispensa Recompensa';
      handleUpdateMilitar(match.id, { 
        situacao: situacaoSaude,
        dataRetorno: record.dataFimPrevista,
        observacao: `${record.tipo}${record.cid ? ` (CID: ${record.cid})` : ''} - Retorno previsto: ${record.dataFimPrevista}`
      });
    }

    setToastMessage(`Dispensa/LTS cadastrada para ${record.nome} (${record.diasAfastamento} dias).`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleUpdateDispensa = (id: string, updates: Partial<DispensaMedicaLTS>) => {
    const updated = updateDispensa(id, updates);
    setDispensas(updated);

    const item = updated.find(d => d.id === id);
    if (item) {
      const match = efetivo.find(m => m.matricula === item.matricula);
      if (match) {
        if (updates.situacao === 'Concluída' && (match.situacao === 'LTS' || match.situacao === 'Dispensa Recompensa')) {
          handleUpdateMilitar(match.id, { situacao: 'Pronto' });
        }
      }
    }

    setToastMessage('Registro de dispensa médica/LTS atualizado.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDeleteDispensa = (id: string) => {
    const updated = deleteDispensa(id);
    setDispensas(updated);
    setToastMessage('Registro de dispensa/LTS excluído.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-ink flex flex-col font-sans selection:bg-blue-950 selection:text-white">
      {/* Top Main Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-line shadow-2xs">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          {/* Logo & Battalion Identification com Brasão Oficial */}
          <div 
            onClick={() => setMainTab('dashboard')}
            className="flex items-center gap-3 cursor-pointer group shrink-0"
          >
            <img 
              src="/brasao_4bpm.jpg" 
              alt="Brasão do 4º Batalhão de Polícia Militar" 
              className="w-10 h-12 sm:w-11 sm:h-13 object-contain drop-shadow-md group-hover:scale-105 transition-all shrink-0" 
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-black tracking-tight text-ink uppercase">
                  4º Batalhão de Polícia Militar
                </span>
                <span className="hidden lg:inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 font-bold">
                  CPMR
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-ink/50 font-mono hidden sm:block">
                Gestão Integrada de Efetivo, Férias & LTS
              </p>
            </div>
          </div>

          {/* Main Module Tabs Navigation */}
          <nav className="flex items-center gap-1 sm:gap-1.5 p-1 bg-slate-100 rounded-2xl border border-line/80 overflow-x-auto">
            <button
              onClick={() => setMainTab('dashboard')}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0",
                mainTab === 'dashboard'
                  ? "bg-blue-950 text-white shadow-xs"
                  : "text-ink/60 hover:text-ink hover:bg-white/60"
              )}
            >
              <LayoutDashboard size={15} />
              <span className="hidden sm:inline">Dashboard</span>
              <span className="sm:hidden">Início</span>
            </button>

            <button
              onClick={() => setMainTab('efetivo')}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0",
                mainTab === 'efetivo'
                  ? "bg-blue-950 text-white shadow-xs"
                  : "text-ink/60 hover:text-ink hover:bg-white/60"
              )}
            >
              <Users size={15} />
              <span className="hidden md:inline">Gestão de Efetivo</span>
              <span className="md:hidden">Efetivo</span>
              {efetivo.length > 0 && (
                <span className={cn(
                  "text-[10px] font-mono px-1.5 py-0.2 rounded-full",
                  mainTab === 'efetivo' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                )}>
                  {efetivo.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setMainTab('dispensas')}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0",
                mainTab === 'dispensas'
                  ? "bg-blue-950 text-white shadow-xs"
                  : "text-ink/60 hover:text-ink hover:bg-white/60"
              )}
              title={`Dispensas Médicas e LTS: ${dispensasAtivasCount} ativas`}
            >
              <Stethoscope size={15} />
              <span className="hidden lg:inline">Dispensas & LTS</span>
              <span className="lg:hidden">Dispensas</span>
              {dispensasAtivasCount > 0 && (
                <span className={cn(
                  "text-[10px] font-mono px-1.5 py-0.2 rounded-full",
                  mainTab === 'dispensas' ? "bg-white/20 text-white" : "bg-cyan-100 text-cyan-900 font-bold"
                )}>
                  {dispensasAtivasCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setMainTab('ferias')}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0",
                mainTab === 'ferias'
                  ? "bg-blue-950 text-white shadow-xs"
                  : "text-ink/60 hover:text-ink hover:bg-white/60"
              )}
              title={`Férias no mês vigente (${currentMonthName}): ${feriasMesVigenteCount} militares`}
            >
              <Calendar size={15} />
              <span>Férias</span>
              {feriasMesVigenteCount > 0 && (
                <span className={cn(
                  "text-[10px] font-mono px-1.5 py-0.2 rounded-full",
                  mainTab === 'ferias' ? "bg-white/20 text-white" : "bg-blue-100 text-blue-900 font-bold"
                )}>
                  {feriasMesVigenteCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setMainTab('extras')}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0",
                mainTab === 'extras'
                  ? "bg-amber-600 text-white shadow-xs"
                  : "text-amber-900 bg-amber-500/10 hover:bg-amber-500/20"
              )}
            >
              <CalendarCheck size={15} />
              <span className="hidden md:inline">Serviços Extras</span>
              <span className="md:hidden">Extras</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 bg-blue-950 text-white px-4 py-3 rounded-2xl shadow-xl border border-blue-700/50 flex items-center gap-3 text-xs font-medium"
          >
            <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 size={16} />
            </div>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        <AnimatePresence mode="wait">
          {mainTab === 'dashboard' && metrics && (
            <motion.div
              key="tab-dashboard"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <Dashboard
                metrics={metrics}
                efetivo={efetivo}
                ferias={ferias}
                dispensas={dispensas}
                onNavigateToExtras={() => setMainTab('extras')}
                onNavigateToEfetivo={() => setMainTab('efetivo')}
                onNavigateToFerias={() => setMainTab('ferias')}
                onNavigateToDispensas={() => setMainTab('dispensas')}
                onOpenAddModal={() => setIsAddModalOpen(true)}
                onOpenImportModal={() => setIsImportModalOpen(true)}
                onOpenImportPdfModal={() => setIsImportPdfModalOpen(true)}
              />
            </motion.div>
          )}

          {mainTab === 'dispensas' && (
            <motion.div
              key="tab-dispensas"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <GestaoDispensas
                dispensas={dispensas}
                efetivo={efetivo}
                onAddDispensa={handleAddDispensa}
                onUpdateDispensa={handleUpdateDispensa}
                onDeleteDispensa={handleDeleteDispensa}
              />
            </motion.div>
          )}

          {mainTab === 'efetivo' && (
            <motion.div
              key="tab-efetivo"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <GestaoEfetivo
                efetivo={efetivo}
                onAddMilitar={handleAddMilitar}
                onUpdateMilitar={handleUpdateMilitar}
                onDeleteMilitar={handleDeleteMilitar}
                onResetDefault={handleResetDefault}
                onClearAllEfetivo={handleClearAllEfetivo}
                isAddModalOpen={isAddModalOpen}
                setIsAddModalOpen={setIsAddModalOpen}
                onOpenImportModal={() => setIsImportModalOpen(true)}
                onOpenImportPdfModal={() => setIsImportPdfModalOpen(true)}
              />
            </motion.div>
          )}

          {mainTab === 'extras' && (
            <motion.div
              key="tab-extras"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <GestaoServicosExtras />
            </motion.div>
          )}

          {mainTab === 'ferias' && (
            <motion.div
              key="tab-ferias"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <GestaoFerias
                ferias={ferias}
                efetivo={efetivo}
                onAddFerias={handleAddFerias}
                onUpdateFerias={handleUpdateFerias}
                onDeleteFerias={handleDeleteFerias}
                onImportFerias={handleImportFerias}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Import Excel Modal */}
      <ImportEfetivoModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportEfetivo}
        currentEfetivoCount={efetivo.length}
        onClearAll={handleClearAllEfetivo}
      />

      {/* Import Escala PDF Modal */}
      <ImportEscalaPdfModal
        isOpen={isImportPdfModalOpen}
        onClose={() => setIsImportPdfModalOpen(false)}
        efetivo={efetivo}
        onApplyEscala={handleApplyEscalaPdf}
      />

      {/* Footer */}
      <footer className="mt-auto py-8 border-t border-line bg-white text-center text-xs text-ink/40 font-mono">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>4º BATALHÃO DE POLÍCIA MILITAR — POLÍCIA MILITAR DE ALAGOAS</span>
          <span>SISTEMA INTEGRADO DE EFETIVO & ESCALAS</span>
        </div>
      </footer>
    </div>
  );
}
