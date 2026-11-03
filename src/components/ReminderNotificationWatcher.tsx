import React, { useEffect, useState, useCallback } from 'react';
import { Bell, CheckCircle2, X, Clock, Calendar as CalendarIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  CalendarReminder,
  getReminderColorStyle,
  reminderService,
} from '../services/reminderService';
import { formatDateItalian, formatDateToISO, timeToMinutes } from '../utils/dateUtils';

const SENT_LOG_STORAGE_KEY = 'salaprove_reminder_notifs_sent_v1';

interface ActiveToastItem {
  key: string;
  reminder: CalendarReminder;
  stage: 'set' | 'pre' | 'due';
  title: string;
  subtitle: string;
}

function getSentLog(): Record<string, number> {
  try {
    const raw = localStorage.getItem(SENT_LOG_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function markAsSent(key: string): void {
  try {
    const log = getSentLog();
    log[key] = Date.now();
    // Pulisci chiavi più vecchie di 7 giorni
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    Object.keys(log).forEach((k) => {
      if (log[k] < cutoff) delete log[k];
    });
    localStorage.setItem(SENT_LOG_STORAGE_KEY, JSON.stringify(log));
  } catch {
    // ignore
  }
}

export const ReminderNotificationWatcher: React.FC = () => {
  const { user } = useAuth();
  const [activeToasts, setActiveToasts] = useState<ActiveToastItem[]>([]);

  const pushToast = useCallback((item: ActiveToastItem) => {
    setActiveToasts((prev) => {
      const filtered = prev.filter((t) => t.key !== item.key);
      return [item, ...filtered].slice(0, 3);
    });
  }, []);

  const dismissToast = useCallback((key: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.key !== key));
  }, []);

  const handleCompleteFromToast = async (toast: ActiveToastItem) => {
    await reminderService.toggleCompleted(toast.reminder.id);
    dismissToast(toast.key);
  };

  // Ascolta l'evento immediato quando viene impostato un promemoria su questo dispositivo
  useEffect(() => {
    if (!user) {
      setActiveToasts([]);
      return;
    }

    const onImmediateToast = (e: Event) => {
      const custom = e as CustomEvent<{ reminder: CalendarReminder; type: 'set' }>;
      const rem = custom.detail?.reminder;
      if (!rem) return;
      if (!reminderService.shouldNotifyUser(rem, user)) return;

      const userKey = `${user.ruolo}_${user.id || user.nome}`;
      const logKey = `${userKey}_${rem.id}_set_${rem.data}_${rem.ora}`;
      markAsSent(logKey);

      const dateLabel = formatDateItalian(rem.data, false);
      pushToast({
        key: logKey,
        reminder: rem,
        stage: 'set',
        title: `🔔 Promemoria Impostato: ${rem.titolo}`,
        subtitle: `${dateLabel} • ${rem.ora || '20:30'}${rem.oraFine ? ` - ${rem.oraFine}` : ''}`,
      });
    };

    window.addEventListener('calendar-reminder-toast', onImmediateToast);
    return () => window.removeEventListener('calendar-reminder-toast', onImmediateToast);
  }, [user, pushToast]);

  // Controllo periodico (ogni 20 secondi) per notifiche all'orario del promemoria e sincronizzazione tra dispositivi
  useEffect(() => {
    if (!user) return;

    const checkReminders = async () => {
      const list = reminderService.getAllLocal();
      const now = new Date();
      const todayStr = formatDateToISO(now);
      const currentMins = now.getHours() * 60 + now.getMinutes();
      const userKey = `${user.ruolo}_${user.id || user.nome}`;
      const sentLog = getSentLog();

      for (const rem of list) {
        // Verifica rigorosa del destinatario:
        // - Insegnante -> solo al proprio profilo insegnante
        // - Amministratore -> solo ai profili amministratore
        if (!reminderService.shouldNotifyUser(rem, user)) continue;

        const startStr = rem.ora || '20:30';
        const startMins = timeToMinutes(startStr);
        const endMins = rem.oraFine ? timeToMinutes(rem.oraFine) : startMins + 60;
        const anticipo = rem.anticipoNotificaMinuti !== undefined ? rem.anticipoNotificaMinuti : 15;
        const dateLabel = formatDateItalian(rem.data, false);

        // 1) Se un promemoria è stato appena creato (< 3 min fa, anche da un altro dispositivo admin)
        const createdMs = Date.parse(rem.createdAt || '');
        if (!Number.isNaN(createdMs) && Date.now() - createdMs < 3 * 60 * 1000) {
          const setKey = `${userKey}_${rem.id}_set_${rem.data}_${rem.ora}`;
          if (!sentLog[setKey]) {
            markAsSent(setKey);
            await reminderService.sendDeviceNotification(
              `🔔 Promemoria Impostato: ${rem.titolo}`,
              `📅 ${dateLabel} • 🕒 ${startStr}${rem.oraFine ? ` - ${rem.oraFine}` : ''}`,
              setKey
            );
            pushToast({
              key: setKey,
              reminder: rem,
              stage: 'set',
              title: `🔔 Promemoria Impostato: ${rem.titolo}`,
              subtitle: `${dateLabel} • ${startStr}${rem.oraFine ? ` - ${rem.oraFine}` : ''}`,
            });
          }
        }

        // Controlli orari solo per i promemoria della giornata odierna
        if (rem.data !== todayStr) continue;

        // 2) Preavviso (es. 15 min prima dell'inizio)
        if (anticipo > 0 && currentMins >= startMins - anticipo && currentMins < startMins) {
          const preKey = `${userKey}_${rem.id}_pre_${rem.data}_${rem.ora}_${anticipo}`;
          if (!sentLog[preKey]) {
            markAsSent(preKey);
            const minsLeft = Math.max(1, startMins - currentMins);
            await reminderService.sendDeviceNotification(
              `⏰ Tra ${minsLeft} min: ${rem.titolo}`,
              `Promemoria previsto alle ore ${startStr}${rem.note ? ` • ${rem.note}` : ''}`,
              preKey
            );
            pushToast({
              key: preKey,
              reminder: rem,
              stage: 'pre',
              title: `⏰ Tra ${minsLeft} min: ${rem.titolo}`,
              subtitle: `Oggi alle ${startStr}${rem.oraFine ? ` - ${rem.oraFine}` : ''}`,
            });
          }
        }

        // 3) Orario esatto del promemoria (da startMins fino a endMins)
        if (currentMins >= startMins && currentMins <= Math.max(startMins + 30, endMins)) {
          const dueKey = `${userKey}_${rem.id}_due_${rem.data}_${rem.ora}`;
          if (!sentLog[dueKey]) {
            markAsSent(dueKey);
            await reminderService.sendDeviceNotification(
              `📌 Promemoria Ora: ${rem.titolo}`,
              `🕒 ${startStr}${rem.oraFine ? ` - ${rem.oraFine}` : ''}${rem.note ? ` • ${rem.note}` : ''}`,
              dueKey
            );
            pushToast({
              key: dueKey,
              reminder: rem,
              stage: 'due',
              title: `📌 È l'ora del promemoria: ${rem.titolo}`,
              subtitle: `Oggi • ${startStr}${rem.oraFine ? ` - ${rem.oraFine}` : ''}`,
            });
          }
        }
      }
    };

    checkReminders();
    const interval = setInterval(() => {
      reminderService.fetchFromCloud().then(() => checkReminders());
    }, 20 * 1000);

    const onUpdated = () => {
      checkReminders();
    };
    window.addEventListener('calendar-reminders-updated', onUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('calendar-reminders-updated', onUpdated);
    };
  }, [user, pushToast]);

  // Auto-chiusura dopo 12 secondi per le notifiche di tipo 'set', mentre 'pre' e 'due' restano visibili finché l'utente non le chiude
  useEffect(() => {
    const setToasts = activeToasts.filter((t) => t.stage === 'set');
    if (setToasts.length === 0) return;
    const timer = setTimeout(() => {
      setActiveToasts((prev) => prev.filter((t) => t.stage !== 'set'));
    }, 9000);
    return () => clearTimeout(timer);
  }, [activeToasts]);

  if (!user || activeToasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-3 sm:right-5 z-[150] flex flex-col gap-2.5 max-w-sm w-[calc(100vw-1.5rem)] pointer-events-none print:hidden">
      {activeToasts.map((toast) => {
        const rStyle = getReminderColorStyle(toast.reminder.colore);
        const isAdminRem =
          toast.reminder.visibilita === 'tutti' || toast.reminder.autoreRuolo === 'admin';
        return (
          <div
            key={toast.key}
            className="pointer-events-auto rounded-2xl rounded-tl-xs border-2 border-dashed p-3.5 shadow-2xl text-white animate-in slide-in-from-top-3 fade-in duration-200 flex flex-col gap-2"
            style={{
              backgroundColor: rStyle.solidBg,
              borderColor: rStyle.solidBorder,
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-xs">
                  <Bell className="w-4 h-4 text-white animate-bounce" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-1.5 py-0.2 rounded-full bg-white text-slate-900 text-[9px] font-black uppercase tracking-wider">
                      {isAdminRem ? '👑 Notifica Admin' : `🔒 Solo ${user.nome}`}
                    </span>
                    <span className="text-[10px] font-bold text-white/90 font-mono">
                      {toast.stage === 'set'
                        ? 'Appena impostato'
                        : toast.stage === 'pre'
                          ? 'In arrivo'
                          : 'Adesso in programma'}
                    </span>
                  </div>
                  <h4 className="text-sm font-black leading-snug break-words mt-0.5 drop-shadow-xs">
                    {toast.reminder.titolo}
                  </h4>
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.key)}
                className="w-7 h-7 rounded-lg bg-black/25 hover:bg-black/40 flex items-center justify-center text-white shrink-0 cursor-pointer transition-colors"
                title="Chiudi notifica"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {toast.reminder.note && (
              <p className="text-xs font-medium text-white/95 bg-black/20 rounded-lg px-2.5 py-1.5">
                {toast.reminder.note}
              </p>
            )}

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/20 text-[11px] font-bold">
              <div className="flex items-center gap-2 text-white/95 font-mono">
                <span className="flex items-center gap-1">
                  <CalendarIcon className="w-3 h-3" />
                  {toast.subtitle}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {toast.stage !== 'set' && (
                  <button
                    type="button"
                    onClick={() => handleCompleteFromToast(toast)}
                    className="px-2.5 py-1 rounded-lg bg-white text-slate-900 hover:bg-slate-100 text-[10px] font-black uppercase tracking-wide flex items-center gap-1 shadow-xs cursor-pointer transition-all"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Completato</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
