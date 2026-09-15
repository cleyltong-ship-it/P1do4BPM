import { EfetivoMilitar, DashboardMetrics, SituacaoOperacional, PostoGraduacao } from '../types';

const STORAGE_KEY = 'efetivo_militar_db_v1';

export const INITIAL_EFETIVO: EfetivoMilitar[] = [
  {
    id: 'PM-001',
    matricula: '10231-1',
    postoGraduacao: 'Ten-Cel',
    nomeGuerra: 'CORONEL CAVALCANTE',
    nomeCompleto: 'ANTONIO CAVALCANTE DE ALBUQUERQUE',
    situacao: 'Comandante',
    funcao: 'Comandante de Batalhão',
    contato: '(82) 98801-1001',
    dataAdmissao: '2002-03-15',
    escalaTipo: 'ADMIN',
    observacao: 'Comandante da Unidade',
  },
  {
    id: 'PM-002',
    matricula: '10452-8',
    postoGraduacao: 'Maj',
    nomeGuerra: 'MAJOR BARROS',
    nomeCompleto: 'EDUARDO BARROS DOS SANTOS',
    situacao: 'Subcomandante',
    funcao: 'Subcomandante / Chefe P3',
    contato: '(82) 98801-1002',
    dataAdmissao: '2006-08-10',
    escalaTipo: 'ADMIN',
  },
  {
    id: 'PM-003',
    matricula: '10789-4',
    postoGraduacao: 'Cap',
    nomeGuerra: 'CAPITÃO BRANDÃO',
    nomeCompleto: 'RODRIGO BRANDÃO FARIAS',
    situacao: 'Supervisor',
    funcao: 'Comandante da 1ª Cia / Supervisor',
    contato: '(82) 98801-1003',
    dataAdmissao: '2010-02-01',
    escalaTipo: 'ADMIN',
  },
  {
    id: 'PM-004',
    matricula: '10892-0',
    postoGraduacao: 'Cap',
    nomeGuerra: 'CAPITÃO MEDEIROS',
    nomeCompleto: 'MARCOS VINICIUS MEDEIROS',
    situacao: 'Supervisor',
    funcao: 'Comandante Força Tática',
    contato: '(82) 98801-1004',
    dataAdmissao: '2011-04-18',
    escalaTipo: 'FT',
  },
  {
    id: 'PM-005',
    matricula: '11204-6',
    postoGraduacao: '1º Ten',
    nomeGuerra: 'TENENTE VIEIRA',
    nomeCompleto: 'LUCAS VIEIRA DE MELO',
    situacao: 'Auxiliar do Supervisor',
    funcao: 'Oficial de Operações (CPU)',
    contato: '(82) 98801-1005',
    dataAdmissao: '2014-07-22',
    escalaTipo: '24H',
  },
  {
    id: 'PM-006',
    matricula: '11340-9',
    postoGraduacao: '2º Ten',
    nomeGuerra: 'TENENTE SAMPAIO',
    nomeCompleto: 'GABRIEL SAMPAIO LIMA',
    situacao: 'Auxiliar do Supervisor',
    funcao: 'Comandante de Pelotão RP',
    contato: '(82) 98801-1006',
    dataAdmissao: '2016-01-12',
    escalaTipo: 'SOLO',
    grupoEscala: 'G1',
  },
  {
    id: 'PM-007',
    matricula: '11580-2',
    postoGraduacao: 'Subten',
    nomeGuerra: 'SUBTENENTE DIAS',
    nomeCompleto: 'CLEBERSON DIAS DA SILVA',
    situacao: 'Administrativo',
    funcao: 'Auxiliar P1 / Recursos Humanos',
    contato: '(82) 98801-1007',
    dataAdmissao: '2004-09-03',
    escalaTipo: 'EXPEDIENTE',
  },
  {
    id: 'PM-008',
    matricula: '12109-7',
    postoGraduacao: '1º Sgt',
    nomeGuerra: 'SARGENTO WANDERLEY',
    nomeCompleto: 'WANDERLEY AMORIM JÚNIOR',
    situacao: 'Solo',
    funcao: 'Comandante de Guarnição FT',
    contato: '(82) 98801-1008',
    dataAdmissao: '2008-05-14',
    escalaTipo: 'FT',
    grupoEscala: 'Alfa',
  },
  {
    id: 'PM-009',
    matricula: '12355-1',
    postoGraduacao: '1º Sgt',
    nomeGuerra: 'SARGENTO VALENÇA',
    nomeCompleto: 'JOSEILDO VALENÇA BRITO',
    situacao: 'À Disposição',
    funcao: 'Comandante de Guarnição VTR 01',
    contato: '(82) 98801-1009',
    dataAdmissao: '2009-11-20',
    escalaTipo: 'SOLO',
    grupoEscala: 'G2',
  },
  {
    id: 'PM-010',
    matricula: '12498-3',
    postoGraduacao: '2º Sgt',
    nomeGuerra: 'SARGENTO MENEZES',
    nomeCompleto: 'PAULO MENEZES CORREIA',
    situacao: 'Férias',
    funcao: 'Patrulheiro / Comandante RP',
    contato: '(82) 98801-1010',
    dataAdmissao: '2011-06-18',
    escalaTipo: 'SOLO',
    dataRetorno: '2026-10-05',
    observacao: 'Férias regulamentares 30 dias',
  },
  {
    id: 'PM-011',
    matricula: '12780-4',
    postoGraduacao: '2º Sgt',
    nomeGuerra: 'SARGENTO FERREIRA',
    nomeCompleto: 'ALEXANDRE FERREIRA DE SOUZA',
    situacao: 'Base Comunitária',
    funcao: 'Comandante de Posto Avançado',
    contato: '(82) 98801-1011',
    dataAdmissao: '2012-03-09',
    escalaTipo: '24H',
  },
  {
    id: 'PM-012',
    matricula: '13012-8',
    postoGraduacao: '3º Sgt',
    nomeGuerra: 'SARGENTO TAVARES',
    nomeCompleto: 'DANILO TAVARES NOGUEIRA',
    situacao: 'Vistoriador',
    funcao: 'Fiscalização de Trânsito / Vistorias',
    contato: '(82) 98801-1012',
    dataAdmissao: '2013-10-05',
    escalaTipo: 'SOLO',
    grupoEscala: 'G3',
  },
  {
    id: 'PM-013',
    matricula: '13145-2',
    postoGraduacao: '3º Sgt',
    nomeGuerra: 'SARGENTO COSTA',
    nomeCompleto: 'MANOEL COSTA CARDOSO',
    situacao: 'LTS',
    funcao: 'Operador Força Tática',
    contato: '(82) 98801-1013',
    dataAdmissao: '2014-02-17',
    escalaTipo: 'FT',
    dataRetorno: '2026-09-25',
    observacao: 'Licença Médica - Ortopedia HPM',
  },
  {
    id: 'PM-014',
    matricula: '13420-1',
    postoGraduacao: 'Cb',
    nomeGuerra: 'CABO HENRIQUE',
    nomeCompleto: 'CARLOS HENRIQUE MATOS',
    situacao: 'Solo',
    funcao: 'Motorista de Viatura',
    contato: '(82) 98801-1014',
    dataAdmissao: '2015-08-30',
    escalaTipo: 'SOLO',
    grupoEscala: 'G1',
  },
  {
    id: 'PM-015',
    matricula: '13560-7',
    postoGraduacao: 'Cb',
    nomeGuerra: 'CABO ANDRADE',
    nomeCompleto: 'WESLEY ANDRADE PINTO',
    situacao: 'À Disposição',
    funcao: 'Segurança / Patrulhamento',
    contato: '(82) 98801-1015',
    dataAdmissao: '2015-09-02',
    escalaTipo: 'SOLO',
    grupoEscala: 'G2',
  },
  {
    id: 'PM-016',
    matricula: '13789-0',
    postoGraduacao: 'Cb',
    nomeGuerra: 'CABO PEIXOTO',
    nomeCompleto: 'BRUNO PEIXOTO BEZERRA',
    situacao: 'Solo',
    funcao: 'Escudeiro / Tático',
    contato: '(82) 98801-1016',
    dataAdmissao: '2016-04-14',
    escalaTipo: 'FT',
    grupoEscala: 'Bravo',
  },
  {
    id: 'PM-017',
    matricula: '13904-5',
    postoGraduacao: 'Cb',
    nomeGuerra: 'CABO FAGUNDES',
    nomeCompleto: 'TIAGO FAGUNDES LEITE',
    situacao: 'Administrativo',
    funcao: 'Analista de Inteligência Policial',
    contato: '(82) 98801-1017',
    dataAdmissao: '2016-11-21',
    escalaTipo: 'EXPEDIENTE',
  },
  {
    id: 'PM-018',
    matricula: '14102-3',
    postoGraduacao: 'Sd',
    nomeGuerra: 'SOLDADO NOGUEIRA',
    nomeCompleto: 'LUIZ FELIPE NOGUEIRA',
    situacao: 'Guarda do Quartel',
    funcao: 'Patrulheiro / Sentinela',
    contato: '(82) 98801-1018',
    dataAdmissao: '2020-03-10',
    escalaTipo: 'SOLO',
    grupoEscala: 'G1',
  },
  {
    id: 'PM-019',
    matricula: '14210-9',
    postoGraduacao: 'Sd',
    nomeGuerra: 'SOLDADO ROCHA',
    nomeCompleto: 'FELIPE ROCHA MARQUES',
    situacao: 'Solo',
    funcao: 'Patrulheiro Rádio Patrulha',
    contato: '(82) 98801-1019',
    dataAdmissao: '2020-03-10',
    escalaTipo: 'SOLO',
    grupoEscala: 'G3',
  },
  {
    id: 'PM-020',
    matricula: '14350-1',
    postoGraduacao: 'Sd',
    nomeGuerra: 'SOLDADO NASCIMENTO',
    nomeCompleto: 'VINICIUS NASCIMENTO SILVA',
    situacao: 'Base Comunitária',
    funcao: 'Atirador de Precisão / FT',
    contato: '(82) 98801-1020',
    dataAdmissao: '2020-04-05',
    escalaTipo: 'FT',
    grupoEscala: 'Charlie',
  },
  {
    id: 'PM-021',
    matricula: '14480-8',
    postoGraduacao: 'Sd',
    nomeGuerra: 'SOLDADO BATISTA',
    nomeCompleto: 'JEFFERSON BATISTA LIMA',
    situacao: 'À Disposição',
    funcao: 'Patrulheiro Rural',
    contato: '(82) 98801-1021',
    dataAdmissao: '2021-01-15',
    escalaTipo: '24H',
    dataRetorno: '2026-09-18',
    observacao: 'Dispensa recompensa de 3 dias',
  },
  {
    id: 'PM-022',
    matricula: '14590-2',
    postoGraduacao: 'Sd',
    nomeGuerra: 'SOLDADO OLIVEIRA',
    nomeCompleto: 'RAFAEL OLIVEIRA GOMES',
    situacao: 'Solo',
    funcao: 'Batedor / Trânsito Urbano',
    contato: '(82) 98801-1022',
    dataAdmissao: '2021-06-20',
    escalaTipo: 'SOLO',
    grupoEscala: 'G4',
  },
  {
    id: 'PM-023',
    matricula: '14670-6',
    postoGraduacao: 'Sd',
    nomeGuerra: 'SOLDADO PEREIRA',
    nomeCompleto: 'MATHEUS PEREIRA DUARTE',
    situacao: 'À Disposição',
    funcao: 'Curso de Especialização Tática',
    contato: '(82) 98801-1023',
    dataAdmissao: '2021-09-10',
    escalaTipo: 'ADMIN',
    dataRetorno: '2026-10-15',
    observacao: 'Curso de Nivelamento Operacional na APMDG',
  },
  {
    id: 'PM-024',
    matricula: '14800-4',
    postoGraduacao: 'Sd',
    nomeGuerra: 'SOLDADO CARDOSO',
    nomeCompleto: 'GUSTAVO CARDOSO MOURA',
    situacao: 'Solo',
    funcao: 'Patrulheiro / Operador Rádio',
    contato: '(82) 98801-1024',
    dataAdmissao: '2022-02-18',
    escalaTipo: 'SOLO',
    grupoEscala: 'G2',
  },
  {
    id: 'PM-025',
    matricula: '14910-1',
    postoGraduacao: 'Sd',
    nomeGuerra: 'SOLDADO TEIXEIRA',
    nomeCompleto: 'LEANDRO TEIXEIRA CAMPOS',
    situacao: 'Armeiro',
    funcao: 'Auxiliar Reserva de Armamento',
    contato: '(82) 98801-1025',
    dataAdmissao: '2022-05-12',
    escalaTipo: '24H',
  },
  {
    id: 'PM-026',
    matricula: '12240-5',
    postoGraduacao: '1º Sgt',
    nomeGuerra: 'SARGENTO ROMULO',
    nomeCompleto: 'ROMULO CESAR ALBUQUERQUE',
    situacao: 'Vistoriador',
    funcao: 'Vistoriador',
    contato: '(82) 98801-1026',
    dataAdmissao: '2010-04-10',
    escalaTipo: 'SOLO',
  },
  {
    id: 'PM-027',
    matricula: '12280-9',
    postoGraduacao: '1º Sgt',
    nomeGuerra: 'SARGENTO ODIRLEY',
    nomeCompleto: 'ODIRLEY JOSÉ DOS SANTOS',
    situacao: 'Aux. do Of. de Operações',
    funcao: 'Aux. do Of. de Operações',
    contato: '(82) 98801-1027',
    dataAdmissao: '2010-06-15',
    escalaTipo: '24H',
  },
  {
    id: 'PM-028',
    matricula: '12650-3',
    postoGraduacao: '2º Sgt',
    nomeGuerra: 'SARGENTO DANTAS',
    nomeCompleto: 'MARCOS ANTONIO DANTAS',
    situacao: 'Armeiro',
    funcao: 'Armeiro',
    contato: '(82) 98801-1028',
    dataAdmissao: '2012-08-20',
    escalaTipo: '24H',
  }
];

export function getEfetivo(): EfetivoMilitar[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Only initialize default data on the very first visit (when key does not exist at all)
    if (raw === null) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_EFETIVO));
      return INITIAL_EFETIVO;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    if (parsed.length === 0) {
      return [];
    }
    // Migration for legacy statuses (e.g. Pronto, De Serviço, Folga, Reserva de Armamento)
    const migrated = parsed.map((m: any) => {
      let situacao = m.situacao;
      if (situacao === 'Pronto' || situacao === 'Folga' || situacao === 'De Serviço') {
        situacao = 'Solo';
      } else if (situacao === 'Reserva de Armamento') {
        situacao = 'Armeiro';
      }
      return { ...m, situacao };
    });
    return migrated;
  } catch (err) {
    console.error('Erro ao ler efetivo do localStorage:', err);
    return [];
  }
}

export function saveEfetivo(data: EfetivoMilitar[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Erro ao salvar efetivo:', err);
  }
}

export function clearAllEfetivo(): EfetivoMilitar[] {
  saveEfetivo([]);
  return [];
}

export function addMilitar(militar: Omit<EfetivoMilitar, 'id'>): EfetivoMilitar {
  const current = getEfetivo();
  const nextId = `PM-${String(current.length + 1).padStart(3, '0')}`;
  const novo: EfetivoMilitar = {
    ...militar,
    id: nextId,
    nomeGuerra: militar.nomeGuerra.toUpperCase().trim(),
    nomeCompleto: militar.nomeCompleto.toUpperCase().trim(),
  };
  const updated = [novo, ...current];
  saveEfetivo(updated);
  return novo;
}

export function updateMilitar(id: string, updates: Partial<EfetivoMilitar>): EfetivoMilitar | null {
  const current = getEfetivo();
  const index = current.findIndex(m => m.id === id);
  if (index === -1) return null;
  const updatedItem: EfetivoMilitar = {
    ...current[index],
    ...updates,
    nomeGuerra: updates.nomeGuerra ? updates.nomeGuerra.toUpperCase().trim() : current[index].nomeGuerra,
    nomeCompleto: updates.nomeCompleto ? updates.nomeCompleto.toUpperCase().trim() : current[index].nomeCompleto,
  };
  current[index] = updatedItem;
  saveEfetivo(current);
  return updatedItem;
}

export function deleteMilitar(id: string): boolean {
  const current = getEfetivo();
  const filtered = current.filter(m => m.id !== id);
  if (filtered.length === current.length) return false;
  saveEfetivo(filtered);
  return true;
}

export function updateSituacao(id: string, situacao: SituacaoOperacional, dataRetorno?: string): void {
  updateMilitar(id, { situacao, dataRetorno });
}

export function resetEfetivoToDefault(): EfetivoMilitar[] {
  saveEfetivo(INITIAL_EFETIVO);
  return INITIAL_EFETIVO;
}

export function importEfetivoReplace(newList: EfetivoMilitar[]): EfetivoMilitar[] {
  saveEfetivo(newList);
  return newList;
}

export function importEfetivoMerge(newList: EfetivoMilitar[]): EfetivoMilitar[] {
  const current = getEfetivo();
  const currentMap = new Map<string, EfetivoMilitar>();

  // Index existing by matricula or clean name
  current.forEach(m => {
    if (m.matricula) currentMap.set(m.matricula.trim(), m);
  });

  const merged = [...current];

  newList.forEach(item => {
    const key = item.matricula ? item.matricula.trim() : null;
    if (key && currentMap.has(key)) {
      // Update existing
      const existing = currentMap.get(key)!;
      const index = merged.findIndex(m => m.id === existing.id);
      if (index !== -1) {
        merged[index] = {
          ...existing,
          ...item,
          id: existing.id // Keep existing ID
        };
      }
    } else {
      // Add new
      merged.push(item);
    }
  });

  saveEfetivo(merged);
  return merged;
}


export function calculateDashboardMetrics(efetivo: EfetivoMilitar[]): DashboardMetrics {
  const total = efetivo.length;
  const efetivoTotalPrevisto = 400; // Quadro Organizacional Previsto
  const efetivoExistente = total; // Total que consta no arquivo Excel / banco

  const isLts = (situacao: string) => {
    if (!situacao) return false;
    const lower = situacao.toLowerCase();
    return lower.includes('lts') || lower.includes('licença') || lower.includes('licenca') || lower.includes('atestado') || lower.includes('saude') || lower.includes('saúde');
  };

  const isFerias = (situacao: string) => {
    if (!situacao) return false;
    const lower = situacao.toLowerCase();
    return lower.includes('férias') || lower.includes('ferias');
  };

  const isADisposicao = (situacao: string) => {
    if (!situacao) return false;
    const lower = situacao.toLowerCase().trim();
    return lower.includes('disposição') || lower.includes('disposicao') || lower === 'ad' || lower === 'à disposição' || lower === 'a disposicao';
  };

  const isOutroAfastamento = (situacao: string) => {
    if (!situacao) return false;
    const lower = situacao.toLowerCase();
    return lower.includes('dispensa') || lower.includes('curso') || lower.includes('missão') || lower.includes('missao');
  };

  const ltsCount = efetivo.filter(m => isLts(m.situacao)).length;
  const feriasCount = efetivo.filter(m => isFerias(m.situacao)).length;
  const aDisposicaoCount = efetivo.filter(m => isADisposicao(m.situacao)).length;

  // Efetivo Disponível: Efetivo Existente subtraído o número de militares de LTS, à disposição e férias
  const totalSubtraidos = efetivo.filter(m => 
    isLts(m.situacao) || isFerias(m.situacao) || isADisposicao(m.situacao) || isOutroAfastamento(m.situacao)
  ).length;
  const efetivoDisponivel = Math.max(0, efetivoExistente - totalSubtraidos);

  // Postos operacionais ou de comando que NUNCA pertencem à Atividade Meio
  const isOperacionalOuComando = (situacao: string) => {
    if (!situacao) return false;
    const s = situacao.trim().toLowerCase();
    return (
      s === 'solo' ||
      s.includes('solo') ||
      s === 'força tática' ||
      s.includes('força tática') ||
      s.includes('forca tatica') ||
      s === 'base comunitária' ||
      s.includes('base comunitária') ||
      s.includes('base comunitaria') ||
      s === 'guarda do quartel' ||
      s.includes('guarda do quartel') ||
      s.includes('guarda') ||
      s === 'guarnição do oficial de operações' ||
      s.includes('guarnição do oficial') ||
      s.includes('guarnicao do oficial') ||
      s === 'aux. do of. de operações' ||
      s.includes('aux. do of') ||
      s.includes('auxiliar do supervisor') ||
      s === 'supervisor' ||
      s.includes('supervisor') ||
      s === 'vistoriador' ||
      s.includes('vistoriador') ||
      s === 'armeiro' ||
      s.includes('armeiro') ||
      s === 'reserva de armamento' ||
      s.includes('reserva de armamento') ||
      s === 'comandante' ||
      s.includes('comandante') ||
      s === 'subcomandante' ||
      s.includes('subcomandante') ||
      s === 'de serviço' ||
      s.includes('de serviço') ||
      s.includes('de servico')
    );
  };

  // Atividade Meio: militares efetivamente lotados no Administrativo/Expediente (Escala 04)
  const isAdministrativo = (m: EfetivoMilitar) => {
    // 1. Se estiver afastado (LTS, Férias, À Disposição, etc), não entra na Atividade Meio
    if (isLts(m.situacao) || isFerias(m.situacao) || isADisposicao(m.situacao) || isOutroAfastamento(m.situacao)) {
      return false;
    }
    // 2. Se estiver em posto operacional ou comando, NUNCA é Atividade Meio
    if (isOperacionalOuComando(m.situacao)) {
      return false;
    }

    const s = (m.situacao || '').trim().toLowerCase();
    const f = (m.funcao || '').trim().toLowerCase();

    // 3. Verificação por situação explícita de Administrativo ou Seções
    if (
      s === 'administrativo' ||
      s.includes('administrativo') ||
      s === 'expediente' ||
      s.includes('expediente') ||
      s === 'p2' ||
      s.includes('seção') ||
      s.includes('secao')
    ) {
      return true;
    }

    // 4. Verificação complementar por função administrativa (caso a situação seja genérica)
    if (!s || s === 'pronto') {
      if (
        f.includes('administrativo') ||
        f.includes('expediente') ||
        f.includes('recursos humanos') ||
        f.includes('p1') ||
        f.includes('p/1') ||
        f.includes('p/2') ||
        f.includes('p/3') ||
        f.includes('p/4') ||
        f.includes('p/5') ||
        f.includes('secretaria') ||
        f.includes('almoxarifado')
      ) {
        return true;
      }
    }

    return false;
  };

  const atividadeMeio = efetivo.filter(m => isAdministrativo(m)).length;

  // Atividade Fim - Geral: todos os militares que estão em alguma escala operacional, subtraído os do Administrativo
  const atividadeFimGeral = Math.max(0, efetivoDisponivel - atividadeMeio);

  // De serviço e folgas operacionais
  const isDeServico = (situacao: string) => {
    if (isLts(situacao) || isFerias(situacao) || isADisposicao(situacao) || isOutroAfastamento(situacao)) return false;
    const lower = situacao.toLowerCase();
    return lower !== 'folga' && lower !== 'pronto';
  };

  const prontos = efetivo.filter(m => {
    const s = (m.situacao || '').toLowerCase();
    return s === 'pronto' || s === 'folga';
  }).length;

  const deServico = efetivo.filter(m => isDeServico(m.situacao)).length;
  const folga = efetivo.filter(m => (m.situacao || '').toLowerCase() === 'folga').length;
  const afastados = totalSubtraidos;
  
  // Aptos para extra: efetivo disponível operacional
  const aptosExtra = efetivoDisponivel;
  const taxaProntidao = efetivoExistente > 0 ? Math.round((efetivoDisponivel / efetivoExistente) * 100) : 0;

  // Distribuicao Postos
  const postosOrder: PostoGraduacao[] = ['Cel', 'Ten-Cel', 'Maj', 'Cap', '1º Ten', '2º Ten', 'Subten', '1º Sgt', '2º Sgt', '3º Sgt', 'Cb', 'Sd'];
  const postosCount: { [key: string]: number } = {};
  postosOrder.forEach(p => (postosCount[p] = 0));
  efetivo.forEach(m => {
    if (postosCount[m.postoGraduacao] !== undefined) {
      postosCount[m.postoGraduacao]++;
    } else {
      postosCount[m.postoGraduacao] = (postosCount[m.postoGraduacao] || 0) + 1;
    }
  });

  const distribuicaoPostos = postosOrder
    .filter(p => postosCount[p] > 0)
    .map(p => ({
      posto: p,
      quantidade: postosCount[p],
      percentual: total > 0 ? Math.round((postosCount[p] / total) * 100) : 0,
    }));

  const militaresServicoHoje = efetivo.filter(m => isDeServico(m.situacao));

  const ultimosAvisos: DashboardMetrics['ultimosAvisos'] = [
    {
      id: 'aviso-1',
      tipo: 'alerta',
      titulo: 'Descanso Obrigatório de 24h/48h',
      data: 'Hoje, 07:00',
      descricao: 'Verificação automática de intervalos interjornadas para escalas de extra ativada.',
    },
    {
      id: 'aviso-2',
      tipo: 'info',
      titulo: 'Militares em Férias e Licença',
      data: 'Set/2026',
      descricao: `${afastados} militar(es) do efetivo cadastrado estão atualmente afastados regulamentarmente.`,
    },
    {
      id: 'aviso-3',
      tipo: 'urgente',
      titulo: 'Prontidão Operacional Geral',
      data: 'Atualizado em tempo real',
      descricao: `${taxaProntidao}% do efetivo em condições de pronto emprego ou emprego imediato.`,
    }
  ];

  return {
    efetivoTotalPrevisto,
    efetivoExistente,
    efetivoDisponivel,
    atividadeFimGeral,
    atividadeMeio,
    ltsCount,
    feriasCount,
    aDisposicaoCount,
    totalEfetivo: total,
    prontos,
    deServicoHoje: deServico,
    emFolga: folga,
    afastados,
    aptosExtra,
    taxaProntidao,
    distribuicaoPostos,
    militaresServicoHoje,
    ultimosAvisos,
  };
}
