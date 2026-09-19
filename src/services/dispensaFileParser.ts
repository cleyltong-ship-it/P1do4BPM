import { pdfjsLib, safeGetPageTextContent } from './pdfWorkerSetup';
import { DispensaMedicaLTS, EfetivoMilitar, PostoGraduacao, TipoAfastamentoSaude } from '../types';
import { normalizePosto } from './excelEfetivoParser';
import Tesseract from 'tesseract.js';

export interface ParseDispensaResult {
  matricula: string;
  nome: string;
  nomeGuerra?: string;
  postoGraduacao: PostoGraduacao;
  tipo: TipoAfastamentoSaude;
  diasAfastamento: number;
  dataInicio: string; // YYYY-MM-DD
  dataFimPrevista: string; // YYYY-MM-DD
  cid?: string;
  descricaoCid?: string;
  medicoOuJunta?: string;
  observacoes?: string;
  textoExtraido: string;
  confianca: 'alta' | 'media' | 'baixa';
}

const CID_DESCRICOES: Record<string, string> = {
  'M54': 'Dorsalgia / Lombalgia',
  'M54.5': 'Lombalgia baixa',
  'M51': 'Transtornos de discos intervertebrais / Hérnia de disco',
  'M75': 'Lesões do ombro / Tendinite',
  'M65': 'Sinovite e tenossinovite',
  'M79': 'Outros transtornos dos tecidos moles / Mialgia',
  'S83': 'Traumatismo e entorse do joelho',
  'S93': 'Entorse e distensão do tornozelo e do pé',
  'S62': 'Fratura do punho e da mão',
  'S06': 'Traumatismo intracraniano',
  'F41': 'Transtornos ansiosos',
  'F41.0': 'Transtorno de pânico',
  'F41.2': 'Transtorno misto ansioso e depressivo',
  'F32': 'Episódios depressivos',
  'F43': 'Reações ao estresse grave e transtornos de adaptação',
  'J00': 'Nasofaringite aguda (resfriado comum)',
  'J06': 'Infecções agudas das vias aéreas superiores',
  'J11': 'Influenza / Gripe',
  'J18': 'Pneumonia',
  'A09': 'Gastroenterite e colite de origem infecciosa',
  'B34': 'Doença por vírus não especificada',
  'Z00': 'Exame geral e investigação de pessoas sem queixas',
  'Z02': 'Exame para fins administrativos',
  'Z73': 'Problemas relacionados com a organização do modo de vida / Burnout'
};

const NUMEROS_EXTENSO: Record<string, number> = {
  'um': 1, 'uma': 1, 'dois': 2, 'duas': 2, 'três': 3, 'tres': 3, 'quatro': 4,
  'cinco': 5, 'seis': 6, 'sete': 7, 'oito': 8, 'nove': 9, 'dez': 10,
  'onze': 11, 'doze': 12, 'treze': 13, 'quatorze': 14, 'catorze': 14,
  'quinze': 15, 'dezesseis': 16, 'dezessete': 17, 'dezoito': 18, 'dezenove': 19,
  'vinte': 20, 'trinta': 30, 'quarenta': 40, 'quarenta e cinco': 45,
  'sessenta': 60, 'noventa': 90, 'cento e vinte': 120, 'cento e oitenta': 180
};

const MESES_PORTUGUES: Record<string, number> = {
  'janeiro': 0, 'fevereiro': 1, 'março': 2, 'marco': 2, 'abril': 3, 'maio': 4,
  'junho': 5, 'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9,
  'novembro': 10, 'dezembro': 11
};

/**
 * Converte data DD/MM/AAAA para YYYY-MM-DD
 */
function toIsoDate(d: number, m: number, y: number): string {
  const year = y < 100 ? (y > 50 ? 1900 + y : 2000 + y) : y;
  const month = String(m).padStart(2, '0');
  const day = String(d).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Adiciona X dias a uma data YYYY-MM-DD
 */
export function addDaysToDate(isoDate: string, days: number): string {
  try {
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      // Subtrai 1 se o dia de início já conta como 1º dia de afastamento
      const offsetDays = Math.max(0, days - 1);
      d.setDate(d.getDate() + offsetDays);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  } catch (e) {
    console.error('Erro ao calcular término:', e);
  }
  return isoDate;
}

/**
 * Extrai texto de um PDF usando pdfjsLib
 */
export async function extractTextFromPdf(
  file: File, 
  onProgress?: (msg: string) => void
): Promise<string> {
  onProgress?.('Lendo páginas do documento PDF...');
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdfDoc = await loadingTask.promise;

  let fullText = '';
  const numPages = pdfDoc.numPages;

  for (let i = 1; i <= Math.min(numPages, 5); i++) {
    onProgress?.(`Extraindo texto da página ${i} de ${numPages}...`);
    const page = await pdfDoc.getPage(i);
    const content = await safeGetPageTextContent(page);
    const pageStrings = (content.items || [])
      .map((item: any) => item.str || '')
      .filter((s: string) => s.trim().length > 0);

    fullText += pageStrings.join(' ') + '\n';

    // Se o PDF for um documento digitalizado sem texto embutido, tenta OCR na primeira página
    if (fullText.trim().length < 40 && i === 1 && typeof document !== 'undefined') {
      try {
        onProgress?.('PDF digitalizado (imagem detectada). Executando OCR da página...');
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (ctx) {
          await page.render({ canvasContext: ctx, viewport, canvas: canvas as any } as any).promise;
          const ocrText = await runOcrOnImageElement(canvas, onProgress);
          if (ocrText.trim().length > fullText.trim().length) {
            fullText += '\n' + ocrText;
          }
        }
      } catch (ocrErr) {
        console.warn('Fallback de OCR em PDF não pôde ser concluído:', ocrErr);
      }
    }
  }

  return fullText;
}

/**
 * Executa OCR em imagem ou canvas usando Tesseract.js
 */
export async function runOcrOnImageElement(
  imageSource: File | HTMLCanvasElement | string,
  onProgress?: (msg: string) => void
): Promise<string> {
  onProgress?.('Iniciando reconhecimento óptico (OCR)...');
  try {
    const result = await Tesseract.recognize(
      imageSource,
      'por',
      {
        logger: (m) => {
          if (m.status === 'recognizing text' && m.progress) {
            const pct = Math.round(m.progress * 100);
            onProgress?.(`Processando OCR: ${pct}% concluído...`);
          }
        }
      }
    );
    return result.data.text || '';
  } catch (err) {
    console.warn('Falha no OCR em português, tentando modelo secundário:', err);
    // Tenta em inglês se o pacote em português falhar em rede
    const resultEn = await Tesseract.recognize(imageSource, 'eng');
    return resultEn.data.text || '';
  }
}

/**
 * Analisador inteligente de Atestados / Dispensas Médicas / LTS
 */
export function parseDispensaDocumentText(
  rawText: string,
  efetivo: EfetivoMilitar[] = []
): ParseDispensaResult {
  const textClean = rawText.replace(/\s+/g, ' ');
  const textUpper = textClean.toUpperCase();

  // 1. Identificar Militar no Efetivo
  let matchedMilitar: EfetivoMilitar | undefined;
  let matricula = '';
  let nome = '';
  let nomeGuerra = '';
  let postoGraduacao: PostoGraduacao = 'Sd';
  let confianca: 'alta' | 'media' | 'baixa' = 'baixa';

  // Procura por matrícula no texto
  const matMatch = textClean.match(/(?:matr[íi]cula|mat\.?|re|rg|pm|id|cadastro)\s*[:#ºn°\-]?\s*([0-9.\-\/]{4,15})/i) ||
                   textClean.match(/\b([0-9]{3}\.[0-9]{3}[0-9.\-\/]*)\b/) ||
                   textClean.match(/\b([0-9]{5,8}[-\/][0-9A-Z])\b/);
  if (matMatch) {
    const rawMat = matMatch[1].replace(/[^0-9]/g, '');
    matchedMilitar = efetivo.find(m => {
      const cleanM = (m.matricula || '').replace(/[^0-9]/g, '');
      return cleanM && (cleanM === rawMat || cleanM.includes(rawMat) || rawMat.includes(cleanM));
    });
    if (matchedMilitar) {
      matricula = matchedMilitar.matricula;
      nome = matchedMilitar.nomeCompleto;
      nomeGuerra = matchedMilitar.nomeGuerra;
      postoGraduacao = matchedMilitar.postoGraduacao;
      confianca = 'alta';
    } else {
      matricula = matMatch[1].trim();
    }
  }

  // Se ainda não encontrou militar pelo número da matrícula, pesquisa pelo nome completo ou nome de guerra no efetivo
  if (!matchedMilitar && efetivo.length > 0) {
    for (const m of efetivo) {
      const nomeUpper = m.nomeCompleto.toUpperCase();
      const guerraUpper = m.nomeGuerra.toUpperCase();
      if (nomeUpper.length >= 8 && textUpper.includes(nomeUpper)) {
        matchedMilitar = m;
        matricula = m.matricula;
        nome = m.nomeCompleto;
        nomeGuerra = m.nomeGuerra;
        postoGraduacao = m.postoGraduacao;
        confianca = 'alta';
        break;
      }
      if (guerraUpper.length >= 4 && (textUpper.includes(` ${guerraUpper} `) || textUpper.includes(`${m.postoGraduacao.toUpperCase()} ${guerraUpper}`))) {
        matchedMilitar = m;
        matricula = m.matricula;
        nome = m.nomeCompleto;
        nomeGuerra = m.nomeGuerra;
        postoGraduacao = m.postoGraduacao;
        confianca = 'media';
      }
    }
  }

  // Se não cruzou com militar conhecido, tenta extrair posto e nome do texto
  if (!nome) {
    const postoMatch = textUpper.match(/\b(CEL|TEN-CEL|MAJ|CAP|1º TEN|2º TEN|SUBTEN|1º SGT|2º SGT|3º SGT|CB|SD)\b/);
    if (postoMatch) {
      postoGraduacao = normalizePosto(postoMatch[1]);
    }

    const nomeMatch = textClean.match(/(?:paciente|atesto que o\(a\)|sr\(a\)\.?|militar|policial|sd|cb|sgt|ten|cap|maj)\s+([A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ\s]{6,45})(?:,|\.|\bde\b|\bportador\b|\bmatr[íi]cula\b|\bafastamento\b)/i) ||
                     textClean.match(/(?:paciente|servidor|militar)\s*[:\-]?\s*([A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ\s]{6,45})/i);
    if (nomeMatch) {
      nome = nomeMatch[1].trim().replace(/\s+/g, ' ');
      confianca = 'media';
    } else {
      nome = 'Militar a Identificar';
    }
  }

  if (!matricula) {
    matricula = `PM-${Math.floor(10000 + Math.random() * 90000)}`;
  }

  // 2. Identificar Tempo de Afastamento (Dias)
  let diasAfastamento = 0;
  const diasMatch = textClean.match(/(?:afastamento|dispensa|licen[çc]a|repouso|afastado|per[íi]odo|prazo)\s*(?:de|por)?\s*(\d{1,3})\s*(?:\([a-zA-Zçãáéíóú\s]+\))?\s*dias?/i) ||
                    textClean.match(/(\d{1,3})\s*(?:\([a-zA-Zçãáéíóú\s]+\))?\s*dias?\s*(?:de\s+)?(?:afastamento|dispensa|repouso|lts|licen[çc]a|repouso|convalescen[çc]a)/i) ||
                    textClean.match(/(?:necessita\s+de|concedo|prescrevo|sugiro|por\s+um\s+per[íi]odo\s+de)\s*(\d{1,3})\s*dias?/i) ||
                    textClean.match(/\b(\d{1,2})\s*dias?\b/i);

  if (diasMatch) {
    diasAfastamento = parseInt(diasMatch[1], 10);
  } else {
    // Tenta por extenso
    for (const [palavra, val] of Object.entries(NUMEROS_EXTENSO)) {
      if (new RegExp(`\\b${palavra}\\s*dias?\\b`, 'i').test(textClean)) {
        diasAfastamento = val;
        break;
      }
    }
  }

  // Valor padrão caso não encontre
  if (diasAfastamento <= 0 || isNaN(diasAfastamento)) {
    diasAfastamento = 15; // padrão de atestado ou LTS
  }

  // 3. Identificar Data de Início
  const today = new Date();
  let dataInicio = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const inicioMatch = textClean.match(/(?:a\s+contar\s+de|a\s+partir\s+de|in[íi]cio\s+em|data\s+de\s+in[íi]cio\s*[:\-\s]|per[íi]odo\s+de\s*)(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/i) ||
                      textClean.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](202[4-7])\b/);

  if (inicioMatch) {
    const d = parseInt(inicioMatch[1], 10);
    const m = parseInt(inicioMatch[2], 10);
    const y = parseInt(inicioMatch[3], 10);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      dataInicio = toIsoDate(d, m, y);
    }
  } else {
    // Procura por data por extenso: ex: "15 de maio de 2026"
    const extensoMatch = textClean.match(/(\d{1,2})\s+de\s+([a-zA-Zçã]+)\s+de\s+(202[4-7])/i);
    if (extensoMatch) {
      const d = parseInt(extensoMatch[1], 10);
      const mStr = extensoMatch[2].toLowerCase();
      const y = parseInt(extensoMatch[3], 10);
      if (MESES_PORTUGUES[mStr] !== undefined && d >= 1 && d <= 31) {
        dataInicio = toIsoDate(d, MESES_PORTUGUES[mStr] + 1, y);
      }
    }
  }

  // 4. Identificar Data de Término Prevista
  let dataFimPrevista = '';
  const fimMatch = textClean.match(/(?:at[ée]|t[ée]rmino\s+em|fim\s+em|data\s+de\s+t[ée]rmino\s*[:\-\s])\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/i);
  if (fimMatch) {
    const d = parseInt(fimMatch[1], 10);
    const m = parseInt(fimMatch[2], 10);
    const y = parseInt(fimMatch[3], 10);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      dataFimPrevista = toIsoDate(d, m, y);
    }
  }

  // Se não houver data de término explícita, calcula: dataInicio + dias
  if (!dataFimPrevista) {
    dataFimPrevista = addDaysToDate(dataInicio, diasAfastamento);
  }

  // 5. Identificar CID (Código Internacional de Doenças)
  let cid: string | undefined;
  let descricaoCid: string | undefined;
  const cidMatch = textClean.match(/(?:CID|CID-?10|C\.I\.D\.?|DIAGN[ÓO]STICO)\s*[:\-\s]?\s*([A-Z]\d{2}(?:\.\d{1,2})?)/i) ||
                   textClean.match(/\b([A-Z]\d{2}\.\d{1,2})\b/);
  if (cidMatch) {
    cid = cidMatch[1].toUpperCase();
    const prefix = cid.split('.')[0];
    descricaoCid = CID_DESCRICOES[cid] || CID_DESCRICOES[prefix] || 'Diagnóstico Médico Codificado';
  }

  // 6. Identificar Tipo de Afastamento (LTS vs Dispensa Médica)
  let tipo: TipoAfastamentoSaude = 'Dispensa Médica';
  if (
    textUpper.includes('LTS') || 
    textUpper.includes('LICENÇA PARA TRATAMENTO') || 
    textUpper.includes('LICENCA PARA TRATAMENTO') ||
    textUpper.includes('LTSP') ||
    textUpper.includes('JUNTA MILITAR DE SAÚDE') ||
    textUpper.includes('JMS') ||
    diasAfastamento > 15
  ) {
    tipo = 'LTS';
  } else if (textUpper.includes('DISPENSA')) {
    tipo = 'Dispensa Médica';
  }

  // 7. Identificar Médico / CRM / Órgão
  let medicoOuJunta: string | undefined;
  const crmMatch = textClean.match(/CRM\s*[:\s#º]?\s*([0-9.\-\/A-Za-z]+)/i);
  const docMatch = textClean.match(/(?:Dr\.?|Dra\.?|M[ée]dico|Perito)\s+([A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ\s]{4,35})/i);
  
  if (textUpper.includes('JUNTA MILITAR DE SAÚDE') || textUpper.includes('JMS')) {
    medicoOuJunta = 'Junta Militar de Saúde (JMS)';
  } else if (docMatch && crmMatch) {
    medicoOuJunta = `${docMatch[0].trim()} - CRM ${crmMatch[1].trim()}`;
  } else if (docMatch) {
    medicoOuJunta = docMatch[0].trim();
  } else if (crmMatch) {
    medicoOuJunta = `Médico assistente CRM: ${crmMatch[1].trim()}`;
  }

  return {
    matricula,
    nome,
    nomeGuerra: nomeGuerra || (nome ? nome.split(' ')[0] : 'Militar'),
    postoGraduacao,
    tipo,
    diasAfastamento,
    dataInicio,
    dataFimPrevista,
    cid,
    descricaoCid,
    medicoOuJunta,
    textoExtraido: textClean.slice(0, 500),
    confianca
  };
}
