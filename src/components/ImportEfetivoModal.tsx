import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  FileDown, 
  X, 
  Layers, 
  Users, 
  ArrowRight,
  RefreshCw,
  Eye,
  Check,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EfetivoMilitar } from '../types';
import { parseEfetivoExcel, downloadModeloExcelEfetivo, ParseExcelResult } from '../services/excelEfetivoParser';
import { cn } from '../lib/utils';

interface ImportEfetivoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (newEfetivo: EfetivoMilitar[], mode: 'replace' | 'merge') => void;
  currentEfetivoCount: number;
  onClearAll?: (clearFerias: boolean) => void;
}

export const ImportEfetivoModal: React.FC<ImportEfetivoModalProps> = ({
  isOpen,
  onClose,
  onImport,
  currentEfetivoCount,
  onClearAll,
}) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseExcelResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setIsParsing(true);
    setErrorMessage(null);
    try {
      const result = await parseEfetivoExcel(file);
      setParseResult(result);
    } catch (err: any) {
      console.error('Error parsing Excel:', err);
      setErrorMessage(err?.message || 'Falha ao processar o arquivo Excel. Verifique se as colunas estão corretas.');
      setParseResult(null);
    } finally {
      setIsParsing(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleConfirm = () => {
    if (!parseResult) return;
    onImport(parseResult.militares, importMode);
    onClose();
    // Reset state
    setParseResult(null);
    setErrorMessage(null);
  };

  const handleResetFile = () => {
    setParseResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-line overflow-hidden my-6"
      >
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Importar Planilha de Efetivo Militar
              </h3>
              <p className="text-xs text-blue-200/80 font-sans">
                Carregue uma planilha Excel (.xlsx, .xls) para atualizar todo o efetivo e alimentar o Dashboard.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Clear database alert if populated */}
          {currentEfetivoCount > 0 && onClearAll && !parseResult && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-xs">
              <div className="flex items-center gap-2 text-rose-950">
                <Trash2 size={16} className="shrink-0 text-rose-600" />
                <span>
                  O banco possui atualmente <strong>{currentEfetivoCount} militares</strong>. Se preferir zerar a lista antes de uma nova importação:
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Deseja realmente apagar todos os ${currentEfetivoCount} militares do banco de dados agora? O sistema ficará com 0 militares.`)) {
                    onClearAll(true);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs transition-all shrink-0 cursor-pointer shadow-xs"
              >
                <Trash2 size={13} />
                Limpar Banco Agora
              </button>
            </div>
          )}

          {/* Quick template download info */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-blue-50 rounded-xl border border-blue-200/70 text-xs">
            <div className="flex items-center gap-2 text-blue-950">
              <Users size={16} className="shrink-0 text-blue-700" />
              <span>
                Precisa de um modelo com as colunas certas? Baixe o arquivo de exemplo padrão do 4º BPM.
              </span>
            </div>
            <button
              onClick={downloadModeloExcelEfetivo}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-950 hover:bg-blue-900 text-white rounded-lg font-semibold text-xs transition-all shrink-0 cursor-pointer shadow-xs"
            >
              <FileDown size={14} />
              Baixar Modelo (.xlsx)
            </button>
          </div>

          {/* File Upload Box */}
          {!parseResult ? (
            <div>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsHovering(true); }}
                onDragLeave={() => setIsHovering(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all",
                  isHovering 
                    ? "border-blue-600 bg-blue-500/5 scale-[1.01]" 
                    : "border-line bg-slate-50/50 hover:bg-slate-50 hover:border-blue-950/30",
                  isParsing && "opacity-50 pointer-events-none"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={onFileInputChange}
                  className="hidden"
                />

                <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-line flex items-center justify-center text-emerald-950 mb-3">
                  {isParsing ? (
                    <RefreshCw size={26} className="animate-spin text-emerald-700" />
                  ) : (
                    <UploadCloud size={28} className="text-emerald-900" />
                  )}
                </div>

                <h4 className="text-sm font-bold text-ink">
                  {isParsing ? 'Processando planilha...' : 'Clique para selecionar ou arraste o arquivo aqui'}
                </h4>
                <p className="text-xs text-ink/50 mt-1 max-w-sm">
                  Suporta arquivos <strong>.XLSX</strong>, <strong>.XLS</strong> ou <strong>.CSV</strong> contendo informações como Posto/Graduação, Nome de Guerra, Nome Completo, Matrícula, Cia e Situação.
                </p>

                <div className="mt-4 px-3 py-1 bg-white border border-line rounded-lg text-[11px] font-mono text-ink/60">
                  Formatos aceitos: Excel Workbook (.xlsx, .xls), CSV
                </div>
              </div>

              {errorMessage && (
                <div className="mt-3 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-900">
                  <AlertTriangle size={17} className="text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Não foi possível carregar o arquivo:</span>
                    <p className="mt-0.5 opacity-90">{errorMessage}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Upload Preview & Confirmation */
            <div className="space-y-4">
              {/* Success Banner */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950">
                      Arquivo Lido com Sucesso: {parseResult.fileName}
                    </h4>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Identificados <strong>{parseResult.totalParsed} militares</strong> prontos para alimentar o sistema.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleResetFile}
                  className="text-xs font-semibold text-emerald-900 hover:text-emerald-950 underline cursor-pointer shrink-0"
                >
                  Trocar Arquivo
                </button>
              </div>

              {/* Import Mode Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-ink uppercase tracking-wider">
                  Modo de Importação para o Efetivo
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setImportMode('replace')}
                    className={cn(
                      "p-3.5 rounded-xl border-2 transition-all cursor-pointer",
                      importMode === 'replace'
                        ? "border-emerald-800 bg-emerald-50/50 shadow-xs"
                        : "border-line bg-white hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                        <RefreshCw size={14} className={importMode === 'replace' ? 'text-emerald-800' : 'text-slate-400'} />
                        Substituir Efetivo Atual
                      </span>
                      <div className={cn(
                        "w-4 h-4 rounded-full border flex items-center justify-center",
                        importMode === 'replace' ? "border-emerald-800 bg-emerald-800 text-white" : "border-slate-300"
                      )}>
                        {importMode === 'replace' && <Check size={10} />}
                      </div>
                    </div>
                    <p className="text-[11px] text-ink/60 mt-1.5 leading-relaxed">
                      Substitui os {currentEfetivoCount} militares atuais pelos {parseResult.totalParsed} da planilha. Ideal para novas publicações oficiais.
                    </p>
                  </div>

                  <div
                    onClick={() => setImportMode('merge')}
                    className={cn(
                      "p-3.5 rounded-xl border-2 transition-all cursor-pointer",
                      importMode === 'merge'
                        ? "border-emerald-800 bg-emerald-50/50 shadow-xs"
                        : "border-line bg-white hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                        <Layers size={14} className={importMode === 'merge' ? 'text-emerald-800' : 'text-slate-400'} />
                        Mesclar com Existente
                      </span>
                      <div className={cn(
                        "w-4 h-4 rounded-full border flex items-center justify-center",
                        importMode === 'merge' ? "border-emerald-800 bg-emerald-800 text-white" : "border-slate-300"
                      )}>
                        {importMode === 'merge' && <Check size={10} />}
                      </div>
                    </div>
                    <p className="text-[11px] text-ink/60 mt-1.5 leading-relaxed">
                      Adiciona novos registros e atualiza informações de militares que possuam a mesma matrícula no banco.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sample Preview Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                    <Eye size={13} className="text-ink/60" />
                    Prévia dos Militares ({Math.min(parseResult.militares.length, 5)} de {parseResult.militares.length})
                  </span>
                  <span className="text-[10px] font-mono text-ink/50">
                    Colunas detectadas: {parseResult.detectedColumns.length}
                  </span>
                </div>

                <div className="border border-line rounded-xl overflow-hidden text-xs max-h-48 overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-ink/70 text-[11px] uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="px-3 py-2 font-bold">Posto / Grad</th>
                        <th className="px-3 py-2 font-bold">Nome de Guerra</th>
                        <th className="px-3 py-2 font-bold">Situação</th>
                        <th className="px-3 py-2 font-bold">Escala</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60 bg-white">
                      {parseResult.militares.slice(0, 5).map((m, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-bold text-ink">{m.postoGraduacao}</td>
                          <td className="px-3 py-2 font-medium text-ink">{m.nomeGuerra}</td>
                          <td className="px-3 py-2">
                            <span className={cn(
                              "px-2 py-0.5 rounded-md text-[10px] font-bold font-mono",
                              m.situacao === 'Pronto' ? "bg-emerald-100 text-emerald-900" :
                              m.situacao === 'De Serviço' ? "bg-blue-100 text-blue-900" :
                              m.situacao === 'Folga' ? "bg-slate-200 text-slate-800" :
                              "bg-amber-100 text-amber-900"
                            )}>
                              {m.situacao}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-ink/70">{m.escalaTipo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-line flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-ink/70 hover:text-ink hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
          >
            Cancelar
          </button>

          {parseResult && (
            <button
              onClick={handleConfirm}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-950 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
            >
              <CheckCircle2 size={15} />
              Alimentar Dashboard ({parseResult.totalParsed} Militares)
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
