import React, { useState } from 'react';
import { X, Cloud, Database, CheckCircle2, AlertCircle, Copy, Check, RefreshCw, UploadCloud, ExternalLink, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isSupabaseConfigured, getSupabaseUrl } from '../lib/supabase';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({ isOpen, onClose }) => {
  const {
    rooms,
    staff,
    clients,
    bookings,
    expenses,
    incomes,
    isCloudConnected,
    isLoadingCloud,
    syncLocalToCloud,
    refreshFromCloud,
  } = useApp();

  const [copied, setCopied] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  if (!isOpen) return null;

  const configured = isSupabaseConfigured();
  const currentUrl = getSupabaseUrl();

  const handleCopyEnv = () => {
    const envSnippet = `# Configurazione Supabase per Gestione Sala Prove
VITE_SUPABASE_URL=https://tuo-progetto.supabase.co
VITE_SUPABASE_ANON_KEY=la-tua-chiave-anon-public-key`;
    navigator.clipboard.writeText(envSnippet);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2500);
  };

  const handleCopySqlPath = () => {
    // Read or copy notice
    const notice = `-- Esegui lo schema presente nel file: supabase/schema.sql
-- Contiene tutte le tabelle (rooms, staff, clients, bookings, expenses, incomes, studio_info)
-- e le policy di sicurezza RLS configurate per la tua applicazione.`;
    navigator.clipboard.writeText(notice);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSyncToCloud = async () => {
    try {
      setIsSyncing(true);
      setSyncStatus('Sincronizzazione in corso verso Supabase...');
      await syncLocalToCloud();
      setSyncStatus('✅ Tutti i dati locali (sale, staff, clienti, prenotazioni, spese) sono stati caricati su Supabase!');
    } catch (err: any) {
      setSyncStatus(`❌ Errore durante il caricamento: ${err.message || 'Controlla che le tabelle siano state create su Supabase'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRefreshCloud = async () => {
    try {
      setIsSyncing(true);
      setSyncStatus('Download ultimi dati dal database Supabase...');
      await refreshFromCloud();
      setSyncStatus('✅ Dati aggiornati con successo da Supabase!');
    } catch (err: any) {
      setSyncStatus(`❌ Errore: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0e0e0e] border border-yellow-500/40 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden text-neutral-100">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-yellow-500/20 bg-neutral-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Integrazione Database Cloud Supabase</span>
                {configured ? (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                    Configurato
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                    In attesa credenziali
                  </span>
                )}
              </h2>
              <p className="text-xs text-neutral-400">
                Sincronizza in tempo reale prenotazioni, soci, sale e spese su PostgreSQL Cloud
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs leading-relaxed">
          
          {/* Status Box */}
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${
            configured
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
              : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
          }`}>
            {configured ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-white">
                {configured ? 'Supabase è Configurato nel Progetto!' : 'Credenziali Supabase non ancora inserite'}
              </h3>
              <p className="text-xs opacity-90 mt-0.5">
                {configured
                  ? `URL Connesso: ${currentUrl}`
                  : 'L\'app sta attualmente memorizzando i dati in sicurezza in memoria locale (LocalStorage). Per abilitare la sincronizzazione multi-dispositivo sul cloud di Supabase, segui i 3 semplici passaggi qui sotto.'}
              </p>
            </div>
          </div>

          {/* Sync Actions (if configured) */}
          {configured && (
            <div className="bg-neutral-900/80 border border-yellow-500/30 rounded-xl p-4 space-y-3">
              <h4 className="font-bold text-yellow-300 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                <UploadCloud className="w-4 h-4 text-yellow-400" />
                Azioni di Sincronizzazione Cloud
              </h4>
              <p className="text-neutral-300 text-xs">
                Puoi inviare tutti i dati locali attuali sul tuo database Supabase, oppure ricaricare i dati salvati sul cloud.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-1 text-center">
                <div className="bg-neutral-950 p-2 rounded-lg border border-neutral-800">
                  <span className="block text-base font-extrabold text-yellow-400">{rooms.length}</span>
                  <span className="text-[10px] text-neutral-400">Sale</span>
                </div>
                <div className="bg-neutral-950 p-2 rounded-lg border border-neutral-800">
                  <span className="block text-base font-extrabold text-yellow-400">{bookings.length}</span>
                  <span className="text-[10px] text-neutral-400">Prenotazioni</span>
                </div>
                <div className="bg-neutral-950 p-2 rounded-lg border border-neutral-800">
                  <span className="block text-base font-extrabold text-yellow-400">{clients.length}</span>
                  <span className="text-[10px] text-neutral-400">Clienti / Soci</span>
                </div>
                <div className="bg-neutral-950 p-2 rounded-lg border border-neutral-800">
                  <span className="block text-base font-extrabold text-yellow-400">{expenses.length}</span>
                  <span className="text-[10px] text-neutral-400">Spese</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-1">
                <button
                  onClick={handleSyncToCloud}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-3 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-lg transition-all text-xs cursor-pointer shadow-md disabled:opacity-50"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{isSyncing ? 'Sincronizzazione...' : 'Carica Dati Locali su Supabase'}</span>
                </button>
                <button
                  onClick={handleRefreshCloud}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded-lg transition-all text-xs cursor-pointer border border-neutral-700 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Scarica dal Cloud</span>
                </button>
              </div>

              {syncStatus && (
                <div className="p-2.5 rounded-lg bg-neutral-950 border border-yellow-500/30 text-xs text-yellow-200 mt-2">
                  {syncStatus}
                </div>
              )}
            </div>
          )}

          {/* Setup Guide */}
          <div className="space-y-3">
            <h4 className="font-bold text-yellow-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              Guida Rapida di Collegamento Supabase
            </h4>

            {/* Step 1 */}
            <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-1">
              <div className="font-bold text-white flex items-center justify-between">
                <span>1. Crea un progetto gratuito su Supabase</span>
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                  className="text-yellow-400 hover:underline inline-flex items-center gap-1 text-[11px]"
                >
                  Apri Supabase <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-neutral-400 text-xs">
                Accedi a supabase.com, crea un nuovo progetto e attendi qualche istante che il database sia pronto.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-2">
              <div className="font-bold text-white flex items-center justify-between">
                <span>2. Esegui lo Schema Database nel "SQL Editor"</span>
                <span className="text-[10px] text-yellow-400/80 font-mono">supabase/schema.sql</span>
              </div>
              <p className="text-neutral-400 text-xs">
                È già stato creato il file <code className="text-yellow-300 font-mono">supabase/schema.sql</code> contenente tutte le tabelle (sale, prenotazioni, staff, clienti, spese) e le relative policy di sicurezza RLS. Aprilo e incollalo nel "SQL Editor" di Supabase, poi premi <strong>Run</strong>.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-2">
              <div className="font-bold text-white flex items-center justify-between">
                <span>3. Inserisci URL e Anon Key nel file .env.local</span>
                <button
                  type="button"
                  onClick={handleCopyEnv}
                  className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1 bg-neutral-900 px-2 py-0.5 rounded border border-yellow-500/30 cursor-pointer"
                >
                  {copiedEnv ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedEnv ? 'Copiato!' : 'Copia Esempio'}</span>
                </button>
              </div>
              <p className="text-neutral-400 text-xs">
                Nella dashboard del tuo progetto Supabase, vai in <strong>Project Settings &gt; API</strong> e copia la tua <strong>URL</strong> e la chiave <strong>anon / public</strong> nel file <code className="text-yellow-300 font-mono">.env.local</code>:
              </p>
              <pre className="bg-black/90 p-2.5 rounded-lg border border-neutral-800 text-[11px] font-mono text-emerald-400 overflow-x-auto">
{`VITE_SUPABASE_URL=https://xyzcompany.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI...`}
              </pre>
            </div>

          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-yellow-500/20 bg-neutral-950 flex items-center justify-between">
          <span className="text-[11px] text-neutral-400">
            {configured ? '🟢 Sincronizzazione cloud abilitata' : '💾 Modalità memoria locale attiva'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs transition-all cursor-pointer"
          >
            Chiudi
          </button>
        </div>

      </div>
    </div>
  );
};
