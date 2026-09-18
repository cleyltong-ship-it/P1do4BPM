import { DispensaMedicaLTS, EfetivoMilitar } from '../types';

const STORAGE_KEY = 'DISPENSAS_MEDICAS_LTS_4BPM';

export function getInitialDispensas(efetivo: EfetivoMilitar[] = []): DispensaMedicaLTS[] {
  const now = new Date();
  const formatIso = (d: Date) => 
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const todayStr = formatIso(now);
  
  const d1End = new Date(now);
  d1End.setDate(d1End.getDate() + 25);
  
  const d2End = new Date(now);
  d2End.setDate(d2End.getDate() + 8);

  const d3End = new Date(now);
  d3End.setDate(d3End.getDate() + 4);

  // Encontra militares no efetivo atual se possível
  const m1 = efetivo.find(m => m.situacao.includes('LTS')) || efetivo[2] || {
    matricula: '118234-5',
    nomeCompleto: 'CARLOS ALBERTO DOS SANTOS',
    nomeGuerra: 'C. ALBERTO',
    postoGraduacao: '1º Sgt'
  };

  const m2 = efetivo.find(m => m.postoGraduacao === 'Cb') || efetivo[5] || {
    matricula: '124567-8',
    nomeCompleto: 'MARCOS VINICIUS PEREIRA',
    nomeGuerra: 'VINICIUS',
    postoGraduacao: 'Cb'
  };

  const m3 = efetivo.find(m => m.postoGraduacao === 'Sd') || efetivo[8] || {
    matricula: '139876-1',
    nomeCompleto: 'LUCAS RODRIGUES LIMA',
    nomeGuerra: 'L. RODRIGUES',
    postoGraduacao: 'Sd'
  };

  return [
    {
      id: 'disp-001',
      matricula: m1.matricula,
      nome: (m1 as any).nomeCompleto || m1.nomeGuerra,
      nomeGuerra: m1.nomeGuerra,
      postoGraduacao: m1.postoGraduacao as any,
      tipo: 'LTS',
      diasAfastamento: 30,
      dataInicio: todayStr,
      dataFimPrevista: formatIso(d1End),
      cid: 'M51.1',
      descricaoCid: 'Transtornos de discos lombares e outros / Hérnia de disco',
      medicoOuJunta: 'Junta Militar de Saúde (JMS / PMAL)',
      situacao: 'Em Andamento',
      observacoes: 'Homologado pela JMS para tratamento fisioterápico contínuo.',
      documentoOrigem: 'Atestado_LTS_JMS_4BPM.pdf',
      criadoEm: new Date().toISOString()
    },
    {
      id: 'disp-002',
      matricula: m2.matricula,
      nome: (m2 as any).nomeCompleto || m2.nomeGuerra,
      nomeGuerra: m2.nomeGuerra,
      postoGraduacao: m2.postoGraduacao as any,
      tipo: 'Dispensa Médica',
      diasAfastamento: 15,
      dataInicio: todayStr,
      dataFimPrevista: formatIso(d2End),
      cid: 'S83.5',
      descricaoCid: 'Entorse e distensão do ligamento cruzado do joelho',
      medicoOuJunta: 'Dr. Eduardo Farias - CRM 4589/AL',
      situacao: 'Em Andamento',
      observacoes: 'Dispensa das atividades operacionais de rua e esforços repetitivos.',
      documentoOrigem: 'Dispensa_Medica_Joelho.jpg',
      criadoEm: new Date().toISOString()
    },
    {
      id: 'disp-003',
      matricula: m3.matricula,
      nome: (m3 as any).nomeCompleto || m3.nomeGuerra,
      nomeGuerra: m3.nomeGuerra,
      postoGraduacao: m3.postoGraduacao as any,
      tipo: 'Dispensa Médica',
      diasAfastamento: 5,
      dataInicio: todayStr,
      dataFimPrevista: formatIso(d3End),
      cid: 'J06.9',
      descricaoCid: 'Infecção aguda das vias aéreas superiores',
      medicoOuJunta: 'Dra. Camila Tavares - CRM 7120/AL',
      situacao: 'Em Andamento',
      observacoes: 'Repouso domiciliar e hidratação.',
      documentoOrigem: 'Atestado_Clinico.jpg',
      criadoEm: new Date().toISOString()
    }
  ];
}

export function getDispensas(efetivo: EfetivoMilitar[] = []): DispensaMedicaLTS[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Erro ao ler dispensas do localStorage:', e);
  }

  // Gera dados iniciais
  const initials = getInitialDispensas(efetivo);
  saveDispensas(initials);
  return initials;
}

export function saveDispensas(dispensas: DispensaMedicaLTS[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dispensas));
  } catch (e) {
    console.error('Erro ao salvar dispensas no localStorage:', e);
  }
}

export function addDispensa(item: Omit<DispensaMedicaLTS, 'id' | 'criadoEm'>): DispensaMedicaLTS {
  const current = getDispensas();
  const newItem: DispensaMedicaLTS = {
    ...item,
    id: 'disp-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    criadoEm: new Date().toISOString()
  };
  const updated = [newItem, ...current];
  saveDispensas(updated);
  return newItem;
}

export function updateDispensa(id: string, updates: Partial<DispensaMedicaLTS>): DispensaMedicaLTS[] {
  const current = getDispensas();
  const updated = current.map(item => item.id === id ? { ...item, ...updates } : item);
  saveDispensas(updated);
  return updated;
}

export function deleteDispensa(id: string): DispensaMedicaLTS[] {
  const current = getDispensas();
  const updated = current.filter(item => item.id !== id);
  saveDispensas(updated);
  return updated;
}

export function clearAllDispensas(): DispensaMedicaLTS[] {
  saveDispensas([]);
  return [];
}
