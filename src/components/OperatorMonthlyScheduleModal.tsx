import React, { useState, useMemo, useEffect } from 'react';
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
  HelpCircle,
  Palmtree,
  Plus,
  Copy,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PrimaryWorkShiftDate, StaffMember } from '../types';
import { MESI_ITALIANI } from '../utils/dateUtils';

export interface OperatorMonthlyScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  operator: StaffMember | null;
  initialYear?: number;
  initialMonthIndex?: number;
  initialDateStr?: string;
}

interface DaySlotDraft {
  id: string;
  oraInizio: string;
  oraFine: string;
  motivo: string;
}

const SHORT_WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

export const OperatorMonthlyScheduleModal: React.FC<OperatorMonthlyScheduleModalProps> = ({
  isOpen,
  onClose,
  operator,
  initialYear,
  initialMonthIndex,
  initialDateStr,
}) => {
  const { updateStaff } = useApp();

  const [currentYear, setCurrentYear] = useState<number>(() => initialYear ?? new Date().getFullYear());
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(() => initialMonthIndex ?? new Date().getMonth()); // 0-11

  // Local draft of date-specific unavailabilities / primary shifts
  const [scheduleDraft, setScheduleDraft] = useState<PrimaryWorkShiftDate[]>([]);

  // Selected date for the Day Editor drawer/dialog
  const [activeDateStr, setActiveDateStr] = useState<string | null>(null);

  // Day editor state
  const [dayIndispTotale, setDayIndispTotale] = useState<boolean>(false);
  const [dayMotivoTotale, setDayMotivoTotale] = useState<string>('Ferie / Riposo');
  const [daySlots, setDaySlots] = useState<DaySlotDraft[]>([]);

  // Vacation Range Modal/Form state
  const [showVacationRangeModal, setShowVacationRangeModal] = useState<boolean>(false);
  const [vacationStart, setVacationStart] = useState<string>('');
  const [vacationEnd, setVacationEnd] = useState<string>('');
  const [vacationReason, setVacationReason] = useState<string>('Ferie / Riposo');

  // Sync draft when operator changes or modal opens
  useEffect(() => {
    if (operator) {
      setScheduleDraft(operator.indisponibilitaDate ? [...operator.indisponibilitaDate] : []);
    }
  }, [operator, isOpen]);

  useEffect(() => {
    if (initialYear !== undefined) setCurrentYear(initialYear);
    if (initialMonthIndex !== undefined) setCurrentMonthIndex(initialMonthIndex);
    if (initialDateStr) {
      handleOpenDayEditor(initialDateStr);
    }
  }, [initialYear, initialMonthIndex, initialDateStr, isOpen]);

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

  // Open day editor: load 1 slot by default if not previously saved
  const handleOpenDayEditor = (dateStr: string) => {
    setActiveDateStr(dateStr);
    const existingEntries = scheduleDraft.filter((item) => item.data === dateStr);

    if (existingEntries.length > 0) {
      const isTotal = existingEntries.some((item) => item.indisponibileTotale);
      setDayIndispTotale(isTotal);
      const totalEntry = existingEntries.find((item) => item.indisponibileTotale);
      setDayMotivoTotale(totalEntry?.motivo || 'Ferie / Riposo');

      const slots = existingEntries
        .filter((item) => !item.indisponibileTotale && item.oraInizio && item.oraFine)
        .map((item, idx) => ({
          id: item.id || `slot_${idx}_${Date.now()}`,
          oraInizio: item.oraInizio || '08:30',
          oraFine: item.oraFine || '17:00',
          motivo: item.motivo || '',
        }));

      if (slots.length === 0 && !isTotal) {
        slots.push({
          id: `slot_0_${Date.now()}`,
          oraInizio: '08:30',
          oraFine: '17:00',
          motivo: '',
        });
      }
      setDaySlots(slots);
    } else {
      // Nessun turno registrato per questa data: prendiamo solo 1 singola fascia come default
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const dow = dt.getDay();
      const weeklyShifts = operator.turniLavoroPrimario.filter((s) => s.giornoSettimana === dow);

      setDayIndispTotale(false);
      setDayMotivoTotale('Ferie / Riposo');

      if (weeklyShifts.length > 0) {
        const firstShift = weeklyShifts[0];
        setDaySlots([
          {
            id: `slot_0_${Date.now()}`,
            oraInizio: firstShift.oraInizio || '08:30',
            oraFine: firstShift.oraFine || '17:00',
            motivo: firstShift.descrizione || '',
          },
        ]);
      } else {
        setDaySlots([
          {
            id: `slot_0_${Date.now()}`,
            oraInizio: '08:30',
            oraFine: '17:00',
            motivo: '',
          },
        ]);
      }
    }
  };

  // Add another time slot to the active day
  const handleAddSlot = () => {
    let defStart = '14:00';
    let defEnd = '18:00';
    if (daySlots.length > 0) {
      const lastSlot = daySlots[daySlots.length - 1];
      if (lastSlot.oraFine && lastSlot.oraFine < '20:00') {
        defStart = lastSlot.oraFine;
        const [h, m] = defStart.split(':').map(Number);
        const endH = Math.min(23, h + 4);
        defEnd = `${String(endH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
      }
    }

    setDaySlots((prev) => [
      ...prev,
      {
        id: `slot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        oraInizio: defStart,
        oraFine: defEnd,
        motivo: '',
      },
    ]);
  };

  // Remove a slot
  const handleRemoveSlot = (id: string) => {
    setDaySlots((prev) => prev.filter((s) => s.id !== id));
  };

  // Update a slot
  const handleUpdateSlot = (id: string, field: 'oraInizio' | 'oraFine' | 'motivo', value: string) => {
    setDaySlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  // Save day editor
  const handleSaveDay = () => {
    if (!activeDateStr) return;

    let newEntries: PrimaryWorkShiftDate[] = [];

    if (dayIndispTotale) {
      newEntries.push({
        id: `indisp_total_${activeDateStr}`,
        data: activeDateStr,
        indisponibileTotale: true,
        motivo: dayMotivoTotale.trim() || 'Ferie / Riposo',
      });
    } else {
      if (daySlots.length > 0) {
        newEntries = daySlots
          .filter((slot) => slot.oraInizio && slot.oraFine)
          .map((slot) => ({
            id: slot.id,
            data: activeDateStr,
            indisponibileTotale: false,
            oraInizio: slot.oraInizio,
            oraFine: slot.oraFine,
            motivo: slot.motivo?.trim() || undefined,
          }));
      }
    }

    setScheduleDraft((prev) => {
      const otherDays = prev.filter((item) => item.data !== activeDateStr);
      return [...otherDays, ...newEntries];
    });

    setActiveDateStr(null);
  };

  // Remove all exceptions for this day
  const handleRemoveDayException = (dateStr: string) => {
    setScheduleDraft((prev) => prev.filter((item) => item.data !== dateStr));
    if (activeDateStr === dateStr) {
      setActiveDateStr(null);
    }
  };

  // Navigate to previous or next day in editor
  const handleNavigateDay = (direction: -1 | 1) => {
    if (!activeDateStr) return;
    const [y, m, d] = activeDateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d + direction);
    const nextDateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    handleOpenDayEditor(nextDateStr);
  };

  // Quick Presets
  const handleApplyPreset = (type: 'ferie' | 'mattina' | 'pomeriggio' | 'notte' | 'ufficio' | 'libero') => {
    if (!activeDateStr) return;

    if (type === 'ferie') {
      setDayIndispTotale(true);
      setDayMotivoTotale('Ferie / Riposo');
    } else if (type === 'libero') {
      setDayIndispTotale(false);
      setDaySlots([]);
      handleRemoveDayException(activeDateStr);
    } else {
      setDayIndispTotale(false);
      let pStart = '08:30';
      let pEnd = '17:00';
      let pMotivo = 'Orario Ufficio';

      if (type === 'mattina') {
        pStart = '07:00';
        pEnd = '15:00';
        pMotivo = 'Turno Mattina';
      } else if (type === 'pomeriggio') {
        pStart = '14:00';
        pEnd = '22:00';
        pMotivo = 'Turno Pomeriggio';
      } else if (type === 'notte') {
        pStart = '22:00';
        pEnd = '06:00';
        pMotivo = 'Turno Notturno';
      }

      if (daySlots.length <= 1) {
        setDaySlots([
          {
            id: `slot_preset_${Date.now()}`,
            oraInizio: pStart,
            oraFine: pEnd,
            motivo: pMotivo,
          },
        ]);
      } else {
        setDaySlots((prev) => [
          ...prev,
          {
            id: `slot_preset_${Date.now()}`,
            oraInizio: pStart,
            oraFine: pEnd,
            motivo: pMotivo,
          },
        ]);
      }
    }
  };

  // Copy active day configuration to all weekdays (Mon-Fri) of the month
  const handleCopyDayToAllWeekdays = () => {
    if (!activeDateStr) return;
    if (
      !window.confirm(
        `Vuoi applicare questa configurazione oraria a tutti i giorni dal Lunedì al Venerdì del mese di ${MESI_ITALIANI[currentMonthIndex]} ${currentYear}?`
      )
    ) {
      return;
    }

    const currentSlots = dayIndispTotale ? [] : daySlots.filter((s) => s.oraInizio && s.oraFine);
    const weekdaysOfThisMonth = daysInMonth.filter((d) => d.dayOfWeek >= 1 && d.dayOfWeek <= 5);
    const datesToUpdate = weekdaysOfThisMonth.map((d) => d.dateStr);

    const generatedEntries: PrimaryWorkShiftDate[] = [];
    datesToUpdate.forEach((dStr) => {
      if (dayIndispTotale) {
        generatedEntries.push({
          id: `indisp_total_${dStr}`,
          data: dStr,
          indisponibileTotale: true,
          motivo: dayMotivoTotale.trim() || 'Ferie / Riposo',
        });
      } else {
        currentSlots.forEach((s) => {
          generatedEntries.push({
            id: `slot_${dStr}_${Math.random().toString(36).substring(2, 6)}`,
            data: dStr,
            indisponibileTotale: false,
            oraInizio: s.oraInizio,
            oraFine: s.oraFine,
            motivo: s.motivo || undefined,
          });
        });
      }
    });

    setScheduleDraft((prev) => {
      const otherDays = prev.filter((item) => !datesToUpdate.includes(item.data));
      return [...otherDays, ...generatedEntries];
    });

    setActiveDateStr(null);
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
        id: `vacation_${d}`,
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

  // Apply default weekly schedule to this month: 1 single shift per day
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
          id: `weekly_applied_${dateStr}_${weekly.id}`,
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
    if (
      window.confirm(
        `Vuoi azzerare tutte le eccezioni e ferie impostate per ${MESI_ITALIANI[currentMonthIndex]} ${currentYear}?`
      )
    ) {
      setScheduleDraft((prev) => prev.filter((item) => !item.data.startsWith(monthKey)));
    }
  };

  // Save all changes to operator profile
  const handleFinalSave = () => {
    updateStaff({
      ...operator,
      indisponibilitaDate: scheduleDraft,
    });
    onClose();
  };

  // Monthly stats
  const monthItems = scheduleDraft.filter((item) => item.data.startsWith(monthKey));
  const countIndispTotaleDays = new Set(monthItems.filter((item) => item.indisponibileTotale).map((i) => i.data)).size;
  const countSpecificHoursDays = new Set(
    monthItems.filter((item) => !item.indisponibileTotale && item.oraInizio).map((i) => i.data)
  ).size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-5xl w-full border border-slate-200 shadow-2xl flex flex-col max-h-[94vh] overflow-hidden text-slate-900 my-auto">
        {/* Top Header */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/90 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shadow-2xs shrink-0 text-base"
              style={{ backgroundColor: operator.coloreBadge || '#2563eb' }}
            >
              {operator.nome[0]}
              {operator.cognome[0]}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-snug truncate">
                  Calendario Lavoro Primario &amp; Indisponibilità
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-yellow-400/20 dark:text-yellow-300 border border-blue-200 dark:border-yellow-500/30">
                  {operator.nome} {operator.cognome}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-neutral-400 font-normal truncate mt-0.5">
                Visualizzazione mese in mese con inserimento rapido di turni multipli o indisponibilità giornaliera.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="modal-header-btn-blue modal-close-btn-blue shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 hover:bg-red-600 active:scale-95 text-white transition-all cursor-pointer border border-blue-500 hover:border-red-500 shadow-md shadow-blue-500/25"
            style={{ backgroundColor: '#2563eb', color: '#ffffff', borderColor: '#1d4ed8' }}
            title="Chiudi"
            aria-label="Chiudi finestra"
          >
            <X className="w-5 h-5 text-white stroke-[2.5]" style={{ color: '#ffffff', stroke: '#ffffff' }} />
          </button>
        </div>

        {/* Month Selector & Quick Actions Bar */}
        <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row items-center justify-between gap-3 flex-wrap">
          {/* Month Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
              title="Mese precedente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-sm sm:text-base text-slate-900 uppercase tracking-wide min-w-[170px] text-center">
              {MESI_ITALIANI[currentMonthIndex]} {currentYear}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
              title="Mese successivo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleCurrentMonth}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors ml-1 cursor-pointer shadow-2xs"
            >
              Mese Corrente
            </button>
          </div>

          {/* Quick Batch Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowVacationRangeModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Segna un periodo consecutivo di ferie o indisponibilità"
            >
              <Palmtree className="w-3.5 h-3.5 text-rose-600" />
              <span>Segna Periodo Ferie</span>
            </button>

            <button
              type="button"
              onClick={handleApplyWeeklyToMonth}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Copia gli orari settimanali dell'anagrafica su tutti i feriali di questo mese"
            >
              <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
              <span>Applica Orario Standard al Mese</span>
            </button>

            {monthItems.length > 0 && (
              <button
                type="button"
                onClick={handleClearMonthExceptions}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Azzera tutte le eccezioni di questo mese"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Azzera Mese</span>
              </button>
            )}
          </div>
        </div>

        {/* Monthly Summary Badges */}
        <div className="px-5 py-2 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
              <span className="text-slate-600">Ferie / Tutto il giorno:</span>
              <strong className="text-rose-700 font-bold font-mono">{countIndispTotaleDays} gg</strong>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
              <span className="text-slate-600">Turni Specifici nel Mese:</span>
              <strong className="text-blue-700 font-bold font-mono">{countSpecificHoursDays} gg</strong>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
              <span className="text-slate-600">Orario Standard:</span>
              <strong className="text-slate-800 font-bold font-mono">{operator.turniLavoroPrimario.length} fasce/sett.</strong>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 italic flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>Clicca su qualsiasi giorno per inserire o modificare i turni</span>
          </div>
        </div>

        {/* Calendar Grid Container */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-slate-50/40">
          {/* Weekday Columns Header */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2 text-center">
            {SHORT_WEEKDAYS.map((w, idx) => (
              <div
                key={w}
                className={`py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg border ${
                  idx >= 5
                    ? 'text-slate-400 bg-slate-100/60 border-slate-200'
                    : 'text-slate-700 bg-white border-slate-200 shadow-2xs'
                }`}
              >
                {w}
              </div>
            ))}
          </div>

          {/* Month Days Grid */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 auto-rows-fr">
            {/* Empty slots before first day */}
            {Array.from({ length: firstDayWeekIndex }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-[85px] rounded-xl bg-slate-100/40 border border-slate-200/50 opacity-40 pointer-events-none"
              />
            ))}

            {/* Days of Month */}
            {daysInMonth.map(({ dateStr, dayNum, dayOfWeek }) => {
              const dayEntries = scheduleDraft.filter((item) => item.data === dateStr);
              const weeklyShifts = operator.turniLavoroPrimario.filter((s) => s.giornoSettimana === dayOfWeek);
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

              const isTotallyUnavailable = dayEntries.some((d) => d.indisponibileTotale);
              const totalEntry = dayEntries.find((d) => d.indisponibileTotale);
              const timeSlots = dayEntries.filter((d) => !d.indisponibileTotale && d.oraInizio && d.oraFine);
              const hasSpecificHours = timeSlots.length > 0;
              const hasWeeklyFallback = dayEntries.length === 0 && weeklyShifts.length > 0;

              return (
                <div
                  key={dateStr}
                  onClick={() => handleOpenDayEditor(dateStr)}
                  className={`min-h-[92px] rounded-xl border p-2 flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.015] hover:shadow-md relative select-none group ${
                    isTotallyUnavailable
                      ? 'bg-rose-50/80 border-rose-300 hover:border-rose-400'
                      : hasSpecificHours
                      ? 'bg-blue-50/80 border-blue-300 hover:border-blue-400'
                      : hasWeeklyFallback
                      ? 'bg-white border-slate-200 hover:border-blue-300'
                      : isWeekend
                      ? 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                      : 'bg-white border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  {/* Day Header */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-black w-6 h-6 rounded-md flex items-center justify-center ${
                        isTotallyUnavailable
                          ? 'bg-rose-600 text-white font-bold'
                          : hasSpecificHours
                          ? 'bg-blue-600 text-white font-bold'
                          : 'text-slate-800 group-hover:text-blue-600'
                      }`}
                    >
                      {dayNum}
                    </span>

                    {/* Quick indicator badge */}
                    {isTotallyUnavailable && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200 uppercase">
                        Ferie
                      </span>
                    )}
                    {hasSpecificHours && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">
                        {timeSlots.length > 1 ? `${timeSlots.length} Fasce` : 'Turno'}
                      </span>
                    )}
                  </div>

                  {/* Body: Status & Multiple Shifts Content */}
                  <div className="my-1 space-y-1 min-w-0">
                    {isTotallyUnavailable ? (
                      <div className="text-center p-1 rounded bg-rose-100/60 border border-rose-200">
                        <p className="text-[9.5px] font-bold text-rose-800 uppercase tracking-tight flex items-center justify-center gap-1">
                          <AlertOctagon className="w-2.5 h-2.5 text-rose-600" />
                          Indisponibile
                        </p>
                        <p className="text-[8.5px] text-rose-700 truncate mt-0.5">
                          {totalEntry?.motivo || 'Ferie / Riposo'}
                        </p>
                      </div>
                    ) : hasSpecificHours ? (
                      <div className="space-y-1">
                        {timeSlots.slice(0, 2).map((slot, idx) => (
                          <div
                            key={slot.id || idx}
                            className="p-1 rounded bg-blue-100/60 border border-blue-200 text-center"
                          >
                            <p className="text-[9.5px] font-mono font-bold text-blue-900 leading-tight">
                              {slot.oraInizio} - {slot.oraFine}
                            </p>
                            {slot.motivo && (
                              <p className="text-[8px] text-blue-700 truncate">{slot.motivo}</p>
                            )}
                          </div>
                        ))}
                        {timeSlots.length > 2 && (
                          <p className="text-[8px] text-blue-600 font-bold text-center">
                            +{timeSlots.length - 2} altre fasce
                          </p>
                        )}
                      </div>
                    ) : hasWeeklyFallback ? (
                      <div className="space-y-0.5">
                        <div className="p-1 rounded bg-slate-100/70 border border-slate-200 text-center">
                          <p className="text-[9px] font-mono font-medium text-slate-700 leading-tight">
                            {weeklyShifts[0].oraInizio} - {weeklyShifts[0].oraFine}
                          </p>
                          <p className="text-[8px] text-slate-400 truncate">Standard</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-1 rounded bg-emerald-50/50 border border-emerald-200">
                        <p className="text-[9.5px] font-bold text-emerald-700">🟢 Libero 24h</p>
                        <p className="text-[8px] text-slate-400 truncate mt-0.5">
                          {isWeekend ? 'Weekend' : 'Disp. sala'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Footer hint */}
                  <div className="text-[8px] text-slate-400 text-right truncate">
                    {dayEntries.length > 0 ? 'Modifica' : '+ Inserisci'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day Editor Modal (SENZA BARRA NERA - Stile chiaro, pulito e coordinato) */}
        {activeDateStr && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 max-w-lg w-full shadow-2xl space-y-4 text-slate-900 max-h-[92vh] overflow-y-auto">
              
              {/* Header with Day Navigator - Chiaro, luminoso, nessun riquadro nero */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 tracking-tight">
                      Giorno: {activeDateStr}
                    </h3>
                    <span className="text-[11px] text-slate-500">
                      Gestisci orari multipli o indisponibilità totale
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleNavigateDay(-1)}
                    className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer shadow-2xs"
                    title="Giorno precedente"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavigateDay(1)}
                    className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer shadow-2xs"
                    title="Giorno successivo"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDateStr(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg ml-1 cursor-pointer"
                    title="Chiudi editor giorno"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tasto Indisponibilità Tutto il Giorno */}
              <div
                className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                  dayIndispTotale
                    ? 'border-rose-300 bg-rose-50/70 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
                onClick={() => setDayIndispTotale(!dayIndispTotale)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={dayIndispTotale}
                    onChange={(e) => setDayIndispTotale(e.target.checked)}
                    className="w-5 h-5 mt-0.5 rounded border-rose-300 text-rose-600 focus:ring-rose-400 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-rose-900 flex items-center gap-1.5">
                        <AlertOctagon className="w-4 h-4 text-rose-600" />
                        Indisponibile Tutto il Giorno (Ferie / Riposo / Impegno)
                      </span>
                      {dayIndispTotale && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-600 text-white px-2 py-0.5 rounded-full">
                          Attivo
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-600 block mt-1 leading-snug">
                      Seleziona questa opzione se l'operatore non è disponibile per l'intera giornata (esclude autoassegnazione e turni sala).
                    </span>
                  </div>
                </div>

                {dayIndispTotale && (
                  <div className="mt-3 pt-2.5 border-t border-rose-200" onClick={(e) => e.stopPropagation()}>
                    <label className="block text-[11px] font-bold text-rose-800 mb-1">
                      Motivo Indisponibilità:
                    </label>
                    <input
                      type="text"
                      value={dayMotivoTotale}
                      onChange={(e) => setDayMotivoTotale(e.target.value)}
                      placeholder="es. Ferie estive, Giorno di riposo, Malattia, Permesso..."
                      className="w-full bg-white border border-rose-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                )}
              </div>

              {/* Se NON è indisponibile tutto il giorno -> Fasce Orarie Lavoro Primario */}
              {!dayIndispTotale && (
                <div className="space-y-3 p-3.5 rounded-xl border border-blue-200 bg-blue-50/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 uppercase tracking-wide">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>Fasce Orarie Lavoro Primario in questa Data</span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-mono font-bold">
                        {daySlots.length} {daySlots.length === 1 ? 'fascia' : 'fasce'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddSlot}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Aggiungi Altra Fascia</span>
                    </button>
                  </div>

                  {daySlots.length === 0 ? (
                    <div className="p-3 rounded-lg border border-dashed border-slate-300 bg-white text-center text-xs text-slate-500">
                      Nessuna fascia oraria inserita. L'operatore risulta libero per tutta la giornata.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                      {daySlots.map((slot, idx) => (
                        <div
                          key={slot.id}
                          className="p-2.5 rounded-lg bg-white border border-blue-200 shadow-2xs space-y-2"
                        >
                          <div className="flex items-center justify-between text-[11px] font-bold text-blue-800">
                            <span>Fascia #{idx + 1}</span>
                            {daySlots.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSlot(slot.id)}
                                className="text-rose-600 hover:text-rose-700 flex items-center gap-1 text-[10px] cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Elimina fascia</span>
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                            <div className="sm:col-span-2">
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Inizio Lavoro:
                              </label>
                              <input
                                type="time"
                                value={slot.oraInizio}
                                onChange={(e) => handleUpdateSlot(slot.id, 'oraInizio', e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 font-mono focus:outline-hidden focus:border-blue-500"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Fine Lavoro:
                              </label>
                              <input
                                type="time"
                                value={slot.oraFine}
                                onChange={(e) => handleUpdateSlot(slot.id, 'oraFine', e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 font-mono focus:outline-hidden focus:border-blue-500"
                              />
                            </div>

                            <div className="col-span-2 sm:col-span-1 flex items-end">
                              {daySlots.length === 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSlot(slot.id)}
                                  className="w-full py-1 text-slate-400 hover:text-rose-600 text-[10px] rounded hover:bg-slate-50 text-center cursor-pointer"
                                  title="Rimuovi orario"
                                >
                                  Rimuovi
                                </button>
                              )}
                            </div>
                          </div>

                          <div>
                            <input
                              type="text"
                              value={slot.motivo}
                              onChange={(e) => handleUpdateSlot(slot.id, 'motivo', e.target.value)}
                              placeholder="Mansione o motivo (es. Ufficio, Ospedale, Secondo turno...)"
                              className="w-full bg-white border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={handleAddSlot}
                      className="text-xs text-blue-700 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Inserisci altra fascia per questo stesso giorno</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyDayToAllWeekdays}
                      className="text-[11px] text-slate-500 hover:text-blue-700 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Applica questi orari a tutti i Lun-Ven del mese"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Applica a tutti i feriali del mese</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Preset Rapidi (1 Click) */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Preset Rapidi a 1 Click:
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('mattina')}
                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-semibold transition-colors cursor-pointer"
                  >
                    🌅 Matt. (07-15)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('pomeriggio')}
                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-semibold transition-colors cursor-pointer"
                  >
                    🌆 Pom. (14-22)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('notte')}
                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-semibold transition-colors cursor-pointer"
                  >
                    🌙 Notte (22-06)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('ufficio')}
                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-semibold transition-colors cursor-pointer"
                  >
                    🏢 Uff. (08:30-17)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('ferie')}
                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[10px] font-bold transition-colors cursor-pointer"
                  >
                    🏖️ Ferie Tutto il Giorno
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('libero')}
                    className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[10px] font-bold transition-colors cursor-pointer"
                  >
                    ✨ Rendi Libero 24h
                  </button>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleRemoveDayException(activeDateStr)}
                  className="px-3 py-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Azzera Giorno
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveDateStr(null)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDay}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md transition-colors cursor-pointer"
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
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 max-w-md w-full shadow-2xl space-y-4 text-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-rose-700">
                  <Palmtree className="w-5 h-5 text-rose-600" />
                  <h3 className="font-bold text-base text-slate-900">Segna Periodo Ferie / Indisponibilità</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVacationRangeModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Tutti i giorni compresi nell'intervallo verranno contrassegnati come <strong>Indisponibili Tutto il Giorno</strong> e l'operatore sarà automaticamente escluso da qualsiasi turno per quelle date.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Da data:</label>
                  <input
                    type="date"
                    value={vacationStart}
                    onChange={(e) => setVacationStart(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">A data:</label>
                  <input
                    type="date"
                    value={vacationEnd}
                    onChange={(e) => setVacationEnd(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Motivo:</label>
                <input
                  type="text"
                  value={vacationReason}
                  onChange={(e) => setVacationReason(e.target.value)}
                  placeholder="es. Ferie estive, Chiusura aziendale, Viaggio..."
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowVacationRangeModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleApplyVacationRange}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Applica Periodo Ferie
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Bottom Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            {scheduleDraft.length} voci registrate nel profilo
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleFinalSave}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
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
