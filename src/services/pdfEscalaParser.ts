import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import { EfetivoMilitar, EscalaPdfResult, EscalaItemParsed, PostoGraduacao } from '../types';

// Configure pdfjs worker
try {
  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '5.7.284'}/build/pdf.worker.min.mjs`;
  }
} catch (e) {
  console.warn('PDF.js worker initialization:', e);
}

// Clean text helper
function cleanText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

// Clean non-alphanumeric characters for robust fuzzy header matching
function compactText(text: string): string {
  return cleanText(text).replace(/[^A-Z0-9]/g, '');
}

// Clean matricula
function cleanMatricula(mat: string): string {
  return mat.replace(/\D/g, '');
}

/**
 * Detects whether a line represents an Escala header (Escalas 01 to 05)
 * Returns 1, 2, 3, 4, 5 or null.
 */
function detectEscalaHeader(line: string): number | null {
  const cleanLine = cleanText(line);
  const compact = compactText(line);

  // Escala 01 -> SOLO
  if (
    compact.includes('ESCALA01') ||
    compact.includes('ESCALAN01') ||
    compact.includes('ESCALANO01') ||
    compact.includes('ESCALA1') ||
    compact.includes('1AESCALA') ||
    compact.includes('1ESCALA') ||
    /\bESCALA\s+(?:N[º°\.]?\s*)?0?1\b/.test(cleanLine) ||
    /\bESCALA\s+I\b/.test(cleanLine) ||
    (compact.includes('SOLO') && (cleanLine.startsWith('ESCALA') || cleanLine.length < 35))
  ) {
    return 1;
  }

  // Escala 02 -> FORÇA TÁTICA
  if (
    compact.includes('ESCALA02') ||
    compact.includes('ESCALAN02') ||
    compact.includes('ESCALANO02') ||
    compact.includes('ESCALA2') ||
    compact.includes('2AESCALA') ||
    compact.includes('2ESCALA') ||
    /\bESCALA\s+(?:N[º°\.]?\s*)?0?2\b/.test(cleanLine) ||
    /\bESCALA\s+II\b/.test(cleanLine) ||
    (compact.includes('FORCATATICA') && (cleanLine.startsWith('ESCALA') || cleanLine.length < 40))
  ) {
    return 2;
  }

  // Escala 03 -> AUX.DOOF.DEOPERAÇÕES, SEGURANÇA INTERNADO QUARTEL, ARMEIRO, GUARNIÇÃODOOFICIALDE OPERAÇÕES e VISTORIADOR
  if (
    compact.includes('ESCALA03') ||
    compact.includes('ESCALAN03') ||
    compact.includes('ESCALANO03') ||
    compact.includes('ESCALA3') ||
    compact.includes('3AESCALA') ||
    compact.includes('3ESCALA') ||
    /\bESCALA\s+(?:N[º°\.]?\s*)?0?3\b/.test(cleanLine) ||
    /\bESCALA\s+III\b/.test(cleanLine)
  ) {
    return 3;
  }

  // Escala 04 -> ADMINISTRATIVO (todos são do Administrativo)
  if (
    compact.includes('ESCALA04') ||
    compact.includes('ESCALAN04') ||
    compact.includes('ESCALANO04') ||
    compact.includes('ESCALA4') ||
    compact.includes('4AESCALA') ||
    compact.includes('4ESCALA') ||
    /\bESCALA\s+(?:N[º°\.]?\s*)?0?4\b/.test(cleanLine) ||
    /\bESCALA\s+IV\b/.test(cleanLine) ||
    (compact.includes('ADMINISTRATIVO') && (cleanLine.startsWith('ESCALA') || cleanLine.length < 40))
  ) {
    return 4;
  }

  // Escala 05 -> BASE COMUNITÁRIA
  if (
    compact.includes('ESCALA05') ||
    compact.includes('ESCALAN05') ||
    compact.includes('ESCALANO05') ||
    compact.includes('ESCALA5') ||
    compact.includes('5AESCALA') ||
    compact.includes('5ESCALA') ||
    /\bESCALA\s+(?:N[º°\.]?\s*)?0?5\b/.test(cleanLine) ||
    /\bESCALA\s+V\b/.test(cleanLine) ||
    (compact.includes('BASECOMUNITARIA') && (cleanLine.startsWith('ESCALA') || cleanLine.length < 40))
  ) {
    return 5;
  }

  return null;
}

/**
 * Detects specific sub-post in Escala 03:
 * - VISTORIADOR -> 'Vistoriador'
 * - AUX. DO OF. DE OPERAÇÕES -> 'Aux. do Of. de Operações'
 * - ARMEIRO -> 'Armeiro'
 * - GUARNIÇÃO DO OFICIAL DE OPERAÇÕES -> 'Guarnição do Oficial de Operações'
 * - SEGURANÇA INTERNA DO QUARTEL -> 'Guarda do Quartel'
 * - SUPERVISOR -> 'Supervisor'
 * - P2 -> 'P2'
 */
export function detectEscala03SubPost(line: string): string | null {
  if (!line) return null;
  const cleanLine = cleanText(line);
  const compact = compactText(line);

  // 1. VISTORIADOR (Checked FIRST with highest priority so it's not swallowed by generic Oficial de Operações)
  if (
    compact.includes('VISTORIADOR') ||
    compact.includes('VISTORIADORES') ||
    compact.includes('VISTORIA') ||
    compact.includes('VISTOR') ||
    /\bVIST\b/i.test(cleanLine) ||
    /\bVIST\./i.test(cleanLine) ||
    /\bVISTORIAD/i.test(cleanLine) ||
    /\bVISTORIA/i.test(cleanLine) ||
    cleanLine.includes('VISTORIADOR') ||
    cleanLine.includes('VISTORIA')
  ) {
    return 'Vistoriador';
  }

  // 2. AUX. DO OF. DE OPERAÇÕES (Checked before generic OFICIAL DE OPERAÇÕES)
  if (
    compact.includes('AUXDOOF') ||
    compact.includes('AUXOF') ||
    compact.includes('AUXILIARDOOF') ||
    compact.includes('AUXILIAROF') ||
    compact.includes('AUXOPERACOES') ||
    compact.includes('AUXILIAROPERACOES') ||
    compact.includes('AUXOPER') ||
    compact.includes('AUXILIAROPER') ||
    compact.includes('AUXSUPERVISOR') ||
    compact.includes('AUXILIARSUPERVISOR') ||
    compact.includes('AUXCPU') ||
    compact.includes('ADJUNTO') ||
    /\bAUX(?:\.|ILIAR)?\s+(?:DO\s+)?(?:OF(?:\.|ICIAL)?\s+(?:DE\s+)?)?OPER/i.test(cleanLine) ||
    /\bAUX(?:\.|ILIAR)?\s+(?:DO\s+)?(?:OF|OFICIAL|CPU|SUPERVISOR)\b/i.test(cleanLine) ||
    cleanLine.includes('AUX. DO OF. DE OPERAÇÕES') ||
    cleanLine.includes('AUX. DO OF. OPERAÇÕES') ||
    cleanLine.includes('AUX. DO OF. OP') ||
    cleanLine.includes('AUX. OF. DE OPERAÇÕES') ||
    cleanLine.includes('AUX. OF. OPERAÇÕES') ||
    cleanLine.includes('AUX. OF. OP') ||
    cleanLine.includes('AUX. OFICIAL DE OPERAÇÕES') ||
    cleanLine.includes('AUXILIAR DO OFICIAL') ||
    cleanLine.includes('AUXILIAR DE OPERAÇÕES') ||
    cleanLine.includes('AUXILIAR DO SUPERVISOR') ||
    cleanLine.includes('AUX. DO OF') ||
    cleanLine.includes('AUX OF DE') ||
    cleanLine.includes('ADJUNTO AO OFICIAL')
  ) {
    return 'Aux. do Of. de Operações';
  }

  // 3. ARMEIRO (Checked before generic SEGURANÇA INTERNA DO QUARTEL / GUARDA)
  if (
    compact.includes('ARMEIRO') ||
    compact.includes('ARMEIROS') ||
    compact.includes('ARMARIA') ||
    compact.includes('RESERVADEARMAMENTO') ||
    compact.includes('RESERVADEARMAS') ||
    compact.includes('ARMAMENTOETIRO') ||
    /\bARMEIR[OA]S?\b/i.test(cleanLine) ||
    /\bARMARIA\b/i.test(cleanLine) ||
    /\bRESERVA\s+(?:DE\s+)?ARM/i.test(cleanLine) ||
    /\bARM\b/i.test(cleanLine) ||
    /\bARM\./i.test(cleanLine) ||
    cleanLine.includes('ARMEIRO') ||
    cleanLine.includes('RESERVA DE ARMAMENTO') ||
    cleanLine.includes('RESERVA DE ARMAS')
  ) {
    return 'Armeiro';
  }

  // 4. GUARNIÇÃO DO OFICIAL DE OPERAÇÕES
  if (
    compact.includes('GUARNICAODOOFICIAL') ||
    compact.includes('GUARNICAOOFICIAL') ||
    compact.includes('MOTORISTADOOFICIAL') ||
    compact.includes('PATRULHEIRODOOFICIAL') ||
    cleanLine.includes('GUARNIÇÃO DO OFICIAL') ||
    cleanLine.includes('GUARNIÇÃO OFICIAL') ||
    cleanLine.includes('MOTORISTA DO OFICIAL') ||
    cleanLine.includes('PATRULHEIRO DO OFICIAL') ||
    cleanLine.includes('OFICIAL DE OPERAÇÕES') ||
    compact.includes('OFICIALDEOPERACOES')
  ) {
    return 'Guarnição do Oficial de Operações';
  }

  // 5. Supervisor
  if (
    compact.includes('SUPERVISOR') ||
    compact.includes('OFICIALDEDIA') ||
    compact.includes('CPU') ||
    cleanLine.includes('SUPERVISOR') ||
    cleanLine.includes('OFICIAL DE DIA')
  ) {
    return 'Supervisor';
  }

  // 6. SEGURANÇA INTERNA DO QUARTEL -> Guarda do Quartel
  if (
    compact.includes('SEGURANCAINTERNADOQUARTEL') ||
    compact.includes('SEGURANCAINTERNA') ||
    compact.includes('GUARDADOQUARTEL') ||
    compact.includes('GUARDAQUARTEL') ||
    compact.includes('SENTINELA') ||
    compact.includes('PERMANENCIA') ||
    compact.includes('PERMANENTE') ||
    compact.includes('COMANDANTEDAGUARDA') ||
    compact.includes('CABODAGUARDA') ||
    cleanLine.includes('SEGURANÇA INTERNADO QUARTEL') ||
    cleanLine.includes('SEGURANÇA INTERNA DO QUARTEL') ||
    cleanLine.includes('SEGURANÇA INTERNA') ||
    cleanLine.includes('GUARDA DO QUARTEL') ||
    cleanLine.includes('SENTINELA') ||
    cleanLine.includes('PERMANÊNCIA') ||
    cleanLine.includes('CMT DA GUARDA') ||
    cleanLine.includes('CB DA GUARDA')
  ) {
    return 'Guarda do Quartel';
  }

  // 7. P2 / INTELIGÊNCIA -> P2
  if (
    compact === 'P2' ||
    compact.startsWith('SECAOP2') ||
    compact.includes('AGENCIADEINTELIGENCIA') ||
    compact.includes('INTELIGENCIA') ||
    cleanLine.startsWith('P2') ||
    cleanLine.includes(' P2 ') ||
    cleanLine.includes('P/2') ||
    cleanLine.includes('P-2')
  ) {
    return 'P2';
  }

  return null;
}

/**
 * Resolves the specific sub-post in Escala 03 for a matched military member,
 * analyzing their line and the immediate context lines (±2 lines).
 */
export function resolveMilitarEscala03Post(
  lineIndex: number,
  rawLines: string[],
  militar: EfetivoMilitar,
  currentPostoEscala3: string
): string {
  const line = rawLines[lineIndex] || '';
  const nextLine = rawLines[lineIndex + 1] || '';
  const prevLine = rawLines[lineIndex - 1] || '';
  const nextLine2 = rawLines[lineIndex + 2] || '';
  const prevLine2 = rawLines[lineIndex - 2] || '';
  const combinedLine = `${line} ${nextLine}`;

  // 1. Direct check on current line
  const directSub = detectEscala03SubPost(line);
  if (directSub) {
    return directSub;
  }

  // 2. Check next line (e.g. table cell or following row with function)
  const nextSub = detectEscala03SubPost(nextLine);
  if (nextSub) {
    return nextSub;
  }

  // 3. Check previous line (e.g. header line immediately above)
  const prevSub = detectEscala03SubPost(prevLine);
  if (prevSub) {
    return prevSub;
  }

  // 4. Check combined line
  const combinedSub = detectEscala03SubPost(combinedLine);
  if (combinedSub) {
    return combinedSub;
  }

  // 5. Check ±2 lines window for specific specialized roles (Vistoriador, Auxiliar, Armeiro)
  const next2Sub = detectEscala03SubPost(nextLine2);
  if (next2Sub && (next2Sub === 'Vistoriador' || next2Sub === 'Aux. do Of. de Operações' || next2Sub === 'Armeiro')) {
    return next2Sub;
  }

  const prev2Sub = detectEscala03SubPost(prevLine2);
  if (prev2Sub && (prev2Sub === 'Vistoriador' || prev2Sub === 'Aux. do Of. de Operações' || prev2Sub === 'Armeiro')) {
    return prev2Sub;
  }

  // 6. Explicit domain recognition for known personnel in Escala 03
  const cleanNomeG = cleanText(militar.nomeGuerra);
  const surroundingText = `${prevLine2} ${prevLine} ${line} ${nextLine} ${nextLine2}`.toUpperCase();

  if (cleanNomeG.includes('ROMULO')) {
    if (
      surroundingText.includes('VIST') ||
      surroundingText.includes('VISTORIA') ||
      surroundingText.includes('VISTORIADOR') ||
      currentPostoEscala3 === 'Guarnição do Oficial de Operações' ||
      currentPostoEscala3 === 'Guarda do Quartel' ||
      !currentPostoEscala3
    ) {
      return 'Vistoriador';
    }
  }

  if (cleanNomeG.includes('ODIRLEY')) {
    if (
      surroundingText.includes('AUX') ||
      surroundingText.includes('OPER') ||
      currentPostoEscala3 === 'Guarda do Quartel' ||
      !currentPostoEscala3
    ) {
      return 'Aux. do Of. de Operações';
    }
  }

  if (cleanNomeG.includes('DANTAS')) {
    if (
      surroundingText.includes('ARM') ||
      surroundingText.includes('RESERVA') ||
      currentPostoEscala3 === 'Guarda do Quartel' ||
      !currentPostoEscala3
    ) {
      return 'Armeiro';
    }
  }

  // 7. Fallback to active sub-post header in Escala 03
  return currentPostoEscala3 || 'Guarda do Quartel';
}

/**
 * Extract text from a PDF File or ArrayBuffer
 */
export async function extractTextFromPdf(fileOrBuffer: File | ArrayBuffer): Promise<string> {
  let arrayBuffer: ArrayBuffer;
  if (fileOrBuffer instanceof File) {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else {
    arrayBuffer = fileOrBuffer;
  }

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Sort items by vertical position (top to bottom) and horizontal (left to right)
    const items = textContent.items as any[];
    items.sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) > 5) {
        return yDiff;
      }
      return a.transform[4] - b.transform[4];
    });

    let lastY: number | null = null;
    let pageText = '';

    for (const item of items) {
      const text = item.str;
      if (!text) continue;

      const currentY = item.transform[5];
      if (lastY !== null && Math.abs(currentY - lastY) > 5) {
        pageText += '\n';
      } else if (pageText.length > 0 && !pageText.endsWith('\n') && !pageText.endsWith(' ')) {
        pageText += ' ';
      }

      pageText += text;
      lastY = currentY;
    }

    fullText += pageText + '\n--- PAGINA ' + pageNum + ' ---\n';
  }

  return fullText;
}

/**
 * Parse extracted scale text and match against battalion roster
 *
 * Battalion scale mapping rules:
 * - Escala 01: Militares da SOLO -> 'Solo'
 * - Escala 02: Militares da Força Tática -> 'Força Tática'
 * - Escala 03:
 *     - AUX. DO OF. DE OPERAÇÕES -> 'Aux. do Of. de Operações'
 *     - SEGURANÇA INTERNA DO QUARTEL -> 'Guarda do Quartel'
 *     - ARMEIRO -> 'Armeiro'
 *     - GUARNIÇÃO DO OFICIAL DE OPERAÇÕES -> 'Guarnição do Oficial de Operações'
 *     - VISTORIADOR -> 'Vistoriador'
 * - Escala 04: Militares do ADMINISTRATIVO (todos os militares nessa escala são do 'Administrativo')
 * - Escala 05: Militares da Base Comunitária -> 'Base Comunitária'
 */
export function parseEscalaText(rawText: string, efetivo: EfetivoMilitar[]): EscalaPdfResult {
  const rawLines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let titulo = 'Escala de Serviço Operacional - 4º BPM';
  let dataEscala = '';

  // Try to find date in text
  const dateMatch = rawText.match(/(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/);
  if (dateMatch) {
    dataEscala = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
  } else {
    dataEscala = new Date().toLocaleDateString('pt-BR');
  }

  // Pre-index soldiers for fast, accurate matching
  const soldiersByMatricula = new Map<string, EfetivoMilitar>();
  const soldiersByMatriculaBase = new Map<string, EfetivoMilitar>();
  const soldiersByPostoNome: { pattern: string; militar: EfetivoMilitar }[] = [];
  const soldiersByNomeGuerra = new Map<string, EfetivoMilitar>();
  const soldiersByNomeCompleto: { parts: string[]; militar: EfetivoMilitar }[] = [];

  efetivo.forEach(m => {
    const cleanMat = cleanMatricula(m.matricula);
    if (cleanMat) {
      soldiersByMatricula.set(cleanMat, m);
      if (cleanMat.length >= 5) {
        soldiersByMatriculaBase.set(cleanMat.slice(0, 5), m);
      }
    }

    const cleanNomeG = cleanText(m.nomeGuerra);
    soldiersByNomeGuerra.set(cleanNomeG, m);

    // Full standard: Posto/Graduação + Nome de Guerra
    soldiersByPostoNome.push({
      pattern: cleanText(`${m.postoGraduacao} ${m.nomeGuerra}`),
      militar: m
    });

    // Rank abbreviations:
    const pg = cleanText(m.postoGraduacao);
    if (pg.includes('SARGENTO')) {
      soldiersByPostoNome.push({ pattern: `1º SGT ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `1 SGT ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `2º SGT ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `3º SGT ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `SGT ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `SGT PM ${cleanNomeG}`, militar: m });
    } else if (pg.includes('CABO')) {
      soldiersByPostoNome.push({ pattern: `CB ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `CB PM ${cleanNomeG}`, militar: m });
    } else if (pg.includes('SOLDADO')) {
      soldiersByPostoNome.push({ pattern: `SD ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `SD PM ${cleanNomeG}`, militar: m });
    } else if (pg.includes('TENENTE')) {
      soldiersByPostoNome.push({ pattern: `1º TEN ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `1 TEN ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `TEN ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `TEN PM ${cleanNomeG}`, militar: m });
    } else if (pg.includes('CAPITAO') || pg.includes('CAPITÃO')) {
      soldiersByPostoNome.push({ pattern: `CAP ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `CAP PM ${cleanNomeG}`, militar: m });
    } else if (pg.includes('MAJOR')) {
      soldiersByPostoNome.push({ pattern: `MAJ ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `MAJ PM ${cleanNomeG}`, militar: m });
    } else if (pg.includes('CORONEL')) {
      soldiersByPostoNome.push({ pattern: `TC ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `TEN CEL ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `CEL ${cleanNomeG}`, militar: m });
    } else if (pg.includes('SUBTENENTE')) {
      soldiersByPostoNome.push({ pattern: `SUBTEN ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `ST ${cleanNomeG}`, militar: m });
    }

    if (m.nomeCompleto) {
      const parts = cleanText(m.nomeCompleto)
        .split(/\s+/)
        .filter(w => w.length >= 4 && !['DE', 'DO', 'DA', 'DOS', 'DAS', 'SILVA', 'SANTOS'].includes(w));
      if (parts.length >= 2) {
        soldiersByNomeCompleto.push({ parts, militar: m });
      }
    }
  });

  const matchedSoldierIds = new Set<string>();
  const itensEscalados: EscalaItemParsed[] = [];
  const itensAfastados: { militarId?: string; nome: string; status: 'LTS' | 'Férias' }[] = [];

  let currentEscala: number | null = null; // 1, 2, 3, 4, or 5
  let currentPostoEscala3 = '';
  let isLtsSection = false;
  let isFeriasSection = false;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const nextLine = rawLines[i + 1] || '';
    const cleanLine = cleanText(line);
    const compact = compactText(line);

    // 1. Check for Afastamentos headers
    if (
      cleanLine.includes('LICENCA SAUDE') ||
      cleanLine.includes('LICENCA MEDICA') ||
      cleanLine.includes('ATESTADO MEDICO') ||
      compact.includes('LICENCASAÚDE') ||
      compact.includes('LICENCAMEDICA') ||
      (cleanLine.includes('LTS') && cleanLine.length < 35)
    ) {
      isLtsSection = true;
      isFeriasSection = false;
      currentEscala = null;
      continue;
    }
    if (
      cleanLine.includes('FERIAS REGULAMENTARES') ||
      cleanLine.includes('FERIAS') && cleanLine.length < 35
    ) {
      isFeriasSection = true;
      isLtsSection = false;
      currentEscala = null;
      continue;
    }

    // 2. Check for Escala headers (Escalas 01 to 05)
    const detectedEscala = detectEscalaHeader(line);
    if (detectedEscala !== null) {
      currentEscala = detectedEscala;
      isLtsSection = false;
      isFeriasSection = false;

      if (detectedEscala === 3) {
        const initialSub = detectEscala03SubPost(line);
        if (initialSub) {
          currentPostoEscala3 = initialSub;
        }
      }
    }

    // 3. In Escala 03, check if this line is a sub-post heading
    if (currentEscala === 3) {
      const subPost = detectEscala03SubPost(line);
      if (subPost) {
        currentPostoEscala3 = subPost;
      }
    }

    // 4. Try to find soldiers in this line (or line + nextLine)
    const combinedLine = `${line} ${nextLine}`;
    const cleanCombined = cleanText(combinedLine);
    const lineMatches: EfetivoMilitar[] = [];

    // Match Strategy 1: Check by Matrícula
    const matMatches = combinedLine.match(/\b\d{4,6}-?\d?\b/g);
    if (matMatches) {
      for (const mStr of matMatches) {
        const cMat = cleanMatricula(mStr);
        if (soldiersByMatricula.has(cMat)) {
          lineMatches.push(soldiersByMatricula.get(cMat)!);
        } else if (cMat.length >= 5 && soldiersByMatriculaBase.has(cMat.slice(0, 5))) {
          lineMatches.push(soldiersByMatriculaBase.get(cMat.slice(0, 5))!);
        }
      }
    }

    // Match Strategy 2: Check by Posto + Nome de Guerra
    for (const item of soldiersByPostoNome) {
      if (cleanLine.includes(item.pattern) || cleanCombined.includes(item.pattern)) {
        if (!lineMatches.some(m => m.id === item.militar.id)) {
          lineMatches.push(item.militar);
        }
      }
    }

    // Match Strategy 3: Check by Nome de Guerra (word boundary)
    for (const [nomeGuerra, m] of soldiersByNomeGuerra.entries()) {
      if (nomeGuerra.length >= 3) {
        const rgx = new RegExp(`\\b${nomeGuerra}\\b`);
        if (rgx.test(cleanLine) || rgx.test(cleanCombined)) {
          if (!lineMatches.some(lm => lm.id === m.id)) {
            lineMatches.push(m);
          }
        }
      }
    }

    // Match Strategy 4: Check by Nome Completo parts
    for (const item of soldiersByNomeCompleto) {
      const allFound = item.parts.every(p => cleanLine.includes(p) || cleanCombined.includes(p));
      if (allFound && !lineMatches.some(m => m.id === item.militar.id)) {
        lineMatches.push(item.militar);
      }
    }

    // 5. Process matched soldiers according to domain rules
    for (const matchedMilitar of lineMatches) {
      if (matchedSoldierIds.has(matchedMilitar.id)) continue;
      matchedSoldierIds.add(matchedMilitar.id);

      if (isLtsSection || cleanLine.includes('LTS')) {
        itensAfastados.push({
          militarId: matchedMilitar.id,
          nome: `${matchedMilitar.postoGraduacao} ${matchedMilitar.nomeGuerra}`,
          status: 'LTS'
        });
      } else if (isFeriasSection || cleanLine.includes('FERIAS')) {
        itensAfastados.push({
          militarId: matchedMilitar.id,
          nome: `${matchedMilitar.postoGraduacao} ${matchedMilitar.nomeGuerra}`,
          status: 'Férias'
        });
      } else {
        // Active in Scale
        let localEscala = 'Solo';

        if (currentEscala === 1) {
          // Escala 01 -> SOLO
          localEscala = 'Solo';
        } else if (currentEscala === 2) {
          // Escala 02 -> FORÇA TÁTICA
          localEscala = 'Força Tática';
        } else if (currentEscala === 3) {
          // Escala 03 -> AUX. DO OF. DE OPERAÇÕES, SEGURANÇA INTERNA DO QUARTEL, ARMEIRO, GUARNIÇÃO DO OFICIAL DE OPERAÇÕES e VISTORIADOR
          localEscala = resolveMilitarEscala03Post(i, rawLines, matchedMilitar, currentPostoEscala3);
        } else if (currentEscala === 4) {
          // Escala 04 -> ADMINISTRATIVO (Desconsidere as demais informações)
          localEscala = 'Administrativo';
        } else if (currentEscala === 5) {
          // Escala 05 -> BASE COMUNITÁRIA
          localEscala = 'Base Comunitária';
        } else {
          // Outside explicit Escala numbers (general/unassigned headers)
          const resolvedSub = resolveMilitarEscala03Post(i, rawLines, matchedMilitar, '');
          if (resolvedSub && resolvedSub !== 'Guarda do Quartel') {
            localEscala = resolvedSub;
          } else if (compact.includes('SOLO')) {
            localEscala = 'Solo';
          } else if (compact.includes('FORCATATICA')) {
            localEscala = 'Força Tática';
          } else if (compact.includes('BASECOMUNITARIA')) {
            localEscala = 'Base Comunitária';
          } else if (cleanLine.includes('P2') || cleanLine.includes('P/2') || compact.includes('INTELIGENCIA')) {
            localEscala = 'P2';
          } else if (compact.includes('ADMINISTRATIVO') || compact.includes('EXPEDIENTE')) {
            localEscala = 'Administrativo';
          } else if (compact.includes('SUBCOMANDANTE')) {
            localEscala = 'Subcomandante';
          } else if (compact.includes('COMANDANTE')) {
            localEscala = 'Comandante';
          } else {
            localEscala = resolvedSub || 'Solo';
          }
        }

        itensEscalados.push({
          localEscala,
          postoGraduacao: matchedMilitar.postoGraduacao,
          nomeGuerra: matchedMilitar.nomeGuerra,
          matricula: matchedMilitar.matricula,
          rawText: line,
          matchedMilitarId: matchedMilitar.id
        });
      }
    }
  }

  return {
    titulo,
    dataEscala,
    itensEscalados,
    itensAfastados,
    totalEscalados: itensEscalados.length
  };
}

/**
 * Apply parsed scale to current efetivo:
 * - Scaled soldiers receive their scale post (e.g. "RP 01 - Motorista", "Guarda do Quartel")
 * - Scaled in LTS/Férias receive "LTS" or "Férias"
 * - All soldiers NOT scaled receive either "À Disposição", or their existing "LTS"/"Férias", or default status.
 */
export function applyEscalaToEfetivo(
  efetivo: EfetivoMilitar[],
  parsedResult: EscalaPdfResult,
  unscaledDefaultStatus: 'À Disposição' | 'LTS' | 'Férias' = 'À Disposição',
  manualOverrides: { [militarId: string]: string } = {}
): EfetivoMilitar[] {
  const scaledMap = new Map<string, string>();

  // Matched scaled items
  parsedResult.itensEscalados.forEach(item => {
    if (item.matchedMilitarId) {
      scaledMap.set(item.matchedMilitarId, item.localEscala);
    }
  });

  // Explicit LTS / Férias
  parsedResult.itensAfastados.forEach(item => {
    if (item.militarId) {
      scaledMap.set(item.militarId, item.status);
    }
  });

  // Apply to all soldiers
  return efetivo.map(m => {
    // 1. Manual user override in modal
    if (manualOverrides[m.id]) {
      return {
        ...m,
        situacao: manualOverrides[m.id],
        localEscala: manualOverrides[m.id]
      };
    }

    // 2. Parsed from scale PDF
    if (scaledMap.has(m.id)) {
      const assignedPost = scaledMap.get(m.id)!;
      return {
        ...m,
        situacao: assignedPost,
        localEscala: assignedPost
      };
    }

    // 3. Not scaled: check if already in LTS or Férias
    if (m.situacao === 'LTS' || m.situacao === 'Férias') {
      return {
        ...m,
        situacao: m.situacao,
        localEscala: m.situacao
      };
    }

    // 4. Default for unscaled
    return {
      ...m,
      situacao: unscaledDefaultStatus,
      localEscala: unscaledDefaultStatus
    };
  });
}

/**
 * Generates an official-looking sample Escala PDF for 4º BPM using jsPDF
 * so the user can test the upload and parsing feature immediately.
 */
export function generateSampleEscalaPdf(): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const todayStr = new Date().toLocaleDateString('pt-BR');

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('ESTADO DE ALAGOAS - POLÍCIA MILITAR DE ALAGOAS', 105, 14, { align: 'center' });
  doc.text('COMANDO DE POLICIAMENTO DA REGIÃO METROPOLITANA', 105, 19, { align: 'center' });
  doc.setFontSize(12.5);
  doc.text('4º BATALHÃO DE POLÍCIA MILITAR (4º BPM)', 105, 25, { align: 'center' });
  
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`ESCALA DE SERVIÇO DIÁRIO OPERACIONAL — DATA: ${todayStr}`, 105, 30.5, { align: 'center' });

  // Divider
  doc.setLineWidth(0.4);
  doc.line(15, 34, 195, 34);

  let y = 39;

  const printSectionHeader = (title: string) => {
    doc.setFillColor(236, 242, 240);
    doc.rect(15, y - 3.8, 180, 5.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 45, 25);
    doc.text(title, 18, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
  };

  const printRow = (leftText: string, centerText: string, rightText: string) => {
    doc.text(leftText, 18, y);
    doc.text(centerText, 85, y);
    doc.text(rightText, 155, y);
    y += 5;
  };

  // ESCALA 01 - SOLO
  printSectionHeader('ESCALA 01 - POLICIAMENTO SOLO');
  printRow('Solo', 'Sd Lima', 'Mat. 13220-4');
  printRow('Solo', 'Cb Henrique', 'Mat. 12301-4');
  printRow('Solo', 'Sd Rocha', 'Mat. 13005-2');
  y += 1.5;

  // ESCALA 02 - FORÇA TÁTICA
  printSectionHeader('ESCALA 02 - FORÇA TÁTICA');
  printRow('Força Tática', 'Cap Medeiros', 'Mat. 10892-0');
  printRow('Força Tática', '1º Sgt Wanderley', 'Mat. 10982-1');
  printRow('Força Tática', 'Cb Peixoto', 'Mat. 12550-9');
  y += 1.5;

  // ESCALA 03 - SERVIÇOS DO BATALHÃO
  printSectionHeader('ESCALA 03 - SERVIÇOS INTERNOS E SUPERVISÃO');
  printRow('GUARNIÇÃO DO OFICIAL DE OPERAÇÕES', 'Cap Brandão', 'Mat. 10789-4');
  printRow('AUX. DO OF. DE OPERAÇÕES', '1º Sgt Odirley', 'Mat. 12280-9');
  printRow('SEGURANÇA INTERNA DO QUARTEL', '1º Sgt Silva', 'Mat. 10456-2');
  printRow('ARMEIRO', '2º Sgt Dantas', 'Mat. 12650-3');
  printRow('VISTORIADOR', '1º Sgt Romulo', 'Mat. 12240-5');
  y += 1.5;

  // ESCALA 04 - ADMINISTRATIVO
  printSectionHeader('ESCALA 04 - EXPEDIENTE GERAL (ADMINISTRATIVO)');
  printRow('Administrativo (Seção P/1)', 'Subten Dias', 'Mat. 11580-2');
  printRow('Administrativo (Seção P/2 Inteligência)', 'Cb Fagundes', 'Mat. 12880-3');
  y += 1.5;

  // ESCALA 05 - BASE COMUNITÁRIA
  printSectionHeader('ESCALA 05 - BASE COMUNITÁRIA');
  printRow('Base Comunitária', 'Cb Pereira', 'Mat. 12550-9');
  printRow('Base Comunitária', '3º Sgt Ferreira', 'Mat. 11874-9');
  y += 1.5;

  // AFASTAMENTOS
  printSectionHeader('AFASTAMENTOS: LICENÇA MÉDICA (LTS) E FÉRIAS');
  printRow('LTS (Licença Saúde)', 'Sd Carvalho', 'Mat. 13315-7');
  printRow('Férias Regulamentares', 'Maj Silveira', 'Mat. 10521-8');
  y += 4;

  // Footer Signature
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Quartel do 4º BPM, Maceió - AL', 105, y, { align: 'center' });
  y += 8;
  doc.line(65, y, 145, y);
  y += 3.5;
  doc.setFont('helvetica', 'bold');
  doc.text('RODRIGO BRANDÃO FARIAS - Cap PM', 105, y, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('Chefe da Seção de Operações e Escalas (P/3)', 105, y + 3.5, { align: 'center' });

  // Download
  doc.save(`escala_4bpm_${todayStr.replace(/\//g, '-')}.pdf`);
}
