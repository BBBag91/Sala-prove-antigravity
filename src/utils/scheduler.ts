import { Booking, StaffMember, isLessonBooking } from '../types';
import { calculateDurationHours, formatDateToISO, parseISODate, timeToMinutes } from './dateUtils';

/**
 * Checks if two time intervals overlap on the same day.
 * Times are formatted "HH:mm".
 */
export function doTimesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const sA = timeToMinutes(startA);
  let eA = timeToMinutes(endA);
  if (eA <= sA) eA += 24 * 60; // Handle over-midnight if any

  const sB = timeToMinutes(startB);
  let eB = timeToMinutes(endB);
  if (eB <= sB) eB += 24 * 60;

  return Math.max(sA, sB) < Math.min(eA, eB);
}

/**
 * Checks if an operator is free from their primary job during the specified date and time interval.
 * Availability = (24h of the day) MINUS (turni lavoro primario).
 * Returns true if the operator has NO overlapping primary work shift at that time.
 */
export function isOperatorFreeFromPrimaryWork(
  operator: StaffMember,
  dateStr: string,
  startTime: string,
  endTime: string
): { isFree: boolean; conflictReason?: string } {
  if (!operator.attivo) {
    return { isFree: false, conflictReason: 'Operatore disattivato' };
  }

  // 1. Priorità: Verifica eccezione/calendario mensile specifico per questa data (se configurato)
  if (operator.indisponibilitaDate && operator.indisponibilitaDate.length > 0) {
    const dateEntries = operator.indisponibilitaDate.filter((d) => d.data === dateStr);
    if (dateEntries.length > 0) {
      // Spunta di indisponibilità totale (ferie, riposo, impegni, malattia)
      const totalUnavailable = dateEntries.find((d) => d.indisponibileTotale);
      if (totalUnavailable) {
        return {
          isFree: false,
          conflictReason: totalUnavailable.motivo
            ? `Indisponibile: ${totalUnavailable.motivo}`
            : 'Indisponibilità totale (Ferie / Riposo / Impegno)',
        };
      }

      // Se ci sono una o più fasce orarie specifiche di indisponibilità per questa data
      const timeShifts = dateEntries.filter((d) => d.oraInizio && d.oraFine);
      if (timeShifts.length > 0) {
        for (const shift of timeShifts) {
          if (doTimesOverlap(startTime, endTime, shift.oraInizio!, shift.oraFine!)) {
            return {
              isFree: false,
              conflictReason: `In turno lavoro primario (${shift.oraInizio} - ${shift.oraFine}${
                shift.motivo ? ` - ${shift.motivo}` : ''
              })`,
            };
          }
        }
        // Nessuna delle fasce orarie specifiche si sovrappone -> Operatore libero!
        return { isFree: true };
      } else {
        // Giorno registrato senza ore e senza spunta di indisponibilità totale (giorno libero esplicito)
        return { isFree: true };
      }
    }
  }

  // 2. Fallback: Orari settimanali standard ricorsivi
  const dateObj = parseISODate(dateStr);
  const dayOfWeek = dateObj.getDay(); // 0 = Domenica, 1 = Lunedì...

  const primaryShifts = (operator.turniLavoroPrimario || []).filter(
    (shift) => shift.giornoSettimana === dayOfWeek
  );

  for (const shift of primaryShifts) {
    if (doTimesOverlap(startTime, endTime, shift.oraInizio, shift.oraFine)) {
      return {
        isFree: false,
        conflictReason: `In turno lavoro primario (${shift.oraInizio} - ${shift.oraFine}${
          shift.descrizione ? ` - ${shift.descrizione}` : ''
        })`,
      };
    }
  }

  return { isFree: true };
}

/**
 * Returns availability status of an operator for a booking,
 * considering both primary work shifts and already assigned room bookings.
 */
export function checkOperatorAvailability(
  operator: StaffMember,
  bookingDate: string,
  startTime: string,
  endTime: string,
  allBookings: Booking[],
  currentBookingId?: string
): {
  available: boolean;
  statusText: string;
  isContinuousPossible?: boolean;
} {
  // 1. Check primary work
  const primaryCheck = isOperatorFreeFromPrimaryWork(operator, bookingDate, startTime, endTime);
  if (!primaryCheck.isFree) {
    return {
      available: false,
      statusText: primaryCheck.conflictReason || 'Lavoro primario',
    };
  }

  // 2. Check if operator already assigned to another overlapping booking on same date
  const concurrentBooking = allBookings.find(
    (b) =>
      b.id !== currentBookingId &&
      b.data === bookingDate &&
      b.operatoreAssegnatoId === operator.id &&
      doTimesOverlap(startTime, endTime, b.oraInizio, b.oraFine)
  );

  if (concurrentBooking) {
    return {
      available: false,
      statusText: `Già impegnato in ${concurrentBooking.salaNome} (${concurrentBooking.oraInizio}-${concurrentBooking.oraFine})`,
    };
  }

  // 3. Check if operator has an adjacent booking (continuity)
  const isContinuous = allBookings.some((b) => {
    if (
      b.id === currentBookingId ||
      b.data !== bookingDate ||
      b.operatoreAssegnatoId !== operator.id
    ) {
      return false;
    }
    const endPrev = timeToMinutes(b.oraFine);
    const startCurr = timeToMinutes(startTime);
    const endCurr = timeToMinutes(endTime);
    const startNext = timeToMinutes(b.oraInizio);

    // Directly adjacent (0 to 30 min gap)
    const followsPrev = startCurr >= endPrev && startCurr - endPrev <= 30;
    const precedesNext = startNext >= endCurr && startNext - endCurr <= 30;
    return followsPrev || precedesNext;
  });

  return {
    available: true,
    statusText: isContinuous ? 'Disponibile (Turno Continuativo)' : 'Disponibile',
    isContinuousPossible: isContinuous,
  };
}

/**
 * Calculates current accumulated hours for each operator across bookings
 */
export function getOperatorAccumulatedHours(
  operators: StaffMember[],
  bookings: Booking[],
  monthFilter?: string // YYYY-MM
): Record<string, number> {
  const hoursMap: Record<string, number> = {};
  for (const op of operators) {
    hoursMap[op.id] = 0;
  }

  for (const b of bookings) {
    if (!isLessonBooking(b) && b.operatoreAssegnatoId && hoursMap[b.operatoreAssegnatoId] !== undefined) {
      if (!monthFilter || b.data.startsWith(monthFilter)) {
        hoursMap[b.operatoreAssegnatoId] += b.durataOre || calculateDurationHours(b.oraInizio, b.oraFine);
      }
    }
  }

  return hoursMap;
}

/**
 * Restituisce la data ISO (YYYY-MM-DD) del Lunedì della settimana corrispondente alla data indicata.
 * Tutti i giorni da Lunedì a Domenica della medesima settimana condividono la stessa chiave.
 */
export function getWeekMondayKey(dateStr: string): string {
  const date = parseISODate(dateStr);
  const day = date.getDay(); // 0 = Dom, 1 = Lun ... 6 = Sab
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  return formatDateToISO(monday);
}

/**
 * Calcola le ore accumulate da ciascun operatore per una specifica settimana (Lun-Dom).
 */
export function getOperatorWeeklyHours(
  operators: StaffMember[],
  bookings: Booking[],
  weekKey: string // YYYY-MM-DD del Lunedì
): Record<string, number> {
  const hoursMap: Record<string, number> = {};
  for (const op of operators) {
    hoursMap[op.id] = 0;
  }

  for (const b of bookings) {
    if (!isLessonBooking(b) && b.operatoreAssegnatoId && hoursMap[b.operatoreAssegnatoId] !== undefined) {
      if (getWeekMondayKey(b.data) === weekKey) {
        hoursMap[b.operatoreAssegnatoId] += b.durataOre || calculateDurationHours(b.oraInizio, b.oraFine);
      }
    }
  }

  return hoursMap;
}

export interface AutoAssignResult {
  updatedBookings: Booking[];
  assignedCount: number;
  unassignedCount: number;
  logs: {
    bookingId: string;
    bookingTitle: string;
    date: string;
    time: string;
    assignedToName?: string;
    reason: string;
    isContinuous: boolean;
  }[];
}

/**
 * Algoritmo di auto-assegnazione intelligente dei turni sala:
 * - Esclude categoricamente le lezioni musicali (gestite autonomamente dai docenti).
 * - Verifica disponibilità operatore (24h - turni lavoro primario ed eccezioni).
 * - Priorità 1: CONTINUITÀ TURNO (+100 punti se l'operatore ha già una prenotazione contigua nello stesso giorno).
 * - Priorità 2: EQUILIBRIO SETTIMANALE (Lun-Dom). La ripartizione del carico avviene rigorosamente di settimana
 *   in settimana (e NON mensile), garantendo che operatori con vincoli di lavoro primario (es. Paolo) non vengano
 *   sovraccaricati nei giorni liberi per colmare i deficit di altre settimane.
 * - Priorità 3: Distribuzione dei giorni di presidio nella settimana.
 */
export function autoAssignOperators(
  bookingsToAssign: Booking[],
  allBookings: Booking[],
  operators: StaffMember[],
  _monthFilter?: string
): AutoAssignResult {
  const eligibleOperators = operators.filter(
    (op) => op.attivo && (op.ruolo === 'operatore' || op.ruolo === 'entrambi')
  );

  // Le lezioni non necessitano di operatore di presidio sala (sono gestite autonomamente dal docente)
  const rehearsalBookings = bookingsToAssign.filter((b) => !isLessonBooking(b));

  if (eligibleOperators.length === 0) {
    return {
      updatedBookings: allBookings,
      assignedCount: 0,
      unassignedCount: rehearsalBookings.length,
      logs: [
        {
          bookingId: 'all',
          bookingTitle: 'Tutte',
          date: '',
          time: '',
          reason: 'Nessun operatore abilitato trovato.',
          isContinuous: false,
        },
      ],
    };
  }

  // Copia di lavoro di tutte le prenotazioni
  let currentBookings = [...allBookings];
  const logs: AutoAssignResult['logs'] = [];
  let assignedCount = 0;
  let unassignedCount = 0;

  // Tracker dinamico delle ore per settimana: weekKey (Lunedì) -> { [operatorId]: number }
  const weeklyHoursTracker: Record<string, Record<string, number>> = {};

  const getWeekHoursFor = (wKey: string) => {
    if (!weeklyHoursTracker[wKey]) {
      weeklyHoursTracker[wKey] = getOperatorWeeklyHours(eligibleOperators, currentBookings, wKey);
    }
    return weeklyHoursTracker[wKey];
  };

  // Ordina le prenotazioni da assegnare cronologicamente (per data e poi orario inizio)
  const sortedTargetBookings = [...rehearsalBookings].sort((a, b) => {
    if (a.data !== b.data) return a.data.localeCompare(b.data);
    return a.oraInizio.localeCompare(b.oraInizio);
  });

  for (const target of sortedTargetBookings) {
    const targetWeekKey = getWeekMondayKey(target.data);
    const weekHours = getWeekHoursFor(targetWeekKey);
    const duration = target.durataOre || calculateDurationHours(target.oraInizio, target.oraFine);

    // Trova candidati idonei
    const candidates: {
      operator: StaffMember;
      isContinuous: boolean;
      score: number;
      hoursThisWeek: number;
    }[] = [];

    for (const op of eligibleOperators) {
      const avail = checkOperatorAvailability(
        op,
        target.data,
        target.oraInizio,
        target.oraFine,
        currentBookings,
        target.id
      );

      if (avail.available) {
        // Punteggio bilanciamento settimanale:
        // +100 bonus per turno contiguo adiacente (evita spezzettamenti inutili nello stesso giorno)
        // - (ore accumulate in QUESTA SPECIFICA SETTIMANA * 10) per garantire perfetta equità settimanale
        // - (giorni già lavorati in questa settimana * 2) per favorire la rotazione dei giorni di riposo
        const continuousBonus = avail.isContinuousPossible ? 100 : 0;
        const currentHoursInWeek = weekHours[op.id] || 0;

        // Quanti giorni distinti l'operatore lavora già in questa settimana (Lun-Dom)
        const daysInWeek = currentBookings
          .filter(
            (b) =>
              !isLessonBooking(b) &&
              b.operatoreAssegnatoId === op.id &&
              getWeekMondayKey(b.data) === targetWeekKey
          )
          .map((b) => b.data);
        const uniqueDaysInWeek = new Set(daysInWeek).size;

        const score = continuousBonus - currentHoursInWeek * 10 - uniqueDaysInWeek * 2;

        candidates.push({
          operator: op,
          isContinuous: !!avail.isContinuousPossible,
          score,
          hoursThisWeek: currentHoursInWeek,
        });
      }
    }

    if (candidates.length === 0) {
      unassignedCount++;
      logs.push({
        bookingId: target.id,
        bookingTitle: `${target.clienteNome} (${target.salaNome})`,
        date: target.data,
        time: `${target.oraInizio} - ${target.oraFine}`,
        reason: 'Nessun operatore libero da lavoro primario o già tutti occupati',
        isContinuous: false,
      });
      continue;
    }

    // Ordina candidati per punteggio decrescente
    candidates.sort((a, b) => b.score - a.score);
    const chosen = candidates[0];

    // Assegna operatore alla prenotazione
    const updatedTarget: Booking = {
      ...target,
      operatoreAssegnatoId: chosen.operator.id,
      operatoreAssegnatoNome: `${chosen.operator.nome} ${chosen.operator.cognome}`,
    };

    // Aggiorna stato locale e monte ore settimanale dell'operatore
    currentBookings = currentBookings.map((b) => (b.id === target.id ? updatedTarget : b));
    weekHours[chosen.operator.id] = (weekHours[chosen.operator.id] || 0) + duration;

    assignedCount++;
    logs.push({
      bookingId: target.id,
      bookingTitle: `${target.clienteNome} (${target.salaNome})`,
      date: target.data,
      time: `${target.oraInizio} - ${target.oraFine}`,
      assignedToName: `${chosen.operator.nome} ${chosen.operator.cognome}`,
      reason: chosen.isContinuous
        ? 'Assegnato per continuità turno (stesso operatore in sala)'
        : `Assegnato per bilanciamento settimanale (${chosen.hoursThisWeek}h già assegnate questa settimana)`,
      isContinuous: chosen.isContinuous,
    });
  }

  return {
    updatedBookings: currentBookings,
    assignedCount,
    unassignedCount,
    logs,
  };
}

/**
 * Verifica se tra tutti gli operatori attivi c'è almeno un operatore presente/disponibile
 * (libero da turni di lavoro primario ed indisponibilità).
 * Se NESSUNO degli operatori è presente causa lavoro primario, ritorna hasCoverage: false.
 */
export function checkOperatorsCoverageForTimeSlot(
  staffList: StaffMember[],
  dateStr: string,
  startTime: string,
  endTime: string
): {
  hasCoverage: boolean;
  totalOperatorsCount: number;
  availableOperators: StaffMember[];
  unavailableOperators: { operator: StaffMember; reason: string }[];
} {
  const eligibleOps = (staffList || []).filter(
    (s) => s.attivo && (s.ruolo === 'operatore' || s.ruolo === 'entrambi')
  );

  if (eligibleOps.length === 0) {
    return {
      hasCoverage: true,
      totalOperatorsCount: 0,
      availableOperators: [],
      unavailableOperators: [],
    };
  }

  const availableOperators: StaffMember[] = [];
  const unavailableOperators: { operator: StaffMember; reason: string }[] = [];

  for (const op of eligibleOps) {
    const check = isOperatorFreeFromPrimaryWork(op, dateStr, startTime, endTime);
    if (check.isFree) {
      availableOperators.push(op);
    } else {
      unavailableOperators.push({
        operator: op,
        reason: check.conflictReason || 'In turno lavoro primario',
      });
    }
  }

  return {
    hasCoverage: availableOperators.length > 0,
    totalOperatorsCount: eligibleOps.length,
    availableOperators,
    unavailableOperators,
  };
}

