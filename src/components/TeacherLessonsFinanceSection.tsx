import React, { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Calendar,
  Sparkles,
  CalendarCheck2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  formatCurrency,
  formatDateItalian,
  calculateDurationHours,
  formatDateToISO,
  timeToMinutes,
} from '../utils/dateUtils';
import { Booking, TeacherBillingCycle } from '../types';
import { financeSettlementService, SettlementStatus } from '../services/financeSettlementService';

interface TeacherLessonsFinanceSectionProps {
  currentMonthName: string;
  currentYear: number;
  monthStr: string; // YYYY-MM
  onTotalsChange?: (totals: { totalOre: number; totalDovuto: number; totalSaldato: number; totalDaSaldare: number }) => void;
}

const MONTH_NAMES_ITA = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

function getPreviousMonthStr(mStr: string): string {
  const [y, m] = mStr.split('-').map(Number);
  const prevDate = new Date(y, m - 2, 1);
  return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthNameFromStr(mStr: string): string {
  const [y, m] = mStr.split('-').map(Number);
  return `${MONTH_NAMES_ITA[m - 1]} ${y}`;
}

export const TeacherLessonsFinanceSection: React.FC<TeacherLessonsFinanceSectionProps> = ({
  currentMonthName,
  currentYear,
  monthStr,
  onTotalsChange,
}) => {
  const { staff, bookings } = useApp();

  // Riferimento al giorno odierno e all'orario attuale
  const today = useMemo(() => new Date(), []);
  const todayISO = formatDateToISO(today); // es. '2026-10-06'
  const nowMinutes = today.getHours() * 60 + today.getMinutes();

  // Modalità filtro: default true = Mostra solo le ore svolte con riferimento a oggi
  const [onlyCompleted, setOnlyCompleted] = useState<boolean>(true);

  // Insegnanti esclusivi (ruolo 'insegnante', esclusi 'entrambi' e 'operatore')
  const teachersExclusively = staff.filter((s) => s.ruolo === 'insegnante');

  // Tick reattivo per aggiornamenti da Supabase / financeSettlementService
  const [settlementVersion, setSettlementVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = financeSettlementService.subscribe(() => {
      setSettlementVersion((v) => v + 1);
    });
    return unsubscribe;
  }, []);

  // Override del ciclo di visualizzazione per ciascun insegnante (sincronizzato sul database)
  const cycleOverrides = useMemo(
    () => financeSettlementService.getTeacherCycleOverrides(monthStr),
    [monthStr, settlementVersion]
  );

  // Traccia quale insegnante ha il dettaglio lezioni aperto
  const [expandedTeacherId, setExpandedTeacherId] = useState<string | null>(null);

  // Verifica se una singola lezione è già stata svolta rispetto al giorno odierno e all'ora
  const isLessonCompleted = (b: Booking): boolean => {
    if (b.data < todayISO) return true;
    if (b.data === todayISO) {
      const endMin = timeToMinutes(b.oraFine || b.oraInizio);
      return nowMinutes >= endMin;
    }
    return false;
  };

  const prevMonthStr = useMemo(() => getPreviousMonthStr(monthStr), [monthStr]);
  const prevMonthLabel = useMemo(() => getMonthNameFromStr(prevMonthStr), [prevMonthStr]);

  const toggleCycleOverride = (teacherId: string, currentActiveCycle: TeacherBillingCycle) => {
    const nextCycle: TeacherBillingCycle =
      currentActiveCycle === 'mese_corrente' ? 'mese_precedente_posticipato' : 'mese_corrente';
    financeSettlementService.setTeacherCycleOverride(monthStr, teacherId, nextCycle);
  };

  // Calcolo statistiche per ciascun insegnante in base al rispettivo ciclo di contabilizzazione
  const teacherStats = teachersExclusively.map((t) => {
    const tFullName = `${t.nome} ${t.cognome}`.trim().toLowerCase();
    
    // Default dal profilo o fallback intelligente (Michael Bertin -> posticipato)
    const defaultCycle: TeacherBillingCycle = t.cicloFatturazioneLezioni || (
      tFullName.includes('michael') ? 'mese_precedente_posticipato' : 'mese_corrente'
    );
    const activeCycle: TeacherBillingCycle = cycleOverrides[t.id] || defaultCycle;
    const isPosticipato = activeCycle === 'mese_precedente_posticipato';
    const targetMonthStr = isPosticipato ? prevMonthStr : monthStr;
    const targetMonthLabel = isPosticipato ? prevMonthLabel : `${currentMonthName} ${currentYear}`;

    // Lezioni didattiche del periodo di competenza
    const allTeacherLessons = bookings.filter(
      (b) =>
        b.tipo === 'lezione' &&
        b.data &&
        b.data.startsWith(targetMonthStr) &&
        ((b.insegnanteId && b.insegnanteId === t.id) ||
          (b.insegnanteNome && b.insegnanteNome.trim().toLowerCase() === tFullName))
    );

    const completedTeacherLessons = allTeacherLessons.filter((b) => isLessonCompleted(b));

    // Lezioni conteggiate in base alla modalità attiva
    const lessons = onlyCompleted ? [...completedTeacherLessons] : [...allTeacherLessons];

    // Ordinamento cronologico
    lessons.sort((a, b) => {
      const dateCmp = a.data.localeCompare(b.data);
      if (dateCmp !== 0) return dateCmp;
      return a.oraInizio.localeCompare(b.oraInizio);
    });

    const totalOre = lessons.reduce((sum, b) => {
      const h = b.durataOre || calculateDurationHours(b.oraInizio, b.oraFine);
      return sum + (isNaN(h) ? 0 : h);
    }, 0);

    const totalOrePrenotate = allTeacherLessons.reduce((sum, b) => {
      const h = b.durataOre || calculateDurationHours(b.oraInizio, b.oraFine);
      return sum + (isNaN(h) ? 0 : h);
    }, 0);

    // Costo sala dovuto: totale ore conteggiate × 5€
    const costoDovuto = Math.round(totalOre * 5 * 100) / 100;
    const costoPrenotatoTotale = Math.round(totalOrePrenotate * 5 * 100) / 100;
    const stato: SettlementStatus = financeSettlementService.getTeacherSettlement(monthStr, t.id, tFullName);

    return {
      teacher: t,
      activeCycle,
      defaultCycle,
      isPosticipato,
      isOverridden: !!cycleOverrides[t.id],
      targetMonthStr,
      targetMonthLabel,
      lessons,
      allTeacherLessons,
      completedCount: completedTeacherLessons.length,
      totalBookedCount: allTeacherLessons.length,
      totalOre,
      totalOrePrenotate,
      costoDovuto,
      costoPrenotatoTotale,
      stato,
    };
  });

  // Totali complessivi per la sala
  const overallOre = teacherStats.reduce((sum, s) => sum + s.totalOre, 0);
  const overallOrePrenotate = teacherStats.reduce((sum, s) => sum + s.totalOrePrenotate, 0);
  const overallDovuto = teacherStats.reduce((sum, s) => sum + s.costoDovuto, 0);
  const overallSaldato = teacherStats
    .filter((s) => s.stato === 'saldato')
    .reduce((sum, s) => sum + s.costoDovuto, 0);
  const overallDaSaldare = teacherStats
    .filter((s) => s.stato === 'da_saldare')
    .reduce((sum, s) => sum + s.costoDovuto, 0);
  const overallLessonsCount = teacherStats.reduce((sum, s) => sum + s.lessons.length, 0);
  const overallTotalBookedCount = teacherStats.reduce((sum, s) => sum + s.totalBookedCount, 0);

  // Notifica la vista padre (FinanceView) del cambio totali
  useEffect(() => {
    if (onTotalsChange) {
      onTotalsChange({
        totalOre: overallOre,
        totalDovuto: overallDovuto,
        totalSaldato: overallSaldato,
        totalDaSaldare: overallDaSaldare,
      });
    }
  }, [overallOre, overallDovuto, overallSaldato, overallDaSaldare, onTotalsChange]);

  const handleToggleStatus = (teacherId: string) => {
    const teacherObj = teachersExclusively.find((t) => t.id === teacherId);
    const tFullName = teacherObj ? `${teacherObj.nome} ${teacherObj.cognome}`.trim().toLowerCase() : undefined;
    financeSettlementService.toggleTeacherSettlement(monthStr, teacherId, tFullName);
  };

  const handleToggleExpand = (teacherId: string) => {
    setExpandedTeacherId((prev) => (prev === teacherId ? null : teacherId));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-5 p-5 sm:p-7">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center shrink-0 shadow-xs">
            <GraduationCap className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                Quote Lezioni Insegnanti • Utilizzo Sale
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-purple-700 tracking-wide border border-purple-200">
                5€ / Ora
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Contabilizzazione per {currentMonthName} {currentYear} secondo il ciclo di ciascun docente (Mese Corrente o Consuntivo Mese Precedente) • Quota sala = Ore {onlyCompleted ? 'Svolte' : 'Totali'} × 5€
            </p>
          </div>
        </div>

        {/* Toggle Filtro Svolte vs Prenotate */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 self-start lg:self-auto shrink-0">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold shadow-2xs">
            <button
              type="button"
              onClick={() => setOnlyCompleted(true)}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                onlyCompleted
                  ? 'bg-purple-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="Visualizza solo le lezioni già effettivamente svolte con riferimento al giorno odierno"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Ore Svolte (fino ad oggi)</span>
            </button>
            <button
              type="button"
              onClick={() => setOnlyCompleted(false)}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                !onlyCompleted
                  ? 'bg-purple-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="Visualizza tutte le lezioni prenotate nel mese, incluse date future"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Tutte le Prenotate (mese)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Avviso Regole Contabili Docenti (Michael Posticipato / Luca Corrente) */}
      <div className="p-3.5 rounded-xl bg-amber-500/10 dark:bg-[#14120a] border border-amber-300 dark:border-amber-500/40 text-xs flex flex-col md:flex-row md:items-center justify-between gap-2.5 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 text-sm shadow-xs">
            ⏳
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <strong className="text-amber-950 dark:text-amber-200 font-bold">
                Cicli di Liquidazione Quote Insegnanti (5€/h):
              </strong>
              <span className="px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 dark:border dark:border-amber-500/40 font-extrabold text-[10px] uppercase tracking-wider">
                Michael Bertin: Posticipato a inizio {currentMonthName}
              </span>
            </div>
            <p className="text-amber-900 dark:text-amber-300/90 text-[11.5px] leading-relaxed">
              • <strong>Luca Di Chiara:</strong> lezioni di <strong>{currentMonthName}</strong> saldate e contabilizzate nel mese stesso.
              <br />
              • <strong>Michael Bertin:</strong> lezioni svolte a <strong>{prevMonthLabel}</strong> saldate e contabilizzate a inizio <strong>{currentMonthName} {currentYear}</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Info Riferimento Giornaliero Odierno */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl bg-purple-50/50 dark:bg-[#121212] border border-purple-100 dark:border-yellow-500/30 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 font-bold text-[11px] shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Riferimento a oggi: {formatDateItalian(todayISO, true)}
          </span>
          <span className="text-slate-600 dark:text-yellow-300">
            {onlyCompleted ? (
              <span>
                Visualizzazione attiva: <strong>Solo ore lezioni svolte</strong> (escluse le prenotazioni future al giorno odierno).
              </span>
            ) : (
              <span className="text-amber-800 dark:text-amber-300 font-medium">
                Visualizzazione attiva: <strong>Tutte le ore prenotate</strong> (inclusa stima fino a fine mese).
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-yellow-300 bg-white dark:bg-[#181818] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-yellow-500/30">
          <Clock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span>Filtro: <strong>Solo Insegnanti</strong></span>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-yellow-500/25 space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-amber-400 uppercase tracking-wider">
            Docenti Insegnanti
          </span>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-yellow-100">
            {teachersExclusively.length}
          </p>
          <span className="text-[10px] text-slate-500 dark:text-amber-500/80 block">
            Ruolo esclusivo insegnante
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-[#14101f] border border-purple-200 dark:border-purple-500/40 space-y-1">
          <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider flex items-center justify-between">
            <span>{onlyCompleted ? 'Ore Lezioni Svolte' : 'Ore Lezioni Prenotate'}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-200 dark:bg-purple-950 text-purple-800 dark:text-purple-200 dark:border dark:border-purple-500/40 font-bold">
              {onlyCompleted ? 'fino a oggi' : 'periodo'}
            </span>
          </span>
          <p className="text-2xl font-bold font-mono text-purple-900 dark:text-purple-300">
            {overallOre.toFixed(1)} h
          </p>
          <span className="text-[10px] text-purple-600 dark:text-purple-400 block">
            {onlyCompleted
              ? `${overallLessonsCount} lezioni svolte (su ${overallTotalBookedCount} prenotate)`
              : `${overallTotalBookedCount} lezioni conteggiate`}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-[#0d1f17] border border-emerald-200 dark:border-emerald-500/40 space-y-1">
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center justify-between">
            <span>Quote Saldate</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </span>
          <p className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
            {formatCurrency(overallSaldato)}
          </p>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400/80 block">
            Versato alla sala
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-[#19140a] border border-amber-200 dark:border-amber-500/40 space-y-1">
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center justify-between">
            <span>Da Saldare</span>
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          </span>
          <p className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-300">
            {formatCurrency(overallDaSaldare)}
          </p>
          <span className="text-[10px] text-amber-600 dark:text-amber-400/80 block">
            {onlyCompleted ? 'Calcolato sulle ore effettivamente svolte' : 'In attesa di versamento alla sala'}
          </span>
        </div>
      </div>

      {/* Teachers Breakdown Table */}
      {teachersExclusively.length === 0 ? (
        <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-700">
            Nessun insegnante con ruolo "Solo Insegnante" registrato
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Nella sezione <strong>Operatori & Insegnanti</strong> registra un collaboratore con ruolo <em>"Solo Insegnante / Docente"</em>. Il conteggio delle quote di 5€/ora verrà generato automaticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Docente / Insegnante & Ciclo</th>
                    <th className="py-3 px-4">Materia Insegnata</th>
                    <th className="py-3 px-4 text-center">
                      {onlyCompleted ? 'Lezioni Svolte' : 'N° Lezioni'}
                    </th>
                    <th className="py-3 px-4 text-right">
                      {onlyCompleted ? 'Ore Svolte' : 'Totale Ore'}
                    </th>
                    <th className="py-3 px-4 text-right">Quota Sala (5€/h)</th>
                    <th className="py-3 px-4 text-center">Stato Saldo</th>
                    <th className="py-3 px-4 text-right">Dettaglio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teacherStats.map(({ teacher, activeCycle, isPosticipato, targetMonthLabel, lessons, completedCount, totalBookedCount, totalOre, totalOrePrenotate, costoDovuto, stato }) => {
                    const isExpanded = expandedTeacherId === teacher.id;
                    const isPaid = stato === 'saldato';

                    return (
                      <React.Fragment key={teacher.id}>
                        <tr className={`hover:bg-slate-50/80 dark:bg-[#0d0d0d] dark:hover:bg-[#171717] transition-colors ${isExpanded ? 'bg-purple-50/30 dark:bg-[#121212]' : ''} ${isPosticipato ? 'bg-amber-50/30 dark:bg-[#0d0d0d] border-l-4 border-l-amber-500' : ''}`}>
                          <td className="py-3.5 px-4">
                            <div className="flex items-start gap-3">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-2xs mt-0.5"
                                style={{ backgroundColor: teacher.coloreBadge || '#8b5cf6' }}
                              >
                                {teacher.nome[0]}{teacher.cognome[0]}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-900 text-sm">
                                    {teacher.nome} {teacher.cognome}
                                  </span>
                                  {isPosticipato && (
                                    <span className="text-[9.5px] px-1.5 py-0.2 rounded font-black bg-amber-200 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-400 dark:border-amber-500/40 uppercase tracking-wider">
                                      Posticipato
                                    </span>
                                  )}
                                  {teacher.telefono && (
                                    <span className="text-[11px] text-slate-400">
                                      • {teacher.telefono}
                                    </span>
                                  )}
                                </div>

                                {/* Badge ciclo di contabilizzazione e toggle rapido */}
                                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                      isPosticipato
                                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                                        : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    }`}
                                    title={
                                      isPosticipato
                                        ? `Liquidazione posticipata: lezioni di ${targetMonthLabel} contabilizzate a ${currentMonthName} ${currentYear}`
                                        : `Liquidazione corrente: lezioni di ${targetMonthLabel} contabilizzate nel mese stesso`
                                    }
                                  >
                                    <span>{isPosticipato ? '⏳ Posticipato' : '📅 Mese Corrente'}</span>
                                    <span className="opacity-80 font-medium">({targetMonthLabel})</span>
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => toggleCycleOverride(teacher.id, activeCycle)}
                                    className="text-[10px] font-medium text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-200 hover:underline px-1.5 py-0.5 rounded bg-purple-50/70 dark:bg-purple-950/70 dark:border dark:border-purple-500/35 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-colors cursor-pointer"
                                    title="Clicca per commutare temporaneamente la vista tra Mese Corrente e Mese Precedente"
                                  >
                                    {isPosticipato ? '⇄ Vedi mese corrente' : '⇄ Vedi mese prec.'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-slate-600">
                            {teacher.materieInsegnamento ? (
                              <span className="inline-block bg-purple-50 text-purple-700 font-medium px-2 py-0.5 rounded-md border border-purple-200/80">
                                {teacher.materieInsegnamento}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Non specificata</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span className="font-mono font-bold text-slate-800 text-sm">
                              {lessons.length}
                            </span>
                            {onlyCompleted && totalBookedCount > lessons.length && (
                              <span className="block text-[10px] text-slate-400 font-medium">
                                su {totalBookedCount} prenotate
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <span className="font-mono font-bold text-slate-900 text-sm">
                              {totalOre.toFixed(1)} h
                            </span>
                            {onlyCompleted && totalOrePrenotate > totalOre && (
                              <span className="block text-[10px] text-slate-400 font-medium">
                                su {totalOrePrenotate.toFixed(1)} h prenotate
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="font-mono font-bold text-purple-700 text-sm">
                              {formatCurrency(costoDovuto)}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({totalOre.toFixed(1)}h × 5€)
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(teacher.id)}
                              className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs touch-manipulation touch-active ${
                                isPaid
                                  ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800'
                                  : 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800'
                              }`}
                              title={isPaid ? 'Segnato come SALDATO. Clicca per cambiare in Da Saldare' : 'Segnato come DA SALDARE. Clicca per registrare il saldo'}
                            >
                              {isPaid ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Saldato</span>
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Da Saldare</span>
                                </>
                              )}
                            </button>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleToggleExpand(teacher.id)}
                              disabled={lessons.length === 0}
                              className={`min-h-[36px] px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all inline-flex items-center gap-1 cursor-pointer touch-manipulation touch-active ${
                                lessons.length === 0
                                  ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200'
                                  : isExpanded
                                  ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                              }`}
                              title="Visualizza elenco lezioni nel mese"
                            >
                              <span>{isExpanded ? 'Chiudi' : 'Lezioni'}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* Dettaglio lezioni collassabile */}
                        {isExpanded && (
                          <tr className="bg-purple-50/20 border-b border-purple-100">
                            <td colSpan={7} className="p-4 sm:p-5">
                              <div className="bg-white rounded-xl border border-purple-200/80 p-4 space-y-3 shadow-2xs">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                  <div className="flex items-center gap-2">
                                    <CalendarCheck2 className="w-4 h-4 text-purple-600" />
                                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                      Dettaglio Lezioni di {teacher.nome} {teacher.cognome} • Riferimento: {targetMonthLabel} ({isPosticipato ? 'Posticipato a consuntivo' : 'Mese corrente'})
                                    </span>
                                  </div>
                                  <span className="text-xs font-bold font-mono text-purple-700">
                                    Totale: {lessons.length} lezioni {onlyCompleted ? 'svolte' : ''} • {totalOre.toFixed(1)} ore • {formatCurrency(costoDovuto)}
                                    {onlyCompleted && totalBookedCount > completedCount && (
                                      <span className="text-slate-400 font-normal ml-1">
                                        ({totalBookedCount - completedCount} future)
                                      </span>
                                    )}
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                  {lessons.map((lesson) => {
                                    const h = lesson.durataOre || calculateDurationHours(lesson.oraInizio, lesson.oraFine);
                                    const quota = h * 5;
                                    const isDone = isLessonCompleted(lesson);
                                    const isToday = lesson.data === todayISO;

                                    return (
                                      <div
                                        key={lesson.id}
                                        className={`p-2.5 rounded-lg border text-xs space-y-1 transition-all ${
                                          isDone
                                            ? 'bg-slate-50 border-slate-200'
                                            : 'bg-amber-50/50 border-amber-200/80'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between font-semibold text-slate-800">
                                          <div className="flex items-center gap-1.5">
                                            <span>{formatDateItalian(lesson.data, false)}</span>
                                            {isToday && (
                                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-blue-100 text-blue-700 border border-blue-200">
                                                Oggi
                                              </span>
                                            )}
                                          </div>
                                          <span className="font-mono text-purple-700 font-bold">
                                            {formatCurrency(quota)}
                                          </span>
                                        </div>

                                        <div className="text-[11px] text-slate-600 flex items-center justify-between">
                                          <span>Orario: {lesson.oraInizio} - {lesson.oraFine}</span>
                                          <span className="font-mono font-medium">({h} h)</span>
                                        </div>

                                        <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/60">
                                          <span>Sala: {lesson.salaNome}</span>
                                          <div className="flex items-center gap-1">
                                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                              isDone
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : 'bg-amber-100 text-amber-800'
                                            }`}>
                                              {isDone ? '✓ Svolta' : '⏳ Programmata'}
                                            </span>
                                            <span className="truncate max-w-[100px] font-medium text-slate-700">
                                              {lesson.clienteNome}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
