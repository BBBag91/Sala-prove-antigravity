import { jsPDF } from 'jspdf';
import { Booking, DailyShiftComputed, StaffMember, StudioInfo } from '../types';
import { MESI_ITALIANI, parseISODate } from './dateUtils';

export interface WeeklyShiftDayData {
  dateStr: string;
  dayBookings: Booking[];
  shift1: DailyShiftComputed;
  shift2: DailyShiftComputed;
}

export interface WeeklyShiftsPrintOptions {
  currentMonday: Date;
  weekFriday: Date;
  computedWeekShifts: WeeklyShiftDayData[];
  studioInfo?: StudioInfo;
  staff?: StaffMember[];
  includeSignatures?: boolean;
}

const GIORNI_LUN_VEN = [
  { short: 'LUN', name: 'Lunedì' },
  { short: 'MAR', name: 'Martedì' },
  { short: 'MER', name: 'Mercoledì' },
  { short: 'GIO', name: 'Giovedì' },
  { short: 'VEN', name: 'Venerdì' },
  { short: 'SAB', name: 'Sabato' },
];

/**
 * Compiles weekly totals and per-operator shift count & hours.
 */
export function compileWeeklyStats(computedWeekShifts: WeeklyShiftDayData[]) {
  let totalOperatingHours = 0;
  let coveredShifts = 0;
  const totalShifts = (computedWeekShifts && computedWeekShifts.length > 0) ? computedWeekShifts.length * 2 : 12;
  const opMap: Record<string, { id: string; name: string; shiftsCount: number; hours: number }> = {};

  computedWeekShifts.forEach(({ shift1, shift2 }) => {
    const dayHours = shift1.durataOre + shift2.durataOre;
    totalOperatingHours += dayHours;

    if (shift1.operatoreId && shift1.operatoreNome) {
      coveredShifts++;
      if (!opMap[shift1.operatoreId]) {
        opMap[shift1.operatoreId] = { id: shift1.operatoreId, name: shift1.operatoreNome, shiftsCount: 0, hours: 0 };
      }
      opMap[shift1.operatoreId].shiftsCount++;
      opMap[shift1.operatoreId].hours += shift1.durataOre;
    }

    if (shift2.operatoreId && shift2.operatoreNome) {
      coveredShifts++;
      if (!opMap[shift2.operatoreId]) {
        opMap[shift2.operatoreId] = { id: shift2.operatoreId, name: shift2.operatoreNome, shiftsCount: 0, hours: 0 };
      }
      opMap[shift2.operatoreId].shiftsCount++;
      opMap[shift2.operatoreId].hours += shift2.durataOre;
    }
  });

  return {
    totalOperatingHours: Math.round(totalOperatingHours * 10) / 10,
    coveredShifts,
    totalShifts,
    unassignedShifts: totalShifts - coveredShifts,
    operatorStats: Object.values(opMap).sort((a, b) => b.hours - a.hours),
  };
}

/**
 * Builds clean, standalone, high-contrast HTML formatted specifically for A4 portrait printing.
 */
export function buildWeeklyShiftsHtml(options: WeeklyShiftsPrintOptions): string {
  const { currentMonday, weekFriday, computedWeekShifts, studioInfo, includeSignatures = true } = options;
  const stats = compileWeeklyStats(computedWeekShifts);

  const startDay = currentMonday.getDate();
  const startMonth = MESI_ITALIANI[currentMonday.getMonth()];
  const endDay = weekFriday.getDate();
  const endMonth = MESI_ITALIANI[weekFriday.getMonth()];
  const endDayName = weekFriday.getDay() === 6 ? 'Sabato' : 'Venerdì';
  const year = weekFriday.getFullYear();

  const periodTitle =
    startMonth === endMonth
      ? `Da Lunedì ${startDay} a ${endDayName} ${endDay} ${startMonth} ${year}`
      : `Da Lunedì ${startDay} ${startMonth} a ${endDayName} ${endDay} ${endMonth} ${year}`;

  const todayStr = new Date().toLocaleDateString('it-IT');

  const rowsHtml = computedWeekShifts
    .map(({ dateStr, dayBookings, shift1, shift2 }, idx) => {
      const dayConfig = GIORNI_LUN_VEN[idx] || { short: 'GIORNO', name: 'Giorno' };
      const d = parseISODate(dateStr);
      const dayNum = d.getDate();
      const monthNum = String(d.getMonth() + 1).padStart(2, '0');
      const dayHours = Math.round((shift1.durataOre + shift2.durataOre) * 10) / 10;
      const isCovered = shift1.operatoreId && shift2.operatoreId;

      const bookingsSummary =
        dayBookings.length > 0
          ? `${dayBookings.length} ${dayBookings.length === 1 ? 'prova' : 'prove'} in sala`
          : 'Nessuna prenotazione';

      return `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <!-- Colonna Giorno -->
        <td style="padding: 10px 8px; border: 1px solid #cbd5e1; vertical-align: middle; text-align: center; width: 85px;">
          <div style="font-size: 16px; font-weight: 900; line-height: 1; color: #0f172a;">${dayNum}</div>
          <div style="font-size: 11px; font-weight: 800; color: #1e40af; text-transform: uppercase; margin-top: 2px;">${dayConfig.name}</div>
          <div style="font-size: 9px; font-weight: 600; color: #64748b; font-family: monospace;">${dayNum}/${monthNum}</div>
        </td>

        <!-- 1° Turno (Pomeriggio) -->
        <td style="padding: 10px 10px; border: 1px solid #cbd5e1; vertical-align: middle; width: 235px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px;">
            <span style="font-size: 10px; font-weight: 800; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; border: 1px solid #bae6fd;">1° TURNO</span>
            <span style="font-family: monospace; font-size: 12px; font-weight: 800; color: #0f172a;">${shift1.oraInizio} &ndash; ${shift1.oraFine}</span>
          </div>
          <div style="font-size: 13px; font-weight: 800; color: ${shift1.operatoreNome ? '#0f172a' : '#b91c1c'};">
            ${shift1.operatoreNome ? `👤 ${shift1.operatoreNome}` : '⚠️ DA ASSEGNARE'}
          </div>
          <div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">
            Presidio: <strong>${shift1.durataOre}h</strong>
            ${shift1.isAdapted ? `<span style="color: #b45309; font-weight: 700; margin-left: 4px;">(${shift1.adaptationReason || 'Orario adattato'})</span>` : ''}
          </div>
        </td>

        <!-- 2° Turno (Sera) -->
        <td style="padding: 10px 10px; border: 1px solid #cbd5e1; vertical-align: middle; width: 235px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px;">
            <span style="font-size: 10px; font-weight: 800; background: #fef3c7; color: #b45309; padding: 2px 6px; border-radius: 4px; border: 1px solid #fde68a;">2° TURNO</span>
            <span style="font-family: monospace; font-size: 12px; font-weight: 800; color: #0f172a;">${shift2.oraInizio} &ndash; ${shift2.oraFine}</span>
          </div>
          <div style="font-size: 13px; font-weight: 800; color: ${shift2.operatoreNome ? '#0f172a' : '#b91c1c'};">
            ${shift2.operatoreNome ? `👤 ${shift2.operatoreNome}` : '⚠️ DA ASSEGNARE'}
          </div>
          <div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">
            Presidio: <strong>${shift2.durataOre}h</strong>
            ${shift2.isAdapted ? `<span style="color: #b45309; font-weight: 700; margin-left: 4px;">(${shift2.adaptationReason || 'Orario adattato'})</span>` : ''}
          </div>
        </td>

        <!-- Ore Giorno -->
        <td style="padding: 10px 6px; border: 1px solid #cbd5e1; vertical-align: middle; text-align: center; width: 70px;">
          <div style="font-size: 14px; font-weight: 900; font-family: monospace; color: #0f172a;">${dayHours}h</div>
          <div style="font-size: 9px; color: #64748b;">Totale gg</div>
        </td>

        <!-- Stato & Note -->
        <td style="padding: 10px 8px; border: 1px solid #cbd5e1; vertical-align: middle; text-align: center; width: 95px;">
          ${
            isCovered
              ? '<span style="display: inline-block; font-size: 10px; font-weight: 800; background: #dcfce7; color: #15803d; border: 1px solid #86efac; padding: 3px 7px; border-radius: 12px;">✓ Coperto</span>'
              : '<span style="display: inline-block; font-size: 10px; font-weight: 800; background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; padding: 3px 7px; border-radius: 12px;">⚠️ Incompleto</span>'
          }
          <div style="font-size: 9px; color: #475569; margin-top: 4px; line-height: 1.2;">${bookingsSummary}</div>
        </td>
      </tr>
    `;
    })
    .join('');

  const opSummaryHtml =
    stats.operatorStats.length > 0
      ? stats.operatorStats
          .map(
            (op) => `
        <div style="display: inline-block; margin-right: 14px; margin-bottom: 4px; font-size: 10px; background: #f1f5f9; padding: 3px 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <strong>${op.name}</strong>: ${op.shiftsCount} turni (<span style="font-family: monospace; font-weight: 700;">${op.hours}h</span>)
        </div>
      `
          )
          .join('')
      : '<span style="font-size: 10px; color: #94a3b8; font-style: italic;">Nessun operatore ancora assegnato per questa settimana.</span>';

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <title>Schema Turni Settimanale - ${periodTitle}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 8mm 8mm 8mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11px;
      line-height: 1.35;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: avoid;
    }
    .kpi-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div style="width: 100%; max-width: 195mm; margin: 0 auto;">
    
    <!-- 1. HEADER STUDIO -->
    <div style="border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: flex-end;">
      <div>
        <div style="font-size: 14px; font-weight: 900; letter-spacing: -0.2px; text-transform: uppercase; color: #0f172a;">
          SALA PROVE • ${studioInfo?.nome || 'SOUND STUDIO'}
        </div>
        <div style="font-size: 9.5px; color: #475569; margin-top: 1px;">
          ${studioInfo?.indirizzo ? `Sede: ${studioInfo.indirizzo}` : 'Centro Prove & Registrazione'}
          ${studioInfo?.telefono ? ` &bull; Tel: ${studioInfo.telefono}` : ''}
          ${studioInfo?.email ? ` &bull; Email: ${studioInfo.email}` : ''}
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 11px; font-weight: 900; color: #1e3a8a; text-transform: uppercase;">
          SCHEMA SETTIMANALE TURNI
        </div>
        <div style="font-size: 9px; color: #64748b; font-family: monospace;">
          Stampa del: ${todayStr} &bull; Pagina 1 di 1
        </div>
      </div>
    </div>

    <!-- 2. TITOLO PERIODO E KPI -->
    <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 7px 10px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-size: 13px; font-weight: 900; text-transform: uppercase; color: #0f172a;">
          📅 ${periodTitle}
        </div>
        <div style="font-size: 9.5px; color: #475569; margin-top: 2px;">
          Presidio: Lun &ndash; Ven (17:00&ndash;20:00 / 20:00&ndash;23:00+) &bull; Sabato (09:00&ndash;12:00 / 14:00&ndash;18:00)
        </div>
      </div>
      <div style="display: flex; gap: 8px;">
        <div style="background: #ffffff; border: 1px solid #cbd5e1; padding: 3px 8px; border-radius: 6px; text-align: center;">
          <div style="font-size: 8.5px; color: #64748b; text-transform: uppercase; font-weight: 700;">Ore Totali</div>
          <div style="font-size: 12px; font-weight: 900; color: #0f172a; font-family: monospace;">${stats.totalOperatingHours}h</div>
        </div>
        <div style="background: #ffffff; border: 1px solid #cbd5e1; padding: 3px 8px; border-radius: 6px; text-align: center;">
          <div style="font-size: 8.5px; color: #64748b; text-transform: uppercase; font-weight: 700;">Copertura</div>
          <div style="font-size: 12px; font-weight: 900; color: ${stats.unassignedShifts === 0 ? '#15803d' : '#b45309'}; font-family: monospace;">
            ${stats.coveredShifts}/${stats.totalShifts}
          </div>
        </div>
      </div>
    </div>

    <!-- 3. TABELLA DEI 5 GIORNI (LUN - VEN) -->
    <table style="margin-bottom: 10px;">
      <thead>
        <tr style="background: #e2e8f0; border-top: 2px solid #0f172a; border-bottom: 2px solid #94a3b8; color: #0f172a; font-size: 10px; font-weight: 900; text-transform: uppercase;">
          <th style="padding: 7px 6px; border: 1px solid #94a3b8; text-align: center;">Giorno &amp; Data</th>
          <th style="padding: 7px 10px; border: 1px solid #94a3b8; text-align: left;">1° Turno (Pomeridiano)</th>
          <th style="padding: 7px 10px; border: 1px solid #94a3b8; text-align: left;">2° Turno (Serale)</th>
          <th style="padding: 7px 6px; border: 1px solid #94a3b8; text-align: center;">Ore Giorno</th>
          <th style="padding: 7px 6px; border: 1px solid #94a3b8; text-align: center;">Stato Copertura</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr style="background: #f1f5f9; border-top: 2px solid #0f172a; border-bottom: 1px solid #cbd5e1; font-weight: 900;">
          <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 10px; text-transform: uppercase;">
            TOTALE
          </td>
          <td colspan="2" style="padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 10.5px; color: #334155;">
            10 turni settimanali pianificati (Lunedì &ndash; Venerdì)
          </td>
          <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 13px; font-family: monospace; color: #0f172a;">
            ${stats.totalOperatingHours}h
          </td>
          <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 10px; color: ${stats.unassignedShifts === 0 ? '#15803d' : '#b45309'};">
            ${stats.coveredShifts}/10 Coperti
          </td>
        </tr>
      </tfoot>
    </table>

    <!-- 4. RIEPILOGO OPERATORI ATTIVI NELLA SETTIMANA -->
    <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 7px 10px; margin-bottom: 10px;">
      <div style="font-size: 10.5px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin-bottom: 5px;">
        👥 Riepilogo Presenze &amp; Ore Assegnate per Operatore (Questa Settimana):
      </div>
      <div>
        ${opSummaryHtml}
      </div>
    </div>

    <!-- 5. FIRME E CONVALIDA -->
    ${
      includeSignatures
        ? `
    <div style="border-top: 1px solid #cbd5e1; padding-top: 8px; margin-top: 6px; display: flex; justify-content: space-between; font-size: 9.5px; color: #475569;">
      <div style="width: 45%;">
        <div>Luogo e Data: <strong>${studioInfo?.citta || 'In sede'}, ${todayStr}</strong></div>
        <div style="margin-top: 24px; border-bottom: 1px solid #94a3b8; width: 170px;"></div>
        <div style="font-size: 8.5px; color: #64748b; margin-top: 2px;">Firma Operatore per Presa Visione</div>
      </div>
      <div style="width: 45%; text-align: right; display: flex; flex-col; align-items: flex-end;">
        <div style="width: 100%;">
          <div>Per la Direzione: <strong>${studioInfo?.nome || 'Sound Studio'}</strong></div>
          <div style="margin-top: 24px; border-bottom: 1px solid #94a3b8; width: 170px; margin-left: auto;"></div>
          <div style="font-size: 8.5px; color: #64748b; margin-top: 2px;">Timbro Sala &amp; Firma Responsabile</div>
        </div>
      </div>
    </div>
    `
        : ''
    }

    <!-- 6. FOOTER CHIUSURA -->
    <div style="margin-top: 6px; text-align: center; font-size: 8.5px; color: #94a3b8; font-style: italic;">
      Documento Ufficiale ad uso interno &bull; Schema Turni Settimanale di Presidio &bull; Pagina 1 di 1
    </div>

  </div>
</body>
</html>`;
}

/**
 * Directly prints the weekly schedule via an isolated invisible iframe.
 * Guaranteed to never be blank, never have black background, and never clip.
 */
export function printWeeklyShiftsDirectly(options: WeeklyShiftsPrintOptions): void {
  const html = buildWeeklyShiftsHtml(options);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    window.print();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // Give browser a moment to layout and render fonts before triggering print
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error('Errore durante la stampa iframe:', err);
      window.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 3000);
    }
  }, 250);
}

/**
 * Generates an official 1-Page A4 PDF document of the weekly shifts using jsPDF.
 */
export function generateWeeklyShiftsPDF(options: WeeklyShiftsPrintOptions & { downloadFileName?: string }): jsPDF {
  const { currentMonday, weekFriday, computedWeekShifts, studioInfo, includeSignatures = true, downloadFileName } = options;
  const stats = compileWeeklyStats(computedWeekShifts);

  const startDay = currentMonday.getDate();
  const startMonth = MESI_ITALIANI[currentMonday.getMonth()];
  const endDay = weekFriday.getDate();
  const endMonth = MESI_ITALIANI[weekFriday.getMonth()];
  const year = weekFriday.getFullYear();

  const periodTitle =
    startMonth === endMonth
      ? `Settimana dal ${startDay} al ${endDay} ${startMonth} ${year}`
      : `Settimana dal ${startDay} ${startMonth} al ${endDay} ${endMonth} ${year}`;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;
  const contentWidth = pageWidth - margin * 2; // 190mm
  let y = margin;

  // 1. Header Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(`SALA PROVE • ${studioInfo?.nome?.toUpperCase() || 'SOUND STUDIO'}`, margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${studioInfo?.indirizzo ? `Sede: ${studioInfo.indirizzo}` : 'Centro Prove & Registrazione'}${
      studioInfo?.telefono ? ` • Tel: ${studioInfo.telefono}` : ''
    }`,
    margin + 4,
    y + 11
  );
  doc.text(
    `Presidio sale: 1° Turno (17:00-20:00) • 2° Turno (20:00-23:00+) con adattamento orario automatico`,
    margin + 4,
    y + 16
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 58, 138);
  doc.text(`SCHEMA TURNI SETTIMANALE`, pageWidth - margin - 4, y + 6, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Emissione: ${new Date().toLocaleDateString('it-IT')}`, pageWidth - margin - 4, y + 11, { align: 'right' });
  doc.text(`Pagina 1 di 1`, pageWidth - margin - 4, y + 16, { align: 'right' });

  y += 24;

  // 2. Period & KPI Banner
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(148, 163, 184);
  doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(periodTitle.toUpperCase(), margin + 4, y + 7.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const kpiText = `Ore Totali: ${stats.totalOperatingHours}h  |  Copertura: ${stats.coveredShifts}/${stats.totalShifts} Turni`;
  doc.text(kpiText, pageWidth - margin - 4, y + 7.5, { align: 'right' });

  y += 16;

  // 3. Table Header
  const colWidths = {
    day: 28,
    shift1: 66,
    shift2: 66,
    hours: 15,
    status: 15,
  };

  doc.setFillColor(226, 232, 240);
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.2);
  doc.rect(margin, y, contentWidth, 8, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);

  let currentX = margin;
  doc.text('GIORNO', currentX + colWidths.day / 2, y + 5.2, { align: 'center' });
  currentX += colWidths.day;
  doc.text('1° TURNO (17:00 - 20:00)', currentX + 3, y + 5.2);
  currentX += colWidths.shift1;
  doc.text('2° TURNO (20:00 - 23:00+)', currentX + 3, y + 5.2);
  currentX += colWidths.shift2;
  doc.text('ORE', currentX + colWidths.hours / 2, y + 5.2, { align: 'center' });
  currentX += colWidths.hours;
  doc.text('STATO', currentX + colWidths.status / 2, y + 5.2, { align: 'center' });

  y += 8;

  // 4. Table Rows (5 days)
  const rowHeight = 22;

  computedWeekShifts.forEach(({ dateStr, shift1, shift2 }, idx) => {
    const dayConfig = GIORNI_LUN_VEN[idx] || { short: 'GIO', name: 'Giorno' };
    const d = parseISODate(dateStr);
    const dayNum = d.getDate();
    const monthNum = String(d.getMonth() + 1).padStart(2, '0');
    const dayHours = Math.round((shift1.durataOre + shift2.durataOre) * 10) / 10;
    const isCovered = !!(shift1.operatoreId && shift2.operatoreId);

    // Row background
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentWidth, rowHeight, 'FD');

    let xCursor = margin;

    // Col 1: Day
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(String(dayNum), xCursor + colWidths.day / 2, y + 8, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 64, 175);
    doc.text(dayConfig.name.toUpperCase(), xCursor + colWidths.day / 2, y + 13, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`${dayNum}/${monthNum}`, xCursor + colWidths.day / 2, y + 17.5, { align: 'center' });

    xCursor += colWidths.day;

    // Col 2: Shift 1
    doc.setDrawColor(226, 232, 240);
    doc.line(xCursor, y, xCursor, y + rowHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(3, 105, 161);
    doc.text('1° TURNO', xCursor + 3, y + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`${shift1.oraInizio} - ${shift1.oraFine} (${shift1.durataOre}h)`, xCursor + 22, y + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    if (shift1.operatoreNome) {
      doc.setTextColor(15, 23, 42);
      doc.text(shift1.operatoreNome, xCursor + 3, y + 12);
    } else {
      doc.setTextColor(185, 28, 28);
      doc.text('DA ASSEGNARE', xCursor + 3, y + 12);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    if (shift1.isAdapted) {
      doc.text(`* ${shift1.adaptationReason || 'Orario adattato alle prove'}`, xCursor + 3, y + 17);
    } else {
      doc.text('Presidio pomeridiano standard', xCursor + 3, y + 17);
    }

    xCursor += colWidths.shift1;

    // Col 3: Shift 2
    doc.setDrawColor(226, 232, 240);
    doc.line(xCursor, y, xCursor, y + rowHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(180, 83, 9);
    doc.text('2° TURNO', xCursor + 3, y + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`${shift2.oraInizio} - ${shift2.oraFine} (${shift2.durataOre}h)`, xCursor + 22, y + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    if (shift2.operatoreNome) {
      doc.setTextColor(15, 23, 42);
      doc.text(shift2.operatoreNome, xCursor + 3, y + 12);
    } else {
      doc.setTextColor(185, 28, 28);
      doc.text('DA ASSEGNARE', xCursor + 3, y + 12);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    if (shift2.isAdapted) {
      doc.text(`* ${shift2.adaptationReason || 'Orario prolungato per prove serali'}`, xCursor + 3, y + 17);
    } else {
      doc.text('Presidio serale standard', xCursor + 3, y + 17);
    }

    xCursor += colWidths.shift2;

    // Col 4: Day Hours
    doc.setDrawColor(226, 232, 240);
    doc.line(xCursor, y, xCursor, y + rowHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`${dayHours}h`, xCursor + colWidths.hours / 2, y + 12.5, { align: 'center' });

    xCursor += colWidths.hours;

    // Col 5: Status
    doc.setDrawColor(226, 232, 240);
    doc.line(xCursor, y, xCursor, y + rowHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    if (isCovered) {
      doc.setTextColor(21, 128, 61);
      doc.text('COPERTO', xCursor + colWidths.status / 2, y + 12.5, { align: 'center' });
    } else {
      doc.setTextColor(185, 28, 28);
      doc.text('INCOMPLETO', xCursor + colWidths.status / 2, y + 12.5, { align: 'center' });
    }

    y += rowHeight;
  });

  // Table Total Footer
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(100, 116, 139);
  doc.rect(margin, y, contentWidth, 8, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTALE SETTIMANA', margin + 4, y + 5.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('10 Turni pianificati (Lunedì - Venerdì)', margin + 45, y + 5.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${stats.totalOperatingHours}h`, margin + colWidths.day + colWidths.shift1 + colWidths.shift2 + colWidths.hours / 2, y + 5.2, {
    align: 'center',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(stats.unassignedShifts === 0 ? 21 : 180, stats.unassignedShifts === 0 ? 128 : 83, stats.unassignedShifts === 0 ? 61 : 9);
  doc.text(`${stats.coveredShifts}/10 Coperti`, pageWidth - margin - colWidths.status / 2, y + 5.2, { align: 'center' });

  y += 13;

  // 5. Operator Summary Box
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 24, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('RIEPILOGO PRESENZE & ORE ASSEGNATE PER OPERATORE (QUESTA SETTIMANA):', margin + 4, y + 5.5);

  let opX = margin + 4;
  let opY = y + 11;
  stats.operatorStats.forEach((op) => {
    const text = `${op.name}: ${op.shiftsCount} turni (${op.hours}h)`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(text, opX, opY);
    opX += doc.getTextWidth(text) + 8;
    if (opX > pageWidth - margin - 40) {
      opX = margin + 4;
      opY += 5.5;
    }
  });

  y += 29;

  // 6. Signatures Box
  if (includeSignatures) {
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Luogo e Data: ${studioInfo?.citta || 'In sede'}, ${new Date().toLocaleDateString('it-IT')}`, margin, y + 4);

    doc.setDrawColor(148, 163, 184);
    doc.line(margin, y + 16, margin + 55, y + 16);
    doc.setFontSize(7);
    doc.text('Firma Operatore per Presa Visione', margin, y + 19.5);

    const rightColX = pageWidth - margin - 55;
    doc.setFontSize(7.5);
    doc.text(`Per la Direzione: ${studioInfo?.nome || 'Sound Studio'}`, rightColX, y + 4);
    doc.line(rightColX, y + 16, pageWidth - margin, y + 16);
    doc.setFontSize(7);
    doc.text('Timbro Sala & Firma Responsabile', rightColX, y + 19.5);
  }

  // 7. Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Documento Ufficiale interno • Schema Riepilogativo Settimanale Turni • Pagina 1 di 1`,
    pageWidth / 2,
    pageHeight - 6,
    { align: 'center' }
  );

  const defaultFileName = `Schema_Turni_Settimana_${startDay}_${startMonth}_${year}.pdf`;
  doc.save(downloadFileName || defaultFileName);

  return doc;
}
