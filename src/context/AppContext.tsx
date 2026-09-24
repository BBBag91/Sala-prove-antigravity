import React, { createContext, useContext, useEffect, useState } from 'react';
import { DEFAULT_STUDIO_INFO, INITIAL_BOOKINGS, INITIAL_CLIENTS, INITIAL_EXPENSES, INITIAL_ROOMS, INITIAL_STAFF } from '../data/initialData';
import { Booking, Client, Expense, ManualIncome, Room, StaffMember, StudioInfo } from '../types';
import { calculateDurationHours, formatDateToISO, parseISODate } from '../utils/dateUtils';
import { autoAssignOperators, AutoAssignResult } from '../utils/scheduler';

interface AppContextType {
  // Data
  studioInfo: StudioInfo;
  rooms: Room[];
  staff: StaffMember[];
  clients: Client[];
  bookings: Booking[];
  expenses: Expense[];
  incomes: ManualIncome[];

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
  addBooking: (booking: Omit<Booking, 'id' | 'durataOre'> & { repeatWeeks?: number }) => void;
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
    // Ensure book-1 has complete equipment description
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

  // Sync with localStorage (with safe write)
  useEffect(() => { safeLocalStorageSet(STORAGE_KEYS.STUDIO, studioInfo); }, [studioInfo]);
  useEffect(() => { safeLocalStorageSet(STORAGE_KEYS.ROOMS, rooms); }, [rooms]);
  useEffect(() => { safeLocalStorageSet(STORAGE_KEYS.STAFF, staff); }, [staff]);
  useEffect(() => { safeLocalStorageSet(STORAGE_KEYS.CLIENTS, clients); }, [clients]);
  useEffect(() => { safeLocalStorageSet(STORAGE_KEYS.BOOKINGS, bookings); }, [bookings]);
  useEffect(() => { safeLocalStorageSet(STORAGE_KEYS.EXPENSES, expenses); }, [expenses]);
  useEffect(() => { safeLocalStorageSet(STORAGE_KEYS.INCOMES, incomes); }, [incomes]);

  // Rooms CRUD
  const addRoom = (roomData: Omit<Room, 'id'>) => {
    const newRoom: Room = {
      ...roomData,
      id: `room-${Date.now()}`,
    };
    setRooms((prev) => [...prev, newRoom]);
  };

  const updateRoom = (updated: Room) => {
    setRooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    // Also sync room name in bookings
    setBookings((prev) =>
      prev.map((b) => (b.salaId === updated.id ? { ...b, salaNome: updated.nome } : b))
    );
  };

  const deleteRoom = (id: string) => {
    setRooms((prev) => prev.filter((r) => r.id !== id));
  };

  // Staff CRUD
  const addStaff = (memberData: Omit<StaffMember, 'id'>) => {
    const newMember: StaffMember = {
      ...memberData,
      id: `staff-${Date.now()}`,
    };
    setStaff((prev) => [...prev, newMember]);
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
  };

  // Client CRUD
  const addClient = (clientData: Omit<Client, 'id'>) => {
    const newClient: Client = {
      ...clientData,
      id: `cli-${Date.now()}`,
    };
    setClients((prev) => [...prev, newClient]);
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
  };

  const deleteClient = (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
  };

  // Booking CRUD with recurrence support
  const addBooking = (
    bookingData: Omit<Booking, 'id' | 'durataOre'> & { repeatWeeks?: number }
  ) => {
    const duration = calculateDurationHours(bookingData.oraInizio, bookingData.oraFine);
    const recurrenceId = bookingData.ripetizioneSettimanale
      ? `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
      : undefined;

    const repeatWeeks = bookingData.ripetizioneSettimanale ? bookingData.repeatWeeks || 4 : 1;
    const newBookings: Booking[] = [];

    const baseDate = parseISODate(bookingData.data);

    for (let i = 0; i < repeatWeeks; i++) {
      const occurrenceDate = new Date(baseDate);
      occurrenceDate.setDate(baseDate.getDate() + i * 7);
      const dateStr = formatDateToISO(occurrenceDate);

      const newBooking: Booking = {
        id: `book-${Date.now()}-${i}`,
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
        ripetizioneSettimanale: bookingData.ripetizioneSettimanale,
        gruppoRicorrenzaId: recurrenceId,
        settimaneRipetizione: repeatWeeks,
        operatoreAssegnatoId: bookingData.operatoreAssegnatoId,
        operatoreAssegnatoNome: bookingData.operatoreAssegnatoNome,
        tariffaTotale: bookingData.tariffaTotale,
        statoPagamento: bookingData.statoPagamento,
        metodoPagamento: bookingData.metodoPagamento,
        richiesteStrumentazione: bookingData.richiesteStrumentazione,
        note: bookingData.note,
      };

      newBookings.push(newBooking);
    }

    setBookings((prev) => [...prev, ...newBookings]);
  };

  const updateBooking = (updated: Booking) => {
    const duration = calculateDurationHours(updated.oraInizio, updated.oraFine);
    setBookings((prev) =>
      prev.map((b) => (b.id === updated.id ? { ...updated, durataOre: duration } : b))
    );
  };

  const deleteBooking = (id: string, deleteAllRecurring: boolean = false) => {
    // Use functional updater to avoid stale closure over 'bookings'
    setBookings((prev) => {
      if (!deleteAllRecurring) {
        return prev.filter((b) => b.id !== id);
      }
      const target = prev.find((b) => b.id === id);
      if (target?.gruppoRicorrenzaId) {
        return prev.filter((b) => b.gruppoRicorrenzaId !== target.gruppoRicorrenzaId);
      }
      return prev.filter((b) => b.id !== id);
    });
  };

  const assignOperatorToBooking = (bookingId: string, operatorId?: string) => {
    const op = staff.find((s) => s.id === operatorId);
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              operatoreAssegnatoId: operatorId || undefined,
              operatoreAssegnatoNome: op ? `${op.nome} ${op.cognome}` : undefined,
            }
          : b
      )
    );
  };

  const runAutoAssignment = (monthFilter?: string): AutoAssignResult => {
    // Filter bookings without operator or all target bookings in timeframe
    const targetBookings = bookings.filter((b) => {
      const matchMonth = !monthFilter || b.data.startsWith(monthFilter);
      return matchMonth && !b.operatoreAssegnatoId;
    });

    const result = autoAssignOperators(targetBookings, bookings, staff, monthFilter);
    setBookings(result.updatedBookings);
    return result;
  };

  // Expense CRUD
  const addExpense = (expenseData: Omit<Expense, 'id'>) => {
    const newExpense: Expense = {
      ...expenseData,
      id: `exp-${Date.now()}`,
    };
    setExpenses((prev) => [newExpense, ...prev]);
  };

  const updateExpense = (updated: Expense) => {
    setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  };

  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  // Income
  const addIncome = (incomeData: Omit<ManualIncome, 'id'>) => {
    const newIncome: ManualIncome = {
      ...incomeData,
      id: `inc-${Date.now()}`,
    };
    setIncomes((prev) => [newIncome, ...prev]);
  };

  const deleteIncome = (id: string) => {
    setIncomes((prev) => prev.filter((i) => i.id !== id));
  };

  // Studio actions
  const updateStudioInfo = (info: Partial<StudioInfo>) => {
    setStudioInfo((prev) => ({ ...prev, ...info }));
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
