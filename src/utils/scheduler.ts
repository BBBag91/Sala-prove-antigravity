import { Booking, StaffMember } from '../types';
import { calculateDurationHours, parseISODate, timeToMinutes } from './dateUtils';

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

  // Determine day of week
  const dateObj = parseISODate(dateStr);
  const dayOfWeek = dateObj.getDay(); // 0 = Domenica, 1 = Lunedì...

  // Find any primary work shifts for this day of week
  const primaryShifts = operator.turniLavoroPrimario.filter(
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
    if (b.operatoreAssegnatoId && hoursMap[b.operatoreAssegnatoId] !== undefined) {
      if (!monthFilter || b.data.startsWith(monthFilter)) {
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
 * Intelligent operator assignment algorithm:
 * - Operates on provided bookings (or unassigned only)
 * - Verifies operator availability (24h - turni lavoro primario)
 * - Priority 1: CONTINUOUS SHIFTS. If an operator has a booking right before/after, favor them to avoid fragmented shifts.
 * - Priority 2: FAIRNESS. Balance total working hours between available operators.
 */
export function autoAssignOperators(
  bookingsToAssign: Booking[],
  allBookings: Booking[],
  operators: StaffMember[],
  monthFilter?: string
): AutoAssignResult {
  const eligibleOperators = operators.filter(
    (op) => op.attivo && (op.ruolo === 'operatore' || op.ruolo === 'entrambi')
  );

  if (eligibleOperators.length === 0) {
    return {
      updatedBookings: allBookings,
      assignedCount: 0,
      unassignedCount: bookingsToAssign.length,
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

  // Working copy of all bookings
  let currentBookings = [...allBookings];
  const logs: AutoAssignResult['logs'] = [];
  let assignedCount = 0;
  let unassignedCount = 0;

  // Track dynamic hours
  const hoursTracker = getOperatorAccumulatedHours(eligibleOperators, currentBookings, monthFilter);

  // Sort bookings to assign chronologically
  const sortedTargetBookings = [...bookingsToAssign].sort((a, b) => {
    if (a.data !== b.data) return a.data.localeCompare(b.data);
    return a.oraInizio.localeCompare(b.oraInizio);
  });

  for (const target of sortedTargetBookings) {
    // Find candidate operators
    const candidates: {
      operator: StaffMember;
      isContinuous: boolean;
      score: number;
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
        // Scoring formula:
        // +100 bonus for continuous adjacent shift (high priority as requested)
        // - (accumulated hours * 2) to balance workload between operators
        const continuousBonus = avail.isContinuousPossible ? 100 : 0;
        const currentHours = hoursTracker[op.id] || 0;
        const score = continuousBonus - currentHours * 2;

        candidates.push({
          operator: op,
          isContinuous: !!avail.isContinuousPossible,
          score,
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

    // Sort candidates by score descending
    candidates.sort((a, b) => b.score - a.score);
    const chosen = candidates[0];

    // Assign
    const updatedTarget: Booking = {
      ...target,
      operatoreAssegnatoId: chosen.operator.id,
      operatoreAssegnatoNome: `${chosen.operator.nome} ${chosen.operator.cognome}`,
    };

    // Update state
    currentBookings = currentBookings.map((b) => (b.id === target.id ? updatedTarget : b));
    hoursTracker[chosen.operator.id] =
      (hoursTracker[chosen.operator.id] || 0) + (target.durataOre || calculateDurationHours(target.oraInizio, target.oraFine));

    assignedCount++;
    logs.push({
      bookingId: target.id,
      bookingTitle: `${target.clienteNome} (${target.salaNome})`,
      date: target.data,
      time: `${target.oraInizio} - ${target.oraFine}`,
      assignedToName: `${chosen.operator.nome} ${chosen.operator.cognome}`,
      reason: chosen.isContinuous
        ? 'Assegnato per continuità turno lavorativo (stesso operatore)'
        : 'Assegnato per bilanciamento ore tra operatori',
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
