import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  FileUp, 
  Users, 
  Calendar, 
  Clock, 
  Search, 
  AlertCircle,
  ShieldCheck,
  ArrowUpDown,
  FileDown,
  Brain,
  FileText,
  CalendarCheck,
  Copy, 
  Trash2, 
  CheckSquare, 
  ListOrdered, 
  Check,
  CalendarPlus,
  Database,
  RefreshCw,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { parseEscalaPDF } from '../lib/pdfParser';
import { SoldierService, ScaleData } from '../types';
import { 
  fetchSpreadsheetData, 
  addFutureExtraToSpreadsheet, 
  loadLocalExtrasData, 
  saveLocalExtrasData, 
  recordFutureExtraLocal,
  DEFAULT_APPS_SCRIPT_URL
} from '../services/googleSheetsExtrasService';
import { getEfetivo } from '../services/efetivoDatabase';
import { GoogleSheetsConfigModal } from './GoogleSheetsConfigModal';
import { AtribuirExtraFuturoModal } from './AtribuirExtraFuturoModal';

const cleanName = (name: string): string => {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ');
};

interface GestaoServicosExtrasProps {
  initialData?: SoldierService[];
}

export const GestaoServicosExtras: React.FC<GestaoServicosExtrasProps> = ({
  initialData = [],
}) => {
  const [data, setData] = useState<SoldierService[]>(initialData);
  const [fileName, setFileName] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterExtraStatus, setFilterExtraStatus] = useState<'todos' | 'com_futuro' | 'sem_futuro' | 'sem_registro'>('todos');
  const [activeTab, setActiveTab] = useState<'ranking' | 'data' | 'pdf' | 'organizador'>('ranking');
  const [isHovering, setIsHovering] = useState(false);
  const [selectedSoldierNames, setSelectedSoldierNames] = useState<string[]>([]);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Google Sheets API states
  const [apiStatus, setApiStatus] = useState<'connected' | 'token_needed' | 'error' | 'loading' | 'idle'>('idle');
  const [apiMessage, setApiMessage] = useState<string | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isSubmittingExtra, setIsSubmittingExtra] = useState(false);
  const [toastNotification, setToastNotification] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);

  // PDF Scale States
  const [pdfData, setPdfData] = useState<ScaleData | null>(null);
  const [pdfSubTab, setPdfSubTab] = useState<'SOLO' | 'FT' | '24H' | 'ADMIN' | 'GERAL'>('GERAL');
  const [targetDate, setTargetDate] = useState<number>(new Date().getDate());
  const [isAnalyzingPdf, setIsAnalyzingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Load from Google Sheets API & Local Storage on mount
  useEffect(() => {
    // 1. Try to load cached data from localStorage
    const cached = loadLocalExtrasData();
    if (cached && cached.length > 0) {
      setData(cached);
    } else if (initialData && initialData.length > 0) {
      setData(initialData);
    } else {
      // Seed with battalion military personnel from database so table is immediately usable
      const defaultEfetivo = getEfetivo();
      if (defaultEfetivo && defaultEfetivo.length > 0) {
        const initialSoldiers: SoldierService[] = defaultEfetivo.map(m => ({
          name: `${m.postoGraduacao} ${m.nomeGuerra || m.nomeCompleto}`,
          lastService: null,
          history: [],
          allServices: [],
          futureExtras: []
        }));
        setData(initialSoldiers);
        saveLocalExtrasData(initialSoldiers);
      }
    }

    // 2. Fetch from Google Apps Script Spreadsheet API
    syncWithGoogleSpreadsheet(false);
  }, []);

  // Sync function
  const syncWithGoogleSpreadsheet = async (isManual = false) => {
    setApiStatus('loading');
    setApiMessage(null);
    try {
      const res = await fetchSpreadsheetData();
      if (res.success && res.data && res.data.length > 0) {
        setData(prev => {
          if (prev.length === 0) {
            saveLocalExtrasData(res.data!);
            return res.data!;
          }
          // Merge fetched data with current local data
          const mergedMap = new Map<string, SoldierService>();
          prev.forEach(s => mergedMap.set(cleanName(s.name), s));
          res.data!.forEach(incoming => {
            const key = cleanName(incoming.name);
            if (mergedMap.has(key)) {
              const current = mergedMap.get(key)!;
              const allD = [...current.allServices];
              incoming.allServices.forEach(d => {
                if (!allD.some(x => x.getTime() === d.getTime())) allD.push(d);
              });
              allD.sort((a, b) => a.getTime() - b.getTime());
              mergedMap.set(key, {
                ...current,
                allServices: allD,
                lastService: incoming.lastService || current.lastService,
                history: [...current.history, ...incoming.history.filter(h => !current.history.some(ch => ch.original === h.original))],
                futureExtras: [...(current.futureExtras || []), ...(incoming.futureExtras || []).filter(f => !(current.futureExtras || []).some(cf => cf.original === f.original))]
              });
            } else {
              mergedMap.set(key, incoming);
            }
          });
          const finalArr = Array.from(mergedMap.values());
          saveLocalExtrasData(finalArr);
          return finalArr;
        });
        setApiStatus('connected');
        if (isManual) {
          showToast(`${res.data.length} militares e escalas sincronizados com a planilha Google!`, 'success');
        }
      } else if (res.isTokenNotConfigured) {
        setApiStatus('token_needed');
        setApiMessage('API_TOKEN não configurado no Apps Script');
        if (isManual) {
          showToast('A planilha retornou "API_TOKEN não configurado". Clique no botão da Planilha para instruções.', 'warning');
        }
      } else {
        setApiStatus('error');
        setApiMessage(res.error || 'Falha na resposta da API');
        if (isManual) {
          showToast(res.error || 'Erro ao sincronizar com a planilha Google.', 'error');
        }
      }
    } catch (err: any) {
      setApiStatus('error');
      setApiMessage(err.message || 'Erro de conexão');
    }
  };

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToastNotification({ message, type });
    setTimeout(() => {
      setToastNotification(null);
    }, 4500);
  };

  // Toggle selection of military person
  const toggleSelectSoldier = (name: string) => {
    setSelectedSoldierNames(prev => {
      const clean = cleanName(name);
      const exists = prev.some(p => cleanName(p) === clean);
      if (exists) {
        return prev.filter(p => cleanName(p) !== clean);
      } else {
        return [...prev, name];
      }
    });
  };

  // Select all visible soldiers in the active tab
  const handleSelectAllVisible = () => {
    if (activeTab === 'ranking' || activeTab === 'data') {
      const list = activeTab === 'ranking' ? rankingData : filteredData;
      const allNames = list.map(s => s.name);
      setSelectedSoldierNames(prev => {
        const merged = [...prev];
        allNames.forEach(n => {
          if (!merged.some(m => cleanName(m) === cleanName(n))) {
            merged.push(n);
          }
        });
        return merged;
      });
    } else if (activeTab === 'pdf') {
      const available = getAvailableSoldiers();
      const allNames = available.map(s => s.name);
      setSelectedSoldierNames(prev => {
        const merged = [...prev];
        allNames.forEach(n => {
          if (!merged.some(m => cleanName(m) === cleanName(n))) {
            merged.push(n);
          }
        });
        return merged;
      });
    }
  };

  // Deselect all visible soldiers in the active tab
  const handleDeselectAllVisible = () => {
    if (activeTab === 'ranking' || activeTab === 'data') {
      const list = activeTab === 'ranking' ? rankingData : filteredData;
      const cleanList = list.map(s => cleanName(s.name));
      setSelectedSoldierNames(prev => prev.filter(p => !cleanList.includes(cleanName(p))));
    } else if (activeTab === 'pdf') {
      const available = getAvailableSoldiers();
      const cleanList = available.map(s => cleanName(s.name));
      setSelectedSoldierNames(prev => prev.filter(p => !cleanList.includes(cleanName(p))));
    } else {
      setSelectedSoldierNames([]);
    }
  };

  // Helper to obtain selected military workers, matching Excel and PDF data, sorted by longest to shortest time since last duty
  const getSelectedSoldiersOrdered = () => {
    const allNamesMap = new Map<string, { 
      name: string; 
      lastService: Date | null; 
      history: typeof data[0]['history']; 
      futureExtras?: typeof data[0]['futureExtras'];
      rawName: string 
    }>();

    // Load from Excel / API data
    data.forEach(s => {
      const clean = cleanName(s.name);
      allNamesMap.set(clean, {
        name: s.name,
        lastService: s.lastService,
        history: s.history,
        futureExtras: s.futureExtras,
        rawName: s.name
      });
    });

    // Merge or look up from PDF data
    if (pdfData) {
      pdfData.soldiers.forEach(s => {
        const clean = cleanName(s.name);
        if (!allNamesMap.has(clean)) {
          const excelInfo = data.find(ed => {
            const normalizedExcelName = cleanName(ed.name);
            if (normalizedExcelName === clean || normalizedExcelName.includes(clean) || clean.includes(normalizedExcelName)) return true;
            
            const pdfWords = clean.split(/[\s\.]+/).filter(w => w.length >= 2);
            const excelWords = normalizedExcelName.split(/[\s\.]+/).filter(w => w.length >= 2);
            if (pdfWords.length === 0 || excelWords.length === 0) return false;
            
            const common = pdfWords.filter(w => excelWords.includes(w));
            if (common.length >= 2) return true;
            if (common.length === 1 && common[0].length >= 4 && (pdfWords.length === 1 || excelWords.length === 1)) return true;
            return false;
          });

          allNamesMap.set(clean, {
            name: `${s.rank} ${s.name}`,
            lastService: excelInfo?.lastService || null,
            history: excelInfo?.history || [],
            futureExtras: excelInfo?.futureExtras || [],
            rawName: s.name
          });
        } else {
          const existing = allNamesMap.get(clean)!;
          if (!existing.name.startsWith(s.rank)) {
            existing.name = `${s.rank} ${existing.name}`;
          }
        }
      });
    }

    const selectedList = selectedSoldierNames.map(selName => {
      const cleanSel = cleanName(selName);
      return allNamesMap.get(cleanSel) || {
        name: selName,
        lastService: null,
        history: [],
        futureExtras: [],
        rawName: selName
      };
    });

    return selectedList.sort((a, b) => {
      if (a.lastService === null && b.lastService === null) return a.name.localeCompare(b.name);
      if (a.lastService === null) return -1;
      if (b.lastService === null) return 1;
      return a.lastService.getTime() - b.lastService.getTime();
    });
  };

  // Determine target soldiers for assigning future extra
  const getTargetSoldiersForAssignment = (): { name: string; rank?: string }[] => {
    if (selectedSoldierNames.length > 0) {
      return selectedSoldierNames.map(name => ({ name }));
    }
    if (activeTab === 'organizador') {
      return getSelectedSoldiersOrdered().map(s => ({ name: s.name }));
    }
    if (activeTab === 'pdf') {
      return getAvailableSoldiers().map(s => ({ name: s.name, rank: s.rank }));
    }
    if (activeTab === 'ranking') {
      return rankingData.map(s => ({ name: s.name }));
    }
    return filteredData.map(s => ({ name: s.name }));
  };

  // Core handler: Assign future extra date to filtered/selected soldiers & automatically write to spreadsheet via API
  const handleAssignFutureExtra = async (futureDate: Date, note: string) => {
    setIsSubmittingExtra(true);
    try {
      const targetSoldiers = getTargetSoldiersForAssignment();
      if (targetSoldiers.length === 0) {
        throw new Error("Nenhum militar selecionado ou filtrado para receber a data de extra.");
      }

      const soldierNames = targetSoldiers.map(s => s.name);

      // 1. Immediately update local state and localStorage
      const updated = recordFutureExtraLocal(data, soldierNames, futureDate, note);
      setData(updated);

      const formattedDate = futureDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

      // 2. Automatically sync to Google Spreadsheet API
      const apiRes = await addFutureExtraToSpreadsheet(targetSoldiers, futureDate, note);

      if (apiRes.success) {
        showToast(`Data ${formattedDate} atribuída a ${targetSoldiers.length} militar(es) e salva na planilha com sucesso!`, 'success');
        setApiStatus('connected');
      } else if (apiRes.isTokenNotConfigured) {
        showToast(`Data ${formattedDate} atribuída com sucesso! Para gravar na planilha Google, configure API_TOKEN no Apps Script.`, 'warning');
        setApiStatus('token_needed');
        setApiMessage(apiRes.error || 'API_TOKEN não configurado.');
      } else {
        showToast(`Data ${formattedDate} atribuída localmente. Aviso da planilha: ${apiRes.error}`, 'warning');
        setApiStatus('error');
        setApiMessage(apiRes.error || 'Erro na API');
      }
    } catch (err: any) {
      console.error('Error in handleAssignFutureExtra:', err);
      showToast(err.message || 'Erro ao atribuir data futura de extra.', 'error');
    } finally {
      setIsSubmittingExtra(false);
    }
  };

  const copySelectedListToClipboard = () => {
    const list = getSelectedSoldiersOrdered();
    if (list.length === 0) return;

    const header = `📋 *ESCALA EXTRA - LISTA DE MILITARES SELECIONADOS*\n*Ordenados por maior tempo sem serviço extra:*\n\n`;
    const body = list.map((s, index) => {
      const daysText = getTimeAgo(s.lastService);
      const dateText = formatDate(s.lastService);
      const futureText = (s.futureExtras && s.futureExtras.length > 0) 
        ? `\n   📅 Extra Agendado: ${s.futureExtras[0].original}` 
        : '';
      return `*${index + 1}º* - ${s.name}\n   ⏱️ Tempo: ${daysText} | Último extra: ${dateText}${futureText}`;
    }).join('\n\n');

    const fullText = `${header}${body}\n\n_Gerado pelo Sistema de Escala 4º BPM_`;
    navigator.clipboard.writeText(fullText);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 3000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzingPdf(true);
    setPdfError(null);
    try {
      const result = await parseEscalaPDF(file);
      if (!result || !result.soldiers || result.soldiers.length === 0) {
        throw new Error("Nenhum dado militar encontrado no PDF. Verifique se o arquivo contém as informações dos militares e se está no formato correto da escala mensal.");
      }
      setPdfData(result);
      setPdfError(null);
      setActiveTab('pdf');
      const currentDay = new Date().getDate();
      setTargetDate(currentDay);
    } catch (error) {
      console.error("PDF Parsing error:", error);
      const msg = error instanceof Error ? error.message : "Erro desconhecido ao ler o PDF.";
      setPdfError(msg);
      alert("Erro ao processar PDF: " + msg);
    } finally {
      setIsAnalyzingPdf(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const mockEvent = { target: { files: [file] } } as any;
        handlePdfUpload(mockEvent);
      } else {
        processFile(file);
      }
    }
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      const parsedData: SoldierService[] = [];
      const currentYear = new Date().getFullYear();

      const headers = rows[0] as any[] || [];
      const monthNamesLong = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
      const monthNamesShort = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
      
      const columnMonthMap: Record<number, number> = {};
      headers.forEach((h, i) => {
        if (!h) return;
        const headerStr = String(h).toUpperCase();
        monthNamesLong.forEach((m, idx) => {
          if (headerStr.includes(m) || headerStr.includes(monthNamesShort[idx])) {
            columnMonthMap[i] = idx + 1;
          }
        });
      });

      rows.forEach((row, rowIndex) => {
        if (rowIndex < 1) return;

        const name = row[1];
        if (!name || typeof name !== 'string' || name.toUpperCase() === 'NOME' || name.toUpperCase().includes('MILITAR')) return;

        const services: Date[] = [];
        const history: { day: number; month: number; original: string }[] = [];

        for (let i = 2; i < row.length; i++) {
          const cellValue = row[i];
          if (!cellValue) continue;

          if (cellValue instanceof Date) {
            if (!isNaN(cellValue.getTime())) {
              services.push(cellValue);
              history.push({ 
                day: cellValue.getDate(), 
                month: cellValue.getMonth() + 1, 
                original: cellValue.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) 
              });
              continue;
            }
          }

          const cellStr = String(cellValue);
          const parts = cellStr.split(/[,;\s]+/).filter(Boolean);

          parts.forEach(part => {
            let day: number | null = null;
            let month: number | null = null;

            const numericMatch = part.match(/(\d{1,2})\D(\d{1,2})/);
            if (numericMatch) {
              day = parseInt(numericMatch[1]);
              month = parseInt(numericMatch[2]);
            } else {
              const monthNameMatch = part.match(/(\d{1,2})\D([A-Z]{3,})/i);
              if (monthNameMatch) {
                day = parseInt(monthNameMatch[1]);
                const mName = monthNameMatch[2].toUpperCase();
                const mIndex = monthNamesLong.findIndex(m => m.startsWith(mName));
                if (mIndex !== -1) month = mIndex + 1;
                else {
                  const sIndex = monthNamesShort.findIndex(m => m === mName.substring(0,3));
                  if (sIndex !== -1) month = sIndex + 1;
                }
              } else if (/^\d{1,2}$/.test(part) && columnMonthMap[i]) {
                day = parseInt(part);
                month = columnMonthMap[i];
              }
            }

            if (day !== null && month !== null && day >= 1 && day <= 31 && month >= 1 && month <= 12) {
              try {
                const date = new Date(currentYear, month - 1, day);
                if (!isNaN(date.getTime())) {
                  if (!services.some(s => s.getTime() === date.getTime())) {
                    services.push(date);
                    history.push({ day, month, original: part });
                  }
                }
              } catch (e) {
                console.error("Invalid date part:", part);
              }
            }
          });
        }

        const lastService = services.length > 0 
          ? new Date(Math.max(...services.map(d => d.getTime()))) 
          : null;

        parsedData.push({
          name: name.trim(),
          lastService,
          history: history.sort((a, b) => (a.month * 100 + a.day) - (b.month * 100 + b.day)),
          allServices: services.sort((a,b) => a.getTime() - b.getTime()),
          futureExtras: []
        });
      });

      setData(parsedData);
      saveLocalExtrasData(parsedData);
      showToast(`${parsedData.length} militares carregados da planilha Excel!`, 'success');
    };
    reader.readAsBinaryString(file);
  };

  // Filter military personnel based on search term and extra status
  const filteredData = data.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (filterExtraStatus === 'com_futuro') {
      return (s.futureExtras && s.futureExtras.length > 0) || 
        (s.history && s.history.some(h => h.isFuture));
    }
    if (filterExtraStatus === 'sem_futuro') {
      return (!s.futureExtras || s.futureExtras.length === 0) &&
        (!s.history || !s.history.some(h => h.isFuture));
    }
    if (filterExtraStatus === 'sem_registro') {
      return !s.lastService && (!s.history || s.history.length === 0);
    }
    return true;
  });

  const rankingData = [...filteredData].sort((a, b) => {
    if (a.lastService === null && b.lastService === null) return a.name.localeCompare(b.name);
    if (a.lastService === null) return -1;
    if (b.lastService === null) return 1;
    return a.lastService.getTime() - b.lastService.getTime();
  });

  const formatDate = (date: Date | null) => {
    if (!date) return 'Nunca';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getTimeAgo = (date: Date | null) => {
    if (!date) return 'S/ Registro';
    const diff = new Date().getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return 'Futuro'; 
    if (days === 0) return 'Hoje';
    if (days === 1) return 'Ontem';
    return `há ${days} dias`;
  };

  const exportToPDF = () => {
    let tableData = [];
    
    if (activeTab === 'ranking') tableData = rankingData;
    else if (activeTab === 'data') tableData = [...filteredData].sort((a,b) => a.name.localeCompare(b.name));
    else if (activeTab === 'organizador') {
      const selectedList = getSelectedSoldiersOrdered();
      if (selectedList.length === 0) return;

      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Relatorio de Escala Extra - Selecao Organizada', 14, 22);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);
      doc.text(`Total de Militares Selecionados: ${selectedList.length}`, 14, 35);

      const rows = selectedList.map((s, index) => {
        const futureStr = s.futureExtras && s.futureExtras.length > 0 
          ? s.futureExtras.map(f => f.original).join(', ') 
          : 'Nenhum';
        return [
          index + 1,
          s.name,
          formatDate(s.lastService),
          getTimeAgo(s.lastService),
          futureStr
        ];
      });

      autoTable(doc, {
        startY: 45,
        head: [['Ordem', 'Militar', 'Ultimo Servico Extra', 'Tempo Decorrido', 'Extra Agendado']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontStyle: 'bold' },
      });

      doc.save(`Fila_Extras_Militar.pdf`);
      return;
    }
    else if (activeTab === 'pdf' && pdfData) {
      const available = getAvailableSoldiers();
      const doc2 = new jsPDF();
      doc2.setFontSize(18);
      doc2.text(`Disponibilidade para Extra - Dia ${targetDate}`, 14, 22);
      doc2.setFontSize(10);
      doc2.text(`Escala Analisada: ${pdfData.monthYear}`, 14, 30);
      
      const rows = available.map(s => [s.rank, s.name, `Grupo ${s.group}`]);
      autoTable(doc2, {
        startY: 35,
        head: [['Posto/Grad', 'Militar', 'Grupo']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [20, 40, 20] }
      });
      doc2.save(`Disponibilidade_Extra_Dia_${targetDate}.pdf`);
      return;
    }

    if (tableData.length === 0 && !pdfData) return;

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Relatório de Escala Extra Militar', 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Documento: ${fileName || 'Escala Gerada'}`, 14, 30);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 35);

    const rows = tableData.map((s, index) => [
      index + 1,
      s.name,
      formatDate(s.lastService),
      getTimeAgo(s.lastService)
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['Posto', 'Militar', 'Último Serviço', 'Antiguidade']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: [24, 42, 24], textColor: [255, 255, 255], fontStyle: 'bold' },
    });

    doc.save(`Relatorio_Escala.pdf`);
  };

  const getAvailableSoldiers = () => {
    if (!pdfData) return [];
    
    const busySoloGroups = new Set([
      pdfData.assignments.find(a => a.day === targetDate && a.type === 'SOLO')?.dayShift,
      pdfData.assignments.find(a => a.day === targetDate && a.type === 'SOLO')?.nightShift,
      pdfData.assignments.find(a => a.day === targetDate - 1 && a.type === 'SOLO')?.nightShift
    ].filter(Boolean));

    const busyFTGroups = new Set([
      pdfData.assignments.find(a => a.day === targetDate && a.type === 'FT')?.dayShift,
      pdfData.assignments.find(a => a.day === targetDate - 1 && a.type === 'FT')?.dayShift
    ].filter(Boolean));

    const busy24HGroups = new Set([
      pdfData.assignments.find(a => a.day === targetDate && a.type === '24H')?.dayShift,
      pdfData.assignments.find(a => a.day === targetDate - 1 && a.type === '24H')?.dayShift
    ].filter(Boolean));

    const available = pdfData.soldiers
      .filter(s => pdfSubTab === 'GERAL' ? true : s.type === pdfSubTab)
      .filter(s => {
        if (s.type === 'SOLO') return !busySoloGroups.has(s.group);
        if (s.type === 'FT') return !busyFTGroups.has(s.group);
        if (s.type === '24H') return !busy24HGroups.has(s.group);
        if (s.type === 'ADMIN') return true;
        return true;
      })
      .map(s => {
        let isApto = false;
        if (s.type === 'SOLO') {
          isApto = pdfData.assignments.find(a => a.day === targetDate - 1 && a.type === 'SOLO')?.dayShift === s.group;
        } else if (s.type === 'FT') {
          isApto = pdfData.assignments.find(a => a.day === targetDate - 2 && a.type === 'FT')?.dayShift === s.group;
        } else if (s.type === '24H') {
          isApto = pdfData.assignments.find(a => a.day === targetDate - 2 && a.type === '24H')?.dayShift === s.group;
        } else if (s.type === 'ADMIN') {
          isApto = true;
        }

        const normalizedPdfName = cleanName(s.name);
        const excelInfo = data.find(ed => {
          const normalizedExcelName = cleanName(ed.name);
          if (normalizedExcelName === normalizedPdfName || 
              normalizedExcelName.includes(normalizedPdfName) || 
              normalizedPdfName.includes(normalizedExcelName)) return true;
          
          const pdfWords = normalizedPdfName.split(/[\s\.]+/).filter(w => w.length >= 2);
          const excelWords = normalizedExcelName.split(/[\s\.]+/).filter(w => w.length >= 2);
          if (pdfWords.length === 0 || excelWords.length === 0) return false;

          const common = pdfWords.filter(w => excelWords.includes(w));
          if (common.length >= 2) return true;
          if (common.length === 1) {
            const isSignificantMatch = common[0].length >= 4;
            const isSoleWord = pdfWords.length === 1 || excelWords.length === 1;
            if (isSignificantMatch && isSoleWord) return true;
            if (common[0].length >= 5) return true;
          }
          return false;
        });

        return {
          ...s,
          workedDayYesterday: isApto,
          lastExtra: excelInfo?.lastService || null,
          history: excelInfo?.history || [],
          futureExtras: excelInfo?.futureExtras || []
        };
      });

    return available.sort((a, b) => {
      if (a.workedDayYesterday && !b.workedDayYesterday) return -1;
      if (!a.workedDayYesterday && b.workedDayYesterday) return 1;
      
      if (!a.lastExtra && !b.lastExtra) return a.name.localeCompare(b.name);
      if (!a.lastExtra) return -1;
      if (!b.lastExtra) return 1;
      return a.lastExtra.getTime() - b.lastExtra.getTime();
    });
  };

  return (
    <div className="space-y-6">
      {/* Module Title Bar */}
      <div className="bg-white p-6 rounded-2xl border border-line shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <CalendarCheck size={18} />
            </div>
            <h2 className="text-xl font-bold text-ink">
              Gestão de Serviços Extras
            </h2>
          </div>
          <p className="text-xs text-ink/60 mt-1">
            Banco de dados conectado à Planilha Google (API), atribuição automática de extras futuros e fila de prioridade por antiguidade.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Google Sheets API Status Pill */}
          <div className="flex items-center bg-slate-50 border border-line p-1 rounded-xl shadow-2xs">
            <button
              type="button"
              onClick={() => setIsConfigModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="Configurações e status da planilha via API"
            >
              <Database size={14} className={
                apiStatus === 'connected' ? 'text-emerald-600' :
                apiStatus === 'token_needed' ? 'text-amber-600' :
                apiStatus === 'loading' ? 'text-blue-600 animate-pulse' :
                'text-ink/60'
              } />
              <span className="text-ink hidden sm:inline">Planilha API</span>
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                apiStatus === 'connected' ? "bg-emerald-100 text-emerald-800" :
                apiStatus === 'token_needed' ? "bg-amber-100 text-amber-900" :
                apiStatus === 'loading' ? "bg-blue-100 text-blue-800" :
                "bg-slate-200 text-ink/70"
              )}>
                {apiStatus === 'connected' ? 'Conectada' :
                 apiStatus === 'token_needed' ? 'Token Pendente' :
                 apiStatus === 'loading' ? 'Sincronizando...' :
                 'Conectar'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => syncWithGoogleSpreadsheet(true)}
              disabled={apiStatus === 'loading'}
              className="p-1.5 text-ink/50 hover:text-ink hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
              title="Recarregar dados da planilha Google agora"
            >
              <RefreshCw size={13} className={apiStatus === 'loading' ? 'animate-spin text-emerald-900' : ''} />
            </button>
          </div>

          {/* Atribuir Extra Futuro Primary Action Button */}
          <button
            onClick={() => setIsAssignModalOpen(true)}
            disabled={getTargetSoldiersForAssignment().length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-40"
          >
            <CalendarPlus size={15} />
            <span>Atribuir Extra Futuro</span>
            <span className="bg-amber-900/50 text-amber-100 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
              {selectedSoldierNames.length > 0 
                ? `${selectedSoldierNames.length} sel.` 
                : (activeTab === 'pdf' ? `${getAvailableSoldiers().length} aptos` : `${filteredData.length} filt.`)}
            </span>
          </button>

          <label className={cn(
            "flex items-center gap-2 px-3.5 py-2 bg-emerald-950 text-white rounded-xl text-xs font-semibold hover:bg-emerald-900 transition-all cursor-pointer shadow-xs",
            isAnalyzingPdf && "opacity-50 cursor-not-allowed"
          )}>
            <FileText size={14} />
            {isAnalyzingPdf ? "Analisando..." : "Escala PDF"}
            <input type="file" className="hidden" accept=".pdf" onChange={handlePdfUpload} disabled={isAnalyzingPdf} />
          </label>

          <label className="flex items-center gap-2 px-3.5 py-2 bg-white border border-line text-ink rounded-xl text-xs font-semibold hover:bg-slate-50 transition-all cursor-pointer shadow-xs">
            <FileUp size={14} />
            Excel
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
          </label>

          {(data.length > 0 || pdfData) && (
            <button 
              onClick={exportToPDF}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-ink rounded-xl text-xs font-semibold transition-all shadow-2xs cursor-pointer"
            >
              <FileDown size={14} />
              PDF
            </button>
          )}
        </div>
      </div>

      {/* Token Guidance Warning Banner if API_TOKEN is needed */}
      {apiStatus === 'token_needed' && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
            <div className="text-xs">
              <h4 className="font-bold text-amber-950">Planilha Google (API): "API_TOKEN não configurado"</h4>
              <p className="text-amber-900/90 mt-0.5 leading-relaxed">
                A URL da planilha Google está conectada. No entanto, o script no Google Apps Script requer que a propriedade <strong>API_TOKEN</strong> esteja cadastrada nas Propriedades do Script. Suas atribuições de datas futuras estão sendo salvas localmente com total segurança no navegador.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors shrink-0 cursor-pointer shadow-xs"
          >
            Ver Como Configurar
          </button>
        </div>
      )}

      {pdfError && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-start gap-3 shadow-xs">
          <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-red-800">Falha ao Analisar a Escala PDF</h4>
            <p className="text-xs text-red-700 mt-1 whitespace-pre-line">{pdfError}</p>
            <button 
              onClick={() => setPdfError(null)} 
              className="text-xs font-semibold text-red-900 underline mt-3 hover:text-red-950 block cursor-pointer"
            >
              Dispensar aviso
            </button>
          </div>
        </div>
      )}

      {(!data.length && !pdfData) ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "relative border-2 border-dashed border-line rounded-2xl p-12 flex flex-col items-center justify-center transition-all bg-white/40 backdrop-blur-xs",
            isHovering && "border-amber-600 bg-amber-500/5 scale-[1.01]"
          )}
          onDragOver={(e) => { e.preventDefault(); setIsHovering(true); }}
          onDragLeave={() => setIsHovering(false)}
          onDrop={onDrop}
        >
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-xs border border-line mb-4">
            <Database className="text-amber-600" size={32} />
          </div>
          <h2 className="text-lg font-bold text-ink mb-1">Banco de Dados de Serviços Extras</h2>
          <p className="text-center text-ink/60 text-xs max-w-md mb-6 leading-relaxed">
            Sincronize com a planilha Google via API, anexe seu arquivo Excel ou analise a disponibilidade de militares na escala em PDF.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => syncWithGoogleSpreadsheet(true)}
              className="bg-emerald-950 text-white px-5 py-2.5 rounded-xl font-semibold text-xs hover:bg-emerald-900 transition-colors cursor-pointer shadow-xs flex items-center gap-2"
            >
              <RefreshCw size={14} className={apiStatus === 'loading' ? 'animate-spin' : ''} />
              Sincronizar Planilha via API
            </button>
            <label className="bg-amber-600 text-white px-5 py-2.5 rounded-xl font-semibold text-xs hover:bg-amber-700 transition-colors cursor-pointer shadow-xs text-center">
              Anexar Planilha Excel
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
            </label>
            <label className="bg-white border border-line text-ink px-5 py-2.5 rounded-xl font-semibold text-xs hover:bg-slate-50 transition-colors cursor-pointer shadow-xs text-center">
              Anexar Escala PDF
              <input type="file" className="hidden" accept=".pdf" onChange={handlePdfUpload} />
            </label>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {/* Main Navigation Tabs */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex bg-white p-1 rounded-xl border border-line w-full md:w-auto overflow-x-auto gap-1 shadow-xs">
              <button 
                onClick={() => setActiveTab('ranking')}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer",
                  activeTab === 'ranking' ? "bg-emerald-950 text-white shadow-xs" : "text-ink/60 hover:text-ink hover:bg-slate-50"
                )}
              >
                <ArrowUpDown size={14} />
                Antiguidade (Mais tempo sem extra)
              </button>
              <button 
                onClick={() => setActiveTab('pdf')}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer",
                  activeTab === 'pdf' ? "bg-emerald-950 text-white shadow-xs" : "text-ink/60 hover:text-ink hover:bg-slate-50"
                )}
              >
                <Brain size={14} />
                Disponibilidade (PDF)
              </button>
              <button 
                onClick={() => setActiveTab('data')}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer",
                  activeTab === 'data' ? "bg-emerald-950 text-white shadow-xs" : "text-ink/60 hover:text-ink hover:bg-slate-50"
                )}
              >
                <Users size={14} />
                Alfabética
              </button>
              <button 
                onClick={() => setActiveTab('organizador')}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer relative",
                  activeTab === 'organizador' 
                    ? "bg-amber-600 text-white shadow-xs" 
                    : "text-amber-800 bg-amber-500/10 hover:bg-amber-500/20"
                )}
              >
                <CalendarCheck size={14} />
                Organizador de Fila
                {selectedSoldierNames.length > 0 && (
                  <span className="ml-1 bg-amber-900 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                    {selectedSoldierNames.length}
                  </span>
                )}
              </button>
            </div>

            {/* Search Input */}
            {activeTab !== 'pdf' && activeTab !== 'organizador' && (
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" size={16} />
                <input 
                  type="text" 
                  placeholder="Pesquisar militar no filtro..."
                  className="w-full pl-9 pr-4 py-2 bg-white border border-line rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-950/20 text-xs shadow-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Filter Status Bar (Todos, Com Extra Futuro, Sem Extra Futuro, Sem Registro) */}
          {activeTab !== 'pdf' && activeTab !== 'organizador' && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-line shadow-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-ink/50 uppercase mr-1">Filtro de Extra:</span>
                <button
                  onClick={() => setFilterExtraStatus('todos')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                    filterExtraStatus === 'todos' ? "bg-emerald-950 text-white shadow-xs" : "bg-slate-100 text-ink/70 hover:bg-slate-200"
                  )}
                >
                  Todos ({data.length})
                </button>
                <button
                  onClick={() => setFilterExtraStatus('com_futuro')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1",
                    filterExtraStatus === 'com_futuro' ? "bg-amber-600 text-white shadow-xs" : "bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200"
                  )}
                >
                  <CalendarPlus size={12} />
                  Com Extra Futuro ({data.filter(s => (s.futureExtras && s.futureExtras.length > 0) || (s.history && s.history.some(h => h.isFuture))).length})
                </button>
                <button
                  onClick={() => setFilterExtraStatus('sem_futuro')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                    filterExtraStatus === 'sem_futuro' ? "bg-emerald-950 text-white shadow-xs" : "bg-slate-100 text-ink/70 hover:bg-slate-200"
                  )}
                >
                  Sem Extra Futuro ({data.filter(s => (!s.futureExtras || s.futureExtras.length === 0) && (!s.history || !s.history.some(h => h.isFuture))).length})
                </button>
                <button
                  onClick={() => setFilterExtraStatus('sem_registro')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                    filterExtraStatus === 'sem_registro' ? "bg-emerald-950 text-white shadow-xs" : "bg-slate-100 text-ink/70 hover:bg-slate-200"
                  )}
                >
                  Sem Registro ({data.filter(s => !s.lastService && (!s.history || s.history.length === 0)).length})
                </button>
              </div>

              {/* Action trigger for current filtered items */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAssignModalOpen(true)}
                  disabled={getTargetSoldiersForAssignment().length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-40"
                >
                  <CalendarPlus size={14} />
                  <span>Atribuir Extra Futuro</span>
                  <span className="bg-amber-900/60 text-amber-100 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                    {selectedSoldierNames.length > 0 ? `${selectedSoldierNames.length} sel.` : `${filteredData.length} filtrados`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'pdf' ? (
            <div className="space-y-6">
              {isAnalyzingPdf ? (
                <div className="p-16 border border-dashed border-line rounded-2xl flex flex-col items-center justify-center bg-white shadow-xs">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="mb-4 text-emerald-950"
                  >
                    <Brain size={44} />
                  </motion.div>
                  <p className="text-ink font-bold text-sm">Analisando Escala PDF...</p>
                  <p className="text-xs opacity-50 mt-1">Extraindo escalas Solo, FT e 24h</p>
                </div>
              ) : !pdfData ? (
                <div className="p-12 border border-dashed border-line rounded-2xl flex flex-col items-center justify-center bg-white shadow-xs">
                  <FileText size={44} className="text-emerald-950/30 mb-3" />
                  <p className="text-ink font-bold text-sm">Nenhuma escala PDF carregada.</p>
                  <p className="text-xs text-ink/50 mt-1 text-center max-w-sm">
                    Arraste o arquivo da escala mensal em PDF ou use o botão no topo para analisar.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-xs border border-line">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-950 mb-4 flex items-center gap-2">
                        <Calendar size={15} />
                        Calendário {pdfData.monthYear}
                      </h3>
                      <div className="grid grid-cols-7 gap-1 text-center mb-2">
                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => (
                          <span key={d} className="text-[10px] font-bold opacity-30">{d}</span>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={`empty-${i}`} className="h-9" />
                        ))}
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                          <button
                            key={d}
                            onClick={() => setTargetDate(d)}
                            className={cn(
                              "h-9 rounded-lg text-xs font-mono transition-all relative overflow-hidden cursor-pointer",
                              targetDate === d ? "bg-emerald-950 text-white shadow-md z-10 scale-105 font-bold" : "hover:bg-slate-100",
                              (d + 5) % 7 === 0 || (d + 5) % 7 === 1 ? "opacity-90 font-bold" : ""
                            )}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                      <div className="mt-6 pt-5 border-t border-line">
                        <div className="flex justify-between items-center text-xs mb-2">
                          <span className="opacity-60">Status do Dia {targetDate}:</span>
                          <span className="font-bold text-emerald-950">{pdfData.monthYear}</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                            <span className="text-[10px] font-bold uppercase text-emerald-800">Serviço Dia:</span>
                            <span className="font-mono font-bold text-emerald-900">
                              Grupo {pdfData.assignments.find(a => a.day === targetDate)?.dayShift || '?'}
                            </span>
                          </div>
                          <div className="flex justify-between bg-blue-50 p-2 rounded-lg border border-blue-100">
                            <span className="text-[10px] font-bold uppercase text-blue-800">Serviço Noite:</span>
                            <span className="font-mono font-bold text-blue-900">
                              Grupo {pdfData.assignments.find(a => a.day === targetDate)?.nightShift || '?'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-4">
                    <div className="bg-emerald-950/5 border border-emerald-950/10 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="text-emerald-900 shrink-0" size={20} />
                        <div>
                          <p className="text-xs font-bold text-emerald-950 uppercase">
                            Aptos para o Serviço Extra — Dia {targetDate}
                          </p>
                          <p className="text-[10px] opacity-60">Militares que cumpriram o descanso regulamentar.</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
                        <button
                          onClick={handleSelectAllVisible}
                          className="px-3 py-1.5 bg-white border border-emerald-900/20 text-emerald-900 rounded-lg text-xs font-semibold hover:bg-emerald-50 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <CheckSquare size={13} />
                          Selecionar Todos Aptos
                        </button>
                        <button
                          onClick={() => setIsAssignModalOpen(true)}
                          className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <CalendarPlus size={13} />
                          Atribuir Extra Futuro ({selectedSoldierNames.length > 0 ? selectedSoldierNames.length : getAvailableSoldiers().length})
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-line shadow-xs">
                      <div className="flex gap-1 overflow-x-auto">
                        {(['GERAL', 'SOLO', 'FT', '24H', 'ADMIN'] as const).map(tab => (
                          <button 
                            key={tab}
                            onClick={() => setPdfSubTab(tab)}
                            className={cn(
                              "px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer",
                              pdfSubTab === tab ? "bg-emerald-950 text-white shadow-xs" : "opacity-60 hover:opacity-100"
                            )}
                          >
                            {tab === 'GERAL' ? 'VISÃO GERAL' : tab === 'SOLO' ? 'ESCALA SOLO (12H)' : tab === 'FT' ? 'FORÇA TÁTICA' : tab === '24H' ? 'SERVIÇO (24H)' : 'ADM BATALHÃO'}
                          </button>
                        ))}
                      </div>
                      <span className="px-2.5 py-0.5 bg-emerald-950 text-white rounded-full text-[11px] font-mono">
                        {getAvailableSoldiers().length} pronto(s)
                      </span>
                    </div>
                    
                    <div className="grid gap-2">
                      {getAvailableSoldiers().map((s, i) => {
                        const isSelected = selectedSoldierNames.some(p => cleanName(p) === cleanName(s.name));
                        const hasFuture = s.futureExtras && s.futureExtras.length > 0;
                        return (
                          <div 
                            key={i} 
                            onClick={() => toggleSelectSoldier(s.name)}
                            className={cn(
                              "flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer shadow-xs",
                              isSelected 
                                ? "border-amber-400 bg-amber-50/80 hover:bg-amber-100/90" 
                                : "bg-white border-line/60 hover:border-emerald-900/60 hover:bg-slate-50/70 group"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleSelectSoldier(s.name);
                                }}
                                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500/20 border-line cursor-pointer"
                              />
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold font-mono transition-colors",
                                isSelected 
                                  ? "bg-amber-100 text-amber-900" 
                                  : "bg-emerald-50 text-emerald-900 group-hover:bg-emerald-950 group-hover:text-white"
                              )}>
                                {s.group}
                              </div>
                              <div>
                                <p className="text-xs font-bold leading-none capitalize text-ink">{s.rank} {s.name.toLowerCase()}</p>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                  {s.workedDayYesterday && (
                                    <span className="px-1.5 py-0.5 bg-emerald-950 text-white rounded text-[8px] font-bold">APTO EXTRA</span>
                                  )}
                                  <p className="text-[10px] opacity-50 font-mono">
                                    {s.type === 'FT' ? 'Força Tática' : s.type === '24H' ? 'Serviço 24h' : s.type === 'ADMIN' ? 'Adm Batalhão' : 'Escala Solo'}
                                  </p>
                                  {hasFuture && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded text-[9px] font-bold border border-amber-300">
                                      <CalendarPlus size={9} />
                                      Agendado: {s.futureExtras![0].original}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {s.lastExtra ? (
                                <span className={cn(
                                  "text-[9px] font-mono px-2 py-0.5 rounded-full border",
                                  isSelected 
                                    ? "text-amber-800 bg-amber-100 border-amber-200" 
                                    : "text-amber-700 bg-amber-50 border-amber-100"
                                )}>
                                  Último: {formatDate(s.lastExtra)}
                                </span>
                              ) : (
                                <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                  Sem Extra Registrado
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'organizador' ? (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-line shadow-xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-600/10 flex items-center justify-center text-amber-600">
                        <ListOrdered size={18} />
                      </div>
                      <h3 className="text-lg font-bold text-amber-950">
                        Fila de Extra Selecionada & Prioridades
                      </h3>
                    </div>
                    <p className="text-xs text-ink/70 mt-1">
                      Militares organizados automaticamente por tempo decorrido do último extra — <strong>do maior tempo (maior prioridade) para o menor</strong>.
                    </p>
                  </div>

                  {getSelectedSoldiersOrdered().length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setIsAssignModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-all shadow-xs cursor-pointer"
                      >
                        <CalendarPlus size={14} />
                        Atribuir Data Futura ({getSelectedSoldiersOrdered().length})
                      </button>
                      <button
                        onClick={copySelectedListToClipboard}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-ink rounded-xl text-xs font-semibold hover:bg-slate-200 transition-all shadow-2xs cursor-pointer"
                      >
                        <Copy size={14} />
                        Copiar Lista
                      </button>
                      <button
                        onClick={exportToPDF}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-950 text-white rounded-xl text-xs font-semibold hover:bg-emerald-900 transition-all shadow-xs cursor-pointer"
                      >
                        <FileDown size={14} />
                        Exportar PDF
                      </button>
                      <button
                        onClick={() => setSelectedSoldierNames([])}
                        className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-medium hover:bg-red-100 transition-all shadow-xs cursor-pointer"
                      >
                        <Trash2 size={14} />
                        Limpar Seleção
                      </button>
                    </div>
                  )}
                </div>

                {getSelectedSoldiersOrdered().length > 0 ? (
                  <div className="mt-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-amber-50/50 rounded-xl border border-amber-200/60 text-xs">
                      <div className="flex items-center justify-between sm:justify-start sm:gap-2">
                        <span className="text-ink/60 font-medium">Total Selecionados:</span>
                        <span className="font-bold text-amber-900 font-mono">{getSelectedSoldiersOrdered().length}</span>
                      </div>
                      <div className="flex items-center justify-between sm:justify-start sm:gap-2">
                        <span className="text-ink/60 font-medium">Sem Extra (Prioridade 1):</span>
                        <span className="font-bold text-emerald-800 font-mono">{getSelectedSoldiersOrdered().filter(s => s.lastService === null).length}</span>
                      </div>
                      <div className="flex items-center justify-between sm:justify-start sm:gap-2">
                        <span className="text-ink/60 font-medium">Com Histórico de Extra:</span>
                        <span className="font-bold text-amber-800 font-mono">{getSelectedSoldiersOrdered().filter(s => s.lastService !== null).length}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-3 text-[11px] font-bold text-ink/50 uppercase tracking-wider">
                      <span>Ordem & Militar</span>
                      <span className="text-right">Tempo Decorrido / Extra Agendado</span>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                      {getSelectedSoldiersOrdered().map((soldier, idx) => {
                        const hasFuture = soldier.futureExtras && soldier.futureExtras.length > 0;
                        return (
                          <div
                            key={soldier.name}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-amber-200 bg-amber-500/5 hover:bg-amber-500/10 transition-all shadow-xs gap-3"
                          >
                            <div className="flex items-center gap-3.5">
                              <span className="w-8 h-8 rounded-full bg-amber-600 text-white text-xs font-black flex items-center justify-center font-mono shrink-0 shadow-2xs">
                                {idx + 1}º
                              </span>
                              <div>
                                <h4 className="font-bold text-ink text-sm uppercase leading-tight">{soldier.name}</h4>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  {soldier.history && soldier.history.length > 0 ? (
                                    <span className="text-[10px] text-ink/50 font-mono">
                                      Escalas: {soldier.history.map(h => h.original).slice(-3).join(', ')}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-emerald-700 font-medium">
                                      🌟 Prioridade Máxima na Fila
                                    </span>
                                  )}
                                  {hasFuture && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 text-amber-950 border border-amber-300">
                                      <CalendarPlus size={11} className="text-amber-800" />
                                      Extra Futuro: {soldier.futureExtras![0].original}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-amber-200/50">
                              <div className="text-left sm:text-right">
                                <div className={cn(
                                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold tracking-tight",
                                  !soldier.lastService 
                                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300" 
                                    : "bg-amber-100 text-amber-950 border border-amber-300"
                                )}>
                                  <Clock size={13} className={!soldier.lastService ? "text-emerald-700" : "text-amber-700"} />
                                  {getTimeAgo(soldier.lastService)}
                                </div>
                                <p className="text-[10px] text-ink/50 mt-1 font-mono">
                                  Data do último extra: <strong className="text-ink/80">{formatDate(soldier.lastService)}</strong>
                                </p>
                              </div>
                              
                              <button
                                onClick={() => toggleSelectSoldier(soldier.rawName)}
                                title="Remover militar da lista"
                                className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-all cursor-pointer shrink-0"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-center rounded-xl bg-amber-500/5 border border-dashed border-amber-300 mt-4">
                    <CalendarCheck size={44} className="mx-auto text-amber-600/40 mb-3" />
                    <h4 className="text-base font-bold text-amber-950">Nenhum militar selecionado</h4>
                    <p className="text-xs text-amber-900/70 max-w-md mx-auto mt-2 leading-relaxed">
                      Navegue pelas abas <strong>"Antiguidade"</strong>, <strong>"Alfabética"</strong> ou <strong>"Disponibilidade (PDF)"</strong> e marque os militares que deseja organizar ou atribuir datas futuras de escala extra.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {/* Select All / Batch Control Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-3 rounded-xl border border-line shadow-xs gap-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={selectedSoldierNames.length === (activeTab === 'ranking' ? rankingData.length : filteredData.length) && rankingData.length > 0 ? handleDeselectAllVisible : handleSelectAllVisible}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-line rounded-lg text-xs font-semibold text-ink hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    <CheckSquare size={14} className="text-emerald-900" />
                    {selectedSoldierNames.length > 0 ? "Selecionar Todos" : "Selecionar Todos Visíveis"}
                  </button>

                  {selectedSoldierNames.length > 0 && (
                    <button
                      onClick={handleDeselectAllVisible}
                      className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 transition-colors cursor-pointer"
                    >
                      Limpar Seleção
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span className="text-xs text-ink/60 font-mono">
                    <strong>{selectedSoldierNames.length}</strong> selecionado(s) de <strong>{filteredData.length}</strong> no filtro
                  </span>

                  <button
                    onClick={() => setIsAssignModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-all shadow-xs cursor-pointer"
                  >
                    <CalendarPlus size={13} />
                    Atribuir Data Futura
                  </button>

                  {selectedSoldierNames.length > 0 && (
                    <button
                      onClick={() => setActiveTab('organizador')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950 text-white rounded-lg text-xs font-semibold hover:bg-emerald-900 transition-all shadow-xs cursor-pointer"
                    >
                      <ListOrdered size={13} />
                      Ver Fila ({selectedSoldierNames.length})
                    </button>
                  )}
                </div>
              </div>

              {/* Table Column Headers */}
              <div className="flex items-center justify-between px-4 mb-1 text-[11px] font-bold text-ink/50 uppercase tracking-wider">
                <span>Militar & Extras</span>
                <span className="hidden md:block">Histórico de Escalas</span>
                <span>Tempo Decorrido</span>
              </div>
              
              {/* Soldier List Items */}
              <AnimatePresence mode="popLayout">
                {(activeTab === 'ranking' ? rankingData : [...filteredData].sort((a,b) => a.name.localeCompare(b.name))).map((soldier, idx) => {
                  const isSelected = selectedSoldierNames.some(p => cleanName(p) === cleanName(soldier.name));
                  const hasFuture = soldier.futureExtras && soldier.futureExtras.length > 0;
                  return (
                    <motion.div
                      layout
                      key={soldier.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(idx * 0.01, 0.2) }}
                      onClick={() => toggleSelectSoldier(soldier.name)}
                      className={cn(
                        "p-4 rounded-xl flex items-center justify-between transition-all cursor-pointer shadow-xs border",
                        isSelected
                          ? "border-amber-400 bg-amber-50/70 hover:bg-amber-100"
                          : "bg-white border-line/60 hover:border-emerald-950 hover:bg-emerald-50/20 group"
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelectSoldier(soldier.name);
                          }}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500/20 border-line cursor-pointer"
                        />
                        <div className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-colors shrink-0",
                          isSelected 
                            ? "bg-amber-100 text-amber-900" 
                            : "bg-slate-100 text-slate-800 group-hover:bg-emerald-950 group-hover:text-white"
                        )}>
                          {idx + 1}
                        </div>
                        <div className="max-w-[200px] md:max-w-none">
                          <h3 className="font-bold tracking-tight text-xs sm:text-sm truncate md:whitespace-normal">{soldier.name}</h3>
                          
                          {/* Future Extra Badge */}
                          {hasFuture ? (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-950 border border-amber-300">
                                <CalendarPlus size={11} className="text-amber-700" />
                                Extra Futuro: {soldier.futureExtras![0].original}
                                {soldier.futureExtras!.length > 1 && ` (+${soldier.futureExtras!.length - 1})`}
                              </span>
                            </div>
                          ) : (
                            <div className="flex md:hidden text-[10px] opacity-60 font-mono mt-0.5">
                              {getTimeAgo(soldier.lastService)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* History tags */}
                      <div className="hidden md:flex flex-1 items-center gap-2 overflow-hidden px-4">
                        {soldier.history.length > 0 ? (
                          <>
                            {soldier.history.slice(-4).map((h, i) => (
                              <span key={i} className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-mono",
                                h.isFuture 
                                  ? "bg-amber-100 text-amber-900 border border-amber-300 font-bold" 
                                  : "bg-slate-100 text-slate-700"
                              )}>
                                {h.original}
                              </span>
                            ))}
                            {soldier.history.length > 4 && <span className="text-[10px] opacity-40">+{soldier.history.length - 4}</span>}
                          </>
                        ) : (
                          <span className="text-[10px] opacity-30 italic">Sem registros anteriores</span>
                        )}
                      </div>

                      {/* Time Ago & Last Service */}
                      <div className="flex flex-col items-end min-w-[140px]">
                        <div className={cn(
                          "flex items-center gap-1.5 font-mono text-xs font-bold",
                          isSelected ? "text-amber-800" : ""
                        )}>
                          <Clock size={12} className={!soldier.lastService ? "text-blue-500" : "text-amber-500"} />
                          {getTimeAgo(soldier.lastService)}
                        </div>
                        <div className="text-[10px] opacity-40 mt-0.5 uppercase font-mono">
                          Última: {formatDate(soldier.lastService)}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {filteredData.length === 0 && !isAnalyzingPdf && (
                <div className="flex flex-col items-center justify-center p-16 text-ink/40 italic bg-white rounded-2xl border border-line">
                  <AlertCircle size={40} className="mb-3 opacity-30" />
                  <p className="text-xs">Nenhum militar encontrado com os filtros aplicados.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Floating Bottom Action Bar */}
      <AnimatePresence>
        {selectedSoldierNames.length > 0 && activeTab !== 'organizador' && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-emerald-950 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-800/60 max-w-[94vw]"
          >
            <div className="flex items-center gap-2 pr-2 border-r border-white/20">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center">
                {selectedSoldierNames.length}
              </span>
              <span className="text-xs font-medium hidden sm:inline">militar(es) selecionado(s)</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAssignModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <CalendarPlus size={14} />
                <span>Atribuir Extra ({selectedSoldierNames.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('organizador')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                <ListOrdered size={14} />
                <span className="hidden sm:inline">Ver Fila</span>
              </button>

              <button
                onClick={copySelectedListToClipboard}
                title="Copiar lista para WhatsApp"
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium transition-all cursor-pointer"
              >
                <Copy size={14} />
              </button>

              <button
                onClick={() => setSelectedSoldierNames([])}
                title="Limpar seleção"
                className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Copy Notification Toast */}
      <AnimatePresence>
        {copiedNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-50 bg-emerald-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 border border-emerald-700 text-xs font-semibold"
          >
            <Check size={16} className="text-emerald-300" />
            <span>Lista formatada copiada com sucesso para o WhatsApp!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Notification Toast (Success / Warning / Error) */}
      <AnimatePresence>
        {toastNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={cn(
              "fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl flex items-start gap-2.5 text-xs font-medium max-w-md border",
              toastNotification.type === 'success' && "bg-emerald-900 text-white border-emerald-700",
              toastNotification.type === 'warning' && "bg-amber-900 text-white border-amber-700",
              toastNotification.type === 'error' && "bg-red-900 text-white border-red-700"
            )}
          >
            {toastNotification.type === 'success' ? (
              <Check size={16} className="text-emerald-300 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="text-amber-300 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-bold">
                {toastNotification.type === 'success' ? "Sucesso!" : toastNotification.type === 'warning' ? "Aviso da Planilha" : "Erro"}
              </p>
              <p className="mt-0.5 opacity-90">{toastNotification.message}</p>
            </div>
            <button 
              onClick={() => setToastNotification(null)}
              className="text-white/60 hover:text-white p-0.5 cursor-pointer"
            >
              <Check size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Google Sheets API Config Modal */}
      <GoogleSheetsConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onSyncSuccess={() => syncWithGoogleSpreadsheet(true)}
        currentStatus={apiStatus}
        statusMessage={apiMessage}
      />

      {/* Atribuir Extra Futuro Modal */}
      <AtribuirExtraFuturoModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        targetSoldiers={getTargetSoldiersForAssignment()}
        onConfirm={handleAssignFutureExtra}
        isSubmitting={isSubmittingExtra}
        filterDescription={
          selectedSoldierNames.length > 0 
            ? `${selectedSoldierNames.length} militar(es) selecionado(s)`
            : (activeTab === 'pdf' 
                ? `${getAvailableSoldiers().length} aptos no dia ${targetDate}` 
                : `${filteredData.length} militar(es) no filtro atual`)
        }
      />
    </div>
  );
};
