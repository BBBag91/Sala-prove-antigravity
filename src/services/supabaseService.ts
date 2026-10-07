import { supabase } from '../lib/supabase';
import { Booking, Client, Expense, ManualIncome, PrimaryWorkShift, PrimaryWorkShiftDate, Room, StaffMember, StudioInfo, WorkShift, isLessonBooking } from '../types';

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

  let nome = s.nome;
  let cognome = s.cognome;
  let email = s.email || '';
  if (
    s.id === 'staff-1' ||
    (nome?.toLowerCase() === 'marco' && cognome?.toLowerCase() === 'bellini') ||
    email.toLowerCase().includes('marco.bellini')
  ) {
    nome = 'Gabriele';
    cognome = 'Piva';
    email = 'gabriele.piva@salaprove.it';
  }

  return {
    id: s.id,
    nome,
    cognome,
    ruolo: s.ruolo,
    email,
    telefono: s.telefono || '',
    materieInsegnamento: s.materie_insegnamento || '',
    turniLavoroPrimario,
    indisponibilitaDate,
    coloreBadge: s.colore_badge || '#f59e0b',
    attivo: Boolean(s.attivo),
    tariffaOrariaRimborso: s.tariffa_oraria_rimborso ? Number(s.tariffa_oraria_rimborso) : undefined,
    note: s.note || '',
  };
};

// Flag per ricordare se le colonne 'quota_pagata' / 'stato_quota' esistono nella tabella 'clients' di Supabase
let hasClientQuotaColumn: boolean | null = null;

export const mapClientToDb = (c: Client, includeQuotaCol?: boolean) => {
  const isPaid = c.quotaPagata !== undefined ? c.quotaPagata : (c.statoQuota !== 'da_saldare');
  let cleanNote = c.note || '';
  cleanNote = cleanNote.replace(/\[QUOTA_PAGAMENTO:(pagato|da_saldare)\]\s*/g, '').trim();
  const noteWithMeta = `${cleanNote ? cleanNote + ' ' : ''}[QUOTA_PAGAMENTO:${isPaid ? 'pagato' : 'da_saldare'}]`.trim();

  const result: any = {
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
    quota_tesseramento: c.quotaTesseramento || 10,
    descrizione_strumentazione: c.descrizioneStrumentazione || '',
    gruppo_band: c.gruppoBand || '',
    note: noteWithMeta,
    updated_at: new Date().toISOString(),
  };

  if (includeQuotaCol !== false) {
    result.quota_pagata = isPaid;
    result.stato_quota = isPaid ? 'pagato' : 'da_saldare';
  }

  return result;
};

export const mapClientFromDb = (c: any): Client => {
  let isQuotaPagata = true;
  const rawNote = c.note || '';
  if (rawNote.includes('[QUOTA_PAGAMENTO:da_saldare]')) {
    isQuotaPagata = false;
  } else if (rawNote.includes('[QUOTA_PAGAMENTO:pagato]')) {
    isQuotaPagata = true;
  } else if (c.quota_pagata !== undefined && c.quota_pagata !== null) {
    isQuotaPagata = Boolean(c.quota_pagata);
  } else if (c.stato_quota) {
    isQuotaPagata = c.stato_quota === 'pagato';
  }

  const displayNote = rawNote.replace(/\[QUOTA_PAGAMENTO:(pagato|da_saldare)\]\s*/g, '').trim();

  return {
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
    quotaTesseramento: Number(c.quota_tesseramento || 10),
    statoQuota: isQuotaPagata ? 'pagato' : 'da_saldare',
    quotaPagata: isQuotaPagata,
    descrizioneStrumentazione: c.descrizione_strumentazione || '',
    gruppoBand: c.gruppo_band || '',
    note: displayNote,
  };
};

export const mapBookingToDb = (b: Booking) => {
  const isLesson = isLessonBooking(b);
  return {
    id: b.id,
    cliente_id: b.clienteId,
    cliente_nome: b.clienteNome,
    sala_id: b.salaId,
    sala_nome: b.salaNome,
    tipo: isLesson ? 'lezione' : (b.tipo || 'prove'),
    insegnante_id: isLesson ? (b.insegnanteId || '') : '',
    insegnante_nome: isLesson ? (b.insegnanteNome || '') : '',
    data: b.data,
    ora_inizio: b.oraInizio,
    ora_fine: b.oraFine,
    durata_ore: b.durataOre,
    ripetizione_settimanale: b.ripetizioneSettimanale ?? false,
    gruppo_ricorrenza_id: b.gruppoRicorrenzaId || '',
    settimane_ripetizione: b.settimaneRipetizione || 4,
    recurrence_config: b.recurrenceConfig || null,
    operatore_assegnato_id: isLesson ? '' : (b.operatoreAssegnatoId || ''),
    operatore_assegnato_nome: isLesson ? '' : (b.operatoreAssegnatoNome || ''),
    tariffa_totale: isLesson ? 0 : b.tariffaTotale,
    sconto: isLesson ? 0 : (b.sconto || 0),
    stato_pagamento: isLesson ? 'pagato' : b.statoPagamento,
    metodo_pagamento: isLesson ? null : (b.metodoPagamento || null),
    richieste_strumentazione: b.richiesteStrumentazione || '',
    note: b.note || '',
    updated_at: new Date().toISOString(),
  };
};

export const mapBookingFromDb = (b: any): Booking => {
  const isLesson = isLessonBooking({
    tipo: b.tipo,
    insegnanteId: b.insegnante_id,
    insegnanteNome: b.insegnante_nome,
  });

  let operatoreAssegnatoNome = isLesson ? undefined : (b.operatore_assegnato_nome || undefined);
  if (b.operatore_assegnato_id === 'staff-1' || operatoreAssegnatoNome === 'Marco Bellini') {
    operatoreAssegnatoNome = 'Gabriele Piva';
  }
  let insegnanteNome = isLesson ? (b.insegnante_nome || undefined) : undefined;
  if (b.insegnante_id === 'staff-1' || insegnanteNome === 'Marco Bellini') {
    insegnanteNome = 'Gabriele Piva';
  }

  return {
    id: b.id,
    clienteId: b.cliente_id,
    clienteNome: b.cliente_nome,
    salaId: b.sala_id,
    salaNome: b.sala_nome,
    tipo: isLesson ? 'lezione' : (b.tipo || 'prove'),
    insegnanteId: isLesson ? (b.insegnante_id || undefined) : undefined,
    insegnanteNome,
    data: b.data,
    oraInizio: b.ora_inizio,
    oraFine: b.ora_fine,
    durataOre: Number(b.durata_ore),
    ripetizioneSettimanale: Boolean(b.ripetizione_settimanale),
    gruppoRicorrenzaId: b.gruppo_ricorrenza_id || undefined,
    settimaneRipetizione: b.settimane_ripetizione ? Number(b.settimane_ripetizione) : undefined,
    recurrenceConfig: b.recurrence_config || undefined,
    operatoreAssegnatoId: isLesson ? undefined : (b.operatore_assegnato_id || undefined),
    operatoreAssegnatoNome,
    tariffaTotale: isLesson ? 0 : Number(b.tariffa_totale),
    sconto: isLesson ? 0 : (b.sconto ? Number(b.sconto) : 0),
    statoPagamento: isLesson ? 'pagato' : b.stato_pagamento,
    metodoPagamento: isLesson ? undefined : (b.metodo_pagamento || undefined),
    richiesteStrumentazione: b.richieste_strumentazione || '',
    note: b.note || '',
  };
};

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
    const cleanBaseNote = (s.note || '')
      .replace(/__WA_CFG__:[\s\S]*?__END_WA_CFG__/g, '')
      .replace(/__SHIFTS__:[\s\S]*?__END_SHIFTS__/g, '')
      .trim();
    const encodedWa = `__WA_CFG__:${JSON.stringify(s.whatsappConfig)}__END_WA_CFG__`;
    noteWithConfig = cleanBaseNote ? `${cleanBaseNote}\n${encodedWa}` : encodedWa;
  }

  // Preserva SEMPRE il blocco turni __SHIFTS__: se presente nel testo delle note
  if (s.note && s.note.includes('__SHIFTS__:')) {
    const match = s.note.match(/__SHIFTS__:[\s\S]*?__END_SHIFTS__/);
    if (match && !noteWithConfig.includes('__SHIFTS__:')) {
      noteWithConfig = noteWithConfig ? `${noteWithConfig}\n${match[0]}` : match[0];
    }
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

export const extractShiftsFromNote = (note?: string): WorkShift[] => {
  if (!note || !note.includes('__SHIFTS__:')) return [];
  try {
    const match = note.match(/__SHIFTS__:([\s\S]*?)__END_SHIFTS__/);
    if (match && match[1]) {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        return parsed.map(mapShiftFromDb);
      }
    }
  } catch (e) {
    console.warn('[extractShiftsFromNote] Errore parsing shifts da note:', e);
  }
  return [];
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
  cleanNote = cleanNote
    .replace(/__WA_CFG__:[\s\S]*?__END_WA_CFG__/g, '')
    .replace(/__SHIFTS__:[\s\S]*?__END_SHIFTS__/g, '')
    .trim();

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

export const mapShiftFromDb = (s: any): WorkShift => {
  let operatoreNome = s.operatore_nome || undefined;
  if (s.operatore_id === 'staff-1' || operatoreNome === 'Marco Bellini') {
    operatoreNome = 'Gabriele Piva';
  }
  return {
    id: s.id,
    data: s.data,
    turnoNumero: (Number(s.turno_numero) || 1) as 1 | 2,
    nomeTurno: s.nome_turno || (s.turno_numero === 1 ? '1° Turno (Pomeridiano)' : '2° Turno (Serale)'),
    oraInizioBase: s.ora_inizio_base || (s.turno_numero === 1 ? '17:00' : '20:00'),
    oraFineBase: s.ora_fine_base || (s.turno_numero === 1 ? '20:00' : '23:00'),
    oraInizioEffettiva: s.ora_inizio_effettiva || undefined,
    oraFineEffettiva: s.ora_fine_effettiva || undefined,
    operatoreId: s.operatore_id || undefined,
    operatoreNome,
    note: s.note || '',
    isCustomHours: Boolean(s.is_custom_hours),
  };
};


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

  // Caricamento completo con paginazione e deduplicazione automatica
  async fetchAllBookings(): Promise<Booking[]> {
    if (!supabase) return [];
    let all: any[] = [];
    let page = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('data', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (error || !data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < pageSize) break;
      page++;
    }
    const mapped = all.map(mapBookingFromDb);
    // Deduplicazione a monte:
    // 1. Unico evento per slot esatto (data, sala, orario, cliente)
    // 2. Unico evento per lo stesso cliente nello stesso orario su sale diverse (predilige Studiolo per lezioni)
    const seenExact = new Map<string, Booking>();
    for (const b of mapped) {
      const sig = `${b.data}###${b.salaId}###${b.oraInizio}###${b.oraFine}###${(b.clienteNome || '').trim().toLowerCase()}`;
      if (!seenExact.has(sig)) {
        seenExact.set(sig, b);
      } else {
        const existing = seenExact.get(sig)!;
        if (existing.statoPagamento !== 'pagato' && b.statoPagamento === 'pagato') {
          seenExact.set(sig, b);
        }
      }
    }

    const clientSlotMap = new Map<string, Booking>();
    for (const b of seenExact.values()) {
      const clientNorm = (b.clienteNome || '').trim().toLowerCase();
      if (!clientNorm) {
        clientSlotMap.set(b.id, b);
        continue;
      }
      const slotKey = `${b.data}###${b.oraInizio}###${b.oraFine}###${clientNorm}`;
      if (!clientSlotMap.has(slotKey)) {
        clientSlotMap.set(slotKey, b);
      } else {
        const existing = clientSlotMap.get(slotKey)!;
        const bIsStudiolo = (b.salaNome || '').toLowerCase().includes('studiolo') || b.salaId.includes('1790981409646');
        const existingIsStudiolo = (existing.salaNome || '').toLowerCase().includes('studiolo') || existing.salaId.includes('1790981409646');
        if (bIsStudiolo && !existingIsStudiolo) {
          clientSlotMap.set(slotKey, b);
        } else if (!bIsStudiolo && existingIsStudiolo) {
          // mantieni existing (Studiolo)
        } else if (existing.statoPagamento !== 'pagato' && b.statoPagamento === 'pagato') {
          clientSlotMap.set(slotKey, b);
        }
      }
    }

    return Array.from(clientSlotMap.values());
  },

  // Caricamento complessivo iniziale
  async fetchAll() {
    if (!supabase) return null;

    const [
      roomsRes,
      staffRes,
      clientsRes,
      bookingsList,
      expensesRes,
      incomesRes,
      studioRes,
      shiftsRes,
    ] = await Promise.all([
      supabase.from('rooms').select('*').order('nome'),
      supabase.from('staff').select('*').order('cognome'),
      supabase.from('clients').select('*').order('created_at', { ascending: true }),
      this.fetchAllBookings(),
      supabase.from('expenses').select('*').order('data', { ascending: false }),
      supabase.from('incomes').select('*').order('data', { ascending: false }),
      supabase.from('studio_info').select('*').limit(1).maybeSingle(),
      supabase.from('shifts').select('*').order('data', { ascending: true }),
    ]);

    let shifts = (shiftsRes.data || []).map(mapShiftFromDb);
    if (shifts.length === 0) {
      shifts = await this.getShiftsFromStore();
    }
    if (shifts.length === 0 && studioRes.data?.note) {
      shifts = extractShiftsFromNote(studioRes.data.note);
    }

    return {
      rooms: (roomsRes.data || []).map(mapRoomFromDb),
      staff: (staffRes.data || []).map(mapStaffFromDb),
      clients: (clientsRes.data || []).map(mapClientFromDb),
      bookings: bookingsList,
      expenses: (expensesRes.data || []).map(mapExpenseFromDb),
      incomes: (incomesRes.data || []).map(mapIncomeFromDb),
      studioInfo: studioRes.data ? mapStudioInfoFromDb(studioRes.data) : null,
      shifts,
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
    if (!supabase) return { error: null };
    if (hasClientQuotaColumn !== false) {
      const payload = mapClientToDb(client, true);
      const { data, error } = await supabase.from('clients').upsert(payload);
      if (!error) {
        hasClientQuotaColumn = true;
        return { data, error: null };
      }
      if (error.code === 'PGRST204' || error.message?.includes('quota_pagata') || error.message?.includes('stato_quota')) {
        hasClientQuotaColumn = false;
        console.warn('[Supabase] Colonne quota_pagata/stato_quota non trovate in clients. Attivato fallback trasparente.');
      } else {
        console.error('[Supabase] Errore upsertClient:', error);
        return { error };
      }
    }
    const fallbackPayload = mapClientToDb(client, false);
    const { data, error } = await supabase.from('clients').upsert(fallbackPayload);
    if (error) console.error('[Supabase] Errore upsertClient fallback:', error);
    return { data, error };
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
  async deleteBookingsByGroupFromDate(groupId: string, fromDateIso: string) {
    if (!supabase) return;
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('gruppo_ricorrenza_id', groupId)
      .gte('data', fromDateIso);
    if (error) console.error('[Supabase] Errore deleteBookingsByGroupFromDate:', error);
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

  // Recupera l'elenco turni dalla riga dedicata 'shifts_store' in studio_info (isolata da qualsiasi sovrascrittura)
  async getShiftsFromStore(): Promise<WorkShift[]> {
    if (!supabase) return [];
    try {
      const { data } = await supabase
        .from('studio_info')
        .select('note')
        .eq('id', 'shifts_store')
        .maybeSingle();
      if (data?.note) {
        const parsed = JSON.parse(data.note);
        if (Array.isArray(parsed)) {
          return parsed.map(mapShiftFromDb);
        }
      }
    } catch (e) {
      console.warn('[Supabase] Errore getShiftsFromStore:', e);
    }
    return [];
  },

  // Salva l'elenco completo turni nella riga dedicata 'shifts_store' di studio_info
  async saveShiftsToStore(shifts: WorkShift[]): Promise<boolean> {
    if (!supabase) return false;
    try {
      const dbRows = shifts.map(mapShiftToDb);
      const { error } = await supabase
        .from('studio_info')
        .upsert({
          id: 'shifts_store',
          nome: 'Shifts Store',
          note: JSON.stringify(dbRows),
          updated_at: new Date().toISOString(),
        });
      if (error) {
        console.error('[Supabase] Errore saveShiftsToStore:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[Supabase] Errore saveShiftsToStore catch:', e);
      return false;
    }
  },

  // Shifts (Turni Presidio Sala Prove)
  async upsertShift(shift: WorkShift) {
    if (!supabase) return;
    try {
      // 1. Tenta la tabella shifts (se creata nel DB)
      const { error } = await supabase.from('shifts').upsert(mapShiftToDb(shift));
      if (error && (error.code === 'PGRST205' || error.message?.includes('shifts'))) {
        await this.fallbackSaveShifts([shift]);
      } else {
        // Mirroring sempre attivo su store per garantire ridondanza e continuità
        await this.fallbackSaveShifts([shift]);
      }
    } catch (e) {
      await this.fallbackSaveShifts([shift]);
    }
  },

  async upsertMultipleShifts(shifts: WorkShift[]) {
    if (!supabase || shifts.length === 0) return;
    try {
      const rows = shifts.map(mapShiftToDb);
      const { error } = await supabase.from('shifts').upsert(rows);
      if (error && (error.code === 'PGRST205' || error.message?.includes('shifts'))) {
        await this.fallbackSaveShifts(shifts);
      } else {
        await this.fallbackSaveShifts(shifts);
      }
    } catch (e) {
      await this.fallbackSaveShifts(shifts);
    }
  },

  async fallbackSaveShifts(newShifts: WorkShift[]) {
    if (!supabase || newShifts.length === 0) return;
    try {
      // 1. Legge i turni esistenti dallo store dedicato
      let existingShifts = await this.getShiftsFromStore();

      // Se vuoto, controlla anche il blocco note del record main
      if (existingShifts.length === 0) {
        const { data: studioMain } = await supabase.from('studio_info').select('note').eq('id', 'main').maybeSingle();
        if (studioMain?.note) {
          existingShifts = extractShiftsFromNote(studioMain.note);
        }
      }

      // 2. Chiave univoca robusta: data + '_' + turnoNumero
      const map = new Map<string, WorkShift>();
      existingShifts.forEach((s) => map.set(`${s.data}_${s.turnoNumero}`, s));
      newShifts.forEach((s) => map.set(`${s.data}_${s.turnoNumero}`, s));
      const merged = Array.from(map.values());

      // 3. Salva nella riga dedicata 'shifts_store' (100% isolata e sicura da qualsiasi sovrascrittura)
      await this.saveShiftsToStore(merged);

      // 4. Salva anche come backup nel note del record 'main'
      try {
        const { data: studioMain } = await supabase.from('studio_info').select('id, note').eq('id', 'main').maybeSingle();
        if (studioMain) {
          const cleanNote = (studioMain.note || '').replace(/__SHIFTS__:[\s\S]*?__END_SHIFTS__/g, '').trim();
          const encodedShifts = `__SHIFTS__:${JSON.stringify(merged)}__END_SHIFTS__`;
          const updatedNote = cleanNote ? `${cleanNote}\n${encodedShifts}` : encodedShifts;
          await supabase.from('studio_info').update({ note: updatedNote }).eq('id', studioMain.id);
        }
      } catch {}
    } catch (e) {
      console.warn('[Supabase] Errore fallbackSaveShifts:', e);
    }
  },

  async deleteShift(id: string) {
    if (!supabase) return;
    try {
      await supabase.from('shifts').delete().eq('id', id);
    } catch {}

    try {
      const existing = await this.getShiftsFromStore();
      const filtered = existing.filter((s) => s.id !== id);
      await this.saveShiftsToStore(filtered);

      const { data: studioMain } = await supabase.from('studio_info').select('id, note').eq('id', 'main').maybeSingle();
      if (studioMain) {
        const cleanNote = (studioMain.note || '').replace(/__SHIFTS__:[\s\S]*?__END_SHIFTS__/g, '').trim();
        const encodedShifts = `__SHIFTS__:${JSON.stringify(filtered)}__END_SHIFTS__`;
        const updatedNote = cleanNote ? `${cleanNote}\n${encodedShifts}` : encodedShifts;
        await supabase.from('studio_info').update({ note: updatedNote }).eq('id', studioMain.id);
      }
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
      (async () => {
        if (hasClientQuotaColumn !== false) {
          const res = await supabase.from('clients').upsert(data.clients.map((c) => mapClientToDb(c, true)));
          if (!res.error) {
            hasClientQuotaColumn = true;
            return res;
          }
          if (res.error.code === 'PGRST204' || res.error.message?.includes('quota_pagata') || res.error.message?.includes('stato_quota')) {
            hasClientQuotaColumn = false;
          } else {
            return res;
          }
        }
        return supabase.from('clients').upsert(data.clients.map((c) => mapClientToDb(c, false)));
      })(),
      data.bookings.length > 0 ? supabase.from('bookings').upsert(data.bookings.map(mapBookingToDb)) : Promise.resolve({ error: null }),
      data.expenses.length > 0 ? supabase.from('expenses').upsert(data.expenses.map(mapExpenseToDb)) : Promise.resolve({ error: null }),
      data.incomes.length > 0 ? supabase.from('incomes').upsert(data.incomes.map(mapIncomeToDb)) : Promise.resolve({ error: null }),
      data.shifts && data.shifts.length > 0
        ? (async () => {
            await this.saveShiftsToStore(data.shifts!);
            return supabase.from('shifts').upsert(data.shifts!.map(mapShiftToDb));
          })()
        : Promise.resolve({ error: null }),
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
