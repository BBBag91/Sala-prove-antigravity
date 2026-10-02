import React, { useState } from 'react';
import {
  Plus,
  Briefcase,
  Clock,
  Mail,
  Phone,
  GraduationCap,
  Edit2,
  Trash2,
  Calendar,
  Printer,
  FileSpreadsheet,
  Palmtree,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { StaffMember } from '../types';
import { GIORNI_CALENDARIO, MESI_ITALIANI } from '../utils/dateUtils';
import { getOperatorAccumulatedHours } from '../utils/scheduler';

const StaffModal = React.lazy(() => import('./StaffModal').then(m => ({ default: m.StaffModal })));
const OperatorSchedulePrintModal = React.lazy(() => import('./OperatorSchedulePrintModal').then(m => ({ default: m.OperatorSchedulePrintModal })));
const OperatorMonthlyScheduleModal = React.lazy(() => import('./OperatorMonthlyScheduleModal').then(m => ({ default: m.OperatorMonthlyScheduleModal })));
const MonthlyShiftsPdfModal = React.lazy(() => import('./MonthlyShiftsPdfModal').then(m => ({ default: m.MonthlyShiftsPdfModal })));

interface StaffViewProps {
  onNavigateToTurni?: () => void;
}

export const StaffView: React.FC<StaffViewProps> = ({ onNavigateToTurni }) => {
  const { staff, bookings, deleteStaff } = useApp();
  const { isAdmin } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [staffToEdit, setStaffToEdit] = useState<StaffMember | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isMonthlyPdfModalOpen, setIsMonthlyPdfModalOpen] = useState(false);
  const [selectedOperatorForSchedule, setSelectedOperatorForSchedule] = useState<string | null>(null);
  const [selectedOperatorForMonthlyCalendar, setSelectedOperatorForMonthlyCalendar] = useState<StaffMember | null>(null);
  const [selectedDateForEditor, setSelectedDateForEditor] = useState<string | undefined>(undefined);

  // Navigazione mese in mese per la visualizzazione dei turni lavoro primario
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonthIndex, setViewMonthIndex] = useState(() => new Date().getMonth());

  const viewMonthStr = `${viewYear}-${String(viewMonthIndex + 1).padStart(2, '0')}`;

  const handlePrevViewMonth = () => {
    if (viewMonthIndex === 0) {
      setViewMonthIndex(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonthIndex((m) => m - 1);
    }
  };

  const handleNextViewMonth = () => {
    if (viewMonthIndex === 11) {
      setViewMonthIndex(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonthIndex((m) => m + 1);
    }
  };

  const handleResetToCurrentMonth = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonthIndex(now.getMonth());
  };

  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(
    2,
    '0'
  )}`;
  const hoursMap = getOperatorAccumulatedHours(staff, bookings, currentMonthStr);

  const handleDelete = (member: StaffMember) => {
    if (
      window.confirm(
        `Sei sicuro di voler eliminare l'operatore ${member.nome} ${member.cognome}?`
      )
    ) {
      deleteStaff(member.id);
    }
  };

  const handleOpenSchedulePrint = (operatorId: string | null = null) => {
    setSelectedOperatorForSchedule(operatorId);
    setIsScheduleModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Operatori & Insegnanti</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {staff.length} Registrati
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Registra operatori di sala e insegnanti. Imposta i turni del lavoro primario di ciascuno:
            la disponibilità per la sala prove è calcolata come <strong>24 ore del giorno MENO i turni del lavoro primario</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {onNavigateToTurni && (
            <button
              onClick={onNavigateToTurni}
              className="px-4 py-2.5 min-h-[44px] bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 touch-manipulation touch-active cursor-pointer"
              title="Apri pannello completo pianificazione turni presidio sala"
            >
              <Clock className="w-4 h-4" />
              <span>Pannello Turni Presidio</span>
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsMonthlyPdfModalOpen(true)}
              className="px-4 py-2.5 min-h-[44px] bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-300 font-bold text-xs rounded-xl border border-yellow-500/40 shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation touch-active"
              title="Esporta o stampa la tabella schematica turni del mese (1 pagina orizzontale)"
            >
              <Printer className="w-4 h-4 text-yellow-400" />
              <span>Stampa PDF Mese (1 Pagina)</span>
            </button>
          )}

          <button
            onClick={() => handleOpenSchedulePrint(null)}
            className="px-4 py-2.5 min-h-[44px] bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 shadow-2xs transition-all flex items-center justify-center gap-2 touch-manipulation touch-active cursor-pointer"
            title="Esporta o stampa il catalogo completo degli appuntamenti per tutti gli operatori"
          >
            <Printer className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">Stampa / PDF Appuntamenti</span>
          </button>

          <button
            onClick={() => {
              setStaffToEdit(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 shrink-0 touch-manipulation touch-active cursor-pointer ml-auto sm:ml-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nuovo Operatore</span>
          </button>
        </div>
      </div>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {staff.map((member) => {
          const assignedHoursMonth = hoursMap[member.id] || 0;

          return (
            <div
              key={member.id}
              className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 hover:border-slate-300 transition-colors"
            >
              {/* Header card */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base text-white shadow-2xs shrink-0"
                    style={{ backgroundColor: member.coloreBadge }}
                  >
                    {member.nome[0]}
                    {member.cognome[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-base">
                        {member.nome} {member.cognome}
                      </h3>
                      {!member.attivo && (
                        <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded font-semibold">
                          Non attivo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                          member.ruolo === 'entrambi'
                            ? 'bg-indigo-50 border-indigo-100 text-indigo-800'
                            : member.ruolo === 'operatore'
                            ? 'bg-slate-100 border-slate-200 text-slate-800'
                            : 'bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        {member.ruolo === 'entrambi'
                          ? 'Operatore & Insegnante'
                          : member.ruolo === 'operatore'
                          ? 'Operatore di Sala'
                          : 'Insegnante / Docente'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions (44px touch targets on mobile) */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleOpenSchedulePrint(member.id)}
                    className="w-11 h-11 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-indigo-600 flex items-center justify-center transition-all touch-manipulation touch-active"
                    title={`Stampa / PDF lista appuntamenti di ${member.nome} ${member.cognome}`}
                    aria-label="Stampa appuntamenti"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setStaffToEdit(member);
                      setIsModalOpen(true);
                    }}
                    className="w-11 h-11 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all touch-manipulation touch-active"
                    title="Modifica"
                    aria-label="Modifica"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(member)}
                    className="w-11 h-11 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center transition-all touch-manipulation touch-active"
                    title="Elimina"
                    aria-label="Elimina"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Contacts & Subjects */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                {member.telefono && (
                  <a
                    href={`tel:${member.telefono}`}
                    className="flex items-center gap-2 py-1 text-slate-700 hover:text-indigo-600 transition-colors touch-manipulation"
                    title="Chiama da smartphone"
                  >
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-semibold underline decoration-slate-300">{member.telefono}</span>
                  </a>
                )}
                {member.email && (
                  <a
                    href={`mailto:${member.email}`}
                    className="flex items-center gap-2 py-1 truncate text-slate-700 hover:text-indigo-600 transition-colors touch-manipulation"
                    title="Invia email"
                  >
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate underline decoration-slate-300">{member.email}</span>
                  </a>
                )}
                {member.materieInsegnamento && (
                  <div className="sm:col-span-2 flex items-center gap-2 text-indigo-900 font-medium">
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Insegna: {member.materieInsegnamento}</span>
                  </div>
                )}
              </div>

              {/* Turni Lavoro Primario & Disponibilità - Visualizzazione Mese in Mese */}
              {(() => {
                const memberMonthEntries = (member.indisponibilitaDate || []).filter((d) =>
                  d.data.startsWith(viewMonthStr)
                );

                // Raggruppa per data per supportare più indisponibilità nello stesso giorno
                const entriesByDate: Record<string, typeof memberMonthEntries> = {};
                memberMonthEntries.forEach((entry) => {
                  if (!entriesByDate[entry.data]) entriesByDate[entry.data] = [];
                  entriesByDate[entry.data].push(entry);
                });
                const sortedDates = Object.keys(entriesByDate).sort();

                const countVacationMonth = new Set(
                  memberMonthEntries.filter((d) => d.indisponibileTotale).map((d) => d.data)
                ).size;
                const countCustomHoursMonth = new Set(
                  memberMonthEntries.filter((d) => !d.indisponibileTotale && d.oraInizio).map((d) => d.data)
                ).size;

                return (
                  <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                    {/* Header con Navigatore Mese in Mese & Tasto Inserimento Rapido */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200/80">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-indigo-600" />
                        <span className="font-bold text-slate-900">
                          Turni Lavoro Primario &amp; Indisponibilità
                        </span>
                      </div>

                      {/* Navigatore Mese in Mese */}
                      <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
                        <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs">
                          <button
                            type="button"
                            onClick={handlePrevViewMonth}
                            className="p-1 hover:bg-slate-100 rounded text-slate-700 transition-colors cursor-pointer"
                            title="Mese precedente"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2 font-black text-slate-900 text-xs uppercase tracking-wide min-w-[120px] text-center">
                            {MESI_ITALIANI[viewMonthIndex]} {viewYear}
                          </span>
                          <button
                            type="button"
                            onClick={handleNextViewMonth}
                            className="p-1 hover:bg-slate-100 rounded text-slate-700 transition-colors cursor-pointer"
                            title="Mese successivo"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDateForEditor(undefined);
                            setSelectedOperatorForMonthlyCalendar(member);
                          }}
                          className="px-3 py-1.5 min-h-[36px] rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer touch-manipulation"
                          title={`Apri calendario ed inserimento rapido per ${member.nome}`}
                        >
                          <Calendar className="w-3.5 h-3.5 text-black" />
                          <span>Calendario Mese &amp; Ferie</span>
                        </button>
                      </div>
                    </div>

                    {/* Badge di riepilogo del mese visualizzato */}
                    {sortedDates.length > 0 && (
                      <div className="p-2 rounded-lg bg-yellow-400/10 border border-yellow-500/25 flex items-center justify-between text-[11px] text-slate-800 gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-700">Mese Attivo:</span>
                          {countVacationMonth > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-bold flex items-center gap-1">
                              <Palmtree className="w-3 h-3 text-rose-600" />
                              {countVacationMonth} gg Ferie/Riposo
                            </span>
                          )}
                          {countCustomHoursMonth > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3 text-blue-600" />
                              {countCustomHoursMonth} gg con turni primari
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 italic">
                          Priorità su autoassegnazione
                        </span>
                      </div>
                    )}

                    {/* Elenco dei giorni del mese con le relative indisponibilità/turni */}
                    {sortedDates.length > 0 ? (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {sortedDates.map((dateStr) => {
                            const entries = entriesByDate[dateStr];
                            const isTot = entries.some((e) => e.indisponibileTotale);
                            const totEntry = entries.find((e) => e.indisponibileTotale);
                            const slots = entries.filter((e) => !e.indisponibileTotale && e.oraInizio && e.oraFine);

                            const [y, m, d] = dateStr.split('-').map(Number);
                            const dt = new Date(y, m - 1, d);
                            const dayName = GIORNI_CALENDARIO.find((g) => g.index === dt.getDay())?.short || 'Giorno';

                            return (
                              <div
                                key={dateStr}
                                onClick={() => {
                                  setSelectedDateForEditor(dateStr);
                                  setSelectedOperatorForMonthlyCalendar(member);
                                }}
                                className={`flex flex-col justify-between p-2.5 rounded-lg border shadow-2xs cursor-pointer transition-all hover:border-slate-400 ${
                                  isTot
                                    ? 'bg-rose-50/70 border-rose-200'
                                    : slots.length > 1
                                    ? 'bg-blue-50/70 border-blue-200'
                                    : 'bg-white border-slate-200'
                                }`}
                                title="Clicca per modificare questo giorno"
                              >
                                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                                  <span className="font-bold text-slate-900">
                                    {dayName} {d} {MESI_ITALIANI[m - 1].slice(0, 3)}
                                  </span>
                                  {isTot ? (
                                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded">
                                      Ferie/Off
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded font-mono">
                                      {slots.length} {slots.length === 1 ? 'fascia' : 'fasce'}
                                    </span>
                                  )}
                                </div>

                                <div className="pt-1.5 space-y-1">
                                  {isTot ? (
                                    <p className="text-[11px] font-bold text-rose-800 flex items-center gap-1">
                                      <Palmtree className="w-3.5 h-3.5 text-rose-600" />
                                      {totEntry?.motivo || 'Indisponibile tutto il giorno'}
                                    </p>
                                  ) : (
                                    slots.map((s, idx) => (
                                      <div key={idx} className="flex items-center justify-between text-[11px] font-mono font-medium text-slate-700">
                                        <span className="flex items-center gap-1">
                                          <Clock className="w-3 h-3 text-slate-400" />
                                          {s.oraInizio} - {s.oraFine}
                                        </span>
                                        {s.motivo && (
                                          <span className="text-[10px] text-slate-500 font-sans italic truncate max-w-[120px]">
                                            {s.motivo}
                                          </span>
                                        )}
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      /* Se non ci sono eccezioni per il mese visualizzato, mostra fallback e azione rapida */
                      <div className="space-y-2 py-1">
                        <div className="p-3 bg-white rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <p className="text-slate-600 text-xs">
                            Nessun turno specifico o ferie registrati per <strong>{MESI_ITALIANI[viewMonthIndex]} {viewYear}</strong>.
                            {member.turniLavoroPrimario.length > 0
                              ? ' Sono attivi gli orari settimanali standard.'
                              : ' L\'operatore è libero 24h.'}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDateForEditor(undefined);
                              setSelectedOperatorForMonthlyCalendar(member);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-bold shrink-0 flex items-center justify-center gap-1 shadow-2xs transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Imposta Turni o Ferie per {MESI_ITALIANI[viewMonthIndex].slice(0, 3)}</span>
                          </button>
                        </div>

                        {/* Visualizza gli orari settimanali standard ricorsivi se presenti */}
                        {member.turniLavoroPrimario.length > 0 && (
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              Orario Standard Settimanale (Ripetuto ogni settimana):
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                              {member.turniLavoroPrimario.map((shift) => {
                                const day = GIORNI_CALENDARIO.find((g) => g.index === shift.giornoSettimana);
                                return (
                                  <div
                                    key={shift.id}
                                    className="flex items-center justify-between p-1.5 px-2 bg-white rounded border border-slate-200 text-[11px]"
                                  >
                                    <span className="font-semibold text-slate-800">{day?.short || 'Giorno'}</span>
                                    <span className="font-mono text-slate-600">{shift.oraInizio}-{shift.oraFine}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Monthly Stats & Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500">Mese corrente:</span>
                  <strong className="text-slate-900 font-bold font-mono text-sm">{assignedHoursMonth} ore</strong>
                  {member.tariffaOrariaRimborso && (
                    <span className="text-emerald-700 font-bold font-mono">
                      (€{assignedHoursMonth * member.tariffaOrariaRimborso})
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleOpenSchedulePrint(member.id)}
                  className="px-3 py-2 min-h-[44px] rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs border border-indigo-200/80 flex items-center justify-center gap-2 transition-all ml-auto shadow-2xs touch-manipulation touch-active"
                  title={`Esporta o stampa foglio appuntamenti per ${member.nome}`}
                >
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                  <span>Foglio Appuntamenti</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <React.Suspense fallback={null}>
          <StaffModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            staffToEdit={staffToEdit}
          />
        </React.Suspense>
      )}

      {isScheduleModalOpen && (
        <React.Suspense fallback={null}>
          <OperatorSchedulePrintModal
            isOpen={isScheduleModalOpen}
            onClose={() => setIsScheduleModalOpen(false)}
            initialOperatorId={selectedOperatorForSchedule}
            onOpenMonthlyShiftsPdf={isAdmin ? () => setIsMonthlyPdfModalOpen(true) : undefined}
          />
        </React.Suspense>
      )}

      {selectedOperatorForMonthlyCalendar && (
        <React.Suspense fallback={null}>
          <OperatorMonthlyScheduleModal
            isOpen={!!selectedOperatorForMonthlyCalendar}
            onClose={() => {
              setSelectedOperatorForMonthlyCalendar(null);
              setSelectedDateForEditor(undefined);
            }}
            operator={selectedOperatorForMonthlyCalendar}
            initialYear={viewYear}
            initialMonthIndex={viewMonthIndex}
            initialDateStr={selectedDateForEditor}
          />
        </React.Suspense>
      )}

      {isAdmin && isMonthlyPdfModalOpen && (
        <React.Suspense fallback={null}>
          <MonthlyShiftsPdfModal
            isOpen={isMonthlyPdfModalOpen}
            onClose={() => setIsMonthlyPdfModalOpen(false)}
          />
        </React.Suspense>
      )}
    </div>
  );
};
