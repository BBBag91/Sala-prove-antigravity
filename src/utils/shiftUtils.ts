import { Booking, DailyShiftComputed, StaffMember, WorkShift, isLessonBooking } from '../types';
import { parseISODate, timeToMinutes, isItalianHoliday } from './dateUtils';
import { isOperatorFreeFromPrimaryWork } from './scheduler';

export const BASE_SHIFT_1_START = '17:00';
export const BASE_SHIFT_1_END = '20:00';
export const BASE_SHIFT_2_START = '20:00';
export const BASE_SHIFT_2_END = '23:00';

export const SATURDAY_SHIFT_1_START = '09:00';
export const SATURDAY_SHIFT_1_END = '12:00';
export const SATURDAY_SHIFT_2_START = '14:00';
export const SATURDAY_SHIFT_2_END = '18:00';

export function minutesToTimeString(totalMinutes: number): string {
  // Normalize within 0 to 24*60 or handle past midnight
  const normalized = totalMinutes % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function isSaturdayDate(dateStr: string): boolean {
  try {
    const d = parseISODate(dateStr);
    return d.getDay() === 6;
  } catch {
    return false;
  }
}

export function isWeekdayDate(dateStr: string): boolean {
  try {
    const d = parseISODate(dateStr);
    const day = d.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
    if (day === 0) return false; // Tutte le domeniche: chiusura
    if (isItalianHoliday(d)) return false; // Festività nazionali italiane: chiusura
    return day >= 1 && day <= 6; // Include Lunedì - Sabato feriali (giorni operativi con presidio studio)
  } catch {
    return false;
  }
}

/**
 * Calcola i due turni per una data:
 * - Lunedì - Venerdì: Turno 1 (17:00-20:00), Turno 2 (20:00-23:00)
 * - Sabato: Turno 1 (09:00-12:00), Turno 2 (14:00-18:00)
 * applicando l'adattamento dinamico in base alle prenotazioni delle prove della giornata.
 */
export function computeDailyShifts(
  dateStr: string,
  bookingsOnDate: Booking[],
  savedShifts: WorkShift[] = [],
  staffList: StaffMember[] = []
): [DailyShiftComputed, DailyShiftComputed] {
  const isSaturday = isSaturdayDate(dateStr);

  const baseStartMins = timeToMinutes(isSaturday ? SATURDAY_SHIFT_1_START : BASE_SHIFT_1_START);
  const baseMidMins = timeToMinutes(isSaturday ? SATURDAY_SHIFT_1_END : BASE_SHIFT_1_END);
  const baseStart2Mins = timeToMinutes(isSaturday ? SATURDAY_SHIFT_2_START : BASE_SHIFT_2_START);
  const baseEndMins = timeToMinutes(isSaturday ? SATURDAY_SHIFT_2_END : BASE_SHIFT_2_END);

  // Calcola orario prima e ultima prenotazione (SOLO prove musicali, NON lezioni didattiche)
  // La copertura operatore e l'adattamento dei turni servono solo per le prove, non per le lezioni
  let earliestBookingMins = baseStartMins;
  let latestBookingMins = baseEndMins;

  const rehearsalBookings = (bookingsOnDate || []).filter((b) => !isLessonBooking(b));

  if (rehearsalBookings.length > 0) {
    for (const b of rehearsalBookings) {
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

  // Risolve i dati salvati (assegnazione operatore, note, custom hours)
  const saved1 = savedShifts.find((s) => s.data === dateStr && s.turnoNumero === 1);
  const saved2 = savedShifts.find((s) => s.data === dateStr && s.turnoNumero === 2);

  // Operatore 1
  let op1 = saved1?.operatoreId ? staffList.find((st) => st.id === saved1.operatoreId) : undefined;
  // Operatore 2
  let op2 = saved2?.operatoreId ? staffList.find((st) => st.id === saved2.operatoreId) : undefined;

  // Turno 1 calcolato
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

  // Turno 2 calcolato
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

export interface AutoAssignSummary {
  updatedShifts: WorkShift[];
  assignedCount: number;
  unassignedCount: number;
  monthlyHoursByOperator: Record<string, number>;
}

/**
 * Algoritmo intelligente (Smart Scheduling) per l'autoassegnazione dei turni di presidio sala.
 *
 * REGOLE:
 * 1. Esclude rigorosamente gli operatori incompatibili (spunta indisponibilità totale per ferie/riposo,
 *    oppure turni di lavoro primario sovrapposti per quella data/orario).
 * 2. Distribuzione equa del monte ore mensile: seleziona gli operatori idonei con il minor numero di ore
 *    assegnate nel mese di riferimento, bilanciando in modo uniforme il carico di lavoro.
 * 3. Prevenzione affaticamento: se più operatori con ore simili sono disponibili, preferisce chi non è già
 *    stato assegnato all'altro turno nella stessa giornata.
 */
export function autoAssignShifts(
  targetDates: string[],
  currentShifts: WorkShift[],
  allBookings: Booking[],
  staffList: StaffMember[],
  forceReassign: boolean = false
): AutoAssignSummary {
  const eligibleOps = staffList.filter(
    (s) => s.attivo && (s.ruolo === 'operatore' || s.ruolo === 'entrambi')
  );

  if (eligibleOps.length === 0) {
    return {
      updatedShifts: currentShifts,
      assignedCount: 0,
      unassignedCount: targetDates.filter(isWeekdayDate).length * 2,
      monthlyHoursByOperator: {},
    };
  }

  // Identifica i mesi coinvolti (es. "2026-09")
  const targetMonths = Array.from(new Set(targetDates.map((d) => d.slice(0, 7))));

  // Tracker ore mensili per ciascun mese ed operatore
  const monthlyHoursTracker: Record<string, Record<string, number>> = {};
  targetMonths.forEach((m) => {
    monthlyHoursTracker[m] = {};
    eligibleOps.forEach((op) => {
      monthlyHoursTracker[m][op.id] = 0;
    });
  });

  // Somma le ore già assegnate in quei mesi (escludendo i turni che andremo a riassegnare)
  currentShifts.forEach((s) => {
    const m = s.data.slice(0, 7);
    if (!monthlyHoursTracker[m]) return;
    if (!s.operatoreId || !monthlyHoursTracker[m][s.operatoreId] !== undefined) return;

    const isTargetSlot = targetDates.includes(s.data);
    if (!isTargetSlot || (!forceReassign && s.operatoreId)) {
      // Calcola durata turno
      const sStart = timeToMinutes(s.oraInizioEffettiva || s.oraInizioBase);
      let sEnd = timeToMinutes(s.oraFineEffettiva || s.oraFineBase);
      if (sEnd <= sStart) sEnd += 24 * 60;
      const durHours = Math.round(((sEnd - sStart) / 60) * 100) / 100;
      monthlyHoursTracker[m][s.operatoreId] = (monthlyHoursTracker[m][s.operatoreId] || 0) + durHours;
    }
  });

  let workingShifts = [...currentShifts];
  let assignedCount = 0;
  let unassignedCount = 0;

  // Ordina date cronologicamente
  const sortedDates = [...targetDates].sort();

  for (const dateStr of sortedDates) {
    if (!isWeekdayDate(dateStr)) continue; // Solo Lunedì - Venerdì

    const m = dateStr.slice(0, 7);
    const dayBookings = allBookings.filter((b) => b.data === dateStr);
    const [computed1, computed2] = computeDailyShifts(dateStr, dayBookings, workingShifts, staffList);

    // Assegna Turno 1 (17-20) e Turno 2 (20-23)
    for (const computed of [computed1, computed2]) {
      const existing = workingShifts.find(
        (s) => s.data === dateStr && s.turnoNumero === computed.turnoNumero
      );

      // Se già assegnato e valido e non forziamo riassegnazione
      if (!forceReassign && existing && existing.operatoreId) {
        // Verifica se l'operatore attualmente assegnato è ancora disponibile
        const currentOp = eligibleOps.find((op) => op.id === existing.operatoreId);
        if (currentOp) {
          const check = checkOperatorShiftAvailability(
            currentOp,
            dateStr,
            computed.oraInizio,
            computed.oraFine
          );
          if (check.isAvailable) {
            continue; // Manteniamo l'assegnazione esistente
          }
        }
      }

      // Trova candidati idonei e liberi da lavoro primario e indisponibilità totale
      const candidates = eligibleOps.filter((op) => {
        const avail = checkOperatorShiftAvailability(op, dateStr, computed.oraInizio, computed.oraFine);
        return avail.isAvailable;
      });

      if (candidates.length === 0) {
        unassignedCount++;
        continue;
      }

      // Verifica chi è già assegnato all'altro turno della stessa giornata
      const otherTurnoNum = computed.turnoNumero === 1 ? 2 : 1;
      const otherShiftToday = workingShifts.find(
        (s) => s.data === dateStr && s.turnoNumero === otherTurnoNum
      );
      const opAssignedOtherShiftToday = otherShiftToday?.operatoreId;

      // Ordina per equità del carico mensile (monte ore mensile crescente)
      // Con bonus per evitare doppio turno consecutivo nello stesso giorno se c'è alternativa
      candidates.sort((a, b) => {
        const hoursA = monthlyHoursTracker[m]?.[a.id] || 0;
        const hoursB = monthlyHoursTracker[m]?.[b.id] || 0;

        const isSameDayA = a.id === opAssignedOtherShiftToday ? 1.5 : 0;
        const isSameDayB = b.id === opAssignedOtherShiftToday ? 1.5 : 0;

        const scoreA = hoursA + isSameDayA;
        const scoreB = hoursB + isSameDayB;

        if (Math.abs(scoreA - scoreB) > 0.05) {
          return scoreA - scoreB;
        }

        // Pareggio: preferisci chi ha fatto meno turni totali o tie-breaker stabile
        return a.cognome.localeCompare(b.cognome);
      });

      const chosen = candidates[0];

      // Aggiorna ore mensili dell'operatore scelto
      monthlyHoursTracker[m][chosen.id] =
        (monthlyHoursTracker[m][chosen.id] || 0) + computed.durataOre;

      // Crea o aggiorna il record del turno
      const newShiftRecord: WorkShift = {
        id: existing?.id || `shift-${dateStr}-${computed.turnoNumero}`,
        data: dateStr,
        turnoNumero: computed.turnoNumero,
        nomeTurno: computed.nomeTurno,
        oraInizioBase: computed.oraInizioBase,
        oraFineBase: computed.oraFineBase,
        oraInizioEffettiva: computed.isAdapted ? computed.oraInizio : undefined,
        oraFineEffettiva: computed.isAdapted ? computed.oraFine : undefined,
        operatoreId: chosen.id,
        operatoreNome: `${chosen.nome} ${chosen.cognome}`,
        note: existing?.note || '',
        isCustomHours: false,
      };

      workingShifts = workingShifts.filter(
        (s) => !(s.data === dateStr && s.turnoNumero === computed.turnoNumero)
      );
      workingShifts.push(newShiftRecord);
      assignedCount++;
    }
  }

  // Prepara mappa aggregata finale per il primo mese target
  const mainMonth = targetMonths[0] || '';
  const finalMonthlyHours = monthlyHoursTracker[mainMonth] || {};

  return {
    updatedShifts: workingShifts,
    assignedCount,
    unassignedCount,
    monthlyHoursByOperator: finalMonthlyHours,
  };
}

/**
 * Auto-assegnazione per i 5 giorni feriali della settimana selezionata (Lunedì - Venerdì)
 */
export function autoAssignWeeklyShifts(
  weekDates: string[],
  currentShifts: WorkShift[],
  allBookings: Booking[],
  staffList: StaffMember[]
): { updatedShifts: WorkShift[]; assignedCount: number; unassignedCount: number } {
  const result = autoAssignShifts(weekDates, currentShifts, allBookings, staffList, false);
  return {
    updatedShifts: result.updatedShifts,
    assignedCount: result.assignedCount,
    unassignedCount: result.unassignedCount,
  };
}

/**
 * Auto-assegnazione per l'intero mese selezionato (tutti i Lun-Ven del mese)
 * con perfetta distribuzione equa del carico di lavoro tra tutti gli operatori disponibili.
 */
export function autoAssignMonthlyShifts(
  monthStr: string, // YYYY-MM
  currentShifts: WorkShift[],
  allBookings: Booking[],
  staffList: StaffMember[],
  forceReassign: boolean = false
): AutoAssignSummary {
  const [yearStr, mStr] = monthStr.split('-');
  const year = Number(yearStr);
  const monthIdx = Number(mStr) - 1;

  // Calcola tutti i giorni del mese
  const lastDay = new Date(year, monthIdx + 1, 0).getDate();
  const monthWeekdayDates: string[] = [];

  for (let day = 1; day <= lastDay; day++) {
    const d = new Date(year, monthIdx, day);
    const dayOfWeek = d.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const iso = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      monthWeekdayDates.push(iso);
    }
  }

  return autoAssignShifts(monthWeekdayDates, currentShifts, allBookings, staffList, forceReassign);
}

/**
 * Calcola il riepilogo del carico di lavoro e bilanciamento mensile per operatore
 */
export function getMonthlyWorkloadReport(
  monthStr: string, // YYYY-MM
  shifts: WorkShift[],
  staffList: StaffMember[]
): Array<{
  operator: StaffMember;
  shiftsCount: number;
  totalHours: number;
  percentage: number;
}> {
  const eligibleOps = staffList.filter(
    (s) => s.attivo && (s.ruolo === 'operatore' || s.ruolo === 'entrambi')
  );

  const monthShifts = shifts.filter((s) => s.data.startsWith(monthStr) && s.operatoreId);
  const hoursMap: Record<string, { count: number; hours: number }> = {};

  eligibleOps.forEach((op) => {
    hoursMap[op.id] = { count: 0, hours: 0 };
  });

  let totalMonthHours = 0;

  monthShifts.forEach((s) => {
    if (s.operatoreId && hoursMap[s.operatoreId]) {
      hoursMap[s.operatoreId].count += 1;
      const sStart = timeToMinutes(s.oraInizioEffettiva || s.oraInizioBase);
      let sEnd = timeToMinutes(s.oraFineEffettiva || s.oraFineBase);
      if (sEnd <= sStart) sEnd += 24 * 60;
      const dur = Math.round(((sEnd - sStart) / 60) * 100) / 100;
      hoursMap[s.operatoreId].hours += dur;
      totalMonthHours += dur;
    }
  });

  return eligibleOps.map((op) => {
    const data = hoursMap[op.id] || { count: 0, hours: 0 };
    return {
      operator: op,
      shiftsCount: data.count,
      totalHours: Math.round(data.hours * 10) / 10,
      percentage: totalMonthHours > 0 ? Math.round((data.hours / totalMonthHours) * 100) : 0,
    };
  });
}
