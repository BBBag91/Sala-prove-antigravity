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

export function formatDateToISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseISODate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

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

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function calculateDurationHours(startTime: string, endTime: string): number {
  const startMin = timeToMinutes(startTime);
  let endMin = timeToMinutes(endTime);
  if (endMin < startMin) {
    // Crosses midnight
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

