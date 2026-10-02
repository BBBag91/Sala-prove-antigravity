import React from 'react';
import { X, Sparkles, CheckCircle2, AlertTriangle, User, ArrowRight } from 'lucide-react';
import { AutoAssignResult } from '../utils/scheduler';
import { formatDateItalian } from '../utils/dateUtils';

interface AutoAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: AutoAssignResult | null;
}

export const AutoAssignModal: React.FC<AutoAssignModalProps> = ({ isOpen, onClose, result }) => {
  if (!isOpen || !result) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/90 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-yellow-400/10 border border-blue-200/80 dark:border-yellow-500/30 text-blue-600 dark:text-yellow-400 flex items-center justify-center shrink-0 shadow-2xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-snug truncate">
                Assegnazione Automatica Intelligente
              </h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400 font-normal truncate mt-0.5">
                Verifica turni primari, preferenza turni continuativi e bilanciamento monte ore
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

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Summary Badges */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-emerald-800">{result.assignedCount}</p>
                <p className="text-xs font-semibold text-emerald-700">Turni Assegnati</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-amber-800">{result.unassignedCount}</p>
                <p className="text-xs font-semibold text-amber-700">Conflitti / Da Verificare</p>
              </div>
            </div>
          </div>

          {/* Logic explanation banner */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <span>⚡ Criteri Applicati dall'Algoritmo:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600 pl-1">
              <li>
                <strong>Verifica Turni Lavoro Primario</strong>: L'operatore è selezionabile solo se libero (24h - lavoro primario).
              </li>
              <li>
                <strong>Turni Continuativi</strong>: Quando possibile, turni consecutivi o contigui nello stesso giorno vengono assegnati allo stesso operatore per evitare spezzettamenti.
              </li>
              <li>
                <strong>Bilanciamento Orari</strong>: Negli slot isolati viene data precedenza all'operatore che ha accumulato meno ore nel mese.
              </li>
            </ul>
          </div>

          {/* Log of operations */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Dettaglio Assegnazioni Eseguite:
            </h4>
            {result.logs.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">Nessuna prenotazione da assegnare.</p>
            ) : (
              <div className="space-y-2">
                {result.logs.map((log, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                      log.assignedToName
                        ? 'bg-white border-slate-200 shadow-2xs'
                        : 'bg-rose-50 border-rose-200'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-slate-800 flex items-center gap-2">
                        <span>{log.bookingTitle}</span>
                        {log.date && (
                          <span className="text-[11px] font-normal text-slate-500">
                            • {formatDateItalian(log.date, false)} ({log.time})
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{log.reason}</p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      {log.assignedToName ? (
                        <>
                          <div className="flex items-center gap-1 font-semibold text-slate-900 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-md">
                            <User className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{log.assignedToName}</span>
                          </div>
                          {log.isContinuous && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium text-[10px]">
                              Continuativo
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="px-2 py-1 rounded-md bg-rose-100 text-rose-700 font-medium text-[10px]">
                          Nessuno libero
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-xs"
            >
              <span>Chiudi e Visualizza Calendario</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
