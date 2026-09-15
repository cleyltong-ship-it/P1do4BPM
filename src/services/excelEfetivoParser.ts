import * as XLSX from 'xlsx';
import { EfetivoMilitar, PostoGraduacao, SituacaoOperacional, EscalaTipo } from '../types';

const cleanStr = (val: any): string => {
  if (val === null || val === undefined) return '';
  return String(val).trim();
};

const normalizeHeader = (header: string): string => {
  return header
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]/g, "");
};

// Intelligently map Posto/Graduação string to standard type
export const normalizePosto = (val: string): PostoGraduacao => {
  const clean = val.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  
  if (clean.includes('TEN') && clean.includes('CEL') || clean === 'TC' || clean.includes('TENENTE CORONEL') || clean.includes('TEN-CEL')) {
    return 'Ten-Cel';
  }
  if (clean.includes('CORONEL') || clean === 'CEL') {
    return 'Cel';
  }
  if (clean.includes('MAJOR') || clean === 'MAJ') {
    return 'Maj';
  }
  if (clean.includes('CAPITAO') || clean.includes('CAPITÃO') || clean === 'CAP') {
    return 'Cap';
  }
  if (clean.includes('1') && (clean.includes('TEN') || clean.includes('TENENTE'))) {
    return '1º Ten';
  }
  if (clean.includes('2') && (clean.includes('TEN') || clean.includes('TENENTE')) || clean.includes('ASP') || clean.includes('ASPIRANTE')) {
    return '2º Ten';
  }
  if (clean.includes('TENENTE') || clean === 'TEN') {
    return '1º Ten';
  }
  if (clean.includes('SUB') || clean.includes('ST') || clean.includes('SUBTENENTE')) {
    return 'Subten';
  }
  if (clean.includes('1') && (clean.includes('SGT') || clean.includes('SARGENTO'))) {
    return '1º Sgt';
  }
  if (clean.includes('2') && (clean.includes('SGT') || clean.includes('SARGENTO'))) {
    return '2º Sgt';
  }
  if (clean.includes('3') && (clean.includes('SGT') || clean.includes('SARGENTO'))) {
    return '3º Sgt';
  }
  if (clean.includes('SARGENTO') || clean === 'SGT') {
    return '3º Sgt';
  }
  if (clean.includes('CABO') || clean === 'CB') {
    return 'Cb';
  }
  if (clean.includes('SOLDADO') || clean === 'SD') {
    return 'Sd';
  }
  return 'Sd';
};

// Intelligently map Situação Operacional
export const normalizeSituacao = (val: string): SituacaoOperacional => {
  const clean = val.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  
  if (clean.includes('FERIAS')) {
    return 'Férias';
  }
  if (clean.includes('LTS') || clean.includes('SAUDE') || clean.includes('MEDICA') || clean.includes('ATESTADO')) {
    return 'LTS';
  }
  if (clean.includes('DISPOSICAO') || clean === 'AD') {
    return 'À Disposição';
  }
  if (clean.includes('DISPENSA') || clean.includes('RECOMPENSA')) {
    return 'Dispensa Recompensa';
  }
  if (clean.includes('CURSO') || clean.includes('MISSAO') || clean.includes('VIAGEM') || clean.includes('ESTUDO')) {
    return 'Curso / Missão';
  }
  if (clean.includes('ADMIN') || clean.includes('EXPEDIENTE') || clean === 'P1' || clean === 'P/1' || clean === 'P2' || clean === 'P/2' || clean === 'P3' || clean === 'P/3' || clean === 'P4' || clean === 'P/4') {
    return 'Administrativo';
  }
  if (clean.includes('TATICA') || clean.includes('FORCA TATICA')) {
    return 'Força Tática';
  }
  if (clean.includes('BASE COMUNITARIA')) {
    return 'Base Comunitária';
  }
  if (clean.includes('ARMEIRO') || clean.includes('ARMARIA') || clean.includes('RESERVA DE ARMAMENTO')) {
    return 'Armeiro';
  }
  if (clean.includes('VISTORIADOR') || clean.includes('VISTORIA')) {
    return 'Vistoriador';
  }
  if (clean.includes('AUX') && clean.includes('OPER')) {
    return 'Aux. do Of. de Operações';
  }
  if (clean.includes('OFICIAL') && clean.includes('OPER')) {
    return 'Guarnição do Oficial de Operações';
  }
  if (clean.includes('SUPERVISOR')) {
    return 'Supervisor';
  }
  if (clean.includes('GUARDA')) {
    return 'Guarda do Quartel';
  }
  if (clean.includes('SUBCOMANDANTE')) {
    return 'Subcomandante';
  }
  if (clean.includes('COMANDANTE') && !clean.includes('GUARNICAO')) {
    return 'Comandante';
  }
  
  return 'Solo';
};

// Intelligently map EscalaTipo
export const normalizeEscalaTipo = (val: string): EscalaTipo => {
  const clean = val.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  
  if (clean.includes('FT') || clean.includes('TATICA')) return 'FT';
  if (clean.includes('24') || clean.includes('24H')) return '24H';
  if (clean.includes('ADM') || clean.includes('ADMINISTRATIVO')) return 'ADMIN';
  if (clean.includes('EXPEDIENTE')) return 'EXPEDIENTE';
  if (clean.includes('SOLO') || clean.includes('12')) return 'SOLO';
  
  return 'SOLO';
};

// Format date values that can come as Date, number (Excel serial), or string
const formatExcelDate = (val: any): string => {
  if (!val) return '';
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      return val.toISOString().split('T')[0];
    }
  }
  if (typeof val === 'number') {
    // Excel date serial number (days since 1899-12-30)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const targetDate = new Date(excelEpoch.getTime() + val * 86400000);
    if (!isNaN(targetDate.getTime())) {
      return targetDate.toISOString().split('T')[0];
    }
  }
  const str = String(val).trim();
  // Match DD/MM/YYYY or DD-MM-YYYY
  const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (brMatch) {
    const day = brMatch[1].padStart(2, '0');
    const month = brMatch[2].padStart(2, '0');
    const year = brMatch[3];
    return `${year}-${month}-${day}`;
  }
  // Match YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  return str;
};

export interface ParseExcelResult {
  militares: EfetivoMilitar[];
  totalParsed: number;
  fileName: string;
  detectedColumns: string[];
}

/**
 * Parses an uploaded Excel (.xlsx, .xls, .csv) file containing military personnel list
 */
export async function parseEfetivoExcel(file: File): Promise<ParseExcelResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];

  if (!rawRows || rawRows.length === 0) {
    throw new Error('A planilha está vazia.');
  }

  // Find header row: look for row containing keywords like MATRICULA, POSTO, NOME, GRADUACAO
  let headerRowIndex = -1;
  for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
    const row = rawRows[r];
    const rowStr = row.map(c => normalizeHeader(String(c))).join(' ');
    if (
      (rowStr.includes('MATRICULA') || rowStr.includes('POSTO') || rowStr.includes('GRADUACAO') || rowStr.includes('GUERRA')) &&
      (rowStr.includes('NOME') || rowStr.includes('MILITAR') || rowStr.includes('COMPLETO'))
    ) {
      headerRowIndex = r;
      break;
    }
  }

  // If no specific header found, assume row 0 is header
  if (headerRowIndex === -1) {
    headerRowIndex = 0;
  }

  const headerRow = rawRows[headerRowIndex].map(c => cleanStr(c));
  const detectedColumns = headerRow.filter(Boolean);

  // Map column index to semantic property
  let colMatricula = -1;
  let colPosto = -1;
  let colNomeGuerra = -1;
  let colNomeCompleto = -1;
  let colSituacao = -1;
  let colFuncao = -1;
  let colContato = -1;
  let colEscalaTipo = -1;
  let colGrupoEscala = -1;
  let colDataAdmissao = -1;
  let colDataRetorno = -1;
  let colObservacao = -1;

  headerRow.forEach((h, idx) => {
    const norm = normalizeHeader(h);

    if (colMatricula === -1 && (norm.includes('MATRICULA') || norm === 'RE' || norm === 'RG' || norm === 'NUMERO' || norm === 'CADASTRO')) {
      colMatricula = idx;
    } else if (colPosto === -1 && (norm.includes('POSTO') || norm.includes('GRADUACAO') || norm === 'GRAD' || norm === 'PG')) {
      colPosto = idx;
    } else if (colNomeGuerra === -1 && (norm.includes('GUERRA') || norm === 'NOMEOPERACIONAL' || norm === 'APELIDO')) {
      colNomeGuerra = idx;
    } else if (colNomeCompleto === -1 && (norm.includes('COMPLETO') || norm.includes('NOMECIVIL') || norm === 'NOME' || norm === 'MILITAR' || norm === 'POLICIAL')) {
      colNomeCompleto = idx;
    } else if (colSituacao === -1 && (norm.includes('SITUACAO') || norm.includes('STATUS') || norm.includes('ESTADO') || norm.includes('CONDICAO'))) {
      colSituacao = idx;
    } else if (colFuncao === -1 && (norm.includes('FUNCAO') || norm.includes('CARGO') || norm.includes('ATRIBUICAO') || norm.includes('ATIVIDADE'))) {
      colFuncao = idx;
    } else if (colContato === -1 && (norm.includes('CONTATO') || norm.includes('TELEFONE') || norm.includes('CELULAR') || norm.includes('FONE') || norm.includes('WHATSAPP'))) {
      colContato = idx;
    } else if (colEscalaTipo === -1 && (norm.includes('TIPOESCALA') || norm.includes('MODALIDADE') || norm.includes('REGIME') || norm === 'ESCALA')) {
      colEscalaTipo = idx;
    } else if (colGrupoEscala === -1 && (norm.includes('GRUPO') || norm.includes('EQUIPE') || norm.includes('TURMA') || norm.includes('ALA'))) {
      colGrupoEscala = idx;
    } else if (colDataAdmissao === -1 && (norm.includes('ADMISSAO') || norm.includes('INCLUSAO') || norm.includes('INGRESSO') || norm.includes('DATAINGRESSO'))) {
      colDataAdmissao = idx;
    } else if (colDataRetorno === -1 && (norm.includes('RETORNO') || norm.includes('PREVISAO') || norm.includes('TERMINO'))) {
      colDataRetorno = idx;
    } else if (colObservacao === -1 && (norm.includes('OBSERVACAO') || norm.includes('OBS') || norm.includes('NOTA') || norm.includes('COMENTARIO'))) {
      colObservacao = idx;
    }
  });

  // If nomeGuerra and nomeCompleto were assigned to the same or missing
  if (colNomeGuerra === -1 && colNomeCompleto !== -1) {
    // Check if there's another column containing "NOME"
    headerRow.forEach((h, idx) => {
      const norm = normalizeHeader(h);
      if (idx !== colNomeCompleto && norm.includes('NOME')) {
        colNomeGuerra = idx;
      }
    });
  }

  const militares: EfetivoMilitar[] = [];

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    // Extract raw text
    const rawNomeCompleto = colNomeCompleto !== -1 ? cleanStr(row[colNomeCompleto]) : '';
    const rawNomeGuerra = colNomeGuerra !== -1 ? cleanStr(row[colNomeGuerra]) : '';
    const rawPosto = colPosto !== -1 ? cleanStr(row[colPosto]) : '';
    const rawMatricula = colMatricula !== -1 ? cleanStr(row[colMatricula]) : '';
    const rawSituacao = colSituacao !== -1 ? cleanStr(row[colSituacao]) : '';
    const rawFuncao = colFuncao !== -1 ? cleanStr(row[colFuncao]) : '';
    const rawContato = colContato !== -1 ? cleanStr(row[colContato]) : '';
    const rawEscalaTipo = colEscalaTipo !== -1 ? cleanStr(row[colEscalaTipo]) : '';
    const rawGrupoEscala = colGrupoEscala !== -1 ? cleanStr(row[colGrupoEscala]) : '';
    const rawDataAdmissao = colDataAdmissao !== -1 ? formatExcelDate(row[colDataAdmissao]) : '';
    const rawDataRetorno = colDataRetorno !== -1 ? formatExcelDate(row[colDataRetorno]) : '';
    const rawObservacao = colObservacao !== -1 ? cleanStr(row[colObservacao]) : '';

    // If completely empty row, skip
    if (!rawNomeCompleto && !rawNomeGuerra && !rawMatricula) {
      continue;
    }

    // Determine Posto
    let posto: PostoGraduacao = 'Sd';
    if (rawPosto) {
      posto = normalizePosto(rawPosto);
    } else if (rawNomeCompleto) {
      posto = normalizePosto(rawNomeCompleto);
    } else if (rawNomeGuerra) {
      posto = normalizePosto(rawNomeGuerra);
    }

    // Determine Nome Completo and Nome de Guerra
    let nomeCompleto = rawNomeCompleto;
    let nomeGuerra = rawNomeGuerra;

    if (!nomeCompleto && nomeGuerra) {
      nomeCompleto = nomeGuerra;
    } else if (nomeCompleto && !nomeGuerra) {
      // Derive war name from full name
      const parts = nomeCompleto.split(/\s+/).filter(Boolean);
      if (parts.length > 1) {
        nomeGuerra = `${posto.toUpperCase()} ${parts[parts.length - 1]}`;
      } else {
        nomeGuerra = `${posto.toUpperCase()} ${parts[0] || 'MILITAR'}`;
      }
    }

    // Determine Situação
    const situacao = normalizeSituacao(rawSituacao);

    // Determine Escala Tipo
    const escalaTipo = normalizeEscalaTipo(rawEscalaTipo);

    // Generate/Normalize Matrícula and ID
    const cleanMatricula = rawMatricula || `${Math.floor(10000 + Math.random() * 90000)}-${Math.floor(Math.random() * 9)}`;
    const id = `PM-${cleanMatricula.replace(/[^0-9]/g, '').slice(-4) || String(militares.length + 1).padStart(3, '0')}`;

    militares.push({
      id,
      matricula: cleanMatricula,
      postoGraduacao: posto,
      nomeGuerra: nomeGuerra.toUpperCase(),
      nomeCompleto: nomeCompleto.toUpperCase(),
      situacao,
      funcao: rawFuncao || (['Cel', 'Ten-Cel', 'Maj', 'Cap'].includes(posto) ? 'Oficial / Comando' : 'Patrulheiro Operacional'),
      contato: rawContato || '(82) 98800-0000',
      dataAdmissao: rawDataAdmissao || '2015-01-10',
      escalaTipo,
      grupoEscala: rawGrupoEscala || (escalaTipo === 'SOLO' ? 'G1' : escalaTipo === 'FT' ? 'Alfa' : undefined),
      dataRetorno: (['Férias', 'LTS', 'Dispensa Recompensa'].includes(situacao) && rawDataRetorno) ? rawDataRetorno : undefined,
      observacao: rawObservacao || undefined,
    });
  }

  if (militares.length === 0) {
    throw new Error('Nenhum militar válido foi identificado no arquivo. Verifique o cabeçalho e os dados das colunas.');
  }

  return {
    militares,
    totalParsed: militares.length,
    fileName: file.name,
    detectedColumns,
  };
}

/**
 * Generates and downloads a standardized template Excel file for the user
 */
export function downloadModeloExcelEfetivo(): void {
  const headers = [
    'Matrícula',
    'Posto/Graduação',
    'Nome de Guerra',
    'Nome Completo',
    'Situação Operacional',
    'Função',
    'Contato',
    'Tipo de Escala',
    'Grupo de Escala',
    'Data de Admissão',
    'Data de Retorno',
    'Observações'
  ];

  const sampleRows = [
    [
      '10231-1',
      'Ten-Cel',
      'CORONEL CAVALCANTE',
      'ANTONIO CAVALCANTE DE ALBUQUERQUE',
      'Pronto',
      'Comandante de Batalhão',
      '(82) 98801-1001',
      'ADMIN',
      '',
      '2002-03-15',
      '',
      'Comandante da Unidade'
    ],
    [
      '10892-0',
      'Cap',
      'CAPITÃO MEDEIROS',
      'MARCOS VINICIUS MEDEIROS',
      'Pronto',
      'Comandante Força Tática',
      '(82) 98801-1004',
      'FT',
      'Alfa',
      '2011-04-18',
      '',
      ''
    ],
    [
      '11204-6',
      '1º Ten',
      'TENENTE VIEIRA',
      'LUCAS VIEIRA DE MELO',
      'De Serviço',
      'Oficial de Operações (CPU)',
      '(82) 98801-1005',
      '24H',
      'G1',
      '2014-07-22',
      '',
      'Turno 24h ordinário'
    ],
    [
      '12109-7',
      '1º Sgt',
      'SARGENTO WANDERLEY',
      'WANDERLEY AMORIM JÚNIOR',
      'De Serviço',
      'Comandante de Guarnição FT',
      '(82) 98801-1008',
      'FT',
      'Alfa',
      '2008-05-14',
      '',
      ''
    ],
    [
      '12355-1',
      '1º Sgt',
      'SARGENTO VALENÇA',
      'JOSEILDO VALENÇA BRITO',
      'Folga',
      'Comandante de Guarnição VTR 01',
      '(82) 98801-1009',
      'SOLO',
      'G2',
      '2009-11-20',
      '',
      ''
    ],
    [
      '12498-3',
      '2º Sgt',
      'SARGENTO MENEZES',
      'PAULO MENEZES CORREIA',
      'Férias',
      'Patrulheiro / Comandante RP',
      '(82) 98801-1010',
      'SOLO',
      'G1',
      '2011-06-18',
      '2026-10-05',
      'Férias regulamentares 30 dias'
    ],
    [
      '13502-3',
      'Cb',
      'CABO ALBUQUERQUE',
      'DANIEL ALBUQUERQUE LINS',
      'Pronto',
      'Fiscal de Trânsito',
      '(82) 98801-1014',
      'SOLO',
      'G3',
      '2015-03-01',
      '',
      ''
    ],
    [
      '14201-9',
      'Sd',
      'SOLDADO NOGUEIRA',
      'FELIPE NOGUEIRA COSTA',
      'LTS',
      'Patrulheiro',
      '(82) 98801-1018',
      'SOLO',
      'G1',
      '2020-04-12',
      '2026-09-22',
      'Licença médica (LTS)'
    ]
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

  // Set column widths
  ws['!cols'] = [
    { wch: 14 }, // Matrícula
    { wch: 16 }, // Posto
    { wch: 24 }, // Nome de Guerra
    { wch: 34 }, // Nome Completo
    { wch: 22 }, // Situação
    { wch: 28 }, // Função
    { wch: 18 }, // Contato
    { wch: 15 }, // Escala
    { wch: 16 }, // Grupo
    { wch: 16 }, // Admissão
    { wch: 16 }, // Retorno
    { wch: 30 }, // Observação
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Efetivo 4º BPM');

  XLSX.writeFile(wb, 'modelo_efetivo_4bpm.xlsx');
}
