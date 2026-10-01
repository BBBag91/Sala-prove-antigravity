import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Calculator,
  Users,
  RotateCcw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { calcolaCompensiFineMese, VariabiliG } from '../utils/compensiFineMese';
import { formatCurrency } from '../utils/dateUtils';

interface CompensiFineMeseSectionProps {
  currentMonthName: string;
  currentYear: number;
  monthStr: string;
  totalIncomes?: number;
  totalExpenses?: number;
}

export const CompensiFineMeseSection: React.FC<CompensiFineMeseSectionProps> = ({
  currentMonthName,
  currentYear,
  monthStr,
  totalIncomes = 0,
  totalExpenses = 0,
}) => {
  const storageKey = `salaprove_compensi_v3_${monthStr}`;

  // Default initial values
  const defaultG: VariabiliG = { G1: 3, G2: 0, G3: 0, G4: 0 };

  const [totaleEntrateMese, setTotaleEntrateMese] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.totaleEntrateMese === 'number') return parsed.totaleEntrateMese;
      }
    } catch {}
    return totalIncomes;
  });

  const [G, setG] = useState<VariabiliG>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.G) return parsed.G;
      }
    } catch {}
    return defaultG;
  });

  // Re-load / sync when month changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.totaleEntrateMese === 'number') setTotaleEntrateMese(parsed.totaleEntrateMese);
        else setTotaleEntrateMese(totalIncomes);

        if (parsed.G) setG(parsed.G);
        else setG(defaultG);
        return;
      }
    } catch {}
    setTotaleEntrateMese(totalIncomes);
    setG(defaultG);
  }, [storageKey]);

  // Persist values on change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ totaleEntrateMese, G }));
    } catch {}
  }, [totaleEntrateMese, G, storageKey]);

  // Calcolo matematico: le spese vengono prese direttamente dal totale spese mese (totalExpenses)
  const output = calcolaCompensiFineMese({
    totaleEntrateMese,
    totaleSpeseMese: totalExpenses,
    G,
  });

  const handleSyncRealData = () => {
    setTotaleEntrateMese(totalIncomes);
  };

  const handleReset = () => {
    if (window.confirm('Vuoi ripristinare i valori dei compensi per questo mese?')) {
      setTotaleEntrateMese(totalIncomes);
      setG(defaultG);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-6 p-5 sm:p-7">
      {/* Header Sezione */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0 shadow-xs">
            <FileSpreadsheet className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                Compensi Fine Mese
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-100 text-blue-700 tracking-wide">
                Calcolo Excel
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Ripartizione quote studio per {currentMonthName} {currentYear} • Netto Sala, Gab, Ale, Paolo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleSyncRealData}
            className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 transition-all flex items-center gap-1.5 cursor-pointer touch-manipulation touch-active"
            title="Sincronizza Totale Entrate con le entrate registrate nel mese"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Sincronizza con Entrate Mese</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-semibold border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer touch-manipulation touch-active"
            title="Ripristina valori predefiniti"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* ── Input Grid (2 Colonne: Totale Entrate Mese a sinistra, Quote e Anticipi G a destra) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Blocco 1: Totale Entrate Mese (B2) & Riepilogo Costi */}
        <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                Totale Rilevato
              </span>
              <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                Cella B2
              </span>
            </div>

            <div className="space-y-2 pt-2">
              <label className="block text-xs font-semibold text-slate-700">
                Importo Totale Rilevato (B2):
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">€</span>
                <input
                  type="number"
                  step="any"
                  value={totaleEntrateMese === 0 ? '' : totaleEntrateMese}
                  placeholder="0.00"
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setTotaleEntrateMese(val);
                  }}
                  className="w-full pl-7 pr-3 py-2.5 text-base font-mono font-bold rounded-xl border border-slate-300 bg-white text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-right shadow-2xs"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Precompilato automaticamente con le entrate registrate ({formatCurrency(totalIncomes)}).
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Totale Spese Mese (registrate sopra):</span>
              <strong className="font-mono text-rose-700">-{formatCurrency(totalExpenses)}</strong>
            </div>
            <div className="flex justify-between text-slate-700 font-semibold border-t border-slate-200/80 pt-1.5">
              <span>Avanzo Netto Studio (E2 = B2 - Spese):</span>
              <strong className={`font-mono text-sm ${output.E2 >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatCurrency(output.E2)}
              </strong>
            </div>
          </div>
        </div>

        {/* Blocco 2: Variabili G (Netto Sala, Gab, Ale, Paolo) */}
        <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-600" />
              Quote e Anticipi Soci
            </span>
            <span className="text-[11px] font-mono font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
              Variabili G
            </span>
          </div>

          <div className="space-y-2.5">
            {/* G1: Divisore quote */}
            <div className="flex items-center justify-between gap-3 text-xs">
              <label className="font-bold text-blue-900 w-32">
                G1 (Divisore):
              </label>
              <input
                type="number"
                min="1"
                step="any"
                value={G.G1 === 0 ? '' : G.G1}
                placeholder="3"
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 1;
                  setG((prev) => ({ ...prev, G1: val }));
                }}
                className="w-28 px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-blue-300 bg-white text-blue-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-right"
              />
            </div>

            {/* G2: Gab */}
            <div className="flex items-center justify-between gap-3 text-xs">
              <label className="font-semibold text-slate-700 w-32">
                G2 (Gab):
              </label>
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">€</span>
                <input
                  type="number"
                  step="any"
                  value={G.G2 === 0 ? '' : G.G2}
                  placeholder="0.00"
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setG((prev) => ({ ...prev, G2: val }));
                  }}
                  className="w-full pl-6 pr-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-right"
                />
              </div>
            </div>

            {/* G3: Ale */}
            <div className="flex items-center justify-between gap-3 text-xs">
              <label className="font-semibold text-slate-700 w-32">
                G3 (Ale):
              </label>
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">€</span>
                <input
                  type="number"
                  step="any"
                  value={G.G3 === 0 ? '' : G.G3}
                  placeholder="0.00"
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setG((prev) => ({ ...prev, G3: val }));
                  }}
                  className="w-full pl-6 pr-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-right"
                />
              </div>
            </div>

            {/* G4: Paolo */}
            <div className="flex items-center justify-between gap-3 text-xs">
              <label className="font-semibold text-slate-700 w-32">
                G4 (Paolo):
              </label>
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">€</span>
                <input
                  type="number"
                  step="any"
                  value={G.G4 === 0 ? '' : G.G4}
                  placeholder="0.00"
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setG((prev) => ({ ...prev, G4: val }));
                  }}
                  className="w-full pl-6 pr-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-right"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Risultati & Compensi Calcolati in Automatico ── */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Calculator className="w-4 h-4 text-blue-600" />
            Risultati & Compensi Spettanti
          </h4>
          <span className="text-[11px] text-slate-500 font-mono">
            Netto Sala base (E2 / G1) = {output.dettagli.quotaBaseNonArrotondata.toFixed(2)} €
          </span>
        </div>

        {/* 1. Quadri di Sintesi Studio (B2, E2, B13) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Card B2: Totale Rilevato */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">B2 • Totale Rilevato</span>
            <p className="text-2xl font-bold font-mono text-slate-900">{formatCurrency(output.B2)}</p>
            <p className="text-[10px] text-slate-500 font-mono">Totale rilevato</p>
          </div>

          {/* Card E2 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">E2 • Avanzo Netto</span>
            <p className={`text-2xl font-bold font-mono ${output.E2 >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {formatCurrency(output.E2)}
            </p>
            <p className="text-[10px] text-slate-500 font-mono">B2 - Spese Mese</p>
          </div>

          {/* Card B13: Netto Sala */}
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">B13 • Netto Sala</span>
            <p className="text-2xl font-bold font-mono text-blue-900">{formatCurrency(output.B13)}</p>
            <p className="text-[10px] text-blue-600 font-mono">Arrotonda per eccesso (E2 / G1)</p>
          </div>
        </div>

        {/* 2. Compensi Netti Soci (B15 Gab, B14 Ale, B16 Paolo) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
          {/* Card Gab (B15) */}
          <div className="p-4.5 rounded-xl bg-gradient-to-br from-emerald-50/90 to-emerald-100/50 border border-emerald-200 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                  G
                </div>
                <span className="text-xs font-extrabold uppercase text-emerald-950">
                  Compenso Gab
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-200/60 px-2 py-0.5 rounded-full">
                B15 (G2: -{G.G2}€)
              </span>
            </div>
            <p className="text-3xl font-extrabold font-mono text-emerald-950">
              {formatCurrency(output.B15)}
            </p>
            <p className="text-[10px] text-emerald-800 font-mono">
              Formula: Arrotonda per difetto (Netto Sala - Gab)
            </p>
          </div>

          {/* Card Ale (B14) */}
          <div className="p-4.5 rounded-xl bg-gradient-to-br from-emerald-50/90 to-emerald-100/50 border border-emerald-200 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                  A
                </div>
                <span className="text-xs font-extrabold uppercase text-emerald-950">
                  Compenso Ale
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-200/60 px-2 py-0.5 rounded-full">
                B14 (G3: -{G.G3}€)
              </span>
            </div>
            <p className="text-3xl font-extrabold font-mono text-emerald-950">
              {formatCurrency(output.B14)}
            </p>
            <p className="text-[10px] text-emerald-800 font-mono">
              Formula: Arrotonda per difetto (Netto Sala - Ale)
            </p>
          </div>

          {/* Card Paolo (B16) */}
          <div className="p-4.5 rounded-xl bg-gradient-to-br from-emerald-50/90 to-emerald-100/50 border border-emerald-200 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                  P
                </div>
                <span className="text-xs font-extrabold uppercase text-emerald-950">
                  Compenso Paolo
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-200/60 px-2 py-0.5 rounded-full">
                B16 (G4: -{G.G4}€)
              </span>
            </div>
            <p className="text-3xl font-extrabold font-mono text-emerald-950">
              {formatCurrency(output.B16)}
            </p>
            <p className="text-[10px] text-emerald-800 font-mono">
              Formula: Arrotonda per difetto (Netto Sala - Paolo)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
