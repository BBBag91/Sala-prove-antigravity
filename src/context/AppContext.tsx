import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { DEFAULT_STUDIO_INFO, INITIAL_BOOKINGS, INITIAL_CLIENTS, INITIAL_EXPENSES, INITIAL_ROOMS, INITIAL_STAFF, INITIAL_SHIFTS } from '../data/initialData';
import { Booking, Client, Expense, ManualIncome, Room, StaffMember, StudioInfo, RecurrenceConfig, WorkShift, DeleteRecurringMode, isLessonBooking } from '../types';
import { calculateDurationHours, formatDateToISO, parseISODate, generateRecurrenceDates, timeToMinutes } from '../utils/dateUtils';
import { autoAssignOperators, AutoAssignResult } from '../utils/scheduler';
import { computeDailyShifts, autoAssignWeeklyShifts, autoAssignMonthlyShifts } from '../utils/shiftUtils';
import { isSupabaseConfigured, setSupabaseCredentials, supabase } from '../lib/supabase';
import { supabaseService } from '../services/supabaseService';
import { generateUUID } from '../utils/uuid';

interface AppContextType {
  // Data
  studioInfo: StudioInfo;
  rooms: Room[];
  staff: StaffMember[];
  clients: Client[];
  bookings: Booking[];
  expenses: Expense[];
  incomes: ManualIncome[];
  shifts: WorkShift[];

  // Cloud & Supabase
  isSupabaseConfigured: boolean;
  isCloudConnected: boolean;
  isLoadingCloud: boolean;
  isAutoRefreshing: boolean;
  lastCloudRefresh: Date | null;
  syncLocalToCloud: () => Promise<boolean>;
  refreshFromCloud: () => Promise<void>;
  reconnectSupabase: (url?: string, key?: string) => Promise<boolean>;

  // Studio actions
  updateStudioInfo: (info: Partial<StudioInfo>) => void;

  // Room actions
  addRoom: (room: Omit<Room, 'id'>) => void;
  updateRoom: (room: Room) => void;
  deleteRoom: (id: string) => void;

  // Staff actions
  addStaff: (member: Omit<StaffMember, 'id'>) => Promise<StaffMember>;
  updateStaff: (member: StaffMember) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;

  // Shift actions (Turni Presidio Sala Prove)
  assignOperatorToShift: (date: string, turnoNumero: 1 | 2, operatorId?: string, syncToBookings?: boolean, customOperatorName?: string) => void;
  updateShift: (shift: WorkShift) => void;
  deleteShift: (id: string) => void;
  autoAssignWeeklyShiftsAction: (weekDates: string[]) => { assignedCount: number; unassignedCount: number };
  autoAssignMonthlyShiftsAction: (monthStr: string, forceReassign?: boolean) => { assignedCount: number; unassignedCount: number };

  // Client actions
  addClient: (client: Omit<Client, 'id'> | Client) => void;
  updateClient: (client: Client) => void;
  deleteClient: (id: string) => void;

  // Booking actions
  addBooking: (booking: Omit<Booking, 'id' | 'durataOre'> & { repeatWeeks?: number; recurrenceConfig?: RecurrenceConfig }) => void;
  updateBooking: (booking: Booking) => void;
  updateMultipleBookings: (bookings: Booking[]) => void;
  deleteBooking: (id: string, mode?: DeleteRecurringMode | boolean) => void;
  assignOperatorToBooking: (bookingId: string, operatorId?: string) => void;
  runAutoAssignment: (monthFilter?: string) => AutoAssignResult;

  // Expense actions
  addExpense: (expense: Omit<Expense, 'id'>) => void;
  updateExpense: (expense: Expense) => void;
  deleteExpense: (id: string) => void;

  // Income actions
  addIncome: (income: Omit<ManualIncome, 'id'>) => void;
  deleteIncome: (id: string) => void;

  // Utility
  resetToDemoData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  STUDIO: 'salaprove_studio_v1',
  ROOMS: 'salaprove_rooms_v1',
  STAFF: 'salaprove_staff_v1',
  CLIENTS: 'salaprove_clients_v1',
  BOOKINGS: 'salaprove_bookings_v1',
  EXPENSES: 'salaprove_expenses_v1',
  INCOMES: 'salaprove_incomes_v1',
  SHIFTS: 'salaprove_shifts_v1',
};

// Safe localStorage read with fallback on parse error
function safeLocalStorageGet<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    return JSON.parse(saved) as T;
  } catch {
    console.warn(`[AppContext] Dati corrotti in localStorage (chiave: ${key}), ripristino dati di default.`);
    localStorage.removeItem(key);
    return fallback;
  }
}

// Safe localStorage write with QuotaExceededError protection
function safeLocalStorageSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.error('[AppContext] localStorage pieno: impossibile salvare i dati.');
    }
  }
}

// PROTEZIONE CALENDARIO:
// Deduplicazione minimale a salvaguardia del calendario: garantisce unicità per ID esatto
// senza MAI eliminare, alterare, fondere o modificare le prenotazioni legittime di sale diverse o lezioni.
export function deduplicateBookings(bookingsList: Booking[]): Booking[] {
  if (!Array.isArray(bookingsList)) return [];
  const byId = new Map<string, Booking>();
  for (const b of bookingsList) {
    if (b && b.id) {
      byId.set(b.id, b);
    }
  }
  return Array.from(byId.values());
}

/**
 * Deduplica la lista clienti/tesserati garantendo unicità per ID e per Codice Fiscale.
 * In caso di duplicato, mantiene il record con più informazioni (es. quello con tessera assegnata).
 */
export function deduplicateClients(clientsList: Client[]): Client[] {
  const cfMap = new Map<string, Client>();
  const idMap = new Map<string, Client>();

  for (const client of clientsList) {
    if (!client) continue;

    const cf = (client.codiceFiscale || '').trim().toUpperCase();

    // Se non ha CF, usa solo l'ID come chiave
    if (!cf) {
      if (!idMap.has(client.id)) idMap.set(client.id, client);
      continue;
    }

    if (!cfMap.has(cf)) {
      cfMap.set(cf, client);
      idMap.set(client.id, client);
    } else {
      const existing = cfMap.get(cf)!;
      // Preferisci il record con numero tessera assegnato o con più dati
      const preferNew =
        (!existing.numeroTessera && Boolean(client.numeroTessera)) ||
        (existing.statoTesseramento === 'da_tesserare' && client.statoTesseramento !== 'da_tesserare');
      const winner: Client = preferNew
        ? { ...existing, ...client }
        : { ...client, ...existing };
      cfMap.set(cf, winner);
      idMap.set(winner.id, winner);
    }
  }

  return Array.from(cfMap.values());
}


export function deduplicateStaff(staffList: StaffMember[]): StaffMember[] {
  const canonicalIdMap: Record<string, string> = {
    'staff-1790952646698': 'staff-1790952724237', // Luca Di Chiara
    'staff-1790952680654': 'staff-1790952691190', // Michael Bertin
  };

  const nameMap = new Map<string, StaffMember>();
  const idMap = new Map<string, StaffMember>();

  for (const raw of staffList) {
    if (!raw) continue;
    let member: StaffMember = {
      ...raw,
      id: canonicalIdMap[raw.id] || raw.id,
    };

    // Sanificazione Gabriele Piva (ex Marco Bellini)
    if (
      member.id === 'staff-1' ||
      member.nome?.toLowerCase() === 'gabriele' ||
      member.nome?.toLowerCase() === 'marco' ||
      (member.email && member.email.includes('marco.bellini'))
    ) {
      member = {
        ...member,
        id: 'staff-1',
        nome: 'Gabriele',
        cognome: 'Piva',
        email: 'gabriele.piva@salaprove.it',
      };
    }

    const normName = `${(member.nome || '').trim().toLowerCase()} ${(member.cognome || '').trim().toLowerCase()}`;

    if (!normName.trim()) {
      if (!idMap.has(member.id)) idMap.set(member.id, member);
      continue;
    }

    if (!nameMap.has(normName)) {
      nameMap.set(normName, member);
      idMap.set(member.id, member);
    } else {
      const existing = nameMap.get(normName)!;
      // Preferisci sempre l'ID reale censito su Supabase o quello con più informazioni
      const preferMember =
        member.id === 'staff-1790952724237' ||
        member.id === 'staff-1790952691190' ||
        member.id === 'staff-1' ||
        (!existing.email && Boolean(member.email));

      const winner: StaffMember = preferMember
        ? { ...existing, ...member }
        : { ...member, ...existing };

      nameMap.set(normName, winner);
      idMap.set(winner.id, winner);
    }
  }

  return Array.from(nameMap.values());
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [studioInfo, setStudioInfo] = useState<StudioInfo>(() => {
    const local = safeLocalStorageGet(STORAGE_KEYS.STUDIO, DEFAULT_STUDIO_INFO);
    if (!local || local.nome === 'Shifts Store' || local.indirizzo === 'Via della Musica 42') {
      return DEFAULT_STUDIO_INFO;
    }
    return local;
  });

  const [rooms, setRooms] = useState<Room[]>(() =>
    safeLocalStorageGet(STORAGE_KEYS.ROOMS, INITIAL_ROOMS)
  );

  const [staff, setStaff] = useState<StaffMember[]>(() => {
    const raw = safeLocalStorageGet(STORAGE_KEYS.STAFF, INITIAL_STAFF);
    return deduplicateStaff(raw);
  });

  const [clients, setClients] = useState<Client[]>(() => {
    const raw = safeLocalStorageGet<Client[]>(STORAGE_KEYS.CLIENTS, INITIAL_CLIENTS);
    const mockIds = new Set(['cli-1', 'cli-2', 'cli-3', 'cli-4', 'cli-5', 'cli-6', 'cli-7', 'cli-8']);
    const filtered = raw.filter((c: Client) => !mockIds.has(c.id));
    // Deduplicazione a monte: rimuove duplicati per Codice Fiscale già presenti in localStorage
    return deduplicateClients(filtered);
  });

  const [bookings, setBookings] = useState<Booking[]>(() => {
    const parsed = safeLocalStorageGet<Booking[]>(STORAGE_KEYS.BOOKINGS, INITIAL_BOOKINGS);
    return deduplicateBookings(parsed);
  });

  const [expenses, setExpenses] = useState<Expense[]>(() =>
    safeLocalStorageGet(STORAGE_KEYS.EXPENSES, INITIAL_EXPENSES)
  );

  const [incomes, setIncomes] = useState<ManualIncome[]>(() =>
    safeLocalStorageGet(STORAGE_KEYS.INCOMES, [])
  );

  const [shifts, setShifts] = useState<WorkShift[]>(() =>
    safeLocalStorageGet(STORAGE_KEYS.SHIFTS, INITIAL_SHIFTS)
  );

  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [lastCloudRefresh, setLastCloudRefresh] = useState<Date | null>(null);
  const configured = isSupabaseConfigured();

  // Initial load directly from Supabase Cloud database
  useEffect(() => {
    setIsLoadingCloud(true);
    supabaseService.fetchAll()
      .then((remote) => {
        if (remote) {
          if (remote.rooms.length > 0) {
            setRooms((prevLocal) => {
              const remoteIds = new Set(remote.rooms.map((r) => r.id));
              const pendingLocal = prevLocal.filter((localR) => !remoteIds.has(localR.id));
              return pendingLocal.length > 0 ? [...remote.rooms, ...pendingLocal] : remote.rooms;
            });
          }
          if (remote.staff.length > 0) {
            setStaff((prevLocal) => deduplicateStaff([...remote.staff, ...prevLocal]));
          }
          if (remote.clients.length > 0) {
            const mockIds = new Set(['cli-1', 'cli-2', 'cli-3', 'cli-4', 'cli-5', 'cli-6', 'cli-7', 'cli-8']);
            const cleanRemote = remote.clients.filter((c) => !mockIds.has(c.id));
            setClients((prevLocal) => {
              const cleanLocal = prevLocal.filter((c) => !mockIds.has(c.id));
              const remoteIds = new Set(cleanRemote.map((c) => c.id));
              const remoteCFs = new Set(cleanRemote.map((c) => c.codiceFiscale).filter(Boolean));
              // Mantieni solo i locali non già presenti nel remoto (né per ID né per CF)
              const pendingLocal = cleanLocal.filter(
                (localC) => !remoteIds.has(localC.id) && !remoteCFs.has(localC.codiceFiscale)
              );
              return pendingLocal.length > 0 ? [...cleanRemote, ...pendingLocal] : cleanRemote;
            });
          }
          if (remote.bookings.length > 0) setBookings(remote.bookings);
          if (remote.expenses.length > 0) setExpenses(remote.expenses);
          if (remote.incomes.length > 0) setIncomes(remote.incomes);
          if (remote.studioInfo && remote.studioInfo.nome !== 'Shifts Store') {
            setStudioInfo((prev) => {
              const validIndirizzo =
                remote.studioInfo.indirizzo && remote.studioInfo.indirizzo !== 'Via della Musica 42'
                  ? remote.studioInfo.indirizzo
                  : (prev?.indirizzo && prev.indirizzo !== 'Via della Musica 42' ? prev.indirizzo : DEFAULT_STUDIO_INFO.indirizzo);

              const safeRemote = {
                ...remote.studioInfo,
                nome: remote.studioInfo.nome || DEFAULT_STUDIO_INFO.nome,
                indirizzo: validIndirizzo,
                citta: remote.studioInfo.citta && remote.studioInfo.citta !== 'Milano' ? remote.studioInfo.citta : DEFAULT_STUDIO_INFO.citta,
              };

              if (!safeRemote.whatsappConfig && prev?.whatsappConfig) {
                const merged = { ...safeRemote, whatsappConfig: prev.whatsappConfig };
                supabaseService.upsertStudioInfo(merged).catch(console.error);
                return merged;
              }
              return safeRemote;
            });
          }
          if (remote.shifts && remote.shifts.length > 0) setShifts(remote.shifts);
          setIsCloudConnected(true);
        }
      })
      .catch((err) => {
        console.warn('[AppContext] Supabase offline:', err);
        setIsCloudConnected(false);
      })
      .finally(() => {
        setIsLoadingCloud(false);
      });
  }, []);

  // Sync with localStorage (with safe write)
  useEffect(() => { safeLocalStorageSet(STORAGE_KEYS.STUDIO, studioInfo); }, [studioInfo]);
  useEffect(() => { safeLocalStorageSet(STORAGE_KEYS.ROOMS, rooms); }, [rooms]);
  useEffect(() => { safeLocalStorageSet(STORAGE_KEYS.STAFF, staff); }, [staff]);
  useEffect(() => { safeLocalStorageSet(STORAGE_KEYS.CLIENTS, clients); }, [clients]);
  useEffect(() => { safeLocalStorageSet(STORAGE_KEYS.BOOKINGS, bookings); }, [bookings]);
  useEffect(() => { safeLocalStorageSet(STORAGE_KEYS.EXPENSES, expenses); }, [expenses]);
  useEffect(() => { safeLocalStorageSet(STORAGE_KEYS.INCOMES, incomes); }, [incomes]);
  useEffect(() => { safeLocalStorageSet(STORAGE_KEYS.SHIFTS, shifts); }, [shifts]);

  // Ascolta aggiornamenti tesserati tra finestre/tab del browser (es. compilazione modulo online)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.CLIENTS && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setClients(parsed);
          }
        } catch { }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Cloud Actions
  const syncLocalToCloud = async (): Promise<boolean> => {
    await supabaseService.syncAllLocalDataToSupabase({
      rooms,
      staff,
      clients,
      bookings,
      expenses,
      incomes,
      studioInfo,
      shifts,
    });
    setIsCloudConnected(true);
    return true;
  };

  const refreshFromCloud = async (): Promise<void> => {
    setIsAutoRefreshing(true);
    try {
      const remote = await supabaseService.fetchAll();
      if (remote) {
        if (remote.rooms.length > 0) {
          setRooms((prevLocal) => {
            const remoteIds = new Set(remote.rooms.map((r) => r.id));
            const pendingLocal = prevLocal.filter((localR) => !remoteIds.has(localR.id));
            return pendingLocal.length > 0 ? [...remote.rooms, ...pendingLocal] : remote.rooms;
          });
        }
        if (remote.staff.length > 0) {
          setStaff((prevLocal) => deduplicateStaff([...remote.staff, ...prevLocal]));
        }
        if (remote.bookings) {
          // PROTEZIONE CALENDARIO: mantieni intatte al 100% tutte le prenotazioni del DB
          setBookings(deduplicateBookings(remote.bookings));
        }
        if (remote.clients && remote.clients.length > 0) {
          setClients((prevLocal) => {
            const remoteIds = new Set(remote.clients.map((c) => c.id));
            const remoteCFs = new Set(remote.clients.map((c) => c.codiceFiscale).filter(Boolean));
            // Mantieni solo i locali che non sono già presenti nel remoto (né per ID né per CF)
            const pendingLocal = prevLocal.filter(
              (localC) => !remoteIds.has(localC.id) && !remoteCFs.has(localC.codiceFiscale)
            );
            return pendingLocal.length > 0 ? [...remote.clients, ...pendingLocal] : remote.clients;
          });
        }
        if (remote.expenses.length > 0) setExpenses(remote.expenses);
        if (remote.incomes.length > 0) setIncomes(remote.incomes);
        if (remote.studioInfo && remote.studioInfo.nome !== 'Shifts Store') {
          setStudioInfo((prev) => {
            const validIndirizzo =
              remote.studioInfo.indirizzo && remote.studioInfo.indirizzo !== 'Via della Musica 42'
                ? remote.studioInfo.indirizzo
                : (prev?.indirizzo && prev.indirizzo !== 'Via della Musica 42' ? prev.indirizzo : DEFAULT_STUDIO_INFO.indirizzo);

            const safeRemote = {
              ...remote.studioInfo,
              nome: remote.studioInfo.nome || DEFAULT_STUDIO_INFO.nome,
              indirizzo: validIndirizzo,
              citta: remote.studioInfo.citta && remote.studioInfo.citta !== 'Milano' ? remote.studioInfo.citta : DEFAULT_STUDIO_INFO.citta,
            };

            if (!safeRemote.whatsappConfig && prev?.whatsappConfig) {
              const merged = { ...safeRemote, whatsappConfig: prev.whatsappConfig };
              supabaseService.upsertStudioInfo(merged).catch(console.error);
              return merged;
            }
            return safeRemote;
          });
        }
        if (remote.shifts !== undefined) {
          setShifts(remote.shifts);
        }
        setIsCloudConnected(true);
        setLastCloudRefresh(new Date());
      }
    } catch (err) {
      console.warn('[AppContext] Errore refreshFromCloud:', err);
    } finally {
      setIsAutoRefreshing(false);
    }
  };

  // Auto-refresh ogni 5 minuti (300.000 ms) + su riattivazione scheda browser (focus / visibilitychange)
  useEffect(() => {
    const FIVE_MINUTES_MS = 5 * 60 * 1000;

    const intervalId = setInterval(() => {
      console.log('[AppContext] Auto-refresh calendario programmato ogni 5 minuti...');
      refreshFromCloud();
    }, FIVE_MINUTES_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshFromCloud();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  // Supabase Realtime: sincronizzazione istantanea turni e prenotazioni condivisi tra tutti i profili e client
  useEffect(() => {
    if (!configured || !supabase) return;

    try {
      const channel = supabase
        .channel('realtime:app-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bookings' },
          (payload) => {
            console.log('[Supabase Realtime] Modifica prenotazioni rilevata da altro client:', payload);
            refreshFromCloud();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'studio_info' },
          (payload: any) => {
            console.log('[Supabase Realtime] Modifica turni/studio_info rilevata:', payload);
            if (payload?.new?.id === 'shifts_store' || payload?.old?.id === 'shifts_store') {
              supabaseService.getShiftsFromStore().then((sh) => {
                if (sh && sh.length > 0) setShifts(sh);
              });
              return;
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'shifts' },
          (payload) => {
            console.log('[Supabase Realtime] Modifica turni rilevata da altro client:', payload);
            refreshFromCloud();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'clients' },
          (payload) => {
            console.log('[Supabase Realtime] Modifica tesserati rilevata da altro client:', payload);
            refreshFromCloud();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (err) {
      console.warn('[AppContext] Realtime non attivo:', err);
    }
  }, [configured]);

  const reconnectSupabase = async (newUrl?: string, newKey?: string): Promise<boolean> => {
    if (newUrl && newKey) {
      setSupabaseCredentials(newUrl, newKey);
    }
    const isConf = isSupabaseConfigured();
    if (!isConf) {
      setIsCloudConnected(false);
      return false;
    }
    setIsLoadingCloud(true);
    try {
      const test = await supabaseService.testConnection();
      if (!test.ok) {
        setIsCloudConnected(false);
        return false;
      }
      await refreshFromCloud();
      setIsCloudConnected(true);
      return true;
    } catch {
      setIsCloudConnected(false);
      return false;
    } finally {
      setIsLoadingCloud(false);
    }
  };

  // Rooms CRUD
  const addRoom = (roomData: Omit<Room, 'id'>) => {
    const newRoom: Room = {
      ...roomData,
      id: generateUUID(),
    };
    setRooms((prev) => [...prev, newRoom]);
    if (configured) {
      supabaseService.upsertRoom(newRoom).catch(console.error);
    }
  };

  const updateRoom = (updated: Room) => {
    setRooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    // Also sync room name in bookings
    setBookings((prev) =>
      prev.map((b) => (b.salaId === updated.id ? { ...b, salaNome: updated.nome } : b))
    );
    if (configured) {
      supabaseService.upsertRoom(updated).catch(console.error);
    }
  };

  const deleteRoom = (id: string) => {
    setRooms((prev) => prev.filter((r) => r.id !== id));
    if (configured) {
      supabaseService.deleteRoom(id).catch(console.error);
    }
  };

  // Staff CRUD
  const addStaff = async (memberData: Omit<StaffMember, 'id'>): Promise<StaffMember> => {
    const newMember: StaffMember = {
      ...memberData,
      id: generateUUID(),
    };
    setStaff((prev) => [...prev, newMember]);
    if (configured) {
      const res = await supabaseService.upsertStaff(newMember);
      if (res?.error) {
        console.error('[AppContext] Errore salvataggio operatore su Supabase:', res.error);
        throw res.error;
      }
    }
    return newMember;
  };

  const updateStaff = async (updated: StaffMember): Promise<void> => {
    setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    // Sync name in bookings
    setBookings((prev) =>
      prev.map((b) =>
        b.operatoreAssegnatoId === updated.id
          ? { ...b, operatoreAssegnatoNome: `${updated.nome} ${updated.cognome}` }
          : b
      )
    );
    if (configured) {
      const res = await supabaseService.upsertStaff(updated);
      if (res?.error) {
        console.error('[AppContext] Errore aggiornamento operatore su Supabase:', res.error);
        throw res.error;
      }
    }
  };

  const deleteStaff = async (id: string): Promise<void> => {
    setStaff((prev) => prev.filter((s) => s.id !== id));
    // Clear assignment in bookings
    setBookings((prev) =>
      prev.map((b) =>
        b.operatoreAssegnatoId === id
          ? { ...b, operatoreAssegnatoId: undefined, operatoreAssegnatoNome: undefined }
          : b
      )
    );
    if (configured) {
      await supabaseService.deleteStaff(id).catch(console.error);
    }
  };

  // Shift Actions (Turni Presidio Sala Prove)
  const assignOperatorToShift = (
    date: string,
    turnoNumero: 1 | 2,
    operatorId?: string,
    syncToBookings = true,
    customOperatorName?: string
  ) => {
    const op = operatorId ? staff.find((st) => st.id === operatorId) : undefined;
    const opName = op ? `${op.nome} ${op.cognome}` : (customOperatorName?.trim() || undefined);
    const effectiveOpId = operatorId || (customOperatorName?.trim() ? generateUUID() : undefined);

    const baseStart = turnoNumero === 1 ? '17:00' : '20:00';
    const baseEnd = turnoNumero === 1 ? '20:00' : '23:00';

    let updatedShiftRecord: WorkShift | null = null;

    setShifts((prevShifts) => {
      const existing = prevShifts.find((s) => s.data === date && s.turnoNumero === turnoNumero);
      updatedShiftRecord = {
        id: existing?.id || `shift-${date}-${turnoNumero}`,
        data: date,
        turnoNumero,
        nomeTurno: turnoNumero === 1 ? '1° Turno (Pomeridiano)' : '2° Turno (Serale)',
        oraInizioBase: baseStart,
        oraFineBase: baseEnd,
        oraInizioEffettiva: existing?.isCustomHours ? existing?.oraInizioEffettiva : undefined,
        oraFineEffettiva: existing?.isCustomHours ? existing?.oraFineEffettiva : undefined,
        operatoreId: effectiveOpId,
        operatoreNome: opName,
        note: existing?.note || '',
        isCustomHours: existing?.isCustomHours || false,
      };

      const filtered = prevShifts.filter((s) => !(s.data === date && s.turnoNumero === turnoNumero));
      return [...filtered, updatedShiftRecord];
    });

    if (updatedShiftRecord) {
      supabaseService.upsertShift(updatedShiftRecord).catch((err) =>
        console.error('[AppContext] Errore salvataggio turno su Supabase:', err)
      );
    }

    // Se richiesto, applica l'operatore anche a tutte le prenotazioni in questa fascia
    if (syncToBookings) {
      const dayBookings = bookings.filter((b) => b.data === date);
      const tempShifts = shifts.filter((s) => !(s.data === date && s.turnoNumero === turnoNumero));
      if (updatedShiftRecord) tempShifts.push(updatedShiftRecord);

      const [c1, c2] = computeDailyShifts(date, dayBookings, tempShifts, staff);
      const computed = turnoNumero === 1 ? c1 : c2;
      const shiftStartMins = timeToMinutes(computed.oraInizio);
      const shiftEndMins = timeToMinutes(computed.oraFine);

      let updatedAnyBooking = false;
      const updatedBookings = bookings.map((b) => {
        if (b.data !== date) return b;
        // Non assegnare MAI l'operatore di presidio alle lezioni didattiche (docente autonomo)
        if (isLessonBooking(b)) {
          if (b.operatoreAssegnatoId || b.operatoreAssegnatoNome) {
            updatedAnyBooking = true;
            return {
              ...b,
              tipo: 'lezione' as const,
              operatoreAssegnatoId: undefined,
              operatoreAssegnatoNome: undefined,
            };
          }
          return b;
        }

        const bStartMins = timeToMinutes(b.oraInizio);
        let bEndMins = timeToMinutes(b.oraFine);
        if (bEndMins <= bStartMins) bEndMins += 24 * 60;

        // Se la prova si sovrappone alla fascia oraria del turno
        if (bStartMins < shiftEndMins && bEndMins > shiftStartMins) {
          updatedAnyBooking = true;
          return {
            ...b,
            operatoreAssegnatoId: effectiveOpId,
            operatoreAssegnatoNome: opName,
          };
        }
        return b;
      });

      if (updatedAnyBooking) {
        setBookings(updatedBookings);
        updatedBookings
          .filter((b) => b.data === date)
          .forEach((b) => supabaseService.upsertBooking(b).catch(console.error));
      }
    }
  };

  const updateShift = (shift: WorkShift) => {
    setShifts((prev) => {
      const filtered = prev.filter((s) => s.id !== shift.id && !(s.data === shift.data && s.turnoNumero === shift.turnoNumero));
      return [...filtered, shift];
    });
    supabaseService.upsertShift(shift).catch((err) =>
      console.error('[AppContext] Errore updateShift su Supabase:', err)
    );
  };

  const deleteShift = (id: string) => {
    setShifts((prev) => prev.filter((s) => s.id !== id));
    supabaseService.deleteShift(id).catch((err) =>
      console.error('[AppContext] Errore deleteShift su Supabase:', err)
    );
  };

  const autoAssignWeeklyShiftsAction = (weekDates: string[]) => {
    const result = autoAssignWeeklyShifts(weekDates, shifts, bookings, staff);
    setShifts(result.updatedShifts);
    supabaseService.upsertMultipleShifts(result.updatedShifts).catch((err) =>
      console.error('[AppContext] Errore salvataggio turni settimanali su Supabase:', err)
    );
    return { assignedCount: result.assignedCount, unassignedCount: result.unassignedCount };
  };

  const autoAssignMonthlyShiftsAction = (monthStr: string, forceReassign?: boolean) => {
    const result = autoAssignMonthlyShifts(monthStr, shifts, bookings, staff, forceReassign);
    setShifts(result.updatedShifts);
    supabaseService.upsertMultipleShifts(result.updatedShifts).catch((err) =>
      console.error('[AppContext] Errore salvataggio turni mensili su Supabase:', err)
    );
    return { assignedCount: result.assignedCount, unassignedCount: result.unassignedCount };
  };

  // Client CRUD
  // Accetta anche un Client completo (con id già assegnato) per evitare duplicati quando il form
  // pubblico ha già salvato su Supabase e passa l'oggetto completo ad addClient.
  const addClient = (clientData: Omit<Client, 'id'> | Client) => {
    const hasId = 'id' in clientData && Boolean((clientData as Client).id);
    const newClient: Client = hasId
      ? (clientData as Client)
      : {
        ...clientData,
        id: generateUUID(),
      };

    setClients((prev) => {
      // Evita duplicati: controlla sia per ID che per Codice Fiscale
      const alreadyExists = prev.some(
        (c) =>
          c.id === newClient.id ||
          (newClient.codiceFiscale && c.codiceFiscale === newClient.codiceFiscale)
      );
      if (alreadyExists) {
        console.log('[AppContext] addClient: client già presente, skip duplicato:', newClient.codiceFiscale);
        return prev;
      }
      return [...prev, newClient];
    });

    // Salva su Supabase solo se non è già stato salvato dal form pubblico (che lo fa prima di chiamare addClient)
    if (configured && !hasId) {
      supabaseService.upsertClient(newClient).catch(console.error);
    }
  };

  const updateClient = (updated: Client) => {
    setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setBookings((prev) =>
      prev.map((b) =>
        b.clienteId === updated.id
          ? {
            ...b,
            clienteNome: `${updated.nome} ${updated.cognome}${updated.gruppoBand ? ` (${updated.gruppoBand})` : ''
              }`,
          }
          : b
      )
    );
    if (configured) {
      supabaseService.upsertClient(updated).catch(console.error);
    }
  };

  const deleteClient = (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
    if (configured) {
      supabaseService.deleteClient(id).catch(console.error);
    }
  };

  // Booking CRUD with recurrence support & anti-duplication
  const addBooking = (
    bookingData: Omit<Booking, 'id' | 'durataOre'> & {
      repeatWeeks?: number;
      recurrenceConfig?: RecurrenceConfig;
    }
  ) => {
    const duration = calculateDurationHours(bookingData.oraInizio, bookingData.oraFine);

    let datesToBook: string[] = [bookingData.data];
    let isRecurring = Boolean(bookingData.ripetizioneSettimanale || (bookingData.recurrenceConfig && bookingData.recurrenceConfig.attiva));
    let recurrenceId: string | undefined = bookingData.gruppoRicorrenzaId;

    // Espandi le occorrenze future SOLO se l'evento non appartiene già a una serie ricorrente esistente
    if (!bookingData.gruppoRicorrenzaId) {
      if (bookingData.recurrenceConfig && bookingData.recurrenceConfig.attiva) {
        datesToBook = generateRecurrenceDates(bookingData.data, bookingData.recurrenceConfig);
        isRecurring = datesToBook.length > 1;
        if (isRecurring) {
          recurrenceId = generateUUID();
        }
      } else if (bookingData.ripetizioneSettimanale) {
        const repeatWeeks = bookingData.repeatWeeks || 4;
        datesToBook = [];
        const baseDate = parseISODate(bookingData.data);
        for (let i = 0; i < repeatWeeks; i++) {
          const occurrenceDate = new Date(baseDate);
          occurrenceDate.setDate(baseDate.getDate() + i * 7);
          datesToBook.push(formatDateToISO(occurrenceDate));
        }
        isRecurring = datesToBook.length > 1;
        if (isRecurring) {
          recurrenceId = generateUUID();
        }
      }
    }

    setBookings((prev) => {
      // Protezione anti-duplicati a monte: scarta date in cui esiste già identica prenotazione per lo stesso slot/cliente
      const existingSignatures = new Set(
        prev.map((b) => `${b.data}###${b.salaId}###${b.oraInizio}###${b.oraFine}###${(b.clienteNome || '').trim().toLowerCase()}`)
      );

      const bStartMins = timeToMinutes(bookingData.oraInizio);
      let bEndMins = timeToMinutes(bookingData.oraFine);
      if (bEndMins <= bStartMins) bEndMins += 24 * 60;
      const clientNorm = (bookingData.clienteNome || '').trim().toLowerCase();
      const teacherNorm = (bookingData.insegnanteNome || '').trim().toLowerCase();

      const uniqueDates = datesToBook.filter((d, dIdx) => {
        const sig = `${d}###${bookingData.salaId}###${bookingData.oraInizio}###${bookingData.oraFine}###${clientNorm}`;
        if (existingSignatures.has(sig)) return false;

        // Per le occorrenze future (dIdx > 0), verifichiamo che non collidano con sala occupata, cliente già impegnato o docente già impegnato
        if (dIdx > 0) {
          const hasConflict = prev.some((existing) => {
            if (existing.data !== d) return false;
            const eStartMins = timeToMinutes(existing.oraInizio);
            let eEndMins = timeToMinutes(existing.oraFine);
            if (eEndMins <= eStartMins) eEndMins += 24 * 60;
            const timeOverlap = bStartMins < eEndMins && bEndMins > eStartMins;
            if (!timeOverlap) return false;

            // 1. Sala già occupata da chiunque
            if (existing.salaId === bookingData.salaId) return true;

            // 2. Stesso cliente già prenotato in un'altra sala
            const existingClientNorm = (existing.clienteNome || '').trim().toLowerCase();
            if (clientNorm && existingClientNorm && (clientNorm === existingClientNorm || existingClientNorm.startsWith(clientNorm + ' ') || clientNorm.startsWith(existingClientNorm + ' '))) {
              return true;
            }

            // 3. Stesso docente già impegnato in un'altra sala
            if (bookingData.tipo === 'lezione' && existing.tipo === 'lezione') {
              const existingTeacherNorm = (existing.insegnanteNome || '').trim().toLowerCase();
              if (teacherNorm && existingTeacherNorm && teacherNorm === existingTeacherNorm) return true;
              if (bookingData.insegnanteId && existing.insegnanteId && bookingData.insegnanteId === existing.insegnanteId) return true;
            }

            return false;
          });

          if (hasConflict) return false;
        }

        return true;
      });

      if (uniqueDates.length === 0) {
        return prev;
      }

      const isLesson = isLessonBooking(bookingData);
      const newBookings: Booking[] = uniqueDates.map((dateStr, idx) => ({
        id: generateUUID(),
        clienteId: bookingData.clienteId,
        clienteNome: bookingData.clienteNome,
        salaId: bookingData.salaId,
        salaNome: bookingData.salaNome,
        tipo: isLesson ? 'lezione' : (bookingData.tipo || 'prove'),
        insegnanteId: isLesson ? bookingData.insegnanteId : undefined,
        insegnanteNome: isLesson ? bookingData.insegnanteNome : undefined,
        data: dateStr,
        oraInizio: bookingData.oraInizio,
        oraFine: bookingData.oraFine,
        durataOre: duration,
        ripetizioneSettimanale: isRecurring,
        gruppoRicorrenzaId: recurrenceId,
        settimaneRipetizione: datesToBook.length,
        recurrenceConfig: bookingData.recurrenceConfig,
        operatoreAssegnatoId: isLesson ? undefined : bookingData.operatoreAssegnatoId,
        operatoreAssegnatoNome: isLesson ? undefined : bookingData.operatoreAssegnatoNome,
        tariffaTotale: isLesson ? 0 : bookingData.tariffaTotale,
        sconto: isLesson ? 0 : (bookingData.sconto || 0),
        statoPagamento: isLesson ? 'pagato' : (idx === 0 ? bookingData.statoPagamento : 'da_saldare'),
        metodoPagamento: isLesson ? undefined : (idx === 0 ? bookingData.metodoPagamento : undefined),
        richiesteStrumentazione: bookingData.richiesteStrumentazione,
        note: bookingData.note,
      }));

      if (configured && newBookings.length > 0) {
        supabaseService.upsertMultipleBookings(newBookings).catch(console.error);
      }

      return deduplicateBookings([...prev, ...newBookings]);
    });
  };

  const updateBooking = (updated: Booking) => {
    const duration = calculateDurationHours(updated.oraInizio, updated.oraFine);
    const isLesson = isLessonBooking(updated);
    const finalBooking: Booking = {
      ...updated,
      durataOre: duration,
      tipo: isLesson ? 'lezione' : (updated.tipo || 'prove'),
      operatoreAssegnatoId: isLesson ? undefined : updated.operatoreAssegnatoId,
      operatoreAssegnatoNome: isLesson ? undefined : updated.operatoreAssegnatoNome,
    };
    setBookings((prev) =>
      prev.map((b) => (b.id === updated.id ? finalBooking : b))
    );
    if (configured) {
      supabaseService.upsertBooking(finalBooking).catch(console.error);
    }
  };

  const updateMultipleBookings = (updatedList: Booking[]) => {
    const finalBookings = updatedList.map((updated) => ({
      ...updated,
      durataOre: calculateDurationHours(updated.oraInizio, updated.oraFine),
    }));
    const idMap = new Map(finalBookings.map((b) => [b.id, b]));
    setBookings((prev) =>
      prev.map((b) => idMap.get(b.id) || b)
    );
    if (configured && finalBookings.length > 0) {
      supabaseService.upsertMultipleBookings(finalBookings).catch(console.error);
    }
  };

  const deleteBooking = (id: string, mode: DeleteRecurringMode | boolean = 'single') => {
    let targetGroup: string | undefined = undefined;
    let targetDate: string | undefined = undefined;
    const deleteMode: DeleteRecurringMode =
      typeof mode === 'boolean' ? (mode ? 'all' : 'single') : mode;

    setBookings((prev) => {
      const target = prev.find((b) => b.id === id);
      if (!target) return prev.filter((b) => b.id !== id);

      targetGroup = target.gruppoRicorrenzaId;
      targetDate = target.data;

      if (!targetGroup || deleteMode === 'single') {
        return prev.filter((b) => b.id !== id);
      }

      if (deleteMode === 'future') {
        // Elimina questo evento e tutti gli eventi futuri ripetuti della stessa serie
        return prev.filter(
          (b) => !(b.gruppoRicorrenzaId === targetGroup && b.data >= targetDate!)
        );
      }

      if (deleteMode === 'all') {
        // Elimina tutta la serie
        return prev.filter((b) => b.gruppoRicorrenzaId !== targetGroup);
      }

      return prev.filter((b) => b.id !== id);
    });

    if (configured) {
      if (deleteMode === 'future' && targetGroup && targetDate) {
        supabaseService.deleteBookingsByGroupFromDate(targetGroup, targetDate).catch(console.error);
      } else if (deleteMode === 'all' && targetGroup) {
        supabaseService.deleteBookingsByGroup(targetGroup).catch(console.error);
      } else {
        supabaseService.deleteBooking(id).catch(console.error);
      }
    }
  };

  const assignOperatorToBooking = (bookingId: string, operatorId?: string) => {
    const op = staff.find((s) => s.id === operatorId);
    let updatedBooking: Booking | undefined;
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id === bookingId) {
          updatedBooking = {
            ...b,
            operatoreAssegnatoId: operatorId || undefined,
            operatoreAssegnatoNome: op ? `${op.nome} ${op.cognome}` : undefined,
          };
          return updatedBooking;
        }
        return b;
      })
    );
    if (configured && updatedBooking) {
      supabaseService.upsertBooking(updatedBooking).catch(console.error);
    }
  };

  const runAutoAssignment = (monthFilter?: string): AutoAssignResult => {
    // Filter bookings without operator or all target bookings in timeframe (escludendo categoricamente le lezioni)
    const targetBookings = bookings.filter((b) => {
      const matchMonth = !monthFilter || b.data.startsWith(monthFilter);
      return matchMonth && !isLessonBooking(b) && !b.operatoreAssegnatoId;
    });

    const result = autoAssignOperators(targetBookings, bookings, staff, monthFilter);
    setBookings(result.updatedBookings);
    if (configured && result.assignedCount > 0) {
      supabaseService.upsertMultipleBookings(result.updatedBookings).catch(console.error);
    }
    return result;
  };

  // Expense CRUD
  const addExpense = (expenseData: Omit<Expense, 'id'>) => {
    const newExpense: Expense = {
      ...expenseData,
      id: generateUUID(),
    };
    setExpenses((prev) => [newExpense, ...prev]);
    if (configured) {
      supabaseService.upsertExpense(newExpense).catch(console.error);
    }
  };

  const updateExpense = (updated: Expense) => {
    setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    if (configured) {
      supabaseService.upsertExpense(updated).catch(console.error);
    }
  };

  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    if (configured) {
      supabaseService.deleteExpense(id).catch(console.error);
    }
  };

  // Income
  const addIncome = (incomeData: Omit<ManualIncome, 'id'>) => {
    const newIncome: ManualIncome = {
      ...incomeData,
      id: generateUUID(),
    };
    setIncomes((prev) => [newIncome, ...prev]);
    if (configured) {
      supabaseService.upsertIncome(newIncome).catch(console.error);
    }
  };

  const deleteIncome = (id: string) => {
    setIncomes((prev) => prev.filter((i) => i.id !== id));
    if (configured) {
      supabaseService.deleteIncome(id).catch(console.error);
    }
  };

  // Studio actions
  const updateStudioInfo = (info: Partial<StudioInfo>) => {
    const updated = { ...studioInfo, ...info };
    setStudioInfo(updated);
    if (configured) {
      supabaseService.upsertStudioInfo(updated).catch(console.error);
    }
  };

  const resetToDemoData = () => {
    setStudioInfo(DEFAULT_STUDIO_INFO);
    setRooms(INITIAL_ROOMS);
    setStaff(INITIAL_STAFF);
    setClients(INITIAL_CLIENTS);
    setBookings(INITIAL_BOOKINGS);
    setExpenses(INITIAL_EXPENSES);
    setIncomes([]);
    setShifts(INITIAL_SHIFTS);
    localStorage.removeItem(STORAGE_KEYS.STUDIO);
    localStorage.removeItem(STORAGE_KEYS.ROOMS);
    localStorage.removeItem(STORAGE_KEYS.STAFF);
    localStorage.removeItem(STORAGE_KEYS.CLIENTS);
    localStorage.removeItem(STORAGE_KEYS.BOOKINGS);
    localStorage.removeItem(STORAGE_KEYS.EXPENSES);
    localStorage.removeItem(STORAGE_KEYS.INCOMES);
    localStorage.removeItem(STORAGE_KEYS.SHIFTS);
  };

  const contextValue = useMemo<AppContextType>(
    () => ({
      studioInfo,
      updateStudioInfo,
      rooms,
      staff,
      clients,
      bookings,
      expenses,
      incomes,
      shifts,
      assignOperatorToShift,
      updateShift,
      deleteShift,
      autoAssignWeeklyShiftsAction,
      autoAssignMonthlyShiftsAction,
      isSupabaseConfigured: configured,
      isCloudConnected,
      isLoadingCloud,
      isAutoRefreshing,
      lastCloudRefresh,
      syncLocalToCloud,
      refreshFromCloud,
      reconnectSupabase,
      addRoom,
      updateRoom,
      deleteRoom,
      addStaff,
      updateStaff,
      deleteStaff,
      addClient,
      updateClient,
      deleteClient,
      addBooking,
      updateBooking,
      updateMultipleBookings,
      deleteBooking,
      assignOperatorToBooking,
      runAutoAssignment,
      addExpense,
      updateExpense,
      deleteExpense,
      addIncome,
      deleteIncome,
      resetToDemoData,
    }),
    [
      studioInfo,
      rooms,
      staff,
      clients,
      bookings,
      expenses,
      incomes,
      shifts,
      configured,
      isCloudConnected,
      isLoadingCloud,
      isAutoRefreshing,
      lastCloudRefresh,
    ]
  );

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
