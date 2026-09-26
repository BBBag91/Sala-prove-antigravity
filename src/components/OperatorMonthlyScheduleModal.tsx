import React, { useState, useMemo } from 'react';
import {
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Briefcase,
  AlertOctagon,
  CheckCircle2,
  Trash2,
  Sparkles,
  HelpCircle,
  Plus,
  Palmtree,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PrimaryWorkShiftDate, StaffMember } from '../types';
import { GIORNI_CALENDARIO, MESI_ITALIANI } from '../utils/dateUtils';

interface OperatorMonthlyScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  operator: StaffMember | null;
}

const SHORT_WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

export const OperatorMonthlyScheduleModal: React.FC<OperatorMonthlyScheduleModalProps> = ({
  isOpen,
  onClose,
  operator,
}) => {
  const { updateStaff } = useApp();

  const [currentYear, setCurrentYear] = useState<number>(() => new Date().getFullYear());
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(() => new Date().getMonth()); // 0-11

  // Local draft of date-specific unavailabilities / primary shifts
  const [scheduleDraft, setScheduleDraft] = useState<PrimaryWorkShiftDate[]>([]);

  // Selected date for the Day Editor drawer/dialog
  const [activeDateStr, setActiveDateStr] = useState<string | null>(null);

  // Day editor fields
  const [dayIndispTotale, setDayIndispTotale] = useState<boolean>(false);
  const [dayOraInizio, setDayOraInizio] = useState<string>('08:30');
  const [dayOraFine, setDayOraFine] = useState<string>('17:00');
  const [dayMotivo, setDayMotivo] = useState<string>('');

  // Vacation Range Modal/Form state
  const [showVacationRangeModal, setShowVacationRangeModal] = useState<boolean>(false);
  const [vacationStart, setVacationStart] = useState<string>('');
  const [vacationEnd, setVacationEnd] = useState<string>('');
  const [vacationReason, setVacationReason] = useState<string>('Ferie / Riposo');

  // Sync draft when operator changes or modal opens
  React.useEffect(() => {
    if (operator) {
      setScheduleDraft(operator.indisponibilitaDate ? [...operator.indisponibilitaDate] : []);
    }
  }, [operator, isOpen]);

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

  // Compute all days in this month
  const daysInMonth = useMemo(() => {
    const lastDay = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
    const days: { dateStr: string; dayNum: number; dayOfWeek: number }[] = [];

    for (let d = 1; d <= lastDay; d++) {
      const dt = new Date(currentYear, currentMonthIndex, d);
      const iso = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr: iso,
        dayNum: d,
        dayOfWeek: dt.getDay(), // 0 = Sun, 1 = Mon ... 6 = Sat
      });
    }
    return days;
  }, [currentYear, currentMonthIndex]);

  // Leading empty cells for calendar alignment (Monday first)
  const firstDayWeekIndex = useMemo(() => {
    const firstDt = new Date(currentYear, currentMonthIndex, 1);
    const day = firstDt.getDay(); // 0 = Sun, 1 = Mon ...
    return day === 0 ? 6 : day - 1; // 0 for Mon, 6 for Sun
  }, [currentYear, currentMonthIndex]);

  if (!isOpen || !operator) return null;

  // Open day editor
  const handleOpenDayEditor = (dateStr: string) => {
    setActiveDateStr(dateStr);
    const existing = scheduleDraft.find((item) => item.data === dateStr);

    if (existing) {
      setDayIndispTotale(existing.indisponibileTotale);
      setDayOraInizio(existing.oraInizio || '08:30');
      setDayOraFine(existing.oraFine || '17:00');
      setDayMotivo(existing.motivo || '');
    } else {
      // Find fallback weekly shift if any
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const dow = dt.getDay();
      const weekly = operator.turniLavoroPrimario.find((s) => s.giornoSettimana === dow);

      setDayIndispTotale(false);
      setDayOraInizio(weekly ? weekly.oraInizio : '08:30');
      setDayOraFine(weekly ? weekly.oraFine : '17:00');
      setDayMotivo('');
    }
  };

  // Save day editor
  const handleSaveDay = () => {
    if (!activeDateStr) return;

    const newEntry: PrimaryWorkShiftDate = {
      data: activeDateStr,
      indisponibileTotale: dayIndispTotale,
      oraInizio: !dayIndispTotale ? dayOraInizio : undefined,
      oraFine: !dayIndispTotale ? dayOraFine : undefined,
      motivo: dayMotivo.trim() || (dayIndispTotale ? 'Ferie / Riposo' : undefined),
    };

    setScheduleDraft((prev) => {
      const filtered = prev.filter((item) => item.data !== activeDateStr);
      return [...filtered, newEntry];
    });

    setActiveDateStr(null);
  };

  // Remove day exception
  const handleRemoveDayException = (dateStr: string) => {
    setScheduleDraft((prev) => prev.filter((item) => item.data !== dateStr));
    if (activeDateStr === dateStr) {
      setActiveDateStr(null);
    }
  };

  // Preset buttons
  const handleApplyPreset = (type: 'ferie' | 'mattina' | 'pomeriggio' | 'notte' | 'ufficio' | 'libero') => {
    if (!activeDateStr) return;

    if (type === 'ferie') {
      setDayIndispTotale(true);
      setDayMotivo('Ferie / Riposo');
    } else if (type === 'libero') {
      handleRemoveDayException(activeDateStr);
    } else {
      setDayIndispTotale(false);
      if (type === 'mattina') {
        setDayOraInizio('07:00');
        setDayOraFine('15:00');
        setDayMotivo('Turno Mattina');
      } else if (type === 'pomeriggio') {
        setDayOraInizio('14:00');
        setDayOraFine('22:00');
        setDayMotivo('Turno Pomeriggio');
      } else if (type === 'notte') {
        setDayOraInizio('22:00');
        setDayOraFine('06:00');
        setDayMotivo('Turno Notturno');
      } else if (type === 'ufficio') {
        setDayOraInizio('08:30');
        setDayOraFine('17:00');
        setDayMotivo('Orario Ufficio');
      }
    }
  };

  // Apply vacation range
  const handleApplyVacationRange = () => {
    if (!vacationStart || !vacationEnd) return;
    if (vacationStart > vacationEnd) {
      alert('La data di inizio deve precedere la data di fine.');
      return;
    }

    const startDt = new Date(vacationStart);
    const endDt = new Date(vacationEnd);
    const datesToMark: string[] = [];

    const curr = new Date(startDt);
    while (curr <= endDt) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      datesToMark.push(`${y}-${m}-${d}`);
      curr.setDate(curr.getDate() + 1);
    }

    setScheduleDraft((prev) => {
      const filtered = prev.filter((item) => !datesToMark.includes(item.data));
      const additions: PrimaryWorkShiftDate[] = datesToMark.map((d) => ({
        data: d,
        indisponibileTotale: true,
        motivo: vacationReason.trim() || 'Ferie / Riposo',
      }));
      return [...filtered, ...additions];
    });

    setShowVacationRangeModal(false);
    setVacationStart('');
    setVacationEnd('');
  };

  // Apply default weekly schedule to this month
  const handleApplyWeeklyToMonth = () => {
    if (operator.turniLavoroPrimario.length === 0) {
      alert("L'operatore non ha orari settimanali predefiniti configurati nella sua scheda anagrafica.");
      return;
    }

    const newEntries: PrimaryWorkShiftDate[] = [];
    daysInMonth.forEach(({ dateStr, dayOfWeek }) => {
      const weekly = operator.turniLavoroPrimario.find((s) => s.giornoSettimana === dayOfWeek);
      if (weekly) {
        newEntries.push({
          data: dateStr,
          indisponibileTotale: false,
          oraInizio: weekly.oraInizio,
          oraFine: weekly.oraFine,
          motivo: weekly.descrizione || 'Orario Standard',
        });
      }
    });

    setScheduleDraft((prev) => {
      const monthPrefix = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}`;
      const otherMonths = prev.filter((item) => !item.data.startsWith(monthPrefix));
      return [...otherMonths, ...newEntries];
    });
  };

  // Clear this month exceptions
  const handleClearMonthExceptions = () => {
    if (window.confirm(`Vuoi azzerare tutte le eccezioni e ferie impostate per ${MESI_ITALIANI[currentMonthIndex]} ${currentYear}?`)) {
      setScheduleDraft((prev) => prev.filter((item) => !item.data.startsWith(monthKey)));
    }
  };

  // Save all changes to operator and Supabase
  const handleFinalSave = () => {
    updateStaff({
      ...operator,
      indisponibilitaDate: scheduleDraft,
    });
    onClose();
  };

  // Monthly stats
  const monthItems = scheduleDraft.filter((item) => item.data.startsWith(monthKey));
  const countIndispTotale = monthItems.filter((item) => item.indisponibileTotale).length;
  const countSpecificHours = monthItems.filter((item) => !item.indisponibileTotale && item.oraInizio).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#0c0c0c] rounded-2xl max-w-5xl w-full border border-yellow-500/30 shadow-2xl flex flex-col max-h-[94vh] overflow-hidden text-yellow-100 my-auto">
        
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-yellow-500/25 bg-neutral-950 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-black shadow-md shrink-0 text-base"
              style={{ backgroundColor: operator.coloreBadge || '#f59e0b' }}
            >
              {operator.nome[0]}
              {operator.cognome[0]}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-yellow-100 tracking-tight">
                  Calendario Lavoro Primario & Indisponibilità
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-yellow-400/15 text-yellow-300 border border-yellow-500/30">
                  {operator.nome} {operator.cognome}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Imposta i turni mensili variabili del lavoro primario e le spunte di indisponibilità totale (ferie, riposo, impegni).
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

        {/* Month Selector & Quick Actions Bar */}
        <div className="px-5 py-3 border-b border-yellow-500/20 bg-neutral-900/60 flex flex-col md:flex-row items-center justify-between gap-3 flex-wrap">
          {/* Month Navigation */}
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

          {/* Quick Batch Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowVacationRangeModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/25 text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Segna un periodo consecutivo di ferie o indisponibilità"
            >
              <Palmtree className="w-3.5 h-3.5" />
              <span>Segna Periodo Ferie</span>
            </button>

            <button
              type="button"
              onClick={handleApplyWeeklyToMonth}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-400/15 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Copia gli orari settimanali dell'anagrafica su tutti i feriali di questo mese"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Applica Orario Standard al Mese</span>
            </button>

            {monthItems.length > 0 && (
              <button
                type="button"
                onClick={handleClearMonthExceptions}
                className="px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-rose-400 hover:bg-neutral-900 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Azzera tutte le eccezioni di questo mese"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Azzera Mese</span>
              </button>
            )}
          </div>
        </div>

        {/* Monthly Summary Badges & Legend */}
        <div className="px-5 py-2.5 bg-neutral-950/80 border-b border-yellow-500/15 flex flex-wrap items-center justify-between text-xs gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
              <span className="text-neutral-400">Indisponibile Totale:</span>
              <strong className="text-rose-300 font-bold font-mono">{countIndispTotale} gg</strong>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
              <span className="text-neutral-400">Turni Specifici Mese:</span>
              <strong className="text-blue-300 font-bold font-mono">{countSpecificHours} gg</strong>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
              <span className="text-neutral-400">Da Orario Settimanale:</span>
              <strong className="text-amber-200 font-bold font-mono">{operator.turniLavoroPrimario.length} fasce/sett.</strong>
            </div>
          </div>

          <div className="text-[11px] text-yellow-300/80 italic flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span>Clicca su qualsiasi giorno per impostare orari o spuntare l'indisponibilità totale</span>
          </div>
        </div>

        {/* Calendar Grid Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* Weekday Columns Header */}
          <div className="grid grid-cols-7 gap-2 mb-2 text-center">
            {SHORT_WEEKDAYS.map((w, idx) => (
              <div
                key={w}
                className={`py-1.5 text-xs font-black uppercase tracking-wider rounded-lg border ${
                  idx >= 5
                    ? 'text-neutral-500 bg-neutral-950/50 border-neutral-900'
                    : 'text-yellow-400 bg-neutral-900 border-yellow-500/20'
                }`}
              >
                {w}
              </div>
            ))}
          </div>

          {/* Month Days Grid */}
          <div className="grid grid-cols-7 gap-2 auto-rows-fr">
            {/* Empty slots before first day */}
            {Array.from({ length: firstDayWeekIndex }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-[92px] rounded-xl bg-neutral-950/30 border border-neutral-900/40 opacity-40 pointer-events-none"
              />
            ))}

            {/* Days of Month */}
            {daysInMonth.map(({ dateStr, dayNum, dayOfWeek }) => {
              const existing = scheduleDraft.find((item) => item.data === dateStr);
              const weekly = operator.turniLavoroPrimario.find((s) => s.giornoSettimana === dayOfWeek);
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

              const isTotallyUnavailable = existing?.indisponibileTotale;
              const hasSpecificHours = !isTotallyUnavailable && existing?.oraInizio && existing?.oraFine;
              const hasWeeklyFallback = !existing && !!weekly;
              const isFree = !existing && !weekly;

              return (
                <div
                  key={dateStr}
                  onClick={() => handleOpenDayEditor(dateStr)}
                  className={`min-h-[94px] rounded-xl border p-2 flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg relative select-none group ${
                    isTotallyUnavailable
                      ? 'bg-rose-950/30 border-rose-500/40 hover:border-rose-400'
                      : hasSpecificHours
                      ? 'bg-blue-950/30 border-blue-500/40 hover:border-blue-400'
                      : hasWeeklyFallback
                      ? 'bg-neutral-950 border-yellow-500/25 hover:border-yellow-400'
                      : isWeekend
                      ? 'bg-neutral-950/40 border-neutral-800 hover:border-yellow-500/40'
                      : 'bg-neutral-950 border-emerald-500/25 hover:border-emerald-400'
                  }`}
                >
                  {/* Day Header */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-black w-6 h-6 rounded-md flex items-center justify-center ${
                        isTotallyUnavailable
                          ? 'bg-rose-500 text-white font-bold'
                          : hasSpecificHours
                          ? 'bg-blue-500 text-white'
                          : 'text-yellow-100 group-hover:text-yellow-300'
                      }`}
                    >
                      {dayNum}
                    </span>

                    {/* Quick indicator badge */}
                    {isTotallyUnavailable && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                        Ferie/Off
                      </span>
                    )}
                    {hasSpecificHours && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">
                        Spec.
                      </span>
                    )}
                  </div>

                  {/* Body: Status Content */}
                  <div className="my-1.5 min-w-0">
                    {isTotallyUnavailable ? (
                      <div className="text-center p-1 rounded bg-rose-900/30 border border-rose-500/20">
                        <p className="text-[9.5px] font-extrabold text-rose-300 uppercase tracking-tight flex items-center justify-center gap-1">
                          <AlertOctagon className="w-2.5 h-2.5" />
                          Indisponibile
                        </p>
                        <p className="text-[8.5px] text-rose-200/80 truncate mt-0.5">
                          {existing.motivo || 'Ferie / Riposo'}
                        </p>
                      </div>
                    ) : hasSpecificHours ? (
                      <div className="text-center p-1 rounded bg-blue-900/30 border border-blue-500/20">
                        <p className="text-[9.5px] font-mono font-bold text-blue-200">
                          {existing.oraInizio} - {existing.oraFine}
                        </p>
                        <p className="text-[8.5px] text-blue-300/80 truncate mt-0.5">
                          {existing.motivo || 'Lavoro primario'}
                        </p>
                      </div>
                    ) : hasWeeklyFallback ? (
                      <div className="text-center p-1 rounded bg-neutral-900/70 border border-yellow-500/15">
                        <p className="text-[9.5px] font-mono font-medium text-yellow-300/90">
                          {weekly?.oraInizio} - {weekly?.oraFine}
                        </p>
                        <p className="text-[8px] text-neutral-400 truncate mt-0.5">
                          Standard sett.
                        </p>
                      </div>
                    ) : (
                      <div className="text-center p-1 rounded bg-emerald-950/20 border border-emerald-500/15">
                        <p className="text-[9.5px] font-bold text-emerald-400">
                          🟢 Libero 24h
                        </p>
                        <p className="text-[8px] text-neutral-400 truncate mt-0.5">
                          {isWeekend ? 'Fine settimana' : 'Disp. sala'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Footer hint */}
                  <div className="text-[8px] text-neutral-500 text-right truncate">
                    {existing ? 'Personalizzato' : 'Click per edit'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day Editor Modal/Popover (When a day is clicked) */}
        {activeDateStr && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
            <div className="bg-[#121212] rounded-xl border border-yellow-500/40 p-5 max-w-md w-full shadow-2xl space-y-4 text-yellow-100">
              
              <div className="flex items-center justify-between border-b border-yellow-500/20 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-yellow-400" />
                  <h3 className="font-extrabold text-base text-yellow-200">
                    Modifica Giorno: {activeDateStr}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDateStr(null)}
                  className="p-1 text-neutral-400 hover:text-yellow-300 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Spunta Indisponibilità Totale (Core requirement) */}
              <div className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-950/20 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={dayIndispTotale}
                    onChange={(e) => setDayIndispTotale(e.target.checked)}
                    className="w-5 h-5 mt-0.5 rounded border-rose-500 text-rose-500 focus:ring-rose-400 focus:ring-offset-0 bg-neutral-900 cursor-pointer"
                  />
                  <div>
                    <span className="font-black text-sm text-rose-300 block">
                      Indisponibilità Totale (Giornata Intera)
                    </span>
                    <span className="text-xs text-rose-200/80 block mt-0.5 leading-snug">
                      Spunta per escludere totalmente l'operatore dall'autoassegnazione e da qualsiasi turno per questa data (ferie, riposo, malattia o impegni personali).
                    </span>
                  </div>
                </label>

                {dayIndispTotale && (
                  <div className="pt-2 border-t border-rose-500/20">
                    <label className="block text-[11px] font-bold text-rose-300 mb-1">
                      Motivo Indisponibilità / Ferie:
                    </label>
                    <input
                      type="text"
                      value={dayMotivo}
                      onChange={(e) => setDayMotivo(e.target.value)}
                      placeholder="es. Ferie estive, Giorno di riposo, Permesso..."
                      className="w-full bg-neutral-900 border border-rose-500/40 rounded-lg px-3 py-1.5 text-xs text-rose-100 placeholder-neutral-500 focus:outline-hidden focus:border-rose-400"
                    />
                  </div>
                )}
              </div>

              {/* Orario Lavoro Primario Specifico (se non è indisponibile totale) */}
              {!dayIndispTotale && (
                <div className="p-3.5 rounded-xl border border-yellow-500/25 bg-neutral-900/50 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-yellow-300 uppercase tracking-wide">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Orari Lavoro Primario in questa data:</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-neutral-400 mb-1">
                        Inizio Lavoro:
                      </label>
                      <input
                        type="time"
                        value={dayOraInizio}
                        onChange={(e) => setDayOraInizio(e.target.value)}
                        className="w-full bg-neutral-950 border border-yellow-500/30 rounded-lg px-2.5 py-1.5 text-xs text-yellow-200 font-mono focus:outline-hidden focus:border-yellow-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-neutral-400 mb-1">
                        Fine Lavoro:
                      </label>
                      <input
                        type="time"
                        value={dayOraFine}
                        onChange={(e) => setDayOraFine(e.target.value)}
                        className="w-full bg-neutral-950 border border-yellow-500/30 rounded-lg px-2.5 py-1.5 text-xs text-yellow-200 font-mono focus:outline-hidden focus:border-yellow-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-400 mb-1">
                      Descrizione / Mansione (Opzionale):
                    </label>
                    <input
                      type="text"
                      value={dayMotivo}
                      onChange={(e) => setDayMotivo(e.target.value)}
                      placeholder="es. Turno Ospedale, Ufficio straordinari..."
                      className="w-full bg-neutral-950 border border-yellow-500/30 rounded-lg px-2.5 py-1.5 text-xs text-yellow-200 placeholder-neutral-500 focus:outline-hidden focus:border-yellow-400"
                    />
                  </div>
                </div>
              )}

              {/* Quick Presets */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                  Preset Rapidi:
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('ferie')}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[10px] font-bold transition-colors"
                  >
                    🏖️ Ferie / Riposo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('mattina')}
                    className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-yellow-500/20 text-yellow-200 text-[10px] font-semibold transition-colors"
                  >
                    🌅 Matt. (07-15)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('pomeriggio')}
                    className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-yellow-500/20 text-yellow-200 text-[10px] font-semibold transition-colors"
                  >
                    🌆 Pom. (14-22)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('notte')}
                    className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-yellow-500/20 text-yellow-200 text-[10px] font-semibold transition-colors"
                  >
                    🌙 Notte (22-06)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('ufficio')}
                    className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-yellow-500/20 text-yellow-200 text-[10px] font-semibold transition-colors"
                  >
                    🏢 Uff. (08:30-17)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('libero')}
                    className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold transition-colors"
                  >
                    ✨ Libero 24h
                  </button>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-yellow-500/20">
                <button
                  type="button"
                  onClick={() => handleRemoveDayException(activeDateStr)}
                  className="px-3 py-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-neutral-900 text-xs font-semibold transition-colors"
                >
                  Rimuovi Eccezione
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveDateStr(null)}
                    className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDay}
                    className="px-4 py-1.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black shadow-md transition-colors"
                  >
                    Salva Giorno
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Vacation Range Modal */}
        {showVacationRangeModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
            <div className="bg-[#121212] rounded-xl border border-rose-500/40 p-5 max-w-md w-full shadow-2xl space-y-4 text-yellow-100">
              <div className="flex items-center justify-between border-b border-rose-500/20 pb-3">
                <div className="flex items-center gap-2 text-rose-300">
                  <Palmtree className="w-5 h-5" />
                  <h3 className="font-extrabold text-base">Segna Periodo Ferie / Indisponibilità</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVacationRangeModal(false)}
                  className="p-1 text-neutral-400 hover:text-rose-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-neutral-300 leading-relaxed">
                Tutti i giorni compresi nell'intervallo verranno contrassegnati come <strong>Indisponibili Totale</strong> e l'operatore sarà automaticamente escluso dall'algoritmo di autoassegnazione per quelle date.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 mb-1">Da data:</label>
                  <input
                    type="date"
                    value={vacationStart}
                    onChange={(e) => setVacationStart(e.target.value)}
                    className="w-full bg-neutral-900 border border-yellow-500/30 rounded-lg px-2.5 py-1.5 text-xs text-yellow-200"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 mb-1">A data:</label>
                  <input
                    type="date"
                    value={vacationEnd}
                    onChange={(e) => setVacationEnd(e.target.value)}
                    className="w-full bg-neutral-900 border border-yellow-500/30 rounded-lg px-2.5 py-1.5 text-xs text-yellow-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-400 mb-1">Motivo:</label>
                <input
                  type="text"
                  value={vacationReason}
                  onChange={(e) => setVacationReason(e.target.value)}
                  placeholder="es. Ferie estive, Chiusura aziendale, Viaggio..."
                  className="w-full bg-neutral-900 border border-yellow-500/30 rounded-lg px-2.5 py-1.5 text-xs text-yellow-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowVacationRangeModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-900 text-neutral-300 text-xs font-semibold"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleApplyVacationRange}
                  className="px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-md"
                >
                  Applica Periodo Ferie
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Bottom Footer */}
        <div className="px-5 py-3.5 border-t border-yellow-500/25 bg-neutral-950 flex items-center justify-between gap-4">
          <div className="text-xs text-neutral-400">
            {scheduleDraft.length} eccezioni date salvate in totale
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold transition-colors"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleFinalSave}
              className="px-5 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black shadow-lg transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Salva e Applica al Profilo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
