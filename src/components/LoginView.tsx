import React, { useState } from 'react';
import {
  Music2,
  Shield,
  User,
  KeyRound,
  Eye,
  EyeOff,
  Calendar,
  Receipt,
  Users,
  Building2,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

export const LoginView: React.FC = () => {
  const { login, loginAsRole } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = login(email, password);
    if (!res.success) {
      setError(res.error || 'Credenziali non valide');
    }
  };

  const handleQuickLogin = (role: UserRole) => {
    setError(null);
    loginAsRole(role);
  };

  return (
    <div className="min-h-screen bg-black text-yellow-50 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden selection:bg-yellow-400 selection:text-black">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-yellow-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-xl relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-yellow-400 text-black shadow-xl shadow-yellow-500/25 mb-1 border-2 border-yellow-300">
            <Music2 className="w-7 h-7 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            SALA PROVE MUSICALE
          </h1>
          <p className="text-xs sm:text-sm text-yellow-400/80 font-medium">
            Sistema Gestionale con Controllo Accessi basato sui Ruoli (RBAC)
          </p>
        </div>

        {/* ── Quick Role Selector Cards (1-Click Test Access) ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-xs font-bold text-yellow-300 uppercase tracking-wider">
              Accesso Rapido di Test (1-Click)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Admin Card */}
            <div
              onClick={() => handleQuickLogin('admin')}
              className="bg-neutral-950/90 border-2 border-yellow-500/40 hover:border-yellow-400 rounded-2xl p-4 sm:p-5 transition-all duration-200 hover:shadow-xl hover:shadow-yellow-500/15 cursor-pointer flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 px-2.5 py-0.5 bg-yellow-400 text-black text-[10px] font-extrabold rounded-bl-lg">
                ACCESSO COMPLETO
              </div>

              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-yellow-400/20 text-yellow-400 border border-yellow-500/30 flex items-center justify-center">
                  <Shield className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base group-hover:text-yellow-300 transition-colors">
                    Amministratore (Admin)
                  </h3>
                  <p className="text-[11px] text-neutral-400 font-mono">admin@app.com &bull; admin</p>
                </div>
                <ul className="text-xs text-neutral-300 space-y-1 pt-1 border-t border-neutral-800">
                  <li className="flex items-center gap-1.5 text-yellow-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                    <span>Calendario &amp; Prenotazioni</span>
                  </li>
                  <li className="flex items-center gap-1.5 text-yellow-300 font-semibold">
                    <Receipt className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                    <span>Conti del Mese &amp; Bollette</span>
                  </li>
                  <li className="flex items-center gap-1.5 text-yellow-300">
                    <Users className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                    <span>Operatori, Clienti &amp; Sale</span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                className="mt-4 w-full py-2 px-3 rounded-xl bg-yellow-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm group-hover:bg-yellow-300 transition-all"
              >
                <span>Entra come Admin</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Standard User Card */}
            <div
              onClick={() => handleQuickLogin('user')}
              className="bg-neutral-950/90 border border-neutral-700 hover:border-neutral-500 rounded-2xl p-4 sm:p-5 transition-all duration-200 hover:shadow-xl hover:shadow-neutral-800/40 cursor-pointer flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 px-2.5 py-0.5 bg-neutral-800 text-neutral-300 text-[10px] font-bold rounded-bl-lg border-b border-l border-neutral-700">
                SOLO CALENDARIO
              </div>

              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-neutral-800 text-neutral-300 border border-neutral-700 flex items-center justify-center">
                  <User className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base group-hover:text-yellow-300 transition-colors">
                    Utente Standard (User)
                  </h3>
                  <p className="text-[11px] text-neutral-400 font-mono">utente@app.com &bull; user</p>
                </div>
                <ul className="text-xs text-neutral-300 space-y-1 pt-1 border-t border-neutral-800">
                  <li className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Visualizza &amp; Gestisci Calendario</span>
                  </li>
                  <li className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Crea, modifica ed elimina appuntamenti</span>
                  </li>
                  <li className="flex items-center gap-1.5 text-rose-400/90">
                    <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Sezioni Conti &amp; Bollette nascoste</span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                className="mt-4 w-full py-2 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-neutral-600 transition-all"
              >
                <span>Entra come Utente</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Manual Login Form ── */}
        <div className="bg-neutral-950/80 border border-yellow-500/25 rounded-2xl p-5 sm:p-6 backdrop-blur space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Oppure accedi con credenziali
            </span>
            <span className="text-[11px] text-yellow-500/70 font-mono">Autenticazione sicura</span>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Indirizzo Email o Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@app.com oppure utente@app.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-[#0a0a0a] text-yellow-100 text-sm focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="admin oppure user"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-[#0a0a0a] text-yellow-100 text-sm focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 focus:outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-yellow-400 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-yellow-400 hover:bg-yellow-300 active:scale-[0.99] text-black font-bold text-sm shadow-lg shadow-yellow-500/25 transition-all flex items-center justify-center gap-2 mt-2"
            >
              <KeyRound className="w-4 h-4" />
              <span>Accedi al Gestionale</span>
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-neutral-500">
          Sessione memorizzata in locale. Le credenziali rimangono attive al ricaricamento della pagina.
        </p>
      </div>
    </div>
  );
};
