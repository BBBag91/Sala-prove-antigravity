import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Sparkles,
  Music2,
  GraduationCap,
  User,
  AlertTriangle,
  DoorOpen,
  Filter,
  CheckCircle2,
  SlidersHorizontal,
  Printer,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Clock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Booking } from '../types';
import {
  formatDateToISO,
  MESI_ITALIANI,
  timeToMinutes,
} from '../utils/dateUtils';
import { AutoAssignResult, getOperatorAccumulatedHours } from '../utils/scheduler';
import { AutoAssignModal } from './AutoAssignModal';
import { BookingModal } from './BookingModal';
import { EquipmentOverviewModal, getAllEquipmentForBooking } from './EquipmentOverviewModal';
import { OperatorSchedulePrintModal } from './OperatorSchedulePrintModal';

// -- Constants ------------------------------------------------------------------
const HOUR_START = 9;
const HOUR_END = 23;
const TOTAL_HOURS = HOUR_END - HOUR_START;

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isoWeek(date: Date): number {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dn = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dn);
  const ys = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp.getTime() - ys.getTime()) / 86400000 + 1) / 7);
}

const SHORT_DAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

const COLOR_PALETTE = [
  { bg: '#1e3a24', border: '#22c55e', text: '#86efac' }, // Green
  { bg: '#3a2612', border: '#f59e0b', text: '#fde68a' }, // Amber / Gold
  { bg: '#172554', border: '#3b82f6', text: '#93c5fd' }, // Blue
  { bg: '#2e1065', border: '#a855f7', text: '#d8b4fe' }, // Purple
  { bg: '#164e63', border: '#06b6d4', text: '#67e8f9' }, // Cyan
  { bg: '#4c0519', border: '#f43f5e', text: '#fda4af' }, // Rose
];

type ViewMode = 'day' | '3days' | 'week';

// -- Component ------------------------------------------------------------------
export const CalendarDashboardView: React.FC = () => {
  const { rooms, staff, bookings, clients, runAutoAssignment } = useApp();

  const today = new Date();
  const todayStr = formatDateToISO(today);

  // Active anchor date for calendar navigation
  const [currentDate, setCurrentDate] = useState<Date>(today);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) return 'day';
    return 'week';
  });

  // Dynamic zoom: height of one hour in pixels
  // 36px: Panoramica (entire 9:00 - 23:00 fits in ~500px, no scrolling needed!)
  // 56px: Standard (balanced)
  // 84px: Dettagliato (maximum legibility)
  const [cellHeight, setCellHeight] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) return 46;
    return 56;
  });

  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'prove' | 'lezione'>('all');
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [isOperatorScheduleModalOpen, setIsOperatorScheduleModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedDateForBooking, setSelectedDateForBooking] = useState<string>('');
  const [bookingToEdit, setBookingToEdit] = useState<Booking | null>(null);
  const [isAutoAssignModalOpen, setIsAutoAssignModalOpen] = useState(false);
  const [autoAssignResult, setAutoAssignResult] = useState<AutoAssignResult | null>(null);
  const [activeBookingDetail, setActiveBookingDetail] = useState<Booking | null>(null);
  const [isBalanceExpanded, setIsBalanceExpanded] = useState(false);

  // Full week starting on Monday of currentDate
  const weekStart = getMondayOf(currentDate);
  const fullWeekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const fullWeekDayStrs = fullWeekDays.map(formatDateToISO);

  // Days to display based on viewMode
  let displayDays: Date[] = [];
  if (viewMode === 'day') {
    displayDays = [currentDate];
  } else if (viewMode === '3days') {
    displayDays = [currentDate, addDays(currentDate, 1), addDays(currentDate, 2)];
  } else {
    displayDays = fullWeekDays;
  }
  const displayDayStrs = displayDays.map(formatDateToISO);

  // Labels
  const dominantMonth = viewMode === 'day' ? currentDate : displayDays[Math.min(displayDays.length - 1, 1)];
  const monthLabel = MESI_ITALIANI[dominantMonth.getMonth()];
  const yearLabel = dominantMonth.getFullYear();
  const weekNum = isoWeek(weekStart);
  const monthString = `${yearLabel}-${String(dominantMonth.getMonth() + 1).padStart(2, '0')}`;

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === 'day') {
      setCurrentDate(d => addDays(d, -1));
    } else if (viewMode === '3days') {
      setCurrentDate(d => addDays(d, -3));
    } else {
      setCurrentDate(d => addDays(d, -7));
    }
  };

  const handleNext = () => {
    if (viewMode === 'day') {
      setCurrentDate(d => addDays(d, 1));
    } else if (viewMode === '3days') {
      setCurrentDate(d => addDays(d, 3));
    } else {
      setCurrentDate(d => addDays(d, 7));
    }
  };

  const handleGoToday = () => {
    setCurrentDate(today);
  };

  // Zoom handlers
  const handleZoomIn = () => {
    setCellHeight(h => Math.min(105, Math.round(h * 1.25)));
  };

  const handleZoomOut = () => {
    setCellHeight(h => Math.max(34, Math.round(h * 0.8)));
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        setCellHeight(h => Math.min(105, h + 5));
      } else {
        setCellHeight(h => Math.max(34, h - 5));
      }
    }
  };

  const zoomPercent = Math.round((cellHeight / 56) * 100);

  const monthlyBookings = bookings.filter(b => b.data.startsWith(monthString));
  const unassignedCount = monthlyBookings.filter(b => !b.operatoreAssegnatoId).length;
  const totalHoursMonth = monthlyBookings.reduce((s, b) => s + (b.durataOre || 0), 0);
  const operatorHours = getOperatorAccumulatedHours(staff, bookings, monthString);

  const filteredBookings = bookings.filter(b => {
    if (selectedRoomFilter !== 'all' && b.salaId !== selectedRoomFilter) return false;
    if (selectedTypeFilter !== 'all' && b.tipo !== selectedTypeFilter) return false;
    return true;
  });

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

  const bookingsByDay: Record<string, Booking[]> = {};
  displayDayStrs.forEach(ds => {
    bookingsByDay[ds] = filteredBookings
      .filter(b => b.data === ds)
      .sort((a, b) => a.oraInizio.localeCompare(b.oraInizio));
  });

  const ROOM_COLORS: Record<string, typeof COLOR_PALETTE[0]> = {};
  rooms.forEach((r, i) => { ROOM_COLORS[r.id] = COLOR_PALETTE[i % COLOR_PALETTE.length]; });

  // Computed title text based on active view mode
  const titleText = (() => {
    if (viewMode === 'day') {
      const dayName = SHORT_DAYS[currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1];
      return `${dayName} ${currentDate.getDate()} ${MESI_ITALIANI[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    if (viewMode === '3days') {
      const startD = displayDays[0];
      const endD = displayDays[displayDays.length - 1];
      return `${startD.getDate()} - ${endD.getDate()} ${MESI_ITALIANI[startD.getMonth()]} ${startD.getFullYear()}`;
    }
    return `${monthLabel} ${yearLabel}`;
  })();

  return (
    <div className="space-y-3">

      {/* -- Toolbar -- */}
      <div className="bg-[#0e0e0e] rounded-xl border border-yellow-500/25 shadow-sm overflow-hidden">
        
        {/* Row 1: Nav & View & Zoom */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 sm:px-4 sm:py-2.5 border-b border-yellow-500/20 gap-2">
          
          {/* Left: Date navigation arrows & Title */}
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <div className="flex items-center bg-[#141414] rounded-lg p-0.5 border border-yellow-500/30 shrink-0">
              <button
                onClick={handlePrev}
                className="p-1.5 rounded-md text-yellow-400 hover:text-yellow-300 hover:bg-neutral-800 transition-colors"
                title="Periodo precedente"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleGoToday}
                className="px-2.5 py-1 rounded-md text-xs font-bold text-yellow-400 hover:bg-neutral-800 transition-colors"
              >
                Oggi
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 rounded-md text-yellow-400 hover:text-yellow-300 hover:bg-neutral-800 transition-colors"
                title="Periodo successivo"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-baseline gap-1.5 min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-yellow-100 tracking-tight truncate">
                {titleText}
              </h2>
              {viewMode === 'week' && (
                <span className="hidden sm:inline text-[11px] font-mono text-yellow-400/80 bg-neutral-900 border border-yellow-500/30 px-1.5 py-0.5 rounded shrink-0">
                  S{weekNum}
                </span>
              )}
            </div>
          </div>

          {/* Right: View Mode Toggle & Zoom & Action Button */}
          <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
            
            {/* View Mode Toggle: 1G / 3G / 7G */}
            <div className="flex items-center bg-[#141414] rounded-lg p-0.5 border border-yellow-500/30 shrink-0">
              <button
                onClick={() => setViewMode('day')}
                className={`px-2 py-1 rounded-md text-xs font-bold transition-all ${
                  viewMode === 'day'
                    ? 'bg-yellow-400 text-black shadow-xs'
                    : 'text-yellow-300/80 hover:text-yellow-300 hover:bg-neutral-800'
                }`}
                title="Vista 1 Giorno (Massima leggibilità su smartphone)"
              >
                <span className="sm:hidden">1G</span>
                <span className="hidden sm:inline">Giorno</span>
              </button>
              <button
                onClick={() => setViewMode('3days')}
                className={`px-2 py-1 rounded-md text-xs font-bold transition-all ${
                  viewMode === '3days'
                    ? 'bg-yellow-400 text-black shadow-xs'
                    : 'text-yellow-300/80 hover:text-yellow-300 hover:bg-neutral-800'
                }`}
                title="Vista 3 Giorni"
              >
                <span className="sm:hidden">3G</span>
                <span className="hidden sm:inline">3 Giorni</span>
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-2 py-1 rounded-md text-xs font-bold transition-all ${
                  viewMode === 'week'
                    ? 'bg-yellow-400 text-black shadow-xs'
                    : 'text-yellow-300/80 hover:text-yellow-300 hover:bg-neutral-800'
                }`}
                title="Vista Settimana (7 giorni)"
              >
                <span className="sm:hidden">7G</span>
                <span className="hidden sm:inline">Settimana</span>
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 shrink-0">
              <div className="flex items-center bg-[#141414] rounded-lg p-0.5 border border-yellow-500/30">
                <button
                  onClick={handleZoomOut}
                  disabled={cellHeight <= 34}
                  className="p-1 rounded-md text-yellow-400 hover:text-yellow-300 hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Rimpicciolisci zoom"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (cellHeight <= 40) setCellHeight(56);
                    else if (cellHeight <= 68) setCellHeight(84);
                    else setCellHeight(36);
                  }}
                  className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-yellow-400 hover:bg-neutral-800 rounded transition-colors"
                  title="Alterna livelli di zoom (Panoramica, Standard, Dettagliato)"
                >
                  {zoomPercent}%
                </button>
                <button
                  onClick={handleZoomIn}
                  disabled={cellHeight >= 105}
                  className="p-1 rounded-md text-yellow-400 hover:text-yellow-300 hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Ingrandisci zoom"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 1-Click Panoramica Preset */}
              <button
                onClick={() => setCellHeight(cellHeight <= 40 ? 56 : 36)}
                className={`px-2 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 ${
                  cellHeight <= 40
                    ? 'bg-yellow-400 text-black border-yellow-400 shadow-sm'
                    : 'bg-[#141414] text-yellow-400 hover:bg-yellow-400/10 border-yellow-500/30'
                }`}
                title="Panoramica completa: vedi tutte le ore della giornata senza dover scrollare"
              >
                <Maximize2 className="w-3 h-3" />
                <span className="hidden md:inline">Panoramica</span>
              </button>
            </div>

            {/* New Booking Button */}
            <button
              onClick={() => { setSelectedDateForBooking(formatDateToISO(today)); setBookingToEdit(null); setIsBookingModalOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-black font-bold text-xs rounded-lg shadow-sm transition-all whitespace-nowrap ml-auto sm:ml-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span className="hidden sm:inline">Nuova Prenotazione</span>
              <span className="sm:hidden">Prenota</span>
            </button>
          </div>
        </div>

        {/* Row 2: Filters & Actions */}
        <div className="flex items-center justify-between px-2.5 sm:px-4 py-2 gap-2 flex-wrap bg-[#080808]">
          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-[200px]">
            <div className="flex items-center gap-1 bg-[#141414] border border-yellow-500/25 rounded-lg px-2 py-1 h-7">
              <DoorOpen className="w-3 h-3 text-yellow-500/70 shrink-0" />
              <select
                value={selectedRoomFilter}
                onChange={e => setSelectedRoomFilter(e.target.value)}
                className="text-xs font-semibold bg-transparent text-yellow-200 focus:outline-none cursor-pointer max-w-[130px]"
              >
                <option value="all">Tutte le Sale ({rooms.length})</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-1 bg-[#141414] border border-yellow-500/25 rounded-lg px-2 py-1 h-7">
              <Filter className="w-3 h-3 text-yellow-500/70 shrink-0" />
              <select
                value={selectedTypeFilter}
                onChange={e => setSelectedTypeFilter(e.target.value as 'all' | 'prove' | 'lezione')}
                className="text-xs font-semibold bg-transparent text-yellow-200 focus:outline-none cursor-pointer"
              >
                <option value="all">Tutte le Attività</option>
                <option value="prove">Solo Prove</option>
                <option value="lezione">Solo Lezioni</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setIsEquipmentModalOpen(true)}
              className="flex items-center gap-1.5 h-7 px-2.5 bg-neutral-900 hover:bg-neutral-800 text-yellow-300 font-semibold text-xs rounded-lg border border-yellow-500/30 transition-all whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3 h-3 text-yellow-400" />
              <span className="hidden md:inline">Prospetto Strumenti</span>
              <span className="md:hidden">Strumenti</span>
            </button>

            <button
              onClick={() => setIsOperatorScheduleModalOpen(true)}
              className="flex items-center gap-1.5 h-7 px-2.5 bg-neutral-900 hover:bg-neutral-800 text-yellow-300 font-semibold text-xs rounded-lg border border-yellow-500/30 transition-all whitespace-nowrap"
            >
              <Printer className="w-3 h-3 text-yellow-400" />
              <span className="hidden md:inline">PDF Operatori</span>
              <span className="md:hidden">PDF</span>
            </button>

            <button
              onClick={handleRunAutoAssign}
              className="flex items-center gap-1.5 h-7 px-2.5 bg-yellow-400/20 hover:bg-yellow-400 text-yellow-300 hover:text-black font-bold text-xs rounded-lg border border-yellow-500/40 transition-all whitespace-nowrap"
            >
              <Sparkles className="w-3 h-3 text-yellow-400" />
              <span>Assegna IA</span>
              {unassignedCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-yellow-400 text-black text-[10px] font-bold leading-none">
                  {unassignedCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Row 3 (Optional): Weekdays Quick-Picker for 1G and 3G mode */}
        {viewMode !== 'week' && (
          <div className="flex items-center gap-1 overflow-x-auto py-1.5 px-2 bg-neutral-950 border-t border-yellow-500/20 no-scrollbar">
            <span className="text-[10px] text-yellow-500/70 font-bold uppercase tracking-wider shrink-0 mr-1">
              Giorni:
            </span>
            {fullWeekDays.map((d, i) => {
              const dStr = fullWeekDayStrs[i];
              const isSelected = viewMode === 'day'
                ? dStr === formatDateToISO(currentDate)
                : displayDayStrs.includes(dStr);
              const isToday = dStr === todayStr;
              const count = (bookings.filter(b => b.data === dStr) || []).length;
              return (
                <button
                  key={dStr}
                  onClick={() => setCurrentDate(d)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs shrink-0 transition-all ${
                    isSelected
                      ? 'bg-yellow-400 text-black font-bold shadow-xs'
                      : 'bg-neutral-900 text-yellow-200/80 hover:bg-neutral-800 hover:text-yellow-300 border border-yellow-500/20'
                  }`}
                >
                  <span>{SHORT_DAYS[i]} {d.getDate()}</span>
                  {isToday && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-black' : 'bg-yellow-400'}`} />}
                  {count > 0 && (
                    <span className={`text-[10px] px-1 rounded-full font-bold ${
                      isSelected ? 'bg-black/20 text-black' : 'bg-yellow-400/20 text-yellow-300'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* -- Operator Shift Balance Banner -- */}
      <div className="bg-[#0e0e0e] text-white rounded-xl px-3 sm:px-4 py-2.5 shadow-sm border border-yellow-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-yellow-400/20 text-yellow-400 flex items-center justify-center shrink-0 border border-yellow-500/30">
              <User className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-xs sm:text-sm font-semibold text-yellow-100">
              Monte Ore Operatori &bull; {monthLabel} {yearLabel}
            </h3>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-neutral-400 text-[11px]">Prenotazioni:</span>
              <strong className="text-yellow-400 font-bold">{monthlyBookings.length}</strong>
            </div>
            <span className="text-neutral-600 hidden sm:inline">&bull;</span>
            <div className="flex items-center gap-1.5">
              <span className="text-neutral-400 text-[11px]">Totale ore:</span>
              <strong className="text-yellow-400 font-bold">{totalHoursMonth}h</strong>
            </div>
            <span className="text-neutral-600 hidden sm:inline">&bull;</span>
            {unassignedCount > 0 ? (
              <div className="flex items-center gap-1 text-amber-300 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 text-[11px]">
                <AlertTriangle className="w-3 h-3" /><span>{unassignedCount} scoperti</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 text-[11px]">
                <CheckCircle2 className="w-3 h-3" /><span>Tutti coperti</span>
              </div>
            )}
            <button
              onClick={() => setIsBalanceExpanded(!isBalanceExpanded)}
              className="flex items-center gap-1 text-[11px] font-semibold text-yellow-300 hover:text-yellow-100 bg-neutral-900 hover:bg-neutral-800 px-2 py-1 rounded border border-yellow-500/25 transition-colors ml-1"
            >
              <span>{isBalanceExpanded ? 'Nascondi' : 'Dettagli'}</span>
              {isBalanceExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {isBalanceExpanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-3 mt-2.5 border-t border-yellow-500/20">
            {staff.filter(s => s.attivo && (s.ruolo === 'operatore' || s.ruolo === 'entrambi')).map(op => {
              const hours = operatorHours[op.id] || 0;
              const maxHours = Math.max(...Object.values(operatorHours), 1);
              const pct = Math.round((hours / maxHours) * 100);
              return (
                <div key={op.id} className="bg-neutral-950 rounded-lg p-2.5 border border-yellow-500/20 flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs text-black shrink-0 shadow-xs" style={{ backgroundColor: op.coloreBadge }}>
                      {op.nome[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-yellow-100 truncate">{op.nome} {op.cognome}</p>
                      <p className="text-[10px] text-neutral-400 truncate">{op.turniLavoroPrimario.length > 0 ? `${op.turniLavoroPrimario.length} turni primari` : 'Sempre disp.'}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-yellow-400">{hours} ore</p>
                    <div className="w-12 h-1 bg-neutral-800 rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${Math.min(100, Math.max(8, pct))}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* -- Time Grid with Zoom & Mobile Scroll -- */}
      <div className="bg-[#0c0c0c] rounded-xl border border-yellow-500/25 shadow-sm overflow-hidden flex flex-col">
        
        {/* Scrollable Container with sticky headers & sticky hour column */}
        <div
          className="overflow-auto relative"
          style={{
            maxHeight: cellHeight <= 38 && viewMode === 'week' ? 'none' : '75vh',
          }}
          onWheel={handleWheel}
        >
          <div
            style={{
              minWidth: viewMode === 'week' ? '700px' : '100%',
            }}
          >
            {/* Day Header: STICKY TOP */}
            <div
              className="grid border-b border-yellow-500/25 bg-neutral-950 sticky top-0 z-30 shadow-xs"
              style={{
                gridTemplateColumns: `52px repeat(${displayDays.length}, minmax(0, 1fr))`,
              }}
            >
              {/* Corner cell: STICKY TOP & LEFT */}
              <div className="sticky left-0 top-0 z-40 bg-neutral-950 border-r border-yellow-500/20 py-2.5 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-yellow-400/70" />
              </div>

              {displayDays.map((day, i) => {
                const ds = displayDayStrs[i];
                const isToday = ds === todayStr;
                const cnt = bookingsByDay[ds]?.length ?? 0;
                const dayNameIdx = day.getDay() === 0 ? 6 : day.getDay() - 1;
                return (
                  <div
                    key={ds}
                    className={`py-2 px-1 text-center border-r border-yellow-500/20 last:border-r-0 cursor-pointer hover:bg-neutral-900 transition-colors ${
                      isToday ? 'bg-yellow-400/10' : ''
                    }`}
                    onClick={() => handleDayClick(ds)}
                  >
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-yellow-400' : 'text-neutral-400'}`}>
                      {SHORT_DAYS[dayNameIdx]}
                    </p>
                    <div
                      className={`mx-auto mt-0.5 w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${
                        isToday ? 'bg-yellow-400 text-black shadow-sm font-bold' : 'text-yellow-100'
                      }`}
                    >
                      {day.getDate()}
                    </div>
                    {cnt > 0 && (
                      <div className="flex justify-center items-center mt-0.5 gap-0.5">
                        {Array.from({ length: Math.min(cnt, 4) }).map((_, k) => (
                          <div key={k} className="w-1 h-1 rounded-full bg-yellow-400" />
                        ))}
                        {cnt > 4 && <div className="w-1 h-1 rounded-full bg-neutral-500" />}
                        <span className="text-[9px] font-mono text-yellow-400/70 ml-0.5">{cnt}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Grid Body: Hour Labels (Sticky Left) + Day Columns */}
            <div
              className="grid relative"
              style={{
                gridTemplateColumns: `52px repeat(${displayDays.length}, minmax(0, 1fr))`,
              }}
            >
              {/* Hour labels: STICKY LEFT */}
              <div className="sticky left-0 z-20 bg-neutral-950 border-r border-yellow-500/20 select-none">
                {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
                  <div
                    key={i}
                    style={{ height: `${cellHeight}px` }}
                    className="flex items-start justify-end pr-1.5 pt-0.5 border-b border-neutral-900 last:border-b-0"
                  >
                    <span className="text-[10px] font-mono text-yellow-500/70 -translate-y-2.5">
                      {String(HOUR_START + i).padStart(2, '0')}:00
                    </span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {displayDays.map((day, colIdx) => {
                const ds = displayDayStrs[colIdx];
                const isToday = ds === todayStr;
                const dayBks = bookingsByDay[ds] ?? [];

                // Layout overlapping events
                type BlockLayout = { booking: Booking; col: number; cols: number };
                const layouts: BlockLayout[] = [];
                if (dayBks.length > 0) {
                  const sorted = [...dayBks].sort((a, b) => a.oraInizio.localeCompare(b.oraInizio));
                  type Group = Booking[];
                  const groups: Group[] = [];
                  let current: Group = [sorted[0]];
                  let maxEnd = timeToMinutes(sorted[0].oraFine);
                  for (let i = 1; i < sorted.length; i++) {
                    const b = sorted[i];
                    if (timeToMinutes(b.oraInizio) < maxEnd) {
                      current.push(b);
                      maxEnd = Math.max(maxEnd, timeToMinutes(b.oraFine));
                    } else {
                      groups.push(current);
                      current = [b];
                      maxEnd = timeToMinutes(b.oraFine);
                    }
                  }
                  groups.push(current);
                  groups.forEach(group => {
                    group.forEach((bk, ci) => layouts.push({ booking: bk, col: ci, cols: group.length }));
                  });
                }

                return (
                  <div
                    key={ds}
                    className={`relative border-r border-yellow-500/20 last:border-r-0 ${isToday ? 'bg-yellow-400/[0.03]' : 'bg-[#0a0a0a]'}`}
                    style={{ height: `${(TOTAL_HOURS + 1) * cellHeight}px` }}
                    onClick={() => handleDayClick(ds)}
                  >
                    {/* Hour lines */}
                    {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
                      <div
                        key={i}
                        className="absolute left-0 right-0 border-t border-neutral-800/80"
                        style={{ top: `${i * cellHeight}px` }}
                      />
                    ))}
                    {/* Half-hour lines */}
                    {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                      <div
                        key={`h${i}`}
                        className="absolute left-0 right-0 border-t border-neutral-900/60 border-dashed"
                        style={{ top: `${i * cellHeight + cellHeight / 2}px` }}
                      />
                    ))}

                    {/* Booking blocks */}
                    {layouts.map(({ booking: b, col, cols }) => {
                      const room = rooms.find(r => r.id === b.salaId);
                      const colors = ROOM_COLORS[b.salaId] ?? COLOR_PALETTE[0];
                      const startMins = timeToMinutes(b.oraInizio) - HOUR_START * 60;
                      let endMins = timeToMinutes(b.oraFine) - HOUR_START * 60;
                      if (endMins <= startMins) endMins += 24 * 60;
                      const topPx = (startMins / 60) * cellHeight;
                      const heightPx = Math.max(20, ((endMins - startMins) / 60) * cellHeight);
                      const widthPct = 100 / cols;
                      const leftPct = col * widthPct;
                      const hasOperator = !!b.operatoreAssegnatoId;
                      const shortName = b.clienteNome.length > 12 && cols > 1 ? b.clienteNome.split(' ')[0] : b.clienteNome;

                      return (
                        <div
                          key={b.id}
                          onClick={e => { e.stopPropagation(); setActiveBookingDetail(b); }}
                          className="absolute rounded-md cursor-pointer overflow-hidden transition-all hover:brightness-115 hover:z-10 hover:shadow-lg select-none group border"
                          style={{
                            top: `${topPx + 1}px`,
                            height: `${heightPx - 2}px`,
                            left: `${leftPct + 0.5}%`,
                            width: `${widthPct - 1}%`,
                            backgroundColor: colors.bg,
                            borderColor: colors.border,
                            borderLeftWidth: '3.5px',
                            zIndex: 1,
                          }}
                          title={`${b.clienteNome} • ${b.oraInizio}-${b.oraFine} • ${b.salaNome}`}
                        >
                          <div className="p-1 h-full flex flex-col justify-between overflow-hidden gap-0.5 leading-tight">
                            <div className="flex items-center justify-between gap-1 min-w-0">
                              <span
                                className={`font-bold truncate ${
                                  cellHeight < 42 ? 'text-[9px]' : cellHeight > 70 ? 'text-xs' : 'text-[10px]'
                                }`}
                                style={{ color: colors.text }}
                              >
                                {shortName}
                              </span>
                              {b.tipo === 'lezione' && (
                                <span
                                  className="shrink-0 text-[8px] px-1 py-0.2 rounded bg-black/40 font-bold uppercase"
                                  style={{ color: colors.text }}
                                >
                                  Lez
                                </span>
                              )}
                            </div>

                            {heightPx >= 26 && (
                              <span
                                className={`leading-tight truncate opacity-90 font-mono ${
                                  cellHeight < 42 ? 'text-[8px]' : 'text-[9px]'
                                }`}
                                style={{ color: colors.text }}
                              >
                                {b.oraInizio}-{b.oraFine}
                              </span>
                            )}

                            {heightPx >= 46 && room && (
                              <span
                                className="text-[9px] leading-tight truncate opacity-75 mt-auto flex items-center gap-1"
                                style={{ color: colors.text }}
                              >
                                <DoorOpen className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{room.nome}</span>
                              </span>
                            )}

                            {!hasOperator && (
                              <div
                                className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-300 border border-amber-500 shadow-xs"
                                title="Nessun operatore assegnato"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="border-t border-yellow-500/20 px-3 sm:px-4 py-2 flex items-center gap-3 flex-wrap bg-neutral-950 text-xs">
          {rooms.map(r => {
            const c = ROOM_COLORS[r.id];
            return (
              <div key={r.id} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-xs shrink-0" style={{ backgroundColor: c?.bg }} />
                <span className="text-[10px] text-yellow-200/90 font-medium">{r.nome}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="w-2 h-2 rounded-full bg-amber-400 border border-amber-500 shrink-0" />
            <span className="text-[10px] text-neutral-400">Senza operatore</span>
          </div>
        </div>
      </div>

      {/* Floating + button (mobile) */}
      <button
        onClick={() => { setSelectedDateForBooking(formatDateToISO(today)); setBookingToEdit(null); setIsBookingModalOpen(true); }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-yellow-400 text-black font-bold rounded-full shadow-2xl shadow-yellow-500/30 flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-30 sm:hidden border border-black/20"
        title="Nuova Prenotazione"
      >
        <Plus className="w-6 h-6 stroke-[3]" />
      </button>

      {/* Booking Quick Detail Dialog */}
      {activeBookingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0e0e0e] rounded-xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-yellow-500/30 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                  activeBookingDetail.tipo === 'prove'
                    ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-500/40'
                    : 'bg-neutral-800 text-neutral-200 border border-neutral-700'
                }`}>
                  {activeBookingDetail.tipo === 'prove' ? <Music2 className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-yellow-100 text-base leading-tight">{activeBookingDetail.clienteNome}</h3>
                  <p className="text-xs text-neutral-400 font-normal capitalize">
                    {activeBookingDetail.tipo === 'prove' ? 'Sessione Prove Band' : 'Lezione di Musica'} &bull; {activeBookingDetail.salaNome}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveBookingDetail(null)}
                className="text-neutral-400 hover:text-yellow-400 p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
              >
                &#x2715;
              </button>
            </div>

            <div className="bg-neutral-950 rounded-lg p-3.5 space-y-2 text-xs border border-yellow-500/20">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Data &amp; Orario:</span>
                <span className="font-semibold text-yellow-300">{activeBookingDetail.data} ({activeBookingDetail.oraInizio} - {activeBookingDetail.oraFine})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Durata:</span>
                <span className="font-semibold text-yellow-300">{activeBookingDetail.durataOre} ore</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Operatore Sala:</span>
                {activeBookingDetail.operatoreAssegnatoNome ? (
                  <span className="font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />{activeBookingDetail.operatoreAssegnatoNome}
                  </span>
                ) : (
                  <span className="font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded">
                    &#9888;&#65039; Non Assegnato
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Tariffa:</span>
                <span className="font-bold text-yellow-400 text-sm">&#x20AC;{activeBookingDetail.tariffaTotale}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Stato Pagamento:</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                  activeBookingDetail.statoPagamento === 'pagato'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}>
                  {activeBookingDetail.statoPagamento === 'pagato' ? 'Pagato' : 'Da Saldare'}
                </span>
              </div>
            </div>

            {(() => {
              const activeClient = clients.find(c => c.id === activeBookingDetail.clienteId);
              const activeResolved = getAllEquipmentForBooking(activeBookingDetail, activeClient);
              return (
                <div className="bg-neutral-950 border border-yellow-500/20 rounded-xl p-3.5 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-yellow-400 uppercase tracking-wider">
                      <SlidersHorizontal className="w-4 h-4 text-yellow-400" />
                      <span>Strumentazione Richiesta</span>
                    </div>
                    {activeResolved.items.length > 0 && (
                      <span className="text-[10px] font-bold bg-yellow-400/20 text-yellow-300 border border-yellow-500/30 px-2 py-0.5 rounded-full">
                        {activeResolved.items.length} {activeResolved.items.length === 1 ? 'voce' : 'voci'}
                      </span>
                    )}
                  </div>
                  {activeResolved.items.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {activeResolved.items.map((item, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#121212] border border-yellow-500/30 text-yellow-200 shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />{item}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-400 italic">Nessuna strumentazione speciale (setup standard).</p>
                  )}
                </div>
              );
            })()}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setActiveBookingDetail(null)}
                className="px-3.5 py-2 rounded-lg border border-yellow-500/30 text-neutral-300 text-xs font-semibold hover:bg-neutral-800 transition-colors"
              >
                Chiudi
              </button>
              <button
                onClick={e => handleOpenEditBooking(activeBookingDetail, e)}
                className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs shadow-sm transition-all"
              >
                Modifica / Assegna Operatore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <BookingModal isOpen={isBookingModalOpen} onClose={() => setIsBookingModalOpen(false)} initialDate={selectedDateForBooking} bookingToEdit={bookingToEdit} />
      <AutoAssignModal isOpen={isAutoAssignModalOpen} onClose={() => setIsAutoAssignModalOpen(false)} result={autoAssignResult} />
      <EquipmentOverviewModal
        isOpen={isEquipmentModalOpen}
        onClose={() => setIsEquipmentModalOpen(false)}
        bookings={bookings}
        rooms={rooms}
        clients={clients}
        currentYear={yearLabel}
        currentMonth={dominantMonth.getMonth()}
        onSelectBooking={b => { setIsEquipmentModalOpen(false); setActiveBookingDetail(b); }}
      />
      <OperatorSchedulePrintModal isOpen={isOperatorScheduleModalOpen} onClose={() => setIsOperatorScheduleModalOpen(false)} />
    </div>
  );
};
