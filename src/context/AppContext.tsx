import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { DEFAULT_STUDIO_INFO, INITIAL_BOOKINGS, INITIAL_CLIENTS, INITIAL_EXPENSES, INITIAL_ROOMS, INITIAL_STAFF, INITIAL_SHIFTS } from '../data/initialData';
import { Booking, Client, Expense, ManualIncome, Room, StaffMember, StudioInfo, RecurrenceConfig, WorkShift, DeleteRecurringMode, isLessonBooking } from '../types';
import { calculateDurationHours, formatDateToISO, parseISODate, generateRecurrenceDates, timeToMinutes } from '../utils/dateUtils';
import { autoAssignOperators, AutoAssignResult } from '../utils/scheduler';
import { computeDailyShifts, autoAssignWeeklyShifts, autoAssignMonthlyShifts } from '../utils/shiftUtils';
import { isSupabaseConfigured, setSupabaseCredentials, supabase } from '../lib/supabase';
import { supabaseService } from '../services/supabaseService';

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
  addClient: (client: Omit<Client, 'id'>) => void;
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

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [studioInfo, setStudioInfo] = useState<StudioInfo>(() =>
    safeLocalStorageGet(STORAGE_KEYS.STUDIO, DEFAULT_STUDIO_INFO)
  );

  const [rooms, setRooms] = useState<Room[]>(() =>
    safeLocalStorageGet(STORAGE_KEYS.ROOMS, INITIAL_ROOMS)
  );

  const [staff, setStaff] = useState<StaffMember[]>(() =>
    safeLocalStorageGet(STORAGE_KEYS.STAFF, INITIAL_STAFF)
  );

  const [clients, setClients] = useState<Client[]>(() =>
    safeLocalStorageGet(STORAGE_KEYS.CLIENTS, INITIAL_CLIENTS)
  );

  const [bookings, setBookings] = useState<Booking[]>(() => {
    const parsed = safeLocalStorageGet<Booking[]>(STORAGE_KEYS.BOOKINGS, INITIAL_BOOKINGS);
    return parsed.map((b) => {
      if (b.id === 'book-1' && !b.richiesteStrumentazione?.includes('Batteria 5 pezzi')) {
        return {
          ...b,
          richiesteStrumentazione:
            'Batteria 5 pezzi completa con set piatti; 2 ampli chitarra valvolari (Marshall/Fender); 1 testata per basso; 3 microfoni voce SM58 con aste; 1 cavo Jack ausiliario per sampler; Set piatti completo e 3 microfoni SM58 posizionati.',
        };
      }
      return b;
    });
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
          if (remote.rooms.length > 0) setRooms(remote.rooms);
          if (remote.staff.length > 0) {
            setStaff((prevLocal) => {
              const remoteIds = new Set(remote.staff.map((s) => s.id));
              const pendingLocal = prevLocal.filter((localMember) => !remoteIds.has(localMember.id));
              return pendingLocal.length > 0 ? [...remote.staff, ...pendingLocal] : remote.staff;
            });
          }
          if (remote.clients.length > 0) setClients(remote.clients);
          if (remote.bookings.length > 0) setBookings(remote.bookings);
          if (remote.expenses.length > 0) setExpenses(remote.expenses);
          if (remote.incomes.length > 0) setIncomes(remote.incomes);
          if (remote.studioInfo) {
            setStudioInfo((prev) => {
              if (!remote.studioInfo.whatsappConfig && prev?.whatsappConfig) {
                const merged = { ...remote.studioInfo, whatsappConfig: prev.whatsappConfig };
                supabaseService.upsertStudioInfo(merged).catch(console.error);
                return merged;
              }
              return remote.studioInfo;
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
        if (remote.rooms.length > 0) setRooms(remote.rooms);
        if (remote.staff.length > 0) {
          setStaff((prevLocal) => {
            const remoteIds = new Set(remote.staff.map((s) => s.id));
            const pendingLocal = prevLocal.filter((localMember) => !remoteIds.has(localMember.id));
            return pendingLocal.length > 0 ? [...remote.staff, ...pendingLocal] : remote.staff;
          });
        }
        if (remote.bookings) {
          const sanitized = remote.bookings.map((b) => {
            if (isLessonBooking(b)) {
              return {
                ...b,
                tipo: 'lezione' as const,
                operatoreAssegnatoId: undefined,
                operatoreAssegnatoNome: undefined,
              };
            }
            return b;
          });
          setBookings(sanitized);
        }
        if (remote.expenses.length > 0) setExpenses(remote.expenses);
        if (remote.incomes.length > 0) setIncomes(remote.incomes);
        if (remote.studioInfo) {
          setStudioInfo((prev) => {
            if (!remote.studioInfo.whatsappConfig && prev?.whatsappConfig) {
              const merged = { ...remote.studioInfo, whatsappConfig: prev.whatsappConfig };
              supabaseService.upsertStudioInfo(merged).catch(console.error);
              return merged;
            }
            return remote.studioInfo;
          });
        }
        if (remote.shifts && remote.shifts.length > 0) setShifts(remote.shifts);
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

  // Supabase Realtime: aggiornamento automatico istantaneo appena un utente aggiunge/modifica una prenotazione
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
          { event: '*', schema: 'public', table: 'shifts' },
          (payload) => {
            console.log('[Supabase Realtime] Modifica turni rilevata da altro client:', payload);
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
      id: `room-${Date.now()}`,
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
      id: `staff-${Date.now()}`,
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
    const existing = shifts.find((s) => s.data === date && s.turnoNumero === turnoNumero);
    const op = operatorId ? staff.find((st) => st.id === operatorId) : undefined;
    const opName = op ? `${op.nome} ${op.cognome}` : (customOperatorName?.trim() || undefined);
    const effectiveOpId = operatorId || (customOperatorName?.trim() ? (existing?.operatoreId || `manual-op-${Date.now()}`) : undefined);

    const baseStart = turnoNumero === 1 ? '17:00' : '20:00';
    const baseEnd = turnoNumero === 1 ? '20:00' : '23:00';

    const updatedShift: WorkShift = {
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

    const newShifts = shifts.filter((s) => !(s.data === date && s.turnoNumero === turnoNumero));
    newShifts.push(updatedShift);
    setShifts(newShifts);
    supabaseService.upsertShift(updatedShift);

    // Se richiesto, applica l'operatore anche a tutte le prenotazioni in questa fascia
    if (syncToBookings && opName) {
      const dayBookings = bookings.filter((b) => b.data === date);
      const [c1, c2] = computeDailyShifts(date, dayBookings, newShifts, staff);
      const computed = turnoNumero === 1 ? c1 : c2;
      const shiftStartMins = timeToMinutes(computed.oraInizio);
      const shiftEndMins = timeToMinutes(computed.oraFine);

      let updatedAnyBooking = false;
      const updatedBookings = bookings.map((b) => {
        if (b.data !== date) return b;
        // Non assegnare MAI l'operatore di presidio alle lezioni (gestite dal docente)
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

        // Se la prenotazione (prova musicale) si sovrappone al turno
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
          .filter((b) => b.data === date && b.operatoreAssegnatoNome === opName)
          .forEach((b) => supabaseService.upsertBooking(b));
      }
    }
  };

  const updateShift = (shift: WorkShift) => {
    const newShifts = shifts.filter((s) => s.id !== shift.id && !(s.data === shift.data && s.turnoNumero === shift.turnoNumero));
    newShifts.push(shift);
    setShifts(newShifts);
    supabaseService.upsertShift(shift);
  };

  const deleteShift = (id: string) => {
    setShifts((prev) => prev.filter((s) => s.id !== id));
    supabaseService.deleteShift(id);
  };

  const autoAssignWeeklyShiftsAction = (weekDates: string[]) => {
    const result = autoAssignWeeklyShifts(weekDates, shifts, bookings, staff);
    setShifts(result.updatedShifts);
    supabaseService.upsertMultipleShifts(result.updatedShifts);
    return { assignedCount: result.assignedCount, unassignedCount: result.unassignedCount };
  };

  const autoAssignMonthlyShiftsAction = (monthStr: string, forceReassign?: boolean) => {
    const result = autoAssignMonthlyShifts(monthStr, shifts, bookings, staff, forceReassign);
    setShifts(result.updatedShifts);
    supabaseService.upsertMultipleShifts(result.updatedShifts);
    return { assignedCount: result.assignedCount, unassignedCount: result.unassignedCount };
  };

  // Client CRUD
  const addClient = (clientData: Omit<Client, 'id'>) => {
    const newClient: Client = {
      ...clientData,
      id: `cli-${Date.now()}`,
    };
    setClients((prev) => [...prev, newClient]);
    if (configured) {
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
              clienteNome: `${updated.nome} ${updated.cognome}${
                updated.gruppoBand ? ` (${updated.gruppoBand})` : ''
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

  // Booking CRUD with recurrence support
  const addBooking = (
    bookingData: Omit<Booking, 'id' | 'durataOre'> & {
      repeatWeeks?: number;
      recurrenceConfig?: RecurrenceConfig;
    }
  ) => {
    const duration = calculateDurationHours(bookingData.oraInizio, bookingData.oraFine);

    let datesToBook: string[] = [bookingData.data];
    let isRecurring = false;
    let recurrenceId: string | undefined = undefined;

    if (bookingData.recurrenceConfig && bookingData.recurrenceConfig.attiva) {
      datesToBook = generateRecurrenceDates(bookingData.data, bookingData.recurrenceConfig);
      isRecurring = datesToBook.length > 1;
      if (isRecurring) {
        recurrenceId = `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
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
        recurrenceId = `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      }
    }

    const isLesson = isLessonBooking(bookingData);

    const newBookings: Booking[] = datesToBook.map((dateStr, idx) => ({
      id: `book-${Date.now()}-${idx}`,
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

    setBookings((prev) => [...prev, ...newBookings]);
    if (configured) {
      supabaseService.upsertMultipleBookings(newBookings).catch(console.error);
    }
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
      id: `exp-${Date.now()}`,
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
      id: `inc-${Date.now()}`,
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
