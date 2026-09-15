import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  UserPlus, 
  Filter, 
  Edit, 
  Trash2, 
  Phone, 
  ShieldCheck, 
  Clock, 
  AlertCircle, 
  Calendar, 
  Download, 
  RotateCcw,
  CheckCircle2,
  X,
  Plus,
  FileSpreadsheet,
  FileDown,
  FileText
} from 'lucide-react';
import { EfetivoMilitar, SituacaoOperacional, PostoGraduacao, EscalaTipo } from '../types';
import { downloadModeloExcelEfetivo } from '../services/excelEfetivoParser';

interface GestaoEfetivoProps {
  efetivo: EfetivoMilitar[];
  onAddMilitar: (m: Omit<EfetivoMilitar, 'id'>) => void;
  onUpdateMilitar: (id: string, updates: Partial<EfetivoMilitar>) => void;
  onDeleteMilitar: (id: string) => void;
  onResetDefault: () => void;
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
  onOpenImportModal: () => void;
  onOpenImportPdfModal: () => void;
}

const POSTOS_LIST: PostoGraduacao[] = [
  'Cel', 'Ten-Cel', 'Maj', 'Cap', '1º Ten', '2º Ten', 'Subten', '1º Sgt', '2º Sgt', '3º Sgt', 'Cb', 'Sd'
];

export const POSTOS_ESCALA_BATALHAO: string[] = [
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

export const SITUACOES_FORA_ESCALA: string[] = [
  'À Disposição',
  'LTS',
  'Férias'
];

export const COMMON_POSTS_LIST: string[] = [
  ...SITUACOES_FORA_ESCALA,
  ...POSTOS_ESCALA_BATALHAO
];

export const GestaoEfetivo: React.FC<GestaoEfetivoProps> = ({
  efetivo,
  onAddMilitar,
  onUpdateMilitar,
  onDeleteMilitar,
  onResetDefault,
  isAddModalOpen,
  setIsAddModalOpen,
  onOpenImportModal,
  onOpenImportPdfModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSituacao, setFilterSituacao] = useState<string>('TODAS');

  // Edit Modal State
  const [editingMilitar, setEditingMilitar] = useState<EfetivoMilitar | null>(null);

  // Add Form State
  const [newMatricula, setNewMatricula] = useState('');
  const [newPosto, setNewPosto] = useState<PostoGraduacao>('Sd');
  const [newNomeGuerra, setNewNomeGuerra] = useState('');
  const [newNomeCompleto, setNewNomeCompleto] = useState('');
  const [newSituacao, setNewSituacao] = useState<string>('À Disposição');
  const [newFuncao, setNewFuncao] = useState('Patrulheiro');
  const [newContato, setNewContato] = useState('(82) 988');
  const [newEscalaTipo, setNewEscalaTipo] = useState<EscalaTipo>('SOLO');
  const [newObservacao, setNewObservacao] = useState('');

  const isAfastado = (s: string) => ['férias', 'ferias', 'lts', 'dispensa'].some(t => (s || '').toLowerCase().includes(t));
  const isADisposicao = (s: string) => {
    const l = (s || '').toLowerCase();
    return l === 'à disposição' || l === 'a disposicao' || l === 'pronto' || l === 'folga';
  };
  const isEmEscala = (s: string) => !isAfastado(s) && !isADisposicao(s);

  // Filtered List
  const filteredEfetivo = efetivo.filter(m => {
    const matchesSearch = 
      m.nomeGuerra.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.nomeCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.matricula.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.funcao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.postoGraduacao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.situacao.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSituacao = 
      filterSituacao === 'TODAS' ? true :
      filterSituacao === 'ESCALADOS' ? isEmEscala(m.situacao) :
      filterSituacao === 'NAO_ESCALADOS' ? !isEmEscala(m.situacao) :
      filterSituacao === 'À Disposição' ? isADisposicao(m.situacao) :
      filterSituacao === 'LTS' ? m.situacao.toLowerCase().includes('lts') :
      filterSituacao === 'Férias' ? (m.situacao.toLowerCase().includes('férias') || m.situacao.toLowerCase().includes('ferias')) :
      m.situacao === filterSituacao;

    return matchesSearch && matchesSituacao;
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNomeGuerra || !newNomeCompleto) {
      alert('Preencha ao menos o Nome de Guerra e Nome Completo.');
      return;
    }

    onAddMilitar({
      matricula: newMatricula || `${Math.floor(10000 + Math.random() * 90000)}-${Math.floor(Math.random() * 9)}`,
      postoGraduacao: newPosto,
      nomeGuerra: newNomeGuerra,
      nomeCompleto: newNomeCompleto,
      situacao: newSituacao,
      funcao: newFuncao,
      contato: newContato,
      dataAdmissao: new Date().toISOString().split('T')[0],
      escalaTipo: newEscalaTipo,
      observacao: newObservacao,
    });

    // Reset fields
    setNewMatricula('');
    setNewNomeGuerra('');
    setNewNomeCompleto('');
    setNewObservacao('');
    setIsAddModalOpen(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMilitar) return;

    onUpdateMilitar(editingMilitar.id, editingMilitar);
    setEditingMilitar(null);
  };

  const exportEfetivoCSV = () => {
    const headers = 'ID,Matrícula,Posto/Grad,Nome de Guerra,Nome Completo,Situação,Função,Contato\n';
    const rows = filteredEfetivo.map(m => 
      `"${m.id}","${m.matricula}","${m.postoGraduacao}","${m.nomeGuerra}","${m.nomeCompleto}","${m.situacao}","${m.funcao}","${m.contato}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `efetivo_4bpm_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="bg-white p-6 rounded-2xl border border-line shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-950 text-white flex items-center justify-center">
              <Users size={18} />
            </div>
            <h2 className="text-xl font-bold text-ink">
              Banco de Dados do Efetivo
            </h2>
          </div>
          <p className="text-xs text-ink/60 mt-1">
            Gestão completa do quadro de militares do 4º BPM — Cadastro, funções, situações operacionais e contatos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenImportPdfModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <FileText size={15} />
            Importar Escala (PDF)
          </button>
          <button
            onClick={onOpenImportModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-950 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <FileSpreadsheet size={15} />
            Importar Excel
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <UserPlus size={15} />
            Novo Militar
          </button>
          <button
            onClick={downloadModeloExcelEfetivo}
            title="Baixar planilha modelo de exemplo com colunas pré-formatadas"
            className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-ink rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <FileDown size={14} />
            Modelo Excel
          </button>
          <button
            onClick={exportEfetivoCSV}
            className="flex items-center gap-2 px-3 py-2.5 bg-white border border-line hover:bg-slate-50 text-ink rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <Download size={14} />
            Exportar CSV
          </button>
          <button
            onClick={() => {
              if (confirm('Deseja restaurar o banco com o efetivo padrão original do Batalhão?')) {
                onResetDefault();
              }
            }}
            title="Restaurar dados padrão"
            className="p-2.5 text-ink/40 hover:text-ink hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Quick Battalion Readiness & Scale Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-white p-3.5 rounded-2xl border border-line shadow-2xs flex items-center justify-between">
          <span className="text-ink/60 font-mono text-[11px]">Efetivo Total:</span>
          <span className="font-bold font-mono text-ink text-sm">{efetivo.length}</span>
        </div>
        <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200 shadow-2xs flex items-center justify-between">
          <span className="text-emerald-900 font-mono text-[11px] font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
            Em Escala (Postos):
          </span>
          <span className="font-black font-mono text-emerald-950 text-sm">
            {efetivo.filter(m => isEmEscala(m.situacao)).length}
          </span>
        </div>
        <div className="bg-slate-100 p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <span className="text-slate-800 font-mono text-[11px] font-semibold">À Disposição:</span>
          <span className="font-black font-mono text-slate-900 text-sm">
            {efetivo.filter(m => isADisposicao(m.situacao)).length}
          </span>
        </div>
        <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 shadow-2xs flex items-center justify-between">
          <span className="text-amber-900 font-mono text-[11px] font-semibold">Afastados (LTS/Férias):</span>
          <span className="font-black font-mono text-amber-950 text-sm">
            {efetivo.filter(m => isAfastado(m.situacao)).length}
          </span>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-line shadow-xs grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" size={16} />
          <input
            type="text"
            placeholder="Buscar por nome de guerra, nome completo, matrícula, posto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-line/60 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-800/20 font-sans"
          />
        </div>

        <div>
          <select
            value={filterSituacao}
            onChange={(e) => setFilterSituacao(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-line/60 rounded-xl text-xs focus:outline-hidden font-sans cursor-pointer text-ink font-semibold"
          >
            <option value="TODAS">Escala / Situação: Todas</option>
            <option value="ESCALADOS">★ Em Posto na Escala</option>
            <optgroup label="Situação Fora da Escala">
              <option value="À Disposição">À Disposição (Disponíveis)</option>
              <option value="LTS">LTS (Licença Médica)</option>
              <option value="Férias">Férias</option>
            </optgroup>
            <optgroup label="Postos na escala do Batalhão">
              {POSTOS_ESCALA_BATALHAO.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      {/* Efetivo Directory Table / Cards */}
      <div className="bg-white rounded-2xl border border-line shadow-xs overflow-hidden">
        <div className="p-4 border-b border-line flex items-center justify-between text-xs font-mono text-ink/60">
          <span>Exibindo <strong>{filteredEfetivo.length}</strong> de <strong>{efetivo.length}</strong> militares</span>
          <span>Atualizado em tempo real</span>
        </div>

        <div className="divide-y divide-line/60">
          {filteredEfetivo.map((militar) => (
            <div 
              key={militar.id}
              className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* Left Column: Soldier Identity */}
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-950/10 text-emerald-950 flex items-center justify-center font-bold text-xs font-mono shrink-0">
                  {militar.postoGraduacao}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-ink text-sm sm:text-base uppercase tracking-tight">
                      {militar.postoGraduacao} {militar.nomeGuerra}
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                      Matr: {militar.matricula}
                    </span>
                  </div>
                  <p className="text-xs text-ink/60 font-sans mt-0.5">
                    {militar.nomeCompleto}
                  </p>
                  <p className="text-[10px] text-ink/50 font-mono mt-0.5">
                    Função: <strong className="text-ink/70">{militar.funcao}</strong>
                  </p>
                </div>
              </div>

              {/* Right Column: Status, Contact, Actions */}
              <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 self-stretch md:self-auto border-t md:border-t-0 pt-2 md:pt-0 border-line/40">
                {/* Local na Escala / Situação (Substitui o antigo campo em verde) */}
                <div className="relative">
                  <select
                    value={militar.situacao}
                    onChange={(e) => {
                      if (e.target.value === '__CUSTOM__') {
                        const custom = prompt('Informe o local/posto na escala para este militar:', militar.situacao);
                        if (custom && custom.trim()) {
                          onUpdateMilitar(militar.id, { situacao: custom.trim() });
                        }
                      } else {
                        onUpdateMilitar(militar.id, { situacao: e.target.value });
                      }
                    }}
                    title="Local na escala ou situação atual do militar"
                    className={`text-xs font-bold font-mono px-3 py-1.5 rounded-xl border cursor-pointer focus:outline-hidden transition-all shadow-2xs max-w-[220px] truncate ${
                      isAfastado(militar.situacao)
                        ? militar.situacao.toLowerCase().includes('lts')
                          ? 'bg-rose-50 text-rose-900 border-rose-300'
                          : 'bg-amber-50 text-amber-900 border-amber-300'
                        : isADisposicao(militar.situacao)
                        ? 'bg-slate-100 text-slate-800 border-slate-300'
                        : 'bg-emerald-50 text-emerald-950 border-emerald-400 ring-1 ring-emerald-400/30'
                    }`}
                  >
                    <optgroup label="Situação Fora da Escala">
                      <option value="À Disposição">À Disposição</option>
                      <option value="LTS">LTS (Licença Saúde)</option>
                      <option value="Férias">Férias</option>
                    </optgroup>
                    <optgroup label="Postos na escala do Batalhão">
                      {!POSTOS_ESCALA_BATALHAO.includes(militar.situacao) && !SITUACOES_FORA_ESCALA.includes(militar.situacao) && (
                        <option value={militar.situacao}>{militar.situacao}</option>
                      )}
                      {POSTOS_ESCALA_BATALHAO.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </optgroup>
                    <option value="__CUSTOM__">✏️ Outro Posto / Personalizado...</option>
                  </select>
                </div>

                <div className="text-right hidden sm:block">
                  <span className="text-[11px] font-mono text-ink/60 flex items-center gap-1">
                    <Phone size={11} /> {militar.contato}
                  </span>
                  <span className="text-[9px] font-mono text-ink/40">
                    Escala: {militar.escalaTipo}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingMilitar(militar)}
                    title="Editar dados do militar"
                    className="p-2 text-ink/60 hover:text-emerald-950 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Excluir o militar ${militar.postoGraduacao} ${militar.nomeGuerra} do banco?`)) {
                        onDeleteMilitar(militar.id);
                      }
                    }}
                    title="Excluir militar"
                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredEfetivo.length === 0 && (
            <div className="p-12 text-center text-ink/50 text-xs italic">
              Nenhum militar encontrado com os filtros selecionados.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Adicionar Novo Militar */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-line space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <UserPlus size={18} className="text-emerald-800" />
                Cadastrar Novo Militar no Efetivo
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer text-ink/50"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-ink/70 block mb-1">Posto / Graduação</label>
                  <select
                    value={newPosto}
                    onChange={(e) => setNewPosto(e.target.value as PostoGraduacao)}
                    className="w-full p-2 bg-slate-50 border border-line rounded-lg"
                  >
                    {POSTOS_LIST.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-ink/70 block mb-1">Matrícula / RE</label>
                  <input
                    type="text"
                    placeholder="Ex: 12345-6"
                    value={newMatricula}
                    onChange={(e) => setNewMatricula(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-line rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-ink/70 block mb-1">Nome de Guerra (como chamado na tropa)</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: SILVA, SARGENTO COSTA"
                  value={newNomeGuerra}
                  onChange={(e) => setNewNomeGuerra(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-line rounded-lg uppercase"
                />
              </div>

              <div>
                <label className="font-bold text-ink/70 block mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: JOSÉ DA SILVA SANTOS"
                  value={newNomeCompleto}
                  onChange={(e) => setNewNomeCompleto(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-line rounded-lg uppercase"
                />
              </div>

              <div>
                <label className="font-bold text-ink/70 block mb-1">Local na Escala / Situação</label>
                <select
                  value={newSituacao}
                  onChange={(e) => {
                    if (e.target.value === '__CUSTOM__') {
                      const custom = prompt('Digite o posto ou local na escala:');
                      if (custom && custom.trim()) setNewSituacao(custom.trim());
                    } else {
                      setNewSituacao(e.target.value);
                    }
                  }}
                  className="w-full p-2 bg-slate-50 border border-line rounded-lg font-mono"
                >
                  <optgroup label="Situação Fora da Escala">
                    <option value="À Disposição">À Disposição</option>
                    <option value="LTS">LTS (Licença Saúde)</option>
                    <option value="Férias">Férias</option>
                  </optgroup>
                  <optgroup label="Postos na escala do Batalhão">
                    {!POSTOS_ESCALA_BATALHAO.includes(newSituacao) && !SITUACOES_FORA_ESCALA.includes(newSituacao) && (
                      <option value={newSituacao}>{newSituacao}</option>
                    )}
                    {POSTOS_ESCALA_BATALHAO.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </optgroup>
                  <option value="__CUSTOM__">✏️ Outro Posto / Personalizado...</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-ink/70 block mb-1">Função Principal</label>
                  <input
                    type="text"
                    value={newFuncao}
                    onChange={(e) => setNewFuncao(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-line rounded-lg"
                  />
                </div>

                <div>
                  <label className="font-bold text-ink/70 block mb-1">Telefone / Contato</label>
                  <input
                    type="text"
                    value={newContato}
                    onChange={(e) => setNewContato(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-line rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-ink/70 block mb-1">Tipo de Escala Ordinária</label>
                  <select
                    value={newEscalaTipo}
                    onChange={(e) => setNewEscalaTipo(e.target.value as EscalaTipo)}
                    className="w-full p-2 bg-slate-50 border border-line rounded-lg"
                  >
                    <option value="SOLO">Solo (12h)</option>
                    <option value="FT">Força Tática</option>
                    <option value="24H">24 Horas</option>
                    <option value="ADMIN">Administrativo</option>
                    <option value="EXPEDIENTE">Expediente Batalhão</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-ink/70 block mb-1">Observações</label>
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={newObservacao}
                    onChange={(e) => setNewObservacao(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-line rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-line rounded-xl text-ink font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-950 text-white rounded-xl font-bold hover:bg-emerald-900 cursor-pointer"
                >
                  Salvar Militar no Banco
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Militar */}
      {editingMilitar && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-line space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <Edit size={18} className="text-emerald-800" />
                Editar Dados do Militar
              </h3>
              <button 
                onClick={() => setEditingMilitar(null)}
                className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer text-ink/50"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-ink/70 block mb-1">Posto / Graduação</label>
                  <select
                    value={editingMilitar.postoGraduacao}
                    onChange={(e) => setEditingMilitar({ ...editingMilitar, postoGraduacao: e.target.value as PostoGraduacao })}
                    className="w-full p-2 bg-slate-50 border border-line rounded-lg"
                  >
                    {POSTOS_LIST.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-ink/70 block mb-1">Matrícula</label>
                  <input
                    type="text"
                    value={editingMilitar.matricula}
                    onChange={(e) => setEditingMilitar({ ...editingMilitar, matricula: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-line rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-ink/70 block mb-1">Nome de Guerra</label>
                <input
                  type="text"
                  required
                  value={editingMilitar.nomeGuerra}
                  onChange={(e) => setEditingMilitar({ ...editingMilitar, nomeGuerra: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-line rounded-lg uppercase"
                />
              </div>

              <div>
                <label className="font-bold text-ink/70 block mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={editingMilitar.nomeCompleto}
                  onChange={(e) => setEditingMilitar({ ...editingMilitar, nomeCompleto: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-line rounded-lg uppercase"
                />
              </div>

              <div>
                <label className="font-bold text-ink/70 block mb-1">Local na Escala / Situação</label>
                <select
                  value={editingMilitar.situacao}
                  onChange={(e) => {
                    if (e.target.value === '__CUSTOM__') {
                      const custom = prompt('Digite o posto ou local na escala:', editingMilitar.situacao);
                      if (custom && custom.trim()) {
                        setEditingMilitar({ ...editingMilitar, situacao: custom.trim() });
                      }
                    } else {
                      setEditingMilitar({ ...editingMilitar, situacao: e.target.value });
                    }
                  }}
                  className="w-full p-2 bg-slate-50 border border-line rounded-lg font-mono"
                >
                  <optgroup label="Situação Fora da Escala">
                    <option value="À Disposição">À Disposição</option>
                    <option value="LTS">LTS (Licença Saúde)</option>
                    <option value="Férias">Férias</option>
                  </optgroup>
                  <optgroup label="Postos na escala do Batalhão">
                    {!POSTOS_ESCALA_BATALHAO.includes(editingMilitar.situacao) && !SITUACOES_FORA_ESCALA.includes(editingMilitar.situacao) && (
                      <option value={editingMilitar.situacao}>{editingMilitar.situacao}</option>
                    )}
                    {POSTOS_ESCALA_BATALHAO.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </optgroup>
                  <option value="__CUSTOM__">✏️ Outro Posto / Personalizado...</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-ink/70 block mb-1">Função</label>
                  <input
                    type="text"
                    value={editingMilitar.funcao}
                    onChange={(e) => setEditingMilitar({ ...editingMilitar, funcao: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-line rounded-lg"
                  />
                </div>

                <div>
                  <label className="font-bold text-ink/70 block mb-1">Contato</label>
                  <input
                    type="text"
                    value={editingMilitar.contato}
                    onChange={(e) => setEditingMilitar({ ...editingMilitar, contato: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-line rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => setEditingMilitar(null)}
                  className="px-4 py-2 border border-line rounded-xl text-ink font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-950 text-white rounded-xl font-bold hover:bg-emerald-900 cursor-pointer"
                >
                  Atualizar Dados
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
