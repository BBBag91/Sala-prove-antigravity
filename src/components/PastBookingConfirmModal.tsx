import React from 'react';
import { AlertTriangle, Clock, Calendar, DoorOpen, User, X } from 'lucide-react';
import { formatDateItalian } from '../utils/dateUtils';
import { useTheme } from '../context/ThemeContext';

interface PastBookingConfirmModalProps {
  isOpen: boolean;
  date: string;
  startTime: string;
  endTime: string;
  roomName?: string;
  clientName?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export const PastBookingConfirmModal: React.FC<PastBookingConfirmModalProps> = ({
  isOpen,
  date,
  startTime,
  endTime,
  roomName,
  clientName,
  onClose,
  onConfirm,
}) => {
  const { isDark } = useTheme();

  if (!isOpen) return null;

  const dateFormatted = date ? formatDateItalian(date, true) : '';

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden animate-in zoom-in-95 duration-150 ${
          isDark
            ? 'bg-neutral-950 border-yellow-500/30 text-yellow-50 shadow-yellow-500/10'
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-900/20'
        }`}
        style={!isDark ? { backgroundColor: '#ffffff', color: '#0f172a' } : undefined}
      >
        {/* Header unificato con colori e stili standard di tutti i modal */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/90 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-yellow-400/10 border border-blue-200/80 dark:border-yellow-500/30 flex items-center justify-center text-blue-600 dark:text-yellow-400 shrink-0 shadow-2xs">
              <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-snug truncate">
                Controllo Data Prenotazione
              </h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400 font-normal truncate mt-0.5">
                Rilevata data o orario nel passato
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

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="space-y-1.5 text-left">
            <p className="text-base font-extrabold text-slate-900 dark:text-white">
              Sei sicuro di voler prenotare nel passato?
            </p>
            <p className="text-xs text-slate-600 dark:text-neutral-400 leading-relaxed">
              Stai registrando un evento per una data o fascia oraria che risulta già trascorsa rispetto al momento attuale.
            </p>
          </div>

          {/* Dettagli evento */}
          <div
            className={`rounded-xl p-3.5 border space-y-2 text-xs transition-colors ${
              isDark
                ? 'bg-neutral-900 border-neutral-800 text-neutral-200'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600 dark:text-yellow-400 shrink-0" />
              <span>
                Data:{' '}
                <strong className="capitalize font-bold text-slate-900 dark:text-yellow-300">
                  {dateFormatted}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600 dark:text-yellow-400 shrink-0" />
              <span>
                Orario:{' '}
                <strong className="font-mono font-bold text-slate-900 dark:text-yellow-300">
                  {startTime} - {endTime}
                </strong>
              </span>
            </div>

            {roomName && (
              <div className="flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  Sala:{' '}
                  <strong className="font-bold text-slate-900 dark:text-yellow-300">
                    {roomName}
                  </strong>
                </span>
              </div>
            )}

            {clientName && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>
                  Cliente / Band:{' '}
                  <strong className="font-bold text-slate-900 dark:text-yellow-300">
                    {clientName}
                  </strong>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions: Tasti Sì e No */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/90 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200 text-sm font-bold transition-all cursor-pointer shadow-xs min-w-[80px]"
          >
            No
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black transition-all cursor-pointer shadow-md shadow-blue-500/25 active:scale-95 min-w-[80px]"
          >
            Sì
          </button>
        </div>
      </div>
    </div>
  );
};
