import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Sparkles,
  Calendar as CalendarIcon,
  Music2,
  GraduationCap,
  Clock,
  User,
  AlertTriangle,
  DoorOpen,
  Filter,
  CheckCircle2,
  SlidersHorizontal,
  Printer,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Booking } from '../types';
import {
  formatDateToISO,
  GIORNI_CALENDARIO,
  getMonthCalendarGrid,
  MESI_ITALIANI,
  parseISODate,
} from '../utils/dateUtils';
import { AutoAssignResult, getOperatorAccumulatedHours } from '../utils/scheduler';
import { AutoAssignModal } from './AutoAssignModal';
import { BookingModal } from './BookingModal';
import { EquipmentOverviewModal, parseEquipmentItems, getAllEquipmentForBooking } from './EquipmentOverviewModal';
import { OperatorSchedulePrintModal } from './OperatorSchedulePrintModal';

export const CalendarDashboardView: React.FC = () => {
  const { rooms, staff, bookings, clients, runAutoAssignment } = useApp();

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-11

  // Filter state
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'prove' | 'lezione'>('all');

  // Equipment visibility toggle and equipment modal
  const [showEquipment, setShowEquipment] = useState<boolean>(true);
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState<boolean>(false);
  const [isOperatorScheduleModalOpen, setIsOperatorScheduleModalOpen] = useState<boolean>(false);

  // Modal states
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedDateForBooking, setSelectedDateForBooking] = useState<string>('');
  const [bookingToEdit, setBookingToEdit] = useState<Booking | null>(null);

  const [isAutoAssignModalOpen, setIsAutoAssignModalOpen] = useState(false);
  const [autoAssignResult, setAutoAssignResult] = useState<AutoAssignResult | null>(null);

  // Quick detail preview modal for clicked booking
  const [activeBookingDetail, setActiveBookingDetail] = useState<Booking | null>(null);

  // Operator shift balance banner toggle (collapsed by default to maximize calendar view)
  const [isBalanceExpanded, setIsBalanceExpanded] = useState(false);

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleGoToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  const monthString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const calendarGrid = getMonthCalendarGrid(currentYear, currentMonth);

  // Filter bookings for calendar
  const filteredBookings = bookings.filter((b) => {
    if (selectedRoomFilter !== 'all' && b.salaId !== selectedRoomFilter) return false;
    if (selectedTypeFilter !== 'all' && b.tipo !== selectedTypeFilter) return false;
    return true;
  });

  // Calculate monthly stats
  const monthlyBookings = bookings.filter((b) => b.data.startsWith(monthString));
  const unassignedCount = monthlyBookings.filter((b) => !b.operatoreAssegnatoId).length;
  const totalHoursMonth = monthlyBookings.reduce((sum, b) => sum + (b.durataOre || 0), 0);
  const operatorHours = getOperatorAccumulatedHours(staff, bookings, monthString);

  const handleDayClick = (dateStr: string) => {
    setSelectedDateForBooking(dateStr);
    setBookingToEdit(null);
    setIsBookingModalOpen(true);
  };

  const handleOpenEditBooking = (booking: Booking, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookingToEdit(booking);
    setIsBookingModalOpen(true);
    setActiveBookingDetail(null);
  };

  const handleRunAutoAssign = () => {
    const result = runAutoAssignment(monthString);
    setAutoAssignResult(result);
    setIsAutoAssignModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Top Bar: Controls & Actions (Compact single-line toolbar) */}
      <div className="bg-white rounded-xl px-3.5 py-2.5 sm:px-4 border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        {/* Month Picker & Today */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 h-8">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded-md text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
              title="Mese Precedente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleGoToday}
              className="px-2.5 py-0.5 rounded-md text-xs font-bold text-slate-700 hover:bg-white transition-colors"
            >
              Oggi
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded-md text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
              title="Mese Successivo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-1.5 whitespace-nowrap">
            <span>{MESI_ITALIANI[currentMonth]}</span>
            <span className="text-slate-400 font-semibold">{currentYear}</span>
          </h2>
        </div>

        {/* Filters & Action Buttons - Fits on one line */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Room filter */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 h-8">
            <DoorOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedRoomFilter}
              onChange={(e) => setSelectedRoomFilter(e.target.value)}
              className="text-xs font-semibold bg-transparent text-slate-700 focus:outline-hidden cursor-pointer max-w-[130px] truncate"
            >
              <option value="all">Tutte le Sale ({rooms.length})</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 h-8">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value as any)}
              className="text-xs font-semibold bg-transparent text-slate-700 focus:outline-hidden cursor-pointer"
            >
              <option value="all">Tutte le Attività</option>
              <option value="prove">Solo Prove</option>
              <option value="lezione">Solo Lezioni</option>
            </select>
          </div>

          {/* Equipment visibility toggle in calendar */}
          <button
            onClick={() => setShowEquipment(!showEquipment)}
            className={`flex items-center gap-1.5 px-2.5 py-1 h-8 rounded-lg text-xs font-semibold border transition-all shrink-0 ${
              showEquipment
                ? 'bg-purple-50 text-purple-700 border-purple-300 shadow-2xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
            title={showEquipment ? 'Nascondi dettagli strumenti dalle caselle del calendario' : 'Mostra dettagli strumenti richiesti direttamente nel calendario'}
          >
            <Music2 className={`w-3.5 h-3.5 ${showEquipment ? 'text-purple-600' : 'text-slate-400'}`} />
            <span className="hidden xl:inline">{showEquipment ? 'Strumenti Visibili' : 'Mostra Strumenti'}</span>
            <span className="xl:hidden">Strumenti</span>
          </button>

          {/* Master Equipment Overview Modal Trigger */}
          <button
            onClick={() => setIsEquipmentModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 h-8 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0"
            title="Visualizza e cerca la strumentazione richiesta per tutte le sessioni del mese"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-purple-200 shrink-0" />
            <span className="hidden sm:inline">Prospetto Strumenti</span>
            <span className="sm:hidden">Setup</span>
          </button>

          {/* Operator Schedule Print & PDF Export Modal Trigger */}
          <button
            onClick={() => setIsOperatorScheduleModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 h-8 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg border border-slate-300 shadow-2xs transition-colors whitespace-nowrap shrink-0"
            title="Stampa o esporta in PDF il catalogo e la lista appuntamenti/giorni per ciascun operatore"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="hidden xl:inline">Stampa / PDF Operatori</span>
            <span className="xl:hidden">PDF Op</span>
          </button>

          {/* Smart Auto-Assign Button */}
          <button
            onClick={handleRunAutoAssign}
            className="flex items-center gap-1.5 px-3 py-1.5 h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0"
            title="Assegnazione Turni Intelligente: Assegna automaticamente gli operatori liberi per le prenotazioni scoperte"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-200 shrink-0" />
            <span className="hidden sm:inline">Assegna Turni IA</span>
            <span className="sm:hidden">Turni IA</span>
            {unassignedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-800 text-indigo-100 text-[10px] font-bold">
                {unassignedCount}
              </span>
            )}
          </button>

          {/* Add Booking Button */}
          <button
            onClick={() => {
              setSelectedDateForBooking(formatDateToISO(new Date()));
              setBookingToEdit(null);
              setIsBookingModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 h-8 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden lg:inline">Nuova Prenotazione</span>
            <span className="lg:hidden">Prenota</span>
          </button>
        </div>
      </div>

      {/* Operator Shift Balance Banner (Space-saving with expandable details) */}
      <div className="bg-slate-900 text-white rounded-xl px-3.5 py-2.5 sm:px-4 shadow-xs border border-slate-800 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span>Monte Ore Operatori • {MESI_ITALIANI[currentMonth]} {currentYear}</span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">Prenotazioni:</span>{' '}
              <strong className="text-white font-bold">{monthlyBookings.length}</strong>
            </div>
            <span className="text-slate-700 hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">Totale ore:</span>{' '}
              <strong className="text-indigo-400 font-bold">{totalHoursMonth}h</strong>
            </div>
            <span className="text-slate-700 hidden sm:inline">•</span>
            {unassignedCount > 0 ? (
              <div className="flex items-center gap-1 text-amber-300 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-[11px]">
                <AlertTriangle className="w-3 h-3" />
                <span>{unassignedCount} scoperti</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[11px]">
                <CheckCircle2 className="w-3 h-3" />
                <span>Tutti coperti</span>
              </div>
            )}

            <button
              onClick={() => setIsBalanceExpanded(!isBalanceExpanded)}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded transition-colors ml-1"
              title={isBalanceExpanded ? 'Nascondi dettagli monte ore operatori' : 'Mostra dettagli monte ore operatori'}
            >
              <span>{isBalanceExpanded ? 'Nascondi' : 'Dettagli'}</span>
              {isBalanceExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Operators hours cards - Visible when expanded */}
        {isBalanceExpanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-3 mt-2.5 border-t border-slate-800">
            {staff
              .filter((s) => s.attivo && (s.ruolo === 'operatore' || s.ruolo === 'entrambi'))
              .map((op) => {
                const hours = operatorHours[op.id] || 0;
                const maxHours = Math.max(...Object.values(operatorHours), 1);
                const percentage = Math.round((hours / maxHours) * 100);

                return (
                  <div
                    key={op.id}
                    className="bg-slate-800/90 rounded-lg p-2.5 border border-slate-700/70 flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs text-white shrink-0"
                        style={{ backgroundColor: op.coloreBadge }}
                      >
                        {op.nome[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-200 truncate">
                          {op.nome} {op.cognome}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {op.turniLavoroPrimario.length > 0
                            ? `${op.turniLavoroPrimario.length} turni primari`
                            : 'Sempre disp.'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-indigo-300">{hours} ore</p>
                      <div className="w-12 h-1 bg-slate-700 rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(8, percentage))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Main Calendar Grid (Google Calendar Style) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Days of week header (Lun - Dom) */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider py-2.5 text-center">
          {GIORNI_CALENDARIO.map((g) => (
            <div key={g.index} className="py-1">
              <span className="hidden sm:inline">{g.label}</span>
              <span className="sm:hidden">{g.short}</span>
            </div>
          ))}
        </div>

        {/* 35 or 42 Days Matrix */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 bg-slate-50/30">
          {calendarGrid.map((day) => {
            const dayBookings = filteredBookings
              .filter((b) => b.data === day.dateStr)
              .sort((a, b) => a.oraInizio.localeCompare(b.oraInizio));

            return (
              <div
                key={day.dateStr}
                onClick={() => handleDayClick(day.dateStr)}
                className={`min-h-[125px] sm:min-h-[155px] p-1.5 sm:p-2 transition-colors cursor-pointer group flex flex-col justify-between ${
                  day.isCurrentMonth ? 'bg-white hover:bg-slate-50/90' : 'bg-slate-50/50 text-slate-300'
                } ${day.isToday ? 'ring-2 ring-indigo-600 ring-inset bg-indigo-50/20' : ''}`}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-xs font-semibold w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                      day.isToday
                        ? 'bg-indigo-600 text-white font-bold shadow-xs'
                        : day.isCurrentMonth
                        ? 'text-slate-800 group-hover:text-indigo-600'
                        : 'text-slate-400'
                    }`}
                  >
                    {day.dayOfMonth}
                  </span>

                  {day.isCurrentMonth && (
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded">
                      + Aggiungi
                    </span>
                  )}
                </div>

                {/* Bookings List in Day */}
                <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[145px] pr-0.5">
                  {dayBookings.slice(0, 3).map((b) => {
                    const room = rooms.find((r) => r.id === b.salaId);
                    const roomColor = room?.colore || '#4f46e5';
                    const hasOperator = !!b.operatoreAssegnatoId;
                    const client = clients.find((c) => c.id === b.clienteId);
                    const resolvedEquip = getAllEquipmentForBooking(b, client);

                    return (
                      <div
                        key={b.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveBookingDetail(b);
                        }}
                        className={`text-[11px] p-1.5 rounded-md border leading-tight transition-all hover:scale-[1.01] shadow-2xs ${
                          b.tipo === 'prove'
                            ? 'bg-indigo-50/90 border-indigo-200 text-indigo-950 hover:bg-indigo-100'
                            : 'bg-slate-100/90 border-slate-200 text-slate-900 hover:bg-slate-200/70'
                        }`}
                      >
                        {/* Time & Room Marker */}
                        <div className="flex items-center justify-between gap-1 font-mono font-bold text-[10px]">
                          <span className="flex items-center gap-1">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: roomColor }}
                            />
                            {b.oraInizio}-{b.oraFine}
                          </span>
                          {!hasOperator && (
                            <span
                              className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1 rounded"
                              title="Nessun operatore assegnato"
                            >
                              No Op
                            </span>
                          )}
                        </div>

                        {/* Client / Band name */}
                        <p className="font-semibold truncate text-[11px] mt-0.5" title={b.clienteNome}>
                          {b.clienteNome}
                        </p>

                        {/* Room & Operator */}
                        <div className="flex items-center justify-between text-[10px] text-slate-600 mt-0.5">
                          <span className="truncate max-w-[80px] text-slate-500 font-medium">
                            {room?.nome.split(' ')[0] || b.salaNome}
                          </span>
                          {hasOperator ? (
                            <span className="text-indigo-700 font-medium truncate max-w-[70px]">
                              {b.operatoreAssegnatoNome?.split(' ')[0]}
                            </span>
                          ) : null}
                        </div>

                        {/* Strumentazione Richiesta visibile nel Calendario */}
                        {showEquipment && resolvedEquip.items.length > 0 && (
                          <div
                            className="mt-1 pt-1 border-t border-purple-200/70 bg-purple-50/95 rounded px-1.5 py-1 text-[9.5px] text-purple-950 space-y-0.5"
                            title={`Tutti gli strumenti richiesti:\n${resolvedEquip.items.join('\n')}`}
                          >
                            <div className="flex items-center justify-between font-bold text-[9px] text-purple-800">
                              <span className="flex items-center gap-1">
                                <Music2 className="w-2.5 h-2.5 shrink-0 text-purple-600" />
                                <span className="uppercase tracking-tight">Strumenti ({resolvedEquip.items.length}):</span>
                              </span>
                            </div>
                            <div className="space-y-0.5 max-h-[85px] overflow-y-auto pr-0.5">
                              {resolvedEquip.items.map((item, idx) => (
                                <div key={idx} className="flex items-start gap-1 text-[9px] leading-tight text-slate-800">
                                  <span className="text-purple-600 font-bold shrink-0">•</span>
                                  <span className="font-medium">{item}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {!showEquipment && resolvedEquip.items.length > 0 && (
                          <div
                            className="mt-1 pt-0.5 border-t border-purple-200/50 flex items-center justify-between text-[9px] text-purple-700 font-semibold"
                            title={resolvedEquip.items.join('; ')}
                          >
                            <span className="flex items-center gap-1 truncate">
                              <Music2 className="w-2.5 h-2.5 text-purple-600 shrink-0" />
                              <span className="truncate">{resolvedEquip.items[0]}</span>
                            </span>
                            {resolvedEquip.items.length > 1 && (
                              <span className="text-[8px] bg-purple-100 text-purple-800 px-1 rounded font-bold shrink-0">
                                +{resolvedEquip.items.length - 1}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {dayBookings.length > 3 && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEquipmentModalOpen(true);
                      }}
                      className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-center py-0.5 rounded transition-colors"
                      title="Apri prospetto completo sessioni e strumenti"
                    >
                      + altri {dayBookings.length - 3} slot
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Booking Quick Detail Dialog when clicked */}
      {activeBookingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    activeBookingDetail.tipo === 'prove'
                      ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {activeBookingDetail.tipo === 'prove' ? (
                    <Music2 className="w-5 h-5" />
                  ) : (
                    <GraduationCap className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">
                    {activeBookingDetail.clienteNome}
                  </h3>
                  <p className="text-xs text-slate-500 font-normal capitalize">
                    {activeBookingDetail.tipo === 'prove' ? 'Sessione Prove Band' : 'Lezione di Musica'} •{' '}
                    {activeBookingDetail.salaNome}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveBookingDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 rounded-lg p-3.5 space-y-2 text-xs border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Data & Orario:</span>
                <span className="font-semibold text-slate-800">
                  {activeBookingDetail.data} ({activeBookingDetail.oraInizio} - {activeBookingDetail.oraFine})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Durata:</span>
                <span className="font-semibold text-slate-800">{activeBookingDetail.durataOre} ore</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Operatore Sala:</span>
                {activeBookingDetail.operatoreAssegnatoNome ? (
                  <span className="font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {activeBookingDetail.operatoreAssegnatoNome}
                  </span>
                ) : (
                  <span className="font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                    ⚠️ Non Assegnato
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Tariffa:</span>
                <span className="font-bold text-slate-900">€{activeBookingDetail.tariffaTotale}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Stato Pagamento:</span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                    activeBookingDetail.statoPagamento === 'pagato'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {activeBookingDetail.statoPagamento === 'pagato' ? 'Pagato' : 'Da Saldare'}
                </span>
              </div>
            </div>

            {/* Strumentazione Richiesta in Evidenza */}
            {(() => {
              const activeClient = clients.find((c) => c.id === activeBookingDetail.clienteId);
              const activeResolved = getAllEquipmentForBooking(activeBookingDetail, activeClient);

              return (
                <div className="bg-purple-50/85 border border-purple-200 rounded-xl p-3.5 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-900 uppercase tracking-wider">
                      <SlidersHorizontal className="w-4 h-4 text-purple-700" />
                      <span>Strumentazione Necessaria Richiesta</span>
                    </div>
                    {activeResolved.items.length > 0 && (
                      <span className="text-[10px] font-bold bg-purple-200 text-purple-900 px-2 py-0.5 rounded-full">
                        {activeResolved.items.length} {activeResolved.items.length === 1 ? 'voce' : 'voci'}
                      </span>
                    )}
                  </div>

                  {activeResolved.items.length > 0 ? (
                    <div className="space-y-2.5">
                      {/* Elenco completo badges di tutti gli strumenti */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wide block">
                          Tutti gli strumenti da preparare in sala:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {activeResolved.items.map((item, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-white border border-purple-200 text-purple-950 shadow-2xs"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-600 shrink-0" />
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Sezioni descrittive dettagliate */}
                      <div className="space-y-2 pt-1 border-t border-purple-200/70 text-xs">
                        {activeResolved.clientEquipment && (
                          <div className="p-2.5 bg-white rounded-lg border border-purple-100 text-slate-800">
                            <span className="font-bold text-purple-900 block text-[11px] mb-0.5 uppercase tracking-wide">
                              Dotazione Band / Tesserato (Anagrafica):
                            </span>
                            <p className="leading-relaxed font-normal">{activeResolved.clientEquipment}</p>
                          </div>
                        )}

                        {activeResolved.bookingRequest && activeResolved.bookingRequest !== activeResolved.clientEquipment && (
                          <div className="p-2.5 bg-purple-100/70 rounded-lg border border-purple-200 text-purple-950">
                            <span className="font-bold text-purple-900 block text-[11px] mb-0.5 uppercase tracking-wide">
                              Specifiche richieste per questa sessione:
                            </span>
                            <p className="leading-relaxed font-normal">{activeResolved.bookingRequest}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">
                      Nessuna strumentazione speciale specificata (setup standard di base della sala).
                    </p>
                  )}
                </div>
              );
            })()}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setActiveBookingDetail(null)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-50"
              >
                Chiudi
              </button>
              <button
                onClick={(e) => handleOpenEditBooking(activeBookingDetail, e)}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs"
              >
                Modifica / Assegna Operatore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        initialDate={selectedDateForBooking}
        bookingToEdit={bookingToEdit}
      />

      {/* Auto Assign Feedback Modal */}
      <AutoAssignModal
        isOpen={isAutoAssignModalOpen}
        onClose={() => setIsAutoAssignModalOpen(false)}
        result={autoAssignResult}
      />

      {/* Master Equipment Overview Modal */}
      <EquipmentOverviewModal
        isOpen={isEquipmentModalOpen}
        onClose={() => setIsEquipmentModalOpen(false)}
        bookings={bookings}
        rooms={rooms}
        clients={clients}
        currentYear={currentYear}
        currentMonth={currentMonth}
        onSelectBooking={(b) => {
          setIsEquipmentModalOpen(false);
          setActiveBookingDetail(b);
        }}
      />

      {/* Operator Schedule Print & PDF Export Modal */}
      <OperatorSchedulePrintModal
        isOpen={isOperatorScheduleModalOpen}
        onClose={() => setIsOperatorScheduleModalOpen(false)}
      />
    </div>
  );
};
