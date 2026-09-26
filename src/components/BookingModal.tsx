import React, { useEffect, useState } from 'react';
import { X, Calendar, Clock, AlertCircle, CheckCircle2, RefreshCw, Music2, GraduationCap, Edit3, Users, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Booking, BookingType, PaymentMethod, PaymentStatus, RecurrenceConfig } from '../types';
import { calculateDurationHours, formatDateToISO, getRecurrenceSummary, parseISODate, timeToMinutes, minutesToTime } from '../utils/dateUtils';
import { checkOperatorAvailability } from '../utils/scheduler';
import { RecurrenceModal } from './RecurrenceModal';
import { SmartTimePicker } from './SmartTimePicker';
import { handleNumericFocus, handleNumericClick, handleNumericBlur } from '../utils/inputUtils';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  initialRoomId?: string;
  initialType?: BookingType;
  bookingToEdit?: Booking | null;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  initialDate,
  initialRoomId,
  initialType,
  bookingToEdit,
}) => {
  const { clients, rooms, staff, bookings, addBooking, updateBooking, deleteBooking } = useApp();

  const [clienteId, setClienteId] = useState('');
  const [isManualClient, setIsManualClient] = useState(true);
  const [manualClientName, setManualClientName] = useState('');
  const [salaId, setSalaId] = useState('');
  const [tipo, setTipo] = useState<BookingType>('prove');
  const [insegnanteId, setInsegnanteId] = useState('');
  const [data, setData] = useState(initialDate || formatDateToISO(new Date()));
  const [oraInizio, setOraInizio] = useState('18:00');
  const [oraFine, setOraFine] = useState('20:00');
  const [ripetizioneSettimanale, setRipetizioneSettimanale] = useState(false);
  const [repeatOption, setRepeatOption] = useState<string>('per_sempre');
  const [repeatWeeks, setRepeatWeeks] = useState(4);
  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);
  const [recurrenceConfig, setRecurrenceConfig] = useState<RecurrenceConfig>({
    attiva: false,
    frequenza: 'settimanale',
    intervallo: 1,
    giorniSettimana: [new Date().getDay()],
    tipoFine: 'per_sempre',
    conteggioOccorrenze: 4,
  });
  const [operatoreAssegnatoId, setOperatoreAssegnatoId] = useState('');
  const [tariffaBase, setTariffaBase] = useState<string | number>(36);
  const [sconto, setSconto] = useState<string | number>(0);
  const [tariffaTotale, setTariffaTotale] = useState<string | number>(36);
  const [customTariffa, setCustomTariffa] = useState(false);
  const [statoPagamento, setStatoPagamento] = useState<PaymentStatus>('da_saldare');
  const [metodoPagamento, setMetodoPagamento] = useState<PaymentMethod>('pos');
  const [richiesteStrumentazione, setRichiesteStrumentazione] = useState('');
  const [note, setNote] = useState('');

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
      setOperatoreAssegnatoId(bookingToEdit.operatoreAssegnatoId || '');
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
      const defaultTipo = initialType || 'prove';
      setIsManualClient(true);
      setManualClientName('');
      setClienteId('');
      setSalaId(initialRoomId || rooms[0]?.id || '');
      setTipo(defaultTipo);
      setInsegnanteId('');
      setData(defaultDate);
      setOraInizio('18:00');
      setOraFine(defaultTipo === 'lezione' ? '19:00' : '20:00');
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
      setOperatoreAssegnatoId('');
      setSconto(0);
      setCustomTariffa(false);
      setStatoPagamento('da_saldare');
      setMetodoPagamento('pos');
      setRichiesteStrumentazione('');
      setNote('');
    }
  }, [bookingToEdit, initialDate, initialRoomId, isOpen, clients, rooms]);

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
      // Quando si seleziona 'lezione', imposta automaticamente 1 ora di lezione (anziché 2 ore)
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
      if (tipo === 'lezione') {
        // Nelle lezioni mantieni la durata automatica di 1 ora
        setOraFine(minutesToTime(startMin + 60));
      } else {
        const endMin = timeToMinutes(oraFine);
        if (endMin <= startMin) {
          setOraFine(minutesToTime(startMin + 120));
        }
      }
    }
  };

  // Recalculate price automatically if not manually set
  useEffect(() => {
    const room = rooms.find((r) => r.id === salaId);
    if (!room) return;
    const hours = calculateDurationHours(oraInizio, oraFine);
    const rate = tipo === 'lezione' && room.tariffaLezione ? room.tariffaLezione : room.tariffaOraria;
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

  if (!isOpen) return null;

  const durationHours = calculateDurationHours(oraInizio, oraFine);
  const selectedClient = clients.find((c) => c.id === clienteId);
  const selectedRoom = rooms.find((r) => r.id === salaId);

  // Eligible operators for shift
  const operatorCandidates = staff
    .filter((s) => s.attivo && (s.ruolo === 'operatore' || s.ruolo === 'entrambi'))
    .map((op) => {
      const avail = checkOperatorAvailability(
        op,
        data,
        oraInizio,
        oraFine,
        bookings,
        bookingToEdit?.id
      );
      return {
        operator: op,
        available: avail.available,
        statusText: avail.statusText,
        isContinuous: avail.isContinuousPossible,
      };
    });

  // Teachers list
  const teacherCandidates = staff.filter(
    (s) => s.attivo && (s.ruolo === 'insegnante' || s.ruolo === 'entrambi')
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

    const op = staff.find((s) => s.id === operatoreAssegnatoId);
    const teacher = staff.find((s) => s.id === insegnanteId);

    const clientDisplayName = finalClienteNome;

    const isRecurring = !bookingToEdit && (ripetizioneSettimanale || recurrenceConfig.attiva);
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
        ripetizioneSettimanale: recurrenceConfig.attiva,
        settimaneRipetizione: recurrenceConfig.attiva ? (recurrenceConfig.conteggioOccorrenze || 4) : 1,
        recurrenceConfig: recurrenceConfig.attiva ? recurrenceConfig : undefined,
        operatoreAssegnatoId: operatoreAssegnatoId || undefined,
        operatoreAssegnatoNome: op ? `${op.nome} ${op.cognome}` : undefined,
        tariffaTotale: Number(tariffaTotale),
        sconto: Number(sconto) || 0,
        statoPagamento,
        metodoPagamento: statoPagamento === 'pagato' ? metodoPagamento : undefined,
        richiesteStrumentazione,
        note,
      });
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
        operatoreAssegnatoId: operatoreAssegnatoId || undefined,
        operatoreAssegnatoNome: op ? `${op.nome} ${op.cognome}` : undefined,
        tariffaTotale: Number(tariffaTotale),
        sconto: Number(sconto) || 0,
        statoPagamento,
        metodoPagamento: statoPagamento === 'pagato' ? metodoPagamento : undefined,
        richiesteStrumentazione,
        note,
      });
    }

    onClose();
  };

  const handleDeleteCurrentBooking = () => {
    if (!bookingToEdit) return;
    if (bookingToEdit.gruppoRicorrenzaId) {
      const choice = window.confirm(
        'Questa prenotazione fa parte di una serie ricorrente.\n\nPremi OK per eliminare TUTTA la serie settimanale, oppure ANNULLA per eliminare solo questo singolo giorno.'
      );
      deleteBooking(bookingToEdit.id, choice);
    } else {
      if (window.confirm(`Sei sicuro di voler eliminare la prenotazione di ${bookingToEdit.clienteNome}?`)) {
        deleteBooking(bookingToEdit.id);
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              {tipo === 'prove' ? <Music2 className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                {bookingToEdit ? 'Modifica Prenotazione' : 'Nuova Prenotazione Sala'}
              </h2>
              <p className="text-xs text-slate-500">
                {tipo === 'prove' ? 'Sessione Prove Musicali / Band' : 'Lezione di Musica / Canto'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 max-h-[82vh] overflow-y-auto">
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
                    autoFocus
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
                        {c.statoTesseramento === 'attivo' ? 'Attiva' : 'Scaduta/Attesa'}
                      </option>
                    ))}
                  </select>
                  {selectedClient && selectedClient.statoTesseramento !== 'attivo' && (
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-amber-700 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Attenzione: tesseramento {selectedClient.statoTesseramento}. Da rinnovare!</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Sala Prove *
              </label>
              <select
                required
                value={salaId}
                onChange={(e) => setSalaId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="">-- Seleziona sala --</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome} (€{r.tariffaOraria}/h) - Capienza: {r.capienza}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Insegnante (se lezione) */}
          {tipo === 'lezione' && (
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-lg">
              <label className="block text-xs font-semibold text-indigo-900 uppercase tracking-wider mb-1.5">
                Docente / Insegnante incaricato
              </label>
              <select
                value={insegnanteId}
                onChange={(e) => setInsegnanteId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-indigo-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="">-- Seleziona insegnante --</option>
                {teacherCandidates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome} {t.cognome} {t.materieInsegnamento ? `(${t.materieInsegnamento})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Data Prenotazione */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              <Calendar className="w-3.5 h-3.5 inline mr-1 text-slate-400" /> Data Prenotazione *
            </label>
            <input
              type="date"
              required
              value={data}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
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
          {!bookingToEdit && (
            <div className="p-3.5 bg-neutral-900 border border-yellow-500/40 rounded-xl space-y-2.5 shadow-sm text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className={`w-4 h-4 text-yellow-400 ${ripetizioneSettimanale ? 'animate-spin-slow' : ''}`} />
                  <span className="text-sm font-bold text-yellow-300">Ripetizione Settimanale Fissa</span>
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
          )}

          {/* Assegnazione Operatore (con verifica disponibilità e turni lavoro primario) */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Operatore Assegnato al Presidio Sala
              </label>
              <span className="text-[11px] text-slate-500">
                Disponibilità calcolata in tempo reale (24h - lavoro primario)
              </span>
            </div>
            <select
              value={operatoreAssegnatoId}
              onChange={(e) => setOperatoreAssegnatoId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            >
              <option value="">-- Assegna in seguito (o usa Auto-Assegnazione Intelligente) --</option>
              {operatorCandidates.map(({ operator, available, statusText, isContinuous }) => (
                <option
                  key={operator.id}
                  value={operator.id}
                  className={available ? 'text-slate-900 font-medium' : 'text-slate-400'}
                >
                  {operator.nome} {operator.cognome} — {available ? '✅ ' : '❌ '}
                  {statusText} {isContinuous ? '⚡ (Turno Continuativo)' : ''}
                </option>
              ))}
            </select>
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

          {/* Importo, Sconto & Pagamento */}
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

          {/* Footer actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3 flex-wrap">
            {bookingToEdit ? (
              <button
                type="button"
                onClick={handleDeleteCurrentBooking}
                className="px-3.5 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 border border-rose-500/30 text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                title="Elimina questa prenotazione"
              >
                <Trash2 className="w-4 h-4" />
                <span>Elimina Prenotazione</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2 sm:gap-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                {bookingToEdit ? 'Salva Modifiche' : 'Conferma Prenotazione'}
              </button>
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
    </div>
  );
};
