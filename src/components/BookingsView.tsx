import React, { useState } from 'react';
import {
  Plus,
  Search,
  Calendar,
  Clock,
  User,
  Music2,
  GraduationCap,
  RefreshCw,
  Trash2,
  Edit2,
  CheckCircle2,
  CreditCard,
  Printer,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Booking, BookingType, PaymentStatus } from '../types';
import { formatDateItalian, formatCurrency } from '../utils/dateUtils';
import { BookingModal } from './BookingModal';
import { OperatorSchedulePrintModal } from './OperatorSchedulePrintModal';

export const BookingsView: React.FC = () => {
  const { bookings, rooms, deleteBooking, updateBooking } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | BookingType>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentStatus>('all');
  const [roomFilter, setRoomFilter] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bookingToEdit, setBookingToEdit] = useState<Booking | null>(null);
  const [isSchedulePrintOpen, setIsSchedulePrintOpen] = useState(false);

  // Filter bookings
  const filteredBookings = bookings
    .filter((b) => {
      const matchSearch =
        b.clienteNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.salaNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.operatoreAssegnatoNome &&
          b.operatoreAssegnatoNome.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchType = typeFilter === 'all' || b.tipo === typeFilter;
      const matchPayment = paymentFilter === 'all' || b.statoPagamento === paymentFilter;
      const matchRoom = roomFilter === 'all' || b.salaId === roomFilter;
      return matchSearch && matchType && matchPayment && matchRoom;
    })
    .sort((a, b) => {
      if (a.data !== b.data) return b.data.localeCompare(a.data); // Newest first
      return a.oraInizio.localeCompare(b.oraInizio);
    });

  // Stats
  const totalIncome = bookings.reduce((sum, b) => sum + b.tariffaTotale, 0);
  const paidIncome = bookings
    .filter((b) => b.statoPagamento === 'pagato')
    .reduce((sum, b) => sum + b.tariffaTotale, 0);
  const pendingIncome = totalIncome - paidIncome;

  const handleTogglePayment = (booking: Booking) => {
    updateBooking({
      ...booking,
      statoPagamento: booking.statoPagamento === 'pagato' ? 'da_saldare' : 'pagato',
      metodoPagamento: booking.statoPagamento === 'pagato' ? undefined : 'pos',
    });
  };

  const handleDelete = (booking: Booking) => {
    if (booking.gruppoRicorrenzaId) {
      const choice = window.confirm(
        'Questa prenotazione fa parte di una serie ricorrente.\n\nPremi OK per eliminare TUTTA la serie settimanale, oppure ANNULLA per eliminare solo questo singolo giorno.'
      );
      deleteBooking(booking.id, choice);
    } else {
      if (window.confirm(`Sei sicuro di voler eliminare la prenotazione di ${booking.clienteNome}?`)) {
        deleteBooking(booking.id);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Totale Prenotazioni
            </p>
            <p className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 mt-1">{bookings.length}</p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Incassi Saldati
            </p>
            <p className="text-2xl sm:text-3xl font-bold font-mono text-emerald-600 mt-1">
              {formatCurrency(paidIncome)}
            </p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Da Saldare
            </p>
            <p className="text-2xl sm:text-3xl font-bold font-mono text-slate-700 mt-1">
              {formatCurrency(pendingIncome)}
            </p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cerca per cliente, band, sala o operatore..."
            className="w-full pl-10 pr-4 py-2.5 min-h-[44px] text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 touch-manipulation"
          />
        </div>

        {/* Dropdowns & Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2.5 min-h-[44px] text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-hidden touch-manipulation cursor-pointer"
          >
            <option value="all">Tutti i tipi</option>
            <option value="prove">Solo Prove</option>
            <option value="lezione">Solo Lezioni</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as any)}
            className="px-3 py-2.5 min-h-[44px] text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-hidden touch-manipulation cursor-pointer"
          >
            <option value="all">Tutti i pagamenti</option>
            <option value="pagato">Saldati</option>
            <option value="da_saldare">Da saldare</option>
          </select>

          <select
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            className="px-3 py-2.5 min-h-[44px] text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-hidden touch-manipulation cursor-pointer"
          >
            <option value="all">Tutte le sale</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsSchedulePrintOpen(true)}
            className="px-3.5 py-2.5 min-h-[44px] bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 shadow-2xs transition-all flex items-center gap-2 touch-manipulation touch-active cursor-pointer"
            title="Stampa o esporta PDF del catalogo appuntamenti operatori"
          >
            <Printer className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">Stampa Turni</span>
          </button>

          <button
            onClick={() => {
              setBookingToEdit(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 touch-manipulation touch-active cursor-pointer ml-auto sm:ml-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nuova Prenotazione</span>
          </button>
        </div>
      </div>

      {/* ── Mobile Stacked Cards Layout (Eliminates horizontal scrolling on smartphone) ── */}
      <div className="md:hidden space-y-3">
        {filteredBookings.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
            Nessuna prenotazione trovata con i filtri attuali.
          </div>
        ) : (
          filteredBookings.map((b) => {
            const room = rooms.find((r) => r.id === b.salaId);
            const isPaid = b.statoPagamento === 'pagato';

            return (
              <div
                key={`mobile-${b.id}`}
                className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-xs hover:border-slate-300 transition-colors"
              >
                {/* Header: Date & Time */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">
                      {formatDateItalian(b.data, true)}
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-xs text-slate-500 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{b.oraInizio} - {b.oraFine} ({b.durataOre}h)</span>
                    </div>
                  </div>
                  {b.ripetizioneSettimanale && (
                    <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                      <RefreshCw className="w-3 h-3" /> Fissa
                    </span>
                  )}
                </div>

                {/* Body: Client, Amount, Room & Type */}
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="font-bold text-slate-900 text-base leading-tight">
                      {b.clienteNome}
                    </h4>
                    <span className="font-mono font-bold text-slate-900 text-base shrink-0">
                      {formatCurrency(b.tariffaTotale)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Room badge */}
                    <div className="flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-md bg-slate-50 border border-slate-200">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: room?.colore || '#facc15' }}
                      />
                      <span>{b.salaNome}</span>
                    </div>

                    {/* Booking Type badge */}
                    {b.tipo === 'prove' ? (
                      <span className="text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
                        <Music2 className="w-3.5 h-3.5" /> Prove Band
                      </span>
                    ) : (
                      <span className="text-slate-700 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5" /> Lezione {b.insegnanteNome ? `(${b.insegnanteNome})` : ''}
                      </span>
                    )}
                  </div>

                  {/* Instrument requests */}
                  {b.richiesteStrumentazione && (
                    <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      🎸 <span className="font-medium">{b.richiesteStrumentazione}</span>
                    </div>
                  )}

                  {/* Operator Presidio / Docente */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-500 font-medium">Presidio / Docente:</span>
                    {b.tipo === 'lezione' ? (
                      <div className="flex items-center gap-1.5 font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        <GraduationCap className="w-3.5 h-3.5 text-yellow-600" />
                        <span>{b.insegnanteNome || 'Insegnante'}</span>
                      </div>
                    ) : b.operatoreAssegnatoNome ? (
                      <div className="flex items-center gap-1.5 font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        <User className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{b.operatoreAssegnatoNome}</span>
                      </div>
                    ) : (
                      <span className="text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-medium">
                        Turno Sala (17:00-23:00)
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions: Large Payment Toggle + Edit & Delete with 44px touch targets */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => handleTogglePayment(b)}
                    className={`flex-1 min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all touch-manipulation touch-active ${
                      isPaid
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                        : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    <span>{isPaid ? '✅ Saldato' : '⏳ Da Saldare (Tocca per pagare)'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setBookingToEdit(b);
                      setIsModalOpen(true);
                    }}
                    className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 flex items-center justify-center transition-all touch-manipulation touch-active cursor-pointer shrink-0"
                    title="Modifica prenotazione"
                    aria-label="Modifica prenotazione"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(b)}
                    className="w-11 h-11 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center transition-all touch-manipulation touch-active cursor-pointer shrink-0"
                    title="Elimina prenotazione"
                    aria-label="Elimina prenotazione"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Desktop Bookings Table (Hidden on mobile) ── */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Data & Orario</th>
                <th className="py-3 px-4">Cliente / Band</th>
                <th className="py-3 px-4">Tipo & Sala</th>
                <th className="py-3 px-4">Presidio / Docente</th>
                <th className="py-3 px-4">Importo & Stato</th>
                <th className="py-3 px-4 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    Nessuna prenotazione trovata con i filtri attuali.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => {
                  const room = rooms.find((r) => r.id === b.salaId);
                  const isPaid = b.statoPagamento === 'pagato';

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Date & Time */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 text-xs">
                          {formatDateItalian(b.data, true)}
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500 mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {b.oraInizio} - {b.oraFine} ({b.durataOre}h)
                          </span>
                          {b.ripetizioneSettimanale && (
                            <span
                              className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold px-1.5 py-0.2 rounded flex items-center gap-0.5"
                              title="Prenotazione ricorrente settimanale"
                            >
                              <RefreshCw className="w-2.5 h-2.5" /> Fissa
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Client / Band */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{b.clienteNome}</div>
                        {b.richiesteStrumentazione && (
                          <div
                            className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5"
                            title={b.richiesteStrumentazione}
                          >
                            🎸 {b.richiesteStrumentazione}
                          </div>
                        )}
                      </td>

                      {/* Room & Type */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: room?.colore || '#4f46e5' }}
                          />
                          <span>{b.salaNome}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                          {b.tipo === 'prove' ? (
                            <span className="text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                              <Music2 className="w-3 h-3" /> Prove Band
                            </span>
                          ) : (
                            <span className="text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                              <GraduationCap className="w-3 h-3" /> Lezione {b.insegnanteNome ? `(${b.insegnanteNome})` : ''}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Operator */}
                      <td className="py-3.5 px-4">
                        {b.tipo === 'lezione' ? (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                            <GraduationCap className="w-3.5 h-3.5 text-yellow-600" />
                            <span>{b.insegnanteNome || 'Insegnante'}</span>
                          </div>
                        ) : b.operatoreAssegnatoNome ? (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                            <User className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{b.operatoreAssegnatoNome}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md w-max inline-block">
                            Turno Sala
                          </span>
                        )}
                      </td>

                      {/* Price & Payment */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold font-mono text-slate-900 text-sm">
                          {formatCurrency(b.tariffaTotale)}
                        </div>
                        <button
                          onClick={() => handleTogglePayment(b)}
                          className={`mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                            isPaid
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                              : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                          }`}
                          title="Clicca per invertire stato pagamento"
                        >
                          {isPaid ? '✅ Saldato' : '⏳ Da Saldare'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right space-x-1.5">
                        <button
                          onClick={() => {
                            setBookingToEdit(b);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
                          title="Modifica prenotazione"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(b)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 rounded-md hover:bg-rose-50 transition-colors"
                          title="Elimina"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BookingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        bookingToEdit={bookingToEdit}
      />

      <OperatorSchedulePrintModal
        isOpen={isSchedulePrintOpen}
        onClose={() => setIsSchedulePrintOpen(false)}
      />
    </div>
  );
};
