import React, { useState } from 'react';
import {
  Shield,
  User,
  UserPlus,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  KeyRound,
  Sparkles,
  Info,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose }) => {
  const { isAdmin, createUserAccount, registeredUsers, deleteUserAccount, refreshRegisteredUsers } = useAuth();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen || !isAdmin) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const result = await createUserAccount({
        nome,
        email,
        password,
        role,
      });

      if (result.success) {
        setSuccessMessage(`Account ${email} creato con successo su Supabase Auth con ruolo "${role === 'admin' ? 'Amministratore' : 'Utente Standard'}"!`);
        setNome('');
        setEmail('');
        setPassword('');
        setRole('user');
      } else {
        setErrorMessage(result.error || 'Errore durante la creazione dell\'account.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Errore imprevisto.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyEmail = (userEmail: string, id: string) => {
    navigator.clipboard.writeText(userEmail);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string, userEmail: string) => {
    if (window.confirm(`Sei sicuro di voler rimuovere l'account ${userEmail}?`)) {
      await deleteUserAccount(id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0e0e0e] border border-yellow-500/30 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-yellow-500/20 bg-neutral-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-400/20 border border-yellow-500/40 text-yellow-400 flex items-center justify-center">
              <Shield className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Gestione Utenti &amp; Accessi
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-yellow-400 text-black text-[10px] font-extrabold uppercase">
                  Area Admin
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Crea nuovi account collegati a Supabase Auth e controlla i permessi RBAC
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-yellow-400 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Feedback messages */}
          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{successMessage}</div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Form to create new user */}
          <div className="bg-neutral-950 rounded-xl p-4 sm:p-5 border border-yellow-500/20 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-yellow-400" />
                <h3 className="text-xs sm:text-sm font-bold text-yellow-100 uppercase tracking-wide">
                  Crea Nuovo Account Utente
                </h3>
              </div>
              <span className="text-[11px] text-yellow-500/70 font-mono">Supabase Auth API</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Nome e Cognome
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="es. Marco Rossi"
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-neutral-800 bg-[#0a0a0a] text-yellow-100 text-xs sm:text-sm focus:border-yellow-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Indirizzo Email
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="es. marco.rossi@studio.it"
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-neutral-800 bg-[#0a0a0a] text-yellow-100 text-xs sm:text-sm focus:border-yellow-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Password (min. 6 caratteri)
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-9 py-2 rounded-lg border border-neutral-800 bg-[#0a0a0a] text-yellow-100 text-xs sm:text-sm focus:border-yellow-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-yellow-400"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Ruolo e Permessi
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('user')}
                      className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        role === 'user'
                          ? 'bg-neutral-800 text-emerald-400 border-emerald-500/60 shadow-xs'
                          : 'bg-[#0a0a0a] text-neutral-400 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Utente (User)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole('admin')}
                      className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        role === 'admin'
                          ? 'bg-yellow-400/20 text-yellow-300 border-yellow-400 shadow-xs'
                          : 'bg-[#0a0a0a] text-neutral-400 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5 text-yellow-400" />
                      <span>Admin</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Role explanation */}
              <div className="text-[11px] p-2.5 rounded-lg bg-[#0a0a0a] border border-neutral-800 text-neutral-300">
                {role === 'admin' ? (
                  <span className="text-yellow-300">
                    👑 <strong>Amministratore:</strong> Accesso completo a Calendario, Spese, Bollette, Operatori, Clienti, Sale e Creazione Utenti.
                  </span>
                ) : (
                  <span className="text-emerald-400">
                    👤 <strong>Utente Standard:</strong> Accesso riservato esclusivamente al Calendario e alla gestione delle prenotazioni delle sale. Le sezioni Conti &amp; Bollette sono nascoste.
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-yellow-400 hover:bg-yellow-300 active:scale-[0.99] disabled:opacity-50 text-black font-bold text-xs sm:text-sm rounded-lg shadow-md shadow-yellow-500/20 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Registrazione su Supabase in corso...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Crea Account su Supabase</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Info note */}
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-blue-200">Verifica Email Supabase:</p>
              <p className="text-[11px] text-blue-300/90 leading-relaxed">
                Se nel tuo progetto Supabase hai l'opzione <em>"Confirm email"</em> attiva, il nuovo utente riceverà un'email di attivazione prima di poter effettuare il login. Per consentire l'accesso immediato senza verifica email, puoi disattivare l'opzione nella Dashboard Supabase sotto <strong>Authentication &gt; Providers &gt; Email &gt; Confirm email</strong>.
              </p>
            </div>
          </div>

          {/* List of registered users */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-yellow-400" />
                <h3 className="text-xs font-bold text-yellow-300 uppercase tracking-wider">
                  Account Registrati ({registeredUsers.length})
                </h3>
              </div>
              <button
                onClick={refreshRegisteredUsers}
                className="text-xs text-neutral-400 hover:text-yellow-400 flex items-center gap-1 transition-colors"
                title="Ricarica elenco"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Aggiorna</span>
              </button>
            </div>

            <div className="divide-y divide-neutral-850 border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950">
              {registeredUsers.length === 0 ? (
                <div className="p-4 text-center text-xs text-neutral-500">
                  Nessun account memorizzato. Crea il primo con il modulo qui sopra.
                </div>
              ) : (
                registeredUsers.map((u) => (
                  <div
                    key={u.id}
                    className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-neutral-900/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                        u.ruolo === 'admin'
                          ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-500/40'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      }`}>
                        {u.ruolo === 'admin' ? '👑' : '👤'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs sm:text-sm font-bold text-white truncate">
                            {u.nome || u.email.split('@')[0]}
                          </p>
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase ${
                            u.ruolo === 'admin'
                              ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          }`}>
                            {u.ruolo === 'admin' ? 'Admin' : 'Utente'}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-400 font-mono truncate">{u.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleCopyEmail(u.email, u.id)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-yellow-400 hover:bg-neutral-800 transition-colors"
                        title="Copia indirizzo email"
                      >
                        {copiedId === u.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(u.id, u.email)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
                        title="Elimina account dalla lista"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-neutral-800 bg-neutral-950 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-yellow-300 text-xs font-bold rounded-lg border border-yellow-500/30 transition-all"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
