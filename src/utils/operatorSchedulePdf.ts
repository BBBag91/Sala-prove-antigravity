import { jsPDF } from 'jspdf';
import { Booking, StaffMember, StudioInfo } from '../types';
import { formatDateItalian, parseISODate, calculateDurationHours } from './dateUtils';

export interface OperatorAppointmentItem {
  booking: Booking;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm - HH:mm
  duration: number; // hours
  roomName: string;
  clientName: string;
  activityType: 'Presidio Sala' | 'Lezione Musica';
  notes?: string;
  equipment?: string;
  hourlyRate?: number;
  totalCompensation?: number;
}

export interface OperatorScheduleReportData {
  operator: StaffMember;
  periodLabel: string;
  appointments: OperatorAppointmentItem[];
  totalHours: number;
  totalAppointments: number;
  totalWorkingDays: number;
  totalCompensation: number;
}

/**
 * Filter and extract all appointments for a specific operator within a date range and filters.
 */
export function getOperatorAppointmentsData(
  operator: StaffMember,
  allBookings: Booking[],
  periodLabel: string,
  startDate?: string,
  endDate?: string,
  filterType: 'all' | 'prove' | 'lezione' = 'all'
): OperatorScheduleReportData {
  // Sort bookings chronologically by date and start time
  const sorted = [...allBookings].sort((a, b) => {
    const cmpDate = a.data.localeCompare(b.data);
    if (cmpDate !== 0) return cmpDate;
    return a.oraInizio.localeCompare(b.oraInizio);
  });

  const matching: OperatorAppointmentItem[] = [];
  const uniqueDates = new Set<string>();

  for (const b of sorted) {
    // Check date range
    if (startDate && b.data < startDate) continue;
    if (endDate && b.data > endDate) continue;

    // Check type filter
    if (filterType === 'prove' && b.tipo !== 'prove') continue;
    if (filterType === 'lezione' && b.tipo !== 'lezione') continue;

    // Check if operator is assigned as room operator OR as teacher
    const isAssignedOperator = b.operatoreAssegnatoId === operator.id;
    const isTeacher = b.insegnanteId === operator.id;

    if (!isAssignedOperator && !isTeacher) continue;

    const duration = b.durataOre || calculateDurationHours(b.oraInizio, b.oraFine);
    const hourlyRate = operator.tariffaOrariaRimborso || 0;
    const totalComp = hourlyRate > 0 ? duration * hourlyRate : 0;

    let activityType: 'Presidio Sala' | 'Lezione Musica' = 'Presidio Sala';
    if (isTeacher) {
      activityType = 'Lezione Musica';
    } else if (b.tipo === 'lezione') {
      activityType = 'Lezione Musica';
    }

    matching.push({
      booking: b,
      date: b.data,
      time: `${b.oraInizio} - ${b.oraFine}`,
      duration,
      roomName: b.salaNome || 'Sala Prove',
      clientName: b.clienteNome || 'Cliente',
      activityType,
      notes: b.note,
      equipment: b.richiesteStrumentazione,
      hourlyRate,
      totalCompensation: totalComp,
    });

    uniqueDates.add(b.data);
  }

  const totalHours = matching.reduce((sum, item) => sum + item.duration, 0);
  const totalComp = matching.reduce((sum, item) => sum + (item.totalCompensation || 0), 0);

  return {
    operator,
    periodLabel,
    appointments: matching,
    totalHours: Number(totalHours.toFixed(1)),
    totalAppointments: matching.length,
    totalWorkingDays: uniqueDates.size,
    totalCompensation: Number(totalComp.toFixed(2)),
  };
}

/**
 * Generate PDF for a Single Operator's Schedule
 */
export function generateSingleOperatorSchedulePDF(
  report: OperatorScheduleReportData,
  studioInfo?: StudioInfo
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  renderOperatorScheduleToDoc(doc, report, studioInfo, true);

  const cleanName = `${report.operator.nome}_${report.operator.cognome}`.replace(/\s+/g, '_');
  const cleanPeriod = report.periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Appuntamenti_${cleanName}_${cleanPeriod}.pdf`);
}

/**
 * Generate PDF for All Operators (Complete Catalog / Master Report)
 */
export function generateAllOperatorsScheduleCatalogPDF(
  reports: OperatorScheduleReportData[],
  periodLabel: string,
  studioInfo?: StudioInfo
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Page 1: Master Summary of all operators
  renderMasterCatalogCoverPage(doc, reports, periodLabel, studioInfo);

  // Subsequent pages: detailed schedule for each operator that has appointments (or all)
  for (const report of reports) {
    doc.addPage();
    renderOperatorScheduleToDoc(doc, report, studioInfo, false);
  }

  // Add page numbers at the very end
  addPageNumbers(doc);

  const cleanPeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Catalogo_Appuntamenti_Operatori_${cleanPeriod}.pdf`);
}

/**
 * Renders master summary cover page for all operators
 */
function renderMasterCatalogCoverPage(
  doc: jsPDF,
  reports: OperatorScheduleReportData[],
  periodLabel: string,
  studioInfo?: StudioInfo
): void {
  const studioName = studioInfo?.nome || 'Sound Studio';
  const studioSub = studioInfo?.sottotitolo || 'Gestionale Sala Prove Musicale';
  const contacts = [
    studioInfo?.indirizzo ? `Sede: ${studioInfo.indirizzo}` : '',
    studioInfo?.telefono ? `Tel: ${studioInfo.telefono}` : '',
    studioInfo?.email ? `Email: ${studioInfo.email}` : '',
  ].filter(Boolean).join(' • ');

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 14;

  // Header Box
  doc.setFillColor(243, 244, 246); // Slate 100
  doc.rect(margin, y, contentWidth, 22, 'F');
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, 22, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(79, 70, 229); // Indigo 600
  doc.text(`SALA PROVE • ${studioName.toUpperCase()}`, margin + 4, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(studioSub, margin + 4, y + 12);
  if (contacts) {
    doc.text(contacts, margin + 4, y + 17);
  }

  y += 28;

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text('CATALOGO GENERALE APPUNTAMENTI OPERATORI', margin, y);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Riepilogo presidi e lezioni nel periodo: ${periodLabel}`, margin, y);

  y += 10;

  // Aggregate stats
  const totalAllHours = reports.reduce((s, r) => s + r.totalHours, 0);
  const totalAllAppointments = reports.reduce((s, r) => s + r.totalAppointments, 0);
  const totalAllCompensation = reports.reduce((s, r) => s + r.totalCompensation, 0);

  // Stat boxes
  const colW = contentWidth / 4;
  const boxH = 16;

  const stats = [
    { label: 'OPERATORI REGISTRATI', value: `${reports.length}` },
    { label: 'TOTALE APPUNTAMENTI', value: `${totalAllAppointments}` },
    { label: 'TOTALE ORE ASSEGNATE', value: `${totalAllHours.toFixed(1)} h` },
    { label: 'MONTE COMPENSI', value: `€ ${totalAllCompensation.toFixed(2)}` },
  ];

  stats.forEach((st, i) => {
    const bx = margin + i * colW;
    doc.setFillColor(248, 250, 252);
    doc.rect(bx, y, colW - 2, boxH, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(bx, y, colW - 2, boxH, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(st.label, bx + 3, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(st.value, bx + 3, y + 12);
  });

  y += boxH + 10;

  // Master Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('Tabella Riepilogativa per Operatore', margin, y);
  y += 6;

  // Table header
  doc.setFillColor(79, 70, 229); // Indigo 600
  doc.rect(margin, y, contentWidth, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);

  doc.text('OPERATORE / INSEGNANTE', margin + 3, y + 5.5);
  doc.text('RUOLO', margin + 65, y + 5.5);
  doc.text('GIORNI', margin + 105, y + 5.5);
  doc.text('APPUNTAMENTI', margin + 125, y + 5.5);
  doc.text('ORE TOTALI', margin + 155, y + 5.5);
  doc.text('COMPENSO STIMATO', margin + 175, y + 5.5);

  y += 8;

  reports.forEach((rep, index) => {
    const isEven = index % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, y + 8, margin + contentWidth, y + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${rep.operator.cognome} ${rep.operator.nome}`, margin + 3, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const roleStr =
      rep.operator.ruolo === 'entrambi'
        ? 'Operatore & Docente'
        : rep.operator.ruolo === 'operatore'
        ? 'Operatore Sala'
        : 'Insegnante';
    doc.text(roleStr, margin + 65, y + 5.5);

    doc.text(`${rep.totalWorkingDays} gg`, margin + 105, y + 5.5);
    doc.text(`${rep.totalAppointments}`, margin + 125, y + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.text(`${rep.totalHours} h`, margin + 155, y + 5.5);

    doc.setTextColor(16, 185, 129); // Emerald 600
    doc.text(
      rep.totalCompensation > 0 ? `€ ${rep.totalCompensation.toFixed(2)}` : '€ 0.00',
      margin + 175,
      y + 5.5
    );

    y += 8;
  });

  y += 12;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    '* Nelle pagine seguenti è riportato il dettaglio analitico giorno per giorno per ciascun operatore.',
    margin,
    y
  );
}

/**
 * Render schedule table and details for a single operator on the current page
 */
function renderOperatorScheduleToDoc(
  doc: jsPDF,
  report: OperatorScheduleReportData,
  studioInfo?: StudioInfo,
  addStandalonePageNumbers: boolean = true
): void {
  const studioName = studioInfo?.nome || 'Sound Studio';
  const studioSub = studioInfo?.sottotitolo || 'Gestionale Sala Prove Musicale';
  const contacts = [
    studioInfo?.indirizzo ? `Sede: ${studioInfo.indirizzo}` : '',
    studioInfo?.telefono ? `Tel: ${studioInfo.telefono}` : '',
    studioInfo?.email ? `Email: ${studioInfo.email}` : '',
  ].filter(Boolean).join(' • ');

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 14;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 16) {
      doc.addPage();
      y = 14;
      renderMiniHeader();
    }
  };

  const renderMiniHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(79, 70, 229);
    doc.text(`SALA PROVE • ${studioName.toUpperCase()} — Scheda Turni: ${report.operator.nome} ${report.operator.cognome}`, margin, y);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 2, margin + contentWidth, y + 2);
    y += 7;
  };

  // 1. Studio Header Box
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, contentWidth, 20, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, 20, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(79, 70, 229); // Indigo 600
  doc.text(`SALA PROVE • ${studioName.toUpperCase()}`, margin + 4, y + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(studioSub, margin + 4, y + 11);
  if (contacts) {
    doc.text(contacts, margin + 4, y + 15.5);
  }

  y += 24;

  // 2. Operator Profile & Period Banner
  doc.setFillColor(241, 245, 249); // Slate 100
  doc.rect(margin, y, contentWidth, 22, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, contentWidth, 22, 'S');

  // Left side: Operator info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(`${report.operator.cognome.toUpperCase()} ${report.operator.nome}`, margin + 4, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  const roleText =
    report.operator.ruolo === 'entrambi'
      ? 'Operatore di Sala & Insegnante'
      : report.operator.ruolo === 'operatore'
      ? 'Operatore di Sala'
      : 'Insegnante / Docente';

  const opContacts = [
    `Ruolo: ${roleText}`,
    report.operator.telefono ? `Tel: ${report.operator.telefono}` : '',
    report.operator.email ? `Email: ${report.operator.email}` : '',
  ].filter(Boolean).join('  |  ');

  doc.text(opContacts, margin + 4, y + 12.5);

  if (report.operator.tariffaOrariaRimborso) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(79, 70, 229);
    doc.text(
      `Compenso orario pattuito: € ${report.operator.tariffaOrariaRimborso.toFixed(2)}/ora`,
      margin + 4,
      y + 17.5
    );
  }

  // Right side: Period
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(79, 70, 229);
  doc.text(`PERIODO: ${report.periodLabel.toUpperCase()}`, margin + contentWidth - 4, y + 7, {
    align: 'right',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Stato: ${report.operator.attivo ? 'Operatore Attivo' : 'Non Attivo'}`,
    margin + contentWidth - 4,
    y + 12.5,
    { align: 'right' }
  );

  y += 26;

  // 3. KPI Summary Bar (4 small tiles)
  const tileW = contentWidth / 4;
  const tileH = 14;

  const kpis = [
    { label: 'GIORNI LAVORATIVI', val: `${report.totalWorkingDays} gg` },
    { label: 'NUMERO APPUNTAMENTI', val: `${report.totalAppointments}` },
    { label: 'ORE TOTALI ASSEGNATE', val: `${report.totalHours} ore` },
    {
      label: 'COMPENSO TOTALE',
      val: report.totalCompensation > 0 ? `€ ${report.totalCompensation.toFixed(2)}` : '€ 0.00',
    },
  ];

  kpis.forEach((kpi, idx) => {
    const tx = margin + idx * tileW;
    doc.setFillColor(248, 250, 252);
    doc.rect(tx, y, tileW - 2, tileH, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(tx, y, tileW - 2, tileH, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, tx + 3, y + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(idx === 3 ? 16 : 30, idx === 3 ? 185 : 41, idx === 3 ? 129 : 59);
    doc.text(kpi.val, tx + 3, y + 10.5);
  });

  y += tileH + 8;

  // 4. Appointments Table
  checkPageBreak(30);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Dettaglio Cronologico Giorni e Appuntamenti', margin, y);

  y += 5;

  // Table column widths
  // Total = contentWidth = 182 mm
  const wData = 38;
  const wOra = 28;
  const wSala = 32;
  const wCliente = 48;
  const wAttivita = 22;
  const wComp = 14;

  const renderTableHeader = () => {
    doc.setFillColor(79, 70, 229); // Indigo 600
    doc.rect(margin, y, contentWidth, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    doc.text('DATA & GIORNO', margin + 2, y + 4.8);
    doc.text('ORARIO & ORE', margin + wData + 2, y + 4.8);
    doc.text('SALA PROVE', margin + wData + wOra + 2, y + 4.8);
    doc.text('BAND / ALLIEVO / NOTE', margin + wData + wOra + wSala + 2, y + 4.8);
    doc.text('ATTIVITÀ', margin + wData + wOra + wSala + wCliente + 2, y + 4.8);
    doc.text('COMP.', margin + wData + wOra + wSala + wCliente + wAttivita + 2, y + 4.8);

    y += 7;
  };

  renderTableHeader();

  if (report.appointments.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, y, contentWidth, 12, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, 12, 'S');

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Nessun appuntamento o turno registrato per questo operatore nel periodo selezionato.', margin + 4, y + 7.5);
    y += 16;
  } else {
    report.appointments.forEach((item, index) => {
      checkPageBreak(12);

      const isEven = index % 2 === 0;
      doc.setFillColor(isEven ? 255 : 249, isEven ? 255 : 250, isEven ? 255 : 251);
      doc.rect(margin, y, contentWidth, 9, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(margin, y + 9, margin + contentWidth, y + 9);

      // Data formattata
      const formattedDate = formatDateItalian(item.date, true);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(formattedDate, margin + 2, y + 4.2);

      // Orario
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text(`${item.time} (${item.duration}h)`, margin + wData + 2, y + 5.5);

      // Sala
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(79, 70, 229);
      doc.text(item.roomName.substring(0, 20), margin + wData + wOra + 2, y + 5.5);

      // Cliente / Note
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      const clientDisplay = item.clientName.length > 28 ? item.clientName.substring(0, 26) + '…' : item.clientName;
      doc.text(clientDisplay, margin + wData + wOra + wSala + 2, y + 4.2);

      if (item.equipment || item.notes) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        const notePreview = (item.equipment || item.notes || '').substring(0, 32);
        doc.text(`Note: ${notePreview}`, margin + wData + wOra + wSala + 2, y + 7.5);
      }

      // Attività
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(item.activityType === 'Lezione Musica' ? 147 : 51, item.activityType === 'Lezione Musica' ? 51 : 65, item.activityType === 'Lezione Musica' ? 234 : 85);
      doc.text(item.activityType === 'Lezione Musica' ? 'Lezione' : 'Presidio', margin + wData + wOra + wSala + wCliente + 2, y + 5.5);

      // Compenso
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(16, 185, 129);
      doc.text(
        item.totalCompensation ? `€${item.totalCompensation.toFixed(0)}` : '-',
        margin + wData + wOra + wSala + wCliente + wAttivita + 2,
        y + 5.5
      );

      y += 9;
    });

    y += 6;
  }

  // 5. Signatures and Official Stamp Box
  checkPageBreak(28);

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + contentWidth, y);
  y += 5;

  const halfW = contentWidth / 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Luogo e Data: ${studioInfo?.citta || 'In sede'}, ${formatDateItalian(new Date().toISOString().split('T')[0], false)}`, margin, y + 4);

  y += 10;

  // Signatures
  doc.text('Firma Operatore per presa visione e ricevuta:', margin, y);
  doc.setDrawColor(148, 163, 184);
  doc.line(margin, y + 8, margin + 60, y + 8);

  doc.text('Firma Responsabile Gestione Sala Prove:', margin + halfW, y);
  doc.line(margin + halfW, y + 8, margin + halfW + 60, y + 8);

  if (addStandalonePageNumbers) {
    addPageNumbers(doc);
  }
}

/**
 * Add footer page numbering across all pages in the document
 */
function addPageNumbers(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages();
  const pageHeight = 297;
  const pageWidth = 210;
  const margin = 14;

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);

    const footerText = `Documento gestionale emesso il ${new Date().toLocaleDateString('it-IT')} • Foglio Turni & Appuntamenti`;
    doc.text(footerText, margin, pageHeight - 8);

    const pageNumText = `Pagina ${i} di ${totalPages}`;
    doc.text(pageNumText, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }
}
