import React, { useState } from 'react';
import {
  X,
  Printer,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MESI_ITALIANI, parseISODate } from '../utils/dateUtils';
import {
  WeeklyShiftDayData,
  compileWeeklyStats,
  printWeeklyShiftsDirectly,
  generateWeeklyShiftsPDF,
} from '../utils/weeklyShiftsPdf';

interface WeeklyShiftsPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMonday: Date;
  weekFriday: Date;
  computedWeekShifts: WeeklyShiftDayData[];
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  onCurrentWeek?: () => void;
}

const GIORNI_LUN_VEN = [
  { short: 'LUN', name: 'Lunedì' },
  { short: 'MAR', name: 'Martedì' },
  { short: 'MER', name: 'Mercoledì' },
  { short: 'GIO', name: 'Giovedì' },
  { short: 'VEN', name: 'Venerdì' },
  { short: 'SAB', name: 'Sabato' },
];

export const WeeklyShiftsPrintModal: React.FC<WeeklyShiftsPrintModalProps> = ({
  isOpen,
  onClose,
  currentMonday,
  weekFriday,
  computedWeekShifts,
  onPrevWeek,
  onNextWeek,
  onCurrentWeek,
}) => {
  const { studioInfo, staff } = useApp();
  const [includeSignatures, setIncludeSignatures] = useState<boolean>(true);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const stats = compileWeeklyStats(computedWeekShifts);

  const startDay = currentMonday.getDate();
  const startMonth = MESI_ITALIANI[currentMonday.getMonth()];
  const endDay = weekFriday.getDate();
  const endMonth = MESI_ITALIANI[weekFriday.getMonth()];
  const year = weekFriday.getFullYear();

  const periodTitle =
    startMonth === endMonth
      ? `Settimana dal ${startDay} al ${endDay} ${startMonth} ${year}`
      : `Settimana dal ${startDay} ${startMonth} al ${endDay} ${endMonth} ${year}`;

  const handlePrint = () => {
    printWeeklyShiftsDirectly({
      currentMonday,
      weekFriday,
      computedWeekShifts,
      studioInfo,
      staff,
      includeSignatures,
    });
  };

  const handleDownload = () => {
    generateWeeklyShiftsPDF({
      currentMonday,
      weekFriday,
      computedWeekShifts,
      studioInfo,
      staff,
      includeSignatures,
    });
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-[#0c0c0c] rounded-2xl max-w-4xl w-full border border-yellow-500/30 shadow-2xl flex flex-col max-h-[95vh] overflow-hidden text-yellow-100 my-auto">
        
        {/* ── Modal Header & Quick Actions ── */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/90 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-yellow-400/10 border border-blue-200/80 dark:border-yellow-500/30 text-blue-600 dark:text-yellow-400 flex items-center justify-center font-black shadow-2xs shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-snug flex items-center gap-2 truncate">
                <span>Stampa Schema Turni Settimanale</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-blue-200 dark:border-emerald-500/30">
                  Formato A4 (1 Foglio)
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400 font-normal truncate mt-0.5">
                Stampa immediata ad alta leggibilità per bacheca e presidio sala.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-yellow-400 dark:hover:bg-yellow-300 text-white dark:text-black font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer touch-manipulation touch-active"
              title="Apre subito la finestra di stampa per stampare su 1 pagina"
            >
              <Printer className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">Stampa Subito (1 Foglio)</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className={`px-3 py-2 font-bold text-xs rounded-xl border transition-all flex items-center gap-2 cursor-pointer touch-manipulation touch-active ${
                downloadSuccess
                  ? 'bg-emerald-500 text-white border-emerald-400'
                  : 'bg-white dark:bg-neutral-900 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-800 dark:text-yellow-300 border-slate-300 dark:border-yellow-500/40 shadow-xs'
              }`}
              title="Scarica il file PDF pronto all'uso"
            >
              {downloadSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Scaricato!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-blue-600 dark:text-yellow-400" />
                  <span>Scarica PDF</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="modal-header-btn-blue modal-close-btn-blue shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 hover:bg-red-600 active:scale-95 text-white transition-all cursor-pointer border border-blue-500 hover:border-red-500 shadow-md shadow-blue-500/25 ml-1"
              style={{ backgroundColor: '#2563eb', color: '#ffffff', borderColor: '#1d4ed8' }}
              title="Chiudi"
              aria-label="Chiudi finestra"
            >
              <X className="w-5 h-5 text-white stroke-[2.5]" style={{ color: '#ffffff', stroke: '#ffffff' }} />
            </button>
          </div>
        </div>

        {/* ── Week Switcher & Options Bar ── */}
        <div className="px-4 sm:px-6 py-2.5 border-b border-yellow-500/15 bg-neutral-900/60 flex items-center justify-between gap-3 flex-wrap text-xs">
          {/* Week Navigation */}
          <div className="flex items-center gap-1.5">
            {onPrevWeek && (
              <button
                onClick={onPrevWeek}
                className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-yellow-300 border border-yellow-500/20 flex items-center justify-center transition-all cursor-pointer"
                title="Settimana precedente"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}

            <div className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-yellow-500/25 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
              <span className="font-bold text-white text-xs">{periodTitle}</span>
            </div>

            {onNextWeek && (
              <button
                onClick={onNextWeek}
                className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-yellow-300 border border-yellow-500/20 flex items-center justify-center transition-all cursor-pointer"
                title="Settimana successiva"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {onCurrentWeek && (
              <button
                onClick={onCurrentWeek}
                className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-yellow-300 border border-yellow-500/20 font-semibold text-[11px] transition-all cursor-pointer"
              >
                Oggi
              </button>
            )}
          </div>

          {/* Options */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none text-neutral-300 hover:text-white">
              <input
                type="checkbox"
                checked={includeSignatures}
                onChange={(e) => setIncludeSignatures(e.target.checked)}
                className="w-4 h-4 rounded text-yellow-400 focus:ring-yellow-400 focus:ring-offset-0 bg-neutral-950 border-neutral-700"
              />
              <span className="text-[11px]">Includi spazio firme &amp; timbro</span>
            </label>

            <span className="text-neutral-400 text-[11px] hidden sm:inline">
              Copertura: <strong className={stats.unassignedShifts === 0 ? 'text-emerald-400' : 'text-amber-400'}>{stats.coveredShifts}/10 turni</strong> ({stats.totalOperatingHours}h)
            </span>
          </div>
        </div>

        {/* ── Document Preview (Crisp White Sheet) ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-950/80">
          <div className="max-w-[740px] mx-auto bg-white text-slate-900 rounded-xl shadow-2xl p-6 sm:p-8 font-sans border border-slate-300">
            
            {/* 1. Header Studio */}
            <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-end justify-between">
              <div>
                <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase">
                  SALA PROVE &bull; {studioInfo?.nome || 'SOUND STUDIO'}
                </h1>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {studioInfo?.indirizzo ? `Sede: ${studioInfo.indirizzo}` : 'Centro Prove & Registrazione'}
                  {studioInfo?.telefono ? ` • Tel: ${studioInfo.telefono}` : ''}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-black text-blue-900 uppercase block tracking-wider">
                  SCHEMA SETTIMANALE TURNI
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Emissione: {new Date().toLocaleDateString('it-IT')} &bull; Pagina 1 di 1
                </span>
              </div>
            </div>

            {/* 2. Period Banner & Kpi */}
            <div className="bg-slate-100 border border-slate-300 rounded-lg p-3 mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xs sm:text-sm font-black text-slate-900 uppercase">
                  📅 {periodTitle}
                </h2>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Presidio: Lun &ndash; Ven (17:00 &ndash; 20:00 / 20:00 &ndash; 23:00+) &bull; Sabato (09:00 &ndash; 12:00 / 14:00 &ndash; 18:00)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-white border border-slate-300 px-2.5 py-1 rounded text-center">
                  <div className="text-[9px] font-bold text-slate-500 uppercase">Ore Presidio</div>
                  <div className="text-xs font-black font-mono text-slate-900">{stats.totalOperatingHours}h</div>
                </div>
                <div className="bg-white border border-slate-300 px-2.5 py-1 rounded text-center">
                  <div className="text-[9px] font-bold text-slate-500 uppercase">Copertura</div>
                  <div className={`text-xs font-black font-mono ${stats.unassignedShifts === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {stats.coveredShifts}/{stats.totalShifts}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Tabella dei 5 giorni */}
            <div className="border border-slate-400 rounded-lg overflow-hidden mb-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-200 border-b-2 border-slate-400 text-slate-900 font-black text-[10px] uppercase">
                    <th className="py-2.5 px-3 border-r border-slate-300 text-center w-20">GIORNO</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">1° TURNO (17:00 &ndash; 20:00)</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">2° TURNO (20:00 &ndash; 23:00+)</th>
                    <th className="py-2.5 px-2 border-r border-slate-300 text-center w-16">ORE</th>
                    <th className="py-2.5 px-2 text-center w-24">STATO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {computedWeekShifts.map(({ dateStr, dayBookings, shift1, shift2 }, idx) => {
                    const dayConfig = GIORNI_LUN_VEN[idx] || { short: 'GIO', name: 'Giorno' };
                    const d = parseISODate(dateStr);
                    const dayNum = d.getDate();
                    const monthNum = String(d.getMonth() + 1).padStart(2, '0');
                    const dayHours = Math.round((shift1.durataOre + shift2.durataOre) * 10) / 10;
                    const isCovered = shift1.operatoreId && shift2.operatoreId;

                    return (
                      <tr key={dateStr} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        {/* Giorno */}
                        <td className="py-2.5 px-2 border-r border-slate-300 text-center">
                          <div className="text-base font-black leading-none text-slate-900">{dayNum}</div>
                          <div className="text-[10px] font-extrabold text-blue-800 uppercase mt-0.5">{dayConfig.name}</div>
                          <div className="text-[9px] text-slate-500 font-mono">{dayNum}/{monthNum}</div>
                        </td>

                        {/* 1° Turno */}
                        <td className="py-2.5 px-3 border-r border-slate-300">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 border border-sky-200">
                              1° TURNO
                            </span>
                            <span className="font-mono text-xs font-bold text-slate-800">
                              {shift1.oraInizio} &ndash; {shift1.oraFine}
                            </span>
                          </div>
                          <div className="font-bold text-xs text-slate-900">
                            {shift1.operatoreNome ? (
                              <span className="text-slate-900">👤 {shift1.operatoreNome}</span>
                            ) : (
                              <span className="text-rose-600 font-extrabold">⚠️ DA ASSEGNARE</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Presidio: <strong>{shift1.durataOre}h</strong>
                            {shift1.isAdapted && (
                              <span className="text-amber-700 font-bold ml-1">({shift1.adaptationReason || 'Orario adattato'})</span>
                            )}
                          </div>
                        </td>

                        {/* 2° Turno */}
                        <td className="py-2.5 px-3 border-r border-slate-300">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                              2° TURNO
                            </span>
                            <span className="font-mono text-xs font-bold text-slate-800">
                              {shift2.oraInizio} &ndash; {shift2.oraFine}
                            </span>
                          </div>
                          <div className="font-bold text-xs text-slate-900">
                            {shift2.operatoreNome ? (
                              <span className="text-slate-900">👤 {shift2.operatoreNome}</span>
                            ) : (
                              <span className="text-rose-600 font-extrabold">⚠️ DA ASSEGNARE</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Presidio: <strong>{shift2.durataOre}h</strong>
                            {shift2.isAdapted && (
                              <span className="text-amber-700 font-bold ml-1">({shift2.adaptationReason || 'Orario prolungato'})</span>
                            )}
                          </div>
                        </td>

                        {/* Ore */}
                        <td className="py-2.5 px-2 border-r border-slate-300 text-center font-mono font-bold text-xs text-slate-900">
                          {dayHours}h
                        </td>

                        {/* Stato */}
                        <td className="py-2.5 px-2 text-center">
                          {isCovered ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ Coperto
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                              ⚠️ Incompleto
                            </span>
                          )}
                          <div className="text-[9px] text-slate-500 mt-1">
                            {dayBookings.length > 0 ? `${dayBookings.length} prove` : '0 prove'}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-black border-t-2 border-slate-400 text-slate-900">
                    <td className="py-2 px-2 text-center text-[10px] uppercase border-r border-slate-300">TOTALE</td>
                    <td colSpan={2} className="py-2 px-3 text-[11px] font-medium text-slate-600 border-r border-slate-300">
                      10 turni settimanali pianificati (Lunedì &ndash; Venerdì)
                    </td>
                    <td className="py-2 px-2 text-center font-mono font-black text-xs border-r border-slate-300">
                      {stats.totalOperatingHours}h
                    </td>
                    <td className="py-2 px-2 text-center text-[10px] font-bold">
                      {stats.coveredShifts}/10 Coperti
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 4. Riepilogo Operatori */}
            <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 mb-4">
              <div className="text-[10px] font-extrabold text-slate-800 uppercase mb-2">
                👥 Riepilogo Presenze &amp; Ore Assegnate per Operatore (Questa Settimana):
              </div>
              <div className="flex flex-wrap gap-2">
                {stats.operatorStats.length > 0 ? (
                  stats.operatorStats.map((op) => (
                    <div
                      key={op.id}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded text-[10px] text-slate-800 font-semibold"
                    >
                      <strong>{op.name}</strong>: {op.shiftsCount} turni (<span className="font-mono font-bold">{op.hours}h</span>)
                    </div>
                  ))
                ) : (
                  <span className="text-[10px] text-slate-400 italic">Nessun operatore ancora assegnato.</span>
                )}
              </div>
            </div>

            {/* 5. Firme & Convalida */}
            {includeSignatures && (
              <div className="border-t border-slate-300 pt-3 flex justify-between text-[10px] text-slate-600">
                <div className="space-y-4">
                  <div>Luogo e Data: <strong>{studioInfo?.citta || 'In sede'}, {new Date().toLocaleDateString('it-IT')}</strong></div>
                  <div>
                    <div className="border-b border-slate-400 w-36 mb-1"></div>
                    <span className="text-[9px] text-slate-500">Firma Operatore Presa Visione</span>
                  </div>
                </div>
                <div className="space-y-4 text-right flex flex-col items-end">
                  <div>Per la Direzione: <strong>{studioInfo?.nome || 'Sound Studio'}</strong></div>
                  <div>
                    <div className="border-b border-slate-400 w-36 mb-1"></div>
                    <span className="text-[9px] text-slate-500">Timbro Sala &amp; Firma Responsabile</span>
                  </div>
                </div>
              </div>
            )}

            <div className="text-center text-[9px] text-slate-400 italic mt-3">
              Documento Ufficiale interno &bull; Schema Riepilogativo Settimanale Turni Presidio &bull; Pagina 1 di 1
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
