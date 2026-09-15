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
  if (!val) return 'Janeiro';

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

  if (str.includes('JAN') || str === '1' || str === '01') return 'Janeiro';
  if (str.includes('FEV') || str === '2' || str === '02') return 'Fevereiro';
  if (str.includes('MAR') || str === '3' || str === '03') return 'Março';
  if (str.includes('ABR') || str === '4' || str === '04') return 'Abril';
  if (str.includes('MAI') || str === '5' || str === '05') return 'Maio';
  if (str.includes('JUN') || str === '6' || str === '06') return 'Junho';
  if (str.includes('JUL') || str === '7' || str === '07') return 'Julho';
  if (str.includes('AGO') || str === '8' || str === '08') return 'Agosto';
  if (str.includes('SET') || str === '9' || str === '09') return 'Setembro';
  if (str.includes('OUT') || str === '10') return 'Outubro';
  if (str.includes('NOV') || str === '11') return 'Novembro';
  if (str.includes('DEZ') || str === '12') return 'Dezembro';

  return 'Janeiro';
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
    const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
    if (!jsonData || jsonData.length === 0) continue;

    // Check if sheetName itself is a month name
    const sheetMonth = normalizeMes(sheetName);
    const sheetIsMonth = sheetName.toUpperCase().includes(sheetMonth.toUpperCase().slice(0, 3));

    // Find header row (inspect up to 35 rows for official battalion headers)
    let headerRowIndex = -1;
    let colMatricula = -1;
    let colNome = -1;
    let colPosto = -1;
    let colMes = -1;
    let colDias = -1;
    let colPeriodo = -1;
    let colSituacao = -1;

    // Track columns that represent individual months (e.g., JAN, FEV, MAR...)
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

        // Check if this header cell represents a month name
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

    // Fallback: If header wasn't cleanly identified, scan for columns by data
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

      // If columns were not mapped properly, attempt fuzzy column heuristic from row cells
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

      // Skip row if still neither name nor matricula
      if (!rawNome && !rawMat) continue;

      // Filter out repeated headers or titles
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

      // Match with existing military personnel database
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

      // CASE A: Matrix Mode (each month has its own column)
      if (isMatrixMode) {
        let hasAnyMonthAssigned = false;

        monthColumns.forEach((mMonth, colIdx) => {
          const val = row[colIdx];
          if (val === null || val === undefined) return;
          const strVal = cleanStr(val).toUpperCase();
          if (!strVal || strVal === '-' || strVal === '0') return;

          // If there is any mark: "X", "30", "15", dates, "SIM", "1", "OK"
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

      // CASE B: Standard Row / List Mode (one month per row or sheet month)
      let mes: MesAno = 'Janeiro';
      let dias = colDias >= 0 && !isNaN(parseInt(String(row[colDias]), 10)) ? parseInt(String(row[colDias]), 10) : 30;

      if (colMes >= 0 && row[colMes] !== undefined && row[colMes] !== null) {
        mes = normalizeMes(row[colMes]);
      } else if (sheetIsMonth) {
        mes = sheetMonth;
      } else if (colPeriodo >= 0 && row[colPeriodo]) {
        mes = normalizeMes(row[colPeriodo]);
      } else {
        // Search cells in this row for month names or date strings
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
  
  // Use robust parameters to prevent worker hang in preview or Firebase Hosting
  const loadingTask = pdfjsLib.getDocument({ 
    data: buffer,
    disableFontFace: true,
    useSystemFonts: false,
    // @ts-ignore
    isEvalSupported: false 
  });
  
  const pdfDoc = await loadingTask.promise;

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
