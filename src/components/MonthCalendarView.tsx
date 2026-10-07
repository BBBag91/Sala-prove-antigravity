import React, { useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  Clock,
  Sparkles,
  Music2,
  GraduationCap,
  RotateCcw,
  Pencil,
  Trash2,
  CreditCard,
  Banknote,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Booking, Room, StaffMember, PaymentMethod, PaymentStatus } from '../types';
import {
  formatDateToISO,
  parseISODate,
  MESI_ITALIANI,
  getMonthCalendarGrid,
  formatDateItalian,
  getHolidayOrSundayInfo,
} from '../utils/dateUtils';

// Abbreviazioni a singola lettera dei giorni della settimana (da Lunedì a Domenica) come nello screenshot di riferimento: l m m g v s d
const WEEKDAY_INITIALS = [
  { letter: 'l', name: 'Lunedì' },
  { letter: 'm', name: 'Martedì' },
  { letter: 'm', name: 'Mercoledì' },
  { letter: 'g', name: 'Giovedì' },
  { letter: 'v', name: 'Venerdì' },
  { letter: 's', name: 'Sabato' },
  { letter: 'd', name: 'Domenica' },
];

export interface MonthCalendarViewProps {
  currentDate: Date;
  onSelectDate: (date: Date) => void;
  onOpenNewBooking: (dateStr: string) => void;
  onOpenEditBooking: (booking: Booking, e: React.MouseEvent) => void;
  onDeleteBooking: (booking: Booking) => void;
  onQuickTogglePayment: (booking: Booking, forcedMethod?: PaymentMethod) => void;
  onSwitchToDayView?: (date: Date) => void;
  bookings: Booking[];
  rooms: Room[];
  staff: StaffMember[];
  isDark: boolean;
  isAdmin: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onGoToday: () => void;
}

export const MonthCalendarView: React.FC<MonthCalendarViewProps> = ({
  currentDate,
  onSelectDate,
  onOpenNewBooking,
  onOpenEditBooking,
  onDeleteBooking,
  onQuickTogglePayment,
  onSwitchToDayView,
  bookings,
  rooms,
  staff,
  isDark,
  isAdmin,
  onPrevMonth,
  onNextMonth,
  onGoToday,
}) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthLabel = MESI_ITALIANI[month].toLowerCase();
  const fullMonthLabel = MESI_ITALIANI[month];

  const today = new Date();
  const todayStr = formatDateToISO(today);
  const selectedDateStr = formatDateToISO(currentDate);

  // Mappa delle stanze per ID per accesso rapido a nome e colore
  const roomsById = useMemo(() => {
    const map = new Map<string, Room>();
    rooms.forEach(r => map.set(r.id, r));
    return map;
  }, [rooms]);

  // Raggruppa tutte le prenotazioni per data ISO 'YYYY-MM-DD'
  const bookingsByDate = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    bookings.forEach(b => {
      if (!map[b.data]) map[b.data] = [];
      map[b.data].push(b);
    });
    // Ordina le prenotazioni di ogni giorno per ora di inizio
    Object.keys(map).forEach(ds => {
      map[ds].sort((a, b) => a.oraInizio.localeCompare(b.oraInizio));
    });
    return map;
  }, [bookings]);

  // Griglia del mese (settimane complete 35 o 42 caselle, lunedì-domenica)
  const calendarDays = useMemo(() => {
    return getMonthCalendarGrid(year, month);
  }, [year, month]);

  // Statistiche del mese visualizzato
  const monthStats = useMemo(() => {
    let totalBookings = 0;
    let proveCount = 0;
    let lezioniCount = 0;
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;

    bookings.forEach(b => {
      if (b.data.startsWith(prefix)) {
        totalBookings++;
        if (b.tipo === 'prova') proveCount++;
        else if (b.tipo === 'lezione') lezioniCount++;
      }
    });

    return { totalBookings, proveCount, lezioniCount };
  }, [bookings, year, month]);

  // Prenotazioni del giorno attualmente selezionato
  const selectedDayBookings = bookingsByDate[selectedDateStr] || [];
  const holidayInfo = getHolidayOrSundayInfo(selectedDateStr);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Barra superiore di controllo Mese */}
      <div className="bg-white dark:bg-[#0c0c0c] rounded-2xl border border-slate-200 dark:border-yellow-500/25 p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Navigatore Mese */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center bg-slate-100 dark:bg-neutral-900 rounded-xl p-1 border border-slate-200 dark:border-yellow-500/30">
            <button
              type="button"
              onClick={onPrevMonth}
              className="p-1.5 sm:p-2 rounded-lg text-slate-700 dark:text-yellow-400 hover:text-blue-600 dark:hover:text-yellow-300 hover:bg-white dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Mese precedente"
              aria-label="Mese precedente"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              type="button"
              onClick={onGoToday}
              className="px-2.5 sm:px-3 py-1 rounded-lg text-xs font-black text-slate-700 dark:text-yellow-400 hover:text-blue-600 dark:hover:text-yellow-300 hover:bg-white dark:hover:bg-neutral-800 transition-colors cursor-pointer flex items-center gap-1"
              title="Vai al mese e giorno corrente"
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-600 dark:text-yellow-400" />
              <span>Oggi</span>
            </button>
            <button
              type="button"
              onClick={onNextMonth}
              className="p-1.5 sm:p-2 rounded-lg text-slate-700 dark:text-yellow-400 hover:text-blue-600 dark:hover:text-yellow-300 hover:bg-white dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Mese successivo"
              aria-label="Mese successivo"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-yellow-100 capitalize tracking-tight flex items-center gap-1.5">
              <span>{monthLabel}</span>
              <span className="text-slate-500 dark:text-yellow-400/80 font-bold">{year}</span>
            </h2>
            {selectedDateStr === todayStr && (
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 dark:bg-yellow-400/20 text-blue-700 dark:text-yellow-300 border border-blue-200 dark:border-yellow-500/40">
                Mese in corso
              </span>
            )}
          </div>
        </div>

        {/* Statistiche e Azione Rapida Nuovo Evento */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end flex-wrap">
          <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-neutral-400 bg-slate-50 dark:bg-neutral-900/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-yellow-500/20">
            <span className="font-bold text-slate-900 dark:text-yellow-200">{monthStats.totalBookings}</span> eventi nel mese
            <span className="text-slate-300 dark:text-neutral-700">&bull;</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{monthStats.proveCount}</span> prove
            <span className="text-slate-300 dark:text-neutral-700">&bull;</span>
            <span className="text-rose-600 dark:text-rose-400 font-bold">{monthStats.lezioniCount}</span> lezioni
          </div>

          <button
            type="button"
            onClick={() => onOpenNewBooking(selectedDateStr)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-yellow-400 dark:hover:bg-yellow-300 text-white dark:text-black font-extrabold text-xs sm:text-sm shadow-md shadow-blue-500/25 dark:shadow-yellow-500/25 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Nuovo Evento per il {currentDate.getDate()} {fullMonthLabel.substring(0, 3)}</span>
          </button>
        </div>
      </div>

      {/* Layout a due colonne su Desktop: Calendario Mensile + Dettaglio Giorno Selezionato */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Colonna Sinistra (7 col / 12 col): Il Calendario Mensile stile Google Calendar / Screenshot */}
        <div className="lg:col-span-7 xl:col-span-6 bg-white dark:bg-[#0c0c0c] rounded-2xl border border-slate-200 dark:border-yellow-500/25 p-4 sm:p-6 shadow-sm flex flex-col justify-between">
          <div>
            {/* Header Mese & Tagline identico al riferimento visivo */}
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100 dark:border-neutral-900 mb-3 sm:mb-4">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-yellow-100 capitalize tracking-tight flex items-center gap-2">
                  <span>{monthLabel}</span>
                  <span className="text-blue-600 dark:text-yellow-400 text-sm font-bold">^</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium">
                  Seleziona un giorno per visualizzare o inserire gli eventi
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs font-mono font-bold text-slate-400 dark:text-yellow-400/60">
                  {year}
                </span>
              </div>
            </div>

            {/* Riga Intestazione Giorni: l m m g v s d (esattamente come nello screenshot!) */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 sm:mb-3">
              {WEEKDAY_INITIALS.map((day, idx) => (
                <div
                  key={idx}
                  className="text-center py-1 text-sm sm:text-base font-extrabold text-slate-700 dark:text-yellow-200/90 lowercase select-none"
                  title={day.name}
                >
                  {day.letter}
                </div>
              ))}
            </div>

            {/* Griglia Giorni Mese */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {calendarDays.map((calDay) => {
                const dayBookings = bookingsByDate[calDay.dateStr] || [];
                const isSelected = calDay.dateStr === selectedDateStr;
                const isToday = calDay.dateStr === todayStr;
                const isCurrentMonth = calDay.isCurrentMonth;
                const bCount = dayBookings.length;

                // Calcolo dei pallini colorati per il giorno (Verde = Prove, Rosso = Lezioni, ecc.)
                const hasProve = dayBookings.some(b => b.tipo === 'prova');
                const hasLezioni = dayBookings.some(b => b.tipo === 'lezione');
                const hasPending = dayBookings.some(b => b.statoPagamento === 'da_saldare');

                return (
                  <button
                    key={calDay.dateStr}
                    type="button"
                    onClick={() => onSelectDate(calDay.date)}
                    onDoubleClick={() => onOpenNewBooking(calDay.dateStr)}
                    className={`group relative flex flex-col items-center justify-start min-h-[52px] sm:min-h-[64px] p-1 rounded-xl transition-all cursor-pointer touch-manipulation select-none ${
                      !isCurrentMonth
                        ? 'opacity-25 hover:opacity-50 text-slate-400 dark:text-neutral-600'
                        : isSelected
                          ? 'ring-2 ring-blue-500/40 dark:ring-yellow-400/50 bg-blue-50/50 dark:bg-yellow-400/5'
                          : 'hover:bg-slate-100 dark:hover:bg-neutral-900/80 text-slate-800 dark:text-neutral-200'
                    }`}
                    title={`${calDay.dayOfMonth} ${MESI_ITALIANI[calDay.date.getMonth()]} - ${bCount} eventi (Doppio clic per aggiungere evento)`}
                  >
                    {/* Cerchio del numero del giorno: se selezionato è pieno blu (#0284c7 / #2563eb) con testo bianco proprio come nello screenshot! */}
                    <div
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm sm:text-base font-extrabold transition-transform group-hover:scale-105 ${
                        isSelected
                          ? 'bg-blue-600 dark:bg-yellow-400 text-white dark:text-black shadow-md shadow-blue-500/30 dark:shadow-yellow-500/30 font-black'
                          : isToday
                            ? 'text-blue-600 dark:text-yellow-400 font-black ring-2 ring-blue-500/60 dark:ring-yellow-400/70'
                            : ''
                      }`}
                    >
                      {calDay.dayOfMonth}
                    </div>

                    {/* Indicatori / Pallini di stato eventi (● ● +) come nello screenshot di riferimento */}
                    <div className="flex items-center justify-center gap-0.5 mt-1 h-3">
                      {bCount > 0 && (
                        <>
                          {/* Primo pallino (preferenza prove o lezioni) */}
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              hasProve
                                ? 'bg-emerald-500 dark:bg-emerald-400'
                                : hasLezioni
                                  ? 'bg-rose-500 dark:bg-rose-400'
                                  : 'bg-slate-400 dark:bg-neutral-500'
                            }`}
                          />

                          {/* Secondo pallino se ci sono almeno 2 eventi */}
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

                          {/* Simbolo '+' se ci sono più di 2 eventi, esattamente come nello screenshot */}
                          {bCount > 2 && (
                            <span className="text-[10px] font-black text-slate-500 dark:text-neutral-400 leading-none ml-0.5">
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
          </div>

          {/* Legenda in fondo al calendario */}
          <div className="pt-4 mt-3 border-t border-slate-100 dark:border-neutral-900 flex items-center justify-between text-[11px] text-slate-500 dark:text-neutral-400 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Prove Band</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Lezioni</span>
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-slate-600 dark:text-neutral-300">
                <span>+</span>
                <span>Più di 2 eventi</span>
              </span>
            </div>

            <div className="text-[10px] text-slate-400 dark:text-neutral-500 hidden sm:block">
              Doppio clic sul giorno per aggiungere subito
            </div>
          </div>
        </div>

        {/* Colonna Destra (5 col / 12 col): Dettaglio Giorno Selezionato & Gestione Eventi */}
        <div className="lg:col-span-5 xl:col-span-6 bg-white dark:bg-[#0c0c0c] rounded-2xl border border-slate-200 dark:border-yellow-500/25 p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            {/* Intestazione Giorno Selezionato con Bottone Aggiungi */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-yellow-500/20 gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-extrabold tracking-wider text-blue-600 dark:text-yellow-400">
                    Giorno Selezionato
                  </span>
                  {selectedDateStr === todayStr && (
                    <span className="px-2 py-0.2 rounded-full text-[9px] font-black uppercase bg-blue-100 dark:bg-yellow-400/20 text-blue-700 dark:text-yellow-300 border border-blue-200 dark:border-yellow-500/40">
                      Oggi
                    </span>
                  )}
                  {holidayInfo.isHolidayOrSunday && (
                    <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-400/20 text-amber-800 dark:text-amber-300">
                      {holidayInfo.name || 'Festivo'}
                    </span>
                  )}
                </div>

                <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-yellow-100 capitalize mt-0.5">
                  {formatDateItalian(selectedDateStr, true)}
                </h3>
                <p className="text-xs text-slate-500 dark:text-neutral-400">
                  {selectedDayBookings.length === 0
                    ? 'Nessun evento in programma'
                    : selectedDayBookings.length === 1
                      ? '1 prenotazione registrata'
                      : `${selectedDayBookings.length} prenotazioni registrate`}
                </p>
              </div>

              {/* Azioni rapide per il giorno */}
              <div className="flex items-center gap-1.5 shrink-0">
                {onSwitchToDayView && (
                  <button
                    type="button"
                    onClick={() => onSwitchToDayView(currentDate)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-slate-700 dark:text-yellow-300 text-xs font-bold transition-all cursor-pointer"
                    title="Apri vista oraria dettagliata per questo giorno"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Vista 1G</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onOpenNewBooking(selectedDateStr)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-yellow-400 dark:hover:bg-yellow-300 text-white dark:text-black text-xs font-black shadow-md shadow-blue-500/25 dark:shadow-yellow-500/25 transition-all active:scale-95 cursor-pointer"
                  title="Aggiungi prenotazione per questo giorno"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Aggiungi Evento</span>
                </button>
              </div>
            </div>

            {/* Lista Prenotazioni del Giorno */}
            <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
              {selectedDayBookings.length === 0 ? (
                /* Stato vuoto accattivante */
                <div className="py-10 px-4 text-center border-2 border-dashed border-slate-200 dark:border-neutral-800 rounded-2xl bg-slate-50/50 dark:bg-neutral-950/40 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-yellow-400/10 text-blue-600 dark:text-yellow-400 mx-auto flex items-center justify-center">
                    <CalendarDays className="w-6 h-6 stroke-[1.5]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-yellow-100">
                      Nessuna prenotazione per questo giorno
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-neutral-400 max-w-xs mx-auto mt-0.5">
                      Tutte le sale sono disponibili. Clicca sul pulsante sottostante per aggiungere una nuova sessione.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenNewBooking(selectedDateStr)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-yellow-400 dark:hover:bg-yellow-300 text-white dark:text-black font-extrabold text-xs shadow-md shadow-blue-500/20 dark:shadow-yellow-500/20 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Crea Prenotazione per il {currentDate.getDate()} {fullMonthLabel.substring(0, 3)}</span>
                  </button>
                </div>
              ) : (
                /* Elenco Prenotazioni */
                selectedDayBookings.map((b) => {
                  const room = roomsById.get(b.salaId);
                  const roomColor = room?.colore || '#2563eb';
                  const isLesson = b.tipo === 'lezione';
                  const isPaid = b.statoPagamento === 'pagato';

                  return (
                    <div
                      key={b.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950/80 hover:border-blue-300 dark:hover:border-yellow-500/40 transition-all space-y-2 group shadow-2xs"
                    >
                      {/* Riga Superiore: Orario, Sala, Tipo e Pagamento */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Badge Orario */}
                          <span className="inline-flex items-center gap-1 font-mono text-xs font-black text-slate-900 dark:text-yellow-200 bg-white dark:bg-neutral-900 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-neutral-800">
                            <Clock className="w-3 h-3 text-blue-600 dark:text-yellow-400" />
                            <span>{b.oraInizio} - {b.oraFine}</span>
                          </span>

                          {/* Pill Sala */}
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-md text-white shadow-2xs"
                            style={{ backgroundColor: roomColor }}
                          >
                            <span>{b.salaNome}</span>
                          </span>

                          {/* Tipo: Prova o Lezione */}
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              isLesson
                                ? 'bg-rose-100 dark:bg-rose-400/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
                                : 'bg-emerald-100 dark:bg-emerald-400/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                            }`}
                          >
                            {isLesson ? (
                              <>
                                <GraduationCap className="w-3 h-3" />
                                <span>Lezione</span>
                              </>
                            ) : (
                              <>
                                <Music2 className="w-3 h-3" />
                                <span>Prova</span>
                              </>
                            )}
                          </span>
                        </div>

                        {/* Badge Pagamento interattivo */}
                        <button
                          type="button"
                          onClick={() => onQuickTogglePayment(b)}
                          className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                            isPaid
                              ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600 shadow-2xs'
                              : 'bg-amber-100 dark:bg-amber-400/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 hover:bg-amber-200'
                          }`}
                          title={`Stato: ${isPaid ? 'Pagato' : 'Da Saldare'} (Clicca per invertire)`}
                        >
                          <CreditCard className="w-2.5 h-2.5" />
                          <span>{isPaid ? 'Pagato' : 'Da Saldare'}</span>
                        </button>
                      </div>

                      {/* Riga Centrale: Nome Band / Cliente & Operatore */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h5 className="font-black text-slate-900 dark:text-yellow-100 text-sm truncate">
                            {b.clienteNome}
                          </h5>
                          {b.operatoreAssegnatoNome ? (
                            <p className="text-[11px] text-slate-500 dark:text-neutral-400 truncate">
                              Op: <span className="font-bold text-slate-700 dark:text-yellow-300">{b.operatoreAssegnatoNome}</span>
                            </p>
                          ) : (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                              Nessun operatore assegnato
                            </p>
                          )}
                        </div>

                        {/* Tariffa */}
                        <div className="text-right shrink-0">
                          <span className="font-black text-slate-900 dark:text-yellow-200 text-sm">
                            €{b.tariffaTotale}
                          </span>
                        </div>
                      </div>

                      {/* Riga Azioni: Modifica ed Elimina */}
                      <div className="pt-2 border-t border-slate-200/60 dark:border-neutral-900 flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => onOpenEditBooking(b, e)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 hover:border-blue-300 dark:hover:border-yellow-400 text-slate-700 dark:text-yellow-300 hover:text-blue-600 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                          title="Modifica dettagli prenotazione"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Modifica</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteBooking(b)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 hover:border-red-300 dark:hover:border-red-500/50 text-slate-500 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-400 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                          title="Elimina prenotazione"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Elimina</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Riepilogo giorno */}
          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-neutral-900 text-xs text-slate-500 dark:text-neutral-400 flex items-center justify-between">
            <span>Totale incasso giorno:</span>
            <span className="font-black text-slate-900 dark:text-yellow-300 text-sm">
              €{selectedDayBookings.reduce((sum, b) => sum + (b.tariffaTotale || 0), 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
