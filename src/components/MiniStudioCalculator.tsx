import React, { useState, useCallback } from 'react';
import { Calculator, Copy, Check, Delete } from 'lucide-react';

export const MiniStudioCalculator: React.FC = () => {
  const [display, setDisplay] = useState<string>('0');
  const [expression, setExpression] = useState<string>('');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const formatNum = (num: number): string => {
    if (!Number.isFinite(num)) return 'Err';
    const rounded = Math.round((num + Number.EPSILON) * 1000) / 1000;
    return String(rounded);
  };

  const inputDigit = useCallback(
    (digit: string) => {
      if (waitingForOperand) {
        setDisplay(digit);
        setWaitingForOperand(false);
      } else {
        setDisplay(display === '0' || display === 'Err' ? digit : display + digit);
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
    if (waitingForOperand || display === 'Err') return;
    setDisplay(display.length > 1 ? display.slice(0, -1) : '0');
  }, [display, waitingForOperand]);

  const inputPercent = useCallback(() => {
    const val = parseFloat(display);
    if (Number.isNaN(val)) return;
    const newVal =
      prevValue !== null && (operator === '+' || operator === '-')
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
        return left * right;
      case '÷':
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

    setDisplay(formattedResult);
    setExpression(`${fullExpr} =`);
    setPrevValue(null);
    setOperator(null);
    setWaitingForOperand(true);
  }, [display, operator, prevValue]);

  const applyQuickAction = (action: 'div3' | 'mul5' | 'add10') => {
    const val = parseFloat(display);
    if (Number.isNaN(val)) return;
    let res = val;
    let label = '';
    if (action === 'div3') {
      res = val / 3;
      label = `${formatNum(val)} ÷ 3`;
    } else if (action === 'mul5') {
      res = val * 5;
      label = `${formatNum(val)} × 5€`;
    } else if (action === 'add10') {
      res = val + 10;
      label = `${formatNum(val)} + 10€`;
    }
    const formatted = formatNum(res);
    setDisplay(formatted);
    setExpression(`${label} =`);
    setWaitingForOperand(true);
  };

  const handleCopy = () => {
    if (navigator.clipboard && display !== 'Err') {
      navigator.clipboard.writeText(display.replace('.', ','));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  };

  return (
    <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-yellow-500/30 flex flex-col justify-between shadow-2xs space-y-2">
      {/* Header compatto */}
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-yellow-500/20">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-md bg-blue-600 text-white dark:bg-yellow-400 dark:text-black flex items-center justify-center shrink-0">
            <Calculator className="w-3 h-3 stroke-[2.5]" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-yellow-400 truncate">
            Calcolatrice Rapida
          </span>
        </div>

        {/* Formule rapide studio */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => applyQuickAction('div3')}
            className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-yellow-300 dark:border-yellow-500/30 transition-colors cursor-pointer"
            title="Dividi l'importo per i 3 soci"
          >
            ÷3 Soci
          </button>
          <button
            type="button"
            onClick={() => applyQuickAction('mul5')}
            className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-yellow-300 dark:border-yellow-500/30 transition-colors cursor-pointer"
            title="Moltiplica le ore per 5€ (Quota Sala Docenti)"
          >
            ×5€
          </button>
          <button
            type="button"
            onClick={() => applyQuickAction('add10')}
            className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-yellow-300 dark:border-yellow-500/30 transition-colors cursor-pointer"
            title="Aggiungi 10€ di tesseramento"
          >
            +10€
          </button>
        </div>
      </div>

      {/* Mini Display LCD */}
      <div className="bg-slate-900 dark:bg-[#090909] rounded-lg px-2.5 py-1.5 border border-slate-800 dark:border-yellow-500/30 flex items-center justify-between gap-2 shadow-inner">
        <button
          type="button"
          onClick={handleCopy}
          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-yellow-400 border border-yellow-500/30 text-[10px] flex items-center gap-1 transition-all cursor-pointer shrink-0"
          title="Copia valore negli appunti"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span className="text-[9px] font-bold">{copied ? 'OK' : 'Copia'}</span>
        </button>

        <div className="text-right min-w-0 flex-1">
          <div className="text-[9px] font-mono text-yellow-400/70 h-3 truncate">
            {expression || '\u00A0'}
          </div>
          <div className="text-lg font-black font-mono text-yellow-400 tracking-tight truncate leading-tight">
            {display.replace('.', ',')}
          </div>
        </div>
      </div>

      {/* Mini Tastierino a 4 colonne compatto */}
      <div className="grid grid-cols-4 gap-1 pt-0.5">
        {/* Riga 1 */}
        <button
          type="button"
          onClick={clearAll}
          className="h-7 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] transition-all cursor-pointer shadow-2xs active:scale-95"
          style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
        >
          C
        </button>
        <button
          type="button"
          onClick={backspace}
          className="h-7 rounded-md bg-white hover:bg-slate-100 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-slate-700 dark:text-yellow-300 border border-slate-200 dark:border-yellow-500/20 font-bold text-xs flex items-center justify-center transition-all cursor-pointer active:scale-95"
          title="Cancella ultima cifra"
        >
          <Delete className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={inputPercent}
          className="h-7 rounded-md bg-white hover:bg-slate-100 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-slate-700 dark:text-yellow-300 border border-slate-200 dark:border-yellow-500/20 font-black text-xs transition-all cursor-pointer active:scale-95"
        >
          %
        </button>
        <button
          type="button"
          onClick={() => performOperation('÷')}
          className={`h-7 rounded-md font-black text-xs transition-all cursor-pointer active:scale-95 ${
            operator === '÷'
              ? 'bg-blue-600 text-white dark:bg-yellow-400 dark:text-black'
              : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-yellow-400 dark:border-yellow-500/30'
          }`}
        >
          ÷
        </button>

        {/* Riga 2 */}
        {['7', '8', '9'].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => inputDigit(n)}
            className="h-7 rounded-md bg-white hover:bg-slate-100 dark:bg-[#0d0d0d] dark:hover:bg-neutral-800 text-slate-900 dark:text-yellow-100 border border-slate-200 dark:border-yellow-500/15 font-black font-mono text-xs transition-all cursor-pointer active:scale-95"
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => performOperation('×')}
          className={`h-7 rounded-md font-black text-xs transition-all cursor-pointer active:scale-95 ${
            operator === '×'
              ? 'bg-blue-600 text-white dark:bg-yellow-400 dark:text-black'
              : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-yellow-400 dark:border-yellow-500/30'
          }`}
        >
          ×
        </button>

        {/* Riga 3 */}
        {['4', '5', '6'].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => inputDigit(n)}
            className="h-7 rounded-md bg-white hover:bg-slate-100 dark:bg-[#0d0d0d] dark:hover:bg-neutral-800 text-slate-900 dark:text-yellow-100 border border-slate-200 dark:border-yellow-500/15 font-black font-mono text-xs transition-all cursor-pointer active:scale-95"
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => performOperation('-')}
          className={`h-7 rounded-md font-black text-xs transition-all cursor-pointer active:scale-95 ${
            operator === '-'
              ? 'bg-blue-600 text-white dark:bg-yellow-400 dark:text-black'
              : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-yellow-400 dark:border-yellow-500/30'
          }`}
        >
          −
        </button>

        {/* Riga 4 */}
        {['1', '2', '3'].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => inputDigit(n)}
            className="h-7 rounded-md bg-white hover:bg-slate-100 dark:bg-[#0d0d0d] dark:hover:bg-neutral-800 text-slate-900 dark:text-yellow-100 border border-slate-200 dark:border-yellow-500/15 font-black font-mono text-xs transition-all cursor-pointer active:scale-95"
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => performOperation('+')}
          className={`h-7 rounded-md font-black text-xs transition-all cursor-pointer active:scale-95 ${
            operator === '+'
              ? 'bg-blue-600 text-white dark:bg-yellow-400 dark:text-black'
              : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-yellow-400 dark:border-yellow-500/30'
          }`}
        >
          +
        </button>

        {/* Riga 5 */}
        <button
          type="button"
          onClick={() => inputDigit('0')}
          className="h-7 rounded-md bg-white hover:bg-slate-100 dark:bg-[#0d0d0d] dark:hover:bg-neutral-800 text-slate-900 dark:text-yellow-100 border border-slate-200 dark:border-yellow-500/15 font-black font-mono text-xs transition-all cursor-pointer active:scale-95"
        >
          0
        </button>
        <button
          type="button"
          onClick={inputDecimal}
          className="h-7 rounded-md bg-white hover:bg-slate-100 dark:bg-[#0d0d0d] dark:hover:bg-neutral-800 text-slate-900 dark:text-yellow-100 border border-slate-200 dark:border-yellow-500/15 font-black font-mono text-xs transition-all cursor-pointer active:scale-95"
        >
          ,
        </button>
        <button
          type="button"
          onClick={() => applyQuickAction('div3')}
          className="h-7 rounded-md bg-indigo-50 hover:bg-indigo-100 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-indigo-700 dark:text-yellow-300 border border-indigo-200 dark:border-yellow-500/30 font-black text-[10px] transition-all cursor-pointer active:scale-95"
          title="Dividi valore sul display per 3 soci"
        >
          ÷3
        </button>
        <button
          type="button"
          onClick={performEquals}
          className="h-7 rounded-md bg-blue-600 hover:bg-blue-700 text-white dark:bg-yellow-400 dark:hover:bg-yellow-300 dark:text-black font-black text-xs shadow-2xs transition-all cursor-pointer active:scale-95"
        >
          =
        </button>
      </div>
    </div>
  );
};
