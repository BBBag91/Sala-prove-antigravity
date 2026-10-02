import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Music2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDateItalian, calculateDurationHours } from '../utils/dateUtils';

interface TeacherLessonsFinanceSectionProps {
  currentMonthName: string;
  currentYear: number;
  monthStr: string; // YYYY-MM
  onTotalsChange?: (totals: { totalOre: number; totalDovuto: number; totalSaldato: number; totalDaSaldare: number }) => void;
}

type SettlementStatus = 'da_saldare' | 'saldato';

export const TeacherLessonsFinanceSection: React.FC<TeacherLessonsFinanceSectionProps> = ({
  currentMonthName,
  currentYear,
  monthStr,
  onTotalsChange,
}) => {
  const { staff, bookings } = useApp();
  const storageKey = `salaprove_quote_insegnanti_v1_${monthStr}`;

  // Teachers exclusively (only role 'insegnante', excluding 'entrambi' and 'operatore')
  const teachersExclusively = staff.filter((s) => s.ruolo === 'insegnante');

  // Settlement status map: teacherId -> 'da_saldare' | 'saldato'
  const [statusMap, setStatusMap] = useState<Record<string, SettlementStatus>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  // Track which teacher's lesson list is expanded
  const [expandedTeacherId, setExpandedTeacherId] = useState<string | null>(null);

  // Reload status map when month changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setStatusMap(JSON.parse(saved));
        return;
      }
    } catch {}
    setStatusMap({});
  }, [storageKey]);

  // Persist status map on changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(statusMap));
    } catch {}
  }, [statusMap, storageKey]);

  // Monthly lesson bookings
  const monthlyLessons = bookings.filter(
    (b) => b.data.startsWith(monthStr) && b.tipo === 'lezione'
  );

  // Compute stats per teacher
  const teacherStats = teachersExclusively.map((t) => {
    const lessons = monthlyLessons.filter(
      (b) => b.insegnanteId === t.id || b.insegnanteNome === `${t.nome} ${t.cognome}`
    );

    // Sort lessons chronologically
    lessons.sort((a, b) => {
      const dateCmp = a.data.localeCompare(b.data);
      if (dateCmp !== 0) return dateCmp;
      return a.oraInizio.localeCompare(b.oraInizio);
    });

    const totalOre = lessons.reduce((sum, b) => {
      const h = b.durataOre || calculateDurationHours(b.oraInizio, b.oraFine);
      return sum + (isNaN(h) ? 0 : h);
    }, 0);

    // Cost to pay to the sala: total hours * 5 euros
    const costoDovuto = Math.round(totalOre * 5 * 100) / 100;
    const stato: SettlementStatus = statusMap[t.id] || 'da_saldare';

    return {
      teacher: t,
      lessons,
      totalOre,
      costoDovuto,
      stato,
    };
  });

  // Overall totals
  const overallOre = teacherStats.reduce((sum, s) => sum + s.totalOre, 0);
  const overallDovuto = teacherStats.reduce((sum, s) => sum + s.costoDovuto, 0);
  const overallSaldato = teacherStats
    .filter((s) => s.stato === 'saldato')
    .reduce((sum, s) => sum + s.costoDovuto, 0);
  const overallDaSaldare = teacherStats
    .filter((s) => s.stato === 'da_saldare')
    .reduce((sum, s) => sum + s.costoDovuto, 0);

  // Notify parent of total changes
  useEffect(() => {
    if (onTotalsChange) {
      onTotalsChange({
        totalOre: overallOre,
        totalDovuto: overallDovuto,
        totalSaldato: overallSaldato,
        totalDaSaldare: overallDaSaldare,
      });
    }
  }, [overallOre, overallDovuto, overallSaldato, overallDaSaldare]);

  const handleToggleStatus = (teacherId: string) => {
    setStatusMap((prev) => {
      const current = prev[teacherId] || 'da_saldare';
      const next: SettlementStatus = current === 'saldato' ? 'da_saldare' : 'saldato';
      return { ...prev, [teacherId]: next };
    });
  };

  const handleToggleExpand = (teacherId: string) => {
    setExpandedTeacherId((prev) => (prev === teacherId ? null : teacherId));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-5 p-5 sm:p-7">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
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
              Conteggio ore lezioni svolte esclusivamente da insegnanti per {currentMonthName} {currentYear} • Quota sala = Ore Totali × 5€
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
          <Clock className="w-3.5 h-3.5 text-purple-600" />
          <span>Filtro attivo: <strong>Solo Insegnanti</strong> (esclusi insegnanti/operatori)</span>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Docenti Insegnanti
          </span>
          <p className="text-2xl font-bold font-mono text-slate-900">
            {teachersExclusively.length}
          </p>
          <span className="text-[10px] text-slate-500 block">
            Ruolo esclusivo insegnante
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200 space-y-1">
          <span className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider">
            Ore Lezioni Svolte
          </span>
          <p className="text-2xl font-bold font-mono text-purple-900">
            {overallOre.toFixed(1)} h
          </p>
          <span className="text-[10px] text-purple-600 block">
            {monthlyLessons.length} lezioni registrate nel mese
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider flex items-center justify-between">
            <span>Quote Saldate</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </span>
          <p className="text-2xl font-bold font-mono text-emerald-700">
            {formatCurrency(overallSaldato)}
          </p>
          <span className="text-[10px] text-emerald-600 block">
            Versato alla sala
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1">
          <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider flex items-center justify-between">
            <span>Da Saldare</span>
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
          </span>
          <p className="text-2xl font-bold font-mono text-amber-700">
            {formatCurrency(overallDaSaldare)}
          </p>
          <span className="text-[10px] text-amber-600 block">
            In attesa di versamento alla sala
          </span>
        </div>
      </div>

      {/* Teachers Breakdown Table / Cards */}
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
                    <th className="py-3 px-4">Docente / Insegnante</th>
                    <th className="py-3 px-4">Materia Insegnata</th>
                    <th className="py-3 px-4 text-center">N° Lezioni</th>
                    <th className="py-3 px-4 text-right">Totale Ore</th>
                    <th className="py-3 px-4 text-right">Quota Sala (5€/h)</th>
                    <th className="py-3 px-4 text-center">Stato Saldo</th>
                    <th className="py-3 px-4 text-right">Dettaglio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teacherStats.map(({ teacher, lessons, totalOre, costoDovuto, stato }) => {
                    const isExpanded = expandedTeacherId === teacher.id;
                    const isPaid = stato === 'saldato';

                    return (
                      <React.Fragment key={teacher.id}>
                        <tr className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? 'bg-purple-50/30' : ''}`}>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-2xs"
                                style={{ backgroundColor: teacher.coloreBadge || '#8b5cf6' }}
                              >
                                {teacher.nome[0]}{teacher.cognome[0]}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 text-sm block">
                                  {teacher.nome} {teacher.cognome}
                                </span>
                                {teacher.telefono && (
                                  <span className="text-[11px] text-slate-500">
                                    {teacher.telefono}
                                  </span>
                                )}
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

                          <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-700">
                            {lessons.length}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <span className="font-mono font-bold text-slate-900 text-sm">
                              {totalOre.toFixed(1)} h
                            </span>
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
                              title="Visualizza elenco lezioni svolte nel mese"
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

                        {/* Collapsible lesson details */}
                        {isExpanded && (
                          <tr className="bg-purple-50/20 border-b border-purple-100">
                            <td colSpan={7} className="p-4 sm:p-5">
                              <div className="bg-white rounded-xl border border-purple-200/80 p-4 space-y-3 shadow-2xs">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-purple-600" />
                                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                      Dettaglio Lezioni di {teacher.nome} {teacher.cognome} ({currentMonthName} {currentYear})
                                    </span>
                                  </div>
                                  <span className="text-xs font-bold font-mono text-purple-700">
                                    Totale: {lessons.length} lezioni • {totalOre.toFixed(1)} ore • {formatCurrency(costoDovuto)}
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                  {lessons.map((lesson) => {
                                    const h = lesson.durataOre || calculateDurationHours(lesson.oraInizio, lesson.oraFine);
                                    const quota = h * 5;

                                    return (
                                      <div
                                        key={lesson.id}
                                        className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1"
                                      >
                                        <div className="flex items-center justify-between font-semibold text-slate-800">
                                          <span>{formatDateItalian(lesson.data, false)}</span>
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
                                          <span className="truncate max-w-[120px] font-medium text-slate-700">
                                            {lesson.clienteNome}
                                          </span>
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
