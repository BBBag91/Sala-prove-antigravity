import React, { useEffect, useState, useMemo } from 'react';
import { X, Calendar, AlertCircle, AlertTriangle, CheckCircle2, Check, RefreshCw, Music2, GraduationCap, Edit3, Users, Trash2, MessageSquare } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Booking, BookingType, PaymentMethod, PaymentStatus, RecurrenceConfig, DeleteRecurringMode } from '../types';
import { DeleteRecurringBookingModal } from './DeleteRecurringBookingModal';
import { PastBookingConfirmModal } from './PastBookingConfirmModal';
import { calculateDurationHours, formatDateToISO, getRecurrenceSummary, parseISODate, timeToMinutes, minutesToTime, getHolidayOrSundayInfo, generateRecurrenceDates } from '../utils/dateUtils';
import { RecurrenceModal } from './RecurrenceModal';
import { SmartTimePicker } from './SmartTimePicker';
import { handleNumericFocus, handleNumericClick, handleNumericBlur } from '../utils/inputUtils';
import { checkOperatorsCoverageForTimeSlot } from '../utils/scheduler';
import { RoomFloorPlanSelector } from './RoomFloorPlanSelector';
import { BookingWhatsAppModal } from './BookingWhatsAppModal';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  initialStartTime?: string;
  initialRoomId?: string;
  initialType?: BookingType;
  bookingToEdit?: Booking | null;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  initialDate,
  initialStartTime,
  initialRoomId,
  initialType,
  bookingToEdit,
}) => {
  const { clients, rooms, staff, bookings, addBooking, updateBooking, updateMultipleBookings, deleteBooking } = useApp();
  const { isAdmin, isTeacher, user } = useAuth();

  // Scheda staff collegata al profilo utente se è un insegnante
  const currentTeacherStaff = useMemo(() => {
    if (!user) return null;
    return (
      staff.find((s) => user.staffId && s.id === user.staffId) ||
      staff.find((s) => user.email && s.email && s.email.toLowerCase() === user.email.toLowerCase()) ||
      staff.find((s) => `${s.nome} ${s.cognome}`.trim().toLowerCase() === user.nome.trim().toLowerCase()) ||
      null
    );
  }, [user, staff]);

  // Se l'utente è un insegnante autenticato e non admin, assegna automaticamente se stesso
  const isAutoTeacher = Boolean(isTeacher && !isAdmin && currentTeacherStaff);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clienteId, setClienteId] = useState(() => bookingToEdit?.clienteId || '');
  const [isManualClient, setIsManualClient] = useState(() => {
    if (bookingToEdit) {
      return !clients.some((c) => c.id === bookingToEdit.clienteId) && Boolean(bookingToEdit.clienteNome);
    }
    return true;
  });
  const [manualClientName, setManualClientName] = useState(() => {
    if (bookingToEdit) {
      const isExistingClient = clients.some((c) => c.id === bookingToEdit.clienteId);
      return !isExistingClient && bookingToEdit.clienteNome ? bookingToEdit.clienteNome : '';
    }
    return '';
  });
  const [isRecurringDeleteOpen, setIsRecurringDeleteOpen] = useState(false);
  const [salaId, setSalaId] = useState(() => bookingToEdit?.salaId || initialRoomId || '');
  const [tipo, setTipo] = useState<BookingType>(() => {
    if (bookingToEdit?.tipo) return bookingToEdit.tipo;
    if (initialType) return initialType;
    if (isAutoTeacher) return 'lezione';
    return 'prove';
  });
  const [insegnanteId, setInsegnanteId] = useState(() => {
    if (bookingToEdit?.insegnanteId) return bookingToEdit.insegnanteId;
    if (isAutoTeacher && currentTeacherStaff) return currentTeacherStaff.id;
    return '';
  });
  const [data, setData] = useState(() => bookingToEdit?.data || initialDate || formatDateToISO(new Date()));
  const [oraInizio, setOraInizio] = useState(() => bookingToEdit?.oraInizio || initialStartTime || '18:00');
  const [oraFine, setOraFine] = useState(() => {
    if (bookingToEdit?.oraFine) return bookingToEdit.oraFine;
    const start = initialStartTime || '18:00';
    const startM = timeToMinutes(start);
    const endM = Math.min(24 * 60, startM + (initialType === 'lezione' ? 60 : 120));
    return minutesToTime(endM);
  });
  const [ripetizioneSettimanale, setRipetizioneSettimanale] = useState(() => Boolean(bookingToEdit?.ripetizioneSettimanale));
  const [repeatOption, setRepeatOption] = useState<string>(() => {
    if (bookingToEdit?.recurrenceConfig?.tipoFine === 'per_sempre') return 'per_sempre';
    if (bookingToEdit?.recurrenceConfig?.conteggioOccorrenze) {
      const occ = bookingToEdit.recurrenceConfig.conteggioOccorrenze;
      return [2, 4, 8, 12, 24, 52].includes(occ) ? String(occ) : 'personalizzata';
    }
    if (bookingToEdit?.ripetizioneSettimanale) {
      const weeks = bookingToEdit.settimaneRipetizione || 4;
      return [2, 4, 8, 12, 24, 52].includes(weeks) ? String(weeks) : 'personalizzata';
    }
    return 'per_sempre';
  });
  const [repeatWeeks, setRepeatWeeks] = useState(() => bookingToEdit?.settimaneRipetizione || 4);
  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);
  const [recurrenceConfig, setRecurrenceConfig] = useState<RecurrenceConfig>(() => {
    if (bookingToEdit?.recurrenceConfig) return bookingToEdit.recurrenceConfig;
    const dIndex = parseISODate(bookingToEdit?.data || initialDate || formatDateToISO(new Date())).getDay();
    return {
      attiva: Boolean(bookingToEdit?.ripetizioneSettimanale),
      frequenza: 'settimanale',
      intervallo: 1,
      giorniSettimana: [dIndex],
      tipoFine: 'per_sempre',
      conteggioOccorrenze: bookingToEdit?.settimaneRipetizione || 4,
    };
  });
  const [tariffaBase, setTariffaBase] = useState<string | number>(() => {
    if (bookingToEdit) return (bookingToEdit.tariffaTotale || 0) + (bookingToEdit.sconto || 0);
    return 0;
  });
  const [sconto, setSconto] = useState<string | number>(() => bookingToEdit?.sconto || 0);
  const [tariffaTotale, setTariffaTotale] = useState<string | number>(() => bookingToEdit?.tariffaTotale || 0);
  const [customTariffa, setCustomTariffa] = useState(() => Boolean(bookingToEdit));
  const [statoPagamento, setStatoPagamento] = useState<PaymentStatus>(() => bookingToEdit?.statoPagamento || 'da_saldare');
  const [metodoPagamento, setMetodoPagamento] = useState<PaymentMethod>(() => bookingToEdit?.metodoPagamento || 'pos');
  const [richiesteStrumentazione, setRichiesteStrumentazione] = useState(() => bookingToEdit?.richiesteStrumentazione || '');
  const [note, setNote] = useState(() => bookingToEdit?.note || '');
  const [isPastConfirmOpen, setIsPastConfirmOpen] = useState(false);
  const [isWhatsAppReminderOpen, setIsWhatsAppReminderOpen] = useState(false);

  // Verifica se la data o l'orario della prenotazione è nel passato rispetto ad adesso
  const isEventInPast = useMemo(() => {
    const todayISO = formatDateToISO(new Date());
    if (data < todayISO) return true;
    if (data === todayISO) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const endMin = timeToMinutes(oraFine || oraInizio);
      return endMin <= nowMinutes;
    }
    return false;
  }, [data, oraInizio, oraFine]);

  // Pre-fill on open/edit
  useEffect(() => {
    if (bookingToEdit) {
      const isExistingClient = clients.some((c) => c.id === bookingToEdit.clienteId);
      if (!isExistingClient && bookingToEdit.clienteNome) {
        setIsManualClient(true);
        setManualClientName(bookingToEdit.clienteNome);
        setClienteId(bookingToEdit.clienteId);
      } else {
        setIsManualClient(false);
        setClienteId(bookingToEdit.clienteId);
        setManualClientName('');
      }
      setSalaId(bookingToEdit.salaId);
      setTipo(bookingToEdit.tipo);
      setInsegnanteId(bookingToEdit.insegnanteId || '');
      setData(bookingToEdit.data);
      setOraInizio(bookingToEdit.oraInizio);
      setOraFine(bookingToEdit.oraFine);
      setRipetizioneSettimanale(bookingToEdit.ripetizioneSettimanale);
      setRepeatWeeks(bookingToEdit.settimaneRipetizione || 4);
      if (bookingToEdit.recurrenceConfig) {
        setRecurrenceConfig(bookingToEdit.recurrenceConfig);
        if (bookingToEdit.recurrenceConfig.tipoFine === 'per_sempre') {
          setRepeatOption('per_sempre');
        } else if (bookingToEdit.recurrenceConfig.conteggioOccorrenze) {
          const occ = bookingToEdit.recurrenceConfig.conteggioOccorrenze;
          setRepeatOption([2, 4, 8, 12, 24, 52].includes(occ) ? String(occ) : 'personalizzata');
        } else {
          setRepeatOption('personalizzata');
        }
      } else if (bookingToEdit.ripetizioneSettimanale) {
        const dIndex = parseISODate(bookingToEdit.data).getDay();
        const weeks = bookingToEdit.settimaneRipetizione || 4;
        setRepeatOption([2, 4, 8, 12, 24, 52].includes(weeks) ? String(weeks) : 'personalizzata');
        setRecurrenceConfig({
          attiva: true,
          frequenza: 'settimanale',
          intervallo: 1,
          giorniSettimana: [dIndex],
          tipoFine: 'conteggio',
          conteggioOccorrenze: weeks,
        });
      } else {
        const dIndex = parseISODate(bookingToEdit.data).getDay();
        setRepeatOption('per_sempre');
        setRecurrenceConfig({
          attiva: false,
          frequenza: 'settimanale',
          intervallo: 1,
          giorniSettimana: [dIndex],
          tipoFine: 'per_sempre',
          conteggioOccorrenze: 4,
        });
      }
      const disc = bookingToEdit.sconto || 0;
      setSconto(disc);
      setTariffaTotale(bookingToEdit.tariffaTotale);
      setTariffaBase((bookingToEdit.tariffaTotale || 0) + disc);
      setCustomTariffa(true);
      setStatoPagamento(bookingToEdit.statoPagamento);
      setMetodoPagamento(bookingToEdit.metodoPagamento || 'pos');
      setRichiesteStrumentazione(bookingToEdit.richiesteStrumentazione || '');
      setNote(bookingToEdit.note || '');
    } else {
      const defaultDate = initialDate || formatDateToISO(new Date());
      const dIndex = parseISODate(defaultDate).getDay();
      const defaultTipo = initialType || (isAutoTeacher ? 'lezione' : 'prove');
      setIsManualClient(true);
      setManualClientName('');
      setClienteId('');
      setSalaId(initialRoomId || '');
      setTipo(defaultTipo);
      setInsegnanteId(isAutoTeacher && currentTeacherStaff ? currentTeacherStaff.id : '');
      const start = initialStartTime || '18:00';
      const startM = timeToMinutes(start);
      const durationM = defaultTipo === 'lezione' ? 60 : 120;
      const endM = Math.min(24 * 60, startM + durationM);
      const end = minutesToTime(endM);

      setData(defaultDate);
      setOraInizio(start);
      setOraFine(end);
      setRipetizioneSettimanale(false);
      setRepeatOption('per_sempre');
      setRepeatWeeks(4);
      setRecurrenceConfig({
        attiva: false,
        frequenza: 'settimanale',
        intervallo: 1,
        giorniSettimana: [dIndex],
        tipoFine: 'per_sempre',
        conteggioOccorrenze: 4,
      });
      setSconto(0);
      setCustomTariffa(false);
      setStatoPagamento('da_saldare');
      setMetodoPagamento('pos');
      setRichiesteStrumentazione('');
      setNote('');
    }
  }, [bookingToEdit, initialDate, initialStartTime, initialRoomId, initialType, isOpen, clients, rooms, isAutoTeacher, currentTeacherStaff]);

  // Se l'utente è un profilo insegnante e seleziona 'lezione', mantiene sempre il proprio ID docente
  useEffect(() => {
    if (tipo === 'lezione' && isAutoTeacher && currentTeacherStaff) {
      if (insegnanteId !== currentTeacherStaff.id) {
        setInsegnanteId(currentTeacherStaff.id);
      }
    }
  }, [tipo, isAutoTeacher, currentTeacherStaff, insegnanteId]);

  const handleToggleRipetizione = (checked: boolean) => {
    setRipetizioneSettimanale(checked);
    const currentDay = parseISODate(data).getDay();
    const days = recurrenceConfig.giorniSettimana.length > 0 ? recurrenceConfig.giorniSettimana : [currentDay];

    if (checked) {
      if (repeatOption === 'per_sempre') {
        setRepeatWeeks(52);
        setRecurrenceConfig({
          attiva: true,
          frequenza: 'settimanale',
          intervallo: 1,
          tipoFine: 'per_sempre',
          giorniSettimana: days,
        });
      } else if (repeatOption === 'personalizzata') {
        setIsRecurrenceModalOpen(true);
      } else {
        const num = Number(repeatOption) || 4;
        setRepeatWeeks(num);
        setRecurrenceConfig({
          attiva: true,
          frequenza: 'settimanale',
          intervallo: 1,
          tipoFine: 'conteggio',
          conteggioOccorrenze: num,
          giorniSettimana: days,
        });
      }
    } else {
      setRecurrenceConfig((prev) => ({ ...prev, attiva: false }));
    }
  };

  const handleRepeatOptionChange = (opt: string) => {
    setRepeatOption(opt);
    const currentDay = parseISODate(data).getDay();
    const days = recurrenceConfig.giorniSettimana.length > 0 ? recurrenceConfig.giorniSettimana : [currentDay];

    if (opt === 'personalizzata') {
      setIsRecurrenceModalOpen(true);
      return;
    }

    if (opt === 'per_sempre') {
      setRepeatWeeks(52);
      setRecurrenceConfig({
        attiva: true,
        frequenza: 'settimanale',
        intervallo: 1,
        tipoFine: 'per_sempre',
        giorniSettimana: days,
      });
    } else {
      const num = Number(opt) || 4;
      setRepeatWeeks(num);
      setRecurrenceConfig({
        attiva: true,
        frequenza: 'settimanale',
        intervallo: 1,
        tipoFine: 'conteggio',
        conteggioOccorrenze: num,
        giorniSettimana: days,
      });
    }
  };

  const handleDateChange = (newDate: string) => {
    setData(newDate);
    try {
      const newDayIndex = parseISODate(newDate).getDay();
      setRecurrenceConfig((prev) => {
        if (!prev.attiva) {
          return {
            ...prev,
            giorniSettimana: [newDayIndex],
          };
        }
        return prev;
      });
    } catch {
      // ignore
    }
  };

  // When client changes, automatically copy default gear description
  const handleClientChange = (cId: string) => {
    setClienteId(cId);
    const client = clients.find((c) => c.id === cId);
    if (client && client.descrizioneStrumentazione && !bookingToEdit) {
      setRichiesteStrumentazione(client.descrizioneStrumentazione);
    }
  };

  // Gestione selezione tipo prenotazione con impostazione automatica durata (1 ora per lezioni, 2 ore per prove)
  const handleSelectTipo = (newTipo: BookingType) => {
    setTipo(newTipo);
    if (newTipo === 'lezione') {
      // Quando si seleziona 'lezione', imposta automaticamente 1 ora di lezione
      const startMin = timeToMinutes(oraInizio);
      setOraFine(minutesToTime(startMin + 60));
    } else if (newTipo === 'prove') {
      // Se si torna a 'prove' ed era impostata 1 ora, reimposta la durata standard delle prove a 2 ore
      const currentDuration = calculateDurationHours(oraInizio, oraFine);
      if (currentDuration === 1) {
        const startMin = timeToMinutes(oraInizio);
        setOraFine(minutesToTime(startMin + 120));
      }
    }
  };

  const handleOraInizioChange = (newStart: string) => {
    setOraInizio(newStart);
    if (newStart) {
      const startMin = timeToMinutes(newStart);
      const currentStartMin = timeToMinutes(oraInizio);
      const currentEndMin = timeToMinutes(oraFine);
      const currentDuration = currentEndMin > currentStartMin ? currentEndMin - currentStartMin : (tipo === 'lezione' ? 60 : 120);
      const newEndMin = Math.min(24 * 60, startMin + currentDuration);
      setOraFine(minutesToTime(newEndMin));
    }
  };

  // Recalculate price automatically if not manually set
  useEffect(() => {
    if (tipo === 'lezione') {
      setTariffaBase(0);
      setTariffaTotale(0);
      setSconto(0);
      return;
    }
    const room = rooms.find((r) => r.id === salaId);
    if (!room) {
      if (!customTariffa) {
        setTariffaBase(0);
        setTariffaTotale(0);
      }
      return;
    }
    const hours = calculateDurationHours(oraInizio, oraFine);
    const rate = room.tariffaOraria;
    const base = Math.round(hours * rate);
    setTariffaBase(base);
    if (!customTariffa) {
      setTariffaTotale(Math.max(0, base - (Number(sconto) || 0)));
    }
  }, [salaId, tipo, oraInizio, oraFine, customTariffa, rooms, sconto]);

  const handleScontoChange = (val: string | number) => {
    setSconto(val);
    const disc = val === '' ? 0 : Math.max(0, Number(val));
    const base = tariffaBase === '' ? 0 : Number(tariffaBase);
    setTariffaTotale(Math.max(0, base - disc));
  };

  const handleTariffaBaseChange = (val: string | number) => {
    setTariffaBase(val);
    setCustomTariffa(true);
    const base = val === '' ? 0 : Math.max(0, Number(val));
    const disc = sconto === '' ? 0 : Number(sconto);
    setTariffaTotale(Math.max(0, base - disc));
  };

  // Calcolo delle sale già occupate/in conflitto nella data e orari correnti
  const overlappingBookingsByRoom = useMemo(() => {
    const map = new Map<string, Booking[]>();
    if (!data || !oraInizio || !oraFine) return map;

    const startM = timeToMinutes(oraInizio);
    let endM = timeToMinutes(oraFine);
    if (endM <= startM) endM += 24 * 60;

    bookings.forEach((b) => {
      // Ignora la stessa prenotazione se siamo in modalità modifica
      if (bookingToEdit && b.id === bookingToEdit.id) return;
      if (b.data !== data) return;

      const bStart = timeToMinutes(b.oraInizio);
      let bEnd = timeToMinutes(b.oraFine);
      if (bEnd <= bStart) bEnd += 24 * 60;

      // Sovrapposizione temporale parziale o totale: startM < bEnd && endM > bStart
      if (startM < bEnd && endM > bStart) {
        const list = map.get(b.salaId) || [];
        list.push(b);
        map.set(b.salaId, list);
      }
    });

    return map;
  }, [bookings, bookingToEdit, data, oraInizio, oraFine]);

  // Sale disponibili (libere nell'orario selezionato)
  const availableRooms = useMemo(() => {
    return rooms.filter((r) => !overlappingBookingsByRoom.has(r.id));
  }, [rooms, overlappingBookingsByRoom]);

  // Sale occupate con dettaglio dei conflitti
  const occupiedRooms = useMemo(() => {
    return rooms
      .filter((r) => overlappingBookingsByRoom.has(r.id))
      .map((r) => ({
        room: r,
        conflicts: overlappingBookingsByRoom.get(r.id) || [],
      }));
  }, [rooms, overlappingBookingsByRoom]);

  // Mappa delle sovrapposizioni orarie per insegnante (lezioni contemporanee, escludendo l'evento in modifica)
  const overlappingBookingsByTeacher = useMemo(() => {
    const map = new Map<string, Booking[]>();
    if (!data || !oraInizio || !oraFine) return map;

    const startM = timeToMinutes(oraInizio);
    let endM = timeToMinutes(oraFine);
    if (endM <= startM) endM += 24 * 60;

    bookings.forEach((b) => {
      if (b.tipo !== 'lezione') return;
      if (bookingToEdit && b.id === bookingToEdit.id) return;
      if (b.data !== data) return;

      const bStart = timeToMinutes(b.oraInizio);
      let bEnd = timeToMinutes(b.oraFine);
      if (bEnd <= bStart) bEnd += 24 * 60;

      // Sovrapposizione temporale parziale o totale: startM < bEnd && endM > bStart
      if (startM < bEnd && endM > bStart) {
        const tId =
          b.insegnanteId ||
          staff.find(
            (s) =>
              b.insegnanteNome &&
              `${s.nome} ${s.cognome}`.trim().toLowerCase() === b.insegnanteNome.trim().toLowerCase()
          )?.id;

        if (tId) {
          const list = map.get(tId) || [];
          list.push(b);
          map.set(tId, list);
        }
      }
    });

    return map;
  }, [bookings, bookingToEdit, data, oraInizio, oraFine, staff]);

  // Nome normalizzato del cliente attualmente selezionato o inserito manualmente
  const normalizedCurrentClientName = useMemo(() => {
    if (isManualClient) return manualClientName.trim().toLowerCase();
    const cl = clients.find((c) => c.id === clienteId);
    return cl ? `${cl.nome} ${cl.cognome}`.trim().toLowerCase() : '';
  }, [isManualClient, manualClientName, clienteId, clients]);

  // Sovrapposizioni orarie per il cliente selezionato (un allievo/cliente non può essere prenotato in più sale contemporaneamente)
  const overlappingBookingsByClient = useMemo(() => {
    const list: Booking[] = [];
    if (!data || !oraInizio || !oraFine || !normalizedCurrentClientName) return list;

    const startM = timeToMinutes(oraInizio);
    let endM = timeToMinutes(oraFine);
    if (endM <= startM) endM += 24 * 60;

    bookings.forEach((b) => {
      if (bookingToEdit && b.id === bookingToEdit.id) return;
      if (b.data !== data) return;

      const bClientName = (b.clienteNome || '').trim().toLowerCase();
      if (!bClientName) return;

      const isMatch =
        (!isManualClient && clienteId && b.clienteId === clienteId) ||
        bClientName === normalizedCurrentClientName ||
        bClientName.startsWith(normalizedCurrentClientName + ' ') ||
        normalizedCurrentClientName.startsWith(bClientName + ' ');

      if (!isMatch) return;

      const bStart = timeToMinutes(b.oraInizio);
      let bEnd = timeToMinutes(b.oraFine);
      if (bEnd <= bStart) bEnd += 24 * 60;

      if (startM < bEnd && endM > bStart) {
        list.push(b);
      }
    });

    return list;
  }, [bookings, bookingToEdit, data, oraInizio, oraFine, normalizedCurrentClientName, isManualClient, clienteId]);

  // Insegnanti candidati
  const teacherCandidates = useMemo(() => {
    return staff.filter(
      (s) => s.attivo && (s.ruolo === 'insegnante' || s.ruolo === 'entrambi')
    );
  }, [staff]);

  // Insegnanti disponibili (senza altre lezioni nell'orario selezionato)
  const availableTeachers = useMemo(() => {
    return teacherCandidates.filter((t) => !overlappingBookingsByTeacher.has(t.id));
  }, [teacherCandidates, overlappingBookingsByTeacher]);

  // Insegnanti occupati con dettaglio dei conflitti
  const occupiedTeachers = useMemo(() => {
    return teacherCandidates
      .filter((t) => overlappingBookingsByTeacher.has(t.id))
      .map((t) => ({
        teacher: t,
        conflicts: overlappingBookingsByTeacher.get(t.id) || [],
      }));
  }, [teacherCandidates, overlappingBookingsByTeacher]);

  // Controllo giorni festivi e domeniche (giorni segnati in rosso sul calendario)
  const holidayInfo = useMemo(() => {
    if (!data) return { isHolidayOrSunday: false, isSunday: false, isHoliday: false, name: '', shortBadge: '' };
    return getHolidayOrSundayInfo(data);
  }, [data]);

  // Controllo presenza e copertura operatori di sala (liberi da lavoro primario)
  const operatorCoverage = useMemo(() => {
    if (!data || !oraInizio || !oraFine) {
      return { hasCoverage: true, totalOperatorsCount: 0, availableOperators: [], unavailableOperators: [] };
    }
    return checkOperatorsCoverageForTimeSlot(staff, data, oraInizio, oraFine);
  }, [staff, data, oraInizio, oraFine]);

  if (!isOpen) return null;

  const durationHours = calculateDurationHours(oraInizio, oraFine);
  const selectedClient = clients.find((c) => c.id === clienteId);
  const selectedRoom = rooms.find((r) => r.id === salaId);

  const executeActualSave = () => {
    const finalClienteNome = isManualClient
      ? manualClientName.trim()
      : selectedClient
        ? `${selectedClient.nome} ${selectedClient.cognome}${
            selectedClient.gruppoBand ? ` (${selectedClient.gruppoBand})` : ''
          }`
        : '';

    const finalClienteId = isManualClient
      ? (bookingToEdit?.clienteId?.startsWith('manual-') ? bookingToEdit.clienteId : `manual-${Date.now()}`)
      : (selectedClient?.id || '');

    if (!finalClienteNome || !selectedRoom) return;

    const teacher = tipo === 'lezione' ? staff.find((s) => s.id === insegnanteId) : undefined;
    const finalOperatoreId = tipo === 'lezione' ? undefined : bookingToEdit?.operatoreAssegnatoId;
    const finalOperatoreNome = tipo === 'lezione' ? undefined : bookingToEdit?.operatoreAssegnatoNome;

    const clientDisplayName = finalClienteNome;
    const finalTariffaTotale = tipo === 'lezione' ? 0 : Number(tariffaTotale);
    const finalSconto = tipo === 'lezione' ? 0 : (Number(sconto) || 0);
    const finalStatoPagamento = tipo === 'lezione' ? 'pagato' : statoPagamento;

    const isRecurring = ripetizioneSettimanale || recurrenceConfig.attiva;
    const activeConfig: RecurrenceConfig | undefined = isRecurring
      ? {
          attiva: true,
          frequenza: recurrenceConfig.frequenza || 'settimanale',
          intervallo: recurrenceConfig.intervallo || 1,
          tipoFine: repeatOption === 'per_sempre' ? 'per_sempre' : (recurrenceConfig.tipoFine || 'per_sempre'),
          conteggioOccorrenze: repeatOption === 'per_sempre' ? undefined : (recurrenceConfig.conteggioOccorrenze || Number(repeatOption) || 4),
          dataFine: recurrenceConfig.dataFine,
          giorniSettimana: recurrenceConfig.giorniSettimana && recurrenceConfig.giorniSettimana.length > 0
            ? recurrenceConfig.giorniSettimana
            : [parseISODate(data).getDay()],
        }
      : undefined;

    if (bookingToEdit) {
      // Se era una prenotazione singola e l'utente ha attivato la ripetizione
      if (!bookingToEdit.gruppoRicorrenzaId && isRecurring) {
        const newRecId = `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const weeks = repeatOption === 'per_sempre' ? 52 : (Number(repeatOption) || recurrenceConfig.conteggioOccorrenze || 4);

        updateBooking({
          ...bookingToEdit,
          clienteId: finalClienteId,
          clienteNome: clientDisplayName,
          salaId,
          salaNome: selectedRoom.nome,
          tipo,
          insegnanteId: tipo === 'lezione' ? insegnanteId : undefined,
          insegnanteNome: tipo === 'lezione' && teacher ? `${teacher.nome} ${teacher.cognome}` : undefined,
          data,
          oraInizio,
          oraFine,
          durataOre: durationHours,
          ripetizioneSettimanale: true,
          gruppoRicorrenzaId: newRecId,
          settimaneRipetizione: weeks,
          recurrenceConfig: activeConfig,
          operatoreAssegnatoId: finalOperatoreId,
          operatoreAssegnatoNome: finalOperatoreNome,
          tariffaTotale: finalTariffaTotale,
          sconto: finalSconto,
          statoPagamento: finalStatoPagamento,
          metodoPagamento: finalStatoPagamento === 'pagato' && tipo !== 'lezione' ? metodoPagamento : undefined,
          richiesteStrumentazione,
          note,
        });

        // Genera le occorrenze future a partire dalla data successiva usando generateRecurrenceDates
        const allDates = activeConfig
          ? generateRecurrenceDates(data, activeConfig)
          : Array.from({ length: weeks }, (_, i) => {
              const d = new Date(parseISODate(data));
              d.setDate(d.getDate() + i * 7);
              return formatDateToISO(d);
            });
        const futureDates = allDates.filter((dStr) => dStr !== data);

        for (const nextDateStr of futureDates) {
          addBooking({
            clienteId: finalClienteId,
            clienteNome: clientDisplayName,
            salaId,
            salaNome: selectedRoom.nome,
            tipo,
            insegnanteId: tipo === 'lezione' ? insegnanteId : undefined,
            insegnanteNome: tipo === 'lezione' && teacher ? `${teacher.nome} ${teacher.cognome}` : undefined,
            data: nextDateStr,
            oraInizio,
            oraFine,
            ripetizioneSettimanale: true,
            gruppoRicorrenzaId: newRecId,
            settimaneRipetizione: allDates.length,
            // CRITICO: recurrenceConfig deve essere undefined nelle singole occorrenze future per evitare espansioni ricorsive esponenziali
            recurrenceConfig: undefined,
            operatoreAssegnatoId: finalOperatoreId,
            operatoreAssegnatoNome: finalOperatoreNome,
            tariffaTotale: finalTariffaTotale,
            sconto: finalSconto,
            statoPagamento: 'da_saldare',
            richiesteStrumentazione,
            note,
          });
        }
      } else if (bookingToEdit.gruppoRicorrenzaId && !isRecurring) {
        // L'utente ha disattivato la ripetizione per questo appuntamento
        updateBooking({
          ...bookingToEdit,
          clienteId: finalClienteId,
          clienteNome: clientDisplayName,
          salaId,
          salaNome: selectedRoom.nome,
          tipo,
          insegnanteId: tipo === 'lezione' ? insegnanteId : undefined,
          insegnanteNome: tipo === 'lezione' && teacher ? `${teacher.nome} ${teacher.cognome}` : undefined,
          data,
          oraInizio,
          oraFine,
          durataOre: durationHours,
          ripetizioneSettimanale: false,
          gruppoRicorrenzaId: undefined,
          settimaneRipetizione: 1,
          recurrenceConfig: undefined,
          operatoreAssegnatoId: finalOperatoreId,
          operatoreAssegnatoNome: finalOperatoreNome,
          tariffaTotale: finalTariffaTotale,
          sconto: finalSconto,
          statoPagamento: finalStatoPagamento,
          metodoPagamento: finalStatoPagamento === 'pagato' && tipo !== 'lezione' ? metodoPagamento : undefined,
          richiesteStrumentazione,
          note,
        });
      } else {
        // Modifica standard
        const isRecurringGroup = Boolean(bookingToEdit.gruppoRicorrenzaId);

        // Verifichiamo se sono stati modificati campi condivisi della serie
        const hasSeriesChanges = isRecurringGroup && (
          bookingToEdit.salaId !== salaId ||
          bookingToEdit.oraInizio !== oraInizio ||
          bookingToEdit.oraFine !== oraFine ||
          bookingToEdit.tipo !== tipo ||
          bookingToEdit.clienteId !== finalClienteId ||
          bookingToEdit.clienteNome !== clientDisplayName ||
          bookingToEdit.insegnanteId !== (tipo === 'lezione' ? insegnanteId : undefined) ||
          bookingToEdit.operatoreAssegnatoId !== finalOperatoreId ||
          bookingToEdit.tariffaTotale !== finalTariffaTotale ||
          bookingToEdit.sconto !== finalSconto ||
          (bookingToEdit.richiesteStrumentazione || '') !== (richiesteStrumentazione || '') ||
          (bookingToEdit.note || '') !== (note || '')
        );

        let updateAll = false;
        if (hasSeriesChanges) {
          updateAll = window.confirm(
            'Questa prenotazione fa parte di una serie ricorrente.\n\nPremi OK per applicare le modifiche (orario, sala, note, operatore, tariffa) a TUTTA la serie, oppure ANNULLA per modificare solo questa singola data.\n\n(Nota: lo stato di pagamento viene applicato esclusivamente a questo evento selezionato).'
          );
        }

        if (updateAll && bookingToEdit.gruppoRicorrenzaId) {
          const groupBookings = bookings.filter((b) => b.gruppoRicorrenzaId === bookingToEdit.gruppoRicorrenzaId);
          const updatedBookings = groupBookings.map((b) => {
            const isTarget = b.id === bookingToEdit.id;
            return {
              ...b,
              clienteId: finalClienteId,
              clienteNome: clientDisplayName,
              salaId,
              salaNome: selectedRoom.nome,
              tipo,
              insegnanteId: tipo === 'lezione' ? insegnanteId : undefined,
              insegnanteNome: tipo === 'lezione' && teacher ? `${teacher.nome} ${teacher.cognome}` : undefined,
              data: isTarget ? data : b.data,
              oraInizio,
              oraFine,
              durataOre: durationHours,
              operatoreAssegnatoId: finalOperatoreId,
              operatoreAssegnatoNome: finalOperatoreNome,
              tariffaTotale: finalTariffaTotale,
              sconto: finalSconto,
              // Lo stato e metodo di pagamento cambiano SOLO nell'evento selezionato, mai in quelli futuri/altri
              statoPagamento: isTarget ? finalStatoPagamento : b.statoPagamento,
              metodoPagamento: isTarget
                ? (finalStatoPagamento === 'pagato' && tipo !== 'lezione' ? metodoPagamento : undefined)
                : b.metodoPagamento,
              richiesteStrumentazione,
              note,
            };
          });
          updateMultipleBookings(updatedBookings);
        } else {
          updateBooking({
            ...bookingToEdit,
            clienteId: finalClienteId,
            clienteNome: clientDisplayName,
            salaId,
            salaNome: selectedRoom.nome,
            tipo,
            insegnanteId: tipo === 'lezione' ? insegnanteId : undefined,
            insegnanteNome: tipo === 'lezione' && teacher ? `${teacher.nome} ${teacher.cognome}` : undefined,
            data,
            oraInizio,
            oraFine,
            durataOre: durationHours,
            ripetizioneSettimanale: isRecurring,
            settimaneRipetizione: isRecurring ? (Number(repeatOption) || recurrenceConfig.conteggioOccorrenze || 4) : 1,
            recurrenceConfig: isRecurring ? activeConfig : undefined,
            operatoreAssegnatoId: finalOperatoreId,
            operatoreAssegnatoNome: finalOperatoreNome,
            tariffaTotale: finalTariffaTotale,
            sconto: finalSconto,
            statoPagamento: finalStatoPagamento,
            metodoPagamento: finalStatoPagamento === 'pagato' && tipo !== 'lezione' ? metodoPagamento : undefined,
            richiesteStrumentazione,
            note,
          });
        }
      }
    } else {
      addBooking({
        clienteId: finalClienteId,
        clienteNome: clientDisplayName,
        salaId,
        salaNome: selectedRoom.nome,
        tipo,
        insegnanteId: tipo === 'lezione' ? insegnanteId : undefined,
        insegnanteNome: tipo === 'lezione' && teacher ? `${teacher.nome} ${teacher.cognome}` : undefined,
        data,
        oraInizio,
        oraFine,
        ripetizioneSettimanale: isRecurring,
        repeatWeeks: isRecurring ? (repeatOption === 'per_sempre' ? 52 : (Number(repeatOption) || 4)) : 1,
        recurrenceConfig: activeConfig,
        operatoreAssegnatoId: finalOperatoreId,
        operatoreAssegnatoNome: finalOperatoreNome,
        tariffaTotale: finalTariffaTotale,
        sconto: finalSconto,
        statoPagamento: finalStatoPagamento,
        metodoPagamento: finalStatoPagamento === 'pagato' && tipo !== 'lezione' ? metodoPagamento : undefined,
        richiesteStrumentazione,
        note,
      });
    }

    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const finalClienteNome = isManualClient
      ? manualClientName.trim()
      : selectedClient
        ? `${selectedClient.nome} ${selectedClient.cognome}${
            selectedClient.gruppoBand ? ` (${selectedClient.gruppoBand})` : ''
          }`
        : '';

    const finalClienteId = isManualClient
      ? (bookingToEdit?.clienteId?.startsWith('manual-') ? bookingToEdit.clienteId : `manual-${Date.now()}`)
      : (selectedClient?.id || '');

    if (!finalClienteNome) {
      alert('Inserisci il nome del cliente o della band.');
      return;
    }
    if (!selectedRoom) {
      alert('Seleziona una sala prove prima di procedere.');
      return;
    }

    // Controllo bloccante festività nazionali e domeniche (chiusura sala prove, lezioni ammesse)
    if (holidayInfo.isHolidayOrSunday && tipo === 'prove') {
      alert(
        `Impossibile prenotare la sala prove:\n\nLa data selezionata (${data}) corrisponde a un giorno di chiusura festiva (${holidayInfo.name}).\n\nLa prenotazione della sala prove per band è chiusa nei giorni festivi e tutte le domeniche.\n\nLe lezioni con insegnante sono invece consentite: seleziona il tipo "Lezione" per procedere.`
      );
      return;
    }

    // Controllo bloccante copertura operatori (Nessun operatore disponibile causa lavoro primario per sala prove)
    if (!operatorCoverage.hasCoverage && tipo === 'prove') {
      const details = operatorCoverage.unavailableOperators
        .map((u) => `• ${u.operator.nome} ${u.operator.cognome}: ${u.reason}`)
        .join('\n');
      alert(
        `Impossibile prenotare la sala prove in questo intervallo orario:\n\nNessuno dei ${operatorCoverage.totalOperatorsCount} operatori della struttura risulta disponibile il ${data} nella fascia oraria ${oraInizio} - ${oraFine} a causa dei turni di lavoro primario:\n\n${details}\n\nLa sala prove per band richiede il presidio di un operatore.\n\nLe lezioni con insegnante sono invece consentite: seleziona il tipo "Lezione" per procedere.`
      );
      return;
    }

    // Controllo bloccante univocità sala: nessuna sovrapposizione oraria ammessa
    if (overlappingBookingsByRoom.has(salaId)) {
      const conflicts = overlappingBookingsByRoom.get(salaId) || [];
      alert(
        `Impossibile inserire la prenotazione:\n\nLa sala "${selectedRoom.nome}" risulta già occupata il ${data} nella fascia oraria ${oraInizio} - ${oraFine} da:\n${conflicts
          .map((c) => `• ${c.clienteNome} (${c.oraInizio} - ${c.oraFine})`)
          .join('\n')}\n\nDue eventi non possono coincidere o occupare la stessa sala nello stesso intervallo. Seleziona una sala libera tra quelle disponibili.`
      );
      return;
    }

    // Controllo bloccante univocità insegnante: un insegnante non può essere in due lezioni contemporaneamente
    if (tipo === 'lezione' && insegnanteId && overlappingBookingsByTeacher.has(insegnanteId)) {
      const conflicts = overlappingBookingsByTeacher.get(insegnanteId) || [];
      const teacherObj = staff.find((s) => s.id === insegnanteId);
      const teacherName = teacherObj ? `${teacherObj.nome} ${teacherObj.cognome}` : 'L\'insegnante selezionato';
      alert(
        `Impossibile inserire la lezione:\n\n${teacherName} risulta già impegnato/a in un'altra lezione il ${data} nella fascia oraria ${oraInizio} - ${oraFine} con:\n${conflicts
          .map((c) => `• ${c.clienteNome} in ${c.salaNome || 'Sala'} (${c.oraInizio} - ${c.oraFine})`)
          .join('\n')}\n\nUn insegnante non può essere assegnato a più lezioni nello stesso orario. Seleziona un insegnante disponibile o cambia orario.`
      );
      return;
    }

    // Controllo bloccante univocità cliente: un cliente/allievo non può avere due prenotazioni contemporanee in sale diverse
    if (overlappingBookingsByClient.length > 0) {
      const first = overlappingBookingsByClient[0];
      alert(
        `Impossibile inserire la prenotazione:\n\nIl cliente/allievo "${finalClienteNome}" ha già un'altra prenotazione attiva il ${data} nella fascia oraria ${first.oraInizio} - ${first.oraFine} in "${first.salaNome || 'un\'altra sala'}".\n\nNon è consentito inserire prenotazioni contemporanee per la stessa persona in più sale.`
      );
      return;
    }

    // Controllo prenotazione nel passato:
    // Se è un nuovo inserimento nel passato, oppure un evento esistente che viene spostato nel passato
    const shouldCheckPast = !bookingToEdit || (bookingToEdit && (bookingToEdit.data !== data || bookingToEdit.oraInizio !== oraInizio));
    if (shouldCheckPast && isEventInPast) {
      setIsPastConfirmOpen(true);
      return;
    }

    setIsSubmitting(true);
    executeActualSave();
  };

  const handleDeleteCurrentBooking = () => {
    if (!bookingToEdit) return;
    const todayIso = formatDateToISO(new Date());
    if (!isAdmin && bookingToEdit.data < todayIso) {
      alert('Nel profilo utente non è consentito cancellare eventi passati. È possibile cancellare solo eventi del giorno stesso o futuri.');
      return;
    }

    if (bookingToEdit.gruppoRicorrenzaId) {
      setIsRecurringDeleteOpen(true);
      return;
    }

    if (window.confirm(`Sei sicuro di voler eliminare la prenotazione di ${bookingToEdit.clienteNome}?`)) {
      deleteBooking(bookingToEdit.id);
      onClose();
    }
  };

  const handleConfirmRecurringDelete = (mode: DeleteRecurringMode) => {
    if (bookingToEdit) {
      deleteBooking(bookingToEdit.id, mode);
      setIsRecurringDeleteOpen(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/90 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-yellow-400/10 border border-blue-200/80 dark:border-yellow-500/30 flex items-center justify-center text-blue-600 dark:text-yellow-400 shrink-0 shadow-2xs">
              {tipo === 'prove' ? <Music2 className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-snug truncate">
                {bookingToEdit ? 'Modifica Prenotazione' : 'Nuova Prenotazione Sala'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400 font-normal truncate mt-0.5">
                {tipo === 'prove' ? 'Sessione Prove Musicali / Band' : 'Lezione di Musica / Canto'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-header-btn-blue modal-close-btn-blue shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 hover:bg-red-600 active:scale-95 text-white transition-all cursor-pointer border border-blue-500 hover:border-red-500 shadow-md shadow-blue-500/25"
            style={{ backgroundColor: '#2563eb', color: '#ffffff', borderColor: '#1d4ed8' }}
            title="Chiudi"
            aria-label="Chiudi finestra"
          >
            <X className="w-5 h-5 text-white stroke-[2.5]" style={{ color: '#ffffff', stroke: '#ffffff' }} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[86vh]">
          {/* Top Full-Width Action Bar */}
          <div className="w-full px-5 sm:px-6 py-3 bg-slate-50 dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between gap-3 shrink-0 shadow-xs">
            {bookingToEdit ? (
              !isAdmin && bookingToEdit.data < formatDateToISO(new Date()) ? (
                <div
                  className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-400 text-xs font-semibold flex items-center gap-1.5 cursor-not-allowed select-none"
                  title="Nel profilo utente non è consentito cancellare eventi passati (solo giorno stesso o futuri)"
                >
                  <Trash2 className="w-3.5 h-3.5 opacity-50" />
                  <span className="hidden sm:inline">Eliminazione disabilitata (evento passato)</span>
                  <span className="sm:hidden">Passato</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleDeleteCurrentBooking}
                  className="px-3.5 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 hover:text-rose-400 border border-rose-500/30 text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Elimina questa prenotazione"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Elimina Prenotazione</span>
                  <span className="sm:hidden">Elimina</span>
                </button>
              )
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-neutral-400">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                <span className="hidden sm:inline">Nuova prenotazione sala</span>
              </div>
            )}

            <div className="flex items-center gap-2 sm:gap-3 ml-auto">
              {bookingToEdit && (
                <button
                  type="button"
                  onClick={() => setIsWhatsAppReminderOpen(true)}
                  className="px-3.5 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                  title="Condividi promemoria su WhatsApp con allievo o band"
                >
                  <MessageSquare className="w-4 h-4 fill-emerald-600 dark:fill-emerald-400 stroke-none" />
                  <span className="hidden sm:inline">Promemoria WhatsApp</span>
                  <span className="sm:hidden">WhatsApp</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200 text-sm font-bold transition-all cursor-pointer shadow-xs"
              >
                Annulla
              </button>
              {(() => {
                const isHolidayBlocked = holidayInfo.isHolidayOrSunday && tipo === 'prove';
                const isCoverageBlocked = !operatorCoverage.hasCoverage && tipo === 'prove';
                const isBookingBlocked = isHolidayBlocked || isCoverageBlocked;

                return (
                  <button
                    type="submit"
                    disabled={isBookingBlocked || isSubmitting}
                    className={`px-5 py-2 rounded-lg font-black text-sm shadow-md transition-all flex items-center gap-2 ${
                      isBookingBlocked
                        ? 'bg-rose-500/80 text-white cursor-not-allowed opacity-90'
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 cursor-pointer active:scale-95'
                    }`}
                    title={
                      isHolidayBlocked
                        ? `Sala prove chiusa per festività (${holidayInfo.name}). Seleziona "Lezione" per procedere con una lezione.`
                        : isCoverageBlocked
                          ? 'Sala prove chiusa: nessun operatore presente per lavoro primario. Seleziona "Lezione" per procedere con una lezione.'
                          : ''
                    }
                  >
                    {isBookingBlocked ? <AlertTriangle className="w-4 h-4 text-white" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>{bookingToEdit ? 'Salva Modifiche' : 'Conferma Prenotazione'}</span>
                  </button>
                );
              })()}
            </div>
          </div>

          {/* Form Scrollable Body */}
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {/* Alert Festività Nazionali & Domeniche */}
          {holidayInfo.isHolidayOrSunday && (
            tipo === 'prove' ? (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-500 dark:border-rose-600 rounded-xl flex items-start gap-3 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/60 border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div className="text-xs text-rose-950 dark:text-rose-100 space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm text-rose-800 dark:text-rose-300">
                      🚫 Sala Prove Chiusa per Festività: {holidayInfo.name}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-600 text-white tracking-wide shadow-2xs">
                      Solo Lezioni Consentite
                    </span>
                  </div>
                  <p className="text-rose-800 dark:text-rose-200/90 leading-relaxed font-medium">
                    Il giorno <strong>{data}</strong> è contrassegnato in rosso sul calendario come festività (<strong>{holidayInfo.name}</strong>). La prenotazione della sala prove per band è bloccata. <em>Se intendi inserire una lezione di musica con docente, seleziona il tipo <strong>Lezione</strong> qui sotto per procedere liberamente.</em>
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-700/60 rounded-xl flex items-start gap-3">
                <GraduationCap className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                <div className="text-xs text-purple-950 dark:text-purple-100 space-y-0.5">
                  <div className="font-bold text-sm text-purple-900 dark:text-purple-300">
                    🎓 Giorno Festivo ({holidayInfo.name}): Lezione Consentita
                  </div>
                  <p className="text-purple-800 dark:text-purple-200/90 leading-relaxed">
                    La sala prove per band è chiusa, ma le lezioni di musica e canto con il docente sono pienamente ammesse e confermabili.
                  </p>
                </div>
              </div>
            )
          )}

          {/* Alert Presidio Operatori (Lavoro Primario) */}
          {!holidayInfo.isHolidayOrSunday && !operatorCoverage.hasCoverage && (
            tipo === 'prove' ? (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-400 dark:border-rose-600 rounded-xl flex items-start gap-3 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/60 border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div className="text-xs text-rose-950 dark:text-rose-100 space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm text-rose-800 dark:text-rose-300">
                      🚨 Sala Prove Chiusa - Nessun Operatore Presente
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-600 text-white tracking-wide shadow-2xs">
                      Solo Lezioni Consentite
                    </span>
                  </div>
                  <p className="text-rose-800 dark:text-rose-200/90 leading-relaxed font-medium">
                    Nessuno dei {operatorCoverage.totalOperatorsCount} operatori della struttura è disponibile per presidio il <strong>{data}</strong> dalle <strong>{oraInizio}</strong> alle <strong>{oraFine}</strong> a causa dei turni di lavoro primario. Non è possibile prenotare la sala prove per band. <em>Seleziona <strong>Lezione</strong> qui sotto se desideri inserire una lezione di musica con docente.</em>
                  </p>
                  {operatorCoverage.unavailableOperators.length > 0 && (
                    <div className="mt-1 pt-1.5 border-t border-rose-200 dark:border-rose-800/60">
                      <span className="font-bold text-[11px] text-rose-900 dark:text-rose-200 block mb-0.5">
                        Dettaglio indisponibilità lavoro primario:
                      </span>
                      <ul className="space-y-0.5 text-rose-700 dark:text-rose-300 text-[11px]">
                        {operatorCoverage.unavailableOperators.map((u, idx) => (
                          <li key={idx} className="flex items-start gap-1">
                            <span className="font-bold shrink-0">• {u.operator.nome} {u.operator.cognome}:</span>
                            <span>{u.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-700/60 rounded-xl flex items-start gap-3">
                <GraduationCap className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                <div className="text-xs text-purple-950 dark:text-purple-100 space-y-0.5">
                  <div className="font-bold text-sm text-purple-900 dark:text-purple-300">
                    🎓 Nessun Presidio Operatore: Lezione Consentita
                  </div>
                  <p className="text-purple-800 dark:text-purple-200/90 leading-relaxed">
                    Gli operatori di sala sono assenti per lavoro primario, ma le lezioni di musica con il docente sono autonome e confermabili regolarmente.
                  </p>
                </div>
              </div>
            )
          )}

          {/* Tipo prenotazione: Prove vs Lezione */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Tipo Prenotazione
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => handleSelectTipo('prove')}
                className={`flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg border text-sm font-semibold transition-all ${
                  tipo === 'prove'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Music2 className="w-4 h-4 text-indigo-600" />
                Prove Musicali (Band / Solista)
              </button>
              <button
                type="button"
                onClick={() => handleSelectTipo('lezione')}
                className={`flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg border text-sm font-semibold transition-all ${
                  tipo === 'lezione'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <GraduationCap className="w-4 h-4 text-indigo-600" />
                Lezione di Musica / Canto
              </button>
            </div>
          </div>

          {/* Cliente & Sala */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {isManualClient ? 'Nome Band / Cliente (Inserimento Manuale) *' : 'Cliente / Tesserato *'}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const next = !isManualClient;
                    setIsManualClient(next);
                    if (next && !manualClientName && selectedClient) {
                      setManualClientName(`${selectedClient.nome} ${selectedClient.cognome}${selectedClient.gruppoBand ? ` (${selectedClient.gruppoBand})` : ''}`);
                    }
                    if (!next && !clienteId && clients.length > 0) {
                      setClienteId(clients[0].id);
                    }
                  }}
                  className="text-[11px] font-bold text-yellow-400 hover:text-yellow-300 transition-colors flex items-center gap-1 cursor-pointer bg-neutral-900 px-2 py-0.5 rounded border border-yellow-500/30"
                  title={isManualClient ? 'Passa alla selezione da anagrafica tesserati' : 'Inserisci manualmente band o cliente'}
                >
                  {isManualClient ? (
                    <>
                      <Users className="w-3 h-3" />
                      <span>Scegli da anagrafica</span>
                    </>
                  ) : (
                    <>
                      <Edit3 className="w-3 h-3" />
                      <span>Inserimento manuale</span>
                    </>
                  )}
                </button>
              </div>

              {isManualClient ? (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    required
                    value={manualClientName}
                    onChange={(e) => setManualClientName(e.target.value)}
                    placeholder="Nome band o cliente (es. The Velvet Echoes, Mario Rossi...)"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-yellow-500/40 bg-neutral-950 text-yellow-100 text-sm focus:ring-2 focus:ring-yellow-400 focus:outline-none placeholder:text-neutral-500"
                  />
                  <div className="flex items-center justify-between text-[11px] text-neutral-400">
                    <span className="text-yellow-400/80">✨ Inserimento manuale (predefinito)</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualClient(false);
                        if (!clienteId && clients.length > 0) {
                          setClienteId(clients[0].id);
                        }
                      }}
                      className="text-yellow-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Users className="w-3 h-3" />
                      <span>Scegli da lista tesserati</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <select
                    required
                    value={clienteId}
                    onChange={(e) => {
                      if (e.target.value === '__manual__') {
                        setIsManualClient(true);
                      } else {
                        handleClientChange(e.target.value);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="">-- Seleziona cliente --</option>
                    <option value="__manual__" className="text-yellow-400 font-bold bg-neutral-900">
                      ✍️ Inserimento manuale (non tesserato / ospite)...
                    </option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} {c.cognome} {c.gruppoBand ? `[${c.gruppoBand}]` : ''} - Tessera:{' '}
                        {c.statoTesseramento === 'attivo' ? 'Attiva' : c.statoTesseramento === 'in_attesa' ? 'In Attesa Ente' : 'Scaduta'}
                      </option>
                    ))}
                  </select>
                  {selectedClient && selectedClient.statoTesseramento !== 'attivo' && (
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-amber-700 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {selectedClient.statoTesseramento === 'in_attesa'
                          ? 'Tesseramento in attesa di approvazione dall\'ente.'
                          : 'Attenzione: tesseramento scaduto. Da rinnovare!'}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Sala Prove *
                </label>
                {data && oraInizio && oraFine && (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      availableRooms.length > 0
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    }`}
                  >
                    {availableRooms.length} su {rooms.length} {availableRooms.length === 1 ? 'libera' : 'libere'}
                  </span>
                )}
              </div>
              <RoomFloorPlanSelector
                rooms={rooms}
                selectedRoomId={salaId}
                onSelectRoom={(newRoomId) => setSalaId(newRoomId)}
                availableRooms={availableRooms}
                occupiedRooms={occupiedRooms}
                tipo={tipo}
                data={data}
                oraInizio={oraInizio}
                oraFine={oraFine}
              />
              <input type="hidden" name="salaId" value={salaId} required />

              {/* Avviso in tempo reale se la sala scelta ha un conflitto */}
              {salaId && overlappingBookingsByRoom.has(salaId) && (
                <div className="mt-2 p-2.5 rounded-lg bg-red-50 border border-red-300 text-red-800 text-xs flex items-start gap-2 animate-in fade-in duration-150">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Sala già occupata in questa fascia oraria!</strong>
                    <span>
                      {(overlappingBookingsByRoom.get(salaId) || []).map((c) => `${c.clienteNome} (${c.oraInizio} - ${c.oraFine})`).join(', ')}
                    </span>
                    <span className="block mt-1 font-semibold text-red-900">
                      Scegli un'altra sala libera dall'elenco per confermare.
                    </span>
                  </div>
                </div>
              )}

              {/* Notifica se tutte le sale sono sature nell'orario */}
              {availableRooms.length === 0 && rooms.length > 0 && (
                <div className="mt-2 p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Tutte le sale risultano occupate tra le {oraInizio} e le {oraFine}. Cambia orario o data.</span>
                </div>
              )}
            </div>
          </div>

          {/* Insegnante (se lezione) */}
          {tipo === 'lezione' && (
            <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 rounded-lg">
              {isAutoTeacher && currentTeacherStaff ? (
                /* Profilo Insegnante Personale: Assegnazione automatica diretta senza menù a tendina */
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">
                      Docente Incaricato (Assegnato Automaticamente)
                    </label>
                    <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1 shadow-2xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                      Tuo Profilo Docente
                    </span>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-white dark:bg-neutral-900 rounded-xl border border-indigo-200 dark:border-indigo-800/60 shadow-xs">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-xs"
                      style={{ backgroundColor: currentTeacherStaff.coloreBadge || '#8b5cf6' }}
                    >
                      {currentTeacherStaff.nome[0]}{currentTeacherStaff.cognome[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm block truncate">
                          {currentTeacherStaff.nome} {currentTeacherStaff.cognome}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                          Docente
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-neutral-400 block truncate mt-0.5">
                        {currentTeacherStaff.materieInsegnamento || 'Lezione Didattica'} {currentTeacherStaff.telefono ? `• ${currentTeacherStaff.telefono}` : ''}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        Collegato
                      </span>
                    </div>
                  </div>

                  {/* Avviso in tempo reale se il docente è già occupato altrove */}
                  {overlappingBookingsByTeacher.has(currentTeacherStaff.id) && (
                    <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold">Attenzione: hai già un'altra lezione in questa fascia oraria!</strong>
                        <span>
                          {(overlappingBookingsByTeacher.get(currentTeacherStaff.id) || []).map((c) => `• ${c.clienteNome} in ${c.salaNome || 'Sala'} (${c.oraInizio} - ${c.oraFine})`).join(' ')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Profilo Amministratore (o account generale): Menù a tendina completo con scelta libera di tutti i docenti */
                <>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">
                      Docente / Insegnante incaricato *
                    </label>
                    {data && oraInizio && oraFine && (
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          availableTeachers.length > 0
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        {availableTeachers.length} su {teacherCandidates.length} {availableTeachers.length === 1 ? 'disponibile' : 'disponibili'}
                      </span>
                    )}
                  </div>
                  <select
                    value={insegnanteId}
                    onChange={(e) => setInsegnanteId(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition-all ${
                      insegnanteId && overlappingBookingsByTeacher.has(insegnanteId)
                        ? 'border-red-500 bg-red-50 text-red-900 ring-2 ring-red-400'
                        : 'border-indigo-300 bg-white text-slate-800'
                    }`}
                  >
                    <option value="">-- Seleziona insegnante ({availableTeachers.length} disponibili) --</option>
                    {/* Insegnanti Disponibili */}
                    {availableTeachers.map((t) => (
                      <option key={t.id} value={t.id} className="font-bold text-slate-900">
                        ✓ {t.nome} {t.cognome} {t.materieInsegnamento ? `(${t.materieInsegnamento})` : ''}
                      </option>
                    ))}
                    {/* Insegnanti già impegnati in altra lezione: disabilitati e non selezionabili */}
                    {occupiedTeachers.length > 0 && (
                      <optgroup label="── Insegnanti già impegnati in altra lezione (Non selezionabili) ──">
                        {occupiedTeachers.map(({ teacher: t, conflicts }) => (
                          <option
                            key={t.id}
                            value={t.id}
                            disabled
                            className="text-slate-400 bg-slate-100 italic"
                          >
                            🚫 {t.nome} {t.cognome} - OCCUPATO/A ({conflicts.map((c) => `${c.clienteNome} in ${c.salaNome || 'Sala'} ${c.oraInizio}-${c.oraFine}`).join(', ')})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>

                  {/* Avviso in tempo reale se l'insegnante scelto ha un conflitto */}
                  {insegnanteId && overlappingBookingsByTeacher.has(insegnanteId) && (
                    <div className="mt-2 p-2.5 rounded-lg bg-red-50 border border-red-300 text-red-800 text-xs flex items-start gap-2 animate-in fade-in duration-150">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold">Insegnante già occupato/a in questa fascia oraria!</strong>
                        <span>
                          {(overlappingBookingsByTeacher.get(insegnanteId) || []).map((c) => `• ${c.clienteNome} in ${c.salaNome || 'Sala'} (${c.oraInizio} - ${c.oraFine})`).join(' ')}
                        </span>
                        <span className="block mt-1 font-semibold text-red-900">
                          Seleziona un altro insegnante disponibile tra quelli liberi.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Notifica se tutti gli insegnanti sono occupati */}
                  {availableTeachers.length === 0 && teacherCandidates.length > 0 && (
                    <div className="mt-2 p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Tutti gli insegnanti risultano già impegnati tra le {oraInizio} e le {oraFine}. Cambia orario o data.</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Data Prenotazione */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <Calendar className="w-3.5 h-3.5 inline mr-1 text-slate-400" /> Data Prenotazione *
              </label>
              {isEventInPast && (
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Nel passato
                </span>
              )}
            </div>
            <input
              type="date"
              required
              value={data}
              onChange={(e) => handleDateChange(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-lg border text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden ${
                isEventInPast
                  ? 'border-amber-400 bg-amber-50/40 text-slate-800'
                  : 'border-slate-300 bg-white text-slate-800'
              }`}
            />
          </div>

          {/* Selezione Orari Smart con Menù a Scorrimento (Rotella stile iOS) */}
          <SmartTimePicker
            startTime={oraInizio}
            endTime={oraFine}
            onStartTimeChange={handleOraInizioChange}
            onEndTimeChange={setOraFine}
            durationHours={durationHours}
            bookingType={tipo}
          />

          {/* Ripetizione Settimanale Fissa */}
          <div className="p-3.5 bg-neutral-900 border border-yellow-500/40 rounded-xl space-y-2.5 shadow-sm text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <RefreshCw className={`w-4 h-4 text-yellow-400 ${ripetizioneSettimanale ? 'animate-spin-slow' : ''}`} />
                <span className="text-sm font-bold text-yellow-300">Ripetizione Settimanale Fissa</span>
                {bookingToEdit?.gruppoRicorrenzaId && (
                  <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/80 text-white">
                    Serie Collegata
                  </span>
                )}
                {ripetizioneSettimanale && repeatOption === 'per_sempre' && (
                  <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-yellow-400 text-black">
                    Per sempre
                  </span>
                )}
              </div>
              <input
                type="checkbox"
                id="ripetizione"
                checked={ripetizioneSettimanale}
                onChange={(e) => handleToggleRipetizione(e.target.checked)}
                className="w-4 h-4 text-yellow-400 rounded border-neutral-700 bg-neutral-800 focus:ring-yellow-400 cursor-pointer accent-yellow-400"
              />
            </div>

            {ripetizioneSettimanale && (
              <div className="pt-2 text-xs text-neutral-300 border-t border-neutral-800 space-y-2.5">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-semibold text-neutral-200">Ripeti per:</span>
                  <select
                    value={repeatOption}
                    onChange={(e) => handleRepeatOptionChange(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-yellow-500/50 bg-neutral-950 text-xs font-bold text-yellow-300 focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                  >
                    <option value="per_sempre">Per sempre</option>
                    <option value="2">2 settimane consecutive</option>
                    <option value="4">4 settimane (1 mese)</option>
                    <option value="8">8 settimane (2 mesi)</option>
                    <option value="12">12 settimane (3 mesi)</option>
                    <option value="24">24 settimane (6 mesi)</option>
                    <option value="52">52 settimane (12 mesi)</option>
                    <option value="personalizzata">⚙️ Personalizzata (giorni specifici, fine al...)</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setIsRecurrenceModalOpen(true)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-yellow-400 border border-yellow-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>⚙️ Giorni / Dettagli</span>
                  </button>
                </div>

                <div className="text-xs text-neutral-400">
                  {repeatOption === 'per_sempre' ? (
                    <span className="text-yellow-400 font-medium">
                      ✨ (Verranno create prenotazioni fisse ogni settimana per sempre, senza data di scadenza)
                    </span>
                  ) : repeatOption === 'personalizzata' ? (
                    <span className="text-yellow-400 font-medium">
                      Regola personalizzata: {getRecurrenceSummary(recurrenceConfig, data)}
                    </span>
                  ) : (
                    <span>
                      (Verranno create {repeatWeeks} prenotazioni nello stesso giorno e orario)
                    </span>
                  )}
                </div>

                {bookingToEdit?.gruppoRicorrenzaId && (
                  <p className="text-[11px] text-amber-300/90 bg-amber-950/40 border border-amber-500/30 rounded-md px-2.5 py-1.5">
                    💡 Questa prenotazione fa già parte di una serie ricorrente. Al salvataggio ti verrà chiesto se aggiornare l'intera serie o solo questo singolo giorno.
                  </p>
                )}

                {/* Giorni della settimana selezionabili */}
                {recurrenceConfig.giorniSettimana && recurrenceConfig.giorniSettimana.length > 0 && (
                  <div className="flex items-center gap-1.5 pt-1 border-t border-neutral-800/80">
                    <span className="text-[11px] text-neutral-400">Giorni fissati:</span>
                    {[
                      { index: 1, label: 'LUN' },
                      { index: 2, label: 'MAR' },
                      { index: 3, label: 'MER' },
                      { index: 4, label: 'GIO' },
                      { index: 5, label: 'VEN' },
                      { index: 6, label: 'SAB' },
                      { index: 0, label: 'DOM' },
                    ].map((d) => {
                      const sel = recurrenceConfig.giorniSettimana.includes(d.index);
                      return (
                        <button
                          key={d.index}
                          type="button"
                          onClick={() => {
                            const exists = recurrenceConfig.giorniSettimana.includes(d.index);
                            let newDays: number[];
                            if (exists) {
                              newDays = recurrenceConfig.giorniSettimana.filter((x) => x !== d.index);
                              if (newDays.length === 0) newDays = [d.index];
                            } else {
                              newDays = [...recurrenceConfig.giorniSettimana, d.index];
                            }
                            setRecurrenceConfig((prev) => ({ ...prev, giorniSettimana: newDays }));
                          }}
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                            sel
                              ? 'bg-yellow-400 text-black font-extrabold ring-2 ring-yellow-300 scale-105'
                              : 'bg-neutral-800 text-neutral-400 hover:text-yellow-300 hover:bg-neutral-700'
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>



          {/* Strumentazione Necessaria per il cliente */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Descrizione Strumentazione Necessaria / Setup Richiesto
            </label>
            <textarea
              rows={2}
              value={richiesteStrumentazione}
              onChange={(e) => setRichiesteStrumentazione(e.target.value)}
              placeholder="Es. Batteria 5 pezzi con piatti, 2 ampli Marshall, 3 microfoni voce..."
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Importo, Sconto & Pagamento (Solo per Prove Musicali) */}
          {tipo !== 'lezione' ? (
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Tariffa Base (€) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Tariffa Base (€)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={tariffaBase}
                      onFocus={handleNumericFocus}
                      onClick={handleNumericClick}
                      onBlur={handleNumericBlur}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*$/.test(val)) {
                          handleTariffaBaseChange(val);
                        }
                      }}
                      placeholder=""
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 font-bold text-sm"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-400">€</span>
                  </div>
                </div>

                {/* Sconto (€) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Sconto (€)</span>
                    {Number(sconto) > 0 && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        -{sconto}€
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={sconto === 0 || sconto === '0' ? '' : sconto}
                      placeholder="0"
                      onFocus={handleNumericFocus}
                      onClick={handleNumericClick}
                      onBlur={handleNumericBlur}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*$/.test(val)) {
                          handleScontoChange(val);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 font-bold text-sm"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-400">€</span>
                  </div>
                </div>

                {/* Tariffa Totale Finale (€) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Tariffa Totale (€)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={tariffaTotale}
                      onFocus={handleNumericFocus}
                      onClick={handleNumericClick}
                      onBlur={handleNumericBlur}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*$/.test(val)) {
                          setCustomTariffa(true);
                          setTariffaTotale(val);
                        }
                      }}
                      placeholder=""
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 font-bold text-sm"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-400">€</span>
                  </div>
                </div>
              </div>

              {/* Stato Pagamento & Metodo Pagamento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Stato Pagamento
                  </label>
                  <select
                    value={statoPagamento}
                    onChange={(e) => setStatoPagamento(e.target.value as PaymentStatus)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800"
                  >
                    <option value="da_saldare">⏳ Da Saldare</option>
                    <option value="pagato">✅ Pagato</option>
                  </select>
                </div>

                {statoPagamento === 'pagato' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Metodo Pagamento
                    </label>
                    <select
                      value={metodoPagamento}
                      onChange={(e) => setMetodoPagamento(e.target.value as PaymentMethod)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800"
                    >
                      <option value="pos">POS / Carta</option>
                      <option value="contanti">Contanti</option>
                      <option value="bonifico">Bonifico</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-100 border border-purple-200 text-purple-700 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="text-xs text-purple-950 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-purple-900">Lezione di Musica / Canto</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-200/80 text-purple-800 tracking-wide border border-purple-300/60">
                    Quota Sala 5€/h
                  </span>
                </div>
                <p className="text-purple-800/80 leading-relaxed">
                  Per le lezioni il prezzo non viene specificato qui. La sala prove conteggerà automaticamente nella sezione <strong>Conti & Bollette</strong> la quota di utilizzo pari a <strong>5€ per ogni ora svolta</strong> dal docente, con opzione di saldo.
                </p>
              </div>
            </div>
          )}

          {/* Note generali */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Note aggiuntive
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note di sala, richieste particolari o saldo rimasto..."
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          </div>
        </form>
      </div>

      {/* Recurrence Popup Modal matching the user's screenshot */}
      <RecurrenceModal
        isOpen={isRecurrenceModalOpen}
        onClose={() => setIsRecurrenceModalOpen(false)}
        startDate={data}
        initialConfig={recurrenceConfig}
        onSave={(newConfig) => {
          setRecurrenceConfig(newConfig);
          setRipetizioneSettimanale(newConfig.attiva);
          if (newConfig.tipoFine === 'per_sempre') {
            setRepeatOption('per_sempre');
            setRepeatWeeks(52);
          } else if (newConfig.conteggioOccorrenze && [2, 4, 8, 12, 24, 52].includes(newConfig.conteggioOccorrenze)) {
            setRepeatOption(String(newConfig.conteggioOccorrenze));
            setRepeatWeeks(newConfig.conteggioOccorrenze);
          } else {
            setRepeatOption('personalizzata');
            setRepeatWeeks(newConfig.conteggioOccorrenze || 4);
          }
        }}
      />
      {/* Modal Eliminazione Serie Ricorrente */}
      <DeleteRecurringBookingModal
        isOpen={isRecurringDeleteOpen}
        booking={bookingToEdit}
        roomName={rooms.find(r => r.id === bookingToEdit?.salaId)?.nome}
        onClose={() => setIsRecurringDeleteOpen(false)}
        onConfirm={handleConfirmRecurringDelete}
      />
      {/* Schermata di controllo: conferma prenotazione nel passato */}
      <PastBookingConfirmModal
        isOpen={isPastConfirmOpen}
        date={data}
        startTime={oraInizio}
        endTime={oraFine}
        roomName={selectedRoom?.nome}
        clientName={
          isManualClient
            ? manualClientName.trim()
            : selectedClient
              ? `${selectedClient.nome} ${selectedClient.cognome}${
                  selectedClient.gruppoBand ? ` (${selectedClient.gruppoBand})` : ''
                }`
              : ''
        }
        onClose={() => setIsPastConfirmOpen(false)}
        onConfirm={() => {
          setIsPastConfirmOpen(false);
          executeActualSave();
        }}
      />
      {/* Modal Condivisione Promemoria WhatsApp */}
      {isWhatsAppReminderOpen && (
        <BookingWhatsAppModal
          isOpen={isWhatsAppReminderOpen}
          onClose={() => setIsWhatsAppReminderOpen(false)}
          booking={bookingToEdit}
        />
      )}
    </div>
  );
};
