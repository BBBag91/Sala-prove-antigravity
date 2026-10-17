import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  PieChart,
  Calendar,
  Users,
  Music2,
  GraduationCap,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Printer,
  Sparkles,
  Trophy,
  Activity,
  Layers,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Booking, StaffMember } from '../types';
import {
  MESI_ITALIANI,
  formatCurrency,
  calculateDurationHours,
  formatDateToISO,
} from '../utils/dateUtils';

type TimeHorizon = 'monthly' | 'yearly';
type PaymentFilter = 'paid_only' | 'all';

interface GroupStat {
  clientName: string;
  sessionsCount: number;
  totalHours: number;
  totalIncome: number;
  averageIncomePerSession: number;
  percentageOfTotal: number;
  frequencyTier: 'weekly' | 'biweekly' | 'occasional'; // 4+, 2-3, 1
}

interface TeacherStat {
  teacher: StaffMember;
  teacherId: string;
  teacherName: string;
  lessonsCount: number;
  totalHours: number;
  roomFeeTotal: number; // 5€/h per la sala
  percentageOfLessons: number;
}

interface MonthTrendItem {
  monthIndex: number;
  monthNameShort: string;
  monthNameFull: string;
  monthKey: string; // YYYY-MM
  groupIncome: number;
  teacherIncome: number;
  totalIncome: number;
  groupSessionsCount: number;
  teacherLessonsCount: number;
  totalHours: number;
  activeGroupsCount: number;
}

export const AnalyticsView: React.FC = () => {
  const { bookings, staff, rooms, studioInfo } = useApp();

  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(today.getMonth()); // 0-11
  const [horizon, setHorizon] = useState<TimeHorizon>('monthly');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('paid_only');
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // Mese YYYY-MM
  const monthKey = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}`;
  const monthName = MESI_ITALIANI[currentMonthIndex];

  // Navigazione Mese
  const handlePrevMonth = () => {
    if (currentMonthIndex === 0) {
      setCurrentMonthIndex(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonthIndex((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonthIndex === 11) {
      setCurrentMonthIndex(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonthIndex((m) => m + 1);
    }
  };

  const handleCurrentPeriod = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonthIndex(now.getMonth());
  };

  // Navigazione Anno
  const handlePrevYear = () => setCurrentYear((y) => y - 1);
  const handleNextYear = () => setCurrentYear((y) => y + 1);

  // Solo insegnanti esclusivi (esclusi gli operatori-insegnanti 'entrambi' e gli operatori)
  const teachers = useMemo(() => {
    return staff.filter((s) => s.attivo && s.ruolo === 'insegnante');
  }, [staff]);

  const exclusiveTeacherIds = useMemo(() => new Set(teachers.map((t) => t.id)), [teachers]);
  const exclusiveTeacherNames = useMemo(
    () => new Set(teachers.map((t) => `${t.nome} ${t.cognome}`.trim().toLowerCase())),
    [teachers]
  );

  const isExclusiveTeacherBooking = (b: Booking): boolean => {
    if (b.insegnanteId && exclusiveTeacherIds.has(b.insegnanteId)) return true;
    if (b.insegnanteNome && exclusiveTeacherNames.has(b.insegnanteNome.trim().toLowerCase())) return true;
    return false;
  };

  // Filtro prenotazioni per stato pagamento
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (!b.data) return false;
      if (paymentFilter === 'paid_only') {
        return b.statoPagamento === 'pagato';
      }
      return true;
    });
  }, [bookings, paymentFilter]);

  // =========================================================================
  // 1. STATISTICHE MENSILI DEI GRUPPI (BAND)
  // =========================================================================
  const monthlyGroupStats = useMemo(() => {
    const monthBookings = filteredBookings.filter(
      (b) => b.data.startsWith(monthKey) && b.tipo !== 'lezione'
    );

    const groupMap = new Map<string, { count: number; hours: number; income: number }>();

    for (const b of monthBookings) {
      const name = (b.clienteNome || 'Band Anonima').trim();
      const dur = b.durataOre || calculateDurationHours(b.oraInizio, b.oraFine) || 0;
      const inc = b.tariffaTotale || 0;

      const current = groupMap.get(name) || { count: 0, hours: 0, income: 0 };
      groupMap.set(name, {
        count: current.count + 1,
        hours: current.hours + dur,
        income: current.income + inc,
      });
    }

    const totalMonthIncome = Array.from(groupMap.values()).reduce((sum, g) => sum + g.income, 0);

    const list: GroupStat[] = Array.from(groupMap.entries()).map(([name, val]) => {
      let tier: 'weekly' | 'biweekly' | 'occasional' = 'occasional';
      if (val.count >= 4) tier = 'weekly';
      else if (val.count >= 2) tier = 'biweekly';

      return {
        clientName: name,
        sessionsCount: val.count,
        totalHours: val.hours,
        totalIncome: val.income,
        averageIncomePerSession: val.count > 0 ? val.income / val.count : 0,
        percentageOfTotal: totalMonthIncome > 0 ? (val.income / totalMonthIncome) * 100 : 0,
        frequencyTier: tier,
      };
    });

    // Ordina per incasso decrescente
    list.sort((a, b) => b.totalIncome - a.totalIncome);
    return {
      list,
      totalIncome: totalMonthIncome,
      totalSessions: monthBookings.length,
      totalHours: list.reduce((sum, g) => sum + g.totalHours, 0),
      activeGroupsCount: list.length,
    };
  }, [filteredBookings, monthKey]);

  // =========================================================================
  // 2. STATISTICHE MENSILI DEI DOCENTI (ENTRATE E ORE LEZIONI)
  // =========================================================================
  const monthlyTeacherStats = useMemo(() => {
    const monthLessons = filteredBookings.filter(
      (b) => b.data.startsWith(monthKey) && b.tipo === 'lezione' && isExclusiveTeacherBooking(b)
    );

    const totalLessonsCount = monthLessons.length;
    let totalRoomFees = 0;

    const list: TeacherStat[] = teachers.map((t) => {
      const tFullName = `${t.nome} ${t.cognome}`.trim().toLowerCase();
      const tLessons = monthLessons.filter(
        (b) =>
          (b.insegnanteId && b.insegnanteId === t.id) ||
          (b.insegnanteNome && b.insegnanteNome.trim().toLowerCase() === tFullName)
      );

      const hours = tLessons.reduce((sum, b) => {
        const h = b.durataOre || calculateDurationHours(b.oraInizio, b.oraFine) || 0;
        return sum + (isNaN(h) ? 0 : h);
      }, 0);

      // Quota sala 5€/h per le lezioni
      const fee = Math.round(hours * 5 * 100) / 100;
      totalRoomFees += fee;

      return {
        teacher: t,
        teacherId: t.id,
        teacherName: `${t.nome} ${t.cognome}`.trim(),
        lessonsCount: tLessons.length,
        totalHours: hours,
        roomFeeTotal: fee,
        percentageOfLessons: 0, // calcolato sotto
      };
    }).filter((t) => t.lessonsCount > 0 || t.totalHours > 0);

    const totalHoursAll = list.reduce((sum, t) => sum + t.totalHours, 0);

    list.forEach((t) => {
      t.percentageOfLessons = totalHoursAll > 0 ? (t.totalHours / totalHoursAll) * 100 : 0;
    });

    list.sort((a, b) => b.roomFeeTotal - a.roomFeeTotal);

    return {
      list,
      totalLessons: totalLessonsCount,
      totalHours: totalHoursAll,
      totalRoomFees,
    };
  }, [filteredBookings, monthKey, teachers, exclusiveTeacherIds, exclusiveTeacherNames]);

  // =========================================================================
  // 3. STATISTICHE ANNUALI (TREND 12 MESI & TOP GRUPPI DELL'ANNO)
  // =========================================================================
  const yearlyTrendData = useMemo(() => {
    const yearPrefix = `${currentYear}-`;
    const yearBookings = filteredBookings.filter((b) => b.data && b.data.startsWith(yearPrefix));

    const monthsData: MonthTrendItem[] = MESI_ITALIANI.map((name, idx) => {
      const mStr = `${currentYear}-${String(idx + 1).padStart(2, '0')}`;
      const mBookings = yearBookings.filter((b) => b.data.startsWith(mStr));

      const groupBookings = mBookings.filter((b) => b.tipo !== 'lezione');
      const teacherBookings = mBookings.filter((b) => b.tipo === 'lezione' && isExclusiveTeacherBooking(b));

      const groupIncome = groupBookings.reduce((sum, b) => sum + (b.tariffaTotale || 0), 0);
      const teacherHours = teacherBookings.reduce((sum, b) => {
        const h = b.durataOre || calculateDurationHours(b.oraInizio, b.oraFine) || 0;
        return sum + (isNaN(h) ? 0 : h);
      }, 0);
      const teacherIncome = Math.round(teacherHours * 5 * 100) / 100;

      const groupHours = groupBookings.reduce((sum, b) => {
        const h = b.durataOre || calculateDurationHours(b.oraInizio, b.oraFine) || 0;
        return sum + (isNaN(h) ? 0 : h);
      }, 0);

      const uniqueGroups = new Set(groupBookings.map((b) => (b.clienteNome || '').trim()).filter(Boolean));

      return {
        monthIndex: idx,
        monthNameShort: name.substring(0, 3).toUpperCase(),
        monthNameFull: name,
        monthKey: mStr,
        groupIncome,
        teacherIncome,
        totalIncome: groupIncome + teacherIncome,
        groupSessionsCount: groupBookings.length,
        teacherLessonsCount: teacherBookings.length,
        totalHours: groupHours + teacherHours,
        activeGroupsCount: uniqueGroups.size,
      };
    });

    // Top gruppi di tutto l'anno
    const yearGroupBookings = yearBookings.filter((b) => b.tipo !== 'lezione');
    const annualGroupMap = new Map<string, { count: number; hours: number; income: number; monthsSet: Set<string> }>();

    for (const b of yearGroupBookings) {
      const name = (b.clienteNome || 'Band Anonima').trim();
      const dur = b.durataOre || calculateDurationHours(b.oraInizio, b.oraFine) || 0;
      const inc = b.tariffaTotale || 0;
      const mSub = b.data.substring(0, 7);

      const current = annualGroupMap.get(name) || { count: 0, hours: 0, income: 0, monthsSet: new Set() };
      current.count += 1;
      current.hours += dur;
      current.income += inc;
      current.monthsSet.add(mSub);
      annualGroupMap.set(name, current);
    }

    const totalAnnualGroupIncome = Array.from(annualGroupMap.values()).reduce((sum, g) => sum + g.income, 0);

    const topAnnualGroups = Array.from(annualGroupMap.entries())
      .map(([name, val]) => ({
        clientName: name,
        sessionsCount: val.count,
        totalHours: val.hours,
        totalIncome: val.income,
        monthsActiveCount: val.monthsSet.size,
        percentageOfTotal: totalAnnualGroupIncome > 0 ? (val.income / totalAnnualGroupIncome) * 100 : 0,
      }))
      .sort((a, b) => b.totalIncome - a.totalIncome);

    const totalYearIncome = monthsData.reduce((sum, m) => sum + m.totalIncome, 0);
    const totalYearGroupIncome = monthsData.reduce((sum, m) => sum + m.groupIncome, 0);
    const totalYearTeacherIncome = monthsData.reduce((sum, m) => sum + m.teacherIncome, 0);
    const totalYearSessions = monthsData.reduce((sum, m) => sum + m.groupSessionsCount, 0);
    const totalYearLessons = monthsData.reduce((sum, m) => sum + m.teacherLessonsCount, 0);
    const totalYearHours = monthsData.reduce((sum, m) => sum + m.totalHours, 0);

    return {
      monthsData,
      topAnnualGroups,
      totalYearIncome,
      totalYearGroupIncome,
      totalYearTeacherIncome,
      totalYearSessions,
      totalYearLessons,
      totalYearHours,
      bestMonth: [...monthsData].sort((a, b) => b.totalIncome - a.totalIncome)[0],
    };
  }, [filteredBookings, currentYear]);

  // Max value per il grafico annuale
  const maxYearMonthIncome = useMemo(() => {
    const max = Math.max(...yearlyTrendData.monthsData.map((m) => m.totalIncome), 100);
    return Math.ceil(max / 100) * 100;
  }, [yearlyTrendData]);

  // Max presenze mensili per il grafico delle frequenze band
  const maxGroupSessions = useMemo(() => {
    const max = Math.max(...monthlyGroupStats.list.map((g) => g.sessionsCount), 5);
    return Math.max(max, 4);
  }, [monthlyGroupStats]);

  // Conteggi per fasce di fedeltà del mese
  const frequencyTiers = useMemo(() => {
    const weekly = monthlyGroupStats.list.filter((g) => g.frequencyTier === 'weekly');
    const biweekly = monthlyGroupStats.list.filter((g) => g.frequencyTier === 'biweekly');
    const occasional = monthlyGroupStats.list.filter((g) => g.frequencyTier === 'occasional');
    return { weekly, biweekly, occasional };
  }, [monthlyGroupStats]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Top Bar: Titolo, Selettore Orizzonte & Controlli ── */}
      <div className="bg-white dark:bg-[#0e0e0e] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-yellow-500/25 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-yellow-400/10 border border-blue-200 dark:border-yellow-500/30 flex items-center justify-center text-blue-600 dark:text-yellow-400 shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-yellow-100 tracking-tight">
                Analisi Statistiche &amp; Diagrammi
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800 dark:bg-yellow-400/20 dark:text-yellow-300 border border-blue-200 dark:border-yellow-500/30">
                {horizon === 'monthly' ? `${monthName.toUpperCase()} ${currentYear}` : `ANNO ${currentYear}`}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
              Rendimento economico gruppi e docenti, frequenza presenze mensile e andamento annuale
            </p>
          </div>
        </div>

        {/* Controlli Vista (Mese / Anno) & Filtri */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Switch Mese / Anno */}
          <div className="flex items-center bg-slate-100 dark:bg-neutral-900 rounded-xl p-1 border border-slate-200 dark:border-yellow-500/30">
            <button
              onClick={() => setHorizon('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                horizon === 'monthly'
                  ? 'bg-blue-600 text-white dark:bg-yellow-400 dark:text-black shadow-xs'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Mese</span>
            </button>
            <button
              onClick={() => setHorizon('yearly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                horizon === 'yearly'
                  ? 'bg-blue-600 text-white dark:bg-yellow-400 dark:text-black shadow-xs'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Annuale</span>
            </button>
          </div>

          {/* Navigator temporale */}
          <div className="flex items-center bg-slate-100 dark:bg-neutral-900 rounded-xl p-1 border border-slate-200 dark:border-yellow-500/30">
            <button
              onClick={horizon === 'monthly' ? handlePrevMonth : handlePrevYear}
              className="w-8 h-8 rounded-lg text-slate-600 dark:text-yellow-400 hover:text-slate-900 dark:hover:text-yellow-200 hover:bg-white dark:hover:bg-neutral-800 flex items-center justify-center transition-all cursor-pointer"
              title="Periodo precedente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={handleCurrentPeriod}
              className="px-3 text-xs font-bold text-slate-800 dark:text-yellow-300 hover:underline cursor-pointer"
              title="Vai ad oggi"
            >
              {horizon === 'monthly' ? `${monthName} ${currentYear}` : `${currentYear}`}
            </button>

            <button
              onClick={horizon === 'monthly' ? handleNextMonth : handleNextYear}
              className="w-8 h-8 rounded-lg text-slate-600 dark:text-yellow-400 hover:text-slate-900 dark:hover:text-yellow-200 hover:bg-white dark:hover:bg-neutral-800 flex items-center justify-center transition-all cursor-pointer"
              title="Periodo successivo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Filtro stato pagamento */}
          <div className="flex items-center bg-slate-100 dark:bg-neutral-900 rounded-xl p-1 border border-slate-200 dark:border-yellow-500/30 text-xs">
            <button
              onClick={() => setPaymentFilter(paymentFilter === 'paid_only' ? 'all' : 'paid_only')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                paymentFilter === 'paid_only'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white dark:bg-neutral-800 text-slate-700 dark:text-yellow-300'
              }`}
              title="Mostra solo prenotazioni saldate o tutte"
            >
              <Filter className="w-3 h-3" />
              <span>{paymentFilter === 'paid_only' ? 'Solo Saldati' : 'Tutti gli Eventi'}</span>
            </button>
          </div>

          {/* Stampa Schermata Statistiche */}
          <button
            onClick={() => window.print()}
            className="px-3 py-2 min-h-[38px] border border-slate-200 dark:border-yellow-500/30 hover:bg-slate-50 dark:hover:bg-yellow-400/10 text-slate-700 dark:text-yellow-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Stampa riepilogo statistiche"
          >
            <Printer className="w-3.5 h-3.5 text-blue-600 dark:text-yellow-400" />
            <span className="hidden sm:inline">Stampa</span>
          </button>
        </div>
      </div>

      {/* ── KPI Cards: Sintesi Economica e Flussi del Periodo ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Incasso Band */}
        <div className="bg-white dark:bg-[#0e0e0e] p-5 rounded-2xl border border-slate-200 dark:border-yellow-500/25 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-blue-700 dark:text-yellow-400 uppercase tracking-wider">
            <span>Fatturato Gruppi / Band</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-yellow-400/10 border border-blue-100 dark:border-yellow-500/30 flex items-center justify-center text-blue-600 dark:text-yellow-400">
              <Music2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
            {formatCurrency(horizon === 'monthly' ? monthlyGroupStats.totalIncome : yearlyTrendData.totalYearGroupIncome)}
          </p>
          <div className="text-[11px] text-slate-500 dark:text-neutral-400 flex items-center justify-between border-t border-slate-100 dark:border-neutral-800 pt-1.5">
            <span>Sessioni svolte:</span>
            <strong className="text-slate-800 dark:text-neutral-200 font-mono">
              {horizon === 'monthly' ? monthlyGroupStats.totalSessions : yearlyTrendData.totalYearSessions} prove
            </strong>
          </div>
        </div>

        {/* KPI 2: Quote Insegnanti */}
        <div className="bg-white dark:bg-[#0e0e0e] p-5 rounded-2xl border border-slate-200 dark:border-yellow-500/25 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
            <span>Quote Sala Insegnanti (5€/h)</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-800/40 flex items-center justify-center text-purple-600 dark:text-purple-300">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black font-mono text-purple-900 dark:text-purple-300">
            {formatCurrency(horizon === 'monthly' ? monthlyTeacherStats.totalRoomFees : yearlyTrendData.totalYearTeacherIncome)}
          </p>
          <div className="text-[11px] text-slate-500 dark:text-neutral-400 flex items-center justify-between border-t border-slate-100 dark:border-neutral-800 pt-1.5">
            <span>Ore lezioni sala:</span>
            <strong className="text-purple-800 dark:text-purple-200 font-mono">
              {(horizon === 'monthly' ? monthlyTeacherStats.totalHours : yearlyTrendData.monthsData.reduce((s, m) => s + m.teacherIncome / 5, 0)).toFixed(1)}h
            </strong>
          </div>
        </div>

        {/* KPI 3: Gruppi Attivi / Unici */}
        <div className="bg-white dark:bg-[#0e0e0e] p-5 rounded-2xl border border-slate-200 dark:border-yellow-500/25 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
            <span>Gruppi Attivi</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-300">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black font-mono text-emerald-900 dark:text-emerald-300">
            {horizon === 'monthly' ? monthlyGroupStats.activeGroupsCount : yearlyTrendData.topAnnualGroups.length}
          </p>
          <div className="text-[11px] text-slate-500 dark:text-neutral-400 flex items-center justify-between border-t border-slate-100 dark:border-neutral-800 pt-1.5">
            <span>Frequenza media:</span>
            <strong className="text-emerald-800 dark:text-emerald-200 font-mono">
              {horizon === 'monthly'
                ? (monthlyGroupStats.activeGroupsCount > 0 ? (monthlyGroupStats.totalSessions / monthlyGroupStats.activeGroupsCount).toFixed(1) : '0')
                : (yearlyTrendData.topAnnualGroups.length > 0 ? (yearlyTrendData.totalYearSessions / yearlyTrendData.topAnnualGroups.length).toFixed(1) : '0')}{' '}
              prove/band
            </strong>
          </div>
        </div>

        {/* KPI 4: Ore Totali Struttura */}
        <div className="bg-white dark:bg-[#0e0e0e] p-5 rounded-2xl border border-slate-200 dark:border-yellow-500/25 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-yellow-400 uppercase tracking-wider">
            <span>Ore Totali Occupazione Sale</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-yellow-400/10 border border-amber-100 dark:border-yellow-500/30 flex items-center justify-center text-amber-600 dark:text-yellow-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
            {(horizon === 'monthly' ? monthlyGroupStats.totalHours + monthlyTeacherStats.totalHours : yearlyTrendData.totalYearHours).toFixed(1)}h
          </p>
          <div className="text-[11px] text-slate-500 dark:text-neutral-400 flex items-center justify-between border-t border-slate-100 dark:border-neutral-800 pt-1.5">
            <span>Incasso totale sala:</span>
            <strong className="text-blue-700 dark:text-yellow-400 font-mono font-bold">
              {formatCurrency(horizon === 'monthly' ? monthlyGroupStats.totalIncome + monthlyTeacherStats.totalRoomFees : yearlyTrendData.totalYearIncome)}
            </strong>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SEZIONE A: DIAGRAMMA DEDICATO AI GRUPPI CHE VENGONO IN TUTTO IL MESE
          ========================================================================= */}
      <div className="bg-white dark:bg-[#0e0e0e] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-yellow-500/25 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-neutral-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-600 dark:bg-yellow-400"></span>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Diagramma Frequenza Gruppi nel Mese ({monthName} {currentYear})
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
              Numero di sessioni/prove svolte da ciascun gruppo nel corso del mese selezionato
            </p>
          </div>

          {/* Badge riassunto fedeltà mese */}
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>4+ prove (Tutte le settimane): <strong>{frequencyTiers.weekly.length}</strong></span>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>2-3 prove (Regolari): <strong>{frequencyTiers.biweekly.length}</strong></span>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 font-bold">
              1 prova: <strong>{frequencyTiers.occasional.length}</strong>
            </span>
          </div>
        </div>

        {monthlyGroupStats.list.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-neutral-500">
            <Music2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-semibold">Nessuna prova musicale registrata per {monthName} {currentYear}.</p>
            <p className="text-xs mt-1">Seleziona un altro mese o modifica il filtro 'Solo Saldati'.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Grafico a Barre Orizzontali Dinamiche della Frequenza Mensile */}
            <div className="space-y-2.5">
              {monthlyGroupStats.list.map((group, idx) => {
                const barWidthPercent = (group.sessionsCount / maxGroupSessions) * 100;
                const isWeeklyLoyal = group.frequencyTier === 'weekly';
                const isBiweekly = group.frequencyTier === 'biweekly';

                return (
                  <div
                    key={group.clientName}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-900/80 border border-slate-200 dark:border-neutral-800 hover:border-blue-400 dark:hover:border-yellow-500/50 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    {/* Nome Gruppo & Ranking */}
                    <div className="min-w-0 sm:w-1/3 flex items-center gap-2.5">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                        idx === 0
                          ? 'bg-amber-400 text-black shadow-xs font-black'
                          : idx === 1
                          ? 'bg-slate-300 dark:bg-neutral-700 text-slate-800 dark:text-neutral-200'
                          : idx === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-200 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400'
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate block">
                          {group.clientName}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-neutral-400">
                          <span>{group.totalHours.toFixed(1)} ore</span>
                          <span>•</span>
                          <span className="font-mono font-semibold text-emerald-700 dark:text-yellow-400">
                            {formatCurrency(group.totalIncome)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Barra Visiva Frequenza */}
                    <div className="flex-1 w-full sm:w-auto flex items-center gap-3">
                      <div className="flex-1 h-6 bg-slate-200 dark:bg-neutral-800 rounded-lg overflow-hidden p-0.5 relative">
                        <div
                          className={`h-full rounded-md transition-all duration-500 flex items-center justify-end pr-2 text-[11px] font-black font-mono text-white ${
                            isWeeklyLoyal
                              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-sm'
                              : isBiweekly
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                              : 'bg-gradient-to-r from-slate-400 to-slate-500 dark:from-neutral-600 dark:to-neutral-500'
                          }`}
                          style={{ width: `${Math.max(barWidthPercent, 12)}%` }}
                        >
                          <span>{group.sessionsCount}</span>
                        </div>
                      </div>

                      {/* Badge Frequenza Settimanale */}
                      <div className="shrink-0 text-right min-w-[110px]">
                        {isWeeklyLoyal ? (
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            🌟 Fedele ({group.sessionsCount} prove)
                          </span>
                        ) : isBiweekly ? (
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            ✓ Regolare ({group.sessionsCount} prove)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300">
                            1 prova singola
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          SEZIONE B: GRIGLIA A 2 COLONNE: ENTRATE GRUPPI & ENTRATE DOCENTI
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Diagramma 1: Classifica Entrate dei Gruppi */}
        <div className="bg-white dark:bg-[#0e0e0e] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-yellow-500/25 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                Top Gruppi per Incasso ({monthName})
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-blue-700 dark:text-yellow-400">
              Tot: {formatCurrency(monthlyGroupStats.totalIncome)}
            </span>
          </div>

          {monthlyGroupStats.list.length === 0 ? (
            <p className="text-xs italic text-slate-400 py-6 text-center">Nessun dato economico per il mese.</p>
          ) : (
            <div className="space-y-3">
              {monthlyGroupStats.list.slice(0, 8).map((g, idx) => (
                <div key={g.clientName} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-neutral-200 truncate max-w-[200px]">
                      {idx + 1}. {g.clientName}
                    </span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-slate-500 dark:text-neutral-400 text-[11px]">{g.percentageOfTotal.toFixed(1)}%</span>
                      <strong className="text-slate-900 dark:text-yellow-400 font-extrabold">{formatCurrency(g.totalIncome)}</strong>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-yellow-500 dark:to-yellow-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(g.percentageOfTotal, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Diagramma 2: Quote Sala Insegnanti (5€/h) */}
        <div className="bg-white dark:bg-[#0e0e0e] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-yellow-500/25 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                Entrate &amp; Ore Insegnanti ({monthName})
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300">
              Tot: {formatCurrency(monthlyTeacherStats.totalRoomFees)}
            </span>
          </div>

          {monthlyTeacherStats.list.length === 0 ? (
            <p className="text-xs italic text-slate-400 py-6 text-center">Nessuna lezione svolta nel mese selezionato.</p>
          ) : (
            <div className="space-y-3">
              {monthlyTeacherStats.list.map((t) => {
                const badgeColor = t.teacher.coloreBadge || '#8b5cf6';
                return (
                  <div
                    key={t.teacherId}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-900/80 border border-slate-200 dark:border-neutral-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: badgeColor }}
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                          {t.teacherName}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-neutral-400">
                          {t.lessonsCount} lezioni • {t.totalHours.toFixed(1)} ore
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-extrabold text-sm text-purple-900 dark:text-purple-300 block">
                        {formatCurrency(t.roomFeeTotal)}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-neutral-400 font-mono">
                        {t.percentageOfLessons.toFixed(1)}% monte ore
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          SEZIONE C: DIAGRAMMA ANNUALE (TREND MESE PER MESE & TOP BAND ANNO)
          ========================================================================= */}
      <div className="bg-white dark:bg-[#0e0e0e] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-yellow-500/25 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-neutral-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Andamento Annuale Completo • Anno {currentYear}
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
              Confronto mese per mese dell'incasso generato da gruppi e lezioni docenti
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-yellow-400/20 text-blue-900 dark:text-yellow-300 font-extrabold border border-blue-200 dark:border-yellow-500/30">
              Totale Anno: {formatCurrency(yearlyTrendData.totalYearIncome)}
            </span>
          </div>
        </div>

        {/* Grafico a Barre SVG Interattivo per i 12 Mesi */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400">
            <span>Andamento Incassi Mensili (Prove Band + Docenti)</span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 dark:bg-yellow-400 inline-block"></span>
                <span>Prove Band</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-purple-500 inline-block"></span>
                <span>Quote Docenti (5€/h)</span>
              </span>
            </div>
          </div>

          {/* Canvas SVG del Grafico a 12 Colonne */}
          <div className="h-64 sm:h-72 w-full pt-4 pb-2">
            <div className="h-full flex items-end justify-between gap-1 sm:gap-3 border-b border-slate-200 dark:border-neutral-800 pb-1">
              {yearlyTrendData.monthsData.map((m, idx) => {
                const totalH = maxYearMonthIncome > 0 ? (m.totalIncome / maxYearMonthIncome) * 100 : 0;
                const groupH = maxYearMonthIncome > 0 ? (m.groupIncome / maxYearMonthIncome) * 100 : 0;
                const teacherH = maxYearMonthIncome > 0 ? (m.teacherIncome / maxYearMonthIncome) * 100 : 0;
                const isHovered = hoveredBarIndex === idx;
                const isCurrentViewMonth = currentMonthIndex === idx;

                return (
                  <div
                    key={m.monthKey}
                    onMouseEnter={() => setHoveredBarIndex(idx)}
                    onMouseLeave={() => setHoveredBarIndex(null)}
                    onClick={() => {
                      setCurrentMonthIndex(idx);
                      setHorizon('monthly');
                    }}
                    className="flex-1 h-full flex flex-col justify-end items-center group cursor-pointer relative"
                    title={`Clicca per aprire ${m.monthNameFull}: ${formatCurrency(m.totalIncome)}`}
                  >
                    {/* Tooltip on Hover */}
                    {isHovered && (
                      <div className="absolute -top-16 z-30 bg-slate-900 text-white dark:bg-neutral-800 dark:border dark:border-yellow-500/40 text-[11px] font-bold p-2 rounded-lg shadow-xl whitespace-nowrap pointer-events-none animate-in fade-in duration-150">
                        <p className="text-yellow-400 font-extrabold">{m.monthNameFull} {currentYear}</p>
                        <p>Band: {formatCurrency(m.groupIncome)} ({m.groupSessionsCount} prove)</p>
                        <p className="text-purple-300">Docenti: {formatCurrency(m.teacherIncome)}</p>
                        <p className="border-t border-slate-700 pt-0.5 mt-0.5 text-xs font-black font-mono">Tot: {formatCurrency(m.totalIncome)}</p>
                      </div>
                    )}

                    {/* Colonna Composta (Gruppi in basso, Docenti sopra) */}
                    <div className="w-full max-w-[42px] flex flex-col justify-end rounded-t-lg overflow-hidden bg-slate-100 dark:bg-neutral-900/60 transition-transform group-hover:scale-105">
                      {/* Quota Docenti */}
                      {teacherH > 0 && (
                        <div
                          className="w-full bg-purple-500 hover:bg-purple-400 transition-all"
                          style={{ height: `${Math.max(teacherH * 2, 2)}px` }}
                        />
                      )}
                      {/* Quota Gruppi */}
                      {groupH > 0 && (
                        <div
                          className={`w-full transition-all ${
                            isCurrentViewMonth
                              ? 'bg-blue-600 dark:bg-yellow-400 shadow-sm'
                              : 'bg-blue-500/80 dark:bg-yellow-500/60 group-hover:bg-blue-600 dark:group-hover:bg-yellow-400'
                          }`}
                          style={{ height: `${Math.max(groupH * 2, 4)}px` }}
                        />
                      )}
                    </div>

                    {/* Etichetta Mese */}
                    <span
                      className={`text-[10px] sm:text-xs font-bold mt-2 font-mono transition-colors ${
                        isCurrentViewMonth
                          ? 'text-blue-700 dark:text-yellow-400 font-black underline'
                          : 'text-slate-500 dark:text-neutral-400 group-hover:text-slate-900 dark:group-hover:text-white'
                      }`}
                    >
                      {m.monthNameShort}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tabella Classifica Annuale Top Gruppi dell'Anno */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>Classifica Annuale Band &amp; Musicisti (Top 10 Anno {currentYear})</span>
            </h4>
            <span className="text-xs text-slate-500 dark:text-neutral-400">
              {yearlyTrendData.topAnnualGroups.length} gruppi registrati
            </span>
          </div>

          {yearlyTrendData.topAnnualGroups.length === 0 ? (
            <p className="text-xs italic text-slate-400 py-4 text-center">Nessuna prova registrata per l'anno {currentYear}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 dark:border-neutral-800 rounded-xl overflow-hidden border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-neutral-900 text-slate-700 dark:text-yellow-400 font-bold uppercase text-[10.5px]">
                    <th className="p-2.5 border-b border-slate-200 dark:border-neutral-800 w-12 text-center">Pos.</th>
                    <th className="p-2.5 border-b border-slate-200 dark:border-neutral-800">Gruppo / Band</th>
                    <th className="p-2.5 border-b border-slate-200 dark:border-neutral-800 text-center">Prove Totali</th>
                    <th className="p-2.5 border-b border-slate-200 dark:border-neutral-800 text-center">Mesi Attivi</th>
                    <th className="p-2.5 border-b border-slate-200 dark:border-neutral-800 text-center">Ore Totali</th>
                    <th className="p-2.5 border-b border-slate-200 dark:border-neutral-800 text-right">% sul Fatturato</th>
                    <th className="p-2.5 border-b border-slate-200 dark:border-neutral-800 text-right">Totale Incasso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                  {yearlyTrendData.topAnnualGroups.slice(0, 10).map((g, idx) => (
                    <tr
                      key={g.clientName}
                      className="hover:bg-slate-50 dark:hover:bg-neutral-900/60 transition-colors"
                    >
                      <td className="p-2.5 text-center font-mono font-bold">
                        {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                      </td>
                      <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                        {g.clientName}
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold text-slate-800 dark:text-neutral-200">
                        {g.sessionsCount}
                      </td>
                      <td className="p-2.5 text-center font-mono text-slate-600 dark:text-neutral-400">
                        {g.monthsActiveCount} / 12 mesi
                      </td>
                      <td className="p-2.5 text-center font-mono text-slate-600 dark:text-neutral-400">
                        {g.totalHours.toFixed(1)}h
                      </td>
                      <td className="p-2.5 text-right font-mono text-slate-500 dark:text-neutral-400">
                        {g.percentageOfTotal.toFixed(1)}%
                      </td>
                      <td className="p-2.5 text-right font-mono font-extrabold text-blue-700 dark:text-yellow-400 text-sm">
                        {formatCurrency(g.totalIncome)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
