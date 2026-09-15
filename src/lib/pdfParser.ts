import { pdfjsLib } from '../services/pdfWorkerSetup';

export interface MilitaryPerson {
  rank: string;
  id: string;
  name: string;
  group: string;
  type: 'SOLO' | 'FT' | '24H' | 'ADMIN';
}

export interface DayAssignment {
  day: number;
  dayShift: string;   // 07-19h ou Turno Unico FT/24H
  nightShift?: string; // 19-07h (Solo apenas)
  type: 'SOLO' | 'FT' | '24H' | 'ADMIN';
}

export interface ScaleData {
  monthYear: string;
  assignments: DayAssignment[];
  soldiers: MilitaryPerson[];
}

export async function parseEscalaPDF(file: File): Promise<ScaleData> {
  console.log("PDF Parser: Starting analysis...");
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    console.log("PDF Parser: Loading document...");
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      // Disable font loading issues that often cause hangs in browser previews
      disableFontFace: true,
      useSystemFonts: false,
      // @ts-ignore - Some versions of pdfjs-dist don't have this in types but it's used to avoid eval()
      isEvalSupported: false 
    });

    const pdf = await loadingTask.promise;
    console.log("PDF Parser: Document loaded successfully. Total pages:", pdf.numPages);
    
    const allSoldiers: MilitaryPerson[] = [];
    const allAssignments: DayAssignment[] = [];
    let monthYear = "Maio/2026";

    // Processar as páginas (1, 2, 3, 4 e 5)
    const maxPages = Math.min(pdf.numPages, 5);
    for (let p = 1; p <= maxPages; p++) {
      console.log(`PDF Parser: Analyzing page ${p}/${maxPages}...`);
      const page = await pdf.getPage(p);
      const textContent = await page.getTextContent();
      const items = textContent.items as any[];
      
      console.log(`PDF Parser: Page ${p} text items:`, items.length);

      // Agrupar itens por linha
      const rowsMap = new Map<number, any[]>();
      const DELTA_Y = 8;
      items.forEach(item => {
        const y = Math.round(item.transform[5]);
        let found = false;
        for (const key of rowsMap.keys()) {
          if (Math.abs(key - y) < DELTA_Y) {
            rowsMap.get(key)?.push(item);
            found = true;
            break;
          }
        }
        if (!found) rowsMap.set(y, [item]);
      });

      const sortedY = Array.from(rowsMap.keys()).sort((a, b) => b - a);
      const lines = sortedY.map(y => (rowsMap.get(y) || []).sort((a, b) => a.transform[4] - b.transform[4]));
      const pageText = items.map(item => item.str).join(' ');
      
      const upperText = pageText.toUpperCase();
      let pageType: 'SOLO' | 'FT' | '24H' | 'ADMIN' = 'SOLO';
      if (upperText.includes('FORÇA TÁTICA') || upperText.includes('FORCA TATICA') || upperText.includes('F.T.')) {
        pageType = 'FT';
      } else if (upperText.includes('24H') || upperText.includes('24 H') || upperText.includes('24HORAS') || upperText.includes('24 HORAS') || upperText.includes('SERVIÇO 24H')) {
        pageType = '24H';
      } else if (upperText.includes('ADMINISTRATIVO') || upperText.includes('ADM.') || upperText.includes('EXPEDIENTE') || upperText.includes('BATALHÃO')) {
        pageType = 'ADMIN';
      } else {
        // Fallback para classificação por número de página tradicional
        if (p === 1) pageType = 'SOLO';
        else if (p === 2 || p === 5) pageType = 'FT';
        else if (p === 3) pageType = '24H';
        else pageType = 'ADMIN';
      }
      
      console.log(`PDF Parser: Page ${p} detected type:`, pageType);

      if (p === 1) {
        const myMatch = pageText.match(/(?:MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO|JANEIRO|FEVEREIRO|MARÇO|ABRIL)\s*[\/\s]*\d{4}/i);
        if (myMatch) {
          monthYear = myMatch[0];
          console.log("PDF Parser: Month/Year found:", monthYear);
        }
      }

      // Extração de Escala (Grid)
      if (pageType === 'SOLO') {
        let dShift: string[] = [];
        let nShift: string[] = [];
        lines.forEach(line => {
          const rowStr = line.map(i => i.str).join(' ').toLowerCase();
          // Solo Grid: Procura por indicadores de janelas de serviço
          if (rowStr.includes('07h') && (rowStr.includes('19h') || rowStr.includes('às'))) {
            const matches = line.flatMap(i => i.str.toUpperCase().split('')).filter(s => /^[A-E]$/.test(s));
            if (matches.length > 20) dShift = matches;
          }
          if (rowStr.includes('19h') && (rowStr.includes('07h') || rowStr.includes('às'))) {
            const matches = line.flatMap(i => i.str.toUpperCase().split('')).filter(s => /^[A-E]$/.test(s));
            if (matches.length > 20) nShift = matches;
          }
        });
        
        // Se falhou por letras grudadas ou formatação complexa
        if (dShift.length < 25) {
          lines.forEach(line => {
             const rowText = line.map(i => i.str).join('').toUpperCase();
             if (rowText.includes('07H') && rowText.includes('19H')) {
                const match = rowText.match(/[A-E]/g);
                if (match && match.length >= 28) dShift = match;
             }
             if (rowText.includes('19H') && rowText.includes('07H')) {
                const match = rowText.match(/[A-E]/g);
                if (match && match.length >= 28) nShift = match;
             }
          });
        }

        for (let d = 1; d <= 31; d++) {
          if (dShift[d-1] || nShift[d-1]) {
            allAssignments.push({ day: d, dayShift: dShift[d-1] || "", nightShift: nShift[d-1] || "", type: 'SOLO' });
          }
        }
      } else {
        // FT ou 24H Grid
        let groups: string[] = [];
        const groupPattern = pageType === 'FT' ? /^[A-C]$/ : /^[A-D]$/;
        
        for (const line of lines) {
          const chars = line.flatMap(i => i.str.toUpperCase().split('').map(s => s.trim())).filter(s => groupPattern.test(s));
          // Procura por uma linha que pareça uma escala mensal (aprox 28-31 chars)
          if (chars.length >= 28 && chars.length <= 32) {
            groups = chars;
            break; // Primeira linha correspondente é sempre a linha de escala do mês
          }
        }

        for (let d = 1; d <= 31; d++) {
          if (groups[d-1]) allAssignments.push({ day: d, dayShift: groups[d-1], type: pageType });
        }
      }

      // Ranks list to identify new soldier columns/cells
      const ranks = [
        '1º', '2º', '3º', '1°', '2°', '3°',
        'CB', 'SD', 'SGT', 'TEN', 'MAJ', 'CAP', 'ASP', 'SUB',
        'SOLDADO', 'CABO', 'SARGENTO', 'TENENTE', 'MAJOR', 'CAPITÃO', 'CAPITAO', 'SUBTENENTE'
      ];

      function startsWithRank(str: string): boolean {
        const clean = str.trim().toUpperCase();
        if (!clean) return false;
        
        // Custom check for 1ºSGT, 2ºSGT, 3ºSGT, etc.
        if (/^[123][º°]\s*[A-Z]+/i.test(clean)) {
          return true;
        }
        
        return ranks.some(rank => {
          const regex = new RegExp('^' + rank + '\\b', 'i');
          return regex.test(clean);
        });
      }

      // Mesclar elementos de texto na mesma linha que estão adjacentes horizontalmente.
      // Isso reconstrói palavras que o leitor de PDF dividiu incorretamente.
      // Usamos uma distância generosa (65px) mas NUNCA mesclamos se o próximo item começa com patente militar.
      const mergedLines = lines.map(line => {
        const merged: any[] = [];
        line.forEach(item => {
          if (merged.length === 0) {
            merged.push({ ...item });
          } else {
            const last = merged[merged.length - 1];
            // Estimar distância entre fim do texto anterior e início do atual
            const lastEndX = last.transform[4] + (last.width || last.str.length * 6);
            const distance = item.transform[4] - lastEndX;
            
            // Heurística baseada em patentes: se o item atual começa com uma patente,
            // representa a transição para um novo militar (possivelmente em outra coluna).
            const isNewSoldier = startsWithRank(item.str);
            
            // Permitir fusão até 65 pixels se não for o início de um novo militar.
            // Se for o início de um novo militar, mantemos separado para não fundir colunas adjacentes.
            if (!isNewSoldier && (distance < 65)) {
              const needsSpace = !last.str.endsWith(' ') && !item.str.startsWith(' ');
              last.str += (needsSpace ? ' ' : '') + item.str;
              if (item.width) {
                last.width = (last.width || 0) + distance + item.width;
              }
            } else {
              merged.push({ ...item });
            }
          }
        });
        return merged;
      });

      // Extração de Militares
      const groupX = { 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0 };
      mergedLines.forEach(mergedLine => {
        mergedLine.forEach(item => {
          const t = item.str.toUpperCase().trim();
          const hasPrefix = t.includes('GRUPO') || t.includes('GP') || t.includes('ALFA') || t.includes('BRAVO') || t.includes('CHARLIE') || t.includes('DELTA') || t.includes('ECHO');
          
          if (t.includes('GRUPO A') || t.includes('ALFA') || t === 'GP A' || (t === 'A' && !groupX['A'])) {
            if (hasPrefix || !groupX['A']) groupX['A'] = item.transform[4];
          } else if (t.includes('GRUPO B') || t.includes('BRAVO') || t === 'GP B' || (t === 'B' && !groupX['B'])) {
            if (hasPrefix || !groupX['B']) groupX['B'] = item.transform[4];
          } else if (t.includes('GRUPO C') || t.includes('CHARLIE') || t === 'GP C' || (t === 'C' && !groupX['C'])) {
            if (hasPrefix || !groupX['C']) groupX['C'] = item.transform[4];
          } else if (t.includes('GRUPO D') || t.includes('DELTA') || t === 'GP D' || (t === 'D' && !groupX['D'])) {
            if (hasPrefix || !groupX['D']) groupX['D'] = item.transform[4];
          } else if (t.includes('GRUPO E') || t.includes('ECHO') || t === 'GP E' || (t === 'E' && !groupX['E'])) {
            if (hasPrefix || !groupX['E']) groupX['E'] = item.transform[4];
          }
        });
      });

      // Expressão regular com suporte a acentos brasileiros e diversas grafias de postos/graduações, ignorando PM/AL e variantes
      const soldierRegex = /\b(1º\s*[A-Z\s]*|2º\s*[A-Z\s]*|3º\s*[A-Z\s]*|1°\s*[A-Z\s]*|2°\s*[A-Z\s]*|3°\s*[A-Z\s]*|CB|SD|SGT|TEN|MAJ|CAP|ASP|SUB|SOLDADO|CABO|SARGENTO|TENENTE|MAJOR|CAPITÃO|CAPITAO|SUBTENENTE)\b\s*(?:PM(?:\/[A-Z]+|-AL)?\s*)?(\d+[-.\/\d]*)?\s+([A-ZÇÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÜ\.\s-]{3,})/i;
      
      mergedLines.forEach(mergedLine => {
        mergedLine.forEach(item => {
          const match = item.str.match(soldierRegex);
          if (match && match[3].trim().length > 3) {
            const x = item.transform[4];
            let bestGroup = 'A'; // Default para A
            let minDist = Infinity;
            
            // Tenta encontrar o grupo mais próximo por coordenada X
            Object.entries(groupX).forEach(([g, gx]) => {
              if (gx > 0) {
                const dist = Math.abs(x - gx);
                if (dist < minDist && dist < 150) { // Tolerância de 150 pixels para colunas
                  minDist = dist; 
                  bestGroup = g; 
                }
              }
            });

            // Fallback para ADMIN: User pediu para ser sempre disponível, 
            if (pageType === 'ADMIN') bestGroup = 'A';

            let name = match[3]
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/\(MOT\)/gi, '')
              .replace(/\(Permanência\)/gi, '')
              .replace(/SOLO\s*-\s*\d+/gi, '')
              .replace(/FORÇA\s*TÁTICA\s*[IV]+/gi, '')
              .trim()
              .toUpperCase()
              .replace(/\s+/g, ' ');

            // Validação mais rigorosa para evitar títulos administrativos ou cabeçalhos
            const isBlacklisted = (n: string) => {
              const blacklist = [
                'CMT', 'COMANDANTE', 'BATALHÃO', 'SEÇÃO', 'POSTO', 'GRADUAÇÃO', 
                'OPERACIONAL', 'ADMINISTRATIVO', 'ESCALA', 'MENSAL', 'GRUPO',
                'SUB CMT', 'ESTADO MAIOR', 'P1', 'P2', 'P3', 'P4'
              ];
              return blacklist.some(b => n.includes(b));
            };

            if (name.length > 3 && !isBlacklisted(name)) {
              allSoldiers.push({
                rank: match[1].trim().toUpperCase(),
                id: match[2] || "",
                name,
                group: bestGroup,
                type: pageType
              });
            }
          }
        });
      });
      console.log(`PDF Parser: Page ${p} finished. Total soldiers found so far:`, allSoldiers.length);
    }

    const uniqueSoldiers = Array.from(new Map(allSoldiers.map(s => [`${s.type}-${s.rank}-${s.name}`, s])).values());
    console.log("PDF Parser: Analysis Multi-page Complete:", { soldiers: uniqueSoldiers.length, assignments: allAssignments.length });

    return { monthYear, assignments: allAssignments, soldiers: uniqueSoldiers };
  } catch (err) {
    console.error("PDF Parser: Error in parseEscalaPDF:", err);
    throw err;
  }
}

