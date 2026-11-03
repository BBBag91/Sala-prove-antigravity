import { AuthUser } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DEFAULT_STUDIO_INFO } from '../data/initialData';
import { generateUUID } from '../utils/uuid';

export type ReminderColor = 'fuchsia' | 'violet' | 'lime' | 'indigo' | 'bronze';

export interface CalendarReminder {
  id: string;
  data: string; // YYYY-MM-DD
  ora?: string; // HH:mm opzionale
  titolo: string;
  note?: string;
  colore: ReminderColor;
  completato: boolean;
  autoreId: string;
  autoreStaffId?: string;
  autoreNome: string;
  autoreRuolo: string;
  /** 'tutti' se creato da Admin, 'privato' se creato da un profilo insegnante/personale */
  visibilita: 'tutti' | 'privato';
  createdAt: string;
}

const STORAGE_KEY = 'salaprove_calendar_reminders_v1';
const SUPABASE_REMINDERS_ROW_ID = 'reminders_store';

export const REMINDER_COLOR_STYLES: Record<
  ReminderColor,
  {
    label: string;
    bg: string;
    border: string;
    text: string;
    badge: string;
    dot: string;
  }
> = {
  fuchsia: {
    label: 'Fucsia Post-it',
    bg: 'bg-fuchsia-50/95 dark:bg-fuchsia-950/40',
    border: 'border-fuchsia-300 dark:border-fuchsia-600/60',
    text: 'text-fuchsia-950 dark:text-fuchsia-200',
    badge: 'bg-fuchsia-200/80 text-fuchsia-900 dark:bg-fuchsia-500/20 dark:text-fuchsia-300',
    dot: '#d946ef',
  },
  violet: {
    label: 'Viola Lavanda',
    bg: 'bg-violet-50/95 dark:bg-violet-950/40',
    border: 'border-violet-300 dark:border-violet-600/60',
    text: 'text-violet-950 dark:text-violet-200',
    badge: 'bg-violet-200/80 text-violet-900 dark:bg-violet-500/20 dark:text-violet-300',
    dot: '#8b5cf6',
  },
  lime: {
    label: 'Lime Neon',
    bg: 'bg-lime-50/95 dark:bg-lime-950/40',
    border: 'border-lime-400 dark:border-lime-600/60',
    text: 'text-lime-950 dark:text-lime-200',
    badge: 'bg-lime-200/85 text-lime-900 dark:bg-lime-500/20 dark:text-lime-300',
    dot: '#84cc16',
  },
  indigo: {
    label: 'Indaco Notte',
    bg: 'bg-indigo-50/95 dark:bg-indigo-950/40',
    border: 'border-indigo-300 dark:border-indigo-600/60',
    text: 'text-indigo-950 dark:text-indigo-200',
    badge: 'bg-indigo-200/80 text-indigo-900 dark:bg-indigo-500/20 dark:text-indigo-300',
    dot: '#4f46e5',
  },
  bronze: {
    label: 'Cacao Bronzo',
    bg: 'bg-orange-100/70 dark:bg-stone-900/70',
    border: 'border-amber-700/35 dark:border-amber-700/60',
    text: 'text-stone-900 dark:text-amber-200',
    badge: 'bg-amber-800/15 text-stone-800 dark:bg-amber-700/30 dark:text-amber-200',
    dot: '#92400e',
  },
};

export function getReminderColorStyle(colore?: string) {
  if (colore && colore in REMINDER_COLOR_STYLES) {
    return REMINDER_COLOR_STYLES[colore as ReminderColor];
  }
  return REMINDER_COLOR_STYLES.fuchsia;
}

export const reminderService = {
  /**
   * Legge tutti i promemoria salvati localmente
   */
  getAllLocal(): CalendarReminder[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  /**
   * Salva la lista promemoria in localStorage e notifica i listener
   */
  saveAllLocal(list: CalendarReminder[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('calendar-reminders-updated', { detail: list }));
    } catch (e) {
      console.error('[reminderService] Errore salvataggio localStorage:', e);
    }
  },

  /**
   * Sincronizza con Supabase usando una riga dedicata ('reminders_store') in studio_info,
   * garantendo persistenza cloud immediata senza mai toccare le prenotazioni.
   */
  async fetchFromCloud(): Promise<CalendarReminder[]> {
    if (!isSupabaseConfigured() || !supabase) return this.getAllLocal();
    try {
      const { data, error } = await supabase
        .from('studio_info')
        .select('note')
        .eq('id', SUPABASE_REMINDERS_ROW_ID)
        .maybeSingle();

      if (!error && data?.note) {
        const remoteList = JSON.parse(data.note);
        if (Array.isArray(remoteList)) {
          this.saveAllLocal(remoteList);
          return remoteList;
        }
      }
    } catch (e) {
      console.warn('[reminderService] Fallback locale promemoria:', e);
    }
    return this.getAllLocal();
  },

  async saveToCloud(list: CalendarReminder[]): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) return;
    try {
      await supabase.from('studio_info').upsert({
        id: SUPABASE_REMINDERS_ROW_ID,
        nome: DEFAULT_STUDIO_INFO.nome,
        indirizzo: DEFAULT_STUDIO_INFO.indirizzo,
        citta: DEFAULT_STUDIO_INFO.citta,
        cap: DEFAULT_STUDIO_INFO.cap,
        telefono: DEFAULT_STUDIO_INFO.telefono,
        email: DEFAULT_STUDIO_INFO.email,
        note: JSON.stringify(list),
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('[reminderService] Errore salvataggio cloud promemoria:', e);
    }
  },

  /**
   * Filtra i promemoria visibili in base al profilo utente attivo:
   * - Se il promemoria è stato creato da un Amministratore (visibilita === 'tutti' o autoreRuolo === 'admin'),
   *   è visibile a TUTTI i profili.
   * - Se il promemoria è stato creato da un Insegnante (visibilita === 'privato'),
   *   è visibile ESCLUSIVAMENTE al profilo di quell'insegnante.
   */
  getVisibleForUser(allReminders: CalendarReminder[], user: AuthUser | null): CalendarReminder[] {
    if (!user) return [];
    return allReminders.filter((r) => {
      // Promemoria inseriti dall'amministratore sono visibili a tutti
      if (r.visibilita === 'tutti' || r.autoreRuolo === 'admin') {
        return true;
      }

      // Promemoria inseriti da un insegnante/profilo specifico sono visibili solo al proprio profilo
      if (r.autoreId && r.autoreId === user.id) {
        return true;
      }
      if (r.autoreStaffId && user.staffId && r.autoreStaffId === user.staffId) {
        return true;
      }
      if (
        r.autoreNome &&
        user.nome &&
        r.autoreNome.trim().toLowerCase() === user.nome.trim().toLowerCase()
      ) {
        return true;
      }

      return false;
    });
  },

  /**
   * Aggiunge o aggiorna un promemoria
   */
  async upsertReminder(
    reminderData: Omit<CalendarReminder, 'id' | 'createdAt' | 'visibilita' | 'autoreId' | 'autoreStaffId' | 'autoreNome' | 'autoreRuolo'> & {
      id?: string;
    },
    user: AuthUser
  ): Promise<CalendarReminder> {
    const list = this.getAllLocal();
    const isUserAdmin = user.ruolo === 'admin';
    const existing = reminderData.id ? list.find((r) => r.id === reminderData.id) : undefined;

    const item: CalendarReminder = {
      id: existing ? existing.id : generateUUID(),
      data: reminderData.data,
      ora: reminderData.ora?.trim() || undefined,
      titolo: reminderData.titolo.trim(),
      note: reminderData.note?.trim() || undefined,
      colore: reminderData.colore || 'fuchsia',
      completato: Boolean(reminderData.completato),
      autoreId: existing ? existing.autoreId : user.id,
      autoreStaffId: existing ? existing.autoreStaffId : user.staffId,
      autoreNome: existing ? existing.autoreNome : user.nome,
      autoreRuolo: existing ? existing.autoreRuolo : user.ruolo,
      visibilita: existing ? existing.visibilita : isUserAdmin ? 'tutti' : 'privato',
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
    };

    const nextList = existing
      ? list.map((r) => (r.id === item.id ? item : r))
      : [item, ...list];

    this.saveAllLocal(nextList);
    await this.saveToCloud(nextList);
    return item;
  },

  /**
   * Inverte lo stato completato / da fare di un promemoria
   */
  async toggleCompleted(id: string): Promise<void> {
    const list = this.getAllLocal();
    const nextList = list.map((r) => (r.id === id ? { ...r, completato: !r.completato } : r));
    this.saveAllLocal(nextList);
    await this.saveToCloud(nextList);
  },

  /**
   * Elimina un promemoria
   */
  async deleteReminder(id: string): Promise<void> {
    const list = this.getAllLocal();
    const nextList = list.filter((r) => r.id !== id);
    this.saveAllLocal(nextList);
    await this.saveToCloud(nextList);
  },
};
