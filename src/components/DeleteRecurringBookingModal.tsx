import React from 'react';
import {
  Calendar,
  CalendarClock,
  Trash2,
  X,
  AlertTriangle,
  History,
  DoorOpen,
  Clock,
  Layers,
} from 'lucide-react';
import { Booking, DeleteRecurringMode } from '../types';
import { formatDateItalian } from '../utils/dateUtils';
import { useTheme } from '../context/ThemeContext';

interface DeleteRecurringBookingModalProps {
  isOpen: boolean;
  booking: Booking | null;
  roomName?: string;
  onClose: () => void;
  onConfirm: (mode: DeleteRecurringMode) => void;
}

export const DeleteRecurringBookingModal: React.FC<DeleteRecurringBookingModalProps> = ({
  isOpen,
  booking,
  roomName,
  onClose,
  onConfirm,
}) => {
  const { isDark } = useTheme();

  if (!isOpen || !booking) return null;

  const dateFormatted = formatDateItalian(booking.data, true);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden animate-in zoom-in-95 duration-150 ${
          isDark
            ? 'bg-neutral-950 border-yellow-500/30 text-yellow-50 shadow-yellow-500/10'
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-900/20'
        }`}
        style={!isDark ? { backgroundColor: '#ffffff', color: '#0f172a' } : undefined}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between gap-3 ${
            isDark
              ? 'bg-neutral-900/90 border-yellow-500/20'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
              <CalendarClock className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold tracking-tight">
                Elimina Prenotazione Ricorrente
              </h3>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                Evento con ripetizione settimanale
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
            title="Chiudi"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Card Info Prenotazione Selezionata */}
          <div
            className={`p-3.5 rounded-xl border space-y-1.5 ${
              isDark
                ? 'bg-neutral-900/60 border-neutral-800'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black truncate text-blue-600 dark:text-yellow-400">
                {booking.clienteNome}
              </span>
              {booking.tipo === 'lezione' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                  Lezione
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-neutral-300">
              <span className="flex items-center gap-1 font-semibold">
                <Calendar className="w-3.5 h-3.5 text-blue-500 dark:text-yellow-400" />
                {dateFormatted}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {booking.oraInizio} - {booking.oraFine}
              </span>
              {roomName && (
                <span className="flex items-center gap-1">
                  <DoorOpen className="w-3.5 h-3.5 text-slate-400" />
                  {roomName}
                </span>
              )}
            </div>
          </div>

          <p className="text-xs font-bold text-slate-700 dark:text-neutral-200">
            Come desideri procedere con l&apos;eliminazione?
          </p>

          {/* Opzioni di eliminazione */}
          <div className="space-y-2.5">
            {/* Opzione 1: Solo questo evento */}
            <button
              type="button"
              onClick={() => onConfirm('single')}
              className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 group ${
                isDark
                  ? 'bg-neutral-900/80 hover:bg-neutral-850 border-neutral-800 hover:border-yellow-500/40'
                  : 'bg-white hover:bg-blue-50/50 border-slate-200 hover:border-blue-400'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                  isDark
                    ? 'bg-neutral-800 border-neutral-700 text-yellow-400 group-hover:bg-yellow-400/20'
                    : 'bg-blue-50 border-blue-200 text-blue-600 group-hover:bg-blue-100'
                }`}
              >
                <Calendar className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-yellow-400 transition-colors">
                    Solo questo evento selezionato
                  </h4>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">1 evento</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                  Elimina esclusivamente la data di <strong className="text-slate-700 dark:text-neutral-200">{dateFormatted}</strong>. Tutte le altre settimane della serie rimangono confermate.
                </p>
              </div>
            </button>

            {/* Opzione 2: Questo e tutti i futuri */}
            <button
              type="button"
              onClick={() => onConfirm('future')}
              className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 group relative ${
                isDark
                  ? 'bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/40 hover:border-amber-400'
                  : 'bg-amber-50/70 hover:bg-amber-100/60 border-amber-300 hover:border-amber-400'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                  isDark
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-amber-100 border-amber-300 text-amber-700'
                }`}
              >
                <CalendarClock className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <span>Da questo evento e tutti i futuri ripetuti</span>
                  </h4>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300">
                    Consigliato
                  </span>
                </div>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5 leading-relaxed">
                  Interrompe la serie ricorrente a partire dal <strong className="font-semibold text-amber-950 dark:text-amber-100">{dateFormatted}</strong>. Le prenotazioni passate precedenti vengono mantenute nello storico.
                </p>
              </div>
            </button>

            {/* Opzione 3: Tutta la serie (Opzionale completa) */}
            <button
              type="button"
              onClick={() => onConfirm('all')}
              className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-rose-600 dark:text-rose-400 opacity-80 hover:opacity-100 ${
                isDark
                  ? 'bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/20 hover:border-rose-500/40'
                  : 'bg-rose-50/40 hover:bg-rose-50 border-rose-200 hover:border-rose-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Trash2 className="w-4 h-4 shrink-0" />
                <span className="text-xs font-bold">
                  Elimina l&apos;intera serie completa (compresi gli eventi passati)
                </span>
              </div>
              <span className="text-[10px] font-bold opacity-75">Tutti</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`px-5 py-3 border-t flex items-center justify-end ${
            isDark ? 'bg-neutral-900/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-800 transition-all cursor-pointer"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
};
