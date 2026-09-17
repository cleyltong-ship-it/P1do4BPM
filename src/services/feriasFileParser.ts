import * as XLSX from 'xlsx';
import { pdfjsLib } from './pdfWorkerSetup';
import { PrevisaoFerias, MesAno, PostoGraduacao, EfetivoMilitar } from '../types';
import { normalizePosto } from './excelEfetivoParser';

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

export function normalizeMes(val: any): MesAno {
  if (!val && val !== 0) return 'Janeiro';

  // If val is a number (could be 1-12 or Excel serial date)
  if (typeof val === 'number') {
    if (val >= 1 && val <= 12) {
      return MESES_DO_ANO[Math.floor(val) - 1];
    }
    // Excel serial date (e.g. 45000 is around 2023)
    if (val > 30000 && val < 60000) {
      const date = new Date((val - 25569) * 86400 * 1000);
      const monthIdx = date.getUTCMonth();
      if (monthIdx >= 0 && monthIdx < 12) {
        return MESES_DO_ANO[monthIdx];
      }
    }
  }

  const str = String(val).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

  // If string contains date pattern DD/MM/AAAA or DD/MM
  const dateMatch = str.match(/\b\d{1,2}[\/\.-](\d{1,2})([\/\.-]\d{2,4})?\b/);
  if (dateMatch && dateMatch[1]) {
    const monthNum = parseInt(dateMatch[1], 10);
    if (monthNum >= 1 && monthNum <= 12) {
      return MESES_DO_ANO[monthNum - 1];
    }
  }

  // Pure integer number 1-12 as string (e.g. "1", "01", "02"..."12")
  const pureNum = parseInt(str, 10);
  if (!isNaN(pureNum) && pureNum >= 1 && pureNum <= 12 && /^\d{1,2}$/.test(str)) {
    return MESES_DO_ANO[pureNum - 1];
  }

  if (str.includes('JAN')) return 'Janeiro';
  if (str.includes('FEV')) return 'Fevereiro';
  if (str.includes('MAR')) return 'Março';
  if (str.includes('ABR')) return 'Abril';
  if (str.includes('MAI')) return 'Maio';
  if (str.includes('JUN')) return 'Junho';
  if (str.includes('JUL')) return 'Julho';
  if (str.includes('AGO')) return 'Agosto';
  if (str.includes('SET')) return 'Setembro';
  if (str.includes('OUT')) return 'Outubro';
  if (str.includes('NOV')) return 'Novembro';
  if (str.includes('DEZ')) return 'Dezembro';

  return 'Janeiro';
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

function isHeaderOrExcludedName(val: string): boolean {
  if (!val || val.trim().length < 2) return true;
  const upper = val
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

  // If pure numbers or symbols or date pattern
  if (!/[A-Z]/.test(upper)) return true;
  if (/^\d{1,2}[\/\.-]\d{1,2}([\/\.-]\d{2,4})?$/.test(upper)) return true;

  // Header tokens
  if (
    upper === 'NOME' ||
    upper === 'NOME COMPLETO' ||
    upper === 'NOME DO MILITAR' ||
    upper === 'NOME DO POLICIAL' ||
    upper === 'NOME DE GUERRA' ||
    upper === 'POLICIAL MILITAR' ||
    upper === 'MILITAR' ||
    upper === 'POLICIAL' ||
    upper === 'EFETIVO' ||
    upper === 'GRAD' ||
    upper === 'POSTO' ||
    upper === 'POSTO/GRAD' ||
    upper === 'POSTO/GRADUACAO' ||
    upper === 'MATRICULA' ||
    upper === 'ID' ||
    upper === 'ORD' ||
    upper === 'ORDEM' ||
    upper === 'NR' ||
    upper === 'N'
  ) {
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

        // Cross-reference with Efetivo database
        const upperNome = rawNome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
        let matchedMilitar = efetivoList.find(m => {
          if (rawMat && cleanMatricula(m.matricula) === rawMat) return true;
          const mNC = m.nomeCompleto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
          if (mNC === upperNome) return true;
          return false;
        });

        if (!matchedMilitar) {
          matchedMilitar = efetivoList.find(m => {
            const mNC = m.nomeCompleto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
            if (mNC.includes(upperNome) || upperNome.includes(mNC)) return true;
            if (rawGuerra && m.nomeGuerra.toUpperCase() === rawGuerra.toUpperCase()) return true;
            return false;
          });
        }

        const posto: PostoGraduacao = matchedMilitar?.postoGraduacao || (rawPosto ? normalizePosto(rawPosto) : 'Sd');
        const nomeCompleto = matchedMilitar?.nomeCompleto || rawNome;
        const nomeGuerra = matchedMilitar?.nomeGuerra || rawGuerra || (rawNome ? rawNome.split(' ')[0] : 'Militar');
        const matricula = matchedMilitar?.matricula || rawMat || `PM-${Math.floor(1000 + Math.random() * 9000)}`;

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
          observacao: obsParts.length > 0 ? obsParts.join(' • ') : undefined
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

      let matchedMilitar = efetivoList.find(m => 
        (rawMat && cleanMatricula(m.matricula) === rawMat) ||
        (rawNome && m.nomeCompleto.toUpperCase().includes(upperNome)) ||
        (rawNome && upperNome.includes(m.nomeGuerra.toUpperCase()))
      );

      const posto: PostoGraduacao = matchedMilitar?.postoGraduacao || (rawPosto ? normalizePosto(rawPosto) : 'Sd');
      const nomeCompleto = matchedMilitar?.nomeCompleto || rawNome;
      const nomeGuerra = matchedMilitar?.nomeGuerra || (rawNome ? rawNome.split(' ')[0] : 'Militar');
      const matricula = matchedMilitar?.matricula || rawMat || `PM-${Math.floor(1000 + Math.random() * 9000)}`;

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
            observacao: strVal !== 'X' && strVal !== String(dias) ? strVal : undefined
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
        observacao: colPeriodo >= 0 ? cleanStr(row[colPeriodo]) : undefined
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

          records.push({
            id: `FERIAS-PDF-${matricula || records.length}-${rowMonth}-${records.length + 1}`,
            matricula: matricula || matchedMilitar?.matricula || `PM-${Math.floor(1000 + Math.random() * 9000)}`,
            nome: nome || (matchedMilitar?.nomeCompleto || 'Militar'),
            nomeGuerra: matchedMilitar?.nomeGuerra || (nome ? nome.split(' ')[0] : 'Militar'),
            posto: matchedMilitar?.postoGraduacao || posto,
            ano: currentYear,
            mesPrevisto: rowMonth,
            periodoDias,
            situacao: 'Prevista',
            observacao: 'Extraído do Boletim / PDF de Férias'
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
