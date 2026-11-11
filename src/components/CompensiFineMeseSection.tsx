import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Calculator,
  Users,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Banknote,
} from 'lucide-react';
import { calcolaCompensiFineMese, VariabiliG } from '../utils/compensiFineMese';
import { formatCurrency } from '../utils/dateUtils';
import { MiniStudioCalculator } from './MiniStudioCalculator';
import { financeSettlementService, CashDenominations } from '../services/financeSettlementService';

const DEFAULT_CASH: CashDenominations = {
  b5: 0,
  b10: 0,
  b20: 0,
  b50: 0,
  b100: 0,
  spicci: 0,
};

interface CompensiFineMeseSectionProps {
  currentMonthName: string;
  currentYear: number;
  monthStr: string;
  totalIncomes?: number;
  totalExpenses?: number;
  residuoQuoteTessere?: number; // Quote tessere saldate nel mese
  residuoQuoteTessereTotale?: number; // Totale storico quote tessere saldate
  historicalNettoSalaSum?: number; // Somma di ogni netto sala storico registrato
}

export const CompensiFineMeseSection: React.FC<CompensiFineMeseSectionProps> = ({
  currentMonthName,
  currentYear,
  monthStr,
  totalIncomes = 0,
  totalExpenses = 0,
  residuoQuoteTessere = 0,
  residuoQuoteTessereTotale = 0,
  historicalNettoSalaSum = 0,
}) => {
  // Default initial values
  const defaultG: VariabiliG = { G1: 3, G2: 0, G3: 0, G4: 0 };

  const [isManualEntrate, setIsManualEntrate] = useState<boolean>(() => {
    const stored = financeSettlementService.getMonthlyCompensi(monthStr);
    return Boolean(stored?.isManualEntrate);
  });

  const [totaleEntrateMese, setTotaleEntrateMese] = useState<number>(() => {
    const stored = financeSettlementService.getMonthlyCompensi(monthStr);
    if (stored?.isManualEntrate && typeof stored.totaleEntrateMese === 'number') {
      return stored.totaleEntrateMese;
    }
    return totalIncomes;
  });

  const [G, setG] = useState<VariabiliG>(() => {
    const stored = financeSettlementService.getMonthlyCompensi(monthStr);
    if (stored?.G) return { ...defaultG, ...stored.G, G1: 3 };
    return defaultG;
  });

  const [cash, setCash] = useState<CashDenominations>(() => {
    const stored = financeSettlementService.getMonthlyCompensi(monthStr);
    if (stored?.cash) return { ...DEFAULT_CASH, ...stored.cash };
    return DEFAULT_CASH;
  });

  // Re-load / sync when month changes or cloud store updates
  useEffect(() => {
    const loadFromStore = () => {
      const stored = financeSettlementService.getMonthlyCompensi(monthStr);
      if (stored) {
        if (stored.isManualEntrate && typeof stored.totaleEntrateMese === 'number') {
          setTotaleEntrateMese(stored.totaleEntrateMese);
          setIsManualEntrate(true);
        } else {
          setTotaleEntrateMese(totalIncomes);
          setIsManualEntrate(false);
        }

        if (stored.G) setG({ ...defaultG, ...stored.G, G1: 3 });
        else setG(defaultG);

        if (stored.cash) setCash({ ...DEFAULT_CASH, ...stored.cash });
        else setCash(DEFAULT_CASH);
        return;
      }
      setTotaleEntrateMese(totalIncomes);
      setIsManualEntrate(false);
      setG(defaultG);
      setCash(DEFAULT_CASH);
    };

    loadFromStore();
    const unsubscribe = financeSettlementService.subscribe(loadFromStore);
    return unsubscribe;
  }, [monthStr]);

  // Keep totaleEntrateMese in sync with totalIncomes unless user has manually customized it
  useEffect(() => {
    if (!isManualEntrate) {
      setTotaleEntrateMese(totalIncomes);
    }
  }, [totalIncomes, isManualEntrate]);

  // Persist values on change (local + Supabase cloud store)
  useEffect(() => {
    financeSettlementService.saveMonthlyCompensi(monthStr, {
      totaleEntrateMese,
      G,
      isManualEntrate,
      cash,
    });
  }, [totaleEntrateMese, G, isManualEntrate, cash, monthStr]);

  const updateCashField = (field: keyof CashDenominations, rawVal: number) => {
    const cleanVal =
      field === 'spicci'
        ? Math.max(0, Number.isNaN(rawVal) ? 0 : rawVal)
        : Math.max(0, Math.floor(Number.isNaN(rawVal) ? 0 : rawVal));

    const nextCash = { ...cash, [field]: cleanVal };
    setCash(nextCash);

    const computedCashTotal =
      nextCash.b5 * 5 +
      nextCash.b10 * 10 +
      nextCash.b20 * 20 +
      nextCash.b50 * 50 +
      nextCash.b100 * 100 +
      (nextCash.spicci || 0);

    setIsManualEntrate(true);
    setTotaleEntrateMese(Number(computedCashTotal.toFixed(2)));
  };

  const handleClearCash = () => {
    setCash(DEFAULT_CASH);
    setIsManualEntrate(false);
    setTotaleEntrateMese(totalIncomes);
  };

  // Calcolo matematico: le spese vengono prese direttamente dal totale spese mese (totalExpenses)
  const output = calcolaCompensiFineMese({
    totaleEntrateMese,
    totaleSpeseMese: totalExpenses,
    G,
    residuoQuoteTessere,
    sommaOgniNettoSala: historicalNettoSalaSum,
  });

  const handleSyncRealData = () => {
    setIsManualEntrate(false);
    setTotaleEntrateMese(totalIncomes);
  };

  const handleReset = () => {
    if (window.confirm('Vuoi ripristinare i valori dei compensi per questo mese?')) {
      setIsManualEntrate(false);
      setTotaleEntrateMese(totalIncomes);
      setG(defaultG);
      setCash(DEFAULT_CASH);
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

      {/* ── Input Grid Bilanciata (2 Colonne omogenee senza spazi vuoti: Sinistra = Totale Rilevato + Quote Soci, Destra = Conta Banconote & Spicci) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-stretch">
        
        {/* Colonna Sinistra: Totale Rilevato (B2), Riepilogo Costi & Quote e Anticipi Soci */}
        <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-4">
          {/* Parte 1: Totale Rilevato */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                Totale Rilevato
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                Registrate: <strong className="font-mono text-slate-700">{formatCurrency(totalIncomes)}</strong>
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Importo Totale Rilevato:
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
                    setIsManualEntrate(true);
                    setTotaleEntrateMese(val);
                  }}
                  className="w-full pl-7 pr-3 py-2 text-base font-mono font-bold rounded-xl border border-slate-300 bg-white text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-right shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Parte 2: Quote e Anticipi Soci (Gab, Ale, Paolo) integrata nella colonna sinistra per eliminare spazi vuoti */}
          <div className="pt-3 border-t border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                Quote e Anticipi Soci
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Gab */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">
                  Gab (€):
                </label>
                <input
                  type="number"
                  step="any"
                  value={G.G2 === 0 ? '' : G.G2}
                  placeholder="0.00"
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setG((prev) => ({ ...prev, G2: val }));
                  }}
                  className="w-full px-2 py-1 text-xs font-mono font-bold rounded border border-slate-300 bg-slate-50 focus:bg-white text-slate-900 focus:border-blue-500 outline-none transition-all text-right"
                />
              </div>

              {/* Ale */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">
                  Ale (€):
                </label>
                <input
                  type="number"
                  step="any"
                  value={G.G3 === 0 ? '' : G.G3}
                  placeholder="0.00"
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setG((prev) => ({ ...prev, G3: val }));
                  }}
                  className="w-full px-2 py-1 text-xs font-mono font-bold rounded border border-slate-300 bg-slate-50 focus:bg-white text-slate-900 focus:border-blue-500 outline-none transition-all text-right"
                />
              </div>

              {/* Paolo */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">
                  Paolo (€):
                </label>
                <input
                  type="number"
                  step="any"
                  value={G.G4 === 0 ? '' : G.G4}
                  placeholder="0.00"
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setG((prev) => ({ ...prev, G4: val }));
                  }}
                  className="w-full px-2 py-1 text-xs font-mono font-bold rounded border border-slate-300 bg-slate-50 focus:bg-white text-slate-900 focus:border-blue-500 outline-none transition-all text-right"
                />
              </div>
            </div>
          </div>

          {/* Parte 3: Riepilogo Spese & Avanzo Netto */}
          <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-3 text-xs">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
              <span className="text-slate-500 font-medium">Spese Mese:</span>
              <strong className="font-mono text-rose-700">-{formatCurrency(totalExpenses)}</strong>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
              <span className="text-slate-700 font-semibold">Avanzo Netto:</span>
              <strong className={`font-mono text-sm ${output.E2 >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatCurrency(output.E2)}
              </strong>
            </div>
          </div>
        </div>

        {/* Colonna Destra: Conta Banconote & Monete */}
        <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Banknote className="w-3.5 h-3.5 text-emerald-600" />
              Conta Banconote &amp; Monete
            </span>
            {(cash.b5 > 0 || cash.b10 > 0 || cash.b20 > 0 || cash.b50 > 0 || cash.b100 > 0 || cash.spicci > 0) && (
              <button
                type="button"
                onClick={handleClearCash}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
              >
                Azzera pezzi
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex-1 flex flex-col justify-center">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 dark:bg-[#141414] text-slate-600 dark:text-yellow-400 font-bold border-b border-slate-200 dark:border-yellow-500/25">
                  <th className="py-1.5 px-3 text-left">Taglio</th>
                  <th className="py-1.5 px-3 text-center">N. Pezzi</th>
                  <th className="py-1.5 px-3 text-right">Totale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(
                  [
                    { key: 'b5', label: '5 €', val: 5 },
                    { key: 'b10', label: '10 €', val: 10 },
                    { key: 'b20', label: '20 €', val: 20 },
                    { key: 'b50', label: '50 €', val: 50 },
                    { key: 'b100', label: '100 €', val: 100 },
                  ] as const
                ).map((row) => {
                  const count = cash[row.key] || 0;
                  const sub = count * row.val;
                  return (
                    <tr key={row.key} className="hover:bg-slate-50/70">
                      <td className="py-1.5 px-3 font-mono font-bold text-slate-700">{row.label}</td>
                      <td className="py-1.5 px-3 text-center">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={count === 0 ? '' : count}
                          placeholder="0"
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            updateCashField(row.key, Number.isNaN(v) ? 0 : v);
                          }}
                          className="w-20 px-2 py-1 text-center font-mono font-bold text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white text-slate-900 focus:border-emerald-500 outline-none"
                        />
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono font-semibold text-slate-800">
                        {formatCurrency(sub)}
                      </td>
                    </tr>
                  );
                })}
                {/* Riga Monete */}
                <tr className="bg-amber-50/40 dark:bg-[#0d0d0d]">
                  <td className="py-1.5 px-3 font-bold text-amber-900 dark:text-amber-300">Monete (€)</td>
                  <td className="py-1.5 px-3 text-center">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={cash.spicci === 0 ? '' : cash.spicci}
                      placeholder="0,00"
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        updateCashField('spicci', Number.isNaN(v) ? 0 : v);
                      }}
                      className="w-20 px-2 py-1 text-center font-mono font-bold text-xs rounded-lg border border-amber-300 bg-white text-slate-900 focus:border-amber-500 outline-none"
                    />
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono font-semibold text-amber-900 dark:text-amber-300">
                    {formatCurrency(cash.spicci || 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Risultati & Compensi Calcolati in Automatico ── */}
      <div className="space-y-3.5 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Calculator className="w-4 h-4 text-blue-600 dark:text-yellow-400" />
            Risultati &amp; Compensi Spettanti
          </h4>
        </div>

        {/* 1. Riga Superiore: 3 Quadri Principali (Totale Rilevato, Avanzo Netto, Netto Sala) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Card Totale Rilevato */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Totale Rilevato</span>
            <p className="text-2xl font-bold font-mono text-slate-900">{formatCurrency(output.B2)}</p>
          </div>

          {/* Card Avanzo Netto */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Avanzo Netto</span>
            <p className={`text-2xl font-bold font-mono ${output.E2 >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {formatCurrency(output.E2)}
            </p>
          </div>

          {/* Card Netto Sala */}
          <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-[#141414] border border-blue-200 dark:border-yellow-500/30 space-y-1 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-amber-400">Netto Sala</span>
            <p className="text-2xl font-bold font-mono text-blue-900 dark:text-sky-300">{formatCurrency(output.B13)}</p>
          </div>
        </div>

        {/* 2. Sezione Inferiore Ottimizzata: Sinistra (Residuo, Bilancio + Compensi Ristretti) & Destra (Mini Calcolatrice) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
          {/* Lato Sinistro (8/12 = 2/3): Residuo & Bilancio sopra, Compensi Gab/Ale/Paolo subito sotto nello spazio recuperato */}
          <div className="lg:col-span-8 flex flex-col justify-between gap-3">
            {/* Residuo Tessere & Bilancio Tot Sala compatti */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Card Residuo: Quote Tessere */}
              <div className="p-3 sm:p-3.5 rounded-xl bg-indigo-50/70 dark:bg-[#141414] border border-indigo-200 dark:border-yellow-500/30 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-amber-400">Residuo (Tessere)</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border dark:border-yellow-500/35">
                    Fondo Sala
                  </span>
                </div>
                <p className="text-xl sm:text-2xl font-bold font-mono text-indigo-900 dark:text-yellow-200">{formatCurrency(output.residuoQuoteTessere)}</p>
              </div>

              {/* Card Bilancio Tot Sala */}
              <div className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-br from-blue-100/90 to-indigo-100/70 dark:from-[#1c190d] dark:to-[#121212] dark:bg-[#16140c] border border-blue-300 dark:border-yellow-500/45 space-y-1 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 dark:text-yellow-400">Bilancio Tot Sala</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold font-mono text-blue-950 dark:text-yellow-300">{formatCurrency(output.bilancioTotSalaMese)}</p>
              </div>
            </div>

            {/* Compensi Soci Ristretti (Gab, Ale, Paolo) incastrati perfettamente sotto lo spazio vuoto */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Card Gab */}
              <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-50/90 to-emerald-100/50 dark:from-[#0c2118] dark:to-[#111614] dark:bg-[#0e1b15] border border-emerald-200 dark:border-emerald-500/40 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px]">
                      G
                    </div>
                    <span className="text-xs font-bold uppercase text-emerald-950 dark:text-emerald-300">
                      Gab
                    </span>
                  </div>
                  {G.G2 > 0 && (
                    <span className="text-[9px] font-mono text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-200/60 dark:bg-emerald-950 px-1.5 py-0.2 rounded-full">
                      -{G.G2}€
                    </span>
                  )}
                </div>
                <p className="text-xl sm:text-2xl font-black font-mono text-emerald-950 dark:text-emerald-400">
                  {formatCurrency(output.B15)}
                </p>
              </div>

              {/* Card Ale */}
              <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-50/90 to-emerald-100/50 dark:from-[#0c2118] dark:to-[#111614] dark:bg-[#0e1b15] border border-emerald-200 dark:border-emerald-500/40 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px]">
                      A
                    </div>
                    <span className="text-xs font-bold uppercase text-emerald-950 dark:text-emerald-300">
                      Ale
                    </span>
                  </div>
                  {G.G3 > 0 && (
                    <span className="text-[9px] font-mono text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-200/60 dark:bg-emerald-950 px-1.5 py-0.2 rounded-full">
                      -{G.G3}€
                    </span>
                  )}
                </div>
                <p className="text-xl sm:text-2xl font-black font-mono text-emerald-950 dark:text-emerald-400">
                  {formatCurrency(output.B14)}
                </p>
              </div>

              {/* Card Paolo */}
              <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-50/90 to-emerald-100/50 dark:from-[#0c2118] dark:to-[#111614] dark:bg-[#0e1b15] border border-emerald-200 dark:border-emerald-500/40 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px]">
                      P
                    </div>
                    <span className="text-xs font-bold uppercase text-emerald-950 dark:text-emerald-300">
                      Paolo
                    </span>
                  </div>
                  {G.G4 > 0 && (
                    <span className="text-[9px] font-mono text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-200/60 dark:bg-emerald-950 px-1.5 py-0.2 rounded-full">
                      -{G.G4}€
                    </span>
                  )}
                </div>
                <p className="text-xl sm:text-2xl font-black font-mono text-emerald-950 dark:text-emerald-400">
                  {formatCurrency(output.B16)}
                </p>
              </div>
            </div>
          </div>

          {/* Lato Destro (4/12 = 1/3, esattamente sotto Netto Sala): Mini Calcolatrice */}
          <div className="lg:col-span-4 flex flex-col">
            <MiniStudioCalculator />
          </div>
        </div>
      </div>
    </div>
  );
};
