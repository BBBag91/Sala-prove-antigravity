import React, { useState, useMemo } from 'react';
import {
  X,
  Music2,
  Search,
  Printer,
  Clock,
  DoorOpen,
  SlidersHorizontal,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';
import { Booking, Room, Client } from '../types';
import { formatDateItalian, MESI_ITALIANI, formatDateToISO } from '../utils/dateUtils';

interface EquipmentOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookings: Booking[];
  rooms: Room[];
  clients?: Client[];
  currentYear: number;
  currentMonth: number;
  onSelectBooking?: (booking: Booking) => void;
}

import { parseEquipmentItems, getAllEquipmentForBooking } from '../utils/equipmentUtils';
export { parseEquipmentItems, getAllEquipmentForBooking };

export const EquipmentOverviewModal: React.FC<EquipmentOverviewModalProps> = ({
  isOpen,
  onClose,
  bookings,
  rooms,
  clients = [],
  currentYear,
  currentMonth,
  onSelectBooking,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('all');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const todayISO = formatDateToISO(new Date());

  // Filter bookings that belong to current month and have requested equipment
  const monthBookingsWithEquipment = useMemo(() => {
    return bookings
      .filter((b) => b.data.startsWith(monthPrefix))
      .sort((a, b) => {
        const cmp = a.data.localeCompare(b.data);
        if (cmp !== 0) return cmp;
        return a.oraInizio.localeCompare(b.oraInizio);
      });
  }, [bookings, monthPrefix]);

  // Unique days in this month that have bookings
  const uniqueDays = useMemo(() => {
    const set = new Set<string>();
    monthBookingsWithEquipment.forEach((b) => set.add(b.data));
    return Array.from(set).sort();
  }, [monthBookingsWithEquipment]);

  // Filtered by search, day, and room
  const filteredList = useMemo(() => {
    return monthBookingsWithEquipment.filter((b) => {
      if (selectedDayFilter !== 'all' && b.data !== selectedDayFilter) return false;
      if (selectedRoomId !== 'all' && b.salaId !== selectedRoomId) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const client = clients.find((c) => c.id === b.clienteId);
        const resolved = getAllEquipmentForBooking(b, client);
        const inEquip = resolved.combinedText.toLowerCase().includes(q);
        const inClient = b.clienteNome.toLowerCase().includes(q);
        const inRoom = b.salaNome.toLowerCase().includes(q);
        const inNotes = (b.note || '').toLowerCase().includes(q);
        if (!inEquip && !inClient && !inRoom && !inNotes) return false;
      }

      return true;
    });
  }, [monthBookingsWithEquipment, selectedDayFilter, selectedRoomId, searchQuery, clients]);

  if (!isOpen) return null;

  const handleCopyEquipment = (id: string, text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:m-0 print:w-full">
        {/* Header */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/90 flex items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-yellow-400/10 border border-blue-200/80 dark:border-yellow-500/30 text-blue-600 dark:text-yellow-400 flex items-center justify-center shrink-0 shadow-2xs">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-snug flex items-center gap-2 truncate">
                <span>Prospetto Strumentazione Richiesta</span>
                <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-yellow-400/20 dark:text-yellow-300 border border-blue-200 dark:border-yellow-500/30 px-2 py-0.5 rounded-md">
                  {MESI_ITALIANI[currentMonth]} {currentYear}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400 font-normal truncate mt-0.5">
                Setup, strumenti e attrezzature richieste dai gruppi e musicisti per le sessioni in sala
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className="modal-header-btn-blue shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white transition-all cursor-pointer border border-blue-500 shadow-md shadow-blue-500/25 text-xs font-bold"
              style={{ backgroundColor: '#2563eb', color: '#ffffff', borderColor: '#1d4ed8' }}
              title="Stampa prospetto attrezzature"
            >
              <Printer className="w-4 h-4 text-white stroke-[2.2]" style={{ color: '#ffffff', stroke: '#ffffff' }} />
              <span className="hidden sm:inline">Stampa</span>
            </button>
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
        </div>

        {/* Filters Bar */}
        <div className="p-4 bg-white border-b border-slate-200 space-y-3 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Search Input */}
            <div className="sm:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca strumento (es. piatti, microfoni, Marshall, basso)..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
              />
            </div>

            {/* Day Filter */}
            <div className="sm:col-span-4">
              <select
                value={selectedDayFilter}
                onChange={(e) => setSelectedDayFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
              >
                <option value="all">Tutti i giorni del mese ({uniqueDays.length} con sessioni)</option>
                {uniqueDays.map((d) => (
                  <option key={d} value={d}>
                    {d === todayISO ? '⭐ OGGI • ' : ''}
                    {formatDateItalian(d, true)}
                  </option>
                ))}
              </select>
            </div>

            {/* Room Filter */}
            <div className="sm:col-span-3">
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
              >
                <option value="all">Tutte le Sale ({rooms.length})</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
            <span className="text-slate-500">
              Trovate <strong>{filteredList.length}</strong> sessioni musicali
              {selectedDayFilter !== 'all' && (
                <span> per il giorno <strong>{formatDateItalian(selectedDayFilter, true)}</strong></span>
              )}
            </span>

            {selectedDayFilter !== todayISO && uniqueDays.includes(todayISO) && (
              <button
                onClick={() => setSelectedDayFilter(todayISO)}
                className="text-xs text-purple-700 hover:text-purple-900 font-semibold underline"
              >
                Vai alle sessioni di Oggi ({formatDateItalian(todayISO, false)})
              </button>
            )}
          </div>
        </div>

        {/* Content list */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50 space-y-4">
          {filteredList.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 space-y-2">
              <Music2 className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700 text-sm">
                Nessuna sessione corrisponde ai filtri di ricerca.
              </p>
              <p className="text-xs text-slate-400">
                Prova a modificare il giorno selezionato o il termine di ricerca.
              </p>
            </div>
          ) : (
            filteredList.map((b) => {
              const room = rooms.find((r) => r.id === b.salaId);
              const roomColor = room?.colore || '#4f46e5';
              const client = clients.find((c) => c.id === b.clienteId);
              const resolved = getAllEquipmentForBooking(b, client);
              const items = resolved.items;
              const hasEquipment = items.length > 0;

              return (
                <div
                  key={b.id}
                  onClick={() => onSelectBooking && onSelectBooking(b)}
                  className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-2xs hover:border-purple-300 hover:shadow-xs transition-all space-y-3 cursor-pointer"
                >
                  {/* Top Bar: Date, Time, Room, Band */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">
                        {formatDateItalian(b.data, true)}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {b.oraInizio} - {b.oraFine} ({b.durataOre}h)
                      </span>
                      <span className="text-slate-300">•</span>
                      <span
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded text-white"
                        style={{ backgroundColor: roomColor }}
                      >
                        <DoorOpen className="w-3 h-3" />
                        {b.salaNome}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">Operatore:</span>
                      {b.operatoreAssegnatoNome ? (
                        <span className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {b.operatoreAssegnatoNome}
                        </span>
                      ) : (
                        <span className="font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                          Non Assegnato
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Client / Band Name */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{b.clienteNome}</h4>
                      <p className="text-[11px] text-slate-500 capitalize">
                        {b.tipo === 'prove' ? 'Sessione Prove Band' : 'Lezione di Musica'}
                        {b.note ? ` • Note: ${b.note}` : ''}
                      </p>
                    </div>

                    {hasEquipment && (
                      <button
                        onClick={(e) => handleCopyEquipment(b.id, resolved.combinedText, e)}
                        className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 text-[11px] flex items-center gap-1 transition-colors border border-slate-200"
                        title="Copia testo strumentazione"
                      >
                        {copiedId === b.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700 font-semibold">Copiato</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copia setup</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Equipment Details Box */}
                  <div className="bg-purple-50/70 border border-purple-100 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                        <Music2 className="w-3.5 h-3.5 text-purple-700" />
                        <span>Strumentazione Richiesta</span>
                      </span>
                      {hasEquipment && (
                        <span className="text-[10px] font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                          {items.length} {items.length === 1 ? 'voce' : 'voci'}
                        </span>
                      )}
                    </div>

                    {hasEquipment ? (
                      <div className="space-y-2.5">
                        {/* Tags breakdown per ogni strumento */}
                        <div className="flex flex-wrap gap-1.5">
                          {items.map((item, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-white border border-purple-200 text-purple-950 shadow-2xs"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
                              {item}
                            </span>
                          ))}
                        </div>

                        {/* Scheda testo completo / sezioni */}
                        <div className="space-y-1.5 pt-2 border-t border-purple-100/80 text-xs">
                          {resolved.clientEquipment && (
                            <div className="p-2 rounded bg-white border border-purple-100 text-slate-800">
                              <span className="font-bold text-purple-900 block text-[11px] mb-0.5 uppercase tracking-wide">
                                Dotazione tesserato / band:
                              </span>
                              <p className="leading-relaxed">{resolved.clientEquipment}</p>
                            </div>
                          )}
                          {resolved.bookingRequest && resolved.bookingRequest !== resolved.clientEquipment && (
                            <div className="p-2 rounded bg-purple-100/60 border border-purple-200 text-purple-950">
                              <span className="font-bold text-purple-900 block text-[11px] mb-0.5 uppercase tracking-wide">
                                Richiesta specifica sessione:
                              </span>
                              <p className="leading-relaxed">{resolved.bookingRequest}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">
                        Nessuna strumentazione speciale specificata. Vale la dotazione standard della sala.
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 print:hidden">
          <span>Clicca su qualsiasi sessione per visualizzarla o modificarla.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
