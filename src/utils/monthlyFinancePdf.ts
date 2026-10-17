import { jsPDF } from 'jspdf';
import { Booking, Client, Expense, ExpenseCategory, Room, StaffMember, StudioInfo } from '../types';
import { calculateDurationHours, formatCurrency, formatDateItalian, MESI_ITALIANI } from './dateUtils';
import { EXPENSE_CATEGORIES } from '../components/ExpenseModal';

export interface MonthlyTeacherSummary {
  teacherId: string;
  teacherName: string;
  lessonsCount: number;
  totalHours: number;
  totalFee: number;
  settlementStatus: 'saldato' | 'da_saldare';
}

export interface MonthlyMembershipSummary {
  clientId: string;
  clientName: string;
  date: string;
  fee: number;
  status: 'pagato' | 'da_saldare';
}

export interface CategoryExpenseSummary {
  category: ExpenseCategory;
  categoryLabel: string;
  categoryIcon: string;
  total: number;
  count: number;
  percentage: number;
}

export interface FinanceLedgerItem {
  id: string;
  no: number;
  date: string;
  description: string;
  type: 'entrata' | 'uscita';
  income: number;
  expense: number;
  runningBalance: number;
}

export interface MonthlyFinanceData {
  monthStr: string; // YYYY-MM
  year: number;
  monthIdx: number; // 0-11
  monthName: string;
  periodLabel: string; // e.g. "OTTOBRE 2026"
  
  // Ledger Movimenti
  movements: FinanceLedgerItem[];
  incomeMovements: FinanceLedgerItem[];
  expenseMovements: FinanceLedgerItem[];

  // Totali
  totalIncomesPaid: number;
  totalExpensesPaid: number;
  netBalance: number;

  // Dettagli specifici
  paidBookingsTotal: number;
  paidBookingsCount: number;
  teacherFeesSaldatoTotal: number;
  membershipsPaidTotal: number;

  categorySummaries: CategoryExpenseSummary[];
  totalExpensesPending: number;
  pendingExpensesCount: number;
}

/**
 * Compiles all movements and figures for the given month into a structured ledger format.
 */
export function compileMonthlyFinanceData(
  monthStr: string,
  bookings: Booking[],
  expenses: Expense[],
  clients: Client[],
  staff: StaffMember[],
  rooms: Room[]
): MonthlyFinanceData {
  const [yearStr, mStr] = monthStr.split('-');
  const year = Number(yearStr) || new Date().getFullYear();
  const monthIdx = (Number(mStr) || 1) - 1;
  const monthName = MESI_ITALIANI[monthIdx] || 'Mese';
  const periodLabel = `${monthName.toUpperCase()} ${year}`;

  const rawMovements: Omit<FinanceLedgerItem, 'no' | 'runningBalance'>[] = [];

  // 1. Prove Musicali saldate
  const monthlyPaidBookings = bookings.filter(
    (b) => b.data && b.data.startsWith(monthStr) && b.tipo !== 'lezione' && b.statoPagamento === 'pagato'
  );
  monthlyPaidBookings.forEach((b) => {
    rawMovements.push({
      id: b.id,
      date: b.data,
      description: `Prova: ${b.clienteNome || 'Cliente'} (${b.salaNome || 'Sala'} ${b.oraInizio}-${b.oraFine})`,
      type: 'entrata',
      income: b.tariffaTotale || 0,
      expense: 0,
    });
  });

  const paidBookingsTotal = monthlyPaidBookings.reduce((sum, b) => sum + (b.tariffaTotale || 0), 0);
  const paidBookingsCount = monthlyPaidBookings.length;

  // 2. Quote Lezioni Docenti saldate
  const settlementStorageKey = `salaprove_quote_insegnanti_v1_${monthStr}`;
  let settlementMap: Record<string, 'saldato' | 'da_saldare'> = {};
  try {
    const saved = localStorage.getItem(settlementStorageKey);
    if (saved) settlementMap = JSON.parse(saved);
  } catch {}

  const teachers = staff.filter((s) => s.ruolo === 'insegnante');
  const monthlyLessons = bookings.filter(
    (b) => b.data && b.data.startsWith(monthStr) && b.tipo === 'lezione'
  );

  let teacherFeesSaldatoTotal = 0;
  teachers.forEach((t) => {
    const tFullName = `${t.nome} ${t.cognome}`.trim().toLowerCase();
    const tLessons = monthlyLessons.filter(
      (b) =>
        (b.insegnanteId && b.insegnanteId === t.id) ||
        (b.insegnanteNome && b.insegnanteNome.trim().toLowerCase() === tFullName)
    );

    const totalHours = tLessons.reduce((sum, b) => {
      const h = b.durataOre || calculateDurationHours(b.oraInizio, b.oraFine);
      return sum + (isNaN(h) ? 0 : h);
    }, 0);

    const totalFee = Math.round(totalHours * 5 * 100) / 100;
    const isSaldato = (settlementMap[t.id] || 'da_saldare') === 'saldato';

    if (isSaldato && totalFee > 0) {
      teacherFeesSaldatoTotal += totalFee;
      // Imposta data a fine mese o prima data utile
      const lastDayStr = `${monthStr}-${String(new Date(year, monthIdx + 1, 0).getDate()).padStart(2, '0')}`;
      rawMovements.push({
        id: `teacher-${t.id}`,
        date: lastDayStr,
        description: `Quota Sala Lezioni: ${t.nome} ${t.cognome} (${totalHours.toFixed(1)}h a 5€/h)`,
        type: 'entrata',
        income: totalFee,
        expense: 0,
      });
    }
  });

  // 3. Tesseramenti saldati del mese
  const monthlyClients = clients.filter(
    (c) => c.dataTesseramento && c.dataTesseramento.startsWith(monthStr)
  );

  let membershipsPaidTotal = 0;
  monthlyClients.forEach((c) => {
    const isPaid = c.quotaPagata !== false && c.statoQuota !== 'da_saldare';
    if (isPaid) {
      const fee = c.quotaTesseramento || 10;
      membershipsPaidTotal += fee;
      rawMovements.push({
        id: `client-${c.id}`,
        date: c.dataTesseramento,
        description: `Quota Tesseramento: ${c.nome} ${c.cognome}${c.gruppoBand ? ` (${c.gruppoBand})` : ''}`,
        type: 'entrata',
        income: fee,
        expense: 0,
      });
    }
  });

  // 4. Spese pagate del mese
  const monthlyExpenses = expenses.filter((e) => e.data && e.data.startsWith(monthStr));
  const paidExpenses = monthlyExpenses.filter((e) => e.stato === 'pagato');
  const pendingExpenses = monthlyExpenses.filter((e) => e.stato === 'in_scadenza');

  paidExpenses.forEach((exp) => {
    const catConfig = EXPENSE_CATEGORIES.find((c) => c.id === exp.categoria);
    const catName = catConfig?.label ? catConfig.label.split('(')[0].trim() : exp.categoria;
    const desc = exp.fornitore ? `${exp.descrizione} (${exp.fornitore}) - ${catName}` : `${exp.descrizione} - ${catName}`;
    rawMovements.push({
      id: exp.id,
      date: exp.data,
      description: desc,
      type: 'uscita',
      income: 0,
      expense: exp.importo || 0,
    });
  });

  // Ordinamento cronologico
  rawMovements.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    // Se stessa data, prima entrate poi spese
    if (a.type !== b.type) return a.type === 'entrata' ? -1 : 1;
    return a.description.localeCompare(b.description);
  });

  // Calcolo saldo progressivo e numerazione progressiva No.
  let running = 0;
  const movements: FinanceLedgerItem[] = rawMovements.map((m, idx) => {
    running += m.income - m.expense;
    return {
      ...m,
      no: idx + 1,
      runningBalance: running,
    };
  });

  // Separa per tabelle distinte
  let runningIncome = 0;
  const incomeMovements: FinanceLedgerItem[] = movements
    .filter((m) => m.type === 'entrata')
    .map((m, idx) => {
      runningIncome += m.income;
      return {
        ...m,
        no: idx + 1,
        runningBalance: runningIncome,
      };
    });

  let runningExpense = 0;
  const expenseMovements: FinanceLedgerItem[] = movements
    .filter((m) => m.type === 'uscita')
    .map((m, idx) => {
      runningExpense += m.expense;
      return {
        ...m,
        no: idx + 1,
        runningBalance: runningExpense,
      };
    });

  const totalIncomesPaid = paidBookingsTotal + teacherFeesSaldatoTotal + membershipsPaidTotal;
  const totalExpensesPaid = paidExpenses.reduce((sum, e) => sum + (e.importo || 0), 0);
  const netBalance = totalIncomesPaid - totalExpensesPaid;

  const totalExpensesPending = pendingExpenses.reduce((sum, e) => sum + (e.importo || 0), 0);

  // Categorie
  const categoryMap: Partial<Record<ExpenseCategory, { total: number; count: number }>> = {};
  for (const exp of paidExpenses) {
    if (!categoryMap[exp.categoria]) {
      categoryMap[exp.categoria] = { total: 0, count: 0 };
    }
    categoryMap[exp.categoria]!.total += exp.importo || 0;
    categoryMap[exp.categoria]!.count += 1;
  }

  const categorySummaries: CategoryExpenseSummary[] = Object.entries(categoryMap).map(
    ([catKey, val]) => {
      const catConfig = EXPENSE_CATEGORIES.find((c) => c.id === catKey);
      const catTotal = val ? val.total : 0;
      const catCount = val ? val.count : 0;
      const percentage = totalExpensesPaid > 0 ? (catTotal / totalExpensesPaid) * 100 : 0;
      return {
        category: catKey as ExpenseCategory,
        categoryLabel: catConfig?.label || catKey,
        categoryIcon: catConfig?.icon || '📁',
        total: catTotal,
        count: catCount,
        percentage,
      };
    }
  ).sort((a, b) => b.total - a.total);

  return {
    monthStr,
    year,
    monthIdx,
    monthName,
    periodLabel,
    movements,
    incomeMovements,
    expenseMovements,
    totalIncomesPaid,
    totalExpensesPaid,
    netBalance,
    paidBookingsTotal,
    paidBookingsCount,
    teacherFeesSaldatoTotal,
    membershipsPaidTotal,
    categorySummaries,
    totalExpensesPending,
    pendingExpensesCount: pendingExpenses.length,
  };
}

export interface GenerateMonthlyFinancePdfOptions {
  data: MonthlyFinanceData;
  studioInfo?: StudioInfo;
  layout?: 'unified' | 'separated';
  downloadFileName?: string;
}

/**
 * Generates an official, print-ready, high-resolution vector PDF of the Monthly Financial Report
 * matching the exact classic "Entrate/Uscite" printable ledger sheet template.
 */
export function generateMonthlyFinancePDF({
  data,
  studioInfo,
  layout = 'unified',
  downloadFileName,
}: GenerateMonthlyFinancePdfOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const studioName = (studioInfo?.nome || 'SALA PROVE MUSICALE').toUpperCase();

  let y = 14;

  const renderSheetHeader = (isContinuation: boolean = false) => {
    // Top Title: Centered "Entrate/Uscite"
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42);
    const titleText = isContinuation ? 'Entrate / Uscite (Seguito)' : 'Entrate / Uscite';
    doc.text(titleText, pageWidth / 2, y + 8, { align: 'center' });

    // Subtitle / Studio Name
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(studioName, pageWidth / 2, y + 13, { align: 'center' });

    // Meta line: Mese: _________          Anno: _________
    y += 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);

    // Mese on the left
    doc.text(`Mese: `, margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(2, 132, 199);
    doc.text(`${data.monthName.toUpperCase()}`, margin + 12, y);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);
    doc.line(margin + 12, y + 1.2, margin + 55, y + 1.2);

    // Emission / Doc meta in center
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Registro Movimenti Cassa Mensile`, pageWidth / 2, y, { align: 'center' });

    // Anno on the right
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Anno: `, pageWidth - margin - 35, y);
    doc.setTextColor(2, 132, 199);
    doc.text(`${data.year}`, pageWidth - margin - 22, y);
    doc.line(pageWidth - margin - 23, y + 1.2, pageWidth - margin, y + 1.2);

    y += 6;
  };

  const renderTableHeaderUnified = () => {
    // Header Bar styled like classic printed template with light tint
    doc.setFillColor(224, 242, 254); // Soft Cyan/Blue tint
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.35);
    doc.rect(margin, y, contentWidth, 7, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);

    // Column divisions
    // Columns: No. (10mm) | Data (20mm) | Descrizione (rest) | Entrate (25mm) | Spese (25mm) | Saldo (25mm)
    const colNoW = 10;
    const colDateW = 20;
    const colIncomeW = 25;
    const colExpenseW = 25;
    const colBalanceW = 26;
    const colDescW = contentWidth - (colNoW + colDateW + colIncomeW + colExpenseW + colBalanceW);

    let cx = margin;
    doc.text('No.', cx + colNoW / 2, y + 4.8, { align: 'center' });
    cx += colNoW;
    doc.line(cx, y, cx, y + 7);

    doc.text('Data', cx + colDateW / 2, y + 4.8, { align: 'center' });
    cx += colDateW;
    doc.line(cx, y, cx, y + 7);

    doc.text('Descrizione', cx + 3, y + 4.8);
    cx += colDescW;
    doc.line(cx, y, cx, y + 7);

    doc.text('Entrate', cx + colIncomeW - 3, y + 4.8, { align: 'right' });
    cx += colIncomeW;
    doc.line(cx, y, cx, y + 7);

    doc.text('Spese', cx + colExpenseW - 3, y + 4.8, { align: 'right' });
    cx += colExpenseW;
    doc.line(cx, y, cx, y + 7);

    doc.text('Saldo', cx + colBalanceW - 3, y + 4.8, { align: 'right' });

    y += 7;
  };

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 35) {
      doc.addPage();
      y = 14;
      renderSheetHeader(true);
      renderTableHeaderUnified();
    }
  };

  // Render First Page Header
  renderSheetHeader(false);
  renderTableHeaderUnified();

  // Columns Widths
  const colNoW = 10;
  const colDateW = 20;
  const colIncomeW = 25;
  const colExpenseW = 25;
  const colBalanceW = 26;
  const colDescW = contentWidth - (colNoW + colDateW + colIncomeW + colExpenseW + colBalanceW);

  const rowHeight = 6.2;
  const items = data.movements;
  const minRows = Math.max(items.length, 18); // Ensure at least 18 rows for that notebook/template look

  for (let i = 0; i < minRows; i++) {
    checkPageBreak(rowHeight);
    const item = items[i];

    // Background zebra (clean white and subtle slate)
    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, rowHeight, 'F');
    }

    // Border
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, contentWidth, rowHeight, 'S');

    // Column vertical lines
    let cx = margin;
    cx += colNoW;
    doc.line(cx, y, cx, y + rowHeight);
    cx += colDateW;
    doc.line(cx, y, cx, y + rowHeight);
    cx += colDescW;
    doc.line(cx, y, cx, y + rowHeight);
    cx += colIncomeW;
    doc.line(cx, y, cx, y + rowHeight);
    cx += colExpenseW;
    doc.line(cx, y, cx, y + rowHeight);

    if (item) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);

      // No.
      doc.text(String(item.no), margin + colNoW / 2, y + 4.2, { align: 'center' });

      // Data (DD/MM)
      const formattedDate = formatDateItalian(item.date, false);
      doc.text(formattedDate, margin + colNoW + colDateW / 2, y + 4.2, { align: 'center' });

      // Descrizione (truncated)
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      const descLimit = 48;
      const cleanDesc =
        item.description.length > descLimit
          ? `${item.description.substring(0, descLimit - 2)}..`
          : item.description;
      doc.text(cleanDesc, margin + colNoW + colDateW + 2.5, y + 4.2);

      // Entrate
      doc.setFont('helvetica', 'bold');
      if (item.income > 0) {
        doc.setTextColor(21, 128, 61); // Green
        doc.text(formatCurrency(item.income), margin + colNoW + colDateW + colDescW + colIncomeW - 2.5, y + 4.2, {
          align: 'right',
        });
      } else {
        doc.setTextColor(203, 213, 225);
        doc.text('—', margin + colNoW + colDateW + colDescW + colIncomeW / 2, y + 4.2, { align: 'center' });
      }

      // Spese
      if (item.expense > 0) {
        doc.setTextColor(225, 29, 72); // Rose
        doc.text(
          formatCurrency(item.expense),
          margin + colNoW + colDateW + colDescW + colIncomeW + colExpenseW - 2.5,
          y + 4.2,
          { align: 'right' }
        );
      } else {
        doc.setTextColor(203, 213, 225);
        doc.text('—', margin + colNoW + colDateW + colDescW + colIncomeW + colExpenseW / 2, y + 4.2, {
          align: 'center',
        });
      }

      // Saldo progressivo
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(item.runningBalance >= 0 ? 30 : 185, item.runningBalance >= 0 ? 64 : 28, item.runningBalance >= 0 ? 175 : 28);
      doc.text(formatCurrency(item.runningBalance), pageWidth - margin - 2.5, y + 4.2, { align: 'right' });
    }

    y += rowHeight;
  }

  // Row Totale (exact match with template: bottom row "Totale")
  checkPageBreak(8);
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 7, 'F');
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.35);
  doc.rect(margin, y, contentWidth, 7, 'S');

  // Label "Totale"
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  const descEndX = margin + colNoW + colDateW + colDescW;
  doc.text('Totale', descEndX - 4, y + 4.8, { align: 'right' });

  // Column vertical lines for Totale row
  let cx = descEndX;
  doc.line(cx, y, cx, y + 7);
  cx += colIncomeW;
  doc.line(cx, y, cx, y + 7);
  cx += colExpenseW;
  doc.line(cx, y, cx, y + 7);

  // Totale Entrate
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(21, 128, 61);
  doc.text(formatCurrency(data.totalIncomesPaid), descEndX + colIncomeW - 2.5, y + 4.8, { align: 'right' });

  // Totale Spese
  doc.setTextColor(225, 29, 72);
  doc.text(formatCurrency(data.totalExpensesPaid), descEndX + colIncomeW + colExpenseW - 2.5, y + 4.8, {
    align: 'right',
  });

  // Saldo Finale
  doc.setTextColor(data.netBalance >= 0 ? 30 : 185, data.netBalance >= 0 ? 64 : 28, data.netBalance >= 0 ? 175 : 28);
  doc.text(formatCurrency(data.netBalance), pageWidth - margin - 2.5, y + 4.8, { align: 'right' });

  y += 10;

  // Box NOTE (Exaclty as in the uploaded template!)
  const remainingPageSpace = pageHeight - margin - y - 10;
  const noteBoxH = Math.max(26, Math.min(remainingPageSpace, 40));

  if (y + noteBoxH > pageHeight - 12) {
    doc.addPage();
    y = 14;
    renderSheetHeader(true);
  }

  // Note Box Frame
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, y, contentWidth, noteBoxH, 'F');
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.35);
  doc.rect(margin, y, contentWidth, noteBoxH, 'S');

  // Header Note Bar
  doc.setFillColor(224, 242, 254);
  doc.rect(margin, y, contentWidth, 5.5, 'F');
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.25);
  doc.line(margin, y + 5.5, pageWidth - margin, y + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Note', pageWidth / 2, y + 3.8, { align: 'center' });

  // Inside Note: Summary of notes, pending items, signatures
  const noteInsideY = y + 9.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);

  const noteLines = [
    `• Riepilogo Incassi: ${data.paidBookingsCount} prove musicali (${formatCurrency(data.paidBookingsTotal)})` +
      (data.teacherFeesSaldatoTotal > 0 ? ` • Quote lezioni docenti saldate (${formatCurrency(data.teacherFeesSaldatoTotal)})` : '') +
      (data.membershipsPaidTotal > 0 ? ` • Nuove tessere (${formatCurrency(data.membershipsPaidTotal)})` : ''),
    data.totalExpensesPending > 0
      ? `• Spese in scadenza / da liquidare non conteggiate nel saldo: ${formatCurrency(data.totalExpensesPending)} (${data.pendingExpensesCount} voci)`
      : `• Nessuna spesa in sospeso registrata per il periodo contabile di ${data.periodLabel}.`,
  ];

  doc.text(noteLines[0], margin + 4, noteInsideY);
  doc.text(noteLines[1], margin + 4, noteInsideY + 4.5);

  // Signatures at bottom of note box
  const signY = y + noteBoxH - 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Luogo e Data: ${studioInfo?.citta || 'In sede'}, lì ${new Date().toLocaleDateString('it-IT')}`, margin + 4, signY);

  doc.text(`Firma del Responsabile: ___________________________________`, pageWidth - margin - 4, signY, {
    align: 'right',
  });

  // Footer page numbers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Registro Entrate / Uscite • ${studioName} • ${data.periodLabel}`,
      margin,
      pageHeight - 6
    );
    doc.text(`Foglio ${p} di ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }

  // Download PDF
  const defaultFileName = `Entrate_Uscite_${data.monthStr}.pdf`;
  doc.save(downloadFileName || defaultFileName);
}
