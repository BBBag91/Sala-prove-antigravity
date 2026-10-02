import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  GraduationCap,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Printer,
  User,
  Music2,
  Sparkles,
  DollarSign,
  ArrowRight,
  Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StaffMember, Booking } from '../types';
import {
  MESI_ITALIANI,
  formatCurrency,
  formatDateItalian,
  formatDateToISO,
  parseISODate,
  calculateDurationHours,
} from '../utils/dateUtils';

interface TeacherProfileReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedTeacherId?: string;
}

type SettlementStatus = 'da_saldare' | 'saldato';

const STORAGE_KEY_TEACHER = 'salaprove_user_selected_teacher_id';

export const TeacherProfileReportModal: React.FC<TeacherProfileReportModalProps> = ({
  isOpen,
  onClose,
  preselectedTeacherId,
}) => {
  const { staff, bookings, rooms } = useApp();

  // Insegnanti esclusivi (solo ruolo 'insegnante', escludendo 'operatore' ed 'entrambi')
  const teachersOnly = useMemo(() => {
    return staff.filter((s) => s.attivo && s.ruolo === 'insegnante');
  }, [staff]);

  // Insegnante selezionato nel profilo utente
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(() => {
    if (preselectedTeacherId) return preselectedTeacherId;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TEACHER);
      if (saved && teachersOnly.some((t) => t.id === saved)) return saved;
    } catch {}
    return teachersOnly[0]?.id || '';
  });

  // Mese di riferimento per il resoconto
  const today = new Date();
  const [currentDate, setCurrentDate] = useState<Date>(today);

  const monthStr = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, [currentDate]);

  const monthName = MESI_ITALIANI[currentDate.getMonth()];
  const year = currentDate.getFullYear();

  // Sincronizza stato salvataggio insegnante
  useEffect(() => {
    if (selectedTeacherId) {
      try {
        localStorage.setItem(STORAGE_KEY_TEACHER, selectedTeacherId);
      } catch {}
    } else if (teachersOnly.length > 0 && !selectedTeacherId) {
      setSelectedTeacherId(teachersOnly[0].id);
    }
  }, [selectedTeacherId, teachersOnly]);

  const selectedTeacher = useMemo(() => {
    return teachersOnly.find((t) => t.id === selectedTeacherId);
  }, [teachersOnly, selectedTeacherId]);

  // Stato saldatura fine mese (sincronizzato con il database/localStorage condiviso con la sezione conti)
  const settlementStorageKey = `salaprove_quote_insegnanti_v1_${monthStr}`;
  const [settlementMap, setSettlementMap] = useState<Record<string, SettlementStatus>>(() => {
    try {
      const saved = localStorage.getItem(settlementStorageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(settlementStorageKey);
      if (saved) {
        setSettlementMap(JSON.parse(saved));
        return;
      }
    } catch {}
    setSettlementMap({});
  }, [settlementStorageKey]);

  const toggleSettlementStatus = () => {
    if (!selectedTeacherId) return;
    const currentStatus = settlementMap[selectedTeacherId] || 'da_saldare';
    const nextStatus: SettlementStatus = currentStatus === 'saldato' ? 'da_saldare' : 'saldato';
    const nextMap = { ...settlementMap, [selectedTeacherId]: nextStatus };
    setSettlementMap(nextMap);
    try {
      localStorage.setItem(settlementStorageKey, JSON.stringify(nextMap));
    } catch {}
  };

  // Navigazione mese
  const handlePrevMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };
  const handleGoCurrentMonth = () => {
    setCurrentDate(today);
  };

  // Lezioni prenotate per l'insegnante selezionato nel mese
  const teacherMonthlyBookings = useMemo(() => {
    if (!selectedTeacher) return [];
    const teacherFullName = `${selectedTeacher.nome} ${selectedTeacher.cognome}`.trim().toLowerCase();

    return bookings
      .filter((b) => {
        if (!b.data.startsWith(monthStr)) return false;
        if (b.tipo !== 'lezione') return false;

        const matchId = b.insegnanteId === selectedTeacher.id;
        const matchName = b.insegnanteNome && b.insegnanteNome.trim().toLowerCase() === teacherFullName;
        return matchId || matchName;
      })
      .sort((a, b) => {
        const dateDiff = a.data.localeCompare(b.data);
        if (dateDiff !== 0) return dateDiff;
        return a.oraInizio.localeCompare(b.oraInizio);
      });
  }, [bookings, selectedTeacher, monthStr]);

  // Conteggio ore totali e compenso dovuto (5€/ora)
  const totalHours = useMemo(() => {
    return teacherMonthlyBookings.reduce((sum, b) => {
      const dur = b.durataOre || calculateDurationHours(b.oraInizio, b.oraFine);
      return sum + dur;
    }, 0);
  }, [teacherMonthlyBookings]);

  const TARIFFA_SALA_ORA = 5.0; // 5 euro all'ora da versare alla sala prove
  const totalAmountDue = totalHours * TARIFFA_SALA_ORA;
  const isSettled = (settlementMap[selectedTeacherId] || 'da_saldare') === 'saldato';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0e0e0e] border border-yellow-500/40 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header Modal */}
        <div className="px-5 sm:px-6 py-4 border-b border-neutral-800 bg-neutral-900/90 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0 shadow-xs">
              <GraduationCap className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug truncate">
                Profilo Insegnante &amp; Resoconto Monte Ore
              </h2>
              <p className="text-xs text-neutral-400 truncate">
                Riepilogo ore lezioni prenotate e calcolo quota sala di fine mese
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1">
          {/* Sezione 1: Selezione ESCLUSIVA dell'insegnante */}
          <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-neutral-950 border-2 border-blue-200 dark:border-neutral-800 space-y-3 shadow-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-black text-blue-700 dark:text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4" />
                <span>Seleziona Insegnante</span>
                <span className="text-[10px] font-normal text-blue-600/80 dark:text-neutral-400 lowercase">(solo docenti abilitati)</span>
              </label>
              {teachersOnly.length > 0 && (
                <span className="text-[11px] text-blue-700/80 dark:text-neutral-400 font-bold">
                  {teachersOnly.length} {teachersOnly.length === 1 ? 'docente registrato' : 'docenti registrati'}
                </span>
              )}
            </div>

            {teachersOnly.length === 0 ? (
              <div className="p-4 rounded-lg bg-neutral-900/60 border border-neutral-800 text-center text-xs text-neutral-400 space-y-1">
                <AlertCircle className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                <p className="font-semibold text-neutral-300">Nessun insegnante censito nello staff con ruolo esclusivo "Insegnante".</p>
                <p className="text-[11px]">Un amministratore può configurare il ruolo insegnante dalla sezione Staff.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Select Insegnante con Sfondo Blu ad alta visibilità */}
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                  className="w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm sm:text-base border-2 border-blue-400 dark:border-blue-300 shadow-md shadow-blue-500/25 focus:ring-4 focus:ring-blue-400/40 focus:outline-hidden cursor-pointer transition-all"
                >
                  {teachersOnly.map((t) => (
                    <option
                      key={t.id}
                      value={t.id}
                      style={{ backgroundColor: '#1e3a8a', color: '#ffffff' }}
                      className="bg-blue-900 text-white font-bold py-2"
                    >
                      🎓 {t.nome} {t.cognome} {t.materieInsegnamento ? `(${t.materieInsegnamento})` : ''}
                    </option>
                  ))}
                </select>

                {selectedTeacher && (
                  <div className="flex items-center justify-between text-xs sm:text-sm px-3.5 py-2.5 rounded-xl bg-blue-100/90 dark:bg-blue-950/70 border-2 border-blue-300 dark:border-blue-800 text-blue-950 dark:text-blue-100 shadow-xs">
                    <span className="font-bold">
                      Docente attivo: <strong className="font-black text-blue-900 dark:text-blue-300 underline underline-offset-2">{selectedTeacher.nome} {selectedTeacher.cognome}</strong>
                    </span>
                    {selectedTeacher.materieInsegnamento && (
                      <span className="text-xs font-mono font-bold bg-blue-600 text-white px-2.5 py-0.5 rounded-md shadow-xs">
                        {selectedTeacher.materieInsegnamento}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sezione 2: Resoconto Monte Ore & Quota Fine Mese (visibile per l'insegnante selezionato) */}
          {selectedTeacher && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Barra Mese & Navigazione */}
              <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 bg-neutral-900 rounded-lg p-1 border border-neutral-700">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                    title="Mese precedente"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 text-xs font-extrabold text-yellow-300 min-w-[120px] text-center">
                    {monthName} {year}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                    title="Mese successivo"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleGoCurrentMonth}
                  className="px-2.5 py-1 text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-lg transition-colors cursor-pointer"
                >
                  Mese Corrente
                </button>
              </div>

              {/* KPI Cards di Sintesi */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Monte Ore Prenotate */}
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                  <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-yellow-400" /> Monte Ore Prenotate
                  </span>
                  <div className="flex items-baseline gap-1.5 pt-0.5">
                    <span className="text-2xl font-black text-white">{totalHours.toFixed(1)}</span>
                    <span className="text-xs font-semibold text-neutral-400">ore totali</span>
                  </div>
                  <p className="text-[10.5px] text-neutral-400 pt-1">
                    {teacherMonthlyBookings.length} {teacherMonthlyBookings.length === 1 ? 'lezione' : 'lezioni'} registrate a {monthName}
                  </p>
                </div>

                {/* 2. Quota Dovuta a Fine Mese (5€/h) */}
                <div className="p-4 rounded-xl bg-neutral-950 border border-purple-500/30 space-y-1 relative overflow-hidden">
                  <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Quota Sala Fine Mese
                  </span>
                  <div className="flex items-baseline gap-1.5 pt-0.5">
                    <span className="text-2xl font-black text-purple-300">
                      {formatCurrency(totalAmountDue)}
                    </span>
                    <span className="text-xs font-semibold text-purple-400/80">(5€ / ora)</span>
                  </div>
                  <p className="text-[10.5px] text-neutral-400 pt-1">
                    {totalHours.toFixed(1)}h × 5,00 € da versare alla sala
                  </p>
                </div>

                {/* 3. Stato Pagamento a Fine Mese */}
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2 flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                    Stato Quota Fine Mese
                  </span>
                  <div>
                    <button
                      type="button"
                      onClick={toggleSettlementStatus}
                      className={`w-full py-2 px-3 rounded-lg border text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        isSettled
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                      }`}
                      title="Clicca per commutare stato tra Da Saldare e Saldato"
                    >
                      {isSettled ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>SALDATO</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-4 h-4 text-amber-400" />
                          <span>DA SALDARE</span>
                        </>
                      )}
                    </button>
                  </div>
                  <span className="text-[10px] text-neutral-400 text-center block">
                    (Clicca sul pulsante per aggiornare lo stato)
                  </span>
                </div>
              </div>

              {/* Tabella Dettagliata Lezioni Prenotate */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Music2 className="w-3.5 h-3.5 text-yellow-400" />
                    <span>Elenco Lezioni di {selectedTeacher.nome} ({teacherMonthlyBookings.length})</span>
                  </h3>
                  <span className="text-xs text-neutral-400 font-medium">
                    Monte ore: <strong className="text-yellow-300">{totalHours.toFixed(1)}h</strong>
                  </span>
                </div>

                {teacherMonthlyBookings.length === 0 ? (
                  <div className="py-8 text-center text-xs text-neutral-400 bg-neutral-900/40 rounded-lg border border-neutral-800">
                    Nessuna lezione prenotata in calendario per {selectedTeacher.nome} nel mese di {monthName} {year}.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {teacherMonthlyBookings.map((b, idx) => {
                      const dur = b.durataOre || calculateDurationHours(b.oraInizio, b.oraFine);
                      const room = rooms.find((r) => r.id === b.salaId);
                      const quotaLezione = dur * TARIFFA_SALA_ORA;

                      return (
                        <div
                          key={b.id || idx}
                          className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-yellow-500/30 transition-colors flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-white">
                                {formatDateItalian(b.data, true)}
                              </span>
                              <span className="font-mono text-yellow-400 font-bold bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800">
                                {b.oraInizio} - {b.oraFine}
                              </span>
                              <span className="text-[11px] font-semibold text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
                                {room?.nome || b.salaNome || 'Sala'}
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-400 truncate">
                              Allievo/Band: <strong className="text-neutral-200">{b.clienteNome}</strong>
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-mono font-bold text-white text-xs block">
                              {dur.toFixed(1)}h
                            </span>
                            <span className="text-[10px] text-purple-300 font-semibold block">
                              Quota: {formatCurrency(quotaLezione)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-neutral-800 bg-neutral-900/90 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Stampa riepilogo monte ore"
          >
            <Printer className="w-3.5 h-3.5 text-yellow-400" />
            <span>Stampa Resoconto</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-extrabold transition-colors cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
