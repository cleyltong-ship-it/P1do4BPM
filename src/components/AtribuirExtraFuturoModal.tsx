import React, { useState } from 'react';
import { 
  CalendarPlus, 
  Calendar, 
  Users, 
  Clock, 
  X, 
  Check, 
  Sparkles,
  CloudUpload,
  Info
} from 'lucide-react';

interface AtribuirExtraFuturoModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetSoldiers: { name: string; rank?: string }[];
  onConfirm: (futureDate: Date, note: string) => Promise<void>;
  isSubmitting: boolean;
  filterDescription?: string;
}

export const AtribuirExtraFuturoModal: React.FC<AtribuirExtraFuturoModalProps> = ({
  isOpen,
  onClose,
  targetSoldiers,
  onConfirm,
  isSubmitting,
  filterDescription
}) => {
  // Format today / tomorrow for the date picker
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const [dateStr, setDateStr] = useState<string>(tomorrowStr);
  const [note, setNote] = useState<string>('Serviço Extra');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Shortcut helpers
  const setQuickDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setDateStr(d.toISOString().split('T')[0]);
  };

  const setNextWeekend = (targetDayOfWeek: 0 | 6) => {
    // 0 = Sunday, 6 = Saturday
    const d = new Date();
    const currentDay = d.getDay();
    let diff = targetDayOfWeek - currentDay;
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() + diff);
    setDateStr(d.toISOString().split('T')[0]);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!dateStr) {
      setErrorMessage('Por favor, selecione uma data válida para o serviço extra.');
      return;
    }

    const parts = dateStr.split('-');
    if (parts.length !== 3) {
      setErrorMessage('Formato de data inválido.');
      return;
    }

    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);
    const selectedDate = new Date(year, month, day, 12, 0, 0);

    if (isNaN(selectedDate.getTime())) {
      setErrorMessage('Data selecionada inválida.');
      return;
    }

    if (targetSoldiers.length === 0) {
      setErrorMessage('Nenhum militar selecionado para atribuição.');
      return;
    }

    try {
      await onConfirm(selectedDate, note.trim() || 'Serviço Extra');
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar atribuição.');
    }
  };

  const formattedSelectedDate = (() => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div 
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-line overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-line flex items-center justify-between bg-amber-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <CalendarPlus size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink">Atribuir Data Futura de Extra</h3>
              <p className="text-xs text-ink/60">
                Adicionar automaticamente à planilha e atualizar fila de prioridades
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-ink/40 hover:text-ink hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-ink">
          {/* Target Audience Summary */}
          <div className="p-3.5 bg-slate-50 border border-line rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-950 text-white flex items-center justify-center font-bold text-xs">
                <Users size={15} />
              </div>
              <div>
                <span className="text-[10px] text-ink/50 uppercase font-bold tracking-wider">Militares Alvo</span>
                <p className="font-bold text-ink text-sm">
                  {targetSoldiers.length} militar(es) selecionado(s)
                </p>
              </div>
            </div>
            {filterDescription && (
              <span className="text-[11px] font-medium text-ink/60 bg-white px-2.5 py-1 rounded-md border border-line">
                {filterDescription}
              </span>
            )}
          </div>

          {/* Date Picker & Shortcuts */}
          <div className="space-y-2">
            <label className="font-bold text-ink text-xs flex items-center gap-1.5">
              <Calendar size={14} className="text-amber-600" />
              Selecione a Data Futura do Serviço Extra:
            </label>
            <input 
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-semibold bg-white border border-line rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 shadow-xs cursor-pointer"
              required
            />

            {/* Quick shortcuts */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setQuickDate(1)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-semibold text-ink/80 transition-colors cursor-pointer"
              >
                Amanhã
              </button>
              <button
                type="button"
                onClick={() => setQuickDate(2)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-semibold text-ink/80 transition-colors cursor-pointer"
              >
                +2 dias
              </button>
              <button
                type="button"
                onClick={() => setQuickDate(7)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-semibold text-ink/80 transition-colors cursor-pointer"
              >
                +7 dias
              </button>
              <button
                type="button"
                onClick={() => setNextWeekend(6)}
                className="px-2.5 py-1 bg-amber-100 text-amber-900 hover:bg-amber-200 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
              >
                Próximo Sábado
              </button>
              <button
                type="button"
                onClick={() => setNextWeekend(0)}
                className="px-2.5 py-1 bg-amber-100 text-amber-900 hover:bg-amber-200 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
              >
                Próximo Domingo
              </button>
            </div>
          </div>

          {/* Note / Modalidade */}
          <div className="space-y-1">
            <label className="font-bold text-ink text-xs flex items-center gap-1.5">
              <Clock size={14} className="text-emerald-800" />
              Modalidade ou Observação:
            </label>
            <input 
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: Serviço Extra, Operação Reforço, Evento..."
              className="w-full px-3.5 py-2 text-xs bg-white border border-line rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-950/20 shadow-xs"
            />
          </div>

          {/* Selected Soldiers Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-ink/60">
              <span>Lista de Militares que Receberão a Data:</span>
              <span>{targetSoldiers.length} nomes</span>
            </div>
            <div className="max-h-36 overflow-y-auto p-2 bg-slate-50 border border-line rounded-xl divide-y divide-line/60">
              {targetSoldiers.map((soldier, idx) => (
                <div key={idx} className="py-1 px-1.5 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-ink uppercase truncate">
                    {idx + 1}. {soldier.name}
                  </span>
                  <span className="text-[10px] text-amber-800 font-mono font-medium shrink-0 ml-2">
                    {formattedSelectedDate}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Error display */}
          {errorMessage && (
            <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs">
              {errorMessage}
            </div>
          )}

          {/* Information box */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-[11px] text-emerald-900 flex items-start gap-2">
            <CloudUpload size={16} className="text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Gravação Automática na Planilha:</span>
              <p className="opacity-90 mt-0.5">
                Esta ação grava imediatamente a data <strong>{formattedSelectedDate}</strong> no histórico dos militares selecionados e dispara o envio via API para a planilha Google vinculada.
              </p>
            </div>
          </div>

          {/* Footer inside form */}
          <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-line font-semibold text-xs text-ink hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || targetSoldiers.length === 0}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Salvando na Planilha...
                </>
              ) : (
                <>
                  <CalendarPlus size={15} />
                  Atribuir e Salvar na Planilha
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
