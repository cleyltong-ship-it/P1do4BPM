import React, { useState, useRef } from 'react';
import { 
  Upload, 
  X, 
  FileSpreadsheet, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Users, 
  Loader2, 
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import { PrevisaoFerias, EfetivoMilitar } from '../types';
import { parseExcelFerias, parsePdfFerias, ParseFeriasResult } from '../services/feriasFileParser';

interface ImportFeriasModalProps {
  isOpen: boolean;
  onClose: () => void;
  efetivo: EfetivoMilitar[];
  onImportComplete: (records: PrevisaoFerias[], mode: 'replace' | 'merge') => void;
}

export const ImportFeriasModal: React.FC<ImportFeriasModalProps> = ({
  isOpen,
  onClose,
  efetivo,
  onImportComplete
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [parseResult, setParseResult] = useState<ParseFeriasResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [targetYear, setTargetYear] = useState<number>(new Date().getFullYear());
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    setSelectedFile(file);
    setErrorMessage(null);
    setIsLoading(true);

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv');
    const isPdf = file.name.endsWith('.pdf');

    if (!isExcel && !isPdf) {
      setErrorMessage('Formato de arquivo não suportado. Por favor selecione uma planilha Excel (.xlsx, .xls) ou arquivo PDF (.pdf).');
      setIsLoading(false);
      return;
    }

    try {
      let result: ParseFeriasResult;
      if (isPdf) {
        result = await parsePdfFerias(file, targetYear, efetivo);
      } else {
        result = await parseExcelFerias(file, targetYear, efetivo);
      }

      if (result.records.length === 0) {
        setErrorMessage('Nenhum registro de férias foi identificado no arquivo. Verifique se há nomes, matrículas ou colunas/linhas com os meses de férias.');
        setParseResult(null);
      } else {
        setParseResult(result);
      }
    } catch (err: any) {
      console.error('Erro ao processar arquivo de férias:', err);
      setErrorMessage(`Falha no processamento: ${err?.message || 'Arquivo corrompido ou ilegível.'}`);
      setParseResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleConfirmImport = () => {
    if (!parseResult || parseResult.records.length === 0) return;
    onImportComplete(parseResult.records, importMode);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setSelectedFile(null);
    setParseResult(null);
    setErrorMessage(null);
    setIsLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-line flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-line flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950 text-white flex items-center justify-center shadow-xs">
              <Calendar size={20} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">
                Importar Relação de Férias (PDF ou Excel)
              </h2>
              <p className="text-xs text-ink/60">
                Carregue a escala ou boletim anual com a previsão de férias por mês dos militares
              </p>
            </div>
          </div>
          <button 
            onClick={() => { handleReset(); onClose(); }}
            className="w-8 h-8 rounded-lg hover:bg-slate-200 text-ink/50 hover:text-ink flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Year selector & guidance */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-950">Ano de Referência das Férias:</span>
              <select
                value={targetYear}
                onChange={(e) => setTargetYear(Number(e.target.value))}
                className="bg-white border border-emerald-300 text-emerald-950 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
            </div>
            <div className="text-[11px] text-emerald-900 flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-700 shrink-0" />
              <span>Padrão Excel: Col. F (Nome), Col. C (Graduação), Col. H (Mês), Col. I (Ano Gozo), Col. L (Ano Ref), Col. M (Qtd Dias)</span>
            </div>
          </div>

          {/* Upload Drop Zone */}
          {!parseResult && !isLoading && (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                dragActive 
                  ? 'border-emerald-600 bg-emerald-50/50 scale-[0.99]' 
                  : 'border-slate-300 hover:border-emerald-800 bg-slate-50/40 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-line mx-auto flex items-center justify-center text-emerald-900 mb-3">
                <Upload size={26} />
              </div>
              <h3 className="text-sm font-bold text-ink">
                Clique para selecionar ou arraste o arquivo aqui
              </h3>
              <p className="text-xs text-ink/50 mt-1">
                Suporta planilhas Excel (.xlsx, .xls) ou documentos PDF da escala de férias
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-md bg-white border border-line text-emerald-900 font-semibold">
                  <FileSpreadsheet size={13} className="text-emerald-700" /> Excel (.xlsx, .xls)
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-md bg-white border border-line text-red-800 font-semibold">
                  <FileText size={13} className="text-red-600" /> PDF (.pdf)
                </span>
              </div>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 size={36} className="text-emerald-800 animate-spin" />
              <div>
                <h4 className="text-sm font-bold text-ink">Processando arquivo...</h4>
                <p className="text-xs text-ink/50 mt-0.5">
                  Lendo relação mensal de militares e vinculando ao efetivo do Batalhão
                </p>
              </div>
            </div>
          )}

          {/* Error display */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3 text-xs">
              <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong className="font-bold block">Atenção ao importar:</strong>
                <p className="mt-0.5">{errorMessage}</p>
                <button
                  onClick={handleReset}
                  className="mt-2 font-bold text-red-900 underline hover:no-underline cursor-pointer"
                >
                  Tentar outro arquivo
                </button>
              </div>
            </div>
          )}

          {/* Success Preview */}
          {parseResult && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                    {parseResult.sourceType === 'excel' ? <FileSpreadsheet size={20} /> : <FileText size={20} />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950 font-mono">{parseResult.filename}</h4>
                    <p className="text-[11px] text-emerald-800">
                      {parseResult.totalParsed} militares identificados • {parseResult.monthsFound.length} meses mapeados
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs text-emerald-900 font-bold hover:underline cursor-pointer"
                >
                  Trocar arquivo
                </button>
              </div>

              {/* Stats badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-50 rounded-xl border border-line text-center">
                  <span className="text-[10px] uppercase font-mono font-bold text-ink/50">Total Previsto</span>
                  <div className="text-xl font-mono font-black text-ink mt-0.5">{parseResult.totalParsed}</div>
                  <span className="text-[10px] text-ink/40">militares no arquivo</span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                  <span className="text-[10px] uppercase font-mono font-bold text-emerald-800/80">Impacto Operacional</span>
                  <div className="text-xl font-mono font-black text-emerald-900 mt-0.5">{parseResult.operacionaisCount}</div>
                  <span className="text-[10px] text-emerald-700">viaturas / rua</span>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center">
                  <span className="text-[10px] uppercase font-mono font-bold text-amber-800/80">Descontados</span>
                  <div className="text-xl font-mono font-black text-amber-900 mt-0.5">{parseResult.descontadosCount}</div>
                  <span className="text-[10px] text-amber-700">Admin/P2/Oficiais/AD</span>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-center">
                  <span className="text-[10px] uppercase font-mono font-bold text-blue-800/80">Meses Mapeados</span>
                  <div className="text-xl font-mono font-black text-blue-900 mt-0.5">{parseResult.monthsFound.length}</div>
                  <span className="text-[10px] text-blue-700">ao longo do ano</span>
                </div>
              </div>

              {/* Informative notice on operational discount */}
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/60 text-xs text-blue-950 flex items-start gap-2">
                <CheckCircle2 size={16} className="text-blue-700 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Sem cruzamento forçado com o cadastro:</strong> Os dados de férias são lidos diretamente do arquivo. Na tabela você poderá ajustar qualquer militar como <strong>Administrativo, P2, Oficiais ou À Disposição</strong> com apenas 1 clique para descontá-lo do impacto operacional.
                </p>
              </div>

              {/* Months tags */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-ink/70">Meses encontrados na relação:</span>
                <div className="flex flex-wrap gap-1.5">
                  {parseResult.monthsFound.map(m => (
                    <span key={m} className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-200">
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              {/* Sample preview table */}
              <div className="border border-line rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-3 py-2 text-[11px] font-bold text-ink/70 uppercase tracking-wider flex justify-between">
                  <span>Prévia dos Primeiros Registros Identificados</span>
                  <span className="font-mono">{parseResult.records.length} itens</span>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-line text-xs">
                  {parseResult.records.slice(0, 6).map((rec, i) => (
                    <div key={i} className="px-3 py-2 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center gap-2 truncate max-w-[60%]">
                        <span className="font-mono font-bold text-emerald-900 w-14 shrink-0">{rec.posto}</span>
                        <span className="font-semibold text-ink truncate">{rec.nome}</span>
                        <span className="text-[10px] font-mono text-ink/40 shrink-0">({rec.matricula})</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          {rec.mesPrevisto}/{rec.ano}
                        </span>
                        <span className="text-[10px] text-ink/60 font-mono px-1.5 py-0.5 bg-slate-100 rounded">
                          {rec.periodoDias}d
                        </span>
                        {rec.anoReferencia && (
                          <span className="text-[10px] text-amber-900 font-mono px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded">
                            Ref: {rec.anoReferencia}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Import mode selection */}
              <div className="p-4 rounded-xl bg-slate-50 border border-line space-y-2">
                <span className="text-xs font-bold text-ink block">Modo de Importação:</span>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`p-3 rounded-xl border cursor-pointer flex items-start gap-2.5 transition-all ${
                    importMode === 'replace' ? 'bg-white border-emerald-800 shadow-2xs' : 'border-line/70 hover:bg-white'
                  }`}>
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="mt-0.5 text-emerald-900 focus:ring-emerald-700"
                    />
                    <div>
                      <strong className="text-xs font-bold text-ink block">Substituir Relação</strong>
                      <span className="text-[11px] text-ink/50 leading-tight block mt-0.5">
                        Sobrescreve a escala de férias anterior com este novo arquivo
                      </span>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border cursor-pointer flex items-start gap-2.5 transition-all ${
                    importMode === 'merge' ? 'bg-white border-emerald-800 shadow-2xs' : 'border-line/70 hover:bg-white'
                  }`}>
                    <input
                      type="radio"
                      name="importMode"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="mt-0.5 text-emerald-900 focus:ring-emerald-700"
                    />
                    <div>
                      <strong className="text-xs font-bold text-ink block">Mesclar / Atualizar</strong>
                      <span className="text-[11px] text-ink/50 leading-tight block mt-0.5">
                        Adiciona os militares mantendo os registros já cadastrados
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-line bg-slate-50 flex items-center justify-between">
          <button
            onClick={() => { handleReset(); onClose(); }}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-ink/60 hover:text-ink hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          
          <button
            disabled={!parseResult || parseResult.records.length === 0}
            onClick={handleConfirmImport}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              parseResult && parseResult.records.length > 0
                ? 'bg-emerald-950 hover:bg-emerald-900 text-white shadow-sm'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <span>Confirmar e Salvar Férias ({parseResult?.records.length || 0})</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
