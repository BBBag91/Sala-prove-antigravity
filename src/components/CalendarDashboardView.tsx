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
const CELL_HEIGHT = 64; // px per hour

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
  { bg: '#2d7d46', border: '#1e5c32', text: '#ffffff' },
  { bg: '#b45309', border: '#92400e', text: '#ffffff' },
  { bg: '#1d4ed8', border: '#1e3a8a', text: '#ffffff' },
  { bg: '#7c3aed', border: '#5b21b6', text: '#ffffff' },
  { bg: '#0e7490', border: '#155e75', text: '#ffffff' },
  { bg: '#be123c', border: '#9f1239', text: '#ffffff' },
];

// -- Component ------------------------------------------------------------------
export const CalendarDashboardView: React.FC = () => {
  const { rooms, staff, bookings, clients, runAutoAssignment } = useApp();

  const today = new Date();
  const todayStr = formatDateToISO(today);

  const [weekStart, setWeekStart] = useState<Date>(getMondayOf(today));
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

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekDayStrs = weekDays.map(formatDateToISO);
  const dominantMonth = weekDays[3];
  const monthLabel = MESI_ITALIANI[dominantMonth.getMonth()];
  const yearLabel = dominantMonth.getFullYear();
  const weekNum = isoWeek(weekStart);
  const monthString = `${yearLabel}-${String(dominantMonth.getMonth() + 1).padStart(2, '0')}`;

  const handlePrevWeek = () => setWeekStart(w => addDays(w, -7));
  const handleNextWeek = () => setWeekStart(w => addDays(w, 7));
  const handleGoToday = () => setWeekStart(getMondayOf(today));

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
  weekDayStrs.forEach(ds => {
    bookingsByDay[ds] = filteredBookings
      .filter(b => b.data === ds)
      .sort((a, b) => a.oraInizio.localeCompare(b.oraInizio));
  });

  const ROOM_COLORS: Record<string, typeof COLOR_PALETTE[0]> = {};
  rooms.forEach((r, i) => { ROOM_COLORS[r.id] = COLOR_PALETTE[i % COLOR_PALETTE.length]; });

  return (
    <div className="space-y-3">

      {/* -- Toolbar -- */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
              <button onClick={handlePrevWeek} className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-white transition-colors" title="Settimana precedente">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleGoToday} className="px-2.5 py-1 rounded-md text-xs font-bold text-slate-700 hover:bg-white transition-colors">Oggi</button>
              <button onClick={handleNextWeek} className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-white transition-colors" title="Settimana successiva">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-baseline gap-1.5">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight whitespace-nowrap">
                {monthLabel}<span className="text-slate-400 font-semibold text-sm ml-1.5">{yearLabel}</span>
              </h2>
              <span className="hidden sm:inline text-[11px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">S{weekNum}</span>
            </div>
          </div>
          <button
            onClick={() => { setSelectedDateForBooking(formatDateToISO(today)); setBookingToEdit(null); setIsBookingModalOpen(true); }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold text-xs rounded-lg shadow-sm transition-all whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nuova Prenotazione</span>
            <span className="sm:hidden">Prenota</span>
          </button>
        </div>

        <div className="flex items-center justify-between px-3 sm:px-4 py-2 gap-2 flex-wrap sm:flex-nowrap bg-slate-50/60">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 h-7 shadow-sm">
              <DoorOpen className="w-3 h-3 text-slate-400 shrink-0" />
              <select value={selectedRoomFilter} onChange={e => setSelectedRoomFilter(e.target.value)} className="text-xs font-medium bg-transparent text-slate-700 focus:outline-none cursor-pointer max-w-[120px]">
                <option value="all">Tutte le Sale ({rooms.length})</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 h-7 shadow-sm">
              <Filter className="w-3 h-3 text-slate-400 shrink-0" />
              <select value={selectedTypeFilter} onChange={e => setSelectedTypeFilter(e.target.value as 'all' | 'prove' | 'lezione')} className="text-xs font-medium bg-transparent text-slate-700 focus:outline-none cursor-pointer">
                <option value="all">Tutte le Attivita</option>
                <option value="prove">Solo Prove</option>
                <option value="lezione">Solo Lezioni</option>
              </select>
            </div>
          </div>
          <div className="hidden sm:block w-px h-5 bg-slate-200 mx-1 shrink-0" />
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => setIsEquipmentModalOpen(true)} className="flex items-center gap-1.5 h-7 px-2.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-semibold text-xs rounded-lg shadow-sm transition-all whitespace-nowrap">
              <SlidersHorizontal className="w-3 h-3 text-purple-200" />
              <span className="hidden lg:inline">Prospetto Strumenti</span>
              <span className="lg:hidden">Strumenti</span>
            </button>
            <button onClick={() => setIsOperatorScheduleModalOpen(true)} className="flex items-center gap-1.5 h-7 px-2.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200 shadow-sm transition-all whitespace-nowrap">
              <Printer className="w-3 h-3 text-slate-500" />
              <span className="hidden lg:inline">PDF Operatori</span>
              <span className="lg:hidden">PDF</span>
            </button>
            <button onClick={handleRunAutoAssign} className="flex items-center gap-1.5 h-7 px-2.5 bg-slate-900 hover:bg-slate-700 active:scale-95 text-white font-semibold text-xs rounded-lg shadow-sm transition-all whitespace-nowrap">
              <Sparkles className="w-3 h-3 text-indigo-300" />
              <span className="hidden sm:inline">Assegna Turni IA</span>
              <span className="sm:hidden">IA</span>
              {unassignedCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-bold leading-none">{unassignedCount}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* -- Operator Shift Balance Banner -- */}
      <div className="bg-slate-900 text-white rounded-xl px-3.5 py-2.5 sm:px-4 shadow-sm border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-xs sm:text-sm font-semibold text-slate-100">
              Monte Ore Operatori &bull; {MESI_ITALIANI[dominantMonth.getMonth()]} {yearLabel}
            </h3>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">Prenotazioni:</span>
              <strong className="text-white font-bold">{monthlyBookings.length}</strong>
            </div>
            <span className="text-slate-700 hidden sm:inline">&bull;</span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">Totale ore:</span>
              <strong className="text-indigo-400 font-bold">{totalHoursMonth}h</strong>
            </div>
            <span className="text-slate-700 hidden sm:inline">&bull;</span>
            {unassignedCount > 0 ? (
              <div className="flex items-center gap-1 text-amber-300 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-[11px]">
                <AlertTriangle className="w-3 h-3" /><span>{unassignedCount} scoperti</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[11px]">
                <CheckCircle2 className="w-3 h-3" /><span>Tutti coperti</span>
              </div>
            )}
            <button onClick={() => setIsBalanceExpanded(!isBalanceExpanded)} className="flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded transition-colors ml-1">
              <span>{isBalanceExpanded ? 'Nascondi' : 'Dettagli'}</span>
              {isBalanceExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>
        {isBalanceExpanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-3 mt-2.5 border-t border-slate-800">
            {staff.filter(s => s.attivo && (s.ruolo === 'operatore' || s.ruolo === 'entrambi')).map(op => {
              const hours = operatorHours[op.id] || 0;
              const maxHours = Math.max(...Object.values(operatorHours), 1);
              const pct = Math.round((hours / maxHours) * 100);
              return (
                <div key={op.id} className="bg-slate-800/90 rounded-lg p-2.5 border border-slate-700/70 flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs text-white shrink-0" style={{ backgroundColor: op.coloreBadge }}>{op.nome[0]}</div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-200 truncate">{op.nome} {op.cognome}</p>
                      <p className="text-[10px] text-slate-400 truncate">{op.turniLavoroPrimario.length > 0 ? `${op.turniLavoroPrimario.length} turni primari` : 'Sempre disp.'}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-indigo-300">{hours} ore</p>
                    <div className="w-12 h-1 bg-slate-700 rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, Math.max(8, pct))}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* -- Weekly Time Grid -- */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Day header */}
        <div className="grid border-b border-slate-200 bg-slate-50" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
          <div className="border-r border-slate-200 py-3" />
          {weekDays.map((day, i) => {
            const ds = weekDayStrs[i];
            const isToday = ds === todayStr;
            const cnt = bookingsByDay[ds]?.length ?? 0;
            return (
              <div
                key={ds}
                className={`py-2 px-1 text-center border-r border-slate-200 last:border-r-0 cursor-pointer hover:bg-slate-100 transition-colors ${isToday ? 'bg-indigo-50' : ''}`}
                onClick={() => handleDayClick(ds)}
              >
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${isToday ? 'text-indigo-500' : 'text-slate-400'}`}>{SHORT_DAYS[i]}</p>
                <div className={`mx-auto mt-0.5 w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${isToday ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-800'}`}>
                  {day.getDate()}
                </div>
                {cnt > 0 && (
                  <div className="flex justify-center mt-0.5 gap-0.5">
                    {Array.from({ length: Math.min(cnt, 4) }).map((_, k) => (
                      <div key={k} className="w-1 h-1 rounded-full bg-indigo-400" />
                    ))}
                    {cnt > 4 && <div className="w-1 h-1 rounded-full bg-slate-300" />}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto" style={{ maxHeight: '72vh' }}>
          <div className="grid" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>

            {/* Hour labels */}
            <div className="border-r border-slate-200 bg-white">
              {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
                <div key={i} style={{ height: `${CELL_HEIGHT}px` }} className="flex items-start justify-end pr-2 pt-0.5 border-b border-slate-100 last:border-b-0">
                  <span className="text-[10px] font-mono text-slate-400 -translate-y-2.5">
                    {String(HOUR_START + i).padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day, colIdx) => {
              const ds = weekDayStrs[colIdx];
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
                  className={`relative border-r border-slate-200 last:border-r-0 ${isToday ? 'bg-indigo-50/20' : 'bg-white'}`}
                  style={{ height: `${(TOTAL_HOURS + 1) * CELL_HEIGHT}px` }}
                  onClick={() => handleDayClick(ds)}
                >
                  {/* Hour lines */}
                  {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
                    <div key={i} className="absolute left-0 right-0 border-t border-slate-100" style={{ top: `${i * CELL_HEIGHT}px` }} />
                  ))}
                  {/* Half-hour lines */}
                  {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                    <div key={`h${i}`} className="absolute left-0 right-0 border-t border-slate-50" style={{ top: `${i * CELL_HEIGHT + CELL_HEIGHT / 2}px` }} />
                  ))}

                  {/* Booking blocks */}
                  {layouts.map(({ booking: b, col, cols }) => {
                    const room = rooms.find(r => r.id === b.salaId);
                    const colors = ROOM_COLORS[b.salaId] ?? COLOR_PALETTE[0];
                    const startMins = timeToMinutes(b.oraInizio) - HOUR_START * 60;
                    let endMins = timeToMinutes(b.oraFine) - HOUR_START * 60;
                    if (endMins <= startMins) endMins += 24 * 60;
                    const topPx = (startMins / 60) * CELL_HEIGHT;
                    const heightPx = Math.max(22, ((endMins - startMins) / 60) * CELL_HEIGHT);
                    const widthPct = 100 / cols;
                    const leftPct = col * widthPct;
                    const hasOperator = !!b.operatoreAssegnatoId;
                    const shortName = b.clienteNome.length > 10 ? b.clienteNome.split(' ')[0] : b.clienteNome;
                    return (
                      <div
                        key={b.id}
                        onClick={e => { e.stopPropagation(); setActiveBookingDetail(b); }}
                        className="absolute rounded-md cursor-pointer overflow-hidden transition-all hover:brightness-110 hover:z-10 hover:shadow-lg select-none"
                        style={{
                          top: `${topPx + 1}px`,
                          height: `${heightPx - 2}px`,
                          left: `${leftPct + 0.5}%`,
                          width: `${widthPct - 1}%`,
                          backgroundColor: colors.bg,
                          borderLeft: `3px solid ${colors.border}`,
                          zIndex: 1,
                        }}
                        title={`${b.clienteNome} • ${b.oraInizio}-${b.oraFine} • ${b.salaNome}`}
                      >
                        <div className="p-1 h-full flex flex-col overflow-hidden gap-0.5">
                          <span className="font-bold leading-tight text-[10px] truncate" style={{ color: colors.text }}>
                            {shortName}
                          </span>
                          {heightPx > 36 && (
                            <span className="text-[9px] leading-tight truncate opacity-80" style={{ color: colors.text }}>
                              {b.oraInizio}–{b.oraFine}
                            </span>
                          )}
                          {heightPx > 52 && room && (
                            <span className="text-[9px] leading-tight truncate opacity-65 mt-auto" style={{ color: colors.text }}>
                              {room.nome.split(' ')[0]}
                            </span>
                          )}
                          {!hasOperator && (
                            <div className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-amber-300 border border-amber-500" title="Nessun operatore assegnato" />
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

        {/* Legend */}
        <div className="border-t border-slate-100 px-4 py-2 flex items-center gap-3 flex-wrap bg-slate-50/40">
          {rooms.map(r => {
            const c = ROOM_COLORS[r.id];
            return (
              <div key={r.id} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: c?.bg }} />
                <span className="text-[10px] text-slate-600 font-medium">{r.nome}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="w-2 h-2 rounded-full bg-amber-400 border border-amber-500 shrink-0" />
            <span className="text-[10px] text-slate-500">Senza operatore</span>
          </div>
        </div>
      </div>

      {/* Floating + button (mobile) */}
      <button
        onClick={() => { setSelectedDateForBooking(formatDateToISO(today)); setBookingToEdit(null); setIsBookingModalOpen(true); }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-30 sm:hidden"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Booking Quick Detail Dialog */}
      {activeBookingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeBookingDetail.tipo === 'prove' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                  {activeBookingDetail.tipo === 'prove' ? <Music2 className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">{activeBookingDetail.clienteNome}</h3>
                  <p className="text-xs text-slate-500 font-normal capitalize">
                    {activeBookingDetail.tipo === 'prove' ? 'Sessione Prove Band' : 'Lezione di Musica'} &bull; {activeBookingDetail.salaNome}
                  </p>
                </div>
              </div>
              <button onClick={() => setActiveBookingDetail(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">&#x2715;</button>
            </div>
            <div className="bg-slate-50 rounded-lg p-3.5 space-y-2 text-xs border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Data &amp; Orario:</span>
                <span className="font-semibold text-slate-800">{activeBookingDetail.data} ({activeBookingDetail.oraInizio} - {activeBookingDetail.oraFine})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Durata:</span>
                <span className="font-semibold text-slate-800">{activeBookingDetail.durataOre} ore</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Operatore Sala:</span>
                {activeBookingDetail.operatoreAssegnatoNome ? (
                  <span className="font-semibold text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{activeBookingDetail.operatoreAssegnatoNome}</span>
                ) : (
                  <span className="font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">&#9888;&#65039; Non Assegnato</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Tariffa:</span>
                <span className="font-bold text-slate-900">&#x20AC;{activeBookingDetail.tariffaTotale}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Stato Pagamento:</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${activeBookingDetail.statoPagamento === 'pagato' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  {activeBookingDetail.statoPagamento === 'pagato' ? 'Pagato' : 'Da Saldare'}
                </span>
              </div>
            </div>
            {(() => {
              const activeClient = clients.find(c => c.id === activeBookingDetail.clienteId);
              const activeResolved = getAllEquipmentForBooking(activeBookingDetail, activeClient);
              return (
                <div className="bg-purple-50/85 border border-purple-200 rounded-xl p-3.5 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-900 uppercase tracking-wider">
                      <SlidersHorizontal className="w-4 h-4 text-purple-700" />
                      <span>Strumentazione Necessaria</span>
                    </div>
                    {activeResolved.items.length > 0 && (
                      <span className="text-[10px] font-bold bg-purple-200 text-purple-900 px-2 py-0.5 rounded-full">
                        {activeResolved.items.length} {activeResolved.items.length === 1 ? 'voce' : 'voci'}
                      </span>
                    )}
                  </div>
                  {activeResolved.items.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {activeResolved.items.map((item, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-white border border-purple-200 text-purple-950 shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-600 shrink-0" />{item}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Nessuna strumentazione speciale (setup standard).</p>
                  )}
                </div>
              );
            })()}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setActiveBookingDetail(null)} className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-50">Chiudi</button>
              <button onClick={e => handleOpenEditBooking(activeBookingDetail, e)} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm">
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
