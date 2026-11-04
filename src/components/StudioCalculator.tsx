import React, { useState, useEffect, useCallback } from 'react';
import { Calculator, Copy, Check, RotateCcw, Delete, History } from 'lucide-react';

interface CalcHistoryItem {
  id: string;
  expression: string;
  result: string;
}

interface StudioCalculatorProps {
  compact?: boolean;
  title?: string;
  subtitle?: string;
}

export const StudioCalculator: React.FC<StudioCalculatorProps> = ({
  compact = false,
  title = 'Calcolatrice Rapida Studio',
  subtitle = 'Calcoli immediati per quote, resti, divisioni soci e ore lezioni (supporta anche la tastiera)',
}) => {
  const [display, setDisplay] = useState<string>('0');
  const [expression, setExpression] = useState<string>('');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState<boolean>(false);
  const [history, setHistory] = useState<CalcHistoryItem[]>([]);
  const [copied, setCopied] = useState<boolean>(false);

  const formatNum = (num: number): string => {
    if (!Number.isFinite(num)) return 'Errore';
    const rounded = Math.round((num + Number.EPSILON) * 10000) / 10000;
    return String(rounded);
  };

  const inputDigit = useCallback(
    (digit: string) => {
      if (waitingForOperand) {
        setDisplay(digit);
        setWaitingForOperand(false);
      } else {
        setDisplay(display === '0' || display === 'Errore' ? digit : display + digit);
      }
    },
    [display, waitingForOperand]
  );

  const inputDecimal = useCallback(() => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  }, [display, waitingForOperand]);

  const clearAll = useCallback(() => {
    setDisplay('0');
    setExpression('');
    setPrevValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  }, []);

  const backspace = useCallback(() => {
    if (waitingForOperand || display === 'Errore') return;
    setDisplay(display.length > 1 ? display.slice(0, -1) : '0');
  }, [display, waitingForOperand]);

  const toggleSign = useCallback(() => {
    const val = parseFloat(display);
    if (val === 0 || Number.isNaN(val)) return;
    setDisplay(String(val * -1));
  }, [display]);

  const inputPercent = useCallback(() => {
    const val = parseFloat(display);
    if (Number.isNaN(val)) return;
    const newVal = prevValue !== null && (operator === '+' || operator === '-')
      ? (prevValue * val) / 100
      : val / 100;
    setDisplay(formatNum(newVal));
  }, [display, prevValue, operator]);

  const calculate = (left: number, right: number, op: string): number => {
    switch (op) {
      case '+':
        return left + right;
      case '-':
        return left - right;
      case '×':
      case '*':
        return left * right;
      case '÷':
      case '/':
        return right === 0 ? NaN : left / right;
      default:
        return right;
    }
  };

  const performOperation = useCallback(
    (nextOperator: string) => {
      const inputValue = parseFloat(display);
      if (Number.isNaN(inputValue)) {
        clearAll();
        return;
      }

      if (prevValue === null) {
        setPrevValue(inputValue);
        setOperator(nextOperator);
        setWaitingForOperand(true);
        setExpression(`${formatNum(inputValue)} ${nextOperator}`);
      } else if (operator) {
        if (waitingForOperand) {
          setOperator(nextOperator);
          setExpression(`${formatNum(prevValue)} ${nextOperator}`);
          return;
        }
        const result = calculate(prevValue, inputValue, operator);
        const formattedResult = formatNum(result);

        if (formattedResult !== 'Errore') {
          setHistory((prev) => [
            {
              id: `${Date.now()}-${Math.random()}`,
              expression: `${formatNum(prevValue)} ${operator} ${formatNum(inputValue)}`,
              result: formattedResult,
            },
            ...prev.slice(0, 7),
          ]);
        }

        setDisplay(formattedResult);
        setPrevValue(Number.isFinite(result) ? result : null);
        setOperator(nextOperator);
        setWaitingForOperand(true);
        setExpression(`${formattedResult} ${nextOperator}`);
      }
    },
    [display, operator, prevValue, waitingForOperand, clearAll]
  );

  const performEquals = useCallback(() => {
    const inputValue = parseFloat(display);
    if (prevValue === null || !operator || Number.isNaN(inputValue)) return;

    const result = calculate(prevValue, inputValue, operator);
    const formattedResult = formatNum(result);
    const fullExpr = `${formatNum(prevValue)} ${operator} ${formatNum(inputValue)}`;

    if (formattedResult !== 'Errore') {
      setHistory((prev) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          expression: fullExpr,
          result: formattedResult,
        },
        ...prev.slice(0, 7),
      ]);
    }

    setDisplay(formattedResult);
    setExpression(`${fullExpr} =`);
    setPrevValue(null);
    setOperator(null);
    setWaitingForOperand(true);
  }, [display, operator, prevValue]);

  const applyQuickAction = (action: 'div3' | 'mul5' | 'add10' | 'ceil') => {
    const val = parseFloat(display);
    if (Number.isNaN(val)) return;
    let res = val;
    let label = '';
    if (action === 'div3') {
      res = val / 3;
      label = `${formatNum(val)} ÷ 3 (Quote Soci)`;
    } else if (action === 'mul5') {
      res = val * 5;
      label = `${formatNum(val)}h × 5€ (Quota Sala)`;
    } else if (action === 'add10') {
      res = val + 10;
      label = `${formatNum(val)} + 10€ (Tessera)`;
    } else if (action === 'ceil') {
      res = Math.ceil(val);
      label = `Arrotonda ↑ (${formatNum(val)})`;
    }
    const formatted = formatNum(res);
    setDisplay(formatted);
    setExpression(`${label} =`);
    setWaitingForOperand(true);
    setHistory((prev) => [
      { id: `${Date.now()}-${Math.random()}`, expression: label, result: formatted },
      ...prev.slice(0, 7),
    ]);
  };

  const handleCopy = () => {
    if (navigator.clipboard && display !== 'Errore') {
      navigator.clipboard.writeText(display.replace('.', ','));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <div className="bg-white dark:bg-[#0e0e0e] rounded-2xl border border-slate-200 dark:border-yellow-500/25 shadow-xs overflow-hidden print:hidden">
      {/* Header Bar */}
      <div className="px-4 py-3 bg-slate-50 dark:bg-[#141414] border-b border-slate-200 dark:border-yellow-500/20 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 dark:bg-yellow-400 text-white dark:text-black flex items-center justify-center shadow-2xs shrink-0">
            <Calculator className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-yellow-400 leading-tight">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[11px] text-slate-500 dark:text-yellow-100/60 leading-tight">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Quick Studio Formula Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => applyQuickAction('div3')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-yellow-300 dark:border-yellow-500/30 transition-colors cursor-pointer"
            title="Dividi l'importo attuale per 3 soci"
          >
            ÷ 3 Soci
          </button>
          <button
            type="button"
            onClick={() => applyQuickAction('mul5')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-yellow-300 dark:border-yellow-500/30 transition-colors cursor-pointer"
            title="Moltiplica le ore inserite per 5€/ora (Quota Sala Insegnanti)"
          >
            × 5€/h Lezioni
          </button>
          <button
            type="button"
            onClick={() => applyQuickAction('add10')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-yellow-300 dark:border-yellow-500/30 transition-colors cursor-pointer"
            title="Aggiungi +10€ di quota tesseramento"
          >
            + 10€ Tessera
          </button>
          <button
            type="button"
            onClick={() => applyQuickAction('ceil')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-yellow-300 dark:border-yellow-500/30 transition-colors cursor-pointer"
            title="Arrotonda per eccesso all'euro intero"
          >
            Arrotonda ↑
          </button>
        </div>
      </div>

      {/* Main Content Grid: Incastrata e compatta */}
      <div className={`p-3.5 sm:p-4 grid grid-cols-1 ${compact ? 'lg:grid-cols-12' : 'md:grid-cols-12'} gap-4 items-stretch`}>
        {/* Left/Center: Display + Keypad */}
        <div className={`${compact ? 'lg:col-span-7' : 'md:col-span-7 lg:col-span-8'} flex flex-col justify-between gap-3`}>
          {/* Display Screen */}
          <div className="bg-slate-900 dark:bg-[#080808] rounded-xl p-3 sm:p-3.5 border border-slate-800 dark:border-yellow-500/30 flex items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleCopy}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-yellow-400 border border-yellow-500/30 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                title="Copia risultato negli appunti"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiato' : 'Copia'}</span>
              </button>
            </div>

            <div className="text-right min-w-0 flex-1">
              <div className="text-[11px] font-mono text-yellow-400/70 h-4 truncate">
                {expression || '\u00A0'}
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-yellow-400 tracking-tight truncate">
                {display.replace('.', ',')}
              </div>
            </div>
          </div>

          {/* Keypad Grid (5 columns on desktop for ultra-low vertical profile, 4 columns on mobile) */}
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 sm:gap-2">
            {/* Row 1 */}
            <button
              type="button"
              onClick={clearAll}
              className="min-h-[42px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs sm:text-sm transition-all cursor-pointer shadow-2xs active:scale-95"
              style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
            >
              AC
            </button>
            <button
              type="button"
              onClick={backspace}
              className="min-h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-slate-700 dark:text-yellow-300 border border-slate-200 dark:border-yellow-500/20 font-bold text-xs flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title="Cancella ultima cifra"
            >
              <Delete className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={inputPercent}
              className="min-h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-slate-700 dark:text-yellow-300 border border-slate-200 dark:border-yellow-500/20 font-extrabold text-sm transition-all cursor-pointer active:scale-95"
            >
              %
            </button>
            <button
              type="button"
              onClick={() => performOperation('÷')}
              className={`min-h-[42px] rounded-xl font-extrabold text-base transition-all cursor-pointer active:scale-95 ${
                operator === '÷'
                  ? 'bg-blue-600 text-white dark:bg-yellow-400 dark:text-black'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-yellow-400 dark:border-yellow-500/30'
              }`}
            >
              ÷
            </button>
            <button
              type="button"
              onClick={toggleSign}
              className="hidden sm:flex min-h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-slate-700 dark:text-yellow-300 border border-slate-200 dark:border-yellow-500/20 font-bold text-xs items-center justify-center transition-all cursor-pointer active:scale-95"
            >
              ±
            </button>

            {/* Row 2 */}
            {['7', '8', '9'].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => inputDigit(n)}
                className="min-h-[42px] rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#141414] dark:hover:bg-neutral-800 text-slate-900 dark:text-yellow-100 border border-slate-200/80 dark:border-yellow-500/15 font-extrabold font-mono text-base transition-all cursor-pointer active:scale-95"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => performOperation('×')}
              className={`min-h-[42px] rounded-xl font-extrabold text-base transition-all cursor-pointer active:scale-95 ${
                operator === '×'
                  ? 'bg-blue-600 text-white dark:bg-yellow-400 dark:text-black'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-yellow-400 dark:border-yellow-500/30'
              }`}
            >
              ×
            </button>
            <button
              type="button"
              onClick={() => inputDigit('00')}
              className="hidden sm:flex min-h-[42px] rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#141414] dark:hover:bg-neutral-800 text-slate-700 dark:text-yellow-200 border border-slate-200/80 dark:border-yellow-500/15 font-extrabold font-mono text-xs items-center justify-center transition-all cursor-pointer active:scale-95"
            >
              00
            </button>

            {/* Row 3 */}
            {['4', '5', '6'].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => inputDigit(n)}
                className="min-h-[42px] rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#141414] dark:hover:bg-neutral-800 text-slate-900 dark:text-yellow-100 border border-slate-200/80 dark:border-yellow-500/15 font-extrabold font-mono text-base transition-all cursor-pointer active:scale-95"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => performOperation('-')}
              className={`min-h-[42px] rounded-xl font-extrabold text-base transition-all cursor-pointer active:scale-95 ${
                operator === '-'
                  ? 'bg-blue-600 text-white dark:bg-yellow-400 dark:text-black'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-yellow-400 dark:border-yellow-500/30'
              }`}
            >
              −
            </button>
            <button
              type="button"
              onClick={() => performOperation('+')}
              className={`hidden sm:flex min-h-[42px] rounded-xl font-extrabold text-base items-center justify-center transition-all cursor-pointer active:scale-95 ${
                operator === '+'
                  ? 'bg-blue-600 text-white dark:bg-yellow-400 dark:text-black'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-yellow-400 dark:border-yellow-500/30'
              }`}
            >
              +
            </button>

            {/* Row 4 */}
            {['1', '2', '3'].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => inputDigit(n)}
                className="min-h-[42px] rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#141414] dark:hover:bg-neutral-800 text-slate-900 dark:text-yellow-100 border border-slate-200/80 dark:border-yellow-500/15 font-extrabold font-mono text-base transition-all cursor-pointer active:scale-95"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => performOperation('+')}
              className={`sm:hidden min-h-[42px] rounded-xl font-extrabold text-base transition-all cursor-pointer active:scale-95 ${
                operator === '+'
                  ? 'bg-blue-600 text-white dark:bg-yellow-400 dark:text-black'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-yellow-400 dark:border-yellow-500/30'
              }`}
            >
              +
            </button>
            <button
              type="button"
              onClick={inputDecimal}
              className="hidden sm:flex min-h-[42px] rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#141414] dark:hover:bg-neutral-800 text-slate-900 dark:text-yellow-100 border border-slate-200/80 dark:border-yellow-500/15 font-extrabold font-mono text-lg items-center justify-center transition-all cursor-pointer active:scale-95"
            >
              ,
            </button>
            <button
              type="button"
              onClick={performEquals}
              className="hidden sm:flex min-h-[42px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white dark:bg-yellow-400 dark:hover:bg-yellow-300 dark:text-black font-extrabold text-base items-center justify-center shadow-xs transition-all cursor-pointer active:scale-95"
            >
              =
            </button>

            {/* Row 5 (Mobile only bottom row + Desktop 0 button) */}
            <button
              type="button"
              onClick={() => inputDigit('0')}
              className="col-span-2 sm:col-span-5 min-h-[40px] rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#141414] dark:hover:bg-neutral-800 text-slate-900 dark:text-yellow-100 border border-slate-200/80 dark:border-yellow-500/15 font-extrabold font-mono text-base transition-all cursor-pointer active:scale-95"
            >
              0
            </button>
            <button
              type="button"
              onClick={inputDecimal}
              className="sm:hidden min-h-[42px] rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#141414] dark:hover:bg-neutral-800 text-slate-900 dark:text-yellow-100 border border-slate-200/80 dark:border-yellow-500/15 font-extrabold font-mono text-lg transition-all cursor-pointer active:scale-95"
            >
              ,
            </button>
            <button
              type="button"
              onClick={performEquals}
              className="sm:hidden min-h-[42px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white dark:bg-yellow-400 dark:hover:bg-yellow-300 dark:text-black font-extrabold text-base shadow-xs transition-all cursor-pointer active:scale-95"
            >
              =
            </button>
          </div>
        </div>

        {/* Right: Calculation Tape / History (Click any row to reuse value) */}
        <div className={`${compact ? 'lg:col-span-5' : 'md:col-span-5 lg:col-span-4'} bg-slate-50 dark:bg-[#121212] rounded-xl border border-slate-200 dark:border-yellow-500/20 p-3 flex flex-col justify-between min-h-[180px]`}>
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-yellow-500/20">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-yellow-400 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              <span>Cronologia Operazioni</span>
            </span>
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => setHistory([])}
                className="text-[10px] font-semibold text-slate-400 hover:text-rose-500 dark:text-yellow-500/60 dark:hover:text-rose-400 flex items-center gap-1 cursor-pointer"
                title="Svuota cronologia"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Pulisci</span>
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6 px-2">
              <p className="text-xs font-medium text-slate-400 dark:text-neutral-500">
                Nessun calcolo recente.
              </p>
              <p className="text-[10px] text-slate-400 dark:text-neutral-600 mt-0.5">
                Clicca su un risultato salvato qui per riutilizzarlo subito nei conti.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto max-h-[210px] divide-y divide-slate-200/70 dark:divide-yellow-500/15 my-1 pr-1 custom-scrollbar">
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setDisplay(item.result);
                    setWaitingForOperand(false);
                  }}
                  className="w-full py-2 px-2 text-right hover:bg-white dark:hover:bg-neutral-900 rounded-lg transition-colors flex items-center justify-between gap-2 cursor-pointer group"
                  title="Clicca per richiamare questo valore sul display"
                >
                  <span className="text-[11px] font-mono text-slate-500 dark:text-neutral-400 truncate">
                    {item.expression.replace(/\./g, ',')} =
                  </span>
                  <strong className="text-xs font-extrabold font-mono text-blue-600 dark:text-yellow-400 group-hover:scale-105 transition-transform shrink-0">
                    {item.result.replace('.', ',')}
                  </strong>
                </button>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 dark:border-yellow-500/15 flex items-center justify-between text-[10px] text-slate-400 dark:text-neutral-500">
            <span>Tocca una riga per richiamare l&apos;importo</span>
            <span className="font-mono">A4 = 440Hz Studio</span>
          </div>
        </div>
      </div>
    </div>
  );
};

