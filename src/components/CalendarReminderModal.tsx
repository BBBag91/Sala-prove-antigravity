import React, { useState, useEffect } from 'react';
import {
  X,
  Pin,
  Clock,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  Trash2,
  Edit3,
  Globe,
  Lock,
  Sparkles,
  Plus,
} from 'lucide-react';
import { formatDateItalian } from '../utils/dateUtils';
import {
  CalendarReminder,
  ReminderColor,
  REMINDER_COLOR_STYLES,
  getReminderColorStyle,
  reminderService,
} from '../services/reminderService';
import { AuthUser } from '../types';

interface CalendarReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate: string; // YYYY-MM-DD
  initialReminder?: CalendarReminder | null;
  user: AuthUser | null;
  visibleReminders: CalendarReminder[];
}

export const CalendarReminderModal: React.FC<CalendarReminderModalProps> = ({
  isOpen,
  onClose,
  initialDate,
  initialReminder,
  user,
  visibleReminders,
}) => {
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [titolo, setTitolo] = useState('');
  const [data, setData] = useState(initialDate);
  const [ora, setOra] = useState('');
  const [note, setNote] = useState('');
  const [colore, setColore] = useState<ReminderColor>('fuchsia');
  const [completato, setCompletato] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = user?.ruolo === 'admin';

  useEffect(() => {
    if (!isOpen) return;
    if (initialReminder) {
      setEditingId(initialReminder.id);
      setTitolo(initialReminder.titolo);
      setData(initialReminder.data);
      setOra(initialReminder.ora || '');
      setNote(initialReminder.note || '');
      setColore(
        initialReminder.colore && initialReminder.colore in REMINDER_COLOR_STYLES
          ? initialReminder.colore
          : 'fuchsia'
      );
      setCompletato(Boolean(initialReminder.completato));
    } else {
      setEditingId(undefined);
      setTitolo('');
      setData(initialDate);
      setOra('');
      setNote('');
      setColore(isAdmin ? 'fuchsia' : 'violet');
      setCompletato(false);
    }
  }, [isOpen, initialReminder, initialDate, isAdmin]);

  if (!isOpen || !user) return null;

  const dayReminders = visibleReminders
    .filter((r) => r.data === data)
    .sort((a, b) => (a.ora || '99:99').localeCompare(b.ora || '99:99'));

  const resetFormForNew = () => {
    setEditingId(undefined);
    setTitolo('');
    setOra('');
    setNote('');
    setColore(isAdmin ? 'fuchsia' : 'violet');
    setCompletato(false);
  };

  const handleSelectForEdit = (rem: CalendarReminder) => {
    setEditingId(rem.id);
    setTitolo(rem.titolo);
    setData(rem.data);
    setOra(rem.ora || '');
    setNote(rem.note || '');
    setColore(rem.colore && rem.colore in REMINDER_COLOR_STYLES ? rem.colore : 'fuchsia');
    setCompletato(Boolean(rem.completato));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titolo.trim()) return;
    setIsSaving(true);
    try {
      await reminderService.upsertReminder(
        {
          id: editingId,
          titolo: titolo.trim(),
          data,
          ora: ora.trim() || undefined,
          note: note.trim() || undefined,
          colore,
          completato,
        },
        user
      );
      if (initialReminder) {
        onClose();
      } else {
        resetFormForNew();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleComplete = async (id: string) => {
    await reminderService.toggleCompleted(id);
    if (editingId === id) {
      setCompletato((prev) => !prev);
    }
  };

  const handleDelete = async (id: string) => {
    await reminderService.deleteReminder(id);
    if (editingId === id) {
      resetFormForNew();
    }
  };

  const formattedDateLabel = formatDateItalian(data, true);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white dark:bg-[#141923] rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Banner */}
        <div className="px-6 py-4 bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <Pin className="w-5 h-5 text-white -rotate-12" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight flex items-center gap-2">
                {editingId ? 'Modifica Promemoria' : 'Nuovo Promemoria Calendario'}
              </h3>
              <p className="text-xs text-white/90 font-medium capitalize">{formattedDateLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
            title="Chiudi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Visibility Status Banner */}
        <div
          className={`px-6 py-2.5 border-b flex items-center justify-between text-xs font-bold ${
            isAdmin
              ? 'bg-fuchsia-50/90 dark:bg-fuchsia-500/10 border-fuchsia-200/80 dark:border-fuchsia-500/20 text-fuchsia-900 dark:text-fuchsia-300'
              : 'bg-violet-50/90 dark:bg-violet-500/10 border-violet-200/80 dark:border-violet-500/20 text-violet-900 dark:text-violet-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <>
                <Globe className="w-4 h-4 text-fuchsia-600 dark:text-fuchsia-400 shrink-0" />
                <span>
                  Profilo <strong>Amministratore</strong>: questo promemoria sarà{' '}
                  <span className="underline decoration-fuchsia-500 font-black">visibile a tutti</span>
                </span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                <span>
                  Profilo <strong>{user.nome}</strong>: promemoria{' '}
                  <span className="underline decoration-violet-500 font-black">
                    privato (visibile solo a te)
                  </span>
                </span>
              </>
            )}
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
              isAdmin
                ? 'bg-fuchsia-200/80 text-fuchsia-900 dark:bg-fuchsia-500/20 dark:text-fuchsia-300'
                : 'bg-violet-200/80 text-violet-900 dark:bg-violet-500/20 dark:text-violet-300'
            }`}
          >
            {isAdmin ? '👑 Pubblico' : '🔒 Personale'}
          </span>
        </div>

        {/* Content Scrollable */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Titolo Promemoria */}
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Testo Promemoria *
              </label>
              <input
                type="text"
                required
                autoFocus
                value={titolo}
                onChange={(e) => setTitolo(e.target.value)}
                placeholder="Es. Controllare accordatura rullante Sala B, Chiamare tecnico..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all"
              />
            </div>

            {/* Data e Ora */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  <CalendarIcon className="w-3 h-3 inline mr-1 -mt-0.5" />
                  Giorno
                </label>
                <input
                  type="date"
                  required
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  <Clock className="w-3 h-3 inline mr-1 -mt-0.5" />
                  Orario (Opzionale)
                </label>
                <input
                  type="time"
                  value={ora}
                  onChange={(e) => setOra(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>
            </div>

            {/* Scelta Colore Post-it */}
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Stile Post-it
              </label>
              <div className="grid grid-cols-5 gap-2">
                {(Object.keys(REMINDER_COLOR_STYLES) as ReminderColor[]).map((colorKey) => {
                  const style = REMINDER_COLOR_STYLES[colorKey];
                  const isSelected = colore === colorKey;
                  return (
                    <button
                      key={colorKey}
                      type="button"
                      onClick={() => setColore(colorKey)}
                      className={`px-2 py-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        style.bg
                      } ${style.border} ${
                        isSelected
                          ? 'ring-2 ring-offset-1 ring-slate-900 dark:ring-white scale-[1.03] shadow-sm'
                          : 'opacity-75 hover:opacity-100'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full shadow-inner"
                        style={{ backgroundColor: style.dot }}
                      />
                      <span className={`text-[10px] font-extrabold leading-tight ${style.text}`}>
                        {style.label.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Note aggiuntive */}
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Dettagli / Note (Opzionale)
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Dettagli aggiuntivi..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-none"
              />
            </div>

            {/* Azioni Form */}
            <div className="flex items-center justify-end gap-2 pt-1">
              {editingId && (
                <button
                  type="button"
                  onClick={resetFormForNew}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  + Nuovo
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving || !titolo.trim()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-700 hover:to-violet-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {editingId ? 'Salva Modifiche' : 'Aggiungi Promemoria'}
              </button>
            </div>
          </form>

          {/* Lista Promemoria del Giorno Selezionato */}
          <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Promemoria del giorno ({dayReminders.length})
              </span>
            </div>

            {dayReminders.length === 0 ? (
              <div className="py-5 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                  Nessun promemoria presente per questa data.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {dayReminders.map((rem) => {
                  const style = getReminderColorStyle(rem.colore);
                  const isPublic = rem.visibilita === 'tutti' || rem.autoreRuolo === 'admin';
                  return (
                    <div
                      key={rem.id}
                      className={`p-3 rounded-2xl border transition-all flex items-start justify-between gap-2.5 ${
                        style.bg
                      } ${style.border} ${rem.completato ? 'opacity-60' : 'shadow-xs'}`}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(rem.id)}
                        className={`mt-0.5 shrink-0 cursor-pointer ${style.text}`}
                        title={rem.completato ? 'Segna come da fare' : 'Segna come completato'}
                      >
                        {rem.completato ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Circle className="w-4 h-4 opacity-60 hover:opacity-100" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {rem.ora && (
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${style.badge}`}
                            >
                              {rem.ora}
                            </span>
                          )}
                          <span
                            className={`text-xs font-extrabold truncate ${style.text} ${
                              rem.completato ? 'line-through' : ''
                            }`}
                          >
                            {rem.titolo}
                          </span>
                        </div>
                        {rem.note && (
                          <p className={`text-[11px] mt-0.5 opacity-80 ${style.text}`}>
                            {rem.note}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold opacity-70 flex items-center gap-1">
                            {isPublic ? (
                              <>
                                👑 <span>Pubblico ({rem.autoreNome})</span>
                              </>
                            ) : (
                              <>
                                🔒 <span>Privato ({rem.autoreNome})</span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSelectForEdit(rem)}
                          className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                          title="Modifica"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(rem.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                          title="Elimina"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
