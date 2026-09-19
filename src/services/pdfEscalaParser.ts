import jsPDF from 'jspdf';
import { EfetivoMilitar, EscalaPdfResult, EscalaItemParsed, PostoGraduacao, EscalaTipo } from '../types';
import { ensureUniqueIds } from './efetivoDatabase';
import pdfjsLib, { safeGetPageTextContent } from './pdfWorkerSetup';

/**
 * Normalizes text: removes accents, trims, and converts to uppercase
 */
function cleanText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

/**
 * Compact representation without spaces or special characters for robust matching
 */
function compactText(text: string): string {
  return cleanText(text).replace(/[^A-Z0-9]/g, '');
}

/**
 * Strips non-digit characters from matricula
 */
function cleanMatricula(mat: string): string {
  if (!mat) return '';
  return mat.replace(/\D/g, '');
}

/**
 * Formats a clean matricula into standard PM format (e.g. 12345-6)
 */
function formatMatricula(raw: string): string {
  const digits = cleanMatricula(raw);
  if (!digits) return '';
  if (digits.length >= 5) {
    return `${digits.slice(0, digits.length - 1)}-${digits.slice(-1)}`;
  }
  return digits;
}

/**
 * Normalizes any extracted rank string to a valid PostoGraduacao
 */
function normalizeRank(raw: string): PostoGraduacao {
  const norm = cleanText(raw);
  if ((norm.includes('CEL') && norm.includes('TEN')) || norm.includes('TEN-CEL') || norm.includes('TC')) return 'Ten-Cel';
  if (norm.includes('CEL') && !norm.includes('TEN')) return 'Cel';
  if (norm.includes('MAJ')) return 'Maj';
  if (norm.includes('CAP')) return 'Cap';
  if (norm.includes('1') && norm.includes('TEN')) return '1º Ten';
  if (norm.includes('2') && norm.includes('TEN')) return '2º Ten';
  if (norm.includes('TEN')) return '1º Ten';
  if (norm.includes('SUB') || norm === 'ST') return 'Subten';
  if (norm.includes('1') && norm.includes('SGT')) return '1º Sgt';
  if (norm.includes('2') && norm.includes('SGT')) return '2º Sgt';
  if (norm.includes('3') && norm.includes('SGT')) return '3º Sgt';
  if (norm.includes('SGT')) return '3º Sgt';
  if (norm.includes('CB') || norm.includes('CABO')) return 'Cb';
  return 'Sd';
}

/**
 * Resolves standard scale type based on assigned post
 */
function getEscalaTipoForPost(posto: string): EscalaTipo {
  const lower = posto.toLowerCase();
  if (lower.includes('solo')) return 'SOLO';
  if (lower.includes('força tática') || lower.includes('forca tatica')) return 'FT';
  if (lower.includes('administrativo') || lower.includes('expediente') || lower === 'p2') return 'ADMIN';
  return '24H';
}

/**
 * Detects whether a line represents an Escala header (Escalas 01 to 05)
 * Returns 1, 2, 3, 4, 5 or null.
 */
export function detectEscalaHeader(line: string): number | null {
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

  // Escala 03 -> SERVIÇOS INTERNOS E SUPERVISÃO
  if (
    compact.includes('ESCALA03') ||
    compact.includes('ESCALAN03') ||
    compact.includes('ESCALANO03') ||
    compact.includes('ESCALA3') ||
    compact.includes('3AESCALA') ||
    compact.includes('3ESCALA') ||
    /\bESCALA\s+(?:N[º°\.]?\s*)?0?3\b/.test(cleanLine) ||
    /\bESCALA\s+III\b/.test(cleanLine) ||
    compact.includes('SERVICOSINTERNOS') ||
    compact.includes('SERVICOINTERNO')
  ) {
    return 3;
  }

  // Escala 04 -> ADMINISTRATIVO (todos são classificados obrigatoriamente como Administrativo)
  if (
    compact.includes('ESCALA04') ||
    compact.includes('ESCALAN04') ||
    compact.includes('ESCALANO04') ||
    compact.includes('ESCALA4') ||
    compact.includes('4AESCALA') ||
    compact.includes('4ESCALA') ||
    /\bESCALA\s+(?:N[º°\.]?\s*)?0?4\b/.test(cleanLine) ||
    /\bESCALA\s+IV\b/.test(cleanLine) ||
    (compact.includes('ADMINISTRATIVO') && (cleanLine.startsWith('ESCALA') || cleanLine.length < 40)) ||
    (compact.includes('EXPEDIENTE') && (cleanLine.startsWith('ESCALA') || cleanLine.length < 40))
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
 * Detects specific sub-post in Escala 03 as explicitly requested:
 * 1. AUX.DOOF.DEOPERAÇÕES (e variações como Aux. do Of. de Operações / Adjunto) -> 'Auxiliar do Supervisor'
 * 2. SEGURANÇA INTERNADO QUARTEL (e variações como Segurança Interna / Guarda) -> 'Guarda do Quartel'
 * 3. ARMEIRO (e variações como Reserva de Armamento) -> 'Reserva de Armamento'
 * 4. GUARNIÇÃODOOFICIALDE OPERAÇÕES (e variações como Oficial de Operações / Supervisor) -> 'Supervisor'
 * 5. VISTORIADOR -> 'Vistoriador'
 */
export function detectEscala03SubPost(line: string): string | null {
  if (!line) return null;
  const cleanLine = cleanText(line);
  const compact = compactText(line);

  // 1. VISTORIADOR
  if (
    compact.includes('VISTORIADOR') ||
    compact.includes('VISTORIADORES') ||
    compact.includes('VISTORIA') ||
    compact.includes('VISTOR') ||
    /\bVIST\b/i.test(cleanLine) ||
    /\bVIST\./i.test(cleanLine) ||
    /\bVISTORIAD/i.test(cleanLine) ||
    cleanLine.includes('VISTORIADOR') ||
    cleanLine.includes('VISTORIA')
  ) {
    return 'Vistoriador';
  }

  // 2. AUX.DOOF.DEOPERAÇÕES (e variações como Aux. do Of. de Operações / Adjunto) -> 'Auxiliar do Supervisor'
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
    return 'Auxiliar do Supervisor';
  }

  // 3. ARMEIRO (e variações como Reserva de Armamento) -> 'Reserva de Armamento'
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
    return 'Reserva de Armamento';
  }

  // 4. GUARNIÇÃODOOFICIALDE OPERAÇÕES (e variações como Oficial de Operações / Supervisor) -> 'Supervisor'
  if (
    compact.includes('GUARNICAODOOFICIAL') ||
    compact.includes('GUARNICAOOFICIAL') ||
    compact.includes('MOTORISTADOOFICIAL') ||
    compact.includes('PATRULHEIRODOOFICIAL') ||
    compact.includes('SUPERVISOR') ||
    compact.includes('OFICIALDEDIA') ||
    compact.includes('CPU') ||
    cleanLine.includes('GUARNIÇÃO DO OFICIAL') ||
    cleanLine.includes('GUARNIÇÃO OFICIAL') ||
    cleanLine.includes('MOTORISTA DO OFICIAL') ||
    cleanLine.includes('PATRULHEIRO DO OFICIAL') ||
    cleanLine.includes('OFICIAL DE OPERAÇÕES') ||
    cleanLine.includes('OFICIAL DE DIA') ||
    cleanLine.includes('SUPERVISOR') ||
    compact.includes('OFICIALDEOPERACOES')
  ) {
    return 'Supervisor';
  }

  // 5. SEGURANÇA INTERNADO QUARTEL (e variações como Segurança Interna / Guarda) -> 'Guarda do Quartel'
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

  return null;
}

/**
 * Resolves the specific sub-post in Escala 03 for a soldier,
 * checking the current line, next line, previous line, or surrounding window.
 */
export function resolveMilitarEscala03Post(
  lineIndex: number,
  rawLines: string[],
  nomeGuerra: string,
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
  if (directSub) return directSub;

  // 2. Check next line (e.g. table column or adjacent cell)
  const nextSub = detectEscala03SubPost(nextLine);
  if (nextSub) return nextSub;

  // 3. Check previous line (e.g. function label above soldier)
  const prevSub = detectEscala03SubPost(prevLine);
  if (prevSub) return prevSub;

  // 4. Check combined line
  const combinedSub = detectEscala03SubPost(combinedLine);
  if (combinedSub) return combinedSub;

  // 5. Check ±2 lines window
  const next2Sub = detectEscala03SubPost(nextLine2);
  if (next2Sub) return next2Sub;

  const prev2Sub = detectEscala03SubPost(prevLine2);
  if (prev2Sub) return prev2Sub;

  // 6. Name-based domain heuristics for frequent Escala 03 functions if present in text
  const cleanNomeG = cleanText(nomeGuerra);
  const surroundingText = `${prevLine2} ${prevLine} ${line} ${nextLine} ${nextLine2}`.toUpperCase();

  if (cleanNomeG.includes('ROMULO') && surroundingText.includes('VIST')) {
    return 'Vistoriador';
  }
  if (cleanNomeG.includes('ODIRLEY') && (surroundingText.includes('AUX') || surroundingText.includes('OPER'))) {
    return 'Auxiliar do Supervisor';
  }
  if (cleanNomeG.includes('DANTAS') && (surroundingText.includes('ARM') || surroundingText.includes('RESERVA'))) {
    return 'Reserva de Armamento';
  }
  if (cleanNomeG.includes('BRANDAO') && (surroundingText.includes('OFICIAL') || surroundingText.includes('SUPERVISOR'))) {
    return 'Supervisor';
  }

  // 7. Fallback to active sub-post header in Escala 03
  return currentPostoEscala3 || 'Guarda do Quartel';
}

/**
 * Resolves post in Escala 05 (Base Comunitária):
 * Exception: Sgt Dayse is allocated as 'Comandante da Base Comunitária',
 * everyone else in Escala 05 is allocated as 'Base Comunitária'.
 */
function resolveEscala05Post(nomeGuerra: string, nomeCompleto: string, lineText: string): string {
  const g = cleanText(nomeGuerra);
  const c = cleanText(nomeCompleto);
  const l = cleanText(lineText);

  if (g.includes('DAYSE') || c.includes('DAYSE') || l.includes('DAYSE')) {
    return 'Comandante da Base Comunitária';
  }
  return 'Base Comunitária';
}

/**
 * Month names to ensure dates like "17 de Setembro de 2026" are NEVER parsed as soldiers or matriculas
 */
export const MONTH_NAMES = [
  'JANEIRO', 'FEVEREIRO', 'MARCO', 'MARÇO', 'ABRIL', 'MAIO',
  'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
];

/**
 * Words that indicate roles, functions, institutions, addresses, prepositions, or document structure
 * and MUST NEVER be considered as a soldier's name.
 */
const NON_SOLDIER_WORDS = new Set([
  // Signer / Leadership to exclude from duty roster:
  'CLEYLTON', 'GUEDES', 'PESSOA',
  
  // Addresses / Locations / Street names:
  'OLDEMBURGO', 'RUA', 'AVENIDA', 'AV', 'BAIRRO', 'PRACA', 'PRAÇA', 'TRAVESSA',
  'LOTE', 'QUADRA', 'CEP', 'MACEIO', 'MACEIÓ', 'ALAGOAS', 'AL',
  
  // Roles / Functions / Military specialties / Tags:
  'MOT', 'MOTORISTA',
  'DIG', 'DIGITADOR', 'DIGITADORA',
  'SARGENTEANTE', 'SARGENTEAÇÃO', 'SARGENTEACAO',
  'AUXILIAR', 'AUXLIAR', 'AUX', 'ADJUNTO', 'ASSESSOR',
  'SUPERVISOR', 'SUPERVISAO', 'SUPERVISÃO', 'FISCAL', 'OFICIAL', 'OF', 'OPERACOES', 'OPERAÇÕES',
  'SUBCOMANDANTE', 'SUBCOMANDO', 'SUBCMD', 'COMANDANTE', 'COMANDO', 'CMTE',
  'ARMEIRO', 'ARMAMENTO', 'RESERVA', 'VISTORIADOR', 'GUARDA', 'SENTINELA',
  'SEGURANCA', 'SEGURANÇA', 'PATRULHEIRO', 'PATRULHA', 'GUARNICAO', 'GUARNIÇÃO',
  'GU', 'VTR', 'VIATURA', 'SOLO',
  
  // Sections / Divisions / Batallion organs:
  'P1', 'P2', 'P3', 'P4', 'P5', 'P/1', 'P/2', 'P/3', 'P/4', 'P/5',
  'SECAO', 'SEÇÃO', 'SEC', 'SUBSECAO', 'SUBSEÇÃO',
  'CIA', 'COMPANHIA', 'PEL', 'PELOTAO', 'PELOTÃO', 'GPM', 'BASE',
  'ALMOXARIFADO', 'EXPEDIENTE', 'SPO', 'SJD', 'CORREGEDORIA', 'INTELIGENCIA', 'INTELIGÊNCIA',
  
  // PM Specializations & acronyms:
  'QOEM', 'QOAP', 'QPMP', 'QCO', 'QOC', 'QOR', 'PMAL', 'PM', 'BM', 'BPM',
  'CEL', 'TC', 'MAJ', 'CAP', 'TEN', 'SUBTEN', 'SGT', 'CB', 'SD',
  
  // Document structure & common administrative words:
  'ESTADO', 'POLICIA', 'MILITAR', 'BATALHAO', 'DIRETORIA', 'SECRETARIA',
  'ESCALA', 'SERVICO', 'SERVIÇO', 'OPERACIONAL', 'SUBTOTAL', 'TOTAL',
  'CHEFE', 'QUARTEL', 'DATA', 'DOCUMENTO', 'BOLETIM', 'ASSINATURA',
  'ORDEM', 'RELACAO', 'RELAÇÃO', 'GERAL', 'HORARIO', 'HORÁRIO', 'TURNO',
  'PREFIXO', 'DESTINO', 'FUNCAO', 'FUNÇÃO', 'POSTO', 'GRADUACAO', 'GRADUAÇÃO',
  'NOME', 'GUERRA', 'MATRICULA', 'MATRÍCULA', 'HOMOLOGO', 'HOMOLOGADO',
  
  // Months of the year:
  ...MONTH_NAMES,

  // Portuguese articles, prepositions & conjunctions:
  'DE', 'DO', 'DA', 'DOS', 'DAS', 'EM', 'NO', 'NA', 'NOS', 'NAS',
  'PARA', 'POR', 'COM', 'SEM', 'SOB', 'SOBRE', 'AO', 'AOS', 'E', 'O', 'A', 'OS', 'AS'
]);

/**
 * Validates whether a numeric string can represent a valid PMAL matricula.
 * Rejects 4-digit years (e.g. 2024, 2025, 2026).
 */
export function isValidMatricula(mat: string): boolean {
  const digits = cleanMatricula(mat);
  if (!digits) return false;
  // Years 1990-2039 are dates/years, NEVER a soldier matrícula
  if (digits.length === 4 && (digits.startsWith('20') || digits.startsWith('19'))) {
    return false;
  }
  return digits.length >= 4 && digits.length <= 8;
}

/**
 * Checks whether an entire line represents excluded headers, signatures, dates, or authority signatures.
 */
export function isExcludedLine(line: string): boolean {
  if (!line || line.trim().length < 3) return true;
  const cleanLine = cleanText(line);
  const compact = compactText(line);

  // Signatures, authority and street addresses
  if (
    cleanLine.includes('CLEYLTON') ||
    compact.includes('CLEYLTON') ||
    cleanLine.includes('GUEDES PESSOA') ||
    cleanLine.includes('OLDEMBURGO') ||
    compact.includes('OLDEMBURGO') ||
    cleanLine.startsWith('RUA ') ||
    cleanLine.startsWith('AVENIDA ') ||
    cleanLine.startsWith('AV. ') ||
    cleanLine.includes('CHEFE DA SECAO') ||
    cleanLine.includes('CHEFE DA SEÇÃO') ||
    cleanLine.includes('HOMOLOGO') ||
    cleanLine.includes('ASSINATURA')
  ) {
    return true;
  }

  // Institutional document headers
  if (
    cleanLine.startsWith('ESTADO DE ALAGOAS') ||
    cleanLine.startsWith('POLICIA MILITAR') ||
    cleanLine.startsWith('COMANDO GERAL') ||
    cleanLine.startsWith('4º BATALHAO') ||
    cleanLine.startsWith('4 BATALHAO') ||
    cleanLine.startsWith('PAGINA ') ||
    cleanLine.startsWith('BOLETIM GERAL') ||
    cleanLine === 'ESCALA 01' ||
    cleanLine === 'ESCALA 02' ||
    cleanLine === 'ESCALA 03' ||
    cleanLine === 'ESCALA 04' ||
    cleanLine === 'ESCALA 05'
  ) {
    return true;
  }

  // Dates and publication footnotes (e.g. "Maceió - AL, 17 de Setembro de 2026")
  if (
    /\b\d{1,2}\s+DE\s+(?:JANEIRO|FEVEREIRO|MARCO|MARÇO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\s+DE\s+20\d\d\b/i.test(line) ||
    /\bDE\s+(?:JANEIRO|FEVEREIRO|MARCO|MARÇO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\s+DE\s+20\d\d\b/i.test(line) ||
    /^\s*DATA\s*:\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/i.test(line) ||
    /\bMACEIO\s*[-–]\s*AL\s*,\s*\d{1,2}\b/i.test(cleanLine)
  ) {
    return true;
  }

  return false;
}

/**
 * Remove (MOT), role labels, administrative acronyms, addresses and trailing/leading prepositions
 * from a soldier's name.
 */
export function sanitizeSoldierName(name: string): string {
  if (!name) return '';
  let cleaned = name
    // Strip (MOT), MOT., MOT, MOTORISTA
    .replace(/\(?\bMOT(?:\.|\b|\))/gi, ' ')
    .replace(/\bMOTORISTA\b/gi, ' ')
    // Strip military specialty codes (QOEM, QOAP, PMAL, etc.)
    .replace(/\b(QOEM|QOAP|QPMP|QCO|QOC|QOR|PMAL|BPM)\b/gi, ' ')
    // Strip roles: SARGENTEANTE, DIG, P1-P5, AUXILIAR, DO OF., etc.
    .replace(/\bAUX(?:\.|\s+DO\s+OF)?(?:\.|\s+DE\s+OPERACOES|\s+DE\s+OPERAÇÕES)?\b/gi, ' ')
    .replace(/\bDO\s+OF(?:\.|\b)/gi, ' ')
    .replace(/\bOF(?:\.|\b)/gi, ' ')
    .replace(/\bSARGENTEANTE(?:\s+(?:DA|DO|DE))?\b/gi, ' ')
    .replace(/\bP\s*[1-5]\s*DIG(?:\.|\b)/gi, ' ')
    .replace(/\bP\s*[1-5]\b/gi, ' ')
    .replace(/\bP[1-5]\b/gi, ' ')
    .replace(/\bDIG(?:\.|\b)(?:\s+(?:DA|DO|DE))?\b/gi, ' ')
    .replace(/\bDIGITADOR[A]?(?:\s+(?:DA|DO|DE))?\b/gi, ' ')
    .replace(/\b(?:DO\s+|DA\s+|DE\s+)?SUBCOMANDANTE\b/gi, ' ')
    .replace(/\b(?:DO\s+|DA\s+|DE\s+)?COMANDANTE\b/gi, ' ')
    .replace(/\b(?:DA\s+|DO\s+|DE\s+)?AUX(?:I)?LIAR\b/gi, ' ')
    .replace(/\bEM\s+AL\b/gi, ' ')
    .replace(/\bALAGOAS\b/gi, ' ')
    .replace(/\bMACEIO\b/gi, ' ')
    // Strip street address & scale authority
    .replace(/\b(?:RUA\s+)?OLDEMBURGO(?:\s+DA\s+SILVA)?\b/gi, ' ')
    .replace(/\bCLEYLTON(?:\s+GUEDES)?(?:\s+PESSOA)?\b/gi, ' ')
    // Remove unwanted punctuation
    .replace(/[,\(\):\/\|\\]+/g, ' ')
    .trim();

  // Strip leading or trailing Portuguese prepositions ("DO", "DA", "DE", "EM", etc.)
  cleaned = cleaned
    .replace(/^\s*(?:DO|DA|DE|DOS|DAS|EM|NO|NA|PARA|COM|AO|AOS)\s+/gi, '')
    .replace(/\s+(?:DO|DA|DE|DOS|DAS|EM|NO|NA|PARA|COM|AO|AOS)\s*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
}

/**
 * Validates that a candidate soldier name is a genuine human name and NOT an administrative role,
 * address, preposition sequence, specialty code, month name, year, or blacklisted signer.
 */
export function isValidSoldierName(name: string): boolean {
  if (!name || name.trim().length < 3) return false;
  const c = cleanText(name);

  // Blacklist checks for substrings and exact matches
  if (
    c.includes('CLEYLTON') ||
    c.includes('OLDEMBURGO') ||
    c.includes('SARGENTEANTE') ||
    c.includes('SUBCOMANDANTE') ||
    c.includes('DIGITADOR') ||
    c.includes('QOEM') ||
    c.includes('PMAL') ||
    c.includes('DO SUBCOMANDANTE') ||
    c.includes('DA AUXLIAR') ||
    c.includes('DA AUXILIAR') ||
    c.includes('AUXLIAR') ||
    c.includes('AUXILIAR') ||
    c.includes('P4 DIG') ||
    c.includes('DIG DA') ||
    c.includes('DO OF') ||
    c.includes('EM AL') ||
    c === 'OF' ||
    c === 'AL' ||
    c === 'MOT' ||
    c === 'MOTORISTA' ||
    /\b20[123]\d\b/.test(c)
  ) {
    return false;
  }

  // Month names must never be a soldier's name (e.g. Setembro)
  for (const m of MONTH_NAMES) {
    if (c === m || c.includes(` ${m}`) || c.includes(`${m} `)) {
      return false;
    }
  }

  // Tokenize and filter out non-soldier words and numbers
  const tokens = c
    .split(/\s+/)
    .filter(t => t.length >= 2 && !NON_SOLDIER_WORDS.has(t) && !MONTH_NAMES.includes(t) && !/^\d+$/.test(t));

  if (tokens.length === 0) return false;

  // At least one valid token must be 3+ letters and purely alphabetic
  return tokens.some(t => t.length >= 3 && /^[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ]+$/i.test(t));
}

/**
 * Autonomous extraction of a military soldier from a line of text,
 * used both when matching against database and when discovering soldiers not yet in database.
 */
export interface ExtractedSoldier {
  rank: PostoGraduacao;
  matricula: string;
  nomeGuerra: string;
  nomeCompleto: string;
  detectedPostHint?: string;
}

export const RANK_PATTERN_STR = '(?:CEL(?:ONEL)?|TEN(?:[- ]?CEL(?:ONEL)?)?|TC|MAJ(?:OR)?|CAP(?:ITAO|ITÃO)?|1[º°ªo\\.]?\\s*TEN(?:ENTE)?|2[º°ªo\\.]?\\s*TEN(?:ENTE)?|TEN(?:ENTE)?|SUBTEN(?:ENTE)?|SUB[- ]TEN|ST|1[º°ªo\\.]?\\s*SGT(?:O)?|1[º°ªo\\.]?\\s*SARGENTO|2[º°ªo\\.]?\\s*SGT(?:O)?|2[º°ªo\\.]?\\s*SARGENTO|3[º°ªo\\.]?\\s*SGT(?:O)?|3[º°ªo\\.]?\\s*SARGENTO|SGT(?:O)?|SARGENTO|CB|CABO|SD|SOLDADO)';
export const RANK_REGEX = new RegExp(`\\b${RANK_PATTERN_STR}\\b`, 'i');
export const MATRICULA_REGEX = /\b(?:MAT\.?|RE|RG|N[º°\.]?|ID)?\s*(\d{4,6}(?:-\d)?|\d{5,7})\b/i;

/**
 * Splits a line containing one or more soldiers (e.g. "Cb Dantas / Sd Luiz", "Cb Santana (MOT) Sd Diogo")
 * into discrete soldier segments so each soldier is parsed independently.
 */
export function splitLineIntoSoldierSegments(line: string): string[] {
  if (!line || line.trim().length < 3) return [];

  // Step 1: Split by multi-soldier delimiters: /, |, ;, or tab
  const rawChunks = line
    .split(/[/|;\t]+/)
    .map(s => s.trim())
    .filter(s => s.length >= 3);

  const segments: string[] = [];

  for (const chunk of rawChunks) {
    // Step 2: Find all rank occurrences in this chunk
    const rankRegex = new RegExp(`\\b${RANK_PATTERN_STR}\\b`, 'gi');
    const matches: { index: number; rank: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = rankRegex.exec(chunk)) !== null) {
      matches.push({ index: m.index, rank: m[0] });
    }

    if (matches.length <= 1) {
      segments.push(chunk);
    } else {
      // Chunk has 2 or more ranks! Split at each rank start
      for (let r = 0; r < matches.length; r++) {
        const start = matches[r].index;
        const end = r + 1 < matches.length ? matches[r + 1].index : chunk.length;
        const sub = chunk.slice(start, end).trim();
        if (sub.length >= 3) {
          segments.push(sub);
        }
      }
    }
  }

  return segments;
}

/**
 * Extracts a single soldier from a single soldier segment.
 */
export function tryExtractSoldierFromSegment(segment: string): ExtractedSoldier | null {
  if (!segment || segment.length < 3) return null;
  if (isExcludedLine(segment)) return null;

  const rankMatch = segment.match(RANK_REGEX);
  const matMatch = segment.match(MATRICULA_REGEX);

  // A genuine military soldier line MUST have a recognizable rank
  // (We do not default arbitrary lines without ranks to 'Sd', preventing fake soldiers like 'Sd Setembro')
  if (!rankMatch) {
    return null;
  }

  const rank = normalizeRank(rankMatch[0]);

  let matricula = '';
  if (matMatch && isValidMatricula(matMatch[1])) {
    matricula = formatMatricula(matMatch[1]);
  }

  // Extract name by removing rank, matricula, prefixes, roles and labels
  let namePart = segment;
  namePart = namePart.replace(rankMatch[0], ' ');

  if (matMatch) {
    namePart = namePart.replace(matMatch[0], ' ');
  }

  namePart = namePart.replace(/\bPM\b/gi, ' ');

  // Remove common labels like "Mat.", "Solo", "Força Tática", roles, functions
  namePart = namePart
    .replace(/\bMAT(?:\.|\:)?\b/gi, ' ')
    .replace(/\bRE(?:\.|\:)?\b/gi, ' ')
    .replace(/\bRG(?:\.|\:)?\b/gi, ' ')
    .replace(/\bN[º°\.]?\b/gi, ' ')
    .replace(/\bSOLO\b/gi, ' ')
    .replace(/\bFORCA\s+TATICA\b/gi, ' ')
    .replace(/\bFORÇA\s+TÁTICA\b/gi, ' ')
    .replace(/\bBASE\s+COMUNITARIA\b/gi, ' ')
    .replace(/\bBASE\s+COMUNITÁRIA\b/gi, ' ')
    .replace(/\bADMINISTRATIVO\b/gi, ' ')
    .replace(/\bEXPEDIENTE\b/gi, ' ')
    .replace(/\bGUARDA\s+DO\s+QUARTEL\b/gi, ' ')
    .replace(/\bSEGURANCA\s+INTERNA(?:\s+DO\s+QUARTEL)?\b/gi, ' ')
    .replace(/\bSEGURANÇA\s+INTERNA(?:\s+DO\s+QUARTEL)?\b/gi, ' ')
    .replace(/\bARMEIRO\b/gi, ' ')
    .replace(/\bRESERVA\s+DE\s+ARMAMENTO\b/gi, ' ')
    .replace(/\bVISTORIADOR\b/gi, ' ')
    .replace(/\bSUPERVISOR\b/gi, ' ')
    .replace(/\bOFICIAL\s+DE\s+OPERACOES\b/gi, ' ')
    .replace(/\bOFICIAL\s+DE\s+OPERAÇÕES\b/gi, ' ')
    .replace(/\bAUX(?:\.|\s+DO\s+OF)?(?:\.|\s+DE\s+OPERACOES|\s+DE\s+OPERAÇÕES)?\b/gi, ' ')
    .replace(/\bDO\s+OF(?:\.|\b)/gi, ' ')
    .replace(/\bOF(?:\.|\b)/gi, ' ')
    .replace(/\bSARGENTEANTE(?:\s+(?:DA|DO|DE))?\b/gi, ' ')
    .replace(/\bP\s*[1-5]\s*DIG(?:\.|\b)/gi, ' ')
    .replace(/\bP\s*\/\s*[1-5]\b/gi, ' ')
    .replace(/\bP[1-5]\b/gi, ' ')
    .replace(/\bDIG(?:\.|\b)(?:\s+(?:DA|DO|DE))?\b/gi, ' ')
    .replace(/\bDIGITADOR[A]?(?:\s+(?:DA|DO|DE))?\b/gi, ' ')
    .replace(/\b(?:DO\s+|DA\s+|DE\s+)?SUBCOMANDANTE\b/gi, ' ')
    .replace(/\b(?:DA\s+|DO\s+|DE\s+)?AUX(?:I)?LIAR\b/gi, ' ')
    .replace(/\bEM\s+AL\b/gi, ' ')
    .replace(/\b\(?MOT(?:\.|\b|\))/gi, ' ')
    .replace(/\bMOTORISTA\b/gi, ' ')
    .replace(/\b(QOEM|QOAP|QPMP|QCO|QOC|QOR|PMAL|BPM)\b/gi, ' ')
    .replace(/\bSECAO\b/gi, ' ')
    .replace(/\bSEÇÃO\b/gi, ' ')
    .replace(/\bALMOXARIFADO\b/gi, ' ')
    .replace(/\bPATRULHEIRO\b/gi, ' ')
    .replace(/\bCOMANDANTE\b/gi, ' ')
    .replace(/\bVTR\b/gi, ' ')
    .replace(/\bGU\b/gi, ' ')
    .replace(/\bPREFIXO\b/gi, ' ');

  // Remove leading numbers / bullets e.g. "1.", "01 -", " - "
  namePart = namePart.replace(/^\s*[-–—:\.]*\s*\d*[\.\-\)]*\s*/, ' ');
  namePart = namePart.replace(/\s*[-–—:\.]+\s*$/, ' ');

  // Sanitize the namePart using our dedicated sanitizer
  const sanitized = sanitizeSoldierName(namePart);

  if (!isValidSoldierName(sanitized)) {
    return null;
  }

  // Clean tokens
  const tokens = sanitized
    .split(/[\s,\-\(\):\/\|\\]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2 && !/^\d+$/.test(t) && !NON_SOLDIER_WORDS.has(cleanText(t)) && !MONTH_NAMES.includes(cleanText(t)));

  if (tokens.length === 0) {
    return null;
  }

  // First 1-2 tokens typically represent Nome de Guerra
  const nomeGuerra = tokens.slice(0, 2).join(' ');
  const nomeCompleto = tokens.join(' ');

  if (!isValidSoldierName(nomeGuerra)) {
    return null;
  }

  return {
    rank,
    matricula,
    nomeGuerra,
    nomeCompleto
  };
}

/**
 * Autonomous extraction of ALL military soldiers from a line of text,
 * properly separating pairs/groups (e.g. "Cb Dantas / Sd Luiz", "Cb Santana - Sd Diogo").
 */
export function tryExtractSoldiersFromLine(line: string): ExtractedSoldier[] {
  if (!line || isExcludedLine(line)) return [];

  const segments = splitLineIntoSoldierSegments(line);
  const soldiers: ExtractedSoldier[] = [];

  for (const seg of segments) {
    const s = tryExtractSoldierFromSegment(seg);
    if (s) {
      const cNG = cleanText(s.nomeGuerra);
      if (!soldiers.some(existing => cleanText(existing.nomeGuerra) === cNG && existing.rank === s.rank)) {
        soldiers.push(s);
      }
    }
  }

  return soldiers;
}

/**
 * Backward-compatible single soldier extraction function.
 */
function tryExtractSoldierFromLine(line: string): ExtractedSoldier | null {
  const soldiers = tryExtractSoldiersFromLine(line);
  return soldiers.length > 0 ? soldiers[0] : null;
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

  let pdf: any = null;
  let lastError: any = null;

  // Attempt 1: Load using current worker configuration
  try {
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer.slice(0),
      disableFontFace: true,
      useSystemFonts: false,
      // @ts-ignore
      isEvalSupported: false 
    });
    pdf = await loadingTask.promise;
  } catch (err: any) {
    console.warn('Tentativa 1 com worker local do PDF falhou, tentando fallback CDN...', err);
    lastError = err;
    
    // Attempt 2: Fallback to CDN worker URL
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version || '5.7.284'}/build/pdf.worker.min.mjs`;
      const fallbackTask = pdfjsLib.getDocument({ 
        data: arrayBuffer.slice(0),
        disableFontFace: true,
        useSystemFonts: false,
        // @ts-ignore
        isEvalSupported: false 
      });
      pdf = await fallbackTask.promise;
    } catch (err2: any) {
      console.warn('Tentativa 2 com CDN worker falhou:', err2);
      lastError = err2;
    }
  }

  if (!pdf) {
    throw new Error(
      lastError?.message?.includes('Password') 
        ? 'O arquivo PDF está protegido por senha. Por favor, remova a senha antes de importar.'
        : `Não foi possível carregar o arquivo PDF (${lastError?.message || 'formato inválido'}). Você também pode copiar o texto da escala e colar diretamente na aba "Colar Texto da Escala".`
    );
  }

  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await safeGetPageTextContent(page);
    
    // Sort items top-to-bottom (Y descending) then left-to-right (X ascending)
    const rawItems = (textContent.items || []) as any[];
    const items = rawItems.filter(item => item && (item.str !== undefined || item.hasEOL));
    items.sort((a, b) => {
      const aY = (a.transform && a.transform[5] !== undefined) ? a.transform[5] : 0;
      const bY = (b.transform && b.transform[5] !== undefined) ? b.transform[5] : 0;
      const aX = (a.transform && a.transform[4] !== undefined) ? a.transform[4] : 0;
      const bX = (b.transform && b.transform[4] !== undefined) ? b.transform[4] : 0;
      const yDiff = bY - aY;
      if (Math.abs(yDiff) > 3.5) {
        return yDiff;
      }
      return aX - bX;
    });

    let lastY: number | null = null;
    let lastX: number | null = null;
    let pageText = '';

    for (const item of items) {
      const text = item.str || '';
      if (!text && !item.hasEOL) continue;

      const currentY = (item.transform && item.transform[5] !== undefined) ? item.transform[5] : (lastY ?? 0);
      const currentX = (item.transform && item.transform[4] !== undefined) ? item.transform[4] : (lastX ?? 0);

      const isNewLine = 
        item.hasEOL || 
        (lastY !== null && Math.abs(currentY - lastY) > 3.5) ||
        (lastX !== null && currentX < lastX - 35 && lastY !== null && Math.abs(currentY - lastY) > 1.5);

      if (isNewLine) {
        pageText += '\n';
      } else if (pageText.length > 0 && !pageText.endsWith('\n') && !pageText.endsWith(' ') && text) {
        pageText += ' ';
      }

      if (text) {
        pageText += text;
      }

      lastY = currentY;
      lastX = currentX + (item.width || (text.length * 5));
    }

    fullText += pageText + '\n--- PAGINA ' + pageNum + ' ---\n';
  }

  if (!fullText.trim()) {
    throw new Error(
      'O arquivo PDF foi lido, mas nenhum texto pesquisável foi encontrado. Caso o documento seja uma imagem ou cópia escaneada, selecione e copie o texto ou utilize a aba "Colar Texto da Escala".'
    );
  }

  return fullText;
}

/**
 * Parse scale text and match / extract soldiers according to battalion rules:
 *
 * Escala 01 (Solo):
 * Todos os militares identificados sob o cabeçalho ou seção da Escala 01 são alocados automaticamente no posto Solo.
 *
 * Escala 02 (Força Tática):
 * Todos os militares identificados na Escala 02 são alocados no posto Força Tática.
 *
 * Escala 03 (Serviços Internos e Supervisão):
 * - AUX.DOOF.DEOPERAÇÕES (e variações como Aux. do Of. de Operações / Adjunto) -> Auxiliar do Supervisor
 * - SEGURANÇA INTERNADO QUARTEL (e variações como Segurança Interna / Guarda) -> Guarda do Quartel
 * - ARMEIRO (e variações como Reserva de Armamento) -> Reserva de Armamento
 * - GUARNIÇÃODOOFICIALDE OPERAÇÕES (e variações como Oficial de Operações / Supervisor) -> Supervisor
 * - VISTORIADOR -> Vistoriador
 *
 * Escala 04 (Administrativo):
 * Conforme solicitado, quaisquer anotações adicionais presentes na linha ou cabeçalho (como P/1, P/2, P/3, Almoxarifado, etc.)
 * são desconsideradas: todos os militares listados na Escala 04 são classificados obrigatoriamente como Administrativo.
 *
 * Escala 05 (Base Comunitária):
 * Todos os militares identificados na Escala 05 são alocados automaticamente no posto Base Comunitária.
 * Exceção: Sgt Dayse, que deve ser colocada como Comandante da Base Comunitária.
 *
 * Afastamentos (LTS e Férias):
 * Seções de licença saúde/LTS e férias continuam sendo devidamente reconhecidas e atribuídas à situação dos respectivos militares.
 */
export function parseEscalaText(rawText: string, efetivo: EfetivoMilitar[]): EscalaPdfResult {
  const rawLines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let titulo = 'Escala de Serviço Operacional - 4º BPM';
  let dataEscala = '';

  // Extract date
  const dateMatch = rawText.match(/(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/);
  if (dateMatch) {
    dataEscala = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
  } else {
    dataEscala = new Date().toLocaleDateString('pt-BR');
  }

  // Pre-index existing soldiers if any
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
    if (cleanNomeG) {
      soldiersByNomeGuerra.set(cleanNomeG, m);
    }

    // Posto/Graduação + Nome de Guerra
    soldiersByPostoNome.push({
      pattern: cleanText(`${m.postoGraduacao} ${m.nomeGuerra}`),
      militar: m
    });

    // Rank variations
    const pg = cleanText(m.postoGraduacao);
    if (pg.includes('SARGENTO') || pg.includes('SGT')) {
      soldiersByPostoNome.push({ pattern: `1º SGT ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `1 SGT ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `2º SGT ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `3º SGT ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `SGT ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `SGT PM ${cleanNomeG}`, militar: m });
    } else if (pg.includes('CABO') || pg.includes('CB')) {
      soldiersByPostoNome.push({ pattern: `CB ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `CB PM ${cleanNomeG}`, militar: m });
    } else if (pg.includes('SOLDADO') || pg.includes('SD')) {
      soldiersByPostoNome.push({ pattern: `SD ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `SD PM ${cleanNomeG}`, militar: m });
    } else if (pg.includes('TENENTE') || pg.includes('TEN')) {
      soldiersByPostoNome.push({ pattern: `1º TEN ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `TEN ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `TEN PM ${cleanNomeG}`, militar: m });
    } else if (pg.includes('CAPITAO') || pg.includes('CAPITÃO') || pg.includes('CAP')) {
      soldiersByPostoNome.push({ pattern: `CAP ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `CAP PM ${cleanNomeG}`, militar: m });
    } else if (pg.includes('MAJOR') || pg.includes('MAJ')) {
      soldiersByPostoNome.push({ pattern: `MAJ ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `MAJ PM ${cleanNomeG}`, militar: m });
    } else if (pg.includes('CORONEL') || pg.includes('TC') || pg.includes('CEL')) {
      soldiersByPostoNome.push({ pattern: `TC ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `TEN CEL ${cleanNomeG}`, militar: m });
      soldiersByPostoNome.push({ pattern: `CEL ${cleanNomeG}`, militar: m });
    } else if (pg.includes('SUBTENENTE') || pg.includes('SUBTEN') || pg === 'ST') {
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
  const itensAfastados: { militarId?: string; nome: string; status: 'LTS' | 'Férias'; posto?: string; matricula?: string }[] = [];
  const discoveredSoldiersMap = new Map<string, EfetivoMilitar>();

  let currentEscala: number | null = null; // 1, 2, 3, 4, or 5
  let currentPostoEscala3 = '';
  let isLtsSection = false;
  let isFeriasSection = false;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const nextLine = rawLines[i + 1] || '';
    const cleanLine = cleanText(line);
    const compact = compactText(line);

    // 0. Skip lines that contain signatures, street addresses, scale authority, dates, or headers
    if (isExcludedLine(line)) {
      continue;
    }

    // 1. Check for Afastamentos headers
    if (
      cleanLine.includes('LICENCA SAUDE') ||
      cleanLine.includes('LICENCA MEDICA') ||
      cleanLine.includes('ATESTADO MEDICO') ||
      compact.includes('LICENCASAUDE') ||
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
      (cleanLine.includes('FERIAS') && cleanLine.length < 35)
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
      continue;
    }

    // 3. In Escala 03, check if this line is a sub-post heading
    if (currentEscala === 3) {
      const subPost = detectEscala03SubPost(line);
      if (subPost && line.length < 60 && !line.match(/\b\d{4,6}-?\d?\b/)) {
        currentPostoEscala3 = subPost;
        continue;
      }
    }

    // 4. Identify soldiers in this line (supporting multiple soldiers per line)
    const combinedLine = `${line} ${nextLine}`;
    const cleanCombined = cleanText(combinedLine);
    const soldiersToProcess: { militar: EfetivoMilitar; isNew: boolean }[] = [];
    const processedIdsOnLine = new Set<string>();

    const isExcludedPerson = (name: string) => {
      const c = cleanText(name);
      return c.includes('CLEYLTON') || c.includes('OLDEMBURGO');
    };

    // A. Autonomous extraction of all soldiers on this line (splits pairs e.g. Dantas & Luiz, Santana & Diogo)
    const extractedSoldiers = tryExtractSoldiersFromLine(line);

    for (const ext of extractedSoldiers) {
      const cleanNG = sanitizeSoldierName(ext.nomeGuerra);
      const cleanNC = sanitizeSoldierName(ext.nomeCompleto) || cleanNG;

      if (!isValidSoldierName(cleanNG) || isExcludedPerson(cleanNG)) {
        continue;
      }

      // Check if this extracted soldier matches any soldier in the DB
      let matchedDbMilitar: EfetivoMilitar | null = null;
      const cMat = cleanMatricula(ext.matricula);
      if (cMat && isValidMatricula(cMat)) {
        if (soldiersByMatricula.has(cMat)) {
          matchedDbMilitar = soldiersByMatricula.get(cMat)!;
        } else if (cMat.length >= 5 && soldiersByMatriculaBase.has(cMat.slice(0, 5))) {
          matchedDbMilitar = soldiersByMatriculaBase.get(cMat.slice(0, 5))!;
        }
      }

      if (!matchedDbMilitar) {
        const uNome = cleanText(cleanNG);
        const matchByPosto = soldiersByPostoNome.find(
          item => item.militar.postoGraduacao === ext.rank && uNome === cleanText(item.militar.nomeGuerra)
        );
        if (matchByPosto) {
          matchedDbMilitar = matchByPosto.militar;
        } else if (soldiersByNomeGuerra.has(uNome)) {
          matchedDbMilitar = soldiersByNomeGuerra.get(uNome)!;
        }
      }

      if (matchedDbMilitar) {
        if (!matchedSoldierIds.has(matchedDbMilitar.id) && !processedIdsOnLine.has(matchedDbMilitar.id)) {
          processedIdsOnLine.add(matchedDbMilitar.id);
          const sanitizedNG = sanitizeSoldierName(matchedDbMilitar.nomeGuerra) || matchedDbMilitar.nomeGuerra;
          const sanitizedNC = sanitizeSoldierName(matchedDbMilitar.nomeCompleto) || matchedDbMilitar.nomeCompleto;
          soldiersToProcess.push({
            militar: {
              ...matchedDbMilitar,
              nomeGuerra: sanitizedNG,
              nomeCompleto: sanitizedNC
            },
            isNew: false
          });
        }
      } else {
        // Discovered new soldier not yet in database (e.g. Claudeone, or newly deployed military)
        const cleanMatDigits = cleanMatricula(ext.matricula);
        const safeMat = isValidMatricula(cleanMatDigits) ? ext.matricula : '';
        const syntheticId = `PM-${cleanMatDigits && isValidMatricula(cleanMatDigits) ? cleanMatDigits : cleanText(cleanNG).replace(/[^A-Z0-9]/g, '') || String(1000 + i)}`;
        
        if (!matchedSoldierIds.has(syntheticId) && !discoveredSoldiersMap.has(syntheticId) && !processedIdsOnLine.has(syntheticId)) {
          processedIdsOnLine.add(syntheticId);
          const newMilitar: EfetivoMilitar = {
            id: syntheticId,
            matricula: safeMat || `N/I-${i + 1}`,
            postoGraduacao: ext.rank,
            nomeGuerra: cleanNG,
            nomeCompleto: cleanNC || cleanNG,
            situacao: 'Solo',
            localEscala: 'Solo',
            funcao: 'Solo',
            contato: '',
            dataAdmissao: '',
            escalaTipo: 'SOLO'
          };
          soldiersToProcess.push({ militar: newMilitar, isNew: true });
        }
      }
    }

    // B. Also check if any DB soldiers match this line directly
    // Check by Matrícula in DB
    const matMatches = line.match(/\b\d{4,6}-?\d?\b/g);
    if (matMatches) {
      for (const mStr of matMatches) {
        const cMat = cleanMatricula(mStr);
        if (!isValidMatricula(cMat)) continue;
        let dbM = soldiersByMatricula.get(cMat);
        if (!dbM && cMat.length >= 5) {
          dbM = soldiersByMatriculaBase.get(cMat.slice(0, 5));
        }
        if (dbM && !matchedSoldierIds.has(dbM.id) && !processedIdsOnLine.has(dbM.id) && !isExcludedPerson(dbM.nomeGuerra)) {
          processedIdsOnLine.add(dbM.id);
          const sanitizedNG = sanitizeSoldierName(dbM.nomeGuerra) || dbM.nomeGuerra;
          const sanitizedNC = sanitizeSoldierName(dbM.nomeCompleto) || dbM.nomeCompleto;
          soldiersToProcess.push({
            militar: {
              ...dbM,
              nomeGuerra: sanitizedNG,
              nomeCompleto: sanitizedNC
            },
            isNew: false
          });
        }
      }
    }

    // Check by Posto + Nome de Guerra in DB
    for (const item of soldiersByPostoNome) {
      if (cleanLine.includes(item.pattern) || cleanCombined.includes(item.pattern)) {
        if (!matchedSoldierIds.has(item.militar.id) && !processedIdsOnLine.has(item.militar.id) && !isExcludedPerson(item.militar.nomeGuerra)) {
          processedIdsOnLine.add(item.militar.id);
          const sanitizedNG = sanitizeSoldierName(item.militar.nomeGuerra) || item.militar.nomeGuerra;
          const sanitizedNC = sanitizeSoldierName(item.militar.nomeCompleto) || item.militar.nomeCompleto;
          soldiersToProcess.push({
            militar: {
              ...item.militar,
              nomeGuerra: sanitizedNG,
              nomeCompleto: sanitizedNC
            },
            isNew: false
          });
        }
      }
    }

    // Check by Nome de Guerra (word boundary) in DB
    for (const [nomeGuerra, m] of soldiersByNomeGuerra.entries()) {
      if (nomeGuerra.length >= 3 && !NON_SOLDIER_WORDS.has(nomeGuerra) && !MONTH_NAMES.includes(nomeGuerra)) {
        const rgx = new RegExp(`\\b${nomeGuerra}\\b`);
        if (rgx.test(cleanLine) || rgx.test(cleanCombined)) {
          if (!matchedSoldierIds.has(m.id) && !processedIdsOnLine.has(m.id) && !isExcludedPerson(m.nomeGuerra)) {
            processedIdsOnLine.add(m.id);
            const sanitizedNG = sanitizeSoldierName(m.nomeGuerra) || m.nomeGuerra;
            const sanitizedNC = sanitizeSoldierName(m.nomeCompleto) || m.nomeCompleto;
            soldiersToProcess.push({
              militar: {
                ...m,
                nomeGuerra: sanitizedNG,
                nomeCompleto: sanitizedNC
              },
              isNew: false
            });
          }
        }
      }
    }

    // 5. Apply Battalion Rules to each soldier
    for (const { militar, isNew: _isNew } of soldiersToProcess) {
      matchedSoldierIds.add(militar.id);

      // Check Afastamentos
      const isLts = isLtsSection || cleanLine.includes('LTS') || cleanLine.includes('LICENCA SAUDE') || cleanLine.includes('ATESTADO MEDICO');
      const isFerias = isFeriasSection || cleanLine.includes('FERIAS');

      if (isLts) {
        itensAfastados.push({
          militarId: militar.id,
          nome: `${militar.postoGraduacao} ${militar.nomeGuerra}`,
          status: 'LTS',
          posto: militar.postoGraduacao,
          matricula: militar.matricula
        });
        discoveredSoldiersMap.set(militar.id, {
          ...militar,
          situacao: 'LTS',
          localEscala: 'LTS'
        });
      } else if (isFerias) {
        itensAfastados.push({
          militarId: militar.id,
          nome: `${militar.postoGraduacao} ${militar.nomeGuerra}`,
          status: 'Férias',
          posto: militar.postoGraduacao,
          matricula: militar.matricula
        });
        discoveredSoldiersMap.set(militar.id, {
          ...militar,
          situacao: 'Férias',
          localEscala: 'Férias'
        });
      } else {
        // Active Scale Assignment
        let localEscala = 'Solo';

        if (currentEscala === 1) {
          // Escala 01 (Solo): Todos os militares identificados sob o cabeçalho ou seção da Escala 01 são alocados automaticamente no posto Solo.
          localEscala = 'Solo';
        } else if (currentEscala === 2) {
          // Escala 02 (Força Tática): Todos os militares identificados na Escala 02 são alocados no posto Força Tática.
          localEscala = 'Força Tática';
        } else if (currentEscala === 3) {
          // Escala 03 (Serviços Internos e Supervisão):
          // AUX.DOOF.DEOPERAÇÕES -> Auxiliar do Supervisor
          // SEGURANÇA INTERNADO QUARTEL -> Guarda do Quartel
          // ARMEIRO -> Reserva de Armamento
          // GUARNIÇÃODOOFICIALDE OPERAÇÕES -> Supervisor
          // VISTORIADOR -> Vistoriador
          localEscala = resolveMilitarEscala03Post(i, rawLines, militar.nomeGuerra, currentPostoEscala3);
        } else if (currentEscala === 4) {
          // Escala 04 (Administrativo):
          // Conforme solicitado, quaisquer anotações adicionais presentes na linha ou cabeçalho (como P/1, P/2, P/3, Almoxarifado, etc.)
          // são desconsideradas: todos os militares listados na Escala 04 são classificados obrigatoriamente como Administrativo.
          localEscala = 'Administrativo';
        } else if (currentEscala === 5) {
          // Escala 05 (Base Comunitária):
          // Todos os militares identificados na Escala 05 são alocados automaticamente no posto Base Comunitária.
          // Exceção: Sgt Dayse, que deve ser colocada como Comandante da Base Comunitária.
          localEscala = resolveEscala05Post(militar.nomeGuerra, militar.nomeCompleto, line);
        } else {
          // Outside explicit Escala numbers (individual indicators or general headers)
          const resolvedSub = resolveMilitarEscala03Post(i, rawLines, militar.nomeGuerra, '');
          if (resolvedSub && resolvedSub !== 'Guarda do Quartel') {
            localEscala = resolvedSub;
          } else if (compact.includes('SOLO')) {
            localEscala = 'Solo';
          } else if (compact.includes('FORCATATICA')) {
            localEscala = 'Força Tática';
          } else if (compact.includes('BASECOMUNITARIA')) {
            localEscala = resolveEscala05Post(militar.nomeGuerra, militar.nomeCompleto, line);
          } else if (compact.includes('ADMINISTRATIVO') || compact.includes('EXPEDIENTE')) {
            localEscala = 'Administrativo';
          } else if (cleanLine.includes('P2') || cleanLine.includes('P/2') || compact.includes('INTELIGENCIA')) {
            localEscala = 'P2';
          } else {
            localEscala = resolvedSub || 'Solo';
          }
        }

        itensEscalados.push({
          localEscala,
          postoGraduacao: militar.postoGraduacao,
          nomeGuerra: militar.nomeGuerra,
          matricula: militar.matricula,
          rawText: line,
          matchedMilitarId: militar.id
        });

        discoveredSoldiersMap.set(militar.id, {
          ...militar,
          situacao: localEscala,
          localEscala: localEscala,
          funcao: localEscala,
          escalaTipo: getEscalaTipoForPost(localEscala)
        });
      }
    }
  }

  const militaresEncontrados = Array.from(discoveredSoldiersMap.values());

  return {
    titulo,
    dataEscala,
    itensEscalados,
    itensAfastados,
    totalEscalados: itensEscalados.length,
    militaresEncontrados
  };
}

/**
 * Apply parsed scale to current efetivo:
 * - Scaled soldiers receive their assigned post (Solo, Força Tática, Auxiliar do Supervisor, etc.)
 * - Scaled in LTS/Férias receive "LTS" or "Férias"
 * - All soldiers from the battalion NOT present in the scale receive unscaledDefaultStatus ("À Disposição" or retain their status).
 * - Any newly discovered soldiers from the scale PDF not previously registered are incorporated into the roster.
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

  const existingIds = new Set(efetivo.map(m => m.id));
  const existingMatriculas = new Set(efetivo.map(m => cleanMatricula(m.matricula)).filter(Boolean));

  // 1. Process existing soldiers in efetivo
  const updatedEfetivo: EfetivoMilitar[] = efetivo.map(m => {
    // Manual override
    if (manualOverrides[m.id]) {
      return {
        ...m,
        situacao: manualOverrides[m.id],
        localEscala: manualOverrides[m.id],
        funcao: manualOverrides[m.id],
        escalaTipo: getEscalaTipoForPost(manualOverrides[m.id])
      };
    }

    // Found in PDF
    if (scaledMap.has(m.id)) {
      const assignedPost = scaledMap.get(m.id)!;
      return {
        ...m,
        situacao: assignedPost,
        localEscala: assignedPost,
        funcao: assignedPost,
        escalaTipo: getEscalaTipoForPost(assignedPost)
      };
    }

    // Not scaled: retain LTS/Férias if already in LTS/Férias
    if (m.situacao === 'LTS' || m.situacao === 'Férias') {
      return {
        ...m,
        situacao: m.situacao,
        localEscala: m.situacao
      };
    }

    // Default for unscaled
    return {
      ...m,
      situacao: unscaledDefaultStatus,
      localEscala: unscaledDefaultStatus
    };
  });

  // 2. Incorporate any newly discovered soldiers from PDF that were not already in efetivo
  if (parsedResult.militaresEncontrados && parsedResult.militaresEncontrados.length > 0) {
    parsedResult.militaresEncontrados.forEach(newM => {
      const cleanM = cleanMatricula(newM.matricula);
      const isAlreadyIn = existingIds.has(newM.id) || (cleanM && existingMatriculas.has(cleanM));
      if (!isAlreadyIn) {
        const override = manualOverrides[newM.id];
        const finalPost = override || newM.situacao;
        updatedEfetivo.push({
          ...newM,
          situacao: finalPost,
          localEscala: finalPost,
          funcao: finalPost,
          escalaTipo: getEscalaTipoForPost(finalPost)
        });
        existingIds.add(newM.id);
        if (cleanM) existingMatriculas.add(cleanM);
      }
    });
  }

  return ensureUniqueIds(updatedEfetivo);
}

/**
 * Generates an official sample Escala PDF for 4º BPM strictly matching Escalas 01 to 05
 */
export function generateSampleEscalaPdf(): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const todayStr = new Date().toLocaleDateString('pt-BR');

  // Header Banner
  doc.setFillColor(15, 45, 25);
  doc.rect(0, 0, 210, 26, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('POLÍCIA MILITAR DE ALAGOAS', 105, 9, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('COMANDO DE POLICIAMENTO DA CAPITAL • 4º BATALHÃO DE POLÍCIA MILITAR', 105, 15, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(200, 230, 210);
  doc.text(`ESCALA DE SERVIÇO OPERACIONAL DIÁRIO — DATA: ${todayStr}`, 105, 21, { align: 'center' });

  let y = 34;

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

  // ESCALA 03 - SERVIÇOS INTERNOS E SUPERVISÃO
  printSectionHeader('ESCALA 03 - SERVIÇOS INTERNOS E SUPERVISÃO');
  printRow('GUARNIÇÃODOOFICIALDE OPERAÇÕES', 'Cap Brandão', 'Mat. 10789-4');
  printRow('AUX.DOOF.DEOPERAÇÕES', '1º Sgt Odirley', 'Mat. 12280-9');
  printRow('SEGURANÇA INTERNADO QUARTEL', '1º Sgt Silva', 'Mat. 10456-2');
  printRow('ARMEIRO', '2º Sgt Dantas', 'Mat. 12650-3');
  printRow('VISTORIADOR', '1º Sgt Romulo', 'Mat. 12240-5');
  y += 1.5;

  // ESCALA 04 - ADMINISTRATIVO
  printSectionHeader('ESCALA 04 - ADMINISTRATIVO');
  printRow('Administrativo (Seção P/1)', 'Subten Dias', 'Mat. 11580-2');
  printRow('Administrativo (Almoxarifado)', 'Cb Fagundes', 'Mat. 12880-3');
  y += 1.5;

  // ESCALA 05 - BASE COMUNITÁRIA
  printSectionHeader('ESCALA 05 - BASE COMUNITÁRIA');
  printRow('Base Comunitária (Comandante)', 'Sgt Dayse', 'Mat. 11874-9');
  printRow('Base Comunitária', 'Cb Pereira', 'Mat. 12550-9');
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

  doc.save(`escala_4bpm_${todayStr.replace(/\//g, '-')}.pdf`);
}

