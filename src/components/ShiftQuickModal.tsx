import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Calendar,
  Save,
  Trash2,
  X,
  SlidersHorizontal,
  PenLine,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DailyShiftComputed, WorkShift, isLessonBooking } from '../types';
import { checkOperatorShiftAvailability } from '../utils/shiftUtils';

interface ShiftQuickModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftComputed: DailyShiftComputed | null;
}

export const ShiftQuickModal: React.FC<ShiftQuickModalProps> = ({
  isOpen,
  onClose,
  shiftComputed,
}) => {
  const { staff, bookings, assignOperatorToShift, updateShift, shifts } = useApp();

  const [selectedOpId, setSelectedOpId] = useState<string>('');
  const [manualOperatorName, setManualOperatorName] = useState<string>('');
  const [syncToBookings, setSyncToBookings] = useState<boolean>(true);
  const [note, setNote] = useState<string>('');
  const [isCustomHours, setIsCustomHours] = useState<boolean>(false);
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const activeStaff = useMemo(
    () => staff.filter((s) => s.attivo && (s.ruolo === 'operatore' || s.ruolo === 'entrambi')),
    [staff]
  );

  const dayBookings = useMemo(
    () => (shiftComputed ? bookings.filter((b) => b.data === shiftComputed.data && !isLessonBooking(b)) : []),
    [bookings, shiftComputed]
  );

  // Calcolo disponibilità operatori per la fascia oraria di questo turno
  const staffAvailability = useMemo(() => {
    if (!shiftComputed) return [];
    return activeStaff.map((op) => {
      const avail = checkOperatorShiftAvailability(
        op,
        shiftComputed.data,
        shiftComputed.oraInizio,
        shiftComputed.oraFine
      );
      return { op, avail };
    });
  }, [activeStaff, shiftComputed]);

  // Suddivisione tra operatori disponibili e con conflitti
  const availableStaff = useMemo(
    () => staffAvailability.filter((item) => item.avail.isAvailable),
    [staffAvailability]
  );

  const busyStaff = useMemo(
    () => staffAvailability.filter((item) => !item.avail.isAvailable),
    [staffAvailability]
  );

  // Inizializzazione o pre-selezione automatica all'apertura del modale
  useEffect(() => {
    if (!isOpen || !shiftComputed) return;

    setNote(shiftComputed.note || '');
    setIsCustomHours(shiftComputed.isCustomHours || false);
    setCustomStart(shiftComputed.oraInizio);
    setCustomEnd(shiftComputed.oraFine);
    setSyncToBookings(true);

    const currentOpId = shiftComputed.operatoreId;
    const currentOpName = shiftComputed.operatoreNome;

    // Se l'operatore fa parte dello staff registrato
    if (currentOpId && activeStaff.some((s) => s.id === currentOpId)) {
      setSelectedOpId(currentOpId);
      setManualOperatorName('');
    } else if (currentOpName && currentOpName !== 'DA ASSEGNARE') {
      // Inserito in precedenza a mano
      setSelectedOpId('');
      setManualOperatorName(currentOpName);
    } else {
      // Turno NON assegnato ("DA ASSEGNARE"):
      // Pre-seleziona automaticamente il primo operatore disponibile per questo orario!
      setManualOperatorName('');
      if (availableStaff.length > 0) {
        setSelectedOpId(availableStaff[0].op.id);
      } else {
        setSelectedOpId('');
      }
    }
  }, [isOpen, shiftComputed, availableStaff, activeStaff]);

  if (!isOpen || !shiftComputed) return null;

  // Formatta data in italiano (es. "Lunedì 30 Marzo 2026")
  const dateFormatted = (() => {
    try {
      const [y, m, d] = shiftComputed.data.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return shiftComputed.data;
    }
  })();

  const handleSelectStaff = (opId: string) => {
    setSelectedOpId(opId);
    setManualOperatorName(''); // Resetta inserimento a mano se si sceglie dallo staff
  };

  const handleManualNameChange = (val: string) => {
    setManualOperatorName(val);
    if (val.trim()) {
      setSelectedOpId(''); // Deseleziona staff se si scrive a mano
    }
  };

  const handleSave = () => {
    const isManualActive = manualOperatorName.trim().length > 0;
    const effectiveOpId = isManualActive ? undefined : (selectedOpId || undefined);
    const customName = isManualActive ? manualOperatorName.trim() : undefined;

    if (isCustomHours) {
      const existing = shifts.find(
        (s) => s.data === shiftComputed.data && s.turnoNumero === shiftComputed.turnoNumero
      );
      const op = effectiveOpId ? staff.find((st) => st.id === effectiveOpId) : undefined;
      const opNome = customName || (op ? `${op.nome} ${op.cognome}` : undefined);

      const shiftObj: WorkShift = {
        id: existing?.id || `shift-${shiftComputed.data}-${shiftComputed.turnoNumero}`,
        data: shiftComputed.data,
        turnoNumero: shiftComputed.turnoNumero,
        nomeTurno: shiftComputed.nomeTurno,
        oraInizioBase: shiftComputed.oraInizioBase,
        oraFineBase: shiftComputed.oraFineBase,
        oraInizioEffettiva: customStart,
        oraFineEffettiva: customEnd,
        operatoreId: effectiveOpId || (customName ? `manual-op-${Date.now()}` : undefined),
        operatoreNome: opNome,
        note,
        isCustomHours: true,
      };
      updateShift(shiftObj);
    } else {
      assignOperatorToShift(
        shiftComputed.data,
        shiftComputed.turnoNumero,
        effectiveOpId,
        syncToBookings,
        customName
      );

      // Aggiorna nota se presente
      if (note !== shiftComputed.note) {
        const existing = shifts.find(
          (s) => s.data === shiftComputed.data && s.turnoNumero === shiftComputed.turnoNumero
        );
        if (existing) {
          updateShift({ ...existing, note, isCustomHours: false });
        }
      }
    }

    onClose();
  };

  const handleClearOperator = () => {
    setSelectedOpId('');
    setManualOperatorName('');
    assignOperatorToShift(
      shiftComputed.data,
      shiftComputed.turnoNumero,
      undefined,
      false
    );
    onClose();
  };

  const isManualActive = manualOperatorName.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0e0e0e] rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-yellow-500/30 space-y-4 max-h-[92vh] overflow-y-auto text-white animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3.5 gap-3 shrink-0">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-500/30 text-yellow-400 flex items-center justify-center font-black shadow-2xs text-sm shrink-0">
              T{shiftComputed.turnoNumero}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-white text-base sm:text-lg tracking-tight leading-snug truncate">
                  {shiftComputed.nomeTurno}
                </h3>
                {shiftComputed.isAdapted && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    +{shiftComputed.minutiExtra}m Dinamici
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 capitalize mt-0.5 flex items-center gap-1.5 truncate">
                <Calendar className="w-3.5 h-3.5 text-yellow-400/70" />
                {dateFormatted}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-header-btn-blue modal-close-btn-blue shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 hover:bg-red-600 active:scale-95 text-white transition-all cursor-pointer border border-blue-500 hover:border-red-500 shadow-md shadow-blue-500/25"
            style={{ backgroundColor: '#2563eb', color: '#ffffff', borderColor: '#1d4ed8' }}
            title="Chiudi"
            aria-label="Chiudi finestra"
          >
            <X className="w-5 h-5 text-white stroke-[2.5]" style={{ color: '#ffffff', stroke: '#ffffff' }} />
          </button>
        </div>

        {/* Orario e Adattamento Dinamico */}
        <div className="bg-neutral-950 rounded-xl p-3.5 border border-yellow-500/20 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-yellow-400" />
              Fascia Oraria Base:
            </span>
            <span className="font-mono text-neutral-300">
              {shiftComputed.oraInizioBase} - {shiftComputed.oraFineBase} (3 ore)
            </span>
          </div>

          <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-900">
            <span className="text-neutral-300 font-semibold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-yellow-400" />
              Orario Effettivo Turno:
            </span>
            <span className="font-mono font-bold text-yellow-400 text-sm">
              {isCustomHours ? `${customStart} - ${customEnd}` : `${shiftComputed.oraInizio} - ${shiftComputed.oraFine}`}
              <span className="text-[11px] font-normal text-neutral-400 ml-1.5">
                ({isCustomHours ? '' : `${shiftComputed.durataOre}h`})
              </span>
            </span>
          </div>

          {shiftComputed.adaptationReason && !isCustomHours && (
            <div className="p-2.5 rounded-lg bg-yellow-400/10 border border-yellow-500/30 text-xs text-yellow-200 flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
              <div className="leading-snug">
                <p className="font-semibold text-yellow-300">Adattamento Dinamico Applicato:</p>
                <p className="text-[11px] text-yellow-200/90 mt-0.5">{shiftComputed.adaptationReason}</p>
              </div>
            </div>
          )}

          {/* Toggle personalizzazione manuale orari */}
          <div className="pt-2 border-t border-neutral-900 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsCustomHours(!isCustomHours)}
              className="text-[11px] text-neutral-400 hover:text-yellow-400 flex items-center gap-1 underline underline-offset-2 transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>{isCustomHours ? 'Ripristina calcolo dinamico automatico' : 'Personalizza orari manualmente'}</span>
            </button>
          </div>

          {isCustomHours && (
            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-neutral-800">
              <div>
                <label className="block text-[10px] text-neutral-400 font-medium mb-1">Inizio Personalizzato:</label>
                <input
                  type="time"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full bg-neutral-900 border border-yellow-500/30 rounded-lg px-2.5 py-1.5 text-xs text-yellow-300 font-mono focus:outline-hidden focus:border-yellow-400"
                />
              </div>
              <div>
                <label className="block text-[10px] text-neutral-400 font-medium mb-1">Fine Personalizzata:</label>
                <input
                  type="time"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full bg-neutral-900 border border-yellow-500/30 rounded-lg px-2.5 py-1.5 text-xs text-yellow-300 font-mono focus:outline-hidden focus:border-yellow-400"
                />
              </div>
            </div>
          )}
        </div>

        {/* Selezione Operatore con Disponibilità Automatica */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-yellow-300 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Operatore Assegnato al Presidio:
            </label>
            {availableStaff.length > 0 && !isManualActive && (
              <span className="text-[10.5px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {availableStaff.length} Disponibil{availableStaff.length === 1 ? 'e' : 'i'}
              </span>
            )}
          </div>

          {/* Lista Operatori con Disponibilità Ordinata */}
          <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
            {/* Sezione Operatori Disponibili */}
            {availableStaff.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400/90 flex items-center gap-1 pl-1">
                  <UserCheck className="w-3 h-3" />
                  Disponibili per questa fascia ({shiftComputed.oraInizio} - {shiftComputed.oraFine}):
                </div>
                {availableStaff.map(({ op }) => {
                  const isSelected = !isManualActive && selectedOpId === op.id;
                  return (
                    <div
                      key={op.id}
                      onClick={() => handleSelectStaff(op.id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-yellow-400/20 border-yellow-400 shadow-md ring-2 ring-yellow-400/50'
                          : 'bg-neutral-950 hover:bg-neutral-900 border-emerald-500/30 hover:border-yellow-400/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs text-black shrink-0 shadow-xs"
                          style={{ backgroundColor: op.coloreBadge }}
                        >
                          {op.nome[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-yellow-100 truncate">
                            {op.nome} {op.cognome}
                          </p>
                          <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Disponibile senza conflitti
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-yellow-400 text-black flex items-center justify-center text-xs font-black shadow-xs">
                            ✓
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sezione Operatori con Conflitti / Altro Lavoro */}
            {busyStaff.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500/80 flex items-center gap-1 pl-1">
                  <UserX className="w-3 h-3" />
                  Altri Operatori (Conflitto / Già impegnati):
                </div>
                {busyStaff.map(({ op, avail }) => {
                  const isSelected = !isManualActive && selectedOpId === op.id;
                  return (
                    <div
                      key={op.id}
                      onClick={() => handleSelectStaff(op.id)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-yellow-400/20 border-yellow-400 shadow-md ring-2 ring-yellow-400/50'
                          : 'bg-neutral-950/70 hover:bg-neutral-900/90 border-neutral-800/80 hover:border-yellow-500/40 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-[11px] text-black shrink-0"
                          style={{ backgroundColor: op.coloreBadge }}
                        >
                          {op.nome[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-neutral-300 truncate">
                            {op.nome} {op.cognome}
                          </p>
                          <p className="text-[9.5px] text-amber-400 flex items-center gap-1 truncate" title={avail.conflictReason}>
                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                            {avail.conflictReason || 'Impegnato in altro turno/attività'}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isSelected && (
                          <span className="w-4 h-4 rounded-full bg-yellow-400 text-black flex items-center justify-center text-[10px] font-bold">
                            ✓
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Inserimento a Mano (Sostituto Esterno / Volontario) */}
          <div className="bg-neutral-950 p-3 rounded-xl border border-yellow-500/30 space-y-1.5">
            <label className="block text-[11px] font-bold text-yellow-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <PenLine className="w-3.5 h-3.5 text-yellow-400" />
                Oppure inserisci nominativo a mano:
              </span>
              {isManualActive && (
                <span className="text-[9.5px] font-bold text-yellow-400 bg-yellow-400/20 px-1.5 py-0.2 rounded border border-yellow-500/40">
                  A mano attivo
                </span>
              )}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={manualOperatorName}
                onChange={(e) => handleManualNameChange(e.target.value)}
                placeholder="Es. Mario Rossi (Sostituto), Tecnico esterno..."
                className="flex-1 bg-neutral-900 border border-yellow-500/40 focus:border-yellow-400 rounded-lg px-3 py-1.5 text-xs text-yellow-100 placeholder-neutral-500 focus:outline-hidden"
              />
              {manualOperatorName && (
                <button
                  type="button"
                  onClick={() => setManualOperatorName('')}
                  className="px-2 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
                  title="Azzera nome a mano"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {isManualActive ? (
              <p className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                Verrà assegnato il nominativo inserito a mano: <strong>{manualOperatorName.trim()}</strong>
              </p>
            ) : (
              <p className="text-[9.5px] text-neutral-500">
                Puoi digitare liberamente qualsiasi nome o sostituto esterno qualora non sia in lista.
              </p>
            )}
          </div>
        </div>

        {/* Opzione sincronizzazione con prenotazioni */}
        <div className="bg-neutral-950 p-3 rounded-xl border border-yellow-500/20 space-y-2 text-xs">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={syncToBookings}
              onChange={(e) => setSyncToBookings(e.target.checked)}
              className="mt-0.5 rounded text-yellow-400 focus:ring-yellow-400 w-4 h-4 border-neutral-700 bg-neutral-900 cursor-pointer"
            />
            <span className="text-neutral-300 leading-tight">
              <strong>Assegna automaticamente l'operatore</strong> anche a tutte le prove musicali ({dayBookings.length} attive oggi) che rientrano in questa fascia oraria (le lezioni non richiedono presidio).
            </span>
          </label>
        </div>

        {/* Note Turno */}
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-neutral-400">
            Note o Istruzioni per il Turno:
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Es. Verificare backline, consegna chiavi, incasso contanti..."
            className="w-full bg-neutral-950 border border-yellow-500/25 rounded-lg px-3 py-2 text-xs text-yellow-100 placeholder-neutral-600 focus:outline-hidden focus:border-yellow-400"
          />
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-yellow-500/20 flex-wrap">
          {(shiftComputed.operatoreId || shiftComputed.operatoreNome) && (
            <button
              type="button"
              onClick={handleClearOperator}
              className="px-3 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Rimuovi Operatore</span>
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-yellow-500/30 text-neutral-300 text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salva Turno</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
