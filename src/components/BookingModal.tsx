import React, { useEffect, useState } from 'react';
import { X, Calendar, Clock, AlertCircle, CheckCircle2, RefreshCw, Music2, GraduationCap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Booking, BookingType, PaymentMethod, PaymentStatus } from '../types';
import { calculateDurationHours, formatDateToISO } from '../utils/dateUtils';
import { checkOperatorAvailability } from '../utils/scheduler';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  initialRoomId?: string;
  bookingToEdit?: Booking | null;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  initialDate,
  initialRoomId,
  bookingToEdit,
}) => {
  const { clients, rooms, staff, bookings, addBooking, updateBooking } = useApp();

  const [clienteId, setClienteId] = useState('');
  const [salaId, setSalaId] = useState('');
  const [tipo, setTipo] = useState<BookingType>('prove');
  const [insegnanteId, setInsegnanteId] = useState('');
  const [data, setData] = useState(initialDate || formatDateToISO(new Date()));
  const [oraInizio, setOraInizio] = useState('18:00');
  const [oraFine, setOraFine] = useState('20:00');
  const [ripetizioneSettimanale, setRipetizioneSettimanale] = useState(false);
  const [repeatWeeks, setRepeatWeeks] = useState(4);
  const [operatoreAssegnatoId, setOperatoreAssegnatoId] = useState('');
  const [tariffaTotale, setTariffaTotale] = useState(36);
  const [customTariffa, setCustomTariffa] = useState(false);
  const [statoPagamento, setStatoPagamento] = useState<PaymentStatus>('da_saldare');
  const [metodoPagamento, setMetodoPagamento] = useState<PaymentMethod>('pos');
  const [richiesteStrumentazione, setRichiesteStrumentazione] = useState('');
  const [note, setNote] = useState('');

  // Pre-fill on open/edit
  useEffect(() => {
    if (bookingToEdit) {
      setClienteId(bookingToEdit.clienteId);
      setSalaId(bookingToEdit.salaId);
      setTipo(bookingToEdit.tipo);
      setInsegnanteId(bookingToEdit.insegnanteId || '');
      setData(bookingToEdit.data);
      setOraInizio(bookingToEdit.oraInizio);
      setOraFine(bookingToEdit.oraFine);
      setRipetizioneSettimanale(bookingToEdit.ripetizioneSettimanale);
      setRepeatWeeks(bookingToEdit.settimaneRipetizione || 4);
      setOperatoreAssegnatoId(bookingToEdit.operatoreAssegnatoId || '');
      setTariffaTotale(bookingToEdit.tariffaTotale);
      setCustomTariffa(true);
      setStatoPagamento(bookingToEdit.statoPagamento);
      setMetodoPagamento(bookingToEdit.metodoPagamento || 'pos');
      setRichiesteStrumentazione(bookingToEdit.richiesteStrumentazione || '');
      setNote(bookingToEdit.note || '');
    } else {
      setClienteId(clients[0]?.id || '');
      setSalaId(initialRoomId || rooms[0]?.id || '');
      setTipo('prove');
      setInsegnanteId('');
      setData(initialDate || formatDateToISO(new Date()));
      setOraInizio('18:00');
      setOraFine('20:00');
      setRipetizioneSettimanale(false);
      setRepeatWeeks(4);
      setOperatoreAssegnatoId('');
      setCustomTariffa(false);
      setStatoPagamento('da_saldare');
      setMetodoPagamento('pos');
      setRichiesteStrumentazione('');
      setNote('');
    }
  }, [bookingToEdit, initialDate, initialRoomId, isOpen, clients, rooms]);

  // When client changes, automatically copy default gear description
  const handleClientChange = (cId: string) => {
    setClienteId(cId);
    const client = clients.find((c) => c.id === cId);
    if (client && client.descrizioneStrumentazione && !bookingToEdit) {
      setRichiesteStrumentazione(client.descrizioneStrumentazione);
    }
  };

  // Recalculate price automatically if not manually set
  useEffect(() => {
    if (customTariffa) return;
    const room = rooms.find((r) => r.id === salaId);
    if (!room) return;
    const hours = calculateDurationHours(oraInizio, oraFine);
    const rate = tipo === 'lezione' && room.tariffaLezione ? room.tariffaLezione : room.tariffaOraria;
    setTariffaTotale(Math.round(hours * rate));
  }, [salaId, tipo, oraInizio, oraFine, customTariffa, rooms]);

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
    if (!selectedClient || !selectedRoom) return;

    const op = staff.find((s) => s.id === operatoreAssegnatoId);
    const teacher = staff.find((s) => s.id === insegnanteId);

    const clientDisplayName = `${selectedClient.nome} ${selectedClient.cognome}${
      selectedClient.gruppoBand ? ` (${selectedClient.gruppoBand})` : ''
    }`;

    if (bookingToEdit) {
      updateBooking({
        ...bookingToEdit,
        clienteId,
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
        ripetizioneSettimanale,
        settimaneRipetizione: ripetizioneSettimanale ? repeatWeeks : 1,
        operatoreAssegnatoId: operatoreAssegnatoId || undefined,
        operatoreAssegnatoNome: op ? `${op.nome} ${op.cognome}` : undefined,
        tariffaTotale: Number(tariffaTotale),
        statoPagamento,
        metodoPagamento: statoPagamento === 'pagato' ? metodoPagamento : undefined,
        richiesteStrumentazione,
        note,
      });
    } else {
      addBooking({
        clienteId,
        clienteNome: clientDisplayName,
        salaId,
        salaNome: selectedRoom.nome,
        tipo,
        insegnanteId: tipo === 'lezione' ? insegnanteId : undefined,
        insegnanteNome: tipo === 'lezione' && teacher ? `${teacher.nome} ${teacher.cognome}` : undefined,
        data,
        oraInizio,
        oraFine,
        ripetizioneSettimanale,
        repeatWeeks: ripetizioneSettimanale ? repeatWeeks : 1,
        operatoreAssegnatoId: operatoreAssegnatoId || undefined,
        operatoreAssegnatoNome: op ? `${op.nome} ${op.cognome}` : undefined,
        tariffaTotale: Number(tariffaTotale),
        statoPagamento,
        metodoPagamento: statoPagamento === 'pagato' ? metodoPagamento : undefined,
        richiesteStrumentazione,
        note,
      });
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
                onClick={() => setTipo('prove')}
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
                onClick={() => setTipo('lezione')}
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
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Cliente / Tesserato *
              </label>
              <select
                required
                value={clienteId}
                onChange={(e) => handleClientChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="">-- Seleziona cliente --</option>
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

          {/* Data & Orari */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                <Calendar className="w-3.5 h-3.5 inline mr-1 text-slate-400" /> Data *
              </label>
              <input
                type="date"
                required
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                <Clock className="w-3.5 h-3.5 inline mr-1 text-slate-400" /> Ora Inizio *
              </label>
              <input
                type="time"
                required
                value={oraInizio}
                onChange={(e) => setOraInizio(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                <Clock className="w-3.5 h-3.5 inline mr-1 text-slate-400" /> Ora Fine *
              </label>
              <input
                type="time"
                required
                value={oraFine}
                onChange={(e) => setOraFine(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>
          <div className="text-xs text-slate-500 px-1 flex items-center justify-between">
            <span>Durata sessione: <strong className="text-slate-800">{durationHours} ore</strong></span>
            {durationHours <= 0 && (
              <span className="text-rose-500 font-medium">L'orario di fine deve essere successivo all'inizio</span>
            )}
          </div>

          {/* Ripetizione Settimanale */}
          {!bookingToEdit && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm font-semibold text-slate-800">Ripetizione Settimanale Fissa</span>
                </div>
                <input
                  type="checkbox"
                  id="ripetizione"
                  checked={ripetizioneSettimanale}
                  onChange={(e) => setRipetizioneSettimanale(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
              </div>
              {ripetizioneSettimanale && (
                <div className="flex items-center gap-3 pt-2 text-xs text-slate-600 border-t border-slate-200">
                  <span>Ripeti per:</span>
                  <select
                    value={repeatWeeks}
                    onChange={(e) => setRepeatWeeks(Number(e.target.value))}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800"
                  >
                    <option value={2}>2 settimane consecutive</option>
                    <option value={4}>4 settimane (1 mese)</option>
                    <option value={8}>8 settimane (2 mesi)</option>
                    <option value={12}>12 settimane (3 mesi)</option>
                  </select>
                  <span className="text-slate-500">
                    (Verranno create {repeatWeeks} prenotazioni nello stesso giorno e orario)
                  </span>
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

          {/* Importo & Pagamento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-lg border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Tariffa Totale (€)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={tariffaTotale}
                  onChange={(e) => {
                    setCustomTariffa(true);
                    setTariffaTotale(Number(e.target.value));
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 font-bold text-sm"
                />
                <span className="absolute right-3 top-2 text-xs text-slate-400">€</span>
              </div>
            </div>
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
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-xs transition-colors flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {bookingToEdit ? 'Salva Modifiche' : 'Conferma Prenotazione'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
