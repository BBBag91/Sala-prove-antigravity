import React, { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  Music2,
  GraduationCap,
  RefreshCw,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Printer,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Booking, BookingType, PaymentStatus } from '../types';
import { formatDateItalian, formatCurrency } from '../utils/dateUtils';
import { BookingModal } from './BookingModal';
import { OperatorSchedulePrintModal } from './OperatorSchedulePrintModal';

export const BookingsView: React.FC = () => {
  const { bookings, rooms, staff, deleteBooking, updateBooking } = useApp();

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
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cerca per cliente, band, sala o operatore..."
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-hidden"
          >
            <option value="all">Tutti i tipi</option>
            <option value="prove">Solo Prove</option>
            <option value="lezione">Solo Lezioni</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as any)}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-hidden"
          >
            <option value="all">Tutti i pagamenti</option>
            <option value="pagato">Saldati</option>
            <option value="da_saldare">Da saldare</option>
          </select>

          <select
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-hidden"
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
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200 shadow-2xs transition-colors flex items-center gap-1.5"
            title="Stampa o esporta PDF del catalogo appuntamenti operatori"
          >
            <Printer className="w-4 h-4 text-indigo-600" />
            <span>Stampa Turni Operatori</span>
          </button>

          <button
            onClick={() => {
              setBookingToEdit(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Nuova Prenotazione</span>
          </button>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Data & Orario</th>
                <th className="py-3 px-4">Cliente / Band</th>
                <th className="py-3 px-4">Tipo & Sala</th>
                <th className="py-3 px-4">Operatore Presidio</th>
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
                        {b.operatoreAssegnatoNome ? (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                            <User className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{b.operatoreAssegnatoNome}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md flex items-center gap-1 w-max">
                            <AlertCircle className="w-3 h-3" /> Da Assegnare
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
