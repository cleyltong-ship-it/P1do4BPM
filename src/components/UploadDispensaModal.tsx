import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Clock, 
  Stethoscope, 
  User, 
  Shield, 
  Loader2, 
  Eye, 
  ChevronDown, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DispensaMedicaLTS, EfetivoMilitar, PostoGraduacao, TipoAfastamentoSaude } from '../types';
import { 
  extractTextFromPdf, 
  runOcrOnImageElement, 
  parseDispensaDocumentText, 
  addDaysToDate 
} from '../services/dispensaFileParser';

interface UploadDispensaModalProps {
  isOpen: boolean;
  onClose: () => void;
  efetivo: EfetivoMilitar[];
  onSave: (dispensa: Omit<DispensaMedicaLTS, 'id' | 'criadoEm'>) => void;
  onOpenManualModal?: () => void;
}

export const UploadDispensaModal: React.FC<UploadDispensaModalProps> = ({
  isOpen,
  onClose,
  efetivo,
  onSave,
  onOpenManualModal
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStep, setProgressStep] = useState<string>('');
  const [extractedData, setExtractedData] = useState<Partial<DispensaMedicaLTS> | null>(null);
  const [rawExtractedText, setRawExtractedText] = useState<string>('');
  const [showRawText, setShowRawText] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states for manual tweaking of parsed data
  const [matricula, setMatricula] = useState('');
  const [nome, setNome] = useState('');
  const [nomeGuerra, setNomeGuerra] = useState('');
  const [postoGraduacao, setPostoGraduacao] = useState<PostoGraduacao>('Sd');
  const [tipo, setTipo] = useState<TipoAfastamentoSaude>('Dispensa Médica');
  const [diasAfastamento, setDiasAfastamento] = useState<number>(15);
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFimPrevista, setDataFimPrevista] = useState<string>('');
  const [cid, setCid] = useState<string>('');
  const [descricaoCid, setDescricaoCid] = useState<string>('');
  const [medicoOuJunta, setMedicoOuJunta] = useState<string>('');
  const [observacoes, setObservacoes] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setFile(null);
    setFilePreview(null);
    setIsProcessing(false);
    setProgressStep('');
    setExtractedData(null);
    setRawExtractedText('');
    setShowRawText(false);
    setErrorMessage(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileSelect = async (selectedFile: File) => {
    setErrorMessage(null);
    setFile(selectedFile);

    // Previews for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(selectedFile);
    } else {
      setFilePreview(null);
    }

    setIsProcessing(true);
    setProgressStep('Iniciando análise do documento...');

    try {
      let extractedText = '';

      if (selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf')) {
        extractedText = await extractTextFromPdf(selectedFile, (msg) => setProgressStep(msg));
      } else if (
        selectedFile.type.startsWith('image/') || 
        /\.(jpe?g|png|webp|bmp)$/i.test(selectedFile.name)
      ) {
        extractedText = await runOcrOnImageElement(selectedFile, (msg) => setProgressStep(msg));
      } else {
        throw new Error('Formato não suportado. Por favor, envie um arquivo PDF, JPG ou PNG.');
      }

      setRawExtractedText(extractedText);
      setProgressStep('Interpretando militar, período de afastamento e CID...');

      const parsed = parseDispensaDocumentText(extractedText, efetivo);

      setExtractedData({
        ...parsed,
        documentoOrigem: selectedFile.name,
        situacao: 'Em Andamento'
      });

      // Populate form fields
      setMatricula(parsed.matricula);
      setNome(parsed.nome);
      setNomeGuerra(parsed.nomeGuerra || (parsed.nome.split(' ')[0]));
      setPostoGraduacao(parsed.postoGraduacao);
      setTipo(parsed.tipo);
      setDiasAfastamento(parsed.diasAfastamento);
      setDataInicio(parsed.dataInicio);
      setDataFimPrevista(parsed.dataFimPrevista);
      setCid(parsed.cid || '');
      setDescricaoCid(parsed.descricaoCid || '');
      setMedicoOuJunta(parsed.medicoOuJunta || '');
      setObservacoes(parsed.observacoes || '');

    } catch (err: any) {
      console.error('Erro no processamento do documento:', err);
      setErrorMessage(err.message || 'Falha ao processar arquivo. Verifique se o documento está legível ou cadastre manualmente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDiasChange = (newDays: number) => {
    setDiasAfastamento(newDays);
    if (dataInicio && newDays > 0) {
      setDataFimPrevista(addDaysToDate(dataInicio, newDays));
    }
  };

  const handleInicioChange = (newInicio: string) => {
    setDataInicio(newInicio);
    if (newInicio && diasAfastamento > 0) {
      setDataFimPrevista(addDaysToDate(newInicio, diasAfastamento));
    }
  };

  const handleMilitarSelect = (mat: string) => {
    const found = efetivo.find(m => m.matricula === mat);
    if (found) {
      setMatricula(found.matricula);
      setNome(found.nomeCompleto);
      setNomeGuerra(found.nomeGuerra);
      setPostoGraduacao(found.postoGraduacao);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim()) {
      setErrorMessage('Por favor, informe o nome do militar.');
      return;
    }

    if (!dataInicio) {
      setErrorMessage('Por favor, informe a data de início do afastamento.');
      return;
    }

    onSave({
      matricula: matricula || `PM-${Math.floor(10000 + Math.random() * 90000)}`,
      nome: nome.trim(),
      nomeGuerra: nomeGuerra.trim() || nome.trim().split(' ')[0],
      postoGraduacao,
      tipo,
      diasAfastamento: Number(diasAfastamento) || 1,
      dataInicio,
      dataFimPrevista: dataFimPrevista || addDaysToDate(dataInicio, diasAfastamento),
      cid: cid.trim() || undefined,
      descricaoCid: descricaoCid.trim() || undefined,
      medicoOuJunta: medicoOuJunta.trim() || undefined,
      situacao: 'Em Andamento',
      observacoes: observacoes.trim() || undefined,
      documentoOrigem: file?.name || 'Atestado_Digitalizado'
    });

    handleClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl shadow-2xl border border-line w-full max-w-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 text-blue-300 flex items-center justify-center">
              <Stethoscope size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                Leitura de Dispensa Médica / LTS
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 font-bold border border-blue-400/30">
                  PDF ou JPG
                </span>
              </h2>
              <p className="text-xs text-blue-100/70">
                Extração inteligente com reconhecimento de texto (OCR), CID e período de término
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* File Upload Dropzone */}
          {!file && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileSelect(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-blue-300 hover:border-blue-600 bg-blue-50/50 hover:bg-blue-50 rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
              <div className="w-16 h-16 rounded-2xl bg-blue-100 group-hover:bg-blue-200 text-blue-800 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                <Upload size={30} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">
                  Arraste o Atestado ou Dispensa Médica aqui
                </h3>
                <p className="text-xs text-ink/60 mt-1">
                  Formatos aceitos: <strong>PDF</strong>, <strong>JPG</strong>, <strong>PNG</strong> ou fotos do atestado
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-full bg-red-100 text-red-900 font-bold">
                  <FileText size={12} /> PDF
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-full bg-blue-100 text-blue-900 font-bold">
                  <ImageIcon size={12} /> Imagens (JPG / PNG)
                </span>
              </div>
            </div>
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="p-8 bg-blue-50/80 rounded-2xl border border-blue-200 text-center space-y-4">
              <Loader2 size={36} className="text-blue-700 animate-spin mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-blue-950">
                  Lendo documento médico...
                </h4>
                <p className="text-xs text-blue-800 font-mono mt-1">
                  {progressStep || 'Processando arquivo com inteligência de OCR...'}
                </p>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 bg-red-50 text-red-900 rounded-2xl border border-red-200 flex items-center gap-3 text-xs">
              <AlertCircle size={18} className="text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Extracted Form Confirmation */}
          {extractedData && !isProcessing && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs text-emerald-950">
                  <CheckCircle2 size={18} className="text-emerald-700 shrink-0" />
                  <div>
                    <span className="font-bold">Dados extraídos com sucesso!</span>
                    <p className="text-[11px] text-emerald-800">
                      Arquivo: <span className="font-mono font-semibold">{file?.name}</span>. Revise ou ajuste os campos abaixo antes de confirmar.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setExtractedData(null);
                  }}
                  className="text-xs text-emerald-800 hover:text-emerald-950 font-bold underline cursor-pointer"
                >
                  Trocar arquivo
                </button>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tipo de Afastamento */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Tipo de Afastamento *
                  </label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as TipoAfastamentoSaude)}
                    className="w-full px-3 py-2 bg-slate-50 border border-line rounded-xl text-xs font-bold text-ink focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  >
                    <option value="Dispensa Médica">Dispensa Médica</option>
                    <option value="LTS">LTS (Licença Tratamento Saúde)</option>
                    <option value="Licença Médica">Licença Médica</option>
                    <option value="Outro">Outro Afastamento</option>
                  </select>
                </div>

                {/* Seleção rápida do militar no efetivo */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Militar Cadastrado (Efetivo 4º BPM)
                  </label>
                  <select
                    onChange={(e) => handleMilitarSelect(e.target.value)}
                    value={matricula}
                    className="w-full px-3 py-2 bg-slate-50 border border-line rounded-xl text-xs font-medium text-ink focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  >
                    <option value="">-- Selecionar do Efetivo Existente --</option>
                    {efetivo.map(m => (
                      <option key={m.id} value={m.matricula}>
                        {m.postoGraduacao} {m.nomeGuerra} ({m.nomeCompleto}) - Mat: {m.matricula}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Posto e Graduação */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Posto / Graduação *
                  </label>
                  <select
                    value={postoGraduacao}
                    onChange={(e) => setPostoGraduacao(e.target.value as PostoGraduacao)}
                    className="w-full px-3 py-2 bg-slate-50 border border-line rounded-xl text-xs font-medium text-ink focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  >
                    {['Cel', 'Ten-Cel', 'Maj', 'Cap', '1º Ten', '2º Ten', 'Subten', '1º Sgt', '2º Sgt', '3º Sgt', 'Cb', 'Sd'].map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* Matrícula */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Matrícula do Militar *
                  </label>
                  <input
                    type="text"
                    value={matricula}
                    onChange={(e) => setMatricula(e.target.value)}
                    placeholder="Ex: 123456-7"
                    className="w-full px-3 py-2 bg-slate-50 border border-line rounded-xl text-xs font-mono font-medium text-ink focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                {/* Nome Completo */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-ink mb-1">
                    Nome Completo do Militar *
                  </label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome completo conforme laudo/atestado"
                    className="w-full px-3 py-2 bg-slate-50 border border-line rounded-xl text-xs font-medium text-ink focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                {/* Nome de Guerra */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Nome de Guerra
                  </label>
                  <input
                    type="text"
                    value={nomeGuerra}
                    onChange={(e) => setNomeGuerra(e.target.value)}
                    placeholder="Ex: SILVA"
                    className="w-full px-3 py-2 bg-slate-50 border border-line rounded-xl text-xs font-bold uppercase text-ink focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                {/* Dias de Afastamento */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1 flex items-center justify-between">
                    <span>Tempo de Afastamento (Dias) *</span>
                    <span className="font-mono text-blue-800 text-[11px] font-bold">{diasAfastamento} dias</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={diasAfastamento}
                      onChange={(e) => handleDiasChange(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3 py-2 bg-slate-50 border border-line rounded-xl text-xs font-mono font-bold text-blue-950 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    />
                    <div className="flex gap-1">
                      {[5, 8, 15, 30].map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => handleDiasChange(d)}
                          className="px-2 py-1 text-[10px] font-mono font-bold rounded-lg border border-line bg-white hover:bg-slate-100 cursor-pointer"
                        >
                          +{d}d
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Data Início */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Data de Início *
                  </label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => handleInicioChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-line rounded-xl text-xs font-mono font-medium text-ink focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                {/* Data Prevista de Término */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1 flex items-center justify-between">
                    <span>Data Prevista de Término *</span>
                    <span className="text-[10px] text-blue-800 font-mono font-bold">Auto calculada</span>
                  </label>
                  <input
                    type="date"
                    value={dataFimPrevista}
                    onChange={(e) => setDataFimPrevista(e.target.value)}
                    className="w-full px-3 py-2 bg-blue-50 border border-blue-300 rounded-xl text-xs font-mono font-bold text-blue-950 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                {/* CID */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Código CID (se houver)
                  </label>
                  <input
                    type="text"
                    value={cid}
                    onChange={(e) => setCid(e.target.value.toUpperCase())}
                    placeholder="Ex: M54.5, S83, J06"
                    className="w-full px-3 py-2 bg-slate-50 border border-line rounded-xl text-xs font-mono font-bold text-purple-950 focus:ring-2 focus:ring-purple-600 focus:outline-hidden uppercase"
                  />
                </div>

                {/* Descrição do CID */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Descrição / Patologia CID
                  </label>
                  <input
                    type="text"
                    value={descricaoCid}
                    onChange={(e) => setDescricaoCid(e.target.value)}
                    placeholder="Ex: Lombalgia, Entorse de joelho"
                    className="w-full px-3 py-2 bg-slate-50 border border-line rounded-xl text-xs font-medium text-ink focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                {/* Médico / Junta Militar */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-ink mb-1">
                    Médico Assistente / Junta Militar de Saúde (JMS)
                  </label>
                  <input
                    type="text"
                    value={medicoOuJunta}
                    onChange={(e) => setMedicoOuJunta(e.target.value)}
                    placeholder="Ex: Dr. Fulano de Tal - CRM 1234/AL ou JMS PMAL"
                    className="w-full px-3 py-2 bg-slate-50 border border-line rounded-xl text-xs font-medium text-ink focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                {/* Observações */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-ink mb-1">
                    Observações Administrativas / Recomendações
                  </label>
                  <textarea
                    rows={2}
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Ex: Restrição de esforço físico, homologação pendente na JMS..."
                    className="w-full px-3 py-2 bg-slate-50 border border-line rounded-xl text-xs font-medium text-ink focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Raw extracted text accordion */}
              {rawExtractedText && (
                <div className="pt-2 border-t border-line">
                  <button
                    type="button"
                    onClick={() => setShowRawText(!showRawText)}
                    className="text-xs font-bold text-ink/70 hover:text-ink flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye size={14} />
                    <span>{showRawText ? 'Ocultar' : 'Ver'} texto extraído do documento original</span>
                    <ChevronDown size={14} className={showRawText ? 'rotate-180 transition-transform' : 'transition-transform'} />
                  </button>

                  {showRawText && (
                    <div className="mt-2 p-3 bg-slate-100 rounded-xl font-mono text-[11px] text-ink/80 max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed border border-line">
                      {rawExtractedText}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 border-t border-line flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-bold text-ink/70 hover:text-ink rounded-xl border border-line hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-blue-950 hover:bg-blue-900 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 size={16} />
                  <span>Confirmar e Registrar Afastamento</span>
                </button>
              </div>
            </form>
          )}

          {/* Manual switch button if no file yet */}
          {!file && (
            <div className="pt-2 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-ink/60">Prefere preencher os dados diretamente sem enviar arquivo?</span>
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  onOpenManualModal?.();
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-ink font-bold text-xs flex items-center gap-2 border border-line transition-colors cursor-pointer"
              >
                <span>Adicionar Manualmente</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
