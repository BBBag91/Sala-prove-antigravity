import { supabase } from '../lib/supabase';
import { Booking, Client, Expense, ManualIncome, PrimaryWorkShift, PrimaryWorkShiftDate, Room, StaffMember, StudioInfo, WorkShift } from '../types';

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

// Flag per ricordare se la colonna 'indisponibilita_date' esiste nella tabella 'staff' di Supabase
let hasStaffIndisponibilitaColumn: boolean | null = null;

export const mapStaffToDb = (s: StaffMember, includeIndisponibilitaCol: boolean = true) => {
  // Prepariamo i turni di lavoro primario
  const turniLavoroPrimarioDb: any[] = Array.isArray(s.turniLavoroPrimario) ? [...s.turniLavoroPrimario] : [];

  // Se ci sono date di indisponibilità/eccezioni mensili, le codifichiamo come metadato di sicurezza
  // all'interno di turni_lavoro_primario (colonna JSONB garantita nel DB). In questo modo,
  // anche se la colonna dedicata 'indisponibilita_date' non dovesse esistere nel DB remoto,
  // i dati NON andranno mai persi!
  if (s.indisponibilitaDate && s.indisponibilitaDate.length > 0) {
    turniLavoroPrimarioDb.push({
      id: '__META_INDISPONIBILITA_DATE__',
      giornoSettimana: -1,
      oraInizio: '',
      oraFine: '',
      descrizione: JSON.stringify(s.indisponibilitaDate),
    });
  }

  const result: any = {
    id: s.id,
    nome: s.nome,
    cognome: s.cognome,
    ruolo: s.ruolo,
    email: s.email || '',
    telefono: s.telefono || '',
    materie_insegnamento: s.materieInsegnamento || '',
    turni_lavoro_primario: turniLavoroPrimarioDb,
    colore_badge: s.coloreBadge || '#eab308',
    attivo: s.attivo ?? true,
    tariffa_oraria_rimborso: s.tariffaOrariaRimborso != null ? s.tariffaOrariaRimborso : null,
    note: s.note || '',
    updated_at: new Date().toISOString(),
  };

  if (typeof includeIndisponibilitaCol === 'boolean' ? includeIndisponibilitaCol : true) {
    result.indisponibilita_date = s.indisponibilitaDate || [];
  }

  return result;
};

export const mapStaffFromDb = (s: any): StaffMember => {
  const turniLavoroPrimario: PrimaryWorkShift[] = [];
  let metaIndisponibilita: PrimaryWorkShiftDate[] = [];

  if (Array.isArray(s.turni_lavoro_primario)) {
    for (const item of s.turni_lavoro_primario) {
      if (item && item.id === '__META_INDISPONIBILITA_DATE__') {
        try {
          if (item.descrizione) {
            const parsed = JSON.parse(item.descrizione);
            if (Array.isArray(parsed)) {
              metaIndisponibilita = parsed;
            }
          }
        } catch (e) {
          console.warn('[mapStaffFromDb] Errore parsing meta indisponibilità:', e);
        }
      } else {
        turniLavoroPrimario.push(item);
      }
    }
  }

  let indisponibilitaDate: PrimaryWorkShiftDate[] = [];
  if (Array.isArray(s.indisponibilita_date) && s.indisponibilita_date.length > 0) {
    indisponibilitaDate = s.indisponibilita_date;
  } else if (metaIndisponibilita.length > 0) {
    indisponibilitaDate = metaIndisponibilita;
  }

  return {
    id: s.id,
    nome: s.nome,
    cognome: s.cognome,
    ruolo: s.ruolo,
    email: s.email || '',
    telefono: s.telefono || '',
    materieInsegnamento: s.materie_insegnamento || '',
    turniLavoroPrimario,
    indisponibilitaDate,
    coloreBadge: s.colore_badge || '#eab308',
    attivo: Boolean(s.attivo),
    tariffaOrariaRimborso: s.tariffa_oraria_rimborso ? Number(s.tariffa_oraria_rimborso) : undefined,
    note: s.note || '',
  };
};

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

export const mapStudioInfoToDb = (s: StudioInfo, includeWaConfigCol: boolean = true) => {
  let noteWithConfig = s.note || '';
  if (s.whatsappConfig) {
    const cleanBaseNote = (s.note || '').replace(/__WA_CFG__:[\s\S]*?__END_WA_CFG__/g, '').trim();
    const encodedWa = `__WA_CFG__:${JSON.stringify(s.whatsappConfig)}__END_WA_CFG__`;
    noteWithConfig = cleanBaseNote ? `${cleanBaseNote}\n${encodedWa}` : encodedWa;
  }
  const result: any = {
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
    note: noteWithConfig,
    updated_at: new Date().toISOString(),
  };
  if (includeWaConfigCol) {
    result.whatsapp_config = s.whatsappConfig || null;
  }
  return result;
};

export const mapStudioInfoFromDb = (s: any): StudioInfo => {
  let waConfig = s.whatsapp_config || undefined;
  let cleanNote = s.note || '';
  if (!waConfig && cleanNote.includes('__WA_CFG__:')) {
    try {
      const match = cleanNote.match(/__WA_CFG__:([\s\S]*?)__END_WA_CFG__/);
      if (match && match[1]) {
        waConfig = JSON.parse(match[1]);
      }
    } catch (e) {
      console.warn('[mapStudioInfoFromDb] Errore parsing fallback whatsapp_config da note:', e);
    }
  }
  cleanNote = cleanNote.replace(/__WA_CFG__:[\s\S]*?__END_WA_CFG__/g, '').trim();

  return {
    nome: s.nome || 'Sala Prove Antigravity',
    sottotitolo: s.sottotitolo || '',
    indirizzo: s.indirizzo || '',
    telefono: s.telefono || '',
    email: s.email || '',
    citta: s.citta || '',
    cap: s.cap || '',
    codiceFiscalePiva: s.codice_fiscale_piva || '',
    sitoWeb: s.sito_web || '',
    note: cleanNote,
    whatsappConfig: waConfig,
  };
};

export const mapShiftToDb = (s: WorkShift) => ({
  id: s.id,
  data: s.data,
  turno_numero: s.turnoNumero,
  nome_turno: s.nomeTurno,
  ora_inizio_base: s.oraInizioBase,
  ora_fine_base: s.oraFineBase,
  ora_inizio_effettiva: s.oraInizioEffettiva || null,
  ora_fine_effettiva: s.oraFineEffettiva || null,
  operatore_id: s.operatoreId || '',
  operatore_nome: s.operatoreNome || '',
  note: s.note || '',
  is_custom_hours: Boolean(s.isCustomHours),
  updated_at: new Date().toISOString(),
});

export const mapShiftFromDb = (s: any): WorkShift => ({
  id: s.id,
  data: s.data,
  turnoNumero: (Number(s.turno_numero) || 1) as 1 | 2,
  nomeTurno: s.nome_turno || (s.turno_numero === 1 ? '1° Turno (Pomeridiano)' : '2° Turno (Serale)'),
  oraInizioBase: s.ora_inizio_base || (s.turno_numero === 1 ? '17:00' : '20:00'),
  oraFineBase: s.ora_fine_base || (s.turno_numero === 1 ? '20:00' : '23:00'),
  oraInizioEffettiva: s.ora_inizio_effettiva || undefined,
  oraFineEffettiva: s.ora_fine_effettiva || undefined,
  operatoreId: s.operatore_id || undefined,
  operatoreNome: s.operatore_nome || undefined,
  note: s.note || '',
  isCustomHours: Boolean(s.is_custom_hours),
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
      shiftsRes,
    ] = await Promise.all([
      supabase.from('rooms').select('*').order('nome'),
      supabase.from('staff').select('*').order('cognome'),
      supabase.from('clients').select('*').order('cognome'),
      supabase.from('bookings').select('*').order('data', { ascending: true }),
      supabase.from('expenses').select('*').order('data', { ascending: false }),
      supabase.from('incomes').select('*').order('data', { ascending: false }),
      supabase.from('studio_info').select('*').limit(1).maybeSingle(),
      supabase.from('shifts').select('*').order('data', { ascending: true }),
    ]);

    return {
      rooms: (roomsRes.data || []).map(mapRoomFromDb),
      staff: (staffRes.data || []).map(mapStaffFromDb),
      clients: (clientsRes.data || []).map(mapClientFromDb),
      bookings: (bookingsRes.data || []).map(mapBookingFromDb),
      expenses: (expensesRes.data || []).map(mapExpenseFromDb),
      incomes: (incomesRes.data || []).map(mapIncomeFromDb),
      studioInfo: studioRes.data ? mapStudioInfoFromDb(studioRes.data) : null,
      shifts: (shiftsRes.data || []).map(mapShiftFromDb),
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
    if (!supabase) return { error: null };

    // Prova prima con la colonna se non sappiamo ancora che manca
    if (hasStaffIndisponibilitaColumn !== false) {
      const payload = mapStaffToDb(member, true);
      const { data, error } = await supabase.from('staff').upsert(payload);
      if (!error) {
        hasStaffIndisponibilitaColumn = true;
        return { data, error: null };
      }
      if (error.code === 'PGRST204' || error.message?.includes('indisponibilita_date')) {
        hasStaffIndisponibilitaColumn = false;
        console.warn('[Supabase] Colonna staff.indisponibilita_date non trovata nel DB remoto. Attivato fallback trasparente.');
      } else {
        console.error('[Supabase] Errore upsertStaff:', error);
        return { error };
      }
    }

    // Fallback: senza colonna indisponibilita_date (i dati rimangono comunque salvi dentro turni_lavoro_primario)
    const fallbackPayload = mapStaffToDb(member, false);
    const { data, error: fallbackError } = await supabase.from('staff').upsert(fallbackPayload);
    if (fallbackError) {
      console.error('[Supabase] Errore upsertStaff fallback:', fallbackError);
      return { error: fallbackError };
    }
    return { data, error: null };
  },
  async deleteStaff(id: string) {
    if (!supabase) return { error: null };
    const { error } = await supabase.from('staff').delete().eq('id', id);
    if (error) console.error('[Supabase] Errore deleteStaff:', error);
    return { error };
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

  // Shifts (Turni Presidio Sala)
  async upsertShift(shift: WorkShift) {
    if (!supabase) return;
    try {
      const { error } = await supabase.from('shifts').upsert(mapShiftToDb(shift));
      if (error) console.warn('[Supabase] upsertShift:', error.message);
    } catch (e) {
      console.warn('[Supabase] upsertShift error:', e);
    }
  },
  async upsertMultipleShifts(shifts: WorkShift[]) {
    if (!supabase || shifts.length === 0) return;
    try {
      const rows = shifts.map(mapShiftToDb);
      const { error } = await supabase.from('shifts').upsert(rows);
      if (error) console.warn('[Supabase] upsertMultipleShifts:', error.message);
    } catch (e) {
      console.warn('[Supabase] upsertMultipleShifts error:', e);
    }
  },
  async deleteShift(id: string) {
    if (!supabase) return;
    try {
      const { error } = await supabase.from('shifts').delete().eq('id', id);
      if (error) console.warn('[Supabase] deleteShift:', error.message);
    } catch (e) {
      console.warn('[Supabase] deleteShift error:', e);
    }
  },

  // Studio Info
  async upsertStudioInfo(info: StudioInfo) {
    if (!supabase) return;
    const dbObj = mapStudioInfoToDb(info, true);
    const { error } = await supabase.from('studio_info').upsert(dbObj);
    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('whatsapp_config')) {
        const fallbackObj = mapStudioInfoToDb(info, false);
        const { error: err2 } = await supabase.from('studio_info').upsert(fallbackObj);
        if (err2) console.error('[Supabase] Errore fallback upsertStudioInfo:', err2);
      } else {
        console.error('[Supabase] Errore upsertStudioInfo:', error);
      }
    }
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
    shifts?: WorkShift[];
  }) {
    if (!supabase) throw new Error('Client Supabase non configurato');

    const [
      studioRes,
      roomsRes,
      staffRes,
      clientsRes,
      bookingsRes,
      expensesRes,
      incomesRes,
      shiftsRes,
    ] = await Promise.all([
      (async () => {
        let res = await supabase.from('studio_info').upsert(mapStudioInfoToDb(data.studioInfo, true));
        if (res.error && (res.error.code === 'PGRST204' || res.error.message?.includes('whatsapp_config'))) {
          res = await supabase.from('studio_info').upsert(mapStudioInfoToDb(data.studioInfo, false));
        }
        return res;
      })(),
      supabase.from('rooms').upsert(data.rooms.map(mapRoomToDb)),
      (async () => {
        if (hasStaffIndisponibilitaColumn !== false) {
          const res = await supabase.from('staff').upsert(data.staff.map((s) => mapStaffToDb(s, true)));
          if (!res.error) {
            hasStaffIndisponibilitaColumn = true;
            return res;
          }
          if (res.error.code === 'PGRST204' || res.error.message?.includes('indisponibilita_date')) {
            hasStaffIndisponibilitaColumn = false;
          } else {
            return res;
          }
        }
        return supabase.from('staff').upsert(data.staff.map((s) => mapStaffToDb(s, false)));
      })(),
      supabase.from('clients').upsert(data.clients.map(mapClientToDb)),
      data.bookings.length > 0 ? supabase.from('bookings').upsert(data.bookings.map(mapBookingToDb)) : Promise.resolve({ error: null }),
      data.expenses.length > 0 ? supabase.from('expenses').upsert(data.expenses.map(mapExpenseToDb)) : Promise.resolve({ error: null }),
      data.incomes.length > 0 ? supabase.from('incomes').upsert(data.incomes.map(mapIncomeToDb)) : Promise.resolve({ error: null }),
      data.shifts && data.shifts.length > 0 ? Promise.resolve(supabase.from('shifts').upsert(data.shifts.map(mapShiftToDb))) : Promise.resolve({ error: null }),
    ]);

    const errors: string[] = [];
    if (studioRes.error) errors.push(`studio_info: ${studioRes.error.message}`);
    if (roomsRes.error) errors.push(`rooms: ${roomsRes.error.message}`);
    if (staffRes.error) errors.push(`staff: ${staffRes.error.message}`);
    if (clientsRes.error) errors.push(`clients: ${clientsRes.error.message}`);
    if (bookingsRes.error) errors.push(`bookings: ${bookingsRes.error.message}`);
    if (expensesRes.error) errors.push(`expenses: ${expensesRes.error.message}`);
    if (incomesRes.error) errors.push(`incomes: ${incomesRes.error.message}`);
    if ((shiftsRes as any)?.error && (shiftsRes as any)?.error?.code !== 'PGRST205') {
      errors.push(`shifts: ${(shiftsRes as any).error.message}`);
    }

    if (errors.length > 0) {
      throw new Error(`Si sono verificati errori durante il caricamento: ${errors.join('; ')}`);
    }

    return true;
  },
};
