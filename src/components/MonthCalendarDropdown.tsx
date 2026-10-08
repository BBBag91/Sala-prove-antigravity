import React, { useMemo, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Plus,
  RotateCcw,
  Calendar,
  ExternalLink,
  X,
} from 'lucide-react';
import { Booking } from '../types';
import {
  formatDateToISO,
  MESI_ITALIANI,
  getMonthCalendarGrid,
  formatDateItalian,
} from '../utils/dateUtils';

const WEEKDAY_INITIALS = [
  { letter: 'l', name: 'Lunedì' },
  { letter: 'm', name: 'Martedì' },
  { letter: 'm', name: 'Mercoledì' },
  { letter: 'g', name: 'Giovedì' },
  { letter: 'v', name: 'Venerdì' },
  { letter: 's', name: 'Sabato' },
  { letter: 'd', name: 'Domenica' },
];

export interface MonthCalendarDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate: Date;
  onSelectDate: (date: Date) => void;
  onOpenNewBooking: (dateStr: string) => void;
  onSwitchToMonthView?: () => void;
  onSwitchToDayView?: (date: Date) => void;
  bookings: Booking[];
  subtitle?: string;
}

export const MonthCalendarDropdown: React.FC<MonthCalendarDropdownProps> = ({
  isOpen,
  onClose,
  currentDate,
  onSelectDate,
  onOpenNewBooking,
  onSwitchToMonthView,
  onSwitchToDayView,
  bookings,
  subtitle = 'La musica fa...',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Mese visualizzato attualmente nel selettore rapido
  const [viewingDate, setViewingDate] = React.useState<Date>(() => currentDate);

  // Sincronizza viewingDate quando currentDate cambia esternamente
  useEffect(() => {
    setViewingDate(currentDate);
  }, [currentDate]);

  // Chiudi cliccando fuori o premendo Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const year = viewingDate.getFullYear();
  const month = viewingDate.getMonth();
  const monthLabel = MESI_ITALIANI[month].toLowerCase();

  const today = new Date();
  const todayStr = formatDateToISO(today);
  const selectedDateStr = formatDateToISO(currentDate);

  // Raggruppa tutte le prenotazioni per data
  const bookingsByDate = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    bookings.forEach(b => {
      if (!map[b.data]) map[b.data] = [];
      map[b.data].push(b);
    });
    return map;
  }, [bookings]);

  // Griglia del mese (lunedì-domenica)
  const calendarDays = useMemo(() => {
    return getMonthCalendarGrid(year, month);
  }, [year, month]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewingDate(d => {
      const next = new Date(d);
      next.setMonth(next.getMonth() - 1);
      return next;
    });
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewingDate(d => {
      const next = new Date(d);
      next.setMonth(next.getMonth() + 1);
      return next;
    });
  };

  const handleGoToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewingDate(today);
    onSelectDate(today);
  };

  const selectedDayBookings = bookingsByDate[selectedDateStr] || [];

  return (
    <div
      ref={containerRef}
      className="absolute top-full left-0 mt-2 z-50 w-full sm:w-[380px] bg-white dark:bg-[#0f0f0f] rounded-2xl shadow-2xl border border-slate-200 dark:border-yellow-500/40 p-4 animate-in fade-in slide-in-from-top-2 duration-150 select-none text-slate-900 dark:text-yellow-100"
    >
      {/* Header stile Google Calendar / Screenshot */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <div>
            <div className="flex items-center gap-1.5 cursor-pointer" onClick={onClose}>
              <h3 className="text-xl font-black lowercase text-slate-900 dark:text-yellow-100 tracking-tight flex items-center gap-1">
                <span>{monthLabel}</span>
                <ChevronUp className="w-4 h-4 text-blue-600 dark:text-yellow-400 stroke-[3]" />
              </h3>
              <span className="text-xs font-mono font-bold text-slate-400 dark:text-neutral-500">
                {year}
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-neutral-400 truncate max-w-[200px]">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Frecce Navigazione Mese */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 rounded-lg text-slate-600 dark:text-yellow-400 hover:text-blue-600 dark:hover:text-yellow-300 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Mese precedente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleGoToday}
            className="p-1 rounded-lg text-slate-600 dark:text-yellow-400 hover:text-blue-600 dark:hover:text-yellow-300 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer text-[10px] font-black"
            title="Oggi"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 rounded-lg text-slate-600 dark:text-yellow-400 hover:text-blue-600 dark:hover:text-yellow-300 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Mese successivo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="modal-header-btn-blue modal-close-btn-blue shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 hover:bg-red-600 active:scale-95 text-white transition-all cursor-pointer border border-blue-500 hover:border-red-500 shadow-sm ml-1"
            style={{ backgroundColor: '#2563eb', color: '#ffffff', borderColor: '#1d4ed8' }}
            title="Chiudi"
            aria-label="Chiudi finestra"
          >
            <X className="w-4 h-4 text-white stroke-[2.5]" style={{ color: '#ffffff', stroke: '#ffffff' }} />
          </button>
        </div>
      </div>

      {/* Intestazione giorni della settimana a singola lettera: l m m g v s d */}
      <div className="grid grid-cols-7 gap-1 py-2 text-center">
        {WEEKDAY_INITIALS.map((day, idx) => (
          <div
            key={idx}
            className="text-xs font-bold text-slate-600 dark:text-yellow-200/80 lowercase select-none"
            title={day.name}
          >
            {day.letter}
          </div>
        ))}
      </div>

      {/* Griglia giorni del mese */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((calDay) => {
          const dayBookings = bookingsByDate[calDay.dateStr] || [];
          const isSelected = calDay.dateStr === selectedDateStr;
          const isToday = calDay.dateStr === todayStr;
          const isCurrentMonth = calDay.isCurrentMonth;
          const bCount = dayBookings.length;

          const hasProve = dayBookings.some(b => b.tipo === 'prova');
          const hasLezioni = dayBookings.some(b => b.tipo === 'lezione');
          const hasPending = dayBookings.some(b => b.statoPagamento === 'da_saldare');

          return (
            <button
              key={calDay.dateStr}
              type="button"
              onClick={() => onSelectDate(calDay.date)}
              onDoubleClick={() => {
                onSelectDate(calDay.date);
                onOpenNewBooking(calDay.dateStr);
              }}
              className={`group flex flex-col items-center justify-start min-h-[44px] p-0.5 rounded-xl transition-all cursor-pointer ${
                !isCurrentMonth
                  ? 'opacity-25 hover:opacity-50 text-slate-400 dark:text-neutral-600'
                  : isSelected
                    ? 'bg-blue-50/50 dark:bg-yellow-400/10'
                    : 'hover:bg-slate-100 dark:hover:bg-neutral-900 text-slate-800 dark:text-neutral-200'
              }`}
            >
              {/* Cerchio del numero: se selezionato è cerchio solido blu come nello screenshot */}
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all ${
                  isSelected
                    ? 'bg-blue-600 dark:bg-yellow-400 text-white dark:text-black shadow-md shadow-blue-500/30 dark:shadow-yellow-500/30 font-black scale-105'
                    : isToday
                      ? 'text-blue-600 dark:text-yellow-400 font-black ring-2 ring-blue-500/60 dark:ring-yellow-400/70'
                      : ''
                }`}
              >
                {calDay.dayOfMonth}
              </div>

              {/* Pallini di stato (● ● +) */}
              <div className="flex items-center justify-center gap-0.5 mt-0.5 h-2.5">
                {bCount > 0 && (
                  <>
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        hasProve
                          ? 'bg-emerald-500 dark:bg-emerald-400'
                          : hasLezioni
                            ? 'bg-rose-500 dark:bg-rose-400'
                            : 'bg-slate-400 dark:bg-neutral-500'
                      }`}
                    />
                    {bCount >= 2 && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          hasLezioni && hasProve
                            ? 'bg-rose-500 dark:bg-rose-400'
                            : hasPending
                              ? 'bg-amber-500 dark:bg-amber-400'
                              : 'bg-emerald-500 dark:bg-emerald-400'
                        }`}
                      />
                    )}
                    {bCount > 2 && (
                      <span className="text-[9px] font-black text-slate-500 dark:text-neutral-400 leading-none">
                        +
                      </span>
                    )}
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Azioni rapide sul giorno selezionato */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-neutral-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-extrabold text-slate-800 dark:text-yellow-200 capitalize">
            {formatDateItalian(selectedDateStr, true)}
          </span>
          <span className="text-slate-500 dark:text-neutral-400 text-[11px] font-medium">
            {selectedDayBookings.length} {selectedDayBookings.length === 1 ? 'evento' : 'eventi'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              onOpenNewBooking(selectedDateStr);
              onClose();
            }}
            className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-yellow-400 dark:hover:bg-yellow-300 text-white dark:text-black font-black text-xs shadow-md shadow-blue-500/20 dark:shadow-yellow-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Aggiungi Evento</span>
          </button>

          {onSwitchToMonthView ? (
            <button
              type="button"
              onClick={() => {
                onSwitchToMonthView();
                onClose();
              }}
              className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-slate-800 dark:text-yellow-200 font-bold text-xs border border-slate-200 dark:border-neutral-700 transition-all cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Vista Tutto Mese</span>
            </button>
          ) : onSwitchToDayView ? (
            <button
              type="button"
              onClick={() => {
                onSwitchToDayView(currentDate);
                onClose();
              }}
              className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-slate-800 dark:text-yellow-200 font-bold text-xs border border-slate-200 dark:border-neutral-700 transition-all cursor-pointer"
            >
              <span>Vai al Giorno</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
