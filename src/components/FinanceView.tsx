import React, { useState } from 'react';
import {
  Plus,
  Receipt,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Filter,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  Printer,
  FileText,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Expense, ExpenseCategory } from '../types';
import { formatCurrency, formatDateItalian, MESI_ITALIANI } from '../utils/dateUtils';
import { EXPENSE_CATEGORIES, ExpenseModal } from './ExpenseModal';

export const FinanceView: React.FC = () => {
  const { expenses, bookings, clients, deleteExpense, updateExpense } = useApp();

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-11
  const [categoryFilter, setCategoryFilter] = useState<'all' | ExpenseCategory>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);

  const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Expenses for this month
  const monthlyExpenses = expenses.filter((e) => e.data.startsWith(monthStr));
  const filteredExpenses = monthlyExpenses.filter(
    (e) => categoryFilter === 'all' || e.categoria === categoryFilter
  );

  const totalExpenses = monthlyExpenses.reduce((sum, e) => sum + e.importo, 0);

  // Incomes from bookings for this month
  const monthlyBookings = bookings.filter((b) => b.data.startsWith(monthStr));
  const bookingIncomePaid = monthlyBookings
    .filter((b) => b.statoPagamento === 'pagato')
    .reduce((sum, b) => sum + b.tariffaTotale, 0);
  const bookingIncomePending = monthlyBookings
    .filter((b) => b.statoPagamento === 'da_saldare')
    .reduce((sum, b) => sum + b.tariffaTotale, 0);

  // Incomes from membership fees issued this month
  const monthlyMemberships = clients.filter(
    (c) => c.dataTesseramento && c.dataTesseramento.startsWith(monthStr)
  );
  const membershipIncome = monthlyMemberships.reduce(
    (sum, c) => sum + (c.quotaTesseramento || 15),
    0
  );

  const totalIncomes = bookingIncomePaid + membershipIncome;
  const netBalance = totalIncomes - totalExpenses;

  // Category breakdown for expenses
  const categoryTotals: Record<string, number> = {};
  for (const exp of monthlyExpenses) {
    categoryTotals[exp.categoria] = (categoryTotals[exp.categoria] || 0) + exp.importo;
  }

  const handleToggleState = (expense: Expense) => {
    updateExpense({
      ...expense,
      stato: expense.stato === 'pagato' ? 'in_scadenza' : 'pagato',
    });
  };

  const handleDelete = (expense: Expense) => {
    if (window.confirm(`Eliminare la spesa "${expense.descrizione}" di €${expense.importo}?`)) {
      deleteExpense(expense.id);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Month Navigation & Action Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-3 text-xs font-semibold text-slate-700">Mese</span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Conto Economico di Fine Mese:</span>
            <span className="text-indigo-600 font-semibold">
              {MESI_ITALIANI[currentMonth]} {currentYear}
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
            title="Stampa report contabile del mese"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Stampa / Esporta</span>
          </button>

          <button
            onClick={() => {
              setExpenseToEdit(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Registra Spesa</span>
          </button>
        </div>
      </div>

      {/* Main Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Entrate */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 uppercase tracking-wider">
            <span>Totale Entrate Mese</span>
            <div className="w-7 h-7 rounded-md bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold font-mono text-slate-900">{formatCurrency(totalIncomes)}</p>
          <div className="text-[11px] text-slate-500 flex justify-between border-t border-slate-100 pt-1.5">
            <span>Prove & Lezioni saldate:</span>
            <strong className="text-slate-800">{formatCurrency(bookingIncomePaid)}</strong>
          </div>
          <div className="text-[11px] text-slate-500 flex justify-between">
            <span>Quote Tesseramenti ({monthlyMemberships.length}):</span>
            <strong className="text-slate-800">{formatCurrency(membershipIncome)}</strong>
          </div>
        </div>

        {/* Spese */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-rose-600 uppercase tracking-wider">
            <span>Totale Spese Mese</span>
            <div className="w-7 h-7 rounded-md bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold font-mono text-rose-600">{formatCurrency(totalExpenses)}</p>
          <div className="text-[11px] text-slate-500 flex justify-between border-t border-slate-100 pt-1.5">
            <span>Voci registrate:</span>
            <strong className="text-slate-800">{monthlyExpenses.length} spese</strong>
          </div>
          <div className="text-[11px] text-slate-500 flex justify-between">
            <span>Affitto + Utenze:</span>
            <strong className="text-slate-800">
              {formatCurrency(
                (categoryTotals['affitto'] || 0) +
                  (categoryTotals['energia'] || 0) +
                  (categoryTotals['acqua'] || 0)
              )}
            </strong>
          </div>
        </div>

        {/* Utile Netto / Saldo fine mese */}
        <div
          className={`p-5 rounded-xl border shadow-xs space-y-2 ${
            netBalance >= 0
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              : 'bg-rose-50/70 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider">
            <span>Saldo Fine Mese (Utile)</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <p className="text-3xl font-bold font-mono">{formatCurrency(netBalance)}</p>
          <p className="text-[11px] font-medium border-t border-black/10 pt-1.5">
            {netBalance >= 0
              ? '✅ Bilancio in attivo per questo mese'
              : '⚠️ Disavanzo: spese superiori alle entrate saldate'}
          </p>
        </div>

        {/* Da Incassare */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-indigo-700 uppercase tracking-wider">
            <span>Prenotazioni da Saldare</span>
            <div className="w-7 h-7 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold font-mono text-indigo-600">{formatCurrency(bookingIncomePending)}</p>
          <p className="text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
            Crediti verso clienti per prove/lezioni non ancora pagate nel mese.
          </p>
        </div>
      </div>

      {/* Ripartizione Spese per Categoria (Visual Breakdown) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
          Ripartizione Spese per Categoria (Affitto, Energia, Acqua, Manutenzioni...)
        </h3>

        {monthlyExpenses.length === 0 ? (
          <p className="text-xs text-slate-400 py-3">Nessuna spesa registrata per questo mese.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {EXPENSE_CATEGORIES.map((cat) => {
              const amount = categoryTotals[cat.id] || 0;
              if (amount === 0) return null;
              const percent = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0;

              return (
                <div
                  key={cat.id}
                  className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </span>
                    <strong className="text-slate-900 font-mono">{formatCurrency(amount)}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 w-8 text-right font-mono">
                      {percent}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Spese Registro Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-3 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Registro Dettagliato Spese</h3>
            <p className="text-xs text-slate-500">
              Utenze, bollette, affitti, ricevute e compensi con metodo di pagamento
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-hidden"
            >
              <option value="all">Tutte le categorie</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Data</th>
                <th className="py-2.5 px-3">Categoria</th>
                <th className="py-2.5 px-3">Descrizione</th>
                <th className="py-2.5 px-3">Fornitore / Doc.</th>
                <th className="py-2.5 px-3">Metodo</th>
                <th className="py-2.5 px-3">Importo</th>
                <th className="py-2.5 px-3">Stato</th>
                <th className="py-2.5 px-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    Nessuna spesa trovata per i criteri selezionati.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const catInfo = EXPENSE_CATEGORIES.find((c) => c.id === exp.categoria);
                  const isPaid = exp.stato === 'pagato';

                  return (
                    <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-medium text-slate-800 whitespace-nowrap">
                        {formatDateItalian(exp.data, false)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-medium text-slate-800 flex items-center gap-1.5">
                          <span>{catInfo?.icon}</span>
                          <span>{catInfo?.label || exp.categoria}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-900">{exp.descrizione}</td>
                      <td className="py-3 px-3 text-slate-500">
                        {exp.fornitore && <span>{exp.fornitore}</span>}
                        {exp.numeroFatturaRicevuta && (
                          <span className="block text-[10px] font-mono text-slate-400">
                            {exp.numeroFatturaRicevuta}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 capitalize text-slate-600">
                        {exp.metodoPagamento.replace('_', ' ')}
                      </td>
                      <td className="py-3 px-3 font-bold font-mono text-slate-900 whitespace-nowrap">
                        {formatCurrency(exp.importo)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleState(exp)}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                            isPaid
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-amber-50 border-amber-200 text-amber-800'
                          }`}
                          title="Clicca per modificare stato"
                        >
                          {isPaid ? '✅ Pagato' : '⏳ In Scadenza'}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setExpenseToEdit(exp);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(exp)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 rounded-md hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ExpenseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        expenseToEdit={expenseToEdit}
      />
    </div>
  );
};
