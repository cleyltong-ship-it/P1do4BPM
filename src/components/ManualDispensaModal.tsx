import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckCircle2, 
  Stethoscope, 
  Calendar, 
  Clock, 
  User, 
  FileText,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { DispensaMedicaLTS, EfetivoMilitar, PostoGraduacao, TipoAfastamentoSaude } from '../types';
import { addDaysToDate } from '../services/dispensaFileParser';

interface ManualDispensaModalProps {
  isOpen: boolean;
  onClose: () => void;
  efetivo: EfetivoMilitar[];
  onSave: (dispensa: Omit<DispensaMedicaLTS, 'id' | 'criadoEm'>) => void;
  initialData?: DispensaMedicaLTS | null;
}

export const ManualDispensaModal: React.FC<ManualDispensaModalProps> = ({
  isOpen,
  onClose,
  efetivo,
  onSave,
  initialData
}) => {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [matricula, setMatricula] = useState('');
  const [nome, setNome] = useState('');
  const [nomeGuerra, setNomeGuerra] = useState('');
  const [postoGraduacao, setPostoGraduacao] = useState<PostoGraduacao>('Sd');
  const [tipo, setTipo] = useState<TipoAfastamentoSaude>('Dispensa Médica');
  const [diasAfastamento, setDiasAfastamento] = useState<number>(15);
  const [dataInicio, setDataInicio] = useState<string>(todayStr);
  const [dataFimPrevista, setDataFimPrevista] = useState<string>(addDaysToDate(todayStr, 15));
  const [cid, setCid] = useState<string>('');
  const [descricaoCid, setDescricaoCid] = useState<string>('');
  const [medicoOuJunta, setMedicoOuJunta] = useState<string>('');
  const [situacao, setSituacao] = useState<'Em Andamento' | 'Concluída' | 'Prevista'>('Em Andamento');
  const [observacoes, setObservacoes] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setMatricula(initialData.matricula);
      setNome(initialData.nome);
      setNomeGuerra(initialData.nomeGuerra || '');
      setPostoGraduacao(initialData.postoGraduacao);
      setTipo(initialData.tipo);
      setDiasAfastamento(initialData.diasAfastamento);
      setDataInicio(initialData.dataInicio);
      setDataFimPrevista(initialData.dataFimPrevista);
      setCid(initialData.cid || '');
      setDescricaoCid(initialData.descricaoCid || '');
      setMedicoOuJunta(initialData.medicoOuJunta || '');
      setSituacao(initialData.situacao);
      setObservacoes(initialData.observacoes || '');
    } else {
      setMatricula('');
      setNome('');
      setNomeGuerra('');
      setPostoGraduacao('Sd');
      setTipo('Dispensa Médica');
      setDiasAfastamento(15);
      setDataInicio(todayStr);
      setDataFimPrevista(addDaysToDate(todayStr, 15));
      setCid('');
      setDescricaoCid('');
      setMedicoOuJunta('');
      setSituacao('Em Andamento');
      setObservacoes('');
    }
    setErrorMessage(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleDiasChange = (days: number) => {
    setDiasAfastamento(days);
    if (dataInicio && days > 0) {
      setDataFimPrevista(addDaysToDate(dataInicio, days));
    }
  };

  const handleInicioChange = (date: string) => {
    setDataInicio(date);
    if (date && diasAfastamento > 0) {
      setDataFimPrevista(addDaysToDate(date, diasAfastamento));
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
      setErrorMessage('Por favor, informe a data de início.');
      return;
    }

    onSave({
      matricula: matricula.trim() || `PM-${Math.floor(10000 + Math.random() * 90000)}`,
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
      situacao,
      observacoes: observacoes.trim() || undefined,
      documentoOrigem: initialData?.documentoOrigem || 'Cadastro Manual'
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl shadow-2xl border border-line w-full max-w-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 text-blue-300 flex items-center justify-center">
              <Stethoscope size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                {initialData ? 'Editar Afastamento de Saúde' : 'Cadastro Manual: Dispensa Médica / LTS'}
              </h2>
              <p className="text-xs text-blue-100/70">
                Lançamento manual com cálculo automático de término e controle de CID
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMessage && (
            <div className="p-3 bg-red-50 text-red-900 rounded-xl border border-red-200 flex items-center gap-2 text-xs">
              <AlertCircle size={16} className="text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tipo */}
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
                <option value="Outro">Outro</option>
              </select>
            </div>

            {/* Situação */}
            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Situação Atual *
              </label>
              <select
                value={situacao}
                onChange={(e) => setSituacao(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-line rounded-xl text-xs font-bold text-ink focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              >
                <option value="Em Andamento">Em Andamento (Ativo)</option>
                <option value="Prevista">Prevista</option>
                <option value="Concluída">Concluída / Retornado</option>
              </select>
            </div>

            {/* Selecionar Militar do Efetivo */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-ink mb-1">
                Localizar Militar no Efetivo (Preenchimento Rápido)
              </label>
              <select
                onChange={(e) => handleMilitarSelect(e.target.value)}
                value={matricula}
                className="w-full px-3 py-2 bg-blue-50/50 border border-blue-200 rounded-xl text-xs font-medium text-ink focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              >
                <option value="">-- Selecionar Militar do Efetivo do 4º BPM --</option>
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
                Matrícula *
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
                Nome Completo *
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome completo do policial militar"
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
                <span>Tempo Afastado (Dias) *</span>
                <span className="font-mono text-blue-800 font-bold text-[11px]">{diasAfastamento} dias</span>
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
                  {[5, 8, 15, 30, 60].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleDiasChange(d)}
                      className="px-2 py-1 text-[10px] font-mono font-bold rounded-lg border border-line bg-white hover:bg-slate-100 cursor-pointer"
                    >
                      {d}d
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
                CID (se houver)
              </label>
              <input
                type="text"
                value={cid}
                onChange={(e) => setCid(e.target.value.toUpperCase())}
                placeholder="Ex: M54.5"
                className="w-full px-3 py-2 bg-slate-50 border border-line rounded-xl text-xs font-mono font-bold text-purple-950 focus:ring-2 focus:ring-purple-600 focus:outline-hidden uppercase"
              />
            </div>

            {/* Descrição CID */}
            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Descrição do CID / Diagnóstico
              </label>
              <input
                type="text"
                value={descricaoCid}
                onChange={(e) => setDescricaoCid(e.target.value)}
                placeholder="Ex: Dorsalgia / Lombalgia"
                className="w-full px-3 py-2 bg-slate-50 border border-line rounded-xl text-xs font-medium text-ink focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            {/* Médico / JMS */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-ink mb-1">
                Médico Assistente / Junta Militar de Saúde (JMS)
              </label>
              <input
                type="text"
                value={medicoOuJunta}
                onChange={(e) => setMedicoOuJunta(e.target.value)}
                placeholder="Ex: JMS / PMAL ou Dr. Fulano - CRM 1234/AL"
                className="w-full px-3 py-2 bg-slate-50 border border-line rounded-xl text-xs font-medium text-ink focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            {/* Observações */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-ink mb-1">
                Observações
              </label>
              <textarea
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Observações administrativas ou recomendações..."
                className="w-full px-3 py-2 bg-slate-50 border border-line rounded-xl text-xs font-medium text-ink focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-line flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-ink/70 hover:text-ink rounded-xl border border-line hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-bold text-white bg-blue-950 hover:bg-blue-900 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 size={16} />
              <span>Salvar Registro</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
