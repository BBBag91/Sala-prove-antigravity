export type UserRole = 'admin' | 'user';

export interface AuthUser {
  id: string;
  email: string;
  nome: string;
  ruolo: UserRole;
  avatar?: string;
}

export type StaffRole = 'operatore' | 'insegnante' | 'entrambi';

// Turni di presidio sala prove (Lun-Ven: 1° 17:00-20:00, 2° 20:00-23:00 con adattamento dinamico)
export interface WorkShift {
  id: string;
  data: string; // YYYY-MM-DD
  turnoNumero: 1 | 2;
  nomeTurno: string;
  oraInizioBase: string; // "17:00" | "20:00"
  oraFineBase: string; // "20:00" | "23:00"
  oraInizioEffettiva?: string;
  oraFineEffettiva?: string;
  operatoreId?: string;
  operatoreNome?: string;
  note?: string;
  isCustomHours?: boolean;
}

export interface DailyShiftComputed {
  id: string;
  data: string;
  turnoNumero: 1 | 2;
  nomeTurno: string;
  oraInizioBase: string;
  oraFineBase: string;
  oraInizio: string; // Dinamica o base
  oraFine: string; // Dinamica o base
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

export interface PrimaryWorkShift {
  id: string;
  giornoSettimana: number; // 0 = Domenica, 1 = Lunedì, ..., 6 = Sabato
  oraInizio: string; // HH:mm (es. "08:30")
  oraFine: string; // HH:mm (es. "17:00")
  descrizione?: string; // es. "Azienda / Ufficio"
}

// Calendario flessibile mensile per lavoro primario e indisponibilità totale (ferie, riposo, turni variabili)
export interface PrimaryWorkShiftDate {
  id?: string;
  data: string; // YYYY-MM-DD
  indisponibileTotale: boolean; // Se true, l'operatore è totalmente indisponibile per l'intera giornata (ferie, riposo, impegni)
  oraInizio?: string; // HH:mm (se lavora in orario specifico per quella data)
  oraFine?: string; // HH:mm
  motivo?: string; // es. "Ferie", "Riposo", "Turno Pomeridiano", "Turno Notturno"
}

export interface StaffMember {
  id: string;
  nome: string;
  cognome: string;
  ruolo: StaffRole;
  email: string;
  telefono: string;
  materieInsegnamento?: string; // se insegnante
  turniLavoroPrimario: PrimaryWorkShift[]; // Orari standard settimanali
  indisponibilitaDate?: PrimaryWorkShiftDate[]; // Calendario mensile date-specific (turni variabili e indisponibilità totale)
  coloreBadge: string;
  attivo: boolean;
  tariffaOrariaRimborso?: number; // Rimborso orario per la sala prove (€/ora)
  note?: string;
}

export type MembershipStatus = 'attivo' | 'scaduto' | 'in_attesa';

export interface Client {
  id: string;
  nome: string;
  cognome: string;
  codiceFiscale: string;
  residenza: string;
  sesso: 'M' | 'F' | 'Altro';
  dataNascita: string; // YYYY-MM-DD
  luogoNascita: string;
  telefono: string;
  email: string;
  statoTesseramento: MembershipStatus;
  numeroTessera: string;
  dataTesseramento: string; // YYYY-MM-DD
  dataScadenzaTesseramento: string; // YYYY-MM-DD
  quotaTesseramento: number; // es. 15.00
  descrizioneStrumentazione: string; // Es. "Batteria completa con piatti, 2 ampli chitarra valvolari, 3 microfoni voce..."
  gruppoBand?: string;
  note?: string;
}

export interface StudioInfo {
  nome: string; // Nome personalizzabile della sala prove / struttura
  sottotitolo?: string;
  indirizzo?: string;
  telefono?: string;
  email?: string;
  citta?: string;
  cap?: string;
  codiceFiscalePiva?: string;
  sitoWeb?: string;
  note?: string;
}

export interface Room {
  id: string;
  nome: string; // es. "Sala Hendrix (Rock)", "Sala Coltrane (Jazz)"
  descrizione: string;
  colore: string; // Hex color per calendari ed etichette
  tariffaOraria: number; // €/ora per prove
  tariffaLezione?: number; // €/ora per lezioni
  capienza: number; // numero persone
  dotazione: string[]; // Lista attrezzature disponibili nella sala
  stato: 'disponibile' | 'manutenzione';
}

export type BookingType = 'prove' | 'lezione';
export type PaymentStatus = 'pagato' | 'da_saldare';
export type PaymentMethod = 'contanti' | 'pos' | 'bonifico';

export interface Booking {
  id: string;
  clienteId: string;
  clienteNome: string;
  salaId: string;
  salaNome: string;
  tipo: BookingType;
  insegnanteId?: string; // Se è una lezione, quale insegnante
  insegnanteNome?: string;
  data: string; // YYYY-MM-DD
  oraInizio: string; // HH:mm
  oraFine: string; // HH:mm
  durataOre: number;
  ripetizioneSettimanale: boolean;
  gruppoRicorrenzaId?: string;
  settimaneRipetizione?: number;
  recurrenceConfig?: RecurrenceConfig;
  operatoreAssegnatoId?: string; // ID operatore responsabile del turno sala
  operatoreAssegnatoNome?: string;
  tariffaTotale: number;
  sconto?: number; // Sconto applicato (€)
  statoPagamento: PaymentStatus;
  metodoPagamento?: PaymentMethod;
  richiesteStrumentazione?: string;
  note?: string;
}

export type RecurrenceFrequency = 'nessuna' | 'giornaliera' | 'settimanale' | 'mensile';
export type RecurrenceEndType = 'fino_al' | 'conteggio' | 'per_sempre';

export interface RecurrenceConfig {
  attiva: boolean;
  frequenza: RecurrenceFrequency;
  intervallo: number; // ogni 1, 2, ... settimane
  giorniSettimana: number[]; // 0=Dom, 1=Lun, 2=Mar, 3=Mer, 4=Gio, 5=Ven, 6=Sab
  tipoFine: RecurrenceEndType; // 'fino_al' | 'conteggio' | 'per_sempre'
  dataFine?: string; // YYYY-MM-DD
  conteggioOccorrenze?: number; // es. 4, 8, 12...
}

export type ExpenseCategory =
  | 'affitto'
  | 'energia'
  | 'acqua'
  | 'manutenzione'
  | 'attrezzatura'
  | 'compensi_personale'
  | 'tesseramenti_costi'
  | 'pulizie'
  | 'commercialista'
  | 'altro';

export interface Expense {
  id: string;
  data: string; // YYYY-MM-DD
  categoria: ExpenseCategory;
  descrizione: string;
  importo: number;
  metodoPagamento: 'bonifico' | 'pos' | 'contanti' | 'addebito_diretto';
  fornitore?: string;
  numeroFatturaRicevuta?: string;
  stato: 'pagato' | 'in_scadenza';
  note?: string;
}

export interface ManualIncome {
  id: string;
  data: string; // YYYY-MM-DD
  categoria: 'tesseramento' | 'prove' | 'lezioni' | 'vendita_accessori' | 'altro';
  descrizione: string;
  importo: number;
  clienteId?: string;
  metodoPagamento?: PaymentMethod;
}
