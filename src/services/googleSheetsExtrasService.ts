import { SoldierService } from '../types';

export const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyyzWbpJOCSPtGTWfuPG4vQ2xW20H-Tjijlvhix_aHC2hdBY-CHdgKwYXKtl2TAfXIi/exec';

const STORAGE_API_URL_KEY = 'servicos_extras_google_script_url';
const STORAGE_API_TOKEN_KEY = 'servicos_extras_google_script_token';
const STORAGE_LOCAL_DATA_KEY = 'servicos_extras_local_backup_v1';

export interface ApiConfig {
  url: string;
  token: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  isTokenNotConfigured?: boolean;
  isSheetTabMissing?: boolean;
  status?: number;
}

export function getApiConfig(): ApiConfig {
  const url = localStorage.getItem(STORAGE_API_URL_KEY) || DEFAULT_APPS_SCRIPT_URL;
  const token = localStorage.getItem(STORAGE_API_TOKEN_KEY) || '';
  return { url, token };
}

export function saveApiConfig(url: string, token: string): void {
  localStorage.setItem(STORAGE_API_URL_KEY, url.trim() || DEFAULT_APPS_SCRIPT_URL);
  localStorage.setItem(STORAGE_API_TOKEN_KEY, token.trim());
}

/**
 * Normalizes date input (string, number, or Date) to a valid JS Date
 */
export function parseDateFlexible(val: any, defaultYear = new Date().getFullYear()): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;

  const str = String(val).trim();
  if (!str) return null;

  // Format: YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const d = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]), 12, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  // Format: DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmyMatch) {
    const d = new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]), 12, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  // Format: DD/MM
  const dmMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})$/);
  if (dmMatch) {
    const d = new Date(defaultYear, parseInt(dmMatch[2]) - 1, parseInt(dmMatch[1]), 12, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  // Fallback to Date.parse
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Fetches military extras data from the Google Spreadsheet Apps Script endpoint
 */
export async function fetchSpreadsheetData(overrideConfig?: Partial<ApiConfig>): Promise<ApiResponse<SoldierService[]>> {
  const config = { ...getApiConfig(), ...overrideConfig };
  const targetUrl = config.url || DEFAULT_APPS_SCRIPT_URL;

  try {
    // Actions to attempt: the user's script accepts 'get' or 'list' (action 'read' is invalid)
    const candidateActions = ['get', 'list', ''];

  let lastJson: any = null;
  let lastError = '';

  for (const act of candidateActions) {
    try {
      const urlObj = new URL(targetUrl);
      if (act) {
        urlObj.searchParams.set('action', act);
      }
      if (config.token) {
        urlObj.searchParams.set('token', config.token);
        urlObj.searchParams.set('api_token', config.token);
        urlObj.searchParams.set('key', config.token);
      }

      const response = await fetch(urlObj.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json, text/plain, */*'
        }
      });

      const text = await response.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        lastError = `Resposta da API não é JSON: ${text.slice(0, 100)}`;
        continue;
      }

      lastJson = json;

      // If token not configured
      if (json.error === 'API_TOKEN não configurado.' || (json.error && json.error.toLowerCase().includes('api_token não configurado'))) {
        return {
          success: false,
          error: 'API_TOKEN não configurado.',
          isTokenNotConfigured: true,
          message: 'A propriedade "API_TOKEN" não está definida no Google Apps Script associado à planilha.'
        };
      }

      // If sheet tab "Efetivo" is missing in Google Spreadsheet
      if (json.error && json.error.toLowerCase().includes('efetivo')) {
        return {
          success: false,
          error: 'A aba "Efetivo" não foi encontrada na sua planilha Google.',
          isSheetTabMissing: true,
          message: 'Token aceito pelo script! Porém, a sua planilha precisa ter uma aba (página) chamada "Efetivo". Renomeie a aba principal da planilha para "Efetivo" para carregar e sincronizar.'
        };
      }

      // If invalid action, try next action
      if (json.error && json.error.toLowerCase().includes('ação inválida')) {
        continue;
      }

      if (json.success === false && json.error) {
        return {
          success: false,
          error: json.error,
          isTokenNotConfigured: json.error.toLowerCase().includes('token')
        };
      }

      // We got a successful response or a data list!
      break;
    } catch (fetchErr: any) {
      lastError = fetchErr.message || 'Falha de conexão com a API da planilha.';
    }
  }

  if (!lastJson) {
    return {
      success: false,
      error: lastError || 'Não foi possível obter resposta válida da API do Google Sheets.'
    };
  }

  if (lastJson.error && lastJson.error.toLowerCase().includes('efetivo')) {
    return {
      success: false,
      error: 'A aba "Efetivo" não foi encontrada na sua planilha Google.',
      isSheetTabMissing: true,
      message: 'Token aceito com sucesso! Para carregar e salvar dados, sua planilha Google precisa de uma aba (página) chamada "Efetivo". Renomeie a aba principal para "Efetivo".'
    };
  }

  const json = lastJson;

  // Extract list of soldiers/rows from response
  // The sheet API might return: { success: true, data: [...] } or array directly or { rows: [...] } or { soldiers: [...] }
  let rawList: any[] = [];
  if (Array.isArray(json)) {
    rawList = json;
  } else if (Array.isArray(json.data)) {
    rawList = json.data;
  } else if (Array.isArray(json.rows)) {
    rawList = json.rows;
  } else if (Array.isArray(json.soldiers)) {
    rawList = json.soldiers;
  } else if (Array.isArray(json.items)) {
    rawList = json.items;
  } else if (Array.isArray(json.militares)) {
    rawList = json.militares;
  }

  // Handle array of arrays if first row is header
  if (rawList.length > 1 && Array.isArray(rawList[0]) && typeof rawList[0][0] === 'string') {
    const headers = rawList[0].map((h: any) => String(h).trim().toLowerCase());
    const nameIdx = headers.findIndex((h: string) => h.includes('nome') || h.includes('militar') || h.includes('soldado'));
    
    if (nameIdx !== -1) {
      rawList = rawList.slice(1).map(row => {
        if (!Array.isArray(row)) return row;
        const obj: any = { name: row[nameIdx], services: [] };
        row.forEach((cell: any, idx: number) => {
          if (idx !== nameIdx && cell) {
            obj.services.push(cell);
          }
        });
        return obj;
      });
    }
  }

    const currentYear = new Date().getFullYear();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parsedSoldiers: SoldierService[] = rawList.map((item: any) => {
      const name = String(item.name || item.nome || item.militar || item[0] || '').trim();
      const rawServices = item.services || item.servicos || item.extras || item.datas || item.history || [];
      
      const parsedDates: Date[] = [];
      const historyItems: { day: number; month: number; original: string; year?: number; isFuture?: boolean }[] = [];
      const futureExtras: { date: Date; original: string; note?: string }[] = [];

      if (Array.isArray(rawServices)) {
        rawServices.forEach((s: any) => {
          const d = parseDateFlexible(s.date || s.data || s);
          if (d) {
            parsedDates.push(d);
            const isFuture = d.getTime() > today.getTime();
            const originalStr = s.original || d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            
            historyItems.push({
              day: d.getDate(),
              month: d.getMonth() + 1,
              year: d.getFullYear(),
              original: originalStr,
              isFuture
            });

            if (isFuture) {
              futureExtras.push({
                date: d,
                original: originalStr,
                note: s.note || s.observacao || 'Extra Futuro'
              });
            }
          }
        });
      }

      // Also check if single lastService or lastExtra is provided
      if (item.lastService || item.ultimoServico || item.ultimoExtra) {
        const lastD = parseDateFlexible(item.lastService || item.ultimoServico || item.ultimoExtra);
        if (lastD && !parsedDates.some(p => p.getTime() === lastD.getTime())) {
          parsedDates.push(lastD);
          const isFuture = lastD.getTime() > today.getTime();
          historyItems.push({
            day: lastD.getDate(),
            month: lastD.getMonth() + 1,
            year: lastD.getFullYear(),
            original: lastD.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            isFuture
          });
        }
      }

      // Sort dates
      parsedDates.sort((a, b) => a.getTime() - b.getTime());

      // Only consider past services for lastService calculation
      const pastDates = parsedDates.filter(d => d.getTime() <= today.getTime() + 86400000);
      const lastService = pastDates.length > 0 
        ? new Date(Math.max(...pastDates.map(d => d.getTime())))
        : null;

      return {
        name,
        lastService,
        history: historyItems.sort((a, b) => (a.month * 100 + a.day) - (b.month * 100 + b.day)),
        allServices: parsedDates,
        futureExtras: futureExtras.sort((a, b) => a.date.getTime() - b.date.getTime())
      };
    }).filter(s => s.name.length > 0);

    return {
      success: true,
      data: parsedSoldiers,
      message: `${parsedSoldiers.length} militares carregados da planilha via API.`
    };
  } catch (err: any) {
    console.error('fetchSpreadsheetData error:', err);
    return {
      success: false,
      error: err.message || 'Falha de conexão com a API da planilha.'
    };
  }
}

/**
 * Assigns a future extra duty date to filtered/selected military personnel
 * and automatically posts it to the Google Spreadsheet API endpoint
 */
export async function addFutureExtraToSpreadsheet(
  soldiers: { name: string; rank?: string }[],
  futureDate: Date,
  note = 'Serviço Extra Agendado'
): Promise<ApiResponse> {
  if (soldiers.length === 0) {
    return { success: false, error: 'Nenhum militar informado para atribuição.' };
  }

  const config = getApiConfig();
  const targetUrl = config.url || DEFAULT_APPS_SCRIPT_URL;

  const day = String(futureDate.getDate()).padStart(2, '0');
  const month = String(futureDate.getMonth() + 1).padStart(2, '0');
  const year = futureDate.getFullYear();
  const formattedDate = `${day}/${month}/${year}`;
  const isoDate = `${year}-${month}-${day}`;

  const payload = {
    action: 'create',
    actionType: 'create',
    date: isoDate,
    dataExtra: formattedDate,
    data: isoDate,
    observacao: note,
    token: config.token || undefined,
    api_token: config.token || undefined,
    militares: soldiers.map(s => ({
      nome: s.name,
      posto: s.rank || '',
      dataExtra: formattedDate,
      data: isoDate,
      observacao: note
    })),
    soldiers: soldiers.map(s => s.name),
    names: soldiers.map(s => s.name),
    nome: soldiers.map(s => s.name).join(', '),
    militar: soldiers.map(s => s.name).join(', ')
  };

  try {
    // Try POST with action=create in query string and payload
    const urlObj = new URL(targetUrl);
    urlObj.searchParams.set('action', 'create');
    if (config.token) {
      urlObj.searchParams.set('token', config.token);
      urlObj.searchParams.set('api_token', config.token);
    }

    const response = await fetch(urlObj.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        'Accept': 'application/json, text/plain, */*'
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Non-JSON response
      return {
        success: true,
        message: `Dados enviados para a planilha (${soldiers.length} militares para ${formattedDate}). Resposta: ${text.slice(0, 100)}`
      };
    }

    if (json.error === 'API_TOKEN não configurado.' || (json.error && json.error.toLowerCase().includes('api_token não configurado'))) {
      return {
        success: false,
        isTokenNotConfigured: true,
        error: 'API_TOKEN não configurado.',
        message: 'A atribuição foi salva localmente no aplicativo, mas o script da planilha Google precisa do API_TOKEN configurado em suas propriedades para persistir na nuvem.'
      };
    }

    if (json.error && json.error.toLowerCase().includes('efetivo')) {
      return {
        success: false,
        isSheetTabMissing: true,
        error: 'A aba "Efetivo" não foi encontrada na sua planilha Google.',
        message: 'A atribuição foi salva localmente! Para que seja gravada na planilha Google, renomeie a aba principal da planilha para "Efetivo".'
      };
    }

    if (json.success === false && json.error) {
      return {
        success: false,
        error: json.error,
        isTokenNotConfigured: json.error.toLowerCase().includes('token')
      };
    }

    return {
      success: true,
      data: json,
      message: `Data futura (${formattedDate}) gravada na planilha Google com sucesso para ${soldiers.length} militares!`
    };
  } catch (err: any) {
    console.warn('Erro ao conectar com API do Google Sheets:', err);
    return {
      success: false,
      error: err.message || 'Erro de rede ao comunicar com o Google Apps Script.'
    };
  }
}

/**
 * Local storage caching helpers
 */
export function loadLocalExtrasData(): SoldierService[] {
  try {
    const raw = localStorage.getItem(STORAGE_LOCAL_DATA_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: any) => ({
      ...item,
      lastService: item.lastService ? new Date(item.lastService) : null,
      allServices: (item.allServices || []).map((d: string) => new Date(d)),
      futureExtras: (item.futureExtras || []).map((f: any) => ({
        ...f,
        date: new Date(f.date)
      }))
    }));
  } catch {
    return [];
  }
}

export function saveLocalExtrasData(data: SoldierService[]): void {
  try {
    localStorage.setItem(STORAGE_LOCAL_DATA_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('saveLocalExtrasData failed:', err);
  }
}

/**
 * Updates a list of SoldierService by recording a future extra for the specified soldiers
 */
export function recordFutureExtraLocal(
  currentData: SoldierService[],
  soldierNames: string[],
  futureDate: Date,
  note = 'Serviço Extra Agendado'
): SoldierService[] {
  const day = futureDate.getDate();
  const month = futureDate.getMonth() + 1;
  const year = futureDate.getFullYear();
  const formattedStr = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;

  const cleanNamesSet = new Set(soldierNames.map(n => n.toUpperCase().trim()));

  // Clone and update
  const updated = currentData.map(soldier => {
    const cleanS = soldier.name.toUpperCase().trim();
    const isTarget = cleanNamesSet.has(cleanS) || 
      Array.from(cleanNamesSet).some(target => cleanS.includes(target) || target.includes(cleanS));

    if (!isTarget) return soldier;

    const existingFuture = soldier.futureExtras || [];
    const alreadyHasDate = existingFuture.some(f => f.original === formattedStr || 
      (f.date.getFullYear() === year && f.date.getMonth() + 1 === month && f.date.getDate() === day));

    const newFutureList = alreadyHasDate 
      ? existingFuture 
      : [...existingFuture, { date: futureDate, original: formattedStr, note }];

    const existingHistory = soldier.history || [];
    const newHistory = existingHistory.some(h => h.original === formattedStr || (h.day === day && h.month === month))
      ? existingHistory
      : [...existingHistory, { day, month, year, original: formattedStr, isFuture: true }];

    const allServices = [...(soldier.allServices || [])];
    if (!allServices.some(d => d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day)) {
      allServices.push(futureDate);
      allServices.sort((a, b) => a.getTime() - b.getTime());
    }

    return {
      ...soldier,
      history: newHistory,
      allServices,
      futureExtras: newFutureList.sort((a, b) => a.date.getTime() - b.date.getTime())
    };
  });

  saveLocalExtrasData(updated);
  return updated;
}
