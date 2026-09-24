import { supabase } from '../lib/supabase';
import { Booking, Client, Expense, ManualIncome, Room, StaffMember, StudioInfo } from '../types';

// =========================================================================
// MAPPERS: TypeScript (camelCase) <-> Supabase PostgreSQL (snake_case)
// =========================================================================

export const mapRoomToDb = (r: Room) => ({
  id: r.id,
  nome: r.nome,
  descrizione: r.descrizione || '',
  colore: r.colore || '#eab308',
  tariffa_oraria: r.tariffaOraria,
  tariffa_lezione: r.tariffaLezione || null,
  capienza: r.capienza,
  dotazione: r.dotazione || [],
  stato: r.stato || 'disponibile',
  updated_at: new Date().toISOString(),
});

export const mapRoomFromDb = (r: any): Room => ({
  id: r.id,
  nome: r.nome,
  descrizione: r.descrizione || '',
  colore: r.colore || '#eab308',
  tariffaOraria: Number(r.tariffa_oraria),
  tariffaLezione: r.tariffa_lezione ? Number(r.tariffa_lezione) : undefined,
  capienza: Number(r.capienza),
  dotazione: Array.isArray(r.dotazione) ? r.dotazione : [],
  stato: r.stato || 'disponibile',
});

export const mapStaffToDb = (s: StaffMember) => ({
  id: s.id,
  nome: s.nome,
  cognome: s.cognome,
  ruolo: s.ruolo,
  email: s.email || '',
  telefono: s.telefono || '',
  materie_insegnamento: s.materieInsegnamento || '',
  turni_lavoro_primario: s.turniLavoroPrimario || [],
  colore_badge: s.coloreBadge || '#eab308',
  attivo: s.attivo ?? true,
  tariffa_oraria_rimborso: s.tariffaOrariaRimborso || null,
  note: s.note || '',
  updated_at: new Date().toISOString(),
});

export const mapStaffFromDb = (s: any): StaffMember => ({
  id: s.id,
  nome: s.nome,
  cognome: s.cognome,
  ruolo: s.ruolo,
  email: s.email || '',
  telefono: s.telefono || '',
  materieInsegnamento: s.materie_insegnamento || '',
  turniLavoroPrimario: Array.isArray(s.turni_lavoro_primario) ? s.turni_lavoro_primario : [],
  coloreBadge: s.colore_badge || '#eab308',
  attivo: Boolean(s.attivo),
  tariffaOrariaRimborso: s.tariffa_oraria_rimborso ? Number(s.tariffa_oraria_rimborso) : undefined,
  note: s.note || '',
});

export const mapClientToDb = (c: Client) => ({
  id: c.id,
  nome: c.nome,
  cognome: c.cognome,
  codice_fiscale: c.codiceFiscale || '',
  residenza: c.residenza || '',
  sesso: c.sesso || 'M',
  data_nascita: c.dataNascita || '',
  luogo_nascita: c.luogoNascita || '',
  telefono: c.telefono || '',
  email: c.email || '',
  stato_tesseramento: c.statoTesseramento || 'attivo',
  numero_tessera: c.numeroTessera || '',
  data_tesseramento: c.dataTesseramento || '',
  data_scadenza_tesseramento: c.dataScadenzaTesseramento || '',
  quota_tesseramento: c.quotaTesseramento || 15,
  descrizione_strumentazione: c.descrizioneStrumentazione || '',
  gruppo_band: c.gruppoBand || '',
  note: c.note || '',
  updated_at: new Date().toISOString(),
});

export const mapClientFromDb = (c: any): Client => ({
  id: c.id,
  nome: c.nome,
  cognome: c.cognome,
  codiceFiscale: c.codice_fiscale || '',
  residenza: c.residenza || '',
  sesso: c.sesso || 'M',
  dataNascita: c.data_nascita || '',
  luogoNascita: c.luogo_nascita || '',
  telefono: c.telefono || '',
  email: c.email || '',
  statoTesseramento: c.stato_tesseramento || 'attivo',
  numeroTessera: c.numero_tessera || '',
  dataTesseramento: c.data_tesseramento || '',
  dataScadenzaTesseramento: c.data_scadenza_tesseramento || '',
  quotaTesseramento: Number(c.quota_tesseramento || 15),
  descrizioneStrumentazione: c.descrizione_strumentazione || '',
  gruppoBand: c.gruppo_band || '',
  note: c.note || '',
});

export const mapBookingToDb = (b: Booking) => ({
  id: b.id,
  cliente_id: b.clienteId,
  cliente_nome: b.clienteNome,
  sala_id: b.salaId,
  sala_nome: b.salaNome,
  tipo: b.tipo,
  insegnante_id: b.insegnanteId || '',
  insegnante_nome: b.insegnanteNome || '',
  data: b.data,
  ora_inizio: b.oraInizio,
  ora_fine: b.oraFine,
  durata_ore: b.durataOre,
  ripetizione_settimanale: b.ripetizioneSettimanale ?? false,
  gruppo_ricorrenza_id: b.gruppoRicorrenzaId || '',
  settimane_ripetizione: b.settimaneRipetizione || 4,
  recurrence_config: b.recurrenceConfig || null,
  operatore_assegnato_id: b.operatoreAssegnatoId || '',
  operatore_assegnato_nome: b.operatoreAssegnatoNome || '',
  tariffa_totale: b.tariffaTotale,
  sconto: b.sconto || 0,
  stato_pagamento: b.statoPagamento,
  metodo_pagamento: b.metodoPagamento || null,
  richieste_strumentazione: b.richiesteStrumentazione || '',
  note: b.note || '',
  updated_at: new Date().toISOString(),
});

export const mapBookingFromDb = (b: any): Booking => ({
  id: b.id,
  clienteId: b.cliente_id,
  clienteNome: b.cliente_nome,
  salaId: b.sala_id,
  salaNome: b.sala_nome,
  tipo: b.tipo,
  insegnanteId: b.insegnante_id || undefined,
  insegnanteNome: b.insegnante_nome || undefined,
  data: b.data,
  oraInizio: b.ora_inizio,
  oraFine: b.ora_fine,
  durataOre: Number(b.durata_ore),
  ripetizioneSettimanale: Boolean(b.ripetizione_settimanale),
  gruppoRicorrenzaId: b.gruppo_ricorrenza_id || undefined,
  settimaneRipetizione: b.settimane_ripetizione ? Number(b.settimane_ripetizione) : undefined,
  recurrenceConfig: b.recurrence_config || undefined,
  operatoreAssegnatoId: b.operatore_assegnato_id || undefined,
  operatoreAssegnatoNome: b.operatore_assegnato_nome || undefined,
  tariffaTotale: Number(b.tariffa_totale),
  sconto: b.sconto ? Number(b.sconto) : 0,
  statoPagamento: b.stato_pagamento,
  metodoPagamento: b.metodo_pagamento || undefined,
  richiesteStrumentazione: b.richieste_strumentazione || '',
  note: b.note || '',
});

export const mapExpenseToDb = (e: Expense) => ({
  id: e.id,
  data: e.data,
  categoria: e.categoria,
  descrizione: e.descrizione,
  importo: e.importo,
  metodo_pagamento: e.metodoPagamento,
  fornitore: e.fornitore || '',
  numero_fattura_ricevuta: e.numeroFatturaRicevuta || '',
  stato: e.stato,
  note: e.note || '',
  updated_at: new Date().toISOString(),
});

export const mapExpenseFromDb = (e: any): Expense => ({
  id: e.id,
  data: e.data,
  categoria: e.categoria,
  descrizione: e.descrizione,
  importo: Number(e.importo),
  metodoPagamento: e.metodo_pagamento,
  fornitore: e.fornitore || '',
  numeroFatturaRicevuta: e.numero_fattura_ricevuta || '',
  stato: e.stato,
  note: e.note || '',
});

export const mapIncomeToDb = (i: ManualIncome) => ({
  id: i.id,
  data: i.data,
  categoria: i.categoria,
  descrizione: i.descrizione,
  importo: i.importo,
  cliente_id: i.clienteId || '',
  metodo_pagamento: i.metodoPagamento || null,
  updated_at: new Date().toISOString(),
});

export const mapIncomeFromDb = (i: any): ManualIncome => ({
  id: i.id,
  data: i.data,
  categoria: i.categoria,
  descrizione: i.descrizione,
  importo: Number(i.importo),
  clienteId: i.cliente_id || undefined,
  metodoPagamento: i.metodo_pagamento || undefined,
});

export const mapStudioInfoToDb = (s: StudioInfo) => ({
  id: 'main',
  nome: s.nome,
  sottotitolo: s.sottotitolo || '',
  indirizzo: s.indirizzo || '',
  telefono: s.telefono || '',
  email: s.email || '',
  citta: s.citta || '',
  cap: s.cap || '',
  codice_fiscale_piva: s.codiceFiscalePiva || '',
  sito_web: s.sitoWeb || '',
  note: s.note || '',
  updated_at: new Date().toISOString(),
});

export const mapStudioInfoFromDb = (s: any): StudioInfo => ({
  nome: s.nome || 'Sala Prove Antigravity',
  sottotitolo: s.sottotitolo || '',
  indirizzo: s.indirizzo || '',
  telefono: s.telefono || '',
  email: s.email || '',
  citta: s.citta || '',
  cap: s.cap || '',
  codiceFiscalePiva: s.codice_fiscale_piva || '',
  sitoWeb: s.sito_web || '',
  note: s.note || '',
});

// =========================================================================
// OPERAZIONI DATABASE CON SUPABASE
// =========================================================================

export const supabaseService = {
  // Test rapido connessione
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (!supabase) {
      return { ok: false, message: 'Client Supabase non configurato' };
    }
    try {
      const { error } = await supabase.from('rooms').select('id').limit(1);
      if (error) throw error;
      return { ok: true, message: 'Connessione a Supabase riuscita!' };
    } catch (err: any) {
      return { ok: false, message: err.message || 'Errore di connessione a Supabase' };
    }
  },

  // Caricamento complessivo iniziale
  async fetchAll() {
    if (!supabase) return null;

    const [
      roomsRes,
      staffRes,
      clientsRes,
      bookingsRes,
      expensesRes,
      incomesRes,
      studioRes,
    ] = await Promise.all([
      supabase.from('rooms').select('*').order('nome'),
      supabase.from('staff').select('*').order('cognome'),
      supabase.from('clients').select('*').order('cognome'),
      supabase.from('bookings').select('*').order('data', { ascending: true }),
      supabase.from('expenses').select('*').order('data', { ascending: false }),
      supabase.from('incomes').select('*').order('data', { ascending: false }),
      supabase.from('studio_info').select('*').limit(1).maybeSingle(),
    ]);

    return {
      rooms: (roomsRes.data || []).map(mapRoomFromDb),
      staff: (staffRes.data || []).map(mapStaffFromDb),
      clients: (clientsRes.data || []).map(mapClientFromDb),
      bookings: (bookingsRes.data || []).map(mapBookingFromDb),
      expenses: (expensesRes.data || []).map(mapExpenseFromDb),
      incomes: (incomesRes.data || []).map(mapIncomeFromDb),
      studioInfo: studioRes.data ? mapStudioInfoFromDb(studioRes.data) : null,
    };
  },

  // Rooms
  async upsertRoom(room: Room) {
    if (!supabase) return;
    const { error } = await supabase.from('rooms').upsert(mapRoomToDb(room));
    if (error) console.error('[Supabase] Errore upsertRoom:', error);
  },
  async deleteRoom(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from('rooms').delete().eq('id', id);
    if (error) console.error('[Supabase] Errore deleteRoom:', error);
  },

  // Staff
  async upsertStaff(member: StaffMember) {
    if (!supabase) return;
    const { error } = await supabase.from('staff').upsert(mapStaffToDb(member));
    if (error) console.error('[Supabase] Errore upsertStaff:', error);
  },
  async deleteStaff(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from('staff').delete().eq('id', id);
    if (error) console.error('[Supabase] Errore deleteStaff:', error);
  },

  // Clients
  async upsertClient(client: Client) {
    if (!supabase) return;
    const { error } = await supabase.from('clients').upsert(mapClientToDb(client));
    if (error) console.error('[Supabase] Errore upsertClient:', error);
  },
  async deleteClient(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) console.error('[Supabase] Errore deleteClient:', error);
  },

  // Bookings
  async upsertBooking(booking: Booking) {
    if (!supabase) return;
    const { error } = await supabase.from('bookings').upsert(mapBookingToDb(booking));
    if (error) console.error('[Supabase] Errore upsertBooking:', error);
  },
  async upsertMultipleBookings(bookings: Booking[]) {
    if (!supabase || bookings.length === 0) return;
    const rows = bookings.map(mapBookingToDb);
    const { error } = await supabase.from('bookings').upsert(rows);
    if (error) console.error('[Supabase] Errore upsertMultipleBookings:', error);
  },
  async deleteBooking(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from('bookings').delete().eq('id', id);
    if (error) console.error('[Supabase] Errore deleteBooking:', error);
  },
  async deleteBookingsByGroup(groupId: string) {
    if (!supabase) return;
    const { error } = await supabase.from('bookings').delete().eq('gruppo_ricorrenza_id', groupId);
    if (error) console.error('[Supabase] Errore deleteBookingsByGroup:', error);
  },

  // Expenses
  async upsertExpense(expense: Expense) {
    if (!supabase) return;
    const { error } = await supabase.from('expenses').upsert(mapExpenseToDb(expense));
    if (error) console.error('[Supabase] Errore upsertExpense:', error);
  },
  async deleteExpense(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) console.error('[Supabase] Errore deleteExpense:', error);
  },

  // Incomes
  async upsertIncome(income: ManualIncome) {
    if (!supabase) return;
    const { error } = await supabase.from('incomes').upsert(mapIncomeToDb(income));
    if (error) console.error('[Supabase] Errore upsertIncome:', error);
  },
  async deleteIncome(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from('incomes').delete().eq('id', id);
    if (error) console.error('[Supabase] Errore deleteIncome:', error);
  },

  // Studio Info
  async upsertStudioInfo(info: StudioInfo) {
    if (!supabase) return;
    const { error } = await supabase.from('studio_info').upsert(mapStudioInfoToDb(info));
    if (error) console.error('[Supabase] Errore upsertStudioInfo:', error);
  },

  // Caricamento / Sincronizzazione massiva iniziale (Local -> Supabase)
  async syncAllLocalDataToSupabase(data: {
    rooms: Room[];
    staff: StaffMember[];
    clients: Client[];
    bookings: Booking[];
    expenses: Expense[];
    incomes: ManualIncome[];
    studioInfo: StudioInfo;
  }) {
    if (!supabase) throw new Error('Client Supabase non configurato');

    const results = await Promise.allSettled([
      supabase.from('studio_info').upsert(mapStudioInfoToDb(data.studioInfo)),
      supabase.from('rooms').upsert(data.rooms.map(mapRoomToDb)),
      supabase.from('staff').upsert(data.staff.map(mapStaffToDb)),
      supabase.from('clients').upsert(data.clients.map(mapClientToDb)),
      supabase.from('bookings').upsert(data.bookings.map(mapBookingToDb)),
      supabase.from('expenses').upsert(data.expenses.map(mapExpenseToDb)),
      supabase.from('incomes').upsert(data.incomes.map(mapIncomeToDb)),
    ]);

    const errors = results.filter((r) => r.status === 'rejected');
    if (errors.length > 0) {
      throw new Error(`Si sono verificati ${errors.length} errori durante il caricamento.`);
    }

    return true;
  },
};
