import { createClient } from '@supabase/supabase-js';

// =========================================================================
// INTERFACES & TIPIZZAZIONI SELF-CONTAINED PER SERVERLESS VERCEL
// (Nessuna dipendenza relativa da ../src per prevenire crash di bundling/ESM)
// =========================================================================

export type WhatsAppProvider = 'manual' | 'ultramsg' | 'greenapi' | 'whapi' | 'webhook';

export interface WhatsAppNotificationConfig {
  enabled: boolean;
  provider: WhatsAppProvider;
  instanceId?: string;
  token?: string;
  chatId?: string;
  groupName?: string;
  groupInviteLink?: string;
  webhookUrl?: string;
  orarioNotifica?: string;
  includiStatoPagamenti?: boolean;
  includiDotazione?: boolean;
  autoSendMorning?: boolean;
  browserNotificationEnabled?: boolean;
  lastAutoSentDate?: string;
}

export interface StudioInfo {
  nome: string;
  sottotitolo?: string;
  indirizzo?: string;
  telefono?: string;
  email?: string;
  citta?: string;
  cap?: string;
  codiceFiscalePiva?: string;
  sitoWeb?: string;
  note?: string;
  whatsappConfig?: WhatsAppNotificationConfig;
}

export interface Room {
  id: string;
  nome: string;
  descrizione?: string;
  colore?: string;
  tariffaOraria: number;
  tariffaLezione?: number;
  capienza: number;
  dotazione?: string[];
  stato: 'disponibile' | 'manutenzione' | 'occupata';
}

export interface StaffMember {
  id: string;
  nome: string;
  cognome: string;
  ruolo: 'gestore' | 'tecnico' | 'collaboratore' | 'insegnante' | 'fonico';
  email: string;
  telefono: string;
  coloreBadge?: string;
}

export interface Booking {
  id: string;
  clienteId: string;
  clienteNome: string;
  salaId: string;
  salaNome?: string;
  data: string;
  oraInizio: string;
  oraFine: string;
  durataOre: number;
  tariffaTotale: number;
  tipo: 'standard' | 'lezione' | 'evento' | 'registrazione';
  insegnanteId?: string;
  insegnanteNome?: string;
  descrizione?: string;
  richiesteStrumentazione?: string;
  note?: string;
  statoPagamento?: 'in_sospeso' | 'pagato' | 'parziale';
}

export interface WorkShift {
  id: string;
  data: string;
  turnoNumero: 1 | 2;
  nomeTurno: string;
  oraInizioBase: string;
  oraFineBase: string;
  operatoreId?: string;
  operatoreNome?: string;
  note?: string;
  isCustomHours?: boolean;
  oraInizioEffettiva?: string;
  oraFineEffettiva?: string;
}

export interface DailyShiftComputed {
  id: string;
  data: string;
  turnoNumero: 1 | 2;
  nomeTurno: string;
  oraInizioBase: string;
  oraFineBase: string;
  oraInizio: string;
  oraFine: string;
  durataMinuti: number;
  durataOre: number;
  minutiExtra: number;
  isAdapted: boolean;
  adaptationReason?: string;
  operatoreId?: string;
  operatoreNome?: string;
  operatoreBadgeColor?: string;
  note?: string;
  isCustomHours?: boolean;
}

// =========================================================================
// UTILITY DATE & FESTIVITA' NAZIONALI ITALIANE
// =========================================================================

const GIORNI_SETTIMANA = [
  'Domenica',
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato',
];

const MESI_ITALIANI = [
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

function parseISODate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function timeToMinutes(t: string): number {
  const [h, m] = (t || '00:00').split(':').map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

function minutesToTimeString(totalMinutes: number): string {
  const normalized = totalMinutes % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// Algoritmo Meeus/Jones/Butcher per il calcolo della Pasqua
function getEasterSunday(year: number): { month: number; day: number } {
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
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function isItalianHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const fixedHolidays = [
    '01-01', // Capodanno
    '01-06', // Epifania
    '04-25', // Liberazione
    '05-01', // Lavoratori
    '06-02', // Repubblica
    '08-15', // Ferragosto
    '11-01', // Ognissanti
    '12-08', // Immacolata
    '12-25', // Natale
    '12-26', // Santo Stefano
  ];

  const monthDayStr = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (fixedHolidays.includes(monthDayStr)) return true;

  const easter = getEasterSunday(year);
  const pasquettaDate = new Date(year, easter.month - 1, easter.day + 1);

  return (
    date.getFullYear() === pasquettaDate.getFullYear() &&
    date.getMonth() === pasquettaDate.getMonth() &&
    date.getDate() === pasquettaDate.getDate()
  );
}

// =========================================================================
// CALCOLO TURNI DI PRESIDIO
// =========================================================================

const BASE_SHIFT_1_START = '17:00';
const BASE_SHIFT_1_END = '20:00';
const BASE_SHIFT_2_START = '20:00';
const BASE_SHIFT_2_END = '23:00';

const SATURDAY_SHIFT_1_START = '09:00';
const SATURDAY_SHIFT_1_END = '12:00';
const SATURDAY_SHIFT_2_START = '14:00';
const SATURDAY_SHIFT_2_END = '18:00';

function computeDailyShiftsInternal(
  dateStr: string,
  bookingsOnDate: Booking[],
  savedShifts: WorkShift[] = [],
  staffList: StaffMember[] = []
): [DailyShiftComputed, DailyShiftComputed] {
  const d = parseISODate(dateStr);
  const isSaturday = d.getDay() === 6;

  const baseStartMins = timeToMinutes(isSaturday ? SATURDAY_SHIFT_1_START : BASE_SHIFT_1_START);
  const baseMidMins = timeToMinutes(isSaturday ? SATURDAY_SHIFT_1_END : BASE_SHIFT_1_END);
  const baseStart2Mins = timeToMinutes(isSaturday ? SATURDAY_SHIFT_2_START : BASE_SHIFT_2_START);
  const baseEndMins = timeToMinutes(isSaturday ? SATURDAY_SHIFT_2_END : BASE_SHIFT_2_END);

  let earliestBookingMins = baseStartMins;
  let latestBookingMins = baseEndMins;

  const rehearsalBookings = (bookingsOnDate || []).filter((b) => b.tipo !== 'lezione');

  if (rehearsalBookings.length > 0) {
    for (const b of rehearsalBookings) {
      const bStart = timeToMinutes(b.oraInizio);
      let bEnd = timeToMinutes(b.oraFine);
      if (bEnd <= bStart) bEnd += 24 * 60;

      if (bStart < earliestBookingMins) earliestBookingMins = bStart;
      if (bEnd > latestBookingMins) latestBookingMins = bEnd;
    }
  }

  const extraLateMins = Math.max(0, latestBookingMins - baseEndMins);
  const extraEarlyMins = Math.max(0, baseStartMins - earliestBookingMins);

  let shift1StartMins = baseStartMins;
  let shift1EndMins = baseMidMins;
  let shift2StartMins = baseStart2Mins;
  let shift2EndMins = baseEndMins;

  let adaptationReason1 = '';
  let adaptationReason2 = '';
  let isAdapted = false;
  let extraMinsPerTurn = 0;

  if (extraLateMins > 0 && extraEarlyMins === 0) {
    extraMinsPerTurn = Math.round(extraLateMins / 2);
    if (isSaturday) {
      shift2EndMins = latestBookingMins;
      adaptationReason2 = `Esteso alle ${minutesToTimeString(latestBookingMins)} per prove tardive`;
    } else {
      shift1StartMins = baseStartMins;
      shift1EndMins = baseMidMins + extraMinsPerTurn;
      shift2StartMins = shift1EndMins;
      shift2EndMins = latestBookingMins;
      adaptationReason1 = `+${extraMinsPerTurn} min (chiusura posticipata alle ${minutesToTimeString(latestBookingMins)} spalmata equamente)`;
      adaptationReason2 = `+${extraMinsPerTurn} min (chiusura posticipata alle ${minutesToTimeString(latestBookingMins)} spalmata equamente)`;
    }
    isAdapted = true;
  } else if (extraEarlyMins > 0 && extraLateMins === 0) {
    extraMinsPerTurn = Math.round(extraEarlyMins / 2);
    if (isSaturday) {
      shift1StartMins = earliestBookingMins;
      adaptationReason1 = `Apertura anticipata alle ${minutesToTimeString(earliestBookingMins)} per prove mattutine`;
    } else {
      shift1StartMins = earliestBookingMins;
      shift1EndMins = baseMidMins - extraMinsPerTurn;
      shift2StartMins = shift1EndMins;
      shift2EndMins = baseEndMins;
      adaptationReason1 = `+${extraMinsPerTurn} min (apertura anticipata alle ${minutesToTimeString(earliestBookingMins)} spalmata equamente)`;
      adaptationReason2 = `+${extraMinsPerTurn} min (apertura anticipata alle ${minutesToTimeString(earliestBookingMins)} spalmata equamente)`;
    }
    isAdapted = true;
  } else if (extraEarlyMins > 0 && extraLateMins > 0) {
    if (isSaturday) {
      shift1StartMins = earliestBookingMins;
      shift2EndMins = latestBookingMins;
      adaptationReason1 = `Apertura anticipata alle ${minutesToTimeString(earliestBookingMins)}`;
      adaptationReason2 = `Chiusura posticipata alle ${minutesToTimeString(latestBookingMins)}`;
    } else {
      const totalDuration = latestBookingMins - earliestBookingMins;
      const halfDuration = Math.round(totalDuration / 2);
      shift1StartMins = earliestBookingMins;
      shift1EndMins = earliestBookingMins + halfDuration;
      shift2StartMins = shift1EndMins;
      shift2EndMins = latestBookingMins;
      const totalExtra = extraEarlyMins + extraLateMins;
      extraMinsPerTurn = Math.round(totalExtra / 2);
      adaptationReason1 = `+${extraMinsPerTurn} min (orario esteso ${minutesToTimeString(earliestBookingMins)}-${minutesToTimeString(latestBookingMins)})`;
      adaptationReason2 = `+${extraMinsPerTurn} min (orario esteso ${minutesToTimeString(earliestBookingMins)}-${minutesToTimeString(latestBookingMins)})`;
    }
    isAdapted = true;
  }

  const saved1 = savedShifts.find((s) => s.data === dateStr && s.turnoNumero === 1);
  const saved2 = savedShifts.find((s) => s.data === dateStr && s.turnoNumero === 2);

  const op1 = saved1?.operatoreId ? staffList.find((st) => st.id === saved1.operatoreId) : undefined;
  const op2 = saved2?.operatoreId ? staffList.find((st) => st.id === saved2.operatoreId) : undefined;

  let s1Start = saved1?.isCustomHours && saved1.oraInizioEffettiva ? saved1.oraInizioEffettiva : minutesToTimeString(shift1StartMins);
  let s1End = saved1?.isCustomHours && saved1.oraFineEffettiva ? saved1.oraFineEffettiva : minutesToTimeString(shift1EndMins);

  const hasRehearsalBeforeBase = rehearsalBookings.some((b) => timeToMinutes(b.oraInizio) < baseStartMins);
  if (!hasRehearsalBeforeBase && timeToMinutes(s1Start) < baseStartMins) {
    s1Start = minutesToTimeString(baseStartMins);
    if (timeToMinutes(s1End) < baseMidMins) {
      s1End = minutesToTimeString(baseMidMins);
    }
  }

  const s1DurMins = timeToMinutes(s1End) - timeToMinutes(s1Start);

  const shift1: DailyShiftComputed = {
    id: saved1?.id || `shift-${dateStr}-1`,
    data: dateStr,
    turnoNumero: 1,
    nomeTurno: isSaturday ? '1° Turno (Mattina)' : '1° Turno (Pomeridiano)',
    oraInizioBase: isSaturday ? SATURDAY_SHIFT_1_START : BASE_SHIFT_1_START,
    oraFineBase: isSaturday ? SATURDAY_SHIFT_1_END : BASE_SHIFT_1_END,
    oraInizio: s1Start,
    oraFine: s1End,
    durataMinuti: s1DurMins,
    durataOre: Math.round((s1DurMins / 60) * 100) / 100,
    minutiExtra: isAdapted ? extraMinsPerTurn : 0,
    isAdapted: isAdapted || !!saved1?.isCustomHours,
    adaptationReason: saved1?.isCustomHours ? 'Orario personalizzato manualmente' : adaptationReason1,
    operatoreId: saved1?.operatoreId || undefined,
    operatoreNome: saved1?.operatoreNome || (op1 ? `${op1.nome} ${op1.cognome}` : undefined),
    operatoreBadgeColor: op1?.coloreBadge || undefined,
    note: saved1?.note || '',
    isCustomHours: saved1?.isCustomHours || false,
  };

  const s2Start = saved2?.isCustomHours && saved2.oraInizioEffettiva ? saved2.oraInizioEffettiva : minutesToTimeString(shift2StartMins);
  const s2End = saved2?.isCustomHours && saved2.oraFineEffettiva ? saved2.oraFineEffettiva : minutesToTimeString(shift2EndMins);
  const s2DurMins = (timeToMinutes(s2End) <= timeToMinutes(s2Start) ? timeToMinutes(s2End) + 24 * 60 : timeToMinutes(s2End)) - timeToMinutes(s2Start);

  const shift2: DailyShiftComputed = {
    id: saved2?.id || `shift-${dateStr}-2`,
    data: dateStr,
    turnoNumero: 2,
    nomeTurno: isSaturday ? '2° Turno (Pomeriggio)' : '2° Turno (Serale)',
    oraInizioBase: isSaturday ? SATURDAY_SHIFT_2_START : BASE_SHIFT_2_START,
    oraFineBase: isSaturday ? SATURDAY_SHIFT_2_END : BASE_SHIFT_2_END,
    oraInizio: s2Start,
    oraFine: s2End,
    durataMinuti: s2DurMins,
    durataOre: Math.round((s2DurMins / 60) * 100) / 100,
    minutiExtra: isAdapted ? extraMinsPerTurn : 0,
    isAdapted: isAdapted || !!saved2?.isCustomHours,
    adaptationReason: saved2?.isCustomHours ? 'Orario personalizzato manualmente' : adaptationReason2,
    operatoreId: saved2?.operatoreId || undefined,
    operatoreNome: saved2?.operatoreNome || (op2 ? `${op2.nome} ${op2.cognome}` : undefined),
    operatoreBadgeColor: op2?.coloreBadge || undefined,
    note: saved2?.note || '',
    isCustomHours: saved2?.isCustomHours || false,
  };

  return [shift1, shift2];
}

// =========================================================================
// FORMATTAZIONE MESSAGGIO WHATSAPP COMPLETO & RICCO
// =========================================================================

function formatBriefingMessageInternal({
  dateStr,
  studioInfo,
  dailyShifts,
  bookings,
  rooms,
  staff = [],
  config,
}: {
  dateStr: string;
  studioInfo: StudioInfo;
  dailyShifts: [DailyShiftComputed, DailyShiftComputed];
  bookings: Booking[];
  rooms: Room[];
  staff: StaffMember[];
  config?: WhatsAppNotificationConfig;
}): string {
  const d = parseISODate(dateStr);
  const giornoSettimana = GIORNI_SETTIMANA[d.getDay()];
  const giornoNumero = d.getDate();
  const meseNome = MESI_ITALIANI[d.getMonth()];
  const anno = d.getFullYear();

  const studioNome = studioInfo.nome || 'La Musica Fa..';
  const sortedBookings = [...bookings].sort((a, b) => a.oraInizio.localeCompare(b.oraInizio));
  const totalOre = sortedBookings.reduce((sum, b) => sum + (b.durataOre || 0), 0);

  const lines: string[] = [];

  // Intestazione
  lines.push(`☀️ *BUONGIORNO STAFF • ${studioNome.toUpperCase()}* ☀️`);
  lines.push(`📅 *${giornoSettimana} ${giornoNumero} ${meseNome} ${anno}*`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);

  // Presidio sala & Turni
  lines.push(`👥 *PRESIDIO SALA & TURNI OPERATORI:*`);
  const [shift1, shift2] = dailyShifts;

  const formatShiftLine = (shift: DailyShiftComputed, num: number) => {
    const nomeTurno = shift.nomeTurno || `Turno ${num}`;
    const orario = `${shift.oraInizio} - ${shift.oraFine}`;
    const opNome = shift.operatoreNome ? `*${shift.operatoreNome}*` : '_⚠️ Da assegnare_';
    const noteBadge = shift.isAdapted && shift.adaptationReason ? ` (${shift.adaptationReason})` : '';
    return `• 🕒 *${nomeTurno}* (${orario}): 👤 ${opNome}${noteBadge}`;
  };

  lines.push(formatShiftLine(shift1, 1));
  lines.push(formatShiftLine(shift2, 2));
  lines.push(`─────────────────────`);

  // Prenotazioni ed Eventi
  const countBookings = sortedBookings.length;
  lines.push(`🎸 *PRENOTAZIONI ED EVENTI DI OGGI (${countBookings}):*`);

  if (countBookings === 0) {
    lines.push(`_Nessuna prenotazione registrata in calendario per oggi._`);
  } else {
    const getTeacherName = (b: Booking): string => {
      const teacherMember = staff.find((s) => s.id === b.insegnanteId);
      return (
        b.insegnanteNome?.trim() ||
        (teacherMember ? `${teacherMember.nome} ${teacherMember.cognome}`.trim() : '') ||
        b.clienteNome?.trim() ||
        'Insegnante'
      );
    };

    interface LessonGroup {
      docenteNome: string;
      roomNome: string;
      bookings: Booking[];
    }

    const lessonGroupsMap = new Map<string, LessonGroup>();
    const standardBookings: Booking[] = [];

    sortedBookings.forEach((b) => {
      if (b.tipo === 'lezione') {
        const docenteNome = getTeacherName(b);
        const room = rooms.find((r) => r.id === b.salaId);
        const roomNome = room?.nome || b.salaNome || 'Sala';
        const key = `${docenteNome.toLowerCase()}:::${b.salaId || roomNome.toLowerCase()}`;

        const existing = lessonGroupsMap.get(key);
        if (existing) {
          existing.bookings.push(b);
        } else {
          lessonGroupsMap.set(key, {
            docenteNome,
            roomNome,
            bookings: [b],
          });
        }
      } else {
        standardBookings.push(b);
      }
    });

    interface DisplayItem {
      earliestStart: string;
      renderLines: () => string[];
    }

    const displayItems: DisplayItem[] = [];

    // 1. Processa i gruppi di lezioni docenti
    lessonGroupsMap.forEach((group) => {
      const intervals = group.bookings
        .map((b) => ({ start: b.oraInizio, end: b.oraFine }))
        .sort((a, b) => a.start.localeCompare(b.start));

      const merged: { start: string; end: string }[] = [];
      for (const curr of intervals) {
        if (merged.length === 0) {
          merged.push({ ...curr });
        } else {
          const prev = merged[merged.length - 1];
          if (curr.start <= prev.end) {
            if (curr.end > prev.end) {
              prev.end = curr.end;
            }
          } else {
            merged.push({ ...curr });
          }
        }
      }

      const timeStrings = merged.map((m) => `${m.start} - ${m.end}`);
      const orarioFormatted =
        timeStrings.length === 1
          ? timeStrings[0]
          : timeStrings.slice(0, -1).join(', ') + ' e ' + timeStrings[timeStrings.length - 1];

      const allDescLines = group.bookings
        .flatMap((b) => [
          b.richiesteStrumentazione?.trim(),
          b.note?.trim(),
          b.descrizione?.trim(),
        ])
        .filter(Boolean)
        .flatMap((text) => (text as string).split('\n'))
        .map((l) => l.trim())
        .filter(Boolean);

      const uniqueDescLines = Array.from(new Set(allDescLines));

      displayItems.push({
        earliestStart: intervals[0].start,
        renderLines: () => {
          const itemLines: string[] = [];
          itemLines.push(
            `🕒 *${orarioFormatted}* | 🎓 Lezione "${group.docenteNome}" in "${group.roomNome}"`
          );
          if (uniqueDescLines.length > 0) {
            itemLines.push(`   • 📝 NOTA BENE: _${uniqueDescLines.join(' - ')}_`);
          }
          return itemLines;
        },
      });
    });

    // 2. Processa le prenotazioni standard
    standardBookings.forEach((b) => {
      const room = rooms.find((r) => r.id === b.salaId);
      const roomNome = room?.nome || b.salaNome || 'Sala';

      const descLines = [
        b.richiesteStrumentazione?.trim(),
        b.note?.trim(),
        b.descrizione?.trim(),
      ]
        .filter(Boolean)
        .flatMap((text) => (text as string).split('\n'))
        .map((l) => l.trim())
        .filter(Boolean);

      const uniqueDescLines = Array.from(new Set(descLines));

      displayItems.push({
        earliestStart: b.oraInizio,
        renderLines: () => {
          const itemLines: string[] = [];
          itemLines.push(`🕒 *${b.oraInizio} - ${b.oraFine}* | 🚪 *${roomNome}*`);
          itemLines.push(`   • Band/Cliente: *${b.clienteNome}*`);
          if (uniqueDescLines.length > 0) {
            itemLines.push(`   • 📝 NOTA BENE: _${uniqueDescLines.join(' - ')}_`);
          }
          if (config?.includiStatoPagamenti !== false) {
            const pagato = b.statoPagamento === 'pagato';
            itemLines.push(
              `   • Pagamento: ${pagato ? `✅ Saldato (€${Number(b.tariffaTotale || 0).toFixed(2)})` : `⏳ Da Saldare (€${Number(b.tariffaTotale || 0).toFixed(2)})`}`
            );
          }
          return itemLines;
        },
      });
    });

    displayItems.sort((a, b) => a.earliestStart.localeCompare(b.earliestStart));

    displayItems.forEach((item, idx) => {
      const rendered = item.renderLines();
      if (rendered.length > 0) {
        rendered[0] = `${idx + 1}️⃣ ${rendered[0]}`;
        lines.push(...rendered);
      }
    });
  }

  // Riepilogo finale
  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
  if (countBookings > 0) {
    lines.push(`📊 *Riepilogo:* ${countBookings} prenotazioni | ${totalOre.toFixed(1)}h totali`);
  }
  lines.push(`✨ _Buona giornata e buon lavoro a tutto lo staff!_ 🎶`);

  return lines.join('\n');
}

// =========================================================================
// INVIO EFFETTIVO TRAMITE GATEWAY WHATSAPP
// =========================================================================

async function sendWhatsAppInternal(
  config: WhatsAppNotificationConfig,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!config.enabled) {
    return { success: false, error: 'Notifiche WhatsApp disabilitate nelle impostazioni.' };
  }

  try {
    switch (config.provider) {
      case 'greenapi': {
        if (!config.instanceId || !config.token || !config.chatId) {
          return {
            success: false,
            error: 'Credenziali Green API incomplete (idInstance, apiTokenInstance o ChatId mancanti).',
          };
        }
        const endpoint = `https://api.green-api.com/waInstance${config.instanceId}/sendMessage/${config.token}`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: config.chatId,
            message: message,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          return { success: false, error: data.message || data.error || `Errore HTTP ${res.status}` };
        }
        return { success: true, messageId: String(data.idMessage || 'sent') };
      }

      case 'ultramsg': {
        if (!config.instanceId || !config.token || !config.chatId) {
          return {
            success: false,
            error: 'Credenziali UltraMsg incomplete (Instance ID, Token o Chat/Group ID mancanti).',
          };
        }
        const endpoint = `https://api.ultramsg.com/${config.instanceId}/messages/chat`;
        const params = new URLSearchParams();
        params.append('token', config.token);
        params.append('to', config.chatId);
        params.append('body', message);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          return { success: false, error: data.error || `Errore HTTP ${res.status}` };
        }
        return { success: true, messageId: String(data.id || data.messageId || 'sent') };
      }

      case 'whapi': {
        if (!config.token || !config.chatId) {
          return { success: false, error: 'Credenziali Whapi incomplete (Token o ChatId mancanti).' };
        }
        const endpoint = `https://gate.whapi.cloud/messages/text`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.token}`,
          },
          body: JSON.stringify({
            to: config.chatId,
            body: message,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.message || `Errore HTTP ${res.status}` };
        }
        return { success: true, messageId: String(data.sent || data.id || 'sent') };
      }

      case 'webhook': {
        if (!config.webhookUrl) {
          return { success: false, error: 'URL Webhook non configurato.' };
        }
        const res = await fetch(config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: message,
            chatId: config.chatId,
            timestamp: new Date().toISOString(),
          }),
        });
        if (!res.ok) {
          return { success: false, error: `Webhook ha risposto con codice ${res.status}` };
        }
        return { success: true };
      }

      default:
        return { success: false, error: 'Provider manual o non configurato per cron automatico.' };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Errore di connessione durante l\'invio a WhatsApp.',
    };
  }
}

// =========================================================================
// MAPPERS DA DATABASE SUPABASE (snake_case -> camelCase)
// =========================================================================

function mapBookingFromDb(b: any): Booking {
  return {
    id: b.id,
    clienteId: b.cliente_id || '',
    clienteNome: b.cliente_nome || '',
    salaId: b.sala_id || '',
    salaNome: b.sala_nome,
    data: b.data,
    oraInizio: b.ora_inizio,
    oraFine: b.ora_fine,
    durataOre: Number(b.durata_ore),
    tariffaTotale: Number(b.tariffa_totale),
    tipo: b.tipo || 'standard',
    insegnanteId: b.insegnante_id || undefined,
    insegnanteNome: b.insegnante_nome || undefined,
    descrizione: b.descrizione || undefined,
    richiesteStrumentazione: b.richieste_strumentazione || undefined,
    note: b.note || undefined,
    statoPagamento: b.stato_pagamento || 'in_sospeso',
  };
}

function mapRoomFromDb(r: any): Room {
  return {
    id: r.id,
    nome: r.nome,
    descrizione: r.descrizione || '',
    colore: r.colore || '#eab308',
    tariffaOraria: Number(r.tariffa_oraria),
    tariffaLezione: r.tariffa_lezione ? Number(r.tariffa_lezione) : undefined,
    capienza: Number(r.capienza),
    dotazione: Array.isArray(r.dotazione) ? r.dotazione : [],
    stato: r.stato || 'disponibile',
  };
}

function mapStaffFromDb(s: any): StaffMember {
  return {
    id: s.id,
    nome: s.nome,
    cognome: s.cognome,
    ruolo: s.ruolo,
    email: s.email || '',
    telefono: s.telefono || '',
    coloreBadge: s.colore_badge || '#3b82f6',
  };
}

function mapShiftFromDb(s: any): WorkShift {
  return {
    id: s.id,
    data: s.data,
    turnoNumero: s.turno_numero,
    nomeTurno: s.nome_turno,
    oraInizioBase: s.ora_inizio_base,
    oraFineBase: s.ora_fine_base,
    operatoreId: s.operatore_id || undefined,
    operatoreNome: s.operatore_nome || undefined,
    note: s.note || '',
    isCustomHours: Boolean(s.is_custom_hours),
    oraInizioEffettiva: s.ora_inizio_effettiva || undefined,
    oraFineEffettiva: s.ora_fine_effettiva || undefined,
  };
}

// =========================================================================
// HANDLER PRINCIPALE VERCEL SERVERLESS FUNCTION
// =========================================================================

interface VercelRequest {
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[]>;
  body?: any;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (data: any) => void;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Facoltativo: verifica token CRON_SECRET se specificato
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized: CRON_SECRET mismatch' });
  }

  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://qapmpppmejfcekqdzrgz.supabase.co';
  const supabaseKey =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'sb_publishable_vbdUnCY1YehkXPcdNsLsOw_YHaHCz1K';

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase credentials not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 2. Data e ora corrente calcolate sul fuso orario Europe/Rome
    const nowInRome = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
    const year = nowInRome.getFullYear();
    const month = String(nowInRome.getMonth() + 1).padStart(2, '0');
    const day = String(nowInRome.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    const currentHourIT = nowInRome.getHours();
    const currentMinuteIT = nowInRome.getMinutes();
    const dayOfWeek = nowInRome.getDay(); // 0 = Domenica, 1 = Lunedì ... 6 = Sabato

    const isForce = req.query?.force === 'true' || req.query?.force === '1';

    // 3. Controllo festività e domeniche: nessun invio la domenica e nei festivi
    if (!isForce && dayOfWeek === 0) {
      return res.status(200).json({
        message: `Domenica (${todayStr}): nessun invio messaggio di resoconto programmato. Skip.`,
      });
    }

    if (!isForce && isItalianHoliday(nowInRome)) {
      return res.status(200).json({
        message: `Giorno festivo nazionale (${todayStr}): nessun invio messaggio di resoconto programmato. Skip.`,
      });
    }

    // 4. Fetch studio_info per verificare configurazione WhatsApp
    const { data: studioData, error: studioErr } = await supabase
      .from('studio_info')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (studioErr) {
      console.warn('[cron] Errore lettura studio_info:', studioErr);
    }

    const studioInfo = studioData || {};

    let config: WhatsAppNotificationConfig | undefined = studioInfo.whatsapp_config;
    if (!config && studioInfo.note && studioInfo.note.includes('__WA_CFG__:')) {
      try {
        const match = studioInfo.note.match(/__WA_CFG__:([\s\S]*?)__END_WA_CFG__/);
        if (match && match[1]) {
          config = JSON.parse(match[1]);
        }
      } catch (e) {
        console.warn('[cron] Errore parsing fallback config WhatsApp da note:', e);
      }
    }

    if (!config || !config.enabled || config.autoSendMorning === false) {
      return res.status(200).json({
        message: 'Notifiche automatiche mattutine WhatsApp disabilitate nelle impostazioni dello studio. Skip.',
      });
    }

    // 5. GUARD IDEMPOTENZA ATOMICA (Zero Duplicati Giornalieri):
    // Se il messaggio è già stato inviato per oggi, FERMATI IMMEDIATAMENTE (a meno di ?force=true)
    if (!isForce) {
      if (config.lastAutoSentDate === todayStr) {
        return res.status(200).json({
          message: `Messaggio già inviato oggi (${todayStr}), invio singolo garantito da studio_info. Skip.`,
          lastAutoSentDate: config.lastAutoSentDate,
        });
      }

      // Controllo tabella atomica di log invii
      try {
        const { data: existingLog } = await supabase
          .from('daily_briefing_log')
          .select('date_iso, sent_at')
          .eq('date_iso', todayStr)
          .maybeSingle();

        if (existingLog) {
          return res.status(200).json({
            message: `Messaggio già inviato oggi (${todayStr}), invio singolo garantito da daily_briefing_log (${existingLog.sent_at}). Skip.`,
            date: todayStr,
            sentAt: existingLog.sent_at,
          });
        }
      } catch (logErr) {
        console.warn('[cron] Impossibile verificare daily_briefing_log:', logErr);
      }
    }

    // 6. Verifica orario target (default 10:00) E FINESTRA MASSIMA MATTUTINA
    const targetTimeStr: string = config.orarioNotifica || '10:00';
    const [targetHours, targetMinutes] = targetTimeStr.split(':').map((n: string) => parseInt(n, 10));

    if (!isForce) {
      const isTooEarly =
        currentHourIT < targetHours ||
        (currentHourIT === targetHours && currentMinuteIT < targetMinutes);

      if (isTooEarly) {
        return res.status(200).json({
          message: `Troppo presto: ora italiana ${currentHourIT}:${String(currentMinuteIT).padStart(2, '0')}, target ${targetTimeStr}. Skip.`,
        });
      }

      // BLOCCO DI SICUREZZA: Nessun riepilogo "Buongiorno" deve MAI essere inviato di pomeriggio o sera!
      // Se il cron subisce ritardi o viene chiamato dopo le 13:00, interrompi immediatamente.
      const isPastMorningWindow = currentHourIT >= 13;
      if (isPastMorningWindow) {
        return res.status(200).json({
          message: `Fuori dalla finestra mattutina: ora italiana ${currentHourIT}:${String(currentMinuteIT).padStart(2, '0')}. I messaggi del mattino possono essere inviati solo tra le 09:30 e le 12:59. Skip.`,
        });
      }
    }

    // 7. Fetch dati completi da Supabase
    const [bookingsRes, staffRes, roomsRes, shiftsRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('*')
        .eq('data', todayStr)
        .order('ora_inizio', { ascending: true }),
      supabase.from('staff').select('*').order('cognome', { ascending: true }),
      supabase.from('rooms').select('*').order('nome', { ascending: true }),
      supabase.from('shifts').select('*').eq('data', todayStr),
    ]);

    const bookings: Booking[] = (bookingsRes.data || []).map(mapBookingFromDb);
    const staff: StaffMember[] = (staffRes.data || []).map(mapStaffFromDb);
    const rooms: Room[] = (roomsRes.data || []).map(mapRoomFromDb);

    let shifts: WorkShift[] = (shiftsRes.data || []).map(mapShiftFromDb);
    if (shifts.length === 0) {
      try {
        const { data: storeRow } = await supabase
          .from('studio_info')
          .select('note')
          .eq('id', 'shifts_store')
          .maybeSingle();
        if (storeRow?.note) {
          const parsed = JSON.parse(storeRow.note);
          if (Array.isArray(parsed)) {
            shifts = parsed.filter((s: any) => s.data === todayStr).map(mapShiftFromDb);
          }
        }
      } catch (e) {
        console.warn('[cron] Errore parsing shifts_store:', e);
      }
    }
    if (shifts.length === 0 && studioInfo.note && studioInfo.note.includes('__SHIFTS__:')) {
      try {
        const match = studioInfo.note.match(/__SHIFTS__:([\s\S]*?)__END_SHIFTS__/);
        if (match && match[1]) {
          const parsed = JSON.parse(match[1]);
          if (Array.isArray(parsed)) {
            shifts = parsed.filter((s: any) => s.data === todayStr).map(mapShiftFromDb);
          }
        }
      } catch (e) {
        console.warn('[cron] Errore parsing fallback shifts da note:', e);
      }
    }

    // 8. Calcolo turni di presidio giornalieri
    const dailyShifts = computeDailyShiftsInternal(todayStr, bookings, shifts, staff);

    // 9. Formattazione messaggio WhatsApp identico e conforme all'app
    const studioInfoClean: StudioInfo = {
      nome: studioInfo.nome || 'La Musica Fa..',
      sottotitolo: studioInfo.sottotitolo || '',
      indirizzo: studioInfo.indirizzo || '',
      telefono: studioInfo.telefono || '',
      email: studioInfo.email || '',
      citta: studioInfo.citta || '',
      cap: studioInfo.cap || '',
      codiceFiscalePiva: studioInfo.codice_fiscale_piva || '',
      sitoWeb: studioInfo.sito_web || '',
      note: studioInfo.note || '',
      whatsappConfig: config,
    };

    const message = formatBriefingMessageInternal({
      dateStr: todayStr,
      studioInfo: studioInfoClean,
      dailyShifts,
      bookings,
      rooms,
      staff,
      config,
    });

    // 10. Invio effettivo tramite gateway WhatsApp
    const sendResult = await sendWhatsAppInternal(config, message);

    if (!sendResult.success) {
      return res.status(500).json({
        error: `Invio WhatsApp fallito: ${sendResult.error}`,
      });
    }

    // 11. PERSISTENZA IMMEDIATA DI lastAutoSentDate & LOG ATOMICO:
    const updatedConfig = { ...config, lastAutoSentDate: todayStr };

    // Registra subito nella tabella log atomica di Supabase (chiave primaria su data = zero duplicati)
    try {
      await supabase.from('daily_briefing_log').upsert({
        date_iso: todayStr,
        sent_at: new Date().toISOString(),
        provider: config.provider,
        sender_source: 'cron_serverless',
        message_id: sendResult.messageId || 'sent',
        success: true,
      });
    } catch (e) {
      console.warn('[cron] Errore salvataggio daily_briefing_log:', e);
    }

    const { error: updateErr } = await supabase
      .from('studio_info')
      .update({ whatsapp_config: updatedConfig })
      .eq('id', studioInfo.id || 'main');

    // Se la colonna non esiste o fallisce, fallback nel blocco note
    if (updateErr) {
      const cleanBaseNote = (studioInfo.note || '').replace(/__WA_CFG__:[\s\S]*?__END_WA_CFG__/g, '').trim();
      const encodedWa = `__WA_CFG__:${JSON.stringify(updatedConfig)}__END_WA_CFG__`;
      const noteWithConfig = cleanBaseNote ? `${cleanBaseNote}\n${encodedWa}` : encodedWa;
      await supabase
        .from('studio_info')
        .update({ note: noteWithConfig })
        .eq('id', studioInfo.id || 'main');
    }

    return res.status(200).json({
      success: true,
      message: `Resoconto del mattino (${targetTimeStr}) inviato con successo al gruppo WhatsApp per il ${todayStr}!`,
      date: todayStr,
      provider: config.provider,
      messageId: sendResult.messageId,
    });
  } catch (err: any) {
    console.error('[cron-daily-briefing] Errore generale:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
