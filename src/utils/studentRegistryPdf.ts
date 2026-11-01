import { jsPDF } from 'jspdf';
import { Booking, Client, StudioInfo } from '../types';
import { formatDateItalian, formatCurrency } from './dateUtils';

export interface StudentRegistryExportItem {
  student: Client;
  corsoDidattico: string;
  teacherName: string;
  completedOre: number;
  completedLessons: Booking[];
  isPaid: boolean;
  dataPagamento?: string;
  oraPagamento?: string;
  dataOraRegistrazione?: string;
  importo: number;
}

export interface GenerateStudentRegistryPdfOptions {
  monthName: string;
  currentYear: number;
  studioInfo: StudioInfo;
  selectedTeacherName: string;
  items: StudentRegistryExportItem[];
  totalStudents: number;
  totalCompletedHours: number;
  totalCompletedLessons: number;
  totalCollected: number;
  totalPending: number;
}

export function generateStudentRegistryPdf({
  monthName,
  currentYear,
  studioInfo,
  selectedTeacherName,
  items,
  totalStudents,
  totalCompletedHours,
  totalCompletedLessons,
  totalCollected,
  totalPending,
}: GenerateStudentRegistryPdfOptions): void {
  // Impostazione foglio: A4 Orizzontale (Landscape) per massima leggibilità
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const marginX = 10;
  const contentWidth = pageWidth - marginX * 2; // 277mm

  // Palette colori istituzionale
  const colorDark = [15, 23, 42]; // slate-900
  const colorGray = [100, 116, 139]; // slate-500
  const colorLightBg = [248, 250, 252]; // slate-50
  const colorBorder = [203, 213, 225]; // slate-300
  const colorGreen = [16, 185, 129]; // emerald-500
  const colorAmber = [217, 119, 6]; // amber-600

  // Definizione larghezze colonne (Totale = 277mm)
  const colWidths = {
    idx: 8,
    allievo: 42,
    corso: 36,
    docente: 32,
    lezioni: 75,
    ore: 16,
    stato: 26,
    dataSaldo: 26,
    quota: 16,
  };

  const colPositions = {
    idx: marginX,
    allievo: marginX + colWidths.idx,
    corso: marginX + colWidths.idx + colWidths.allievo,
    docente: marginX + colWidths.idx + colWidths.allievo + colWidths.corso,
    lezioni: marginX + colWidths.idx + colWidths.allievo + colWidths.corso + colWidths.docente,
    ore: marginX + colWidths.idx + colWidths.allievo + colWidths.corso + colWidths.docente + colWidths.lezioni,
    stato: marginX + colWidths.idx + colWidths.allievo + colWidths.corso + colWidths.docente + colWidths.lezioni + colWidths.ore,
    dataSaldo: marginX + colWidths.idx + colWidths.allievo + colWidths.corso + colWidths.docente + colWidths.lezioni + colWidths.ore + colWidths.stato,
    quota: marginX + colWidths.idx + colWidths.allievo + colWidths.corso + colWidths.docente + colWidths.lezioni + colWidths.ore + colWidths.stato + colWidths.dataSaldo,
  };

  let currentPage = 1;

  // Funzione per disegnare l'header della tabella (ripetuto su ogni pagina)
  const drawTableHeader = (y: number) => {
    doc.setFillColor(colorDark[0], colorDark[1], colorDark[2]);
    doc.rect(marginX, y, contentWidth, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);

    doc.text('#', colPositions.idx + 2, y + 5);
    doc.text('ALLIEVO', colPositions.allievo + 2, y + 5);
    doc.text('CORSO / STRUMENTO', colPositions.corso + 2, y + 5);
    doc.text('DOCENTE', colPositions.docente + 2, y + 5);
    doc.text(`LEZIONI SVOLTE (${monthName.toUpperCase()})`, colPositions.lezioni + 2, y + 5);
    doc.text('ORE', colPositions.ore + 2, y + 5);
    doc.text('STATO QUOTA', colPositions.stato + 2, y + 5);
    doc.text('DATA SALDO', colPositions.dataSaldo + 2, y + 5);
    doc.text('QUOTA', colPositions.quota + 2, y + 5);

    return y + 7;
  };

  // Funzione per disegnare l'intestazione documento (solo pagina 1)
  const drawPageHeader = () => {
    // Fascia superiore
    doc.setFillColor(colorLightBg[0], colorLightBg[1], colorLightBg[2]);
    doc.roundedRect(marginX, 8, contentWidth, 22, 2, 2, 'F');
    doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
    doc.roundedRect(marginX, 8, contentWidth, 22, 2, 2, 'D');

    // Titolo e info studio
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
    doc.text(`${studioInfo.nome || 'LA MUSICA FA...'} • REGISTRO ALLIEVI & LEZIONI`, marginX + 5, 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
    doc.text(
      `Prospetto Ufficiale Presenze Svolte e Quote • Mese: ${monthName} ${currentYear} • Filtro Docente: ${selectedTeacherName}`,
      marginX + 5,
      23
    );

    // Box KPI riepilogativi a destra dell'header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
    const kpiText = `Allievi: ${totalStudents}  |  Ore Svolte: ${totalCompletedHours}h (${totalCompletedLessons} lez.)  |  Incassato: ${formatCurrency(totalCollected)}  |  Da Saldare: ${formatCurrency(totalPending)}`;
    doc.text(kpiText, pageWidth - marginX - doc.getTextWidth(kpiText) - 5, 20);
  };

  // Inizia Pagina 1
  drawPageHeader();
  let currentY = drawTableHeader(33);

  // Stampa righe allievi
  items.forEach((item, idx) => {
    // Formattazione stringa presenze
    const lessonDates = item.completedLessons.map((l) => {
      const parts = (l.data || '').split('-');
      const d = parts[2] ? `${parts[2]}/${parts[1]}` : l.data;
      return `${d} (${l.oraInizio})`;
    });
    const lessonsText = lessonDates.length > 0 ? lessonDates.join(', ') : 'Nessuna lezione svolta finora';

    // Suddivisione testo su più righe se troppo lungo
    const splitLessons = doc.splitTextToSize(lessonsText, colWidths.lezioni - 4);
    const rowHeight = Math.max(7, splitLessons.length * 3.5 + 3.5);

    // Se sfora la pagina, crea nuova pagina e ridisegna intestazione tabella
    if (currentY + rowHeight > pageHeight - 14) {
      // Disegna footer pagina corrente
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
      doc.text(
        `Pagina ${currentPage} • ${studioInfo.nome || 'La musica fa...'} • Generato il ${formatDateItalian(new Date().toISOString().split('T')[0])}`,
        marginX,
        pageHeight - 6
      );

      doc.addPage();
      currentPage++;
      currentY = drawTableHeader(10);
    }

    // Sfondo alternato righe
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, currentY, contentWidth, rowHeight, 'F');
    }

    // Bordo orizzontale
    doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
    doc.line(marginX, currentY + rowHeight, marginX + contentWidth, currentY + rowHeight);

    // Testi riga
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);

    // # Progressivo
    doc.text(String(idx + 1), colPositions.idx + 2, currentY + 5);

    // Allievo
    doc.setFont('helvetica', 'bold');
    const studentName = `${item.student.nome} ${item.student.cognome}`.trim();
    doc.text(doc.splitTextToSize(studentName, colWidths.allievo - 4)[0] || studentName, colPositions.allievo + 2, currentY + 5);
    doc.setFont('helvetica', 'normal');

    // Corso
    doc.text(doc.splitTextToSize(item.corsoDidattico, colWidths.corso - 4)[0] || item.corsoDidattico, colPositions.corso + 2, currentY + 5);

    // Docente
    doc.text(doc.splitTextToSize(item.teacherName, colWidths.docente - 4)[0] || item.teacherName, colPositions.docente + 2, currentY + 5);

    // Lezioni svolte
    doc.text(splitLessons, colPositions.lezioni + 2, currentY + 4.5);

    // Ore
    doc.text(`${item.completedOre}h`, colPositions.ore + 2, currentY + 5);

    // Stato Saldo (Badge colorato)
    if (item.isPaid) {
      doc.setTextColor(colorGreen[0], colorGreen[1], colorGreen[2]);
      doc.setFont('helvetica', 'bold');
      doc.text('SALDATO ✓', colPositions.stato + 2, currentY + 5);
    } else {
      doc.setTextColor(colorAmber[0], colorAmber[1], colorAmber[2]);
      doc.setFont('helvetica', 'bold');
      doc.text('DA SALDARE ⚠️', colPositions.stato + 2, currentY + 5);
    }
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);

    // Data / Ora Saldo
    let saldoStr = 'Da saldare';
    if (item.isPaid) {
      if (item.dataPagamento) {
        const parts = item.dataPagamento.split('-');
        const dateFormatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : item.dataPagamento;
        saldoStr = item.oraPagamento ? `${dateFormatted} ${item.oraPagamento}` : dateFormatted;
      } else {
        saldoStr = 'Saldato';
      }
    }
    doc.text(saldoStr, colPositions.dataSaldo + 2, currentY + 5);

    // Quota
    doc.setFont('helvetica', 'bold');
    doc.text(`${item.importo.toFixed(2)} €`, colPositions.quota + 2, currentY + 5);
    doc.setFont('helvetica', 'normal');

    currentY += rowHeight;
  });

  // Riga Totali Finale
  if (currentY + 10 > pageHeight - 14) {
    doc.addPage();
    currentPage++;
    currentY = drawTableHeader(10);
  }

  doc.setFillColor(241, 245, 249);
  doc.rect(marginX, currentY, contentWidth, 8, 'F');
  doc.setDrawColor(colorDark[0], colorDark[1], colorDark[2]);
  doc.setLineWidth(0.3);
  doc.line(marginX, currentY, marginX + contentWidth, currentY);
  doc.line(marginX, currentY + 8, marginX + contentWidth, currentY + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
  doc.text('TOTALI MESE', colPositions.allievo + 2, currentY + 5.5);
  doc.text(`${totalCompletedHours}h`, colPositions.ore + 2, currentY + 5.5);
  doc.text(`Incassati: ${formatCurrency(totalCollected)}`, colPositions.stato + 2, currentY + 5.5);
  doc.text(`${(totalCollected + totalPending).toFixed(2)} €`, colPositions.quota + 2, currentY + 5.5);

  // Footer ultima pagina
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
  doc.text(
    `Pagina ${currentPage} • ${studioInfo.nome || 'La musica fa...'} • Generato il ${formatDateItalian(new Date().toISOString().split('T')[0])}`,
    marginX,
    pageHeight - 6
  );

  // Scarica direttamente il file PDF
  const cleanTeacher = selectedTeacherName.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Registro_Allievi_${monthName}_${currentYear}_${cleanTeacher}.pdf`;
  doc.save(filename);
}
