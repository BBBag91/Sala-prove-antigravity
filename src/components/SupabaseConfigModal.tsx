import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  UploadCloud,
  Eye,
  EyeOff,
  Server,
  Sparkles,
  ShieldCheck,
  DownloadCloud,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isSupabaseConfigured, getSupabaseUrl, getSupabaseKey } from '../lib/supabase';
import { supabaseService } from '../services/supabaseService';

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
    isCloudConnected,
    isLoadingCloud,
    syncLocalToCloud,
    refreshFromCloud,
    reconnectSupabase,
  } = useApp();

  const [urlInput, setUrlInput] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUrlInput(getSupabaseUrl());
      setKeyInput(getSupabaseKey());
      setTestResult(null);
      setSyncStatus(null);
      setSyncError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const configured = isSupabaseConfigured();

  const handleCopyEnv = () => {
    const envSnippet = `# Configurazione Supabase per Gestione Sala Prove
VITE_SUPABASE_URL=${urlInput || 'https://tuo-progetto.supabase.co'}
VITE_SUPABASE_ANON_KEY=${keyInput || 'la-tua-chiave-anon-public-key'}`;
    navigator.clipboard.writeText(envSnippet);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2500);
  };

  const handleSaveAndConnect = async () => {
    setIsTesting(true);
    setSyncStatus(null);
    setSyncError(null);
    try {
      const ok = await reconnectSupabase(urlInput, keyInput);
      if (ok) {
        setTestResult({ ok: true, message: 'Credenziali salvate e connessione a Supabase stabilita con successo!' });
      } else {
        setTestResult({ ok: false, message: 'Impossibile connettersi: verifica URL e chiave anon.' });
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || 'Errore durante la connessione.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await supabaseService.testConnection();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || 'Errore durante il test di connessione.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncToCloud = async () => {
    try {
      setIsSyncing(true);
      setSyncStatus('Sincronizzazione in corso verso il database Supabase...');
      setSyncError(null);
      await syncLocalToCloud();
      setSyncStatus(`✅ Sincronizzazione completata! ${rooms.length} sale, ${staff.length} operatori, ${clients.length} clienti, ${bookings.length} prenotazioni e ${expenses.length} spese salvate su Supabase.`);
    } catch (err: any) {
      setSyncError(`❌ Errore durante il caricamento: ${err.message || 'Verifica le tabelle e permessi su Supabase.'}`);
      setSyncStatus(null);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRefreshCloud = async () => {
    try {
      setIsSyncing(true);
      setSyncStatus('Download in corso dei dati aggiornati da Supabase...');
      setSyncError(null);
      await refreshFromCloud();
      setSyncStatus('✅ Dati scaricati con successo da Supabase!');
    } catch (err: any) {
      setSyncError(`❌ Errore durante il download: ${err.message}`);
      setSyncStatus(null);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0c0c0c] border border-yellow-500/40 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden text-neutral-100">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-yellow-500/20 bg-neutral-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
              isCloudConnected
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-md shadow-emerald-500/20'
                : 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400'
            }`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Database Cloud Supabase</span>
                {isCloudConnected ? (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Connesso &amp; Attivo
                  </span>
                ) : configured ? (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                    Configurato
                  </span>
                ) : (
                  <span className="text-[10px] bg-neutral-800 text-neutral-400 border border-neutral-700 px-2 py-0.5 rounded-full font-bold">
                    Memoria Locale
                  </span>
                )}
              </h2>
              <p className="text-xs text-neutral-400">
                PostgreSQL Cloud ad alta disponibilità per sincronizzare prenotazioni e contabilità
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1.5 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs leading-relaxed">

          {/* Connection Status Box */}
          <div className={`p-4 rounded-xl border flex items-start gap-3 transition-colors ${
            isCloudConnected
              ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-200'
              : configured
              ? 'bg-amber-950/25 border-amber-500/40 text-amber-200'
              : 'bg-neutral-900 border-neutral-800 text-neutral-300'
          }`}>
            {isCloudConnected ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-sm text-white">
                  {isCloudConnected
                    ? 'Collegamento Cloud Supabase Operativo'
                    : configured
                    ? 'Credenziali Rilevate'
                    : 'Modalità Locale Attiva'}
                </h3>
                <span className="text-[10px] font-mono text-neutral-400 truncate max-w-[200px]">
                  {urlInput ? urlInput.replace('https://', '') : 'Nessuna URL'}
                </span>
              </div>
              <p className="text-xs opacity-90 mt-1">
                {isCloudConnected
                  ? 'Tutte le modifiche (creazione prenotazioni, tesseramento soci, gestione turni e spese) vengono sincronizzate in tempo reale sul database cloud.'
                  : 'L\'applicazione memorizza temporaneamente i dati nel browser. Inserisci o verifica le credenziali Supabase per iniziare a salvare sul cloud.'}
              </p>
            </div>
          </div>

          {/* Counters Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
            <div className="bg-neutral-950 p-2.5 rounded-xl border border-yellow-500/20">
              <span className="block text-lg font-black text-yellow-400">{rooms.length}</span>
              <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Sale</span>
            </div>
            <div className="bg-neutral-950 p-2.5 rounded-xl border border-yellow-500/20">
              <span className="block text-lg font-black text-yellow-400">{staff.length}</span>
              <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Staff</span>
            </div>
            <div className="bg-neutral-950 p-2.5 rounded-xl border border-yellow-500/20">
              <span className="block text-lg font-black text-yellow-400">{clients.length}</span>
              <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Clienti</span>
            </div>
            <div className="bg-neutral-950 p-2.5 rounded-xl border border-yellow-500/20">
              <span className="block text-lg font-black text-yellow-400">{bookings.length}</span>
              <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Prenotazioni</span>
            </div>
            <div className="bg-neutral-950 p-2.5 rounded-xl border border-yellow-500/20 col-span-2 sm:col-span-1">
              <span className="block text-lg font-black text-yellow-400">{expenses.length}</span>
              <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Spese</span>
            </div>
          </div>

          {/* Credentials Configuration Form */}
          <div className="bg-neutral-950/80 border border-yellow-500/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-yellow-300 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                <Server className="w-4 h-4 text-yellow-400" />
                Credenziali di Accesso Supabase
              </h4>
              <button
                type="button"
                onClick={handleCopyEnv}
                className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1 bg-neutral-900 px-2 py-0.5 rounded border border-yellow-500/30 cursor-pointer"
                title="Copia configurazione per file .env.local"
              >
                {copiedEnv ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedEnv ? 'Copiato!' : 'Copia per .env'}</span>
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                  URL del Progetto Supabase:
                </label>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-yellow-500/30 text-yellow-200 text-xs font-mono focus:border-yellow-400 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                  Chiave Anon / Publishable API Key:
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="sb_publishable_... oppure eyJhbGciOi..."
                    className="w-full px-3 py-2 pr-10 rounded-lg bg-neutral-900 border border-yellow-500/30 text-yellow-200 text-xs font-mono focus:border-yellow-400 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-yellow-400"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveAndConnect}
                disabled={isTesting || !urlInput || !keyInput}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-lg transition-all text-xs cursor-pointer shadow-md disabled:opacity-50"
              >
                {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Salva e Connetti</span>
              </button>

              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-semibold rounded-lg transition-all text-xs cursor-pointer border border-neutral-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>Testa Connessione</span>
              </button>
            </div>

            {testResult && (
              <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                testResult.ok
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}>
                {testResult.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Sync Operations Card */}
          <div className="bg-neutral-950/80 border border-yellow-500/30 rounded-xl p-4 space-y-3">
            <h4 className="font-bold text-yellow-300 flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <UploadCloud className="w-4 h-4 text-yellow-400" />
              Sincronizzazione Manuale Database
            </h4>
            <p className="text-neutral-300 text-xs">
              Usa questi comandi se desideri forzare il caricamento massivo dei dati locali sul database cloud o ricaricare i dati aggiornati da Supabase.
            </p>

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={handleSyncToCloud}
                disabled={isSyncing || isLoadingCloud}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-lg transition-all text-xs cursor-pointer shadow-md disabled:opacity-50"
              >
                <UploadCloud className="w-4 h-4" />
                <span>{isSyncing ? 'Caricamento in corso...' : 'Carica Dati su Supabase'}</span>
              </button>

              <button
                onClick={handleRefreshCloud}
                disabled={isSyncing || isLoadingCloud}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-semibold rounded-lg transition-all text-xs cursor-pointer border border-neutral-700 disabled:opacity-50"
              >
                <DownloadCloud className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
                <span>Scarica da Supabase</span>
              </button>
            </div>

            {syncStatus && (
              <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-200 animate-in fade-in flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{syncStatus}</span>
              </div>
            )}

            {syncError && (
              <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 animate-in fade-in flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{syncError}</span>
              </div>
            )}
          </div>

          {/* Quick Info Box */}
          <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1.5 text-neutral-400 text-[11px]">
            <div className="flex items-center gap-1.5 text-yellow-400 font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>Protezione e Persistenza Dati</span>
            </div>
            <p>
              Lo schema SQL (<code className="text-yellow-300 font-mono">supabase/schema.sql</code>) include tutte le tabelle (sale, prenotazioni, staff, clienti, spese, studio_info) con le policy RLS attive.
              L'applicazione invia automaticamente ogni inserimento, cancellazione o modifica direttamente al tuo database Cloud PostgreSQL.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-yellow-500/20 bg-neutral-950 flex items-center justify-between">
          <span className="text-[11px] text-neutral-400">
            {isCloudConnected ? '🟢 Supabase Cloud Online & Attivo' : configured ? '🟡 Credenziali presenti' : '💾 Modalità Locale'}
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
