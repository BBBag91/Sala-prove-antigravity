import { Booking, AuthUser, StaffMember, isLessonBooking } from '../types';

/**
 * Risolve la scheda Staff collegata all'account insegnante attualmente autenticato.
 */
export function getTeacherStaffProfile(user: AuthUser | null, staffList: StaffMember[]): StaffMember | null {
  if (!user) return null;
  return (
    staffList.find((s) => user.staffId && s.id === user.staffId) ||
    staffList.find((s) => user.email && s.email && s.email.toLowerCase() === user.email.toLowerCase()) ||
    staffList.find((s) => `${s.nome} ${s.cognome}`.trim().toLowerCase() === user.nome.trim().toLowerCase()) ||
    null
  );
}

/**
 * Verifica se una lezione appartiene al docente attualmente autenticato.
 */
export function isTeacherOwnLesson(
  booking: Partial<Booking> | null | undefined,
  user: AuthUser | null,
  staffList: StaffMember[]
): boolean {
  if (!booking || !user) return false;
  if (!isLessonBooking(booking)) return false;

  const currentTeacherStaff = getTeacherStaffProfile(user, staffList);

  // 1. Confronto per ID staff
  if (currentTeacherStaff && booking.insegnanteId && booking.insegnanteId === currentTeacherStaff.id) {
    return true;
  }
  if (user.staffId && booking.insegnanteId && booking.insegnanteId === user.staffId) {
    return true;
  }

  // 2. Confronto per nome e cognome
  if (currentTeacherStaff && booking.insegnanteNome) {
    const teacherFullName = `${currentTeacherStaff.nome} ${currentTeacherStaff.cognome}`.trim().toLowerCase();
    const bookingTeacherName = booking.insegnanteNome.trim().toLowerCase();
    if (
      teacherFullName === bookingTeacherName ||
      bookingTeacherName.includes(currentTeacherStaff.cognome.toLowerCase())
    ) {
      return true;
    }
  }

  return false;
}

export interface TeacherPermissionResult {
  canModify: boolean;
  canDelete: boolean;
  isOtherTeacherLesson: boolean;
  reason?: string;
  otherTeacherName?: string;
}

/**
 * Determina i permessi di modifica ed eliminazione per un account insegnante su una specifica prenotazione.
 * Regola richiesta: un insegnante può modificare solamente le proprie lezioni, e non quelle degli altri.
 * Può comunque prenotare le prove.
 */
export function checkTeacherBookingPermissions(
  booking: Booking | null | undefined,
  user: AuthUser | null,
  staffList: StaffMember[]
): TeacherPermissionResult {
  if (!booking) {
    return { canModify: true, canDelete: true, isOtherTeacherLesson: false };
  }

  // Amministratore o profilo non insegnante: nessun blocco specifico
  const isTeacher = user?.ruolo === 'insegnante' || user?.ruolo === 'entrambi';
  const isAdmin = user?.ruolo === 'admin';

  if (!isTeacher || isAdmin) {
    return { canModify: true, canDelete: true, isOtherTeacherLesson: false };
  }

  // L'utente è un insegnante autenticato non-admin
  const isLesson = isLessonBooking(booking);

  if (isLesson) {
    const isOwn = isTeacherOwnLesson(booking, user, staffList);
    if (isOwn) {
      return { canModify: true, canDelete: true, isOtherTeacherLesson: false };
    }

    const otherTeacherName = booking.insegnanteNome || 'un altro docente';
    return {
      canModify: false,
      canDelete: false,
      isOtherTeacherLesson: true,
      otherTeacherName,
      reason: `Questa lezione appartiene al docente ${otherTeacherName}. Nel profilo insegnante puoi modificare solamente le tue lezioni.`,
    };
  }

  // Se è una prova musicale (tipo === 'prove'):
  // L'insegnante può prenotare le prove e gestirle
  return { canModify: true, canDelete: true, isOtherTeacherLesson: false };
}
