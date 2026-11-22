import { TabSheetDocument } from '../utils/tabPdfGenerator';
import { supabaseService } from './supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';

const STORAGE_KEY = 'salaprove_saved_tabs_v1';
const DELETED_IDS_KEY = 'salaprove_deleted_tabs_ids_v1';

class TabLibraryService {
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
        console.warn('[TabLibraryService] Listener error:', e);
      }
    });
  }

  private getDeletedIds(): Set<string> {
    try {
      const raw = localStorage.getItem(DELETED_IDS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch {}
    return new Set();
  }

  private addDeletedId(id: string): void {
    try {
      const set = this.getDeletedIds();
      set.add(id);
      localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(Array.from(set)));
    } catch {}
  }

  getAllTabs(): TabSheetDocument[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        }
      }
    } catch (e) {
      console.warn('[TabLibraryService] Errore lettura localStorage:', e);
    }
    return [];
  }

  private saveLocally(list: TabSheetDocument[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('[TabLibraryService] Errore salvataggio locale:', e);
    }
  }

  private persistAndPush(list: TabSheetDocument[]): void {
    const sorted = [...list].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    this.saveLocally(sorted);
    this.notifyListeners();
    if (isSupabaseConfigured()) {
      supabaseService.saveTabLibraryToStore(sorted).catch((err) => {
        console.warn('[TabLibraryService] Errore salvataggio cloud:', err);
      });
    }
  }

  saveTab(doc: TabSheetDocument): TabSheetDocument {
    const all = this.getAllTabs();
    const nowIso = new Date().toISOString();
    const updatedDoc: TabSheetDocument = {
      ...doc,
      updatedAt: nowIso,
    };

    const existingIdx = all.findIndex(
      (t) =>
        t.id === updatedDoc.id ||
        (t.title.trim().toLowerCase() === updatedDoc.title.trim().toLowerCase() &&
          t.instrument === updatedDoc.instrument &&
          (t.artistOrStudent || '').trim().toLowerCase() ===
            (updatedDoc.artistOrStudent || '').trim().toLowerCase())
    );

    let nextList: TabSheetDocument[];
    if (existingIdx >= 0) {
      const finalDoc = { ...updatedDoc, id: all[existingIdx].id };
      nextList = [...all];
      nextList[existingIdx] = finalDoc;
      this.persistAndPush(nextList);
      return finalDoc;
    } else {
      nextList = [updatedDoc, ...all];
      this.persistAndPush(nextList);
      return updatedDoc;
    }
  }

  duplicateTab(doc: TabSheetDocument): TabSheetDocument {
    const copy: TabSheetDocument = {
      ...doc,
      id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: `${doc.title} (Copia)`,
      updatedAt: new Date().toISOString(),
    };
    const all = this.getAllTabs();
    this.persistAndPush([copy, ...all]);
    return copy;
  }

  deleteTab(id: string): void {
    this.addDeletedId(id);
    const next = this.getAllTabs().filter((t) => t.id !== id);
    this.persistAndPush(next);
  }

  syncFromCloud(remoteList: TabSheetDocument[] | null): void {
    const localList = this.getAllTabs();
    const deletedIds = this.getDeletedIds();

    if (!remoteList || remoteList.length === 0) {
      if (localList.length > 0 && isSupabaseConfigured()) {
        supabaseService.saveTabLibraryToStore(localList).catch(console.error);
      }
      return;
    }

    const mergedMap = new Map<string, TabSheetDocument>();
    let needsPush = false;

    remoteList.forEach((rDoc) => {
      if (!rDoc || !rDoc.id) return;
      if (deletedIds.has(rDoc.id)) {
        needsPush = true;
        return;
      }
      mergedMap.set(rDoc.id, rDoc);
    });

    localList.forEach((lDoc) => {
      if (!lDoc || !lDoc.id || deletedIds.has(lDoc.id)) return;
      const existing = mergedMap.get(lDoc.id);
      if (!existing) {
        mergedMap.set(lDoc.id, lDoc);
        needsPush = true;
      } else if ((lDoc.updatedAt || '') > (existing.updatedAt || '')) {
        mergedMap.set(lDoc.id, lDoc);
        needsPush = true;
      }
    });

    const mergedList = Array.from(mergedMap.values()).sort((a, b) =>
      (b.updatedAt || '').localeCompare(a.updatedAt || '')
    );

    this.saveLocally(mergedList);
    this.notifyListeners();

    if (needsPush && isSupabaseConfigured()) {
      supabaseService.saveTabLibraryToStore(mergedList).catch(console.error);
    }
  }

  pushToCloud(): void {
    if (!isSupabaseConfigured()) return;
    const all = this.getAllTabs();
    supabaseService.saveTabLibraryToStore(all).catch(console.error);
  }
}

export const tabLibraryService = new TabLibraryService();
