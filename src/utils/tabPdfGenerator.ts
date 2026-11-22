import { jsPDF } from 'jspdf';
import { StudioInfo } from '../types';

export type TabInstrumentType = 'guitar' | 'bass4' | 'bass5' | 'drums';

export interface TabMeasure {
  id: string;
  sectionLabel?: string; // es. "Intro", "Strofa", "Ritornello"
  repeatStart?: boolean;
  repeatEnd?: boolean;
  repeatCount?: number; // es. 2, 4
  stepsCount: number; // 8, 12, 16
  chords: Record<number, string>; // stepIndex -> nome accordo (es. "Am", "G5")
  cells: Record<string, string>; // `${lineIndex}_${stepIndex}` -> valore (es. "0", "12", "7h9", "x", "o")
}

export interface TabSheetDocument {
  id: string;
  title: string;
  artistOrStudent: string;
  teacherName: string;
  instrument: TabInstrumentType;
  tuningLabel: string;
  lines: string[]; // dall'alto in basso (es. ['e', 'B', 'G', 'D', 'A', 'E'])
  bpm: number;
  timeSignature: string;
  capo: number;
  notes: string;
  measures: TabMeasure[];
  updatedAt: string;
}

interface ProcessedLogoAssets {
  headerBannerDataUrl: string;
  aspectRatio: number;
}

/**
 * Carica /logo-header.png ("La musica fa...") mantenendo il 100% della larghezza e leggibilità
 * (chitarra a sinistra, scritta completa "La musica fa..." e sottotitolo intero)
 * sfumando solo lo sfondo azzurrino chiaro verso il bianco del foglio, senza mai tagliare il logo.
 */
async function loadProcessedStudioLogos(): Promise<ProcessedLogoAssets | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const w = img.naturalWidth || 600;
          const h = img.naturalHeight || 600;
          const aspectRatio = w / h;

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }

          // Disegna l'immagine originale intera
          ctx.drawImage(img, 0, 0, w, h);

          // Elabora i pixel per trasformare il fondino azzurro/bianco quadrato in bianco puro
          // preservando al 100% tutte le scritte ("La musica fa...", sottotitolo) e la chitarra
          const imgData = ctx.getImageData(0, 0, w, h);
          const data = imgData.data;

          for (let y = 0; y < h; y++) {
            // Sfumatura morbida solo sul 4% estremo del bordo rettangolare
            const edgeY = Math.min(y / (h * 0.05), (h - 1 - y) / (h * 0.05), 1);
            for (let x = 0; x < w; x++) {
              const edgeX = Math.min(x / (w * 0.04), (w - 1 - x) / (w * 0.04), 1);
              const edgeFactor = Math.min(edgeX, edgeY);

              const idx = (y * w + x) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              const a = data[idx + 3] / 255;

              // Calcola quanto il pixel appartiene allo sfondo chiaro azzurrino/bianco
              // (Lo sfondo ha r > 205, g > 225, b > 235; il testo blu e la chitarra marrone hanno r o g molto più bassi)
              let bgBlend = 0;
              if (r > 195 && g > 218 && b > 228) {
                const lightness = (r + g + b) / (3 * 255);
                bgBlend = Math.min(1, Math.max(0, (lightness - 0.82) / 0.14));
              }

              // Opacità effettiva del tratto grafico (0.86 per effetto filigrana/intestazione elegante ma nitidissima)
              const fgOpacity = 0.88 * edgeFactor * (1 - bgBlend * 0.85) * a;

              // Componi direttamente su bianco puro (#ffffff) per PDF perfetto
              data[idx] = Math.round(r * fgOpacity + 255 * (1 - fgOpacity));
              data[idx + 1] = Math.round(g * fgOpacity + 255 * (1 - fgOpacity));
              data[idx + 2] = Math.round(b * fgOpacity + 255 * (1 - fgOpacity));
              data[idx + 3] = 255;
            }
          }

          ctx.putImageData(imgData, 0, 0);

          resolve({
            headerBannerDataUrl: canvas.toDataURL('image/png'),
            aspectRatio,
          });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = '/logo-header.png';
    } catch {
      resolve(null);
    }
  });
}

const INSTRUMENT_SUBTITLES: Record<TabInstrumentType, string> = {
  guitar: 'Partitura & Tablatura per Chitarra (6 Corde)',
  bass4: 'Partitura & Tablatura per Basso Elettrico (4 Corde)',
  bass5: 'Partitura & Tablatura per Basso Elettrico (5 Corde)',
  drums: 'Partitura Ritmica per Batteria (Drum Score)',
};

/**
 * Disegna una testa di nota ovale inclinata piena (per Cassa, Rullante, Tom) in jsPDF
 */
function drawFilledNotehead(doc: jsPDF, cx: number, cy: number, rx = 1.25, ry = 0.9, isGhost = false) {
  doc.setFillColor(15, 23, 42);
  doc.setDrawColor(15, 23, 42);
  doc.ellipse(cx, cy, rx, ry, 'F');

  // Se è una ghost note ('g'), disegna le parentesi ( ● ) attorno alla nota
  if (isGhost) {
    doc.setFont('times', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('(', cx - rx - 1.1, cy + 0.8, { align: 'center' });
    doc.text(')', cx + rx + 1.1, cy + 0.8, { align: 'center' });
  }
}

/**
 * Disegna una testa di nota a croce "×" (per Charleston / Hi-Hat, Crash, Ride) come in Foto 2
 */
function drawCrossNotehead(
  doc: jsPDF,
  cx: number,
  cy: number,
  size = 1.05,
  isOpenHiHat = false,
  hasLedgerLine = false
) {
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.42);
  doc.line(cx - size, cy - size, cx + size, cy + size);
  doc.line(cx - size, cy + size, cx + size, cy - size);

  // Taglio addizionale per il Crash sopra il pentagramma
  if (hasLedgerLine) {
    doc.setLineWidth(0.32);
    doc.line(cx - size * 1.45, cy, cx + size * 1.45, cy);
  }

  // Cerchietto sopra la x per Charleston Aperto ('O')
  if (isOpenHiHat) {
    doc.setLineWidth(0.3);
    doc.circle(cx, cy - size - 1.1, 0.7, 'S');
  }
}

/**
 * Restituisce la posizione verticale Y e il tipo di nota sul pentagramma standard a 5 linee per Batteria (Foto 2):
 * Pentagramma: 5 linee da L0 (linea superiore = staffTopY) a L4 (linea inferiore = staffTopY + 4 * space).
 */
export function getDrumStaffNotePosition(
  lineCode: string,
  staffTopY: number,
  space: number
): { y: number; isCross: boolean; hasLedger?: boolean } {
  switch (lineCode) {
    case 'CC': // Crash: sopra il rigo con taglio addizionale
      return { y: staffTopY - 1.0 * space, isCross: true, hasLedger: true };
    case 'HH': // Charleston (Hi-Hat): appoggiato sopra la 5ª linea superiore (come in Foto 2)
      return { y: staffTopY - 0.5 * space, isCross: true };
    case 'RD': // Ride: sulla 5ª linea superiore
      return { y: staffTopY, isCross: true };
    case 'HT': // High Tom (Tom 1): nel 4° spazio (in alto)
      return { y: staffTopY + 0.5 * space, isCross: false };
    case 'MT': // Mid Tom (Tom 2): sulla 4ª linea
      return { y: staffTopY + 1.0 * space, isCross: false };
    case 'SD': // Rullante (Snare): nel 3° spazio centrale (esattamente come in Foto 2)
      return { y: staffTopY + 1.5 * space, isCross: false };
    case 'FT': // Timpano (Floor Tom): nel 2° spazio (esattamente come nel fill di Foto 2)
      return { y: staffTopY + 2.5 * space, isCross: false };
    case 'BD': // Cassa (Kick): nel 1° spazio in basso (esattamente come in Foto 2)
    default:
      return { y: staffTopY + 3.5 * space, isCross: false };
  }
}

/**
 * Raggruppa gli step attivi di una battuta di batteria per disegnare gambette (stems) e travi (beams)
 * esattamente come nella notazione di batteria di Foto 2.
 */
export function computeDrumBeamGroups(
  activeSteps: number[],
  stepsCount: number
): number[][] {
  if (activeSteps.length === 0) return [];

  if (stepsCount === 16) {
    const groups: number[][] = [];
    // Dividi la battuta in 2 metà (beat 1-2 = 0..7, beat 3-4 = 8..15)
    for (let half = 0; half < 2; half++) {
      const halfStart = half * 8;
      const halfEnd = halfStart + 7;
      const inHalf = activeSteps.filter((s) => s >= halfStart && s <= halfEnd);
      if (inHalf.length === 0) continue;

      const hasSixteenths = inHalf.some((s) => s % 2 === 1);
      // Se sono tutti ottavi regolari (es. 0, 2, 4, 6 come nel groove di Foto 2), unisci tutti e 4 sotto un'unica trave!
      if (!hasSixteenths && inHalf.length === 4) {
        groups.push(inHalf);
      } else {
        // Altrimenti raggruppa quarto per quarto (beat da 4 sedicesimi: 0..3, 4..7, 8..11, 12..15)
        for (let beat = 0; beat < 2; beat++) {
          const bStart = halfStart + beat * 4;
          const bEnd = bStart + 3;
          const inBeat = inHalf.filter((s) => s >= bStart && s <= bEnd);
          if (inBeat.length > 0) groups.push(inBeat);
        }
      }
    }
    return groups;
  }

  // Per 8 o 12 step: raggruppa a metà battuta o a terzine
  const groupSize = stepsCount === 12 ? 3 : 4;
  const groups: number[][] = [];
  for (let start = 0; start < stepsCount; start += groupSize) {
    const sub = activeSteps.filter((s) => s >= start && s < start + groupSize);
    if (sub.length > 0) groups.push(sub);
  }
  return groups;
}

/**
 * Genera e scarica il PDF A4 della Tablatura / Partitura Batteria
 * con il logo "La musica fa..." completamente leggibile in alto e notazione batteria come in Foto 2.
 */
export async function generateTabSheetPDF(
  sheet: TabSheetDocument,
  studioInfo?: StudioInfo,
  options?: { blankTemplate?: boolean }
): Promise<void> {
  const isBlank = Boolean(options?.blankTemplate);
  const logoAssets = await loadProcessedStudioLogos();

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 13;
  const contentWidth = pageWidth - marginX * 2; // 184mm

  const studioName =
    studioInfo?.nome && studioInfo.nome !== 'Shifts Store' ? studioInfo.nome : 'La musica fa...';
  const studioAddress =
    studioInfo?.indirizzo && studioInfo.indirizzo !== 'Via della Musica 42'
      ? studioInfo.indirizzo
      : 'Via Secchia 36 (ingresso da Via Quieto) • Latina';

  const drawEditorialHeader = (pageNumber: number): number => {
    let y = 8;

    // ── 1. LOGO "LA MUSICA FA..." INTERO E PERFETTAMENTE LEGGIBILE IN ALTO ──
    if (logoAssets?.headerBannerDataUrl) {
      try {
        const logoH = pageNumber === 1 ? 34 : 24;
        const logoW = logoH * (logoAssets.aspectRatio || 1);
        const logoX = (pageWidth - logoW) / 2;
        doc.addImage(logoAssets.headerBannerDataUrl, 'PNG', logoX, y, logoW, logoH);
        y += logoH + 1.5;
      } catch {
        y += 6;
      }
    } else {
      doc.setFont('times', 'bolditalic');
      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.text(studioName, pageWidth / 2, y + 8, { align: 'center' });
      y += 12;
    }

    // Indirizzo sala prove discreto sotto il logo
    doc.setFont('times', 'italic');
    doc.setFontSize(8.2);
    doc.setTextColor(100, 116, 139);
    doc.text(studioAddress, pageWidth / 2, y, { align: 'center' });

    y += 5.5;

    // ── 2. TITOLO BRANO / ESERCIZIO IN FONT SERIF EDITORIALE ──
    const displayTitle = isBlank
      ? sheet.title.trim() || 'TITOLO BRANO / STUDIO: ______________________________________'
      : sheet.title.trim() || 'Studio & Esercizio Musicale';

    doc.setFont('times', 'bold');
    doc.setFontSize(isBlank && !sheet.title.trim() ? 13 : 18.5);
    doc.setTextColor(15, 23, 42);
    doc.text(displayTitle, pageWidth / 2, y + 4, { align: 'center' });

    y += 8.5;

    doc.setFont('times', 'bolditalic');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(INSTRUMENT_SUBTITLES[sheet.instrument], pageWidth / 2, y, { align: 'center' });

    y += 4.5;

    // ── 3. DOPPIO FILETTO EDITORIALE CON ALLIEVO E DOCENTE ──
    doc.setFont('times', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(30, 41, 59);

    const leftCredit = isBlank
      ? `Allievo / Artista: ${sheet.artistOrStudent.trim() || '___________________________'}`
      : sheet.artistOrStudent.trim()
      ? `Allievo / Artista: ${sheet.artistOrStudent.trim()}`
      : `Data: ${new Date().toLocaleDateString('it-IT')}`;

    const rightCredit = isBlank
      ? `Docente: ${sheet.teacherName.trim() || '___________________________'}`
      : sheet.teacherName.trim()
      ? `Docente: ${sheet.teacherName.trim()}`
      : `Pag. ${pageNumber}`;

    doc.text(leftCredit, marginX, y);
    doc.text(rightCredit, pageWidth - marginX, y, { align: 'right' });

    y += 2.0;

    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.6);
    doc.line(marginX, y, pageWidth - marginX, y);
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.22);
    doc.line(marginX, y + 1.0, pageWidth - marginX, y + 1.0);

    y += 5.2;

    // ── 4. TEMPO, METRONOMO E ACCORDATURA ──
    doc.setFont('times', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(15, 23, 42);

    const tempoMarking = `Tempo: ${sheet.timeSignature}   •   BPM: ${
      isBlank ? '____' : sheet.bpm
    }`;
    doc.text(tempoMarking, marginX, y);

    doc.setFont('times', 'italic');
    doc.setFontSize(9.2);
    doc.setTextColor(51, 65, 85);
    const tuningInfo =
      sheet.instrument === 'drums'
        ? 'Notazione Standard Pentagramma Batteria'
        : `Accordatura: ${sheet.tuningLabel}${
            sheet.capo > 0 ? `  •  Capotasto: ${sheet.capo}° Tasto` : ''
          }`;
    doc.text(tuningInfo, pageWidth - marginX, y, { align: 'right' });

    return y + 7.5;
  };

  let currentPage = 1;
  let cursorY = drawEditorialHeader(currentPage);

  // ============================================================================
  // MODALITÀ 1: PARTITURA DI BATTERIA SU PENTAGRAMMA A 5 LINEE (COME IN FOTO 2)
  // ============================================================================
  if (sheet.instrument === 'drums') {
    const staffSpace = 2.75; // distanza tra le 5 linee del pentagramma (mm)
    const staffHeight = 4 * staffSpace; // 5 linee = 4 spazi (11 mm)
    const systemRowGap = 16.5; // spazio verticale tra un sistema e il successivo (per travi e box [Verse 1])
    const measuresPerRow = 3; // 3 battute per riga su A4 per proporzioni identiche a Foto 2!

    const measuresToRender: TabMeasure[] = isBlank
      ? Array.from({ length: 12 }, (_, idx) => ({
          id: `blank-${idx}`,
          stepsCount: 16,
          chords: {},
          cells: {},
        }))
      : sheet.measures;

    const totalRows = Math.ceil(measuresToRender.length / measuresPerRow);

    for (let rowIdx = 0; rowIdx < totalRows; rowIdx++) {
      const rowMeasures = measuresToRender.slice(
        rowIdx * measuresPerRow,
        rowIdx * measuresPerRow + measuresPerRow
      );

      const neededHeight = staffHeight + systemRowGap + 12;
      if (cursorY + neededHeight > pageHeight - 24) {
        drawEditorialFooter(doc, pageWidth, pageHeight, marginX, sheet.instrument, currentPage);
        doc.addPage();
        currentPage++;
        cursorY = drawEditorialHeader(currentPage);
      }

      const staffTopY = cursorY + 11.5; // Spazio sopra il rigo per le travi (beams) e i box sezione [Verse 1]
      const clefWidth = 7.5;
      const staffStartX = marginX;
      const staffTotalWidth = contentWidth;

      // Disegna le 5 linee orizzontali continue del pentagramma
      doc.setDrawColor(51, 65, 85);
      doc.setLineWidth(0.28);
      for (let l = 0; l < 5; l++) {
        const ly = staffTopY + l * staffSpace;
        doc.line(staffStartX, ly, staffStartX + staffTotalWidth, ly);
      }

      // Stanghetta iniziale + Chiave di Percussione neutra (due barre verticali parallele || tra 2ª e 4ª linea)
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.55);
      doc.line(staffStartX, staffTopY, staffStartX, staffTopY + staffHeight);

      // Simbolo chiave batteria ||
      doc.setLineWidth(0.75);
      doc.line(staffStartX + 2.6, staffTopY + staffSpace, staffStartX + 2.6, staffTopY + 3 * staffSpace);
      doc.line(staffStartX + 4.1, staffTopY + staffSpace, staffStartX + 4.1, staffTopY + 3 * staffSpace);

      const measuresAreaStartX = staffStartX + clefWidth;
      const measuresAreaWidth = staffTotalWidth - clefWidth;
      const singleMeasureWidth = measuresAreaWidth / rowMeasures.length;

      rowMeasures.forEach((measure, mInRowIdx) => {
        const globalMeasureIdx = rowIdx * measuresPerRow + mInRowIdx;
        const mStartX = measuresAreaStartX + mInRowIdx * singleMeasureWidth;
        const mEndX = mStartX + singleMeasureWidth;
        const isLastMeasureOverall = globalMeasureIdx === measuresToRender.length - 1;

        // Doppia stanghetta all'inizio di una nuova sezione (es. [Verse 1] in Foto 2!)
        if (measure.sectionLabel && mInRowIdx > 0) {
          doc.setDrawColor(15, 23, 42);
          doc.setLineWidth(0.35);
          doc.line(mStartX - 1.1, staffTopY, mStartX - 1.1, staffTopY + staffHeight);
          doc.setLineWidth(0.5);
          doc.line(mStartX, staffTopY, mStartX, staffTopY + staffHeight);
        }

        // Stanghetta di fine battuta
        doc.setDrawColor(15, 23, 42);
        if (isLastMeasureOverall && !measure.repeatEnd) {
          doc.setLineWidth(0.32);
          doc.line(mEndX - 1.2, staffTopY, mEndX - 1.2, staffTopY + staffHeight);
          doc.setLineWidth(0.95);
          doc.line(mEndX, staffTopY, mEndX, staffTopY + staffHeight);
        } else {
          doc.setLineWidth(measure.repeatEnd ? 0.9 : 0.42);
          doc.line(mEndX, staffTopY, mEndX, staffTopY + staffHeight);
        }

        // Ritornelli ||: e :||
        if (!isBlank && measure.repeatStart) {
          doc.setLineWidth(0.85);
          doc.line(mStartX + 1.0, staffTopY, mStartX + 1.0, staffTopY + staffHeight);
          doc.setFillColor(15, 23, 42);
          doc.circle(mStartX + 2.6, staffTopY + staffSpace * 1.5, 0.5, 'F');
          doc.circle(mStartX + 2.6, staffTopY + staffSpace * 2.5, 0.5, 'F');
        }
        if (!isBlank && measure.repeatEnd) {
          doc.setLineWidth(0.3);
          doc.line(mEndX - 1.8, staffTopY, mEndX - 1.8, staffTopY + staffHeight);
          doc.setFillColor(15, 23, 42);
          doc.circle(mEndX - 3.2, staffTopY + staffSpace * 1.5, 0.5, 'F');
          doc.circle(mEndX - 3.2, staffTopY + staffSpace * 2.5, 0.5, 'F');
        }

        // Box Sezione sopra la trave esattamente come "[ Verse 1 ]" in Foto 2
        if (!isBlank && measure.sectionLabel) {
          const secText = measure.sectionLabel;
          doc.setFont('times', 'normal');
          doc.setFontSize(8.5);
          const boxW = doc.getTextWidth(secText) + 3.6;
          const boxX = mStartX + 1.5;
          const boxY = staffTopY - 12.2;

          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(71, 85, 105);
          doc.setLineWidth(0.3);
          doc.rect(boxX, boxY, boxW, 4.6, 'FD');

          doc.setTextColor(15, 23, 42);
          doc.text(secText, boxX + boxW / 2, boxY + 3.3, { align: 'center' });
        }

        if (isBlank) return;

        const steps = measure.stepsCount || 16;
        const innerPadX = 4.2;
        const usableW = singleMeasureWidth - innerPadX * 2;
        const stepW = usableW / steps;

        // Raccogli tutti gli step che hanno almeno un colpo di batteria in questa battuta
        const stepHitsMap = new Map<
          number,
          {
            centerX: number;
            stemX: number;
            maxY: number;
            minY: number;
            hits: { lineCode: string; val: string; y: number; isCross: boolean; hasLedger?: boolean }[];
          }
        >();

        for (let sIdx = 0; sIdx < steps; sIdx++) {
          const centerX = mStartX + innerPadX + sIdx * stepW + stepW / 2;
          const hits: {
            lineCode: string;
            val: string;
            y: number;
            isCross: boolean;
            hasLedger?: boolean;
          }[] = [];

          for (let lIdx = 0; lIdx < sheet.lines.length; lIdx++) {
            const val = (measure.cells?.[`${lIdx}_${sIdx}`] || '').trim();
            if (!val) continue;
            const lineCode = sheet.lines[lIdx];
            const pos = getDrumStaffNotePosition(lineCode, staffTopY, staffSpace);
            hits.push({ lineCode, val, ...pos });
          }

          if (hits.length > 0) {
            const maxY = Math.max(...hits.map((h) => h.y));
            const minY = Math.min(...hits.map((h) => h.y));
            // La gambetta (stem) sale dal lato destro delle teste di nota (cx + 1.05mm)
            const stemX = centerX + 1.05;
            stepHitsMap.set(sIdx, { centerX, stemX, maxY, minY, hits });

            // Disegna tutte le teste di nota (ovale pieno per Kick/Snare/Tom, × per Hi-Hat/Crash/Ride)
            hits.forEach((h) => {
              if (h.isCross) {
                drawCrossNotehead(doc, centerX, h.y, 1.02, h.val === 'O', Boolean(h.hasLedger));
              } else {
                drawFilledNotehead(doc, centerX, h.y, 1.25, 0.88, h.val === 'g');
                // Se è un Flam ('f'), disegna la piccola acciaccatura (grace note) a sinistra
                if (h.val === 'f') {
                  drawFilledNotehead(doc, centerX - 2.3, h.y + 0.3, 0.72, 0.52, false);
                  doc.setLineWidth(0.25);
                  doc.line(centerX - 1.65, h.y + 0.3, centerX - 1.65, h.y - 2.8);
                }
              }
            });
          }
        }

        // Calcola i gruppi di travi (Beams) come in Foto 2 e disegna Gambette + Travi Orizzontali!
        const activeSteps = Array.from(stepHitsMap.keys()).sort((a, b) => a - b);
        const beamGroups = computeDrumBeamGroups(activeSteps, steps);
        const beamY = staffTopY - 5.8; // Altezza della trave orizzontale sopra gli × del Charleston

        doc.setDrawColor(15, 23, 42);
        doc.setFillColor(15, 23, 42);

        beamGroups.forEach((group) => {
          // 1. Disegna la gambetta verticale (stem) per ogni step del gruppo fino a beamY
          group.forEach((sIdx) => {
            const info = stepHitsMap.get(sIdx);
            if (!info) return;
            doc.setLineWidth(0.32);
            doc.line(info.stemX, info.maxY, info.stemX, beamY);

            // Se è un Drag / Rullo doppio ('d'), aggiungi il taglietto obliquo (tremolo slash) sulla gambetta
            const hasDrag = info.hits.some((h) => h.val === 'd');
            if (hasDrag) {
              doc.setLineWidth(0.5);
              doc.line(info.stemX - 1.1, beamY + 3.2, info.stemX + 1.1, beamY + 2.1);
            }
          });

          // 2. Se il gruppo ha 2 o più note, uniscile con la Trave Orizzontale Nera Spessa (Primary Beam, Foto 2!)
          if (group.length >= 2) {
            const firstInfo = stepHitsMap.get(group[0])!;
            const lastInfo = stepHitsMap.get(group[group.length - 1])!;
            const beamThickness = 1.15;

            doc.rect(
              firstInfo.stemX - 0.15,
              beamY,
              lastInfo.stemX - firstInfo.stemX + 0.3,
              beamThickness,
              'F'
            );

            // 3. Se dentro il gruppo ci sono sedicesimi (step dispari o distanza = 1 step in 16esimi),
            // disegna la seconda trave dei sedicesimi (Secondary 16th Beam) sotto la prima!
            if (steps === 16) {
              for (let i = 0; i < group.length; i++) {
                const curStep = group[i];
                const nextStep = group[i + 1];
                const prevStep = group[i - 1];
                const curInfo = stepHitsMap.get(curStep)!;

                const isCloseToNext = nextStep !== undefined && nextStep - curStep === 1;
                const isCloseToPrev = prevStep !== undefined && curStep - prevStep === 1;

                if (isCloseToNext) {
                  const nextInfo = stepHitsMap.get(nextStep)!;
                  doc.rect(
                    curInfo.stemX - 0.1,
                    beamY + 1.75,
                    nextInfo.stemX - curInfo.stemX + 0.2,
                    0.95,
                    'F'
                  );
                } else if (curStep % 2 === 1 && !isCloseToPrev) {
                  // Mezza trave (stub) per sedicesimo singolo
                  doc.rect(curInfo.stemX - 2.4, beamY + 1.75, 2.5, 0.95, 'F');
                }
              }
            }
          }
        });
      });

      cursorY = staffTopY + staffHeight + systemRowGap;
    }
  } else {
    // ============================================================================
    // MODALITÀ 2: TABLATURA CHITARRA E BASSO (6, 4 O 5 CORDE)
    // ============================================================================
    const lines = sheet.lines;
    const numLines = lines.length;
    const lineSpacing = 4.0;
    const staffHeight = (numLines - 1) * lineSpacing;
    const systemRowGap = 14.5;
    const measuresPerRow = 2;

    const measuresToRender: TabMeasure[] = isBlank
      ? Array.from({ length: 10 }, (_, idx) => ({
          id: `blank-${idx}`,
          stepsCount: 16,
          chords: {},
          cells: {},
        }))
      : sheet.measures;

    const totalRows = Math.ceil(measuresToRender.length / measuresPerRow);

    for (let rowIdx = 0; rowIdx < totalRows; rowIdx++) {
      const rowMeasures = measuresToRender.slice(
        rowIdx * measuresPerRow,
        rowIdx * measuresPerRow + measuresPerRow
      );

      const neededHeight = staffHeight + systemRowGap + 10;
      if (cursorY + neededHeight > pageHeight - 24) {
        drawEditorialFooter(doc, pageWidth, pageHeight, marginX, sheet.instrument, currentPage);
        doc.addPage();
        currentPage++;
        cursorY = drawEditorialHeader(currentPage);
      }

      const staffTopY = cursorY + 7.5;
      const clefWidth = 12;
      const staffStartX = marginX + clefWidth;
      const staffTotalWidth = contentWidth - clefWidth;
      const singleMeasureWidth = staffTotalWidth / rowMeasures.length;

      // Bracket di apertura rigo + scritta verticale "T A B"
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(1.1);
      doc.line(marginX, staffTopY - 0.5, marginX, staffTopY + staffHeight + 0.5);
      doc.setLineWidth(0.5);
      doc.line(marginX, staffTopY - 0.5, marginX + 2.2, staffTopY - 1.3);
      doc.line(marginX, staffTopY + staffHeight + 0.5, marginX + 2.2, staffTopY + staffHeight + 1.3);

      const tabLetters = ['T', 'A', 'B'];
      const topOffset = staffHeight * 0.22;
      const bottomOffset = staffHeight * 0.84;
      const stepY = (bottomOffset - topOffset) / 2;
      doc.setFont('times', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      tabLetters.forEach((letter, idx) => {
        doc.text(letter, marginX + 3.2, staffTopY + topOffset + idx * stepY + 1, {
          align: 'center',
        });
      });

      for (let lIdx = 0; lIdx < numLines; lIdx++) {
        const lineY = staffTopY + lIdx * lineSpacing;
        doc.setFont('times', 'bolditalic');
        doc.setFontSize(8.8);
        doc.setTextColor(51, 65, 85);
        doc.text(lines[lIdx], marginX + 8.5, lineY + 0.95, { align: 'center' });

        doc.setDrawColor(100, 116, 139);
        doc.setLineWidth(0.28);
        doc.line(staffStartX, lineY, staffStartX + staffTotalWidth, lineY);
      }

      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.65);
      doc.line(staffStartX, staffTopY, staffStartX, staffTopY + staffHeight);

      rowMeasures.forEach((measure, mInRowIdx) => {
        const globalMeasureIdx = rowIdx * measuresPerRow + mInRowIdx;
        const mStartX = staffStartX + mInRowIdx * singleMeasureWidth;
        const mEndX = mStartX + singleMeasureWidth;
        const isLastMeasureOverall = globalMeasureIdx === measuresToRender.length - 1;

        doc.setDrawColor(15, 23, 42);
        if (isLastMeasureOverall && !measure.repeatEnd) {
          doc.setLineWidth(0.3);
          doc.line(mEndX - 1.3, staffTopY, mEndX - 1.3, staffTopY + staffHeight);
          doc.setLineWidth(1.0);
          doc.line(mEndX, staffTopY, mEndX, staffTopY + staffHeight);
        } else {
          doc.setLineWidth(measure.repeatEnd ? 1.0 : 0.5);
          doc.line(mEndX, staffTopY, mEndX, staffTopY + staffHeight);
        }

        if (!isBlank && measure.repeatStart) {
          doc.setLineWidth(0.95);
          doc.line(mStartX + 1.0, staffTopY, mStartX + 1.0, staffTopY + staffHeight);
          doc.setLineWidth(0.3);
          doc.line(mStartX + 2.3, staffTopY, mStartX + 2.3, staffTopY + staffHeight);
          doc.setFillColor(15, 23, 42);
          doc.circle(mStartX + 3.8, staffTopY + staffHeight * 0.35, 0.6, 'F');
          doc.circle(mStartX + 3.8, staffTopY + staffHeight * 0.65, 0.6, 'F');
        }
        if (!isBlank && measure.repeatEnd) {
          doc.setLineWidth(0.3);
          doc.line(mEndX - 2.3, staffTopY, mEndX - 2.3, staffTopY + staffHeight);
          doc.setFillColor(15, 23, 42);
          doc.circle(mEndX - 3.8, staffTopY + staffHeight * 0.35, 0.6, 'F');
          doc.circle(mEndX - 3.8, staffTopY + staffHeight * 0.65, 0.6, 'F');
          if (measure.repeatCount && measure.repeatCount > 1) {
            doc.setFont('times', 'bolditalic');
            doc.setFontSize(8.5);
            doc.setTextColor(15, 23, 42);
            doc.text(`x${measure.repeatCount}`, mEndX - 1.5, staffTopY - 2.2, { align: 'right' });
          }
        }

        doc.setFont('times', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`${globalMeasureIdx + 1}`, mStartX + 1.2, staffTopY - 2.2);

        if (!isBlank && measure.sectionLabel) {
          const labelText = measure.sectionLabel;
          doc.setFont('times', 'bold');
          doc.setFontSize(8);
          const boxW = doc.getTextWidth(labelText) + 4.0;
          const boxX = mStartX + 6.0;
          const boxY = staffTopY - 6.2;

          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(15, 23, 42);
          doc.setLineWidth(0.4);
          doc.rect(boxX, boxY, boxW, 4.5, 'FD');

          doc.setTextColor(15, 23, 42);
          doc.text(labelText, boxX + boxW / 2, boxY + 3.25, { align: 'center' });
        }

        const steps = measure.stepsCount || 16;
        const innerPadX = 5.0;
        const usableW = singleMeasureWidth - innerPadX * 2;
        const stepW = usableW / steps;

        for (let sIdx = 0; sIdx < steps; sIdx++) {
          const stepCenterX = mStartX + innerPadX + sIdx * stepW + stepW / 2;

          if (sIdx > 0 && sIdx % 4 === 0) {
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.2);
            doc.line(stepCenterX, staffTopY + 0.5, stepCenterX, staffTopY + staffHeight - 0.5);
          }

          const chordName = !isBlank ? measure.chords?.[sIdx] : '';
          if (chordName) {
            doc.setFont('times', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42);
            doc.text(chordName, stepCenterX, staffTopY - 2.3, { align: 'center' });
          }

          if (!isBlank) {
            for (let lIdx = 0; lIdx < numLines; lIdx++) {
              const val = (measure.cells?.[`${lIdx}_${sIdx}`] || '').trim();
              if (!val) continue;

              const lineY = staffTopY + lIdx * lineSpacing;
              doc.setFont('times', 'bold');
              const fontSize = val.length > 2 ? 8.5 : 10.2;
              doc.setFontSize(fontSize);
              const textW = Math.max(3.4, doc.getTextWidth(val) + 1.6);

              doc.setFillColor(255, 255, 255);
              doc.rect(stepCenterX - textW / 2, lineY - 1.7, textW, 3.4, 'F');

              doc.setTextColor(15, 23, 42);
              doc.text(val, stepCenterX, lineY + 1.15, { align: 'center' });
            }
          }
        }
      });

      cursorY = staffTopY + staffHeight + systemRowGap;
    }
  }

  // ── BOX NOTE DIDATTICHE IN STILE CLASSICO CON DOPPIO FILETTO ──
  if ((sheet.notes && sheet.notes.trim()) || isBlank) {
    if (cursorY + 26 > pageHeight - 22) {
      drawEditorialFooter(doc, pageWidth, pageHeight, marginX, sheet.instrument, currentPage);
      doc.addPage();
      currentPage++;
      cursorY = drawEditorialHeader(currentPage);
    }

    cursorY += 2;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.5);
    doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
    doc.setLineWidth(0.2);
    doc.line(marginX, cursorY + 0.9, pageWidth - marginX, cursorY + 0.9);

    doc.setFont('times', 'bolditalic');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Note Didattiche, Dinamica & Indicazioni d’Esecuzione:', marginX, cursorY + 5.5);

    doc.setFont('times', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    const notesText = isBlank ? sheet.notes.trim() || '' : sheet.notes.trim();
    if (notesText) {
      const splitNotes = doc.splitTextToSize(notesText, contentWidth);
      doc.text(splitNotes.slice(0, 4), marginX, cursorY + 11);
    } else if (isBlank) {
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.25);
      doc.line(marginX, cursorY + 12, pageWidth - marginX, cursorY + 12);
      doc.line(marginX, cursorY + 19, pageWidth - marginX, cursorY + 19);
    }
  }

  drawEditorialFooter(doc, pageWidth, pageHeight, marginX, sheet.instrument, currentPage);

  const safeTitle = (sheet.title || 'Partitura_Tab')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');
  const suffix = isBlank ? '_Foglio_Studio' : '';
  doc.save(`${safeTitle}_${sheet.instrument.toUpperCase()}${suffix}.pdf`);
}

function drawEditorialFooter(
  _doc: jsPDF,
  _pageWidth: number,
  _pageHeight: number,
  _marginX: number,
  _instrument: TabInstrumentType,
  _pageNumber: number
) {
  // Nessuna scritta a piè di pagina nella stampa PDF per mantenere il foglio spartito pulito
}
