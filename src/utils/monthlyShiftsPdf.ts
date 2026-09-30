import { jsPDF } from 'jspdf';
import { Booking, DailyShiftComputed, StaffMember, StudioInfo, WorkShift } from '../types';
import { MESI_ITALIANI } from './dateUtils';
import { computeDailyShifts } from './shiftUtils';

export interface GenerateMonthlyShiftsPdfOptions {
  monthStr: string; // YYYY-MM (e.g. "2026-09")
  shifts: WorkShift[];
  bookings: Booking[];
  staffList: StaffMember[];
  studioInfo?: StudioInfo;
  downloadFileName?: string;
  includeSignatures?: boolean;
  printDirectly?: boolean;
}

export interface DayShiftRow {
  dateStr: string;
  dayNum: number;
  dayName: string;
  shift1: DailyShiftComputed;
  shift2: DailyShiftComputed;
  totalDayHours: number;
  bookingsCount: number;
}

export interface OperatorMonthStat {
  operator: StaffMember;
  shift1Count: number;
  shift2Count: number;
  totalShiftsCount: number;
  totalHours: number;
  percentage: number;
  vacationDaysCount: number;
  customHoursDaysCount: number;
}

/**
 * Extracts and compiles all monthly shift data, operator stats, and weekday rows.
 */
export function compileMonthlyShiftsData(
  monthStr: string,
  shifts: WorkShift[],
  bookings: Booking[],
  staffList: StaffMember[]
) {
  const [yearStr, mStr] = monthStr.split('-');
  const year = Number(yearStr);
  const monthIdx = Number(mStr) - 1;
  const monthName = MESI_ITALIANI[monthIdx] || 'Mese';
  const periodLabel = `${monthName.toUpperCase()} ${year}`;

  const lastDay = new Date(year, monthIdx + 1, 0).getDate();
  const dayRows: DayShiftRow[] = [];

  const eligibleOps = staffList.filter(
    (s) => s.attivo && (s.ruolo === 'operatore' || s.ruolo === 'entrambi')
  );

  const opStatsMap: Record<
    string,
    {
      shift1Count: number;
      shift2Count: number;
      totalHours: number;
      vacationDaysCount: number;
      customHoursDaysCount: number;
    }
  > = {};

  eligibleOps.forEach((op) => {
    const monthExceptions = (op.indisponibilitaDate || []).filter((d) => d.data.startsWith(monthStr));
    const vacationDays = monthExceptions.filter((d) => d.indisponibileTotale).length;
    const customDays = monthExceptions.filter((d) => !d.indisponibileTotale && d.oraInizio).length;

    opStatsMap[op.id] = {
      shift1Count: 0,
      shift2Count: 0,
      totalHours: 0,
      vacationDaysCount: vacationDays,
      customHoursDaysCount: customDays,
    };
  });

  let totalOperatingHours = 0;
  let totalAssignedShifts = 0;
  let totalShiftsSlots = 0;

  for (let day = 1; day <= lastDay; day++) {
    const d = new Date(year, monthIdx, day);
    const dayOfWeek = d.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      // Weekday (Lun - Ven)
      const dateStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayBookings = bookings.filter((b) => b.data === dateStr);
      const [shift1, shift2] = computeDailyShifts(dateStr, dayBookings, shifts, staffList);

      const totalDayHours = Math.round((shift1.durataOre + shift2.durataOre) * 10) / 10;
      totalOperatingHours += totalDayHours;
      totalShiftsSlots += 2;

      if (shift1.operatoreId) {
        totalAssignedShifts++;
        if (opStatsMap[shift1.operatoreId]) {
          opStatsMap[shift1.operatoreId].shift1Count++;
          opStatsMap[shift1.operatoreId].totalHours += shift1.durataOre;
        }
      }

      if (shift2.operatoreId) {
        totalAssignedShifts++;
        if (opStatsMap[shift2.operatoreId]) {
          opStatsMap[shift2.operatoreId].shift2Count++;
          opStatsMap[shift2.operatoreId].totalHours += shift2.durataOre;
        }
      }

      const dayNames = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
      dayRows.push({
        dateStr,
        dayNum: day,
        dayName: dayNames[dayOfWeek],
        shift1,
        shift2,
        totalDayHours,
        bookingsCount: dayBookings.length,
      });
    }
  }

  // Operator summary stats
  const operatorStats: OperatorMonthStat[] = eligibleOps.map((op) => {
    const data = opStatsMap[op.id] || {
      shift1Count: 0,
      shift2Count: 0,
      totalHours: 0,
      vacationDaysCount: 0,
      customHoursDaysCount: 0,
    };
    const totalShiftsCount = data.shift1Count + data.shift2Count;
    const roundedHours = Math.round(data.totalHours * 10) / 10;
    const percentage = totalOperatingHours > 0 ? Math.round((data.totalHours / totalOperatingHours) * 100) : 0;

    return {
      operator: op,
      shift1Count: data.shift1Count,
      shift2Count: data.shift2Count,
      totalShiftsCount,
      totalHours: roundedHours,
      percentage,
      vacationDaysCount: data.vacationDaysCount,
      customHoursDaysCount: data.customHoursDaysCount,
    };
  });

  return {
    year,
    monthIdx,
    monthName,
    periodLabel,
    totalWeekdays: dayRows.length,
    totalShiftsSlots,
    totalAssignedShifts,
    unassignedShifts: totalShiftsSlots - totalAssignedShifts,
    totalOperatingHours: Math.round(totalOperatingHours * 10) / 10,
    dayRows,
    operatorStats,
  };
}

/**
 * Generates an ULTRA-SCHEMATIC 1-PAGE A4 LANDSCAPE PDF with complete monthly shift schedule,
 * all time slots, and full operator workload summary.
 * Guaranteed to fit on EXACTLY ONE SINGLE PAGE (1 pagina al massimo).
 */
export function generateMonthlyShiftsPDF(options: GenerateMonthlyShiftsPdfOptions): void {
  const {
    monthStr,
    shifts,
    bookings,
    staffList,
    studioInfo,
    downloadFileName,
    includeSignatures = true,
  } = options;

  const data = compileMonthlyShiftsData(monthStr, shifts, bookings, staffList);

  // Exact 1-Page A4 Landscape: 297mm x 210mm
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 10;
  const contentWidth = pageWidth - margin * 2; // 277mm
  let y = 10;

  // =========================================================================
  // 1. COMPACT HEADER BAR (15mm high)
  // =========================================================================
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.rect(margin, y, contentWidth, 15, 'F');
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, 15, 'S');

  // Yellow accent strip
  doc.setFillColor(234, 179, 8); // Gold / Yellow
  doc.rect(margin, y, 3.5, 15, 'F');

  // Title & Subtitle
  const studioName = (studioInfo?.nome || 'SALA PROVE MUSICALE').toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(`TABELLONE MENSILE TURNI DI PRESIDIO • ${data.periodLabel}`, margin + 6, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const contacts = [
    `Struttura: ${studioName}`,
    studioInfo?.indirizzo || '',
    studioInfo?.citta || '',
    studioInfo?.telefono ? `Tel: ${studioInfo.telefono}` : '',
  ]
    .filter(Boolean)
    .join(' • ');
  doc.text(contacts, margin + 6, y + 11.5);

  // Right side: Badge Amministrazione & Meta
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9); // Amber 700
  doc.text('DOCUMENTO RISERVATO AMMINISTRAZIONE • SCHEDA UNICA', pageWidth - margin - 4, y + 6, {
    align: 'right',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  const nowStr = new Date().toLocaleDateString('it-IT');
  doc.text(
    `Emissione: ${nowStr} • Copertura: ${data.totalAssignedShifts}/${data.totalShiftsSlots} turni (${
      data.unassignedShifts === 0 ? '100% Coperto' : `${data.unassignedShifts} Liberi`
    }) • Ore Totali Presidio: ${data.totalOperatingHours}h`,
    pageWidth - margin - 4,
    y + 11.5,
    { align: 'right' }
  );

  y += 18;

  // =========================================================================
  // 2. RESOCONTO COMPLETO TUTTI GLI OPERATORI (STRIP ORIZZONTALE SINTETICO)
  // =========================================================================
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(margin, y, contentWidth, 5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text(
    'QUADRO GENERALE CARICO ORE E TURNI OPERATORI (DISTRIBUZIONE EQUA MENSILE):',
    margin + 3,
    y + 3.5
  );

  y += 5;

  const opCount = Math.max(1, data.operatorStats.length);
  const opCardW = contentWidth / opCount;

  data.operatorStats.forEach((stat, idx) => {
    const ox = margin + idx * opCardW;
    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(ox, y, opCardW, 8.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(ox, y, opCardW, 8.5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${stat.operator.nome} ${stat.operator.cognome}`, ox + 2.5, y + 3.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    const detail = `Tot: ${stat.totalShiftsCount} turni (${stat.shift1Count} T1 + ${stat.shift2Count} T2) • ${stat.totalHours}h (${stat.percentage}%)`;
    doc.text(detail, ox + 2.5, y + 7.2);
  });

  y += 11.5;

  // =========================================================================
  // 3. TABELLA SCHEMATICA 2 COLONNE COMPATTE (TUTTI I GIORNI LUN-VEN DEL MESE)
  // =========================================================================
  const totalDays = data.dayRows.length;
  const halfCount = Math.ceil(totalDays / 2);
  const leftDays = data.dayRows.slice(0, halfCount);
  const rightDays = data.dayRows.slice(halfCount);

  const colGap = 5;
  const tableWidth = (contentWidth - colGap) / 2; // (277 - 5) / 2 = 136mm per colonna

  // Colonne interne per ciascuna metà:
  // Data: 22mm
  // 1° Turno (Fascia Pomeridiana): 51mm
  // 2° Turno (Fascia Serale): 51mm
  // Ore: 12mm
  // Totale = 136mm!

  const renderHalfTable = (days: DayShiftRow[], startX: number) => {
    let ty = y;

    // Header tabella
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(startX, ty, tableWidth, 5.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);

    let cx = startX + 2;
    doc.text('DATA / GIORNO', cx, ty + 3.8);
    cx += 22;
    doc.text('1° TURNO (17:00 - 20:00)', cx, ty + 3.8);
    cx += 51;
    doc.text('2° TURNO (20:00 - 23:00)', cx, ty + 3.8);
    cx += 51;
    doc.text('ORE', cx, ty + 3.8);

    ty += 5.5;

    // Righe giorni
    const rowH = 8.5; // Altezza perfetta per inserire orario + nome operatore
    days.forEach((row, rIdx) => {
      const isEven = rIdx % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.rect(startX, ty, tableWidth, rowH, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.15);
      doc.line(startX, ty + rowH, startX + tableWidth, ty + rowH);

      let rx = startX + 2;

      // Colonna 1: Data / Giorno (es. Lun 01/09)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      const dayLabel = `${row.dayName} ${String(row.dayNum).padStart(2, '0')}/${String(
        data.monthIdx + 1
      ).padStart(2, '0')}`;
      doc.text(dayLabel, rx, ty + 4.2);

      rx += 22;

      // Colonna 2: 1° Turno (Fascia oraria + Nome Operatore)
      const s1 = row.shift1;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      doc.text(`${s1.oraInizio} - ${s1.oraFine}`, rx, ty + 3.6);

      doc.setFont('helvetica', s1.operatoreNome ? 'bold' : 'italic');
      doc.setFontSize(7);
      if (s1.operatoreNome) {
        doc.setTextColor(180, 83, 9); // Gold / Amber
        const shortName =
          s1.operatoreNome.length > 18 ? s1.operatoreNome.substring(0, 17) + '…' : s1.operatoreNome;
        doc.text(shortName, rx, ty + 7.2);
      } else {
        doc.setTextColor(225, 29, 72); // Red
        doc.text('⚠️ NON ASSEGN.', rx, ty + 7.2);
      }

      rx += 51;

      // Colonna 3: 2° Turno (Fascia oraria + Nome Operatore)
      const s2 = row.shift2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      doc.text(`${s2.oraInizio} - ${s2.oraFine}`, rx, ty + 3.6);

      doc.setFont('helvetica', s2.operatoreNome ? 'bold' : 'italic');
      doc.setFontSize(7);
      if (s2.operatoreNome) {
        doc.setTextColor(180, 83, 9);
        const shortName =
          s2.operatoreNome.length > 18 ? s2.operatoreNome.substring(0, 17) + '…' : s2.operatoreNome;
        doc.text(shortName, rx, ty + 7.2);
      } else {
        doc.setTextColor(225, 29, 72);
        doc.text('⚠️ NON ASSEGN.', rx, ty + 7.2);
      }

      rx += 51;

      // Colonna 4: Ore Giorno
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`${row.totalDayHours}h`, rx, ty + 5.2);

      ty += rowH;
    });

    return ty;
  };

  const endY1 = renderHalfTable(leftDays, margin);
  const endY2 = renderHalfTable(rightDays, margin + tableWidth + colGap);

  y = Math.max(endY1, endY2) + 4;

  // =========================================================================
  // 4. STRISCIA DI CONVALIDA & FIRMA AMMINISTRAZIONE
  // =========================================================================
  if (includeSignatures) {
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(margin, y, margin + contentWidth, y);
    y += 3.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Note: I turni tengono conto del calendario di lavoro primario, ferie/indisponibilità e adattamento orario proporzionale.',
      margin,
      y + 3
    );

    const halfContent = contentWidth / 2;
    doc.text(
      'Firma Responsabile Amministrazione: ___________________________',
      margin + halfContent - 20,
      y + 3
    );
    doc.text('Timbro Struttura: ___________________________', margin + contentWidth - 65, y + 3);
  }

  // =========================================================================
  // 5. FOOTER DI CHIUSURA (RIGOROSAMENTE PAGINA 1 DI 1)
  // =========================================================================
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Documento Ufficiale ad uso interno Amministrazione • Prospetto Tabellare Unico • Mese di ${data.periodLabel}`,
    margin,
    pageHeight - 5
  );
  doc.text(`Pagina 1 di 1`, pageWidth - margin, pageHeight - 5, { align: 'right' });

  // SAVE OR PRINT AS PDF
  const defaultFileName = `Tabella_Turni_${data.monthName}_${data.year}.pdf`;
  if (options.printDirectly) {
    doc.autoPrint();
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
  } else {
    doc.save(downloadFileName || defaultFileName);
  }
}
