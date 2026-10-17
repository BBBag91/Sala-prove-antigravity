import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Printer,
  Download,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  CheckCircle2,
  Columns2,
  TableProperties,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDateItalian } from '../utils/dateUtils';
import {
  compileMonthlyFinanceData,
  generateMonthlyFinancePDF,
} from '../utils/monthlyFinancePdf';

interface MonthlyFinanceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMonthStr: string; // YYYY-MM
}

type SheetLayoutMode = 'unified' | 'separated';

export const MonthlyFinanceReportModal: React.FC<MonthlyFinanceReportModalProps> = ({
  isOpen,
  onClose,
  initialMonthStr,
}) => {
  const { bookings, expenses, clients, staff, rooms, studioInfo } = useApp();

  const [currentYear, setCurrentYear] = useState<number>(() => {
    if (initialMonthStr) return Number(initialMonthStr.split('-')[0]) || new Date().getFullYear();
    return new Date().getFullYear();
  });

  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(() => {
    if (initialMonthStr) return (Number(initialMonthStr.split('-')[1]) || 1) - 1;
    return new Date().getMonth();
  });

  const [layoutMode, setLayoutMode] = useState<SheetLayoutMode>('unified');
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Month Key: YYYY-MM
  const monthKey = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}`;

  const handlePrevMonth = () => {
    if (currentMonthIndex === 0) {
      setCurrentMonthIndex(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonthIndex((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonthIndex === 11) {
      setCurrentMonthIndex(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonthIndex((m) => m + 1);
    }
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonthIndex(now.getMonth());
  };

  // Compile monthly data
  const data = useMemo(() => {
    return compileMonthlyFinanceData(monthKey, bookings, expenses, clients, staff, rooms);
  }, [monthKey, bookings, expenses, clients, staff, rooms]);

  // Gestione pulizia classi di stampa
  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove('printing-finance-report');
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('printing-finance-report');
    };
  }, []);

  if (!isOpen) return null;

  const handleDownloadPDF = () => {
    generateMonthlyFinancePDF({
      data,
      studioInfo,
      layout: layoutMode,
      downloadFileName: `Entrate_Uscite_${monthKey}.pdf`,
    });
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3500);
  };

  const handlePrint = () => {
    document.body.classList.add('printing-finance-report');
    // Piccolo timeout per dare tempo al layout di isolarsi completamente
    setTimeout(() => {
      window.print();
    }, 60);
  };

  const todayStr = new Date().toLocaleDateString('it-IT');

  // Calcolo righe minime per aspetto quaderno / registro contabile
  // Se ci sono già più di 10 movimenti, non forziamo righe vuote in eccesso per evitare di sforare su pagine extra
  const minRows = 10;
  const unifiedEmptyRowsCount = Math.max(0, minRows - data.movements.length);
  const incomeEmptyRowsCount = Math.max(0, 5 - data.incomeMovements.length);
  const expenseEmptyRowsCount = Math.max(0, 5 - data.expenseMovements.length);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      <div className="bg-white dark:bg-[#121212] w-full max-w-5xl rounded-2xl border border-slate-200 dark:border-yellow-500/30 shadow-2xl flex flex-col max-h-[94vh] overflow-hidden my-auto">
        
        {/* =========================================================================
            RIGA 1 HEADER: TITOLO, BADGE E TASTO CHIUDI (SFONDO BLU)
            ========================================================================= */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-yellow-400/10 border border-blue-200/80 dark:border-yellow-500/30 flex items-center justify-center text-blue-600 dark:text-yellow-400 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 id="report-modal-title" className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                  Scheda Stampabile Entrate / Uscite
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-blue-50 text-blue-700 dark:bg-yellow-400/20 dark:text-yellow-300 border border-blue-200 dark:border-yellow-500/30 uppercase tracking-wide">
                  {data.periodLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-neutral-400 truncate">
                Registro contabile movimenti cassa con totali e sezione note
              </p>
            </div>
          </div>

          {/* TASTO CHIUDI CON SFONDO BLU */}
          <button
            type="button"
            onClick={onClose}
            className="modal-header-btn-blue modal-close-btn-blue shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white transition-all cursor-pointer border border-blue-500 shadow-md shadow-blue-500/25"
            title="Chiudi"
            aria-label="Chiudi finestra"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* =========================================================================
            RIGA 2 TOOLBAR: SELETTORE LAYOUT, MESE E AZIONI STAMPA/PDF
            ========================================================================= */}
        <div className="px-4 py-2 sm:px-5 sm:py-2.5 border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/70 flex flex-wrap items-center justify-between gap-2.5 shrink-0 print:hidden">
          {/* Selettore Layout & Mese */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Layout switch */}
            <div className="flex items-center bg-white dark:bg-neutral-800 rounded-xl p-0.5 border border-slate-200 dark:border-neutral-700 shadow-xs">
              <button
                type="button"
                onClick={() => setLayoutMode('unified')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  layoutMode === 'unified'
                    ? 'bg-blue-600 text-white dark:bg-yellow-400 dark:text-black shadow-xs'
                    : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Registro Unico con Saldo continuo"
              >
                <TableProperties className="w-3.5 h-3.5" />
                <span>Registro Unico</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('separated')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  layoutMode === 'separated'
                    ? 'bg-blue-600 text-white dark:bg-yellow-400 dark:text-black shadow-xs'
                    : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Due tabelle separate: Entrate sopra, Spese sotto"
              >
                <Columns2 className="w-3.5 h-3.5" />
                <span>Tabelle Separate</span>
              </button>
            </div>

            {/* Month Navigator */}
            <div className="flex items-center bg-white dark:bg-neutral-800 rounded-xl p-0.5 border border-slate-200 dark:border-neutral-700 shadow-xs">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-7 h-7 rounded-lg text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-700 flex items-center justify-center transition-all cursor-pointer"
                title="Mese precedente"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleCurrentMonth}
                className="px-2.5 py-0.5 text-xs font-bold text-slate-800 dark:text-yellow-300 hover:bg-slate-100 dark:hover:bg-neutral-700 rounded-md transition-all cursor-pointer"
                title="Mese corrente"
              >
                {data.monthName} {data.year}
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-7 h-7 rounded-lg text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-700 flex items-center justify-center transition-all cursor-pointer"
                title="Mese successivo"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Azioni Stampa e Download PDF */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-white dark:bg-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200 border border-slate-300 dark:border-neutral-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Stampa scheda su carta A4"
            >
              <Printer className="w-4 h-4 text-blue-600 dark:text-yellow-400" />
              <span>Stampa Scheda</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                downloadSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-yellow-400 dark:hover:bg-yellow-300 dark:text-black font-extrabold'
              }`}
              title="Scarica PDF stampabile"
            >
              {downloadSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Scaricato!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Scarica PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* =========================================================================
            AREA FOGLIO A4 STAMPABILE
            ========================================================================= */}
        <div className="overflow-y-auto p-3 sm:p-6 bg-slate-200/80 dark:bg-neutral-950 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          <div
            id="printable-monthly-finance-report"
            className="bg-white text-slate-900 w-full max-w-[800px] p-5 sm:p-7 rounded-xl shadow-md border border-slate-300 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none space-y-3 print:space-y-2"
          >
            {/* Header: Titolo Centrale Grande "Entrate/Uscite" */}
            <div className="text-center space-y-0.5 pb-1">
              <h1 className="text-2xl sm:text-3xl print:text-2xl font-bold tracking-tight text-slate-900 font-sans">
                Entrate/Uscite
              </h1>
              <p className="text-[11px] print:text-[10px] text-slate-500 font-medium">
                {studioInfo?.nome ? studioInfo.nome.toUpperCase() : 'SALA PROVE MUSICALE'}
                {studioInfo?.citta ? ` • ${studioInfo.citta}` : ''}
              </p>

              {/* Riga Mese e Anno (stile modello stampabile con linea orizzontale) */}
              <div className="flex items-center justify-between text-xs print:text-[10.5px] font-semibold text-slate-800 pt-2 px-1">
                <div className="flex items-baseline gap-2">
                  <span>Mese:</span>
                  <span className="font-bold text-blue-700 text-sm print:text-xs border-b-2 border-slate-700 min-w-[120px] text-left px-1">
                    {data.monthName.toUpperCase()}
                  </span>
                </div>

                <div className="text-[10px] print:text-[9px] text-slate-400 font-normal">
                  Registro Contabile Mensile
                </div>

                <div className="flex items-baseline gap-2">
                  <span>Anno:</span>
                  <span className="font-bold text-blue-700 text-sm print:text-xs border-b-2 border-slate-700 min-w-[70px] text-center px-1">
                    {data.year}
                  </span>
                </div>
              </div>
            </div>

            {/* FORMATO 1: REGISTRO UNIFICATO (Entrate, Spese, Saldo) */}
            {layoutMode === 'unified' && (
              <div className="space-y-2">
                <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full text-left text-xs print:text-[10px] border border-slate-400 border-collapse">
                    <thead>
                      <tr className="bg-sky-100/70 text-slate-900 font-bold text-[11px] print:text-[9.5px] text-center">
                        <th className="py-1.5 print:py-1 px-1.5 border border-slate-400 w-9">No.</th>
                        <th className="py-1.5 print:py-1 px-2 border border-slate-400 w-22">Data</th>
                        <th className="py-1.5 print:py-1 px-3 border border-slate-400 text-left">Descrizione</th>
                        <th className="py-1.5 print:py-1 px-2.5 border border-slate-400 w-24 text-right">Entrate</th>
                        <th className="py-1.5 print:py-1 px-2.5 border border-slate-400 w-24 text-right">Spese</th>
                        <th className="py-1.5 print:py-1 px-2.5 border border-slate-400 w-24 text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.movements.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-1 print:py-0.5 px-1.5 border border-slate-300 text-center text-slate-600 font-mono text-[10px] print:text-[9px]">
                            {m.no}
                          </td>
                          <td className="py-1 print:py-0.5 px-2 border border-slate-300 text-center font-mono text-slate-700 text-[10.5px] print:text-[9px] whitespace-nowrap">
                            {formatDateItalian(m.date, false)}
                          </td>
                          <td className="py-1 print:py-0.5 px-3 border border-slate-300 font-medium text-slate-900 text-xs print:text-[9.5px]">
                            {m.description}
                          </td>
                          <td className="py-1 print:py-0.5 px-2.5 border border-slate-300 text-right font-mono font-bold text-xs print:text-[9.5px] whitespace-nowrap">
                            {m.income > 0 ? (
                              <span className="text-emerald-700">{formatCurrency(m.income)}</span>
                            ) : (
                              <span className="text-slate-300 font-normal">—</span>
                            )}
                          </td>
                          <td className="py-1 print:py-0.5 px-2.5 border border-slate-300 text-right font-mono font-bold text-xs print:text-[9.5px] whitespace-nowrap">
                            {m.expense > 0 ? (
                              <span className="text-rose-600">{formatCurrency(m.expense)}</span>
                            ) : (
                              <span className="text-slate-300 font-normal">—</span>
                            )}
                          </td>
                          <td className="py-1 print:py-0.5 px-2.5 border border-slate-300 text-right font-mono font-bold text-xs print:text-[9.5px] whitespace-nowrap">
                            <span className={m.runningBalance >= 0 ? 'text-slate-900' : 'text-red-600'}>
                              {formatCurrency(m.runningBalance)}
                            </span>
                          </td>
                        </tr>
                      ))}

                      {/* Righe vuote stile template quaderno */}
                      {Array.from({ length: unifiedEmptyRowsCount }).map((_, idx) => (
                        <tr key={`empty-${idx}`} className="h-5.5 print:h-4">
                          <td className="py-1 print:py-0.5 px-1.5 border border-slate-300 text-center text-slate-300 font-mono text-[10px]">
                            {data.movements.length + idx + 1}
                          </td>
                          <td className="py-1 print:py-0.5 px-2 border border-slate-300"></td>
                          <td className="py-1 print:py-0.5 px-3 border border-slate-300"></td>
                          <td className="py-1 print:py-0.5 px-2.5 border border-slate-300"></td>
                          <td className="py-1 print:py-0.5 px-2.5 border border-slate-300"></td>
                          <td className="py-1 print:py-0.5 px-2.5 border border-slate-300"></td>
                        </tr>
                      ))}
                    </tbody>

                    {/* Riga Totale */}
                    <tfoot>
                      <tr className="bg-slate-100 font-bold text-slate-950 text-xs print:text-[10px]">
                        <td colSpan={3} className="py-1.5 print:py-1 px-3 border border-slate-400 text-right uppercase tracking-wider">
                          Totale
                        </td>
                        <td className="py-1.5 print:py-1 px-2.5 border border-slate-400 text-right font-mono text-emerald-800 text-xs print:text-[10px] font-black">
                          {formatCurrency(data.totalIncomesPaid)}
                        </td>
                        <td className="py-1.5 print:py-1 px-2.5 border border-slate-400 text-right font-mono text-rose-700 text-xs print:text-[10px] font-black">
                          {formatCurrency(data.totalExpensesPaid)}
                        </td>
                        <td className="py-1.5 print:py-1 px-2.5 border border-slate-400 text-right font-mono text-xs print:text-[10px] font-black">
                          <span className={data.netBalance >= 0 ? 'text-blue-900' : 'text-red-700'}>
                            {formatCurrency(data.netBalance)}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* FORMATO 2: TABELLE SEPARATE (Entrate sopra, Spese sotto) */}
            {layoutMode === 'separated' && (
              <div className="space-y-4 print:space-y-3">
                {/* Tabella 1: Entrate */}
                <div className="space-y-1">
                  <div className="overflow-x-auto print:overflow-visible">
                    <table className="w-full text-left text-xs print:text-[10px] border border-slate-400 border-collapse">
                      <thead>
                        <tr className="bg-sky-100/70 text-slate-900 font-bold text-[11px] print:text-[9.5px] text-center">
                          <th className="py-1 print:py-0.5 px-1.5 border border-slate-400 w-9">No.</th>
                          <th className="py-1 print:py-0.5 px-2 border border-slate-400 w-22">Data</th>
                          <th className="py-1 print:py-0.5 px-3 border border-slate-400 text-left">Descrizione</th>
                          <th className="py-1 print:py-0.5 px-2.5 border border-slate-400 w-28 text-right">Entrate</th>
                          <th className="py-1 print:py-0.5 px-2.5 border border-slate-400 w-28 text-right">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.incomeMovements.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50/80">
                            <td className="py-1 print:py-0.5 px-1.5 border border-slate-300 text-center text-slate-600 font-mono text-[10px]">
                              {m.no}
                            </td>
                            <td className="py-1 print:py-0.5 px-2 border border-slate-300 text-center font-mono text-slate-700 text-[10.5px] whitespace-nowrap">
                              {formatDateItalian(m.date, false)}
                            </td>
                            <td className="py-1 print:py-0.5 px-3 border border-slate-300 font-medium text-slate-900 text-xs">
                              {m.description}
                            </td>
                            <td className="py-1 print:py-0.5 px-2.5 border border-slate-300 text-right font-mono font-bold text-emerald-800 text-xs whitespace-nowrap">
                              {formatCurrency(m.income)}
                            </td>
                            <td className="py-1 print:py-0.5 px-2.5 border border-slate-300 text-right font-mono font-bold text-slate-900 text-xs whitespace-nowrap">
                              {formatCurrency(m.runningBalance)}
                            </td>
                          </tr>
                        ))}
                        {Array.from({ length: incomeEmptyRowsCount }).map((_, idx) => (
                          <tr key={`empty-inc-${idx}`} className="h-5 print:h-3.5">
                            <td className="py-1 print:py-0.5 px-1.5 border border-slate-300 text-center text-slate-300 font-mono text-[10px]">
                              {data.incomeMovements.length + idx + 1}
                            </td>
                            <td className="py-1 print:py-0.5 px-2 border border-slate-300"></td>
                            <td className="py-1 print:py-0.5 px-3 border border-slate-300"></td>
                            <td className="py-1 print:py-0.5 px-2.5 border border-slate-300"></td>
                            <td className="py-1 print:py-0.5 px-2.5 border border-slate-300"></td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-bold text-slate-950 text-xs print:text-[10px]">
                          <td colSpan={3} className="py-1 print:py-0.5 px-3 border border-slate-400 text-right uppercase tracking-wider">
                            Totale Entrate
                          </td>
                          <td colSpan={2} className="py-1 print:py-0.5 px-2.5 border border-slate-400 text-right font-mono text-emerald-800 text-xs font-black">
                            {formatCurrency(data.totalIncomesPaid)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Tabella 2: Spese */}
                <div className="space-y-1">
                  <div className="overflow-x-auto print:overflow-visible">
                    <table className="w-full text-left text-xs print:text-[10px] border border-slate-400 border-collapse">
                      <thead>
                        <tr className="bg-rose-100/60 text-slate-900 font-bold text-[11px] print:text-[9.5px] text-center">
                          <th className="py-1 print:py-0.5 px-1.5 border border-slate-400 w-9">No.</th>
                          <th className="py-1 print:py-0.5 px-2 border border-slate-400 w-22">Data</th>
                          <th className="py-1 print:py-0.5 px-3 border border-slate-400 text-left">Descrizione</th>
                          <th className="py-1 print:py-0.5 px-2.5 border border-slate-400 w-28 text-right">Spese</th>
                          <th className="py-1 print:py-0.5 px-2.5 border border-slate-400 w-28 text-right">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.expenseMovements.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50/80">
                            <td className="py-1 print:py-0.5 px-1.5 border border-slate-300 text-center text-slate-600 font-mono text-[10px]">
                              {m.no}
                            </td>
                            <td className="py-1 print:py-0.5 px-2 border border-slate-300 text-center font-mono text-slate-700 text-[10.5px] whitespace-nowrap">
                              {formatDateItalian(m.date, false)}
                            </td>
                            <td className="py-1 print:py-0.5 px-3 border border-slate-300 font-medium text-slate-900 text-xs">
                              {m.description}
                            </td>
                            <td className="py-1 print:py-0.5 px-2.5 border border-slate-300 text-right font-mono font-bold text-rose-700 text-xs whitespace-nowrap">
                              {formatCurrency(m.expense)}
                            </td>
                            <td className="py-1 print:py-0.5 px-2.5 border border-slate-300 text-right font-mono font-bold text-slate-900 text-xs whitespace-nowrap">
                              {formatCurrency(m.runningBalance)}
                            </td>
                          </tr>
                        ))}
                        {Array.from({ length: expenseEmptyRowsCount }).map((_, idx) => (
                          <tr key={`empty-exp-${idx}`} className="h-5 print:h-3.5">
                            <td className="py-1 print:py-0.5 px-1.5 border border-slate-300 text-center text-slate-300 font-mono text-[10px]">
                              {data.expenseMovements.length + idx + 1}
                            </td>
                            <td className="py-1 print:py-0.5 px-2 border border-slate-300"></td>
                            <td className="py-1 print:py-0.5 px-3 border border-slate-300"></td>
                            <td className="py-1 print:py-0.5 px-2.5 border border-slate-300"></td>
                            <td className="py-1 print:py-0.5 px-2.5 border border-slate-300"></td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-bold text-slate-950 text-xs print:text-[10px]">
                          <td colSpan={3} className="py-1 print:py-0.5 px-3 border border-slate-400 text-right uppercase tracking-wider">
                            Totale Spese
                          </td>
                          <td colSpan={2} className="py-1 print:py-0.5 px-2.5 border border-slate-400 text-right font-mono text-rose-700 text-xs font-black">
                            {formatCurrency(data.totalExpensesPaid)}
                          </td>
                        </tr>
                        <tr className="bg-slate-200/80 font-black text-slate-950 text-xs print:text-[10px]">
                          <td colSpan={3} className="py-1.5 print:py-1 px-3 border border-slate-400 text-right uppercase tracking-wider">
                            Saldo Netto Finale (Entrate - Spese)
                          </td>
                          <td colSpan={2} className="py-1.5 print:py-1 px-2.5 border border-slate-400 text-right font-mono text-xs font-black">
                            <span className={data.netBalance >= 0 ? 'text-blue-900' : 'text-red-700'}>
                              {formatCurrency(data.netBalance)}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SEZIONE NOTE: Riquadro esattamente come nel modello dell'immagine utente */}
            <div className="note-box-container pt-1.5 print:pt-1">
              <div className="border border-slate-400 rounded-none bg-white">
                <div className="bg-sky-100/70 border-b border-slate-400 py-0.5 text-center font-bold text-xs print:text-[10px] text-slate-900">
                  Note
                </div>
                <div className="p-2 sm:p-2.5 print:p-2 text-xs print:text-[9.5px] text-slate-700 space-y-1.5 min-h-[70px] print:min-h-[52px] flex flex-col justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[11px] print:text-[9.5px]">
                      • Riepilogo Incassi:{' '}
                      <strong>{data.paidBookingsCount} prove musicali</strong> ({formatCurrency(data.paidBookingsTotal)})
                      {data.teacherFeesSaldatoTotal > 0 && (
                        <span> • <strong>Quote lezioni docenti saldate</strong> ({formatCurrency(data.teacherFeesSaldatoTotal)})</span>
                      )}
                      {data.membershipsPaidTotal > 0 && (
                        <span> • <strong>Tesseramenti soci</strong> ({formatCurrency(data.membershipsPaidTotal)})</span>
                      )}
                    </p>
                    {data.totalExpensesPending > 0 ? (
                      <p className="text-[11px] print:text-[9.5px] text-amber-900">
                        • Spese in scadenza / da liquidare:{' '}
                        <strong>{formatCurrency(data.totalExpensesPending)}</strong> ({data.pendingExpensesCount} voci da saldare)
                      </p>
                    ) : (
                      <p className="text-[11px] print:text-[9.5px] text-slate-500">
                        • Nessuna spesa o pendenza in scadenza per il periodo di {data.periodLabel}.
                      </p>
                    )}
                  </div>

                  <div className="pt-2 print:pt-1 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[10.5px] print:text-[9px] text-slate-600">
                    <div>
                      <span>Luogo e Data: </span>
                      <strong className="text-slate-900">{studioInfo?.citta || 'In sede'}, lì {todayStr}</strong>
                    </div>

                    <div className="flex items-center gap-2">
                      <span>Firma del Responsabile:</span>
                      <span className="border-b border-slate-500 min-w-[170px] inline-block"></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            MODAL FOOTER ACTIONS
            ========================================================================= */}
        <div className="p-3 border-t border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 flex items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="text-xs text-slate-500 dark:text-neutral-400 hidden sm:block">
            Layout: <strong>{layoutMode === 'unified' ? 'Registro Unico (Entrate / Spese / Saldo)' : 'Tabelle Separate'}</strong>
          </div>

          <div className="flex items-center gap-2 ml-auto sm:ml-0">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-800 dark:text-neutral-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-blue-600 dark:text-yellow-400" />
              <span>Stampa Scheda</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white dark:bg-yellow-400 dark:hover:bg-yellow-300 dark:text-black text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Scarica PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs border border-blue-500"
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
