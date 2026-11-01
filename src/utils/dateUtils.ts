export const GIORNI_SETTIMANA = [
  'Domenica',
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato',
];

export const GIORNI_SETTIMANA_BREVI = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

// Standard European starting on Monday (Lun = 1, Dom = 0)
export const GIORNI_CALENDARIO = [
  { index: 1, label: 'Lunedì', short: 'Lun' },
  { index: 2, label: 'Martedì', short: 'Mar' },
  { index: 3, label: 'Mercoledì', short: 'Mer' },
  { index: 4, label: 'Giovedì', short: 'Gio' },
  { index: 5, label: 'Venerdì', short: 'Ven' },
  { index: 6, label: 'Sabato', short: 'Sab' },
  { index: 0, label: 'Domenica', short: 'Dom' },
];

export const MESI_ITALIANI = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

/**
 * Converte un oggetto Date nativo in stringa standard ISO 'YYYY-MM-DD'.
 * @param date Oggetto Date da formattare
 * @returns Stringa formattata (es. '2026-10-03')
 */
export function formatDateToISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Esegue il parsing di una stringa 'YYYY-MM-DD' in oggetto Date a mezzanotte locale (senza offset UTC).
 * @param dateStr Stringa data ISO
 * @returns Oggetto Date locale
 */
export function parseISODate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Formatta una data ISO in formato testuale esteso italiano (es. 'Sabato 3 Ottobre 2026').
 * @param dateStr Data ISO 'YYYY-MM-DD'
 * @param includeDayName Se true, include il nome del giorno della settimana
 * @returns Stringa leggibile in italiano
 */
export function formatDateItalian(dateStr: string, includeDayName: boolean = true): string {
  if (!dateStr) return '';
  const date = parseISODate(dateStr);
  const dayName = GIORNI_SETTIMANA[date.getDay()];
  const day = date.getDate();
  const month = MESI_ITALIANI[date.getMonth()];
  const year = date.getFullYear();
  if (includeDayName) {
    return `${dayName} ${day} ${month} ${year}`;
  }
  return `${day} ${month} ${year}`;
}

/**
 * Converte un orario in formato 'HH:mm' nel numero totale di minuti trascorsi da mezzanotte (0-1440).
 * @param timeStr Orario in formato 'HH:mm' (es. '18:30')
 * @returns Minuti totali (es. 1110)
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

/**
 * Converte un valore in minuti (es. 1110) in stringa oraria 'HH:mm' (es. '18:30').
 * @param totalMinutes Minuti da convertire
 * @returns Stringa formattata 'HH:mm'
 */
export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Calcola la durata in ore decimali tra due orari 'HH:mm', gestendo anche passaggi oltre la mezzanotte.
 * @param startTime Orario di inizio 'HH:mm'
 * @param endTime Orario di fine 'HH:mm'
 * @returns Durata arrotondata a 2 decimali (es. 2.5 per 2 ore e 30 minuti)
 */
export function calculateDurationHours(startTime: string, endTime: string): number {
  const startMin = timeToMinutes(startTime);
  let endMin = timeToMinutes(endTime);
  if (endMin < startMin) {
    // Gestione scavallamento oltre mezzanotte (es. dalle 22:00 alle 01:00)
    endMin += 24 * 60;
  }
  const diffMinutes = Math.max(0, endMin - startMin);
  return Math.round((diffMinutes / 60) * 100) / 100;
}

export interface CalendarDay {
  date: Date;
  dateStr: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  dayOfWeek: number;
}

export function getMonthCalendarGrid(year: number, month: number): CalendarDay[] {
  const todayStr = formatDateToISO(new Date());
  
  // First day of target month
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // European week starts on Monday: Monday is index 1, Sunday is index 0
  let firstDayIndex = firstDayOfMonth.getDay(); // 0 is Sunday, 1 is Monday...
  // Convert so Monday = 0, ..., Sunday = 6
  let leadingDaysCount = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const days: CalendarDay[] = [];

  // Previous month trailing days
  for (let i = leadingDaysCount; i > 0; i--) {
    const prevDate = new Date(year, month, 1 - i);
    const dateStr = formatDateToISO(prevDate);
    days.push({
      date: prevDate,
      dateStr,
      dayOfMonth: prevDate.getDate(),
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      dayOfWeek: prevDate.getDay(),
    });
  }

  // Days of current month
  for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
    const currentDate = new Date(year, month, day);
    const dateStr = formatDateToISO(currentDate);
    days.push({
      date: currentDate,
      dateStr,
      dayOfMonth: day,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      dayOfWeek: currentDate.getDay(),
    });
  }

  // Trailing days of next month to complete standard 35 or 42 grid
  const totalSlots = days.length > 35 ? 42 : 35;
  const remainingDays = totalSlots - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    const nextDate = new Date(year, month + 1, i);
    const dateStr = formatDateToISO(nextDate);
    days.push({
      date: nextDate,
      dateStr,
      dayOfMonth: i,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      dayOfWeek: nextDate.getDay(),
    });
  }

  return days;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function generateRecurrenceDates(
  startDateStr: string,
  config: {
    attiva: boolean;
    frequenza: 'nessuna' | 'giornaliera' | 'settimanale' | 'mensile';
    intervallo: number;
    giorniSettimana: number[];
    tipoFine: 'fino_al' | 'conteggio' | 'per_sempre';
    dataFine?: string;
    conteggioOccorrenze?: number;
  }
): string[] {
  if (!config.attiva || config.frequenza === 'nessuna') {
    return [startDateStr];
  }

  const result: string[] = [];
  const baseDate = parseISODate(startDateStr);
  const maxLimit = 52; // Safety cap: max 52 occurrences (~1 year)

  const targetCount = config.tipoFine === 'conteggio'
    ? Math.min(config.conteggioOccorrenze || 4, maxLimit)
    : config.tipoFine === 'per_sempre'
      ? 52 // 1 anno intero di sessioni continuative
      : maxLimit;

  const untilDate = config.tipoFine === 'fino_al' && config.dataFine
    ? parseISODate(config.dataFine)
    : null;

  if (config.frequenza === 'settimanale') {
    const interval = Math.max(1, config.intervallo || 1);
    const selectedDays = config.giorniSettimana && config.giorniSettimana.length > 0
      ? config.giorniSettimana
      : [baseDate.getDay()];

    let currentWeekStart = new Date(baseDate);
    const dayOfWeek = currentWeekStart.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    currentWeekStart.setDate(currentWeekStart.getDate() + diffToMonday);

    let weekIndex = 0;
    while (result.length < targetCount && weekIndex < 100) {
      if (weekIndex % interval === 0) {
        for (let d = 0; d < 7; d++) {
          const checkDate = new Date(currentWeekStart);
          checkDate.setDate(currentWeekStart.getDate() + d);
          const dayIndex = checkDate.getDay();

          if (selectedDays.includes(dayIndex)) {
            const iso = formatDateToISO(checkDate);
            if (iso >= startDateStr) {
              if (untilDate && checkDate > untilDate) {
                return result.length > 0 ? result : [startDateStr];
              }
              if (!result.includes(iso)) {
                result.push(iso);
                if (result.length >= targetCount) break;
              }
            }
          }
        }
      }
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
      weekIndex++;
    }
  } else if (config.frequenza === 'giornaliera') {
    const interval = Math.max(1, config.intervallo || 1);
    let cur = new Date(baseDate);
    while (result.length < targetCount) {
      if (untilDate && cur > untilDate) break;
      result.push(formatDateToISO(cur));
      cur.setDate(cur.getDate() + interval);
    }
  } else if (config.frequenza === 'mensile') {
    const interval = Math.max(1, config.intervallo || 1);
    let cur = new Date(baseDate);
    while (result.length < targetCount) {
      if (untilDate && cur > untilDate) break;
      result.push(formatDateToISO(cur));
      cur.setMonth(cur.getMonth() + interval);
    }
  }

  if (result.length === 0) {
    result.push(startDateStr);
  }
  return result;
}

export function getRecurrenceSummary(
  config: {
    attiva: boolean;
    frequenza: 'nessuna' | 'giornaliera' | 'settimanale' | 'mensile';
    intervallo: number;
    giorniSettimana: number[];
    tipoFine: 'fino_al' | 'conteggio' | 'per_sempre';
    dataFine?: string;
    conteggioOccorrenze?: number;
  },
  startDateStr: string
): string {
  if (!config.attiva || config.frequenza === 'nessuna') {
    return 'Non si ripete';
  }

  const daysMap: Record<number, string> = {
    1: 'LUN', 2: 'MAR', 3: 'MER', 4: 'GIO', 5: 'VEN', 6: 'SAB', 0: 'DOM'
  };

  const daysStr = (config.giorniSettimana || [])
    .map(d => daysMap[d])
    .filter(Boolean)
    .join(', ');

  const dates = generateRecurrenceDates(startDateStr, config);
  const count = dates.length;
  const lastDate = dates[dates.length - 1];

  let freqStr = 'Ogni settimana';
  if (config.frequenza === 'giornaliera') {
    freqStr = config.intervallo > 1 ? `Ogni ${config.intervallo} giorni` : 'Ogni giorno';
  } else if (config.frequenza === 'mensile') {
    freqStr = config.intervallo > 1 ? `Ogni ${config.intervallo} mesi` : 'Ogni mese';
  } else if (config.intervallo > 1) {
    freqStr = `Ogni ${config.intervallo} settimane`;
  }

  let endStr = '';
  if (config.tipoFine === 'fino_al') {
    endStr = `fino al ${config.dataFine || lastDate}`;
  } else if (config.tipoFine === 'conteggio') {
    endStr = `${count} sessioni`;
  } else {
    endStr = 'Per sempre';
  }

  if (config.frequenza === 'settimanale') {
    return `${freqStr} [${daysStr}] • ${endStr}`;
  }
  return `${freqStr} • ${endStr}`;
}

/**
 * Calcola la data di Pasqua per un dato anno (Algoritmo Meeus/Jones/Butcher).
 */
export function getEasterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = Marzo, 4 = Aprile
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

export interface HolidayOrSundayInfo {
  isHolidayOrSunday: boolean;
  isSunday: boolean;
  isHoliday: boolean;
  name: string; // e.g. "Natale", "Pasqua", "1 Maggio", "2 Giugno", "Domenica"
  shortBadge: string; // e.g. "Natale", "Pasqua", "1 Maggio", "Domenica"
}

export const FIXED_HOLIDAYS_MAP: Record<string, string> = {
  '01-01': 'Capodanno',
  '01-06': 'Epifania',
  '04-25': '25 Aprile (Liberazione)',
  '05-01': '1 Maggio (Festa Lavoratori)',
  '06-02': '2 Giugno (Festa Repubblica)',
  '08-15': 'Ferragosto (Assunzione)',
  '11-01': '1 Novembre (Tutti i Santi)',
  '12-08': '8 Dicembre (Immacolata)',
  '12-25': 'Natale',
  '12-26': 'Santo Stefano',
};

/**
 * Restituisce i dettagli completi se una data è festività nazionale italiana o Domenica.
 * Identifica i giorni segnati in rosso sul calendario (Natale, Pasqua, 1 Maggio, 2 Giugno, ecc.)
 * e tutte le domeniche.
 */
export function getHolidayOrSundayInfo(dateOrStr: Date | string): HolidayOrSundayInfo {
  let date: Date;
  if (typeof dateOrStr === 'string') {
    const [y, m, d] = dateOrStr.split('-').map(Number);
    date = new Date(y, m - 1, d);
  } else {
    date = dateOrStr;
  }

  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();
  const dayOfWeek = date.getDay(); // 0 = Domenica

  const isSunday = dayOfWeek === 0;

  // 1. Festività fisse nazionali italiane (MM-DD)
  const monthDayStr = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (FIXED_HOLIDAYS_MAP[monthDayStr]) {
    const holName = FIXED_HOLIDAYS_MAP[monthDayStr];
    return {
      isHolidayOrSunday: true,
      isSunday,
      isHoliday: true,
      name: isSunday ? `${holName} (Domenica)` : holName,
      shortBadge: holName.split(' ')[0],
    };
  }

  // 2. Pasqua e Pasquetta (calcolo mobile su anno)
  const easter = getEasterSunday(year);
  const easterDate = new Date(year, easter.month - 1, easter.day);
  const pasquettaDate = new Date(year, easter.month - 1, easter.day + 1);

  if (
    date.getFullYear() === easterDate.getFullYear() &&
    date.getMonth() === easterDate.getMonth() &&
    date.getDate() === easterDate.getDate()
  ) {
    return {
      isHolidayOrSunday: true,
      isSunday: true,
      isHoliday: true,
      name: 'Pasqua',
      shortBadge: 'Pasqua',
    };
  }

  if (
    date.getFullYear() === pasquettaDate.getFullYear() &&
    date.getMonth() === pasquettaDate.getMonth() &&
    date.getDate() === pasquettaDate.getDate()
  ) {
    return {
      isHolidayOrSunday: true,
      isSunday: false,
      isHoliday: true,
      name: "Lunedì dell'Angelo (Pasquetta)",
      shortBadge: 'Pasquetta',
    };
  }

  // 3. Tutte le domeniche
  if (isSunday) {
    return {
      isHolidayOrSunday: true,
      isSunday: true,
      isHoliday: false,
      name: 'Domenica',
      shortBadge: 'Domenica',
    };
  }

  return {
    isHolidayOrSunday: false,
    isSunday: false,
    isHoliday: false,
    name: '',
    shortBadge: '',
  };
}

/**
 * Restituisce true se la data corrisponde a una festività nazionale italiana
 * (Capodanno, Epifania, Pasqua, Pasquetta, 25 Aprile, 1 Maggio, 2 Giugno, 15 Agosto,
 * 1 Novembre, 8 Dicembre, 25 Dicembre, 26 Dicembre).
 */
export function isItalianHoliday(dateOrStr: Date | string): boolean {
  return getHolidayOrSundayInfo(dateOrStr).isHoliday;
}

/**
 * Restituisce se il resoconto mattutino deve essere inviato per una data specifica.
 * Regola:
 * - NO invio nei giorni festivi e le domeniche
 * - SÌ invio dal lunedì al sabato
 * - Orario resoconto: Sabato ore 09:00, Lunedì-Venerdì ore 10:00 (o da config)
 */
export function shouldSendDailyBriefing(
  dateOrStr: Date | string,
  configuredWeekdayHour: string = '10:00'
): {
  shouldSend: boolean;
  reason?: string;
  targetHour: string;
} {
  let date: Date;
  if (typeof dateOrStr === 'string') {
    const [y, m, d] = dateOrStr.split('-').map(Number);
    date = new Date(y, m - 1, d);
  } else {
    date = dateOrStr;
  }

  const dayOfWeek = date.getDay(); // 0 = Domenica, 1 = Lunedì ... 6 = Sabato

  if (dayOfWeek === 0) {
    return { shouldSend: false, reason: 'Domenica (nessun invio programmato)', targetHour: '' };
  }

  if (isItalianHoliday(date)) {
    return { shouldSend: false, reason: 'Giorno festivo nazionale (nessun invio programmato)', targetHour: '' };
  }

  // Sabato: ore 09:00
  if (dayOfWeek === 6) {
    return { shouldSend: true, targetHour: '09:00' };
  }

  // Lunedì - Venerdì: orario feriale configurato (default 10:00)
  return { shouldSend: true, targetHour: configuredWeekdayHour || '10:00' };
}


