import React, { useState, useMemo, useEffect } from 'react';
import {
  GraduationCap,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Printer,
  User,
  DoorOpen,
  Filter,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Booking } from '../types';
import {
  MESI_ITALIANI,
  formatCurrency,
  formatDateItalian,
  calculateDurationHours,
  formatDateToISO,
  timeToMinutes,
} from '../utils/dateUtils';

interface TeachersReportViewProps {
  initialTeacherId?: string;
  lockedTeacherId?: string;
}

export const TeachersReportView: React.FC<TeachersReportViewProps> = ({
  initialTeacherId,
  lockedTeacherId,
}) => {
  const { staff, bookings, rooms } = useApp();

  // Mese di riferimento selezionato (default: mese corrente)
  const today = new Date();
  const [currentDate, setCurrentDate] = useState<Date>(today);

  // Data odierna e orario attuale
  const todayISO = formatDateToISO(today); // es. '2026-10-04'
  const nowMinutes = today.getHours() * 60 + today.getMinutes();

  // Filtro: solo lezioni già svolte fino ad oggi/ora
  const [onlyCompleted, setOnlyCompleted] = useState<boolean>(true);

  const monthStr = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, [currentDate]);

  const monthName = MESI_ITALIANI[currentDate.getMonth()];
  const year = currentDate.getFullYear();

  // Navigazione mesi
  const handlePrevMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };
  const handleGoCurrentMonth = () => {
    setCurrentDate(today);
  };

  // Funzione per verificare se una lezione è già stata svolta
  const isLessonCompleted = (b: Booking): boolean => {
    if (b.data < todayISO) return true;
    if (b.data === todayISO) {
      const endMin = timeToMinutes(b.oraFine || b.oraInizio);
      return nowMinutes >= endMin;
    }
    return false;
  };

  // Collaboratori docenti (insegnante o entrambi con materie)
  const teachersList = useMemo(() => {
    return staff
      .filter((s) => s.attivo && (s.ruolo === 'insegnante' || s.ruolo === 'entrambi'))
      .filter((s) => (lockedTeacherId ? s.id === lockedTeacherId : true))
      .map((s) => ({
        id: s.id,
        nome: s.nome,
        cognome: s.cognome,
        materie: s.materieInsegnamento,
        telefono: s.telefono,
        coloreBadge: s.coloreBadge || '#8b5cf6',
      }))
      .sort((a, b) => `${a.nome} ${a.cognome}`.localeCompare(`${b.nome} ${b.cognome}`));
  }, [staff, lockedTeacherId]);

  // Insegnante selezionato
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(() => {
    if (lockedTeacherId) return lockedTeacherId;
    if (initialTeacherId && teachersList.some((t) => t.id === initialTeacherId)) {
      return initialTeacherId;
    }
    try {
      const saved = localStorage.getItem('salaprove_user_selected_teacher_id');
      if (saved && teachersList.some((t) => t.id === saved)) return saved;
    } catch {}
    return teachersList[0]?.id || '';
  });

  useEffect(() => {
    if (lockedTeacherId) {
      setSelectedTeacherId(lockedTeacherId);
      return;
    }
    if (teachersList.length > 0 && (!selectedTeacherId || !teachersList.some((t) => t.id === selectedTeacherId))) {
      setSelectedTeacherId(teachersList[0].id);
    }
  }, [teachersList, selectedTeacherId, lockedTeacherId]);

  useEffect(() => {
    if (selectedTeacherId) {
      try {
        localStorage.setItem('salaprove_user_selected_teacher_id', selectedTeacherId);
      } catch {}
    }
  }, [selectedTeacherId]);

  const currentTeacher = useMemo(() => {
    return teachersList.find((t) => t.id === selectedTeacherId) || teachersList[0] || null;
  }, [teachersList, selectedTeacherId]);

  // Tutte le lezioni didattiche del mese
  const allMonthlyLessons = useMemo(() => {
    return bookings.filter((b) => b.data.startsWith(monthStr) && b.tipo === 'lezione');
  }, [bookings, monthStr]);

  // Calcolo statistiche per ciascun docente nel mese
  const teachersStats = useMemo(() => {
    return teachersList.map((t) => {
      const tFullName = `${t.nome} ${t.cognome}`.trim().toLowerCase();

      const teacherAllLessons = allMonthlyLessons.filter((b) => {
        if (b.insegnanteId && b.insegnanteId === t.id) return true;
        if (b.insegnanteNome && b.insegnanteNome.trim().toLowerCase() === tFullName) return true;
        return false;
      });

      const lessons = teacherAllLessons.filter((b) => {
        if (onlyCompleted) {
          return isLessonCompleted(b);
        }
        return true;
      });

      lessons.sort((a, b) => {
        const dComp = a.data.localeCompare(b.data);
        if (dComp !== 0) return dComp;
        return a.oraInizio.localeCompare(b.oraInizio);
      });

      const totalOre = lessons.reduce((sum, b) => {
        const h = b.durataOre || calculateDurationHours(b.oraInizio, b.oraFine);
        return sum + (isNaN(h) ? 0 : h);
      }, 0);

      const costoDovuto = Math.round(totalOre * 5 * 100) / 100;
      const futureCount = teacherAllLessons.filter((b) => !isLessonCompleted(b)).length;

      return {
        teacher: t,
        lessons,
        totalOre,
        costoDovuto,
        futureCount,
      };
    });
  }, [teachersList, allMonthlyLessons, onlyCompleted, todayISO, nowMinutes]);

  const selectedTeacherStats = useMemo(() => {
    if (!currentTeacher) return null;
    return teachersStats.find((s) => s.teacher.id === currentTeacher.id) || null;
  }, [teachersStats, currentTeacher]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ── 1. Barra Superiore: Titolo, Mese e Azioni ── */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-yellow-400/10 text-blue-600 dark:text-yellow-400 border border-blue-200/60 dark:border-yellow-500/30 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Riepilogo Ore Insegnanti
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-neutral-700">
                5€ / h
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-neutral-400">
              Conteggio lezioni e quota oraria sala prove
            </p>
          </div>
        </div>

        {/* Controlli Navigazione Mese e Stampa */}
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0 print:hidden">
          <div className="flex items-center bg-slate-100 dark:bg-neutral-950 rounded-lg p-0.5 border border-slate-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Mese precedente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-semibold text-slate-800 dark:text-neutral-200 min-w-[120px] text-center">
              {monthName} {year}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Mese successivo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleGoCurrentMonth}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-neutral-950 hover:bg-slate-200 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-neutral-800 transition-colors cursor-pointer"
          >
            Oggi
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Stampa riepilogo"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Stampa</span>
          </button>
        </div>
      </div>

      {/* ── 2. Selezione Insegnante & Filtro Stato Svolto ── */}
      {teachersList.length === 0 ? (
        <div className="p-8 bg-white dark:bg-neutral-900 rounded-xl border border-dashed border-slate-200 dark:border-neutral-800 text-center space-y-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-neutral-200">
            Nessun collaboratore con ruolo "Insegnante" trovato
          </p>
          <p className="text-xs text-slate-500 dark:text-neutral-400">
            Gli amministratori possono assegnare il ruolo <em>"Solo Insegnante"</em> dalla sezione Staff.
          </p>
        </div>
      ) : (
        <>
          {/* Selettore Insegnanti (se più di 1) e Opzioni visualizzazione */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-3 px-4 rounded-xl border border-slate-200 dark:border-neutral-800 text-xs print:hidden">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-500 dark:text-neutral-400 flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> Insegnante:
              </span>
              {teachersList.length === 1 ? (
                <span className="font-bold text-slate-900 dark:text-white px-2 py-1 rounded bg-slate-100 dark:bg-neutral-800">
                  {teachersList[0].nome} {teachersList[0].cognome}
                </span>
              ) : (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {teachersList.map((t) => {
                    const isSelected = selectedTeacherId === t.id;
                    const stat = teachersStats.find((s) => s.teacher.id === t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTeacherId(t.id)}
                        className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-blue-600 dark:bg-yellow-400 text-white dark:text-black font-semibold shadow-2xs'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-300'
                        }`}
                      >
                        <span>{t.nome} {t.cognome}</span>
                        {stat && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                            isSelected ? 'bg-black/15 dark:bg-black/20' : 'bg-slate-200 dark:bg-neutral-700 text-slate-600 dark:text-neutral-300'
                          }`}>
                            {stat.totalOre.toFixed(1)}h
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Toggle lezioni completate */}
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <span className="text-[11px] text-slate-500 dark:text-neutral-400 hidden md:inline">
                Aggiornato al {formatDateItalian(todayISO, true)}
              </span>
              <button
                type="button"
                onClick={() => setOnlyCompleted(!onlyCompleted)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1 ${
                  onlyCompleted
                    ? 'bg-slate-100 dark:bg-neutral-800 text-slate-800 dark:text-neutral-200 border-slate-300 dark:border-neutral-700'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                }`}
              >
                <Filter className="w-3 h-3" />
                {onlyCompleted ? 'Solo lezioni già svolte' : 'Mostra anche future'}
              </button>
            </div>
          </div>

          {/* ── 3. Scheda Sintetica Unificata Docente & KPI ── */}
          {currentTeacher && selectedTeacherStats && (
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 p-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Info Docente */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-lg flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-2xs"
                    style={{ backgroundColor: currentTeacher.coloreBadge || '#6366f1' }}
                  >
                    {currentTeacher.nome[0]}{currentTeacher.cognome ? currentTeacher.cognome[0] : ''}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {currentTeacher.nome} {currentTeacher.cognome}
                      </h3>
                      {currentTeacher.materie && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-neutral-700">
                          {currentTeacher.materie}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5 flex items-center gap-3">
                      {currentTeacher.telefono && (
                        <span>Tel: <span className="text-slate-700 dark:text-neutral-300 font-medium">{currentTeacher.telefono}</span></span>
                      )}
                      <span>Mese: <span className="font-semibold text-slate-700 dark:text-neutral-300">{monthName} {year}</span></span>
                    </div>
                  </div>
                </div>

                {/* 3 Metriche Compatte in Linea */}
                <div className="flex items-center gap-4 sm:gap-6 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 dark:border-neutral-800">
                  <div className="text-left sm:text-right">
                    <span className="text-[10.5px] font-medium text-slate-400 dark:text-neutral-500 uppercase tracking-wider block">
                      Lezioni
                    </span>
                    <span className="text-base sm:text-lg font-bold text-slate-800 dark:text-neutral-200 font-mono">
                      {selectedTeacherStats.lessons.length}
                    </span>
                  </div>

                  <div className="h-7 w-px bg-slate-200 dark:bg-neutral-800 hidden sm:block" />

                  <div className="text-left sm:text-right">
                    <span className="text-[10.5px] font-medium text-slate-400 dark:text-neutral-500 uppercase tracking-wider block">
                      Ore Svolte
                    </span>
                    <span className="text-base sm:text-lg font-black text-blue-600 dark:text-yellow-400 font-mono">
                      {selectedTeacherStats.totalOre.toFixed(1)} h
                    </span>
                  </div>

                  <div className="h-7 w-px bg-slate-200 dark:bg-neutral-800 hidden sm:block" />

                  <div className="text-left sm:text-right">
                    <span className="text-[10.5px] font-medium text-slate-400 dark:text-neutral-500 uppercase tracking-wider block">
                      Quota Sala (5€/h)
                    </span>
                    <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono">
                      {formatCurrency(selectedTeacherStats.costoDovuto)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 4. Tabella Dettaglio Lezioni ── */}
          {currentTeacher && selectedTeacherStats && (
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 overflow-hidden shadow-xs">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500 dark:text-neutral-400" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Dettaglio Lezioni Svolte ({selectedTeacherStats.lessons.length})
                  </h4>
                </div>
                {selectedTeacherStats.futureCount > 0 && onlyCompleted && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    {selectedTeacherStats.futureCount} prenotazioni future non conteggiate
                  </span>
                )}
              </div>

              {selectedTeacherStats.lessons.length === 0 ? (
                <div className="py-12 px-4 text-center space-y-1.5">
                  <Clock className="w-8 h-8 text-slate-300 dark:text-neutral-700 mx-auto stroke-1" />
                  <p className="text-sm font-medium text-slate-700 dark:text-neutral-300">
                    Nessuna lezione svolta registrata per {currentTeacher.nome} fino ad oggi
                  </p>
                  <p className="text-xs text-slate-400 dark:text-neutral-500">
                    {selectedTeacherStats.futureCount > 0
                      ? `Ci sono ${selectedTeacherStats.futureCount} lezioni prenotate nei prossimi giorni di ${monthName}.`
                      : `Non sono presenti lezioni a calendario per questo mese.`}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-neutral-950 border-b border-slate-200 dark:border-neutral-800 text-slate-500 dark:text-neutral-400 uppercase tracking-wider font-semibold text-[11px]">
                        <th className="py-2.5 px-3.5 w-10 text-center">#</th>
                        <th className="py-2.5 px-3.5">Data &amp; Giorno</th>
                        <th className="py-2.5 px-3.5">Orario</th>
                        <th className="py-2.5 px-3.5 text-center">Durata</th>
                        <th className="py-2.5 px-3.5">Sala Prove</th>
                        <th className="py-2.5 px-3.5">Allievo / Band</th>
                        <th className="py-2.5 px-3.5 text-right">Quota (5€/h)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/80">
                      {selectedTeacherStats.lessons.map((lesson, idx) => {
                        const dur = lesson.durataOre || calculateDurationHours(lesson.oraInizio, lesson.oraFine);
                        const quota = Math.round(dur * 5 * 100) / 100;
                        const room = rooms.find((r) => r.id === lesson.salaId);

                        return (
                          <tr
                            key={lesson.id || idx}
                            className="hover:bg-slate-50/80 dark:hover:bg-neutral-800/50 transition-colors"
                          >
                            <td className="py-2.5 px-3.5 text-center font-mono text-slate-400 dark:text-neutral-500 text-[11px]">
                              {idx + 1}
                            </td>

                            <td className="py-2.5 px-3.5">
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {formatDateItalian(lesson.data, true)}
                              </span>
                            </td>

                            <td className="py-2.5 px-3.5">
                              <span className="font-mono text-slate-700 dark:text-neutral-300">
                                {lesson.oraInizio} - {lesson.oraFine}
                              </span>
                            </td>

                            <td className="py-2.5 px-3.5 text-center">
                              <span className="font-mono font-bold text-blue-600 dark:text-yellow-400 px-2 py-0.5 rounded bg-blue-50 dark:bg-yellow-400/10">
                                {dur.toFixed(1)} h
                              </span>
                            </td>

                            <td className="py-2.5 px-3.5 text-slate-700 dark:text-neutral-300">
                              <div className="flex items-center gap-1.5">
                                <DoorOpen className="w-3.5 h-3.5 text-slate-400 dark:text-neutral-500 shrink-0" />
                                <span>{room?.nome || lesson.salaNome || 'Sala'}</span>
                              </div>
                            </td>

                            <td className="py-2.5 px-3.5">
                              <span className="font-medium text-slate-800 dark:text-neutral-200">
                                {lesson.clienteNome}
                              </span>
                            </td>

                            <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                              {formatCurrency(quota)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 dark:bg-neutral-950 font-bold border-t border-slate-200 dark:border-neutral-800 text-xs text-slate-900 dark:text-white">
                        <td colSpan={3} className="py-3 px-3.5 uppercase font-semibold text-slate-600 dark:text-neutral-400">
                          Totale ({selectedTeacherStats.lessons.length} lezioni)
                        </td>
                        <td className="py-3 px-3.5 text-center font-mono font-black text-blue-600 dark:text-yellow-400 text-sm">
                          {selectedTeacherStats.totalOre.toFixed(1)} h
                        </td>
                        <td colSpan={2} />
                        <td className="py-3 px-3.5 text-right font-mono font-black text-slate-900 dark:text-white text-sm">
                          {formatCurrency(selectedTeacherStats.costoDovuto)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
