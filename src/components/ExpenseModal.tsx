import React, { useEffect, useState } from 'react';
import { X, Receipt, CheckCircle2, Calendar } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Expense, ExpenseCategory } from '../types';
import { formatDateToISO, getPreviousMonthStr, MESI_ITALIANI } from '../utils/dateUtils';
import { handleNumericFocus, handleNumericClick, handleNumericBlur } from '../utils/inputUtils';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenseToEdit?: Expense | null;
}

export const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string; icon: string }[] = [
  { id: 'affitto', label: 'Affitto Locale Sala', icon: '🏢' },
  { id: 'energia', label: 'Energia Elettrica (Luce/Clima)', icon: '⚡' },
  { id: 'acqua', label: 'Acqua / Utenze Idriche', icon: '💧' },
  { id: 'manutenzione', label: 'Manutenzione & Riparazioni', icon: '🔧' },
  { id: 'attrezzatura', label: 'Acquisto Strumenti & Cavi', icon: '🎸' },
  { id: 'compensi_personale', label: 'Compensi / Rimborsi Operatori', icon: '👥' },
  { id: 'tesseramenti_costi', label: 'Costi Affiliazioni / SIAE / Assicurazioni', icon: '📋' },
  { id: 'pulizie', label: 'Pulizie & Sanificazione', icon: '🧹' },
  { id: 'commercialista', label: 'Commercialista & Fiscale', icon: '💼' },
  { id: 'altro', label: 'Altre Spese di Gestione', icon: '📦' },
];

export const ExpenseModal: React.FC<ExpenseModalProps> = ({ isOpen, onClose, expenseToEdit }) => {
  const { addExpense, updateExpense } = useApp();

  const [data, setData] = useState(formatDateToISO(new Date()));
  const [categoria, setCategoria] = useState<ExpenseCategory>('energia');
  const [descrizione, setDescrizione] = useState('');
  const [importo, setImporto] = useState<number | string>('');
  const [metodoPagamento, setMetodoPagamento] = useState<'bonifico' | 'pos' | 'contanti' | 'addebito_diretto'>('bonifico');
  const [fornitore, setFornitore] = useState('');
  const [numeroFatturaRicevuta, setNumeroFatturaRicevuta] = useState('');
  const [stato, setStato] = useState<'pagato' | 'in_scadenza'>('pagato');
  const [note, setNote] = useState('');
  const [cicloPagamento, setCicloPagamento] = useState<'corrente' | 'posticipato'>('corrente');
  const [meseCompetenza, setMeseCompetenza] = useState<string>('');

  useEffect(() => {
    if (expenseToEdit) {
      setData(expenseToEdit.data);
      setCategoria(expenseToEdit.categoria);
      setDescrizione(expenseToEdit.descrizione);
      setImporto(expenseToEdit.importo);
      setMetodoPagamento(expenseToEdit.metodoPagamento);
      setFornitore(expenseToEdit.fornitore || '');
      setNumeroFatturaRicevuta(expenseToEdit.numeroFatturaRicevuta || '');
      setStato(expenseToEdit.stato);
      setNote(expenseToEdit.note || '');
      
      const isPost = expenseToEdit.cicloPagamento === 'posticipato' || expenseToEdit.categoria === 'affitto';
      setCicloPagamento(isPost ? 'posticipato' : 'corrente');
      setMeseCompetenza(
        expenseToEdit.meseCompetenza ||
        (isPost ? getPreviousMonthStr(expenseToEdit.data.substring(0, 7)) : expenseToEdit.data.substring(0, 7))
      );
    } else {
      const todayIso = formatDateToISO(new Date());
      setData(todayIso);
      setCategoria('energia');
      setDescrizione('');
      setImporto('');
      setMetodoPagamento('bonifico');
      setFornitore('');
      setNumeroFatturaRicevuta('');
      setStato('pagato');
      setNote('');
      setCicloPagamento('corrente');
      setMeseCompetenza(todayIso.substring(0, 7));
    }
  }, [expenseToEdit, isOpen]);

  if (!isOpen) return null;

  const handleCategoryChange = (newCat: ExpenseCategory) => {
    setCategoria(newCat);
    if (newCat === 'affitto') {
      setCicloPagamento('posticipato');
      const prevMonth = getPreviousMonthStr(data.substring(0, 7));
      setMeseCompetenza(prevMonth);
      if (!descrizione.trim() || descrizione.toLowerCase().includes('canone') || descrizione.toLowerCase().includes('affitto')) {
        const [py, pm] = prevMonth.split('-').map(Number);
        setDescrizione(`Canone Affitto ${MESI_ITALIANI[pm - 1]} ${py}`);
      }
    } else if (cicloPagamento === 'posticipato' && (!expenseToEdit || expenseToEdit.categoria === 'affitto')) {
      setCicloPagamento('corrente');
      setMeseCompetenza(data.substring(0, 7));
    }
  };

  const handleDataChange = (newData: string) => {
    setData(newData);
    const dataMonth = newData.substring(0, 7);
    if (cicloPagamento === 'posticipato') {
      setMeseCompetenza(getPreviousMonthStr(dataMonth));
    } else {
      setMeseCompetenza(dataMonth);
    }
  };

  const handleCicloChange = (newCiclo: 'corrente' | 'posticipato') => {
    setCicloPagamento(newCiclo);
    const dataMonth = data.substring(0, 7);
    if (newCiclo === 'posticipato') {
      setMeseCompetenza(getPreviousMonthStr(dataMonth));
    } else {
      setMeseCompetenza(dataMonth);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!descrizione.trim() || !importo) return;

    const finalMeseCompetenza = meseCompetenza || (
      cicloPagamento === 'posticipato' ? getPreviousMonthStr(data.substring(0, 7)) : data.substring(0, 7)
    );

    if (expenseToEdit) {
      updateExpense({
        ...expenseToEdit,
        data,
        categoria,
        descrizione: descrizione.trim(),
        importo: Number(String(importo).replace(',', '.')) || 0,
        metodoPagamento,
        fornitore: fornitore.trim() || undefined,
        numeroFatturaRicevuta: numeroFatturaRicevuta.trim() || undefined,
        stato,
        note: note.trim() || undefined,
        meseCompetenza: finalMeseCompetenza,
        cicloPagamento,
      });
    } else {
      addExpense({
        data,
        categoria,
        descrizione: descrizione.trim(),
        importo: Number(String(importo).replace(',', '.')) || 0,
        metodoPagamento,
        fornitore: fornitore.trim() || undefined,
        numeroFatturaRicevuta: numeroFatturaRicevuta.trim() || undefined,
        stato,
        note: note.trim() || undefined,
        meseCompetenza: finalMeseCompetenza,
        cicloPagamento,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/90 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-yellow-400/10 border border-blue-200/80 dark:border-yellow-500/30 flex items-center justify-center text-blue-600 dark:text-yellow-400 shrink-0 shadow-2xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-snug truncate">
                {expenseToEdit ? 'Modifica Spesa' : 'Registra Nuova Spesa'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400 font-normal truncate mt-0.5">
                Utenze, affitto, manutenzioni e costi operativi della sala prove
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Categoria */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Categoria di Spesa *
            </label>
            <select
              value={categoria}
              onChange={(e) => handleCategoryChange(e.target.value as ExpenseCategory)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Ciclo e Mese di Competenza Economica (Particolarmente dedicato all'Affitto Locale Sala) */}
          <div className="p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/60 dark:bg-neutral-900 dark:border-neutral-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-indigo-950 dark:text-neutral-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Ciclo di Competenza Economica:</span>
              </span>
              <div className="flex items-center bg-white dark:bg-neutral-800 rounded-lg p-0.5 border border-indigo-200 dark:border-neutral-700 text-xs">
                <button
                  type="button"
                  onClick={() => handleCicloChange('posticipato')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    cicloPagamento === 'posticipato'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-neutral-300 hover:text-slate-900'
                  }`}
                  title="Il canone pagato a inizio mese M viene coperto con i soldi maturati nel mese M-1"
                >
                  ⏳ Posticipato (Mese Prec.)
                </button>
                <button
                  type="button"
                  onClick={() => handleCicloChange('corrente')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    cicloPagamento === 'corrente'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-neutral-300 hover:text-slate-900'
                  }`}
                  title="Contabilizzato nello stesso mese della data del pagamento"
                >
                  📅 Mese Corrente
                </button>
              </div>
            </div>

            <p className="text-[11px] text-indigo-900/80 dark:text-neutral-400 leading-snug">
              {cicloPagamento === 'posticipato' ? (
                <span>
                  💡 <strong>Ciclo Posticipato:</strong> La spesa (es. canone affitto del 10 del mese) viene imputata al conto del <strong>mese precedente</strong> e coperta con i proventi maturati in quel mese.
                </span>
              ) : (
                <span>
                  💡 <strong>Ciclo Corrente:</strong> La spesa viene imputata direttamente al conto del mese della data di pagamento.
                </span>
              )}
            </p>

            <div className="flex items-center gap-2 pt-1 border-t border-indigo-100/80 dark:border-neutral-800">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-neutral-300 whitespace-nowrap">
                Imputa al Conto Mese:
              </label>
              <input
                type="month"
                value={meseCompetenza}
                onChange={(e) => setMeseCompetenza(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-bold text-xs text-indigo-900 dark:text-white"
              />
              <span className="text-[10px] text-slate-500 font-mono">
                {(() => {
                  if (!meseCompetenza || !meseCompetenza.includes('-')) return '';
                  const [y, m] = meseCompetenza.split('-').map(Number);
                  return `(${MESI_ITALIANI[m - 1]} ${y})`;
                })()}
              </span>
            </div>
          </div>

          {/* Descrizione */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Descrizione Spesa *
            </label>
            <input
              type="text"
              required
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
              placeholder="Es. Bolletta Enel Bimestre Luglio/Agosto, Canone Affitto Mese..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Importo & Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Importo (€) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={importo}
                  onFocus={handleNumericFocus}
                  onClick={handleNumericClick}
                  onBlur={handleNumericBlur}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*([.,]\d*)?$/.test(val)) {
                      setImporto(val);
                    }
                  }}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white font-bold text-base text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
                <span className="absolute right-3.5 top-2.5 text-sm font-semibold text-slate-400">€</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Data Pagamento / Scadenza *</label>
              <input
                type="date"
                required
                value={data}
                onChange={(e) => handleDataChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Metodo & Stato */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Metodo Pagamento
              </label>
              <select
                value={metodoPagamento}
                onChange={(e) => setMetodoPagamento(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="bonifico">Bonifico Bancario</option>
                <option value="addebito_diretto">Addebito Diretto (SDD/RID)</option>
                <option value="pos">Carta / POS</option>
                <option value="contanti">Contanti</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Stato Spesa</label>
              <select
                value={stato}
                onChange={(e) => setStato(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="pagato">✅ Pagato</option>
                <option value="in_scadenza">⏳ In Scadenza / Da saldare</option>
              </select>
            </div>
          </div>

          {/* Fornitore & N. Fattura */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Fornitore / Beneficiario
              </label>
              <input
                type="text"
                value={fornitore}
                onChange={(e) => setFornitore(e.target.value)}
                placeholder="Es. Enel, Proprietario immobile, Store..."
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                N. Fattura / Ricevuta
              </label>
              <input
                type="text"
                value={numeroFatturaRicevuta}
                onChange={(e) => setNumeroFatturaRicevuta(e.target.value)}
                placeholder="FATT-2026-..."
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Note Spesa</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Eventuali dettagli o annotazioni per il commercialista..."
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Footer actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-xs transition-colors flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {expenseToEdit ? 'Salva Modifiche' : 'Registra Spesa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
