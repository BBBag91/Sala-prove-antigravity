import { Booking, DailyShiftComputed, StaffMember, WorkShift } from '../types';
import { parseISODate, timeToMinutes } from './dateUtils';
import { isOperatorFreeFromPrimaryWork } from './scheduler';

export const BASE_SHIFT_1_START = '17:00';
export const BASE_SHIFT_1_END = '20:00';
export const BASE_SHIFT_2_START = '20:00';
export const BASE_SHIFT_2_END = '23:00';

export function minutesToTimeString(totalMinutes: number): string {
  // Normalize within 0 to 24*60 or handle past midnight
  const normalized = totalMinutes % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function isWeekdayDate(dateStr: string): boolean {
  try {
    const d = parseISODate(dateStr);
    const day = d.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
    return day >= 1 && day <= 5;
  } catch {
    return false;
  }
}

/**
 * Calcola i due turni per una data (Turno 1: 17-20, Turno 2: 20-23)
 * applicando l'adattamento dinamico in base alle prenotazioni della giornata
 * (spalmando equamente i minuti extra se l'ultima prenotazione va oltre le 23:00 o la prima prima delle 17:00).
 */
export function computeDailyShifts(
  dateStr: string,
  bookingsOnDate: Booking[],
  savedShifts: WorkShift[] = [],
  staffList: StaffMember[] = []
): [DailyShiftComputed, DailyShiftComputed] {
  const baseStartMins = timeToMinutes(BASE_SHIFT_1_START); // 1020 (17:00)
  const baseMidMins = timeToMinutes(BASE_SHIFT_1_END); // 1200 (20:00)
  const baseEndMins = timeToMinutes(BASE_SHIFT_2_END); // 1380 (23:00)

  // Calcola orario prima e ultima prenotazione
  let earliestBookingMins = baseStartMins;
  let latestBookingMins = baseEndMins;

  if (bookingsOnDate && bookingsOnDate.length > 0) {
    for (const b of bookingsOnDate) {
      const bStart = timeToMinutes(b.oraInizio);
      let bEnd = timeToMinutes(b.oraFine);
      if (bEnd <= bStart) bEnd += 24 * 60; // Scavallamento mezzanotte

      if (bStart < earliestBookingMins) {
        earliestBookingMins = bStart;
      }
      if (bEnd > latestBookingMins) {
        latestBookingMins = bEnd;
      }
    }
  }

  const extraLateMins = Math.max(0, latestBookingMins - baseEndMins);
  const extraEarlyMins = Math.max(0, baseStartMins - earliestBookingMins);

  let shift1StartMins = baseStartMins;
  let shift1EndMins = baseMidMins;
  let shift2StartMins = baseMidMins;
  let shift2EndMins = baseEndMins;

  let adaptationReason1 = '';
  let adaptationReason2 = '';
  let isAdapted = false;
  let extraMinsPerTurn = 0;

  if (extraLateMins > 0 && extraEarlyMins === 0) {
    // Caso standard: le prenotazioni si prolungano (es. fino alle 23:30)
    // Distribuzione equa del tempo extra sui 2 turni (es. +15 min a turno)
    extraMinsPerTurn = Math.round(extraLateMins / 2);
    shift1StartMins = baseStartMins; // 17:00
    shift1EndMins = baseMidMins + extraMinsPerTurn; // es. 20:15
    shift2StartMins = shift1EndMins; // es. 20:15
    shift2EndMins = latestBookingMins; // es. 23:30

    isAdapted = true;
    adaptationReason1 = `+${extraMinsPerTurn} min (chiusura posticipata alle ${minutesToTimeString(latestBookingMins)} spalmata equamente)`;
    adaptationReason2 = `+${extraMinsPerTurn} min (chiusura posticipata alle ${minutesToTimeString(latestBookingMins)} spalmata equamente)`;
  } else if (extraEarlyMins > 0 && extraLateMins === 0) {
    // Anticipo orario di apertura prima delle 17:00
    extraMinsPerTurn = Math.round(extraEarlyMins / 2);
    shift1StartMins = earliestBookingMins; // es. 16:00
    shift1EndMins = baseMidMins - extraMinsPerTurn; // es. 19:30
    shift2StartMins = shift1EndMins; // es. 19:30
    shift2EndMins = baseEndMins; // es. 23:00

    isAdapted = true;
    adaptationReason1 = `+${extraMinsPerTurn} min (apertura anticipata alle ${minutesToTimeString(earliestBookingMins)} spalmata equamente)`;
    adaptationReason2 = `+${extraMinsPerTurn} min (apertura anticipata alle ${minutesToTimeString(earliestBookingMins)} spalmata equamente)`;
  } else if (extraEarlyMins > 0 && extraLateMins > 0) {
    // Sia anticipo che posticipo: calcolo equo sul totale
    const totalDuration = latestBookingMins - earliestBookingMins;
    const halfDuration = Math.round(totalDuration / 2);

    shift1StartMins = earliestBookingMins;
    shift1EndMins = earliestBookingMins + halfDuration;
    shift2StartMins = shift1EndMins;
    shift2EndMins = latestBookingMins;

    const totalExtra = extraEarlyMins + extraLateMins;
    extraMinsPerTurn = Math.round(totalExtra / 2);
    isAdapted = true;
    adaptationReason1 = `+${extraMinsPerTurn} min (orario esteso ${minutesToTimeString(earliestBookingMins)}-${minutesToTimeString(latestBookingMins)})`;
    adaptationReason2 = `+${extraMinsPerTurn} min (orario esteso ${minutesToTimeString(earliestBookingMins)}-${minutesToTimeString(latestBookingMins)})`;
  }

  // Risolve i dati salvati (assegnazione operatore, note, custom hours)
  const saved1 = savedShifts.find((s) => s.data === dateStr && s.turnoNumero === 1);
  const saved2 = savedShifts.find((s) => s.data === dateStr && s.turnoNumero === 2);

  // Operatore 1
  let op1 = saved1?.operatoreId ? staffList.find((st) => st.id === saved1.operatoreId) : undefined;
  // Operatore 2
  let op2 = saved2?.operatoreId ? staffList.find((st) => st.id === saved2.operatoreId) : undefined;

  // Turno 1 calcolato
  const s1Start = saved1?.isCustomHours && saved1.oraInizioEffettiva ? saved1.oraInizioEffettiva : minutesToTimeString(shift1StartMins);
  const s1End = saved1?.isCustomHours && saved1.oraFineEffettiva ? saved1.oraFineEffettiva : minutesToTimeString(shift1EndMins);
  const s1DurMins = timeToMinutes(s1End) - timeToMinutes(s1Start);

  const shift1: DailyShiftComputed = {
    id: saved1?.id || `shift-${dateStr}-1`,
    data: dateStr,
    turnoNumero: 1,
    nomeTurno: '1° Turno (Pomeridiano)',
    oraInizioBase: BASE_SHIFT_1_START,
    oraFineBase: BASE_SHIFT_1_END,
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

  // Turno 2 calcolato
  const s2Start = saved2?.isCustomHours && saved2.oraInizioEffettiva ? saved2.oraInizioEffettiva : minutesToTimeString(shift2StartMins);
  const s2End = saved2?.isCustomHours && saved2.oraFineEffettiva ? saved2.oraFineEffettiva : minutesToTimeString(shift2EndMins);
  const s2DurMins = (timeToMinutes(s2End) <= timeToMinutes(s2Start) ? timeToMinutes(s2End) + 24 * 60 : timeToMinutes(s2End)) - timeToMinutes(s2Start);

  const shift2: DailyShiftComputed = {
    id: saved2?.id || `shift-${dateStr}-2`,
    data: dateStr,
    turnoNumero: 2,
    nomeTurno: '2° Turno (Serale)',
    oraInizioBase: BASE_SHIFT_2_START,
    oraFineBase: BASE_SHIFT_2_END,
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

/**
 * Verifica se un operatore è disponibile per il turno, considerando
 * i turni di lavoro primario definiti nella sua anagrafica.
 */
export function checkOperatorShiftAvailability(
  operator: StaffMember,
  dateStr: string,
  shiftStartTime: string,
  shiftEndTime: string
): { isAvailable: boolean; conflictReason?: string } {
  if (!operator.attivo) {
    return { isAvailable: false, conflictReason: 'Operatore non attivo' };
  }
  const check = isOperatorFreeFromPrimaryWork(operator, dateStr, shiftStartTime, shiftEndTime);
  return {
    isAvailable: check.isFree,
    conflictReason: check.conflictReason,
  };
}

/**
 * Algoritmo intelligente per l'assegnazione automatica degli operatori ai turni della settimana
 * Bilancia il monte ore complessivo e rispetta le incompatibilità con il lavoro primario.
 */
export function autoAssignWeeklyShifts(
  weekDates: string[], // es. i 5 giorni da Lunedì a Venerdì
  currentShifts: WorkShift[],
  allBookings: Booking[],
  staffList: StaffMember[]
): { updatedShifts: WorkShift[]; assignedCount: number; unassignedCount: number } {
  const eligibleOps = staffList.filter((s) => s.attivo && (s.ruolo === 'operatore' || s.ruolo === 'entrambi'));
  if (eligibleOps.length === 0) {
    return { updatedShifts: currentShifts, assignedCount: 0, unassignedCount: weekDates.length * 2 };
  }

  // Mappa di ore accumulate per operatore
  const hoursTracker: Record<string, number> = {};
  eligibleOps.forEach((op) => {
    hoursTracker[op.id] = 0;
  });

  // Somma ore dei turni già salvati al di fuori della settimana target o già fissati
  currentShifts.forEach((s) => {
    if (s.operatoreId && hoursTracker[s.operatoreId] !== undefined) {
      const dur = 3; // 3 ore standard
      hoursTracker[s.operatoreId] += dur;
    }
  });

  let workingShifts = [...currentShifts];
  let assignedCount = 0;
  let unassignedCount = 0;

  for (const dateStr of weekDates) {
    const dayBookings = allBookings.filter((b) => b.data === dateStr);
    const [computed1, computed2] = computeDailyShifts(dateStr, dayBookings, workingShifts, staffList);

    // Assegna turno 1 e turno 2
    for (const computed of [computed1, computed2]) {
      // Se già assegnato e valido, continua
      const existing = workingShifts.find((s) => s.data === dateStr && s.turnoNumero === computed.turnoNumero);
      if (existing && existing.operatoreId) {
        continue;
      }

      // Trova candidati liberi da lavoro primario
      const candidates = eligibleOps.filter((op) => {
        const avail = checkOperatorShiftAvailability(op, dateStr, computed.oraInizio, computed.oraFine);
        return avail.isAvailable;
      });

      if (candidates.length === 0) {
        unassignedCount++;
        continue;
      }

      // Ordina per monte ore crescente (fairness / equità)
      candidates.sort((a, b) => (hoursTracker[a.id] || 0) - (hoursTracker[b.id] || 0));
      const chosen = candidates[0];

      // Aggiorna hours tracker
      hoursTracker[chosen.id] = (hoursTracker[chosen.id] || 0) + computed.durataOre;

      // Crea o aggiorna il record del turno
      const newShiftRecord: WorkShift = {
        id: existing?.id || `shift-${dateStr}-${computed.turnoNumero}`,
        data: dateStr,
        turnoNumero: computed.turnoNumero,
        nomeTurno: computed.nomeTurno,
        oraInizioBase: computed.oraInizioBase,
        oraFineBase: computed.oraFineBase,
        oraInizioEffettiva: computed.oraInizio,
        oraFineEffettiva: computed.oraFine,
        operatoreId: chosen.id,
        operatoreNome: `${chosen.nome} ${chosen.cognome}`,
        note: existing?.note || '',
        isCustomHours: false,
      };

      workingShifts = workingShifts.filter((s) => !(s.data === dateStr && s.turnoNumero === computed.turnoNumero));
      workingShifts.push(newShiftRecord);
      assignedCount++;
    }
  }

  return { updatedShifts: workingShifts, assignedCount, unassignedCount };
}
