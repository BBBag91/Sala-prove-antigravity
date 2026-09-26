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
  SlidersHorizontal,
  Info,
  CalendarCheck,
  RotateCcw,
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
  checkOperatorShiftAvailability,
  getMonthlyWorkloadReport,
} from '../utils/shiftUtils';
import { ShiftQuickModal } from './ShiftQuickModal';
import { OperatorMonthlyScheduleModal } from './OperatorMonthlyScheduleModal';

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
    assignOperatorToShift,
    autoAssignWeeklyShiftsAction,
    autoAssignMonthlyShiftsAction,
    updateShift,
  } = useApp();
  const { isAdmin } = useAuth();

  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()));
  const [selectedShiftForEdit, setSelectedShiftForEdit] = useState<DailyShiftComputed | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [selectedOpForMonthlySchedule, setSelectedOpForMonthlySchedule] = useState<StaffMember | null>(null);

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
      `Assegnazione completata! ${res.assignedCount} turni coperti con successo.`
    );
    setTimeout(() => setFeedbackMessage(null), 4000);
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
  computedWeekShifts.forEach(({ shift1, shift2 }) => {
    if (shift1.operatoreId) coveredWeekShifts++;
    if (shift2.operatoreId) coveredWeekShifts++;
  });
  const unassignedShiftsCount = totalWeekShifts - coveredWeekShifts;

  // Statistiche ore operatori per la settimana
  const operatorWeekStats: Record<
    string,
    { shiftsCount: number; baseHours: number; extraHours: number; totalHours: number }
  > = {};
  activeStaff.forEach((op) => {
    operatorWeekStats[op.id] = { shiftsCount: 0, baseHours: 0, extraHours: 0, totalHours: 0 };
  });

  computedWeekShifts.forEach(({ shift1, shift2 }) => {
    [shift1, shift2].forEach((s) => {
      if (s.operatoreId && operatorWeekStats[s.operatoreId]) {
        operatorWeekStats[s.operatoreId].shiftsCount += 1;
        operatorWeekStats[s.operatoreId].baseHours += 3;
        const extra = Math.max(0, s.durataOre - 3);
        operatorWeekStats[s.operatoreId].extraHours += extra;
        operatorWeekStats[s.operatoreId].totalHours += s.durataOre;
      }
    });
  });

  const handleOpenEdit = (shiftComputed: DailyShiftComputed) => {
    setSelectedShiftForEdit(shiftComputed);
    setIsModalOpen(true);
  };

  // Stampa / Esporta
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* Banner di Benvenuto e Regola di Funzionamento */}
      <div className="bg-[#0e0e0e] rounded-2xl p-4 sm:p-6 border border-yellow-500/25 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1 max-w-3xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="w-8 h-8 rounded-lg bg-yellow-400 text-black flex items-center justify-center font-black text-sm shadow-sm">
                <Clock className="w-4 h-4" />
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-yellow-100 tracking-tight">
                Pannello Gestione Turni Presidio Sala
              </h2>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-500/30">
                Lunedì &ndash; Venerdì
              </span>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed mt-1">
              Ogni giornata da <strong>Lunedì a Venerdì</strong> prevede <strong>2 turni fissi di base</strong>:
              <span className="text-yellow-400 font-semibold ml-1">1° Turno (17:00 &ndash; 20:00)</span> e{' '}
              <span className="text-yellow-400 font-semibold">2° Turno (20:00 &ndash; 23:00)</span>.
              Grazie alla <strong>logica di adattamento dinamico</strong>, se le prenotazioni si estendono oltre le 23:00
              (es. fino alle 23:30), il tempo extra viene spalmato equamente sui turni (es. +15 minuti a turno).
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={handleAutoAssignWeek}
                  className="px-3.5 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  title="Assegna automaticamente gli operatori disponibili rispettando le compatibilità e bilanciando le ore"
                >
                  <Wand2 className="w-4 h-4 stroke-[2.5]" />
                  <span>Auto-Assegna Settimana</span>
                </button>

                <button
                  type="button"
                  onClick={handleAutoAssignMonth}
                  className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-yellow-300 border border-yellow-500/40 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  title={`Auto-assegna tutti i turni del mese di ${MESI_ITALIANI[currentMonday.getMonth()]} con distribuzione equa del monte ore`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                  <span>Auto-Assegna Intero Mese</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyFromPreviousWeek}
                  className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-yellow-200 border border-yellow-500/30 font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Copia gli operatori assegnati nella settimana precedente"
                >
                  <Copy className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="hidden sm:inline">Copia da Settimana Scorsa</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Stampa foglio turni"
            >
              <Printer className="w-3.5 h-3.5 text-yellow-400" />
              <span>Stampa</span>
            </button>
          </div>
        </div>

        {/* Feedback message alert */}
        {feedbackMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        {/* Settimana Navigator Bar */}
        <div className="pt-3 border-t border-yellow-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevWeek}
              className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-yellow-400 border border-yellow-500/25 transition-colors cursor-pointer"
              title="Settimana precedente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-950 border border-yellow-500/25">
              <Calendar className="w-4 h-4 text-yellow-400 shrink-0" />
              <span className="font-bold text-xs sm:text-sm text-yellow-100">
                Lun {currentMonday.getDate()} {MESI_ITALIANI[currentMonday.getMonth()]} &ndash; Ven{' '}
                {weekFriday.getDate()} {MESI_ITALIANI[weekFriday.getMonth()]}{' '}
                {weekFriday.getFullYear()}
              </span>
            </div>

            <button
              onClick={handleNextWeek}
              className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-yellow-400 border border-yellow-500/25 transition-colors cursor-pointer"
              title="Settimana successiva"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={handleCurrentWeek}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-yellow-300 text-xs font-semibold border border-yellow-500/25 transition-colors cursor-pointer"
            >
              Oggi
            </button>
          </div>

          {/* Copertura pill */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-400">Copertura Turni:</span>
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

      {/* Matrice Settimanale 5 Giorni (Lun - Ven) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {computedWeekShifts.map(({ dateStr, dayBookings, shift1, shift2 }, dayIdx) => {
          const dayConfig = GIORNI_LUN_VEN[dayIdx];
          const dObj = parseISODate(dateStr);
          const isToday = formatDateToISO(new Date()) === dateStr;

          // Trova orario ultima prenotazione
          let latestBookingTime = '23:00';
          if (dayBookings.length > 0) {
            dayBookings.forEach((b) => {
              if (b.oraFine > latestBookingTime) latestBookingTime = b.oraFine;
            });
          }

          return (
            <div
              key={dateStr}
              className={`rounded-2xl border flex flex-col justify-between transition-all overflow-hidden ${
                isToday
                  ? 'bg-[#121210] border-yellow-400/60 shadow-lg ring-1 ring-yellow-400/20'
                  : 'bg-[#0b0b0b] border-yellow-500/20 shadow-sm'
              }`}
            >
              {/* Day Header */}
              <div
                className={`p-3.5 border-b flex items-center justify-between ${
                  isToday
                    ? 'bg-yellow-400/15 border-yellow-500/30'
                    : 'bg-neutral-950 border-yellow-500/15'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider ${
                        isToday ? 'text-yellow-400' : 'text-neutral-400'
                      }`}
                    >
                      {dayConfig.name}
                    </span>
                    {isToday && (
                      <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                    )}
                  </div>
                  <p className="text-sm font-black text-yellow-100 mt-0.5">
                    {dObj.getDate()} {MESI_ITALIANI[dObj.getMonth()]}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-900 border border-yellow-500/20 text-yellow-300">
                    {dayBookings.length} {dayBookings.length === 1 ? 'pren.' : 'pren.'}
                  </span>
                  {dayBookings.length > 0 && (
                    <p className="text-[9px] text-neutral-400 mt-0.5">
                      Chiusura: <strong className="text-yellow-200">{latestBookingTime}</strong>
                    </p>
                  )}
                </div>
              </div>

              {/* Corpo: I Due Turni del Giorno */}
              <div className="p-3 space-y-3 flex-1 flex flex-col justify-between">
                
                {/* 1° TURNO (Pomeridiano) */}
                <div
                  onClick={() => handleOpenEdit(shift1)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer select-none group relative ${
                    shift1.operatoreId
                      ? 'bg-neutral-950 hover:bg-neutral-900 border-yellow-500/25 hover:border-yellow-400/60'
                      : 'bg-amber-500/[0.05] hover:bg-amber-500/[0.09] border-amber-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md bg-yellow-400/20 text-yellow-400 border border-yellow-500/30 flex items-center justify-center font-black text-[10px]">
                        1°
                      </span>
                      <span className="text-xs font-bold text-yellow-100">1° Turno</span>
                    </div>

                    {shift1.isAdapted && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5"
                        title={shift1.adaptationReason}
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        +{shift1.minutiExtra}m
                      </span>
                    )}
                  </div>

                  {/* Orario */}
                  <div className="mt-1.5 flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-yellow-300 text-xs">
                      {shift1.oraInizio} &ndash; {shift1.oraFine}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {shift1.durataOre}h
                    </span>
                  </div>

                  {/* Operatore Assegnato */}
                  <div className="mt-2 pt-2 border-t border-neutral-900 flex items-center justify-between gap-1.5">
                    {shift1.operatoreNome ? (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div
                          className="w-5 h-5 rounded-sm flex items-center justify-center font-bold text-[10px] text-black shrink-0"
                          style={{ backgroundColor: shift1.operatoreBadgeColor || '#f59e0b' }}
                        >
                          {shift1.operatoreNome[0]}
                        </div>
                        <span className="text-xs font-semibold text-yellow-100 truncate">
                          {shift1.operatoreNome}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] font-semibold text-amber-400/90 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        Non assegnato
                      </span>
                    )}

                    <button
                      type="button"
                      className="opacity-60 group-hover:opacity-100 text-yellow-400 p-1 hover:bg-neutral-800 rounded transition-opacity"
                      title="Modifica turno"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* 2° TURNO (Serale) */}
                <div
                  onClick={() => handleOpenEdit(shift2)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer select-none group relative ${
                    shift2.operatoreId
                      ? 'bg-neutral-950 hover:bg-neutral-900 border-yellow-500/25 hover:border-yellow-400/60'
                      : 'bg-amber-500/[0.05] hover:bg-amber-500/[0.09] border-amber-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md bg-yellow-400/20 text-yellow-400 border border-yellow-500/30 flex items-center justify-center font-black text-[10px]">
                        2°
                      </span>
                      <span className="text-xs font-bold text-yellow-100">2° Turno</span>
                    </div>

                    {shift2.isAdapted && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5"
                        title={shift2.adaptationReason}
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        +{shift2.minutiExtra}m
                      </span>
                    )}
                  </div>

                  {/* Orario */}
                  <div className="mt-1.5 flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-yellow-300 text-xs">
                      {shift2.oraInizio} &ndash; {shift2.oraFine}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {shift2.durataOre}h
                    </span>
                  </div>

                  {/* Operatore Assegnato */}
                  <div className="mt-2 pt-2 border-t border-neutral-900 flex items-center justify-between gap-1.5">
                    {shift2.operatoreNome ? (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div
                          className="w-5 h-5 rounded-sm flex items-center justify-center font-bold text-[10px] text-black shrink-0"
                          style={{ backgroundColor: shift2.operatoreBadgeColor || '#f59e0b' }}
                        >
                          {shift2.operatoreNome[0]}
                        </div>
                        <span className="text-xs font-semibold text-yellow-100 truncate">
                          {shift2.operatoreNome}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] font-semibold text-amber-400/90 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        Non assegnato
                      </span>
                    )}

                    <button
                      type="button"
                      className="opacity-60 group-hover:opacity-100 text-yellow-400 p-1 hover:bg-neutral-800 rounded transition-opacity"
                      title="Modifica turno"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

              </div>

              {/* Footer Giorno: Quick Assign Helper */}
              <div className="p-2 border-t border-yellow-500/15 bg-neutral-950 flex items-center justify-between text-[10px] text-neutral-400 px-3">
                <span>Ore Totali:</span>
                <strong className="text-yellow-400 font-mono">
                  {Math.round((shift1.durataOre + shift2.durataOre) * 10) / 10}h
                </strong>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabella Riepilogo Bilanciamento Equo Ore & Carico di Lavoro Mensile */}
      {(() => {
        const monthlyReport = getMonthlyWorkloadReport(currentMonthKey, shifts, staff);

        return (
          <div className="bg-[#0e0e0e] rounded-2xl p-4 sm:p-5 border border-yellow-500/20 shadow-xl space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-yellow-400" />
                <h3 className="font-bold text-yellow-100 text-sm sm:text-base">
                  Distribuzione Equa Ore Mensili ({MESI_ITALIANI[currentMonday.getMonth()]}{' '}
                  {currentMonday.getFullYear()})
                </h3>
              </div>
              <span className="text-[11px] text-yellow-300/80 italic bg-yellow-400/10 px-2.5 py-1 rounded-md border border-yellow-500/20">
                Bilanciamento intelligente del carico ore tra operatori idonei
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-yellow-500/20 text-neutral-400">
                    <th className="py-2.5 px-3 font-semibold">Operatore</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Ferie / Indisp. Mese</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Turni Assegnati Mese</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Totale Ore Lavorate</th>
                    <th className="py-2.5 px-3 font-semibold text-center min-w-[140px]">Bilanciamento / Quota</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Calendario Personale</th>
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
                              <span className="font-semibold text-yellow-100 block">
                                {op.nome} {op.cognome}
                              </span>
                              <span className="text-[10px] text-neutral-400 block">
                                {op.ruolo === 'entrambi' ? 'Operatore & Insegnante' : 'Operatore di Sala'}
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
                            title={`Gestisci orari primari e ferie di ${op.nome}`}
                          >
                            <Calendar className="w-3.5 h-3.5 text-yellow-400" />
                            <span>Calendario & Ferie</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Quick Edit Modal */}
      <ShiftQuickModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedShiftForEdit(null);
        }}
        shiftComputed={selectedShiftForEdit}
      />

      {/* Operator Monthly Schedule Modal */}
      <OperatorMonthlyScheduleModal
        isOpen={!!selectedOpForMonthlySchedule}
        onClose={() => setSelectedOpForMonthlySchedule(null)}
        operator={selectedOpForMonthlySchedule}
      />
    </div>
  );
};
