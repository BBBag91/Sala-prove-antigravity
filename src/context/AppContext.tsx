import React, { createContext, useContext, useEffect, useState } from 'react';
import { DEFAULT_STUDIO_INFO, INITIAL_BOOKINGS, INITIAL_CLIENTS, INITIAL_EXPENSES, INITIAL_ROOMS, INITIAL_STAFF } from '../data/initialData';
import { Booking, Client, Expense, ManualIncome, Room, StaffMember, StudioInfo, RecurrenceConfig } from '../types';
import { calculateDurationHours, formatDateToISO, parseISODate, generateRecurrenceDates } from '../utils/dateUtils';
import { autoAssignOperators, AutoAssignResult } from '../utils/scheduler';
import { isSupabaseConfigured, setSupabaseCredentials, getSupabaseUrl, getSupabaseKey, supabase } from '../lib/supabase';
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
  addStaff: (member: Omit<StaffMember, 'id'>) => void;
  updateStaff: (member: StaffMember) => void;
  deleteStaff: (id: string) => void;

  // Client actions
  addClient: (client: Omit<Client, 'id'>) => void;
  updateClient: (client: Client) => void;
  deleteClient: (id: string) => void;

  // Booking actions
  addBooking: (booking: Omit<Booking, 'id' | 'durataOre'> & { repeatWeeks?: number; recurrenceConfig?: RecurrenceConfig }) => void;
  updateBooking: (booking: Booking) => void;
  deleteBooking: (id: string, deleteAllRecurring?: boolean) => void;
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
          if (remote.staff.length > 0) setStaff(remote.staff);
          if (remote.clients.length > 0) setClients(remote.clients);
          if (remote.bookings.length > 0) setBookings(remote.bookings);
          if (remote.expenses.length > 0) setExpenses(remote.expenses);
          if (remote.incomes.length > 0) setIncomes(remote.incomes);
          if (remote.studioInfo) setStudioInfo(remote.studioInfo);
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
        if (remote.staff.length > 0) setStaff(remote.staff);
        if (remote.clients.length > 0) setClients(remote.clients);
        if (remote.bookings) setBookings(remote.bookings);
        if (remote.expenses.length > 0) setExpenses(remote.expenses);
        if (remote.incomes.length > 0) setIncomes(remote.incomes);
        if (remote.studioInfo) setStudioInfo(remote.studioInfo);
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
        .channel('realtime:bookings-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bookings' },
          (payload) => {
            console.log('[Supabase Realtime] Modifica prenotazioni rilevata da altro client:', payload);
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
  const addStaff = (memberData: Omit<StaffMember, 'id'>) => {
    const newMember: StaffMember = {
      ...memberData,
      id: `staff-${Date.now()}`,
    };
    setStaff((prev) => [...prev, newMember]);
    if (configured) {
      supabaseService.upsertStaff(newMember).catch(console.error);
    }
  };

  const updateStaff = (updated: StaffMember) => {
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
      supabaseService.upsertStaff(updated).catch(console.error);
    }
  };

  const deleteStaff = (id: string) => {
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
      supabaseService.deleteStaff(id).catch(console.error);
    }
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

    const newBookings: Booking[] = datesToBook.map((dateStr, idx) => ({
      id: `book-${Date.now()}-${idx}`,
      clienteId: bookingData.clienteId,
      clienteNome: bookingData.clienteNome,
      salaId: bookingData.salaId,
      salaNome: bookingData.salaNome,
      tipo: bookingData.tipo,
      insegnanteId: bookingData.insegnanteId,
      insegnanteNome: bookingData.insegnanteNome,
      data: dateStr,
      oraInizio: bookingData.oraInizio,
      oraFine: bookingData.oraFine,
      durataOre: duration,
      ripetizioneSettimanale: isRecurring,
      gruppoRicorrenzaId: recurrenceId,
      settimaneRipetizione: datesToBook.length,
      recurrenceConfig: bookingData.recurrenceConfig,
      operatoreAssegnatoId: bookingData.operatoreAssegnatoId,
      operatoreAssegnatoNome: bookingData.operatoreAssegnatoNome,
      tariffaTotale: bookingData.tariffaTotale,
      sconto: bookingData.sconto,
      statoPagamento: bookingData.statoPagamento,
      metodoPagamento: bookingData.metodoPagamento,
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
    const finalBooking = { ...updated, durataOre: duration };
    setBookings((prev) =>
      prev.map((b) => (b.id === updated.id ? finalBooking : b))
    );
    if (configured) {
      supabaseService.upsertBooking(finalBooking).catch(console.error);
    }
  };

  const deleteBooking = (id: string, deleteAllRecurring: boolean = false) => {
    let targetGroup: string | undefined = undefined;
    setBookings((prev) => {
      if (!deleteAllRecurring) {
        return prev.filter((b) => b.id !== id);
      }
      const target = prev.find((b) => b.id === id);
      targetGroup = target?.gruppoRicorrenzaId;
      if (targetGroup) {
        return prev.filter((b) => b.gruppoRicorrenzaId !== targetGroup);
      }
      return prev.filter((b) => b.id !== id);
    });

    if (configured) {
      if (deleteAllRecurring && targetGroup) {
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
    // Filter bookings without operator or all target bookings in timeframe
    const targetBookings = bookings.filter((b) => {
      const matchMonth = !monthFilter || b.data.startsWith(monthFilter);
      return matchMonth && !b.operatoreAssegnatoId;
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
    localStorage.removeItem(STORAGE_KEYS.STUDIO);
    localStorage.removeItem(STORAGE_KEYS.ROOMS);
    localStorage.removeItem(STORAGE_KEYS.STAFF);
    localStorage.removeItem(STORAGE_KEYS.CLIENTS);
    localStorage.removeItem(STORAGE_KEYS.BOOKINGS);
    localStorage.removeItem(STORAGE_KEYS.EXPENSES);
    localStorage.removeItem(STORAGE_KEYS.INCOMES);
  };

  return (
    <AppContext.Provider
      value={{
        studioInfo,
        updateStudioInfo,
        rooms,
        staff,
        clients,
        bookings,
        expenses,
        incomes,
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
        deleteBooking,
        assignOperatorToBooking,
        runAutoAssignment,
        addExpense,
        updateExpense,
        deleteExpense,
        addIncome,
        deleteIncome,
        resetToDemoData,
      }}
    >
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
