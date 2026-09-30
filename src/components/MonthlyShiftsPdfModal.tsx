import React, { useState, useMemo } from 'react';
import {
  X,
  Printer,
  Download,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  CheckCircle2,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { MESI_ITALIANI } from '../utils/dateUtils';
import { compileMonthlyShiftsData, generateMonthlyShiftsPDF } from '../utils/monthlyShiftsPdf';

interface MonthlyShiftsPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMonthStr?: string; // YYYY-MM
}

export const MonthlyShiftsPdfModal: React.FC<MonthlyShiftsPdfModalProps> = ({
  isOpen,
  onClose,
  initialMonthStr,
}) => {
  const { shifts, bookings, staff, studioInfo } = useApp();
  const { isAdmin } = useAuth();

  const [currentYear, setCurrentYear] = useState<number>(() => {
    if (initialMonthStr) {
      return Number(initialMonthStr.split('-')[0]);
    }
    return new Date().getFullYear();
  });

  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(() => {
    if (initialMonthStr) {
      return Number(initialMonthStr.split('-')[1]) - 1;
    }
    return new Date().getMonth();
  });

  const [includeSignatures, setIncludeSignatures] = useState<boolean>(true);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Month navigation
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

  // Compile data for preview
  const data = useMemo(() => {
    return compileMonthlyShiftsData(monthKey, shifts, bookings, staff);
  }, [monthKey, shifts, bookings, staff]);

  // Strict Admin Gate
  if (!isOpen || !isAdmin) return null;

  const handleDownloadPDF = () => {
    generateMonthlyShiftsPDF({
      monthStr: monthKey,
      shifts,
      bookings,
      staffList: staff,
      studioInfo,
      includeSignatures,
    });

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3500);
  };

  const handlePrintPDF = () => {
    generateMonthlyShiftsPDF({
      monthStr: monthKey,
      shifts,
      bookings,
      staffList: staff,
      studioInfo,
      includeSignatures,
      printDirectly: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto print:hidden">
      <div className="bg-[#0c0c0c] rounded-2xl max-w-4xl w-full border border-yellow-500/30 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-yellow-100 my-auto">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-yellow-500/20 bg-neutral-950 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-400 text-black flex items-center justify-center font-black shadow-md shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-yellow-100 tracking-tight">
                  Stampa PDF Turni Stabiliti del Mese
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-yellow-400" />
                  Area Riservata Amministratore
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Genera il documento PDF ufficiale con il resoconto completo di tutti gli operatori e le fasce orarie stabilite.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-yellow-300 rounded-lg hover:bg-neutral-900 transition-colors shrink-0"
            title="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Month Selector Bar */}
        <div className="px-5 py-3 border-b border-yellow-500/15 bg-neutral-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg bg-neutral-950 border border-yellow-500/20 text-yellow-300 hover:bg-yellow-400/20 transition-colors"
              title="Mese precedente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-extrabold text-sm sm:text-base text-yellow-200 uppercase tracking-wide min-w-[170px] text-center">
              {MESI_ITALIANI[currentMonthIndex]} {currentYear}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg bg-neutral-950 border border-yellow-500/20 text-yellow-300 hover:bg-yellow-400/20 transition-colors"
              title="Mese successivo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleCurrentMonth}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-neutral-950 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-400/20 transition-colors ml-1"
            >
              Oggi
            </button>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-xs text-yellow-200/90 select-none">
            <input
              type="checkbox"
              checked={includeSignatures}
              onChange={(e) => setIncludeSignatures(e.target.checked)}
              className="w-4 h-4 rounded border-yellow-500/40 text-yellow-400 focus:ring-yellow-400 bg-neutral-900 cursor-pointer"
            />
            <span>Includi box firme e convalida amministrazione nel PDF</span>
          </label>
        </div>

        {/* Download Feedback Alert */}
        {downloadSuccess && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>PDF generato e scaricato con successo! Controlla la cartella Download.</span>
          </div>
        )}

        {/* Scrollable Content Body (Preview of the Report) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-neutral-950 border border-yellow-500/20">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                Giorni Feriali
              </span>
              <span className="text-base font-black text-yellow-200 mt-0.5 block font-mono">
                {data.totalWeekdays} Giorni
              </span>
              <span className="text-[10px] text-neutral-500 block">Lun &ndash; Ven di {data.monthName}</span>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950 border border-yellow-500/20">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                Turni Assegnati
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-base font-black text-yellow-300 font-mono">
                  {data.totalAssignedShifts}
                </span>
                <span className="text-xs text-neutral-400 font-mono">/ {data.totalShiftsSlots}</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold block">
                {data.unassignedShifts === 0 ? '✓ 100% Coperti' : `⚠️ ${data.unassignedShifts} da assegnare`}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950 border border-yellow-500/20">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                Ore Totali Presidio
              </span>
              <span className="text-base font-black text-yellow-400 mt-0.5 block font-mono">
                {data.totalOperatingHours}h
              </span>
              <span className="text-[10px] text-neutral-500 block">Inclusi extra dinamici</span>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950 border border-yellow-500/20">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                Operatori Attivi
              </span>
              <span className="text-base font-black text-yellow-200 mt-0.5 block font-mono">
                {data.operatorStats.length}
              </span>
              <span className="text-[10px] text-neutral-500 block">In organico presidio</span>
            </div>
          </div>

          {/* Section 1: Quadro Completo Operatori */}
          <div className="p-4 rounded-xl bg-neutral-950 border border-yellow-500/20 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-yellow-400" />
                <h3 className="font-extrabold text-xs sm:text-sm text-yellow-100 uppercase tracking-wider">
                  1. Resoconto Completo Tutti Operatori (Carico & Equità Mese)
                </h3>
              </div>
              <span className="text-[10px] text-neutral-400 italic">
                Incluso nel report PDF
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-yellow-500/20 text-neutral-400">
                    <th className="py-2 px-2.5 font-semibold">Operatore</th>
                    <th className="py-2 px-2.5 font-semibold text-center">1° Turno (17-20)</th>
                    <th className="py-2 px-2.5 font-semibold text-center">2° Turno (20-23)</th>
                    <th className="py-2 px-2.5 font-semibold text-center">Totale Turni</th>
                    <th className="py-2 px-2.5 font-semibold text-center">Ore Totali</th>
                    <th className="py-2 px-2.5 font-semibold text-center">Quota % Carico</th>
                    <th className="py-2 px-2.5 font-semibold text-right">Ferie / Indisp.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {data.operatorStats.map((stat) => (
                    <tr key={stat.operator.id} className="hover:bg-neutral-900/60 transition-colors">
                      <td className="py-2 px-2.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px] text-black shrink-0"
                            style={{ backgroundColor: stat.operator.coloreBadge }}
                          >
                            {stat.operator.nome[0]}
                          </div>
                          <div>
                            <span className="font-bold text-yellow-100 block">
                              {stat.operator.nome} {stat.operator.cognome}
                            </span>
                            <span className="text-[9.5px] text-neutral-400 block">
                              {stat.operator.ruolo === 'entrambi' ? 'Operat. & Insegn.' : 'Operatore Sala'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2.5 text-center font-mono text-neutral-300">
                        {stat.shift1Count} turni
                      </td>
                      <td className="py-2 px-2.5 text-center font-mono text-neutral-300">
                        {stat.shift2Count} turni
                      </td>
                      <td className="py-2 px-2.5 text-center font-mono font-bold text-yellow-300">
                        {stat.totalShiftsCount}
                      </td>
                      <td className="py-2 px-2.5 text-center font-mono font-black text-yellow-400">
                        {stat.totalHours}h
                      </td>
                      <td className="py-2 px-2.5 text-center">
                        <div className="flex items-center gap-1.5 justify-center">
                          <span className="font-mono font-bold text-indigo-300 text-xs">
                            {stat.percentage}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-[11px]">
                        {stat.vacationDaysCount > 0 ? (
                          <span className="text-rose-400 font-semibold">
                            🏖️ {stat.vacationDaysCount} gg ferie
                          </span>
                        ) : (
                          <span className="text-neutral-500">0 gg</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Anteprima Calendario Cronologico Turni del Mese (Schema a 2 Colonne Bilanciate) */}
          <div className="p-4 rounded-xl bg-neutral-950 border border-yellow-500/20 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-400" />
                <h3 className="font-extrabold text-xs sm:text-sm text-yellow-100 uppercase tracking-wider">
                  2. Tabellone Schematizzato Turni Lun&ndash;Ven ({data.dayRows.length} Giornate)
                </h3>
              </div>
              <span className="text-[11px] font-bold text-yellow-300 bg-yellow-400/10 px-2.5 py-0.5 rounded border border-yellow-500/30">
                1 Pagina Landscape A4
              </span>
            </div>

            {/* Layout a 2 Colonne (Giorni 1-15 e 16-31) */}
            {(() => {
              const half = Math.ceil(data.dayRows.length / 2);
              const leftHalf = data.dayRows.slice(0, half);
              const rightHalf = data.dayRows.slice(half);

              const renderTableHalf = (rows: typeof leftHalf, title: string) => (
                <div className="border border-yellow-500/20 rounded-lg overflow-hidden">
                  <div className="bg-neutral-900/80 px-2.5 py-1.5 border-b border-yellow-500/20 flex items-center justify-between text-[11px] font-bold text-yellow-200">
                    <span>{title}</span>
                    <span className="text-[10px] text-neutral-400 font-mono font-normal">
                      {rows.length} giorni
                    </span>
                  </div>
                  <table className="w-full text-left text-[11.5px]">
                    <thead className="bg-neutral-950 text-neutral-400 border-b border-yellow-500/15">
                      <tr>
                        <th className="py-1.5 px-2 font-semibold w-24">Giorno</th>
                        <th className="py-1.5 px-2 font-semibold">1° Turno (17-20)</th>
                        <th className="py-1.5 px-2 font-semibold">2° Turno (20-23)</th>
                        <th className="py-1.5 px-2 font-semibold text-right w-12">Ore</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900/80">
                      {rows.map((row) => (
                        <tr key={row.dateStr} className="hover:bg-neutral-900/50 transition-colors">
                          <td className="py-1.5 px-2 font-bold text-yellow-200 whitespace-nowrap">
                            {row.dayName} {String(row.dayNum).padStart(2, '0')}/{String(data.monthIdx + 1).padStart(2, '0')}
                          </td>
                          <td className="py-1.5 px-2">
                            <div className="text-[11px]">
                              <span className="font-mono text-yellow-400/80 text-[10px] block">
                                {row.shift1.oraInizio}-{row.shift1.oraFine}
                              </span>
                              <span
                                className={
                                  row.shift1.operatoreNome
                                    ? 'text-yellow-100 font-bold truncate block'
                                    : 'text-rose-400 font-semibold italic text-[10px] block'
                                }
                              >
                                {row.shift1.operatoreNome || '⚠️ Libero'}
                              </span>
                            </div>
                          </td>
                          <td className="py-1.5 px-2">
                            <div className="text-[11px]">
                              <span className="font-mono text-yellow-400/80 text-[10px] block">
                                {row.shift2.oraInizio}-{row.shift2.oraFine}
                              </span>
                              <span
                                className={
                                  row.shift2.operatoreNome
                                    ? 'text-yellow-100 font-bold truncate block'
                                    : 'text-rose-400 font-semibold italic text-[10px] block'
                                }
                              >
                                {row.shift2.operatoreNome || '⚠️ Libero'}
                              </span>
                            </div>
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono font-bold text-yellow-400 text-xs">
                            {row.totalDayHours}h
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );

              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                  {renderTableHalf(leftHalf, 'Prima Metà Mese')}
                  {renderTableHalf(rightHalf, 'Seconda Metà Mese')}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-4 border-t border-yellow-500/25 bg-neutral-950 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-neutral-400 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-yellow-400" />
            <span>
              Documento schematico compatto &bull; <strong>Rigorosamente 1 Sola Pagina Landscape</strong>
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Chiudi
            </button>
            <button
              type="button"
              onClick={handlePrintPDF}
              className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-yellow-300 border border-yellow-500/40 text-xs font-bold shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
              title="Invia direttamente alla stampante il PDF del mese configurato su 1 pagina A4"
            >
              <Printer className="w-4 h-4 text-yellow-400" />
              <span>Stampa PDF (1 Pagina)</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="px-5 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black shadow-lg transition-colors flex items-center gap-2 cursor-pointer"
              title="Scarica il documento PDF ufficiale configurato per 1 singola pagina"
            >
              <Download className="w-4 h-4" />
              <span>Scarica PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
