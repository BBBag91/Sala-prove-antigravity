import React, { useEffect, useState } from 'react';
import { X, Receipt, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Expense, ExpenseCategory } from '../types';
import { formatDateToISO } from '../utils/dateUtils';
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
    } else {
      setData(formatDateToISO(new Date()));
      setCategoria('energia');
      setDescrizione('');
      setImporto('');
      setMetodoPagamento('bonifico');
      setFornitore('');
      setNumeroFatturaRicevuta('');
      setStato('pagato');
      setNote('');
    }
  }, [expenseToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!descrizione.trim() || !importo) return;

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
              onChange={(e) => setCategoria(e.target.value as ExpenseCategory)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
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
              <label className="block text-xs font-semibold text-slate-600 mb-1">Data *</label>
              <input
                type="date"
                required
                value={data}
                onChange={(e) => setData(e.target.value)}
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
