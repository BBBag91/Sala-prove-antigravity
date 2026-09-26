import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'salaprove_supabase_url';
const STORAGE_KEY_KEY = 'salaprove_supabase_key';

// Legge le credenziali da .env / .env.local, con fallback su localStorage
function getStoredUrl(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY_URL) || '';
    }
  } catch {
    // ignore
  }
  return '';
}

function getStoredKey(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY_KEY) || '';
    }
  } catch {
    // ignore
  }
  return '';
}

const DEFAULT_SUPABASE_URL = 'https://qapmpppmejfcekqdzrgz.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_vbdUnCY1YehkXPcdNsLsOw_YHaHCz1K';

const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '';
const envKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || '';

let activeUrl = envUrl || getStoredUrl() || DEFAULT_SUPABASE_URL;
let activeKey = envKey || getStoredKey() || DEFAULT_SUPABASE_KEY;

export const isSupabaseConfigured = (): boolean => {
  const url = (activeUrl || '').trim();
  const key = (activeKey || '').trim();
  return Boolean(
    url &&
    key &&
    !url.includes('your-project') &&
    !key.includes('your-anon-key') &&
    url.startsWith('https://')
  );
};

export const getSupabaseUrl = (): string => activeUrl;
export const getSupabaseKey = (): string => activeKey;

export const setSupabaseCredentials = (
  url: string,
  key: string
): { success: boolean; client: SupabaseClient | null } => {
  activeUrl = (url || '').trim();
  activeKey = (key || '').trim();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_URL, activeUrl);
      localStorage.setItem(STORAGE_KEY_KEY, activeKey);
    }
  } catch (e) {
    console.warn('Could not save to localStorage', e);
  }

  if (isSupabaseConfigured()) {
    supabase = createClient(activeUrl, activeKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    return { success: true, client: supabase };
  }
  supabase = null;
  return { success: false, client: null };
};

// Inizializza il client Supabase se le credenziali sono presenti
export let supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(activeUrl, activeKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
