import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { UserPreferences } from '../types';
import { useAuth } from './AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Preferenze personali per account (tema, vista calendario, filtri...).
 *
 * - Account Supabase reali: salvate in public.profiles.preferences (JSONB), quindi
 *   seguono l'account su qualsiasi dispositivo.
 * - Copia locale per account (chiave dedicata per user.id) usata come cache/fallback
 *   se Supabase non è raggiungibile o la colonna non è ancora stata migrata.
 *
 * Modificare le preferenze di un account non tocca mai quelle degli altri account.
 */

interface PreferencesContextType {
  preferences: UserPreferences;
  updatePreferences: (patch: Partial<UserPreferences>) => void;
  /** true quando le preferenze dell'account corrente sono state caricate */
  isLoaded: boolean;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

// Preferenze usate quando nessuno è autenticato (schermata di login)
const GUEST_STORAGE_KEY = 'salaprove_prefs_guest';
// Chiave tema storica: usata per migrare il tema esistente al primo accesso
const LEGACY_THEME_KEY = 'sala-prove-theme';
const REMOTE_LOAD_TIMEOUT_MS = 2500;
const SAVE_DEBOUNCE_MS = 700;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const storageKeyFor = (userId: string | null) => (userId ? `salaprove_prefs_${userId}` : GUEST_STORAGE_KEY);

const readLocal = (key: string): UserPreferences | null => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as UserPreferences;
    }
  } catch {
    // ignora storage corrotto
  }
  return null;
};

const writeLocal = (key: string, prefs: UserPreferences) => {
  try {
    localStorage.setItem(key, JSON.stringify(prefs));
  } catch {
    // ignora quota/storage non disponibile
  }
};

const readLegacyTheme = (): UserPreferences => {
  try {
    const t = localStorage.getItem(LEGACY_THEME_KEY);
    if (t === 'light' || t === 'dark') return { theme: t };
  } catch {
    // ignora
  }
  return {};
};

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.id || null;
  const isRemoteAccount = !!userId && UUID_REGEX.test(userId) && isSupabaseConfigured();

  const [preferences, setPreferences] = useState<UserPreferences>(
    () => readLocal(storageKeyFor(userId)) || readLegacyTheme()
  );
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(() => (userId ? undefined : null));

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRemoteRef = useRef<UserPreferences | null>(null);
  const remoteUnavailableRef = useRef(false);
  const activeUserRef = useRef<string | null>(userId);

  const flushRemote = useCallback(async (targetUserId: string, prefs: UserPreferences) => {
    if (remoteUnavailableRef.current) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ preferences: prefs, updated_at: new Date().toISOString() })
        .eq('id', targetUserId);
      if (error) {
        remoteUnavailableRef.current = true;
        console.warn(
          '[Preferences] Impossibile salvare su Supabase (eseguire la migrazione profiles.preferences?). Uso solo salvataggio locale.',
          error.message
        );
      }
    } catch (e) {
      console.warn('[Preferences] Errore salvataggio remoto preferenze:', e);
    }
  }, []);

  // Carica le preferenze quando cambia l'account autenticato
  useEffect(() => {
    activeUserRef.current = userId;
    remoteUnavailableRef.current = false;

    // Salva subito eventuali modifiche in sospeso dell'account precedente
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const localKey = storageKeyFor(userId);
    const cached = readLocal(localKey);

    if (!userId) {
      setPreferences(cached || readLegacyTheme());
      setLoadedFor(null);
      return;
    }

    // Primo accesso su questo dispositivo: eredita il tema attuale per non "saltare" colore
    const initial = cached || readLegacyTheme();
    setPreferences(initial);

    if (!isRemoteAccount) {
      setLoadedFor(userId);
      return;
    }

    let cancelled = false;
    setLoadedFor(undefined);

    const timeout = setTimeout(() => {
      if (!cancelled) setLoadedFor(userId);
    }, REMOTE_LOAD_TIMEOUT_MS);

    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('preferences')
          .eq('id', userId)
          .maybeSingle();
        if (cancelled) return;
        if (!error && data && data.preferences && typeof data.preferences === 'object') {
          const remote = data.preferences as UserPreferences;
          const merged = { ...initial, ...remote };
          setPreferences(merged);
          writeLocal(localKey, merged);
        } else if (error) {
          remoteUnavailableRef.current = true;
        }
      } catch {
        // offline: resta la cache locale
      } finally {
        if (!cancelled) {
          clearTimeout(timeout);
          setLoadedFor(userId);
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [userId, isRemoteAccount]);

  // Salva le modifiche in sospeso alla chiusura della pagina
  useEffect(() => {
    const handleBeforeUnload = () => {
      const target = activeUserRef.current;
      if (target && pendingRemoteRef.current && isRemoteAccount) {
        flushRemote(target, pendingRemoteRef.current);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [flushRemote, isRemoteAccount]);

  const updatePreferences = useCallback(
    (patch: Partial<UserPreferences>) => {
      const targetUserId = activeUserRef.current;
      setPreferences((prev) => {
        const hasChanges = (Object.keys(patch) as (keyof UserPreferences)[]).some((k) => prev[k] !== patch[k]);
        if (!hasChanges) return prev;

        const next = { ...prev, ...patch };
        writeLocal(storageKeyFor(targetUserId), next);

        // Mantiene il tema anche sulla schermata di login dopo il logout
        if (patch.theme) {
          try {
            localStorage.setItem(LEGACY_THEME_KEY, patch.theme);
          } catch {
            // ignora
          }
        }

        if (targetUserId && isRemoteAccount) {
          pendingRemoteRef.current = next;
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          saveTimerRef.current = setTimeout(() => {
            saveTimerRef.current = null;
            const toSave = pendingRemoteRef.current;
            pendingRemoteRef.current = null;
            if (toSave && activeUserRef.current === targetUserId) {
              flushRemote(targetUserId, toSave);
            }
          }, SAVE_DEBOUNCE_MS);
        }
        return next;
      });
    },
    [isRemoteAccount, flushRemote]
  );

  const isLoaded = loadedFor === userId;

  const value = useMemo(
    () => ({ preferences, updatePreferences, isLoaded }),
    [preferences, updatePreferences, isLoaded]
  );

  return (
    <PreferencesContext.Provider value={value}>
      {userId && !isLoaded ? (
        <div className="min-h-screen flex items-center justify-center bg-black">
          <div className="flex flex-col items-center gap-2.5">
            <div className="w-8 h-8 rounded-full border-3 border-yellow-400/20 border-t-yellow-400 animate-spin" />
            <span className="text-xs text-yellow-400/80 font-medium">Caricamento preferenze account...</span>
          </div>
        </div>
      ) : (
        children
      )}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = (): PreferencesContextType => {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences deve essere utilizzato all\'interno di un PreferencesProvider');
  }
  return ctx;
};
