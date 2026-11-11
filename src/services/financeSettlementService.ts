import { TeacherBillingCycle } from '../types';
import { VariabiliG } from '../utils/compensiFineMese';
import { supabaseService } from './supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';

export type SettlementStatus = 'da_saldare' | 'saldato';

export interface CashDenominations {
  b5: number;
  b10: number;
  b20: number;
  b50: number;
  b100: number;
  spicci: number;
}

export interface MonthlyCompensiRecord {
  totaleEntrateMese?: number;
  isManualEntrate?: boolean;
  G?: VariabiliG;
  cash?: CashDenominations;
  updatedAt?: string;
}

export interface FinanceSettlementCloudStore {
  teacherSettlements: Record<string, Record<string, SettlementStatus>>;
  teacherSettlementTimestamps?: Record<string, Record<string, string>>;
  monthlyCompensi: Record<string, MonthlyCompensiRecord>;
  teacherCycleOverrides?: Record<string, Record<string, TeacherBillingCycle>>;
}

const MASTER_STORAGE_KEY = 'salaprove_finance_settlement_store_v1';
const SEED_NOV2026_MICHAEL_KEY = 'salaprove_teacher_settlement_nov2026_michael_v1';

const CANONICAL_TEACHER_ALIASES: Record<string, string[]> = {
  'staff-1790952691190': ['staff-1790952691190', 'staff-1790952680654', 'name:michael bertin'],
  'staff-1790952680654': ['staff-1790952691190', 'staff-1790952680654', 'name:michael bertin'],
  'staff-1790952724237': ['staff-1790952724237', 'staff-1790952646698', 'name:luca di chiara'],
  'staff-1790952646698': ['staff-1790952724237', 'staff-1790952646698', 'name:luca di chiara'],
};

function getTeacherLookupKeys(teacherId: string, teacherName?: string): string[] {
  const keys = new Set<string>();
  if (teacherId) {
    keys.add(teacherId);
    const aliases = CANONICAL_TEACHER_ALIASES[teacherId];
    if (aliases) aliases.forEach((a) => keys.add(a));
  }
  const cleanName = (teacherName || '').trim().toLowerCase();
  if (cleanName) {
    keys.add(`name:${cleanName}`);
    if (cleanName.includes('michael')) {
      keys.add('staff-1790952691190');
      keys.add('staff-1790952680654');
      keys.add('name:michael bertin');
    } else if (cleanName.includes('luca')) {
      keys.add('staff-1790952724237');
      keys.add('staff-1790952646698');
      keys.add('name:luca di chiara');
    }
  }
  return Array.from(keys);
}

/**
 * Stato iniziale di riferimento (incluso Novembre 2026 da Foto 2 smartphone:
 * Michael Bertin 87.5h = 437,50 € segnato come SALDATO).
 */
function getDefaultStore(): FinanceSettlementCloudStore {
  return {
    teacherSettlements: {
      '2026-11': {
        'staff-1790952691190': 'saldato',
        'staff-1790952680654': 'saldato',
        'name:michael bertin': 'saldato',
      },
    },
    teacherSettlementTimestamps: {
      '2026-11': {
        'staff-1790952691190': '2026-11-11T18:27:00.000Z',
        'staff-1790952680654': '2026-11-11T18:27:00.000Z',
        'name:michael bertin': '2026-11-11T18:27:00.000Z',
      },
    },
    monthlyCompensi: {},
    teacherCycleOverrides: {},
  };
}

class FinanceSettlementService {
  private listeners: Set<() => void> = new Set();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.warn('[FinanceSettlementService] Listener error:', e);
      }
    });
  }

  getStore(): FinanceSettlementCloudStore {
    let store: FinanceSettlementCloudStore = getDefaultStore();
    try {
      const raw = localStorage.getItem(MASTER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          store = {
            teacherSettlements: parsed.teacherSettlements || {},
            teacherSettlementTimestamps: parsed.teacherSettlementTimestamps || {},
            monthlyCompensi: parsed.monthlyCompensi || {},
            teacherCycleOverrides: parsed.teacherCycleOverrides || {},
          };
        }
      }
    } catch (e) {
      console.warn('[FinanceSettlementService] Errore lettura localStorage:', e);
    }

    let changed = false;

    // Migrazione automatica delle chiavi legacy in localStorage (salaprove_quote_insegnanti_v1_* e salaprove_compensi_v3_*)
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        if (key.startsWith('salaprove_quote_insegnanti_v1_')) {
          const monthStr = key.replace('salaprove_quote_insegnanti_v1_', '');
          const saved = localStorage.getItem(key);
          if (saved && monthStr) {
            const parsedMap = JSON.parse(saved) as Record<string, SettlementStatus>;
            if (parsedMap && typeof parsedMap === 'object') {
              if (!store.teacherSettlements[monthStr]) {
                store.teacherSettlements[monthStr] = {};
              }
              Object.entries(parsedMap).forEach(([tId, st]) => {
                if (store.teacherSettlements[monthStr][tId] === undefined) {
                  store.teacherSettlements[monthStr][tId] = st;
                  changed = true;
                }
              });
            }
          }
        } else if (key.startsWith('salaprove_compensi_v3_')) {
          const monthStr = key.replace('salaprove_compensi_v3_', '');
          const saved = localStorage.getItem(key);
          if (saved && monthStr && !store.monthlyCompensi[monthStr]) {
            const parsedComp = JSON.parse(saved) as MonthlyCompensiRecord;
            if (parsedComp && typeof parsedComp === 'object') {
              store.monthlyCompensi[monthStr] = {
                ...parsedComp,
                updatedAt: parsedComp.updatedAt || '2026-11-01T00:00:00.000Z',
              };
              changed = true;
            }
          }
        }
      }
    } catch {}

    // Allineamento con Foto 2 smartphone (Michael Bertin 437,50 € Saldato in Novembre 2026)
    const isMichaelSeeded = localStorage.getItem(SEED_NOV2026_MICHAEL_KEY) === 'true';
    if (!isMichaelSeeded) {
      if (!store.teacherSettlements['2026-11']) {
        store.teacherSettlements['2026-11'] = {};
      }
      if (!store.teacherSettlementTimestamps) {
        store.teacherSettlementTimestamps = {};
      }
      if (!store.teacherSettlementTimestamps['2026-11']) {
        store.teacherSettlementTimestamps['2026-11'] = {};
      }
      const michaelKeys = ['staff-1790952691190', 'staff-1790952680654', 'name:michael bertin'];
      michaelKeys.forEach((k) => {
        store.teacherSettlements['2026-11'][k] = 'saldato';
        store.teacherSettlementTimestamps!['2026-11'][k] = '2026-11-11T18:27:00.000Z';
      });
      try {
        localStorage.setItem(SEED_NOV2026_MICHAEL_KEY, 'true');
      } catch {}
      changed = true;
    }

    if (changed) {
      this.saveStoreLocally(store);
    }

    return store;
  }

  private saveStoreLocally(store: FinanceSettlementCloudStore): void {
    try {
      localStorage.setItem(MASTER_STORAGE_KEY, JSON.stringify(store));
      // Mantieni sincronizzate anche le chiavi legacy per retrocompatibilità
      Object.entries(store.teacherSettlements || {}).forEach(([mStr, map]) => {
        localStorage.setItem(`salaprove_quote_insegnanti_v1_${mStr}`, JSON.stringify(map));
      });
      Object.entries(store.monthlyCompensi || {}).forEach(([mStr, comp]) => {
        localStorage.setItem(`salaprove_compensi_v3_${mStr}`, JSON.stringify(comp));
      });
    } catch (e) {
      console.warn('[FinanceSettlementService] Errore salvataggio locale:', e);
    }
  }

  private persistAndPush(store: FinanceSettlementCloudStore): void {
    this.saveStoreLocally(store);
    this.notifyListeners();
    if (isSupabaseConfigured()) {
      supabaseService.saveFinanceSettlementToStore(store).catch((err) => {
        console.warn('[FinanceSettlementService] Errore salvataggio cloud:', err);
      });
    }
  }

  // ── 1. STATO SALDO QUOTE LEZIONI INSEGNANTI (5€/h) ──

  getTeacherSettlementsForMonth(monthStr: string): Record<string, SettlementStatus> {
    const store = this.getStore();
    return { ...(store.teacherSettlements[monthStr] || {}) };
  }

  getTeacherSettlement(monthStr: string, teacherId: string, teacherName?: string): SettlementStatus {
    const monthMap = this.getTeacherSettlementsForMonth(monthStr);
    const keys = getTeacherLookupKeys(teacherId, teacherName);
    for (const k of keys) {
      if (monthMap[k] === 'saldato') return 'saldato';
    }
    for (const k of keys) {
      if (monthMap[k] === 'da_saldare') return 'da_saldare';
    }
    return 'da_saldare';
  }

  setTeacherSettlement(
    monthStr: string,
    teacherId: string,
    status: SettlementStatus,
    teacherName?: string
  ): void {
    const store = this.getStore();
    if (!store.teacherSettlements[monthStr]) {
      store.teacherSettlements[monthStr] = {};
    }
    if (!store.teacherSettlementTimestamps) {
      store.teacherSettlementTimestamps = {};
    }
    if (!store.teacherSettlementTimestamps[monthStr]) {
      store.teacherSettlementTimestamps[monthStr] = {};
    }

    const nowIso = new Date().toISOString();
    const keys = getTeacherLookupKeys(teacherId, teacherName);
    keys.forEach((k) => {
      store.teacherSettlements[monthStr][k] = status;
      store.teacherSettlementTimestamps![monthStr][k] = nowIso;
    });

    this.persistAndPush(store);
  }

  toggleTeacherSettlement(monthStr: string, teacherId: string, teacherName?: string): SettlementStatus {
    const current = this.getTeacherSettlement(monthStr, teacherId, teacherName);
    const next: SettlementStatus = current === 'saldato' ? 'da_saldare' : 'saldato';
    this.setTeacherSettlement(monthStr, teacherId, next, teacherName);
    return next;
  }

  // ── 2. CICLO DI FATTURAZIONE OVERRIDE (Mese corrente / Posticipato) ──

  getTeacherCycleOverrides(monthStr: string): Record<string, TeacherBillingCycle> {
    const store = this.getStore();
    return { ...(store.teacherCycleOverrides?.[monthStr] || {}) };
  }

  setTeacherCycleOverride(monthStr: string, teacherId: string, cycle: TeacherBillingCycle): void {
    const store = this.getStore();
    if (!store.teacherCycleOverrides) store.teacherCycleOverrides = {};
    if (!store.teacherCycleOverrides[monthStr]) store.teacherCycleOverrides[monthStr] = {};
    store.teacherCycleOverrides[monthStr][teacherId] = cycle;
    this.persistAndPush(store);
  }

  // ── 3. COMPENSI FINE MESE & CONTA BANCONOTE/MONETE ──

  getMonthlyCompensi(monthStr: string): MonthlyCompensiRecord | null {
    const store = this.getStore();
    return store.monthlyCompensi[monthStr] || null;
  }

  saveMonthlyCompensi(monthStr: string, record: MonthlyCompensiRecord): void {
    const store = this.getStore();
    const prev = store.monthlyCompensi[monthStr];
    const nextRecord: MonthlyCompensiRecord = {
      ...prev,
      ...record,
      updatedAt: new Date().toISOString(),
    };

    // Evita salvataggi ridondanti se i dati non sono cambiati
    if (
      prev &&
      prev.isManualEntrate === nextRecord.isManualEntrate &&
      prev.totaleEntrateMese === nextRecord.totaleEntrateMese &&
      JSON.stringify(prev.G) === JSON.stringify(nextRecord.G) &&
      JSON.stringify(prev.cash) === JSON.stringify(nextRecord.cash)
    ) {
      return;
    }

    store.monthlyCompensi[monthStr] = nextRecord;
    this.persistAndPush(store);
  }

  // ── 4. SINCRONIZZAZIONE CLOUD SUPABASE ──

  syncFromCloud(remoteStore: FinanceSettlementCloudStore | null): void {
    const localStore = this.getStore();

    if (!remoteStore) {
      // Se il database non ha ancora lo store, invia subito lo stato consolidato (incluso Michael Bertin Saldato)
      if (isSupabaseConfigured()) {
        supabaseService.saveFinanceSettlementToStore(localStore).catch(console.error);
      }
      return;
    }

    let needsCloudUpdate = false;

    const mergedSettlements: Record<string, Record<string, SettlementStatus>> = {
      ...(remoteStore.teacherSettlements || {}),
    };
    const mergedTimestamps: Record<string, Record<string, string>> = {
      ...(remoteStore.teacherSettlementTimestamps || {}),
    };

    // Unisci gli stati saldo docenti mese per mese basandoti sul timestamp più recente
    const allSettlementMonths = new Set([
      ...Object.keys(localStore.teacherSettlements || {}),
      ...Object.keys(remoteStore.teacherSettlements || {}),
    ]);

    allSettlementMonths.forEach((mStr) => {
      const localMap = localStore.teacherSettlements?.[mStr] || {};
      const remoteMap = remoteStore.teacherSettlements?.[mStr] || {};
      const localTsMap = localStore.teacherSettlementTimestamps?.[mStr] || {};
      const remoteTsMap = remoteStore.teacherSettlementTimestamps?.[mStr] || {};

      if (!mergedSettlements[mStr]) mergedSettlements[mStr] = {};
      if (!mergedTimestamps[mStr]) mergedTimestamps[mStr] = {};

      const allKeys = new Set([...Object.keys(localMap), ...Object.keys(remoteMap)]);
      allKeys.forEach((k) => {
        const lVal = localMap[k];
        const rVal = remoteMap[k];
        const lTs = localTsMap[k] || '';
        const rTs = remoteTsMap[k] || '';

        if (lVal !== undefined && rVal === undefined) {
          mergedSettlements[mStr][k] = lVal;
          mergedTimestamps[mStr][k] = lTs || new Date().toISOString();
          needsCloudUpdate = true;
        } else if (rVal !== undefined && lVal === undefined) {
          mergedSettlements[mStr][k] = rVal;
          mergedTimestamps[mStr][k] = rTs;
        } else if (lVal !== undefined && rVal !== undefined) {
          if (lVal !== rVal) {
            if (lTs > rTs) {
              mergedSettlements[mStr][k] = lVal;
              mergedTimestamps[mStr][k] = lTs;
              needsCloudUpdate = true;
            } else if (rTs > lTs) {
              mergedSettlements[mStr][k] = rVal;
              mergedTimestamps[mStr][k] = rTs;
            } else {
              // Parità di timestamp: privilegia 'saldato' (es. Foto 2 smartphone)
              const winner: SettlementStatus = lVal === 'saldato' || rVal === 'saldato' ? 'saldato' : 'da_saldare';
              mergedSettlements[mStr][k] = winner;
              if (winner !== rVal) needsCloudUpdate = true;
            }
          } else {
            mergedSettlements[mStr][k] = rVal;
            mergedTimestamps[mStr][k] = rTs >= lTs ? rTs : lTs;
          }
        }
      });
    });

    // Unisci i dati Compensi Fine Mese & Conta Banconote/Monete basandoti su updatedAt
    const mergedCompensi: Record<string, MonthlyCompensiRecord> = {
      ...(remoteStore.monthlyCompensi || {}),
    };
    const allCompensiMonths = new Set([
      ...Object.keys(localStore.monthlyCompensi || {}),
      ...Object.keys(remoteStore.monthlyCompensi || {}),
    ]);

    allCompensiMonths.forEach((mStr) => {
      const lComp = localStore.monthlyCompensi?.[mStr];
      const rComp = remoteStore.monthlyCompensi?.[mStr];
      if (lComp && !rComp) {
        mergedCompensi[mStr] = lComp;
        needsCloudUpdate = true;
      } else if (rComp && !lComp) {
        mergedCompensi[mStr] = rComp;
      } else if (lComp && rComp) {
        const lTime = lComp.updatedAt || '';
        const rTime = rComp.updatedAt || '';
        if (lTime > rTime && JSON.stringify(lComp) !== JSON.stringify(rComp)) {
          mergedCompensi[mStr] = lComp;
          needsCloudUpdate = true;
        } else {
          mergedCompensi[mStr] = rComp;
        }
      }
    });

    // Unisci eventuali override di ciclo
    const mergedCycles: Record<string, Record<string, TeacherBillingCycle>> = {
      ...(localStore.teacherCycleOverrides || {}),
      ...(remoteStore.teacherCycleOverrides || {}),
    };

    const mergedStore: FinanceSettlementCloudStore = {
      teacherSettlements: mergedSettlements,
      teacherSettlementTimestamps: mergedTimestamps,
      monthlyCompensi: mergedCompensi,
      teacherCycleOverrides: mergedCycles,
    };

    this.saveStoreLocally(mergedStore);
    this.notifyListeners();

    if (needsCloudUpdate && isSupabaseConfigured()) {
      supabaseService.saveFinanceSettlementToStore(mergedStore).catch(console.error);
    }
  }

  pushToCloud(): void {
    if (!isSupabaseConfigured()) return;
    const store = this.getStore();
    supabaseService.saveFinanceSettlementToStore(store).catch(console.error);
  }
}

export const financeSettlementService = new FinanceSettlementService();
