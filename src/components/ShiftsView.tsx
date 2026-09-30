import React, { useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Wand2,
  Copy,
  Printer,
  Edit2,
  CalendarCheck,
  Building2,
  Check,
  Table as TableIcon,
  LayoutGrid,
  Palmtree,
  Briefcase,
  ShieldCheck,
  Download,
  FileText,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { DailyShiftComputed, StaffMember, WorkShift } from '../types';
import { formatDateToISO, MESI_ITALIANI, parseISODate } from '../utils/dateUtils';
import {
  BASE_SHIFT_1_START,
  BASE_SHIFT_1_END,
  BASE_SHIFT_2_START,
  BASE_SHIFT_2_END,
  computeDailyShifts,
  getMonthlyWorkloadReport,
} from '../utils/shiftUtils';
import { ShiftQuickModal } from './ShiftQuickModal';
import { OperatorMonthlyScheduleModal } from './OperatorMonthlyScheduleModal';
import { MonthlyShiftsPdfModal } from './MonthlyShiftsPdfModal';
import { WeeklyShiftsPrintModal } from './WeeklyShiftsPrintModal';
import { printWeeklyShiftsDirectly, generateWeeklyShiftsPDF } from '../utils/weeklyShiftsPdf';

const GIORNI_LUN_VEN = [
  { index: 1, name: 'Lunedì', short: 'Lun' },
  { index: 2, name: 'Martedì', short: 'Mar' },
  { index: 3, name: 'Mercoledì', short: 'Mer' },
  { index: 4, name: 'Giovedì', short: 'Gio' },
  { index: 5, name: 'Venerdì', short: 'Ven' },
];

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export const ShiftsView: React.FC = () => {
  const {
    staff,
    bookings,
    shifts,
    studioInfo,
    assignOperatorToShift,
    autoAssignWeeklyShiftsAction,
    autoAssignMonthlyShiftsAction,
  } = useApp();
  const { isAdmin } = useAuth();

  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()));
  const [selectedShiftForEdit, setSelectedShiftForEdit] = useState<DailyShiftComputed | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [selectedOpForMonthlySchedule, setSelectedOpForMonthlySchedule] = useState<StaffMember | null>(null);
  const [isMonthlyPdfModalOpen, setIsMonthlyPdfModalOpen] = useState(false);
  const [isWeeklyPrintModalOpen, setIsWeeklyPrintModalOpen] = useState(false);
  const [viewFormat, setViewFormat] = useState<'table' | 'cards'>('table');

  // Calcola i 5 giorni della settimana selezionata (Lunedì - Venerdì)
  const weekDays = [0, 1, 2, 3, 4].map((offset) => {
    const d = new Date(currentMonday);
    d.setDate(currentMonday.getDate() + offset);
    return formatDateToISO(d);
  });

  const weekFriday = new Date(currentMonday);
  weekFriday.setDate(currentMonday.getDate() + 4);

  const activeStaff = staff.filter(
    (s) => s.attivo && (s.ruolo === 'operatore' || s.ruolo === 'entrambi')
  );

  // Navigazione settimane
  const handlePrevWeek = () => {
    const prev = new Date(currentMonday);
    prev.setDate(currentMonday.getDate() - 7);
    setCurrentMonday(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentMonday);
    next.setDate(currentMonday.getDate() + 7);
    setCurrentMonday(next);
  };

  const handleCurrentWeek = () => {
    setCurrentMonday(getMonday(new Date()));
  };

  // Esegui auto-assegnazione intelligente per la settimana
  const handleAutoAssignWeek = () => {
    const res = autoAssignWeeklyShiftsAction(weekDays);
    setFeedbackMessage(
      `Assegnazione completata con successo! ${res.assignedCount} turni coperti rispettando le disponibilità e il bilanciamento equo.`
    );
    setTimeout(() => setFeedbackMessage(null), 4500);
  };

  const currentMonthKey = `${currentMonday.getFullYear()}-${String(currentMonday.getMonth() + 1).padStart(2, '0')}`;

  // Esegui auto-assegnazione intelligente per l'intero mese con bilanciamento equo
  const handleAutoAssignMonth = () => {
    const res = autoAssignMonthlyShiftsAction(currentMonthKey, false);
    setFeedbackMessage(
      `Auto-assegnazione mese di ${MESI_ITALIANI[currentMonday.getMonth()]} ${currentMonday.getFullYear()} completata! ${res.assignedCount} turni distribuiti equamente.`
    );
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // Copia turni dalla settimana precedente
  const handleCopyFromPreviousWeek = () => {
    const prevWeekDays = weekDays.map((iso) => {
      const d = parseISODate(iso);
      d.setDate(d.getDate() - 7);
      return formatDateToISO(d);
    });

    let copiedCount = 0;
    prevWeekDays.forEach((prevIso, idx) => {
      const targetIso = weekDays[idx];
      [1, 2].forEach((tNum) => {
        const prevShift = shifts.find((s) => s.data === prevIso && s.turnoNumero === tNum);
        if (prevShift && prevShift.operatoreId) {
          assignOperatorToShift(targetIso, tNum as 1 | 2, prevShift.operatoreId, true);
          copiedCount++;
        }
      });
    });

    setFeedbackMessage(`Copiati ${copiedCount} turni dalla settimana precedente.`);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Calcola tutti i turni della settimana
  const computedWeekShifts = weekDays.map((dateStr) => {
    const dayBookings = bookings.filter((b) => b.data === dateStr);
    const [shift1, shift2] = computeDailyShifts(dateStr, dayBookings, shifts, staff);
    return {
      dateStr,
      dayBookings,
      shift1,
      shift2,
    };
  });

  // Statistiche di copertura settimanale
  const totalWeekShifts = 10; // 5 giorni * 2 turni
  let coveredWeekShifts = 0;
  let totalOperatingHoursWeek = 0;
  computedWeekShifts.forEach(({ shift1, shift2 }) => {
    if (shift1.operatoreId) coveredWeekShifts++;
    if (shift2.operatoreId) coveredWeekShifts++;
    totalOperatingHoursWeek += shift1.durataOre + shift2.durataOre;
  });
  const unassignedShiftsCount = totalWeekShifts - coveredWeekShifts;

  const handleOpenEdit = (shiftComputed: DailyShiftComputed) => {
    if (!isAdmin) return;
    setSelectedShiftForEdit(shiftComputed);
    setIsModalOpen(true);
  };

  // Stampa al volo da browser tramite iframe isolato (100% garantita, mai fogli bianchi né neri)
  const handlePrintWeekly = () => {
    printWeeklyShiftsDirectly({
      currentMonday,
      weekFriday,
      computedWeekShifts,
      studioInfo,
      staff,
      includeSignatures: true,
    });
  };

  const handlePrint = () => {
    handlePrintWeekly();
  };

  // Esporta i turni della settimana in formato Excel CSV compatibile
  const handleExportWeeklyShiftsExcel = () => {
    const escapeCsv = (val?: string | number) => {
      if (val === undefined || val === null || val === '') return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    };

    const headers = [
      'Giorno',
      'Data',
      '1° Turno (Fascia Pomeridiana)',
      '1° Turno - Ore',
      '1° Turno - Operatore',
      '2° Turno (Fascia Serale)',
      '2° Turno - Ore',
      '2° Turno - Operatore',
      'Ore Totali Presidio',
      'Stato Copertura',
    ];

    const rows = computedWeekShifts.map(({ dateStr, shift1, shift2 }, idx) => {
      const dayConfig = GIORNI_LUN_VEN[idx];
      const dObj = parseISODate(dateStr);
      const dayHours = Math.round((shift1.durataOre + shift2.durataOre) * 10) / 10;
      const isCovered = !!(shift1.operatoreId && shift2.operatoreId);

      return [
        escapeCsv(dayConfig.name),
        escapeCsv(`${dObj.getDate()}/${dObj.getMonth() + 1}/${dObj.getFullYear()}`),
        escapeCsv(`${shift1.oraInizio} - ${shift1.oraFine}`),
        escapeCsv(shift1.durataOre),
        escapeCsv(shift1.operatoreNome || 'Da Assegnare'),
        escapeCsv(`${shift2.oraInizio} - ${shift2.oraFine}`),
        escapeCsv(shift2.durataOre),
        escapeCsv(shift2.operatoreNome || 'Da Assegnare'),
        escapeCsv(dayHours),
        escapeCsv(isCovered ? 'Coperto' : 'Incompleto'),
      ].join(';');
    });

    const csvContent = `${headers.join(';')}\n${rows.join('\n')}`;
    const filename = `turni_settimana_${weekDays[0]}_al_${weekDays[4]}.csv`;

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const periodLabelWeek = `Settimana dal Lunedì ${currentMonday.getDate()} a Venerdì ${weekFriday.getDate()} ${MESI_ITALIANI[weekFriday.getMonth()]} ${weekFriday.getFullYear()}`;

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      
      {/* ── 1. TESTATA: SCHEMA RIEPILOGATIVO SETTIMANALE DEI TURNI ── */}
      <div className="bg-[#0e0e0e] rounded-2xl p-4 sm:p-6 border border-yellow-500/25 shadow-xl space-y-4 print:hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1 max-w-3xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="w-8 h-8 rounded-lg bg-yellow-400 text-black flex items-center justify-center font-black text-sm shadow-sm">
                <Clock className="w-4 h-4 stroke-[2.5]" />
              </span>
              <h2 className="text-lg sm:text-xl font-black text-yellow-100 tracking-tight">
                Schema Riepilogativo Settimanale dei Turni
              </h2>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-500/30">
                Lunedì &ndash; Venerdì
              </span>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed mt-1">
              Visualizzazione tabellare chiara e schematica dei presidi settimanali con le fasce orarie stabilite:{' '}
              <strong className="text-yellow-400">1° Turno (17:00 &ndash; 20:00)</strong> e{' '}
              <strong className="text-yellow-400">2° Turno (20:00 &ndash; 23:00)</strong>, con adattamento orario automatico in base alle prenotazioni serali.
            </p>
          </div>

          {/* Azioni Amministrazione & Stampa */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={handleAutoAssignWeek}
                  className="px-4 py-2.5 min-h-[44px] bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation touch-active"
                  title="Autoassegna i turni della settimana combinando lavoro primario, ferie ed equità delle ore"
                >
                  <Wand2 className="w-4 h-4 stroke-[2.5]" />
                  <span>Auto-Assegna Settimana</span>
                </button>

                <button
                  type="button"
                  onClick={handleAutoAssignMonth}
                  className="px-3.5 py-2.5 min-h-[44px] bg-neutral-900 hover:bg-neutral-800 text-yellow-300 border border-yellow-500/40 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation touch-active"
                  title="Autoassegna tutti i turni del mese corrente con rotazione equa"
                >
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <span>Auto-Assegna Mese</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyFromPreviousWeek}
                  className="px-3.5 py-2.5 min-h-[44px] bg-neutral-900 hover:bg-neutral-800 text-yellow-200 border border-yellow-500/30 font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation touch-active"
                  title="Copia gli operatori assegnati nella settimana precedente"
                >
                  <Copy className="w-4 h-4 text-yellow-400" />
                  <span className="hidden sm:inline">Copia Prec.</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsMonthlyPdfModalOpen(true)}
                  className="px-3.5 py-2.5 min-h-[44px] bg-neutral-900 hover:bg-neutral-800 text-yellow-300 border border-yellow-500/40 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation touch-active"
                  title="Esporta il documento PDF riassuntivo del mese (1 Pagina Landscape)"
                >
                  <Download className="w-4 h-4 text-yellow-400" />
                  <span>PDF Mese</span>
                </button>
              </>
            )}

            {/* Stampa al Volo Settimana (1 Foglio A4) */}
            <button
              type="button"
              onClick={handlePrintWeekly}
              className="px-4 py-2.5 min-h-[44px] bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation touch-active"
              title="Stampa al volo lo schema dei turni di questa settimana su 1 singolo foglio A4"
            >
              <Printer className="w-4 h-4 stroke-[2.5]" />
              <span>Stampa Settimana (1 Foglio)</span>
            </button>

            {/* Anteprima Completa & Download PDF Settimana */}
            <button
              type="button"
              onClick={() => setIsWeeklyPrintModalOpen(true)}
              className="px-3.5 py-2.5 min-h-[44px] bg-neutral-900 hover:bg-neutral-800 text-yellow-300 border border-yellow-500/40 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation touch-active"
              title="Anteprima a schermo con opzioni firme e download PDF"
            >
              <FileText className="w-4 h-4 text-yellow-400" />
              <span>Anteprima &amp; PDF</span>
            </button>

            {/* Scarica File Excel (.csv) dei turni settimanali */}
            <button
              type="button"
              onClick={handleExportWeeklyShiftsExcel}
              className="px-3.5 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation touch-active"
              title="Scarica lo schema dei turni settimanali in file Excel (.csv)"
            >
              <Download className="w-4 h-4" />
              <span>Scarica Excel</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        {/* ── 2. BARRA NAVIGAZIONE SETTIMANA & SELETTORE LAYOUT ── */}
        <div className="pt-3 border-t border-yellow-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePrevWeek}
              className="w-11 h-11 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-yellow-400 border border-yellow-500/25 flex items-center justify-center transition-all cursor-pointer touch-manipulation touch-active"
              title="Settimana precedente"
              aria-label="Settimana precedente"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 sm:py-2.5 min-h-[44px] rounded-xl bg-neutral-950 border border-yellow-500/25">
              <Calendar className="w-4 h-4 text-yellow-400 shrink-0" />
              <span className="font-bold text-xs sm:text-sm text-yellow-100 whitespace-nowrap">
                <span className="sm:hidden">
                  {currentMonday.getDate()} {MESI_ITALIANI[currentMonday.getMonth()].substring(0, 3)} &ndash; {weekFriday.getDate()} {MESI_ITALIANI[weekFriday.getMonth()].substring(0, 3)}
                </span>
                <span className="hidden sm:inline">
                  Lun {currentMonday.getDate()} {MESI_ITALIANI[currentMonday.getMonth()]} &ndash; Ven{' '}
                  {weekFriday.getDate()} {MESI_ITALIANI[weekFriday.getMonth()]}{' '}
                  {weekFriday.getFullYear()}
                </span>
              </span>
            </div>

            <button
              onClick={handleNextWeek}
              className="w-11 h-11 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-yellow-400 border border-yellow-500/25 flex items-center justify-center transition-all cursor-pointer touch-manipulation touch-active"
              title="Settimana successiva"
              aria-label="Settimana successiva"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <button
              onClick={handleCurrentWeek}
              className="px-3.5 py-2.5 min-h-[44px] rounded-xl bg-neutral-900 hover:bg-neutral-800 text-yellow-300 text-xs font-bold border border-yellow-500/25 transition-all cursor-pointer touch-manipulation touch-active"
            >
              Oggi
            </button>
          </div>

          {/* Toggle Formato Tabella / Lista & Pill Copertura */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-neutral-950 p-1 rounded-xl border border-yellow-500/25">
              <button
                type="button"
                onClick={() => setViewFormat('table')}
                className={`px-3.5 py-2 min-h-[40px] text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer touch-manipulation touch-active ${
                  viewFormat === 'table'
                    ? 'bg-yellow-400 text-black shadow-xs font-black'
                    : 'text-neutral-400 hover:text-yellow-300'
                }`}
              >
                <TableIcon className="w-4 h-4" />
                <span>Vista Tabella</span>
              </button>
              <button
                type="button"
                onClick={() => setViewFormat('cards')}
                className={`px-3.5 py-2 min-h-[40px] text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer touch-manipulation touch-active ${
                  viewFormat === 'cards'
                    ? 'bg-yellow-400 text-black shadow-xs font-black'
                    : 'text-neutral-400 hover:text-yellow-300'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Vista Schede</span>
              </button>
            </div>

            {/* Pillola Copertura */}
            <div className="flex items-center gap-2 text-xs">
              {unassignedShiftsCount === 0 ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 10/10 Turni Coperti
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-xs">
                  <AlertTriangle className="w-3.5 h-3.5" /> {unassignedShiftsCount} Turni da Assegnare
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. VISUALIZZAZIONE SETTIMANALE: TABELLA O LISTA (SOLO A SCHERMO) ── */}
      <div className="print:hidden">
        {viewFormat === 'table' ? (
          /* VISTA TABELLA SCHEMATICA (PRINCIPALE) */
          <div className="bg-[#0c0c0c] rounded-2xl border border-yellow-500/25 shadow-xl overflow-hidden">
          
          {/* Header visibile a schermo */}
          <div className="px-5 py-3.5 bg-neutral-950 border-b border-yellow-500/20 flex items-center justify-between gap-3 flex-wrap print:hidden">
            <div className="flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-yellow-400" />
              <h3 className="font-black text-sm text-yellow-100 uppercase tracking-wider">
                Tabella Riepilogo Settimanale &bull; Orari e Operatori Assegnati
              </h3>
            </div>
            <span className="text-xs text-neutral-400 font-mono">
              Ore totali settimana: <strong className="text-yellow-400">{Math.round(totalOperatingHoursWeek * 10) / 10}h</strong>
            </span>
          </div>

          {/* VISTA DESKTOP/TABLET: TABELLA ESTESA A 5 COLONNE (md in su) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-950 border-b border-yellow-500/25 text-neutral-300 text-[11px] uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-extrabold w-44">Giorno &amp; Data</th>
                  <th className="py-3.5 px-4 font-extrabold">1° Turno (Fascia Pomeridiana)</th>
                  <th className="py-3.5 px-4 font-extrabold">2° Turno (Fascia Serale)</th>
                  <th className="py-3.5 px-3 font-extrabold text-center w-24">Ore Giorno</th>
                  <th className="py-3.5 px-4 font-extrabold text-right w-32">Stato Copertura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {computedWeekShifts.map(({ dateStr, dayBookings, shift1, shift2 }, dayIdx) => {
                  const dayConfig = GIORNI_LUN_VEN[dayIdx];
                  const dObj = parseISODate(dateStr);
                  const isToday = formatDateToISO(new Date()) === dateStr;
                  const dayHours = Math.round((shift1.durataOre + shift2.durataOre) * 10) / 10;
                  const isFullyCovered = !!(shift1.operatoreId && shift2.operatoreId);

                  return (
                    <tr
                      key={dateStr}
                      className={`transition-colors ${
                        isToday
                          ? 'bg-yellow-500/10 hover:bg-yellow-500/15'
                          : 'hover:bg-neutral-950/70'
                      }`}
                    >
                      {/* Colonna 1: Giorno e Numero Ben Visibile */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {/* Numero del giorno in evidenza */}
                          <div
                            className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black shrink-0 border ${
                              isToday
                                ? 'bg-yellow-400 text-black border-yellow-400 shadow-md ring-2 ring-yellow-400/30'
                                : 'bg-neutral-950 text-yellow-200 border-yellow-500/30'
                            }`}
                          >
                            <span className="text-base sm:text-lg font-black leading-none">
                              {dObj.getDate()}
                            </span>
                            <span className="text-[9px] uppercase tracking-wider font-extrabold opacity-80 mt-0.5">
                              {dayConfig.short}
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-sm text-yellow-100">
                                {dayConfig.name}
                              </span>
                              {isToday && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-yellow-400 text-black uppercase">
                                  Oggi
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-neutral-400 block font-mono">
                              {dObj.getDate()} {MESI_ITALIANI[dObj.getMonth()]} {dObj.getFullYear()}
                            </span>
                            {dayBookings.length > 0 && (
                              <span className="text-[10px] text-yellow-500/80 block mt-0.5">
                                {dayBookings.length} {dayBookings.length === 1 ? 'prenotazione' : 'prenotazioni'}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Colonna 2: 1° Turno (Fascia Oraria + Operatore Assegnato) */}
                      <td className="py-3.5 px-4">
                        <div
                          onClick={() => handleOpenEdit(shift1)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                            isAdmin ? 'cursor-pointer hover:border-yellow-400' : ''
                          } ${
                            shift1.operatoreId
                              ? 'bg-neutral-950 border-yellow-500/20'
                              : 'bg-amber-500/[0.08] border-amber-500/30'
                          }`}
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-yellow-400/20 text-yellow-300 border border-yellow-500/30">
                                1° Turno
                              </span>
                              <span className="font-mono font-bold text-yellow-300 text-xs">
                                {shift1.oraInizio} &ndash; {shift1.oraFine}
                              </span>
                              <span className="text-[10px] text-neutral-400 font-mono">
                                ({shift1.durataOre}h)
                              </span>
                              {shift1.isAdapted && (
                                <span
                                  className="text-[9px] font-bold text-amber-300 bg-amber-400/15 border border-amber-500/30 px-1 rounded"
                                  title={shift1.adaptationReason}
                                >
                                  +{shift1.minutiExtra}m extra
                                </span>
                              )}
                            </div>

                            {/* Operatore Assegnato */}
                            <div className="flex items-center gap-2 pt-0.5">
                              {shift1.operatoreNome ? (
                                <>
                                  <div
                                    className="w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px] text-black shrink-0"
                                    style={{ backgroundColor: shift1.operatoreBadgeColor || '#eab308' }}
                                  >
                                    {shift1.operatoreNome[0]}
                                  </div>
                                  <span className="font-bold text-yellow-100 text-xs truncate">
                                    {shift1.operatoreNome}
                                  </span>
                                </>
                              ) : (
                                <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1 italic">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                  Da Assegnare
                                </span>
                              )}
                            </div>
                          </div>

                          {isAdmin && (
                            <button
                              type="button"
                              className="text-neutral-500 hover:text-yellow-400 p-1 rounded hover:bg-neutral-900 transition-colors shrink-0"
                              title="Modifica o assegna operatore"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Colonna 3: 2° Turno (Fascia Oraria + Operatore Assegnato) */}
                      <td className="py-3.5 px-4">
                        <div
                          onClick={() => handleOpenEdit(shift2)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                            isAdmin ? 'cursor-pointer hover:border-yellow-400' : ''
                          } ${
                            shift2.operatoreId
                              ? 'bg-neutral-950 border-yellow-500/20'
                              : 'bg-amber-500/[0.08] border-amber-500/30'
                          }`}
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-yellow-400/20 text-yellow-300 border border-yellow-500/30">
                                2° Turno
                              </span>
                              <span className="font-mono font-bold text-yellow-300 text-xs">
                                {shift2.oraInizio} &ndash; {shift2.oraFine}
                              </span>
                              <span className="text-[10px] text-neutral-400 font-mono">
                                ({shift2.durataOre}h)
                              </span>
                              {shift2.isAdapted && (
                                <span
                                  className="text-[9px] font-bold text-amber-300 bg-amber-400/15 border border-amber-500/30 px-1 rounded"
                                  title={shift2.adaptationReason}
                                >
                                  +{shift2.minutiExtra}m extra
                                </span>
                              )}
                            </div>

                            {/* Operatore Assegnato */}
                            <div className="flex items-center gap-2 pt-0.5">
                              {shift2.operatoreNome ? (
                                <>
                                  <div
                                    className="w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px] text-black shrink-0"
                                    style={{ backgroundColor: shift2.operatoreBadgeColor || '#eab308' }}
                                  >
                                    {shift2.operatoreNome[0]}
                                  </div>
                                  <span className="font-bold text-yellow-100 text-xs truncate">
                                    {shift2.operatoreNome}
                                  </span>
                                </>
                              ) : (
                                <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1 italic">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                  Da Assegnare
                                </span>
                              )}
                            </div>
                          </div>

                          {isAdmin && (
                            <button
                              type="button"
                              className="text-neutral-500 hover:text-yellow-400 p-1 rounded hover:bg-neutral-900 transition-colors shrink-0"
                              title="Modifica o assegna operatore"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Colonna 4: Ore Totali Giorno */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="font-mono font-black text-sm text-yellow-400 block">
                          {dayHours}h
                        </span>
                        <span className="text-[9.5px] text-neutral-500 block">2 turni</span>
                      </td>

                      {/* Colonna 5: Stato Copertura */}
                      <td className="py-3.5 px-4 text-right">
                        {isFullyCovered ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Coperto
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            Incompleto
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-neutral-950 font-black border-t-2 border-yellow-500/30 text-yellow-200 text-xs">
                  <td className="py-3 px-4 uppercase tracking-wider font-extrabold text-[11px]">
                    Totale Settimana
                  </td>
                  <td colSpan={2} className="py-3 px-4 text-neutral-400 font-normal">
                    10 turni pianificati Lunedì &ndash; Venerdì
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-black text-yellow-400 text-sm">
                    {Math.round(totalOperatingHoursWeek * 10) / 10}h
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-yellow-300">
                    {coveredWeekShifts}/10 Coperti
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* VISTA SMARTPHONE (Zero scroll orizzontale: tutto perfettamente adattato a larghezza 100%) */}
          <div className="block md:hidden divide-y divide-neutral-900">
            {computedWeekShifts.map(({ dateStr, dayBookings, shift1, shift2 }, dayIdx) => {
              const dayConfig = GIORNI_LUN_VEN[dayIdx];
              const dObj = parseISODate(dateStr);
              const isToday = formatDateToISO(new Date()) === dateStr;
              const dayHours = Math.round((shift1.durataOre + shift2.durataOre) * 10) / 10;
              const isFullyCovered = !!(shift1.operatoreId && shift2.operatoreId);

              return (
                <div
                  key={dateStr}
                  className={`p-3 space-y-2.5 transition-colors ${
                    isToday ? 'bg-yellow-500/10' : 'bg-transparent'
                  }`}
                >
                  {/* Intestazione Giorno Smartphone */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center font-black shrink-0 border text-center ${
                          isToday
                            ? 'bg-yellow-400 text-black border-yellow-400 shadow-xs'
                            : 'bg-neutral-950 text-yellow-200 border-yellow-500/30'
                        }`}
                      >
                        <span className="text-sm font-black leading-none">{dObj.getDate()}</span>
                        <span className="text-[8px] uppercase tracking-wider font-extrabold opacity-80 mt-0.5">
                          {dayConfig.short}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-xs sm:text-sm text-yellow-100 truncate">
                            {dayConfig.name} {dObj.getDate()} {MESI_ITALIANI[dObj.getMonth()]}
                          </span>
                          {isToday && (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-yellow-400 text-black uppercase">
                              Oggi
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-neutral-400 font-mono block">
                          {dayHours}h totali {dayBookings.length > 0 && `• ${dayBookings.length} prenotazioni`}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isFullyCovered ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold text-[10px]">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Coperto
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold text-[10px]">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          Da Assegnare
                        </span>
                      )}
                    </div>
                  </div>

                  {/* I due turni incolonnati verticalmente per smartphone */}
                  <div className="space-y-2">
                    {/* 1° Turno */}
                    <div
                      onClick={() => handleOpenEdit(shift1)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                        shift1.operatoreId
                          ? 'bg-neutral-950 border-yellow-500/20 active:border-yellow-400'
                          : 'bg-amber-500/[0.08] border-amber-500/30 active:border-amber-400'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-yellow-400/20 text-yellow-300 border border-yellow-500/30">
                            1° Turno
                          </span>
                          <span className="font-mono font-bold text-yellow-300 text-xs">
                            {shift1.oraInizio} &ndash; {shift1.oraFine}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            ({shift1.durataOre}h)
                          </span>
                          {shift1.isAdapted && (
                            <span className="text-[8px] font-bold text-amber-300 bg-amber-400/15 border border-amber-500/30 px-1 rounded">
                              +{shift1.minutiExtra}m extra
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-0.5">
                          {shift1.operatoreNome ? (
                            <>
                              <div
                                className="w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px] text-black shrink-0"
                                style={{ backgroundColor: shift1.operatoreBadgeColor || '#eab308' }}
                              >
                                {shift1.operatoreNome[0]}
                              </div>
                              <span className="font-bold text-yellow-100 text-xs truncate">
                                {shift1.operatoreNome}
                              </span>
                            </>
                          ) : (
                            <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1 italic">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              Da Assegnare
                            </span>
                          )}
                        </div>
                      </div>

                      {isAdmin && (
                        <div className="text-neutral-500 hover:text-yellow-400 p-1.5 rounded-lg bg-neutral-900/60 shrink-0">
                          <Edit2 className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    {/* 2° Turno */}
                    <div
                      onClick={() => handleOpenEdit(shift2)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                        shift2.operatoreId
                          ? 'bg-neutral-950 border-yellow-500/20 active:border-yellow-400'
                          : 'bg-amber-500/[0.08] border-amber-500/30 active:border-amber-400'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-yellow-400/20 text-yellow-300 border border-yellow-500/30">
                            2° Turno
                          </span>
                          <span className="font-mono font-bold text-yellow-300 text-xs">
                            {shift2.oraInizio} &ndash; {shift2.oraFine}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            ({shift2.durataOre}h)
                          </span>
                          {shift2.isAdapted && (
                            <span className="text-[8px] font-bold text-amber-300 bg-amber-400/15 border border-amber-500/30 px-1 rounded">
                              +{shift2.minutiExtra}m extra
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-0.5">
                          {shift2.operatoreNome ? (
                            <>
                              <div
                                className="w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px] text-black shrink-0"
                                style={{ backgroundColor: shift2.operatoreBadgeColor || '#eab308' }}
                              >
                                {shift2.operatoreNome[0]}
                              </div>
                              <span className="font-bold text-yellow-100 text-xs truncate">
                                {shift2.operatoreNome}
                              </span>
                            </>
                          ) : (
                            <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1 italic">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              Da Assegnare
                            </span>
                          )}
                        </div>
                      </div>

                      {isAdmin && (
                        <div className="text-neutral-500 hover:text-yellow-400 p-1.5 rounded-lg bg-neutral-900/60 shrink-0">
                          <Edit2 className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Totale Settimana Footer Smartphone */}
            <div className="p-3.5 bg-neutral-950/90 border-t border-yellow-500/25 flex items-center justify-between text-xs">
              <div>
                <span className="font-black uppercase text-[10px] text-yellow-400 block tracking-wider">
                  Totale Settimana
                </span>
                <span className="text-neutral-400 text-[11px]">10 turni Lun &ndash; Ven</span>
              </div>
              <div className="text-right">
                <span className="font-mono font-black text-yellow-300 text-sm block">
                  {Math.round(totalOperatingHoursWeek * 10) / 10}h
                </span>
                <span className="text-emerald-400 font-bold text-[10px]">
                  {coveredWeekShifts}/10 Coperti
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* VISTA LISTA A SCHEDE GIORNALIERE */
        <div className="space-y-3.5">
          {computedWeekShifts.map(({ dateStr, dayBookings, shift1, shift2 }, dayIdx) => {
            const dayConfig = GIORNI_LUN_VEN[dayIdx];
            const dObj = parseISODate(dateStr);
            const isToday = formatDateToISO(new Date()) === dateStr;

            return (
              <div
                key={dateStr}
                className={`rounded-2xl border p-4 transition-all ${
                  isToday
                    ? 'bg-[#121210] border-yellow-400/60 shadow-lg ring-1 ring-yellow-400/20'
                    : 'bg-[#0c0c0c] border-yellow-500/20 shadow-md'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Intestazione Giorno e Numero Ben Visibile */}
                  <div className="flex items-center gap-3.5 shrink-0">
                    <div
                      className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black border ${
                        isToday
                          ? 'bg-yellow-400 text-black border-yellow-400 shadow-md'
                          : 'bg-neutral-950 text-yellow-200 border-yellow-500/30'
                      }`}
                    >
                      <span className="text-xl font-black leading-none">
                        {dObj.getDate()}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider font-extrabold opacity-80 mt-0.5">
                        {dayConfig.short}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-black text-yellow-100">
                          {dayConfig.name} {dObj.getDate()} {MESI_ITALIANI[dObj.getMonth()]}
                        </h4>
                        {isToday && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-yellow-400 text-black uppercase">
                            Oggi
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Ore totali presidio: <strong className="text-yellow-400 font-mono">{Math.round((shift1.durataOre + shift2.durataOre) * 10) / 10}h</strong> &bull; {dayBookings.length} prenotazioni
                      </p>
                    </div>
                  </div>

                  {/* Turni del Giorno Affiancati */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                    {/* 1° Turno */}
                    <div
                      onClick={() => handleOpenEdit(shift1)}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                        isAdmin ? 'cursor-pointer hover:border-yellow-400' : ''
                      } ${
                        shift1.operatoreId
                          ? 'bg-neutral-950 border-yellow-500/20'
                          : 'bg-amber-500/[0.08] border-amber-500/30'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-yellow-400/20 text-yellow-300 border border-yellow-500/30">
                            1° Turno
                          </span>
                          <span className="font-mono font-bold text-yellow-300 text-xs">
                            {shift1.oraInizio} &ndash; {shift1.oraFine}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {shift1.operatoreNome ? (
                            <span className="font-bold text-yellow-100 text-xs">
                              {shift1.operatoreNome}
                            </span>
                          ) : (
                            <span className="text-[11px] text-amber-400 italic">
                              ⚠️ Da Assegnare
                            </span>
                          )}
                        </div>
                      </div>
                      {isAdmin && <Edit2 className="w-3.5 h-3.5 text-neutral-500" />}
                    </div>

                    {/* 2° Turno */}
                    <div
                      onClick={() => handleOpenEdit(shift2)}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                        isAdmin ? 'cursor-pointer hover:border-yellow-400' : ''
                      } ${
                        shift2.operatoreId
                          ? 'bg-neutral-950 border-yellow-500/20'
                          : 'bg-amber-500/[0.08] border-amber-500/30'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-yellow-400/20 text-yellow-300 border border-yellow-500/30">
                            2° Turno
                          </span>
                          <span className="font-mono font-bold text-yellow-300 text-xs">
                            {shift2.oraInizio} &ndash; {shift2.oraFine}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {shift2.operatoreNome ? (
                            <span className="font-bold text-yellow-100 text-xs">
                              {shift2.operatoreNome}
                            </span>
                          ) : (
                            <span className="text-[11px] text-amber-400 italic">
                              ⚠️ Da Assegnare
                            </span>
                          )}
                        </div>
                      </div>
                      {isAdmin && <Edit2 className="w-3.5 h-3.5 text-neutral-500" />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* ── 4. QUADRO EQUITÀ ORE E TURNAZIONE (SENZA ALCUN CALCOLO ECONOMICO O COSTO ORARIO) ── */}
      {(() => {
        const monthlyReport = getMonthlyWorkloadReport(currentMonthKey, shifts, staff);

        return (
          <div className="bg-[#0e0e0e] rounded-2xl p-4 sm:p-5 border border-yellow-500/20 shadow-xl space-y-4 print:hidden">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-yellow-400" />
                  <h3 className="font-black text-yellow-100 text-sm sm:text-base">
                    Quadro Equità Ore e Turnazione Operatori ({MESI_ITALIANI[currentMonday.getMonth()]}{' '}
                    {currentMonday.getFullYear()})
                  </h3>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Distribuzione equa del monte ore e copertura presidi sala. Non include compensi o costi economici.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-yellow-300/90 bg-yellow-400/10 px-2.5 py-1 rounded-md border border-yellow-500/20 font-semibold">
                  Incrocio Lavoro Primario &amp; Ferie Attivo
                </span>
              </div>
            </div>

            {/* VISTA DESKTOP: TABELLA EQUITÀ ORE (md in su) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-yellow-500/20 text-neutral-400 text-[11px]">
                    <th className="py-2.5 px-3 font-semibold">Operatore</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Ferie / Indisp. Mese</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Turni Questa Settimana</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Turni Totali Mese</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Ore Presidio Lavorate</th>
                    <th className="py-2.5 px-3 font-semibold text-center min-w-[140px]">Bilanciamento Quota %</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Lavoro Primario &amp; Ferie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {monthlyReport.map(({ operator: op, shiftsCount, totalHours, percentage }) => {
                    const monthExceptions = (op.indisponibilitaDate || []).filter((d) =>
                      d.data.startsWith(currentMonthKey)
                    );
                    const vacationDays = monthExceptions.filter((d) => d.indisponibileTotale).length;
                    const customWorkDays = monthExceptions.filter(
                      (d) => !d.indisponibileTotale && d.oraInizio
                    ).length;

                    // Calcola turni di questo operatore nella sola settimana corrente
                    let weekShiftsOpCount = 0;
                    computedWeekShifts.forEach(({ shift1, shift2 }) => {
                      if (shift1.operatoreId === op.id) weekShiftsOpCount++;
                      if (shift2.operatoreId === op.id) weekShiftsOpCount++;
                    });

                    return (
                      <tr key={op.id} className="hover:bg-neutral-950 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs text-black shrink-0"
                              style={{ backgroundColor: op.coloreBadge }}
                            >
                              {op.nome[0]}
                            </div>
                            <div>
                              <span className="font-bold text-yellow-100 block">
                                {op.nome} {op.cognome}
                              </span>
                              <span className="text-[10px] text-neutral-400 block">
                                {op.ruolo === 'entrambi' ? 'Operatore & Docente' : 'Operatore di Sala'}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          {vacationDays > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                              🏖️ {vacationDays} gg Ferie
                            </span>
                          ) : customWorkDays > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold">
                              💼 {customWorkDays} turni spec.
                            </span>
                          ) : (
                            <span className="text-neutral-500 text-[11px]">Sempre disp.</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-center font-mono font-bold text-yellow-200">
                          {weekShiftsOpCount} turni
                        </td>

                        <td className="py-2.5 px-3 text-center font-bold text-yellow-300">
                          {shiftsCount} turni
                        </td>

                        <td className="py-2.5 px-3 text-center font-mono font-black text-yellow-400 text-sm">
                          {totalHours}h
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-neutral-900 rounded-full h-2 overflow-hidden border border-yellow-500/20">
                              <div
                                className="bg-yellow-400 h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, percentage)}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-yellow-300 font-bold w-9 text-right">
                              {percentage}%
                            </span>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedOpForMonthlySchedule(op)}
                            className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-yellow-300 border border-yellow-500/30 text-[11px] font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            title={`Gestisci turni lavoro primario e indisponibilità totale per ${op.nome}`}
                          >
                            <Calendar className="w-3.5 h-3.5 text-yellow-400" />
                            <span>Calendario &amp; Ferie</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* VISTA MOBILE OPERATORI (Zero scroll orizzontale) */}
            <div className="block md:hidden space-y-3">
              {monthlyReport.map(({ operator: op, shiftsCount, totalHours, percentage }) => {
                const monthExceptions = (op.indisponibilitaDate || []).filter((d) =>
                  d.data.startsWith(currentMonthKey)
                );
                const vacationDays = monthExceptions.filter((d) => d.indisponibileTotale).length;
                const customWorkDays = monthExceptions.filter(
                  (d) => !d.indisponibileTotale && d.oraInizio
                ).length;

                let weekShiftsOpCount = 0;
                computedWeekShifts.forEach(({ shift1, shift2 }) => {
                  if (shift1.operatoreId === op.id) weekShiftsOpCount++;
                  if (shift2.operatoreId === op.id) weekShiftsOpCount++;
                });

                return (
                  <div
                    key={op.id}
                    className="p-3.5 rounded-xl bg-neutral-950/80 border border-yellow-500/20 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-black shrink-0"
                          style={{ backgroundColor: op.coloreBadge }}
                        >
                          {op.nome[0]}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-yellow-100 text-xs block truncate">
                            {op.nome} {op.cognome}
                          </span>
                          <span className="text-[10px] text-neutral-400 block truncate">
                            {op.ruolo === 'entrambi' ? 'Operatore & Docente' : 'Operatore di Sala'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedOpForMonthlySchedule(op)}
                        className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-yellow-300 border border-yellow-500/30 text-[10px] font-semibold flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
                      >
                        <Calendar className="w-3 h-3 text-yellow-400" />
                        <span>Ferie &amp; Turni</span>
                      </button>
                    </div>

                    {/* Badge Ferie / Disponibilità */}
                    <div>
                      {vacationDays > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold inline-block">
                          🏖️ {vacationDays} gg Ferie questo mese
                        </span>
                      ) : customWorkDays > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold inline-block">
                          💼 {customWorkDays} turni lavoro primario
                        </span>
                      ) : (
                        <span className="text-neutral-500 text-[10px]">✅ Sempre disponibile</span>
                      )}
                    </div>

                    {/* Statistiche compatte */}
                    <div className="grid grid-cols-3 gap-2 text-center text-[11px] pt-1 border-t border-neutral-900">
                      <div className="bg-neutral-900/50 p-1.5 rounded-lg">
                        <span className="text-[9px] text-neutral-400 block">Settimana</span>
                        <span className="font-mono font-bold text-yellow-200">{weekShiftsOpCount} turni</span>
                      </div>
                      <div className="bg-neutral-900/50 p-1.5 rounded-lg">
                        <span className="text-[9px] text-neutral-400 block">Totale Mese</span>
                        <span className="font-mono font-bold text-yellow-300">{shiftsCount} turni</span>
                      </div>
                      <div className="bg-neutral-900/50 p-1.5 rounded-lg">
                        <span className="text-[9px] text-neutral-400 block">Ore Mese</span>
                        <span className="font-mono font-black text-yellow-400">{totalHours}h</span>
                      </div>
                    </div>

                    {/* Progress Bar Bilanciamento */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-neutral-400">Quota monte ore mensile</span>
                        <span className="font-mono font-bold text-yellow-300">{percentage}%</span>
                      </div>
                      <div className="bg-neutral-900 rounded-full h-1.5 overflow-hidden border border-yellow-500/20">
                        <div
                          className="bg-yellow-400 h-full rounded-full transition-all"
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── 5. SEZIONE STAMPABILE DEDICATA (1 PAGINA ESATTA SU A4, NESSUN CALENDARIO GRAFICO) ── */}
      <div className="print-only-sheet text-black bg-white font-sans w-full max-w-full print:m-0 print:p-0">
        {/* Intestazione Sala */}
        <div className="border border-slate-300 bg-slate-50 p-2.5 rounded-lg mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-slate-900 tracking-tight uppercase">
              SALA PROVE • {studioInfo?.nome || 'SOUND STUDIO'}
            </h2>
            <p className="text-[11px] text-slate-600">
              {studioInfo?.indirizzo ? `Sede: ${studioInfo.indirizzo}` : ''}
              {studioInfo?.telefono ? ` • Tel: ${studioInfo.telefono}` : ''}
            </p>
          </div>
          <div className="text-right text-xs">
            <span className="font-bold text-amber-700 block uppercase text-[11px]">
              Schema Settimanale Turni Presidio
            </span>
            <span className="text-slate-500 font-mono text-[9.5px]">
              Emissione: {new Date().toLocaleDateString('it-IT')} &bull; Pagina 1 di 1
            </span>
          </div>
        </div>

        {/* Titolo Periodo */}
        <div className="mb-2.5 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-black text-slate-900 uppercase">
              SCHEMA RIEPILOGATIVO SETTIMANALE DEI TURNI
            </h1>
            <p className="text-[11px] text-slate-600 font-semibold mt-0.5">
              {periodLabelWeek} &bull; Copertura: {coveredWeekShifts}/10 turni coperti ({Math.round(totalOperatingHoursWeek * 10) / 10}h totali)
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-500 font-semibold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
            Lunedì &ndash; Venerdì
          </span>
        </div>

        {/* Tabella Stampabile */}
        <table className="w-full text-left text-xs border border-slate-400 border-collapse mb-3.5">
          <thead>
            <tr className="bg-slate-200 text-slate-900 font-black text-[10px] uppercase border-b-2 border-slate-400">
              <th className="p-1.5 border border-slate-400 w-32">GIORNO &amp; DATA</th>
              <th className="p-1.5 border border-slate-400">1° TURNO (17:00 &ndash; 20:00)</th>
              <th className="p-1.5 border border-slate-400">2° TURNO (20:00 &ndash; 23:00)</th>
              <th className="p-1.5 border border-slate-400 text-center w-20">ORE GIORNO</th>
              <th className="p-1.5 border border-slate-400 text-center w-24">STATO</th>
            </tr>
          </thead>
          <tbody>
            {computedWeekShifts.map(({ dateStr, shift1, shift2 }, dayIdx) => {
              const dayConfig = GIORNI_LUN_VEN[dayIdx];
              const dObj = parseISODate(dateStr);
              const dayHours = Math.round((shift1.durataOre + shift2.durataOre) * 10) / 10;
              const isFullyCovered = !!(shift1.operatoreId && shift2.operatoreId);

              return (
                <tr key={dateStr} className={dayIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="p-1.5 border border-slate-300 font-black text-slate-900">
                    {dayConfig.name.toUpperCase()} {dObj.getDate()}/{String(dObj.getMonth() + 1).padStart(2, '0')}
                  </td>
                  <td className="p-1.5 border border-slate-300">
                    <span className="font-mono font-bold text-slate-800 mr-2">
                      {shift1.oraInizio}-{shift1.oraFine}
                    </span>
                    <strong className={shift1.operatoreNome ? 'text-amber-800' : 'text-rose-600 italic'}>
                      {shift1.operatoreNome || '⚠️ NON ASSEGNATO'}
                    </strong>
                    {shift1.isAdapted && (
                      <span className="text-[9px] text-slate-500 ml-1">(+{shift1.minutiExtra}m)</span>
                    )}
                  </td>
                  <td className="p-1.5 border border-slate-300">
                    <span className="font-mono font-bold text-slate-800 mr-2">
                      {shift2.oraInizio}-{shift2.oraFine}
                    </span>
                    <strong className={shift2.operatoreNome ? 'text-amber-800' : 'text-rose-600 italic'}>
                      {shift2.operatoreNome || '⚠️ NON ASSEGNATO'}
                    </strong>
                    {shift2.isAdapted && (
                      <span className="text-[9px] text-slate-500 ml-1">(+{shift2.minutiExtra}m)</span>
                    )}
                  </td>
                  <td className="p-1.5 border border-slate-300 text-center font-mono font-bold text-slate-900">
                    {dayHours}h
                  </td>
                  <td className="p-1.5 border border-slate-300 text-center font-bold">
                    {isFullyCovered ? '✓ Coperto' : '⚠️ Incompleto'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-black border-t-2 border-slate-400 text-slate-900">
              <td className="p-1.5 border border-slate-300 uppercase">Totale Settimana</td>
              <td colSpan={2} className="p-1.5 border border-slate-300 font-normal text-slate-600">
                10 turni settimanali pianificati
              </td>
              <td className="p-1.5 border border-slate-300 text-center font-mono font-black">
                {Math.round(totalOperatingHoursWeek * 10) / 10}h
              </td>
              <td className="p-1.5 border border-slate-300 text-center">
                {coveredWeekShifts}/10 Coperti
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Box Firme Convalida a Piè Pagina */}
        <div className="pt-3 border-t border-slate-300 text-xs text-slate-600 grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <p className="text-[11px] text-slate-500">
              Luogo e Data: <strong className="text-slate-800">{studioInfo?.citta || 'In sede'}, {new Date().toLocaleDateString('it-IT')}</strong>
            </p>
            <div>
              <div className="border-b border-slate-400 w-44 mb-1"></div>
              <span className="text-[10px] text-slate-400">Firma Operatore per Presa Visione</span>
            </div>
          </div>

          <div className="space-y-4 text-right flex flex-col items-end">
            <p className="text-[11px] text-slate-500">
              Per la Direzione: <strong className="text-slate-800">{studioInfo?.nome || 'Sound Studio'}</strong>
            </p>
            <div className="w-full flex flex-col items-end">
              <div className="border-b border-slate-400 w-44 mb-1"></div>
              <span className="text-[10px] text-slate-400">Firma Responsabile / Timbro Sala</span>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 text-center mt-3 italic">
          Documento ufficiale interno &bull; Schema Riepilogativo Settimanale Turni Presidio &bull; Pagina 1 di 1
        </p>
      </div>

      {/* ── 6. MODALS DI SUPPORTO ── */}
      {/* Quick Edit Modal */}
      <ShiftQuickModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedShiftForEdit(null);
        }}
        shiftComputed={selectedShiftForEdit}
      />

      {/* Operator Monthly Schedule Modal (Gestione Lavoro Primario & Ferie) */}
      <OperatorMonthlyScheduleModal
        isOpen={!!selectedOpForMonthlySchedule}
        onClose={() => setSelectedOpForMonthlySchedule(null)}
        operator={selectedOpForMonthlySchedule}
      />

      {/* Monthly Shifts PDF Export Modal (Solo Lato Admin) */}
      {isAdmin && (
        <MonthlyShiftsPdfModal
          isOpen={isMonthlyPdfModalOpen}
          onClose={() => setIsMonthlyPdfModalOpen(false)}
          initialMonthStr={currentMonthKey}
        />
      )}

      {/* Weekly Shifts Print & PDF Modal */}
      <WeeklyShiftsPrintModal
        isOpen={isWeeklyPrintModalOpen}
        onClose={() => setIsWeeklyPrintModalOpen(false)}
        currentMonday={currentMonday}
        weekFriday={weekFriday}
        computedWeekShifts={computedWeekShifts}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onCurrentWeek={handleCurrentWeek}
      />
    </div>
  );
};
