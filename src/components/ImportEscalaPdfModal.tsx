import React, { useState, useRef } from 'react';
import { 
  FileText, 
  Upload, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Sparkles, 
  Shield, 
  Clock, 
  Users, 
  ClipboardCheck,
  Search,
  FileDown
} from 'lucide-react';
import { EfetivoMilitar, EscalaPdfResult } from '../types';
import { extractTextFromPdf, parseEscalaText, applyEscalaToEfetivo, generateSampleEscalaPdf } from '../services/pdfEscalaParser';

interface ImportEscalaPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  efetivo: EfetivoMilitar[];
  onApplyEscala: (updatedEfetivo: EfetivoMilitar[], summary: string) => void;
}

const POSTOS_ESCALA_BATALHAO = [
  'Comandante',
  'Subcomandante',
  'Supervisor',
  'Aux. do Of. de Operações',
  'Auxiliar do Supervisor',
  'Guarnição do Oficial de Operações',
  'Solo',
  'Força Tática',
  'Base Comunitária',
  'Administrativo',
  'P2',
  'Guarda do Quartel',
  'Armeiro',
  'Reserva de Armamento',
  'Vistoriador'
];

const SITUACOES_FORA_ESCALA = [
  'À Disposição',
  'LTS',
  'Férias'
];

const COMMON_POSTS = [
  ...SITUACOES_FORA_ESCALA,
  ...POSTOS_ESCALA_BATALHAO
];

export const ImportEscalaPdfModal: React.FC<ImportEscalaPdfModalProps> = ({
  isOpen,
  onClose,
  efetivo,
  onApplyEscala,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawPastedText, setRawPastedText] = useState('');
  const [parsedResult, setParsedResult] = useState<EscalaPdfResult | null>(null);

  const [unscaledDefault, setUnscaledDefault] = useState<'À Disposição' | 'LTS' | 'Férias'>('À Disposição');
  const [manualAssignments, setManualAssignments] = useState<{ [militarId: string]: string }>({});
  const [previewFilter, setPreviewFilter] = useState<'TODOS' | 'ESCALADOS' | 'NAO_ESCALADOS'>('TODOS');
  const [searchFilter, setSearchFilter] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setFileName(null);
    setRawPastedText('');
    setParsedResult(null);
    setManualAssignments({});
    setErrorMsg(null);
  };

  const processPdfFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('Por favor, selecione um arquivo em formato PDF (.pdf).');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setFileName(file.name);

    try {
      const extractedText = await extractTextFromPdf(file);
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('Não foi possível extrair texto legível do arquivo PDF.');
      }

      const result = parseEscalaText(extractedText, efetivo);
      setParsedResult(result);

      // Pre-initialize assignments map
      const initialAssignments: { [id: string]: string } = {};
      result.itensEscalados.forEach(item => {
        if (item.matchedMilitarId) {
          initialAssignments[item.matchedMilitarId] = item.localEscala;
        }
      });
      result.itensAfastados.forEach(item => {
        if (item.militarId) {
          initialAssignments[item.militarId] = item.status;
        }
      });
      setManualAssignments(initialAssignments);
    } catch (err: any) {
      console.error('Error parsing PDF:', err);
      setErrorMsg(err.message || 'Falha ao processar o arquivo PDF. Verifique se o arquivo não está corrompido ou protegido.');
      setParsedResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const processPastedText = () => {
    if (!rawPastedText.trim()) {
      setErrorMsg('Por favor, cole o texto da escala de serviço antes de processar.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setFileName('Texto colado');

    try {
      const result = parseEscalaText(rawPastedText, efetivo);
      setParsedResult(result);

      const initialAssignments: { [id: string]: string } = {};
      result.itensEscalados.forEach(item => {
        if (item.matchedMilitarId) {
          initialAssignments[item.matchedMilitarId] = item.localEscala;
        }
      });
      result.itensAfastados.forEach(item => {
        if (item.militarId) {
          initialAssignments[item.militarId] = item.status;
        }
      });
      setManualAssignments(initialAssignments);
    } catch (err: any) {
      console.error('Error parsing text:', err);
      setErrorMsg('Erro ao processar o texto da escala.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processPdfFile(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processPdfFile(files[0]);
    }
  };

  const handleConfirmImport = () => {
    if (!parsedResult) return;

    const updated = applyEscalaToEfetivo(
      efetivo,
      parsedResult,
      unscaledDefault,
      manualAssignments
    );

    const escaladosCount = updated.filter(m => 
      !['À Disposição', 'LTS', 'Férias', 'Folga'].includes(m.situacao)
    ).length;

    const aDisposicaoCount = updated.filter(m => m.situacao === 'À Disposição').length;
    const afastadosCount = updated.filter(m => m.situacao === 'LTS' || m.situacao === 'Férias').length;

    const summary = `Escala aplicada: ${escaladosCount} militares escalados em seus postos, ${aDisposicaoCount} à disposição e ${afastadosCount} afastados.`;
    
    onApplyEscala(updated, summary);
    onClose();
  };

  // Preview soldiers list
  const previewRows = efetivo.map(m => {
    const currentAssignment = manualAssignments[m.id] || (
      m.situacao === 'LTS' || m.situacao === 'Férias' ? m.situacao : unscaledDefault
    );
    const isScaled = !['À Disposição', 'LTS', 'Férias'].includes(currentAssignment);

    return {
      militar: m,
      currentAssignment,
      isScaled
    };
  }).filter(row => {
    if (previewFilter === 'ESCALADOS' && !row.isScaled) return false;
    if (previewFilter === 'NAO_ESCALADOS' && row.isScaled) return false;
    if (searchFilter) {
      const term = searchFilter.toLowerCase();
      return (
        row.militar.nomeGuerra.toLowerCase().includes(term) ||
        row.militar.nomeCompleto.toLowerCase().includes(term) ||
        row.militar.postoGraduacao.toLowerCase().includes(term) ||
        row.militar.matricula.includes(term) ||
        row.currentAssignment.toLowerCase().includes(term)
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-7 shadow-2xl border border-line space-y-6 my-6 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-line pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-950 text-white flex items-center justify-center shadow-md shrink-0">
              <FileText size={24} className="text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-ink">
                  Importar Escala de Serviço (PDF)
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold">
                  4º BPM
                </span>
              </div>
              <p className="text-xs text-ink/60 mt-0.5">
                Alimente o local na escala dos militares (postos e serviços). Os não escalados serão definidos como À Disposição, LTS ou Férias.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-xl cursor-pointer text-ink/40 hover:text-ink transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mode Selector & Quick Actions */}
        {!parsedResult && (
          <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-line/80 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  activeTab === 'upload' ? 'bg-white text-ink shadow-2xs' : 'text-ink/60 hover:text-ink'
                }`}
              >
                Arquivo PDF
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('paste')}
                className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  activeTab === 'paste' ? 'bg-white text-ink shadow-2xs' : 'text-ink/60 hover:text-ink'
                }`}
              >
                Colar Texto da Escala
              </button>
            </div>

            <button
              type="button"
              onClick={generateSampleEscalaPdf}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              <FileDown size={15} />
              Baixar Exemplo de Escala (PDF)
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-3">
              <AlertCircle size={18} className="shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Phase 1: Input (Upload or Paste) */}
          {!parsedResult && (
            <>
              {activeTab === 'upload' ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-4 ${
                    isDragging 
                      ? 'border-emerald-600 bg-emerald-500/5 scale-[0.99]' 
                      : 'border-slate-300 hover:border-emerald-950 bg-slate-50/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />

                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-900 flex items-center justify-center shadow-xs">
                    <Upload size={28} />
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-ink">
                      Arraste ou clique para selecionar a Escala em PDF
                    </h4>
                    <p className="text-xs text-ink/60 max-w-md mx-auto">
                      Reconhecimento inteligente por escalas: Escala 01 (Solo), Escala 02 (Força Tática), Escala 03 (Aux. Supervisor, Guarda, Armeiro, Guarnição do Oficial de Operações, Vistoriador), Escala 04 (Administrativo) e Escala 05 (Base Comunitária).
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-line rounded-lg text-[11px] font-mono text-ink/60">
                    <FileText size={13} className="text-emerald-700" />
                    Formato suportado: Documento PDF (.pdf)
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-ink/70">
                      Cole aqui o texto copiado da escala de serviço (Boletim, PDF ou mensagem):
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setRawPastedText(
                          `ESCALA DE SERVIÇO DIÁRIO - 4º BPM\nDATA: ${new Date().toLocaleDateString('pt-BR')}\n\nESCALA 01 - SOLO:\nSd Lima (Mat. 13220-4)\nCb Henrique (Mat. 12301-4)\nSd Rocha (Mat. 13005-2)\n\nESCALA 02 - FORÇA TÁTICA:\nCap Medeiros (Mat. 10892-0)\n1º Sgt Wanderley (Mat. 10982-1)\nCb Peixoto (Mat. 12550-9)\n\nESCALA 03:\nGUARNIÇÃO DO OFICIAL DE OPERAÇÕES: Cap Brandão (Mat. 10789-4)\nAUX.DOOF.DEOPERAÇÕES: 1º Ten Vieira (Mat. 11204-6)\nSEGURANÇA INTERNADO QUARTEL: 1º Sgt Silva (Mat. 10456-2)\nARMEIRO: Sd Souza (Mat. 13110-8)\nVISTORIADOR: Cb Martins (Mat. 12440-1)\n\nESCALA 04:\nSubten Dias (Mat. 11580-2) - Seção P/1 Recursos Humanos\nCb Fagundes (Mat. 12880-3) - P/2 Agência de Inteligência Policial\n\nESCALA 05:\nCb Pereira (Mat. 12550-9) - Base Comunitária\n3º Sgt Ferreira (Mat. 11874-9) - Base Comunitária\n\nAFASTADOS:\nLTS: Sd Carvalho (Mat. 13315-7)\nFérias: Maj Silveira (Mat. 10521-8)`
                        );
                      }}
                      className="text-xs text-emerald-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles size={12} />
                      Preencher com Exemplo
                    </button>
                  </div>

                  <textarea
                    rows={8}
                    value={rawPastedText}
                    onChange={(e) => setRawPastedText(e.target.value)}
                    placeholder="Cole aqui o texto da escala de serviço..."
                    className="w-full p-3 font-mono text-xs bg-slate-50 border border-line rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-950/20"
                  />

                  <button
                    type="button"
                    onClick={processPastedText}
                    disabled={isLoading || !rawPastedText.trim()}
                    className="w-full py-2.5 bg-emerald-950 hover:bg-emerald-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    {isLoading ? 'Processando escala...' : 'Processar Texto da Escala'}
                  </button>
                </div>
              )}

              {/* Informative Guidance Card */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-line text-xs space-y-2">
                <h5 className="font-bold text-ink flex items-center gap-1.5">
                  <Shield size={14} className="text-emerald-700" />
                  Como funciona a substituição das opções em Verde:
                </h5>
                <ul className="text-ink/70 space-y-1 pl-4 list-disc text-[11px]">
                  <li>
                    <strong>Militares escalados no PDF</strong>: O campo em verde passa a exibir diretamente o posto na escala (ex: <em>RP 01 - Motorista</em>, <em>Guarda do Quartel</em>, <em>Oficial de Dia</em>, <em>Força Tática</em>).
                  </li>
                  <li>
                    <strong>Militares não escalados</strong>: Poderão assumir a situação <strong>À Disposição</strong>, <strong>LTS</strong> ou <strong>Férias</strong>, conforme definido na prévia abaixo.
                  </li>
                </ul>
              </div>
            </>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="p-12 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-emerald-950 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs font-mono font-bold text-ink">
                Lendo e cruzando escala com o efetivo do 4º BPM...
              </p>
            </div>
          )}

          {/* Phase 2: Parsed Preview & Verification */}
          {parsedResult && (
            <div className="space-y-5">
              {/* File Info Bar */}
              <div className="p-4 rounded-2xl bg-emerald-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-300">
                    Escala Identificada
                  </span>
                  <h4 className="text-sm font-bold mt-0.5">
                    {parsedResult.titulo} • {parsedResult.dataEscala || 'Data Atual'}
                  </h4>
                  <p className="text-xs text-emerald-200/70 mt-0.5 font-mono">
                    Arquivo: {fileName}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-semibold border border-emerald-700 transition-colors cursor-pointer"
                >
                  Trocar Arquivo
                </button>
              </div>

              {/* Summary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200">
                  <span className="text-[10px] font-mono font-bold uppercase text-blue-800">
                    Militares Escalados
                  </span>
                  <div className="text-2xl font-black font-mono text-blue-950 mt-1">
                    {parsedResult.itensEscalados.length}
                  </div>
                  <p className="text-[11px] text-blue-800/70 mt-0.5">Receberão seus postos de serviço</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
                  <span className="text-[10px] font-mono font-bold uppercase text-amber-800">
                    Afastados (LTS / Férias)
                  </span>
                  <div className="text-2xl font-black font-mono text-amber-950 mt-1">
                    {parsedResult.itensAfastados.length}
                  </div>
                  <p className="text-[11px] text-amber-800/70 mt-0.5">Identificados no documento</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] font-mono font-bold uppercase text-emerald-800">
                    Não Escalados (Restante)
                  </span>
                  <div className="text-2xl font-black font-mono text-emerald-950 mt-1">
                    {efetivo.length - parsedResult.itensEscalados.length - parsedResult.itensAfastados.length}
                  </div>
                  <p className="text-[11px] text-emerald-800/70 mt-0.5">Ficarão à disposição do Btl</p>
                </div>
              </div>

              {/* Config: Default Status for Non-Scaled */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <label className="text-xs font-bold text-ink block">
                    Situação padrão para militares que NÃO constam na escala:
                  </label>
                  <p className="text-[11px] text-ink/60">
                    Escolha a atribuição para quem não foi escalado neste dia
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={unscaledDefault}
                    onChange={(e) => setUnscaledDefault(e.target.value as any)}
                    className="text-xs font-bold font-mono px-3 py-2 bg-white border border-line rounded-xl cursor-pointer"
                  >
                    <option value="À Disposição">À Disposição (Disponível para Serviço / Extra)</option>
                    <option value="LTS">LTS (Licença Saúde)</option>
                    <option value="Férias">Férias</option>
                  </select>
                </div>
              </div>

              {/* Filter & Search preview list */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('TODOS')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      previewFilter === 'TODOS' ? 'bg-white text-ink shadow-2xs' : 'text-ink/60'
                    }`}
                  >
                    Todos ({efetivo.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('ESCALADOS')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      previewFilter === 'ESCALADOS' ? 'bg-white text-ink shadow-2xs' : 'text-ink/60'
                    }`}
                  >
                    Escalados ({parsedResult.itensEscalados.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('NAO_ESCALADOS')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      previewFilter === 'NAO_ESCALADOS' ? 'bg-white text-ink shadow-2xs' : 'text-ink/60'
                    }`}
                  >
                    Não Escalados ({efetivo.length - parsedResult.itensEscalados.length})
                  </button>
                </div>

                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
                  <input
                    type="text"
                    placeholder="Buscar militar..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-line rounded-xl w-48"
                  />
                </div>
              </div>

              {/* Editable Preview Table */}
              <div className="border border-line rounded-2xl overflow-hidden">
                <div className="max-h-60 overflow-y-auto divide-y divide-line/60 text-xs">
                  {previewRows.map(({ militar, currentAssignment, isScaled }) => (
                    <div 
                      key={militar.id}
                      className="p-3 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-slate-100 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                          {militar.postoGraduacao}
                        </span>
                        <div>
                          <p className="font-bold text-ink uppercase">
                            {militar.postoGraduacao} {militar.nomeGuerra}
                          </p>
                          <p className="text-[10px] text-ink/50 font-mono">
                            Mat. {militar.matricula}
                          </p>
                        </div>
                      </div>

                      {/* Right: Editable Assignment */}
                      <div className="flex items-center gap-2">
                        <select
                          value={currentAssignment}
                          onChange={(e) => {
                            setManualAssignments(prev => ({
                              ...prev,
                              [militar.id]: e.target.value
                            }));
                          }}
                          className={`text-xs font-bold font-mono px-3 py-1.5 rounded-lg border cursor-pointer ${
                            isScaled
                              ? 'bg-blue-50 text-blue-900 border-blue-300'
                              : currentAssignment === 'À Disposição'
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                              : 'bg-amber-50 text-amber-900 border-amber-300'
                          }`}
                        >
                          <optgroup label="Situação Fora da Escala">
                            <option value="À Disposição">À Disposição</option>
                            <option value="LTS">LTS (Licença Saúde)</option>
                            <option value="Férias">Férias</option>
                          </optgroup>
                          <optgroup label="Postos na escala do Batalhão">
                            {/* If custom post detected in PDF, include it */}
                            {isScaled && !POSTOS_ESCALA_BATALHAO.includes(currentAssignment) && !SITUACOES_FORA_ESCALA.includes(currentAssignment) && (
                              <option value={currentAssignment}>{currentAssignment}</option>
                            )}
                            {POSTOS_ESCALA_BATALHAO.map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                    </div>
                  ))}

                  {previewRows.length === 0 && (
                    <div className="p-8 text-center text-ink/40 text-xs italic">
                      Nenhum militar encontrado com o filtro atual.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-line pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-ink rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          {parsedResult && (
            <button
              type="button"
              onClick={handleConfirmImport}
              className="w-full sm:w-auto px-6 py-2.5 bg-emerald-950 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <ClipboardCheck size={16} />
              Confirmar e Aplicar Escala ao Efetivo
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
