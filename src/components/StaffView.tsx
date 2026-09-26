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
  Sparkles,
  Printer,
  FileSpreadsheet,
  Palmtree,
  CalendarCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { StaffMember } from '../types';
import { GIORNI_CALENDARIO } from '../utils/dateUtils';
import { getOperatorAccumulatedHours } from '../utils/scheduler';
import { StaffModal } from './StaffModal';
import { OperatorSchedulePrintModal } from './OperatorSchedulePrintModal';
import { OperatorMonthlyScheduleModal } from './OperatorMonthlyScheduleModal';
import { MonthlyShiftsPdfModal } from './MonthlyShiftsPdfModal';

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
              className="px-3.5 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center gap-2"
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
              className="px-3.5 py-2 bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-300 font-bold text-xs rounded-lg border border-yellow-500/40 shadow-2xs transition-colors flex items-center gap-2 cursor-pointer"
              title="Esporta o stampa la tabella schematica turni del mese (1 pagina orizzontale)"
            >
              <Printer className="w-4 h-4 text-yellow-400" />
              <span>Stampa PDF Mese (1 Pagina)</span>
            </button>
          )}

          <button
            onClick={() => handleOpenSchedulePrint(null)}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg border border-slate-300 shadow-2xs transition-colors flex items-center gap-2"
            title="Esporta o stampa il catalogo completo degli appuntamenti per tutti gli operatori"
          >
            <Printer className="w-4 h-4 text-indigo-600" />
            <span>Stampa / PDF Appuntamenti</span>
          </button>

          <button
            onClick={() => {
              setStaffToEdit(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nuovo Operatore / Insegnante</span>
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
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-11 h-11 rounded-lg flex items-center justify-center font-bold text-base text-white shadow-2xs"
                    style={{ backgroundColor: member.coloreBadge }}
                  >
                    {member.nome[0]}
                    {member.cognome[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 text-base">
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

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenSchedulePrint(member.id)}
                    className="p-1.5 text-indigo-600 hover:text-indigo-800 rounded-md hover:bg-indigo-50 transition-colors"
                    title={`Stampa / PDF lista appuntamenti di ${member.nome} ${member.cognome}`}
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setStaffToEdit(member);
                      setIsModalOpen(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
                    title="Modifica"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(member)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 rounded-md hover:bg-rose-50 transition-colors"
                    title="Elimina"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Contacts & Subjects */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                {member.telefono && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{member.telefono}</span>
                  </div>
                )}
                {member.email && (
                  <div className="flex items-center gap-2 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{member.email}</span>
                  </div>
                )}
                {member.materieInsegnamento && (
                  <div className="sm:col-span-2 flex items-center gap-2 text-indigo-900 font-medium">
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Insegna: {member.materieInsegnamento}</span>
                  </div>
                )}
              </div>

              {/* Turni Lavoro Primario & Disponibilità Residua 24h */}
              {(() => {
                const memberMonthExceptions = (member.indisponibilitaDate || []).filter((d) =>
                  d.data.startsWith(currentMonthStr)
                );
                const countVacationMonth = memberMonthExceptions.filter((d) => d.indisponibileTotale).length;
                const countCustomHoursMonth = memberMonthExceptions.filter((d) => !d.indisponibileTotale && d.oraInizio).length;

                return (
                  <div className="space-y-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                        Turni Lavoro Primario & Indisponibilità
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedOperatorForMonthlyCalendar(member)}
                        className="px-2.5 py-1 rounded-md bg-yellow-400 hover:bg-yellow-300 text-black text-[11px] font-black flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                        title={`Apri calendario mensile completo per ${member.nome}`}
                      >
                        <Calendar className="w-3.5 h-3.5 text-black" />
                        <span>Calendario Mese & Ferie</span>
                      </button>
                    </div>

                    {/* Badge calendario mensile attivo se ci sono eccezioni nel mese corrente */}
                    {memberMonthExceptions.length > 0 && (
                      <div className="p-2 rounded-md bg-yellow-400/10 border border-yellow-500/30 flex items-center justify-between text-[11px] text-yellow-300 gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-yellow-200">Mese Attivo:</span>
                          {countVacationMonth > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold flex items-center gap-1">
                              <Palmtree className="w-3 h-3" />
                              {countVacationMonth} gg Ferie/Riposo
                            </span>
                          )}
                          {countCustomHoursMonth > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {countCustomHoursMonth} turni spec.
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-neutral-400 italic">
                          Priorità su autoassegnazione
                        </span>
                      </div>
                    )}

                    {member.turniLavoroPrimario.length === 0 ? (
                      <p className="text-slate-500 italic py-1">
                        Nessun turno di lavoro primario fisso settimanale. (Disponibilità gestita da calendario mensile o libero 24h).
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                        {member.turniLavoroPrimario.map((shift) => {
                          const day = GIORNI_CALENDARIO.find((g) => g.index === shift.giornoSettimana);
                          return (
                            <div
                              key={shift.id}
                              className="flex items-center justify-between p-2 bg-white rounded-md border border-slate-200 shadow-2xs"
                            >
                              <span className="font-semibold text-slate-900">{day?.short || 'Giorno'}</span>
                              <span className="font-mono font-medium text-slate-700 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {shift.oraInizio} - {shift.oraFine}
                              </span>
                            </div>
                          );
                        })}
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
                  <strong className="text-slate-900 font-bold font-mono">{assignedHoursMonth} ore</strong>
                  {member.tariffaOrariaRimborso && (
                    <span className="text-emerald-700 font-bold font-mono">
                      (€{assignedHoursMonth * member.tariffaOrariaRimborso})
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleOpenSchedulePrint(member.id)}
                  className="px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px] border border-indigo-200/80 flex items-center gap-1.5 transition-colors ml-auto shadow-2xs"
                  title={`Esporta o stampa foglio appuntamenti per ${member.nome}`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Lista Appuntamenti</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <StaffModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        staffToEdit={staffToEdit}
      />

      <OperatorSchedulePrintModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        initialOperatorId={selectedOperatorForSchedule}
        onOpenMonthlyShiftsPdf={isAdmin ? () => setIsMonthlyPdfModalOpen(true) : undefined}
      />

      <OperatorMonthlyScheduleModal
        isOpen={!!selectedOperatorForMonthlyCalendar}
        onClose={() => setSelectedOperatorForMonthlyCalendar(null)}
        operator={selectedOperatorForMonthlyCalendar}
      />

      {isAdmin && (
        <MonthlyShiftsPdfModal
          isOpen={isMonthlyPdfModalOpen}
          onClose={() => setIsMonthlyPdfModalOpen(false)}
        />
      )}
    </div>
  );
};
