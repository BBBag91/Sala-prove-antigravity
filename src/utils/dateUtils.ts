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
