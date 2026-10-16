import React, { useState } from 'react';
import { 
  Cloud, 
  Key, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  ExternalLink, 
  Copy, 
  Check, 
  X, 
  Info,
  Database
} from 'lucide-react';
import { getApiConfig, saveApiConfig, fetchSpreadsheetData, DEFAULT_APPS_SCRIPT_URL } from '../services/googleSheetsExtrasService';

interface GoogleSheetsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncSuccess?: () => void;
  currentStatus: 'connected' | 'token_needed' | 'tab_needed' | 'error' | 'loading' | 'idle';
  statusMessage?: string | null;
}

export const GoogleSheetsConfigModal: React.FC<GoogleSheetsConfigModalProps> = ({
  isOpen,
  onClose,
  onSyncSuccess,
  currentStatus,
  statusMessage
}) => {
  const [config, setConfig] = useState(getApiConfig());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ 
    success: boolean; 
    message: string; 
    isTokenNotConfigured?: boolean;
    isSheetTabMissing?: boolean;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    saveApiConfig(config.url, config.token);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    handleSave();
    try {
      const res = await fetchSpreadsheetData({ url: config.url, token: config.token });
      if (res.success) {
        setTestResult({
          success: true,
          message: res.message || 'Conexão bem-sucedida com a planilha Google!'
        });
        if (onSyncSuccess) onSyncSuccess();
      } else {
        setTestResult({
          success: false,
          message: res.message || res.error || 'Erro ao conectar à API da planilha.',
          isTokenNotConfigured: res.isTokenNotConfigured,
          isSheetTabMissing: res.isSheetTabMissing
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Falha de rede.'
      });
    } finally {
      setTesting(false);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(config.url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div 
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-line overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-line flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950 text-white flex items-center justify-center shadow-xs">
              <Database size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink">Banco de Dados da Planilha (API)</h3>
              <p className="text-xs text-ink/60">Sincronização em tempo real de Serviços Extras via Google Apps Script</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-ink/40 hover:text-ink hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-ink">
          {/* Status Alert Banner */}
          <div className="p-3.5 rounded-xl border flex items-start gap-3 bg-emerald-50/60 border-emerald-200">
            <Cloud className="text-emerald-800 shrink-0 mt-0.5" size={18} />
            <div className="flex-1">
              <p className="font-bold text-emerald-950 text-xs">Integração Ativa na Aba "Serviços Extras"</p>
              <p className="text-[11px] text-emerald-800/80 mt-0.5">
                Esta aba utiliza a URL do Google Apps Script como API de banco de dados para leitura e escrita automática de serviços extras e datas futuras atribuídas.
              </p>
            </div>
          </div>

          {/* Form fields */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-ink text-xs flex items-center gap-1.5">
                  <Database size={13} className="text-emerald-900" />
                  URL da API (Google Apps Script Web App)
                </label>
                <button
                  type="button"
                  onClick={copyUrl}
                  className="text-[11px] text-emerald-900 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {copiedUrl ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  {copiedUrl ? "Copiado!" : "Copiar URL"}
                </button>
              </div>
              <input
                type="text"
                value={config.url}
                onChange={(e) => setConfig({ ...config, url: e.target.value })}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-line rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-950/20"
              />
            </div>

            <div>
              <label className="font-bold text-ink text-xs flex items-center gap-1.5 mb-1">
                <Key size={13} className="text-amber-700" />
                Chave / Token de Acesso (API_TOKEN)
              </label>
              <input
                type="text"
                value={config.token}
                onChange={(e) => setConfig({ ...config, token: e.target.value })}
                placeholder="Insira o API_TOKEN configurado no seu script (se houver)"
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-line rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-950/20"
              />
              <p className="text-[10px] text-ink/50 mt-1">
                Enviado nas requisições como parâmetro e no corpo para autenticação segura com sua planilha.
              </p>
            </div>
          </div>

          {/* Test connection result message */}
          {testResult && (
            <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
              testResult.success 
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}>
              {testResult.success ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-bold">{testResult.success ? "Conexão Estabelecida!" : "Aviso da API"}</p>
                <p className="text-[11px] mt-0.5">{testResult.message}</p>
              </div>
            </div>
          )}

          {/* Guide on Tab "Efetivo" */}
          <div className="bg-sky-50/80 border border-sky-200/90 rounded-xl p-4 space-y-2.5">
            <h4 className="font-bold text-sky-950 text-xs flex items-center gap-1.5">
              <Info size={14} className="text-sky-700" />
              Importante: A planilha precisa de uma aba chamada "Efetivo"
            </h4>
            <p className="text-[11px] text-sky-900/90 leading-relaxed">
              O script do Google Apps Script busca os dados e grava os serviços extras especificamente na aba com o nome <strong>Efetivo</strong>:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-sky-950 leading-relaxed">
              <li>Abra sua planilha Google no navegador.</li>
              <li>Na barra inferior de abas (onde diz <em>"Página1"</em>, <em>"Sheet1"</em> ou outro nome), clique com o botão direito na aba desejada.</li>
              <li>Selecione <strong>Renomear</strong> e digite exatamente: <span className="font-bold font-mono bg-white px-1.5 py-0.5 rounded border border-sky-300">Efetivo</span></li>
              <li>A planilha deve conter colunas com os nomes dos militares (ex: <em>Nome</em>, <em>Posto</em>, <em>Data</em> ou colunas de datas).</li>
              <li>Volte nesta janela e clique em <strong>Testar Conexão</strong>!</li>
            </ol>
          </div>

          {/* Guide on setting API_TOKEN in Google Apps Script */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 space-y-2">
            <h4 className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
              <Info size={14} className="text-amber-700" />
              Como configurar a chave "API_TOKEN" no Google Apps Script?
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-amber-900/90 leading-relaxed">
              <li>Na sua planilha Google, acesse o menu <strong>Extensões &gt; Apps Script</strong>.</li>
              <li>No menu à esquerda do editor, clique em <strong>Configurações do Projeto</strong> (ícone de engrenagem ⚙️).</li>
              <li>Role até a seção <strong>Propriedades do script</strong> e clique em <strong>Adicionar propriedade do script</strong>.</li>
              <li>Defina a propriedade:
                <div className="mt-1 font-mono text-[10px] bg-white/80 p-2 rounded-lg border border-amber-200">
                  <strong>Propriedade:</strong> API_TOKEN<br />
                  <strong>Valor:</strong> 000 (ou o token digitado no campo acima)
                </div>
              </li>
              <li>Clique em <strong>Salvar propriedades do script</strong>.</li>
            </ol>
            <p className="text-[10px] text-amber-800/80 italic pt-1">
              💡 As atribuições de extras também ficam salvas localmente no navegador para garantir que seu trabalho nunca seja interrompido.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setConfig({ url: DEFAULT_APPS_SCRIPT_URL, token: '' });
              saveApiConfig(DEFAULT_APPS_SCRIPT_URL, '');
            }}
            className="text-[11px] text-ink/60 hover:text-ink underline cursor-pointer"
          >
            Restaurar URL Padrão
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="px-3.5 py-2 rounded-xl border border-line bg-white hover:bg-slate-100 font-semibold text-xs text-ink flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={testing ? "animate-spin text-emerald-950" : "text-ink/60"} />
              {testing ? "Testando..." : "Testar Conexão"}
            </button>

            <button
              type="button"
              onClick={() => {
                handleSave();
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-white font-semibold text-xs transition-all shadow-xs cursor-pointer"
            >
              Salvar e Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
