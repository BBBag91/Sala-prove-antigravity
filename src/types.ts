export type StaffRole = 'operatore' | 'insegnante' | 'entrambi';

export interface PrimaryWorkShift {
  id: string;
  giornoSettimana: number; // 0 = Domenica, 1 = Lunedì, ..., 6 = Sabato
  oraInizio: string; // HH:mm (es. "08:30")
  oraFine: string; // HH:mm (es. "17:00")
  descrizione?: string; // es. "Azienda / Ufficio"
}

export interface StaffMember {
  id: string;
  nome: string;
  cognome: string;
  ruolo: StaffRole;
  email: string;
  telefono: string;
  materieInsegnamento?: string; // se insegnante
  turniLavoroPrimario: PrimaryWorkShift[]; // Orari in cui è occupato nel lavoro primario
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
  operatoreAssegnatoId?: string; // ID operatore responsabile del turno sala
  operatoreAssegnatoNome?: string;
  tariffaTotale: number;
  statoPagamento: PaymentStatus;
  metodoPagamento?: PaymentMethod;
  richiesteStrumentazione?: string;
  note?: string;
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
