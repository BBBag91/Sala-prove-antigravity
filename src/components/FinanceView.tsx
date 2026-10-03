import React, { useState } from 'react';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Filter,
  Trash2,
  Edit2,
  Printer,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Expense, ExpenseCategory } from '../types';
import { formatCurrency, formatDateItalian, MESI_ITALIANI } from '../utils/dateUtils';
import { EXPENSE_CATEGORIES, ExpenseModal } from './ExpenseModal';
import { CompensiFineMeseSection } from './CompensiFineMeseSection';
import { TeacherLessonsFinanceSection } from './TeacherLessonsFinanceSection';

export const FinanceView: React.FC = () => {
  const { expenses, bookings, clients, deleteExpense, updateExpense } = useApp();

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-11
  const [categoryFilter, setCategoryFilter] = useState<'all' | ExpenseCategory>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);

  // Quote lezioni insegnanti (5€/h)
  const [teacherFees, setTeacherFees] = useState({
    totalOre: 0,
    totalDovuto: 0,
    totalSaldato: 0,
    totalDaSaldare: 0,
  });

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

  // Spese del mese: conteggia nel totale spese solo quelle effettivamente saldate / pagate
  const paidExpenses = monthlyExpenses.filter((e) => e.stato === 'pagato');
  const pendingExpenses = monthlyExpenses.filter((e) => e.stato === 'in_scadenza');

  const totalExpenses = paidExpenses.reduce((sum, e) => sum + e.importo, 0);
  const totalPendingExpenses = pendingExpenses.reduce((sum, e) => sum + e.importo, 0);

  // Incomes from bookings for this month
  const monthlyBookings = bookings.filter((b) => b.data.startsWith(monthStr));
  const bookingIncomePaid = monthlyBookings
    .filter((b) => b.statoPagamento === 'pagato')
    .reduce((sum, b) => sum + b.tariffaTotale, 0);

  // Incomes from membership fees issued this month
  const monthlyMemberships = clients.filter(
    (c) => c.dataTesseramento && c.dataTesseramento.startsWith(monthStr)
  );
  const membershipIncome = monthlyMemberships.reduce(
    (sum, c) => sum + (c.quotaTesseramento || 15),
    0
  );

  const totalIncomes = bookingIncomePaid + membershipIncome + teacherFees.totalSaldato;
  const netBalance = totalIncomes - totalExpenses;

  // Category breakdown for expenses (solo spese effettivamente pagate)
  const categoryTotals: Record<string, number> = {};
  for (const exp of paidExpenses) {
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
          <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
            <button
              onClick={handlePrevMonth}
              className="w-11 h-11 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white flex items-center justify-center transition-all touch-manipulation touch-active"
              aria-label="Mese precedente"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-3 text-xs font-bold text-slate-700 select-none">Mese</span>
            <button
              onClick={handleNextMonth}
              className="w-11 h-11 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white flex items-center justify-center transition-all touch-manipulation touch-active"
              aria-label="Mese successivo"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Conto Mese:</span>
            <span className="text-indigo-600 font-semibold">
              {MESI_ITALIANI[currentMonth]} {currentYear}
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="px-3.5 py-2.5 min-h-[44px] border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2 touch-manipulation touch-active"
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
            className="px-4 py-2.5 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 shrink-0 touch-manipulation touch-active ml-auto sm:ml-0"
          >
            <Plus className="w-4 h-4" />
            <span>Registra Spesa</span>
          </button>
        </div>
      </div>

      {/* Main Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <span>Prove saldate:</span>
            <strong className="text-slate-800">{formatCurrency(bookingIncomePaid)}</strong>
          </div>
          <div className="text-[11px] text-slate-500 flex justify-between">
            <span>Quote Tesseramenti ({monthlyMemberships.length}):</span>
            <strong className="text-slate-800">{formatCurrency(membershipIncome)}</strong>
          </div>
          {teacherFees.totalSaldato > 0 && (
            <div className="text-[11px] text-purple-700 font-semibold flex justify-between">
              <span>Quote Lezioni Saldate (5€/h):</span>
              <strong className="text-purple-800 font-mono">{formatCurrency(teacherFees.totalSaldato)}</strong>
            </div>
          )}
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
            <span>Spese saldate:</span>
            <strong className="text-slate-800">{paidExpenses.length} su {monthlyExpenses.length}</strong>
          </div>
          {totalPendingExpenses > 0 && (
            <div className="text-[11px] text-amber-700 flex justify-between font-semibold">
              <span>In scadenza (non conteggiate):</span>
              <strong className="text-amber-800 font-mono">{formatCurrency(totalPendingExpenses)}</strong>
            </div>
          )}
          <div className="text-[11px] text-slate-500 flex justify-between">
            <span>Affitto + Utenze saldati:</span>
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
      </div>

      {/* ── Sezione Quote Lezioni Insegnanti (5€/ora) ── */}
      <TeacherLessonsFinanceSection
        currentMonthName={MESI_ITALIANI[currentMonth]}
        currentYear={currentYear}
        monthStr={monthStr}
        onTotalsChange={setTeacherFees}
      />

      {/* ── Sezione Compensi Fine Mese (Logica Excel) ── */}
      <CompensiFineMeseSection
        currentMonthName={MESI_ITALIANI[currentMonth]}
        currentYear={currentYear}
        monthStr={monthStr}
        totalIncomes={totalIncomes}
        totalExpenses={totalExpenses}
      />

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

      {/* Spese Registro Table & Mobile Cards */}
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
              className="text-xs font-semibold px-3 py-2.5 min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-hidden touch-manipulation cursor-pointer"
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

        {/* ── Mobile Stacked Cards (Eliminates horizontal scrolling on mobile) ── */}
        <div className="md:hidden space-y-3 pt-1">
          {filteredExpenses.length === 0 ? (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
              Nessuna spesa trovata per i criteri selezionati.
            </div>
          ) : (
            filteredExpenses.map((exp) => {
              const catInfo = EXPENSE_CATEGORIES.find((c) => c.id === exp.categoria);
              const isPaid = exp.stato === 'pagato';

              return (
                <div
                  key={`mobile-${exp.id}`}
                  className="bg-slate-50/60 rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs hover:border-slate-300 transition-colors"
                >
                  {/* Top: Category & Amount */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <span className="font-semibold text-slate-800 text-xs flex items-center gap-1.5">
                      <span className="text-base">{catInfo?.icon}</span>
                      <span>{catInfo?.label || exp.categoria}</span>
                    </span>
                    <strong className="text-slate-900 font-mono text-base font-bold">
                      {formatCurrency(exp.importo)}
                    </strong>
                  </div>

                  {/* Body: Date & Description */}
                  <div className="space-y-1 text-xs">
                    <div className="text-[11px] font-mono text-slate-500">
                      📅 {formatDateItalian(exp.data, false)}
                    </div>
                    <div className="font-bold text-slate-900 text-sm">
                      {exp.descrizione}
                    </div>

                    {(exp.fornitore || exp.numeroFatturaRicevuta) && (
                      <div className="text-slate-600 bg-white/60 p-2 rounded-lg border border-slate-200 text-xs mt-1">
                        {exp.fornitore && <p className="font-semibold text-slate-800">{exp.fornitore}</p>}
                        {exp.numeroFatturaRicevuta && (
                          <p className="font-mono text-[10px] text-slate-400">Doc: {exp.numeroFatturaRicevuta}</p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-1 text-[11px] text-slate-500 pt-1">
                      <span>Metodo:</span>
                      <span className="capitalize font-semibold text-slate-700">
                        {exp.metodoPagamento.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Actions: Large Status Toggle + Edit/Delete (44px touch targets) */}
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => handleToggleState(exp)}
                      className={`flex-1 min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all touch-manipulation touch-active ${
                        isPaid
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                          : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                      }`}
                      title="Clicca per modificare stato"
                    >
                      {isPaid ? '✅ Pagato' : '⏳ In Scadenza (Tocca per pagare)'}
                    </button>

                    <button
                      onClick={() => {
                        setExpenseToEdit(exp);
                        setIsModalOpen(true);
                      }}
                      className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 flex items-center justify-center transition-all touch-manipulation touch-active cursor-pointer shrink-0"
                      title="Modifica spesa"
                      aria-label="Modifica spesa"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDelete(exp)}
                      className="w-11 h-11 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center transition-all touch-manipulation touch-active cursor-pointer shrink-0"
                      title="Elimina spesa"
                      aria-label="Elimina spesa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Desktop Expenses Table (Hidden on mobile) ── */}
        <div className="hidden md:block overflow-x-auto">
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
