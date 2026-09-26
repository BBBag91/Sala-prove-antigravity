import React, { useState } from 'react';
import {
  X,
  Check,
  RotateCw,
  Clock,
  Bookmark,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import { RecurrenceConfig, RecurrenceFrequency, RecurrenceEndType } from '../types';
import {
  formatDateItalian,
  formatDateToISO,
  generateRecurrenceDates,
  parseISODate,
} from '../utils/dateUtils';
import { handleNumericFocus, handleNumericClick, handleNumericBlur } from '../utils/inputUtils';

interface RecurrenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: RecurrenceConfig) => void;
  initialConfig: RecurrenceConfig;
  startDate: string; // YYYY-MM-DD
}

const DAYS_LIST = [
  { index: 1, label: 'LUN', full: 'Lunedì' },
  { index: 2, label: 'MAR', full: 'Martedì' },
  { index: 3, label: 'MER', full: 'Mercoledì' },
  { index: 4, label: 'GIO', full: 'Giovedì' },
  { index: 5, label: 'VEN', full: 'Venerdì' },
  { index: 6, label: 'SAB', full: 'Sabato' },
  { index: 0, label: 'DOM', full: 'Domenica' },
];

export const RecurrenceModal: React.FC<RecurrenceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialConfig,
  startDate,
}) => {
  const baseDate = parseISODate(startDate);
  const defaultDayIndex = baseDate.getDay();

  const [frequenza, setFrequenza] = useState<RecurrenceFrequency>(
    initialConfig.frequenza === 'nessuna' ? 'settimanale' : initialConfig.frequenza
  );
  const [intervallo, setIntervallo] = useState<string | number>(initialConfig.intervallo || 1);
  const [giorniSettimana, setGiorniSettimana] = useState<number[]>(() => {
    if (initialConfig.giorniSettimana && initialConfig.giorniSettimana.length > 0) {
      return initialConfig.giorniSettimana;
    }
    return [defaultDayIndex];
  });
  const [tipoFine, setTipoFine] = useState<RecurrenceEndType>(initialConfig.tipoFine || 'per_sempre');
  const [conteggioOccorrenze, setConteggioOccorrenze] = useState<string | number>(
    initialConfig.conteggioOccorrenze || 4
  );

  // Default end date 2 months later
  const [dataFine, setDataFine] = useState<string>(() => {
    if (initialConfig.dataFine) return initialConfig.dataFine;
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() + 2);
    return formatDateToISO(d);
  });

  const [isFreqDropdownOpen, setIsFreqDropdownOpen] = useState(false);
  const [isEndDropdownOpen, setIsEndDropdownOpen] = useState(false);

  if (!isOpen) return null;

  const toggleDay = (dayIndex: number) => {
    if (giorniSettimana.includes(dayIndex)) {
      if (giorniSettimana.length > 1) {
        setGiorniSettimana(giorniSettimana.filter((d) => d !== dayIndex));
      }
    } else {
      setGiorniSettimana([...giorniSettimana, dayIndex]);
    }
  };

  const currentConfig: RecurrenceConfig = {
    attiva: frequenza !== 'nessuna',
    frequenza,
    intervallo: intervallo === '' ? 1 : Math.max(1, Number(intervallo)),
    giorniSettimana,
    tipoFine,
    dataFine: tipoFine === 'fino_al' ? dataFine : undefined,
    conteggioOccorrenze:
      tipoFine === 'conteggio' || tipoFine === 'per'
        ? conteggioOccorrenze === ''
          ? 4
          : Math.max(1, Number(conteggioOccorrenze))
        : undefined,
  };

  const previewDates = generateRecurrenceDates(startDate, currentConfig);

  const handleConfirm = () => {
    onSave(currentConfig);
    onClose();
  };

  const getEndTypeLabel = () => {
    if (tipoFine === 'fino_al') return 'Fino al';
    if (tipoFine === 'per') return 'Per';
    if (tipoFine === 'conteggio') return 'Per';
    return 'Per sempre';
  };

  const getFrequencyLabel = () => {
    if (frequenza === 'giornaliera') return 'Ripeti ogni giorno';
    if (frequenza === 'settimanale') {
      return intervallo === 1 ? 'Ripeti ogni settimana' : `Ripeti ogni ${intervallo} settimane`;
    }
    if (frequenza === 'mensile') return 'Ripeti ogni mese';
    return 'Non si ripete';
  };

  const startDayName = DAYS_LIST.find((d) => d.index === defaultDayIndex)?.full.toLowerCase() || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#121212] border border-yellow-500/30 text-white rounded-3xl w-full max-w-sm sm:max-w-md p-5 sm:p-6 shadow-2xl relative space-y-6">
        
        {/* ── Top Bar: Cancel (X) & Confirm (✓) ── */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 flex items-center justify-center transition-colors"
            title="Annulla"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>

          <span className="text-sm font-bold text-yellow-400 tracking-wide uppercase">
            Ricorrenza
          </span>

          <button
            type="button"
            onClick={handleConfirm}
            className="w-10 h-10 rounded-full bg-yellow-400 text-black hover:bg-yellow-300 flex items-center justify-center font-bold transition-transform active:scale-95 shadow-lg shadow-yellow-500/30"
            title="Conferma ripetizione"
          >
            <Check className="w-5 h-5 stroke-[3]" />
          </button>
        </div>

        {/* ── Row 1: Frequency Selector ── */}
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 flex items-center justify-center text-yellow-400/90 shrink-0">
              <RotateCw className="w-5 h-5" />
            </div>

            <button
              type="button"
              onClick={() => {
                setIsFreqDropdownOpen(!isFreqDropdownOpen);
                setIsEndDropdownOpen(false);
              }}
              className="flex items-center gap-2 text-base font-semibold text-white hover:text-yellow-300 transition-colors"
            >
              <span>{getFrequencyLabel()}</span>
              <ChevronDown className="w-4 h-4 text-neutral-400" />
            </button>
          </div>

          {/* Frequency Dropdown */}
          {isFreqDropdownOpen && (
            <div className="absolute left-9 top-full mt-2 w-64 bg-neutral-900 border border-yellow-500/30 rounded-2xl p-1.5 shadow-2xl z-30 space-y-1">
              <button
                type="button"
                onClick={() => {
                  setFrequenza('settimanale');
                  setIntervallo(1);
                  setIsFreqDropdownOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  frequenza === 'settimanale' && intervallo === 1
                    ? 'bg-yellow-400 text-black font-bold'
                    : 'text-neutral-200 hover:bg-neutral-800'
                }`}
              >
                Ripeti ogni settimana
              </button>
              <button
                type="button"
                onClick={() => {
                  setFrequenza('settimanale');
                  setIntervallo(2);
                  setIsFreqDropdownOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  frequenza === 'settimanale' && intervallo === 2
                    ? 'bg-yellow-400 text-black font-bold'
                    : 'text-neutral-200 hover:bg-neutral-800'
                }`}
              >
                Ripeti ogni 2 settimane (Quindicinale)
              </button>
              <button
                type="button"
                onClick={() => {
                  setFrequenza('giornaliera');
                  setIntervallo(1);
                  setIsFreqDropdownOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  frequenza === 'giornaliera'
                    ? 'bg-yellow-400 text-black font-bold'
                    : 'text-neutral-200 hover:bg-neutral-800'
                }`}
              >
                Ripeti ogni giorno
              </button>
              <button
                type="button"
                onClick={() => {
                  setFrequenza('mensile');
                  setIntervallo(1);
                  setIsFreqDropdownOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  frequenza === 'mensile'
                    ? 'bg-yellow-400 text-black font-bold'
                    : 'text-neutral-200 hover:bg-neutral-800'
                }`}
              >
                Ripeti ogni mese
              </button>
              <button
                type="button"
                onClick={() => {
                  setFrequenza('nessuna');
                  setIsFreqDropdownOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  frequenza === 'nessuna'
                    ? 'bg-yellow-400 text-black font-bold'
                    : 'text-neutral-200 hover:bg-neutral-800'
                }`}
              >
                Non si ripete
              </button>
            </div>
          )}
        </div>

        {/* ── Row 2: Interval ("Ogni 1 settimana") ── */}
        {frequenza !== 'nessuna' && (
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 flex items-center justify-center text-yellow-400/90 shrink-0">
              <Clock className="w-5 h-5" />
            </div>

            <div className="flex items-center gap-2 text-base text-neutral-300">
              <span>Ogni</span>
              <div className="flex items-center bg-neutral-900 border border-yellow-500/30 rounded-lg px-2 py-0.5">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={intervallo}
                  onFocus={handleNumericFocus}
                  onClick={handleNumericClick}
                  onBlur={handleNumericBlur}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*$/.test(val)) {
                      setIntervallo(val);
                    }
                  }}
                  className="w-10 bg-transparent text-center font-bold text-yellow-300 text-base focus:outline-none"
                />
              </div>
              <span>
                {frequenza === 'settimanale'
                  ? (intervallo === 1 || intervallo === '1')
                    ? 'settimana'
                    : 'settimane'
                  : frequenza === 'giornaliera'
                  ? intervallo === 1
                    ? 'giorno'
                    : 'giorni'
                  : intervallo === 1
                  ? 'mese'
                  : 'mesi'}
              </span>
            </div>
          </div>
        )}

        {/* ── Row 3: Days of the Week Round Buttons (Matching Screenshot) ── */}
        {frequenza === 'settimanale' && (
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 flex items-center justify-center text-yellow-400/90 shrink-0">
              <Bookmark className="w-5 h-5" />
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap flex-1">
              {DAYS_LIST.map((day) => {
                const isSelected = giorniSettimana.includes(day.index);
                return (
                  <button
                    key={day.index}
                    type="button"
                    onClick={() => toggleDay(day.index)}
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full text-xs font-bold transition-all flex items-center justify-center select-none ${
                      isSelected
                        ? 'bg-yellow-400 text-black font-extrabold shadow-md shadow-yellow-500/30 scale-105 border-2 border-yellow-300'
                        : 'bg-neutral-900/90 text-yellow-400/80 border border-yellow-500/40 hover:border-yellow-400 hover:text-yellow-300'
                    }`}
                    title={day.full}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Row 4: End Rule ("Fino al / Per / Per sempre") ── */}
        {frequenza !== 'nessuna' && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
              <div className="w-6 h-6 flex items-center justify-center text-yellow-400/90 shrink-0">
                <Calendar className="w-5 h-5" />
              </div>

              {/* End type pills: Per sempre, Per N volte, Fino al */}
              <div className="flex items-center gap-1 p-1 bg-neutral-900 border border-yellow-500/30 rounded-2xl shrink-0">
                <button
                  type="button"
                  onClick={() => setTipoFine('per_sempre')}
                  className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    tipoFine === 'per_sempre'
                      ? 'bg-yellow-400 text-black shadow-md'
                      : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  Per sempre
                </button>

                <button
                  type="button"
                  onClick={() => setTipoFine('conteggio')}
                  className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    tipoFine === 'conteggio' || tipoFine === 'per'
                      ? 'bg-yellow-400 text-black shadow-md'
                      : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  Per
                </button>

                <button
                  type="button"
                  onClick={() => setTipoFine('fino_al')}
                  className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    tipoFine === 'fino_al'
                      ? 'bg-yellow-400 text-black shadow-md'
                      : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  Fino al
                </button>
              </div>

              {/* Inline input for 'Per' (count) */}
              {(tipoFine === 'conteggio' || tipoFine === 'per') && (
                <div className="flex items-center gap-1.5 text-xs text-neutral-300">
                  <div className="flex items-center bg-neutral-900 border border-yellow-500/30 rounded-lg px-2 py-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={conteggioOccorrenze}
                      onFocus={handleNumericFocus}
                      onClick={handleNumericClick}
                      onBlur={handleNumericBlur}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*$/.test(val)) {
                          setConteggioOccorrenze(val);
                        }
                      }}
                      className="w-10 bg-transparent text-center font-bold text-yellow-300 text-sm focus:outline-none"
                    />
                  </div>
                  <span>sessioni</span>
                </div>
              )}

              {/* Inline input for 'Fino al' */}
              {tipoFine === 'fino_al' && (
                <input
                  type="date"
                  value={dataFine}
                  onChange={(e) => setDataFine(e.target.value)}
                  className="bg-neutral-900 border border-yellow-500/30 rounded-xl px-2.5 py-1 text-xs font-semibold text-yellow-300 focus:outline-none"
                />
              )}
            </div>

            {/* When Per sempre is selected: subtitle */}
            {tipoFine === 'per_sempre' && (
              <div className="ml-9 text-xs text-yellow-400/90 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                <span>Ripetizione continua senza scadenza (fissata per sempre)</span>
              </div>
            )}
          </div>
        )}

        {/* ── Footer Info (Matching Screenshot) ── */}
        <div className="pt-2 border-t border-neutral-800/80 space-y-1.5 text-xs text-neutral-400">
          <p>
            Inizio: <strong className="text-yellow-300 font-semibold">{startDayName} {formatDateItalian(startDate, false)}</strong>
          </p>
          <p className="text-[11px] text-neutral-500">
            Fuso orario: Europe/Rome
          </p>

          {frequenza !== 'nessuna' && (
            <div className="mt-2 p-2.5 rounded-xl bg-yellow-400/10 border border-yellow-500/25 flex items-center justify-between">
              {tipoFine === 'per_sempre' ? (
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] text-yellow-300 font-medium">
                    Ripetizione fissa: <strong className="text-yellow-400 font-bold">Per sempre (Continuativa)</strong>
                  </span>
                  <span className="text-[10px] text-neutral-400">
                    52 settimane programmate
                  </span>
                </div>
              ) : (
                <>
                  <span className="text-[11px] text-yellow-300 font-medium">
                    Verranno create <strong className="text-yellow-400 font-bold">{previewDates.length} prenotazioni</strong>
                  </span>
                  <span className="text-[10px] text-neutral-400">
                    fino al {previewDates[previewDates.length - 1]}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
