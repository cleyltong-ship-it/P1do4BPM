import React, { useState, useMemo } from 'react';
import { 
  Stethoscope, 
  Upload, 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Image as ImageIcon, 
  Trash2, 
  Edit3, 
  Check, 
  Filter, 
  Download, 
  Shield, 
  Activity, 
  ArrowRight,
  Info,
  CalendarCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DispensaMedicaLTS, EfetivoMilitar, TipoAfastamentoSaude } from '../types';
import { UploadDispensaModal } from './UploadDispensaModal';
import { ManualDispensaModal } from './ManualDispensaModal';

interface GestaoDispensasProps {
  dispensas: DispensaMedicaLTS[];
  efetivo: EfetivoMilitar[];
  onAddDispensa: (item: Omit<DispensaMedicaLTS, 'id' | 'criadoEm'>) => void;
  onUpdateDispensa: (id: string, updates: Partial<DispensaMedicaLTS>) => void;
  onDeleteDispensa: (id: string) => void;
}

export const GestaoDispensas: React.FC<GestaoDispensasProps> = ({
  dispensas,
  efetivo,
  onAddDispensa,
  onUpdateDispensa,
  onDeleteDispensa,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<'TODOS' | 'LTS' | 'Dispensa Médica'>('TODOS');
  const [filterSituacao, setFilterSituacao] = useState<'TODOS' | 'Em Andamento' | 'Concluída' | 'Prevista'>('TODOS');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DispensaMedicaLTS | null>(null);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Helper para calcular dias restantes até o retorno
  const getDiasRestantes = (dataFim: string): { dias: number; status: 'vigente' | 'hoje' | 'expirado' } => {
    try {
      const parts = dataFim.split('-');
      if (parts.length === 3) {
        const fim = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const hojeLimpo = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const diffTime = fim.getTime() - hojeLimpo.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 0) return { dias: diffDays, status: 'vigente' };
        if (diffDays === 0) return { dias: 0, status: 'hoje' };
        return { dias: Math.abs(diffDays), status: 'expirado' };
      }
    } catch (e) {
      console.error(e);
    }
    return { dias: 0, status: 'expirado' };
  };

  // Metrics
  const metrics = useMemo(() => {
    const ativas = dispensas.filter(d => d.situacao === 'Em Andamento');
    const totalLTS = ativas.filter(d => d.tipo === 'LTS').length;
    const totalDispensa = ativas.filter(d => d.tipo === 'Dispensa Médica').length;

    // Próximos retornos nos próximos 7 dias
    const proximosRetornos = ativas.filter(d => {
      const { dias, status } = getDiasRestantes(d.dataFimPrevista);
      return status === 'vigente' && dias <= 7;
    }).length;

    const mediaDias = ativas.length > 0 
      ? Math.round(ativas.reduce((acc, curr) => acc + curr.diasAfastamento, 0) / ativas.length)
      : 0;

    return {
      totalAtivos: ativas.length,
      totalLTS,
      totalDispensa,
      proximosRetornos,
      mediaDias
    };
  }, [dispensas]);

  // Filtered list
  const filteredDispensas = useMemo(() => {
    return dispensas.filter(item => {
      // Search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchName = (item.nome || '').toLowerCase().includes(term);
        const matchGuerra = (item.nomeGuerra || '').toLowerCase().includes(term);
        const matchMat = (item.matricula || '').toLowerCase().includes(term);
        const matchCid = (item.cid || '').toLowerCase().includes(term);
        const matchPosto = (item.postoGraduacao || '').toLowerCase().includes(term);
        if (!matchName && !matchGuerra && !matchMat && !matchCid && !matchPosto) {
          return false;
        }
      }

      // Filter Tipo
      if (filterTipo !== 'TODOS' && item.tipo !== filterTipo) {
        return false;
      }

      // Filter Situação
      if (filterSituacao !== 'TODOS' && item.situacao !== filterSituacao) {
        return false;
      }

      return true;
    });
  }, [dispensas, searchTerm, filterTipo, filterSituacao]);

  const handleEdit = (item: DispensaMedicaLTS) => {
    setEditingItem(item);
    setIsManualModalOpen(true);
  };

  const handleToggleSituacao = (item: DispensaMedicaLTS) => {
    const novaSituacao = item.situacao === 'Em Andamento' ? 'Concluída' : 'Em Andamento';
    onUpdateDispensa(item.id, { situacao: novaSituacao });
  };

  const formatDateBR = (isoDate: string) => {
    try {
      const parts = isoDate.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    } catch (e) {
      // fallback
    }
    return isoDate;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-950 via-slate-900 to-blue-900 text-white p-6 md:p-8 shadow-xl border border-blue-800/40">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-mono font-semibold tracking-wide">
              <Stethoscope size={14} className="text-blue-400" />
              SAÚDE OPERACIONAL & JUNTA MILITAR
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase font-sans">
              Dispensas Médicas & LTS
            </h1>
            <p className="text-blue-100/80 text-xs sm:text-sm leading-relaxed">
              Leitura automática de atestados e laudos (PDF ou JPG/PNG), registro de militar afastado, quantidade de dias, data prevista de término e CID.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg cursor-pointer"
            >
              <Upload size={16} />
              <span>Ler Atestado / Dispensa (PDF ou JPG)</span>
            </button>

            <button
              onClick={() => {
                setEditingItem(null);
                setIsManualModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer"
            >
              <Plus size={16} />
              <span>Cadastrar Manualmente</span>
            </button>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="mt-8 pt-6 border-t border-blue-800/60 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-blue-300/70">Afastados Atualmente</span>
            <div className="text-xl sm:text-2xl font-black font-mono text-white mt-0.5 flex items-center gap-1.5">
              <Activity size={18} className="text-red-400" />
              {metrics.totalAtivos} <span className="text-xs font-normal opacity-60">militares</span>
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-blue-300/70">Em LTS (JMS)</span>
            <div className="text-xl sm:text-2xl font-black font-mono text-red-300 mt-0.5 flex items-center gap-1.5">
              <Shield size={18} className="text-red-400" />
              {metrics.totalLTS} <span className="text-xs font-normal opacity-60">LTS</span>
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-blue-300/70">Em Dispensa Médica</span>
            <div className="text-xl sm:text-2xl font-black font-mono text-cyan-300 mt-0.5 flex items-center gap-1.5">
              <Stethoscope size={18} className="text-cyan-400" />
              {metrics.totalDispensa} <span className="text-xs font-normal opacity-60">dispensas</span>
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-blue-300/70">Retornos em 7 Dias</span>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-300 mt-0.5 flex items-center gap-1.5">
              <CalendarCheck size={18} className="text-emerald-400" />
              {metrics.proximosRetornos} <span className="text-xs font-normal opacity-60">próximos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-line shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full lg:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, matrícula, posto ou CID..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-line rounded-xl text-xs font-medium text-ink placeholder:text-ink/40 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-line text-xs">
            <button
              onClick={() => setFilterTipo('TODOS')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filterTipo === 'TODOS' ? 'bg-white text-ink shadow-xs' : 'text-ink/60 hover:text-ink'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterTipo('LTS')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filterTipo === 'LTS' ? 'bg-red-700 text-white shadow-xs' : 'text-ink/60 hover:text-ink'
              }`}
            >
              LTS
            </button>
            <button
              onClick={() => setFilterTipo('Dispensa Médica')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filterTipo === 'Dispensa Médica' ? 'bg-blue-900 text-white shadow-xs' : 'text-ink/60 hover:text-ink'
              }`}
            >
              Dispensas
            </button>
          </div>

          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-line text-xs">
            <button
              onClick={() => setFilterSituacao('TODOS')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filterSituacao === 'TODOS' ? 'bg-white text-ink shadow-xs' : 'text-ink/60 hover:text-ink'
              }`}
            >
              Status: Todos
            </button>
            <button
              onClick={() => setFilterSituacao('Em Andamento')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filterSituacao === 'Em Andamento' ? 'bg-amber-600 text-white shadow-xs' : 'text-ink/60 hover:text-ink'
              }`}
            >
              Em Andamento
            </button>
            <button
              onClick={() => setFilterSituacao('Concluída')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filterSituacao === 'Concluída' ? 'bg-emerald-700 text-white shadow-xs' : 'text-ink/60 hover:text-ink'
              }`}
            >
              Concluídas
            </button>
          </div>
        </div>
      </div>

      {/* Main Table / List */}
      <div className="bg-white rounded-2xl border border-line shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-ink uppercase tracking-wider">
              Relação de Afastamentos Médicos & LTS
            </h3>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {filteredDispensas.length} registros
            </span>
          </div>

          <span className="text-[11px] text-ink/50 hidden sm:inline-block">
            Cálculo de retorno baseado na data de início e tempo prescrito
          </span>
        </div>

        {filteredDispensas.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-ink/60 uppercase font-mono text-[10px] tracking-wider border-b border-line">
                <tr>
                  <th className="py-3 px-4">Militar</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Tempo (Dias)</th>
                  <th className="py-3 px-4">Período (Início &rarr; Término)</th>
                  <th className="py-3 px-4">CID</th>
                  <th className="py-3 px-4">Origem / Médico</th>
                  <th className="py-3 px-4">Status & Retorno</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {filteredDispensas.map((item) => {
                  const ret = getDiasRestantes(item.dataFimPrevista);
                  const isEmAndamento = item.situacao === 'Em Andamento';

                  return (
                    <tr 
                      key={item.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        !isEmAndamento ? 'opacity-60 bg-slate-50/30' : ''
                      }`}
                    >
                      {/* Militar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200 shrink-0">
                            {item.postoGraduacao}
                          </span>
                          <div>
                            <div className="font-bold text-ink uppercase">
                              {item.nomeGuerra || item.nome}
                            </div>
                            <div className="text-[11px] text-ink/50 truncate max-w-[200px]" title={item.nome}>
                              {item.nome}
                            </div>
                            <div className="text-[10px] font-mono text-ink/40">
                              Mat: {item.matricula}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Tipo */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 font-bold text-[11px] px-2.5 py-1 rounded-full ${
                          item.tipo === 'LTS'
                            ? 'bg-red-100 text-red-900 border border-red-200'
                            : 'bg-blue-100 text-blue-900 border border-blue-200'
                        }`}>
                          {item.tipo === 'LTS' ? <Shield size={12} /> : <Stethoscope size={12} />}
                          {item.tipo}
                        </span>
                      </td>

                      {/* Tempo */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-ink text-sm">
                          {item.diasAfastamento} <span className="text-[10px] font-normal text-ink/60">dias</span>
                        </div>
                      </td>

                      {/* Período */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 font-mono text-[11px]">
                          <div className="text-ink/70">
                            Início: <strong className="text-ink">{formatDateBR(item.dataInicio)}</strong>
                          </div>
                          <div className="text-blue-950 font-bold flex items-center gap-1">
                            Término: <span>{formatDateBR(item.dataFimPrevista)}</span>
                          </div>
                        </div>
                      </td>

                      {/* CID */}
                      <td className="py-3.5 px-4">
                        {item.cid ? (
                          <div>
                            <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-purple-100 text-purple-950 border border-purple-200">
                              {item.cid}
                            </span>
                            {item.descricaoCid && (
                              <p className="text-[10px] text-ink/60 mt-1 truncate max-w-[170px]" title={item.descricaoCid}>
                                {item.descricaoCid}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-ink/30 italic text-[11px]">Não informado</span>
                        )}
                      </td>

                      {/* Origem / Médico */}
                      <td className="py-3.5 px-4">
                        <div className="max-w-[170px]">
                          <div className="text-ink/80 text-[11px] truncate font-medium" title={item.medicoOuJunta}>
                            {item.medicoOuJunta || 'JMS / PMAL'}
                          </div>
                          {item.documentoOrigem && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-ink/50 font-mono mt-0.5 truncate max-w-[160px]" title={item.documentoOrigem}>
                              {item.documentoOrigem.toLowerCase().endsWith('.pdf') ? (
                                <FileText size={10} className="text-red-600 shrink-0" />
                              ) : (
                                <ImageIcon size={10} className="text-blue-600 shrink-0" />
                              )}
                              <span className="truncate">{item.documentoOrigem}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status & Retorno */}
                      <td className="py-3.5 px-4">
                        {isEmAndamento ? (
                          <div>
                            {ret.status === 'vigente' && (
                              <span className={`inline-flex items-center gap-1 text-[11px] font-bold font-mono px-2.5 py-1 rounded-full ${
                                ret.dias <= 3 
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse' 
                                  : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                              }`}>
                                <Clock size={12} />
                                {ret.dias === 1 ? 'Retorna amanhã' : `Restam ${ret.dias} dias`}
                              </span>
                            )}
                            {ret.status === 'hoje' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold font-mono px-2.5 py-1 rounded-full bg-blue-100 text-blue-900 border border-blue-300 animate-bounce">
                                <Clock size={12} />
                                Retorna Hoje
                              </span>
                            )}
                            {ret.status === 'expirado' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold font-mono px-2.5 py-1 rounded-full bg-red-100 text-red-900 border border-red-300">
                                <AlertTriangle size={12} />
                                Prazo vencido ({ret.dias}d)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            <Check size={12} /> Concluída
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleSituacao(item)}
                            title={isEmAndamento ? 'Marcar como Concluído / Retornado' : 'Reativar Afastamento'}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              isEmAndamento 
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' 
                                : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <CheckCircle2 size={14} />
                          </button>
                          <button
                            onClick={() => handleEdit(item)}
                            title="Editar registro"
                            className="p-1.5 rounded-lg border border-line bg-white hover:bg-slate-100 text-ink/70 hover:text-ink transition-colors cursor-pointer"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Deseja remover o afastamento de ${item.nomeGuerra || item.nome}?`)) {
                                onDeleteDispensa(item.id);
                              }
                            }}
                            title="Excluir"
                            className="p-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-800 flex items-center justify-center mx-auto">
              <Stethoscope size={28} />
            </div>
            <h4 className="text-sm font-bold text-ink">Nenhum registro de dispensa ou LTS encontrado</h4>
            <p className="text-xs text-ink/60 max-w-md mx-auto">
              Utilize o botão acima para enviar um atestado em PDF ou JPG com leitura de texto, ou cadastre os dados do policial militar manualmente.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="px-4 py-2 bg-blue-950 hover:bg-blue-900 text-white font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Upload size={14} />
                Ler Atestado PDF / JPG
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <UploadDispensaModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        efetivo={efetivo}
        onSave={onAddDispensa}
        onOpenManualModal={() => {
          setEditingItem(null);
          setIsManualModalOpen(true);
        }}
      />

      <ManualDispensaModal
        isOpen={isManualModalOpen}
        onClose={() => {
          setIsManualModalOpen(false);
          setEditingItem(null);
        }}
        efetivo={efetivo}
        onSave={(data) => {
          if (editingItem) {
            onUpdateDispensa(editingItem.id, data);
          } else {
            onAddDispensa(data);
          }
        }}
        initialData={editingItem}
      />
    </div>
  );
};
