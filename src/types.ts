/**
 * Ruoli di autorizzazione utente per il controllo accessi (RBAC).
 * - 'admin': Accesso completo (anagrafica, personale, finanza, configurazioni, eliminazioni).
 * - 'user': Operatore o utente standard (accesso consultazione calendario, turni e proprio profilo).
 */
export type UserRole = 'admin' | 'user';

/**
 * Rappresenta la sessione dell'utente autenticato nell'applicazione.
 */
export interface AuthUser {
  /** Identificativo univoco dell'utente (UUID o ID stringa) */
  id: string;
  /** Indirizzo email di accesso */
  email: string;
  /** Nome e cognome visualizzati */
  nome: string;
  /** Ruolo assegnato (admin o user) */
  ruolo: UserRole;
  /** Emoji o icona associata al profilo (es. 👑 o 👤) */
  avatar?: string;
}

/**
 * Ruolo operativo all'interno della struttura musicale.
 * - 'operatore': Presidio sale e assistenza clienti.
 * - 'insegnante': Docente di corsi e lezioni musicali.
 * - 'entrambi': Svolge sia turni di presidio sia docenza.
 */
export type StaffRole = 'operatore' | 'insegnante' | 'entrambi';

/**
 * Turno di presidio della sala prove salvato nel database (Lun-Ven).
 * Include orari base di riferimento ed eventuali orari effettivi adattati.
 */
export interface WorkShift {
  /** Identificativo univoco del turno */
  id: string;
  /** Data del turno in formato standard ISO (YYYY-MM-DD) */
  data: string;
  /** Numero del turno: 1 (pomeridiano, base 17:00-20:00) o 2 (serale, base 20:00-23:00) */
  turnoNumero: 1 | 2;
  /** Denominazione leggibile (es. "1° Turno (17:00 - 20:00)") */
  nomeTurno: string;
  /** Orario di inizio nominale di default ("17:00" o "20:00") */
  oraInizioBase: string;
  /** Orario di fine nominale di default ("20:00" o "23:00") */
  oraFineBase: string;
  /** Orario effettivo anticipato o personalizzato se presente (HH:mm) */
  oraInizioEffettiva?: string;
  /** Orario effettivo posticipato o personalizzato se presente (HH:mm) */
  oraFineEffettiva?: string;
  /** ID dello staff assegnato al turno */
  operatoreId?: string;
  /** Nome completo dell'operatore assegnato */
  operatoreNome?: string;
  /** Note o indicazioni operative sul turno */
  note?: string;
  /** Flag che indica se gli orari sono stati forzati manualmente dall'amministratore */
  isCustomHours?: boolean;
}

/**
 * Oggetto calcolato a runtime che unisce il turno base alle prenotazioni effettive del giorno,
 * determinando l'estensione automatica del presidio (es. se una prova finisce alle 23:30).
 */
export interface DailyShiftComputed {
  /** Identificativo del turno calcolato */
  id: string;
  /** Data di riferimento (YYYY-MM-DD) */
  data: string;
  /** 1 = Turno pomeridiano, 2 = Turno serale */
  turnoNumero: 1 | 2;
  /** Nome descrittivo del turno */
  nomeTurno: string;
  /** Inizio base teorico (es. 17:00) */
  oraInizioBase: string;
  /** Fine base teorica (es. 23:00) */
  oraFineBase: string;
  /** Inizio effettivo calcolato in base alle prenotazioni presenti o modifiche manuali */
  oraInizio: string;
  /** Fine effettiva calcolata in base alle prenotazioni presenti o modifiche manuali */
  oraFine: string;
  /** Durata totale del turno in minuti */
  durataMinuti: number;
  /** Durata totale del turno in ore decimali (es. 3.5 per 3h 30m) */
  durataOre: number;
  /** Minuti extra di presidio rispetto alla fascia base nominale */
  minutiExtra: number;
  /** Indica se l'orario è stato adattato dinamicamente a causa delle prenotazioni */
  isAdapted: boolean;
  /** Spiegazione testuale dell'adattamento (es. "Prolungato: prove attive fino alle 23:30") */
  adaptationReason?: string;
  /** ID operatore assegnato */
  operatoreId?: string;
  /** Nome operatore assegnato */
  operatoreNome?: string;
  /** Colore hex del badge identificativo dell'operatore */
  operatoreBadgeColor?: string;
  /** Note sul turno */
  note?: string;
  /** Flag orari manuali personalizzati */
  isCustomHours?: boolean;
}

/**
 * Fascia oraria di lavoro primario standard settimanale di un operatore (es. lavoro da dipendente).
 * Utilizzata dall'algoritmo di assegnazione per evitare sovrapposizioni.
 */
export interface PrimaryWorkShift {
  /** ID univoco della regola */
  id: string;
  /** Giorno della settimana: 0 = Domenica, 1 = Lunedì, ..., 6 = Sabato */
  giornoSettimana: number;
  /** Orario di inizio lavoro primario (HH:mm, es. "08:30") */
  oraInizio: string;
  /** Orario di fine lavoro primario (HH:mm, es. "17:00") */
  oraFine: string;
  /** Descrizione opzionale dell'attività (es. "Ufficio", "Azienda") */
  descrizione?: string;
}

/**
 * Eccezione specifica per una singola data nel calendario mensile di un operatore.
 * Permette di definire ferie, riposi o turni variabili per quel giorno esatto.
 */
export interface PrimaryWorkShiftDate {
  /** ID univoco dell'eccezione */
  id?: string;
  /** Data interessata (YYYY-MM-DD) */
  data: string;
  /** Se true, l'operatore è totalmente assente/indisponibile per tutto il giorno */
  indisponibileTotale: boolean;
  /** Inizio orario primario specifico per quella giornata */
  oraInizio?: string;
  /** Fine orario primario specifica per quella giornata */
  oraFine?: string;
  /** Causa dell'eccezione (es. "Ferie", "Permesso", "Turno Notturno") */
  motivo?: string;
}

/**
 * Membro dello Staff dello studio (operatore di sala o insegnante di musica).
 */
export interface StaffMember {
  /** Identificativo univoco operatore */
  id: string;
  /** Nome dell'operatore */
  nome: string;
  /** Cognome dell'operatore */
  cognome: string;
  /** Ruolo operativo ('operatore', 'insegnante', 'entrambi') */
  ruolo: StaffRole;
  /** Email di contatto */
  email: string;
  /** Numero di telefono/cellulare per comunicazioni e WhatsApp */
  telefono: string;
  /** Elenco strumenti o materie insegnate (solo per insegnanti) */
  materieInsegnamento?: string;
  /** Regole orarie standard settimanali del lavoro primario */
  turniLavoroPrimario: PrimaryWorkShift[];
  /** Calendario eccezioni date-specific (ferie, turni a rotazione) */
  indisponibilitaDate?: PrimaryWorkShiftDate[];
  /** Colore hex univoco per badge e grafici di carico */
  coloreBadge: string;
  /** Stato di attività: se false, l'operatore non riceve nuove assegnazioni */
  attivo: boolean;
  /** Rimborso spese orario pattuito per il presidio sala (€/ora) */
  tariffaOrariaRimborso?: number;
  /** Note interne sul collaboratore */
  note?: string;
}

/**
 * Stato della tessera associativa/iscrizione del cliente.
 * - 'attivo': Tesseramento valido e in corso.
 * - 'scaduto': Tesseramento annuale scaduto (richiede rinnovo).
 * - 'in_attesa': Richiesta inviata in attesa di approvazione o pagamento.
 */
export type MembershipStatus = 'attivo' | 'scaduto' | 'in_attesa';

/**
 * Cliente registrato della sala prove (musicista o referente della band).
 */
export interface Client {
  /** ID univoco del cliente */
  id: string;
  /** Nome del cliente */
  nome: string;
  /** Cognome del cliente */
  cognome: string;
  /** Codice Fiscale (16 caratteri) per emissione ricevute e libro soci */
  codiceFiscale: string;
  /** Indirizzo completo di residenza */
  residenza: string;
  /** Sesso anagrafico ('M' | 'F' | 'Altro') */
  sesso: 'M' | 'F' | 'Altro';
  /** Data di nascita (YYYY-MM-DD) */
  dataNascita: string;
  /** Luogo o comune di nascita */
  luogoNascita: string;
  /** Numero di telefono per contatti e messaggistica */
  telefono: string;
  /** Indirizzo email */
  email: string;
  /** Stato corrente della tessera associativa */
  statoTesseramento: MembershipStatus;
  /** Numero progressivo della tessera associativa */
  numeroTessera: string;
  /** Data di emissione o rinnovo della tessera (YYYY-MM-DD) */
  dataTesseramento: string;
  /** Data di scadenza naturale della tessera (YYYY-MM-DD) */
  dataScadenzaTesseramento: string;
  /** Quota versata per il tesseramento in Euro (€) */
  quotaTesseramento: number;
  /** Specifiche della strumentazione richiesta dalla band/musicista */
  descrizioneStrumentazione: string;
  /** Nome della band o progetto musicale associato */
  gruppoBand?: string;
  /** Note anagrafiche aggiuntive */
  note?: string;
}

/**
 * Fornitori gateway supportati per l'invio messaggi WhatsApp.
 */
export type WhatsAppProvider = 'ultramsg' | 'greenapi' | 'whapi' | 'webhook' | 'manual';

/**
 * Configurazione per le notifiche automatiche WhatsApp al gruppo staff.
 */
export interface WhatsAppNotificationConfig {
  /** Abilita o disabilita il servizio notifiche */
  enabled: boolean;
  /** Provider gateway selezionato */
  provider: WhatsAppProvider;
  /** ID Istanza del provider API (es. instance12345) */
  instanceId?: string;
  /** Token di autenticazione API */
  token?: string;
  /** ID del gruppo WhatsApp destinatario (es. 120363024829182391@g.us) */
  chatId?: string;
  /** Nome identificativo del gruppo WhatsApp */
  groupName?: string;
  /** Link di invito diretto al gruppo */
  groupInviteLink?: string;
  /** URL webhook personalizzato per inoltro payload (Zapier/Make/Custom) */
  webhookUrl?: string;
  /** Orario prefissato per la notifica mattutina (default: "10:00") */
  orarioNotifica?: string;
  /** Includere stato pagamenti delle sale nel messaggio */
  includiStatoPagamenti?: boolean;
  /** Includere dettagli strumentazione nel messaggio */
  includiDotazione?: boolean;
  /** Invio automatico del messaggio mattutino alle 10:00 se gateway attivo */
  autoSendMorning?: boolean;
  /** Abilitare notifica push del browser locale alle 10:00 */
  browserNotificationEnabled?: boolean;
  /** Data ISO dell'ultimo invio automatico effettuato con successo (YYYY-MM-DD) */
  lastAutoSentDate?: string;
}

/**
 * Informazioni generali e intestazione ufficiale della sala prove / associazione.
 */
export interface StudioInfo {
  /** Nome ufficiale dello studio musicale */
  nome: string;
  /** Sottotitolo o descrizione istituzionale */
  sottotitolo?: string;
  /** Indirizzo stradale della sede */
  indirizzo?: string;
  /** Recapito telefonico principale */
  telefono?: string;
  /** Email ufficiale */
  email?: string;
  /** Città della sede */
  citta?: string;
  /** Codice di avviamento postale */
  cap?: string;
  /** Codice fiscale e/o Partita IVA */
  codiceFiscalePiva?: string;
  /** Indirizzo web / sito */
  sitoWeb?: string;
  /** Note o comunicazioni generali per stampe e ricevute */
  note?: string;
  /** Configurazione gateway notifiche WhatsApp */
  whatsappConfig?: WhatsAppNotificationConfig;
}

/**
 * Sala prove o box musicale presente nella struttura.
 */
export interface Room {
  /** Identificativo univoco della sala */
  id: string;
  /** Nome della sala (es. "Sala Hendrix", "Sala Coltrane") */
  nome: string;
  /** Descrizione acustica e caratteristiche della sala */
  descrizione: string;
  /** Colore identificativo Hex per il calendario */
  colore: string;
  /** Tariffa oraria standard per le prove band (€/ora) */
  tariffaOraria: number;
  /** Tariffa oraria agevolata per lezioni individuali (€/ora) */
  tariffaLezione?: number;
  /** Numero massimo di persone ospitabili contemporaneamente */
  capienza: number;
  /** Elenco degli strumenti e backline forniti in dotazione */
  dotazione: string[];
  /** Stato della sala: 'disponibile' per prenotazioni o in 'manutenzione' */
  stato: 'disponibile' | 'manutenzione';
}

/** Tipo di evento prenotato: prova musicale o lezione di strumento */
export type BookingType = 'prove' | 'lezione';
/** Stato di pagamento della prenotazione */
export type PaymentStatus = 'pagato' | 'da_saldare';
/** Metodo di pagamento utilizzato dal cliente */
export type PaymentMethod = 'contanti' | 'pos' | 'bonifico';

/**
 * Singola prenotazione registrata a calendario.
 */
export interface Booking {
  /** ID univoco della prenotazione */
  id: string;
  /** ID del cliente prenotante */
  clienteId: string;
  /** Nome o intestazione band del cliente */
  clienteNome: string;
  /** ID della sala prenotata */
  salaId: string;
  /** Nome della sala prenotata */
  salaNome: string;
  /** Tipologia di sessione ('prove' o 'lezione') */
  tipo: BookingType;
  /** ID insegnante se sessione didattica */
  insegnanteId?: string;
  /** Nome insegnante se sessione didattica */
  insegnanteNome?: string;
  /** Data della prenotazione (YYYY-MM-DD) */
  data: string;
  /** Ora di inizio (HH:mm) */
  oraInizio: string;
  /** Ora di fine (HH:mm) */
  oraFine: string;
  /** Durata totale in ore calcolata in automatico */
  durataOre: number;
  /** Flag se la prenotazione è ricorrente ogni settimana */
  ripetizioneSettimanale: boolean;
  /** ID del gruppo di ricorrenza se generata in serie */
  gruppoRicorrenzaId?: string;
  /** Numero di settimane di ripetizione pianificate */
  settimaneRipetizione?: number;
  /** Configurazione estesa della ricorrenza (giorni, fine serie) */
  recurrenceConfig?: RecurrenceConfig;
  /** ID dell'operatore incaricato del presidio */
  operatoreAssegnatoId?: string;
  /** Nome dell'operatore incaricato del presidio */
  operatoreAssegnatoNome?: string;
  /** Importo totale dovuto per la sessione in Euro (€) */
  tariffaTotale: number;
  /** Eventuale sconto applicato (€) */
  sconto?: number;
  /** Stato del pagamento ('pagato' o 'da_saldare') */
  statoPagamento: PaymentStatus;
  /** Metodo di pagamento ('contanti', 'pos', 'bonifico') */
  metodoPagamento?: PaymentMethod;
  /** Eventuali richieste particolari di strumentazione (es. set piatti extra) */
  richiesteStrumentazione?: string;
  /** Note operative interne */
}

/**
 * Modalità di eliminazione per eventi con ripetizione:
 * - 'single': Elimina solo l'evento selezionato per quel giorno specifico
 * - 'future': Elimina l'evento selezionato e tutte le repliche future successive della serie
 * - 'all': Elimina l'intera serie (passati e futuri)
 */
export type DeleteRecurringMode = 'single' | 'future' | 'all';

/** Frequenza della ricorrenza */
export type RecurrenceFrequency = 'nessuna' | 'giornaliera' | 'settimanale' | 'mensile';
/** Condizione di arresto della ricorrenza */
export type RecurrenceEndType = 'fino_al' | 'conteggio' | 'per_sempre';

/**
 * Configurazione avanzata per generare eventi ricorrenti multipli.
 */
export interface RecurrenceConfig {
  /** Se la ricorrenza è attiva */
  attiva: boolean;
  /** Frequenza di ripetizione */
  frequenza: RecurrenceFrequency;
  /** Intervallo di salto (es. ogni 1 settimana, ogni 2 settimane) */
  intervallo: number;
  /** Giorni della settimana selezionati (0 = Dom, 1 = Lun, ecc.) */
  giorniSettimana: number[];
  /** Tipologia di termine serie ('fino_al', 'conteggio', 'per_sempre') */
  tipoFine: RecurrenceEndType;
  /** Data finale della serie se impostata */
  dataFine?: string;
  /** Numero totale di eventi da generare */
  conteggioOccorrenze?: number;
}

/** Categorie di spesa della gestione finanziaria dello studio */
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

/**
 * Voce di spesa o uscita economica registrata nel conto mensile.
 */
export interface Expense {
  /** ID univoco della spesa */
  id: string;
  /** Data di registrazione/competenza della spesa (YYYY-MM-DD) */
  data: string;
  /** Categoria di bilancio (es. 'energia', 'affitto', 'attrezzatura') */
  categoria: ExpenseCategory;
  /** Descrizione dettagliata della spesa */
  descrizione: string;
  /** Importo economico in Euro (€) */
  importo: number;
  /** Metodo con cui è stato eseguito il pagamento */
  metodoPagamento: 'bonifico' | 'pos' | 'contanti' | 'addebito_diretto';
  /** Nome fornitore o beneficiario */
  fornitore?: string;
  /** Numero di fattura o scontrino di riferimento */
  numeroFatturaRicevuta?: string;
  /** Stato: saldato o in scadenza */
  stato: 'pagato' | 'in_scadenza';
  /** Note contabili */
  note?: string;
}

/**
 * Entrata economica registrata manualmente o extracontrattuale.
 */
export interface ManualIncome {
  /** ID univoco dell'entrata */
  id: string;
  /** Data di incasso (YYYY-MM-DD) */
  data: string;
  /** Categoria dell'entrata */
  categoria: 'tesseramento' | 'prove' | 'lezioni' | 'vendita_accessori' | 'altro';
  /** Descrizione dell'entrata */
  descrizione: string;
  /** Importo economico in Euro (€) */
  importo: number;
  /** ID del cliente versante, se associato */
  clienteId?: string;
  /** Metodo con cui è stato ricevuto l'incasso */
  metodoPagamento?: PaymentMethod;
}
