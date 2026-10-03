import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
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
  Trash2,
  RefreshCw,
  CalendarClock,
  CalendarDays,
  Shield,
  X,
  RotateCcw,
  Move,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Booking, DailyShiftComputed, DeleteRecurringMode } from '../types';
import { DeleteRecurringBookingModal } from './DeleteRecurringBookingModal';
import {
  formatDateToISO,
  parseISODate,
  MESI_ITALIANI,
  timeToMinutes,
  minutesToTime,
  formatDateItalian,
} from '../utils/dateUtils';
import { AutoAssignResult, getOperatorAccumulatedHours } from '../utils/scheduler';
import { computeDailyShifts, isWeekdayDate } from '../utils/shiftUtils';
import { getAllEquipmentForBooking } from '../utils/equipmentUtils';

// Modal and secondary view dynamic lazy imports for lightning-fast rendering
const AutoAssignModal = lazy(() => import('./AutoAssignModal').then(m => ({ default: m.AutoAssignModal })));
const BookingModal = lazy(() => import('./BookingModal').then(m => ({ default: m.BookingModal })));
const EquipmentOverviewModal = lazy(() => import('./EquipmentOverviewModal').then(m => ({ default: m.EquipmentOverviewModal })));
const OperatorSchedulePrintModal = lazy(() => import('./OperatorSchedulePrintModal').then(m => ({ default: m.OperatorSchedulePrintModal })));
const ShiftQuickModal = lazy(() => import('./ShiftQuickModal').then(m => ({ default: m.ShiftQuickModal })));
const ShiftsView = lazy(() => import('./ShiftsView').then(m => ({ default: m.ShiftsView })));
const MorningBriefingModal = lazy(() => import('./MorningBriefingModal').then(m => ({ default: m.MorningBriefingModal })));

// -- Constants ------------------------------------------------------------------
const HOUR_START = 9;

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

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  const targetDay = d.getDate();
  d.setMonth(d.getMonth() + n);
  if (d.getDate() !== targetDay) {
    d.setDate(0);
  }
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
  { bg: '#15803d', border: '#166534', text: '#ffffff' }, // Verde smeraldo vivace
  { bg: '#dc2626', border: '#b91c1c', text: '#ffffff' }, // Rosso cremisi
  { bg: '#d97706', border: '#b45309', text: '#ffffff' }, // Ambra dorata
  { bg: '#2563eb', border: '#1d4ed8', text: '#ffffff' }, // Blu reale
  { bg: '#7c3aed', border: '#6d28d9', text: '#ffffff' }, // Viola intenso
  { bg: '#0891b2', border: '#0e7490', text: '#ffffff' }, // Ciano oceano
  { bg: '#475569', border: '#334155', text: '#ffffff' }, // Grigio ardesia
];

type ViewMode = 'day' | '3days' | 'week';

interface CalendarDashboardViewProps {
  onNavigateToTurni?: () => void;
}

// -- Component ------------------------------------------------------------------
export const CalendarDashboardView: React.FC<CalendarDashboardViewProps> = ({
  onNavigateToTurni,
}) => {
  const { rooms, staff, bookings, clients, runAutoAssignment, updateBooking, deleteBooking, refreshFromCloud, isAutoRefreshing, shifts } = useApp();
  const { isAdmin } = useAuth();
  const { isDark } = useTheme();

  // Stato per modale eliminazione serie ricorrente
  const [recurringDeleteModalBooking, setRecurringDeleteModalBooking] = useState<Booking | null>(null);

  const today = new Date();
  const todayStr = formatDateToISO(today);

  // Responsive window tracking
  const [windowWidth, setWindowWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isMobile = windowWidth < 640;

  // Active anchor date for calendar navigation
  const [currentDate, setCurrentDate] = useState<Date>(today);
  // Default a 7 giorni ('week') su qualsiasi dispositivo (incluso smartphone)
  const [viewMode, setViewMode] = useState<ViewMode>('week');

  // Dynamic zoom: height of one hour in pixels
  // 36px: Panoramica (entire 9:00 - 23:00 fits in ~500px, no scrolling needed!)
  // 56px: Standard (balanced)
  // 84px: Dettagliato (maximum legibility)
  // Attiva normalmente come opzione di default: 36px (Panoramica)
  const [cellHeight, setCellHeight] = useState<number>(36);

  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'prove' | 'lezione'>('all');
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [isOperatorScheduleModalOpen, setIsOperatorScheduleModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedDateForBooking, setSelectedDateForBooking] = useState<string>('');
  const [selectedStartTimeForBooking, setSelectedStartTimeForBooking] = useState<string>('18:00');
  const [bookingToEdit, setBookingToEdit] = useState<Booking | null>(null);
  const [isAutoAssignModalOpen, setIsAutoAssignModalOpen] = useState(false);
  const [autoAssignResult, setAutoAssignResult] = useState<AutoAssignResult | null>(null);
  const [activeBookingDetail, setActiveBookingDetail] = useState<Booking | null>(null);
  const [isBalanceExpanded, setIsBalanceExpanded] = useState(false);
  const [selectedShiftForEdit, setSelectedShiftForEdit] = useState<DailyShiftComputed | null>(null);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isShiftsPanelOpen, setIsShiftsPanelOpen] = useState(false);
  const [isDailyBriefingOpen, setIsDailyBriefingOpen] = useState(false);
  const [showShiftsInGrid, setShowShiftsInGrid] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('salaprove_show_shifts_grid_v1');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });

  // Quick Date/Month Picker state
  const [isQuickDatePickerOpen, setIsQuickDatePickerOpen] = useState(false);
  const [quickPickerYear, setQuickPickerYear] = useState<number>(() => today.getFullYear());

  // Drag-to-move booking on grid state
  const gridScrollContainerRef = useRef<HTMLDivElement>(null);
  const dragJustEndedRef = useRef(false);
  const dragTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holdingBookingId, setHoldingBookingId] = useState<string | null>(null);
  const pendingDragRef = useRef<{
    booking: Booking;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    grabOffsetY: number;
    pointerId: number;
  } | null>(null);

  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    booking: Booking;
    currentPointerX: number;
    currentPointerY: number;
    targetDate: string;
    targetStartMins: number;
    targetEndMins: number;
    targetOraInizio: string;
    targetOraFine: string;
    hasConflict: boolean;
    conflictNames: string[];
    grabOffsetY: number;
  } | null>(null);

  const [moveToast, setMoveToast] = useState<{
    visible: boolean;
    bookingTitle: string;
    roomName: string;
    targetDate: string;
    targetOraInizio: string;
    targetOraFine: string;
    previousBooking: Booking;
  } | null>(null);

  // Auto-dismiss move confirmation toast after 7 seconds
  useEffect(() => {
    if (!moveToast?.visible) return;
    const timer = setTimeout(() => {
      setMoveToast(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [moveToast]);

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
    showWeekSwipeToast('prev');
  };

  const handleNext = () => {
    if (viewMode === 'day') {
      setCurrentDate(d => addDays(d, 1));
    } else if (viewMode === '3days') {
      setCurrentDate(d => addDays(d, 3));
    } else {
      setCurrentDate(d => addDays(d, 7));
    }
    showWeekSwipeToast('next');
  };

  // Navigazione rapida per mesi
  const handlePrevMonth = () => {
    setCurrentDate(d => addMonths(d, -1));
  };

  const handleNextMonth = () => {
    setCurrentDate(d => addMonths(d, 1));
  };

  const handleGoToday = () => {
    setCurrentDate(today);
  };

  // Mobile / Touchscreen Swipe gesture navigation per le settimane
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchCurrentRef = useRef<{ x: number; y: number } | null>(null);
  const [weekSwipeToast, setWeekSwipeToast] = useState<{
    direction: 'prev' | 'next';
    label: string;
  } | null>(null);
  const swipeToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (swipeToastTimerRef.current) {
        clearTimeout(swipeToastTimerRef.current);
      }
    };
  }, []);

  const showWeekSwipeToast = (direction: 'prev' | 'next') => {
    if (swipeToastTimerRef.current) {
      clearTimeout(swipeToastTimerRef.current);
    }
    const targetDate = direction === 'next'
      ? (viewMode === 'day' ? addDays(currentDate, 1) : viewMode === '3days' ? addDays(currentDate, 3) : addDays(currentDate, 7))
      : (viewMode === 'day' ? addDays(currentDate, -1) : viewMode === '3days' ? addDays(currentDate, -3) : addDays(currentDate, -7));
    
    const targetMon = getMondayOf(targetDate);
    const targetWeekNum = isoWeek(targetMon);
    const targetMonthName = MESI_ITALIANI[targetMon.getMonth()];
    const label = viewMode === 'week'
      ? (direction === 'next' ? `Settimana S${targetWeekNum} (${targetMonthName}) ➔` : `⬅ Settimana S${targetWeekNum} (${targetMonthName})`)
      : (direction === 'next' ? `Giorno Successivo ➔` : `⬅ Giorno Precedente`);

    setWeekSwipeToast({ direction, label });
    swipeToastTimerRef.current = setTimeout(() => {
      setWeekSwipeToast(null);
    }, 1300);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) {
      touchStartRef.current = null;
      return;
    }

    // Non attivare lo swipe se si sta trascinando una prenotazione o se un modale è aperto
    if (
      dragState?.isDragging ||
      pendingDragRef.current ||
      dragJustEndedRef.current ||
      isShiftModalOpen ||
      isBookingModalOpen ||
      isAutoAssignModalOpen ||
      activeBookingDetail ||
      isQuickDatePickerOpen ||
      isShiftsPanelOpen ||
      isDailyBriefingOpen ||
      isOperatorScheduleModalOpen ||
      isEquipmentModalOpen
    ) {
      touchStartRef.current = null;
      return;
    }

    // Ignora elementi interattivi (pulsanti, input, selettori)
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('textarea') ||
      target.closest('a')
    ) {
      touchStartRef.current = null;
      return;
    }

    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    touchCurrentRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current || e.touches.length !== 1) return;
    const t = e.touches[0];
    touchCurrentRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current || !touchCurrentRef.current) {
      touchStartRef.current = null;
      touchCurrentRef.current = null;
      return;
    }

    if (dragState?.isDragging || dragJustEndedRef.current || pendingDragRef.current) {
      touchStartRef.current = null;
      touchCurrentRef.current = null;
      return;
    }

    const deltaX = touchCurrentRef.current.x - touchStartRef.current.x;
    const deltaY = touchCurrentRef.current.y - touchStartRef.current.y;
    const elapsed = Date.now() - touchStartRef.current.time;

    touchStartRef.current = null;
    touchCurrentRef.current = null;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Gestione Swipe orizzontale per navigazione settimane su smartphone:
    // Minimo 45px di scorrimento, dominanza orizzontale (absX > absY * 1.3), durata max 800ms
    if (absX >= 45 && absX > absY * 1.3 && elapsed <= 800) {
      if (deltaX < 0) {
        // Swipe verso sinistra (dito da destra verso sinistra) -> Settimana successiva
        handleNext();
        showWeekSwipeToast('next');
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(25); } catch {}
        }
      } else {
        // Swipe verso destra (dito da sinistra verso destra) -> Settimana precedente
        handlePrev();
        showWeekSwipeToast('prev');
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(25); } catch {}
        }
      }
    }
  };

  const handleTouchCancel = () => {
    touchStartRef.current = null;
    touchCurrentRef.current = null;
  };

  // Salto diretto a mese e anno
  const handleJumpToMonth = (targetMonthIndex: number, targetYear?: number) => {
    setCurrentDate(d => {
      const year = targetYear !== undefined ? targetYear : d.getFullYear();
      const maxDaysInTargetMonth = new Date(year, targetMonthIndex + 1, 0).getDate();
      const day = Math.min(d.getDate(), maxDaysInTargetMonth);
      return new Date(year, targetMonthIndex, day);
    });
  };

  // Salto a data specifica
  const handleJumpToDate = (isoDateStr: string) => {
    if (!isoDateStr) return;
    const parsed = parseISODate(isoDateStr);
    if (!isNaN(parsed.getTime())) {
      setCurrentDate(parsed);
    }
  };

  // Scorciatoie da tastiera per navigazione rapida (Frecce Sinistra/Destra, Shift per Mesi, 'T' o 'O' per Oggi)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;
      if (
        isBookingModalOpen ||
        isShiftModalOpen ||
        isShiftsPanelOpen ||
        isEquipmentModalOpen ||
        isOperatorScheduleModalOpen ||
        isAutoAssignModalOpen ||
        isQuickDatePickerOpen
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        if (e.shiftKey) {
          e.preventDefault();
          handlePrevMonth();
        } else {
          e.preventDefault();
          handlePrev();
        }
      } else if (e.key === 'ArrowRight') {
        if (e.shiftKey) {
          e.preventDefault();
          handleNextMonth();
        } else {
          e.preventDefault();
          handleNext();
        }
      } else if (e.key.toLowerCase() === 't' || e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleGoToday();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isBookingModalOpen,
    isShiftModalOpen,
    isShiftsPanelOpen,
    isEquipmentModalOpen,
    isOperatorScheduleModalOpen,
    isAutoAssignModalOpen,
    isQuickDatePickerOpen,
    viewMode,
  ]);

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

  const { monthlyBookings, unassignedCount, totalHoursMonth, operatorHours } = useMemo(() => {
    const mBookings = bookings.filter(b => b.data.startsWith(monthString));
    const uCount = mBookings.filter(b => !b.operatoreAssegnatoId).length;
    const tHours = mBookings.reduce((s, b) => s + (b.durataOre || 0), 0);
    const opHours = getOperatorAccumulatedHours(staff, bookings, monthString);
    return {
      monthlyBookings: mBookings,
      unassignedCount: uCount,
      totalHoursMonth: tHours,
      operatorHours: opHours,
    };
  }, [bookings, monthString, staff]);

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      if (selectedRoomFilter !== 'all' && b.salaId !== selectedRoomFilter) return false;
      if (selectedTypeFilter !== 'all' && b.tipo !== selectedTypeFilter) return false;
      return true;
    });
  }, [bookings, selectedRoomFilter, selectedTypeFilter]);

  const handleDayClick = (dateStr: string, e?: React.MouseEvent<HTMLDivElement>) => {
    if (dragJustEndedRef.current) return;
    let startHourStr = '18:00';
    if (e) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickY = Math.max(0, e.clientY - rect.top);
      const clickedMinutesFromStart = (clickY / cellHeight) * 60;
      const totalMins = HOUR_START * 60 + Math.floor(clickedMinutesFromStart / 30) * 30;
      const clampedMins = Math.max(HOUR_START * 60, Math.min(23 * 60, totalMins));
      const h = Math.floor(clampedMins / 60);
      const m = clampedMins % 60;
      startHourStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    setSelectedDateForBooking(dateStr);
    setSelectedStartTimeForBooking(startHourStr);
    setBookingToEdit(null);
    setIsBookingModalOpen(true);
  };

  const handleOpenEditBooking = (booking: Booking, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookingToEdit(booking);
    setIsBookingModalOpen(true);
    setActiveBookingDetail(null);
  };

  const handleDeleteBooking = (booking: Booking) => {
    // Nel profilo utente non è consentito cancellare eventi passati (solo giorno stesso o futuri)
    if (!isAdmin && booking.data < todayStr) {
      alert('Nel profilo utente non è consentito cancellare eventi passati. È possibile cancellare solo eventi del giorno stesso o futuri.');
      return;
    }

    if (booking.gruppoRicorrenzaId) {
      setRecurringDeleteModalBooking(booking);
      setActiveBookingDetail(null);
      return;
    }

    if (window.confirm(`Sei sicuro di voler eliminare la prenotazione di ${booking.clienteNome}?`)) {
      deleteBooking(booking.id);
      setActiveBookingDetail(null);
    }
  };

  const handleConfirmRecurringDelete = (mode: DeleteRecurringMode) => {
    if (recurringDeleteModalBooking) {
      deleteBooking(recurringDeleteModalBooking.id, mode);
      setRecurringDeleteModalBooking(null);
    }
  };

  const handleRunAutoAssign = () => {
    const result = runAutoAssignment(monthString);
    setAutoAssignResult(result);
    setIsAutoAssignModalOpen(true);
  };

  const { bookingsByDay, currentHourEnd, currentTotalHours } = useMemo(() => {
    const byDay: Record<string, Booking[]> = {};
    displayDayStrs.forEach(ds => {
      byDay[ds] = filteredBookings
        .filter(b => b.data === ds)
        .sort((a, b) => a.oraInizio.localeCompare(b.oraInizio));
    });

    const maxMins = Math.max(
      23 * 60,
      ...displayDayStrs.flatMap((ds) =>
        (byDay[ds] || []).map((b) => {
          let e = timeToMinutes(b.oraFine);
          if (e <= timeToMinutes(b.oraInizio)) e += 24 * 60;
          return e;
        })
      )
    );
    const hourEnd = Math.max(23, Math.ceil(maxMins / 60));
    const totalHours = hourEnd - HOUR_START;
    return {
      bookingsByDay: byDay,
      currentHourEnd: hourEnd,
      currentTotalHours: totalHours,
    };
  }, [displayDayStrs, filteredBookings]);

  const ROOM_COLORS = useMemo(() => {
    const colors: Record<string, { bg: string; border: string; text: string }> = {};
    rooms.forEach((r, i) => {
      const fallback = COLOR_PALETTE[i % COLOR_PALETTE.length];
      const bg = r.colore && r.colore.startsWith('#') ? r.colore : fallback.bg;
      colors[r.id] = {
        bg,
        border: 'rgba(0, 0, 0, 0.3)',
        text: '#ffffff',
      };
    });
    return colors;
  }, [rooms]);

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

  // Calcolo della posizione target durante il drag & drop sulla griglia del calendario
  const calculateDragTarget = useCallback(
    (booking: Booking, clientX: number, clientY: number, grabOffsetY: number) => {
      const dayElements = Array.from(
        document.querySelectorAll<HTMLElement>('[data-day-column]')
      );
      let matchedCol: HTMLElement | null = null;
      for (const colEl of dayElements) {
        const rect = colEl.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right) {
          matchedCol = colEl;
          break;
        }
      }
      if (!matchedCol && dayElements.length > 0) {
        const firstRect = dayElements[0].getBoundingClientRect();
        const lastRect = dayElements[dayElements.length - 1].getBoundingClientRect();
        if (clientX < firstRect.left) {
          matchedCol = dayElements[0];
        } else if (clientX > lastRect.right) {
          matchedCol = dayElements[dayElements.length - 1];
        }
      }

      const targetDate = matchedCol?.dataset.dayColumn || booking.data;
      const colRect = matchedCol?.getBoundingClientRect();
      const colTop = colRect ? colRect.top : 0;
      const relativeY = Math.max(0, clientY - colTop - grabOffsetY);
      const rawMinutesFromHourStart = (relativeY / cellHeight) * 60;
      const rawMidnightMins = HOUR_START * 60 + rawMinutesFromHourStart;

      // Snap a scatti precisi di 15 minuti
      let snappedStartMins = Math.round(rawMidnightMins / 15) * 15;

      // Durata della prenotazione
      let startM = timeToMinutes(booking.oraInizio);
      let endM = timeToMinutes(booking.oraFine);
      if (endM <= startM) endM += 24 * 60;
      const durMins = Math.max(15, endM - startM);

      const minMins = HOUR_START * 60;
      const maxMins = (HOUR_START + currentTotalHours) * 60 - durMins;
      snappedStartMins = Math.max(minMins, Math.min(maxMins, snappedStartMins));
      const snappedEndMins = snappedStartMins + durMins;

      const targetOraInizio = minutesToTime(snappedStartMins);
      const targetOraFine = minutesToTime(snappedEndMins);

      // Rilevamento conflitti nella stessa sala nel giorno di destinazione
      const conflicts = bookings.filter((other) => {
        if (other.id === booking.id) return false;
        if (other.data !== targetDate) return false;
        if (other.salaId !== booking.salaId) return false;
        const oStart = timeToMinutes(other.oraInizio);
        let oEnd = timeToMinutes(other.oraFine);
        if (oEnd <= oStart) oEnd += 24 * 60;
        return oStart < snappedEndMins && oEnd > snappedStartMins;
      });

      return {
        targetDate,
        targetStartMins: snappedStartMins,
        targetEndMins: snappedEndMins,
        targetOraInizio,
        targetOraFine,
        hasConflict: conflicts.length > 0,
        conflictNames: conflicts.map((c) => c.clienteNome),
      };
    },
    [cellHeight, currentTotalHours, bookings]
  );

  const startDrag = useCallback(
    (booking: Booking, clientX: number, clientY: number, grabOffsetY: number) => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(35);
        } catch {}
      }
      const targetInfo = calculateDragTarget(booking, clientX, clientY, grabOffsetY);
      setDragState({
        isDragging: true,
        booking,
        currentPointerX: clientX,
        currentPointerY: clientY,
        grabOffsetY,
        ...targetInfo,
      });
      document.body.style.userSelect = 'none';
    },
    [calculateDragTarget]
  );

  const handleBookingPointerDown = (
    booking: Booking,
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (e.button !== 0) return;
    const cardRect = e.currentTarget.getBoundingClientRect();
    const grabOffsetY = Math.min(
      Math.max(8, e.clientY - cardRect.top),
      cardRect.height - 8
    );

    pendingDragRef.current = {
      booking,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      grabOffsetY,
      pointerId: e.pointerId,
    };

    if (dragTimerRef.current) {
      clearTimeout(dragTimerRef.current);
      dragTimerRef.current = null;
    }
    setHoldingBookingId(booking.id);

    // Come richiesto: attendi esattamente 1.5 secondi (1500ms) di pressione continua prima di abilitare lo spostamento (drag & drop)
    dragTimerRef.current = setTimeout(() => {
      if (pendingDragRef.current) {
        setHoldingBookingId(null);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate([40, 30, 40]);
          } catch {}
        }
        startDrag(
          pendingDragRef.current.booking,
          pendingDragRef.current.lastX,
          pendingDragRef.current.lastY,
          pendingDragRef.current.grabOffsetY
        );
      }
    }, 1500);
  };

  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent) => {
      if (pendingDragRef.current && !dragState?.isDragging) {
        pendingDragRef.current.lastX = e.clientX;
        pendingDragRef.current.lastY = e.clientY;
        const dx = Math.abs(e.clientX - pendingDragRef.current.startX);
        const dy = Math.abs(e.clientY - pendingDragRef.current.startY);

        // Se durante l'attesa di 1.5s il dito/mouse si muove oltre 22px (intenzione di scorrere/scrollare la griglia),
        // annulla l'attivazione per evitare spostamenti accidentali e permettere lo scroll naturale
        if (dx > 22 || dy > 22) {
          if (dragTimerRef.current) {
            clearTimeout(dragTimerRef.current);
            dragTimerRef.current = null;
          }
          pendingDragRef.current = null;
          setHoldingBookingId(null);
        }
        // NOTA: Non avviare MAI lo spostamento qui prima che sia trascorso 1.5 secondi!
      }

      if (dragState?.isDragging) {
        e.preventDefault();

        // Autoscroll fluido quando ci si avvicina ai bordi superiore o inferiore della griglia
        if (gridScrollContainerRef.current) {
          const containerRect = gridScrollContainerRef.current.getBoundingClientRect();
          const edgeThreshold = 40;
          if (e.clientY < containerRect.top + edgeThreshold) {
            gridScrollContainerRef.current.scrollTop -= 12;
          } else if (e.clientY > containerRect.bottom - edgeThreshold) {
            gridScrollContainerRef.current.scrollTop += 12;
          }
        }

        const targetInfo = calculateDragTarget(
          dragState.booking,
          e.clientX,
          e.clientY,
          dragState.grabOffsetY
        );

        setDragState((prev) =>
          prev
            ? {
                ...prev,
                currentPointerX: e.clientX,
                currentPointerY: e.clientY,
                ...targetInfo,
              }
            : null
        );
      }
    };

    const handleWindowPointerUp = () => {
      if (dragTimerRef.current) {
        clearTimeout(dragTimerRef.current);
        dragTimerRef.current = null;
      }
      pendingDragRef.current = null;
      setHoldingBookingId(null);

      if (dragState?.isDragging) {
        document.body.style.userSelect = '';
        dragJustEndedRef.current = true;
        setTimeout(() => {
          dragJustEndedRef.current = false;
        }, 300);

        const { booking, targetDate, targetOraInizio, targetOraFine, targetStartMins, targetEndMins } =
          dragState;
        const hasMoved = targetDate !== booking.data || targetOraInizio !== booking.oraInizio;

        if (hasMoved) {
          if (dragState.hasConflict) {
            alert(
              `Spostamento non consentito:\n\nLa sala "${booking.salaNome}" risulta già occupata il ${targetDate} nella fascia oraria ${targetOraInizio} - ${targetOraFine} da:\n${dragState.conflictNames
                .map((c) => `• ${c}`)
                .join('\n')}\n\nNon è possibile sovrapporre due eventi nella stessa sala.`
            );
            setDragState(null);
            return;
          }

          const previousBooking = { ...booking };
          const durHours = (targetEndMins - targetStartMins) / 60;
          const updated: Booking = {
            ...booking,
            data: targetDate,
            oraInizio: targetOraInizio,
            oraFine: targetOraFine,
            durataOre: durHours,
          };
          updateBooking(updated);

          setMoveToast({
            visible: true,
            bookingTitle: booking.clienteNome || 'Prenotazione',
            roomName: booking.salaNome,
            targetDate,
            targetOraInizio,
            targetOraFine,
            previousBooking,
          });
        }

        setDragState(null);
      }
    };

    const handleWindowPointerCancel = () => {
      if (dragTimerRef.current) {
        clearTimeout(dragTimerRef.current);
        dragTimerRef.current = null;
      }
      pendingDragRef.current = null;
      setHoldingBookingId(null);
      if (dragState?.isDragging) {
        document.body.style.userSelect = '';
        setDragState(null);
        dragJustEndedRef.current = true;
        setTimeout(() => {
          dragJustEndedRef.current = false;
        }, 250);
      }
    };

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerCancel);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerCancel);
    };
  }, [dragState, calculateDragTarget, startDrag, updateBooking]);

  return (
    <div className="space-y-3 print:hidden">

      {/* -- Toolbar -- */}
      <div className="bg-white dark:bg-[#0e0e0e] rounded-xl border border-slate-200 dark:border-yellow-500/25 shadow-sm overflow-hidden">
        
        {/* Row 1: Nav & View & Zoom */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:px-4 sm:py-2.5 border-b border-slate-200 dark:border-yellow-500/20 gap-1.5 sm:gap-2">
          
          {/* Left: Date navigation arrows (Mesi & Settimane) & Title with Quick Picker */}
          <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 flex-wrap">
            <div className="flex items-center bg-slate-100 dark:bg-[#141414] rounded-xl p-1 border border-slate-200 dark:border-yellow-500/30 shrink-0">
              {/* Mese Precedente */}
              <button
                onClick={handlePrevMonth}
                className="flex items-center justify-center gap-0.5 px-2 py-1.5 min-h-[38px] sm:min-h-[44px] rounded-lg text-slate-700 dark:text-yellow-400 hover:text-blue-600 dark:hover:text-yellow-300 hover:bg-white dark:hover:bg-neutral-800 transition-all text-xs font-bold cursor-pointer touch-manipulation touch-active"
                title="Mese precedente (Shift + Freccia Sinistra)"
                aria-label="Mese precedente"
              >
                <ChevronsLeft className="w-4 h-4" />
                <span className="hidden md:inline">Mese</span>
              </button>

              {/* Settimana Precedente */}
              <button
                onClick={handlePrev}
                className="flex items-center justify-center gap-0.5 px-2 py-1.5 min-h-[38px] sm:min-h-[44px] rounded-lg text-slate-700 dark:text-yellow-400 hover:text-blue-600 dark:hover:text-yellow-300 hover:bg-white dark:hover:bg-neutral-800 transition-all text-xs font-bold cursor-pointer touch-manipulation touch-active"
                title="Settimana precedente (Freccia Sinistra)"
                aria-label="Settimana precedente"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden md:inline">Sett.</span>
              </button>

              {/* Oggi */}
              <button
                onClick={handleGoToday}
                className="px-2.5 sm:px-3 py-1.5 min-h-[38px] sm:min-h-[44px] rounded-lg text-xs font-black text-white dark:text-black bg-blue-600 hover:bg-blue-700 dark:bg-yellow-400 dark:hover:bg-yellow-300 transition-all shadow-xs cursor-pointer touch-manipulation touch-active"
                title="Torna alla data corrente (Tasto T o O)"
              >
                <span className="text-white dark:text-black font-black">Oggi</span>
              </button>

              {/* Settimana Successiva */}
              <button
                onClick={handleNext}
                className="flex items-center justify-center gap-0.5 px-2 py-1.5 min-h-[38px] sm:min-h-[44px] rounded-lg text-slate-700 dark:text-yellow-400 hover:text-blue-600 dark:hover:text-yellow-300 hover:bg-white dark:hover:bg-neutral-800 transition-all text-xs font-bold cursor-pointer touch-manipulation touch-active"
                title="Settimana successiva (Freccia Destra)"
                aria-label="Settimana successiva"
              >
                <span className="hidden md:inline">Sett.</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Mese Successivo */}
              <button
                onClick={handleNextMonth}
                className="flex items-center justify-center gap-0.5 px-2 py-1.5 min-h-[38px] sm:min-h-[44px] rounded-lg text-slate-700 dark:text-yellow-400 hover:text-blue-600 dark:hover:text-yellow-300 hover:bg-white dark:hover:bg-neutral-800 transition-all text-xs font-bold cursor-pointer touch-manipulation touch-active"
                title="Mese successivo (Shift + Freccia Destra)"
                aria-label="Mese successivo"
              >
                <span className="hidden md:inline">Mese</span>
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>

            {/* Clickable Title that opens Quick Date/Month Picker */}
            <button
              type="button"
              onClick={() => {
                setQuickPickerYear(dominantMonth.getFullYear());
                setIsQuickDatePickerOpen(true);
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-900 border border-transparent hover:border-slate-300 dark:hover:border-yellow-500/30 transition-all text-left cursor-pointer group"
              title="Clicca per aprire il selettore rapido di Mesi, Anni e Settimane"
            >
              <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-yellow-400 group-hover:scale-110 transition-transform shrink-0" />
              <h2 className="text-xs sm:text-base font-bold text-slate-900 dark:text-yellow-100 group-hover:text-blue-600 dark:group-hover:text-yellow-300 tracking-tight truncate flex items-center gap-1.5">
                <span>{titleText}</span>
                <ChevronDown className="w-3 h-3 text-slate-400 dark:text-yellow-400/70 group-hover:text-blue-600 dark:group-hover:text-yellow-300 transition-transform" />
              </h2>
              {viewMode === 'week' && (
                <span className="hidden sm:inline text-[10px] sm:text-[11px] font-mono text-blue-700 dark:text-yellow-400/80 bg-blue-50 dark:bg-neutral-900 border border-blue-200 dark:border-yellow-500/30 px-1.5 py-0.5 rounded shrink-0">
                  S{weekNum}
                </span>
              )}
            </button>
          </div>

          {/* Right: View Mode Toggle & Zoom & Action Button */}
          <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 flex-wrap">
            
            {/* View Mode Toggle: 1G / 3G / 7G */}
            <div className="flex items-center bg-slate-100 dark:bg-[#141414] rounded-xl p-1 border border-slate-200 dark:border-yellow-500/30 shrink-0">
              <button
                onClick={() => setViewMode('day')}
                className={`px-2.5 sm:px-3 py-1.5 min-h-[38px] sm:min-h-[44px] rounded-lg text-xs font-bold transition-all touch-manipulation touch-active ${
                  viewMode === 'day'
                    ? 'bg-blue-600 dark:bg-yellow-400 text-white dark:text-black shadow-xs font-black'
                    : 'text-slate-600 dark:text-yellow-300/80 hover:text-blue-600 dark:hover:text-yellow-300 hover:bg-white dark:hover:bg-neutral-800'
                }`}
                title="Vista 1 Giorno (Massima leggibilità su smartphone)"
              >
                <span className="sm:hidden">1G</span>
                <span className="hidden sm:inline">Giorno</span>
              </button>
              <button
                onClick={() => setViewMode('3days')}
                className={`px-2.5 sm:px-3 py-1.5 min-h-[38px] sm:min-h-[44px] rounded-lg text-xs font-bold transition-all touch-manipulation touch-active ${
                  viewMode === '3days'
                    ? 'bg-blue-600 dark:bg-yellow-400 text-white dark:text-black shadow-xs font-black'
                    : 'text-slate-600 dark:text-yellow-300/80 hover:text-blue-600 dark:hover:text-yellow-300 hover:bg-white dark:hover:bg-neutral-800'
                }`}
                title="Vista 3 Giorni"
              >
                <span className="sm:hidden">3G</span>
                <span className="hidden sm:inline">3 Giorni</span>
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-2.5 sm:px-3 py-1.5 min-h-[38px] sm:min-h-[44px] rounded-lg text-xs font-bold transition-all touch-manipulation touch-active ${
                  viewMode === 'week'
                    ? 'bg-blue-600 dark:bg-yellow-400 text-white dark:text-black shadow-xs font-black'
                    : 'text-slate-600 dark:text-yellow-300/80 hover:text-blue-600 dark:hover:text-yellow-300 hover:bg-white dark:hover:bg-neutral-800'
                }`}
                title="Vista Settimana (7 giorni)"
              >
                <span className="sm:hidden">7G</span>
                <span className="hidden sm:inline">Settimana</span>
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 shrink-0">
              <div className="flex items-center bg-slate-100 dark:bg-[#141414] rounded-lg p-0.5 border border-slate-200 dark:border-yellow-500/30">
                <button
                  onClick={handleZoomOut}
                  disabled={cellHeight <= 34}
                  className="p-1 sm:p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md text-slate-700 dark:text-yellow-400 hover:text-blue-600 dark:hover:text-yellow-300 hover:bg-white dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation"
                  title="Rimpicciolisci zoom"
                  aria-label="Rimpicciolisci zoom"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (cellHeight <= 40) setCellHeight(56);
                    else if (cellHeight <= 68) setCellHeight(84);
                    else setCellHeight(36);
                  }}
                  className="px-1.5 py-1 text-[10px] font-mono font-bold text-slate-700 dark:text-yellow-400 hover:bg-white dark:hover:bg-neutral-800 rounded transition-colors touch-manipulation"
                  title="Alterna livelli di zoom (Panoramica, Standard, Dettagliato)"
                >
                  {zoomPercent}%
                </button>
                <button
                  onClick={handleZoomIn}
                  disabled={cellHeight >= 105}
                  className="p-1 sm:p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md text-slate-700 dark:text-yellow-400 hover:text-blue-600 dark:hover:text-yellow-300 hover:bg-white dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation"
                  title="Ingrandisci zoom"
                  aria-label="Ingrandisci zoom"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 1-Click Panoramica Preset */}
              <button
                onClick={() => setCellHeight(cellHeight <= 40 ? 56 : 36)}
                className={`px-2.5 py-1.5 min-h-[38px] rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 touch-manipulation touch-active ${
                  cellHeight <= 40
                    ? 'bg-blue-600 dark:bg-yellow-400 text-white dark:text-black border-blue-600 dark:border-yellow-400 shadow-sm'
                    : 'bg-blue-50 dark:bg-[#141414] text-blue-700 dark:text-yellow-400 hover:bg-blue-100 dark:hover:bg-yellow-400/10 border-blue-200 dark:border-yellow-500/30'
                }`}
                title="Panoramica completa: vedi tutte le ore della giornata senza dover scrollare"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Panoramica</span>
              </button>
            </div>

            {/* Auto-Sync & Manual Refresh Button */}
            <button
              onClick={() => refreshFromCloud()}
              disabled={isAutoRefreshing}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-lg border border-blue-200 dark:border-yellow-500/30 bg-blue-50 dark:bg-[#141414] hover:bg-blue-100 dark:hover:bg-yellow-400/10 text-blue-700 dark:text-yellow-400 text-xs font-bold transition-all disabled:opacity-60 cursor-pointer touch-manipulation touch-active"
              title="Sincronizza ora con Supabase (Auto-refresh attivo ogni 5 min e in tempo reale)"
              aria-label="Sincronizza cloud"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAutoRefreshing ? 'animate-spin text-blue-600 dark:text-yellow-300' : 'text-blue-600 dark:text-yellow-400'}`} />
              <span className="hidden lg:inline text-[10px] text-blue-600 dark:text-yellow-400/80 font-normal">
                {isAutoRefreshing ? 'Sincronizzazione...' : 'Auto-sync (5m)'}
              </span>
            </button>



            {/* New Booking Button */}
            <button
              onClick={() => {
                setSelectedDateForBooking(formatDateToISO(today));
                setSelectedStartTimeForBooking('18:00');
                setBookingToEdit(null);
                setIsBookingModalOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 min-h-[44px] bg-blue-600 hover:bg-blue-700 dark:bg-yellow-400 dark:hover:bg-yellow-300 active:scale-95 text-white dark:text-black font-black text-xs rounded-xl shadow-sm transition-all whitespace-nowrap ml-auto sm:ml-0 cursor-pointer touch-manipulation touch-active"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span className="hidden sm:inline">Nuova Prenotazione</span>
              <span className="sm:hidden">Prenota</span>
            </button>
          </div>
        </div>

        {/* Row 2: Filters & Actions */}
        <div className="flex items-center justify-between px-2 sm:px-4 py-1.5 sm:py-2 gap-1.5 flex-wrap bg-slate-50 dark:bg-[#080808] border-t border-slate-200 dark:border-yellow-500/20">
          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-[160px]">
            <div className="flex items-center gap-1 bg-white dark:bg-[#141414] border border-slate-200 dark:border-yellow-500/25 rounded-lg px-1.5 sm:px-2 py-0.5 h-6.5 sm:h-7 shadow-2xs">
              <DoorOpen className="w-3 h-3 text-blue-600 dark:text-yellow-500/70 shrink-0" />
              <select
                value={selectedRoomFilter}
                onChange={e => setSelectedRoomFilter(e.target.value)}
                className="text-[11px] sm:text-xs font-semibold bg-transparent text-slate-800 dark:text-yellow-200 focus:outline-none cursor-pointer max-w-[110px] sm:max-w-[130px]"
              >
                <option value="all">Tutte le Sale ({rooms.length})</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-1 bg-white dark:bg-[#141414] border border-slate-200 dark:border-yellow-500/25 rounded-lg px-1.5 sm:px-2 py-0.5 h-6.5 sm:h-7 shadow-2xs">
              <Filter className="w-3 h-3 text-blue-600 dark:text-yellow-500/70 shrink-0" />
              <select
                value={selectedTypeFilter}
                onChange={e => setSelectedTypeFilter(e.target.value as 'all' | 'prove' | 'lezione')}
                className="text-[11px] sm:text-xs font-semibold bg-transparent text-slate-800 dark:text-yellow-200 focus:outline-none cursor-pointer"
              >
                <option value="all">Tutte le Attività</option>
                <option value="prove">Solo Prove</option>
                <option value="lezione">Solo Lezioni</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
            {/* Pulsante Pannello Turni (17-20 / 20-23 dinamico) */}
            <button
              onClick={() => setIsShiftsPanelOpen(true)}
              className="flex items-center gap-1 h-6.5 sm:h-7 px-2 sm:px-2.5 bg-blue-600 hover:bg-blue-700 dark:bg-yellow-400 dark:hover:bg-yellow-300 text-white dark:text-black font-bold text-[11px] sm:text-xs rounded-lg shadow-sm transition-all whitespace-nowrap cursor-pointer"
              title="Apri pannello completo gestione turni presidio sala (17-20 e 20-23 con adattamento dinamico)"
            >
              <CalendarClock className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Pannello Turni</span>
              <span className="sm:hidden">Turni</span>
            </button>

            {/* Toggle Visibilità Turni nella Griglia Oraria */}
            <button
              onClick={() => {
                const next = !showShiftsInGrid;
                setShowShiftsInGrid(next);
                localStorage.setItem('salaprove_show_shifts_grid_v1', String(next));
              }}
              className={`flex items-center gap-1 h-6.5 sm:h-7 px-2 sm:px-2.5 font-semibold text-[11px] sm:text-xs rounded-lg border transition-all whitespace-nowrap cursor-pointer ${
                showShiftsInGrid
                  ? 'bg-blue-50 dark:bg-neutral-900 text-blue-700 dark:text-yellow-300 border-blue-300 dark:border-yellow-500/50 hover:bg-blue-100 dark:hover:bg-neutral-800'
                  : 'bg-white dark:bg-neutral-950 text-slate-500 dark:text-neutral-500 border-slate-200 dark:border-neutral-800 hover:text-slate-700 dark:hover:text-neutral-300'
              }`}
              title="Attiva/Disattiva la visualizzazione dei turni operatore direttamente nella griglia del calendario"
            >
              <Shield className={`w-3 h-3 ${showShiftsInGrid ? 'text-blue-600 dark:text-yellow-400' : 'text-slate-400 dark:text-neutral-500'}`} />
              <span className="hidden lg:inline">{showShiftsInGrid ? 'Turni in Griglia: ON' : 'Turni in Griglia: OFF'}</span>
              <span className="lg:hidden">{showShiftsInGrid ? 'In Griglia' : 'No Griglia'}</span>
            </button>

            <button
              onClick={() => setIsEquipmentModalOpen(true)}
              className="flex items-center gap-1 h-6.5 sm:h-7 px-2 sm:px-2.5 bg-white dark:bg-neutral-900 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-700 dark:text-yellow-300 font-semibold text-[11px] sm:text-xs rounded-lg border border-slate-200 dark:border-yellow-500/30 transition-all whitespace-nowrap cursor-pointer"
              title="Prospetto Strumenti"
            >
              <SlidersHorizontal className="w-3 h-3 text-blue-600 dark:text-yellow-400" />
              <span className="hidden sm:inline">Strumenti</span>
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={() => setIsOperatorScheduleModalOpen(true)}
                  className="flex items-center gap-1 h-6.5 sm:h-7 px-2 sm:px-2.5 bg-white dark:bg-neutral-900 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-700 dark:text-yellow-300 font-semibold text-[11px] sm:text-xs rounded-lg border border-slate-200 dark:border-yellow-500/30 transition-all whitespace-nowrap"
                  title="PDF Operatori"
                >
                  <Printer className="w-3 h-3 text-blue-600 dark:text-yellow-400" />
                  <span className="hidden sm:inline">PDF</span>
                </button>

                <button
                  onClick={handleRunAutoAssign}
                  className="flex items-center gap-1 h-6.5 sm:h-7 px-2 sm:px-2.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white dark:bg-yellow-400/20 dark:hover:bg-yellow-400 dark:text-yellow-300 dark:hover:text-black font-bold text-[11px] sm:text-xs rounded-lg border border-blue-200 dark:border-yellow-500/40 transition-all whitespace-nowrap"
                >
                  <Sparkles className="w-3 h-3 text-blue-600 dark:text-yellow-400" />
                  <span className="hidden sm:inline">Assegna IA</span>
                  <span className="sm:hidden">IA</span>
                  {unassignedCount > 0 && (
                    <span className="ml-0.5 px-1 py-0.2 rounded-full bg-blue-600 text-white dark:bg-yellow-400 dark:text-black text-[9px] font-bold leading-none">
                      {unassignedCount}
                    </span>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Row 3 (Optional): Weekdays Quick-Picker for 1G and 3G mode */}
        {viewMode !== 'week' && (
          <div className="flex items-center gap-1 overflow-x-auto py-1.5 px-2 bg-slate-50 dark:bg-neutral-950 border-t border-slate-200 dark:border-yellow-500/20 no-scrollbar">
            <span className="text-[10px] text-slate-500 dark:text-yellow-500/70 font-bold uppercase tracking-wider shrink-0 mr-1">
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
                      ? 'bg-blue-600 dark:bg-yellow-400 text-white dark:text-black font-bold shadow-xs'
                      : 'bg-white dark:bg-neutral-900 text-slate-700 dark:text-yellow-200/80 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-blue-600 dark:hover:text-yellow-300 border border-slate-200 dark:border-yellow-500/20'
                  }`}
                >
                  <span>{SHORT_DAYS[i]} {d.getDate()}</span>
                  {isToday && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white dark:bg-black' : 'bg-blue-600 dark:bg-yellow-400'}`} />}
                  {count > 0 && (
                    <span className={`text-[10px] px-1 rounded-full font-bold ${
                      isSelected ? 'bg-white/20 text-white dark:bg-black/20 dark:text-black' : 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-yellow-400/20 dark:text-yellow-300'
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

      {/* -- Operator Shift Balance Banner (Space-optimized for mobile, Admin only) -- */}
      {isAdmin && (
        <div className="bg-white dark:bg-[#0e0e0e] text-slate-900 dark:text-white rounded-xl px-2.5 sm:px-4 py-2 sm:py-2.5 shadow-sm border border-slate-200 dark:border-yellow-500/20">
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-blue-50 dark:bg-yellow-400/20 text-blue-600 dark:text-yellow-400 flex items-center justify-center shrink-0 border border-blue-200 dark:border-yellow-500/30">
                <User className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-yellow-100 truncate">
                <span className="sm:hidden">Monte Ore:</span>
                <span className="hidden sm:inline">Monte Ore Operatori &bull; {monthLabel} {yearLabel}</span>
              </h3>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3 text-[11px] sm:text-xs flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-slate-500 dark:text-neutral-400 text-[10px] sm:text-[11px]">Pren:</span>
                <strong className="text-blue-600 dark:text-yellow-400 font-bold">{monthlyBookings.length}</strong>
              </div>
              <span className="text-slate-300 dark:text-neutral-600">&bull;</span>
              <div className="flex items-center gap-1">
                <span className="text-slate-500 dark:text-neutral-400 text-[10px] sm:text-[11px]">Ore:</span>
                <strong className="text-blue-600 dark:text-yellow-400 font-bold">{totalHoursMonth}h</strong>
              </div>
              <span className="text-slate-300 dark:text-neutral-600">&bull;</span>
              {unassignedCount > 0 ? (
                <div className="flex items-center gap-0.5 text-amber-700 dark:text-amber-300 font-semibold bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-500/30 text-[10px]">
                  <AlertTriangle className="w-2.5 h-2.5" /><span>{unassignedCount} scoperti</span>
                </div>
              ) : (
                <div className="flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-500/30 text-[10px]">
                  <CheckCircle2 className="w-2.5 h-2.5" /><span>Coperti</span>
                </div>
              )}
              <button
                onClick={() => setIsBalanceExpanded(!isBalanceExpanded)}
                className="flex items-center gap-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-yellow-300 hover:text-blue-600 dark:hover:text-yellow-100 bg-slate-100 dark:bg-neutral-900 hover:bg-slate-200 dark:hover:bg-neutral-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-yellow-500/25 transition-colors"
              >
                <span>{isBalanceExpanded ? 'Chiudi' : 'Dettagli'}</span>
                {isBalanceExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {isBalanceExpanded && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-3 mt-2.5 border-t border-slate-200 dark:border-yellow-500/20">
              {staff.filter(s => s.attivo && (s.ruolo === 'operatore' || s.ruolo === 'entrambi')).map(op => {
                const hours = operatorHours[op.id] || 0;
                const maxHours = Math.max(...(Object.values(operatorHours) as number[]), 1);
                const pct = Math.round((hours / maxHours) * 100);
                return (
                  <div key={op.id} className="bg-slate-50 dark:bg-neutral-950 rounded-lg p-2.5 border border-slate-200 dark:border-yellow-500/20 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs" style={{ backgroundColor: op.coloreBadge }}>
                        {op.nome[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-yellow-100 truncate">{op.nome} {op.cognome}</p>
                        <p className="text-[10px] text-slate-500 dark:text-neutral-400 truncate">{op.turniLavoroPrimario.length > 0 ? `${op.turniLavoroPrimario.length} turni primari` : 'Sempre disp.'}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-blue-600 dark:text-yellow-400">{hours} ore</p>
                      <div className="w-12 h-1 bg-slate-200 dark:bg-neutral-800 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-blue-600 dark:bg-yellow-400 rounded-full" style={{ width: `${Math.min(100, Math.max(8, pct))}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* -- Time Grid with Zoom & Mobile Scroll & Touch Swipe Navigation -- */}
      <div
        className="bg-white dark:bg-[#0c0c0c] rounded-xl border border-slate-200 dark:border-yellow-500/25 shadow-sm overflow-hidden flex flex-col touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        
        {/* Scrollable Container with sticky headers & sticky hour column */}
        <div
          ref={gridScrollContainerRef}
          className="overflow-auto relative"
          style={{
            maxHeight: cellHeight <= 38 && viewMode === 'week' ? 'none' : 'calc(100vh - 210px)',
            minHeight: '380px',
          }}
          onWheel={handleWheel}
        >
          <div className="w-full min-w-full">
            {/* Day Header: STICKY TOP with integrated Quick Navigation Strip */}
            <div className="sticky top-0 z-30 bg-white dark:bg-neutral-950 shadow-xs">
              
              {/* Quick Navigation Strip (All buttons grouped together on the same side!) */}
              <div className="flex items-center gap-2 px-2 sm:px-3 py-1 bg-slate-50 dark:bg-black/95 border-b border-slate-200 dark:border-yellow-500/25 text-xs select-none sticky left-0 min-w-full overflow-x-auto no-scrollbar">
                {/* Unified Navigation Button Cluster */}
                <div className="flex items-center bg-white dark:bg-[#141414] rounded-lg p-0.5 border border-slate-200 dark:border-yellow-500/30 shrink-0 shadow-xs">
                  {/* Mese Precedente */}
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="flex items-center gap-0.5 px-2 py-0.5 rounded-md text-slate-700 dark:text-yellow-400 hover:text-blue-600 dark:hover:text-yellow-300 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors text-[11px] font-bold cursor-pointer"
                    title="Mese precedente (Shift + Freccia Sinistra)"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                    <span>Mese</span>
                  </button>

                  {/* Settimana Precedente */}
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="flex items-center gap-0.5 px-2 py-0.5 rounded-md text-slate-700 dark:text-yellow-400 hover:text-blue-600 dark:hover:text-yellow-300 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors text-[11px] font-bold cursor-pointer"
                    title="Settimana precedente (Freccia Sinistra)"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Sett.</span>
                  </button>

                  {/* Oggi */}
                  <button
                    type="button"
                    onClick={handleGoToday}
                    className="px-2.5 py-0.5 rounded-md bg-blue-600 dark:bg-yellow-400 hover:bg-blue-700 dark:hover:bg-yellow-300 text-white dark:text-black text-[11px] font-black transition-colors cursor-pointer shadow-xs"
                    title="Torna alla settimana corrente / Oggi (Tasto T o O)"
                  >
                    <span className="text-white dark:text-black font-black">Oggi</span>
                  </button>

                  {/* Settimana Successiva */}
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex items-center gap-0.5 px-2 py-0.5 rounded-md text-slate-700 dark:text-yellow-400 hover:text-blue-600 dark:hover:text-yellow-300 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors text-[11px] font-bold cursor-pointer"
                    title="Settimana successiva (Freccia Destra)"
                  >
                    <span>Sett.</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  {/* Mese Successivo */}
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="flex items-center gap-0.5 px-2 py-0.5 rounded-md text-slate-700 dark:text-yellow-400 hover:text-blue-600 dark:hover:text-yellow-300 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors text-[11px] font-bold cursor-pointer"
                    title="Mese successivo (Shift + Freccia Destra)"
                  >
                    <span>Mese</span>
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Date / Month Picker right beside the buttons */}
                <button
                  type="button"
                  onClick={() => {
                    setQuickPickerYear(dominantMonth.getFullYear());
                    setIsQuickDatePickerOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-white dark:bg-neutral-900/90 hover:bg-blue-50 dark:hover:bg-yellow-400/20 text-slate-800 dark:text-yellow-200 hover:text-blue-600 dark:hover:text-yellow-400 border border-slate-200 dark:border-yellow-500/40 text-xs font-bold transition-all cursor-pointer group shrink-0 shadow-2xs"
                  title="Clicca per aprire il selettore rapido di Mesi, Anni e Settimane"
                >
                  <CalendarDays className="w-3.5 h-3.5 text-blue-600 dark:text-yellow-400 group-hover:scale-110 transition-transform" />
                  <span className="font-extrabold tracking-tight">{monthLabel} {yearLabel}</span>
                  <span className="text-[10px] font-mono text-blue-700 dark:text-yellow-400 bg-blue-50 dark:bg-yellow-400/10 px-1 py-0.2 rounded border border-blue-200 dark:border-yellow-500/30">
                    S{weekNum}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400 dark:text-yellow-400/70" />
                </button>
              </div>

              {/* Day Header Columns Grid */}
              <div
                className="grid border-b border-slate-200 dark:border-yellow-500/25 bg-slate-50 dark:bg-neutral-950"
                style={{
                  gridTemplateColumns: `clamp(34px, 8.5vw, 50px) repeat(${displayDays.length}, minmax(0, 1fr))`,
                }}
              >
                {/* Corner cell: STICKY LEFT */}
                <div className="sticky left-0 z-30 bg-slate-50 dark:bg-neutral-950 border-r border-slate-200 dark:border-yellow-500/20 py-1.5 sm:py-2 flex items-center justify-center">
                  <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 dark:text-yellow-400/70" />
                </div>

              {displayDays.map((day, i) => {
                const ds = displayDayStrs[i];
                const isToday = ds === todayStr;
                const cnt = bookingsByDay[ds]?.length ?? 0;
                const dayNameIdx = day.getDay() === 0 ? 6 : day.getDay() - 1;
                const isWeekday = isWeekdayDate(ds);
                const [s1, s2] = isWeekday
                  ? computeDailyShifts(ds, bookingsByDay[ds] || [], shifts, staff)
                  : [null, null];

                return (
                  <div
                    key={ds}
                    className={`py-1.5 sm:py-2 px-1 text-center border-r border-slate-200 dark:border-yellow-500/20 last:border-r-0 cursor-pointer hover:bg-slate-100 dark:hover:bg-neutral-900 transition-colors flex flex-col justify-between ${
                      isToday ? 'bg-blue-50/70 dark:bg-yellow-400/10' : ''
                    }`}
                    onClick={() => handleDayClick(ds)}
                  >
                    <div>
                      <p className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-blue-600 dark:text-yellow-400' : 'text-slate-500 dark:text-neutral-400'}`}>
                        {SHORT_DAYS[dayNameIdx]}
                      </p>
                      <div
                        className={`mx-auto mt-0.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm ${
                          isToday ? 'bg-blue-600 dark:bg-yellow-400 text-white dark:text-black shadow-xs font-bold' : 'text-slate-800 dark:text-yellow-100'
                        }`}
                      >
                        <span className={isToday ? 'text-white dark:text-black' : ''}>{day.getDate()}</span>
                      </div>
                      {cnt > 0 && (
                        <div className="flex justify-center items-center mt-0.5 gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-yellow-400 shrink-0" />
                          <span className="text-[8px] sm:text-[9px] font-mono text-blue-600 dark:text-yellow-400/80">{cnt}</span>
                        </div>
                      )}
                    </div>

                    {/* Blocchi Turno (1° e 2° Turno Presidio Sala) */}
                    {isWeekday && s1 && s2 && (
                      showShiftsInGrid ? (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedShiftForEdit(s1);
                            setIsShiftModalOpen(true);
                          }}
                          className="mt-1 pt-1 border-t border-slate-200 dark:border-yellow-500/20 flex items-center justify-center gap-1 cursor-pointer hover:bg-blue-50 dark:hover:bg-yellow-400/10 px-1 py-0.5 rounded transition-all group/hdr"
                          title={`Turni di oggi:\n• T1 (${s1.oraInizio}-${s1.oraFine}): ${s1.operatoreNome || 'Da assegnare'}\n• T2 (${s2.oraInizio}-${s2.oraFine}): ${s2.operatoreNome || 'Da assegnare'}\n(Clicca per gestire)`}
                        >
                          <Shield className="w-2.5 h-2.5 text-blue-600 dark:text-yellow-400 shrink-0" />
                          <span className="text-[7.5px] sm:text-[8px] font-bold text-slate-700 dark:text-yellow-200/90 group-hover/hdr:text-blue-600 dark:group-hover/hdr:text-yellow-300 truncate">
                            {s1.operatoreNome ? s1.operatoreNome.split(' ')[0] : '⚠️'} &bull; {s2.operatoreNome ? s2.operatoreNome.split(' ')[0] : '⚠️'}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-1.5 pt-1 border-t border-slate-200 dark:border-yellow-500/20 flex flex-col gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                          {/* 1° Turno */}
                          <div
                            onClick={() => {
                              setSelectedShiftForEdit(s1);
                              setIsShiftModalOpen(true);
                            }}
                            className={`p-1 rounded-md border text-left cursor-pointer transition-all hover:scale-[1.02] shadow-2xs ${
                              s1.operatoreNome
                                ? 'bg-white dark:bg-neutral-900/90 border-slate-200 dark:border-yellow-500/30 hover:border-blue-400 dark:hover:border-yellow-400'
                                : 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/35 hover:border-amber-500'
                            }`}
                            title={`1° Turno (${s1.oraInizio} - ${s1.oraFine}): ${s1.operatoreNome || 'Non assegnato'} (Clicca per visualizzare/modificare)`}
                          >
                            <div className="flex items-center justify-between gap-0.5 leading-none">
                              <span className="text-[7.5px] font-black px-0.5 py-0.2 rounded bg-blue-50 dark:bg-yellow-400/25 text-blue-700 dark:text-yellow-300">
                                T1
                              </span>
                              <span className="text-[8px] sm:text-[8.5px] font-mono font-bold text-slate-700 dark:text-yellow-200 truncate">
                                {s1.oraInizio.slice(0, 5)}-{s1.oraFine.slice(0, 5)}
                              </span>
                              {s1.isAdapted && (
                                <span className="text-[6.5px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-400/20 px-0.5 rounded" title={s1.adaptationReason}>
                                  +{s1.minutiExtra}m
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1 min-w-0">
                              {s1.operatoreNome ? (
                                <>
                                  <span
                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: s1.operatoreBadgeColor || '#f59e0b' }}
                                  />
                                  <span className="text-[8px] sm:text-[8.5px] font-semibold text-slate-800 dark:text-white truncate">
                                    {s1.operatoreNome.split(' ')[0]}
                                  </span>
                                </>
                              ) : (
                                <span className="text-[7.5px] font-semibold text-amber-700 dark:text-amber-400 truncate">
                                  ⚠️ Assegna
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 2° Turno */}
                          <div
                            onClick={() => {
                              setSelectedShiftForEdit(s2);
                              setIsShiftModalOpen(true);
                            }}
                            className={`p-1 rounded-md border text-left cursor-pointer transition-all hover:scale-[1.02] shadow-2xs ${
                              s2.operatoreNome
                                ? 'bg-white dark:bg-neutral-900/90 border-slate-200 dark:border-yellow-500/30 hover:border-blue-400 dark:hover:border-yellow-400'
                                : 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/35 hover:border-amber-500'
                            }`}
                            title={`2° Turno (${s2.oraInizio} - ${s2.oraFine}): ${s2.operatoreNome || 'Non assegnato'} (Clicca per visualizzare/modificare)`}
                          >
                            <div className="flex items-center justify-between gap-0.5 leading-none">
                              <span className="text-[7.5px] font-black px-0.5 py-0.2 rounded bg-blue-50 dark:bg-yellow-400/25 text-blue-700 dark:text-yellow-300">
                                T2
                              </span>
                              <span className="text-[8px] sm:text-[8.5px] font-mono font-bold text-slate-700 dark:text-yellow-200 truncate">
                                {s2.oraInizio.slice(0, 5)}-{s2.oraFine.slice(0, 5)}
                              </span>
                              {s2.isAdapted && (
                                <span className="text-[6.5px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-400/20 px-0.5 rounded" title={s2.adaptationReason}>
                                  +{s2.minutiExtra}m
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1 min-w-0">
                              {s2.operatoreNome ? (
                                <>
                                  <span
                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: s2.operatoreBadgeColor || '#f59e0b' }}
                                  />
                                  <span className="text-[8px] sm:text-[8.5px] font-semibold text-slate-800 dark:text-white truncate">
                                    {s2.operatoreNome.split(' ')[0]}
                                  </span>
                                </>
                              ) : (
                                <span className="text-[7.5px] font-semibold text-amber-700 dark:text-amber-400 truncate">
                                  ⚠️ Assegna
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
            </div>

            {/* Grid Body: Hour Labels (Sticky Left) + Day Columns */}
            <div
              className="grid relative"
              style={{
                gridTemplateColumns: `clamp(34px, 8.5vw, 50px) repeat(${displayDays.length}, minmax(0, 1fr))`,
              }}
            >
              {/* Hour labels: STICKY LEFT */}
              <div className="sticky left-0 z-20 bg-slate-50 dark:bg-neutral-950 border-r border-slate-200 dark:border-yellow-500/20 select-none">
                {Array.from({ length: currentTotalHours + 1 }, (_, i) => {
                  const hourNum = HOUR_START + i;
                  const labelStr = hourNum === 24 ? '00:00' : `${String(hourNum % 24).padStart(2, '0')}:00`;
                  return (
                    <div
                      key={i}
                      style={{ height: `${cellHeight}px` }}
                      className="flex items-start justify-end pr-1 sm:pr-1.5 pt-0.5 border-b border-slate-200 dark:border-neutral-900 last:border-b-0"
                    >
                      <span className="text-[8px] sm:text-[10px] font-mono text-slate-400 dark:text-yellow-500/70 -translate-y-2.5">
                        {labelStr}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Day columns */}
              {displayDays.map((day, colIdx) => {
                const ds = displayDayStrs[colIdx];
                const isToday = ds === todayStr;
                const dayBks = bookingsByDay[ds] ?? [];

                const isWeekdayCol = isWeekdayDate(ds);
                const [s1Col, s2Col] = isWeekdayCol
                  ? computeDailyShifts(ds, dayBks, shifts, staff)
                  : [null, null];

                let s1TopPx = 0;
                let s1HeightPx = 0;
                let s2TopPx = 0;
                let s2HeightPx = 0;

                if (s1Col && s2Col) {
                  const s1Start = timeToMinutes(s1Col.oraInizio) - HOUR_START * 60;
                  let s1End = timeToMinutes(s1Col.oraFine) - HOUR_START * 60;
                  if (s1End <= s1Start) s1End += 24 * 60;
                  s1TopPx = (s1Start / 60) * cellHeight;
                  s1HeightPx = ((s1End - s1Start) / 60) * cellHeight;

                  const s2Start = timeToMinutes(s2Col.oraInizio) - HOUR_START * 60;
                  let s2End = timeToMinutes(s2Col.oraFine) - HOUR_START * 60;
                  if (s2End <= s2Start) s2End += 24 * 60;
                  s2TopPx = (s2Start / 60) * cellHeight;
                  s2HeightPx = ((s2End - s2Start) / 60) * cellHeight;
                }

                // Layout overlapping events using interval packing to optimize column widths for bookings
                type BlockLayout = { booking: Booking; col: number; cols: number };
                const layouts: BlockLayout[] = [];
                if (dayBks.length > 0) {
                  const sorted = [...dayBks].sort((a, b) => {
                    const diff = a.oraInizio.localeCompare(b.oraInizio);
                    if (diff !== 0) return diff;
                    let aEnd = timeToMinutes(a.oraFine);
                    let bEnd = timeToMinutes(b.oraFine);
                    if (aEnd <= timeToMinutes(a.oraInizio)) aEnd += 24 * 60;
                    if (bEnd <= timeToMinutes(b.oraInizio)) bEnd += 24 * 60;
                    return bEnd - aEnd;
                  });

                  type Group = Booking[];
                  const groups: Group[] = [];
                  let currentGroup: Group = [];
                  let groupEnd = -1;

                  for (const b of sorted) {
                    const bStart = timeToMinutes(b.oraInizio);
                    let bEnd = timeToMinutes(b.oraFine);
                    if (bEnd <= bStart) bEnd += 24 * 60;

                    if (currentGroup.length === 0) {
                      currentGroup.push(b);
                      groupEnd = bEnd;
                    } else if (bStart < groupEnd) {
                      currentGroup.push(b);
                      groupEnd = Math.max(groupEnd, bEnd);
                    } else {
                      groups.push(currentGroup);
                      currentGroup = [b];
                      groupEnd = bEnd;
                    }
                  }
                  if (currentGroup.length > 0) groups.push(currentGroup);

                  groups.forEach(group => {
                    const colEnds: number[] = [];
                    const assignments: { booking: Booking; col: number }[] = [];

                    group.forEach(bk => {
                      const bkStart = timeToMinutes(bk.oraInizio);
                      let bkEnd = timeToMinutes(bk.oraFine);
                      if (bkEnd <= bkStart) bkEnd += 24 * 60;

                      let placedCol = -1;
                      for (let c = 0; c < colEnds.length; c++) {
                        if (colEnds[c] <= bkStart) {
                          placedCol = c;
                          colEnds[c] = bkEnd;
                          break;
                        }
                      }
                      if (placedCol === -1) {
                        placedCol = colEnds.length;
                        colEnds.push(bkEnd);
                      }
                      assignments.push({ booking: bk, col: placedCol });
                    });

                    const totalCols = Math.max(1, colEnds.length);
                    assignments.forEach(({ booking, col }) => {
                      layouts.push({ booking, col, cols: totalCols });
                    });
                  });
                }

                return (
                  <div
                    key={ds}
                    data-day-column={ds}
                    className={`relative border-r border-slate-200 dark:border-yellow-500/20 last:border-r-0 ${isToday ? 'bg-blue-50/40 dark:bg-yellow-400/[0.03]' : 'bg-white dark:bg-[#0a0a0a]'}`}
                    style={{ height: `${(currentTotalHours + 1) * cellHeight}px` }}
                    onClick={(e) => handleDayClick(ds, e)}
                  >
                    {/* Hour lines */}
                    {Array.from({ length: currentTotalHours + 1 }, (_, i) => (
                      <div
                        key={i}
                        className="absolute left-0 right-0 border-t border-slate-200 dark:border-neutral-800/80"
                        style={{ top: `${i * cellHeight}px` }}
                      />
                    ))}
                    {/* Half-hour lines */}
                    {Array.from({ length: currentTotalHours }, (_, i) => (
                      <div
                        key={`h${i}`}
                        className="absolute left-0 right-0 border-t border-slate-200/60 dark:border-neutral-900/60 border-dashed"
                        style={{ top: `${i * cellHeight + cellHeight / 2}px` }}
                      />
                    ))}

                    {/* Ghost Drop Target Preview when dragging onto this day column */}
                    {dragState && dragState.isDragging && dragState.targetDate === ds && (
                      <div
                        className={`absolute rounded-xl border-2 z-[25] pointer-events-none transition-all duration-75 flex flex-col justify-between p-1.5 sm:p-2 shadow-2xl backdrop-blur-xs ${
                          dragState.hasConflict
                            ? 'border-red-500 bg-red-500/30 dark:bg-red-950/70 text-red-900 dark:text-red-200 ring-4 ring-red-500/40'
                            : 'border-blue-500 dark:border-yellow-400 bg-blue-500/25 dark:bg-yellow-400/25 text-slate-900 dark:text-yellow-100 ring-4 ring-blue-500/40 dark:ring-yellow-400/40'
                        } border-dashed animate-pulse`}
                        style={{
                          top: `${((dragState.targetStartMins - HOUR_START * 60) / 60) * cellHeight + 1}px`,
                          height: `${Math.max(30, ((dragState.targetEndMins - dragState.targetStartMins) / 60) * cellHeight - 2)}px`,
                          left: '2px',
                          right: '2px',
                        }}
                      >
                        {/* Top Start Time Badge */}
                        <div className="absolute -top-3.5 left-2 bg-blue-600 dark:bg-yellow-400 text-white dark:text-black font-mono font-black text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full shadow-lg border border-white/20 dark:border-black/20 flex items-center gap-1 z-30">
                          <Clock className="w-2.5 h-2.5" />
                          <span>Inizio: {dragState.targetOraInizio}</span>
                        </div>

                        {/* Bottom End Time Badge */}
                        <div className="absolute -bottom-3.5 right-2 bg-white dark:bg-neutral-900 text-blue-600 dark:text-yellow-400 font-mono font-black text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full shadow-lg border border-blue-500/80 dark:border-yellow-400/80 flex items-center gap-1 z-30">
                          <Clock className="w-2.5 h-2.5" />
                          <span>Fine: {dragState.targetOraFine}</span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] sm:text-xs font-black truncate drop-shadow-sm pt-0.5">
                          <span className="truncate">📍 {dragState.booking.clienteNome}</span>
                          <span className="font-mono bg-blue-600 dark:bg-yellow-400 text-white dark:text-black px-2 py-0.5 rounded text-[9px] sm:text-[10px] shrink-0 ml-1 font-black shadow-xs">
                            {dragState.targetOraInizio} ➔ {dragState.targetOraFine}
                          </span>
                        </div>
                        {dragState.hasConflict ? (
                          <div className="flex items-center gap-1 text-[8.5px] sm:text-[9.5px] font-bold text-red-700 dark:text-red-300 bg-white/95 dark:bg-black/95 px-1.5 py-0.5 rounded mt-auto truncate border border-red-300 dark:border-red-700">
                            <AlertTriangle className="w-3 h-3 text-red-500 shrink-0 animate-bounce" />
                            <span className="truncate">Sovrapposizione ({dragState.conflictNames.join(', ')})</span>
                          </div>
                        ) : (
                          <div className="text-[8px] sm:text-[9.5px] font-bold text-blue-900 dark:text-yellow-200 truncate mt-auto drop-shadow-xs flex items-center justify-between">
                            <span>Sposta in {dragState.booking.salaNome}</span>
                            <span className="font-mono text-[9px] opacity-90">
                              {((dragState.targetEndMins - dragState.targetStartMins) / 60)}h
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sfondi Turni Operatore (Background Blocks: 17:00-20:00 e 20:00-23:00 con adattamento dinamico) */}
                    {showShiftsInGrid && isWeekdayCol && s1Col && s2Col && (
                      <>
                        {/* Blocco Sfondo 1° Turno */}
                        <div
                          style={{
                            top: `${s1TopPx}px`,
                            height: `${s1HeightPx}px`,
                            left: 0,
                            right: 0,
                            borderLeftColor: s1Col.operatoreBadgeColor || (s1Col.operatoreId ? '#f59e0b' : '#ef4444'),
                          }}
                          className="absolute z-[1] pointer-events-none border-l-[3px] transition-all bg-gradient-to-b from-amber-500/[0.08] via-amber-500/[0.03] to-transparent overflow-hidden"
                        >
                          {/* Header compatto del turno nello sfondo (Visibilità ottimizzata per smartphone) */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedShiftForEdit(s1Col);
                              setIsShiftModalOpen(true);
                            }}
                            className="pointer-events-auto flex items-center justify-between px-1 sm:px-1.5 py-0.5 bg-white/95 dark:bg-neutral-950/95 border-b border-amber-400/50 dark:border-amber-500/40 hover:bg-slate-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer group/hdr1 select-none shadow-xs"
                            title={`1° Turno Presidio (${s1Col.oraInizio} - ${s1Col.oraFine}): ${s1Col.operatoreNome || 'Non assegnato'} (Clicca per gestire)`}
                          >
                            <div className="flex items-center gap-1 min-w-0 flex-1 truncate">
                              <span
                                className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full shrink-0 shadow-xs ring-1 ring-black/70"
                                style={{ backgroundColor: s1Col.operatoreBadgeColor || (s1Col.operatoreId ? '#f59e0b' : '#ef4444') }}
                              />
                              <span className="text-[9.5px] sm:text-[10.5px] font-black text-slate-800 dark:text-yellow-300 group-hover/hdr1:text-blue-600 dark:group-hover/hdr1:text-yellow-100 truncate tracking-tight dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                <span className="opacity-75 font-mono text-[8px] mr-0.5">T1:</span>
                                {s1Col.operatoreNome ? s1Col.operatoreNome.split(' ')[0] : '⚠️ Non Assegn.'}
                              </span>
                            </div>
                            <div className="hidden sm:flex items-center gap-1 shrink-0 ml-1">
                              <span className="text-[8px] sm:text-[8.5px] font-mono text-slate-600 dark:text-yellow-400/80">
                                {s1Col.oraInizio.slice(0, 5)}-{s1Col.oraFine.slice(0, 5)}
                              </span>
                              {s1Col.isAdapted && (
                                <span
                                  className="text-[6.5px] sm:text-[7px] font-bold px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-400/40"
                                  title={s1Col.adaptationReason}
                                >
                                  +{s1Col.minutiExtra}m
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Badge Operatore ben visibile al centro del turno (Stile front-end scuro/oro ad alto contrasto - Cliccabile) */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none p-1 z-[1]">
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedShiftForEdit(s1Col);
                                setIsShiftModalOpen(true);
                              }}
                              title="Clicca per gestire o assegnare il 1° Turno"
                              className="pointer-events-auto cursor-pointer hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center text-center px-1.5 py-1.5 rounded-lg bg-white/95 dark:bg-neutral-950/90 border border-amber-400/60 dark:border-amber-500/50 hover:border-amber-500 dark:hover:border-amber-400 backdrop-blur-xs shadow-md shadow-slate-200/60 dark:shadow-black/90 hover:shadow-lg max-w-[94%]"
                            >
                              <div className="flex items-center gap-1 justify-center mb-0.5">
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0 shadow-xs"
                                  style={{ backgroundColor: s1Col.operatoreBadgeColor || '#f59e0b' }}
                                />
                                <span className="text-[7.5px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400/90 font-mono">
                                  Turno 1
                                </span>
                              </div>
                              <span className="text-[10.5px] sm:text-xs font-black text-slate-900 dark:text-yellow-100 tracking-tight leading-tight truncate max-w-full dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                                {s1Col.operatoreNome ? s1Col.operatoreNome.split(' ')[0] : 'DA ASSEGNARE'}
                              </span>
                              {s1Col.operatoreNome && s1Col.operatoreNome.split(' ').length > 1 && (
                                <span className="text-[8.5px] font-bold text-slate-600 dark:text-yellow-200/70 leading-none truncate max-w-full hidden sm:block">
                                  {s1Col.operatoreNome.split(' ').slice(1).join(' ')}
                                </span>
                              )}
                              <span className="text-[8px] font-mono font-bold text-slate-700 dark:text-yellow-400/80 mt-1 leading-none bg-slate-100 dark:bg-black/70 px-1 py-0.5 rounded border border-slate-200 dark:border-yellow-500/25">
                                {s1Col.oraInizio.slice(0, 5)} - {s1Col.oraFine.slice(0, 5)}
                              </span>
                              {s1Col.isAdapted && (
                                <span className="text-[7px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/25 px-1 py-0.2 rounded mt-1 border border-amber-300 dark:border-amber-500/40">
                                  +{s1Col.minutiExtra}m extra
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Blocco Sfondo 2° Turno */}
                        <div
                          style={{
                            top: `${s2TopPx}px`,
                            height: `${s2HeightPx}px`,
                            left: 0,
                            right: 0,
                            borderLeftColor: s2Col.operatoreBadgeColor || (s2Col.operatoreId ? '#eab308' : '#ef4444'),
                          }}
                          className="absolute z-[1] pointer-events-none border-l-[3px] transition-all bg-gradient-to-b from-yellow-500/[0.08] via-yellow-500/[0.03] to-transparent overflow-hidden"
                        >
                          {/* Header compatto del turno nello sfondo (Visibilità ottimizzata per smartphone) */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedShiftForEdit(s2Col);
                              setIsShiftModalOpen(true);
                            }}
                            className="pointer-events-auto flex items-center justify-between px-1 sm:px-1.5 py-0.5 bg-white/95 dark:bg-neutral-950/95 border-b border-yellow-400/50 dark:border-yellow-500/40 hover:bg-slate-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer group/hdr2 select-none shadow-xs"
                            title={`2° Turno Presidio (${s2Col.oraInizio} - ${s2Col.oraFine}): ${s2Col.operatoreNome || 'Non assegnato'} (Clicca per gestire)`}
                          >
                            <div className="flex items-center gap-1 min-w-0 flex-1 truncate">
                              <span
                                className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full shrink-0 shadow-xs ring-1 ring-black/70"
                                style={{ backgroundColor: s2Col.operatoreBadgeColor || (s2Col.operatoreId ? '#eab308' : '#ef4444') }}
                              />
                              <span className="text-[9.5px] sm:text-[10.5px] font-black text-slate-800 dark:text-yellow-300 group-hover/hdr2:text-blue-600 dark:group-hover/hdr2:text-yellow-100 truncate tracking-tight dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                <span className="opacity-75 font-mono text-[8px] mr-0.5">T2:</span>
                                {s2Col.operatoreNome ? s2Col.operatoreNome.split(' ')[0] : '⚠️ Non Assegn.'}
                              </span>
                            </div>
                            <div className="hidden sm:flex items-center gap-1 shrink-0 ml-1">
                              <span className="text-[8px] sm:text-[8.5px] font-mono text-slate-600 dark:text-yellow-400/80">
                                {s2Col.oraInizio.slice(0, 5)}-{s2Col.oraFine.slice(0, 5)}
                              </span>
                              {s2Col.isAdapted && (
                                <span
                                  className="text-[6.5px] sm:text-[7px] font-bold px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-400/40"
                                  title={s2Col.adaptationReason}
                                >
                                  +{s2Col.minutiExtra}m
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Badge Operatore ben visibile al centro del turno (Stile front-end scuro/oro ad alto contrasto - Cliccabile) */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none p-1 z-[1]">
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedShiftForEdit(s2Col);
                                setIsShiftModalOpen(true);
                              }}
                              title="Clicca per gestire o assegnare il 2° Turno"
                              className="pointer-events-auto cursor-pointer hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center text-center px-1.5 py-1.5 rounded-lg bg-white/95 dark:bg-neutral-950/90 border border-yellow-400/60 dark:border-yellow-500/50 hover:border-yellow-500 dark:hover:border-yellow-400 backdrop-blur-xs shadow-md shadow-slate-200/60 dark:shadow-black/90 hover:shadow-lg max-w-[94%]"
                            >
                              <div className="flex items-center gap-1 justify-center mb-0.5">
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0 shadow-xs"
                                  style={{ backgroundColor: s2Col.operatoreBadgeColor || '#eab308' }}
                                />
                                <span className="text-[7.5px] font-black uppercase tracking-wider text-yellow-600 dark:text-yellow-400/90 font-mono">
                                  Turno 2
                                </span>
                              </div>
                              <span className="text-[10.5px] sm:text-xs font-black text-slate-900 dark:text-yellow-100 tracking-tight leading-tight truncate max-w-full dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                                {s2Col.operatoreNome ? s2Col.operatoreNome.split(' ')[0] : 'DA ASSEGNARE'}
                              </span>
                              {s2Col.operatoreNome && s2Col.operatoreNome.split(' ').length > 1 && (
                                <span className="text-[8.5px] font-bold text-slate-600 dark:text-yellow-200/70 leading-none truncate max-w-full hidden sm:block">
                                  {s2Col.operatoreNome.split(' ').slice(1).join(' ')}
                                </span>
                              )}
                              <span className="text-[8px] font-mono font-bold text-slate-700 dark:text-yellow-400/80 mt-1 leading-none bg-slate-100 dark:bg-black/70 px-1 py-0.5 rounded border border-slate-200 dark:border-yellow-500/25">
                                {s2Col.oraInizio.slice(0, 5)} - {s2Col.oraFine.slice(0, 5)}
                              </span>
                              {s2Col.isAdapted && (
                                <span className="text-[7px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/25 px-1 py-0.2 rounded mt-1 border border-amber-300 dark:border-amber-500/40">
                                  +{s2Col.minutiExtra}m extra
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Linea indicatore Cambio Turno (T1 -> T2) */}
                    {isWeekdayCol && s1Col && s2Col && (
                      <div
                        style={{ top: `${s2TopPx}px` }}
                        className="absolute left-0 right-0 border-t border-blue-400/50 dark:border-yellow-500/40 border-dashed z-[3] pointer-events-none flex items-center justify-center"
                      >
                        <span className="text-[7px] sm:text-[7.5px] font-mono font-bold text-slate-700 dark:text-yellow-300 bg-white dark:bg-neutral-950/95 px-1.5 py-0.2 rounded border border-slate-200 dark:border-yellow-500/30 shadow-xs whitespace-nowrap">
                          Cambio {s1Col.oraFine.slice(0, 5)}
                        </span>
                      </div>
                    )}

                    {/* Current time horizontal indicator for today */}
                    {isToday && (() => {
                      const now = new Date();
                      const currentMins = (now.getHours() - HOUR_START) * 60 + now.getMinutes();
                      if (currentMins >= 0 && currentMins <= currentTotalHours * 60) {
                        const lineTopPx = (currentMins / 60) * cellHeight;
                        return (
                          <div
                            className="absolute left-0 right-0 z-[4] pointer-events-none flex items-center"
                            style={{ top: `${lineTopPx}px` }}
                          >
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1 shadow-md ring-2 ring-black" />
                            <div className="h-[2px] w-full bg-red-500 shadow-sm" />
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Booking blocks rendered on top of background */}
                    {layouts.map(({ booking: b, col, cols }) => {
                      const room = rooms.find(r => r.id === b.salaId);
                      const colors = ROOM_COLORS[b.salaId] ?? COLOR_PALETTE[0];
                      const startMins = timeToMinutes(b.oraInizio) - HOUR_START * 60;
                      let endMins = timeToMinutes(b.oraFine) - HOUR_START * 60;
                      if (endMins <= startMins) endMins += 24 * 60;
                      const topPx = (startMins / 60) * cellHeight;
                      const heightPx = Math.max(22, ((endMins - startMins) / 60) * cellHeight);
                      const widthPct = 100 / cols;
                      const leftPct = col * widthPct;
                      const displayName = b.clienteNome || 'Prenotazione';
                      const startShort = b.oraInizio.endsWith(':00') ? b.oraInizio.slice(0, 2) : b.oraInizio;
                      const endShort = b.oraFine.endsWith(':00') ? b.oraFine.slice(0, 2) : b.oraFine;

                      // Detect narrow columns where vertical letter stacking is ideal (like in reference photo)
                      const isNarrow = isMobile
                        ? (viewMode === 'week' && cols >= 2) || (viewMode === '3days' && cols >= 3) || cols >= 4
                        : (viewMode === 'week' && cols >= 4) || cols >= 6;

                      // In narrow mode, prepare vertical letters
                      const charHeight = 11;
                      const maxChars = Math.max(2, Math.floor((heightPx - 6) / charHeight));
                      const trimmedName = displayName.trim();
                      let verticalLetters: string[] = [];
                      if (trimmedName.length <= maxChars) {
                        verticalLetters = trimmedName.split('');
                      } else {
                        const firstWord = trimmedName.split(/\s+/)[0];
                        if (firstWord.length <= maxChars) {
                          verticalLetters = firstWord.split('');
                        } else {
                          verticalLetters = trimmedName.slice(0, maxChars).split('');
                        }
                      }

                      const isBeingDragged = dragState?.isDragging && dragState.booking.id === b.id;

                      return (
                        <div
                          key={b.id}
                          data-booking-id={b.id}
                          onPointerDown={(e) => handleBookingPointerDown(b, e)}
                          onClick={e => {
                            e.stopPropagation();
                            if (dragJustEndedRef.current) return;
                            setActiveBookingDetail(b);
                          }}
                          className={`absolute rounded-md sm:rounded-lg cursor-grab active:cursor-grabbing overflow-hidden transition-all hover:brightness-110 hover:z-30 hover:shadow-xl select-none group border border-black/30 shadow-md ${
                            isBeingDragged ? 'opacity-30 scale-95 ring-2 ring-blue-500 dark:ring-yellow-400 z-30' : ''
                          }`}
                          style={{
                            top: `${topPx + 1}px`,
                            height: `${heightPx - 2}px`,
                            left: `${leftPct + 0.5}%`,
                            width: `${widthPct - 1}%`,
                            backgroundColor: colors.bg,
                            zIndex: isBeingDragged ? 40 : 10,
                            touchAction: 'none',
                          }}
                          title={`${b.clienteNome} • ${b.oraInizio}-${b.oraFine} • ${b.salaNome} (Tieni premuto 1.5s per spostare nel calendario)`}
                        >
                          {/* Indicatore visivo di sblocco spostamento: barra di caricamento 1.5 secondi */}
                          {holdingBookingId === b.id && (
                            <div className="absolute inset-0 bg-black/40 border-2 border-yellow-400 rounded-md sm:rounded-lg pointer-events-none z-30 flex flex-col justify-end overflow-hidden shadow-lg animate-pulse">
                              <div className="w-full h-1.5 bg-black/60 overflow-hidden">
                                <div className="h-full bg-yellow-400 animate-hold-progress" />
                              </div>
                            </div>
                          )}
                          {isNarrow ? (
                            <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden py-1 px-0.5 select-none relative">
                              {/* Stacking characters vertically (Creed, Verti, Rap, etc.) */}
                              <div className="flex flex-col items-center justify-center leading-[10.5px] tracking-tight">
                                {verticalLetters.map((char, cIdx) => (
                                  <span
                                    key={cIdx}
                                    className="text-[9px] sm:text-[10px] font-black text-white shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                                  >
                                    {char === ' ' ? '·' : char}
                                  </span>
                                ))}
                              </div>

                              {/* Micro lesson badge */}
                              {b.tipo === 'lezione' && (
                                <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[6.5px] font-black bg-black/70 text-yellow-300 px-0.5 rounded leading-none">
                                  L
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-center px-1 py-0.5 overflow-hidden select-none relative">
                              {/* Client / Band Name - bold and multi-line wrapped */}
                              <span
                                className={`font-black text-white leading-tight break-words hyphens-auto drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] ${
                                  viewMode === 'week'
                                    ? 'text-[10px] sm:text-[11px]'
                                    : cellHeight < 42
                                    ? 'text-[11px]'
                                    : 'text-xs sm:text-sm'
                                }`}
                                style={{
                                  wordBreak: 'break-word',
                                  overflowWrap: 'break-word',
                                  display: '-webkit-box',
                                  WebkitLineClamp: heightPx < 32 ? 1 : heightPx < 55 ? 2 : 3,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {displayName}
                              </span>

                              {/* Time range */}
                              {(viewMode !== 'week' || heightPx >= 50) && (
                                <span className="text-[8px] sm:text-[9px] font-bold text-white/90 font-mono tracking-tight mt-0.5 leading-none shrink-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">
                                  {viewMode === 'week' ? `${startShort}-${endShort}` : `${b.oraInizio} - ${b.oraFine}`}
                                </span>
                              )}

                              {/* Room name */}
                              {room && (viewMode === 'day' || (viewMode === '3days' && heightPx >= 65) || heightPx >= 85) && (
                                <span className="text-[8px] sm:text-[9px] font-semibold text-white/80 truncate mt-0.5 leading-none shrink-0">
                                  {room.nome}
                                </span>
                              )}

                              {/* Lesson badge */}
                              {b.tipo === 'lezione' && (
                                <span className="absolute top-0.5 right-0.5 text-[7px] font-black px-1 py-0.2 rounded bg-black/50 text-yellow-300 tracking-wider uppercase leading-none">
                                  {viewMode === 'week' ? 'L' : 'Lezione'}
                                </span>
                              )}
                              </div>
                          )}
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
        <div className="border-t border-slate-200 dark:border-yellow-500/20 px-3 sm:px-4 py-2 flex items-center gap-3 flex-wrap bg-slate-50 dark:bg-neutral-950 text-xs">
          {rooms.map(r => {
            const c = ROOM_COLORS[r.id];
            return (
              <div key={r.id} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-xs shrink-0" style={{ backgroundColor: c?.bg }} />
                <span className="text-[10px] text-slate-700 dark:text-yellow-200/90 font-medium">{r.nome}</span>
              </div>
            );
          })}
          {/* Indicatore Turni nella legenda */}
          <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-yellow-500/25 pl-2.5">
            <div className="w-3.5 h-3.5 rounded-xs bg-blue-50 dark:bg-linear-to-b dark:from-neutral-900 dark:via-amber-950/40 dark:to-neutral-950 border border-blue-200 dark:border-amber-500/60 flex items-center justify-center">
              <Shield className="w-2 h-2 text-blue-600 dark:text-yellow-400" />
            </div>
            <span className="text-[10px] text-slate-700 dark:text-yellow-300 font-medium">Turno Presidio (17-20 / 20-23)</span>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <div className="w-2 h-2 rounded-full bg-amber-400 border border-amber-500 shrink-0" />
            <span className="text-[10px] text-slate-500 dark:text-neutral-400">Senza operatore</span>
          </div>
        </div>
      </div>

      {/* Floating + button (mobile) */}
      <button
        onClick={() => { setSelectedDateForBooking(formatDateToISO(today)); setBookingToEdit(null); setIsBookingModalOpen(true); }}
        className="fixed bottom-4 right-4 w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white dark:bg-yellow-400 dark:hover:bg-yellow-300 dark:text-black font-bold rounded-full shadow-2xl shadow-blue-500/30 dark:shadow-yellow-500/30 flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-30 sm:hidden border border-black/20"
        title="Nuova Prenotazione"
      >
        <Plus className="w-5 h-5 stroke-[3]" />
      </button>

      {/* Booking Quick Detail Dialog */}
      {activeBookingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0e0e0e] rounded-xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-yellow-500/30 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                  activeBookingDetail.tipo === 'prove'
                    ? 'bg-blue-50 dark:bg-yellow-400/20 text-blue-600 dark:text-yellow-400 border border-blue-200 dark:border-yellow-500/40'
                    : 'bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 border border-slate-200 dark:border-neutral-700'
                }`}>
                  {activeBookingDetail.tipo === 'prove' ? <Music2 className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-yellow-100 text-base leading-tight">{activeBookingDetail.clienteNome}</h3>
                  <p className="text-xs text-slate-500 dark:text-neutral-400 font-normal capitalize">
                    {activeBookingDetail.tipo === 'prove' ? 'Sessione Prove Band' : 'Lezione di Musica'} &bull; {activeBookingDetail.salaNome}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveBookingDetail(null)}
                className="modal-header-btn-blue modal-close-btn-blue shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 hover:bg-red-600 active:scale-95 text-white transition-all cursor-pointer border border-blue-500 hover:border-red-500 shadow-md shadow-blue-500/25"
                style={{ backgroundColor: '#2563eb', color: '#ffffff', borderColor: '#1d4ed8' }}
                title="Chiudi"
                aria-label="Chiudi finestra"
              >
                <X className="w-5 h-5 text-white stroke-[2.5]" style={{ color: '#ffffff', stroke: '#ffffff' }} />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-neutral-950 rounded-lg p-3.5 space-y-2 text-xs border border-slate-200 dark:border-yellow-500/20">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-neutral-400">Data &amp; Orario:</span>
                <span className="font-semibold text-slate-900 dark:text-yellow-300">{activeBookingDetail.data} ({activeBookingDetail.oraInizio} - {activeBookingDetail.oraFine})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-neutral-400">Durata:</span>
                <span className="font-semibold text-slate-900 dark:text-yellow-300">{activeBookingDetail.durataOre} ore</span>
              </div>
              {activeBookingDetail.tipo === 'lezione' ? (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-neutral-400">Docente / Insegnante:</span>
                  <span className="font-semibold text-slate-900 dark:text-yellow-300 flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5 text-blue-600 dark:text-yellow-400" />
                    {activeBookingDetail.insegnanteNome || 'Insegnante non specificato'}
                  </span>
                </div>
              ) : activeBookingDetail.operatoreAssegnatoNome ? (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-neutral-400">Operatore Sala:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />{activeBookingDetail.operatoreAssegnatoNome}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-neutral-400">Presidio Sala:</span>
                  <span className="font-medium text-slate-600 dark:text-neutral-300 text-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Coperto da Turni Sala (17:00-23:00)
                  </span>
                </div>
              )}
              {activeBookingDetail.tipo !== 'lezione' ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-neutral-400">Tariffa:</span>
                    <div className="flex items-center gap-2">
                      {activeBookingDetail.sconto && activeBookingDetail.sconto > 0 ? (
                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-500/20">
                          Sconto -€{activeBookingDetail.sconto}
                        </span>
                      ) : null}
                      <span className="font-bold text-blue-600 dark:text-yellow-400 text-sm">&#x20AC;{activeBookingDetail.tariffaTotale}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-neutral-400">Stato Pagamento:</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                      activeBookingDetail.statoPagamento === 'pagato'
                        ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                        : 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30'
                    }`}>
                      {activeBookingDetail.statoPagamento === 'pagato' ? 'Pagato' : 'Da Saldare'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-neutral-400">Quota Sala Docente:</span>
                  <span className="font-bold text-purple-700 dark:text-purple-400 text-xs bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                    5€ / ora (Conti Mensili)
                  </span>
                </div>
              )}
            </div>

            {(() => {
              const activeClient = clients.find(c => c.id === activeBookingDetail.clienteId);
              const activeResolved = getAllEquipmentForBooking(activeBookingDetail, activeClient);
              return (
                <div className="bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-yellow-500/20 rounded-xl p-3.5 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-yellow-400 uppercase tracking-wider">
                      <SlidersHorizontal className="w-4 h-4 text-blue-600 dark:text-yellow-400" />
                      <span>Strumentazione Richiesta</span>
                    </div>
                    {activeResolved.items.length > 0 && (
                      <span className="text-[10px] font-bold bg-blue-50 dark:bg-yellow-400/20 text-blue-700 dark:text-yellow-300 border border-blue-200 dark:border-yellow-500/30 px-2 py-0.5 rounded-full">
                        {activeResolved.items.length} {activeResolved.items.length === 1 ? 'voce' : 'voci'}
                      </span>
                    )}
                  </div>
                  {activeResolved.items.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {activeResolved.items.map((item, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-white dark:bg-[#121212] border border-slate-200 dark:border-yellow-500/30 text-slate-800 dark:text-yellow-200 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-yellow-400 shrink-0" />{item}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 dark:text-neutral-400 italic">Nessuna strumentazione speciale (setup standard).</p>
                  )}
                </div>
              );
            })()}

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-yellow-500/20 flex-wrap">
              {!isAdmin && activeBookingDetail.data < todayStr ? (
                <div
                  className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-400 dark:text-neutral-500 text-xs font-semibold flex items-center gap-1.5 cursor-not-allowed select-none"
                  title="Nel profilo utente non è consentito cancellare eventi passati (solo giorno stesso o futuri)"
                >
                  <Trash2 className="w-3.5 h-3.5 opacity-50" />
                  <span>Eliminazione disabilitata (evento passato)</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleDeleteBooking(activeBookingDetail)}
                  className="px-3.5 py-2 rounded-lg bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Elimina questa prenotazione"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Elimina Prenotazione</span>
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setActiveBookingDetail(null)}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-yellow-500/30 text-slate-700 dark:text-neutral-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Chiudi
                </button>
                <button
                  type="button"
                  onClick={e => handleOpenEditBooking(activeBookingDetail, e)}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-yellow-400 dark:hover:bg-yellow-300 text-white dark:text-black font-bold text-xs shadow-sm transition-all cursor-pointer"
                >
                  Modifica / Assegna Operatore
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals - Rendered conditionally and loaded on-demand for maximum speed */}
      {isBookingModalOpen && (
        <Suspense fallback={null}>
          <BookingModal
            isOpen={isBookingModalOpen}
            onClose={() => setIsBookingModalOpen(false)}
            initialDate={selectedDateForBooking}
            initialStartTime={selectedStartTimeForBooking}
            bookingToEdit={bookingToEdit}
          />
        </Suspense>
      )}

      {isAutoAssignModalOpen && (
        <Suspense fallback={null}>
          <AutoAssignModal isOpen={isAutoAssignModalOpen} onClose={() => setIsAutoAssignModalOpen(false)} result={autoAssignResult} />
        </Suspense>
      )}

      {isEquipmentModalOpen && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {isOperatorScheduleModalOpen && (
        <Suspense fallback={null}>
          <OperatorSchedulePrintModal isOpen={isOperatorScheduleModalOpen} onClose={() => setIsOperatorScheduleModalOpen(false)} />
        </Suspense>
      )}

      {/* Quick Shift View & Edit Modal */}
      {isShiftModalOpen && (
        <Suspense fallback={null}>
          <ShiftQuickModal
            isOpen={isShiftModalOpen}
            onClose={() => {
              setIsShiftModalOpen(false);
              setSelectedShiftForEdit(null);
            }}
            shiftComputed={selectedShiftForEdit}
          />
        </Suspense>
      )}

      {/* Modal Riepilogo Mattutino (Ore 10:00) */}
      {isDailyBriefingOpen && (
        <Suspense fallback={null}>
          <MorningBriefingModal
            isOpen={isDailyBriefingOpen}
            onClose={() => setIsDailyBriefingOpen(false)}
            initialDate={formatDateToISO(currentDate)}
          />
        </Suspense>
      )}

      {/* Full Shifts Panel Modal */}
      {isShiftsPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 dark:bg-black/85 backdrop-blur-md">
          <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl max-w-6xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-yellow-500/40 max-h-[94vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-yellow-500/20">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 dark:bg-yellow-400 text-white dark:text-black flex items-center justify-center font-black">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-yellow-100 text-lg">Pannello Gestione Turni Presidio Sala</h3>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">Pianificazione Lunedì-Venerdì (17:00-20:00 & 20:00-23:00 con adattamento dinamico)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsShiftsPanelOpen(false)}
                className="modal-header-btn-blue modal-close-btn-blue shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 hover:bg-red-600 active:scale-95 text-white transition-all cursor-pointer border border-blue-500 hover:border-red-500 shadow-md shadow-blue-500/25"
                style={{ backgroundColor: '#2563eb', color: '#ffffff', borderColor: '#1d4ed8' }}
                title="Chiudi"
                aria-label="Chiudi finestra"
              >
                <X className="w-5 h-5 text-white stroke-[2.5]" style={{ color: '#ffffff', stroke: '#ffffff' }} />
              </button>
            </div>
            <Suspense fallback={<div className="p-8 text-center text-sm text-yellow-400">Caricamento turni in corso...</div>}>
              <ShiftsView />
            </Suspense>
          </div>
        </div>
      )}

      {/* Quick Date / Month & Year Jumper Modal */}
      {isQuickDatePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0f0f0f] rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-yellow-500/40 space-y-4 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-yellow-500/20">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 dark:bg-yellow-400 text-white dark:text-black flex items-center justify-center font-black shadow-md shadow-blue-500/20 dark:shadow-yellow-500/30">
                  <CalendarDays className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-yellow-100 text-base sm:text-lg">Salto Rapido Calendario</h3>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400">Scorri all'istante settimane, mesi o scegli una data esatta</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickDatePickerOpen(false)}
                className="modal-header-btn-blue modal-close-btn-blue shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 hover:bg-red-600 active:scale-95 text-white transition-all cursor-pointer border border-blue-500 hover:border-red-500 shadow-md shadow-blue-500/25"
                style={{ backgroundColor: '#2563eb', color: '#ffffff', borderColor: '#1d4ed8' }}
                title="Chiudi"
                aria-label="Chiudi finestra"
              >
                <X className="w-5 h-5 text-white stroke-[2.5]" style={{ color: '#ffffff', stroke: '#ffffff' }} />
              </button>
            </div>

            {/* Year Selector Bar */}
            <div className="flex items-center justify-between bg-slate-50 dark:bg-neutral-950 p-1.5 rounded-xl border border-slate-200 dark:border-yellow-500/30">
              <button
                type="button"
                onClick={() => setQuickPickerYear(y => y - 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-slate-700 dark:text-yellow-400 hover:text-blue-600 dark:hover:text-yellow-300 hover:bg-slate-100 dark:hover:bg-neutral-800 text-xs font-bold transition-all cursor-pointer"
                title="Anno precedente"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>{quickPickerYear - 1}</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black text-slate-900 dark:text-yellow-300 tracking-tight">
                  {quickPickerYear}
                </span>
                {quickPickerYear === today.getFullYear() && (
                  <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-yellow-400/20 text-blue-700 dark:text-yellow-300 border border-blue-200 dark:border-yellow-500/40">
                    Anno Corrente
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setQuickPickerYear(y => y + 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-slate-700 dark:text-yellow-400 hover:text-blue-600 dark:hover:text-yellow-300 hover:bg-slate-100 dark:hover:bg-neutral-800 text-xs font-bold transition-all cursor-pointer"
                title="Anno successivo"
              >
                <span>{quickPickerYear + 1}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Months Grid (12 Months in 4x3) */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-slate-500 dark:text-yellow-500/80 uppercase tracking-wider">
                Seleziona Mese:
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {MESI_ITALIANI.map((mName, mIdx) => {
                  const isSelected = dominantMonth.getMonth() === mIdx && dominantMonth.getFullYear() === quickPickerYear;
                  const isCurrentMonthNow = today.getMonth() === mIdx && today.getFullYear() === quickPickerYear;
                  return (
                    <button
                      key={mName}
                      type="button"
                      onClick={() => {
                        handleJumpToMonth(mIdx, quickPickerYear);
                        setIsQuickDatePickerOpen(false);
                      }}
                      className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer text-center ${
                        isSelected
                          ? 'bg-blue-600 dark:bg-yellow-400 text-white dark:text-black font-black border-blue-500 dark:border-yellow-300 ring-2 ring-blue-300 dark:ring-yellow-400/50 shadow-md shadow-blue-500/20 dark:shadow-yellow-500/20 scale-[1.03]'
                          : isCurrentMonthNow
                            ? 'bg-blue-50 dark:bg-yellow-400/15 text-blue-700 dark:text-yellow-300 border-blue-200 dark:border-yellow-500/60 hover:bg-blue-100 dark:hover:bg-yellow-400/25 font-bold'
                            : 'bg-slate-50 dark:bg-neutral-900 text-slate-700 dark:text-neutral-300 border-slate-200 dark:border-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-blue-600 dark:hover:text-yellow-300 hover:border-blue-300 dark:hover:border-yellow-500/30'
                      }`}
                    >
                      <span className="text-xs font-black uppercase tracking-wider">{mName.substring(0, 3)}</span>
                      <span className="text-[10px] font-medium opacity-85 truncate max-w-full">{mName}</span>
                      {isCurrentMonthNow && !isSelected && (
                        <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.2 rounded-full font-extrabold bg-blue-600 dark:bg-yellow-400 text-white dark:text-black mt-0.5">
                          Oggi
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Week Selector of Active Month */}
            <div className="pt-2 border-t border-slate-200 dark:border-yellow-500/20 space-y-1.5">
              <p className="text-[11px] font-bold text-slate-500 dark:text-yellow-500/80 uppercase tracking-wider">
                Salta a una settimana specifica di {MESI_ITALIANI[dominantMonth.getMonth()]}:
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((wk) => {
                  const dayNum = Math.min((wk - 1) * 7 + 1, new Date(quickPickerYear, dominantMonth.getMonth() + 1, 0).getDate());
                  const targetDate = new Date(quickPickerYear, dominantMonth.getMonth(), dayNum);
                  const isCurrentActiveWeek = Math.abs(currentDate.getTime() - targetDate.getTime()) < 4 * 86400000;
                  return (
                    <button
                      key={wk}
                      type="button"
                      onClick={() => {
                        setCurrentDate(targetDate);
                        setIsQuickDatePickerOpen(false);
                      }}
                      className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition-all text-center cursor-pointer ${
                        isCurrentActiveWeek
                          ? 'bg-blue-600 dark:bg-yellow-400 text-white dark:text-black border-blue-600 dark:border-yellow-400 font-black'
                          : 'bg-slate-50 dark:bg-neutral-900 hover:bg-blue-50 dark:hover:bg-yellow-400/20 text-slate-700 dark:text-yellow-200 border-slate-200 dark:border-neutral-800 hover:border-blue-300 dark:hover:border-yellow-500/30'
                      }`}
                    >
                      Sett. {wk}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Exact Date Picker & Quick Today Button */}
            <div className="pt-3 border-t border-slate-200 dark:border-yellow-500/20 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-neutral-400">Data esatta:</span>
                <input
                  type="date"
                  value={formatDateToISO(currentDate)}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleJumpToDate(e.target.value);
                      setIsQuickDatePickerOpen(false);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-yellow-500/40 text-slate-900 dark:text-yellow-300 text-xs font-bold focus:ring-2 focus:ring-blue-500 dark:focus:ring-yellow-400 cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  handleGoToday();
                  setIsQuickDatePickerOpen(false);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-yellow-400 dark:hover:bg-yellow-300 text-white dark:text-black font-extrabold text-xs transition-all shadow-md shadow-blue-500/20 dark:shadow-yellow-500/20 cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Torna a Oggi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Drag Indicator Live HUD */}
      {dragState && dragState.isDragging && (
        <div
          className="fixed pointer-events-none z-[9999] -translate-x-1/2 -translate-y-[calc(100%+18px)] transition-all duration-75 select-none"
          style={{
            left: `${dragState.currentPointerX}px`,
            top: `${dragState.currentPointerY}px`,
          }}
        >
          <div className="flex flex-col items-center">
            {/* Main HUD card */}
            <div
              className={`px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-xl border-2 flex flex-col gap-2 min-w-[260px] max-w-[340px] text-center transition-all ${
                dragState.hasConflict
                  ? 'bg-red-950/95 border-red-500 text-red-100 ring-4 ring-red-500/40 shadow-red-950/80'
                  : 'bg-white dark:bg-[#121212] border-blue-500 dark:border-yellow-400 text-slate-900 dark:text-white ring-4 ring-blue-500/20 dark:ring-yellow-400/25 shadow-2xl'
              }`}
            >
              {/* Header: Sala and Cliente */}
              <div className="flex items-center justify-between text-xs font-bold border-b border-slate-200 dark:border-white/10 pb-1.5 gap-2">
                <span className="truncate max-w-[150px] text-slate-900 dark:text-yellow-300 font-extrabold flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5 text-blue-600 dark:text-yellow-400 shrink-0 animate-bounce" />
                  <span className="truncate">{dragState.booking.clienteNome}</span>
                </span>
                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-100 dark:bg-yellow-400/20 text-blue-800 dark:text-yellow-300 border border-blue-300 dark:border-yellow-400/40">
                  {dragState.booking.salaNome}
                </span>
              </div>

              {/* Big, eye-catching Live Target Time Display with Theme Colors (Blue in Light, Yellow in Dark) */}
              <div className="flex items-center justify-center gap-2.5 py-1.5 px-3 rounded-xl bg-blue-50/90 dark:bg-neutral-900/90 border-2 border-blue-400/80 dark:border-yellow-400/60 shadow-md">
                <Clock className="w-5 h-5 text-blue-600 dark:text-yellow-400 shrink-0" />
                <span className="font-mono text-2xl sm:text-3xl font-black tracking-tight text-blue-600 dark:text-yellow-400 drop-shadow-xs">
                  {dragState.targetOraInizio} <span className="text-blue-500 dark:text-yellow-500 font-black">➔</span> {dragState.targetOraFine}
                </span>
                <span className="text-[11px] font-mono font-black px-2 py-0.5 rounded-lg bg-blue-600 dark:bg-yellow-400 text-white dark:text-black shadow-xs shrink-0">
                  {((dragState.targetEndMins - dragState.targetStartMins) / 60) % 1 === 0
                    ? `${(dragState.targetEndMins - dragState.targetStartMins) / 60}h`
                    : `${((dragState.targetEndMins - dragState.targetStartMins) / 60).toFixed(1)}h`}
                </span>
              </div>

              {/* Target Date */}
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 dark:text-neutral-200">
                <CalendarDays className="w-4 h-4 text-blue-600 dark:text-yellow-400 shrink-0" />
                <span className="capitalize">{formatDateItalian(dragState.targetDate, true)}</span>
              </div>

              {/* Status / Conflict Warning */}
              {dragState.hasConflict ? (
                <div className="flex items-center justify-center gap-1 text-[10.5px] font-black text-red-700 dark:text-red-200 bg-red-100 dark:bg-red-600/40 border border-red-300 dark:border-red-500/60 px-2 py-1 rounded-lg animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                  <span className="truncate">Sovrapposizione ({dragState.conflictNames.join(', ')})</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1 text-[10px] font-extrabold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/15 px-2 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-500/30">
                  <span>✓ Rilascia per confermare orario</span>
                </div>
              )}
            </div>

            {/* Pointer arrow marker pointing to current cursor position */}
            <div
              className={`w-3.5 h-3.5 -mt-2 rotate-45 border-r border-b ${
                dragState.hasConflict
                  ? 'bg-red-950 border-red-500'
                  : 'bg-white dark:bg-[#121212] border-blue-500 dark:border-yellow-400'
              }`}
            />
          </div>
        </div>
      )}

      {/* Floating Toast Notification for Moved Booking with Undo */}
      {moveToast && moveToast.visible && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-slate-900/95 dark:bg-neutral-900/95 backdrop-blur-md text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 dark:border-yellow-500/40 animate-in fade-in slide-in-from-bottom duration-200 max-w-[94vw]">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="text-xs sm:text-sm">
            <span className="font-bold">{moveToast.bookingTitle}</span> spostata a{' '}
            <span className="font-semibold text-blue-300 dark:text-yellow-300">
              {formatDateItalian(moveToast.targetDate, false)} ore {moveToast.targetOraInizio} - {moveToast.targetOraFine}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              updateBooking(moveToast.previousBooking);
              setMoveToast(null);
            }}
            className="ml-2 px-2.5 py-1 text-xs font-bold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-white/20 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Annulla
          </button>
          <button
            type="button"
            onClick={() => setMoveToast(null)}
            className="text-white/60 hover:text-white p-1 ml-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating HUD Indicator for Touch Swipe Week Navigation on Smartphone */}
      {weekSwipeToast && (
        <div
          className={`week-swipe-hud fixed top-20 left-1/2 -translate-x-1/2 z-[9990] flex items-center gap-2.5 px-5 py-2.5 rounded-full shadow-2xl animate-in fade-in zoom-in-95 duration-150 pointer-events-none select-none border font-bold ${
            isDark
              ? 'border-yellow-400 shadow-yellow-500/25'
              : 'border-blue-400 shadow-blue-500/30'
          }`}
          style={{
            backgroundColor: isDark ? '#facc15' : '#2563eb',
            color: isDark ? '#000000' : '#ffffff',
            borderColor: isDark ? '#eab308' : '#1d4ed8',
          }}
        >
          {weekSwipeToast.direction === 'prev' ? (
            <ChevronLeft
              className="w-4 h-4 animate-pulse stroke-[3] shrink-0"
              style={{ color: isDark ? '#000000' : '#ffffff', stroke: isDark ? '#000000' : '#ffffff' }}
            />
          ) : (
            <ChevronRight
              className="w-4 h-4 animate-pulse stroke-[3] shrink-0"
              style={{ color: isDark ? '#000000' : '#ffffff', stroke: isDark ? '#000000' : '#ffffff' }}
            />
          )}
          <span
            className="text-xs sm:text-sm font-black tracking-tight"
            style={{ color: isDark ? '#000000' : '#ffffff' }}
          >
            {weekSwipeToast.label}
          </span>
        </div>
      )}

      {/* Modale Eliminazione Serie Ricorrente */}
      <DeleteRecurringBookingModal
        isOpen={Boolean(recurringDeleteModalBooking)}
        booking={recurringDeleteModalBooking}
        roomName={rooms.find(r => r.id === recurringDeleteModalBooking?.salaId)?.nome}
        onClose={() => setRecurringDeleteModalBooking(null)}
        onConfirm={handleConfirmRecurringDelete}
      />
    </div>
  );
};
