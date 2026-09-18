import * as XLSX from 'xlsx';
import { pdfjsLib } from './pdfWorkerSetup';
import { PrevisaoFerias, MesAno, PostoGraduacao, EfetivoMilitar, CategoriaEscalaFerias } from '../types';
import { normalizePosto } from './excelEfetivoParser';

export function detectInitialCategoria(posto: string, obs?: string, nome?: string): CategoriaEscalaFerias {
  const p = (posto || '').toUpperCase();
  const o = (obs || '').toUpperCase();
  const n = (nome || '').toUpperCase();

  if (o.includes('P2') || o.includes('P/2') || o.includes('INTELIGENCIA') || o.includes('INTELIGÊNCIA')) {
    return 'P2';
  }
  if (o.includes('DISPOSIC') || o.includes('ADIDO') || o === 'AD' || n.includes('ADIDO')) {
    return 'À Disposição';
  }
  if (o.includes('ADMIN') || o.includes('EXPEDIENTE') || o.includes('SECRETARIA') || o.includes('ARMEIRO') || o.includes('RESERVA DE ARMAMENTO')) {
    return 'Administrativo';
  }
  if (
    p.includes('CEL') || 
    p.includes('MAJ') || 
    p.includes('CAP') || 
    p.includes('1º TEN') || 
    p.includes('2º TEN') || 
    p.includes('TEN') ||
    p === 'OFICIAL' ||
    o.includes('OFICIAL') ||
    o.includes('CMT') ||
    o.includes('COMANDANTE')
  ) {
    return 'Oficiais';
  }

  return 'Operacional';
}

export const MESES_DO_ANO: MesAno[] = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
];

export function detectMes(val: any): MesAno | null {
  if (val === null || val === undefined || val === '') return null;

  // Number 1-12
  if (typeof val === 'number') {
    if (val >= 1 && val <= 12) {
      return MESES_DO_ANO[Math.floor(val) - 1];
    }
    // Excel serial date (e.g. 35000 - 65000)
    if (val > 25000 && val < 65000) {
      const date = new Date((val - 25569) * 86400 * 1000);
      const mIdx = date.getUTCMonth();
      if (mIdx >= 0 && mIdx < 12) {
        return MESES_DO_ANO[mIdx];
      }
    }
  }

  const raw = String(val).trim();
  if (!raw) return null;

  const norm = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

  // Pure integer number 1-12 as string
  if (/^0?[1-9]$|^1[0-2]$/.test(norm)) {
    const num = parseInt(norm, 10);
    return MESES_DO_ANO[num - 1];
  }

  // Date pattern with month: DD/MM/AAAA or DD/MM or AAAA-MM-DD
  const isoMatch = norm.match(/^\d{4}[-/](\d{1,2})[-/]\d{1,2}/);
  if (isoMatch) {
    const num = parseInt(isoMatch[1], 10);
    if (num >= 1 && num <= 12) return MESES_DO_ANO[num - 1];
  }

  const dateMatch = norm.match(/\b\d{1,2}[\/\.-](\d{1,2})([\/\.-]\d{2,4})?\b/);
  if (dateMatch && dateMatch[1]) {
    const num = parseInt(dateMatch[1], 10);
    if (num >= 1 && num <= 12) return MESES_DO_ANO[num - 1];
  }

  // Match month full names or standard 3-letter abbreviations
  if (/\b(SETEMBRO|SETE|SET)\b/i.test(norm) || norm.includes('SETEMBRO') || /(^|[\/\s_-])SET([\/\s_-\d]|$)/i.test(norm)) return 'Setembro';
  if (/\b(JANEIRO|JAN)\b/i.test(norm) || norm.includes('JANEIRO') || /(^|[\/\s_-])JAN([\/\s_-\d]|$)/i.test(norm)) return 'Janeiro';
  if (/\b(FEVEREIRO|FEV)\b/i.test(norm) || norm.includes('FEVEREIRO') || /(^|[\/\s_-])FEV([\/\s_-\d]|$)/i.test(norm)) return 'Fevereiro';
  if (/\b(MARCO|MARÇO|MAR)\b/i.test(norm) || norm.includes('MARCO') || norm.includes('MARÇO') || /(^|[\/\s_-])MAR([\/\s_-\d]|$)/i.test(norm)) return 'Março';
  if (/\b(ABRIL|ABR)\b/i.test(norm) || norm.includes('ABRIL') || /(^|[\/\s_-])ABR([\/\s_-\d]|$)/i.test(norm)) return 'Abril';
  if (/\b(MAIO|MAI)\b/i.test(norm) || norm.includes('MAIO') || /(^|[\/\s_-])MAI([\/\s_-\d]|$)/i.test(norm)) return 'Maio';
  if (/\b(JUNHO|JUN)\b/i.test(norm) || norm.includes('JUNHO') || /(^|[\/\s_-])JUN([\/\s_-\d]|$)/i.test(norm)) return 'Junho';
  if (/\b(JULHO|JUL)\b/i.test(norm) || norm.includes('JULHO') || /(^|[\/\s_-])JUL([\/\s_-\d]|$)/i.test(norm)) return 'Julho';
  if (/\b(AGOSTO|AGO)\b/i.test(norm) || norm.includes('AGOSTO') || /(^|[\/\s_-])AGO([\/\s_-\d]|$)/i.test(norm)) return 'Agosto';
  if (/\b(OUTUBRO|OUTU|OUT)\b/i.test(norm) || norm.includes('OUTUBRO') || /(^|[\/\s_-])OUT([\/\s_-\d]|$)/i.test(norm)) return 'Outubro';
  if (/\b(NOVEMBRO|NOVE|NOV)\b/i.test(norm) || norm.includes('NOVEMBRO') || /(^|[\/\s_-])NOV([\/\s_-\d]|$)/i.test(norm)) return 'Novembro';
  if (/\b(DEZEMBRO|DEZE|DEZ)\b/i.test(norm) || norm.includes('DEZEMBRO') || /(^|[\/\s_-])DEZ([\/\s_-\d]|$)/i.test(norm)) return 'Dezembro';

  return null;
}

export function normalizeMes(val: any, defaultMonth: MesAno = 'Janeiro'): MesAno {
  const detected = detectMes(val);
  return detected !== null ? detected : defaultMonth;
}

export function parseAno(val: any, defaultYear: number = new Date().getFullYear()): number {
  if (val === null || val === undefined || val === '') return defaultYear;
  if (typeof val === 'number') {
    if (val >= 1990 && val <= 2050) return Math.floor(val);
    if (val > 30000 && val < 60000) {
      const d = new Date((val - 25569) * 86400 * 1000);
      const y = d.getUTCFullYear();
      if (y >= 1990 && y <= 2050) return y;
    }
  }
  const s = String(val).trim();
  const yearMatch = s.match(/\b(19\d\d|20\d\d)\b/);
  if (yearMatch) {
    return parseInt(yearMatch[1], 10);
  }
  return defaultYear;
}

export function parseAnoReferencia(val: any): number | undefined {
  if (val === null || val === undefined || val === '') return undefined;
  if (typeof val === 'number') {
    if (val >= 1990 && val <= 2050) return Math.floor(val);
    if (val > 30000 && val < 60000) {
      const d = new Date((val - 25569) * 86400 * 1000);
      return d.getUTCFullYear();
    }
  }
  const s = String(val).trim();
  const yearMatch = s.match(/\b(19\d\d|20\d\d)\b/);
  if (yearMatch) {
    return parseInt(yearMatch[1], 10);
  }
  return undefined;
}

export function parseDias(val: any): number {
  if (val === null || val === undefined || val === '') return 30;
  if (typeof val === 'number') {
    if (val > 0 && val <= 60) return Math.floor(val);
  }
  const str = String(val).replace(/\D/g, '');
  const num = parseInt(str, 10);
  if (!isNaN(num) && num > 0 && num <= 60) {
    return num;
  }
  return 30;
}

function cleanDigits(val: any): string {
  if (!val) return '';
  return String(val).replace(/\D/g, '');
}

function normalizeSimple(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function isHeaderOrExcludedName(val: string): boolean {
  if (!val || val.trim().length < 2) return true;
  const upper = normalizeSimple(val);

  // If pure numbers or symbols or date pattern
  if (!/[A-Z]/.test(upper)) return true;
  if (/^\d{1,2}[\/\.-]\d{1,2}([\/\.-]\d{2,4})?$/.test(upper)) return true;

  // Month names are NOT person names!
  for (const m of MESES_DO_ANO) {
    const mNorm = normalizeSimple(m);
    if (upper === mNorm || upper === mNorm.slice(0, 3) || upper.startsWith(`MES DE ${mNorm}`) || upper.startsWith(`MES:`)) {
      return true;
    }
  }

  // Header tokens
  const headerTokens = [
    'NOME', 'NOME COMPLETO', 'NOME DO MILITAR', 'NOME DO POLICIAL', 'NOME DO SERVIDOR',
    'NOME DE GUERRA', 'GUERRA', 'POLICIAL MILITAR', 'MILITAR', 'POLICIAL', 'EFETIVO',
    'POSTO', 'GRAD', 'POSTO/GRAD', 'POSTO/GRADUACAO', 'P/G', 'GRADUACAO',
    'MATRICULA', 'MAT', 'RE', 'ID', 'ORD', 'ORDEM', 'NR', 'Nº', 'ITEM',
    'MES', 'MES PREVISTO', 'MES DE GOZO', 'MES DE FERIAS', 'PREVISAO', 'GOZO', 'PERIODO',
    'ANO', 'ANO DE GOZO', 'EXERCICIO', 'AQUISITIVO', 'ANO REF', 'ANO BASE',
    'DIAS', 'QTD DIAS', 'QUANTIDADE DE DIAS', 'DURACAO', 'PARCELA',
    'SITUACAO', 'STATUS', 'CONDICAO', 'OBSERVACOES', 'OBS', 'SETOR', 'SUBUNIDADE', 'CIA'
  ];

  if (headerTokens.includes(upper)) {
    return true;
  }

  // Institutional or document titles
  if (
    upper.includes('ESTADO DE ALAGOAS') ||
    upper.includes('POLICIA MILITAR') ||
    upper.includes('COMANDO GERAL') ||
    upper.includes('BATALHAO') ||
    upper.includes('DIRETORIA') ||
    upper.includes('MAPA DE FERIAS') ||
    upper.includes('PLANO DE FERIAS') ||
    upper.includes('ESCALA DE FERIAS') ||
    upper.includes('BOLETIM GERAL') ||
    upper.includes('RELATORIO') ||
    upper.includes('QUADRO GERAL') ||
    upper.startsWith('QUADRO DE') ||
    upper.startsWith('TABELA DE')
  ) {
    return true;
  }

  // Summary / Footer tokens
  if (
    upper.startsWith('TOTAL') ||
    upper.includes('TOTAL GERAL') ||
    upper.includes('HOMOLOGO') ||
    upper.includes('ASSINATURA') ||
    upper.includes('CHEFE DA') ||
    upper.includes('RESPONSAVEL')
  ) {
    return true;
  }

  return false;
}

function cleanStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function cleanMatricula(val: any): string {
  if (!val) return '';
  return String(val).replace(/[^\d-]/g, '').trim();
}

export interface ParseFeriasResult {
  records: PrevisaoFerias[];
  totalParsed: number;
  matchedWithEfetivo: number;
  monthsFound: string[];
  filename: string;
  sourceType: 'excel' | 'pdf';
}

/**
 * Parse Excel file for vacation schedule with dual layout support:
 * 1. Column-based annual matrix (JAN, FEV, MAR... columns)
 * 2. Traditional row-list layout (Matricula, Nome, Mes column)
 */
export async function parseExcelFerias(
  file: File,
  currentYear: number = new Date().getFullYear(),
  efetivoList: EfetivoMilitar[] = []
): Promise<ParseFeriasResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const records: PrevisaoFerias[] = [];
  const monthsFound = new Set<string>();

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
    if (!jsonData || jsonData.length === 0) continue;

    // Check if sheetName itself is a month name
    const sheetMonth = normalizeMes(sheetName);
    const sheetIsMonth = sheetName.toUpperCase().includes(sheetMonth.toUpperCase().slice(0, 3));

    // -------------------------------------------------------------
    // PRIORITY 1: ANNUAL MATRIX LAYOUT (Months as columns: JAN, FEV, MAR... SET... DEZ)
    // -------------------------------------------------------------
    const detectedMatrixCols = new Map<number, MesAno>();
    let detectedMatrixHeaderRow = -1;
    const maxScanRows = Math.min(jsonData.length, 25);

    for (let r = 0; r < maxScanRows; r++) {
      const row = jsonData[r];
      if (!Array.isArray(row)) continue;
      const rowCols = new Map<number, MesAno>();

      row.forEach((cell, idx) => {
        const str = cleanStr(cell);
        if (!str) return;
        const norm = normalizeSimple(str);

        // Check if this header cell represents a month
        for (const m of MESES_DO_ANO) {
          const mNorm = normalizeSimple(m);
          const prefix = mNorm.slice(0, 3); // JAN, FEV, MAR, ABR, MAI, JUN, JUL, AGO, SET, OUT, NOV, DEZ
          if (
            norm === prefix ||
            norm === mNorm ||
            norm === `MES ${prefix}` ||
            norm === `MES ${mNorm}` ||
            norm.startsWith(`${prefix}/`) ||
            norm.endsWith(`/${prefix}`) ||
            norm.startsWith(`${prefix}-`) ||
            norm.startsWith(`${prefix} -`) ||
            norm.startsWith(`${prefix} `) ||
            norm.startsWith(`01/${prefix}`) ||
            norm.startsWith(`1/${prefix}`)
          ) {
            rowCols.set(idx, m);
            break;
          }
        }
      });

      if (rowCols.size >= 3) {
        detectedMatrixHeaderRow = r;
        rowCols.forEach((m, idx) => detectedMatrixCols.set(idx, m));
        break;
      }
    }

    if (detectedMatrixCols.size >= 3) {
      // Find Name, Matrícula, and Posto column indices
      const headerRow = jsonData[detectedMatrixHeaderRow] || [];
      let mColNome = -1;
      let mColMat = -1;
      let mColPosto = -1;
      let mColGuerra = -1;

      headerRow.forEach((cell, idx) => {
        if (detectedMatrixCols.has(idx)) return;
        const s = normalizeSimple(cleanStr(cell));
        if (s.includes('NOME DE GUERRA') || s === 'GUERRA') {
          mColGuerra = idx;
        } else if (
          s === 'NOME' || 
          s === 'NOME COMPLETO' || 
          s === 'NOME DO MILITAR' || 
          s === 'NOME DO POLICIAL' || 
          s === 'POLICIAL' || 
          s === 'MILITAR' || 
          (s.includes('NOME') && !s.includes('GUERRA'))
        ) {
          if (mColNome === -1) mColNome = idx;
        } else if (s.includes('MATRICULA') || s === 'MAT' || s === 'MAT.' || s === 'RE' || s === 'ID' || s === 'ORDEM' || s === 'ORD') {
          if (mColMat === -1) mColMat = idx;
        } else if (s === 'POSTO' || s === 'GRAD' || s === 'POSTO/GRAD' || s === 'POSTO/GRADUACAO' || s === 'P/G' || s === 'GRADUACAO') {
          if (mColPosto === -1) mColPosto = idx;
        }
      });

      // If mColNome not detected by header text, scan data rows for the column with full names
      if (mColNome === -1) {
        const votes = new Map<number, number>();
        const sampleLimit = Math.min(jsonData.length, detectedMatrixHeaderRow + 30);
        for (let r = detectedMatrixHeaderRow + 1; r < sampleLimit; r++) {
          const row = jsonData[r];
          if (!Array.isArray(row)) continue;
          row.forEach((cell, idx) => {
            if (detectedMatrixCols.has(idx) || idx === mColMat || idx === mColPosto) return;
            const s = cleanStr(cell);
            if (s.length >= 8 && /^[A-Za-zÀ-ÿ\s\.\-']+$/.test(s) && !isHeaderOrExcludedName(s) && detectMes(s) === null) {
              const words = s.split(/\s+/).filter(w => w.length >= 2);
              if (words.length >= 2) {
                votes.set(idx, (votes.get(idx) || 0) + 1);
              }
            }
          });
        }
        let maxV = 0;
        votes.forEach((cnt, idx) => {
          if (cnt > maxV) {
            maxV = cnt;
            mColNome = idx;
          }
        });
      }

      // If mColMat not detected, scan for 4-7 digit numbers
      if (mColMat === -1) {
        const sampleLimit = Math.min(jsonData.length, detectedMatrixHeaderRow + 15);
        for (let r = detectedMatrixHeaderRow + 1; r < sampleLimit; r++) {
          const row = jsonData[r];
          if (!Array.isArray(row)) continue;
          row.forEach((cell, idx) => {
            if (detectedMatrixCols.has(idx) || idx === mColNome) return;
            const s = cleanStr(cell);
            if (/^\d{4,7}(-\d)?$/.test(s.replace(/\s/g, ''))) {
              mColMat = idx;
            }
          });
          if (mColMat >= 0) break;
        }
      }

      // If mColPosto not detected, scan for rank abbreviations
      if (mColPosto === -1) {
        const sampleLimit = Math.min(jsonData.length, detectedMatrixHeaderRow + 15);
        for (let r = detectedMatrixHeaderRow + 1; r < sampleLimit; r++) {
          const row = jsonData[r];
          if (!Array.isArray(row)) continue;
          row.forEach((cell, idx) => {
            if (detectedMatrixCols.has(idx) || idx === mColNome || idx === mColMat) return;
            const s = cleanStr(cell);
            if (/^(SD|CB|[123]º?\s*SGT|TEN|CAP|MAJ|CEL|SUBTEN)/i.test(s)) {
              mColPosto = idx;
            }
          });
          if (mColPosto >= 0) break;
        }
      }

      // Parse each soldier row in Matrix Layout
      for (let r = detectedMatrixHeaderRow + 1; r < jsonData.length; r++) {
        const row = jsonData[r];
        if (!Array.isArray(row) || row.length === 0) continue;

        let rawNome = mColNome >= 0 ? cleanStr(row[mColNome]) : '';
        let rawMat = mColMat >= 0 ? cleanMatricula(row[mColMat]) : '';
        let rawPosto = mColPosto >= 0 ? cleanStr(row[mColPosto]) : '';
        let rawGuerra = mColGuerra >= 0 ? cleanStr(row[mColGuerra]) : '';

        // Fallback row scans if missing
        if (!rawNome) {
          row.forEach((cell, idx) => {
            if (detectedMatrixCols.has(idx) || idx === mColMat || idx === mColPosto) return;
            const s = cleanStr(cell);
            if (s.length >= 8 && /^[A-Za-zÀ-ÿ\s\.\-']+$/.test(s) && !isHeaderOrExcludedName(s) && detectMes(s) === null) {
              const parts = s.split(/\s+/).filter(w => w.length >= 2);
              if (parts.length >= 2 && !rawNome) {
                rawNome = s;
              }
            }
          });
        }

        if (!rawMat) {
          row.forEach((cell, idx) => {
            if (detectedMatrixCols.has(idx) || idx === mColNome) return;
            const s = cleanStr(cell);
            if (/^\d{4,7}(-\d)?$/.test(s.replace(/\s/g, '')) && !rawMat) {
              rawMat = cleanMatricula(s);
            }
          });
        }

        if (!rawPosto) {
          row.forEach((cell, idx) => {
            if (detectedMatrixCols.has(idx) || idx === mColNome) return;
            const s = cleanStr(cell);
            if (/^(SD|CB|[123]º?\s*SGT|TEN|CAP|MAJ|CEL|SUBTEN)/i.test(s) && !rawPosto) {
              rawPosto = s;
            }
          });
        }

        if (!rawNome && !rawMat) continue;
        if (isHeaderOrExcludedName(rawNome)) continue;

        // Clean numbering prefix from name if present: "1. DIANA AMORIM ROCHA" -> "DIANA AMORIM ROCHA"
        rawNome = rawNome.replace(/^\s*\d+[\.\-\)]*\s*/, '').trim();
        if (!rawNome || isHeaderOrExcludedName(rawNome)) continue;

        // Safe cross-referencing with Efetivo database
        const normRaw = normalizeSimple(rawNome);
        const cleanRawMatDigits = cleanDigits(rawMat);

        let matchedMilitar: EfetivoMilitar | undefined;
        if (cleanRawMatDigits.length >= 4) {
          matchedMilitar = efetivoList.find(m => cleanDigits(m.matricula) === cleanRawMatDigits);
        }
        if (!matchedMilitar && normRaw) {
          matchedMilitar = efetivoList.find(m => normalizeSimple(m.nomeCompleto) === normRaw);
        }
        if (!matchedMilitar && normRaw) {
          const rawParts = normRaw.split(/\s+/).filter(Boolean);
          if (rawParts.length >= 2) {
            const first = rawParts[0];
            const last = rawParts[rawParts.length - 1];
            if (first.length >= 3 && last.length >= 3) {
              matchedMilitar = efetivoList.find(m => {
                const mParts = normalizeSimple(m.nomeCompleto).split(/\s+/).filter(Boolean);
                return mParts.length >= 2 && mParts[0] === first && mParts[mParts.length - 1] === last;
              });
            }
          }
        }

        // CRITICAL: Always preserve the authentic full name from Excel!
        const nomeCompleto = (rawNome && rawNome.length >= 4) ? rawNome : (matchedMilitar?.nomeCompleto || 'Militar');
        const posto: PostoGraduacao = rawPosto ? normalizePosto(rawPosto) : (matchedMilitar?.postoGraduacao || 'Sd');
        const nomeGuerra = rawGuerra || (matchedMilitar?.nomeGuerra || (rawNome ? rawNome.split(' ')[0] : 'Militar'));
        const matricula = rawMat || matchedMilitar?.matricula || `PM-${Math.floor(1000 + Math.random() * 9000)}`;

        // Check which month(s) this soldier is on vacation in this Matrix row
        detectedMatrixCols.forEach((mMonth, colIdx) => {
          const val = row[colIdx];
          if (val === null || val === undefined) return;
          const strVal = cleanStr(val).trim();
          if (!strVal || strVal === '-' || strVal === '0' || strVal === '--' || strVal.toUpperCase() === 'NAO' || strVal.toUpperCase() === 'NÃO') return;

          // A mark can be 'X', 'x', '30', '15', '20', dates, etc.
          let dias = 30;
          const parsedD = parseDias(strVal);
          if (parsedD > 0 && parsedD <= 30) {
            dias = parsedD;
          }

          monthsFound.add(mMonth);

          let situacao: PrevisaoFerias['situacao'] = 'Prevista';
          const now = new Date();
          const currentYr = now.getFullYear();
          const currentMIdx = now.getMonth();
          const mesIdx = MESES_DO_ANO.indexOf(mMonth);

          if (currentYear < currentYr) {
            situacao = 'Concluída';
          } else if (currentYear === currentYr) {
            if (mesIdx < currentMIdx) {
              situacao = 'Concluída';
            } else if (mesIdx === currentMIdx) {
              situacao = 'Em Gozo';
            } else {
              situacao = 'Prevista';
            }
          }

          records.push({
            id: `FERIAS-${matricula}-${mMonth}-${currentYear}-${records.length + 1}`,
            matricula,
            nome: nomeCompleto,
            nomeGuerra,
            posto,
            ano: currentYear,
            mesPrevisto: mMonth,
            periodoDias: dias,
            situacao,
            observacao: strVal !== 'X' && strVal !== 'x' && strVal !== String(dias) ? strVal : undefined
          });
        });
      }

      // Matrix sheet processed completely, continue to next sheet
      continue;
    }

    // MODE 1: PRIORITY STANDARD EXCEL LAYOUT (User Specification)
    // Coluna F (index 5): Nome do militar
    // Coluna C (index 2): Graduação
    // Coluna H (index 7): Mês que está programada a Férias
    // Coluna I (index 8): Ano a que ela será gozada
    // Coluna L (index 11): Ano a que ela se refere
    // Coluna M (index 12): Quantidade de dias
    const colFRows: number[] = [];
    for (let r = 0; r < jsonData.length; r++) {
      const row = jsonData[r];
      if (!Array.isArray(row) || row.length < 6) continue;
      const cellF = cleanStr(row[5]);
      if (!cellF || isHeaderOrExcludedName(cellF)) continue;
      // Must contain letters, not just numbers or symbols
      if (/[A-Za-zÀ-ÖØ-öø-ÿ]{3,}/.test(cellF)) {
        colFRows.push(r);
      }
    }

    if (colFRows.length > 0) {
      for (const r of colFRows) {
        const row = jsonData[r];

        // Coluna F (index 5): Nome do militar
        const rawNome = cleanStr(row[5]).replace(/^\s*\d+[\.\-\)]*\s*/, '').trim();
        if (!rawNome || isHeaderOrExcludedName(rawNome)) continue;

        // Coluna C (index 2): Graduação
        const rawPosto = cleanStr(row[2]);

        // Coluna H (index 7): Mês que está programada a Férias
        let mes: MesAno;
        if (row[7] !== undefined && row[7] !== null && String(row[7]).trim() !== '') {
          mes = normalizeMes(row[7]);
        } else if (sheetIsMonth) {
          mes = sheetMonth;
        } else {
          let foundMonth = false;
          for (let c = 0; c < row.length; c++) {
            if (c === 5) continue; // skip name column
            const s = cleanStr(row[c]).toUpperCase();
            for (const m of MESES_DO_ANO) {
              if (s.includes(m.toUpperCase().slice(0, 4))) {
                mes = m;
                foundMonth = true;
                break;
              }
            }
            if (foundMonth) break;
          }
          mes = foundMonth ? (mes! as MesAno) : normalizeMes(row[7]);
        }

        // Coluna I (index 8): Ano a que ela será gozada
        const anoGozo = parseAno(row[8], currentYear);

        // Coluna L (index 11): Ano a que ela se refere
        const anoReferencia = parseAnoReferencia(row[11]);

        // Coluna M (index 12): Quantidade de dias
        const dias = parseDias(row[12]);

        // Matrícula: Coluna B (index 1), Coluna D (index 3), Coluna A (index 0) or scan row
        let rawMat = '';
        if (row[1] && /^\d{4,7}(-\d)?$/.test(cleanStr(row[1]).replace(/\s/g, ''))) {
          rawMat = cleanMatricula(row[1]);
        } else if (row[3] && /^\d{4,7}(-\d)?$/.test(cleanStr(row[3]).replace(/\s/g, ''))) {
          rawMat = cleanMatricula(row[3]);
        } else if (row[0] && /^\d{4,7}(-\d)?$/.test(cleanStr(row[0]).replace(/\s/g, ''))) {
          rawMat = cleanMatricula(row[0]);
        } else {
          for (let c = 0; c < row.length; c++) {
            if (c === 8 || c === 11 || c === 12) continue; // skip year and days
            const s = cleanStr(row[c]);
            if (/^\d{4,7}(-\d)?$/.test(s.replace(/\s/g, ''))) {
              rawMat = cleanMatricula(s);
              break;
            }
          }
        }

        // Nome de Guerra: Coluna E (index 4)
        let rawGuerra = '';
        if (row[4]) {
          const g = cleanStr(row[4]);
          if (g && !isHeaderOrExcludedName(g) && !/^\d+$/.test(g) && g.length <= 25) {
            rawGuerra = g;
          }
        }

        // Cross-reference with Efetivo database safely
        // PRESERVE the real name from Excel (rawNome)! NEVER replace with a soldier matched by partial surname!
        const normRaw = normalizeSimple(rawNome);
        const cleanRawMatDigits = cleanDigits(rawMat);

        let matchedMilitar: EfetivoMilitar | undefined;
        if (cleanRawMatDigits.length >= 4) {
          matchedMilitar = efetivoList.find(m => cleanDigits(m.matricula) === cleanRawMatDigits);
        }
        if (!matchedMilitar && normRaw) {
          matchedMilitar = efetivoList.find(m => normalizeSimple(m.nomeCompleto) === normRaw);
        }
        if (!matchedMilitar && normRaw) {
          const rawParts = normRaw.split(/\s+/).filter(Boolean);
          if (rawParts.length >= 2) {
            const first = rawParts[0];
            const last = rawParts[rawParts.length - 1];
            if (first.length >= 3 && last.length >= 3) {
              matchedMilitar = efetivoList.find(m => {
                const mParts = normalizeSimple(m.nomeCompleto).split(/\s+/).filter(Boolean);
                return mParts.length >= 2 && mParts[0] === first && mParts[mParts.length - 1] === last;
              });
            }
          }
        }

        const posto: PostoGraduacao = rawPosto ? normalizePosto(rawPosto) : (matchedMilitar?.postoGraduacao || 'Sd');
        // ALWAYS use the rawNome from the Excel sheet if it has at least 4 characters!
        const nomeCompleto = (rawNome && rawNome.length >= 4) ? rawNome : (matchedMilitar?.nomeCompleto || 'Militar');
        const nomeGuerra = rawGuerra || matchedMilitar?.nomeGuerra || (rawNome ? rawNome.split(' ')[0] : 'Militar');
        const matricula = rawMat || matchedMilitar?.matricula || `PM-${Math.floor(1000 + Math.random() * 9000)}`;

        // Determine situation
        let situacao: PrevisaoFerias['situacao'] = 'Prevista';
        const now = new Date();
        const currentYr = now.getFullYear();
        const currentMIdx = now.getMonth();
        const mesIdx = MESES_DO_ANO.indexOf(mes);

        if (anoGozo < currentYr) {
          situacao = 'Concluída';
        } else if (anoGozo === currentYr) {
          if (mesIdx < currentMIdx) {
            situacao = 'Concluída';
          } else if (mesIdx === currentMIdx) {
            situacao = 'Em Gozo';
          } else {
            situacao = 'Prevista';
          }
        } else {
          situacao = 'Prevista';
        }

        const obsParts: string[] = [];
        if (anoReferencia) {
          obsParts.push(`Exercício: ${anoReferencia}`);
        }
        if (row[9]) {
          const p = cleanStr(row[9]);
          if (p && !isHeaderOrExcludedName(p)) obsParts.push(p);
        }
        if (row[10]) {
          const p = cleanStr(row[10]);
          if (p && !isHeaderOrExcludedName(p)) obsParts.push(p);
        }

        monthsFound.add(mes);
        const obsFinal = obsParts.length > 0 ? obsParts.join(' • ') : undefined;

        records.push({
          id: `FERIAS-${matricula}-${mes}-${anoGozo}-${records.length + 1}`,
          matricula,
          nome: nomeCompleto,
          nomeGuerra,
          posto,
          ano: anoGozo,
          anoReferencia,
          mesPrevisto: mes,
          periodoDias: dias,
          situacao,
          observacao: obsFinal,
          categoria: detectInitialCategoria(posto, obsFinal, nomeCompleto)
        });
      }

      // Done with this sheet
      continue;
    }

    // MODE 2: FALLBACK DYNAMIC HEADER SCANNER (Matrix mode or other column variations)
    let headerRowIndex = -1;
    let colMatricula = -1;
    let colNome = -1;
    let colPosto = -1;
    let colMes = -1;
    let colDias = -1;
    let colPeriodo = -1;
    let colSituacao = -1;

    const monthColumns = new Map<number, MesAno>();
    const maxHeaderScan = Math.min(35, jsonData.length);

    for (let r = 0; r < maxHeaderScan; r++) {
      const row = jsonData[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      let detectedMat = -1;
      let detectedNome = -1;
      let detectedPosto = -1;
      let detectedMes = -1;
      let detectedDias = -1;
      let detectedPeriodo = -1;
      let detectedSituacao = -1;
      const localMonthCols = new Map<number, MesAno>();

      row.forEach((cell, idx) => {
        const str = cleanStr(cell);
        const norm = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

        if (norm.includes('MATRICULA') || norm === 'MAT' || norm === 'ID' || norm === 'RE' || norm === 'RG') {
          detectedMat = idx;
        } else if (norm.includes('NOME') || norm.includes('MILITAR') || norm.includes('GUERRA') || norm === 'POLICIAL') {
          detectedNome = idx;
        } else if (norm.includes('POSTO') || norm.includes('GRAD') || norm === 'PG' || norm === 'P/G') {
          detectedPosto = idx;
        } else if (norm.includes('MES DE FERIAS') || norm.includes('PREVISAO') || norm === 'MES' || norm === 'PERIODO') {
          detectedMes = idx;
        } else if (norm.includes('DIAS') || norm.includes('QTD') || norm === 'DURACAO') {
          detectedDias = idx;
        } else if (norm.includes('STATUS') || norm.includes('SITUACAO') || norm === 'CONDICAO') {
          detectedSituacao = idx;
        } else if (norm.includes('DATA') || norm.includes('INICIO') || norm.includes('PERIODO')) {
          detectedPeriodo = idx;
        }

        for (const m of MESES_DO_ANO) {
          const mNorm = m.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
          const prefix = mNorm.slice(0, 3);
          if (norm === prefix || norm === mNorm || norm.startsWith(`${prefix}/`) || norm.endsWith(`/${prefix}`)) {
            localMonthCols.set(idx, m);
            break;
          }
        }
      });

      if ((detectedNome >= 0 || detectedMat >= 0) && (detectedMes >= 0 || localMonthCols.size >= 2 || detectedPosto >= 0 || sheetIsMonth)) {
        headerRowIndex = r;
        colMatricula = detectedMat;
        colNome = detectedNome;
        colPosto = detectedPosto;
        colMes = detectedMes;
        colDias = detectedDias;
        colPeriodo = detectedPeriodo;
        colSituacao = detectedSituacao;
        localMonthCols.forEach((m, idx) => monthColumns.set(idx, m));
        break;
      }
    }

    if (headerRowIndex === -1) {
      headerRowIndex = 0;
    }

    const startRow = headerRowIndex + 1;
    const isMatrixMode = monthColumns.size >= 2;

    for (let r = startRow; r < jsonData.length; r++) {
      const row = jsonData[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      let rawNome = colNome >= 0 ? cleanStr(row[colNome]) : '';
      let rawMat = colMatricula >= 0 ? cleanMatricula(row[colMatricula]) : '';
      let rawPosto = colPosto >= 0 ? cleanStr(row[colPosto]) : '';

      if (!rawNome && !rawMat) {
        row.forEach((cell, idx) => {
          const s = cleanStr(cell);
          if (!rawMat && /^\d{4,7}(-\d)?$/.test(s.replace(/\s/g, ''))) {
            rawMat = cleanMatricula(s);
          } else if (!rawNome && s.length > 5 && /[A-Z\s]{5,}/.test(s) && !/^\d+$/.test(s)) {
            rawNome = s;
          } else if (!rawPosto && /^(SD|CB|SGT|TEN|CAP|MAJ|CEL|SUBTEN)/i.test(s)) {
            rawPosto = s;
          }
        });
      }

      if (!rawNome && !rawMat) continue;

      const upperNome = rawNome.toUpperCase();
      if (
        upperNome.includes('NOME') || 
        upperNome.includes('TOTAL') || 
        upperNome.includes('BATALHAO') || 
        upperNome.includes('POLICIA MILITAR') ||
        upperNome.includes('RELATORIO')
      ) {
        continue;
      }

      // Safe matching with Efetivo database
      const normRaw = normalizeSimple(rawNome);
      const cleanRawMatDigits = cleanDigits(rawMat);

      let matchedMilitar: EfetivoMilitar | undefined;
      if (cleanRawMatDigits.length >= 4) {
        matchedMilitar = efetivoList.find(m => cleanDigits(m.matricula) === cleanRawMatDigits);
      }
      if (!matchedMilitar && normRaw) {
        matchedMilitar = efetivoList.find(m => normalizeSimple(m.nomeCompleto) === normRaw);
      }
      if (!matchedMilitar && normRaw) {
        const rawParts = normRaw.split(/\s+/).filter(Boolean);
        if (rawParts.length >= 2) {
          const first = rawParts[0];
          const last = rawParts[rawParts.length - 1];
          if (first.length >= 3 && last.length >= 3) {
            matchedMilitar = efetivoList.find(m => {
              const mParts = normalizeSimple(m.nomeCompleto).split(/\s+/).filter(Boolean);
              return mParts.length >= 2 && mParts[0] === first && mParts[mParts.length - 1] === last;
            });
          }
        }
      }

      const posto: PostoGraduacao = rawPosto ? normalizePosto(rawPosto) : (matchedMilitar?.postoGraduacao || 'Sd');
      // ALWAYS preserve authentic full name from Excel!
      const nomeCompleto = (rawNome && rawNome.length >= 4) ? rawNome : (matchedMilitar?.nomeCompleto || 'Militar');
      const nomeGuerra = (rawNome && rawNome.length >= 4)
        ? (matchedMilitar?.nomeGuerra || rawNome.split(' ')[0])
        : (matchedMilitar?.nomeGuerra || 'Militar');
      const matricula = rawMat || matchedMilitar?.matricula || `PM-${Math.floor(1000 + Math.random() * 9000)}`;

      let situacao: PrevisaoFerias['situacao'] = 'Prevista';
      if (colSituacao >= 0 && row[colSituacao]) {
        const s = cleanStr(row[colSituacao]).toLowerCase();
        if (s.includes('gozo') || s.includes('fruindo') || s.includes('andamento')) {
          situacao = 'Em Gozo';
        } else if (s.includes('concl') || s.includes('paga') || s.includes('gozada')) {
          situacao = 'Concluída';
        } else if (s.includes('interr') || s.includes('susp')) {
          situacao = 'Interrompida';
        }
      }

      if (isMatrixMode) {
        let hasAnyMonthAssigned = false;

        monthColumns.forEach((mMonth, colIdx) => {
          const val = row[colIdx];
          if (val === null || val === undefined) return;
          const strVal = cleanStr(val).toUpperCase();
          if (!strVal || strVal === '-' || strVal === '0') return;

          hasAnyMonthAssigned = true;
          monthsFound.add(mMonth);

          let dias = 30;
          const numVal = parseInt(strVal, 10);
          if (!isNaN(numVal) && numVal > 0 && numVal <= 30) {
            dias = numVal;
          }

          const obsFinal = strVal !== 'X' && strVal !== String(dias) ? strVal : undefined;

          records.push({
            id: `FERIAS-${matricula}-${mMonth}-${records.length + 1}`,
            matricula,
            nome: nomeCompleto,
            nomeGuerra,
            posto,
            ano: currentYear,
            mesPrevisto: mMonth,
            periodoDias: dias,
            situacao,
            observacao: obsFinal,
            categoria: detectInitialCategoria(posto, obsFinal, nomeCompleto)
          });
        });

        if (hasAnyMonthAssigned) {
          continue;
        }
      }

      let mes: MesAno = 'Janeiro';
      let dias = colDias >= 0 && !isNaN(parseInt(String(row[colDias]), 10)) ? parseInt(String(row[colDias]), 10) : 30;

      if (colMes >= 0 && row[colMes] !== undefined && row[colMes] !== null) {
        mes = normalizeMes(row[colMes]);
      } else if (sheetIsMonth) {
        mes = sheetMonth;
      } else if (colPeriodo >= 0 && row[colPeriodo]) {
        mes = normalizeMes(row[colPeriodo]);
      } else {
        let found = false;
        for (const cell of row) {
          const str = cleanStr(cell).toUpperCase();
          for (const m of MESES_DO_ANO) {
            if (str.includes(m.toUpperCase().slice(0, 4))) {
              mes = m;
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }

      monthsFound.add(mes);

      const obsFinal = colPeriodo >= 0 ? cleanStr(row[colPeriodo]) : undefined;

      records.push({
        id: `FERIAS-${matricula}-${mes}-${records.length + 1}`,
        matricula,
        nome: nomeCompleto,
        nomeGuerra,
        posto,
        ano: currentYear,
        mesPrevisto: mes,
        periodoDias: dias,
        situacao,
        observacao: obsFinal,
        categoria: detectInitialCategoria(posto, obsFinal, nomeCompleto)
      });
    }
  }

  const matchedWithEfetivo = records.filter(r => 
    efetivoList.some(m => cleanMatricula(m.matricula) === cleanMatricula(r.matricula))
  ).length;

  return {
    records,
    totalParsed: records.length,
    matchedWithEfetivo,
    monthsFound: Array.from(monthsFound),
    filename: file.name,
    sourceType: 'excel'
  };
}

/**
 * Parse PDF file for vacation schedule with robust worker and text extraction
 */
export async function parsePdfFerias(
  file: File,
  currentYear: number = new Date().getFullYear(),
  efetivoList: EfetivoMilitar[] = []
): Promise<ParseFeriasResult> {
  const buffer = await file.arrayBuffer();
  
  let pdfDoc: any = null;
  let loadError: any = null;

  try {
    const loadingTask = pdfjsLib.getDocument({ 
      data: buffer.slice(0),
      disableFontFace: true,
      useSystemFonts: false,
      // @ts-ignore
      isEvalSupported: false 
    });
    pdfDoc = await loadingTask.promise;
  } catch (err: any) {
    console.warn('Tentativa 1 no PDF de férias falhou, tentando fallback CDN...', err);
    loadError = err;
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version || '5.7.284'}/build/pdf.worker.min.mjs`;
      const fallbackTask = pdfjsLib.getDocument({ 
        data: buffer.slice(0),
        disableFontFace: true,
        useSystemFonts: false,
        // @ts-ignore
        isEvalSupported: false 
      });
      pdfDoc = await fallbackTask.promise;
    } catch (err2: any) {
      console.warn('Tentativa 2 no PDF de férias falhou:', err2);
      loadError = err2;
    }
  }

  if (!pdfDoc) {
    throw new Error(`Falha ao ler arquivo PDF de férias: ${loadError?.message || 'arquivo ilegível ou protegido'}`);
  }

  const records: PrevisaoFerias[] = [];
  const monthsFound = new Set<string>();

  let currentContextMonth: MesAno = 'Janeiro';

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Assemble text lines by Y position
    const items = textContent.items as any[];
    if (!items || items.length === 0) continue;

    // Group items into lines
    const lineMap = new Map<number, string[]>();
    for (const item of items) {
      if (!item.str || item.str.trim() === '') continue;
      const y = Math.round(item.transform[5]);
      if (!lineMap.has(y)) {
        lineMap.set(y, []);
      }
      lineMap.get(y)!.push(item.str);
    }

    // Sort descending by Y (top of page first)
    const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);

    for (const y of sortedY) {
      const lineText = lineMap.get(y)!.join(' ').trim();
      const normLine = lineText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

      // Check for month header in line
      for (const m of MESES_DO_ANO) {
        const mNorm = m.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        if (
          normLine.includes(`MES DE ${mNorm}`) || 
          normLine.includes(`MES: ${mNorm}`) || 
          normLine.includes(`FERIAS - ${mNorm}`) || 
          normLine.includes(`MES ${mNorm}`) || 
          normLine === mNorm ||
          normLine.includes(`PLANO DE FERIAS - ${mNorm}`)
        ) {
          currentContextMonth = m;
          monthsFound.add(m);
        }
      }

      // Check if line contains military rank or matricula or name
      const hasRank = /\b(CEL|TEN-CEL|MAJ|CAP|1º TEN|2º TEN|SUBTEN|1º SGT|2º SGT|3º SGT|CB|SD)\b/i.test(normLine);
      const hasMatricula = /\b\d{4,6}[-\s.]?\d\b/.test(lineText);

      if (hasRank || hasMatricula) {
        // Try extracting matricula
        const matMatch = lineText.match(/\b\d{4,6}[-\s.]?\d\b/);
        const matricula = matMatch ? matMatch[0].replace(/[\s.]/g, '') : '';

        // Extract rank
        const posto = normalizePosto(lineText);

        // Find match in military personnel database
        let matchedMilitar: EfetivoMilitar | undefined;
        if (matricula) {
          matchedMilitar = efetivoList.find(m => cleanMatricula(m.matricula) === cleanMatricula(matricula));
        }

        // If no match by matricula, try matching by name parts
        if (!matchedMilitar) {
          const words = normLine.split(/\s+/).filter(w => 
            w.length > 3 && 
            !['POLICIA', 'MILITAR', 'BATALHAO', 'FERIAS', 'ESTADO', 'PREVISAO', 'PLANO', 'QUADRO', 'DIAS'].includes(w)
          );
          for (const m of efetivoList) {
            const mWords = m.nomeCompleto.toUpperCase().split(/\s+/);
            const common = words.filter(w => mWords.includes(w));
            if (common.length >= 2) {
              matchedMilitar = m;
              break;
            }
          }
        }

        // Extract name
        let nome = matchedMilitar?.nomeCompleto || '';
        if (!nome) {
          let cleanedName = lineText
            .replace(/\b\d{4,6}[-\s.]?\d\b/, '')
            .replace(/\b(Cel|Ten-Cel|Maj|Cap|1º Ten|2º Ten|Subten|1º Sgt|2º Sgt|3º Sgt|Cb|Sd)\b/gi, '')
            .replace(/\b(Janeiro|Fevereiro|Março|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)\b/gi, '')
            .replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, '')
            .replace(/\b\d{1,2}\s*dias\b/gi, '')
            .trim();
          if (cleanedName.length > 3) {
            nome = cleanedName;
          }
        }

        if (nome || matricula) {
          // Check if a month is explicitly on this line
          let rowMonth = currentContextMonth;
          for (const m of MESES_DO_ANO) {
            const mNorm = m.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
            if (normLine.includes(mNorm)) {
              rowMonth = m;
              break;
            }
          }
          monthsFound.add(rowMonth);

          // Extract days if explicitly stated (e.g., "15 DIAS" or "30 DIAS")
          let periodoDias = 30;
          const daysMatch = lineText.match(/\b(10|15|20|30)\s*(dias|d)?\b/i);
          if (daysMatch && daysMatch[1]) {
            periodoDias = parseInt(daysMatch[1], 10);
          }

          const finalPosto = matchedMilitar?.postoGraduacao || posto;
          const finalNome = nome || (matchedMilitar?.nomeCompleto || 'Militar');

          records.push({
            id: `FERIAS-PDF-${matricula || records.length}-${rowMonth}-${records.length + 1}`,
            matricula: matricula || matchedMilitar?.matricula || `PM-${Math.floor(1000 + Math.random() * 9000)}`,
            nome: finalNome,
            nomeGuerra: matchedMilitar?.nomeGuerra || (nome ? nome.split(' ')[0] : 'Militar'),
            posto: finalPosto,
            ano: currentYear,
            mesPrevisto: rowMonth,
            periodoDias,
            situacao: 'Prevista',
            observacao: 'Extraído do Boletim / PDF de Férias',
            categoria: detectInitialCategoria(finalPosto, 'Extraído do Boletim', finalNome)
          });
        }
      }
    }
  }

  const matchedWithEfetivo = records.filter(r => 
    efetivoList.some(m => cleanMatricula(m.matricula) === cleanMatricula(r.matricula))
  ).length;

  return {
    records,
    totalParsed: records.length,
    matchedWithEfetivo,
    monthsFound: Array.from(monthsFound),
    filename: file.name,
    sourceType: 'pdf'
  };
}
