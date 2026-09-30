import React, { useState } from 'react';
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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DailyShiftComputed, WorkShift } from '../types';
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

  if (!isOpen || !shiftComputed) return null;

  const [selectedOpId, setSelectedOpId] = useState<string>(shiftComputed.operatoreId || '');
  const [syncToBookings, setSyncToBookings] = useState<boolean>(true);
  const [note, setNote] = useState<string>(shiftComputed.note || '');
  const [isCustomHours, setIsCustomHours] = useState<boolean>(shiftComputed.isCustomHours || false);
  const [customStart, setCustomStart] = useState<string>(shiftComputed.oraInizio);
  const [customEnd, setCustomEnd] = useState<string>(shiftComputed.oraFine);

  const activeStaff = staff.filter(
    (s) => s.attivo && (s.ruolo === 'operatore' || s.ruolo === 'entrambi')
  );

  const dayBookings = bookings.filter((b) => b.data === shiftComputed.data);

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

  const handleSave = () => {
    if (isCustomHours) {
      const existing = shifts.find(
        (s) => s.data === shiftComputed.data && s.turnoNumero === shiftComputed.turnoNumero
      );
      const op = selectedOpId ? staff.find((st) => st.id === selectedOpId) : undefined;
      const shiftObj: WorkShift = {
        id: existing?.id || `shift-${shiftComputed.data}-${shiftComputed.turnoNumero}`,
        data: shiftComputed.data,
        turnoNumero: shiftComputed.turnoNumero,
        nomeTurno: shiftComputed.nomeTurno,
        oraInizioBase: shiftComputed.oraInizioBase,
        oraFineBase: shiftComputed.oraFineBase,
        oraInizioEffettiva: customStart,
        oraFineEffettiva: customEnd,
        operatoreId: selectedOpId || undefined,
        operatoreNome: op ? `${op.nome} ${op.cognome}` : undefined,
        note,
        isCustomHours: true,
      };
      updateShift(shiftObj);
    } else {
      assignOperatorToShift(
        shiftComputed.data,
        shiftComputed.turnoNumero,
        selectedOpId || undefined,
        syncToBookings
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
    assignOperatorToShift(
      shiftComputed.data,
      shiftComputed.turnoNumero,
      undefined,
      false
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0e0e0e] rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-yellow-500/30 space-y-4 max-h-[92vh] overflow-y-auto text-white">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-yellow-500/20 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-400 text-black flex items-center justify-center font-black shadow-md text-sm">
              T{shiftComputed.turnoNumero}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-yellow-100 text-base sm:text-lg">
                  {shiftComputed.nomeTurno}
                </h3>
                {shiftComputed.isAdapted && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    +{shiftComputed.minutiExtra}m Dinamici
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 capitalize mt-0.5 flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-yellow-400/70" />
                {dateFormatted}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-yellow-400 p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
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

          {/* Toggle personalizzazione manuale */}
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

        {/* Selezione Operatore */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-yellow-300 uppercase tracking-wider">
            Operatore Assegnato al Presidio Sala:
          </label>

          <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto pr-1">
            {activeStaff.map((op) => {
              const avail = checkOperatorShiftAvailability(
                op,
                shiftComputed.data,
                shiftComputed.oraInizio,
                shiftComputed.oraFine
              );
              const isSelected = selectedOpId === op.id;

              return (
                <div
                  key={op.id}
                  onClick={() => setSelectedOpId(op.id)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-yellow-400/15 border-yellow-400 shadow-sm ring-1 ring-yellow-400/40'
                      : 'bg-neutral-950 hover:bg-neutral-900 border-yellow-500/20'
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
                      <p className="text-xs font-semibold text-yellow-100 truncate">
                        {op.nome} {op.cognome}
                      </p>
                      <p className="text-[10px] text-neutral-400">
                        {avail.isAvailable ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Disponibile per sala
                          </span>
                        ) : (
                          <span className="text-amber-400 flex items-center gap-1 font-medium truncate" title={avail.conflictReason}>
                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                            {avail.conflictReason || 'Lavoro primario'}
                          </span>
                        )}
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
              <strong>Assegna automaticamente l'operatore</strong> anche a tutte le prenotazioni ({dayBookings.length} attive oggi) che rientrano in questa fascia oraria.
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
          {shiftComputed.operatoreId && (
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
