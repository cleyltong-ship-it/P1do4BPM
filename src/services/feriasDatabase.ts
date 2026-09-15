import { PrevisaoFerias, MesAno, EfetivoMilitar, PostoGraduacao } from '../types';
import { MESES_DO_ANO } from './feriasFileParser';

const FERIAS_STORAGE_KEY = 'efetivo_previsao_ferias_v1';

/**
 * Generate sensible default vacation distribution based on military personnel
 */
export function generateDefaultFerias(efetivo: EfetivoMilitar[]): PrevisaoFerias[] {
  const currentYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth(); // 0 to 11
  const result: PrevisaoFerias[] = [];

  if (!efetivo || efetivo.length === 0) return [];

  // Distribute soldiers across months proportionally
  efetivo.forEach((m, idx) => {
    // Determine month based on index or existing status
    const monthIndex = idx % 12;
    const mes = MESES_DO_ANO[monthIndex];

    const isCurrentlyInFerias = (m.situacao || '').toLowerCase().includes('férias') || (m.situacao || '').toLowerCase().includes('ferias');
    const isPastMonth = monthIndex < currentMonthIndex;
    const isCurrentMonth = monthIndex === currentMonthIndex;

    let situacao: PrevisaoFerias['situacao'] = 'Prevista';
    if (isCurrentlyInFerias || isCurrentMonth) {
      situacao = 'Em Gozo';
    } else if (isPastMonth) {
      situacao = 'Concluída';
    }

    result.push({
      id: `FERIAS-${m.matricula}-${currentYear}-${idx + 1}`,
      matricula: m.matricula,
      nome: m.nomeCompleto,
      nomeGuerra: m.nomeGuerra,
      posto: m.postoGraduacao,
      ano: currentYear,
      mesPrevisto: isCurrentlyInFerias ? MESES_DO_ANO[currentMonthIndex] : mes,
      periodoDias: 30,
      dataInicio: `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-01`,
      dataFim: `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-30`,
      situacao,
      observacao: idx % 4 === 0 ? 'Período regular regulamentar' : undefined
    });
  });

  return result;
}

/**
 * Get all vacation records from localStorage
 */
export function getPrevisaoFerias(efetivoRef: EfetivoMilitar[] = []): PrevisaoFerias[] {
  try {
    const raw = localStorage.getItem(FERIAS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading ferias from localStorage:', e);
  }

  // If not stored yet, initialize defaults from current efetivo
  const defaults = generateDefaultFerias(efetivoRef);
  savePrevisaoFerias(defaults);
  return defaults;
}

/**
 * Save vacation records to localStorage
 */
export function savePrevisaoFerias(records: PrevisaoFerias[]): void {
  try {
    localStorage.setItem(FERIAS_STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Error saving ferias to localStorage:', e);
  }
}

/**
 * Add a new vacation record
 */
export function addPrevisaoFerias(record: Omit<PrevisaoFerias, 'id'>): PrevisaoFerias {
  const all = getPrevisaoFerias();
  const created: PrevisaoFerias = {
    ...record,
    id: `FERIAS-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  };
  const updated = [created, ...all];
  savePrevisaoFerias(updated);
  return created;
}

/**
 * Update an existing vacation record
 */
export function updatePrevisaoFerias(id: string, updates: Partial<PrevisaoFerias>): PrevisaoFerias[] {
  const all = getPrevisaoFerias();
  const updated = all.map(r => r.id === id ? { ...r, ...updates } : r);
  savePrevisaoFerias(updated);
  return updated;
}

/**
 * Delete a vacation record
 */
export function deletePrevisaoFerias(id: string): PrevisaoFerias[] {
  const all = getPrevisaoFerias();
  const updated = all.filter(r => r.id !== id);
  savePrevisaoFerias(updated);
  return updated;
}

/**
 * Replace vacation records with imported list
 */
export function importFeriasReplace(newList: PrevisaoFerias[]): PrevisaoFerias[] {
  savePrevisaoFerias(newList);
  return newList;
}

/**
 * Merge imported vacation records
 */
export function importFeriasMerge(newList: PrevisaoFerias[]): PrevisaoFerias[] {
  const current = getPrevisaoFerias();
  const map = new Map<string, PrevisaoFerias>();

  current.forEach(item => {
    map.set(`${item.matricula}-${item.ano}-${item.mesPrevisto}`, item);
  });

  newList.forEach(item => {
    map.set(`${item.matricula}-${item.ano}-${item.mesPrevisto}`, item);
  });

  const merged = Array.from(map.values());
  savePrevisaoFerias(merged);
  return merged;
}
