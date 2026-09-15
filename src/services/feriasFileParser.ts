import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import { PrevisaoFerias, MesAno, PostoGraduacao, EfetivoMilitar } from '../types';
import { normalizePosto } from './excelEfetivoParser';

// Configure pdfjs worker if not already configured
try {
  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '5.7.284'}/build/pdf.worker.min.mjs`;
  }
} catch (e) {
  console.warn('PDF.js worker in ferias parser:', e);
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

export function normalizeMes(val: any): MesAno {
  if (!val) return 'Janeiro';
  const str = String(val).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

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
 * Parse Excel file for vacation schedule
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

    // Find header row
    let headerRowIndex = -1;
    let colMatricula = -1;
    let colNome = -1;
    let colPosto = -1;
    let colMes = -1;
    let colDias = -1;
    let colPeriodo = -1;
    let colSituacao = -1;

    for (let r = 0; r < Math.min(10, jsonData.length); r++) {
      const row = jsonData[r];
      if (!Array.isArray(row)) continue;

      let hasNameOrMat = false;

      row.forEach((cell, idx) => {
        const norm = cleanStr(cell).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        if (norm.includes('MATRICULA') || norm === 'MAT' || norm === 'ID') {
          colMatricula = idx;
          hasNameOrMat = true;
        } else if (norm.includes('NOME') || norm.includes('MILITAR') || norm.includes('GUERRA')) {
          colNome = idx;
          hasNameOrMat = true;
        } else if (norm.includes('POSTO') || norm.includes('GRAD') || norm === 'PG') {
          colPosto = idx;
        } else if (norm.includes('MES') || norm.includes('PREVISAO') || norm.includes('PERIODO') || norm.includes('MES DE FERIAS')) {
          colMes = idx;
        } else if (norm.includes('DIAS') || norm.includes('QTD')) {
          colDias = idx;
        } else if (norm.includes('STATUS') || norm.includes('SITUACAO')) {
          colSituacao = idx;
        }
      });

      if (hasNameOrMat) {
        headerRowIndex = r;
        break;
      }
    }

    // Process rows
    const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;

    for (let r = startRow; r < jsonData.length; r++) {
      const row = jsonData[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      const rawNome = colNome >= 0 ? cleanStr(row[colNome]) : '';
      const rawMat = colMatricula >= 0 ? cleanMatricula(row[colMatricula]) : '';
      
      // If row has neither name nor matricula, skip
      if (!rawNome && !rawMat) continue;

      // Filter out headers repeated or titles
      if (rawNome.toUpperCase().includes('NOME') || rawNome.toUpperCase().includes('TOTAL') || rawNome.toUpperCase().includes('BATALHAO')) {
        continue;
      }

      // Determine month
      let mes: MesAno = 'Janeiro';
      if (colMes >= 0 && row[colMes]) {
        mes = normalizeMes(row[colMes]);
      } else if (sheetIsMonth) {
        mes = sheetMonth;
      } else {
        // Try searching in all cells of this row for a month word
        for (const cell of row) {
          const str = cleanStr(cell).toUpperCase();
          for (const m of MESES_DO_ANO) {
            if (str.includes(m.toUpperCase().slice(0, 4))) {
              mes = m;
              break;
            }
          }
        }
      }

      monthsFound.add(mes);

      // Match with existing military personnel database
      let matchedMilitar = efetivoList.find(m => 
        (rawMat && cleanMatricula(m.matricula) === rawMat) ||
        (rawNome && m.nomeCompleto.toUpperCase().includes(rawNome.toUpperCase())) ||
        (rawNome && m.nomeGuerra.toUpperCase().includes(rawNome.toUpperCase()))
      );

      const rawPosto = colPosto >= 0 ? cleanStr(row[colPosto]) : '';
      const posto: PostoGraduacao = matchedMilitar?.postoGraduacao || (rawPosto ? normalizePosto(rawPosto) : 'Sd');
      const nomeCompleto = matchedMilitar?.nomeCompleto || rawNome;
      const nomeGuerra = matchedMilitar?.nomeGuerra || rawNome.split(' ')[0] || '';
      const matricula = matchedMilitar?.matricula || rawMat || `PM-${Math.floor(1000 + Math.random() * 9000)}`;

      const rawDias = colDias >= 0 ? parseInt(String(row[colDias]), 10) : 30;
      const periodoDias = isNaN(rawDias) ? 30 : rawDias;

      let situacao: PrevisaoFerias['situacao'] = 'Prevista';
      if (colSituacao >= 0) {
        const s = cleanStr(row[colSituacao]).toLowerCase();
        if (s.includes('gozo') || s.includes('fruindo') || s.includes('andamento')) {
          situacao = 'Em Gozo';
        } else if (s.includes('concl') || s.includes('paga') || s.includes('gozada')) {
          situacao = 'Concluída';
        } else if (s.includes('interr') || s.includes('susp')) {
          situacao = 'Interrompida';
        }
      }

      records.push({
        id: `FERIAS-${matricula}-${mes}-${records.length + 1}`,
        matricula,
        nome: nomeCompleto,
        nomeGuerra,
        posto,
        ano: currentYear,
        mesPrevisto: mes,
        periodoDias,
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
 * Parse PDF file for vacation schedule
 */
export async function parsePdfFerias(
  file: File,
  currentYear: number = new Date().getFullYear(),
  efetivoList: EfetivoMilitar[] = []
): Promise<ParseFeriasResult> {
  const buffer = await file.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({ data: buffer }).promise;

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
        if (normLine.includes(`MES DE ${mNorm}`) || normLine.includes(`MES: ${mNorm}`) || normLine.includes(`FERIAS - ${mNorm}`) || normLine.includes(`MES ${mNorm}`) || normLine === mNorm) {
          currentContextMonth = m;
          monthsFound.add(m);
        }
      }

      // Check if line contains a military rank or matricula or name
      const hasRank = /CEL|TEN|MAJ|CAP|SUBTEN|SGT|CB|SD/i.test(normLine);
      const hasMatricula = /\b\d{4,6}[-\s]?\d\b/.test(lineText);

      if (hasRank || hasMatricula) {
        // Try extracting matricula
        const matMatch = lineText.match(/\b\d{4,6}[-\s]?\d\b/);
        const matricula = matMatch ? matMatch[0].replace(/\s/g, '') : '';

        // Extract rank
        const posto = normalizePosto(lineText);

        // Find match in military personnel database
        let matchedMilitar: EfetivoMilitar | undefined;
        if (matricula) {
          matchedMilitar = efetivoList.find(m => cleanMatricula(m.matricula) === cleanMatricula(matricula));
        }

        // If no match by matricula, try matching by name parts
        if (!matchedMilitar) {
          const words = normLine.split(/\s+/).filter(w => w.length > 3 && !['POLICIA', 'MILITAR', 'BATALHAO', 'FERIAS', 'ESTADO', 'PREVISAO', 'PLANO'].includes(w));
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
          // Clean out rank and matricula to get the name
          let cleanedName = lineText
            .replace(/\b\d{4,6}[-\s]?\d\b/, '')
            .replace(/\b(Cel|Ten-Cel|Maj|Cap|1º Ten|2º Ten|Subten|1º Sgt|2º Sgt|3º Sgt|Cb|Sd)\b/gi, '')
            .replace(/\b(Janeiro|Fevereiro|Março|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)\b/gi, '')
            .replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, '')
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

          records.push({
            id: `FERIAS-PDF-${matricula || records.length}-${rowMonth}-${records.length + 1}`,
            matricula: matricula || matchedMilitar?.matricula || `PM-${Math.floor(1000 + Math.random() * 9000)}`,
            nome: nome || (matchedMilitar?.nomeCompleto || 'Militar'),
            nomeGuerra: matchedMilitar?.nomeGuerra || (nome ? nome.split(' ')[0] : 'Militar'),
            posto: matchedMilitar?.postoGraduacao || posto,
            ano: currentYear,
            mesPrevisto: rowMonth,
            periodoDias: 30,
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
